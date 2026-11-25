import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { objetDeCampagne } from '../scenes/fixtures/objetDeCampagne.testkit';
import { mergeCreatureProfile, objetDuNarratif, presetDuNarratif, resolvePresetCreature } from './monde/resolveursDuNarratif';
import { FicheAbsente, sceneNpc } from './monde/sceneNpc';
import { appliquerLInstantane, instantaneDeLaCoop } from './coop';
import { parseProject } from './worldMap';
import { emptyNarratif } from './monde/campaignNarratif';
import type { NarratifBlock } from '../data/schemas/defs-scenes/narratif';
import { emptyScene, type Scene } from './monde/scene';
import { findCreatureById, type CreatureData } from '../data';
import type { Combatant } from '../engine/types';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';

// #671 — CÂBLAGE du registre de presets de PNJ nommés : un preset = base créature globale (par id) +
// surcharges embarquées ; l'entité de scène le porte par `presetId`, instanciée base+profil au spawn.

const BASE_ID = 'humain'; // créature GLOBALE réelle (creatures.json)
const CC = 'capacite-de-combat';

/** Narratif fixture avec un preset nommé : base `humain`, CC surchargée + label du preset. */
function narratifFixture(): NarratifBlock {
  return {
    ...emptyNarratif(),
    presetsPnj: [{ id: 'pnj-test', base: { id: BASE_ID }, profil: { char: { [CC]: 99 }, label: 'Nommé Test' } }],
  };
}

function hero(): Combatant {
  return (blessuresSurLeProfil({
    id: 'h', label: 'H', kind: 'heros',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: blessuresDeBase(12), advantage: 0, conditions: [], weapons: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    items: [], skills: [], talents: [], movement: 4,
  })) as unknown as Combatant;
}

/** Scène : heroStart + une entité PNJ portée par `presetId`, enrôlée dans une rencontre. */
function presetScene(id = 'sc-preset'): Scene {
  const s = emptyScene('scene-test', 8, 8);
  s.id = id;
  s.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } });
  s.entities.push({ id: 'pnj-1', kind: 'personnage', pos: { x: 3, y: 3 }, presetId: 'pnj-test' });
  s.encounters.push({ id: 'enc-preset', members: [{ entityId: 'pnj-1' }] });
  return s;
}

function spawnedEnemy(): Combatant {
  banc.getState().lancerLeCombat('enc-preset');
  return banc.getState().battle!.combatants.find((c) => c.id === 'pnj-1')!;
}

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/** Le résolveur de preset du narratif chargé sur le banc. */
const presetPnjById = (id: string) => presetDuNarratif(banc.getState().campaignNarratif)(id);

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
    banc.setState({ party: [hero()] });
    // Chemin RÉEL : chargerLeProjet pose la couche narrative ET active la scène d’entrée.
    banc.getState().chargerLeProjet({ scenes: [presetScene()], entryId: 'sc-preset', narratif: narratifFixture(), projet: null });
    // La résolution de couche voit la base mergée.
    const r = resolvePresetCreature('pnj-test', presetPnjById)!;
    expect(r.creature.char[CC]).toBe(99);
    expect(r.creature.label).toBe('Nommé Test');
    // Spawn par le chemin d’état réel (lancerLeCombat → spawnEnemy(presetCreature)).
    const e = spawnedEnemy();
    expect(e.characteristics[CC]).toBe(99); // base brigand (40) surchargée par le profil (99)
    expect(e.label).toBe('Nommé Test');
  });

  it('l’inventaire de scène donne au PNJ le profil et l’apparence de l’objet de campagne', () => {
    const objet = objetDeCampagne({ id: 'arme-d-inventaire', label: 'Arme de la salle' });
    const narratif = { ...narratifFixture(), objets: [objet] };
    const scene = presetScene();
    const pnj = scene.entities[1];
    pnj.inventaire = { [objet.id]: false };
    pnj.appearance = { apparencesObjets: { [objet.id]: { id: 'hache_naine' } } };
    const projet = parseProject({ ...enveloppe, scenes: [scene], narratif });
    banc.setState({ party: [hero()] });
    banc.getState().chargerLeProjet({ scenes: projet.scenes, entryId: scene.id, narratif: projet.narratif, projet });

    const horsCombat = sceneNpc(banc.getState().scene, pnj.id, presetPnjById, objetDuNarratif(banc.getState().campaignNarratif));
    const attendu = { trappingId: objet.id, label: objet.label, kind: 'melee', apparence: 'hache_naine', equipped: false };
    expect(horsCombat?.items).toContainEqual(expect.objectContaining(attendu));
    expect(spawnedEnemy().items).toContainEqual(expect.objectContaining(attendu));
  });

  it('la dotation directe matérialise le nombre et les dégâts de l’arme de campagne du preset', () => {
    const damage = { plusBF: false, flat: 12 };
    const objet = objetDeCampagne({ id: 'arme-de-dotation', label: 'Arme du preset', damage });
    const narratif = {
      ...emptyNarratif(),
      objets: [objet],
      presetsPnj: [{ id: 'pnj-test', base: { id: BASE_ID }, profil: { trappings: [{ id: objet.id, count: { fixed: 2 } }] } }],
    };
    const projet = parseProject({ ...enveloppe, scenes: [presetScene()], narratif });
    banc.setState({ party: [hero()] });
    banc.getState().chargerLeProjet({ scenes: projet.scenes, entryId: 'sc-preset', narratif: projet.narratif, projet });

    const ennemi = spawnedEnemy();
    const objets = ennemi.items?.filter((it) => it.trappingId === objet.id) ?? [];
    expect(objets).toHaveLength(2);
    expect(objets[0]).toMatchObject({ label: objet.label, kind: 'melee', damage });
    expect(ennemi.weapons).toContainEqual(expect.objectContaining({ trappingId: objet.id, damage }));
  });

  it('un profil de surcharge issu du bestiaire conserve l’identité de la créature de base au spawn', () => {
    const profil = findCreatureById('mutant')!;
    const narratif = {
      ...emptyNarratif(),
      presetsPnj: [{ id: 'pnj-test', base: { id: BASE_ID }, profil }],
    };
    banc.setState({ party: [hero()] });
    banc.getState().chargerLeProjet({ scenes: [presetScene()], entryId: 'sc-preset', narratif, projet: null });

    expect(spawnedEnemy()).toMatchObject({ label: profil.label, creatureId: BASE_ID });
  });

  it('couche NON chargée : le presetId ne résout pas, et le PNJ sans autre porteur est un BOGUE nommé, jamais un PNJ générique (#1882)', () => {
    banc.setState({ party: [hero()], campaignNarratif: null });
    expect(() => banc.getState().lancerLaScene(presetScene('sc-nu'))).toThrow(FicheAbsente);
    expect(resolvePresetCreature('pnj-test', presetPnjById)).toBeUndefined();
    expect(() => banc.getState().lancerLaScene(presetScene('sc-nu'))).toThrow(/personnage « pnj-1 » : preset de PNJ « pnj-test » irrésoluble/);
  });

  it('resolvePresetCreature : base introuvable → undefined (fail-doux)', () => {
    banc.setState({ campaignNarratif: { ...emptyNarratif(), presetsPnj: [{ id: 'pnj-x', base: { id: 'creature-inexistante' } }] } });
    expect(resolvePresetCreature('pnj-x', presetPnjById)).toBeUndefined();
    expect(resolvePresetCreature('pnj-absent', presetPnjById)).toBeUndefined();
  });
});

/** L'ENVELOPPE que la fabrique exige d'un document de projet (#1552) : il s'annonce, se nomme et
 *  dit sa provenance. Ce fichier mesure la cross-ref `presetId` — pas l'enveloppe. */
const enveloppe = { type: 'projet' as const, id: 'fixture', label: 'Fixture', versionContenu: 1, maison: 'fixture de test' };

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
 * noyau/persistance/save.ts) : l'invité la RE-DÉRIVE de `campaignDoc`, par la même couture que la reprise de save
 * (`reposerPaquetDeCampagne`, registreDesScenes.ts). Sans elle, un PNJ à preset n'a pas de fiche chez l'invité.
 */
describe('coop — l’invité re-dérive la couche narrative du paquet de l’hôte (#1882)', () => {
  it('l’hôte et l’invité voient le MÊME PNJ à preset', () => {
    banc.setState({ party: [hero()], campaignNarratif: null });
    banc.getState().chargerLeProjet({ scenes: [presetScene('sc-coop')], entryId: 'sc-coop', worldMap: null, narratif: narratifFixture(), projet: null });
    expect(sceneNpc(banc.getState().scene, 'pnj-1', presetPnjById)?.label).toBe('Nommé Test');

    const snap = instantaneDeLaCoop(banc.getState());
    banc.setState({ campaignNarratif: null }); // l'invité n'a jamais chargé le paquet
    banc.setState(appliquerLInstantane(snap, banc.getState()).etat);

    expect(banc.getState().campaignNarratif?.presetsPnj.map((p) => p.id)).toEqual(['pnj-test']);
    expect(sceneNpc(banc.getState().scene, 'pnj-1', presetPnjById)?.label).toBe('Nommé Test');
  });
});
