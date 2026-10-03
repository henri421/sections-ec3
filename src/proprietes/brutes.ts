/**
 * Proprietes brutes des sections, recalculees a partir des seules
 * dimensions normalisees (h, b, t_w, t_f, r) : le catalogue ne stocke
 * aucune grandeur derivee.
 *
 * Unites : mm, mm2, mm3, mm4, mm6.
 *
 * Methode : integration par bandes de la largeur w(z) (flexion autour de y)
 * et de la hauteur d(y) (flexion autour de z), conges et angles arrondis
 * compris. Inertie de torsion des profils lamines par la formule usuelle
 * des catalogues, qui tient compte des conges.
 */

import type { Profil, ProfilDoublementSymetrique } from '../model/profil';
import { estDoublementSymetrique } from '../model/profil';
import { exigerPositif } from '../norms/profil';
import { proprietesNonSymetriques } from './formes';

export interface Proprietes {
  A: number;
  Iy: number;
  Iz: number;
  Wel_y: number;
  Wel_z: number;
  Wpl_y: number;
  Wpl_z: number;
  iy: number;
  iz: number;
  /** Inertie de torsion de Saint-Venant. */
  It: number;
  /** Inertie de gauchissement. */
  Iw: number;
  /** Aire d'ame h_w t_w des profils en I (mm2), 0 sinon. */
  Aw: number;
  /** Hauteur d'ame h_w = h - 2 t_f (mm), ou 0. */
  hw: number;
  /**
   * Centre de gravite dans le repere de construction du profil (mm) : 0 pour
   * les sections doublement symetriques, centrees.
   */
  yG: number;
  zG: number;
  /** Produit d'inertie au centre de gravite, int y z dA (mm4) : 0 si un axe est de symetrie. */
  Iyz: number;
  /** Direction de l'axe fort u, comptee de y vers z (rad). */
  alpha: number;
  Iu: number;
  Iv: number;
  iu: number;
  iv: number;
  /** Modules autour des axes principaux ; W_el est le module minimal. */
  Wel_u: number;
  Wel_v: number;
  Wpl_u: number;
  Wpl_v: number;
  /** Centre de cisaillement par rapport au centre de gravite (mm). */
  y0: number;
  z0: number;
  /** Provenance de I_t et I_w. */
  origineTorsion: string;
}

type ProprietesBase = Omit<Proprietes, 'yG' | 'zG' | 'Iyz' | 'alpha' | 'Iu' | 'Iv' | 'iu' | 'iv' | 'Wel_u' | 'Wel_v' | 'Wpl_u' | 'Wpl_v' | 'y0' | 'z0' | 'origineTorsion'>;

const ORIGINE_TORSION: Record<ProfilDoublementSymetrique['type'], string> = {
  'I-lamine': 'I_t : formule des catalogues de profils lamines (conges compris) ; I_w : semelles seules',
  'I-soude': 'I_t : parois minces ; I_w : semelles seules',
  'tube-rectangulaire': 'I_t : EN 10210-2 annexe B ; I_w nul',
  'tube-circulaire': 'I_t = 2 I ; I_w nul',
};

/** Proprietes de toute section : doublement symetrique (integration par bandes) ou non (contour). */
export function proprietes(p: Profil): Proprietes {
  if (estDoublementSymetrique(p)) {
    const b = symetriques(p);
    const fort = b.Iy >= b.Iz;
    return {
      ...b,
      yG: 0,
      zG: 0,
      Iyz: 0,
      alpha: fort ? 0 : Math.PI / 2,
      Iu: fort ? b.Iy : b.Iz,
      Iv: fort ? b.Iz : b.Iy,
      iu: fort ? b.iy : b.iz,
      iv: fort ? b.iz : b.iy,
      Wel_u: fort ? b.Wel_y : b.Wel_z,
      Wel_v: fort ? b.Wel_z : b.Wel_y,
      Wpl_u: fort ? b.Wpl_y : b.Wpl_z,
      Wpl_v: fort ? b.Wpl_z : b.Wpl_y,
      y0: 0,
      z0: 0,
      origineTorsion: ORIGINE_TORSION[p.type],
    };
  }
  const n = proprietesNonSymetriques(p);
  let hw = 0;
  let Aw = 0;
  if (p.type === 'U' || p.type === '2U') {
    const u = p.type === 'U' ? p : p.profilU;
    hw = u.h - 2 * u.tf;
    Aw = (p.type === 'U' ? 1 : 2) * hw * u.tw;
  }
  return {
    ...n,
    iy: Math.sqrt(n.Iy / n.A),
    iz: Math.sqrt(n.Iz / n.A),
    iu: Math.sqrt(n.Iu / n.A),
    iv: Math.sqrt(n.Iv / n.A),
    Aw,
    hw,
  };
}

const BANDES = 20000;

/** Retrait d'un conge de rayon r a la distance s de la face (0 <= s <= r). */
function conge(r: number, s: number): number {
  if (r <= 0 || s >= r) return 0;
  return r - Math.sqrt(r * r - (r - s) * (r - s));
}

/** Largeur d'un rectangle arrondi B x H (rayon R) a la cote z depuis le centre. */
function largeurArrondie(B: number, H: number, R: number, z: number): number {
  const a = Math.abs(z);
  if (a >= H / 2) return 0;
  const debut = H / 2 - R;
  if (a <= debut) return B;
  const dz = a - debut;
  return B - 2 * (R - Math.sqrt(Math.max(0, R * R - dz * dz)));
}

/** Integrales de la fonction de largeur w(u) sur [-H/2 ; H/2] : aire, inertie, module plastique. */
function integrer(w: (u: number) => number, H: number): { A: number; I: number; Wpl: number } {
  const du = H / BANDES;
  let A = 0;
  let I = 0;
  let S = 0;
  for (let k = 0; k < BANDES; k++) {
    const u = -H / 2 + (k + 0.5) * du;
    const dA = w(u) * du;
    A += dA;
    I += dA * u * u;
    S += dA * Math.abs(u);
  }
  // Section doublement symetrique : l'axe neutre plastique est l'axe de symetrie.
  return { A, I, Wpl: S };
}

/** Rayons d'angle des tubes rectangulaires : EN 10210-2 (chaud), EN 10219-2 (froid). */
export function rayonsTube(t: number, finition: 'chaud' | 'froid'): { ro: number; ri: number } {
  if (finition === 'chaud') return { ro: 1.5 * t, ri: t };
  const ro = t <= 6 ? 2 * t : t <= 10 ? 2.5 * t : 3 * t;
  return { ro, ri: ro - t };
}

function symetriques(p: ProfilDoublementSymetrique): ProprietesBase {
  if (p.type === 'tube-circulaire') {
    exigerPositif(p.d, 'Le diametre d', 'mm');
    exigerPositif(p.t, 'L epaisseur t', 'mm');
    if (2 * p.t >= p.d) throw new Error('L epaisseur depasse le rayon du tube (mm).');
    const di = p.d - 2 * p.t;
    const A = (Math.PI * (p.d ** 2 - di ** 2)) / 4;
    const I = (Math.PI * (p.d ** 4 - di ** 4)) / 64;
    const Wpl = (p.d ** 3 - di ** 3) / 6;
    const i = Math.sqrt(I / A);
    return { A, Iy: I, Iz: I, Wel_y: I / (p.d / 2), Wel_z: I / (p.d / 2), Wpl_y: Wpl, Wpl_z: Wpl, iy: i, iz: i, It: 2 * I, Iw: 0, Aw: 0, hw: 0 };
  }

  if (p.type === 'tube-rectangulaire') {
    for (const [v, n] of [[p.h, 'h'], [p.b, 'b'], [p.t, 't']] as const) exigerPositif(v, `La dimension ${n}`, 'mm');
    if (2 * p.t >= Math.min(p.h, p.b)) throw new Error('L epaisseur depasse la demi-dimension du tube (mm).');
    const { ro, ri } = rayonsTube(p.t, p.finition);
    const hi = p.h - 2 * p.t;
    const bi = p.b - 2 * p.t;
    const wy = (z: number): number => largeurArrondie(p.b, p.h, ro, z) - largeurArrondie(bi, hi, ri, z);
    const wz = (y: number): number => largeurArrondie(p.h, p.b, ro, y) - largeurArrondie(hi, bi, ri, y);
    const y = integrer(wy, p.h);
    const z = integrer(wz, p.b);
    // Torsion, EN 10210-2 annexe B : It = t^3 p / 3 + 2 K A_m.
    const Rc = (ro + ri) / 2;
    const Am = (p.b - p.t) * (p.h - p.t) - Rc * Rc * (4 - Math.PI);
    const per = 2 * (p.b - p.t + (p.h - p.t)) - 2 * Rc * (4 - Math.PI);
    const K = (2 * Am * p.t) / per;
    return {
      A: y.A,
      Iy: y.I,
      Iz: z.I,
      Wel_y: y.I / (p.h / 2),
      Wel_z: z.I / (p.b / 2),
      Wpl_y: y.Wpl,
      Wpl_z: z.Wpl,
      iy: Math.sqrt(y.I / y.A),
      iz: Math.sqrt(z.I / z.A),
      It: (p.t ** 3 * per) / 3 + 2 * K * Am,
      Iw: 0,
      Aw: 0,
      hw: 0,
    };
  }

  // Profils en I doublement symetriques.
  for (const [v, n] of [[p.h, 'h'], [p.b, 'b'], [p.tw, 't_w'], [p.tf, 't_f']] as const) exigerPositif(v, `La dimension ${n}`, 'mm');
  const r = p.type === 'I-lamine' ? p.r : 0;
  if (2 * p.tf + 2 * r >= p.h) throw new Error('Semelles et conges depassent la hauteur du profil (mm).');
  if (p.tw + 2 * r >= p.b) throw new Error('Ame et conges depassent la largeur du profil (mm).');
  const interieur = p.h / 2 - p.tf;
  const wy = (z: number): number => {
    const a = Math.abs(z);
    if (a > interieur) return p.b;
    return p.tw + 2 * conge(r, interieur - a);
  };
  const wz = (y: number): number => {
    const a = Math.abs(y);
    if (a <= p.tw / 2) return p.h;
    return 2 * p.tf + 2 * conge(r, a - p.tw / 2);
  };
  const y = integrer(wy, p.h);
  const z = integrer(wz, p.b);
  let It: number;
  if (p.type === 'I-lamine') {
    // Formule des catalogues de profils lamines (Euronorm, conges compris) :
    // It = 2/3 (b - 0,63 tf) tf^3 + 1/3 (h - 2 tf) tw^3 + 2 (tw/tf)(0,145 + 0,1 r/tf) D^4,
    // D = ((r + tw/2)^2 + (r + tf)^2 - r^2) / (2 r + tf).
    const { b, h, tw, tf } = p;
    const D = ((r + tw / 2) ** 2 + (r + tf) ** 2 - r * r) / (2 * r + tf);
    It = (2 / 3) * (b - 0.63 * tf) * tf ** 3 + ((h - 2 * tf) * tw ** 3) / 3 + 2 * (tw / tf) * (0.145 + (0.1 * r) / tf) * D ** 4;
  } else {
    It = (2 * p.b * p.tf ** 3 + (p.h - 2 * p.tf) * p.tw ** 3) / 3;
  }
  const hw = p.h - 2 * p.tf;
  return {
    A: y.A,
    Iy: y.I,
    Iz: z.I,
    Wel_y: y.I / (p.h / 2),
    Wel_z: z.I / (p.b / 2),
    Wpl_y: y.Wpl,
    Wpl_z: z.Wpl,
    iy: Math.sqrt(y.I / y.A),
    iz: Math.sqrt(z.I / z.A),
    It,
    // Gauchissement par les seules semelles, comme les catalogues : tf b^3 (h - tf)^2 / 24.
    Iw: (p.tf * p.b ** 3 * (p.h - p.tf) ** 2) / 24,
    Aw: hw * p.tw,
    hw,
  };
}
