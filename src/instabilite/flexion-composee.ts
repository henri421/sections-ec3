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

/** C_m pour un moment lineaire, tableau B.3 : 0,6 + 0,4 psi >= 0,4. */
export function coefficientCm(psi: number): number {
  return Math.max(0.4, 0.6 + 0.4 * psi);
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
 * expressions (6.61) et (6.62) avec Delta M = 0 (classes 1 a 3).
 */
export function interaction633(e: EntreesInteraction, profil: ProfilEc3): Interaction633 {
  const annexe = profil.annexe633.valeur;
  if (annexe === 'A') {
    throw new Error('Annexe A (methode 1) du §6.3.3 : non implementee dans cette version. Choisir l annexe B dans le profil normatif.');
  }
  const nY = e.NEd / (e.chi_y * e.NRd1);
  const nZ = e.NEd / (e.chi_z * e.NRd1);
  const enI = e.profil.type === 'I-lamine' || e.profil.type === 'I-soude';
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
  const My = Math.abs(e.MyEd);
  const Mz = Math.abs(e.MzEd);
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
    motif: `Annexe B (${e.sensibleTorsion ? 'tableau B.2, element sensible a la torsion' : 'tableau B.1'}), classe ${e.classe} ; C_my = ${fr(e.Cmy, 3)}, C_mz = ${fr(e.Cmz, 3)}${e.sensibleTorsion ? `, C_mLT = ${fr(e.CmLT, 3)}` : ''}`,
  };
}
