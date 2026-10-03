import { describe, expect, it } from 'vitest';
import { arrondir, axesPrincipaux, corniereCatalogue, integrales, modulePlastique, profilCatalogue, profilUCatalogue, proprietes, type Point } from '../../src/index';

const rect = (b: number, h: number): Point[] => [
  [0, 0],
  [b, 0],
  [b, h],
  [0, h],
];

describe('moteur de contour', () => {
  it('rectangle 100 x 200 : A, centre, I = b h^3 / 12, W_pl = b h^2 / 4, I_yz nul', () => {
    const p = [rect(100, 200)];
    const g = integrales(p);
    expect(g.A).toBeCloseTo(20000, 6);
    expect(g.yG).toBeCloseTo(50, 9);
    expect(g.zG).toBeCloseTo(100, 9);
    expect(g.Iy).toBeCloseTo((100 * 200 ** 3) / 12, 3);
    expect(g.Iz).toBeCloseTo((200 * 100 ** 3) / 12, 3);
    expect(g.Iyz).toBeCloseTo(0, 3);
    expect(modulePlastique(p, g, 0).Wpl).toBeCloseTo((100 * 200 ** 2) / 4, 1);
  });

  it('corniere 100 x 100 x 10 a angles vifs : valeurs calculees a la main', () => {
    // Aile verticale 10 x 100 (centre 5 ; 50), aile horizontale 90 x 10 (centre 55 ; 5).
    const p: Point[][] = [[[0, 0], [100, 0], [100, 10], [10, 10], [10, 100], [0, 100]]];
    const g = integrales(p);
    const A = 1000 + 900;
    const c = (1000 * 50 + 900 * 5) / A; // 28,684 mm
    const Iy = (10 * 100 ** 3) / 12 + 1000 * (50 - c) ** 2 + (90 * 10 ** 3) / 12 + 900 * (5 - c) ** 2;
    const Iyz = 1000 * (5 - c) * (50 - c) + 900 * (55 - c) * (5 - c);
    expect(g.A).toBeCloseTo(A, 6);
    expect(g.zG).toBeCloseTo(c, 9);
    expect(g.yG).toBeCloseTo(c, 9);
    expect(g.Iy).toBeCloseTo(Iy, 2);
    expect(g.Iz).toBeCloseTo(Iy, 2);
    expect(g.Iyz).toBeCloseTo(Iyz, 2);
    const ax = axesPrincipaux(g);
    // Ailes egales : axes principaux a 45 degres, I_u,v = I_y -+ I_yz.
    expect(ax.alpha).toBeCloseTo(Math.PI / 4, 9);
    expect(ax.Iu).toBeCloseTo(Iy - Iyz, 2);
    expect(ax.Iv).toBeCloseTo(Iy + Iyz, 2);
  });

  it('axe neutre plastique non central : moitie de l aire de chaque cote', () => {
    const p: Point[][] = [[[0, 0], [100, 0], [100, 10], [10, 10], [10, 100], [0, 100]]];
    const g = integrales(p);
    const pl = modulePlastique(p, g, 0);
    // Axe neutre plastique horizontal a z_p : 100 z_p = 950 si z_p < 10 -> z_p = 9,5 mm.
    expect(g.zG + pl.decalage).toBeCloseTo(9.5, 6);
    // W_pl par morceaux : bande 100 x 9,5 sous l'axe, bande 100 x 0,5 au-dessus, aile verticale 10 x 90 a 45,5 mm.
    const zp = 9.5;
    const Wpl = (100 * zp * zp) / 2 + (100 * (10 - zp) ** 2) / 2 + 10 * 90 * (10 - zp + 45);
    expect(pl.Wpl).toBeCloseTo(Wpl, 2);
  });

  it('conge : un arc de quart de cercle retire (1 - pi/4) r^2 a un angle saillant', () => {
    const r = 20;
    const p = [arrondir([{ y: 0, z: 0 }, { y: 100, z: 0 }, { y: 100, z: 100, r }, { y: 0, z: 100 }])];
    expect(integrales(p).A).toBeCloseTo(10000 - (1 - Math.PI / 4) * r * r, 0);
  });

  it('le moteur retrouve les IPE de l integration par bandes (ecart < 0,1 %)', () => {
    const ipe = profilCatalogue('IPE 300');
    const a = proprietes(ipe);
    // Le meme IPE reconstruit en contour.
    const h = ipe.h, b = ipe.b, tw = ipe.tw, tf = ipe.tf, r = ipe.r;
    const I = arrondir([
      { y: -b / 2, z: -h / 2 }, { y: b / 2, z: -h / 2 }, { y: b / 2, z: -h / 2 + tf }, { y: tw / 2, z: -h / 2 + tf, r },
      { y: tw / 2, z: h / 2 - tf, r }, { y: b / 2, z: h / 2 - tf }, { y: b / 2, z: h / 2 }, { y: -b / 2, z: h / 2 },
      { y: -b / 2, z: h / 2 - tf }, { y: -tw / 2, z: h / 2 - tf, r }, { y: -tw / 2, z: -h / 2 + tf, r }, { y: -b / 2, z: -h / 2 + tf },
    ]);
    const g = integrales([I]);
    expect(Math.abs(g.A / a.A - 1)).toBeLessThan(0.001);
    expect(Math.abs(g.Iy / a.Iy - 1)).toBeLessThan(0.001);
    expect(Math.abs(modulePlastique([I], g, 0).Wpl / a.Wpl_y - 1)).toBeLessThan(0.001);
  });
});

describe('profils composes', () => {
  it('2U 200 dos a dos : doublement symetrique, centre de cisaillement au centre de gravite, A et I_y doubles', () => {
    const u = profilUCatalogue('UPE 200');
    const p1 = proprietes(u);
    const p2 = proprietes({ type: '2U', nom: '2 UPE 200', profilU: u, ecartement: 10 });
    expect(p2.A).toBeCloseTo(2 * p1.A, 3);
    expect(p2.Iy).toBeCloseTo(2 * p1.Iy, 0);
    expect(p2.yG).toBeCloseTo(0, 9);
    expect(p2.Iyz).toBeCloseTo(0, 0);
    expect(p2.y0).toBeCloseTo(0, 9);
    expect(p2.z0).toBeCloseTo(0, 9);
    // Steiner : I_z = 2 [I_z,1 + A_1 (s/2 + y_G,1)^2].
    expect(p2.Iz).toBeCloseTo(2 * (p1.Iz + p1.A * (5 + p1.yG) ** 2), -2);
    expect(p2.It).toBeCloseTo(2 * (u.It ?? 0), 6);
  });

  it('2L 80 x 8 dos a dos, gousset 10 mm : symetrique par rapport a z, centre de cisaillement sur l axe', () => {
    const c = corniereCatalogue('L 80x80x8');
    const p1 = proprietes(c);
    const p2 = proprietes({ type: '2L', nom: '2 L 80x80x8', corniere: c, ecartement: 10, accolee: 'h' });
    expect(p2.A).toBeCloseTo(2 * p1.A, 3);
    expect(p2.Iy).toBeCloseTo(2 * p1.Iy, 0);
    expect(p2.yG).toBeCloseTo(0, 9);
    expect(p2.Iyz).toBeCloseTo(0, 0);
    expect(p2.y0).toBeCloseTo(0, 9);
    // Centre de cisaillement a t/2 du talon, centre de gravite a c du talon.
    expect(p2.z0).toBeCloseTo(c.t / 2 - p1.zG, 9);
    expect(p2.Iz).toBeCloseTo(2 * (p1.Iz + p1.A * (5 + p1.yG) ** 2), -2);
  });

  it('2L a ailes inegales : l aile accolee devient verticale', () => {
    const c = corniereCatalogue('L 150x90x10');
    const ph = proprietes({ type: '2L', nom: 'a', corniere: c, ecartement: 10, accolee: 'h' });
    const pb = proprietes({ type: '2L', nom: 'b', corniere: c, ecartement: 10, accolee: 'b' });
    expect(ph.Iy).toBeGreaterThan(pb.Iy);
    expect(ph.Iy).toBeCloseTo(2 * proprietes(c).Iy, 0);
  });

  it('ecartement negatif : refuse', () => {
    const c = corniereCatalogue('L 80x80x8');
    expect(() => proprietes({ type: '2L', nom: 'x', corniere: c, ecartement: -1, accolee: 'h' })).toThrow('ecartement');
  });
});
