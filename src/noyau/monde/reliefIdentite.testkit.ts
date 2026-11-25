/**
 * IDENTITÉ des matières de relief sur toute scène (#1691) — contrat POSITIF et DÉRIVÉ :
 * pour chaque face de relief émise, l'id de matière est EXACTEMENT celui que la DONNÉE pose. Deux
 * sources, jamais un littéral du builder : le flanc d'un BLOC PLEIN prend la matière de SON terrain
 * (`terrains.json › matiere`), toute autre paroi prend celle que la SCÈNE pose pour cette partie
 * (`scene.reliefDefaults[part]`) ; les montants de pilotis prennent `reliefDefaults.pilier`.
 *
 * Joué par le commun (`relief-identite-matieres.hors-store.test.ts`, scénarios et campagne de test) et par chaque
 * projet sur ses campagnes — aucun cardinal en dur ; la non-vacuité se mesure par GISEMENT.
 */

import { buildFloors } from './volume/floors';
import { tileAt, type Scene } from './scene';
import { terrainMatiere, terrainSolidHeightM } from './terrain';
import { matieresDe } from '../../data';

/** `<scène> (x,y,z) <part> <side> : id émis ≠ id posé par la donnée` — une ligne par écart. */
export function ecarts(nom: string, scene: Scene): { fautes: string[]; faces: number; idsEmis: Set<string> } {
  const fautes: string[] = [];
  const idsEmis = new Set<string>();
  let faces = 0;
  for (const el of buildFloors(scene)) {
    const { x, y, z } = el.cell;
    const terrain = tileAt(scene, x, y, z);
    const solidBlock = terrainSolidHeightM(terrain) > 0;
    for (const f of el.faces) {
      if (f.material.domain !== 'relief') continue;
      faces++;
      idsEmis.add(f.material.id);
      const part = f.material.part;
      const attendu = part === 'pilier'
        ? scene.reliefDefaults.pilier.id
        : solidBlock ? terrainMatiere(terrain) : scene.reliefDefaults[part as 'cliff' | 'ramp' | 'deck'].id;
      if (f.material.id !== attendu) fautes.push(`${nom} (${x},${y},${z}) ${part} ${f.side} : ${f.material.id} ≠ ${attendu}`);
    }
  }
  return { fautes, faces, idsEmis };
}

/** Les ids émis absents du domaine `relief` de `materials.json`. */
export const idsHorsDuDomaine = (idsEmis: Iterable<string>): string[] => {
  const connus = new Set<string>(matieresDe('relief').map((m) => m.id));
  return [...new Set(idsEmis)].filter((id) => !connus.has(id));
};
