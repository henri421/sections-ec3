import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JETONS, valeursDesJetons } from 'aedificium-ui';
import { ec3Recommande, profilCatalogue, verifierElement } from '../../src/index';
import { champsDepuisModele, donneesDepuisModele, modeleDepuisChamps, modeleParDefaut, profilDepuisModele } from '../../app/src/form';
import { bandeauMcr, blocs, dessinProfil, lignesVerifications } from '../../app/src/vue';

const P = ec3Recommande();

describe('saisie', () => {
  it('aller-retour champs -> modele -> champs', () => {
    const c = champsDepuisModele(modeleParDefaut());
    const l = modeleDepuisChamps(c);
    expect(l.ok).toBe(true);
    if (l.ok) expect(champsDepuisModele(l.modele)).toEqual(c);
  });

  it('le modele par defaut se calcule, et chaque type de section aussi', () => {
    for (const source of ['catalogue', 'I-soude', 'tube-rectangulaire', 'tube-circulaire'] as const) {
      const m = { ...modeleParDefaut(), source };
      expect(() => verifierElement(donneesDepuisModele(m), P)).not.toThrow();
    }
  });

  it('M_cr vide : expression hors norme ; saisi : repris', () => {
    const l = modeleDepuisChamps({ ...champsDepuisModele(modeleParDefaut()), mcr: '150' });
    if (!l.ok) throw new Error(l.message);
    expect(donneesDepuisModele(l.modele).McrSaisi).toBe(150);
  });

  it('longueurs en m converties en mm', () => {
    expect(donneesDepuisModele(modeleParDefaut()).Lcr_z).toBe(4000);
  });
});

describe('vues', () => {
  const r = verifierElement(donneesDepuisModele(modeleParDefaut()), P);

  it('une verification sans objet s ecrit « non applicable », jamais un taux nul', () => {
    const l = lignesVerifications(r).find((x) => x.symbole === 'Cisaillement selon y');
    expect(l?.valeur).toBe('non applicable');
  });

  it('bandeau hors norme des que M_cr vient de l expression bibliographique', () => {
    expect(bandeauMcr(r)).toContain('HORS NORME');
  });

  it('dessins sans NaN pour chaque type de section', () => {
    for (const source of ['catalogue', 'I-soude', 'tube-rectangulaire', 'tube-circulaire'] as const) {
      expect(dessinProfil(profilDepuisModele({ ...modeleParDefaut(), source }))).not.toContain('NaN');
    }
    expect(dessinProfil(profilCatalogue('IPE 300'))).toContain(' A ');
  });

  it('blocs de sortie : aucun bloc omis', () => {
    expect(blocs(r).map((b) => b.titre)).toEqual(['Proprietes recalculees', 'Classification (§5.5)', 'Verifications', 'Instabilites (§6.3)', 'Verdict']);
  });

  it('le :root de style.css concorde avec les jetons communs', () => {
    const css = readFileSync(fileURLToPath(new URL('../../app/src/style.css', import.meta.url)), 'utf8');
    const page = valeursDesJetons(css);
    for (const [nom, valeur] of valeursDesJetons(JETONS)) expect(page.get(nom)).toBe(valeur);
  });
});
