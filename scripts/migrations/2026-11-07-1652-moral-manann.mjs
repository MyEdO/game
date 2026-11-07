/**
 * Migration #1652 lot 1 — Moral et Manann : sept rangées de `sea-events.json` passent de leur genre
 * (`kind` + `params`) à leur `consequence` en grammaire (`Flow`, joué par `runFlow`), et l'Effet de scène
 * `adjustManann` devient l'op `manann` sur la cible `navire`.
 *
 *   genre (rangée)                     consequence (dérivée des `params` de la rangée)
 *   `usure`         (usure)            ops navire `wounds` (`params.wounds`), sans BE ni PA       MDG 15 l.200
 *   `coup-critique` (bateau-endommage) ops navire `shipCritical` (`crits`, `critLocation`)       MDG 15 l.152-153
 *   `presage`       sans prière        ops navire `manann` / `shipMorale`                        MDG 15 l.179-180
 *   `presage`       avec prière        `if` Talent Béni (Manann) → `test` Prière à la difficulté
 *                                      de la rangée ; funeste : l'effet tombe sauf succès (et sans
 *                                      prêtre) ; favorable : seul le succès l'applique           MDG 15 l.197-198, l.230-232
 *   `bonne-humeur`                     ops navire `shipMorale`                                   MDG 15 l.220
 *   `fete-manann`                      `relache: true` + ops navire `manann`                     MDG 15 l.260
 *   `embrigadement` (genre gardé)      `relache: true` (la rangée ne se joue qu'avec la relâche)  MDG 15 l.245
 *   Effet `adjustManann {factorId}`    `{type:'ops', on:'navire', ops:[{op:'manann', factorId}]}`
 *
 * L'enjeu du Test de Prière (`stakes.json` « sea-priere-manann ») renvoie à la RANGÉE jouée : sa clé porte
 * `entryId` (l'id de la rangée) et `entryCategory: 'seaBoardEvents'` (porte dynamique bornée, `data/index.ts`).
 *
 * Le Prêtre de Manann (`pretre-manann`, MDG 15 l.246) n'est pas une entrée de cette migration.
 *
 * Entrées : src/data/sea-events.json, src/scenes/loup-et-saumure/loup-et-saumure-projet.json.
 *
 * FORME ASSERTÉE SUR LE RÉSULTAT : aucune rangée ne porte plus un genre migré, aucune ne porte à la fois
 * `consequence` et `kind`/`params`, aucun Effet `adjustManann` ne reste. Des `params` hors de la forme
 * attendue, un `adjustManann` sans `factorId` ou un document non canonique sont un ARRÊT nominatif
 * (exit 1), AUCUNE écriture. Rejouée sur l'arbre migré : no-op byte-identique.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SEA = join(ROOT, 'src/data/sea-events.json');
const PROJET = join(ROOT, 'src/scenes/loup-et-saumure/loup-et-saumure-projet.json');
const PRETRE_DE_MANANN = { kind: 'talent', id: 'beni', spec: 'manann' };
const GENRES_MIGRES = new Set(['usure', 'coup-critique', 'presage', 'bonne-humeur', 'fete-manann']);

const arrets = [];

const estDe = (d) => d && Number.isInteger(d.n) && d.n > 0 && Number.isInteger(d.sides) && d.plus === undefined;
const estEffetSigne = (e) => e && (e.sign === 1 || e.sign === -1) && estDe(e.dice);
const surLeNavire = (ops) => ({ kind: 'do', effect: { type: 'ops', on: 'navire', ops } });

/** L'effet d'un présage : Humeur de Manann puis Moral, ceux que la rangée chiffre. */
function effetDuPresage(p, ou) {
  const ops = [];
  if (p.manann !== undefined) {
    if (!estEffetSigne(p.manann)) arrets.push(`${ou} : params.manann hors de la forme {sign, dice}`);
    ops.push({ op: 'manann', delta: p.manann });
  }
  if (p.moral !== undefined) {
    if (!estEffetSigne(p.moral)) arrets.push(`${ou} : params.moral hors de la forme {sign, dice}`);
    ops.push({ op: 'shipMorale', delta: p.moral });
  }
  if (!ops.length) arrets.push(`${ou} : présage sans manann ni moral`);
  return surLeNavire(ops);
}

function consequenceDe(e, ou) {
  const p = e.params ?? {};
  const cles = (attendues) => {
    const hors = Object.keys(p).filter((k) => !attendues.includes(k));
    if (hors.length) arrets.push(`${ou} : params inattendus ${hors.join(', ')}`);
  };
  switch (e.kind) {
    case 'usure':
      cles(['wounds']);
      if (!estDe(p.wounds?.dice)) arrets.push(`${ou} : params.wounds hors de la forme {dice}`);
      return surLeNavire([{ op: 'wounds', amount: p.wounds, ignoreTB: true, ignoreAP: true }]);
    case 'coup-critique':
      cles(['crits', 'critLocation']);
      if (!Number.isInteger(p.crits) || p.crits < 1) arrets.push(`${ou} : params.crits « ${p.crits} » ni entier ni positif`);
      if (typeof p.critLocation !== 'string') arrets.push(`${ou} : params.critLocation absent`);
      return surLeNavire([{ op: 'shipCritical', location: p.critLocation, count: p.crits }]);
    case 'presage': {
      cles(['prayerDifficulty', 'manann', 'moral']);
      const effet = effetDuPresage(p, ou);
      if (p.prayerDifficulty === undefined) return effet;
      const favorable = (p.manann ?? p.moral)?.sign !== -1;
      const rien = { kind: 'seq', steps: [] };
      const test = {
        kind: 'test',
        test: { skill: { id: 'priere' }, difficulty: p.prayerDifficulty, stake: { key: { dataset: 'voyage', kind: 'sea-priere', entryId: e.id, entryCategory: 'seaBoardEvents' } } },
        success: favorable ? effet : rien,
        fail: favorable ? rien : effet,
      };
      return { kind: 'if', cond: PRETRE_DE_MANANN, then: test, ...(favorable ? {} : { else: effet }) };
    }
    case 'bonne-humeur':
      cles(['moral']);
      if (!estEffetSigne(p.moral)) arrets.push(`${ou} : params.moral hors de la forme {sign, dice}`);
      return surLeNavire([{ op: 'shipMorale', delta: p.moral }]);
    case 'fete-manann':
      cles(['manann']);
      if (!estEffetSigne(p.manann)) arrets.push(`${ou} : params.manann hors de la forme {sign, dice}`);
      return surLeNavire([{ op: 'manann', delta: p.manann }]);
  }
  throw new Error(`genre « ${e.kind} » hors de GENRES_MIGRES`);
}

/** Les rangées qui ne se jouent qu'avec la relâche à terre accordée, par genre d'origine. */
const GENRES_A_RELACHE = new Set(['fete-manann', 'embrigadement']);

/** Pose `relache` (si le genre le demande) juste avant le genre, remplace `kind` par `consequence` au même
 *  rang quand la rangée migre, et retire alors `params`. */
function reecrire(e, consequence) {
  const relache = GENRES_A_RELACHE.has(e.kind);
  const copie = Object.entries(e);
  for (const k of Object.keys(e)) delete e[k];
  for (const [k, v] of copie) {
    if (k === 'kind' && relache) e.relache = true;
    if (k === 'params' && consequence) continue;
    if (k === 'kind' && consequence) e.consequence = consequence;
    else e[k] = v;
  }
}

// ── sea-events.json ──────────────────────────────────────────────────────────────────────────────
const brutSea = readFileSync(SEA, 'utf8');
const sea = JSON.parse(brutSea);
let gestes = 0;
if (brutSea !== serializeDataset(sea)) arrets.push('sea-events.json : forme non canonique');
else {
  for (const table of ['boardEvents', 'portEvents']) {
    for (const e of sea[table]?.entries ?? []) {
      if (e.relache !== undefined || !(GENRES_MIGRES.has(e.kind) || GENRES_A_RELACHE.has(e.kind))) continue;
      reecrire(e, GENRES_MIGRES.has(e.kind) ? consequenceDe(e, `sea-events.json ${table} « ${e.id} »`) : undefined);
      gestes++;
    }
  }
  for (const table of ['boardEvents', 'portEvents']) {
    for (const e of sea[table]?.entries ?? []) {
      const ou = `sea-events.json ${table} « ${e.id} »`;
      if (GENRES_MIGRES.has(e.kind)) arrets.push(`${ou} : genre « ${e.kind} » non migré`);
      if (e.consequence !== undefined && (e.kind !== undefined || e.params !== undefined)) arrets.push(`${ou} : consequence et kind/params coexistent`);
      if (GENRES_A_RELACHE.has(e.kind) && e.relache !== true) arrets.push(`${ou} : relache absente`);
    }
  }
  const aRelache = ['boardEvents', 'portEvents'].flatMap((t) => sea[t]?.entries ?? []).filter((e) => e.relache === true).map((e) => e.id).sort();
  if (aRelache.join() !== 'embrigadement,fete-de-manann') arrets.push(`sea-events.json : rangées à relâche « ${aRelache.join(', ')} » ≠ embrigadement, fete-de-manann`);
}

// ── projet Loup et Saumure ───────────────────────────────────────────────────────────────────────
const brutProjet = readFileSync(PROJET, 'utf8');
const projet = JSON.parse(brutProjet);
const serialiserProjet = (doc) => `${JSON.stringify(doc, null, 1)}\n`;
if (brutProjet !== serialiserProjet(projet)) arrets.push('loup-et-saumure-projet.json : forme non canonique');
else {
  const migrer = (noeud, chemin) => {
    if (Array.isArray(noeud)) { noeud.forEach((v, i) => migrer(v, `${chemin}[${i}]`)); return; }
    if (!noeud || typeof noeud !== 'object') return;
    if (noeud.type === 'adjustManann') {
      const cles = Object.keys(noeud).filter((k) => k !== 'type');
      if (typeof noeud.factorId !== 'string' || cles.length !== 1) {
        arrets.push(`loup-et-saumure-projet.json ${chemin} : adjustManann hors de la forme {factorId}`);
        return;
      }
      const factorId = noeud.factorId;
      delete noeud.factorId;
      Object.assign(noeud, { type: 'ops', on: 'navire', ops: [{ op: 'manann', factorId }] });
      gestes++;
      return;
    }
    for (const [k, v] of Object.entries(noeud)) migrer(v, `${chemin}.${k}`);
  };
  migrer(projet, '');
  if (serialiserProjet(projet).includes('"adjustManann"')) arrets.push('loup-et-saumure-projet.json : adjustManann restant');
}

if (arrets.length) {
  console.error(`ARRÊT — ${arrets.length} anomalie(s), AUCUNE écriture :`);
  for (const a of arrets) console.error(`  ${a}`);
  process.exit(1);
}
const outSea = serializeDataset(sea);
const outProjet = serialiserProjet(projet);
if (outSea !== brutSea) writeFileSync(SEA, outSea, 'utf8');
if (outProjet !== brutProjet) writeFileSync(PROJET, outProjet, 'utf8');
console.log(`migration 1652 (Moral et Manann) : ${gestes} geste(s)${outSea !== brutSea ? ', sea-events.json réécrit' : ''}${outProjet !== brutProjet ? ', loup-et-saumure-projet.json réécrit' : ''}.`);
