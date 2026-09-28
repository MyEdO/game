/**
 * `chebyshev` : la métrique de distance de la grille, et SA SOURCE UNIQUE (#1440).
 *
 * La garde ne cherche pas un NOM (une copie s'appelle `cheb`, `dist`, ou rien du tout) : elle
 * cherche la FORMULE — `Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))`, ses commutations, et sa
 * variante à écarts PRÉ-CALCULÉS (`Math.max(Math.abs(dx), Math.abs(dy))`, la soustraction ayant eu
 * lieu plus haut) comme celle sur SCALAIRES nommés par l'axe (`x1 - x0`). Trois définitions nommées et trente et une formules inline vivaient à côté du canon ; il n'en reste
 * qu'une, ici, dans le MOTEUR (règle 3 : `src/engine` ne dépend pas de `src/state`, c'est donc au
 * moteur de porter la primitive — `state/path` la réexporte pour ses appelants).
 */
import { describe, it, expect } from 'vitest';
import {
  FORMULE_DE_CHEBYSHEV, constructionsReserveesDuCorpus, scanConstructionsReservees,
} from '../../scripts/guards/lib/canonUnique.mjs';
import { corpusDesGardes } from '../../scripts/guards/lib/commentPoison.mjs';
import { chebyshev } from './grid';

/** La formule, et le SEUL fichier où elle a le droit de s'écrire : le canon lui-même. */
const CHEBYSHEV = { ...FORMULE_DE_CHEBYSHEV, foyer: 'src/engine/grid.ts' };
const fixture = (text: string) => ({ rel: 'fixture.ts', text });

describe('grille — distance de Chebyshev (#1440)', () => {
  it('la diagonale vaut 1, la métrique est le max des deltas', () => {
    expect(chebyshev({ x: 0, y: 0 }, { x: 1, y: 1 })).toBe(1);
    expect(chebyshev({ x: 0, y: 0 }, { x: 3, y: 1 })).toBe(3);
    expect(chebyshev({ x: 2, y: 7 }, { x: 2, y: 7 })).toBe(0);
    expect(chebyshev({ x: 5, y: 0 }, { x: 0, y: 4 })).toBe(5);
  });

  it('est symétrique et jamais négative', () => {
    expect(chebyshev({ x: -3, y: 2 }, { x: 4, y: -6 })).toBe(chebyshev({ x: 4, y: -6 }, { x: -3, y: 2 }));
    expect(chebyshev({ x: -3, y: 2 }, { x: 4, y: -6 })).toBe(8);
  });

  it('la FORMULE ne s’écrit nulle part ailleurs dans `src/` — prod ET tests', () => {
    expect(constructionsReserveesDuCorpus(corpusDesGardes(), [CHEBYSHEV])).toEqual([]);
  });

  it('le scan lit la FORME, pas le nom : commutations et opérandes nus compris', () => {
    const vu = (text: string) => scanConstructionsReservees(fixture(text), [CHEBYSHEV]).length;
    expect(vu('const d = Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));'), 'forme canonique').toBe(1);
    expect(vu('const cheb = (p, q) => Math.max(Math.abs(q.y - p.y), Math.abs(q.x - p.x));'), 'axes commutés, opérandes inversés').toBe(1);
    expect(vu('const d = Math.max(Math.abs(x - pos.x), Math.abs(y - pos.y));'), 'opérandes NUS').toBe(1);
    expect(vu('const d = Math.max(\n  Math.abs(a.x - b.x),\n  Math.abs(a.y - b.y),\n);'), 'étalée sur trois lignes').toBe(1);
    expect(vu('const d = Math.max(Math.abs(delta.x), Math.abs(delta.y));'), 'delta PRÉ-CALCULÉ, en composantes').toBe(1);
    expect(vu('if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;'), 'écarts PRÉ-CALCULÉS `dx`/`dy` (anneau)').toBe(1);
    expect(vu('const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));'), 'SCALAIRES nommés par l’axe').toBe(1);
    expect(vu('const d = Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));'), 'autre paire d’axes : pas la métrique de la grille').toBe(0);
    expect(vu('const d = Math.max(Math.abs(yaw - x0), Math.abs(y1 - y0));'), 'un seul opérande nommé par l’axe : pas une soustraction d’axe').toBe(0);
    expect(vu('const m = Math.max(Math.abs(gauche), Math.abs(droite));'), 'deux écarts SANS axe : pas une distance de grille').toBe(0);
    expect(vu('const d = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);'), 'Manhattan : autre métrique').toBe(0);
  });

  it('le scan couvre bien `src/` (sanity : > 1500 fichiers)', () => {
    expect(corpusDesGardes().length).toBeGreaterThan(1500);
  });
});
