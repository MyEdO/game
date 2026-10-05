import { describe, it, expect } from 'vitest';
import { makeRNG } from './dice';
import { datasetObject, setObjectDataset } from '../data/overrides';
import { SEA_HAZARDS, findSeaHazard, pickSeaHazard, strandingPenalty, strandingOccurs, debrisEntangleFor, perilManagement } from './seaPerils';

/**
 * PÉRILS EN MER — couche pure (MDG 13 l.423-564), ORPHELINE avant le câblage #444 (`seaVoyageFlow.ts`
 * `case 'collision'`). Verbatim re-vérifié `Source/WH - V4 - La Mer de Griffe/13 - Navigation
 * maritime.md` l.471-499.
 */
describe('SEA_HAZARDS — les 4 périls verbatim (l.475-499)', () => {
  it('4 entrées, IC exacts (Iceberg 25, Débris marins 3, Rocher 47, Bas-fonds 10)', () => {
    expect(SEA_HAZARDS).toHaveLength(4);
    expect(findSeaHazard('iceberg')!.ic).toBe(25);
    expect(findSeaHazard('debris-marins')!.ic).toBe(3);
    expect(findSeaHazard('rocher')!.ic).toBe(47);
    expect(findSeaHazard('bas-fonds')!.ic).toBe(10);
  });

  it('chances d’Échouage verbatim (Rocher 20 %, Bas-fonds 40 %) ; Débris marins n’Échoue pas (empêtrement)', () => {
    expect(findSeaHazard('rocher')!.strandChancePct).toBe(20);
    expect(findSeaHazard('bas-fonds')!.strandChancePct).toBe(40);
    expect(findSeaHazard('debris-marins')!.strandChancePct).toBeUndefined();
  });
});

describe('pickSeaHazard — tirage pondéré (#444, poids MAISON défaut équiprobable)', () => {
  it('ne renvoie toujours qu’un péril RÉEL de SEA_HAZARDS (RNG seedé)', () => {
    const rng = makeRNG(7);
    for (let i = 0; i < 20; i++) expect(SEA_HAZARDS).toContain(pickSeaHazard(rng));
  });

  it('un poids à 0 sur les 3 autres force le tirage sur le 4ᵉ — la pondération est bien LUE en donnée', () => {
    const original = structuredClone(datasetObject('seaPerils'));
    try {
      setObjectDataset('seaPerils', { ...original, hazards: SEA_HAZARDS.map((h) => ({ ...h, weight: h.id === 'bas-fonds' ? 1 : 0 })) } as never);
      const rng = makeRNG(3);
      for (let i = 0; i < 10; i++) expect(pickSeaHazard(rng).id).toBe('bas-fonds');
    } finally {
      setObjectDataset('seaPerils', original);
    }
  });
});

describe('strandingPenalty / strandingOccurs (Échouage, l.471-473/497/499)', () => {
  it('pénalité = −(Enc navire + Enc cargaison), jamais positive', () => {
    expect(strandingPenalty(20, 10)).toBe(-30);
    expect(strandingPenalty(0, 0)).toBe(-0);
    expect(strandingPenalty(-5, 10)).toBe(-10); // Enc négatif ignoré (Math.max 0)
  });

  it('strandingOccurs : jamais d’Échouage pour un péril SANS strandChancePct (Débris marins)', () => {
    const debris = findSeaHazard('debris-marins')!;
    for (let roll = 1; roll <= 20; roll++) expect(strandingOccurs(debris, roll)).toBe(false);
  });

  it('strandingOccurs : Échouage à la CHANCE du péril (Rocher 20 %, Bas-fonds 40 %) — dé FOURNI', () => {
    const rocher = findSeaHazard('rocher')!;
    const basFonds = findSeaHazard('bas-fonds')!;
    expect(strandingOccurs(rocher, 20)).toBe(true);
    expect(strandingOccurs(rocher, 21)).toBe(false);
    expect(strandingOccurs(basFonds, 40)).toBe(true);
    expect(strandingOccurs(basFonds, 41)).toBe(false);
  });
});

describe('debrisEntangleFor (l.485-491)', () => {
  it('pénalité par Taille : Minuscule-Petite −2 DR Man/−1 M, Moyenne-Grande −1 DR Man/0 M, au-delà rien', () => {
    const debris = findSeaHazard('debris-marins')!;
    expect(debrisEntangleFor(debris, 'petite', 1)).toEqual({ entangled: true, manDR: -2, mMod: -1 });
    expect(debrisEntangleFor(debris, 'grande', 1)).toEqual({ entangled: true, manDR: -1, mMod: 0 });
    expect(debrisEntangleFor(debris, 'enorme', 1)).toEqual({ entangled: true, manDR: 0, mMod: 0 });
  });

  it('au-delà de 20 %, aucun empêtrement', () => {
    const debris = findSeaHazard('debris-marins')!;
    expect(debrisEntangleFor(debris, 'petite', 21).entangled).toBe(false);
  });
});

describe('perilManagement (Gestion des périls, l.429-436) — ORPHELIN (#444, non câblé)', () => {
  it('Distance 100/50/10 m → Perception/Manœuvre verbatim de la table', () => {
    expect(perilManagement(100)).toEqual({ spot: 'difficile', avoid: 'facile' });
    expect(perilManagement(50)).toEqual({ spot: 'intermediaire', avoid: 'accessible' });
    expect(perilManagement(10)).toEqual({ spot: 'accessible', avoid: 'complexe' });
    expect(perilManagement(5)).toEqual({ spot: 'accessible', avoid: 'complexe' }); // plancher : la ligne la plus proche
  });
});
