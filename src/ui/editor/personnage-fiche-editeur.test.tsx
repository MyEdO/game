// @vitest-environment jsdom
/**
 * #1882 — l'éditeur pose une FICHE : la Palette propose les fiches du bestiaire (profils standard de
 * `LDB 77 l.7` en tête, désignés par `species.json`), l'Inspecteur n'offre aucun geste qui retire le
 * dernier porteur de fiche, la barre d'état nomme la fiche par son libellé.
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { monterRacine, demonterRacines } from '../../monterRacine.testkit';
import { Palette } from './Palette';
import { Inspector } from './Inspector';
import { toolLabel } from './StatusBar';
import { emptyScene, type Scene, type SceneEntity } from '../../state/scene';
import { creatureLabel, profilsStandard } from '../../data';
import type { Tool } from './editorState';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(demonterRacines);

const BESTIAIRE = [
  { id: 'mutant', label: 'Mutant' },
  { id: 'nain', label: 'Nain' },
  { id: 'gobelin', label: 'Gobelin' },
  { id: 'humain', label: 'Humain' },
];

function palette(tool: Tool) {
  const outils: Tool[] = [];
  const montage = monterRacine(null);
  const noop = () => undefined;
  const rendre = (t: Tool) => montage.rendre(
    <Palette
      scene={emptyScene(8, 8)} tool={t} setTool={(n) => { outils.push(n); rendre(n); }}
      brush={1} setBrush={noop} terrainRect={false} setTerrainRect={noop}
      encTarget="" setEncTarget={noop} encRef="" setEncRef={noop} enemyCreatures={BESTIAIRE}
      currentLayer={0} stairRun={[]} onStairApply={noop} onStairClear={noop}
      architectureMode={false} architectureBodyId={null} architectureStoreyId={null} architectureAction="select"
      onArchitectureMode={noop} onArchitectureBody={noop} onArchitectureStorey={noop} onAddArchitectureBody={noop}
      onAddArchitecturePart={noop} onAddArchitectureStorey={noop} onAddRoofSection={noop} onArmFacade={noop}
    />,
  );
  act(() => rendre(tool));
  const items = () => [...montage.container.querySelectorAll<HTMLButtonElement>('.pal-list button.pal-item')];
  return { container: montage.container, outils, items };
}

describe('Palette — « Poser un personnage » choisit une FICHE du bestiaire', () => {
  it('les profils standard désignés par `species.json` viennent en tête, puis le reste du bestiaire ; aucune sentinelle', () => {
    const h = palette({ mode: 'entity', kind: 'personnage', ref: 'humain' });
    const standard = new Set(profilsStandard());
    const ids = h.items().map((b) => BESTIAIRE.find((c) => b.textContent!.startsWith(c.label))?.id);
    expect(ids).toEqual([
      ...BESTIAIRE.filter((c) => standard.has(c.id)).map((c) => c.id),
      ...BESTIAIRE.filter((c) => !standard.has(c.id)).map((c) => c.id),
    ]);
    expect(h.items()).toHaveLength(BESTIAIRE.length);
    expect(h.items().filter((b) => b.querySelector('.chip')?.textContent === 'Profil standard').map((b) => b.textContent))
      .toEqual(BESTIAIRE.filter((c) => standard.has(c.id)).map((c) => `${c.label}Profil standard`));
  });

  it('cliquer une fiche arme l’outil sur son id stable', () => {
    const h = palette({ mode: 'entity', kind: 'personnage', ref: 'humain' });
    act(() => h.items().find((b) => b.textContent === 'Gobelin')!.click());
    expect(h.outils[h.outils.length - 1]).toEqual({ mode: 'entity', kind: 'personnage', ref: 'gobelin' });
  });

  it('l’icône du rail arme l’outil sur la PREMIÈRE fiche offerte — un profil standard', () => {
    const h = palette({ mode: 'select' });
    act(() => h.container.querySelector<HTMLButtonElement>('button[aria-label="Poser un personnage"]')!.click());
    expect(h.outils[h.outils.length - 1]).toEqual({ mode: 'entity', kind: 'personnage', ref: 'nain' });
    expect(profilsStandard()).toContain('nain');
  });
});

function inspecteur(entity: SceneEntity) {
  const scene: Scene = { ...emptyScene(4, 4), entities: [entity] };
  let latest = scene;
  const montage = monterRacine(null);
  const rendre = (s: Scene) => montage.rendre(
    <Inspector
      scene={s} otherScenes={[]} worldMap={null}
      setScene={(next) => { latest = next; rendre(next); }}
      sel={{ type: 'entity', id: entity.id }} setSel={() => undefined}
      enemyCreatures={BESTIAIRE} openLogic={() => undefined} resizeScene={() => undefined}
      narratif={{ affaires: [], indices: [], presetsPnj: [{ id: 'preset-tavernier', profil: { label: 'Le Tavernier' } }], objets: [] }}
      tool={{ mode: 'select' }} armZoneTiles={() => undefined} zoneFocusKey={null}
    />,
  );
  act(() => rendre(scene));
  const select = (libelle: string) => [...montage.container.querySelectorAll('select')]
    .find((el) => el.closest('label')?.textContent?.includes(libelle)) as HTMLSelectElement | undefined;
  const choisir = (el: HTMLSelectElement, v: string) => act(() => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(el, v);
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  const bouton = (texte: string) => [...montage.container.querySelectorAll('button')].find((b) => b.textContent?.includes(texte));
  return { select, choisir, bouton, entOf: () => latest.entities[0] };
}

describe('Inspecteur — aucun geste ne retire le dernier porteur de fiche (#1882)', () => {
  it('le sélecteur de fiche n’offre AUCUNE option vide quand une fiche est nommée', () => {
    const h = inspecteur({ id: 'pnj', kind: 'personnage', ref: 'humain', pos: { x: 0, y: 0 } });
    const fiche = h.select('Fiche (bestiaire)')!;
    expect([...fiche.options].map((o) => o.value)).toEqual(BESTIAIRE.map((c) => c.id));
  });

  it('un preset SEUL porteur ne se retire pas : « aucun » est inéligible, et redevient éligible dès qu’une fiche le double', () => {
    const h = inspecteur({ id: 'pnj', kind: 'personnage', presetId: 'preset-tavernier', pos: { x: 0, y: 0 } });
    const aucun = () => [...h.select('Preset PNJ')!.options].find((o) => o.value === '')!;
    expect(aucun().disabled).toBe(true);
    expect([...h.select('Fiche (bestiaire)')!.options].filter((o) => o.value === '').map((o) => o.disabled)).toEqual([true]);
    h.choisir(h.select('Fiche (bestiaire)')!, 'humain');
    expect(h.entOf()).toMatchObject({ presetId: 'preset-tavernier', ref: 'humain' });
    expect(aucun().disabled).toBe(false);
  });

  it('quitter un profil personnalisé SEUL porteur NOMME la fiche qui le remplace, dans le même geste', () => {
    const h = inspecteur({ id: 'pnj', kind: 'personnage', label: 'Brigand', statblock: { type: 'statblock', label: 'Brigand', char: { B: 10 } }, pos: { x: 0, y: 0 } });
    expect(h.bouton('Revenir à la fiche du bestiaire')).toBeUndefined();
    h.choisir(h.select('Remplacer par une fiche du bestiaire')!, 'gobelin');
    expect(h.entOf().statblock).toBeUndefined();
    expect(h.entOf()).toMatchObject({ ref: 'gobelin', label: 'Brigand' });
  });

  it('« Profil personnalisé… » prend le LIBELLÉ de la fiche, jamais son id ni un nom de repli', () => {
    const h = inspecteur({ id: 'pnj', kind: 'personnage', ref: 'humain', pos: { x: 0, y: 0 } });
    act(() => h.bouton('Profil personnalisé')!.click());
    expect(h.entOf().statblock?.label).toBe(creatureLabel('humain'));
  });
});

describe('Barre d’état — l’outil personnage nomme sa fiche par son libellé', () => {
  it('libellé de la fiche, jamais l’id brut', () => {
    const html = renderToStaticMarkup(<>{toolLabel({ mode: 'entity', kind: 'personnage', ref: 'humain' })}</>);
    expect(html).toContain(creatureLabel('humain'));
    expect(creatureLabel('humain')).not.toBe('humain');
  });
});

describe('Inspecteur — un patch refusé par la porte (`TypeNonNomme`) est DIT à l’auteur, jamais levé', () => {
  it('forcer « aucun » preset sur un preset SEUL porteur : alerte nommée, entité intacte', () => {
    const h = inspecteur({ id: 'pnj', kind: 'personnage', presetId: 'preset-tavernier', pos: { x: 0, y: 0 } });
    h.choisir(h.select('Preset PNJ')!, '');
    expect(h.entOf().presetId).toBe('preset-tavernier');
    const alerte = document.querySelector('[role="alert"]');
    expect(alerte?.textContent).toContain('personnage « pnj » : « ref », « statblock », « presetId » absents');
  });
});
