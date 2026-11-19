/**
 * ENTRÉE EN SCÈNE (#2817 D5) : le noyau émet `EVT.ARRIVEE_EN_SCENE` à chaque scène où le groupe entre, `neuve` pour
 * une partie neuve (`lancerLaScene`), non neuve pour un changement de scène (`quitterLaScene`), le point de reprise de
 * l'hôte (`refusDeSauvegarde`).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { bus, EVT } from './bus';
import { emptyScene, type Scene } from './monde/scene';
import { CAP_GROUPE } from './monde/combatants';

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
    expect(arrivees(() => banc.getState().lancerLaScene(scene('entree-a')))).toEqual([{ sceneId: 'entree-a', neuve: true }]);
  });

  it('un changement de scène émet UNE entrée NON neuve sur la scène d’arrivée', () => {
    banc.getState().chargerLeProjet({ scenes: [scene('entree-a'), scene('entree-b')], entryId: 'entree-a', projet: null });
    expect(arrivees(() => banc.getState().quitterLaScene('entree-b'))).toEqual([{ sceneId: 'entree-b', neuve: false }]);
  });
});

describe('entrée en scène — le meneur regarde le centre de la zone jouable (#4392)', () => {
  const col = (id: string): Scene => ({
    ...emptyScene(id, 21, 20), id, label: id, zoneJouable: { x: 14, y: 15, w: 5, h: 5 },
    entities: [{ id: `depart-${id}`, kind: 'heroStart', pos: { x: 14, y: 19 } }],
    entryPoints: { quai: { x: 14, y: 19 } },
  });

  it('une partie neuve et un changement de scène orientent le groupe vers la zone, pas vers le centre de la grille', () => {
    banc.getState().lancerLaScene(col('col-a'));
    expect(banc.getState().facing[CAP_GROUPE]).toBe('NE');
    banc.getState().chargerLeProjet({ scenes: [col('col-a'), col('col-b')], entryId: 'col-a', projet: null });
    banc.getState().quitterLaScene('col-b');
    expect(banc.getState().facing[CAP_GROUPE]).toBe('NE');
  });
});
