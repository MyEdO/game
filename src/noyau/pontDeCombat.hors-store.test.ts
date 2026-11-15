/**
 * LE PONT DE COMBAT AU NOYAU (#3059) : le combattant que porte la console à l'ouverture, les États de situation de
 * l'acteur et l'état de charge d'un set se lisent sans écran. Le combat se pose au banc ; les sièges par `net`.
 */
import { describe, it, expect } from 'vitest';
import { ouvrirLeBanc, type EntreesDuBanc } from './banc.testkit';
import { initialNet, type BattleState } from './etat';
import { etatsDeSituation, pontDOuverture } from './pontDeCombat';
import { outnumberMod } from '../engine/combat';
import { loadWeapon, setNonCharge, weaponFromItem } from '../engine/items';
import { combattantDeTest } from '../engine/combattantDeTest.testkit';
import type { Combatant, ItemInstance } from '../engine/types';

const heros = (id: string, over: Partial<Combatant> = {}): Combatant => combattantDeTest({ id, label: id, kind: 'heros', pos: { x: 5, y: 5 }, ...over });
const ennemi = (id: string, over: Partial<Combatant> = {}): Combatant => combattantDeTest({ id, label: id, kind: 'ennemi', pos: { x: 6, y: 5 }, ...over });
const SANS = { assailli: null, cloue: false, renfort: false };
const ko = { wounds: { current: 0, max: 10 }, dead: true } as Partial<Combatant>;

/** Un combat en pause de Round (`turn: -1`) sur `combattants`, dans l'ordre d'initiative donné, avec les sièges `net`. */
function combat(combattants: Combatant[], net: Record<string, unknown> = {}, entrees: EntreesDuBanc = {}) {
  const banc = ouvrirLeBanc(entrees);
  const battle = {
    combatants: combattants, order: combattants.map((c) => c.id), baseOrder: combattants.map((c) => c.id),
    turn: -1, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as unknown as BattleState;
  banc.setState({ battle, mode: 'battle', party: combattants.filter((c) => c.kind === 'heros'), net: { ...initialNet(), ...net } } as never);
  return banc;
}

describe('pontDOuverture — le combattant que la console porte à l’ouverture', () => {
  it('héros piloté vivant : le premier piloté de l’ordre, même derrière un ennemi', () => {
    const b = combat([ennemi('E'), heros('H1'), heros('H2')]);
    expect(pontDOuverture(b.getState())?.id).toBe('H1');
  });

  it('héros KO : le pont passe au héros piloté debout', () => {
    const b = combat([heros('H1', ko), heros('H2')]);
    expect(pontDOuverture(b.getState())?.id).toBe('H2');
  });

  it('embuscade, tous les héros hors d’action : le héros piloté de l’ordre, jamais l’ennemi de tête', () => {
    const b = combat([ennemi('E'), heros('H1', ko)]);
    expect(pontDOuverture(b.getState())?.id).toBe('H1');
  });

  it('partie toute IA (Auto-combat) : le premier héros debout, l’ennemi de tête écarté', () => {
    const b = combat([ennemi('E'), heros('H1', ko), heros('H2')], {}, { cadence: 'auto' });
    expect(pontDOuverture(b.getState())?.id).toBe('H2');
  });

  it('coop, siège invité : le héros de CE siège, pas celui de l’hôte qui le précède', () => {
    const b = combat([heros('H0'), heros('H1')], { mode: 'invite', mySeat: 1, ownership: { H0: 0, H1: 1 }, slots: [0, 1, 0, 0] });
    expect(pontDOuverture(b.getState())?.id).toBe('H1');
  });
});

describe('etatsDeSituation — les États que porte le combat, pas le Combatant', () => {
  const battleDe = (combattants: Combatant[], over: Partial<BattleState> = {}) => ({ ...combat(combattants).getState().battle!, ...over });

  it('un ennemi au contact : pas d’Assailli', () => {
    const H = heros('H');
    expect(etatsDeSituation(null, H, battleDe([H, ennemi('E1')]))).toEqual(SANS);
  });

  it('deux ennemis au contact : Assailli ×2', () => {
    const H = heros('H');
    expect(etatsDeSituation(null, H, battleDe([H, ennemi('E1'), ennemi('E2', { pos: { x: 5, y: 6 } })]))).toEqual({ assailli: { nombre: 2 }, cloue: false, renfort: false });
  });

  it('ennemi hors d’action ignoré', () => {
    const H = heros('H');
    expect(etatsDeSituation(null, H, battleDe([H, ennemi('E1'), ennemi('E2', { pos: { x: 5, y: 6 }, ...ko })]))).toEqual(SANS);
  });

  it('ennemi à un autre niveau (z, 4 m plus haut) : pas au contact', () => {
    const H = heros('H');
    expect(etatsDeSituation(null, H, battleDe([H, ennemi('E1'), ennemi('E2', { pos: { x: 5, y: 6, z: 1, h: 4 } })]))).toEqual(SANS);
  });

  it('Assailli suit le Surnombre de la résolution (LDB 14 l.110) : un camp au contact, jamais deux camps additionnés', () => {
    const H = heros('H');
    const neutre = combattantDeTest({ id: 'N', label: 'N', kind: 'pnj', pos: { x: 5, y: 6 } });
    // Un ennemi et un PNJ au contact : aucun camp n'est à deux contre un — la résolution n'accorde aucun Surnombre.
    expect(outnumberMod(1)).toBeNull();
    expect(etatsDeSituation(null, H, battleDe([H, ennemi('E1'), neutre]))).toEqual(SANS);
  });

  it('Cloué : le Test d’approche raté de ce Tour', () => {
    const H = heros('H', { pos: undefined });
    expect(etatsDeSituation(null, H, battleDe([H], { fearGate: 'failed' }))).toEqual({ assailli: null, cloue: true, renfort: false });
  });

  it('Renfort : le servant qui n’est pas le chef de pièce ; le chef ne l’est pas', () => {
    const poste = { crewIds: ['chef', 'aide'] } as never;
    const chef = heros('chef', { pos: undefined, mannedPoste: poste });
    const aide = heros('aide', { pos: undefined, mannedPoste: poste });
    const b = battleDe([chef, aide]);
    expect(etatsDeSituation(null, aide, b)).toEqual({ assailli: null, cloue: false, renfort: true });
    expect(etatsDeSituation(null, chef, b)).toEqual(SANS);
  });
});

describe('setNonCharge — un set porte-t-il une arme à distance à recharger ?', () => {
  const arbalete = { uid: 'w-arb', label: 'Arbalète', kind: 'distance', subType: 'Arbalète', damage: { plusBF: false, flat: 9 }, range: 60, qualities: [{ id: 'recharge', value: 1 }], enc: 1, equipped: true } as ItemInstance;
  const arc = { uid: 'w-arc', label: 'Arc', kind: 'distance', subType: 'Arc', damage: { plusBF: false, flat: 4 }, range: 50, qualities: [], enc: 1, equipped: true } as ItemInstance;
  const porteur = () => heros('H', { items: [{ ...arbalete }, { ...arc }], loadouts: [{ id: 'arb', main: 'w-arb' }, { id: 'arc', main: 'w-arc' }] as never, activeLoadoutId: 'arc' });

  it('arme à recharge non chargée, dans un set NON ACTIF : non chargé', () => {
    const H = porteur();
    expect(setNonCharge(H, H.loadouts![0])).toBe(true);
  });

  it('arme à recharge chargée par la couture de charge : prête', () => {
    const H = porteur();
    loadWeapon(H, weaponFromItem(H.items!.find((i) => i.uid === 'w-arb')!));
    expect(setNonCharge(H, H.loadouts![0])).toBe(false);
  });

  it('arme sans Indice de Recharge : toujours prête', () => {
    const H = porteur();
    expect(setNonCharge(H, H.loadouts![1])).toBe(false);
  });
});
