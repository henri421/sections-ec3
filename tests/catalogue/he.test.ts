import { describe, expect, it } from 'vitest';
import { familles, profilCatalogue, proprietes } from '../../src/index';
import { PUBLIE_HE } from './valeurs-publiees-he';

/**
 * Poutrelles HE des series A, B et M, de 100 a 1000 (lot 8.4) : chaque profil
 * du catalogue porte les dimensions publiees, et ses proprietes recalculees
 * recoupent les valeurs publiees.
 *
 * Tolerances : 0,6 % sur A, I et W_pl (arrondi de publication a trois
 * chiffres, une erreur de saisie de dimension depasse largement ce seuil) ;
 * 1 % sur I_w ; 4 % sur I_t, que l'Orange Book calcule avec une autre prise
 * en compte des conges (HEB 300 : 185 cm4 recalcules, comme les tables
 * classiques, contre 189 publies).
 */

function ecart(calcule: number, publie: number): number {
  return Math.abs(calcule / publie - 1);
}

describe('catalogue HE (series A, B, M)', () => {
  it('72 profils : HEA, HEB et HEM de 100 a 1000', () => {
    const noms = familles()
      .filter((f) => ['HEA', 'HEB', 'HEM'].includes(f.famille))
      .flatMap((f) => f.noms);
    expect(noms.sort()).toEqual(Object.keys(PUBLIE_HE).sort());
  });

  it('chaque famille HE porte sa source, sa date et son perimetre', () => {
    for (const nom of ['HEA', 'HEB', 'HEM']) {
      const f = familles().find((x) => x.famille === nom);
      expect(f, nom).toBeDefined();
      expect(f!.type).toBe('I-lamine');
      expect(f!.source.length).toBeGreaterThan(10);
      expect(f!.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(f!.perimetre).toContain('1000');
    }
  });

  for (const [nom, v] of Object.entries(PUBLIE_HE)) {
    const [h, b, tw, tf, r, A, Iy, Iz, Wply, Wplz, It, Iw] = v;
    it(`${nom} : dimensions publiees et proprietes recoupees`, () => {
      const p = profilCatalogue(nom);
      expect([p.h, p.b, p.tw, p.tf, p.r]).toEqual([h, b, tw, tf, r]);
      const q = proprietes(p);
      expect(ecart(q.A / 1e2, A)).toBeLessThan(0.006);
      expect(ecart(q.Iy / 1e4, Iy)).toBeLessThan(0.006);
      expect(ecart(q.Iz / 1e4, Iz)).toBeLessThan(0.006);
      expect(ecart(q.Wpl_y / 1e3, Wply)).toBeLessThan(0.006);
      expect(ecart(q.Wpl_z / 1e3, Wplz)).toBeLessThan(0.006);
      expect(ecart(q.Iw / 1e6, Iw)).toBeLessThan(0.01);
      expect(ecart(q.It / 1e4, It)).toBeLessThan(0.04);
    });
  }
});
