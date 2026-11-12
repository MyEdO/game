/**
 * Migration #1652 lot 2 — navire et climat : dix rangées de bord et deux d'escale de `sea-events.json`
 * passent de leur genre (`kind` + `params`) à leur `consequence` en grammaire (`Flow`, joué par `runFlow`).
 *
 *   genre (rangée)                        consequence (dérivée des `params` de la rangée)
 *   `ouragan`                             `test` d'équipage (`crewTestType` = `testType`, `difficulty`),
 *                                         échec : ops navire `shipCritical` (`failCrits`, `critLocation`)  MDG 15 l.144-145
 *   `crabes-boxeurs`                      ops navire `navireMod` (`mMod`, `manDR`) jusqu'au carénage       MDG 15 l.184-185
 *   `choix-vaisseau-fantome`              `choice` changer de cap : `navireMod` (`detourMMod`, `detourDays`
 *                                         jours) ; continuer : `shipMorale` (`moral`)                       MDG 15 l.187-188
 *   `calme-plat`/`bruine`/`beau-temps`/   ops navire `meteoImposee` (`days`, `weather`)                     MDG 15 l.189, l.199,
 *   `ciel-degage`                                                                                          l.219, l.226-227, l.257
 *   `vents-inhabituels`                   ops navire `meteoImposee` (`days`, vents dominants inversés)     MDG 15 l.196-197
 *   `tempete` (escale)                    ops navire `meteoImposee` (`days`, `weather`), aggravation
 *                                         (`escalation`)                                                   MDG 15 l.248
 *   `rafale-ghyran`                       ops du groupe `skillDRBonus` (`skills`, `specs`, `drBonus`)
 *                                         pendant `days` jours                                             MDG 15 l.211-212
 *   `chance-navigateur`                   ops du rôle `capitaine` `grantTalent` (`talent`) pendant `days`
 *                                         jours                                                            MDG 15 l.233-234
 *
 * L'enjeu du Test d'Affaler (`stakes.json` « sea-ouragan-affaler ») renvoie à la RANGÉE jouée : sa clé porte
 * `entryId` et `entryCategory: 'seaBoardEvents'`, comme celle du Test de Prière (lot 1).
 *
 * Vents favorables (MDG 15 l.228) et Marsouin amical (l.229) ne sont pas des entrées de cette migration.
 *
 * Entrée : src/data/sea-events.json.
 *
 * FORME ASSERTÉE SUR LE RÉSULTAT : aucune rangée ne porte plus un genre migré, aucune ne porte à la fois
 * `consequence` et `kind`/`params`. Des `params` hors de la forme attendue ou un document non canonique
 * sont un ARRÊT nominatif (exit 1), AUCUNE écriture. Rejouée sur l'arbre migré : no-op byte-identique.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SEA = join(ROOT, 'src/data/sea-events.json');
const METEOS = new Set(['calme-plat', 'bruine', 'beau-temps', 'ciel-degage']);
const GENRES_MIGRES = new Set([...METEOS, 'ouragan', 'crabes-boxeurs', 'choix-vaisseau-fantome', 'vents-inhabituels', 'tempete', 'rafale-ghyran', 'chance-navigateur']);
const AXES = new Set(['precipitations', 'temperature', 'visibilite', 'vent']);

const arrets = [];

const estDe = (d) => d && Number.isInteger(d.n) && d.n > 0 && Number.isInteger(d.sides) && d.plus === undefined;
const estTirage = (q) => q && Object.keys(q).length === 1 && estDe(q.dice);
const estEffetSigne = (e) => e && (e.sign === 1 || e.sign === -1) && estDe(e.dice);
const estMeteo = (m) => m && typeof m === 'object' && Object.keys(m).length > 0 && Object.entries(m).every(([k, v]) => AXES.has(k) && typeof v === 'string');
const surLeNavire = (ops) => ({ kind: 'do', effect: { type: 'ops', on: 'navire', ops } });
const rien = { kind: 'seq', steps: [] };

function consequenceDe(e, table, ou) {
  const p = e.params ?? {};
  const cles = (attendues) => {
    const hors = Object.keys(p).filter((k) => !attendues.includes(k));
    if (hors.length) arrets.push(`${ou} : params inattendus ${hors.join(', ')}`);
  };
  const jours = (q, champ) => {
    if (!estTirage(q)) arrets.push(`${ou} : params.${champ} hors de la forme {dice}`);
    return { dice: q?.dice };
  };
  const meteo = (m, champ) => {
    if (!estMeteo(m)) arrets.push(`${ou} : params.${champ} hors de la forme {axe: palier}`);
    return { ...m };
  };
  if (METEOS.has(e.kind)) {
    cles(['days', 'weather']);
    return surLeNavire([{ op: 'meteoImposee', jours: jours(p.days, 'days'), meteo: meteo(p.weather, 'weather') }]);
  }
  switch (e.kind) {
    case 'ouragan':
      cles(['testType', 'difficulty', 'failCrits', 'critLocation']);
      if (typeof p.testType !== 'string') arrets.push(`${ou} : params.testType absent`);
      if (typeof p.difficulty !== 'string') arrets.push(`${ou} : params.difficulty absent`);
      if (!Number.isInteger(p.failCrits) || p.failCrits < 1) arrets.push(`${ou} : params.failCrits « ${p.failCrits} » ni entier ni positif`);
      if (typeof p.critLocation !== 'string') arrets.push(`${ou} : params.critLocation absent`);
      return {
        kind: 'test',
        test: { crewTestType: p.testType, difficulty: p.difficulty, stake: { key: { dataset: 'voyage', kind: 'sea-ouragan-affaler', entryId: e.id, entryCategory: table === 'boardEvents' ? 'seaBoardEvents' : 'seaPortEvents' } } },
        success: rien,
        fail: surLeNavire([{ op: 'shipCritical', location: p.critLocation, count: p.failCrits }]),
      };
    case 'crabes-boxeurs':
      cles(['mMod', 'manDR']);
      if (!Number.isInteger(p.mMod) || !Number.isInteger(p.manDR)) arrets.push(`${ou} : params.mMod/manDR non entiers`);
      return surLeNavire([{ op: 'navireMod', m: p.mMod, manDR: p.manDR, jusqua: 'carenage' }]);
    case 'choix-vaisseau-fantome':
      cles(['detourMMod', 'detourDays', 'moral']);
      if (!Number.isInteger(p.detourMMod) || !Number.isInteger(p.detourDays)) arrets.push(`${ou} : params.detourMMod/detourDays non entiers`);
      if (!estEffetSigne(p.moral)) arrets.push(`${ou} : params.moral hors de la forme {sign, dice}`);
      return {
        kind: 'choice',
        prompt: 'Changer de cap',
        yes: surLeNavire([{ op: 'navireMod', m: p.detourMMod, jusqua: { jours: p.detourDays } }]),
        no: surLeNavire([{ op: 'shipMorale', delta: p.moral }]),
      };
    case 'vents-inhabituels':
      cles(['days']);
      return surLeNavire([{ op: 'meteoImposee', jours: jours(p.days, 'days'), ventInverse: true }]);
    case 'tempete': {
      cles(['days', 'escalation', 'weather']);
      const x = p.escalation ?? {};
      if (!Number.isInteger(x.min)) arrets.push(`${ou} : params.escalation.min non entier`);
      return surLeNavire([{
        op: 'meteoImposee', jours: jours(p.days, 'days'), meteo: meteo(p.weather, 'weather'),
        aggravation: { de: jours(x.roll, 'escalation.roll'), seuil: x.min, meteo: meteo(x.weather, 'escalation.weather') },
      }]);
    }
    case 'rafale-ghyran': {
      cles(['days', 'drBonus', 'skills', 'specs']);
      if (!Number.isInteger(p.drBonus)) arrets.push(`${ou} : params.drBonus non entier`);
      if (!Array.isArray(p.skills) || !p.skills.length) arrets.push(`${ou} : params.skills vide`);
      const specs = p.specs ?? {};
      return {
        kind: 'do',
        effect: {
          type: 'ops', on: 'groupe', pendantJours: jours(p.days, 'days'),
          ops: (p.skills ?? []).map((id) => ({ op: 'skillDRBonus', skill: specs[id] ? { id, spec: specs[id] } : { id }, bonus: p.drBonus })),
        },
      };
    }
    case 'chance-navigateur':
      cles(['days', 'talent']);
      if (typeof p.talent !== 'string') arrets.push(`${ou} : params.talent absent`);
      return {
        kind: 'do',
        effect: { type: 'ops', on: { role: { id: 'capitaine' } }, pendantJours: jours(p.days, 'days'), ops: [{ op: 'grantTalent', talent: { id: p.talent } }] },
      };
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

const brut = readFileSync(SEA, 'utf8');
const sea = JSON.parse(brut);
let gestes = 0;
if (brut !== serializeDataset(sea)) arrets.push('sea-events.json : forme non canonique');
else {
  for (const table of ['boardEvents', 'portEvents']) {
    for (const e of sea[table]?.entries ?? []) {
      if (!GENRES_MIGRES.has(e.kind)) continue;
      reecrire(e, consequenceDe(e, table, `sea-events.json ${table} « ${e.id} »`));
      gestes++;
    }
  }
  for (const table of ['boardEvents', 'portEvents']) {
    for (const e of sea[table]?.entries ?? []) {
      const ou = `sea-events.json ${table} « ${e.id} »`;
      if (GENRES_MIGRES.has(e.kind)) arrets.push(`${ou} : genre « ${e.kind} » non migré`);
      if (e.consequence !== undefined && (e.kind !== undefined || e.params !== undefined)) arrets.push(`${ou} : consequence et kind/params coexistent`);
    }
  }
}

if (arrets.length) {
  console.error(`ARRÊT — ${arrets.length} anomalie(s), AUCUNE écriture :`);
  for (const a of arrets) console.error(`  ${a}`);
  process.exit(1);
}
const out = serializeDataset(sea);
if (out !== brut) writeFileSync(SEA, out, 'utf8');
console.log(`migration 1652 (navire et climat) : ${gestes} geste(s)${out !== brut ? ', sea-events.json réécrit' : ''}.`);
