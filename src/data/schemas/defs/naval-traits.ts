/**
 * Schéma de `naval-traits.json` — Traits/Améliorations navals (MDG 12, MSRC 12), catalogue par id
 * STABLE (`NavalTraitRef.id`). Dérivé de l'interface `NavalTraitData` (`src/data/index.ts`, +
 * `NavalInstall`/`InstallBand` co-localisées — bandes par PALIER DE LONGUEUR, #277) et du contenu RÉEL
 * (26 entrées : `id`/`label`/`kind`/`desc`
 * toujours présents ; `source` 25/26 (#221 : Proue-idole de Stromfels = `maison`, pas de folio RAW) ;
 * `install` 20/26 ; `ranked` 4/26 ; `passive` 8/26 ; `ram` 1/26 ; `deckCover` 3/26 ; `navTestMod` 2/26 ; `maison` 1/26).
 * `source`/`alsoIn`/`maison` sont des clés d'ENVELOPPE, posées par la fabrique.
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { gameOpSchema } from '../grammaire/mecanique';
import { maisonSchema } from '../grammaire/valeurs';

export const file = 'naval-traits.json';
export const famille = 'entite';

const installBandSchema = z.strictObject({
  maxLengthM: z.number().nullable(),
  value: z.number(),
  maison: maisonSchema.optional(),
});

const installBaremeSchema = z.union([
  z.strictObject({ bands: z.array(installBandSchema), per: z.enum(['5m', '10m', 'unite']).optional() }),
  z.literal('modele'),
]);

const navalInstallSchema = z.strictObject({
  installation: installBaremeSchema,
  weightEnc: installBaremeSchema.optional(),
});

const doc = document(
  'naval-traits',
  famille,
  {
    kind: z.enum(['trait', 'amelioration']),
    install: navalInstallSchema.optional(),
    ranked: z.boolean().optional(),
    passive: z.array(gameOpSchema).optional(),
    /** Bélier (MDG 12 l.221) : bonus de collision — sous-système navire hors vocabulaire combattant. */
    ram: z.strictObject({ ic: z.number(), ap: z.number() }).optional(),
    /** Couvert de pont GRADUÉ (`DeckCoverClass`) : `totale` (Sabord/Murs blindés) ou `moyenne` (Plat-bord). */
    deckCover: z.enum(['imparfaite', 'moyenne', 'totale']).optional(),
    /** Modificateur (points) au Test de Navigation POUR DIRIGER le bateau (MSRC 12 l.66 Bouteur +20 ;
     *  l.137 Gréement de course −10) — sous-système manœuvre hors vocabulaire combattant (`navalNavTestDR`). */
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
