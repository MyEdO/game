// @vitest-environment jsdom
/**
 * #1078 LOT B2 — le sous-titre (Z1) ne REDIT pas ce que la LIGNE du jet porte : la Compétence est le
 * label de la ligne, la Difficulté sa donnée (`.rm-roll-diff`, #1072). Ce qu'il garde, c'est ce
 * qu'aucune autre zone n'énonce (la hauteur d'un dénivelé, le bénéficiaire collectif d'une chanson).
 * Contrat POSITIF mesuré à l'ÉCRAN (montage réel, patron `createRoot`/`act` du repo) sur les deux
 * fenêtres à sous-titre bavard : Chute volontaire (`FallModal`) et Chanson de marin (`ShantyModal`).
 */
import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { FallModal } from './FallModal';
import { ShantyModal } from './ShantyModal';
import type { Combatant } from '../engine/types';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const chars = { 'capacite-de-combat': 45, 'capacite-de-tir': 50, force: 35, endurance: 35, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 40, sociabilite: 40 };
const mk = (id: string): Combatant =>
  ({ id, name: id, label: id, kind: 'hero', characteristics: { ...chars }, conditions: [], traumas: [], engagedWith: [], skills: [], talents: [], items: [],
     weapons: [], advantage: 0, size: 'moyenne', pos: { x: 0, y: 0 }, wounds: { current: 18, max: 18 }, resilience: 2, fortune: 2,
     species: 'humains-reiklander', bodyShape: 'humanoide', movement: 4, traits: [],
     armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 } } as unknown as Combatant);

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  useGame.setState({ battle: null, party: [], pendingFall: null, pendingShanty: null } as never);
});

const screen = () => (host.textContent ?? '').replace(/\s+/g, ' ');
const subtitle = () => (host.querySelector('.rm-subtitle')?.textContent ?? '').replace(/\s+/g, ' ');
const rollLabel = () => (host.querySelector('.rm-roll-label')?.textContent ?? '').replace(/\s+/g, ' ');
const diffZone = () => [...host.querySelectorAll('.rm-roll-diff')].map((e) => (e.textContent ?? '').replace(/\s+/g, ' ').trim());

describe('Chute volontaire — la Compétence et le « +20 » sont à la LIGNE', () => {
  it('le sous-titre ne garde que la hauteur ; la ligne porte Athlétisme et sa Difficulté', () => {
    const hero = mk('Aldo');
    useGame.setState({
      battle: null, party: [hero],
      pendingFall: { to: { x: 0, y: 1 }, metres: 6, initiateurId: hero.id, participants: [{ id: hero.id, interactive: true, attempt: true, result: null }] },
    } as never);
    act(() => root.render(<FallModal />));
    expect(rollLabel(), 'la Compétence est le label de la ligne').toContain('Athlétisme');
    expect(diffZone(), 'et le « +20 » sa Difficulté').toEqual(['Accessible (+20)']);
    expect(subtitle(), 'le sous-titre garde la SITUATION').toContain('6 m');
    expect(subtitle(), 'sans redire la Compétence').not.toContain('Athlétisme');
    expect(subtitle(), 'ni son modificateur').not.toContain('+20');
    // Le « +20 » ne vit QUE dans la ligne (son texte de Difficulté et son calcul de cible sont la
    // MÊME zone) : hors du bloc de jet, l'écran ne le prononce nulle part.
    const horsLigne = screen().replace(((host.querySelector('.rm-roll-block')?.textContent ?? '').replace(/\s+/g, ' ')), '');
    expect(horsLigne, 'aucune seconde surface pour le modificateur').not.toContain('+20');
  });
});

describe('Chanson de marin — la Compétence est à la LIGNE', () => {
  it('le sous-titre ne garde que le bénéficiaire ; la ligne porte Divertissement (Chant)', () => {
    const singer = mk('Kolja');
    useGame.setState({
      battle: { combatants: [singer], over: false },
      party: [singer],
      pendingShanty: { singerId: singer.id, shantyId: 'tous-a-la-vigie', result: null },
    } as never);
    act(() => root.render(<ShantyModal />));
    expect(rollLabel(), 'la Compétence est le label de la ligne').toContain('Divertissement (Chant)');
    expect(subtitle(), 'le sous-titre garde le BÉNÉFICIAIRE (sans portrait ailleurs)').toContain('équipage');
    expect(subtitle(), 'sans redire la Compétence').not.toContain('Divertissement');
  });
});
