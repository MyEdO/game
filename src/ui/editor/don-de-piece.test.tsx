// @vitest-environment jsdom
/**
 * Effet `giveTrapping` d'une pièce de créature à l'éditeur (#1988 B4a-i) : la bascule vers l'entrée
 * `exigeUneCreature` SÈME `creatureId` (`creatureRecoltableSemee`) et montre le sélecteur de créature,
 * filtré par la feuille (`RECOLTABLE`) ; la bascule retour l'efface ; `count` se saisit au champ nombre.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { act, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { EffectFields, effectSummary, type Ctx } from './EffectList';
import { CIBLES_D_EFFET_DE_SCENE } from '../../state/combatEffects';
import { creatureRecoltableSemee, creatures } from '../../data';
import { PIECES_DE_CREATURE_TRAPPING_ID } from '../../engine/harvest';
import type { Effect } from '../../state/scene';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const CTX: Ctx = { encounters: [], dialogues: [], cibles: CIBLES_D_EFFET_DE_SCENE, objets: [], sansSource: true };
const PIECE = { type: 'giveTrapping', trappingId: PIECES_DE_CREATURE_TRAPPING_ID, creatureId: 'griffon' } as Effect;
const RECOLTABLES = creatures.filter((c) => c.harvest).map((c) => c.label).sort((a, b) => a.localeCompare(b));

/** Monte l'Effet, joue `geste(host)` ; rend les émissions et ce que `lire(host)` observe. */
function monte<T>(effet: Effect, geste: (host: HTMLElement) => void, lire: (host: HTMLElement) => T = () => undefined as T) {
  const emis: Effect[] = [];
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    act(() => { root.render(<EffectFields effect={effet} ctx={CTX} onChange={(e) => { emis.push(e); }} /> as ReactElement); });
    const lu = lire(host);
    act(() => geste(host));
    return { emis, lu };
  } finally {
    act(() => { root.unmount(); });
    host.remove();
  }
}

const saisir = (champ: HTMLInputElement, texte: string) => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(champ, texte);
  champ.dispatchEvent(new Event('input', { bubbles: true }));
};
const choisirLObjet = (host: HTMLElement, id: string) => {
  const s = host.querySelector<HTMLSelectElement>('select[aria-label="Objet donné"]')!;
  s.value = id;
  s.dispatchEvent(new Event('change', { bubbles: true }));
};
const selecteurDeCreature = (host: HTMLElement) =>
  [...host.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.value === 'griffon'));

describe('Effet `giveTrapping` — don de pièce de créature', () => {
  it('bascule aller : choisir l’entrée marquée SÈME la créature récoltable', () => {
    const { emis } = monte({ type: 'giveTrapping', trappingId: 'dague' } as Effect, (host) => choisirLObjet(host, PIECES_DE_CREATURE_TRAPPING_ID));
    expect(emis.slice(-1)[0]).toMatchObject({ trappingId: PIECES_DE_CREATURE_TRAPPING_ID, creatureId: creatureRecoltableSemee() });
  });

  it('le sélecteur de créature ne propose que les créatures récoltables, et son choix s’écrit', () => {
    const autre = creatures.find((c) => c.harvest && c.id !== 'griffon')!;
    const { emis, lu } = monte(PIECE, (host) => {
      const s = selecteurDeCreature(host)!;
      s.value = autre.id;
      s.dispatchEvent(new Event('change', { bubbles: true }));
    }, (host) => [...selecteurDeCreature(host)!.options].filter((o) => o.value !== '').map((o) => o.textContent ?? ''));
    expect([...lu].sort((a, b) => a.localeCompare(b))).toEqual(RECOLTABLES);
    expect(emis.slice(-1)[0]).toMatchObject({ trappingId: PIECES_DE_CREATURE_TRAPPING_ID, creatureId: autre.id });
  });

  it('bascule retour : un objet sans marqueur EFFACE la créature, et le sélecteur disparaît', () => {
    const { emis } = monte(PIECE, (host) => choisirLObjet(host, 'dague'));
    expect(emis.slice(-1)[0]).toMatchObject({ trappingId: 'dague', creatureId: undefined });
    const { lu } = monte({ type: 'giveTrapping', trappingId: 'dague' } as Effect, () => {}, selecteurDeCreature);
    expect(lu).toBeUndefined();
  });

  it('le champ nombre écrit `count`, que le résumé affiche', () => {
    const { emis } = monte(PIECE, (host) => {
      const champ = host.querySelector<HTMLInputElement>('input[type="number"][aria-label="Nombre d’objets donnés"]')!;
      saisir(champ, '3');
    });
    expect(emis.slice(-1)[0]).toMatchObject({ count: 3 });
    expect(effectSummary({ ...PIECE, count: 3 } as Effect, CTX)).toBe('Objet : 3× Pièces de créature brutes (Griffon)');
  });
});
