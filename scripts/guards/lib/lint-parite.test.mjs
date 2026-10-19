import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import js from '@eslint/js'
import config from '../../../oxlint.config.mjs'
import { configPourFichier, directivesLint, lintFixtures, selectionnerMessages } from './lint.testkit.mjs'
import { lancerLint } from './lintStage.mjs'

const RACINE = fileURLToPath(new URL('../../../', import.meta.url))
const COEUR = {
  'constructor-super': 'class C extends B {constructor(){console.log(1);}} console.log(C);',
  'for-direction': 'for(let i=0;i<10;i--){ console.log(i); }',
  'getter-return': 'export const a = {get x(){}};',
  'no-async-promise-executor': 'new Promise(async resolve=>resolve(1));',
  'no-class-assign': 'class C {} C=1; console.log(C);',
  'no-compare-neg-zero': 'console.log(x === -0);',
  'no-cond-assign': 'if (x = 1) console.log(x);',
  'no-const-assign': 'const x=1; x=2; console.log(x);',
  'no-constant-binary-expression': 'console.log(x === {});',
  'no-constant-condition': 'if(true){console.log(1);}',
  'no-control-regex': 'console.log(/\\x00/);',
  'no-debugger': 'debugger;',
  'no-delete-var': 'let x=1; delete x;',
  'no-dupe-args': 'function f(x,x){return x;} f(1,2);',
  'no-dupe-class-members': 'class C {f(){} f(){}} console.log(C);',
  'no-dupe-else-if': 'if(x) f(); else if(x) g();',
  'no-dupe-keys': 'console.log({a:1,a:2});',
  'no-duplicate-case': 'switch(x){case 1: break; case 1: break;}',
  'no-empty': 'if(x) {}',
  'no-empty-character-class': 'console.log(/[]/);',
  'no-empty-pattern': 'const {} = x;',
  'no-empty-static-block': 'export class A {static {}}',
  'no-ex-assign': 'try { f(); }catch(e){e=1;console.log(e);}',
  'no-extra-boolean-cast': 'if(!!x) console.log(x);',
  'no-fallthrough': 'switch(x){case 1: f(); case 2: g();}',
  'no-func-assign': 'function f(){} f=1;console.log(f);',
  'no-global-assign': 'undefined = 1;',
  'no-import-assign': "import {x} from 'x';x=1;",
  'no-invalid-regexp': "new RegExp('[');",
  'no-irregular-whitespace': 'console.log(1\u00a0+ 2);',
  'no-loss-of-precision': 'console.log(9007199254740993);',
  'no-misleading-character-class': 'console.log(/[👍]/);',
  'no-new-native-nonconstructor': 'new Symbol();',
  'no-nonoctal-decimal-escape': "console.log('\\8');",
  'no-obj-calls': 'Math();',
  'no-octal': 'console.log(071);',
  'no-prototype-builtins': "x.hasOwnProperty('a');",
  'no-redeclare': 'var x; var x; console.log(x);',
  'no-regex-spaces': 'console.log(/a  b/);',
  'no-self-assign': 'x = x;',
  'no-setter-return': 'export const x={set a(v){return v;}};',
  'no-shadow-restricted-names': 'export function f(undefined){return undefined;}',
  'no-sparse-arrays': 'console.log([1,,2]);',
  'no-this-before-super': 'class C extends B {constructor(){this.x=1;super();}} console.log(C);',
  'no-unassigned-vars': 'let x; console.log(x);',
  'no-unexpected-multiline': 'const x = f\n[1].map(g); console.log(x);',
  'no-unreachable': 'export function f(){return 1;console.log(1);}',
  'no-unsafe-finally': 'export function f(){try{return 1;}finally{return 2;}}',
  'no-unsafe-negation': 'console.log(!x in y);',
  'no-unsafe-optional-chaining': '(x?.f)();',
  'no-unused-labels': 'label: console.log(1);',
  'no-unused-private-class-members': 'export class C {#x=1;}',
  'no-unused-vars': 'const unused = 1;',
  'no-useless-assignment': 'let x=1;x=2;console.log(x);',
  'no-useless-backreference': 'console.log(/(a\\1)/);',
  'no-useless-catch': 'try{f();}catch(e){throw e;}',
  'no-useless-escape': "console.log('\\a');",
  'no-with': 'with(x){f();}',
  'preserve-caught-error': "try{f();}catch(e){throw new Error('x');}",
  'require-yield': 'export function* f(){return 1;}',
  'use-isnan': 'console.log(x===NaN);',
  'valid-typeof': "console.log(typeof x === 'strnig');",
  'prefer-const': 'let x=1;console.log(x);',
  'no-var': 'var x=1;console.log(x);',
  'prefer-rest-params': 'export function f(){return arguments[0];}',
  'prefer-spread': 'f.apply(null,args);',
}
const TYPESCRIPT = {
  'no-array-constructor': 'export const a = new Array(1,2);',
  'no-duplicate-enum-values': 'export enum E {A=1,B=1}',
  'no-empty-object-type': 'export type A = {};',
  'no-extra-non-null-assertion': 'export const a = x!!;',
  'no-misused-new': 'export interface I {new(): I;}',
  'no-namespace': 'namespace N {export const a=1;} console.log(N);',
  'no-non-null-asserted-optional-chain': 'export const a = x?.foo!;',
  'no-require-imports': "export const a = require('x');",
  'no-this-alias': 'export function f(){const that = this;return that;}',
  'no-unnecessary-type-constraint': 'export function f<T extends any>(x:T){return x;}',
  'no-unsafe-declaration-merging': 'export interface A {x:number} export class A {}',
  'no-unsafe-function-type': 'export type A = Function;',
  'no-unused-expressions': '42;',
  'no-unused-vars': 'const unused = 1;',
  'no-wrapper-object-types': 'export type A = String;',
  'prefer-as-const': "export const a = 'x' as 'x';",
  'prefer-namespace-keyword': 'module N {export const a=1;} console.log(N);',
  'triple-slash-reference': '/// <reference path="./x.ts" />\nexport {};',
}
const coeurNom = r => ['no-dupe-args', 'no-octal'].includes(r) ? `core/${r}` : r
const tsNom = r => ['no-array-constructor', 'no-unused-expressions', 'no-unused-vars'].includes(r) ? r : `typescript/${r}`
const niveau = v => ({off:0,warn:1,error:2}[Array.isArray(v)?v[0]:v] ?? (Array.isArray(v)?v[0]:v))

test('la sélection refuse une fixture neutre invalide avant filtrage et conserve le rapport brut du parseur', () => {
  const resultats=lintFixtures([
    {filePath:'src/ui/parite-neutre-invalide.ts',code:'export const a = ;'},
    {filePath:'src/ui/parite-neutre-valide.ts',code:'export const a = 1;'},
    {filePath:'src/ui/parite-marque-positive.ts',code:'export const a = x as PlayerText;'},
  ])
  const estMarque=message=>message.ruleId==='murs/marques'
  let filtreAppele=false
  assert.throws(()=>selectionnerMessages(resultats[0],message=>{filtreAppele=true;return estMarque(message)}),/parite-neutre-invalide\.ts:1:/)
  assert.equal(filtreAppele,false)
  assert.deepEqual(selectionnerMessages(resultats[1],estMarque),[])
  const positifs=selectionnerMessages(resultats[2],estMarque)
  assert.equal(positifs.length,1)
  assert.equal(positifs[0].severity,2)
  assert.equal(resultats[0].messages.length,1)
  assert.equal(resultats[0].messages[0].ruleId,null)
  assert.equal(resultats[0].messages[0].fatal,true)
})

test('chaque règle cœur active et chaque règle TS native mord avec sa sévérité effective', () => {
  const effectives = configPourFichier('scripts/zz-parite.js').rules
  for(const r of Object.keys(js.configs.recommended.rules)) if(niveau(effectives[coeurNom(r)])>0) assert.ok(r in COEUR, `${r}: témoin manquant`)
  const cas = [
    ...Object.entries(COEUR).map(([r,code]) => ({filePath:`scripts/zz-parite/${r}.js`,code,regle:coeurNom(r),severity:['no-empty','no-constant-condition','prefer-const','no-unused-vars'].includes(r)?1:2})),
    ...Object.entries(TYPESCRIPT).map(([r,code])=>({filePath:`src/zz-parite/${r}.ts`,code,regle:tsNom(r),severity:r==='no-unused-vars'?1:2})),
    ...['no-var','prefer-rest-params','prefer-spread'].map(r=>({filePath:`src/zz-parite/${r}.ts`,code:COEUR[r],regle:r,severity:2})),
  ].filter(c => niveau(configPourFichier(c.filePath).rules[c.regle])>0 || c.regle.startsWith('typescript/'))
  const resultats = lintFixtures(cas)
  for(let i=0;i<cas.length;i++) {
    const c=cas[i], messages=resultats[i].messages
    const pris=messages.filter(m=>m.ruleId===c.regle)
    const refusSyntaxique = ['no-delete-var','no-with'].includes(c.regle) && messages.some(m=>m.fatal)
    assert.ok(pris.length || refusSyntaxique, `${c.filePath}: ${c.regle} absente: ${JSON.stringify(messages)}`)
    for(const m of pris) { assert.equal(m.severity,c.severity,c.filePath); assert.ok(m.line>0&&m.column>0,c.filePath) }
  }
})

test('options sensibles, globals readonly et directives nommées gardent leurs effets', () => {
  const cas = [
    ['src/zz-parite/unused.ts','const _unused=1; export function f(_arg:number){return 1;}','no-unused-vars',0],
    ['scripts/zz-parite/catch.js','try{f();}catch{}','no-empty',0],
    ['scripts/zz-parite/loop.js','while(true){f();}','no-constant-condition',0],
    ['src/engine/zz-parite/type.ts',"import type {X} from '../state/x'; export type A=X;",'murs/purete-imports',0],
    ['src/engine/zz-parite/value.ts',"import {X} from '../state/x'; export const A=X;",'murs/purete-imports',1],
    ['scripts/zz-parite/globals.js','window=1; process=2; console=3;','no-global-assign',3],
    ['src/state/zz-parite/directive.ts','// eslint-disable-next-line murs/marques -- sonde\nexport const a = x as PlayerText; Object.assign(x,{label:"x"});\nexport const b = x as PlayerText;','murs/marques',1],
    ['src/state/zz-parite/directive.ts','// oxlint-disable-next-line murs/marques -- sonde\nexport const a = x as PlayerText; Object.assign(x,{label:"x"});\nexport const b = x as PlayerText;','murs/conteneur',1],
  ]
  const fixtures=cas.map(([filePath,code],i)=>({filePath:filePath.replace(/(?=\.[^.]+$)/,`-${i}`),code}))
  const resultats=lintFixtures(fixtures)
  for(let i=0;i<cas.length;i++) assert.equal(resultats[i].messages.filter(m=>m.ruleId===cas[i][2]).length,cas[i][3],JSON.stringify(resultats[i]))
  assert.equal(resultats[6].messages.find(m=>m.ruleId==='murs/marques').line,3)
  for(const prefix of ['eslint','oxlint']) {
    assert.deepEqual(directivesLint(`/* ${prefix}-disable */\nx()`, 'a.ts',['murs/marques']),[1])
    assert.deepEqual(directivesLint(`/* ${prefix} murs/marques: off */\nx()`, 'a.ts',['murs/marques']),[1])
    assert.deepEqual(directivesLint(`const x="/* ${prefix}-disable */"; const re=/${prefix}-disable/;`, 'a.ts',['murs/marques']),[])
  }
})

test('les murs mordent dans leur portée et passent leurs témoins neutres ou exemptés', () => {
  const cas = [
    ['src/ui/parite-marques.ts','export const a=x as PlayerText;','murs/marques',1],
    ['src/ui/parite-neutre.ts','export const a=x as Combatant;','murs/marques',0],
    ['src/state/parite-conteneur.ts','Object.assign(x,{label:"x"});','murs/conteneur',1],
    ['src/state/parite-conteneur.test.ts','Object.assign(x,{label:"x"});','murs/conteneur',0],
    ['scripts/parite-dialecte.mjs','export const a=ts.ScriptKind.TS;','murs/dialecte',1],
    ['src/parite-dialecte.ts','export const a=ts.ScriptKind.TS;','murs/dialecte',0],
    ['scripts/docs/parite-listage.mjs','fs.glob(".");','murs/ordre-total',1],
    ['src/parite-listage.ts','fs.glob(".");','murs/ordre-total',0],
    ['scripts/docs/parite-import.mjs',"import {glob} from 'node:fs';glob('.');",'murs/ordre-total-imports',1],
    ['src/parite-import.ts',"import {glob} from 'node:fs';glob('.');",'murs/ordre-total-imports',0],
    ['scripts/docs/parite-locale.mjs','a.localeCompare(b);','murs/ordre-total-locale',1],
    ['src/parite-locale.test.ts','a.localeCompare(b);','murs/ordre-total-locale',0],
    ['src/state/parite-issue.ts',"import {describeX} from './flowOutcomes';describeX();",'murs/canal-issue',1],
    ['src/state/rollFlowSpecs.ts',"import {describeX} from './flowOutcomes';describeX();",'murs/canal-issue',0],
    ['src/engine/parite-dynamique.ts',"import('../ui/x');",'murs/purete',1],
    ['src/engine/parite-dynamique.test.ts',"import('../ui/x');",'murs/purete',0],
    ['src/data/parite-statique.ts',"import {x} from '../state/x';x();",'murs/purete-imports',1],
    ['src/data/parite-statique.test.ts',"import {x} from '../state/x';x();",'murs/purete-imports',0],
    ['src/state/parite-type-rendu.ts',"import type {X} from '../gameIso/x'; export type A=X;",'murs/purete-imports',1],
    ['src/state/parite-typeof-rendu.ts',"export type A=typeof import('../gameIso/x');",'murs/purete',1],
    ['src/state/parite-index-rendu.ts',"import('../gameIso');",'murs/purete',1],
    ['src/state/parite-gabarit-rendu.ts',"import(`../gameIso/x`);",'murs/purete',1],
    ['src/state/parite-require-rendu.ts',"require('../gameIso/x');",'murs/purete',1],
    ['src/state/parite-voisin-rendu.ts',"import('../gameIsoX/x');",'murs/purete',0],
    ['src/engine/parite-require-gabarit.ts',"require(`../ui/x`);",'murs/purete',1],
    ['src/data/parite-create-require.ts',"createRequire(import.meta.url)('../state/x');",'murs/purete',1],
    ['src/data/parite-module-require.ts',"module.require('../state/x');",'murs/purete',1],
    ['src/engine/parite-module-require-gabarit.ts',"module.require(`../ui/x`);",'murs/purete',1],
    ['src/ui/hud/parite-atelier.tsx',"import {GameOpEditor} from '../editor/GameOpEditor';GameOpEditor();",'murs/atelier',1],
    ['src/ui/parite-atelier-alias.tsx',"import {ConditionEditor} from '@/ui/editor/ConditionEditor';ConditionEditor();",'murs/atelier',1],
    ['src/ui/compendium/parite-atelier.tsx',"import {GameOpEditor} from '../editor/GameOpEditor';GameOpEditor();",'murs/atelier',1],
    ['src/ui/hud/parite-atelier-refs.tsx',"import {OP_LABEL} from '../editor/refsDOp';OP_LABEL.x;",'murs/atelier',1],
    ['src/ui/editor/codex/parite-atelier.tsx',"import {GameOpEditor} from '../../editor/GameOpEditor';GameOpEditor();",'murs/atelier',0],
    ['src/ui/hud/parite-atelier.test.tsx',"import {GameOpEditor} from '../editor/GameOpEditor';GameOpEditor();",'murs/atelier',0],
    ['src/state/parite-type-affichage.ts',"import type {X} from '../ui/x'; export type A=X;",'murs/purete-imports',0],
    ['src/state/parite-minuterie.ts','setTimeout(f,0);','murs/minuteries',1],
    ['src/lib/parite-minuterie.ts','export const id=setInterval(f,9);','murs/minuteries',1],
    ['src/state/parite-minuterie-reference.ts','export const poser=setTimeout;','murs/minuteries',1],
    ['src/state/parite-minuterie-window.ts','window.setTimeout(f,0);','murs/minuteries-hote',1],
    ['src/lib/parite-minuterie-globalthis.ts','globalThis.setInterval(f,0);','murs/minuteries-hote',1],
    ['src/state/parite-minuterie-self.ts','self.setTimeout(f,0);','murs/minuteries-hote',1],
    ['src/state/parite-minuterie-global.ts','global.setTimeout(f,0);','murs/minuteries-hote',1],
    ['src/state/parite-minuterie-destructuree.ts','const {setTimeout:poser}=window;poser(f,0);','murs/minuteries-hote',1],
    ['src/state/parite-minuterie-type.ts','export type T=ReturnType<typeof setTimeout>;','murs/minuteries',0],
    ['src/state/parite-minuterie-tierce.ts','horloge.setTimeout(f,0);','murs/minuteries-hote',0],
    ['src/state/parite-minuterie-import-node.ts',"import {setTimeout} from 'node:timers';setTimeout(f,0);",'murs/minuteries-import',1],
    ['src/lib/parite-minuterie-import-timers.ts',"import {setInterval} from 'timers';setInterval(f,0);",'murs/minuteries-import',1],
    ['src/state/parite-minuterie-import-espace.ts',"import * as t from 'node:timers';t.setTimeout(f,0);",'murs/minuteries-import',1],
    ['src/state/parite-minuterie-import-neutre.ts',"import {clearTimeout} from 'node:timers';clearTimeout(x);",'murs/minuteries-import',0],
    ['src/state/parite-minuterie-appel-import.ts',"import {setTimeout} from './horloge';setTimeout(f,0);",'murs/minuteries-appel',1],
    ['src/state/parite-minuterie-declare.ts','declare const setTimeout:(f:()=>void,n:number)=>number;setTimeout(f,0);','murs/minuteries-appel',1],
    ['src/lib/parite-minuterie-declare-fonction.ts','declare function setInterval(f:()=>void,n:number):number;setInterval(f,0);','murs/minuteries-appel',1],
    ['src/state/parite-minuterie-parametre.ts','export function g(setTimeout:(f:()=>void,n:number)=>void){setTimeout(f,0);}','murs/minuteries-appel',1],
    ['src/state/parite-minuterie-appel-neutre.ts','export const poserPlusTard=(f:()=>void)=>f;','murs/minuteries-appel',0],
    ['src/state/parite-minuterie-appel-objet.ts','const {setTimeout}=horloge;setTimeout(f,0);','murs/minuteries-appel',1],
    ['src/state/parite-minuterie-appel-timers-defaut.ts',"import timers from 'node:timers';const {setTimeout}=timers;setTimeout(f,0);",'murs/minuteries-appel',1],
    ['src/state/parite-minuterie-appel-globalthis-as.ts','const {setTimeout}=globalThis as typeof globalThis;setTimeout(f,0);','murs/minuteries-appel',1],
    ['src/lib/parite-minuterie-appel-window-as.ts','const {setInterval}=window as Window;setInterval(f,0);','murs/minuteries-appel',1],
    ['src/state/parite-minuterie-appel-import-dynamique.ts',"export async function g(){const {setTimeout}=await import('node:timers');setTimeout(f,0);}",'murs/minuteries-appel',1],
    ['src/state/parite-minuterie-appel-import-require.ts',"import timers=require('node:timers');import setTimeout=timers.setTimeout;setTimeout(f,0);",'murs/minuteries-appel',1],
    ['src/state/parite-minuterie-appel-parametre-objet.ts','export const g=({setTimeout}:{setTimeout:(f:()=>void,n:number)=>void})=>{setTimeout(f,0);};','murs/minuteries-appel',1],
    ['src/state/parite-minuterie-appel-parametre-defaut.ts','export const g=(setTimeout=h)=>{setTimeout(f,0);};','murs/minuteries-appel',1],
    ['src/state/parite-minuterie-appel-catch.ts','try{x();}catch(setTimeout){setTimeout(f,0);}','murs/minuteries-appel',1],
    ['src/state/parite-minuterie-appel-tableau.ts','const [setTimeout]=paire;setTimeout(f,0);','murs/minuteries-appel',1],
    ['src/state/parite-minuterie-appel-namespace.ts','namespace setTimeout {}setTimeout(f,0);','murs/minuteries-appel',1],
    ['src/state/parite-minuterie-new-globalthis-as.ts','const {setTimeout}=globalThis as typeof globalThis;export const t=new setTimeout(f,0);','murs/minuteries-appel',1],
    ['src/state/parite-minuterie-new-timers-defaut.ts',"import timers from 'node:timers';const {setTimeout}=timers;export const t=new setTimeout(f,0);",'murs/minuteries-appel',1],
    ['src/lib/parite-minuterie-new-window-as.ts','const {setInterval}=window as Window;export const t=new setInterval(f,0);','murs/minuteries-appel',1],
    ['src/state/parite-minuterie-new-import-dynamique.ts',"export async function g(){const {setTimeout}=await import('node:timers');return new setTimeout(f,0);}",'murs/minuteries-appel',1],
    ['src/state/parite-minuterie-new-neutre.ts','export const t=new Horloge(f,0);','murs/minuteries-appel',0],
    ['src/state/parite-minuterie-appel-methode.ts','export const o={setTimeout(f:()=>void){return f;}};','murs/minuteries-appel',0],
    ['src/lib/minuteries.ts',"import {setInterval} from 'node:timers';export const id=setTimeout(f,0)+setInterval(f,0);",'murs/minuteries',0],
    ['src/state/parite-minuterie.test.ts','setTimeout(f,0);','murs/minuteries',0],
    ['src/ui/parite-minuterie.ts','setTimeout(f,0);','murs/minuteries',0],
    ['server/src/parite-alea.ts','export const a=Math.random();','murs/alea-serveur',1],
    ['server/src/sous/parite-alea-valeur.ts','export const f=(g)=>g(Math.random);','murs/alea-serveur',1],
    ['server/src/parite-alea-destructure.ts','const {random}=Math; export const a=random();','murs/alea-serveur',1],
    ['server/src/parite-alea-global.ts','export const a=globalThis.Math.random();','murs/alea-serveur',1],
    ['server/src/parite-alea-self.ts','export const a=self.Math.random();','murs/alea-serveur',1],
    ['server/src/parite-alea-window.ts',"export const a=window['Math'].random();",'murs/alea-serveur',1],
    ['server/src/parite-alea-alias-global.ts','const g=globalThis; export const a=g.Math.random();','murs/alea-serveur',1],
    ['server/src/parite-alea-chaine.ts','export const a=globalThis.self.Math.random();','murs/alea-serveur',1],
    ['server/src/parite-alea-chaine-double.ts','export const a=globalThis.globalThis.Math.random();','murs/alea-serveur',1],
    ['server/src/parite-alea-neutre.ts','export const a=Math.floor(1);','murs/alea-serveur',0],
    ['server/src/parite-alea.test.ts','export const a=Math.random();','murs/alea-serveur',0],
    ['server/src/parite-alea.test.tsx','export const a=Math.random();','murs/alea-serveur',0],
    ['src/parite-alea.ts','export const a=Math.random();','murs/alea-serveur',0],
    ['src/ui/console/CombatConsole.tsx','export const A=()=><b title="raison">x</b>;','murs/console-sans-title',1],
    ['src/ui/console/parite-jsx-multiligne.tsx','export const A=()=><b title={raison}\n>x</b>;','murs/console-sans-title',1],
    ['src/ui/console/parite-litteral.ts',"export const c={id:'x',title:'raison'};",'murs/console-sans-title',1],
    ['src/ui/console/sous/parite-imbrique.tsx','export const A=()=><b title="raison">x</b>;','murs/console-sans-title',1],
    ['src/ui/console/parite-affectation.tsx',"({title:t}=x);",'murs/console-sans-title',1],
    ['src/ui/console/parite-affectation-profonde.tsx',"({a:{title:t}}=x);",'murs/console-sans-title',1],
    ['src/ui/console/parite-affectation-tableau.tsx',"[{title:t}]=x;",'murs/console-sans-title',1],
    ['src/ui/console/parite-for-of.tsx',"for ({title:t} of xs){}",'murs/console-sans-title',1],
    ['src/ui/console/parite-for-in.tsx',"for ({title:t} in xs){}",'murs/console-sans-title',1],
    ['src/ui/console/parite-objet-tableau.tsx',"({a:[{title:t}]}=x);",'murs/console-sans-title',1],
    ['src/ui/console/parite-tableau-tableau.tsx',"[[{title:t}]]=x;",'murs/console-sans-title',1],
    ['src/ui/parite-hors-console.tsx','export const A=()=><b title="raison">x</b>;','murs/console-sans-title',0],
    ['src/ui/console/parite-console.test.tsx','export const A=()=><b title="raison">x</b>;','murs/console-sans-title',0],
    ['src/ui/console/parite-attributs-voisins.tsx','export const A=()=><b aria-label="nom" data-title="x"><use xlink:title="x"/></b>;','murs/console-sans-title',0],
    ['src/ui/console/parite-proprietes-neutres.tsx',"const {title:t}=x; const o={title, 'title':1, ['title']:2, get title(){return 1}}; type T={title:string};",'murs/console-sans-title',0],
    ['src/ui/console/parite-liaisons.tsx',"function f({title:t}){} for (const {title:u} of xs){} try{}catch({title:v}){}",'murs/console-sans-title',0],
  ]
  const resultats=lintFixtures(cas.map(([filePath,code])=>({filePath,code})))
  for(let i=0;i<cas.length;i++) {
    const messages=resultats[i].messages.filter(m=>m.ruleId===cas[i][2])
    assert.equal(messages.length,cas[i][3],JSON.stringify(resultats[i]))
    for(const m of messages) {assert.equal(m.severity,2);assert.equal(m.line,1);assert.ok(m.column>0)}
  }
  assert.deepEqual(resultats[cas.findIndex(([filePath])=>filePath==='src/lib/minuteries.ts')].messages.filter(m=>(m.ruleId??'').startsWith('murs/minuteries')),[])
  const unused=lintFixtures([{filePath:'src/parite-directive.ts',code:'// eslint-disable-next-line murs/marques -- sonde\nexport const a=1;'}])[0]
  assert.equal(unused.messages.length,1)
  assert.equal(unused.messages[0].severity,1)
  assert.equal(unused.messages[0].line,1)
})

test('murs/stockage-web : le stockage web nommé sous src/ est refusé, quel que soit son porteur, hors instruments Vitest', () => {
  const PROPRIETE='murs/stockage-web', GLOBAL='murs/stockage-web-global'
  const cas = [
    ['src/state/parite-sw-nu.ts','export const lire = (k: string) => sessionStorage.getItem(k);',GLOBAL],
    ['src/ui/parite-sw-typeof.ts',"export const a = typeof localStorage === 'undefined';",GLOBAL],
    ['src/ui/parite-sw-window.ts','window.localStorage.clear();',PROPRIETE],
    ['src/audio/parite-sw-globalthis.ts','export const s = (globalThis as { sessionStorage?: Storage }).sessionStorage;',PROPRIETE],
    ['src/net/parite-sw-self.ts','export const s = self.localStorage;',PROPRIETE],
    ['src/lib/parite-sw-indexe.ts',"export const s = globalThis['sessionStorage'];",PROPRIETE],
    ['src/lib/parite-sw-gabarit.ts','export const s = globalThis[`localStorage`];',PROPRIETE],
    ['src/state/parite-sw-destructure.ts','export const { localStorage: s } = window;',PROPRIETE],
    ['src/state/parite-sw-objet.ts','export const s = porteur.sessionStorage;',PROPRIETE],
    ['src/state/parite-sw-neutre.ts',[
      '// le localStorage en commentaire',
      'export const t = "miroir localStorage";',
      "export type G = 'localStorage' | 'sessionStorage';",
      'export type T = { localStorage?: Storage }; export const o = { sessionStorage: 1 };',
      'export function f(localStorage: number) { return localStorage; }',
      'export const couture = (genre: G): Storage | null => globalThis[genre] ?? null;',
    ].join('\n'),null],
    ['src/state/parite-sw.test.ts','(globalThis as { localStorage?: Storage }).localStorage = fake; sessionStorage.clear();',null],
    ['src/gameIso/parite-sw.bench.ts','localStorage.clear();',null],
    ['scripts/parite-sw.mjs','window.localStorage.clear();',null],
  ]
  const resultats=lintFixtures(cas.map(([filePath,code])=>({filePath,code})))
  for(let i=0;i<cas.length;i++) {
    const [filePath,,regle]=cas[i]
    const vus=selectionnerMessages(resultats[i],m=>m.ruleId===PROPRIETE||m.ruleId===GLOBAL)
    assert.deepEqual(vus.map(m=>[m.ruleId,m.severity,m.line]),regle?[[regle,2,1]]:[],`${filePath}: ${JSON.stringify(resultats[i].messages)}`)
  }
})

test('positions Unicode et erreur de parse sans code sont rendues par le vrai CLI', () => {
  const code='const texte="é😀"; debugger; console.log(texte);'
  const parse='export const é = ;'
  const resultats=lintFixtures([
    {filePath:'src/parite-unicode.ts',code},
    {filePath:'src/parite-parse.ts',code:parse},
    {filePath:'src/parite-crlf.ts',code:`// é😀\r\n${code}\r\n`},
  ])
  const message=resultats[0].messages.find(m=>m.ruleId==='no-debugger')
  assert.ok(message)
  assert.deepEqual([message.line,message.column,message.severity],[1,code.indexOf('debugger')+1,2])
  const erreur=resultats[1].messages[0]
  assert.ok(erreur)
  assert.deepEqual([erreur.ruleId,erreur.line,erreur.column,erreur.severity,erreur.fatal],[null,1,parse.indexOf(';')+1,2,true])
  const crlf=resultats[2].messages.find(m=>m.ruleId==='no-debugger')
  assert.ok(crlf)
  assert.deepEqual([crlf.line,crlf.column],[2,code.indexOf('debugger')+1])
})

test('les ignores globaux s’appliquent en chemins explicites et en découverte, warning seul refuse', () => {
  const cwd=mkdtempSync(join(tmpdir(),'lint-ignores-'))
  try {
    const fichiers=['src/sain.ts','dist/fautif.ts','public/fautif.js','probe.config.ts','node_modules/fautif.ts']
    for(const f of fichiers) {mkdirSync(dirname(join(cwd,f)),{recursive:true});writeFileSync(join(cwd,f),f==='src/sain.ts'?'export const a=1;':'debugger;')}
    for(const selection of [fichiers,['.']]) {
      const res=lancerLint(RACINE,selection,{cwd})
      assert.deepEqual(res.defauts,[],res.brut)
      assert.equal(JSON.parse(res.stdout).number_of_files,1)
    }
    writeFileSync(join(cwd,'src/warning.ts'),'let x=1;console.log(x);')
    const avertissement=lancerLint(RACINE,['src/warning.ts'],{cwd})
    assert.equal(avertissement.codeSortie,1)
    assert.deepEqual(avertissement.defauts.map(d=>[d.regle,d.gravite]),[['prefer-const','avertissement']])
    assert.equal(config.options.reportUnusedDisableDirectives,'warn')
    mkdirSync(join(cwd,'scripts'),{recursive:true})
    writeFileSync(join(cwd,'scripts/probe.config.ts'),'debugger;')
    const imbrique=lancerLint(RACINE,['scripts/probe.config.ts'],{cwd})
    assert.deepEqual(imbrique.defauts.map(d=>d.regle),['no-debugger'])
  } finally {rmSync(cwd,{recursive:true,force:true})}
})
