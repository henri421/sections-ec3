// Barre des feuilles de calcul (etape 9.5, formulaire a champs).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { champsDepuisModele, modeleDepuisChamps, modeleParDefaut } from '../../app/src/form';

const lire = (f: string): string => readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8');

describe('feuilles de calcul (etape 9.5)', () => {
  it('releve des champs -> modele -> releve : identique', () => {
    const champs = champsDepuisModele(modeleParDefaut());
    const lecture = modeleDepuisChamps(JSON.parse(JSON.stringify(champs)));
    expect(lecture.ok).toBe(true);
    if (lecture.ok) expect(champsDepuisModele(lecture.modele)).toEqual(champs);
  });

  it('depend d aedificium-ui v1.6', () => {
    expect(lire('package.json')).toContain('github:henri421/aedificium-ui#v1.6.');
  });

  it('les pages francaise et anglaise ont la zone de la barre, sous l en-tete', () => {
    for (const page of ['app/index.html', 'app/en/index.html']) {
      const html = lire(page);
      const zone = html.indexOf('data-role="feuilles"');
      expect(zone, page).toBeGreaterThan(html.indexOf('</header>'));
      expect(zone, page).toBeLessThan(html.indexOf('<main'));
    }
  });

  it('main.ts branche la barre et signale chaque saisie', () => {
    const m = lire('app/src/main.ts');
    expect(m).toContain(`app: 'sections-ec3'`);
    expect(m).toMatch(/function rafraichir\(\): void \{\s*barre\?\.signaler\(\);/);
  });
});
