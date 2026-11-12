/** Les sons du registre (`defs/`), par id. */
import { SOUND_DEFS } from './_registry.generated';
import type { CanalDeSon, SoundDef } from './types';

const sonParId = new Map<string, SoundDef>(SOUND_DEFS.map((d) => [d.id, d]));

/** Le son d'id `id`, absent hors du registre. */
export const findSonById = (id: string): SoundDef | undefined => sonParId.get(id);

/** Les sons d'effet du registre, toute musique de fond exclue. */
export const sonsDEffet: readonly SoundDef[] = SOUND_DEFS.filter((d) => !d.music);

/** Le canal sur lequel la def `def` joue : `musique` pour une musique de fond, son `canal` sinon (`effets` par
 *  défaut). */
export const canalDuSon = (def: SoundDef): CanalDeSon => (def.music ? 'musique' : (def.canal ?? 'effets'));

/** Un son du registre tel qu'un hôte le joue : ses variantes, dont il tire une au hasard, son volume propre (0..1) et
 *  son canal. */
export interface SonDEffet {
  id: string;
  fichiers: string[];
  volume: number;
  /** le canal du mixage où il joue (`CANAUX_DE_SON`, `canalDuSon`) : un hôte le joue sur le bus de ce nom, au volume
   *  de ce canal */
  canal: CanalDeSon;
}

/** Le son d'id `id` tel qu'un hôte le joue, nul hors du registre. */
export function sonDEffet(id: string): SonDEffet | null {
  const def = findSonById(id);
  return def ? { id, fichiers: def.files, volume: def.volume ?? 1, canal: canalDuSon(def) } : null;
}
