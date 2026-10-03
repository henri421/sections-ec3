# Validation — propriétés des cornières, U, 2L et 2U

Cas reproduits par `tests/proprietes/contour.test.ts` et `tests/catalogue/cornieres-u.test.ts`.

## Moteur de contour, calculs à la main

**Rectangle 100 × 200 mm** : A = 20 000 mm², I_y = 100 × 200³ / 12, W_pl = 100 × 200² / 4 = 1 000 000 mm³.

**Cornière 100 × 100 × 10 à angles vifs**, découpée en une aile verticale 10 × 100 (centre 5 ; 50)
et une aile horizontale 90 × 10 (centre 55 ; 5) :

- A = 1 000 + 900 = **1 900 mm²** ; c = (1 000 × 50 + 900 × 5) / 1 900 = **28,684 mm**
- I_y = 10 × 100³/12 + 1 000 × (50 − c)² + 90 × 10³/12 + 900 × (5 − c)² = **1 800 044 mm⁴** = I_z
- I_yz = 1 000 (5 − c)(50 − c) + 900 (55 − c)(5 − c) = **−1 065 789 mm⁴**
- ailes égales : axes principaux à 45°, I_u = I_y − I_yz = **2 865 833 mm⁴**, I_v = **734 254 mm⁴**
- axe neutre plastique horizontal : 100 z_p = 950, z_p = **9,5 mm** ;
  W_pl = 100 × 9,5²/2 + 100 × 0,5²/2 + 900 × 45,5 = **45 475 mm³**

**Congé** : un arc de rayon r à un angle saillant retire (1 − π/4) r² ; avec r = 20 mm, 85,8 mm².

**IPE 300** reconstruit en contour : A, I_y et W_pl,y à moins de 0,1 % de l'intégration par
bandes déjà validée.

## Recoupement avec le catalogue du producteur

Valeurs publiées par ArcelorMittal (Orange Book, consulté le 2026-10-03), trois chiffres
significatifs. Écarts maximaux constatés sur toute la gamme :

| Famille | A | Inerties | Autres |
| --- | --- | --- | --- |
| L à ailes égales (192) | 1,07 % | I_y 2,03 %, I_u 1,67 %, I_v 3,25 % | c 0,82 %, W_el 2,04 % |
| L à ailes inégales (32) | 0,34 % | 0,66 % | tan α 0,29 % |
| UPE (14) | 0,29 % | 0,45 % | W_pl,y 0,29 %, e₀ (parois minces) 0,39 % |
| UPN (18) | 0,37 % | 0,88 % | W_pl,y 2,04 % |
| 2L dos à dos (154 × 5 écartements) | | | A, I_y, i_z 1,87 % |

Les plus grands écarts des cornières concernent les séries 250 et 300 et les petites cornières
dont le rayon de rive dépasse l'épaisseur (L 45×45×3 : r₂ = 3,5 > t = 3, rayon borné à t).

**Valeurs publiées écartées**, avec leur motif :

- L 200×200×16 : I_y publié 2 430 cm⁴, incohérent avec A et c publiés (écart isolé de 3,7 % ;
  le moteur donne 2 341 cm⁴) ;
- UPE 330, 360 et 400 : W_pl,z publié hors tendance (UPE 400 : 191 cm³ publié, 221 recalculé ;
  W_pl,z / W_el,z = 1,55 contre 1,80 sur le reste de la gamme). Un calcul à la main sur UPE 200
  donne 61,9 cm³ contre 62,2 recalculé et 63,3 publié.

## 2U et 2L

- 2 UPE 200 dos à dos, gousset 10 mm : A et I_y doubles, I_z = 2 [I_z,1 + A₁ (5 + y_G,1)²]
  (Steiner), centre de cisaillement au centre de gravité.
- 2 L 80×80×8, gousset 10 mm : symétrique par rapport à z, centre de cisaillement à t/2 du talon.

## Classification et section efficace (lot 4)

- Cornières à ailes égales en S355 : les 109 profils que le producteur classe 4 sont classés 4.
  Trois désaccords à la limite (L 300×300×32, 180×180×19, 160×160×17) : le producteur prend
  f_y = 345 MPa de la norme de produit (16 < t ≤ 40 mm), l'outil 355 MPa du tableau 3.1 ; avec
  345 MPa, le désaccord disparaît.
- A_eff / A du producteur retrouvé à 1,15 % près. Convention commune : aile entière comme
  largeur de référence, k_σ = 0,43, rectangle (1 − ρ) h t retiré à chaque extrémité d'aile.
- Calcul à la main, L 100×100×6 S235 : λ_p = 16,67 / (28,4 × 0,6557) = 0,895,
  ρ = (0,895 − 0,188) / 0,895² = 0,882.

## Flambement (lot 6)

Recoupement avec les résistances publiées (S355, f_y de la norme de produit) :

- **UPE, flexion-torsion** N_b,T,Rd : 14 profils, 1 à 14 m, écart maximal **1,4 %**
  (UPE 120, 3 m). L'équation de flexion-torsion et le centre de cisaillement sont validés.
- **Cornières, torsion pure** : écart maximal **0,6 %**.
- **Cornières de treillis, flexion autour de v** (annexe BB.1.2) : 3 % au plus pour h ≤ 120 mm.

**Point ouvert.** Cornières de 140 à 300 mm : l'outil **dépasse** la valeur publiée de 2 à
6,6 % aux faibles longueurs (1 m), l'écart se résorbant avec la longueur (1,7 % à 14 m pour
L 300×300×35). Ni f_y, ni la classe, ni l'aire ne l'expliquent. Le tableau consulté suit
l'annexe nationale britannique, qui peut modifier l'annexe BB : c'est l'hypothèse à vérifier.

**Écart connu, non adopté.** Flexion autour de z des UPE courts : le producteur publie moins que
le §6.3.1.2 (UPE 200 à 1 m : 643 kN contre 859 kN), comme s'il employait
max(λ ; 0,5 + 0,7 λ), règle que l'annexe BB réserve aux cornières. L'outil suit le §6.3.1.2 ;
les valeurs coïncident à partir de 6 m.

Le mode couplé de flexion-torsion des cornières à ailes égales (flexion autour de l'axe de
symétrie et torsion), absent des tableaux du producteur qui ne donnent que la torsion pure,
est calculé et vérifié : il est du côté de la sécurité.
