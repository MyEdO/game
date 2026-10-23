import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { openRoundStartPsych } from '../noyau/combatFlow';
import { resolvePsychAI } from '../noyau/combat/turnHooks';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { psychologyLabel, groupLabel } from '../data';
import { stepPrecision } from '../noyau/rollSeam';
import { t } from '../i18n';
import { setRule, resetRule } from '../engine/policy';

/**
 * Traits psy CIBLÉS en COMBAT (Animosité/Haine/…, LDB 21 l.9 : Test de Calme « au début du Round »).
 * Depuis la VAGUE MULTI (#1117 L2) : c'est une cascade `purpose:'combat'` ouverte par
 * `openRoundStartPsych` en BANDES (une étape par entrée de règle, applier 'combatPsych', une RANGÉE par
 * héros), résolue par les handlers `cascadeBatch*`. L'IA reste instantanée (resolvePsychAI).
 */
describe('Traits psy ciblés en combat — cascade de DÉBUT de Round (LDB 21)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    useGame.setState({ pendingCascade: null, battle: null });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  function setup() {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene());
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const E = b.combatants.find((c) => c.kind === 'enemy')!;
    b.combatants.filter((c) => c.kind === 'enemy' && c.id !== E.id).forEach((e) => (e.dead = true));
    H.pos = { x: 10, y: 10 };
    E.pos = { x: 11, y: 10 }; // Ligne de Vue dégagée
    H.size = 'moyenne';
    E.size = 'moyenne'; // pas de Peur de Taille
    E.causesPeur = undefined;
    E.causesTerreur = undefined;
    const turn = b.order.indexOf(H.id);
    useGame.setState({ battle: { ...b, turn }, pendingCascade: null });
    return { H, E };
  }

  it('Animosité (Mort-vivant) : la cascade s’ouvre face à un ennemi du groupe ; échec → affliction active', () => {
    useGame.getState().seedRng(7);
    const { H, E } = setup();
    H.psychTraits = [{ type: 'animosite', cible: 'mort-vivant' }];
    E.groups = ['mort-vivant'];
    H.characteristics['force-mentale'] = 1; // Test de Calme raté quasi sûr
    openRoundStartPsych(useGame.getState, useGame.setState);
    const c = useGame.getState().pendingCascade;
    expect(c?.purpose).toBe('combat');
    const step = c!.participants[0];
    expect(step.combatPsych?.kind).toBe('animosite');
    expect(step.combatPsych?.sourceId).toBe(E.id);
    expect(step.participants!.map((p) => p.id)).toEqual([H.id]); // BANDE : le jet vit sur la rangée
    useGame.getState().cascadeBatchRoll(H.id);
    useGame.getState().cascadeNext();
    const h = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect((h.psychState ?? []).some((p) => p.type === 'animosite' && p.active)).toBe(true);
  });

  it('succès (Résilience) → marqueur inerte, plus de re-déclenchement ce Round', () => {
    useGame.getState().seedRng(7);
    const { H, E } = setup();
    H.psychTraits = [{ type: 'animosite', cible: 'mort-vivant' }];
    E.groups = ['mort-vivant'];
    H.resilience = 1;
    openRoundStartPsych(useGame.getState, useGame.setState);
    useGame.getState().cascadeBatchForceSuccess(H.id); // garantit le succès (par rangée)
    useGame.getState().cascadeNext();
    const h = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect((h.psychState ?? []).some((p) => p.type === 'animosite' && p.active)).toBe(false);
    openRoundStartPsych(useGame.getState, useGame.setState);
    expect(useGame.getState().pendingCascade).toBeNull(); // déjà testé ce Round → pas de re-déclenchement
  });

  it('IA : resolvePsychAI pose une affliction ciblée active sur échec (Haine)', () => {
    useGame.getState().seedRng(7);
    const { H, E } = setup();
    E.psychTraits = [{ type: 'haine', cible: 'humain' }];
    H.groups = ['humain'];
    E.characteristics['force-mentale'] = 1; // échec quasi sûr
    resolvePsychAI(useGame.getState, useGame.setState, E);
    const e = useGame.getState().battle!.combatants.find((c) => c.id === E.id)!;
    expect((e.psychState ?? []).some((p) => p.type === 'haine' && p.cible === 'humain' && p.active)).toBe(true);
  });

  /** Le journal NOMME l'affliction : le type par `psychologyLabel`, le Groupe-Cible par `groupLabel` (#2938). */
  const journalDe = (id: string): string[] => useGame.getState().battle!.log.filter((l) => l.actorId === id).map((l) => l.text);
  const ANIMOSITE = psychologyLabel('animosite');
  const PEAU_VERTE = groupLabel('peau-verte');

  it('journal IA : Animosité (Peau-Verte) ratée → la ligne nomme le type et le Groupe par leurs libellés', () => {
    expect(ANIMOSITE, 'la fixture distingue libellé et id').not.toBe('animosite');
    expect(PEAU_VERTE, 'la fixture distingue libellé et id').not.toBe('peau-verte');
    useGame.getState().seedRng(7);
    const { H, E } = setup();
    E.psychTraits = [{ type: 'animosite', cible: 'peau-verte' }];
    H.groups = ['peau-verte'];
    E.characteristics['force-mentale'] = 1;
    resolvePsychAI(useGame.getState, useGame.setState, E);
    expect(journalDe(E.id)).toContain(t('turn.afflictionGrip', { name: E.label, trait: t('step.sujetPrecision', { sujet: ANIMOSITE, precision: PEAU_VERTE }) }));
  });

  it('journal IA : affliction active re-testée et réussie → « se ressaisit » nomme le type par son libellé', () => {
    useGame.getState().seedRng(7);
    const { H, E } = setup();
    const round = useGame.getState().battle!.round;
    E.psychTraits = [{ type: 'animosite', cible: 'peau-verte' }];
    E.psychState = [{ type: 'animosite', cible: 'peau-verte', sourceId: H.id, active: true, lastTestRound: round - 1 }];
    H.groups = ['peau-verte'];
    E.characteristics['force-mentale'] = 90;
    resolvePsychAI(useGame.getState, useGame.setState, E);
    expect(journalDe(E.id)).toContain(t('turn.recompose', { name: E.label, type: ANIMOSITE }));
  });

  it('journal : la Phobie née de la Terreur nomme son Groupe-Cible par son libellé (ADE II Annexe I, #2938)', () => {
    setRule('psych-acquisition-optional', true);
    try {
      useGame.getState().seedRng(7);
      const { H, E } = setup();
      E.groups = ['peau-verte'];
      E.causesTerreur = 2;
      H.characteristics['force-mentale'] = 1; // Bonus de FM 0
      useGame.setState({ journal: [] });
      openRoundStartPsych(useGame.getState, useGame.setState);
      useGame.getState().cascadeBatchRoll(H.id);
      useGame.getState().cascadeNext();
      const h = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
      expect(h.psychTraits ?? []).toContainEqual({ type: 'phobie', cible: 'peau-verte', indice: 1 });
      expect(useGame.getState().journal).toContain(t('cf.phobieGained', { name: H.label, cible: PEAU_VERTE }));
    } finally {
      resetRule('psych-acquisition-optional');
    }
  });

  it('cascade de début de Round : l’étape d’un Trait ciblé nomme son Groupe-Cible par son libellé', () => {
    useGame.getState().seedRng(7);
    const { H, E } = setup();
    H.psychTraits = [{ type: 'animosite', cible: 'peau-verte' }];
    E.groups = ['peau-verte'];
    openRoundStartPsych(useGame.getState, useGame.setState);
    expect(useGame.getState().pendingCascade!.participants[0].label).toBe(stepPrecision(ANIMOSITE, PEAU_VERTE));
  });
});
