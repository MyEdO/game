// @vitest-environment jsdom
/**
 * `ChipDeRefus` (#2404) — la primitive ramène SA pastille en vue (`useRamenerEnVue`) : au montage,
 * à chaque changement de contenu, à chaque `cle` neuve ; jamais à un simple rendu de l'hôte qui
 * recrée l'objet `refus` au même texte, jamais quand `fixe` est posé. Son rôle : `alert` pour un refus,
 * `status` pour l'état permanent d'un champ (`fixe`).
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ChipDeRefus, type RefusRendu } from './ChipDeRefus';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

describe('ChipDeRefus — ramenée en vue par la primitive', () => {
  const original = Element.prototype.scrollIntoView;
  let cibles: Element[] = [];
  let container: HTMLDivElement;
  let root: Root;

  function poser(node: React.ReactElement) {
    act(() => { root.render(node); });
  }

  function monter() {
    cibles = [];
    Element.prototype.scrollIntoView = function (this: Element) { cibles.push(this); };
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  }

  afterEach(() => {
    Element.prototype.scrollIntoView = original;
    act(() => { root.unmount(); });
    container.remove();
  });

  const alerte = () => container.querySelector('[role="alert"]')!;

  it('au montage, puis à chaque changement de `message` ou de `detail` ; un rendu au même contenu ne défile pas', () => {
    monter();
    poser(<ChipDeRefus refus={{ message: 'A' }} />);
    expect(cibles, 'montage').toEqual([alerte()]);
    poser(<ChipDeRefus refus={{ message: 'A' }} />);
    expect(cibles, 'objet neuf, même contenu : aucun défilement').toHaveLength(1);
    poser(<ChipDeRefus refus={{ message: 'B' }} />);
    expect(cibles, 'message changé').toHaveLength(2);
    poser(<ChipDeRefus refus={{ message: 'B', detail: 'd' }} />);
    expect(cibles, 'detail changé').toHaveLength(3);
    expect(cibles.every((c) => c === alerte()), 'la cible est l’alerte elle-même').toBe(true);
  });

  it('`cle` remplace le déclencheur : une cle neuve relance au même texte, la même cle ne relance pas', () => {
    monter();
    const premier: RefusRendu = { message: 'Refusé' };
    const second: RefusRendu = { message: 'Refusé' };
    poser(<ChipDeRefus cle={premier} refus={premier} />);
    poser(<ChipDeRefus cle={premier} refus={{ ...premier }} />);
    expect(cibles, 'même cle').toHaveLength(1);
    poser(<ChipDeRefus cle={second} refus={second} />);
    expect(cibles, 'cle neuve, même texte').toHaveLength(2);
  });

  it('`fixe` : ni au montage ni au changement de contenu', () => {
    monter();
    poser(<ChipDeRefus fixe refus={{ message: 'A' }} />);
    poser(<ChipDeRefus fixe refus={{ message: 'B' }} />);
    expect(cibles).toEqual([]);
  });
});

describe('ChipDeRefus — le rôle suit la nature du message', () => {
  it('un refus est une `alert` ; l’état permanent d’un champ (`fixe`) un `status`, que son `id` nomme toujours', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const role = (node: React.ReactElement) => {
      act(() => { root.render(node); });
      const p = container.querySelector('p.chip-phrase')!;
      return { role: p.parentElement!.getAttribute('role'), id: p.parentElement!.id };
    };
    expect(role(<ChipDeRefus id="r" refus={{ message: 'A' }} />)).toEqual({ role: 'alert', id: 'r' });
    expect(role(<ChipDeRefus fixe id="r" refus={{ message: 'A' }} />)).toEqual({ role: 'status', id: 'r' });
    act(() => { root.unmount(); });
    container.remove();
  });
});
