/**
 * Deversement des cornieres, U, 2L et 2U, EN 1993-1-1 §6.3.2.2 (methode
 * generale).
 *
 * Unites : longueurs en mm, moments en kN.m, MPa.
 *
 *   U et 2U flechis autour de y : l'axe de flexion est un axe de symetrie
 *   (z_j = 0), l'expression a trois termes s'applique avec I_z, I_t, I_w du
 *   profil, z_g mesure depuis le centre de cisaillement (situe sur l'axe y).
 *   Meme source HORS NORME que pour les I (ENV 1993-1-1 annexe F, NCCI SN003).
 *   2U : I_w somme des deux profils (gauchissement d'ensemble non compte),
 *   du cote de la securite.
 *   Courbe d (tableau 6.4, « autres sections ») pour tous ces profils ;
 *   seuil lambda_LT,0 = 0,2 de la methode generale.
 *
 *   L et 2L : pas d'expression usuelle fiable dans ce perimetre. M_cr doit
 *   etre SAISI ; sans lui, le deversement est rendu « a fournir » : NON
 *   VERIFIE, jamais satisfait.
 *
 * Le deversement n'est recherche que pour une flexion autour de l'axe FORT
 * (u pour une corniere seule, l'axe de plus grande inertie sinon).
 *
 * Un U charge dans le plan de son ame (et non au centre de cisaillement) est
 * tordu : cette torsion n'est pas traitee, le motif l'avertit.
 */

import type { Classe } from '../classification/classifier';
import type { SectionEfficace } from '../classification/efficace';
import type { Materiau } from '../model/profil';
import { E, G } from '../model/profil';
import type { ProfilEc3 } from '../norms/profil';
import { exigerPositif, fr } from '../norms/profil';
import type { Proprietes } from '../proprietes/brutes';
import type { ProfilNonSymetrique } from '../proprietes/formes';
import { coefficientsC, SOURCE_MCR, type DiagrammeLT, type MomentCritique, type PointApplication } from './deversement';
import { ALPHA, type Courbe } from './flambement';

const NMM_PAR_KNM = 1e6;
/** Plateau de la methode generale, §6.3.2.2(4). */
export const LAMBDA_LT0_GENERALE = 0.2;
const COURBE: Courbe = 'd';

export interface DeversementNonSymetrique {
  applicable: boolean;
  /** true si M_cr manque : deversement non verifie. */
  aFournir: boolean;
  motif: string;
  M_cr: MomentCritique | null;
  lambda_LT: number | null;
  courbe: Courbe | null;
  chi_LT: number;
  Mb_Rd: number | null;
}

function sansObjet(motif: string, aFournir = false): DeversementNonSymetrique {
  return { applicable: false, aFournir, motif, M_cr: null, lambda_LT: null, courbe: null, chi_LT: 1, Mb_Rd: null };
}

/** Module de flexion autour de l'axe fort selon la classe (mm3). */
function moduleFort(p: ProfilNonSymetrique, prop: Proprietes, classe: Classe, eff: SectionEfficace | null): number {
  const uv = p.type === 'L';
  if (classe === 4) {
    if (eff === null) throw new Error('Classe 4 : section efficace requise.');
    return uv ? eff.Weff_u : prop.Iy >= prop.Iz ? eff.Weff_y : eff.Weff_z;
  }
  if (classe === 3) return uv ? prop.Wel_u : prop.Iy >= prop.Iz ? prop.Wel_y : prop.Wel_z;
  return uv ? prop.Wpl_u : prop.Iy >= prop.Iz ? prop.Wpl_y : prop.Wpl_z;
}

/**
 * @param MfortEd moment autour de l'axe fort (kN.m) : M_u pour une corniere,
 *                M_y pour les autres (l'axe y est l'axe fort des U et 2U).
 */
export function deversementNonSymetrique(
  p: ProfilNonSymetrique,
  m: Materiau,
  prop: Proprietes,
  classe: Classe,
  eff: SectionEfficace | null,
  MfortEd: number,
  maintenu: boolean,
  L: number,
  d: DiagrammeLT,
  point: PointApplication,
  McrSaisi: number | null,
  profil: ProfilEc3
): DeversementNonSymetrique {
  if (MfortEd === 0) return sansObjet('Aucun moment autour de l axe fort.');
  if (maintenu) return sansObjet('Membrure comprimee maintenue lateralement en continu : deversement empeche.');
  if ((p.type === '2L' || p.type === '2U') && prop.Iy < prop.Iz) {
    return sansObjet('Flexion autour de y, axe faible de la section composee : pas de deversement.');
  }
  let Mcr: MomentCritique;
  if (McrSaisi !== null) {
    exigerPositif(McrSaisi, 'Le moment critique saisi M_cr', 'kN.m');
    Mcr = { M_cr: McrSaisi, origine: 'saisi', source: 'saisi par l utilisateur (calcul exterieur)', C1: null, C2: null, z_g: null };
  } else if (p.type === 'L' || p.type === '2L') {
    return sansObjet('Corniere flechie autour de son axe fort : M_cr a fournir (aucune expression fiable dans ce perimetre). Deversement NON VERIFIE.', true);
  } else {
    exigerPositif(L, 'La longueur entre maintiens lateraux L', 'mm');
    const u = p.type === 'U' ? p : p.profilU;
    const { C1, C2 } = coefficientsC(d);
    // Le centre de cisaillement est sur l'axe y (z_0 = 0) : z_g depuis lui.
    const z_g = d.type === 'lineaire' ? 0 : point === 'semelle-superieure' ? u.h / 2 : point === 'semelle-inferieure' ? -u.h / 2 : 0;
    const base = (Math.PI ** 2 * E * prop.Iz) / (L * L);
    const terme = Math.sqrt(prop.Iw / prop.Iz + (L * L * G * prop.It) / (Math.PI ** 2 * E * prop.Iz) + (C2 * z_g) ** 2) - C2 * z_g;
    Mcr = { M_cr: (C1 * base * terme) / NMM_PAR_KNM, origine: 'hors-norme', source: SOURCE_MCR, C1, C2, z_g };
  }
  const W = moduleFort(p, prop, classe, eff);
  const lambda_LT = Math.sqrt((W * m.fy) / (Mcr.M_cr * NMM_PAR_KNM));
  const l0 = LAMBDA_LT0_GENERALE;
  const torsionU = p.type === 'U' ? ' Charge supposee appliquee au centre de cisaillement : la torsion d une charge dans le plan de l ame n est pas traitee.' : '';
  if (lambda_LT <= l0 || Math.abs(MfortEd) / Mcr.M_cr <= l0 * l0) {
    return {
      ...sansObjet(
        `${lambda_LT <= l0 ? `lambda_LT = ${fr(lambda_LT, 3)} <= ${fr(l0, 1)}` : `M_Ed / M_cr = ${fr(Math.abs(MfortEd) / Mcr.M_cr, 3)} <= ${fr(l0 * l0, 2)}`} : deversement negligeable (§6.3.2.2(4)).${torsionU}`
      ),
      M_cr: Mcr,
      lambda_LT,
    };
  }
  const a = ALPHA[COURBE];
  const Phi = 0.5 * (1 + a * (lambda_LT - 0.2) + lambda_LT * lambda_LT);
  const chi = Math.min(1, 1 / (Phi + Math.sqrt(Phi * Phi - lambda_LT * lambda_LT)));
  return {
    applicable: true,
    aFournir: false,
    motif: `Methode generale §6.3.2.2, courbe ${COURBE}. M_cr : ${Mcr.origine === 'saisi' ? 'saisi' : 'HORS NORME'}.${torsionU}`,
    M_cr: Mcr,
    lambda_LT,
    courbe: COURBE,
    chi_LT: chi,
    Mb_Rd: (chi * W * m.fy) / profil.gamma_M1.valeur / NMM_PAR_KNM,
  };
}
