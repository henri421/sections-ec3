/**
 * Tests d'acceptation du lot E (audit R4) : profil luxembourgeois prerempli,
 * coefficients modifiables par l'utilisateur, valeurs imposees marquees, annexe
 * enregistree et relue, note qui montre l'annexe retenue.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { constatsAffichage, definirLangue, noteDeCalculHtml, texteVisible } from 'aedificium-ui';
import { ec3Recommande, verifierElement } from '../../src/index';
import { COEFS, coefsDeLAnnexe, ec3Lu, profilDeCalcul, profilDeLAnnexe } from '../../app/src/annexe';
import { champsDepuisModele, donneesDepuisModele, modeleDepuisChamps, modeleParDefaut, type ModeleSaisie } from '../../app/src/form';
import { noteDuCalcul, type EtatNote } from '../../app/src/note';

const CARTOUCHE = { projet: 'Halle', element: 'Poteau P1', date: '2026-11-18' };

/** Modele avec l'annexe luxembourgeoise, coefficients prerempli. */
function modeleLu(): ModeleSaisie {
  return { ...modeleParDefaut(), annexe: 'lu', coefs: coefsDeLAnnexe('lu') };
}

/** Etat du dernier calcul, comme le garde la page (forme symetrique : profil par defaut). */
function etatDe(m: ModeleSaisie): EtatNote {
  return {
    forme: 'symetrique',
    modele: m,
    resultat: verifierElement(donneesDepuisModele(m), profilDeCalcul(m.annexe, m.coefs)),
    dessin: '',
  };
}

describe('profil luxembourgeois', () => {
  it('chaque coefficient passe par valeurLu : valeur recommandee presumee, source AN-LU', () => {
    const lu = ec3Lu();
    const rec = ec3Recommande();
    for (const k of COEFS) {
      expect(lu[k].valeur).toBe(rec[k].valeur);
      expect(lu[k].source).toMatch(/^ILNAS-EN 1993-1-[15]\/AN-LU:2020, [\d.()]+ : valeur recommandée présumée retenue, non vérifiée sur l’annexe$/);
    }
    expect(lu.gamma_M0.source).toMatch(/^ILNAS-EN 1993-1-1\/AN-LU:2020, 6\.1\(1\) :/);
    expect(lu.eta.source).toMatch(/^ILNAS-EN 1993-1-5\/AN-LU:2020, 5\.1\(2\) :/);
    expect(lu.lambda_LT0.source).toMatch(/^ILNAS-EN 1993-1-1\/AN-LU:2020, 6\.3\.2\.3\(1\) :/);
    expect(lu.nom).toMatch(/Luxembourg/);
    expect(lu.annexe633).toEqual(rec.annexe633);
    expect(profilDeLAnnexe('recommande')).toEqual(rec);
  });

  it('une valeur changee par l utilisateur est marquee imposee, les autres gardent leur source', () => {
    const p = profilDeCalcul('lu', { ...coefsDeLAnnexe('lu'), gamma_M1: 1.1 });
    expect(p.gamma_M1.valeur).toBe(1.1);
    expect(p.gamma_M1.source).toMatch(/^valeur imposée par l’utilisateur, au lieu de 1 ; ILNAS-EN 1993-1-1\/AN-LU:2020/);
    expect(p.gamma_M0).toEqual(ec3Lu().gamma_M0);
  });

  it('annexe recommandee : une valeur changee est aussi marquee imposee', () => {
    const p = profilDeCalcul('recommande', { ...coefsDeLAnnexe('recommande'), eta: 1.3 });
    expect(p.eta.valeur).toBe(1.3);
    expect(p.eta.source).toMatch(/^valeur imposée par l’utilisateur, au lieu de 1,2 ; EN 1993-1-5:2006/);
  });
});

describe('saisie', () => {
  it('annexe et coefficients enregistres dans la saisie, relus', () => {
    const m: ModeleSaisie = { ...modeleParDefaut(), annexe: 'lu', coefs: { ...coefsDeLAnnexe('lu'), eta: 1.3 } };
    const champs = champsDepuisModele(m);
    expect(champs['annexe']).toBe('lu');
    expect(champs['coef_eta']).toBe('1,3');
    const l = modeleDepuisChamps(champs);
    expect(l.ok).toBe(true);
    if (l.ok) {
      expect(l.modele.annexe).toBe('lu');
      expect(l.modele.coefs.eta).toBe(1.3);
      expect(champsDepuisModele(l.modele)).toEqual(champs);
    }
  });

  it('ancien fichier sans annexe ni coefficients : valeurs recommandees', () => {
    const ancien: Record<string, string> = { ...champsDepuisModele(modeleParDefaut()) };
    for (const k of Object.keys(ancien)) if (k === 'annexe' || k.startsWith('coef_')) delete ancien[k];
    const l = modeleDepuisChamps(ancien);
    expect(l.ok).toBe(true);
    if (l.ok) {
      expect(l.modele.annexe).toBe('recommande');
      expect(l.modele.coefs).toEqual(coefsDeLAnnexe('recommande'));
    }
  });

  it('coefficient non numerique : message de saisie, pas de calcul', () => {
    const l = modeleDepuisChamps({ ...champsDepuisModele(modeleParDefaut()), coef_eta: 'abc' });
    expect(l.ok).toBe(false);
  });
});

describe('calcul', () => {
  it('gamma_M1 a 1,1 : le taux maximal augmente', () => {
    const m = modeleParDefaut();
    const tauxMax = (p: ReturnType<typeof profilDeCalcul>): number =>
      Math.max(...verifierElement(donneesDepuisModele(m), p).verifications.filter((v) => v.applicable).map((v) => v.taux ?? 0));
    expect(tauxMax(profilDeCalcul('recommande', { ...m.coefs, gamma_M1: 1.1 }))).toBeGreaterThan(tauxMax(profilDeCalcul('recommande', m.coefs)));
  });

  it('valeurs presumees egales aux recommandees : memes taux', () => {
    const m = modeleParDefaut();
    const taux = (p: ReturnType<typeof profilDeCalcul>): (number | null)[] =>
      verifierElement(donneesDepuisModele(m), p).verifications.map((v) => (v.applicable ? v.taux : null));
    expect(taux(profilDeCalcul('lu', coefsDeLAnnexe('lu')))).toEqual(taux(profilDeCalcul('recommande', coefsDeLAnnexe('recommande'))));
  });
});

describe('note', () => {
  it('annexe retenue : norme AN-LU, avertissement en tete, coefficients et sources', () => {
    const m = modeleLu();
    const note = noteDuCalcul(profilDeCalcul('lu', m.coefs), etatDe(m), CARTOUCHE);
    expect(note.cartouche.norme).toBe('EN 1993-1-1:2005, ILNAS-EN 1993-1-1/AN-LU:2020');
    expect(note.avertissements?.[0]).toMatch(/^Annexe nationale luxembourgeoise/);
    const texte = texteVisible(noteDeCalculHtml(note, ''));
    expect(texte).toContain('Luxembourg');
    expect(texte).toContain('γ');
    expect(texte).toContain('ILNAS-EN 1993-1-1/AN-LU:2020, 6.1(1)');
  });

  it('valeur imposee visible dans la note', () => {
    const m: ModeleSaisie = { ...modeleLu(), coefs: { ...coefsDeLAnnexe('lu'), gamma_M1: 1.1 } };
    const texte = texteVisible(noteDeCalculHtml(noteDuCalcul(profilDeCalcul('lu', m.coefs), etatDe(m), CARTOUCHE), ''));
    expect(texte).toContain('valeur imposée par l’utilisateur');
  });

  it('valeurs recommandees : norme inchangee, pas d avertissement d annexe', () => {
    const m = modeleParDefaut();
    const note = noteDuCalcul(ec3Recommande(), etatDe(m), CARTOUCHE);
    expect(note.cartouche.norme).toBe('EN 1993-1-1:2005');
    expect(note.avertissements?.some((a) => a.startsWith('Annexe nationale luxembourgeoise'))).toBe(false);
  });

  describe('en anglais', () => {
    beforeEach(() => definirLangue('en'));
    afterEach(() => definirLangue('fr'));

    it('la note luxembourgeoise ne laisse aucun reste de francais', () => {
      const m = modeleLu();
      const html = noteDeCalculHtml(noteDuCalcul(profilDeCalcul('lu', m.coefs), etatDe(m), CARTOUCHE), '');
      expect(constatsAffichage(texteVisible(html), { langue: 'en' })).toEqual([]);
    });
  });
});
