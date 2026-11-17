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
- L'Étoile du Sorcier est le vingtième signe ; ses quatre variantes (Sixième sens, Seconde vue, Magie mineure,
  Sorcier !) sont en pastilles au pied avec leur rang au d10, et un second sceau « Variante au d10 » reste vide tant
  qu'un autre signe est tiré (`src/data/stars.json`, ids `l-etoile-du-sorcier-*`, champ `sub`).
- À valider : champ « Dieux » absent.

## creation-competences-de-race (5/10)
- Les douze Compétences de la race, trois pastilles 0 / +3 / +5 chacune ; six cartes au centre ; « Répartition par
  défaut » (3 à +5, 3 à +3 : LDB 05 l.484). Les cartes portent la Caractéristique de la présentation (Int 37,
  Évaluation 42 à ce stade). « Suivant » fermé, sa raison en bulle au survol.

## creation-competences-de-carriere (6/10)
- Huit lignes à dix clous et pastilles −/+, « À répartir » ; la Compétence pressée au centre avec ses
  spécialisations (40 Augmentations, 10 au plus : LDB 05 l.535). L'Augmentation de race est une pastille de cire
  devant les dix clous, hors des quarante et des dix ; les Tests sont ceux de la présentation (Évaluation 47,
  Perception 46).
- À valider : « Suivant » refusé tant qu'il reste des points.

## creation-talents (7/10)
- Race et carrière sur une page ; les trois tirages en sceaux (LDB 05 l.514-531) ; le Talent de carrière parmi quatre
  lignes (un seul : LDB 05 l.535), une grisée, sa raison en bulle au survol.
- À valider : pastille « Utilisation » ; relance d'un Talent en doublon et sorts de Magie mineure non dessinés.

## creation-possessions (8/10)
- La bourse au dé (1d10 × Standing : LDB 05 l.578), le seul choix réel en trois lignes, la dotation de Classe en
  liste ; « Le bagage » en vignettes d'objets.
- À valider : titre « Le bagage » ; pictogrammes d'objets neufs.

## creation-identite (9/10)
- Ce que les dés donnent (sexe, âge 15 + d10 : LDB 05 l.711, taille 145 + 5d10 : l.728, yeux, cheveux), le
  physique en un seul tirage (plaque « Physique aux dés », `tirerLePhysique`, `vueDeLaCreation.ts:83`) ; le nom tiré
  ou écrit (LDB 05 l.590) ; un feuillet signé où s'écrivent Motivation (l.432) et Ambitions (l.732), champs à plume.
- À valider : la vue de l'hôte ne sert pas encore la saisie du nom, de la Motivation et des Ambitions (transition
  `withEtatCivil`, `brouillon.ts:808` ; #3009).

## creation-presentation (10/10)
- Le héros achevé : identité, profil, Compétences, Talents, figure pleine, total des PX, « Engager ».
- À valider : la vue ne sert ni Blessures, ni réserves, ni Compétences, ni Talents, ni signe, ni bourse ; Blessures
  calculées de tête.

## progression-depense-d-experience
- Gabarit de la fiche : PX en jeton, exigences du niveau cochées, bande de profil pressable (cases de carrière en
  laiton, les autres en fer), Compétences et Talents de la carrière avec leur prix. Coûts LDB 07 l.51-56, hors
  carrière doublé l.91, Talent l.105, achèvement l.124-131 ; vue `src/noyau/monde/advancement.ts:138-320`.
- Niveau non achevé : « Niveau suivant » fermé (LDB 07 l.137 ; `src/engine/advancement.ts:197-200`), « Autre
  carrière 200 PX » (l.118, l.144). Panneau fermé par la croix.
- À valider : onglet de la fiche ou écran à part ; Compétences hors carrière repliées ; achat immédiat sans panier ;
  créneau « (Au choix) » et sorts d'un lanceur non dessinés (`advancement.ts:187-205`, `src/engine/grimoire.ts:153-162`).

## progression-changement-de-carriere
- Niveau 2 achevé : le chemin des quatre niveaux en stations, le niveau inférieur et le suivant pressables à
  100 PX, le niveau 4 hors d'atteinte (LDB 07 l.137) ; la page du niveau suivant (« Devenir Maîtresse Sorcière
  100 PX ») ; une autre carrière par Classe avec son prix (LDB 07 l.144 ; `src/engine/advancement.ts:185-205`).
  Panneau fermé par la croix.
- À valider : seules les carrières du Livre de base listées ; saut de niveau et même niveau d'une autre carrière
  (règle optionnelle, LDB 07 l.140, l.148) absents ; plaque de confirmation de la colonne Carrière non dessinée.
