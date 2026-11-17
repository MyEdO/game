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
| `coup-critique` | C1, C2, C3 | victime et silhouette à gauche, texte du livre à droite, un seul geste ; la barre compte le coup et le Critique |
| `debut-du-round` | R1 | « Agir en premier » : carte du héros offert et son coût, sa Chance en réserve, puis la plaque |
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
`document`, `carte-du-monde`. Le voyage, la suite du combat, le commerce et les outils ont depuis leurs sections
ci-dessous. Manquent encore, relevés à leurs comptes rendus : la décision qui ouvre une course-poursuite en mer ; le
facteur environnemental tiré d'une bataille de masse ; le Test de Corruption tombé et le Test de Résistance raté avant
la mutation ; « Chance : +1 DR », la raison au survol de « Relancer » fermée, l'axe « Dégâts » de la surincantation
révisée ; à la halle et au port, les refus, l'acheteur introuvable, la moitié du lot proposée, l'évaluation du vin
résolue, le Marchandage de vente, le Marchandage perdu, le chantier naval, le recrutement et l'avitaillement ; en
coop, l'ouverture en cours, l'échec, le hors réseau, le salon vu d'un invité, l'hôte déconnecté ; à l'éditeur, le
document « Narratif », les outils autres que « Sélection », la validation avec défauts ; au Compendium, l'atelier, la
recherche active, une table et son dé : liste complète des écrans au commentaire de #3935.

## Voyage (2026-11-17)

Suite de `ecrites/voyage.md` (et de `ecrites/lieu.md` pour l'arrivée) ; la carte du monde reste celle de
`exploration-et-recit`. Le combat naval et le dossier du navire prolongent l'écran de combat. Ce qui se joue vient
des livres : LDB 51 l.191-221, MSRC 7, MDG 12 à 15.

| État | Intention | Choix à valider |
|---|---|---|
| `evenement-de-route` | la péripétie dans un parchemin ferré sur le décor assombri, dé en sceau, choix en barres, exécutant désigné au bandeau | le jeu ne pose aucun choix ici : les trois choix et la désignation sont une proposition ; choix fermé d'exemple |
| `evenement-de-route-issue` | le résultat en une phrase sur l'image, le jet en pastille, son détail en billet | billet au-dessus de la carte du héros ; soutien du groupe raconté sans pastille |
| `arrivee` | l'écran du lieu, sa première ligne est le récit du trajet ; services sur leurs bâtiments, départs sous la carte | Sept Rayons n'a aucun service en donnée ; durées des départs en plaques ; bourses au bandeau |
| `voyage-fluvial` | le décor en plans, la barge, le Test de Navigation en pastille sur le barreur | vent du jour dans l'objet du temps ; qui tient la barre n'est pas choisi ici |
| `voyage-fluvial-peril` | le contenant d'événement, les deux choix que le jeu pose, leur prérequis écrit | libellés allongés en phrases ; état de la coque sur le choix qui la coûte ; pas de sceau du dé |
| `voyage-en-mer` | la cogue au centre, frise en milles, Tests d'équipage en pastilles par rôle | panneau « La cogue » ; pastille « Dossier du navire » ; sortie « Postes de bord » |
| `postes-de-bord` | les neuf rôles en postes posés sur le navire, un portrait par poste tenu | place de chaque poste ; rôles des marins sans portrait ; panneau « Le bord » ; libellé « Veille » |
| `dossier-du-navire` | la fiche lue en combat appliquée au navire : identité, profil, figure, sections | onglets ; Moral en barre d'or ; le dossier porte le nom du modèle |
| `combat-naval` | l'écran de combat inchangé, la grille sur l'eau, les navires en pièces du champ | plaques « Manœuvrer », « Bordée », « Attaque » ; mesure de la Coque ; cases dorées et rouges |

## Suite du combat (2026-11-17)

Aucune cible écrite : le contrat `combat.md` dit la bataille de masse hors de son périmètre. Onze états dans le
bandeau du jet de combat, trois sur l'écran de voyage. Ce qui se joue vient des livres : LDB 12, 14, 15, 17, 19, 46,
47, ADE II 08, MDG 13 et 14.

| État | Intention | Choix à valider |
|---|---|---|
| `surincantation` | le bandeau après le dé : le sort, les pas à répartir par axe, les cibles désignées | pas en losanges avec − et + ; axe « sans objet » grisé ; axe « Dégâts » de la règle révisée absent |
| `contre-sort-declaration`, `contre-sort` | deux temps : la déclaration avant les dés, puis le Test opposé tombé | « S'unir » fermée sans autre lanceur ; étiquette « Un seul Contre-sort par Round » ; geste « Déclarer » |
| `dissipation` | le Test étendu contre un sort qui dure, cumul des DR, le sort visible sur le champ | cumul en losanges ; le Dôme en exemple ; ruban « Dissipation » |
| `incantation-imparfaite` | le gabarit du coup critique : dés du jet, d100 de la table, texte du livre | « Malignité » lue comme les Influences malfaisantes ; ni Chance ni Résilience |
| `test-de-corruption` | avant le dé : l'exposition, la nature en deux cartes, ce que le Test décide | table des enjeux avant le dé ; sous-titres absents du jeu ; l'état montré en combat |
| `corruption-mutation` | le gabarit du coup critique : le d100 du tableau, la mutation, les Points perdus | « Je te renie ! » à côté de « Continuer » ; ruban « Mutation » |
| `maladresse` | le gabarit du coup critique : le double raté, le Tableau des Oups | titre « Oups ! » ; dés du tirage montrés, double rappelé en rubrique |
| `desengagement` | le choix dans le bandeau, trois cartes, la refusée en fer | raison du refus en billet au survol ; sous-titres des cartes ; « Lancer », « Annuler » |
| `sauvetage-par-le-destin` | le coup fatal arrête le jeu dans le bandeau, trois cartes, la réserve de Destin | un clic choisit, un second confirme ; « Accepter son sort » en lettres de cire |
| `relance-a-la-chance` | le jet après une relance, le premier dé rappelé barré, la Chance restante | réserve en médaillon à gauche des gestes ; une seule réserve montrée |
| `bataille-de-masse` | le champ sur le socle du voyage, les Scènes du Round posées, les Puissances en jauges | socle du voyage plutôt que champ tactique ; place des Scènes ; aucune sortie |
| `bataille-de-masse-test-de-puissance` | le Test spectaculaire tombé dans un parchemin au-dessus des héros | contenant en bas et non au centre ; ni Chance ni Résilience ; chiffres d'exemple |
| `course-poursuite-en-mer` | la traversée continue, le poursuivant dans le sillage, la Distance en frise | frise de Distance à la place du trajet ; repère « Départ · 50 » ; Bjorn en Mousse |

## Commerce (2026-11-17)

Cible écrite suivie : `ecrites/lieu.md` (halle, port, Marchandage dans le bandeau de jet du combat), sous les règles
de design du 2026-11-16. Ce qui se joue vient des livres : MSRC 13, MDG 15 l.321-436, LDB 59 l.43.

| État | Intention | Choix à valider |
|---|---|---|
| `halle-achat` | la page des services ouverte sur le marché, une offre par négociant, les porteurs au premier plan | offres en cartouches plutôt qu'en lignes ; rail des services ouvert ; billet de rumeur cloué |
| `halle-vente` | la même halle, les lots sur leurs porteurs, trois voies pour un lot | la vente lue sur les porteurs ; nombre visé de l'acheteur dit avant le jet ; deux états plutôt que deux onglets |
| `marchandage-avant-le-de` | le bandeau de jet à la place du bandeau des héros, la halle visible | enjeux affichés avant le dé ; seuil du négociant masqué ; « Soutien du groupe » en pastille |
| `marchandage` | le jet résolu, le prix avant et après, les suites en plaques | verdict au centre ; « Conclure » armée ; compte de la page mis à jour dès le verdict |
| `port` | le port est un lieu : services en cartouches sur le quai, le navire à l'amarre, départs en mer | état du navire lu sur le navire ; un seul cartouche déplié à la fois |
| `port-negoce` | le négoce de mer sur la page des services du port, la cale seul porteur | même mise en scène que la halle ; avantages de DR annoncés avant le jet ; rail propre au port |

## Hors partie et outils (2026-11-17)

Aucune cible écrite. Le contenu vient de `src/hote/salon.ts`, `src/hote/coop/salon.ts`, `src/noyau/sieges.ts`,
`src/hote/editeur.ts`, `src/hote/compendium.ts`.

| État | Intention | Choix à valider |
|---|---|---|
| `coop-ouvrir` | une tablée vide, rejoindre et héberger en deux feuillets | code en six cases ; geste refusé en fer avec sa raison |
| `coop-salon` | la tablée, un siège par joueur et ses héros, la page d'attribution | attribution lue deux fois ; un segment par siège ; rôle de Maître du Jeu sous les héros |
| `coop-la-main` | la halle vue du siège d'un invité, « La main est à l'hôte » | cartouche de la main sur tout écran joué à plusieurs ; nom du joueur sous chaque héros |
| `editeur-scene` | un plan de travail en trois colonnes : scènes et outils, plan, inspecteur | matières du jeu plutôt qu'outil neutre ; palette d'icônes libellées ; vue de dessus |
| `editeur-carte-du-monde` | le même plan de travail sur la carte, lieux et routes listés et choisis sur la carte | route éditée dans l'inspecteur du lieu ; sens d'une route en flèche |
| `compendium` | un registre relié, un signet par famille, la liste en feuillets, la fiche et ses renvois | liste paginée ; renvois tronqués avec leur reste ; « Modifier » visible à la consultation |

## Sources des propositions

Chaque proposition a sa source HTML, CSS et JS sous `propositions/sources/<famille>/`, polices communes sous
`propositions/sources/polices/` (OFL). Une image se refait depuis sa source, jamais à la main :
`node propositions/sources/rendre.mjs <chemin absolu du .html> <sortie.png> [échelle]`, Playwright résolu depuis le
script (il n'est pas une dépendance du dépôt : `npm i --no-save playwright`, ou dans le conteneur cloud un lien
`node_modules/playwright` vers `/opt/node-tools/node_modules/playwright`) (vue 1707 × 780, rapport des pièces qui
débordent ou se chevauchent). Rien ne se copie d'une famille à l'autre : une page lie par chemin relatif le socle
qu'elle prolonge, et une pièce neuve s'ajoute à ce socle plutôt que dans une page. Deux socles : le commun
(`lieux-et-nuit/commun.css`, `commun.js`, `bustes.js`), que lient `heros`, `exploration-et-recit`, `voyage`,
`commerce` et les écrans hors champ de `combat-suite` ; celui du combat (`combat/combat.css`, `socle.js`), que lient
`combat-suite` et le combat naval de `voyage`. `accueil-et-systeme`, que prolonge `outils`, garde sa propre feuille
commune. Deux socles de gestes se posent sur les trois, et aucune famille n'en recopie une pièce. La charte
(`gestes.css`, `gestes.js`, que toute page charge) : la croix qui ferme un panneau, la pastille de retour d'un lieu,
le réglage − +, la bulle de la raison d'un refus au survol, le médaillon de bourse qui dit qui paie (#3004). Le jet
(`combat/jet.css`, `jet.js`) : le bandeau du bas, ses camps et son verdict, le testeur et les réglages d'avant le dé,
les réserves du héros, les gestes d'avant et d'après le dé ouverts ou fermés selon la règle (LDB 17 l.23-24, l.68),
les dés réglables de la Résilience, le choix par carte.
