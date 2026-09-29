// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import * as THREE from 'three';
import { TopoScene } from '../TopoScene';
import { planLights, setPlanRendererFactory, HEURE_INERTE, PLAN_PLAT, type PlanRenderer } from './planSnapshot';
import { viewPolicy } from './viewPolicy';
import { stageLightScalars, stageLights } from './stageLights';
import { emptyScene, type Scene } from '../../state/scene';
import type { Station } from '../../state/stations';

/**
 * LE PLAN DE STATION SUR LA VOIE VOLUMIQUE (#1176, P3-4, commit C2). Ce qui se mesure ici :
 *  - les MARQUEURS de station sont les mêmes, aux mêmes cases, sur les deux voies (ils restent en SVG) ;
 *  - le monde du plan ne laisse AUCUN contexte de rendu vivant : autant de libérations que de créations ;
 *  - l'instantané est RETENU par contenu — une scène reforgée à contenu égal n'en repaie aucun ;
 *  - le traitement de PLAN n'allume aucune directionnelle, donc ne porte aucune ombre.
 */
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let créations = 0;
let libérations = 0;
let pertesDeContexte = 0;
let rendus = 0;
/** BOÎTE que jsdom rendra à `clientWidth`/`clientHeight` — jsdom ne met rien en page, et la boîte
 *  mesurée est justement ce dont la clé de rétention dépend. */
let mesure = { w: 420, h: 180 };
for (const prop of ['clientWidth', 'clientHeight'] as const) {
  Object.defineProperty(HTMLCanvasElement.prototype, prop, {
    configurable: true,
    get() { return prop === 'clientWidth' ? mesure.w : mesure.h; },
  });
}
/** Ce que la scène three portait AU MOMENT du rendu — relevé dans la passe, jamais après : l'instantané
 *  démonte et libère tout avant de rendre la main, et il n'y aurait plus rien à interroger. */
let contenu: { lampes: string[]; casteurs: number } | null = null;

/** Renderer de banc : jsdom n'a aucun contexte WebGL, et l'instantané n'en demande pas plus que ça. */
function rendererDeBanc(): PlanRenderer {
  créations += 1;
  return {
    setPixelRatio: () => {},
    setClearColor: () => {},
    setSize: () => {},
    render: (scène: THREE.Scene) => {
      rendus += 1;
      const lampes: string[] = [];
      let casteurs = 0;
      scène.traverse((o) => {
        if ((o as THREE.Light).isLight) lampes.push(o.type);
        if (o.castShadow) casteurs += 1;
      });
      contenu = { lampes, casteurs };
    },
    dispose: () => { libérations += 1; },
    forceContextLoss: () => { pertesDeContexte += 1; },
    capabilities: { getMaxAnisotropy: () => 1 },
  };
}

beforeAll(() => setPlanRendererFactory(rendererDeBanc));
afterAll(() => { setPlanRendererFactory(null); });

const racines: Root[] = [];
afterEach(() => {
  act(() => { for (const r of racines.splice(0)) r.unmount(); });
  setPlanRendererFactory(rendererDeBanc);
  mesure = { w: 420, h: 180 };
  créations = 0;
  libérations = 0;
  pertesDeContexte = 0;
  rendus = 0;
  contenu = null;
});

function monte(ui: React.ReactElement): HTMLDivElement {
  const hôte = document.createElement('div');
  document.body.appendChild(hôte);
  const root = createRoot(hôte);
  racines.push(root);
  act(() => root.render(ui));
  return hôte;
}

function station(over: Partial<Station> = {}): Station {
  return {
    id: 's1',
    kind: 'poste',
    pos: { x: 1, y: 1 },
    label: 'Baliste',
    icon: 'action/serve-engine',
    faction: 'ally',
    assignedIds: ['c1'],
    manned: true,
    ref: { kind: 'poste', hullId: 'h1', posteUid: 'p1' },
    ...over,
  };
}

/** Un plan à deux stations et un mur : de quoi juger la présence des marqueurs ET celle de la structure. */
function scèneDePlan(): Scene {
  const s = emptyScene(6, 6);
  s.walls = [{ x: 2, y: 2, side: 'N' }];
  return s;
}

const STATIONS = [station(), station({ id: 's2', pos: { x: 4, y: 3 }, label: 'Gouvernail', manned: false })];

function marqueurs(hôte: HTMLElement): string[] {
  return [...hôte.querySelectorAll('.topo-station')].map((g) => {
    const c = g.querySelector('circle')!;
    return `${g.parentElement?.tagName}:${c.getAttribute('cx')},${c.getAttribute('cy')}`;
  });
}

describe('Plan de station — marqueurs et structure', () => {
  it('chaque station porte son marqueur, à sa place', () => {
    const scene = scèneDePlan();
    expect(marqueurs(monte(<TopoScene scene={scene} stations={STATIONS} onSelectStation={() => {}} />))).toHaveLength(2);
  });

  it('la STRUCTURE reste au trait SVG, la MATIÈRE vit dans le canevas posé dessous', () => {
    const scene = scèneDePlan();
    const plan = monte(<TopoScene scene={scene} stations={[]} />);
    // Le mur (trait de coupe de la vue du dessus) est dans le SVG…
    expect(plan.querySelector('.topo-scene')!.innerHTML).toContain('class="mur-coupe mur-coeur"');
    // … et les 36 tuiles de sol n'y sont pas : elles sont dans le canevas.
    expect(plan.querySelectorAll('.topo-scene > g > *').length).toBe(1);
    expect(plan.querySelector('canvas.topo-monde')).not.toBeNull();
  });
});

describe('Plan de station — le monde volumique ne laisse aucun contexte vivant', () => {
  it('l’instantané crée UN renderer, rend UNE frame, et le libère avant de rendre la main', () => {
    monte(<TopoScene scene={scèneDePlan()} stations={STATIONS} />);
    expect(créations).toBe(1);
    expect(rendus).toBe(1);
    expect(libérations).toBe(créations); // zéro contexte vivant après coup
    expect(pertesDeContexte).toBe(créations); // …et zéro contexte GL en sursis jusqu'au ramasse-miettes
  });

  it('CINQ ouvertures de fiche : cinq contextes créés, cinq rendus, cinq perdus — rien ne s’empile', () => {
    const scene = scèneDePlan();
    for (let i = 0; i < 5; i++) {
      const hôte = document.createElement('div');
      document.body.appendChild(hôte);
      const root = createRoot(hôte);
      act(() => root.render(<TopoScene scene={scene} stations={STATIONS} />));
      act(() => root.unmount());
      hôte.remove();
    }
    expect(créations).toBe(5);
    // C'est LE mode de défaillance de l'éphémère : un contexte gardé par ouverture évincerait le stage
    // de jeu qui vit sous la modale (le navigateur évince le PLUS ANCIEN).
    expect(libérations).toBe(5);
    expect(pertesDeContexte).toBe(5);
  });
});

describe('Plan de station — sans contexte volumique, le plan le DIT', () => {
  it('un contexte refusé ⇒ le message remplace la matière (jamais des murs flottant sur du vide)', () => {
    // La reprise des sols en SVG est morte avec la voie affine (#1176 P3-4, commit C5a) : sans matière,
    // le plan n'a plus rien à montrer sous ses traits — il l'annonce au lieu de rendre un plan trompeur.
    const scene = scèneDePlan();
    setPlanRendererFactory(() => { throw new Error('aucun contexte WebGL'); });
    const dégradé = monte(<TopoScene scene={scene} stations={[]} />);
    const dit = dégradé.querySelector('.sans-webgl');
    expect(dit, 'aucun message : le plan laisserait croire à une carte vide').not.toBeNull();
    expect(dit!.textContent).toContain('WebGL');
    expect(dégradé.querySelector('canvas.topo-monde')).not.toBeNull(); // le canevas reste, vierge
  });
});

describe('Plan de station — rétention de l’instantané par CONTENU', () => {
  it('une scène REFORGÉE à contenu égal ne repaie aucun instantané ; changer d’étage en repaie un', () => {
    const scene = scèneDePlan();
    const hôte = document.createElement('div');
    document.body.appendChild(hôte);
    const root = createRoot(hôte);
    racines.push(root);
    act(() => root.render(<TopoScene scene={scene} stations={STATIONS} z={0} />));
    expect(créations).toBe(1);
    // Référence NEUVE, même contenu : c'est ce que produit le store à chaque geste de jeu.
    act(() => root.render(<TopoScene scene={{ ...scene }} stations={STATIONS} z={0} />));
    expect(créations).toBe(1);
    act(() => root.render(<TopoScene scene={{ ...scene }} stations={STATIONS} z={1} />));
    expect(créations).toBe(2);
  });

  it('la BOÎTE DE PIXELS entre dans la clé : redimensionner recuit, la même boîte ne recuit pas', () => {
    const scene = scèneDePlan();
    const hôte = document.createElement('div');
    document.body.appendChild(hôte);
    const root = createRoot(hôte);
    racines.push(root);
    act(() => root.render(<TopoScene scene={scene} stations={STATIONS} />));
    expect(créations).toBe(1);
    mesure = { w: 700, h: 300 };
    act(() => root.render(<TopoScene scene={{ ...scene }} stations={STATIONS} />));
    expect(créations).toBe(2); // une image cuite pour l'ancienne boîte serait étirée par la CSS
    act(() => root.render(<TopoScene scene={{ ...scene }} stations={STATIONS} />));
    expect(créations).toBe(2);
  });

  it('un instantané pris HORS MESURE n’est jamais retenu : la première mesure le refait', () => {
    mesure = { w: 0, h: 0 }; // avant toute mise en page — le plan cuit à sa résolution par défaut
    const scene = scèneDePlan();
    const hôte = document.createElement('div');
    document.body.appendChild(hôte);
    const root = createRoot(hôte);
    racines.push(root);
    act(() => root.render(<TopoScene scene={scene} stations={STATIONS} />));
    expect(créations).toBe(1);
    mesure = { w: 420, h: 180 };
    act(() => root.render(<TopoScene scene={{ ...scene }} stations={STATIONS} />));
    expect(créations).toBe(2);
  });
});

describe('Plan de station — traitement de PLAN (aucune ombre portée)', () => {
  it('aucune directionnelle n’est montée : le plan n’a pas de soleil, donc pas d’ombre', () => {
    const scene = scèneDePlan();
    const lumière = planLights(scene);
    expect(lumière.sun).toBeNull();
    expect(lumière.lit).toBe(false);
    expect(lumière.fade).toBe(0);
    // CE QUI LE REND VRAI (#1176, P3-5b) : le REGARD, pas l'heure. La même scène à la MÊME heure, sans
    // le verdict du dessus, monte bien un soleil — le plan ne l'éteint plus en prétendant qu'il est
    // minuit, il demande le régime du dessus à `viewPolicy`.
    expect(stageLights({ scene, gameTime: HEURE_INERTE, lightLevel: PLAN_PLAT, shadowBox: new THREE.Box3() }).sun).not.toBeNull();
    expect(viewPolicy({ view: 'top' }).ombreSoleil).toBe(false);
  });

  it('l’HEURE est INERTE pour un plan : minuit ou midi rendent le même régime', () => {
    // La preuve que le détour d'horloge n'avait rien à porter : sous le régime de plan (regard du
    // dessus + palier forcé à `PLAN_PLAT`), `gameTime` n'entre plus dans aucune des deux décisions.
    const scene = scèneDePlan();
    const régime = (gameTime: number) => {
      const { fade, lit, ambientIntensity, sunIntensity, surfaceLuminance } = stageLightScalars({
        scene, gameTime, lightLevel: PLAN_PLAT, ombreSoleil: viewPolicy({ view: 'top' }).ombreSoleil,
      });
      return { fade, lit, ambientIntensity, sunIntensity, surfaceLuminance };
    };
    expect(régime(HEURE_INERTE)).toEqual(régime(0));
    expect(régime(HEURE_INERTE)).toEqual(régime(23 * 60));
    expect(régime(HEURE_INERTE).lit).toBe(false);
  });

  it('la scène three réellement rendue ne porte que l’ambiante et le monde', () => {
    monte(<TopoScene scene={scèneDePlan()} stations={STATIONS} />);
    expect(contenu!.lampes).toEqual(['AmbientLight']);
    expect(contenu!.casteurs).toBe(0);
  });
});
