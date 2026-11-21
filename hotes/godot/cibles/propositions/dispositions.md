# Grammaire de disposition retenue

Arbitrage du 18/11/2026 des 25 incohérences du relevé `kit-commun/dispositions.md` (162 pages dessinées sur la toile
du dessin d'origine), porté le même jour à la vue du jeu, puis refait le 19/11/2026 en cadres fixes : « Rien de pire
que des boites qui bougent d un écran à l autre, ce n est pas acceptable » (fiche
`user-doctrine-boites-fixes-d-un-ecran-a-l-autre`).
Les pièces (tailles, teintes) sont celles de `kit.md`, en pixels logiques, sans facteur, et ne sont pas rediscutées ici.

## Vue de référence et ancrages

**Vue de référence : 1280 × 720 pixels logiques, rendue en 1920 × 1080 (× 1,5).** C'est la vue du jeu Godot, dont
toutes les tailles sont réglées pour 720 de haut. Toutes les valeurs de ce document sont en pixels logiques. Pages et
planches du kit se dessinent à cette base, sans facteur. Les décors restent peints sur la toile d'origine, que
`toile()` (`sources/lieux-et-nuit/commun.js`) rogne à la vue, centrée.

**La table des cadres est la référence.** Chaque cadre récurrent a un rôle (son `data-piece`) et ce rôle a UN
rectangle (x, y, largeur, hauteur), le même dans tous les états et sur tous les écrans : la table `CADRES` de
`sources/rendu.js`, seule copie des nombres. Une ligne de deux cotes place sans dimensionner (le grand titre libre).
Ce qui n'y figure pas suit ce qu'il désigne et porte `data-mobile` (« Mobiles » plus bas). Le relevé `bouge` de
`sources/rendre.mjs` compare chaque pièce fixe à sa ligne et signale toute pièce sans ligne.

**La grille intérieure.** L'intérieur d'un cadre récurrent a ses places, chacune (`data-place="<rôle>/<place>"`) à
UN rectangle dans le fond du cadre, le même dans tous les états et sur tous les écrans : la table `PLACES` de
`sources/rendu.js`, sœur de `CADRES`, seule copie des nombres. Ce qui manque à un état laisse sa place vide, rien ne
glisse ; le fond ne range rien d'autre, aucune règle de feuille propre à un état n'y redéfinit colonnes, marges ou
écarts. Les grilles de `PLACES` : la fenêtre du bas ; le socle (quatre cases égales du bandeau, `socle/case-*`, qu'il
y ait quatre héros ou moins ; à la barre de l'actif une place d'onglet par famille dans l'ordre Action, Situation,
Gestes, Rapides, de même largeur active ou non, trois places de plaque et cinq de geste) ; l'actif au pied de l'ordre
du tour (`ordre/actif`) ; les onglets des sections de la fiche, des dossiers et de la progression (cinq places, la
fiche du héros dans l'ordre Attaques, Compétences, Talents, Sorts, Possessions) et ceux du panneau de bord ; le pied de
l'identité qui progresse ; le pied du rail des services, sous le dernier service que la colonne peut porter, quel qu'en
soit le nombre, et au carnet les documents remis sous lui ; le carton d'un arrêt (vignette, titre, texte, choix ou paies et parts, geste) ; le camp d'un testeur dans la fenêtre
(portrait, identité, rangée des dés, issue). Le relevé `place` compare chaque place à sa ligne (depuis le fond que la ligne du cadre donne) ; le relevé
`habille` signale un fond qui sort de la boîte intérieure de son cadre, ou des clous, ferrures et ruban autres qu'au
premier état du même rôle. Le relevé `contenu` (`sources/contenus.mjs`) compare d'un état à l'autre du même gabarit
le rect de ce que chaque place porte, et classe chaque écart : **A** une boîte déplacée (son coin bouge, ou la taille
d'un contenu qui n'est pas un texte en ligne, ou le départ, les x ou les écarts des entrées d'une liste qui défile),
**B** la seule longueur d'un texte dont le coin reste fixe, **C** le seul nombre des entrées d'une liste qui défile.
Un A d'un gabarit pilote (`PILOTES` : `fenetre-du-bas`, `combat`) fait échouer le rendu, contre les autres écrans du gabarit
déjà rendus sous `RELEVE_CONTENUS=<dossier>` (un dossier neuf par passe) et les autres états de la même passe ; les
autres gabarits restent en rapport (`node sources/contenus.mjs <dossier>`, code 1 sur un A d'un pilote).

**Le contenu s'adapte au cadre, jamais l'inverse.** Aucun panneau ne prend la hauteur de son contenu, aucune fenêtre
ne change de hauteur selon ce qu'elle porte : ce qui ne tient pas défile ou passe en onglets ; seules la prose d'un
document et les cartes de choix se paginent, une liste d'entrées défile (« Débordement »). L'action principale se pose au pied fixe de son cadre, le contenu part du haut.

**Écran plus large ou plus haut que 16:9.** La hauteur logique reste 720 (ou la largeur 1280 si l'écran est plus
haut) et la vue s'étend dans l'autre sens. Aucune pièce ne grandit (`placeDe`, `rendu.js`) : une ligne centrée sur
l'axe de la vue reste centrée, les autres suivent le bord le plus proche de leur centre ; seul le décor prend la place
gagnée. La vue ne descend jamais sous 1280 × 720 logiques ; un écran plus petit la réduit d'un bloc.

**Quand la largeur manque**, dans cet ordre : une colonne de trop devient un onglet de sa voisine ; puis le détail
d'une ligne se pose par-dessus (aperçu, écran posé) au lieu d'occuper une colonne. Une pièce du kit ne rétrécit jamais
et rien ne défile de côté ; la carte de choix prend la largeur de son emplacement (`PLACES`).

## Les cadres, par rôle

Les rects sont ceux de `CADRES` ; cette table dit qui occupe chaque rôle.

| Rôle | Ce qui l'occupe |
|---|---|
| `socle` | le bas de l'écran : bandeau du groupe (quatre cases égales, `PLACES`, y compris sur les écrans de héros et les dossiers) ou barre de l'actif en combat |
| `fenetre` | la fenêtre du bas (jet, choix, consigne, dialogue, butin) : une seule hauteur, même x, même largeur et même bas que le socle, qu'elle remplace ; seul son haut est plus haut |
| `carton` | le carton d'un récit, d'un document, d'un arrêt de route ou d'un Test de Puissance, au-dessus du socle qui reste. Son bas est le haut de la fenêtre : 222 + 278 = 500. La grille de Fable donnait 328 de haut ; 278 est retenu pour qu'une fenêtre du bas qui s'ouvre sous un carton ne le couvre jamais |
| `issue` | la bannière d'issue d'un combat et son action |
| `retour`, `coins`, `action-de-coin` | le coin bas-gauche (retour et son libellé sur deux lignes), le coin bas-droit (journal et système hors combat), la pile d'action de coin |
| `cartouche`, `recit`, `colonne-gauche`, `note` | le titre d'un lieu (météo en troisième ligne), le récit dessous, ce que le lieu propose à gauche, le billet de rumeur |
| `hotes`, `hotes-en-deux`, `page`, `colonne-droite`, `vignette`, `colonne-droite-basse` | les hôtes d'une scène de commerce (devant une page ou une colonne), le panneau d'activité (grande page ou colonne), la colonne en deux étages |
| `ouvrir-1`, `ouvrir-2`, `journal`, `regard`, `gestes-du-groupe`, `frise` | les écrans à ouvrir, le journal (fil des évènements, hors combat et en combat), le regard et les gestes de l'exploration, la frise de la route |
| `carte-du-monde`, `carte-de-la-ville` | les cartes d'un lieu |
| `round`, `ordre`, `systeme`, `fin-du-tour`, `journal-entier` | la borne du round, l'ordre d'initiative (l'actif en bas), le système en combat, la fin du tour, le journal entier ouvert |
| `identite`, `profil`, `figure`, `sections`, `progression-gauche`, `progression-droite` | la fiche et les dossiers : identité, bande du profil (ou chemin de carrière), silhouette, sections ; les deux panneaux de la progression |
| `etapes`, `choix`, `detail`, `heros-neuf` | la création : frise des étapes, choix, détail, héros en création |
| `fermer`, `colonne-gestion`, `registre`, `signets`, `affaire`, `emplacements`, `avis`, `feuillets-de-seance`, `groupe-de-seance`, `campagnes`, `tablee`, `volet-droit` | les écrans de gestion : croix, panneau de commande, registre et ses signets, affaire du carnet, sauvegardes, fin de séance, nouvelle partie, coop |
| `titre-libre`, `entrees`, `outils`, `seance-du-chapitre` | l'ouverture : grand titre, colonne des entrées, outils de l'accueil, fin de séance d'un chapitre |
| `barre-d-outils`, `volets`, `plan`, `pied`, `inspecteur` | l'outil d'édition |
| `barre-du-compendium`, `liste-du-compendium`, `fiche-du-compendium`, `index-du-compendium` | la consultation : barre (16, 8, 1248 × 44), liste (16, 60, 300 × 644), fiche (328, 60, 936 × 644) ; l'Index posé par-dessus la liste et la fiche, sur leur rect commun (16, 60, 1248 × 644) |

## Débordement

Rien ne se tronque ; le relevé de `rendre.mjs` refuse le texte coupé (`coupe`, `rogne`), ce qui sort du fond d'un
cadre (`deborde`), une action principale cachée (`cache`) et une pièce du kit écrasée sous sa taille (`retrecit`).

- **Défilement** (`defile()`, `kit.md`) : une colonne, une page ou une liste trop longue défile dans son cadre, sans
  barre. La suite cachée s'annonce par un fondu au pied, ce qui a défilé par un fondu en tête. `au-pied` : le journal
  entier montre sa fin. Le défilement est vertical : rien ne déborde de côté, même dans ce qui défile.
- **Action principale visible.** Une plaque armée, ou l'étape en cours, se voit sans défiler : jamais sous le bord ni
  sous un fondu de ce qui défile : le défilement amène la dernière au-dessus du fondu du pied (`suites`, `gestes.js`) ;
  celles qui ne tiennent pas avec elle sortent au pied fixe du cadre.
- **Document paginé** (`defile(contenu, 'pages')`, `paginer()`) : la prose d'un document se lit par pages d'un nombre
  entier de lignes ; le folio du cadre dit « Page 1 sur N » à partir de deux pages.
- **Liste de cartes paginée par trois** (`cartesDu`, `rendu.js`) : jusqu'à trois cartes de choix côte à côte ; au-delà,
  une liste paginée par trois, à la page de la carte choisie, « 1-3 sur 5 ».
- **Le journal cède sa place à un mobile** : en combat, l'aperçu d'une cible ou la fiche d'un combattant prend le rect
  du journal, qui revient quand il se ferme (`CEDENT_LE_JOURNAL`) ; en exploration, le poste d'une chose signalée qui
  monte à sa hauteur se pose à gauche de lui. Le journal estompe ses lignes anciennes.

## Mobiles

Ce qui suit ce qu'il désigne porte `data-mobile` et `data-ancre` (`mobile(ancre)`, `gestes.js`), jamais une liste de
noms : `survol` (aperçu, bulle de refus), `scene` (marques, pastilles d'entité, chose signalée, postes, voyageurs),
`ancre` (liste déroulée, fiche d'un combattant). Un mobile n'a pas de ligne dans `CADRES` ; tout autre `data-piece` en a
une. Un aperçu (`survol`) se pose par-dessus le cadre de ce qu'il désigne : `croise` ne le compte pas, `recouvert` et
`chevauche` le gardent. Une surcouche (`data-surcouche`, l'Index du Compendium) a sa ligne dans `CADRES` et se pose
par-dessus d'autres cadres, qu'elle voile : `croise` ne la compte pas, ce qu'elle cache n'est ni `recouvert` ni
`chevauche`.

## Bulle de refus

La raison d'un refus se lit au survol de l'élément fermé (`raison()`, `poserLesBulles`, `gestes.js`). La bulle reste
dans son cadre (dans la vue hors cadre) et ne couvre aucun texte, pas même le libellé de l'élément refusé, ni d'abord
un autre contrôle : au-dessus de lui, centrée, puis alignée sur son bord droit ou gauche, décalée pour rester dans le
cadre ; sinon dessous. Quand rien n'est libre, la raison prend la place de la ligne secondaire de l'élément refusé
(`data-secondaire`) au lieu d'une bulle ; sans ligne secondaire, la bulle peut couvrir un contrôle, jamais un texte.
L'élément survolé est en vue : ce qui le fait défiler l'y amène.

## Les règles qui valent pour toute l'application

| Rôle | Règle |
|---|---|
| **Croix** | rôle `fermer`. Deux raisons d'écran : une barre occupe le haut (création, éditeur) → la croix est dans la barre ; en combat le coin est pris par le système → la croix passe dessous |
| **Retour** | rôle `retour` : quitter un lieu ou changer de vue du lieu ; son libellé au-dessus de la pastille, aligné à gauche. Ce coin ne porte rien d'autre |
| **Pastille du système** | hors combat dans `coins`, sous le journal ; en combat rôle `systeme`, parce que le bas-droit est la fin du tour |
| **Action qui fait avancer** | toujours la première de sa rangée (à gauche, ou au-dessus si les plaques sont empilées) ; ce qui annule ou revient en arrière vient en dernier |
| **Ruban d'un cadre** | à cheval sur le bord haut, 9 px au-dessus, centré sur le cadre |
| **Aperçu au survol** | une seule largeur : 300 px ; à côté de l'élément survolé, sa pointe vers lui ; décalé seulement pour rester dans l'écran |
| **Sections** | jusqu'à 6 : onglets horizontaux à cheval sur le bord haut du panneau ; au-delà : signets au bord droit du registre (rôle `signets`) |
| **Action de coin** (elle concerne tout l'écran) | rôle `action-de-coin` : pile de plaques ; la principale au-dessus, la secondaire dessous |

## Par type d'écran

**1. Écran d'ouverture** (accueil, menu de la partie, ouverture et fin de chapitre) : `titre-libre`, `entrees` (la
principale en tête) ; aux chapitres « Continuer » au-dessus de « Plus tard » en `action-de-coin` ; le groupe au
`socle` ; à l'accueil les `outils`, « Options » au bout ; au menu le système dans `coins`.

**2. Écran de gestion** (options, sauvegardes, nouvelle partie, fin de séance, salon en ligne, carnet) :
`cartouche`, `fermer`, pas de retour ni de pastille du système ; le panneau de commande en `colonne-gestion` ; le
registre et ses `signets`, ses lignes défilent ; l'action principale au pied de l'objet qu'elle concerne, ou en
`action-de-coin` si elle concerne tout l'écran. Le détail d'une sauvegarde choisie se pose par-dessus le registre.

**3. Fiche** (fiche du héros, progression, création, dossiers) : `identite`, `profil`, puis `figure` et `sections`, ou
les deux panneaux de la progression ; le groupe réduit au `socle` (une case par héros autre que celui de la fiche) ;
`fermer`, le système dans `coins`. La création : `etapes` (la croix dedans), `choix`, `detail`, `heros-neuf`, avec
« Suivant » au-dessus de « Précédent » au pied du héros. Un panneau de section montre deux colonnes au plus : une
troisième devient un onglet de plus. La fiche d'un combattant reste un mobile réduit, pour laisser voir l'ordre
d'initiative.

**4. Lieu et voyage** : `cartouche`, `recit`, ce que le lieu propose en `colonne-gauche` ; le panneau d'activité au
coin haut-droit (`page` ou `colonne-droite`), son action au pied ; les écrans à ouvrir (`ouvrir-1`, `ouvrir-2`) ; le
groupe au `socle` ; le `retour` dès qu'on peut partir sans rien résoudre ; le `journal` à droite. Le panneau d'activité
et le journal ne se montrent pas ensemble là où ils partagent la colonne de droite. C'est le décor qui paie la place.

**5. Combat** : `round`, `ordre` (l'actif en bas, le haut replié), `systeme`, `journal` avec son rond, la barre de
l'actif au `socle` (valeurs à gauche, portrait au centre, actions à droite, une famille par onglet), `fin-du-tour`.
Le journal passe par-dessus le champ, sans fond plein.

**6. Fenêtre du bas** (jets et choix) : rôle `fenetre`, une seule hauteur ; ruban gothique centré ; ses places
(`PLACES`) : `gauche` le héros concerné (portrait `grand`, nom à sa droite) ou le titre d'un choix, aligné à droite
contre ses cartes, `centre` ; un jet tombé, quelle que soit sa situation, a un seul centre (`verdict`) piloté par la sorte
du Test (`simple`, `oppose`, `etendu`) : le cadre du centre et cinq places fixes, `issue-sous` (ce sur quoi il porte),
`issue-mot` (la grande ligne, Réussite, Échec ou Critique, du point de vue de celui qui agit), `issue-consequences`
(une pièce par conséquence, vide quand le jet n'en porte pas), `issue-dr` (le DR, le DR net d'un Test opposé, le cumul
d'un Test étendu sur le DR visé) et `issue-phrase` (deux lignes), les mêmes rects à chaque état ; `droite` suit la
sorte du Test : l'adversaire en miroir pour un Test opposé, l'interlocuteur ou ce que le Test décide (`enjeu`) pour un
Test simple ou étendu quand la donnée le porte ; avant le dé, tout jet a de même un seul centre (`reglage`), le même
cadre et ses places fixes `reglage-*`, vides quand la nature manque : `sous` (au rect de `issue-sous`), `mot` (la sorte
du Test et sa difficulté, 22 de haut), `figure` (la silhouette, colonne réservée), `ligne-1` à `ligne-3` (280 de
large, à côté de la figure), `carte-1` à `carte-4` (deux par bande, sur la largeur du centre), `cumul` et `phrase` (aux
rects de `issue-dr` et `issue-phrase`) ; trois emplacements de carte de même largeur (`carte-1` à `carte-3`), chacun sous sa ligne de rubrique
(`rubrique-1` à `rubrique-3`), une carte seule dans le premier ; `cible`, ce que le choix vise, à la place du
troisième emplacement, son portrait où se tient celui de l'autre camp ; `large`, à la place du centre, de la droite et
des emplacements : la liste paginée par trois, le partage d'une fouille, la table tirée et la table de Tests, dont la
tête reste et les lignes défilent ; au pied, `gestes`, la rangée, avec `reserve` à gauche (la réserve dépensée), les
`plaques`, la principale en premier, et `testeurs` au bout (le testeur à désigner avant le dé, à la place des deux
dernières plaques). Tout camp, testeur ou non (cible, lanceur visé, interlocuteur, touché), dans `gauche` ou `droite` (hautes de 124), a ses places, en miroir à droite
(`gauche-*`, `droite-*`) : `portrait` (`grand`), `identite` (le nom seul sur sa ligne, le Test borné à deux
lignes, `data-texte` au relevé `coupe`), `des` (une jauge, une réplique, la silhouette touchée hors dé ; le seuil dans une case de 52, deux dés et le sceau `grand`, à un y fixe
quelle que soit la longueur du Test et à un x fixe quel que soit le seuil ; l'état du sceau double le verdict) et `issue` (le verdict écrit et le DR, sur une ligne de sa couleur, du pied du portrait sur la largeur du camp, à 10 px
au-dessus de la rangée des gestes) ; un dé qui se règle porte son − et son + dessous. Les influences du jet
(modificateurs) ne s'écrivent pas : le seuil survolé les montre dans la bulle à pointe, une ligne chacune. Les réserves de `reserve` : un jeton par réserve, son pictogramme et son disque, son
nom et sa valeur au survol. La fenêtre remplace le socle. Ce qui ne tient pas suit « Débordement » (liste paginée par trois,
défilement).

**7. Récit, document et issue** : `carton` (son action centrée au pied, la prose d'un document paginée) ; `issue` pour
la bannière d'un combat, action unique dessous, sans socle ; ce que l'issue rend se lit ensuite dans la fenêtre du bas.
Une issue qui porte un texte (bataille de masse) reste un carton.

**8. Outil d'édition** : `barre-d-outils` (« Tester la scène » en dernier, contre la croix), `volets` en une colonne à
onglets, `plan` et son `pied`, `inspecteur` ; les actions de la barre qui ne tiennent plus perdent leur libellé et
gardent leur pictogramme.

**9. Consultation** (le Compendium) : un plein écran à part, trois cadres fixes d'un état à l'autre. La
`barre-du-compendium` : le titre, retour et suivant (les fiches vues), une seule recherche, dans tout le Compendium, le
fil famille › catégorie › entrée (chaque maillon ouvre l'Index à son niveau), la bascule « Atelier », éteinte par
défaut, la croix au bout, seule de l'écran. La `liste-du-compendium` : la tête (la catégorie et son compte, qui ouvre
l'Index), le filtre de livre (les deux livres les plus fournis, les autres derrière leur nombre), les rangées de 23 px
qui défilent, chacune sa source à droite, des séparateurs de groupe, le rail de lettres au bord droit ; la recherche y
pose ses résultats, groupés par catégorie avec leur compte. La `fiche-du-compendium`, objet de l'écran (65 % de la
vue) : la tête (nom, genre, source, « Épingler pour comparer ») ; le corps à gauche (puces, prose) ; tous les renvois à
droite, un onglet par groupe avec son compte, la colonne défile, jamais « et N autres » ; le renvoi survolé ouvre son
aperçu. « Modifier » et « Nouvelle entrée » n'existent qu'en mode Atelier ; l'atelier garde les rects : les champs à
la place du corps, la description sur la hauteur qui reste, à droite les désignations qui ferment « Supprimer ».
L'`index-du-compendium`, surcouche : les familles et leur nombre de catégories, celles de l'ouverte sur trois
colonnes, sous-groupes en intertitres, compte par ligne. Pas de cartouche, de panneau de commande, de registre ni de
signets.

## Les 25 arbitrages

1. **Pastille du système.** Deux places, une seule frontière : en combat (tour de jeu, fenêtres posées sur le combat,
   fiche d'un combattant, fins de combat), haut à droite ; partout ailleurs, coin bas-droit (30 / 23) avec le journal
   au-dessus. *Changent :* dialogue, jet de compétence, dossiers du navire, de la bête et du véhicule (système en bas,
   journal ajouté) ; test de corruption (suit le décor sur lequel il tombe) ; marchandage (le journal revient) ;
   nouvelle partie (pastille retirée : un écran de gestion a déjà la croix). *Raison :* en combat le bas-droit est la
   fin du tour ; aucune autre raison ne justifie de la déplacer.
2. **Croix.** 22 / 18 du coin haut-droit partout, 44 px. Dans une barre : centrée en hauteur, à 25 px du bout droit de la barre.
   Une seule croix par écran (relevé `croix`, `rendre.mjs`) : le détail qui est l'objet de l'écran n'a pas la sienne.
   En combat : 22 / 76. *Changent :* options et compendium (5 pages, de 14 / 8 à 22 / 18) ; dossiers (4 pages,
   la croix remonte à 22 / 18 puisque le système descend) ; éditeur (4 pages, croix de 38 → 44 px, 37 / 19).
   La création garde 51 / 27. *Raison :* même geste, même endroit ; les deux exceptions ont une raison d'écran.
3. **Fiche du héros : croix.** La fiche, la progression, la création et les dossiers ferment par la croix ; le
   bas-gauche reste vide. *Change :* rien. *Raison :* une fiche est un écran posé par-dessus le jeu, pas un lieu qu'on
   quitte ; la création jugée ferme déjà par la croix.
4. **Le groupe sous une fenêtre du bas.** Hors combat, la fenêtre remplace le bandeau : le groupe disparaît, le héros
   concerné est dans la fenêtre, à gauche ; s'il faut choisir un héros, c'est la fenêtre « désignation d'un héros ».
   Un cadre qui doit laisser le bandeau visible est un carton (type 7), posé au-dessus. *Changent :* dialogue et jet de
   compétence (la colonne du groupe à gauche disparaît). Bataille de masse (issue, test de puissance) : inchangées,
   rangées parmi les cartons. *Raison :* la colonne à gauche est le signe du combat.
5. **« Continuer » sur un écran de passage.** Action de coin : pile de plaques larges de 136 à 24 / 28 du coin
   bas-droit, « Continuer » au-dessus, « Plus tard » dessous (une rangée ne tient pas à droite du bandeau de 960). *Changent :* fin de chapitre et fin de séance (de bas-gauche à bas-droite).
   *Raison :* le bas-gauche est le retour ; on avance vers la droite, comme la fin du tour.
6. **Action sous des cartes de choix.** Centrée, 22 px du bas du cadre. *Changent :* relâche en mer, conseil de bord,
   péril fluvial (plaque recentrée) ; document lu et relu (« Replier » centré au pied du bandeau). *Raison :* 60 pages
   le font déjà.
7. **Panneau d'activité.** À droite. À gauche sous le cartouche ne reste que ce que le lieu propose : menu des
   services et offre de l'hôte (les plaques à prix de l'aubergiste). *Changent :* nuit à l'auberge (le réglage de la
   nuit et « Passer la nuit » passent à droite, comme au bivouac), interlude en ville, carte du monde (2 pages),
   préparation de la bataille. *Raison :* à gauche on lit le lieu, à droite on agit.
8. **Action au pied du panneau.** Toujours, au pied fixe du cadre du panneau, le contenu en haut (le 19/11, les
   cadres fixes remplacent la hauteur de contenu retenue le 18/11). *Changent :* soins entre héros, jeux de taverne, médecin, carte du monde ; départ de nuit (« Attendre l'aube »
   revient au pied du panneau). *Raison :* un bouton ne flotte pas au milieu d'un parchemin vide.
9. **Ouvrir la carte du monde.** Pastille « ouvrir » de 44 px au bord droit, comme au port. En exploration, sans
   panneau à droite, elle est à 20 px du haut. « Le lieu », qui ramène à la vue du lieu, devient le retour (30 / 34 du coin
   bas-gauche) ; la colonne de gestes s'arrête 8 px au-dessus de son libellé. *Changent :* les 4 pages d'exploration.
   *Raison :* le bas-gauche ne doit jamais ouvrir autre chose qu'une sortie.
10. **Ruban.** À cheval, 9 px au-dessus du bord, partout, fenêtre du bas comprise. *Changent :* les 19 pages
    d'ouverture, de gestion et de l'éditeur (34 rubans remontent de 9 px), dont salon en ligne et éditeur qui mêlaient
    les deux. *Raison :* c'est une erreur de montage, pas un choix.
11. **Journal et chronique.** Un seul nom, « Journal », un seul rect (rôle `journal`), au bord droit, qui ne suit plus
    le cadre du bas. Hors combat il se déplie par la pastille du journal, juste dessous ; en combat par le rond au-dessus du fil.
    *Changent :* les 4 pages d'exploration (« Chronique » renommée, 30 px plus étroite et recalée). *Raison :* même
    rôle, même colonne.
12. **Cartouche des options.** 24 / 20 du coin haut-gauche, hauteur 96, comme les autres ; le panneau
    de gauche descend à 20 px sous le cartouche ; le registre ne bouge pas. *Changent :* options (3 pages). *Raison :* rien ne saute en
    passant de « Sauvegardes » à « Options ».
13. **Fenêtre du bas.** Centrée, largeur 960, même bas que le socle, une seule hauteur (rôle `fenetre`, choix du
    19/11 : « Bandeau 152 + fenêtre 212 ») : consigne, liste et dialogue y tiennent, ce qui déborde suit « Débordement ».
    La barre de combat prend le même axe et la même largeur. *Changent :* les 60 pages (recentrées, ramenées de 1180 à
    960). *Raison :* la fenêtre remplace le bandeau sans que les bords bougent.
14. **Héros dans une fenêtre de choix.** Comme dans un jet : portrait 74 × 92 à 29 / 31 du coin haut-gauche de la fenêtre, nom à sa droite, puis le
    filet, puis les cartes centrées dans la place restante. *Changent :* sommation, sauvetage par le destin, entrée de
    dissipation, mutation de corruption, tribut (portrait recalé) ; détermination, désengagement (portrait ajouté).
    *Raison :* on reconnaît d'abord qui choisit.
15. **Réserve dépensée.** À gauche de la rangée d'actions. *Changent :* mutation de corruption, sauvetage par le
    destin. *Raison :* 37 pages ; la réserve se lit à côté du bouton qui la dépense.
16. **Ordre des actions.** La principale en premier : à gauche dans une rangée, au-dessus dans une pile.
    *Changent :* test de puissance (« Round suivant » avant « Rassemblement ») ; bataille de masse et postes de
    bataille (la principale passe au-dessus de « Tirer un facteur »). La création est déjà conforme (« Suivant »
    au-dessus de « Précédent »). Seul l'éditeur met la principale en dernier. *Raison :* une seule lecture.
17. **Camps.** Le héros à gauche, l'autre à droite, toujours. *Changent :* coup critique (le héros qui frappe à
    gauche, l'Orc touché et son jet à droite) ; dialogue (l'interlocuteur à droite, les réponses du héros à gauche).
    *Raison :* le dialogue et le jet qui le suit montrent le même face-à-face.
18. **Récit sous le cartouche.** 20 px sous le cartouche, 32 px du bord gauche, largeur 340 ; 8 px plus bas sous un
    cartouche à météo. *Changent :* voyage en mer, voyage fluvial, poursuites, évènement de route, bataille.
    *Raison :* le texte ne bouge pas en passant de l'arrivée au port.
19. **Gabarit de fiche.** Les dossiers (navire, cargaison, bête, véhicule) prennent le gabarit de la fiche du héros :
    toute la largeur, identité à 26 / 20 du coin haut-gauche, large de 340, portrait 136 × 168. Seule la fiche d'un combattant reste réduite et
    décalée, pour laisser voir l'ordre d'initiative. *Changent :* les 4 dossiers. *Raison :* un dossier est la fiche
    d'un navire ou d'une bête.
20. **Création : le héros à droite.** Gardé. *Change :* rien. *Raison :* la création se lit de gauche à droite (choix,
    détail, résultat) ; le héros en cours est le résultat, avec « Suivant » à son pied.
21. **Onglets ou signets.** Les deux, selon le nombre, pour une hiérarchie à un seul niveau : jusqu'à 6 sections,
    onglets horizontaux ; au-delà, signets verticaux au bord droit. Une hiérarchie à deux niveaux ou plus (les 7
    familles et 140 catégories du Compendium) passe par un index posé par-dessus (type 9). *Change :* le Compendium.
    *Raison :* treize catégories ne tiennent pas sur une rangée ; le second niveau d'une hiérarchie n'a pas de cadre
    dans les signets.
22. **Bandeau à l'ouverture de chapitre.** Centré, 960 × 152, à 8 px du bas. *Change :* ouverture de chapitre. *Raison :* il ne
    bouge pas quand le chapitre s'ouvre sur le premier lieu.
23. **Aperçu au survol.** 300 px de large, la hauteur suit le texte. *Changent :* exploration (236), cible au combat
    (286), fiche d'un sort (322). *Raison :* une largeur pour un rôle.
24. **Quitter un écran de route.** Retour à 30 / 34 du coin bas-gauche partout où l'on peut partir sans rien résoudre. *Changent :*
    voyage en mer et voyage fluvial (« Faire halte »), bivouac, activités en mer, postes de bord (un retour vers la
    route ou la traversée). Poursuites et bataille de masse : pas de retour, on n'en sort que par leur issue.
    *Raison :* la maquette de voyage jugée le montre déjà.
25. **Sortir par une plaque.** Une plaque « Quitter » n'est permise que si elle quitte un état et non un écran : un
    poste de tir, un salon en ligne. Elle est la dernière de son groupe d'actions. *Change :* pièce de bord (« Quitter
    la pièce » passe du bloc de gauche au groupe des actions, à droite, en dernier). Salon en ligne : inchangé.
    *Raison :* ce sont des actions du jeu ; la croix et le retour ferment des écrans.

## S'écarte d'une maquette jugée

Les maquettes jugées sont dessinées sur la toile d'origine : toutes se recomposent en 1280 × 720 par la table des
cadres (cadres du bas à 960, décor plus étroit). Les écarts ci-dessous sont ceux qui restent, mesurés depuis le bord
ou le coin d'ancrage de chaque pièce.

- **Fiche du héros** (`fiche-du-heros.jpg`) : le retour « Fermer » en bas à gauche est remplacé par la croix en haut à
  droite (arbitrage 3). C'est le seul écart de fond.
- **Options** (`options.png`, `options-chance.png`, `options-verrou.png`) : la croix descend de 10 px et recule de
  8 px ; le cartouche descend de 6 px et gagne 6 px de haut ; le panneau « Préférences » descend de 12 px ; son ruban
  remonte de 9 px (arbitrages 2, 12, 10).
- **Fiche du héros**, encore : l'identité passe de 400 à 340 de large.
- **Voyage** (`voyage-image-cible.jpg`) : le récit passe de 400 à 340 de large ; le récit de la route, en bas à gauche au-dessus de la frise sur la maquette,
  passe sous le cartouche (arbitrage 18) ; l'aperçu du test, d'environ 250 px, passe à 300 (arbitrage 23).
- **Jet d'attaque** (`attaque-jet-tombe.png`) et **barre de l'actif** (`combat-barre-de-l-actif.png`) : la fenêtre et
  la barre passent de 1180 à 960 de large, centrées ; les actions de la barre se rangent en onglets ; le ruban remonte de 3 px (arbitrages 13, 10).

Conformes, sans écart : accueil, création (croix dans la frise, héros à droite, « Suivant » au-dessus de
« Précédent »), lieu, auberge (l'offre de l'aubergiste reste à gauche), échoppe.
