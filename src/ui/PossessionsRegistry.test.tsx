// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Combatant } from '../engine/types';
import type { Possession } from '../engine/possession';
import { PossessionsRegistry } from './PossessionsRegistry';
import { useGame } from '../state/store';
import { objetDeTest } from '../engine/objetDeTest.testkit';

const hero = (id: string): Combatant =>
  ({
    id,
    label: 'H',
    kind: 'hero',
    species: 'humains-reiklander',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 12, max: 12 },
    advantage: 0,
    conditions: [],
    weapons: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [],
    talents: [],
    movement: 4,
    xp: 0,
    charAdvances: {},
  }) as unknown as Combatant;

const mount = (node: React.ReactElement) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => { root.render(node); });
  return { container, root };
};

describe('PossessionsRegistry (#649) — registre des possessions dont le héros est propriétaire', () => {
  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });
  let container: HTMLDivElement;
  let root: Root;
  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
  });

  it('affiche une possession `bete` du héros, masque celle détruite et celle d’un autre propriétaire', () => {
    const h = hero('h1');
    const possessions: Possession[] = [
      { uid: 'pos-1', ownerId: 'h1', nature: 'bete', ref: { creatureId: 'cheval' }, location: { kind: 'avec-le-groupe' }, items: [] },
      { uid: 'pos-2', ownerId: 'h1', nature: 'bete', ref: { creatureId: 'cheval' }, location: { kind: 'avec-le-groupe' }, items: [], destroyed: true, label: 'Détruite' },
      { uid: 'pos-3', ownerId: 'h2', nature: 'bete', ref: { creatureId: 'cheval' }, location: { kind: 'avec-le-groupe' }, items: [], label: 'AutrePropriétaire' },
    ];
    useGame.setState({ party: [h], possessions, battle: null });
    ({ container, root } = mount(<PossessionsRegistry hero={h} />));

    expect(container.textContent).toContain('Cheval');
    expect(container.textContent).not.toContain('Détruite');
    expect(container.textContent).not.toContain('AutrePropriétaire');
  });

  it('un objet PORTÉ par la possession rend son libellé par `itemLabel` — spécialisation comprise (#1463 L-ref-1)', () => {
    const h = hero('h1');
    const sacoche: Possession[] = [
      {
        uid: 'pos-7', ownerId: 'h1', nature: 'bete', ref: { creatureId: 'cheval' }, location: { kind: 'avec-le-groupe' },
        items: [
          objetDeTest({ uid: 'i1', trappingId: 'outils-professionnels', spec: 'Maréchal-ferrant', kind: 'misc', qualities: [], enc: 1, equipped: false }),
          objetDeTest({ uid: 'i2', trappingId: 'bouclier', kind: 'armor', qualities: [], enc: 1, equipped: false }),
        ],
      } as unknown as Possession,
    ];
    useGame.setState({ party: [h], possessions: sacoche, battle: null });
    ({ container, root } = mount(<PossessionsRegistry hero={h} />));

    expect(container.textContent).toContain('Outils professionnels (Maréchal-ferrant)');
    expect(container.textContent).toContain('Bouclier');
    expect(container.textContent, 'un objet SANS spéc ne gagne aucune parenthèse').not.toContain('Bouclier (');
  });

  it('sans possession de ce héros, ne rend rien', () => {
    const h = hero('h1');
    useGame.setState({ party: [h], possessions: [], battle: null });
    ({ container, root } = mount(<PossessionsRegistry hero={h} />));
    expect(container.innerHTML).toBe('');
  });

  it('possession `vehicule` — chip codex-liée (`CodexRef category="vehicles"`) cliquable (pas de `tooltipOnly`)', () => {
    const h = hero('h1');
    const possessions: Possession[] = [
      { uid: 'pos-4', ownerId: 'h1', nature: 'vehicule', vehicleId: 'diligence', location: { kind: 'avec-le-groupe' }, items: [] },
    ];
    useGame.setState({ party: [h], possessions, battle: null });
    ({ container, root } = mount(<PossessionsRegistry hero={h} />));
    const ref = container.querySelector('.codex-ref');
    expect(ref).toBeTruthy();
    expect(ref?.classList.contains('codex-static')).toBe(false); // cliquable → ouvre la fiche Codex
  });

  it('deux natures présentes → deux `Band` distinctes', () => {
    const h = hero('h1');
    const possessions: Possession[] = [
      { uid: 'pos-5', ownerId: 'h1', nature: 'bete', ref: { creatureId: 'cheval' }, location: { kind: 'avec-le-groupe' }, items: [] },
      { uid: 'pos-6', ownerId: 'h1', nature: 'vehicule', vehicleId: 'diligence', location: { kind: 'avec-le-groupe' }, items: [] },
    ];
    useGame.setState({ party: [h], possessions, battle: null });
    ({ container, root } = mount(<PossessionsRegistry hero={h} />));
    expect(container.querySelectorAll('.creator-band').length).toBe(2);
    expect(container.textContent).toContain('Montures & bêtes');
    expect(container.textContent).toContain('Véhicules');
  });
});
