# Propositions : lieux et nuit (2026-11-16, #3935)

Compte rendu des écrans dessinés depuis les images de lieu et de voyage (inspiration, non validées), la cible écrite
`../ecrites/lieu.md` et le relevé de ce qui se joue la nuit (ci-dessous). Sources au dépôt : trois écrans de
`sources/maquettes/`, chacun la liste de ses états au format de `sources/maquettes/maquette.ts`, dessinés par
`sources/rendu.html` (`node sources/rendre.mjs <écran> <sortie.png> --format 16:9 [--etat <état>]`) : `nuit`
(`nuit-a-l-auberge-pietre`, `nuit-a-l-auberge-normale`, `nuit-a-l-auberge-grande`, `jeux-de-taverne`, `bivouac`), `soins` (`services-du-lieu-medecin` ; `soins-entre-heros`, compte rendu dans `exploration-et-recit.md`) et `interlude`
(`interlude-en-ville`). Les décors peints vivent dans `sources/lieux-et-nuit/` (`auberge.js`, `taverne.js`,
`bivouac.js`, `cabinet.js`, `carte-de-la-ville.js`). Premières maquettes : rien n'est validé.

Directions de l'utilisateur (verbatims au 2026-11-16, fiche `user-doctrine-la-cible-prime-sur-l-ancien-ecran`) : une
image autour d'un feu de camp et une quand on dort à l'auberge ; affectations à des postes dans la lignée du voyage ;
interludes liés à des lieux et à des PNJ, jamais une fenêtre à cinquante choix ; un PNJ qui donne un service ouvre la
page des services de son lieu.
- À valider (#4585) : le cartouche de titre range sa figure dans une case de 56 de large et son texte dans un bloc
  haut de 70, la même grille pour le lieu et le temps du voyage (`dispositions.md`, « La grille intérieure »).
- À valider (#4585) : la page des soins pose ce que le patient paie et sa bourse en une ligne au pied de son corps
  (`page/pied`) ; un soin y montre son nom, son Test et son prix, ce qu'il fait (ou la raison qui le ferme) au survol.
- À valider (#4585) : la partie d'un jeu de taverne pose la mise au pied du corps de sa page (`page/pied`), sans la
  rubrique « La mise de … » que la ligne « Bourse de … » dit déjà.
- À valider (#4585) : au bivouac, ce que la nuit jouera tient en une rangée (« La nuit jouera », le rond et le jet de
  chacun, son nom au survol), et le Test d'un abri passe au survol de la rangée des abris.
- À valider (#4585) : au lieu choisi de l'interlude, les forces de la bataille sous son nom ; l'Activité prise en
  entier, les autres en une rangée de médaillons, leur nom, leur Test et leur enjeu au survol, la raison qui ferme une
  Activité dans sa bulle de refus.
- À valider (#4585) : à l'auberge, les avis de l'aubergiste au pied du corps de sa colonne, toujours en vue : la
  grille des offres se resserre (3 px entre deux lignes) et le corps prend la hauteur de la colonne sous sa tête.

Choix transverses à valider : le poste (médaillon ou portrait, étiquette de chêne à pointe) est la pièce unique
d'affectation (bivouac, auberge, table de jeu), geste supposé « choisir un héros au bandeau, puis cliquer un poste » ;
rail de services à gauche et panneau de parchemin à droite forment le gabarit de toute page de service.

## Ce qui se joue la nuit (relevé aux livres)
- Aucune règle de tour de garde aux livres. Bases : Surprise LDB 13 l.53-59 (au MJ), Rester aux aguets EDOC 08
  l.155-157, Vigilance LDB 13 l.64.
- Campement : Survie en extérieur LDB 09 l.554 (abri et nourriture, +1 Personnage par DR, échec Résistance ou
  Exténué, Échec Stupéfiant au MJ) ; tente LDB 74 l.62 ; sac de couchage +20 au froid LDB 74 l.60.
- Récupération LDB 18 l.296 ; Exténué LDB 16 l.92, l.101 (durée au MJ), LDB 61 l.48 ; Guérison LDB 09 l.256-269 ;
  faim et soif LDB 18 l.338-342, EDOC 08 l.46 ; Exposition LDB 18 l.328-334, EDOC 08 l.90, l.139-141 ; marche forcée
  LDB 51 l.195 ; péripéties LDB 51 l.208-221.
- Activités d'Étape, une par Personnage « autour d'un feu de camp » : EDOC 08 l.131-180.
- Mer : MDG 13 l.111, MDG 15 l.76, l.104-108, l.268, l.304-306. Fleuve : MSRC 7 l.21.
- Auberge : qualité et prix LDB 66 l.5-28, ACE 02 l.99 ; boisson LDB 09 l.473-485 ; Pari LDB 09 l.389 ; jeux NADJ 16 ;
  rumeurs EDOC 08 l.151-153, EDOC 09 l.19-23.
- Au code : `src/noyau/restFlow.ts:204`, `:435`, `:562-578`, `:759` ; `travelFlow.ts:314` ; `travelPostes.ts:136`
  derrière `voyage-etapes` (défaut `false`) ; `seaVoyageFlow.ts:1815-1825` ; `riverVoyageFlow.ts:862` ;
  `innFlow.ts:42` ; `tavernFlow.ts:237` ; `medicFlow.ts:72`.
- Absent du code : veille de nuit ; abri de fortune complet ; sac de couchage +20 ; boire une pinte.

## nuit
Un seul écran pour la nuit, à l'auberge comme à la halte : un seul panneau « Qui dort où », à droite, range les héros
dans les lits d'une chambre ou les places d'un abri, et à part ceux qui restent dehors.

### nuit-a-l-auberge-pietre, nuit-a-l-auberge-normale, nuit-a-l-auberge-grande
- Un état par qualité de l'établissement (inspiration, non validée : images `logis-qualites`, `auberge-fin-du-voyage`,
  `auberge-bouge-altstadt` de `../maquettes/`) : la qualité est une donnée de l'établissement (`src/noyau/restFlow.ts`, `p.quality`, `QUALITE_DU_REPOS`), jamais un
  choix ; l'échelle est celle du livre, piètre, normale, grande : « Les chambres et les repas de piètre qualité coûtent
  la moitié des prix listés, et ceux de grande qualité coûtent le double des prix listés » (LDB 66 l.5). Le même écran,
  sa salle suit la qualité (`qualite` de l'état, `sources/lieux-et-nuit/auberge.js`) : enfumée et ses paillasses au mur,
  la salle de la Fin du Voyage, tapis et lustre.
- Prix du livre (LDB 66 l.12-16) : chambre commune 10 sc, chambre privée 10/–, écurie 10 sc, repas 1/–, bière la pinte
  3 sc, vin la bouteille 10 sc ; la grande chambre « coûte le double du prix et convient à 4 invités » (LDB 66 l.28).
- Piètre, une taverne d'Altstadt (« Les tavernes bon marché et répugnantes, offrent des atmosphères enfumées sous des
  plafonds bas », EDO 10 l.179) : chambre commune 5 sc, repas 6 sc, bière 3 sc ; avis « méfiez-vous des voleurs »
  (« les invités qui dorment dans des chambres communes doivent se méfier des voleurs », LDB 66 l.26) et 10 % de
  Courante galopante (« Consommer des aliments et des boissons de piètre qualité comporte un risque de 10 %
  d'exposition à la *Courante galopante* », LDB 66 l.5) ; les quatre en chambre commune, 11 sc chacun.
- Normale, La Fin du Voyage (« une vaste auberge respectable », EDO 10 l.517) : chambre commune 10 sc, chambre privée
  10/– (2 lits), grande chambre 20/– (4 lits), repas 1/–, écurie 10 sc par cheval ; avis des voleurs. Qui dort où : les
  quatre portraits dans la grande chambre, « 4 sur 4 » ; tarif par personne (#3004), la part de chacun (6/–) sous son
  nom, réglable, et le total ; « Passer la nuit ». Postes de soirée : boire (bière, la pinte 3 sc), écouter les
  rumeurs, jouer, se faire soigner (le barbier de la maison), dormir.
- Grande, une auberge de la Dreieckeplatz (« plusieurs auberges et tavernes haut de gamme […] Les prix sont élevés en
  conséquence (le double de ceux indiqués […] page 302) », EDO 10 l.293) : chambre privée 1 CO, grande chambre 2 CO,
  repas 2/– ; boire le vin, 10 sc la bouteille ; les quatre en grande chambre, 12/– chacun.
- À valider : une seule activité de soirée par héros (transposition de l'Étape, aucun RAW) ; « Boire » demande une
  offre au noyau (M12 de l'audit ; la règle d'ivresse existe, LDB 09 l.475) ; l'écurie n'est pas une offre du noyau
  (`PRIX_DU_LIVRE` ne la connaît pas) ; l'offre de l'hôte à gauche, alors que les jeux montrent le rail des services de
  la maison ; les offres de chaque maison sont une donnée d'adaptation (la piètre sans chambre ni écurie, sur le modèle
  de l'asile de nuit d'ACE 02 l.99, qui ne vend que la chambre commune et le repas ; la grande sans chambre commune) ;
  à la Dreieckeplatz, EDO 10 l.293 double tous les prix, LDB 66 l.5 les seules chambres et repas : le vin reste au prix
  du livre ; le barbier n'est qu'à la Fin du Voyage ; tenancier et maître d'hôtel anonymes, leurs répliques sont des
  exemples ; un avis par risque, sans pictogramme propre ; le ruban de l'hôte, « La nuit et le repas », libellé neuf
  repris du service `nuit` du rail de la même maison.
- À valider (#4585) : chaque poste de la scène a 148 px de large au moins et une tête de la hauteur d'un portrait,
  tenu ou vide : l'étiquette ne bouge plus quand un héros prend le poste, les tenants centrés sur la largeur du poste.

### jeux-de-taverne
- La même maison, service « Les jeux » : la table sous sa lanterne, trois joueurs PNJ, la place libre ; l'Al-zahr,
  les fléchettes, le bras de fer (NADJ 16) ; sièges, mise, pot, « S'asseoir et lancer les dés ».
- À valider : jeux proposés par maison ; mise libre (le livre ne chiffre pas) ; nombre cible et variante rapide non
  montrés.

### bivouac
- Clairière de nuit (lune, lisière, feu, tente, diligence dételée). La nourriture se choisit par héros, sur sa carte
  du bandeau (« Ration » ou « Rien », `src/i18n/messages/fr.ts:439-444`, choix de `src/noyau/restFlow.ts:163`).
- Qui dort où : l'abri se choisit, « Petite tente », « Belle étoile » ou « Abri de fortune » (Test de Survie en
  extérieur, LDB 09 l.554) ; les places de la petite tente (deux, toutes prises), ceux qui restent dehors, ceux qui
  dorment dans leur sac de couchage (+20 au froid, LDB 74 l.60) ; le temps ; « Ce que la nuit jouera » : le froid
  (Résistance), le repos ; « Passer la nuit ». La sortie « Reprendre la route ».
- À valider : tente sans effet chiffré aux livres (LDB 74 l.62, règle maison `exposition-tente-annule`) ; le nombre
  de places d'une tente ; le sac de couchage et l'abri de fortune, que le noyau n'applique pas ; la ligne « Le
  froid » sous la tente dépend de la sévérité du temps (`exposureTestCount`, `src/noyau/restFlow.ts:486-512`), non
  relue pour le gel ; une halte de voyage qui se quitte (`src/noyau/modalArbiter.ts:192` ne la quitte pas).
- À valider (#4585) : l'offre de l'hôte, qui dort où et la partie sur la grille commune des colonnes (`colonne`,
  `sources/gestes.js`) : la tête (le cartouche de l'hôte, le jeu), le corps qui défile, ses entrées à 6 px l'une de
  l'autre, le geste au pied fixe ; les autres jeux de la maison en plaques à 12 px, pour tenir à trois sur la largeur
  de la page.

## soins

### services-du-lieu-medecin
- La page des services du quartier (rail : auberge, taverne, guilde des Joailliers, guilde des Médecins, Guet),
  le cabinet en image, le docteur et son boniment ; le patient se choisit par son portrait dans le bandeau ; soins :
  Panser (Guérison, LDB 09 l.260), Recoudre (Chirurgie, LDB 10 l.184, LDB 18 l.314).
- Payer : chaque acte se paie au lancer du Test (`src/noyau/medicFlow.ts:182`), par le bénéficiaire (#3004) :
  « À payer », « Bourse de Greta », « Payer et soigner ». La page des soins est celle des soins entre héros
  (état `soins-entre-heros`, `exploration-et-recit.md`), `sources/lieux-et-nuit/soins.js`, `soins.css`.
- La Chirurgie à 15/– est dite « valeur maison » sur l'image : aucun prix aux livres (LDB 75 l.19 ne donne que la
  visite, « 4-6 pistoles »).
- À valider : visite à 5/– dans la fourchette du livre, à tracer en valeur maison elle aussi ; le noyau débite le
  groupe, pas le patient ; docteur anonyme ; rail du quartier ou du bâtiment.
- À valider (#4585) : la page des soins sur la grille de la page d'un service : le patient en tête ; son mal, les
  voies et ce que l'acte coûte (le compte, la bourse) dans le corps qui défile ; le geste et la note au pied fixe.

## interlude

### interlude-en-ville
- Le plan de Bögenhafen ; sept lieux épinglés, chacun une Activité (LDB 23 l.132-240) ; le lieu choisi à droite, son
  hôte (le tenancier et sa réplique), ses seules activités et « Envoyer Mira à la taverne ».
- À gauche, par héros : l'Événement de sa période (LDB 22 l.5, LDB 23 l.15, `eventRoll`) et le compteur de ses
  Activités restantes sur trois (LDB 23 l.5, `src/noyau/interludeEnVue.ts:48-52`) ; l'avis de la reprise (LDB 23
  l.13-19). La sortie est la pastille « Reprendre la route » (le noyau ne tient pas de semaine courante).
  « Semer la dissension » dit ses deux Activités (LDB 23 l.240).
- Le même écran porte la préparation d'une bataille de masse (`bataille-de-masse-preparation`, `combat-suite.md`).
- À valider : rattacher chaque Activité à un lieu et à un PNJ est une adaptation de scénario ; restriction par
  Classe (LDB 23 l.195) ; plusieurs Activités absentes du plan ; l'effet de l'Événement n'est pas montré.
- À valider (#4585) : les Activités restantes et le lieu choisi sur la grille commune des colonnes, « Envoyer » au
  pied fixe ; sur la carte, la place du héros tenue vide à chaque étiquette où personne ne va : une étiquette garde sa
  largeur quel que soit son occupant.
