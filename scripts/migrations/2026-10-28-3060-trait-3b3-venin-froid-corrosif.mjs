/**
 * Migration #3060 (lot Trait 3b-3, #1463) — le Venin pose Empoisonné, le Souffle de Froid Sonne par tranche
 * de Blessures, le Souffle corrosif et le Vomissement rongent tout l'équipement porté.
 *
 * GESTES :
 *  1. `traits.json` : la touche du Venin qui inflige des Points de Blessure pose l'État Empoisonné, à la
 *     Difficulté de son argument (LDB 85 l.425 ; LDB 16 l.70 ; AU1 04 l.24) ; une cible Immunisée au poison
 *     n'en gagne aucun (LDB 85 l.174).
 *  2. `breath-types.json` : le Froid inflige un État Sonné par tranche de 5 Blessures subies (LDB 85 l.324).
 *  3. `maneuvers.json` : le Vomissement inflige UN Dégât d'Arme de Bonus d'Endurance +4 et endommage toutes les
 *     Armures et Armes portées (LDB 85 l.447), son enjeu suit.
 *  4. `trappings.json` : la porte d'Immunité d'un Test (`unlessImmune`) devient la Condition typée de son
 *     `gate`, `has … what:'immunity'` (LDB 85 l.174) — une seule voie, celle du Venin.
 *
 * ENTRÉES : écrites — `src/data/traits.json`, `src/data/breath-types.json`, `src/data/maneuvers.json`,
 * `src/data/trappings.json` ; lue — `src/data/damage-types.json`.
 * FORME D'AVANT SEULE : chaque geste n'agit que sur la forme d'avant EXACTE qu'il reconnaît (l'entrée entière
 * pour les gestes 1 à 3), quel que soit l'ordre de ses clés ; une entrée déjà à la forme cible, ajoutée ou
 * révisée après la migration, ou absente, est laissée telle quelle.
 * FAIL-FAST — avant toute écriture, sortie 1 : un fichier hors de son formatage ; une porte d'Immunité qui ne
 * nomme pas un Type de Dégâts du registre.
 * IDEMPOTENT : rejouée sur l'état final, aucun geste n'est à faire et rien ne s'écrit.
 * FORMATAGE PRÉSERVÉ : un dataset est EXACTEMENT `JSON.stringify(doc, null, 2)` (sans saut de ligne final).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual as egal } from 'node:util';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const F = {
  traits: 'src/data/traits.json',
  breath: 'src/data/breath-types.json',
  maneuvers: 'src/data/maneuvers.json',
  trappings: 'src/data/trappings.json',
};
const TYPES_DE_DEGATS = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/damage-types.json'), 'utf8')).map((d) => d.id));

const fautes = [];
const docs = new Map();
for (const rel of Object.values(F)) {
  const texte = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const doc = JSON.parse(texte);
  if (serializeDataset(doc) !== texte) fautes.push(`${rel} : formatage non canonique`);
  docs.set(rel, { doc, avant: texte });
}
const doc = (rel) => docs.get(rel).doc;
let gestes = 0;

/** Remplace, à sa place dans `liste`, l'entrée d'id `id` qui vaut EXACTEMENT `avant` (quel que soit l'ordre de
 *  ses clés) par `apres` ; une entrée révisée ou absente est laissée telle quelle. */
const remplacer = (liste, id, avant, apres) => {
  const i = liste.findIndex((e) => e.id === id);
  if (i < 0 || !egal(liste[i], avant)) return;
  liste[i] = apres;
  gestes++;
};

// 1. traits.json
const ops = (liste) => ({ kind: 'do', effect: { type: 'ops', on: 'target', ops: liste } });
const VENIN_EFFETS_AVANT = [{
  trigger: 'onHit',
  on: 'victim',
  flow: {
    kind: 'if',
    cond: { kind: 'all', of: [
      { kind: 'woundsDealt', op: '>', value: 0 },
      { kind: 'not', of: { kind: 'compare', subject: { who: 'target', condition: 'empoisonne' }, op: '>=', value: 1 } },
    ] },
    then: {
      kind: 'test',
      test: { characteristic: 'endurance', skill: { id: 'resistance' }, difficulty: 'intermediaire', argDifficulty: true, unlessImmune: 'poison', menace: 'poison' },
      success: { kind: 'seq', steps: [] },
      fail: ops([{ op: 'condition', id: 'empoisonne' }]),
    },
  },
}];
const VENIN_EFFETS_APRES = [{
  trigger: 'onHit',
  on: 'victim',
  flow: {
    kind: 'if',
    cond: { kind: 'all', of: [
      { kind: 'woundsDealt', op: '>', value: 0 },
      { kind: 'not', of: { kind: 'has', who: 'target', what: 'immunity', value: 'poison' } },
    ] },
    then: ops([{ op: 'condition', id: 'empoisonne', argDifficulty: true }]),
  },
}];
const VENIN_AVANT = {
  id: 'venin',
  type: 'traits',
  label: 'Venin',
  specsSource: 'difficulties',
  specsOpen: true,
  desc: "Les attaques de la créature impliquent du poison ou du venin. Quand elle inflige des Points de Blessure avec ses Attaques venimeuses, son adversaire subit un État Empoisonné. Si aucune Difficulté n'est indiquée pour résister au Venin, le Test est considéré comme Intermédiaire. Voir page 168.",
  effects: VENIN_EFFETS_AVANT,
  source: { book: 'livre-de-base', page: 343 },
};
remplacer(doc(F.traits), 'venin', VENIN_AVANT, { ...VENIN_AVANT, effects: VENIN_EFFETS_APRES });

// 2. breath-types.json
const FROID_AVANT = {
  "id": "froid",
  "type": "breath-types",
  "label": "Froid",
  "source": {
    "book": "livre-de-base",
    "page": 341
  },
  "etat": "sonne"
};
remplacer(doc(F.breath), 'froid', FROID_AVANT, { ...FROID_AVANT, trancheDeBlessures: 5 });

// 3. maneuvers.json
const VOMISSEMENT_AVANT = {
  "id": "vomissement",
  "type": "maneuvers",
  "label": "Vomissement",
  "kind": "vomi",
  "activation": "free",
  "advantageCost": 3,
  "stat": "capacite-de-tir",
  "defense": "esquive",
  "targeting": "zone",
  "range": {
    "bonusOf": "endurance"
  },
  "blast": {
    "plus": 2
  },
  "effects": [
    {
      "trigger": "onHit",
      "on": "victim",
      "flow": {
        "kind": "seq",
        "steps": [
          {
            "kind": "do",
            "effect": {
              "type": "ops",
              "on": "target",
              "ops": [
                {
                  "op": "wounds",
                  "amount": {
                    "bonusOf": "endurance"
                  },
                  "ignoreTB": false,
                  "ignoreAP": false
                }
              ]
            }
          },
          {
            "kind": "do",
            "effect": {
              "type": "ops",
              "on": "target",
              "ops": [
                {
                  "op": "wounds",
                  "amount": 4,
                  "ignoreTB": false,
                  "ignoreAP": false
                }
              ]
            }
          },
          {
            "kind": "do",
            "effect": {
              "type": "ops",
              "on": "target",
              "ops": [
                {
                  "op": "condition",
                  "id": "sonne"
                }
              ]
            }
          },
          {
            "kind": "do",
            "effect": {
              "type": "ops",
              "on": "target",
              "ops": [
                {
                  "op": "damageArmour",
                  "material": "cuir"
                }
              ]
            }
          }
        ]
      }
    }
  ],
  "source": {
    "book": "livre-de-base",
    "page": 343
  },
  "stake": "Esquive — réussie : la gerbe est évitée. Ratée : Dégâts égaux au Bonus d’Endurance de l’attaquant, puis 4 Dégâts de plus (Bonus d’Endurance et PA déduits), État Sonné, et l’armure de cuir touchée est rongée.",
  "stakeForm": "descripteur"
};
const VOMISSEMENT_APRES = structuredClone(VOMISSEMENT_AVANT);
VOMISSEMENT_APRES.effects[0].flow.steps.splice(0, 2, { kind: 'do', effect: { type: 'ops', on: 'target', ops: [{ op: 'wounds', amount: { sum: [{ bonusOf: 'endurance' }, 4] }, ignoreTB: false, ignoreAP: false }] } });
VOMISSEMENT_APRES.effects[0].flow.steps[2].effect.ops = [{ op: 'damageWornGear' }];
VOMISSEMENT_APRES.stake = 'Esquive — réussie : la gerbe est évitée. Ratée : Dégâts d’Arme égaux au Bonus d’Endurance de l’attaquant +4 (Bonus d’Endurance et PA déduits), État Sonné, et toutes les Armures et Armes portées subissent 1 Dégât.';
remplacer(doc(F.maneuvers), 'vomissement', VOMISSEMENT_AVANT, VOMISSEMENT_APRES);

// 4. trappings.json
const portes = (n, chemin) => {
  if (Array.isArray(n)) { n.forEach((v, i) => portes(v, `${chemin}[${i}]`)); return; }
  if (!n || typeof n !== 'object') return;
  const test = n.kind === 'test' ? n.test : undefined;
  if (typeof test?.unlessImmune === 'string') {
    const type = test.unlessImmune;
    if (!TYPES_DE_DEGATS.has(type)) fautes.push(`${F.trappings}${chemin} : unlessImmune « ${type} » hors de damage-types.json`);
    const sauf = { kind: 'not', of: { kind: 'has', who: 'target', what: 'immunity', value: type } };
    const gate = test.gate ? { kind: 'all', of: [test.gate, sauf] } : sauf;
    const entrees = Object.entries(test).filter(([k]) => k !== 'gate').map(([k, v]) => (k === 'unlessImmune' ? ['gate', gate] : [k, v]));
    for (const k of Object.keys(test)) delete test[k];
    Object.assign(test, Object.fromEntries(entrees));
    gestes++;
  }
  for (const [k, v] of Object.entries(n)) portes(v, `${chemin}.${k}`);
};
portes(doc(F.trappings), '');

if (fautes.length) {
  console.error(`ARRÊT — rien n'est écrit :\n${fautes.join('\n')}`);
  process.exit(1);
}
for (const [rel, { doc: d, avant }] of docs) {
  const apres = serializeDataset(d);
  if (apres !== avant) fs.writeFileSync(path.join(ROOT, rel), apres);
}
console.log(`migration 3060 trait 3b-3 : ${gestes} geste(s).`);
