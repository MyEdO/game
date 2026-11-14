/**
 * `campaignData` (#767) : la lecture, par les lecteurs du web, de la couche de campagne chargée dans le store. La
 * résolution `giveTrapping` campagne-d'abord se joue au banc du noyau (`src/noyau/giveTrapping-campagne-d-abord.hors-store.test.ts`).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { presetPnjById } from './campaignData';
import { emptyNarratif } from '../noyau/monde/campaignNarratif';
import type { NarratifBlock } from '../data/schemas/defs-scenes/narratif';
import { emptyScene } from '../noyau/monde/scene';
import type { Combatant } from '../engine/types';
import type { Scene } from '../noyau/monde/scene';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';

const narratif: NarratifBlock = {
  ...emptyNarratif(),
  presetsPnj: [{ id: 'pnj-baron-caché' }],
};

function hero(): Combatant {
  return (blessuresSurLeProfil({
    id: 'a', label: 'A', kind: 'heros',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: blessuresDeBase(12), advantage: 0, conditions: [], weapons: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    items: [], skills: [], talents: [], movement: 4,
  })) as unknown as Combatant;
}

/** Scène minimale (heroStart) pour un chargement de campagne par le CHEMIN RÉEL (`chargerLeProjet`). */
function fixtureScene(id = 'camp-scene'): Scene {
  const s = emptyScene('scene-test', 6, 6);
  s.id = id;
  s.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } });
  return s;
}

/** Charge la campagne fixture par le chemin RÉEL du store (pose `campaignNarratif`). */
function loadCampaign(): void {
  useGame.setState({ party: [hero()] });
  useGame.getState().chargerLeProjet({ scenes: [fixtureScene()], entryId: 'camp-scene', narratif, projet: null });
}

beforeEach(() => {
  useGame.setState({ campaignNarratif: null, party: [], scene: null });
});

describe('campaignData — lecture de la couche chargée dans le store (#767)', () => {
  it('sans campagne chargée (campaignNarratif === null) : `presetPnjById` retourne undefined', () => {
    expect(useGame.getState().campaignNarratif).toBeNull();
    expect(presetPnjById('pnj-baron-caché')).toBeUndefined();
  });

  it('campagne chargée par chargerLeProjet : `presetPnjById` retourne le preset de la campagne', () => {
    loadCampaign();
    expect(useGame.getState().campaignNarratif).not.toBeNull();
    expect(presetPnjById('pnj-baron-caché')?.id).toBe('pnj-baron-caché');
  });
});

