import { describe, expect, it } from 'vitest';
import { buildScene, type MapSpec } from './mapSpec';
import { sceneToAscii } from './sceneToAscii';
import { labelEmplacement, type SeatAssignments } from './seating';
import { PARTY_MAX } from './combatants';
import { validateScene } from './validateScene';

/**
 * `MapSpec.seatAssignments` — l'authoring ASCII sait attabler, mais seulement des corps qu'il NOMME.
 * Un id produit par `bind` naît d'un compteur d'entités (`nextEntityId`) : il change dès qu'un
 * marqueur bouge dans la grille, et n'est donc jamais une clé d'assise. La règle est donc : `propId`
 * comme `entityId` occupant figurent LITTÉRALEMENT dans `spec.entities`.
 */
const BASE: MapSpec = { id: 'taverne', label: 'Taverne', size: [8, 8], terrain: 'plancher' };

/** Table ronde en (2,2) cap `N` → abords : nord (2,1), est (3,2), sud (2,3), ouest (1,2). */
const TABLE = { id: 'table-1', kind: 'prop', pos: { x: 2, y: 2 }, ref: 'table-ronde-4-tabourets', facing: 'N', usable: { assise: true } } as const;
const AUBERGISTE = { id: 'pnj-aubergiste', kind: 'personnage', ref: 'humain', pos: { x: 2, y: 1 }, label: 'Aubergiste' } as const;
const FIXED_ASSIGNMENT: SeatAssignments = { 'table-1': { 'place-1': { kind: 'entity', entityId: 'pnj-aubergiste' } } };

/** Le MÊME meuble posé par un marqueur ASCII plutôt que par `entities`. */
function specWithBind(char: string, bind: NonNullable<MapSpec['bind']>[string]): MapSpec {
  return {
    ...BASE,
    levels: { z0: ['........', '........', `..${char}.....`, '........', '........', '........', '........', '........'].join('\n') },
    bind: { [char]: bind },
  };
}

describe('MapSpec.seatAssignments — le même meuble, mais une assise à ids FIXES seulement', () => {
  it('construit le même meuble via entities et bind, mais assigne seulement des ids fixes', () => {
    const byEntities = buildScene({ ...BASE, entities: [{ ...TABLE }] });
    const byBind = buildScene(specWithBind('M', { kind: 'prop', ref: 'table-murale-2-tabourets', facing: 'O' }));
    expect(byEntities.entities.find((e) => e.ref === 'table-ronde-4-tabourets')).toMatchObject({ kind: 'prop', facing: 'N' });
    expect(byBind.entities.find((e) => e.ref === 'table-murale-2-tabourets')).toMatchObject({ kind: 'prop', facing: 'O' });

    const genere = byBind.entities.find((e) => e.ref === 'table-murale-2-tabourets')!.id;
    expect(() =>
      buildScene({
        ...specWithBind('M', { kind: 'prop', ref: 'table-murale-2-tabourets', facing: 'O' }),
        seatAssignments: { [genere]: { 'place-1': { kind: 'entity', entityId: 'pnj-aubergiste' } } },
      }),
    ).toThrow(/seatAssignments.*ids fixes/);

    expect(buildScene({ ...BASE, entities: [{ ...TABLE }, { ...AUBERGISTE }], seatAssignments: FIXED_ASSIGNMENT }).seatAssignments)
      .toEqual(FIXED_ASSIGNMENT);
  });

  it('rejette un OCCUPANT que `entities` ne nomme pas littéralement', () => {
    expect(() =>
      buildScene({ ...BASE, entities: [{ ...TABLE }], seatAssignments: FIXED_ASSIGNMENT }),
    ).toThrow(/seatAssignments.*ids fixes/);
  });

  it('rejette une assise que le validateur commun refuse — jamais de Scène invalide compilée', () => {
    expect(() =>
      buildScene({
        ...BASE,
        entities: [{ ...TABLE }, { ...AUBERGISTE, pos: { x: 7, y: 7 } }],
        seatAssignments: FIXED_ASSIGNMENT,
      }),
    ).toThrow(/abord de sa place/);
  });

  /** Recoin d'UNE case en (2,6) : la table y tient, mais aucun abord n'est praticable. */
  const GRILLE_CERNEE = [
    '........',
    '........',
    '........',
    '........',
    '........',
    '........',
    '..P.....',
    '........',
  ].join('\n');

  // ── C1 (sonde S3 du juge, promue) ────────────────────────────────────────────────────────────────
  it('un PNJ attablé dans un recoin MURÉ ne se compile pas — le compilateur refuse ce que le geste refuse', () => {
    const CERNE: MapSpec = {
      ...BASE,
      terrain: 'mur',
      legend: { P: 'plancher' },
      levels: { z0: GRILLE_CERNEE },
      entities: [
        { id: 'table-1', kind: 'prop', pos: { x: 2, y: 6 }, ref: 'table-ronde-4-tabourets', facing: 'N', usable: { assise: true } },
        { id: 'pnj-aubergiste', kind: 'personnage', ref: 'humain', pos: { x: 2, y: 5 }, label: 'Aubergiste' },
      ],
      seatAssignments: FIXED_ASSIGNMENT,
    };
    expect(() => buildScene(CERNE)).toThrow(/aucun abord praticable/);
  });

  // ── C2 (défaut mesuré à La Diligence, 2026-08-23) ──────────────────────────────────────────
  /** Même table en (2,2), mais l'arête (2,2,N) — entre le siège et l'abord déclaré du nord — est
   *  bâtie : l'aubergiste posé en (2,1) est de l'AUTRE côté du mur, dans la pièce voisine. */
  const CLOISONNE = (door?: boolean): MapSpec => ({
    ...BASE,
    entities: [{ ...TABLE }, { ...AUBERGISTE }],
    walls: [{ x: 2, y: 2, side: 'N', ...(door ? { door: true } : {}) }],
    seatAssignments: FIXED_ASSIGNMENT,
  });

  it('un PNJ attablé depuis l’autre côté d’un MUR ne se compile pas — un abord marchable ne suffit pas', () => {
    expect(() => buildScene(CLOISONNE())).toThrow(/abord de sa place/);
  });

  it('la même arête percée d’une PORTE compile, et le validateur de document l’accepte', () => {
    const s = buildScene(CLOISONNE(true));
    expect(s.seatAssignments).toEqual(FIXED_ASSIGNMENT);
    expect(validateScene([s]).filter((w) => w.level === 'error')).toEqual([]);
  });

  it('la Scène compilée passe le validateur de document', () => {
    const s = buildScene({ ...BASE, entities: [{ ...TABLE }, { ...AUBERGISTE }], seatAssignments: FIXED_ASSIGNMENT });
    expect(validateScene([s]).filter((w) => w.level === 'error')).toEqual([]);
  });
});

describe('sceneToAscii — l’export dit ce qu’il ne restitue pas', () => {
  it('annonce tout ce que l’export ne restaure pas', () => {
    const seated = buildScene({ ...BASE, entities: [{ ...TABLE }, { ...AUBERGISTE }], seatAssignments: FIXED_ASSIGNMENT });
    const exp = sceneToAscii(seated);
    for (const champ of ['entities', 'bind', 'seatAssignments'])
      expect(exp.notRestored.join('\n'), champ).toContain(`\`${champ}\``);
    expect(exp.text).toContain('seatAssignments');
  });
});

describe('MapSpec.seatAssignments — les places de GROUPE s’authorent par EMPLACEMENT', () => {
  it('un rang du groupe canonique se compile tel quel, sans jamais nommer de héros', () => {
    const s = buildScene({ ...BASE, entities: [{ ...TABLE }], seatAssignments: { 'table-1': { 'place-2': { kind: 'party', rang: 2 } } } });
    expect(s.seatAssignments).toEqual({ 'table-1': { 'place-2': { kind: 'party', rang: 2 } } });
    expect(validateScene([s]).filter((w) => w.level === 'error')).toEqual([]);
  });

  it('un rang HORS du groupe canonique est refusé fail-fast', () => {
    expect(() =>
      buildScene({ ...BASE, entities: [{ ...TABLE }], seatAssignments: { 'table-1': { 'place-2': { kind: 'party', rang: PARTY_MAX + 1 } } } }),
    ).toThrow(new RegExp(`l'emplacement « ${labelEmplacement(PARTY_MAX + 1)} » est hors du groupe`));
  });

  it('une place de groupe n’exige AUCUN id fixe : elle ne désigne pas une entité', () => {
    expect(() =>
      buildScene({ ...BASE, entities: [{ ...TABLE }], seatAssignments: { 'table-1': { 'place-4': { kind: 'party', rang: 1 } } } }),
    ).not.toThrow();
  });
});
