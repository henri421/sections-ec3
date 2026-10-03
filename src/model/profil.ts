/**
 * Geometrie des profils et materiau.
 *
 * Unites : mm, MPa.
 *
 * Le profil ne porte AUCUNE classe : la classe depend du couple profil et
 * sollicitation (`classifier`). Un catalogue qui annoncerait « IPE 300
 * classe 1 » serait faux des que l'effort normal devient significatif.
 *
 * Reperes de construction des profils non doublement symetriques (les
 * proprietes sont ensuite rapportees au centre de gravite) :
 *   L  : talon a l'origine, aile h le long de z, aile b le long de y ;
 *   U  : dos de l'ame sur y = 0, ailes vers +y, symetrique par rapport a y ;
 *   2L : deux cornieres adossees de part et d'autre d'un gousset vertical
 *        d'epaisseur `ecartement`, ailes accolees verticales, symetrique par
 *        rapport a z ;
 *   2U : deux U ame contre ame, symetrique par rapport a y et a z.
 */

/** Corniere laminee, EN 10056-1. */
export interface ProfilL {
  type: 'L';
  nom: string;
  /** Aile le long de z (mm), la plus grande pour une corniere a ailes inegales. */
  h: number;
  /** Aile le long de y (mm). */
  b: number;
  t: number;
  /** Rayon de conge r_1 et rayon de rive r_2 (mm). */
  r1: number;
  r2: number;
  /** Inertie de torsion publiee par le producteur (mm4), absente pour une corniere saisie. */
  It?: number;
}

/** Profil en U lamine : ailes paralleles (UPE) ou inclinees (UPN). */
export interface ProfilU {
  type: 'U';
  nom: string;
  h: number;
  b: number;
  tw: number;
  /** Epaisseur d'aile, mesuree a l'abscisse yTf depuis le dos de l'ame (mm). */
  tf: number;
  yTf: number;
  /** Pente de la face interieure des ailes : 0 (UPE), 0,08 ou 0,05 (UPN). */
  pente: number;
  /** Rayon de conge r_1 et rayon de rive r_2 (mm), r_2 = 0 sans arrondi. */
  r1: number;
  r2: number;
  /** Inertie de torsion (mm4) et de gauchissement (mm6) publiees par le producteur. */
  It?: number;
  Iw?: number;
  /** Centre de cisaillement publie : distance au plan moyen de l'ame, cote dos (mm). */
  e0?: number;
}

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
    }
  | ProfilL
  | ProfilU
  | {
      type: '2L';
      nom: string;
      corniere: ProfilL;
      /** Epaisseur du gousset entre les cornieres (mm). */
      ecartement: number;
      /** Aile accolee au gousset, donc verticale. */
      accolee: 'h' | 'b';
    }
  | {
      type: '2U';
      nom: string;
      profilU: ProfilU;
      ecartement: number;
    };

/** Profils dont le traitement suppose la double symetrie (I et tubes). */
export type ProfilDoublementSymetrique = Extract<Profil, { type: 'I-lamine' | 'I-soude' | 'tube-rectangulaire' | 'tube-circulaire' }>;

export function estDoublementSymetrique(p: Profil): p is ProfilDoublementSymetrique {
  return p.type === 'I-lamine' || p.type === 'I-soude' || p.type === 'tube-rectangulaire' || p.type === 'tube-circulaire';
}

/** Epaisseur d'aile d'un U a la racine de l'ame, la plus forte pour un UPN (mm). */
export function epaisseurAileRacine(u: ProfilU): number {
  return u.tf + u.pente * (u.yTf - u.tw);
}

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
  switch (p.type) {
    case 'I-lamine':
    case 'I-soude':
      return Math.max(p.tf, p.tw);
    case 'tube-rectangulaire':
    case 'tube-circulaire':
    case 'L':
      return p.t;
    case 'U':
      return Math.max(p.tw, epaisseurAileRacine(p));
    case '2L':
      return p.corniere.t;
    case '2U':
      return epaisseurMax(p.profilU);
  }
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
