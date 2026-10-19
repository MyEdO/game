/**
 * RÈGLES CHIFFRÉES — la valeur d'une règle scalaire se LIT dans sa fiche (`regles.json`), jamais au site
 * qui l'emploie : ses `rangees` (le palier ou la valeur nue d'une `ModLine`, sa famille et son libellé : la
 * ligne émise est donc celle que le Codex affiche) et ses `tests` (le `FlowTest` d'un Test qu'elle nomme,
 * Difficulté comprise). #1173
 *
 * Le vocabulaire de chaque champ vit dans `ruleRefs.ts` (`RANGEES_DE_REGLE`, `TESTS_DE_REGLE`) ; la donnée
 * doit porter EXACTEMENT ces clés, vérifié pour TOUTES les règles du vocabulaire à la première lecture de
 * l'une d'elles (une clé renommée ou manquante lève là, quelle que soit la règle lue). L'index est construit
 * à la première lecture, pas à l'import (le module est atteint par des cycles d'import du moteur :
 * `grapple`, `ops`), et reconstruit à la lecture qui suit une écriture de `regles` au seam
 * (`memoParVersion`).
 */
import { findRegleById, type RangeeDeRegleData, type RegleData, type TestDeRegleData } from '../data';
import { memoParVersion } from '../data/versionDataset';
import { DIFFICULTY_MODIFIERS, type ModLine } from './types';
import {
  RANGEES_DE_REGLE, TESTS_DE_REGLE,
  type CodexTarget, type RegleChiffree, type RangeeDe, type RegleATest, type TestDe,
} from './ruleRefs';

/** L'index vivant d'un champ à clé des fiches (`rangees`, `tests`), contrôlé contre son vocabulaire. */
function indexDuChamp<R extends string, C extends 'rangees' | 'tests'>(
  vocabulaire: Readonly<Record<R, readonly string[]>>, champ: C, nom: string,
): (id: R) => Map<string, NonNullable<RegleData[C]>[number]> {
  type Entree = NonNullable<RegleData[C]>[number];
  const lire = (id: R): Map<string, Entree> => {
    const fiche = findRegleById(id);
    if (!fiche) throw new Error(`Règle « ${id} » : aucune fiche dans regles.json.`);
    const lues = new Map(((fiche[champ] ?? []) as Entree[]).map((r) => [r.id, r]));
    const attendues: readonly string[] = vocabulaire[id];
    const manquantes = attendues.filter((cle) => !lues.has(cle));
    const inconnues = [...lues.keys()].filter((cle) => !attendues.includes(cle));
    if (manquantes.length || inconnues.length)
      throw new Error(`Règle « ${id} » : ${champ} manquantes [${manquantes.join(', ')}], inconnues [${inconnues.join(', ')}] (${nom}, ruleRefs.ts).`);
    return lues;
  };
  const index = memoParVersion('regles', () => new Map((Object.keys(vocabulaire) as R[]).map((r) => [r, lire(r)])));
  return (id) => index().get(id)!;
}

const rangees = indexDuChamp(RANGEES_DE_REGLE, 'rangees', 'RANGEES_DE_REGLE');
const tests = indexDuChamp(TESTS_DE_REGLE, 'tests', 'TESTS_DE_REGLE');

/** Un Test que nomme une règle, tel que son ouvreur le pose : compétence, Difficulté et libellé de l'entrée. */
export type TestNomme = Readonly<TestDeRegleData['test'] & { label: string }>;

/** Le Test `cle` que nomme la règle `id` : une copie neuve à chaque lecture, jamais l'objet de la fiche. */
export function testDeRegle<R extends RegleATest>(id: R, cle: TestDe<R>): TestNomme {
  const entree = tests(id).get(cle)!;
  return { ...structuredClone(entree.test), label: entree.label };
}

/** La rangée `cle` de la règle `id`. */
export function rangeeDeRegle<R extends RegleChiffree>(id: R, cle: RangeeDe<R>): RangeeDeRegleData {
  return rangees(id).get(cle)!;
}

/** Les rangées de la règle `id`, dans l'ordre de sa fiche. */
export function rangeesDeRegle(id: RegleChiffree): RangeeDeRegleData[] {
  return [...rangees(id).values()];
}

/** Le modificateur d'une rangée : celui de son palier, ou sa valeur nue. */
export const modDeRangee = (r: RangeeDeRegleData): number => (r.palier !== undefined ? DIFFICULTY_MODIFIERS[r.palier] : r.valeur!);

/** Le modificateur de la rangée `cle` de la règle `id`. */
export function modDeRegle<R extends RegleChiffree>(id: R, cle: RangeeDe<R>): number {
  return modDeRangee(rangeeDeRegle(id, cle));
}

const ligne = (id: RegleChiffree, r: RangeeDeRegleData, value: number): ModLine =>
  ({ label: r.label, value, famille: r.famille, ref: refDeRegle(id) });

/**
 * La `ModLine` de la rangée `cle` de la règle `id` : libellé, famille et renvoi de la fiche. `ajuste`
 * transforme le modificateur LU quand une autre règle le module (Salve par tir, Ambidextre, Tireur
 * embusqué) ; il reçoit toujours la valeur de la donnée.
 */
export function ligneDeRegle<R extends RegleChiffree>(id: R, cle: RangeeDe<R>, opts: { ajuste?: (base: number) => number } = {}): ModLine {
  const r = rangeeDeRegle(id, cle);
  const base = modDeRangee(r);
  return ligne(id, r, opts.ajuste ? opts.ajuste(base) : base);
}

/** Le renvoi Codex d'une règle chiffrée, pour une ligne dont la valeur est CALCULÉE hors de ses rangées
 *  (le résidu d'un tir dévié). Une valeur littérale à côté de lui est refusée (`rule-refs.test.ts`). */
export const refDeRegle = (id: RegleChiffree): CodexTarget => ({ category: 'regles', id });

/** La ligne de la rangée de plus haut `seuil` atteint par `n` ; `null` sous le plus bas. */
export function ligneParSeuil(id: RegleChiffree, n: number): ModLine | null {
  const r = rangeesDeRegle(id).filter((x) => x.seuil !== undefined && n >= x.seuil).sort((a, b) => b.seuil! - a.seuil!)[0];
  return r ? ligne(id, r, modDeRangee(r)) : null;
}
