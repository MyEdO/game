/**
 * Mesure partagée des tests de valeurs neuves de l'atelier (#3059) : une valeur neuve parse son schéma,
 * hors des champs laissés à la saisie de l'auteur (sentinelle vide `''` ou champ absent).
 */
import type { z } from 'zod';

/** Valeur au chemin d'un refus de zod. */
const auChemin = (v: unknown, chemin: readonly PropertyKey[]): unknown =>
  chemin.reduce<unknown>((n, k) => (n && typeof n === 'object' ? (n as Record<PropertyKey, unknown>)[k] : undefined), v);

/** Champ laissé à la saisie de l'auteur : sentinelle vide ou absent. */
const aSaisir = (v: unknown): boolean => v === '' || v === undefined;

/** Refus d'une valeur neuve hors des champs laissés à la saisie de l'auteur. */
export function refusHorsSentinelle(schema: z.ZodType<unknown>, valeur: unknown): string[] {
  const r = schema.safeParse(valeur);
  if (r.success) return [];
  return r.error.issues.filter((i) => !aSaisir(auChemin(valeur, i.path))).map((i) => `${i.path.join('.')} : ${i.message}`);
}
