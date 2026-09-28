/**
 * LE BAKE DE LA DILIGENCE — fixture PARTAGÉE (#1692, #1788).
 *
 * Deux lecteurs, un seul montage : le contrat (`versionDataset.bake.test.ts`, qui prouve que ce bake
 * donne bien du TRAVAIL — sans quoi tout ce qui s'y compare mesurerait le vide) et le banc
 * (`versionDataset.bench.ts`, qui le chronomètre). Un montage recopié des deux côtés dériverait, et
 * le banc cesserait de mesurer ce que le contrat garantit.
 *
 * COUCHE : cuire des scènes est un objet de RENDU, pas de donnée — c'est pourquoi cette fixture vit
 * sous `gameIso/`, d'où les builders et `state/` sont importables (`src/data` n'importe ni l'un ni
 * l'autre, cf. le mur `murs/purete-imports`, #1709).
 */
import { readFileSync } from 'node:fs';
import { parseProject } from '../../state/worldMap';
import { buildFloors } from '../builders/floors';
import { buildProps } from '../builders/props';
import type { Scene } from '../../state/scene';

/** Les scènes du projet de campagne de la Diligence, lues au document. */
export const scenesDeLaDiligence = (): Scene[] =>
  parseProject(
    JSON.parse(readFileSync(new URL('../../scenes/diligence/diligence-projet.json', import.meta.url), 'utf8')),
  ).scenes;

/** Le bake complet : sols + décor de chaque scène. Rend le nombre d'éléments ÉMIS. */
export const bakerLesScenes = (scenes: readonly Scene[]): number => {
  let emis = 0;
  for (const s of scenes) {
    emis += buildFloors(s).length;
    emis += buildProps(s).length;
  }
  return emis;
};

/** Éléments de DÉCOR réellement émis par le bake (décor authoré + décor de tuile) : chacun coûte un
 *  nombre BORNÉ de lectures de l'index `props` (recette, volume, matières). C'est la grandeur à
 *  laquelle le surcoût d'une lecture vivante se compare. */
export const emisDeDecor = (scenes: readonly Scene[]): number =>
  scenes.reduce((n, s) => n + buildProps(s).length, 0);
