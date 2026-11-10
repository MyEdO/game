import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { emptyScene, type Scene } from './monde/scene';
import type { Terrain } from '../data/schemas/defs-scenes/scene';
import { type Dir8 } from '../geometry/dir8';
import { povStepDest } from './monde/exploreNav';
import { capDuGroupe, poserCapDuGroupe } from './monde/combatants';
import { createHero } from '../engine/character';

/**
 * POV (vue subjective) — MOVEMENT + STATE. `povStepDest` réutilise la connectivité 8-connexe UNIQUE
 * (`walkNeighbors`), et les actions du noyau (`pivoterLeGroupe`/`avancerDUnPas`) tournent le cap MONDE du
 * GROUPE (une entrée, `CAP_GROUPE`) puis passent par le PIPELINE de pas EXISTANT (`deplacerLeGroupe`). Aucun système de mouvement parallèle.
 */

/** Rend une case non-marchable (vide) sur z0. `emptyScene` remplit d'herbe marchable partout. */
function voidTile(s: Scene, w: number, x: number, y: number) {
  s.layers[0].tiles[y * w + x] = 'vide' as Terrain;
}

describe('povStepDest — cap MONDE → surface voisine connectée', () => {
  it("part vers l'EST (E) → (3,2)", () => {
    const s = emptyScene('scene-test', 5, 5);
    expect(povStepDest(s, { x: 2, y: 2 }, 'E')).toEqual({ x: 3, y: 2 });
  });

  it('part en diagonale NORD-EST (NE) → (3,1)', () => {
    const s = emptyScene('scene-test', 5, 5);
    expect(povStepDest(s, { x: 2, y: 2 }, 'NE')).toEqual({ x: 3, y: 1 });
  });

  it('direction vers le vide → null (aucune surface connectée dans ce sens)', () => {
    const s = emptyScene('scene-test', 5, 5);
    voidTile(s, 5, 3, 2); // case E de (2,2) vide → aucun voisin ne part vers l'est
    expect(povStepDest(s, { x: 2, y: 2 }, 'E')).toBeNull();
  });

  it('bord de carte → null (pas de voisin dans ce sens)', () => {
    const s = emptyScene('scene-test', 5, 5);
    expect(povStepDest(s, { x: 4, y: 4 }, 'SE')).toBeNull(); // coin SE : hors carte
  });
});

describe('store — actions POV (pivoterLeGroupe / avancerDUnPas)', () => {
  let banc: Banc;
  /** Groupe minimal + scène ouverte, meneur posé au centre, mode exploration. */
  function setup(facing: Dir8 = 'S') {
    const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 1 });
    banc.setState({
      screen: 'campaign',
      party: [hero],
      scene: emptyScene('scene-test', 7, 7),
      mode: 'exploration',
      partyPos: { x: 3, y: 3 },
      dialogue: null,
      battle: null,
      facing: poserCapDuGroupe({}, facing),
    });
    return hero.id;
  }

  beforeEach(() => {
    banc = ouvrirLeBanc();
    banc.setState({ dialogue: null, battle: null, mode: 'exploration' });
  });

  it('pivoterLeGroupe(1) fait avancer le regard de 45° (horaire) sans déplacer le groupe', () => {
    setup('N');
    const pos0 = banc.getState().partyPos;
    banc.getState().pivoterLeGroupe(1);
    expect(capDuGroupe(banc.getState())).toBe('NE'); // N +1 cran horaire
    expect(banc.getState().partyPos).toEqual(pos0); // aucun déplacement
  });

  it("pivoterLeGroupe(-1) fait reculer le regard de 45° (anti-horaire)", () => {
    setup('N');
    banc.getState().pivoterLeGroupe(-1);
    expect(capDuGroupe(banc.getState())).toBe('NO'); // N -1 cran anti-horaire
  });

  it("avancerDUnPas('avant') avance d'une case le long du regard ET garde le cap", () => {
    setup('E'); // regard EST
    banc.getState().avancerDUnPas('avant');
    expect(banc.getState().partyPos).toEqual({ x: 4, y: 3 }); // un pas à l'est
    expect(capDuGroupe(banc.getState())).toBe('E'); // cap conservé
  });

  it("avancerDUnPas('gauche') fait un pas de côté à 90° à gauche MAIS préserve le regard", () => {
    setup('E'); // regard EST → gauche relatif = NORD (E tourné de 6 crans = N)
    banc.getState().avancerDUnPas('gauche');
    expect(banc.getState().partyPos).toEqual({ x: 3, y: 2 }); // un pas au nord (y-1)
    expect(capDuGroupe(banc.getState())).toBe('E'); // regard INCHANGÉ (pas latéral)
  });

  it("avancerDUnPas('arriere') recule d'une case MAIS préserve le regard", () => {
    setup('E'); // dos = OUEST
    banc.getState().avancerDUnPas('arriere');
    expect(banc.getState().partyPos).toEqual({ x: 2, y: 3 }); // un pas à l'ouest (x-1)
    expect(capDuGroupe(banc.getState())).toBe('E'); // regard INCHANGÉ
  });

  it('no-op hors mode exploration (mode!==exploration)', () => {
    setup('E');
    banc.setState({ mode: 'battle' });
    const pos0 = banc.getState().partyPos;
    banc.getState().avancerDUnPas('avant');
    expect(banc.getState().partyPos).toEqual(pos0);
  });
});
