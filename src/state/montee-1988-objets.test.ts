/**
 * GARDE — les montées UNIQUES du train #1988 B4a : `ItemInstance.label` meurt, un objet n'est plus désigné
 * que par son id (`DesignationDObjet`).
 *
 * QUESTION : une donnée persistée AVANT le train (save, héros du roster exporté ou stocké, projet) qui porte
 * chaque classe héritée d'objet ressort-elle désignée par id — ou est-elle refusée en NOMMANT ce qu'elle ne
 * sait pas monter, jamais en silence ?
 *
 * Le sort de chaque classe :
 *  - catalogue (`trappingId` + `label`) → `label` retiré ;
 *  - custom résolu (`label` d'un objet du catalogue, sans `trappingId`) → `trappingId` ;
 *  - custom non résolu → refus nommé ;
 *  - pièce récoltée d'avant #1988 (`price` sans `trappingId`) → refus nommé ;
 *  - arme invoquée (`conjured` + `source`) → `label` retiré, désignée par sa source ; sans `source` → refus nommé ;
 *  - instance sans désignation → refus nommé ;
 *  - m7 du juge de ii : qualités d'un don en chaînes → `{ id }` (qualité inconnue : refus nommé) ; `custom`
 *    d'un don → `trappingId` ; Condition `hasItem` par libellé → id ;
 *  - save : TOUTE save d'avant le train est refusée par sa version (`MIGRATIONS_DE_SAVE`, POLITIQUE DE
 *    VERSION de `src/state/saves.ts`).
 *
 * FIXTURES GELÉES : les objets ci-dessous portent la forme d'AVANT le train. Ils sont FIGÉS.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { rosterImport, rosterLoad, takeRosterNotice } from './roster';
import { parseSave, SAVE_VERSION } from './saves';
import { PROJECT_MIGRATIONS } from '../data/migrationsDeProjet';
import { authoredShipPosteSchema } from '../data/schemas/defs-scenes/scene';
import { itemInstanceSchema } from '../data/schemas/grammaire/instanceDObjet';
import type { ItemInstance } from '../engine/types';

/** Les CLÉS des entrées #1988 (`ROSTER_MIGRATIONS[7]`, `roster.ts` ; `MIGRATIONS_DE_SAVE[60]`, `saves.ts`) :
 *  la version d'avant le train, épinglée — jamais un maximum vivant, qu'une montée future déplacerait. */
const VERSION_DE_ROSTER_D_AVANT = 7;
const VERSION_DE_SAVE_D_AVANT = 60;

/** Une instance d'avant le train : champs requis + ce que le cas fait varier. FIGÉE. */
const avant = (o: Record<string, unknown>) => ({ kind: 'misc', qualities: [], enc: 0, equipped: false, ...o });

const CATALOGUE = avant({ uid: 'cat', trappingId: 'dague', label: 'Dague', kind: 'melee' });
const CUSTOM_RESOLU = avant({ uid: 'cus', label: 'Corde' });
const INVOQUEE = avant({ uid: 'inv', label: 'Arme aethyrique', kind: 'melee', conjured: true, source: { kind: 'spell', id: 'arme-aethyrique' } });
/** Un consommable dont le Flow porte un don et une Condition d'avant ii (classes m7 du juge de ii). */
const CONSOMMABLE = avant({
  uid: 'con', trappingId: 'ration', label: 'Ration',
  consumable: { kind: 'seq', steps: [
    { kind: 'do', effect: { type: 'giveTrapping', custom: 'Corde', qualities: ['magique', 'Raffiné'] } },
    { kind: 'if', when: { kind: 'hasItem', trappingId: 'Corde' }, then: { kind: 'seq', steps: [] } },
  ] },
});

const exporte = (items: unknown[]) => JSON.stringify({ kind: 'wfrp4-hero', v: VERSION_DE_ROSTER_D_AVANT, hero: { id: 'h', label: 'Héros', items }, wealth: { gold: 0, silver: 0, brass: 0 } });

describe('roster exporté — `ROSTER_MIGRATIONS` monte les objets du héros', () => {
  it('catalogue, custom résolu, arme invoquée et dons du consommable ressortent désignés par id', () => {
    const r = rosterImport(exporte([CATALOGUE, CUSTOM_RESOLU, INVOQUEE, CONSOMMABLE]));
    expect(r.error).toBeUndefined();
    const items = r.entry!.hero.items!;
    expect(items.map((it) => 'label' in it)).toEqual([false, false, false, false]);
    expect(items[0]).toMatchObject({ uid: 'cat', trappingId: 'dague' });
    expect(items[1]).toMatchObject({ uid: 'cus', trappingId: 'corde' });
    expect(items[2]).toMatchObject({ uid: 'inv', conjured: true, source: { kind: 'spell', id: 'arme-aethyrique' } });
    expect('trappingId' in items[2]).toBe(false);
    const flow = items[3].consumable as unknown as { steps: [{ effect: Record<string, unknown> }, { when: Record<string, unknown> }] };
    expect(flow.steps[0].effect).toEqual({ type: 'giveTrapping', trappingId: 'corde', qualities: [{ id: 'magique' }, { id: 'raffine' }] });
    expect(flow.steps[1].when).toEqual({ kind: 'hasItem', trappingId: 'corde' });
  });

  it.each([
    ['custom non résolu', avant({ uid: 'x', label: 'Babiole introuvable' }), 'Babiole introuvable'],
    ['pièce récoltée d’avant #1988', avant({ uid: 'x', label: 'Peau (Loup)', price: { gold: 0, silver: 3, brass: 0 } }), 'Peau (Loup)'],
    ['arme invoquée sans source', avant({ uid: 'x', label: 'Arme', kind: 'melee', conjured: true }), 'Arme'],
    ['instance sans désignation', avant({ uid: 'x' }), 'x'],
    ['qualité de don inconnue', avant({ uid: 'x', trappingId: 'ration', consumable: { kind: 'do', effect: { type: 'giveTrapping', trappingId: 'corde', qualities: ['qualite-inconnue'] } } }), 'Ration'],
  ])('%s : l’import est REFUSÉ, l’objet nommé en langue joueur', (_cas, objet, nom) => {
    const r = rosterImport(exporte([CATALOGUE, objet]));
    expect(r.entry).toBeUndefined();
    expect(r.error).toBe(`Fichier de personnage invalide. Objets non reconnus : « ${nom} ».`);
  });
});

describe('roster stocké — la lecture monte chaque héros, et écarte celui qu’elle ne sait pas monter', () => {
  const stock = new Map<string, string>();
  beforeEach(() => {
    stock.clear();
    (globalThis as { localStorage?: Storage }).localStorage = {
      getItem: (k: string) => stock.get(k) ?? null,
      setItem: (k: string, v: string) => void stock.set(k, v),
      removeItem: (k: string) => void stock.delete(k),
    } as Storage;
  });
  afterEach(() => { delete (globalThis as { localStorage?: Storage }).localStorage; });

  it('le héros montable sort désigné ; celui à pièce récoltée d’avant #1988 est écarté, et le TÉMOIN le dit au joueur', () => {
    const entree = (id: string, label: string, items: unknown[]) => ({ hero: { id, label, items }, wealth: { gold: 0, silver: 0, brass: 0 } });
    stock.set('wfrp4.roster.v1', JSON.stringify([entree('ok', 'Ada', [CATALOGUE, CUSTOM_RESOLU]), entree('ko', 'Bertold', [CATALOGUE, avant({ uid: 'p', label: 'Peau', price: { gold: 1, silver: 0, brass: 0 } })])]));
    takeRosterNotice();
    const lus = rosterLoad();
    expect(lus.map((e) => e.hero.id)).toEqual(['ok']);
    expect(lus[0].hero.items!.map((it) => it.trappingId)).toEqual(['dague', 'corde']);
    expect(takeRosterNotice()).toEqual([
      'Bertold a été retiré de vos personnages : sa fiche vient d’une version antérieure du jeu et ne peut plus être lue. Objets non reconnus : « Peau ».',
    ]);
    expect(takeRosterNotice(), 'le témoin se consomme').toEqual([]);
  });
});

describe('projet — l’entrée `PROJECT_MIGRATIONS[17]` monte les instances de poste', () => {
  const projet = (ammo: unknown[]) => ({ schema: 17, scenes: [{ id: 's', entities: [{ id: 'navire', postes: [{ trappingId: 'canon-moyen', ammo }] }] }] });

  it('les munitions de poste perdent `label` ; `grantWeapon` perd `label`', () => {
    const doc = { ...projet([avant({ uid: 'b', trappingId: 'boulet-et-poudre', label: 'Boulet et poudre', kind: 'ammo' })]), extra: { op: 'grantWeapon', label: 'Épée', damage: 4 } };
    const monte = PROJECT_MIGRATIONS[17](doc) as { scenes: [{ entities: [{ postes: [{ ammo: Record<string, unknown>[] }] }] }]; extra: Record<string, unknown> };
    expect(monte.scenes[0].entities[0].postes[0].ammo[0]).toEqual({ uid: 'b', trappingId: 'boulet-et-poudre', kind: 'ammo', qualities: [], enc: 0, equipped: false });
    expect(monte.extra).toEqual({ op: 'grantWeapon', damage: 4 });
  });

  it('une munition que rien ne désigne LÈVE, sa raison nommée', () => {
    expect(() => PROJECT_MIGRATIONS[17](projet([avant({ uid: 'b', label: 'Mitraille maison', kind: 'ammo' })]))).toThrow(/« Mitraille maison » ne nomme aucun objet/);
  });
});

describe('frontière — `itemInstanceSchema`, lu par le poste d’un document de projet', () => {
  it('au compilateur, une instance sans désignation ne compile pas', () => {
    // @ts-expect-error — ni `trappingId`, ni `{ conjured: true, source }` : `DesignationDObjet` manque.
    const sansDesignation: ItemInstance = { uid: 'x', kind: 'misc', qualities: [], enc: 0, equipped: false };
    expect(itemInstanceSchema.safeParse(sansDesignation).success).toBe(false);
  });

  it('admet les deux désignations', () => {
    expect(itemInstanceSchema.safeParse({ uid: 'a', trappingId: 'dague', kind: 'melee', qualities: [], enc: 0, equipped: false }).success).toBe(true);
    expect(itemInstanceSchema.safeParse({ uid: 'b', conjured: true, source: { kind: 'spell', id: 'arme-aethyrique' }, form: 'rapiere', kind: 'melee', qualities: [], enc: 0, equipped: false }).success).toBe(true);
  });

  it.each([
    ['`label` mort', { uid: 'a', trappingId: 'dague', label: 'Dague' }, /porte `label`, champ mort/],
    ['sans désignation', { uid: 'a' }, /sans désignation/],
    ['invoquée sans source', { uid: 'a', conjured: true }, /arme invoquée sans `source` valide/],
    ['invoquée ET de catalogue', { uid: 'a', conjured: true, source: { kind: 'spell', id: 'x' }, trappingId: 'dague' }, /porte aussi une désignation de catalogue/],
  ])('refuse nommément : %s', (_cas, it, raison) => {
    const r = itemInstanceSchema.safeParse(it);
    expect(r.success).toBe(false);
    expect(r.error!.issues.map((i) => i.message).join(' ')).toMatch(raison);
  });

  it('le poste refuse une munition à `label`, au chemin de la munition', () => {
    const r = authoredShipPosteSchema.safeParse({ trappingId: 'canon-moyen', ammo: [{ uid: 'b', trappingId: 'boulet-et-poudre', label: 'Boulet et poudre', kind: 'ammo', qualities: [], enc: 0, equipped: false }] });
    expect(r.success).toBe(false);
    expect(r.error!.issues[0].path).toEqual(['ammo', 0]);
    expect(r.error!.issues[0].message).toMatch(/instance « b » : porte `label`/);
  });
});

describe('save — `MIGRATIONS_DE_SAVE` : une save d’avant le train est refusée par sa version', () => {
  const save = (version: number) => ({ version, savedAt: '2026-10-05T00:00:00Z', sceneLabel: 's', gameTime: 0, data: {
    party: [{ id: 'h', items: [CUSTOM_RESOLU, INVOQUEE] }],
    pendingLoot: [{ effect: { type: 'giveTrapping', custom: 'Corde', price: { gold: 1 }, qualities: ['magique'] } }],
  } });
  it('la version d’avant (toutes classes comprises) est refusée ; la courante se lit', () => {
    expect(parseSave(save(VERSION_DE_SAVE_D_AVANT))).toBeNull();
    expect(parseSave(save(SAVE_VERSION))).not.toBeNull();
  });
});
