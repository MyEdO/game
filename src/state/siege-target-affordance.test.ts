import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { itemFromTrappingById, recomputeLoadout } from '../engine/items';
import { hoverTargeting } from './targeting';
import type { Scene } from './scene';
import { testScene } from '../scenes/test-fixture';
import type { Weapon } from '../engine/types';

/**
 * AFFORDANCE de ciblage joueur — une STRUCTURE de siège (mur Impénétrable, ADE II 8) n'est PAS une
 * cible d'attaque pour une arme SANS l'Atout Siège : « attaquer un rempart à l'épée » n'a pas de sens
 * (même gate que l'IA). Le survol retombe alors sur le déplacement (monter au rempart) au lieu d'un
 * « hors de portée » fantôme. Une arme à Atout Siège, elle, la rend ciblable.
 *
 * On dépose un `WallSeg.structure` (Mur en pierre = Impénétrable) sur la scène de fixture puis `startCombat` —
 * la structure devient un Combattant inerte ; le mode neutre (action null) = mode d'attaque.
 */
const EDGE = { x: 2, y: 2, side: 'E' as const };
function sceneWithStructure(structId: string): Scene {
  const s = structuredClone(testScene());
  s.walls = [{ x: EDGE.x, y: EDGE.y, side: EDGE.side, structure: structId }];
  return s;
}

function start(structId: string, seed = 1) {
  useGame.getState().seedRng(seed);
  const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed });
  useGame.setState({ party: [hero] });
  useGame.getState().startScene(sceneWithStructure(structId));
  useGame.getState().startCombat('enc-mutants');
  useGame.getState().confirmRoundStart();
  vi.clearAllTimers();
  const b = useGame.getState().battle!;
  const S = b.combatants.find((c) => c.bodyShape === 'structure')!;
  const H = b.combatants.find((c) => c.kind === 'hero')!;
  // Mode neutre garanti + héros actif : l'affordance d'attaque ne vit qu'en mode neutre (action null).
  useGame.setState({ battle: { ...b, turn: b.order.indexOf(H.id), action: null, acted: false } });
  return { S, H };
}

describe('Affordance — structures réservées aux armes de siège', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('arme de mêlée ordinaire sur un Mur Impénétrable → aucun réticule (none) : le survol retombe sur le déplacement', () => {
    const { S, H } = start('mur-en-pierre');
    // Arme simple (épée, mêlée, SANS Atout Siège), au contact de la face de la structure.
    const sword = itemFromTrappingById('arme-simple')!; sword.equipped = true;
    H.items = [sword]; H.loadouts = undefined; H.activeLoadoutId = undefined; recomputeLoadout(H);
    H.pos = { x: 1, y: 2 }; // adjacent à la face (2,2) de l'arête E
    expect(H.weapons.length).toBeGreaterThan(0); // sanity : une option d'arme existe
    expect(hoverTargeting(useGame.getState, H, S).kind).toBe('none'); // mur imparable à l'épée → pas de cible
  });

  it('arme à Atout Siège sur le même Mur → ciblable (PAS none)', () => {
    const { S, H } = start('mur-en-pierre');
    // Bélier de siège synthétique (mêlée + Atout Siège) directement posé sur les armes résolues.
    const ram: Weapon = { label: 'Bélier', type: 'melee', damage: { plusBF: true, flat: 0 }, qualities: [{ id: 'siege' }] } as Weapon;
    H.weapons = [ram];
    H.pos = { x: 1, y: 2 }; // au contact de la face exposée
    expect(hoverTargeting(useGame.getState, H, S).kind).not.toBe('none'); // l'Atout Siège franchit la gate
  });
});
