import { describe, it, expect } from 'vitest';
import { buildFloors } from './floors';
import { allBuiltinCampaigns, paquetDuJeu } from '../../scenes/campaign';
import { testScenarios } from '../../scenes/test-scenarios';
import { tileAt, type Scene } from '../../state/scene';
import { terrainMatiere, terrainSolidHeightM } from '../../state/terrain';
import { matieresDe } from '../../data';

/**
 * IDENTITÉ des matières de relief sur TOUTES les scènes livrées (#1691) — contrat POSITIF et DÉRIVÉ :
 * pour chaque face de relief émise, l'id de matière est EXACTEMENT celui que la DONNÉE pose. Deux
 * sources, jamais un littéral du builder : le flanc d'un BLOC PLEIN prend la matière de SON terrain
 * (`terrains.json › matiere`), toute autre paroi prend celle que la SCÈNE pose pour cette partie
 * (`scene.reliefDefaults[part]`) ; les montants de pilotis prennent `reliefDefaults.pilier`.
 *
 * Le balayage est dérivé du REGISTRE (scénarios générés + campagnes intégrées) — aucun cardinal en
 * dur : ajouter une scène ou une matière rejoue le contrat sans toucher ce fichier. La non-vacuité
 * se mesure par GISEMENT et non sur le total : le registre des scénarios porte au moins une scène, et
 * CHAQUE campagne intégrée porte les siennes — un gisement qui s'ampute se nomme, là où un total
 * comparé à sa propre somme serait vrai de tout registre, y compris amputé.
 */

/** Toutes les scènes LIVRÉES : un scénario du registre porte sa scène, une campagne les siennes. */
const scenesLivrees = (): { nom: string; scene: Scene }[] => [
  ...testScenarios.map((s) => ({ nom: `scenario:${s.id}`, scene: s.construire().scene })),
  ...allBuiltinCampaigns.flatMap((c) => paquetDuJeu(c).scenes.map((scene) => ({ nom: `campagne:${c.id}/${scene.id}`, scene }))),
];

/** `<scène> (x,y,z) <part> <side> : id émis ≠ id posé par la donnée` — une ligne par écart. */
function ecarts(nom: string, scene: Scene): { fautes: string[]; faces: number; idsEmis: Set<string> } {
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
        ? scene.reliefDefaults.pilier
        : solidBlock ? terrainMatiere(terrain) : scene.reliefDefaults[part as 'cliff' | 'ramp' | 'deck'];
      if (f.material.id !== attendu) fautes.push(`${nom} (${x},${y},${z}) ${part} ${f.side} : ${f.material.id} ≠ ${attendu}`);
    }
  }
  return { fautes, faces, idsEmis };
}

describe('matières de relief — l’id émis est celui de la DONNÉE (toutes scènes livrées)', () => {
  const livrees = scenesLivrees();
  const mesures = livrees.map(({ nom, scene }) => ecarts(nom, scene));

  it('chaque gisement de scènes livrées alimente le balayage, et le balayage émet des faces de relief', () => {
    expect(testScenarios.length, 'le registre des scénarios ne porte plus aucune scène').toBeGreaterThan(0);
    for (const c of allBuiltinCampaigns) {
      expect(c.paquet.scenes.length, `campagne « ${c.id} » : aucune scène livrée — elle n’entre plus dans la mesure`).toBeGreaterThan(0);
    }
    expect(mesures.reduce((n, m) => n + m.faces, 0), 'aucune face de relief émise : le contrat porterait sur rien').toBeGreaterThan(0);
  });

  it('chaque face de relief porte l’id que la donnée pose (terrain à bloc plein, sinon la scène)', () => {
    expect(mesures.flatMap((m) => m.fautes)).toEqual([]);
  });

  it('l’inventaire des ids émis est inclus dans le domaine `relief` de materials.json', () => {
    const connus = new Set(matieresDe('relief').map((m) => m.id));
    const emis = new Set(mesures.flatMap((m) => [...m.idsEmis]));
    expect(emis.size).toBeGreaterThan(0);
    expect([...emis].filter((id) => !connus.has(id))).toEqual([]);
  });
});
