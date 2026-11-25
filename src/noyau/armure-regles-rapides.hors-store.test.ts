/**
 * #4208 — option « Armure, règles rapides » (LDB 63 l.95-103) : les possessions se convertissent aux coutures du
 * noyau (`recevoirLObjet`, `ecrireLesPorteurs`, `patchDeLEquipement`, `fixerLeGroupe`, `assemblerLeHeros`, `herosDeLEngagement`, spawn).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { createHero } from '../engine/character';
import { itemFromTrappingById } from '../engine/items';
import { resetRule, setRule } from '../engine/policy';
import { pretire } from '../data/pregens';
import { makeRNG } from '../engine/dice';
import { giveTrappingSchema } from '../data/schemas/defs-scenes/effets';
import type { Possession } from '../engine/possession';
import type { Combatant, ItemInstance } from '../engine/types';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { applyEffects } from './combatEffects';
import { herosDeLEngagement } from './creation/engagement';
import { PRETIRE_DE_TEST, poserLesPretires } from './creation/pretireDeTest.testkit';
import { patchDeLEquipement } from './monde/carrier';
import { spawnEnemy } from './monde/spawn';
import { retablirUneRegleMaison, surchargerUneRegleMaison } from './reglesMaison';

const REGLE = 'armure-regles-rapides';
afterEach(() => resetRule(REGLE));

const objet = (id: string, equipped = true): ItemInstance => ({ ...itemFromTrappingById(id, idsDeTest)!, equipped });
const heros = (id: string, items: ItemInstance[] = []): Combatant =>
  ({ ...createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: id, seed: 1, id }), items, progression: '5e' });
const mule = (items: ItemInstance[]): Possession =>
  ({ uid: 'mule', ownerId: 'a', nature: 'vehicule', vehicleId: 'diligence', location: { kind: 'avec-le-groupe' }, items });
const armures = (items: readonly ItemInstance[] | undefined) => (items ?? []).filter((i) => i.kind === 'armor').map((i) => i.trappingId);
const herosDe = (banc: Banc, id: string) => banc.getState().party.find((h) => h.id === id)!;

describe('les possessions se convertissent aux coutures du noyau', () => {
  it('un plastron donné devient une armure lourde (`recevoirLObjet`)', () => {
    const banc = ouvrirLeBanc({ reglesMaison: { [REGLE]: true } });
    banc.setState({ party: [heros('a')] });
    applyEffects(() => banc.getState(), banc.setState, [giveTrappingSchema.parse({ type: 'giveTrapping', objet: { id: 'plastron' }, heroId: 'a' })]);
    expect(armures(herosDe(banc, 'a').items)).toEqual(['armure-lourde']);
  });

  it('un heaume transmis à qui porte une armure lourde s’y fond et coche heaume et plastron (`ecrireLesPorteurs`)', () => {
    const banc = ouvrirLeBanc({ reglesMaison: { [REGLE]: true } });
    const heaume = objet('heaume', false);
    banc.setState({ party: [heros('a', [objet('armure-lourde')]), heros('b', [heaume])] });
    banc.getState().transmettreLObjet(heaume.uid, 'a');
    const a = herosDe(banc, 'a');
    expect(armures(a.items)).toEqual(['armure-lourde']);
    expect(a.casesDeCarriere?.soldat?.[1]?.dotations).toEqual(['heaume', 'plastron']);
  });

  it('un heaume transmis à une possession devient une armure lourde (`ecrireLesPorteurs`)', () => {
    const banc = ouvrirLeBanc({ reglesMaison: { [REGLE]: true } });
    const heaume = objet('heaume', false);
    banc.setState({ party: [heros('a', [heaume])], possessions: [mule([])] });
    banc.getState().transmettreLObjet(heaume.uid, 'mule');
    expect(armures(banc.getState().possessions[0].items)).toEqual(['armure-lourde']);
  });

  it('la bascule convertit le groupe et les possessions, et désactiver ne rend pas les pièces (`patchDeLEquipement`)', () => {
    const banc = ouvrirLeBanc();
    banc.setState({ party: [heros('a', [objet('heaume'), objet('plastron')])], possessions: [mule([objet('cotte-de-mailles', false)])] });
    const reprojeter = () => banc.setState(patchDeLEquipement(banc.getState()) ?? {});
    expect(surchargerUneRegleMaison(banc.getState(), REGLE, true, reprojeter)).toBe(true);
    expect(armures(herosDe(banc, 'a').items)).toEqual(['armure-lourde']);
    expect(herosDe(banc, 'a').armour.tete).toBe(3);
    expect(armures(banc.getState().possessions[0].items)).toEqual(['armure-moyenne']);
    expect(retablirUneRegleMaison(banc.getState(), REGLE, reprojeter)).toBe(true);
    expect(armures(herosDe(banc, 'a').items)).toEqual(['armure-lourde']);
  });

  it('le chargement convertit le groupe et les possessions', () => {
    const banc = ouvrirLeBanc({ reglesMaison: { [REGLE]: true }, etat: { party: [heros('a', [objet('heaume')])], possessions: [mule([objet('veste-de-cuir', false)])] } });
    expect(armures(herosDe(banc, 'a').items)).toEqual(['armure-lourde']);
    expect(armures(banc.getState().possessions[0].items)).toEqual(['armure-legere']);
  });

  it('le groupe fixé au lancement naît converti (`fixerLeGroupe`)', () => {
    const banc = ouvrirLeBanc({ reglesMaison: { [REGLE]: true } });
    banc.getState().fixerLeGroupe([heros('a', [objet('heaume'), objet('brassards')])]);
    expect(armures(herosDe(banc, 'a').items)).toEqual(['armure-lourde']);
  });

  it('un prétiré naît converti et fondu (`heroDeFiche`, `assemblerLeHeros`)', () => {
    setRule(REGLE, true);
    const sigrid = pretire(idsDeTest, 'sigrid-sommerfeld');
    expect(armures(sigrid.items).sort()).toEqual(['armure-legere', 'armure-lourde', 'armure-moyenne']);
    expect(sigrid.armour.corps).toBe(5);
  });

  it('un prétiré engagé fond ses possessions tirées aux dés (`herosDeLEngagement`)', () => {
    setRule(REGLE, true);
    poserLesPretires([{ ...PRETIRE_DE_TEST, trappings: [{ id: 'veste-de-cuir' }, { id: 'calotte-de-cuir', count: { roll: { n: 1, sides: 10 } } }] }]);
    const hero = herosDeLEngagement({ pretire: 'pretire-de-test' }, idsDeTest, makeRNG(1));
    expect(armures(hero.items)).toEqual(['armure-legere']);
    expect(hero.armour.tete).toBe(1);
  });

  it('un PNJ apparaît converti et fondu (`spawnEnemy`)', () => {
    setRule(REGLE, true);
    const pnj = spawnEnemy({ ref: 'troll-des-rivieres' }, 'troll', undefined, { inventaire: { heaume: true, plastron: true } });
    expect(armures(pnj.items)).toEqual(['armure-lourde']);
  });
});
