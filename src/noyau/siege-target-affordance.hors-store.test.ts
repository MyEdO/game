import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { createHero } from '../engine/character';
import { itemFromTrappingById, recomputeLoadout } from '../engine/items';
import { hoverTargeting } from './targeting';
import type { Scene } from './monde/scene';
import { testScene } from '../scenes/test-fixture';
import type { Weapon } from '../engine/types';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * AFFORDANCE de ciblage joueur — une STRUCTURE de siège (mur Impénétrable, ADE II 8) n'est PAS une
 * cible d'attaque pour une arme SANS l'Atout Siège : « attaquer un rempart à l'épée » n'a pas de sens
 * (même gate que l'IA). Le survol retombe alors sur le déplacement (monter au rempart) au lieu d'un
 * « hors de portée » fantôme. Une arme à Atout Siège, elle, la rend ciblable.
 *
 * On dépose un `WallSeg.structure` (Mur en pierre = Impénétrable) sur la scène de fixture puis `lancerLeCombat` —
 * la structure devient un Combattant inerte ; le mode neutre (action null) = mode d'attaque.
 */
const EDGE = { x: 2, y: 2, side: 'E' as const };
function sceneWithStructure(structId: string): Scene {
  const s = structuredClone(testScene());
  s.walls = [{ x: EDGE.x, y: EDGE.y, side: EDGE.side, structure: structId }];
  return s;
}

function start(structId: string, seed = 1) {
  banc.getState().ensemencerLeTirage(seed);
  const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed });
  banc.setState({ party: [hero] });
  banc.getState().lancerLaScene(sceneWithStructure(structId));
  banc.getState().lancerLeCombat('enc-mutants');
  banc.getState().fenetreValider('debutDuRound');
  banc.abandonner();
  const b = banc.getState().battle!;
  const S = b.combatants.find((c) => c.bodyShape === 'structure')!;
  const H = b.combatants.find((c) => c.kind === 'heros')!;
  // Mode neutre garanti + héros actif : l'affordance d'attaque ne vit qu'en mode neutre (action null).
  banc.setState({ battle: { ...b, turn: b.order.indexOf(H.id), action: null, acted: false } });
  return { S, H };
}

describe('Affordance — structures réservées aux armes de siège', () => {
  it('arme de mêlée ordinaire sur un Mur Impénétrable → aucun réticule (none) : le survol retombe sur le déplacement', () => {
    const { S, H } = start('mur-en-pierre');
    // Arme simple (épée, mêlée, SANS Atout Siège), au contact de la face de la structure.
    const sword = itemFromTrappingById('arme-simple', idsDeTest)!; sword.equipped = true;
    H.items = [sword]; H.loadouts = undefined; H.activeLoadoutId = undefined; recomputeLoadout(H);
    H.pos = { x: 1, y: 2 }; // adjacent à la face (2,2) de l'arête E
    expect(H.weapons.length).toBeGreaterThan(0); // sanity : une option d'arme existe
    expect(hoverTargeting(banc.getState, H, S).kind).toBe('none'); // mur imparable à l'épée → pas de cible
  });

  it('arme à Atout Siège sur le même Mur → ciblable (PAS none)', () => {
    const { S, H } = start('mur-en-pierre');
    // Bélier de siège synthétique (mêlée + Atout Siège) directement posé sur les armes résolues.
    const ram: Weapon = { label: 'Bélier', type: 'melee', damage: { plusBF: true, flat: 0 }, qualities: [{ id: 'siege' }] } as Weapon;
    H.weapons = [ram];
    H.pos = { x: 1, y: 2 }; // au contact de la face exposée
    expect(hoverTargeting(banc.getState, H, S).kind).not.toBe('none'); // l'Atout Siège franchit la gate
  });
});
