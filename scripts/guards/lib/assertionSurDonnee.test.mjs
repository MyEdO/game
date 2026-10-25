import test from 'node:test'
import assert from 'node:assert/strict'
import { sitesAssertionSurDonnee } from './assertionSurDonnee.mjs'

const TEST = 'src/engine/temoin.test.ts'
/** La couche de donnée témoin : un module d'index qui charge des JSON, un schéma, un module de règle. */
const MODULES = {
  'src/data/index': [
    "import careersJson from './careers.json';",
    "import tablesJson from './tables.json';",
    "import propsJson from './props.json';",
    "import creaturesJson from './creatures.json';",
    'export const careers = careersJson;',
    'export const tables = tablesJson;',
    'export const props = propsJson;',
    'export const creatures = creaturesJson;',
    "import { indexParId } from './versionDataset';",
    "const tableParId = indexParId('tables', tables);",
    'export const findTableById = (id) => tableParId.get(id);',
    'export function cibleCodex(r) { return { category: r.type, id: r.id }; }',
    'export function premiereCarriere() { return careers[0]; }',
    "export * from './schemas/_registry.generated';",
  ].join('\n'),
  'src/data/schemas/valider': "import { z } from 'zod';\nexport function fautes(doc) { return z.object({}).safeParse(doc).error?.issues ?? []; }",
  'src/engine/morale': [
    "import moraleJson from '../data/crew-morale.json';",
    'export const FACTEURS = moraleJson.factors;',
    'export function recalc(xs) { return moraleJson.factors.filter((f) => xs.includes(f.id)); }',
  ].join('\n'),
  'src/engine/relais': "export { FACTEURS as TOUS } from './morale';",
}
const lireModule = (chemin) => {
  const rel = [chemin, `${chemin}/index`].find((c) => Object.hasOwn(MODULES, c))
  return rel ? { rel: `${rel}.ts`, text: MODULES[rel] } : null
}
const sites = (lignes) => sitesAssertionSurDonnee({ rel: TEST, text: lignes.join('\n') }, { lireModule })
const motifs = (lignes) => sites(lignes).map((s) => `${s.ligne}:${s.motif}:${s.portee}`)

test('compte : toHaveLength et toBe sur .length d\'un ensemble de la donnée', () => {
  assert.deepEqual(motifs([
    "import { careers } from '../data';",
    "import gens from '@/data/gens.json';",
    'const actifs = careers.filter((c) => c.actif);',
    'expect(careers).toHaveLength(12);',
    'expect(actifs.length).toBe(3);',
    'expect(Object.keys(gens).length, "msg").toEqual(4);',
  ]), ['4:compte:ensemble', '5:compte:ensemble', '6:compte:ensemble'])
})

test('compte : objet de comptes, compte par entrée d\'un chargeur, et dans une boucle', () => {
  assert.deepEqual(motifs([
    "import { tables, findTableById, premiereCarriere } from '../data/index';",
    'const parSorte = {};',
    'expect(tables.reduce((acc, t) => ({ ...acc, [t.kind]: (acc[t.kind] ?? 0) + 1 }), parSorte)).toEqual({ a: 2, b: 3 });',
    'for (const t of tables) expect(t.rows).toHaveLength(10);',
    'tables.forEach((t2) => { expect(t2.rows.length).toBe(10); });',
    "expect(findTableById('x').rows).toHaveLength(100);",
    'const sortes = new Set();',
    'for (const t of tables) sortes.add(t.kind);',
    'expect(sortes.size).toBe(4);',
    'expect(premiereCarriere().skills).toHaveLength(8);',
  ]), ['3:compte:ensemble', '4:compte:entree', '5:compte:entree', '6:compte:entree', '9:compte:entree', '10:compte:entree'])
})

test('liste : toEqual d\'un tableau de littéraux', () => {
  assert.deepEqual(motifs([
    "import { props } from '../data';",
    "expect(props.map((p) => p.id).sort()).toEqual(['banc', 'table']);",
  ]), ['2:liste:ensemble'])
})

test('snapshot : toMatchSnapshot et toMatchInlineSnapshot', () => {
  assert.deepEqual(motifs([
    "import { creatures } from '../data';",
    'const rendus = () => creatures.map((c) => c.id);',
    'expect(rendus()).toMatchSnapshot();',
    'expect(creatures[0]).toMatchInlineSnapshot(`{}`);',
  ]), ['3:snapshot:ensemble', '4:snapshot:entree'])
})

test('suivi inter-module : une constante exportée dérivée de la donnée est une source, une fonction de règle ne l\'est pas', () => {
  assert.deepEqual(motifs([
    "import { FACTEURS, recalc } from './morale';",
    "import { TOUS } from './relais';",
    "import { REGISTRE } from '../data';",
    'expect(FACTEURS).toHaveLength(28);',
    'expect(TOUS.length).toBe(28);',
    "expect(recalc(['a', 'b'])).toHaveLength(2);",
    'expect(Object.keys(REGISTRE)).toEqual(["x"]);',
  ]), ['4:compte:ensemble', '5:compte:ensemble', '7:liste:ensemble'])
})

test('négatifs : fixture, sortie de règle sur fixture ou sur une entrée, cliquet de dette, liste d\'écarts vide, import de type, portée masquée', () => {
  assert.deepEqual(sites([
    "import { careers, cibleCodex, type Career } from '../data';",
    "import type { Spell } from '../data/spells';",
    "import { fautes } from '../data/schemas/valider';",
    "import { STOCK } from '../../scripts/guards/lib/stockTemoin.mjs';",
    "import { resoudre } from './regle';",
    "const fixture: Career[] = [{ id: 'a' }, { id: 'b' }];",
    'expect(fixture).toHaveLength(2);',
    "expect(fixture.map((c) => c.id)).toEqual(['a', 'b']);",
    'expect(resoudre(fixture).ops).toHaveLength(1);',
    'expect(resoudre(careers[0]).ops).toHaveLength(1);',
    "expect(fautes({ titre: '' })).toEqual(['titre vide']);",
    "expect(cibleCodex({ type: 'a', id: 'b' })).toEqual({ category: 'a', id: 'b' });",
    'expect(STOCK.length).toBe(12);',
    'expect(careers.length).toBeLessThanOrEqual(400);',
    'expect(careers.filter((c) => !c.id)).toEqual([]);',
    'expect(careers.length).toBeGreaterThan(0);',
    "expect(careers.find((c) => c.id === 'x')?.label).toBe('X');",
    'function locale(careers: number[]) { expect(careers).toHaveLength(2); }',
    'const [, second] = [1, 2];',
    'const spells: Spell[] = [];',
    'expect(spells).toHaveLength(0);',
  ]), [])
})
