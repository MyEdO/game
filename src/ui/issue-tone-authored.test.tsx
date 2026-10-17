// @vitest-environment jsdom
/**
 * #1078 LOT B2 — TON de l'issue d'un jet : PLEINE COULEUR par défaut, atténuation AUTHORÉE. La
 * fabrique de conséquences (`resultLines`) ne pose plus de ton `info` d'office ; une ligne atténuée
 * l'est parce qu'un site l'a écrit (note d'arbitrage de `ShantyModal`). Contrat mesuré à l'ÉCRAN
 * (montage réel, patron `createRoot`/`act` du repo) : la classe de ton de `RecapLineRow`.
 */
import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { RollShell } from './RollShell';
import { buildRollRow } from './rollRowBuild';
import { ShantyModal } from './ShantyModal';
import { resultLines, freeCons } from '../state/rollSeam';
import type { Combatant } from '../engine/types';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const chars = { 'capacite-de-combat': 45, 'capacite-de-tir': 50, force: 35, endurance: 35, initiative: 30, agilite: 40, dexterite: 30, intelligence: 40, 'force-mentale': 40, sociabilite: 30 };
const mk = (id: string): Combatant =>
  ({ id, name: id, label: id, kind: 'hero', characteristics: { ...chars }, conditions: [], traumas: [], engagedWith: [], skills: [], talents: [], items: [],
     weapons: [], advantage: 0, size: 'moyenne', pos: { x: 0, y: 0 }, wounds: { current: 18, max: 18 }, resilience: 2, fortune: 2,
     species: 'humains-reiklander', bodyShape: 'humanoide', movement: 4,
     armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 } } as unknown as Combatant);

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  useGame.setState({ battle: null, pendingShanty: null, party: [] } as never);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  useGame.setState({ battle: null, pendingShanty: null } as never);
});

/** Classes de la ligne d'issue rendue dans le cadre `.rm-journal`. */
const issueClasses = () => [...host.querySelectorAll('.rm-journal .recap-line')].map((e) => {
  expect(e.classList.contains('row')).toBe(true);
  expect(e.getAttribute('data-align')).toBe('start');
  expect(e.getAttribute('data-gap')).toBe('xs');
  expect(e.getAttribute('data-wrap')).toBe('no');
  return [...e.classList].filter(c => c !== 'row').join(' ');
});

const rolledRow = () => buildRollRow({
  row: { d: { label: 'Athlétisme', base: 45, modifier: 0, target: 45, roll: 22, success: true, sl: 2 } },
  onRoll: () => {},
});

describe('issue d’un jet — pleine couleur par DÉFAUT', () => {
  it('une conséquence libre SANS ton n’en reçoit aucun : la ligne n’est pas atténuée', () => {
    const lines = resultLines(freeCons(['Le total repart de zéro !']));
    expect(lines[0].tone, 'la fabrique ne pose aucun ton par défaut').toBeUndefined();
    act(() => root.render(<RollShell title="T" rows={[rolledRow()]} rolled outcome={lines} actions={[]} />));
    expect(issueClasses()).toEqual(['recap-line']);
    expect(host.querySelector('.rm-journal .recap-line')?.textContent).toBe('Le total repart de zéro !');
  });

  it('un ton AUTHORÉ est respecté : `ok` colore, `info` atténue', () => {
    const lines = resultLines(freeCons([
      { text: 'La chanson porte', tone: 'ok' as const },
      { text: '— une précision de second plan', tone: 'info' as const },
    ]));
    act(() => root.render(<RollShell title="T" rows={[rolledRow()]} rolled outcome={lines} actions={[]} />));
    expect(issueClasses()).toEqual(['recap-line ok', 'recap-line info']);
    expect([...host.querySelectorAll('.rm-journal .recap-line')].map(e => e.textContent)).toEqual(['La chanson porte', '— une précision de second plan']);
  });
});

describe('Chanson de marin — la note d’arbitrage porte son ton AU SITE', () => {
  it('l’effet obtenu reste `ok`, la note descend en `info`', () => {
    const singer = mk('Chanteur');
    useGame.setState({
      battle: { combatants: [singer] },
      party: [singer],
      // chanson PORTEUSE d'une note d'arbitrage (`note`, src/data/sea-shanties.json)
      pendingShanty: { singerId: singer.id, shantyId: 'tous-a-la-vigie', result: { roll: 12, target: 45, sl: 3, success: true } },
    } as never);
    act(() => root.render(<ShantyModal />));
    expect(issueClasses(), 'l’effet obtenu coloré, la note atténuée — les deux ÉCRITS').toEqual(['recap-line ok', 'recap-line info']);
  });
});
