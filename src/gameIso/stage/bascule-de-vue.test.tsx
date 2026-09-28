// @vitest-environment jsdom
/**
 * UN SEUL MONDE, DEUX REGARDS (#1385) — la bascule plateau ⇄ première personne (touche F, chemin réel
 * `store.togglePov`) mesurée sur l'écran de campagne MONTÉ.
 *
 * Quatre faits, chacun réfutable seul, chacun avec une panne coûteuse en face :
 *  1. le CANEVAS survit — un canevas neuf, c'est un contexte WebGL neuf, ses programmes et sa mémoire
 *     de textures repayés (mesuré à 1 558 ms / 6,5 Mo / 32 programmes sur l'arbre d'avant) ;
 *  2. le monde n'est PAS RECUIT — `data-bake` compte les cuissons payées depuis le montage ;
 *  3. les caches statiques ne sont pas PURGÉS — `viderTexturesStatiques` est keyé sur l'identité de la
 *     scène, et la scène ne change pas quand le regard change ;
 *  4. les quads SURVIVENT — la bascule ne change la population que du meneur (billboard de plateau,
 *     absent quand on regarde par ses yeux) : au plus UN quad perdu.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { emptyScene, type Scene } from '../../state/scene';
import { useGame } from '../../state/store';
import { createHero } from '../../engine/character';
import type { Combatant } from '../../engine/types';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseProject } from '../../state/worldMap';
import * as sceneMeshes from '../backends/webgl/sceneMeshes';
import { refEstVolumique, props as catalogueDeDecor } from '../../data';
import * as texturesStatiques from './texturesStatiques';
import { CampaignView } from '../../ui/CampaignView';
import { setStageRendererFactory } from './GameStage3D';
import { bakeQueueLength } from '../backends/webgl/atlasBake';
import { battreStageFrames } from './stageFrames';
import {
  BancRenderer,
  PLAFOND_ATTENTE_MS,
  attendreEntréeFinie,
  attendreQuads,
  attendreQue,
  brancherArdoise,
  canevas as canevasDe,
  quads,
  simulerRasterisation,
  scènes,
  viderCaptures,
} from './banc-volumique';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Budget de test calé AU-DESSUS du plafond d'attente du harnais (`PLAFOND_ATTENTE_MS`) : ce banc
 *  monte l'ÉCRAN entier et attend la file cadencée du cuiseur. Sous un budget plus court, une attente
 *  qui va au bout de son plafond meurt sur le chronomètre de Vitest, et le banc accuse une lenteur là
 *  où sa PRÉMISSE a la réponse. */
vi.setConfig({ testTimeout: PLAFOND_ATTENTE_MS + 10_000 });

const TAILLE = { w: 800, h: 600 };

let root: Root | null = null;
let hôte: HTMLDivElement | null = null;

brancherArdoise();

/** Les `InstancedMesh` MONTÉS dont le nom passe le filtre, par NOM → identité + capacité. Les lots
 *  d'accents de sol se nomment `<kind>|<couleur>` (`backends/webgl/groundAccents`), les pools portent
 *  leur famille et leur créneau (`marques:*`, `marquesDyn:*`, `halos:*`). */
function instancies(filtre: (nom: string) => boolean): Map<string, { uuid: string; count: number }> {
  const out = new Map<string, { uuid: string; count: number }>();
  scènes[scènes.length - 1]?.traverse((o) => {
    const m = o as THREE.InstancedMesh;
    if (m.isInstancedMesh && filtre(m.name)) out.set(m.name, { uuid: m.uuid, count: m.count });
  });
  return out;
}

/** Les lots d'ACCENTS de sol (touffes, mouchetis) — semés une fois par scène, jamais par regard. */
const lotsAccents = () => instancies((n) => /^(tuft|speckle)\|/.test(n));

/** Les POOLS à capacité (marques de case, marques dynamiques, halos d'interaction). */
const pools = () => instancies((n) => /^(marques|marquesDyn|halos):/.test(n));

/** Ce qui a CHANGÉ d'identité entre deux relevés (nom → uuid), et ce qui a disparu. */
function remontes(avant: Map<string, { uuid: string; count: number }>, apres: Map<string, { uuid: string; count: number }>): string[] {
  const out: string[] = [];
  for (const [nom, a] of avant) {
    const b = apres.get(nom);
    if (!b) out.push(`${nom} (disparu)`);
    else if (b.uuid !== a.uuid) out.push(`${nom} (remonté)`);
    else if (b.count !== a.count) out.push(`${nom} (capacité ${a.count} → ${b.count})`);
  }
  return out;
}

const canevas = () => canevasDe(hôte!);
const cuissons = () => Number(canevas().dataset.bake ?? -1);

/**
 * DÉCOR ENCORE SERVI EN BILLBOARD par une scène — le plancher de population que ce banc exige avant
 * de comparer deux relevés. DÉRIVÉ (`refEstVolumique`), jamais un chiffre en dur : la vague volumique
 * (#1343) fait quitter le billboard à des refs lot par lot (mesuré sur le hub après #1644 : 51 décors,
 * dont 25 en faces cuites — tonneau, caisse, coffre, étagère, urne, pile, étal), et un seuil figé se
 * lirait comme « un quad en retard » là où il n'y a plus de quad du tout à attendre.
 */
const decorsBillboard = (sc: Scene): number =>
  sc.entities.filter((e) => e.kind === 'prop' && !refEstVolumique(e.ref)).length;

/** Une ref de décor encore BILLBOARD, DÉRIVÉE du catalogue : la scène d'arène ci-dessous a besoin de
 *  SUJETS DE QUAD à apparier — un décor à recette n'en pose aucun, et le banc mesurerait le vide. */
const REF_BILLBOARD = catalogueDeDecor.find((p) => !p.volume)!.id;

beforeAll(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', { configurable: true, get: () => TAILLE.w });
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientHeight', { configurable: true, get: () => TAILLE.h });
  setStageRendererFactory(() => new BancRenderer());
});
afterAll(() => setStageRendererFactory(null));

beforeEach(() => { simulerRasterisation(); });
afterEach(() => {
  if (root) { act(() => root!.unmount()); root = null; }
  if (hôte) { hôte.remove(); hôte = null; }
  useGame.setState({ povActive: false });
});

const HÉROS = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 7 });

/** Scène d'ARÈNE : douze décors semés autour du groupe — assez de sujets pour qu'un remontage se
 *  voie ; aucune toiture, donc aucun décor sous espace dégagé (la population ne varie que du meneur). */
function scèneArène(): Scene {
  const base = emptyScene(14, 14);
  const props = Array.from({ length: 12 }, (_, i) => ({
    id: `decor-${i}`,
    kind: 'prop',
    pos: { x: 3 + (i % 6) * 1, y: 3 + Math.floor(i / 6) * 2 },
    z: 0,
    ref: REF_BILLBOARD,
  })) as unknown as Scene['entities'];
  return { ...base, entities: props } as unknown as Scene;
}

/** La scène RÉELLE du jeu (le hub de l'arène, `scenes/arene/arene-projet.json`) : bâtiments, toitures
 *  et une soixantaine de sujets. C'est sur elle que la loi de dégagement MORD — sur une carte nue, les
 *  deux regards regardent la même chose et « rien ne remonte » serait vrai sans rien prouver. */
const HUB = parseProject(
  JSON.parse(readFileSync(join(__dirname, '../../scenes/arene/arene-projet.json'), 'utf8')),
).scenes.find((sc) => sc.id === 'arene-hub')!;

/** Le poste de départ authored du groupe (`heroStart`) — la même lecture que `store.startScene`. */
const DEPART = { ...(HUB.entities.find((e) => e.kind === 'heroStart')!.pos) };

/** Le hub monté, groupé à son départ authored, décor SERVI. */
async function monterHub(quadsAttendus = decorsBillboard(HUB)): Promise<void> {
  viderCaptures();
  useGame.setState({
    scene: HUB,
    mode: 'exploration',
    partyPos: { ...(DEPART) },
    party: [{ ...HÉROS, pos: { ...(DEPART) } } as Combatant],
    battle: null,
    dialogue: null,
    explored: {},
    povActive: false,
    pendingCascade: null,
  });
  hôte = document.createElement('div');
  document.body.appendChild(hôte);
  root = createRoot(hôte);
  await act(async () => { root!.render(<CampaignView />); });
  await attendreQuads(quadsAttendus, PLAFOND_ATTENTE_MS);
  expect(quads().length, `PRÉMISSE : le hub doit avoir monté ${quadsAttendus} boards — sans eux, rien de ce que ce banc compare n’est mesuré`)
    .toBeGreaterThanOrEqual(quadsAttendus);
}

/** Monte l'écran de campagne et attend son décor. Rien n'est mesuré tant que le décor n'est pas au
 *  complet. */
async function monterCampagne(): Promise<void> {
  viderCaptures();
  useGame.setState({
    scene: scèneArène(),
    mode: 'exploration',
    partyPos: { x: 7, y: 9 },
    party: [{ ...HÉROS, pos: { x: 7, y: 9 } } as Combatant],
    battle: null,
    dialogue: null,
    explored: {},
    povActive: false,
    pendingCascade: null,
  });
  hôte = document.createElement('div');
  document.body.appendChild(hôte);
  root = createRoot(hôte);
  await act(async () => { root!.render(<CampaignView />); });
  // 12 décors + le jeton du groupe : attendre le compte PLEIN, sinon un quad en retard passerait pour
  // un quad remonté.
  await attendreQuads(13, PLAFOND_ATTENTE_MS);
  expect(quads().length, 'PRÉMISSE : les 12 décors et le jeton du groupe doivent être montés — un quad en retard se lirait comme un quad remonté')
    .toBeGreaterThanOrEqual(13);
}

/**
 * La bascule de regard, telle que le jeu l'émet (touche F → `keybindings` → `togglePov`), et l'IMAGE
 * qu'elle fait peindre.
 *
 * Ce que le banc a besoin de voir arriver, c'est une image peinte APRÈS la bascule — c'est dans ce
 * rendu-là qu'un remontage libèrerait ses matériaux, recuirait le monde ou perdrait ses quads. C'est
 * un FAIT (`scènes`, l'accumulateur du renderer de banc), jamais une fenêtre de mur : 60 ms ne le
 * portent que sur une machine au repos.
 */
async function basculer(): Promise<void> {
  const marque = scènes.length;
  await act(async () => { useGame.getState().togglePov(); });
  await attendreQue(() => scènes.length > marque, PLAFOND_ATTENTE_MS);
  expect(scènes.length, 'PRÉMISSE : aucune image peinte après la bascule — le banc comparerait deux fois le même rendu')
    .toBeGreaterThan(marque);
  await battreAprèsLeFait();
}

/** Images battues APRÈS LE FAIT, avant de figer une assertion NÉGATIVE (#1442, patron
 *  `gabarits-en-file`) : la sortie d'attente est au PLUS TÔT — un remontage, une purge ou un recuit
 *  qui arriverait dans l'image suivante resterait hors du jugement. Le battement est celui du jeu
 *  (`battreStageFrames`, le rythme unique du stage), et chaque image est un FAIT affirmé. */
const IMAGES_APRES_LE_FAIT = 3;
async function battreAprèsLeFait(): Promise<void> {
  const fenêtre = scènes.length + IMAGES_APRES_LE_FAIT;
  await attendreQue(() => scènes.length >= fenêtre, PLAFOND_ATTENTE_MS, () => battreStageFrames());
  expect(scènes.length, `PRÉMISSE : la pompe d'images du banc doit battre après le fait — ${scènes.length} image(s) pour ${fenêtre} attendues`)
    .toBeGreaterThanOrEqual(fenêtre);
}

describe('Bascule de regard — le monde ne se démonte pas (#1385)', () => {
  it('le filet des seuils de population tient encore : le hub sert encore du décor en billboard', () => {
    expect(
      decorsBillboard(HUB),
      'la phase 4 de #1343 (mort du chemin billboard des props) fera tomber ce filet EXPRÈS : le seuil '
      + 'dérivé vaudrait 0 et les PRÉMISSES de ce banc ne mordraient plus — il faudra alors les '
      + 'reformuler sur la population de FACES, pas les laisser passer du vide.',
    ).toBeGreaterThan(0);
    expect(
      catalogueDeDecor.filter((p) => !p.volume).length,
      'plus aucune ref billboard au catalogue : la scène d’arène de ce banc ne poserait plus un seul quad',
    ).toBeGreaterThanOrEqual(2);
  });

  it('même canevas, même monde cuit, aucune purge de cache, au plus un quad perdu', async () => {
    await monterCampagne();
    const canevasAvant = canevas();
    const bakeAvant = cuissons();
    const quadsAvant = quads();
    // PRÉMISSES — sans canevas ni quads montés, « rien n'a changé » serait vrai du vide.
    expect(canevasAvant, 'aucun canevas monté : rien à mesurer').toBeTruthy();
    expect(quadsAvant.length, 'aucun board monté : rien à mesurer').toBeGreaterThan(0);
    expect(bakeAvant, 'la trace des cuissons est absente du canevas').toBeGreaterThan(0);

    const purge = vi.spyOn(texturesStatiques, 'viderTexturesStatiques');
    await basculer();

    // PRÉMISSE — la bascule a bien eu lieu.
    expect(useGame.getState().povActive, 'le regard n’a pas basculé').toBe(true);
    expect(canevas(), 'un canevas neuf = contexte WebGL, programmes et textures repayés').toBe(canevasAvant);
    expect(cuissons(), 'le monde a été RECUIT pour un simple changement de regard').toBe(bakeAvant);
    expect(purge, 'les caches statiques sont purgés alors que la scène n’a pas changé').not.toHaveBeenCalled();
    const quadsAprès = quads();
    const survivants = quadsAprès.filter((m) => quadsAvant.includes(m)).length;
    expect(quadsAvant.length - survivants,
      'la bascule ne retire QUE le billboard du meneur : tout le reste est apparié par identité')
      .toBeLessThanOrEqual(1);
  });

  it('le retour au plateau ne démonte pas davantage le monde', async () => {
    await monterCampagne();
    const canevasAvant = canevas();
    const bakeAvant = cuissons();
    await basculer();
    await attendreQuads(12);
    const quadsPov = quads();
    expect(quadsPov.length, 'aucun board monté en première personne : rien à mesurer').toBeGreaterThan(0);

    const purge = vi.spyOn(texturesStatiques, 'viderTexturesStatiques');
    await basculer();

    expect(useGame.getState().povActive, 'le regard n’est pas revenu au plateau').toBe(false);
    expect(canevas(), 'l’aller-retour a remonté un canevas').toBe(canevasAvant);
    expect(cuissons(), 'l’aller-retour a recuit le monde').toBe(bakeAvant);
    expect(purge, 'l’aller-retour purge les caches statiques').not.toHaveBeenCalled();
    const survivants = quads().filter((m) => quadsPov.includes(m)).length;
    expect(quadsPov.length - survivants, 'le retour au plateau perd des quads du décor').toBeLessThanOrEqual(1);
  });
});

describe('Bascule de regard — la molette survit à l’aller-retour (#1385)', () => {
  it('après POV puis retour au plateau, la molette zoome encore', async () => {
    await monterCampagne();
    await basculer();
    await basculer();

    const svg = hôte!.querySelector('svg.iso-stage') as SVGSVGElement;
    expect(svg, 'aucune surcouche de plateau montée : rien à mesurer').toBeTruthy();
    const zoomAvant = useGame.getState().zoom;
    await act(async () => {
      svg.dispatchEvent(new WheelEvent('wheel', { deltaY: -200, cancelable: true, bubbles: true }));
    });

    expect(useGame.getState().zoom,
      'la molette est morte : son écoute était liée au SVG du premier montage').not.toBe(zoomAvant);
  });
});

// ————————————————————————————————————————————————
// LA SCÈNE RÉELLE — quatre bascules d'affilée sur le hub de l'arène
// ————————————————————————————————————————————————

/**
 * CE QUI MORD ICI, MESURÉ : la rétention est keyée sur les tranches de `worldBakeDeps` — les six
 * historiques (`layers`, `dimensions`, `walls`, `architecture`, `metresPerTile`, `mpt`), comparées par
 * identité, plus la SIGNATURE du mobilier volumique et les recettes qu'il fait lire.
 * Reforger l'objet `scene` en surface (`{ ...scene }`) ne recuit donc RIEN — mesuré : mutation VERTE,
 * et c'est la force du patron. Ce qui recuit, c'est une TRANCHE reforgée (`{ ...scene, layers: [...] }`)
 * — mutation ROUGE, 10 cuissons. Une bascule de regard n'en touche aucune : c'est ce que ce banc tient.
 */
describe('Bascule de regard — la CUISSON du monde ne se rejoue jamais (#1385)', () => {
  it('quatre bascules et un pas entre chacune : pas une seule cuisson de plus', async () => {
    await monterHub();
    // PRÉMISSE de la mesure de voile : l'entrée en scène DU MONTAGE doit être finie avant qu'on
    // compte les bascules. `attendreQuads` ne l'assure pas (elle attend des billboards, le voile
    // attend en plus tous les gabarits de face, servis au rang le plus bas) — mesuré à 348 tâches
    // encore en file au retour, voile levé, et tombé 240 ms plus tard.
    await attendreEntréeFinie(hôte!, PLAFOND_ATTENTE_MS);
    const quadsAvant = quads();
    expect(quadsAvant.length, 'aucun board monté : rien à mesurer').toBeGreaterThan(0);
    // PRÉMISSE DE MESURE : le MONTAGE a fini de cuire. Sous charge, une cuisson de BOOT tombait dans la
    // fenêtre de mesure et se lisait comme un recuit de bascule (flake mesuré 1/7 à cache froid). Le
    // fait qui la ferme n'est pas une trace STABLE d'une tranche à l'autre — une stabilité sur
    // fenêtre de mur est la même prémisse de vitesse — c'est la file du cuiseur VIDE : plus rien
    // n'attend, donc plus une cuisson de boot ne peut tomber dans la mesure.
    // L'attente MORD : la file porte encore 72 / 10 / 10 tâches à l'entrée sur trois rejeux — elle
    // n'est jamais vide d'emblée, donc ce qu'elle ferme est bien une cuisson de boot qui court.
    await attendreQue(() => bakeQueueLength() === 0, PLAFOND_ATTENTE_MS);
    expect(bakeQueueLength(), 'PRÉMISSE : la file du cuiseur du MONTAGE doit être vide avant de compter les cuissons de bascule')
      .toBe(0);
    expect(canevas().dataset.voile, 'PRÉMISSE : le voile du montage n’est pas tombé, il n’y a pas de réarmement à mesurer')
      .toBeUndefined();
    const bakeAvant = cuissons();

    const cuisson = vi.spyOn(sceneMeshes, 'bakeWorldGeometry');
    for (let b = 0; b < 4; b++) {
      await basculer();
      // Un PAS entre deux bascules, comme au jeu : la vision change, le dégagement aussi — et la
      // cuisson, elle, ne dépend que de la scène (`worldBakeDeps`), donc de rien de tout cela. Le pas
      // se juge sur l'IMAGE qu'il fait peindre, jamais sur 60 ms de mur : c'est dans ce rendu qu'une
      // dep reforgée recuirait le monde.
      const marque = scènes.length;
      await act(async () => { useGame.getState().stepPartyDir(b % 2 ? 'down' : 'up'); });
      await attendreQue(() => scènes.length > marque, PLAFOND_ATTENTE_MS);
      expect(scènes.length, 'PRÉMISSE : aucune image peinte après le pas — un recuit de pas resterait hors de la mesure')
        .toBeGreaterThan(marque);
      await battreAprèsLeFait();
    }

    expect(cuisson, 'le monde est RECUIT en route : une dep de `worldBakeDeps` a changé d’identité')
      .not.toHaveBeenCalled();
    expect(cuissons(), 'la trace de cuisson du canevas a bougé').toBe(bakeAvant);
    expect(canevas().dataset.voile, 'l’entrée en scène s’est réarmée : l’écran a été remonté').toBeUndefined();
  });
});

describe('Bascule de regard — le décor de la scène réelle survit (#1385)', () => {
  it('sur le hub, chaque bascule ne perd que le meneur — aller comme retour', async () => {
    await monterHub();
    let avant = quads();
    expect(avant.length, 'aucun board monté : rien à mesurer').toBeGreaterThan(0);
    for (let b = 0; b < 4; b++) {
      await basculer();
      const après = quads();
      const survivants = après.filter((m) => avant.includes(m)).length;
      expect(avant.length - survivants,
        `bascule ${b + 1} : le décor de la scène réelle remonte au lieu d’être apparié par identité`)
        .toBeLessThanOrEqual(1);
      avant = après;
    }
  });

  it('bascule pendant que la file du cuiseur SERT ENCORE : aucun quad perdu', async () => {
    // Montage à file NON VIDE : on ne laisse pas le cuiseur finir. C'est le cas où le décor a été vu
    // à zéro survivant en recette — une bascule qui arrive pendant le service.
    await monterHub(10);
    const enFile = Number(canevas().dataset.file ?? 0);
    const avant = quads();
    expect(avant.length, 'aucun board monté : rien à mesurer').toBeGreaterThan(0);
    expect(enFile, 'la file est déjà vide : ce banc ne mesure pas ce qu’il annonce').toBeGreaterThan(0);

    await basculer();

    const survivants = quads().filter((m) => avant.includes(m)).length;
    expect(avant.length - survivants,
      'une bascule pendant le service de la file perd le décor déjà posé').toBeLessThanOrEqual(1);
  });
});

// ————————————————————————————————————————————————
// ON REGARDE PAR SES YEUX — le meneur ne porte aucun billboard en première personne
// ————————————————————————————————————————————————

describe('Bascule de regard — en POV, le meneur n’est PAS un sujet du monde (#1385)', () => {
  it('aucun billboard pour le meneur à hauteur d’œil — et il revient sur le plateau', async () => {
    // Les ACTEURS que le monde envoie à la passe de billboards — la population réelle, jeton de groupe
    // compris (il y est POUSSÉ par `VolumetricWorld`, après les jetons du builder).
    const sujets = vi.spyOn(sceneMeshes, 'actorBillboards');
    await monterHub();
    const meneurId = useGame.getState().party[0]!.id;
    // La DERNIÈRE passe, jamais leur cumul : sous charge, un banc voisin peut faire re-rendre l'écran
    // plusieurs fois, et un cumul mélangerait deux regards dans une même lecture.
    const idsDe = () => {
      const dernier = sujets.mock.calls[sujets.mock.calls.length - 1];
      return dernier ? (dernier[0] as readonly { c: { id: string } }[]).map((a) => a.c.id) : [];
    };

    // PRÉMISSE — sur le plateau, le meneur EST un sujet : sans lui, « il n'y est pas en POV » ne dirait
    // rien (la sonde mesurerait une population vide).
    expect(sujets.mock.calls.length, 'aucune passe d’acteurs au montage : la sonde ne mord pas').toBeGreaterThan(0);
    const idsPlateau = idsDe();
    expect(idsPlateau, 'le jeton de groupe n’est pas posté sur le plateau').toContain(meneurId);

    sujets.mockClear();
    await basculer();
    // PRÉMISSE — l'écran REGARDE bien à hauteur d'œil au moment de la lecture.
    expect(canevas().dataset.vue, 'le canevas ne rend pas en première personne : la sonde lit un autre regard').toBe('pov');

    // Aucune passe rejouée à la bascule = population INCHANGÉE (la rétention n'a rien vu bouger) : la
    // lecture honnête est alors celle du plateau, pas un ensemble vide qui rendrait le verdict gratuit.
    const idsPov = sujets.mock.calls.length ? idsDe() : idsPlateau;
    expect(idsPov,
      'le meneur se voit LUI-MÊME à sa case : on regarde par ses yeux, il ne porte aucun billboard')
      .not.toContain(meneurId);

    // TÉMOIN — de retour sur le plateau, il redevient un sujet.
    sujets.mockClear();
    await basculer();
    expect(canevas().dataset.vue, 'le canevas n’est pas revenu au plateau').toBe('plateau');
    expect(sujets.mock.calls.length ? idsDe() : idsPov,
      'le jeton de groupe n’est pas revenu sur le plateau').toContain(meneurId);
  });
});

// ————————————————————————————————————————————————
// LES DEUX AUTRES SURVIVANTS DU DoD : les LOTS D'ACCENTS et les POOLS
// ————————————————————————————————————————————————

describe('Bascule de regard — accents de sol et pools SURVIVENT (#1385)', () => {
  it('aller-retour : les lots d’accents gardent leur identité ET leur capacité', async () => {
    await monterHub();
    const avant = lotsAccents();
    // PRÉMISSE — sans lot semé, « rien n'est remonté » serait vrai du vide.
    expect(avant.size, 'aucun lot d’accents semé : rien à mesurer').toBeGreaterThan(0);

    await basculer();
    const pov = lotsAccents();
    expect(remontes(avant, pov),
      'le semis d’accents est REFAIT à la bascule : un `InstancedMesh` par lot, repayé pour un regard')
      .toEqual([]);

    await basculer();
    expect(remontes(avant, lotsAccents()),
      'le semis d’accents est refait au RETOUR au plateau').toEqual([]);
  });

  it('aller-retour : les pools à capacité gardent leur identité ET leur capacité', async () => {
    await monterHub();
    const avant = pools();
    // PRÉMISSE — même raison : un pool absent ne prouve rien.
    expect(avant.size, 'aucun pool monté : rien à mesurer').toBeGreaterThan(0);

    await basculer();
    expect(remontes(avant, pools()),
      'un pool est REMONTÉ à la bascule : il ne naît qu’au palier de capacité, jamais au regard')
      .toEqual([]);

    await basculer();
    expect(remontes(avant, pools()),
      'un pool est remonté au RETOUR au plateau').toEqual([]);
  });
});
