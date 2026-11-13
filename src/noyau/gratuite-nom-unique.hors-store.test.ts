/**
 * Une gratuite a UN nom, celui de sa manœuvre (`def.label`), lu par tous les écrans : l'option d'attaque,
 * le réticule, la modale d'attaque et la modale de défense lisent l'arme de la gratuite
 * (`freeAttackWeapon` via `armeDeLaGratuite`).
 * LDB 85 l.387 ; LDB 85 l.237 ; LDB 85 l.47 — #1765.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { hoverTargeting } from './targeting';
import { availableAttacks } from './combatManeuvers';
import { attackWeaponOf, maybeOpenDefense } from './combatFlow';
import { createHero } from '../engine/character';
import { attaqueNaturelle } from '../engine/creatureAttacks';
import { testScene } from '../scenes/test-fixture';
import type { Combatant } from '../engine/types';
import type { TraitList } from '../engine/statEntry';
import type { SuiteDeCoup } from './pendings';
import { blessuresDeBase } from '../engine/combattantDeTest.testkit';
import { cliquerSurLeCombattant } from './combatOrParty';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const g = () => banc.getState();
const TRAITS: TraitList = [{ id: 'morsure', value: 7 }, { id: 'attaque-caudale', value: 7 }];
const GRATUITES = ['morsure', 'caudale', 'pietinement'];
const nomDeLaManoeuvre = (kind: string): string => attaqueNaturelle(TRAITS, kind)!.def.label;

/** Héros Énorme au contact d'un ennemi Moyen ; `tourDe` porte les traits et le tour. */
function engage(tourDe: 'heros' | 'creature'): { H: Combatant; E: Combatant } {
  const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
  banc.setState({ party: [hero] });
  g().ensemencerLeTirage(5);
  g().lancerLaScene(testScene());
  g().lancerLeCombat('enc-mutants');
  g().fenetreValider('debutDuRound');
  banc.abandonner();
  const b = g().battle!;
  const H = b.combatants.find((c) => c.kind === 'heros')!;
  const [E] = b.combatants.filter((c) => c.kind === 'ennemi');
  b.combatants.filter((c) => c.kind === 'ennemi' && c.id !== E.id).forEach((e) => (e.dead = true));
  const [porteur, cible] = tourDe === 'heros' ? [H, E] : [E, H];
  porteur.traits = TRAITS;
  porteur.size = 'enorme';
  cible.size = 'moyenne';
  porteur.advantage = 6;
  H.pos = { x: 7, y: 10 }; E.pos = { x: 6, y: 10 };
  H.wounds = blessuresDeBase(300, 300, H);
  E.wounds = blessuresDeBase(300, 300, E);
  E.engagedWith = [H.id]; H.engagedWith = [E.id];
  banc.setState({ battle: { ...b, turn: b.order.indexOf(porteur.id), action: null, movementUsed: 0, acted: false } });
  return { H, E };
}

/** Côté attaquant : nom de l'option, du réticule et de la modale d'attaque (`attackWeaponOf`). */
function nomsDeLAttaque(kind: string): { option: string; reticule: string; modale: string } {
  const { H, E } = engage('heros');
  const option = availableAttacks(banc.getState().scene, H, g().battle!).find((o) => o.freeKind === kind && !o.weaponUid);
  if (!option) throw new Error(`aucune option de gratuite « ${kind} »`);
  g().armerLAttaque(option.id);
  const ht = hoverTargeting(g, H, E);
  if (ht.kind !== 'ok') throw new Error(`réticule ${ht.kind}`);
  cliquerSurLeCombattant(g, E.id, { confirm: true });
  const pa = g().pendingAttack;
  if (pa?.freeKind !== kind) throw new Error(`le clic n'a pas ouvert la gratuite « ${kind} »`);
  const b = g().battle!;
  const modale = attackWeaponOf(banc.getState().scene, b, b.combatants.find((c) => c.id === H.id)!, b.combatants.find((c) => c.id === E.id)!, pa).label;
  return { option: option.label, reticule: ht.title, modale };
}

/** Côté défenseur : nom que la modale de défense lit (`pd.weapon.label`), par gratuite de la file du tour. */
function nomsDeLaDefense(): Map<string, string> {
  const { H, E } = engage('creature');
  const suite: SuiteDeCoup = { restitution: { prevActed: false }, manoeuvre: { kind: 'arme' }, enchainement: { mode: 'aucun' } };
  expect(maybeOpenDefense(g, banc.setState, E, H, E.weapons[0], suite), 'la fenêtre de l’attaque d’Arme s’ouvre').toBe(true);
  const noms = new Map<string, string>();
  for (let garde = 0; garde < 10 && g().pendingDefense; garde++) {
    g().jetLancer('defense');
    g().jetValider('defense');
    banc.reprendreTout();
    const pd = g().pendingDefense;
    const kind = pd?.suite.mode === 'machine' ? pd.suite.coup.manoeuvre?.kind : undefined;
    if (pd && kind) noms.set(kind, pd.weapon.label);
  }
  return noms;
}

describe('Une gratuite, un nom : option, réticule, modale d’attaque et modale de défense', () => {
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
