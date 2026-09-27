import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { collapseStructure } from './combatFlow';
import { createHero } from '../engine/character';
import { seedBattleRng } from './battleRng';
import { hasCondition } from '../engine/conditions';
import { isWalkable, tileCollapsed, structureIsDown, type Scene, type Terrain } from './scene';
import { testScene } from '../scenes/test-fixture';
import { draineCascade } from './cascadeTestKit';

/**
 * Effondrement de PASSERELLE (Lot B) : abattre une STRUCTURE de sol (herse) fait s'effondrer la passerelle
 * (tuiles z=1) qui la surplombe — ses occupants CHUTENT au sol (dégâts de chute LDB 15) et les tuiles
 * deviennent infranchissables. Déterministe (RNG seedé). On pose une herse sur l'arête E de (2,2) + un
 * 1ᵉʳ étage marchable AU-DESSUS, puis on `collapseStructure`.
 */
const EDGE = { x: 2, y: 2, side: 'E' as const };

function sceneWithParapet(): Scene {
  const s = structuredClone(testScene());
  s.walls = [{ x: EDGE.x, y: EDGE.y, side: EDGE.side, structure: 'porte-de-ville' }];
  // Chemin de ronde au 1ᵉʳ étage : grille marchable surplombant le sol et la herse.
  s.layers = [...s.layers, { z: 1, tiles: new Array(s.dimensions.w * s.dimensions.h).fill('herbe') as Terrain[] }];
  return s;
}

/** Lance un combat sur la scène à herse + passerelle, RNG seedé ; renvoie la structure enrôlée et les ennemis. */
function start() {
  useGame.getState().seedRng(1);
  const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
  useGame.setState({ party: [hero] });
  useGame.getState().startScene(sceneWithParapet());
  useGame.getState().startCombat('enc-mutants');
  useGame.getState().confirmRoundStart();
  vi.clearAllTimers();
  const b = useGame.getState().battle!;
  const S = b.combatants.find((c) => c.bodyShape === 'structure')!;
  const foes = b.combatants.filter((c) => c.kind !== 'hero' && c.bodyShape !== 'structure');
  return { S, foes };
}

describe('Effondrement de passerelle quand la structure portante est abattue', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it("le défenseur SUR la passerelle au-dessus de la herse chute au sol ; sa tuile z=1 devient infranchissable", () => {
    const { S, foes } = start();
    const onPara = foes[0];   // sur la passerelle, au-dessus de la herse
    const elsewhere = foes[1]; // sur la passerelle, AILLEURS (pas au-dessus)
    onPara.pos = { x: EDGE.x, y: EDGE.y, z: 1 };  // (2,2) z=1 = directement au-dessus de l'arête E
    onPara.characteristics = { ...onPara.characteristics, endurance: 30 }; // BE 3 → chute de 4 m garantit l'À Terre
    elsewhere.pos = { x: 10, y: 5, z: 1 };
    // Re-fige le battle (objets combattants mutés) et le RNG (d10 de chute déterministe).
    useGame.setState({ battle: { ...useGame.getState().battle!, combatants: [...useGame.getState().battle!.combatants] } });
    const beforeWounds = onPara.wounds.current;
    seedBattleRng(123);

    collapseStructure(useGame.getState, useGame.setState, S);
    // Le 1d10 des Dégâts de chute de chaque occupant tombe à la PORTE (#1508) : une étape à dé nu
    // appendue par tombant, que le pilote de fenêtre joue ici.
    draineCascade(useGame.getState);

    const after = useGame.getState();
    // Brèche : structure abattue + retirée du combat.
    expect(structureIsDown(after.scene!, { x: EDGE.x, y: EDGE.y, side: EDGE.side, structure: 'porte-de-ville' })).toBe(true);
    expect(after.battle!.combatants.some((c) => c.id === S.id)).toBe(false);

    // Le défenseur au-dessus a CHUTÉ : au sol (z absent), Blessures subies, À Terre.
    const fell = after.battle!.combatants.find((c) => c.id === onPara.id)!;
    expect(fell.pos).toEqual({ x: EDGE.x, y: EDGE.y }); // z=0 (omis)
    expect(fell.pos?.z ?? 0).toBe(0);
    expect(fell.wounds.current).toBeLessThan(beforeWounds);
    expect(hasCondition(fell, 'a-terre')).toBe(true);

    // Sa tuile de passerelle est effondrée → plus marchable.
    expect(tileCollapsed(after.scene!, EDGE.x, EDGE.y, 1)).toBe(true);
    expect(isWalkable(after.scene!, EDGE.x, EDGE.y, 1)).toBe(false);

    // Le défenseur AILLEURS n'a pas bougé (toujours z=1) et sa tuile reste marchable.
    const up = after.battle!.combatants.find((c) => c.id === elsewhere.id)!;
    expect(up.pos).toEqual({ x: 10, y: 5, z: 1 });
    expect(tileCollapsed(after.scene!, 10, 5, 1)).toBe(false);
    expect(isWalkable(after.scene!, 10, 5, 1)).toBe(true);
  });

  it("le sol (z=0) reste marchable inchangé après l'effondrement de la passerelle", () => {
    const { S, foes } = start();
    foes[0].pos = { x: EDGE.x, y: EDGE.y, z: 1 };
    useGame.setState({ battle: { ...useGame.getState().battle!, combatants: [...useGame.getState().battle!.combatants] } });
    seedBattleRng(7);
    collapseStructure(useGame.getState, useGame.setState, S);
    const after = useGame.getState();
    expect(isWalkable(after.scene!, EDGE.x, EDGE.y, 0)).toBe(true); // case d'ancrage au SOL : libre
    expect(tileCollapsed(after.scene!, EDGE.x, EDGE.y, 0)).toBe(false);
  });
});
