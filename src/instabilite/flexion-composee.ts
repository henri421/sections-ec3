/**
 * Flexion composee avec risque d'instabilite, EN 1993-1-1 §6.3.3,
 * facteurs k_ij de l'annexe B (methode 2).
 *
 * Unites : kN, kN.m.
 *
 * Le choix de l'annexe releve de l'annexe nationale : il est porte par le
 * profil normatif. L'annexe A (methode 1) n'est pas implementee dans cette
 * version ; la choisir fait lever le module, plutot que de basculer en
 * silence sur l'annexe B.
 */

import type { Classe } from '../classification/classifier';
import type { Profil } from '../model/profil';
import type { ProfilEc3 } from '../norms/profil';
import { fr } from '../norms/profil';
import type { DiagrammeLT } from './deversement';

/**
 * Diagramme mixte : moments d'extremite ET charge transversale (tableau B.3,
 * lignes 2 et 3).
 *   M_h : moment d'extremite de plus grande valeur absolue (kN.m) ;
 *   psi : rapport de l'autre moment d'extremite a M_h, entre -1 et 1 ;
 *   M_s : moment en travee du diagramme TOTAL, a mi-portee (kN.m) ;
 *   charge : repartie ou concentree.
 */
export interface DiagrammeMixte {
  type: 'mixte';
  charge: 'repartie' | 'concentree';
  Mh: number;
  psi: number;
  Ms: number;
}

/** Diagrammes admis pour C_m : ceux du deversement, plus le diagramme mixte. */
export type DiagrammeCm = DiagrammeLT | DiagrammeMixte;

/**
 * C_m d'un diagramme mixte, tableau B.3 de l'EN 1993-1-1, annexe B :
 *
 *   |M_s| <= |M_h|, alpha_s = M_s / M_h :
 *     0 <= alpha_s <= 1  : 0,2 + 0,8 alpha_s >= 0,4 (deux types de charge) ;
 *     -1 <= alpha_s < 0  : psi >= 0 : repartie 0,1 - 0,8 alpha_s, concentree -0,8 alpha_s ;
 *                          psi < 0  : repartie 0,1 (1 - psi) - 0,8 alpha_s,
 *                                     concentree 0,2 (-psi) - 0,8 alpha_s ; tous >= 0,4 ;
 *   |M_s| > |M_h|, alpha_h = M_h / M_s :
 *     repartie 0,95 + 0,05 alpha_h, concentree 0,90 + 0,10 alpha_h,
 *     le terme en alpha_h multiplie par (1 + 2 psi) si alpha_h < 0 et psi < 0.
 *
 * M_h = 0 avec M_s non nul redonne la ligne « appuis simples » (0,95 ou 0,90).
 */
export function coefficientCmMixte(d: DiagrammeMixte): number {
  const { Mh, Ms, psi } = d;
  if (!Number.isFinite(psi) || psi < -1 || psi > 1) throw new Error('psi doit être compris entre -1 et 1 (-).');
  if (!Number.isFinite(Mh) || !Number.isFinite(Ms)) throw new Error('M_h et M_s doivent être des nombres (kN.m).');
  if (Mh === 0 && Ms === 0) throw new Error('Diagramme mixte nul : M_h et M_s ne peuvent pas être tous deux nuls.');
  const repartie = d.charge === 'repartie';

  if (Math.abs(Ms) <= Math.abs(Mh)) {
    const as = Ms / Mh;
    if (as >= 0) return Math.max(0.4, 0.2 + 0.8 * as);
    const brut = psi >= 0 ? (repartie ? 0.1 : 0) - 0.8 * as : (repartie ? 0.1 * (1 - psi) : 0.2 * -psi) - 0.8 * as;
    return Math.max(0.4, brut);
  }
  const ah = Mh / Ms;
  const facteur = ah < 0 && psi < 0 ? 1 + 2 * psi : 1;
  return repartie ? 0.95 + 0.05 * ah * facteur : 0.9 + 0.1 * ah * facteur;
}

/** C_m pour un moment lineaire, tableau B.3 : 0,6 + 0,4 psi >= 0,4. */
export function coefficientCm(psi: number): number {
  return Math.max(0.4, 0.6 + 0.4 * psi);
}

/**
 * C_m selon le diagramme, tableau B.3 :
 *   moments d'extremite (lineaire)            : 0,6 + 0,4 psi >= 0,4 ;
 *   charge repartie, appuis simples (M_h = 0) : 0,95 + 0,05 alpha_h = 0,95 ;
 *   charge concentree, appuis simples         : 0,90 + 0,10 alpha_h = 0,90.
 * Appliquer la formule lineaire a une charge transversale (psi = 0 donnant
 * 0,6) serait non conservatif.
 */
export function coefficientCmDiagramme(d: DiagrammeCm): number {
  if (d.type === 'mixte') return coefficientCmMixte(d);
  if (d.type === 'repartie') return 0.95;
  if (d.type === 'concentree-milieu') return 0.9;
  if (!Number.isFinite(d.psi) || d.psi < -1 || d.psi > 1) throw new Error('psi doit être compris entre -1 et 1 (-).');
  return coefficientCm(d.psi);
}

export interface EntreesInteraction {
  profil: Profil;
  classe: Classe;
  NEd: number;
  MyEd: number;
  MzEd: number;
  /** N_Rk / gamma_M1, M_y,Rk / gamma_M1, M_z,Rk / gamma_M1 (kN, kN.m). */
  NRd1: number;
  MyRd1: number;
  MzRd1: number;
  chi_y: number;
  chi_z: number;
  chi_LT: number;
  lambda_y: number;
  lambda_z: number;
  Cmy: number;
  Cmz: number;
  CmLT: number;
  /** Element sensible aux deformations de torsion (I non maintenu au deversement). */
  sensibleTorsion: boolean;
  /** Moments additionnels N e_N des sections de classe 4 (kN.m), termes Delta M de (6.61) et (6.62). */
  dMy?: number;
  dMz?: number;
  /** Mention ajoutee au motif quand l'annexe B est employee hors de son domaine. */
  horsDomaine?: string;
}

export interface Interaction633 {
  annexe: 'A' | 'B';
  kyy: number;
  kyz: number;
  kzy: number;
  kzz: number;
  taux61: number;
  taux62: number;
  motif: string;
}

/**
 * Tableaux B.1 (non sensible) et B.2 (sensible a la torsion), puis
 * expressions (6.61) et (6.62), Delta M = N e_N en classe 4 (nul sinon).
 */
export function interaction633(e: EntreesInteraction, profil: ProfilEc3): Interaction633 {
  const annexe = profil.annexe633.valeur;
  if (annexe === 'A') {
    throw new Error("Annexe A (méthode 1) du §6.3.3 : non implémentée dans cette version. Choisir l'annexe B dans le profil normatif.");
  }
  const nY = e.NEd / (e.chi_y * e.NRd1);
  const nZ = e.NEd / (e.chi_z * e.NRd1);
  // 2U dos a dos : section en I doublement symetrique, formules des I.
  const enI = e.profil.type === 'I-lamine' || e.profil.type === 'I-soude' || e.profil.type === '2U';
  let kyy: number;
  let kzz: number;
  let kyz: number;
  let kzy: number;
  if (e.classe <= 2) {
    kyy = e.Cmy * Math.min(1 + (e.lambda_y - 0.2) * nY, 1 + 0.8 * nY);
    kzz = enI ? e.Cmz * Math.min(1 + (2 * e.lambda_z - 0.6) * nZ, 1 + 1.4 * nZ) : e.Cmz * Math.min(1 + (e.lambda_z - 0.2) * nZ, 1 + 0.8 * nZ);
    kyz = 0.6 * kzz;
    if (e.sensibleTorsion) {
      if (e.lambda_z < 0.4) {
        kzy = Math.min(0.6 + e.lambda_z, 1 - (0.1 * e.lambda_z * nZ) / (e.CmLT - 0.25));
      } else {
        kzy = Math.max(1 - (0.1 * e.lambda_z * nZ) / (e.CmLT - 0.25), 1 - (0.1 * nZ) / (e.CmLT - 0.25));
      }
    } else {
      kzy = 0.6 * kyy;
    }
  } else {
    kyy = e.Cmy * Math.min(1 + 0.6 * e.lambda_y * nY, 1 + 0.6 * nY);
    kzz = e.Cmz * Math.min(1 + 0.6 * e.lambda_z * nZ, 1 + 0.6 * nZ);
    kyz = kzz;
    kzy = e.sensibleTorsion
      ? Math.max(1 - (0.05 * e.lambda_z * nZ) / (e.CmLT - 0.25), 1 - (0.05 * nZ) / (e.CmLT - 0.25))
      : 0.8 * kyy;
  }
  const My = Math.abs(e.MyEd) + (e.dMy ?? 0);
  const Mz = Math.abs(e.MzEd) + (e.dMz ?? 0);
  const taux61 = nY + (kyy * My) / (e.chi_LT * e.MyRd1) + (kyz * Mz) / e.MzRd1;
  const taux62 = nZ + (kzy * My) / (e.chi_LT * e.MyRd1) + (kzz * Mz) / e.MzRd1;
  return {
    annexe,
    kyy,
    kyz,
    kzy,
    kzz,
    taux61,
    taux62,
    motif: `Annexe B (${e.sensibleTorsion ? 'tableau B.2, élément sensible à la torsion' : 'tableau B.1'}), classe ${e.classe} ; C_my = ${fr(e.Cmy, 3)}, C_mz = ${fr(e.Cmz, 3)}${e.sensibleTorsion ? `, C_mLT = ${fr(e.CmLT, 3)}` : ''}${e.horsDomaine ? ` ; ${e.horsDomaine}` : ''}`,
  };
}
