/**
 * Section efficace des profils en I et des tubes rectangulaires de classe 4,
 * EN 1993-1-5 §4.3 et §4.4.
 *
 * Unites : mm, mm2, mm4, mm3, MPa.
 *
 * Trois sections efficaces distinctes, comme le demande le §6.2.9.3 de
 * l'EN 1993-1-1 :
 *   - A_eff sous compression pure : toutes les parois a psi = 1 ;
 *   - W_eff,y sous M_y seul : semelle comprimee a psi = 1, puis ame sous le
 *     gradient obtenu avec la semelle efficace et l'ame brute (§4.4(3)) ;
 *   - W_eff,z sous M_z seul : de meme, axes permutes.
 * Les sections sont doublement symetriques : sous compression pure, le
 * centre de gravite ne se deplace pas (e_N = 0).
 *
 * Parois :
 *   interne (tableau 4.1)  : rho = (lambda_p - 0,055 (3 + psi)) / lambda_p^2 <= 1
 *                            si lambda_p > 0,5 + sqrt(0,085 - 0,055 psi)        (4.2)
 *   console (tableau 4.2)  : rho = (lambda_p - 0,188) / lambda_p^2 <= 1
 *                            si lambda_p > 0,748                                 (4.3)
 *   lambda_p = (b_barre / t) / (28,4 epsilon sqrt(k_sigma)), b_barre = c du tableau 5.2.
 *
 * CHOIX CONSERVATIFS DECLARES :
 *   - consoles des semelles toujours a k_sigma = 0,43 (compression uniforme),
 *     y compris sous M_z ou le gradient le long de la console augmenterait
 *     k_sigma ;
 *   - sous M_z, l'ame d'un profil en I, proche de l'axe neutre, est traitee
 *     en compression uniforme a f_y.
 *
 * Les parties non efficaces sont retranchees de la section brute (aire,
 * moment statique, inertie propre et transport) : congés et cordons restent
 * dans la section, comme les parties efficaces adjacentes.
 */

import type { Materiau, ProfilDoublementSymetrique } from '../model/profil';
import { epsilon } from '../model/profil';
import type { Proprietes } from '../proprietes/brutes';
import { fr } from '../norms/profil';

export interface ParoiEfficaceSym {
  paroi: string;
  cas: 'compression' | 'flexion y' | 'flexion z';
  type: 'interne' | 'console';
  c: number;
  t: number;
  psi: number;
  kSigma: number;
  lambdaP: number;
  rho: number;
}

export interface SectionEfficaceSymetrique {
  Aeff: number;
  Weff_y: number;
  Weff_z: number;
  /** Decalage du centre de gravite sous M_y, M_z (mm), information. */
  zG_y: number;
  yG_z: number;
  parois: ParoiEfficaceSym[];
  motif: string;
}

/** k_sigma d'une paroi interne, tableau 4.1 de l'EN 1993-1-5. */
export function kSigmaInterne(psi: number): number {
  if (psi > 1 || psi < -3) throw new Error(`psi = ${fr(psi, 3)} hors du tableau 4.1 (de -3 a 1).`);
  if (psi === 1) return 4;
  if (psi > 0) return 8.2 / (1.05 + psi);
  if (psi === 0) return 7.81;
  if (psi > -1) return 7.81 - 6.29 * psi + 9.78 * psi * psi;
  if (psi === -1) return 23.9;
  return 5.98 * (1 - psi) ** 2;
}

/** rho d'une paroi interne, expression (4.2). */
export function rhoInterne(lambdaP: number, psi: number): number {
  if (lambdaP <= 0.5 + Math.sqrt(0.085 - 0.055 * psi)) return 1;
  return Math.min(1, (lambdaP - 0.055 * (3 + psi)) / (lambdaP * lambdaP));
}

/** rho d'une paroi en console, expression (4.3). */
export function rhoConsole(lambdaP: number): number {
  return lambdaP <= 0.748 ? 1 : Math.min(1, (lambdaP - 0.188) / (lambdaP * lambdaP));
}

function lambdaP(c: number, t: number, eps: number, kSigma: number): number {
  return c / t / (28.4 * eps * Math.sqrt(kSigma));
}

/**
 * Partie retranchee : rectangle centre en (u, v), de dimension du le long de
 * u et dv le long de v. Le repere (u, v) est celui du plan de flexion : v
 * dans la direction ou varie la contrainte.
 */
interface Trou {
  aire: number;
  v: number;
  /** Inertie propre autour d'un axe parallele a u passant par son centre. */
  Ipropre: number;
}

function trou(du: number, dv: number, v: number): Trou {
  return { aire: du * dv, v, Ipropre: (du * dv ** 3) / 12 };
}

/** Inertie et module efficaces apres retrait des trous, autour du nouveau centre de gravite. */
function apresTrous(A: number, I: number, demiHauteur: number, trous: Trou[]): { A: number; vG: number; I: number; W: number } {
  const dA = trous.reduce((s, t) => s + t.aire, 0);
  const A2 = A - dA;
  const vG = -trous.reduce((s, t) => s + t.aire * t.v, 0) / A2;
  const Ibrut = I - trous.reduce((s, t) => s + t.Ipropre + t.aire * t.v * t.v, 0);
  const I2 = Ibrut - A2 * vG * vG;
  return { A: A2, vG, I: I2, W: I2 / (demiHauteur + Math.abs(vG)) };
}

/**
 * Paroi interne flechie, d'extremites v_haut (comprimee) et v_bas, centree
 * sur v = 0, l'axe neutre etant en vG : rho, puis la partie non efficace
 * (tableau 4.1), situee a b_e1 sous l'extremite comprimee.
 */
function interneFlechie(
  nom: string,
  cas: ParoiEfficaceSym['cas'],
  c: number,
  t: number,
  vG: number,
  eps: number,
  epaisseurs: number[]
): { paroi: ParoiEfficaceSym; trous: Trou[] } {
  const vHaut = c / 2;
  const vBas = -c / 2;
  const psi = Math.max(-3, Math.min(1, (vBas - vG) / (vHaut - vG)));
  const k = kSigmaInterne(psi);
  const lp = lambdaP(c, t, eps, k);
  const rho = rhoInterne(lp, psi);
  const paroi: ParoiEfficaceSym = { paroi: nom, cas, type: 'interne', c, t, psi, kSigma: k, lambdaP: lp, rho };
  if (rho >= 1) return { paroi, trous: [] };
  let be1: number;
  let manque: number;
  if (psi >= 0) {
    const beff = rho * c;
    be1 = (2 * beff) / (5 - psi);
    manque = c - beff;
  } else {
    const bc = c / (1 - psi);
    const beff = rho * bc;
    be1 = 0.4 * beff;
    manque = bc - beff;
  }
  const centre = vHaut - be1 - manque / 2;
  return { paroi, trous: epaisseurs.map((e) => trou(e, manque, centre)) };
}

function largeursI(p: Extract<ProfilDoublementSymetrique, { type: 'I-lamine' | 'I-soude' }>): { cAme: number; cAile: number } {
  const r = p.type === 'I-lamine' ? p.r : 0;
  const gorge = p.type === 'I-soude' ? p.a * Math.SQRT2 : 0;
  return { cAme: p.h - 2 * p.tf - 2 * r - 2 * gorge, cAile: (p.b - p.tw - 2 * r - 2 * gorge) / 2 };
}

/**
 * Section efficace d'un profil en I ou d'un tube rectangulaire. Leve pour un
 * tube circulaire : sa classe 4 releve de l'EN 1993-1-6, hors perimetre.
 */
export function sectionEfficaceSymetrique(p: ProfilDoublementSymetrique, m: Materiau, prop: Proprietes): SectionEfficaceSymetrique {
  if (p.type === 'tube-circulaire') {
    throw new Error('Tube circulaire de classe 4 : resistance des coques (EN 1993-1-6) hors perimetre.');
  }
  const eps = epsilon(m.fy);
  const parois: ParoiEfficaceSym[] = [];

  if (p.type === 'tube-rectangulaire') {
    const cH = p.h - 3 * p.t;
    const cB = p.b - 3 * p.t;
    const t = p.t;

    // Compression pure : quatre parois internes, psi = 1, partie non efficace au milieu.
    const pc = (nom: string, c: number) => {
      const k = 4;
      const lp = lambdaP(c, t, eps, k);
      const rho = rhoInterne(lp, 1);
      parois.push({ paroi: nom, cas: 'compression', type: 'interne', c, t, psi: 1, kSigma: k, lambdaP: lp, rho });
      return (1 - rho) * c * t;
    };
    const Aeff = prop.A - 2 * pc('parois paralleles a b', cB) - 2 * pc('parois paralleles a h', cH);

    // Flexion autour de y (v = z) : paroi superieure comprimee, parois laterales flechies.
    const flexion = (cas: 'flexion y' | 'flexion z', cComp: number, cFlechie: number, H: number, I: number) => {
      const lp = lambdaP(cComp, t, eps, 4);
      const rho = rhoInterne(lp, 1);
      parois.push({ paroi: 'paroi comprimee', cas, type: 'interne', c: cComp, t, psi: 1, kSigma: 4, lambdaP: lp, rho });
      const trousComp = rho < 1 ? [trou((1 - rho) * cComp, t, H / 2 - t / 2)] : [];
      const etape = apresTrous(prop.A, I, H / 2, trousComp);
      const ames = interneFlechie('parois flechies', cas, cFlechie, t, etape.vG, eps, [t, t]);
      parois.push(ames.paroi);
      return apresTrous(prop.A, I, H / 2, [...trousComp, ...ames.trous]);
    };
    const fy = flexion('flexion y', cB, cH, p.h, prop.Iy);
    const fz = flexion('flexion z', cH, cB, p.b, prop.Iz);
    return resultat(Aeff, fy, fz, parois);
  }

  const { cAme, cAile } = largeursI(p);
  // Consoles des semelles, k_sigma = 0,43 dans tous les cas (choix conservatif).
  const lpAile = lambdaP(cAile, p.tf, eps, 0.43);
  const rhoAile = rhoConsole(lpAile);
  const perteAile = (1 - rhoAile) * cAile;

  // Compression pure.
  const lpAme1 = lambdaP(cAme, p.tw, eps, 4);
  const rhoAme1 = rhoInterne(lpAme1, 1);
  parois.push({ paroi: 'semelles (consoles)', cas: 'compression', type: 'console', c: cAile, t: p.tf, psi: 1, kSigma: 0.43, lambdaP: lpAile, rho: rhoAile });
  parois.push({ paroi: 'ame', cas: 'compression', type: 'interne', c: cAme, t: p.tw, psi: 1, kSigma: 4, lambdaP: lpAme1, rho: rhoAme1 });
  const Aeff = prop.A - 4 * perteAile * p.tf - (1 - rhoAme1) * cAme * p.tw;

  // Flexion autour de y : consoles de la semelle superieure aux extremites libres.
  parois.push({ paroi: 'semelle comprimee (consoles)', cas: 'flexion y', type: 'console', c: cAile, t: p.tf, psi: 1, kSigma: 0.43, lambdaP: lpAile, rho: rhoAile });
  const trousSemelle = rhoAile < 1 ? [trou(2 * perteAile, p.tf, p.h / 2 - p.tf / 2)] : [];
  const etape = apresTrous(prop.A, prop.Iy, p.h / 2, trousSemelle);
  const ame = interneFlechie('ame', 'flexion y', cAme, p.tw, etape.vG, eps, [p.tw]);
  parois.push(ame.paroi);
  const fy = apresTrous(prop.A, prop.Iy, p.h / 2, [...trousSemelle, ...ame.trous]);

  // Flexion autour de z (v = y) : console comprimee de chaque semelle a son
  // extremite libre ; ame en compression uniforme (choix conservatif).
  parois.push({ paroi: 'consoles comprimees', cas: 'flexion z', type: 'console', c: cAile, t: p.tf, psi: 1, kSigma: 0.43, lambdaP: lpAile, rho: rhoAile });
  const trousZ: Trou[] = [];
  if (rhoAile < 1) {
    // Deux semelles : epaisseur 2 t_f le long de z, largeur perdue le long de y.
    trousZ.push({ aire: 2 * p.tf * perteAile, v: p.b / 2 - perteAile / 2, Ipropre: (2 * p.tf * perteAile ** 3) / 12 });
  }
  parois.push({ paroi: 'ame', cas: 'flexion z', type: 'interne', c: cAme, t: p.tw, psi: 1, kSigma: 4, lambdaP: lpAme1, rho: rhoAme1 });
  if (rhoAme1 < 1) trousZ.push({ aire: (1 - rhoAme1) * cAme * p.tw, v: 0, Ipropre: ((1 - rhoAme1) * cAme * p.tw ** 3) / 12 });
  const fz = apresTrous(prop.A, prop.Iz, p.b / 2, trousZ);
  return resultat(Aeff, fy, fz, parois);
}

function resultat(
  Aeff: number,
  fy: { vG: number; W: number },
  fz: { vG: number; W: number },
  parois: ParoiEfficaceSym[]
): SectionEfficaceSymetrique {
  const reduites = parois.filter((x) => x.rho < 1);
  return {
    Aeff,
    Weff_y: fy.W,
    Weff_z: fz.W,
    zG_y: fy.vG,
    yG_z: fz.vG,
    parois,
    motif:
      `EN 1993-1-5 §4.4 : A_eff = ${fr(Aeff, 0)} mm2, W_eff,y = ${fr(fy.W / 1e3, 1)} cm3, W_eff,z = ${fr(fz.W / 1e3, 1)} cm3` +
      (reduites.length === 0 ? '' : ` ; parois reduites : ${reduites.map((x) => `${x.paroi} (${x.cas}, rho = ${fr(x.rho, 3)})`).join(', ')}`),
  };
}
