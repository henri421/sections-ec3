/**
 * Cablage de l'interface des sections acier. Ce module ne calcule RIEN : il
 * lit les champs, appelle le noyau et confie la mise en forme a `form`,
 * `vue` et `export`, tous purs.
 */

import { blocsEnTexte, definirLangue, langueDuDocument, noteDeCalculHtml, notationTexte, ouvrirOuTelecharger, resultatsEnCsv, svgAutonome, telecharger } from 'aedificium-ui';
import { ec3Recommande, familles, verifierElement, verifierNonSymetrique } from '../../src/index';
import {
  champsDepuisModele,
  donneesDepuisModele,
  donneesNonSymetriquesDepuisModele,
  estNonSymetrique,
  modeleDepuisChamps,
  modeleParDefaut,
  profilGeneral,
  type ModeleSaisie,
} from './form';
import {
  bandeauMcr,
  bandeauNonSymetrique,
  blocEntrees,
  blocs,
  blocsNonSymetriques,
  lignesInstabiliteNonSymetrique,
  lignesProprietesNonSymetriques,
  optionsCatalogue,
  dessinProfil,
  lignesClassification,
  lignesInstabilite,
  lignesProprietes,
  lignesVerifications,
  messageDErreur,
  tableHtml,
  verdictHtml,
} from './vue';
import { STYLES_TRACE } from './export';
import { noteDuCalcul, type EtatNote } from './note';
import { textes } from './textes';
import './style.css';

definirLangue(langueDuDocument(document));

function exige<T extends Element>(selecteur: string): T {
  const trouve = document.querySelector(selecteur);
  if (trouve === null) throw new Error(textes().messages.elementAbsent(selecteur));
  return trouve as T;
}

const PROFIL = ec3Recommande();
const formulaire = exige<HTMLFormElement>('#formulaire');
const role = (nom: string): HTMLElement => exige<HTMLElement>(`[data-role="${nom}"]`);
const zones = {
  erreurSaisie: role('erreur-saisie'),
  erreur: role('erreur'),
  mcr: role('mcr'),
  verdict: role('verdict'),
  verifications: role('verifications'),
  dessin: role('dessin'),
  proprietes: role('proprietes'),
  classification: role('classification'),
  instabilites: role('instabilites'),
};

function champs(): (HTMLInputElement | HTMLSelectElement)[] {
  return Array.from(formulaire.querySelectorAll('[data-champ]'));
}

function valeursDesChamps(): Record<string, string> {
  const v: Record<string, string> = {};
  for (const el of champs()) {
    const nom = el.getAttribute('data-champ');
    if (nom === null) continue;
    v[nom] = el instanceof HTMLInputElement && el.type === 'checkbox' ? (el.checked ? 'oui' : 'non') : el.value;
  }
  return v;
}

function ecrireModele(m: ModeleSaisie): void {
  const v = champsDepuisModele(m);
  for (const el of champs()) {
    const nom = el.getAttribute('data-champ');
    if (nom === null || v[nom] === undefined) continue;
    if (el instanceof HTMLInputElement && el.type === 'checkbox') el.checked = v[nom] === 'oui';
    else el.value = v[nom];
  }
}

function ajusterLesGroupes(m: ModeleSaisie): void {
  const vis: Record<string, boolean> = {
    catalogue: m.source === 'catalogue',
    hb: m.source === 'I-soude' || m.source === 'tube-rectangulaire',
    soude: m.source === 'I-soude',
    chs: m.source === 'tube-circulaire',
    tube: m.source === 'tube-rectangulaire' || m.source === 'tube-circulaire',
    lineaire: m.diagramme === 'lineaire',
    charge: m.diagramme !== 'lineaire',
    'lineaire-y': m.diagrammeY === 'lineaire' || m.diagrammeY.startsWith('mixte'),
    'lineaire-z': m.diagrammeZ === 'lineaire' || m.diagrammeZ.startsWith('mixte'),
    'mixte-y': m.diagrammeY.startsWith('mixte'),
    'mixte-z': m.diagrammeZ.startsWith('mixte'),
    corniere: m.source === 'L' || m.source === '2L',
    u: m.source === 'U' || m.source === '2U',
    accolee: m.source === '2L',
    compose: m.source === '2L' || m.source === '2U',
    lcrv: m.source === 'L',
    nonsym: estNonSymetrique(m),
    treillis: m.source === 'L' || m.source === '2L',
  };
  for (const [g, visible] of Object.entries(vis)) exige<HTMLElement>(`[data-groupe="${g}"]`).hidden = !visible;
}

function montrer(el: HTMLElement, message: string | null): void {
  el.textContent = message === null ? '' : notationTexte(message);
  el.hidden = message === null;
}

let etat: EtatNote | null = null;

const CLE_CARTOUCHE = 'sections-ec3:cartouche';

/** Cartouche enregistre : projet et element, chaines vides si absents ou illisibles. */
function lireCartouche(): { projet: string; element: string } {
  try {
    const lu: unknown = JSON.parse(localStorage.getItem(CLE_CARTOUCHE) ?? '{}');
    if (typeof lu !== 'object' || lu === null) return { projet: '', element: '' };
    const o = lu as Record<string, unknown>;
    return {
      projet: typeof o.projet === 'string' ? o.projet : '',
      element: typeof o.element === 'string' ? o.element : '',
    };
  } catch {
    return { projet: '', element: '' };
  }
}

function rafraichir(): void {
  const lecture = modeleDepuisChamps(valeursDesChamps());
  if (!lecture.ok) {
    montrer(zones.erreurSaisie, lecture.message);
    return;
  }
  montrer(zones.erreurSaisie, null);
  const m = lecture.modele;
  ajusterLesGroupes(m);
  try {
    const dessin = dessinProfil(profilGeneral(m));
    zones.dessin.innerHTML = dessin;
    if (estNonSymetrique(m)) {
      const r = verifierNonSymetrique(donneesNonSymetriquesDepuisModele(m), PROFIL);
      zones.mcr.innerHTML = bandeauMcr(r) + bandeauNonSymetrique(r);
      zones.verdict.innerHTML = verdictHtml(r);
      zones.verifications.innerHTML = tableHtml(lignesVerifications(r));
      zones.proprietes.innerHTML = tableHtml(lignesProprietesNonSymetriques(r));
      zones.classification.innerHTML = tableHtml(lignesClassification(r));
      zones.instabilites.innerHTML = tableHtml(lignesInstabiliteNonSymetrique(r));
      etat = { forme: 'non-symetrique', modele: m, resultat: r, dessin };
    } else {
      const r = verifierElement(donneesDepuisModele(m), PROFIL);
      zones.mcr.innerHTML = bandeauMcr(r);
      zones.verdict.innerHTML = verdictHtml(r);
      zones.verifications.innerHTML = tableHtml(lignesVerifications(r));
      zones.proprietes.innerHTML = tableHtml(lignesProprietes(r));
      zones.classification.innerHTML = tableHtml(lignesClassification(r));
      zones.instabilites.innerHTML = tableHtml(lignesInstabilite(r));
      etat = { forme: 'symetrique', modele: m, resultat: r, dessin };
    }
    montrer(zones.erreur, null);
  } catch (e) {
    montrer(zones.erreur, messageDErreur(e));
  }
}

document.addEventListener('click', (ev) => {
  const cible = ev.target;
  if (!(cible instanceof HTMLElement)) return;
  const action = cible.dataset.action;
  if (action === undefined || !action.startsWith('exporter-') || etat === null) return;
  const e = etat;
  const nom = profilGeneral(e.modele).nom.replace(/[^A-Za-z0-9,.-]+/g, '');
  const resultats = e.forme === 'symetrique' ? blocs(e.resultat) : blocsNonSymetriques(e.resultat);
  if (action === 'exporter-dessin') {
    telecharger(`${nom}.svg`, svgAutonome(e.dessin, STYLES_TRACE), 'image/svg+xml;charset=utf-8');
  } else if (action === 'exporter-resultats') {
    telecharger(`${nom}-resultats.csv`, resultatsEnCsv(blocsEnTexte([blocEntrees(e.modele), ...resultats])), 'text/csv;charset=utf-8');
  } else if (action === 'exporter-note') {
    ouvrirOuTelecharger(
      `${nom}-note.html`,
      noteDeCalculHtml(
        noteDuCalcul(PROFIL, e, {
          projet: champProjet.value,
          element: champElement.value,
          date: new Date().toISOString().slice(0, 10),
        }),
        STYLES_TRACE
      )
    );
  }
});

// Listes des profils en I, des cornieres et des U, tirees du catalogue (trop longues pour le HTML).
const parType = (t: 'I-lamine' | 'L' | 'U') => familles().filter((f) => f.type === t);
exige<HTMLSelectElement>('[data-champ="nom_catalogue"]').innerHTML = optionsCatalogue(parType('I-lamine'));
exige<HTMLSelectElement>('[data-champ="nom_corniere"]').innerHTML = optionsCatalogue(parType('L'));
exige<HTMLSelectElement>('[data-champ="nom_u"]').innerHTML = optionsCatalogue(parType('U'));

const champProjet = exige<HTMLInputElement>('[data-role="projet"]');
const champElement = exige<HTMLInputElement>('[data-role="element"]');
const cartouche = lireCartouche();
champProjet.value = cartouche.projet;
champElement.value = cartouche.element;
exige<HTMLElement>('#sorties').addEventListener('input', () => {
  try {
    localStorage.setItem(CLE_CARTOUCHE, JSON.stringify({ projet: champProjet.value, element: champElement.value }));
  } catch {
    /* stockage indisponible : le cartouche reste valable pour la session */
  }
});

ecrireModele(modeleParDefaut());
formulaire.addEventListener('input', rafraichir);
formulaire.addEventListener('change', rafraichir);
rafraichir();

if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  void import('./pwa').then((m) => m.enregistrerServiceWorker());
}
