/**
 * Les sorties : SVG autonome, CSV et note de calcul.
 *
 * Tout ici est PUR — aucun `document`. Le telechargement vit dans
 * `aedificium-ui` (`telecharger`, `ouvrirOuTelecharger`).
 */

import { JETONS, notationHtml, type BlocResultat } from 'aedificium-ui';

/**
 * Styles du trace, jetons compris : un document exporte ne voit pas la
 * feuille de la page, et les jetons seuls DEFINISSENT des couleurs sans en
 * appliquer aucune — le dessin sortirait en aplat noir. Les regles de
 * peinture de `style.css` sont donc recopiees ici ; toute evolution de l'une
 * doit etre reportee dans l'autre.
 */
export const STYLES_TRACE = `${JETONS}

svg { background: var(--surface); color-scheme: light; font-family: var(--sans); }
svg .acier { fill: var(--beton); stroke: var(--texte); stroke-width: 1.5; }
svg .vide { fill: var(--surface); stroke: var(--texte); stroke-width: 1.5; }
svg .axe { stroke: var(--neutre); stroke-width: 1; stroke-dasharray: 5 4; }
svg .axe-nom { fill: var(--texte-faible); font-size: 12px; }
svg .nom { fill: var(--texte-doux); font-size: 12px; text-anchor: middle; }
svg .axe-principal { stroke: var(--texte-doux); stroke-width: 1; stroke-dasharray: 2 3; }
svg .point { fill: var(--texte); }
svg .point-creux { fill: var(--surface); stroke: var(--texte); stroke-width: 1.5; }`;

export interface NoteDeCalcul {
  titre: string;
  date: string;
  profil: string;
  entrees: BlocResultat[];
  dessins: string[];
  resultats: BlocResultat[];
  avertissements: string[];
  hypotheses: string[];
}

const AIDE_AU_CALCUL =
  "Outil d'aide au calcul. Cet outil constate, il ne prescrit pas : il rend des résistances et des " +
  "taux de travail, jamais un choix de profil. La vérification finale et la responsabilité incombent à " +
  "l'ingénieur du projet. Cette note est un compte rendu, pas une justification réglementaire signée.";

const STYLE_NOTE = `
  body { margin: 0; padding: 24px 28px; background: var(--surface); color: var(--texte); font: 14px/1.5 var(--sans); }
  h1 { font-size: 1.1rem; font-weight: normal; letter-spacing: .02em; margin: 0 0 .2rem; }
  h2 { font-size: .95rem; font-weight: 600; margin: 1.6rem 0 .5rem; border-bottom: 1px solid var(--bordure); padding-bottom: .25rem; }
  h3 { font-size: .8rem; font-weight: 600; margin: 1rem 0 .35rem; }
  .date { color: var(--texte-faible); font-size: .8rem; margin: 0 0 1.2rem; }
  table { border-collapse: collapse; width: 100%; margin: .3rem 0 .6rem; }
  td { border-bottom: 1px solid var(--bordure-douce); padding: .25rem .4rem; vertical-align: top; }
  td.sym { font-family: var(--mono); width: 8rem; background: var(--surface-appui); }
  td.lib { color: var(--texte-doux); }
  td.val { font-family: var(--mono); font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; }
  .note { color: var(--texte-doux); font-size: .8rem; margin: .2rem 0 .8rem; }
  .avertissement { border-left: 3px solid var(--alerte); background: var(--alerte-fond); color: var(--alerte);
                   padding: .5rem .7rem; border-radius: var(--rayon); margin: .5rem 0; font-size: .82rem; }
  .dessin { margin: .6rem 0 1rem; page-break-inside: avoid; }
  .dessin svg { max-width: 100%; height: auto; }
  .pied { margin-top: 2rem; padding-top: .6rem; border-top: 1px solid var(--bordure); color: var(--texte-doux); font-size: .78rem; }
  ul { margin: .3rem 0 .6rem; padding-left: 1.1rem; color: var(--texte-doux); font-size: .82rem; }
  @media print { body { background: #fff; padding: 0; } h2 { page-break-after: avoid; } }
`;

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

function tableDuBloc(bloc: BlocResultat): string {
  const lignes = bloc.lignes
    .map(
      (l) =>
        `<tr><td class="sym">${notationHtml(l.symbole)}</td><td class="lib">${notationHtml(l.libelle)}</td><td class="val">${notationHtml(l.valeur)}</td></tr>`
    )
    .join('');
  const table = lignes === '' ? '' : `<table>${lignes}</table>`;
  // Le motif est rendu MEME sans ligne : c'est le cas ou il porte toute l'information.
  const note = bloc.note === null ? '' : `<p class="note">${notationHtml(bloc.note)}</p>`;
  return `<h3>${notationHtml(bloc.titre)}</h3>${table}${note}`;
}

/**
 * Note de calcul HTML autonome, imprimable en PDF. Elle porte les valeurs
 * intermediaires et le statut de chaque coefficient, et ne masque aucun
 * coefficient non applicable.
 */
export function noteDeCalculHtml(note: NoteDeCalcul, styles: string): string {
  const avertissements = note.avertissements.map((a) => `<p class="avertissement">${notationHtml(a)}</p>`).join('');
  const dessins = note.dessins.map((svg) => `<div class="dessin">${svg}</div>`).join('');
  const hypotheses =
    note.hypotheses.length === 0
      ? ''
      : `<h2>Hypothèses et limites</h2><ul>${note.hypotheses.map((h) => `<li>${notationHtml(h)}</li>`).join('')}</ul>`;
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8" />
<title>Note de calcul — ${notationHtml(note.titre)}</title>
<style>${styles}${STYLE_NOTE}</style></head>
<body>
<h1>Note de calcul — élément en acier (EN 1993-1-1)</h1>
<p class="date">${notationHtml(note.titre)} · ${notationHtml(note.date)} · profil : ${notationHtml(note.profil)}</p>
${avertissements}
<h2>Données d'entrée</h2>${note.entrees.map(tableDuBloc).join('')}
<h2>Profil</h2>${dessins}
<h2>Vérifications</h2>${note.resultats.map(tableDuBloc).join('')}
${hypotheses}
<p class="pied">${AIDE_AU_CALCUL}</p>
</body></html>`;
}
