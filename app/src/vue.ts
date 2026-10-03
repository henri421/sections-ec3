/**
 * Dessin du profil et mise en forme des resultats. Module PUR.
 * Unites : mm, kN, kN.m, cm2/cm4/cm3 a l'affichage des proprietes.
 */

import { echapper, nombreFr, tauxFr, type BlocResultat, type LigneResultat } from 'aedificium-ui';
import type { ProfilDoublementSymetrique, ResultatElement } from '../../src/index';
import { rayonsTube } from '../../src/index';

export function messageDErreur(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Coupe du profil a l'echelle, conges et angles compris. */
export function dessinProfil(p: ProfilDoublementSymetrique): string {
  const T = 260;
  const m = 26;
  const H = p.type === 'tube-circulaire' ? p.d : p.h;
  const B = p.type === 'tube-circulaire' ? p.d : p.b;
  const e = (T - 2 * m) / Math.max(H, B);
  const cx = T / 2;
  const cy = T / 2;
  const X = (y: number): string => (cx + y * e).toFixed(1);
  const Y = (z: number): string => (cy - z * e).toFixed(1);
  let forme: string;
  if (p.type === 'tube-circulaire') {
    forme = `<circle class="acier" cx="${cx}" cy="${cy}" r="${((p.d / 2) * e).toFixed(1)}"/><circle class="vide" cx="${cx}" cy="${cy}" r="${((p.d / 2 - p.t) * e).toFixed(1)}"/>`;
  } else if (p.type === 'tube-rectangulaire') {
    const { ro, ri } = rayonsTube(p.t, p.finition);
    forme =
      `<rect class="acier" x="${X(-p.b / 2)}" y="${Y(p.h / 2)}" width="${(p.b * e).toFixed(1)}" height="${(p.h * e).toFixed(1)}" rx="${(ro * e).toFixed(1)}"/>` +
      `<rect class="vide" x="${X(-p.b / 2 + p.t)}" y="${Y(p.h / 2 - p.t)}" width="${((p.b - 2 * p.t) * e).toFixed(1)}" height="${((p.h - 2 * p.t) * e).toFixed(1)}" rx="${(ri * e).toFixed(1)}"/>`;
  } else {
    const r = p.type === 'I-lamine' ? p.r : 0;
    const { h, b, tw, tf } = p;
    const zi = h / 2 - tf;
    // Contour en I, conges par arcs de cercle.
    // Conge concave : arc de rayon r jusqu'au point (y, z).
    const arc = (y: number, z: number): string => (r > 0 ? `A ${(r * e).toFixed(1)} ${(r * e).toFixed(1)} 0 0 0 ${X(y)} ${Y(z)}` : `L ${X(y)} ${Y(z)}`);
    const d = [
      `M ${X(-b / 2)} ${Y(h / 2)}`,
      `L ${X(b / 2)} ${Y(h / 2)}`,
      `L ${X(b / 2)} ${Y(zi)}`,
      `L ${X(tw / 2 + r)} ${Y(zi)}`,
      arc(tw / 2, zi - r),
      `L ${X(tw / 2)} ${Y(-zi + r)}`,
      arc(tw / 2 + r, -zi),
      `L ${X(b / 2)} ${Y(-zi)}`,
      `L ${X(b / 2)} ${Y(-h / 2)}`,
      `L ${X(-b / 2)} ${Y(-h / 2)}`,
      `L ${X(-b / 2)} ${Y(-zi)}`,
      `L ${X(-tw / 2 - r)} ${Y(-zi)}`,
      arc(-tw / 2, -zi + r),
      `L ${X(-tw / 2)} ${Y(zi - r)}`,
      arc(-tw / 2 - r, zi),
      `L ${X(-b / 2)} ${Y(zi)}`,
      'Z',
    ].join(' ');
    forme = `<path class="acier" d="${d}"/>`;
  }
  return `<svg class="schema-profil" viewBox="0 0 ${T} ${T}" role="img" aria-label="Coupe du profil ${echapper(p.nom)}">${forme}<line class="axe" x1="8" y1="${cy}" x2="${T - 8}" y2="${cy}"/><line class="axe" x1="${cx}" y1="8" x2="${cx}" y2="${T - 8}"/><text class="axe-nom" x="${T - 10}" y="${cy - 4}">y</text><text class="axe-nom" x="${cx + 4}" y="14">z</text><text class="nom" x="${cx}" y="${T - 4}">${echapper(p.nom)}</text></svg>`;
}

const L = (symbole: string, libelle: string, valeur: string): LigneResultat => ({ symbole, libelle, valeur });

export function lignesProprietes(r: ResultatElement): LigneResultat[] {
  const p = r.proprietes;
  return [
    L('A', 'aire', `${nombreFr(p.A / 1e2, 2)} cm2`),
    L('I_y, I_z', 'inerties', `${nombreFr(p.Iy / 1e4, 0)} ; ${nombreFr(p.Iz / 1e4, 1)} cm4`),
    L('W_pl,y, W_pl,z', 'modules plastiques', `${nombreFr(p.Wpl_y / 1e3, 1)} ; ${nombreFr(p.Wpl_z / 1e3, 1)} cm3`),
    L('W_el,y, W_el,z', 'modules elastiques', `${nombreFr(p.Wel_y / 1e3, 1)} ; ${nombreFr(p.Wel_z / 1e3, 1)} cm3`),
    L('I_t, I_w', 'torsion, gauchissement', `${nombreFr(p.It / 1e4, 2)} cm4 ; ${nombreFr(p.Iw / 1e6, 0)} cm6`),
    L('f_y, f_u', `nuance ${r.materiau.nuance}, t = ${nombreFr(r.materiau.epaisseur, 1)} mm (tableau 3.1)`, `${r.materiau.fy} ; ${r.materiau.fu} MPa`),
  ];
}

export function lignesClassification(r: ResultatElement): LigneResultat[] {
  return [
    ...r.classification.parois.map((c) =>
      L(c.paroi, `${c.detail} ; limites ${c.limites.map((x) => nombreFr(x, 1)).join(' / ')}`, `c/t = ${nombreFr(c.elancement, 2)} -> classe ${c.classe}`)
    ),
    L('section', `paroi gouvernante : ${r.classification.gouvernante}`, `classe ${r.classification.classe}`),
  ];
}

export function lignesVerifications(r: ResultatElement): LigneResultat[] {
  return r.verifications.map((v) => L(v.nom, `${v.clause} — ${v.motif}`, v.applicable && v.taux !== null ? tauxFr(v.taux) : 'non applicable'));
}

export function lignesInstabilite(r: ResultatElement): LigneResultat[] {
  const lignes: LigneResultat[] = [];
  for (const f of [r.flambementY, r.flambementZ]) {
    if (f === null) continue;
    lignes.push(
      L(`flambement ${f.axe}`, `L_cr = ${nombreFr(f.Lcr / 1000, 2)} m, N_cr = ${nombreFr(f.N_cr, 0)} kN, courbe ${f.courbe} (alpha = ${nombreFr(f.alpha, 2)})`, `lambda ${nombreFr(f.lambda_, 3)} ; chi ${nombreFr(f.chi, 3)} ; N_b,Rd ${nombreFr(f.Nb_Rd, 0)} kN`)
    );
  }
  const d = r.deversement;
  if (d.M_cr !== null) {
    lignes.push(L('M_cr', d.M_cr.source, `${nombreFr(d.M_cr.M_cr, 1)} kN.m`));
  }
  lignes.push(
    L(
      'deversement',
      d.motif,
      d.applicable && d.Mb_Rd !== null ? `lambda_LT ${nombreFr(d.lambda_LT ?? 0, 3)} ; chi_LT ${nombreFr(d.chi_LT, 3)} ; M_b,Rd ${nombreFr(d.Mb_Rd, 1)} kN.m` : 'non applicable'
    )
  );
  if (r.interaction633 !== null) {
    const i = r.interaction633;
    lignes.push(L('k_yy, k_yz, k_zy, k_zz', i.motif, [i.kyy, i.kyz, i.kzy, i.kzz].map((x) => nombreFr(x, 3)).join(' ; ')));
  }
  return lignes;
}

export function blocs(r: ResultatElement): BlocResultat[] {
  return [
    { titre: 'Proprietes recalculees', lignes: lignesProprietes(r), note: null },
    { titre: 'Classification (§5.5)', lignes: lignesClassification(r), note: null },
    { titre: 'Verifications', lignes: lignesVerifications(r), note: r.voilement },
    { titre: 'Instabilites (§6.3)', lignes: lignesInstabilite(r), note: null },
    { titre: 'Verdict', lignes: [], note: r.motif },
  ];
}

export function tableHtml(lignes: readonly LigneResultat[]): string {
  return `<table class="grandeurs"><tbody>${lignes
    .map((l) => `<tr><th>${echapper(l.symbole)}</th><td class="libelle">${echapper(l.libelle)}</td><td class="valeur">${echapper(l.valeur)}</td></tr>`)
    .join('')}</tbody></table>`;
}

export function verdictHtml(r: ResultatElement): string {
  return `<p class="verdict verdict-${r.verdict}">${r.verdict === 'conforme' ? 'Conforme' : 'Non conforme'}</p><p class="motif">${echapper(r.motif)}</p>`;
}

/** Bandeau hors norme, affiche des que M_cr provient de l'expression bibliographique. */
export function bandeauMcr(r: ResultatElement): string {
  const m = r.deversement.M_cr;
  if (m === null || m.origine !== 'hors-norme') return '';
  return `<p class="alerte">M<sub>cr</sub> = ${nombreFr(m.M_cr, 1)} kN.m est calcule par une expression HORS NORME (l'EN 1993-1-1 ne donne pas M<sub>cr</sub>) : ${echapper(m.source)}. Un M<sub>cr</sub> issu d'un calcul aux elements finis peut etre saisi.</p>`;
}
