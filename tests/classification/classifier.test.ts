import { describe, expect, it } from 'vitest';
import { classifier, limitesParoiInterne, materiau, profilCatalogue, proprietes } from '../../src/index';

function classe(nom: string, nuance: 'S235' | 'S355', N: number, My: number) {
  const p = profilCatalogue(nom);
  return classifier(p, materiau(nuance, p), proprietes(p), { N, My, Mz: 0 });
}

describe('classification, tableau 5.2', () => {
  it('limites de paroi interne : flexion 72/83/124 epsilon, compression 33/38/42 epsilon', () => {
    expect(limitesParoiInterne(1, 0.5, -1)).toEqual([72, 83, 124]);
    const c = limitesParoiInterne(1, 1, 1);
    expect(c[0]).toBeCloseTo(33, 10);
    expect(c[1]).toBeCloseTo(38, 10);
    expect(c[2]).toBeCloseTo(42, 10);
  });

  it('IPE 300 S235 en flexion pure : classe 1 (ame c/t = 35,0, semelle 5,28)', () => {
    const r = classe('IPE 300', 'S235', 0, 100);
    expect(r.classe).toBe(1);
    expect(r.parois[0].elancement).toBeCloseTo(248.6 / 7.1, 6);
    expect(r.parois[1].elancement).toBeCloseTo(56.45 / 10.7, 6);
  });

  it('LA CLASSE DEPEND DE LA SOLLICITATION : le meme IPE 300 bascule en classe 2 en compression', () => {
    expect(classe('IPE 300', 'S235', 1000, 0).classe).toBe(2);
    expect(classe('IPE 300', 'S235', 1000, 0).gouvernante).toBe('ame');
  });

  it('IPE 600 S355 : classe 1 en flexion, classe 4 en compression pure', () => {
    expect(classe('IPE 600', 'S355', 0, 300).classe).toBe(1);
    expect(classe('IPE 600', 'S355', 2000, 0).classe).toBe(4);
  });

  it('flexion composee : alpha entre 0,5 et 1 ; psi > -1', () => {
    const r = classe('IPE 300', 'S235', 200, 80);
    expect(r.parois[0].detail).toContain('alpha');
  });

  it('tube circulaire : d/t compare a 50/70/90 epsilon^2', () => {
    const p = { type: 'tube-circulaire', nom: 'CHS', d: 168.3, t: 3, finition: 'chaud' } as const;
    const r = classifier(p, materiau('S355', p), proprietes(p), { N: 100, My: 0, Mz: 0 });
    // d/t = 56,1 ; epsilon^2 = 0,662 : limites 33,1 / 46,3 / 59,6 -> classe 3
    expect(r.classe).toBe(3);
  });

  it('tube rectangulaire 300 x 100 x 6 S235 : classe 1 sous M_y, classe 4 sous M_z (parois laterales comprimees)', () => {
    const p = { type: 'tube-rectangulaire', nom: 'RHS', h: 300, b: 100, t: 6, finition: 'chaud' } as const;
    const m = materiau('S235', p);
    // (h - 3t) / t = 282 / 6 = 47 : <= 72 en flexion, > 42 en compression uniforme.
    expect(classifier(p, m, proprietes(p), { N: 0, My: 50, Mz: 0 }).classe).toBe(1);
    const r = classifier(p, m, proprietes(p), { N: 0, My: 0, Mz: 20 });
    expect(r.classe).toBe(4);
    expect(r.gouvernante).toContain('laterale');
  });
});
