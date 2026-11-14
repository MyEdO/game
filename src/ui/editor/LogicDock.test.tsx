// @vitest-environment jsdom
import { flowFromEffects } from '../../noyau/monde/flow';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act } from 'react';
import { monterRacine, demonterRacines } from '../../monterRacine.testkit';
import { addTrigger } from '../../noyau/sceneEdit';
import type { Scene } from '../../noyau/monde/scene';
import { renderToStaticMarkup } from 'react-dom/server';
import { emptyScene } from '../../noyau/monde/scene';
import { emptyNarratif } from '../../noyau/monde/campaignNarratif';
import { LogicDock } from './LogicDock';
import { wallSideSchema } from '../../data/schemas/defs-scenes/communs';
import { effectSummary } from './EffectList';
import { CIBLES_D_EFFET_DE_SCENE } from '../../noyau/combatEffects';

const SCENE = { cibles: CIBLES_D_EFFET_DE_SCENE };

function dock(overrides: Partial<Parameters<typeof LogicDock>[0]>) {
  const scene = emptyScene('scene-test', 10, 10);
  return (
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
    />
  );
}

describe('LogicDock — onglet Rencontres (remplace la modale EncountersEditor)', () => {
  it('affiche les récompenses de victoire (onVictory) de la rencontre sélectionnée', () => {
    const scene = emptyScene('scene-test', 10, 10);
    scene.encounters = [{ id: 'e1', members: [], onVictory: flowFromEffects([{ type: 'giveXp', amount: 20 }]) }];
    const html = renderToStaticMarkup(dock({ scene, tab: 'encounters', encSel: 'e1' }));
    expect(html).toContain('À la victoire'); // section de récompenses
    expect(html).toContain('Donner des PX'); // l'option giveXp du constructeur d'effets
    expect(html).toContain('value="20"'); // le montant câblé à onVictory
    expect(html).toContain('Surprise (embuscade, LDB 13)');
  });

  it('le select d’arête de la condition « détruire une structure » offre EXACTEMENT les côtés du canon', () => {
    // Les `<option>` sont DÉRIVÉES de `wallSideSchema.options` (#1440) : sans contrat positif, un canon
    // vidé rendrait un select MUET sans qu'aucun rouge ne sorte.
    const scene = emptyScene('scene-test', 10, 10);
    scene.encounters = [{ id: 'e1', members: [], victoryCondition: { type: 'destroyStructure', edge: { x: 2, y: 3, side: '\\' } } }];
    const html = renderToStaticMarkup(dock({ scene, tab: 'encounters', encSel: 'e1' }));
    const bloc = html.slice(html.indexOf('Arête'));
    const options = [...bloc.matchAll(/<option value="([^"]*)"/g)].map((m) => m[1]).slice(0, wallSideSchema.options.length);
    expect(options, 'les options du select d’arête ≠ les côtés du canon').toEqual([...wallSideSchema.options]);
    expect(bloc).toContain('selected'); // le côté STOCKÉ est bien l'option retenue
  });
});

describe('LogicDock — sortie à seuil de dommage (#215 ; MDG 15 l.143, l.166-168)', () => {
  afterEach(demonterRacines);
  const rencontre = (victoryCondition: NonNullable<Scene['encounters'][number]['victoryCondition']>): Scene => {
    const scene = emptyScene('scene-test', 10, 10);
    scene.entities = [{ id: 'syrene', kind: 'personnage', creature: { id: 'syrene-bleue' }, pos: { x: 1, y: 1 } }];
    scene.encounters = [{ id: 'e1', members: [{ entityId: 'syrene' }], victoryCondition }];
    return scene;
  };
  const selectDeCible = (racine: HTMLElement): HTMLSelectElement =>
    [...racine.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.textContent === '— chaque adversaire —'))!;
  const choisir = (select: HTMLSelectElement, valeur: string) => act(() => {
    select.value = valeur;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });

  it('sans cible, « chaque adversaire » est retenu ; élire une cible la pose', async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const scene = rencontre({ type: 'woundsThreshold', atOrBelowPercent: 50 });
    let pose: Scene = scene;
    const montage = monterRacine(null);
    await act(() => montage.rendre(dock({ scene, tab: 'encounters', encSel: 'e1', setScene: (s: Scene) => { pose = s; } })));
    const select = selectDeCible(montage.container);
    expect(select.value).toBe('');
    expect(montage.container.textContent).toContain('% de ses Blessures ou moins');
    await choisir(select, 'syrene');
    expect(pose.encounters[0].victoryCondition).toEqual({ type: 'woundsThreshold', targetId: 'syrene', atOrBelowPercent: 50 });
  });

  it('revenir à « chaque adversaire » retire la cible', async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const scene = rencontre({ type: 'woundsThreshold', targetId: 'syrene', atOrBelowPercent: 40 });
    let pose: Scene = scene;
    const montage = monterRacine(null);
    await act(() => montage.rendre(dock({ scene, tab: 'encounters', encSel: 'e1', setScene: (s: Scene) => { pose = s; } })));
    const select = selectDeCible(montage.container);
    expect(select.value).toBe('syrene');
    await choisir(select, '');
    expect(pose.encounters[0].victoryCondition).toEqual({ type: 'woundsThreshold', atOrBelowPercent: 40 });
  });
});

describe('LogicDock — onglet Triggers (master-détail, édition LIVE)', () => {
  it('liste les triggers et édite le sélectionné (rect + condition + effets)', () => {
    const scene = emptyScene('scene-test', 10, 10);
    scene.triggers = [
      { id: 'trig-porte', rect: { x: 1, y: 2, w: 3, h: 1 }, once: true, when: { kind: 'flag', expr: 'cle' }, flow: flowFromEffects([{ type: 'journal', desc: 'La porte grince' }]) },
    ];
    const html = renderToStaticMarkup(dock({ scene, tab: 'triggers', trigSel: 'trig-porte' }));
    expect(html).toContain('trig-porte');
    expect(html).toContain('Au déclenchement'); // éditeur de Flow (effets · conditions · tests)
    expect(html).toContain('La porte grince');
  });
});

describe('LogicDock — « + Nouveau trigger » est le créateur du noyau', () => {
  afterEach(demonterRacines);
  it('le trigger posé à l’étage courant est celui que rend `addTrigger`', async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const scene = emptyScene('scene-test', 10, 10);
    let pose: Scene | null = null;
    const montage = monterRacine(null);
    await act(() => montage.rendre(dock({ scene, tab: 'triggers', currentLayer: 1, setScene: (s: Scene) => { pose = s; } })));
    const bouton = [...montage.container.querySelectorAll('button')].find((b) => b.textContent?.includes('Nouveau trigger'))!;
    await act(async () => { bouton.click(); });
    expect(pose).toEqual(addTrigger(scene, { x: 0, y: 0, w: 2, h: 2 }, 1).scene);
  });
});

/** Saisit `value` dans le champ `caption` puis le quitte : un champ live la pose à la frappe, un brouillon au blur. */
async function renommerDansLeDock(racine: HTMLElement, caption: string, value: string) {
  const champ = [...racine.querySelectorAll('label')].find((l) => l.textContent?.trim().startsWith(caption))!.querySelector('input')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(champ, value);
    champ.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => { champ.dispatchEvent(new FocusEvent('focusout', { bubbles: true })); });
}

describe('LogicDock — un id de trigger ou de rencontre est unique à la scène (comme `renameEntry`)', () => {
  afterEach(demonterRacines);
  const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

  it('l’id d’une autre rencontre est refusé ; un id libre est posé', async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const scene = emptyScene('scene-test', 10, 10);
    scene.encounters = [{ id: 'e1', members: [] }, { id: 'e2', members: [] }];
    let pose: Scene = scene;
    const montage = monterRacine(null);
    await act(() => montage.rendre(dock({ scene, tab: 'encounters', encSel: 'e1', setScene: (s: Scene) => { pose = s; } })));
    await renommerDansLeDock(montage.container, 'Id (référencé', 'e2');
    expect(ids(pose.encounters), 'deux rencontres sous le même id').toEqual(['e1', 'e2']);
    await renommerDansLeDock(montage.container, 'Id (référencé', 'embuscade');
    expect(ids(pose.encounters)).toEqual(['embuscade', 'e2']);
  });

  it('l’id d’un autre trigger est refusé ; un id libre est posé', async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const scene = emptyScene('scene-test', 10, 10);
    const trig = (id: string) => ({ id, rect: { x: 0, y: 0, w: 1, h: 1 }, once: true, flow: flowFromEffects([]) });
    scene.triggers = [trig('t1'), trig('t2')];
    let pose: Scene = scene;
    const montage = monterRacine(null);
    await act(() => montage.rendre(dock({ scene, tab: 'triggers', trigSel: 't1', setScene: (s: Scene) => { pose = s; } })));
    await renommerDansLeDock(montage.container, 'Id', 't2');
    expect(ids(pose.triggers), 'deux triggers sous le même id').toEqual(['t1', 't2']);
    await renommerDansLeDock(montage.container, 'Id', 'porte');
    expect(ids(pose.triggers)).toEqual(['porte', 't2']);
  });
});

describe('LogicDock — onglet Dialogues (master-détail de nœuds)', () => {
  it('affiche le détail du dialogue sélectionné, un nœud à la fois', () => {
    const scene = emptyScene('scene-test', 10, 10);
    scene.dialogues = [
      {
        id: 'dlg-forgeron',
        start: { id: 'n1' },
        nodes: [
          { id: 'n1', desc: 'Bonjour voyageur', choices: [{ id: 'revoir', label: 'Au revoir', next: { id: 'n2' } }] },
          { id: 'n2', desc: 'Bonne route', choices: [] },
        ],
      },
    ];
    const html = renderToStaticMarkup(dock({ scene, tab: 'dialogues', dlgSel: 'dlg-forgeron' }));
    expect(html).toContain('dlg-forgeron');
    expect(html).toContain('Bonjour voyageur'); // le nœud de départ est édité
    expect(html).toContain('Au revoir'); // résumé du choix replié
    expect(html).toContain('→ n2'); // cible du choix
  });
});

describe('effectSummary — résumés humains des rangées repliées', () => {
  it('résume les effets courants en clair', () => {
    expect(effectSummary({ type: 'giveXp', amount: 50 }, SCENE)).toContain('50 PX');
    expect(effectSummary({ type: 'startCombat', encounter: 'enc-rats' }, SCENE)).toContain('enc-rats');
    expect(effectSummary({ type: 'setFlag', flag: 'porte_ouverte', value: true }, SCENE)).toContain('porte_ouverte');
    expect(effectSummary({ type: 'giveMoney', montant: { gold: 2, silver: 5, brass: 0 } }, SCENE)).toBe('Argent : 2 CO 5/–');
    expect(
      effectSummary({ type: 'transition', scene: { id: 'sc-b' }, entry: 'porte' }, { ...SCENE, scenes: [{ id: 'sc-b', nom: 'Taverne', entries: ['porte'] }] }),
    ).toContain('Taverne');
    expect(effectSummary({ type: 'extendedTest', skill: { id: 'crochetage' }, label: 'Serrure', drCible: 5 }, SCENE)).toContain('Crochetage');
  });
});
