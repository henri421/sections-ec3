# Plan : cornières (L), profils en U, 2L et 2U dos à dos

Extension de `sections-ec3`, périmètre **complet** retenu le 2026-10-03 : propriétés,
classification, résistances de section, flambement par flexion et par flexion-torsion,
déversement, flexion composée avec instabilité. Profils doublés : **2L dos à dos** et
**2U dos à dos** sur gousset.

Les règles de `CONVENTIONS.md` s'appliquent sans exception : identifiants en français sans
accents, kN/mm/MPa, « l'outil constate et ne prescrit pas », vérification sans objet
déclarée **non applicable** avec son motif, toute source hors norme nommée comme telle.
Chaque lot se termine par les tests au vert (banc local), le typecheck en CI et un commit.

## Avancement

- **Lots 0 à 3 faits** (2026-10-03) : garde-fous par le typage (les fonctions de vérification
  n'acceptent que `ProfilDoublementSymetrique`, `verifierElement` refuse L et U), moteur de
  contour, catalogue L/UPE/UPN avec recoupement, 2L et 2U. Validation :
  `docs/validation/cornieres-u-proprietes.md`.
- **Écart au plan, lot 3** : I_t, I_w et e₀ des L et U laminés sont **repris du producteur**, et
  non recalculés. Les formules usuelles s'écartent de −20 à +17 % des valeurs publiées
  (surestimation non conservative pour la flexion-torsion et le déversement).
- Typecheck local possible désormais : `_banc-local/typecheck.mjs` (TypeScript embarqué par
  VS Code).

## Pourquoi ce n'est pas un simple ajout au catalogue

Le noyau actuel suppose partout des sections **doublement symétriques** :

| Endroit | Hypothèse actuelle | Ce que L et U cassent |
| --- | --- | --- |
| `proprietes/brutes.ts` | axe neutre plastique = axe de symétrie, intégration par bandes en w(u) | centre de gravité excentré, axes principaux inclinés (L), axe neutre plastique à chercher |
| `classifier.ts` | âme + semelles en console symétriques | tableau 5.2 feuille 3 (cornières), semelles de U à bord libre comprimé ou tendu |
| `resistances/section.ts` | (6.36) à (6.40) | sans objet pour L et U ; critère (6.2) linéaire ou (6.42) |
| `flambement.ts` | flexion seule | **flexion-torsion §6.3.1.4**, souvent dimensionnante pour L, U et 2L |
| `deversement.ts` | M_cr à trois termes, I doublement symétrique | U : centre de cisaillement excentré ; L : pas d'expression usuelle |
| `flexion-composee.ts` | annexe B, I et tubes | domaine de l'annexe B dépassé |

Négliger la flexion-torsion ou appliquer (6.36) à une cornière serait **non conservatif** :
chaque lot ci-dessous commence par fermer ces portes (refus explicite), puis les rouvre
avec le bon traitement.

## Lot 0 — Garde-fous immédiats

Avant toute nouvelle famille : chaque fonction qui suppose la double symétrie vérifie le
type de profil et **lève** pour un type non prévu (`switch` exhaustif avec `never`). Ainsi
un L ajouté au modèle ne peut pas traverser silencieusement (6.36) ou le M_cr des I.

## Lot 1 — Moteur géométrique général

Nouveau module `src/proprietes/contour.ts` : une section décrite par un **contour
polygonal** (congés et arrondis de rive discrétisés en arcs, 16 segments par quart de
cercle au moins), propriétés par la formule de Green :

- A, centre de gravité (y_G, z_G), I_y, I_z, I_yz ;
- axes principaux u, v, angle α (tan α), I_u, I_v ;
- W_el aux fibres extrêmes, dans le repère géométrique et le repère principal ;
- W_pl : recherche de l'axe neutre plastique (aire égale de part et d'autre) par
  découpage du polygone, pour chaque axe demandé.

**Validation croisée** : le moteur recalcule les IPE et HE du catalogue actuel. Il doit
retrouver les valeurs de l'intégrateur par bandes à 0,1 % près, ce qui valide le moteur
sur un terrain connu avant les nouvelles familles.

## Lot 2 — Modèle et catalogue

Nouveaux types dans `model/profil.ts` :

```ts
| { type: 'L'; nom: string; h: number; b: number; t: number; r1: number; r2: number }
| { type: 'U-paralleles'; nom: string; h: number; b: number; tw: number; tf: number; r: number }   // UPE
| { type: 'U-inclinees'; nom: string; h: number; b: number; tw: number; tf: number; r1: number; r2: number } // UPN, pente 8 %
| { type: '2L'; cornieres: ProfilL; ecartement: number; aileAccolee: 'h' | 'b' }
| { type: '2U'; profilU: ProfilU; ecartement: number }
```

Catalogue (`profils.json`, dimensions nominales seulement, comme aujourd'hui) :

- **L à ailes égales** et **L à ailes inégales**, EN 10056-1 ;
- **UPN**, DIN 1026-1 (ailes inclinées à 8 %, t_f mesuré à mi-aile) ;
- **UPE**, Euronorm / catalogue producteur (ailes parallèles).

Un test compare les valeurs **recalculées** aux valeurs **publiées** (A, I_y, I_z, I_u,
I_v, tan α, y_G, z_G, W_el, W_pl, I_t, I_w), avec tolérance déclarée, comme pour les IPE/HE.
Source à saisir avec sa date : catalogue producteur (ArcelorMittal, Sales Programme) ou
les normes de dimensions, selon l'accès disponible.

## Lot 3 — Torsion, gauchissement, centre de cisaillement

- **Centre de cisaillement** : L, à l'intersection des lignes moyennes des ailes ; U,
  excentricité e de la théorie des parois minces, sur l'axe de symétrie ; 2L et 2U, déduits
  par symétrie.
- **I_t** : formule des catalogues pour les laminés (somme des b t³ / 3 corrigée des congés),
  la même convention que pour les I, et la source le dit.
- **I_w** : U, expression des parois minces ; L, négligeable (pris nul, déclaré) ; 2U,
  calculé pour la section composée.

## Lot 4 — Classification

- **Cornière comprimée** (tableau 5.2 feuille 3) : classe 3 si h/t ≤ 15ε et
  (b + h)/(2t) ≤ 11,5ε, sinon classe 4. Pas de classe 1 ou 2 en compression.
- **Cornière fléchie** : ailes traitées comme parois en console (feuille 2), bord libre
  comprimé ou tendu selon le signe de la contrainte.
- **U** : âme en paroi interne (feuille 1, α et ψ comme pour les I) ; semelles en console
  (feuille 2), avec les limites **bord libre comprimé / tendu** sous M_z.
- **2L et 2U** : chaque profil composant est classé ; la note de la feuille 3 (cornières en
  contact continu avec d'autres éléments) est appliquée du côté de la sécurité.

**Classe 4** : beaucoup de cornières courantes y tombent (L 100×6 en S235 : h/t = 16,7 > 15).
Refuser la classe 4 rendrait l'extension inutile. Lot 4b : section efficace par
l'EN 1993-1-5 §4.4 pour les parois en console (k_σ du tableau 4.2, ρ de (4.3)), A_eff et
décalage e_N du centre de gravité. Le moment additionnel ΔM = N_Ed e_N entre dans les
interactions (termes ΔM de (6.61)/(6.62)).

## Lot 5 — Résistances de section

- N_pl,Rd, N_c,Rd (A_eff f_y en classe 4).
- **A_v** : U, §6.2.6(3)(c) A − 2 b t_f + (t_w + r) t_f ; L, aire de l'aile parallèle à
  l'effort (h t), **choix déclaré**, la norme ne donnant pas d'expression.
- Moments : U autour de y et z (W_pl,z avec son axe neutre plastique propre) ; L dans le
  **repère principal** u, v (les moments saisis en y, z y sont projetés, le résultat le dit).
- Interaction N-M : critère linéaire (6.2) pour L et U, du côté de la sécurité et déclaré ;
  (6.42) en classe 3 ; 2U dos à dos traité avec les règles des I (section doublement
  symétrique).
- **Charge hors du centre de cisaillement** (U chargé dans le plan de l'âme) : torsion non
  traitée, **avertissement** explicite.

## Lot 6 — Flambement

- **Par flexion** : tableau 6.2, courbe **b** pour les L (tous axes), **c** pour les U
  (tous axes). Pour les L : flambement autour de v (L_cr,v), et autour de y et z si les
  longueurs diffèrent.
- **Par torsion et flexion-torsion**, §6.3.1.4 : N_cr,T = (G I_t + π² E I_w / L_cr,T²) / i_0²,
  i_0² = i_y² + i_z² + y_0² + z_0² ; N_cr,TF par l'équation cubique (sections à un axe de
  symétrie : équation du second degré). Courbe : celle de l'axe z (§6.3.1.4(1)).
  **Source** : la norme renvoie à N_cr sans l'expliciter. Expressions classiques de la
  théorie des parois minces (Timoshenko-Gere ; NCCI SN001), donc **hors norme** et nommées
  comme telles, comme le M_cr actuel.
- **Option « barre de treillis »** (annexe BB.1.2) pour les cornières : λ_eff,v = 0,35 + 0,7 λ_v
  (et les variantes y, z), avec la condition d'assemblage (au moins deux boulons) saisie.

## Lot 7 — Déversement

- **U** fléchi autour de y : M_cr à trois termes avec I_w et I_t du U, charge rapportée au
  **centre de cisaillement** (z_g mesuré depuis lui), hors norme. Courbe **d**, méthode
  générale §6.3.2.2 (le tableau 6.5 ne vise que les I).
- **2U dos à dos** : traité comme un I doublement symétrique (expression actuelle).
- **L et 2L** : pas d'expression usuelle fiable dans le périmètre → M_cr **saisi**, sinon
  « non applicable : M_cr à fournir » (jamais « satisfait »).

## Lot 8 — Flexion composée avec instabilité, §6.3.3

L'annexe B vise les sections en I et les tubes. Pour L, U et 2L, c'est un **choix à
trancher** (voir plus bas). 2U dos à dos reste dans le domaine (section doublement
symétrique).

## Lot 9 — Profils composés 2L et 2U

- Propriétés par le moteur du lot 1 (deux contours séparés par l'écartement = épaisseur du
  gousset).
- **Barres composées à faible écartement**, §6.4.4 et tableau 6.9 : la barre est calculée
  comme une barre unique si l'espacement des liaisons (fourrures, boulons) est au plus
  15 i_min, i_min étant le rayon de giration minimal d'**un** profil. Espacement saisi ;
  au-delà, le résultat dit « hors périmètre : barre à membrures écartées (§6.4) », jamais
  un calcul sur la section composée.
- 2L : flexion-torsion presque toujours à vérifier (section en T, z_0 ≠ 0).

## Lot 10 — Interface et export

- Familles L égales, L inégales, UPN, UPE, 2L, 2U dans le choix du catalogue ; saisie de
  l'écartement, de l'aile accolée (2L inégales) et de l'espacement des liaisons.
- Croquis SVG de la section : centre de gravité, centre de cisaillement, axes u, v pour les
  L.
- Export : les nouvelles grandeurs (I_u, I_v, tan α, y_0, z_0, N_cr,TF) dans la note.

## Lot 11 — Validation

Cas recalculés à la main, chacun dans `docs/validation/` et dans un test :

1. L 100×100×10 S235 : propriétés, classe, flambement autour de v et flexion-torsion.
2. UPN 200 S275 : propriétés, I_w, centre de cisaillement, flambement, M_cr.
3. 2L 80×8 dos à dos, gousset 10 mm : propriétés composées, tableau 6.9, flexion-torsion.
4. 2U 160 dos à dos, gousset 10 mm : comme un I, déversement et §6.3.3.
5. L 100×6 S235 : classe 4, A_eff et e_N.

## Décisions (prises le 2026-10-03)

1. **§6.3.3 pour L, U et 2L** : annexe B **étendue** hors de son domaine (formules de classe 3,
   χ = min(flexion, flexion-torsion)), le résultat déclarant l'extension.
2. **Classe 4** : traitée dans cette extension (lot 4b, EN 1993-1-5 §4.4).
3. **Catalogue** : catalogue producteur consulté en ligne (ArcelorMittal, Sales Programme),
   source et date saisies, valeurs publiées gardées pour le test de concordance.
