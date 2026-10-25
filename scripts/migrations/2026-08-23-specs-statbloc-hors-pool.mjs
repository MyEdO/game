/**
 * Migration #1342 L3 — `pool: false` sur les Spécialisations de `skills.json` qu'AUCUNE liste de
 * Spécialisations n'énumère et qu'AUCUNE ligne joueur (carrière, espèce, signe astral) ne demande :
 * elles n'entrent au catalogue que par un statbloc de créature (L2-a/L2-b). Elles restent VALIDES
 * (résolution, `testValue`, bonus de règle, Codex/éditeur) ; elles ne sont plus PROPOSÉES d'office
 * par le créateur/l'avancement (`LDB 09 l.40` ; `src/data/index.ts#specPoolOf`).
 *
 * REJOUABLE et FAIL-FAST : la TABLE ci-dessous est explicite, mais chacun de ses QUATRE critères est
 * RE-MESURÉ à chaque exécution sur la donnée du dépôt — entrée introuvable, entrée sans `source`,
 * entrée énumérée par le LDB 09, entrée citée par `careerLevels.json`/`species.json`/`stars.json`,
 * ou entrée qu'AUCUN statbloc de `creatures.json` n'emploie (une entrée sans usage n'est pas
 * « statbloc-only », c'est autre chose : arrêt) : arrêt en 1 sans rien écrire. Un second passage
 * ne réécrit rien (byte-identique).
 *
 * Entrées : `src/data/skills.json` (écrit), `src/data/careerLevels.json`, `src/data/species.json`,
 * `src/data/stars.json`, `src/data/creatures.json` (les quatre critères re-mesurés) et le RAW
 * `Source/Warhammer v4 - Livre de base version corrigee/09 - Competences.md` (liste imprimée).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const DATA_DIR = path.join(ROOT, 'src/data');
const J = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

/** Reflet de `src/data/serialize.ts#serializeDataset` (pas d'import TS depuis ce script .mjs). */
const serializeDataset = (value) => JSON.stringify(value, null, 2);

/** `skillId|specId` — mesure du 2026-08-23 : sourcées (L2), hors liste « Spécialisations : » du
 *  LDB 09, employées UNIQUEMENT par des statblocs de `creatures.json`. */
const TABLE = [
  'dressage|perroquet',
  'metier|frappeur-de-monnaie',
  'savoir|local',
  'savoir|tzeentch',
  'savoir|peaux-de-loup',
  'savoir|montagnes-du-bord-du-monde',
  'savoir|navigation',
  'savoir|elfes',
  'savoir|religion',
];

const skills = J('src/data/skills.json');
const LDB09 = path.join(ROOT, 'Source/Warhammer v4 - Livre de base version corrigee/09 - Competences.md');
const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

// ── Critère 1 : les listes « Spécialisations : » / « Exemples de Spécialisations : » du LDB 09,
//    ancrées au titre de Compétence qui les précède.
const md = fs.readFileSync(LDB09, 'utf8').split(/\r?\n/);
const listes = new Map();
let titre = null;
for (const line of md) {
  const t = line.replace(/<[^>]*>/g, '');
  const mT = t.match(/\*\*([A-Za-zÀ-ÿ' ’-]+?)\s*\((?:CC|CT|F|E|I|Ag|Dex|Int|FM|Soc)\)\*\*\s*\*(?:de base|avanc[ée]e)/i);
  if (mT) titre = mT[1].trim();
  const mS = t.match(/^\*\*(?:Exemples de )?Sp[ée]cialisations\s*:\*\*\s*(.+)$/);
  if (mS && titre) {
    const brut = mS[1].replace(/\(chacune.*$/i, '').replace(/\*/g, '').trim().replace(/\.$/, '');
    listes.set(norm(titre), new Set(brut.split(/,\s*/).map((s) => norm(s.trim())).filter(Boolean)));
  }
}
if (listes.size < 10) {
  console.error(`ARRÊT — ${listes.size} liste(s) de Spécialisations extraites du LDB 09 : extraction illisible.`);
  process.exit(1);
}

// ── Critères 3 et 4 : où la spec est-elle EMPLOYÉE ? Ligne JOUEUR (carrière / espèce / signe
//    astral) → elle doit rester au pool ; statbloc de créature → seule provenance admise ici.
const collecte = (data) => {
  const vus = new Set();
  const walk = (node) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== 'object') return;
    const id = node.skillId ?? node.talentId ?? node.skill ?? node.id;
    if (typeof id === 'string' && typeof node.spec === 'string') vus.add(`${id}|${node.spec}`);
    for (const v of Object.values(node)) walk(v);
  };
  walk(data);
  return vus;
};
const joueur = new Set();
for (const rel of ['src/data/careerLevels.json', 'src/data/species.json', 'src/data/stars.json']) {
  for (const k of collecte(J(rel))) joueur.add(k);
}
const statblocs = collecte(J('src/data/creatures.json'));

const erreurs = [];
const cibles = [];
for (const key of TABLE) {
  const [skillId, specId] = key.split('|');
  const skill = skills.find((s) => s.id === skillId);
  const entry = skill?.specs?.find((e) => e.id === specId);
  if (!entry) { erreurs.push(`${key} : entrée absente de skills.json`); continue; }
  if (!entry.source) { erreurs.push(`${key} : hors pool sans « source » (une entrée hors pool est attestée ailleurs)`); continue; }
  if (listes.get(norm(skill.label))?.has(norm(entry.label))) { erreurs.push(`${key} : libellé « ${entry.label} » ÉNUMÉRÉ par le LDB 09`); continue; }
  if (joueur.has(key)) { erreurs.push(`${key} : cité par une ligne carrière/espèce/signe (le pool DOIT le proposer)`); continue; }
  if (!statblocs.has(key)) { erreurs.push(`${key} : employée par AUCUN statbloc de creatures.json (hors « statbloc-only »)`); continue; }
  cibles.push({ entry, key });
}
if (erreurs.length) {
  console.error(`ARRÊT — ${erreurs.length} entrée(s) de la table réfutées par la donnée :`);
  for (const e of erreurs) console.error(`  ${e}`);
  process.exit(1);
}

let poses = 0;
for (const { entry } of cibles) if (entry.pool !== false) { entry.pool = false; poses++; }

const full = path.join(DATA_DIR, 'skills.json');
const avant = fs.readFileSync(full, 'utf8');
const apres = serializeDataset(skills);
if (apres !== avant) fs.writeFileSync(full, apres, 'utf8');

console.log(`Entrées de la table : ${TABLE.length} — « pool: false » posé sur ${poses}, déjà posé sur ${TABLE.length - poses}.`);
console.log(`skills.json ${apres === avant ? 'inchangé (rejeu)' : 'réécrit'}.`);
