/**
 * Flambement des cornieres, U, 2L et 2U : par flexion, EN 1993-1-1 §6.3.1.2,
 * et par torsion ou flexion-torsion, §6.3.1.4.
 *
 * Unites : longueurs en mm, efforts en kN, MPa.
 *
 * Courbes, tableau 6.2 : « L » courbe b, « U » courbe c, tous axes (2L et 2U
 * suivent leur profil composant). Flexion-torsion : courbe de l'axe z
 * (§6.3.1.4(1)), donc la meme.
 *
 * ⚠ N_cr,T et N_cr,TF NE FIGURENT PAS dans l'EN 1993-1-1 : la norme definit
 * lambda_T a partir de N_cr sans l'expliciter. Expressions classiques de la
 * theorie des barres a parois minces (Timoshenko et Gere, Theory of elastic
 * stability, ch. 5 ; reprises par le document NCCI SN001) : source
 * BIBLIOGRAPHIQUE, HORS NORME, et le resultat le dit.
 *
 *   N_cr,T = (G I_t + pi^2 E I_w / L_T^2) / i_0^2,  i_0^2 = i_1^2 + i_2^2 + c_1^2 + c_2^2
 *   i_0^2 (N - N_1)(N - N_2)(N - N_T) - N^2 c_2^2 (N - N_1) - N^2 c_1^2 (N - N_2) = 0
 * dans les axes PRINCIPAUX 1 et 2, (c_1, c_2) etant les coordonnees du centre
 * de cisaillement depuis le centre de gravite le long de ces axes ; N_1 et
 * N_2 sont les charges critiques de flexion autour des axes 1 et 2. La plus
 * petite racine positive est N_cr,TF.
 */

import type { Classe } from '../classification/classifier';
import type { SectionEfficace } from '../classification/efficace';
import type { Materiau } from '../model/profil';
import { E, G } from '../model/profil';
import type { ProfilEc3 } from '../norms/profil';
import { exigerPositif, fr } from '../norms/profil';
import type { Proprietes } from '../proprietes/brutes';
import type { ProfilNonSymetrique } from '../proprietes/formes';
import { ALPHA, facteurReduction, type Courbe } from './flambement';

const N_PAR_KN = 1000;

export const SOURCE_NCR_TF =
  'Theorie des barres a parois minces (Timoshenko et Gere ; NCCI SN001) — source bibliographique, HORS NORME (l EN 1993-1-1 ne donne pas N_cr,T ni N_cr,TF)';

/** Courbe de flambement, tableau 6.2 : L courbe b, U courbe c, tous axes et toutes nuances. */
export function courbeNonSymetrique(p: ProfilNonSymetrique): Courbe {
  return p.type === 'L' || p.type === '2L' ? 'b' : 'c';
}

export type ModeFlambement = 'flexion autour de y' | 'flexion autour de z' | 'flexion autour de v' | 'torsion ou flexion-torsion';

export interface FlambementNonSymetrique {
  mode: ModeFlambement;
  Lcr: number;
  N_cr: number;
  lambda_: number;
  /** Elancement efficace de l'annexe BB.1.2, si employe. */
  lambdaEff: number | null;
  courbe: Courbe;
  alpha: number;
  chi: number;
  Nb_Rd: number;
  motif: string;
}

export interface LongueursFlambement {
  /** Longueurs de flambement par flexion autour de y et z (mm). */
  Lcr_y: number;
  Lcr_z: number;
  /** Corniere seule : longueur autour de l'axe faible v (mm). */
  Lcr_v: number;
  /** Longueur de flambement par torsion (mm). */
  L_T: number;
  /**
   * Corniere de treillis assemblee par au moins deux boulons (annexe BB.1.2) :
   * lambda_eff,v = 0,35 + 0,7 lambda_v ; lambda_eff,y,z = 0,50 + 0,7 lambda_y,z.
   */
  barreDeTreillis: boolean;
}

/**
 * Charge critique du mode COUPLE de flexion-torsion (N). Les modes de flexion
 * purs sont verifies a part (§6.3.1.2) : ils sont retires de l'equation.
 *   - c_1 = c_2 = 0 (deux axes de symetrie) : pas de couplage, N_T ;
 *   - un seul axe de symetrie (c_2 = 0, resp. c_1 = 0) : la flexion autour
 *     de l'autre axe est decouplee ; plus petite racine de
 *     i_0^2 (N - N_1)(N - N_T) - N^2 c_1^2 = 0 (resp. avec N_2, c_2) ;
 *   - aucune symetrie : plus petite racine de la cubique.
 */
export function chargeCritiqueFlexionTorsion(N1: number, N2: number, NT: number, c1: number, c2: number, i02: number): number {
  // Seuil : la discretisation des arcs laisse un residu de l ordre de 1e-4 mm sur un axe de symetrie.
  const nul = (c: number): boolean => Math.abs(c) < 1e-3 * Math.sqrt(i02);
  let f: (N: number) => number;
  let hi: number;
  if (nul(c1) && nul(c2)) return NT;
  if (nul(c2)) {
    f = (N) => i02 * (N - N1) * (N - NT) - N * N * c1 * c1;
    hi = Math.min(N1, NT);
  } else if (nul(c1)) {
    f = (N) => i02 * (N - N2) * (N - NT) - N * N * c2 * c2;
    hi = Math.min(N2, NT);
  } else {
    // Cubique : f(0) < 0 et f(min) >= 0.
    f = (N) => -(i02 * (N - N1) * (N - N2) * (N - NT) - N * N * c2 * c2 * (N - N1) - N * N * c1 * c1 * (N - N2));
    hi = Math.min(N1, N2, NT);
  }
  // Second degre : f(0) = i_0^2 N_a N_T > 0 et f(min(N_a, N_T)) = -N^2 c^2 < 0.
  // Cubique (signe change ci-dessus) : meme allure. Dichotomie sur ]0 ; hi].
  let lo = 0;
  if (f(hi) >= 0) return hi;
  for (let k = 0; k < 200 && hi - lo > 1e-12 * Math.max(1, hi); k++) {
    const mid = (lo + hi) / 2;
    if (f(mid) > 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export interface TorsionFlexion {
  N_cr_T: number;
  N_cr_TF: number;
  i0: number;
}

/**
 * Charges critiques de torsion et de flexion-torsion (N), axes principaux.
 * Corniere seule : axes u, v, longueurs L_T pour les deux flexions couplees
 * (choix declare : la longueur d'un mode couple est celle de la barre).
 */
export function torsionFlexion(p: ProfilNonSymetrique, prop: Proprietes, L: LongueursFlambement): TorsionFlexion {
  exigerPositif(L.L_T, 'La longueur de flambement par torsion L_T', 'mm');
  let I1: number;
  let I2: number;
  let L1: number;
  let L2: number;
  let c1: number;
  let c2: number;
  if (p.type === 'L') {
    const ca = Math.cos(prop.alpha);
    const sa = Math.sin(prop.alpha);
    I1 = prop.Iu;
    I2 = prop.Iv;
    L1 = L.L_T;
    L2 = L.L_T;
    // Coordonnees du centre de cisaillement le long de u et v.
    c1 = prop.y0 * ca + prop.z0 * sa;
    c2 = -prop.y0 * sa + prop.z0 * ca;
  } else {
    I1 = prop.Iy;
    I2 = prop.Iz;
    L1 = L.Lcr_y;
    L2 = L.Lcr_z;
    // Axe 1 = y : le centre de cisaillement a la coordonnee y0 le long de y, z0 le long de z.
    c1 = prop.y0;
    c2 = prop.z0;
  }
  const i02 = (I1 + I2) / prop.A + c1 * c1 + c2 * c2;
  const N1 = (Math.PI ** 2 * E * I1) / (L1 * L1);
  const N2 = (Math.PI ** 2 * E * I2) / (L2 * L2);
  const NT = (G * prop.It + (Math.PI ** 2 * E * prop.Iw) / (L.L_T * L.L_T)) / i02;
  // La flexion autour d'un axe se couple a la torsion par la coordonnee du
  // centre de cisaillement le long de ce meme axe : pour un U symetrique par
  // rapport a y (c_2 = 0), N_2 reste decouple et N_1 se couple a N_T.
  return { N_cr_T: NT, N_cr_TF: chargeCritiqueFlexionTorsion(N1, N2, NT, c1, c2, i02), i0: Math.sqrt(i02) };
}

function mode(
  nom: ModeFlambement,
  Lcr: number,
  Ncr: number,
  Aref: number,
  m: Materiau,
  courbe: Courbe,
  eff: ((l: number) => number) | null,
  profil: ProfilEc3,
  motif: string
): FlambementNonSymetrique {
  const lambda_ = Math.sqrt((Aref * m.fy) / Ncr);
  const lambdaEff = eff === null ? null : eff(lambda_);
  const alpha = ALPHA[courbe];
  const { chi } = facteurReduction(lambdaEff ?? lambda_, alpha);
  return { mode: nom, Lcr, N_cr: Ncr / N_PAR_KN, lambda_, lambdaEff, courbe, alpha, chi, Nb_Rd: (chi * Aref * m.fy) / profil.gamma_M1.valeur / N_PAR_KN, motif };
}

/**
 * Tous les modes de flambement d'une barre comprimee. Classe 4 : A_eff dans
 * lambda et N_b,Rd (6.48), (6.50).
 */
export function flambementsNonSymetriques(
  p: ProfilNonSymetrique,
  m: Materiau,
  prop: Proprietes,
  classe: Classe,
  eff: SectionEfficace | null,
  L: LongueursFlambement,
  profil: ProfilEc3
): FlambementNonSymetrique[] {
  exigerPositif(L.Lcr_y, 'La longueur de flambement L_cr,y', 'mm');
  exigerPositif(L.Lcr_z, 'La longueur de flambement L_cr,z', 'mm');
  const Aref = classe === 4 && eff !== null ? eff.Aeff : prop.A;
  const courbe = courbeNonSymetrique(p);
  const treillis = L.barreDeTreillis && (p.type === 'L' || p.type === '2L');
  const bb = (a: number) => (l: number) => a + 0.7 * l;
  const res: FlambementNonSymetrique[] = [];
  const ncr = (I: number, Lcr: number): number => (Math.PI ** 2 * E * I) / (Lcr * Lcr);
  res.push(mode('flexion autour de y', L.Lcr_y, ncr(prop.Iy, L.Lcr_y), Aref, m, courbe, treillis ? bb(0.5) : null, profil, treillis ? 'annexe BB.1.2 : lambda_eff = 0,50 + 0,7 lambda' : `courbe ${courbe}`));
  res.push(mode('flexion autour de z', L.Lcr_z, ncr(prop.Iz, L.Lcr_z), Aref, m, courbe, treillis ? bb(0.5) : null, profil, treillis ? 'annexe BB.1.2 : lambda_eff = 0,50 + 0,7 lambda' : `courbe ${courbe}`));
  if (p.type === 'L') {
    exigerPositif(L.Lcr_v, 'La longueur de flambement L_cr,v', 'mm');
    res.push(mode('flexion autour de v', L.Lcr_v, ncr(prop.Iv, L.Lcr_v), Aref, m, courbe, treillis ? bb(0.35) : null, profil, treillis ? 'annexe BB.1.2 : lambda_eff = 0,35 + 0,7 lambda' : `courbe ${courbe}, axe faible`));
  }
  const tf = torsionFlexion(p, prop, L);
  const Ncr = Math.min(tf.N_cr_T, tf.N_cr_TF);
  res.push(
    mode(
      'torsion ou flexion-torsion',
      L.L_T,
      Ncr,
      Aref,
      m,
      courbe,
      null,
      profil,
      `N_cr,T = ${fr(tf.N_cr_T / N_PAR_KN, 0)} kN, N_cr,TF = ${fr(tf.N_cr_TF / N_PAR_KN, 0)} kN, i_0 = ${fr(tf.i0, 1)} mm, courbe ${courbe} ; HORS NORME`
    )
  );
  return res;
}
