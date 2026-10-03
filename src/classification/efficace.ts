/**
 * Section efficace des sections de classe 4, EN 1993-1-5 §4.4, pour les
 * cornieres, les U, et les profils composes 2L et 2U.
 *
 * Unites : mm, mm2, mm4, mm3, MPa.
 *
 * CHOIX CONSERVATIF DECLARE : une section efficace unique, calculee avec
 * toutes les parois en COMPRESSION UNIFORME (psi = 1), sert a la fois a
 * l'effort normal et a la flexion. Sous un gradient, les largeurs efficaces
 * seraient plus grandes et les parois tendues entierement efficaces : ce
 * choix les sous-estime, il ne les surestime jamais.
 *
 *   paroi interne  : k_sigma = 4,    rho = (lambda_p - 0,22) / lambda_p^2   si lambda_p > 0,673 (4.2)
 *   paroi en console : k_sigma = 0,43, rho = (lambda_p - 0,188) / lambda_p^2 si lambda_p > 0,748 (4.3)
 *   lambda_p = (b_barre / t) / (28,4 epsilon sqrt(k_sigma))
 *
 * Largeur de reference b_barre : largeur plate c du tableau 5.2 pour l'ame
 * et les ailes des U ; AILE ENTIERE pour les cornieres, convention du
 * producteur (ses A_eff publies sont retrouves a 0,1 % pres), plus severe
 * que la largeur plate.
 *
 * Partie non efficace : extremite libre d'une console, milieu d'une paroi
 * interne (tableaux 4.1 et 4.2). Elle est retranchee du contour brut ; le
 * decalage du centre de gravite e_N en resulte.
 */

import type { Materiau, ProfilL, ProfilU } from '../model/profil';
import { epaisseurAileRacine, epsilon } from '../model/profil';
import { fr } from '../norms/profil';
import { axesPrincipaux, couper, deplacer, distancesExtremes, inertieAxe, integrales, symetriqueY, type Point } from '../proprietes/contour';
import { contourU, contours, corniereOrientee, type ProfilNonSymetrique } from '../proprietes/formes';

export type TypeParoi = 'interne' | 'console';

export interface ParoiEfficace {
  paroi: string;
  type: TypeParoi;
  bBarre: number;
  t: number;
  kSigma: number;
  lambdaP: number;
  rho: number;
}

export interface SectionEfficace {
  Aeff: number;
  /** Decalage du centre de gravite efficace par rapport au brut (mm). */
  eNy: number;
  eNz: number;
  Ieff_y: number;
  Ieff_z: number;
  Ieff_u: number;
  Ieff_v: number;
  /** Modules efficaces minimaux, fibres extremes de la section brute (mm3). */
  Weff_y: number;
  Weff_z: number;
  Weff_u: number;
  Weff_v: number;
  parois: ParoiEfficace[];
  motif: string;
}

const K_SIGMA: Record<TypeParoi, number> = { interne: 4, console: 0.43 };

/** rho des expressions (4.2) et (4.3), compression uniforme (psi = 1). */
export function facteurRho(type: TypeParoi, lambdaP: number): number {
  if (type === 'interne') return lambdaP <= 0.673 ? 1 : Math.min(1, (lambdaP - 0.22) / (lambdaP * lambdaP));
  return lambdaP <= 0.748 ? 1 : Math.min(1, (lambdaP - 0.188) / (lambdaP * lambdaP));
}

function paroi(nom: string, type: TypeParoi, bBarre: number, t: number, eps: number): ParoiEfficace {
  const kSigma = K_SIGMA[type];
  const lambdaP = bBarre / t / (28.4 * eps * Math.sqrt(kSigma));
  return { paroi: nom, type, bBarre, t, kSigma, lambdaP, rho: facteurRho(type, lambdaP) };
}

function rectangle(y0: number, y1: number, z0: number, z1: number): Point[] {
  return [
    [y0, z0],
    [y1, z0],
    [y1, z1],
    [y0, z1],
  ];
}

/** Partie du contour dans l'intersection de demi-plans n.p >= c. */
function decoupe(poly: readonly Point[], demiPlans: Array<[number, number, number]>): Point[] {
  return demiPlans.reduce<Point[]>((acc, [ny, nz, c]) => couper(acc, ny, nz, c), [...poly]);
}

/**
 * Parties non efficaces d'une corniere, talon a l'origine : le RECTANGLE
 * (1 - rho) b_barre x t a l'extremite de chaque aile, arrondi de rive compris
 * — convention du producteur, qui retire un peu plus que la matiere reelle.
 */
function retraitsL(c: ProfilL, eps: number, prefixe: string): { parois: ParoiEfficace[]; retraits: Point[][] } {
  const ph = paroi(`${prefixe}aile h`, 'console', c.h, c.t, eps);
  const pb = paroi(`${prefixe}aile b`, 'console', c.b, c.t, eps);
  const retraits: Point[][] = [];
  if (ph.rho < 1) retraits.push(rectangle(0, c.t, ph.rho * c.h, c.h));
  if (pb.rho < 1) retraits.push(rectangle(pb.rho * c.b, c.b, 0, c.t));
  return { parois: [ph, pb], retraits };
}

/** Parties non efficaces d'un U, dos de l'ame sur y = 0. */
function retraitsU(u: ProfilU, eps: number): { parois: ParoiEfficace[]; retraits: Point[][] } {
  const brut = contourU(u);
  const cAme = u.h - 2 * epaisseurAileRacine(u) - 2 * u.r1;
  const cAile = u.b - u.tw - u.r1;
  const pa = paroi('ame', 'interne', cAme, u.tw, eps);
  const pf = paroi('ailes', 'console', cAile, u.tf, eps);
  const retraits: Point[][] = [];
  if (pa.rho < 1) {
    const d = ((1 - pa.rho) * cAme) / 2;
    retraits.push(decoupe(brut, [[0, 1, -d], [0, -1, -d], [-1, 0, -u.tw]]));
  }
  if (pf.rho < 1) {
    const y0 = u.b - (1 - pf.rho) * cAile;
    retraits.push(decoupe(brut, [[1, 0, y0], [0, 1, 0]]), decoupe(brut, [[1, 0, y0], [0, -1, 0]]));
  }
  return { parois: [pa, pf], retraits };
}

function retraits(p: ProfilNonSymetrique, eps: number): { parois: ParoiEfficace[]; retraits: Point[][] } {
  switch (p.type) {
    case 'L':
      return retraitsL(p, eps, '');
    case 'U':
      return retraitsU(p, eps);
    case '2L': {
      const r = retraitsL(corniereOrientee(p.corniere, p.accolee), eps, 'corniere, ');
      const droite = r.retraits.map((x) => deplacer(x, p.ecartement / 2, 0));
      return { parois: r.parois, retraits: [...droite, ...droite.map(symetriqueY)] };
    }
    case '2U': {
      const r = retraitsU(p.profilU, eps);
      const droite = r.retraits.map((x) => deplacer(x, p.ecartement / 2, 0));
      return { parois: r.parois, retraits: [...droite, ...droite.map(symetriqueY)] };
    }
  }
}

export function sectionEfficace(p: ProfilNonSymetrique, m: Materiau): SectionEfficace {
  const eps = epsilon(m.fy);
  const brut = contours(p);
  const gB = integrales(brut);
  const alpha = axesPrincipaux(gB).alpha;
  const r = retraits(p, eps);
  // Un contour parcouru a l'envers retranche ses integrales.
  const g = integrales([...brut, ...r.retraits.map((x) => [...x].reverse())]);
  const w = (theta: number, I: number): number => {
    const d = distancesExtremes(brut, g, theta);
    return I / Math.max(d.dPlus, d.dMoins);
  };
  const Iu = inertieAxe(g, alpha);
  const Iv = inertieAxe(g, alpha + Math.PI / 2);
  const reduites = r.parois.filter((x) => x.rho < 1);
  return {
    Aeff: g.A,
    eNy: g.yG - gB.yG,
    eNz: g.zG - gB.zG,
    Ieff_y: g.Iy,
    Ieff_z: g.Iz,
    Ieff_u: Iu,
    Ieff_v: Iv,
    Weff_y: w(0, g.Iy),
    Weff_z: w(Math.PI / 2, g.Iz),
    Weff_u: w(alpha, Iu),
    Weff_v: w(alpha + Math.PI / 2, Iv),
    parois: r.parois,
    motif:
      reduites.length === 0
        ? 'toutes les parois sont entierement efficaces (lambda_p sous le seuil)'
        : `parois reduites (compression uniforme, EN 1993-1-5 §4.4) : ${reduites.map((x) => `${x.paroi} rho = ${fr(x.rho, 3)}`).join(' ; ')} ; A_eff / A = ${fr(g.A / gB.A, 3)}`,
  };
}
