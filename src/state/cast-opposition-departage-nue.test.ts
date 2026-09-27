import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { testScene } from '../scenes/test-fixture';
import { castingBaseValue, castingValue, castTestOf, evaluateCasting } from '../engine/magic';
import { evaluateTest, resolveOpposed, REPLIS_DEUX_CIBLES } from '../engine/tests';
import { testValue, skillBaseValue } from '../engine/skills';
import { findSpellById } from '../data';
import type { Combatant } from '../engine/types';

/**
 * Départage d'égalité de l'INCANTATION OPPOSÉE (`SpellSpec.opposed`, multijet de la modale de cast)
 * — `LDB 12 l.160` : « Si les deux participants obtiennent le même DR, c'est le groupe avec la
 * Compétence ou la Caractéristique la plus élevée qui l'emporte. »
 *
 * Le lanceur porte sa nue depuis `evaluateCasting` (`castingBaseValue`) ; ce cas verrouille celle de
 * la CIBLE (`skillBaseValue`), sans laquelle le départage retombait sur les deux CIBLES modifiées —
 * l'Avantage du lanceur (`LDB 46 l.123-125`) et les États de la cible décidant à la place du RAW.
 */
describe('LDB 12 l.160 — l’opposition à un Sort départage sur les nues des DEUX camps', () => {
  beforeEach(() => {
    vi.useFakeTimers(); vi.clearAllTimers();
    useGame.setState({ battle: null, pendingCast: null, pendingCastOpposition: null });
  });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  /** Sorcier (Langue (Magick) NUE 44) chargé de 3 Avantage → valeur TESTÉE 74. Cible d'Intelligence
   *  NUE 90 chargée de 2 Exténué → valeur TESTÉE 70 : les deux ordres sont INVERSÉS. */
  function setup() {
    const hero = createHero({
      speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'W',
      careerTalent: { id: 'magie-mineure' }, rng: makeRNG(707),
    });
    hero.spells = ['parole-de-tzeentch'];
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const enemies = b.combatants.filter((c) => c.kind === 'enemy');
    enemies.slice(1).forEach((e) => (e.dead = true));
    const E = enemies[0];
    H.pos = { x: 10, y: 10 }; E.pos = { x: 12, y: 10 };
    H.advantage = 3; // +30 à la valeur TESTÉE d'incantation, +0 au Niveau de Compétence
    E.characteristics.intelligence = 90;
    E.conditions = [{ id: 'extenue', value: 2 }] as never; // −20 à sa valeur TESTÉE
    useGame.setState({ battle: { ...b } });
    return { H, E };
  }

  /** Incantation RÉUSSIE figée, produite par la composition RÉELLE (`evaluateCasting`) — elle seule
   *  pose la nue du lanceur. Dé 5 sur cible 74 → DR 7 = NI du Sort. */
  function frozenCast(H: Combatant, E: Combatant) {
    const spell = findSpellById('parole-de-tzeentch')!;
    const res = evaluateCasting(H, spell, evaluateTest(5, castingValue(H, 'langue', 'magick')));
    useGame.setState({
      pendingCast: {
        casterId: H.id, targetId: E.id, spellId: 'parole-de-tzeentch', missile: false, focused: false, result: res,
      } as never,
    });
    return res;
  }

  it('à DR ÉGAL, la CIBLE l’emporte par sa nue (90 contre 44) alors que les valeurs testées disent l’inverse', () => {
    useGame.getState().seedRng(11);
    const { H, E } = setup();
    const nueH = castingBaseValue(H, 'langue', 'magick');
    const nueE = skillBaseValue(E, undefined, undefined, 'intelligence');
    const testeeE = testValue(E, undefined, 'intelligence');
    const testeeH = castingValue(H, 'langue', 'magick');
    expect([nueH, testeeH], 'lanceur : Niveau de Compétence 44, valeur testée 74 (3 Avantage)').toEqual([44, 74]);
    expect([nueE, testeeE], 'cible : Intelligence nue 90, valeur testée 70 (2 Exténué)').toEqual([90, 70]);
    expect(testeeH, 'les valeurs TESTÉES sont inversées par rapport aux nues').toBeGreaterThan(testeeE);

    const cast = frozenCast(H, E);
    expect(cast.cast, 'DR 7 = NI du Sort : l’incantation passe').toBe(true);
    expect(cast.sl).toBe(7);
    expect(cast.base, 'le lanceur porte sa nue depuis `evaluateCasting`').toBe(44);
    useGame.getState().castConfirm(); // ouvre l'opposition (cible IA = rangée témoin auto-roulée)

    // Dé de la cible FIXÉ au premier qui produit le MÊME DR que l'incantation → le départage joue.
    const de = Array.from({ length: 100 }, (_, i) => i + 1)
      .find((r) => { const t = evaluateTest(r, testeeE); return t.success && t.sl === cast.sl; });
    expect(de, `aucun dé ne donne DR ${cast.sl} sur une cible de ${testeeE}`).toBe(1);
    useGame.getState().oppositionSetForcedRoll(E.id, de!);

    const part = useGame.getState().pendingCastOpposition!.participants.find((p) => p.id === E.id)!;
    expect(part.result!.oppose.sl, 'DR égal : le départage tranche').toBe(cast.sl);
    expect(part.result!.oppose.base, 'la nue de la cible est POSÉE').toBe(90);
    expect(part.result!.oppose.target).toBe(70);
    expect(castTestOf(cast).base, 'et celle du lanceur voyage jusqu’à l’opposition').toBe(44);
    expect(part.result!.resisted, 'nue 90 > 44 : la cible résiste (ses 70 testés perdaient contre 74)').toBe(true);
  });

  it('CONTRAT : le flux d’opposition ne déclenche AUCUN repli deux-cibles (sonde REPLIS_DEUX_CIBLES)', () => {
    useGame.getState().seedRng(11);
    const { H, E } = setup();
    frozenCast(H, E);
    // La sonde est VIVANTE dans ce runtime : deux jets SANS nue la font compter.
    const temoin = REPLIS_DEUX_CIBLES.count;
    resolveOpposed(evaluateTest(30, 50), evaluateTest(40, 50));
    expect(REPLIS_DEUX_CIBLES.count, 'sonde inerte : la preuve ci-dessous ne vaudrait rien').toBe(temoin + 1);

    const avant = REPLIS_DEUX_CIBLES.count;
    useGame.getState().castConfirm();                     // jet témoin auto-roulé → resolveOpposed
    useGame.getState().oppositionSetForcedRoll(E.id, 42); // dé fixé → re-opposition
    useGame.getState().oppositionBonusSL(E.id);           // +1 DR → re-opposition
    expect(REPLIS_DEUX_CIBLES.count, 'un départage de l’opposition est retombé sur les cibles').toBe(avant);
  });
});
