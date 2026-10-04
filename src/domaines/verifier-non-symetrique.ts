/**
 * Orchestration : verification d'une corniere, d'un U, d'un 2L ou d'un 2U,
 * EN 1993-1-1 §5.5, §6.2, §6.3 et §6.4.4.
 *
 * Unites : mm, kN, kN.m, MPa.
 *
 * Chaque verification rend son taux, ou est declaree NON APPLICABLE avec son
 * motif. Un deversement que l'outil ne sait pas evaluer (corniere sans M_cr)
 * rend le verdict INCOMPLET, jamais conforme.
 *
 * CHOIX DECLARES :
 *   - §6.3.3 : annexe B etendue aux L, U et 2L, hors de son domaine (sections
 *     doublement symetriques), avec les formules de classe 3 ; chaque terme
 *     prend le plus petit chi entre la flexion et la flexion-torsion couplee a
 *     cet axe. 2U dos a dos : dans le domaine (formules des I) ;
 *   - corniere seule : diagrammes de M_y et M_z employes pour C_m autour de u
 *     et v.
 */

import type { Nuance, Materiau } from '../model/profil';
import { materiau } from '../model/profil';
import { proprietes, type Proprietes } from '../proprietes/brutes';
import { corniereOrientee, type ProfilNonSymetrique } from '../proprietes/formes';
import { classifier, type Classe, type Classification } from '../classification/classifier';
import { sectionEfficace, type SectionEfficace } from '../classification/efficace';
import {
  interactionNonSymetrique,
  momentsDeCalcul,
  resistancesNonSymetriques,
  verifierVoilementNonSymetrique,
  type InteractionNonSymetrique,
  type ResistancesNonSymetriques,
} from '../resistances/non-symetriques';
import { flambementsNonSymetriques, type FlambementNonSymetrique } from '../instabilite/flexion-torsion';
import { deversementNonSymetrique, type DeversementNonSymetrique } from '../instabilite/deversement-non-symetrique';
import { coefficientCmDiagramme, interaction633, type Interaction633 } from '../instabilite/flexion-composee';
import type { DiagrammeLT, PointApplication } from '../instabilite/deversement';
import type { ProfilEc3 } from '../norms/profil';
import { exigerPositif, fr, verifierProfil } from '../norms/profil';
import type { Verification } from './verifier-element';

export interface DonneesNonSymetriques {
  profil: ProfilNonSymetrique;
  nuance: Nuance;
  /** Compression positive (kN). */
  N: number;
  /** Moments autour des axes geometriques y et z (kN.m), efforts tranchants (kN). */
  My: number;
  Mz: number;
  Vz: number;
  Vy: number;
  Lcr_y: number;
  Lcr_z: number;
  /** Corniere seule : longueur de flambement autour de v (mm). */
  Lcr_v: number;
  /** Longueur de flambement par torsion (mm). */
  L_T: number;
  /** Corniere de treillis assemblee par au moins deux boulons (annexe BB.1.2). */
  barreDeTreillis: boolean;
  L_LT: number;
  deversementEmpeche: boolean;
  diagrammeLT: DiagrammeLT;
  pointApplication: PointApplication;
  McrSaisi: number | null;
  diagrammeY: DiagrammeLT;
  diagrammeZ: DiagrammeLT;
  /** 2L et 2U : espacement des liaisons (fourrures, boulons) le long de la barre (mm). */
  espacementLiaisons: number | null;
}

export interface ResultatNonSymetrique {
  verdict: 'conforme' | 'non-conforme' | 'incomplet';
  motif: string;
  proprietes: Proprietes;
  materiau: Materiau;
  classification: Classification;
  efficace: SectionEfficace | null;
  resistances: ResistancesNonSymetriques;
  interaction: InteractionNonSymetrique;
  voilement: string;
  flambements: FlambementNonSymetrique[];
  deversement: DeversementNonSymetrique;
  interaction633: Interaction633 | null;
  /** 2L et 2U : barre composee a faible ecartement, tableau 6.9. */
  compose: { espacement: number; limite: number; motif: string } | null;
  avertissements: string[];
  verifications: Verification[];
}

/** Rayon de giration minimal d'UN profil composant (mm), pour le tableau 6.9. */
function rayonMinComposant(p: ProfilNonSymetrique): number {
  if (p.type === '2L') return proprietes(corniereOrientee(p.corniere, p.accolee)).iv;
  if (p.type === '2U') return proprietes(p.profilU).iv;
  return Number.NaN;
}

/**
 * Barre composee a faible ecartement, §6.4.4 et tableau 6.9 : calculee comme
 * une barre unique si les liaisons sont espacees d'au plus 15 i_min. Au-dela,
 * la barre releve du §6.4 (membrures ecartees) : hors perimetre, leve.
 */
export function verifierCompose(p: ProfilNonSymetrique, espacement: number | null): ResultatNonSymetrique['compose'] {
  if (p.type !== '2L' && p.type !== '2U') return null;
  if (espacement === null) throw new Error('Profil compose : espacement des liaisons requis (tableau 6.9).');
  exigerPositif(espacement, 'L espacement des liaisons', 'mm');
  const imin = rayonMinComposant(p);
  const limite = 15 * imin;
  if (espacement > limite) {
    throw new Error(
      `Espacement des liaisons ${fr(espacement, 0)} mm > 15 i_min = ${fr(limite, 0)} mm (tableau 6.9) : barre a membrures ecartees (§6.4), hors perimetre.`
    );
  }
  return { espacement, limite, motif: `espacement ${fr(espacement, 0)} mm <= 15 i_min = ${fr(limite, 0)} mm (i_min = ${fr(imin, 1)} mm, un profil) : barre unique (§6.4.4, tableau 6.9)` };
}

export function verifierNonSymetrique(d: DonneesNonSymetriques, profil: ProfilEc3): ResultatNonSymetrique {
  verifierProfil(profil);
  const p = d.profil;
  const compose = verifierCompose(p, d.espacementLiaisons);
  const prop = proprietes(p);
  const mat = materiau(d.nuance, p);
  const classification = classifier(p, mat, prop, { N: d.N, My: d.My, Mz: d.Mz });
  const classe: Classe = classification.classe;
  const eff = classe === 4 ? sectionEfficace(p, mat) : null;
  const res = resistancesNonSymetriques(p, mat, prop, classe, eff, profil);
  const voilement = verifierVoilementNonSymetrique(p, mat, prop, profil);
  const inter = interactionNonSymetrique(p, prop, classe, eff, res, { N: d.N, My: d.My, Mz: d.Mz, Vz: d.Vz, Vy: d.Vy });
  const mf = momentsDeCalcul(p, prop, d.My, d.Mz);
  const avert: string[] = [];
  if (p.type === 'L' && (d.My !== 0 || d.Mz !== 0)) avert.push(`Corniere : ${mf.motif}.`);
  if (p.type === 'U' && d.Vz !== 0) avert.push('Profil en U : un effort applique dans le plan de l ame (hors du centre de cisaillement) induit une torsion non traitee.');
  if (compose !== null) avert.push(`Profil compose : ${compose.motif}.`);

  const verifs: Verification[] = [];
  const g1 = profil.gamma_M1.valeur;
  const g0 = profil.gamma_M0.valeur;
  const NRdTraction = (prop.A * mat.fy) / g0 / 1000;
  verifs.push({
    nom: 'Effort normal',
    clause: '§6.2.3, §6.2.4',
    applicable: d.N !== 0,
    taux: d.N === 0 ? null : Math.abs(d.N) / (d.N > 0 ? res.N_Rd : NRdTraction),
    motif: d.N === 0 ? 'Aucun effort normal.' : d.N > 0 ? `N_c,Rd = ${fr(res.N_Rd, 0)} kN (${res.module === 'efficace' ? 'A_eff' : 'A'})` : `N_pl,Rd = ${fr(NRdTraction, 0)} kN (section nette non traitee : assemblages-ec3)`,
  });
  verifs.push({ nom: 'Cisaillement selon z', clause: '§6.2.6', applicable: d.Vz !== 0, taux: d.Vz === 0 ? null : Math.abs(d.Vz) / res.Vz_Rd, motif: d.Vz === 0 ? 'Aucun effort tranchant selon z.' : `V_pl,z,Rd = ${fr(res.Vz_Rd, 0)} kN ; ${res.motifAv}` });
  verifs.push({ nom: 'Cisaillement selon y', clause: '§6.2.6', applicable: d.Vy !== 0, taux: d.Vy === 0 ? null : Math.abs(d.Vy) / res.Vy_Rd, motif: d.Vy === 0 ? 'Aucun effort tranchant selon y.' : `V_pl,y,Rd = ${fr(res.Vy_Rd, 0)} kN ; ${res.motifAv}` });
  const avecMoment = d.My !== 0 || d.Mz !== 0;
  verifs.push({ nom: 'Flexion composee de section', clause: classe === 4 ? '§6.2.9.3' : '§6.2.1(7)', applicable: avecMoment || d.N !== 0, taux: avecMoment || d.N > 0 ? inter.taux : null, motif: inter.motif });

  const comprime = d.N > 0;
  let flambements: FlambementNonSymetrique[] = [];
  if (comprime) {
    flambements = flambementsNonSymetriques(
      p,
      mat,
      prop,
      classe,
      eff,
      { Lcr_y: d.Lcr_y, Lcr_z: d.Lcr_z, Lcr_v: d.Lcr_v, L_T: d.L_T, barreDeTreillis: d.barreDeTreillis },
      profil
    );
    for (const f of flambements) {
      verifs.push({
        nom: `Flambement : ${f.mode}`,
        clause: f.mode === 'torsion ou flexion-torsion' ? '§6.3.1.4' : d.barreDeTreillis && f.lambdaEff !== null ? '§6.3.1, annexe BB.1.2' : '§6.3.1',
        applicable: true,
        taux: d.N / f.Nb_Rd,
        motif: `${f.motif}, lambda = ${fr(f.lambda_, 3)}${f.lambdaEff !== null ? `, lambda_eff = ${fr(f.lambdaEff, 3)}` : ''}, chi = ${fr(f.chi, 3)}`,
      });
    }
  } else {
    verifs.push({ nom: 'Flambement', clause: '§6.3.1', applicable: false, taux: null, motif: 'Element non comprime.' });
  }

  const dev = deversementNonSymetrique(p, mat, prop, classe, eff, mf.M1, d.deversementEmpeche, d.L_LT, d.diagrammeLT, d.pointApplication, d.McrSaisi, profil);
  verifs.push({ nom: 'Deversement', clause: '§6.3.2', applicable: dev.applicable, taux: dev.applicable && dev.Mb_Rd !== null ? mf.M1 / dev.Mb_Rd : null, motif: dev.motif });

  let i633: Interaction633 | null = null;
  if (comprime && avecMoment) {
    const chiDe = (modes: string[]): { chi: number; lambda: number } => {
      const f = flambements.filter((x) => modes.includes(x.mode)).reduce((a, b) => (b.chi < a.chi ? b : a));
      return { chi: f.chi, lambda: f.lambdaEff ?? f.lambda_ };
    };
    const TF = 'torsion ou flexion-torsion';
    // Axe couple a la torsion : axe de symetrie (y pour un U, z pour un 2L) ; corniere : les deux.
    let a1: { chi: number; lambda: number };
    let a2: { chi: number; lambda: number };
    if (p.type === 'L') {
      a1 = chiDe(['flexion autour de y', 'flexion autour de z', TF]);
      a2 = chiDe(['flexion autour de v', TF]);
    } else if (p.type === 'U') {
      a1 = chiDe(['flexion autour de y', TF]);
      a2 = chiDe(['flexion autour de z']);
    } else if (p.type === '2L') {
      a1 = chiDe(['flexion autour de y']);
      a2 = chiDe(['flexion autour de z', TF]);
    } else {
      a1 = chiDe(['flexion autour de y']);
      a2 = chiDe(['flexion autour de z']);
    }
    const dansDomaine = p.type === '2U';
    const NRk = (classe === 4 && eff !== null ? eff.Aeff : prop.A) * mat.fy;
    i633 = interaction633(
      {
        profil: p,
        classe: dansDomaine ? classe : 3,
        NEd: d.N,
        MyEd: mf.M1,
        MzEd: mf.M2,
        NRd1: NRk / g1 / 1000,
        MyRd1: (res.M1_Rd * g0) / g1,
        MzRd1: (res.M2_Rd * g0) / g1,
        chi_y: a1.chi,
        chi_z: a2.chi,
        chi_LT: dev.chi_LT,
        lambda_y: a1.lambda,
        lambda_z: a2.lambda,
        Cmy: coefficientCmDiagramme(d.diagrammeY),
        Cmz: coefficientCmDiagramme(d.diagrammeZ),
        CmLT: coefficientCmDiagramme(d.diagrammeLT),
        sensibleTorsion: dev.applicable,
        dMy: inter.dM1,
        dMz: inter.dM2,
        horsDomaine: dansDomaine ? undefined : 'annexe B ETENDUE hors de son domaine (section non doublement symetrique), formules de classe 3, chi minimal entre flexion et flexion-torsion',
      },
      profil
    );
    verifs.push({ nom: 'Flexion composee, expression (6.61)', clause: '§6.3.3', applicable: true, taux: i633.taux61, motif: i633.motif });
    verifs.push({ nom: 'Flexion composee, expression (6.62)', clause: '§6.3.3', applicable: true, taux: i633.taux62, motif: i633.motif });
  } else {
    verifs.push({ nom: 'Flexion composee avec instabilite', clause: '§6.3.3', applicable: false, taux: null, motif: comprime ? 'Aucun moment.' : 'Element non comprime.' });
  }

  const avecTaux = verifs.filter((v) => v.taux !== null);
  const tauxMax = Math.max(...avecTaux.map((v) => v.taux as number), 0);
  const gouv = avecTaux.reduce<Verification | null>((a, v) => (a === null || (v.taux as number) > (a.taux as number) ? v : a), null);
  let verdict: ResultatNonSymetrique['verdict'] = tauxMax <= 1 ? 'conforme' : 'non-conforme';
  let motif = gouv === null ? 'Aucune sollicitation.' : `Taux maximal ${fr(tauxMax, 3)} : ${gouv.nom.toLowerCase()} (${gouv.clause}).`;
  if (verdict === 'conforme' && dev.aFournir) {
    verdict = 'incomplet';
    motif = `${motif} Deversement non verifie : M_cr a fournir.`;
  }
  return {
    verdict,
    motif,
    proprietes: prop,
    materiau: mat,
    classification,
    efficace: eff,
    resistances: res,
    interaction: inter,
    voilement,
    flambements,
    deversement: dev,
    interaction633: i633,
    compose,
    avertissements: avert,
    verifications: verifs,
  };
}
