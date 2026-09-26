import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { collapseStructure } from './combatFlow';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { seedBattleRng } from './battleRng';
import { hasCondition } from '../engine/conditions';
import { isWalkable, tileCollapsed, structureIsDown, parapetTilesAbove, type Scene, type Terrain } from './scene';
import { testScene } from '../scenes/test-fixture';
import { scenario as operaPlan } from '../scenes/test-scenarios/opera-plan';
import { parseProject } from './worldMap';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { draineCascade } from './cascadeTestKit';

/**
 * Effondrement de PASSERELLE (Lot B) : abattre une STRUCTURE de sol (herse) fait s'effondrer la passerelle
 * (tuiles z=1) qui la surplombe — ses occupants CHUTENT au sol (dégâts de chute LDB 15) et les tuiles
 * deviennent infranchissables. Déterministe (RNG seedé). On pose une herse sur l'arête E de (2,2) + un
 * 1ᵉʳ étage marchable AU-DESSUS, puis on `collapseStructure`.
 */
const EDGE = { x: 2, y: 2, side: 'E' as const };

function sceneWithParapet(): Scene {
  const s = structuredClone(testScene);
  s.walls = [{ x: EDGE.x, y: EDGE.y, side: EDGE.side, structure: 'porte-de-ville' }];
  // Chemin de ronde au 1ᵉʳ étage : grille marchable surplombant le sol et la herse.
  s.layers = [...s.layers, { z: 1, tiles: new Array(s.dimensions.w * s.dimensions.h).fill('herbe') as Terrain[] }];
  return s;
}

/** Lance un combat sur la scène à herse + passerelle, RNG seedé ; renvoie la structure enrôlée et les ennemis. */
function start() {
  useGame.getState().seedRng(1);
  const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', rng: makeRNG(1) });
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

/**
 * #1883 — la passerelle qui s'écroule est celle de l'étage qui SURMONTE l'arête abattue (`seg.z + 1`) :
 * une arête posée À un étage (garde-corps de balcon, cloison d'étage) ne porte pas le plancher qu'elle
 * borde. Rempart de sol → sa passerelle z=1 (le `describe` ci-dessus) ; arête d'étage → rien de son étage.
 */
describe('parapetTilesAbove — l’étage qui surmonte l’arête (#1883)', () => {
  const Z1 = { x: 2, y: 2, side: 'E' as const, z: 1 };

  function sceneAEtages(): Scene {
    const s = structuredClone(testScene);
    s.walls = [{ ...Z1, structure: 'garde-corps' }];
    const plein = () => new Array(s.dimensions.w * s.dimensions.h).fill('herbe') as Terrain[];
    s.layers = [...s.layers, { z: 1, tiles: plein() }];
    return s;
  }

  it('arête à z=1 : aucune tuile de SON étage ; un étage z=2 marchable au-dessus, lui, est porté', () => {
    const s = sceneAEtages();
    expect(parapetTilesAbove(s, Z1)).toEqual([]);
    const haut = { ...s, layers: [...s.layers, { z: 2, tiles: s.layers[1].tiles }] };
    expect(parapetTilesAbove(haut, Z1)).toEqual([{ x: 2, y: 2, z: 2 }, { x: 3, y: 2, z: 2 }]);
  });

  it('abattre un garde-corps d’étage en combat : l’occupant de la case bordée reste à z=1, sa tuile tient', () => {
    useGame.getState().seedRng(1);
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', rng: makeRNG(1) });
    useGame.setState({ party: [hero], battle: null });
    useGame.getState().startScene(sceneAEtages());
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const S = b.combatants.find((c) => c.bodyShape === 'structure')!;
    expect(S.pos, 'la structure est enrôlée à l’étage de son arête').toEqual({ x: 2, y: 2, z: 1 });
    const foe = b.combatants.find((c) => c.kind !== 'hero' && c.bodyShape !== 'structure')!;
    foe.pos = { x: 2, y: 2, z: 1 };
    useGame.setState({ battle: { ...b, combatants: [...b.combatants] } });
    collapseStructure(useGame.getState, useGame.setState, S);
    const after = useGame.getState();
    expect(structureIsDown(after.scene!, { ...Z1, structure: 'garde-corps' })).toBe(true);
    expect(after.battle!.combatants.find((c) => c.id === foe.id)!.pos).toEqual({ x: 2, y: 2, z: 1 });
    expect(tileCollapsed(after.scene!, 2, 2, 1)).toBe(false);
    expect(tileCollapsed(after.scene!, 3, 2, 1)).toBe(false);
  });

  it('opéra et Diligence : aucune arête à structure d’étage n’écroule une tuile de son propre étage', () => {
    const diligence = parseProject(JSON.parse(readFileSync(join(process.cwd(), 'src/scenes/diligence/diligence-projet.json'), 'utf8')));
    const scenes: [string, Scene][] = [
      ['opera-plan', operaPlan.scene],
      ...diligence.scenes.map((sc): [string, Scene] => [sc.id, sc]),
    ];
    let aretesDEtage = 0;
    const fautives: string[] = [];
    for (const [id, sc] of scenes)
      for (const w of sc.walls ?? []) {
        if (!w.structure || !(w.z ?? 0)) continue;
        aretesDEtage++;
        for (const t of parapetTilesAbove(sc, w)) if (t.z === (w.z ?? 0)) fautives.push(`${id} ${w.x},${w.y}${w.side} z${w.z}`);
      }
    expect(aretesDEtage, 'les deux scènes portent des arêtes à structure d’étage — sinon ce contrat ne mesure rien').toBeGreaterThan(0);
    expect(fautives).toEqual([]);
  });
});
