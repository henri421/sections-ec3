/**
 * Contours et proprietes des profils non doublement symetriques : cornieres
 * (L), profils en U, et profils composes 2L et 2U dos a dos.
 *
 * Unites : mm, mm2, mm3, mm4, mm6.
 *
 * A, centre de gravite, inerties, axes principaux, W_el et W_pl sont
 * RECALCULES sur le contour (moteur `contour`). I_t et I_w des profils
 * lamines sont ceux PUBLIES par le producteur, faute d'expression fermee
 * fiable pour ces formes : les formules usuelles s'ecartent de -20 a +17 %
 * des valeurs publiees, et une surestimation serait non conservative pour la
 * flexion-torsion et le deversement. La provenance est rendue.
 */

import type { Profil, ProfilL, ProfilU } from '../model/profil';
import { epaisseurAileRacine } from '../model/profil';
import { exigerPositif, exigerPositifOuNul } from '../norms/profil';
import { arrondir, axesPrincipaux, deplacer, distancesExtremes, integrales, modulePlastique, symetriqueY, type Point, type Sommet } from './contour';

export type ProfilNonSymetrique = Extract<Profil, { type: 'L' | 'U' | '2L' | '2U' }>;

/**
 * Contour d'une corniere, talon a l'origine. Un rayon de rive superieur a
 * l'epaisseur (petites cornieres du catalogue) est borne a l'epaisseur :
 * l'arc ne peut pas etre tangent aux deux faces au-dela.
 */
export function contourL(c: ProfilL): Point[] {
  for (const [v, n] of [[c.h, 'h'], [c.b, 'b'], [c.t, 't']] as const) exigerPositif(v, `La dimension ${n} de la corniere`, 'mm');
  if (c.t + c.r1 >= Math.min(c.h, c.b)) throw new Error('Epaisseur et conge depassent les ailes de la corniere (mm).');
  const r2 = Math.min(c.r2, c.t);
  const s: Sommet[] = [
    { y: 0, z: 0 },
    { y: c.b, z: 0 },
    { y: c.b, z: c.t, r: r2 },
    { y: c.t, z: c.t, r: c.r1 },
    { y: c.t, z: c.h, r: r2 },
    { y: 0, z: c.h },
  ];
  return arrondir(s);
}

/**
 * Contour d'un U, dos de l'ame sur y = 0, symetrique par rapport a y. La
 * face interieure des ailes a la pente `pente`, l'epaisseur valant t_f a
 * l'abscisse yTf.
 */
export function contourU(u: ProfilU): Point[] {
  for (const [v, n] of [[u.h, 'h'], [u.b, 'b'], [u.tw, 't_w'], [u.tf, 't_f']] as const) exigerPositif(v, `La dimension ${n} du profil en U`, 'mm');
  const ep = (y: number): number => u.tf + u.pente * (u.yTf - y);
  if (2 * ep(u.tw) + 2 * u.r1 >= u.h) throw new Error('Ailes et conges depassent la hauteur du profil en U (mm).');
  if (u.tw + u.r1 >= u.b) throw new Error('Ame et conge depassent la largeur du profil en U (mm).');
  const h2 = u.h / 2;
  const s: Sommet[] = [
    { y: 0, z: -h2 },
    { y: u.b, z: -h2 },
    { y: u.b, z: -h2 + ep(u.b), r: u.r2 },
    { y: u.tw, z: -h2 + ep(u.tw), r: u.r1 },
    { y: u.tw, z: h2 - ep(u.tw), r: u.r1 },
    { y: u.b, z: h2 - ep(u.b), r: u.r2 },
    { y: u.b, z: h2 },
    { y: 0, z: h2 },
  ];
  return arrondir(s);
}

/** Corniere orientee pour un 2L : l'aile accolee devient l'aile verticale h. */
export function corniereOrientee(c: ProfilL, accolee: 'h' | 'b'): ProfilL {
  return accolee === 'h' ? c : { ...c, h: c.b, b: c.h };
}

/** Contours d'un profil, dans son repere de construction. */
export function contours(p: ProfilNonSymetrique): Point[][] {
  switch (p.type) {
    case 'L':
      return [contourL(p)];
    case 'U':
      return [contourU(p)];
    case '2L': {
      exigerPositifOuNul(p.ecartement, 'L ecartement des cornieres', 'mm');
      const droite = deplacer(contourL(corniereOrientee(p.corniere, p.accolee)), p.ecartement / 2, 0);
      return [droite, symetriqueY(droite)];
    }
    case '2U': {
      exigerPositifOuNul(p.ecartement, 'L ecartement des profils en U', 'mm');
      const droite = deplacer(contourU(p.profilU), p.ecartement / 2, 0);
      return [droite, symetriqueY(droite)];
    }
  }
}

/**
 * Excentricite du centre de cisaillement d'un U par la theorie des parois
 * minces, e_0 = b'^2 h'^2 t_f / (4 I_y), depuis le plan moyen de l'ame
 * (b' = b - t_w/2, h' = h - t_f, t_f moyen pour un UPN). Recoupe le e_0
 * publie a 0,4 % pres pour les UPE, a 12 % pres seulement pour les petits
 * UPN : la valeur publiee lui est preferee quand elle existe.
 */
export function excentriciteCisaillementU(u: ProfilU, IyCentre: number): number {
  const tfMoy = (u.tf + (u.tf + u.pente * (u.yTf - u.b)) + epaisseurAileRacine(u)) / 3;
  const bp = u.b - u.tw / 2;
  const hp = u.h - tfMoy;
  return (bp * bp * hp * hp * tfMoy) / (4 * IyCentre);
}

export interface Torsion {
  It: number;
  Iw: number;
  /** Centre de cisaillement dans le repere de construction (mm). */
  yC: number;
  zC: number;
  origine: string;
}

const SOURCE_PRODUCTEUR = 'valeur publiee par le producteur (catalogue)';

/**
 * I_t, I_w et centre de cisaillement.
 *   L  : centre a l'intersection des lignes moyennes des ailes ; I_w des
 *        parois minces (t^3/36)(b'^3 + h'^3), tres faible ; I_t publie, sinon
 *        (h + b - t) t^3 / 3, expression MINORANTE (-2 a -22 % des valeurs
 *        publiees), du cote de la securite.
 *   U  : centre sur l'axe de symetrie, a e_0 du plan moyen de l'ame, cote
 *        dos (publie, sinon parois minces) ; I_t et I_w publies, EXIGES.
 *   2L : centre sur l'axe de symetrie, a la ligne moyenne des ailes
 *        horizontales ; I_t et I_w sommes des deux cornieres.
 *   2U : centre au centre de gravite ; I_t et I_w sommes des deux profils —
 *        le gauchissement d'ensemble n'est pas compte, les ailes n'etant
 *        liees que ponctuellement (du cote de la securite).
 */
export function torsion(p: ProfilNonSymetrique, IyCentre: number): Torsion {
  switch (p.type) {
    case 'L': {
      const It = p.It ?? ((p.h + p.b - p.t) * p.t ** 3) / 3;
      const bp = p.b - p.t / 2;
      const hp = p.h - p.t / 2;
      return {
        It,
        Iw: (p.t ** 3 / 36) * (bp ** 3 + hp ** 3),
        yC: p.t / 2,
        zC: p.t / 2,
        origine: `I_t : ${p.It !== undefined ? SOURCE_PRODUCTEUR : '(h + b - t) t^3 / 3, expression minorante'} ; I_w : parois minces (t^3/36)(b'^3 + h'^3)`,
      };
    }
    case 'U': {
      if (p.It === undefined || p.Iw === undefined) {
        throw new Error(`Profil en U « ${p.nom} » : I_t et I_w publies requis (aucune expression fermee fiable pour un U).`);
      }
      const e0 = p.e0 ?? excentriciteCisaillementU(p, IyCentre);
      return {
        It: p.It,
        Iw: p.Iw,
        yC: p.tw / 2 - e0,
        zC: 0,
        origine: `I_t, I_w : ${SOURCE_PRODUCTEUR} ; centre de cisaillement : ${p.e0 !== undefined ? SOURCE_PRODUCTEUR : 'theorie des parois minces'}`,
      };
    }
    case '2L': {
      const c = corniereOrientee(p.corniere, p.accolee);
      const t1 = torsion(c, 0);
      return { It: 2 * t1.It, Iw: 2 * t1.Iw, yC: 0, zC: c.t / 2, origine: `somme des deux cornieres (${t1.origine})` };
    }
    case '2U': {
      const g = integrales([contourU(p.profilU)]);
      const t1 = torsion(p.profilU, g.Iy);
      return { It: 2 * t1.It, Iw: 2 * t1.Iw, yC: 0, zC: 0, origine: `somme des deux profils, gauchissement d ensemble non compte (${t1.origine})` };
    }
  }
}

export interface ProprietesNonSymetriques {
  A: number;
  yG: number;
  zG: number;
  Iy: number;
  Iz: number;
  Iyz: number;
  alpha: number;
  Iu: number;
  Iv: number;
  /** Modules elastiques minimaux (fibre la plus eloignee) (mm3). */
  Wel_y: number;
  Wel_z: number;
  Wel_u: number;
  Wel_v: number;
  Wpl_y: number;
  Wpl_z: number;
  Wpl_u: number;
  Wpl_v: number;
  It: number;
  Iw: number;
  /** Centre de cisaillement par rapport au centre de gravite (mm). */
  y0: number;
  z0: number;
  origineTorsion: string;
}

function welMin(polys: Point[][], g: ReturnType<typeof integrales>, theta: number, I: number): number {
  const d = distancesExtremes(polys, g, theta);
  return I / Math.max(d.dPlus, d.dMoins);
}

export function proprietesNonSymetriques(p: ProfilNonSymetrique): ProprietesNonSymetriques {
  const polys = contours(p);
  const g = integrales(polys);
  const ax = axesPrincipaux(g);
  const t = torsion(p, g.Iy);
  return {
    A: g.A,
    yG: g.yG,
    zG: g.zG,
    Iy: g.Iy,
    Iz: g.Iz,
    Iyz: g.Iyz,
    alpha: ax.alpha,
    Iu: ax.Iu,
    Iv: ax.Iv,
    Wel_y: welMin(polys, g, 0, g.Iy),
    Wel_z: welMin(polys, g, Math.PI / 2, g.Iz),
    Wel_u: welMin(polys, g, ax.alpha, ax.Iu),
    Wel_v: welMin(polys, g, ax.alpha + Math.PI / 2, ax.Iv),
    Wpl_y: modulePlastique(polys, g, 0).Wpl,
    Wpl_z: modulePlastique(polys, g, Math.PI / 2).Wpl,
    Wpl_u: modulePlastique(polys, g, ax.alpha).Wpl,
    Wpl_v: modulePlastique(polys, g, ax.alpha + Math.PI / 2).Wpl,
    It: t.It,
    Iw: t.Iw,
    y0: t.yC - g.yG,
    z0: t.zC - g.zG,
    origineTorsion: t.origine,
  };
}
