import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { openRoundStartPsych } from './combatFlow';
import { resolvePsychAI } from './combat/turnHooks';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { ciblePsy } from '../engine/psych/ciblage';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * Traits psy CIBLÉS en COMBAT (Animosité/Haine/…, LDB 21 l.9 : Test de Calme « au début du Round »).
 * Depuis la VAGUE MULTI (#1117 L2) : c'est une cascade `purpose:'combat'` ouverte par
 * `openRoundStartPsych` en BANDES (une étape par entrée de règle, applier 'combatPsych', une RANGÉE par
 * héros), résolue par les handlers `cascadeBatch*`. L'IA reste instantanée (resolvePsychAI).
 */
describe('Traits psy ciblés en combat — cascade de DÉBUT de Round (LDB 21)', () => {
  beforeEach(() => {
    banc.setState({ pendingCascade: null, battle: null });
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
    const E = b.combatants.find((c) => c.kind === 'enemy')!;
    b.combatants.filter((c) => c.kind === 'enemy' && c.id !== E.id).forEach((e) => (e.dead = true));
    H.pos = { x: 10, y: 10 };
    E.pos = { x: 11, y: 10 }; // Ligne de Vue dégagée
    H.size = 'moyenne';
    E.size = 'moyenne'; // pas de Peur de Taille
    E.causesPeur = undefined;
    E.causesTerreur = undefined;
    const turn = b.order.indexOf(H.id);
    banc.setState({ battle: { ...b, turn }, pendingCascade: null });
    return { H, E };
  }

  it('Animosité (Mort-vivant) : la cascade s’ouvre face à un ennemi du groupe ; échec → affliction active', () => {
    banc.getState().seedRng(7);
    const { H, E } = setup();
    H.psychTraits = [{ type: 'animosite', cible: ciblePsy.groupe('mort-vivant') }];
    E.groups = ['mort-vivant'];
    H.characteristics['force-mentale'] = 1; // Test de Calme raté quasi sûr
    openRoundStartPsych(banc.getState, banc.setState);
    const c = banc.getState().pendingCascade;
    expect(c?.purpose).toBe('combat');
    const step = c!.participants[0];
    expect(step.combatPsych?.kind).toBe('animosite');
    expect(step.combatPsych?.sourceId).toBe(E.id);
    expect(step.participants!.map((p) => p.id)).toEqual([H.id]); // BANDE : le jet vit sur la rangée
    banc.getState().cascadeBatchRoll(H.id);
    banc.getState().cascadeNext();
    const h = banc.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect((h.psychState ?? []).some((p) => p.type === 'animosite' && p.active)).toBe(true);
  });

  it('succès (Résilience) → marqueur inerte, plus de re-déclenchement ce Round', () => {
    banc.getState().seedRng(7);
    const { H, E } = setup();
    H.psychTraits = [{ type: 'animosite', cible: ciblePsy.groupe('mort-vivant') }];
    E.groups = ['mort-vivant'];
    H.resilience = 1;
    openRoundStartPsych(banc.getState, banc.setState);
    banc.getState().cascadeBatchForceSuccess(H.id); // garantit le succès (par rangée)
    banc.getState().cascadeNext();
    const h = banc.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect((h.psychState ?? []).some((p) => p.type === 'animosite' && p.active)).toBe(false);
    openRoundStartPsych(banc.getState, banc.setState);
    expect(banc.getState().pendingCascade).toBeNull(); // déjà testé ce Round → pas de re-déclenchement
  });

  it('IA : resolvePsychAI pose une affliction ciblée active sur échec (Haine)', () => {
    banc.getState().seedRng(7);
    const { H, E } = setup();
    E.psychTraits = [{ type: 'haine', cible: ciblePsy.groupe('humain') }];
    H.groups = ['humain'];
    E.characteristics['force-mentale'] = 1; // échec quasi sûr
    resolvePsychAI(banc.getState, banc.setState, E);
    const e = banc.getState().battle!.combatants.find((c) => c.id === E.id)!;
    expect((e.psychState ?? []).some((p) => p.type === 'haine' && p.cible === ciblePsy.groupe('humain') && p.active)).toBe(true);
  });
});
