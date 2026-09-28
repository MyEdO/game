import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { TokenChromeMarks } from './TokenChromeMarks';
import { CHROME_SLOTS, CHROME_ICON_MAX, tokenChrome } from './builders/tokenChrome';
import { createHero } from '../engine/character';
import type { IconId } from '../ui/icons';
import type { Combatant } from '../engine/types';

/**
 * ALVÉOLES DU CHROME D'UN JETON — « rien ne bouge jamais » (état de l'art des interfaces de combat,
 * arbitrage user 2026-08-16 sur la taille des éléments). Le rang d'icônes d'États se RECENTRAIT à
 * chaque ajout : une seule condition qui tombe déplaçait TOUTES les icônes déjà lues, sous le regard
 * du joueur. Les places sont désormais RÉSERVÉES (même compte que le rack du portrait) et fixes.
 */
const ICONS = ['flag/frenzy', 'flag/defensive', 'action/aim', 'flag/focus'] as unknown as IconId[];

/** Abscisses des icônes RENDUES, dans l'ordre du markup. */
function xs(icons: readonly IconId[], iconsMore = 0): number[] {
  const html = renderToStaticMarkup(createElement(TokenChromeMarks, { icons, iconsMore, badgeY: -30 }));
  // Les icônes sont les `<g>` d'`IconG` : seuls eux portent une ÉCHELLE derrière leur translation.
  return [...html.matchAll(/translate\((-?[\d.]+),[^)]*\) scale\(/g)].map((m) => Number(m[1]));
}

describe('Chrome de jeton — les alvéoles d’États sont RÉSERVÉES, jamais recentrées', () => {
  it('la place d’une icône ne dépend PAS du nombre d’icônes portées', () => {
    const un = xs(ICONS.slice(0, 1));
    const deux = xs(ICONS.slice(0, 2));
    const quatre = xs(ICONS.slice(0, 4));
    expect(un.length).toBe(1);
    expect(deux.length).toBe(2);
    expect(quatre.length).toBe(4);
    // La place 0 est la MÊME dans les trois cas : un État qui arrive n'en pousse aucun autre.
    expect(deux[0]).toBe(un[0]);
    expect(quatre[0]).toBe(un[0]);
    expect(quatre[1]).toBe(deux[1]);
    // … et les places sont régulièrement espacées (un pas d'alvéole, jamais un tassement).
    const pas = quatre[1] - quatre[0];
    expect(quatre.map((x, i) => x - i * pas).every((x) => x === quatre[0])).toBe(true);
  });

  it('le rang tient dans SA réserve : le report « +N » occupe la dernière place', () => {
    const c: Combatant = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Gunnar', seed: 3 });
    c.conditions = [
      { id: 'aveugle', value: 1 }, { id: 'assomme', value: 1 }, { id: 'saignement', value: 1 },
      { id: 'terrifie', value: 1 }, { id: 'empoisonne', value: 1 },
    ] as Combatant['conditions'];
    const chrome = tokenChrome(c, { ghostIds: new Set(), hoveredId: null });
    expect(chrome.iconsMore, 'la sonde ne mesure rien sans débordement').toBeGreaterThan(0);
    // Icônes montrées + report = exactement la réserve : le rang ne déborde jamais de ses places.
    expect(chrome.icons.length + 1).toBe(CHROME_SLOTS);
    expect(CHROME_ICON_MAX).toBe(CHROME_SLOTS);
  });
});
