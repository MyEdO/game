import { idsDeTest } from '../../engine/idsDeTest.testkit';
import { describe, it, expect } from 'vitest';
// @ts-expect-error — lib .mjs des générateurs de campagne, sans types (validateurs id-only branchés dans NPC/scene/poste).
import { NPC, NUEE_DE_RATS, poste, scene } from '../../../scripts/campagne/lib.mjs';
import { sceneMetresPerTile } from '../../noyau/monde/scene';
import { roleAmbiantSchema } from '../../data/schemas/grammaire/valeurs';
import { sceneEntitySchema } from '../../data/schemas/defs-scenes/scene';
import { listerProjetsLivres } from '../../../scripts/guards/lib/projetsLivres.mjs';
import { lireProjetLivre } from '../../../scripts/source/projetLivre.mjs';
import { testScenarios } from '../test-scenarios';
import type { Scene } from '../../noyau/monde/scene';

it('les ambiances de toutes les scènes livrées appartiennent aux rôles ambiants', () => {
  const cles = new Set<string>(roleAmbiantSchema.options);
  const scenes = [
    ...listerProjetsLivres().flatMap((rel) => (lireProjetLivre(rel) as { scenes: Scene[] }).scenes),
    ...testScenarios.flatMap((scenario) => {
      const construit = scenario.construire(idsDeTest);
      return [construit.scene, ...(construit.extraScenes ?? [])];
    }),
  ];
  const inconnues = scenes.flatMap((s) => s.entities.flatMap((e) =>
    e.anim !== undefined && !cles.has(e.anim) ? [`${s.id}.${e.id}: ${e.anim}`] : []));
  expect(inconnues).toEqual([]);
});

it('le schéma admet chaque rôle ambiant et refuse une animation étrangère', () => {
  const entite = { id: 'fixture', kind: 'personnage', creature: { id: 'humain' }, pos: { x: 0, y: 0 } };
  for (const anim of roleAmbiantSchema.options) expect(sceneEntitySchema.safeParse({ ...entite, anim }).success).toBe(true);
  expect(sceneEntitySchema.safeParse({ ...entite, anim: 'animation-etrangere' }).success).toBe(false);
});

/** Scène MER minimale (eau, 6×6) portant une rencontre terse d'un seul ennemi de corps `corps` — sert à exercer
 *  `corpsValide()` (branché dans `validateEnemy`). */
const sceneWithEnemyCorps = (corps: Record<string, { id: string }>) =>
  scene({
    id: 'v', label: 'V', base: 'eau', rows: ['......', '......', '......', '......', '......', '......'],
    entities: [{ id: 'start', kind: 'heroStart', pos: { x: 0, y: 0 } }],
    encounters: [{ id: 'e', enemies: [{ ...corps, pos: { x: 3, y: 3 } }] }],
  });

const sceneWithOptional = (optional: unknown) =>
  scene({
    id: 'optional', label: 'Optional', base: 'terre', rows: ['......', '......', '......', '......', '......', '......'],
    entities: [{ id: 'start', kind: 'heroStart', pos: { x: 0, y: 0 } }],
    encounters: [{ id: 'e', enemies: [{ creature: { id: 'zombie' }, pos: { x: 3, y: 3 }, optionals: [optional] }] }],
  });

const sceneWithStatblockTraits = (traits: unknown[]) =>
  scene({
    id: 'statblock', label: 'Statblock', base: 'terre', rows: ['......', '......', '......', '......', '......', '......'],
    entities: [{ id: 'start', kind: 'heroStart', pos: { x: 0, y: 0 } }],
    encounters: [{ id: 'e', enemies: [{ pos: { x: 3, y: 3 }, statblock: { ...NUEE_DE_RATS, traits } }] }],
  });

describe('lib.mjs — validateurs id-only (id passe, libellé THROW)', () => {
  it('NPC : ids valides (species/tenue/inventaire) passent tels quels', () => {
    const e = NPC('t', 0, 0, 'Test', { inventaire: { arc: false }, appearance: { species: 'humains-reiklander', tenue: 'mendiant' } });
    expect(e.inventaire).toEqual({ arc: false });
    expect(e.appearance.species).toBe('humains-reiklander');
    expect(e.appearance.tenue).toBe('mendiant');
  });

  it('NPC : un LIBELLÉ d’espèce → throw', () => {
    expect(() => NPC('t', 0, 0, 'Test', { appearance: { species: 'Humains (Reiklander)' } })).toThrow(/species/i);
  });

  it('NPC : espèce jouable, créature et race de rendu passent ; une coquille → throw', () => {
    for (const espece of ['halflings', 'rat-geant', 'skaven', 'araignee-geante'])
      expect(NPC('t', 0, 0, 'Test', { creature: { id: 'humain' }, appearance: { species: espece } }).appearance.species).toBe(espece);
    expect(() => NPC('t', 0, 0, 'Test', { creature: { id: 'humain' }, appearance: { species: 'rat-geants' } })).toThrow(/species.*« rat-geants » inconnue/);
  });

  it('NPC : un LIBELLÉ de tenue → throw', () => {
    expect(() => NPC('t', 0, 0, 'Test', { appearance: { tenue: 'Mendiant' } })).toThrow(/tenue/i);
  });

  it('NPC : une tenue par id de CARRIÈRE ou « nu » reste valide ; une CLASSE → throw (#3456)', () => {
    for (const tenue of ['archer', 'nu'])
      expect(NPC('t', 0, 0, 'Test', { creature: { id: 'humain' }, appearance: { tenue } }).appearance.tenue).toBe(tenue);
    expect(() => NPC('t', 0, 0, 'Test', { creature: { id: 'humain' }, appearance: { tenue: 'roublards' } })).toThrow(/tenue « roublards » inconnue/);
  });

  it('NPC : un LIBELLÉ d’objet d’inventaire → throw', () => {
    expect(() => NPC('t', 0, 0, 'Test', { inventaire: { Arc: false } })).toThrow(/inventaire/i);
  });

  it('NPC : sans fiche, la `creature` est le profil standard de son espèce, posée en QUEUE (LDB 77 l.7, #1882)', () => {
    const e = NPC('t', 0, 0, 'Test', { appearance: { species: 'nains' } });
    expect(e.creature).toEqual({ id: 'nain' });
    expect(Object.keys(e).slice(-1)).toEqual(['creature']);
  });

  it('NPC : sans fiche ni espèce à profil standard → throw qui NOMME le PNJ', () => {
    expect(() => NPC('t', 0, 0, 'Test', { appearance: { species: 'gnomes' } })).toThrow(/PNJ « t » sans fiche/);
    expect(() => NPC('t', 0, 0, 'Test', {})).toThrow(/PNJ « t » sans fiche/);
  });

  it('NPC : un porteur fourni (statblock, presetId) prime — aucune `creature` posée', () => {
    expect(NPC('t', 0, 0, 'Test', { statblock: { type: 'statblock', label: 'T', char: { B: 10 } }, appearance: { species: 'nains' } }).creature).toBeUndefined();
    expect(NPC('t', 0, 0, 'Test', { presetId: 'baron', appearance: { species: 'nains' } }).creature).toBeUndefined();
  });

  it('optionals : un TraitInstance structuré par id passe intact', () => {
    const s = sceneWithOptional({ id: 'maladie' });
    const zombie = s.entities.find((entity: { creature?: { id: string } }) => entity.creature?.id === 'zombie');
    expect(zombie?.combat?.optionals).toEqual([{ id: 'maladie' }]);
  });

  it('optionals : un libellé est refusé au lieu d’être converti en id', () => {
    expect(() => sceneWithOptional('Maladie')).toThrow(/optionals.*id structuré/i);
  });

  it('optionals : un id de trait inconnu est refusé', () => {
    expect(() => sceneWithOptional({ id: 'maladie-imaginaire' })).toThrow(/trait introuvable/i);
  });

  it('statblock.traits : un libellé est refusé au lieu d’être converti en id', () => {
    expect(() => sceneWithStatblockTraits(['Nuée'])).toThrow(/statblock\.traits.*id structuré/i);
  });
});

// #218 — `corpsValide()` accepte une COQUE (`vehicles.json`) comme corps d'entité légitime (naval).
describe('lib.mjs — corpsValide : chaque corps dans son catalogue (coque terse #218)', () => {
  it('un NAVIRE (vehicles.json) sous `vehicule` dans un enemies[] terse ne lève PAS', () => {
    expect(() => sceneWithEnemyCorps({ vehicule: { id: 'cogue' } })).not.toThrow();
  });

  it('un corps irrésoluble lève en pointant le catalogue de sa clé', () => {
    expect(() => sceneWithEnemyCorps({ vehicule: { id: 'paquebot-transatlantique' } })).toThrow(/vehicule introuvable « paquebot-transatlantique » \(Compendium → Véhicules\)/);
    expect(() => sceneWithEnemyCorps({ creature: { id: 'paquebot-transatlantique' } })).toThrow(/creature introuvable « paquebot-transatlantique » \(Compendium → Bestiaire\)/);
  });
});

// #222 — `poste()` émet la forme AUTHORÉE de référence `{ trappingId, side, crewIds }` (uid de la place, #2907) et valide
// que `trappingId` désigne un trapping du sous-type `armes-de-siege`.
describe('lib.mjs — poste() : forme référence #222, trappingId du sous-type armes-de-siege', () => {
  it('une pièce d’artillerie valide → exactement { trappingId, side, crewIds }, base hydratée au spawn', () => {
    expect(poste('canon-moyen', 'tribord')).toStrictEqual({ trappingId: 'canon-moyen', side: 'tribord', crewIds: [] });
  });

  it('crewIds explicites préservés', () => {
    expect(poste('pierrier', 'proue', ['bob']).crewIds).toEqual(['bob']);
  });

  it('un trappingId hors du sous-type armes-de-siege → refus nommé', () => {
    expect(() => poste('arc', 'tribord')).toThrow(/sous-type armes-de-siege/i);
  });

  it('un trappingId inconnu → throw', () => {
    expect(() => poste('canon-imaginaire', 'proue')).toThrow(/poste/i);
  });
});

describe('lib.mjs — `scene()` FORWARDE l’échelle demandée au MapSpec compilé', () => {
  it('une scène qui déclare `metresPerTile` la retrouve à la lecture', () => {
    const sc = scene({ id: 'tmp-mer', label: 'Mer ouverte', base: 'eau', rows: ['====', '===='], metresPerTile: 8 });
    expect(sceneMetresPerTile(sc)).toBe(8);
  });

  it('une scène qui n’en déclare pas retombe sur le défaut du monde', () => {
    const sc = scene({ id: 'tmp-terre', label: 'Plaine', base: 'terre', rows: ['....', '....'] });
    expect(sceneMetresPerTile(sc)).toBe(sceneMetresPerTile({ layers: [] } as never));
  });
});

describe('lib.mjs — `scene()` refuse une option qu’elle ne lit pas', () => {
  it('une clé inconnue LÈVE en se nommant, au lieu d’être perdue en silence', () => {
    expect(() => scene({ id: 'faute', nom: 'Faute', label: 'Faute', base: 'terre', rows: ['..'] }))
      .toThrow(/scène « faute » — option\(s\) inconnue\(s\) de scene\(\) : nom\./);
  });
});
