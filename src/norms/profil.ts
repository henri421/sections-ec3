/**
 * Profil normatif de l'EN 1993-1-1 : coefficients partiels et choix laisses
 * a l'annexe nationale. Valeurs RECOMMANDEES par defaut, chacune sourcee.
 *
 * Sans dimension, sauf mention.
 */

export interface ValeurSourcee {
  valeur: number;
  source: string;
}

export interface ProfilEc3 {
  nom: string;
  date: string;
  gamma_M0: ValeurSourcee;
  gamma_M1: ValeurSourcee;
  /** Coefficient eta du cisaillement, EN 1993-1-5 §5.1(2). */
  eta: ValeurSourcee;
  /** Deversement §6.3.2.3 : plateau lambda_LT,0. */
  lambda_LT0: ValeurSourcee;
  /** Deversement §6.3.2.3 : beta. */
  beta_LT: ValeurSourcee;
  /** Annexe employee pour les facteurs k_ij du §6.3.3 ; choix d'annexe nationale. */
  annexe633: { valeur: 'A' | 'B'; source: string };
}

export function verifierProfil(p: ProfilEc3): void {
  for (const [nom, v] of Object.entries(p)) {
    if (nom === 'nom' || nom === 'date') continue;
    const vs = v as { valeur: unknown; source: string };
    if (nom !== 'annexe633' && (typeof vs.valeur !== 'number' || !Number.isFinite(vs.valeur) || vs.valeur <= 0)) {
      throw new Error(`Profil « ${p.nom} » : ${nom} doit etre un nombre strictement positif.`);
    }
    if (typeof vs.source !== 'string' || vs.source.trim() === '') {
      throw new Error(`Profil « ${p.nom} » : ${nom} n a pas de source. Une valeur de provenance inconnue bloque le calcul.`);
    }
  }
}

const EN = 'EN 1993-1-1:2005, valeur recommandee';

export function ec3Recommande(): ProfilEc3 {
  return {
    nom: 'Eurocode 3, valeurs recommandees',
    date: '2026-10-03',
    gamma_M0: { valeur: 1.0, source: `${EN}, §6.1(1) note 2B` },
    gamma_M1: { valeur: 1.0, source: `${EN}, §6.1(1) note 2B` },
    eta: { valeur: 1.2, source: 'EN 1993-1-5:2006, §5.1(2) note 2, valeur recommandee (acier <= S460)' },
    lambda_LT0: { valeur: 0.4, source: `${EN}, §6.3.2.3(1) note 2, valeur maximale recommandee` },
    beta_LT: { valeur: 0.75, source: `${EN}, §6.3.2.3(1) note 2, valeur minimale recommandee` },
    annexe633: {
      valeur: 'B',
      source: 'EN 1993-1-1 §6.3.3(5) : choix laisse a l annexe nationale ; annexe B retenue par defaut par l outil',
    },
  };
}

export function exigerPositif(valeur: number, nom: string, unite: string): number {
  if (!Number.isFinite(valeur) || valeur <= 0) {
    throw new Error(`${nom} doit etre un nombre strictement positif (${unite}).`);
  }
  return valeur;
}

export function exigerPositifOuNul(valeur: number, nom: string, unite: string): number {
  if (!Number.isFinite(valeur) || valeur < 0) {
    throw new Error(`${nom} doit etre un nombre positif ou nul (${unite}).`);
  }
  return valeur;
}

export function fr(x: number, d: number): string {
  return x.toFixed(d).replace('.', ',');
}
