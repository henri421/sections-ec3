/**
 * Resistances de section des cornieres, U, 2L et 2U, EN 1993-1-1 §6.2.
 *
 * Unites : efforts en kN, moments en kN.m, longueurs en mm, MPa.
 *
 * Axes de flexion : axes PRINCIPAUX u, v pour une corniere seule (les
 * moments saisis autour de y et z y sont projetes) ; axes y, z pour les U,
 * 2L et 2U, qui sont principaux par symetrie.
 *
 * CHOIX CONSERVATIFS DECLARES :
 *   - interaction N-M par le critere lineaire (6.2) en classes 1 a 3, et
 *     (6.44) en classe 4, au lieu des expressions (6.36) a (6.40), qui ne
 *     visent que les I et les tubes ;
 *   - cisaillement : si V_Ed > 0,5 V_pl,Rd, f_y reduit a (1 - rho) f_y sur
 *     toute la section (§6.2.8(3)) ;
 *   - A_v d'une corniere : aile parallele a l'effort (aile x t) ; A_v d'un U
 *     selon y : A - h_w t_w, la norme ne donnant pas d'expression.
 * Une charge appliquee hors du centre de cisaillement (U charge dans le
 * plan de l'ame) induit une torsion NON TRAITEE : le resultat l'avertit.
 */

import type { Classe } from '../classification/classifier';
import type { SectionEfficace } from '../classification/efficace';
import type { Materiau } from '../model/profil';
import { epsilon } from '../model/profil';
import type { ProfilEc3 } from '../norms/profil';
import { fr } from '../norms/profil';
import type { Proprietes } from '../proprietes/brutes';
import { corniereOrientee, type ProfilNonSymetrique } from '../proprietes/formes';
import { reductionCisaillement } from './section';

const N_PAR_KN = 1000;
const NMM_PAR_KNM = 1e6;

export interface ActionsSection {
  /** Compression positive (kN). */
  N: number;
  /** Moments autour des axes geometriques y et z (kN.m). */
  My: number;
  Mz: number;
  Vz: number;
  Vy: number;
}

export interface MomentsFlexion {
  /** Axes de calcul : principaux (u, v) pour une corniere seule, sinon (y, z). */
  axes: 'uv' | 'yz';
  /** Moment autour de l'axe fort et de l'axe faible (kN.m), valeurs absolues. */
  M1: number;
  M2: number;
  motif: string;
}

/**
 * Projection des moments saisis : M_u = M_y cos alpha + M_z sin alpha,
 * M_v = -M_y sin alpha + M_z cos alpha, alpha etant l'angle de u depuis y.
 */
export function momentsDeCalcul(p: ProfilNonSymetrique, prop: Proprietes, My: number, Mz: number): MomentsFlexion {
  if (p.type !== 'L') return { axes: 'yz', M1: Math.abs(My), M2: Math.abs(Mz), motif: 'axes y, z principaux par symetrie' };
  const c = Math.cos(prop.alpha);
  const s = Math.sin(prop.alpha);
  return {
    axes: 'uv',
    M1: Math.abs(My * c + Mz * s),
    M2: Math.abs(-My * s + Mz * c),
    motif: `moments projetes sur les axes principaux (alpha = ${fr((prop.alpha * 180) / Math.PI, 1)} degres)`,
  };
}

export interface ResistancesNonSymetriques {
  /** N_pl,Rd (classes 1 a 3) ou N_c,Rd = A_eff f_y / gamma_M0 (classe 4) (kN). */
  N_Rd: number;
  /** Moments resistants autour des axes de calcul (kN.m). */
  M1_Rd: number;
  M2_Rd: number;
  module: 'plastique' | 'elastique' | 'efficace';
  Vz_Rd: number;
  Vy_Rd: number;
  Avz: number;
  Avy: number;
  motifAv: string;
}

/** Aires de cisaillement (mm2) et leur motif. */
export function aireCisaillementNonSymetrique(p: ProfilNonSymetrique, prop: Proprietes): { Avz: number; Avy: number; motif: string } {
  switch (p.type) {
    case 'L':
      return { Avz: p.h * p.t, Avy: p.b * p.t, motif: 'aile parallele a l effort (aile x t), choix declare' };
    case '2L': {
      const c = corniereOrientee(p.corniere, p.accolee);
      return { Avz: 2 * c.h * c.t, Avy: 2 * c.b * c.t, motif: 'ailes paralleles a l effort, choix declare' };
    }
    case 'U':
    case '2U': {
      const u = p.type === 'U' ? p : p.profilU;
      const n = p.type === 'U' ? 1 : 2;
      // §6.2.6(3)(c), U lamine, effort parallele a l'ame : A - 2 b t_f + (t_w + r) t_f par profil.
      const Avz = n * (prop.A / n - 2 * u.b * u.tf + (u.tw + u.r1) * u.tf);
      return { Avz, Avy: prop.A - prop.Aw, motif: 'A_v,z : §6.2.6(3)c ; A_v,y : A - h_w t_w, choix declare' };
    }
  }
}

export function resistancesNonSymetriques(
  p: ProfilNonSymetrique,
  m: Materiau,
  prop: Proprietes,
  classe: Classe,
  eff: SectionEfficace | null,
  profil: ProfilEc3
): ResistancesNonSymetriques {
  const g0 = profil.gamma_M0.valeur;
  const uv = p.type === 'L';
  let A: number;
  let W1: number;
  let W2: number;
  let module: ResistancesNonSymetriques['module'];
  if (classe === 4) {
    if (eff === null) throw new Error('Classe 4 : section efficace requise.');
    A = eff.Aeff;
    W1 = uv ? eff.Weff_u : eff.Weff_y;
    W2 = uv ? eff.Weff_v : eff.Weff_z;
    module = 'efficace';
  } else if (classe === 3) {
    A = prop.A;
    W1 = uv ? prop.Wel_u : prop.Wel_y;
    W2 = uv ? prop.Wel_v : prop.Wel_z;
    module = 'elastique';
  } else {
    A = prop.A;
    W1 = uv ? prop.Wpl_u : prop.Wpl_y;
    W2 = uv ? prop.Wpl_v : prop.Wpl_z;
    module = 'plastique';
  }
  const av = aireCisaillementNonSymetrique(p, prop);
  const tau = m.fy / Math.sqrt(3) / g0;
  return {
    N_Rd: (A * m.fy) / g0 / N_PAR_KN,
    M1_Rd: (W1 * m.fy) / g0 / NMM_PAR_KNM,
    M2_Rd: (W2 * m.fy) / g0 / NMM_PAR_KNM,
    module,
    Vz_Rd: (av.Avz * tau) / N_PAR_KN,
    Vy_Rd: (av.Avy * tau) / N_PAR_KN,
    Avz: av.Avz,
    Avy: av.Avy,
    motifAv: av.motif,
  };
}

/**
 * Voilement par cisaillement de l'ame d'un U, §6.2.6(6) : h_w / t_w <=
 * 72 epsilon / eta ; au-dela, hors perimetre (leve). Sans objet pour les
 * cornieres.
 */
export function verifierVoilementNonSymetrique(p: ProfilNonSymetrique, m: Materiau, prop: Proprietes, profil: ProfilEc3): string {
  if (p.type === 'L' || p.type === '2L') return 'Sans objet pour une corniere.';
  const u = p.type === 'U' ? p : p.profilU;
  const lim = (72 * epsilon(m.fy)) / profil.eta.valeur;
  const el = prop.hw / u.tw;
  if (el > lim) throw new Error(`h_w / t_w = ${fr(el, 1)} > 72 epsilon / eta = ${fr(lim, 1)} : voilement par cisaillement (EN 1993-1-5 §5) hors perimetre.`);
  return `h_w / t_w = ${fr(el, 1)} <= 72 epsilon / eta = ${fr(lim, 1)} : pas de voilement par cisaillement a verifier (§6.2.6(6)).`;
}

export interface InteractionNonSymetrique {
  rho: number;
  /** Moments additionnels N e_N de la classe 4 (kN.m). */
  dM1: number;
  dM2: number;
  taux: number;
  motif: string;
}

/**
 * Interaction de section :
 *   classes 1 a 3 : N/N_Rd + M_1/M_1,Rd + M_2/M_2,Rd <= 1, critere (6.2) ;
 *   classe 4 : (6.44), M augmentes de N e_N, e_N projete sur les axes de
 *   calcul (une excentricite selon v cree un moment autour de u).
 * Resistances reduites par (1 - rho) si le cisaillement depasse 0,5 V_pl,Rd.
 */
export function interactionNonSymetrique(
  p: ProfilNonSymetrique,
  prop: Proprietes,
  classe: Classe,
  eff: SectionEfficace | null,
  r: ResistancesNonSymetriques,
  a: ActionsSection
): InteractionNonSymetrique {
  const rho = Math.max(reductionCisaillement(a.Vz, r.Vz_Rd), reductionCisaillement(a.Vy, r.Vy_Rd));
  const red = 1 - rho;
  const mf = momentsDeCalcul(p, prop, a.My, a.Mz);
  const N = Math.abs(a.N);
  let dM1 = 0;
  let dM2 = 0;
  if (classe === 4 && eff !== null && a.N > 0) {
    // e_N dans le repere y, z ; projete sur u, v pour une corniere.
    const c = mf.axes === 'uv' ? Math.cos(prop.alpha) : 1;
    const s = mf.axes === 'uv' ? Math.sin(prop.alpha) : 0;
    const e1 = eff.eNy * c + eff.eNz * s; // selon l'axe 1
    const e2 = -eff.eNy * s + eff.eNz * c; // selon l'axe 2
    dM1 = (N * Math.abs(e2)) / 1000;
    dM2 = (N * Math.abs(e1)) / 1000;
  }
  const taux = N / (r.N_Rd * red) + (mf.M1 + dM1) / (r.M1_Rd * red) + (mf.M2 + dM2) / (r.M2_Rd * red);
  const axes = mf.axes === 'uv' ? 'u, v' : 'y, z';
  return {
    rho,
    dM1,
    dM2,
    taux,
    motif: `${classe === 4 ? 'classe 4 : critere (6.44), moments augmentes de N e_N' : 'critere lineaire (6.2)'}, axes ${axes}${rho > 0 ? `, f_y reduit par le cisaillement (rho = ${fr(rho, 3)})` : ''} ; ${mf.motif}`,
  };
}
