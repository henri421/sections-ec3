/**
 * Contenu de la note de calcul commune (`noteDeCalculHtml` d'aedificium-ui).
 *
 * Module PUR. La note lit l'etat du dernier calcul reussi, le meme que le
 * CSV : memes blocs que l'ecran, meme dessin, jamais redessine.
 */

import type { BlocResultat, ElementNote, LigneResultat, NoteDeCalcul, VerificationNote } from 'aedificium-ui';
import type { ResultatElement, ResultatNonSymetrique, Verification } from '../../src/index';
import type { ModeleSaisie } from './form';
import { profilGeneral } from './form';
import { avertissementsDeLaNote, blocEntrees, blocs, blocsNonSymetriques } from './vue';

/** L'etat que la page garde du dernier calcul reussi. */
export type EtatNote =
  | { forme: 'symetrique'; modele: ModeleSaisie; resultat: ResultatElement; dessin: string }
  | { forme: 'non-symetrique'; modele: ModeleSaisie; resultat: ResultatNonSymetrique; dessin: string };

/** Hypotheses et limites portees par la note, selon la forme du resultat. */
export function hypothesesDeLaNote(forme: 'symetrique' | 'non-symetrique'): string[] {
  return forme === 'symetrique'
    ? [
        'Propriétés recalculées à partir des dimensions nominales ; aucune classe stockée.',
        'Semelles classées en compression uniforme, du côté de la sécurité.',
        "Facteurs k_ij de l'annexe B du §6.3.3 ; C_m pour des moments linéaires.",
        "Valeurs recommandées de l'EN 1993-1-1 ; aucune annexe nationale codée.",
      ]
    : [
        'Propriétés recalculées sur le contour ; I_t, I_w et centre de cisaillement des profils laminés repris du producteur.',
        'Classe 4 : section efficace unique, toutes parois en compression uniforme (EN 1993-1-5 §4.4).',
        'Interaction N-M de section par le critère linéaire (6.2), (6.44) en classe 4.',
        'Annexe B du §6.3.3 étendue aux cornières, U et 2L, hors de son domaine.',
        "Valeurs recommandées de l'EN 1993-1-1 ; aucune annexe nationale codée.",
      ];
}

/** Nom affiche d'une verification : la cle technique reste « Deversement ». */
const NOM_VERIFICATION: Record<string, string> = { Deversement: 'Déversement' };

/**
 * Une ligne par verification applicable. Le deversement a M_cr non fourni
 * reste au tableau, sans taux et non satisfait : rien ne l'a verifie. Les
 * verifications sans objet figurent dans les calculs, avec leur motif.
 */
export function verificationsDeLaNote(verifications: readonly Verification[], deversementAFournir = false): VerificationNote[] {
  return verifications
    .filter((v) => v.applicable || (deversementAFournir && (v.nom === 'Deversement' || v.nom === 'Déversement')))
    .map((v) => ({ nom: NOM_VERIFICATION[v.nom] ?? v.nom, clause: v.clause, taux: v.applicable ? v.taux : null, ok: v.applicable && v.taux !== null && v.taux <= 1 }));
}

/** Note du dernier calcul reussi ; `norme` : le profil normatif employe. */
export function noteDuCalcul(norme: { nom: string; date: string }, e: EtatNote, cartouche: { projet: string; element: string; date: string }): NoteDeCalcul {
  const m = e.modele;
  const [profil, efforts, tranchants, longueurs, diagLT, diagY, diagZ] = blocEntrees(m).lignes;
  const ecran = e.forme === 'symetrique' ? blocs(e.resultat) : blocsNonSymetriques(e.resultat);
  const proprietes = ecran[0].lignes;
  const acier = proprietes.find((l) => l.symbole === 'f_y, f_u') as LigneResultat;
  const bloc = (titre: string, lignes: LigneResultat[]): ElementNote => ({ type: 'bloc', bloc: { titre, lignes, note: null } });
  const calcul = (b: BlocResultat): ElementNote => ({ type: 'bloc', bloc: b });

  return {
    cartouche: {
      projet: cartouche.projet,
      element: cartouche.element.trim() === '' ? `${profilGeneral(m).nom}, ${m.nuance}` : cartouche.element,
      date: cartouche.date,
      norme: 'EN 1993-1-1:2005',
      outil: 'sections-ec3',
    },
    sections: {
      geometrie: [
        bloc('Profil et longueurs', [profil, longueurs]),
        { type: 'figure', svg: e.dessin, legende: profilGeneral(m).nom },
      ],
      materiaux: [bloc('Acier', [acier])],
      hypotheses: [
        { type: 'texte', texte: `Profil normatif : ${norme.nom}, données consultées le ${norme.date}.` },
        bloc('Diagrammes de moments', [diagLT, diagY, diagZ]),
        { type: 'liste', items: hypothesesDeLaNote(e.forme) },
      ],
      charges: [bloc('Sollicitations de calcul', [efforts, tranchants])],
      // Les blocs de l'ecran, sans le verdict : la note ne conclut pas a la place de l'ingenieur.
      calculs: ecran.filter((b) => b.titre !== 'Verdict').map(calcul),
    },
    verifications: verificationsDeLaNote(e.resultat.verifications, e.forme === 'non-symetrique' && e.resultat.deversement.aFournir),
    avertissements: avertissementsDeLaNote(e),
  };
}
