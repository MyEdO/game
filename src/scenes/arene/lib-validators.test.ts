import { describe, it, expect } from 'vitest';
// @ts-expect-error — outil d'auteur .mjs sans types (validateurs id-only branchés dans NPC/scene/poste).
import { NPC, NUEE_DE_RATS, poste, scene } from '../../../scripts/campagne/lib.mjs';
import { sceneMetresPerTile } from '../../state/scene';

/** Scène MER minimale (eau, 6×6) portant une rencontre terse d'un seul ennemi `ref` — sert à exercer
 *  `creatureId()` (branché dans `normalizeEnemy`) sans dépendre d'un catalogue de créature particulier. */
const sceneWithEnemyRef = (ref: string) =>
  scene({
    id: 'v', nom: 'V', base: 'eau', rows: ['......', '......', '......', '......', '......', '......'],
    entities: [{ id: 'start', kind: 'heroStart', pos: { x: 0, y: 0 } }],
    encounters: [{ id: 'e', enemies: [{ ref, pos: { x: 3, y: 3 } }] }],
  });

const sceneWithOptional = (optional: unknown) =>
  scene({
    id: 'optional', nom: 'Optional', base: 'terre', rows: ['......', '......', '......', '......', '......', '......'],
    entities: [{ id: 'start', kind: 'heroStart', pos: { x: 0, y: 0 } }],
    encounters: [{ id: 'e', enemies: [{ ref: 'zombie', pos: { x: 3, y: 3 }, optionals: [optional] }] }],
  });

const sceneWithStatblockTraits = (traits: unknown[]) =>
  scene({
    id: 'statblock', nom: 'Statblock', base: 'terre', rows: ['......', '......', '......', '......', '......', '......'],
    entities: [{ id: 'start', kind: 'heroStart', pos: { x: 0, y: 0 } }],
    encounters: [{ id: 'e', enemies: [{ pos: { x: 3, y: 3 }, statblock: { ...NUEE_DE_RATS, traits } }] }],
  });

describe('lib.mjs — validateurs id-only (id passe, libellé THROW)', () => {
  it('NPC : ids valides (species/tenue/weapon) passent tels quels', () => {
    const e = NPC('t', 0, 0, 'Test', { weapon: 'arc', appearance: { species: 'humains-reiklander', tenue: 'mendiant' } });
    expect(e.weapon).toBe('arc');
    expect(e.appearance.species).toBe('humains-reiklander');
    expect(e.appearance.tenue).toBe('mendiant');
  });

  it('NPC : un LIBELLÉ d’espèce → throw', () => {
    expect(() => NPC('t', 0, 0, 'Test', { appearance: { species: 'Humains (Reiklander)' } })).toThrow(/species/i);
  });

  it('NPC : un LIBELLÉ de tenue → throw', () => {
    expect(() => NPC('t', 0, 0, 'Test', { appearance: { tenue: 'Mendiant' } })).toThrow(/tenue/i);
  });

  it('NPC : un LIBELLÉ d’arme → throw', () => {
    expect(() => NPC('t', 0, 0, 'Test', { weapon: 'Arc' })).toThrow(/weapon/i);
  });

  it('NPC : une tenue par id de CARRIÈRE (sans tenue dédiée) reste valide (résolue par classe)', () => {
    expect(NPC('t', 0, 0, 'Test', { ref: 'humain', appearance: { tenue: 'archer' } }).appearance.tenue).toBe('archer');
  });

  it('NPC : sans fiche, la `ref` est le profil standard de son espèce, posée en QUEUE (LDB 77 l.7, #1882)', () => {
    const e = NPC('t', 0, 0, 'Test', { appearance: { species: 'nains' } });
    expect(e.ref).toBe('nain');
    expect(Object.keys(e).slice(-1)).toEqual(['ref']);
  });

  it('NPC : sans fiche ni espèce à profil standard → throw qui NOMME le PNJ', () => {
    expect(() => NPC('t', 0, 0, 'Test', { appearance: { species: 'gnomes' } })).toThrow(/PNJ « t » sans fiche/);
    expect(() => NPC('t', 0, 0, 'Test', {})).toThrow(/PNJ « t » sans fiche/);
  });

  it('NPC : un porteur fourni (statblock, presetId) prime — aucune `ref` posée', () => {
    expect(NPC('t', 0, 0, 'Test', { statblock: { type: 'statblock', label: 'T', char: { B: 10 } }, appearance: { species: 'nains' } }).ref).toBeUndefined();
    expect(NPC('t', 0, 0, 'Test', { presetId: 'baron', appearance: { species: 'nains' } }).ref).toBeUndefined();
  });

  it('optionals : un TraitInstance structuré par id passe intact', () => {
    const s = sceneWithOptional({ id: 'maladie' });
    const zombie = s.entities.find((entity: { ref?: string }) => entity.ref === 'zombie');
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

// #218 — `creatureId()` accepte une COQUE (`vehicles.json`) comme ref d'entité légitime (naval).
describe('lib.mjs — creatureId : créature ∪ véhicule (coque terse #218)', () => {
  it('un ref de NAVIRE (vehicles.json) dans un enemies[] terse ne lève PAS', () => {
    expect(() => sceneWithEnemyRef('cogue')).not.toThrow();
  });

  it('un ref irrésoluble (ni créature ni véhicule) lève en pointant les DEUX catalogues', () => {
    expect(() => sceneWithEnemyRef('paquebot-transatlantique')).toThrow(/ni créature ni véhicule/i);
  });
});

// #222 — `poste()` émet la forme AUTHORÉE de référence `{ trappingId, uid, side, crewIds }` et valide
// que `trappingId` désigne une pièce POSABLE (art d'affût `siegeRig`).
describe('lib.mjs — poste() : forme référence #222, trappingId à art d’affût', () => {
  it('une pièce d’artillerie valide → { trappingId, uid, side, crewIds }, base NON matérialisée', () => {
    const p = poste('canon-moyen', 'tribord');
    expect(p.trappingId).toBe('canon-moyen');
    expect(p.side).toBe('tribord');
    expect(p.crewIds).toEqual([]);
    expect(typeof p.uid).toBe('string');
    expect(p.item).toBeUndefined(); // hydratée au spawn, jamais copiée en donnée (#222)
    expect(p.damage).toBeUndefined();
  });

  it('crewIds explicites préservés', () => {
    expect(poste('pierrier', 'proue', ['bob']).crewIds).toEqual(['bob']);
  });

  it('un trappingId SANS art d’affût (arme ordinaire) → throw', () => {
    expect(() => poste('arc', 'tribord')).toThrow(/poste/i);
  });

  it('un trappingId inconnu → throw', () => {
    expect(() => poste('canon-imaginaire', 'proue')).toThrow(/poste/i);
  });
});

describe('lib.mjs — `scene()` FORWARDE l’échelle demandée au MapSpec compilé', () => {
  it('une scène qui déclare `metresPerTile` la retrouve à la lecture', () => {
    const sc = scene({ id: 'tmp-mer', nom: 'Mer ouverte', base: 'eau', rows: ['====', '===='], metresPerTile: 8 });
    expect(sceneMetresPerTile(sc)).toBe(8);
  });

  it('une scène qui n’en déclare pas retombe sur le défaut du monde', () => {
    const sc = scene({ id: 'tmp-terre', nom: 'Plaine', base: 'terre', rows: ['....', '....'] });
    expect(sceneMetresPerTile(sc)).toBe(sceneMetresPerTile({ layers: [] } as never));
  });
});
