/**
 * LA MUSIQUE DE LA PARTIE (#3825), que tout hôte du noyau joue telle quelle : la piste que la scène impose (éditeur :
 * piste précise, ou silence), sinon celles du contexte (exploration, intérieur, combat), et ses pistes telles qu'un
 * hôte les joue (`SonDEffet`), dont il joue une à son tour et qu'il boucle.
 */
import { musicDefsFor, type MusicSelection } from '../data/sons/musique';
import { sonDEffet, type SonDEffet } from '../data/sons/registre';
import type { Jeu } from './etat';
import { isIndoor, type Scene } from './monde/scene';

/**
 * `vue.musique` (`MusiqueDeLaPartie | null`, `src/noyau/musiqueDeLaPartie.ts`) est la musique que la partie joue. La
 * scène la choisit (`scene.music.combat` en combat, `scene.music.ambient` hors combat : l'id d'une musique du registre,
 * ou `null` pour le silence), sinon le moment : le combat, un intérieur (`ambiance.isIndoor`) ou l'exploration ; `null`
 * au silence.
 * @contrat Musique
 */
export interface MusiqueDeLaPartie {
  /** la sélection par sa clé (`def:<id>` ou `ctx:<contexte>`), qui ne change qu'avec elle. */
  cle: string;
  /** ses pistes, chacune un son (`SonDEffet`, section « Effets »). */
  pistes: SonDEffet[];
}

/** Ce que la musique lit de l'état du jeu. */
export interface EtatDeLaMusique {
  mode: Jeu['mode'];
  battle: unknown;
  scene: Pick<Scene, 'ambiance' | 'music'> | null | undefined;
}

/** La sélection de la musique de l'état `etat` : ce que sa scène impose, piste ou silence (`null`), sinon le contexte,
 *  le combat, l'intérieur, ou l'exploration. */
export function selectionDeLaMusique(etat: EtatDeLaMusique): MusicSelection {
  const enCombat = etat.mode === 'battle' && !!etat.battle;
  const voulue = enCombat ? etat.scene?.music?.combat : etat.scene?.music?.ambient;
  if (voulue === null) return null;
  if (typeof voulue === 'string') return { def: voulue };
  if (enCombat) return { ctx: 'combat' };
  return { ctx: etat.scene && isIndoor(etat.scene) ? 'interieur' : 'exploration' };
}

/** La musique de la sélection `selection`, nulle pour le silence ou sans piste. */
export function musiqueDeLaSelection(selection: MusicSelection): MusiqueDeLaPartie | null {
  if (!selection) return null;
  const pistes = ('def' in selection ? [sonDEffet(selection.def)] : musicDefsFor(selection.ctx).map((d) => sonDEffet(d.id))).filter((p): p is SonDEffet => p !== null);
  if (!pistes.length) return null;
  return { cle: 'def' in selection ? `def:${selection.def}` : `ctx:${selection.ctx}`, pistes };
}

/** La musique de l'état `etat` (`selectionDeLaMusique`). */
export const musiqueDeLaPartie = (etat: EtatDeLaMusique): MusiqueDeLaPartie | null => musiqueDeLaSelection(selectionDeLaMusique(etat));
