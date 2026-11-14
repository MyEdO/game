import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect } from 'vitest';
import { emptyScene, type Scene } from '../noyau/monde/scene';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { avanceEtapeCascade } from '../noyau/cascade.testkit';
import { stepSubtitle } from '../ui/CascadeModal';

/**
 * Chute VOLONTAIRE (LDB 15 l.82 ; EDO 01 l.231), côté web : le sous-titre que la fenêtre de cascade (`CascadeModal`)
 * rend à chaque 1d10 de chute. Le câblage se joue au banc du noyau (`src/noyau/fallFlow.hors-store.test.ts`).
 */

// Falaise de 4 m entre le sommet (2,0) à 4 m et le pied (2,1) à 0 m — AUCUNE arête `climb`.
function cliffScene(): Scene {
  const s = emptyScene('scene-test', 4, 4);
  const w = 4;
  const h = new Array(w * 4).fill(0) as number[];
  h[0 * w + 2] = 4;
  s.layers[0].height = h;
  return s;
}
const top = { x: 2, y: 0 };
const foot = { x: 2, y: 1 };
const g = () => useGame.getState();

describe('franchirLArete, chute — exploration, compteur des Dégâts de chute (LDB 15 l.80)', () => {
  it('trois tombants : chaque 1d10 se situe sur les TROIS dés de la chute — 1/3, 2/3, 3/3', () => {
    const heros = ['A', 'B', 'C'].map((label, i) => createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label, seed: i + 1 }));
    useGame.setState({ battle: null, party: heros, mode: 'exploration', partyPos: top, scene: cliffScene(), pendingFall: null, pendingCascade: null, journal: [] });
    g().franchirLArete(foot);
    for (const h of heros) g().jetRegler('chute', 'tenter', false, h.id);
    // Le sous-titre RENDU par la fenêtre de cascade pour une étape à dé nu (`CascadeModal`, branche dé).
    const vus: unknown[] = [];
    for (let i = 0; i < 10 && g().pendingCascade; i++) {
      const p = g().pendingCascade!;
      const cur = p.participants[p.cursor];
      if (cur?.kind === 'chuteDe') vus.push(stepSubtitle({ cursor: p.cursor, total: p.participants.length }, heros.find((h) => h.id === cur.actorId)?.label));
      avanceEtapeCascade(g);
    }
    expect(vus).toEqual(['A — 1/3', 'B — 2/3', 'C — 3/3']);
  });
});
