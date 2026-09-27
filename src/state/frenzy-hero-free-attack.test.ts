/**
 * Attaque GRATUITE de Frénésie d'un HÉROS en Auto-combat (retour playtest 2026-06-27 : « un héros en
 * frénésie n'utilise pas son attaque gratuite »). `aiAvailableFreeAttack` était gardé `kind==='enemy'` → un héros
 * AUTO-piloté (sans UI) ne la jouait jamais. Gate corrigé en `!aiDriven` : enemy + héros auto la jouent ;
 * un héros MANUEL la déclenche lui-même via l'affordance UI (donc `aiAvailableFreeAttack` reste un no-op pour lui).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { makeShowcaseParty } from '../data/pregens';
import { scenario as embuscade } from '../scenes/test-scenarios/embuscade';
import { aiAvailableFreeAttack } from './combatFlow';
import { hasFreeWeaponAttack } from './combatManeuvers';
import { setCadence } from '../engine/cadence';
const embuscadeConstruit = embuscade.construire();

describe('Frénésie — attaque gratuite d’un héros (Auto-combat)', () => {
  beforeEach(() => { vi.useFakeTimers(); useGame.getState().seedRng(7); setCadence('manuel'); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); setCadence('manuel'); });

  function frenziedHeroAdjacentToFoe() {
    useGame.setState({ party: makeShowcaseParty() });
    useGame.getState().startScene(embuscadeConstruit.scene);
    useGame.getState().startCombat('enc-mutants', undefined, { noSurprise: true });
    useGame.getState().confirmRoundStart();
    const b = useGame.getState().battle!;
    const hero = b.combatants.find((c) => c.kind === 'hero' && (c.weapons ?? []).some((w) => w.type === 'melee'))!;
    const foe = b.combatants.find((c) => c.kind === 'enemy' && !c.dead)!;
    hero.psychState = [{ type: 'frenesie' } as never];   // frénétique → attaque libre d'Arme (LDB 21 l.33)
    foe.pos = { x: hero.pos!.x + 1, y: hero.pos!.y };      // ennemi AU CONTACT (cible de l'attaque gratuite)
    foe.wounds = { ...foe.wounds, current: 99, max: 99 };  // survit pour qu'on mesure l'attaque, pas la mort
    useGame.setState({ battle: { ...b } });
    return { heroId: hero.id, foeId: foe.id };
  }

  it('hasFreeWeaponAttack vrai pour un héros frénétique au contact', () => {
    const { heroId } = frenziedHeroAdjacentToFoe();
    const hero = useGame.getState().battle!.combatants.find((c) => c.id === heroId)!;
    expect(hasFreeWeaponAttack(hero)).toBe(true);
  });

  it('AUTO : aiAvailableFreeAttack FRAPPE (le journal s’enrichit) ; MANUEL : no-op (l’UI gère)', () => {
    const { heroId } = frenziedHeroAdjacentToFoe();
    const hero = () => useGame.getState().battle!.combatants.find((c) => c.id === heroId)!;

    // MANUEL : aiDriven faux → aiAvailableFreeAttack ne fait RIEN (le héros la jouera via l'affordance UI)
    setCadence('manuel');
    const logManuel = useGame.getState().battle!.log.length;
    aiAvailableFreeAttack(useGame.getState, useGame.setState, hero());
    expect(useGame.getState().battle!.log.length).toBe(logManuel); // no-op

    // AUTO : aiDriven vrai → l'attaque gratuite est résolue (jet d'attaque journalisé)
    setCadence('auto');
    const logAuto = useGame.getState().battle!.log.length;
    aiAvailableFreeAttack(useGame.getState, useGame.setState, hero());
    expect(useGame.getState().battle!.log.length).toBeGreaterThan(logAuto); // a frappé
  });
});
