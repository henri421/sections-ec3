/**
 * Tests d'acceptation du lot 8.7 : la note de calcul passe sur la note
 * commune d'aedificium-ui (cartouche, sections dans l'ordre fixe, dessin
 * dans la geometrie, conclusions sans verdict global).
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { noteDeCalculHtml, texteVisible, type ElementNote } from 'aedificium-ui';
import { ec3Recommande, verifierElement, verifierNonSymetrique } from '../../src/index';
import { donneesDepuisModele, donneesNonSymetriquesDepuisModele, modeleParDefaut, profilGeneral, type ModeleSaisie } from '../../app/src/form';
import { avertissementsDeLaNote, blocs, blocsNonSymetriques, dessinProfil } from '../../app/src/vue';
import { STYLES_TRACE } from '../../app/src/export';
import { hypothesesDeLaNote, noteDuCalcul, type EtatNote } from '../../app/src/note';

const P = ec3Recommande();
const lire = (chemin: string): string => readFileSync(fileURLToPath(new URL(chemin, import.meta.url)), 'utf8');
const CARTOUCHE = { projet: 'Halle', element: 'Poteau P1', date: '2026-10-28' };

function etat(m: ModeleSaisie): EtatNote {
  const dessin = dessinProfil(profilGeneral(m));
  if (m.source === 'L' || m.source === 'U' || m.source === '2L' || m.source === '2U') {
    return { forme: 'non-symetrique', modele: m, resultat: verifierNonSymetrique(donneesNonSymetriquesDepuisModele(m), P), dessin };
  }
  return { forme: 'symetrique', modele: m, resultat: verifierElement(donneesDepuisModele(m), P), dessin };
}

const BASE = modeleParDefaut();
const E = etat(BASE);
const note = noteDuCalcul(P, E, CARTOUCHE);
const html = noteDeCalculHtml(note, STYLES_TRACE);
const NON_SYM: ModeleSaisie[] = (['L', 'U', '2L', '2U'] as const).map((source) => ({ ...BASE, source, N: 20, My: 1 }));
const SYM: ModeleSaisie[] = (['catalogue', 'I-soude', 'tube-rectangulaire', 'tube-circulaire'] as const).map((source) => ({ ...BASE, source }));
const blocsDe = (els: ElementNote[] | undefined) => (els ?? []).flatMap((e) => (e.type === 'bloc' ? [e.bloc] : []));
const symboles = (els: ElementNote[] | undefined) => blocsDe(els).flatMap((b) => b.lignes.map((l) => l.symbole));

describe('cartouche', () => {
  it('projet, element, date, norme et outil', () => {
    expect(note.cartouche).toEqual({ ...CARTOUCHE, norme: 'EN 1993-1-1:2005', outil: 'sections-ec3' });
  });

  it('element vide : profil et nuance', () => {
    expect(noteDuCalcul(P, E, { ...CARTOUCHE, element: '' }).cartouche.element).toBe(`${profilGeneral(BASE).nom}, ${BASE.nuance}`);
  });

  it('le texte du cartouche est echappe', () => {
    const h = noteDeCalculHtml(noteDuCalcul(P, E, { ...CARTOUCHE, projet: 'Halle <x>' }), STYLES_TRACE);
    expect(h).toContain('Halle &lt;x&gt;');
    expect(h).not.toContain('Halle <x>');
  });
});

describe('sections', () => {
  it('ordre fixe, sans combinaisons', () => {
    const titres = [...html.matchAll(/<h2>([^<]*)<\/h2>/g)].map((x) => x[1]);
    expect(titres).toEqual(['1. Géométrie', '2. Matériaux', '3. Hypothèses', '4. Cas de charges', '5. Calculs et vérifications', '6. Conclusions']);
  });

  it('geometrie : profil, longueurs, puis le dessin de la page', () => {
    const g = note.sections.geometrie ?? [];
    expect(symboles(g)).toEqual(['profil', 'L_cr,y, L_cr,z, L']);
    const f = g.flatMap((e) => (e.type === 'figure' ? [e] : []));
    expect(f).toHaveLength(1);
    expect(f[0].svg).toBe(E.dessin);
  });

  it('materiaux, hypotheses, cas de charges', () => {
    expect(symboles(note.sections.materiaux)).toEqual(['f_y, f_u']);
    const h = note.sections.hypotheses ?? [];
    expect(h.some((e) => e.type === 'texte' && e.texte.includes(P.nom))).toBe(true);
    expect(symboles(h)).toEqual(['diagramme LT', 'diagramme M_y', 'diagramme M_z']);
    expect(h.flatMap((e) => (e.type === 'liste' ? [e.items] : []))).toEqual([hypothesesDeLaNote('symetrique')]);
    expect(symboles(note.sections.charges)).toEqual(['N, M_y, M_z', 'V_z, V_y']);
  });

  it('profil non symetrique : ses hypotheses', () => {
    const n = noteDuCalcul(P, etat(NON_SYM[0]), CARTOUCHE);
    expect((n.sections.hypotheses ?? []).flatMap((e) => (e.type === 'liste' ? [e.items] : []))).toEqual([hypothesesDeLaNote('non-symetrique')]);
  });
});

describe('calculs', () => {
  it('les blocs de l ecran, sans le verdict', () => {
    for (const m of [...SYM, ...NON_SYM]) {
      const e = etat(m);
      const ecran = e.forme === 'symetrique' ? blocs(e.resultat) : blocsNonSymetriques(e.resultat);
      expect(blocsDe(noteDuCalcul(P, e, CARTOUCHE).sections.calculs), m.source).toEqual(ecran.filter((b) => b.titre !== 'Verdict'));
    }
  });

  it('avertissements de la page repris', () => {
    for (const m of NON_SYM) {
      const e = etat(m);
      expect(noteDuCalcul(P, e, CARTOUCHE).avertissements).toEqual(avertissementsDeLaNote(e));
    }
  });
});

describe('conclusions', () => {
  it('une ligne par verification applicable, avec sa clause et son taux', () => {
    for (const m of SYM) {
      const e = etat(m);
      const attendu = e.resultat.verifications.filter((v) => v.applicable);
      const v = noteDuCalcul(P, e, CARTOUCHE).verifications;
      expect(v.map((x) => x.clause), m.source).toEqual(attendu.map((x) => x.clause));
      expect(v.map((x) => x.taux), m.source).toEqual(attendu.map((x) => x.taux));
      for (const x of v) expect(x.ok).toBe(x.taux !== null && x.taux <= 1);
    }
  });

  it('le nom affiche porte son accent', () => {
    const noms = noteDuCalcul(P, E, CARTOUCHE).verifications.map((x) => x.nom);
    expect(noms).not.toContain('Deversement');
  });

  it('deversement a M_cr non fourni : au tableau, sans taux, non satisfait', () => {
    const cas = NON_SYM.map(etat).filter((e) => e.forme === 'non-symetrique' && e.resultat.deversement.aFournir);
    expect(cas.length).toBeGreaterThan(0);
    for (const e of cas) {
      const d = noteDuCalcul(P, e, CARTOUCHE).verifications.find((x) => x.nom === 'Déversement');
      expect(d).toEqual({ nom: 'Déversement', clause: '§6.3.2', taux: null, ok: false });
    }
  });

  it('aucun verdict global', () => {
    for (const m of [...SYM, ...NON_SYM]) {
      const t = texteVisible(noteDeCalculHtml(noteDuCalcul(P, etat(m), CARTOUCHE), STYLES_TRACE));
      expect(t, m.source).toContain('Vérification déterminante');
      expect(t, m.source).not.toContain('Conforme');
      expect(t, m.source).not.toContain('Vérification incomplète');
    }
  });
});

describe('cablage', () => {
  const main = lire('../../app/src/main.ts');
  const page = lire('../../app/index.html');
  const sorties = page.slice(page.indexOf('id="sorties"'), page.indexOf('</section>', page.indexOf('id="sorties"')));

  it('la note passe par noteDuCalcul et la note commune', () => {
    expect(main).toContain('noteDuCalcul(');
    expect(main).toMatch(/import \{[^}]*\bnoteDeCalculHtml\b[^}]*\} from 'aedificium-ui'/);
    expect(main).not.toMatch(/import \{[^}]*\bnoteDeCalculHtml\b[^}]*\} from '\.\/export'/);
  });

  it('champs projet et element dans les sorties, memorises', () => {
    expect(sorties).toContain('data-role="projet"');
    expect(sorties).toContain('data-role="element"');
    expect(main).toContain("'sections-ec3:cartouche'");
  });

  it('l ancienne note locale a disparu', () => {
    const exp = lire('../../app/src/export.ts');
    expect(exp).not.toContain('function noteDeCalculHtml');
    expect(exp).not.toContain('hypothesesDeLaNote');
    expect(exp).toContain('export const STYLES_TRACE');
  });
});
