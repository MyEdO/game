import { z } from 'zod';
import { dialoguesSchema, triggersSchema, encountersSchema, sceneSchema } from './defs-scenes/scene';
import { nommerChamps, metaDesChamps } from './grammaire/meta';
import { rapportDeFautes, validerFormeVivante } from './validate';

/** Les TROIS blocs de logique que la modale « Avancé » édite en masse. Les LISTES sont celles du
 *  schéma de Scène (`dialoguesSchema`/`triggersSchema`/`encountersSchema`, clé comprise), pas une
 *  redite : ce que l'auteur colle est tenu à la même exigence que ce que le document porte. Le
 *  conteneur est réécrit parce que `sceneSchema.pick()` est refusé par zod sur un objet PORTANT DES
 *  RAFFINEMENTS, et un sous-ensemble de trois clés n'en hérite aucun.
 *  La porte de cette modale est `lireBlocsAvances`, ci-dessous. */
const SCHEMA_BLOCS_AVANCES = nommerChamps(z.strictObject({
  dialogues: dialoguesSchema.optional(),
  triggers: triggersSchema.optional(),
  encounters: encountersSchema.optional(),
}), { dialogues: metaDesChamps(sceneSchema, { exigees: true }).dialogues, triggers: metaDesChamps(sceneSchema, { exigees: true }).triggers, encounters: metaDesChamps(sceneSchema, { exigees: true }).encounters });

/** Porte de la modale « Avancé » (`saveAdvanced`, `ui/editor/Editor.tsx`), hors de l'écran pour être mesurable hors montage : c'est
 *  elle qui rend le refus que l'auteur lit (#1588). Forme VIVANTE (`validerFormeVivante`, #2001) : le
 *  schéma prouve la forme disque, la valeur collée est relue sous sa vue TS, son texte gardé — patron
 *  de `parseProject`. */
export function lireBlocsAvances(brut: unknown): { ok: true; lu: z.infer<typeof SCHEMA_BLOCS_AVANCES> } | { ok: false; rapport: string } {
  const refus = validerFormeVivante(SCHEMA_BLOCS_AVANCES, brut);
  if (refus) return { ok: false, rapport: rapportDeFautes('Blocs de logique', refus.fautes) };
  return { ok: true, lu: brut as z.infer<typeof SCHEMA_BLOCS_AVANCES> };
}
