/**
 * Les textes affiches, en francais et en anglais. PUR.
 *
 * Deux sources :
 * - les textes de l'app (`FR`, `EN`), types : une cle oubliee en anglais ne
 *   compile pas ;
 * - les phrases du noyau (`src/`), ecrites en francais, traduites a
 *   l'affichage par `phrase` : regles par phrase, puis un glossaire de
 *   morceaux (le noyau compose ses motifs de morceaux reutilises).
 *
 * ⚠ Aucun texte ne se lit au chargement d'un module : toujours `textes()` ou
 * `phrase()` AU MOMENT DU RENDU, apres `definirLangue` (main.ts).
 */

import { langueCourante, traducteur } from 'aedificium-ui';

const FR = {
  coupe: (nom: string): string => `Coupe du profil ${nom}`,
  nonApplicable: 'non applicable',
  nonVerifie: 'NON VÉRIFIÉ',
  verdicts: { conforme: 'Conforme', 'non-conforme': 'Non conforme', incomplet: 'Vérification incomplète' } as Record<string, string>,
  verdict: { titre: 'Verdict', constat: 'constat', libelle: 'verdict' },
  familles: {} as Record<string, string>,
  gousset: 'gousset',
  proprietes: {
    aire: 'aire',
    inerties: 'inerties',
    plastiques: 'modules plastiques',
    elastiques: 'modules élastiques',
    torsion: 'torsion, gauchissement',
    acier: (nuance: string, t: string): string => `nuance ${nuance}, t = ${t} mm (tableau 3.1)`,
    centreGravite: 'centre de gravité, repère de construction',
    centreCisaillement: 'centre de cisaillement depuis G',
    principaux: (a: string): string => `axes principaux, alpha = ${a} degrés`,
    elastiquesMin: 'modules élastiques minimaux',
  },
  classification: {
    paroi: (p: string): string => ({ ame: 'âme' })[p] ?? p.replace(/^corniere, /, 'cornière, '),
    limites: (detail: string, l: string): string => `${detail} ; limites ${l}`,
    classe: (el: string, c: number): string => `c/t = ${el} → classe ${c}`,
    gouvernante: (p: string): string => `paroi gouvernante : ${p}`,
    classeSeule: (c: number): string => `classe ${c}`,
    aEff: 'compression pure, EN 1993-1-5 §4.4',
    wEffY: (z: string): string => `flexion M_y, centre de gravité décalé de ${z} mm`,
    wEffZ: 'flexion M_z',
  },
  instabilite: {
    flambement: (axe: string): string => `flambement ${axe}`,
    flambementMode: (mode: string): string => `flambement, ${mode}`,
    courbe: (l: string, n: string, c: string, a: string): string => `L_cr = ${l} m, N_cr = ${n} kN, courbe ${c} (alpha = ${a})`,
    deversement: 'déversement',
    compose: 'barre composée',
  },
  blocs: {
    proprietes: 'Propriétés recalculées',
    classification: 'Classification (§5.5)',
    verifications: 'Vérifications',
    instabilites: 'Instabilités (§6.3)',
  },
  bandeaux: {
    mcr: (m: string, source: string): string =>
      `M<sub>cr</sub> = ${m} kN.m est calculé par une expression HORS NORME (l'EN 1993-1-1 ne donne pas M<sub>cr</sub>) : ${source}. Un M<sub>cr</sub> issu d'un calcul aux éléments finis peut être saisi.`,
    ncr: 'N<sub>cr</sub> de torsion et de flexion-torsion : expression HORS NORME (théorie des parois minces).',
    annexeB: '§6.3.3 : annexe B ÉTENDUE hors de son domaine (section non doublement symétrique).',
    deversement: 'Déversement NON VÉRIFIÉ : saisir M<sub>cr</sub>.',
  },
  diagrammes: {
    lineaire: (psi: string): string => `linéaire, psi = ${psi}`,
    repartie: 'charge répartie, appuis simples',
    concentree: 'charge concentrée à mi-portée',
    mixte: (rep: boolean, Mh: string, psi: string, Ms: string): string => `mixte (${rep ? 'répartie' : 'concentrée'}) : M_h = ${Mh} kN.m, psi = ${psi}, M_s = ${Ms} kN.m`,
  },
  entrees: {
    titre: 'Données',
    profil: 'profil',
    sollicitations: 'sollicitations de calcul',
    tranchants: 'efforts tranchants',
    longueurs: 'longueurs de flambement, entre maintiens',
    diagrammeLT: 'diagramme LT',
    deversement: 'déversement (C1, C2, C_mLT)',
    diagrammeY: 'diagramme M_y',
    cmy: 'C_my, tableau B.3',
    diagrammeZ: 'diagramme M_z',
    cmz: 'C_mz, tableau B.3',
  },
  avertissements: {
    mcr: (s: string): string => `M_cr calculé HORS NORME : ${s}.`,
    ncr: 'N_cr de torsion et de flexion-torsion calculé HORS NORME (théorie des parois minces).',
    deversement: 'Déversement NON VÉRIFIÉ : M_cr à fournir.',
  },
  note: {
    hypothesesSym: [
      'Propriétés recalculées à partir des dimensions nominales ; aucune classe stockée.',
      'Semelles classées en compression uniforme, du côté de la sécurité.',
      "Facteurs k_ij de l'annexe B du §6.3.3 ; C_m pour des moments linéaires.",
      "Valeurs recommandées de l'EN 1993-1-1 ; aucune annexe nationale codée.",
    ],
    hypothesesNonSym: [
      'Propriétés recalculées sur le contour ; I_t, I_w et centre de cisaillement des profils laminés repris du producteur.',
      'Classe 4 : section efficace unique, toutes parois en compression uniforme (EN 1993-1-5 §4.4).',
      'Interaction N-M de section par le critère linéaire (6.2), (6.44) en classe 4.',
      'Annexe B du §6.3.3 étendue aux cornières, U et 2L, hors de son domaine.',
      "Valeurs recommandées de l'EN 1993-1-1 ; aucune annexe nationale codée.",
    ],
    profilLongueurs: 'Profil et longueurs',
    acier: 'Acier',
    profil: (nom: string, date: string): string => `Profil normatif : ${nom}, données consultées le ${date}.`,
    diagrammes: 'Diagrammes de moments',
    sollicitations: 'Sollicitations de calcul',
  },
  saisie: {
    valeurInattendue: (nom: string, x: string): string => `Valeur inattendue pour ${nom} : « ${x} ».`,
    nombreAttendu: (nom: string): string => `${nom} : nombre attendu.`,
    mcr: 'M_cr : nombre attendu, ou champ vide.',
  },
  messages: {
    elementAbsent: (s: string): string => `élément absent de la page : ${s}`,
    nouvelleVersion: 'Une nouvelle version est disponible. Recharger maintenant ?',
  },
};

type Textes = typeof FR;

const EN: Textes = {
  coupe: (nom) => `Cross-section ${nom}`,
  nonApplicable: 'not applicable',
  nonVerifie: 'NOT VERIFIED',
  verdicts: { conforme: 'Compliant', 'non-conforme': 'Not compliant', incomplet: 'Incomplete verification' },
  verdict: { titre: 'Verdict', constat: 'finding', libelle: 'verdict' },
  familles: { 'L-egales': 'L equal legs', 'L-inegales': 'L unequal legs' },
  gousset: 'gusset',
  proprietes: {
    aire: 'area',
    inerties: 'second moments of area',
    plastiques: 'plastic moduli',
    elastiques: 'elastic moduli',
    torsion: 'torsion, warping',
    acier: (nuance, t) => `grade ${nuance}, t = ${t} mm (Table 3.1)`,
    centreGravite: 'centroid, construction axes',
    centreCisaillement: 'shear centre from G',
    principaux: (a) => `principal axes, alpha = ${a} degrees`,
    elastiquesMin: 'minimum elastic moduli',
  },
  classification: {
    paroi: (p) => (p === 'ame' ? 'web' : phrase(p)),
    limites: (detail, l) => `${detail}; limits ${l}`,
    classe: (el, c) => `c/t = ${el} → class ${c}`,
    gouvernante: (p) => `governing part: ${p}`,
    classeSeule: (c) => `class ${c}`,
    aEff: 'pure compression, EN 1993-1-5 4.4',
    wEffY: (z) => `bending M_y, centroid shifted by ${z} mm`,
    wEffZ: 'bending M_z',
  },
  instabilite: {
    flambement: (axe) => `buckling ${axe}`,
    flambementMode: (mode) => `buckling, ${mode}`,
    courbe: (l, n, c, a) => `L_cr = ${l} m, N_cr = ${n} kN, curve ${c} (alpha = ${a})`,
    deversement: 'lateral-torsional buckling',
    compose: 'built-up member',
  },
  blocs: {
    proprietes: 'Recalculated properties',
    classification: 'Classification (5.5)',
    verifications: 'Verifications',
    instabilites: 'Buckling (6.3)',
  },
  bandeaux: {
    mcr: (m, source) =>
      `M<sub>cr</sub> = ${m} kN.m is calculated by an expression OUTSIDE THE STANDARD (EN 1993-1-1 does not give M<sub>cr</sub>): ${source}. An M<sub>cr</sub> from a finite element calculation may be entered.`,
    ncr: 'N<sub>cr</sub> for torsional and flexural-torsional buckling: expression OUTSIDE THE STANDARD (thin-walled theory).',
    annexeB: '6.3.3: Annex B EXTENDED outside its scope (section not doubly symmetric).',
    deversement: 'Lateral-torsional buckling NOT VERIFIED: enter M<sub>cr</sub>.',
  },
  diagrammes: {
    lineaire: (psi) => `linear, psi = ${psi}`,
    repartie: 'distributed load, simple supports',
    concentree: 'point load at mid-span',
    mixte: (rep, Mh, psi, Ms) => `mixed (${rep ? 'distributed' : 'point'}): M_h = ${Mh} kN.m, psi = ${psi}, M_s = ${Ms} kN.m`,
  },
  entrees: {
    titre: 'Input',
    profil: 'section',
    sollicitations: 'design action effects',
    tranchants: 'shear forces',
    longueurs: 'buckling lengths, between restraints',
    diagrammeLT: 'LT diagram',
    deversement: 'lateral-torsional buckling (C1, C2, C_mLT)',
    diagrammeY: 'M_y diagram',
    cmy: 'C_my, Table B.3',
    diagrammeZ: 'M_z diagram',
    cmz: 'C_mz, Table B.3',
  },
  avertissements: {
    mcr: (s) => `M_cr calculated OUTSIDE THE STANDARD: ${s}.`,
    ncr: 'N_cr for torsional and flexural-torsional buckling calculated OUTSIDE THE STANDARD (thin-walled theory).',
    deversement: 'Lateral-torsional buckling NOT VERIFIED: M_cr to be provided.',
  },
  note: {
    hypothesesSym: [
      'Properties recalculated from the nominal dimensions; no stored class.',
      'Flanges classified in uniform compression, on the safe side.',
      'Factors k_ij of Annex B of 6.3.3; C_m for linear moments.',
      'Recommended values of EN 1993-1-1; no National Annex coded.',
    ],
    hypothesesNonSym: [
      'Properties recalculated on the outline; I_t, I_w and shear centre of rolled sections taken from the producer.',
      'Class 4: single effective section, all plates in uniform compression (EN 1993-1-5 4.4).',
      'N-M interaction of the section by the linear criterion (6.2), (6.44) in class 4.',
      'Annex B of 6.3.3 extended to angles, channels and 2L, outside its scope.',
      'Recommended values of EN 1993-1-1; no National Annex coded.',
    ],
    profilLongueurs: 'Section and lengths',
    acier: 'Steel',
    profil: (nom, date) => `Code profile: ${nom}, data checked on ${date}.`,
    diagrammes: 'Bending moment diagrams',
    sollicitations: 'Design action effects',
  },
  saisie: {
    valeurInattendue: (nom, x) => `Unexpected value for ${nom}: “${x}”.`,
    nombreAttendu: (nom) => `${nom}: number expected.`,
    mcr: 'M_cr: number expected, or empty field.',
  },
  messages: {
    elementAbsent: (s) => `element missing from the page: ${s}`,
    nouvelleVersion: 'A new version is available. Reload now?',
  },
};

export function textes(): Textes {
  return langueCourante() === 'en' ? EN : FR;
}

/** Nom d'une verification du noyau. */
const VERIFICATIONS: Record<string, string> = {
  'Effort normal': 'Axial force',
  'Cisaillement selon z': 'Shear along z',
  'Cisaillement selon y': 'Shear along y',
  'Flexion composée de section': 'Combined bending and axial force of the section',
  'Flambement par flexion': 'Flexural buckling',
  Flambement: 'Buckling',
  Deversement: 'Lateral-torsional buckling',
  Déversement: 'Lateral-torsional buckling',
  'Flexion composée, expression (6.61)': 'Bending and axial compression, expression (6.61)',
  'Flexion composée, expression (6.62)': 'Bending and axial compression, expression (6.62)',
  'Flexion composée avec instabilité': 'Bending and axial compression with buckling',
};
const verification = (nom: string): string =>
  VERIFICATIONS[nom] ??
  nom
    .replace(/^Flambement par flexion autour de ([yzv])$/, 'Flexural buckling about $1')
    .replace(/^Flambement : flexion autour de ([yzv])$/, 'Buckling: flexure about $1')
    .replace(/^Flambement : torsion ou flexion-torsion$/, 'Buckling: torsional or flexural-torsional');

/** Nom d'une grandeur dans les messages d'erreur du noyau. */
const grandeur = (nom: string): string =>
  ({
    "L'espacement des liaisons": 'The spacing of the connections',
    'Le moment critique saisi M_cr': 'The entered elastic critical moment M_cr',
    'La longueur entre maintiens lateraux L': 'The length between lateral restraints L',
    'La longueur de flambement par torsion L_T': 'The torsional buckling length L_T',
    'Le diamètre d': 'The diameter d',
    "L'épaisseur t": 'The thickness t',
    "L'écartement des cornières": 'The spacing of the angles',
    "L'écartement des profils en U": 'The spacing of the channels',
  })[nom] ??
  nom
    .replace(/^La longueur de flambement (.+)$/, 'The buckling length $1')
    .replace(/^La dimension (\S+) de la cornière$/, 'The dimension $1 of the angle')
    .replace(/^La dimension (\S+) du profil en U$/, 'The dimension $1 of the channel')
    .replace(/^La dimension (\S+)$/, 'The dimension $1');

/** Renvois a la norme : sans « § », « tableau » -> « Table », etc. */
const renvoi = (t: string): string =>
  t
    .replace(/§/g, '')
    .replace(/\b[Tt]ableau\b/g, 'Table')
    .replace(/\bfeuille\b/g, 'sheet')
    .replace(/\b[Aa]nnexe\b/g, 'Annex')
    .replace(/\bfigure\b/g, 'Figure');

/**
 * Glossaire des morceaux du noyau, du plus long au plus court : applique
 * dans l'ordre, APRES les renvois (« § » retire, « Table », « Annex »).
 */
const MORCEAUX: ReadonlyArray<readonly [string, string]> = [
  [
    "Expression à trois termes, ENV 1993-1-1 Annex F et NCCI SN003 — source bibliographique, HORS NORME (l'EN 1993-1-1 ne donne pas M_cr)",
    'Three-term expression, ENV 1993-1-1 Annex F and NCCI SN003 — bibliographic source, OUTSIDE THE STANDARD (EN 1993-1-1 does not give M_cr)',
  ],
  [
    "Théorie des barres à parois minces (Timoshenko et Gere ; NCCI SN001) — source bibliographique, HORS NORME (l'EN 1993-1-1 ne donne pas N_cr,T ni N_cr,TF)",
    'Theory of thin-walled members (Timoshenko and Gere; NCCI SN001) — bibliographic source, OUTSIDE THE STANDARD (EN 1993-1-1 gives neither N_cr,T nor N_cr,TF)',
  ],
  [
    'Annex B ÉTENDUE hors de son domaine (section non doublement symétrique), formules de classe 3, chi minimal entre flexion et flexion-torsion',
    'Annex B EXTENDED outside its scope (section not doubly symmetric), class 3 formulas, minimum chi between flexural and flexural-torsional buckling',
  ],
  ['Membrure comprimée maintenue latéralement en continu : déversement empêché.', 'Compression flange continuously restrained laterally: lateral-torsional buckling prevented.'],
  ['Flexion autour de y, axe faible de la section composée : pas de déversement.', 'Bending about y, minor axis of the built-up section: no lateral-torsional buckling.'],
  [
    'Cornière fléchie autour de son axe fort : M_cr a fournir (aucune expression fiable dans ce périmètre). Déversement NON VÉRIFIÉ.',
    'Angle bent about its major axis: M_cr to be provided (no reliable expression within this scope). Lateral-torsional buckling NOT VERIFIED.',
  ],
  ['Section creuse fermée : rigidité de torsion élevée, déversement non applicable.', 'Closed hollow section: high torsional stiffness, lateral-torsional buckling not applicable.'],
  [
    " Charge supposée appliquée au centre de cisaillement : la torsion d'une charge dans le plan de l'âme n'est pas traitée.",
    ' Load assumed applied at the shear centre: the torsion from a load in the plane of the web is not treated.',
  ],
  [
    "Profil en U : un effort appliqué dans le plan de l'âme (hors du centre de cisaillement) induit une torsion non traitée.",
    'Channel: a force applied in the plane of the web (away from the shear centre) induces a torsion that is not treated.',
  ],
  [' Déversement non vérifié : M_cr a fournir.', ' Lateral-torsional buckling not verified: M_cr to be provided.'],
  ['déversement négligeable', 'lateral-torsional buckling negligible'],
  ['Méthode générale 6.3.2.2, courbe ', 'General method 6.3.2.2, curve '],
  ['Méthode du 6.3.2.3, courbe ', 'Method of 6.3.2.3, curve '],
  [' M_cr : saisi.', ' M_cr: entered.'],
  [' M_cr : HORS NORME.', ' M_cr: OUTSIDE THE STANDARD.'],
  ["saisi par l'utilisateur (calcul extérieur)", 'entered by the user (external calculation)'],
  ['toutes les parois sont entièrement efficaces (lambda_p sous le seuil)', 'all plates fully effective (lambda_p below the limit)'],
  ['parois réduites (compression uniforme, EN 1993-1-5 4.4) : ', 'reduced plates (uniform compression, EN 1993-1-5 4.4): '],
  [' ; parois réduites : ', '; reduced plates: '],
  ['classe 4 : critère (6.44) avec A_eff et W_eff, e_N = 0 (section doublement symétrique)', 'class 4: criterion (6.44) with A_eff and W_eff, e_N = 0 (doubly symmetric section)'],
  ['classe 4 : critère (6.44), moments augmentés de N e_N', 'class 4: criterion (6.44), moments increased by N e_N'],
  [', M réduit par le cisaillement', ', M reduced by shear'],
  [', f_y réduit par le cisaillement', ', f_y reduced by shear'],
  ['critère linéaire (6.2)', 'linear criterion (6.2)'],
  ["classes 1 et 2 : flexion autour d'un axe, taux M/M_N linéaire, critère (6.41)", 'classes 1 and 2: bending about one axis, linear ratio M/M_N, criterion (6.41)'],
  ['classes 1 et 2 : ', 'classes 1 and 2: '],
  ['classe 3 : ', 'class 3: '],
  [', critère (', ', criterion ('],
  ['moments projetés sur les axes principaux', 'moments projected on the principal axes'],
  ['axes y, z principaux par symétrie', 'y, z principal axes by symmetry'],
  ["aile parallèle à l'effort (aile x t), choix déclaré", 'leg parallel to the force (leg x t), declared choice'],
  ["ailes parallèles à l'effort, choix déclaré", 'legs parallel to the force, declared choice'],
  [', choix déclaré', ', declared choice'],
  [", appliquée au profil laminé faute d'expression propre", ', applied to the rolled section for lack of a specific expression'],
  [', plancher eta h_w t_w', ', lower limit eta h_w t_w'],
  [' : pas de voilement par cisaillement à vérifier', ': no shear buckling to verify'],
  [' : voilement par cisaillement (EN 1993-1-5 5) hors périmètre.', ': shear buckling (EN 1993-1-5 Section 5) out of scope.'],
  ['Sans objet pour une cornière.', 'Not applicable to an angle.'],
  ['Sans objet pour une section creuse dans cette version.', 'Not applicable to a hollow section in this version.'],
  ['élément sensible à la torsion', 'member susceptible to torsional deformation'],
  ['(section nette non traitée : assemblages-ec3)', '(net section not treated: assemblages-ec3)'],
  ['Table 6.9) : barre à membrures écartées (6.4), hors périmètre.', 'Table 6.9): built-up member with spaced chords (6.4), out of scope.'],
  [', un profil) : barre unique', ', one section): single member'],
  ['Espacement des liaisons ', 'Spacing of the connections '],
  ['espacement ', 'spacing '],
  ['Cornière : ', 'Angle: '],
  ['Profil composé : ', 'Built-up section: '],
  ['somme des deux cornières (', 'sum of the two angles ('],
  ["somme des deux profils, gauchissement d'ensemble non compté (", 'sum of the two sections, overall warping not counted ('],
  ['valeur publiée par le producteur (catalogue)', 'value published by the producer (catalogue)'],
  ['expression minorante', 'lower-bound expression'],
  ['formule des catalogues de profils laminés (congés compris)', 'formula of the rolled section catalogues (root radii included)'],
  ['théorie des parois minces', 'thin-walled theory'],
  ['parois minces', 'thin walls'],
  ['semelles seules', 'flanges only'],
  ['I_w nul', 'I_w zero'],
  ['centre de cisaillement', 'shear centre'],
  ['torsion ou flexion-torsion', 'torsional or flexural-torsional'],
  ['flexion autour de ', 'flexure about '],
  [', axe faible', ', minor axis'],
  ['paroi latérale (h - 3t)', 'side wall (h - 3t)'],
  ['paroi supérieure (b - 3t)', 'top wall (b - 3t)'],
  ['paroi interne comprimée (M_z non nul)', 'internal part in compression (M_z non-zero)'],
  ['paroi interne comprimée', 'internal part in compression'],
  ['paroi interne, ', 'internal part, '],
  ['paroi en console comprimée', 'outstand part in compression'],
  ['paroi en console, compression uniforme', 'outstand part, uniform compression'],
  ['cornière comprimée (Table 5.2 sheet 3) : pas de classe 1 ou 2', 'angle in compression (Table 5.2 sheet 3): no class 1 or 2'],
  ['semelle comprimée (consoles)', 'compression flange (outstands)'],
  ['semelles (consoles)', 'flanges (outstands)'],
  ['semelle (console)', 'flange (outstand)'],
  ['consoles comprimées', 'outstands in compression'],
  ['parois parallèles à ', 'plates parallel to '],
  ['parois fléchies', 'plates in bending'],
  ['paroi comprimée', 'plate in compression'],
  ['(console)', '(outstand)'],
  ['corniere, ', 'angle, '],
  ['cornière, ', 'angle, '],
  ['aile ', 'leg '],
  ['flexion y', 'bending y'],
  ['flexion z', 'bending z'],
  // Catalogue : sources et familles.
  ['dimensions nominales des poutrelles', 'nominal dimensions of the beams'],
  ['serie', 'series'],
  ['; recoupees avec', '; cross-checked with'],
  ['cornieres a ailes egales', 'equal-leg angles'],
  ['cornieres a ailes inegales', 'unequal-leg angles'],
  ['profils en U a ailes paralleles', 'parallel-flange channels'],
  ['profils en U a ailes inclinees', 'taper-flange channels'],
  [', valeur maximale recommandée', ', maximum recommended value'],
  [', valeur minimale recommandée', ', minimum recommended value'],
  [', valeur recommandée', ', recommended value'],
  ['valeur recommandée', 'recommended value'],
  ['acier ≤', 'steel ≤'],
  ["choix laissé à l'Annex nationale ; Annex B retenue par défaut par l'outil", 'choice left to the National Annex; Annex B adopted by default by the tool'],
  ['section saisie', 'entered section'],
  // Erreurs.
  ["ce n'est pas un profil en I", 'not an I-section'],
  ["ce n'est pas une cornière", 'not an angle'],
  ["ce n'est pas un profil en U", 'not a channel'],
  ['(famille ', '(family '],
  [' absent du catalogue.', ' missing from the catalogue.'],
  [' : employer verifierNonSymetrique pour les cornières, U, 2L, 2U.', ': use verifierNonSymetrique for angles, channels, 2L, 2U.'],
  ['Profil en U ', 'Channel '],
  ['Profil ', 'Section '],
  [' : I_t et I_w publiés requis (aucune expression fermée fiable pour un U).', ': published I_t and I_w required (no reliable closed-form expression for a channel).'],
  [' hors du Table 4.1 (de -3 à 1).', ' outside Table 4.1 (from -3 to 1).'],
  [' : hors du Table 3.1.', ': outside Table 3.1.'],
  ['Épaisseur ', 'Thickness '],
  [' trop grand pour le sommet ', ' too large for the vertex '],
  ['Rayon ', 'Radius '],
  [' dépasse ', ' exceeds '],
  ['HORS NORME', 'OUTSIDE THE STANDARD'],
  ['classe ', 'class '],
  [' degrés', ' degrees'],
  ['courbe ', 'curve '],
  ['« ', '“'],
  [' »', '”'],
  [' : ', ': '],
  [' ; ', '; '],
  [' et ', ' and '],
];

const morceaux = (t: string): string => MORCEAUX.reduce((s, [fr, en]) => s.split(fr).join(en), renvoi(t));

const EXACTES: Record<string, string> = {
  'Eurocode 3, valeurs recommandées': 'Eurocode 3, recommended values',
  'Aucun effort normal.': 'No axial force.',
  'Aucun effort tranchant selon z.': 'No shear force along z.',
  'Aucun effort tranchant selon y.': 'No shear force along y.',
  'Aucun moment.': 'No moment.',
  'Élément non comprimé.': 'Member not in compression.',
  'Aucune sollicitation.': 'No action effect.',
  'Aucun moment autour de y.': 'No moment about y.',
  "Aucun moment autour de l'axe fort.": 'No moment about the major axis.',
  'Tube circulaire de classe 4 : résistance des coques (EN 1993-1-6) hors périmètre.': 'Class 4 circular tube: shell resistance (EN 1993-1-6) out of scope.',
  'Profil compose : espacement des liaisons requis (tableau 6.9).': 'Built-up section: spacing of the connections required (Table 6.9).',
  'Classe 4 : section efficace requise.': 'Class 4: effective section required.',
  'Section de classe 4 : les propriétés efficaces (EN 1993-1-5 §4.4) sont requises.': 'Class 4 section: the effective properties (EN 1993-1-5 4.4) are required.',
  'psi doit être compris entre -1 et 1 (-).': 'psi must lie between -1 and 1 (-).',
  "M_cr par l'expression à trois termes : profils en I doublement symétriques seulement.": 'M_cr by the three-term expression: doubly symmetric I-sections only.',
  'Tableau 6.2 : profil laminé h/b > 1,2 avec t_f > 100 mm non couvert.': 'Table 6.2: rolled section h/b > 1.2 with t_f > 100 mm not covered.',
  'M_h et M_s doivent être des nombres (kN.m).': 'M_h and M_s must be numbers (kN.m).',
  'Diagramme mixte nul : M_h et M_s ne peuvent pas être tous deux nuls.': 'Zero mixed diagram: M_h and M_s cannot both be zero.',
  "Annexe A (méthode 1) du §6.3.3 : non implémentée dans cette version. Choisir l'annexe B dans le profil normatif.":
    'Annex A (method 1) of 6.3.3: not implemented in this version. Choose Annex B in the code profile.',
  "L'épaisseur dépasse le rayon du tube (mm).": 'The thickness exceeds the radius of the tube (mm).',
  "L'épaisseur dépasse la demi-dimension du tube (mm).": 'The thickness exceeds the half-dimension of the tube (mm).',
  'Semelles et congés dépassent la hauteur du profil (mm).': 'Flanges and root radii exceed the depth of the section (mm).',
  'Âme et congés dépassent la largeur du profil (mm).': 'Web and root radii exceed the width of the section (mm).',
  "Contour d'aire nulle ou parcouru dans le mauvais sens.": 'Outline of zero area or traversed in the wrong direction.',
  'Épaisseur et congé dépassent les ailes de la cornière (mm).': 'Thickness and root radius exceed the legs of the angle (mm).',
  'Ailes et congés dépassent la hauteur du profil en U (mm).': 'Flanges and root radii exceed the depth of the channel (mm).',
  'Âme et congé dépassent la largeur du profil en U (mm).': 'Web and root radius exceed the width of the channel (mm).',
  tube: 'tube',
  ame: 'web',
};

/**
 * Traduit une phrase du noyau (motifs, origines, avertissements, erreurs).
 * En francais, la phrase sort intacte.
 */
export const phrase = traducteur(EXACTES, [
  [/^(.+) doit être un nombre strictement positif \((.+)\)\.$/, (_t, nom: string, u: string) => `${grandeur(nom)} must be a strictly positive number (${u}).`],
  [/^(.+) doit être un nombre positif ou nul \((.+)\)\.$/, (_t, nom: string, u: string) => `${grandeur(nom)} must be a positive number or zero (${u}).`],
  [
    /^Taux maximal (.+) : (.+) \((.+)\)\.(.*)$/,
    (_t, taux: string, nom: string, clause: string, suite: string) => {
      const v = verification(nom.charAt(0).toUpperCase() + nom.slice(1));
      return `Maximum ratio ${taux}: ${v.charAt(0).toLowerCase()}${v.slice(1)} (${renvoi(clause)}).${morceaux(suite)}`;
    },
  ],
  [/^N_Ed = (.+) kN dépasse N_pl,Rd = (.+) kN\.$/, 'N_Ed = $1 kN exceeds N_pl,Rd = $2 kN.'],
  [/^Profil « (.*) » : (.+) doit être un nombre strictement positif\.$/, 'Profile “$1”: $2 must be a strictly positive number.'],
  [/^Profil « (.*) » : (.+) n'a pas de source\. Une valeur de provenance inconnue bloque le calcul\.$/, 'Profile “$1”: $2 has no source. A value of unknown origin blocks the calculation.'],
  [/^([A-ZÉ][^:]*)$/, (t: string) => (VERIFICATIONS[t] !== undefined || /^Flambement/.test(t) ? verification(t) : morceaux(t))],
  [/^([\s\S]*)$/, (t: string) => morceaux(t)],
]);
