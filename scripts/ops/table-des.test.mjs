// L'OUTIL DE DÉS DE LA TABLE SIMULÉE (`scripts/ops/table-des.mts`). Son CONTRAT CLI — ce que le MJ agent
// lit : JSON sur stdout, erreur JSON sur stderr et code 2 — se joue par deux processus. Tout autre cas
// se joue dans UN SEUL processus `tsx`, qui appelle `tirer` en direct, et `rollTest` / `opposedTest` du
// moteur avec le même aléa pour l'égalité au moteur.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const CLI = fileURLToPath(new URL('./table-des.mts', import.meta.url));
const url = (rel) => pathToFileURL(fileURLToPath(new URL(rel, import.meta.url))).href;

const tsx = (args) => spawnSync(process.execPath, ['--import', 'tsx', ...args], { cwd: RACINE, encoding: 'utf8' });

const SIMPLE = ['simple', '--seed', 'edo01', '--tirage', '0', '--valeur', '45', '--difficulte', 'difficile'];
const OPPOSE = ['oppose', '--seed', 'edo01', '--tirage', '1', '--valeur', '45', '--difficulte', 'intermediaire',
  '--valeur-oppose', '38', '--difficulte-oppose', 'complexe'];
/** Une valeur ≥ 100 (`LDB 12 l.75`) et une valeur nulle : c'est la CIBLE que le moteur cale, jamais l'outil. */
const SIMPLE_110 = ['simple', '--seed', 'edo01', '--tirage', '0', '--valeur', '110', '--difficulte', 'tresDifficile'];
const OPPOSE_0 = ['oppose', '--seed', 'edo01', '--tirage', '2', '--valeur', '45', '--difficulte', 'difficile',
  '--valeur-oppose', '0', '--difficulte-oppose', 'facile'];
const TIRAGES = Array.from({ length: 5 }, (_, i) => ['simple', '--seed', 'edo01', '--tirage', String(i), '--valeur', '45', '--difficulte', 'intermediaire']);
const GRAINES = ['edo01', 'edo02', 'edo03', 'edo04', 'edo05'].map((seed) => ['simple', '--seed', seed, '--tirage', '0', '--valeur', '45', '--difficulte', 'intermediaire']);
const INVALIDES = {
  'difficulté par libellé': ['simple', '--seed', 's', '--tirage', '0', '--valeur', '45', '--difficulte', 'Difficile'],
  'difficulté inconnue': ['simple', '--seed', 's', '--tirage', '0', '--valeur', '45', '--difficulte', 'moyenne'],
  'valeur négative': ['simple', '--seed', 's', '--tirage', '0', '--valeur=-5', '--difficulte', 'difficile'],
  'valeur non entière': ['simple', '--seed', 's', '--tirage', '0', '--valeur', '4.5', '--difficulte', 'difficile'],
  'valeur hexadécimale': ['simple', '--seed', 's', '--tirage', '0', '--valeur', '0x10', '--difficulte', 'difficile'],
  'valeur en notation exponentielle': ['simple', '--seed', 's', '--tirage', '0', '--valeur', '1e3', '--difficulte', 'difficile'],
  'tirage hexadécimal': ['simple', '--seed', 's', '--tirage', '0x10', '--valeur', '45', '--difficulte', 'difficile'],
  'tirage en notation exponentielle': ['simple', '--seed', 's', '--tirage', '1e3', '--valeur', '45', '--difficulte', 'difficile'],
  'valeur opposée négative': ['oppose', '--seed', 's', '--tirage', '0', '--valeur', '45', '--difficulte', 'difficile', '--valeur-oppose=-5', '--difficulte-oppose', 'difficile'],
  'tirage absent': ['simple', '--seed', 's', '--valeur', '45', '--difficulte', 'difficile'],
  'seed absent': ['simple', '--tirage', '0', '--valeur', '45', '--difficulte', 'difficile'],
  'opposé sans son camp adverse': ['oppose', '--seed', 's', '--tirage', '0', '--valeur', '45', '--difficulte', 'difficile'],
  'test inconnu': ['etendu', '--seed', 's', '--tirage', '0', '--valeur', '45', '--difficulte', 'difficile'],
};

/** Chaque cas, par nom : la ligne de commande que `tirer` reçoit. */
const CAS = {
  simple: SIMPLE, oppose: OPPOSE, simple110: SIMPLE_110, oppose0: OPPOSE_0,
  ...Object.fromEntries(TIRAGES.map((argv, i) => [`tirage ${i}`, argv])),
  ...Object.fromEntries(GRAINES.map((argv) => [`graine ${argv[2]}`, argv])),
  ...Object.fromEntries(Object.entries(INVALIDES).map(([nom, argv]) => [`invalide : ${nom}`, argv])),
};

/** LE processus des cas : chaque cas joué DEUX fois par `tirer` — sa sortie JSON, ou son erreur et sa
 *  classe —, et le moteur appelé directement avec le même aléa. Joué une fois, lu par chaque test. */
let lot = null;
const lotJoue = () => {
  if (lot) return lot;
  const r = tsx(['--input-type=module', '-e', `
    const { tirer, rngDuTirage } = await import(${JSON.stringify(url('./table-des.mts'))});
    const { rollTest, opposedTest } = await import(${JSON.stringify(url('../../src/engine/tests.ts'))});
    const jouer = (argv) => {
      try { return { sortie: JSON.stringify(tirer(argv)) }; } catch (e) { return { erreur: e.message, classe: e.constructor.name }; }
    };
    const cas = ${JSON.stringify(CAS)};
    console.log(JSON.stringify({
      cas: Object.fromEntries(Object.entries(cas).map(([nom, argv]) => [nom, [jouer(argv), jouer(argv)]])),
      moteur: {
        simple: rollTest(45, 'difficile', rngDuTirage('edo01', 0)),
        oppose: opposedTest(45, 38, rngDuTirage('edo01', 1), 'intermediaire', 'complexe', { attacker: 45, defender: 38 }),
        simple110: rollTest(110, 'tresDifficile', rngDuTirage('edo01', 0)),
        oppose0: opposedTest(45, 0, rngDuTirage('edo01', 2), 'difficile', 'facile', { attacker: 45, defender: 0 }),
      },
    }));
  `]);
  assert.equal(r.status, 0, r.stderr);
  lot = JSON.parse(r.stdout);
  return lot;
};
/** La sortie de `tirer` pour un cas valide, lue en objet. */
const resultatDe = (nom) => {
  const [premier] = lotJoue().cas[nom];
  assert.ok(premier.sortie, `${nom} : ${premier.erreur}`);
  return JSON.parse(premier.sortie);
};
const VALIDES = Object.keys(CAS).filter((nom) => !nom.startsWith('invalide : '));

test('même (seed, tirage) ⇒ même sortie, octet pour octet', () => {
  for (const nom of VALIDES) {
    const [a, b] = lotJoue().cas[nom];
    assert.ok(a.sortie, `${nom} : ${a.erreur}`);
    assert.equal(a.sortie, b.sortie, nom);
  }
});

test('tirage différent ⇒ aléa différent', () => {
  const jets = TIRAGES.map((_, i) => resultatDe(`tirage ${i}`).resultat.roll);
  assert.ok(new Set(jets).size > 1, `cinq tirages, un seul jet : ${jets.join(', ')}`);
});

test('seed différent ⇒ jet différent, au même tirage', () => {
  const jets = GRAINES.map((argv) => resultatDe(`graine ${argv[2]}`).resultat.roll);
  assert.ok(new Set(jets).size > 1, `cinq graines, un seul jet : ${jets.join(', ')}`);
});

test('valeur FIGÉE : edo01, tirage 0, 45 en Difficile ⇒ 89, DR −6', () => {
  const { resultat } = resultatDe('simple');
  assert.equal(resultat.roll, 89);
  assert.equal(resultat.sl, -6);
});

test('la sortie est celle de rollTest / opposedTest appelés directement avec le même aléa — valeur ≥ 100 et valeur 0 comprises', () => {
  for (const cle of ['simple', 'oppose', 'simple110', 'oppose0']) {
    assert.deepEqual(resultatDe(cle).resultat, lotJoue().moteur[cle], cle);
  }
});

test('entrée invalide ⇒ `tirer` lève une EntreeInvalide nommée, jamais une sortie', () => {
  for (const nom of Object.keys(INVALIDES)) {
    const [a] = lotJoue().cas[`invalide : ${nom}`];
    assert.equal(a.sortie, undefined, `${nom} : sortie ${a.sortie}`);
    assert.equal(a.classe, 'EntreeInvalide', `${nom} : ${a.classe} — ${a.erreur}`);
    assert.ok(a.erreur, nom);
  }
});

test('CONTRAT CLI : JSON sur stdout, code 0 ; entrée invalide ⇒ erreur JSON sur stderr, rien sur stdout, code 2', () => {
  const valide = tsx([CLI, ...SIMPLE]);
  assert.equal(valide.status, 0, valide.stderr);
  assert.equal(valide.stderr, '');
  assert.equal(valide.stdout, `${lotJoue().cas.simple[0].sortie}\n`, 'la CLI rend ce que `tirer` rend, octet pour octet, d’un processus à l’autre');
  const invalide = tsx([CLI, ...INVALIDES['test inconnu']]);
  assert.equal(invalide.status, 2, `code ${invalide.status}, stdout ${invalide.stdout}`);
  assert.equal(invalide.stdout, '');
  assert.equal(JSON.parse(invalide.stderr).erreur, lotJoue().cas['invalide : test inconnu'][0].erreur);
});
