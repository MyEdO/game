import { nommerChamps } from '../grammaire/meta';
/** MDG 12 ; MSRC 12 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { gameOpSchema } from '../grammaire/mecanique';

export const file = 'naval-traits.json';
export const famille = 'entite';

const installBandSchema = nommerChamps(z.strictObject({
  maxLengthM: z.number().nullable(),
  value: z.number(),
  maison: z.string().optional(),
}), {
  maxLengthM: { label: 'Longueur maximale (m)' },
  value: { label: 'Valeur' },
  maison: { label: 'Arbitrage maison' },
});

const installBaremeSchema = z.union([
  nommerChamps(z.strictObject({ bands: z.array(installBandSchema), per: z.enum(['5m', '10m', 'unite']).optional() }), { bands: { label: 'Bandes' }, per: { label: 'Unité de calcul' } }),
  z.literal('modele'),
]);

const navalInstallSchema = nommerChamps(z.strictObject({
  installation: installBaremeSchema,
  weightEnc: installBaremeSchema.optional(),
}), { installation: { label: 'Installation' }, weightEnc: { label: 'Poids (Enc)' } });

const doc = document(
  'naval-traits',
  famille,
  {
    kind: z.enum(['trait', 'amelioration']),
    install: navalInstallSchema.optional(),
    ranked: z.boolean().optional(),
    passive: z.array(gameOpSchema).optional(),
    /** MDG 12 l.221 */
    ram: nommerChamps(z.strictObject({ ic: z.number(), ap: z.number() }), { ic: { label: 'Indice de Critique' }, ap: { label: 'Points d’Armure' } }).optional(),
    /** Couvert de pont GRADUÉ (`DeckCoverClass`) : `totale` (Sabord/Murs blindés) ou `moyenne` (Plat-bord). */
    deckCover: z.enum(['imparfaite', 'moyenne', 'totale']).optional(),
    /** MSRC 12 l.66 */
    navTestMod: z.number().optional(),
  },
  {
    kind: { label: 'Nature', hint: 'Trait naval ou Amélioration installable' },
    install: { label: 'Coût d’installation', hint: 'Coût (or) et poids, par bande de longueur de coque ou au modèle' },
    ranked: { label: 'À paliers', hint: 'Amélioration cumulable par palier (plutôt qu’achat unique)' },
    passive: {
      label: 'Effets passifs',
      hint: 'Effets mécaniques permanents tant que le Trait/l’Amélioration équipe le navire',
    },
    ram: { label: 'Bélier', hint: 'Bonus de collision (IC + PA), sous-système collision hors vocabulaire combattant' },
    deckCover: { label: 'Couvert de pont', hint: 'Couvert gradué offert à l’équipage (imparfaite/moyenne/totale)' },
    navTestMod: {
      label: 'Modificateur de manœuvre',
      hint: 'Points au Test de Navigation pour DIRIGER le navire (ex. Bouteur +20, Gréement de course −10)',
    },
  },
  {
    codex: { keys: ['navalTraits'] },
    edit: { dataset: 'navalTraits' },
  },
  { exiges: ['desc'] },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
