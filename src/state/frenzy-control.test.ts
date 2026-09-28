import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { openRoundEndCascade } from './combatFlow';
import { collectRoundEndTestSteps } from './combat/triggeredTest';
import { fireTriggers } from './triggeredEffects';
import { createHero } from '../engine/character';
import { seedBattleRng, battleRng } from './battleRng';
import { isFrenzied } from '../engine/psychology';
import { hasCondition, COND } from '../engine/conditions';
import { testScene } from '../scenes/test-fixture';

/**
 * Talent « Contrôle de la Frénésie » — LDB 10 l.251-255 : « Vous pouvez y mettre fin avec un Test de
 * Calme réussi à la fin du Round. » 100 % DONNÉE (talents.json : effet `onRoundEnd` OPT-IN à nœud
 * `test`, gate `has psych frenesie` ; succès → endPsych + Exténué — LDB 21 : « Dès que votre Frénésie
 * s'achève, vous gagnez l'État Exténué »). Héros MANUEL → étape de CHOIX de fin de Round (« pouvez »,
 * skippable) qui pousse le Test de Calme influençable ; IA/auto → JAMAIS exercé (sa sortie rationnelle
 * — plus d'ennemi en vue — est déjà l'effet auto de psychology.json, onTurnStart).
 */
describe('Contrôle de la Frénésie (LDB 10 l.251-255) — fin de Round, opt-in', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null, pendingCascade: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  function setup(withTalent = true) {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    if (withTalent) hero.talents = [...hero.talents, { talentId: 'controle-de-la-frenesie', times: 1 }];
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene());
    seedBattleRng(7);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const enemies = b.combatants.filter((c) => c.kind === 'enemy');
    enemies.slice(1).forEach((e) => (e.dead = true));
    const E = enemies[0];
    H.pos = { x: 10, y: 10 };
    E.pos = { x: 12, y: 10 }; // ennemi vivant en Ligne de Vue → la sortie AUTO (plus d'ennemi) ne joue pas
    useGame.setState({ battle: { ...b }, pendingCascade: null });
    return { H, E };
  }

  it('héros frénétique + talent → étape de CHOIX de fin de Round (« pouvez », Renoncer par défaut) ; sans Frénésie → rien (gate)', () => {
    const { H } = setup();
    expect(collectRoundEndTestSteps(useGame.getState, H)).toHaveLength(0); // pas en Frénésie → gate fermée
    (H.psychState ??= []).push({ type: 'frenesie' });
    const steps = collectRoundEndTestSteps(useGame.getState, H);
    expect(steps).toHaveLength(1);
    expect(steps[0].kind).toBe('triggeredChoice');
    expect(steps[0].defaultChoice).toBe('no');
    expect(steps[0].label).toContain('Contrôle de la Frénésie');
  });

  it('héros SANS le talent → aucune étape (la mécanique vient de la donnée du talent)', () => {
    const { H } = setup(false);
    (H.psychState ??= []).push({ type: 'frenesie' });
    expect(collectRoundEndTestSteps(useGame.getState, H)).toHaveLength(0);
  });

  it('Oui → Test de Calme influençable poussé dans la MÊME cascade ; succès → fin de Frénésie + Exténué', () => {
    const { H } = setup();
    (H.psychState ??= []).push({ type: 'frenesie' });
    H.characteristics['force-mentale'] = 95; // Calme très élevé → réussite
    openRoundEndCascade(useGame.getState, useGame.setState);
    const p = useGame.getState().pendingCascade!;
    const choice = p.participants.find((s) => s.kind === 'triggeredChoice')!;
    expect(choice).toBeTruthy();
    useGame.getState().cascadeChoose(choice.id, 'yes');
    useGame.getState().cascadeNext(); // applier triggeredChoice → pousse l'étape de Test de Calme
    const p2 = useGame.getState().pendingCascade!;
    const test = p2.participants.find((s) => s.kind === 'triggeredTest' && s.rollLabel === 'Calme')!;
    expect(test).toBeTruthy();
    expect(test.result).toBeFalsy(); // influençable (Chance/Pacte/Résilience) — pas de jet silencieux
    useGame.getState().cascadeRoll(test.id);
    expect(useGame.getState().pendingCascade!.participants.find((s) => s.id === test.id)!.result!.success).toBe(true);
    useGame.getState().cascadeNext();
    expect(isFrenzied(H)).toBe(false); // « Vous pouvez y mettre fin avec un Test de Calme réussi »
    expect(hasCondition(H, COND.extenue)).toBe(true); // fin de Frénésie → Exténué (LDB 21)
  });

  it('Renoncer (défaut) → la Frénésie CONTINUE (le Test n’est jamais joué)', () => {
    const { H } = setup();
    (H.psychState ??= []).push({ type: 'frenesie' });
    openRoundEndCascade(useGame.getState, useGame.setState);
    const p = useGame.getState().pendingCascade!;
    const choice = p.participants.find((s) => s.kind === 'triggeredChoice')!;
    useGame.getState().cascadeChoose(choice.id, 'no');
    useGame.getState().cascadeNext();
    expect(useGame.getState().pendingCascade?.participants.some((s) => s.kind === 'triggeredTest') ?? false).toBe(false);
    expect(isFrenzied(H)).toBe(true);
  });

  it('IA (créature) portant le talent en Frénésie : JAMAIS exercé — pas de jet, pas de sortie (politique documentée)', () => {
    const { E } = setup();
    E.talents = [{ talentId: 'controle-de-la-frenesie', times: 1 }];
    (E.psychState ??= []).push({ type: 'frenesie' });
    seedBattleRng(99);
    const probeBefore = battleRng().int(1, 100);
    seedBattleRng(99);
    const lines = fireTriggers(useGame.getState, E, 'onRoundEnd', { rng: battleRng(), set: useGame.setState, deferInteractiveTest: true });
    const probeAfter = battleRng().int(1, 100);
    expect(lines).toEqual([]); // aucun jet silencieux
    expect(probeAfter).toBe(probeBefore); // aucun tirage RNG consommé (l'effet opt-in est SAUTÉ)
    expect(isFrenzied(E)).toBe(true); // la sortie auto (psychology.json) reste le seul chemin IA
  });
});
