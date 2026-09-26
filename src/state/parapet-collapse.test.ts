import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { collapseStructure } from './combatFlow';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { seedBattleRng } from './battleRng';
import { hasCondition } from '../engine/conditions';
import { isWalkable, tileCollapsed, structureIsDown, parapetTilesAbove, heightAt, type Scene, type Terrain } from './scene';
import { testScene } from '../scenes/test-fixture';
import { scenario as operaPlan } from '../scenes/test-scenarios/opera-plan';
import { parseProject } from './worldMap';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { draineCascade } from './cascadeTestKit';
import { schema as schemaStructures } from '../data/schemas/defs/structures';

/**
 * Effondrement de PASSERELLE (AA 10 l.127) : abattre un MUR de sol qui `soutientEtage` fait s'effondrer
 * le chemin de ronde (tuiles z=1) qui le surmonte — ses occupants CHUTENT (dégâts de chute LDB 15) et
 * les tuiles deviennent infranchissables. Déterministe (RNG seedé). On pose un mur de château sur l'arête
 * E de (2,2) + un 1ᵉʳ étage marchable AU-DESSUS, puis on `collapseStructure`.
 */
const EDGE = { x: 2, y: 2, side: 'E' as const };
const REMPART = 'mur-de-chateau';

function sceneWithParapet(): Scene {
  const s = structuredClone(testScene);
  s.walls = [{ x: EDGE.x, y: EDGE.y, side: EDGE.side, structure: REMPART }];
  // Chemin de ronde au 1ᵉʳ étage : grille marchable surplombant le sol et le rempart.
  s.layers = [...s.layers, { z: 1, tiles: new Array(s.dimensions.w * s.dimensions.h).fill('herbe') as Terrain[] }];
  return s;
}

/** Lance un combat sur la scène à rempart + passerelle, RNG seedé ; renvoie la structure enrôlée et les ennemis. */
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

  it("le défenseur SUR la passerelle au-dessus du rempart chute au sol ; sa tuile z=1 devient infranchissable", () => {
    const { S, foes } = start();
    const onPara = foes[0];   // sur la passerelle, au-dessus du rempart
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
    expect(structureIsDown(after.scene!, { x: EDGE.x, y: EDGE.y, side: EDGE.side, structure: REMPART })).toBe(true);
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

/** Lance un combat sur `scene` (rencontre `enc-mutants` du banc), pose le 1ᵉʳ ennemi en `pos` et abat la
 *  Structure de l'arête `edge`. Renvoie l'état d'après et l'id de l'ennemi posé. */
function abattre(scene: Scene, edge: { x: number; y: number; side: 'N' | 'E'; z?: number }, pos: { x: number; y: number; z?: number }) {
  useGame.getState().seedRng(1);
  const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', rng: makeRNG(1) });
  useGame.setState({ party: [hero], battle: null });
  const banc = testScene.entities.filter((en) => en.kind !== 'heroStart');
  useGame.getState().startScene({ ...scene, entities: [...scene.entities, ...banc], encounters: testScene.encounters });
  useGame.getState().startCombat('enc-mutants');
  useGame.getState().confirmRoundStart();
  vi.clearAllTimers();
  const b = useGame.getState().battle!;
  const S = b.combatants.find((c) => c.structureEdge && c.structureEdge.x === edge.x && c.structureEdge.y === edge.y
    && c.structureEdge.side === edge.side && (c.structureEdge.z ?? 0) === (edge.z ?? 0))!;
  expect(S, 'la structure de l’arête est enrôlée').toBeTruthy();
  const foe = b.combatants.find((c) => c.kind !== 'hero' && c.bodyShape !== 'structure')!;
  foe.pos = pos;
  useGame.setState({ battle: { ...b, combatants: [...b.combatants] } });
  collapseStructure(useGame.getState, useGame.setState, S);
  return { after: useGame.getState(), foeId: foe.id };
}

/**
 * #1883 — la passerelle qui s'écroule est celle de l'étage qui SURMONTE l'arête abattue (`seg.z + 1`),
 * et seulement si la Structure `soutientEtage` (`structures.json`, valeur maison) : un mur porte ; un
 * garde-corps, une porte, une herse ou une clôture ne portent rien. L'occupant retombe à l'étage de
 * l'arête (`seg.z`), pas au sol.
 */
describe('parapetTilesAbove — l’étage qui surmonte l’arête (#1883)', () => {
  const Z1 = { x: 2, y: 2, side: 'E' as const, z: 1 };

  function sceneAEtages(structure: string, etages = 1): Scene {
    const s = structuredClone(testScene);
    s.walls = [{ ...Z1, structure }];
    const plein = () => new Array(s.dimensions.w * s.dimensions.h).fill('herbe') as Terrain[];
    // Chaque étage à 3 m au-dessus du précédent : la hauteur de chute se lit au relief (`heightAt`).
    for (let z = 1; z <= etages; z++) s.layers = [...s.layers, { z, tiles: plein(), height: new Array(s.dimensions.w * s.dimensions.h).fill(3 * z) }];
    return s;
  }

  it('arête à z=1 : aucune tuile de SON étage ; l’étage z=2 est porté par un mur, jamais par un garde-corps', () => {
    expect(parapetTilesAbove(sceneAEtages('mur-a-ossature-en-bois'), { ...Z1, structure: 'mur-a-ossature-en-bois' })).toEqual([]);
    expect(parapetTilesAbove(sceneAEtages('mur-a-ossature-en-bois', 2), { ...Z1, structure: 'mur-a-ossature-en-bois' }))
      .toEqual([{ x: 2, y: 2, z: 2 }, { x: 3, y: 2, z: 2 }]);
    expect(parapetTilesAbove(sceneAEtages('garde-corps', 2), { ...Z1, structure: 'garde-corps' })).toEqual([]);
  });

  it('abattre un garde-corps d’étage sous un étage z=2 : rien ne tombe, les deux étages tiennent', () => {
    const { after, foeId } = abattre(sceneAEtages('garde-corps', 2), Z1, { x: 2, y: 2, z: 2 });
    expect(structureIsDown(after.scene!, { ...Z1, structure: 'garde-corps' })).toBe(true);
    expect(after.battle!.combatants.find((c) => c.id === foeId)!.pos).toEqual({ x: 2, y: 2, z: 2 });
    expect(tileCollapsed(after.scene!, 2, 2, 2)).toBe(false);
    expect(tileCollapsed(after.scene!, 2, 2, 1)).toBe(false);
  });

  it('abattre un mur d’étage (z=1) sous un étage z=2 : l’occupant retombe à z=1, de la hauteur z2→z1', () => {
    const scene = sceneAEtages('mur-a-ossature-en-bois', 2);
    const { after, foeId } = abattre(scene, Z1, { x: 2, y: 2, z: 2 });
    expect(after.battle!.combatants.find((c) => c.id === foeId)!.pos?.z).toBe(1);
    expect(tileCollapsed(after.scene!, 2, 2, 2)).toBe(true);
    expect(tileCollapsed(after.scene!, 2, 2, 1)).toBe(false);
    const z2z1 = heightAt(scene, 2, 2, 2) - heightAt(scene, 2, 2, 1);
    expect(z2z1, 'z2→z1 diffère de z2→sol — sinon la mesure ne distingue rien').not.toBe(heightAt(scene, 2, 2, 2) - heightAt(scene, 2, 2, 0));
    const chute = after.pendingCascade?.participants.find((st) => st.id.startsWith(`chute-${foeId}-`));
    expect(chute?.meta?.chuteMetres).toBe(z2z1);
  });

  it('la Diligence : une porte abattue laisse le plancher z=1 intact ; un mur abattu l’effondre', () => {
    const diligence = parseProject(JSON.parse(readFileSync(join(process.cwd(), 'src/scenes/diligence/diligence-projet.json'), 'utf8'))).scenes[0];
    const PORTE = { x: 14, y: 8, side: 'E' as const };
    const MUR = { x: 14, y: 6, side: 'E' as const };
    const au = (e: { x: number; y: number; side: string }) => diligence.walls?.find((w) => w.x === e.x && w.y === e.y && w.side === e.side && !(w.z ?? 0))?.structure;
    expect(au(PORTE)).toBe('solide-porte-en-bois');
    expect(au(MUR)).toBe('mur-a-ossature-en-bois');
    expect(isWalkable(diligence, 14, 8, 1), 'un plancher marchable surmonte la porte — sinon ce contrat ne mesure rien').toBe(true);

    const porte = abattre(diligence, PORTE, { x: 14, y: 8, z: 1 });
    expect(porte.after.battle!.combatants.find((c) => c.id === porte.foeId)!.pos?.z).toBe(1);
    expect(tileCollapsed(porte.after.scene!, 14, 8, 1)).toBe(false);
    expect(tileCollapsed(porte.after.scene!, 15, 8, 1)).toBe(false);

    const mur = abattre(diligence, MUR, { x: 14, y: 6, z: 1 });
    expect(mur.after.battle!.combatants.find((c) => c.id === mur.foeId)!.pos?.z ?? 0).toBe(0);
    expect(tileCollapsed(mur.after.scene!, 14, 6, 1)).toBe(true);
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

/** #1883 — `soutientEtage` : OBLIGATOIRE sur chaque Structure (aucun défaut implicite), et valeur maison
 *  nommée par son `maison` (aucun folio ne dit quelle Structure porte un étage, AA 10 l.127). */
describe('structures.json — `soutientEtage` se déclare, et se justifie', () => {
  const base = {
    id: 'x-banc', type: 'structures', label: 'X', kind: 'mur',
    char: { BE: 1, B: 1 }, traits: [], source: { book: 'aux-armes', page: 119 },
    taille: 'grande', soutientEtage: true, maison: 'banc — raison hors sujet ici',
  };
  const parse = (e: unknown) => (schemaStructures as { safeParse: (v: unknown) => { success: boolean; error?: { issues: { path: (string | number)[]; message: string }[] } } }).safeParse([e]);
  const refus = (e: unknown) => JSON.stringify(parse(e).error?.issues.map((i) => `${i.path.join('.')}: ${i.message}`));

  it('déclaré avec son `maison` : accepté', () => {
    expect(parse(base).success).toBe(true);
  });

  it('absent : REFUSÉ — aucune entrée ne porte l’étage par défaut', () => {
    const { soutientEtage: _s, ...sans } = base;
    expect(refus(sans)).toContain('soutientEtage');
  });

  it('sans `maison` : REFUSÉ, nominativement', () => {
    const { maison: _m, ...sans } = base;
    expect(refus(sans)).toContain('`soutientEtage` sans `maison`');
  });
});
