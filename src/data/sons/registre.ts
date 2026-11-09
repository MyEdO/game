/** Les sons du registre (`defs/`), par id. */
import { SOUND_DEFS } from './_registry.generated';
import type { SoundDef } from './types';

const sonParId = new Map<string, SoundDef>(SOUND_DEFS.map((d) => [d.id, d]));

/** Le son d'id `id`, absent hors du registre. */
export const findSonById = (id: string): SoundDef | undefined => sonParId.get(id);
