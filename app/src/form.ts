/**
 * Saisie : modele, lecture des champs, traduction vers le noyau. Module PUR.
 *
 * Unites de l'interface : dimensions en mm, longueurs d'element en m,
 * efforts en kN, moments en kN.m.
 */

import { lireNombre } from 'aedificium-ui';
import type { DonneesElement, Nuance, ProfilDoublementSymetrique } from '../../src/index';
import { profilCatalogue } from '../../src/index';

export type TypeSaisie = 'catalogue' | 'I-soude' | 'tube-rectangulaire' | 'tube-circulaire';

export interface ModeleSaisie {
  source: TypeSaisie;
  nomCatalogue: string;
  h: number;
  b: number;
  tw: number;
  tf: number;
  a: number;
  t: number;
  d: number;
  finition: 'chaud' | 'froid';
  nuance: Nuance;
  N: number;
  My: number;
  Mz: number;
  Vz: number;
  Vy: number;
  Lcry: number;
  Lcrz: number;
  LLT: number;
  empeche: boolean;
  diagramme: TypeDiagramme;
  psiLT: number;
  point: 'semelle-superieure' | 'centre' | 'semelle-inferieure';
  /** null : M_cr par l'expression hors norme. */
  Mcr: number | null;
  diagrammeY: TypeDiagramme;
  psiY: number;
  diagrammeZ: TypeDiagramme;
  psiZ: number;
}

export type TypeDiagramme = 'lineaire' | 'repartie' | 'concentree-milieu';
const DIAGRAMMES = ['lineaire', 'repartie', 'concentree-milieu'] as const;

export type Lecture = { ok: true; modele: ModeleSaisie } | { ok: false; message: string };

/** Poteau-poutre HEB 200 en S235, 4 m. */
export function modeleParDefaut(): ModeleSaisie {
  return {
    source: 'catalogue',
    nomCatalogue: 'HEB 200',
    h: 200,
    b: 100,
    tw: 10,
    tf: 20,
    a: 6,
    t: 8,
    d: 168.3,
    finition: 'chaud',
    nuance: 'S235',
    N: 800,
    My: 40,
    Mz: 0,
    Vz: 20,
    Vy: 0,
    Lcry: 4,
    Lcrz: 4,
    LLT: 4,
    empeche: false,
    diagramme: 'lineaire',
    psiLT: 0,
    point: 'centre',
    Mcr: null,
    diagrammeY: 'lineaire',
    psiY: 0,
    diagrammeZ: 'lineaire',
    psiZ: 1,
  };
}

class ErreurDeSaisie extends Error {}

function choix<T extends string>(v: Record<string, string>, nom: string, permis: readonly T[]): T {
  const x = v[nom];
  if ((permis as readonly string[]).includes(x)) return x as T;
  throw new ErreurDeSaisie(`Valeur inattendue pour ${nom} : « ${x ?? ''} ».`);
}

function nombre(v: Record<string, string>, nom: string, requis: boolean, repli: number): number {
  const x = lireNombre(v[nom] ?? '');
  if (x === null) {
    if (requis) throw new ErreurDeSaisie(`${nom} : nombre attendu.`);
    return repli;
  }
  return x;
}

export function modeleDepuisChamps(v: Record<string, string>): Lecture {
  const d = modeleParDefaut();
  try {
    const source = choix(v, 'source', ['catalogue', 'I-soude', 'tube-rectangulaire', 'tube-circulaire'] as const);
    const soude = source === 'I-soude';
    const rhs = source === 'tube-rectangulaire';
    const chs = source === 'tube-circulaire';
    const mcrTexte = (v.mcr ?? '').trim();
    const mcr = mcrTexte === '' ? null : lireNombre(mcrTexte);
    if (mcrTexte !== '' && mcr === null) throw new ErreurDeSaisie('M_cr : nombre attendu, ou champ vide.');
    const diagrammeY = choix(v, 'diagramme_y', DIAGRAMMES);
    const diagrammeZ = choix(v, 'diagramme_z', DIAGRAMMES);
    return {
      ok: true,
      modele: {
        source,
        nomCatalogue: v.nom_catalogue ?? d.nomCatalogue,
        h: nombre(v, 'h', soude || rhs, d.h),
        b: nombre(v, 'b', soude || rhs, d.b),
        tw: nombre(v, 'tw', soude, d.tw),
        tf: nombre(v, 'tf', soude, d.tf),
        a: nombre(v, 'a', soude, d.a),
        t: nombre(v, 't', rhs || chs, d.t),
        d: nombre(v, 'd', chs, d.d),
        finition: choix(v, 'finition', ['chaud', 'froid'] as const),
        nuance: choix(v, 'nuance', ['S235', 'S275', 'S355', 'S420', 'S460'] as const),
        N: nombre(v, 'n', true, d.N),
        My: nombre(v, 'my', true, d.My),
        Mz: nombre(v, 'mz', true, d.Mz),
        Vz: nombre(v, 'vz', true, d.Vz),
        Vy: nombre(v, 'vy', true, d.Vy),
        Lcry: nombre(v, 'lcry', true, d.Lcry),
        Lcrz: nombre(v, 'lcrz', true, d.Lcrz),
        LLT: nombre(v, 'llt', true, d.LLT),
        empeche: v.empeche === 'oui',
        diagramme: choix(v, 'diagramme', DIAGRAMMES),
        psiLT: nombre(v, 'psi_lt', false, d.psiLT),
        point: choix(v, 'point', ['semelle-superieure', 'centre', 'semelle-inferieure'] as const),
        Mcr: mcr,
        diagrammeY,
        psiY: nombre(v, 'psi_y', diagrammeY === 'lineaire', d.psiY),
        diagrammeZ,
        psiZ: nombre(v, 'psi_z', diagrammeZ === 'lineaire', d.psiZ),
      },
    };
  } catch (e) {
    if (e instanceof ErreurDeSaisie) return { ok: false, message: e.message };
    throw e;
  }
}

export function champsDepuisModele(m: ModeleSaisie): Record<string, string> {
  const n = (x: number): string => String(x).replace('.', ',');
  return {
    source: m.source,
    nom_catalogue: m.nomCatalogue,
    h: n(m.h),
    b: n(m.b),
    tw: n(m.tw),
    tf: n(m.tf),
    a: n(m.a),
    t: n(m.t),
    d: n(m.d),
    finition: m.finition,
    nuance: m.nuance,
    n: n(m.N),
    my: n(m.My),
    mz: n(m.Mz),
    vz: n(m.Vz),
    vy: n(m.Vy),
    lcry: n(m.Lcry),
    lcrz: n(m.Lcrz),
    llt: n(m.LLT),
    empeche: m.empeche ? 'oui' : 'non',
    diagramme: m.diagramme,
    psi_lt: n(m.psiLT),
    point: m.point,
    mcr: m.Mcr === null ? '' : n(m.Mcr),
    diagramme_y: m.diagrammeY,
    psi_y: n(m.psiY),
    diagramme_z: m.diagrammeZ,
    psi_z: n(m.psiZ),
  };
}

export function profilDepuisModele(m: ModeleSaisie): ProfilDoublementSymetrique {
  switch (m.source) {
    case 'catalogue':
      return profilCatalogue(m.nomCatalogue);
    case 'I-soude':
      return { type: 'I-soude', nom: `PRS ${m.h} x ${m.b}`, h: m.h, b: m.b, tw: m.tw, tf: m.tf, a: m.a };
    case 'tube-rectangulaire':
      return { type: 'tube-rectangulaire', nom: `RHS ${m.h} x ${m.b} x ${m.t}`, h: m.h, b: m.b, t: m.t, finition: m.finition };
    case 'tube-circulaire':
      return { type: 'tube-circulaire', nom: `CHS ${m.d} x ${m.t}`, d: m.d, t: m.t, finition: m.finition };
  }
}

const MM_PAR_M = 1000;

export function donneesDepuisModele(m: ModeleSaisie): DonneesElement {
  return {
    profil: profilDepuisModele(m),
    nuance: m.nuance,
    N: m.N,
    My: m.My,
    Mz: m.Mz,
    Vz: m.Vz,
    Vy: m.Vy,
    Lcr_y: m.Lcry * MM_PAR_M,
    Lcr_z: m.Lcrz * MM_PAR_M,
    L_LT: m.LLT * MM_PAR_M,
    deversementEmpeche: m.empeche,
    diagrammeLT: m.diagramme === 'lineaire' ? { type: 'lineaire', psi: m.psiLT } : { type: m.diagramme },
    pointApplication: m.point,
    McrSaisi: m.Mcr,
    diagrammeY: m.diagrammeY === 'lineaire' ? { type: 'lineaire', psi: m.psiY } : { type: m.diagrammeY },
    diagrammeZ: m.diagrammeZ === 'lineaire' ? { type: 'lineaire', psi: m.psiZ } : { type: m.diagrammeZ },
  };
}
