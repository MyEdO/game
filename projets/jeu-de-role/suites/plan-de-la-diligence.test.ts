/** Le plan de La Diligence, paquet ÉDITEUR (`campagnes/diligence/diligence-projet.json`) : la Scène y est déjà compilée,
 *  `findMaps` (`scripts/map/registry.ts`) la relit par `parseProject` sans rien rebâtir ; les contrats de chaque famille
 *  de défaut vivent sur fixtures (`scripts/map/check.test.ts`, `src/noyau/planDefects.test.ts`). */
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { auditFacade, auditUnsupportedFloor, auditZoneCoverage, floorPairs, groundTerrains } from '../../../src/noyau/planDefects';
import { findMaps } from '../../../scripts/map/registry';
import type { Scene, WallSeg } from '../../../src/noyau/monde/scene';

const diligenceScene = (): Scene =>
  findMaps(fileURLToPath(new URL('../campagnes/diligence/diligence-projet.json', import.meta.url)))[0].build();

describe('le plan de La Diligence', () => {

  /** PLAFONDS relevés sur le plan de La Diligence au 2026-07-27, jamais des égalités : l'auteur est en
   *  train de rattacher ses cases à des pièces, ces comptes ne doivent que DESCENDRE. Une valeur gravée
   *  passerait au rouge à la première correction ; le contrat de COMPORTEMENT de chaque famille vit sur
   *  fixtures synthétiques (`src/noyau/planDefects.test.ts`), jamais sur cette carte. */
  const PLAFONDS_DILIGENCE: Record<string, number> = {
    'facade-decalee': 0,
    'mur-manquant': 0,
    'etage-sur-exterior': 4,
    'case-sans-zone': 60,
    'etage-sans-appui': 4,
  };

  it('La Diligence — aucun défaut de plan ne REMONTE (paquet éditeur `diligence-projet.json`)', () => {
    const scene = diligenceScene();
    const [[aboveZ, belowZ]] = floorPairs(scene);
    const defects = [...auditFacade(scene, aboveZ, belowZ), ...auditZoneCoverage(scene, aboveZ, belowZ), ...auditUnsupportedFloor(scene, aboveZ, belowZ, groundTerrains())];
    for (const [family, plafond] of Object.entries(PLAFONDS_DILIGENCE)) {
      expect(defects.filter((d) => d.family === family).length, `famille « ${family} »`).toBeLessThanOrEqual(plafond);
    }
  });

  it('CONTRE-PREUVE sur La Diligence (scène réelle) : retirer le mur z1 en (26,12)N fait apparaître EXACTEMENT un défaut de plus — le silence structurel du défaut 2 est corrigé', () => {
    const scene = diligenceScene();
    const [[aboveZ, belowZ]] = floorPairs(scene);
    const targetWall = (w: WallSeg) => (w.z ?? 0) === aboveZ && w.side === 'N' && w.x === 26 && w.y === 12;
    expect((scene.walls ?? []).some(targetWall)).toBe(true); // le mur existe bien sur le plan actuel

    const before = auditFacade(scene, aboveZ, belowZ);
    const mutated: Scene = { ...scene, walls: (scene.walls ?? []).filter((w) => !targetWall(w)) }; // EN MÉMOIRE — aucun fichier touché
    const after = auditFacade(mutated, aboveZ, belowZ);
    expect(after.length).toBe(before.length + 1);
  });
});
