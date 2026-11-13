import { nommerChamps } from '../grammaire/meta';
/** LDB 18 ; LDB 65 */
import { z } from 'zod';
import { bornesSchema, ecartDeCoPresenceDesBornes, enumNomme, idDIconeSchema, ruleValueSchema } from '../grammaire/valeurs';
import { document } from '../grammaire/document';

export const file = 'reglesOptionnelles.json';
export const famille = 'entite';

/**
 * Règle optionnelle (V9 #1318) : ses VALEURS (`default`, `action.when`) sont du type que son `kind` promet, celui que
 * rend `rule(id)` (`ValeurDeRegle`, `engine/policy.ts`). `ruleValueSchema` est l'union booléen|nombre|chaîne : seul ce
 * jugement refuse `"false"` sur un `flag`. Porté par le schéma au chargement (`affinerEntree`) et par l'atelier du
 * Codex avant l'enregistrement (`validateEntry`, `atelierDuCodex.ts`), en plus du contrôle typé du formulaire
 * (`RuleValueField`).
 */
export function ecartsDeLaRegle(entry: Readonly<Record<string, unknown>>): string[] {
  const out: string[] = [];
  const kind = entry.kind;
  const options = Array.isArray(entry.options) ? (entry.options as unknown[]).filter((o) => typeof o === 'string') as string[] : [];
  const check = (champ: string, v: unknown): void => {
    if (v === undefined) return;
    if (kind === 'flag' && typeof v !== 'boolean') out.push(`${champ} : un interrupteur (kind « flag ») vaut un booléen, pas ${typeof v === 'string' ? `la chaîne « ${v} »` : String(v)}`);
    if (kind === 'param' && typeof v !== 'number') out.push(`${champ} : un nombre (kind « param ») vaut un nombre, pas ${typeof v === 'string' ? `la chaîne « ${v} »` : String(v)}`);
    if (kind === 'mode') {
      if (typeof v !== 'string') out.push(`${champ} : un choix (kind « mode ») vaut une des valeurs proposées`);
      else if (options.length > 0 && !options.includes(v)) out.push(`${champ} : « ${v} » n'est pas une des valeurs proposées (${options.join(', ')})`);
    }
  };
  check('default', entry.default);
  const action = entry.action as { when?: unknown } | undefined;
  if (action && typeof action === 'object') check('action.when', action.when);
  if (kind === 'mode' && options.length < 2) out.push('options : un choix (kind « mode ») propose au moins deux valeurs');
  if (kind === 'param' && (typeof entry.min !== 'number' || typeof entry.max !== 'number')) out.push('min/max : un nombre (kind « param ») déclare ses bornes');
  if (kind === 'param' && typeof entry.default === 'number' && typeof entry.min === 'number' && typeof entry.max === 'number'
      && (entry.default < entry.min || entry.default > entry.max)) {
    out.push(`default : ${entry.default} sort des bornes [${entry.min}, ${entry.max}]`);
  }
  return out;
}

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
        icon: idDIconeSchema,
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
        for (const message of ecartsDeLaRegle(v)) ctx.addIssue({ code: 'custom', message: `reglesOptionnelles.json « ${String(v.id)} » : ${message}` });
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
