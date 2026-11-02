# Sprites de décor interactif (SP2) — lettre, coffre, clé, bourse, étagère

*Spec — 2026-06-08. Sous-projet 2 du « décor interactif ». Étend SP1 (mécanique, livrée) avec
de vrais sprites pour le décor fouillable/ramassable, au lieu des stand-ins actuels
(cadavre / caisse / tonneau). N'ajoute aucun kind ni système ; ne touche pas la mécanique SP1.*

## 1. Problème

SP1 (mécanique `prop.interact`) marche déjà avec les décors existants, mais l'auteur de scène
n'a aucun sprite *dédié* pour les cas les plus courants de fouille/ramassage : une lettre au sol,
un coffre, une clé, une bourse, une étagère. Il détourne `caisse`/`cadavre`/`tonneau`. SP2 comble
ce trou en ajoutant 5 props au catalogue, dans le même moule SVG que l'existant, et en **reliant
le catalogue à SP1** : un prop « naturellement fouillable » pré-arme l'interactivité à la pose.

## 2. Objectifs / non-objectifs

**Objectifs**
- 5 nouveaux décors SVG **reconnaissables** : `lettre`, `coffre`, `cle`, `bourse`, `etagere`.
- Le **catalogue déclare** quels props sont naturellement interactifs (flag data-driven), pas une
  liste codée en dur dans l'éditeur.
- **Auto-suggestion** : choisir un décor `searchable` dans l'éditeur pré-coche « Interactif »
  (`interact:{effects:[]}`) si `interact` est absent — petit raccourci d'auteur, jamais destructeur.

**Non-objectifs (YAGNI)**
- Aucun nouveau `EntityKind`, aucune refonte d'inventaire, aucun changement de la mécanique SP1.
- Pas de pipeline image-based (best-of-N *génératif* réservé aux créatures/armes lues depuis l'art
  officiel) : ces props sont **dessinés à la main en SVG**, comme tout `catalog/decor.ts`.
- Pas d'animation d'ambiance dédiée (le halo d'affordance SP1 suffit ; `class="warm"` possible si
  un détail lumineux aide la lisibilité, ex. reflet d'or).

## 3. Sprites (`src/gameIso/catalog/decor.ts`)

Chaque prop = une fonction `render()` renvoyant un SVG en **boîte locale 120×150**, pieds ≈ y146,
palette **warm earthy** (bruns `#6e4a28`/`#4a3220`, métal `#9a968e`, or `#d8a93b`, accent rouge
`#a8423a`), ombre de contact au sol. Style **plat, silhouette d'abord** (cf. `caisse`, `coffre` doit
s'en distinguer). Intentions :

- **`lettre`** — parchemin enroulé posé à plat + **sceau de cire rouge** ; léger ourlet d'ombre.
- **`coffre`** — coffre **bombé** à couvercle galbé, **2-3 ferrures** métal verticales, **serrure
  dorée** au centre ; plus « trésor » que la `caisse` cubique.
- **`cle`** — grosse **clé ancienne** au sol : anneau circulaire, tige, **panneton** denté ; métal
  sombre + reflet.
- **`bourse`** — **bourse de cuir** fermée par un lacet froncé (col plissé), bedonnante ; 1-2 pièces
  d'or à côté.
- **`etagere`** — **rayonnage** en bois adossé : montants + **2-3 planches**, quelques objets posés
  (pots, livre) ; meuble plus haut que large.

## 4. Catalogue data-driven (lien SP1)

`PropViz` (`src/gameIso/catalog/types.ts`) gagne un champ optionnel :
```ts
/** Décor « naturellement fouillable/ramassable » : l'éditeur pré-arme `interact` à la pose (SP2↔SP1). */
searchable?: boolean;
```
Les 5 nouvelles entrées de `PROPS` portent `searchable: true`. Tout reste **une entrée par prop**
(cohérent registre Jalon 0.10). `propSvg(ref)` inchangé (résout le `render`).

## 5. Auto-suggestion interact (`src/ui/editor/Editor.tsx`)

Dans l'inspecteur `prop`, le sélecteur de décor (`onChange` du `ref`) :
- met à jour `ref` comme aujourd'hui ;
- **si** `PROPS[nouveauRef]?.searchable` **et** `!sel.interact` → ajoute `interact:{effects:[]}`
  dans le même `updateSel` (le bloc « Interactif » SP1 apparaît, pré-coché, effets vides à remplir).
- **Ne clobbe jamais** un `interact` déjà présent (recoche/effets conservés) ; choisir un décor non
  `searchable` **ne retire pas** un `interact` existant (l'auteur reste maître — il décoche s'il veut).

C'est le seul couplage SP2→SP1, et il est inerte hors éditeur (la donnée produite est un `interact`
SP1 standard).

## 6. Tests

- **Catalogue** (`catalog/decor.test.ts` ou voisin) : les 5 ids présents ; `searchable === true` sur
  les 5 et **absent/false** sur les décors purs (tonneau…) ; `propSvg(id)` non vide pour chacun.
- **Éditeur** (test ciblé) : choisir un ref `searchable` sans `interact` → `interact:{effects:[]}`
  posé ; **non-clobber** si `interact` déjà présent ; un ref non-`searchable` ne crée pas d'`interact`.

## 7. QC reconnaissabilité (méthode repo)

Après dessin : rendu **PNG** (resvg, `scripts/qc/`) d'une planche des 5 props → **agents aveugles**
devinent chaque prop **sans son nom** → corrections **best-of-N** (silhouette/contraste/échelle)
jusqu'à reconnaissable. Critère de sortie : chaque
prop deviné correctement par ≥ une passe d'agents aveugles (au moins « coffre/lettre/bourse/clé/
étagère » non confondus avec caisse/tas/sac).

## 8. Intégration & risques

- **Fichiers partagés** : `Editor.tsx` est édité en parallèle (autre session) → patch ciblé sur le
  `onChange` du sélecteur de décor uniquement, commit propre (temp-index si besoin). `decor.ts` et
  `types.ts` sont peu disputés. Vérifier après coup que mon code est dans HEAD (sweep possible).
- **`searchable` ≠ `interact`** : `searchable` est une *suggestion d'auteur* (catalogue) ; la donnée
  de scène ne porte que `interact` (SP1). Un prop `searchable` posé puis décoché = décor pur. Pas de
  comportement runtime caché.
- **Recette navigateur** : poser chaque prop dans l'éditeur (palette → 5 entrées), vérifier le rendu
  iso WYSIWYG + l'auto-coche « Interactif », tester en jeu (halo + fouille). 0 erreur console.

## 9. Découpage

SP2 = ce spec, livrable seul (étend SP1 sans le bloquer). Ordre d'implémentation : sprites + flag
catalogue + tests catalogue → auto-suggestion éditeur + test → QC reconnaissabilité → recette.
