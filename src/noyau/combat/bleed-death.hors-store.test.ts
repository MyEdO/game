import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from '../banc.testkit';
import { runCombatHooks, type CombatHookCtx } from '../combatHooks';
import { resolveRoundBoundary } from '../combatFlow';
import { createHero } from '../../engine/character';
import { seedBattleRng } from '../battleRng';
import { ev } from '../combatLog';
import { addCondition, hasCondition, loseWounds, stacks, COND } from '../../engine/conditions';
import { testScene } from '../../scenes/test-fixture';
import type { Combatant } from '../../engine/types';
import { blessuresDeBase } from '../../engine/characteristics';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * Mort par Hémorragique EN COMBAT (LDB 16 l.105 : « à la fin du Round, 10 %/pion de mourir ; un double =
 * coagulation, retire 1 pion »). Jouée par le hook `bleed-death` (jet RNG) qui MARQUE les morts dans
 * `battle.bleedDoomed`, puis FINALISÉE par `resolveRoundBoundary` — qui SUSPEND pour le Destin d'un héros.
 * Graines d100 (1ᵉʳ jet du Round) : 7 = ≤10 (mort) ; 21 = double (coagulation) ; 1 = >30 (survie).
 */
describe('Mort par Hémorragique en combat (LDB 16 l.105) — hook bleed-death + resolveRoundBoundary', () => {
  beforeEach(() => {
    banc.setState({ pendingCascade: null, pendingFateSave: null, battle: null });
  });

  function setup() {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    banc.setState({ party: [hero] });
    banc.getState().startScene(testScene());
    banc.getState().startCombat('enc-mutants');
    banc.getState().confirmRoundStart();
    banc.abandonner();
    const b = banc.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const enemies = b.combatants.filter((c) => c.kind === 'enemy');
    const E = enemies[0];
    enemies.slice(1).forEach((e) => (e.dead = true)); // une seule source vivante → RNG déterministe
    H.pos = { x: 10, y: 10 };
    E.pos = { x: 20, y: 20 };
    E.wounds = blessuresDeBase(20); // marge : les dégâts d'Hémorragie ne le tuent pas avant le jet
    banc.setState({ battle: { ...b }, pendingCascade: null, pendingLogQueue: [] });
    return { H, E };
  }

  /** Joue la séquence de fin de Round (hooks `onRoundEnd` puis finalisation des morts/Destin). */
  function endRound() {
    const battle = banc.getState().battle!;
    const sink = (line: string, c?: Combatant) => battle.log.push(ev('condition', line, c?.id));
    const ctx: CombatHookCtx = { get: banc.getState, set: banc.setState, battle, sink };
    runCombatHooks('onRoundEnd', ctx);
    resolveRoundBoundary(banc.getState, banc.setState);
  }

  /** Porteur de `n` Hémorragique amené à 0 PB par un coup : la règle le rend Inconscient (LDB 16 l.105). */
  function saigneInconscient(c: Combatant, n: number) {
    c.wounds = { current: 3, max: c.wounds.max };
    addCondition(c, COND.hemorragique, n);
    loseWounds(c, 10);
    expect(hasCondition(c, COND.inconscient), 'Inconscient posé par la règle, pas par la fixture').toBe(true);
  }

  it('ennemi : jet ≤ 10×pions → mort finalisée (annonce différée + onSlain)', () => {
    const { E } = setup();
    seedBattleRng(7); // après setup (startCombat a consommé le RNG d'initiative) : 1ᵉʳ d100 = ≤10 → mort
    saigneInconscient(E, 3);
    endRound();
    const e = banc.getState().battle!.combatants.find((x) => x.id === E.id)!;
    expect(e.dead).toBe(true);
    expect(banc.getState().pendingFateSave).toBeNull(); // un ennemi n'a pas de Destin
  });

  it('porteur CONSCIENT qui garde des PB après le saignement : aucun jet, aucune mort (jet ≤ 10×pions ignoré)', () => {
    const { E } = setup();
    seedBattleRng(7);
    E.wounds = blessuresDeBase(20, 5);
    addCondition(E, COND.hemorragique, 3);
    endRound();
    const e = banc.getState().battle!.combatants.find((x) => x.id === E.id)!;
    expect(e.wounds.current).toBe(2);
    expect(e.dead).toBeFalsy();
  });

  it('porteur de 2 Hémorragique amené à 0 PAR LE SAIGNEMENT : Inconscient, puis jet de mort le même Round', () => {
    const { E } = setup();
    seedBattleRng(7); // 1ᵉʳ d100 ≤ 20 → mort
    E.wounds = blessuresDeBase(20, 2);
    addCondition(E, COND.hemorragique, 2);
    endRound();
    const e = banc.getState().battle!.combatants.find((x) => x.id === E.id)!;
    expect(hasCondition(e, COND.inconscient)).toBe(true);
    expect(e.dead).toBe(true);
  });

  it('jet de mort survécu : il se lit au journal', () => {
    const { E } = setup();
    seedBattleRng(1); // 1ᵉʳ d100 > 30, non-double → survie
    saigneInconscient(E, 3);
    endRound();
    expect(banc.getState().battle!.log.some((l) => /survit à l'hémorragie/.test(l.text))).toBe(true);
  });

  it('coagulation : un DOUBLE retire 1 pion d’Hémorragique (pas de mort)', () => {
    const { E } = setup();
    seedBattleRng(21); // après setup : 1ᵉʳ d100 = double → coagulation
    saigneInconscient(E, 3);
    endRound();
    const e = banc.getState().battle!.combatants.find((x) => x.id === E.id)!;
    expect(e.dead).toBeFalsy();
    expect(stacks(e, COND.hemorragique)).toBe(2); // 3 → 2 (coagule)
  });

  it('survie : jet > 10×pions → ni mort ni coagulation', () => {
    const { E } = setup();
    seedBattleRng(1); // après setup : 1ᵉʳ d100 > 30, non-double → survie
    saigneInconscient(E, 3);
    endRound();
    const e = banc.getState().battle!.combatants.find((x) => x.id === E.id)!;
    expect(e.dead).toBeFalsy();
    expect(stacks(e, COND.hemorragique)).toBe(3); // inchangé
  });

  it('héros à Destin : mort par Hémorragie → SUSPEND (pendingFateSave), le héros ne meurt pas tout de suite', () => {
    const { H } = setup();
    seedBattleRng(7); // après setup : mort
    H.fate = 1;
    saigneInconscient(H, 3);
    endRound();
    const fs = banc.getState().pendingFateSave;
    expect(fs).toBeTruthy();
    expect(fs!.heroId).toBe(H.id);
    const h = banc.getState().battle!.combatants.find((x) => x.id === H.id)!;
    expect(h.dead).toBeFalsy(); // suspendu, mort non encore finalisée (le joueur peut dépenser un Point de Destin)
  });

  it('héros SANS Destin : mort par Hémorragie finalisée (pas de suspension)', () => {
    const { H } = setup();
    seedBattleRng(7); // après setup : mort
    H.fate = 0;
    saigneInconscient(H, 3);
    endRound();
    expect(banc.getState().pendingFateSave).toBeNull();
    const h = banc.getState().battle!.combatants.find((x) => x.id === H.id)!;
    expect(h.dead).toBe(true);
  });
});
