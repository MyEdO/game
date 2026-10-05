import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCorpus } from '../scripts/guards/lib/sourceCorpus.mjs';
import { clotureDImports, estModule } from '../scripts/guards/lib/importGraph.mjs';
import { fichiersDeLaSuite } from '../scripts/guards/lib/suiteVitest.mjs';
import { analyserCorpus } from '../scripts/guards/lib/dialecte.mjs';
import { fabriquesDuCorpus, retentionsDAnalyse } from '../scripts/guards/lib/analyseRetenue.mjs';

/**
 * Garde de classe #1801 — aucun module que la suite charge ne range une structure d'ANALYSE
 * (`ts.Program`, `ts.SourceFile`, ce qui en dérive) ou un DÉRIVÉ de corpus dans une liaison de portée
 * de COLLECTION (module, rappel de `describe`, IIFE qui l'initialise) sans la libérer. Invariant :
 * `SessionProgramme.dispose` de `scripts/guards/lib/tsProgram.mjs` ; détection et angles morts : en-tête de
 * `scripts/guards/lib/analyseRetenue.mjs`.
 *
 * PÉRIMÈTRE : la clôture d'imports des fichiers de la suite (`fichiersDeLaSuite`, `clotureDImports`).
 * Un script que nul test n'importe n'est pas chargé par la suite : il en sort par construction.
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const scan = (fichiers: Record<string, string>) => {
  const corpus = Object.entries(fichiers).map(([rel, text]) => ({ rel, text }));
  const exportees = fabriquesDuCorpus(corpus);
  const retentions: ReturnType<typeof retentionsDAnalyse> = [];
  for (const { fichier: { rel, text }, sourceFile, checker } of analyserCorpus(corpus)) {
    retentions.push(...retentionsDAnalyse(rel, text, exportees, sourceFile!, checker));
  }
  return retentions;
};
const liaisons = (fichiers: Record<string, string>) => scan(fichiers).map((r) => `${r.rel}#${r.liaison} ${r.forme}`);

// #1801
const ANCIEN_MEMO = `import { repoProgram } from './tsProgram.mjs';
const PROGRAM_CACHE = new Map();
export function programmeMemoise(root) {
  const hit = PROGRAM_CACHE.get(root);
  if (hit) return hit;
  const program = repoProgram(root, (f) => f);
  PROGRAM_CACHE.set(root, program);
  return program;
}
`;

// #1801
const ANCIEN_CACHE_D_ARBRES = `import ts from 'typescript';
import { readFileSync } from 'node:fs';
const sourceFileCache = new Map();
function sourceFileFor(absPath) {
  let sf = sourceFileCache.get(absPath);
  if (sf) return sf;
  sf = ts.createSourceFile(absPath, readFileSync(absPath, 'utf8'), ts.ScriptTarget.Latest, true);
  sourceFileCache.set(absPath, sf);
  return sf;
}
export const params = (p) => sourceFileFor(p).statements.length;
`;

/** TÉMOIN VERT : le Program du fichier de test tenu en `beforeAll` et libéré en `afterAll`. */
const DETENTEUR_LIBERE = `import { beforeAll, afterAll, describe, it } from 'vitest';
import { programmeDuPerimetre } from '../scripts/guards/lib/perimetre.mjs';
let programme;
beforeAll(() => { programme = programmeDuPerimetre('.'); });
afterAll(() => { programme.dispose(); programme = undefined; });
describe('d', () => {
  let local;
  const paresseux = () => (local ??= programmeDuPerimetre('.'));
  afterAll(() => { local.dispose(); local = undefined; });
  it('x', () => { paresseux(); programme.getTypeChecker(); });
});
`;
const PERIMETRE = `import { repoProgram } from './tsProgram.mjs';
export function programmeDuPerimetre(root) {
  return repoProgram(root, (f) => f);
}
`;

/** TÉMOIN VERT : l'arbre tenu par l'APPELANT — la lib range dans la carte qu'on lui passe, le fichier
 *  de test qui la partage entre ses cas la vide en `afterAll`. */
const LIB_A_CARTE = `import ts from 'typescript';
export function arbreDe(file, arbres = new Map()) {
  let sf = arbres.get(file);
  if (!sf) arbres.set(file, (sf = ts.createSourceFile(file.rel, file.text, ts.ScriptTarget.Latest, true)));
  return sf;
}
`;
const APPELANT_A_CARTE = `import { afterAll, it } from 'vitest';
import { arbreDe } from '../scripts/guards/lib/carte.mjs';
const arbres = new Map();
afterAll(() => { arbres.clear(); });
const sfs = new Map();
afterAll(() => { sfs.clear(); });
it('x', () => { sfs.set('a', arbreDe({ rel: 'a.ts', text: '' }, arbres)); });
`;

describe('garde de classe #1801 — une structure d’analyse ne vit pas en portée de collection', () => {
  it('le corpus vide rend un index vide et les fabriques transitives sont calculées pendant l’emprunt', () => {
    expect(fabriquesDuCorpus([])).toEqual({ fabriques: new Set(), corpus: new Set(), ressources: new Map() });
    const fichiers = [
      { rel: 'scripts/guards/lib/troisieme.mjs', text: `import { seconde } from './seconde.mjs'; export const troisieme = () => seconde();` },
      { rel: 'scripts/guards/lib/seconde.mjs', text: `import { premiere } from './premiere.mjs'; export const seconde = () => premiere();` },
      { rel: 'scripts/guards/lib/premiere.mjs', text: `import { virtualProgram } from './tsProgram.mjs'; export const premiere = () => virtualProgram({});` },
    ];
    const exportees = fabriquesDuCorpus(fichiers);
    expect([...exportees.fabriques].sort()).toEqual(['premiere', 'seconde', 'troisieme']);
    expect([...exportees.ressources.entries()].sort()).toEqual([
      ['scripts/guards/lib/premiere.mjs#premiere', 'dispose'],
      ['scripts/guards/lib/seconde.mjs#seconde', 'dispose'],
      ['scripts/guards/lib/troisieme.mjs#troisieme', 'dispose'],
    ]);
  });

  it('une ressource native exige une fermeture exécutée et issue de sa provenance', () => {
    const base = `import { beforeAll, afterAll } from 'vitest'; import { virtualProgram, libererSessions as fermer } from '../scripts/guards/lib/tsProgram.mjs';`;
    for (const fermeture of ['session=undefined', 'if(false) session.dispose(); session=undefined', 'const tard=()=>session.dispose(); session=undefined', 'return; session.dispose()']) {
      expect(liaisons({ 'src/resource.test.ts': `${base} let session; beforeAll(()=>session=virtualProgram({})); afterAll(()=>{${fermeture}});` })).toEqual(['src/resource.test.ts#session affectée']);
    }
    expect(liaisons({ 'src/resource.test.ts': `${base} let session; beforeAll(()=>session=virtualProgram({})); afterAll(()=>session.dispose());` })).toEqual([]);
    expect(liaisons({ 'src/resource.test.ts': `import { API as Metier } from './metier'; const instance=new Metier();` })).toEqual([]);
    expect(liaisons({ 'src/resource.test.ts': `import { API } from 'typescript/unstable/sync'; let Native; Native=API; const instance=new Native();` })).toEqual(['src/resource.test.ts#instance initialisée']);
    expect(liaisons({ 'src/resource.test.ts': `${base} const sessions=new Map(); beforeAll(()=>sessions.set('a',virtualProgram({}))); afterAll(()=>{try{fermer(sessions.values());}finally{sessions.clear();}});` })).toEqual([]);
    expect(liaisons({ 'src/resource.test.ts': `${base} const sessions=new Map(); beforeAll(()=>sessions.set('a',virtualProgram({}))); afterAll(()=>sessions.clear());` })).toEqual(['src/resource.test.ts#sessions .set(']);
    expect(liaisons({ 'src/resource.test.ts': `${base} const sessions=[virtualProgram({})]; afterAll(()=>{try{fermer(sessions);}finally{sessions.length=0;}});` })).toEqual([]);
    expect(liaisons({ 'src/resource.test.ts': `${base} const sessions=[virtualProgram({})]; afterAll(()=>fermer(sessions));` })).toEqual(['src/resource.test.ts#sessions initialisée']);
    const outil = `import { virtualProgram } from './tsProgram.mjs'; export function creer(){return virtualProgram({});}`;
    expect(liaisons({ 'scripts/guards/lib/outil-virtuel.mjs': outil, 'src/resource.test.ts': `import {beforeAll,afterAll} from 'vitest'; import {creer as faire} from '../scripts/guards/lib/outil-virtuel.mjs'; let s; beforeAll(()=>s=faire()); afterAll(()=>s=undefined);` })).toEqual(['src/resource.test.ts#s affectée']);
    expect(liaisons({ 'src/resource.test.ts': `${base} import {API} from 'typescript/unstable/sync'; const s=flag?new API():virtualProgram({}); afterAll(()=>s.mixte());` })).toEqual(['src/resource.test.ts#s initialisée']);
  });

  it('syntaxProgram conserve sa qualité de session possédée et exige dispose', () => {
    const base = `import { beforeAll, afterAll } from 'vitest'; import { syntaxProgram } from '../scripts/guards/lib/tsProgram.mjs';`;
    expect(liaisons({ 'src/syntax.test.ts': `${base} const session=syntaxProgram({});` })).toEqual(['src/syntax.test.ts#session initialisée']);
    expect(liaisons({ 'src/syntax.test.ts': `${base} let session; beforeAll(()=>session=syntaxProgram({})); afterAll(()=>session=undefined);` })).toEqual(['src/syntax.test.ts#session affectée']);
    expect(liaisons({ 'src/syntax.test.ts': `${base} let session; beforeAll(()=>session=syntaxProgram({})); afterAll(()=>{try{utiliser(session.program)}finally{session.dispose()}});` })).toEqual([]);
    const detention = `import { syntaxProgram } from '../scripts/guards/lib/tsProgram.mjs'; import { detenteur } from './detenteur.testkit';`;
    expect(liaisons({ 'src/syntax.test.ts': `${detention} const lire=detenteur(()=>syntaxProgram({}));` })).toEqual(['src/syntax.test.ts#lire initialisée']);
    expect(liaisons({ 'src/syntax.test.ts': `${detention} const lire=detenteur(()=>syntaxProgram({}),s=>s.dispose());` })).toEqual([]);
    expect(liaisons({ 'src/syntax.test.ts': `${base} export function lire(session){const program=session.program; return program}` })).toEqual([]);
  });

  it('un détenteur de session native exige un libérateur effectif', () => {
    const base = `import { virtualProgram } from '../scripts/guards/lib/tsProgram.mjs'; import { detenteur } from './detenteur.testkit';`;
    for (const liberateur of ['', ',s=>{}', ',s=>{if(false)s.dispose()}', ',s=>{return;s.dispose()}']) {
      expect(liaisons({ 'src/resource.test.ts': `${base} const lire=detenteur(()=>virtualProgram({})${liberateur});` })).toEqual(['src/resource.test.ts#lire initialisée']);
    }
    expect(liaisons({ 'src/resource.test.ts': `${base} const lire=detenteur(()=>virtualProgram({}),s=>s.dispose());` })).toEqual([]);
  });

  it('les fabriques nommées et les returns propres conservent la qualité de ressource active', { timeout: 30_000 }, () => {
    const base = `import {virtualProgram} from '../scripts/guards/lib/tsProgram.mjs'; import {detenteur} from './detenteur.testkit';`;
    for (const fabrique of [
      `function creer(){return virtualProgram({})}`,
      `const creer=()=>virtualProgram({});`,
      `function original(){return virtualProgram({})} const creer=original;`,
      `function creer(){if(true)return virtualProgram({})}`,
      `function creer(){try{return virtualProgram({})}finally{}}`,
      `const creer=()=>flag?virtualProgram({}):undefined;`,
    ]) {
      for (const liberateur of ['', ',s=>{}']) expect(liaisons({ 'src/resource.test.ts': `${base}${fabrique} const lire=detenteur(creer${liberateur});` })).toEqual(['src/resource.test.ts#lire initialisée']);
      expect(liaisons({ 'src/resource.test.ts': `${base}${fabrique} const lire=detenteur(creer,s=>s.dispose());` })).toEqual([]);
    }
    for (const liberateur of ['', ',s=>{}']) expect(liaisons({
      'scripts/guards/lib/creer-virtuel.mjs': `import {virtualProgram} from './tsProgram.mjs'; export function creer(){return virtualProgram({})}`,
      'src/resource.test.ts': `import {detenteur} from './detenteur.testkit'; import {creer as faire} from '../scripts/guards/lib/creer-virtuel.mjs'; const lire=detenteur(faire${liberateur});`,
    })).toEqual(['src/resource.test.ts#lire initialisée']);
    expect(liaisons({
      'scripts/guards/lib/creer-virtuel.mjs': `import {virtualProgram} from './tsProgram.mjs'; export function creer(){return virtualProgram({})}`,
      'src/resource.test.ts': `import {detenteur} from './detenteur.testkit'; import {creer as faire} from '../scripts/guards/lib/creer-virtuel.mjs'; const lire=detenteur(faire,s=>s.dispose());`,
    })).toEqual([]);
    for (const corps of ['if(true)return virtualProgram({})', 'try{return virtualProgram({})}finally{}']) {
      expect(liaisons({ 'src/resource.test.ts': `${base} const lire=detenteur(()=>{${corps}});` })).toEqual(['src/resource.test.ts#lire initialisée']);
    }
    for (const liberateur of ['', ',s=>s.dispose()', ',s=>s.close()', ',s=>s.mixte()']) {
      expect(liaisons({ 'src/resource.test.ts': `${base} import {API} from 'typescript/unstable/sync'; function creer(){if(true)return virtualProgram({}); return new API()} const lire=detenteur(creer${liberateur});` })).toEqual(['src/resource.test.ts#lire initialisée']);
      expect(liaisons({ 'src/resource.test.ts': `${base} import {API} from 'typescript/unstable/sync'; const creer=()=>flag?new API():virtualProgram({}); const lire=detenteur(creer${liberateur});` })).toEqual(['src/resource.test.ts#lire initialisée']);
      for (const expression of ['flag && new API() || virtualProgram({})', 'flag && virtualProgram({}) || new API()']) {
        expect(liaisons({ 'src/resource.test.ts': `${base} import {API} from 'typescript/unstable/sync'; const creer=()=>${expression}; const lire=detenteur(creer${liberateur});` })).toEqual(['src/resource.test.ts#lire initialisée']);
        expect(liaisons({ 'src/resource.test.ts': `${base} import {API} from 'typescript/unstable/sync'; const lire=detenteur(()=>${expression}${liberateur});` })).toEqual(['src/resource.test.ts#lire initialisée']);
      }
    }
    expect(liaisons({ 'src/resource.test.ts': `${base} function creer(){function interne(){return virtualProgram({})} return 1} const lire=detenteur(creer);` })).toEqual([]);
    expect(liaisons({ 'src/resource.test.ts': `import {detenteur} from './detenteur.testkit'; import {ast} from '../scripts/guards/lib/dialecte.mjs'; function creer(){return ast({rel:'a.ts',text:''})} const lire=detenteur(creer);` })).toEqual([]);
    expect(liaisons({ 'src/resource.test.ts': `import {detenteur} from './detenteur.testkit'; import {API as Metier} from './metier'; function creer(){return new Metier()} const lire=detenteur(creer);` })).toEqual([]);
  });
  it('sessions et analyses natives aliasées gardent leurs valeurs et dérivés teints', () => {
    expect(liaisons({ 'src/native.test.ts': `import { API as Native } from 'typescript/unstable/sync';
import { analyserTexte as lire, analyserCorpus as corpus } from '../scripts/guards/lib/dialecte.mjs';
import { virtualProgram } from '../scripts/guards/lib/tsProgram.mjs';
const API_NATIVE = new Native();
const SESSION = virtualProgram({});
const CHECKER = SESSION.checker;
const PROGRAM = SESSION.program;
const ANALYSE = lire({ rel: 'a.ts', text: '' });
const ARBRE = ANALYSE.sourceFile;
const CORPUS = corpus([]);
` }).sort()).toEqual([
      'src/native.test.ts#ANALYSE initialisée',
      'src/native.test.ts#API_NATIVE initialisée',
      'src/native.test.ts#ARBRE initialisée',
      'src/native.test.ts#CHECKER initialisée',
      'src/native.test.ts#CORPUS initialisée',
      'src/native.test.ts#PROGRAM initialisée',
      'src/native.test.ts#SESSION initialisée',
    ]);
  });

  it('TÉMOIN ROUGE : l’ancien `PROGRAM_CACHE` est nommé, fichier et liaison', () => {
    expect(liaisons({ 'scripts/guards/lib/memo.mjs': ANCIEN_MEMO })).toEqual([
      'scripts/guards/lib/memo.mjs#PROGRAM_CACHE .set(',
    ]);
  });

  it('TÉMOIN ROUGE : l’ancien `sourceFileCache` est nommé, fichier et liaison', () => {
    expect(liaisons({ 'scripts/guards/lib/rng.mjs': ANCIEN_CACHE_D_ARBRES })).toEqual([
      'scripts/guards/lib/rng.mjs#sourceFileCache .set(',
    ]);
  });

  it('TÉMOIN VERT : le Program en `beforeAll`/`afterAll`, ou en détenteur paresseux vidé en `afterAll`', () => {
    expect(liaisons({ 'scripts/guards/lib/perimetre.mjs': PERIMETRE, 'src/x.test.ts': DETENTEUR_LIBERE })).toEqual([]);
  });

  it('TÉMOIN VERT : l’arbre tenu par l’appelant, qui le libère', () => {
    expect(liaisons({ 'scripts/guards/lib/carte.mjs': LIB_A_CARTE, 'src/c.test.ts': APPELANT_A_CARTE })).toEqual([]);
  });

  it('cas plantés : chaque forme de rétention est rouge', () => {
    const r = liaisons({
      'scripts/guards/lib/perimetre.mjs': PERIMETRE,
      'src/formes.test.ts': `import ts from 'typescript';
import { programmeDuPerimetre as bati } from '../scripts/guards/lib/perimetre.mjs';
export const DIRECT = ts.createProgram({ rootNames: [], options: {} });
const ARBRE = ts.createSourceFile('a.ts', '', ts.ScriptTarget.Latest);
let paresseux;
export const lire = () => (paresseux ??= bati('.'));
const PAR_OBJET = {};
const LISTE = [];
function opsProgram(root) {
  const program = bati(root);
  return { program, entry: root };
}
export function remplir(root) {
  PAR_OBJET[root] = opsProgram(root);
  LISTE.push(opsProgram(root));
}
`,
    });
    expect(r.sort()).toEqual([
      'src/formes.test.ts#ARBRE initialisée',
      'src/formes.test.ts#DIRECT initialisée',
      'src/formes.test.ts#LISTE .push(',
      'src/formes.test.ts#PAR_OBJET propriété affectée',
      'src/formes.test.ts#paresseux affectée',
    ]);
  });

  it('le rappel d’un `describe` est une portée de collection : un détenteur non libéré y est rouge', () => {
    expect(
      liaisons({
        'scripts/guards/lib/perimetre.mjs': PERIMETRE,
        'src/z.test.ts': `import { describe, it, afterAll } from 'vitest';
import { programmeDuPerimetre } from '../scripts/guards/lib/perimetre.mjs';
describe.each([1])('d%i', () => {
  let garde;
  let libere;
  const lire = () => (garde ??= programmeDuPerimetre('.'));
  const lire2 = () => (libere ??= programmeDuPerimetre('.'));
  afterAll(() => { libere.dispose(); libere = null; });
  it('x', () => { lire(); lire2(); });
  it('y', () => { const local = programmeDuPerimetre('.'); local.getTypeChecker(); });
});
`,
      }),
    ).toEqual(['src/z.test.ts#garde affectée']);
  });

  it('un homonyme LOCAL d’une liaison de collection n’est pas elle', () => {
    expect(
      liaisons({
        'src/y.ts': `import { virtualProgram } from './tsProgram.mjs';
const cache = new Map();
export function f() {
  const cache = new Map();
  cache.set('k', virtualProgram({}));
  return cache.size;
}
`,
      }),
    ).toEqual([]);
  });

  it('fermetures : dérivé de membre, IIFE, champ `static`, mémo, fabriques de service — chaque forme est rouge', () => {
    const r = liaisons({
      'scripts/guards/lib/perimetre.mjs': PERIMETRE,
      'src/memo.ts': `import ts from 'typescript';
import { memoByRef } from './state/sceneMemo';
export const arbre = memoByRef((f) => ts.createSourceFile(f.rel, f.text, 99, true));
`,
      'src/iife.ts': `import { repoProgram } from './tsProgram.mjs';
export const memo = (() => { let x; return () => (x ??= repoProgram('.', (f) => f)); })();
`,
      'src/iifeBloc.ts': `import { repoProgram } from './tsProgram.mjs';
export const memo = (() => { let y; return () => { if (!y) y = repoProgram('.', (f) => f); return y; }; })();
`,
      'src/checker.ts': `import { repoProgram } from './tsProgram.mjs';
let C; export function h() { C ??= repoProgram('.', (f) => f).getTypeChecker(); return C; }
`,
      'src/sfs.ts': `import { repoProgram } from './tsProgram.mjs';
const L = []; export function k() { const p = repoProgram('.', (f) => f); L.push(...p.getSourceFiles()); }
`,
      'src/statique.ts': `import { repoProgram } from './tsProgram.mjs';
export class Cache { static prog = repoProgram('.', (f) => f); }
`,
      'src/service.ts': `import ts from 'typescript';
const LS = ts.createLanguageService({});
let P; export const f = () => (P ??= ts.createIncrementalProgram({ rootNames: [], options: {} }));
let W; export const g = () => (W ??= ts.createWatchProgram({}));
export const lire = () => LS;
`,
      'src/sansLiberation.test.ts': `import { it } from 'vitest';
import { programmeDuPerimetre } from '../scripts/guards/lib/perimetre.mjs';
let Q; it('x', () => { Q ??= programmeDuPerimetre('.'); });
`,
    });
    expect(r.sort()).toEqual([
      'src/checker.ts#C affectée',
      'src/iife.ts#x affectée',
      'src/iifeBloc.ts#y affectée',
      'src/memo.ts#arbre initialisée',
      'src/sansLiberation.test.ts#Q affectée',
      'src/service.ts#LS initialisée',
      'src/service.ts#P affectée',
      'src/service.ts#W affectée',
      'src/sfs.ts#L .push(',
      'src/statique.ts#Cache.prog initialisée',
    ]);
  });

  it('fermetures : leurs témoins libérés ou hors collection restent verts', () => {
    expect(
      liaisons({
        'scripts/guards/lib/perimetre.mjs': PERIMETRE,
        'src/memo.ts': `import { memoByRef } from './state/sceneMemo';
export const longueur = memoByRef((f) => f.text.length);
`,
        'src/iife.ts': `import { repoProgram } from './tsProgram.mjs';
export function f() { const m = (() => { let x; return () => (x ??= repoProgram('.', (g) => g)); })(); return m(); }
`,
        'src/checker.test.ts': `import { afterAll, it } from 'vitest';
import { programmeDuPerimetre } from '../scripts/guards/lib/perimetre.mjs';
let C; afterAll(() => { C = undefined; });
it('x', () => { C ??= programmeDuPerimetre('.').getTypeChecker(); });
`,
        'src/sfs.test.ts': `import { afterAll, it } from 'vitest';
import { programmeDuPerimetre } from '../scripts/guards/lib/perimetre.mjs';
let L = []; afterAll(() => { L = undefined; });
it('x', () => { L.push(...programmeDuPerimetre('.').getSourceFiles()); });
`,
        'src/instance.ts': `import { repoProgram } from './tsProgram.mjs';
export class Porteur { prog = repoProgram('.', (f) => f); }
`,
        'src/service.test.ts': `import { afterAll, it } from 'vitest';
import ts from 'typescript';
let P; afterAll(() => { P = undefined; });
it('x', () => { P ??= ts.createIncrementalProgram({ rootNames: [], options: {} }); });
export const lire = () => ts.createLanguageService({});
`,
        'src/afterEach.test.ts': `import { afterEach, it } from 'vitest';
import { programmeDuPerimetre } from '../scripts/guards/lib/perimetre.mjs';
let Q; afterEach(() => { Q.dispose(); Q = undefined; });
it('x', () => { Q ??= programmeDuPerimetre('.'); });
`,
      }),
    ).toEqual([]);
  });

  it('un DÉRIVÉ de corpus tenu en portée de collection est rouge ; le corpus lui-même ne l’est pas', () => {
    const r = liaisons({
      'scripts/guards/lib/lecteur.mjs': `import { readCorpus } from './sourceCorpus.mjs';
export const scenes = () => readCorpus(['src/scenes'], { exts: ['.json'] });
`,
      'src/derives.test.ts': `import { describe, it } from 'vitest';
import { readCorpus } from '../scripts/guards/lib/sourceCorpus.mjs';
import { scenes } from '../scripts/guards/lib/lecteur.mjs';
import { memoByRef } from './state/sceneMemo';
const CORPUS = readCorpus(['src']);
const TEXTES = CORPUS.map((f) => f.text);
const CSS = readCorpus(['src'], { exts: ['.css'] }).map(({ text }) => text).join('\\n');
const moisson = memoByRef((c) => c.map((f) => f.rel));
describe('d', () => {
  const TESTS = CORPUS.filter((f) => f.rel.endsWith('.test.ts'));
  it('x', () => { moisson(scenes()); TEXTES.length; CSS.length; TESTS.length; });
});
`,
    });
    expect(r.sort()).toEqual([
      'src/derives.test.ts#CSS initialisée',
      'src/derives.test.ts#TESTS initialisée',
      'src/derives.test.ts#TEXTES initialisée',
      'src/derives.test.ts#moisson mémo nourri',
    ]);
  });

  it('un DÉRIVÉ de corpus derrière un détenteur vidé en `afterAll` reste vert', () => {
    expect(
      liaisons({
        'src/derives.test.ts': `import { afterAll, describe, it } from 'vitest';
import { readCorpus } from '../scripts/guards/lib/sourceCorpus.mjs';
const CORPUS = readCorpus(['src']);
let _textes;
const textes = () => (_textes ??= CORPUS.map((f) => f.text));
afterAll(() => { _textes = undefined; });
describe('d', () => {
  let _tests;
  const tests = () => (_tests ??= CORPUS.filter((f) => f.rel.endsWith('.test.ts')));
  afterAll(() => { _tests = undefined; });
  it('x', () => { const local = textes().join('\\n'); tests(); local.length; });
});
`,
      }),
    ).toEqual([]);
  });

  it('la primitive `detenteur`, importée de son module dans un fichier de test, libère ce qu’elle tient', () => {
    expect(
      liaisons({
        'scripts/guards/lib/perimetre.mjs': PERIMETRE,
        'src/d.test.ts': `import { describe, it } from 'vitest';
import { readCorpus } from '../scripts/guards/lib/sourceCorpus.mjs';
import { programmeDuPerimetre } from '../scripts/guards/lib/perimetre.mjs';
import { detenteur as tenir } from './detenteur.testkit';
const TEXTES = tenir(() => readCorpus(['src']).map((f) => f.text));
describe('d', () => {
  const programme = tenir(() => programmeDuPerimetre('.'), s => s.dispose());
  it('x', () => { TEXTES(); programme(); });
});
`,
      }),
    ).toEqual([]);
  });

  it('un homonyme de `detenteur` (local, d’un autre module, ou hors fichier de test) ne libère rien', () => {
    const corps = `const TEXTES = detenteur(() => readCorpus(['src']).map((f) => f.text));
const PROGRAMME = detenteur(() => programmeDuPerimetre('.'), s => s.dispose());
`;
    const tete = `import { readCorpus } from '../scripts/guards/lib/sourceCorpus.mjs';
import { programmeDuPerimetre } from '../scripts/guards/lib/perimetre.mjs';
`;
    const r = liaisons({
      'scripts/guards/lib/perimetre.mjs': PERIMETRE,
      'src/local.test.ts': `${tete}function detenteur(f) { let v; return () => (v ??= f()); }
${corps}`,
      'src/autre.test.ts': `${tete}import { detenteur } from './autre-detenteur';
${corps}`,
      'src/production.ts': `${tete}import { detenteur } from './detenteur.testkit';
${corps}`,
    });
    expect(r.sort()).toEqual([
      'src/autre.test.ts#PROGRAMME initialisée',
      'src/autre.test.ts#TEXTES initialisée',
      'src/local.test.ts#PROGRAMME initialisée',
      'src/local.test.ts#TEXTES initialisée',
      'src/production.ts#PROGRAMME initialisée',
      'src/production.ts#TEXTES initialisée',
    ]);
  });

  it('ce que REND le lecteur de `detenteur` reste teint : rangé en portée de collection, il est rouge', () => {
    const tete = `import { beforeAll, it } from 'vitest';
import { readCorpus } from '../scripts/guards/lib/sourceCorpus.mjs';
import { programmeDuPerimetre } from '../scripts/guards/lib/perimetre.mjs';
import { detenteur } from './detenteur.testkit';
const P = detenteur(() => programmeDuPerimetre('.'), s => s.dispose());
`;
    const r = liaisons({
      'scripts/guards/lib/perimetre.mjs': PERIMETRE,
      'src/versModule.test.ts': `${tete}let checker; beforeAll(() => { checker = P().getTypeChecker(); });
it('x', () => checker);
`,
      'src/const.test.ts': `${tete}const sfs = P().getSourceFiles();
`,
      'src/corpus.test.ts': `${tete}const T = detenteur(() => readCorpus(['src']).map((f) => f.text));
const tout = T().join('\\n');
`,
      'src/push.test.ts': `${tete}const L = []; it('x', () => { L.push(P()); });
`,
      'src/temoin.test.ts': `${tete}const x = () => P().getTypeChecker();
it('x', () => { x(); });
`,
    });
    expect(r.sort()).toEqual([
      'src/const.test.ts#sfs initialisée',
      'src/corpus.test.ts#tout initialisée',
      'src/push.test.ts#L .push(',
      'src/versModule.test.ts#checker affectée',
    ]);
  });

  it('un lecteur ou une fabrique ALIASÉ, ou rangé en propriété d’objet littéral, garde sa qualité', () => {
    const tete = `import { readCorpus } from '../scripts/guards/lib/sourceCorpus.mjs';
import { programmeDuPerimetre } from '../scripts/guards/lib/perimetre.mjs';
import { detenteur } from './detenteur.testkit';
`;
    expect(
      liaisons({
        'scripts/guards/lib/perimetre.mjs': PERIMETRE,
        'src/alias.test.ts': `${tete}const P = detenteur(() => programmeDuPerimetre('.'), s => s.dispose());
const lire = P;
const c = lire().getTypeChecker();
`,
        'src/objet.test.ts': `${tete}const K = { P: detenteur(() => programmeDuPerimetre('.'), s => s.dispose()) };
const c = K.P().getTypeChecker();
`,
        'src/fabrique.test.ts': `${tete}const f = programmeDuPerimetre;
const p = f('.');
`,
      }).sort(),
    ).toEqual(['src/alias.test.ts#c initialisée', 'src/fabrique.test.ts#p initialisée', 'src/objet.test.ts#c initialisée']);
  });

  it('un nom AFFECTÉ d’une fabrique, une fonction ou méthode d’objet littéral qui rend une valeur teinte : rouge', () => {
    const tete = `import { programmeDuPerimetre } from '../scripts/guards/lib/perimetre.mjs';
import { detenteur } from './detenteur.testkit';
`;
    expect(
      liaisons({
        'scripts/guards/lib/perimetre.mjs': PERIMETRE,
        'src/affecte.test.ts': `${tete}const P = detenteur(() => programmeDuPerimetre('.'), s => s.dispose());
let lire;
lire = P;
const c = lire().getTypeChecker();
`,
        'src/fleche.test.ts': `${tete}const K = { P: () => programmeDuPerimetre('.') };
const c = K.P().getTypeChecker();
`,
        'src/methode.test.ts': `${tete}const K = { P() { return programmeDuPerimetre('.'); } };
const c = K.P().getTypeChecker();
`,
      }).sort(),
    ).toEqual(['src/affecte.test.ts#c initialisée', 'src/fleche.test.ts#c initialisée', 'src/methode.test.ts#c initialisée']);
  });

  it('leurs témoins libérés en `afterAll` restent verts', () => {
    const tete = `import { afterAll, beforeAll, it } from 'vitest';
import { programmeDuPerimetre } from '../scripts/guards/lib/perimetre.mjs';
import { detenteur } from './detenteur.testkit';
`;
    const libere = (appel: string) => `let c;
beforeAll(() => { c = ${appel}.getTypeChecker(); });
afterAll(() => { c = undefined; });
it('x', () => c);
`;
    expect(
      liaisons({
        'scripts/guards/lib/perimetre.mjs': PERIMETRE,
        'src/affecte.test.ts': `${tete}const P = detenteur(() => programmeDuPerimetre('.'), s => s.dispose());
let lire;
lire = P;
${libere('lire()')}`,
        'src/fleche.test.ts': `${tete}const K = { P: () => programmeDuPerimetre('.') };
${libere('K.P()')}`,
        'src/methode.test.ts': `${tete}const K = { P() { return programmeDuPerimetre('.'); } };
${libere('K.P()')}`,
      }),
    ).toEqual([]);
  });

  it('un export se qualifie par SA déclaration (ou sa place dans les listes de base) : un homonyme du fichier ne le rend pas fabrique', () => {
    const importe = `import { programmeDuPerimetre } from '../../scripts/guards/lib/perimetre.mjs';
`;
    expect(
      liaisons({
        'scripts/guards/lib/perimetre.mjs': PERIMETRE,
        'src/lib/outil.ts': `${importe}function interne() { const K = { taille: () => programmeDuPerimetre('.') }; return K; }
export function taille(xs) { return xs.length; }
export function fab() { return programmeDuPerimetre('.'); }
`,
        'src/lib/outil2.ts': `${importe}export function compter(xs) { let lire; lire = programmeDuPerimetre; return xs.length; }
export const lire = (x) => x;
`,
        'src/y.ts': `import { taille } from './lib/outil';
export const N = taille([1, 2, 3]);
`,
        'src/z.ts': `import { lire } from './lib/outil2';
export const M = lire(3);
`,
        'src/w.ts': `import { fab } from './lib/outil';
export const F = fab();
`,
        'scripts/guards/lib/sourceCorpus.mjs': `export function readCorpus(racines) { return lister(racines); }
`,
        'src/v.ts': `import { readCorpus as lireCorpus } from '../scripts/guards/lib/sourceCorpus.mjs';
export const T = lireCorpus(['src']).map((f) => f.text);
`,
      }).sort(),
    ).toEqual(['src/v.ts#T initialisée', 'src/w.ts#F initialisée']);
  });

  it('`detenteur` appelé dans un `it` ou un hook (hors collecte) suit la règle commune : rouge', () => {
    const tete = `import { beforeAll, it } from 'vitest';
import { programmeDuPerimetre } from '../scripts/guards/lib/perimetre.mjs';
import { detenteur } from './detenteur.testkit';
`;
    expect(
      liaisons({
        'scripts/guards/lib/perimetre.mjs': PERIMETRE,
        'src/hook.test.ts': `${tete}let lire; beforeAll(() => { lire = detenteur(() => programmeDuPerimetre('.'), s => s.dispose()); lire(); });
it('x', () => lire());
`,
        'src/it.test.ts': `${tete}let lire; it('x', () => { lire = detenteur(() => programmeDuPerimetre('.'), s => s.dispose()); lire(); });
`,
      }).sort(),
    ).toEqual(['src/hook.test.ts#lire affectée', 'src/it.test.ts#lire affectée']);
  });

  it('aucun module chargé par la suite ne retient une structure d’analyse', { timeout: 1_200_000 }, () => {
    const charges = clotureDImports(fichiersDeLaSuite().map((f) => f.abs), { racine: ROOT });
    const duCorpus = readCorpus(['src', 'scripts', 'server/src'], {
      exts: ['.ts', '.tsx', '.mts', '.mjs', '.cjs', '.js'],
      tests: true,
    }).filter(({ rel }) => charges.has(rel));
    // Tout module de CODE de la clôture est lu : ceux que le corpus ne porte pas (`vite.config.ts`, à
    // la racine) sont lus au disque — un module chargé non lu échapperait à la garde en silence.
    const dansLeCorpus = new Set(duCorpus.map((f) => f.rel));
    const lus = [
      ...duCorpus,
      ...[...charges]
        .filter((rel) => estModule(rel) && !dansLeCorpus.has(rel))
        .map((rel) => ({ rel, text: readFileSync(join(ROOT, rel), 'utf8') })),
    ];
    expect(lus.length, 'la clôture de la suite porte des milliers de modules').toBeGreaterThan(3000);
    const exportees = fabriquesDuCorpus(lus);
    // Non-vacuité : les fabriques partagées et un lecteur d'arbres consommateur sont vus.
    expect([...exportees.fabriques]).toEqual(
      expect.arrayContaining(['repoProgram', 'virtualProgram', 'syntaxProgram', 'analyserCorpus', 'programmeDuPerimetre', 'arbreDe']),
    );
    const retentions: ReturnType<typeof retentionsDAnalyse> = [];
    for (const { fichier: { rel, text }, sourceFile, checker } of analyserCorpus(lus)) {
      retentions.push(...retentionsDAnalyse(rel, text, exportees, sourceFile!, checker));
    }
    expect(retentions.map((r) => `${r.rel}:${r.line} ${r.liaison} (${r.forme})`)).toEqual([]);
  });
});
