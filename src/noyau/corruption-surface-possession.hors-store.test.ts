/**
 * #1426 — le seuil de Corruption (LDB 19 l.70) se gate sur la SURFACE (`tenuParUnHumain`), jamais sur
 * l'affordance LOCALE (`pilotedByHuman`). Chez l'HÔTE, un héros possédé par un siège DISTANT n'est pas
 * « piloté ici » : l'ancien prédicat le dégradait en automate et auto-résolvait son Test de seuil —
 * mutation appliquée d'office, sans que SON joueur ait jamais vu la fenêtre. En SOLO les deux
 * prédicats coïncident : la régression y est invisible, d'où le harnais à deux sièges.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { gainCorruption } from './corruptionFlow';
import { pilotedByHuman } from './netOwnership';
import { tenuParUnHumain } from './sieges';
import { initialNet } from './etat';
import { makePregens } from '../data/pregens';
import type { Combatant } from '../engine/types';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const g = () => banc.getState();
const NET0 = initialNet();

/** Héros dont le seuil BFM+BE vaut 0 : le moindre gain le franchit. */
function heroAuSeuil(): Combatant {
  const h = makePregens()[0];
  h.characteristics.endurance = 1;
  h.characteristics['force-mentale'] = 1;
  h.corruption = 10;
  h.mutations = [];
  return h;
}

beforeEach(() => {
  banc.setState({
    battle: null, party: [], journal: [], pendingCorruption: null, pendingRenounce: null,
    corruptionQueue: [], net: { ...NET0, mode: 'local', mySeat: 0, gmSeat: undefined, ownership: {} },
  });
  g().seedRng(7);
});

describe('Seuil de Corruption — la SURFACE, pas l’affordance locale (#1426)', () => {
  it('siège 0 LOCAL : le gain pose la fenêtre de seuil', () => {
    const h = heroAuSeuil();
    banc.setState({ party: [h] });
    gainCorruption(banc.getState, banc.setState, h, 1);
    expect(g().pendingCorruption?.kind).toBe('seuil');
    expect(g().pendingCorruption?.heroId).toBe(h.id);
    expect(h.mutations ?? []).toEqual([]); // rien d'appliqué d'office
  });

  it('chez l’hôte, héros possédé par le siège 1 DISTANT : la fenêtre l’attend (pas d’auto-résolution)', () => {
    const h = heroAuSeuil();
    banc.setState({
      party: [h],
      net: { ...NET0, mode: 'host', mySeat: 0, gmSeat: undefined, ownership: { [h.id]: 1 }, slots: [0, 1, 0, 0] },
    });
    // Le prédicat d'affordance LOCALE dit NON chez l'hôte — c'est lui qui auto-résolvait.
    expect(pilotedByHuman(g(), h), 'affordance locale : l’hôte n’a pas la main').toBe(false);
    expect(tenuParUnHumain(g(), h.id), 'surface : un siège humain tient ce porteur').toBe(true);

    gainCorruption(banc.getState, banc.setState, h, 1);
    expect(g().pendingCorruption?.kind, 'le seuil doit REMONTER en fenêtre').toBe('seuil');
    expect(g().pendingCorruption?.heroId).toBe(h.id);
    expect(g().pendingCorruption?.roll ?? null, 'le dé appartient au siège distant : rien de roulé ici').toBeNull();
    expect(h.mutations ?? [], 'aucune mutation appliquée d’office').toEqual([]);
    expect(g().pendingRenounce, 'aucun « Je te renie ! » sauté').toBeNull();
  });
});
