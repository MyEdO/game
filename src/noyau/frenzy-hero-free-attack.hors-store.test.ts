/**
 * Attaque GRATUITE de Frénésie d'un HÉROS en Auto-combat (retour playtest 2026-06-27 : « un héros en
 * frénésie n'utilise pas son attaque gratuite »). `aiAvailableFreeAttack` était gardé `kind==='ennemi'` → un héros
 * AUTO-piloté (sans UI) ne la jouait jamais. Gate corrigé en `!aiDriven` : enemy + héros auto la jouent ;
 * un héros MANUEL la déclenche lui-même via l'affordance UI (donc `aiAvailableFreeAttack` reste un no-op pour lui).
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { groupeVitrineDeScenario } from '../scenes/test-scenarios/_heros';
import { scenario as embuscade } from '../scenes/test-scenarios/embuscade';
import { aiAvailableFreeAttack } from './combatFlow';
import { hasFreeWeaponAttack } from './combatManeuvers';
import { setCadence } from '../engine/cadence';
import { blessuresDeBase } from '../engine/combattantDeTest.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });
const embuscadeConstruit = embuscade.construire(idsDeTest);

describe('Frénésie — attaque gratuite d’un héros (Auto-combat)', () => {
  beforeEach(() => { banc.getState().ensemencerLeTirage(7); });

  function frenziedHeroAdjacentToFoe() {
    banc.setState({ party: groupeVitrineDeScenario(idsDeTest) });
    banc.getState().lancerLaScene(embuscadeConstruit.scene);
    banc.getState().lancerLeCombat('enc-mutants', undefined, { noSurprise: true });
    banc.getState().fenetreValider('debutDuRound');
    const b = banc.getState().battle!;
    const hero = b.combatants.find((c) => c.kind === 'heros' && (c.weapons ?? []).some((w) => w.type === 'melee'))!;
    const foe = b.combatants.find((c) => c.kind === 'ennemi' && !c.dead)!;
    hero.psychState = [{ type: 'frenesie' } as never];   // frénétique → attaque libre d'Arme (LDB 21 l.33)
    foe.pos = { x: hero.pos!.x + 1, y: hero.pos!.y };      // ennemi AU CONTACT (cible de l'attaque gratuite)
    foe.wounds = blessuresDeBase(99, 99, foe);  // survit pour qu'on mesure l'attaque, pas la mort
    banc.setState({ battle: { ...b } });
    return { heroId: hero.id, foeId: foe.id };
  }

  it('hasFreeWeaponAttack vrai pour un héros frénétique au contact', () => {
    const { heroId } = frenziedHeroAdjacentToFoe();
    const hero = banc.getState().battle!.combatants.find((c) => c.id === heroId)!;
    expect(hasFreeWeaponAttack(hero)).toBe(true);
  });

  it('AUTO : aiAvailableFreeAttack FRAPPE (le journal s’enrichit) ; MANUEL : no-op (l’UI gère)', () => {
    const { heroId } = frenziedHeroAdjacentToFoe();
    const hero = () => banc.getState().battle!.combatants.find((c) => c.id === heroId)!;

    // MANUEL : aiDriven faux → aiAvailableFreeAttack ne fait RIEN (le héros la jouera via l'affordance UI)
    setCadence('manuel');
    const logManuel = banc.getState().battle!.log.length;
    aiAvailableFreeAttack(banc.getState, banc.setState, hero());
    expect(banc.getState().battle!.log.length).toBe(logManuel); // no-op

    // AUTO : aiDriven vrai → l'attaque gratuite est résolue (jet d'attaque journalisé)
    setCadence('auto');
    const logAuto = banc.getState().battle!.log.length;
    aiAvailableFreeAttack(banc.getState, banc.setState, hero());
    expect(banc.getState().battle!.log.length).toBeGreaterThan(logAuto); // a frappé
  });
});
