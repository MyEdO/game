/**
 * Migration #1652 lot 8 — combat en mer à issue : trois rangées de bord de `sea-events.json` passent de leur
 * genre (`kind` + `params`) à leur `consequence` en grammaire (`Flow`, joué par `runFlow`), et l'objectif de
 * victoire `woundsThreshold` des projets de campagne nomme son seuil `atOrBelowPercent` (à ce pourcentage
 * des Blessures de départ OU MOINS, MDG 15 l.143, l.166-168).
 *
 *   rangée                     consequence (dérivée des `params` de la rangée)
 *   `triton`                   op navire `combatEnMer` contre `triton` ; victoire : `rollTable` du dé
 *                              `victoryRoll`, `impressed` → Humeur `impressedManann`, `wrathful` →
 *                              `wrathfulManann`                                      MDG 15 l.136-139
 *   `puissant-monstre-marin`   `rollTable` du dé `roll` → `combatEnMer`, repoussé à 50 % ; les créatures se
 *   `monstre-marin`            lisent dans `params.creatures` (« 1-3 : hydre d'os »…), nombre et Trait Nuée
 *                              compris                                 MDG 15 l.142-143, l.165-168
 *
 * Entrées : src/data/sea-events.json et chaque `src/scenes/<c>/<c>-projet.json`. Une rangée nommée absente
 * n'est pas une anomalie : la migration rejouée après sa suppression sort 0 sans écrire.
 *
 * FORME ASSERTÉE SUR LE RÉSULTAT : aucune rangée ne porte plus un genre migré, aucune ne porte à la fois
 * `consequence` et `kind`/`params`, aucun objectif `woundsThreshold` ne porte plus `belowPercent`. Des
 * `params` hors de la forme attendue, une créature inconnue ou un document non canonique sont un ARRÊT
 * nominatif (exit 1), AUCUNE écriture. Rejouée sur l'arbre migré : no-op byte-identique.
 */
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SEA = join(ROOT, 'src/data/sea-events.json');
const GENRES_MIGRES = new Set(['triton', 'monstre-puissant']);
/** MDG 15 l.143 « à la moitié de ses Blessures de départ » ; l.166-168 */
const REPOUSSE_A_PCT = 50;

/** Le libellé de créature du livre → son entrée de `creatures.json`. MDG 15 l.142-143, l.165-166 */
const CREATURES_DU_LIVRE = new Map([
  ["hydre d'os", { id: 'hydre-d-os', nombre: 1 }],
  ['sangsue des abysses', { id: 'sangsue-des-abysses', nombre: 1 }],
  ['gargantuan', { id: 'gargantuan', nombre: 1 }],
  ['léviathan noir', { id: 'leviathan-noir', nombre: 1 }],
  ['kharibde', { id: 'kharibde', nombre: 1 }],
  // MDG 16 l.67 : Nuée, Trait facultatif de l'anguille mâcheprise.
  ["nuée d'anguilles mâcheprises", { id: 'anguille-macheprise', nombre: 1, optionals: [{ id: 'nuee' }] }],
  ['3 syrènes bleues', { id: 'syrene-bleue', nombre: 3 }],
  ['wyrm des mers', { id: 'wyrm-des-mers', nombre: 1 }],
]);

const arrets = [];

const estD10 = (q) => q && Object.keys(q).length === 1 && q.dice?.n === 1 && q.dice?.sides === 10 && q.dice?.plus === undefined;
const estEffetSigne = (e) => e && (e.sign === 1 || e.sign === -1) && Number.isInteger(e.dice?.n) && Number.isInteger(e.dice?.sides) && e.dice?.plus === undefined;
const estBande = (b) => b && Number.isInteger(b.min) && Number.isInteger(b.max) && b.min <= b.max;
const surLeNavire = (ops) => ({ kind: 'do', effect: { type: 'ops', on: 'navire', ops } });

function consequenceDe(e, ou) {
  const p = e.params ?? {};
  const cles = (attendues) => {
    const hors = Object.keys(p).filter((k) => !attendues.includes(k));
    if (hors.length) arrets.push(`${ou} : params inattendus ${hors.join(', ')}`);
  };
  switch (e.kind) {
    case 'triton': {
      cles(['victoryRoll', 'impressed', 'wrathful', 'impressedManann', 'wrathfulManann']);
      if (!estD10(p.victoryRoll)) arrets.push(`${ou} : params.victoryRoll ≠ 1d10`);
      for (const k of ['impressed', 'wrathful']) if (!estBande(p[k])) arrets.push(`${ou} : params.${k} hors de la forme {min,max}`);
      for (const k of ['impressedManann', 'wrathfulManann']) if (!estEffetSigne(p[k])) arrets.push(`${ou} : params.${k} hors de la forme {sign,dice}`);
      const issue = (bande, delta) => ({ min: bande?.min, max: bande?.max, ops: [{ op: 'manann', delta }] });
      return surLeNavire([{
        op: 'combatEnMer', adversaire: { id: 'triton', nombre: 1 },
        victoire: surLeNavire([{ op: 'rollTable', die: '1d10', entries: [issue(p.impressed, p.impressedManann), issue(p.wrathful, p.wrathfulManann)] }]),
      }]);
    }
    case 'monstre-puissant': {
      cles(['roll', 'creatures']);
      if (!estD10(p.roll)) arrets.push(`${ou} : params.roll ≠ 1d10`);
      const entries = (Array.isArray(p.creatures) ? p.creatures : []).map((ligne) => {
        const m = /^(\d+)(?:-(\d+))? : (.+)$/.exec(ligne);
        const creature = m && CREATURES_DU_LIVRE.get(m[3]);
        if (!creature) {
          arrets.push(`${ou} : créature « ${ligne} » hors de la table du livre`);
          return { min: 0, max: 0, ops: [] };
        }
        const { id, nombre, optionals } = creature;
        return {
          min: Number(m[1]), max: Number(m[2] ?? m[1]),
          ops: [{ op: 'combatEnMer', adversaire: { id, nombre, ...(optionals ? { optionals } : {}) }, repousseAPct: REPOUSSE_A_PCT }],
        };
      });
      if (!entries.length) arrets.push(`${ou} : params.creatures vide`);
      return surLeNavire([{ op: 'rollTable', die: '1d10', entries }]);
    }
  }
  throw new Error(`genre « ${e.kind} » hors de GENRES_MIGRES`);
}

/** Remplace `kind` par `consequence` au même rang, et retire `params`. */
function reecrire(e, consequence) {
  const copie = Object.entries(e);
  for (const k of Object.keys(e)) delete e[k];
  for (const [k, v] of copie) {
    if (k === 'params') continue;
    if (k === 'kind') e.consequence = consequence;
    else e[k] = v;
  }
}

let gestes = 0;

// ── sea-events.json ──────────────────────────────────────────────────────────────────────────────
const brutSea = readFileSync(SEA, 'utf8');
const sea = JSON.parse(brutSea);
if (brutSea !== serializeDataset(sea)) arrets.push('sea-events.json : forme non canonique');
else {
  for (const e of sea.boardEvents?.entries ?? []) {
    const ou = `sea-events.json boardEvents « ${e.id} »`;
    if (!GENRES_MIGRES.has(e.kind)) continue;
    reecrire(e, consequenceDe(e, ou));
    gestes++;
  }
  for (const e of [...(sea.boardEvents?.entries ?? []), ...(sea.portEvents?.entries ?? [])]) {
    const ou = `sea-events.json « ${e.id} »`;
    if (GENRES_MIGRES.has(e.kind)) arrets.push(`${ou} : genre « ${e.kind} » non migré`);
    if (e.consequence !== undefined && (e.kind !== undefined || e.params !== undefined)) arrets.push(`${ou} : consequence et kind/params coexistent`);
  }
}

// ── projets de campagne : `woundsThreshold.belowPercent` → `atOrBelowPercent` ─────────────────────
/** Le document sérialisé dans la forme de son texte d'origine : indentation de sa 2e ligne, saut final. */
function reserialise(doc, texte) {
  const indent = /^\n?[[{]\r?\n( +)/.exec(texte)?.[1].length ?? 2;
  return `${JSON.stringify(doc, null, indent)}${texte.endsWith('\n') ? '\n' : ''}`;
}

const SCENES = join(ROOT, 'src/scenes');
const projets = readdirSync(SCENES, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => join(SCENES, d.name, `${d.name}-projet.json`))
  .filter((f) => existsSync(f));
const ecritures = [];
for (const fichier of projets) {
  const brut = readFileSync(fichier, 'utf8');
  if (!brut.includes('"woundsThreshold"')) continue;
  const doc = JSON.parse(brut);
  const nom = fichier.slice(SCENES.length + 1);
  if (brut !== reserialise(doc, brut)) { arrets.push(`${nom} : forme non canonique`); continue; }
  const migrer = (noeud, chemin) => {
    if (Array.isArray(noeud)) { noeud.forEach((v, i) => migrer(v, `${chemin}[${i}]`)); return; }
    if (!noeud || typeof noeud !== 'object') return;
    if (noeud.type === 'woundsThreshold' && 'belowPercent' in noeud) {
      if (typeof noeud.belowPercent !== 'number' || 'atOrBelowPercent' in noeud) {
        arrets.push(`${nom} ${chemin} : woundsThreshold hors de la forme {targetId, belowPercent}`);
        return;
      }
      const copie = Object.entries(noeud);
      for (const k of Object.keys(noeud)) delete noeud[k];
      for (const [k, v] of copie) noeud[k === 'belowPercent' ? 'atOrBelowPercent' : k] = v;
      gestes++;
      return;
    }
    for (const [k, v] of Object.entries(noeud)) migrer(v, `${chemin}.${k}`);
  };
  migrer(doc, '');
  const out = reserialise(doc, brut);
  if (out.includes('"belowPercent"')) arrets.push(`${nom} : belowPercent restant`);
  if (out !== brut) ecritures.push([fichier, out, nom]);
}

if (arrets.length) {
  console.error(`ARRÊT — ${arrets.length} anomalie(s), AUCUNE écriture :`);
  for (const a of arrets) console.error(`  ${a}`);
  process.exit(1);
}
const outSea = serializeDataset(sea);
if (outSea !== brutSea) writeFileSync(SEA, outSea, 'utf8');
for (const [fichier, out] of ecritures) writeFileSync(fichier, out, 'utf8');
const reecrits = [...(outSea !== brutSea ? ['sea-events.json'] : []), ...ecritures.map(([, , nom]) => nom)];
console.log(`migration 1652 (combat en mer) : ${gestes} geste(s)${reecrits.length ? `, réécrit(s) : ${reecrits.join(', ')}` : ''}.`);
