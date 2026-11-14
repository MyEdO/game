/**
 * Migration #1681 (#1463) — les quatre datasets d'ENJEUX de cascade FUSIONNENT en une collection
 * `src/data/stakes.json` à discriminant `cascade`.
 *
 *   `night-stakes.json`   → `cascade: 'nuit'`,  `cle` = `kind`, `stake` → `template`, `form` absente → `'verbatim'`
 *   `voyage-stakes.json`  → `cascade: 'voyage'`, `cle` = `kind`, `form: 'descripteur'` posée
 *   `flow-stakes.json`    → `cascade: 'flux'`,   `cle` = `id`
 *   `combat-stakes.json`  → `cascade: 'combat'`, `cle` = `kind`
 *
 * Les valeurs de `cascade` sont celles de `StakeKey.dataset` (`src/data/index.ts`), que portent déjà les
 * sauvegardes et les fixtures : la clé persistée ne change pas.
 * `form` devient la seule graphie de la nature du texte. La nuit la laissait absente pour `verbatim`
 * (défaut déclaré par `defs/night-stakes.ts`) ; le voyage la portait au niveau du document (gabarits de
 * descripteur à trous, `defs/voyage-stakes.ts`). Elle s'écrit sur chaque entrée qui porte un `template`.
 * Collision d'id : `exposure` est l'id d'une entrée de nuit ET de voyage ; celle du voyage devient
 * `voyage-exposure` (aucune référence à cet id hors de son fichier).
 * ORDRE DES CLÉS ÉCRIT : `id, type, label, cascade, cle`, puis le reste de l'entrée dans son ordre,
 * `form` posée juste après `template` ; jugé sur l'écriture, pas au rejeu.
 *
 * Entrées : `src/data/night-stakes.json`, `src/data/voyage-stakes.json`, `src/data/flow-stakes.json`,
 * `src/data/combat-stakes.json` (lus puis SUPPRIMÉS) et `src/data/stakes.json` (écrit).
 *
 * MARQUEUR D'IDEMPOTENCE : l'existence des fichiers. Quatre sources et pas de cible = migration ; aucune
 * source et la cible = rejeu, aucune écriture, sortie 0, la FORME du résultat revérifiée. Tout état
 * MIXTE est une anomalie nommée, sortie 1.
 * FORME ASSERTÉE SUR LE RÉSULTAT, jamais un cardinal (#1812) : `id`/`label`/`cle` de chaîne, `type`
 * du document, `cascade` connue, ni `kind` ni `stake`, `form` présente si et seulement si `template`
 * l'est, ids uniques. Une source vide ou privée d'une entrée passe : la fusion vaut pour ce qui est là.
 * FAIL-FAST : état mixte, racine non-tableau, entrée sans `id`/`label`, entrée portant déjà `cascade`
 * ou `cle`, clé de consommation absente, `form` posée sans `template`, id répété après renommage,
 * formatage non canonique → rien n'est écrit, rien n'est supprimé.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';
import { estObjet } from '../../src/lib/objet.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const NOM = '2026-11-05-1681-enjeux-en-une-collection';
const TYPE = 'stakes';
const CIBLE = 'src/data/stakes.json';

/** Source → cascade, lecture de la clé de consommation, forme posée quand l'entrée n'en dit rien. */
const SOURCES = [
  { rel: 'src/data/night-stakes.json', cascade: 'nuit', cle: (e) => e.kind, formParDefaut: 'verbatim' },
  { rel: 'src/data/voyage-stakes.json', cascade: 'voyage', cle: (e) => e.kind, formParDefaut: 'descripteur' },
  { rel: 'src/data/flow-stakes.json', cascade: 'flux', cle: (e) => e.id, formParDefaut: undefined },
  { rel: 'src/data/combat-stakes.json', cascade: 'combat', cle: (e) => e.kind, formParDefaut: undefined },
];
const CASCADES = new Set(SOURCES.map((s) => s.cascade));
/** Ids renommés à la fusion, par cascade : l'id d'origine collisionne avec une autre cascade. */
const RENOMMAGES = { voyage: { exposure: 'voyage-exposure' } };
const TETE = ['id', 'type', 'label', 'cascade', 'cle'];

const abs = (rel) => path.join(ROOT, rel);
const existe = (rel) => fs.existsSync(abs(rel));
const arrets = [];

/** Lit un JSON de `src/data` en exigeant sa forme canonique. */
function lire(rel) {
  const brut = fs.readFileSync(abs(rel), 'utf8');
  const doc = JSON.parse(brut);
  if (brut !== serializeDataset(doc)) arrets.push(`${rel} : formatage non canonique`);
  return doc;
}

/** Les écarts de FORME d'un document fusionné, entrée par entrée. L'ORDRE des clés et la `cle` ne sont
 *  jugés que sur ce que cette migration ÉCRIT (`ordre`) : au rejeu, ils ne sont pas des gestes qu'elle
 *  possède (#2968 L19). */
function ecartsDeForme(doc, quoi, { ordre = false } = {}) {
  if (!Array.isArray(doc)) return [`${quoi} : racine non-TABLEAU`];
  const ecarts = [];
  const vus = new Set();
  for (const [i, e] of doc.entries()) {
    const ou = `${quoi} [${i}] ${e?.id ?? '?'}`;
    if (!estObjet(e)) { ecarts.push(`${ou} : entrée non-objet`); continue; }
    if (ordre && Object.keys(e).slice(0, TETE.length).join(',') !== TETE.join(',')) ecarts.push(`${ou} : tête ${Object.keys(e).slice(0, TETE.length).join(',')} ≠ ${TETE.join(',')}`);
    if (typeof e.id !== 'string' || !e.id) ecarts.push(`${ou} : sans \`id\` de chaîne`);
    if (e.type !== TYPE) ecarts.push(`${ou} : \`type\` ${JSON.stringify(e.type)} ≠ ${JSON.stringify(TYPE)}`);
    if (typeof e.label !== 'string' || !e.label) ecarts.push(`${ou} : sans \`label\` de chaîne`);
    if (!CASCADES.has(e.cascade)) ecarts.push(`${ou} : \`cascade\` ${JSON.stringify(e.cascade)} inconnue`);
    if (ordre && (typeof e.cle !== 'string' || !e.cle)) ecarts.push(`${ou} : sans \`cle\` de chaîne`);
    for (const k of ['kind', 'stake']) if (k in e) ecarts.push(`${ou} : porte encore \`${k}\``);
    if (('template' in e) !== ('form' in e)) ecarts.push(`${ou} : \`form\` et \`template\` vont ensemble`);
    if (vus.has(e.id)) ecarts.push(`${ou} : id répété`);
    vus.add(e.id);
  }
  return ecarts;
}

/** L'entrée fusionnée d'une entrée source. */
function fusionner(e, s) {
  const out = {
    id: RENOMMAGES[s.cascade]?.[e.id] ?? e.id,
    type: TYPE,
    label: e.label,
    cascade: s.cascade,
    cle: s.cle(e),
  };
  for (const [k, v] of Object.entries(e)) {
    if (TETE.includes(k) || k === 'kind') continue;
    const cle = k === 'stake' ? 'template' : k;
    out[cle] = v;
    if (cle === 'template' && !('form' in e) && s.formParDefaut) out.form = s.formParDefaut;
  }
  return out;
}

// ── PORTE D'ÉTAT — avant, après, ou mixte ? Lecture seule. ──────────────────────────────────────
const presentes = SOURCES.filter((s) => existe(s.rel));
if (presentes.length === 0 && existe(CIBLE)) {
  const doc = lire(CIBLE);
  const ecarts = [...arrets, ...ecartsDeForme(doc, CIBLE)];
  if (ecarts.length) {
    console.error(`[${NOM}] ARRÊT — ${CIBLE} n'a pas la forme que cette migration rend, AUCUNE écriture :`);
    for (const m of ecarts) console.error(`  ${m}`);
    process.exit(1);
  }
  console.log(`[${NOM}] déjà migrée — ${CIBLE} a sa forme, rien à écrire`);
  process.exit(0);
}
if (presentes.length !== SOURCES.length || existe(CIBLE)) {
  console.error(`[${NOM}] ARRÊT — état MIXTE : source(s) présente(s) ${presentes.map((s) => s.rel).join(', ') || '(aucune)'} ; ${CIBLE} ${existe(CIBLE) ? 'présent' : 'absent'}. La fusion est tout ou rien.`);
  process.exit(1);
}

// ── LECTURE ET PORTES, avant toute écriture ─────────────────────────────────────────────────────
const fusion = [];
for (const s of SOURCES) {
  const doc = lire(s.rel);
  if (!Array.isArray(doc)) { arrets.push(`${s.rel} : racine non-TABLEAU`); continue; }
  for (const [i, e] of doc.entries()) {
    const ou = `${s.rel} [${i}] ${e?.id ?? '?'}`;
    if (!estObjet(e)) { arrets.push(`${ou} : entrée non-objet`); continue; }
    if (typeof e.id !== 'string' || !e.id) arrets.push(`${ou} : sans \`id\` de chaîne`);
    if (typeof e.label !== 'string' || !e.label) arrets.push(`${ou} : sans \`label\` de chaîne`);
    for (const k of ['cascade', 'cle']) if (k in e) arrets.push(`${ou} : porte déjà \`${k}\` — c'est ce que cette migration POSE`);
    if (typeof s.cle(e) !== 'string' || !s.cle(e)) arrets.push(`${ou} : sans clé de consommation`);
    if ('form' in e && !('template' in e) && !('stake' in e)) arrets.push(`${ou} : \`form\` sans texte`);
    fusion.push(fusionner(e, s));
  }
}
arrets.push(...ecartsDeForme(fusion, 'fusion', { ordre: true }));
if (arrets.length) {
  console.error(`[${NOM}] ARRÊT — ${arrets.length} anomalie(s), AUCUNE écriture :`);
  for (const m of arrets) console.error(`  ${m}`);
  process.exit(1);
}

// ── ÉCRITURE, puis preuve sur le document relu ──────────────────────────────────────────────────
fs.writeFileSync(abs(CIBLE), serializeDataset(fusion), 'utf8');
for (const s of SOURCES) fs.rmSync(abs(s.rel));
const relu = JSON.parse(fs.readFileSync(abs(CIBLE), 'utf8'));
const post = ecartsDeForme(relu, `POST ${CIBLE}`, { ordre: true });
if (serializeDataset(relu) !== serializeDataset(fusion)) post.push(`POST ${CIBLE} : le document relu diffère de la fusion`);
if (post.length) {
  console.error(`[${NOM}] ÉCHEC POST-ÉCRITURE : ${post.join(' ; ')}`);
  process.exit(1);
}
console.log(`[${NOM}] migré — ${relu.length} enjeu(x) dans ${CIBLE}, ${SOURCES.length} document(s) source supprimé(s)`);
