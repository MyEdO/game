import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { mergeCreatureProfile, resolvePresetCreature } from './campaignData';
import { FicheAbsente, sceneNpc } from './sceneNpc';
import { netSnapshot, applyNetSnapshot } from './netFlow';
import { parseProject, CURRENT_PROJECT_SCHEMA } from './worldMap';
import { emptyNarratif, type NarratifBlock } from './campaignNarratif';
import { emptyScene, type Scene } from './scene';
import { findCreatureById, type CreatureData } from '../data';
import type { Combatant } from '../engine/types';

// #671 — CÂBLAGE du registre de presets de PNJ nommés : un preset = base créature globale (par id) +
// surcharges embarquées ; l'entité de scène le porte par `presetId`, instanciée base+profil au spawn.

const BASE_ID = 'brigand'; // créature GLOBALE réelle (creatures.json)
const CC = 'capacite-de-combat';

/** Narratif fixture avec un preset nommé : base `brigand`, CC surchargée + label du preset. */
function narratifFixture(): NarratifBlock {
  return {
    ...emptyNarratif(),
    presetsPnj: [{ id: 'pnj-test', base: BASE_ID, profil: { char: { [CC]: 99 }, label: 'Nommé Test' } }],
  };
}

function hero(): Combatant {
  return ({
    id: 'h', label: 'H', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], weapons: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    items: [], skills: [], talents: [], movement: 4,
  }) as unknown as Combatant;
}

/** Scène : heroStart + une entité PNJ portée par `presetId`, enrôlée dans une rencontre. */
function presetScene(id = 'sc-preset'): Scene {
  const s = emptyScene(8, 8);
  s.id = id;
  s.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } });
  s.entities.push({ id: 'pnj-1', kind: 'personnage', pos: { x: 3, y: 3 }, presetId: 'pnj-test' });
  s.encounters.push({ id: 'enc-preset', members: [{ entityId: 'pnj-1' }] });
  return s;
}

function spawnedEnemy(): Combatant {
  useGame.getState().startCombat('enc-preset');
  return useGame.getState().battle!.combatants.find((c) => c.id === 'pnj-1')!;
}

beforeEach(() => {
  useGame.setState({ campaignNarratif: null, party: [], scene: null, battle: null });
});

describe('mergeCreatureProfile (#671, PUR)', () => {
  const base: CreatureData = { ...findCreatureById(BASE_ID)! };

  it('surcharge de champ : le label du profil remplace celui de la base', () => {
    expect(mergeCreatureProfile(base, { label: 'Autre' }).label).toBe('Autre');
    expect(mergeCreatureProfile(base, {}).label).toBe(base.label);
  });

  it('char fusionné par caractéristique : la carac surchargée change, les autres tiennent', () => {
    const m = mergeCreatureProfile(base, { char: { [CC]: 99 } });
    expect(m.char[CC]).toBe(99);
    expect(m.char.force).toBe(base.char.force); // non-mentionnée → base
  });

  it('tableau remplacé EN BLOC dès que le profil en fournit un (pas de fusion par-élément)', () => {
    const m = mergeCreatureProfile(base, { skills: [] });
    expect(m.skills).toEqual([]); // remplacé, pas concaténé à la base
    expect(mergeCreatureProfile(base, {}).skills).toBe(base.skills); // absent → base intacte
  });

  it('profil absent → base renvoyée telle quelle', () => {
    expect(mergeCreatureProfile(base, undefined)).toBe(base);
  });
});

describe('resolvePresetCreature + spawn par presetId (chemin d’état réel #671)', () => {
  it('campagne chargée : le Combatant spawné porte la carac SURCHARGÉE + le label du preset', () => {
    useGame.setState({ party: [hero()] });
    // Chemin RÉEL : loadProject pose la couche narrative ET active la scène d’entrée.
    useGame.getState().loadProject([presetScene()], 'sc-preset', undefined, narratifFixture());
    // La résolution de couche voit la base mergée.
    const r = resolvePresetCreature('pnj-test')!;
    expect(r.creature.char[CC]).toBe(99);
    expect(r.creature.label).toBe('Nommé Test');
    // Spawn par le chemin d’état réel (startCombat → spawnEnemy(presetCreature)).
    const e = spawnedEnemy();
    expect(e.characteristics[CC]).toBe(99); // base brigand (40) surchargée par le profil (99)
    expect(e.label).toBe('Nommé Test');
  });

  it('couche NON chargée : le presetId ne résout pas, et le PNJ sans autre porteur est un BOGUE nommé, jamais un PNJ générique (#1882)', () => {
    useGame.setState({ party: [hero()], campaignNarratif: null });
    expect(() => useGame.getState().startScene(presetScene('sc-nu'))).toThrow(FicheAbsente);
    expect(resolvePresetCreature('pnj-test')).toBeUndefined();
    expect(() => useGame.getState().startScene(presetScene('sc-nu'))).toThrow(/personnage « pnj-1 » : preset de PNJ « pnj-test » irrésoluble/);
  });

  it('resolvePresetCreature : base introuvable → undefined (fail-doux)', () => {
    useGame.setState({ campaignNarratif: { ...emptyNarratif(), presetsPnj: [{ id: 'pnj-x', base: 'creature-inexistante' }] } });
    expect(resolvePresetCreature('pnj-x')).toBeUndefined();
    expect(resolvePresetCreature('pnj-absent')).toBeUndefined();
  });
});

/** L'ENVELOPPE que la fabrique exige d'un document de projet (#1552) : il s'annonce, se nomme et
 *  dit sa provenance. Ce fichier mesure la cross-ref `presetId` — pas l'enveloppe. */
const enveloppe = { type: 'projet' as const, schema: CURRENT_PROJECT_SCHEMA, id: 'fixture', label: 'Fixture', versionContenu: 1, maison: 'fixture de test' };

describe('cross-ref parseProject (#671, validation reportée de #765)', () => {
  it('un presetId d’entité de scène qui ne résout aucun preset → parseProject throw', () => {
    const scene = presetScene('sc-x'); // entité pnj-1.presetId = 'pnj-test'
    const doc = { ...enveloppe, scenes: [scene], narratif: emptyNarratif() }; // AUCUN preset déclaré
    expect(() => parseProject(doc)).toThrow(/preset de PNJ inconnu/);
  });

  it('presetId déclaré dans le narratif → parseProject passe', () => {
    const doc = { ...enveloppe, scenes: [presetScene('sc-ok')], narratif: narratifFixture() };
    expect(() => parseProject(doc)).not.toThrow();
  });
});

/**
 * COOP (#1882) — la couche narrative d'un projet (`campaignNarratif`) est hors snapshot (`HORS_SAVE`,
 * saves.ts) : l'invité la RE-DÉRIVE de `campaignDoc`, par la même couture que la reprise de save
 * (`reposerPaquetDeCampagne`, store.ts). Sans elle, un PNJ à preset n'a pas de fiche chez l'invité.
 */
describe('coop — l’invité re-dérive la couche narrative du paquet de l’hôte (#1882)', () => {
  it('l’hôte et l’invité voient le MÊME PNJ à preset', () => {
    useGame.setState({ party: [hero()], campaignNarratif: null });
    useGame.getState().loadProject([presetScene('sc-coop')], 'sc-coop', null, narratifFixture());
    expect(sceneNpc(useGame.getState().scene, 'pnj-1')?.label).toBe('Nommé Test');

    const snap = netSnapshot(useGame.getState);
    useGame.setState({ campaignNarratif: null }); // l'invité n'a jamais chargé le paquet
    applyNetSnapshot(useGame.setState, snap);

    expect(useGame.getState().campaignNarratif?.presetsPnj.map((p) => p.id)).toEqual(['pnj-test']);
    expect(sceneNpc(useGame.getState().scene, 'pnj-1')?.label).toBe('Nommé Test');
  });
});
