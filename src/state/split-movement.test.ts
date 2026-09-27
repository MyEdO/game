import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGame, movementRemaining, canMove } from './store';
import { computeMoveReach, attackPlan } from './combatFlow';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { effectiveMovement } from '../engine/encumbrance';

/**
 * Règle maison (LDB 15-Déplacement MUET sur le fractionnement) : le joueur peut DÉCOMPOSER son Mouvement
 * du Tour, MAIS le Mouvement ne s'entrelace pas avec l'Action. Séquences permises : `Mouvement* puis Action`
 * OU `Action puis Mouvement*`. INTERDIT : `Mouvement → Action → Mouvement`. (Ex. : bouger pour repérer les
 * adversaires puis faire demi-tour reste possible, tant qu'aucune Action n'a lieu entre les deux segments.)
 * La Charge est une action COMBINÉE non décomposable (Mouvement + attaque, LDB 15 l.35-37) : plein Mouvement.
 */
describe('Mouvement décomposable', () => {
  beforeEach(() => {
    useGame.setState({ battle: null, pendingAttack: null });
  });

  function setup() {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    // Éloigne tous les ennemis pour libérer la grille autour du héros (couloir y=10 libre, cf. tests Charge).
    let i = 0;
    for (const e of b.combatants.filter((c) => c.kind === 'enemy')) e.pos = { x: 20 + i++, y: 20 };
    H.pos = { x: 6, y: 10 };
    const turn = b.order.indexOf(H.id);
    useGame.setState({ battle: { ...b, turn, action: null, acted: false, movementUsed: 0, movedPreAction: false } });
    return { H };
  }

  /** Première case du `reachable` exactement à distance `d` (robuste à la géométrie de la scène). */
  function pickAtDist(reach: Map<string, number>, d: number): { x: number; y: number } {
    for (const [k, v] of reach) if (v === d) { const [x, y] = k.split(',').map(Number); return { x, y }; }
    throw new Error(`aucune case atteignable à distance ${d}`);
  }

  it('deux segments de Mouvement avant l’Action : Mvt 2 → Mvt 2 (total = Marche)', () => {
    const { H } = setup();
    const M = effectiveMovement(H);
    const dest1 = pickAtDist(computeMoveReach(useGame.getState), 2);
    useGame.getState().battleClickTile(dest1, { confirm: true });
    let st = useGame.getState();
    let h = st.battle!.combatants.find((c) => c.id === H.id)!;
    expect(h.pos).toEqual(dest1);
    expect(st.battle!.movementUsed).toBe(2);
    expect(movementRemaining(st.battle!, h)).toBe(M - 2);
    // 2e segment encore disponible (aucune Action entre-temps)
    const reach2 = computeMoveReach(useGame.getState);
    expect(reach2.size).toBeGreaterThan(0);
    const dest2 = pickAtDist(reach2, 2);
    useGame.getState().battleClickTile(dest2, { confirm: true });
    st = useGame.getState();
    h = st.battle!.combatants.find((c) => c.id === H.id)!;
    expect(st.battle!.movementUsed).toBe(4);
    expect(movementRemaining(st.battle!, h)).toBe(0);
  });

  it('Action PUIS Mouvement (décomposable) : agir d’abord n’empêche pas de bouger ensuite', () => {
    const { H } = setup();
    const M = effectiveMovement(H);
    // L'Action est prise EN PREMIER (movementUsed reste 0 → movedPreAction faux).
    useGame.setState({ battle: { ...useGame.getState().battle!, acted: true } });
    let h = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(canMove(useGame.getState().battle!, h)).toBe(true);
    // 1er segment post-Action
    const reach1 = computeMoveReach(useGame.getState);
    expect(reach1.size).toBeGreaterThan(0);
    const dest1 = pickAtDist(reach1, 1);
    useGame.getState().battleClickTile(dest1, { confirm: true });
    expect(useGame.getState().battle!.movementUsed).toBe(1);
    // 2e segment post-Action encore permis (Action puis Mouvement*, pas de M-A-M)
    const st = useGame.getState();
    expect(computeMoveReach(useGame.getState).size).toBeGreaterThan(0);
    h = st.battle!.combatants.find((c) => c.id === H.id)!;
    expect(movementRemaining(st.battle!, h)).toBe(M - 1);
  });

  it('INTERDIT : Mouvement → Action → Mouvement (l’Action scelle le Mouvement déjà entamé)', () => {
    const { H } = setup();
    // 1er Mouvement (avant l'Action) → marque movedPreAction
    const dest1 = pickAtDist(computeMoveReach(useGame.getState), 1);
    useGame.getState().battleClickTile(dest1, { confirm: true });
    expect(useGame.getState().battle!.movedPreAction).toBe(true);
    expect(useGame.getState().battle!.movementUsed).toBe(1);
    // L'Action est prise (p. ex. attaque résolue).
    useGame.setState({ battle: { ...useGame.getState().battle!, acted: true } });
    const h = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(canMove(useGame.getState().battle!, h)).toBe(false); // plus de Mouvement après l'Action
    // plus aucune case proposée
    expect(computeMoveReach(useGame.getState).size).toBe(0);
    // un clic de case ne déplace pas
    const before = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.pos;
    useGame.getState().battleClickTile({ x: before!.x + 1, y: before!.y }, { confirm: true });
    expect(useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.pos).toEqual(before);
  });

  it('Mouvement épuisé : plus aucune case proposée', () => {
    const { H } = setup();
    const M = effectiveMovement(H);
    useGame.setState({ battle: { ...useGame.getState().battle!, movementUsed: M } });
    expect(computeMoveReach(useGame.getState).size).toBe(0);
    void H;
  });

  it('le passage au Tour suivant réinitialise le Mouvement consommé et movedPreAction', () => {
    vi.useFakeTimers();
    try {
      setup();
      // Économie de tour ENTAMÉE (Mouvement consommé, Mvt pré-Action, Action jouée) : sans elle, le
      // reset du tour suivant serait indistinguable de l'état de départ.
      useGame.setState({ battle: { ...useGame.getState().battle!, movementUsed: 3, movedPreAction: true, acted: true } });
      useGame.getState().battleEndTurn(); // passe au combattant suivant (reset de son économie de tour)
      const st = useGame.getState();
      expect(st.battle!.movementUsed).toBe(0);
      expect(st.battle!.movedPreAction).toBe(false);
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it('Charge : exige le plein Mouvement — moveAttack après un Mvt partiel, charge à movementUsed 0', () => {
    const { H } = setup();
    const st0 = useGame.getState();
    const h = st0.battle!.combatants.find((c) => c.id === H.id)!;
    const e = st0.battle!.combatants.find((c) => c.kind === 'enemy')!;
    e.pos = { x: h.pos!.x + 3, y: h.pos!.y };
    // Après un Mouvement partiel, le plan n'est PAS une Charge (rejoindre-et-attaquer, sans bonus).
    useGame.setState({ battle: { ...useGame.getState().battle!, movementUsed: 1, action: null } });
    expect(attackPlan(useGame.getState, h, e).kind).toBe('moveAttack');
    // Au plein Mouvement, le plan est une Charge (manœuvre pleine, portée de Course).
    useGame.setState({ battle: { ...useGame.getState().battle!, movementUsed: 0, action: null } });
    expect(attackPlan(useGame.getState, h, e).kind).toBe('charge');
  });
});
