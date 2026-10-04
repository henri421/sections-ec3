import { describe, expect, it } from 'vitest';
import {
  corniereCatalogue,
  ec3Recommande,
  flambementsNonSymetriques,
  materiau,
  profilUCatalogue,
  proprietes,
  verifierNonSymetrique,
  type DonneesNonSymetriques,
} from '../../src/index';

const P = ec3Recommande();

function donnees(modifs: Partial<DonneesNonSymetriques>): DonneesNonSymetriques {
  return {
    profil: profilUCatalogue('UPE 200'),
    nuance: 'S235',
    N: 200,
    My: 15,
    Mz: 0,
    Vz: 0,
    Vy: 0,
    Lcr_y: 3000,
    Lcr_z: 3000,
    Lcr_v: 3000,
    L_T: 3000,
    barreDeTreillis: false,
    L_LT: 3000,
    deversementEmpeche: false,
    diagrammeLT: { type: 'lineaire', psi: 1 },
    pointApplication: 'centre',
    McrSaisi: null,
    diagrammeY: { type: 'lineaire', psi: 1 },
    diagrammeZ: { type: 'lineaire', psi: 1 },
    espacementLiaisons: null,
    ...modifs,
  };
}

describe('verification des L, U, 2L et 2U', () => {
  it('UPE 200 en flexion composee : flambements (dont flexion-torsion), deversement, (6.61) et (6.62) avec l annexe B etendue declaree', () => {
    const r = verifierNonSymetrique(donnees({}), P);
    const noms = r.verifications.map((v) => v.nom);
    expect(noms).toContain('Flambement : torsion ou flexion-torsion');
    expect(noms).toContain('Deversement');
    expect(noms).toContain('Flexion composee, expression (6.62)');
    expect(r.interaction633?.motif).toContain('ETENDUE');
    expect(['conforme', 'non-conforme']).toContain(r.verdict);
    expect(r.avertissements.length).toBe(0);
  });

  it('corniere comprimee : taux de flambement autour de v = N / N_b,v,Rd', () => {
    const c = corniereCatalogue('L 100x100x10');
    const r = verifierNonSymetrique(donnees({ profil: c, N: 100, My: 0 }), P);
    const f = flambementsNonSymetriques(c, materiau('S235', c), proprietes(c), 3, null, { Lcr_y: 3000, Lcr_z: 3000, Lcr_v: 3000, L_T: 3000, barreDeTreillis: false }, P);
    expect(r.verifications.find((v) => v.nom === 'Flambement : flexion autour de v')?.taux).toBeCloseTo(100 / f[2].Nb_Rd, 10);
    expect(r.verdict).toBe('conforme');
  });

  it('corniere flechie autour de son axe fort sans M_cr : verdict INCOMPLET, jamais conforme', () => {
    const r = verifierNonSymetrique(donnees({ profil: corniereCatalogue('L 100x100x10'), N: 20, My: 1 }), P);
    expect(r.deversement.aFournir).toBe(true);
    expect(r.verdict).toBe('incomplet');
    expect(r.motif).toContain('M_cr a fournir');
  });

  it('corniere tendue : flambement non applicable', () => {
    const r = verifierNonSymetrique(donnees({ profil: corniereCatalogue('L 100x100x10'), N: -100, My: 0 }), P);
    expect(r.verifications.find((v) => v.nom === 'Flambement')?.applicable).toBe(false);
    expect(r.verdict).toBe('conforme');
  });

  it('2L : espacement des liaisons exige, borne a 15 i_min (tableau 6.9)', () => {
    const c = corniereCatalogue('L 80x80x8');
    const deux = { type: '2L' as const, nom: '2 L 80x80x8', corniere: c, ecartement: 10, accolee: 'h' as const };
    const iv = proprietes(c).iv;
    expect(() => verifierNonSymetrique(donnees({ profil: deux, My: 0 }), P)).toThrow('espacement des liaisons requis');
    expect(() => verifierNonSymetrique(donnees({ profil: deux, My: 0, espacementLiaisons: 15 * iv + 1 }), P)).toThrow('hors perimetre');
    const r = verifierNonSymetrique(donnees({ profil: deux, My: 0, espacementLiaisons: 15 * iv - 1 }), P);
    expect(r.compose?.limite).toBeCloseTo(15 * iv, 9);
  });

  it('2U dos a dos : annexe B dans son domaine (formules des I, pas d extension declaree)', () => {
    const deux = { type: '2U' as const, nom: '2 UPE 200', profilU: profilUCatalogue('UPE 200'), ecartement: 10 };
    const r = verifierNonSymetrique(donnees({ profil: deux, espacementLiaisons: 300 }), P);
    expect(r.interaction633?.motif).not.toContain('ETENDUE');
    expect(r.deversement.M_cr).not.toBeNull();
  });

  it('U sollicite par V_z : avertissement de torsion', () => {
    const r = verifierNonSymetrique(donnees({ Vz: 20 }), P);
    expect(r.avertissements.join(' ')).toContain('torsion');
  });
});
