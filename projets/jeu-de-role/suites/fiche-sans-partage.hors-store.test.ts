import { it, expect } from 'vitest';
import { campagnes } from '../campagnes';
import { paquetDuJeu } from '../../../src/noyau/campagneLivree';
import { partagesDesFiches } from '../../../src/scenes/fichesSansPartage.testkit';

// #2097 — les campagnes du jeu (`src/scenes/fiche-sans-partage.hors-store.test.ts` en tient le commun).
const lots = campagnes.map((c) => {
  const p = paquetDuJeu(c);
  return { nom: `campagne ${c.id}`, scenes: p.scenes, narratif: p.narratif ?? null };
});

it('aucun combattant né d’une scène livrée n’atteint la scène mémorisée ni le catalogue (#2097)', () => {
  const { fiches, fautes } = partagesDesFiches(lots);
  expect(fiches).toBeGreaterThan(0);
  expect(fautes).toEqual([]);
});
