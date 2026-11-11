import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect } from 'vitest';
import { useGame } from './store';
import { buildRiverPlan, runRiverDays } from '../noyau/riverVoyageFlow';
import { buildApi } from './devtools';
import { creditBourse } from '../noyau/bourseFlow';
import { seedBattleRng } from '../noyau/battleRng';
import { createHero, skillCharacteristicById } from '../engine/character';
import { buildScene } from '../noyau/mapSpec';
import type { Combatant, SkillInstance } from '../engine/types';
import type { MapRoute, MapRouteTrace, WorldMap } from '../noyau/worldMap';

/**
 * VOYAGE FLUVIAL (MSRC 7), côté web : les helpers de recette `__wfrp.riverDayCascade` et
 * `__wfrp.forceRiverCapsize`. La descente se joue au banc du noyau (`src/noyau/river-voyage-flow.hors-store.test.ts`).
 */
const get = useGame.getState.bind(useGame);
const set = useGame.setState.bind(useGame);

function skill(c: Combatant, skillId: string, advances: number, spec?: string): void {
  const ex = c.skills.find((s) => s.id === skillId && (s.spec ?? null) === (spec ?? null));
  if (ex) ex.advances = Math.max(ex.advances, advances);
  else c.skills.push({ id: skillId, spec, characteristic: skillCharacteristicById(skillId), advances } as SkillInstance);
}

/** Un équipage de barge : Gunnar le batelier (Ramer/Voile), plus deux passagers sans compétence de marin. */
function crew(withSavoir = false): Combatant[] {
  const gunnar = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'batelier', label: 'Gunnar', motivation: 'x', seed: 11, id: 'r-gunnar' });
  skill(gunnar, 'ramer', 50);
  skill(gunnar, 'voile', 45, 'chaland');
  skill(gunnar, 'metier', 40, 'construction-de-bateaux'); // spec par ID (#1341) — la donnée en stocke un
  const otto = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'garde', label: 'Otto', motivation: 'x', seed: 12, id: 'r-otto' });
  const lise = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'erudit', label: 'Lise', motivation: 'x', seed: 13, id: 'r-lise' });
  const trio = [gunnar, otto, lise];
  if (withSavoir) for (const h of trio) skill(h, 'savoir', 40, 'voies-fluviales');
  return trio;
}

const route = (km: number, extra: Partial<MapRouteTrace> = {}): MapRoute => ({
  id: 'r-reik', a: { id: 'A' }, b: { id: 'B' }, km, modes: ['barge', 'pied'], river: true, inns: true, perilDie: 0, ...extra,
});

function riverMap(km: number, extra: Partial<MapRouteTrace> = {}): WorldMap {
  return {
    id: 'm', label: 'Le Reik',
    places: [
      { id: 'A', label: 'Grünburg', pos: { x: 0, y: 0 }, scene: { id: 'quai-a' } },
      { id: 'B', label: 'Altdorf', pos: { x: 90, y: 0 }, scene: { id: 'quai-b' } },
    ],
    routes: [route(km, extra)],
  };
}

const quai = (id: string, label: string) => buildScene({ id, label, desc: '.', size: [8, 6], terrain: 'planches', heroStart: [2, 3] });

/** Charge le projet (2 quais + carte) et l'équipage, au quai de Grünburg. */
function launch(withSavoir = false, km = 45, extra: Partial<MapRouteTrace> = {}): void {
  seedBattleRng(7);
  const g = get();
  g.fixerLeGroupe(crew(withSavoir));
  g.chargerLeProjet({ scenes: [quai('quai-a', 'Grünburg'), quai('quai-b', 'Altdorf')], entryId: 'quai-a', worldMap: riverMap(km, extra), projet: null });
  set({ travelPlan: null, pendingRest: null, pendingCascade: null, travelRecap: null, journal: [] });
  creditBourse(get, set, get().party[0].id, { gold: 500, silver: 0, brass: 0 }); // bourse du groupe (péages/auberges) — SOCLE POSSESSIONS #531
}

/**
 * #1117 (recette 5) — les helpers de recette REPOSENT la journée : `startCascade` APPEND quand le
 * `purpose` est déjà ouvert (doctrine du slot, voulue — le combat en dépend), donc sans purge le
 * harnais concaténait deux journées (ids dupliqués, clés React en double, étapes injouables). Le
 * chemin JOUEUR, lui, ne peut pas doubler : `runRiverDays` refuse tant qu'une cascade est ouverte.
 */
describe('helpers de recette — reposer la journée ne DUPLIQUE jamais les étapes (#1117)', () => {
  it('`riverDayCascade()` deux fois : aucun id dupliqué, le compte reste celui d’UNE journée', () => {
    launch(false, 45);
    set({ travelPlan: buildRiverPlan(get, 'r-reik', 'A', 'B', get().worldMap!.routes[0])! });
    const api = buildApi();
    api.riverDayCascade();
    const first = get().pendingCascade!.participants.map((s) => s.id);
    api.riverDayCascade();
    const second = get().pendingCascade!.participants.map((s) => s.id);
    expect(new Set(second).size, 'aucune clé en double').toBe(second.length);
    expect(second).toEqual(first); // une journée reposée = LA MÊME journée, pas deux concaténées
  });

  it('`forceRiverCapsize()` après une journée déjà posée : la journée est REMPLACÉE, avec l’étape armée', () => {
    launch(false, 45);
    set({ travelPlan: buildRiverPlan(get, 'r-reik', 'A', 'B', get().worldMap!.routes[0])! });
    const api = buildApi();
    api.riverDayCascade();
    api.forceRiverCapsize();
    const ids = get().pendingCascade!.participants.map((s) => s.id);
    expect(new Set(ids).size, 'aucune clé en double après armement').toBe(ids.length);
    expect(get().pendingCascade!.participants.some((s) => s.kind === 'fleuveChavirage'), 'l’étape armée est au programme').toBe(true);
  });

  it('le chemin JOUEUR est déjà protégé : `runRiverDays` ne rouvre rien tant qu’une cascade est ouverte', () => {
    launch(false, 45);
    set({ travelPlan: buildRiverPlan(get, 'r-reik', 'A', 'B', get().worldMap!.routes[0])! });
    buildApi().riverDayCascade();
    const before = get().pendingCascade!.participants.length;
    runRiverDays(get, set);
    expect(get().pendingCascade!.participants).toHaveLength(before);
  });
});
