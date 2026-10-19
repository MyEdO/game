// @vitest-environment jsdom
/**
 * Phrase d'ARRIVÉE du récapitulatif de voyage (#2533) : « Voyage de … Le groupe arrive le <date>. » se
 * lit sur UNE ligne. La date (`GameDate`) vit au milieu de la phrase : aucun de ses nœuds ne doit être
 * rendu en BLOC (un conteneur `inline-flex` blocifie ses enfants — sauts de ligne au texte lu).
 * Les règles de style sont celles de `styles/components.css`, chargées telles quelles.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, afterEach } from 'vitest';
import { TravelRecapModal } from './TravelRecapModal';
import { useGame } from '../state/store';
import { toDate, MINUTES_PER_DAY } from '../engine/clock';
import { gameDateText } from './GameDate';
import type { TravelRecap } from '../state/travelFlow';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
/** Premier instant, à partir de l'horloge courante, dont le jour de semaine répond à `voyelle`. */
function jourOu(voyelle: boolean): number {
  const t0 = useGame.getState().gameTime;
  for (let i = 0; i < 60; i++) {
    const w = toDate(t0 + i * MINUTES_PER_DAY).weekday;
    if (w && /^[aeiouy]/i.test(w) === voyelle) return t0 + i * MINUTES_PER_DAY;
  }
  throw new Error('aucun jour de semaine trouvé');
}

afterEach(() => { act(() => root?.unmount()); root = null; document.head.innerHTML = ''; document.body.innerHTML = ''; });

/** Les règles `.game-date…` et `.icon` de la feuille de style RÉELLE. */
function reglesDeLaDate(): string {
  const css = readFileSync(join(__dirname, 'styles', 'components.css'), 'utf8');
  return (css.match(/^(\.game-date[^{]*|\.icon)\s*\{[^}]*\}/gm) ?? []).join('\n');
}

const arrivee: TravelRecap = {
  fromLabel: 'Weiler', toLabel: 'Federholz', mode: 'pied', status: 'arrived', km: 24, kmDone: 24, days: [], dureeMin: 160,
};

describe('TravelRecapModal — phrase d’arrivée sur une ligne', () => {
  it('la phrase entière se lit d’un tenant, date comprise, sans nœud rendu en bloc', () => {
    const style = document.createElement('style');
    style.textContent = reglesDeLaDate();
    document.head.appendChild(style);
    const el = document.createElement('div');
    document.body.appendChild(el);
    root = createRoot(el);
    const time = jourOu(false);
    useGame.setState({ gameTime: time });
    act(() => root!.render(<TravelRecapModal seam={arrivee} />));

    const pied = document.querySelector('.travel-recap-foot')!;
    const date = gameDateText(time);
    expect(pied.textContent?.replace(/\s+/g, ' ').trim()).toBe(`Voyage de 2 h 40 min. Le groupe arrive le ${date}.`);
    const blocs = [...pied.querySelectorAll('*')]
      .map((n) => getComputedStyle(n).display)
      .filter((display) => !display.startsWith('inline'));
    expect(blocs, 'aucun nœud de la phrase en bloc ou en flex').toEqual([]);
    expect(getComputedStyle(pied.querySelector('.game-date')!).display).toBe('inline');
  });

  it('un jour de semaine à VOYELLE élide l’article : « arrive l’Aubentag »', () => {
    const time = jourOu(true);
    useGame.setState({ gameTime: time });
    const el = document.createElement('div');
    document.body.appendChild(el);
    root = createRoot(el);
    act(() => root!.render(<TravelRecapModal seam={arrivee} />));

    const texte = document.querySelector('.travel-recap-foot')!.textContent?.replace(/s+/g, ' ').trim();
    expect(texte).toBe(`Voyage de 2 h 40 min. Le groupe arrive l’${gameDateText(time)}.`);
  });
});
