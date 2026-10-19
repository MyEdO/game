# La modale d'attaque refaite dans le prototype Godot : l'effort comparé (2026-10-19)

Ticket: #2794

Rapport du ticket #2870 (« Essai : refaire la modale d'attaque dans le prototype Godot et comparer l'effort »), sous-ticket de l'épique #2794 (« un moteur de jeu tiers gratuit plutôt que rendu et interface maison, `src/engine` conservé ? »). Il fait suite à `docs/plans/2026-10-18-humanoide-gltf-deux-moteurs.md`. Ce n'est pas le début d'une migration : la décision appartient à l'épique.

## Pourquoi cet essai

Les essais précédents ont chiffré le rendu et les modèles 3D, pas la réécriture de l'interface de règles, qui pèse 22,8 % du code (`docs/plans/2026-10-18-stratification-presentation.md`). Clément, verbatim (2026-10-19) : « Ok. C est quoi la suite ? », puis il a choisi « Mesurer l'interface » sur la carte « Choisir la suite de l'épique moteur : mesurer l'interface Godot ou trancher maintenant ? », dont la conséquence affichée était : « Je refais la modale d'attaque dans le prototype Godot et je compare l'effort, puis tu tranches. »

L'étalon est la modale d'attaque de mêlée du joueur, lue sur `origin/main` `b755c636cb`. Elle n'a pas de composant à elle : c'est l'étape `jet:'attack'` d'une séquence de combat, rendue par `RollShell` (`src/ui/RollShell.tsx`) avec les props de `useAttackJetProps` (`src/ui/jetProps/useAttackJetProps.tsx`), hébergée par `CascadeModal`.

## Ce qui a été construit

Branche `poc/godot`, jamais fusionnée, de `02fbbaa416` à `3baf8483b9`, en trois commits. `src/` n'a pas bougé.

**Repris de l'étalon** : titre et sous-titre ; en-tête attaquant contre cible avec jauges de Blessures, arme et « Dégâts +N » ; sélecteur de Localisation (« Au hasard » et six localisations à −20) ; rangée d'attaque « base ±mod = cible », Difficulté et modificateurs ; rangée de défense masquée avant le jet ; « Lancer » au clic ou à Entrée, roulis des dés, puis d100, ✓/✗ et DR par rangée ; accent gagnant/perdant et « DR net » ; phrase de touche ; « Relancer ×N » et « Chance : +1 DR ×N », masqués quand ils ne sont pas offerts ; « Annuler » (et Échap) avant le jet, « Appliquer » après.

**Écartés** (choix par défaut, raison au ticket) : Pacte, Résilience et Inversion ; les options conditionnelles (deux armes, Retenir ses coups, Empoigner, choix d'arme, Localisation du Critique) ; les fiches Codex au survol ; la défense surfacée en coopération, la Maladresse et la Déviation.

**Trois pièces**, chacune écrite par un agent sous brief, puis relue :
- **Le pont** (`poc/godot/pont/pont.ts`) sert six méthodes à la modale : `apercuAttaque`, `lancerAttaque`, `relancerAttaque`, `chancePlusUnDR`, `appliquerAttaque`, `annulerAttaque`. Le contrat est fixé dans `poc/godot/pont/CONTRAT.md`. La résolution (`resoudre`) et l'application (`appliquer`) sont deux fonctions, que l'attaque de l'IA et la modale partagent.
- **La modale** : `scenes/ModaleAttaque.tscn` et `scripts/modale_attaque.gd`, plus une rangée de jet réutilisée deux fois (`scenes/RangeeJet.tscn`, `scripts/rangee_jet.gd`). Couleurs, bordures et tailles vivent dans le thème `theme/wfrp.tres`. Seule l'attaque d'un héros ouvre la modale ; l'IA attaque sans elle.
- **La jonction** : « CRITIQUE ! » n'apparaît que dans la phrase de touche, une seule fois, comme dans le jeu. Les influences non offertes sont masquées, comme `src/ui/ChanceButtons.tsx:47,63`. Les glyphes ✓ ✗ → ↳ manquaient à la police par défaut de Godot en web : un sous-ensemble de DejaVu Sans Bold (37 524 octets, licence Bitstream Vera jointe) sert de repli dans le thème.

## L'effort comparé

| | Prototype Godot (sous-ensemble repris) | Jeu actuel (`origin/main` `b755c636cb`) |
|---|---|---|
| Code propre à l'écran | 260 lignes GDScript (`modale_attaque.gd` 194, `rangee_jet.gd` 66), +23 −4 dans `combat.gd` | 365 lignes (`useAttackJetProps.tsx`) |
| Description de l'écran | 283 lignes de scènes (`ModaleAttaque.tscn` 225, `RangeeJet.tscn` 55, `Combat.tscn` +3), 4 lignes d'`InputMap` | dans le JSX et les props |
| Style | +215 lignes de thème (10 StyleBox, 18 variations de type, la police de repli) | 1 189 lignes de CSS dédié, plus une part non isolée de `components.css` |
| Coquille commune à tous les jets | aucune (la rangée de jet est la seule pièce réutilisable) | 4 023 lignes dans 27 fichiers (`RollShell`, `RollRow`, `RollLine`, `VsHeader`, `ChanceButtons`…) |
| Couche entre l'écran et `src/engine` | pont : +259 −25 lignes, +142 lignes de tests (15 tests) | `src/state` : `FLOWS.attack` (`rollFlowSpecs.ts:516-637`), verbes d'attaque (`combatSlice.ts:2280-2486`), clic d'attaque (`targetingModes.ts:495-722`), aperçu et application dans `combatFlow.ts` |
| Temps de code, hors recette | pont ≈ 17 min, modale ≈ 14 min, en parallèle | — |
| Jonction et recette au navigateur | ≈ 41 min | — |
| Churn sur 90 jours | — | 34 commits sur `useAttackJetProps.tsx` ; 169 sur l'UI de jet ; 389 sur les fichiers d'état concernés (fichiers entiers) |

Les temps sont ceux d'agents Claude, pas d'un développeur humain : ils situent l'effort, ils ne le prédisent pas. Les lignes du jeu comptent des fichiers qui servent aussi d'autres jets et d'autres mécaniques ; elles ne se soustraient pas terme à terme de celles du prototype.

**Lecture** : un écran de règles se refait dans Godot pour un effort du même ordre que son code propre dans le jeu, soit quelques centaines de lignes par écran. Ce que la modale Godot n'a pas, c'est la coquille commune (4 023 lignes) qui fait que, dans le jeu, chaque nouveau jet ne coûte que ses props. Migrer toute l'interface de règles demanderait de reconstruire cette coquille en scènes Godot, puis chaque écran par-dessus. L'essai ne mesure qu'un écran sur cette coquille absente, donc il majore le coût d'un écran et ne dit rien du coût de la coquille.

## Ce qui s'est réglé dans l'éditeur, et ce qui a demandé du code

**Sans code** (scène, thème, réglages du projet) : toute la mise en page (ordre des zones, centrage, largeur minimale, espacements, colonnes de la rangée), les couleurs, bordures, rayons et tailles de police, la jauge, le voile, la durée et la cadence du roulis (minuteurs), les touches (`InputMap`), l'état initial des zones, la rangée réutilisée en instance, la police de repli.

**Avec code** : le remplissage des textes, le choix du style selon l'état (réussite, échec, attente), la création des pastilles de modificateurs, la bascule avant/après le jet, les visibilités conditionnelles, le roulis, l'interception d'Entrée et d'Échap (pour qu'Entrée ne finisse pas aussi le tour), les appels au pont.

C'est le partage habituel d'une interface Godot : la forme se règle dans l'éditeur par quelqu'un qui ne code pas, la logique reste en GDScript.

## Ce que le pont a dû refaire de `src/state`

Le pont prend à `src/engine` tout ce qui y est (`attackModifiers`, `finishMelee`, `issueAuJet`…) et importe telles quelles les fonctions pures de `src/state` (`previewDefense`, `rollLine`, `composeRollLabel`, `rerollAvailable`, `actorInfluenceView`). Il a dû reproduire sept morceaux, parce qu'ils lisent le store ou ne sont pas exportés :

1. `previewAttack` (`src/state/combatFlow.ts:944-1001`) lit le store et la scène par `attackEnv` : son calcul est refait sans environnement, portée ni ligne de vue.
2. `defenseDodgeMods` (`combatFlow.ts:1011`) prend la scène : remplacé par une liste vide.
3. `rederiveAttack` (`src/state/rollFlowSpecs.ts:72-101`, branche mêlée) n'est pas exportée et tire par `battleRng()` : six lignes refaites.
4. `opReroll` (`src/state/rollFlowFactory.ts:423-439`) est privée et écrit le journal du store : refaite.
5. `opBonusSL` (`rollFlowFactory.ts:442-451`) est privée : refaite.
6. La relance re-résout l'attaque entière, défense comprise, par `resolveAttack`, qui prend le store (`rollFlowSpecs.ts:561`) : le pont rappelle `resolveMelee`.
7. Des constantes d'interface : la liste des localisations, l'intitulé « Attaque », « Au hasard » et « (−20) » (`useAttackJetProps.tsx:35,83,273-277`).

C'est la condition déjà relevée par #2793 et ouverte en #2817 (« Combat : résoudre et appliquer une attaque sans le store (fonctions pures appelables par tout hôte) »). Avec ces sept morceaux, le pont tient ; mais chaque écran de règles reporté dans Godot répétera l'exercice pour son propre flux tant que #2817 n'est pas fait.

## Frictions

1. **Glyphes** : la police par défaut de Godot n'a ni ✓, ni ✗, ni →, ni ↳, et le web n'a pas de police système de repli. Corrigé par une police libre de repli dans le thème, réglage sans code.
2. **Liseré gauche seul** : `StyleBoxFlat` n'a qu'une couleur de bordure, donc le liseré réussite/échec colore tout le tour de la rangée, pas seulement la gauche comme `.rm-roll.ok`. Il faudrait deux boîtes imbriquées ou un dessin par code.
3. **Gras partiel** : un `Label` ne met pas « 35 » seul en gras dans « 45 −10 = 35 » ; il faudrait un `RichTextLabel`.
4. **Petit texte à 800×600** : l'échelle `canvas_items` réduit tout à 0,625 ; le texte de 12 à 13 px tombe vers 8 px réels, lisible mais à la limite (capture `8-sonde-800x600.png`).
5. **Icône de dé** absente de la colonne du jet : texte seul.
6. **Autoload absent en `--script`** : une sonde headless lancée par `--script` ne voit pas l'autoload `Pont` ; elle doit tourner comme scène principale.
7. **Le pont n'est typé nulle part** : `tsc` sur `poc/godot/pont` est refusé par la garde des portes de CI du dépôt, et aucune CI ne couvre `poc/`. Les tests du pont (15/15) sont la seule vérification.
8. **Écarts au contrat**, sans effet sur le jeu : `LigneApres` n'a ni `base` ni `difficulte`, donc la rangée de défense n'affiche que sa cible après le jet ; l'égalité du moteur sort en `defenseur` ; « Relancer » relance l'attaque entière, comme le jeu.

## Recette

Build debug, Chromium headless avec rendu logiciel SwiftShader, souris et clavier réels, 1280×720.

**Vue 3D**, console à 0 erreur et 0 avertissement :
- 85 attaques par la modale, « Lancer » 43 fois au clic et 42 fois à Entrée ; « Relancer » une fois (DR −7 → −4) ; « +1 DR » une fois (−4 → −3) ; Échap une fois avant le jet ; Localisation « bras droit » choisie dans la liste, cible recalculée « 40 −20 = 20 Difficile (−20) ».
- Après chaque « Appliquer », les Blessures de la cible à l'écran ont baissé du nombre annoncé par la phrase (par exemple 15 → 12 pour 3, 7 → 2 pour 5), et `blessuresPerdues` du pont lui est égal chaque fois.
- **Partie jusqu'à l'issue** : en frappant l'adversaire adjacent le plus faible et en dépensant « Relancer » puis « +1 DR » à chaque jet raté, la partie se termine sur une victoire au round 5, après 14 attaques par la modale (capture `9-ecran-de-fin-3d.png`), console à 0 erreur et 0 avertissement.
- **Partie bloquée** : en frappant l'adversaire le plus proche sans dépenser la Chance, la même graine ne finit jamais (arrêtée au round 55, capture `10-partie-bloquee-round-55.png`). Un brigand reste à 0 Blessure, À Terre mais pas Inconscient, et donc en jeu (`src/engine/conditions.ts:976`). Le pont n'exécute pas l'entretien de fin de round : `tickDeath` (`conditions.ts:1044`), qui rend Inconscient au bout de rounds à 0 Blessure, n'est appelé nulle part dans `poc/godot/pont/pont.ts`, pas plus que l'Hémorragie (un héros y vit avec Hémorragique 33). Ce manque date du prototype de #2793 et ne vient pas de la modale ; dans le jeu, il passe par les crochets de fin de round de `src/state` (`src/state/combat/roundHooks.ts:228`), ce qui en fait un huitième morceau à reproduire tant que #2817 n'est pas fait.

**Vue 2D** (`?vue=2d`), console à 0 erreur : une attaque complète par la modale (Échap, Localisation, Lancer, Relancer, +1 DR, Appliquer).

**Tests du pont** : 15/15, dont 8 neufs pour la modale ; « lancer puis appliquer » donne les mêmes Blessures et la même vue qu'`attaquer` à graine égale, sur 15 graines. Six mutations du pont font chacune échouer le test attendu.

## Captures

Dans le dossier du projet `poc-godot/captures-modale/` :
- `1-avant-le-jet.png`, `2-apres-le-jet.png`, `3-apres-relancer.png`, `6-apres-plus-un-dr.png` : la modale en 3D, au fil d'une attaque.
- `5-localisation-ouverte.png` : le sélecteur de Localisation.
- `4-plateau-apres-appliquer.png` : le plateau après « Appliquer ».
- `7-vue-2d-apres-le-jet.png` : la même modale sur la vue 2D.
- `8-sonde-800x600.png` : la modale à 800×600, remplie par une sonde avec des données d'exemple (avant la jonction, d'où le « CRITIQUE ! » en double).
- `9-ecran-de-fin-3d.png` : l'écran de fin de la partie 3D, « Victoire », round 5.
- `10-partie-bloquee-round-55.png` : la partie bloquée décrite plus haut.

## Lecture pour l'épique

- **L'écran lui-même n'est pas le coût dominant.** La modale se refait en quelques centaines de lignes, dont une bonne part se règle dans l'éditeur sans code, et elle tient à 0 erreur contre le moteur du jeu.
- **Le coût est dans la couche du dessous.** Pour un seul écran, le pont a dû reproduire sept morceaux de `src/state`, plus l'entretien de fin de round qui lui manquait déjà. Chaque autre écran de règles demanderait le même travail pour son flux. #2817 (« Combat : résoudre et appliquer une attaque sans le store ») lève cette condition pour l'attaque ; il faudrait la même chose pour la défense, les sorts, les tests et l'entretien.
- **La coquille commune est à reconstruire** avant d'aligner les écrans, ce que l'essai n'a pas chiffré.
- **Les frictions de Godot sont réelles mais petites** : chacune se contourne (police de repli, `RichTextLabel`, boîtes imbriquées), aucune n'a bloqué l'écran.

## Ce que l'essai ne mesure pas

- La coquille commune des jets en Godot, ni le coût des autres écrans de règles (défense, sorts, tests simples, fiche de personnage).
- Le rendu des fiches Codex au survol, présentes sur chaque libellé et chaque pastille du jeu.
- Le coût de maintenir deux langages (TypeScript pour les règles, GDScript pour l'écran) et un contrat entre eux.
- L'avis d'un joueur sur l'écran : les captures sont celles d'une recette pilotée par script.
