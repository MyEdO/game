/**
 * La VERSION COURANTE d'une forme persistée, DÉRIVÉE de sa table de montées (#2226) : un littéral objet
 * keyé par la version de DÉPART de chaque montée, clés numériques contiguës. La version courante est la
 * plus grande clé + 1, en valeur comme en type littéral. Deux branches qui ajoutent la même montée
 * ajoutent la même clé : conflit de fusion, ou TS1117 au typecheck de l'arbre fusionné.
 */

/** Plus grande d'une union de littéraux numériques entiers positifs. */
type PlusGrandeCle<U extends number, A extends unknown[] = [], M extends number = never> = [U] extends [never]
  ? M
  : A['length'] extends U
    ? PlusGrandeCle<Exclude<U, A['length']>, [...A, unknown], A['length']>
    : PlusGrandeCle<U, [...A, unknown], M>;

type Tuple<N extends number, A extends unknown[] = []> = A['length'] extends N ? A : Tuple<N, [...A, unknown]>;

type Suivant<N extends number> = [...Tuple<N>, unknown]['length'] & number;

/** La version courante d'une table de montées `T`, en type littéral ; `number` pour une table typée
 *  `Record<number, …>`, dont les clés ne sont pas connues. */
export type VersionCourante<T extends object> = number extends Extract<keyof T, number>
  ? number
  : Suivant<PlusGrandeCle<Extract<keyof T, number>>>;

export function versionCourante<const T extends object>(table: T): VersionCourante<T> {
  return (Math.max(...Object.keys(table).map(Number)) + 1) as VersionCourante<T>;
}
