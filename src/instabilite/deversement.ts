/**
 * Moment critique de deversement et deversement, EN 1993-1-1 §6.3.2.
 *
 * Unites : longueurs en mm, moments en kN.m, MPa.
 *
 * ⚠ M_cr NE FIGURE PAS dans l'EN 1993-1-1 : la norme definit lambda_LT a
 * partir de M_cr sans donner d'expression. L'expression employee ici est
 * l'expression classique a trois termes, coefficients C1 et C2, telle que
 * donnee par l'ENV 1993-1-1 annexe F et reprise par le document NCCI SN003
 * (SCI / Access Steel). C'est une source BIBLIOGRAPHIQUE, HORS NORME, et le
 * resultat le dit. M_cr peut aussi etre saisi (calcul aux elements finis).
 */

import type { Materiau, ProfilDoublementSymetrique } from '../model/profil';
import { E, G } from '../model/profil';
import type { Proprietes } from '../proprietes/brutes';
import type { ProfilEc3 } from '../norms/profil';
import { exigerPositif, fr } from '../norms/profil';
import { ALPHA, type Courbe } from './flambement';

export const SOURCE_MCR =
  'Expression a trois termes, ENV 1993-1-1 annexe F et NCCI SN003 — source bibliographique, HORS NORME (l EN 1993-1-1 ne donne pas M_cr)';

const NMM_PAR_KNM = 1e6;

/** Diagramme du moment entre maintiens lateraux, pour C1, C2 et k_c. */
export type DiagrammeLT =
  | { type: 'lineaire'; psi: number }
  | { type: 'repartie' }
  | { type: 'concentree-milieu' };

/** Point d'application de la charge transversale, pour z_g. */
export type PointApplication = 'semelle-superieure' | 'centre' | 'semelle-inferieure';

/**
 * C1 et C2 (k = k_w = 1) :
 *   moments d'extremite : C1 = 1,88 - 1,40 psi + 0,52 psi^2 <= 2,70, C2 = 0 ;
 *   charge repartie, appuis simples : C1 = 1,132, C2 = 0,459 ;
 *   charge concentree a mi-portee : C1 = 1,365, C2 = 0,553.
 * Source : NCCI SN003, hors norme.
 */
export function coefficientsC(d: DiagrammeLT): { C1: number; C2: number } {
  if (d.type === 'repartie') return { C1: 1.132, C2: 0.459 };
  if (d.type === 'concentree-milieu') return { C1: 1.365, C2: 0.553 };
  if (!Number.isFinite(d.psi) || d.psi < -1 || d.psi > 1) throw new Error('psi doit etre compris entre -1 et 1 (-).');
  return { C1: Math.min(2.7, 1.88 - 1.4 * d.psi + 0.52 * d.psi * d.psi), C2: 0 };
}

export interface MomentCritique {
  M_cr: number;
  origine: 'hors-norme' | 'saisi';
  source: string;
  C1: number | null;
  C2: number | null;
  z_g: number | null;
}

/**
 * M_cr = C1 pi^2 E I_z / L^2 { sqrt[ I_w/I_z + L^2 G I_t / (pi^2 E I_z) + (C2 z_g)^2 ] - C2 z_g }
 * pour un profil en I doublement symetrique, k = k_w = 1. z_g > 0 pour une
 * charge appliquee au-dessus du centre de cisaillement (destabilisante).
 */
export function momentCritique(
  p: ProfilDoublementSymetrique,
  prop: Proprietes,
  L: number,
  d: DiagrammeLT,
  point: PointApplication,
  saisi: number | null
): MomentCritique {
  if (saisi !== null) {
    exigerPositif(saisi, 'Le moment critique saisi M_cr', 'kN.m');
    return { M_cr: saisi, origine: 'saisi', source: 'saisi par l utilisateur (calcul exterieur)', C1: null, C2: null, z_g: null };
  }
  if (p.type !== 'I-lamine' && p.type !== 'I-soude') {
    throw new Error('M_cr par l expression a trois termes : profils en I doublement symetriques seulement.');
  }
  exigerPositif(L, 'La longueur entre maintiens lateraux L', 'mm');
  const { C1, C2 } = coefficientsC(d);
  const z_g = d.type === 'lineaire' ? 0 : point === 'semelle-superieure' ? p.h / 2 : point === 'semelle-inferieure' ? -p.h / 2 : 0;
  const base = (Math.PI ** 2 * E * prop.Iz) / (L * L);
  const terme = Math.sqrt(prop.Iw / prop.Iz + (L * L * G * prop.It) / (Math.PI ** 2 * E * prop.Iz) + (C2 * z_g) ** 2) - C2 * z_g;
  return { M_cr: (C1 * base * terme) / NMM_PAR_KNM, origine: 'hors-norme', source: SOURCE_MCR, C1, C2, z_g };
}

/** Courbe de deversement : methode generale (tableau 6.4) ou laminee (tableau 6.5). */
export function courbeDeversement(p: ProfilDoublementSymetrique, methode: 'generale' | 'laminee'): Courbe {
  if (p.type !== 'I-lamine' && p.type !== 'I-soude') return 'd';
  const hb = p.h / p.b;
  if (methode === 'generale') {
    if (p.type === 'I-lamine') return hb <= 2 ? 'a' : 'b';
    return hb <= 2 ? 'c' : 'd';
  }
  if (p.type === 'I-lamine') return hb <= 2 ? 'b' : 'c';
  return hb <= 2 ? 'c' : 'd';
}

/** k_c, tableau 6.6. */
export function coefficientKc(d: DiagrammeLT): number {
  if (d.type === 'lineaire') return 1 / (1.33 - 0.33 * d.psi);
  if (d.type === 'repartie') return 0.94;
  return 0.9;
}

export interface Deversement {
  applicable: boolean;
  motif: string;
  methode: 'generale' | 'laminee';
  M_cr: MomentCritique | null;
  lambda_LT: number | null;
  courbe: Courbe | null;
  chi_LT: number;
  f: number | null;
  Mb_Rd: number | null;
}

/**
 * Deversement, §6.3.2. Methode du §6.3.2.3 pour les profils en I (lamines
 * et soudes equivalents), avec lambda_LT,0 et beta du profil, et la
 * correction f (6.58). Dispense (§6.3.2.2(4)) si lambda_LT <= lambda_LT,0 ou
 * M_Ed / M_cr <= lambda_LT,0^2 : le resultat dit NON APPLICABLE, pas
 * satisfait. Sections creuses fermees : non applicable.
 */
export function deversement(
  p: ProfilDoublementSymetrique,
  m: Materiau,
  prop: Proprietes,
  Wy: number,
  MEd: number,
  maintenu: boolean,
  L: number,
  d: DiagrammeLT,
  point: PointApplication,
  McrSaisi: number | null,
  profil: ProfilEc3
): Deversement {
  const methode = 'laminee' as const;
  if (maintenu) {
    return { applicable: false, motif: 'Membrure comprimee maintenue lateralement en continu : deversement empeche.', methode, M_cr: null, lambda_LT: null, courbe: null, chi_LT: 1, f: null, Mb_Rd: null };
  }
  if (p.type === 'tube-circulaire' || p.type === 'tube-rectangulaire') {
    return { applicable: false, motif: 'Section creuse fermee : rigidite de torsion elevee, deversement non applicable.', methode, M_cr: null, lambda_LT: null, courbe: null, chi_LT: 1, f: null, Mb_Rd: null };
  }
  const Mcr = momentCritique(p, prop, L, d, point, McrSaisi);
  const lambda_LT = Math.sqrt((Wy * m.fy) / (Mcr.M_cr * NMM_PAR_KNM));
  const l0 = profil.lambda_LT0.valeur;
  if (lambda_LT <= l0 || Math.abs(MEd) / Mcr.M_cr <= l0 * l0) {
    return {
      applicable: false,
      motif:
        lambda_LT <= l0
          ? `lambda_LT = ${fr(lambda_LT, 3)} <= lambda_LT,0 = ${fr(l0, 2)} : deversement negligeable (§6.3.2.2(4)).`
          : `M_Ed / M_cr = ${fr(Math.abs(MEd) / Mcr.M_cr, 3)} <= lambda_LT,0^2 = ${fr(l0 * l0, 3)} : deversement negligeable (§6.3.2.2(4)).`,
      methode,
      M_cr: Mcr,
      lambda_LT,
      courbe: null,
      chi_LT: 1,
      f: null,
      Mb_Rd: null,
    };
  }
  const beta = profil.beta_LT.valeur;
  const courbe = courbeDeversement(p, methode);
  const a = ALPHA[courbe];
  const Phi = 0.5 * (1 + a * (lambda_LT - l0) + beta * lambda_LT * lambda_LT);
  const chi = Math.min(1, 1 / (lambda_LT * lambda_LT), 1 / (Phi + Math.sqrt(Phi * Phi - beta * lambda_LT * lambda_LT)));
  const kc = coefficientKc(d);
  const f = Math.min(1, 1 - 0.5 * (1 - kc) * (1 - 2 * (lambda_LT - 0.8) ** 2));
  const chiMod = Math.min(1, 1 / (lambda_LT * lambda_LT), chi / f);
  return {
    applicable: true,
    motif: `Methode du §6.3.2.3, courbe ${courbe}, k_c = ${fr(kc, 3)}, chi_LT,mod = chi_LT / f (6.58). M_cr : ${Mcr.origine === 'saisi' ? 'saisi' : 'HORS NORME'}.`,
    methode,
    M_cr: Mcr,
    lambda_LT,
    courbe,
    chi_LT: chiMod,
    f,
    Mb_Rd: (chiMod * Wy * m.fy) / profil.gamma_M1.valeur / NMM_PAR_KNM,
  };
}
