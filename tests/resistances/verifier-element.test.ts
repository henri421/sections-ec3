import { describe, expect, it } from 'vitest';
import { corniereCatalogue, ec3Recommande, profilCatalogue, profilUCatalogue, verifierElement, type DonneesElement } from '../../src/index';

const P = ec3Recommande();

function element(modifs: Partial<DonneesElement> = {}): DonneesElement {
  return {
    profil: profilCatalogue('HEB 200'),
    nuance: 'S235',
    N: 800,
    My: 40,
    Mz: 0,
    Vz: 20,
    Vy: 0,
    Lcr_y: 4000,
    Lcr_z: 4000,
    L_LT: 4000,
    deversementEmpeche: false,
    diagrammeLT: { type: 'lineaire', psi: 0 },
    pointApplication: 'centre',
    McrSaisi: null,
    diagrammeY: { type: 'lineaire', psi: 0 },
    diagrammeZ: { type: 'lineaire', psi: 1 },
    ...modifs,
  };
}

describe('verifierElement', () => {
  it('poteau HEB 200 : toutes les verifications rendues, distinctes, avec verdict', () => {
    const r = verifierElement(element(), P);
    const noms = r.verifications.map((v) => v.nom);
    expect(noms).toContain('Flambement par flexion autour de z');
    expect(noms).toContain('Flexion composee, expression (6.62)');
    expect(['conforme', 'non-conforme']).toContain(r.verdict);
  });

  it('element tendu : flambement et (6.61)/(6.62) NON APPLICABLES, avec motif', () => {
    const r = verifierElement(element({ N: -300 }), P);
    const fl = r.verifications.find((v) => v.nom === 'Flambement par flexion');
    expect(fl?.applicable).toBe(false);
    expect(fl?.motif).toContain('non comprime');
  });

  it('sans moment : deversement non applicable', () => {
    const r = verifierElement(element({ My: 0, Vz: 0 }), P);
    expect(r.verifications.find((v) => v.nom === 'Deversement')?.applicable).toBe(false);
  });

  it('IPE 600 S355 comprime : classe 4, A_eff par l EN 1993-1-5 §4.4', () => {
    // Ame : c = 600 - 2 × 19 - 2 × 24 = 514 mm, c / t_w = 42,83 > 42 epsilon = 34,17 : classe 4.
    // lambda_p = 42,83 / (28,4 × 0,8136 × 2) = 0,9268 ; rho = (0,9268 - 0,22) / 0,9268^2 = 0,8228.
    // Aire perdue au milieu de l'ame : (1 - 0,8228) × 514 × 12 = 1 093 mm2.
    const r = verifierElement(element({ profil: profilCatalogue('IPE 600'), nuance: 'S355', N: 2500, My: 0 }), P);
    expect(r.classification.classe).toBe(4);
    expect(r.resistances.module).toBe('efficace');
    const perte = r.proprietes.A - (r.sectionEfficace?.Aeff ?? 0);
    expect(perte).toBeGreaterThan(1093 * 0.995);
    expect(perte).toBeLessThan(1093 * 1.005);
    const n = r.verifications.find((v) => v.nom === 'Effort normal');
    expect(n?.motif).toMatch(/A_eff/);
    expect(n?.taux).toBeCloseTo(2500 / (((r.sectionEfficace?.Aeff ?? 0) * 355) / 1000), 9);
  });

  it('le verdict nomme la verification gouvernante', () => {
    const r = verifierElement(element({ N: 1100 }), P);
    expect(r.motif).toContain('Taux maximal');
  });

  it('garde-fou : une corniere ou un U ne traverse pas les verifications des sections en I', () => {
    expect(() => verifierElement(element({ profil: corniereCatalogue('L 100x100x10') }), P)).toThrow('verifierNonSymetrique');
    expect(() => verifierElement(element({ profil: profilUCatalogue('UPN 200') }), P)).toThrow('verifierNonSymetrique');
  });
});
