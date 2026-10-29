/**
 * Dessin du profil et mise en forme des resultats. Module PUR.
 * Unites : mm, kN, kN.m, cm2/cm4/cm3 a l'affichage des proprietes.
 */

import { echapper, langueCourante, nombreAffiche, pointDecimal, notationHtml, notationSvg, tauxAffiche, type BlocResultat, type LigneResultat } from 'aedificium-ui';
import type { Profil, ProfilNonSymetrique, Proprietes, ResultatElement, ResultatNonSymetrique, Verification, Classification, Materiau, MomentCritique, SectionEfficaceSymetrique } from '../../src/index';
import { contours, estDoublementSymetrique, proprietes, provenance, rayonsTube } from '../../src/index';
import { profilGeneral, type ModeleSaisie } from './form';
import { phrase, textes } from './textes';

export function messageDErreur(e: unknown): string {
  return phrase(e instanceof Error ? e.message : String(e));
}

/**
 * Coupe d'un profil non doublement symetrique, d'apres son contour :
 * centre de gravite G, centre de cisaillement C, axes y et z par G, et
 * axes principaux u, v pour une corniere seule.
 */
function dessinContour(p: ProfilNonSymetrique): string {
  const T = 260;
  const m = 30;
  const polys = contours(p);
  const pr = proprietes(p);
  const ys = polys.flat().map((q) => q[0]);
  const zs = polys.flat().map((q) => q[1]);
  const [y0, y1, z0, z1] = [Math.min(...ys), Math.max(...ys), Math.min(...zs), Math.max(...zs)];
  const e = (T - 2 * m) / Math.max(y1 - y0, z1 - z0);
  const cy = T / 2 - ((y0 + y1) / 2) * e;
  const cz = T / 2 + ((z0 + z1) / 2) * e;
  const X = (y: number): string => (cy + y * e).toFixed(1);
  const Y = (z: number): string => (cz - z * e).toFixed(1);
  const forme = polys.map((poly) => `<path class="acier" d="M ${poly.map((q) => `${X(q[0])} ${Y(q[1])}`).join(' L ')} Z"/>`).join('');
  const gy = pr.yG;
  const gz = pr.zG;
  const sy = gy + pr.y0;
  const sz = gz + pr.z0;
  const demi = (T / 2 - 10) / e;
  const axe = (theta: number, nom: string, classe: string): string => {
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    return `<line class="${classe}" x1="${X(gy - c * demi)}" y1="${Y(gz - s * demi)}" x2="${X(gy + c * demi)}" y2="${Y(gz + s * demi)}"/><text class="axe-nom" x="${X(gy + c * demi * 0.92)}" y="${Y(gz + s * demi * 0.92)}">${nom}</text>`;
  };
  const principaux = p.type === 'L' ? axe(pr.alpha, 'u', 'axe-principal') + axe(pr.alpha + Math.PI / 2, 'v', 'axe-principal') : '';
  const points =
    `<circle class="point" cx="${X(gy)}" cy="${Y(gz)}" r="3"/><text class="axe-nom" x="${(Number(X(gy)) + 5).toFixed(1)}" y="${(Number(Y(gz)) - 5).toFixed(1)}">G</text>` +
    `<circle class="point-creux" cx="${X(sy)}" cy="${Y(sz)}" r="3.5"/><text class="axe-nom" x="${(Number(X(sy)) + 5).toFixed(1)}" y="${(Number(Y(sz)) + 13).toFixed(1)}">C</text>`;
  return `<svg class="schema-profil" viewBox="0 0 ${T} ${T}" role="img" aria-label="${echapper(textes().coupe(p.nom))}">${forme}${axe(0, 'y', 'axe')}${axe(Math.PI / 2, 'z', 'axe')}${principaux}${points}<text class="nom" x="${T / 2}" y="${T - 4}">${notationSvg(p.nom)}</text></svg>`;
}

/** Coupe du profil a l'echelle, conges et angles compris. */
export function dessinProfil(p: Profil): string {
  if (!estDoublementSymetrique(p)) return dessinContour(p);
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
  return `<svg class="schema-profil" viewBox="0 0 ${T} ${T}" role="img" aria-label="${echapper(textes().coupe(p.nom))}">${forme}<line class="axe" x1="8" y1="${cy}" x2="${T - 8}" y2="${cy}"/><line class="axe" x1="${cx}" y1="8" x2="${cx}" y2="${T - 8}"/><text class="axe-nom" x="${T - 10}" y="${cy - 4}">y</text><text class="axe-nom" x="${cx + 4}" y="14">z</text><text class="nom" x="${cx}" y="${T - 4}">${notationSvg(p.nom)}</text></svg>`;
}

/** Nom de catalogue affiche : « 6,5 » devient « 6.5 » en anglais ; la valeur reste la cle. */
const pointDecimalEn = (n: string): string => (langueCourante() === 'en' ? pointDecimal(n) : n);

const L = (symbole: string, libelle: string, valeur: string): LigneResultat => ({ symbole, libelle, valeur });

/** Nom affiche d'une verification : la cle technique reste « Deversement ». */
const nomVerification = (nom: string): string => phrase(nom === 'Deversement' ? 'Déversement' : nom);

/** Nombre affiche : trois decimales au plus, sans zeros inutiles. */
const aff = (v: number, d: number): string => nombreAffiche(v, Math.min(d, 3));

export function lignesProprietes(r: { proprietes: Proprietes; materiau: Materiau }): LigneResultat[] {
  const p = r.proprietes;
  const x = textes().proprietes;
  return [
    L('A', x.aire, `${aff(p.A / 1e2, 2)} cm2`),
    L('I_y, I_z', x.inerties, `${aff(p.Iy / 1e4, 0)} ; ${aff(p.Iz / 1e4, 1)} cm4`),
    L('W_pl,y, W_pl,z', x.plastiques, `${aff(p.Wpl_y / 1e3, 1)} ; ${aff(p.Wpl_z / 1e3, 1)} cm3`),
    L('W_el,y, W_el,z', x.elastiques, `${aff(p.Wel_y / 1e3, 1)} ; ${aff(p.Wel_z / 1e3, 1)} cm3`),
    L('I_t, I_w', x.torsion, `${aff(p.It / 1e4, 2)} cm4 ; ${aff(p.Iw / 1e6, 0)} cm6`),
    L('f_y, f_u', x.acier(r.materiau.nuance, aff(r.materiau.epaisseur, 1)), `${aff(r.materiau.fy, 0)} ; ${aff(r.materiau.fu, 0)} MPa`),
  ];
}

export function lignesClassification(r: { classification: Classification; sectionEfficace?: SectionEfficaceSymetrique | null }): LigneResultat[] {
  const e = r.sectionEfficace ?? null;
  const t = textes().classification;
  return [
    ...r.classification.parois.map((c) =>
      L(t.paroi(c.paroi), t.limites(phrase(c.detail), c.limites.map((x) => aff(x, 1)).join(' / ')), t.classe(aff(c.elancement, 2), c.classe))
    ),
    L('section', t.gouvernante(t.paroi(r.classification.gouvernante)), t.classeSeule(r.classification.classe)),
    // Classe 4 : les proprietes efficaces de l'EN 1993-1-5 §4.4 et les parois reduites.
    ...(e === null
      ? []
      : [
          L('A_eff', t.aEff, `${aff(e.Aeff / 100, 2)} cm²`),
          L('W_eff,y', t.wEffY(aff(e.zG_y, 1)), `${aff(e.Weff_y / 1e3, 1)} cm³`),
          L('W_eff,z', t.wEffZ, `${aff(e.Weff_z / 1e3, 1)} cm³`),
          ...e.parois
            .filter((x) => x.rho < 1)
            .map((x) => L(`rho ${t.paroi(x.paroi)}`, `${phrase(x.cas)}, psi = ${aff(x.psi, 3)}, k_sigma = ${aff(x.kSigma, 3)}, lambda_p = ${aff(x.lambdaP, 3)}`, aff(x.rho, 3))),
        ]),
  ];
}

export function lignesVerifications(r: { verifications: Verification[] }): LigneResultat[] {
  const t = textes();
  return r.verifications.map((v) => L(nomVerification(v.nom), `${phrase(v.clause)} — ${phrase(v.motif)}`, v.applicable && v.taux !== null ? tauxAffiche(v.taux) : t.nonApplicable));
}

export function lignesInstabilite(r: ResultatElement): LigneResultat[] {
  const t = textes();
  const lignes: LigneResultat[] = [];
  for (const f of [r.flambementY, r.flambementZ]) {
    if (f === null) continue;
    lignes.push(
      L(t.instabilite.flambement(f.axe), t.instabilite.courbe(aff(f.Lcr / 1000, 2), aff(f.N_cr, 0), f.courbe, aff(f.alpha, 2)), `lambda ${aff(f.lambda_, 3)} ; chi ${aff(f.chi, 3)} ; N_b,Rd ${aff(f.Nb_Rd, 0)} kN`)
    );
  }
  const d = r.deversement;
  if (d.M_cr !== null) {
    lignes.push(L('M_cr', phrase(d.M_cr.source), `${aff(d.M_cr.M_cr, 1)} kN.m`));
  }
  lignes.push(
    L(
      t.instabilite.deversement,
      phrase(d.motif),
      d.applicable && d.Mb_Rd !== null ? `lambda_LT ${aff(d.lambda_LT ?? 0, 3)} ; chi_LT ${aff(d.chi_LT, 3)} ; M_b,Rd ${aff(d.Mb_Rd, 1)} kN.m` : t.nonApplicable
    )
  );
  if (r.interaction633 !== null) {
    const i = r.interaction633;
    lignes.push(L('k_yy, k_yz, k_zy, k_zz', phrase(i.motif), [i.kyy, i.kyz, i.kzy, i.kzz].map((x) => aff(x, 3)).join(' ; ')));
  }
  return lignes;
}

export function blocs(r: ResultatElement): BlocResultat[] {
  const t = textes().blocs;
  return [
    { titre: t.proprietes, lignes: lignesProprietes(r), note: null },
    { titre: t.classification, lignes: lignesClassification(r), note: null },
    { titre: t.verifications, lignes: lignesVerifications(r), note: phrase(r.voilement) },
    { titre: t.instabilites, lignes: lignesInstabilite(r), note: null },
    blocVerdict(r),
  ];
}

export function tableHtml(lignes: readonly LigneResultat[]): string {
  return `<table class="grandeurs"><tbody>${lignes
    .map((l) => `<tr><th>${notationHtml(l.symbole)}</th><td class="libelle">${notationHtml(l.libelle)}</td><td class="valeur">${notationHtml(l.valeur)}</td></tr>`)
    .join('')}</tbody></table>`;
}


/**
 * Le verdict pour le CSV et la note : le constat affiche a l'ecran
 * (`verdictHtml`), puis son motif. La note portait le motif seul.
 */
export function blocVerdict(r: { verdict: 'conforme' | 'non-conforme' | 'incomplet'; motif: string }): BlocResultat {
  const t = textes();
  return { titre: t.verdict.titre, lignes: [{ symbole: t.verdict.constat, libelle: t.verdict.libelle, valeur: t.verdicts[r.verdict] }], note: phrase(r.motif) };
}

export function verdictHtml(r: { verdict: 'conforme' | 'non-conforme' | 'incomplet'; motif: string }): string {
  return `<p class="verdict verdict-${r.verdict}">${notationHtml(textes().verdicts[r.verdict])}</p><p class="motif">${notationHtml(phrase(r.motif))}</p>`;
}

/** Bandeau hors norme, affiche des que M_cr provient de l'expression bibliographique. */
export function bandeauMcr(r: { deversement: { M_cr: MomentCritique | null } }): string {
  const m = r.deversement.M_cr;
  if (m === null || m.origine !== 'hors-norme') return '';
  return `<p class="alerte">${textes().bandeaux.mcr(aff(m.M_cr, 1), notationHtml(phrase(m.source)))}</p>`;
}

/** Proprietes propres aux profils non doublement symetriques. */
export function lignesProprietesNonSymetriques(r: ResultatNonSymetrique): LigneResultat[] {
  const p = r.proprietes;
  const x = textes().proprietes;
  const lignes = [
    ...lignesProprietes(r),
    L('y_G, z_G', x.centreGravite, `${aff(p.yG, 1)} ; ${aff(p.zG, 1)} mm`),
    L('y_0, z_0', x.centreCisaillement, `${aff(p.y0, 1)} ; ${aff(p.z0, 1)} mm`),
    L('I_t, I_w', phrase(p.origineTorsion), `${aff(p.It / 1e4, 2)} cm4 ; ${aff(p.Iw / 1e6, 1)} cm6`),
  ];
  if (Math.abs(p.Iyz) > 1e-6 * p.Iy) {
    lignes.push(
      L('I_u, I_v', x.principaux(aff((p.alpha * 180) / Math.PI, 1)), `${aff(p.Iu / 1e4, 1)} ; ${aff(p.Iv / 1e4, 1)} cm4`),
      L('W_el,u, W_el,v', x.elastiquesMin, `${aff(p.Wel_u / 1e3, 2)} ; ${aff(p.Wel_v / 1e3, 2)} cm3`),
      L('W_pl,u, W_pl,v', x.plastiques, `${aff(p.Wpl_u / 1e3, 2)} ; ${aff(p.Wpl_v / 1e3, 2)} cm3`)
    );
  }
  if (r.efficace !== null) {
    const e = r.efficace;
    lignes.push(L('A_eff, e_N', phrase(e.motif), `${aff(e.Aeff / 1e2, 2)} cm2 ; ${aff(e.eNy, 1)} ; ${aff(e.eNz, 1)} mm`));
  }
  return lignes;
}

export function lignesInstabiliteNonSymetrique(r: ResultatNonSymetrique): LigneResultat[] {
  const t = textes();
  const lignes: LigneResultat[] = r.flambements.map((f) =>
    L(
      t.instabilite.flambementMode(phrase(f.mode)),
      `L_cr = ${aff(f.Lcr / 1000, 2)} m, N_cr = ${aff(f.N_cr, 0)} kN, ${phrase(f.motif)}`,
      `lambda ${aff(f.lambdaEff ?? f.lambda_, 3)} ; chi ${aff(f.chi, 3)} ; N_b,Rd ${aff(f.Nb_Rd, 0)} kN`
    )
  );
  const d = r.deversement;
  if (d.M_cr !== null) lignes.push(L('M_cr', phrase(d.M_cr.source), `${aff(d.M_cr.M_cr, 1)} kN.m`));
  lignes.push(
    L(
      t.instabilite.deversement,
      phrase(d.motif),
      d.applicable && d.Mb_Rd !== null ? `lambda_LT ${aff(d.lambda_LT ?? 0, 3)} ; chi_LT ${aff(d.chi_LT, 3)} ; M_b,Rd ${aff(d.Mb_Rd, 1)} kN.m` : d.aFournir ? t.nonVerifie : t.nonApplicable
    )
  );
  if (r.interaction633 !== null) {
    const i = r.interaction633;
    lignes.push(L('k_yy, k_yz, k_zy, k_zz', phrase(i.motif), [i.kyy, i.kyz, i.kzy, i.kzz].map((x) => aff(x, 3)).join(' ; ')));
  }
  if (r.compose !== null) lignes.push(L(t.instabilite.compose, phrase(r.compose.motif), `${aff(r.compose.espacement, 0)} mm`));
  return lignes;
}

export function blocsNonSymetriques(r: ResultatNonSymetrique): BlocResultat[] {
  const t = textes().blocs;
  return [
    { titre: t.proprietes, lignes: lignesProprietesNonSymetriques(r), note: null },
    { titre: t.classification, lignes: lignesClassification(r), note: null },
    { titre: t.verifications, lignes: lignesVerifications(r), note: phrase(r.voilement) },
    { titre: t.instabilites, lignes: lignesInstabiliteNonSymetrique(r), note: r.avertissements.length === 0 ? null : r.avertissements.map(phrase).join(' ') },
    blocVerdict(r),
  ];
}

/** Bandeau des resultats hors norme ou etendus d'un profil non doublement symetrique. */
export function bandeauNonSymetrique(r: ResultatNonSymetrique): string {
  const t = textes().bandeaux;
  const items: string[] = [];
  if (r.flambements.length > 0) items.push(t.ncr);
  if (r.interaction633?.motif.includes('ÉTENDUE')) items.push(t.annexeB);
  if (r.deversement.aFournir) items.push(t.deversement);
  for (const a of r.avertissements) items.push(notationHtml(phrase(a)));
  return items.length === 0 ? '' : `<p class="alerte">${items.join('<br/>')}</p>`;
}

/** Options HTML d'une liste de profils, groupees par famille du catalogue. */
export function optionsCatalogue(listes: Array<{ famille: string; noms: string[] }>): string {
  return listes
    .map((f) => `<optgroup label="${echapper(textes().familles[f.famille] ?? f.famille)}">${f.noms.map((n) => `<option value="${echapper(n)}">${echapper(pointDecimalEn(n))}</option>`).join('')}</optgroup>`)
    .join('');
}

/** Le diagramme saisi, en clair, pour la note : l'ecran le montre, la note le dit. */
function texteDiagramme(type: string, psi: number, Mh: number, Ms: number): string {
  const t = textes().diagrammes;
  if (type === 'lineaire') return t.lineaire(aff(psi, 3));
  if (type === 'repartie') return t.repartie;
  if (type === 'concentree-milieu') return t.concentree;
  return t.mixte(type === 'mixte-repartie', aff(Mh, 3), aff(psi, 3), aff(Ms, 3));
}

/** Bloc « Donnees » de la note : les entrees telles que l'ecran les montre. */
export function blocEntrees(m: ModeleSaisie): BlocResultat {
  const p = profilGeneral(m);
  const t = textes().entrees;
  return {
    titre: t.titre,
    lignes: [
      { symbole: t.profil, libelle: phrase(provenance(p.nom)), valeur: `${p.nom}, ${m.nuance}` },
      { symbole: 'N, M_y, M_z', libelle: t.sollicitations, valeur: `${aff(m.N, 3)} kN ; ${aff(m.My, 3)} ; ${aff(m.Mz, 3)} kN.m` },
      { symbole: 'V_z, V_y', libelle: t.tranchants, valeur: `${aff(m.Vz, 3)} ; ${aff(m.Vy, 3)} kN` },
      { symbole: 'L_cr,y, L_cr,z, L', libelle: t.longueurs, valeur: `${aff(m.Lcry, 3)} ; ${aff(m.Lcrz, 3)} ; ${aff(m.LLT, 3)} m` },
      { symbole: t.diagrammeLT, libelle: t.deversement, valeur: texteDiagramme(m.diagramme, m.psiLT, 0, 0) },
      { symbole: t.diagrammeY, libelle: t.cmy, valeur: texteDiagramme(m.diagrammeY, m.psiY, m.MhY, m.MsY) },
      { symbole: t.diagrammeZ, libelle: t.cmz, valeur: texteDiagramme(m.diagrammeZ, m.psiZ, m.MhZ, m.MsZ) },
    ],
    note: null,
  };
}

/** Avertissements portes par la note, selon la forme du resultat. */
export function avertissementsDeLaNote(
  e: { forme: 'symetrique'; resultat: ResultatElement } | { forme: 'non-symetrique'; resultat: ResultatNonSymetrique }
): string[] {
  const m = e.resultat.deversement.M_cr;
  const t = textes().avertissements;
  const avertissements = m !== null && m.origine === 'hors-norme' ? [t.mcr(phrase(m.source))] : [];
  if (e.forme === 'non-symetrique') {
    if (e.resultat.flambements.length > 0) avertissements.push(t.ncr);
    if (e.resultat.deversement.aFournir) avertissements.push(t.deversement);
    avertissements.push(...e.resultat.avertissements.map(phrase));
  }
  return avertissements;
}
