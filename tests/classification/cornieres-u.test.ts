import { describe, expect, it } from 'vitest';
import { classifier, corniereCatalogue, facteurRho, familles, materiau, profilUCatalogue, proprietes, sectionEfficace, type Profil } from '../../src/index';
import { PUBLIE_EFFICACE_L_S355 } from '../catalogue/valeurs-publiees';

function classe(p: Profil, nuance: 'S235' | 'S355', N: number, My = 0, Mz = 0) {
  return classifier(p, materiau(nuance, p), proprietes(p), { N, My, Mz });
}

describe('classification des cornieres, tableau 5.2 feuille 3', () => {
  it('L 100x100x10 S235 comprimee : h/t = 10 <= 15, (b+h)/2t = 10 <= 11,5 : classe 3, jamais 1 ou 2', () => {
    const r = classe(corniereCatalogue('L 100x100x10'), 'S235', 100);
    expect(r.classe).toBe(3);
  });

  it('L 100x100x6 S235 comprimee : h/t = 16,7 > 15 : classe 4', () => {
    const r = classe(corniereCatalogue('L 100x100x6'), 'S235', 100);
    expect(r.classe).toBe(4);
    expect(r.gouvernante).toContain('h / t');
  });

  it('corniere tendue : classe 1', () => {
    expect(classe(corniereCatalogue('L 100x100x6'), 'S235', -100).classe).toBe(1);
  });

  it('S355, cornieres a ailes egales : classe 4 pour les profils que le producteur classe 4 ; desaccords tous a la limite', () => {
    const egales = familles().find((f) => f.famille === 'L-egales')?.noms ?? [];
    const desaccords: string[] = [];
    for (const n of egales) {
      const c = corniereCatalogue(n);
      const cl = classe(c, 'S355', 100).classe;
      const publie = PUBLIE_EFFICACE_L_S355[n];
      // Le tableau du producteur ne liste que les cornieres de classe 4.
      if ((publie !== undefined) === (cl === 4)) continue;
      desaccords.push(n);
      // Le producteur prend f_y de la norme de produit (EN 10025-2 : 345 MPa
      // pour 16 < t <= 40 mm), l'outil le tableau 3.1 (355 MPa jusqu'a 40 mm) ;
      // avec 345 MPa, le desaccord disparait.
      const eps345 = Math.sqrt(235 / 345);
      const classe345 = Math.max(c.h, c.b) / c.t > 15 * eps345 || (c.h + c.b) / (2 * c.t) > 11.5 * eps345 ? 4 : 3;
      expect(c.t).toBeGreaterThan(16);
      expect(classe345 === 4).toBe(publie !== undefined);
    }
    expect(desaccords).toEqual(['L 300x300x32', 'L 180x180x19', 'L 160x160x17']);
  });
});

describe('section efficace, EN 1993-1-5 §4.4', () => {
  it('rho : 1 sous les seuils 0,673 et 0,748, (lambda - 0,22)/lambda^2 et (lambda - 0,188)/lambda^2 au-dela', () => {
    expect(facteurRho('interne', 0.673)).toBe(1);
    expect(facteurRho('interne', 1)).toBeCloseTo(0.78, 10);
    expect(facteurRho('console', 0.748)).toBe(1);
    expect(facteurRho('console', 1)).toBeCloseTo(0.812, 10);
  });

  it('L 100x100x6 S235, calcul a la main : lambda_p = 16,67 / (28,4 x 0,6557) = 0,895, rho = 0,882', () => {
    const c = corniereCatalogue('L 100x100x6');
    const s = sectionEfficace(c, materiau('S235', c));
    const lp = 100 / 6 / (28.4 * Math.sqrt(0.43));
    const rho = (lp - 0.188) / lp ** 2;
    expect(s.parois[0].lambdaP).toBeCloseTo(lp, 10);
    expect(s.parois[0].rho).toBeCloseTo(rho, 10);
    // Deux rectangles d'extremite retires : (1 - rho) x 100 x 6 chacun.
    expect(s.Aeff).toBeCloseTo(proprietes(c).A - 2 * (1 - rho) * 100 * 6, 0);
    // Les extremites retirees rapprochent le centre de gravite du talon.
    expect(s.eNy).toBeLessThan(0);
    expect(s.eNz).toBeCloseTo(s.eNy, 9);
  });

  it('S355 : A_eff / A du producteur retrouve (ecart <= 1,2 %) sur les 109 cornieres de classe 4', () => {
    let pire = 0;
    let nom = '';
    for (const [n, P] of Object.entries(PUBLIE_EFFICACE_L_S355)) {
      const c = corniereCatalogue(n);
      const s = sectionEfficace(c, materiau('S355', c));
      const e = Math.abs(s.Aeff / proprietes(c).A - P.Aeff / P.A);
      if (e > pire) {
        pire = e;
        nom = n;
      }
    }
    console.log('A_eff / A, ecart maximal', pire.toFixed(4), nom);
    expect(pire).toBeLessThan(0.012);
  });

  it('section entierement efficace : A_eff = A, e_N nul', () => {
    const c = corniereCatalogue('L 100x100x10');
    const s = sectionEfficace(c, materiau('S235', c));
    expect(s.Aeff).toBeCloseTo(proprietes(c).A, 6);
    expect(s.eNy).toBeCloseTo(0, 9);
    expect(s.motif).toContain('entierement efficaces');
  });
});

describe('classification des U, 2L et 2U', () => {
  it('UPE 200 S235 comprime : ame (200 - 22 - 26)/6 = 25,3 <= 33 ; ailes (80 - 6 - 13)/11 = 5,5 <= 9 : classe 1', () => {
    const r = classe(profilUCatalogue('UPE 200'), 'S235', 300);
    expect(r.parois.find((x) => x.paroi === 'ame')?.elancement).toBeCloseTo(152 / 6, 6);
    expect(r.classe).toBe(1);
  });

  it('U sous M_z : ame classee en compression uniforme', () => {
    const r = classe(profilUCatalogue('UPE 400'), 'S355', 0, 0, 10);
    expect(r.parois.find((x) => x.paroi === 'ame')?.detail).toContain('M_z');
  });

  it('2L : chaque corniere classee (feuille 3) ; 2U : ame et ailes du U', () => {
    const c = corniereCatalogue('L 100x100x6');
    expect(classe({ type: '2L', nom: '2L', corniere: c, ecartement: 10, accolee: 'h' }, 'S235', 100).classe).toBe(4);
    const u = profilUCatalogue('UPE 200');
    expect(classe({ type: '2U', nom: '2U', profilU: u, ecartement: 10 }, 'S235', 300).classe).toBe(1);
  });

  it('2L de classe 4 : A_eff double de celui d une corniere', () => {
    const c = corniereCatalogue('L 100x100x6');
    const m = materiau('S235', c);
    const s1 = sectionEfficace(c, m);
    const s2 = sectionEfficace({ type: '2L', nom: '2L', corniere: c, ecartement: 10, accolee: 'h' }, m);
    expect(s2.Aeff).toBeCloseTo(2 * s1.Aeff, 3);
    expect(s2.eNy).toBeCloseTo(0, 9);
  });
});
