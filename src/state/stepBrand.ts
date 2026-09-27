/**
 * MARQUE D'ORIGINE d'une étape de cascade (#1262) — module FEUILLE, entièrement TYPE : il ne déclare
 * aucune valeur d'exécution, donc tout import de ce fichier s'efface à la compilation. C'est ce qui
 * lui permet d'être partagé par les DEUX minteurs sans cycle : `rollSeam.ts` (la porte : bande, choix,
 * mono, table, hôte) et `revealStep.ts` (la révélation — module feuille consommé par `pushReveal` ET
 * par la migration de save, qui ne peut pas tirer `rollSeam`).
 *
 * La propriété est REQUISE : un littéral nu n'est plus assignable à `BuiltCascadeStep`, et le SEUL
 * moyen d'en produire une est le cast interne d'un minteur (lint `murs/marques`,
 * `eslint.config.js` : `as BuiltCascadeStep` hors des minteurs échoue ; `saves.ts` est SOUS la règle,
 * exempté AU SITE — chaque cast de réhydratation porte sa directive avec sa raison).
 *
 * TROIS LIMITES, dites ensemble — ce que NI le type NI le lint ne couvrent :
 *  1. le SPREAD blanchit. `{ ...étapeMintée, kind: 'autre' }` porte encore la marque et reste
 *     assignable, alors que rien n'a été revérifié. Les variantes fabrique-index des portes d'append
 *     suppriment ce motif dans les fichiers migrés ; le spread au sens large reste hors garantie.
 *  2. l'ANNOTATION d'une valeur `any`/`unknown` déjà élargie (`const s: BuiltCascadeStep = brut;`)
 *     passe sans cast : il n'y a pas de nœud de cast à interdire, et lui refuser l'annotation
 *     reviendrait à interdire de NOMMER le type — ce que le lint ne peut pas faire proprement.
 *  3. le RE-NOMMAGE de la marque par une voie que le sélecteur ne suit pas : renommage à l'import
 *     (`import type { BuiltCascadeStep as S }`), alias GÉNÉRIQUE ou calculé (`type S<T> = …`,
 *     conditionnel, accès indexé). Résidus ASSUMÉS et étroits — la route par ALIAS DIRECT
 *     (`type S = BuiltCascadeStep`, y compris en tableau/`readonly`/union), elle, est FERMÉE
 *     (#1262 V3 Lf) : c'était la forme naturelle, elle passait tsc ET eslint (mesuré), un 3ᵉ sélecteur
 *     la refuse désormais à la DÉCLARATION. Il ne mord PAS sur une signature qui EMPLOIE la marque
 *     (type de callback exigeant des étapes mintées : `nightBands.ts`, `cascade.ts` — 4 sites mesurés) :
 *     employer la marque, c'est le murage ; l'aliaser, c'est la porte. Sonde `built-brand-lint.test.ts`.
 * Dans ces cas c'est la relecture du site qui couvre, pas le compilateur. Le lint mure les routes de
 * FORGE (`x as T`, `<T>x`, y compris sous tableau/`readonly`/générique, et l'alias de type).
 *
 * MARQUE PUREMENT TYPOLOGIQUE : `declare const` — aucune valeur à l'exécution, donc une étape marquée
 * traverse le JSON d'une sauvegarde sans rien perdre et `Object.getOwnPropertySymbols` la rend vide.
 * Le jumeau `BuiltRollRow` (`ui/rollRowBuild.ts`) DIVERGE sur ce point exact : son symbole existe à
 * l'exécution (non exporté, non reproductible) pour garder `isBuiltRollRow` mesurable en vitest.
 */
import type { CascadeStep } from './pendings';

declare const CASCADE_STEP_BRAND: unique symbol;

/** Étape de cascade MONTÉE par un constructeur de la porte (ou par `revealToStep`). */
export type BuiltCascadeStep = CascadeStep & { readonly [CASCADE_STEP_BRAND]: true };
