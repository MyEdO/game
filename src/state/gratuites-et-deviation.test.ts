/**
 * Les gratuites d'un tour survivent à une étape de Blessure critique (#1595 7d, #1858) : LDB 63 l.30 ;
 * LDB 16 l.139 ; LDB 85 l.41-43.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { aiCreatureFreeAttacks } from '../noyau/combatFlow';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import type { Combatant, ItemInstance } from '../engine/types';
import { resetCadence } from '../engine/cadence';
import { draineCascade, type ChoisitCle } from '../noyau/cascade.testkit';
import { LOCALISATIONS_DE_COUP } from '../engine/types';

const LIEUX = LOCALISATIONS_DE_COUP;
const harnois = (): ItemInstance =>
  ({ uid: 'harnois', name: 'Harnois', kind: 'armor', equipped: true, pa: 3, locs: [...LIEUX], qualities: [] } as unknown as ItemInstance);

function monte() {
  const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
  useGame.setState({ party: [hero] });
  useGame.getState().startScene(testScene());
  useGame.getState().startCombat('enc-mutants');
  useGame.getState().confirmRoundStart();
  vi.clearAllTimers();
  const b = useGame.getState().battle!;
  const H = b.combatants.find((c) => c.kind === 'hero')!;
  const enemies = b.combatants.filter((c) => c.kind === 'enemy');
  enemies.slice(1).forEach((e) => (e.dead = true));
  const E = enemies[0];
  H.pos = { x: 10, y: 10 }; H.size = 'moyenne';
  H.wounds = { current: 60, max: 60, base: 60 } as Combatant['wounds'];
  H.items = [harnois()];
  H.armour = { tete: 3, brasG: 3, brasD: 3, corps: 3, jambeG: 3, jambeD: 3 };
  H.conditions = [{ id: 'surpris', value: 1 }];
  E.pos = { x: 11, y: 10 }; E.size = 'enorme';
  E.characteristics['capacite-de-combat'] = 85; E.characteristics.force = 45;
  E.traits = [{ id: 'morsure', value: 14 }] as Combatant['traits'];
  E.advantage = 4;
  // L'Action de la créature est jouée : ses gratuites suivent l'attaque principale.
  useGame.setState({ battle: { ...b, turn: b.order.indexOf(E.id), acted: true } });
  return { H, E };
}

const voie = (cle: 'devier' | 'subir'): ChoisitCle => (etape) => (etape.kind === 'deviation' ? cle : undefined);
const etapesDeDeviation = () => (useGame.getState().pendingCascade?.participants ?? []).filter((s) => s.kind === 'deviation');

describe('Gratuites de créature et Déviation (LDB 63 l.30, #1858)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); resetCadence(); useGame.setState({ battle: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); resetCadence(); });

  for (const cle of ['devier', 'subir'] as const) {
    it(`Morsure critique sur un héros tenu SURPRIS (${cle}) : Piétinement attend l'étape, puis part une fois au même tour`, () => {
      useGame.getState().seedRng(41); // la Morsure porte un Critique : la file garde Piétinement
      const { H, E } = monte();
      const tour = { round: useGame.getState().battle!.round, turn: useGame.getState().battle!.turn };
      expect(aiCreatureFreeAttacks(useGame.getState, useGame.setState, E), 'la Morsure suspend sur son étape').toBe(true);
      expect(etapesDeDeviation(), 'une étape de Blessure critique est ouverte').toHaveLength(1);
      expect(E.pendingFreeAttacks, 'Piétinement reste en tête de file pendant l’étape').toEqual(['pietinement']);
      expect(E.freeAttacksThisTurn?.pietinement ?? 0, 'Piétinement ne part pas par-dessus l’étape').toBe(0);

      draineCascade(useGame.getState, 200, undefined, voie(cle));

      const b = useGame.getState().battle!;
      expect({ round: b.round, turn: b.turn }, 'toujours le tour de la créature').toEqual(tour);
      expect(E.freeAttacksThisTurn?.pietinement, 'Piétinement est parti une fois').toBe(1);
      expect(E.pendingFreeAttacks, 'la file du tour est épuisée : rien ne repart au tour suivant').toBeUndefined();
      const h = b.combatants.find((c) => c.id === H.id)!;
      expect(h.conditions.some((c) => c.id === 'surpris'), `Surpris conservé après « ${cle} » (LDB 16 l.139)`).toBe(true);
    });
  }
});
