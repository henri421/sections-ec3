import { describe, expect, it } from 'vitest';
import { familles, profilCatalogue, proprietes, provenance } from '../../src/index';

/**
 * Recoupement des proprietes RECALCULEES avec les valeurs PUBLIEES par les
 * catalogues de producteurs (cm2, cm4, cm3, cm6). Detecte une erreur de
 * saisie des dimensions. Tolerance declaree : 0,5 % sur A, I, W_pl ;
 * 1 % sur I_t et I_w.
 */
const PUBLIE: Record<string, { A: number; Iy: number; Iz: number; Wply: number; Wplz: number; It: number; Iw: number }> = {
  'IPE 200': { A: 28.48, Iy: 1943, Iz: 142.4, Wply: 220.6, Wplz: 44.61, It: 6.98, Iw: 12990 },
  'IPE 300': { A: 53.81, Iy: 8356, Iz: 603.8, Wply: 628.4, Wplz: 125.2, It: 20.12, Iw: 125900 },
  'IPE 500': { A: 115.5, Iy: 48200, Iz: 2142, Wply: 2194, Wplz: 335.9, It: 89.29, Iw: 1249000 },
  'HEA 200': { A: 53.83, Iy: 3692, Iz: 1336, Wply: 429.5, Wplz: 203.8, It: 20.98, Iw: 108000 },
  'HEB 200': { A: 78.08, Iy: 5696, Iz: 2003, Wply: 642.5, Wplz: 305.8, It: 59.28, Iw: 171100 },
  'HEB 300': { A: 149.1, Iy: 25170, Iz: 8563, Wply: 1869, Wplz: 870.1, It: 185.0, Iw: 1688000 },
};

function ecart(calcule: number, publie: number): number {
  return Math.abs(calcule / publie - 1);
}

describe('catalogue', () => {
  it('trois familles, chacune avec source et date', () => {
    const f = familles();
    expect(f.map((x) => x.famille)).toEqual(['IPE', 'HEA', 'HEB']);
    for (const x of f) {
      expect(x.source.length).toBeGreaterThan(10);
      expect(x.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('aucune classe stockee dans le catalogue', () => {
    expect(JSON.stringify(profilCatalogue('IPE 300'))).not.toContain('classe');
  });

  for (const [nom, ref] of Object.entries(PUBLIE)) {
    it(`${nom} : proprietes recalculees conformes aux valeurs publiees`, () => {
      const p = proprietes(profilCatalogue(nom));
      expect(ecart(p.A / 1e2, ref.A)).toBeLessThan(0.005);
      expect(ecart(p.Iy / 1e4, ref.Iy)).toBeLessThan(0.005);
      expect(ecart(p.Iz / 1e4, ref.Iz)).toBeLessThan(0.005);
      expect(ecart(p.Wpl_y / 1e3, ref.Wply)).toBeLessThan(0.005);
      expect(ecart(p.Wpl_z / 1e3, ref.Wplz)).toBeLessThan(0.005);
      expect(ecart(p.It / 1e4, ref.It)).toBeLessThan(0.01);
      expect(ecart(p.Iw / 1e6, ref.Iw)).toBeLessThan(0.01);
    });
  }

  it('tube rectangulaire 200 x 100 x 8 fini a chaud : A = 44,8 cm2, I_y = 2 234 cm4, I_t = 1 804 cm4', () => {
    const p = proprietes({ type: 'tube-rectangulaire', nom: 'RHS', h: 200, b: 100, t: 8, finition: 'chaud' });
    expect(ecart(p.A / 1e2, 44.8)).toBeLessThan(0.005);
    expect(ecart(p.Iy / 1e4, 2234)).toBeLessThan(0.005);
    expect(ecart(p.Iz / 1e4, 739)).toBeLessThan(0.005);
    expect(ecart(p.It / 1e4, 1804)).toBeLessThan(0.01);
  });

  it('tube circulaire 168,3 x 8 : A = 40,3 cm2, I = 1 297 cm4, W_pl = 206 cm3', () => {
    const p = proprietes({ type: 'tube-circulaire', nom: 'CHS', d: 168.3, t: 8, finition: 'chaud' });
    expect(ecart(p.A / 1e2, 40.3)).toBeLessThan(0.005);
    expect(ecart(p.Iy / 1e4, 1297)).toBeLessThan(0.005);
    expect(ecart(p.Wpl_y / 1e3, 206)).toBeLessThan(0.005);
  });

  it('profil absent : leve ; provenance d une section saisie', () => {
    expect(() => profilCatalogue('IPE 999')).toThrow('absent');
    expect(provenance('IPE 300')).toContain('Euronorm 19-57');
    expect(provenance('ma section')).toBe('section saisie');
  });
});
