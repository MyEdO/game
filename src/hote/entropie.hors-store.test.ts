import { describe, it, expect } from 'vitest';
import { idDEntropie } from './entropie';
import { emptyScene } from '../noyau/monde/scene';
import { emptyWorldMap } from '../noyau/worldMap';

/** Deux « Nouveau projet » (`Editor.tsx`, `resetScene`), chacun avec son « Ajouter une scène » et sa carte
 *  neuve (`WorldMapEditor.tsx`) : l'id de scène est la clé SEULE de l'autosave (`editorAutosave.ts`, keyPath
 *  `sceneId`), il ne se répète d'aucun projet à l'autre (#2817). */
describe('idDEntropie — un id d’hôte unique d’un projet à l’autre (#2817)', () => {
  const projet = () => ({
    scenes: [emptyScene(idDEntropie('scene')), emptyScene(idDEntropie('scene'))],
    carte: emptyWorldMap(idDEntropie('carte')),
  });

  it('deux projets créés à la suite ne partagent aucun id de scène ni de carte', () => {
    const a = projet();
    const b = projet();
    const ids = [...a.scenes, ...b.scenes].map((s) => s.id).concat(a.carte.id, b.carte.id);
    expect(new Set(ids).size, ids.join(' ')).toBe(ids.length);
  });

  it('l’id porte son genre en tête', () => {
    expect(idDEntropie('scene')).toMatch(/^scene-[0-9a-z]+-[0-9a-z]{6}$/);
  });
});
