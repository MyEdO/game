/**
 * CONTRAT POSITIF de la migration « l'empreinte vient du TYPE » (#mobilier T1) : l'empreinte d'un
 * décor SOLIDE de `props.json` couvre TOUTES ses cases dans TOUTE scène livrée, y compris
 * celles compilées par `MapSpec` — qui posent leurs entités sans passer par l'éditeur et n'ont donc
 * jamais porté d'empreinte d'instance. Personne ne doit naître DANS un décor : ce balayage affirme
 * qu'aucune entité NON-prop (héros, PNJ, ennemi de rencontre expansé par `setEncounters`) ne se tient
 * sur une case couverte par l'empreinte effective d'un prop solide de la MÊME couche.
 *
 * Joué par le commun (`src/noyau/monde/prop-footprint-occupancy.test.ts`) et par chaque projet sur ses scènes.
 * Élargir le corps d'une recette (`PropData.volume`) ou déplacer un prop dans une scène rejoue ce balayage : c'est
 * le filet qui manquait quand `epave-carrosse` est passée de 1 à 4 cases sous deux mutants d'embuscade.
 */

import { propFootTiles } from './footprint';
import { propIsSolid } from './sceneRules';
import { sceneMetresPerTile, type Scene, type SceneEntity } from './scene';

const zDe = (e: SceneEntity): number => e.z ?? 0;

/** `<source>/<scène>/<entité> sur (x,y,z) — <prop>` pour chaque occupant né dans une empreinte. */
export function occupantsDansUnDecor(source: string, scene: Scene): string[] {
  const couverture = new Map<string, string>();
  for (const e of scene.entities ?? []) {
    if (e.kind !== 'prop' || !propIsSolid(e.decor?.id)) continue;
    for (const t of propFootTiles(e.decor?.id, e.pos, e.facing, sceneMetresPerTile(scene))) couverture.set(`${t.x},${t.y},${zDe(e)}`, `${e.decor?.id} (${e.id})`);
  }
  const fautifs: string[] = [];
  for (const e of scene.entities ?? []) {
    if (e.kind === 'prop' || e.kind === 'heroStart') continue; // le décor se superpose ; `heroStart` n'est pas un corps
    const prop = couverture.get(`${e.pos.x},${e.pos.y},${zDe(e)}`);
    if (prop) fautifs.push(`${source}/${scene.id}/${e.id} sur (${e.pos.x},${e.pos.y},${zDe(e)}) — ${prop}`);
  }
  return fautifs;
}
