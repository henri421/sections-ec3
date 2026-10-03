/**
 * Acces type au catalogue embarque. Le JSON ne porte que les dimensions
 * normalisees ; les proprietes se recalculent par `proprietes()`.
 *
 * Unites : mm.
 */

import donnees from './profils.json';
import type { Profil } from '../model/profil';

export interface FamilleCatalogue {
  famille: string;
  source: string;
  date: string;
  perimetre: string;
  noms: string[];
}

interface FamilleBrute {
  famille: string;
  source: string;
  date: string;
  perimetre: string;
  colonnes: string[];
  profils: Array<[string, number, number, number, number, number]>;
}

const FAMILLES = (donnees as unknown as { familles: FamilleBrute[] }).familles;

/** Familles disponibles, avec leur provenance. */
export function familles(): FamilleCatalogue[] {
  return FAMILLES.map((f) => ({ famille: f.famille, source: f.source, date: f.date, perimetre: f.perimetre, noms: f.profils.map((p) => p[0]) }));
}

/** Profil lamine du catalogue par son nom (« IPE 300 »). Leve s'il est absent. */
export function profilCatalogue(nom: string): Profil & { type: 'I-lamine' } {
  for (const f of FAMILLES) {
    const p = f.profils.find((x) => x[0] === nom);
    if (p !== undefined) {
      const [n, h, b, tw, tf, r] = p;
      return { type: 'I-lamine', nom: n, h, b, tw, tf, r };
    }
  }
  throw new Error(`Profil « ${nom} » absent du catalogue.`);
}

/** Provenance de la famille d'un profil du catalogue. */
export function provenance(nom: string): string {
  const f = FAMILLES.find((x) => x.profils.some((p) => p[0] === nom));
  return f === undefined ? 'section saisie' : `${f.source} (${f.date})`;
}
