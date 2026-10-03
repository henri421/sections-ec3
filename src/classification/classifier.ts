/**
 * Classification des sections, EN 1993-1-1 §5.5 et tableau 5.2.
 *
 * Unites : mm, kN, kN.m, MPa.
 *
 * La classe est une propriete du couple profil ET sollicitation : une ame
 * flechie et la meme ame en flexion composee n'ont pas la meme limite. La
 * fonction prend donc les actions en entree.
 */

import type { Materiau, Profil, ProfilDoublementSymetrique, ProfilL, ProfilU } from '../model/profil';
import { epaisseurAileRacine, epsilon, estDoublementSymetrique } from '../model/profil';
import { corniereOrientee } from '../proprietes/formes';
import type { Proprietes } from '../proprietes/brutes';
import { fr } from '../norms/profil';

export type Classe = 1 | 2 | 3 | 4;

export interface ClasseParoi {
  paroi: string;
  c: number;
  t: number;
  elancement: number;
  limites: [number, number, number];
  classe: Classe;
  detail: string;
}

export interface Classification {
  classe: Classe;
  /** Paroi qui gouverne. */
  gouvernante: string;
  parois: ClasseParoi[];
}

export interface ActionsClassification {
  /** Effort normal, compression positive (kN). */
  N: number;
  /** Moment autour de y (kN.m), pour la distribution de contraintes de l'ame. */
  My: number;
  /**
   * Moment autour de z (kN.m). Sous M_z, les parois laterales d'un tube
   * rectangulaire deviennent des semelles comprimees : les classer comme des
   * ames flechies serait non conservatif.
   */
  Mz: number;
}

const N_PAR_KN = 1000;
const NMM_PAR_KNM = 1e6;

function classeDe(el: number, lim: [number, number, number]): Classe {
  return el <= lim[0] ? 1 : el <= lim[1] ? 2 : el <= lim[2] ? 3 : 4;
}

/**
 * Paroi interne (ame, paroi de tube) sous flexion composee, tableau 5.2
 * feuille 1. alpha : part comprimee de la paroi en distribution plastique ;
 * psi : rapport des contraintes d'extremite en distribution elastique.
 */
export function limitesParoiInterne(eps: number, alpha: number, psi: number): [number, number, number] {
  const c1 = alpha > 0.5 ? (396 * eps) / (13 * alpha - 1) : (36 * eps) / alpha;
  const c2 = alpha > 0.5 ? (456 * eps) / (13 * alpha - 1) : (41.5 * eps) / alpha;
  const c3 = psi > -1 ? (42 * eps) / (0.67 + 0.33 * psi) : 62 * eps * (1 - psi) * Math.sqrt(-psi);
  return [c1, c2, c3];
}

/**
 * Distribution de contraintes de l'ame sous N et M_y.
 *   alpha = 0,5 (1 + N / (c t_w f_y)), borne a [0 ; 1] (axe neutre plastique dans l'ame) ;
 *   psi   = sigma_2 / sigma_1 aux bords de l'ame, sigma = N/A +- M_y (c/2) / I_y.
 * Sans moment, l'ame est uniformement comprimee : alpha = 1, psi = 1.
 */
export function distributionAme(c: number, t: number, fy: number, prop: Proprietes, a: ActionsClassification): { alpha: number; psi: number } {
  const N = a.N * N_PAR_KN;
  const M = Math.abs(a.My) * NMM_PAR_KNM;
  if (M === 0) {
    return N > 0 ? { alpha: 1, psi: 1 } : { alpha: 0.5, psi: -1 };
  }
  const alpha = Math.min(1, Math.max(0, 0.5 * (1 + N / (c * t * fy))));
  const s1 = N / prop.A + (M * c) / 2 / prop.Iy;
  const s2 = N / prop.A - (M * c) / 2 / prop.Iy;
  const psi = s1 === 0 ? 1 : s2 / s1;
  return { alpha: Math.max(alpha, 1e-6), psi };
}

/**
 * Classe de chaque paroi et de la section (la plus defavorable), §5.5.2(6).
 *
 * CHOIX CONSERVATIF : les semelles en console sont classees en compression
 * uniforme (9 / 10 / 14 epsilon) quelle que soit la sollicitation, sans
 * profiter des limites plus larges du gradient de M_z.
 */
export function classifier(p: Profil, m: Materiau, prop: Proprietes, a: ActionsClassification): Classification {
  return estDoublementSymetrique(p) ? classifierSymetrique(p, m, prop, a) : classifierNonSymetrique(p, m, prop, a);
}

function classifierSymetrique(p: ProfilDoublementSymetrique, m: Materiau, prop: Proprietes, a: ActionsClassification): Classification {
  const eps = epsilon(m.fy);
  const parois: ClasseParoi[] = [];
  const traction = a.N < 0 && a.My === 0 && a.Mz === 0;

  if (p.type === 'tube-circulaire') {
    const el = p.d / p.t;
    const lim: [number, number, number] = [50 * eps * eps, 70 * eps * eps, 90 * eps * eps];
    parois.push({ paroi: 'tube', c: p.d, t: p.t, elancement: el, limites: lim, classe: traction ? 1 : classeDe(el, lim), detail: 'd / t, tableau 5.2 feuille 3' });
  } else {
    let cAme: number;
    let tAme: number;
    let nomAme: string;
    if (p.type === 'tube-rectangulaire') {
      // Note du tableau 5.2 : c = h - 3t pour les tubes rectangulaires.
      cAme = p.h - 3 * p.t;
      tAme = p.t;
      nomAme = 'paroi laterale (h - 3t)';
    } else {
      const r = p.type === 'I-lamine' ? p.r : 0;
      const gorge = p.type === 'I-soude' ? p.a * Math.SQRT2 : 0;
      cAme = p.h - 2 * p.tf - 2 * r - 2 * gorge;
      tAme = p.tw;
      nomAme = 'ame';
    }
    const elAme = cAme / tAme;
    if (p.type === 'tube-rectangulaire' && a.Mz !== 0) {
      // CHOIX CONSERVATIF, symetrique de celui des parois paralleles a b :
      // sous M_z, la paroi laterale est classee en compression uniforme.
      const lim: [number, number, number] = [33 * eps, 38 * eps, 42 * eps];
      parois.push({ paroi: nomAme, c: cAme, t: tAme, elancement: elAme, limites: lim, classe: classeDe(elAme, lim), detail: 'paroi interne comprimee (M_z non nul)' });
    } else {
      const { alpha, psi } = distributionAme(cAme, tAme, m.fy, prop, a);
      const limAme = limitesParoiInterne(eps, alpha, psi);
      parois.push({
        paroi: nomAme,
        c: cAme,
        t: tAme,
        elancement: elAme,
        limites: limAme,
        classe: traction ? 1 : classeDe(elAme, limAme),
        detail: `paroi interne, alpha = ${fr(alpha, 3)}, psi = ${fr(psi, 3)}`,
      });
    }

    if (p.type === 'tube-rectangulaire') {
      // Parois paralleles a b : en compression (N, M_y) ; classement en compression uniforme, meme sous M_z seul (conservatif).
      const c = p.b - 3 * p.t;
      const lim: [number, number, number] = [33 * eps, 38 * eps, 42 * eps];
      parois.push({ paroi: 'paroi superieure (b - 3t)', c, t: p.t, elancement: c / p.t, limites: lim, classe: traction ? 1 : classeDe(c / p.t, lim), detail: 'paroi interne comprimee' });
    } else {
      const r = p.type === 'I-lamine' ? p.r : 0;
      const gorge = p.type === 'I-soude' ? p.a * Math.SQRT2 : 0;
      const c = (p.b - p.tw - 2 * r - 2 * gorge) / 2;
      const lim: [number, number, number] = [9 * eps, 10 * eps, 14 * eps];
      parois.push({ paroi: 'semelle (console)', c, t: p.tf, elancement: c / p.tf, limites: lim, classe: traction ? 1 : classeDe(c / p.tf, lim), detail: 'paroi en console comprimee, tableau 5.2 feuille 2' });
    }
  }
  const gouv = parois.reduce((x, y) => (y.classe > x.classe ? y : x));
  return { classe: gouv.classe, gouvernante: gouv.paroi, parois };
}

/** Paroi en console comprimee uniformement, tableau 5.2 feuille 2 : 9 / 10 / 14 epsilon. */
function paroiConsole(nom: string, c: number, t: number, eps: number, traction: boolean): ClasseParoi {
  const lim: [number, number, number] = [9 * eps, 10 * eps, 14 * eps];
  return { paroi: nom, c, t, elancement: c / t, limites: lim, classe: traction ? 1 : classeDe(c / t, lim), detail: 'paroi en console, compression uniforme (tableau 5.2 feuille 2)' };
}

/**
 * Corniere, tableau 5.2 feuille 3 (section comprimee) : classe 3 si
 * h/t <= 15 epsilon et (b + h)/(2t) <= 11,5 epsilon, classe 4 sinon — pas de
 * classe 1 ou 2 en compression. Ailes aussi classees en console (« refer
 * also to outstand flanges »), c = aile - t - r_1. La note excluant les
 * cornieres en contact continu avec d'autres elements n'est pas invoquee
 * pour les 2L, du cote de la securite.
 */
function paroisCorniere(c: ProfilL, prefixe: string, eps: number, comprime: boolean, traction: boolean): ClasseParoi[] {
  const res: ClasseParoi[] = [];
  if (comprime) {
    const grand = Math.max(c.h, c.b);
    const l1: [number, number, number] = [0, 0, 15 * eps];
    const l2: [number, number, number] = [0, 0, 11.5 * eps];
    const detail = 'corniere comprimee (tableau 5.2 feuille 3) : pas de classe 1 ou 2';
    res.push({ paroi: `${prefixe}h / t`, c: grand, t: c.t, elancement: grand / c.t, limites: l1, classe: classeDe(grand / c.t, l1), detail });
    res.push({ paroi: `${prefixe}(b + h) / 2t`, c: (c.b + c.h) / 2, t: c.t, elancement: (c.b + c.h) / (2 * c.t), limites: l2, classe: classeDe((c.b + c.h) / (2 * c.t), l2), detail });
  }
  res.push(paroiConsole(`${prefixe}aile h (console)`, c.h - c.t - c.r1, c.t, eps, traction));
  res.push(paroiConsole(`${prefixe}aile b (console)`, c.b - c.t - c.r1, c.t, eps, traction));
  return res;
}

/**
 * Profil en U (ou 2U) : ame en paroi interne sous N et M_y (alpha, psi comme
 * pour les I, l'axe y etant de symetrie), classee en compression uniforme
 * des que M_z est non nul (l'ame est alors une semelle) ; ailes en console
 * comprimees uniformement, c = b - t_w - r_1.
 */
function paroisU(u: ProfilU, nAmes: number, eps: number, fy: number, prop: Proprietes, a: ActionsClassification, traction: boolean): ClasseParoi[] {
  const cAme = u.h - 2 * epaisseurAileRacine(u) - 2 * u.r1;
  const res: ClasseParoi[] = [];
  if (a.Mz !== 0) {
    const lim: [number, number, number] = [33 * eps, 38 * eps, 42 * eps];
    res.push({ paroi: 'ame', c: cAme, t: u.tw, elancement: cAme / u.tw, limites: lim, classe: classeDe(cAme / u.tw, lim), detail: 'paroi interne comprimee (M_z non nul)' });
  } else {
    // alpha : effort normal reparti sur les n ames.
    const { alpha, psi } = distributionAme(cAme, nAmes * u.tw, fy, prop, a);
    const lim = limitesParoiInterne(eps, alpha, psi);
    res.push({ paroi: 'ame', c: cAme, t: u.tw, elancement: cAme / u.tw, limites: lim, classe: traction ? 1 : classeDe(cAme / u.tw, lim), detail: `paroi interne, alpha = ${fr(alpha, 3)}, psi = ${fr(psi, 3)}` });
  }
  res.push(paroiConsole('aile (console)', u.b - u.tw - u.r1, u.tf, eps, traction));
  return res;
}

function classifierNonSymetrique(p: Exclude<Profil, ProfilDoublementSymetrique>, m: Materiau, prop: Proprietes, a: ActionsClassification): Classification {
  const eps = epsilon(m.fy);
  const traction = a.N < 0 && a.My === 0 && a.Mz === 0;
  const comprime = a.N > 0;
  let parois: ClasseParoi[];
  switch (p.type) {
    case 'L':
      parois = paroisCorniere(p, '', eps, comprime, traction);
      break;
    case '2L':
      parois = paroisCorniere(corniereOrientee(p.corniere, p.accolee), 'corniere, ', eps, comprime, traction);
      break;
    case 'U':
      parois = paroisU(p, 1, eps, m.fy, prop, a, traction);
      break;
    case '2U':
      parois = paroisU(p.profilU, 2, eps, m.fy, prop, a, traction);
      break;
  }
  const gouv = parois.reduce((x, y) => (y.classe > x.classe ? y : x));
  return { classe: gouv.classe, gouvernante: gouv.paroi, parois };
}
