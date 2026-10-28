/**
 * Les sorties : styles du trace pour le SVG autonome et la note.
 *
 * Tout ici est PUR — aucun `document`. Le telechargement vit dans
 * `aedificium-ui` (`telecharger`, `ouvrirOuTelecharger`).
 */

import { JETONS } from 'aedificium-ui';

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
