/**
 * Portée de la GRÈVE (bas de `jambes`) — garde structurelle.
 *
 * L'armure REMPLACE la part, sans chair dessous : un art `front` qui s'arrête plus haut que
 * profile/back laisse une bande de fond visible entre grève et soleret (la cheville, empreinte
 * du pied, atteint y≈50 dans tout le rig). Verrouille la CLASSE sur les 4 défs `defs/*.ts` :
 * chaque vue disponible de `set.jambes` doit descendre au moins jusqu'à la cheville, et les
 * vues ne doivent pas diverger entre elles.
 *
 * `MAX_VIEW_SPREAD` est un CRITÈRE D'INSTRUMENT, pas une dette : c'est la TOLÉRANCE géométrique de
 * la mesure (les Y sont lus sur les commandes de path, deux vues d'une même grève ne tombent pas à
 * l'unité près), et aucune def n'en est exemptée — les 4 sont jugées. Il ne se relève pas : un écart
 * qui dépasse 2 est un art à corriger, jamais un cran à ouvrir.
 *
 * VACUITÉ À ÉCARTER AVANT DE MESURER : `viewOrFront` (`parts/types.ts`) replie `art[view] ?? art.front`.
 * Une def à `jambes` front-only rendrait donc le MÊME fragment pour les deux vues, `spread = 0`, et
 * le seuil serait tenu sans que rien de la vue de profil n'ait été jugé. Chaque def doit donc
 * DÉCLARER un profil distinct de son front pour que l'écart mesure quelque chose.
 */
import { describe, it, expect } from 'vitest';
import { ARMOUR_DEFS } from './_registry.generated';
import { viewOrFront, type PartArt } from '../types';

const MIN_FRONT_Y = 48;
const MAX_VIEW_SPREAD = 2;

/** Coordonnées Y des paires (x,y) des commandes `d="…"` (M/L/Q, absolues) — position impaire
 *  du flux de nombres, quel que soit le nombre de paires par commande (M/L=1 paire, Q=2). */
function maxYOfPath(d: string): number {
  const nums = d.match(/-?\d+\.?\d*/g)?.map(Number) ?? [];
  let max = -Infinity;
  for (let i = 1; i < nums.length; i += 2) max = Math.max(max, nums[i]);
  return max;
}

/** Maximum des Y atteints par TOUS les `d="…"`/`d='…'` d'un fragment SVG. */
function maxYOfSvg(svg: string): number {
  let max = -Infinity;
  for (const m of svg.matchAll(/d=("([^"]*)"|'([^']*)')/g)) {
    const d = m[2] ?? m[3] ?? '';
    max = Math.max(max, maxYOfPath(d));
  }
  return max;
}

describe('armure : la grève (jambes) atteint la cheville dans toutes les vues', () => {
  for (const def of ARMOUR_DEFS) {
    const jambes = def.set.jambes as PartArt | undefined;
    if (jambes == null) continue;

    it(`${def.id} : front ≥ y${MIN_FRONT_Y}, écart front/profile ≤ ${MAX_VIEW_SPREAD}`, () => {
      const front = viewOrFront(jambes, 'front');
      const profile = viewOrFront(jambes, 'profile');

      expect(profile, `${def.id}:jambes — le profil est REPLIÉ sur le front par \`viewOrFront\` : l'écart ` +
        `mesuré ci-dessous serait 0 sans qu'aucune vue de profil n'ait été jugée. Déclarer \`profile\` ` +
        `dans l'art de la part, ou le DISTINGUER du front.`).not.toBe(front);
      const maxYFront = maxYOfSvg(front);
      const maxYProfile = maxYOfSvg(profile);
      const spread = Math.abs(maxYFront - maxYProfile);

      expect(maxYFront, `${def.id}:jambes:front — maxY mesuré ${maxYFront}, attendu ≥ ${MIN_FRONT_Y} ` +
        `(la grève s'arrête avant la cheville, bande de fond visible)`).toBeGreaterThanOrEqual(MIN_FRONT_Y);

      expect(spread, `${def.id}:jambes — écart front(${maxYFront})/profile(${maxYProfile}) = ${spread}, ` +
        `attendu ≤ ${MAX_VIEW_SPREAD} (la cheville doit être à la même portée dans toutes les vues)`)
        .toBeLessThanOrEqual(MAX_VIEW_SPREAD);
    });
  }
});

describe('morsure : la garde mordrait sur un art tronqué (contre-preuve)', () => {
  it('un front raccourci à y44 (ancien état mesuré) fait échouer le seuil de cheville', () => {
    const tronque = '<path d="M-4.6 0 Q0 -1.6 4.6 0 L4.4 13 Q0 15 -4.4 13Z"/><path d="M-3.8 44 Q0 47.5 3.8 44Z"/>';
    expect(maxYOfSvg(tronque)).toBeLessThan(MIN_FRONT_Y);
  });
});
