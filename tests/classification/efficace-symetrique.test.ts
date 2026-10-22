import { describe, expect, it } from 'vitest';
import { kSigmaInterne, rhoConsole, rhoInterne, sectionEfficaceSymetrique } from '../../src/classification/efficace-symetrique';
import { materiau, proprietes, type Profil } from '../../src/index';

/**
 * Section efficace d'un I soude elance, EN 1993-1-5 §4.4.
 *
 * h = 1000, b = 300, t_w = 6, t_f = 12 mm, sans cordon (a = 0), S355.
 * Valeurs attendues calculees par un script independant du noyau (meme
 * methode, ecrite a part) : A = 13 056 mm2, I_y = 2 222 002 688 mm4.
 *   semelle : c = 147, lambda_p = 0,8085, rho = 0,9493
 *   ame comprimee : c = 976, lambda_p = 3,5199, rho = 0,2663 ;  A_eff = 8 401,8 mm2
 *   ame flechie : psi = -0,97225, k_sigma = 23,170, lambda_p = 1,4625, rho = 0,6316 ;
 *                 partie perdue 182,30 mm centree a z = 271,82 mm ;
 *                 z_G = -32,734 mm, I_eff = 2 081 856 702 mm4, W_eff,y = 3 907 869 mm3
 *   flexion z : y_G = -3,0505 mm, W_eff,z = 327 312 mm3
 */

const I: Profil = { type: 'I-soude', nom: 'I soude 1000', h: 1000, b: 300, tw: 6, tf: 12, a: 0 };

function eff() {
  const prop = proprietes(I);
  return { prop, e: sectionEfficaceSymetrique(I as never, materiau('S355', I), prop) };
}

describe('coefficients des tableaux 4.1 et 4.2', () => {
  it('k_sigma des parois internes', () => {
    expect(kSigmaInterne(1)).toBe(4);
    expect(kSigmaInterne(0.5)).toBeCloseTo(8.2 / 1.55, 12);
    expect(kSigmaInterne(0)).toBe(7.81);
    expect(kSigmaInterne(-0.5)).toBeCloseTo(7.81 + 3.145 + 2.445, 12);
    expect(kSigmaInterne(-1)).toBe(23.9);
    expect(kSigmaInterne(-2)).toBeCloseTo(5.98 * 9, 12);
  });

  it('rho : bornes de non-reduction', () => {
    expect(rhoInterne(0.673, 1)).toBe(1);
    expect(rhoInterne(1, 1)).toBeCloseTo(0.78, 12);
    expect(rhoConsole(0.748)).toBe(1);
    expect(rhoConsole(1)).toBeCloseTo(0.812, 12);
  });
});

describe('I soude 1000 × 300 × 6 × 12, S355', () => {
  it('section brute conforme au calcul a la main', () => {
    const { prop } = eff();
    expect(prop.A).toBeCloseTo(13056, 6);
    expect(prop.Iy / 2222002688).toBeCloseTo(1, 8);
  });

  it('A_eff = 8 401,8 mm2 sous compression pure', () => {
    expect(eff().e.Aeff).toBeCloseTo(8401.8, 1);
  });

  it('ame flechie : psi = -0,97225, rho = 0,6316', () => {
    const ame = eff().e.parois.find((p) => p.paroi === 'ame' && p.cas === 'flexion y');
    expect(ame?.psi).toBeCloseTo(-0.97225, 5);
    expect(ame?.kSigma).toBeCloseTo(23.1703, 3);
    expect(ame?.rho).toBeCloseTo(0.63162, 5);
  });

  it('W_eff,y = 3 907 869 mm3, centre de gravite descendu de 32,73 mm', () => {
    const { e } = eff();
    expect(e.zG_y).toBeCloseTo(-32.7345, 3);
    expect(e.Weff_y / 3907869).toBeCloseTo(1, 6);
  });

  it('W_eff,z = 327 312 mm3', () => {
    expect(eff().e.Weff_z / 327312.2).toBeCloseTo(1, 6);
  });

  it('un tube circulaire de classe 4 leve', () => {
    const chs: Profil = { type: 'tube-circulaire', nom: 'CHS', d: 1000, t: 4, finition: 'chaud' };
    expect(() => sectionEfficaceSymetrique(chs as never, materiau('S355', chs), proprietes(chs))).toThrow(/1993-1-6/);
  });
});
