/**
 * Tests d'acceptation de l'etape 8.2 (finitions) : notations, arrondis,
 * accents, titre, phrases types, sur le texte VISIBLE (ecran, dessins, note,
 * CSV, page). Le controle lui-meme vit dans aedificium-ui (`constatsAffichage`).
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { NOMS_GRECS, blocsEnTexte, constatsAffichage, contenuBalise, noteDeCalculHtml, resultatsEnCsv, texteVisible, type BlocResultat } from 'aedificium-ui';
import { ec3Recommande, familles, verifierElement, verifierNonSymetrique } from '../../src/index';
import {
  donneesDepuisModele,
  donneesNonSymetriquesDepuisModele,
  modeleParDefaut,
  profilDepuisModele,
  profilGeneral,
  type ModeleSaisie,
} from '../../app/src/form';
import {
  bandeauMcr,
  bandeauNonSymetrique,
  blocEntrees,
  blocs,
  blocsNonSymetriques,
  dessinProfil,
  optionsCatalogue,
  tableHtml,
  verdictHtml,
} from '../../app/src/vue';
import { STYLES_TRACE } from '../../app/src/export';
import { noteDuCalcul } from '../../app/src/note';

const P = ec3Recommande();
const TITRE = 'Profils en acier';
const lire = (chemin: string): string => readFileSync(fileURLToPath(new URL(chemin, import.meta.url)), 'utf8');
const controler = (nom: string, html: string): string[] => constatsAffichage(texteVisible(html)).map((c) => `${nom} : ${c}`);

const SYMETRIQUES: ModeleSaisie[] = (['catalogue', 'I-soude', 'tube-rectangulaire', 'tube-circulaire'] as const).map((source) => ({
  ...modeleParDefaut(),
  source,
}));
const NON_SYMETRIQUES: ModeleSaisie[] = (['L', 'U', '2L', '2U'] as const).map((source) => ({ ...modeleParDefaut(), source, N: 20, My: 1 }));

function sorties() {
  const ecran: string[] = [];
  const notes: string[] = [];
  const csv: string[] = [];
  const noter = (m: ModeleSaisie, resultats: BlocResultat[]): void => {
    csv.push(resultatsEnCsv(blocsEnTexte([blocEntrees(m), ...resultats])));
  };
  for (const m of SYMETRIQUES) {
    const r = verifierElement(donneesDepuisModele(m), P);
    const dessin = dessinProfil(profilDepuisModele(m));
    ecran.push(dessin, verdictHtml(r), bandeauMcr(r), ...blocs(r).map((b) => tableHtml(b.lignes)));
    noter(m, blocs(r));
    notes.push(noteDeCalculHtml(noteDuCalcul(P, { forme: 'symetrique', modele: m, resultat: r, dessin }, { projet: 'Halle', element: '', date: '2026-10-24' }), STYLES_TRACE));
  }
  for (const m of NON_SYMETRIQUES) {
    const r = verifierNonSymetrique(donneesNonSymetriquesDepuisModele(m), P);
    const dessin = dessinProfil(profilGeneral(m));
    ecran.push(dessin, verdictHtml(r), bandeauNonSymetrique(r), ...blocsNonSymetriques(r).map((b) => tableHtml(b.lignes)));
    noter(m, blocsNonSymetriques(r));
    notes.push(noteDeCalculHtml(noteDuCalcul(P, { forme: 'non-symetrique', modele: m, resultat: r, dessin }, { projet: 'Halle', element: '', date: '2026-10-24' }), STYLES_TRACE));
  }
  ecran.push(optionsCatalogue(familles()));
  return { ecran, notes, csv };
}

describe('texte visible : notations, arrondis, accents, phrases types', () => {
  const s = sorties();

  it('ecran et dessins', () => {
    expect(s.ecran.flatMap((h, i) => controler(`ecran ${i}`, h))).toEqual([]);
  });

  it('note de calcul', () => {
    expect(s.notes.flatMap((h, i) => controler(`note ${i}`, h))).toEqual([]);
  });

  it('page (index.html)', () => {
    expect(controler('page', lire('../../app/index.html'))).toEqual([]);
  });

  it('CSV : texte brut, ni « _ » ni nom de lettre grecque ni balise', () => {
    for (const c of s.csv) {
      expect(c).not.toContain('_');
      expect(c).not.toMatch(NOMS_GRECS);
      expect(c).not.toContain('<');
    }
  });
});

describe('titre', () => {
  const page = lire('../../app/index.html');

  it('titre de la page sans tiret, majuscule initiale', () => {
    expect(contenuBalise(page, 'h1')).toBe(TITRE);
    expect(contenuBalise(page, 'title')?.startsWith(TITRE)).toBe(true);
  });

  it('titre en grand', () => {
    const regle = /(^|\n)h1\s*\{([^}]*)\}/.exec(lire('../../app/src/style.css'))?.[2] ?? '';
    expect(regle).toMatch(/font-size:\s*1\.75rem/);
    expect(regle).toMatch(/font-weight:\s*600/);
  });
});

describe('main.ts passe par les fonctions testees', () => {
  it('entrees, avertissements et hypotheses de la note, CSV', () => {
    const main = lire('../../app/src/main.ts');
    expect(main).toContain('blocEntrees(');
    expect(main).toContain('noteDuCalcul(');
    expect(main).toContain('blocsEnTexte(');
  });
});
