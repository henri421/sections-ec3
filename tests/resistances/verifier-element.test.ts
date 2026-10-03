import { describe, expect, it } from 'vitest';
import { ec3Recommande, profilCatalogue, verifierElement, type DonneesElement } from '../../src/index';

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
    psi_y: 0,
    psi_z: 1,
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

  it('IPE 600 S355 tres comprime : classe 4, le module leve', () => {
    expect(() => verifierElement(element({ profil: profilCatalogue('IPE 600'), nuance: 'S355', N: 2500, My: 0 }), P)).toThrow('classe 4');
  });

  it('le verdict nomme la verification gouvernante', () => {
    const r = verifierElement(element({ N: 1100 }), P);
    expect(r.motif).toContain('Taux maximal');
  });
});
