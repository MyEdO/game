import { nommerChamps } from '../grammaire/meta';
/** LDB 18 ; LDB 65 */
import { z } from 'zod';
import { bornesSchema, ecartDeCoPresenceDesBornes, enumNomme, ruleValueSchema } from '../grammaire/valeurs';
import { document } from '../grammaire/document';

export const file = 'reglesOptionnelles.json';
export const famille = 'entite';

const doc = document(
  'reglesOptionnelles',
  famille,
  {
    ref: z.string().min(1),
    group: z.string().min(1),
    kind: enumNomme({ flag: 'Interrupteur', param: 'Nombre', mode: 'Choix' }),
    default: ruleValueSchema,
    options: z.array(z.string()).min(2).optional(),
    ...bornesSchema.shape,
    hint: z.string().optional(),
    action: nommerChamps(z
      .strictObject({
        when: ruleValueSchema,
        label: z.string().min(1),
        icon: z.string().min(1),
        run: z.string().min(1),
      }), {
      when: { label: 'Condition' },
      label: { label: 'Libellé' },
      icon: { label: 'Icône' },
      run: { label: 'Course' },
    })
      .optional(),
  },
  {
    ref: { label: 'Référence RAW (citation)', hint: 'Localisation la plus précise dont on dispose dans le livre cité' },
    group: { label: 'Groupe d’affichage', hint: 'Regroupement à l’écran des Règles optionnelles' },
    kind: {
      label: 'Forme du contrôle',
      hint: 'Interrupteur / paramètre chiffré / mode à choix',
    },
    default: { label: 'Valeur par défaut' },
    options: { label: 'Libellés des choix', hint: 'Pour une règle de type mode' },
    min: { label: 'Minimum réglable', hint: 'Borne basse de saisie du paramètre chiffré' },
    max: { label: 'Maximum réglable', hint: 'Borne haute de saisie du paramètre chiffré' },
    step: { label: 'Incrément de saisie' },
    hint: { label: 'Aide affichée', hint: 'Aide courte affichée sous le contrôle' },
    action: { label: 'Action liée', hint: 'Proposée sous la rangée quand la condition de déclenchement est remplie' },
  },
  {
    codex: { keys: ['reglesOptionnelles'] },
    edit: { dataset: 'reglesOptionnelles' },
  },
  {
    // Le refine du nœud `bornesSchema` ne traverse pas le spread de sa shape : la co-présence des
    // deux bornes se re-branche ICI, sur la MÊME fonction partagée (`ecartDeCoPresenceDesBornes`,
    // `grammaire/valeurs.ts`) — la règle n'a qu'un porteur.
    affinerEntree: (entree) =>
      entree.superRefine((v, ctx) => {
        const ecart = ecartDeCoPresenceDesBornes(v as { min?: number; max?: number });
        if (!ecart) return;
        ctx.addIssue({
          code: 'custom',
          path: [ecart.borne],
          message: `reglesOptionnelles.json : ${ecart.message}`,
        });
      }),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
