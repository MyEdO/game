# Images cibles et propositions de maquettes (#3935)

Images d'intention des écrans sans maquette validée, une par état, sous `propositions/<famille>/<état>.jpg`, le compte rendu détaillé de chaque famille dans `propositions/<famille>.md` (vue
`bureau`). Une proposition n'est pas une cible : elle le devient quand l'utilisateur la valide, son image entre alors
dans `maquettes/` et `maquettes.json`. Les choix qu'aucune cible écrite ne tranchait sont listés avec l'état.
Dessinées depuis les cibles écrites (`ecrites/`) et les maquettes validées, jamais depuis un écran existant
(fiche `user-doctrine-la-cible-prime-sur-l-ancien-ecran`).

## Images cibles validées (2026-11-13 au 2026-11-15)

Les images de la page « Images cibles des écrans », sous `maquettes/`. Celles d'une planche en PNG, déclarées dans
`maquettes.json` ; les autres en JPEG, référence de leur famille. Légende de chacune :

| Image | Ce qu'elle tranche |
|---|---|
| `voyage-image-cible` | le décor tient tout l'écran et dit le milieu, le moment et le temps ; les jets en pastilles sur les cartes des héros ; seule une décision arrête la route |
| `combat-tour-du-heros` | le tour d'un héros : ordre en colonne de portraits, panneau de l'actif, barre d'actions, aperçu de la cible survolée |
| `attaque-jet-tombe` | le jet d'attaque dans un bandeau de parchemin en bas, les deux dés côte à côte, sans masquer le champ |
| `combat-liste-ouverte` | variante A : la pastille « Sort » ouvre un panneau au-dessus du meuble qui ne liste que le disponible, fiche au survol, deux clics pour lancer |
| `combat-barre-de-l-actif` | variante B (retenue) : six emplacements rapides au-dessus des actions, jouables d'un clic ou aux touches 1 à 6 ; les pastilles restent l'entrée de chaque famille |
| `lieu-steinbruck` | l'arrivée dans un bourg : la place, la rue jusqu'à la porte, les services portés par leurs bâtiments, le départ sur le poteau des routes |
| `echoppe-panier` | le marchand à gauche, l'étal en lignes avec le prix en colonne, le panier et son compte, la vente héros par héros |
| `lieu-enceintes` | l'enceinte est une donnée du lieu : aucun mur, palissade, rempart, sur le même écran |
| `ville-bogenhafen-quartiers` | une grande ville s'ouvre sur son plan, quartiers nommés, ambiance et enseignes du quartier regardé, sceau sur le quartier d'une rumeur |
| `auberge-fin-du-voyage` | l'aubergiste vend chambre, repas, bière et écurie au prix du livre ; la rumeur de la salle s'inscrit au journal |
| `logis-qualites` | la qualité est une donnée de l'établissement, par quartier ; salle, offres et prix la suivent |
| `auberge-bouge-altstadt` | le même écran en bas de l'échelle : moins d'offres, paillasse, avertissement des voleurs |
| `creation-carriere` | la frise des dix étapes, le d100 au-dessus des listes, la page de la carrière, le héros qui se dessine |
| `fiche-du-heros` | un écran entier : identité et réserves à gauche, profil en bande, contenu en onglets, héros changé par le bandeau |

## Combat (2026-11-16)

| État | Signes du contrat `combat.md` | Choix à valider |
|---|---|---|
| `tour-adverse` | A1, A2, T3 | le meuble ne montre que nom, arme et Blessures ; emplacements rapides absents ; ruban « Action » grisé |
| `jet-avant-le-de` | J9 | zone choisie en laiton plein, « −20 au Test » en étiquette, gestes « Lancer » et « Annuler » |
| `jet-de-defense` | J1 à J8 | réussite en sceau de cire verte |
| `incantation` | J10 | cible à droite en bloc sans dé, sort en gothique au centre |
| `coup-critique` | C1, C2, C3 | victime et silhouette à gauche, texte du livre à droite, un seul geste |
| `debut-du-round` | R1 | « Agir en premier » en cartes de héros pressables |
| `fin-victoire`, `fin-defaite` | F1, F2 | le reste de l'interface s'efface, un seul bouton « Reprendre » |
| `journal-ouvert` | T19 | panneau au-dessus de sa pastille, rangé par round |
| `fiche-au-clic` | T21 | quatre panneaux entre l'ordre et le journal, les ancrages restent visibles |
| `cible-survolee` | T14, T15, T16 | aucun |

## Lieux et nuit (2026-11-16)

Aucune cible écrite ne couvre ces écrans. Règles de design de l'utilisateur (même fiche) : un choix se met en scène
dans son lieu avec ses PNJ ; un service vit sur la page des services de son lieu. Ce qui se joue vient des livres :
EDOC 08 l.131-180, LDB 09 l.554, LDB 18 l.296, LDB 66 l.5-28, LDB 23, NADJ 16.

| État | Intention | Choix à valider |
|---|---|---|
| `bivouac` | la halte de nuit en scène, les huit Activités d'Étape en postes où poser les héros | « Rester aux aguets » tient lieu de veille ; les huit postes offerts à toute halte ; effet de la tente |
| `nuit-a-l-auberge` | la salle de l'auberge, chambre et repas par qualité, un poste de soirée par héros | qualité choisie par le joueur ou donnée de la maison ; bourse du groupe ou par héros ; boire une pinte |
| `services-du-lieu-medecin` | la page des services d'un lieu ouverte sur le médecin, soins par patient | prix de la visite (LDB 75 l.19 donne une fourchette) et de la Chirurgie ; rail du quartier ou du bâtiment |
| `jeux-de-taverne` | le service des jeux de l'auberge, la table et ses joueurs | jeux proposés par maison ; mise libre |
| `interlude-en-ville` | le plan de la ville, chaque Activité accrochée à un lieu et à son PNJ | rattachement des Activités aux lieux ; restriction par Classe ; trois semaines |

## Accueil et système (2026-11-16)

Aucune cible écrite. Le contenu vient de `src/hote/accueil.ts`, `groupe.ts`, `sauvegardes.ts`, `reglages.ts`.

| État | Intention | Choix à valider |
|---|---|---|
| `accueil` | la compagnie face à Altdorf, jeu en plaques, outils en pastilles | « Reprendre » en premier ; sur-titre et sous-titre ajoutés |
| `nouvelle-partie` | la salle d'une auberge-relais, le groupe attablé, les voyageurs à recruter, les campagnes en avis cloués | cinq voyageurs visibles à la fois ; espèce absente de l'étiquette |
| `sauvegardes` | quatre feuillets sur la table, l'automatique d'abord | portraits du groupe et vignette du lieu, que la sauvegarde ne porte pas |
| `menu-de-la-partie` | le jeu assombri, la colonne de l'accueil | geste « Reprendre » ; colonne à gauche |
| `options` | préférences sur un volet, règles maison dans un registre à quinze signets | douze règles par feuillet ; libellés lisibles des options |
| `ouverture-de-chapitre` | carton plein écran du chapitre, « Commencer » | compagnie affichée ; texte sur l'image |

## Héros : création et progression (2026-11-16)

Suite des pages de `ecrites/heros.md` (dix étapes, `src/noyau/creation/vueDeLaCreation.ts`) ; la progression
n'a pas de cible écrite (`src/noyau/monde/advancement.ts`, LDB 07).

| État | Intention | Choix à valider |
|---|---|---|
| `creation-signe-astral` | le dé puis les vingt signes, la page du signe au centre | variantes de l'Étoile du Sorcier ; champ « Dieux » |
| `creation-competences-de-race` | douze lignes à trois paliers, six cartes au centre | aucun |
| `creation-competences-de-carriere` | huit lignes à dix clous, la Compétence pressée au centre | Augmentations de race non distinguées |
| `creation-talents` | race et carrière sur une page, tirages en sceaux | pastille « Utilisation » |
| `creation-possessions` | la bourse au dé, le bagage en vignettes | pictogrammes d'objets neufs |
| `creation-identite` | ce que les dés donnent, un feuillet pour motivation et ambitions | motivation et ambitions non servies par la vue |
| `creation-presentation` | le héros achevé, « Engager » | la vue ne sert pas tout ce qui est dessiné |
| `progression-depense-d-experience` | la fiche dont profil, Compétences et Talents deviennent pressables, avec leur prix | onglet de la fiche ou écran à part ; achat immédiat |
| `progression-changement-de-carriere` | le chemin des quatre niveaux, le niveau suivant, une autre carrière par Classe | carrières listées par livre ; niveaux fermés |

## Exploration et récit (2026-11-16)

Sans cible écrite ; compte rendu dans `propositions/exploration-et-recit.md` : `exploration`, `dialogue`,
`jet-de-competence` (dans le bandeau du bas, comme le jet de combat), `butin` (chaque objet va sur un héros),
`document`, `carte-du-monde`. Manquent le voyage (événement de route, arrivée, fleuve, mer, navire, combat naval), la
bataille de masse, la magie, les réactions de combat, la halle, le port et le marchandage : liste complète des écrans
au commentaire de #3935.

## Sources des propositions

Chaque proposition a sa source HTML, CSS et JS sous `propositions/sources/<famille>/`, polices communes sous
`propositions/sources/polices/` (OFL). Une image se refait depuis sa source, jamais à la main :
`node propositions/sources/rendre.mjs <chemin absolu du .html> <sortie.png> [échelle]`, Playwright résolu depuis le script (il n'est pas une dépendance du dépôt : `npm i --no-save playwright`, ou dans le conteneur cloud un lien `node_modules/playwright` vers `/opt/node-tools/node_modules/playwright`) (vue 1707 × 780, rapport des
pièces qui débordent ou se chevauchent). Les pages d'une famille partagent sa feuille et son script communs ; une pièce
neuve s'y ajoute plutôt que dans une page.

