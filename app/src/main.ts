/**
 * Cablage de l'interface des sections acier. Ce module ne calcule RIEN : il
 * lit les champs, appelle le noyau et confie la mise en forme a `form`,
 * `vue` et `export`, tous purs.
 */

import { ouvrirOuTelecharger, resultatsEnCsv, svgAutonome, telecharger, type BlocResultat } from 'aedificium-ui';
import { ec3Recommande, provenance, verifierElement, type ResultatElement } from '../../src/index';
import { champsDepuisModele, donneesDepuisModele, modeleDepuisChamps, modeleParDefaut, profilDepuisModele, type ModeleSaisie } from './form';
import {
  bandeauMcr,
  blocs,
  dessinProfil,
  lignesClassification,
  lignesInstabilite,
  lignesProprietes,
  lignesVerifications,
  messageDErreur,
  tableHtml,
  verdictHtml,
} from './vue';
import { STYLES_TRACE, noteDeCalculHtml } from './export';
import './style.css';

function exige<T extends Element>(selecteur: string): T {
  const trouve = document.querySelector(selecteur);
  if (trouve === null) throw new Error(`element absent de la page : ${selecteur}`);
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
    'lineaire-y': m.diagrammeY === 'lineaire',
    'lineaire-z': m.diagrammeZ === 'lineaire',
  };
  for (const [g, visible] of Object.entries(vis)) exige<HTMLElement>(`[data-groupe="${g}"]`).hidden = !visible;
}

function montrer(el: HTMLElement, message: string | null): void {
  el.textContent = message ?? '';
  el.hidden = message === null;
}

interface Etat {
  modele: ModeleSaisie;
  resultat: ResultatElement;
  dessin: string;
}

let etat: Etat | null = null;

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
    const r = verifierElement(donneesDepuisModele(m), PROFIL);
    const dessin = dessinProfil(profilDepuisModele(m));
    zones.mcr.innerHTML = bandeauMcr(r);
    zones.verdict.innerHTML = verdictHtml(r);
    zones.verifications.innerHTML = tableHtml(lignesVerifications(r));
    zones.dessin.innerHTML = dessin;
    zones.proprietes.innerHTML = tableHtml(lignesProprietes(r));
    zones.classification.innerHTML = tableHtml(lignesClassification(r));
    zones.instabilites.innerHTML = tableHtml(lignesInstabilite(r));
    etat = { modele: m, resultat: r, dessin };
    montrer(zones.erreur, null);
  } catch (e) {
    montrer(zones.erreur, messageDErreur(e));
  }
}

function entrees(m: ModeleSaisie): BlocResultat {
  const p = profilDepuisModele(m);
  return {
    titre: 'Donnees',
    lignes: [
      { symbole: 'profil', libelle: provenance(p.nom), valeur: `${p.nom}, ${m.nuance}` },
      { symbole: 'N, M_y, M_z', libelle: 'sollicitations de calcul', valeur: `${m.N} kN ; ${m.My} ; ${m.Mz} kN.m` },
      { symbole: 'V_z, V_y', libelle: 'efforts tranchants', valeur: `${m.Vz} ; ${m.Vy} kN` },
      { symbole: 'L_cr,y, L_cr,z, L', libelle: 'longueurs de flambement, entre maintiens', valeur: `${m.Lcry} ; ${m.Lcrz} ; ${m.LLT} m` },
    ],
    note: null,
  };
}

document.addEventListener('click', (ev) => {
  const cible = ev.target;
  if (!(cible instanceof HTMLElement)) return;
  const action = cible.dataset.action;
  if (action === undefined || !action.startsWith('exporter-') || etat === null) return;
  const e = etat;
  const nom = profilDepuisModele(e.modele).nom.replace(/\s+/g, '');
  if (action === 'exporter-dessin') {
    telecharger(`${nom}.svg`, svgAutonome(e.dessin, STYLES_TRACE), 'image/svg+xml;charset=utf-8');
  } else if (action === 'exporter-resultats') {
    telecharger(`${nom}-resultats.csv`, resultatsEnCsv([entrees(e.modele), ...blocs(e.resultat)]), 'text/csv;charset=utf-8');
  } else if (action === 'exporter-note') {
    const m = e.resultat.deversement.M_cr;
    ouvrirOuTelecharger(
      `${nom}-note.html`,
      noteDeCalculHtml(
        {
          titre: `${profilDepuisModele(e.modele).nom}, ${e.modele.nuance}`,
          date: new Date().toISOString().slice(0, 10),
          profil: `${PROFIL.nom} (${PROFIL.date})`,
          entrees: [entrees(e.modele)],
          dessins: [e.dessin],
          resultats: blocs(e.resultat),
          avertissements: m !== null && m.origine === 'hors-norme' ? [`M_cr calcule HORS NORME : ${m.source}.`] : [],
          hypotheses: [
            'Proprietes recalculees a partir des dimensions nominales ; aucune classe stockee.',
            'Semelles classees en compression uniforme, du cote de la securite.',
            'Facteurs k_ij de l annexe B du §6.3.3 ; C_m pour des moments lineaires.',
            'Valeurs recommandees de l EN 1993-1-1 ; aucune annexe nationale codee.',
          ],
        },
        STYLES_TRACE
      )
    );
  }
});

ecrireModele(modeleParDefaut());
formulaire.addEventListener('input', rafraichir);
formulaire.addEventListener('change', rafraichir);
rafraichir();

if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  void import('./pwa').then((m) => m.enregistrerServiceWorker());
}
