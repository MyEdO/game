import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  traceLayerLoad,
  traceLayerSave,
  traceLayerDelete,
  panelExpandedLoad,
  panelExpandedSave,
  __resetTraceLayerForTest,
  type TraceLayerRecord,
  MIGRATIONS_CALQUES,
} from './traceLayer';
import { __setOuvertureIdbForTest, migrerBase } from '../lib/indexedDb';
import { baseSimulee, brancherBasesSimulees, type BasesSimulees } from '../lib/indexedDb.testkit';
import { identityTransform } from './traceCalibration';

const NOM = 'wfrp4-trace-layers';
let bases: BasesSimulees;

beforeEach(() => {
  bases = brancherBasesSimulees();
});
afterEach(() => __setOuvertureIdbForTest(null));

const record = (sceneId: string, z = 0): TraceLayerRecord => ({
  sceneId,
  z,
  imageDataUrl: 'data:image/png;base64,AAAA',
  naturalWidth: 800,
  naturalHeight: 600,
  opacity: 0.6,
  visible: true,
  position: 'above',
  allowRotation: false,
  contraste: false,
  transform: identityTransform(),
  savedAt: 1000,
});

describe('traceLayer — persistance PAR (SCÈNE, COUCHE) du calque de référence', () => {
  beforeEach(async () => {
    await __resetTraceLayerForTest();
  });

  it('charge null pour une (scène, couche) sans calque enregistré', async () => {
    expect(await traceLayerLoad('scene-1', 0)).toBeNull();
  });

  it('sauvegarde puis recharge le même calque, keyé par (id de scène, couche)', async () => {
    await traceLayerSave(record('scene-1', 0));
    const loaded = await traceLayerLoad('scene-1', 0);
    expect(loaded).toEqual(record('scene-1', 0));
    expect(await traceLayerLoad('scene-2', 0)).toBeNull(); // une autre scène n'est pas affectée
  });

  it('deux COUCHES de la MÊME scène sont des calques INDÉPENDANTS (retour user : un plan par étage)', async () => {
    await traceLayerSave(record('scene-1', 0));
    await traceLayerSave({ ...record('scene-1', 1), imageDataUrl: 'data:image/png;base64,BBBB', opacity: 0.3 });
    const z0 = await traceLayerLoad('scene-1', 0);
    const z1 = await traceLayerLoad('scene-1', 1);
    expect(z0?.imageDataUrl).toBe('data:image/png;base64,AAAA');
    expect(z0?.opacity).toBe(0.6);
    expect(z1?.imageDataUrl).toBe('data:image/png;base64,BBBB');
    expect(z1?.opacity).toBe(0.3);
  });

  it('le CONTRASTE DE CALAGE persiste comme un réglage à part entière, par (scène, couche)', async () => {
    await traceLayerSave({ ...record('scene-1', 0), contraste: true });
    await traceLayerSave(record('scene-1', 1));
    expect((await traceLayerLoad('scene-1', 0))?.contraste).toBe(true);
    expect((await traceLayerLoad('scene-1', 1))?.contraste).toBe(false);
    await traceLayerSave({ ...record('scene-1', 0), contraste: false, savedAt: 2000 });
    expect((await traceLayerLoad('scene-1', 0))?.contraste).toBe(false);
  });

  it('un ré-enregistrement écrase la version précédente de la MÊME (scène, couche) seulement', async () => {
    await traceLayerSave(record('scene-1', 0));
    await traceLayerSave(record('scene-1', 1));
    await traceLayerSave({ ...record('scene-1', 0), opacity: 0.2, savedAt: 2000 });
    expect((await traceLayerLoad('scene-1', 0))?.opacity).toBe(0.2);
    expect((await traceLayerLoad('scene-1', 1))?.opacity).toBe(0.6); // couche 1 intacte
  });

  it('la suppression ne retire que le calque de cette (scène, couche)', async () => {
    await traceLayerSave(record('scene-1', 0));
    await traceLayerSave(record('scene-1', 1));
    await traceLayerDelete('scene-1', 0);
    expect(await traceLayerLoad('scene-1', 0)).toBeNull();
    expect(await traceLayerLoad('scene-1', 1)).not.toBeNull();
  });

  it('une écriture qui rejette ne lève JAMAIS (best-effort — l’éditeur ne doit pas planter)', async () => {
    bases.base(NOM).panne = (q) => (q.geste === 'get' ? null : new DOMException(`${q.geste} refusé`, 'QuotaExceededError'));
    await expect(traceLayerSave(record('scene-1'))).resolves.toBeUndefined();
    await expect(traceLayerDelete('scene-1', 0)).resolves.toBeUndefined();
    await expect(panelExpandedSave('scene-1', false)).resolves.toBeUndefined();
  });
});

describe('panelExpanded — repli/dépli du panneau, PAR SCÈNE (survit à un changement de couche)', () => {
  beforeEach(async () => {
    await __resetTraceLayerForTest();
  });

  it('vaut null (jamais réglé) tant que rien n’a été sauvegardé — l’appelant applique son défaut', async () => {
    expect(await panelExpandedLoad('scene-1')).toBeNull();
  });

  it('sauvegarde puis recharge l’état, indépendamment de toute couche', async () => {
    await panelExpandedSave('scene-1', false);
    expect(await panelExpandedLoad('scene-1')).toBe(false);
    await traceLayerSave(record('scene-1', 5)); // charger un calque sur une autre couche ne doit rien changer
    expect(await panelExpandedLoad('scene-1')).toBe(false);
  });

  it('une autre scène n’est pas affectée', async () => {
    await panelExpandedSave('scene-1', false);
    expect(await panelExpandedLoad('scene-2')).toBeNull();
  });
});

describe('MIGRATIONS_CALQUES — migration de `wfrp4-trace-layers` vers v2 (#830)', () => {
  it('base neuve (v0) : crée `layers` keyé (sceneId, z) et `panelExpanded` keyé sceneId', () => {
    const base = baseSimulee();
    migrerBase(MIGRATIONS_CALQUES, base.db, 0);
    expect(base.magasins.get('layers')?.keyPath).toEqual(['sceneId', 'z']);
    expect(base.magasins.get('panelExpanded')?.keyPath).toBe('sceneId');
  });

  it('v1 → v2 : `layers` (keyé sceneId) est RECRÉÉ keyé (sceneId, z), `panelExpanded` garde son contenu', () => {
    const base = baseSimulee({ layers: { keyPath: 'sceneId' }, panelExpanded: { keyPath: 'sceneId' } });
    base.magasins.get('layers')!.contenu.set('scene-1', record('scene-1'));
    base.magasins.get('panelExpanded')!.contenu.set('scene-1', { sceneId: 'scene-1', expanded: false });
    migrerBase(MIGRATIONS_CALQUES, base.db, 1);
    expect(base.magasins.get('layers')?.keyPath).toEqual(['sceneId', 'z']);
    expect(base.magasins.get('layers')?.contenu.size).toBe(0);
    expect(base.magasins.get('panelExpanded')?.contenu.size).toBe(1);
  });

  it('v1 sans `panelExpanded` → v2 : le magasin du panneau est créé', () => {
    const base = baseSimulee({ layers: { keyPath: 'sceneId' } });
    migrerBase(MIGRATIONS_CALQUES, base.db, 1);
    expect(base.magasins.get('panelExpanded')?.keyPath).toBe('sceneId');
  });

  it('une base v1 ouverte monte en v2 : le panneau garde son contenu, les calques repartent keyés (sceneId, z)', async () => {
    const v1 = bases.amorcer(NOM, 1, { layers: { keyPath: 'sceneId' }, panelExpanded: { keyPath: 'sceneId' } });
    v1.magasins.get('layers')!.contenu.set('scene-1', record('scene-1'));
    v1.magasins.get('panelExpanded')!.contenu.set('scene-1', { sceneId: 'scene-1', expanded: false });
    expect(await panelExpandedLoad('scene-1')).toBe(false);
    expect(await traceLayerLoad('scene-1', 0)).toBeNull();
    expect(v1.magasins.get('layers')?.keyPath).toEqual(['sceneId', 'z']);
  });

  it('une base neuve passe deux couches de la même scène, clé composite', async () => {
    const base = bases.base(NOM);
    await traceLayerSave(record('scene-1', 0));
    await traceLayerSave({ ...record('scene-1', 1), opacity: 0.3 });
    await panelExpandedSave('scene-1', false);
    expect((await traceLayerLoad('scene-1', 1))?.opacity).toBe(0.3);
    expect((await traceLayerLoad('scene-1', 0))?.opacity).toBe(0.6);
    expect(await panelExpandedLoad('scene-1')).toBe(false);
    expect(base.fermetures).toBe(base.transactions.length);
  });
});
