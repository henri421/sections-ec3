/**
 * Orchestration : verification d'un element en acier, EN 1993-1-1 §5.5,
 * §6.2 et §6.3.
 *
 * Unites : mm, kN, kN.m, MPa.
 *
 * Chaque verification rend son taux, ou est declaree NON APPLICABLE avec
 * son motif — jamais « satisfaite » faute d'objet. Les verifications de
 * resistance de section et d'instabilite restent distinctes.
 */

import type { Nuance, Profil, Materiau } from '../model/profil';
import { estDoublementSymetrique, materiau } from '../model/profil';
import { proprietes, type Proprietes } from '../proprietes/brutes';
import { classifier, type Classification } from '../classification/classifier';
import { interactionSection, resistancesSection, verifierVoilementCisaillement, type InteractionSection, type ResistancesSection } from '../resistances/section';
import { flambement, type Flambement } from '../instabilite/flambement';
import { deversement, type Deversement, type DiagrammeLT, type PointApplication } from '../instabilite/deversement';
import { coefficientCmDiagramme, interaction633, type Interaction633 } from '../instabilite/flexion-composee';
import type { ProfilEc3 } from '../norms/profil';
import { fr, verifierProfil } from '../norms/profil';

export interface DonneesElement {
  profil: Profil;
  nuance: Nuance;
  /** Effort normal, compression positive (kN). */
  N: number;
  /** Moments maximaux (kN.m) et efforts tranchants (kN). */
  My: number;
  Mz: number;
  Vz: number;
  Vy: number;
  /** Longueurs de flambement (mm). */
  Lcr_y: number;
  Lcr_z: number;
  /** Longueur entre maintiens lateraux de la membrure comprimee (mm). */
  L_LT: number;
  deversementEmpeche: boolean;
  diagrammeLT: DiagrammeLT;
  pointApplication: PointApplication;
  /** M_cr calcule par ailleurs (kN.m), ou null pour l'expression hors norme. */
  McrSaisi: number | null;
  /** Diagrammes du moment M_y et M_z, pour C_my et C_mz (tableau B.3). */
  diagrammeY: DiagrammeLT;
  diagrammeZ: DiagrammeLT;
}

export interface Verification {
  nom: string;
  clause: string;
  applicable: boolean;
  taux: number | null;
  motif: string;
}

export interface ResultatElement {
  verdict: 'conforme' | 'non-conforme';
  motif: string;
  proprietes: Proprietes;
  materiau: Materiau;
  classification: Classification;
  resistances: ResistancesSection;
  interaction: InteractionSection;
  voilement: string;
  flambementY: Flambement | null;
  flambementZ: Flambement | null;
  deversement: Deversement;
  interaction633: Interaction633 | null;
  verifications: Verification[];
}

export function verifierElement(d: DonneesElement, profil: ProfilEc3): ResultatElement {
  verifierProfil(profil);
  // Garde-fou : les verifications ci-dessous supposent la double symetrie
  // ((6.36) a (6.40), M_cr des I, flambement par flexion seul). Une corniere
  // ou un U n'y passe pas, plutot que d'y recevoir un resultat faux.
  if (!estDoublementSymetrique(d.profil)) {
    throw new Error(`Profil « ${d.profil.nom} » (${d.profil.type}) : employer verifierNonSymetrique pour les cornieres, U, 2L et 2U.`);
  }
  const p = d.profil;
  const prop = proprietes(p);
  const mat = materiau(d.nuance, p);
  const classification = classifier(p, mat, prop, { N: d.N, My: d.My, Mz: d.Mz });
  const res = resistancesSection(p, mat, prop, classification.classe, profil);
  const voilement = verifierVoilementCisaillement(p, mat, prop, profil);
  const inter = interactionSection(p, mat, prop, classification.classe, res, { N: d.N, My: d.My, Mz: d.Mz, Vz: d.Vz, Vy: d.Vy }, profil);
  const verifs: Verification[] = [];
  const g1 = profil.gamma_M1.valeur;

  verifs.push({ nom: 'Effort normal', clause: '§6.2.3, §6.2.4', applicable: d.N !== 0, taux: d.N === 0 ? null : Math.abs(d.N) / res.Npl_Rd, motif: d.N === 0 ? 'Aucun effort normal.' : `N_pl,Rd = ${fr(res.Npl_Rd, 0)} kN` });
  verifs.push({ nom: 'Cisaillement selon z', clause: '§6.2.6', applicable: d.Vz !== 0, taux: d.Vz === 0 ? null : Math.abs(d.Vz) / res.Vz_Rd, motif: d.Vz === 0 ? 'Aucun effort tranchant selon z.' : `V_pl,z,Rd = ${fr(res.Vz_Rd, 0)} kN` });
  verifs.push({ nom: 'Cisaillement selon y', clause: '§6.2.6', applicable: d.Vy !== 0, taux: d.Vy === 0 ? null : Math.abs(d.Vy) / res.Vy_Rd, motif: d.Vy === 0 ? 'Aucun effort tranchant selon y.' : `V_pl,y,Rd = ${fr(res.Vy_Rd, 0)} kN` });
  const avecMoment = d.My !== 0 || d.Mz !== 0;
  verifs.push({ nom: 'Flexion composee de section', clause: '§6.2.8, §6.2.9', applicable: avecMoment, taux: avecMoment ? inter.taux : null, motif: avecMoment ? inter.motif : 'Aucun moment.' });

  // Flambement : seulement en compression.
  const comprime = d.N > 0;
  const fy = comprime ? flambement(p, mat, prop, 'y', d.Lcr_y, profil) : null;
  const fz = comprime ? flambement(p, mat, prop, 'z', d.Lcr_z, profil) : null;
  for (const f of [fy, fz]) {
    if (f === null) continue;
    verifs.push({ nom: `Flambement par flexion autour de ${f.axe}`, clause: '§6.3.1', applicable: true, taux: d.N / f.Nb_Rd, motif: `courbe ${f.courbe}, lambda = ${fr(f.lambda_, 3)}, chi = ${fr(f.chi, 3)}` });
  }
  if (!comprime) verifs.push({ nom: 'Flambement par flexion', clause: '§6.3.1', applicable: false, taux: null, motif: 'Element non comprime.' });

  const Wy = res.module === 'plastique' ? prop.Wpl_y : prop.Wel_y;
  const dev =
    d.My === 0
      ? { applicable: false, motif: 'Aucun moment autour de y.', methode: 'laminee' as const, M_cr: null, lambda_LT: null, courbe: null, chi_LT: 1, f: null, Mb_Rd: null }
      : deversement(p, mat, prop, Wy, d.My, d.deversementEmpeche, d.L_LT, d.diagrammeLT, d.pointApplication, d.McrSaisi, profil);
  verifs.push({
    nom: 'Deversement',
    clause: '§6.3.2',
    applicable: dev.applicable,
    taux: dev.applicable && dev.Mb_Rd !== null ? Math.abs(d.My) / dev.Mb_Rd : null,
    motif: dev.motif,
  });

  let i633: Interaction633 | null = null;
  if (comprime && avecMoment && fy !== null && fz !== null) {
    i633 = interaction633(
      {
        profil: p,
        classe: classification.classe,
        NEd: d.N,
        MyEd: d.My,
        MzEd: d.Mz,
        NRd1: (res.Npl_Rd * profil.gamma_M0.valeur) / g1,
        MyRd1: (res.My_Rd * profil.gamma_M0.valeur) / g1,
        MzRd1: (res.Mz_Rd * profil.gamma_M0.valeur) / g1,
        chi_y: fy.chi,
        chi_z: fz.chi,
        chi_LT: dev.chi_LT,
        lambda_y: fy.lambda_,
        lambda_z: fz.lambda_,
        Cmy: coefficientCmDiagramme(d.diagrammeY),
        Cmz: coefficientCmDiagramme(d.diagrammeZ),
        CmLT: coefficientCmDiagramme(d.diagrammeLT),
        sensibleTorsion: dev.applicable,
      },
      profil
    );
    verifs.push({ nom: 'Flexion composee, expression (6.61)', clause: '§6.3.3', applicable: true, taux: i633.taux61, motif: i633.motif });
    verifs.push({ nom: 'Flexion composee, expression (6.62)', clause: '§6.3.3', applicable: true, taux: i633.taux62, motif: i633.motif });
  } else {
    verifs.push({ nom: 'Flexion composee avec instabilite', clause: '§6.3.3', applicable: false, taux: null, motif: comprime ? 'Aucun moment.' : 'Element non comprime.' });
  }

  const tauxMax = Math.max(...verifs.filter((v) => v.taux !== null).map((v) => v.taux as number), 0);
  const gouv = verifs.filter((v) => v.taux !== null).reduce<Verification | null>((a, v) => (a === null || (v.taux as number) > (a.taux as number) ? v : a), null);
  return {
    verdict: tauxMax <= 1 ? 'conforme' : 'non-conforme',
    motif: gouv === null ? 'Aucune sollicitation.' : `Taux maximal ${fr(tauxMax, 3)} : ${gouv.nom.toLowerCase()} (${gouv.clause}).`,
    proprietes: prop,
    materiau: mat,
    classification,
    resistances: res,
    interaction: inter,
    voilement,
    flambementY: fy,
    flambementZ: fz,
    deversement: dev,
    interaction633: i633,
    verifications: verifs,
  };
}
