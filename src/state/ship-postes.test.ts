import { describe, it, expect } from 'vitest';
import { placementPenalty, servingCrewPresent, leaveChef, serveChef } from './shipPostes';
import { hydratePoste, isUnarmed } from '../engine/items';
import type { Combatant } from '../engine/types';

/**
 * PLACEMENT DES PIÈCES D'ARTILLERIE (MDG 12 l.428-435 / VO « Boats and Boatbuilding » l.312-319).
 * Pas de slots fixes : placement LIBRE, limité par le POIDS (Enc) des pièces sur un bord vs la Contenance.
 * >25 % de la Contenance sur un bord → −1 M/Man et −1 DR aux Tests de Navigation ; >50 % → −2. La VO précise
 * « one facing » (et non « côté ») → on teste les QUATRE facings (proue/poupe/bâbord/tribord). Seuil STRICT,
 * pénalité = le pire palier atteint par UN bord (pas cumulatif entre bords).
 */
const CAP = 300; // Contenance d'une cogue ; 25 % = 75, 50 % = 150

describe('placementPenalty — déséquilibre du poids des pièces par bord vs Contenance', () => {
  it('aucune pièce → aucune pénalité', () => {
    expect(placementPenalty([], CAP)).toEqual({ m: 0, man: 0, navDR: 0 });
  });

  it('réparti / léger (sous 25 % par bord) → aucune pénalité', () => {
    const mounts = [{ side: 'babord' as const, weight: 5 }, { side: 'babord' as const, weight: 5 }, { side: 'tribord' as const, weight: 5 }];
    expect(placementPenalty(mounts, CAP)).toEqual({ m: 0, man: 0, navDR: 0 });
  });

  it('> 25 % sur un bord → −1 M / −1 Man / −1 DR', () => {
    expect(placementPenalty([{ side: 'tribord', weight: 80 }], CAP)).toEqual({ m: -1, man: -1, navDR: -1 });
  });

  it('> 50 % sur un bord → −2 M / −2 Man / −2 DR', () => {
    expect(placementPenalty([{ side: 'tribord', weight: 160 }], CAP)).toEqual({ m: -2, man: -2, navDR: -2 });
  });

  it('seuil STRICT : exactement 25 % (75) → aucune pénalité', () => {
    expect(placementPenalty([{ side: 'tribord', weight: 75 }], CAP)).toEqual({ m: 0, man: 0, navDR: 0 });
  });

  it('deux bords chacun > 25 % (mais < 50 %) → −1 (pire palier d’UN bord, pas cumulatif)', () => {
    const mounts = [{ side: 'babord' as const, weight: 80 }, { side: 'tribord' as const, weight: 80 }];
    expect(placementPenalty(mounts, CAP)).toEqual({ m: -1, man: -1, navDR: -1 });
  });

  it('la proue est aussi un « facing » (désambiguïsation VO) → concentration à la proue pénalisée', () => {
    expect(placementPenalty([{ side: 'proue', weight: 160 }], CAP)).toEqual({ m: -2, man: -2, navDR: -2 });
  });
});

describe('servingCrewPresent — servants APTES tenant le poste du chef (sous-effectif d’une Arme d’équipe)', () => {
  const sailor = (id: string, alive = true): Combatant =>
    ({ id, name: id, kind: 'npc', conditions: [], weapons: [], dead: !alive, wounds: { current: alive ? 5 : 0, max: 5 } }) as unknown as Combatant;
  const chef = (crewIds: string[]): Combatant =>
    ({ id: 'chef', name: 'Chef', kind: 'hero', conditions: [], weapons: [], wounds: { current: 5, max: 5 },
      mannedPoste: { item: {}, side: 'tribord', crewIds } }) as unknown as Combatant;

  it('compte le chef + les servants vivants/conscients', () => {
    const c = chef(['chef', 's1', 's2']);
    expect(servingCrewPresent(c, [c, sailor('s1'), sailor('s2')])).toBe(3);
  });

  it('exclut les morts / à terre (mêmes critères qu’`exposedCrew`)', () => {
    const c = chef(['chef', 's1', 's2']);
    expect(servingCrewPresent(c, [c, sailor('s1', false), sailor('s2')])).toBe(2); // s1 à terre
  });

  it('chef sans poste → undefined (tir normal, pas une pièce servie)', () => {
    const lone = sailor('lone');
    expect(servingCrewPresent(lone, [lone])).toBeUndefined();
  });
});

// « Quitter la pièce » : l'arme du poste quitte les mains (`engine/items.lacherLArme`) ; repli `LDB 62 l.28`.
describe('leaveChef — le chef de statbloc qui ne tenait que la pièce', () => {
  it('ne tient plus la pièce, et tient les Mains nues', () => {
    const chef = { id: 'chef', label: 'Chef', kind: 'enemy', conditions: [], weapons: [], items: [], wounds: { current: 5, max: 5 } } as unknown as Combatant;
    const poste = hydratePoste({ trappingId: 'canon-a-repetition' } as never);
    poste.crewIds = ['chef'];
    serveChef(chef, poste);
    expect(chef.weapons.some((w) => w.uid === poste.item.uid)).toBe(true);
    leaveChef(chef, poste, [chef]);
    expect(chef.weapons.some((w) => w.uid === poste.item.uid)).toBe(false);
    expect(chef.weapons.map(isUnarmed)).toEqual([true]);
  });
});
