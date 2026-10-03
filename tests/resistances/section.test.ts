import { describe, expect, it } from 'vitest';
import {
  aireCisaillement,
  ec3Recommande,
  interactionSection,
  materiau,
  profilCatalogue,
  proprietes,
  reductionCisaillement,
  resistancesSection,
  verifierVoilementCisaillement,
} from '../../src/index';

const P = ec3Recommande();
const IPE300 = profilCatalogue('IPE 300');
const prop = proprietes(IPE300);
const mat = materiau('S235', IPE300);

describe('resistances de section, IPE 300 S235', () => {
  const r = resistancesSection(IPE300, mat, prop, 1, P);

  it('N_pl,Rd = 1 264,5 kN ; M_pl,y,Rd = 147,6 kN.m', () => {
    expect(r.Npl_Rd).toBeCloseTo(1264.5, 0);
    expect(r.My_Rd).toBeCloseTo(147.63, 1);
    expect(r.module).toBe('plastique');
  });

  it('A_v,z = A - 2 b t_f + (t_w + 2r) t_f = 2 568 mm2 ; V_pl,z,Rd = 348,4 kN', () => {
    expect(r.Avz).toBeCloseTo(2567.97, -1);
    expect(r.Vz_Rd).toBeCloseTo(348.4, 0);
  });

  it('les quatre expressions de A_v, chacune avec sa clause', () => {
    expect(aireCisaillement(IPE300, prop, 'z', P).motif).toContain('(3)a');
    expect(aireCisaillement(IPE300, prop, 'y', P).motif).toContain('(3)e');
    const rhs = { type: 'tube-rectangulaire', nom: 'R', h: 200, b: 100, t: 8, finition: 'chaud' } as const;
    const pr = proprietes(rhs);
    expect(aireCisaillement(rhs, pr, 'z', P).Av).toBeCloseTo((pr.A * 200) / 300, 6);
    const chs = { type: 'tube-circulaire', nom: 'C', d: 168.3, t: 8, finition: 'chaud' } as const;
    const pc = proprietes(chs);
    expect(aireCisaillement(chs, pc, 'z', P).Av).toBeCloseTo((2 * pc.A) / Math.PI, 6);
  });

  it('classe 3 : module elastique ; classe 4 : leve', () => {
    expect(resistancesSection(IPE300, mat, prop, 3, P).module).toBe('elastique');
    expect(() => resistancesSection(IPE300, mat, prop, 4, P)).toThrow('classe 4');
  });

  it('voilement par cisaillement : critere satisfait pour l IPE 300', () => {
    expect(verifierVoilementCisaillement(IPE300, mat, prop, P)).toContain('pas de voilement');
  });

  it('rho = (2 V/V_pl - 1)^2 au-dela de la moitie', () => {
    expect(reductionCisaillement(100, 348)).toBe(0);
    expect(reductionCisaillement(261, 348)).toBeCloseTo(0.25, 6);
  });

  it('interaction : M_y seul a M_pl donne un taux de 1', () => {
    const i = interactionSection(IPE300, mat, prop, 1, r, { N: 0, My: r.My_Rd, Mz: 0, Vz: 0, Vy: 0 }, P);
    expect(i.taux).toBeCloseTo(1, 6);
  });

  it('interaction N-M_y : n = 0,5, a = 0,403 -> M_N,y = M_pl (1 - n)/(1 - 0,5 a)', () => {
    const N = 0.5 * r.Npl_Rd;
    const i = interactionSection(IPE300, mat, prop, 1, r, { N, My: 50, Mz: 0, Vz: 0, Vy: 0 }, P);
    const a = (prop.A - 2 * 150 * 10.7) / prop.A;
    expect(i.MN_y_Rd).toBeCloseTo((r.My_Rd * 0.5) / (1 - 0.5 * a), 6);
  });

  it('cisaillement fort : M_y,V,Rd reduit par (6.30)', () => {
    const i = interactionSection(IPE300, mat, prop, 1, r, { N: 0, My: 50, Mz: 0, Vz: 300, Vy: 0 }, P);
    expect(i.rho_z).toBeGreaterThan(0);
    expect(i.My_V_Rd).toBeLessThan(r.My_Rd);
  });
});
