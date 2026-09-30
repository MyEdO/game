// @vitest-environment jsdom
/**
 * CÂBLAGE des contrôles de l'inspecteur qui écrivent une INTENTION : ce que l'auteur règle doit
 * atteindre le consommateur RÉEL, pas seulement le document. Fichier à part des tests de champ
 * (`Inspector.test.tsx`, qui vérifie l'ATTERRISSAGE dans la Scène) : ici on va jusqu'au bout de la
 * chaîne — les builders de rendu (`buildRoofs`, `buildWalls`), le résolveur de Stations
 * (`battleScenesToStations`), le semis de zones de combat (`sceneZonesToBattle`) et le SPAWN de
 * rencontre (`startCombat`). Un contrôle qui écrit un champ que personne ne lit est une affordance
 * morte (#841). Chaque cas porte sa CONTRE-ÉPREUVE : la même mesure AVANT le geste, sur le même
 * lecteur — retirer la clé du contrôle rendrait les deux mesures identiques et le test rouge.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Inspector } from './Inspector';
import { emptyScene, type Scene, type SceneEntity, type Dialogue } from '../../state/scene';
import { buildRoofs } from '../../gameIso/builders/roofs';
import { buildWalls } from '../../gameIso/builders/walls';
import { battleScenesToStations } from '../../state/stations';
import { buildingRoofMaterial } from '../../state/buildings';
import { validateScene } from '../../state/validateScene';
import { encloseRect } from '../../state/sceneEdit.testkit';
import { sceneZonesToBattle, sceneZoneTiles } from '../../state/zones';
import { useGame } from '../../state/store';
import { pregenParty, PREGEN } from '../../data/pregens';
import { DialogueDetail } from './DialogueDetail';
import { DialogueBox } from '../DialogueBox';
import type { Ctx } from './EffectList';
import { paintEffectZone, type Sel, type Tool } from './editorState';
import { evalCondition, conditionCtx } from '../../engine/flowCore';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

function mount(scene: Scene, sel: Sel) {
  let latest = scene;
  // Outil de carte ARMÉ par l'inspecteur (pinceau d'emprise) — l'Éditeur le porte en vrai ; ici on
  // le garde pour vérifier CE QUE l'inspecteur arme, et le re-rendre à l'inspecteur (état `selected`).
  let tool: Tool = { mode: 'select' };
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  const render = (s: Scene) => {
    root.render(
      <Inspector
        scene={s}
        otherScenes={[]}
        worldMap={null}
        setScene={(next) => {
          latest = next;
          render(next);
        }}
        sel={sel}
        setSel={() => undefined}
        enemyCreatures={[{ id: 'humain', label: 'Humain' }, { id: 'garde-du-village', label: 'Garde' }]}
        openLogic={() => undefined}
        resizeScene={() => undefined}
        narratif={{ affaires: [], indices: [], presetsPnj: [], objets: [] }}
        tool={tool}
        armZoneTiles={(zoneId, paint) => {
          tool = { mode: 'zoneTiles', zoneId, paint };
          render(latest);
        }}
        zoneFocusKey={null}
      />,
    );
  };
  return {
    container,
    root,
    mount: () => act(() => render(scene)),
    sceneOf: () => latest,
    toolOf: () => tool,
    unmount: async () => {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

/** Une salle intérieure de 4×4 au rez : le PLANCHER RÉEL dont la toiture se dérive (#829/#881). */
function sceneAvecCorps(): Scene {
  return encloseRect({
    ...emptyScene(12, 12),
    architecture: [{ id: 'corps', style: 'maison', storeys: [], facades: [], masses: [] }],
  }, { x: 1, y: 1, w: 4, h: 4 });
}

/** Les PANS de la nappe, sans ses fermetures de comble : un pignon (`panId` `pignon-N`) prolonge le
 *  mur qu'il coiffe, il ne compte pas dans les pentes du profil. */
const pansDe = (scene: Scene) => buildRoofs(scene).filter((el) => !el.panId?.startsWith('pignon-'));

const fieldByLabel = <T extends HTMLElement>(container: HTMLElement, tag: string, label: string): T =>
  Array.from(container.querySelectorAll(tag))
    .find((el) => el.closest('label')?.textContent?.includes(label)) as T;

const selectByLabel = (container: HTMLElement, label: string): HTMLSelectElement =>
  fieldByLabel<HTMLSelectElement>(container, 'select', label);

const setInput = async (el: HTMLInputElement, value: string) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, value);
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
};

const click = async (el: HTMLElement) => {
  await act(async () => {
    el.click();
  });
};

const buttonBy = (container: HTMLElement, text: string): HTMLButtonElement =>
  Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes(text)) as HTMLButtonElement;

/** Bouton d'un segmented control (`OptionChooser layout="seg"`) — distingue « Retirer » du pinceau
 *  d'emprise des « Retirer » de listes voisines. */
const segButton = (container: HTMLElement, text: string): HTMLButtonElement =>
  Array.from(container.querySelectorAll('.seg button')).find((b) => b.textContent?.includes(text)) as HTMLButtonElement;

const setSelect = async (el: HTMLSelectElement, value: string) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(el, value);
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
};

describe('Inspecteur — l’INTENTION de toiture atteint le rendu (#829/#841)', () => {
  it('changer le profil du corps change les pans produits par `buildRoofs`', async () => {
    const h = mount(sceneAvecCorps(), { type: 'architectureBody', id: 'corps' });
    await h.mount();

    // Le plan porte la salle : le corps y reçoit ses pans dès l'affichage, au modèle du dépôt.
    const parDefaut = pansDe(h.sceneOf());
    expect(parDefaut).toHaveLength(2); // salle de 4×4 = UNE travée à DEUX pentes (la portée tranche)
    expect(parDefaut.every((el) => el.profile === 'gable')).toBe(true);
    // Le corps ne déclare aucune couverture : c'est celle de son TYPE de bâtiment qui s'applique
    // (`buildings.json › maison › roofMaterial`), devant celle de la scène (#1715).
    expect(parDefaut.every((el) => el.material === buildingRoofMaterial('maison'))).toBe(true);

    const profil = selectByLabel(h.container, 'Profil');
    await setSelect(profil, 'hip');
    const hip = pansDe(h.sceneOf());
    expect(hip).toHaveLength(4); // croupe demandée : un pan par orientation, sur la MÊME travée
    expect(hip.every((el) => el.profile === 'hip')).toBe(true);

    await setSelect(profil, 'flat');
    const flat = pansDe(h.sceneOf());
    expect(flat.length).toBeGreaterThan(0);
    expect(flat.every((el) => el.profile === 'flat')).toBe(true);

    // Le matériau suit le MÊME chemin (masses re-dérivées, pas un champ mort).
    const couverture = selectByLabel(h.container, 'Couverture');
    await setSelect(couverture, 'chaume');
    expect(buildRoofs(h.sceneOf()).every((el) => el.material === 'chaume')).toBe(true);

    await act(async () => {
      h.root.unmount();
    });
    h.container.remove();
  });

  it('une exclusion posée à l’inspecteur DÉCOIFFE les cases visées', async () => {
    const h = mount(sceneAvecCorps(), { type: 'architectureBody', id: 'corps' });
    await h.mount();

    const profil = selectByLabel(h.container, 'Profil');
    await setSelect(profil, 'hip'); // matérialise la toiture dérivée du plan
    const cellsOf = (): Set<string> => {
      const out = new Set<string>();
      for (const el of buildRoofs(h.sceneOf())) for (const c of el.cells ?? []) out.add(`${c.x},${c.y}`);
      return out;
    };
    const avant = cellsOf();
    expect(avant.has('1,1')).toBe(true);
    expect(avant.has('2,2')).toBe(true);

    const addExclusion = Array.from(h.container.querySelectorAll('button'))
      .find((b) => b.textContent === '+ Exclusion') as HTMLButtonElement;
    await act(async () => {
      addExclusion.click();
    });
    // L'exclusion par défaut couvre (0,0)-(1,1) : la case (1,1) de la salle en sort.
    const apres = cellsOf();
    expect(apres.has('1,1')).toBe(false);
    expect(apres.has('2,2')).toBe(true);
    expect(apres.size).toBeLessThan(avant.size);

    await act(async () => {
      h.root.unmount();
    });
    h.container.remove();
  });

  it('APPENTIS : le côté d’égout réglé au fold descend le bon versant, et rend la scène VALIDE', async () => {
    const h = mount(sceneAvecCorps(), { type: 'architectureBody', id: 'corps' });
    await h.mount();

    /** Ordonnées des points les plus BAS des pans — le versant d'égout. */
    const versantBas = (scene: Scene): number[] => {
      const points = buildRoofs(scene)
        .flatMap((el) => el.faces.filter((face) => ['N', 'E', 'S', 'O'].includes(face.material.part!)))
        .flatMap((face) => face.poly);
      const bas = Math.min(...points.map((point) => point.h));
      return [...new Set(points.filter((point) => Math.abs(point.h - bas) < 1e-9).map((point) => point.y))].sort((a, b) => a - b);
    };
    const erreursToiture = (scene: Scene) =>
      validateScene([scene]).filter((warning) => warning.scope === 'architecture');

    await setSelect(selectByLabel(h.container, 'Profil'), 'shed');
    // CONTRE-ÉPREUVE : sans côté déclaré, la dérivation n'en invente aucun — et ça se DIT.
    expect(h.sceneOf().architecture![0].masses.every((mass) => mass.eaveSide === undefined)).toBe(true);
    expect(erreursToiture(h.sceneOf()).length).toBeGreaterThan(0);

    const cote = selectByLabel(h.container, "Côté d'égout");
    await setSelect(cote, 'N');
    expect(h.sceneOf().architecture![0].roofDefaults!.eaveSide).toBe('N');
    expect(h.sceneOf().architecture![0].masses.every((mass) => mass.eaveSide === 'N')).toBe(true);
    expect(erreursToiture(h.sceneOf())).toEqual([]);
    expect(buildRoofs(h.sceneOf()).every((el) => el.profile === 'shed')).toBe(true);
    const nord = versantBas(h.sceneOf());

    await setSelect(cote, 'S');
    const sud = versantBas(h.sceneOf());
    expect(erreursToiture(h.sceneOf())).toEqual([]);
    expect(Math.max(...sud)).toBeGreaterThan(Math.max(...nord)); // le versant bas a basculé au sud

    await h.unmount();
  });

  it('la PENTE du corps est bornée à la plage du modèle, et le champ VIDÉ rend la main à la scène', async () => {
    const h = mount(sceneAvecCorps(), { type: 'architectureBody', id: 'corps' });
    await h.mount();

    const pente = fieldByLabel<HTMLInputElement>(h.container, 'input', 'Pente');
    expect([pente.min, pente.max]).toEqual(['5', '75']);

    const penteDuRendu = () => [...new Set(buildRoofs(h.sceneOf()).map((el) => el.pitch))];
    await setInput(pente, '120');
    expect(h.sceneOf().architecture![0].roofDefaults!.pitchDeg).toBe(75);
    expect(validateScene([h.sceneOf()]).filter((warning) => warning.scope === 'architecture')).toEqual([]);
    expect(penteDuRendu().every((pitch) => (pitch ?? 0) > 0)).toBe(true);

    // VIDÉ = « suivre la scène » (#1715) : le champ QUITTE le corps, il ne se cale pas sur la borne.
    await setInput(pente, '');
    expect(h.sceneOf().architecture![0].roofDefaults?.pitchDeg).toBeUndefined();
    const derivees = h.sceneOf().architecture![0].masses.filter((mass) => mass.derived);
    expect(derivees.length).toBeGreaterThan(0);
    expect(derivees.every((mass) => mass.pitchDeg === h.sceneOf().roofDefaults.pitchDeg)).toBe(true);

    await h.unmount();
  });

  /** #1715 — le PREMIER réglage d'un corps ne matérialise QUE le champ touché. Avant ce lot, régler
   *  la couverture posait aussi `profile` et `pitchDeg` sur le corps : la pente cessait de s'adapter
   *  à la portée et le profil de suivre la portée, sans que l'auteur l'ait demandé. */
  it('le panneau de corps n’écrit QUE le champ touché — le reste continue de SUIVRE', async () => {
    const h = mount(sceneAvecCorps(), { type: 'architectureBody', id: 'corps' });
    await h.mount();
    expect(h.sceneOf().architecture![0].roofDefaults).toBeUndefined();

    await setSelect(selectByLabel(h.container, 'Couverture'), 'chaume');
    expect(h.sceneOf().architecture![0].roofDefaults).toEqual({ material: 'chaume' });

    // …et le champ se RETIRE quand l'auteur rend la main : le corps ne surcharge plus rien.
    await setSelect(selectByLabel(h.container, 'Couverture'), '');
    expect(h.sceneOf().architecture![0].roofDefaults).toBeUndefined();
    expect(buildRoofs(h.sceneOf()).every((el) => el.material === buildingRoofMaterial('maison'))).toBe(true);

    await h.unmount();
  });
});

describe('Inspecteur — une ANCRE de bataille posée est RÉSOLUE par son consommateur (#841)', () => {
  it('le picker propose des Scènes du CATALOGUE, et l’ancre produit une Station à sa position', async () => {
    const h = mount(emptyScene(22, 16), null);
    await h.mount();

    const addAnchor = Array.from(h.container.querySelectorAll('button'))
      .find((b) => b.textContent === '+ Ancre') as HTMLButtonElement;
    expect(addAnchor.disabled).toBe(false); // aucune autre Scène de projet : ça ne doit RIEN empêcher
    await act(async () => {
      addAnchor.click();
    });

    const anchors = h.sceneOf().stations!;
    expect(anchors).toHaveLength(1);
    const posee = { ...anchors[0], pos: { x: 7, y: 4 } };
    const scene = { ...h.sceneOf(), stations: [posee] };

    const stations = battleScenesToStations([posee.sceneId], {}, scene);
    expect(stations).toHaveLength(1); // une Scène inconnue du catalogue serait ignorée en silence
    expect(stations[0].pos).toEqual({ x: 7, y: 4 });
    expect(stations[0].label).not.toBe(posee.sceneId); // libellé LISIBLE, dérivé de la définition

    await act(async () => {
      h.root.unmount();
    });
    h.container.remove();
  });
});

// ── ZoneArea `disc` : cx / cy / radius ─────────────────────────────────────────────────────────────
describe('Inspecteur — une zone d’effet RONDE s’auteure au clic (`ZoneArea.disc`, #841)', () => {
  it('forme « disque » + rayon → `sceneZonesToBattle` sème un disque CENTRÉ, pas le rectangle d’origine', async () => {
    const h = mount(
      {
        ...emptyScene(20, 20),
        effectZones: [{
          id: 'ward', label: 'Cercle de ward',
          area: { kind: 'rect', x: 2, y: 2, w: 2, h: 2 },
          barrier: { blockGroups: ['demon'] },
        }],
      },
      { type: 'effectZone', idx: 0 },
    );
    await h.mount();

    expect(sceneZonesToBattle(h.sceneOf().effectZones)[0].tiles).toHaveLength(4); // aire RECT d'origine

    await setSelect(selectByLabel(h.container, 'Forme'), 'disc');
    await setInput(fieldByLabel<HTMLInputElement>(h.container, 'input', 'Rayon'), '3');

    expect(h.sceneOf().effectZones![0].area).toEqual({ kind: 'disc', cx: 3, cy: 3, radius: 3 });
    const tiles = sceneZonesToBattle(h.sceneOf().effectZones)[0].tiles;
    expect(tiles).toHaveLength(7 * 7); // disque de Chebyshev de rayon 3 autour de (3,3)
    expect(tiles.some((t) => t.x === 0 && t.y === 0)).toBe(true);
    expect(tiles.some((t) => t.x === 6 && t.y === 6)).toBe(true);
    expect(tiles.some((t) => t.x === 7 && t.y === 3)).toBe(false);

    await h.unmount();
  });
});

describe('Inspecteur — la NATURE d’une zone atteint le PLAN (#881)', () => {
  /** Un corps clos de 6×6 dont le cœur (2×2) est une cour : les MURS font le bâtiment, la zone ne fait
   *  que NOMMER et déclarer ce qui reste à ciel ouvert. */
  const sceneAvecCour = (): Scene => ({
    ...encloseRect({
      ...emptyScene(12, 12),
      architecture: [{ id: 'corps', style: 'maison', storeys: [], facades: [], masses: [] }],
    }, { x: 1, y: 1, w: 6, h: 6 }),
    effectZones: [{ id: 'cour', label: 'Cour', area: { kind: 'rect', x: 3, y: 3, w: 2, h: 2 }, z: 0, presentation: 'interior' }],
  });

  const couvertes = (scene: Scene) => new Set(buildRoofs(scene).flatMap((el) => el.cells.map((cell) => `${cell.x},${cell.y}`)));

  it('déclarer la zone « Extérieur » ôte la toiture de la cour — et le sélecteur RELIT ce qu’il a écrit', async () => {
    const h = mount(sceneAvecCour(), { type: 'effectZone', idx: 0 });
    await h.mount();

    // CONTRE-ÉPREUVE : avant le geste, la cour est coiffée comme le reste du corps.
    expect(couvertes(h.sceneOf()).has('3,3')).toBe(true);

    const nature = selectByLabel(h.container, 'Nature');
    expect(nature.value).toBe('interior');
    await setSelect(nature, 'exterior');

    expect(h.sceneOf().effectZones![0].presentation).toBe('exterior'); // le contrôle écrit ce qu'il affiche
    expect(selectByLabel(h.container, 'Nature').value).toBe('exterior'); // ... et le relit, sans perte au retour
    const apres = couvertes(h.sceneOf());
    for (const key of ['3,3', '4,3', '3,4', '4,4']) expect(apres.has(key), key).toBe(false);
    expect(apres.has('1,1')).toBe(true); // le reste du corps garde son toit

    await h.unmount();
  });

  it('une zone MÉCANIQUE (piège) garde sa nature « Non déclarée » : le sélecteur ne la repeint pas en extérieur au premier geste', async () => {
    const piege: Scene = {
      ...sceneAvecCour(),
      effectZones: [{ id: 'piege', label: 'Piège', area: { kind: 'rect', x: 3, y: 3, w: 2, h: 2 }, z: 0, onCross: [{ op: 'wounds', amount: 5, ignoreTB: false, ignoreAP: true }] }],
    };
    const h = mount(piege, { type: 'effectZone', idx: 0 });
    await h.mount();

    expect(selectByLabel(h.container, 'Nature').value).toBe(''); // la troisième nature s'affiche pour ce qu'elle est
    await setSelect(selectByLabel(h.container, 'Forme'), 'rect'); // un geste sur un AUTRE champ de la zone
    expect(h.sceneOf().effectZones![0].presentation).toBeUndefined();
    expect(couvertes(h.sceneOf()).has('3,3')).toBe(true); // la toiture du corps reste entière

    await h.unmount();
  });
});

// ── SceneEffectZone.tiles : emprise EXACTE (pièce en L) ────────────────────────────────────────────
describe('Inspecteur — l’EMPRISE d’une zone se peint SUR la carte (`SceneEffectZone.tiles`)', () => {
  it('le sens choisi ARME le pinceau sur l’id STABLE de la zone ; peindre atteint le moteur', async () => {
    const h = mount(
      {
        ...emptyScene(12, 12),
        effectZones: [{
          id: 'salle', label: 'Salle',
          area: { kind: 'rect', x: 1, y: 1, w: 3, h: 3 },
          onCross: [{ op: 'wounds', amount: 3, ignoreTB: false, ignoreAP: true }],
        }],
      },
      { type: 'effectZone', idx: 0 },
    );
    await h.mount();

    expect(h.sceneOf().effectZones![0].tiles).toBeUndefined(); // zone PLEINE : aucune découpe au document
    expect(sceneZonesToBattle(h.sceneOf().effectZones)[0].tiles).toHaveLength(9);
    expect(h.toolOf()).toEqual({ mode: 'select' }); // contre-épreuve : rien d'armé avant le geste

    await click(segButton(h.container, 'Retirer'));
    expect(h.toolOf()).toEqual({ mode: 'zoneTiles', zoneId: 'salle', paint: 'remove' });

    // Le geste de carte : le canevas route l'outil vers `paintEffectZone` (même couture, testée pure).
    const peinte = paintEffectZone(h.sceneOf(), 'salle', { x: 1, y: 1 }, 'remove');
    const tiles = sceneZonesToBattle(peinte.effectZones)[0].tiles;
    expect(tiles).toHaveLength(8);
    expect(tiles.some((t) => t.x === 1 && t.y === 1)).toBe(false);
    expect(peinte.effectZones![0].area).toEqual({ kind: 'rect', x: 1, y: 1, w: 3, h: 3 }); // la BOÎTE ne bouge pas

    await h.unmount();
  });

  it('« Rétablir l’emprise pleine » dissout la découpe portée par le document', async () => {
    const h = mount(
      {
        ...emptyScene(12, 12),
        effectZones: [{
          id: 'salle', label: 'Salle',
          area: { kind: 'rect', x: 1, y: 1, w: 3, h: 3 },
          tiles: [{ x: 2, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 2 }],
        }],
      },
      { type: 'effectZone', idx: 0 },
    );
    await h.mount();
    expect(sceneZoneTiles(h.sceneOf().effectZones![0])).toHaveLength(3);

    await click(buttonBy(h.container, "Rétablir l'emprise pleine"));
    expect(h.sceneOf().effectZones![0].tiles).toBeUndefined();
    expect(sceneZoneTiles(h.sceneOf().effectZones![0])).toHaveLength(9); // l'emprise redérive de l'aire

    await h.unmount();
  });

  it('déplacer la boîte EMPORTE la découpe (l’emprise reste la forme dessinée par l’auteur)', async () => {
    const h = mount(
      {
        ...emptyScene(12, 12),
        effectZones: [{
          id: 'salle', label: 'Salle',
          area: { kind: 'rect', x: 1, y: 1, w: 2, h: 2 },
          tiles: [{ x: 2, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 2 }],
          blocksLoS: true,
        }],
      },
      { type: 'effectZone', idx: 0 },
    );
    await h.mount();
    expect(sceneZoneTiles(h.sceneOf().effectZones![0]).map((t) => `${t.x},${t.y}`).sort())
      .toEqual(['1,2', '2,1', '2,2']);

    await setInput(fieldByLabel<HTMLInputElement>(h.container, 'input', 'X'), '5');
    expect(sceneZoneTiles(h.sceneOf().effectZones![0]).map((t) => `${t.x},${t.y}`).sort())
      .toEqual(['5,2', '6,1', '6,2']); // même forme, translatée — jamais un rectangle plein retrouvé

    await h.unmount();
  });
});

// ── FacadeFeature.offset / .width ──────────────────────────────────────────────────────────────────
/** Une arête de façade portant un pignon, sans position ni largeur authorées (défauts du rendu). */
function sceneFacade(): Scene {
  return {
    ...emptyScene(10, 10),
    walls: [{ x: 3, y: 3, side: 'N' }],
    architecture: [{
      id: 'corps', style: 'taverne', storeys: [{ id: 'rez', z: 0, parts: [], roomZoneIds: [] }],
      facades: [{
        id: 'sud', z: 0, edges: [{ x: 3, y: 3, side: 'N' }], appearance: 'auberge-relais-imperiale',
        features: [{ id: 'pignon', kind: 'gable', edge: { x: 3, y: 3, side: 'N' } }],
      }],
      masses: [],
    }],
  };
}

/** Portée horizontale et abscisse du CENTRE de la face du pignon, telles que `buildWalls` les produit. */
function gableSpan(scene: Scene): { width: number; center: number } {
  const face = buildWalls(scene, 'auteur').flatMap((w) => w.faces)
    .find((f) => f.architectureFeatureKind === 'gable')!;
  const xs = face.poly.map((p) => p.x);
  return { width: Math.max(...xs) - Math.min(...xs), center: (Math.max(...xs) + Math.min(...xs)) / 2 };
}

describe('Inspecteur — POSITION et LARGEUR d’une ouverture de façade (#841)', () => {
  it('les deux champs atteignent la géométrie produite par `buildWalls`', async () => {
    const h = mount(sceneFacade(), { type: 'facadeSection', bodyId: 'corps', id: 'sud' });
    await h.mount();

    const avant = gableSpan(h.sceneOf()); // géométrie de DÉFAUT du rendu

    await setInput(fieldByLabel<HTMLInputElement>(h.container, 'input', 'Largeur'), '0.2');
    const etroit = gableSpan(h.sceneOf());
    expect(h.sceneOf().architecture![0].facades[0].features![0].width).toBe(0.2);
    expect(etroit.width).toBeLessThan(avant.width);

    await setInput(fieldByLabel<HTMLInputElement>(h.container, 'input', 'Position'), '0.9');
    const decale = gableSpan(h.sceneOf());
    expect(h.sceneOf().architecture![0].facades[0].features![0].offset).toBe(0.9);
    expect(decale.width).toBeCloseTo(etroit.width); // décaler ne change PAS la largeur…
    expect(decale.center).not.toBeCloseTo(etroit.center); // …mais bouge le centre sur l'arête

    await h.unmount();
  });
});

// ── EncounterMember.ai & SceneEntity.crewIds : lus au SPAWN de combat ──────────────────────────────
function sceneNavale(): Scene {
  const entities: SceneEntity[] = [
    { id: 'coque', kind: 'personnage', ref: 'cogue', pos: { x: 4, y: 4 }, label: 'La cogue' },
    { id: 'marin', kind: 'personnage', ref: 'garde-du-village', pos: { x: 6, y: 4 }, label: 'Marin' },
  ];
  return {
    ...emptyScene(14, 14),
    entities,
    encounters: [{ id: 'abordage', members: [{ entityId: 'coque' }, { entityId: 'marin', side: 'ally' }] }],
  };
}

const spawned = (scene: Scene, id: string) => {
  useGame.setState({ party: pregenParty(PREGEN.soldat) });
  useGame.getState().startScene(scene);
  useGame.getState().startCombat('abordage');
  return useGame.getState().battle!.combatants.find((c) => c.id === id)!;
};

describe('Inspecteur — allié PILOTÉ PAR L’IA (`EncounterMember.ai`, #841)', () => {
  it('la case cochée devient `Combatant.aiControlled` au spawn de la rencontre', async () => {
    const h = mount(sceneNavale(), { type: 'entity', id: 'marin' });
    await h.mount();

    expect(spawned(h.sceneOf(), 'marin').aiControlled).toBeFalsy(); // membre allié SANS la clé

    await click(fieldByLabel<HTMLInputElement>(h.container, 'input', "Piloté par l'IA"));
    expect(h.sceneOf().encounters[0].members![1].ai).toBe(true);
    expect(spawned(h.sceneOf(), 'marin').aiControlled).toBe(true);

    await h.unmount();
  });
});

describe('Inspecteur — ÉQUIPAGE EXPOSÉ d’une coque (`SceneEntity.crewIds`, MDG 14, #841)', () => {
  it('le membre embarqué atterrit sur `Combatant.crewIds` de la coque au spawn', async () => {
    const h = mount(sceneNavale(), { type: 'entity', id: 'coque' });
    await h.mount();

    expect(spawned(h.sceneOf(), 'coque').crewIds).toBeUndefined(); // coque sans équipage authoré

    await click(buttonBy(h.container, "+ Embarquer un membre d'équipage"));
    expect(h.sceneOf().entities.find((e) => e.id === 'coque')!.crewIds).toEqual(['marin']);
    expect(spawned(h.sceneOf(), 'coque').crewIds).toEqual(['marin']);

    await h.unmount();
  });
});

// ── DialogueChoice.icon ────────────────────────────────────────────────────────────────────────────
describe('Atelier de dialogue — ICÔNE d’un choix (`DialogueChoice.icon`, #841)', () => {
  it('l’id choisi à l’atelier est rendu par `DialogueBox` devant le libellé du choix', async () => {
    const dialogue: Dialogue = {
      id: 'd', start: 'n1',
      nodes: [{ id: 'n1', desc: 'Bonjour.', choices: [{ label: 'Payer la taxe' }] }],
    };
    let latest = dialogue;
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const ctx = { encounters: [], dialogues: [dialogue], personas: [] } as unknown as Ctx;
    const render = (d: Dialogue) =>
      root.render(<DialogueDetail dialogue={d} ctx={ctx} onChange={(next) => { latest = next; render(next); }} />);
    await act(async () => render(dialogue));

    const boxes: { el: HTMLElement; root: Root }[] = [];
    const renderDialogueBox = async (d: Dialogue) => {
      const el = document.createElement('div');
      document.body.appendChild(el);
      const boxRoot = createRoot(el);
      boxes.push({ el, root: boxRoot });
      await act(async () => {
        useGame.setState({ dialogue: { dialogue: d, nodeId: 'n1', session: 1 }, party: pregenParty(PREGEN.soldat) });
        boxRoot.render(<DialogueBox />);
      });
      return el;
    };

    // Sans icône authorée, le bouton de choix ne porte AUCUN glyphe.
    expect((await renderDialogueBox(latest)).querySelector('button.dlg-choice svg.icon')).toBeNull();

    const icone = Array.from(container.querySelectorAll('select'))
      .find((el) => el.closest('label')?.title.includes('affordance')) as HTMLSelectElement;
    await setSelect(icone, 'resource/gold-purse');
    expect(latest.nodes[0].choices[0].icon).toBe('resource/gold-purse');

    expect((await renderDialogueBox(latest)).querySelector('button.dlg-choice svg.icon')).not.toBeNull();

    await act(async () => {
      root.unmount();
      for (const b of boxes) b.root.unmount();
    });
    container.remove();
    for (const b of boxes) b.el.remove();
  });
});

// ── Scene.flags (#855 — `setSceneFlags` contrôlé par un drapeau posé à l'inspecteur) ──
describe('SceneProps — un drapeau de départ posé à l’inspecteur atteint `evalCondition` (#855)', () => {
  it('poser puis retirer le drapeau fait basculer le lecteur de conditions vrai puis faux', async () => {
    const h = mount(emptyScene(6, 6), null);
    await h.mount();

    const lit = (flags: Record<string, boolean>) =>
      evalCondition({ kind: 'flag', expr: 'jalon-pose' }, conditionCtx({ flags, gameTime: 0 }));

    // CONTRE-ÉPREUVE : avant le geste, le drapeau n'existe pas — le lecteur dit non.
    expect(lit(h.sceneOf().flags)).toBe(false);

    const nameInput = h.container.querySelector('input[placeholder="nom du drapeau"]') as HTMLInputElement;
    await setInput(nameInput, 'jalon-pose');
    const addBtn = Array.from(h.container.querySelectorAll('button')).find((b) => b.textContent === '+ Drapeau') as HTMLButtonElement;
    await click(addBtn);
    expect(lit(h.sceneOf().flags)).toBe(true);

    const chip = Array.from(h.container.querySelectorAll('.chip')).find((s) => s.textContent === 'jalon-pose');
    const flagRow = chip!.closest('.ed-dim') as HTMLElement;
    const checkbox = flagRow.querySelector('input[type="checkbox"]') as HTMLInputElement;
    await click(checkbox); // décoche : le drapeau reste déclaré mais posé à `false`
    expect(lit(h.sceneOf().flags)).toBe(false);

    const removeBtn = flagRow.querySelector('button') as HTMLButtonElement;
    await click(removeBtn);
    expect(h.sceneOf().flags).toEqual({});
    expect(lit(h.sceneOf().flags)).toBe(false); // absent ou faux : même verdict côté lecteur

    await h.unmount();
  });
});
