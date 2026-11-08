/**
 * LE PORTEUR D'UN OBJET SE LIT DANS L'ÉTAT (#3611 lot E) : un uid n'a qu'un porteur (#2907), donc les verbes d'objet
 * désignent l'objet seul et le noyau en lit le porteur (`porteurDeLObjet`). Un objet que personne ne porte, ou que porte
 * un porteur qui n'a pas le droit au geste, est refusé et le refus se dit. En coop, la possession du geste d'un porteur
 * suit le porteur lu dans l'état (`netOwnership`).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import type { Combatant, ItemInstance } from '../engine/types';
import type { Possession } from '../engine/possession';
import { itemFromTrappingById } from '../engine/items';
import { blessuresDeBase, blessuresSurLeProfil } from '../engine/combattantDeTest.testkit';
import { creditBourse } from './bourseFlow';
import { emptyScene, type Scene } from './monde/scene';
import { resetSceneRegistry } from './monde/registreDesScenes';
import type { WorldMap } from './worldMap';
import { initialNet } from './etat';
import { appliquerLIntentionDUnSiege } from './intentionsDeSiege';
import { porteurDeLObjet } from './monde/carrier';
import { t } from '../i18n';

let banc: Banc;
const g = () => banc.getState();
const dernier = () => g().journal[g().journal.length - 1];
beforeEach(() => { banc = ouvrirLeBanc(); });

const objet = (over: Partial<ItemInstance>): ItemInstance => ({ uid: 'x', label: 'X', kind: 'misc', qualities: [], enc: 0, equipped: false, ...over } as ItemInstance);

function heros(id: string, p: Partial<Combatant> = {}): Combatant {
  return blessuresSurLeProfil({
    id, label: id.toUpperCase(), kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 35, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: blessuresDeBase(12), advantage: 0, conditions: [], movement: 4,
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [{ id: 'evaluation', characteristic: 'intelligence', advances: 10 }], talents: [], fortune: 0, resilience: 0, items: [], pos: { x: 1, y: 1 }, ...p,
  }) as Combatant;
}

const mule = (items: ItemInstance[]): Possession => ({
  uid: 'pos-1', ownerId: 'a', label: 'Grisette', nature: 'bete', ref: { id: 'mule' }, location: { kind: 'avec-le-groupe' }, items,
} as unknown as Possession);

const marchand = (): Scene => {
  const sc = emptyScene('scene-test', 4, 4); sc.id = 'm';
  sc.entities.push({ id: 'pnj', kind: 'personnage', ref: 'humain', pos: { x: 0, y: 0 }, merchant: { archetype: 'armurier' } });
  return sc;
};

const objetDe = (heroId: string, uid: string) => g().party.find((h) => h.id === heroId)!.items!.find((i) => i.uid === uid);

describe('porteurDeLObjet — le porteur de l’uid, lu dans l’état', () => {
  it('rend le héros, la possession, ou personne', () => {
    banc.setState({ party: [heros('a'), heros('b', { items: [objet({ uid: 'lanterne' })] })], possessions: [mule([objet({ uid: 'selle' })])] });
    expect([porteurDeLObjet(g(), 'lanterne'), porteurDeLObjet(g(), 'selle'), porteurDeLObjet(g(), 'personne')]).toEqual(['b', 'pos-1', undefined]);
  });
});

describe('chaque verbe d’objet joue sur le porteur lu dans l’état, jamais sur un autre héros', () => {
  it('equiperLObjet', () => {
    banc.setState({ party: [heros('a'), heros('b', { items: [objet({ uid: 'cape', kind: 'armor', pa: 0 } as Partial<ItemInstance>)] })] });
    g().equiperLObjet('cape');
    expect(objetDe('b', 'cape')?.equipped).toBe(true);
  });

  it('rangerLObjet', () => {
    banc.setState({ party: [heros('a'), heros('b', { items: [objet({ uid: 'sac', container: { capacity: 4 } } as Partial<ItemInstance>), objet({ uid: 'corde', enc: 1 })] })] });
    g().rangerLObjet('corde', 'sac');
    expect(objetDe('b', 'corde')?.inside).toBe('sac');
  });

  it('transmettreLObjet : seul le destinataire se désigne', () => {
    banc.setState({ party: [heros('a'), heros('b', { items: [objet({ uid: 'lanterne' })] })] });
    g().transmettreLObjet('lanterne', 'a');
    expect([objetDe('a', 'lanterne')?.uid, objetDe('b', 'lanterne')]).toEqual(['lanterne', undefined]);
  });

  it('poserLApparence', () => {
    const arme = { ...itemFromTrappingById('arme-simple', idsDeTest)!, uid: 'arme' };
    banc.setState({ party: [heros('a'), heros('b', { items: [arme] })] });
    g().poserLApparence('arme', 'hache');
    expect(objetDe('b', 'arme')?.apparence).toBe('hache');
  });

  it('utiliserLObjet', () => {
    const potion = objet({ uid: 'potion', label: 'Potion de guérison', trappingId: 'potion-de-guerison' });
    banc.setState({ party: [heros('a', { wounds: blessuresDeBase(12, 6) }), heros('b', { wounds: blessuresDeBase(12, 6), items: [potion] })] });
    g().utiliserLObjet('potion');
    expect(g().party.map((h) => h.wounds.current)).toEqual([6, 9]); // BE(35) = 3
  });

  it('entrainerLaProthese', () => {
    const jambe = { ...itemFromTrappingById('fausse-jambe', idsDeTest)!, uid: 'fj', equipped: true };
    banc.setState({ party: [heros('a', { xp: 300 }), heros('b', { xp: 300, items: [jambe] })] });
    g().entrainerLaProthese('fj');
    expect(g().party.map((h) => h.xp)).toEqual([300, 200]);
  });

  it('reparerLObjet : aux frais du porteur', () => {
    const maille = (uid: string) => objet({ uid, trappingId: 'chemise-de-mailles', label: 'Chemise de mailles', kind: 'armor', pa: 3, damageTaken: 2, enc: 1, equipped: true } as Partial<ItemInstance>);
    banc.setState({ party: [heros('a', { items: [maille('ma')] }), heros('b', { items: [maille('mb')] })], scene: marchand() });
    creditBourse(g, banc.setState, 'b', { gold: 5, silver: 0, brass: 0 });
    g().ouvrirLeMarchand('pnj');
    g().reparerLObjet('mb');
    expect([objetDe('a', 'ma')?.damageTaken, objetDe('b', 'mb')?.damageTaken]).toEqual([2, 0]);
  });

  it('evaluerLObjet', () => {
    banc.setState({ party: [heros('a'), heros('b', { items: [objet({ uid: 'inconnu', kind: 'melee', identified: false })] })] });
    g().evaluerLObjet('inconnu');
    expect(g().pendingAppraise?.itemUid).toBe('inconnu');
  });
});

describe('un objet que personne ne porte : chaque verbe le refuse et le dit', () => {
  const sansPorteur = t('pf.objetSansPorteur');
  it.each([
    ['equiperLObjet', () => g().equiperLObjet('personne')],
    ['rangerLObjet', () => g().rangerLObjet('personne', null)],
    ['transmettreLObjet', () => g().transmettreLObjet('personne', 'a')],
    ['poserLApparence', () => g().poserLApparence('personne', 'hache')],
    ['utiliserLObjet', () => g().utiliserLObjet('personne')],
    ['entrainerLaProthese', () => g().entrainerLaProthese('personne')],
    ['evaluerLObjet', () => g().evaluerLObjet('personne')],
    ['reparerLObjet', () => { g().ouvrirLeMarchand('pnj'); g().reparerLObjet('personne'); }],
  ] as const)('%s', (_verbe, geste) => {
    banc.setState({ party: [heros('a', { xp: 300 })], scene: marchand() });
    geste();
    expect(dernier()).toBe(sansPorteur);
  });

  it('un objet d’une possession, pour un geste de héros (ses PX, sa bourse) : refusé et dit', () => {
    banc.setState({ party: [heros('a', { xp: 300 })], possessions: [mule([{ ...itemFromTrappingById('fausse-jambe', idsDeTest)!, uid: 'fj' }])] });
    g().entrainerLaProthese('fj');
    expect([dernier(), g().party[0].xp]).toEqual([t('pf.objetHorsDesHeros'), 300]);
  });
});

describe('reparerLObjet : chaque refus est dit', () => {
  const avec = (it: ItemInstance, ouvrir = true) => {
    banc.setState({ party: [heros('a', { items: [it] })], scene: marchand() });
    creditBourse(g, banc.setState, 'a', { gold: 5, silver: 0, brass: 0 });
    if (ouvrir) g().ouvrirLeMarchand('pnj');
    g().reparerLObjet(it.uid);
  };
  it('sans marchand', () => {
    avec(objet({ uid: 'm', kind: 'armor', damageTaken: 2 }), false);
    expect(dernier()).toBe(t('mf.repairNoMerchant'));
  });
  it('un objet intact', () => {
    avec(objet({ uid: 'm', label: 'Maille', kind: 'armor', damageTaken: 0 }));
    expect(dernier()).toBe(t('mf.repairIntact', { label: 'Maille' }));
  });
  it('un objet qui ne se répare pas', () => {
    avec(objet({ uid: 'm', label: 'Corde', kind: 'misc', damageTaken: 1 }));
    expect(dernier()).toBe(t('mf.repairIrreparable', { label: 'Corde' }));
  });
});

describe('ouvrirLaBoutique : chaque refus est dit', () => {
  it('sans lieu', () => {
    banc.setState({ party: [heros('a')] });
    g().ouvrirLaBoutique('forgeron');
    expect([dernier(), g().merchant]).toEqual([t('mf.boutiqueSansLieu'), null]);
  });

  it('une échoppe que le lieu n’a pas', () => {
    resetSceneRegistry();
    const place = emptyScene('scene-test', 6, 6); place.id = 'place';
    place.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } });
    const worldMap: WorldMap = { id: 'carte', label: 'Carte', routes: [], places: [{ id: 'bourg', label: 'Bourg', pos: { x: 0, y: 0 }, scene: 'place' }] };
    g().fixerLeGroupe([heros('a')]);
    g().chargerLeProjet({ scenes: [place], entryId: 'place', worldMap, projet: null });
    g().ouvrirLaBoutique('forgeron');
    expect([dernier(), g().merchant]).toEqual([t('mf.boutiqueInconnue', { service: 'forgeron' }), null]);
  });
});

describe('coop : le geste d’un porteur revient au siège de ce porteur, lu dans l’état', () => {
  const potion = (uid: string) => objet({ uid, label: 'Potion de guérison', trappingId: 'potion-de-guerison' });
  beforeEach(() => {
    banc.setState({
      party: [heros('a', { wounds: blessuresDeBase(12, 6), items: [potion('pa')] }), heros('b', { wounds: blessuresDeBase(12, 6), items: [potion('pb')] })],
      net: { ...initialNet(), mode: 'host', mySeat: 0, gmSeat: undefined, ownership: { a: 0, b: 1 }, slots: [1, 1, 0, 0], seatNames: { 0: 'Hôte', 1: 'Invité' } },
    });
  });

  it('l’invité ne boit pas la potion du héros de l’hôte', () => {
    expect(appliquerLIntentionDUnSiege(g, 1, 'utiliserLObjet', ['pa'])).toBe('refusee');
    expect([objetDe('a', 'pa')?.uid, g().party[0].wounds.current]).toEqual(['pa', 6]);
  });

  it('l’invité boit la potion de son héros', () => {
    expect(appliquerLIntentionDUnSiege(g, 1, 'utiliserLObjet', ['pb'])).toBe('appliquee');
    expect([objetDe('b', 'pb'), g().party[1].wounds.current]).toEqual([undefined, 9]);
  });

  it('un objet que personne ne porte n’est à aucun siège', () => {
    expect(appliquerLIntentionDUnSiege(g, 1, 'utiliserLObjet', ['personne'])).toBe('refusee');
  });
});
