/**
 * FORMES d'un ÉTAT DE CAMPAGNE (registre `narratif.etats`, #2539) — TABLE TOTALE keyée par `kind` : ce que
 * chaque forme admet comme USAGE d'une référence `etat`, et si elle DÉCLARE ses valeurs. La lisent la porte
 * du projet et le raffinage du narratif (`fautesDUsageDEtat` et les sous-références `valeur`/`value`,
 * `./refs-narratives.ts`), l'éditeur (`ConditionEditor`, `EffectList`, `NarratifEditor`) et les résumés
 * (`condSummary`, `humanizeCondition`), par les accesseurs ci-dessous. Une forme de plus = une ligne ici
 * (le schéma de sa déclaration vit dans `SCHEMA_DE_FORME`, `./narratif.ts`, dont l'union dérive).
 *
 * FEUILLE sans dépendance : le schéma, la porte et l'UI la lisent sans tirer le parseur.
 *
 * EDO 02 l.91 ; EDO 01 l.241 ; EDO 02 l.27.
 */

/** Forme d'un état : `heros` (référence à un héros du groupe), `enum` (issue exclusive nommée). */
export type FormeDEtatKind = 'heros' | 'enum';

/** USAGE d'une référence `etat` : désigner un héros (`designerHeros`), poser une valeur (`poserEtat`),
 *  comparer à une valeur (Condition `etat` avec `value`), sélectionner le héros désigné (`who: {etat}`).
 *  « Est défini » (Condition `etat` sans `value`) vaut pour toute forme. */
export type UsageDEtat = 'designer' | 'poser' | 'comparer' | 'selectionner';

export const LIBELLE_D_USAGE: { readonly [U in UsageDEtat]: string } = {
  designer: 'désigner un héros',
  poser: 'poser une valeur',
  comparer: 'comparer à une valeur',
  selectionner: 'sélectionner le héros désigné',
};

/** Ce que chaque forme admet, et si ses valeurs sont DÉCLARÉES (`valeurs`, contrôlées au chargement). */
export const FORMES_D_ETAT: { readonly [K in FormeDEtatKind]: { readonly label: string; readonly usages: readonly UsageDEtat[]; readonly valeursDeclarees: boolean } } = {
  heros: { label: 'Héros du groupe', usages: ['designer', 'selectionner'], valeursDeclarees: false },
  enum: { label: 'Issue énumérée', usages: ['poser', 'comparer'], valeursDeclarees: true },
};

/** Un état déclaré, tel que le lisent les accesseurs (forme de `narratif.etats[]`). */
export interface EtatDeclare {
  readonly id: string;
  readonly label: string;
  readonly forme: { readonly kind: FormeDEtatKind; readonly valeurs?: readonly { readonly id: string; readonly label: string }[] };
}

/** Les états de `etats` dont la forme admet l'usage `usage`. */
export const etatsAdmettant = <E extends EtatDeclare>(etats: readonly E[] | undefined, usage: UsageDEtat): E[] =>
  (etats ?? []).filter((e) => FORMES_D_ETAT[e.forme.kind].usages.includes(usage));

/** Les valeurs DÉCLARÉES d'un état (aucune si sa forme n'en déclare pas). */
export const valeursDeclarees = (etat: EtatDeclare | undefined): readonly { readonly id: string; readonly label: string }[] =>
  (etat && FORMES_D_ETAT[etat.forme.kind].valeursDeclarees ? etat.forme.valeurs ?? [] : []);

/** Libellé d'affichage de l'état `id` (repli : l'id). */
export const libelleDEtat = (etats: readonly EtatDeclare[] | undefined, id: string): string =>
  etats?.find((e) => e.id === id)?.label ?? id;

/** Libellé d'affichage de la valeur `valeur` de l'état `id` (repli : l'id de valeur). */
export const libelleDeValeurDEtat = (etats: readonly EtatDeclare[] | undefined, id: string, valeur: string): string =>
  valeursDeclarees(etats?.find((e) => e.id === id)).find((v) => v.id === valeur)?.label ?? valeur;
