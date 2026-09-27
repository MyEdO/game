import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { openCastCascade } from './combatFlow'; // effet de bord : installe l'applier `triggeredTest` + le routeur de Test
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { seedBattleRng } from './battleRng';
import { testScene } from '../scenes/test-fixture';
import { findSpellById } from '../data';
import type { Combatant } from '../engine/types';

/**
 * Lot 4b — un Sort dont le Flow d'effet porte un nœud `test` INTERNE (Chute : « la cible teste sa
 * Dextérité ou laisse tomber l'objet ») est résolu CADENCE-AWARE par `resolveFlowTest`, EN CONTEXTE
 * D'INCANTATION (cast cascade ouverte par `openCastCascade`, comme un vrai `castSpell`) :
 *  - la VICTIME est un HÉROS manuel → le test SUSPEND en APPENDANT une étape `triggeredTest` à la
 *    MÊME cascade `cast` active (une seule cascade enrichie, influençable — Chance/Pacte/Résilience) ;
 *  - la VICTIME est un ENNEMI → jet INLINE + branche honorée + ligne de parité dans le journal de
 *    combat (plus jamais de jet silencieux). C'est la machinerie posée aux Lots 1-2, branchée ici sur
 *    la DONNÉE convertie (`spells.json` : op `test` → nœud Flow `test`).
 */
describe('Lot 4b — Sort à Test interne (Chute) cadence-aware en contexte d’incantation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    useGame.setState({ battle: null, party: [], pendingCast: null, pendingCascade: null, pendingLogQueue: [] });
  });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  /** Groupe : un sorcier (lanceur) + un second héros (cible « manuelle » du Test). Combat sur la scène
   *  de test (rencontre `enc-mutants`) → un ennemi disponible comme cible « inline ». */
  function setup() {
    const wiz = createHero({ speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'W', careerTalent: { id: 'magie-mineure' }, rng: makeRNG(707) });
    wiz.spells = ['chute', ...(wiz.spells ?? [])];
    const ally = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', rng: makeRNG(13) });
    useGame.setState({ party: [wiz, ally] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const W = b.combatants.find((c) => c.kind === 'hero' && c.label === 'W')!;
    const A = b.combatants.find((c) => c.kind === 'hero' && c.label === 'A')!;
    const enemies = b.combatants.filter((c) => c.kind === 'enemy');
    enemies.slice(1).forEach((e) => (e.dead = true));
    const E = enemies[0];
    W.pos = { x: 10, y: 10 }; A.pos = { x: 11, y: 10 }; E.pos = { x: 12, y: 10 };
    useGame.setState({ battle: { ...b }, pendingCascade: null, pendingLogQueue: [] });
    return { W, A, E };
  }

  /** Reproduit `castSpell` de façon DÉTERMINISTE, dans SON ordre : pose le `pendingCast` au résultat
   *  figé, puis ouvre la cascade `cast` qui l'hôte (étape `jet:'cast'` au curseur 0), prêt à `castConfirm`. */
  function frozenCast(W: Combatant, target: Combatant) {
    useGame.setState({
      pendingCast: {
        casterId: W.id, targetId: target.id, spellId: 'chute', missile: false, focused: false,
        result: { cast: true, roll: 22, target: 60, sl: 2, isCritical: false, isFumble: false, log: 'ok' },
      },
    });
    openCastCascade(useGame.getState, useGame.setState, W);
  }

  it('la DONNÉE convertie est bien un nœud Flow `test` (plus d’op `test`)', () => {
    const flow = findSpellById('chute')!.effects!;
    expect(flow.kind).toBe('seq');
    const step = flow.kind === 'seq' ? flow.steps[0] : flow; // seq → 1ʳᵉ étape
    expect(step.kind).toBe('test');
    if (step.kind !== 'test') throw new Error('attendu : nœud Flow `test`');
    expect(step.test.characteristic).toBe('dexterite');
    expect(step.success.kind).toBe('seq'); // réussite = rien (l'objet tient)
    expect(step.fail.kind).toBe('do');     // échec = la branche narrative (« l'objet tombe »)
  });

  it('VICTIME héros manuel → étape `triggeredTest` APPENDUE à la cascade `cast` (une seule cascade, influençable)', () => {
    seedBattleRng(5);
    const { W, A } = setup();
    frozenCast(W, A);
    const casc0 = useGame.getState().pendingCascade!;
    expect(casc0.participants).toHaveLength(1);
    expect(casc0.participants[0].jet).toBe('cast'); // l'étape d'incantation, curseur dessus

    useGame.getState().castConfirm(); // applique le Sort : le nœud `test` interne suspend

    const enriched = useGame.getState().pendingCascade!;
    expect(enriched.purpose).toBe('combat');
    expect(enriched.participants).toHaveLength(2);            // étape `cast` + `triggeredTest` APPENDUE (MÊME cascade)
    expect(enriched.participants[0].jet).toBe('cast');
    const step = enriched.participants[1];
    expect(step.kind).toBe('triggeredTest');
    expect(step.actorId).toBe(A.id);                         // c'est la VICTIME (héros) qui jette
    expect(step.result).toBeFalsy();                         // pas encore lancé → influençable (Chance/Pacte/Résilience)
    expect(step.meta?.onFail).toBeTruthy();                  // la branche échec voyage dans le meta (sérialisable, coop)
    expect(useGame.getState().pendingCast).toBeNull();       // le JET d'incantation est clos (CastModal éteint)
  });

  it('VICTIME ennemi → jet INLINE + branche honorée + ligne de parité au journal (aucune cascade)', () => {
    seedBattleRng(5);
    const { W, E } = setup();
    E.characteristics.dexterite = 1; // Dextérité ~imbattable à RATER → la branche échec (narration « l'objet tombe ») s'applique
    frozenCast(W, E);

    useGame.getState().castConfirm();

    expect(useGame.getState().pendingCascade).toBeNull();     // ennemi → jamais d'étape influençable
    const log = useGame.getState().battle!.log.map((e) => e.text).join('\n');
    expect(log).toMatch(/Dextérité/);                         // ligne de parité du Test (traceLineOf) — plus de jet silencieux
    expect(log).toMatch(/l’objet tenu tombe/);                // la branche ÉCHEC (narration) a bien été jouée inline
  });
});
