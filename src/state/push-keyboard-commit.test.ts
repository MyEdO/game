import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect } from 'vitest';
import { useGame } from './store';
import { elireBinding } from './clavier/keybindings';

/** L'élection du clavier (`elireBinding`), la même que `useGameKeyboard.ts::onKey`. */
const dispatch = (code: string, s: ReturnType<typeof useGame.getState>, controlFocused: boolean) =>
  elireBinding(code, s, { controlFocused });

/** Ouvre le combat de l'arène 42-belier-porte et pose le tour NEUF du Soldat, chef de pièce du bélier. */
async function ouvrirLeBelierAuTourDuSoldat() {
  const { scenario } = await import('../scenes/test-scenarios/42-belier-porte');
  const { party, scene } = scenario.construire(idsDeTest);
  useGame.setState({ screen: 'campaign', party });
  useGame.getState().lancerLaScene(scene);
  useGame.getState().lancerLeCombat('siege-belier');
  useGame.getState().fenetreValider('debutDuRound');
  const b0 = useGame.getState().battle!;
  const soldat = b0.combatants.find((c) => c.kind === 'heros' && !!c.mannedPoste)!;
  useGame.setState({ battle: { ...b0, turn: b0.order.indexOf(soldat.id), acted: false, action: null, movementUsed: 0 } });
  return soldat;
}

describe('#199 — Entrée commet la poussée MÊME avec le focus résiduel du bouton « Pousser »', () => {
  it('cursor-commit est sélectionné (pas d’exclusion notWhenControlFocused) quand un combatCursor est posé', () => {
    const s = {
      ...useGame.getState(), mode: 'battle',
      battle: { over: null, action: 'poussee', order: ['chef'], turn: 0, combatants: [{ id: 'chef', kind: 'heros' }] },
      combatCursor: { tile: { x: 1, y: 1 } }, net: { mode: 'local', mySeat: 0 }, dialogue: null,
    } as never;
    const b = dispatch('Enter', s, /* controlFocused: bouton Pousser encore focalisé */ true);
    expect(b?.id).toBe('curseur-valider');
  });

  it('flux complet clavier (arène 42-belier-porte) : 2 flèches + Entrée EXÉCUTENT la poussée (positions changent, moveSnapshot posé)', async () => {
    const soldat = await ouvrirLeBelierAuTourDuSoldat();
    useGame.getState().pousserLEngin();
    expect(useGame.getState().battle!.action).toBe('poussee');
    const before = { ...soldat.pos! };
    // 1er appui : `nextCaseCursorTile` pose le curseur sur la case valide la plus proche (l'ancre elle-même,
    // coût 0) ; 2e appui : bouge réellement — comportement DOCUMENTÉ de la navigation mode-CASE, pas le bug.
    useGame.getState().moveCursor('haut');
    useGame.getState().moveCursor('haut');
    expect(useGame.getState().combatCursor!.tile).not.toEqual(before);
    useGame.getState().commitCursor(); // Entrée, focus résiduel du bouton « Pousser » N'EST PLUS un obstacle
    const st = useGame.getState();
    const find = (id: string) => st.battle!.combatants.find((c) => c.id === id)!;
    expect(find(soldat.id).pos).not.toEqual(before);
    expect(st.battle!.moveSnapshot).not.toBeNull();
    expect(st.battle!.action).toBeNull(); // mode-CASE refermé après commit (comme le clic-souris)
  });

  it('« Annuler dépl. » défait une poussée commise au CLAVIER (chemin clic déjà couvert par push-cancel-move.hors-store.test.ts)', async () => {
    const soldat = await ouvrirLeBelierAuTourDuSoldat();
    useGame.getState().pousserLEngin();
    const before = { ...soldat.pos! };
    useGame.getState().moveCursor('haut');
    useGame.getState().moveCursor('haut');
    useGame.getState().commitCursor();
    expect(useGame.getState().battle!.combatants.find((c) => c.id === soldat.id)!.pos).not.toEqual(before);
    useGame.getState().annulerLeDeplacement();
    const st = useGame.getState();
    expect(st.battle!.combatants.find((c) => c.id === soldat.id)!.pos).toEqual(before);
    expect(st.battle!.moveSnapshot ?? null).toBeNull();
  });
});

describe('42-belier-porte — le curseur clavier du mode Pousser', () => {
  it('BUG-B (recette) : au clavier, en mode Pousser, la case plein NORD est sélectionnable (curseur clavier, vue iso par défaut)', async () => {
    const soldat = await ouvrirLeBelierAuTourDuSoldat();
    useGame.getState().pousserLEngin();
    const start = { ...soldat.pos! };
    const north = { x: start.x, y: start.y - 1 };
    expect(useGame.getState().battle!.reachable.has(`${north.x},${north.y}`)).toBe(true); // au menu du mode
    let found = false;
    const dirs: Array<'haut' | 'bas' | 'gauche' | 'droite'> = ['haut', 'bas', 'gauche', 'droite'];
    for (const d1 of dirs) {
      useGame.setState({ combatCursor: null });
      useGame.getState().moveCursor(d1);
      const t1 = useGame.getState().combatCursor?.tile;
      if (t1 && t1.x === north.x && t1.y === north.y) { found = true; break; }
      for (const d2 of dirs) {
        useGame.getState().moveCursor(d2);
        const t2 = useGame.getState().combatCursor?.tile;
        if (t2 && t2.x === north.x && t2.y === north.y) { found = true; break; }
      }
      if (found) break;
    }
    expect(found).toBe(true); // plein Nord atteignable en ≤ 2 pressions
  });
});
