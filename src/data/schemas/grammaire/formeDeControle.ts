import type { z } from 'zod';
import type { ruleValueSchema } from './valeurs';

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
