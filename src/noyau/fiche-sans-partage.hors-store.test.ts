import { it, expect } from 'vitest';
import { testScenarios } from '../scenes/test-scenarios';
import { allBuiltinCampaigns, paquetDuJeu } from '../scenes/campaign';
import { ficheDEntite, sceneNpc } from './monde/sceneNpc';
import { memoByRef } from './monde/sceneMemo';
import { atteignables, objetsDuCatalogue } from '../scenes/partage.testkit';
import type { Scene } from './monde/scene';
import type { NarratifBlock } from '../data/schemas/defs-scenes/narratif';
import { presetDuNarratif } from './monde/resolveursDuNarratif';

// #2097
const geler = memoByRef((s: Scene) => s);
const catalogue = objetsDuCatalogue();

const lots: { nom: string; scenes: Scene[]; narratif: NarratifBlock | null }[] = [
  ...testScenarios.map((s) => {
    const b = s.construire();
    return { nom: `scénario ${s.id}`, scenes: [b.scene, ...(b.extraScenes ?? [])], narratif: b.narratif ?? null };
  }),
  ...allBuiltinCampaigns.map((c) => {
    const p = paquetDuJeu(c);
    return { nom: `campagne ${c.id}`, scenes: p.scenes, narratif: p.narratif ?? null };
  }),
];

it('aucun combattant né d’une scène n’atteint la scène mémorisée ni le catalogue (#2097)', () => {
  const fautes: string[] = [];
  let fiches = 0;
  for (const lot of lots) {
    const presetPnjById = presetDuNarratif(lot.narratif);
    const narratif = new Set(atteignables(lot.narratif, 'narratif').keys());
    for (const original of lot.scenes) {
      const scene = structuredClone(original);
      geler(scene);
      expect(Object.isFrozen(scene), `${lot.nom} / ${scene.id} : gelée par memoByRef`).toBe(true);
      for (const ent of scene.entities.filter((e) => e.kind === 'personnage')) {
        for (const [porte, c] of [['ficheDEntite', ficheDEntite(ent, presetPnjById)], ['sceneNpc', sceneNpc(scene, ent.id, presetPnjById)]] as const) {
          fiches++;
          for (const [o, chemin] of atteignables(c, ent.id)) {
            const ou = Object.isFrozen(o) ? 'scène gelée' : catalogue.has(o) ? 'catalogue' : narratif.has(o) ? 'narratif' : null;
            if (ou) fautes.push(`${lot.nom} / ${scene.id} / ${porte} : ${chemin} → ${ou}`);
          }
        }
      }
    }
  }
  expect(fiches).toBeGreaterThan(0);
  expect(fautes).toEqual([]);
});
