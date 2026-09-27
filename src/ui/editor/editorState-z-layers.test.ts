import { describe, it, expect } from 'vitest';
import { emptyScene, Scene } from '../../state/scene';
import {
  hitAt,
  resizeSel,
  eraseAt,
  addTrigger,
  addRestZone,
  addEffectZone,
  EFFECT_ZONE_SEEDS,
  addEnemyMember,
  placeEntity,
  pasteEntity,
  DEFAULT_LAYERS,
} from './editorState';

/**
 * #835 FU-3 (destructif) + FU-1 (surcouches d'annotation) — la racine mesurée : l'éditeur ne lisait/
 * écrivait le `z` que sur le terrain, jamais sur les entités/annotations. Preuve REJOUÉE : avant le
 * correctif, `hitAt(z=0)` attrapait une entité de z2 et `eraseAt(z=0)` la supprimait silencieusement.
 */
describe('#835 FU-3 — hitAt/eraseAt filtrent par couche (destructif avant correctif)', () => {
  function sceneAvecEntiteZ2(): Scene {
    const s = emptyScene(6, 6);
    s.entities = [{ id: 'perso-0', kind: 'personnage', ref: 'humain', pos: { x: 2, y: 2 }, z: 2 }];
    return s;
  }

  it('hitAt en z0 ne trouve PLUS une entité posée en z2', () => {
    const s = sceneAvecEntiteZ2();
    // Avant #835 : `hitAt` ignorait le z de l'entité — `scene.entities.find(pos.x===p.x && pos.y===p.y)`
    // l'aurait attrapée ici même en éditant la couche 0. Preuve que le filtre est RÉEL :
    expect(hitAt(s, { x: 2, y: 2 }, DEFAULT_LAYERS, 2)).toEqual({ type: 'entity', id: 'perso-0' });
    expect(hitAt(s, { x: 2, y: 2 }, DEFAULT_LAYERS, 0)).toBeNull();
  });

  it('eraseAt en z0 ne supprime PLUS une entité posée en z2 (perte de donnée silencieuse close)', () => {
    const s = sceneAvecEntiteZ2();
    const erased0 = eraseAt(s, { x: 2, y: 2 }, 0);
    expect(erased0.entities).toHaveLength(1); // toujours là : l'étage édité (0) n'est pas le sien (2)
    const erased2 = eraseAt(s, { x: 2, y: 2 }, 2);
    expect(erased2.entities).toHaveLength(0); // la bonne couche efface bien la bonne entité
  });

  it('addEnemyMember réutilise une entité déjà posée à (p,z) au lieu de la dupliquer', () => {
    const s = sceneAvecEntiteZ2();
    const r = addEnemyMember(s, 'enc-0', 'gobelin', { x: 2, y: 2 }, 2);
    expect(r.scene.entities).toHaveLength(1); // pas de doublon
    expect(r.entityId).toBe('perso-0');
    const r2 = addEnemyMember(s, 'enc-0', 'gobelin', { x: 2, y: 2 }, 0); // couche DIFFÉRENTE → pose neuve
    expect(r2.scene.entities).toHaveLength(2);
  });

  it('placeEntity + pasteEntity : coller reprend la couche ACTIVE, jamais le z SOURCE', () => {
    const s0 = emptyScene(6, 6);
    const placed = placeEntity(s0, { mode: 'entity', kind: 'prop', ref: 'tonneau' }, { x: 1, y: 1 }, 2); // posée en z2
    const source = placed.scene.entities[0];
    expect(source.z).toBe(2);
    const pastedSameLayer = pasteEntity(placed.scene, source, { x: 3, y: 3 }, 2);
    expect(pastedSameLayer.scene.entities.find((e) => e.id === pastedSameLayer.id)?.z).toBe(2);
    const pastedGroundLayer = pasteEntity(placed.scene, source, { x: 4, y: 4 }, 0); // couche active = 0
    expect(pastedGroundLayer.scene.entities.find((e) => e.id === pastedGroundLayer.id)?.z).toBeUndefined();
  });
});

describe('#835 FU-1 — trigger/repos/zone d\'effet portent leur z (écrits, filtrés, redimensionnables)', () => {
  it('addTrigger : z posé en z1 est écrit sur rect.z, invisible/non-sélectionnable en z0', () => {
    const s = addTrigger(emptyScene(6, 6), { x: 1, y: 1, w: 2, h: 2 }, 1).scene;
    expect(s.triggers[0].rect.z).toBe(1);
    expect(hitAt(s, { x: 1, y: 1 }, DEFAULT_LAYERS, 0)).toBeNull();
    expect(hitAt(s, { x: 1, y: 1 }, DEFAULT_LAYERS, 1)).toEqual({ type: 'trigger', id: s.triggers[0].id });
  });

  it('addTrigger : z=0 (défaut) omet le champ (convention canonique, comme WallSeg)', () => {
    const s = addTrigger(emptyScene(6, 6), { x: 1, y: 1, w: 1, h: 1 }).scene;
    expect(s.triggers[0].rect.z).toBeUndefined();
  });

  it('addTrigger : survit à un redimensionnement (resizeSel n\'écrase plus rect.z)', () => {
    const s0 = addTrigger(emptyScene(6, 6), { x: 1, y: 1, w: 2, h: 2 }, 1).scene;
    const sel = { type: 'trigger' as const, id: s0.triggers[0].id };
    const resized = resizeSel(s0, sel, { x: 4, y: 4 });
    expect(resized.triggers[0].rect).toMatchObject({ w: 4, h: 4, z: 1 });
  });

  it('addRestZone : z posé en z1 est écrit, invisible/non-sélectionnable en z0, survit au resize', () => {
    const s0 = addRestZone(emptyScene(6, 6), { x: 1, y: 1, w: 2, h: 2 }, 1).scene;
    expect(s0.restZones![0].rect.z).toBe(1);
    expect(hitAt(s0, { x: 1, y: 1 }, DEFAULT_LAYERS, 0)).toBeNull();
    expect(hitAt(s0, { x: 1, y: 1 }, { ...DEFAULT_LAYERS }, 1)).toEqual({ type: 'restZone', idx: 0 });
    const resized = resizeSel(s0, { type: 'restZone', idx: 0 }, { x: 4, y: 4 });
    expect(resized.restZones![0].rect).toMatchObject({ w: 4, h: 4, z: 1 });
  });

  it('addEffectZone : z posé en z1 est écrit (champ top-level, pas dans `area`), invisible en z0', () => {
    const s0 = addEffectZone(emptyScene(6, 6), { x: 1, y: 1, w: 2, h: 2 }, 1, EFFECT_ZONE_SEEDS.effect).scene;
    expect(s0.effectZones![0].z).toBe(1);
    expect(s0.effectZones![0].area).toEqual({ kind: 'rect', x: 1, y: 1, w: 2, h: 2 }); // z hors de `area`
    expect(hitAt(s0, { x: 1, y: 1 }, DEFAULT_LAYERS, 0)).toBeNull();
    expect(hitAt(s0, { x: 1, y: 1 }, DEFAULT_LAYERS, 1)).toEqual({ type: 'effectZone', idx: 0 });
  });
});
