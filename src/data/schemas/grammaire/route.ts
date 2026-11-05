import { nommerChamps } from './meta';
/**
 * BILLETS et PROVENANCES d'une route de la carte du monde (`worldMap.routes[]`, `defs-scenes/worldmap.ts`) :
 * les nœuds que les concepts du lexique des structures portent (`interne/poses.ts`, #3012). EDO 01 l.142 ; #2533.
 */
import { z } from 'zod';
import { maisonSchema, palierSchema, sourceRefSchema } from './valeurs';
import { refuserSansProvenance } from './document';
import { marquerCollection, marqueDeRecord } from './collection-cle';

/** Prix d'un passage par classe du véhicule (`vehicles.json` `travel.classes[].id`), en sous par passager. */
const prixParClasseSchema = marquerCollection(z.record(z.string(), z.number().int().min(0)), marqueDeRecord());

/** `PalierDeBillet` (`engine/travel.ts`) — prix d'un billet marchandé, palier (`palierSchema`) de DR net gagné. */
export const palierDeBilletSchema = nommerChamps(z.strictObject({
  ...palierSchema.shape,
  prix: prixParClasseSchema,
}).refine((p) => p.seuil >= 0, { path: ['seuil'], message: 'le DR net minimal d’un palier de billet est ≥ 0' }), { seuil: { label: "DR net minimal" }, prix: { label: "prix par classe" , texte: { regime: "technique"} } });

/** Marchandage d'un billet : le vendeur (preset PNJ) et ses paliers. */
export const marchandageDeBilletSchema = nommerChamps(z.strictObject({
  presetId: z.string(),
  paliers: z.array(palierDeBilletSchema).optional(),
}), { presetId: { label: "vendeur (preset PNJ)" , texte: { regime: "technique"} }, paliers: { label: "paliers" } });

/** `RouteBillet` (`noyau/worldMap.ts`) — billet d'auteur d'un passage payant (`EDO 01 l.142`). La
 *  contiguïté de `suite` se valide à la carte (`worldMapSchema`), les classes et `depuis` à la route. */
export const routeBilletSchema = nommerChamps(z.strictObject({
  prix: prixParClasseSchema,
  suite: z.array(z.string()).optional(),
  depuis: z.string().optional(),
  marchandage: marchandageDeBilletSchema.optional(),
  source: sourceRefSchema.optional(),
  maison: maisonSchema.optional(),
})
  .superRefine((billet, ctx) => refuserSansProvenance(billet, ctx, 'du billet')), { prix: { label: "prix par classe" , texte: { regime: "technique"} }, suite: { label: "routes suivantes couvertes" , texte: { regime: "technique"} }, depuis: { label: "lieu de départ" , texte: { regime: "technique"} }, marchandage: { label: "marchandage" }, source: { label: "source" }, maison: { label: "maison" , texte: { regime: "technique"} } });

/** Provenance d'une VALEUR d'auteur de route : `source` ou `maison`, jamais ni l'un ni l'autre. */
export const provenanceDeValeurSchema = nommerChamps(z.strictObject({
  source: sourceRefSchema.optional(),
  maison: maisonSchema.optional(),
})
  .superRefine((p, ctx) => refuserSansProvenance(p, ctx, 'de la valeur')), { source: { label: "source" }, maison: { label: "maison" , texte: { regime: "technique"} } });

/** Provenance de chaque valeur d'auteur d'une route (`refuserSansProvenance`). */
export const provenancesDeRouteSchema = nommerChamps(z.strictObject({
  perilDie: provenanceDeValeurSchema.optional(),
  speed: provenanceDeValeurSchema.optional(),
  km: provenanceDeValeurSchema.optional(),
}), { perilDie: { label: "dé de péril" }, speed: { label: "vitesse" }, km: { label: "kilomètres" } });
