/**
 * Moteur geometrique general : proprietes d'une section decrite par un ou
 * plusieurs contours polygonaux (profils non symetriques, profils composes).
 *
 * Unites : mm, mm2, mm3, mm4.
 *
 * Methode : conges et arrondis de rive remplaces par des arcs discretises
 * (`arrondir`), puis integrales exactes du polygone par la formule de Green.
 * Le module plastique cherche l'axe neutre plastique (aire egale de part et
 * d'autre) par decoupage du polygone, sans supposer de symetrie.
 *
 * Repere : y horizontal, z vertical ; un axe de direction theta (radians,
 * compte de y vers z) passe par le centre de gravite sauf mention.
 */

export type Point = readonly [number, number];

/** Sommet d'un contour, avec le rayon d'arrondi eventuel a ce sommet (mm). */
export interface Sommet {
  y: number;
  z: number;
  r?: number;
}

/** Segments par quart de cercle : l'erreur d'aire d'un conge est alors sous 0,1 %. */
const SEGMENTS_QUART = 24;

/**
 * Remplace chaque sommet arrondi par un arc tangent aux deux aretes voisines,
 * angle saillant (arrondi de rive) comme rentrant (conge).
 */
export function arrondir(sommets: readonly Sommet[]): Point[] {
  const n = sommets.length;
  const res: Point[] = [];
  for (let i = 0; i < n; i++) {
    const P = sommets[i];
    const r = P.r ?? 0;
    if (r <= 0) {
      res.push([P.y, P.z]);
      continue;
    }
    const A = sommets[(i + n - 1) % n];
    const B = sommets[(i + 1) % n];
    const l1 = Math.hypot(A.y - P.y, A.z - P.z);
    const l2 = Math.hypot(B.y - P.y, B.z - P.z);
    const u1: Point = [(A.y - P.y) / l1, (A.z - P.z) / l1];
    const u2: Point = [(B.y - P.y) / l2, (B.z - P.z) / l2];
    const demi = Math.acos(Math.max(-1, Math.min(1, u1[0] * u2[0] + u1[1] * u2[1]))) / 2;
    const d = r / Math.tan(demi);
    if (d > l1 + 1e-9 || d > l2 + 1e-9) throw new Error(`Rayon ${r} mm trop grand pour le sommet (${P.y} ; ${P.z}).`);
    const bis: Point = [u1[0] + u2[0], u1[1] + u2[1]];
    const lb = Math.hypot(bis[0], bis[1]);
    const C: Point = [P.y + (bis[0] / lb) * (r / Math.sin(demi)), P.z + (bis[1] / lb) * (r / Math.sin(demi))];
    const T1: Point = [P.y + u1[0] * d, P.z + u1[1] * d];
    const T2: Point = [P.y + u2[0] * d, P.z + u2[1] * d];
    const a1 = Math.atan2(T1[1] - C[1], T1[0] - C[0]);
    let da = Math.atan2(T2[1] - C[1], T2[0] - C[0]) - a1;
    if (da > Math.PI) da -= 2 * Math.PI;
    if (da < -Math.PI) da += 2 * Math.PI;
    const k = Math.max(2, Math.ceil((Math.abs(da) / (Math.PI / 2)) * SEGMENTS_QUART));
    for (let j = 0; j <= k; j++) {
      const a = a1 + (da * j) / k;
      res.push([C[0] + r * Math.cos(a), C[1] + r * Math.sin(a)]);
    }
  }
  return res;
}

/** Translation d'un contour. */
export function deplacer(poly: readonly Point[], dy: number, dz: number): Point[] {
  return poly.map(([y, z]) => [y + dy, z + dz] as Point);
}

/** Symetrie d'un contour par rapport a l'axe z (y -> -y), sens de parcours retabli. */
export function symetriqueY(poly: readonly Point[]): Point[] {
  return poly.map(([y, z]) => [-y, z] as Point).reverse();
}

export interface Integrales {
  A: number;
  /** Centre de gravite (mm). */
  yG: number;
  zG: number;
  /** Moments quadratiques au centre de gravite, axes paralleles a y et z : I_y = int z2, I_z = int y2, I_yz = int y z (mm4). */
  Iy: number;
  Iz: number;
  Iyz: number;
}

/** Integrales brutes d'un ensemble de contours (sens trigonometrique positif), origine du repere. */
function brutes(polys: readonly (readonly Point[])[]): { A: number; Sy: number; Sz: number; Iyy: number; Izz: number; Iyz: number } {
  let A = 0;
  let Sy = 0;
  let Sz = 0;
  let Iyy = 0;
  let Izz = 0;
  let Iyz = 0;
  for (const p of polys) {
    const n = p.length;
    for (let i = 0; i < n; i++) {
      const [y0, z0] = p[i];
      const [y1, z1] = p[(i + 1) % n];
      const c = y0 * z1 - y1 * z0;
      A += c / 2;
      Sy += ((y0 + y1) * c) / 6;
      Sz += ((z0 + z1) * c) / 6;
      Iyy += ((z0 * z0 + z0 * z1 + z1 * z1) * c) / 12;
      Izz += ((y0 * y0 + y0 * y1 + y1 * y1) * c) / 12;
      Iyz += ((y0 * z1 + 2 * y0 * z0 + 2 * y1 * z1 + y1 * z0) * c) / 24;
    }
  }
  return { A, Sy, Sz, Iyy, Izz, Iyz };
}

export function integrales(polys: readonly (readonly Point[])[]): Integrales {
  const b = brutes(polys);
  if (!(b.A > 0)) throw new Error('Contour d aire nulle ou parcouru dans le mauvais sens.');
  const yG = b.Sy / b.A;
  const zG = b.Sz / b.A;
  return { A: b.A, yG, zG, Iy: b.Iyy - b.A * zG * zG, Iz: b.Izz - b.A * yG * yG, Iyz: b.Iyz - b.A * yG * zG };
}

/** Moment quadratique autour de l'axe de direction theta passant par G (mm4). */
export function inertieAxe(g: Integrales, theta: number): number {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return g.Iy * c * c + g.Iz * s * s - 2 * g.Iyz * s * c;
}

export interface AxesPrincipaux {
  /** Direction de l'axe fort u, comptee de y vers z (rad), dans ]-pi/2 ; pi/2]. */
  alpha: number;
  Iu: number;
  Iv: number;
}

export function axesPrincipaux(g: Integrales): AxesPrincipaux {
  const m = (g.Iy + g.Iz) / 2;
  const R = Math.hypot((g.Iy - g.Iz) / 2, g.Iyz);
  return { alpha: 0.5 * Math.atan2(-2 * g.Iyz, g.Iy - g.Iz), Iu: m + R, Iv: m - R };
}

/** Distances extremes des sommets a l'axe theta passant par G, de chaque cote (mm, positives). */
export function distancesExtremes(polys: readonly (readonly Point[])[], g: Integrales, theta: number): { dPlus: number; dMoins: number } {
  const ny = -Math.sin(theta);
  const nz = Math.cos(theta);
  let dPlus = 0;
  let dMoins = 0;
  for (const p of polys) {
    for (const [y, z] of p) {
      const d = ny * (y - g.yG) + nz * (z - g.zG);
      dPlus = Math.max(dPlus, d);
      dMoins = Math.max(dMoins, -d);
    }
  }
  return { dPlus, dMoins };
}

/** Partie d'un contour du cote n.p >= c (Sutherland-Hodgman ; exact pour les integrales, meme non convexe). */
export function couper(poly: readonly Point[], ny: number, nz: number, c: number): Point[] {
  const res: Point[] = [];
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const P = poly[i];
    const Q = poly[(i + 1) % n];
    const dp = ny * P[0] + nz * P[1] - c;
    const dq = ny * Q[0] + nz * Q[1] - c;
    if (dp >= 0) res.push(P);
    if ((dp >= 0) !== (dq >= 0)) {
      const t = dp / (dp - dq);
      res.push([P[0] + t * (Q[0] - P[0]), P[1] + t * (Q[1] - P[1])]);
    }
  }
  return res;
}

export interface Plastique {
  Wpl: number;
  /** Position de l'axe neutre plastique : distance signee depuis G le long de la normale (mm). */
  decalage: number;
}

/**
 * Module plastique autour d'un axe de direction theta : l'axe neutre
 * plastique, parallele, partage l'aire en deux moities egales (dichotomie) ;
 * W_pl = somme des moments statiques des deux moities par rapport a lui.
 */
export function modulePlastique(polys: readonly (readonly Point[])[], g: Integrales, theta: number): Plastique {
  const ny = -Math.sin(theta);
  const nz = Math.cos(theta);
  const { dPlus, dMoins } = distancesExtremes(polys, g, theta);
  const c0 = ny * g.yG + nz * g.zG;
  const aireAuDessus = (c: number): number => brutes(polys.map((p) => couper(p, ny, nz, c))).A;
  let lo = c0 - dMoins;
  let hi = c0 + dPlus;
  for (let k = 0; k < 100 && hi - lo > 1e-9; k++) {
    const mid = (lo + hi) / 2;
    if (aireAuDessus(mid) > g.A / 2) lo = mid;
    else hi = mid;
  }
  const c = (lo + hi) / 2;
  const dessus = brutes(polys.map((p) => couper(p, ny, nz, c)));
  const dessous = brutes(polys.map((p) => couper(p, -ny, -nz, -c)));
  // Moment statique par rapport a l'axe n.p = c : int (n.p - c) dA.
  const moment = (b: ReturnType<typeof brutes>): number => ny * b.Sy + nz * b.Sz - c * b.A;
  return { Wpl: Math.abs(moment(dessus)) + Math.abs(moment(dessous)), decalage: c - c0 };
}
