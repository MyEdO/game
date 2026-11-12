/**
 * LA POSE d'un décor dans sa case : la case et le calage qui portent son ancre en un point (`poseDeLAncre`), et son
 * APPUI quand il est posé sur un autre (`SceneEntity.sur`), ce qu'un décor qui bouge emporte (`emporterLesObjets`).
 *
 * L'APPUI d'un décor POSÉ SUR un autre (`SceneEntity.sur`) : une lettre sur un bureau, un chandelier sur une table, une
 * caisse sur une autre. Le plan du décor posé reste le sien (`pos`, `calage`) ; seul son PIED vient du support, le
 * DESSUS de celui-ci à l'aplomb de son ancre (`dessusSous`, `data/props.types.ts`). La grille n'en sait rien : l'appui ne
 * change ni empreinte, ni blocage, ni ligne de vue.
 *
 * Un appui TIENT quand le support est un décor de la scène, sur la même couche, qu'il porte un dessus sous l'ancre du
 * décor posé et que la chaîne des supports ne revient pas sur lui (`fauteDAppui`). Le validateur de scène dit la faute ;
 * l'éditeur et le jeu retirent l'appui qui ne tient plus dans la mutation même (`normaliserLesAppuis`) : l'objet
 * retombe sur le sol de sa case. PUR.
 */
import { findPropById } from '../../data';
import { calageDuDecalage, dessusSous, empreinteDuProp, offsetAncre, type Calage } from '../../data/props.types';
import { ancreDuDecor } from './footprint';
import { heightAt, sceneMetresPerTile, type Scene, type SceneDuVolume, type SceneEntity } from './scene';

/** Le dessus du décor `support` à l'aplomb du point `p` (cases), en mètres depuis son pied ; `undefined` sans dessus. */
function dessusA(support: SceneEntity, p: { x: number; y: number }, mpt: number): number | undefined {
  const a = ancreDuDecor(support, mpt);
  // LE site de conversion cases → mètres de l'appui (#1507, déclaré par `noyau/monde/echelle-de-scene.test.ts`).
  return dessusSous(findPropById(support.decor?.id), support.facing, (p.x - a.x) * mpt, (p.y - a.y) * mpt);
}

const entite = (scene: SceneDuVolume, id: string): SceneEntity | undefined => scene.entities.find((e) => e.id === id);

/** Ce qui fait tomber un appui : le support n'est pas un décor de la scène, il est sur une autre couche, l'ancre du décor
 *  posé n'est au-dessus d'aucun de ses dessus, ou la chaîne des supports revient sur le décor posé. */
export interface FauteDAppui {
  faute: 'support' | 'couche' | 'dessus' | 'cycle';
  support: string;
}

/** La faute de l'appui de `ent` ; `undefined` s'il n'est posé sur rien ou si son appui tient. */
export function fauteDAppui(scene: SceneDuVolume, ent: SceneEntity): FauteDAppui | undefined {
  if (!ent.sur) return undefined;
  const support = entite(scene, ent.sur);
  const faute = (f: FauteDAppui['faute']): FauteDAppui => ({ faute: f, support: ent.sur! });
  if (support?.kind !== 'prop') return faute('support');
  if ((support.z ?? 0) !== (ent.z ?? 0)) return faute('couche');
  const mpt = sceneMetresPerTile(scene);
  if (dessusA(support, ancreDuDecor(ent, mpt), mpt) === undefined) return faute('dessus');
  if (portePar(scene, support, ent.id)) return faute('cycle');
  return undefined;
}

/** `e` est-il le décor `id`, ou porté par lui de proche en proche ? */
export function portePar(scene: SceneDuVolume, e: SceneEntity, id: string): boolean {
  const vus = new Set<string>();
  for (let porte: SceneEntity | undefined = e; porte && !vus.has(porte.id); porte = porte.sur ? entite(scene, porte.sur) : undefined) {
    if (porte.id === id) return true;
    vus.add(porte.id);
  }
  return false;
}

/** Le PIED d'un décor, en mètres : le dessus de son support à l'aplomb de son ancre quand son appui tient, sinon le sol
 *  de sa case. */
export function piedDuDecor(scene: SceneDuVolume, ent: SceneEntity): number {
  const support = ent.sur && !fauteDAppui(scene, ent) ? entite(scene, ent.sur) : undefined;
  if (!support) return heightAt(scene, ent.pos.x, ent.pos.y, ent.z ?? 0);
  const mpt = sceneMetresPerTile(scene);
  return piedDuDecor(scene, support) + dessusA(support, ancreDuDecor(ent, mpt), mpt)!;
}

/** Le décor de la couche `z` dont le dessus est le plus haut à l'aplomb du point `p` (cases), hors du décor `pose` et de
 *  ce qu'il porte : celui sur lequel `pose` se poserait en `p`. */
export function appuiSous(scene: Scene, p: { x: number; y: number }, z: number, pose: string | undefined): SceneEntity | undefined {
  const mpt = sceneMetresPerTile(scene);
  let meilleur: { e: SceneEntity; haut: number } | undefined;
  for (const e of scene.entities) {
    if (e.kind !== 'prop' || (e.z ?? 0) !== z || (pose !== undefined && portePar(scene, e, pose))) continue;
    const dessus = dessusA(e, p, mpt);
    if (dessus === undefined) continue;
    const haut = piedDuDecor(scene, e) + dessus;
    if (!meilleur || haut > meilleur.haut) meilleur = { e, haut };
  }
  return meilleur?.e;
}

/** La scène où chaque appui qui ne tient plus est retiré (l'objet retombe au sol) ; la même référence si tous tiennent. */
export function normaliserLesAppuis(scene: Scene): Scene {
  const fautifs = new Set(scene.entities.filter((e) => fauteDAppui(scene, e)).map((e) => e.id));
  if (!fautifs.size) return scene;
  return { ...scene, entities: scene.entities.map((e) => (fautifs.has(e.id) ? sansAppui(e) : e)) };
}

function sansAppui(e: SceneEntity): SceneEntity {
  const { sur: _sur, ...reste } = e;
  return reste;
}

/** La case et le calage qui posent l'ancre du décor `ent` au point `a` (cases continues) : la case de l'empreinte dont le
 *  centre est le plus proche du point, bornée à la carte, et le calage borné à son jeu libre (`calageDuDecalage`). */
export function poseDeLAncre(scene: Scene, ent: SceneEntity, a: { x: number; y: number }): { pos: { x: number; y: number }; calage: Calage } {
  const mpt = sceneMetresPerTile(scene);
  const prop = findPropById(ent.decor?.id);
  const milieu = offsetAncre(empreinteDuProp(prop, ent.facing, mpt));
  const borne = (v: number, n: number) => Math.max(0, Math.min(n - 1, Math.round(v)));
  const pos = { x: borne(a.x - milieu.x, scene.dimensions.w), y: borne(a.y - milieu.y, scene.dimensions.h) };
  return { pos, calage: calageDuDecalage(prop, ent.facing, mpt, { x: a.x - pos.x - milieu.x, y: a.y - pos.y - milieu.y }) };
}

/** `apres` où chaque décor que `id` porte dans `avant`, de proche en proche, a suivi son ancre du même déplacement
 *  (`poseDeLAncre`), son appui gardé : une table qu'on pousse emporte sa lettre. */
export function emporterLesObjets(avant: Scene, apres: Scene, id: string): Scene {
  const mpt = sceneMetresPerTile(avant);
  const porteur = entite(avant, id);
  const deplace = entite(apres, id);
  if (porteur?.kind !== 'prop' || !deplace) return apres;
  const de = ancreDuDecor(porteur, mpt);
  const vers = ancreDuDecor(deplace, mpt);
  const dx = vers.x - de.x, dy = vers.y - de.y;
  const portes = new Set(avant.entities.filter((e) => e.id !== id && portePar(avant, e, id)).map((e) => e.id));
  if ((!dx && !dy) || !portes.size) return apres;
  return {
    ...apres,
    entities: apres.entities.map((e) => {
      if (!portes.has(e.id)) return e;
      const a = ancreDuDecor(e, mpt);
      const { pos, calage } = poseDeLAncre(apres, e, { x: a.x + dx, y: a.y + dy });
      const { calage: _ancien, ...reste } = e;
      return { ...reste, pos, ...(calage.x || calage.y ? { calage } : {}) };
    }),
  };
}
