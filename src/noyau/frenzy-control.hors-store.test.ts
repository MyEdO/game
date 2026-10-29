import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { openRoundEndCascade } from './combatFlow';
import { collectRoundEndTestSteps } from './combat/triggeredTest';
import { fireTriggers } from './triggeredEffects';
import { createHero } from '../engine/character';
import { seedBattleRng, battleRng } from './battleRng';
import { isFrenzied } from '../engine/psychology';
import { hasCondition, COND } from '../engine/conditions';
import { testScene } from '../scenes/test-fixture';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * Talent « Contrôle de la Frénésie » — LDB 10 l.251-255 : « Vous pouvez y mettre fin avec un Test de
 * Calme réussi à la fin du Round. » 100 % DONNÉE (talents.json : effet `onRoundEnd` OPT-IN à nœud
 * `test`, gate `has psych frenesie` ; succès → endPsych + Exténué — LDB 21 : « Dès que votre Frénésie
 * s'achève, vous gagnez l'État Exténué »). Héros MANUEL → étape de CHOIX de fin de Round (« pouvez »,
 * skippable) qui pousse le Test de Calme influençable ; IA/auto → JAMAIS exercé (sa sortie rationnelle
 * — plus d'ennemi en vue — est déjà l'effet auto de psychology.json, onTurnStart).
 */
describe('Contrôle de la Frénésie (LDB 10 l.251-255) — fin de Round, opt-in', () => {
  beforeEach(() => { banc.setState({ battle: null, pendingCascade: null }); });

  function setup(withTalent = true) {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    if (withTalent) hero.talents = [...hero.talents, { talentId: 'controle-de-la-frenesie', times: 1 }];
    banc.setState({ party: [hero] });
    banc.getState().startScene(testScene());
    seedBattleRng(7);
    banc.getState().startCombat('enc-mutants');
    banc.getState().confirmRoundStart();
    banc.abandonner();
    const b = banc.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const enemies = b.combatants.filter((c) => c.kind === 'enemy');
    enemies.slice(1).forEach((e) => (e.dead = true));
    const E = enemies[0];
    H.pos = { x: 10, y: 10 };
    E.pos = { x: 12, y: 10 }; // ennemi vivant en Ligne de Vue → la sortie AUTO (plus d'ennemi) ne joue pas
    banc.setState({ battle: { ...b }, pendingCascade: null });
    return { H, E };
  }

  it('héros frénétique + talent → étape de CHOIX de fin de Round (« pouvez », Renoncer par défaut) ; sans Frénésie → rien (gate)', () => {
    const { H } = setup();
    expect(collectRoundEndTestSteps(banc.getState, H)).toHaveLength(0); // pas en Frénésie → gate fermée
    (H.psychState ??= []).push({ type: 'frenesie' });
    const steps = collectRoundEndTestSteps(banc.getState, H);
    expect(steps).toHaveLength(1);
    expect(steps[0].kind).toBe('triggeredChoice');
    expect(steps[0].defaultChoice).toBe('no');
    expect(steps[0].label).toContain('Contrôle de la Frénésie');
  });

  it('héros SANS le talent → aucune étape (la mécanique vient de la donnée du talent)', () => {
    const { H } = setup(false);
    (H.psychState ??= []).push({ type: 'frenesie' });
    expect(collectRoundEndTestSteps(banc.getState, H)).toHaveLength(0);
  });

  it('Oui → Test de Calme influençable poussé dans la MÊME cascade ; succès → fin de Frénésie + Exténué', () => {
    const { H } = setup();
    (H.psychState ??= []).push({ type: 'frenesie' });
    H.characteristics['force-mentale'] = 95; // Calme très élevé → réussite
    openRoundEndCascade(banc.getState, banc.setState);
    const p = banc.getState().pendingCascade!;
    const choice = p.participants.find((s) => s.kind === 'triggeredChoice')!;
    expect(choice).toBeTruthy();
    banc.getState().cascadeChoose(choice.id, 'yes');
    banc.getState().cascadeNext(); // applier triggeredChoice → pousse l'étape de Test de Calme
    const p2 = banc.getState().pendingCascade!;
    const test = p2.participants.find((s) => s.kind === 'triggeredTest' && s.rollLabel === 'Calme')!;
    expect(test).toBeTruthy();
    expect(test.result).toBeFalsy(); // influençable (Chance/Pacte/Résilience) — pas de jet silencieux
    banc.getState().cascadeRoll(test.id);
    expect(banc.getState().pendingCascade!.participants.find((s) => s.id === test.id)!.result!.success).toBe(true);
    banc.getState().cascadeNext();
    expect(isFrenzied(H)).toBe(false); // « Vous pouvez y mettre fin avec un Test de Calme réussi »
    expect(hasCondition(H, COND.extenue)).toBe(true); // fin de Frénésie → Exténué (LDB 21)
  });

  it('Renoncer (défaut) → la Frénésie CONTINUE (le Test n’est jamais joué)', () => {
    const { H } = setup();
    (H.psychState ??= []).push({ type: 'frenesie' });
    openRoundEndCascade(banc.getState, banc.setState);
    const p = banc.getState().pendingCascade!;
    const choice = p.participants.find((s) => s.kind === 'triggeredChoice')!;
    banc.getState().cascadeChoose(choice.id, 'no');
    banc.getState().cascadeNext();
    expect(banc.getState().pendingCascade?.participants.some((s) => s.kind === 'triggeredTest') ?? false).toBe(false);
    expect(isFrenzied(H)).toBe(true);
  });

  it('IA (créature) portant le talent en Frénésie : JAMAIS exercé — pas de jet, pas de sortie (politique documentée)', () => {
    const { E } = setup();
    E.talents = [{ talentId: 'controle-de-la-frenesie', times: 1 }];
    (E.psychState ??= []).push({ type: 'frenesie' });
    seedBattleRng(99);
    const probeBefore = battleRng().int(1, 100);
    seedBattleRng(99);
    const lines = fireTriggers(banc.getState, E, 'onRoundEnd', { rng: battleRng(), set: banc.setState, deferInteractiveTest: true });
    const probeAfter = battleRng().int(1, 100);
    expect(lines).toEqual([]); // aucun jet silencieux
    expect(probeAfter).toBe(probeBefore); // aucun tirage RNG consommé (l'effet opt-in est SAUTÉ)
    expect(isFrenzied(E)).toBe(true); // la sortie auto (psychology.json) reste le seul chemin IA
  });
});
