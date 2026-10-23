/**
 * BANC DU MUR « ÉTAT DE MODULE » (#2907) : le moteur, le noyau, les données et les scénarios ne gardent aucun état de
 * module qui fabrique un id d'une partie à l'autre (`murs/etat-de-module`, `scripts/guards/lib/etatDeModuleLint.mjs`),
 * `fabriqueEnSequence` ne s'importe que sous `src/hote` et dans un kit de test (`murs/fabrique-import`), le compte d'une
 * sonde ne se lit que dans un test (`murs/sonde-lecture`). Le banc lance les murs sur la config RÉELLE, toutes fixtures
 * en un seul passage, sélectionne par `ruleId`, et tient l'inventaire des fabriques à fermeture de `src/`.
 * ANGLES MORTS (ceux du mur) : l'alias pris dans une fonction, le compte derrière une fonction du module, la méthode qui
 * mute, une fabrique d'une forme que `estFabriqueAFermeture` ne reconnaît pas.
 */
import { describe, it, expect } from 'vitest';
import { parseSync } from 'rolldown/utils';
import { lintFixtures, selectionnerMessages } from '../scripts/guards/lib/lint.testkit.mjs';
import { readCorpus } from '../scripts/guards/lib/sourceCorpus.mjs';
import { estKitDeTest } from '../scripts/guards/lib/fichierVitest.mjs';
import { estFabriqueAFermeture, fonctionsDePremierNiveau, FABRIQUES_A_FERMETURE, FABRIQUES_ADMISES } from '../scripts/guards/lib/etatDeModuleLint.mjs';

const MUR = 'murs/etat-de-module';

const REFUSES: [nom: string, code: string][] = [
  ['`let` numérique incrémenté', 'let n = 0;\nexport const f = () => ++n;\n'],
  ['`let` numérique exporté', 'export let n = 1;\n'],
  ['`let` négatif', 'let n = -1;\nexport const f = () => n;\n'],
  ['`++` sur un membre d’objet de module', 'const S = { n: 0 };\nexport const f = () => { S.n++; };\n'],
  ['`+=` sur un membre d’objet de module', 'export const S = { vus: 0 };\nexport function f(): void { S.vus += 1; }\n'],
  ['`-=` sur un élément indexé de module', 'const T = [0];\nexport const f = (i: number) => { T[i] -= 1; };\n'],
  ['`x = x + 1` qui se reprend', 'const S = { n: 0 };\nexport const f = () => { S.n = S.n + 1; };\n'],
  ['`x = 1 + x` qui se reprend', 'const S = { n: 0 };\nexport const f = () => { S.n = 1 + S.n; };\n'],
  ['un global non déclaré', 'export const f = () => { compteGlobal++; };\n'],
  ['un alias de premier niveau', 'const ETAT = { n: 0 };\nconst o = ETAT;\nexport const newUid = (): string => `it-${++o.n}`;\n'],
  ['`fabriqueEnSequence` évaluée au module', "import { fabriqueEnSequence } from '../lib/entityId';\nconst prochain = fabriqueEnSequence();\nexport const newUid = (): string => prochain('it');\n"],
  ['une sonde dont le compte fait un id', "import { sonde } from '../lib/sonde';\nconst S = sonde();\nexport const newUid = (): string => { S.passer(); return `it-${S.passages()}`; };\n"],
  ['une sonde lue par `passagesDe`', "import { sonde, passagesDe } from '../lib/sonde';\nexport const S = sonde();\nexport const newUid = (): string => `it-${passagesDe(S)}`;\n"],
  ['une sonde relayée', "import { sonde } from '../lib/sonde';\nconst S = sonde();\nexport const T = S;\n"],
  ['une sonde dans un objet', "import { sonde } from '../lib/sonde';\nexport const O = { vues: sonde() };\n"],
  ['un RNG de module', "import { makeRNG } from './dice';\nconst R = makeRNG(1);\nexport const newUid = (): string => `it-${R.int(1, 1e9)}`;\n"],
  ['une fabrique renommée', "import { makeRNG as m } from './dice';\nconst R = m(1);\nexport const g = () => R;\n"],
  ['une fabrique par espace de noms', "import * as D from './dice';\nconst R = D.makeRNG(1);\nexport const g = () => R;\n"],
  ['une fabrique dans une IIFE', "import { makeRNG } from './dice';\nconst R = (() => makeRNG(1))();\nexport const g = () => R;\n"],
  ['une fabrique du fichier même', 'function f() { let n = 0; return () => ++n; }\nconst p = f();\nexport const newUid = (): string => `it-${p()}`;\n'],
  ['le produit d’un mémo muté', "import { memoParVersion } from '../data/versionDataset';\nconst M = memoParVersion('traits', () => ({ n: 0 }));\nexport const newUid = (): string => `it-${++M().n}`;\n"],
];

const PERMIS: [nom: string, code: string][] = [
  ['un compte local', 'export const f = () => { let n = 0; n++; n += 2; return n; };\n'],
  ['un compte en fermeture', 'export function fabrique() { let n = 0; return () => ++n; }\n'],
  ['un paramètre muté', 'export const f = (o: { n: number }) => { o.n++; o.n += 1; };\n'],
  ['une boucle de premier niveau', 'const L: number[] = [];\nfor (let i = 0; i < 3; i++) L.push(i);\nexport { L };\n'],
  ['une affectation logique (mémo)', 'let memo: number[] | undefined;\nexport const f = () => (memo ??= [1]);\n'],
  ['un `let` non numérique', 'let etat: string | null = null;\nexport const f = (s: string) => { etat = s; return etat; };\n'],
  ['une `const` numérique', 'export const N = 3;\n'],
  ['une variable locale homonyme d’un module', 'const n = 0;\nexport const f = () => { let n2 = n; n2++; return n2; };\n'],
  ['une sonde qui ne fait que passer', "import { sonde } from '../lib/sonde';\nexport const S = sonde();\nexport const f = () => { S.passer(); };\n"],
  ['une fabrique appelée dans sa fonction', "import { makeRNG } from './dice';\nexport const f = (g: number) => makeRNG(g).next();\n"],
  ['un mémo pur de module', "import { memoParVersion } from '../data/versionDataset';\nconst M = memoParVersion('traits', () => [1]);\nexport const f = () => M();\n"],
];

const SOUS_LE_MUR = ['src/engine', 'src/noyau', 'src/noyau/monde', 'src/data', 'src/scenes'];
const HORS_DU_MUR = ['src/state', 'src/ui', 'src/engine/__x.test', 'src/noyau/__x.testkit'];

type Cas = { fichier: string; nom: string; code: string };
const cas = (racines: string[], liste: [string, string][], suffixe: string): Cas[] =>
  racines.flatMap((r, i) => liste.map(([nom, code], j) => ({ fichier: `${r}/__sonde-etat-${i}-${j}${suffixe}.ts`, nom, code })));

const refuses = cas(SOUS_LE_MUR, REFUSES, '');
const permis = cas(SOUS_LE_MUR, PERMIS, '-permis');
const horsDuMur = HORS_DU_MUR.flatMap((r, i) => REFUSES.map(([nom, code], j) => ({ fichier: `${r.includes('__x') ? r.replace('__x', `__sonde-etat-${i}-${j}`) : `${r}/__sonde-etat-${i}-${j}`}.ts`, nom, code })));

/** Les murs d'import : `[fichier, code, règle, refusé ?]`. */
const IMPORTS: [fichier: string, code: string, regle: string, refuse: boolean][] = [
  ['src/ui/__imp-seq.ts', "import { fabriqueEnSequence } from '../lib/entityId';\nexport const f = () => fabriqueEnSequence();\n", 'murs/fabrique-import', true],
  ['src/noyau/__imp-seq-ext.ts', "import { fabriqueEnSequence } from '../lib/entityId.ts';\nexport const f = () => fabriqueEnSequence();\n", 'murs/fabrique-import', true],
  ['src/state/__imp-seq-ns.ts', "import * as E from '../lib/entityId';\nexport const f = () => E.fabriqueEnSequence();\n", 'murs/fabrique-import', true],
  ['src/lib/__imp-seq-relai.ts', "export { fabriqueEnSequence } from './entityId';\n", 'murs/fabrique-import', true],
  ['src/state/__imp-seq.test.ts', "import { fabriqueEnSequence } from '../lib/entityId';\nexport const f = () => fabriqueEnSequence();\n", 'murs/fabrique-import', true],
  ['src/hote/__imp-seq.ts', "import { fabriqueEnSequence } from '../lib/entityId';\nexport const f = () => fabriqueEnSequence();\n", 'murs/fabrique-import', false],
  ['src/lib/__imp-seq.testkit.ts', "import { fabriqueEnSequence } from './entityId';\nexport const f = () => fabriqueEnSequence();\n", 'murs/fabrique-import', false],
  ['src/ui/__imp-id.ts', "import { nextEntityId } from '../lib/entityId';\nexport const f = () => nextEntityId('x', []);\n", 'murs/fabrique-import', false],
  ['src/ui/__imp-passages.ts', "import { passagesDe, type Sonde } from '../lib/sonde';\nexport const f = (s: Sonde) => passagesDe(s);\n", 'murs/sonde-lecture', true],
  ['src/engine/__imp-passages-ns.ts', "import * as S from '../lib/sonde';\nexport const f = (s: S.Sonde) => S.passagesDe(s);\n", 'murs/sonde-lecture', true],
  ['src/ui/__imp-passages.test.ts', "import { passagesDe, type Sonde } from '../lib/sonde';\nexport const f = (s: Sonde) => passagesDe(s);\n", 'murs/sonde-lecture', false],
  ['src/ui/__imp-sonde.ts', "import { sonde } from '../lib/sonde';\nexport const S = sonde();\n", 'murs/sonde-lecture', false],
];

const tous = [...refuses, ...permis, ...horsDuMur, ...IMPORTS.map(([fichier, code]) => ({ fichier, nom: '', code }))];
const resultats = new Map<string, (regle: string) => number>();
for (const r of lintFixtures(tous.map(({ fichier, code }) => ({ filePath: fichier, code })))) {
  resultats.set(r.filePath.split('\\').join('/').replace(/^.*?(?=src\/)/, ''), (regle) => selectionnerMessages(r, (m) => m.ruleId === regle).length);
}
const compte = (fichier: string, regle = MUR): number | undefined => resultats.get(fichier)?.(regle);

describe('mur « état de module » — aucun état de module qui fabrique un id dans le moteur, le noyau, les données, les scénarios (#2907)', () => {
  it('chaque fixture a son verdict', () => {
    expect(resultats.size).toBe(tous.length);
  });
  for (const { fichier, nom } of refuses) {
    it(`${fichier} : ${nom} est refusé`, () => { expect(compte(fichier)).toBeGreaterThan(0); });
  }
  for (const { fichier, nom } of permis) {
    it(`${fichier} : ${nom} passe`, () => { expect(compte(fichier)).toBe(0); });
  }
  for (const { fichier, nom } of horsDuMur) {
    it(`${fichier} : ${nom} passe hors du mur`, () => { expect(compte(fichier)).toBe(0); });
  }
});

describe('murs d’import de la fabrique en séquence et du compte de sonde (#2907)', () => {
  for (const [fichier, , regle, refuse] of IMPORTS) {
    it(`${fichier} : ${regle} ${refuse ? 'refuse' : 'laisse passer'}`, () => {
      if (refuse) expect(compte(fichier, regle)).toBeGreaterThan(0);
      else expect(compte(fichier, regle)).toBe(0);
    });
  }
});

describe('inventaire des fabriques à fermeture de src/ (#2907)', () => {
  it('`FABRIQUES_A_FERMETURE` est exactement l’ensemble des fabriques à fermeture des sources, et chaque admise y figure', () => {
    const trouvees = new Set<string>();
    for (const { rel, text } of readCorpus(['src'])) {
      if (estKitDeTest(rel)) continue;
      const { program, errors } = parseSync(rel, text);
      if (errors.length) throw new Error(`${rel} : ${errors.map((e) => e.message).join('; ')}`);
      for (const [nom, decl, fn] of fonctionsDePremierNiveau(program)) if (decl && estFabriqueAFermeture(fn)) trouvees.add(nom);
    }
    expect([...trouvees].sort(), 'une fabrique à fermeture s’inscrit dans FABRIQUES_A_FERMETURE (scripts/guards/lib/etatDeModuleLint.mjs)').toEqual([...FABRIQUES_A_FERMETURE].sort());
    expect(Object.keys(FABRIQUES_ADMISES).filter((n) => !FABRIQUES_A_FERMETURE.includes(n))).toEqual([]);
  });
});
