// @vitest-environment jsdom
/**
 * LE REDESSIN EST PILOTÉ PAR LES DONNÉES (#1371) — l'écran volumique monté sous son hôte de
 * production (`VolumetricWorld`), qui est la couche où naissaient les littéraux instables : `frameCam`
 * (cadre reforgé par rendu), `chromeAt` (fermeture sur une `Map` neuve). Tant qu'ils l'étaient, aucune
 * liste de dépendances ne pouvait filtrer quoi que ce soit, et le redessin de `GameStage3D` courait
 * SANS deps — un `renderer.render()` par commit React de l'hôte, quelle qu'en fût la cause.
 *
 * Trois faits, chacun réfutable seul (`data-rendus` = ce que le renderer a reçu ; un canevas WebGL n'a
 * pas d'arbre à interroger) :
 *  1. un commit ÉTRANGER (état local de l'hôte, entrées du monde inchangées) ne peint AUCUNE image ;
 *  2. un changement RÉEL de marques dynamiques peint EXACTEMENT une image, et cette image PORTE la
 *     nouveauté (le pool d'anneaux passe de 0 instance à 1) ;
 *  3. un changement RÉEL de cadrage (zoom) peint aussi son image : la stabilisation ne mure pas la
 *     caméra.
 */
import { act, useState, type MutableRefObject } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { emptyScene, sceneMetresPerTile, type Scene } from '../../noyau/monde/scene';
import type { Dims } from '../../geometry/iso';
import type { PropEl, TokenEl } from '../builders/types';
import type { KeepEl, TintAt } from '../backends/webgl/sceneMeshes';
import type { LightSource } from '../../state/vision';
import type { WalkTrack } from '../fx/walkPose';
import { COMBAT_TOKEN_BASE, NO_DYNAMIC_MARKS, teamRingRadiusK, type DynamicMarks } from '../builders/dynamicMarks';
import { HERO_RING } from '../teamColors';
import { setStageRendererFactory, type PercageEntrees } from './GameStage3D';
import { BancRenderer, brancherArdoise, rendus as rendusDe, scènes, viderCaptures } from './banc-volumique';
import { VolumetricWorld, type WorldFrame } from './VolumetricWorld';
import { resetStageFrames } from './stageFrames';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Le canevas de jsdom n'a aucune boîte : la passe de dessin sort sur `!w || !h` sans elle. */
const TAILLE = { w: 800, h: 600 };

/** Scène de PLEIN JOUR, sans météo et sans lampe : aucun motif continu ne tient le battement, donc
 *  rien ne peint hors des commits — ce que ce banc compte est bien le redessin, et lui seul.
 *  Terrain de BOIS : un plancher porte des faces (donc un index de dessin à dégager) et AUCUN accent
 *  de sol (`terrainDetail` n'en donne aucune recette). C'est ce qui isole les deux passes que ce banc
 *  interroge — teinte et dégagement du monde CUIT — de la repose du semis d'accents, qui obéit aux
 *  mêmes entrées et peindrait à leur place. */
const SCENE: Scene = (() => {
  const s = emptyScene(8, 8);
  s.layers[0].tiles = new Array(s.dimensions.w * s.dimensions.h).fill('bois');
  return s;
})();
const MPT = sceneMetresPerTile(SCENE);
const JOUR = 12 * 60;

const TINT: TintAt = () => 1;
const KEEP: KeepEl = () => true;
/** Le dégagement qui retire TOUT : l'index du monde cuit tombe à zéro face dessinée. */
const RIEN_GARDÉ: KeepEl = () => false;
const JETONS: TokenEl[] = [];
const DECORS: PropEl[] = [];
/** Listes VIDES et stables : un littéral neuf par rendu de l'hôte serait une entrée du monde qui
 *  CHANGE à chaque commit — la mesure porterait alors sur le banc, jamais sur l'écran. */
const SANS_LAMPE: LightSource[] = [];
const SANS_MARCHE: MutableRefObject<Record<string, WalkTrack>> = { current: {} };
/** Cran de vue et cadrage : les DEUX entrées retenues du cadre chez l'hôte de jeu (`dimsVue` memo,
 *  `camAtStable` réf) — le banc les tient pareillement stables. */
const DIMS: Dims = { ...SCENE.dimensions, rot: 0, view: 'iso' };
const CAM_AT = () => ({ x: 0, y: 0 });

/** Un anneau d'équipe : la marque dynamique dont le banc mesure l'arrivée à l'écran. */
const ANNEAU: DynamicMarks = {
  tethers: [],
  active: null,
  party: null,
  rings: [{ id: 'h1', cell: { x: 2, y: 2, z: 0 }, rK: teamRingRadiusK(COMBAT_TOKEN_BASE), color: HERO_RING[0] }],
};

brancherArdoise();

/** Les leviers que le banc actionne sur l'hôte — un par CAUSE possible de commit. */
interface Leviers {
  /** Commit ÉTRANGER : un état local de l'hôte, qui ne touche à aucune entrée du monde. */
  bidon: () => void;
  marques: (m: DynamicMarks) => void;
  zoom: (z: number) => void;
  /** Dégagement et teinte, RETENUS sur leur valeur comme chez l'hôte de jeu (deux memos de `MondeDeCampagne`). */
  keep: (k: KeepEl) => void;
  tint: (t: TintAt) => void;
  percage: (p: PercageEntrees) => void;
}

/** L'hôte du monde volumique : il tient l'état, et rend le MÊME sous-arbre que le jeu. */
function Hôte({ leviers }: { leviers: MutableRefObject<Leviers | null> }) {
  const [bidon, setBidon] = useState(0);
  const [marques, setMarques] = useState<DynamicMarks>(NO_DYNAMIC_MARKS);
  const [zoom, setZoom] = useState(1);
  const [keep, setKeep] = useState<KeepEl>(() => KEEP);
  const [tint, setTint] = useState<TintAt>(() => TINT);
  const [percage, setPercage] = useState<PercageEntrees | null>(null);
  leviers.current = {
    bidon: () => setBidon((n) => n + 1),
    marques: setMarques,
    zoom: setZoom,
    keep: (k) => setKeep(() => k),
    tint: (t) => setTint(() => t),
    percage: setPercage,
  };
  // Cadre reforgé à CHAQUE rendu, comme l'hôte de jeu en reforge un : ce sont ses ENTRÉES qui sont
  // retenues (`MondeDeCampagne.dimsVue`, `camAtStable`), jamais l'objet.
  const frame: WorldFrame = { mode: 'plateau', dims: DIMS, camAt: CAM_AT, zoom };
  return (
    <div data-bidon={bidon}>
      <VolumetricWorld
        scene={SCENE}
        mpt={MPT}
        frame={frame}
        tintAt={tint}
        keepEl={keep}
        tokenEls={JETONS}
        propEls={DECORS}
        walksRef={SANS_MARCHE}
        partyToken={null}
        gameTime={JOUR}
        lightLevel={null}
        lights={SANS_LAMPE}
        battle={null}
        dynMarks={marques}
        percage={percage}
      />
    </div>
  );
}

let root: Root | null = null;
let hôte: HTMLDivElement | null = null;
const leviers: MutableRefObject<Leviers | null> = { current: null };

/** Le pool d'instances nommé, dans la DERNIÈRE scène rendue. */
function pool(nom: string): THREE.InstancedMesh {
  const scène = scènes[scènes.length - 1];
  let trouvé: THREE.InstancedMesh | null = null;
  scène.traverse((o) => {
    const m = o as THREE.InstancedMesh;
    if (m.isInstancedMesh && m.name === nom) trouvé = m;
  });
  if (!trouvé) throw new Error(`pool ${nom} absent de la scène rendue`);
  return trouvé;
}

/** Le maillage du MONDE CUIT dans la dernière scène rendue (le seul à porter des groupes de surface). */
function monde(): THREE.Mesh {
  const scène = scènes[scènes.length - 1];
  let trouvé: THREE.Mesh | null = null;
  scène.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && !(m as THREE.InstancedMesh).isInstancedMesh && m.geometry?.userData?.surfaceGroups) trouvé = m;
  });
  if (!trouvé) throw new Error('maillage du monde absent de la scène rendue');
  return trouvé;
}

/** Ce que l'index du monde donne RÉELLEMENT à dessiner : la somme des plages de ses groupes. */
const facesDessinées = (): number => monde().geometry.groups.reduce((n, g) => n + g.count, 0);

/** Les COULEURS de sommet du monde, à l'instant où on les lit — le témoin de la teinte. */
const couleursDuMonde = (): Float32Array =>
  ((monde().geometry.getAttribute('color') as THREE.BufferAttribute).array as Float32Array).slice();

/** L'AMBIANTE montée : son IDENTITÉ dit si le groupe des lampes a été remonté ou non. */
function ambiante(): THREE.Object3D {
  const scène = scènes[scènes.length - 1];
  let trouvée: THREE.Object3D | null = null;
  scène.traverse((o) => { if ((o as THREE.AmbientLight).isAmbientLight) trouvée = o; });
  if (!trouvée) throw new Error('aucune ambiante montée');
  return trouvée;
}

function monter(): void {
  hôte = document.createElement('div');
  document.body.appendChild(hôte);
  root = createRoot(hôte);
  act(() => root!.render(<Hôte leviers={leviers} />));
}

const rendus = () => rendusDe(hôte!);

beforeAll(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', { configurable: true, get: () => TAILLE.w });
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientHeight', { configurable: true, get: () => TAILLE.h });
  setStageRendererFactory(() => new BancRenderer());
});
afterAll(() => setStageRendererFactory(null));

beforeEach(() => {
  viderCaptures();
  // ARDOISE NEUVE du battement : la suite partage ses modules (`isolate: false`).
  resetStageFrames();
});

afterEach(() => {
  if (root) { act(() => root!.unmount()); root = null; }
  if (hôte) { hôte.remove(); hôte = null; }
  leviers.current = null;
  resetStageFrames();
});

describe('Redessin piloté par les données (#1371)', () => {
  it('un commit ÉTRANGER de l’hôte ne peint AUCUNE image', () => {
    monter();
    const avant = rendus();
    expect(avant, 'le montage doit avoir peint : sans cela le contrat serait vrai du vide').toBeGreaterThan(0);

    const bidonAvant = Number(hôte!.querySelector('[data-bidon]')!.getAttribute('data-bidon'));
    act(() => leviers.current!.bidon());
    expect(
      Number(hôte!.querySelector('[data-bidon]')!.getAttribute('data-bidon')),
      'le commit doit avoir eu lieu : sans lui, « aucune image » ne prouverait rien',
    ).toBe(bidonAvant + 1);

    expect(rendus() - avant, `${rendus() - avant} image(s) peinte(s) pour un commit sans rapport avec le monde`).toBe(0);
  });

  it('des marques dynamiques NEUVES peignent UNE image, et cette image les porte', () => {
    monter();
    expect(pool('marquesDyn:anneau').count, 'prémisse : aucun anneau posé au départ').toBe(0);
    const avant = rendus();

    act(() => leviers.current!.marques(ANNEAU));

    expect(rendus() - avant, `${rendus() - avant} image(s) pour une marque neuve`).toBe(1);
    // Le pool d'anneaux écrit UNE instance par TIRET de l'anneau : ce que le témoin dit est qu'il y a
    // désormais quelque chose de peint là où il n'y avait rien.
    expect(pool('marquesDyn:anneau').count, 'l’image peinte ne porte pas l’anneau neuf').toBeGreaterThan(0);
  });

  it('un cadrage NEUF (zoom) peint son image', () => {
    monter();
    const avant = rendus();

    act(() => leviers.current!.zoom(2));

    expect(rendus() - avant, `${rendus() - avant} image(s) pour un zoom neuf`).toBe(1);
  });
});

/**
 * LES DEUX PASSES QUI MUTENT LE MONDE CUIT (#1371). Ni le dégagement ni la teinte ne changent une
 * seule référence que le redessin prenne en dépendance : elles réécrivent EN PLACE l'index de dessin
 * et les couleurs de sommet d'un maillage déjà monté. Sans porte à elles, ce qu'elles viennent
 * d'écrire n'arrive à l'écran que si quelque chose d'autre peint — et pour la teinte, ce « quelque
 * chose » était la chaîne accidentelle `tintAt → sujets → boîte des casteurs → remontage des lampes`.
 */
describe('Mutations du monde cuit — chaque passe peint SA propre écriture (#1371)', () => {
  it('un dégagement NEUF change l’index du monde ET peint son image', () => {
    monter();
    const avantFaces = facesDessinées();
    expect(avantFaces, 'prémisse : le plancher doit donner des faces à dégager').toBeGreaterThan(0);
    const avant = rendus();

    act(() => leviers.current!.keep(RIEN_GARDÉ));

    expect(facesDessinées(), 'l’index du monde n’a pas été recompacté').toBe(0);
    expect(rendus() - avant, `${rendus() - avant} image(s) pour un dégagement neuf`).toBeGreaterThanOrEqual(1);
  });

  it('un dégagement de MÊME verdict (référence neuve) ne peint rien', () => {
    monter();
    const faces = facesDessinées();
    const avant = rendus();

    // Le cas COURANT : un franchissement de cran passe un `KeepEl` neuf pour le même verdict.
    act(() => leviers.current!.keep(() => true));

    expect(facesDessinées(), 'le verdict est le même : rien ne doit avoir bougé').toBe(faces);
    expect(rendus() - avant, `${rendus() - avant} image(s) pour un verdict identique`).toBe(0);
  });

  it('une teinte NEUVE repeint les sommets, peint UNE image, et NE REMONTE PAS les lampes', () => {
    monter();
    const avantCouleurs = couleursDuMonde();
    const avantAmbiante = ambiante();
    const avant = rendus();

    act(() => leviers.current!.tint(() => 0.4));

    expect(couleursDuMonde(), 'les couleurs de sommet n’ont pas été repeintes').not.toEqual(avantCouleurs);
    expect(rendus() - avant, `${rendus() - avant} image(s) pour une teinte neuve`).toBe(1);
    // Le 2e volet ferme la route ACCIDENTELLE : la teinte ne touche plus la liste des sujets (elle se
    // prend à la case, dans la passe de pose — #1396), et la boîte des CASTEURS n'entre dans le
    // montage des lampes que par sa VALEUR (`cléBoite`). Une ambiante neuve ici voudrait dire que le
    // champ de vision recuit encore la carte d'ombre à chaque pas du groupe.
    expect(ambiante(), 'le groupe des lampes a été remonté par un simple changement de teinte').toBe(avantAmbiante);
  });
});

/**
 * DÉCOUPE LOCALE (#1176, M3) : la clé de perçage est une entrée que SEULE la passe de frame lit
 * (`Percage.majVerdict`). Aucun montage ne la voit — sans dépendance, un trou demandé n'ouvrirait
 * qu'à la prochaine image d'une AUTRE cause.
 */
describe('Perçage — une clé neuve peint (#1371)', () => {
  it('une clé de perçage neuve peint son image', () => {
    monter();
    act(() => leviers.current!.percage({ cle: 'A', lids: [], heros: [] }));
    const avant = rendus();

    act(() => leviers.current!.percage({ cle: 'B', lids: [], heros: [] }));

    expect(rendus() - avant, `${rendus() - avant} image(s) pour une clé de perçage neuve`).toBe(1);
  });
});
