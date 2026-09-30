import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { emptyScene, type Scene } from '../../state/scene';
import { EMPTY_FLOW } from '../../state/flow';
import { Inspector } from './Inspector';
import { LogicDock } from './LogicDock';
import { Palette } from './Palette';
import { DEFAULT_LAYERS, hitAt } from './editorState';
import { emptyNarratif } from '../../state/campaignNarratif';

/**
 * FRONTIÈRE D'ÉDITION — un FAIT du document de scène a UN propriétaire, une seule surface qui
 * l'écrit. Le partage est nommé ici, et il est VÉRIFIÉ par ÉGALITÉ de l'ensemble des champs
 * étiquetés que chaque surface expose : un champ qui repousse d'un second côté échoue.
 *
 *  - un TRIGGER : le dock Logique possède sa LOGIQUE (id, condition, une fois, effets),
 *    l'inspecteur possède sa PLACE (emprise x/y/L/H, étage) ;
 *  - un CORPS d'architecture : la palette est l'OUTIL (quelle cible on vise, quoi créer),
 *    l'inspecteur possède les PROPRIÉTÉS de l'élément sélectionné (libellé, style, toiture) ;
 *  - « Pièces révélées » : l'ÉTAGE porte `storey.roomZoneIds`, la FAÇADE porte le sien.
 */

/** Libellés des champs ÉTIQUETÉS (un `<label>` qui contient un contrôle) d'un fragment rendu. */
function champsEtiquetes(html: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/<label\b[^>]*>([\s\S]*?)<\/label>/g)) {
    const inner = m[1];
    if (!/<(input|select|textarea)\b/.test(inner)) continue;
    const texte = inner.replace(/<select\b[\s\S]*?<\/select>/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (texte) out.push(texte);
  }
  return out;
}

const TRIGGER = { id: 'trig-porte', rect: { x: 3, y: 4, w: 2, h: 2, z: 1 }, once: true, when: { kind: 'flag', expr: 'cle' }, flow: EMPTY_FLOW } as const;

function sceneAvecTrigger(): Scene {
  const s = emptyScene(10, 10);
  s.layers = [s.layers[0], { ...s.layers[0], z: 1 }];
  s.triggers = [{ ...TRIGGER }];
  return s;
}

function inspecteur(scene: Scene, sel: Parameters<typeof Inspector>[0]['sel']) {
  return renderToStaticMarkup(
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
      narratif={emptyNarratif()}
      tool={{ mode: 'select' }}
      armZoneTiles={() => undefined}
      zoneFocusKey={null}
    />,
  );
}

function dock(scene: Scene, overrides: Partial<Parameters<typeof LogicDock>[0]> = {}) {
  return renderToStaticMarkup(
    <LogicDock
      scene={scene}
      otherScenes={[]}
      worldMap={null}
      narratif={emptyNarratif()}
      setScene={vi.fn()}
      warnings={[]}
      onSelectWarning={vi.fn()}
      tab="triggers"
      setTab={vi.fn()}
      height={300}
      setHeight={vi.fn()}
      trigSel={null}
      setTrigSel={vi.fn()}
      dlgSel={null}
      setDlgSel={vi.fn()}
      encSel={null}
      setEncSel={vi.fn()}
      onSelectEntity={vi.fn()}
      currentLayer={0}
      {...overrides}
    />,
  );
}

function palette(scene: Scene) {
  return renderToStaticMarkup(
    <Palette
      scene={scene}
      tool={{ mode: 'select' }}
      setTool={vi.fn()}
      brush={1}
      setBrush={vi.fn()}
      terrainRect={false}
      setTerrainRect={vi.fn()}
      encTarget=""
      setEncTarget={vi.fn()}
      encRef=""
      setEncRef={vi.fn()}
      enemyCreatures={[]}
      currentLayer={0}
      stairRun={[]}
      onStairApply={vi.fn()}
      onStairClear={vi.fn()}
      architectureMode
      architectureBodyId="corps"
      architectureStoreyId="z0"
      architectureAction="select"
      onArchitectureMode={vi.fn()}
      onArchitectureBody={vi.fn()}
      onArchitectureStorey={vi.fn()}
      onAddArchitectureBody={vi.fn()}
      onAddArchitecturePart={vi.fn()}
      onAddArchitectureStorey={vi.fn()}
      onAddRoofSection={vi.fn()}
      onArmFacade={vi.fn()}
    />,
  );
}

function sceneAvecCorps(masses: Scene['architecture'] extends undefined ? never : NonNullable<Scene['architecture']>[number]['masses'] = []): Scene {
  return {
    ...emptyScene(12, 12),
    architecture: [{
      id: 'corps',
      label: 'La Diligence',
      style: 'maison',
      storeys: [{ id: 'z0', z: 0, parts: [{ id: 'part-0', foot: { x: 1, y: 1, w: 4, h: 4 } }], roomZoneIds: [] }],
      facades: [],
      masses,
    }],
  };
}

describe('un TRIGGER : le dock possède la logique, l’inspecteur possède la place', () => {
  it('l’inspecteur édite EXACTEMENT l’emprise et l’étage', () => {
    const html = inspecteur(sceneAvecTrigger(), { type: 'trigger', id: 'trig-porte' });
    expect(champsEtiquetes(html)).toEqual(['X', 'Y', 'L', 'H', 'Étage']);
    expect(html).toContain('Effets (0)'); // la passerelle vers le propriétaire de la logique
  });

  it('le dock édite EXACTEMENT l’identité et le déclenchement, et rend le Flow', () => {
    const html = dock(sceneAvecTrigger(), { tab: 'triggers', trigSel: 'trig-porte' });
    const detail = html.slice(html.indexOf('logic-detail'));
    expect(champsEtiquetes(detail)).toEqual(['Id', 'une fois']);
    expect(detail).toContain('Condition de déclenchement');
    expect(detail).toContain('Au déclenchement');
  });
});

describe('un CORPS d’architecture : la palette VISE et CRÉE, l’inspecteur ÉDITE', () => {
  it('la palette n’expose que les deux cibles actives', () => {
    expect(champsEtiquetes(palette(sceneAvecCorps()))).toEqual(['Corps actif', 'Étage actif']);
  });

  it('les cinq créations de la palette sont là, dont la section de toiture', () => {
    const html = palette(sceneAvecCorps());
    for (const action of ['Nouveau corps', 'Nouvel étage', 'Nouvelle partie', 'Section de façade', 'Section de toiture'])
      expect(html).toContain(action);
  });

  it('l’inspecteur possède le libellé, le style et la toiture du corps', () => {
    const html = inspecteur(sceneAvecCorps(), { type: 'architectureBody', id: 'corps' });
    expect(champsEtiquetes(html)).toEqual(['Libellé', 'Type de bâtiment', 'Profil', 'Pente (degrés)', 'Comble (étages)', 'Couverture']);
    expect(html).toContain('Toiture du corps');
  });

  it('une PARTIE n’édite que son emprise — les pièces révélées appartiennent à l’étage', () => {
    const html = inspecteur(sceneAvecCorps(), { type: 'architecturePart', bodyId: 'corps', storeyId: 'z0', id: 'part-0' });
    expect(champsEtiquetes(html)).toEqual(['X', 'Y', 'L', 'H']);
  });
});

describe('une MASSE de toiture n’est une cible d’édition que si elle est AUTHORÉE', () => {
  // Emprise HORS de la partie du plan (1,1,4×4) : c'est la masse seule qui décide du picking ici.
  const emprise = [{ x: 7, y: 7, w: 3, h: 3 }];
  const quadruplet = { levels: 1, profile: 'gable', ridge: 'x', pitchDeg: 42, material: 'tuile' } as const;

  it('sous une masse authorée, le clic sélectionne la masse', () => {
    const scene = sceneAvecCorps([{ id: 'masse-0', z: 0, footprint: emprise, ...quadruplet }]);
    expect(hitAt(scene, { x: 8, y: 8 }, DEFAULT_LAYERS, 0)).toEqual({ type: 'roofSection', bodyId: 'corps', id: 'masse-0' });
  });

  it('sous une masse DÉRIVÉE, le clic retombe sur le corps — son fait s’édite sur lui', () => {
    const scene = sceneAvecCorps([{ id: 'corps-auto-z0-l1-0', z: 0, footprint: emprise, ...quadruplet, derived: true }]);
    expect(hitAt(scene, { x: 8, y: 8 }, DEFAULT_LAYERS, 0, 'corps')).toEqual({ type: 'architectureStorey', bodyId: 'corps', id: 'z0' });
  });
});

describe('une RENCONTRE : le dock édite ses règles, la carte pose ses combattants', () => {
  it('le détail d’une rencontre édite ses règles et renvoie à la carte pour poser un membre', () => {
    const scene = emptyScene(10, 10);
    scene.encounters = [{ id: 'enc-cour', members: [] }];
    const html = dock(scene, { tab: 'encounters', encSel: 'enc-cour' });
    const detail = html.slice(html.indexOf('logic-detail'));
    expect(detail).toContain('Surprise (embuscade, LDB 13)');
    expect(detail).toContain('Objectif de victoire');
    expect(detail).toContain('se pose SUR LA CARTE');
  });
});
