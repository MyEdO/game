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
   `CADRES` d'`ecran.ts` ; un rectangle qui n'en vient pas vit dans `CADRES_DE_L_HOTE`, avec sa raison.
3. **Le socle de la compagnie au même endroit sur tous les écrans**, défilant au-delà de quatre héros ; un clic y fait
   une seule chose par écran.
4. **Le contenu s'adapte au cadre** : ce qui ne tient pas défile, l'action principale est au pied fixe du cadre.
5. **Une forme par concept** : la vie en jauge ; une chose possédée en entrée ou en case ; une offre de boutique ; un
   prix d'une seule forme ; le héros en carte.
6. **Le détail au survol, jamais en ligne** : bulle pour un mot, aperçu pour une chose (texte du livre rendu).
7. **Sortir** : « Retour » pour un lieu de service, la croix pour un écran de gestion.

## Les écrans et leur but

| Écran | But | Étapes du parcours |
|---|---|---|
| Hameau | Voir le village, ouvrir un bâtiment, voir la compagnie, partir | 1, 6, 7, 9 |
| Services (relais, chapelle, salle d'armes, forge, cartographe, péage, jardin, chronique) | Bâtir, servir un héros, engager, préparer une route | 2, 6, 7, 8, 9 |
| Départ | Choisir le groupe, l'approvisionner, partir | 3, 8 |
| Fiche du héros | Lire le héros, dépenser ses PX, utiliser ses provisions en route | 2, 7, 8 |
| Expédition | Avancer, utiliser les sacs, rentrer | 4 |
| Récit d'une salle | Lire ce que la salle laisse, revoir le combat quand il s'y raconte, continuer | 5, 6 |
| Rejeu du combat | Voir le combat joué : qui agit, dans quel ordre, ce que chaque coup fait ; son issue | 5 |
| Réglages | Régler la taille de l'interface, recommencer | — |
| Recommencer | Confirmer l'effacement | — |

Le récit et Recommencer sont un **carton** (`carton` d'`ecran.ts`, gabarit « Récit, document et issue ») : la scène du
lieu n'y garde que son cartouche et le socle, qui reste ; seuls les gestes du carton répondent. Un combat se clôt à
son **issue** (bannière, ce qu'elle laisse, un geste ; tâche du rejeu) : une victoire rend la main à l'expédition sans
carton ; une déroute ou une retraite passe de l'issue au carton qui raconte le retour.

Repères du parcours, à la manière de Darkest Dungeon (aucun texte d'aide) : le but et ses maîtres en losanges au
panneau Partir ; le rôle de chaque héros en pictogramme (`ROLES`), son identité au survol de sa carte ; une pastille
sur le héros qui peut acheter un avancement et sur le bâtiment qui peut s'agrandir ; la raison d'une carte fermée au
survol ; le dernier fait du journal sous le cartouche du hameau.

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
  `grande`), sans cadre qui rogne ce qui doit tenir ni bouton hors de l'écran ;
- `rejeu.mjs` : une mêlée nombreuse (Animosité, chamane) jouée en entier, les héros à terre gardés dans l'ordre du
  tour, « Échap » qui mène à l'issue avant de fermer ;
- `socle.mjs` : le socle au même rectangle partout, et sept héros atteignables ;
- `instantanes.mjs` (avec `partie-fixe.ts`) : le HTML de chaque écran sur une partie fixe, à comparer avant et après
  une refonte qui ne doit rien changer ;
- `images.mjs` (même partie fixe, à une taille donnée) et `comparer.py` : l'image de chaque écran, comparée au pixel
  près avant et après une refonte du style.

Un écran n'est fini que si ses critères passent à 1280 × 720 et 1920 × 1080, avec une capture regardée ; le
téléphone est un test de fumée.
