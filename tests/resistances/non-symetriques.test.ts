import { describe, expect, it } from 'vitest';
import {
  chargeCritiqueFlexionTorsion,
  classifier,
  corniereCatalogue,
  ec3Recommande,
  epaisseurMax,
  facteurReduction,
  flambementsNonSymetriques,
  interactionNonSymetrique,
  materiau,
  momentsDeCalcul,
  profilUCatalogue,
  proprietes,
  resistancesNonSymetriques,
  sectionEfficace,
  torsionFlexion,
  type LongueursFlambement,
  type Materiau,
  type Profil,
} from '../../src/index';
import { PUBLIE_FLAMBEMENT_L, PUBLIE_FLAMBEMENT_UPE } from '../catalogue/valeurs-publiees';

const P = ec3Recommande();
const L4: LongueursFlambement = { Lcr_y: 3000, Lcr_z: 3000, Lcr_v: 3000, L_T: 3000, barreDeTreillis: false };

describe('resistances de section, L et U', () => {
  it('UPE 200 S235 classe 1 : N_pl = A f_y, M_pl,y = W_pl,y f_y, A_v,z = A - 2 b t_f + (t_w + r) t_f', () => {
    const u = profilUCatalogue('UPE 200');
    const pr = proprietes(u);
    const m = materiau('S235', u);
    const r = resistancesNonSymetriques(u, m, pr, 1, null, P);
    expect(r.N_Rd).toBeCloseTo((pr.A * 235) / 1000, 6);
    expect(r.M1_Rd).toBeCloseTo((pr.Wpl_y * 235) / 1e6, 6);
    expect(r.Avz).toBeCloseTo(pr.A - 2 * 80 * 11 + (6 + 13) * 11, 6);
    expect(r.module).toBe('plastique');
  });

  it('corniere : moments projetes sur u, v (ailes egales : alpha = 45 degres)', () => {
    const c = corniereCatalogue('L 100x100x10');
    const pr = proprietes(c);
    const mf = momentsDeCalcul(c, pr, 10, 0);
    expect(mf.axes).toBe('uv');
    expect(mf.M1).toBeCloseTo(10 * Math.SQRT1_2, 6);
    expect(mf.M2).toBeCloseTo(10 * Math.SQRT1_2, 6);
  });

  it('critere lineaire (6.2) : N/N_Rd + M_1/M_1,Rd + M_2/M_2,Rd', () => {
    const u = profilUCatalogue('UPE 200');
    const pr = proprietes(u);
    const m = materiau('S235', u);
    const r = resistancesNonSymetriques(u, m, pr, 1, null, P);
    const i = interactionNonSymetrique(u, pr, 1, null, r, { N: 100, My: 10, Mz: 2, Vz: 0, Vy: 0 });
    expect(i.taux).toBeCloseTo(100 / r.N_Rd + 10 / r.M1_Rd + 2 / r.M2_Rd, 10);
  });

  it('classe 4 : A_eff, et moments N e_N ajoutes (6.44)', () => {
    const c = corniereCatalogue('L 100x100x6');
    const pr = proprietes(c);
    const m = materiau('S235', c);
    const cl = classifier(c, m, pr, { N: 50, My: 0, Mz: 0 });
    expect(cl.classe).toBe(4);
    const eff = sectionEfficace(c, m);
    const r = resistancesNonSymetriques(c, m, pr, 4, eff, P);
    expect(r.N_Rd).toBeCloseTo((eff.Aeff * 235) / 1000, 6);
    const i = interactionNonSymetrique(c, pr, 4, eff, r, { N: 50, My: 0, Mz: 0, Vz: 0, Vy: 0 });
    // Ailes egales : e_N le long de l'axe de symetrie, moment additionnel autour d'un seul axe principal.
    expect(i.dM1 + i.dM2).toBeGreaterThan(0);
    expect(Math.min(i.dM1, i.dM2)).toBeCloseTo(0, 9);
    expect(i.taux).toBeGreaterThan(50 / r.N_Rd);
  });
});

describe('flexion-torsion, §6.3.1.4', () => {
  it('equation : deux axes de symetrie (c = 0) -> pas de couplage, N_T (les flexions sont verifiees a part)', () => {
    expect(chargeCritiqueFlexionTorsion(5, 3, 4, 0, 0, 100)).toBeCloseTo(4, 6);
  });

  it('equation : un axe de symetrie -> la flexion decouplee n est pas rendue comme mode couple', () => {
    // N_2 = 1 est la plus petite racine de la cubique, mais decouplee (c_2 = 0).
    const N = chargeCritiqueFlexionTorsion(900, 1, 600, 30, 0, 3000);
    expect(N).toBeGreaterThan(1);
    expect(N).toBeLessThan(600);
  });

  it('equation : un seul axe de symetrie -> racine de l equation du second degre', () => {
    const N1 = 900, N2 = 2000, NT = 600, c1 = 30, i02 = 3000;
    const beta = 1 - (c1 * c1) / i02;
    const attendu = (N1 + NT - Math.sqrt((N1 + NT) ** 2 - 4 * beta * N1 * NT)) / (2 * beta);
    expect(chargeCritiqueFlexionTorsion(N1, N2, NT, c1, 0, i02)).toBeCloseTo(attendu, 6);
  });

  it('UPN 200, L_T = 3 m : flexion-torsion sous N_1 et N_T, la flexion autour de z decouplee', () => {
    const u = profilUCatalogue('UPN 200');
    const pr = proprietes(u);
    const tf = torsionFlexion(u, pr, L4);
    const N1 = (Math.PI ** 2 * 210000 * pr.Iy) / 3000 ** 2;
    expect(tf.N_cr_TF).toBeLessThan(Math.min(N1, tf.N_cr_T));
    // i_0^2 = i_y^2 + i_z^2 + y_0^2 (z_0 nul par symetrie).
    expect(pr.z0).toBeCloseTo(0, 9);
    expect(tf.i0 ** 2).toBeCloseTo((pr.Iy + pr.Iz) / pr.A + pr.y0 ** 2, 6);
  });

  it('L 100x100x10, 3 m : modes y, z, v et flexion-torsion ; v gouverne la flexion, courbe b', () => {
    const c = corniereCatalogue('L 100x100x10');
    const pr = proprietes(c);
    const m = materiau('S235', c);
    const f = flambementsNonSymetriques(c, m, pr, 3, null, L4, P);
    expect(f.map((x) => x.mode)).toEqual(['flexion autour de y', 'flexion autour de z', 'flexion autour de v', 'torsion ou flexion-torsion']);
    expect(f.every((x) => x.courbe === 'b')).toBe(true);
    const v = f[2];
    expect(v.N_cr).toBeCloseTo((Math.PI ** 2 * 210000 * pr.Iv) / 3000 ** 2 / 1000, 6);
    expect(v.Nb_Rd).toBeLessThan(f[0].Nb_Rd);
    expect(f[3].motif).toContain('HORS NORME');
  });

  it('annexe BB.1.2 : lambda_eff,v = 0,35 + 0,7 lambda_v pour une corniere de treillis', () => {
    const c = corniereCatalogue('L 100x100x10');
    const pr = proprietes(c);
    const f = flambementsNonSymetriques(c, materiau('S235', c), pr, 3, null, { ...L4, barreDeTreillis: true }, P);
    expect(f[2].lambdaEff).toBeCloseTo(0.35 + 0.7 * f[2].lambda_, 10);
    expect(f[0].lambdaEff).toBeCloseTo(0.5 + 0.7 * f[0].lambda_, 10);
  });
});

describe('recoupement avec les resistances publiees par le producteur', () => {
  /** f_y de la norme de produit EN 10025-2, comme le producteur. */
  function matProduit(p: Profil): Materiau {
    const t = epaisseurMax(p);
    return { nuance: 'S355', fy: t <= 16 ? 355 : 345, fu: 470, epaisseur: t };
  }
  const longueurs = (L: number, treillis: boolean): LongueursFlambement => ({ Lcr_y: L, Lcr_z: L, Lcr_v: L, L_T: L, barreDeTreillis: treillis });

  it('UPE : N_b,T,Rd (flexion-torsion, hors norme) a 1,5 % pres, 14 profils, 1 a 14 m', () => {
    let pire = 0;
    let ou = '';
    for (const [n, val] of Object.entries(PUBLIE_FLAMBEMENT_UPE)) {
      const u = profilUCatalogue(n);
      const pr = proprietes(u);
      for (const [L, pub] of Object.entries(val)) {
        const f = flambementsNonSymetriques(u, matProduit(u), pr, 1, null, longueurs(Number(L) * 1000, false), P);
        const e = Math.abs(f[f.length - 1].Nb_Rd / pub - 1);
        if (e > pire) {
          pire = e;
          ou = `${n} L = ${L} m`;
        }
      }
    }
    console.log('UPE N_b,T,Rd', (pire * 100).toFixed(2), '%', ou);
    expect(pire).toBeLessThan(0.015);
  });

  it('cornieres de treillis : flexion autour de v par BB.1.2 et torsion pure, recoupement et point ouvert', () => {
    let pirePetites = 0;
    let pireGrandes = 0;
    let pireT = 0;
    for (const [n, val] of Object.entries(PUBLIE_FLAMBEMENT_L)) {
      const c = corniereCatalogue(n);
      const m = matProduit(c);
      const pr = proprietes(c);
      const cl = classifier(c, m, pr, { N: 1, My: 0, Mz: 0 }).classe === 4 ? 4 : 3;
      const eff = cl === 4 ? sectionEfficace(c, m) : null;
      for (const [L, pub] of Object.entries(val.F)) {
        if (pub < 1) continue; // valeurs publiees a moins de trois chiffres utiles
        const f = flambementsNonSymetriques(c, m, pr, cl, eff, longueurs(Number(L) * 1000, true), P);
        const e = f[2].Nb_Rd / pub - 1;
        if (c.h <= 120) pirePetites = Math.max(pirePetites, Math.abs(e));
        else pireGrandes = Math.max(pireGrandes, e);
      }
      // Torsion pure : N_cr,T (I_w des cornieres negligeable), courbe b, section brute.
      if (cl === 3) {
        const tf = torsionFlexion(c, pr, longueurs(14000, true));
        const Af = pr.A * m.fy;
        const chi = facteurReduction(Math.sqrt(Af / tf.N_cr_T), 0.34).chi;
        pireT = Math.max(pireT, Math.abs((chi * Af) / 1000 / val.T - 1));
      }
    }
    console.log('cornieres : h <= 120', (pirePetites * 100).toFixed(2), '% ; h > 120', (pireGrandes * 100).toFixed(2), '% ; T', (pireT * 100).toFixed(2), '%');
    // h <= 120 : 3 % au plus (arrondis des petites valeurs publiees, I_v des petites cornieres).
    expect(pirePetites).toBeLessThan(0.031);
    expect(pireT).toBeLessThan(0.01);
    // POINT OUVERT : cornieres de 140 a 300, l'outil DEPASSE la valeur publiee
    // de 2 a 6,6 % aux faibles longueurs (1 m), l'ecart se resorbant avec la
    // longueur. Ni f_y, ni la classe, ni l'aire ne l'expliquent ; le tableau
    // consulte suit l'annexe nationale britannique, qui peut modifier
    // l'annexe BB. Fige ici pour qu'un changement se voie.
    expect(pireGrandes).toBeLessThan(0.067);
  });
});
