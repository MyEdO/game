import { nommerChamps } from '../grammaire/meta';
/** LDB 18 ; LDB 65 */
import { z } from 'zod';
import { bornesSchema, ecartDeCoPresenceDesBornes, enumNomme, idDIconeSchema, ruleValueSchema } from '../grammaire/valeurs';
import { document } from '../grammaire/document';
import { estObjet } from '../../../lib/objet.mjs';

export const file = 'reglesOptionnelles.json';
export const famille = 'entite';

/** La forme du contrôle qu'un réglage (règle optionnelle, préférence de `noyau/preferences.ts`) fait auto-rendre au
 *  panneau, celle que juge `ecartDeValeur`. */
export type FormeDeControle =
  /** un interrupteur. */
  | { readonly kind: 'flag' }
  /** un choix parmi `options`. */
  | { readonly kind: 'mode'; readonly options: readonly string[] }
  /** un nombre entre `min` et `max`, au pas `step` (1 sans lui). */
  | { readonly kind: 'param'; readonly min: number; readonly max: number; readonly step?: number };

/** Pourquoi `v` n'est pas une valeur de la forme `forme`, `undefined` si elle l'est : `flag` booléen, `param` nombre
 *  fini dans ses bornes, `mode` l'une de ses `options`. SEUL juge de conformité d'une valeur de réglage. */
export function ecartDeValeur(forme: FormeDeControle, v: unknown): string | undefined {
  const vu = typeof v === 'string' ? `la chaîne « ${v} »` : String(v);
  switch (forme.kind) {
    case 'flag':
      return typeof v === 'boolean' ? undefined : `un interrupteur (kind « flag ») vaut un booléen, pas ${vu}`;
    case 'param':
      if (typeof v !== 'number' || !Number.isFinite(v)) return `un nombre (kind « param ») vaut un nombre, pas ${vu}`;
      return v < forme.min || v > forme.max ? `${v} sort des bornes [${forme.min}, ${forme.max}]` : undefined;
    case 'mode':
      if (typeof v !== 'string') return 'un choix (kind « mode ») vaut une des valeurs proposées';
      return forme.options.includes(v) ? undefined : `« ${v} » n'est pas une des valeurs proposées (${forme.options.join(', ')})`;
  }
}

/** `v` est-elle une valeur de la forme `forme` (`ecartDeValeur`) ? */
export const valeurConforme = (forme: FormeDeControle, v: unknown): v is z.output<typeof ruleValueSchema> => ecartDeValeur(forme, v) === undefined;

/** La forme que déclare l'entrée brute `entry`, ce qui lui manque pour en déclarer une (un `mode` propose au moins
 *  deux valeurs, un `param` déclare ses bornes), ou `undefined` sans `kind` connu. */
function formeDeLEntree(entry: Readonly<Record<string, unknown>>): FormeDeControle | string | undefined {
  switch (entry.kind) {
    case 'flag':
      return { kind: 'flag' };
    case 'mode': {
      const options = Array.isArray(entry.options) ? (entry.options as unknown[]).filter((o): o is string => typeof o === 'string') : [];
      return options.length < 2 ? 'options : un choix (kind « mode ») propose au moins deux valeurs' : { kind: 'mode', options };
    }
    case 'param': {
      const { min, max } = entry;
      return typeof min === 'number' && typeof max === 'number' ? { kind: 'param', min, max } : 'min/max : un nombre (kind « param ») déclare ses bornes';
    }
  }
}

/**
 * Règle optionnelle (V9 #1318) : ses VALEURS (`default`, `action.when`) sont de sa forme (`ecartDeValeur`), celle que
 * rend `rule(id)` (`ValeurDeRegle`, `engine/policy.ts`) ; un `mode` propose au moins deux valeurs, un `param` déclare
 * ses bornes. Porté par le schéma au chargement (`affinerEntree`) et par l'atelier du Codex avant l'enregistrement
 * (`validateEntry`, `atelierDuCodex.ts`), en plus du contrôle typé du formulaire (`RuleValueField`).
 */
export function ecartsDeLaRegle(entry: Readonly<Record<string, unknown>>): string[] {
  const forme = formeDeLEntree(entry);
  if (forme === undefined) return [];
  if (typeof forme === 'string') return [forme];
  const action = entry.action as { when?: unknown } | undefined;
  return ([['default', entry.default], ['action.when', action?.when]] as const).flatMap(([champ, v]) => {
    const ecart = v === undefined ? undefined : ecartDeValeur(forme, v);
    return ecart ? [`${champ} : ${ecart}`] : [];
  });
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
      entree.refine((v): v is FormeDeControle => typeof formeDeLEntree(v) === 'object', {
        error: (iss) => `reglesOptionnelles.json « ${estObjet(iss.input) ? String(iss.input.id) : ''} » : ${estObjet(iss.input) ? String(formeDeLEntree(iss.input)) : ''}`,
      }).superRefine((v, ctx) => {
        // La forme manquante est déjà refusée par le `refine` : seules les VALEURS d'une forme déclarée se jugent ici.
        const ecarts = typeof formeDeLEntree(v) === 'object' ? ecartsDeLaRegle(v) : [];
        for (const message of ecarts) ctx.addIssue({ code: 'custom', message: `reglesOptionnelles.json « ${String(v.id)} » : ${message}` });
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
