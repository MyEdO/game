Sous-issue de #2794 (UI Godot). Prérequis partagé avec #3328 (le kit est sa couche 2) et #3009 (parité : les écrans hors partie). Absorbe le volet visuel de #3534 (frise, cartes, paysage : ses écarts à la maquette se ferment ici, lot 2). Corrige au passage #3512 (la fenêtre vide reçoit sa planche, lot 7) et solde l'essai #2870 (lot 3).

Ticket: #3935

Texte à jour du corps de #3935 au 2026-11-12 (le corps du ticket en est une version antérieure). Archive datée, pas une référence vivante.

## Demande

Clément, 2026-11-11 :

> Bon on a connecté Godot au noyau et l interface est brute. J ai besoin d un fable qui s occupe de créer l interface final côté Godot à partir de tout ce qu on s est dit, et en n oubliant pas que l ancienne interface web était un échec. Par créer je ne parle pas juste de me fournir une maquette car jusqu'à maintenant Claude a toujours été incapable de le respecter une fois qu il doit l appliquer. Non il me faut un vrai plan de bout en bout

Le même jour, sur les écrans de #3534 :

> ton interface est tellement loin de la maquette que tu avais proposé qu au final je ne sais même pas quel est l objectif de ce que tu me montre

> Tu sais on fait un jeu vidéo. La on dirait un simulateur des années 1990 quand on jouait sur un terminal

> Il manque les portraits et leur cadre, surtout que ça revient très soivent

> Tous les jeux 3D offres des portraits dupliquer modèle 3D du personnage

> Tu sais si tu ne me montre pas, je peux difficilement te repondre

## Réponse courte

**Il n'y aura plus de maquette à appliquer.** Aujourd'hui la cible est dessinée ailleurs (une page HTML, une planche) puis traduite à l'œil dans le jeu, et rien n'échoue quand la traduction s'écarte. Le plan supprime cette traduction : la cible d'un écran est une capture de cet écran, rendue par le vrai jeu (son routeur, son thème, ses composants, son monde, ses portraits) sur un état de partie enregistré. C'est cette capture que Clément valide. Validée, elle devient l'étalon de l'écran, versionné avec son empreinte, et chaque changement s'y compare au pixel près.

Le reste du plan en découle : un banc qui rend et compare (lot 0), une direction visuelle posée une fois dans le thème et le kit avec de l'art d'interface, jugée contre le genre puis validée sur un écran complet avant toute vague (lot 1), puis les écrans par familles, chacun mené jusqu'à son étalon (lots 2 à 8).

## Constat

### L'interface web (ce qu'il ne faut pas refaire)

L'historique git de ce dépôt ne remonte qu'au 2026-11-07 ; la frise vient des docs datés, des soldes et des fiches.

- **Cinq cibles de HUD en dix semaines, aucune menée au bout** : lot « lisibilité » (2026-06-08, `docs/superpowers/specs/2026-06-08-lot1-lisibilite-combat-hud-design.md`), HUD « façon BG3 » le lendemain, refonte du 2026-07-31 (« a empiré l'interface », `docs/plans/2026-08-16-hud-combat.md:9-11`), console Rogue Trader (2026-08-16), planche du 2026-08-17. Le solde `.claude/soldes/1592.md` purge ensuite 43 plans : les cibles ne sont plus consultables.
- **La planche validée n'est pas respectée, et le dépôt ne la contient même pas.** Clément, 2026-08-17 (`docs/plans/2026-08-16-spec-hud-combat.md:161-163`, `:224-226`, `:26-27`) : « Le design ne fonctionnera pas si le contenu n'est pas respecté. Tu as mis l'habillage mais pas le fonctionnement attendu » ; « tes blocs sont tous déconnecté » ; la barre d'actions mesurée à 28 % de l'écran contre 20,1 % sur la planche.
- **Aucun contrôle ne regardait l'écran.** `src/ui/ui-ratchets.test.ts` (1 681 lignes) lit le texte des sources. La ligne `JUGE-VISION:` du commit exige une phrase, pas une image : 46 puis 48 captures citées par des soldes et absentes de git (`.claude/soldes/revue-palier-2026-09-11-3310f2cae-e1ae5618c.md:24`). La recette navigateur mesure que ça tient et que ça se clique. Aucun test n'a jamais comparé un rendu à une image cible.
- **La structure permettait de diverger** : 764 fichiers sous `src/ui`, 242 primitives arrivées après les écrans (verbatims de #3328).

### Godot depuis cinq jours (mesuré à `d389d658`)

- **Le même scénario s'est rejoué.** La maquette de #3534 (deux écrans HTML en 1440×900) a été « appliquée » par passes sur un jeu en 1280×720 : couleurs, police, cartes. La comparaison côte à côte n'a été montée qu'après la remarque de Clément.
- **La maquette montre ce que le jeu ne porte pas** : illustration et prose du lieu, gens du lieu, description et état d'un service, mini-carte, étapes nommées, paysage. Aucun de ces contenus n'est dans la vue du pont. L'écart était inscrit dans la cible.
- **Le jeu n'a aucun art d'interface.** `hotes/godot/projet/art/theme.tres` : 10 ko, 17 `StyleBoxFlat`, aucun `StyleBoxTexture`. Sous `projet/` : 0 icône, 0 texture d'interface, 0 cadre, 0 illustration. Les 257 icônes du jeu existent en SVG (`src/data/icons/defs/*.ts`) mais ne sont pas exportées vers Godot. Avec des aplats arrondis et du texte, le meilleur rendu possible est un tableau de bord.
- **Un seul composant dessine dix-neuf choses.** Le composant d'un élément se trouve par son seul type (`zone.gd`, `res://composants/<type>.tscn`), et `entite` sert pour un héros, un service, un trajet, un rayon d'étal, un panier, une armée, une arme, une section de fiche (19 sites dans `src/hote/ecran.ts`). L'écran ne peut pas distinguer une carte de héros d'un rayon de boutique.
- **Fini voulait dire « recettes vertes ».** Les recettes (`hotes/godot/recette.mjs`) prouvent les clics. Elles prennent des captures, que personne ne compare à rien. Elles ne tournent pas en CI.
- **Ce qui est sain et sur quoi le plan s'appuie** : le pont ne porte aucune règle ; un écran est une scène sans script ; tout style vit dans le thème (0 `theme_override`) ; la sonde fige déjà 39 vues de l'écran (`hotes/godot/recettes/ecran.ts`) ; un pont figé existe pour les recettes (`projet/recettes/pont_fige.gd`) ; l'export Web et les recettes au navigateur tournent dans un conteneur (parcours `voyage` rejoué vert, 7 captures).
- **Couverture réelle** : 62 clés de fenêtre au noyau, dont 13 ont une vue figée ; 13 dispositions dédiées, le reste passe par la fenêtre générique ; aucune vue figée du dialogue, des gestes d'exploration ni de l'aperçu de combat ; l'accueil est trois boutons hors de toute disposition.
- **Bruit de rendu, mesuré** (le parcours `voyage` joué deux fois sur le même export, 7 captures comparées) : l'interface est identique au pixel près d'un rendu à l'autre. Deux choses seulement varient : le monde 3D visible derrière les panneaux (pluie, effets, clips de repos : jusqu'à 2,3 % des pixels) et les portraits (0,4 %, le studio arrête le clip de repos à un instant qui dépend de l'horloge, `studio_de_portraits.gd:72-74`).

## Diagnostic

| Cause | Preuve | Ce que le plan change |
|---|---|---|
| 1. La cible vit dans un autre médium que le jeu | planche du 08-17 absente du dépôt ; maquette HTML 1440×900 pour un jeu en 1280×720 | la cible est une capture du jeu, à la taille de la fenêtre de Clément |
| 2. La cible montre ce que le jeu n'a pas | contenus de la maquette absents de la vue | la cible se rend sur des réponses du pont : elle ne peut montrer que ce que la vue porte |
| 3. Rien n'échoue quand l'écran s'écarte | aucun comparateur, `JUGE-VISION` en prose | l'étalon se compare en CI, un pixel d'écart fait rouge |
| 4. L'habillage se pose sur le contenu existant | « Tu as mis l'habillage mais pas le fonctionnement attendu » ; passes « palette, police, cartes » sur Godot | la forme par usage se tranche avant l'art ; un écran se mène seul jusqu'au fini ; jamais de passe de thème sur tous |
| 5. Aucun art d'interface | 0 texture, 0 icône, 0 cadre | l'art d'interface se pose avant les écrans, sur un étalon jugé contre le genre |
| 6. Un composant par type de donnée | `entite` × 19 | la disposition choisit la forme de ce qu'elle montre |
| 7. Cible mouvante, questions en rafale | 5 cibles en 10 semaines ; « je ne répondrais pas a ces questions » | une porte de goût par lot, sur capture ; le genre répond aux questions de disposition |

## Invariant

1. **La cible d'un écran est sa propre capture.** Un écran n'a pas d'autre référence visuelle que son étalon : la capture, validée par Clément, du jeu rendu par Godot sur sa planche. Une maquette dessinée hors du jeu ne vaut qu'intention de disposition (fiche `user-doctrine-reference-rt-par-defaut-deviation-validee` : « une annotation de maquette n'est pas une spec de rendu »).
2. **Un écran, c'est une disposition, le kit et le thème** (#3328, inchangé) : aucune ligne de GDScript par écran, aucun style hors du thème.
3. **Fini veut dire étalon validé et tenu.** Un écran sans étalon validé n'est pas fini, quel que soit l'état de ses recettes. Un étalon dont l'image a changé depuis la validation n'est plus validé.

L'étalon n'est pas une garde : c'est une sortie attendue, de même nature qu'un test de règle (`src/engine/golden-combat.test.ts`). Il compare une image à une image, sans masque, sans tolérance par écran et sans liste d'exceptions.

## Le mécanisme

**La planche.** Un état de partie enregistré : les réponses du pont qui le montrent (la suite de `demarrer`, le monde, la fiche ouverte), écrites une fois dans `hotes/godot/etalons/planches/<nom>.json` et versionnées. À l'adresse `?planche=<nom>`, l'accueil pose à la place du pont celui qui rend ces réponses (`PontDePlanche`) et ouvre le jeu : le routeur `combat.gd` montre la planche comme une partie, sans une ligne de plus, avec le monde et les portraits. Clément peut ouvrir n'importe quel état de n'importe quel écran sur le déploiement de test, sans jouer jusque-là.

La planche est versionnée, et non rejouée à chaque build, pour qu'un étalon ne bouge que si l'interface bouge : une règle qui change un jet ou une ligne de journal ne déplace aucun pixel. Le contenu vivant de la vue reste prouvé par la recette native (`projet/recettes/ecran.gd`).

**L'étalon.** `hotes/godot/etalons/<nom>.png` : la capture de la planche à la taille de la fenêtre de Clément (vue `bureau` de `scripts/recette/vues-recette.json`, 1707×780), monde caché, portraits pris sur une pose fixe. Ainsi rendue, l'image est exactement reproductible, et l'écart attendu est nul.

**La validation.** L'accord de Clément est un verbatim daté sur ce ticket. `hotes/godot/etalons/valides.json` en garde la date et l'empreinte de l'image validée. Le banc ne compte validé qu'un étalon dont l'image a cette empreinte : un étalon régénéré sort du compte et repasse par la porte de goût, sans que personne ait à s'en souvenir.

**Le banc.** `hotes/godot/etalons.mjs` (`npm run godot:etalons`) : chaque planche ouverte dans un navigateur neuf, comme Clément l'ouvre, capturée après le dernier portrait, comparée à son étalon. Il écrit un rapport (étalon, rendu, différence, et la même planche avec son monde pour l'œil) et sort en erreur au premier pixel d'écart. Il tournera en CI dans un job à lui, déclenché par les chemins de l'interface (`hotes/godot/`, `src/hote/`), posé par une seconde PR après mesure sur le runner.

**Les critères d'un écran :**

| Critère | Mesure | Seuil |
|---|---|---|
| C1. Fidèle à l'étalon | pixels qui diffèrent de l'étalon | 0 |
| C2. Ça tient | à la taille `portable` (1366×650) : textes coupés, boutons hors de l'écran, boutons qui se recouvrent | 0 |
| C3. Un jeu, pas un formulaire | grille des juges (ci-dessous) | aucun défaut bloquant, deux juges d'accord |
| C4. Validé | verbatim daté de Clément, empreinte de l'image | présents |

**La grille C3**, appliquée par deux instances neuves, en aveugle, qui ne reçoivent que la capture, la référence de genre de la famille d'écran et les étalons déjà validés (barre d'art du 2026-07-16 : « validé par des juges en aveugle avant ») :
- ce que l'œil voit d'abord est ce que le joueur doit faire ;
- aucun bloc de texte permanent hors du journal et de la prose ; le détail s'ouvre à la demande ;
- chaque héros a son portrait encadré, chaque action son icône ;
- aucun contrôle au style par défaut du moteur ;
- l'écran tient à côté de la référence de genre, et il est de la même main que les étalons déjà validés.

**Le rail d'un écran**, dans cet ordre :
1. *Intention* : ce que le joueur fait là, et ce que fait le genre (Rogue Trader par défaut, puis Baldur's Gate 3 et Pathfinder).
2. *Planches* de ses états, enregistrées depuis une partie. Ce qui manque à la vue (une prose, une image) est un lot de donnée nommé, ou sort de la cible.
3. *Disposition* dans Godot avec le kit. Un besoin neuf passe d'abord par le kit et sa planche.
4. *Mesure* C2, puis juges C3.
5. *Porte de goût* : Clément voit la capture du jeu, monde compris, à côté de la référence de genre. Son accord fige l'étalon (C4).
6. *Branchement* à la partie réelle, recette fonctionnelle du parcours, étalon tenu en CI (C1).

**L'avancement de l'épique** se lit sur le rapport du banc : clés de fenêtre couvertes par un étalon validé sur les 62 du noyau, plus les écrans hors fenêtre (barre du groupe, journal, tour de combat et barre d'actions, dialogue, gestes d'exploration, fiche, création, accueil).

## Lots

- [ ] **Lot 0. Le banc.** *(outil : PR #3942 ; porte de CI : PR suivante.)* Les planches enregistrées (les 38 états de jeu que la sonde fige déjà, création comprise, passée par le pont), l'adresse `?planche=`, le portrait sur pose fixe, le banc `etalons.mjs`, le comparateur, le rapport, puis, dans une seconde PR, le job de CI et sa durée mesurée. L'écart entre le conteneur et la CI est mesuré : s'il n'est pas nul, le banc épingle son navigateur plutôt que de tolérer un seuil. Fini quand : le banc rend chaque planche, sort vert deux fois de suite sur le même arbre et sur la CI, et rouge sur deux témoins (une marge du thème déplacée d'un pixel, un bouton retiré d'un composant). Les étalons posés à ce lot sont l'état du jour, non validés : ils ne comptent pas.
- [ ] **Lot 1a. La forme par usage.** Proposition à juger : la disposition dit, zone par zone, quel composant du kit dessine chaque type d'élément (une carte de héros, une carte de service, une ligne de trajet), comme elle filtre déjà ses éléments par préfixe d'id (`Zone.ids`) ; le modèle de vue reste typé par donnée. Alternative : un champ de forme typé dans `src/hote/elements.ts`. Tranchée avant tout art, pour ne pas habiller `entite` × 19.
- [ ] **Lot 1b. La direction : l'art d'interface et le kit.**
  - Une référence de genre par famille d'écran (lieu, combat, fiche, dialogue, commerce) : captures de Rogue Trader, de Baldur's Gate 3 et de Pathfinder, gardées hors du dépôt, et l'analyse existante (`docs/plans/Analyse HUD Rogue Trader.dc.html`).
  - Une cible perceptuelle écrite, tirée de cette référence et des livres de Warhammer (matières, bordures ouvragées, hiérarchie à trois tailles, or réservé à ce qui se presse).
  - L'art d'interface : fonds et cadres de panneau en neuf tranches, cadre de portrait, boutons à quatre états, onglets, jauges, séparateurs, pastilles, dé ; les icônes du jeu exportées vers Godot depuis leur registre ; une police de titre.
  - Le kit : chaque composant repris sur cet art, les listes et les saisies comprises (aucun contrôle au style du moteur), dans les formes du lot 1a.
  - La planche du kit : chaque composant, chaque ton, chaque état.
- [ ] **Lot 1c. Un écran complet au fini**, pour prouver le rail : l'écran du lieu avec le journal et la barre du groupe, qui encadrent tous les écrans du monde. **Porte de goût n° 1** : la planche du kit et l'écran du lieu, rendus par Godot, à côté de la référence de genre. C'est la porte qui compte : tout le reste est l'application d'un kit validé.
- [ ] **Lot 2. Le monde** (ferme les écarts visuels de #3534) : carte, voyage, halte, récit d'arrivée. Avec ses lots de donnée : prose et image d'un lieu, gens du lieu, description et état d'un service, étapes nommées.
- [ ] **Lot 3. Le combat** : tour et initiative, barre d'actions à icônes, fenêtres d'attaque, de Défense, d'incantation et de soin, Coup Critique, fin du combat, aperçu, pastilles sur le monde. Disposition repensée pour la 3D depuis le genre (#3328, commentaire du 2026-11-04).
- [ ] **Lot 4. Le personnage** : fiche, possessions, création, avancement.
- [ ] **Lot 5. Parler et lire** : dialogue, document, gestes d'exploration, bulles.
- [ ] **Lot 6. Commerce et temps morts** : échoppe, marché et port, entre-deux-aventures, bataille de masse.
- [ ] **Lot 7. Les fenêtres du noyau** : les 49 clés sans planche, qui passent par la fenêtre générique, regroupées par forme (un jet, un choix, une liste, une saisie), chacune avec sa planche, sur le kit.
- [ ] **Lot 8. Hors partie et mouvement** : l'accueil devenu une disposition, sauvegardes, préférences, coop (avec #3009). Les états de survol, de focus et de pression sont des planches. Le mouvement (transitions, dé qui roule) ne se compare pas au pixel : il se valide à la porte de goût sur un enregistrement de l'écran ; les sons suivent le skill `ajouter-un-effet`.

Le lot 0 débloque tout. Les lots 1a, 1b et 1c se suivent et débloquent les lots 2 à 8, qui sont indépendants entre eux ; l'ordre proposé suit ce que Clément regarde aujourd'hui (le monde), puis le cœur du jeu (le combat). Chaque lot commence par enregistrer les planches de ses écrans. Le lot 3 attend les recettes de combat réparées par le fil des écrans.

## Pilotage

- Ce fil mène l'épique. Le fil des écrans de #3534 finit de réparer les recettes ; la suite visuelle (frise, cartes, paysage) passe par les lots d'ici.
- Clément n'intervient qu'aux portes de goût, une par lot, toujours sur une capture du jeu. Sa réponse est consignée ici, verbatim et datée.
- Une PR par écran ou par petit groupe, sur `chantier/<n° de ce ticket>-<lot>`. L'image avant-après d'un étalon se lit dans la PR.

## Hypothèses (révisables)

- **H1.** L'art d'interface (cadres, matières, icônes) se produit dans ce chantier : la demande du 2026-11-11 confie à ce fil de « créer l'interface final côté Godot », et une interface sans art est le tableau de bord d'aujourd'hui. La consigne du 2026-08-04 (« tout ce qui est lié a l'art […] ne les touches pas ») reste entière pour l'art des personnages et du monde, que ce fil ne touche pas. La barre d'art du 2026-07-16 s'applique : cible perceptuelle écrite, étalon jugé en aveugle et validé avant la vague des écrans. L'art est produit par script versionné ou en SVG.
- **H2.** La référence de genre est Rogue Trader par défaut (fiche du 2026-08-24), habillée aux matières de Warhammer.
- **H3.** Bureau d'abord : les étalons sont à la taille mesurée de la fenêtre de Clément (1707×780), C2 se mesure à la taille `portable`.
- **H4.** Les étalons vivent dans git (`hotes/godot/etalons/`), pour que la PR montre l'image changée.
- **H5.** L'image d'un lieu et le paysage du voyage sont des rendus 3D du jeu, comme les portraits, et non des illustrations peintes comme dans le genre : aucun peintre n'est disponible et l'art du monde appartient à un autre fil. Tranché au lot 2 sur pièce.
- **H6.** La direction qui engage est celle du monde (#3534 : carte, journal au jour le jour, écran du lieu, voyage) ; la maquette de #3534 en reste l'intention de disposition. Pour les autres familles, les remarques passées de Clément sont des intentions, et la proposition est libre tant qu'elle sert le système de jeu et les intentions du projet (Clément, 2026-11-11, en commentaire).

## Hors périmètre

- Les règles et le contrat des verbes.
- Les modèles 3D des héros (fil des modèles) ; le portrait suit le modèle.
- L'atelier et l'éditeur (#3006).
- Le compact et le tactile.

## Jugement du plan (2026-11-11)

Plan jugé par une instance neuve en lecture seule avant ouverture. Trois défauts bloquants corrigés ici : l'étalon se régénérait sans validation (d'où la planche versionnée et l'empreinte) ; les étalons étaient à 1280×720 et non à la taille de la fenêtre de Clément ; la planche passait par la recette native, absente de l'export et sans monde ni portraits (d'où le pont figé sous le vrai routeur). Corrigés aussi : écart nul au lieu d'un seuil de bruit, couverture réelle (13 clés sur 62), juges en aveugle contre une référence de genre, forme par usage tranchée avant l'art, job de CI à part.

## Definition of Done

- [ ] Chaque clé de fenêtre et chaque écran hors fenêtre a un étalon validé, daté sur ce ticket, et le banc est vert en CI.
- [ ] Les écarts visuels de #3534 sont fermés par leur étalon.
- [ ] `.claude/rules/ecrans-godot.md` porte le rail d'un écran et la règle de l'étalon, dans le commit qui pose le banc.
