import { nommerChamps, nommerNoeud } from '../grammaire/meta';
/** MDG 12 ; MSRC 12 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { passifsDe } from '../grammaire/mecanique';
import { refs } from '../grammaire/ref';
import { deckCoverSchema, dureeEnJoursSchema, enumNomme, maisonSchema } from '../grammaire/valeurs';

export const file = 'naval-traits.json';
export const famille = 'entite';

const installBandSchema = nommerChamps(z.strictObject({
  maxLengthM: z.number().nullable(),
  value: dureeEnJoursSchema,
  /** MSRC 12 l.54-135. */
  vehicules: refs('vehicle').optional(),
  maison: maisonSchema.optional(),
}), {
  maxLengthM: { label: 'Longueur maximale (m)' },
  value: { label: 'Valeur' },
  vehicules: { label: 'Types de bateau' },
  maison: { label: 'Arbitrage maison' },
});

const installBaremeSchema = z.union([
  nommerChamps(z.strictObject({
    bands: z.array(installBandSchema).superRefine((bandes, ctx) => {
      const types = new Set<string>();
      bandes.forEach((bande, i) => {
        bande.vehicules?.forEach((id, j) => {
          if (types.has(id)) {
            ctx.addIssue({ code: 'custom', path: [i, 'vehicules', j], message: `Type de bateau « ${id} » répété dans ce barème` });
          }
          types.add(id);
        });
      });
    }),
    per: z.enum(['5m', '10m', 'unite']).optional(),
  }), { bands: { label: 'Bandes' }, per: { label: 'Unité de calcul' } }, { label: 'barème' }),
  nommerNoeud(z.literal('modele'), { label: 'ceux du modèle embarqué' }),
]);

const navalInstallSchema = nommerChamps(z.strictObject({
  milieu: enumNomme({ maritime: 'Maritime', fluvial: 'Fluvial' }).optional(),
  installation: installBaremeSchema,
  weightEnc: installBaremeSchema.optional(),
  /** MDG 12 l.230 ; MDG 12 l.293 */
  jours: installBaremeSchema.optional(),
  /** MDG 12 l.230 */
  chantierSpecialise: z.boolean().optional(),
}).superRefine((pose, ctx) => {
  for (const champ of ['installation', 'weightEnc'] as const) {
    const bareme = pose[champ];
    if (!bareme || bareme === 'modele') continue;
    bareme.bands.forEach(({ value }, i) => {
      if (typeof value !== 'number') ctx.addIssue({
        code: 'custom', path: [champ, 'bands', i, 'value'], message: 'Seule la durée de pose s’exprime en semaines.',
      });
    });
  }
}), { milieu: { label: 'Gabarit de référence' }, installation: { label: 'Installation' }, weightEnc: { label: 'Poids (Enc)' }, jours: { label: 'Durée de pose' }, chantierSpecialise: { label: 'Exige un chantier naval spécialisé' } });

const doc = document(
  'naval-traits',
  famille,
  {
    kind: z.enum(['trait', 'amelioration']),
    install: navalInstallSchema.optional(),
    ranked: z.boolean().optional(),
    passive: passifsDe().optional(),
    /** MDG 12 l.221 */
    ram: nommerChamps(z.strictObject({ ic: z.number(), ap: z.number() }), { ic: { label: 'Indice de Critique' }, ap: { label: 'Points d’Armure' } }).optional(),
    /** Couvert de pont GRADUÉ (`DeckCoverClass`) : `totale` (Sabord/Murs blindés) ou `moyenne` (Plat-bord). */
    deckCover: deckCoverSchema.optional(),
    /** MSRC 12 l.66 */
    navTestMod: z.number().optional(),
  },
  {
    kind: { label: 'Nature', hint: 'Trait naval ou Amélioration installable' },
    install: { label: 'Coût d’installation', hint: 'Coût (or), poids et durée de pose, par type de bateau, par longueur de coque ou au modèle' },
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
