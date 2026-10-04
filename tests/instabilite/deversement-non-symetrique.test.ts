import { describe, expect, it } from 'vitest';
import { corniereCatalogue, deversementNonSymetrique, ec3Recommande, epaisseurMax, materiau, profilUCatalogue, proprietes, type Materiau, type Profil } from '../../src/index';
import { PUBLIE_MB_UPE } from '../catalogue/valeurs-publiees';

const P = ec3Recommande();
const uniforme = { type: 'lineaire' as const, psi: 1 };

function matProduit(p: Profil): Materiau {
  const t = epaisseurMax(p);
  return { nuance: 'S355', fy: t <= 16 ? 355 : 345, fu: 470, epaisseur: t };
}

describe('deversement des U, methode generale §6.3.2.2', () => {
  it('UPE 200, 3 m, moment uniforme : M_cr a trois termes avec I_z, I_t, I_w du U ; courbe d', () => {
    const u = profilUCatalogue('UPE 200');
    const pr = proprietes(u);
    const m = materiau('S235', u);
    const d = deversementNonSymetrique(u, m, pr, 1, null, 20, false, 3000, uniforme, 'centre', null, P);
    const Mcr = ((Math.PI ** 2 * 210000 * pr.Iz) / 3000 ** 2) * Math.sqrt(pr.Iw / pr.Iz + (3000 ** 2 * 81000 * pr.It) / (Math.PI ** 2 * 210000 * pr.Iz)) / 1e6;
    expect(d.M_cr?.M_cr).toBeCloseTo(Mcr, 6);
    expect(d.courbe).toBe('d');
    const lambda = Math.sqrt((pr.Wpl_y * 235) / (Mcr * 1e6));
    const Phi = 0.5 * (1 + 0.76 * (lambda - 0.2) + lambda * lambda);
    const chi = 1 / (Phi + Math.sqrt(Phi * Phi - lambda * lambda));
    expect(d.Mb_Rd).toBeCloseTo((chi * pr.Wpl_y * 235) / 1e6, 6);
    expect(d.motif).toContain('centre de cisaillement');
  });

  it('M_cr recoupe le producteur : son M_b,Rd (§6.3.2.3, courbe d, annexe britannique) retrouve a 1,5 % pres', () => {
    let pire = 0;
    let ou = '';
    for (const [n, val] of Object.entries(PUBLIE_MB_UPE)) {
      const u = profilUCatalogue(n);
      const pr = proprietes(u);
      const m = matProduit(u);
      for (const [L, pub] of Object.entries(val)) {
        const d = deversementNonSymetrique(u, m, pr, 1, null, 1, false, Number(L) * 1000, uniforme, 'centre', null, P);
        const Mpl = (pr.Wpl_y * m.fy) / 1e6;
        const lam = Math.sqrt(Mpl / (d.M_cr?.M_cr ?? 1));
        // §6.3.2.3 : lambda_LT,0 = 0,4, beta = 0,75, courbe d ; f = 1 (C_1 = 1).
        const Phi = 0.5 * (1 + 0.76 * (lam - 0.4) + 0.75 * lam * lam);
        const chi = lam <= 0.4 ? 1 : Math.min(1, 1 / lam ** 2, 1 / (Phi + Math.sqrt(Phi * Phi - 0.75 * lam * lam)));
        const e = Math.abs((chi * Mpl) / pub - 1);
        if (e > pire) {
          pire = e;
          ou = `${n} L = ${L} m`;
        }
      }
    }
    console.log('UPE M_b,Rd (6.3.2.3)', (pire * 100).toFixed(2), '%', ou);
    expect(pire).toBeLessThan(0.015);
  });

  it('methode generale de l outil : plus prudente que la valeur publiee (annexe britannique)', () => {
    const u = profilUCatalogue('UPE 400');
    const d = deversementNonSymetrique(u, matProduit(u), proprietes(u), 1, null, 1, false, 3000, uniforme, 'centre', null, P);
    expect(d.Mb_Rd ?? 0).toBeLessThan(PUBLIE_MB_UPE['UPE 400']['3']);
  });
});

describe('deversement des cornieres et cas sans objet', () => {
  it('corniere flechie autour de u sans M_cr : NON VERIFIE (a fournir), jamais satisfait', () => {
    const c = corniereCatalogue('L 100x100x10');
    const d = deversementNonSymetrique(c, materiau('S235', c), proprietes(c), 3, null, 5, false, 2000, uniforme, 'centre', null, P);
    expect(d.applicable).toBe(false);
    expect(d.aFournir).toBe(true);
    expect(d.motif).toContain('NON VERIFIE');
  });

  it('corniere avec M_cr saisi : methode generale, courbe d', () => {
    const c = corniereCatalogue('L 100x100x10');
    const pr = proprietes(c);
    const d = deversementNonSymetrique(c, materiau('S235', c), pr, 3, null, 5, false, 2000, uniforme, 'centre', 20, P);
    expect(d.applicable).toBe(true);
    expect(d.lambda_LT).toBeCloseTo(Math.sqrt((pr.Wel_u * 235) / 20e6), 10);
  });

  it('sans moment fort, maintien continu, 2L flechi autour de son axe faible : sans objet', () => {
    const c = corniereCatalogue('L 100x100x10');
    const m = materiau('S235', c);
    expect(deversementNonSymetrique(c, m, proprietes(c), 3, null, 0, false, 2000, uniforme, 'centre', null, P).aFournir).toBe(false);
    expect(deversementNonSymetrique(c, m, proprietes(c), 3, null, 5, true, 2000, uniforme, 'centre', null, P).motif).toContain('maintenue');
    const deux = { type: '2L' as const, nom: '2L', corniere: c, ecartement: 10, accolee: 'h' as const };
    const p2 = proprietes(deux);
    if (p2.Iy < p2.Iz) expect(deversementNonSymetrique(deux, m, p2, 3, null, 5, false, 2000, uniforme, 'centre', null, P).motif).toContain('axe faible');
  });
});
