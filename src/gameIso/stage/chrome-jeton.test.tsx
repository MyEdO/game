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
import {
  ALPHA_TEST,
  DIM_OPACITY,
  GHOST_DESAT,
  GHOST_OPACITY,
  HIGHLIGHT_MIX,
  billboardMaterial,
  luminance709,
  poseBoards,
  TEINTE_PLEINE,
  type Board,
  type BoardChrome,
  type FrameLights,
} from './boardPose';
import { poseDynamicMarks, type DynMarkPools } from './dynamicMarkPose';
import { buildDynamicMarkMesh } from '../backends/webgl/dynamicMarkMeshes';
import { COMBAT_TOKEN_BASE, discCapPath, discR, teamRingDecor, teamRingRadiusK, type DynamicMarks } from '../builders/dynamicMarks';
import { tokenChrome } from '../builders/tokenChrome';
import { tokenBodyKind } from '../tokenBodyKind';
import { ALLY_TINT, ENEMY_TINT, NEUTRAL_TINT, hpColor } from '../teamColors';
import { combatantBodyTopFrac, combatantTokenScale } from '../sizeScale';
import { billboardHeightM, CONVENTION } from '../backends/webgl/billboardMath';
import { ISO_PX_PER_M } from '../iso';
import { tileCenter, type Dims } from '../../geometry/iso';
import { GROUND_Y, bodyHeight } from '../rig/composeRig';
import type { Appearance } from '../../engine/authoringAppearance';
import { contactShadow } from '../backends/webgl/sceneMeshes';
import type { BillboardSubject } from '../backends/webgl/sceneMeshes';
import { findTrappingById } from '../../data';

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

/** L'ordonnée de l'ANCRE DE TÊTE d'un chrome peint, relue au DOM : le peintre partagé pose le bloc de
 *  badges à `ancre − 8` et la pastille de fin à `ancre − 22` — la plus HAUTE des deux redonne l'ancre. */
function ancreDe(g: SVGGElement): number {
  const ys = badgesDe(g).map((t) => Number(/^translate\(0,(-?[\d.e+-]+)\)$/.exec(t!)![1]));
  return Math.max(...ys) + 8;
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

  it('le chrome volumique s’ancre à la TÊTE DESSINÉE en losange, et au DISQUE-PORTRAIT en vue du dessus', () => {
    const h = combatChromé().combatants[0];
    const scaleK = combatantTokenScale(h);
    const frac = combatantBodyTopFrac(h);
    const marque = { scaleK, n: 1, bodyTopFrac: frac }; // le héros de la sonde : taille moyenne, empreinte d'une case
    const el = monter();
    const h1 = chromeVolumique(el, 'h1')!;
    const dims: Dims = { ...emptyScene('scene-test', 10, 10).dimensions, rot: 0, view: 'iso', edge: false } as Dims;
    const { cx, cy } = tileCenter(3, 3, dims, 0);
    expect(h1.getAttribute('transform'), 'ancré aux PIEDS de sa case, comme le jeton').toBe(`translate(${cx},${cy})`);
    // LOSANGE : la hauteur MONDE du quad, à la cadence verticale de la projection affine, RABATTUE sur
    // la part de boîte que le corps remplit — la toise du gabarit, pas le haut du cadre.
    const tête = billboardHeightM(CONVENTION, 'personnage') * scaleK * frac * ISO_PX_PER_M;
    expect(chromeHeadPx(false, marque)).toBeCloseTo(tête, 9);
    // Le bloc de badges est posé à `badgeY − 8`, `badgeY` valant cette ancre.
    expect(badgesDe(h1)).toContain(`translate(0,${-tête - 8})`);
    démonter();

    // DESSUS : plus de tête à surmonter — le pion y EST un disque-portrait, et le chrome se pose à son
    // BORD (`badgeY = −discR`).
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

  it('mort : le corps est HORS D’ACTION et porte l’état de fin', () => {
    const mort = { ...c(), dead: true } as Combatant;
    expect(tokenChrome(mort, vide).dim).toBe(true);
    expect(tokenChrome(mort, vide).endState).toBe('mort');
  });
});

describe('Chrome des jetons — l’ALLURE passe au MATÉRIAU du billboard (#1176 P3-0f)', () => {
  const CAMERA = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 100);
  const LUM = 0.5;
  const FLAQUES: FrameLights = { pool: [], slots: [], surfaceLuminance: LUM };

  function board(cid: string, ombre = false): Board {
    const material = billboardMaterial(new THREE.Texture(), 1);
    const sub: BillboardSubject = {
      identity: `sonde:${cid}`, cid, kind: 'personnage', anchor: new THREE.Vector3(0, 0, 0),
      facing: 'S', scaleK: 1, cell: { x: 0, y: 0, z: 0 }, box: { w: 120, h: 150 }, svg: () => '',
    };
    return {
      sub,
      quad: { widthM: 2, heightM: 3, centerLiftM: 1.5 },
      mesh: new THREE.Mesh(new THREE.PlaneGeometry(2, 3), material),
      material,
      shadow: ombre ? contactShadow(sub, { heightM: 3 }) : undefined,
    };
  }

  /** Les canaux d'allure mesurés SUR un board déjà posé. */
  function canaux(b: Board): { opacity: number; alpha: number; desat: number; color: THREE.Color; ombre: number } {
    return {
      opacity: b.material.opacity,
      alpha: (b.material.userData.allureAlpha as { value: number }).value,
      desat: (b.material.userData.desat as { value: number }).value,
      color: b.material.color,
      ombre: (b.shadow as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> | undefined)?.material.opacity ?? NaN,
    };
  }

  /** Pose UNE frame avec l'allure donnée, et rend les canaux mesurés SUR le board. */
  function allure(chrome: BoardChrome | null, ombre = false): ReturnType<typeof canaux> {
    const b = board('h1', ombre);
    poseBoards([b], CAMERA, () => null, FLAQUES, () => chrome, TEINTE_PLEINE);
    return canaux(b);
  }

  it('rien à signaler : teinte NEUTRE à l’exposition de la frame, opaque, saturé', () => {
    const a = allure(null);
    expect([a.color.r, a.color.g, a.color.b]).toEqual([LUM, LUM, LUM]);
    expect(a.alpha).toBe(1);
    expect(a.desat).toBe(0);
  });

  it('FANTÔME hors LdV : translucide ET désaturé — la teinte seule ne peut pas retirer la couleur', () => {
    const a = allure({ ghost: true, dim: false, highlight: null });
    expect(a.alpha).toBe(GHOST_OPACITY);
    expect(a.desat).toBe(GHOST_DESAT);
  });

  it('HORS D’ACTION : assombri seulement — un corps déjà tombé ne se grise pas en plus', () => {
    const a = allure({ ghost: false, dim: true, highlight: null });
    expect(a.alpha).toBe(DIM_OPACITY);
    expect(a.desat).toBe(0);
    // Hors d'action ET hors LdV : l'opacité du corps tombé prime.
    expect(allure({ ghost: true, dim: true, highlight: null }).alpha).toBe(DIM_OPACITY);
    expect(allure({ ghost: true, dim: true, highlight: null }).desat).toBe(0);
  });

  it('l’opacité d’allure ne passe JAMAIS par `material.opacity` : sous l’alphaTest, le sujet DISPARAÎT', () => {
    // `diffuseColor = vec4( diffuse, opacity )` × texel, PUIS `if ( a < alphaTest ) discard` : à 0,45
    // d'opacité pour 0,5 de seuil, même un texel parfaitement opaque est rejeté — le fantôme s'efface
    // en entier au lieu de pâlir. L'opacité du matériau reste donc AU-DESSUS du seuil, toujours.
    expect(GHOST_OPACITY).toBeLessThan(ALPHA_TEST); // la sonde mord : c'est bien le régime dangereux
    for (const chrome of [null, { ghost: true, dim: false, highlight: null }, { ghost: false, dim: true, highlight: null }])
      expect(allure(chrome).opacity, `allure ${JSON.stringify(chrome)}`).toBeGreaterThanOrEqual(ALPHA_TEST);
  });

  /** Écart des canaux d'une couleur (max/min) : 1 = un gris, et pour une couleur de MATÉRIAU, ce que
   *  la multiplication du fragment impose à TOUT texel du corps. */
  const écart = (c: THREE.Color) => Math.max(c.r, c.g, c.b) / Math.min(c.r, c.g, c.b);
  /** Ce que l'écran rend d'un texel d'art sous une couleur de matériau : `map_fragment` MULTIPLIE. */
  const rendu = (texel: string, m: THREE.Color) => new THREE.Color(texel).multiply(m);
  /** Deux texels d'ART d'un même corps : le gris pâle d'une robe de cheval, le brun d'un harnais. */
  const ROBE = '#CFD2D0';
  const HARNAIS = '#6b4a2f';
  /** Exposition à laquelle les trois teintes de relation tiennent sans borner un canal. */
  const SOMBRE = 0.25;

  /** Couleur de matériau d'un corps posé sous cette relation, à cette exposition. */
  function teinté(highlight: string | null, exposition = LUM): THREE.Color {
    const b = board('h1');
    const flaques: FrameLights = { pool: [], slots: [], surfaceLuminance: exposition };
    poseBoards([b], CAMERA, () => null, flaques, () => ({ ghost: false, dim: false, highlight }), TEINTE_PLEINE);
    return b.material.color.clone();
  }

  it('CIBLE SURVOLÉE : le corps GARDE son art — la teinte s’y mêle, elle ne le repeint pas', () => {
    // La couleur de matériau MULTIPLIE le texel : son propre écart de canaux est celui qu'elle impose à
    // tout le corps. Un aplat de la teinte y ferait entrer 13,8 (allié) à 21,8 (adversaire) — le gris
    // pâle d'une robe en sortait vert plat, yeux et harnais noyés (#1337, capture utilisateur).
    for (const teinte of [ENEMY_TINT, ALLY_TINT, NEUTRAL_TINT]) {
      const m = teinté(teinte, SOMBRE);
      const brut = new THREE.Color(teinte);
      expect(écart(m), `${teinte} : la teinte ne s’impose pas telle quelle`).toBeLessThan(écart(brut) / 3);
      // ORDRE des canaux d'un texel : le brun du harnais reste plus rouge que vert, même sous le vert
      // d'allié — c'est ce qui fait qu'on lit encore un harnais, et pas une silhouette.
      const h = rendu(HARNAIS, m);
      expect(h.r, `harnais sous ${teinte}`).toBeGreaterThan(h.g);
      // …et la robe pâle (écart 1,03 de son cru) reste un gris TEINTÉ, pas l'aplat de la relation.
      expect(écart(rendu(ROBE, m)), `robe sous ${teinte}`).toBeLessThan(3);
    }
  });

  it('…et la RELATION est bien présente : la couleur tire vers la teinte d’une part mesurable', () => {
    for (const teinte of [ENEMY_TINT, ALLY_TINT, NEUTRAL_TINT]) {
      const m = teinté(teinte, SOMBRE);
      // Le bout TEINTE du mélange : la couleur de relation portée à la même exposition que le neutre.
      const bout = new THREE.Color(teinte);
      bout.multiplyScalar(SOMBRE / luminance709(bout));
      for (const canal of ['r', 'g', 'b'] as const)
        expect((m[canal] - SOMBRE) / (bout[canal] - SOMBRE), `${teinte}.${canal}`).toBeCloseTo(HIGHLIGHT_MIX, 9);
      // Le canal DOMINANT de la relation domine la couleur du corps : le survol se lit d'un coup d'œil.
      const dominant = (c: THREE.Color) => (c.r >= c.g && c.r >= c.b ? 'r' : c.g >= c.b ? 'g' : 'b');
      expect(dominant(m), teinte).toBe(dominant(bout));
      // Exposition TENUE à l'exact : deux bouts de même luminance, mélange linéaire.
      expect(luminance709(m), teinte).toBeCloseTo(SOMBRE, 9);
    }
  });

  it('SANS survol : exposition neutre, et le rapport de canaux d’un texel passe INTACT', () => {
    const m = teinté(null, SOMBRE);
    expect([m.r, m.g, m.b]).toEqual([SOMBRE, SOMBRE, SOMBRE]);
    const h = rendu(HARNAIS, m);
    const brut = new THREE.Color(HARNAIS);
    expect(h.r / h.g).toBeCloseTo(brut.r / brut.g, 12);
    expect(h.g / h.b).toBeCloseTo(brut.g / brut.b, 12);
  });

  it('…et à PLEINE lumière la teinte la plus saturée tient encore l’exposition', () => {
    const a = allure({ ghost: false, dim: false, highlight: ENEMY_TINT }); // exposition LUM
    expect(Math.max(a.color.r, a.color.g, a.color.b), 'aucun canal au-delà de 1').toBeLessThanOrEqual(1);
    expect(luminance709(a.color), 'exposition tenue à l’exact').toBeCloseTo(LUM, 9);
    // Plus haut, la borne mord : les canaux restent sous 1 et la luminance rendue passe sous la cible,
    // sans virage de teinte (le rouge d'adversaire demanderait 1,75 de canal rouge à 0,9 d'exposition).
    const haut = teinté(ENEMY_TINT, 0.9);
    expect(Math.max(haut.r, haut.g, haut.b)).toBeCloseTo(1, 9);
    expect(luminance709(haut)).toBeLessThan(0.9);
  });

  it('l’allure est keyée par ID : deux jetons, deux allures, chacune sur SON matériau', () => {
    const h1 = board('h1');
    const e1 = board('e1');
    const table: Record<string, BoardChrome> = {
      e1: { ghost: true, dim: false, highlight: null },
      h1: { ghost: false, dim: false, highlight: ENEMY_TINT },
    };
    poseBoards([h1, e1], CAMERA, () => null, FLAQUES, (cid) => table[cid] ?? null, TEINTE_PLEINE);
    expect(canaux(e1).alpha, 'le fantôme est celui que la table désigne').toBe(GHOST_OPACITY);
    expect(canaux(e1).desat).toBe(GHOST_DESAT);
    expect(canaux(h1).alpha).toBe(1);
    expect(canaux(h1).desat).toBe(0);
    expect(canaux(h1).color.r).toBeGreaterThan(canaux(h1).color.g); // survolé : la teinte de relation
  });

  it('l’OMBRE DE CONTACT s’estompe avec le corps qu’elle porte', () => {
    const pleine = allure(null, true).ombre;
    expect(pleine).toBeGreaterThan(0);
    expect(allure({ ghost: true, dim: false, highlight: null }, true).ombre).toBeCloseTo(pleine * GHOST_OPACITY, 9);
    expect(allure({ ghost: false, dim: true, highlight: null }, true).ombre).toBeCloseTo(pleine * DIM_OPACITY, 9);
  });

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
      chromeAt: (cid) => (cid === 'e1' ? { ghost: true, dim: false, highlight: null } : null),
    });
    expect(counts.anneau).toBeGreaterThan(1);
    const c = new THREE.Color();
    mesh.getColorAt(0, c);
    expect(c.getHex(), 'le jeton en état garde sa teinte pleine').toBe(new THREE.Color(ALLY_TINT).getHex());
    mesh.getColorAt(counts.anneau - 1, c);
    const attendu = new THREE.Color(ENEMY_TINT).multiplyScalar(GHOST_OPACITY);
    expect([c.r, c.g, c.b].map((v) => Number(v.toFixed(6)))).toEqual([attendu.r, attendu.g, attendu.b].map((v) => Number(v.toFixed(6))));
  });

  it('le matériau porte ses DEUX uniformes dès son montage, et l’allure APRÈS l’alphatest', () => {
    const mat = billboardMaterial(new THREE.Texture(), 1);
    expect((mat.userData.desat as { value: number }).value).toBe(0);
    expect((mat.userData.allureAlpha as { value: number }).value).toBe(1);
    const shader = {
      uniforms: {} as Record<string, unknown>,
      fragmentShader: 'void main() {\n#include <map_fragment>\n#include <alphatest_fragment>\n}',
    };
    mat.onBeforeCompile!(shader as never, null as never);
    expect(shader.uniforms.uDesat, 'l’uniforme du matériau, pas une copie').toBe(mat.userData.desat);
    expect(shader.uniforms.uAllureAlpha).toBe(mat.userData.allureAlpha);
    expect(shader.fragmentShader).toContain('uniform float uDesat;');
    expect(shader.fragmentShader).toContain('uniform float uAllureAlpha;');
    expect(shader.fragmentShader).toContain('mix( diffuseColor.rgb');
    // ORDRE : l'alpha d'allure se multiplie APRÈS la découpe des texels — avant, il ferait basculer
    // tout le sprite sous le seuil et le ferait disparaître.
    const découpe = shader.fragmentShader.indexOf('#include <alphatest_fragment>');
    const multiplication = shader.fragmentShader.indexOf('diffuseColor.a *= uAllureAlpha;');
    expect(découpe).toBeGreaterThanOrEqual(0);
    expect(multiplication).toBeGreaterThan(découpe);
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

describe('Ancre du chrome — la TOISE du gabarit, jamais une constante par famille (#1176 P3-0f)', () => {
  /** Espèces de RIG mesurées à l'écran par le juge de vision : leur échelle d'art vaut 1 pour les cinq
   *  (`resolveSpecies(...).scale`), et leur Taille est Moyenne — seule la TOISE de leur gabarit les
   *  sépare. Un chrome ancré au haut de boîte les posait donc TOUS à la même hauteur d'écran. */
  const ESPÈCES = ['humain', 'nain', 'halfling', 'elfe', 'gobelin'];
  const app = (sp: string) => ({ species: sp, sex: 'M', build: 0.5, seed: 1 } as unknown as Appearance);
  const perso = (sp: string): Combatant => ({ ...hero('h1', { x: 3, y: 3 }), appearance: app(sp) } as unknown as Combatant);
  /** Ancre volumique d'un combattant, par le chemin de production (builder → `chromeHeadPx`). */
  const ancreVol = (c: Combatant) => chromeHeadPx(false, { scaleK: combatantTokenScale(c), n: 1, bodyTopFrac: combatantBodyTopFrac(c) });

  it('cinq espèces, cinq ancres : la fraction sort de `bodyHeight`, pas d’un nombre par famille', () => {
    const fracs = ESPÈCES.map((sp) => combatantBodyTopFrac(perso(sp)));
    ESPÈCES.forEach((sp, i) => {
      expect(fracs[i], sp).toBeCloseTo(Math.min(1, bodyHeight(app(sp)) / GROUND_Y), 12);
    });
    expect(new Set(fracs).size, 'cinq toises distinctes').toBe(ESPÈCES.length);
    expect(combatantBodyTopFrac(perso('nain'))).toBeLessThan(combatantBodyTopFrac(perso('humain')));
    // Et l'ancre d'écran en hérite : une par espèce, là où la constante de famille n'en donnait qu'une.
    expect(new Set(ESPÈCES.map((sp) => ancreVol(perso(sp)))).size, 'cinq ancres volumiques distinctes').toBe(ESPÈCES.length);
  });

  it('l’écart BARRE→TÊTE DESSINÉE reste sous 6 px à 100 %, pour les cinq', () => {
    for (const sp of ESPÈCES) {
      const c = perso(sp);
      // La tête DESSINÉE, sans rabat de boîte : la toise brute du gabarit à la cadence du quad.
      const têtePx = billboardHeightM(CONVENTION, 'personnage') * combatantTokenScale(c) * (bodyHeight(app(sp)) / GROUND_Y) * ISO_PX_PER_M;
      expect(Math.abs(ancreVol(c) - têtePx), `${sp} : barre → tête`).toBeLessThanOrEqual(6);
    }
  });

  it('à l’ÉCRAN, le rapport nain/humain des ancres peintes est celui des toises', () => {
    const nain = perso('nain');
    const humain = perso('humain');
    const monterAvec = (c: Combatant) => {
      const b = combatChromé();
      return monter({ battle: { ...b, combatants: [{ ...b.combatants[0], appearance: c.appearance }, b.combatants[1]] }, party: [c] });
    };

    const volNain = ancreDe(chromeVolumique(monterAvec(nain), 'h1')!);
    démonter();
    const volHumain = ancreDe(chromeVolumique(monterAvec(humain), 'h1')!);

    // La toise du gabarit, et elle seule, décide de la hauteur d'ancre : les pixels dépendent du quad,
    // la FRACTION non — c'est elle que la dérivation partagée (`combatantBodyTopFrac`) fournit.
    const attendu = combatantBodyTopFrac(nain) / combatantBodyTopFrac(humain);
    expect(volNain / volHumain, 'ancre peinte à l’écran').toBeCloseTo(attendu, 9);
    expect(attendu, 'un nain n’arrive pas à la tête d’un humain').toBeLessThan(0.7);
  });
});

/**
 * LES PIONS EN DISQUES (#1176, P3-5c) — le verdict `pionsEnDisques` de `stage/viewPolicy` : en vue du
 * dessus, un combattant N'EST PLUS un billboard du monde volumique. Il est un disque-portrait de la
 * surcouche SVG, dans le MÊME groupe par-jeton que son chrome — donc au même transform, donc emmené
 * par le MÊME battement de marche, et posé APRÈS la grille et les murs au trait dans le seul arbre où
 * le rang de calque se décide.
 */
describe('Pions en disques — la vue du dessus n’a plus un seul billboard de personnage (#1176 P3-5c)', () => {
  /** Le groupe de PION d'un jeton (celui que la surcouche marque quand elle porte le corps). */
  const pion = (el: HTMLElement, cid: string) => el.querySelector(`svg.iso-stage g[data-pion-cid="${cid}"]`);
  /** Nombre de SUJETS que le monde volumique a à peindre en billboard (décor + acteurs). */
  const sujets = (el: HTMLElement) => Number(el.querySelector('canvas')!.getAttribute('data-sujets'));

  it('LE GATE : UN SEUL verdict alimente les deux props de l’hôte — sujets du monde ET disques', () => {
    // `GameStage3D pionsEnDisques` (le monde ne monte alors AUCUN sujet `personnage`) et
    // `TokenChromeOverlay pions` (la surcouche porte alors le CORPS) descendent du MÊME
    // `politique.pionsEnDisques` (`MondeDeCampagne`). Un hôte qui n'en passerait qu'une donnerait deux pions
    // (billboard + disque) ou zéro : c'est le COUPLE qui se mesure ici, vue par vue, contre le verdict
    // du module pur — jamais deux attentes écrites à la main.
    for (const view of ['iso', 'top'] as const) {
      const enDisques = viewPolicy({ view }).pionsEnDisques;
      const el = monter({ viewMode: view });
      expect(sujets(el), `${view} : sujets de billboard du monde volumique`).toBe(enDisques ? 0 : 2);
      for (const cid of ['h1', 'e1'])
        expect(Boolean(pion(el, cid)), `${view} : disque de la surcouche pour ${cid}`).toBe(enDisques);
      démonter();
    }
    // …et le verdict n'est pas une constante : les deux regards en donnent bien deux valeurs.
    expect(viewPolicy({ view: 'top' }).pionsEnDisques).not.toBe(viewPolicy({ view: 'iso' }).pionsEnDisques);
  });

  it('LE DISQUE : fond au rayon de l’empreinte, portrait CLIPPÉ dedans, anneau d’équipe SUR ce disque', () => {
    const top = monter({ viewMode: 'top' });
    const g = pion(top, 'h1')!;
    const R = discR(1); // empreinte d'une case
    const cercles = [...g.querySelectorAll('circle')];
    const fond = cercles.find((c) => c.getAttribute('fill') !== 'none' && c.getAttribute('r') === String(R));
    expect(fond, 'un disque de fond au rayon de l’empreinte').toBeTruthy();
    // Le PORTRAIT : un `<svg>` imbriqué au cadrage de `tokenBodyKind` (chemin `faceFrame`), clippé au
    // disque — c'est la classification du classifieur qui décide, elle n'est pas rejouée ici.
    const portrait = g.querySelector('svg[viewBox]');
    expect(portrait, 'le corps est un portrait cadré').toBeTruthy();
    expect(portrait!.getAttribute('viewBox')).toBe(tokenBodyKind(findTrappingById, { kind: 'combatant', combatant: combatChromé().combatants[0] }, 'top').portraitBox);
    expect(portrait!.closest('g[clip-path]'), 'et il est CLIPPÉ au disque').toBeTruthy();
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
