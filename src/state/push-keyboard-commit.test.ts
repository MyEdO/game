import { describe, it, expect } from 'vitest';
import { useGame } from './store';
import { KEYBINDINGS, bindingApplies, effectiveCodes } from './keybindings';

/**
 * #199 — résidu de recette : en mode Pousser, les flèches positionnaient bien le curseur (aperçu
 * « Pousser (N) ») mais Entrée ne commettait rien. Cause : le bouton « Pousser » de la barre d'action
 * (cliqué à la souris pour ENTRER dans le mode) reste FOCALISÉ dans le DOM ; `cursor-commit` portait
 * `notWhenControlFocused: true` → Entrée retombait sur l'activation NATIVE de ce bouton encore
 * focalisé (qui referme le mode 'push', RAZ `reachable`), jamais sur `commitCursor`.
 *
 * Réplique EXACTE du prédicat de sélection de `useGameKeyboard.ts::onKey` (tag BUTTON focalisé,
 * `notWhenControlFocused`, 1er match) — sans DOM (l'environnement de test est `node`, pas `jsdom`).
 */
function dispatch(code: string, s: ReturnType<typeof useGame.getState>, controlFocused: boolean) {
  return KEYBINDINGS.find(
    (k) => effectiveCodes(k, {}).includes(code) && (!k.notWhenControlFocused || !controlFocused) && bindingApplies(k, s),
  );
}

describe('#199 — Entrée commet la poussée MÊME avec le focus résiduel du bouton « Pousser »', () => {
  it('cursor-commit est sélectionné (pas d’exclusion notWhenControlFocused) quand un combatCursor est posé', () => {
    const s = {
      ...useGame.getState(), mode: 'battle',
      battle: { over: null, action: 'push', order: ['chef'], turn: 0, combatants: [{ id: 'chef', kind: 'hero' }] },
      combatCursor: { tile: { x: 1, y: 1 } }, net: { mode: 'local', mySeat: 0 }, dialogue: null,
    } as never;
    const b = dispatch('Enter', s, /* controlFocused: bouton Pousser encore focalisé */ true);
    expect(b?.id).toBe('cursor-commit');
  });

  it('flux complet clavier (arène 42-belier-porte) : 2 flèches + Entrée EXÉCUTENT la poussée (positions changent, moveSnapshot posé)', async () => {
    const { scenario } = await import('../scenes/test-scenarios/42-belier-porte');
    const { party, scene } = scenario.construire();
    useGame.setState({ party });
    useGame.getState().startScene(scene);
    useGame.getState().startCombat('siege-belier');
    useGame.getState().confirmRoundStart();
    const b0 = useGame.getState().battle!;
    const soldat = b0.combatants.find((c) => c.kind === 'hero' && !!c.mannedPoste)!;
    useGame.setState({ battle: { ...b0, turn: b0.order.indexOf(soldat.id), acted: false, action: null, movementUsed: 0 } });
    useGame.getState().battlePushEngine();
    expect(useGame.getState().battle!.action).toBe('push');
    const before = { ...soldat.pos! };
    // 1er appui : `nextCaseCursorTile` pose le curseur sur la case valide la plus proche (l'ancre elle-même,
    // coût 0) ; 2e appui : bouge réellement — comportement DOCUMENTÉ de la navigation mode-CASE, pas le bug.
    useGame.getState().moveCursor('up');
    useGame.getState().moveCursor('up');
    expect(useGame.getState().combatCursor!.tile).not.toEqual(before);
    useGame.getState().commitCursor(); // Entrée, focus résiduel du bouton « Pousser » N'EST PLUS un obstacle
    const st = useGame.getState();
    const find = (id: string) => st.battle!.combatants.find((c) => c.id === id)!;
    expect(find(soldat.id).pos).not.toEqual(before);
    expect(st.battle!.moveSnapshot).not.toBeNull();
    expect(st.battle!.action).toBeNull(); // mode-CASE refermé après commit (comme le clic-souris)
  });

  it('« Annuler dépl. » défait une poussée commise au CLAVIER (chemin clic déjà couvert par push-cancel-move.test.ts)', async () => {
    const { scenario } = await import('../scenes/test-scenarios/42-belier-porte');
    const { party, scene } = scenario.construire();
    useGame.setState({ party });
    useGame.getState().startScene(scene);
    useGame.getState().startCombat('siege-belier');
    useGame.getState().confirmRoundStart();
    const b0 = useGame.getState().battle!;
    const soldat = b0.combatants.find((c) => c.kind === 'hero' && !!c.mannedPoste)!;
    useGame.setState({ battle: { ...b0, turn: b0.order.indexOf(soldat.id), acted: false, action: null, movementUsed: 0 } });
    useGame.getState().battlePushEngine();
    const before = { ...soldat.pos! };
    useGame.getState().moveCursor('up');
    useGame.getState().moveCursor('up');
    useGame.getState().commitCursor();
    expect(useGame.getState().battle!.combatants.find((c) => c.id === soldat.id)!.pos).not.toEqual(before);
    useGame.getState().cancelMove();
    const st = useGame.getState();
    expect(st.battle!.combatants.find((c) => c.id === soldat.id)!.pos).toEqual(before);
    expect(st.battle!.moveSnapshot ?? null).toBeNull();
  });
});
