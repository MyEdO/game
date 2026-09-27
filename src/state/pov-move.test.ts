import { describe, it, expect, beforeEach } from 'vitest';
import { emptyScene, type Scene, type Terrain } from './scene';
import { type Dir8 } from './dir8';
import { povStepDest } from './exploreNav';
import { useGame } from './store';
import { capDuGroupe, poserCapDuGroupe } from './combatants';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';

/**
 * POV (vue subjective) — MOVEMENT + STATE. `povStepDest` réutilise la connectivité 8-connexe UNIQUE
 * (`walkNeighbors`), et les actions du store (`pivotParty`/`stepPartyRelative`) tournent le cap MONDE du
 * GROUPE (une entrée, `CAP_GROUPE`) puis passent par le PIPELINE de pas EXISTANT (`moveParty`). Aucun système de mouvement parallèle.
 */

/** Rend une case non-marchable (vide) sur z0. `emptyScene` remplit d'herbe marchable partout. */
function voidTile(s: Scene, w: number, x: number, y: number) {
  s.layers[0].tiles[y * w + x] = 'vide' as Terrain;
}

describe('povStepDest — cap MONDE → surface voisine connectée', () => {
  it("part vers l'EST (E) → (3,2)", () => {
    const s = emptyScene(5, 5);
    expect(povStepDest(s, { x: 2, y: 2 }, 'E')).toEqual({ x: 3, y: 2 });
  });

  it('part en diagonale NORD-EST (NE) → (3,1)', () => {
    const s = emptyScene(5, 5);
    expect(povStepDest(s, { x: 2, y: 2 }, 'NE')).toEqual({ x: 3, y: 1 });
  });

  it('direction vers le vide → null (aucune surface connectée dans ce sens)', () => {
    const s = emptyScene(5, 5);
    voidTile(s, 5, 3, 2); // case E de (2,2) vide → aucun voisin ne part vers l'est
    expect(povStepDest(s, { x: 2, y: 2 }, 'E')).toBeNull();
  });

  it('bord de carte → null (pas de voisin dans ce sens)', () => {
    const s = emptyScene(5, 5);
    expect(povStepDest(s, { x: 4, y: 4 }, 'SE')).toBeNull(); // coin SE : hors carte
  });
});

describe('store — actions POV (pivotParty / stepPartyRelative)', () => {
  /** Groupe minimal + scène ouverte, meneur posé au centre, mode exploration. */
  function setup(facing: Dir8 = 'S') {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', rng: makeRNG(1) });
    useGame.setState({
      screen: 'campaign',
      party: [hero],
      scene: emptyScene(7, 7),
      mode: 'exploration',
      partyPos: { x: 3, y: 3 },
      dialogue: null,
      battle: null,
      facing: poserCapDuGroupe({}, facing),
      povActive: true,
    });
    return hero.id;
  }

  beforeEach(() => {
    useGame.setState({ dialogue: null, battle: null, mode: 'exploration' });
  });

  it("povActive : défaut false, togglePov le bascule", () => {
    useGame.setState({ povActive: false });
    useGame.getState().togglePov();
    expect(useGame.getState().povActive).toBe(true);
    useGame.getState().togglePov();
    expect(useGame.getState().povActive).toBe(false);
  });

  it('pivotParty(1) fait avancer le regard de 45° (horaire) sans déplacer le groupe', () => {
    setup('N');
    const pos0 = useGame.getState().partyPos;
    useGame.getState().pivotParty(1);
    expect(capDuGroupe(useGame.getState())).toBe('NE'); // N +1 cran horaire
    expect(useGame.getState().partyPos).toEqual(pos0); // aucun déplacement
  });

  it("pivotParty(-1) fait reculer le regard de 45° (anti-horaire)", () => {
    setup('N');
    useGame.getState().pivotParty(-1);
    expect(capDuGroupe(useGame.getState())).toBe('NO'); // N -1 cran anti-horaire
  });

  it("stepPartyRelative('forward') avance d'une case le long du regard ET garde le cap", () => {
    setup('E'); // regard EST
    useGame.getState().stepPartyRelative('forward');
    expect(useGame.getState().partyPos).toEqual({ x: 4, y: 3 }); // un pas à l'est
    expect(capDuGroupe(useGame.getState())).toBe('E'); // cap conservé
  });

  it("stepPartyRelative('left') fait un pas de côté à 90° à gauche MAIS préserve le regard", () => {
    setup('E'); // regard EST → gauche relatif = NORD (E tourné de 6 crans = N)
    useGame.getState().stepPartyRelative('left');
    expect(useGame.getState().partyPos).toEqual({ x: 3, y: 2 }); // un pas au nord (y-1)
    expect(capDuGroupe(useGame.getState())).toBe('E'); // regard INCHANGÉ (pas latéral)
  });

  it("stepPartyRelative('back') recule d'une case MAIS préserve le regard", () => {
    setup('E'); // dos = OUEST
    useGame.getState().stepPartyRelative('back');
    expect(useGame.getState().partyPos).toEqual({ x: 2, y: 3 }); // un pas à l'ouest (x-1)
    expect(capDuGroupe(useGame.getState())).toBe('E'); // regard INCHANGÉ
  });

  it('no-op hors mode exploration (mode!==exploration)', () => {
    setup('E');
    useGame.setState({ mode: 'battle' });
    const pos0 = useGame.getState().partyPos;
    useGame.getState().stepPartyRelative('forward');
    expect(useGame.getState().partyPos).toEqual(pos0);
  });
});
