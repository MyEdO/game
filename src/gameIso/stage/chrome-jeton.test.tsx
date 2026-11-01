// @vitest-environment jsdom
import { Profiler, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { useGame } from '../../state/store';
import type { BattleState } from '../../noyau/etat';
import { emptyScene } from '../../noyau/monde/scene';
import { bus, EVT } from '../../noyau/bus';
import { STEP_MS } from '../../geometry/walk';
import type { Combatant } from '../../engine/types';
import { MondeDeCampagne } from './MondeDeCampagne';
import { setStageRendererFactory } from './GameStage3D';
import { BancRenderer, brancherArdoise, brancherImagesPilotees } from './banc-volumique';
import { chromeHeadPx } from './TokenChromeOverlay';
import { viewPolicy } from './viewPolicy';
import { GHOST_OPACITY } from './boardPose';
import { poseDynamicMarks, type DynMarkPools } from './dynamicMarkPose';
import { buildDynamicMarkMesh } from '../backends/webgl/dynamicMarkMeshes';
import { COMBAT_TOKEN_BASE, discCapPath, discR, RING_B_PX, teamRingDecor, teamRingRadiusK, type DynamicMarks } from '../builders/dynamicMarks';
import { tokenChrome } from '../builders/tokenChrome';
import { ALLY_TINT, ENEMY_TINT, hpColor } from '../teamColors';
import { combatantTokenScale } from '../sizeScale';
import { tileCenter, type Dims } from '../../geometry/iso';

/**
 * CHROME D'ÉCRAN des jetons de combat (#1176, P3-0f) — barre de PV, icônes d'États (report « +N »),
 * pastille d'état de FIN, et l'ALLURE du corps (fantôme hors LdV, hors d'action, cible survolée).
 *
 * Ce que cette sonde mesure, c'est la SOURCE UNIQUE : une seule dérivation (`builders/tokenChrome`)
 * et un seul peintre (`TokenChromeMarks`) — la débrancher fait perdre le chrome. Puis l'EXCLUSIVITÉ :
 * le chrome vit dans l'overlay projeté (`stage/TokenChromeOverlay`), aucun corps de jeton SVG n'étant
 * plus monté dans le stage.
 */
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TAILLE = { w: 800, h: 600 };
/** PV du héros de la sonde : ratio 3/12 = 0,25 → zone CRITIQUE de `hpColor`. */
const PV = { current: 3, max: 12 };

function hero(id: string, pos: { x: number; y: number }): Combatant {
  return {
    id, label: id, kind: 'hero', pos, size: 'moyenne',
    wounds: { current: 12, max: 12 }, weapons: [],
    characteristics: { 'capacite-de-combat': 40, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, 'intelligence': 30, 'force-mentale': 30, sociabilite: 30 },
    advantage: 0, conditions: [], armour: {},
    skills: [], talents: [], movement: 4,
  } as unknown as Combatant;
}

/** Un héros BLESSÉ portant CINQ états-drapeaux — la réserve d'alvéoles en tient quatre (`CHROME_SLOTS`,
 *  autant que le rack du portrait) : trois états montrés + le report « +2 » dans la dernière. Et un
 *  ennemi MORT. */
function combatChromé(): BattleState {
  return {
    combatants: [
      { ...hero('h1', { x: 3, y: 3 }), wounds: PV, defensiveStance: true, aiming: true, focus: { dr: 2 }, hunger: { days: 2, failures: 0 }, psychState: [{ type: 'frenesie' }] },
      { ...hero('e1', { x: 5, y: 3 }), kind: 'enemy', dead: true },
    ],
    order: ['h1', 'e1'],
    turn: 0,
    round: 1,
    over: false,
    action: null,
    acted: true,
    movementUsed: 0,
    preview: null,
    reachable: new Map<string, number>(),
    zones: [],
    log: [],
  } as unknown as BattleState;
}

let root: Root | null = null;
let conteneur: HTMLDivElement | null = null;

brancherArdoise();

/** Commits du sous-arbre du stage depuis le dernier montage — un rendu React, un commit. */
let commits = 0;
const commitsReact = () => commits;

function monter(retouche: Record<string, unknown> = {}): HTMLDivElement {
  useGame.setState({
    scene: emptyScene('scene-test', 10, 10),
    mode: 'battle',
    viewMode: 'iso',
    partyPos: { x: 6, y: 6 },
    party: [hero('h1', { x: 3, y: 3 })],
    battle: combatChromé(),
    dialogue: null,
    flags: {},
    hovered: null,
    pendingAttack: null,
    ...retouche,
  } as never);
  conteneur = document.createElement('div');
  document.body.appendChild(conteneur);
  root = createRoot(conteneur);
  commits = 0;
  act(() => root!.render(<Profiler id="chrome" onRender={() => { commits += 1; }}><MondeDeCampagne /></Profiler>));
  return conteneur;
}

function démonter(): void {
  if (root) { act(() => root!.unmount()); root = null; }
  if (conteneur) { conteneur.remove(); conteneur = null; }
}

/** Les barres de PV peintes : le rect de REMPLISSAGE porte la couleur de seuil (`hpColor`), le rect
 *  de fond le noir — un seul des deux dit l'état du combattant. */
function barresPV(el: HTMLElement): Element[] {
  return [...el.querySelectorAll('svg.iso-stage rect')].filter((r) => r.getAttribute('height') === '4' && r.getAttribute('fill') !== '#000');
}

/** Les pastilles d'état de FIN, par leur `<title>` d'accessibilité. */
function pastilles(el: HTMLElement): Element[] {
  return [...el.querySelectorAll('svg.iso-stage g.token-endmark')];
}

/** Le groupe de chrome VOLUMIQUE d'un combattant (l'overlay projeté), ou `null`. */
function chromeVolumique(el: HTMLElement, cid: string): SVGGElement | null {
  return el.querySelector(`svg.iso-stage g[data-chrome-cid="${cid}"]`);
}

/** Les ancres du bloc de badges d'un chrome (PV + icônes), telles que le peintre partagé les pose. */
function badgesDe(g: SVGGElement): (string | null)[] {
  return [...g.querySelectorAll('g')].map((n) => n.getAttribute('transform')).filter((t) => t?.startsWith('translate(0,'));
}

beforeAll(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', { configurable: true, get: () => TAILLE.w });
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientHeight', { configurable: true, get: () => TAILLE.h });
  setStageRendererFactory(() => new BancRenderer());
});
afterAll(() => setStageRendererFactory(null));
afterEach(() => {
  démonter();
});

describe('Chrome des jetons — UNE dérivation, UN peintre (#1176 P3-0f)', () => {
  it('le chrome est peint à l’écran : une barre par combattant posté, « +2 », pastille de mort', () => {
    const el = monter();
    const barres = barresPV(el);
    expect(barres, 'une barre par combattant posté').toHaveLength(2);
    expect(barres.map((b) => b.getAttribute('fill'))).toContain(hpColor(PV.current / PV.max));
    expect([...el.querySelectorAll('svg.iso-stage text')].map((t) => t.textContent)).toContain('+2');
    const marques = pastilles(el);
    expect(marques, 'le mort porte SA pastille, et lui seul').toHaveLength(1);
    expect(marques[0].querySelector('title')?.textContent).toBe('Mort');
    expect(marques[0].getAttribute('class')).toContain('es-mort');
  });

  it('le chrome vit dans l’overlay projeté, combattant par combattant', () => {
    const el = monter();
    const h1 = chromeVolumique(el, 'h1');
    const e1 = chromeVolumique(el, 'e1');
    expect(h1, 'le héros porte son chrome au-dessus de sa tête').toBeTruthy();
    expect(e1).toBeTruthy();
    // Barre de PV au ratio du héros — la couleur de seuil du catalogue (`hpColor`).
    const barre = [...h1!.querySelectorAll('rect')].find((r) => r.getAttribute('fill') !== '#000');
    expect(barre?.getAttribute('fill')).toBe(hpColor(PV.current / PV.max));
    expect(Number(barre?.getAttribute('width'))).toBeCloseTo(26 * (PV.current / PV.max), 6);
    // Icônes d'États : la réserve tient QUATRE places — trois états montrés, le report « +2 » dans la
    // dernière. Le rang ne déborde jamais de ses alvéoles, et aucune ne se déplace quand il se remplit.
    expect(h1!.querySelectorAll('g[aria-hidden="true"]')).toHaveLength(3);
    expect([...h1!.querySelectorAll('text')].map((t) => t.textContent)).toEqual(['+2']);
    // Pastille d'état de fin, avec son `<title>` — l'accessibilité ne se perd pas au changement de voie.
    expect(h1!.querySelector('g.token-endmark'), 'un héros en état n’en porte pas').toBeNull();
    const marque = e1!.querySelector('g.token-endmark');
    expect(marque?.querySelector('title')?.textContent).toBe('Mort');
    expect(marque?.getAttribute('class')).toContain('es-mort');
  });

  it('AUCUNE DOUBLE PEINTURE : tout le chrome peint vit dans l’overlay, et rien dans un corps SVG', () => {
    const webgl = monter();
    const barres = barresPV(webgl);
    expect(barres.length).toBeGreaterThan(0);
    // En volumique il n'y a plus de corps de jeton SVG : toute barre peinte appartient à l'overlay.
    expect(barres.every((b) => b.closest('g[data-chrome-cid]') !== null), 'toute barre volumique vit dans l’overlay').toBe(true);
    expect(webgl.querySelectorAll('svg.iso-stage g[data-cid]'), 'aucun corps de jeton affine monté en volumique').toHaveLength(0);
  });

  it('le chrome s’ancre au bord du repère au sol en iso et au bord du disque en vue du dessus', () => {
    const scaleK = combatantTokenScale(combatChromé().combatants[0]);
    const marque = { scaleK, n: 1 }; // le héros de la sonde : taille moyenne, empreinte d'une case
    const el = monter();
    const h1 = chromeVolumique(el, 'h1')!;
    const dims: Dims = { ...emptyScene('scene-test', 10, 10).dimensions, rot: 0, view: 'iso', edge: false } as Dims;
    const { cx, cy } = tileCenter(3, 3, dims, 0);
    expect(h1.getAttribute('transform'), 'ancré aux PIEDS de sa case, comme le jeton').toBe(`translate(${cx},${cy})`);
    const bord = RING_B_PX * teamRingRadiusK(COMBAT_TOKEN_BASE * scaleK);
    expect(chromeHeadPx(false, marque)).toBeCloseTo(bord, 9);
    expect(badgesDe(h1)).toContain(`translate(0,${-bord - 8})`);
    for (const taille of [0.5, 1, 2, 4]) {
      expect(chromeHeadPx(false, { scaleK: taille, n: 2 })).toBeCloseTo(RING_B_PX * teamRingRadiusK(COMBAT_TOKEN_BASE * taille), 9);
      expect(chromeHeadPx(true, { scaleK: taille, n: 2 })).toBe(discR(2));
    }
    démonter();

    // DESSUS : le pion y EST un disque, et le chrome se pose à son BORD (`badgeY = −discR`).
    const top = monter({ viewMode: 'top' });
    expect(chromeHeadPx(true, marque)).toBe(discR(1));
    expect(badgesDe(chromeVolumique(top, 'h1')!)).toContain(`translate(0,${-discR(1) - 8})`);
  });
});

describe('Chrome des jetons — la dérivation PURE, mesurée hors écran (#1176 P3-0f)', () => {
  const c = () => combatChromé().combatants[0];
  const vide = { ghostIds: new Set<string>(), hoveredId: null };

  it('hors LdV du tireur actif : le jeton est FANTÔME, et lui seul', () => {
    expect(tokenChrome(c(), { ...vide, ghostIds: new Set(['h1']) }).ghost).toBe(true);
    expect(tokenChrome(c(), vide).ghost).toBe(false);
  });

  it('survolé : la couleur de RELATION, jamais une couleur d’équipe', () => {
    const ennemi = { ...c(), id: 'e1', kind: 'enemy' } as Combatant;
    expect(tokenChrome(ennemi, { ...vide, hoveredId: 'e1' }).highlight).toBe(ENEMY_TINT);
    expect(tokenChrome(ennemi, vide).highlight).toBeNull();
  });

  it('un engin INERTE n’a pas de santé : aucune barre, aucun état de fin', () => {
    const engin = { ...c(), inert: true } as Combatant;
    expect(tokenChrome(engin, vide).hp).toBeNull();
    expect(tokenChrome(engin, vide).endState).toBeNull();
  });

  it('mort : le chrome porte l’état de fin', () => {
    const mort = { ...c(), dead: true } as Combatant;
    expect(tokenChrome(mort, vide).endState).toBe('mort');
  });
});

describe('Chrome des jetons — l’ALLURE passe à l’ANNEAU d’équipe (#1176 P3-0f)', () => {
  it('l’ANNEAU D’ÉQUIPE s’estompe avec son jeton (teinte par instance du pool P3-0e)', () => {
    const mesh = buildDynamicMarkMesh('anneau');
    const anneau = (id: string, x: number, color: string) => ({
      id, cell: { x, y: 0, z: 0 }, rK: teamRingRadiusK(COMBAT_TOKEN_BASE), color,
    });
    const marques: DynamicMarks = { tethers: [], active: null, party: null, rings: [anneau('h1', 0, ALLY_TINT), anneau('e1', 3, ENEMY_TINT)] };
    const pools: DynMarkPools = { anneau: mesh };
    const counts = poseDynamicMarks(pools, marques, {
      mpt: 1.5,
      glide: () => null,
      groundM: () => 0,
      kind: 'iso',
      chromeAt: (cid) => (cid === 'e1' ? { ghost: true, endState: null, highlight: null } : null),
    });
    expect(counts.anneau).toBeGreaterThan(1);
    const c = new THREE.Color();
    mesh.getColorAt(0, c);
    expect(c.getHex(), 'le jeton en état garde sa teinte pleine').toBe(new THREE.Color(ALLY_TINT).getHex());
    mesh.getColorAt(counts.anneau - 1, c);
    const attendu = new THREE.Color(ENEMY_TINT).multiplyScalar(GHOST_OPACITY);
    expect([c.r, c.g, c.b].map((v) => Number(v.toFixed(6)))).toEqual([attendu.r, attendu.g, attendu.b].map((v) => Number(v.toFixed(6))));
  });
});

/**
 * LA POSITION DU CHROME EST UNE AFFAIRE D'IMAGE, pas de rendu. En volumique, la marche ne re-rend rien
 * entre deux pas (`fx/useWalkAnim`, `repaint = false`) : le quad glisse dans la boucle de rendu, et un
 * chrome posé au seul rendu React resterait sur la case de départ — barre de PV et états décrochés du
 * corps pendant tout le pas. La sonde MESURE les deux ensemble : le transform du groupe de chrome
 * change image par image, ALORS QU'AUCUN commit React ne se produit.
 */
describe('Chrome des jetons — la POSITION suit la marche à la FRAME (#1176 P3-0f)', () => {
  /** L'horloge du banc et sa file de rAF — le collecteur UNIQUE des bancs d'images du stage. */
  const images = brancherImagesPilotees();

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** Déclenche une marche et EXTRAIT son tick de la file commune (patron `walk-frame-loop`). */
  function marcher(id: string, path: { x: number; y: number }[]): FrameRequestCallback {
    const avant = images.enVol.length;
    bus.emit(EVT.ANIM_MOVE, { id, path });
    const posés = images.enVol.splice(avant);
    expect(posés).toHaveLength(1);
    return posés[0];
  }

  /** Avance l'horloge et rejoue le SEUL tick de marche ; rend celui qu'il reprogramme. */
  function image(tick: FrameRequestCallback, dt: number): FrameRequestCallback {
    images.avancer(dt);
    const avant = images.enVol.length;
    act(() => { tick(images.maintenant()); });
    return images.enVol.splice(avant)[0];
  }

  const posé = (el: HTMLElement, cid: string) => chromeVolumique(el, cid)!.getAttribute('transform');

  it('le chrome GLISSE image par image, sans un seul rendu React', () => {
    const el = monter();
    const e1Avant = posé(el, 'e1');
    // DEUX pas (deux segments, donc `2 × STEP_MS` de marche). Le store a déjà commis l'arrivée (x:3) :
    // la marche rejoue le trajet depuis la case quittée.
    const DURÉE = 2 * STEP_MS;
    let tick = marcher('h1', [{ x: 1, y: 3 }, { x: 2, y: 3 }, { x: 3, y: 3 }]);
    // On mesure APRÈS le dernier franchissement de case (le seul événement discret qui re-rend le
    // stage) : de f=0,55 à f=0,70 la case visuelle vaut 2 tout du long, donc aucun commit n'est attendu.
    tick = image(tick, DURÉE * 0.55);
    const commitsAvant = commitsReact();
    const vues = [posé(el, 'h1')];
    tick = image(tick, DURÉE * 0.07);
    vues.push(posé(el, 'h1'));
    image(tick, DURÉE * 0.08);
    vues.push(posé(el, 'h1'));
    expect(commitsReact(), 'aucun rendu React entre ces trois images').toBe(commitsAvant);
    expect(new Set(vues).size, 'trois positions distinctes').toBe(3);
    // Le chrome de l'autre combattant, lui, n'a pas bougé d'un pixel : la glisse est keyée par id.
    expect(posé(el, 'e1')).toBe(e1Avant);
  });
});

/**
 * LES PIONS EN DISQUES (#1176, P3-5c, #3160) — le verdict `pionsEnDisques` de `stage/viewPolicy` : en vue
 * du dessus, un combattant est un disque neutre de la surcouche SVG, dans le MÊME groupe par-jeton que son chrome — donc au même transform, donc emmené
 * par le MÊME battement de marche, et posé APRÈS la grille et les murs au trait dans le seul arbre où
 * le rang de calque se décide.
 */
describe('Pions en disques — la vue du dessus pose un disque par combattant (#1176 P3-5c)', () => {
  /** Le groupe de PION d'un jeton (celui que la surcouche marque quand elle porte le corps). */
  const pion = (el: HTMLElement, cid: string) => el.querySelector(`svg.iso-stage g[data-pion-cid="${cid}"]`);

  it('LE GATE : le verdict du module pur décide des disques de la surcouche, vue par vue', () => {
    // `TokenChromeOverlay pions` descend de `politique.pionsEnDisques` (`MondeDeCampagne`) : mesuré
    // contre le verdict du module pur, jamais contre une attente écrite à la main.
    for (const view of ['iso', 'top'] as const) {
      const enDisques = viewPolicy({ view }).pionsEnDisques;
      const el = monter({ viewMode: view });
      for (const cid of ['h1', 'e1'])
        expect(Boolean(pion(el, cid)), `${view} : disque de la surcouche pour ${cid}`).toBe(enDisques);
      démonter();
    }
    // …et le verdict n'est pas une constante : les deux regards en donnent bien deux valeurs.
    expect(viewPolicy({ view: 'top' }).pionsEnDisques).not.toBe(viewPolicy({ view: 'iso' }).pionsEnDisques);
  });

  it('LE DISQUE : fond au rayon de l’empreinte, anneau d’équipe SUR ce disque', () => {
    const top = monter({ viewMode: 'top' });
    const g = pion(top, 'h1')!;
    const R = discR(1); // empreinte d'une case
    const cercles = [...g.querySelectorAll('circle')];
    const fond = cercles.find((c) => c.getAttribute('fill') !== 'none' && c.getAttribute('r') === String(R));
    expect(fond, 'un disque de fond au rayon de l’empreinte').toBeTruthy();
    // L'ANNEAU d'équipe : la MÊME dérivation que l'anneau au sol du plateau iso, au rayon du disque.
    const anneau = cercles.find((c) => c.getAttribute('fill') === 'none');
    expect(anneau?.getAttribute('r')).toBe(String(R));
    expect(anneau?.getAttribute('stroke')).toBe(teamRingDecor(combatChromé().combatants[0], 0).color);
  });

  it('LE CENTRAGE : le disque est posé au CENTRE de sa case — c’est ce qui rend le clic par case JUSTE', () => {
    // Le picking du dessus n'a plus de cible de personnage sous le rayon (aucun quad) : `pickVerdict`
    // retombe sur le repli de surface de `stage/pickResolve.ts:resoudrePixel`, et ne répond juste que
    // si le disque est centré sur SA case.
    const top = monter({ viewMode: 'top' });
    const dimsTop: Dims = { ...emptyScene('scene-test', 10, 10).dimensions, rot: 0, view: 'top', edge: false } as Dims;
    const { cx, cy } = tileCenter(3, 3, dimsTop, 0);
    expect(pion(top, 'h1')!.getAttribute('transform')).toBe(`translate(${cx},${cy})`);
    const e = tileCenter(5, 3, dimsTop, 0);
    expect(pion(top, 'e1')!.getAttribute('transform')).toBe(`translate(${e.cx},${e.cy})`);
  });

  it('LE CAP : le pion porte le triangle d’orientation de son `facing`, projeté par la vue', () => {
    const top = monter({ viewMode: 'top', facing: { h1: 'E' } });
    const cap = [...pion(top, 'h1')!.querySelectorAll('path')].map((p) => p.getAttribute('d'));
    const dimsTop: Dims = { ...emptyScene('scene-test', 10, 10).dimensions, rot: 0, view: 'top', edge: false } as Dims;
    expect(cap).toContain(discCapPath('E', 1, dimsTop));
    // Deux caps distincts donnent deux tracés distincts : le champ est LU, pas ignoré.
    expect(discCapPath('E', 1, dimsTop)).not.toBe(discCapPath('N', 1, dimsTop));
  });
});
