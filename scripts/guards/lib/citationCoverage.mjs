import { estObjet } from '../../../src/lib/objet.mjs';

const { SANS_LIVRE_DEFINITIF } = await import('../../../src/data/schemas/grammaire/sans-livre.ts');

// Mécanique de mesure « citation par ENTRÉE » (#309, suite #278/#281). #278 a posé la garde de
// FORME (`sourceRefInline.mjs` — aucune réinvention de `sourceRefSchema`) ; #309 mesure la
// COUVERTURE réelle : chaque dataset de `src/data/*.json` porte-t-il `source: {book,page}` sur CHACUNE
// de ses entrées RÉELLES ? Le piège signalé au ticket : un comptage brut (tout id trouvé, y compris les ids
// imbriqués — `specs`/`ranges`/`levels`…) gonfle le dénominateur. Ici on ne compte QUE les entrées
// de PREMIER niveau (item d'un tableau racine, ou item d'un tableau de catégorie type
// `criticals.json.tete`/`mass-battle.json.powerEstimate`) — jamais les sous-objets d'une entrée.
// Module ESM pur, exécutable par `node` nu — consommé par `scripts/data/audit-citations.mjs`
// (rapport) ET par `src/data/citation-coverage-guard.test.ts` (verrou cliquet).

/** Une entrée cite sa source si `source.book` (forme `sourceRefSchema`, `src/data/schemas/grammaire/valeurs.ts:38`),
 *  le champ `maison` non vide top-level (il porte SA justification : rationale +
 *  réfs dans le texte même, ex. `proue-idole-de-stromfels` #221, EST la source de l'entrée), ou
 *  `alsoIn` porte au moins un emplacement bien formé (forme `secondarySourceRefSchema`, `src/data/schemas/grammaire/valeurs.ts:66`
 *  — #563 : l'ancre `source` reste la forme retenue, mais un `alsoIn` seul ne doit JAMAIS compter
 *  « non cité » si un futur schéma le rend co-porteur ; réfuté par `!Array.isArray(rec.source)` qui
 *  ne voit QUE l'ancre — trou permissif inverse : une entrée sans ancre valide mais avec des
 *  emplacements `alsoIn` complets serait comptée non citée à tort). Morsure : #563 Lot 1 item 1.
 *  @param {unknown} item @returns {boolean} */
export function isCitedItem(item) {
  if (!estObjet(item)) return false;
  if (estObjet(item.source) && typeof item.source.book === 'string') return true;
  if (typeof item.maison === 'string' && item.maison.length > 0) return true;
  if (Array.isArray(item.alsoIn) && item.alsoIn.some((ref) => estObjet(ref) && typeof ref.book === 'string' && typeof ref.page === 'number')) return true;
  return false;
}

/** Libellé d'une entrée pour le rapport (id si présent, sinon min/max, sinon index). */
function entryLabel(item, key, idx) {
  if (estObjet(item)) {
    if (typeof item.id === 'string') return key ? `${key}.${item.id}` : item.id;
    if (typeof item.min === 'number') return `${key ? key + '.' : ''}${item.min}-${item.max}`;
  }
  return `${key ? key + '.' : ''}#${idx}`;
}

/**
 * Résultat de mesure d'un dataset (fichier `.json` de `src/data`).
 * @typedef {{ total: number, cited: number, missing: string[], shape: 'array'|'array-of-documents'|'map-of-lists'|'single' }} DatasetCoverage
 */

/**
 * Le tableau racine est-il une LISTE DE DOCUMENTS PORTEURS (chacun avec sa charge `entries[]`) ?
 * Forme d'un document à `options.rangee` publié en famille `entite` (`document.ts`) :
 * `miscast.json` = 5 documents, 111 rangées. Sans ce bras, le scan ne compterait que les 5 documents
 * de premier niveau et les 111 rangées — qui portent CHACUNE sa `source` — sortiraient de toute
 * garde de couverture, en silence.
 *
 * Condition SYMETRIQUE de `map-of-lists` : au moins un document porte une charge non vide d'objets,
 * ET au moins une RANGÉE cite déjà sa source (signe que ce dataset suit la convention PAR ENTRÉE —
 * un dataset-liste ordinaire dont une entrée aurait un champ `entries` de sous-objets NON cités
 * reste en forme `array`, son dénominateur inchangé).
 * Mesuré le 2026-08-28 sur les 2 racines : `miscast.json` est le SEUL dataset-liste concerné.
 * @param {unknown[]} data @returns {boolean}
 */
function estListeDeDocumentsPorteurs(data) {
  const porteurs = data.filter((d) => estObjet(d) && Array.isArray(d.entries) && d.entries.length > 0 && d.entries.every(estObjet));
  if (!porteurs.length) return false;
  return porteurs.some((d) => /** @type {unknown[]} */ (d.entries).some(isCitedItem));
}

/** Nœud `{ die, entries }` d'une sous-table tirée (`tableTiree`, `src/data/schemas/grammaire/document.ts`). */
function estTableTiree(v) {
  return estObjet(v) && Object.keys(v).length === 2 && typeof v.die === 'string' && Array.isArray(v.entries);
}

/**
 * Détecte la FORME d'un dataset et compte ses entrées RÉELLES + leur citation.
 * - `array` : le fichier racine EST le tableau d'entrées (`skills.json`, `talents.json`…).
 * - `array-of-documents` : le fichier racine est un tableau de DOCUMENTS PORTEURS, chacun avec sa
 *   charge `entries[]` (`options.rangee` de la fabrique, `miscast.json`) — on compte les documents ET
 *   leurs rangées, chaque manquant nommé `<id-du-document>.<id-de-la-rangée>`.
 * - `map-of-lists` : objet racine dont une ou plusieurs propriétés DIRECTES sont des tableaux
 *   d'objets ET dont AU MOINS UN item de ces tableaux cite déjà sa source individuellement —
 *   signe que ce dataset suit la convention PAR ENTRÉE (`sea-weather.json.precipitations`,
 *   `mass-battle.json.powerEstimate`…) : chaque tableau est une CATÉGORIE de la même famille de
 *   table, les entrées sont les items de CES tableaux, jamais recursées plus profond (`ops`/
 *   `ranges` imbriqués ne comptent pas). Une propriété DIRECTE nœud `{ die, entries }` compte ses
 *   `entries` comme une telle catégorie (`land-cargo.json.rumeurs`).
 * - `single` : objet de config unique — cité si sa RACINE porte `source` (convention
 *   documentée `src/data/schemas/grammaire/valeurs.ts:49-54` : "à la racine quand le dataset est un objet de config unique
 *   plutôt qu'une liste" — couvre alors TOUT le fichier, y compris les tableaux/sous-tables
 *   imbriqués, ex. `river-criticals.json.tables`). Sans racine citée ET sans
 *   tableau à convention par-entrée, le fichier entier est UNE entrée non citée.
 * @param {unknown} data @returns {DatasetCoverage}
 */
export function auditDataset(data) {
  if (Array.isArray(data)) {
    if (estListeDeDocumentsPorteurs(data)) {
      const missing = [];
      let total = 0;
      let cited = 0;
      data.forEach((doc, i) => {
        total++;
        const etiquette = entryLabel(doc, '', i);
        if (isCitedItem(doc)) cited++;
        else missing.push(etiquette);
        if (!estObjet(doc) || !Array.isArray(doc.entries)) return;
        doc.entries.forEach((row, j) => {
          total++;
          if (isCitedItem(row)) cited++;
          else missing.push(entryLabel(row, etiquette, j));
        });
      });
      return { total, cited, missing, shape: 'array-of-documents' };
    }
    const total = data.length;
    const missing = [];
    let cited = 0;
    data.forEach((item, i) => {
      if (isCitedItem(item)) cited++;
      else missing.push(entryLabel(item, '', i));
    });
    return { total, cited, missing, shape: 'array' };
  }
  if (estObjet(data)) {
    // La RACINE citée prime (convention documentée `src/data/schemas/grammaire/valeurs.ts:49-54`) : elle couvre tout le
    // fichier, y compris les tableaux/sous-tables imbriqués (`river-criticals.json.tables`…) — même quand une valeur scalaire annexe (`crew-morale.json.base`) est la seule
    // réellement visée par cette réf précise, le fichier est considéré couvert.
    if (isCitedItem(data)) return { total: 1, cited: 1, missing: [], shape: 'single' };
    const categoryProps = Object.entries(data)
      .map(([k, v]) => (estTableTiree(v) ? [`${k}.entries`, v.entries] : [k, v]))
      .filter(([, v]) => Array.isArray(v) && v.length > 0 && v.every(estObjet));
    if (categoryProps.length > 0) {
      const missing = [];
      let total = 0;
      let cited = 0;
      for (const [key, arr] of categoryProps) {
        arr.forEach((item, i) => {
          total++;
          if (isCitedItem(item)) cited++;
          else missing.push(entryLabel(item, key, i));
        });
      }
      return { total, cited, missing, shape: 'map-of-lists' };
    }
    return { total: 1, cited: 0, missing: ['(racine)'], shape: 'single' };
  }
  return { total: 0, cited: 0, missing: [], shape: 'single' };
}

/**
 * Exemptions de couverture propres aux datasets absents de SANS_LIVRE_DEFINITIF.
 * Chaque entrée porte son motif ; les documents définitivement sans livre sont déclarés au registre TS.
 * `src/data/citation-coverage-guard.test.ts` exige le retrait d’une exemption résiduelle dès que
 * `auditDataset` mesure `cited === total` (> 0), et refuse les fichiers absents.
 * @type {Record<string, string>}
 */
export const EXEMPT_DATASETS = {
  // (`reglesOptionnelles.json` n'est PAS exempté : sa dette de folios est un cliquet DÉCROISSANT,
  //  `BASELINES` de `src/data/citation-coverage-guard.test.ts` — E8 du programme #1318.)
};

/** Motif d’exemption de citation d’un fichier de dataset.
 * @param {string} fichier @returns {string | undefined} */
export function exemptionDeDataset(fichier) {
  const type = fichier.replace(/\.json$/, '');
  if (Object.hasOwn(SANS_LIVRE_DEFINITIF, type)) return SANS_LIVRE_DEFINITIF[type];
  return Object.hasOwn(EXEMPT_DATASETS, fichier) ? EXEMPT_DATASETS[fichier] : undefined;
}
