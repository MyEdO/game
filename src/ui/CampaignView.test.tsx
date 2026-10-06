// @vitest-environment jsdom
/** #1176 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { useGame, type BattleState } from '../state/store';
import type { Combatant } from '../engine/types';
import { datasetArray, setDataset } from '../data/overrides';
import { areneCampaign, paquetDuJeu } from '../scenes/campaign';
import { testScene } from '../scenes/test-fixture';
import { makePregens } from '../data/pregens';
import { CampaignView } from './CampaignView';
import { t } from '../i18n';
import { useGameKeyboard } from './useGameKeyboard';
import { resetStageFrames } from '../gameIso/stage/stageFrames';
import { PAS_TAP_DEG, SEUIL_MAINTIEN_MS, getStageYaw, resetStageYaw } from '../state/stageYaw';
import { monterRacine, demonterRacines } from '../monterRacine.testkit';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let host: HTMLDivElement;

/** Le hook de raccourcis est monté par `App`, AU-DESSUS des écrans (registre unique, tous écrans) :
 *  le monter ici avec l'écran reproduit l'application réelle. */
function Clavier() {
  useGameKeyboard();
  return null;
}

function monter(povActive: boolean) {
  demonterRacines();
  useGame.setState({ screen: 'campaign', scene: testScene(), mode: 'exploration', povActive, battle: null });
  host = monterRacine(<><Clavier /><CampaignView /></>).container;
  return host;
}

afterEach(() => {
  demonterRacines();
  resetStageYaw();
  resetStageFrames();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

beforeEach(() => {
  useGame.setState({ povActive: false });
});

describe('CampaignView — le monde et son refus WebGL sont affichés', () => {
  it.each([false, true])('POV=%s : le jeu n’a qu’un monde', (pov) => {
    const el = monter(pov);
    expect(el.querySelectorAll('main.stage')).toHaveLength(1);
    expect(el.querySelectorAll('.sans-webgl[role="alert"]')).toHaveLength(1);
    expect(el.querySelector('.sans-webgl[role="alert"] strong')?.textContent).toBe('Le monde ne peut pas être affiché');
  });
});

describe('CampaignView — le geste de caméra du joueur, monté à l’écran', () => {
  /**
   * Pilote le BATTEMENT du stage à la main : le test décide quand chaque image se joue. C'est ce
   * battement qui avance le lacet (`stageYaw.avancerLacet`, tiré en prélude par l'hôte
   * `gameIso/stage/MondeDeCampagne` tant que le régime dure) — la file de `requestAnimationFrame`
   * est celle de la boucle du stage, et `performance.now` est l'horloge que le test avance, sans
   * quoi la boucle céderait le pas à l'image qu'elle vient elle-même de servir.
   */
  function harnaisDeFrames() {
    let file: FrameRequestCallback[] = [];
    let horloge = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => horloge);
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => file.push(cb));
    vi.stubGlobal('cancelAnimationFrame', () => {});
    resetStageFrames();
    return (n: number): void => {
      for (let i = 0; i < n; i++) {
        horloge += 16;
        const àServir = file;
        file = [];
        àServir.forEach((cb) => cb(horloge));
      }
    };
  }

  it('TOUCHE TENUE : passé le seuil, l’écran fait tourner la caméra en continu', () => {
    vi.useFakeTimers();
    const jouer = harnaisDeFrames();
    monter(false);
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' })); });
    act(() => { vi.advanceTimersByTime(SEUIL_MAINTIEN_MS); }); // la touche n'est PAS relâchée
    act(() => { jouer(60); });
    expect(getStageYaw()).toBeGreaterThan(50); // bien au-delà du pas fin de l'enfoncement
  });

  it('TOUCHE RELÂCHÉE avant le seuil : la vue en reste au pas fin', () => {
    vi.useFakeTimers();
    const jouer = harnaisDeFrames();
    monter(false);
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' })); });
    act(() => { window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE' })); });
    act(() => { vi.advanceTimersByTime(10 * SEUIL_MAINTIEN_MS); });
    act(() => { jouer(60); });
    expect(getStageYaw()).toBeCloseTo(PAS_TAP_DEG, 6);
  });

  /** Le geste MAINTENU en cours, angle atteint après `frames` images de rotation continue. */
  const maintenirEtMesurer = (jouer: (n: number) => void, frames = 30): number => {
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' })); });
    act(() => { vi.advanceTimersByTime(SEUIL_MAINTIEN_MS); }); // la touche reste TENUE
    act(() => { jouer(frames); });
    const angle = getStageYaw();
    expect(angle).toBeGreaterThan(PAS_TAP_DEG);
    return angle;
  };

  it('BLUR (Alt-Tab) : le lacet en cours S’ARRÊTE, et la minuterie de maintien est désarmée', () => {
    vi.useFakeTimers();
    const jouer = harnaisDeFrames();
    monter(false);

    // 1. Un maintien EN VOL : la fenêtre perd le focus, la caméra s'arrête net et n'avance plus.
    const enVol = maintenirEtMesurer(jouer);
    act(() => { window.dispatchEvent(new Event('blur')); });
    act(() => { jouer(60); });
    expect(getStageYaw()).toBe(enVol);

    // 2. Le `keyup` qui arrive APRÈS (au retour du focus, ou jamais) ne réveille rien.
    act(() => { window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE' })); });
    act(() => { jouer(60); });
    expect(getStageYaw()).toBe(enVol);

    // 3. Minuterie DÉSARMÉE : un appui perdu AVANT le seuil ne part pas en rotation fantôme.
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' })); });
    act(() => { window.dispatchEvent(new Event('blur')); });
    act(() => { vi.advanceTimersByTime(10 * SEUIL_MAINTIEN_MS); });
    act(() => { jouer(60); });
    expect(getStageYaw()).toBeCloseTo(enVol + PAS_TAP_DEG, 6); // le pas fin de l'appui, et RIEN de plus
  });

  it('ONGLET CACHÉ (visibilitychange) : même arrêt, même désarmement', () => {
    vi.useFakeTimers();
    const jouer = harnaisDeFrames();
    monter(false);
    const cacher = (hidden: boolean) => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
      act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    };

    const enVol = maintenirEtMesurer(jouer);
    cacher(true);
    act(() => { jouer(60); });
    expect(getStageYaw()).toBe(enVol);

    // Onglet REVENU au premier plan : l'évènement ne relâche rien (il n'y a plus rien à relâcher),
    // et un nouvel appui bref repart de l'angle laissé — la vue n'a pas été recalée.
    cacher(false);
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' })); });
    act(() => { window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE' })); });
    act(() => { vi.advanceTimersByTime(10 * SEUIL_MAINTIEN_MS); });
    act(() => { jouer(60); });
    expect(getStageYaw()).toBeCloseTo(enVol + PAS_TAP_DEG, 6);
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
  });
});

// LDB 46 l.158-162
describe('CampaignView — le portrait du dock route le ciblage d’ENTITÉ', () => {
  /** Combat à 2 héros, `h2` PORTEUR de 2 Sorts permanents. `action` arme (ou non) la Dissipation. */
  function combatDissipation(action: 'dispel' | null) {
    demonterRacines();
    // `hoverClickCommits` (pointerCaps) interroge le pointeur : jsdom n'a pas `matchMedia`.
    vi.stubGlobal('matchMedia', (media: string) => ({ matches: false, media, addEventListener() {}, removeEventListener() {} }));
    const [h1, h2] = makePregens();
    h1.id = 'h1'; h1.pos = { x: 6, y: 6 };
    h2.id = 'h2'; h2.pos = { x: 5, y: 6 };
    (h2 as { activeEffects?: unknown[] }).activeEffects = [1, 2].map((i) => ({
      label: `Effet ${i}`, bonus: 0, duration: { scale: 'permanent' },
      spell: { spellId: `sort-${i}`, casterId: 'h1', label: `Sort ${i}`, ni: 3 },
    }));
    const battle = {
      combatants: [h1, h2], order: ['h1', 'h2'], baseOrder: ['h1', 'h2'], turn: 0, round: 1,
      action, selectedSpellId: null, reachable: new Map(),
      movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
    } as never;
    useGame.setState({
      scene: testScene(), mode: 'battle', povActive: false, battle, party: [h1, h2],
      sheetId: null, dispelCarrierId: null, inspectId: null,
      pendingCleave: null, pendingDualStrike: null, pendingCast: null, pendingAttack: null,
      pendingSiegeAim: null, pendingDispel: null,
    });
    host = monterRacine(<CampaignView />).container;
    return { h1, h2 };
  }

  /** Le bouton-portrait du dock (jamais la poignée : elle n'a pas d'`aria-label`). */
  const portraitDock = (label: string): HTMLButtonElement => {
    const el = [...host.querySelectorAll<HTMLButtonElement>('.party-dock button')]
      .find((b) => b.getAttribute('aria-label')?.startsWith(label));
    expect(el, `portrait de ${label} absent du dock`).toBeTruthy();
    return el!;
  };

  it('mode Dissiper ARMÉ : le portrait de l’allié porteur ÉLIT le porteur (comme son jeton)', () => {
    const { h2 } = combatDissipation('dispel');
    const b = portraitDock(h2.label);
    expect(b.getAttribute('aria-label')).toBe(`${h2.label} — cibler — ${t('ptile.geste2eInspecter')}`);
    act(() => { b.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(useGame.getState().dispelCarrierId, 'le porteur est élu — le SORT reste à choisir').toBe('h2');
    expect(useGame.getState().sheetId, 'le clic ne doit pas ouvrir la fiche pendant un ciblage').toBeNull();
  });

  it('TÉMOIN — aucun ciblage armé : le même portrait ouvre la fiche du personnage', () => {
    const { h2 } = combatDissipation(null);
    const b = portraitDock(h2.label);
    expect(b.getAttribute('aria-label')).toBe(`${h2.label} — fiche du personnage — ${t('ptile.geste2eInspecter')}`);
    act(() => { b.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(useGame.getState().sheetId).toBe('h2');
    expect(useGame.getState().dispelCarrierId).toBeNull();
  });
});

// #1692
describe('CampaignView — le refus du repli de défaite vit le temps de la modale', () => {
  const MESSAGE = 'Cette campagne ne peut pas être jouée en l’état. Demandez-en une nouvelle version à son auteur.';

  function defaite(party: Combatant[]): BattleState {
    return {
      combatants: party, order: party.map((h) => h.id), turn: 0, round: 1, action: null, selectedSpellId: null,
      reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: 'defeat',
    };
  }
  const alerte = () => host.querySelector('.defeat-modal [role="alert"]');
  const reprendre = () => {
    const b = [...host.querySelectorAll<HTMLButtonElement>('.defeat-modal button')].find((x) => x.textContent === 'Reprendre');
    expect(b, 'bouton « Reprendre » absent de la modale de défaite').toBeTruthy();
    act(() => { b!.click(); });
  };
  const menuPrincipal = () =>
    [...host.querySelectorAll<HTMLButtonElement>('.defeat-modal .cadre-pied button')].find((x) => x.textContent === 'Menu principal');

  it('refus affiché, puis levé : la défaite suivante s’ouvre sans lui', () => {
    demonterRacines();
    vi.stubGlobal('matchMedia', (media: string) => ({ matches: false, media, addEventListener() {}, removeEventListener() {} }));
    const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {});
    const party = makePregens().slice(0, 1);
    const avant = [...datasetArray('props')];
    useGame.setState({ screen: 'campaign', scene: null, mode: 'battle', povActive: false, massBattle: null, party, battle: defaite(party) });
    setDataset('props', avant.map((p) => (p.id === 'tonneau' ? { ...p, id: 'tonneau-renomme' } : p)));
    try {
      host = monterRacine(<CampaignView />).container;
      expect(menuPrincipal(), 'sans refus, la modale reste telle quelle').toBeUndefined();
      reprendre();
      expect(alerte()?.textContent).toBe(MESSAGE);
      expect(useGame.getState().scene, 'aucune scène posée').toBeNull();
      const menu = menuPrincipal();
      expect(menu, 'refus posé : seconde sortie « Menu principal »').toBeTruthy();
      act(() => { menu!.click(); });
      expect(useGame.getState().screen).toBe('menu');
      act(() => { useGame.setState({ screen: 'campaign' }); });
    } finally {
      setDataset('props', avant);
    }
    reprendre();
    expect(useGame.getState().scene?.id).toBe(paquetDuJeu(areneCampaign).scenes[0].id);
    act(() => { useGame.setState({ mode: 'battle', battle: defaite(party) }); });
    expect(host.querySelector('.defeat-modal'), 'nouvelle défaite affichée').toBeTruthy();
    expect(alerte(), 'le refus d’avant ne survit pas à la modale').toBeNull();
    expect(menuPrincipal(), 'sans refus, pas de « Menu principal »').toBeUndefined();
    consoleErr.mockRestore();
  });
});
