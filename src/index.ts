/**
 * sections-ec3 — noyau de calcul.
 *
 * Profils acier selon l'EN 1993-1-1 : proprietes, classification,
 * resistances de section, flambement, deversement, flexion composee.
 */

export {
  E,
  G,
  epsilon,
  materiau,
  epaisseurMax,
  epaisseurAileRacine,
  estDoublementSymetrique,
  type Materiau,
  type Nuance,
  type Profil,
  type ProfilDoublementSymetrique,
  type ProfilL,
  type ProfilU,
} from './model/profil';
export { ec3Recommande, verifierProfil, type ProfilEc3, type ValeurSourcee } from './norms/profil';
export { proprietes, rayonsTube, type Proprietes } from './proprietes/brutes';
export { familles, profilCatalogue, corniereCatalogue, profilUCatalogue, provenance, type FamilleCatalogue, type TypeFamille } from './catalogue/charger';
export { arrondir, integrales, axesPrincipaux, inertieAxe, modulePlastique, distancesExtremes, type Point, type Sommet, type Integrales } from './proprietes/contour';
export { contours, contourL, contourU, corniereOrientee, torsion, excentriciteCisaillementU, proprietesNonSymetriques, type ProfilNonSymetrique, type Torsion } from './proprietes/formes';
export { sectionEfficace, facteurRho, type SectionEfficace, type ParoiEfficace, type TypeParoi } from './classification/efficace';
export { classifier, limitesParoiInterne, distributionAme, type Classe, type Classification, type ClasseParoi } from './classification/classifier';
export {
  aireCisaillement,
  resistancesSection,
  interactionSection,
  reductionCisaillement,
  verifierVoilementCisaillement,
  type ResistancesSection,
  type InteractionSection,
} from './resistances/section';
export {
  momentsDeCalcul,
  resistancesNonSymetriques,
  aireCisaillementNonSymetrique,
  verifierVoilementNonSymetrique,
  interactionNonSymetrique,
  type ActionsSection,
  type MomentsFlexion,
  type ResistancesNonSymetriques,
  type InteractionNonSymetrique,
} from './resistances/non-symetriques';
export {
  flambementsNonSymetriques,
  torsionFlexion,
  chargeCritiqueFlexionTorsion,
  courbeNonSymetrique,
  SOURCE_NCR_TF,
  type FlambementNonSymetrique,
  type LongueursFlambement,
  type ModeFlambement,
  type TorsionFlexion,
} from './instabilite/flexion-torsion';
export { deversementNonSymetrique, LAMBDA_LT0_GENERALE, type DeversementNonSymetrique } from './instabilite/deversement-non-symetrique';
export { flambement, courbeFlambement, facteurReduction, ALPHA, type Courbe, type Flambement } from './instabilite/flambement';
export {
  momentCritique,
  deversement,
  coefficientsC,
  coefficientKc,
  courbeDeversement,
  SOURCE_MCR,
  type DiagrammeLT,
  type PointApplication,
  type Deversement,
  type MomentCritique,
} from './instabilite/deversement';
export { interaction633, coefficientCm, coefficientCmDiagramme, type Interaction633 } from './instabilite/flexion-composee';
export { verifierElement, type DonneesElement, type ResultatElement, type Verification } from './domaines/verifier-element';
