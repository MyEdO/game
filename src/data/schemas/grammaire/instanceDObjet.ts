/**
 * `ItemInstance` (`src/engine/types.ts`) aux FRONTIÈRES hors compilateur (#1988) : le roster relu et
 * importé (`src/state/roster.ts`), les postes d'un document de projet (`authoredShipPosteSchema`,
 * `defs-scenes/scene.ts`). Le schéma juge la DÉSIGNATION (`DesignationDObjet`) et l'absence du champ mort
 * `label`, et refuse NOMMÉMENT ; les autres champs de l'instance traversent (`TROUS_DE_VALIDATION`).
 */
import { z } from 'zod';
import type { ItemInstance } from '../../../engine/types';
import { effectSourceSchema } from './mecanique';

/** Le refus d'une valeur qui n'est pas une instance DÉSIGNÉE, ou `null`. */
function refusDInstance(v: unknown): string | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return 'instance d’objet : pas un objet.';
  const it = v as Record<string, unknown>;
  const site = `instance « ${typeof it.uid === 'string' ? it.uid : '?'} »`;
  if (typeof it.uid !== 'string') return `${site} : sans \`uid\`.`;
  if ('label' in it) return `${site} : porte \`label\`, champ mort (#1988) — son libellé se dérive de sa désignation ; monter le document.`;
  if (it.conjured === true) {
    if (!effectSourceSchema.safeParse(it.source).success) return `${site} : arme invoquée sans \`source\` valide (\`{ kind, id }\`).`;
    if ('trappingId' in it || 'spec' in it || 'creatureId' in it) return `${site} : arme invoquée qui porte aussi une désignation de catalogue.`;
    return null;
  }
  if (typeof it.trappingId !== 'string' || !it.trappingId)
    return `${site} : sans désignation — ni \`trappingId\` (catalogue), ni \`{ conjured: true, source }\` (Effet producteur).`;
  if ('conjured' in it || 'form' in it) return `${site} : instance de catalogue qui porte \`conjured\` ou \`form\`, champs de l'arme invoquée.`;
  return null;
}

export const itemInstanceSchema = z.custom<ItemInstance>().superRefine((v, ctx) => {
  const refus = refusDInstance(v);
  if (refus !== null) ctx.addIssue({ code: 'custom', message: refus });
});
