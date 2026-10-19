// Lentille #329-2 « donnée curée jamais surfacée » — rapport (PAS de garde, PAS de correction).
// Pour chaque dataset `src/data/*.json`, détecte les champs de PROSE (string longue, curée
// verbatim — desc/effet/enjeu/notes…) et vérifie s'ils ont au moins un CONSOMMATEUR dans
// `src/ui`/`src/state` (grep du nom de champ). Précédent : `activities.json.desc`, curé, jamais
// rendu avant #330. Heuristique, PAS un garde-fou structurel — un accès générique/spread partagé
// par plusieurs datasets rend l'attribution incertaine (classe « indéterminable »).
// Usage : node scripts/data/prose-field-usage-report.mjs [--json]

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { estFichierVitest } from '../guards/lib/fichierVitest.mjs';

const ROOT = process.cwd();
const DATA_DIR = join(ROOT, 'src/data');

/** Noms de champ connus comme prose/présentation (vocabulaire curé), au-delà de l'heuristique de longueur. */
const KNOWN_PROSE_NAMES = new Set([
  'desc', 'description', 'effet', 'effect', 'enjeu', 'note', 'notes', 'texte', 'text', 'resume',
  'résumé', 'consequence', 'conséquence', 'contexte', 'ambiance', 'histoire', 'lore', 'presentation',
  'présentation', 'regle', 'regles', 'règle', 'règles', 'citation', 'synopsis', 'rumeur', 'rumeurs',
  'accroche', 'intro', 'introduction', 'conclusion', 'remarque', 'avertissement', 'quote', 'blurb',
  'backstory', 'raw',
]);

/** Champs à exclure même s'ils matchent (vocabulaire structurel, pas de la prose de présentation). */
const EXCLUDE_NAMES = new Set(['id', 'label', 'labelF', 'kind', 'type', 'subType', 'book', 'op', 'arg', 'on', 'folder', 'unit', 'char', 'skill', 'career', 'status', 'span', 'reach', 'class', 'icon', 'nom', 'loc', 'region', 'maison', 'language', 'fichier', 'perimetre', 'verrou', 'concept']);

const PROSE_LENGTH_THRESHOLD = 40; // longueur médiane à partir de laquelle une string "libre" est candidate

function listJsonFiles(dir) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => join(dir, f))
    .filter((f) => statSync(f).isFile());
}

/** Marche récursive d'une valeur JSON, collecte {key -> string[]} des valeurs string rencontrées. */
function collectStringsByKey(value, acc) {
  if (Array.isArray(value)) {
    for (const v of value) collectStringsByKey(v, acc);
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (typeof v === 'string') {
        (acc[k] ??= []).push(v);
      } else {
        collectStringsByKey(v, acc);
      }
    }
  }
}

function median(nums) {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[s.length ? mid - 1 : 0] + s[mid]) / 2;
}

/** Détecte les champs "prose" d'un dataset : nom connu OU longueur médiane > seuil. */
function proseFieldsOf(jsonPath) {
  const raw = JSON.parse(readFileSync(jsonPath, 'utf8'));
  const byKey = {};
  collectStringsByKey(raw, byKey);
  const fields = [];
  for (const [key, values] of Object.entries(byKey)) {
    if (EXCLUDE_NAMES.has(key)) continue;
    if (!/^[a-z][a-zA-Z0-9]*$/.test(key)) continue; // exclut clés-label Title Case (map-by-name) et _meta interne
    const lengths = values.map((v) => v.length);
    const med = median(lengths);
    const isKnown = KNOWN_PROSE_NAMES.has(key);
    if (isKnown || med > PROSE_LENGTH_THRESHOLD) {
      fields.push({ key, count: values.length, medianLength: Math.round(med), sample: values[0]?.slice(0, 80) ?? '' });
    }
  }
  return fields.sort((a, b) => a.key.localeCompare(b.key));
}

/** Fichiers source (.ts/.tsx) sous `dir`, récursif, hors *.test.*. */
function sourceFiles(dir) {
  const out = [];
  const walk = (d) => {
    for (const e of readdirSync(d)) {
      const p = join(d, e);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e) && !estFichierVitest(e)) out.push(p);
    }
  };
  walk(dir);
  return out;
}

/** Compte les fichiers de `files` référençant `.key` (accès propriété) ou `key:` (destructure/props JSX). */
function countConsumers(files, key, cache) {
  const rx = new RegExp(`\\.${key}\\b|[{,]\\s*${key}\\s*[,:}]|['"]${key}['"]\\s*:`);
  let n = 0;
  for (const f of files) {
    const contenu = cache.get(f) ?? (cache.set(f, readFileSync(f, 'utf8')), cache.get(f));
    if (rx.test(contenu)) n++;
  }
  return n;
}

/** `src/ui/editor/**` (éditeur de scène/campagne) et `CodexEdit.tsx` (formulaire d'édition GÉNÉRIQUE
 *  par schéma) sont de l'AUTHORING pur — ils affichent systématiquement TOUS les champs, donc
 *  "trouvé" là ne prouve PAS un surfaçage JOUEUR. `CompendiumScreen.tsx`/`registry.ts`/autres fichiers
 *  `src/ui/compendium/*` restent comptés en gameplay : le Compendium est un écran JOUEUR consultable
 *  EN JEU (`docs` : « Compendium en jeu »), pas qu'un outil d'auteur — cf. `activities.json` : déjà
 *  référencé dans `registry.ts` (table Compendium) AVANT #330, le vrai gap #330 était contextuel
 *  (non montré PENDANT le choix d'activité d'interlude), pas une absence totale de tout consommateur. */
const AUTHORING_ONLY_PATHS = ['src/ui/editor/', 'src/ui/editor/codex/CodexEdit.tsx'];

function isEditorOnly(fileRel) {
  return AUTHORING_ONLY_PATHS.some((d) => fileRel.startsWith(d) || fileRel.startsWith(d.split('/').join('\\')));
}

function main() {
  const datasets = listJsonFiles(DATA_DIR).filter((f) => !f.endsWith('.manifest.json'));
  const uiFiles = sourceFiles(join(ROOT, 'src/ui'));
  const stateFiles = sourceFiles(join(ROOT, 'src/state'));
  const gameplayFiles = [...uiFiles, ...stateFiles].filter((f) => !isEditorOnly(f.slice(ROOT.length + 1)));
  const editorFiles = uiFiles.filter((f) => isEditorOnly(f.slice(ROOT.length + 1)));
  const cache = new Map();

  // fréquence globale d'un nom de champ à travers TOUS les datasets — sert à juger l'ambiguïté d'un grep générique.
  const globalFieldDatasets = {};
  const perDataset = [];
  for (const path of datasets) {
    const rel = path.slice(ROOT.length + 1).split('\\').join('/');
    const fields = proseFieldsOf(path);
    perDataset.push({ rel, fields });
    for (const f of fields) (globalFieldDatasets[f.key] ??= new Set()).add(rel);
  }

  const rows = [];
  for (const { rel, fields } of perDataset) {
    for (const f of fields) {
      const nGameplay = countConsumers(gameplayFiles, f.key, cache);
      const nEditor = countConsumers(editorFiles, f.key, cache);
      const sharedBy = globalFieldDatasets[f.key].size;
      let classe;
      if (nGameplay === 0 && nEditor === 0) classe = 'non trouvé';
      else if (nGameplay === 0) classe = 'éditeur SEULEMENT (jamais en jeu)';
      else if (sharedBy >= 3) classe = 'indéterminable (nom générique partagé par ' + sharedBy + ' datasets)';
      else classe = 'consommé (jeu)';
      rows.push({ dataset: rel, field: f.key, count: f.count, medianLength: f.medianLength, consumerFilesJeu: nGameplay, consumerFilesEditeur: nEditor, classe, sample: f.sample });
    }
  }

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }

  const nonTrouve = rows.filter((r) => r.classe === 'non trouvé');
  const editeurSeul = rows.filter((r) => r.classe === 'éditeur SEULEMENT (jamais en jeu)');
  const indetermin = rows.filter((r) => r.classe.startsWith('indéterminable'));
  const consomme = rows.filter((r) => r.classe === 'consommé (jeu)');

  console.log(`Lentille #329-2 — champs de prose : ${rows.length} au total sur ${datasets.length} datasets`);
  console.log(`  consommé (jeu) : ${consomme.length}`);
  console.log(`  indéterminable (nom générique) : ${indetermin.length}`);
  console.log(`  éditeur SEULEMENT (jamais en jeu) : ${editeurSeul.length}`);
  console.log(`  NON TROUVÉ (jamais surfacé, ni jeu ni éditeur) : ${nonTrouve.length}`);
  console.log('');
  console.log('## NON TROUVÉ (candidats surfaçage — priorité haute)');
  for (const r of nonTrouve) {
    console.log(`- ${r.dataset} :: ${r.field} (${r.count} entrée(s), médiane ${r.medianLength} car.) — ex. « ${r.sample}… »`);
  }
  console.log('');
  console.log('## ÉDITEUR SEULEMENT — curé, visible en édition Compendium, jamais rendu en jeu');
  for (const r of editeurSeul) {
    console.log(`- ${r.dataset} :: ${r.field} (${r.count} entrée(s), médiane ${r.medianLength} car.)`);
  }
}

main();
