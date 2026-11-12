/**
 * LES GESTES DE COMBAT HORS DE LA BARRE DISENT LEUR REFUS (#3700, épique #3366) : chacun prend le verdict de la barre
 * (`etatDeLaBarre` : combat clos, actif non piloté, main tenue), un Sort qui désigne ses cibles ou pose sa zone
 * (`pendingCast`), puis ses refus propres, chacun dit par `refuserGesteDuSiege`. Refusé, le geste ne change rien d'autre.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import type { Combatant, ItemInstance, Weapon } from '../engine/types';
import { blessuresDeBase, blessuresSurLeProfil } from '../engine/combattantDeTest.testkit';
import { COND } from '../engine/conditions';
import { initialNet } from './etat';
import { t } from '../i18n';

let banc: Banc;
const g = () => banc.getState();
const refus = () => g().refus?.texte;
beforeEach(() => { banc = ouvrirLeBanc(); });

const langue = { id: 'langue', spec: 'magick', characteristic: 'intelligence' as const, advances: 20 };
const lance: Weapon = { label: 'Pertuisane', type: 'melee', reach: 'Longue', damage: { plusBF: true, flat: 5 }, qualities: [] };
const arme = (uid: string, label: string): ItemInstance =>
  ({ uid, label, kind: 'melee', qualities: [], enc: 1, equipped: true, hands: 1, damage: { plusBF: true, flat: 4 } }) as ItemInstance;

function combattant(id: string, p: Partial<Combatant> = {}): Combatant {
  return blessuresSurLeProfil({
    id, label: id.toUpperCase(), kind: 'heros',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 40, 'force-mentale': 30, sociabilite: 30 },
    wounds: blessuresDeBase(12), advantage: 0, conditions: [], movement: 4,
    weapons: [lance], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [langue], talents: [], spells: ['forme-bestiale'], items: [arme('e', 'Épée'), arme('ha', 'Hache')],
    loadouts: [{ id: 'lo-epee', main: 'e' }, { id: 'lo-hache', main: 'ha' }], activeLoadoutId: 'lo-epee', pos: { x: 1, y: 1 }, ...p,
  }) as Combatant;
}

/** L'actif `a`, un héros `b`, et l'ennemi `e` qu'`a` engage et empoigne, qui porte un Maléfice à dissiper. */
function enBataille(over: Record<string, unknown> = {}, actif: Partial<Combatant> = {}) {
  const a = combattant('a', { engagedWith: ['e'], grapplingWith: ['e'], ...actif });
  const b = combattant('b', { pos: { x: 3, y: 3 } });
  const e = combattant('e', {
    kind: 'ennemi', pos: { x: 2, y: 1 }, engagedWith: ['a'], grapplingWith: ['a'],
    activeEffects: [{ label: 'Malédiction', characteristic: 'agilite', bonus: -10, duration: { scale: 'rounds', left: 9 },
      spell: { spellId: 'malefice', ni: 2, casterId: 'sorcier', label: 'Maléfice' } }],
  } as Partial<Combatant>);
  banc.setState({
    party: [a, b], refus: null,
    battle: {
      combatants: [a, b, e], order: ['a', 'b', 'e'], turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
      movementUsed: 0, movedPreAction: false, acted: false, loadoutSwapped: false, over: null, log: [], ...over,
    } as never,
  });
}

const vif = (id: string) => g().battle!.combatants.find((c) => c.id === id)!;

/** Ce que chaque geste change quand il joue : refusé, rien de tout cela ne bouge. */
const empreinte = () => ({
  pendings: [g().pendingAuContact, g().pendingGrapple, g().pendingRun, g().pendingFocus, g().pendingDispel].map((p) => p ?? null),
  action: g().battle!.action, armee: g().battle!.endTurnArmed ?? null, set: vif('a').activeLoadoutId, swap: g().battle!.loadoutSwapped,
});

const GESTES = [
  ['ouvrirLAuContact', () => g().ouvrirLAuContact('e')],
  ['ouvrirLEmpoignade', () => g().ouvrirLEmpoignade('e')],
  ['ouvrirLaCourse', () => g().ouvrirLaCourse({ x: 1, y: 3 }, { path: [{ x: 1, y: 2 }, { x: 1, y: 3 }], cost: 2 })],
  ['armerLaFinDuTour', () => g().armerLaFinDuTour()],
  ['prendreLaPanoplie', () => g().prendreLaPanoplie('a', 'lo-hache')],
  ['armerLeMode', () => g().armerLeMode('dissipation')],
  ['desarmerLeMode', () => g().desarmerLeMode()],
  ['incanterLeSort', () => g().incanterLeSort('a', 'forme-bestiale')],
  ['focaliserLeSort', () => g().focaliserLeSort('a', 'arme-aethyrique')],
  ['dissiperLeSort', () => g().dissiperLeSort('a', 'malefice', 'sorcier')],
] as const;

describe('le verdict de la barre : chaque geste refusé le dit, et ne change rien d’autre', () => {
  it.each(GESTES)('%s : en combat clos, personne n’agit', (_v, geste) => {
    enBataille({ over: 'victoire' });
    const avant = empreinte();
    geste();
    expect([refus(), empreinte()]).toEqual([t('barre.personneNAgit'), avant]);
  });

  it.each(GESTES)('%s : l’actif n’est pas piloté, et hors de vue il n’est pas nommé', (_v, geste) => {
    enBataille({ order: ['e', 'a', 'b'] });
    const avant = empreinte();
    geste();
    expect([refus(), empreinte()]).toEqual([t('barre.nonPilote', { name: t('vision.horsDeVue') }), avant]);
  });

  it.each(GESTES)('%s : une modale tient la main', (_v, geste) => {
    enBataille();
    banc.setState({ pendingDualStrike: { attackerId: 'a' } as never });
    const avant = empreinte();
    geste();
    expect([refus(), empreinte()]).toEqual([t('barre.mainTenue'), avant]);
  });

  it.each(GESTES)('%s : un Sort qui désigne ses cibles tient la main', (_v, geste) => {
    enBataille();
    banc.setState({ pendingCast: { casterId: 'a', spellId: 'x', pickingTargets: true } as never });
    const avant = empreinte();
    geste();
    expect([refus(), empreinte()]).toEqual([t('barre.mainTenue'), avant]);
  });
});

describe('coop : un siège qui ne pilote pas l’actif est refusé, et le refus est dit', () => {
  it.each(GESTES)('%s', (_v, geste) => {
    enBataille();
    banc.setState({ net: { ...initialNet(), mode: 'hote', mySeat: 0, gmSeat: undefined, ownership: { a: 1, b: 0 }, slots: [1, 1, 0, 0], seatNames: { 0: 'Hôte', 1: 'Invité' } } });
    const avant = empreinte();
    geste();
    expect([refus(), empreinte()]).toEqual([t('barre.nonPilote', { name: 'A' }), avant]);
  });
});

describe('le geste d’un autre que l’actif est refusé et dit', () => {
  it.each([
    ['prendreLaPanoplie', () => g().prendreLaPanoplie('b', 'lo-hache')],
    ['incanterLeSort', () => g().incanterLeSort('b', 'forme-bestiale')],
    ['focaliserLeSort', () => g().focaliserLeSort('b', 'arme-aethyrique')],
    ['dissiperLeSort', () => g().dissiperLeSort('b', 'malefice', 'sorcier')],
  ] as const)('%s', (_v, geste) => {
    enBataille();
    const avant = empreinte();
    geste();
    expect([refus(), empreinte()]).toEqual([t('cs.horsDuTour', { name: 'B' }), avant]);
  });
});

describe('les refus propres à chaque geste sont dits', () => {
  it.each([
    ['ouvrirLAuContact', () => g().ouvrirLAuContact('e')],
    ['ouvrirLEmpoignade', () => g().ouvrirLEmpoignade('e')],
    ['incanterLeSort', () => g().incanterLeSort('a', 'forme-bestiale')],
  ] as const)('%s : l’Action déjà dépensée', (_v, geste) => {
    enBataille({ acted: true });
    const avant = empreinte();
    geste();
    expect([refus(), empreinte()]).toEqual([t('agate.actionSpent'), avant]);
  });

  it.each([
    ['ouvrirLAuContact', () => g().ouvrirLAuContact('b')],
    ['ouvrirLEmpoignade', () => g().ouvrirLEmpoignade('b')],
  ] as const)('%s : une cible hors du geste', (_v, geste) => {
    enBataille();
    const avant = empreinte();
    geste();
    expect([refus(), empreinte()]).toEqual([t('offre.sansCandidatDuContexte'), avant]);
  });

  it('ouvrirLAuContact : l’actif hors d’état d’agir', () => {
    enBataille({}, { conditions: [{ id: COND.inconscient, value: 1 }] });
    g().ouvrirLAuContact('e');
    expect([refus(), g().pendingAuContact ?? null]).toEqual([t('agate.unableToAct'), null]);
  });

  it('prendreLaPanoplie : le set déjà changé ce tour', () => {
    enBataille({ loadoutSwapped: true });
    g().prendreLaPanoplie('a', 'lo-hache');
    expect([refus(), vif('a').activeLoadoutId]).toEqual([t('agate.loadoutSwapped'), 'lo-epee']);
  });

  it('dissiperLeSort : sans Langue (Magick)', () => {
    enBataille({}, { skills: [] });
    g().dissiperLeSort('a', 'malefice', 'sorcier');
    expect([refus(), g().pendingDispel ?? null]).toEqual([t('cs.cannotDispel'), null]);
  });

  it('dissiperLeSort : un Sort que le porteur ne porte pas', () => {
    enBataille();
    g().dissiperLeSort('a', 'malefice', 'personne');
    expect([refus(), g().pendingDispel ?? null]).toEqual([t('offre.sansCandidatDuContexte'), null]);
  });
});

describe('admis, chaque geste joue encore', () => {
  it('ouvrirLAuContact ouvre le Test opposé', () => {
    enBataille();
    g().ouvrirLAuContact('e');
    expect([refus() ?? null, g().pendingAuContact?.phase]).toEqual([null, 'jet']);
  });

  it('ouvrirLEmpoignade ouvre le Test opposé', () => {
    enBataille();
    g().ouvrirLEmpoignade('e');
    expect([refus() ?? null, !!g().pendingGrapple]).toEqual([null, true]);
  });

  it('ouvrirLaCourse ouvre le Test de Course', () => {
    enBataille({}, { engagedWith: [], grapplingWith: [] });
    g().ouvrirLaCourse({ x: 1, y: 3 }, { path: [{ x: 1, y: 2 }, { x: 1, y: 3 }], cost: 2 });
    expect([refus() ?? null, g().pendingRun?.combatantId]).toEqual([null, 'a']);
  });

  it('armerLaFinDuTour arme la fin', () => {
    enBataille();
    g().armerLaFinDuTour();
    expect([refus() ?? null, !!g().battle!.endTurnArmed]).toEqual([null, true]);
  });

  it('prendreLaPanoplie prend le set', () => {
    enBataille();
    g().prendreLaPanoplie('a', 'lo-hache');
    expect([refus() ?? null, vif('a').activeLoadoutId, g().battle!.loadoutSwapped]).toEqual([null, 'lo-hache', true]);
  });

  it('armerLeMode arme le mode, desarmerLeMode le désarme', () => {
    enBataille();
    g().armerLeMode('dissipation');
    const arme = g().battle!.action;
    g().desarmerLeMode();
    expect([refus() ?? null, arme, g().battle!.action]).toEqual([null, 'dissipation', null]);
  });

  it('incanterLeSort arme l’incantation', () => {
    enBataille();
    g().incanterLeSort('a', 'forme-bestiale');
    expect([refus() ?? null, g().battle!.action, g().battle!.selectedSpellId]).toEqual([null, 'incantation', 'forme-bestiale']);
  });

  it('focaliserLeSort ouvre la Focalisation', () => {
    enBataille({}, { spells: ['arme-aethyrique'], skills: [langue, { id: 'focalisation', characteristic: 'force-mentale', advances: 10 }] });
    g().focaliserLeSort('a', 'arme-aethyrique');
    expect([refus() ?? null, g().pendingFocus?.spellId]).toEqual([null, 'arme-aethyrique']);
  });

  it('dissiperLeSort ouvre la Dissipation', () => {
    enBataille();
    g().dissiperLeSort('a', 'malefice', 'sorcier');
    expect([refus() ?? null, g().pendingDispel?.ni]).toEqual([null, 2]);
  });
});
