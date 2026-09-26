import { describe, it, expect } from 'vitest';
import { buildEncounter, buildEncounters, type AuthoredEnemy } from './encounterAuthoring';
import { flowFromEffects } from './flow';

describe('buildEncounter — authoring terse → entités + members canoniques', () => {
  it("un ennemi devient une entité 'personnage' + un membre qui la référence (profil porté par l'entité)", () => {
    const { entities, encounter } = buildEncounter({
      id: 'enc-1',
      enemies: [{ ref: 'mutant', pos: { x: 2, y: 3 }, weapon: 'Hache', optionals: [{ id: 'peur', value: 1 }], spells: ['flechette'], randomChars: true }],
    });
    expect(encounter.members![0].entityId).toBe('enemy-enc-1-0');
    const ent = entities[0];
    expect(ent.kind).toBe('personnage');
    expect(ent.pos).toEqual({ x: 2, y: 3 });
    expect(ent.ref).toBe('mutant');
    expect(ent.weapon).toBe('Hache');
    // VISIBLE par défaut : pas de hiddenUntilCombat
    expect(ent.combat).toEqual({ optionals: [{ id: 'peur', value: 1 }], spells: ['flechette'], randomChars: true });
  });

  it("hidden (rencontre) → toutes les entités cachées jusqu'au combat (embuscade)", () => {
    const { entities } = buildEncounter({ id: 'amb', hidden: true, surprise: 'party', enemies: [{ ref: 'gor', pos: { x: 1, y: 1 } }] });
    expect(entities[0].combat).toEqual({ hiddenUntilCombat: true });
  });

  it('hidden par ennemi surcharge le réglage de la rencontre', () => {
    const { entities } = buildEncounter({ id: 'mix', hidden: true, enemies: [
      { ref: 'gor', pos: { x: 1, y: 1 } },
      { ref: 'ungor', pos: { x: 2, y: 2 }, hidden: false },
    ] });
    expect(entities[0].combat?.hiddenUntilCombat).toBe(true);
    expect(entities[1].combat).toBeUndefined(); // visible, aucun autre champ combat
  });

  it('camp/monture préservés ; rides (index) → ridesEntityId (réf stable)', () => {
    const { encounter } = buildEncounter({ id: 'e', enemies: [
      { ref: 'cheval', pos: { x: 0, y: 0 }, mount: true, side: 'ally' },
      { ref: 'brigand', pos: { x: 0, y: 0 }, rides: 0 },
    ] });
    const [cheval, bandit] = encounter.members!;
    expect(cheval).toEqual({ entityId: 'enemy-e-0', side: 'ally', mount: true });
    expect(bandit).toEqual({ entityId: 'enemy-e-1', ridesEntityId: 'enemy-e-0' });
  });

  it('surprise + onVictory (Flow) passent sur la rencontre', () => {
    const onV = flowFromEffects([{ type: 'giveXp', amount: 10 }]);
    const { encounter } = buildEncounter({ id: 'e', surprise: 'enemies', onVictory: onV, enemies: [{ ref: 'orc', pos: { x: 1, y: 1 } }] });
    expect(encounter.surprise).toBe('enemies');
    expect(encounter.onVictory).toEqual(onV);
  });

  it('maneuverability/threat/terrain (Avantage initial, AA 11 l.53-65) passent sur la rencontre — parité avec surprise', () => {
    const { encounter } = buildEncounter({
      id: 'e',
      maneuverability: 'party',
      threat: { camp: 'enemies', tier: 'tresDangereuse' },
      terrain: { camp: 'party', heavy: true },
      enemies: [{ ref: 'orc', pos: { x: 1, y: 1 } }],
    });
    expect(encounter.maneuverability).toBe('party');
    expect(encounter.threat).toEqual({ camp: 'enemies', tier: 'tresDangereuse' });
    expect(encounter.terrain).toEqual({ camp: 'party', heavy: true });
  });

  it('maneuverability/threat/terrain absents → absents sur la rencontre (comme surprise)', () => {
    const { encounter } = buildEncounter({ id: 'e', enemies: [{ ref: 'orc', pos: { x: 1, y: 1 } }] });
    expect(encounter.maneuverability).toBeUndefined();
    expect(encounter.threat).toBeUndefined();
    expect(encounter.terrain).toBeUndefined();
  });

  it('victoryCondition (#197) passe sur la rencontre — round-trip, absent = allEnemiesDead implicite', () => {
    const { encounter } = buildEncounter({
      id: 'e',
      victoryCondition: { type: 'destroyStructure', edge: { x: 5, y: 4, side: 'N' } },
      enemies: [{ ref: 'orc', pos: { x: 1, y: 1 } }],
    });
    expect(encounter.victoryCondition).toEqual({ type: 'destroyStructure', edge: { x: 5, y: 4, side: 'N' } });
  });

  it('victoryCondition absent → absent sur la rencontre (comme surprise)', () => {
    const { encounter } = buildEncounter({ id: 'e', enemies: [{ ref: 'orc', pos: { x: 1, y: 1 } }] });
    expect(encounter.victoryCondition).toBeUndefined();
  });

  it('buildEncounters agrège entités et rencontres de plusieurs rencontres', () => {
    const { entities, encounters } = buildEncounters([
      { id: 'a', enemies: [{ ref: 'gobelin', pos: { x: 1, y: 1 } }] },
      { id: 'b', enemies: [{ ref: 'orc', pos: { x: 2, y: 2 } }, { ref: 'orc', pos: { x: 3, y: 3 } }] },
    ]);
    expect(entities.map((e) => e.id)).toEqual(['enemy-a-0', 'enemy-b-0', 'enemy-b-1']);
    expect(encounters.map((e) => e.id)).toEqual(['a', 'b']);
  });
});

describe('#1882 — un ennemi authoré NOMME sa fiche', () => {
  it('l’absence de tout porteur de fiche est irreprésentable au type', () => {
    // @ts-expect-error — `AuMoinsUnPorteurDeFiche` n'a aucune variante sans porteur (#1882).
    const sansFiche: AuthoredEnemy = { pos: { x: 0, y: 0 }, label: 'Badaud' };
    expect(sansFiche.pos).toEqual({ x: 0, y: 0 });
  });

  it('chaque porteur SEUL suffit, et se retrouve sur l’entité générée', () => {
    const sb = { type: 'statblock' as const, label: 'Brigand', char: { B: 10 } };
    const porteurs: AuthoredEnemy[] = [
      { ref: 'humain', pos: { x: 0, y: 0 } },
      { statblock: sb, pos: { x: 1, y: 0 } },
      { presetId: 'baron', pos: { x: 2, y: 0 } },
    ];
    const { entities } = buildEncounter({ id: 'p', enemies: porteurs });
    expect(entities.map((e) => [e.ref, e.statblock, e.presetId])).toEqual([
      ['humain', undefined, undefined],
      [undefined, sb, undefined],
      [undefined, undefined, 'baron'],
    ]);
  });
});
