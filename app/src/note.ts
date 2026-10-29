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
import { phrase, textes } from './textes';

/** L'etat que la page garde du dernier calcul reussi. */
export type EtatNote =
  | { forme: 'symetrique'; modele: ModeleSaisie; resultat: ResultatElement; dessin: string }
  | { forme: 'non-symetrique'; modele: ModeleSaisie; resultat: ResultatNonSymetrique; dessin: string };

/** Hypotheses et limites portees par la note, selon la forme du resultat. */
export function hypothesesDeLaNote(forme: 'symetrique' | 'non-symetrique'): string[] {
  const t = textes().note;
  return forme === 'symetrique' ? t.hypothesesSym : t.hypothesesNonSym;
}


/**
 * Une ligne par verification applicable. Le deversement a M_cr non fourni
 * reste au tableau, sans taux et non satisfait : rien ne l'a verifie. Les
 * verifications sans objet figurent dans les calculs, avec leur motif.
 */
export function verificationsDeLaNote(verifications: readonly Verification[], deversementAFournir = false): VerificationNote[] {
  return verifications
    .filter((v) => v.applicable || (deversementAFournir && (v.nom === 'Deversement' || v.nom === 'Déversement')))
    .map((v) => ({ nom: phrase(v.nom === 'Deversement' ? 'Déversement' : v.nom), clause: phrase(v.clause), taux: v.applicable ? v.taux : null, ok: v.applicable && v.taux !== null && v.taux <= 1 }));
}

/** Note du dernier calcul reussi ; `norme` : le profil normatif employe. */
export function noteDuCalcul(norme: { nom: string; date: string }, e: EtatNote, cartouche: { projet: string; element: string; date: string }): NoteDeCalcul {
  const m = e.modele;
  const t = textes().note;
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
        bloc(t.profilLongueurs, [profil, longueurs]),
        { type: 'figure', svg: e.dessin, legende: profilGeneral(m).nom },
      ],
      materiaux: [bloc(t.acier, [acier])],
      hypotheses: [
        { type: 'texte', texte: t.profil(phrase(norme.nom), norme.date) },
        bloc(t.diagrammes, [diagLT, diagY, diagZ]),
        { type: 'liste', items: hypothesesDeLaNote(e.forme) },
      ],
      charges: [bloc(t.sollicitations, [efforts, tranchants])],
      // Les blocs de l'ecran, sans le verdict : la note ne conclut pas a la place de l'ingenieur.
      calculs: ecran.filter((b) => b.titre !== 'Verdict').map(calcul),
    },
    verifications: verificationsDeLaNote(e.resultat.verifications, e.forme === 'non-symetrique' && e.resultat.deversement.aFournir),
    avertissements: avertissementsDeLaNote(e),
  };
}
