/**
 * Schéma de `skills.json` — dérivé de l'inventaire COMPLET des clés (script node, n=46/46), de
 * l'interface `SkillData` (`src/data/index.ts`) et de ses consommateurs (`ItemCapabilities`,
 * `SpecsSource`, `engine/skillCombatApps`).
 */
import { z } from 'zod';
import { charKeySchema, enumNomme, specsSchema, specsSourceSchema } from '../grammaire/valeurs';
import { document } from '../grammaire/document';

export const file = 'skills.json';
export const famille = 'entite';

const doc = document(
  'skills',
  famille,
  {
    characteristic: charKeySchema,
    /** ACCÈS à la Compétence (`LDB 09 l.25/l.30`) : `base` = testable sans formation, sur la
     *  Caractéristique nue ; `avancee` = exige au moins une Augmentation, sinon le Test est impossible.
     *  DISCRIMINANT DE LOGIQUE, jamais un libellé : lu par `possesses` (`engine/skillCombatApps.ts`) et
     *  par la fourchette de tuteur de l'Entraînement (`engine/activities.ts`). Mesuré : 25 / 23 sur 48. */
    acces: enumNomme({ base: 'Base', avancee: 'Avancée' }),
    specs: specsSchema.optional(),
    specsSource: specsSourceSchema.optional(),
    specsOpen: z.boolean().optional(),
    movement: z.boolean().optional(),
    hearing: z.boolean().optional(),
    /** Caractéristique ALTERNATIVE sous règle optionnelle (`SkillData.altChar`, lu par `altCharKey`) :
     *  `gatedByRule` = id d'`OptionalRule` (FK validée par `variants-integrity.test.ts`), `from` = carac de
     *  base à laquelle la substitution s'applique (absente = toute carac), `chars` = la carac à utiliser
     *  PAR VALEUR de la règle (clé = valeur rendue par `rule()`, en chaîne — `"true"` pour un interrupteur ;
     *  une LISTE = la meilleure des caracs citées chez le porteur). */
    altChar: z.strictObject({
      gatedByRule: z.string(),
      from: charKeySchema.optional(),
      chars: z.record(z.string(), z.union([charKeySchema, z.array(charKeySchema)])),
    }).optional(),
    combatAdvantage: z.strictObject({ cap: charKeySchema }).optional(),
    combatSubstitute: z.strictObject({
      role: z.enum(['defense', 'attack', 'both']),
      gate: z.literal('fear'),
    }).optional(),
    /** `capability` = clé de `ItemCapabilities` (`src/data/index.ts`) — sac de flags fermé côté TS ;
     *  laissé en `z.string()` ici (référence croisée hors périmètre d'un seul dataset, cf. `tool.json`
     *  n'existe pas comme catalogue séparé — c'est un type TS, pas une donnée). */
    tool: z.strictObject({ capability: z.string(), withoutMod: z.number() }).optional(),
  },
  {
    characteristic: { label: 'Caractéristique' },
    acces: {
      label: 'Accès',
      hint: 'De base (testable sans formation) ou Avancée : sans Augmentation, aucun Test n’est possible',
    },
    specs: { label: 'Spécialisations', hint: 'Liste fermée de spécialisations proposées' },
    specsSource: { label: 'Registre de spécialisations' },
    specsOpen: { label: 'Spécialisation ouverte' },
    movement: {
      label: 'Compétence de déplacement',
      hint: 'Classée « déplacement » : gate les Tests visés par un blocage de Mouvement',
    },
    hearing: {
      label: 'Compétence auditive',
      hint: 'Classée « implique l’audition » : pénalisée par l’État Assourdi',
    },
    altChar: { label: 'Caractéristique alternative', hint: 'Substitution de Caractéristique sous règle optionnelle' },
    combatAdvantage: {
      label: 'Cumul d’Avantage en combat',
      hint: 'Réussir un Test de cette Compétence en combat cumule de l’Avantage, plafonné par le Bonus d’une Caractéristique',
    },
    combatSubstitute: {
      label: 'Substitution sociale en combat',
      hint: 'Compétence sociale substituable à une Compétence de combat contre une cible qui craint le porteur',
    },
    tool: { label: 'Outil requis', hint: 'Capacité d’objet requise, avec pénalité si absente' },
  },
  {
    codex: { keys: ['skills'] },
    edit: { dataset: 'skills' },
  },
  // `specsOpen` : `LDB 09 l.40`, lu par `entreeOuverte` (`grammaire/ref.ts`).
  { exiges: ['desc', 'source'], espace: { marqueurs: ['specsOpen'] } },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
