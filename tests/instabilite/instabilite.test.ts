import { describe, expect, it } from 'vitest';
import {
  coefficientCm,
  coefficientCmDiagramme,
  coefficientsC,
  courbeFlambement,
  deversement,
  ec3Recommande,
  facteurReduction,
  flambement,
  interaction633,
  materiau,
  momentCritique,
  profilCatalogue,
  proprietes,
} from '../../src/index';

const P = ec3Recommande();

describe('flambement par flexion, §6.3.1', () => {
  it('chi = 1 pour lambda <= 0,2', () => {
    expect(facteurReduction(0.2, 0.34).chi).toBe(1);
    expect(facteurReduction(0.1, 0.76).chi).toBe(1);
  });

  it('HEB 200 S235, L_cr = 4 m : N_b,z,Rd = 1 168 kN (courbe c), N_b,y,Rd = 1 624 kN (courbe b)', () => {
    const p = profilCatalogue('HEB 200');
    const m = materiau('S235', p);
    const pr = proprietes(p);
    const z = flambement(p, m, pr, 'z', 4000, P);
    expect(z.courbe).toBe('c');
    expect(z.lambda_).toBeCloseTo(0.8409, 3);
    expect(z.chi).toBeCloseTo(0.63653, 4);
    expect(z.Nb_Rd).toBeCloseTo(1167.96, 0);
    const y = flambement(p, m, pr, 'y', 4000, P);
    expect(y.courbe).toBe('b');
    expect(y.Nb_Rd).toBeCloseTo(1623.5, 0);
  });

  it('tableau 6.2 integral : cas representatifs', () => {
    const ipe = profilCatalogue('IPE 300');
    expect(courbeFlambement(ipe, materiau('S235', ipe), 'y')).toBe('a');
    expect(courbeFlambement(ipe, materiau('S235', ipe), 'z')).toBe('b');
    expect(courbeFlambement(ipe, materiau('S460', ipe), 'z')).toBe('a0');
    const soude = { type: 'I-soude', nom: 'PRS', h: 600, b: 300, tw: 10, tf: 45, a: 6 } as const;
    expect(courbeFlambement(soude, materiau('S355', soude), 'z')).toBe('d');
    const froid = { type: 'tube-rectangulaire', nom: 'R', h: 200, b: 100, t: 6, finition: 'froid' } as const;
    expect(courbeFlambement(froid, materiau('S355', froid), 'y')).toBe('c');
  });

  it('combinaison non couverte : leve', () => {
    const p = { type: 'I-lamine', nom: 'X', h: 1000, b: 400, tw: 60, tf: 110, r: 30 } as const;
    expect(() => courbeFlambement(p, { nuance: 'S235', fy: 235, fu: 360, epaisseur: 110 }, 'y')).toThrow('non couvert');
  });
});

describe('moment critique, HORS NORME', () => {
  const p = profilCatalogue('IPE 300');
  const pr = proprietes(p);

  it('C1 : 1,0 pour psi = 1, 2,70 au plafond ; charge repartie 1,132 / 0,459', () => {
    expect(coefficientsC({ type: 'lineaire', psi: 1 }).C1).toBeCloseTo(1, 10);
    expect(coefficientsC({ type: 'lineaire', psi: -1 }).C1).toBe(2.7);
    expect(coefficientsC({ type: 'repartie' })).toEqual({ C1: 1.132, C2: 0.459 });
  });

  it('IPE 300, L = 6 m, charge repartie en semelle superieure : M_cr = 78,85 kN.m, signale hors norme', () => {
    const m = momentCritique(p, pr, 6000, { type: 'repartie' }, 'semelle-superieure', null);
    expect(m.M_cr).toBeCloseTo(78.85, 1);
    expect(m.origine).toBe('hors-norme');
    expect(m.source).toContain('HORS NORME');
  });

  it('charge destabilisante : M_cr plus faible qu au centre de cisaillement', () => {
    const haut = momentCritique(p, pr, 6000, { type: 'repartie' }, 'semelle-superieure', null).M_cr;
    const centre = momentCritique(p, pr, 6000, { type: 'repartie' }, 'centre', null).M_cr;
    expect(haut).toBeLessThan(centre);
  });

  it('M_cr saisi : repris et signale', () => {
    const m = momentCritique(p, pr, 6000, { type: 'repartie' }, 'centre', 120);
    expect(m).toMatchObject({ M_cr: 120, origine: 'saisi' });
  });
});

describe('deversement, §6.3.2.3', () => {
  const p = profilCatalogue('IPE 300');
  const pr = proprietes(p);
  const m = materiau('S235', p);

  it('IPE 300, 6 m, repartie en semelle superieure : chi_LT,mod = 0,4936, M_b,Rd = 72,87 kN.m', () => {
    const d = deversement(p, m, pr, pr.Wpl_y, 60, false, 6000, { type: 'repartie' }, 'semelle-superieure', null, P);
    expect(d.applicable).toBe(true);
    expect(d.courbe).toBe('b');
    expect(d.lambda_LT).toBeCloseTo(1.3683, 3);
    expect(d.f).toBeCloseTo(0.98938, 4);
    expect(d.chi_LT).toBeCloseTo(0.49359, 4);
    expect(d.Mb_Rd).toBeCloseTo(72.87, 1);
  });

  it('dispense : NON APPLICABLE, jamais satisfait', () => {
    const d = deversement(p, m, pr, pr.Wpl_y, 5, false, 6000, { type: 'repartie' }, 'centre', null, P);
    expect(d.applicable).toBe(false);
    expect(d.motif).toContain('negligeable');
    expect(d.Mb_Rd).toBeNull();
  });

  it('section creuse et maintien continu : non applicable avec motif', () => {
    const rhs = { type: 'tube-rectangulaire', nom: 'R', h: 200, b: 100, t: 8, finition: 'chaud' } as const;
    expect(deversement(rhs, materiau('S355', rhs), proprietes(rhs), 1e5, 50, false, 6000, { type: 'repartie' }, 'centre', null, P).motif).toContain('creuse');
    expect(deversement(p, m, pr, pr.Wpl_y, 60, true, 6000, { type: 'repartie' }, 'centre', null, P).applicable).toBe(false);
  });
});

describe('flexion composee, annexe B', () => {
  it('C_m = 0,6 + 0,4 psi >= 0,4', () => {
    expect(coefficientCm(1)).toBeCloseTo(1, 10);
    expect(coefficientCm(-1)).toBe(0.4);
  });

  it('C_m selon le diagramme (tableau B.3) : 0,95 charge repartie, 0,90 concentree, lineaire sinon', () => {
    expect(coefficientCmDiagramme({ type: 'repartie' })).toBe(0.95);
    expect(coefficientCmDiagramme({ type: 'concentree-milieu' })).toBe(0.9);
    expect(coefficientCmDiagramme({ type: 'lineaire', psi: 0 })).toBeCloseTo(0.6, 10);
    expect(() => coefficientCmDiagramme({ type: 'lineaire', psi: 2 })).toThrow('psi');
  });

  it('k_yy borne par C_my (1 + 0,8 n_y) ; annexe A refusee explicitement', () => {
    const p = profilCatalogue('HEB 200');
    const e = {
      profil: p,
      classe: 1 as const,
      NEd: 800,
      MyEd: 40,
      MzEd: 0,
      NRd1: 1834.9,
      MyRd1: 151,
      MzRd1: 71.9,
      chi_y: 0.885,
      chi_z: 0.6365,
      chi_LT: 1,
      lambda_y: 0.4987,
      lambda_z: 0.8409,
      Cmy: 1,
      Cmz: 1,
      CmLT: 1,
      sensibleTorsion: false,
    };
    const r = interaction633(e, P);
    const nY = 800 / (0.885 * 1834.9);
    expect(r.kyy).toBeCloseTo(Math.min(1 + (0.4987 - 0.2) * nY, 1 + 0.8 * nY), 8);
    expect(r.kzy).toBeCloseTo(0.6 * r.kyy, 10);
    const pa = ec3Recommande();
    pa.annexe633 = { valeur: 'A', source: 'annexe nationale fictive de test' };
    expect(() => interaction633(e, pa)).toThrow('Annexe A');
  });
});
