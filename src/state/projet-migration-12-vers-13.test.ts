/**
 * GARDE — `PROJECT_MIGRATIONS[12]` : un projet AUTHORÉ AVANT #1882 se charge encore.
 *
 * QUESTION : la FICHE d'un personnage n'est plus facultative. Un porteur (`ref`, `statblock` ou
 * `presetId`) est REQUIS sur une entité `kind:'personnage'` (`PORTEURS_DU_TYPE`). Un `.json` exporté
 * avant ce lot, resté dans une bibliothèque utilisateur, ressort-il avec des personnages qui NOMMENT
 * leur fiche — le profil standard de leur espèce (`LDB 77 l.7`) quand elle en porte un, sinon le
 * statbloc de la branche `!ref` de `spawnEnemy` d'avant #1882 ?
 *
 * FIXTURE GELÉE : le document ci-dessous porte la forme `schema: 12` — trois personnages SANS porteur
 * (espèce à profil, id de rig, espèce absente), un qui porte déjà sa ref. Il est FIGÉ ; le
 * « moderniser » détruirait ce que la garde mesure.
 */
import { describe, expect, it } from 'vitest';
import { parseProject, CURRENT_PROJECT_SCHEMA, PROJECT_MIGRATIONS } from './worldMap';
import { DEFAULT_RELIEF_DEFAULTS, DEFAULT_ROOF_DEFAULTS, type SceneEntity } from './scene';
import { ficheDEntite } from './sceneNpc';
import species from '../data/species.json';
import { sceneEntitySchema } from '../data/schemas/defs-scenes/scene';

/** Le profil standard de l'espèce authorée, LU dans `species.json` (la parité porte sur la donnée). */
const ESPECE = 'humains-reiklander';
const PROFIL = (species as { id: string; profilStandard?: { id: string } }[]).find((s) => s.id === ESPECE)?.profilStandard?.id;
/** Le statbloc de la branche `!ref` de `spawnEnemy` d'avant #1882 (`state/spawn.ts`) : libellé et profil. */
const FICHE_DU_SPAWN = { type: 'statblock', label: 'Ennemi', char: { B: 10 } };

/** Document schema 12 — FIGÉ. Ne poser aucun porteur sur `aubergiste`, `rat`, `badaud`. */
const PROJET_FORMAT_12 = {
  type: 'projet',
  schema: 12,
  id: 'campagne-gelee-12',
  label: 'Campagne gelée (format 12)',
  versionContenu: 4,
  maison: 'fixture de test — aucun livre ne la publie',
  narratif: { affaires: [], indices: [], presetsPnj: [], objets: [] },
  scenes: [
    {
      type: 'scene',
      id: 'taverne',
      label: 'La taverne',
      dimensions: { w: 2, h: 2 },
      reliefDefaults: { ...DEFAULT_RELIEF_DEFAULTS },
      roofDefaults: { ...DEFAULT_ROOF_DEFAULTS },
      layers: [{ z: 0, tiles: ['herbe', 'herbe', 'herbe', 'herbe'] }],
      entities: [
        { id: 'aubergiste', kind: 'personnage', pos: { x: 0, y: 0 }, label: 'Aubergiste', appearance: { species: ESPECE } },
        { id: 'rat', kind: 'personnage', pos: { x: 1, y: 0 }, appearance: { species: 'rat-geant' } },
        { id: 'badaud', kind: 'personnage', pos: { x: 0, y: 1 } },
        { id: 'garde', kind: 'personnage', ref: 'capitaine-du-guet', pos: { x: 1, y: 1 } },
      ],
    },
  ],
};

const scèneMigrée = () => parseProject(structuredClone(PROJET_FORMAT_12)).scenes[0];

describe('PROJECT_MIGRATIONS[12] — un projet format 12 se charge à travers la migration (#1882)', () => {
  it('le document gelé est bien au format ANTÉRIEUR, et l’espèce porte un profil standard', () => {
    expect(PROJET_FORMAT_12.schema).toBe(12);
    expect(PROJET_FORMAT_12.schema).toBeLessThan(CURRENT_PROJECT_SCHEMA);
    expect(PROFIL, `${ESPECE} sans profilStandard dans species.json`).toBeTruthy();
  });

  it('le personnage d’espèce à profil NOMME le profil standard de son espèce (LDB 77 l.7)', () => {
    const [aubergiste] = scèneMigrée().entities!;
    expect(aubergiste.ref).toBe(PROFIL);
    expect(aubergiste.statblock).toBeUndefined();
  });

  it('sans profil standard (id de rig, espèce absente) : le statbloc de la branche `!ref`, en `statblock` explicite', () => {
    const [, rat, badaud] = scèneMigrée().entities!;
    for (const e of [rat, badaud]) {
      expect(e.ref).toBeUndefined();
      expect(e.statblock).toEqual(FICHE_DU_SPAWN);
    }
  });

  it('un personnage qui NOMMAIT déjà sa fiche traverse INTACT', () => {
    expect(scèneMigrée().entities![3].ref).toBe('capitaine-du-guet');
  });

  /** S1 — PARITÉ des DEUX implémentations du même bump : la POSITION de la clé. Le script de dépôt
   *  (`scripts/migrations/2026-09-23-1882-fiche-de-personnage-nommee.mjs`) et le migrateur de
   *  CHARGEMENT posent la fiche en QUEUE de l'entité. */
  it('S1. PARITÉ : le migrateur de CHARGEMENT pose la fiche en QUEUE, comme le script de DÉPÔT', () => {
    const migre = PROJECT_MIGRATIONS[12]!({ ...structuredClone(PROJET_FORMAT_12), version: 12 } as never) as Record<string, unknown>;
    expect(migre.schema).toBe(13);
    const entites = ((migre.scenes as Record<string, unknown>[])[0].entities) as Record<string, unknown>[];
    expect(Object.keys(entites[0])).toEqual(['id', 'kind', 'pos', 'label', 'appearance', 'ref']);
    expect(Object.keys(entites[1])).toEqual(['id', 'kind', 'pos', 'appearance', 'statblock']);
    expect(Object.keys(entites[2])).toEqual(['id', 'kind', 'pos', 'statblock']);
    expect(Object.keys(entites[3])).toEqual(['id', 'kind', 'ref', 'pos']);
  });

  it('S2. IDEMPOTENT : rejoué sur sa propre sortie, le migrateur ne change plus rien', () => {
    const une = PROJECT_MIGRATIONS[12]!({ ...structuredClone(PROJET_FORMAT_12), version: 12 } as never);
    const deux = PROJECT_MIGRATIONS[12]!({ ...structuredClone(une), version: 12 } as never);
    expect(JSON.stringify(deux)).toBe(JSON.stringify(une));
  });

  it('un porteur VIDE (`ref: \'\'`, `presetId: \'\'`) est une ABSENCE : retiré, puis la fiche se nomme en QUEUE (#1882)', () => {
    const doc = {
      schema: 12, version: 12,
      scenes: [{ entities: [
        { id: 'a', kind: 'personnage', ref: '', pos: { x: 0, y: 0 }, appearance: { species: ESPECE } },
        { id: 'b', kind: 'personnage', ref: '', presetId: '', pos: { x: 0, y: 0 } },
      ] }],
    };
    const [a, b] = (PROJECT_MIGRATIONS[12]!(doc as never) as { scenes: { entities: Record<string, unknown>[] }[] }).scenes[0].entities;
    expect(a).toEqual({ id: 'a', kind: 'personnage', pos: { x: 0, y: 0 }, appearance: { species: ESPECE }, ref: PROFIL });
    expect(Object.keys(a)).toEqual(['id', 'kind', 'pos', 'appearance', 'ref']);
    expect(b).toEqual({ id: 'b', kind: 'personnage', pos: { x: 0, y: 0 }, statblock: FICHE_DU_SPAWN });
  });

  it('au SCHÉMA : une réf VIDE est une absence, une réf MORTE est refusée en la nommant (#1882)', () => {
    const base = { id: 'p', kind: 'personnage', pos: { x: 0, y: 0 } };
    expect(sceneEntitySchema.safeParse({ ...base, ref: '' }).error?.issues.map((i) => i.message))
      .toEqual(['personnage « p » : « ref », « statblock », « presetId » absents — un personnage NOMME sa fiche (bestiaire, statbloc ou preset de PNJ)']);
    expect(sceneEntitySchema.safeParse({ ...base, ref: 'creature-fantome' }).error?.issues.map((i) => i.message))
      .toEqual(['personnage « p » : ref « creature-fantome » ni créature, ni coque de véhicule, ni engin de siège']);
  });

  it('au SCHÉMA : la famille est CELLE du spawn — un équipement sans affut, un véhicule sans coque sont refusés au PARSE (#1882)', () => {
    const base = { id: 'p', kind: 'personnage', pos: { x: 0, y: 0 } };
    for (const ref of ['baton-de-combat', 'barque'])
      expect(sceneEntitySchema.safeParse({ ...base, ref }).success, ref).toBe(false);
    for (const ref of ['humain', 'cogue'])
      expect(sceneEntitySchema.safeParse({ ...base, ref }).success, ref).toBe(true);
  });

  it('SANS le migrateur, le personnage sans fiche serait REFUSÉ au parse, en NOMMANT l’entité', () => {
    const bricole = { ...structuredClone(PROJET_FORMAT_12), schema: CURRENT_PROJECT_SCHEMA };
    expect(() => parseProject(bricole)).toThrow(/personnage « aubergiste » : « ref », « statblock », « presetId » absents/);
  });

  /** Le combattant APRÈS le migrateur, par la fiche du spawn (`ficheDEntite`), face à ce que la branche
   *  `!ref` de `spawnEnemy` JOUAIT avant #1882 — le passé est une DONNÉE, mesurée sur le dernier état de
   *  cette branche (juge de diff T2a, 2026-09-23) : quelle que soit l'espèce, ce combattant-là. */
  it('au SPAWN : libellé et Blessures inchangés sans profil standard, la forme du corps suit l’espèce ; le profil standard donne sa fiche', () => {
    const AVANT_1882 = { label: 'Ennemi', blessures: 10, corps: 'humanoide', fiche: undefined };
    const apres = (species: string) => {
      const doc = { schema: 12, version: 12, scenes: [{ entities: [{ id: `p-${species}`, kind: 'personnage', pos: { x: 0, y: 0 }, appearance: { species } }] }] };
      const migree = (PROJECT_MIGRATIONS[12]!(doc as never) as { scenes: { entities: SceneEntity[] }[] }).scenes[0].entities[0];
      const c = ficheDEntite(migree);
      return { label: c.label, blessures: c.wounds.max, corps: c.bodyShape, fiche: c.creatureId };
    };
    expect(apres('loup')).toEqual({ ...AVANT_1882, corps: 'quadrupede' });
    expect(apres('rat-geant')).toEqual({ ...AVANT_1882, corps: 'quadrupede' });
    expect(apres('gnomes')).toEqual(AVANT_1882);
    expect(apres('humains-reiklander')).toEqual({ label: 'Humain', blessures: 12, corps: 'humanoide', fiche: 'humain' });
  });

  it('au SCHÉMA : chaque porteur SEUL suffit, l’absence de tous est l’issue nommée au chemin `ref`', () => {
    const base = { id: 'p', kind: 'personnage', pos: { x: 0, y: 0 } };
    for (const porteur of [{ ref: 'capitaine-du-guet' }, { statblock: FICHE_DU_SPAWN }, { presetId: 'baron' }])
      expect(sceneEntitySchema.safeParse({ ...base, ...porteur }).success, Object.keys(porteur)[0]).toBe(true);
    const r = sceneEntitySchema.safeParse(base);
    expect(r.success).toBe(false);
    expect(r.error!.issues.map((i) => [i.path.join('.'), i.message])).toEqual([
      ['ref', 'personnage « p » : « ref », « statblock », « presetId » absents — un personnage NOMME sa fiche (bestiaire, statbloc ou preset de PNJ)'],
    ]);
  });
});
