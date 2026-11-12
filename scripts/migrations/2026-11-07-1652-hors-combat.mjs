/**
 * Migration #1652 lot 7 — nœuds hors combat : trois rangées de bord de `sea-events.json` passent de leur
 * genre (`kind` + `params`) à leur `consequence` en grammaire (`Flow`, joué par `runFlow`), et les deux
 * Présages divins réservent leur Test de Prière au Prêtre ou à la Nonne de Manann (`test.gate`, évaluée sur chaque héros).
 *
 *   rangée                         consequence (dérivée des `params` de la rangée)
 *   `infestation-de-rats-geants`   op navire `infestation` : Test étendu `testType`, nuit = Enc gâtés
 *   `infestation-de-rats`          (`spoilEncPerNight`) + fièvre du rongeur à `diseaseChancePct` % sur un
 *                                  membre au hasard                            MDG 15 l.159-164, l.174-178
 *   `vaisseau-de-pestiferes`       `choice` aborder : cargaison (`cargoCrates`), rations (`biscuitDays`),
 *                                  eau (`waterBarrels`), `co` CO, puis les volontaires montent à bord et
 *                                  sont exposés à la peste noire                MDG 15 l.194-196
 *   `presage-divin-albatros`       `test.gate` : Béni (Manann)                 MDG 15 l.197-198
 *   `presage-divin-feu-bleu`       `test.gate` : Béni (Manann)                 MDG 15 l.230-232
 *
 * Valeur MAISON, sur la consigne de l'utilisateur du 2026-11-07 (« met ce qui te semble juste ») : une
 * caisse de cargaison vaut 1 Enc (MDG 12 l.35 ne chiffre pas la caisse).
 *
 * `ratAttacks`, `ratCC`, `ratWeapon` (attaques des rats sur une étape à DR négatif, l.162-164, l.177-178) ne
 * sont pas portés : aucune porte de jet ne joue une attaque subie hors combat. Leurs valeurs restent au
 * `desc` verbatim et à l'entrée `raw.manifest.json` de l'Humeur de Manann.
 *
 * Entrée : src/data/sea-events.json. Une rangée nommée absente n'est pas une anomalie : la migration
 * rejouée après sa suppression sort 0 sans écrire.
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
const GENRES_MIGRES = new Set(['infestation', 'vaisseau-pestifere']);
const PRESAGES = new Set(['presage-divin-albatros', 'presage-divin-feu-bleu']);
const PRETRE_DE_MANANN = { kind: 'talent', id: 'beni', spec: 'manann' };

const arrets = [];

const estDe = (d) => d && Number.isInteger(d.n) && d.n > 0 && Number.isInteger(d.sides) && d.plus === undefined;
const estTirage = (q) => q && Object.keys(q).length === 1 && estDe(q.dice);
const feuille = (on, ops) => ({ kind: 'do', effect: { type: 'ops', on, ops } });
const fievre = { op: 'exposeDisease', disease: 'fievre-du-rongeur' };

function consequenceDe(e, ou) {
  const p = e.params ?? {};
  const cles = (attendues) => {
    const hors = Object.keys(p).filter((k) => !attendues.includes(k));
    if (hors.length) arrets.push(`${ou} : params inattendus ${hors.join(', ')}`);
  };
  const de = (k) => {
    if (!estTirage(p[k])) arrets.push(`${ou} : params.${k} hors de la forme {dice}`);
    return { dice: p[k]?.dice };
  };
  const entier = (k) => {
    if (!Number.isInteger(p[k]) || p[k] < 0) arrets.push(`${ou} : params.${k} « ${p[k]} » n'est pas un entier positif`);
    return p[k];
  };
  switch (e.kind) {
    case 'infestation': {
      cles(['testType', 'difficulty', 'drCible', 'spoilEncPerNight', 'diseaseChancePct', 'ratAttacks', 'ratCC', 'ratWeapon']);
      if (typeof p.testType !== 'string' || typeof p.difficulty !== 'string') arrets.push(`${ou} : params.testType/difficulty absents`);
      const pct = entier('diseaseChancePct');
      if (pct < 1 || pct > 99) arrets.push(`${ou} : params.diseaseChancePct « ${pct} » hors de 1-99`);
      return feuille('navire', [{
        op: 'infestation', crewTestType: { id: p.testType }, difficulty: p.difficulty, drCible: entier('drCible'),
        chaqueNuit: {
          kind: 'seq',
          steps: [
            feuille('navire', [{ op: 'cargaison', perdueEnc: de('spoilEncPerNight') }]),
            feuille('membreAuHasard', [{ op: 'rollTable', die: '1d100', entries: [{ min: 1, max: pct, ops: [fievre] }, { min: pct + 1, max: 100, ops: [] }] }]),
          ],
        },
      }]);
    }
    case 'vaisseau-pestifere':
      cles(['cargoCrates', 'biscuitDays', 'waterBarrels', 'co', 'resistDifficulty']);
      if (p.resistDifficulty !== 'accessible') arrets.push(`${ou} : params.resistDifficulty « ${p.resistDifficulty} » ≠ la difficulté de Contraction de la peste noire`);
      return {
        kind: 'choice', prompt: 'Aborder la cogue',
        yes: {
          kind: 'seq',
          steps: [
            feuille('navire', [
              { op: 'cargaison', enc: de('cargoCrates') },
              { op: 'provisions', rations: de('biscuitDays') },
              { op: 'provisions', eauTonneaux: de('waterBarrels') },
            ]),
            feuille('party', [{ op: 'money', montant: { brass: { times: { of: de('co'), factor: 240 } } }, groupe: true }]),
            feuille({ volontaires: 'Monter à bord' }, [{ op: 'exposeDisease', disease: 'peste-noire' }]),
          ],
        },
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

/** Le nœud `test` de Prière d'un Présage : sous le `si` Béni (Manann). */
function testDuPresage(e, ou) {
  const c = e.consequence;
  const test = c?.kind === 'si' && c.alors?.kind === 'test' ? c.alors.test : undefined;
  if (!test || test.skill?.id !== 'priere') arrets.push(`${ou} : consequence hors de la forme si → test de Prière`);
  return test;
}

const brut = readFileSync(SEA, 'utf8');
const sea = JSON.parse(brut);
let gestes = 0;
if (brut !== serializeDataset(sea)) arrets.push('sea-events.json : forme non canonique');
else {
  for (const e of sea.boardEvents?.entries ?? []) {
    const ou = `sea-events.json boardEvents « ${e.id} »`;
    if (GENRES_MIGRES.has(e.kind)) {
      reecrire(e, consequenceDe(e, ou));
      gestes++;
    } else if (PRESAGES.has(e.id)) {
      const test = testDuPresage(e, ou);
      if (test && test.gate === undefined) {
        test.gate = PRETRE_DE_MANANN;
        gestes++;
      }
    }
  }
  for (const e of sea.boardEvents?.entries ?? []) {
    const ou = `sea-events.json boardEvents « ${e.id} »`;
    if (GENRES_MIGRES.has(e.kind)) arrets.push(`${ou} : genre « ${e.kind} » non migré`);
    if (e.consequence !== undefined && (e.kind !== undefined || e.params !== undefined)) arrets.push(`${ou} : consequence et kind/params coexistent`);
  }
}

if (arrets.length) {
  console.error(`ARRÊT — ${arrets.length} anomalie(s), AUCUNE écriture :`);
  for (const a of arrets) console.error(`  ${a}`);
  process.exit(1);
}
const out = serializeDataset(sea);
if (out !== brut) writeFileSync(SEA, out, 'utf8');
console.log(`migration 1652 (hors combat) : ${gestes} geste(s)${out !== brut ? ', sea-events.json réécrit' : ''}.`);
