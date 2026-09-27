// @vitest-environment jsdom
/**
 * UN PAS D'EXPLORATION EST UNE REPOSE — mesuré sur l'écran monté, au chemin RÉEL du pas clavier
 * (`store.stepPartyDir` : émission de la marche, puis `moveParty`, donc champ de vision NEUF).
 *
 * Trois faits, chacun réfutable seul, chacun avec une panne coûteuse en face :
 *  1. les quads SURVIVENT au pas — aucun `dispose`, aucune identité perdue (le rebuild du groupe
 *     entier libérait ~126 matériaux/géométries par pas et laissait 0/63 quads : le personnage
 *     DISPARAISSAIT de l'écran jusqu'au retour de la file, 426-496 ms plus tard) ;
 *  2. le pas ne passe qu'UNE seule teinte : `visible` puis l'accumulation de l'exploré en
 *     produisaient deux, donc deux fois toute la cascade ;
 *  3. la marche PEINT : le glissement du jeton tient le battement du stage, images à l'appui.
 *
 * La TEINTE elle-même (un corps sorti du champ s'assombrit sans remontage) se mesure sur l'écran nu
 * plus bas, où le champ de vision est une entrée du banc et non une conséquence de la scène.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { emptyScene, sceneMetresPerTile, type Scene } from '../../state/scene';
import { useGame } from '../../state/store';
import { createHero } from '../../engine/character';
import { makeRNG } from '../../engine/dice';
import type { Combatant } from '../../engine/types';
import type { BillboardPropEl } from '../builders/types';
import type { ActorPose, KeepEl, SceneBillboardEls, TintAt } from '../backends/webgl/sceneMeshes';
import * as sceneMeshes from '../backends/webgl/sceneMeshes';
import * as visibilityTint from '../backends/webgl/visibilityTint';
import * as actorAnimSelect from '../rig/anim/actorAnimSelect';
import { gabaritTint } from '../../ui/editor/lowerLayerGabarit';
import { staticTexturePins } from '../backends/webgl/svgTexture';
import { MondeDeCampagne } from './MondeDeCampagne';
import { GameStage3D, setStageRendererFactory, type StageFrame, type StageWalkAnim } from './GameStage3D';
import { BancRenderer, brancherArdoise, quads, rendus as rendusDe, respirer, simulerRasterisation, viderCaptures } from './banc-volumique';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TAILLE = { w: 800, h: 600 };

let root: Root | null = null;
let hôte: HTMLDivElement | null = null;

const rendus = () => rendusDe(hôte!);

brancherArdoise();

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
});

// ————————————————————————————————————————————————————————————————
// LE PAS, AU CHEMIN RÉEL — `MondeDeCampagne` monté sur le store, pas clavier compris
// ————————————————————————————————————————————————————————————————

const HÉROS = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', rng: makeRNG(7) });

/** Scène d'ARÈNE : douze décors semés autour du groupe (assez de sujets pour qu'un rebuild se voie)
 *  et un MUR qui coupe la vue — sans lui, tout est vu dès le montage et un pas ne découvre RIEN : le
 *  champ de vision ne bougerait pas, et la sonde de teinte mesurerait une scène sans brouillard. */
function scèneArène(): Scene {
  const base = emptyScene(14, 14);
  const props = Array.from({ length: 12 }, (_, i) => ({
    id: `tonneau-${i}`,
    kind: 'prop',
    pos: { x: 3 + (i % 6) * 1, y: 3 + Math.floor(i / 6) * 2 },
    z: 0,
    ref: 'tonneau',
  })) as unknown as Scene['entities'];
  // Une CLOISON percée d'une porte en x = 7 : le groupe, posté au sud, ne voit du nord que le cône
  // qui passe par l'ouverture — et le pas qui s'en approche en DÉCOUVRE, ce qui est tout l'objet du
  // banc (sans cloison, la carte entière est vue dès le montage et un pas ne découvre rien).
  const murs = Array.from({ length: 14 }, (_, x) => x).filter((x) => x !== 7).map((x) => ({ x, y: 7, side: 'N' }));
  return { ...base, entities: props, walls: murs } as unknown as Scene;
}

async function monterIso(): Promise<void> {
  viderCaptures();
  useGame.setState({
    scene: scèneArène(),
    mode: 'exploration',
    partyPos: { x: 7, y: 9 },
    party: [{ ...HÉROS, pos: { x: 7, y: 9 } } as Combatant],
    battle: null,
    dialogue: null,
    explored: {},
    // `stepPartyDir` projette la direction poussée avec le REGARD du store (`camRot`/`viewMode`/
    // `camEdge`) : ce banc l'épingle, la suite se passant le store en l'état (`isolate: false`).
    camRot: 0,
    viewMode: 'iso',
    camEdge: false,
  });
  hôte = document.createElement('div');
  document.body.appendChild(hôte);
  root = createRoot(hôte);
  await act(async () => { root!.render(<MondeDeCampagne />); });
  // 12 décors + le jeton du groupe : attendre le compte PLEIN, sinon un quad en retard passerait pour
  // un quad remonté.
  for (let i = 0; i < 40 && quads().length < 13; i++) await respirer(20);
}

/** Un PAS clavier, tel que le jeu l'émet (`keybindings` → `stepPartyDir`). */
async function pas(dir: 'up' | 'down' | 'left' | 'right'): Promise<void> {
  await act(async () => { useGame.getState().stepPartyDir(dir); });
  await respirer(60);
}

describe('Pas d’exploration — les quads SURVIVENT (#1396)', () => {
  it('ni matériau ni géométrie libérés, et pas un seul quad remplacé', async () => {
    await monterIso();
    const avant = quads();
    // PRÉMISSE — sans quads montés, « rien n'est libéré » serait vrai du vide.
    expect(avant.length, 'aucun board monté : rien à mesurer').toBeGreaterThan(0);
    const posAvant = useGame.getState().partyPos;
    const disposeMat = vi.spyOn(THREE.Material.prototype, 'dispose');
    const disposeGeo = vi.spyOn(THREE.BufferGeometry.prototype, 'dispose');

    await pas('down');

    // PRÉMISSE — le pas a bien eu lieu : sans déplacement, « rien n'est libéré » ne dit rien.
    expect(useGame.getState().partyPos, 'le pas n’a pas bougé le groupe').not.toEqual(posAvant);
    expect(disposeMat, 'le groupe entier se libère à chaque pas : c’est LE gel signalé').not.toHaveBeenCalled();
    expect(disposeGeo, 'une géométrie de quad refaite au pas, c’est une repose ratée').not.toHaveBeenCalled();
    const après = quads();
    expect(après.length, 'le compte de quads ne change pas d’un pas à l’autre').toBe(avant.length);
    expect(après.filter((m) => avant.includes(m)).length, 'les quads doivent être les MÊMES objets').toBe(avant.length);
  });

  it('les SUJETS ne se reforgent pas : le décor du pas est le décor d’avant', async () => {
    await monterIso();
    const décor = vi.spyOn(sceneMeshes, 'collectBillboards');

    await pas('down');

    expect(décor, 'un tableau d’éléments neuf pour un décor identique reforge tous les sujets').not.toHaveBeenCalled();
  });

  it('un pas ne passe qu’UNE seule teinte (le champ de vision, pas deux)', async () => {
    await monterIso();
    const champ = vi.spyOn(visibilityTint, 'visibilityField');

    const exploréAvant = (useGame.getState().explored[useGame.getState().scene!.id] ?? []).length;

    await pas('up');

    // PRÉMISSE — le pas DÉCOUVRE : sans cases neuves, l'accumulation de l'exploré ne recommet rien et
    // « une seule teinte » serait vrai de rien.
    expect((useGame.getState().explored[useGame.getState().scene!.id] ?? []).length,
      'le pas n’a rien découvert : la sonde ne mord pas').toBeGreaterThan(exploréAvant);

    // `visible` puis l'accumulation de l'exploré en passaient DEUX : deux champs de teinte, donc deux
    // fois toute la cascade qui en descend (teinte du monde, accents, corps) — et, avant #1396, deux
    // remontages complets du groupe de billboards.
    expect(champ.mock.calls.length, 'le pas dérive le champ de teinte plus d’une fois').toBe(1);
  });

  it('la MARCHE peint : le glissement du jeton tient le battement du stage, hors de tout commit', async () => {
    await monterIso();
    // Le pas COMMIT (position, vision, teinte) : ces images-là ne prouvent rien sur le glissement.
    await act(async () => { useGame.getState().stepPartyDir('up'); });
    const avant = rendus();

    // …puis on laisse courir le GLISSEMENT, sans toucher au store : plus aucun commit React ne
    // survient, et ce qui peint ici ne peut être que le battement de la marche.
    await respirer(40);

    expect(rendus() - avant, 'aucune image peinte pendant le glissement : le jeton saute à l’arrivée').toBeGreaterThan(0);
  });
});

// ————————————————————————————————————————————————————————————————
// LA TEINTE — écran nu, champ de vision passé à la main
// ————————————————————————————————————————————————————————————————

const SCENE_NUE: Scene = emptyScene(12, 12);
const MPT = sceneMetresPerTile(SCENE_NUE);
const ACTEURS: ActorPose[] = [{ c: HÉROS, x: 4, y: 4, z: 0, facing: 'S' }];
const KEEP: KeepEl = () => true;
const CADRE: StageFrame = { mode: 'plateau', dims: { ...SCENE_NUE.dimensions, rot: 0, view: 'iso', yawDeg: 0 }, cam: { x: 6, y: 6 }, zoom: 1 };
let battre: (() => void) | null = null;
const anim: StageWalkAnim = {
  subscribe: (onFrame) => { battre = onFrame; return () => { battre = null; }; },
  glide: () => null,
  cam: () => ({ x: 6, y: 6 }),
};

const décor = (id: string, x: number): BillboardPropEl => ({
  kind: 'prop', source: 'entity', key: `prop:${id}`, entId: id, span: { w: 1, h: 1 }, ref: 'tonneau', facing: 'S',
  cell: { x, y: 4, z: 0 }, foot: { offX: 0, offY: 0, scale: 1 },
  states: { visible: true },
});
const DECORS: BillboardPropEl[] = [décor('a', 6), décor('b', 7), décor('c', 8)];
const ELS: SceneBillboardEls = { tokens: [], props: DECORS };

/** TEINTE PLEINE partout, puis TEINTE SORTIE DU CHAMP pour la case du décor `b` (x = 7). */
const PLEINE: TintAt = () => 1;
const SORTIE: TintAt = (x) => (x === 7 ? 0.35 : 1);

function écran(tintAt: TintAt, actors: ActorPose[] = ACTEURS, els: SceneBillboardEls = ELS): JSX.Element {
  return (
    <GameStage3D
      scene={SCENE_NUE}
      mpt={MPT}
      frame={CADRE}
      tintAt={tintAt}
      keepEl={KEEP}
      els={els}
      actors={actors}
      gameTime={720}
      lightLevel={1}
      lights={[]}
      anim={anim}
    />
  );
}

async function monterNu(): Promise<void> {
  viderCaptures();
  hôte = document.createElement('div');
  document.body.appendChild(hôte);
  root = createRoot(hôte);
  await act(async () => { root!.render(écran(PLEINE)); });
  for (let i = 0; i < 40 && quads().length < ELS.props.length + ACTEURS.length; i++) {
    await respirer(20);
    if (battre) act(() => battre!());
  }
}

describe('Champ de vision NEUF — la teinte se repose sans remonter un seul quad (#1396)', () => {
  it('le quad d’un corps sorti du champ s’assombrit, et c’est le MÊME quad', async () => {
    await monterNu();
    const avant = quads();
    expect(avant.length, 'aucun board monté : rien à mesurer').toBeGreaterThan(0);
    const couleurs = avant.map((m) => (m.material as THREE.MeshBasicMaterial).color.clone());
    const disposeMat = vi.spyOn(THREE.Material.prototype, 'dispose');

    await act(async () => { root!.render(écran(SORTIE)); });

    const après = quads();
    expect(disposeMat, 'un champ de vision neuf ne doit libérer aucun matériau').not.toHaveBeenCalled();
    expect(après.filter((m) => avant.includes(m)).length, 'les quads doivent être les MÊMES objets').toBe(avant.length);
    // …et la teinte est bien ARRIVÉE au matériau : un seul quad s'assombrit, celui de la case sortie.
    const assombris = après.filter((m, i) => (m.material as THREE.MeshBasicMaterial).color.r < couleurs[i].r - 1e-6);
    expect(assombris.length, 'la teinte de visibilité n’atteint plus les corps').toBeGreaterThan(0);
    const inchangés = après.filter((m, i) => (m.material as THREE.MeshBasicMaterial).color.equals(couleurs[i]));
    expect(inchangés.length, 'toute la planche s’assombrit : la teinte n’est pas prise à la CASE').toBeGreaterThan(0);
  });
});

/**
 * LE PAS D'UN ACTEUR, et le chemin de l'ÉDITEUR — l'écran monté EN DIRECT, sans hôte de jeu. Ce
 * montage-là est celui de `ui/editor/EditorCanvas` : ce qui n'est pas résolu ICI ne l'est pour
 * personne (un correctif posé chez un hôte ne vaut que pour lui).
 */
describe('Écran nu — un pas d’acteur et un lot d’éléments neuf ne remontent RIEN (#1396)', () => {
  it('un acteur qui change de case : le DÉCOR survit en entier, et l’acteur avec lui', async () => {
    await monterNu();
    const avant = quads();
    expect(avant.length, 'aucun board monté : rien à mesurer').toBeGreaterThan(0);
    const posAvant = avant.map((m) => m.position.clone());
    const disposeMat = vi.spyOn(THREE.Material.prototype, 'dispose');
    const ailleurs: ActorPose[] = [{ c: HÉROS, x: 5, y: 4, z: 0, facing: 'S' }];

    await act(async () => {
      root!.render(
        <GameStage3D scene={SCENE_NUE} mpt={MPT} frame={CADRE} tintAt={PLEINE} keepEl={KEEP} els={ELS}
          actors={ailleurs} gameTime={720} lightLevel={1} lights={[]} anim={anim} />,
      );
    });

    expect(disposeMat, 'un pas d’acteur libère le groupe entier : c’est LE gel signalé').not.toHaveBeenCalled();
    const après = quads();
    expect(après.filter((m) => avant.includes(m)).length, 'les quads doivent être les MÊMES objets').toBe(avant.length);
    // …et l'acteur a bien SUIVI sa case : la repose de pose écrit l'ancre, la pose de frame la peint.
    const déplacés = après.filter((m, i) => !m.position.equals(posAvant[i]));
    expect(déplacés.length, 'aucun quad n’a suivi : l’acteur est resté à sa case de départ').toBe(1);
  });

  it('…et sa TEINTE est celle de la case d’ARRIVÉE, pas celle du départ', async () => {
    // Champ où SEULE la case d'arrivée est sombre : un sujet dont la case reste celle du montage
    // garderait sa couleur pleine — c'est exactement ce que la repose doit écrire.
    const arrivéeSombre: TintAt = (x, y) => (x === 5 && y === 4 ? 0.3 : 1);
    await monterNu();
    await act(async () => { root!.render(écran(arrivéeSombre)); });
    const avant = quads();
    const couleurs = avant.map((m) => (m.material as THREE.MeshBasicMaterial).color.clone());
    expect(avant.length, 'aucun board monté : rien à mesurer').toBeGreaterThan(0);

    await act(async () => { root!.render(écran(arrivéeSombre, [{ c: HÉROS, x: 5, y: 4, z: 0, facing: 'S' }])); });

    const assombris = quads().filter((m, i) => (m.material as THREE.MeshBasicMaterial).color.r < couleurs[i].r - 1e-6);
    expect(assombris.length, 'la case du sujet n’a pas suivi : sa teinte reste celle du départ').toBe(1);
  });

  it('un acteur qui PIVOTE sur place ne remonte pas le groupe', async () => {
    await monterNu();
    const avant = quads();
    const disposeMat = vi.spyOn(THREE.Material.prototype, 'dispose');

    // MÊME case, autre cap : le pivot ne change que le REGARD porté sur le corps.
    await act(async () => { root!.render(écran(PLEINE, [{ c: HÉROS, x: 4, y: 4, z: 0, facing: 'E' }])); });

    expect(disposeMat, 'un pivot sur place remonte le groupe').not.toHaveBeenCalled();
    expect(quads().filter((m) => avant.includes(m)).length, 'les quads doivent être les MÊMES objets').toBe(avant.length);
    // Ce que le cap DEVIENT sur les sujets montés — donc l'art que la frame ira chercher — se mesure
    // sur la couture elle-même (`reposerActeurs`, banc de `sceneMeshes`) : ici, l'art d'un corps à
    // flipbook change aussi au fil des planches qui arrivent, et « la texture a changé » ne
    // distinguerait pas les deux causes.
  });

  it('un lot d’éléments NEUF au contenu IDENTIQUE (tick d’outil de l’éditeur) ne remonte aucun quad', async () => {
    await monterNu();
    const avant = quads();
    expect(avant.length, 'aucun board monté : rien à mesurer').toBeGreaterThan(0);
    const disposeMat = vi.spyOn(THREE.Material.prototype, 'dispose');
    // Le cas COURANT de l'éditeur : les builders rendent un tableau neuf à chaque tick d'outil.
    const neuf: SceneBillboardEls = { tokens: [], props: DECORS.map((p) => ({ ...p, cell: { ...p.cell }, foot: { ...p.foot } })) };

    await act(async () => {
      root!.render(
        <GameStage3D scene={SCENE_NUE} mpt={MPT} frame={CADRE} tintAt={PLEINE} keepEl={KEEP} els={neuf}
          actors={ACTEURS} gameTime={720} lightLevel={1} lights={[]} anim={anim} />,
      );
    });

    expect(disposeMat, 'un lot d’éléments neuf pour un décor identique remonte les quads').not.toHaveBeenCalled();
    expect(quads().filter((m) => avant.includes(m)).length, 'les quads doivent être les MÊMES objets').toBe(avant.length);
  });
});

/**
 * UN CORPS ANIMÉ EST UN MOTIF (#1396) — sa planche se choisit PAR IMAGE (`choisirFrame`) : respiration
 * au repos, cycle de marche, effondrement d'un corps à terre, et la vue que le regard COURANT demande.
 * Sans battement tenu, ces trois-là n'avancent qu'aux commits React : idle par à-coups, chute figée en
 * l'air, et un quart de tour qui laisse le corps de dos.
 */
describe('Corps animé — il tient le battement du stage (#1396)', () => {
  it('un acteur au repos fait peindre des images sans qu’aucun commit ne survienne', async () => {
    await monterNu();
    const avant = rendus();

    // Aucun rendu React ici : on laisse seulement passer le temps.
    await respirer(60);

    expect(rendus() - avant, 'aucune image hors commit : l’idle, la chute et la vue s’arrêtent').toBeGreaterThan(0);
  });
});

/**
 * POPULATION QUI CHANGE (#1396) — un sujet ENTRE dans le champ de vision, un autre en SORT. Mesuré en
 * recette : 63→62 sujets libérait les 63 quads (0 survivant, ~250 buffers, 2 `linkProgram`) pour un
 * seul partant. Le montage est une DIFFÉRENCE : ce qui persiste garde son quad.
 */
describe('Montage par DIFFÉRENCE — un entrant ne remonte pas la scène (#1396)', () => {
  const quatrième = décor('d', 9);

  it('un sujet qui SORT : lui seul est démonté, les autres gardent leur uuid', async () => {
    await monterNu();
    const avant = quads();
    expect(avant.length, 'aucun board monté : rien à mesurer').toBeGreaterThan(0);
    const uuids = avant.map((m) => m.uuid);
    const disposeMat = vi.spyOn(THREE.Material.prototype, 'dispose');
    const sansB: SceneBillboardEls = { tokens: [], props: [ELS.props[0], ELS.props[2]] };

    await act(async () => { root!.render(écran(PLEINE, ACTEURS, sansB)); });
    await respirer(40);

    const après = quads();
    expect(après.length, 'le sortant n’a pas été démonté').toBe(avant.length - 1);
    expect(après.every((m) => uuids.includes(m.uuid)), 'les survivants ont changé d’objet').toBe(true);
    // Un seul corps libéré : son matériau (et celui de son jumeau/ombre s'il en a), jamais la planche.
    expect(disposeMat.mock.calls.length, 'le groupe entier se libère pour UN sortant').toBeLessThanOrEqual(3);
  });

  it('un sujet qui ENTRE : lui seul est monté, les autres gardent leur uuid', async () => {
    await monterNu();
    const avant = quads();
    const uuids = avant.map((m) => m.uuid);
    const disposeMat = vi.spyOn(THREE.Material.prototype, 'dispose');
    const avecD: SceneBillboardEls = { tokens: [], props: [...ELS.props, quatrième] };

    await act(async () => { root!.render(écran(PLEINE, ACTEURS, avecD)); });
    for (let i = 0; i < 20 && quads().length <= avant.length; i++) {
      await respirer(20);
      if (battre) act(() => battre!());
    }

    const après = quads();
    expect(après.length, 'l’entrant n’est pas monté').toBe(avant.length + 1);
    expect(uuids.every((u) => après.some((m) => m.uuid === u)), 'les survivants ont été remontés').toBe(true);
    expect(disposeMat, 'un entrant ne libère rien').not.toHaveBeenCalled();
  });
});

/**
 * ÉPINGLES DE TEXTURE — elles suivent la POPULATION, pas les seuls quads (#1396). Un sujet est épinglé
 * dès que sa texture est DEMANDÉE, avant qu'un quad n'existe : supersédé entre-temps, il n'a jamais de
 * board pour le purger, et il reste épinglé à vie — avec les closures de dessin qu'il capture
 * (mesuré en recette : 20 épingles pour 5 quads après six passes).
 */
describe('Épingles — jamais plus que ce qui est à l’écran (#1396)', () => {
  it('six passes de population alternée ne laissent aucune épingle orpheline', async () => {
    await monterNu();
    const alterné = (i: number): SceneBillboardEls => ({
      tokens: [],
      props: i % 2 ? [ELS.props[0], décor(`x${i}`, 9 + i)] : [...ELS.props, décor(`y${i}`, 10 + i)],
    });
    // Les passes s'enchaînent SANS laisser la file servir : chaque sujet neuf est épinglé dès la
    // demande de sa texture, puis supersédé avant d'avoir un quad — c'est le cas qui fuit.
    for (let i = 0; i < 6; i++) act(() => { root!.render(écran(PLEINE, ACTEURS, alterné(i))); });
    await respirer(60);
    if (battre) act(() => battre!());

    expect(staticTexturePins().size, 'des épingles survivent aux sujets qui les ont posées')
      .toBeLessThanOrEqual(quads().length);
  });
});

/**
 * CHANGEMENT DE SCÈNE — il DISPOSE les textures statiques (`viderTexturesStatiques`). Un survivant de
 * la différence garderait une texture morte : la scène entre donc dans la BASE de montage, et une
 * scène neuve est un REBUILD, jamais une différence (#1396).
 */
describe('Scène neuve — le montage repart de zéro (#1396)', () => {
  it('un décor de même identité dans une AUTRE scène ne réutilise pas le quad', async () => {
    await monterNu();
    const avant = quads();
    expect(avant.length, 'aucun board monté : rien à mesurer').toBeGreaterThan(0);
    const uuids = avant.map((m) => m.uuid);
    const autreScène: Scene = emptyScene(12, 12); // une AUTRE scène : autre id, autres couches

    await act(async () => {
      root!.render(
        <GameStage3D scene={autreScène} mpt={MPT} frame={CADRE} tintAt={PLEINE} keepEl={KEEP} els={ELS}
          actors={ACTEURS} gameTime={720} lightLevel={1} lights={[]} anim={anim} />,
      );
    });

    expect(quads().some((m) => uuids.includes(m.uuid)), 'un quad de l’ancienne scène a survécu').toBe(false);
  });
});

/**
 * LE CONTEXTE D'ANIMATION VIT (#1396) — un héros monté en EXPLORATION (inconnu du résolveur : `enrolé`
 * faux, aucun geste de combat cuit) entre en COMBAT. Le sujet monté ne doit pas rester gelé sur le
 * contexte de son montage : ses gestes de combat se cuisent au re-pointage, sans démonter son quad.
 */
describe('Piste de flipbook — le contexte se rafraîchit sur un survivant (#1396)', () => {
  it('un héros enrôlé APRÈS son montage voit ses gestes de combat cuits', async () => {
    useGame.setState({ battle: null });
    await monterNu();
    const uuids = quads().map((m) => m.uuid);
    const attaque = vi.spyOn(actorAnimSelect, 'rigAttackDef');
    expect(attaque, 'prémisse : hors combat, aucun geste d’attaque ne se cuit').not.toHaveBeenCalled();

    // ENRÔLEMENT : le résolveur de contexte lit la bataille du store (`combatantAnimCtx`).
    useGame.setState({ battle: { combatants: [{ ...HÉROS, pos: { x: 4, y: 4 } }], order: [HÉROS.id], turn: 0 } as never });
    // …et la population bouge, comme à l'ouverture d'un combat : c'est la passe de montage qui repointe.
    await act(async () => { root!.render(écran(PLEINE, ACTEURS, { tokens: [], props: [...ELS.props, décor('e', 10)] })); });
    await respirer(40);

    expect(attaque, 'la piste est restée au contexte du montage : aucun geste de combat cuit').toHaveBeenCalled();
    expect(uuids.every((u) => quads().some((m) => m.uuid === u)), 'le rafraîchissement a remonté les quads').toBe(true);
    useGame.setState({ battle: null });
  });
});

/**
 * CHEMIN DE L'ÉDITEUR (#1396) — `ui/editor/EditorCanvas` monte CE MÊME écran avec, pour champ de
 * teinte, le gabarit de couche basse (`lowerLayerGabarit.gabaritTint`) : les corps d'une couche qui
 * n'est pas celle qu'on édite s'estompent, dosés par le curseur. Le canal ayant déménagé du sujet
 * cuit vers la passe de pose, il se mesure ICI, sur des quads montés.
 */
describe('Gabarit de couche basse — il assombrit les CORPS de l’éditeur (#1396)', () => {
  const gabarit = (opacite: number): TintAt => (_x, _y, z) => gabaritTint(z, 1, opacite);

  it('le gabarit de couche basse assombrit les CORPS, et le curseur en dose la force', async () => {
    await monterNu();
    await act(async () => { root!.render(écran(gabarit(0.9))); });
    const clairs = quads().map((m) => (m.material as THREE.MeshBasicMaterial).color.clone());
    expect(clairs.length, 'aucun board monté : rien à mesurer').toBeGreaterThan(0);

    await act(async () => { root!.render(écran(gabarit(0.3))); });

    const sombres = quads().map((m) => (m.material as THREE.MeshBasicMaterial).color);
    expect(sombres.every((c, i) => c.r < clairs[i].r - 1e-6), 'le curseur ne touche plus les corps').toBe(true);
    // …et la couche ACTIVE reste pleine : le gabarit ne touche que ce qui n'est pas édité.
    await act(async () => { root!.render(écran((_x, _y, z) => gabaritTint(z, 0, 0.3))); });
    expect(quads().every((m, i) => (m.material as THREE.MeshBasicMaterial).color.r > clairs[i].r - 1e-6)).toBe(true);
  });
});
