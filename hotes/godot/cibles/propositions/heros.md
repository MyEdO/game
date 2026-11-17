# Propositions : création et progression (2026-11-16, #3935)

Compte rendu des neuf écrans dessinés à la suite des maquettes validées `creation-carriere` et `fiche-du-heros`
(`../maquettes/`), depuis la cible écrite `../ecrites/heros.md`. Sources au dépôt : `sources/heros/`, sur le socle commun de
`sources/lieux-et-nuit/`. Rien n'est validé.

La création suit le découpage du code (`src/noyau/creation/vueDeLaCreation.ts:402-413`) : dix étapes, dont « Signe
astral » seulement si la règle `creation-signes-astraux` est active (`src/noyau/creation/brouillon.ts:845-848`).
Pièces neuves : rangée de dix clous d'Augmentation, pastilles de palier 0 / +3 / +5, carte de Compétence à anneau,
vignette d'objet, champ manuscrit, jeton de PX en grand, ligne d'exigence, station du chemin de carrière, jeton de
prix en fer, figure dont la sanguine descend d'étape en étape.

## creation-signe-astral (4/10)
- Le dé d'abord (sceau, signe tiré, +25 PX si gardé : ADE II 03 l.36, `src/engine/creation.ts:53`), les vingt signes
  en deux colonnes, la page du signe sous un ciel nocturne (`src/data/stars.json`).
- À valider : l'Étoile du Sorcier sur une ligne alors que la donnée a quatre variantes ; champ « Dieux » absent.

## creation-competences-de-race (5/10)
- Les douze Compétences de la race, trois pastilles 0 / +3 / +5 chacune ; six cartes au centre ; « Répartition par
  défaut » (3 à +5, 3 à +3 : LDB 05 l.484).

## creation-competences-de-carriere (6/10)
- Huit lignes à dix clous et pastilles −/+, « À répartir » ; la Compétence pressée au centre avec ses
  spécialisations (40 Augmentations, 10 au plus : LDB 05 l.535).
- À valider : « Suivant » refusé tant qu'il reste des points ; Augmentations de race non distinguées.

## creation-talents (7/10)
- Race et carrière sur une page ; les trois tirages en sceaux (LDB 05 l.514-531) ; le Talent de carrière parmi quatre
  lignes, une grisée avec sa raison.
- À valider : un seul Talent de carrière (`vueDeLaCreation.ts:325`, non relu au livre) ; pastille « Utilisation ».

## creation-possessions (8/10)
- La bourse au dé (1d10 × Standing : LDB 05 l.578), le seul choix réel en trois lignes, la dotation de Classe en
  liste ; « Le bagage » en vignettes d'objets.
- À valider : titre « Le bagage » ; pictogrammes d'objets neufs.

## creation-identite (9/10)
- Ce que les dés donnent (sexe, nom, âge 15 + d10 : LDB 05 l.711, taille, yeux, cheveux) ; un feuillet signé où
  s'écrivent motivation et ambitions.
- À valider : motivation et ambitions existent au brouillon (`brouillon.ts:160-162`) mais la vue ne les sert pas ;
  formule de taille non relue au livre.

## creation-presentation (10/10)
- Le héros achevé : identité, profil, Compétences, Talents, figure pleine, total des PX, « Engager ».
- À valider : la vue ne sert ni Blessures, ni réserves, ni Compétences, ni Talents, ni signe, ni bourse ; Blessures
  calculées de tête.

## progression-depense-d-experience
- Gabarit de la fiche : PX en jeton, exigences du niveau cochées, bande de profil pressable (cases de carrière en
  laiton, les autres en fer), Compétences et Talents de la carrière avec leur prix. Coûts LDB 07 l.51-56, hors
  carrière doublé l.91, Talent l.105, achèvement l.124-131, changement l.118 ; vue `src/noyau/monde/advancement.ts:138-320`.
- À valider : onglet de la fiche ou écran à part ; Compétences hors carrière repliées ; achat immédiat sans panier.

## progression-changement-de-carriere
- Le chemin des quatre niveaux en stations, la page du niveau suivant (« Devenir Sorcière 100 PX » : LDB 07 l.137),
  une autre carrière par Classe avec son prix (LDB 07 l.144 ; `src/engine/advancement.ts:185-205`).
- À valider : seules les carrières du Livre de base listées ; saut de niveau (règle optionnelle) absent.
