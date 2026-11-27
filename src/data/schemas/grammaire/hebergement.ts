import { nommerChamps } from './meta';
/**
 * OFFRES D'AUBERGE d'un hébergement : celles d'un établissement de la carte (`worldMap.places[].services[].rest.offres`,
 * `defs-scenes/worldmap.ts`), celles d'une scène (`Scene.rest.offres`, `defs-scenes/scene.ts`) et celles d'un type
 * d'hébergement du catalogue (`lieux-services.json`, `defs/lieux-services.ts`), de la même forme. LDB 66 l.12-16 ; LDB 66 l.28 ; ACE 02 l.99. #4277
 */
import { z } from 'zod';
import { enumNomme, moneyPartialSchema, qualiteDeReposSchema, sourceRefSchema } from './valeurs';
import { ref } from './ref';
import { listeCle } from './collection-cle';

/** `RisqueDExposition` — le risque d'exposition à la maladie `maladie`, à `pourcent` %, de qui prend une offre. ACE 02 l.99 */
export const risqueDExpositionSchema = nommerChamps(
  z.strictObject({ maladie: ref('maladie'), pourcent: z.number().int().min(1).max(100) }),
  { maladie: { label: 'maladie' }, pourcent: { label: 'pourcentage' } },
);

/** `OffreDAuberge` — une offre d'auberge : `prix` absolu, jamais multiplié par la qualité ; `risque` d'exposition à une
 *  maladie de qui la prend. LDB 66 l.12-16, l.28 ; ACE 02 l.99 */
export const offreDAubergeSchema = nommerChamps(z.strictObject({
  id: enumNomme({ commune: 'Chambre commune', chambre: 'Chambre', grande: 'Grande chambre', repas: 'Repas' }),
  prix: moneyPartialSchema.optional(),
  risque: risqueDExpositionSchema.optional(),
  source: sourceRefSchema,
}), { id: { label: 'offre' }, prix: { label: 'prix' }, risque: { label: 'risque' }, source: { label: 'source' } });

/** Les offres d'auberge d'un hébergement, une par `id`. */
export const offresDAubergeSchema = listeCle(offreDAubergeSchema, 'id');

/** `ReposDAuberge` — la qualité et les offres d'auberge d'un hébergement : celles d'un établissement de la carte
 *  (`placeServiceSchema.rest`, `defs-scenes/worldmap.ts`) et celles d'une scène (`sceneSchema.rest`,
 *  `defs-scenes/scene.ts`) ; `offres` absent : celles du catalogue. LDB 66 l.5 #5149 */
export const reposDAubergeSchema = nommerChamps(z.strictObject({
  quality: qualiteDeReposSchema.optional(),
  offres: offresDAubergeSchema.optional(),
}), { quality: { label: 'qualité' }, offres: { label: 'offres' } });
