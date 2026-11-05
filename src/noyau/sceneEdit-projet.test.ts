/**
 * Les SCÈNES DU PROJET au noyau (#3059, A7) : ajouter, dupliquer, supprimer et basculer la scène éditée,
 * dans l'ordre du document. L'id neuf vient de l'hôte.
 */
import { describe, expect, it } from 'vitest';
import { emptyScene, type Scene } from './monde/scene';
import { addProjectScene, deleteProjectScene, duplicateProjectScene, switchProjectScene, type ProjectScenes } from './sceneEdit';

const sc = (id: string): Scene => ({ ...emptyScene(id, 4, 4), label: id.toUpperCase() });
const ids = (p: ProjectScenes | null) => p && { avant: p.avant.map((s) => s.id), scene: p.scene.id, apres: p.apres.map((s) => s.id) };
const projet = (): ProjectScenes => ({ avant: [sc('a')], scene: sc('b'), apres: [sc('c')] });

describe('scènes du projet', () => {
  it('ajouter pose une scène vide de l’id donné en fin de projet, et l’édite', () => {
    const out = addProjectScene(projet(), 'neuve');
    expect(ids(out)).toEqual({ avant: ['a', 'b', 'c'], scene: 'neuve', apres: [] });
    expect(out.scene.label).toBe('Nouvelle scène');
  });

  it('dupliquer copie la scène éditée sous l’id donné, en fin de projet, sans partager l’original', () => {
    const p = projet();
    const out = duplicateProjectScene(p, 'copie');
    expect(ids(out)).toEqual({ avant: ['a', 'b', 'c'], scene: 'copie', apres: [] });
    expect(out.scene.label).toBe('B (copie)');
    expect(out.scene.layers).toEqual(p.scene.layers);
    expect(out.scene.layers).not.toBe(p.scene.layers);
  });

  it('supprimer édite la suivante, sinon la précédente ; la seule scène ne se supprime pas', () => {
    expect(ids(deleteProjectScene(projet()))).toEqual({ avant: ['a'], scene: 'c', apres: [] });
    expect(ids(deleteProjectScene({ avant: [sc('a'), sc('b')], scene: sc('c'), apres: [] }))).toEqual({ avant: ['a'], scene: 'b', apres: [] });
    expect(deleteProjectScene({ avant: [], scene: sc('seule'), apres: [] })).toBeNull();
  });

  it('basculer édite la scène nommée à sa place ; la scène éditée ou un id absent ne basculent rien', () => {
    expect(ids(switchProjectScene(projet(), 'c'))).toEqual({ avant: ['a', 'b'], scene: 'c', apres: [] });
    expect(ids(switchProjectScene(projet(), 'a'))).toEqual({ avant: [], scene: 'a', apres: ['b', 'c'] });
    expect(switchProjectScene(projet(), 'b')).toBeNull();
    expect(switchProjectScene(projet(), 'absente')).toBeNull();
  });
});
