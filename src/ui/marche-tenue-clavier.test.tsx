// @vitest-environment jsdom
/**
 * CÂBLAGE CLAVIER de la marche tenue : ce que le jeu commet quand la touche RESTE enfoncée. La
 * répétition automatique de l'OS n'est PAS une cadence de jeu — c'est l'ÉTAT de la touche qui compte
 * (enfoncée/relâchée), et le rythme est celui du glissement (`stageWalk`). Mesuré sur le vrai hook et
 * de vrais `KeyboardEvent`, jusqu'au `partyPos` du store.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { capDuGroupe, poserCapDuGroupe } from '../state/combatants';
import { emptyScene } from '../state/scene';
import { STEP_MS } from '../geometry/walk';
import { resetStageWalk } from '../state/stageWalk';
import { useGameKeyboard } from './useGameKeyboard';

function Harness() {
  useGameKeyboard();
  return null;
}

const frapper = (type: 'keydown' | 'keyup', code: string, repeat = false) =>
  act(() => { window.dispatchEvent(new KeyboardEvent(type, { code, repeat, bubbles: true, cancelable: true })); });

/** Cases COMMISES depuis l'abonnement (une entrée par arrivée). */
function traceur() {
  const cases: { x: number; y: number }[] = [];
  const off = useGame.subscribe((s, prev) => {
    if (s.partyPos !== prev.partyPos) cases.push({ x: s.partyPos.x, y: s.partyPos.y });
  });
  return { cases, off };
}

describe('touche TENUE — l’auto-repeat de l’OS ne commet pas de pas', () => {
  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    vi.useFakeTimers();
    resetStageWalk();
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    const sc = emptyScene(12, 12);
    sc.id = 'marche-clavier';
    sc.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 6, y: 6 } });
    useGame.getState().startScene(sc);
    useGame.setState({
      screen: 'campaign', mode: 'exploration', partyPos: { x: 6, y: 6 },
      camRot: 0, camEdge: false, viewMode: undefined, povActive: false,
      dialogue: null, gameMenuOpen: false, merchant: null, worldMapOpen: false, battle: null,
    } as never);
    act(() => root.render(<Harness />));
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    resetStageWalk();
    vi.useRealTimers();
  });

  it('enfoncement + CENT répétitions automatiques = UN seul pas tant que le glissement dure', () => {
    const t = traceur();
    frapper('keydown', 'KeyW');
    for (let i = 0; i < 100; i++) frapper('keydown', 'KeyW', true);
    t.off();
    expect(t.cases.length, 'la marche suit la répétition de l’OS au lieu de la durée du pas').toBe(1);
  });

  it('la touche tenue enchaîne UN pas par glissement, et le relâchement l’arrête sur sa case', () => {
    const t = traceur();
    frapper('keydown', 'KeyW');
    for (let i = 0; i < 20; i++) frapper('keydown', 'KeyW', true); // l'OS répète pendant tout le maintien
    act(() => { vi.advanceTimersByTime(STEP_MS * 3); });
    expect(t.cases.length, 'trois glissements de plus = trois cases de plus').toBe(4);
    frapper('keyup', 'KeyW');
    const arret = { ...useGame.getState().partyPos };
    act(() => { vi.advanceTimersByTime(STEP_MS * 6); });
    t.off();
    expect(t.cases.length, 'relâché, la marche continue toute seule').toBe(4);
    expect(useGame.getState().partyPos, 'arrêt sur une case entière, sans dérive').toEqual(arret);
  });

  it('W tenu, D pressé puis LÂCHÉ : la marche REPREND vers W (les deux touches sont tenues)', () => {
    const pas = (): { x: number; y: number } => {
      const avant = { ...useGame.getState().partyPos };
      act(() => { vi.advanceTimersByTime(STEP_MS); });
      const apres = useGame.getState().partyPos;
      return { x: apres.x - avant.x, y: apres.y - avant.y };
    };
    frapper('keydown', 'KeyW');
    const versW = pas();
    frapper('keydown', 'KeyD');
    expect(pas(), 'la touche pressée en dernier gagne').not.toEqual(versW);
    frapper('keyup', 'KeyD');
    expect(pas(), 'lâcher D doit rendre la marche à W, toujours enfoncée').toEqual(versW);
    frapper('keyup', 'KeyW');
    const arret = { ...useGame.getState().partyPos };
    act(() => { vi.advanceTimersByTime(STEP_MS * 4); });
    expect(useGame.getState().partyPos, 'plus aucune touche tenue : arrêt').toEqual(arret);
  });

  it('TAP bref (40 ms) : EXACTEMENT un pas — même si une répétition de l’OS traîne après le relâchement', () => {
    const t = traceur();
    frapper('keydown', 'KeyW');
    act(() => { vi.advanceTimersByTime(40); });
    frapper('keyup', 'KeyW');
    frapper('keydown', 'KeyW', true); // répétition livrée EN RETARD, après le relâchement
    act(() => { vi.advanceTimersByTime(STEP_MS * 4) });
    t.off();
    expect(t.cases.length, 'un tap bref a commis deux cases').toBe(1);
  });

  it('AMORÇAGE : après un relâchement, une NOUVELLE pression repart tout de suite (pas d’attente d’une seconde)', () => {
    frapper('keydown', 'KeyW');
    act(() => { vi.advanceTimersByTime(40); });
    frapper('keyup', 'KeyW');
    act(() => { vi.advanceTimersByTime(STEP_MS * 2) }); // le glissement du 1ᵉʳ pas est fini
    const avant = { ...useGame.getState().partyPos };
    frapper('keydown', 'KeyW');
    expect(useGame.getState().partyPos, 'la nouvelle pression doit commettre SANS attendre').not.toEqual(avant);
  });

  it('PIVOT du regard (POV) : cent répétitions de l’OS ne font QU’UN quart de tour', () => {
    useGame.setState({
      povActive: true,
      party: [{ id: 'lead', label: 'L', dead: false, wounds: { current: 10, max: 10 }, conditions: [] }],
      facing: poserCapDuGroupe({}, 'S'),
    } as never);
    const cap = () => capDuGroupe(useGame.getState());
    frapper('keydown', 'KeyE');
    const apres1 = cap();
    expect(apres1, 'la pression doit pivoter').not.toBe('S');
    for (let i = 0; i < 100; i++) frapper('keydown', 'KeyE', true);
    expect(cap(), 'le maintien a fait tourner en rafale').toBe(apres1);
  });

  it('le relâchement d’une AUTRE touche ne coupe pas la direction tenue', () => {
    frapper('keydown', 'KeyW');
    frapper('keyup', 'KeyD'); // jamais enfoncée : elle n'a aucun geste à terminer
    const avant = { ...useGame.getState().partyPos };
    act(() => { vi.advanceTimersByTime(STEP_MS); });
    expect(useGame.getState().partyPos, 'la touche encore enfoncée ne marche plus').not.toEqual(avant);
  });

  it('changer de touche EN PLEIN maintien : le pas suivant part dans la nouvelle direction', () => {
    const depart = { ...useGame.getState().partyPos };
    frapper('keydown', 'KeyW');
    const apres1 = { ...useGame.getState().partyPos };
    frapper('keydown', 'KeyD');
    expect(useGame.getState().partyPos, 'la nouvelle touche ne doit pas commettre un pas hors cadence').toEqual(apres1);
    act(() => { vi.advanceTimersByTime(STEP_MS); });
    const apres2 = useGame.getState().partyPos;
    expect({ x: apres2.x - apres1.x, y: apres2.y - apres1.y })
      .not.toEqual({ x: apres1.x - depart.x, y: apres1.y - depart.y });
  });
});
