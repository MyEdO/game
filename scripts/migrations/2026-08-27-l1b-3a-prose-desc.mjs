/**
 * Migration #1467 L1b V-P2 — la prose d'entrée `text` devient `desc`.
 *
 * MOTIF MESURÉ : `text` est une GRAPHIE DIVERGENTE du rôle prose du lexique
 * (`scripts/docs/lib/structures-lexique.mts` : `prose: { cible: 'desc', divergentes: ['text',
 * 'description', …] }`) ; l'enveloppe de document déclare `desc`
 * (`src/data/schemas/grammaire/document.ts`). Le TEXTE ne change pas — seule la clé.
 *
 * PORTEURS, un par un (le périmètre est DÉCLARÉ, jamais un renommage aveugle de toute clé `text`) :
 *   - `travelTableEntry` (schéma PARTAGÉ, `grammaire/mecanique.ts`) : `incidents-monture.json`,
 *     `problemes-vehicule.json`, `rencontres-edoc.json` ;
 *   - `interludeEvents.json`, `peripeties.json` (entrées de racine) ;
 *   - `mass-battle.json › hazards` ; `land-cargo.json › rumours` ;
 *   - dans les 4 projets de scène : les NŒUDS de dialogue (`dialogues[].nodes[]`) et les effets
 *     `journal` / `document` / `setObjective`.
 *
 * RESTENT INTACTS, et c'est mesuré ici plutôt que supposé : le `text` du nœud de Flow
 * `{kind:'do', effect}` (homonyme structurel), la charge utile de l'op `narrative` (lot L1c #1468)
 * et `TrappingRef.text` (clé RÉSERVÉE, `grammaire/reference.ts`). Aucun de ces trois n'est un
 * porteur reconnu ci-dessous : la reconnaissance est POSITIVE (chemin + forme), jamais par exclusion.
 *
 * ENTRÉES : `src/data/{incidents-monture,problemes-vehicule,rencontres-edoc,interludeEvents,
 * peripeties,mass-battle,land-cargo}.json` et les 4 `src/scenes/<campagne>/<campagne>-projet.json`.
 *
 * FORMATAGE PRÉSERVÉ : `src/data` est `JSON.stringify(doc, null, 2)` ; les documents de scène ont
 * leur PROPRE sérialiseur `JSON.stringify(doc, null, 1) + '\n'` (précédent déclaré par
 * `scripts/migrations/2026-08-24-give-trapping-label-vers-id.mjs`). La forme est vérifiée AVANT
 * toute écriture : non canonique = sortie 1, jamais un reflow silencieux.
 *
 * IDEMPOTENT / NO-OP TOLÉRANT À LA FORME : un porteur portant seulement `desc` est reconnu migré ;
 * rejouée sur l'état final, la migration n'écrit rien et sort 0.
 * FAIL-FAST : porteur ayant les DEUX clés, porteur sans ni l'une ni l'autre, `text` non-chaîne, ou
 * chemin déclaré absent du document → rien n'est écrit, sortie 1.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const echecs = [];
const ecritures = [];

/** Renomme `text` → `desc` EN PLACE (position de clé préservée, valeur inchangée). */
const renomme = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k === 'text' ? 'desc' : k, v]));

/** @returns {{o: object, migre: boolean}} un porteur traité, ou une anomalie poussée dans `echecs`. */
function porteur(o, ou) {
  const aText = o?.text !== undefined;
  const aDesc = o?.desc !== undefined;
  if (aText && aDesc) { echecs.push(`${ou} : porte À LA FOIS \`text\` et \`desc\``); return { o, migre: false }; }
  if (aDesc) return { o, migre: false };
  if (!aText) { echecs.push(`${ou} : ni \`text\` ni \`desc\` — prose PERDUE`); return { o, migre: false }; }
  if (typeof o.text !== 'string') { echecs.push(`${ou} : \`text\` de forme inattendue ${JSON.stringify(o.text)}`); return { o, migre: false }; }
  return { o: renomme(o), migre: true };
}

// ── Racine `src/data` : chemins DÉCLARÉS vers un tableau de porteurs ─────────────────────────────
/** `null` en 2ᵉ position = le document EST le tableau de porteurs. */
const DATA_CIBLES = [
  ['src/data/incidents-monture.json', ['entries']],
  ['src/data/problemes-vehicule.json', ['entries']],
  ['src/data/rencontres-edoc.json', ['tables', 'positives']],
  ['src/data/rencontres-edoc.json', ['tables', 'fortuites']],
  ['src/data/rencontres-edoc.json', ['tables', 'dangereuses']],
  ['src/data/interludeEvents.json', []],
  ['src/data/peripeties.json', []],
  ['src/data/mass-battle.json', ['hazards']],
  ['src/data/land-cargo.json', ['rumours']],
];

/** Documents `src/data` chargés une fois (plusieurs chemins peuvent viser le même fichier). */
const docs = new Map();
for (const [rel] of DATA_CIBLES) {
  if (docs.has(rel)) continue;
  const brut = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const doc = JSON.parse(brut);
  if (JSON.stringify(doc, null, 2) !== brut) { echecs.push(`${rel} : FORME NON CANONIQUE (pas \`JSON.stringify(doc, null, 2)\`)`); continue; }
  docs.set(rel, { brut, doc, migres: 0, deja: 0 });
}

for (const [rel, chemin] of DATA_CIBLES) {
  const etat = docs.get(rel);
  if (!etat) continue;
  let parent = etat.doc;
  for (const k of chemin.slice(0, -1)) parent = parent?.[k];
  const cle = chemin.length ? chemin[chemin.length - 1] : null;
  const tableau = cle === null ? etat.doc : parent?.[cle];
  if (!Array.isArray(tableau)) { echecs.push(`${rel} : chemin \`${chemin.join('.') || '(racine)'}\` absent ou non-tableau`); continue; }

  const migre = tableau.map((e, i) => {
    const r = porteur(e, `${rel} › ${chemin.join('.') || '(racine)'}[${i}]`);
    if (r.migre) etat.migres++; else if (e?.desc !== undefined) etat.deja++;
    return r.o;
  });
  if (cle === null) etat.doc = migre; else parent[cle] = migre;
}

for (const [rel, etat] of docs) {
  const out = JSON.stringify(etat.doc, null, 2);
  ecritures.push({ rel, abs: path.join(ROOT, rel), brut: etat.brut, out, migres: etat.migres, deja: etat.deja });
}

// ── Racine `src/scenes` : reconnaissance POSITIVE des porteurs pendant la descente ───────────────
const TYPES_EFFET = new Set(['journal', 'document', 'setObjective']);
const canoniqueScene = (doc) => `${JSON.stringify(doc, null, 1)}\n`;

/** Un objet EST-il un porteur de prose de ce lot ? `dansNodes` = on descend `dialogues[].nodes`. */
const estPorteur = (o, dansNodes) =>
  (dansNodes && Array.isArray(o.choices)) || (typeof o.type === 'string' && TYPES_EFFET.has(o.type));

const RACINE_SCENES = path.join(ROOT, 'src/scenes');
for (const d of fs.readdirSync(RACINE_SCENES, { withFileTypes: true })) {
  if (!d.isDirectory()) continue;
  const abs = path.join(RACINE_SCENES, d.name, `${d.name}-projet.json`);
  if (!fs.existsSync(abs)) continue;
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  const brut = fs.readFileSync(abs, 'utf8');
  const doc = JSON.parse(brut);
  if (canoniqueScene(doc) !== brut) { echecs.push(`${rel} : FORME NON CANONIQUE (pas \`JSON.stringify(doc, null, 1) + '\\n'\`)`); continue; }

  let migres = 0;
  let deja = 0;
  const parRole = {};
  const descendre = (v, chemin, dansNodes) => {
    if (Array.isArray(v)) return v.map((x, i) => descendre(x, `${chemin}[${i}]`, dansNodes));
    if (!v || typeof v !== 'object') return v;
    const sous = Object.fromEntries(
      Object.entries(v).map(([k, x]) => [k, descendre(x, `${chemin}.${k}`, k === 'nodes' ? true : k === 'choices' ? false : dansNodes)]),
    );
    if (!estPorteur(sous, dansNodes)) return sous;
    const role = Array.isArray(sous.choices) ? 'dialogueNode' : `effet:${sous.type}`;
    const r = porteur(sous, `${rel} › ${chemin} (${role})`);
    if (r.migre) { migres++; parRole[role] = (parRole[role] ?? 0) + 1; } else if (sous.desc !== undefined) deja++;
    return r.o;
  };

  const sortie = descendre(doc, '', false);
  ecritures.push({ rel, abs, brut, out: canoniqueScene(sortie), migres, deja, parRole });
}

if (echecs.length) {
  console.error(`ARBITRAGE REQUIS — ${echecs.length} anomalie(s), AUCUNE écriture :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

let total = 0;
for (const e of ecritures) {
  if (e.out !== e.brut) fs.writeFileSync(e.abs, e.out, 'utf8');
  total += e.migres;
  console.log(`${e.rel} — \`text\` → \`desc\` : ${e.migres} (déjà migrés : ${e.deja})${e.parRole ? ` ${JSON.stringify(e.parRole)}` : ''} — fichier ${e.out !== e.brut ? 'réécrit' : 'INCHANGÉ'}`);
}
console.log(`TOTAL : ${total} porteur(s) migré(s) sur ${ecritures.length} document(s).`);
