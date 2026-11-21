# Propositions : combat (2026-11-16, #3935)

Compte rendu des trente et un états dessinés (onze le 2026-11-16, vingt écrans neufs le 2026-11-17, #4411) depuis la cible écrite `../ecrites/combat.md`, le contrat `../combat.md` et les
maquettes validées (`../maquettes/`). Sources au dépôt : un écran par fichier de `sources/maquettes/`, la liste de ses
états, chacun une donnée écrite au format de `sources/maquettes/maquette.ts`, dessinée par
`sources/rendu.html` (`node sources/rendre.mjs <écran> <sortie.png> --format 16:9 [--etat <état>]`) : `jet-avant-le-de`,
`defense`, `jet-d-attaque`, `coup-critique`, `debut-du-round`, `determination`, `fin-du-combat` (dont `fin-victoire`,
la bannière d'issue et la fenêtre du butin) et `tour-de-combat`, premières maquettes du tour de l'actif : la barre de
l'actif (960 × 138, centrée, à 8 du bas : Blessures, Mouvement, Action, Avantage, Détermination, États ; le portrait
au centre ; les actions rangées par familles en onglets, « Action », « Situation », « Gestes », « Rapides ») et ses
états `combat-rapides`, `combat-liste`, `cible-survolee`, `tour-adverse`, `journal-ouvert`, `fiche-au-clic`,
`meuble-engage-a-terre`, `meuble-tireur`, `meuble-chef-de-piece`, `cible-montee`, `visee-de-siege`.
`sources/combat/` garde les socles de la cour (`cour.js`, `socle.js`, `jet.js` et leurs feuilles).
Rien n'est validé : chaque « choix à valider » attend l'utilisateur.

Textes repris du jeu : libellés de `src/i18n/messages/fr.ts` (« Localisation », « Au hasard », « Retenir ses coups »,
« Début du round », « Agir en premier », « Commencer le round », « Incantation », « Victoire », « Défaite », les six
localisations) ; critique « Coup percutant » verbatim de `src/data/criticals.json` ; malus de visée −20 (LDB 14 l.73,
`src/engine/combat.ts:1047`).

## Bandeau du jet : réserves et issue du camp (#4411)
- Fiches `user-doctrine-icone-identifie-survol-detaille` et `user-doctrine-boites-fixes-d-un-ecran-a-l-autre`.
- À valider : chaque réserve, un jeton dans une case de largeur fixe, son pictogramme à gauche du disque, sans nom
  écrit ; le nom et la valeur (« Chance : 3 ») dans la bulle du jeton survolé (`reserves`, `sources/combat/jet.js`).
  Pictogrammes (`PICTO_DE_LA_RESERVE`, `sources/rendu.js`) : Chance `etoile`, Résilience `coeur`, Détermination
  `poing` (un poing fermé, quatre jointures et le pouce replié, qui ne se lit plus en main ouverte à 20 px), Destin
  `noeud` (le nœud du fil du destin : le sablier se confondait à 20 px avec le `fin` de la fin du tour ; `roue` et
  `couronne` sont déjà la diligence et les Courtisans),
  Expérience `livre` (ce qui s'est appris ; aucun pictogramme de progression au kit). La Chance au pied d'un billet de jet : l'étoile une fois, puis un
  jeton par lanceur, identifié par son portrait `menu`.
- À valider : l'issue du camp est le verdict écrit suivi du DR, sur une ligne, de la couleur du verdict (« Réussite
  DR +2 » vert, « Échec DR −3 » rouge sang, « Critique DR +5 » vert, le mot sur une marque d'or), du pied du portrait sur
  la largeur du camp (place `issue`, 272 de large), à 10 px de la rangée des réserves (`camp`, `sources/combat/jet.js`).
  Le sceau du total garde son état (vert la réussite, cerclé d'or le critique, rouge l'échec), mais la couleur seule ne
  dit pas le verdict : le mot s'écrit, aucune bulle au survol du sceau. Le cercle d'or du critique est neuf et épais de
  3 px pour se voir à la taille de jeu (`.sceau.critique`, `sources/gestes.css`).
- À valider : un seul gabarit de centre pour tout jet tombé, quelle que soit la situation (verbatims du 2026-11-20 :
  « Marchandage c'est un jet simple et/ou d'opposition, pourquoi il a un comportement différent ? » ; « -10%, 3
  corruptions, touché, brisée, ect ... c'est des conséquences du jet, qui sont même sensé etre data driven » ;
  « l'élément central doit indiquer l'echec ou la réussite »). La donnée est celle que le noyau devra projeter (#4574,
  `IssueDuJet`, `sources/maquettes/maquette.ts`) : la sorte du Test (`simple`, `oppose`, `etendu`), le verdict en union
  fermée (`reussite`, `echec`, `critique`), le DR, le DR net d'un Test opposé, le cumul d'un Test étendu sur le DR visé,
  la liste des conséquences `{ genre, valeur?, cible?, icone?, ton?, detail? }`, la phrase d'issue. Cinq places fixes
  (`PLACES_DE_L_ISSUE`, `sources/rendu.js`), les mêmes rects à chaque état : le sous-titre (14), la grande ligne (38),
  la ligne des conséquences (22, vide quand le jet n'en porte pas), le DR (14), la phrase (34, deux lignes).
- À valider : la grande ligne ne porte qu'un mot générique, Réussite, Échec ou Critique, de la couleur de l'issue (vert
  la réussite, rouge sang l'échec, marque d'or le critique) ; un Test opposé se lit du point de vue de celui qui agit
  (la Défense de Berta tombe en « Échec » quand l'Orc la touche). Les mots par situation du lot précédent (« Touche »,
  « Manquée », « Parée », « Touché », « Contré », « Lancé », « Gagné ») disparaissent : ce qu'ils disaient devient une
  conséquence. « Pour fuite je prefere "Echec" » (utilisateur, 2026-11-20) en est un cas.
- À valider : les conséquences, une pièce chacune (`consequences`, `sources/combat/jet.js`) : le pictogramme et la
  valeur signée, de la couleur de son ton pour celui qui agit (vert le gain, rouge sang la perte) ; le nom, la cible et
  le détail au survol, dans la bulle (fiche `user-doctrine-icone-identifie-survol-detaille`). Un genre sans pictogramme
  écrit son nom dans un filet pointillé, la pièce marquée `data-sans-icone` : « Car si un jour la fuite donne des etats
  données sonnées et brisé on aura l'air con » (utilisateur, 2026-11-20). Les conséquences des maquettes :

  | Jet | Sorte | Verdict | Conséquences |
  |---|---|---|---|
  | Attaque (`combat-jet-d-attaque`, `relance-*`) | opposé (LDB 13 l.122-123) | Réussite / Échec | `localisation` Corps sur l'Orc ; raté, `avantage` +1 à l'Orc |
  | Défense (`jet-de-defense`) | opposé | Échec | `localisation` Bras droit sur Ilyanwe |
  | Contre-sort (`contre-sort`) | opposé (LDB 46 l.156) | Réussite | `dissipation` du Sort de la Chamane |
  | Fuite (`fuite`, Test de Calme) | simple (LDB 15 l.63-68) | Échec | `etat` Brisé +3 sur Ilyanwe |
  | Corruption (`test-de-corruption-*`) | simple (LDB 19 l.44-54) | Échec / Réussite | `corruption` +2 sur Berta ; aucune à la Résilience |
  | Marchandage (`marchandage`) | opposé (LDB 59 l.43) | Réussite | `prix` −10 %, le prix conclu au survol |
  | Incantation (`incantation`) | simple (LDB 46 l.24) | Réussite | `sort` lancé sur l'Orc |
  | Dissipation, Focalisation | étendu (LDB 46 l.160, LDB 46 l.128-151) | Réussite / Critique | aucune ; le cumul sur le DR visé |
  | Test de compétence, péripétie de la route | simple (LDB 12 l.5-7) | Réussite / Échec | aucune ; échec de la route : `retard` +1 j, `etat` Exténué +1 |

- À valider : les pictogrammes des conséquences (`PICTO_DE_LA_CONSEQUENCE`, `sources/rendu.js`), pris au kit :
  `localisation` → `cible` (le point visé) ; `avantage` → `competence` (celui de l'action « Avantage » de la barre,
  `PICTO_DE_L_ACTION`) ; `prix` → `pieces` (le montant ; `balance` dit le geste de marchander, `bourse` ce qu'on porte) ;
  `sort` → `sort` ; `retard` → `sablier`. Une conséquence peut nommer son pictogramme (`icone`), comme un État qui en a
  un (`aTerre`, `goutte` de l'Hémorragique). Manquent : `blessures` (`goutte` est déjà l'Hémorragique, `coeur` la
  Résilience), `corruption`, `dissipation`, et les États sans pictogramme, Brisé et Exténué compris.
- À valider : le DR net se signe du côté de celui qui agit (« DR net −4 » sous l'Échec de la Défense, « DR net −1 »
  sous l'attaque ratée), quand le livre le dit du vainqueur (LDB 12 l.164) : il dit l'écart sans relire les camps, et
  suit le verdict. Restent hors du gabarit, faute d'une issue d'un seul jet : la table de Tests (`tests`, une issue par
  ligne), le carton de la bataille de masse, le Coup Critique et la table tirée (un nom de table), l'annonce d'un
  choix, la nature d'une Influence, la Surincantation, la consigne et le dialogue.

## tour-adverse (A1, A2, T3)
- Le meuble garde sa place et montre l'adversaire : portrait de fer, nom, arme (« Hache »), Blessures.
- Plaques et fin du tour fermées.
- À valider : le meuble ne montre ni Mouvement, ni Action, ni Avantage ; emplacements rapides absents (ce sont ceux
  du héros) ; ruban « Action » grisé ; l'ordre montre l'Orc actif, la borne « Round 2 » puis deux fantômes ; aucune
  marque au sol pour l'adversaire, seulement son halo de camp.

## jet-avant-le-de (J9)
- Silhouette à six zones et « Au hasard », « Retenir ses coups » en bascule, dés posés sans face.
- À valider : une zone choisie (Tête, en laiton plein) plutôt que « Au hasard » ; malus en étiquette « −20 au Test »
  et seuil déjà corrigé ; « Au hasard » en petite plaque sombre ; bascule en interrupteur de fer à bouton de laiton ;
  sceau de résultat avant le dé en empreinte vide ; gestes « Lancer » (laiton plein, `verbe.lancer`), « Résilience »
  (LDB 17 l.68) et « Annuler » (`verbe.annuler`), réserves du héros à gauche (`sources/combat/jet.js`) ; centre
  élargi de 300 à 380 px, le bandeau ne bouge pas.

## jet-de-defense (J1 à J8)
- Ruban « Défense », camp du joueur à gauche.
- À valider : réussite en sceau de cire verte et verdict vert sombre (le kit ne fixait que la cire rouge de l'échec) ;
  DR net du côté du défenseur (« Bandeau du jet ») ; la localisation du coup reçu en conséquence (dé inversé 24 → 42,
  bras droit), sans dégâts.
- Le choix de la réaction avant le dé du défenseur (LDB 13 l.167) : `defense-avant-le-de`, plus bas.

## incantation (J10)
- Bandeau à un seul camp lanceur ; le centre porte le sort en gothique et « Sort · Niveau d'incantation 0 ».
- À valider : cible à droite sur les places du camp de droite (`fiche`, `sources/combat/jet.js`), le portrait au rect
  de celui de l'adversaire (« pourquoi les portrait a droite explosent en taille sans raison ? », utilisateur,
  2026-11-20), la jauge des Blessures à la rangée des dés ; seuil « Langue
  (Magick) ≤ 85 » d'exemple ; mêmes cinq gestes qu'à l'attaque.
- Jet réussi (34 sous 85) : « Relancer » et « Résilience » fermés, la raison en bulle au survol (LDB 17 l.23, l.68) ;
  « Chance : +1 DR » reste ouverte (LDB 17 l.24). 34 n'est pas un double : pas d'Incantation Critique à choisir
  dans cet état (LDB 46 l.26-32).
- À valider : la grande ligne dit « Réussite », le Sort lancé en conséquence, le Sort et son NI au sous-titre, le DR du
  jet en petit dessous (« Bandeau du jet »).

## coup-critique (C1, C2, C3)
- Le bandeau reste en place : à gauche la victime, sa silhouette, « Touché à la tête », sceau « 2 » Blessures
  perdues ; à droite le nom du Critique en gothique et le texte du livre en sérif droit ; un seul geste « Continuer ».
- La barre de l'Orc compte le coup et le Critique (LDB 14 l.3) : 9 / 14 dans l'ordre et sur le pion, soit
  10 dégâts − 7 (BE 4 + PA 3, `src/data/creatures.json`) = 3 Blessures, puis les 2 du Critique (LDB 18 l.65). Le
  journal dit le coup au format du jeu (`touche.chiffree`, `touche.critique`, `src/i18n/messages/fr.ts:103-105`).
- À valider : le DR net d'exemple du coup (+4, avec les Dégâts +6 du bâton) ; l'état montré est celui d'après
  l'application des deux pertes.

## debut-du-round (R1)
- Le choix dans le bandeau, carte puis plaque : « Agir en premier », une carte par héros offert, la choisie en
  laiton plein ; la plaque « Commencer le round » commet. « Agir en premier » est la rubrique de la première carte,
  avec ou sans la préemption du Tir rapide ; l'annonce dit « Round 2 · le round débute » dans les deux états.
- Berta seule est offerte : Ilyanwe est déjà en tête de l'ordre (`src/noyau/turnEconomy.ts:43`).
- La carte porte son coût, « 1 Chance » (LDB 17 l.25 ; une arme Rapide le rendrait gratuit, LDB 62 l.298-300,
  `turnEconomy.ts:61`) ; la Chance de Berta en médaillon à gauche de la plaque.
- Reste, hors maquette : le noyau dépense la Chance au clic de la carte (`src/noyau/combatSlice.ts:2160`), la
  maquette au clic de la plaque (transversal §6 n° 4) ; le Tir rapide (LDB 11 l.97-103) : `debut-du-round-tir-rapide`, plus bas.
- À valider : cartouche « Round 2 · le round débute » ; personne d'agrandi dans l'ordre ; fin du tour fermée ;
  aucune marque au sol.

## fin-victoire (F1)
- Le cartouche « Victoire » remonte ; le bandeau du bas, ruban « Butin », rend ce que porte `PendingVictory`
  (`src/noyau/pendings.ts:84-99`) : « Expérience » et « Argent » (`ecran.victoire.*`), les vaincus groupés, le butin
  ligne par ligne.
- Verbes : un portrait d'une ligne, `fenetreChoisir('victoire', 'ligne', …)` (« Attribuer », la ligne quitte la liste ;
  non attribuée, elle va au premier héros à la fermeture, `src/noyau/issueDeCombat.ts:47`) ; « Dépecer »,
  `fenetreChoisir('victoire', 'depecer', creatureId)` ; « Reprendre », `fenetreFermer('victoire')`.
- Réfs : dépeçage ZI 13 l.304-316, offert aux seules créatures à profil de récolte (`creaturesDeLaRecolte`,
  `src/noyau/combatEffects.ts:359`) : ni l'Orc ni le Gobelin n'en ont, d'où le Grand Loup de l'exemple.
- À valider : le cartouche reste centré au-dessus du bandeau (tension F1 inchangée) ; 20 PX, 14/6 et les trois objets
  sont des valeurs d'exemple (donnée de scène) ; « Reprendre » (charte) là où le jeu dit « Continuer »
  (`verbe.victoire.fermer`, `src/i18n/messages/fr.ts:352`) ; deux portraits par ligne plutôt que les colonnes de
  `exploration-et-recit/butin`.

## fin-defaite, fin-repli, fin-aneantissement (F2)
- Un cartouche par fenêtre du noyau, titre et bouton au libellé du jeu (`fenetre.*`, `verbe.*.fermer`,
  `src/i18n/messages/fr.ts:388-390`, `fr.ts:503-505`) : « Défaite » et « Reprendre » ; « Repoussés » et
  « Poursuivre la bataille » ; « Le groupe a péri » et « Retour au menu ».
- Verbes : `fenetreFermer('defaite')`, `fenetreFermer('repli')`, `fenetreFermer('aneantissement')`.
- Réfs : le repli est la défaite d'une Scène de combat de bataille de masse, la bataille continue (ADE II 08 l.175,
  l.223 ; `src/noyau/issueDeCombat.ts:71-84`) ; l'anéantissement ramène au menu (`issueDeCombat.ts:67`).
- À valider : la ligne de conséquence sous le cartouche (« Le combat est perdu, la compagnie reprend pied sur les
  lieux. », « Les héros sont soignés, la bataille continue. », « Aucun héros ne tient debout. ») est une phrase
  d'exemple, absente du jeu ; cartouche centré, comme `fin-defaite`.

## journal-ouvert (T19)
- Panneau de parchemin ouvert au-dessus de sa pastille, qui passe en laiton plein ; rangé par round, ruban
  « Journal ».
- À valider : les trois lignes sur la scène disparaissent tant qu'il est ouvert ; lignes d'exemple.

## fiche-au-clic (T21)
- Quatre panneaux entre l'ordre et le journal, au-dessus du meuble, repris de la maquette de fiche : identité, bande
  de profil, niche à figure, onglets ; champ assombri à 42 % ; la croix de laiton de la charte (`sources/gestes.js`) sous la pastille du système.
- À valider : la fiche ne prend pas tout l'écran, les ancrages restent visibles ; montrée sur Berta (un héros qui
  n'est pas l'actif) ; réserves sur une colonne ; chiffres en Open Sans SemiBold, ceux des disques en Grenze ; pas d'onglet « Sorts » (Berta n'est pas
  lanceuse).
- « M 2 » de la maquette de fiche contre 4 / 4 au meuble : sans objet. La fiche validée montre Ilyanwe À Terre
  (0 / 17), son Mouvement effectif est la moitié de 4 (`src/engine/encumbrance.ts:53-66`) ; debout, le meuble dit 4.

## cible-survolee (T14, T15, T16)
- Case cernée de cire rouge, infobulle de parchemin, zone atteignable à liseré, trajet en pointillé, socles de camp,
  barre de vie fine ; « Attaque » armée ; barre des six emplacements rapides validée.

# Écrans neufs (2026-11-17, #4411)

Vingt états, tous joués par Berta (Soldate, Épée et Bouclier ; Arbalète au second set) : sa fiche est celle de
`fiche-au-clic` (CC 41, Ag 34). Aucun verbe à créer : chaque geste dessiné a son verbe dans
`src/hote/verbes.generated.ts`. Socle étendu : `sources/combat/socle.js` (second rang de plaques du meuble, États
portés, pictogrammes) ; les états vivent dans `sources/combat/cour.js`.

## defense-avant-le-de, defense-riposte (écran 1)
- Bandeau « Défense » avant le dé du défenseur : le dé de l'Orc est tombé à droite (24 sous 35, DR +1) ; au centre la
  réaction en deux cartes à seuil (« Parade ≤ 41 », « Esquive ≤ 34 »), puis « Parer avec » et, selon l'arme qui pare,
  « Porte-bouclier (2 Av.) » (Aucun, Dégâts, Repousser) ou « Riposte » (Oui, Non).
- Verbes : `jetRegler('defense', 'reaction' | 'armeDeParade' | 'porteBouclier' | 'riposte', valeur)`, puis
  `jetLancer('defense')` ; « Résilience », `jetForcerLaReussite('defense')`. Pas d'« Annuler » : le flux n'en a pas.
- Réfs : LDB 13 l.167 (réaction), LDB 13 l.123, AA 13 l.76-84 (Porte-bouclier : bouclier, 2 Avantages, une fois par
  Round), LDB 10 l.1028-1037 (Riposte : arme Rapide) ; ce que le noyau offre : `src/noyau/fenetreDeDefense.ts:118-140` ;
  libellés `reglage.defense.*`, `defense.porteBouclier`, `defense.secondaire` (`src/i18n/messages/fr.ts:123-125`,
  `fr.ts:222-225`).
- À valider : deux images parce que le noyau n'offre jamais Porte-bouclier et Riposte ensemble (l'un veut un bouclier
  qui pare, l'autre une arme Rapide) ; la Rapière de `defense-riposte` est un exemple hors de la fiche de Berta ;
  colonnes inégales (330, centre, 384) pour loger le dé tombé de l'attaquant ; un réglage que le jet n'offre pas est
  absent, jamais grisé ; la substitution sociale : `defense-sociale`, plus bas. Réactions en cartes 1-2 (la
  sociale en carte 3), réglages en lignes 2-3 de la grille d'avant le dé (« Grille », plus haut, écran 4).

## meuble-engage-a-terre, meuble-tireur, meuble-chef-de-piece (écran 2)
- Le meuble garde ses trois plaques ; un second rang de plaques sans pictogramme n'existe que s'il porte une offre
  de la situation. Engagée et À Terre : « Se désengager », « Se relever », « Battement », « Distraire », « Frénésie ».
  Tireuse : « Viser », « Recharger » (fermée : aucune arme à recharger), pastille « Munition ». Chef de pièce :
  « Recharger », « Diriger l'équipe », et « Quitter la pièce » dans la niche du poste.
- Une offre fermée dit sa raison en bulle au survol : « Course », « ne peut que ramper : se relever d'abord »
  (`agate.prone`, `src/i18n/messages/fr.ts:4376`).
- États : sceaux de cire nommés, sous les mesures du meuble et sous la barre de vie des rangs de l'ordre, le cumul en
  chiffre (« Hémorragique 2 »). À Terre : Mouvement 2 / 2 et zone atteignable de deux cases (LDB 16 l.35).
- Offres portées par une entité du champ (`surface: 'pastille-entite'`, `src/data/actions.json`) : « Monter » sur le
  cheval, « Servir » puis « Pousser » sur la baliste.
- Verbes : `rompreLEngagement`, `seRelever`, `faireUnBattement`, `tenterDeDistraire`, `entrerEnFrenesie`,
  `prendreLaVisee`, `rechargerLArme`, `approvisionnerLArme`, `aiderLEquipe`, `quitterLePoste`, `monterEnSelle`,
  `servirLePoste`, `pousserLEngin` ; pastilles `gagnerLAvantage`, `utiliserLObjet`, `poserLObjet`,
  `prendreLaPanoplie` ; médaillon et État, `depenserLaDetermination`.
- Réfs : LDB 15 l.45-49, LDB 16 l.35, LDB 10 l.103, l.364, LDB 21 l.31, LDB 14 (Viser), LDB 13 l.106 et l'arbitrage
  #3595 (`docs/raw/4e/combat.md:262`) pour la pièce, MDG 09 l.44-46 (Commandant d'équipe) ; monter en selle au
  Mouvement : valeur maison (`actions.json`, `mise-en-selle`).
- À valider : pastilles réduites, libellé en ligne et non dessous, dans ces trois états seulement ; le médaillon de
  Détermination et la niche des États gagneraient tous les états « tour » une fois validés ; emplacements rapides
  tous libres (Berta ne lance pas de sort) ; les Talents de l'exemple (Battement, Distraire, Frénésie, Commandant
  d'équipe) ne sont pas à la fiche de Berta ; cheval et baliste dessinés pour l'image.

## determination, determination-etat (écran 3)
- Le médaillon de laiton du meuble ouvre le bandeau « Détermination » : trois cartes au libellé des offres
  (`determination-psychologie`, `determination-critique`, `determination-etat`, `src/data/actions.json`), leur durée
  dessous, la réserve à gauche, puis « Dépenser ». Un clic sur le sceau d'un État ouvre le même bandeau, la carte
  « Retirer un État » déjà choisie et le sceau cerné dans l'ordre.
- Verbes : `depenserLaDetermination(id, 'immuniserALaPsychologie' | 'ignorerLesCritiques')`,
  `depenserLaDetermination(id, 'retirerUnEtat', etat)`.
- Réfs : LDB 17 l.57-61 ; « +1 PB en se relevant » est `cs.fragGettingUp` (`src/i18n/messages/fr.ts:2087`).
- À valider : le noyau dépense au geste, l'hôte tient donc la carte choisie jusqu'à « Dépenser », et « Annuler »
  ferme sans rien dépenser ; un héros qui porte plusieurs États aurait une carte par État ; ruban « Détermination »
  (`verbe.depenserLaDetermination`).

## jet-avant-le-de-armes, jet-avant-le-de-empoigner (écran 4)
- Les réglages manquants de `jet-avant-le-de`, en rangées à droite de la silhouette : « Arme » (Épée, « Bouclier
  (2nde −20) »), « Localisation » (« Au hasard » choisie, une zone de la silhouette sinon), bascules « Des deux
  armes » et « Retenir ses coups » ; à mains nues, « Empoigner » et sa note du jeu.
- À valider : une seule grille du centre avant le dé pour toute la classe (« Chaque élément doit avoir sa place »,
  utilisateur, 2026-11-20), primitive `reglage` (`sources/combat/jet.js`), places `PLACES_DU_REGLAGE`
  (`sources/rendu.js`), le cadre du centre celui du jet tombé (`#verdict.grille`, 112). Inventaire (état : places) :
  attaque ×4 et `localisation-du-critique` : sous, mot, figure, lignes 1-3 ; `defense-avant-le-de`, `defense-riposte` :
  sous, mot, cartes 1-2, lignes 2-3 ; `defense-sociale` : sous, mot, cartes 1-3, ligne 3 ; `marchandage-avant-le-de` :
  sous, mot, cartes 1-4 ; `combat-naval`, `combat-naval-bordee` : sous, mot, ligne 1, phrase ; `combat-naval-chanson` :
  sous, mot, cartes 1-2, phrase ; `mer-fuite-de-vapeur`, `evenement-de-route` : sous, mot, phrase ;
  `focalisation-avant-le-de`, `dissipation-avant-le-de` : sous, mot, cumul, phrase ; `test-de-corruption` : sous, mot,
  cartes 1-2. Grille (x, y, l, h dans le fond de la fenêtre) : sous 308,14,326,14 (le rect du sous-titre du jet tombé) ;
  mot 308,28,326,26 (la sorte du Test et sa difficulté, « Test opposé », « Test simple · Accessible +20 ») ; figure
  300,55,54,84 ; lignes 362,55|83|111,280,28 ; cartes 308|473,55|84,161,26 ; cumul 308,88,326,14 et phrase
  308,104,326,34 (les rects du DR et de la phrase du jet tombé). Un seul régime : la colonne de la figure reste
  réservée, vide hors de l'attaque, et toute ligne a 280 de large, sinon une ligne aurait deux rects selon la présence
  de la silhouette. Des places partagent une bande quand aucun état ne les porte ensemble (cartes 1-2 et ligne 1,
  cartes 3-4, cumul et ligne 2, phrase et lignes 2-3). Écarts : la grande ligne d'avant le dé fait 26 de haut et non
  les 38 du mot du jet tombé (l'attaque et la défense n'y logeraient pas leurs trois rangs) ; une carte du centre
  montre son nom et la valeur qui décide (seuil, prix), le reste de son détail au survol (la chanson de marin ne
  montre que son nom) ; la sorte se lit opposée quand l'autre camp teste aussi, simple sinon (le harpon contre une
  cible qui ne teste pas).
- Verbes : `jetRegler('attaque', 'arme' | 'localisation' | 'deuxArmes' | 'retenirSesCoups' | 'empoigner', valeur)`,
  `jetLancer('attaque')`, `jetForcerLaReussite('attaque')`, `jetAnnuler('attaque')`.
- Réfs : LDB 10 l.767-773, LDB 14 l.78 (main secondaire, −20), LDB 14 l.159, AA 07 l.59-61 ; conditions de chaque
  réglage : `src/noyau/fenetreDAttaque.ts:166-253` ; libellés `reglage.attaque.*`, `attaque.armeSecondaire`,
  `attaque.empoigner.note` (`src/i18n/messages/fr.ts:215-221`, `fr.ts:1187`, `fr.ts:1208`).
- À valider : deux images, le noyau n'offrant « Empoigner » qu'à mains nues, sans choix d'arme ; « Des deux armes »
  allumée retire la rangée « Arme » ; « Tirer sans la corde » et « Localisation du Critique » : `jet-avant-le-de-harpon`
  et `localisation-du-critique`, plus bas.

## seconde-frappe, frappe-mortelle (écran 6)
- Le bandeau du bas se réduit à qui frappe, à la consigne du jeu et à un geste de sortie ; le champ reste à cliquer,
  les cibles permises cernées de cire. Second coup : le dé de la première frappe inversé (20 → 02) et le seuil de la
  main secondaire (41 − 20). Enchaînement : son rang sur le Bonus de Capacité de Combat (1 sur 4).
- Verbes : la cible, `cliquerLaCase` ; « Renoncer au second coup », `fenetreFermer('secondeFrappe')` ; « Arrêter »,
  `fenetreFermer('frappeMortelle')`.
- Réfs : LDB 10 l.767-773 ; LDB 14 l.5-9 (option Frappe mortelle) ; `fenetre.secondeFrappe`, `fenetre.frappeMortelle`,
  `consigne.deuxArmes`, `consigne.frappeMortelle` (`src/i18n/messages/fr.ts:489-490`, `fr.ts:4451-4452`).
- À valider : aucune plaque de laiton plein (le clic du champ commet) ; les dés
  vides de l'enchaînement annoncent le jet à venir ; la cible montée et la visée de siège : `cible-montee` et
  `visee-de-siege`, plus bas.

## debut-du-round-tir-rapide (écran 6)
- Le bandeau « Début du round » porte deux choix côte à côte : « Agir en premier » (Berta, 1 Chance) et
  « Préempter · Tir rapide » (« Aucune visée », ou la tireuse à l'arme chargée) ; la tireuse choisie, le tir part au
  clic d'une cible cernée de cire.
- Verbes : `fenetreChoisir('debutDuRound', 'promouvoir' | 'viser', id)`, la cible par `cliquerLaCase`,
  `fenetreValider('debutDuRound')`.
- Réfs : LDB 11 l.97-103 (le tir coûte l'Action et le Mouvement du tour à venir) ; LDB 17 l.25 ;
  `src/noyau/choixDeFenetre.ts:358-364`, `src/noyau/combatSlice.ts:2170` ; `verbe.debutDuRound.viser`,
  `valeur.viser.aucun` (`src/i18n/messages/fr.ts:323`, `fr.ts:399`).
- À valider : « Préempter » est le libellé du jeu, « Tir rapide » le nom du Talent ; l'étiquette « Action et
  Mouvement » ; Berta porte ici son Arbalète.

## defense-sociale (écran 1)
- État de `defense-avant-le-de` : une troisième carte de réaction, « Intimidation ≤ 38 », choisie ; le camp de Berta
  porte la Compétence et son seuil. Pas de « Parer avec » ni de Porte-bouclier : ils ne s'offrent qu'à la Parade.
  Sous les cartes, « À la place de Corps à corps » (mots du livre) et ce qui ouvre la substitution : « Orc a peur de
  Berta ».
- Verbes : `jetRegler('defense', 'reaction', 'social')`, `jetLancer('defense')`, `jetForcerLaReussite('defense')`.
- Réfs : LDB 09 l.287 (Intimidation), LDB 09 l.207 (Dressage) ; offerte en mêlée à qui possède la Compétence, face à
  qui a peur de lui (`combatSubstitute`, `src/engine/skillCombatApps.ts:54-66` ; `src/noyau/fenetreDeDefense.ts:71-87`).
- À valider : trois cartes serrées à la mesure de leur nom ; la raison de l'offre en étiquette ; seuil 38 d'exemple
  (Force de Berta, Compétence de base) ; la Peur de l'Orc est supposée pour l'image.

## jet-avant-le-de-harpon (écran 6)
- État de `jet-avant-le-de-armes`, pour un tir : la bascule « Tirer sans la corde (60 m, sans Immobilisante) »,
  éteinte, et sa note du jeu (« Corde tenue : Immobilisante, Portée 20. ») ; à droite la cible du tir, sans dé.
- Verbes : `jetRegler('attaque', 'sansLaCorde', bool)`, `jetRegler('attaque', 'localisation', lieu)`,
  `jetLancer('attaque')`, `jetForcerLaReussite('attaque')`, `jetAnnuler('attaque')`.
- Réfs : ADE II 02 l.677 ; offerte au tir d'un héros dont l'arme porte `ropeMode` (`src/noyau/fenetreDAttaque.ts:182`,
  `:244-246`, `src/data/trappings.json`, `lance-harpon`) ; libellés `reglage.attaque.sansLaCorde`,
  `attaque.sansLaCorde.noteTenue` (`src/i18n/messages/fr.ts:221`, `fr.ts:1204`).
- À valider : le Lance-harpon, arme d'ogre, est hors de la fiche de Berta ; seuil 33 d'exemple (CT de Berta) ; la
  cible d'un tir en bloc sans dé, comme celle d'un sort (`vise`, `sources/combat/socle.js`).

## localisation-du-critique (écran 4)
- Après le dé : Berta a choisi son résultat (« Je ne faillirai pas ! », étiquette « Résultat choisi », 11 sous 41) et
  inflige un Coup Critique ; au centre la silhouette redevient pressable, « Localisation du Critique », la zone
  choisie en laiton plein (Tête). « Appliquer » commet ; « Relancer » et « Résilience » fermées (jet réussi), la
  Résilience de Berta à 0.
- Verbes : `jetRegler('attaque', 'localisationDuCritique', lieu)`, `jetValider('attaque')`.
- Réfs : LDB 17 l.68 ; `critiqueALocaliser` (`src/noyau/fenetreDAttaque.ts:288-291`) ;
  `reglage.attaque.localisationDuCritique` (`src/i18n/messages/fr.ts:216`).
- À valider : la silhouette d'avant le dé reprise après le dé ; aucun malus affiché (le choix est gratuit) ; dés et
  seuils d'exemple.

## cible-montee (écran 6)
- Berta frappe un couple monté : le bandeau « Combat monté » pose deux cartes, le cavalier (« Tireur gobelin »,
  « −10 au Test ») et sa monture (« Cheval ») ; la carte pressée passe en laiton plein, « Cibler » commet, « Annuler »
  referme. Sur le champ, le couple est cerné de cire.
- Verbes : `fenetreChoisir('cibleDeMonture', 'cible', id)`, `fenetreFermer('cibleDeMonture')`.
- Réfs : LDB 14 l.180 (cavalier ou monture ; −10 en combat rapproché à qui vise le cavalier et est plus petit que la
  monture) ; `src/noyau/choixDeFenetre.ts:247-252`, `src/noyau/modalArbiter.ts:170` ; `fenetre.cibleDeMonture`,
  `verbe.cibleDeMonture.cible`, `verbe.cibleDeMonture.fermer` (`src/i18n/messages/fr.ts:458`, `fr.ts:295`, `fr.ts:354`).
- À valider : carte puis plaque alors que le noyau clôt la fenêtre à la pose du choix (l'hôte tient la carte) ; le
  malus écrit sur la carte du cavalier ; gobelin à cheval dessiné pour l'image.

## visee-de-siege (écran 6)
- Berta sert un Mortier, pièce à tir indirect : armer son tir ouvre la pose de la zone. Le bandeau réduit porte la
  servante, « Pilonnage », la consigne du jeu (« Cliquez la case où poser la zone. ») et « Annuler » ; sur le champ,
  l'aire du tir suit la case survolée, son centre plus marqué.
- Verbes : la case, `cliquerLaCase` ; « Annuler », `fenetreFermer('viseeDeSiege')`.
- Réfs : AA 10 l.169, l.171 (catapulte, mortier : tir indirect) ; `src/noyau/combatSlice.ts:1024-1031`, `:2602`,
  `src/noyau/modalArbiter.ts:345`, `src/noyau/combatFlow.ts:5949` ; `fenetre.viseeDeSiege`, `consigne.poseDeLaZone`,
  `verbe.viseeDeSiege.fermer` (`src/i18n/messages/fr.ts:484`, `fr.ts:4454`, `fr.ts:372`).
- À valider : le gabarit de `seconde-frappe` (consigne et un geste de sortie, aucune plaque pleine) ; aire d'une case
  de rayon, exemple (le noyau la lit à l'arme, `siegeBlastRadiusTiles`) ; mortier dessiné pour l'image.

## fuite-seuil-survole (camp d'un testeur)
- L'état `fuite` (`combat-suite.md`), le seuil de l'Orc sous le curseur : la bulle à pointe des influences du jet,
  une ligne par modificateur (« Avantage 2 », « Dos tourné +20 »), le libellé de `libelleDuModificateur`
  (`sources/rendu.js`). Hors survol, aucune bulle : le seuil reste seul, le nom seul sur sa ligne.
- Le camp d'un testeur a ses places (`PLACES`, `sources/rendu.js`) : le portrait, l'identité (nom, Test sur deux lignes
  au plus), la rangée du seuil, des dés et du sceau à un y fixe, l'issue (verdict, DR) sous le portrait.
- À valider : les influences du jet sont au survol du seuil, dans la bulle à pointe (`bulle.gd` côté Godot) ;
  « Jet inversé 20 → 02 » et « Rôle essentiel ×2 » changent la lecture des dés ou des DR à l'écran sans signe visible
  hors survol (aucun marqueur inventé, l'utilisateur décide) ; issue en deux lignes sous le portrait ; sceau `grand`.
