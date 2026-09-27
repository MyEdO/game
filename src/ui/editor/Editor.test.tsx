// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import {
  __setAutosaveBackendForTest, __resetAutosaveForTest, autosaveSave,
  type EditorAutosaveBackend, type EditorAutosaveRecord,
} from '../../state/editorAutosave';
import { __setIdbBackendForTest, __resetLibraryForTest, initLibrary, type IdbBackend, type SavedProject } from '../../state/projectLibrary';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { architectureSelectionForWarning, Editor, planDefectKey, planFocusAt } from './Editor';
import { validateScene } from '../../state/validateScene';
import { Inspector } from './Inspector';
import { allBuiltinCampaigns } from '../../scenes/campaign';
import diligenceProjet from '../../scenes/diligence/diligence-projet.json';
import { emptyScene, type Scene, type WallSeg } from '../../state/scene';
import { tileCenter, type Dims } from '../../geometry/iso';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { useGame } from '../../state/store';
import { useGameKeyboard } from '../useGameKeyboard';
import { editeur } from '../../state/editeurBridge';

/** Le hook de raccourcis est monté par `App`, AU-DESSUS des écrans : le monter avec l'éditeur
 *  reproduit l'application réelle (registre unique, section `editeur` gardée par `screen`). */
function Clavier() {
  useGameKeyboard();
  return null;
}

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

/** Test de fumée du rendu de l'éditeur v2 (toolbar / rail / canvas / inspecteur / statut / dock). */
describe('Editor v2 (rendu)', () => {
  const html = renderToStaticMarkup(<Editor />);

  it('rend la toolbar (Fichier ▾, undo/redo, sélecteur de scène, Monde, Tester)', () => {
    expect(html).toContain('Fichier ▾');
    expect(html).toContain('↶');
    expect(html).toContain('↷');
    expect(html).toContain('Scène active'); // aria-label du sélecteur de scènes
    expect(html).toContain('Monde'); // bouton « <Icon nav/campaign> Monde » (préfixe 🗺️ migré en icône)
    expect(html).toContain('▶ Tester');
  });

  it('rend le rail d’outils de la palette (sélection par défaut + outils v2)', () => {
    expect(html).toContain('Peindre le terrain');
    expect(html).toContain('Poser un décor');
    expect(html).toContain('Poser un point d’entrée'); // manque du POC comblé
    expect(html).toContain('Dessiner une zone');
    expect(html).toContain('Placer des ennemis');
    expect(html).toContain('Gomme');
    expect(html).toContain('Architecture');
    expect(html).not.toContain('Toit — bâtiment composé');
  });

  it('rend le canvas iso (SVG) et l’inspecteur docké sur les propriétés de la scène', () => {
    expect(html).toContain('editor-iso');
    expect(html).toContain('viewBox');
    expect(html).toContain('Identité');
    expect(html).toContain('Ambiance &amp; météo');
    // L'INVENTAIRE du plan : UNE liste pour tout ce que la scène porte (entités, zones, points
    // d'entrée, zones de repos), dépliée d'emblée.
    expect(html).toContain('Contenu du plan');
    expect(html).toContain("points d&#x27;entrée");
  });

  it('rend la barre de statut (calques) et le dock Logique (onglets + compteurs)', () => {
    expect(html).toContain('Calques');
    expect(html).toContain('Triggers'); // onglet « <Icon map-tool/zone> Triggers »
    expect(html).toContain('Dialogues'); // onglet « <Icon merchant/haggle> Dialogues »
    expect(html).toContain('Rencontres'); // onglet « <Icon action/attack> Rencontres » (préfixe ⚔️ migré)
    expect(html).toContain('Validation');
  });

  it('ne rend AUCUNE modale d’édition (l’édition est dockée)', () => {
    expect(html).not.toContain('editor-edit-modal');
    expect(html).not.toContain('modal-overlay');
  });
});

describe('Editor v2 — « Ouvrir » une campagne built-in ouvre une COPIE (#367)', () => {
  it('charge la campagne en projet SANS id (Enregistrer créera un NOUVEAU projet, jamais un écrasement du source)', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);
    await act(async () => {
      root.render(<Editor />);
    });

    const fileBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Fichier'))!;
    await act(async () => {
      fileBtn.click();
    });
    const openItem = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Ouvrir…'))!;
    await act(async () => {
      openItem.click();
    });

    const first = allBuiltinCampaigns[0];
    const row = Array.from(container.querySelectorAll('.listrow')).find((el) => el.textContent?.includes(first.label))!;
    const openBuiltinBtn = row.querySelector('button.btn-primary') as HTMLButtonElement;
    await act(async () => {
      openBuiltinBtn.click();
    });

    const h2 = container.querySelector('h2')!;
    expect(h2.getAttribute('title')).toBe(`Copie de ${first.label}`);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});

describe('Editor v2 — `editeur.ouvrir` : ouvrir par id sans la modale (#1478)', () => {
  it('publie la commande au montage, ouvre un scénario de test par id, refuse un id inconnu, et se retire au démontage', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);
    expect(editeur.ouvrir).toBeUndefined(); // rien de publié tant que l'éditeur n'est pas monté
    await act(async () => {
      root.render(<Editor />);
    });
    expect(typeof editeur.ouvrir).toBe('function');

    let verdict = '';
    await act(async () => {
      verdict = editeur.ouvrir!('opera-plan');
    });
    expect(verdict).toContain('✓');
    expect(verdict).toContain('Opéra — plan meublé (Staatsoper)');
    // La scène ACTIVE est bien celle du scénario : le sélecteur de scènes porte son id/label.
    const select = container.querySelector('select[aria-label="Scène active"]') as HTMLSelectElement;
    expect(select.value).toBe('opera-staatsoper');
    expect(container.querySelector('h2')!.getAttribute('title')).toBe('Opéra — plan meublé (Staatsoper)');

    let refus = '';
    await act(async () => {
      refus = editeur.ouvrir!('scene-qui-nexiste-pas');
    });
    expect(refus).toContain('✗');
    expect(refus).toContain('projets :');
    expect(refus).toContain('campagnes :');
    expect(refus).toContain('scénarios :');

    await act(async () => {
      root.unmount();
    });
    expect(editeur.ouvrir).toBeUndefined(); // retirée au démontage
    container.remove();
  });

  it('un projet enregistré que la porte `parseProject` REFUSE rend ✗ avec le motif, jamais ✓', async () => {
    // Une entrée de bibliothèque dont le document n'a AUCUNE identité : la porte unique la refuse.
    const entree = { id: 'proj-casse', label: 'Projet cassé', startSceneId: 's', savedAt: 0, published: false, project: { scenes: [] } } as unknown as SavedProject;
    const idb: IdbBackend = {
      async getAll() { return [entree]; },
      async put() { /* non exercé */ },
      async delete() { /* non exercé */ },
      async clear() { /* non exercé */ },
    };
    __setIdbBackendForTest(idb);
    await initLibrary();

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);
    await act(async () => {
      root.render(<Editor />);
    });

    let verdict = '';
    await act(async () => {
      verdict = editeur.ouvrir!('proj-casse');
    });
    expect(verdict, 'un ✓ sur un document refusé ferait croire la scène chargée').not.toContain('✓');
    expect(verdict).toContain('✗');
    expect(verdict).toContain('Projet cassé');

    await act(async () => {
      root.unmount();
    });
    container.remove();
    await __resetLibraryForTest();
    __setIdbBackendForTest(null);
  });
});

describe('Editor v2 — authoring architectural', () => {
  // « Pièces révélées » a DEUX propriétaires, un par FAIT : l'ÉTAGE porte `storey.roomZoneIds`,
  // la FAÇADE porte `facade.roomZoneIds`. La partie porte SON emprise, et rien de l'étage.
  it.each([
    ['étage z0', { type: 'architectureStorey', bodyId: 'corps', id: 'z0' }, 'Salle basse', 'Salle haute'],
    ['étage z1', { type: 'architectureStorey', bodyId: 'corps', id: 'z1' }, 'Salle haute', 'Salle basse'],
    ['façade z0', { type: 'facadeSection', bodyId: 'corps', id: 'facade-z0' }, 'Salle basse', 'Salle haute'],
    ['façade z1', { type: 'facadeSection', bodyId: 'corps', id: 'facade-z1' }, 'Salle haute', 'Salle basse'],
    // Les masses de toiture n'ont plus de "Pièces révélées" éditable — `roomZoneIds` est DÉRIVÉ des
    // zones intérieures que l'emprise recouvre (#823), plus un champ authoré à filtrer par étage.
  ] as const)('filtre les pièces révélées sur le z de la %s sélectionnée', (_label, sel, allowed, forbidden) => {
    const scene: Scene = {
      ...emptyScene(8, 8),
      effectZones: [
        { id: 'salle-bas', label: 'Salle basse', presentation: 'interior', z: 0, area: { kind: 'rect', x: 0, y: 0, w: 1, h: 1 } },
        { id: 'salle-haut', label: 'Salle haute', presentation: 'interior', z: 1, area: { kind: 'rect', x: 0, y: 0, w: 1, h: 1 } },
      ],
      architecture: [{
        id: 'corps',
        style: 'maison',
        storeys: [
          { id: 'z0', z: 0, parts: [{ id: 'partie-z0', foot: { x: 0, y: 0, w: 1, h: 1 } }], roomZoneIds: [] },
          { id: 'z1', z: 1, parts: [{ id: 'partie-z1', foot: { x: 0, y: 0, w: 1, h: 1 } }], roomZoneIds: [] },
        ],
        facades: [
          { id: 'facade-z0', z: 0, edges: [{ x: 0, y: 0, side: 'N' }], appearance: 'mur', features: [] },
          { id: 'facade-z1', z: 1, edges: [{ x: 0, y: 0, side: 'N', z: 1 }], appearance: 'mur', features: [] },
        ],
        masses: [
          { id: 'toiture-z0', z: 0, footprint: [{ x: 0, y: 0, w: 1, h: 1 }], levels: 1, profile: 'gable', ridge: 'x', pitchDeg: 42, material: 'tuile' },
          { id: 'toiture-z1', z: 1, footprint: [{ x: 0, y: 0, w: 1, h: 1 }], levels: 1, profile: 'gable', ridge: 'x', pitchDeg: 42, material: 'tuile' },
        ],
      }],
    };
    const html = renderToStaticMarkup(
      <Inspector
        scene={scene}
        otherScenes={[]}
        worldMap={null}
        setScene={() => undefined}
        sel={sel}
        setSel={() => undefined}
        enemyCreatures={[]}
        openLogic={() => undefined}
        resizeScene={() => undefined}
        narratif={{ affaires: [], indices: [], presetsPnj: [], objets: [] }}
        tool={{ mode: 'select' }}
        armZoneTiles={() => undefined}
        zoneFocusKey={null}
      />,
    );
    expect(html).toContain(allowed);
    expect(html).not.toContain(forbidden);
  });

  it('sélectionne une cible architecturale de warning par ids stables', () => {
    expect(architectureSelectionForWarning({
      level: 'error',
      sceneId: 'scene',
      scope: 'architecture',
      refId: 'feature-0',
      message: 'Feature invalide',
      architectureRef: { type: 'facadeSection', bodyId: 'corps-0', id: 'facade-0' },
    })).toEqual({ type: 'facadeSection', bodyId: 'corps-0', id: 'facade-0' });
  });

  it('ouvre dans l’inspecteur la section ciblée par un warning de feature', async () => {
    const initialScene: Scene = {
      ...emptyScene(8, 8),
      architecture: [{
        id: 'corps',
        style: 'maison',
        storeys: [
          { id: 'z0', z: 0, parts: [], roomZoneIds: [] },
          { id: 'grenier', z: 3, parts: [], roomZoneIds: [] },
        ],
        facades: [{
          id: 'facade',
          z: 0,
          edges: [{ x: 2, y: 2, side: 'N' }],
          appearance: 'auberge-relais-imperiale',
          features: [{ id: 'feature', kind: 'gable', edge: { x: 2, y: 2, side: 'N' }, width: 0 }],
        }],
        masses: [],
      }, {
        id: 'corps',
        style: 'maison',
        storeys: [],
        facades: [],
        masses: [],
      }],
    };
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<Editor initialScene={initialScene} />);
    });
    const validationTab = Array.from(container.querySelectorAll('button')).find(
      (candidate) => candidate.textContent?.includes('Validation'),
    )!;
    await act(async () => {
      validationTab.click();
    });
    const warning = Array.from(container.querySelectorAll('.ed-validation button.listrow')).find(
      (candidate) => candidate.textContent?.includes('feature'),
    ) as HTMLButtonElement;
    await act(async () => {
      warning.click();
    });
    expect(container.querySelector('.insp-title')?.textContent).toContain('facade');
    const storeyWarning = Array.from(container.querySelectorAll('.ed-validation button.listrow')).find(
      (candidate) => candidate.textContent?.includes('Étage 3 inexistant'),
    ) as HTMLButtonElement;
    await act(async () => {
      storeyWarning.click();
    });
    expect(container.querySelector('.insp-title')?.textContent).toContain('grenier');
    const bodyWarning = Array.from(container.querySelectorAll('.ed-validation button.listrow')).find(
      (candidate) => candidate.textContent?.includes('« corps » dupliqué'),
    ) as HTMLButtonElement;
    await act(async () => {
      bodyWarning.click();
    });
    expect(container.querySelector('.insp-title')?.textContent).toContain('corps');
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('allume TOUTES les cases fautives d’un défaut de plan, et les éteint au clic d’un autre avertissement', async () => {
    // Zone de pièce de 5 cases dont 2 seulement sont encloses de murs → défaut « zone débordante »
    // portant ses 3 cases fautives (`PlanDefectAt.tiles`).
    const tiles: string[] = new Array(64).fill('herbe');
    const walls: WallSeg[] = [
      { x: 1, y: 1, side: 'N' }, { x: 2, y: 1, side: 'N' },
      { x: 1, y: 2, side: 'N' }, { x: 2, y: 2, side: 'N' },
      { x: 0, y: 1, side: 'E' }, { x: 2, y: 1, side: 'E' },
    ];
    const initialScene: Scene = {
      ...emptyScene(8, 8),
      layers: [{ z: 0, tiles }],
      walls,
      effectZones: [{
        id: 'salle',
        label: 'Salle commune',
        area: { kind: 'rect', x: 1, y: 1, w: 5, h: 1 },
        presentation: 'interior',
      }],
      architecture: [
        { id: 'corps', style: 'maison', storeys: [], facades: [], masses: [] },
        { id: 'corps', style: 'maison', storeys: [], facades: [], masses: [] },
      ],
    };
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);
    await act(async () => {
      root.render(<Editor initialScene={initialScene} />);
    });
    const validationTab = Array.from(container.querySelectorAll('button')).find(
      (candidate) => candidate.textContent?.includes('Validation'),
    )!;
    await act(async () => {
      validationTab.click();
    });

    const planWarning = Array.from(container.querySelectorAll('.ed-validation button.listrow')).find(
      (candidate) => candidate.textContent?.includes('déborde hors des murs'),
    ) as HTMLButtonElement;
    await act(async () => {
      planWarning.click();
    });
    const focus = container.querySelector('[data-plan-focus]');
    expect(focus?.getAttribute('data-plan-focus')).toBe('zone');
    expect(focus?.querySelectorAll('path').length).toBe(3); // les 3 cases hors bâti, pas une seule
    expect(container.querySelector('.insp-title')?.textContent).toContain('Salle commune'); // zone éditable

    // Avertissement SANS position : l'annotation du clic précédent s'éteint (elle désignerait autre chose).
    const idWarning = Array.from(container.querySelectorAll('.ed-validation button.listrow')).find(
      (candidate) => candidate.textContent?.includes('dupliqué :'),
    ) as HTMLButtonElement;
    await act(async () => {
      idWarning.click();
    });
    expect(container.querySelector('[data-plan-focus]')).toBeNull();

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('crée un corps, une masse de toiture, et édite son emprise', async () => {
    const initialScene: Scene = {
      ...emptyScene(8, 8),
      effectZones: [{
        id: 'salle',
        label: 'Salle commune',
        area: { kind: 'rect', x: 1, y: 1, w: 4, h: 3 },
        presentation: 'interior',
      }],
    };
    let savedScene = initialScene;
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);

    await act(async () => {
      root.render(<Editor initialScene={initialScene} onSceneChange={(scene) => { savedScene = scene; }} />);
    });
    const button = (label: string) => Array.from(container.querySelectorAll('button')).find(
      (candidate) => candidate.textContent?.trim() === label || candidate.getAttribute('aria-label') === label,
    )!;

    await act(async () => {
      button('Architecture').click();
    });
    await act(async () => {
      button('Nouveau corps').click();
    });
    await act(async () => {
      button('Section de toiture').click();
    });

    expect(savedScene.architecture?.[0]?.masses[0]?.footprint).toEqual([{ x: 0, y: 0, w: 1, h: 1 }]);

    await act(async () => {
      button('Ajouter une partie').click();
    });
    expect(savedScene.architecture?.[0]?.masses[0]?.footprint).toHaveLength(2);

    const secondX = container.querySelector('input[aria-label="Partie 2 x"]') as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(secondX, '4');
      secondX.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(savedScene.architecture?.[0]?.masses[0]?.footprint[1]?.x).toBe(4);

    const removeParts = Array.from(container.querySelectorAll('button')).filter(
      (candidate) => candidate.textContent?.trim() === 'Supprimer la partie',
    ) as HTMLButtonElement[];
    await act(async () => {
      removeParts[0].click();
    });
    expect(savedScene.architecture?.[0]?.masses[0]?.footprint).toEqual([{ x: 4, y: 0, w: 1, h: 1 }]);
    expect((Array.from(container.querySelectorAll('button')).find(
      (candidate) => candidate.textContent?.trim() === 'Supprimer la partie',
    ) as HTMLButtonElement).disabled).toBe(true);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('applique l’étage actif aux parties, façades et toitures puis crée une feature', async () => {
    const initialScene: Scene = {
      ...emptyScene(8, 8),
      layers: [
        emptyScene(8, 8).layers[0],
        { z: 1, tiles: new Array(64).fill('vide') },
      ],
      architecture: [{
        id: 'corps',
        style: 'maison',
        storeys: [
          { id: 'z0', z: 0, parts: [], roomZoneIds: [] },
          { id: 'z1', z: 1, parts: [], roomZoneIds: [] },
        ],
        facades: [],
        masses: [],
      }],
    };
    let savedScene = initialScene;
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);
    const button = (label: string) => Array.from(container.querySelectorAll('button')).find(
      (candidate) => candidate.textContent?.trim() === label || candidate.getAttribute('aria-label') === label,
    )!;

    await act(async () => {
      root.render(<Editor initialScene={initialScene} onSceneChange={(scene) => { savedScene = scene; }} />);
    });
    await act(async () => {
      button('Architecture').click();
    });
    const storeySelect = Array.from(container.querySelectorAll('label'))
      .find((label) => label.textContent?.includes('Étage actif'))
      ?.querySelector('select') as HTMLSelectElement;
    await act(async () => {
      storeySelect.value = 'z1';
      storeySelect.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await act(async () => {
      button('Nouvelle partie').click();
    });
    await act(async () => {
      button('Section de toiture').click();
    });
    expect(button('Section de façade').getAttribute('aria-pressed')).toBe('false');
    await act(async () => {
      button('Section de façade').click();
    });
    expect(button('Section de façade').getAttribute('aria-pressed')).toBe('true');

    const svg = container.querySelector('svg.editor-iso') as SVGSVGElement;
    const point = { x: 0, y: 0, matrixTransform: () => ({ x: point.x, y: point.y }) };
    Object.defineProperty(svg, 'createSVGPoint', { value: () => point });
    Object.defineProperty(svg, 'getScreenCTM', { value: () => ({ inverse: () => ({}) }) });
    const dims: Dims = { ...initialScene.dimensions, rot: 0, view: 'top' }; // défaut éditeur = vue plan (arbitrage user 2026-07-25)
    const here = tileCenter(1, 1, dims, 1);
    const north = tileCenter(1, 0, dims, 1);
    await act(async () => {
      svg.dispatchEvent(new MouseEvent('pointerdown', {
        bubbles: true,
        button: 0,
        clientX: (here.cx + north.cx) / 2,
        clientY: (here.cy + north.cy) / 2,
      }));
    });
    await act(async () => {
      button('Nouvelle feature').click();
    });

    const body = savedScene.architecture?.[0];
    expect(body?.storeys.find((storey) => storey.id === 'z1')?.parts).toHaveLength(1);
    expect(body?.facades[0]?.z).toBe(1);
    expect(body?.facades[0]?.features).toHaveLength(1);
    expect(body?.masses[0]?.z).toBe(1);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('le CORPS reste atteignable : entrer en Architecture le sélectionne, et re-désigner la cible le ramène', async () => {
    // La Diligence : 37 zones de pièce couvrent le plan et AUCUN corps ne porte de partie, de masse
    // ni de façade — aucun clic carte ne peut donc désigner le corps. La désignation de cible de la
    // palette est le chemin, et elle doit valoir sélection.
    const initialScene = (diligenceProjet as unknown as { scenes: Scene[] }).scenes[0];
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);
    await act(async () => {
      root.render(<Editor initialScene={initialScene} />);
    });
    const button = (label: string) => Array.from(container.querySelectorAll('button')).find(
      (candidate) => candidate.textContent?.trim() === label || candidate.getAttribute('aria-label') === label,
    )!;
    /** Libellés des champs étiquetés de l'inspecteur — les cinq du corps y sont attendus. */
    const champsInspecteur = () => Array.from(container.querySelectorAll('.editor-inspector label'))
      .filter((label) => label.querySelector('input, select, textarea'))
      .map((label) => {
        const copie = label.cloneNode(true) as HTMLElement;
        copie.querySelectorAll('select, input, textarea').forEach((controle) => controle.remove());
        return copie.textContent?.replace(/\s+/g, ' ').trim() ?? '';
      });
    const selectDe = (titre: string) => Array.from(container.querySelectorAll('label'))
      .find((label) => label.textContent?.includes(titre))!
      .querySelector('select') as HTMLSelectElement;

    await act(async () => {
      button('Architecture').click();
    });
    // Les SIX champs du corps, et rien d'autre : c'est la signature de l'inspecteur du corps (le
    // titre ne suffirait pas — la scène porte le même nom que le corps sur cette carte).
    const CHAMPS_DU_CORPS = ['Libellé', 'Type de bâtiment', 'Profil', 'Pente (degrés)', 'Comble (étages)', 'Couverture'];
    expect(champsInspecteur()).toEqual(CHAMPS_DU_CORPS);

    // La sélection part ailleurs (l'étage), comme le ferait n'importe quel clic sur le plan.
    await act(async () => {
      selectDe('Étage actif').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(champsInspecteur()).not.toEqual(CHAMPS_DU_CORPS);

    // Re-désigner le corps DÉJÀ actif (aucun `change` : la valeur ne bouge pas) le re-sélectionne.
    await act(async () => {
      selectDe('Corps actif').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(champsInspecteur()).toEqual(CHAMPS_DU_CORPS);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

});

function fakeAutosaveBackend(): EditorAutosaveBackend & { store: Map<string, EditorAutosaveRecord> } {
  const store = new Map<string, EditorAutosaveRecord>();
  return {
    store,
    async get(sceneId) {
      return store.get(sceneId) ?? null;
    },
    async put(entry) {
      store.set(entry.sceneId, entry);
    },
    async delete(sceneId) {
      store.delete(sceneId);
    },
    async clear() {
      store.clear();
    },
  };
}

describe('Editor v2 — sauvegarde locale de secours (#834 audit)', () => {
  let backend: ReturnType<typeof fakeAutosaveBackend>;

  beforeEach(async () => {
    await __resetAutosaveForTest();
    backend = fakeAutosaveBackend();
    __setAutosaveBackendForTest(backend);
  });

  afterEach(() => {
    __setAutosaveBackendForTest(null);
  });

  it('Échap sur la modale de reprise ne détruit PAS la sauvegarde locale, et la proposition peut revenir (pt. A)', async () => {
    const initialScene: Scene = { ...emptyScene(4, 4), id: 'scene-escape-test', label: 'chargée' };
    await autosaveSave({ sceneId: 'scene-escape-test', scene: { ...emptyScene(4, 4), id: 'scene-escape-test', label: 'récupérée' }, savedAt: 999 });

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);
    await act(async () => {
      root.render(<Editor initialScene={initialScene} />);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(container.textContent).toContain('Reprendre une sauvegarde locale ?');
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(container.textContent).not.toContain('Reprendre une sauvegarde locale ?');
    expect(backend.store.has('scene-escape-test')).toBe(true); // Échap n'a RIEN détruit

    const reopen = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Sauvegarde locale en attente'))!;
    await act(async () => {
      reopen.click();
    });
    expect(container.textContent).toContain('Reprendre une sauvegarde locale ?');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('#834 audit-2 DÉFAUT 5 — une restauration reste ANNULABLE (Ctrl+Z), jamais l’action par défaut visuelle', async () => {
    const initialScene: Scene = { ...emptyScene(4, 4), id: 'scene-restore-undo', label: 'avant-restore' };
    await autosaveSave({ sceneId: 'scene-restore-undo', scene: { ...emptyScene(4, 4), id: 'scene-restore-undo', label: 'apres-restore' }, savedAt: 999 });

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);
    useGame.setState({ screen: 'editor' } as never); // le registre de raccourcis arbitre sur l'ÉCRAN
    await act(async () => {
      root.render(<><Clavier /><Editor initialScene={initialScene} /></>);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    const nomInput = () => Array.from(container.querySelectorAll('label')).find((l) => l.textContent === 'Nom')?.querySelector('input') as HTMLInputElement;
    expect(nomInput().value).toBe('avant-restore');

    const restoreBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Restaurer')!;
    expect(restoreBtn.className.split(' ')).not.toContain('btn-primary'); // rien ne prouve la fraîcheur relative
    await act(async () => {
      restoreBtn.click();
    });
    expect(nomInput().value).toBe('apres-restore');

    await act(async () => {
      // Le raccourci passe par le REGISTRE : touche par POSITION (`code`) sur `window`, comme le hook unique l'écoute.
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyZ', ctrlKey: true, bubbles: true }));
    });
    expect(nomInput().value).toBe('avant-restore'); // Ctrl+Z annule la restauration : un instantané a été poussé, l'historique n'a pas été vidé

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('#834 audit-2 DÉFAUTS 4/6 — « Enregistrer » purge le filet de TOUTES les scènes du projet, mais RIEN si le succès est DÉGRADÉ', async () => {
    const okIdb: IdbBackend = {
      async getAll() { return [] as SavedProject[]; },
      async put() { /* succès */ },
      async delete() { /* non exercé ici */ },
      async clear() { /* non exercé ici */ },
    };
    __setIdbBackendForTest(okIdb);

    const initialScene: Scene = { ...emptyScene(4, 4), id: 'scene-purge-a', label: 'A' };
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);
    await act(async () => {
      root.render(<Editor initialScene={initialScene} />);
    });

    const byText = (label: string) => Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes(label))!;
    const addSceneBtn = Array.from(container.querySelectorAll('button')).find((b) => b.getAttribute('title') === 'Nouvelle scène dans le projet')!;
    await act(async () => {
      addSceneBtn.click();
    });
    const activeSelect = container.querySelector('[aria-label="Scène active"]') as HTMLSelectElement;
    const sceneBId = activeSelect.value;
    expect(sceneBId).not.toBe('scene-purge-a');

    await autosaveSave({ sceneId: 'scene-purge-a', scene: { ...emptyScene(4, 4), id: 'scene-purge-a' }, savedAt: 1 });
    await autosaveSave({ sceneId: sceneBId, scene: { ...emptyScene(4, 4), id: sceneBId }, savedAt: 1 });
    expect(backend.store.has('scene-purge-a')).toBe(true);
    expect(backend.store.has(sceneBId)).toBe(true);

    await act(async () => { byText('Fichier').click(); });
    await act(async () => { byText('Enregistrer…').click(); });
    const saveBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Enregistrer')!;
    await act(async () => { saveBtn.click(); });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });

    // DÉFAUT 4 : les DEUX scènes couchées dans le projet sont purgées, pas seulement l'active.
    expect(backend.store.has('scene-purge-a')).toBe(false);
    expect(backend.store.has(sceneBId)).toBe(false);

    // DÉFAUT 6 : un succès DÉGRADÉ (IndexedDB en échec, miroir localStorage seul) ne purge RIEN.
    const degradedIdb: IdbBackend = {
      async getAll() { return [] as SavedProject[]; },
      async put() { throw new Error('IndexedDB indisponible (simulé)'); },
      async delete() { /* non exercé ici */ },
      async clear() { /* non exercé ici */ },
    };
    __setIdbBackendForTest(degradedIdb);
    await autosaveSave({ sceneId: 'scene-purge-a', scene: { ...emptyScene(4, 4), id: 'scene-purge-a' }, savedAt: 2 });
    await act(async () => { saveBtn.click(); });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(backend.store.has('scene-purge-a')).toBe(true);

    await act(async () => {
      root.unmount();
    });
    container.remove();
    __setIdbBackendForTest(null);
  });

  it('le message de reprise n’affirme PLUS une fraîcheur relative jamais vérifiée (pt. B)', async () => {
    const initialScene: Scene = { ...emptyScene(4, 4), id: 'scene-msg-test', label: 'chargée' };
    // Enregistrement PLUS ANCIEN que « maintenant » : la mécanique ne compare aucune date au chargement
    // — le message ne doit donc rien affirmer sur une fraîcheur relative qu'elle n'a pas vérifiée.
    await autosaveSave({ sceneId: 'scene-msg-test', scene: { ...emptyScene(4, 4), id: 'scene-msg-test', label: 'ancienne' }, savedAt: 1 });

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);
    await act(async () => {
      root.render(<Editor initialScene={initialScene} />);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(container.textContent).toContain('Reprendre une sauvegarde locale ?');
    // Contrat POSITIF (#834 audit-2 défaut 9) : le texte NEUTRE exact est présent — toute reformulation
    // (même sans les mots bannis ci-dessous) qui abandonnerait cette phrase ferait échouer ce test.
    expect(container.textContent).toContain(
      `Une sauvegarde automatique de « ancienne » diffère de`, // nom de l'enregistrement RÉCUPÉRÉ, pas de la scène chargée
    );
    expect(container.textContent).toContain("la version actuellement chargée. Elle date du");
    expect(container.textContent).toContain("La restaurer, ou l'ignorer et repartir de la version chargée ?");
    expect(container.textContent).not.toContain('plus récente');
    expect(container.textContent).not.toContain('plus récent');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});

describe('Editor v2 — #811 échec de sauvegarde REMONTÉ à l’auteur', () => {
  let originalLocalStorage: Storage | undefined;

  beforeEach(() => {
    originalLocalStorage = (globalThis as { localStorage?: Storage }).localStorage;
  });

  afterEach(() => {
    __setIdbBackendForTest(null);
    (globalThis as { localStorage?: Storage }).localStorage = originalLocalStorage;
  });

  it('« Fichier → Enregistrer » dont projectSave échoue affiche l’échec à l’auteur (pas seulement journalisé)', async () => {
    delete (globalThis as { localStorage?: Storage }).localStorage; // aucun filet miroir
    const failing: IdbBackend = {
      async getAll() {
        return [] as SavedProject[];
      },
      async put() {
        throw new Error('put refusé (quota simulé)');
      },
      async delete() {
        /* non exercé ici */
      },
      async clear() {
        /* non exercé ici */
      },
    };
    __setIdbBackendForTest(failing);

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);
    await act(async () => {
      root.render(<Editor />);
    });

    const byText = (label: string) => Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes(label))!;
    await act(async () => {
      byText('Fichier').click();
    });
    await act(async () => {
      byText('Enregistrer…').click();
    });

    const saveBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Enregistrer')!;
    expect(saveBtn.hasAttribute('disabled')).toBe(false); // nom déjà pré-rempli (projet par défaut)
    await act(async () => {
      saveBtn.click();
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    // Contrat POSITIF (pas seulement « une alerte existe ») : sous-chaîne DISTINCTIVE du message
    // d'échec réel de `projectSave` (`projectLibrary.ts`), pas une reformulation.
    const alert = container.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert!.textContent).toContain('stockage local n’est pas disponible');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});

describe('Editor v2 — pastille de reprise masquée (#834 audit-2 défaut 2)', () => {
  it('`.autosave-recovery-pill` est un style RÉEL du feuille de style de l’éditeur, qui la POSITIONNE', () => {
    // `new URL(rel, import.meta.url)` est détourné par l'implémentation URL de jsdom (base du
    // document) : la résolution passe par le chemin du module.
    const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'styles', 'editor.css'), 'utf8');
    const rule = css.match(/\.autosave-recovery-pill\s*\{([^}]*)\}/);
    expect(rule).not.toBeNull();
    expect(rule![1]).toMatch(/position:\s*(fixed|absolute)/);
  });
});

describe('Editor v2 — le défaut mis en évidence est VIVANT (re-résolution contre les avertissements frais)', () => {
  /** Plan de plain-pied 6×2 sur la `route` : les colonnes 0-2 sont ENCLOSES par un périmètre de murs
   *  (le corps de bâtiment), les colonnes 3-5 restent à l'air libre. */
  function planTemoin(zoneW: number): Scene {
    const w = 6, h = 2;
    return {
      ...emptyScene(w, h),
      layers: [{ z: 0, tiles: new Array(w * h).fill('route') }],
      walls: [
        { x: 0, y: 0, side: 'N' }, { x: 1, y: 0, side: 'N' }, { x: 2, y: 0, side: 'N' },
        { x: 0, y: 2, side: 'N' }, { x: 1, y: 2, side: 'N' }, { x: 2, y: 2, side: 'N' },
        { x: -1, y: 0, side: 'E' }, { x: -1, y: 1, side: 'E' },
        { x: 2, y: 0, side: 'E' }, { x: 2, y: 1, side: 'E' },
      ],
      effectZones: [
        { id: 'galerie', label: 'Galerie', presentation: 'interior', area: { kind: 'rect', x: 1, y: 0, w: zoneW, h: 2 }, z: 0 },
      ],
    };
  }

  const alertes = (scene: Scene) => validateScene([scene]).filter((w) => w.sceneId === scene.id);
  const cases = (at: ReturnType<typeof planFocusAt>) => (at && at.kind === 'zone' ? at.tiles.length : 0);

  it('les cases allumées FONDENT à mesure que l’auteur retaille la zone, puis la mise en évidence s’éteint', () => {
    const depart = planTemoin(4); // la zone mord 2 colonnes de route → 4 cases fautives
    const suivi = alertes(depart).find((w) => w.plan?.family === 'zone-debordante');
    expect(suivi?.plan).toBeTruthy();
    const key = planDefectKey(suivi!.plan!);
    expect(cases(planFocusAt(alertes(depart), key))).toBe(4);

    // Une colonne rendue à la route : le MÊME défaut, moins de cases.
    expect(cases(planFocusAt(alertes(planTemoin(3)), key))).toBe(2);

    // Zone entièrement bâtie : plus aucun avertissement ne porte ce défaut → l’annotation s’éteint.
    expect(planFocusAt(alertes(planTemoin(2)), key)).toBeNull();
  });

  it('l’identité d’un défaut ne tient PAS à ses cases (elle survit à leur décompte), et distingue deux zones', () => {
    const a = alertes(planTemoin(4)).find((w) => w.plan?.family === 'zone-debordante')!.plan!;
    const b = alertes(planTemoin(3)).find((w) => w.plan?.family === 'zone-debordante')!.plan!;
    expect(planDefectKey(a)).toBe(planDefectKey(b));
    expect(planDefectKey({ family: a.family, at: { kind: 'zone', zoneId: 'cave', z: 0, tiles: [] } })).not.toBe(planDefectKey(a));
  });

  it('sans défaut suivi, rien n’est mis en évidence', () => {
    expect(planFocusAt(alertes(planTemoin(4)), null)).toBeNull();
  });
});

/**
 * L'app ÉCRIT l'enveloppe comme le dépôt la porte : `id`, `type`, `label` en tête du document
 * (les 4 `…-projet.json` de `src/scenes`). L'ordre des clés n'est pas cosmétique — c'est la relecture d'un
 * document authoré à l'éditeur à côté d'un document committé, dans un diff comme à l'œil.
 */
describe('Editor v2 — le document ÉCRIT s’ouvre sur son identité (`id`, `type`, `label`)', () => {
  afterEach(() => {
    __setIdbBackendForTest(null);
  });

  it('« Fichier → Enregistrer » couche un projet dont les 3 premières clés sont `id`, `type`, `label`', async () => {
    const couches: SavedProject[] = [];
    __setIdbBackendForTest({
      async getAll() { return [] as SavedProject[]; },
      async put(p: SavedProject) { couches.push(p); },
      async delete() { /* non exercé ici */ },
      async clear() { /* non exercé ici */ },
    });

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);
    await act(async () => {
      root.render(<Editor initialScene={{ ...emptyScene(4, 4), id: 'scene-ordre', label: 'Ordre' }} />);
    });

    const byText = (label: string) => Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes(label))!;
    await act(async () => { byText('Fichier').click(); });
    await act(async () => { byText('Enregistrer…').click(); });
    const saveBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Enregistrer')!;
    await act(async () => { saveBtn.click(); });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });

    expect(couches.length, 'aucun projet couché — le geste d’enregistrement n’a pas abouti.').toBe(1);
    const project = couches[0].project as unknown as Record<string, unknown>;
    expect(Object.keys(project).slice(0, 3)).toEqual(['id', 'type', 'label']);
    expect(project.type).toBe('projet');

    await act(async () => { root.unmount(); });
    container.remove();
  });
});
