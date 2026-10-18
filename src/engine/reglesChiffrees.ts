/**
 * RÈGLES CHIFFRÉES — la valeur d'une règle scalaire se LIT dans sa fiche (`regles.json`, `rangees`),
 * jamais au site qui pousse la `ModLine`. Une rangée porte le palier que le livre nomme (le modificateur
 * en dérive par `DIFFICULTY_MODIFIERS`) ou la valeur nue qu'il donne, sa famille et son libellé : la
 * ligne émise est donc celle que le Codex affiche. #1173
 *
 * Le vocabulaire des rangées vit dans `RANGEES_DE_REGLE` (`ruleRefs.ts`) ; la donnée doit porter
 * EXACTEMENT ces rangées, vérifié pour TOUTES les règles à la première lecture de l'une d'elles (une rangée
 * renommée ou manquante lève là, quelle que soit la règle lue). L'index est construit à la première lecture,
 * pas à l'import : le module est atteint par des cycles d'import du moteur (`grapple`, `ops`).
 */
import { findRegleById, type RangeeDeRegleData } from '../data';
import { DIFFICULTY_MODIFIERS, type ModLine } from './types';
import { RANGEES_DE_REGLE, type CodexTarget, type RegleChiffree, type RangeeDe } from './ruleRefs';

const regleChiffree = (id: RegleChiffree): Map<string, RangeeDeRegleData> => {
  const fiche = findRegleById(id);
  if (!fiche) throw new Error(`Règle chiffrée « ${id} » : aucune fiche dans regles.json.`);
  const lues = new Map((fiche.rangees ?? []).map((r) => [r.id, r]));
  const attendues: readonly string[] = RANGEES_DE_REGLE[id];
  const manquantes = attendues.filter((cle) => !lues.has(cle));
  const inconnues = [...lues.keys()].filter((cle) => !attendues.includes(cle));
  if (manquantes.length || inconnues.length)
    throw new Error(`Règle chiffrée « ${id} » : rangées manquantes [${manquantes.join(', ')}], inconnues [${inconnues.join(', ')}] (RANGEES_DE_REGLE, ruleRefs.ts).`);
  return lues;
};

let index: Map<RegleChiffree, Map<string, RangeeDeRegleData>> | undefined;
const rangees = (id: RegleChiffree): Map<string, RangeeDeRegleData> =>
  (index ??= new Map((Object.keys(RANGEES_DE_REGLE) as RegleChiffree[]).map((r) => [r, regleChiffree(r)]))).get(id)!;

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
