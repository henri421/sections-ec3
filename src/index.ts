/**
 * sections-ec3 — noyau de calcul.
 *
 * Profils acier selon l'EN 1993-1-1 : proprietes, classification,
 * resistances de section, flambement, deversement, flexion composee.
 */

export { E, G, epsilon, materiau, epaisseurMax, type Materiau, type Nuance, type Profil } from './model/profil';
export { ec3Recommande, verifierProfil, type ProfilEc3, type ValeurSourcee } from './norms/profil';
export { proprietes, rayonsTube, type Proprietes } from './proprietes/brutes';
export { familles, profilCatalogue, provenance, type FamilleCatalogue } from './catalogue/charger';
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
export { interaction633, coefficientCm, type Interaction633 } from './instabilite/flexion-composee';
export { verifierElement, type DonneesElement, type ResultatElement, type Verification } from './domaines/verifier-element';
