# Retours sur le noyau, vus depuis un hôte tiers (roguelite)

Carnet d'amélioration continue tenu pendant la construction de l'hôte `roguelite/`, qui branche
`src/noyau` sans toucher au code de l'application. Chaque entrée dit ce qui a été constaté, où, et
ce que l'appli pourrait en tirer. Classement : **Trou** (manque qui force un contournement),
**Friction** (faisable mais coûteux), **Idée**.

## Brancher un combat automatique

- **Trou — aucune couture « jouer ce combat jusqu'au bout ».** Pour qu'un combat se termine tout seul,
  l'hôte écrit la boucle lui-même : reprendre les jetons programmés (`tenueDesJetons`), lire la fenêtre
  qui tient la main (`fenetreDuJeu`), jouer son `drive` à défaut un `fenetreValider`, s'arrêter sur
  `victoire` ou `aneantissement`. C'est environ 30 lignes (`roguelite/src/combat.ts`, `jouerLeCombat`),
  que l'hôte texte, les bancs d'équilibrage et une simulation de masse réécriraient chacun.
  Idée : un `jouerJusquAIssue(partie, plafond)` dans `src/hote/partie.ts`, qui rend l'issue.
- **Friction — `fenetreDuJeu` hors de la surface du noyau.** La surface (`src/noyau/index.ts`) ne
  réexporte pas `fenetreDuJeu` (`src/noyau/combatAuto.ts`), alors qu'un hôte en a besoin pour piloter
  la cadence auto : l'hôte importe un module interne.
- **Friction — la fenêtre `victoire` n'a pas de drive en cadence auto.** Tout le reste du combat se
  pilote seul, mais la victoire attend son `fenetreFermer`. C'est logique pour un joueur (butin, dépeçage) ;
  pour un hôte entièrement automatique, la règle « la cadence auto ferme ce qui n'a pas de choix » ne
  s'applique pas ici.
- **Friction — fabriquer une scène de combat passe par les scénarios de test.** `arena` et
  `setEncounters` vivent dans `src/scenes/test-scenarios/_shared.ts`. Ce sont des constructeurs de scène
  généraux (arène dégagée, rencontre posée), utiles à tout hôte qui génère ses combats.
- **Constat — le moteur seul ne tient pas l'état.** `resolveMelee` rend `woundsLost` et `advantageTo`
  sans les appliquer (la cible reste à 12/12 après une touche à 9). C'est voulu : le moteur est pur,
  et le noyau applique. À retenir pour tout hôte qui serait tenté de ne brancher que le moteur : il
  devrait réécrire l'application de la touche, donc passer par le noyau.
- **Trou — un héros piloté par l'IA n'a pas d'yeux.** Le premier réflexe pour un combat automatique est
  de poser `aiControlled` sur les héros. Or `visibleFrom` (`src/noyau/visionState.ts:98`) exclut de la vue
  du groupe tout héros `aiControlled` (pensé pour les PNJ alliés, défenseurs de siège). Avec un groupe
  entièrement piloté, personne ne voit : chaque ennemi devient « Inconnu » au journal. La cadence `auto`
  fait déjà jouer leur tour aux héros sans ce drapeau. Le piège n'est écrit nulle part côté hôte. Idée :
  documenter dans `docs/hote-texte.md` que la cadence auto pilote les héros, et que `aiControlled` est
  réservé aux alliés non membres du groupe.
- **Friction — une arène générée tombe de nuit.** Sans `ambientLight`, la scène suit l'horloge, et la
  partie neuve commence à une heure de nuit : vue à 5 cases, donc des ennemis « Inconnu » au journal
  (`vision.horsDeVue`, `nomEnVue`) dès qu'ils sont à plus de 5 cases. Dans un même round, « Gobelin charge chasseur » est suivi de
  « Inconnu touche chasseur » : la charge nomme le porteur, la touche passe par la vision. Pour un
  lecteur du journal, c'est le même gobelin sous deux noms. Idée : `arena` pourrait prendre la lumière
  en option, et les lignes d'un même geste devraient nommer leur porteur de la même façon.

## Héros hors d'une partie

- **Friction — un héros de roster naît sous une fabrique « locale ».** `createHero` exige une
  `FabriqueDId`. Hors d'une partie, la seule disponible est `fabriqueLocale` (`src/engine/fabriqueDId.ts`),
  documentée « ce qu'elle forge n'y entre jamais », alors qu'un héros de roster entre ensuite dans
  chaque partie. `FabriqueDuRoster` existe, mais aucun constructeur public ne la fournit à un hôte tiers.
- **Friction — « dans la carrière » n'a pas de lecteur public.** Pour acheter une Augmentation au bon
  prix (doublé hors carrière, LDB 07 l.91), il faut les Caractéristiques des niveaux ≤ courant. Le noyau
  les calcule dans `careerCtx` (`src/noyau/partyFlow.ts`), privé : l'hôte recompose
  `inCareerChar(availableChars(levelsForCareer(…), niveau), k)`.
- **Trou — rien entre deux rencontres.** Après une victoire, un héros reste Inconscient, Hémorragique,
  À terre. Le RAW donne la guérison naturelle et le repos (LDB 18 l.296), que l'hôte applique lui-même
  par `rollTest` ; mais l'issue d'un Inconscient hémorragique laissé sans soins après le combat, et la
  levée des États de la rencontre une fois la menace partie, n'ont pas de couture. Un hôte qui enchaîne
  des rencontres décide lui-même.
- **Constat — après une déroute, personne n'est mort.** Les héros finissent Inconscients et
  Hémorragiques, `dead` reste faux : le noyau laisse l'issue de l'anéantissement à l'hôte. Ici, chaque
  héros brûle un Destin pour revenir (LDB 17 l.31), ou meurt s'il n'en a plus.

## Bundle navigateur

- **Friction — 9 Mo minifiés pour un combat.** Le graphe d'import tire tout le corpus : `creatures.json`
  (0,84 Mo), `spells.json` (0,58 Mo), les messages i18n (0,34 Mo), et même les projets de scènes
  `diligence-projet.json` (0,30 Mo) et `arene-projet.json` (0,22 Mo), qu'un combat généré n'utilise pas.
  Idée : charger les projets de campagne et les gros catalogues à la demande.
