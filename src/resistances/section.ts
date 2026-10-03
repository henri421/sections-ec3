/**
 * Resistances de section, EN 1993-1-1 §6.2.
 *
 * Unites : efforts en kN, moments en kN.m, longueurs en mm, contraintes en
 * MPa.
 */

import type { Materiau, ProfilDoublementSymetrique } from '../model/profil';
import { epsilon } from '../model/profil';
import type { Proprietes } from '../proprietes/brutes';
import type { Classe } from '../classification/classifier';
import type { ProfilEc3 } from '../norms/profil';
import { fr } from '../norms/profil';

const N_PAR_KN = 1000;
const NMM_PAR_KNM = 1e6;

export type DirectionEffort = 'z' | 'y';

/**
 * Aire de cisaillement A_v, §6.2.6(3). Effort selon z (parallele a l'ame)
 * ou selon y (parallele aux semelles).
 *   (a) I lamine, selon z : A - 2 b t_f + (t_w + 2r) t_f >= eta h_w t_w
 *   (d) I soude, selon z  : eta h_w t_w
 *   (e) I, selon y        : A - h_w t_w — expression enoncee pour les
 *       sections soudees, appliquee aussi aux laminees faute d'expression
 *       propre : CHOIX DECLARE dans le motif.
 *   (f) tube rectangulaire : A h / (b + h) selon z, A b / (b + h) selon y
 *   (g) tube circulaire    : 2 A / pi
 */
export function aireCisaillement(p: ProfilDoublementSymetrique, prop: Proprietes, dir: DirectionEffort, profil: ProfilEc3): { Av: number; motif: string } {
  const eta = profil.eta.valeur;
  switch (p.type) {
    case 'I-lamine': {
      if (dir === 'z') {
        const brut = prop.A - 2 * p.b * p.tf + (p.tw + 2 * p.r) * p.tf;
        const min = eta * prop.hw * p.tw;
        return { Av: Math.max(brut, min), motif: brut >= min ? '§6.2.6(3)a' : `§6.2.6(3)a, plancher eta h_w t_w (eta = ${fr(eta, 2)})` };
      }
      return { Av: prop.A - prop.Aw, motif: '§6.2.6(3)e, appliquee au profil lamine faute d expression propre' };
    }
    case 'I-soude':
      return dir === 'z'
        ? { Av: eta * prop.hw * p.tw, motif: `§6.2.6(3)d, eta = ${fr(eta, 2)}` }
        : { Av: prop.A - prop.Aw, motif: '§6.2.6(3)e' };
    case 'tube-rectangulaire':
      return dir === 'z'
        ? { Av: (prop.A * p.h) / (p.b + p.h), motif: '§6.2.6(3)f' }
        : { Av: (prop.A * p.b) / (p.b + p.h), motif: '§6.2.6(3)f' };
    case 'tube-circulaire':
      return { Av: (2 * prop.A) / Math.PI, motif: '§6.2.6(3)g' };
  }
}

export interface ResistancesSection {
  Npl_Rd: number;
  My_Rd: number;
  Mz_Rd: number;
  /** Module employe : plastique (classes 1, 2) ou elastique (classe 3). */
  module: 'plastique' | 'elastique';
  Vz_Rd: number;
  Vy_Rd: number;
  Avz: number;
  Avy: number;
  motifAv: string;
}

/**
 * N_pl,Rd = A f_y / gamma_M0 (6.6) ; M_c,Rd = W_pl f_y / gamma_M0 (classes
 * 1, 2) ou W_el,min f_y / gamma_M0 (classe 3) ; V_pl,Rd = A_v (f_y / sqrt 3) /
 * gamma_M0 (6.18). La classe 4 releve des proprietes efficaces de
 * l'EN 1993-1-5 §4, non traitees dans cette version : le module leve.
 */
export function resistancesSection(p: ProfilDoublementSymetrique, m: Materiau, prop: Proprietes, classe: Classe, profil: ProfilEc3): ResistancesSection {
  if (classe === 4) {
    throw new Error('Section de classe 4 : les proprietes efficaces (EN 1993-1-5 §4) ne sont pas traitees dans cette version.');
  }
  const g0 = profil.gamma_M0.valeur;
  const plast = classe <= 2;
  const avz = aireCisaillement(p, prop, 'z', profil);
  const avy = aireCisaillement(p, prop, 'y', profil);
  const tau = m.fy / Math.sqrt(3) / g0;
  return {
    Npl_Rd: (prop.A * m.fy) / g0 / N_PAR_KN,
    My_Rd: ((plast ? prop.Wpl_y : prop.Wel_y) * m.fy) / g0 / NMM_PAR_KNM,
    Mz_Rd: ((plast ? prop.Wpl_z : prop.Wel_z) * m.fy) / g0 / NMM_PAR_KNM,
    module: plast ? 'plastique' : 'elastique',
    Vz_Rd: (avz.Av * tau) / N_PAR_KN,
    Vy_Rd: (avy.Av * tau) / N_PAR_KN,
    Avz: avz.Av,
    Avy: avy.Av,
    motifAv: `A_v,z : ${avz.motif} ; A_v,y : ${avy.motif}`,
  };
}

/**
 * Voilement par cisaillement, §6.2.6(6) : critere h_w / t_w <= 72 epsilon /
 * eta. Au-dela, le voilement de l'ame releve de l'EN 1993-1-5 §5, hors
 * perimetre : le module leve.
 */
export function verifierVoilementCisaillement(p: ProfilDoublementSymetrique, m: Materiau, prop: Proprietes, profil: ProfilEc3): string {
  if (p.type !== 'I-lamine' && p.type !== 'I-soude') return 'Sans objet pour une section creuse dans cette version.';
  const lim = (72 * epsilon(m.fy)) / profil.eta.valeur;
  const el = prop.hw / p.tw;
  if (el > lim) {
    throw new Error(`h_w / t_w = ${fr(el, 1)} > 72 epsilon / eta = ${fr(lim, 1)} : voilement par cisaillement (EN 1993-1-5 §5) hors perimetre.`);
  }
  return `h_w / t_w = ${fr(el, 1)} <= 72 epsilon / eta = ${fr(lim, 1)} : pas de voilement par cisaillement a verifier (§6.2.6(6)).`;
}

/** rho = (2 V_Ed / V_pl,Rd - 1)^2 si V_Ed > 0,5 V_pl,Rd, sinon 0 (§6.2.8(3)). */
export function reductionCisaillement(VEd: number, VplRd: number): number {
  const r = Math.abs(VEd) / VplRd;
  return r <= 0.5 ? 0 : (2 * r - 1) ** 2;
}

export interface InteractionSection {
  /** Moments resistants reduits par le cisaillement (kN.m). */
  My_V_Rd: number;
  Mz_V_Rd: number;
  rho_z: number;
  rho_y: number;
  /** Moments resistants reduits par l'effort normal (kN.m). */
  MN_y_Rd: number;
  MN_z_Rd: number;
  alpha: number;
  beta: number;
  taux: number;
  motif: string;
}

/**
 * Interaction de section, §6.2.8 et §6.2.9.
 *
 * Cisaillement : profil en I flechi autour de y, M_y,V,Rd = (W_pl,y -
 * rho A_w^2 / (4 t_w)) f_y / gamma_M0 (6.30). Autres cas : f_y reduit a
 * (1 - rho) f_y sur toute la section — CHOIX CONSERVATIF declare.
 *
 * Effort normal, classes 1 et 2 : M_N,Rd des expressions (6.36) a (6.40)
 * pour les profils en I, (6.39) et (6.40) pour les tubes rectangulaires,
 * M_pl (1 - n^1,7) pour les tubes circulaires ; critere (6.41) avec ses
 * exposants alpha et beta. Classe 3 : contrainte maximale (6.42).
 * Le cumul des reductions dues a N et a V est pris en multipliant les
 * moments reduits par V par le facteur de reduction du a N.
 */
export function interactionSection(
  p: ProfilDoublementSymetrique,
  m: Materiau,
  prop: Proprietes,
  classe: Classe,
  r: ResistancesSection,
  a: { N: number; My: number; Mz: number; Vz: number; Vy: number },
  profil: ProfilEc3
): InteractionSection {
  const g0 = profil.gamma_M0.valeur;
  const rho_z = reductionCisaillement(a.Vz, r.Vz_Rd);
  const rho_y = reductionCisaillement(a.Vy, r.Vy_Rd);
  let MyV = r.My_Rd;
  let MzV = r.Mz_Rd;
  if (rho_z > 0) {
    if ((p.type === 'I-lamine' || p.type === 'I-soude') && classe <= 2) {
      MyV = Math.min(r.My_Rd, ((prop.Wpl_y - (rho_z * prop.Aw ** 2) / (4 * p.tw)) * m.fy) / g0 / NMM_PAR_KNM);
    } else {
      MyV = (1 - rho_z) * r.My_Rd;
    }
  }
  if (rho_y > 0) MzV = (1 - rho_y) * r.Mz_Rd;

  const NEd = Math.abs(a.N);
  const n = NEd / r.Npl_Rd;
  if (n > 1) throw new Error(`N_Ed = ${fr(NEd, 0)} kN depasse N_pl,Rd = ${fr(r.Npl_Rd, 0)} kN.`);

  if (classe === 3) {
    const sigma =
      (NEd * N_PAR_KN) / prop.A + (Math.abs(a.My) * NMM_PAR_KNM) / prop.Wel_y + (Math.abs(a.Mz) * NMM_PAR_KNM) / prop.Wel_z;
    const fyd = (m.fy / g0) * (1 - Math.max(rho_y, rho_z));
    return {
      My_V_Rd: MyV,
      Mz_V_Rd: MzV,
      rho_z,
      rho_y,
      MN_y_Rd: MyV,
      MN_z_Rd: MzV,
      alpha: 1,
      beta: 1,
      taux: sigma / fyd,
      motif: `classe 3 : sigma_x,Ed = ${fr(sigma, 1)} MPa, critere (6.42)${rho_y + rho_z > 0 ? ', f_y reduit par le cisaillement' : ''}`,
    };
  }

  let MNy: number;
  let MNz: number;
  let alpha: number;
  let beta: number;
  if (p.type === 'I-lamine' || p.type === 'I-soude') {
    const aw = Math.min(0.5, (prop.A - 2 * p.b * p.tf) / prop.A);
    const sansReducY = NEd <= 0.25 * r.Npl_Rd && NEd <= (0.5 * prop.Aw * m.fy) / g0 / N_PAR_KN;
    const sansReducZ = NEd <= (prop.Aw * m.fy) / g0 / N_PAR_KN;
    MNy = sansReducY ? MyV : Math.min(MyV, (MyV * (1 - n)) / (1 - 0.5 * aw));
    MNz = sansReducZ ? MzV : n <= aw ? MzV : MzV * (1 - ((n - aw) / (1 - aw)) ** 2);
    alpha = 2;
    beta = Math.max(1, 5 * n);
  } else if (p.type === 'tube-rectangulaire') {
    const aw = Math.min(0.5, (prop.A - 2 * p.b * p.t) / prop.A);
    const af = Math.min(0.5, (prop.A - 2 * p.h * p.t) / prop.A);
    MNy = Math.min(MyV, (MyV * (1 - n)) / (1 - 0.5 * aw));
    MNz = Math.min(MzV, (MzV * (1 - n)) / (1 - 0.5 * af));
    alpha = Math.min(6, 1.66 / (1 - 1.13 * n * n));
    beta = alpha;
  } else {
    MNy = MyV * (1 - n ** 1.7);
    MNz = MzV * (1 - n ** 1.7);
    alpha = 2;
    beta = 2;
  }
  const ty = MNy > 0 ? Math.abs(a.My) / MNy : Math.abs(a.My) > 0 ? Infinity : 0;
  const tz = MNz > 0 ? Math.abs(a.Mz) / MNz : Math.abs(a.Mz) > 0 ? Infinity : 0;
  const taux = Math.max(n, ty ** alpha + tz ** beta);
  return {
    My_V_Rd: MyV,
    Mz_V_Rd: MzV,
    rho_z,
    rho_y,
    MN_y_Rd: MNy,
    MN_z_Rd: MNz,
    alpha,
    beta,
    taux,
    motif: `classes 1 et 2 : (M_y/M_N,y)^${fr(alpha, 2)} + (M_z/M_N,z)^${fr(beta, 2)}, critere (6.41)`,
  };
}
