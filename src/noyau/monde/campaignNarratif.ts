import type { NarratifBlock } from '../../data/schemas/defs-scenes/narratif';
import { REGISTRES_NARRATIFS } from '../../data/schemas/defs-scenes/registres-narratifs';

/** Narratif vide — posé par `newProject` : une liste vide par registre (`REGISTRES_NARRATIFS`). */
export function emptyNarratif(): NarratifBlock {
  return Object.fromEntries(REGISTRES_NARRATIFS.map((r) => [r.cle, []])) as unknown as NarratifBlock;
}
