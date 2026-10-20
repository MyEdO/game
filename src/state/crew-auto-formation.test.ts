import { describe, it, expect } from 'vitest';
import { useGame } from './store';
import { buildScene } from '../noyau/mapSpec';
import { buildEncounters } from '../noyau/monde/encounterAuthoring';
import { crewFormationSlots } from '../noyau/monde/shipPostes';
import { pregenParty, PREGEN } from '../data/pregens';
import type { Scene } from '../noyau/monde/scene';

/**
 * Verrouillage #210 résidu — `autoFormCrews` (shipPostes.ts) câblé au spawn (`combatSlice.startCombat`) :
 * un servant de poste terrestre CREWÉ dont la SceneEntity n'a reçu AUCUNE position propre (pos == celle de
 * la coque, défaut de qui ne place pas la formation à la main) atterrit sur une case de `crewFormationSlots`
 * (ADE II 8 l.258 — jamais l'avant, jamais sous l'empreinte). Une position AUTHORÉE distincte de la
 * coque (comme les 5 servants de `42-belier-porte.ts`) reste INCHANGÉE — le placement d'auteur prime.
 */
const ENC_ID = 'crew-auto-fx';
const IDS = [0, 1, 2].map((i) => `enemy-${ENC_ID}-${i}`);
const HULL_POS = { x: 5, y: 5 };
const HEADING = 'N' as const;
const AUTHORED_POS = { x: 9, y: 9 };

function makeScene(): Scene {
  const scene = buildScene({
    id: 'crew-auto-fx-scene', label: 'Crew auto fx', desc: 'test scénario', size: [12, 12],
    terrain: 'herbe', heroStart: [1, 1],
  });
  const { entities, encounters } = buildEncounters([{
    id: ENC_ID,
    enemies: [
      {
        ref: 'belier-ade2', pos: HULL_POS, facing: HEADING, side: 'ally',
        postes: [{ trappingId: 'belier-ade2', crewIds: [IDS[1], IDS[2]] }],
      },
      { ref: 'garde-du-village', pos: HULL_POS, side: 'ally', ai: true }, // SANS position propre (== coque)
      { ref: 'garde-du-village', pos: AUTHORED_POS, side: 'ally', ai: true }, // position AUTHORÉE distincte
    ],
  }]);
  scene.entities.push(...entities);
  scene.encounters = encounters;
  return scene;
}

function start(): void {
  useGame.setState({ party: pregenParty(PREGEN.soldat) });
  useGame.getState().startScene(makeScene());
  useGame.getState().startCombat(ENC_ID);
}

describe('autoFormCrews — câblage au spawn (#210 résidu)', () => {
  it('servant SANS position propre (pos == coque) atterrit sur une case de `crewFormationSlots`, quitte la case de la coque', () => {
    start();
    const b = useGame.getState().battle!;
    const hull = b.combatants.find((c) => c.id === IDS[0])!;
    const auto = b.combatants.find((c) => c.id === IDS[1])!;
    expect(auto.pos).not.toEqual(hull.pos);
    const slots = crewFormationSlots(hull, { crewIds: [IDS[1], IDS[2]] }, { heading: HEADING });
    expect(slots.some((p) => p.x === auto.pos!.x && p.y === auto.pos!.y)).toBe(true);
  });

  it('servant à position EXPLICITE distincte de la coque → INCHANGÉE (le placement d’auteur prime)', () => {
    start();
    const b = useGame.getState().battle!;
    const authored = b.combatants.find((c) => c.id === IDS[2])!;
    expect(authored.pos).toMatchObject(AUTHORED_POS);
  });
});
