import { describe, expect, it } from 'vitest';
import { clearedSpace, isSheltered, massCovers, massFootprintCells, shelterField } from './roofs';
import { effectiveArchitecture } from '../../state/sceneEdit';
import { emptyScene, type BuildingMass, type Scene } from '../../state/scene';
import { diligenceCampaign, paquetDuJeu } from '../../scenes/campaign';

/**
 * SOUS COUVERT (#1176 P2-6) — « cette case est-elle sous un toit ? » n'a qu'UNE réponse dans le
 * dépôt. Le DÉGAGEMENT d'architecture (`clearedSpace`, qui décide ce qui s'efface au-dessus du
 * groupe) et la MÉTÉO volumique (`shelterField`, qui décide où la pluie tombe) lisent le MÊME
 * prédicat `massCovers`. Ce fichier mesure leur ACCORD sur une scène réelle : deux vérités, ce serait
 * une pluie qui tombe dans la taverne pendant que le stage en lève le toit.
 */

const masse = (patch: Partial<BuildingMass> = {}): BuildingMass => ({
  id: 'nef', z: 0, footprint: [{ x: 2, y: 2, w: 4, h: 2 }], levels: 1,
  profile: 'gable', ridge: 'x', pitchDeg: 45, material: 'tuile', ...patch,
});

const sceneAvec = (masses: BuildingMass[], w = 12): Scene => {
  const scene = emptyScene(w, w);
  scene.architecture = [{ id: 'corps', label: 'Corps', style: 'maison', storeys: [], facades: [], masses }];
  return scene;
};

/** Le couvert par BALAYAGE : la définition brute, masse par masse, telle que `clearedSpace` la lit. */
function couvertBalaye(scene: Scene): Map<string, number> {
  const out = new Map<string, number>();
  for (const body of effectiveArchitecture(scene))
    for (const mass of body.masses) {
      const cells = massFootprintCells(mass.footprint);
      for (let y = 0; y < scene.dimensions.h; y++)
        for (let x = 0; x < scene.dimensions.w; x++)
          if (massCovers(mass, cells, x, y, mass.z))
            out.set(`${x},${y}`, Math.max(out.get(`${x},${y}`) ?? -Infinity, mass.z));
    }
  return out;
}

describe('Couvert bâti — UNE vérité pour le dégagement et pour la météo (#1176 P2-6)', () => {
  it.each([
    ['scène-témoin (toit simple)', sceneAvec([masse()])],
    ['deux masses à étages différents', sceneAvec([masse(), masse({ id: 'tour', z: 1, levels: 2, footprint: [{ x: 8, y: 8, w: 2, h: 2 }] })])],
    ['La Diligence (2 niveaux)', paquetDuJeu(diligenceCampaign).scenes[0]],
  ])('%s : `shelterField` couvre EXACTEMENT les colonnes que `massCovers` couvre', (_cas, scene) => {
    const balaye = couvertBalaye(scene);
    const champ = shelterField(scene);
    expect([...champ.keys()].sort()).toEqual([...balaye.keys()].sort());
    for (const [key, topZ] of balaye) expect(champ.get(key)!.topZ).toBe(topZ);
  });

  it('un allié que le DÉGAGEMENT tient pour abrité est sous couvert pour la MÉTÉO — jamais l’inverse', () => {
    const scene = sceneAvec([masse()]);
    for (let y = 0; y < scene.dimensions.h; y++)
      for (let x = 0; x < scene.dimensions.w; x++) {
        const cleared = clearedSpace(scene, [{ x, y, z: 0 }]);
        const abriteParLeDegagement = cleared.roomlessCells.size > 0 || cleared.zoneIds.size > 0;
        const plafond = shelterField(scene).get(`${x},${y}`)?.ceilingM ?? -Infinity;
        if (abriteParLeDegagement) expect(isSheltered(shelterField(scene), x, y, plafond - 0.01)).toBe(true);
      }
  });

  it('un toit LEVÉ par le cutaway reste un toit : le couvert ignore la vue', () => {
    const scene = sceneAvec([masse()]);
    // L'allié est SOUS la nappe : le dégagement la lève…
    const cleared = clearedSpace(scene, [{ x: 3, y: 2, z: 0 }]);
    expect(cleared.roomlessCells.size).toBeGreaterThan(0);
    // …et le couvert, lui, n'a pas bougé d'un pouce (aucun paramètre de vue n'y entre).
    const champ = shelterField(scene);
    expect(isSheltered(champ, 3, 2, champ.get('3,2')!.ceilingM - 0.01)).toBe(true);
  });

  it('une masse ABATTUE rouvre le ciel — la seule façon dont le couvert disparaît', () => {
    const debout = shelterField(sceneAvec([masse()]));
    const abattue = shelterField(sceneAvec([]));
    expect(debout.has('3,2')).toBe(true);
    expect(abattue.has('3,2')).toBe(false);
  });
});

/**
 * QUELLE MASSE ARRÊTE LA PLUIE (#1247) — sur une colonne coiffée par DEUX masses, `ceilingM` (l'égout
 * le plus haut, celui qui arrête) et `topZ` (le niveau le plus haut) peuvent désigner deux masses
 * DIFFÉRENTES : une masse basse posée sur une butte a son égout au-dessus d'une masse de même niveau
 * posée dans le creux. L'écrêtage de la météo interroge la VUE sur `sectionId` : s'il ne suit pas
 * `ceilingM`, la vue répond pour une nappe qui n'arrête rien, et la pluie s'arrête encore en l'air.
 */
describe('Couvert bâti — `sectionId` suit l’égout qui ARRÊTE, pas le niveau (#1247)', () => {
  /** `basse` est sur une butte (son égout est le plus HAUT), `haute` est déclarée AVANT elle et se
   *  tient dans le creux. Elles partagent la colonne (3,0). */
  function scèneÀButte(): Scene {
    const scene = emptyScene(8, 8);
    const { w } = scene.dimensions;
    // Butte de 4 m sous les colonnes 0-1 seulement : la colonne PARTAGÉE (3,0) reste au niveau 0.
    scene.layers[0].height = Array.from({ length: w * w }, (_, i) => ((i % w) <= 1 ? 4 : 0));
    scene.architecture = [{
      id: 'corps', label: 'Corps', style: 'maison', storeys: [], facades: [],
      masses: [
        masse({ id: 'creux', footprint: [{ x: 3, y: 0, w: 3, h: 2 }] }),
        masse({ id: 'butte', footprint: [{ x: 0, y: 0, w: 4, h: 2 }] }),
      ],
    }];
    return scene;
  }

  it('la colonne partagée : l’égout vient de la masse sur la BUTTE, et `sectionId` avec lui', () => {
    const champ = shelterField(scèneÀButte());
    const partagée = champ.get('3,0')!;
    const seuleButte = champ.get('0,0')!;
    const seulCreux = champ.get('5,0')!;
    expect(seuleButte.ceilingM, 'témoin : la butte relève bien l’égout de sa masse').toBeGreaterThan(seulCreux.ceilingM);
    expect(partagée.ceilingM, 'la pluie s’arrête à l’égout le plus HAUT').toBe(seuleButte.ceilingM);
    expect(partagée.sectionId, 'et c’est CETTE masse que la vue doit trancher').toBe('butte');
    expect(partagée.topZ, 'les deux masses sont au MÊME niveau : `topZ` ne les départage pas').toBe(0);
  });

  it('la cote d’arrêt et la section rendue désignent la MÊME masse, colonne par colonne', () => {
    const scene = scèneÀButte();
    const champ = shelterField(scene);
    const égoutDe = new Map([...effectiveArchitecture(scene)[0].masses].map((m) => [m.id, m]));
    for (const [key, col] of champ) {
      // La masse nommée par `sectionId` couvre bien cette colonne…
      const [x, y] = key.split(',').map(Number);
      const m = égoutDe.get(col.sectionId)!;
      expect(massCovers(m, massFootprintCells(m.footprint), x, y, m.z), `${key} : ${col.sectionId} coiffe la colonne`).toBe(true);
      // …et aucune AUTRE masse de la colonne n'a d'égout plus haut que le sien.
      expect(isSheltered(champ, x, y, col.ceilingM - 0.01)).toBe(true);
      expect(isSheltered(champ, x, y, col.ceilingM + 0.01)).toBe(false);
    }
  });
});
