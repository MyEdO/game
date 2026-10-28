/**
 * Migration #1657 (« concept jet/Test : 65 lignes au stock FORMES, aucun def n'importe un schéma de
 * jet partagé ») train B2c — le coup à l'ÉQUIPAGE d'un Critique de coque rejoint le nœud `test` du Flow.
 *
 * CE QUI BOUGE, sur `river-criticals.json` et `ship-criticals.json` (mêmes rangées, même schéma
 * partagé `shipCritEntrySchema`) : la clé `crewTest {skill?, char?, difficulty?, crewTarget?, onFail}`
 * devient `crewHit {crewTarget?, test | ops}` —
 *  · le porteur garde QUI encaisse (`crewTarget`) ;
 *  · une rangée dont le livre appelle un jet porte `test`, le nœud
 *    `noeudTest(flowSchema, { difficulteRequise: true, echecSeulServi: true })`, soit
 *    `{kind:'test', test:{skill|characteristic, difficulty}, success:{kind:'seq',steps:[]},
 *    fail:{kind:'do', effect:{type:'ops', ops:<onFail>, on:'target'}}}` ;
 *  · `char` devient `characteristic` : ce n'est pas un renommage de clé, c'est la clé que porte la
 *    forme canonique `flowTestSchema` (`grammaire/mecanique.ts`) que la rangée ADOPTE — les deux
 *    fichiers en sortent avec ZÉRO `char` (aucun état mixte, cf. #1658) ;
 *  · une rangée SANS jet n'est pas une épreuve (MSRC 07 l.82, « les échardes infligent +5 Dégâts aux
 *    rameurs » — aucun Test appelé) : son `onFail` (nom menteur) devient `ops`, la liste de `GameOp`
 *    CERTAINS, même graphie que les `ops` de coque de la même rangée.
 *
 * ENTRÉES : `src/data/river-criticals.json`, `src/data/ship-criticals.json` (seules données écrites).
 *
 * PORTE DE FIDÉLITÉ (lecture SEULE, avant toute écriture) : cardinaux exigés sur l'état LU, partition
 * « avec / sans jet » RE-MESURÉE plutôt que supposée. Un `onFail` vide, une clé inattendue, un sujet
 * de jet sans `difficulty` (ou l'inverse) : la migration sort 1 sans rien écrire.
 *
 * FORME D'AVANT SEULE : sans aucun `crewTest` (la forme d'avant), les deux fichiers — migrés, ou
 * révisés depuis — sont laissés tels quels, sans porte.
 * IDEMPOTENT : rejouée sur l'état final (plus aucun `crewTest`), elle reconnaît « déjà migré »,
 * n'écrit rien et sort 0. FORMATAGE PRÉSERVÉ : chaque fichier lu est EXACTEMENT
 * `JSON.stringify(doc, null, 2)`, vérifié AVANT toute écriture ; la sortie l'est aussi.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const FICHIERS = [
  { nom: 'river-criticals.json', chemin: path.join(ROOT, 'src/data/river-criticals.json') },
  { nom: 'ship-criticals.json', chemin: path.join(ROOT, 'src/data/ship-criticals.json') },
];

/**
 * CARDINAUX attendus sur l'état AVANT — mesurés sur l'arbre `1e14c9922` (2026-09-02), RECALÉS le
 * 2026-09-04 sur l'arbre courant. Ce script n'est pas qu'un rejeu : `migration-b2c-fidelite.test.ts`
 * s'en sert comme ORACLE, en dé-migrant l'arbre COMMITTÉ pour lui redonner sa pré-image. Ses cardinaux
 * suivent donc l'arbre : la migration B3-2b-a (#1657) y a ajouté 1 coup fluvial (`gouvernail-fluvial`,
 * MSRC 07 l.86) et 6 coups MDG (4 `pont`, 2 `avirons`), et B3-2b-c les 5 rangées du GRÉEMENT
 * (MDG 13 l.711/l.714/l.715/l.717/l.718, « sous peine de tomber »).
 */
const CARDINAUX = {
  'river-criticals.json': { tables: 5, rangees: 5, crewTest: 4, epreuves: 2, certains: 2, crewTarget: 4, ops: 5, char: 2, skill: 0 },
  'ship-criticals.json': { tables: 5, rangees: 35, crewTest: 12, epreuves: 12, certains: 0, crewTarget: 12, ops: 12, char: 0, skill: 12 },
};

const CLES_CREWTEST = ['skill', 'char', 'difficulty', 'crewTarget', 'onFail'];

const echecs = [];

const lire = ({ nom, chemin }) => {
  const brut = fs.readFileSync(chemin, 'utf8');
  const doc = JSON.parse(brut);
  if (serializeDataset(doc) !== brut) {
    echecs.push(`${nom} : FORME NON CANONIQUE (pas JSON.stringify(doc, null, 2))`);
    return null;
  }
  if (!doc.tables || typeof doc.tables !== 'object') {
    echecs.push(`${nom} : pas de bloc « tables »`);
    return null;
  }
  return doc;
};

const docs = FICHIERS.map((f) => ({ ...f, doc: lire(f) }));
if (echecs.length) {
  console.error(`ARBITRAGE REQUIS — ${echecs.length} anomalie(s) :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

/** Toutes les rangées d'un document, à plat (les tables sont indexées par Localisation). */
const rangeesDe = (doc) => Object.values(doc.tables).flat();

// ---- REJEU : plus aucune rangée ne décrit son coup à l'équipage en propre.
{
  const dejaMigre = docs.every(({ doc }) => rangeesDe(doc).every((e) => e.crewTest === undefined));
  if (dejaMigre) {
    console.log('river-criticals.json + ship-criticals.json : no-op (aucun crewTest)');
    process.exit(0);
  }
}

// ---- PORTE DE FIDÉLITÉ : lecture SEULE.
{
  const ecarts = [];
  for (const { nom, doc } of docs) {
    const attendu = CARDINAUX[nom];
    const rangees = rangeesDe(doc);
    const cts = rangees.map((e) => e.crewTest).filter(Boolean);
    const mesure = {
      tables: Object.keys(doc.tables).length,
      rangees: rangees.length,
      crewTest: cts.length,
      epreuves: cts.filter((c) => c.difficulty !== undefined).length,
      certains: cts.filter((c) => c.difficulty === undefined).length,
      crewTarget: cts.filter((c) => c.crewTarget !== undefined).length,
      ops: cts.reduce((n, c) => n + (Array.isArray(c.onFail) ? c.onFail.length : 0), 0),
      char: cts.filter((c) => c.char !== undefined).length,
      skill: cts.filter((c) => c.skill !== undefined).length,
    };
    for (const cle of Object.keys(attendu)) {
      if (mesure[cle] !== attendu[cle]) ecarts.push(`${nom} ${cle} : ${mesure[cle]} != ${attendu[cle]}`);
    }
    for (const e of rangees) {
      const c = e.crewTest;
      if (!c) continue;
      if (!Array.isArray(c.onFail) || c.onFail.length === 0) ecarts.push(`${nom}/${e.id} : crewTest.onFail absent ou vide`);
      const sujet = c.skill !== undefined || c.char !== undefined;
      if (sujet !== (c.difficulty !== undefined)) {
        ecarts.push(`${nom}/${e.id} : sujet de jet (${sujet}) et difficulty (${c.difficulty !== undefined}) DISCORDANTS — le lecteur ne roulait qu'avec les deux`);
      }
      if (c.skill !== undefined && c.char !== undefined) ecarts.push(`${nom}/${e.id} : crewTest porte skill ET char`);
      for (const k of Object.keys(c)) {
        if (!CLES_CREWTEST.includes(k)) ecarts.push(`${nom}/${e.id} : cle INATTENDUE sur crewTest « ${k} »`);
      }
    }
  }
  if (ecarts.length) {
    console.error(`FIDELITE ROMPUE — rien n'est ecrit (${ecarts.length}) :`);
    for (const m of ecarts) console.error(`  ${m}`);
    process.exit(1);
  }
}

/** Nœud `test` du Flow — branche `success` VIDE explicite (le socle `Flow` l'exige des deux côtés). */
const noeud = (c) => ({
  kind: 'test',
  test: {
    ...(c.skill !== undefined ? { skill: c.skill } : {}),
    ...(c.char !== undefined ? { characteristic: c.char } : {}),
    difficulty: c.difficulty,
  },
  success: { kind: 'seq', steps: [] },
  fail: { kind: 'do', effect: { type: 'ops', ops: c.onFail, on: 'target' } },
});

/** `crewHit` : QUI d'abord (le porteur), puis l'ISSUE — épreuve ou ops certaines. */
const coup = (c) => ({
  ...(c.crewTarget !== undefined ? { crewTarget: c.crewTarget } : {}),
  ...(c.difficulty === undefined ? { ops: c.onFail } : { test: noeud(c) }),
});

/** Réécrit une rangée en PRÉSERVANT l'ordre de ses clés : `crewTest` cède sa place à `crewHit`. */
const reecrire = (entree) => {
  const out = {};
  for (const [k, v] of Object.entries(entree)) {
    if (k === 'crewTest') out.crewHit = coup(v);
    else out[k] = v;
  }
  return out;
};

for (const { doc } of docs) {
  for (const [loc, table] of Object.entries(doc.tables)) {
    doc.tables[loc] = table.map((e) => (e.crewTest ? reecrire(e) : e));
  }
}

for (const { chemin, doc } of docs) fs.writeFileSync(chemin, serializeDataset(doc), 'utf8');

// ---- PREUVE post-écriture, sur le RÉSULTAT relu.
{
  const horsForme = (n) =>
    n.kind !== 'test' ||
    n.success?.kind !== 'seq' ||
    n.success.steps.length !== 0 ||
    n.fail?.kind !== 'do' ||
    n.fail.effect?.type !== 'ops' ||
    n.fail.effect.on !== 'target' ||
    !Array.isArray(n.fail.effect.ops) ||
    n.fail.effect.ops.length === 0 ||
    n.test.difficulty === undefined;
  for (const { nom, chemin } of FICHIERS) {
    const attendu = CARDINAUX[nom];
    const relu = JSON.parse(fs.readFileSync(chemin, 'utf8'));
    const rangees = rangeesDe(relu);
    const coups = rangees.map((e) => e.crewHit).filter(Boolean);
    const noeuds = coups.map((c) => c.test).filter(Boolean);
    const brut = JSON.stringify(relu);
    const mesure = {
      rangees: rangees.length,
      crewHit: coups.length,
      epreuves: noeuds.length,
      certains: coups.filter((c) => c.ops).length,
      crewTarget: coups.filter((c) => c.crewTarget !== undefined).length,
      coupsDesDeux: coups.filter((c) => c.test && c.ops).length,
      coupsDAucun: coups.filter((c) => !c.test && !c.ops).length,
      noeudsHorsForme: noeuds.filter(horsForme).length,
      characteristic: noeuds.filter((n) => n.test.characteristic !== undefined).length,
      skill: noeuds.filter((n) => n.test.skill !== undefined).length,
      ops: coups.reduce((n, c) => n + (c.ops?.length ?? 0) + (c.test?.fail.effect.ops.length ?? 0), 0),
      crewTestResiduel: (brut.match(/"crewTest"/g) ?? []).length,
      charResiduel: (brut.match(/"char"/g) ?? []).length,
      onFailResiduel: (brut.match(/"onFail"/g) ?? []).length,
    };
    const exige = (cle, valeur) => {
      if (mesure[cle] !== valeur) echecs.push(`POST ${nom} ${cle} : ${mesure[cle]} != ${valeur}`);
    };
    exige('rangees', attendu.rangees);
    exige('crewHit', attendu.crewTest);
    exige('epreuves', attendu.epreuves);
    exige('certains', attendu.certains);
    exige('crewTarget', attendu.crewTarget);
    exige('ops', attendu.ops);
    exige('characteristic', attendu.char);
    exige('skill', attendu.skill);
    exige('coupsDesDeux', 0);
    exige('coupsDAucun', 0);
    exige('noeudsHorsForme', 0);
    exige('crewTestResiduel', 0);
    exige('charResiduel', 0);
    exige('onFailResiduel', 0);
  }
}

if (echecs.length) {
  console.error(`ARBITRAGE REQUIS — ${echecs.length} anomalie(s) :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

for (const { nom } of FICHIERS) {
  const c = CARDINAUX[nom];
  console.log(
    `${nom} : ${c.crewTest} crewTest -> crewHit · ${c.epreuves} noeud(s) test · ${c.certains} effet(s) certain(s) (ops) · ` +
      `${c.crewTarget} crewTarget preserve(s) au porteur · ${c.char} char -> characteristic`,
  );
}
