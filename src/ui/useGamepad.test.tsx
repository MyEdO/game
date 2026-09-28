// @vitest-environment jsdom
/**
 * MANETTE — la boucle de lecture (`useGamepad`) dispatche les MÊMES intentions que le clavier, y
 * compris LA FIN des gestes maintenus : sans front descendant, une direction poussée puis relâchée
 * laisserait la marche du groupe (et la rotation caméra sous LT/RT) courir toute seule.
 * Pad simulé par `navigator.getGamepads` et boucle de frames pilotée à la main.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { emptyScene } from '../state/scene';
import { STEP_MS } from '../geometry/walk';
import { resetStageWalk } from '../state/stageWalk';
import { getStageYaw, resetStageYaw } from '../state/stageYaw';
import { useGamepad, padButton } from './useGamepad';

const DPAD = { up: 12, down: 13, left: 14, right: 15 } as const;
const BOUTON = { LB: 4, RB: 5, LT: 6, RT: 7 } as const;

/** Pad « standard » dont l'état est piloté par le test. */
function padSimule() {
  const boutons = new Array(17).fill(false) as boolean[];
  const pad = {
    get buttons() { return boutons.map((pressed) => ({ pressed })); },
    axes: [0, 0, 0, 0],
  };
  (navigator as unknown as { getGamepads: () => unknown[] }).getGamepads = () => [pad];
  return {
    presser: (i: number) => { boutons[i] = true; },
    relacher: (i: number) => { boutons[i] = false; },
  };
}

/** Spy `performance.now` du test EN COURS — restauré par son propre `afterEach` (jamais un autre test). */
let perfNowSpy: ReturnType<typeof vi.spyOn> | null = null;

/** Joue `n` frames de la boucle du hook (rAF stubé) en avançant l'horloge de `dt`. */
function harnaisFrames() {
  let enAttente: FrameRequestCallback[] = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { enAttente.push(cb); return 1; });
  vi.stubGlobal('cancelAnimationFrame', () => {});
  let horloge = 0;
  // La boucle date ses répétitions à `performance.now()` : sans horloge qui avance, le pad ne répèterait
  // JAMAIS sa direction et le harnais mesurerait un maintien qui n'existe pas.
  perfNowSpy = vi.spyOn(performance, 'now').mockImplementation(() => horloge);
  return {
    jouer(n: number, dt = 16) {
      for (let i = 0; i < n; i++) {
        horloge += dt;
        vi.setSystemTime(horloge);
        const cbs = enAttente;
        enAttente = [];
        act(() => { cbs.forEach((cb) => cb(horloge)); vi.advanceTimersByTime(dt); });
      }
    },
  };
}

function Harness() {
  useGamepad();
  return null;
}

describe('manette — gestes MAINTENUS armés ET relâchés par la boucle', () => {
  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });
  let host: HTMLDivElement;
  let root: Root;
  let pad: ReturnType<typeof padSimule>;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    resetStageWalk();
    resetStageYaw();
    pad = padSimule();
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    const sc = emptyScene(12, 12);
    sc.id = 'pad-marche';
    sc.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 6, y: 6 } });
    useGame.getState().startScene(sc);
    useGame.setState({
      screen: 'campaign', mode: 'exploration', partyPos: { x: 6, y: 6 },
      camRot: 0, camEdge: false, viewMode: undefined, povActive: false,
      dialogue: null, gameMenuOpen: false, merchant: null, worldMapOpen: false, battle: null, pendingLoot: null,
    } as never);
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
    perfNowSpy?.mockRestore();
    perfNowSpy = null;
    resetStageWalk();
    resetStageYaw();
    vi.useRealTimers();
  });

  /** Monte le hook avec le pad DÉJÀ branché (la boucle démarre au montage). */
  const monter = () => {
    const h = harnaisFrames();
    act(() => root.render(<Harness />));
    return h;
  };

  it('croix TENUE : la marche est cadencée par le glissement, pas par l’auto-repeat du pad', () => {
    const h = monter();
    pad.presser(DPAD.up);
    h.jouer(1); // 1ᵉʳ pas immédiat
    const apres1 = { ...useGame.getState().partyPos };
    expect(apres1).not.toEqual({ x: 6, y: 6 });
    h.jouer(Math.floor(STEP_MS / 16) - 2); // moins d'un glissement : rien de plus, malgré 8 répétitions du pad
    expect(useGame.getState().partyPos, 'le pad a commis des pas au rythme de SA répétition').toEqual(apres1);
    h.jouer(3);
    expect(useGame.getState().partyPos, 'à la fin du glissement, le pas suivant part').not.toEqual(apres1);
  });

  it('croix RELÂCHÉE : la marche s’arrête (le front descendant est bien dispatché)', () => {
    const h = monter();
    pad.presser(DPAD.up);
    h.jouer(2);
    pad.relacher(DPAD.up);
    h.jouer(2);
    const arret = { ...useGame.getState().partyPos };
    h.jouer(Math.ceil((STEP_MS * 4) / 16));
    expect(useGame.getState().partyPos, 'stick relâché, le groupe marche encore').toEqual(arret);
  });

  it('LT tenu puis RELÂCHÉ : la caméra s’arrête (sans front descendant, elle tournait sans fin)', () => {
    const h = monter();
    pad.presser(BOUTON.LT);
    h.jouer(Math.ceil(400 / 16)); // au-delà du seuil de maintien : le lacet continu court
    const enVol = getStageYaw();
    pad.relacher(BOUTON.LT);
    h.jouer(2);
    const aLArret = getStageYaw();
    h.jouer(Math.ceil(400 / 16));
    expect(getStageYaw(), 'la caméra tourne encore après le relâchement de LT').toBe(aLArret);
    expect(Math.abs(aLArret)).toBeGreaterThan(Math.abs(enVol) - 1); // témoin : elle avait bien tourné
  });

  it('fenêtre fermée, stick TOUJOURS poussé : la marche ne repart pas seule (même loi qu’au clavier)', () => {
    const h = monter();
    pad.presser(DPAD.up);
    h.jouer(2);
    useGame.setState({ pendingLoot: { title: 'x', gear: [] } } as never); // une porte s'ouvre
    h.jouer(Math.ceil((STEP_MS * 2) / 16));
    useGame.setState({ pendingLoot: null } as never); // elle se referme, le stick n'a pas bougé
    const arret = { ...useGame.getState().partyPos };
    h.jouer(Math.ceil((STEP_MS * 3) / 16));
    expect(useGame.getState().partyPos, 'la manette a redémarré la marche sans nouveau front').toEqual(arret);
    pad.relacher(DPAD.up);
    h.jouer(2);
    pad.presser(DPAD.up); // vrai nouveau front
    h.jouer(2);
    expect(useGame.getState().partyPos, 'après un vrai front, la marche doit repartir').not.toEqual(arret);
  });
});

/**
 * GESTE SECONDAIRE À LA MANETTE (#1411 P2-B) — l'alvéole focalisée de la console écoute
 * `contextmenu` (clic droit, touche Menu) : RB, qui n'a AUCUN geste en contexte menu, y émet
 * exactement cet événement. Aucun chemin parallèle, et rien de volé — A reste le geste primaire.
 */
describe('manette — RB en contexte MENU = geste secondaire de l’alvéole focalisée', () => {
  let pont: HTMLDivElement;
  let bouton: HTMLButtonElement;
  beforeEach(() => {
    pont = document.createElement('div');
    pont.className = 'combat-console';
    bouton = document.createElement('button');
    pont.appendChild(bouton);
    document.body.appendChild(pont);
  });
  afterEach(() => { pont.remove(); });

  it('RB émet `contextmenu` sur l’alvéole qui a le focus', () => {
    bouton.focus();
    const vus: string[] = [];
    bouton.addEventListener('contextmenu', () => vus.push('contextmenu'));
    padButton('RB');
    expect(vus, 'RB doit prendre le MÊME chemin que le clic droit').toEqual(['contextmenu']);
  });

  it('hors console (contexte CARTE), RB ne l’émet pas : il reste la cible suivante', () => {
    bouton.blur();
    const vus: string[] = [];
    bouton.addEventListener('contextmenu', () => vus.push('contextmenu'));
    padButton('RB');
    expect(vus, 'aucun focus dans la console : RB pilote la carte').toEqual([]);
  });
});
