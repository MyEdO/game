// Morsures de `auditObjetsPorteur` sur des sources EN MÉMOIRE (`virtualProgram`) : chaque forme
// d'écriture du placement et chaque forme d'entrée est attrapée hors de la couture, la couture et les
// listes `items` d'un autre type passent.
import test from 'node:test'
import assert from 'node:assert/strict'
import { auditObjetsPorteur } from './objetsPorteur.mjs'
import { virtualProgram, VIRTUAL_ROOT } from './tsProgram.mjs'

const SOCLE = {
  'src/engine/types.ts': `
export interface ItemInstance { uid: string; label: string; equipped: boolean; inside?: string }
export interface WeaponLoadout { id: string; main?: string; off?: string }
export interface Combatant { id: string; items?: ItemInstance[]; loadouts?: WeaponLoadout[] }
`,
  'src/engine/possession.ts': `
import type { ItemInstance } from './types';
interface PossessionCommon { uid: string; items: ItemInstance[] }
export type Possession = PossessionCommon & ({ nature: 'bete' } | { nature: 'vehicule' });
`,
  'src/engine/carrier.ts': `
import type { Combatant } from './types';
import type { Possession } from './possession';
export type Carrier = { kind: 'hero'; hero: Combatant } | { kind: 'possession'; possession: Possession };
`,
  'src/engine/items.ts': `
import type { Carrier } from './carrier';
import type { ItemInstance } from './types';
export function stowIn(p: Carrier, it: ItemInstance, bag: string): void { it.inside = bag; it.equipped = false; }
export function unstow(p: Carrier, it: ItemInstance): void { delete it.inside; }
export function toggleWorn(p: Carrier, it: ItemInstance): void { it.equipped = !it.equipped; }
export function receiveItems(p: Carrier, charge: ItemInstance[]): void {
  if (p.kind === 'hero') p.hero.items = [...(p.hero.items ?? []), ...charge];
  else p.possession.items.push(...charge);
}
`,
}

const audit = (code) =>
  auditObjetsPorteur(VIRTUAL_ROOT, virtualProgram({ ...SOCLE, 'src/x.ts': `
import type { Combatant, ItemInstance } from './engine/types';
import type { Possession } from './engine/possession';
declare const c: Combatant; declare const p: Possession; declare const it: ItemInstance;
declare const patch: Partial<ItemInstance>; declare const autre: { items: ItemInstance[] };
${code}
` }))

test('auditObjetsPorteur : la couture passe, chaque forme hors couture est attrapée', () => {
  assert.deepEqual(audit(''), [], 'la couture seule')
  const cas = [
    ['it.inside = "sac";', 'placement', 'affectation'],
    ['it.equipped = true;', 'placement', 'affectation'],
    ['it.inside ??= "sac";', 'placement', 'affectation'],
    ['delete it.inside;', 'placement', 'delete'],
    ['(c.items ?? [])[0]!.equipped = false;', 'placement', 'affectation'],
    ['Object.assign(it, patch);', 'placement', 'Object.assign'],
    ['c.items!.push(it);', 'entree', 'push'],
    ['(c.items ??= []).unshift(it);', 'entree', 'unshift'],
    ['p.items.splice(0, 0, it);', 'entree', 'splice'],
    ['const l = c.items ?? []; l.push(it);', 'entree', 'push'],
    ['c.items = [\n  ...(c.items ?? []),\n  it,\n];', 'entree', 'affectation étendue'],
    ['p.items = p.items.concat(it);', 'entree', 'affectation étendue'],
    ['const d = { ...c, items: [...(c.items ?? []), it] };', 'entree', 'littéral d’objet'],
  ]
  for (const [code, angle, forme] of cas) {
    const r = audit(code)
    assert.equal(r.length, 1, `${code} → ${JSON.stringify(r)}`)
    assert.equal(r[0].angle, angle, code)
    assert.equal(r[0].forme, forme, code)
    assert.match(r[0].at, /^src\/x\.ts:\d+$/, code)
  }
})

test('auditObjetsPorteur : retrait, construction et liste d’un autre type passent', () => {
  const passent = [
    'c.items = (c.items ?? []).filter((i) => i.uid !== "a");',
    'c.items = [it];',
    'const n: ItemInstance = { ...it, equipped: true };',
    'autre.items.push(it);',
    'autre.items = [...autre.items, it];',
    'p.items.splice(0, 1);',
    'Object.assign(it, { label: "x" });',
    'const lu = it.inside === "sac" && it.equipped;',
  ]
  for (const code of passent) assert.deepEqual(audit(code), [], code)
})

test('auditObjetsPorteur : une fonction homonyme de la couture hors de `src/engine/items.ts` est attrapée', () => {
  const r = audit('function stowIn(i: ItemInstance): void { i.inside = "sac"; }\nfunction receiveItems(): void { c.items!.push(it); }')
  assert.deepEqual(r.map((e) => e.forme), ['affectation', 'push'])
})
