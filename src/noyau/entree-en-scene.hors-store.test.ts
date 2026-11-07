/**
 * ENTRÉE EN SCÈNE (#2817 D5) : le noyau émet `EVT.ARRIVEE_EN_SCENE` à chaque scène où le groupe entre, `neuve` pour
 * une partie neuve (`startScene`), non neuve pour un changement de scène (`transitionTo`), le point de reprise de
 * l'hôte (`refusDeSauvegarde`).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { bus, EVT } from './bus';
import { emptyScene, type Scene } from './monde/scene';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const scene = (id: string): Scene => ({
  ...emptyScene('scene-test', 6, 6),
  id,
  label: id,
  entities: [{ id: `depart-${id}`, kind: 'heroStart', pos: { x: 1, y: 1 } }],
});

/** Les entrées en scène émises pendant `corps`. */
function arrivees(corps: () => void): { sceneId: string; neuve: boolean }[] {
  const vues: { sceneId: string; neuve: boolean }[] = [];
  const off = bus.on(EVT.ARRIVEE_EN_SCENE, (p: { sceneId: string; neuve: boolean }) => { vues.push(p); });
  try {
    corps();
  } finally {
    off();
  }
  return vues;
}

describe('entrée en scène — l’événement que l’hôte consomme (#2817 D5)', () => {
  it('une partie neuve émet UNE entrée `neuve` sur sa scène', () => {
    expect(arrivees(() => banc.getState().startScene(scene('entree-a')))).toEqual([{ sceneId: 'entree-a', neuve: true }]);
  });

  it('un changement de scène émet UNE entrée NON neuve sur la scène d’arrivée', () => {
    banc.getState().loadProject({ scenes: [scene('entree-a'), scene('entree-b')], entryId: 'entree-a', projet: null });
    expect(arrivees(() => banc.getState().transitionTo('entree-b'))).toEqual([{ sceneId: 'entree-b', neuve: false }]);
  });
});
