import type { z } from 'zod';
import { formatDice, totalDuDe, type DiceSpec } from '../../../engine/dice';
import { facesDuDe } from '../../../engine/tables';
import { deDuParse, ecartsDeCouverture } from './valeurs';

type Rangee = { id?: string; min: number | null; max: number | null };
export type TableTiree = { id: string; die: DiceSpec; entries: readonly Rangee[] };

function ecartsDeBorneHaute(
  rangees: readonly Rangee[],
  borneHaute: number | 'ouverte',
  nom: (r: Rangee) => string,
): string[] {
  const plancher = (r: Rangee) => r.min ?? Number.NEGATIVE_INFINITY;
  const triees = [...rangees].sort((a, b) => plancher(a) - plancher(b));
  const derniere = triees.pop();
  if (!derniere) return ['aucune fourchette'];

  const ecarts = triees.flatMap((r) => {
    if (r.max === null) return [`${nom(r)} n'a pas de borne haute`];
    if (r.max >= plancher(derniere)) {
      return [`${nom(r)} finit à ${r.max} et chevauche ${nom(derniere)}`];
    }
    return [];
  });
  return ecarts.concat(ecartsDeCouverture([derniere], derniere.min ?? 'ouverte', borneHaute, nom));
}

export function couvertureDeclareeDuDe<T extends TableTiree>(
  fichier: string,
  borneHaute: (table: T) => 'ouverte' | 'fermee',
  portee: 'de' | 'borne-haute' = 'de',
): (entree: z.ZodObject<z.ZodRawShape>) => z.ZodType<unknown> {
  return (entree) => entree.superRefine((valeur, ctx) => {
    const table = valeur as T;
    const de = deDuParse(table);
    if (!de) return;
    const jusqua = borneHaute(table) === 'ouverte' ? 'ouverte' : facesDuDe(de);
    const nom = (r: Rangee) => r.id === undefined ? `la rangée n° ${table.entries.indexOf(r) + 1}` : `la rangée « ${r.id} »`;
    const ecarts = portee === 'de'
      ? ecartsDeCouverture(table.entries, totalDuDe(de, de.n), jusqua, nom)
      : ecartsDeBorneHaute(table.entries, jusqua, nom);
    if (ecarts.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['entries'],
        message: `${fichier} › ${table.id} : les rangées ne couvrent pas le ${formatDice(de)} d'un seul tenant — ${ecarts.join(' ; ')}.`,
      });
    }
  });
}
