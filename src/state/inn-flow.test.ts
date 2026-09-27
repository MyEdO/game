import { describe, it, expect } from 'vitest';
import { useGame } from './store';
import { gatherInnInfo, innGatherInfoMinutes } from './innFlow';
import { seedBattleRng } from './battleRng';
import { createHero, skillCharacteristicById } from '../engine/character';
import { buildScene } from './mapSpec';
import type { Combatant, SkillInstance } from '../engine/types';
import type { WorldMap } from './worldMap';
import { stacks } from '../engine/conditions';

/**
 * RUMEURS D'AUBERGE (#352) — l'Activité canonique `recueillir-informations` (EDOC 8 l.151, skillId
 * `ragot`) étendue au contexte `auberge`, jouée HORS voyage via le seam `openRoll`. Succès → rumeur
 * commerciale (générateur EXISTANT `generateTradeRumour`) ; échec → Exténué (EDOC 8 l.133). L'horloge
 * avance dans les deux cas.
 */
const get = useGame.getState.bind(useGame);
const set = useGame.setState.bind(useGame);

function skill(c: Combatant, skillId: string, advances: number): void {
  const ex = c.skills.find((s) => s.id === skillId);
  if (ex) ex.advances = Math.max(ex.advances, advances);
  else c.skills.push({ id: skillId, characteristic: skillCharacteristicById(skillId), advances } as SkillInstance);
}

function hero(advances: number): Combatant {
  const h = createHero({ speciesId: 'humains-reiklander', careerId: 'marchand', label: 'Artur', motivation: 'x', seed: 11, id: 'h-artur' });
  skill(h, 'ragot', advances);
  return h;
}

function tavernMap(): WorldMap {
  return {
    id: 'm', label: 'Le Reik',
    places: [
      { id: 'A', label: 'Auberge du Cerf', pos: { x: 0, y: 0 }, scene: 'auberge-a' },
      { id: 'B', label: 'Altdorf', pos: { x: 90, y: 0 }, scene: 'altdorf-b', market: { taille: 4, richesse: 4, produits: ['commerce'] } },
    ],
    routes: [],
  };
}

const scene = () => buildScene({ id: 'auberge-a', label: 'Auberge du Cerf', desc: '.', size: [8, 6], terrain: 'planches', heroStart: [2, 3] });

function launch(advances: number, seed: number): void {
  seedBattleRng(seed);
  const g = get();
  g.setParty([hero(advances)]);
  g.loadProject([scene()], 'auberge-a', tavernMap());
  set({ tradeRumours: [], journal: [] });
}

/** Draine la cascade influençable ouverte par `openRoll` (héros piloté-humain → modale, #274). */
function drainCascade(): void {
  let n = 0;
  while (get().pendingCascade && n++ < 20) {
    const p = get().pendingCascade!;
    const cur = p.participants[p.cursor];
    if (cur && cur.target != null && !cur.result) get().cascadeRoll(cur.id);
    else get().cascadeNext();
  }
}

describe('#352 — Recueillir des informations à l’auberge (activité canonique, contexte étendu)', () => {
  it('succès (Ragot élevé) : une rumeur ajoutée au board tradeRumours, aucun Exténué, l’horloge avance', () => {
    launch(60, 7);
    const before = get().gameTime;
    gatherInnInfo(get, set);
    drainCascade();
    expect(get().tradeRumours.length).toBe(1);
    expect(get().tradeRumours[0].placeId).toBe('B'); // AUTRE Lieu à `market`
    expect(stacks(get().party[0], 'extenue')).toBe(0);
    expect(get().gameTime).toBe(before + innGatherInfoMinutes());
  });

  it('échec (aucune Compétence Ragot) : aucune rumeur, Exténué octroyé (EDOC 8 l.133), l’horloge avance quand même', () => {
    launch(0, 42);
    const before = get().gameTime;
    gatherInnInfo(get, set);
    drainCascade();
    expect(get().tradeRumours.length).toBe(0);
    expect(stacks(get().party[0], 'extenue')).toBeGreaterThan(0);
    expect(get().gameTime).toBe(before + innGatherInfoMinutes());
  });
});
