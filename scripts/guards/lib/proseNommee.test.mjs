import test from 'node:test';
import assert from 'node:assert/strict';
import { cheminsProseNommee, classificationsProseLocale } from './proseNommee.mjs';
import { fileURLToPath } from 'node:url';

const fichier = (text) => ({ rel: 'src/data/schemas/defs-scenes/fixture-prose.ts', text });
const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const analyser = text => classificationsProseLocale(ROOT, [fichier(`import { z } from 'zod'; import { nommerChamps } from '../grammaire/meta'; ${text}`)]);

test('un rapport structural homonyme ne devient pas un schéma Zod', () => {
  const r = analyser(`const simulacre=(forme:Record<string,{_output:string}>)=>({_output:{} as Record<string,string>,shape:forme}); const rapport=simulacre({texte:{_output:'Texte'}}); const imposteur={object:simulacre}; imposteur.object({texte:{_output:'Texte'}});`);
  assert.deepEqual(r.champs, []);
  assert.deepEqual(r.fautes, []);
});

test('un catalogue externe est dérivé, un barrel externe ne borne pas son réexport local', () => {
  const local = { rel: 'src/data/schemas/defs-scenes/fixture-local-prose.ts', text: `import {z} from 'zod'; export const sceneLocale=z.object({nouveau:z.string()});` };
  const externe = { rel: 'src/data/schemas/grammaire/fixture-barrel-prose.ts', text: `export {sceneLocale as sceneRenommee} from '../defs-scenes/fixture-local-prose'; export {sourceRefSchema as sourceRenommee} from './valeurs';` };
  const r = classificationsProseLocale(ROOT, [local, fichier(`import {z} from 'zod'; import {sceneRenommee as locale,sourceRenommee as catalogue} from '../grammaire/fixture-barrel-prose'; export const schema=z.object({locale,catalogue});`)], { sourcesAdditionnelles: [externe] });
  assert.ok(r.importsSchemas.some(i => i.module === externe.rel && i.nom === 'sourceRenommee'), JSON.stringify(r.importsSchemas));
  assert.ok(!r.importsSchemas.some(i => i.module === externe.rel && i.nom === 'sceneRenommee'), JSON.stringify(r.importsSchemas));
  assert.ok(r.fautes.some(f => f.includes('nouveau')), JSON.stringify(r));
});

test('un shape importé du corpus local garde sa sortie transformée', () => {
  const communs = { rel: 'src/data/schemas/defs-scenes/fixture-communs-prose.ts', text: `import {z} from 'zod'; export const champsProbe={nouveau:z.number().transform(()=> 'Texte')};` };
  const r = classificationsProseLocale(ROOT, [communs, fichier(`import {z} from 'zod'; import {champsProbe} from './fixture-communs-prose'; const schema=z.strictObject(champsProbe);`)]);
  assert.ok(r.champs.some(c => c.champ === 'nouveau'), JSON.stringify(r));
  assert.ok(r.fautes.some(f => f.includes('nouveau')), JSON.stringify(r));
});

test('les métas du shape importé local restent visibles dans les deux ordres du corpus', () => {
  const communs = { rel: 'src/data/schemas/defs-scenes/fixture-communs-prose.ts', text: `import {z} from 'zod'; import {nommerChamps} from '../grammaire/meta'; export const base=nommerChamps(z.object({nouveau:z.string()}),{nouveau:{label:'nouveau',texte:{regime:'designation'}}});` };
  const scene = fichier(`import {z} from 'zod'; import {nommerChamps,metaDesChamps} from '../grammaire/meta'; import {base} from './fixture-communs-prose'; const schema=nommerChamps(z.object({...base.shape}),{...metaDesChamps(base)});`);
  for (const corpus of [[communs,scene],[scene,communs]]) {
    const r = classificationsProseLocale(ROOT, corpus);
    assert.ok(r.champs.length >= 2, JSON.stringify(r));
    assert.deepEqual(r.fautes, []);
  }
});

test('une fabrique générique locale garde la sortie transformée de son shape', () => {
  const r = analyser(`function fabriquer<T extends z.ZodRawShape>(shape:T){ return z.strictObject(shape); } const schema=fabriquer({nouveau:z.number().transform(()=> 'Texte')});`);
  assert.ok(r.champs.some(c => c.champ === 'nouveau'), JSON.stringify(r));
  assert.ok(r.fautes.some(f => f.includes('nouveau')), JSON.stringify(r));
});

test('la fabrique générique accepte sa classification canonique locale', () => {
  const r = analyser(`function fabriquer<T extends z.ZodRawShape>(shape:T){ return z.strictObject(shape); } const schema=nommerChamps(fabriquer({nouveau:z.number().transform(()=> 'Texte')}),{nouveau:{label:'nouveau',texte:{regime:'designation'}}});`);
  assert.ok(r.champs.some(c => c.champ === 'nouveau' && c.regime === 'designation'), JSON.stringify(r));
  assert.deepEqual(r.fautes, []);
});

test('un shape dynamique concret reste opaque sans classification de son champ porteur', () => {
  const fabrique = `function fabriquer<T extends z.ZodRawShape>(shape:T){return z.strictObject(shape);} declare const champs:z.ZodRawShape;`;
  const nu = analyser(`${fabrique} const schema=fabriquer(champs);`);
  assert.ok(nu.fautes.some(f => f.includes('shape ouvert indéterminé')), JSON.stringify(nu));
  const technique = analyser(`${fabrique} const schema=nommerChamps(z.object({charge:fabriquer(champs)}),{charge:{label:'charge',texte:{regime:'technique',usage:'payload du catalogue sans prose de campagne'}}});`);
  assert.deepEqual(technique.fautes, []);
  const narration = analyser(`${fabrique} const schema=nommerChamps(z.object({charge:fabriquer(champs)}),{charge:{label:'charge',texte:{regime:'narration'}}});`);
  assert.ok(narration.fautes.some(f => f.includes('shape ouvert indéterminé')), JSON.stringify(narration));
});

test('la déclaration sur un schéma nommé compte, les commentaires et chaînes ne comptent pas', () => {
  const chemins = cheminsProseNommee([fichier(`
    import { proseNommee } from '../grammaire/prose';
    const base = {};
    // proseNommee(z.strictObject({}), 'commentaire');
    /* proseNommee(z.strictObject({}), 'bloc'); */
    const texte = "proseNommee(z.strictObject({}), 'chaine')";
    const schema = proseNommee(base, 'massBattle.terrain');
  `)]);
  assert.deepEqual(chemins, ['massBattle.terrain']);
});

test('les imports renommés et les espaces de noms comptent ; leurs homonymes locaux ne comptent pas', () => {
  const chemins = cheminsProseNommee([fichier(`
    import { proseNommee as compose } from '../grammaire/prose';
    import * as grammaire from '../grammaire/prose';
    const base = {};
    compose(base, 'narratif.ouverture.pitch');
    grammaire.proseNommee(base, 'massBattle.terrain');
    function local(compose) { compose(base, 'homonyme'); }
    function proseNommee(schema, chemin) { return schema; }
    proseNommee(base, 'fonction-locale');
  `)]);
  assert.deepEqual(chemins, ['narratif.ouverture.pitch', 'massBattle.terrain']);
});

test('une chaîne optionnelle sans wrapper ne déclare aucune provenance de prose nommée', () => {
  assert.deepEqual(cheminsProseNommee([fichier(`
    const schema = { terrain: z.string().optional() };
  `)]), []);
});

test('toute chaîne ouverte locale, optionnelle, en liste ou dans une union, doit porter sa classification', () => {
  const r = analyser(`
    const schema = nommerChamps(z.strictObject({
      nu: z.string(), optionnel: z.string().optional(), liste: z.array(z.string()),
      union: z.union([z.literal('ferme'), z.string()]),
      ferme: z.enum(['a','b']), litteral: z.literal('c'),
      enfant: nommerChamps(z.strictObject({ texte: z.string() }), { texte: { label: 'texte' } }),
    }), { nu: {label:'nu'}, optionnel:{label:'optionnel'}, liste:{label:'liste'}, union:{label:'union'}, ferme:{label:'fermé'}, litteral:{label:'littéral'}, enfant:{label:'enfant'} });
  `);
  assert.deepEqual(r.champs.map(c => c.champ), ['nu','optionnel','liste','union','texte']);
  assert.equal(r.fautes.length, 5);
});

test('une désignation explicite et une référence technique passent, le nom du champ ne donne aucun régime', () => {
  const r = analyser(`const schema=nommerChamps(z.strictObject({ label:z.string(), id:z.string(), autre:z.string() }), {
    label:{label:'nom',texte:{regime:'designation'}}, id:{label:'id',texte:{regime:'technique'}}, autre:{label:'autre'}
  });`);
  assert.equal(r.fautes.length,1);
  assert.match(r.fautes[0], /autre/);
});

test('une narration classifiée hors couture canonique rougit avant toute donnée', () => {
  const r=analyser(`const schema=nommerChamps(z.strictObject({ texte:z.string() }), {texte:{label:'texte',texte:{regime:'narration'}}});`);
  assert.equal(r.fautes.length,1);
  assert.match(r.fautes[0],/narration sans composition proseNommee/);
});

test('les alias canoniques classifient ; un nommeur homonyme local ne classifie pas', () => {
  const r=classificationsProseLocale(ROOT,[fichier(`
    import {z} from 'zod'; import {nommerChamps as nommer} from '../grammaire/meta';
    const schema=nommer(z.strictObject({id:z.string()}),{id:{label:'id',texte:{regime:'technique'}}});
    function local(nommer: any){ return nommer(z.strictObject({nu:z.string()}),{nu:{label:'nu',texte:{regime:'technique'}}}); }
  `)]);
  assert.deepEqual(r.champs.map(c=>[c.champ,c.regime]),[['id','technique'],['nu',undefined]]);
  assert.equal(r.fautes.length,1);
});

test('un opaque local doit argumenter son usage ; le discriminant ne couvre pas une catchall', () => {
  const r=analyser(`
    const schema=nommerChamps(z.strictObject({nu:z.any(), explique:z.unknown(), objet:z.custom<{texte:string}>()}),{
      nu:{label:'nu'}, explique:{label:'expliqué',texte:{regime:'atelier',usage:'objet du catalogue en lecture seule'}}, objet:{label:'objet'}
    });
    const op=nommerChamps(z.looseObject({op:z.string()}),{op:{label:'op',texte:{regime:'technique',usage:'discriminant'}}});
  `);
  assert.equal(r.fautes.length,3);
  assert.ok(r.fautes.some(f=>f.includes('catchall locale sans déclaration')));
});

test('un champ ajouté au payload strict de narration reste analysé sous proseNommee', () => {
  const r=analyser(`import {proseNommee} from '../grammaire/prose';
    const payload=proseNommee(nommerChamps(z.strictObject({op:z.literal('narrative'), oublie:z.string()}),{op:{label:'op'},oublie:{label:'oublié'}}),'narrative.text');
  `);
  assert.equal(r.fautes.length,1);
  assert.match(r.fautes[0],/oublie.*sans classification/);
});

test('une extension locale et les clés ouvertes de record ne disparaissent pas du contrat', () => {
  const r=analyser(`const base=nommerChamps(z.strictObject({type:z.literal('base')}),{type:{label:'type'}});
    const etendu=nommerChamps(base.extend({ajout:z.string(),cles:z.record(z.string(),z.boolean()),borne:z.record(z.enum(['a','b']),z.number())}),{type:{label:'type'},ajout:{label:'ajout'},cles:{label:'clés'},borne:{label:'borné'}});`);
  assert.deepEqual(r.champs.map(c=>c.champ),['ajout','cles']);
  assert.equal(r.fautes.length,2);
});

for (const [cas, texte, champ] of [
  ['abrégé', `const nouveau=z.string(); const schema=z.object({nouveau});`, 'nouveau'],
  ['spread', `const champs={nouveau:z.string()}; const schema=z.object({...champs});`, 'nouveau'],
  ['tuple', `const schema=z.object({t:z.tuple([z.string()])});`, 't'],
  ['catchall', `const schema=z.object({}).catchall(z.string());`, '*'],
]) test(`une sortie ${cas} sans classification rougit`, () => {
  const r = analyser(texte);
  assert.ok(r.champs.some(c => c.champ === champ), JSON.stringify(r));
  assert.ok(r.fautes.length > 0, JSON.stringify(r));
});

test('les champs abrégés classifiés et les métas partagées gardent leur régime', () => {
  const r = analyser(`import {metaDesChamps} from '../grammaire/meta';
    const nouveau=z.string();
    const base=nommerChamps(z.object({nouveau}),{nouveau:{label:'nouveau',texte:{regime:'designation'}}});
    const schema=nommerChamps(z.object({...base.shape}),{...metaDesChamps(base,{exigees:true})});`);
  assert.equal(r.champs.length, 2);
  assert.ok(r.champs.every(c => c.regime === 'designation'));
  assert.deepEqual(r.fautes, []);
});

test('un spread imbriqué ne masque pas une chaîne locale', () => {
  const r = analyser(`const couche={nouveau:z.string()}; const champs={...couche}; const schema=z.object({nested:z.object({...champs})});`);
  assert.deepEqual(r.champs.map(c => c.champ), ['nouveau']);
  assert.equal(r.fautes.length, 1);
});

test('le tuple optionnel raffiné garde les seules sorties ouvertes', () => {
  const r = analyser(`const schema=nommerChamps(z.object({t:z.tuple([z.literal('fixe'),z.string()]).refine(()=>true).optional(), ferme:z.tuple([z.literal('a'),z.number()])}),{t:{label:'tuple',texte:{regime:'technique'}},ferme:{label:'fermé'}});`);
  assert.deepEqual(r.champs.map(c => c.champ), ['t']);
  assert.deepEqual(r.fautes, []);
});

test('les catchalls par alias local ou import restent déclarables, les univers fermés restent fermés', () => {
  const r = analyser(`import {couleurHexSchema as couleur} from '../grammaire/valeurs';
    const ouverte=z.string(); const schema=z.object({}).catchall(ouverte.optional());
    const importee=z.object({}).catchall(couleur); const fermee=z.object({}).catchall(z.enum(['a','b']));`);
  assert.deepEqual(r.champs.map(c => [c.champ,c.sorte]), [['*','chaine'],['*','chaine']]);
  assert.equal(r.fautes.length, 2);
});

test('une déclaration canonique au constructeur final couvre la catchall explicite', () => {
  const r = analyser(`import {nommerNoeud} from '../grammaire/meta';
    const schema=nommerNoeud(z.object({}).catchall(z.string()),{opacite:{nature:'dispatch-op',raison:'fixture de dispatch'}});`);
  assert.equal(r.champs.length, 1);
  assert.deepEqual(r.fautes, []);
});

for (const [cas, expression] of [['chaîne', 'z.string()'], ['transform littéral', "z.number().transform(()=> 'Texte')"], ['transform concaténée', "z.number().transform(n=> 'Texte '+n)"]]) {
  test(`un constructeur abrégé classe la sortie ${cas} du checker`, () => {
    const r = analyser(`const fabriquer=z.strictObject; const schema=fabriquer({nouveau:${expression}});`);
    assert.ok(r.champs.some(c => c.champ === 'nouveau'), JSON.stringify(r));
    assert.ok(r.fautes.length > 0, JSON.stringify(r));
  });
}
