/**
 * Une gratuite a UN nom, celui de sa manœuvre (`def.label`), lu par tous les écrans : l'option d'attaque,
 * le réticule, la modale d'attaque et la modale de défense lisent l'arme de la gratuite
 * (`freeAttackWeapon` via `armeDeLaGratuite`).
 * LDB 85 l.387 ; LDB 85 l.237 ; LDB 85 l.47 — #1765.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { hoverTargeting } from '../noyau/targeting';
import { availableAttacks } from '../noyau/combatManeuvers';
import { attackWeaponOf, maybeOpenDefense } from '../noyau/combatFlow';
import { createHero } from '../engine/character';
import { attaqueNaturelle } from '../engine/creatureAttacks';
import { testScene } from '../scenes/test-fixture';
import type { Combatant } from '../engine/types';
import type { TraitList } from '../engine/statEntry';
import type { SuiteDeCoup } from '../noyau/pendings';

const g = () => useGame.getState();
const TRAITS: TraitList = [{ id: 'morsure', value: 7 }, { id: 'attaque-caudale', value: 7 }];
const GRATUITES = ['morsure', 'caudale', 'pietinement'];
const nomDeLaManoeuvre = (kind: string): string => attaqueNaturelle(TRAITS, kind)!.def.label;

/** Héros Énorme au contact d'un ennemi Moyen ; `tourDe` porte les traits et le tour. */
function engage(tourDe: 'heros' | 'creature'): { H: Combatant; E: Combatant } {
  const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
  useGame.setState({ party: [hero] });
  g().seedRng(5);
  g().startScene(testScene());
  g().startCombat('enc-mutants');
  g().confirmRoundStart();
  vi.clearAllTimers();
  const b = g().battle!;
  const H = b.combatants.find((c) => c.kind === 'hero')!;
  const [E] = b.combatants.filter((c) => c.kind === 'enemy');
  b.combatants.filter((c) => c.kind === 'enemy' && c.id !== E.id).forEach((e) => (e.dead = true));
  const [porteur, cible] = tourDe === 'heros' ? [H, E] : [E, H];
  porteur.traits = TRAITS;
  porteur.size = 'enorme';
  cible.size = 'moyenne';
  porteur.advantage = 6;
  H.pos = { x: 7, y: 10 }; E.pos = { x: 6, y: 10 };
  H.wounds = { current: 300, max: 300, base: 300 } as never;
  E.wounds = { current: 300, max: 300, base: 300 } as never;
  E.engagedWith = [H.id]; H.engagedWith = [E.id];
  useGame.setState({ battle: { ...b, turn: b.order.indexOf(porteur.id), action: null, movementUsed: 0, acted: false } });
  return { H, E };
}

/** Côté attaquant : nom de l'option, du réticule et de la modale d'attaque (`attackWeaponOf`). */
function nomsDeLAttaque(kind: string): { option: string; reticule: string; modale: string } {
  const { H, E } = engage('heros');
  const option = availableAttacks(H, g().battle!).find((o) => o.freeKind === kind && !o.weaponUid);
  if (!option) throw new Error(`aucune option de gratuite « ${kind} »`);
  g().battleSelectAttack(option.id);
  const ht = hoverTargeting(g, H, E);
  if (ht.kind !== 'ok') throw new Error(`réticule ${ht.kind}`);
  g().battleClickEntity(E.id, { confirm: true });
  vi.runAllTimers();
  const pa = g().pendingAttack;
  if (pa?.freeKind !== kind) throw new Error(`le clic n'a pas ouvert la gratuite « ${kind} »`);
  const b = g().battle!;
  const modale = attackWeaponOf(b, b.combatants.find((c) => c.id === H.id)!, b.combatants.find((c) => c.id === E.id)!, pa).label;
  return { option: option.label, reticule: ht.title, modale };
}

/** Côté défenseur : nom que la modale de défense lit (`pd.weapon.label`), par gratuite de la file du tour. */
function nomsDeLaDefense(): Map<string, string> {
  const { H, E } = engage('creature');
  const suite: SuiteDeCoup = { restitution: { prevActed: false }, manoeuvre: { kind: 'arme' }, enchainement: { mode: 'aucun' } };
  expect(maybeOpenDefense(g, useGame.setState, E, H, E.weapons[0], suite), 'la fenêtre de l’attaque d’Arme s’ouvre').toBe(true);
  const noms = new Map<string, string>();
  for (let garde = 0; garde < 10 && g().pendingDefense; garde++) {
    g().defenseRoll();
    g().defenseConfirm();
    vi.runAllTimers();
    const pd = g().pendingDefense;
    const kind = pd?.suite.mode === 'machine' ? pd.suite.coup.manoeuvre?.kind : undefined;
    if (pd && kind) noms.set(kind, pd.weapon.label);
  }
  return noms;
}

describe('Une gratuite, un nom : option, réticule, modale d’attaque et modale de défense', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useGame.setState({ battle: null, pendingAttack: null, pendingDefense: null, pendingCascade: null, pendingFateSave: null, pendingDisengage: null });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it.each(GRATUITES)('« %s » : l’option, le réticule et la modale d’attaque portent le même nom', (kind) => {
    const { option, reticule, modale } = nomsDeLAttaque(kind);
    expect(modale, 'modale d’attaque').toBe(nomDeLaManoeuvre(kind));
    expect(reticule, 'réticule').toBe(modale);
    expect(option, 'option').toBe(modale);
  });

  it('la modale de défense nomme chaque gratuite comme sa modale d’attaque', () => {
    const defense = nomsDeLaDefense();
    expect([...defense.keys()].sort(), 'chaque gratuite de la file ouvre sa défense').toEqual([...GRATUITES].sort());
    for (const kind of GRATUITES) {
      expect(defense.get(kind), kind).toBe(nomDeLaManoeuvre(kind));
      expect(defense.get(kind), kind).toBe(nomsDeLAttaque(kind).modale);
    }
  });
});
