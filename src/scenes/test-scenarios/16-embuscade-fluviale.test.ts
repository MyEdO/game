import { describe, it, expect } from 'vitest';
import { testScenarios } from './index';
import { ficheDEntite } from '../../state/sceneNpc';
import { applyCriticalToTarget } from '../../state/combatFlow';
import { seedBattleRng } from '../../state/battleRng';
import { layerTiles } from '../../state/scene';
import { findVehicleById } from '../../data';
import type { Combatant } from '../../engine/types';

const scen = testScenarios.find((s) => s.id === 'embuscade-fluviale')!;

/** Reconstruit le roster d'entités du scénario (ids déterministes `enemy-enc-fluvial-<i>`) par la
 *  fiche que `combatSlice` spawne au démarrage (`ficheDEntite`). */
function spawnRoster(): Combatant[] {
  return scen.scene.entities
    .filter((e) => e.id.startsWith('enemy-enc-fluvial-'))
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
    .map(ficheDEntite);
}

describe('Embuscade fluviale — scène compilée + roster', () => {
  it('scène 18×12 terrain planches ; barque pirate (0) + équipage, pirates 1-3, anguille (4), barge amie (5)', () => {
    expect(scen.scene.dimensions).toEqual({ w: 18, h: 12 });
    expect(layerTiles(scen.scene, 0).every((t) => t === 'planches')).toBe(true);
    const byId = (id: string) => scen.scene.entities.find((e) => e.id === id)!;
    expect(byId('enemy-enc-fluvial-0').ref).toBe('barque-fluviale');
    expect(byId('enemy-enc-fluvial-0').crewIds).toEqual(['enemy-enc-fluvial-1', 'enemy-enc-fluvial-2', 'enemy-enc-fluvial-3']);
    expect(byId('enemy-enc-fluvial-1').ref).toBe('pirate-fluvial');
    expect(byId('enemy-enc-fluvial-3').ref).toBe('chef-pirate');
    expect(byId('enemy-enc-fluvial-4').ref).toBe('anguille-du-reik');
    expect(byId('enemy-enc-fluvial-5').ref).toBe('barge-fluviale');
  });

  it('les coques fluviales portent les tables MSRC data-driven (navire-fluvial + river-criticals)', () => {
    for (const id of ['barque-fluviale', 'barge-fluviale']) {
      const hull = findVehicleById(id)!.hull!;
      expect(hull.propulsion).toBe('fluvial');
      expect(hull.locationTable).toBe('navire-fluvial');
      expect(hull.criticalTable).toBe('river-criticals');
    }
  });
});

/**
 * Vérification BOUT-EN-BOUT (sans navigateur) : la barge SPAWN comme coque-véhicule, et un Coup Critique
 * encaissé se résout sur les tables du BATEAU FLUVIAL (MSRC 7) — un État propre au fleuve (Dérive /
 * Gouvernail brisé / Voie d'eau) apparaît sur la coque, JAMAIS un effet exclusivement MARITIME (En flammes
 * navire, table Cargaison MDG absente de `navire-fluvial`). C'est la preuve que le routage par données
 * (`hull.locationTable`/`criticalTable`) traverse toute la chaîne de combat.
 */
describe('Embuscade fluviale — la coque encaisse un Critique MSRC (pas de mer)', () => {
  it('la barge amie spawn comme coque-véhicule fluviale (B60)', () => {
    const barge = spawnRoster().find((c) => c.id === 'enemy-enc-fluvial-5')!;
    expect(barge.bodyShape).toBe('vehicule');
    expect(barge.creatureId).toBe('barge-fluviale');
    expect(barge.wounds.max).toBe(60);
  });

  it('frapper la coque fluviale pose un État MSRC (Dérive/Gouvernail brisé/Voie d’eau) et JAMAIS En flammes navire', () => {
    let riverEffect = false;
    for (let seed = 1; seed <= 80; seed++) {
      seedBattleRng(seed);
      const roster = spawnRoster();
      const barge = roster.find((c) => c.id === 'enemy-enc-fluvial-5')!; // gréement mixte → Gréement/Gouvernail/Coque/Superstructure
      const get = (() => ({ battle: { combatants: roster } })) as never;
      applyCriticalToTarget(barge, 'corps', true, 0, [], (() => {}) as never, { get });
      const cond = JSON.stringify(barge.conditions);
      // La table Cargaison (En flammes navire) est MDG-only : `navire-fluvial` ne la produit JAMAIS.
      expect(cond).not.toMatch(/en-flammes-navire/);
      if (/derive|gouvernail-brise|voie-d-eau/.test(cond)) riverEffect = true;
    }
    expect(riverEffect).toBe(true); // au moins un seed a posé un État FLUVIAL sur la coque
  });
});
