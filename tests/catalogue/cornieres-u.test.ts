import { describe, expect, it } from 'vitest';
import { corniereCatalogue, excentriciteCisaillementU, familles, profilCatalogue, profilUCatalogue, proprietes, type Proprietes } from '../../src/index';
import { PUBLIE_2L, PUBLIE_L, PUBLIE_U } from './valeurs-publiees';

/**
 * Recoupement des proprietes RECALCULEES sur le contour avec les valeurs
 * PUBLIEES (trois chiffres significatifs). Les tolerances sont celles
 * constatees sur toute la gamme, arrondies au-dessus, et justifiees :
 *   - arrondi de publication : 0,5 % au plus sur trois chiffres ;
 *   - grandes cornieres (250 et 300) et petites cornieres a r_2 > t (rayon de
 *     rive borne a t) : jusqu'a 1,1 % sur A et 2 % sur les inerties ;
 *   - UPN : convention de pente calee (voir `profilUCatalogue`).
 * Valeurs publiees ecartees, avec leur motif, plutot que d'elargir les
 * tolerances pour toute la gamme.
 */
const ECARTEES: Record<string, string> = {
  'L 200x200x16': 'I_y publie (2 430 cm4) incoherent avec A et c publies : ecart isole de 3,7 %, a recouper',
};

function ecart(calcule: number, publie: number): number {
  return Math.abs(calcule / publie - 1);
}

function maxEcarts(noms: string[], f: (nom: string) => Record<string, [number, number]>): Record<string, { e: number; nom: string }> {
  const m: Record<string, { e: number; nom: string }> = {};
  for (const nom of noms) {
    if (ECARTEES[nom] !== undefined) continue;
    for (const [k, [c, p]] of Object.entries(f(nom))) {
      const e = ecart(c, p);
      if (m[k] === undefined || e > m[k].e) m[k] = { e, nom };
    }
  }
  return m;
}

const nomsFamille = (f: string): string[] => familles().find((x) => x.famille === f)?.noms ?? [];

function grandeursL(p: Proprietes, publie: Record<string, number>, egales: boolean): Record<string, [number, number]> {
  const g: Record<string, [number, number]> = {
    A: [p.A / 1e2, publie.A],
    Iy: [p.Iy / 1e4, publie.Iy],
    Iu: [p.Iu / 1e4, publie.Iu],
    Iv: [p.Iv / 1e4, publie.Iv],
    Wel: [p.Wel_y / 1e3, egales ? publie.Wel : publie.Wely],
  };
  if (egales) {
    g.c = [p.zG / 10, publie.c];
  } else {
    g.cy = [p.zG / 10, publie.cy];
    g.cz = [p.yG / 10, publie.cz];
    g.Iz = [p.Iz / 1e4, publie.Iz];
    g.tana = [Math.abs(Math.tan(p.alpha)), publie.tana];
  }
  return g;
}

describe('catalogue des cornieres et profils en U', () => {
  it('sept familles, chacune avec type, source et date', () => {
    expect(familles().map((x) => `${x.famille}:${x.type}`)).toEqual(['IPE:I-lamine', 'HEA:I-lamine', 'HEB:I-lamine', 'L-egales:L', 'L-inegales:L', 'UPE:U', 'UPN:U']);
    for (const f of familles()) {
      expect(f.source.length).toBeGreaterThan(10);
      expect(f.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('acces type : une corniere n est pas un profil en I, et inversement', () => {
    expect(() => profilCatalogue('L 100x100x10')).toThrow('pas un profil en I');
    expect(() => corniereCatalogue('IPE 300')).toThrow('pas une corniere');
    expect(() => profilUCatalogue('L 100x100x10')).toThrow('pas un profil en U');
    expect(corniereCatalogue('L 100x100x10').It).toBeCloseTo(6.97e4, -1);
  });

  it('cornieres a ailes egales : A <= 1,1 %, I_y, I_u, W_el <= 2,1 %, I_v <= 3,3 %, c <= 1 %', () => {
    const m = maxEcarts(nomsFamille('L-egales'), (n) => grandeursL(proprietes(corniereCatalogue(n)), PUBLIE_L[n], true));
    console.log('L egales', Object.fromEntries(Object.entries(m).map(([k, v]) => [k, `${(v.e * 100).toFixed(2)} % ${v.nom}`])));
    expect(m.A.e).toBeLessThan(0.011);
    for (const k of ['Iy', 'Iu', 'Wel']) expect(m[k].e).toBeLessThan(0.021);
    // I_v, faible, est le plus sensible au rayon de rive borne a t (L 45x45x3 : r_2 = 3,5 > t = 3).
    expect(m.Iv.e).toBeLessThan(0.033);
    expect(m.c.e).toBeLessThan(0.01);
  });

  it('cornieres a ailes inegales : toutes grandeurs <= 0,7 %, tan alpha compris', () => {
    const m = maxEcarts(nomsFamille('L-inegales'), (n) => grandeursL(proprietes(corniereCatalogue(n)), PUBLIE_L[n], false));
    console.log('L inegales', Object.fromEntries(Object.entries(m).map(([k, v]) => [k, `${(v.e * 100).toFixed(2)} % ${v.nom}`])));
    for (const v of Object.values(m)) expect(v.e).toBeLessThan(0.007);
  });

  it('UPE : A, I_y, I_z, W_el,y, W_pl,y <= 0,5 % ; e_0 des parois minces <= 1 %', () => {
    const m = maxEcarts(nomsFamille('UPE'), (n) => {
      const p = proprietes(profilUCatalogue(n));
      const u = profilUCatalogue(n);
      const P = PUBLIE_U[n];
      return { A: [p.A / 1e2, P.A], Iy: [p.Iy / 1e4, P.Iy], Iz: [p.Iz / 1e4, P.Iz], Wely: [p.Wel_y / 1e3, P.Wely], Wply: [p.Wpl_y / 1e3, P.Wply], e0: [excentriciteCisaillementU(u, p.Iy) / 10, P.e0] };
    });
    console.log('UPE', Object.fromEntries(Object.entries(m).map(([k, v]) => [k, `${(v.e * 100).toFixed(2)} % ${v.nom}`])));
    for (const k of ['A', 'Iy', 'Iz', 'Wely', 'Wply']) expect(m[k].e).toBeLessThan(0.005);
    expect(m.e0.e).toBeLessThan(0.01);
  });

  it('UPN : A, I_y, I_z, W_el,y <= 1 % ; W_pl,y <= 2,1 % ; e_0 des parois minces <= 13 % (valeur publiee retenue)', () => {
    const m = maxEcarts(nomsFamille('UPN'), (n) => {
      const p = proprietes(profilUCatalogue(n));
      const u = profilUCatalogue(n);
      const P = PUBLIE_U[n];
      return { A: [p.A / 1e2, P.A], Iy: [p.Iy / 1e4, P.Iy], Iz: [p.Iz / 1e4, P.Iz], Wely: [p.Wel_y / 1e3, P.Wely], Wply: [p.Wpl_y / 1e3, P.Wply], e0: [excentriciteCisaillementU(u, p.Iy) / 10, P.e0] };
    });
    console.log('UPN', Object.fromEntries(Object.entries(m).map(([k, v]) => [k, `${(v.e * 100).toFixed(2)} % ${v.nom}`])));
    for (const k of ['A', 'Iy', 'Iz', 'Wely']) expect(m[k].e).toBeLessThan(0.01);
    // UPN 320 a 400 : convention de pente a 5 % calee sur A ; W_pl,y a 2 %.
    expect(m.Wply.e).toBeLessThan(0.021);
    expect(m.e0.e).toBeLessThan(0.13);
  });

  it('modules en z des U : W_el,z publie arrondi a l entier, W_pl,z a 2,5 % (UPE 330 a 400 ecartes)', () => {
    for (const n of [...nomsFamille('UPE'), ...nomsFamille('UPN')]) {
      const p = proprietes(profilUCatalogue(n));
      const P = PUBLIE_U[n];
      expect(Math.abs(p.Wel_z / 1e3 - P.Welz)).toBeLessThan(0.5 + 0.01 * P.Welz);
      // W_pl,z publie des UPE 330, 360 et 400 hors tendance (UPE 400 : 191 publie
      // pour 221 recalcule, W_pl,z / W_el,z = 1,55 contre 1,80 sur le reste de la
      // gamme) : ecarte, a recouper.
      if (['UPE 330', 'UPE 360', 'UPE 400'].includes(n)) continue;
      expect(ecart(p.Wpl_z / 1e3, P.Wplz)).toBeLessThan(0.025);
    }
  });

  it('2L dos a dos : A, I_y et i_z publies pour chaque ecartement (<= 2 %)', () => {
    let pire = 0;
    let nomPire = '';
    for (const [n, P] of Object.entries(PUBLIE_2L)) {
      if (ECARTEES[n] !== undefined) continue;
      const c = corniereCatalogue(n);
      for (const [s, iz] of Object.entries(P.iz)) {
        const p = proprietes({ type: '2L', nom: `2 ${n}`, corniere: c, ecartement: Number(s), accolee: 'h' });
        for (const [calc, pub] of [[p.A / 1e2, P.A], [p.Iy / 1e4, P.Iy], [p.iz / 10, iz]]) {
          const e = ecart(calc, pub);
          if (e > pire) {
            pire = e;
            nomPire = `${n} s = ${s}`;
          }
        }
      }
    }
    console.log('2L', (pire * 100).toFixed(2), '%', nomPire);
    expect(pire).toBeLessThan(0.02);
  });

  it('U du catalogue : centre de cisaillement publie retenu (UPN 200 : e_0 = 23,6 mm)', () => {
    const u = profilUCatalogue('UPN 200');
    const p = proprietes(u);
    expect(u.e0).toBeCloseTo(23.6, 6);
    expect(p.yG + p.y0).toBeCloseTo(u.tw / 2 - 23.6, 6);
    expect(p.origineTorsion).toContain('producteur');
  });

  it('valeur publiee ecartee : motif ecrit', () => {
    expect(ECARTEES['L 200x200x16']).toContain('incoherent');
  });
});
