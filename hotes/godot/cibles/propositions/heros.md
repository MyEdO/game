# Propositions : création et progression (2026-11-16, #3935 ; maquettes JSON #4411)

Compte rendu des écrans dessinés à la suite des maquettes jugées `creation-carriere` et `fiche-du-heros`
(`../maquettes/`), depuis la cible écrite `../ecrites/heros.md`. Sources au dépôt : quatre écrans de
`sources/maquettes/`, chacun la liste de ses états au format de `sources/maquettes/maquette.ts`, dessinés par
`sources/rendu.html` au gabarit 3 « Fiche » de `dispositions.md` (`node sources/rendre.mjs <écran> <sortie.png>
--format 16:9 [--etat <état>]`) :
- `creation` : un écran à étapes, un état par étape et par variante (`creation-caracteristiques`,
  `creation-caracteristiques-reassigner`, `creation-caracteristiques-points`, `creation-signe-astral`,
  `creation-competences-de-race`, `creation-competences-de-carriere`, `creation-talents`, `creation-talents-doublon`,
  `creation-talents-sorts-mineurs`, `creation-possessions`, `creation-identite`, `creation-presentation`) ;
- `fiche-du-heros` : `fiche-possessions`, `fiche-possessions-composant`, `fiche-possessions-prothese`,
  `fiche-possessions-faveur` ;
- `depense-d-experience` : `progression-depense-d-experience`, `progression-depense-d-experience-creneaux`,
  `progression-depense-d-experience-sorts` ;
- `changement-de-carriere` : `progression-changement-de-carriere`, `progression-changement-de-carriere-saut`.

Les dessins de la famille (figure du héros, ciel du signe, objets du bagage, filigrane, signature) vivent dans
`sources/heros/heros.js`, ses pièces dans `sources/heros/heros.css`, sur le bandeau de `sources/lieux-et-nuit/`.
Premières maquettes : chaque « À valider » attend l'utilisateur.

La création suit le découpage du code (`src/noyau/creation/vueDeLaCreation.ts:402-413`) : dix étapes, dont « Signe
astral » seulement si la règle `creation-signes-astraux` est active (`src/noyau/creation/brouillon.ts:845-848`).
Pièces neuves : rangée de dix clous d'Augmentation, pastilles de palier 0 / +3 / +5, carte de Compétence à anneau,
vignette d'objet, champ manuscrit, jeton de PX en grand, ligne d'exigence, station du chemin de carrière, jeton de
prix en fer, figure dont la sanguine descend d'étape en étape.

## creation-caracteristiques (3/10)
- `creation-caracteristiques` : la méthode en trois plaques avec leur gain (`geste('methode', m)` : « Garder les
  jets +50 PX », « Réassigner les jets +25 PX », « Répartir 100 points » ; LDB 05 l.337-341), « Relancer les dix
  2d10 » (`relancerLesCaracteristiques`, sans PX), les cinq Augmentations de carrière (LDB 05 l.460) et les points
  de Destin et de Résilience en clous réglés par − et + (`geste('compteur', c, v)`) ; au centre le profil, le dé au-dessus
  de chaque valeur, et la page de la Caractéristique pressée. Vue : `src/noyau/creation/vueDeLaCreation.ts:222-244`.
- État `reassigner` : sous la Caractéristique pressée, les dix jets en sceaux avec celle qui porte chacun ; en
  prendre un autre échange les deux (`geste('assigner', k, i)`, `vueDeLaCreation.ts:228`).
- État `points` : chaque case porte ses points et son − / + ; « À répartir · 4 / 100 » ; « Suivant » fermé, la
  raison du noyau au survol. De 4 à 18 points par Caractéristique (LDB 05 l.341).
- À valider : la page n'avait pas de maquette (les étapes 1 et 2 sont jugées, la 3 manquait) ; la prose de la
  Caractéristique (verbatim LDB) n'est pas servie par la vue ; valeurs d'exemple (jets, Humains 2d10+20, Destin 2,
  Résilience 1, trois points à répartir). Le refus de « Suivant » est le texte du noyau (`crea.repartitionDesPoints`,
  `src/noyau/creation/brouillon.ts:881` ; `validatePointBuy`, `src/engine/creation.ts:108-116`).

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
- État `doublon` (`creation-talents-doublon`) : le tirage 68 rend « Perspicace », déjà retenu « Au choix » ; la ligne
  dit « Maxi atteint : sans effet si gardé » et offre « Relancer Perspicace » (`relancerLeTalent(adresse)`,
  `src/noyau/creation/vueDeLaCreation.ts:320-321` ; LDB 05 l.484, table l.505-531). Un Talent sous son Maxi dit
  « Déjà possédé ». Le tirage d'exemple remplace « Chanceux ».
- État `sorts-mineurs` (`creation-talents-sorts-mineurs`) : autre héros d'exemple, une Sorcière novice dont le Talent de
  carrière retenu est « Magie mineure » ; la page du centre liste les Sorts de Magie mineure en pastilles, « Magie
  mineure (3 sorts) » et son compte ; les trois retenus en laiton (`sortMineur(id)`, `vueDeLaCreation.ts:331-336`),
  les autres fermés, « Plus rien à répartir. » au survol. Quota = Bonus de Force Mentale (LDB 10 l.714 ; 3 est un
  exemple). Prose : extrait verbatim du Talent (`src/data/talents.json`, `magie-mineure`).
- À valider : pastille « Utilisation » ; l'état `doublon` garde la page du Talent de carrière au centre ; vingt-cinq
  Sorts du Livre de base montrés, la liste réelle est celle que sert le noyau (`idsDeLaSousListe('spell', 'mineure')`).

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
- Changement voulu de l'image : le panneau de droite porte les onglets « Talents | Sorts » à la place du ruban « Talents ».
- État `creneaux` (`progression-depense-d-experience-creneaux`) : niveau 2, l'emplacement « (Au choix) » pressé déplie
  ses spécialisations en pastilles ; la retenue en laiton ; « Désigner » la retient sans rien acheter
  (`designerLeCreneau(heroId, slotKey, option)`), la plaque de prix l'achète (LDB 09 l.38 ;
  `src/noyau/monde/advancement.ts:187-240`).
- État `sorts` (`-sorts`) : onglet « Sorts » ; un Sort à apprendre montre son prix (`acheterLeSort(heroId, spellId)` :
  mineure 50 PX par tranche de Bonus de FM, Arcanes 100 PX par tranche de Bonus d'Int, LDB 10 l.680-696, l.714-722 ;
  `src/engine/grimoire.ts:176-193`) ; un Sort connu offre son composant (`acheterLaComposante(heroId, spellId)`, payé de
  la bourse du héros, NI en pistoles d'argent, LDB 46 l.107-113).
- À valider (#4585) : la rangée des valeurs d'arrivée de « Autre carrière » garde sa hauteur, vide sans elles ; les
  Compétences à augmenter défilent sous leur tête ; le pied de l'identité qui progresse prend toute sa place ; les
  mesures du dossier d'une possession tiennent un bloc de deux mesures, vide en partie pour une seule.
- À valider : onglet de la fiche ou écran à part ; Compétences hors carrière repliées ; achat immédiat sans panier ;
  « Désigner » séparé de l'achat ; nombres d'exemple (PX, niveaux, bourse).

## progression-changement-de-carriere
- Niveau 2 achevé : le chemin des quatre niveaux en stations, le niveau inférieur et le suivant pressables à
  100 PX, le niveau 4 hors d'atteinte (LDB 07 l.137) ; la page du niveau suivant (« Devenir Maîtresse Sorcière
  100 PX ») ; une autre carrière par Classe avec son prix (LDB 07 l.144 ; `src/engine/advancement.ts:185-205`).
  Panneau fermé par la croix.
- Changement voulu de l'image : la station 4, hors d'atteinte, dit au survol « saut de niveau impossible (option MJ
  requise) » (texte du noyau, `src/engine/advancement.ts:185-205`).
- État `saut` (`progression-changement-de-carriere-saut`) : règle optionnelle `progression-saut-de-niveau` active
  (`src/data/reglesOptionnelles.json:818` ; LDB 07 l.140, l.148) : toute station se presse, la page est celle du
  niveau visé, « Autre carrière » offre le choix du niveau d'arrivée (`changerDeCarriere(heroId, newCareer, newLevel)`).
- À valider : seules les carrières du Livre de base listées ; la restriction des Sorciers (LDB 07 l.148) n'est pas
  vérifiée par le noyau, donc pas dessinée ; plaque de confirmation de la colonne Carrière non dessinée.

## fiche-possessions
Section « Possessions » de la fiche jugée (`../maquettes/fiche-du-heros.jpg`), écran `fiche-du-heros` ; quatre états du
cartouche de la ligne pressée. Les gestes sont ceux de `src/noyau/gestesDeLObjet.ts`
(« Porter », « Main principale », « Main secondaire », « Ranger dans », « Donner à », « Poser au sol »).
- `fiche-possessions` (état `arme`) : la rangée des sets d'armes, celui en main cerné ; « + » crée un set
  (`creerLaPanoplie(heroId)`), une main pressée se garnit (`garnirLaPanoplie(heroId, loadoutId, slot, uid)`), la croix
  le supprime (`supprimerLaPanoplie(heroId, loadoutId)`), presser un set le prend (`prendreLaPanoplie`). Refus au
  survol : « Arme à deux mains — pas de seconde main. » (texte du noyau), « Dernière panoplie — un héros en garde
  toujours une. » (`src/noyau/partyFlow.ts:264-309` ; LDB 14 l.138). Listes « Porté », « En vrac et rangé ».
- `fiche-possessions-composant` : un composant « À lier » ouvre les Sorts connus ; en presser un le lie
  (`designerLeComposant(uid, spellId)`, `partyFlow.ts:580-647` ; LDB 46 l.107-113).
- `fiche-possessions-prothese` (Berta) : la Fausse jambe et ses paliers d'entraînement avec leur prix en PX
  (`entrainerLaProthese(uid)`, `partyFlow.ts:718-745` ; LDB 73 l.19, l.23 ; paliers `src/data/trappings.json`,
  `prosthesisTraining`).
- `fiche-possessions-faveur` (Berta) : « Faveurs dues » ; la Faveur pressée dit à qui et pour quoi, où en est son
  solde, et offre « Rompre la Faveur » (`rompreLaFaveur(heroId, favorId)`), sa conséquence dite au-dessus de la
  plaque (LDB 23 l.141-151 ; `src/noyau/favorFlow.ts` ; règle maison `faveur-rumeur-se-repand`). Le solde se joue à
  l'interlude (`solderLaFaveur`, `src/noyau/interludeEnVue.ts:92`), pas sur la fiche.
- À valider : « Panoplies » à l'écran comme au code (le noyau dit encore « set d’armes », `src/i18n/messages/fr.ts`
  `pf.loadoutLast`, que le refus de la maquette ne recopie plus) ; figure générique pour les deux héros ; noms,
  objets et prix d'exemple ; l'échoppe (troc, réparation) revient à la famille `commerce`.

## Choix de la migration en maquettes JSON (#4411), à valider
- Largeurs : `dispositions.md` garde au choix et au héros leur largeur, ce que 1280 ne tient pas ; le choix prend 484,
  le héros 340, le détail se tend entre eux.
- Méthodes des Caractéristiques en lignes cochées avec leur gain, plus en plaques ; le dé de la création est le sceau du
  kit ; la variante du signe passe sous la liste des signes, ses pastilles en une rangée.
- Fiche : la figure prend 180 de large ; le bandeau du groupe est posé comme le veut le gabarit 3, là où le dossier
  d'une possession n'en a pas.
- Pièces gardées dans `sources/heros/heros.css` plutôt qu'au kit : jeton, pastille de palier, clous d'Augmentation,
  station du chemin ; elles n'ont pas encore de seconde famille.
- Libellés chiffrés (« 3 Talents au d100 », « Augmentations à +5 ») plutôt qu'en toutes lettres ; la bourse de création
  dit « 7/- », sans « sept pistoles d'argent ».
- Bulles de refus : sous la ligne refusée dans une liste, à droite de la pastille dans les Sorts de Magie mineure, au-dessus
  partout ailleurs ; l'état `creation-talents-sorts-mineurs` montre le refus sur « Tendre l'oreille ».
