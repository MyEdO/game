// ── Bloc NARRATIF d'un paquet de campagne (#765) ────────────────────────────────────────────────
// Frontière RÉFÉRENCE vs NARRATIF (doctrine `game-campagne-json-portable-frontiere-reference-narratif`) :
// le narratif est EMBARQUÉ dans le JSON du projet (auto-suffisant, révélé seulement en jeu) et RÉFÉRENCE
// la règle globale (`src/data`) PAR ID — jamais copiée, jamais réinjectée dans `src/data` global. Cet
// invariant est GARDÉ par le schéma du document (`narratifSchema`, `src/data/schemas/defs-scenes/`),
// qui refuse toute collision d'id narratif ↔ id global.

import type { z } from 'zod';
import type {
  affaireSchema,
  clotureSchema,
  documentNarratifSchema,
  indiceSchema,
  indiceStadeSchema,
  narratifSchema,
  ouvertureSchema,
  presetPnjSchema,
} from '../data/schemas/defs-scenes/narratif';
import { REGISTRES_NARRATIFS } from '../data/schemas/defs-scenes/registres-narratifs';

/** Types du bloc narratif : dérivés de leurs schémas (`defs-scenes/narratif.ts`), qui sont la définition. */
export type IndiceStade = z.infer<typeof indiceStadeSchema>;
export type DocumentNarratif = z.infer<typeof documentNarratifSchema>;
export type Indice = z.infer<typeof indiceSchema>;
export type Affaire = z.infer<typeof affaireSchema>;
export type PresetPnj = z.infer<typeof presetPnjSchema>;
export type OuvertureBlock = z.infer<typeof ouvertureSchema>;
/** AMBIANCE d'un cadre de campagne (#717) — strate de matière lue par les tokens `--amb-*`
 *  (`styles/base.css`), portée en `data-ambiance` par la coquille d'écran. */
export type AmbianceCadre = NonNullable<OuvertureBlock['ambiance']>;
export type ClotureBlock = z.infer<typeof clotureSchema>;
export type NarratifBlock = z.infer<typeof narratifSchema>;

/** Narratif vide — posé par `newProject` : une liste vide par registre (`REGISTRES_NARRATIFS`). */
export function emptyNarratif(): NarratifBlock {
  return Object.fromEntries(REGISTRES_NARRATIFS.map((r) => [r.cle, []])) as unknown as NarratifBlock;
}
