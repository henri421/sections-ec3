import { describe, expect, it } from 'vitest';
import { coefficientCmDiagramme, coefficientCmMixte, type DiagrammeMixte } from '../../src/index';

/**
 * C_m d'un diagramme mixte, tableau B.3 de l'EN 1993-1-1, annexe B.
 * Valeurs attendues calculees a la main.
 */

const m = (charge: 'repartie' | 'concentree', Mh: number, psi: number, Ms: number): DiagrammeMixte => ({ type: 'mixte', charge, Mh, psi, Ms });

describe('|M_s| <= |M_h| : alpha_s = M_s / M_h', () => {
  it('alpha_s = 0,5 : 0,2 + 0,8 × 0,5 = 0,60, quel que soit le type de charge', () => {
    expect(coefficientCmMixte(m('repartie', 100, 1, 50))).toBeCloseTo(0.6, 12);
    expect(coefficientCmMixte(m('concentree', 100, -1, 50))).toBeCloseTo(0.6, 12);
  });

  it('alpha_s = 0,1 : 0,2 + 0,08 = 0,28, borne a 0,40', () => {
    expect(coefficientCmMixte(m('repartie', 100, 0, 10))).toBeCloseTo(0.4, 12);
  });

  it('alpha_s = -0,5, psi >= 0 : repartie 0,1 + 0,4 = 0,50 ; concentree 0 + 0,4 = 0,40', () => {
    expect(coefficientCmMixte(m('repartie', 100, 0.5, -50))).toBeCloseTo(0.5, 12);
    expect(coefficientCmMixte(m('concentree', 100, 0.5, -50))).toBeCloseTo(0.4, 12);
  });

  it('alpha_s = -0,5, psi = -0,5 : repartie 0,1 × 1,5 + 0,4 = 0,55 ; concentree 0,2 × 0,5 + 0,4 = 0,50', () => {
    expect(coefficientCmMixte(m('repartie', 100, -0.5, -50))).toBeCloseTo(0.55, 12);
    expect(coefficientCmMixte(m('concentree', 100, -0.5, -50))).toBeCloseTo(0.5, 12);
  });

  it('alpha_s = -0,2, concentree, psi >= 0 : 0,16 borne a 0,40', () => {
    expect(coefficientCmMixte(m('concentree', 100, 0.5, -20))).toBeCloseTo(0.4, 12);
  });
});

describe('|M_s| > |M_h| : alpha_h = M_h / M_s', () => {
  it('alpha_h = 0,5 : repartie 0,95 + 0,025 = 0,975 ; concentree 0,90 + 0,05 = 0,95', () => {
    expect(coefficientCmMixte(m('repartie', 50, 1, 100))).toBeCloseTo(0.975, 12);
    expect(coefficientCmMixte(m('concentree', 50, 1, 100))).toBeCloseTo(0.95, 12);
  });

  it('alpha_h = -0,5, psi = 0,5 : repartie 0,95 - 0,025 = 0,925', () => {
    expect(coefficientCmMixte(m('repartie', -50, 0.5, 100))).toBeCloseTo(0.925, 12);
  });

  it('alpha_h = -0,5, psi = -0,5 : facteur (1 + 2 psi) = 0, repartie 0,95, concentree 0,90', () => {
    expect(coefficientCmMixte(m('repartie', -50, -0.5, 100))).toBeCloseTo(0.95, 12);
    expect(coefficientCmMixte(m('concentree', -50, -0.5, 100))).toBeCloseTo(0.9, 12);
  });

  it('M_h = 0 : redonne la ligne des appuis simples', () => {
    expect(coefficientCmMixte(m('repartie', 0, 0, 80))).toBeCloseTo(0.95, 12);
    expect(coefficientCmDiagramme(m('concentree', 0, 0, 80))).toBeCloseTo(0.9, 12);
  });
});

describe('controles', () => {
  it('refuse psi hors de [-1 ; 1] et un diagramme nul', () => {
    expect(() => coefficientCmMixte(m('repartie', 100, 1.5, 50))).toThrow(/psi/);
    expect(() => coefficientCmMixte(m('repartie', 0, 0, 0))).toThrow(/nul/);
  });
});
