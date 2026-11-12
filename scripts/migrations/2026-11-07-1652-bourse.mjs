/**
 * Migration #1652 lot 6 — paiement sur la bourse du groupe : trois rangées d'escale de `sea-events.json`
 * passent de leur genre (`kind` + `params`) à leur `consequence` en grammaire (`Flow`, joué par `runFlow`),
 * avec l'op `money` à `groupe`, la Condition `money` sur une valeur liée et les valeurs liées `{tire}`.
 *
 *   genre (rangée)      consequence (dérivée des `params` de la rangée)                          MDG 15
 *   `pretre-manann`     si la bourse couvre la bénédiction (`blessingCO` CO + `blessingSilverPerSize`
 *                       × Taille du navire en pistoles, tirée une fois) : `choice` payer ; refus ou
 *                       bourse trop courte : op navire `manann` (`manann`)                       l.246
 *   `embrigadement`     op navire `equipage` −`lostCrew` (tiré une fois) ; `choice` tenter : Test de
 *                       Ragot (`gossipDifficulty`) ; réussite : `choice` payer la rançon (`ransomCO`,
 *                       si la bourse la couvre) puis `choice` les libérer en douce (Test de
 *                       Discrétion, `stealthDifficulty`) ; libérés : les MÊMES marins reviennent ;
 *                       chaque échec : −`failExtraLostCrew`                                      l.245
 *   `controle-a-quai`   Test de Subornation (`bribeDifficulty`) ; réussite : `choice` le pot-de-vin
 *                       (`bribeCO`, si la bourse le couvre), sinon les droits ; droits (`taxPct` % de
 *                       la valeur de la cargaison, si la bourse les couvre) : `choice` payer ; refus
 *                       ou bourse trop courte : op navire `cargaison` perdue à 100 %             l.247
 *
 * MAISON (consigne de l'utilisateur du 2026-11-07, « met ce qui te semble juste ») : toute la cargaison est
 * déclarée au Contrôle à quai (l.247 « que vous n'avez pas cachée » : aucune cale cachée n'est modélisée).
 *
 * `stakes.json` : les enjeux des Tests de l'Embrigadement prennent leur id pour clé (les genres d'étape
 * `embrigadementRagot`/`embrigadementDiscretion` disparaissent) ; le Test de Subornation reçoit le sien.
 *
 * Entrées : src/data/sea-events.json, src/data/stakes.json.
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
const STAKES = join(ROOT, 'src/data/stakes.json');
const GENRES_MIGRES = new Set(['pretre-manann', 'embrigadement', 'controle-a-quai']);
const SOUS_PAR_CO = 240;
const SOUS_PAR_PISTOLE = 12;
const CLES_DES_ENJEUX = { embrigadementRagot: 'sea-embrigadement-ragot', embrigadementDiscretion: 'sea-embrigadement-discretion' };
const ENJEU_SUBORNATION = {
  id: 'sea-controle-subornation',
  type: 'stakes',
  label: 'Contrôle à quai — suborner le superviseur',
  cascade: 'voyage',
  cle: 'sea-controle-subornation',
  template: 'Réussi : un pot-de-vin de 2d10 CO peut faire « perdre » les formulaires. Échec : restent les droits de douane, ou la saisie de la cargaison.',
  form: 'descripteur',
  rule: { id: 'subornation', type: 'skill' },
  source: { book: 'mer-des-griffes', page: 133, note: 'MDG 15 l.247' },
};

const arrets = [];
const estTirage = (v) => v !== null && typeof v === 'object' && v.dice && Number.isInteger(v.dice.n) && Number.isInteger(v.dice.sides) && Object.keys(v).length === 1;
const estDifficulte = (v) => typeof v === 'string' && v.length > 0;

const negatif = (f) => ({ times: { of: f, factor: -1 } });
const en = (f, facteur) => ({ times: { of: f, factor: facteur } });
const surLeNavire = (ops) => ({ kind: 'do', effect: { type: 'ops', on: 'navire', ops } });
const surLaBourse = (brass) => ({ kind: 'do', effect: { type: 'ops', on: 'groupe', ops: [{ op: 'money', montant: { brass }, groupe: true }] } });
const laBourseCouvre = (nom) => ({ kind: 'money', atLeast: { brass: { tire: nom } } });
const seq = (...steps) => ({ kind: 'seq', steps });
const enjeu = (cle, entryId) => ({ key: { dataset: 'voyage', kind: cle, entryId, entryCategory: 'seaPortEvents' } });

/** La `consequence` d'une rangée d'un genre migré, dérivée de ses `params` (`ou` nomme la rangée). */
function consequenceDe(e, ou) {
  const p = e.params ?? {};
  const cles = (attendues) => {
    const hors = Object.keys(p).filter((k) => !attendues.includes(k));
    if (hors.length) arrets.push(`${ou} : params inattendus ${hors.join(', ')}`);
  };
  switch (e.kind) {
    case 'pretre-manann': {
      cles(['blessingCO', 'blessingSilverPerSize', 'manann']);
      if (!estTirage(p.blessingCO)) arrets.push(`${ou} : params.blessingCO hors de la forme {dice}`);
      if (!Number.isInteger(p.blessingSilverPerSize)) arrets.push(`${ou} : params.blessingSilverPerSize n'est pas un entier`);
      if (!p.manann || !estTirage({ dice: p.manann.dice }) || ![1, -1].includes(p.manann.sign)) arrets.push(`${ou} : params.manann hors de la forme {sign, dice}`);
      const benediction = { sum: [en({ dice: p.blessingCO?.dice }, SOUS_PAR_CO), en({ tailleDuNavire: true }, SOUS_PAR_PISTOLE * p.blessingSilverPerSize)] };
      const courroux = surLeNavire([{ op: 'manann', delta: p.manann }]);
      return {
        kind: 'if',
        cond: laBourseCouvre('benediction'),
        then: { kind: 'choice', prompt: 'Payer la bénédiction', icon: 'faith/trident', yes: surLaBourse(negatif({ tire: 'benediction', de: benediction })), no: courroux },
        else: courroux,
      };
    }
    case 'embrigadement': {
      cles(['lostCrew', 'gossipDifficulty', 'ransomCO', 'stealthDifficulty', 'failExtraLostCrew']);
      for (const k of ['lostCrew', 'ransomCO', 'failExtraLostCrew']) if (!estTirage(p[k])) arrets.push(`${ou} : params.${k} hors de la forme {dice}`);
      for (const k of ['gossipDifficulty', 'stealthDifficulty']) if (!estDifficulte(p[k])) arrets.push(`${ou} : params.${k} n'est pas une difficulté`);
      const reviennent = surLeNavire([{ op: 'equipage', delta: { tire: 'enleves' } }]);
      const encorePerdus = surLeNavire([{ op: 'equipage', delta: negatif({ dice: p.failExtraLostCrew?.dice }) }]);
      const enDouce = {
        kind: 'choice', prompt: 'Les libérer en douce',
        yes: { kind: 'test', test: { skill: { id: 'discretion' }, difficulty: p.stealthDifficulty, stake: enjeu('sea-embrigadement-discretion', e.id) }, success: reviennent, fail: encorePerdus },
      };
      return seq(
        surLeNavire([{ op: 'equipage', delta: negatif({ tire: 'enleves', de: { dice: p.lostCrew?.dice } }) }]),
        {
          kind: 'choice', prompt: 'Tenter de récupérer l’équipage enlevé',
          yes: {
            kind: 'test',
            test: { skill: { id: 'ragot' }, difficulty: p.gossipDifficulty, stake: enjeu('sea-embrigadement-ragot', e.id) },
            success: {
              kind: 'if',
              cond: laBourseCouvre('rancon'),
              then: { kind: 'choice', prompt: 'Payer la rançon', yes: seq(surLaBourse(negatif({ tire: 'rancon', de: en({ dice: p.ransomCO?.dice }, SOUS_PAR_CO) })), reviennent), no: enDouce },
              else: enDouce,
            },
            fail: encorePerdus,
          },
        },
      );
    }
    case 'controle-a-quai': {
      cles(['taxPct', 'bribeDifficulty', 'bribeCO']);
      if (!Number.isInteger(p.taxPct) || p.taxPct <= 0 || 100 % p.taxPct !== 0) arrets.push(`${ou} : params.taxPct « ${p.taxPct} » ne divise pas 100`);
      if (!estDifficulte(p.bribeDifficulty)) arrets.push(`${ou} : params.bribeDifficulty n'est pas une difficulté`);
      if (!estTirage(p.bribeCO)) arrets.push(`${ou} : params.bribeCO hors de la forme {dice}`);
      const saisie = surLeNavire([{ op: 'cargaison', perduePct: 100 }]);
      const droits = (de) => ({
        kind: 'if',
        cond: laBourseCouvre('droits'),
        then: { kind: 'choice', prompt: 'Payer les droits de douane', yes: surLaBourse(negatif({ tire: 'droits', ...(de ? { de: { parTranche: 100 / p.taxPct, of: { valeurCargaison: true } } } : {}) })), no: saisie },
        else: saisie,
      });
      return {
        kind: 'test',
        test: { skill: { id: 'subornation' }, difficulty: p.bribeDifficulty, stake: enjeu('sea-controle-subornation', e.id) },
        success: {
          kind: 'if',
          cond: laBourseCouvre('potDeVin'),
          then: { kind: 'choice', prompt: 'Verser le pot-de-vin', yes: surLaBourse(negatif({ tire: 'potDeVin', de: en({ dice: p.bribeCO?.dice }, SOUS_PAR_CO) })), no: droits(true) },
          else: droits(false),
        },
        fail: droits(false),
      };
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

const brut = readFileSync(SEA, 'utf8');
const sea = JSON.parse(brut);
const brutEnjeux = readFileSync(STAKES, 'utf8');
const enjeux = JSON.parse(brutEnjeux);
let gestes = 0;
if (brut !== serializeDataset(sea)) arrets.push('sea-events.json : forme non canonique');
if (brutEnjeux !== serializeDataset(enjeux)) arrets.push('stakes.json : forme non canonique');
if (!arrets.length) {
  for (const table of ['boardEvents', 'portEvents']) {
    for (const e of sea[table]?.entries ?? []) {
      if (!GENRES_MIGRES.has(e.kind)) continue;
      const genre = e.kind;
      reecrire(e, consequenceDe(e, `sea-events.json ${table} « ${e.id} »`));
      gestes++;
      if (genre === 'controle-a-quai' && !enjeux.some((x) => x.id === ENJEU_SUBORNATION.id)) {
        const apres = enjeux.findIndex((x) => x.id === 'sea-passager-clandestin');
        enjeux.splice(apres < 0 ? enjeux.length : apres + 1, 0, structuredClone(ENJEU_SUBORNATION));
        gestes++;
      }
    }
  }
  for (const x of enjeux) {
    if (x.cascade !== 'voyage' || !(x.cle in CLES_DES_ENJEUX)) continue;
    x.cle = CLES_DES_ENJEUX[x.cle];
    gestes++;
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
const outEnjeux = serializeDataset(enjeux);
if (outEnjeux !== brutEnjeux) writeFileSync(STAKES, outEnjeux, 'utf8');
console.log(`migration 1652 (bourse) : ${gestes} geste(s)${out !== brut ? ', sea-events.json réécrit' : ''}${outEnjeux !== brutEnjeux ? ', stakes.json réécrit' : ''}.`);
