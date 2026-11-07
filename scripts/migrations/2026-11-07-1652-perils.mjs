/**
 * Migration #1652 lot 4 — périls et navires hostiles, plus Vents favorables et Marsouin amical (suite du
 * lot 2) : sept rangées de bord et une d'escale de `sea-events.json` passent de leur genre (`kind` +
 * `params`) à leur `consequence` en grammaire (`Flow`, joué par `runFlow`), ou à aucune.
 *
 *   genre (rangée)        consequence (dérivée des `params` de la rangée)
 *   `maelstrom`           ops navire `perilDeMer` tourbillon `maelstrom`                       MDG 15 l.140-141
 *   `vortex`              ops navire `perilDeMer` tourbillon `puissant-vortex`                 MDG 15 l.146
 *   `collision`           ops navire `perilDeMer` collision `rocher` (« se heurte à un rocher ») MDG 15 l.181-183
 *   `navire-hostile`      ops navire `navireHostile` (`ship`, `crewRef` × `crew`, `chefRef`,
 *                         `greatGuns`) ; la Cogue exige de fouiller la cale                    MDG 15 l.150-151, l.171-173
 *   `nemesis`             aucune : rencontre de scénario, narrative hors campagne              MDG 15 l.148-149
 *   `vents-favorables`    ops navire `navireMod` (`mMod`) jusqu'au prochain événement de bord  MDG 15 l.228
 *   `marsouin`            ops navire `navireMod` évite Rocher et Bas-fonds pendant `days`      MDG 15 l.229
 *   `port-desert`         `taillePortMax` (`maxSize`) ; `choice` fouiller le port : ops navire
 *                         `provisions` 1d10 jours, `cargaison` 1d100 Enc, `shipMorale` (`moral`) MDG 15 l.249
 *
 * Valeurs MAISON, sur la consigne de l'utilisateur du 2026-11-07 (« N attends pas les arbitrages, met ce qui
 * te semble juste ») : la durée de Vents favorables (jusqu'au prochain événement de bord, la cadence des
 * événements, l.89) ; l'évitement du Marsouin (les périls Rocher et Bas-fonds de MDG 13 l.493-499, la
 * Collision soudaine comprise) ; le butin du Port désert (les vivres de la Manne, l.235, et la cargaison des
 * Débris, l.209).
 *
 * `sea-perils.json` : la Collision soudaine heurte le Rocher que nomme la RAW, la pondération maison du tirage
 * entre périls (`hazards[].weight`, `hazardsWeightNote`) n'a plus de lecteur et se retire.
 *
 * Le Contrôle à quai (l.247) n'est pas une entrée de cette migration.
 *
 * Entrées : src/data/sea-events.json, src/data/sea-perils.json.
 *
 * FORME ASSERTÉE SUR LE RÉSULTAT : aucune rangée ne porte plus un genre migré, aucune ne porte à la fois
 * `consequence` et `kind`/`params`, aucun péril ne porte de poids. Des `params` hors de la forme attendue ou
 * un document non canonique sont un ARRÊT nominatif (exit 1), AUCUNE écriture. Rejouée sur l'arbre migré :
 * no-op byte-identique.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SEA = join(ROOT, 'src/data/sea-events.json');
const PERILS = join(ROOT, 'src/data/sea-perils.json');
const GENRES_MIGRES = new Set(['maelstrom', 'vortex', 'collision', 'navire-hostile', 'nemesis', 'vents-favorables', 'marsouin', 'port-desert']);
/** Le navire hostile qui exige de fouiller la cale (l.171-173) ; le langskip (l.150-151) n'extorque rien. */
const EXIGE_LA_FOUILLE = new Set(['cogue-pirate']);

const arrets = [];

const estDe = (d) => d && Number.isInteger(d.n) && d.n > 0 && Number.isInteger(d.sides) && d.plus === undefined;
const estTirage = (q) => q && Object.keys(q).length === 1 && estDe(q.dice);
const estSigne = (q) => q && (q.sign === 1 || q.sign === -1) && estDe(q.dice) && Object.keys(q).length === 2;
const surLeNavire = (ops) => ({ kind: 'do', effect: { type: 'ops', on: 'navire', ops } });
const d = (n, sides) => ({ dice: { n, sides } });

/** La `consequence` d'une rangée, `null` pour une rangée narrative. */
function consequenceDe(e, ou) {
  const p = e.params ?? {};
  const cles = (attendues) => {
    const hors = Object.keys(p).filter((k) => !attendues.includes(k));
    if (hors.length) arrets.push(`${ou} : params inattendus ${hors.join(', ')}`);
  };
  switch (e.kind) {
    case 'maelstrom':
      cles([]);
      return surLeNavire([{ op: 'perilDeMer', tourbillon: { id: 'maelstrom' } }]);
    case 'vortex':
      cles([]);
      return surLeNavire([{ op: 'perilDeMer', tourbillon: { id: 'puissant-vortex' } }]);
    case 'collision':
      cles([]);
      return surLeNavire([{ op: 'perilDeMer', collision: { id: 'rocher' } }]);
    case 'nemesis':
      cles([]);
      return null;
    case 'navire-hostile': {
      cles(['ship', 'crew', 'crewRef', 'chefRef', 'greatGuns']);
      if (typeof p.ship !== 'string' || typeof p.crewRef !== 'string') arrets.push(`${ou} : params.ship/crewRef absents`);
      if (!Number.isInteger(p.crew) || p.crew < 1) arrets.push(`${ou} : params.crew « ${p.crew} » n'est pas un effectif`);
      if (p.greatGuns !== undefined && (!Number.isInteger(p.greatGuns) || p.greatGuns < 1)) arrets.push(`${ou} : params.greatGuns « ${p.greatGuns} » invalide`);
      return surLeNavire([{
        op: 'navireHostile', navire: { id: p.ship }, equipage: { id: p.crewRef, nombre: p.crew },
        ...(p.chefRef ? { chef: { id: p.chefRef } } : {}),
        ...(p.greatGuns ? { grandsCanons: p.greatGuns } : {}),
        ...(EXIGE_LA_FOUILLE.has(e.id) ? { exigence: 'fouille' } : {}),
      }]);
    }
    case 'vents-favorables':
      cles(['mMod']);
      if (!Number.isInteger(p.mMod)) arrets.push(`${ou} : params.mMod « ${p.mMod} » n'est pas un entier`);
      return surLeNavire([{ op: 'navireMod', m: p.mMod, jusqua: 'evenementDeBord' }]);
    case 'marsouin':
      cles(['days']);
      if (!estTirage(p.days)) arrets.push(`${ou} : params.days hors de la forme {dice}`);
      return surLeNavire([{ op: 'navireMod', evite: ['rocher', 'bas-fonds'], jusqua: { jours: { dice: p.days?.dice } } }]);
    case 'port-desert':
      cles(['maxSize', 'moral']);
      if (!estSigne(p.moral)) arrets.push(`${ou} : params.moral hors de la forme {sign, dice}`);
      return {
        kind: 'choice', prompt: 'Fouiller le port',
        yes: surLeNavire([
          { op: 'provisions', jours: d(1, 10) },
          { op: 'cargaison', enc: d(1, 100) },
          { op: 'shipMorale', delta: { sign: p.moral?.sign, dice: p.moral?.dice } },
        ]),
      };
  }
  throw new Error(`genre « ${e.kind} » hors de GENRES_MIGRES`);
}

/** Remplace `kind` par `consequence` (rien pour une rangée narrative) au même rang, précédée de
 *  `taillePortMax` s'il y en a une, et retire `params`. */
function reecrire(e, consequence, taillePortMax) {
  const copie = Object.entries(e);
  for (const k of Object.keys(e)) delete e[k];
  for (const [k, v] of copie) {
    if (k === 'params') continue;
    if (k === 'kind') {
      if (taillePortMax !== undefined) e.taillePortMax = taillePortMax;
      if (consequence) e.consequence = consequence;
    } else e[k] = v;
  }
}

const brut = readFileSync(SEA, 'utf8');
const sea = JSON.parse(brut);
const brutPerils = readFileSync(PERILS, 'utf8');
const perils = JSON.parse(brutPerils);
let gestes = 0;
if (brut !== serializeDataset(sea)) arrets.push('sea-events.json : forme non canonique');
if (brutPerils !== serializeDataset(perils)) arrets.push('sea-perils.json : forme non canonique');
if (!arrets.length) {
  for (const table of ['boardEvents', 'portEvents']) {
    for (const e of sea[table]?.entries ?? []) {
      if (!GENRES_MIGRES.has(e.kind)) continue;
      const ou = `sea-events.json ${table} « ${e.id} »`;
      const taille = e.kind === 'port-desert' ? e.params?.maxSize : undefined;
      if (e.kind === 'port-desert' && (!Number.isInteger(taille) || taille < 1)) arrets.push(`${ou} : params.maxSize « ${taille} » n'est pas une Taille`);
      reecrire(e, consequenceDe(e, ou), taille);
      gestes++;
    }
  }
  if ('hazardsWeightNote' in perils) { delete perils.hazardsWeightNote; gestes++; }
  for (const h of perils.hazards ?? []) if ('weight' in h) { delete h.weight; gestes++; }
  for (const table of ['boardEvents', 'portEvents']) {
    for (const e of sea[table]?.entries ?? []) {
      const ou = `sea-events.json ${table} « ${e.id} »`;
      if (GENRES_MIGRES.has(e.kind)) arrets.push(`${ou} : genre « ${e.kind} » non migré`);
      if (e.consequence !== undefined && (e.kind !== undefined || e.params !== undefined)) arrets.push(`${ou} : consequence et kind/params coexistent`);
    }
  }
  for (const h of perils.hazards ?? []) if ('weight' in h) arrets.push(`sea-perils.json « ${h.id} » : poids non retiré`);
}

if (arrets.length) {
  console.error(`ARRÊT — ${arrets.length} anomalie(s), AUCUNE écriture :`);
  for (const a of arrets) console.error(`  ${a}`);
  process.exit(1);
}
const out = serializeDataset(sea);
const outPerils = serializeDataset(perils);
if (out !== brut) writeFileSync(SEA, out, 'utf8');
if (outPerils !== brutPerils) writeFileSync(PERILS, outPerils, 'utf8');
console.log(`migration 1652 (périls) : ${gestes} geste(s)${out !== brut ? ', sea-events.json réécrit' : ''}${outPerils !== brutPerils ? ', sea-perils.json réécrit' : ''}.`);
