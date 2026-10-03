/**
 * Flambement par flexion, EN 1993-1-1 §6.3.1, tableaux 6.1 et 6.2.
 *
 * Unites : longueurs en mm, efforts en kN, MPa.
 */

import type { Materiau, Profil } from '../model/profil';
import { E } from '../model/profil';
import type { Proprietes } from '../proprietes/brutes';
import type { ProfilEc3 } from '../norms/profil';
import { exigerPositif } from '../norms/profil';

export type Courbe = 'a0' | 'a' | 'b' | 'c' | 'd';

/** Facteurs d'imperfection, tableau 6.1. */
export const ALPHA: Record<Courbe, number> = { a0: 0.13, a: 0.21, b: 0.34, c: 0.49, d: 0.76 };

const N_PAR_KN = 1000;

/**
 * Courbe de flambement, tableau 6.2, implemente INTEGRALEMENT pour le
 * perimetre (I lamines et soudes, tubes finis a chaud ou a froid). Une
 * combinaison non couverte leve, jamais une case voisine : simplifier ce
 * tableau est non conservatif dans plusieurs cases.
 */
export function courbeFlambement(p: Profil, m: Materiau, axe: 'y' | 'z'): Courbe {
  const s460 = m.nuance === 'S460';
  if (p.type === 'I-lamine') {
    const hb = p.h / p.b;
    if (hb > 1.2) {
      if (p.tf <= 40) return axe === 'y' ? (s460 ? 'a0' : 'a') : s460 ? 'a0' : 'b';
      if (p.tf <= 100) return axe === 'y' ? (s460 ? 'a' : 'b') : s460 ? 'a' : 'c';
      throw new Error('Tableau 6.2 : profil lamine h/b > 1,2 avec t_f > 100 mm non couvert.');
    }
    if (p.tf <= 100) return axe === 'y' ? (s460 ? 'a' : 'b') : s460 ? 'a' : 'c';
    return axe === 'y' ? (s460 ? 'c' : 'd') : s460 ? 'c' : 'd';
  }
  if (p.type === 'I-soude') {
    if (p.tf <= 40) return axe === 'y' ? 'b' : 'c';
    return axe === 'y' ? 'c' : 'd';
  }
  // Sections creuses : finies a chaud a (a0 en S460), formees a froid c.
  if (p.finition === 'froid') return 'c';
  return s460 ? 'a0' : 'a';
}

export interface Flambement {
  axe: 'y' | 'z';
  Lcr: number;
  N_cr: number;
  lambda_: number;
  courbe: Courbe;
  alpha: number;
  Phi: number;
  chi: number;
  Nb_Rd: number;
}

/** chi a partir de l'elancement reduit et du facteur d'imperfection, expression (6.49) ; 1 sous 0,2. */
export function facteurReduction(lambda_: number, alpha: number): { Phi: number; chi: number } {
  const Phi = 0.5 * (1 + alpha * (lambda_ - 0.2) + lambda_ * lambda_);
  if (lambda_ <= 0.2) return { Phi, chi: 1 };
  return { Phi, chi: Math.min(1, 1 / (Phi + Math.sqrt(Phi * Phi - lambda_ * lambda_))) };
}

/**
 * N_cr = pi^2 E I / L_cr^2 ; lambda = sqrt(A f_y / N_cr) (classes 1 a 3) ;
 * N_b,Rd = chi A f_y / gamma_M1 (6.47).
 */
export function flambement(p: Profil, m: Materiau, prop: Proprietes, axe: 'y' | 'z', Lcr: number, profil: ProfilEc3): Flambement {
  exigerPositif(Lcr, `La longueur de flambement L_cr,${axe}`, 'mm');
  const I = axe === 'y' ? prop.Iy : prop.Iz;
  const Ncr = (Math.PI ** 2 * E * I) / (Lcr * Lcr);
  const lambda_ = Math.sqrt((prop.A * m.fy) / Ncr);
  const courbe = courbeFlambement(p, m, axe);
  const alpha = ALPHA[courbe];
  const { Phi, chi } = facteurReduction(lambda_, alpha);
  return {
    axe,
    Lcr,
    N_cr: Ncr / N_PAR_KN,
    lambda_,
    courbe,
    alpha,
    Phi,
    chi,
    Nb_Rd: (chi * prop.A * m.fy) / profil.gamma_M1.valeur / N_PAR_KN,
  };
}
