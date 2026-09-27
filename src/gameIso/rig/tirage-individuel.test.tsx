/**
 * #1882 T1 — tirage individuel (#223) : règle UNIQUE de l'exploration, du combat et du portrait. Un individu
 * tire ses teintes dans les plages `tirageIndividuel` de sa race (`raceAppearance.json`) ; chaque teinte
 * posée par l'auteur l'emporte, une par une. La graine suit la même règle : celle posée sur l'entité, puis
 * celle du record pour un individu NOMMÉ, puis l'instance. La race de REPLI ne tire rien.
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { entityRigProfileFor, enemyRigProfile } from './enemyProfile';
import type { EnemyRigProfile } from './enemyProfile';
import { teintesTirees } from './parts/tirageIndividuel';
import { raceById } from './races';
import { bipedDef } from './creatures';
import { ficheDEntite } from '../../state/sceneNpc';
import { hashSeed } from '../../engine/dice';
import { RigPortrait } from '../../ui/RigPortrait';
import type { SceneEntity } from '../../state/scene';
import { schema as raceSchema } from '../../data/schemas/defs/raceAppearance';
import raceAppearanceJson from '../../data/raceAppearance.json';

const ID = 'pnj-1882-0'; // graine dont la peau (#6f4a2f) diffère de la palette de race `humain`
const PLAGES = raceById('humain').tirageIndividuel ?? {};
const tire = (graine: number) => ({ colors: teintesTirees(graine, PLAGES), parts: undefined });
const SEEDED = tire(hashSeed(ID));

const entity = (extra: Partial<SceneEntity> = {}): SceneEntity =>
  ({ kind: 'personnage', id: ID, label: 'Passant', pos: { x: 0, y: 0 }, appearance: { species: 'humains-reiklander' }, ...extra }) as SceneEntity;
const combatant = ficheDEntite;
const palette = (p: EnemyRigProfile | null) => ({ colors: p?.appearance.colors, parts: p?.appearance.parts });
const armure = (p: EnemyRigProfile | null) => (p?.equip.armour ?? []).map((i) => `${i.label}:${i.pa}`).sort();

describe('#1882 T1 — tirage individuel : même règle en exploration, en combat et au portrait', () => {
  it('poser la ref du profil standard (`humain`) garde le tirage individuel du PNJ', () => {
    expect(palette(entityRigProfileFor(entity({ ref: 'humain' })))).toEqual(SEEDED);
  });

  it('parité : l’exploration et le combat d’une même entité rendent le même tirage', () => {
    const ent = entity({ ref: 'humain' });
    expect(palette(enemyRigProfile(combatant(ent)))).toEqual(palette(entityRigProfileFor(ent)));
  });

  it('parité : le portrait du combattant peint la peau tirée', () => {
    const html = renderToStaticMarkup(<RigPortrait combatant={combatant(entity({ ref: 'humain' }))} />);
    expect(html).toContain(SEEDED.colors.peau);
  });

  describe('champ par champ : ce que l’auteur pose l’emporte, le tirage remplit le reste', () => {
    const cas = (appearance: SceneEntity['appearance']) => entity({ ref: 'humain', appearance: { species: 'humains-reiklander', ...appearance } });
    it('rien d’authoré → tout est tiré', () => {
      const ent = cas({});
      expect(palette(entityRigProfileFor(ent))).toEqual(SEEDED);
      expect(palette(enemyRigProfile(combatant(ent)))).toEqual(SEEDED);
    });
    it('peau seule authorée → peau de l’auteur, cheveux tirés', () => {
      const ent = cas({ colors: { peau: '#123456' } });
      const attendu = { colors: { ...SEEDED.colors, peau: '#123456' }, parts: SEEDED.parts };
      expect(palette(entityRigProfileFor(ent))).toEqual(attendu);
      expect(palette(enemyRigProfile(combatant(ent)))).toEqual(attendu);
    });
    it('visage seul épinglé → teintes tirées, visage de l’auteur', () => {
      const ent = cas({ parts: { visage: 2 } });
      const attendu = { colors: SEEDED.colors, parts: { visage: 2 } };
      expect(palette(entityRigProfileFor(ent))).toEqual(attendu);
      expect(palette(enemyRigProfile(combatant(ent)))).toEqual(attendu);
    });
    it('les teintes posées par la def d’espèce (`perso.colors`) l’emportent sur le tirage', () => {
      const perso = bipedDef('horreur-rose')!.perso!.colors!;
      const ent = entity({ ref: 'horreur-rose', appearance: undefined });
      expect(entityRigProfileFor(ent)!.appearance.colors).toMatchObject(perso);
      expect(enemyRigProfile(combatant(ent))!.appearance.colors).toMatchObject(perso);
    });
  });

  it('une race sans plages (homme-bête) ne tire rien', () => {
    const ent = entity({ ref: 'gor', appearance: undefined });
    expect(entityRigProfileFor(ent)!.appearance.colors).toBeUndefined();
    expect(enemyRigProfile(combatant(ent))!.appearance.colors).toBeUndefined();
  });

  it('la race de REPLI d’une espèce non résolue ne tire rien', () => {
    const ent = { kind: 'personnage', id: ID, label: 'Mouton', pos: { x: 0, y: 0 }, ref: 'mouton' } as SceneEntity;
    expect(palette(entityRigProfileFor(ent))).toEqual({ colors: undefined, parts: undefined });
    expect(palette(enemyRigProfile(combatant(ent)))).toEqual({ colors: undefined, parts: undefined });
  });

  it('un individu NOMMÉ est UN individu, tiré de son record, dans toute scène : toute son apparence', () => {
    const graine = hashSeed('bella-la-noire');
    const [a, b] = ['auberge-bella', 'foret-bella'].map((id) => entity({ id, ref: 'bella-la-noire', appearance: undefined }));
    const explo = entityRigProfileFor(a)!.appearance;
    expect(explo.seed).toBe(graine);
    expect(palette(entityRigProfileFor(a))).toEqual(tire(graine));
    expect(entityRigProfileFor(b)!.appearance).toEqual(explo);
    expect(enemyRigProfile(combatant(a))!.appearance).toEqual(explo);
    expect(enemyRigProfile(combatant(b))!.appearance).toEqual(explo);
  });

  it('contrat : la coiffure a UNE source, le resolver par la graine de l’individu — le profil n’en pose aucune', () => {
    for (const ent of [entity({ ref: 'humain' }), entity({ ref: 'bella-la-noire', appearance: undefined })]) {
      expect(entityRigProfileFor(ent)!.appearance.parts?.cheveux).toBeUndefined();
      expect(enemyRigProfile(combatant(ent))!.appearance.parts?.cheveux).toBeUndefined();
    }
  });

  it('la graine POSÉE sur l’entité l’emporte, même pour un individu nommé (bouton « Relancer »)', () => {
    const sans = entity({ id: 'auberge-bella', ref: 'bella-la-noire', appearance: undefined });
    const avec = entity({ id: 'auberge-bella', ref: 'bella-la-noire', appearance: { seed: 12345 } });
    for (const profil of [entityRigProfileFor, (e: SceneEntity) => enemyRigProfile(combatant(e))]) {
      expect(profil(sans)!.appearance.seed).toBe(hashSeed('bella-la-noire'));
      expect(profil(avec)!.appearance.seed).toBe(12345);
      expect(palette(profil(avec))).toEqual(tire(12345));
      expect(profil(avec)!.appearance).not.toEqual(profil(sans)!.appearance);
    }
  });

  it('un PNJ à statbloc d’auteur (sans record) tire comme un profil générique, en exploration et en combat', () => {
    const ent = entity({ statblock: { label: 'Passant', char: { B: 10 } } as SceneEntity['statblock'] });
    expect(palette(entityRigProfileFor(ent))).toEqual(SEEDED);
    expect(palette(enemyRigProfile(combatant(ent)))).toEqual(SEEDED);
  });

  it('un profil GÉNÉRIQUE varie par instance', () => {
    const a = palette(entityRigProfileFor(entity({ id: 'garde-a', ref: 'humain' })));
    const b = palette(entityRigProfileFor(entity({ id: 'garde-b', ref: 'humain' })));
    expect(a).toEqual(tire(hashSeed('garde-a')));
    expect(b).toEqual(tire(hashSeed('garde-b')));
    expect(a).not.toEqual(b);
  });
});

describe('#1882 T1 — armure portée : parité exploration/combat hors enrôlement', () => {
  it('`vermine-de-choc` d’ambiance (non enrôlée) porte la même armure qu’en combat, sans arme', () => {
    const ent = entity({ ref: 'vermine-de-choc', appearance: undefined });
    const explo = entityRigProfileFor(ent, false)!;
    expect(armure(explo).length).toBeGreaterThan(0);
    expect(armure(explo)).toEqual(armure(enemyRigProfile(combatant(ent))));
    expect(explo.equip.weapons).toEqual([]);
  });
});

describe('#1882 T1 — les plages de `raceAppearance.json` sont keyées par les emplacements de palette', () => {
  const copie = () => JSON.parse(JSON.stringify(raceAppearanceJson)) as Record<string, unknown>[];
  const humain = (races: Record<string, unknown>[]) => races.find((r) => r.id === 'humain')!;
  it('la donnée réelle valide son schéma', () => {
    expect(raceSchema.safeParse(copie()).success).toBe(true);
  });
  it('une coquille de clé (`peua`) est REFUSÉE au parse', () => {
    const races = copie();
    humain(races).tirageIndividuel = { peua: ['#e8c3a0'] };
    const r = raceSchema.safeParse(races);
    expect(r.success).toBe(false);
  });
});
