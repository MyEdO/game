/**
 * Les gratuites d'un tour survivent à une étape de Blessure critique (#1595 7d, #1858) : LDB 63 l.30 ;
 * LDB 16 l.139 ; LDB 85 l.41-43.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { aiCreatureFreeAttacks } from './combatFlow';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import type { Combatant, ItemInstance } from '../engine/types';
import { draineCascade, type ChoisitCle } from './cascade.testkit';
import { LOCALISATIONS_DE_COUP } from '../engine/types';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const LIEUX = LOCALISATIONS_DE_COUP;
const harnois = (): ItemInstance =>
  ({ uid: 'harnois', name: 'Harnois', kind: 'armor', equipped: true, pa: 3, locs: [...LIEUX], qualities: [] } as unknown as ItemInstance);

function monte() {
  const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
  banc.setState({ party: [hero] });
  banc.getState().startScene(testScene());
  banc.getState().startCombat('enc-mutants');
  banc.getState().confirmRoundStart();
  banc.abandonner();
  const b = banc.getState().battle!;
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
  banc.setState({ battle: { ...b, turn: b.order.indexOf(E.id), acted: true } });
  return { H, E };
}

const voie = (cle: 'devier' | 'subir'): ChoisitCle => (etape) => (etape.kind === 'deviation' ? cle : undefined);
const etapesDeDeviation = () => (banc.getState().pendingCascade?.participants ?? []).filter((s) => s.kind === 'deviation');

describe('Gratuites de créature et Déviation (LDB 63 l.30, #1858)', () => {
  for (const cle of ['devier', 'subir'] as const) {
    it(`Morsure critique sur un héros tenu SURPRIS (${cle}) : Piétinement attend l'étape, puis part une fois au même tour`, () => {
      banc.getState().seedRng(41); // la Morsure porte un Critique : la file garde Piétinement
      const { H, E } = monte();
      const tour = { round: banc.getState().battle!.round, turn: banc.getState().battle!.turn };
      expect(aiCreatureFreeAttacks(banc.getState, banc.setState, E), 'la Morsure suspend sur son étape').toBe(true);
      expect(etapesDeDeviation(), 'une étape de Blessure critique est ouverte').toHaveLength(1);
      expect(E.pendingFreeAttacks, 'Piétinement reste en tête de file pendant l’étape').toEqual(['pietinement']);
      expect(E.freeAttacksThisTurn?.pietinement ?? 0, 'Piétinement ne part pas par-dessus l’étape').toBe(0);

      draineCascade(banc.getState, 200, undefined, voie(cle));

      const b = banc.getState().battle!;
      expect({ round: b.round, turn: b.turn }, 'toujours le tour de la créature').toEqual(tour);
      expect(E.freeAttacksThisTurn?.pietinement, 'Piétinement est parti une fois').toBe(1);
      expect(E.pendingFreeAttacks, 'la file du tour est épuisée : rien ne repart au tour suivant').toBeUndefined();
      const h = b.combatants.find((c) => c.id === H.id)!;
      expect(h.conditions.some((c) => c.id === 'surpris'), `Surpris conservé après « ${cle} » (LDB 16 l.139)`).toBe(true);
    });
  }
});
