import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { emptyScene, type Scene } from './scene';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { placeCombatant } from './spawn';
import { testScene } from '../scenes/test-fixture';
import { draineCascade } from './cascadeTestKit';

/**
 * Câblage de la chute VOLONTAIRE (LDB 15 l.82) : `fallAcross` ouvre le choix pré-jet (Sauter / Tenter,
 * `fallChoose`) — exploration (le groupe) et combat (le héros actif). « Sauter » résout IMMÉDIATEMENT
 * (chute PLEINE, sans Test) ; « Tenter » ouvre la modale `pendingFall` (Athlétisme Accessible +20,
 * `fallConfirm` applique `effectiveMetres`) ; réduite à 0 m ou moins → AUCUN Dégât (bypass explicite,
 * LDB 15 l.82).
 */

// Falaise de 4 m entre le sommet (2,0) à 4 m et le pied (2,1) à 0 m — AUCUNE arête `climb`.
function cliffScene(): Scene {
  const s = emptyScene(4, 4);
  const w = 4;
  const h = new Array(w * 4).fill(0) as number[];
  h[0 * w + 2] = 4;
  s.layers[0].height = h;
  return s;
}
const top = { x: 2, y: 0 };
const foot = { x: 2, y: 1 };

describe('fallAcross — exploration', () => {
  beforeEach(() => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    useGame.setState({ battle: null, party: [hero], mode: 'exploration', partyPos: top, scene: cliffScene(), pendingFall: null });
  });

  it('ouvre le choix pré-jet (hauteur RÉELLE, aucun attempt choisi)', () => {
    useGame.getState().fallAcross(top, foot);
    const p = useGame.getState().pendingFall;
    // La PHASE est un champ d'ÉTAT (#1117) : le pending la PORTE, la modale n'a rien à déduire.
    expect(p).toMatchObject({ metres: 4, attempt: null, phase: 'choice', result: null });
  });

  it('« Tenter » fait AVANCER la phase d’état : choice → roll (#1117)', () => {
    useGame.getState().fallAcross(top, foot);
    expect(useGame.getState().pendingFall!.phase).toBe('choice');
    useGame.getState().fallChoose(true);
    expect(useGame.getState().pendingFall!.phase, 'la fenêtre de jet est une PHASE portée par l’état').toBe('roll');
  });

  it('geste inapplicable (pas une falaise descendante) → refus silencieux', () => {
    useGame.getState().fallAcross(foot, top); // sens ascendant
    expect(useGame.getState().pendingFall).toBeNull();
  });

  it('« Sauter » (attempt=false) résout IMMÉDIATEMENT : chute PLEINE, le groupe atterrit au pied', () => {
    const before = useGame.getState().party[0].wounds.current;
    useGame.getState().fallAcross(top, foot);
    useGame.getState().fallChoose(false);
    expect(useGame.getState().pendingFall).toBeNull();
    expect(useGame.getState().partyPos).toEqual(foot);
    // Le 1d10 des Dégâts est un DÉ DU JEU (#1508) : il tombe à la porte, en étape à dé nu appendue —
    // les Blessures se posent à SA résolution, jamais en silence dans le geste.
    expect(useGame.getState().party[0].wounds.current, 'rien n’est encaissé avant le dé').toBe(before);
    expect(draineCascade(useGame.getState)).toContain('chuteDe');
    expect(useGame.getState().party[0].wounds.current).toBeLessThan(before); // 3×4m + 1d10 − BE
  });

  it('« Tenter » (attempt=true) ouvre le Test — aucune résolution avant `fallConfirm`', () => {
    useGame.getState().fallAcross(top, foot);
    useGame.getState().fallChoose(true);
    expect(useGame.getState().pendingFall).toMatchObject({ attempt: true, result: null });
    expect(useGame.getState().partyPos).toEqual(top); // le saut n'a lieu qu'à `fallConfirm`
  });

  it('Test réussi, réduction à 0 m ou moins → AUCUN Dégât (bypass, pas juste `applyFall(0,…)`)', () => {
    const before = useGame.getState().party[0].wounds.current;
    useGame.getState().fallAcross(top, foot);
    useGame.getState().fallChoose(true);
    const p = useGame.getState().pendingFall!;
    useGame.setState({ pendingFall: { ...p, result: { success: true, roll: 5, target: 90, dr: 6, effectiveMetres: 0 } } });
    useGame.getState().fallConfirm();
    expect(useGame.getState().pendingFall).toBeNull();
    expect(useGame.getState().partyPos).toEqual(foot);
    expect(useGame.getState().party[0].wounds.current).toBe(before); // aucun dégât — pas de d10 résiduel
  });

  it('Test réussi, réduction partielle → applyFall(effectiveMetres), pas la hauteur pleine', () => {
    const before = useGame.getState().party[0].wounds.current;
    useGame.getState().fallAcross(top, foot);
    useGame.getState().fallChoose(true);
    const p = useGame.getState().pendingFall!;
    useGame.setState({ pendingFall: { ...p, result: { success: true, roll: 40, target: 90, dr: 2, effectiveMetres: 2 } } });
    useGame.getState().fallConfirm();
    draineCascade(useGame.getState); // le 1d10 tombe à la porte (#1508)
    expect(useGame.getState().party[0].wounds.current).toBeLessThan(before);
  });

  it('fallRoll (verbe généré, rollFlowSpecs.fall) résout via resolveDeliberateFall : effectiveMetres = max(0, metres − max(0,dr))', () => {
    useGame.getState().seedRng(3);
    useGame.getState().fallAcross(top, foot);
    useGame.getState().fallChoose(true);
    useGame.getState().fallRoll();
    const r = useGame.getState().pendingFall!.result!;
    expect(r.effectiveMetres).toBe(Math.max(0, 4 - Math.max(0, r.dr)));
  });

  it('fallRoll AVANT le choix (attempt=null) : le flux gate sur `attempt`, aucun jet', () => {
    useGame.getState().fallAcross(top, foot);
    useGame.getState().fallRoll();
    expect(useGame.getState().pendingFall!.result).toBeNull();
  });

  it('fallCancel : ferme la modale sans effet', () => {
    useGame.getState().fallAcross(top, foot);
    useGame.getState().fallCancel();
    expect(useGame.getState().pendingFall).toBeNull();
    expect(useGame.getState().partyPos).toEqual(top);
  });
});

describe('fallAcross — combat', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useGame.setState({ battle: null });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  function setup(atPos = top) {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene());
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const sc = cliffScene();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    b.combatants.filter((c) => c.kind === 'enemy').forEach((e) => (e.dead = true));
    H.engagedWith = [];
    placeCombatant(H, sc, atPos);
    useGame.setState({ scene: sc, battle: { ...b, turn: b.order.indexOf(H.id), action: null, movementUsed: 0, acted: false, movedPreAction: false, reachable: new Map(), preview: null } });
    return { H };
  }

  it('« Sauter » (chute PLEINE) : le héros atterrit au pied, l’Action N’EST PAS consommée (pas de Test)', () => {
    const { H } = setup();
    useGame.getState().fallAcross(top, foot);
    useGame.getState().fallChoose(false);
    const b = useGame.getState().battle!;
    expect(b.combatants.find((c) => c.id === H.id)!.pos).toMatchObject({ x: 2, y: 1 });
    expect(b.acted).toBe(false);
  });

  it('« Tenter » : le Test consomme l’Action (LDB 13 l.86-88), une fois `fallConfirm` appelé', () => {
    const { H } = setup();
    useGame.getState().fallAcross(top, foot);
    useGame.getState().fallChoose(true);
    const p = useGame.getState().pendingFall!;
    useGame.setState({ pendingFall: { ...p, result: { success: true, roll: 40, target: 90, dr: 2, effectiveMetres: 2 } } });
    useGame.getState().fallConfirm();
    const b = useGame.getState().battle!;
    expect(b.combatants.find((c) => c.id === H.id)!.pos).toMatchObject({ x: 2, y: 1 });
    expect(b.acted).toBe(true);
  });

  it('geste inapplicable (pas de falaise adjacente) → refus silencieux, aucune modale', () => {
    setup(foot);
    useGame.getState().fallAcross(foot, top); // ascendant depuis le pied
    expect(useGame.getState().pendingFall).toBeNull();
  });
});
