import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  traceLayerLoad,
  takeCalqueEcarte,
  traceLayerSave,
  traceLayerDelete,
  panelExpandedLoad,
  panelExpandedSave,
  type TraceLayerRecord,
} from './traceLayer';
import { __setFabriqueIdbForTest } from '../lib/indexedDb';
import { brancherBasesSimulees, type BasesSimulees } from '../lib/indexedDb.testkit';
import { identityTransform } from './traceCalibration';
import { FORMAT_CALQUE } from './formats.generated';

const NOM = 'wfrp4-trace-layers';
let bases: BasesSimulees;

beforeEach(() => {
  bases = brancherBasesSimulees();
});
afterEach(() => __setFabriqueIdbForTest(null));

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

describe('traceLayer — l’enregistrement porte le format des calques (#2404)', () => {
  it('l’écriture stampe `FORMAT_CALQUE` ; la lecture rend le calque sans elle', async () => {
    await traceLayerSave(record('scene-1', 0));
    const [stocke] = [...bases.base(NOM).magasins.get('layers')!.contenu.values()];
    expect(stocke).toEqual({ ...record('scene-1', 0), version: FORMAT_CALQUE });
    expect(await traceLayerLoad('scene-1', 0)).toEqual(record('scene-1', 0));
  });

  it('un enregistrement d’un autre format est ÉCARTÉ et RETIRÉ', async () => {
    await traceLayerSave(record('scene-1', 0));
    const contenu = bases.base(NOM).magasins.get('layers')!.contenu;
    for (const [cle, v] of contenu) contenu.set(cle, { ...(v as object), version: 'autre-format' });
    expect(await traceLayerLoad('scene-1', 0)).toBeNull();
    expect(contenu.size).toBe(0);
    expect(takeCalqueEcarte('scene-1', 1)).toBe(false); // le témoin est keyé (scène, couche)
    expect(takeCalqueEcarte('scene-1', 0)).toBe(true);
    expect(takeCalqueEcarte('scene-1', 0)).toBe(false); // témoin à usage unique
  });

  it('un calque à le format courant ne pose aucun témoin', async () => {
    await traceLayerSave(record('scene-1', 0));
    expect(await traceLayerLoad('scene-1', 0)).not.toBeNull();
    expect(takeCalqueEcarte('scene-1', 0)).toBe(false);
  });
});

describe('panelExpanded — repli/dépli du panneau, PAR SCÈNE (survit à un changement de couche)', () => {
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

describe('`wfrp4-trace-layers` — déclarée, recréée si elle s’en écarte (#2404)', () => {
  it('une base où `layers` est keyé sceneId est recréée : calques et panneaux perdus, `layers` keyé (sceneId, z)', async () => {
    const ancienne = bases.amorcer(NOM, { layers: { keyPath: 'sceneId' }, panelExpanded: { keyPath: 'sceneId' } });
    ancienne.magasins.get('layers')!.contenu.set('scene-1', record('scene-1'));
    ancienne.magasins.get('panelExpanded')!.contenu.set('scene-1', { sceneId: 'scene-1', expanded: false });
    expect(await panelExpandedLoad('scene-1')).toBeNull();
    expect(await traceLayerLoad('scene-1', 0)).toBeNull();
    expect(bases.suppressions).toEqual([NOM]);
    expect(bases.base(NOM).magasins.get('layers')?.keyPath).toEqual(['sceneId', 'z']);
    expect(bases.base(NOM).magasins.get('panelExpanded')?.keyPath).toBe('sceneId');
  });

  it('une base neuve passe deux couches de la même scène, clé composite', async () => {
    const base = bases.base(NOM);
    await traceLayerSave(record('scene-1', 0));
    await traceLayerSave({ ...record('scene-1', 1), opacity: 0.3 });
    await panelExpandedSave('scene-1', false);
    expect((await traceLayerLoad('scene-1', 1))?.opacity).toBe(0.3);
    expect((await traceLayerLoad('scene-1', 0))?.opacity).toBe(0.6);
    expect(await panelExpandedLoad('scene-1')).toBe(false);
    expect(base.fermetures).toBe(base.ouvertures);
  });
});
