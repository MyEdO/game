# Conception de Grisefosse

Ce que le jeu promet, le parcours d'un joueur qui le découvre, les règles d'interface qui le servent, et l'ordre dans
lequel on le termine. Un jeu d'abord : quel que soit le système derrière (le noyau WFRP), un néophyte doit pouvoir
le comprendre et le jouer de bout en bout depuis l'interface.

## La promesse

Un roguelite à la Darkest Dungeon, dans le Vieux Monde de Warhammer : une compagnie d'aventuriers relève le hameau de
Grisefosse et part en expéditions de salle en salle jusqu'à abattre l'Autel du Chaos.

- **Simple à jouer** : la complexité du noyau reste interne ; le joueur voit la complexité du genre, pas celle des
  règles.
- **Combats automatiques, mais visibles** : on voit qui agit, qui touche, ce qui se passe.
- **Deux progressions** : le hameau, dont les bâtiments ouvrent des options de jeu ; et les héros (carrières, Talents
  qui agissent en combat, sorts et miracles, équipement).
- **La mort n'est pas la fin** : le Destin sauve, les séquelles marquent, les morts reposent au Jardin de Morr, et la
  compagnie continue avec de nouvelles recrues.
- **Des carrières qui ont une identité** : chacune a un rôle lisible et un Talent qui la définit.
- **Un rendu simple** et cohérent avec le kit des maquettes 4585 ; les illustrations viendront à la finition.

## Le jeu tel qu'il est arrêté

Ce qui est décidé et ne se rediscute pas sans l'utilisateur. Tout lot sur le roguelite part d'ici ; une proposition
qui contredit une ligne ci-dessous est un défaut, pas une option. Le détail et les verbatims : « Arbitrages de
l'utilisateur ».

- **Le noyau d'abord** : toute règle se joue par le noyau ; ce qu'il ne joue pas va à `RETOURS.md`, jamais dans l'hôte.
- **Bug majeur** (« En cas de bug majeur de ce genre, je t'autorise a lancer un agent pour le corriger »,
  2026-11-23) : un plantage ou une règle cassée en jeu se corrige aussitôt par un agent, sans attendre de feu vert.
- **Fable coûte cher** (« mais arrete, Fable coute chere ! », 2026-11-23) : Fable ne reçoit que du dessin, sur un écran,
  avec un brief qui part de l'écran existant ; aucune correction, aucun retour en arrière ni plomberie ne lui va.
- **Preuves d'un lot du roguelite** (« L'art de perdre un temps monstrueux sur des agents qui ont 5min de cache »,
  2026-11-23) : vitest ciblé (`node scripts/lancer-local.mjs vitest --cwd roguelite -- vitest run <fichiers>`),
  `node roguelite/construire.mjs`, `tsc -p roguelite` par `lancer-local`, et les recettes concernées. Jamais
  `test:perimetre` ni `docs:check`, qui ne jouent aucun test du roguelite et attendent un verrou partagé.
- **Le catalogue du roguelite** (« tu dois avoir le controle sur ce que le roguelite propose, que ce soit dans les
  sorts, les compétences, les talents, les carrières, l'équipement, etc ... Et tout ça maintenu dans un document et/ou
  un fichier au format de ton choix », 2026-11-23) : tout ce que le jeu offre (carrières et leurs voies, sorts,
  Compétences utiles, Talents mis en avant, armes, panoplies, remèdes, provisions, destinations et adversaires) vit
  dans UNE source de code, `roguelite/src/jeu/valeurs.ts`, et `roguelite/CATALOGUE.md` en est la vue lisible, produite
  par `npx tsx roguelite/catalogue.ts` : jamais écrit à la main, régénéré dans le commit qui change le catalogue.
- **Le jeu choisit ce qu'il propose** (« c'est toi qui décide ce que le jeu propose, tu n'as pas a TOUT proposer, tu
  as le controle », 2026-11-23) : chaque boutique, chaque liste offre une sélection courte et voulue, tirée des données
  du noyau, jamais tout le catalogue. La forge vend une sélection d'armes par Groupe utile au roster, ouverte par
  Disponibilité ; pas d'armes d'ogre, de lances de cavalerie ni d'objets qu'aucun héros ne manie. « On devrait filtrer
  les options de la forge par rapport aux compétences du personnage » (2026-11-23) : pour le héros choisi, la forge ne
  propose que les armes des Groupes que ses Compétences de Corps à corps et de Projectiles couvrent (lu sur le noyau).
  « L'arbalete ca reste la seule arme a distance que les gens peuvent prendre a distance sans compétence, et pour le
  reste on filtre » : l'arbalète est proposée à tous. Sorts : « Il ne faut proposer que des sorts qui fonctionnent et
  sont utiles. On s'autorise a en ouvrir plus plus tard avec l'évolution du jeu » (2026-11-23) : chaque voie (Collège,
  dieu) offre une courte liste choisie de sorts que le noyau applique et qui servent en combat ou en salle.
- **Gérer vite** : après une expédition, faire progresser et équiper un héros tient en quelques clics.
- **Équipement** : quatre emplacements, arme, main secondaire, distance, armure. L’armure est une panoplie parmi cinq
  (de 1 à 5 PA) : des options qui s'arbitrent (protection contre prix, encombrement et malus), pas une échelle.
  La forge ouvre ce qu'elle vend par Disponibilité ; une recrue part avec la dotation du livre ; le meilleur s'achète.
- **Progression** : présentation « à la 5e » (pas de +5, plan conseillé en un clic, Compétences utiles seules) ;
  une identité de carrière se juge sur ses quatre niveaux.
- **Roster** : chaque palier du relais apporte un groupe complet ; le lanceur est une carrière de Collège tirée, le
  dieu d'un prêtre est tiré, et la carte du héros les affiche.
- **Salles** : rien d'automatique ; le joueur choisit l'action et le héros qui la tente, qui en subit l'échec.
- **Combat** : automatique et visible ; placement du groupe et consigne par héros (doctrine de l'IA du noyau) à venir.
- **Montures** : porter un cavalier est un choix fait hors combat ; une bête sans cavalier combat en membre du groupe.
- **Boutiques** : la forge vend armes et panoplies ; l'Hospice soigne et vend potions et remèdes ; l'Auberge relais
  recrute, loge, renvoie, et vendra les provisions de route.

## Le parcours du néophyte

Chaque étape dit ce que le joueur doit comprendre ou pouvoir faire, sans connaître WFRP. C'est la grille de recette
du jeu : une étape où il ne sait pas quoi faire, ou pourquoi, est un défaut.

1. **Premier lancement.** Il comprend le but (relever Grisefosse, abattre l'Autel) et sait quelle est sa première
   action.
2. **Composer un groupe.** Il voit le rôle de chaque héros (ligne de front, tireur, soigneur, lanceur) et choisit un
   groupe par rôles, pas par chiffres.
3. **Partir.** Il choisit une route, sait ce qui l'attend (salles, maître), approvisionne le groupe, part.
4. **En expédition.** Il sait où il en est sur la route, ce que la salle annonce, ce qu'il peut faire avant d'y
   entrer (provisions, prière), et quand rentrer.
5. **Le combat.** Il voit à qui est le tour, qui frappe qui, si ça touche, les blessures, qui tombe, et l'issue.
6. **Le retour.** Il sait ce qu'il a gagné (or, PX, trophées) et ce que ça lui ouvre ; il voit qui est blessé, marqué
   ou mort, et ce qu'il peut y faire.
7. **Progresser.** Pour chaque axe (hameau, carrière, équipement, sorts), il voit la prochaine étape, son prix, et ce
   qu'elle change en combat.
8. **Le risque.** Avant de partir, il voit qui est en état ; il comprend le Destin, les séquelles et leur issue
   (repos, chirurgie, permanente), et la rotation (seuls les absents se reposent).
9. **La mort.** Un héros mort a une tombe ; la compagnie continue ; le Jardin de Morr transforme les pertes en
   expérience pour les recrues.
10. **La fin.** Abattre l'Autel est une victoire annoncée ; il sait ce qu'il reste à faire ensuite.

## Les règles d'interface (cibles)

1. **Une scène fixe pour tous les écrans** (vue de référence 1280 × 720), échelle jamais au-dessus de 1 ; lieux et
   services ancrés aux bords (`placeDe` des maquettes), écrans de gestion en bloc centré.
2. **Un rôle, un rectangle**, ceux de la table `CADRES` des maquettes (`rendu.js`), recopiés tels quels dans
   `CADRES` d'`ecran.ts`. Un bâtiment ouvert prend celui de l'hôte (`CADRES_DE_L_HOTE.batiment`), étiré jusqu'au
   socle sur un écran plus grand que la vue de référence.
3. **Le socle de la compagnie au même endroit sur tous les écrans**, défilant au-delà de quatre héros ; un clic y fait
   une seule chose par écran.
4. **Le contenu s'adapte au cadre** : ce qui ne tient pas défile, l'action principale est au pied fixe du cadre. La
   page d'un bâtiment remplit son cadre de grandes cartes et tient sans défiler pour une compagnie de quatre héros,
   à la taille d'interface par défaut.
5. **Une forme par concept** : la vie en jauge ; une chose possédée en entrée ou en case ; un choix d'un bâtiment en
   carte (une recrue, un soin, une arme, une route) ; le héros en carte. **Un prix ne se lit que dans le geste qui le
   paie** : une plaque « verbe · prix » (« Acheter · 8 CO », « Engager · 15 CO », « +1 · 10 PX » ; `achat` de
   `pieces.ts`), dorée quand on peut payer, fermée avec sa raison au survol sinon ; la bourse est en tête du bâtiment.
6. **Une offre se compare à ce que le héros porte** : à la forge, chaque arme dit la valeur de son Test d'attaque et
   ses Dégâts entre les mains du héros servi, son allonge ou sa portée, avec le sens de l'écart (▲ ▼ =) face à
   l'arme tenue ; « Deux mains » et les qualités sont des étiquettes à leur nom du livre, leur texte au survol.
7. **Le détail au survol, jamais en ligne** : bulle pour un mot, aperçu pour une chose (texte du livre rendu).
8. **Sortir** : la croix du panneau d'un service, la croix d'un écran de gestion.
9. **Une partie se joue avant d'être dite finie** : à la taille d'écran du joueur, à la souris, en regardant chaque
   écran ; une recette verte ne prouve pas qu'un écran sert.

## Les écrans et leur but

| Écran | But | Étapes du parcours |
|---|---|---|
| Hameau | Voir le village, ouvrir un bâtiment, voir la compagnie, partir | 1, 6, 7, 9 |
| Services (relais, chapelle, salle d'armes, forge, cartographe, péage, jardin, chronique) | Bâtir, servir un héros (l'équiper, le soigner, dépenser ses PX), engager, préparer une route | 2, 6, 7, 8, 9 |
| Départ | Choisir le groupe, l'approvisionner héros par héros, partir | 3, 8 |
| Fiche du héros | Lire le héros, dépenser ses PX (les mêmes blocs qu'à la salle d'armes), utiliser ses provisions en route | 2, 7, 8 |
| Expédition | Avancer, utiliser les sacs, rentrer | 4 |
| Récit d'une salle | Lire ce que la salle laisse, revoir le combat quand il s'y raconte, continuer | 5, 6 |
| Rejeu du combat | Voir le combat joué : qui agit, dans quel ordre, ce que chaque coup fait ; son issue | 5 |
| Réglages | Régler la taille de l'interface, recommencer | — |
| Recommencer | Confirmer l'effacement | — |

Le récit et Recommencer sont un **carton** (`carton` d'`ecran.ts`, gabarit « Récit, document et issue ») : la scène du
lieu n'y garde que son cartouche et le socle, qui reste ; seuls les gestes du carton répondent. Un combat se clôt à
son **issue** (bannière, ce qu'elle laisse, un geste ; tâche du rejeu) : une victoire rend la main à l'expédition sans
carton ; une déroute ou une retraite passe de l'issue au carton qui raconte le retour.

| Étape | Repère | Capture (`parcours.mjs`) | Verdict |
|---|---|---|---|
| 1 | Le but et ses maîtres en losanges au panneau Partir ; « Choisir une route » en or ; pastilles des bâtiments | `1-lancement` | tient |
| 2 | Rôle en pictogramme sur la carte ; identité (carrière, rôle, espèce, devise) au survol | `2-identite` | tient |
| 3 | Destinations : salles et maître ; départ : sacs et provisions par héros | `8-depart` | tient |
| 4 | Frise de la route sur le champ ; panneau de la salle, action au pied ; sacs | `4-expedition` | tient |
| 5 | Rejeu : ordre du tour, « Au tour de… », coups sur la cour, journal, cartes des héros, issue et butin | `rejeu.mjs` | tient |
| 6 | Récit du retour (or, trophées, PX) ; pastille rouge de la Chapelle ; la Chapelle sert d'abord le blessé ; séquelle sur la carte | `6-retour-hameau`, `6-chapelle` | tient |
| 7 | Pastille sur le héros qui peut progresser ; prochaine étape de chaque axe à son écran | `2-identite` | tient |
| 8 | Raison d'une carte fermée au survol ; hospice et séquelles sur la carte | `8-depart` | tient |
| 9 | La mort au carton ; Jardin de Morr ; le socle vide renvoie au relais | `9-carton`, `9-jardin`, `9-relais` | tient |
| 10 | Bannière de victoire ; le panneau Partir dit que les routes restent ouvertes | `10-victoire` | tient |

Repères du parcours, à la manière de Darkest Dungeon (aucun texte d'aide) : le but et ses maîtres en losanges au
panneau Partir ; le rôle de chaque héros en pictogramme (`ROLES`), son identité au survol de sa carte ; une pastille
sur le héros qui peut acheter un avancement et sur le bâtiment qui peut s'agrandir ; la raison d'une carte fermée au
survol ; le dernier fait du journal sous le cartouche du hameau.

## Arbitrages de l'utilisateur

- **2026-11-23, le noyau d'abord** : « On doit utiliser le noyau, je veux t'éviter le maximum de chose "interne", car
  ça serait de la duplication. Au mieux tu mets ça dans les retours. Par contre tu peux tout à fait modifier
  l'interface pour marcher "à la 5ème", et envoyer ce que veut le noyau pour que cela fonctionne. » — Une règle que le
  noyau ne joue pas va dans `RETOURS.md`, pas dans l'hôte ; « à la 5e » est une présentation (achats par pas de +5
  envoyés au noyau en Augmentations de +1).
- **2026-11-23, les compétences et les événements** : « Pour les compétences, faudra lister ceux utiles. On parle "De
  combat", mais on pourra sûrement ajouter des nouveaux événements et des actions. Déjà Guérison c'est une compétence
  très utile, mais on peut aussi proposer des rencontres qui peuvent se résoudre en partie en social, des pièges qui
  passent par les compétences adéquates, des trésors cachés. »
- **2026-11-23, le roster** : « Si on veut intégrer le ratier, je te laisse adapter le roster en conséquence. Le but
  est que chaque carrière a son identité propre, que ce soit sur ses compétences/talents, son rôle dans le groupe et
  son arsenal. »

- **2026-11-23, les munitions** : « Pour moi après chaque expédition, on récupère automatiquement ses flèches, pas
  besoin de les racheter. » — Valeur d'adaptation du roguelite (`ramasserLesMunitions`, `jeu/expedition.ts`).
- **2026-11-23, le noyau** : « Je t'autorise à modifier le noyau mais en passant par le système normal attendu par le
  projet avec un ticket et les skills qui gèrent le traitement des tickets » ; « Pour le ratier, donne le chien du
  ratier. » ; « Non non c'est bien une adaptation du roguelite. » — Le noyau reste « LDB-pur » (arbitrage du
  2026-07-21, MyEdO/game#651 : la dotation du Chasseur de Rat garde le Chien, LDB p. 315) ; le roguelite donne au
  Ratier le `chien-de-ratier` du bestiaire, valeur d'adaptation. Puis, sur la taille du chien : « ok, c'est toi qui
  gere le gameplay, mais il doit etre jouable et ne pas explosé des qu'on le touche ». — Le chien du Ratier est le
  Chien du Livre de base avec ses options du livre (LDB 78 l.38) : Taille (Moyenne), Dressé (Guerre), Armure 1 ; le
  `chien-de-ratier` (Très petite, Terreur 2 face à un humain) est écarté. Sa survie se mesure en rencontres simulées.
  En combat : « Sinon le chien du ratier est membre du groupe, il agit comme tel, sans rien de maison, je pense que
  l'IA fonctionne comme ca de toute maniere » (MyEdO/game#4804).
- **2026-11-23, les identités du front** : « Le tueur je le voyais a la double hache et/ou a la grande hache. Le soldat
  je le vois plus comme un tank et le maitre de l'épée un combat spécialisé dans le combat a l'arme a 2 main. Mais
  surement qu'il fait doublon avec le tueur et le soldat » ; « Il faut un tank au début, le soldat même rang 1 sait se
  défendre avec un bouclier ». — Soldat : tank du relais 0, niveau 1, un bouclier d'adaptation à son recrutement ;
  Tueur : deux haches, la grande hache à son niveau 2 ; Joueur d'épée : la deux-mains. « N'oublie pas, les
  personnages progresse » : une identité se juge sur les quatre niveaux de la carrière, pas au seul recrutement.
- **2026-11-23, l'ingénieur** : « L'ingénieur je l'aime car il utilise des armes d'ingénieurie et a poudre noire que
  le repurgateur n'utilisera âs forcement ». — Ingénieur au relais 2, recruté au niveau 2 (Projectiles (Ingénierie)) ;
  sa dotation n’a aucune arme à feu : un pistolet lui est donné (voir « la dotation des recrues »).
- **2026-11-23, la dotation des recrues** : « Evite de donner la meilleur arme du jeu au personnage des qu'on le
  recrite sinon il n'y a aucun interet a lui acheter de l'équipement ». — Une recrue part avec la dotation du livre ;
  une adaptation ne comble que l'arme de base absente de son identité, la plus simple de son Groupe (le bouclier du
  Soldat, un pistolet pour l'Ingénieur) ; le second pistolet du Répurgateur et les armes d'ingénierie s'achètent.
- **2026-11-23, Collèges et dieux** : « Pour et les dieux, il ne faut pas forcement tout proposer car certains sont
  inutilisable dans le jeu ou non implémenté (sorts/miracles), et je ne veux pas pouvoir choisir, ca reste aléatoire,
  mais juste bien les flagger comme il faut car ils ne se jouent pas tous de la même maniere ». — Le Collège d'un
  sorcier et le dieu d'un prêtre se tirent au recrutement, parmi ceux que le noyau joue (mesure :
  `docs/sorts-implementation.md`), et la carte du héros les affiche. « Les sorciers de Vents de magie seront plus
  adapté d'ailleurs que le sorcier générique » : le lanceur du roster est une carrière de Collège (VDM ch. 4 à 11 :
  pyromancien, hierophante, druide, chamane, alchimiste, spirite), tirée au recrutement.
- **2026-11-23, l'Auberge relais et la progression** : « Oui je valide tes propositions ». — L'Auberge relais met un
  héros au repos dans une chambre (repos d'auberge joué par le noyau, LDB 66) et permet de le renvoyer contre une
  prime ; la progression « à la 5e » est une présentation : un achat de +5 envoyé au noyau en Augmentations de +1, au
  prix du noyau, et seules les Compétences utiles au roguelite proposées ; la règle des cases de la 5e va à `RETOURS.md`.
- **2026-11-23, les pistes** : « Mais je valide la corruption et les maladies. Ca peut même faire des rencontres avec
  des choix a faire. Et oui pour le 2 je suis d'accord, rien ne doit etre automatique, on doit choisir nos actions dans
  les salles. Pour le 1, je suis d'accord pour le placement du groupe et de souvenir y'a un paramétrage possible sur
  l'ia non ? D'ailleurs si tu veux rendre les choses tactiques, faudrait des maps qui le soient un peu plus ». —
  Détail et état dans `PISTES.md` ; la consigne d'un héros passe par la doctrine de l'IA du noyau
  (`Combatant.aiDoctrine`, `DOCTRINES` de `src/noyau/monde/ai.ts`).
- **2026-11-23, gérer vite ses héros** : « Les personnages sont fait pour évoluer, que ce soit via l'xp et
  l'équipement, mais il ne faut pas qu'on passer 5min apres chaque expédition a gérer détail par détail notre
  personnage. Pour ca que je voulais passer la progression en V5, pour que les augment soit plus simple par exemple ».
  — Après une expédition, faire progresser un héros tient en quelques clics : achats par pas de +5, un plan conseillé
  vers le niveau suivant acheté en un clic (verbes du noyau), seules les Compétences utiles proposées ; l'équipement
  s'achète par panoplie et par arme conseillée.
- **2026-11-23, la forge** : « Les palliers de la forge doivent plutot se baser sur la rareté ». — Chaque palier de la
  forge ouvre une Disponibilité du livre (champ `availability` des objets du noyau : commune, limitée, rare,
  exotique) au lieu d'une liste choisie à la main. Sur l'armure : « on affichait 4 slots (arme, 2nd main, distance et
  armure), si on gere l'armure a l'unité ca va etre un enfer, en plus avec les régles sur l'empilement des armures,
  sur ces personnages qu'on va créer en grand nombre, ca va etre l'enfer ». — La forge vend des panoplies : un
  ensemble cohérent de pièces du noyau, acheté en un clic, qui occupe l'emplacement « armure » ; le noyau en calcule
  les PA par localisation. Puis : « On peut proposer les 5 niveaux (1, 2, 3, 4, 5) pour tout le monde, (en mélangeant
  ou non les 3 matieres), c'est important pour l'encombrement ». — Cinq panoplies, une par niveau de PA (1 à 5), faites
  de cuir souple, de mailles et de plates superposés selon LDB 63 l.60 et l.74 ; chacune montre son prix, son Encombrement
  et ses malus, pour arbitrer protection contre prix et encombrement (« Mais aussi le prix »).
- **2026-11-23, l'équilibre du relais** : « Faut équilibré pour chaque rang d'auberge, histoire qu'on ne joue pas
  qu'avec 4 carrières 80% de la partie ». — Chaque palier du relais apporte un groupe complet (front, tireur, soin,
  lanceur ou éclaireur) ; la part de chaque carrière dans les recrues d'une partie se mesure (`equilibrage.ts`).

## Les phases

1. **Refonte du code, sans changement visible.** Découper la façade du noyau (`combat.ts`), la boucle de jeu
   (`jeu.ts`) et les feuilles de style ; la façade reste la seule entrée de `noyau.js`. Preuve : le rendu HTML de
   chaque écran, sur une sauvegarde fixe, identique avant et après ; `jeu.js` reste autour de 100 Ko.
2. **Unification, écran par écran**, chacun contre les règles d'interface et son but : récit, rejeu et recommencer
   passent au gabarit ; les rectangles et les formes qui dérogent sont soldés.
3. **Le parcours du néophyte**, étape par étape : ce qui manque pour que chacune passe (but affiché, rôles des
   carrières, prochaine étape de chaque axe, retours en jeu).
4. **Les visuels**, avec Fable : illustrations, icônes, pions.

## Le code

- `src/noyau/` : la façade du noyau WFRP, seule entrée (`index.ts`) compilée à part (`dist/noyau.js`) ; un module par
  domaine (héros, partie, combat, hameau, soins, équipement, carrière). Aucune règle n'y est réécrite.
- `src/jeu/` : la boucle de jeu, seule entrée (`index.ts`) ; valeurs d'adaptation (`valeurs.ts`, tous les nombres du
  roguelite), état, village, soins, carrières, boutiques, expédition, sauvegarde ; `outils.ts` reste interne.
- `src/ui/` : l'interface ; le gabarit (`ecran.ts`), les pièces du kit (`pieces.ts`), les survols (`bulles.ts`), les
  lieux, les services, la fiche, le rejeu. `main.ts` ne tient que l'état de l'interface et le routage des gestes.
  Chaque module a sa feuille à côté de lui (`fiche.css` pour `fiche.ts`…) ; `base.css` remet le kit dans le flux.
  Le build les recolle dans l'ordre de la cascade (`FEUILLES` de `construire.mjs`) en `dist/jeu.css`.
- `src/hameau.ts`, `src/cour.ts`, `src/figures.ts`, `src/kit.ts` : les dessins (panorama, cour de combat, figurines,
  pictogrammes et cadres du kit).

## La recette

Les scripts de `recette/` se jouent contre le jeu construit (`node roguelite/construire.mjs`, puis un serveur
statique sur `roguelite/dist`) :

- `partie.mjs` : une partie de bout en bout (bâtir, équiper, progresser, partir, quatre salles, rentrer) ;
- `debords.mjs` : chaque écran, à trois tailles d'écran et pour une taille d'interface donnée (`petite`, `moyenne`,
  `grande`), sans cadre qui rogne ce qui doit tenir (la tête, le corps et le pied d'un bâtiment compris) ni bouton
  hors de l'écran ; à la taille `grande`, seul l'étal d'une forge agrandie défile ;
- `rejeu.mjs` : une mêlée nombreuse (Animosité, chamane) jouée en entier, les héros à terre gardés dans l'ordre du
  tour, « Échap » qui mène à l'issue avant de fermer ;
- `socle.mjs` : le socle au même rectangle partout, et sept héros atteignables ;
- `images.mjs` (sur la partie fixe de `partie-fixe.ts`, à une taille donnée) et `comparer.py` : l'image de chaque
  écran, comparée au pixel près avant et après une refonte qui ne doit rien changer ;
- `parcours.mjs` : le parcours du néophyte sur des états forcés (blessé, séquelle, hospice, mort, victoire finale),
  une capture par étape à 1280 × 720 et 1920 × 1080, et ses repères vérifiés au DOM.

Un écran n'est fini que si ses critères passent à 1280 × 720 et 1920 × 1080, avec une capture regardée ; le
téléphone est un test de fumée.
