/**
 * #3076 — la présentation d'un Groupe vit sur son entrée de `weaponGroups.json` : la charge de chaque `kind`
 * est exigée ou refusée au parse (`refusDeCharge`), `couche` et `palierPA` sont uniques parmi les Groupes
 * d'armure, un palier 0 est exigé, et la teinte d'un Groupe d'armure est une teinte d'objet (#3456).
 */
import { describe, expect, it } from 'vitest';
import { schema } from './weaponGroups';
import weaponGroupsJson from '../../weaponGroups.json';

type Entree = { id: string; kind: string; [k: string]: unknown };
const avec = (...entrees: Entree[]): Entree[] => [...(structuredClone(weaponGroupsJson) as Entree[]), ...entrees];
const refus = (doc: unknown): string => {
  const r = schema.safeParse(doc);
  expect(r.success, 'le document a parsé alors qu’il devait être REFUSÉ').toBe(false);
  return r.success ? '' : r.error.issues.map((i) => i.message).join(' ');
};
const SOURCE = { book: 'livre-de-base', page: 300 };
const ARMURE: Entree = { id: 'armure-de-fixture', type: 'weaponGroups', label: 'Armure de fixture', kind: 'armour', material: 'leather', couche: 90, palierPA: null, source: SOURCE };
const ARME: Entree = { id: 'armes-de-fixture', type: 'weaponGroups', label: 'Armes de fixture', kind: 'weapon', combat: 'melee', maniement: 'lame1m', source: SOURCE };

describe('weaponGroups.json — présentation portée par la donnée (#3076)', () => {
  it('le document réel parse', () => {
    expect(schema.safeParse(weaponGroupsJson).success).toBe(true);
  });

  it('un Groupe AJOUTÉ avec sa charge parse', () => {
    expect(schema.safeParse(avec(ARMURE, ARME)).success).toBe(true);
    expect(schema.safeParse(avec({ ...ARME, id: 'mains-nues-de-fixture', maniement: 'poings', poudre: true })).success).toBe(true);
    expect(schema.safeParse(avec({ ...ARMURE, palierPA: 90 })).success).toBe(true);
    expect(schema.safeParse(avec({ ...ARMURE, teinte: { id: 'aethyrique' } })).success).toBe(true);
  });

  it('la teinte d’un Groupe d’armure est une teinte d’objet de `materials.json` (#3456)', () => {
    refus(avec({ ...ARMURE, teinte: { id: 'acier' } }));
    refus(avec({ ...ARMURE, teinte: { id: 'inconnue' } }));
  });

  it.each([
    ['material', ARMURE, /« armure-de-fixture » \(kind « armour »\) exige « material »/],
    ['couche', ARMURE, /« armure-de-fixture » \(kind « armour »\) exige « couche »/],
    ['palierPA', ARMURE, /« armure-de-fixture » \(kind « armour »\) exige « palierPA »/],
    ['maniement', ARME, /« armes-de-fixture » \(kind « weapon »\) exige « maniement »/],
  ])('un Groupe sans `%s` est refusé, nommément', (cle, entree, motif) => {
    const { [cle]: _retire, ...sans } = entree;
    expect(refus(avec(sans as Entree))).toMatch(motif);
  });

  it.each([
    ['couche', { ...ARME, couche: 90 }, 'armour'],
    ['palierPA', { ...ARME, palierPA: 90 }, 'armour'],
    ['material', { ...ARME, material: 'metal' }, 'armour'],
    ['teinte', { ...ARME, teinte: { id: 'aethyrique' } }, 'armour'],
    ['maniement', { ...ARMURE, maniement: 'lame1m' }, 'weapon'],
    ['combat', { ...ARMURE, combat: 'melee' }, 'weapon'],
    ['poudre', { ...ARMURE, poudre: true }, 'weapon, ammo'],
  ])('`%s` hors de son `kind` est refusé', (cle, entree, porteurs) => {
    expect(refus(avec(entree))).toContain(`« ${cle} » n’appartient qu’au(x) cas kind « ${porteurs} »`);
  });

  it('une `couche` ou un `palierPA` déjà porté par un autre Groupe d’armure est refusé', () => {
    expect(refus(avec({ ...ARMURE, couche: 2 }))).toMatch(/« armure-de-fixture » et « mailles » portent le même couche 2/);
    expect(refus(avec({ ...ARMURE, palierPA: 2 }))).toMatch(/« armure-de-fixture » et « mailles » portent le même palierPA 2/);
  });

  it('sans Groupe d’armure au palier 0, le document est refusé', () => {
    const doc = (structuredClone(weaponGroupsJson) as Entree[]).map((g) => (g.palierPA === 0 ? { ...g, palierPA: 1 } : g));
    expect(refus(doc)).toMatch(/aucun Groupe d’armure au palierPA 0/);
  });

});

/** AA 08 l.194 */
describe('weaponGroups.json — un Groupe d’arme manié aussi dans un autre Groupe de Corps à corps', () => {
  it.each([
    ['inventé', 'base-de-fantaisie', /« base-de-fantaisie » est hors de la sous-liste « melee »/],
    ['de Projectiles', 'arc', /« arc » est hors de la sous-liste « melee »/],
  ])('un Groupe %s est refusé, nommément', (_cas, groupe, motif) => {
    expect(refus(avec({ ...ARME, manieAussi: { [groupe]: {} } }))).toMatch(motif);
  });

  it('`manieAussi` hors d’un Groupe d’arme est refusé', () => {
    expect(refus(avec({ ...ARMURE, manieAussi: { base: {} } }))).toContain('« manieAussi » n’appartient qu’au(x) cas kind « weapon »');
  });
});
