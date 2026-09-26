// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { act } from 'react';
import { monterRacine, demonterRacines } from '../../monterRacine.testkit';
import { SeatAssignmentsField } from './SeatAssignmentsField';
import { emptyScene, type Scene } from '../../state/scene';
import { PARTY_MAX } from '../../state/combatants';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(demonterRacines);

/** Table ronde en (2,2) cap `N` → abords : nord (2,1), est (3,2), sud (2,3), ouest (1,2). */
function sceneWithTableAndNpc(): Scene {
  const s = emptyScene(8, 8);
  s.entities = [
    { id: 'table-1', kind: 'prop', pos: { x: 2, y: 2 }, ref: 'table-ronde-4-tabourets', facing: 'N' },
    { id: 'pnj-aubergiste', kind: 'personnage', ref: 'humain', pos: { x: 6, y: 6 }, label: 'Aubergiste' },
  ];
  return s;
}

function mount(scene: Scene, propId = 'table-1') {
  let latest = scene;
  const { container, rendre } = monterRacine(null);
  const render = (s: Scene) =>
    rendre(<SeatAssignmentsField scene={s} propId={propId} onChange={(next) => { latest = next; render(next); }} />);
  act(() => render(scene));
  const selects = () => [...container.querySelectorAll('select')] as HTMLSelectElement[];
  return {
    container,
    sceneOf: () => latest,
    text: () => container.textContent ?? '',
    /** Le `<select>` de la place dont le `<label>` porte ce texte. */
    selectOf: (labelText: string) => {
      const found = [...container.querySelectorAll('label')].find((l) => l.textContent?.startsWith(labelText));
      const sel = found?.querySelector('select');
      if (!sel) throw new Error(`aucune place « ${labelText} » (labels : ${selects().length})`);
      return sel as HTMLSelectElement;
    },
    choose: (labelText: string, value: string) => {
      const sel = [...container.querySelectorAll('label')]
        .find((l) => l.textContent?.startsWith(labelText))!
        .querySelector('select') as HTMLSelectElement;
      act(() => {
        sel.value = value;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      });
    },
  };
}

describe('SeatAssignmentsField — authoring des places assises (id-only)', () => {
  it('affiche les slots de la ref et écrit un occupant par id', () => {
    const ui = mount(sceneWithTableAndNpc());
    expect(ui.text()).toContain('4 places');
    expect([...ui.selectOf('place-1').options].map((o) => o.value))
      .toEqual(['', 'entity:pnj-aubergiste', ...Array.from({ length: PARTY_MAX }, (_, i) => `party:${i + 1}`)]);
    ui.choose('place-1', 'entity:pnj-aubergiste');
    expect(ui.sceneOf().seatAssignments).toEqual({ 'table-1': { 'place-1': { kind: 'entity', entityId: 'pnj-aubergiste' } } });
  });

  it('pose la `pos` du PNJ sur l’abord EFFECTIF de sa place, dans la même écriture', () => {
    const ui = mount(sceneWithTableAndNpc());
    ui.choose('place-1', 'entity:pnj-aubergiste');
    expect(ui.sceneOf().entities.find((e) => e.id === 'pnj-aubergiste')?.pos).toEqual({ x: 2, y: 1 });
  });

  // ── G4 ───────────────────────────────────────────────────────────────────────────────────────────
  it('« — personne — » sur une place DÉJÀ vide ne publie RIEN — aucun cran d’undo à vide', () => {
    const depart = sceneWithTableAndNpc();
    let publications = 0;
    const { container } = monterRacine(<SeatAssignmentsField scene={depart} propId="table-1" onChange={() => { publications += 1; }} />);
    const sel = [...container.querySelectorAll('label')].find((l) => l.textContent?.startsWith('place-3'))!.querySelector('select') as HTMLSelectElement;
    act(() => { sel.value = ''; sel.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(publications).toBe(0);
  });

  it('« — personne — » libère la place et laisse le PNJ où il se tient', () => {
    const ui = mount(sceneWithTableAndNpc());
    ui.choose('place-1', 'entity:pnj-aubergiste');
    ui.choose('place-1', '');
    expect(ui.sceneOf().seatAssignments).toEqual({});
    expect(ui.sceneOf().entities.find((e) => e.id === 'pnj-aubergiste')?.pos).toEqual({ x: 2, y: 1 });
  });

  it('rasseoir un PNJ déjà attablé le DÉPLACE de place — jamais deux places pour un corps', () => {
    const ui = mount(sceneWithTableAndNpc());
    ui.choose('place-1', 'entity:pnj-aubergiste');
    ui.choose('place-2', 'entity:pnj-aubergiste');
    expect(ui.sceneOf().seatAssignments).toEqual({ 'table-1': { 'place-2': { kind: 'entity', entityId: 'pnj-aubergiste' } } });
    expect(ui.sceneOf().entities.find((e) => e.id === 'pnj-aubergiste')?.pos).toEqual({ x: 3, y: 2 });
  });

  it('n’offre AUCUNE saisie libre : chaque option est un id d’entité ou un EMPLACEMENT du groupe', () => {
    const ui = mount(sceneWithTableAndNpc());
    expect(ui.container.querySelectorAll('input').length).toBe(0);
    for (const opt of [...ui.selectOf('place-3').options].filter((o) => o.value)) {
      const rang = Number(opt.value.replace('party:', ''));
      const estEmplacement = opt.value.startsWith('party:') && rang >= 1 && rang <= PARTY_MAX;
      const estEntite = ui.sceneOf().entities.some((e) => `entity:${e.id}` === opt.value);
      expect(estEmplacement || estEntite, opt.value).toBe(true);
    }
  });

  it('un décor sans place n’affiche rien', () => {
    const s = sceneWithTableAndNpc();
    s.entities[0] = { id: 'table-1', kind: 'prop', pos: { x: 2, y: 2 }, ref: 'tonneau' };
    expect(mount(s).text()).toBe('');
  });

  // ── R11 : l'authoring parle EMPLACEMENTS, jamais héros ───────────────────────────────────────────
  it('propose les EMPLACEMENTS du groupe, liste FIXE, sur un document qui n’assoit personne', () => {
    const ui = mount(sceneWithTableAndNpc());
    const valeurs = [...ui.selectOf('place-1').options].map((o) => o.value);
    for (let rang = 1; rang <= PARTY_MAX; rang++) expect(valeurs).toContain(`party:${rang}`);
    expect(ui.text()).toContain(`Héros ${PARTY_MAX}`);
    // …et AUCUN id de héros : la liste ne dépend ni du document ni d'une partie.
    expect(valeurs.filter((v) => v.startsWith('party:'))).toHaveLength(PARTY_MAX);
  });

  it('assigne un EMPLACEMENT par rang, et le déplacer d’une place à l’autre est ACCEPTÉ', () => {
    const ui = mount(sceneWithTableAndNpc());
    ui.choose('place-1', 'party:2');
    expect(ui.sceneOf().seatAssignments).toEqual({ 'table-1': { 'place-1': { kind: 'party', rang: 2 } } });
    ui.choose('place-3', 'party:2');
    expect(ui.sceneOf().seatAssignments).toEqual({ 'table-1': { 'place-3': { kind: 'party', rang: 2 } } });
    expect(ui.text()).not.toContain('Place refusée');
  });

  it('libérer un emplacement le laisse proposable — la liste ne dépend pas de l’occupation', () => {
    const ui = mount(sceneWithTableAndNpc());
    ui.choose('place-1', 'party:1');
    ui.choose('place-1', '');
    expect(ui.sceneOf().seatAssignments).toEqual({});
    expect([...ui.selectOf('place-1').options].map((o) => o.value)).toContain('party:1');
    ui.choose('place-1', 'party:1');
    expect(ui.sceneOf().seatAssignments).toEqual({ 'table-1': { 'place-1': { kind: 'party', rang: 1 } } });
  });

  it('un abord introuvable REFUSE la place, en toutes lettres, sans écrire', () => {
    const s = sceneWithTableAndNpc();
    // Table cernée de murs : aucune case voisine du siège n'est marchable, aucun abord ne se résout.
    s.layers = [{ z: 0, tiles: new Array(8 * 8).fill('mur') }];
    s.layers[0].tiles[2 * 8 + 2] = 'plancher';
    s.entities[1] = { id: 'pnj-aubergiste', kind: 'personnage', ref: 'humain', pos: { x: 2, y: 2 }, label: 'Aubergiste' };
    const ui = mount(s);
    ui.choose('place-1', 'entity:pnj-aubergiste');
    expect(ui.sceneOf().seatAssignments).toBeUndefined();
    expect(ui.text()).toContain('aucun abord praticable ne dessert cette place');
  });
});
