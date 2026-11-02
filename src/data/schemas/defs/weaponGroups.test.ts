/**
 * #3076 — la présentation d'un Groupe vit sur son entrée de `weaponGroups.json` : la charge de chaque `kind`
 * est exigée ou refusée au parse (`refusDeCharge`), `couche` et `palierPA` sont uniques parmi les Groupes
 * d'armure, et un palier 0 est exigé.
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
const ARME: Entree = { id: 'armes-de-fixture', type: 'weaponGroups', label: 'Armes de fixture', kind: 'weapon', combat: 'melee', forme: { id: 'hache' }, maniement: 'lame1m', source: SOURCE };

describe('weaponGroups.json — présentation portée par la donnée (#3076)', () => {
  it('le document réel parse', () => {
    expect(schema.safeParse(weaponGroupsJson).success).toBe(true);
  });

  it('un Groupe AJOUTÉ avec sa charge parse', () => {
    expect(schema.safeParse(avec(ARMURE, ARME)).success).toBe(true);
    expect(schema.safeParse(avec({ ...ARME, id: 'mains-nues-de-fixture', forme: null, maniement: 'poings', poudre: true })).success).toBe(true);
    expect(schema.safeParse(avec({ ...ARMURE, palierPA: 90 })).success).toBe(true);
  });

  it.each([
    ['material', ARMURE, /« armure-de-fixture » \(kind « armour »\) exige « material »/],
    ['couche', ARMURE, /« armure-de-fixture » \(kind « armour »\) exige « couche »/],
    ['palierPA', ARMURE, /« armure-de-fixture » \(kind « armour »\) exige « palierPA »/],
    ['forme', ARME, /« armes-de-fixture » \(kind « weapon »\) exige « forme »/],
    ['maniement', ARME, /« armes-de-fixture » \(kind « weapon »\) exige « maniement »/],
  ])('un Groupe sans `%s` est refusé, nommément', (cle, entree, motif) => {
    const { [cle]: _retire, ...sans } = entree;
    expect(refus(avec(sans as Entree))).toMatch(motif);
  });

  it.each([
    ['couche', { ...ARME, couche: 90 }, 'armour'],
    ['palierPA', { ...ARME, palierPA: 90 }, 'armour'],
    ['material', { ...ARME, material: 'metal' }, 'armour'],
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

  it('une `forme` qui n’est pas une racine est refusée', () => {
    expect(schema.safeParse(avec({ ...ARME, forme: { id: 'forme-de-fixture-absente' } })).success).toBe(false);
  });
});
