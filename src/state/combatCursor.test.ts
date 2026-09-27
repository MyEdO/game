/**
 * Curseur de combat unifié (clavier + manette) — logique PURE.
 *  - `nextCursorTile` : voisin de grille dont le centre PROJETÉ colle le mieux à la direction
 *    ÉCRAN poussée (le curseur « suit les yeux ») → en iso une « droite » est un pas diagonal de
 *    grille, en vue du dessus un pas cardinal. Gère rotation caméra + projection sans cas particulier.
 *  - `cursorCommitIntent` : décision de commit, RÉPLIQUE de la branche `battle` de performClick
 *    (IsoStage) → parité souris (ennemi → attaque, case libre → déplacement, allié → inspection).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { nextCursorTile, nextCaseCursorTile, tileModeValidTiles, cursorCommitIntent } from './combatCursor';
import { useGame } from './store';
import { t } from '../i18n';
import { makePregens } from '../data/pregens';
import { spawnEnemy } from './spawn';
import type { Dims } from '../geometry/iso';

/** Arène d'herbe minimale (cursorCommitIntent dérive l'affordance d'attaque → besoin d'une scène). */
const arena = () => {
  const w = 22, h = 16;
  return { id: 's', dimensions: { w, h }, layers: [{ z: 0, tiles: new Array(w * h).fill('herbe') }], entities: [], dialogues: [], triggers: [], encounters: [] } as never;
};

const dims = (over: Partial<Dims> = {}): Dims => ({ w: 22, h: 16, ...over });

/** Scène PLATE (couche unique, hauteur 0 partout) : `screenStepDot` projette au lift métrique réel —
 *  sans relief, le lift vaut 0 → projection identique à l'ancienne (résultats inchangés). */
const flat = () => ({ dimensions: { w: 22, h: 16 }, layers: [{ z: 0, tiles: new Array(22 * 16).fill('herbe') }], entities: [] }) as never;

describe('nextCursorTile — curseur écran-relatif', () => {
  it('curseur null → apparaît sur le combattant actif (pas de pas)', () => {
    expect(nextCursorTile(flat(), null, 'right', dims(), { x: 6, y: 10 })).toEqual({ x: 6, y: 10 });
  });

  it('iso rot0 : « droite » écran = voisin diagonal de grille (x+1, y-1)', () => {
    expect(nextCursorTile(flat(), { tile: { x: 6, y: 10 } }, 'right', dims(), { x: 6, y: 10 })).toEqual({ x: 7, y: 9 });
  });

  it('iso rot0 : « haut » écran = (x-1, y-1)', () => {
    expect(nextCursorTile(flat(), { tile: { x: 6, y: 10 } }, 'up', dims(), { x: 6, y: 10 })).toEqual({ x: 5, y: 9 });
  });

  it('iso rot0 : « gauche » = (x-1, y+1) ; « bas » = (x+1, y+1)', () => {
    expect(nextCursorTile(flat(), { tile: { x: 6, y: 10 } }, 'left', dims(), { x: 6, y: 10 })).toEqual({ x: 5, y: 11 });
    expect(nextCursorTile(flat(), { tile: { x: 6, y: 10 } }, 'down', dims(), { x: 6, y: 10 })).toEqual({ x: 7, y: 11 });
  });

  it('vue du dessus : « droite » = pas cardinal de grille (x+1, y)', () => {
    expect(nextCursorTile(flat(), { tile: { x: 6, y: 10 } }, 'right', dims({ view: 'top' }), { x: 6, y: 10 })).toEqual({ x: 7, y: 10 });
  });

  it('rotation caméra (rot=1) : « droite » reste à droite à l’écran (autre delta de grille)', () => {
    // rot impair → la grille tourne ; le pas écran-droite cible un autre couple (dx,dy). On vérifie
    // seulement qu’il bouge ET reste dans la carte (la projection arbitre, pas un delta codé en dur).
    const r = nextCursorTile(flat(), { tile: { x: 6, y: 10 } }, 'right', dims({ rot: 1 }), { x: 6, y: 10 });
    expect(r).not.toEqual({ x: 6, y: 10 });
    expect(r.x).toBeGreaterThanOrEqual(0); expect(r.x).toBeLessThan(22);
    expect(r.y).toBeGreaterThanOrEqual(0); expect(r.y).toBeLessThan(16);
  });

  it('ne sort jamais de la grille : au coin, reste sur place', () => {
    expect(nextCursorTile(flat(), { tile: { x: 21, y: 0 } }, 'right', dims(), { x: 21, y: 0 })).toEqual({ x: 21, y: 0 });
  });
});

describe('nextCaseCursorTile — mode-CASE (#198, résidus) : navigation BORNÉE à l\'ensemble VALIDE', () => {
  const anchor = { x: 6, y: 10 };
  // Ensemble VALIDE volontairement composé d'un voisin AXIAL (impossible à atteindre via nextCursorTile,
  // biais diagonal-only) et d'un voisin diagonal — les 2 doivent rester atteignables ici.
  const valid = [anchor, { x: 7, y: 10 }, { x: 7, y: 9 }];

  it('entrée dans le mode (curseur null) : la case valide la plus PROCHE de l\'ancre', () => {
    expect(nextCaseCursorTile(flat(), null, 'right', dims(), anchor, valid)).toEqual(anchor);
  });

  it('voisin AXIAL (x+1,y) atteignable — jamais possible via nextCursorTile (biais diagonal-only)', () => {
    // Ensemble réduit au SEUL voisin axial : la « droite » écran doit pouvoir s'y poser (dot>0, best du lot).
    expect(nextCaseCursorTile(flat(), anchor, 'right', dims(), anchor, [anchor, { x: 7, y: 10 }])).toEqual({ x: 7, y: 10 });
  });

  it('jamais de snap sur une case HORS ensemble valide, même si géométriquement mieux alignée', () => {
    // Seul { x:7,y:9 } (diagonal, alignement parfait) est valide ; { x:7,y:10 } (axial) est ABSENT de `valid`
    // dans ce sous-cas — la case retenue doit rester DANS l'ensemble fourni.
    const r = nextCaseCursorTile(flat(), anchor, 'right', dims(), anchor, [anchor, { x: 7, y: 9 }]);
    expect([anchor, { x: 7, y: 9 }]).toContainEqual(r);
  });

  it('aucune case valide dans la direction poussée → reste sur place (jamais de saut arrière)', () => {
    expect(nextCaseCursorTile(flat(), anchor, 'left', dims(), anchor, [anchor, { x: 7, y: 10 }])).toEqual(anchor);
  });

  it('ensemble valide vide → null (rien à naviguer)', () => {
    expect(nextCaseCursorTile(flat(), anchor, 'right', dims(), anchor, [])).toBeNull();
  });

  // BUG-B (recette bornée, scénario 42-belier-porte) : ensemble VALIDE en CROIX (cardinales + diagonales
  // à coût 1, vue iso par défaut) — un argmax d'alignement ne sélectionne JAMAIS les cardinales
  // (toujours dominées par une diagonale géométriquement plus « parfaite »). Chaque case
  // CARDINALE doit rester atteignable par une séquence de flèches ≤ 2.
  describe('ensemble en CROIX (8 voisins, coût 1) : chaque cardinale atteignable en ≤ 2 flèches', () => {
    const cross = [
      anchor,
      { x: anchor.x, y: anchor.y - 1 }, // N
      { x: anchor.x, y: anchor.y + 1 }, // S
      { x: anchor.x + 1, y: anchor.y }, // E
      { x: anchor.x - 1, y: anchor.y }, // W
      { x: anchor.x + 1, y: anchor.y - 1 }, // NE
      { x: anchor.x - 1, y: anchor.y - 1 }, // NW
      { x: anchor.x + 1, y: anchor.y + 1 }, // SE
      { x: anchor.x - 1, y: anchor.y + 1 }, // SW
    ];
    const cardinals: Record<string, { x: number; y: number }> = {
      N: cross[1], S: cross[2], E: cross[3], W: cross[4],
    };
    const dirsToTry: import('./combatCursor').ScreenDir[] = ['up', 'down', 'left', 'right'];

    /** Explore ≤ 2 pressions depuis `anchor` (BFS large sur les 4 flèches) — `true` si `target` est atteint. */
    function reachableWithin2(target: { x: number; y: number }): boolean {
      const eq = (a: { x: number; y: number }, b: { x: number; y: number }) => a.x === b.x && a.y === b.y;
      for (const d1 of dirsToTry) {
        const p1 = nextCaseCursorTile(flat(), anchor, d1, dims(), anchor, cross)!;
        if (eq(p1, target)) return true;
        for (const d2 of dirsToTry) {
          const p2 = nextCaseCursorTile(flat(), p1, d2, dims(), anchor, cross)!;
          if (eq(p2, target)) return true;
        }
      }
      return false;
    }

    it.each(Object.entries(cardinals))('cardinale %s atteignable en ≤ 2 pressions', (_name, target) => {
      expect(reachableWithin2(target)).toBe(true);
    });
  });
});

describe('cursorCommitIntent — parité performClick (mode-aware)', () => {
  beforeEach(() => { useGame.setState({ battle: null, party: [], inspectEnabled: false }); }); // ACTION par défaut (Inspection OFF)
  function makeState(over: Record<string, unknown> = {}) {
    const hero = makePregens()[0]; hero.id = 'h1'; hero.pos = { x: 6, y: 10 };
    const ally = makePregens()[1]; ally.id = 'h2'; ally.pos = { x: 5, y: 10 };
    const enemy = spawnEnemy({ ref: 'brigand' }, 'e1', { x: 7, y: 10 }); // adjacent au héros
    const battle = {
      combatants: [hero, ally, enemy], order: ['h1', 'h2', 'e1'], baseOrder: ['h1', 'h2', 'e1'],
      turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
      movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
    };
    useGame.setState({ battle: battle as never, scene: arena(), party: [hero, ally], inspectEnabled: false, ...over });
    return { hero, ally, enemy };
  }

  it('curseur sur un ennemi → intention { entity }', () => {
    const { enemy } = makeState();
    expect(cursorCommitIntent(useGame.getState, { tile: { x: 7, y: 10 } })).toEqual({ kind: 'entity', id: enemy.id });
  });

  it('curseur sur une case libre → intention { tile }', () => {
    makeState();
    expect(cursorCommitIntent(useGame.getState, { tile: { x: 12, y: 4 } })).toEqual({ kind: 'tile', pt: { x: 12, y: 4 } });
  });

  it('curseur sur un allié, inspection activée → { inspect }', () => {
    const { ally } = makeState({ inspectEnabled: true });
    expect(cursorCommitIntent(useGame.getState, { tile: { x: 5, y: 10 } })).toEqual({ kind: 'inspect', id: ally.id });
  });

  it('MODE INSPECTION (Inspection ON) : curseur sur un ENNEMI → { inspect } (on regarde, on n’attaque pas)', () => {
    const { enemy } = makeState({ inspectEnabled: true });
    expect(cursorCommitIntent(useGame.getState, { tile: { x: 7, y: 10 } })).toEqual({ kind: 'inspect', id: enemy.id });
  });

  it('curseur sur un allié, inspection désactivée → null (no-op, jamais clic-case)', () => {
    makeState({ inspectEnabled: false });
    expect(cursorCommitIntent(useGame.getState, { tile: { x: 5, y: 10 } })).toBeNull();
  });

  it('hors combat → null', () => {
    useGame.setState({ battle: null });
    expect(cursorCommitIntent(useGame.getState, { tile: { x: 1, y: 1 } })).toBeNull();
  });
});

describe('tileModeValidTiles — ensemble VALIDE générique (#198, résidus)', () => {
  beforeEach(() => { useGame.setState({ battle: null, party: [], inspectEnabled: false }); });

  it('filtre la scène ENTIÈRE par `tileValidAt` du mode — jamais toute la carte', () => {
    const hero = makePregens()[0]; hero.id = 'h1'; hero.pos = { x: 6, y: 10 };
    const battle = {
      combatants: [hero], order: ['h1'], baseOrder: ['h1'], turn: 0, round: 1, action: null,
      selectedSpellId: null, reachable: new Map([['6,10', 0], ['7,10', 1]]),
      movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
    };
    useGame.setState({ battle: battle as never, scene: arena(), party: [hero] });
    const mode = { tileValidAt: (get: typeof useGame.getState, _a: unknown, pt: { x: number; y: number }) =>
      !!get().battle?.reachable.has(`${pt.x},${pt.y}`) };
    const valid = tileModeValidTiles(useGame.getState, mode, hero);
    // 22×16 = 352 cases dans `arena()` : l'ensemble valide ne porte QUE les 2 cases de `battle.reachable`.
    expect(valid).toHaveLength(2);
    expect(valid.map((p) => `${p.x},${p.y}`).sort()).toEqual(['6,10', '7,10']);
  });
});

describe('moveCursor/commitCursor en mode-CASE (belier-porte, #198 résidus) — intégration store', () => {
  it("le curseur clavier atteint la case AXIALE au nord (5,4)→(5,3) en mode Pousser, jamais bloqué sur le seul pas diagonal", async () => {
    const { scenario } = await import('../scenes/test-scenarios/42-belier-porte');
    useGame.setState({ party: scenario.makeParty() });
    useGame.getState().startScene(scenario.scene);
    useGame.getState().startCombat('siege-belier');
    useGame.getState().confirmRoundStart();
    const b0 = useGame.getState().battle!;
    const soldat = b0.combatants.find((c) => c.kind === 'hero' && !!c.mannedPoste)!;
    useGame.setState({ battle: { ...b0, turn: b0.order.indexOf(soldat.id), acted: false, action: null, movementUsed: 0 } });
    useGame.getState().battlePushEngine();
    expect(useGame.getState().battle!.action).toBe('push');
    // Pousser vers le NORD (vers la porte) : un pas AXIAL de grille (dx=0,dy=-1) — le cas que le biais
    // diagonal-only de `nextCursorTile` ne pouvait jamais atteindre en un seul appui.
    useGame.getState().moveCursor('up');
    const cur = useGame.getState().combatCursor;
    expect(cur).not.toBeNull();
    expect(useGame.getState().battle!.reachable.has(`${cur!.tile.x},${cur!.tile.y}`)).toBe(true); // jamais hors ensemble valide
  });

  it('Entrée sur une case NON commettable en mode-CASE dit son refus À L’ÉCRAN, jamais muet', () => {
    const hero = makePregens()[0]; hero.id = 'h1'; hero.pos = { x: 6, y: 10 };
    const door = spawnEnemy({ ref: 'brigand' }, 'door', { x: 7, y: 10 });
    const battle = {
      combatants: [hero, door], order: ['h1'], baseOrder: ['h1'], turn: 0, round: 1, action: 'teleport',
      selectedSpellId: null, reachable: new Map(), // AUCUNE case de reach : (7,10) reste occupée/non commettable
      movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
    };
    useGame.setState({ battle: battle as never, scene: arena(), party: [hero], inspectEnabled: false, combatCursor: { tile: { x: 7, y: 10 } }, journal: [], refus: null });
    useGame.getState().commitCursor();
    // Le refus se dit AU POINT DU GESTE (`state/refusVisible`) : en combat, le journal n'est pas
    // affiché — un feedback qui n'y va QUE serait muet pour le joueur.
    expect(useGame.getState().refus?.texte).toBe(t('cs.cursorInvalidTile'));
  });
});
