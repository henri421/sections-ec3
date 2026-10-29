/**
 * Version anglaise (lot 8.8) : page `en/index.html` de meme squelette que la
 * page francaise, et AUCUN reste de francais dans ce qui s'affiche en anglais
 * (ecran, dessin, note, CSV, messages). Le francais, lui, est couvert par
 * `finitions.test.ts`, inchange.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { blocsEnTexte, constatsAffichage, contenuBalise, definirLangue, noteDeCalculHtml, notationHtml, resultatsEnCsv, texteVisible } from 'aedificium-ui';
import { ec3Recommande, familles, verifierElement, verifierNonSymetrique } from '../../src/index';
import {
  champsDepuisModele,
  donneesDepuisModele,
  donneesNonSymetriquesDepuisModele,
  modeleDepuisChamps,
  modeleParDefaut,
  profilDepuisModele,
  profilGeneral,
  type ModeleSaisie,
} from '../../app/src/form';
import {
  avertissementsDeLaNote,
  bandeauMcr,
  bandeauNonSymetrique,
  blocEntrees,
  blocs,
  blocsNonSymetriques,
  dessinProfil,
  messageDErreur,
  optionsCatalogue,
  tableHtml,
  verdictHtml,
} from '../../app/src/vue';
import { STYLES_TRACE } from '../../app/src/export';
import { noteDuCalcul } from '../../app/src/note';
import { textes } from '../../app/src/textes';

const P = ec3Recommande();
const lire = (chemin: string): string => readFileSync(fileURLToPath(new URL(chemin, import.meta.url)), 'utf8');
const controler = (nom: string, html: string): string[] => constatsAffichage(texteVisible(html), { langue: 'en' }).map((c) => `${nom} : ${c}`);
/** CSV : la virgule y est le separateur, pas une virgule decimale. */
const controlerCsv = (nom: string, csv: string): string[] =>
  constatsAffichage(csv, { langue: 'en' })
    .filter((c) => !c.startsWith('virgule decimale'))
    .map((c) => `${nom} : ${c}`);

/** Squelette d'une page : les attributs que lit le script, dans l'ordre. */
function squelette(html: string): string[] {
  return [...html.matchAll(/\s(id|data-[a-z-]+|type|inputmode|accept|value)="([^"]*)"/g)].map((m) => `${m[1]}=${m[2]}`);
}

describe('page anglaise', () => {
  const fr = lire('../../app/index.html');
  const en = lire('../../app/en/index.html');

  it('meme squelette que la page francaise', () => {
    expect(squelette(en)).toEqual(squelette(fr));
  });

  it('langue, script commun, liens entre les deux versions', () => {
    expect(en).toContain('<html lang="en">');
    expect(en).toContain('src="../src/main.ts"');
    expect(en).toMatch(/class="barre-langue" href="\.\.\/"/);
    expect(fr).toMatch(/class="barre-langue" href="en\/"/);
  });

  it('titre anglais, aucun reste de francais', () => {
    expect(contenuBalise(en, 'h1')).toBe('Steel sections');
    expect(controler('page', en.replace(/lang="fr"[^>]*>FR</, '>'))).toEqual([]);
  });
});

describe('affichage en anglais', () => {
  beforeEach(() => definirLangue('en'));
  afterEach(() => definirLangue('fr'));

  const CARTOUCHE = { projet: 'Hall', element: '', date: '2026-10-30' };

  it('ecran, dessin, note et CSV : profils doublement symetriques', () => {
    const d = modeleParDefaut();
    const modeles: ModeleSaisie[] = [
      ...(['catalogue', 'I-soude', 'tube-rectangulaire', 'tube-circulaire'] as const).map((source) => ({ ...d, source })),
      { ...d, N: 0, My: 0, Mz: 0, Vz: 0, Vy: 0 },
      { ...d, N: -200 },
      { ...d, N: 300, My: 80, Mz: 10, Vz: 50, Vy: 20 },
      { ...d, empeche: true },
      { ...d, Mcr: 500 },
      { ...d, diagramme: 'repartie', point: 'semelle-superieure' },
      { ...d, diagrammeY: 'mixte-repartie', MhY: 20, MsY: 30, diagrammeZ: 'concentree-milieu' },
      { ...d, source: 'I-soude', h: 1200, b: 300, tw: 6, tf: 12, N: 100, My: 300 },
      { ...d, source: 'tube-rectangulaire', h: 300, b: 300, t: 5, N: 500 },
    ];
    const constats: string[] = [];
    modeles.forEach((m, i) => {
      let r: ReturnType<typeof verifierElement>;
      try {
        r = verifierElement(donneesDepuisModele(m), P);
      } catch (e) {
        constats.push(...controler(`sym ${i} erreur`, notationHtml(messageDErreur(e))));
        return;
      }
      const dessin = dessinProfil(profilDepuisModele(m));
      constats.push(...controler(`sym ${i} ecran`, dessin + verdictHtml(r) + bandeauMcr(r) + blocs(r).map((b) => tableHtml(b.lignes) + notationHtml(b.note ?? '')).join('')));
      const e = { forme: 'symetrique' as const, modele: m, resultat: r, dessin };
      constats.push(...controler(`sym ${i} note`, noteDeCalculHtml(noteDuCalcul(P, e, CARTOUCHE), STYLES_TRACE)));
      constats.push(...controler(`sym ${i} avertissements`, avertissementsDeLaNote(e).map(notationHtml).join(' ')));
      constats.push(...controlerCsv(`sym ${i} csv`, resultatsEnCsv(blocsEnTexte([blocEntrees(m), ...blocs(r)]))));
    });
    constats.push(...controler('catalogue', optionsCatalogue(familles())));
    expect(constats).toEqual([]);
  });

  it('ecran, dessin, note et CSV : cornieres, U, 2L, 2U', () => {
    const d = modeleParDefaut();
    const modeles: ModeleSaisie[] = [
      ...(['L', 'U', '2L', '2U'] as const).map((source) => ({ ...d, source, N: 20, My: 1 })),
      ...(['L', 'U', '2L', '2U'] as const).map((source) => ({ ...d, source, N: 50, My: 2, Mz: 1, Vz: 5, Vy: 5 })),
      ...(['L', 'U', '2L', '2U'] as const).map((source) => ({ ...d, source, N: -50 })),
      { ...d, source: 'L', N: 20, treillis: true },
      { ...d, source: 'L', N: 20, My: 2, Mcr: 30 },
      { ...d, source: '2L', N: 20, espacement: 5000 },
      { ...d, source: '2U', N: 20, My: 5, accolee: 'b' },
    ];
    const constats: string[] = [];
    modeles.forEach((m, i) => {
      let r: ReturnType<typeof verifierNonSymetrique>;
      try {
        r = verifierNonSymetrique(donneesNonSymetriquesDepuisModele(m), P);
      } catch (e) {
        constats.push(...controler(`nonsym ${i} erreur`, notationHtml(messageDErreur(e))));
        return;
      }
      const dessin = dessinProfil(profilGeneral(m));
      constats.push(
        ...controler(`nonsym ${i} ecran`, dessin + verdictHtml(r) + bandeauNonSymetrique(r) + blocsNonSymetriques(r).map((b) => tableHtml(b.lignes) + notationHtml(b.note ?? '')).join(''))
      );
      const e = { forme: 'non-symetrique' as const, modele: m, resultat: r, dessin };
      constats.push(...controler(`nonsym ${i} note`, noteDeCalculHtml(noteDuCalcul(P, e, CARTOUCHE), STYLES_TRACE)));
      constats.push(...controler(`nonsym ${i} avertissements`, avertissementsDeLaNote(e).map(notationHtml).join(' ')));
      constats.push(...controlerCsv(`nonsym ${i} csv`, resultatsEnCsv(blocsEnTexte([blocEntrees(m), ...blocsNonSymetriques(r)]))));
    });
    expect(constats).toEqual([]);
  });

  it('messages et erreurs', () => {
    const d = modeleParDefaut();
    const champs = champsDepuisModele(d);
    const lectures = [modeleDepuisChamps({ ...champs, n: 'abc' }), modeleDepuisChamps({ ...champs, mcr: 'abc' }), modeleDepuisChamps({ ...champs, source: 'Z' })];
    const calcul = (m: Partial<ModeleSaisie>): string => {
      const x = { ...d, ...m };
      try {
        if (['L', 'U', '2L', '2U'].includes(x.source)) verifierNonSymetrique(donneesNonSymetriquesDepuisModele(x), P);
        else verifierElement(donneesDepuisModele(x), P);
      } catch (e) {
        return messageDErreur(e);
      }
      return '';
    };
    const messages = [
      ...lectures.map((l) => (l.ok ? '' : l.message)),
      calcul({ source: 'I-soude', h: 0 }),
      calcul({ source: 'I-soude', tw: 0 }),
      calcul({ source: 'I-soude', tf: 200, h: 300 }),
      calcul({ source: 'tube-circulaire', d: 0 }),
      calcul({ source: 'tube-circulaire', t: 200, d: 300 }),
      calcul({ source: 'tube-circulaire', d: 1000, t: 3, N: 100 }),
      calcul({ source: 'tube-rectangulaire', t: 200, h: 300 }),
      calcul({ source: 'tube-rectangulaire', t: 100 }),
      calcul({ N: 1e6 }),
      calcul({ Lcry: 0, N: 100 }),
      calcul({ LLT: 0, My: 10 }),
      calcul({ Mcr: 0, My: 10 }),
      calcul({ psiLT: 2, My: 10 }),
      calcul({ psiY: 2, My: 10, N: 100 }),
      calcul({ diagrammeY: 'mixte-repartie', MhY: 0, MsY: 0, My: 10, N: 100 }),
      calcul({ source: '2L', ecartement: -1 }),
      calcul({ source: 'L', LT: 0, N: 10 }),
      calcul({ source: 'L', Lcrv: 0, N: 10 }),
      calcul({ source: 'I-soude', h: 1500, b: 300, tw: 5, tf: 20, Vz: 100 }),
      messageDErreur(new Error('')),
      textes().messages.nouvelleVersion,
      textes().messages.elementAbsent('#x'),
    ];
    expect(messages.flatMap((m, i) => controler(`message ${i}`, notationHtml(m)))).toEqual([]);
  });
});
