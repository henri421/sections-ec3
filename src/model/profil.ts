/**
 * Geometrie des profils et materiau.
 *
 * Unites : mm, MPa.
 *
 * Le profil ne porte AUCUNE classe : la classe depend du couple profil et
 * sollicitation (`classifier`). Un catalogue qui annoncerait « IPE 300
 * classe 1 » serait faux des que l'effort normal devient significatif.
 */

export type Profil =
  | {
      type: 'I-lamine';
      nom: string;
      h: number;
      b: number;
      tw: number;
      tf: number;
      /** Rayon de conge (mm). */
      r: number;
    }
  | {
      type: 'I-soude';
      nom: string;
      h: number;
      b: number;
      tw: number;
      tf: number;
      /** Gorge des cordons ame-semelle a (mm). */
      a: number;
    }
  | {
      type: 'tube-rectangulaire';
      nom: string;
      h: number;
      b: number;
      t: number;
      /** Finition, qui fixe les rayons d'angle et la courbe de flambement. */
      finition: 'chaud' | 'froid';
    }
  | {
      type: 'tube-circulaire';
      nom: string;
      d: number;
      t: number;
      finition: 'chaud' | 'froid';
    };

export type Nuance = 'S235' | 'S275' | 'S355' | 'S420' | 'S460';

export interface Materiau {
  nuance: Nuance;
  fy: number;
  fu: number;
  /** Epaisseur qui a fixe fy et fu (mm). */
  epaisseur: number;
}

/** Module d'elasticite E et module de cisaillement G, §3.2.6 (MPa). */
export const E = 210000;
export const G = 81000;

/** EN 1993-1-1 tableau 3.1 : [fy, fu] pour t <= 40 mm et 40 < t <= 80 mm. */
const TABLEAU_3_1: Record<Nuance, [[number, number], [number, number]]> = {
  S235: [[235, 360], [215, 360]],
  S275: [[275, 430], [255, 410]],
  S355: [[355, 510], [335, 470]],
  S420: [[420, 520], [390, 520]],
  S460: [[460, 540], [430, 540]],
};

/** Epaisseur gouvernant fy : la plus forte paroi (mm). */
export function epaisseurMax(p: Profil): number {
  if (p.type === 'I-lamine' || p.type === 'I-soude') return Math.max(p.tf, p.tw);
  return p.t;
}

/** fy et fu selon la nuance et l'epaisseur, tableau 3.1. Leve au-dela de 80 mm. */
export function materiau(nuance: Nuance, p: Profil): Materiau {
  const t = epaisseurMax(p);
  if (t > 80) throw new Error(`Epaisseur ${t} mm > 80 mm : hors du tableau 3.1.`);
  const [fy, fu] = TABLEAU_3_1[nuance][t <= 40 ? 0 : 1];
  return { nuance, fy, fu, epaisseur: t };
}

/** epsilon = sqrt(235 / fy), tableau 5.2. */
export function epsilon(fy: number): number {
  return Math.sqrt(235 / fy);
}
