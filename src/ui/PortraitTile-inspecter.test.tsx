// @vitest-environment jsdom
/**
 * #1822 — le GESTE SECONDAIRE d'un portrait (`PortraitTile.onInspect`) : le patron à surfaces de
 * l'alvéole (`CombatConsole:ConsoleCell`) — clic droit, appui long (`useLongPress`), touche Menu ou
 * Maj+F10 —, annoncé dans le nom accessible ; l'appui long avale la salve native qui le suit.
 */
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { PortraitTile } from './PortraitTile';
import { DELAI_APPUI_LONG } from './useLongPress';
import { createHero } from '../engine/character';
import { t } from '../i18n';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let host: HTMLDivElement | null = null;
let root: Root | null = null;
afterEach(() => {
  if (root) act(() => root!.unmount());
  host?.remove();
  host = null;
  root = null;
  vi.useRealTimers();
});

const gunnar = () => createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Gunnar', seed: 3 });

function tuile(props: { onClick?: () => void; onInspect?: () => void; decoratif?: boolean }): HTMLElement {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(<PortraitTile c={gunnar()} ring="#4f8fe0" {...props} />));
  return host.querySelector<HTMLElement>('.ptile')!;
}

const fire = (el: HTMLElement, e: Event) => act(() => { el.dispatchEvent(e); });
const contextmenu = () => new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
const click = () => new MouseEvent('click', { bubbles: true, cancelable: true });

describe('PortraitTile — geste secondaire : inspecter', () => {
  it('clic droit : inspecte, sans jouer le clic primaire ; le menu natif est retenu', () => {
    const onClick = vi.fn();
    const onInspect = vi.fn();
    const el = tuile({ onClick, onInspect });
    const e = contextmenu();
    fire(el, e);
    expect(onInspect).toHaveBeenCalledOnce();
    expect(onClick).not.toHaveBeenCalled();
    expect(e.defaultPrevented).toBe(true);
  });

  it('Maj+F10 et touche Menu sur la tuile focalisée : inspecte ; une autre touche, non', () => {
    const onInspect = vi.fn();
    const el = tuile({ onInspect });
    fire(el, new KeyboardEvent('keydown', { key: 'F10', shiftKey: true, bubbles: true, cancelable: true }));
    fire(el, new KeyboardEvent('keydown', { key: 'ContextMenu', bubbles: true, cancelable: true }));
    fire(el, new KeyboardEvent('keydown', { key: 'F10', bubbles: true, cancelable: true }));
    expect(onInspect).toHaveBeenCalledTimes(2);
  });

  it(`appui long (${DELAI_APPUI_LONG} ms) : inspecte, puis AVALE le clic et le \`contextmenu\` qui suivent`, () => {
    vi.useFakeTimers();
    const onClick = vi.fn();
    const onInspect = vi.fn();
    const el = tuile({ onClick, onInspect });
    fire(el, new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 10, clientY: 10, pointerId: 1, pointerType: 'touch' }));
    act(() => { vi.advanceTimersByTime(DELAI_APPUI_LONG - 1); });
    expect(onInspect).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1); });
    expect(onInspect).toHaveBeenCalledOnce();
    fire(window as unknown as HTMLElement, new PointerEvent('pointerup', { bubbles: true, clientX: 10, clientY: 10, pointerId: 1 }));
    fire(el, contextmenu());
    fire(el, click());
    expect(onInspect, 'le contextmenu dérivé est avalé').toHaveBeenCalledOnce();
    expect(onClick, 'le clic dérivé est avalé').not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1000); });
    fire(el, click());
    expect(onClick, 'la fenêtre close, le clic redevient le geste primaire').toHaveBeenCalledOnce();
  });

  it('SOURIS : le bouton gauche tenu n’inspecte pas, et le clic qui suit reste le geste primaire', () => {
    vi.useFakeTimers();
    const onClick = vi.fn();
    const onInspect = vi.fn();
    const el = tuile({ onClick, onInspect });
    fire(el, new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 10, clientY: 10, pointerId: 1, pointerType: 'mouse' }));
    act(() => { vi.advanceTimersByTime(DELAI_APPUI_LONG * 2); });
    fire(window as unknown as HTMLElement, new PointerEvent('pointerup', { bubbles: true, clientX: 10, clientY: 10, pointerId: 1, pointerType: 'mouse' }));
    fire(el, click());
    expect(onInspect).not.toHaveBeenCalled();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('un appui qui GLISSE au-delà de la tolérance n’inspecte pas', () => {
    vi.useFakeTimers();
    const onInspect = vi.fn();
    const el = tuile({ onInspect });
    fire(el, new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 10, clientY: 10, pointerId: 1, pointerType: 'touch' }));
    fire(window as unknown as HTMLElement, new PointerEvent('pointermove', { bubbles: true, clientX: 40, clientY: 10, pointerId: 1 }));
    act(() => { vi.advanceTimersByTime(DELAI_APPUI_LONG * 2); });
    expect(onInspect).not.toHaveBeenCalled();
  });

  it('le nom accessible ANNONCE le geste ; le `title` reste le nom seul', () => {
    const el = tuile({ onInspect: () => {} });
    expect(el.getAttribute('aria-label')).toBe(`Gunnar — ${t('ptile.geste2eInspecter')}`);
    expect(el.getAttribute('title')).toBe('Gunnar');
  });

  it('sans `onInspect` : aucune annonce, et le clic droit laisse le menu natif', () => {
    const onClick = vi.fn();
    const el = tuile({ onClick });
    expect(el.getAttribute('aria-label')).toBe('Gunnar');
    const e = contextmenu();
    fire(el, e);
    expect(e.defaultPrevented).toBe(false);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('tuile DÉCORATIVE : muette, aucun geste même si `onInspect` est passé', () => {
    const onInspect = vi.fn();
    const el = tuile({ onInspect, decoratif: true });
    expect(el.tagName).toBe('SPAN');
    fire(el, contextmenu());
    expect(onInspect).not.toHaveBeenCalled();
  });
});
