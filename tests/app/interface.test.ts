import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JETONS, valeursDesJetons } from 'aedificium-ui';
import { ec3Recommande, familles, profilCatalogue, verifierElement, verifierNonSymetrique } from '../../src/index';
import { champsDepuisModele, donneesDepuisModele, donneesNonSymetriquesDepuisModele, estNonSymetrique, modeleDepuisChamps, modeleParDefaut, profilDepuisModele, profilGeneral } from '../../app/src/form';
import { bandeauMcr, bandeauNonSymetrique, blocs, blocsNonSymetriques, dessinProfil, lignesVerifications, optionsCatalogue, verdictHtml } from '../../app/src/vue';

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

describe('cornieres, U, 2L et 2U dans l interface', () => {
  const sources = ['L', 'U', '2L', '2U'] as const;

  it('chaque source se calcule, avec un dessin sans NaN et les cinq blocs de sortie', () => {
    for (const source of sources) {
      const m = { ...modeleParDefaut(), source };
      expect(estNonSymetrique(m)).toBe(true);
      const r = verifierNonSymetrique(donneesNonSymetriquesDepuisModele(m), P);
      expect(blocsNonSymetriques(r).map((b) => b.titre)).toEqual(['Proprietes recalculees', 'Classification (§5.5)', 'Verifications', 'Instabilites (§6.3)', 'Verdict']);
      const svg = dessinProfil(profilGeneral(m));
      expect(svg).not.toContain('NaN');
      expect(svg).toContain('>C</text>');
    }
  });

  it('corniere seule : axes principaux u, v dessines ; 2L : pas d axes principaux', () => {
    expect(dessinProfil(profilGeneral({ ...modeleParDefaut(), source: 'L' }))).toContain('>u</text>');
    expect(dessinProfil(profilGeneral({ ...modeleParDefaut(), source: '2L' }))).not.toContain('>u</text>');
  });

  it('champs propres : aller-retour, longueurs en m, espacement des liaisons transmis aux seuls profils composes', () => {
    const m = { ...modeleParDefaut(), source: '2L' as const, Lcrv: 2.5, LT: 3, espacement: 250, treillis: true };
    const l = modeleDepuisChamps(champsDepuisModele(m));
    expect(l.ok).toBe(true);
    if (!l.ok) return;
    expect(champsDepuisModele(l.modele)).toEqual(champsDepuisModele(m));
    const d = donneesNonSymetriquesDepuisModele(l.modele);
    expect(d.Lcr_v).toBe(2500);
    expect(d.L_T).toBe(3000);
    expect(d.espacementLiaisons).toBe(250);
    expect(d.barreDeTreillis).toBe(true);
    expect(donneesNonSymetriquesDepuisModele({ ...m, source: 'L' }).espacementLiaisons).toBeNull();
  });

  it('profilDepuisModele refuse une corniere : la page passe par profilGeneral', () => {
    expect(() => profilDepuisModele({ ...modeleParDefaut(), source: 'L' })).toThrow('profilGeneral');
  });

  it('verdict incomplet et bandeau : deversement non verifie signale', () => {
    const m = { ...modeleParDefaut(), source: 'L' as const, N: 20, My: 1 };
    const r = verifierNonSymetrique(donneesNonSymetriquesDepuisModele(m), P);
    expect(verdictHtml(r)).toContain('Verification incomplete');
    expect(bandeauNonSymetrique(r)).toContain('NON VERIFIE');
    expect(bandeauNonSymetrique(r)).toContain('HORS NORME');
  });

  it('listes du catalogue : toutes les cornieres et tous les U', () => {
    const html = optionsCatalogue(familles().filter((f) => f.type === 'L'));
    expect(html).toContain('<optgroup label="L-egales">');
    expect((html.match(/<option /g) ?? []).length).toBe(224);
  });
});

