/**
 * Annexe nationale (lot E, audit R4) : profil de calcul selon l'annexe choisie et
 * les coefficients saisis. Module PUR.
 *
 * Le noyau ne connait aucune annexe : le profil luxembourgeois est construit ici a
 * partir du profil recommande et de `valeurLu` d'aedificium-ui. Chaque coefficient
 * est prerempli par l'annexe et reste modifiable ; une valeur changee est marquee
 * « valeur imposée par l’utilisateur » dans sa source.
 */

import { nombreAffiche, valeurLu, type AnnexeNationale } from 'aedificium-ui';
import { ec3Recommande, type ProfilEc3 } from '../../src/index';
import { textes } from './textes';

/** Coefficients saisissables : les valeurs sourcees du profil (l'annexe B du §6.3.3 reste fixee par l'outil). */
export const COEFS = ['gamma_M0', 'gamma_M1', 'eta', 'lambda_LT0', 'beta_LT'] as const;
export type CleCoef = (typeof COEFS)[number];
export type Coefs = Record<CleCoef, number>;

/** Partie d'Eurocode dont vient chaque coefficient recommande (pour la source AN-LU). */
export const PARTIE: Record<CleCoef, string> = {
  gamma_M0: 'EN 1993-1-1',
  gamma_M1: 'EN 1993-1-1',
  eta: 'EN 1993-1-5',
  lambda_LT0: 'EN 1993-1-1',
  beta_LT: 'EN 1993-1-1',
};

/** Symbole affiche de chaque coefficient (la notation le met en forme). */
export const SYMBOLES: Record<CleCoef, string> = {
  gamma_M0: 'gamma_M0',
  gamma_M1: 'gamma_M1',
  eta: 'eta',
  lambda_LT0: 'lambda_LT0',
  beta_LT: 'beta_LT',
};

/**
 * Clause citee par la source recommandee : « EN 1993-1-1:2005, §6.1(1) note 2B »
 * donne « 6.1(1) ». Sans « § » dans la source, repli : « clause non précisée ».
 */
export function clauseDe(source: string): string {
  const m = /§\s*(\d+(?:\.\d+)*(?:\(\d+\))?)/.exec(source);
  return m === null ? 'clause non précisée' : m[1];
}

/** Profil luxembourgeois : chaque valeur sourcee du profil recommande, passee par `valeurLu`. */
export function ec3Lu(): ProfilEc3 {
  const rec = ec3Recommande();
  const p: ProfilEc3 = { ...rec, nom: 'Eurocode 3, Luxembourg, valeurs présumées (AN-LU:2020, à vérifier)', date: '2026-11-18' };
  for (const k of COEFS) p[k] = valeurLu(PARTIE[k], k, rec[k], clauseDe(rec[k].source));
  return p;
}

export function profilDeLAnnexe(a: AnnexeNationale): ProfilEc3 {
  return a === 'lu' ? ec3Lu() : ec3Recommande();
}

/** Valeurs des coefficients d'une annexe, pour preremplir les champs. */
export function coefsDeLAnnexe(a: AnnexeNationale): Coefs {
  const p = profilDeLAnnexe(a);
  return Object.fromEntries(COEFS.map((k) => [k, p[k].valeur])) as Coefs;
}

/** Profil de calcul : celui de l'annexe, chaque valeur changee marquee imposee par l'utilisateur. */
export function profilDeCalcul(a: AnnexeNationale, coefs: Coefs): ProfilEc3 {
  const base = profilDeLAnnexe(a);
  const p: ProfilEc3 = { ...base };
  for (const k of COEFS) {
    const x = coefs[k];
    const b = base[k];
    p[k] = x === b.valeur ? b : { valeur: x, source: textes().messages.imposee(nombreAffiche(b.valeur, 4), b.source) };
  }
  return p;
}
