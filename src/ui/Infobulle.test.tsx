// @vitest-environment jsdom
/**
 * Couche d'infobulle (`Infobulle.tsx`) et emprunt du focus (`focus.ts`, `useFocusEmprunte`), sur son
 * consommateur réel (`CodexRef` sous `wrap`) et une fiche qui s'ouvre par sa porte (`openCodex`), comme
 * la surcouche du Codex d'`App`.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { resetDismissLayers } from './useDismissLayer';
import { CodexRef } from './compendium/CodexRef';
import { Modal } from './Modal';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  resetDismissLayers();
  act(() => { useGame.setState({ codexOverlay: null }); });
});
afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
  act(() => { useGame.setState({ codexOverlay: null }); });
});
const monter = (node: React.ReactElement) => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root.render(node); });
};

const echap = () => act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); });
const boites = () => document.querySelectorAll('.infobulle[role="tooltip"]').length;
const porte = () => document.querySelector<HTMLButtonElement>('.infobulle button');
const actif = () => {
  const ae = document.activeElement as HTMLElement | null;
  return ae === document.body ? 'body' : `${ae?.tagName}«${ae?.textContent}»`;
};

/** La fiche : un dialogue monté par l'état du Codex, fermé par Échap. */
function Fiche() {
  const focus = useGame((s) => s.codexOverlay);
  const fermer = useGame((s) => s.closeCodexOverlay);
  return focus ? <Modal label="Fiche" kind="codex" onClose={fermer}><p>{focus.label}</p></Modal> : null;
}

const banc = (
  <>
    <CodexRef category="talents" id="affable" label="Affable" wrap>
      <button type="button">Affable ×2</button>
    </CodexRef>
    <button type="button">Autre</button>
    <Fiche />
  </>
);
const ancre = () => container.querySelector<HTMLButtonElement>('.codex-ref button')!;
const autre = () => [...container.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === 'Autre')!;

describe('X1 — après la fiche ouverte par la porte, le focus revient au contrôle de l’ancrage', () => {
  const entrees: [string, () => void][] = [
    ['depuis l’ancrage', () => act(() => { ancre().focus(); })],
    ['depuis un autre contrôle', () => {
      act(() => { autre().focus(); });
      act(() => { ancre().dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); });
    }],
    ['depuis body', () => act(() => { ancre().dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); })],
  ];
  for (const [nom, entrer] of entrees) {
    it(nom, () => {
      monter(banc);
      entrer();
      expect(boites(), `${nom} : la boîte s’ouvre`).toBe(1);
      act(() => { porte()!.focus(); });
      expect(actif(), `${nom} : le joueur a porté le focus dans la boîte`).toBe('BUTTON«Ouvrir la fiche»');
      act(() => { porte()!.click(); });
      expect(document.querySelector('[role="dialog"]'), `${nom} : la porte ouvre la fiche`).not.toBeNull();
      expect(boites(), `${nom} : aucune boîte sous la fiche`).toBe(0);
      echap();
      expect(document.querySelector('[role="dialog"]'), `${nom} : Échap ferme la fiche`).toBeNull();
      expect(actif(), `${nom} : après la fiche, le focus est au contrôle de l’ancrage`).toBe('BUTTON«Affable ×2»');
      expect(boites(), `${nom} : le focus rendu n’ouvre aucune boîte`).toBe(0);
    });
  }
});

describe('X2 — congédiée par Échap, la boîte ne se rouvre pas sur ce qui occupe encore l’ancrage', () => {
  it('épinglée puis congédiée : un focus redonné sans départ ne la rouvre pas ; une entrée neuve, si', () => {
    monter(banc);
    act(() => { ancre().focus(); });
    act(() => { ancre().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })); });
    expect(actif(), 'épinglée : le focus est sur la porte').toBe('BUTTON«Ouvrir la fiche»');
    echap();
    expect(actif(), 'Échap : le focus revient à l’ancrage').toBe('BUTTON«Affable ×2»');
    expect(boites(), 'Échap : la boîte est fermée').toBe(0);
    act(() => { ancre().dispatchEvent(new FocusEvent('focusin', { bubbles: true })); });
    expect(boites(), 'refocus sans départ : la boîte congédiée reste fermée').toBe(0);
    act(() => { ancre().blur(); });
    act(() => { ancre().focus(); });
    expect(boites(), 'après un départ, le focus du joueur rouvre la boîte').toBe(1);
  });
});

describe('Q2DIAL — une origine sortie du document cède la place à celle de la surface qui la contenait', () => {
  function Dialogues() {
    const [a, setA] = useState(false);
    const [b, setB] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setA(true)}>Déclencheur</button>
        {a && (
          <Modal label="A" kind="a" onClose={() => setA(false)}>
            <button type="button" className="btn" onClick={() => setB(true)}>Ouvrir B</button>
          </Modal>
        )}
        {b && (
          <Modal label="B" kind="b" onClose={() => setB(false)}>
            <button type="button" className="btn" onClick={() => setA(false)}>Fermer A</button>
            <button type="button" className="btn" onClick={() => setB(false)}>Fermer B</button>
          </Modal>
        )}
      </>
    );
  }
  it('A fermé sous B : le focus reste dans B ; B fermé : le focus va au déclencheur de A', () => {
    monter(<Dialogues />);
    const bouton = (t: string) => [...document.querySelectorAll<HTMLButtonElement>('button')].find((x) => x.textContent === t)!;
    act(() => { bouton('Déclencheur').focus(); });
    act(() => { bouton('Déclencheur').click(); });
    act(() => { bouton('Ouvrir B').focus(); });
    act(() => { bouton('Ouvrir B').click(); });
    const dansB = () => document.querySelector('[aria-label="B"]')!.contains(document.activeElement);
    expect(dansB(), 'B ouvert : le focus est dans B').toBe(true);
    act(() => { bouton('Fermer A').focus(); });
    act(() => { bouton('Fermer A').click(); });
    expect(dansB(), 'A fermé sous B : le focus reste dans B').toBe(true);
    act(() => { bouton('Fermer B').click(); });
    expect(actif(), 'B fermé : le focus va au déclencheur de A, jamais à body').toBe('BUTTON«Déclencheur»');
  });
});

describe('DÉLÉGATION — un seul jeu d’écouteurs du document pour la couche, quel que soit le nombre d’ancrages', () => {
  /** Écouteurs nets posés sur le document pendant `geste`. */
  const ecouteursDocument = (geste: () => void): number => {
    let net = 0;
    const pose = vi.spyOn(document, 'addEventListener').mockImplementation(function (this: Document, ...args) {
      net++;
      return EventTarget.prototype.addEventListener.apply(this, args);
    });
    const retire = vi.spyOn(document, 'removeEventListener').mockImplementation(function (this: Document, ...args) {
      net--;
      return EventTarget.prototype.removeEventListener.apply(this, args);
    });
    try { geste(); } finally { pose.mockRestore(); retire.mockRestore(); }
    return net;
  };
  const ancrages = (n: number) => (
    <>{Array.from({ length: n }, (_, i) => (
      <CodexRef key={i} category="talents" id="affable" label="Affable" wrap><button type="button">A{i}</button></CodexRef>
    ))}</>
  );

  it('1, 10 et 50 ancrages montés posent le même nombre d’écouteurs, et le démontage les retire tous', () => {
    const poses = [1, 10, 50].map((n) => {
      const pose = ecouteursDocument(() => monter(ancrages(n)));
      expect(container.querySelectorAll('[data-infobulle]')).toHaveLength(n);
      if (n < 50) {
        const retire = ecouteursDocument(() => { act(() => { root.unmount(); }); container.remove(); });
        expect(pose + retire, `${n} ancrages démontés : aucun écouteur ne reste`).toBe(0);
      }
      return pose;
    });
    expect(poses[0]).toBeGreaterThan(0);
    expect(poses).toEqual([poses[0], poses[0], poses[0]]);
  });
});
