/**
 * Acces type au catalogue embarque. Le JSON porte les dimensions
 * normalisees ; les proprietes se recalculent par `proprietes()`, sauf I_t
 * et I_w des cornieres et des U, repris du producteur (cm4, cm6).
 *
 * Unites : mm (I_t en mm4, I_w en mm6 une fois charges).
 */

import donnees from './profils.json';
import type { Profil, ProfilL, ProfilU } from '../model/profil';

export type TypeFamille = 'I-lamine' | 'L' | 'U';

export interface FamilleCatalogue {
  famille: string;
  type: TypeFamille;
  source: string;
  date: string;
  perimetre: string;
  noms: string[];
}

interface FamilleBrute {
  famille: string;
  type: TypeFamille;
  source: string;
  date: string;
  perimetre: string;
  colonnes: string[];
  profils: Array<Array<string | number>>;
}

const FAMILLES = (donnees as unknown as { familles: FamilleBrute[] }).familles;
const MM4_PAR_CM4 = 1e4;
const MM6_PAR_CM6 = 1e6;
const MM_PAR_CM = 10;

/** Hauteur au-dela de laquelle la pente des ailes des UPN est de 5 % (DIN 1026-1) (mm). */
const UPN_HAUTEUR_PENTE_5 = 300;

/** Familles disponibles, avec leur provenance. */
export function familles(): FamilleCatalogue[] {
  return FAMILLES.map((f) => ({ famille: f.famille, type: f.type, source: f.source, date: f.date, perimetre: f.perimetre, noms: f.profils.map((p) => String(p[0])) }));
}

function trouver(nom: string): { f: FamilleBrute; v: Record<string, number> } {
  for (const f of FAMILLES) {
    const p = f.profils.find((x) => x[0] === nom);
    if (p !== undefined) {
      const v: Record<string, number> = {};
      f.colonnes.forEach((c, i) => {
        if (i > 0) v[c] = Number(p[i]);
      });
      return { f, v };
    }
  }
  throw new Error(`Profil « ${nom} » absent du catalogue.`);
}

/** Profil en I lamine du catalogue par son nom (« IPE 300 »). Leve s'il est absent ou d'une autre forme. */
export function profilCatalogue(nom: string): Profil & { type: 'I-lamine' } {
  const { f, v } = trouver(nom);
  if (f.type !== 'I-lamine') throw new Error(`Profil « ${nom} » : ce n est pas un profil en I (famille ${f.famille}).`);
  return { type: 'I-lamine', nom, h: v.h, b: v.b, tw: v.tw, tf: v.tf, r: v.r };
}

/** Corniere du catalogue (« L 100x100x10 »), I_t publie compris. */
export function corniereCatalogue(nom: string): ProfilL {
  const { f, v } = trouver(nom);
  if (f.type !== 'L') throw new Error(`Profil « ${nom} » : ce n est pas une corniere (famille ${f.famille}).`);
  return { type: 'L', nom, h: v.h, b: v.b, t: v.t, r1: v.r1, r2: v.r2, It: v.It_cm4 * MM4_PAR_CM4 };
}

/**
 * Profil en U du catalogue (« UPE 200 », « UPN 200 »), I_t et I_w publies
 * compris, ainsi que la position publiee du centre de cisaillement e_0.
 *
 * UPN, face interieure des ailes inclinee : 8 % jusqu'a UPN 300, t_f etant
 * mesure a b/2 depuis le dos de l'ame ; 5 % au-dela, t_f mesure au milieu de
 * l'aile ((b + t_w)/2). CONVENTION CALEE sur les valeurs publiees (aires a
 * 0,4 % pres) : la norme de dimensions n'a pas ete consultee directement.
 */
export function profilUCatalogue(nom: string): ProfilU {
  const { f, v } = trouver(nom);
  if (f.type !== 'U') throw new Error(`Profil « ${nom} » : ce n est pas un profil en U (famille ${f.famille}).`);
  const It = v.It_cm4 * MM4_PAR_CM4;
  const Iw = v.Iw_cm6 * MM6_PAR_CM6;
  const e0 = v.e0_cm * MM_PAR_CM;
  if (f.famille === 'UPE') {
    return { type: 'U', nom, h: v.h, b: v.b, tw: v.tw, tf: v.tf, yTf: v.b / 2, pente: 0, r1: v.r, r2: 0, It, Iw, e0 };
  }
  const grand = v.h > UPN_HAUTEUR_PENTE_5;
  return { type: 'U', nom, h: v.h, b: v.b, tw: v.tw, tf: v.tf, yTf: grand ? (v.b + v.tw) / 2 : v.b / 2, pente: grand ? 0.05 : 0.08, r1: v.r1, r2: v.r2, It, Iw, e0 };
}

/** Provenance de la famille d'un profil du catalogue. */
export function provenance(nom: string): string {
  const f = FAMILLES.find((x) => x.profils.some((p) => p[0] === nom));
  return f === undefined ? 'section saisie' : `${f.source} (${f.date})`;
}
