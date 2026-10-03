# sections-ec3

Profils acier selon l'EN 1993-1-1 : propriétés recalculées, classification, résistances
de section, flambement par flexion, déversement et flexion composée avec risque
d'instabilité.

Fait partie de la suite [Aedificium web](https://henri421.github.io/WebAedificium/).
Page publiée : <https://henri421.github.io/sections-ec3/>.

> **Aide au calcul. L'outil constate, il ne prescrit pas** : il rend des résistances et
> des taux de travail, jamais un choix de profil. Valeurs recommandées, sans annexe
> nationale. La vérification finale incombe à l'ingénieur du projet.

## Ce que l'outil rend

- **Catalogue** IPE, HEA, HEB : un JSON embarqué qui ne stocke que les dimensions
  normalisées, avec la source et la date de chaque famille. Les propriétés (A, I, W_el, W_pl,
  I_t, I_w) sont **recalculées**, congés compris, et un test les compare aux valeurs publiées.
  Sections soudées en I, tubes rectangulaires et circulaires saisis librement.
- **Classification** (§5.5, tableau 5.2) sous la **sollicitation réelle** : aucune classe n'est
  stockée, la classe de chaque paroi est rendue avec la paroi qui gouverne. Sous M_z, les parois
  latérales d'un tube rectangulaire sont classées en compression uniforme (côté sécurité).
- **Résistances** (§6.2) : N, M (plastique ou élastique selon la classe), V avec les
  expressions de A_v par type de profil, critère de voilement par cisaillement,
  interaction M-V (6.30) et N-M (6.36 à 6.42).
- **Flambement par flexion** (§6.3.1) : tableau 6.2 implémenté intégralement pour le
  périmètre ; une combinaison non couverte lève.
- **Déversement** (§6.3.2.3) : λ_LT,0, β et le facteur f ; dispense rendue **non applicable**.
  **M_cr est hors norme** : expression à trois termes (ENV 1993-1-1 annexe F, NCCI SN003),
  signalée comme telle à l'écran et dans la note ; M_cr peut être saisi.
- **Flexion composée** (§6.3.3) : facteurs k_ij de l'**annexe B**, choix porté par le profil
  normatif.

## En cours : cornières, profils en U, 2L et 2U

Plan : [`PLAN-cornieres-et-u.md`](PLAN-cornieres-et-u.md). Fait (noyau, pas encore dans
l'interface) :

- catalogue **L à ailes égales et inégales** (EN 10056-1), **UPE** et **UPN** (gamme ArcelorMittal) ;
- moteur géométrique général : centre de gravité, **axes principaux u, v**, axe neutre plastique
  cherché sans supposer de symétrie, profils composés **2L et 2U dos à dos** ;
- recoupement avec les valeurs publiées sur toute la gamme (A à 1,1 % près, inerties à 2 % près,
  deux valeurs publiées écartées avec leur motif) ;
- I_t, I_w et centre de cisaillement des L et U laminés **repris du producteur** (voir les choix
  déclarés) ;
- garde-fou : une cornière ou un U ne traverse pas les vérifications des sections en I.

## Hors périmètre de la version 1

Sections de classe 4 (propriétés efficaces, EN 1993-1-5 §4) ; **annexe A** du §6.3.3 (la
choisir fait lever le module) ; torsion ; sections monosymétriques ; flambement par torsion et
flexion-torsion ; voilement par cisaillement au-delà du critère du §6.2.6(6) ; assemblages, qui
relèvent de `assemblages-ec3`.

## Choix déclarés

- Semelles classées en compression uniforme, du côté de la sécurité.
- A_v selon y des profils laminés : expression (e) du §6.2.6(3), énoncée pour les sections
  soudées.
- Interaction M-V hors profils en I fléchis autour de y : (1 − ρ) appliqué au moment
  résistant entier, du côté de la sécurité.
- I_t, I_w et centre de cisaillement des cornières et des U laminés : valeurs **publiées** par
  le producteur, faute d'expression fermée fiable (les formules usuelles s'écartent de −20 à
  +17 %, et une surestimation serait non conservative). Cornière saisie : I_t par
  (h + b − t) t³ / 3, expression minorante.
- UPN : pente des ailes de 8 % jusqu'à UPN 300 (t_f à b/2), 5 % au-delà (t_f au milieu de l'aile),
  convention calée sur les valeurs publiées.
- C_m (tableau B.3) : moments d'extrémité linéaires, ou charge répartie / concentrée sur appuis simples (M_h = 0) ; les diagrammes mixtes (moments d'extrémité et charge transversale) ne sont pas traités.

## Développement

```bash
npm install
npm run typecheck
npm test
npm run dev
```

Cas validé : [`docs/validation/heb200-ipe300.md`](docs/validation/heb200-ipe300.md).

## Références

EN 1993-1-1:2005 §5.5, §6.2, §6.3, annexe B ; EN 1993-1-5 §5.1 ; EN 10210-2 et EN 10219-2 pour
les tubes ; Euronorm 19-57 et 53-62 pour les profils ; EN 10056-1 et DIN 1026-1 pour les cornières
et les U, dimensions et valeurs publiées du catalogue ArcelorMittal (Orange Book, consulté le
2026-10-03). L'EN 1993-1-1:2022 (deuxième génération)
n'est pas encore applicable.

## Licence

MIT — voir [LICENSE](LICENSE), sans garantie d'aucune sorte.
