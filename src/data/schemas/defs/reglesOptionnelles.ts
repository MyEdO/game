import { nommerChamps } from '../grammaire/meta';
/** LDB 18 ; LDB 65 */
import { z } from 'zod';
import { bornesSchema, ecartDeCoPresenceDesBornes, enumNomme, idDIconeSchema, ruleValueSchema } from '../grammaire/valeurs';
import { document } from '../grammaire/document';

export const file = 'reglesOptionnelles.json';
export const famille = 'entite';

/** La FORME d'un réglage (règle optionnelle, préférence) que juge `ecartDeValeur` : `flag` = interrupteur, `param` =
 *  nombre borné, `mode` = choix parmi `options`. */
export interface FormeDeValeur {
  readonly kind: 'flag' | 'param' | 'mode';
  readonly min?: number;
  readonly max?: number;
  readonly options?: readonly string[];
}

/** Pourquoi `v` n'est pas une valeur de la forme `forme`, `undefined` si elle l'est : `flag` booléen, `param` nombre
 *  fini dans ses bornes, `mode` l'une de ses `options`. SEUL juge de conformité d'une valeur de réglage. */
export function ecartDeValeur(forme: FormeDeValeur, v: unknown): string | undefined {
  const vu = typeof v === 'string' ? `la chaîne « ${v} »` : String(v);
  switch (forme.kind) {
    case 'flag':
      return typeof v === 'boolean' ? undefined : `un interrupteur (kind « flag ») vaut un booléen, pas ${vu}`;
    case 'param':
      if (typeof v !== 'number' || !Number.isFinite(v)) return `un nombre (kind « param ») vaut un nombre, pas ${vu}`;
      return (forme.min !== undefined && v < forme.min) || (forme.max !== undefined && v > forme.max)
        ? `${v} sort des bornes [${forme.min ?? '−∞'}, ${forme.max ?? '+∞'}]`
        : undefined;
    case 'mode':
      if (typeof v !== 'string') return 'un choix (kind « mode ») vaut une des valeurs proposées';
      return (forme.options ?? []).includes(v) ? undefined : `« ${v} » n'est pas une des valeurs proposées (${(forme.options ?? []).join(', ')})`;
  }
}

/** `v` est-elle une valeur de la forme `forme` (`ecartDeValeur`) ? */
export const valeurConforme = (forme: FormeDeValeur, v: unknown): v is z.output<typeof ruleValueSchema> => ecartDeValeur(forme, v) === undefined;

/**
 * Règle optionnelle (V9 #1318) : ses VALEURS (`default`, `action.when`) sont de sa forme (`ecartDeValeur`), celle que
 * rend `rule(id)` (`ValeurDeRegle`, `engine/policy.ts`) ; un `mode` propose au moins deux valeurs, un `param` déclare
 * ses bornes. Porté par le schéma au chargement (`affinerEntree`) et par l'atelier du Codex avant l'enregistrement
 * (`validateEntry`, `atelierDuCodex.ts`), en plus du contrôle typé du formulaire (`RuleValueField`).
 */
export function ecartsDeLaRegle(entry: Readonly<Record<string, unknown>>): string[] {
  const kind = entry.kind;
  if (kind !== 'flag' && kind !== 'param' && kind !== 'mode') return [];
  const options = Array.isArray(entry.options) ? (entry.options as unknown[]).filter((o): o is string => typeof o === 'string') : [];
  const min = typeof entry.min === 'number' ? entry.min : undefined;
  const max = typeof entry.max === 'number' ? entry.max : undefined;
  const forme: FormeDeValeur = { kind, options, min, max };
  const action = entry.action as { when?: unknown } | undefined;
  const out = ([['default', entry.default], ['action.when', action?.when]] as const).flatMap(([champ, v]) => {
    const ecart = v === undefined ? undefined : ecartDeValeur(forme, v);
    return ecart ? [`${champ} : ${ecart}`] : [];
  });
  if (kind === 'mode' && options.length < 2) out.push('options : un choix (kind « mode ») propose au moins deux valeurs');
  if (kind === 'param' && (min === undefined || max === undefined)) out.push('min/max : un nombre (kind « param ») déclare ses bornes');
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
