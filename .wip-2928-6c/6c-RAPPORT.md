# Lot 6c (#2928, épique #2882) : rapport du codeur

Worktree `/home/user/game/.wt-2928-6c`, branche `chantier/2928-6c` (base `chantier/2928-6b3`). Rien n'est commité ni poussé.

## Fichiers touchés

Créés
- `hotes/godot/projet/.gitignore` : `.godot/`, le cache d'import de Godot.
- `hotes/godot/projet/project.godot` : Godot 4.7, rendu `gl_compatibility`, scène principale `Combat.tscn`, autoload `Pont`, touches Q/E de pivot.
- `hotes/godot/projet/export_presets.cfg` : le préréglage `Web` (sans threads), qui charge `wfrp-pont.js` dans l'en-tête de la page.
- `hotes/godot/projet/art/cases.tres` : la MeshLibrary des cases (sol, infranchissable, atteignable, cible, survol).
- `hotes/godot/projet/scenes/Combat.tscn`, `Plateau.tscn`, `Combattant.tscn`, `Chevalier.tscn` : la scène de combat, le plateau 3D (GridMaps, caméra pivotante), un combattant (modèle, anneau, étiquette), le chevalier habillé.
- `hotes/godot/projet/scripts/pont.gd` (`PontDuNoyau`) : l'autoload qui parle à `globalThis.wfrpPont` par `JavaScriptBridge`, signale refus et pannes (`erreursGlobales`), publie l'écran à la page.
- `hotes/godot/projet/scripts/combat.gd` : applique chaque `Suite` (vue, journal, jetons armés en minuteurs puis `reprendre`), rend chaque geste en intention (offre, verbe de fenêtre, clic du champ choisi par la forme de son premier paramètre).
- `hotes/godot/projet/scripts/plateau.gd` (`Plateau`) : le sol depuis `vue.plateau`, les combattants à leur `pos`, les surbrillances de `vue.cases`, des cibles et de l'aperçu ; clic, survol, pivot, zoom.
- `hotes/godot/projet/scripts/combattant.gd` (`Combattant`) : modèle glTF animé, étiquette nom et Blessures, glissé vers la nouvelle case, frappe vers la cible d'un événement du journal.
- `hotes/godot/projet/scripts/interface.gd` (`InterfaceDuCombat`) : round et tour, fiche de l'actif, barre des offres, raison d'une barre fermée, journal, refus, panne, fin.
- `hotes/godot/projet/scripts/fenetre.gd` (`FenetreDuJeu`) : la fenêtre générique ; la fenêtre d'attaque en données (choix d'un verbe dont l'argument admet chaque option) ; les verbes remplissables en boutons, le premier au focus (Entrée).
- `hotes/godot/projet/scripts/*.gd.uid` (6) : les uid que Godot 4.7 attache à chaque script.
- `hotes/godot/projet/modeles/Knight.glb`, `Skeleton_Warrior.glb` : modèles KayKit élagués à cinq animations (Idle, Walking_A, 1H_Melee_Attack_Chop, Hit_A, Death_A), textures embarquées.
- `hotes/godot/projet/modeles/Knight.glb.import`, `Skeleton_Warrior.glb.import` : réglages d'import (images embarquées, aucune texture extraite dans l'arbre).
- `hotes/godot/projet/modeles/LICENSE-KayKit.txt` : la licence CC0 du pack, verbatim.
- `hotes/godot/recette.mjs` (pas de `servir.mjs` à part : son seul consommateur serait la recette, qui sert l'export en vingt lignes) : la recette du tour complet au navigateur (export servi en statique, clics et Entrée sur le canevas, captures, console).
- `scripts/guards/lib/gdscriptSansRegle.mjs` et `.d.mts` : lexème GDScript (code blanchi, chaînes) et `calculsDeRegle` (familles `hasard`, `chemin`, `mesure`).
- `scripts/guards/lib/gdscriptSansRegle.test.mjs` : la porte du module (formes nues, mise en scène qui passe, commentaires et chaînes ignorés).
- `public/qc/soldes/2928-6c-2-attaque-apercu.png`, `2928-6c-3-attaque-jet.png`, `2928-6c-4-deplacement-apercu.png`, `2928-6c-5-defense.png` : captures de la recette.

Modifiés
- `src/noyau/monde/scene.ts` : `plateauDeLaScene(scene)` (dimensions et cases infranchissables par `isWalkable`), lecteur neuf.
- `src/noyau/index.ts` : l'export de `plateauDeLaScene` ; en-tête.
- `src/noyau/combatAuto.ts` : `FENETRE_DU_JET` porte les `reglages` d'une étape-jet (les actions `<flux>Set…` : attaque 7, défense 4, incantation 4, test 1), ajoutés par `verbesDuJet` aux verbes de la fenêtre.
- `hotes/godot/pont/pont.ts` : la vue porte `plateau`, `champ` (`CLICS_DU_CHAMP`) et `parametres` (les `VERBES` de chaque verbe offert : fenêtre et champ).
- `hotes/godot/pont/contrat.hors-store.test.ts` : le test du plateau, du champ et des paramètres.
- `hotes/godot/pont/CONTRAT.md` : `Vue` (plateau, champ, parametres), réglages des verbes de la fenêtre d'attaque, section « Écran publié » (`wfrpEcran`).
- `hotes/godot/construire.mjs` : modes `--sonde` (éditeur épinglé : téléchargement, SHA-256, extraction en cache, import puis `--check-only` par script, sur une copie temporaire) et `--export --sortie` (bundle puis `godot --headless --export-release Web`) ; en-tête.
- `src/hote/derive-du-noyau.hors-store.test.ts` : la garde des hôtes lit aussi le GDScript (chaînes : ni verbe ni clé de fenêtre) et refuse tout calcul de règle (`calculsDeRegle`).
- `scripts/recette/lib.mjs` : `launchSession({ args })` (drapeaux de Chrome d'une recette) ; `lireProcessus` lit `stat` et écarte les zombies (le Chrome tué que Node n'a pas encore recueilli faisait lever `killChromeTree` à chaque `close()` sous Linux).
- `scripts/recette/lib.test.mjs` : les lignes `ps` à quatre colonnes, un zombie écarté.
- `docs/recette-navigateur.md` : `args` de `launchSession`.
- `docs/architecture.md` : la ligne `projet/` sous `hotes/godot/` (sonde, export, recette).
- `package.json` : le script `godot:sonde`.
- `.github/workflows/ci.yml` : job `types`, cache `actions/cache@v4` de `~/.cache/wfrp-godot` (clé `hashFiles('hotes/godot/construire.mjs')`) puis `npm run godot:sonde`.
- `scripts/gates/toutes.mjs` : l'entrée `ECRIT_LU` de `godot:sonde`.
- `scripts/corpus/gates/ecrivainsAtteints.test.mjs` : `godot:sonde` inscrite ; `hotes/godot/construire.mjs`, devenu écrivain (`--sortie`, cache de l'éditeur), inscrit pour `pont:godot` et `godot:sonde`.
- `.gitattributes` : `*.glb binary` (seule extension binaire ajoutée ; `.tres`, `.tscn`, `.import`, `.cfg`, `.uid` sont du texte).

Supprimés : aucun dans l'arbre (le prototype n'y était pas).

## Ce que le prototype perd, et pourquoi

Tout ce qui calculait une règle, une carte ou une mesure côté GDScript (plan B3) :
- `carte.gd`, `cartes/arene.tres` : la carte vient de la `Scene` (`vue.plateau`, `plateauDeLaScene`).
- l'A*, `_chemin`, `_adjacent`, `_placer` par départs, `_jouer_ia` : les chemins, l'adjacence, le placement et l'IA viennent du noyau (positions de `voisins`, `vue.cases`, jetons repris).
- `mesures.gd`, `simulerAttaque`, le roulis `randi` de la modale : mesures du prototype et dé hors du noyau.
- `ModaleAttaque`, `RangeeJet` : remplacés par la fenêtre générique `fenetre.gd`, qui lit `vue.attaque` et `projection.fenetre`.
- Le plateau 2D, `unite`, l'art SVG, le thème et sa police, l'étiquette en SubViewport : le plateau est 3D (GridMap, Label3D), l'interface prend le thème par défaut.
- `captures/` : non reprises.

## Poids ajouté

- Projet : 1 199 108 o, dont les deux `.glb` 1 161 712 o (583 052 et 578 660), élagués depuis 3 659 532 et 4 863 620 o (8,5 Mo) ; scripts 25 545 o.
- Captures : 918 988 o (4 PNG).
- Recette 8 293 o ; garde 7 112 o.

Ce que la vue gagne, en lecteurs du noyau (rare, et dit) : `plateauDeLaScene` (le plateau de la scène) et les `reglages` de `FENETRE_DU_JET` (les verbes `<flux>Set…` que la fenêtre d'un jet n'annonçait pas : sans eux, ni l'hôte Godot ni le MCP ne voyaient `attackSetLocation` parmi les verbes de la fenêtre d'attaque). Le pont n'y ajoute aucune règle : `plateau`, `champ`, `parametres` sont lus du noyau et de `VERBES`.
- Hors dépôt : l'éditeur (cache `~/.cache/wfrp-godot/4.7-stable/`) et les modèles d'export Web de la machine.

## Sonde de CI (M-f)

- Éditeur `Godot_v4.7-stable_linux.x86_64.zip` (4.7-stable), SHA-256 `0b1a6c54c2c619c12e169fe9241edda4b81080b519451cec2984bf0d2c6cb73c` ; win32 `Godot_v4.7-stable_win64.exe.zip`, `02a5312236f4e0209c78bcb2f52135b1963e6b8888c873c9cee81459e60bcd71`. Épinglés dans `EDITEUR` (`hotes/godot/construire.mjs`).
- `npm run godot:sonde` : `godot --headless --path <copie> --import`, puis `--check-only --script` sur chaque `.gd` ; une ligne `ERROR`/`SCRIPT ERROR` ou un code non nul rougit.
- `.github/workflows/ci.yml`, job `types`, après `pont:godot` : cache `actions/cache@v4` (`~/.cache/wfrp-godot`, clé dérivée du constructeur), puis la sonde.

## La garde GDScript

Principe du plan (B3, M-e) : un script de l'hôte lit la vue et ne calcule aucune règle. Deux classes, dans la garde existante des hôtes (`src/hote/derive-du-noyau.hors-store.test.ts`) :
- noms : aucune chaîne d'un `.gd` ne nomme un verbe (`VERBES`) ni une clé de fenêtre (`CLES_DE_FENETRE`), comme pour le TypeScript des hôtes ;
- calculs (`scripts/guards/lib/gdscriptSansRegle.mjs`, pur) : chaque famille est reconnue par sa forme GDScript, sans aucun nom de fonction du prototype. `hasard` : API de hasard du moteur, préfixe `rand`/`Random`, et `seed`. `chemin` : `AStar…`, `Navigation…`. `mesure` : `distance_to`, différence ou somme de deux coordonnées, coordonnée décalée d'un entier. Le centre d'une case (`case.x + 0.5`) passe.

## Recette du tour complet (critère 4)

Export : `node hotes/godot/construire.mjs --export --sortie <scratchpad>/godot/web` (modèles `web_nothreads_*` seuls, tirés par HTTP Range). Recette : `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node hotes/godot/recette.mjs --web <…>/web --captures <…>`, Chromium 1194 headless, WebGL 2 logiciel (`--use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`). Scénario `dome`, graine 7. Chaque geste est un clic ou une frappe sur le canevas, aux points que Godot publie (`wfrpEcran`) ; `wfrpPont.appeler('vue')` n'observe que.

1. Fenêtre du round : Entrée sur le premier verbe au focus. Fenêtre fermée ; actif Ilyanwe la Voilée, barre ouverte.
2. Offre `charge` cliquée : intention charge, 170 cases peintes.
3. Clic sur l'Orc (7,5) : jetons programmés ; le minuteur Godot reprend le jeton et la fenêtre d'attaque s'ouvre (« Ilyanwe la Voilée — Attaque (Corps à corps (Armes d'hast)) »).
4. Localisation « Tête (-20) » cliquée (`attackSetLocation`, réglage de la fenêtre) : cible du jet 28. Capture `2928-6c-2-attaque-apercu.png`.
5. `attackRoll` : « Ilyanwe la Voilée touche Orc (Tête) : 14 dégâts − 7 (BE+PA) = 7 Blessures. » Capture `2928-6c-3-attaque-jet.png`.
6. `attackConfirm` : fenêtre fermée, Orc 7/14. `end-turn` (armé, deux clics).
7. Berta active : premier clic sur (1,5), aperçu `{genre: move, case: [1,5], cout: 1}`. Capture `2928-6c-4-deplacement-apercu.png`. Second clic : Berta en 1,5. `end-turn`.
8. Les jetons de l'adversaire, repris par les minuteurs : le Tireur gobelin tire, l'Orc attaque ; la Défense s'ouvre (cascade, étape `defenseJet`, à Ilyanwe). Capture `2928-6c-5-defense.png`.
9. `defenseRoll` puis `defenseConfirm` : fenêtre `roundStart`, round 2.
10. `erreursGlobales` : `{"ok":true,"erreurs":[]}`. Console : 3 entrées, 0 erreur, 0 avertissement. Code de sortie 0, aucun Chrome survivant.

`attackCancel` n'est pas joué (#1130).

## Preuves

Toutes en sortie complète, logs sous `/tmp/claude-0/-home-user-game/424b2429-c0ab-5191-a22b-3ce249f68bb5/scratchpad/preuves/` et `preuves2/`.
- `npm run typecheck` : rc 0, aucune ligne d'erreur (un premier passage a rougi sur `Object.hasOwn`, lib ES2021, corrigé dans `pont.ts`).
- `npm run lint` : rc 0 (oxlint, `--max-warnings 0`). `npm run deps:unused` : rc 0, « exports morts : 10 (gelés, 5 fichiers) — aucun nouveau ».
- `npm run test:noyau` : 17 fichiers, 257 tests verts. `npm run test:perimetre` : rc 0, joué(s) 257 (vitest 83, node 174).
- `npm run test:hooks` : 2886 verts, 0 échec. `npm run test:corpus` : 92 verts, 0 échec. `npm run test:corpus-isole` : 4 verts.
- `npm test -- src/comment-poison-guard.test.ts` : 104 verts.
- `node --test scripts/guards/lib/gdscriptSansRegle.test.mjs` : 6 verts. `node --test scripts/recette/lib.test.mjs` : 284 verts. `scripts/gates/*.test.mjs` : tous verts.
- `node scripts/docs/check-doc-refs.mjs` : « docs:check — OK (8 docs vivantes, chemins & symboles vérifiés) » (le premier passage de `test:perimetre` avait relevé un chemin coupé dans `docs/architecture.md`, corrigé).
- Garde GDScript rouge sur une sonde (`hotes/godot/projet/scripts/sonde_rouge.gd`, retirée ensuite) : `sonde_rouge.gd:7 attackRoll` (nom), `:5 hasard randi`, `:6 chemin AStarGrid2D`, `:7 mesure .x - b.x` ; verte sur le projet.
- `npm run godot:sonde` : rc 0, « [godot] 4.7.stable : projet importé, 6 scripts contrôlés (res://scripts/combat.gd, …, res://scripts/pont.gd) » ; prouvée aussi par le chemin de téléchargement (somme vérifiée, extraction en cache).
- `npm run pont:godot` : « wfrp-pont.js : 7 277 187 o brut, 1 795 170 o gzip » ; « demarrer dome et vue ok, second demarrer refusé, erreursGlobales vide ».
- Export Web : `index.html` 5 372 o, `index.js` 279 815 o, `index.pck` 740 812 o, `index.wasm` 39 509 339 o, `wfrp-pont.js` 7 277 201 o.
- Recette : rc 0, console 0 erreur et 0 avertissement, aucun Chrome survivant (voir plus haut).

## Poison hors périmètre

- `scripts/guards/lib/commentPoison.mjs:27` : `PERIMETRE_DES_GARDES.extensions` ne lit ni `.gd` ni `.md` du projet Godot ; les commentaires `##` des scripts GDScript échappent à la garde du poison de commentaire (son lexème est celui du JavaScript).
- `hotes/godot/projet/modeles/LICENSE-KayKit.txt:2` : la licence nomme le seul « Adventurers Character Pack » ; `Skeleton_Warrior.glb` vient du pack « Skeletons » du même auteur, que l'auteur distribue aussi en CC0 ; le dépôt n'en porte pas la licence verbatim, faute de l'avoir sous la main (à verser avec le modèle).
- La fenêtre de Défense ne projette pas ses choix (mode, arme de parade, réaction de bouclier) dans la vue : les réglages `defenseSet…` sont désormais nommés par la fenêtre, mais un hôte n'a pas de données pour les rendre en contrôles (`src/noyau/fenetreDAttaque.ts` : `defense` ne porte que le jet).

## Corrections des juges

Passe de correction arrêtée sur ordre de Laurent (relais à un autre compte), 2026-10-22. Rien n'est commité. Ce qui suit est l'état exact de l'arbre `/home/user/game/.wt-2928-6c`.

### Ce que la passe a changé, en bref

- **Le noyau nomme le verbe de chaque réglage.** Chaque choix et chaque bascule d'une fenêtre porte son verbe et son libellé :
  - `src/noyau/reglages.ts` (neuf) : `ChoixNomme`, `BasculeNommee`, `Reglage`, `reglagesDesElements`, `reglageDuChoix`, `reglageDeLaQuantite` ;
  - `fenetreDAttaque.ts` : localisation, arme, deux armes, retenir, empoigner, sans la corde, Critique, avec `difficulte` en texte ;
  - `src/noyau/fenetreDeDefense.ts` (neuf) : attaquant, défenseur, arme, Test, réaction, arme de parade ; lu aussi par le web, via `useDefenseJetProps.tsx` ;
  - `VERBES_D_INTERACTION` : `cascadeChoose` et `cascadeAmount` portent leur réglage (`combatAuto.ts`).
- **Les libellés vivent au catalogue partagé.**
  - `src/noyau/libelles.ts` (neuf) : `libelleDuVerbe`, `libelleDuParametre`, `libelleDuLitteral`, `libelleDeLaFenetre`, `libelleDuJet`.
  - Clés `verbe.*`, `parametre.*`, `valeur.*`, `fenetre.*`, `jet.*` et `ecran.*` dans `src/i18n/messages/fr.ts`, plus `estUneCle` dans `src/i18n/index.ts`.
  - Le web lit désormais les mêmes clés : `RollRow` (`defaultRollLabel`), `ChanceButtons`, `ResilienceButton`, `DeterminationButton`, `ReverseButton`, `ForcedRollPicker`, `CascadeModal`, `RestModal`, `useFumbleJetProps`, et les boutons « Annuler » et « Appliquer » de 29 modales et `jetProps`.
- **Chaque verbe a son geste.** `src/hote/gestes.ts` (neuf) donne la fonction `fenetreADessiner` : chaque verbe de la fenêtre devient un geste, avec son libellé, chacun de ses arguments et son rendu (`bouton`, `choix`, `liste` ou `formulaire`). Un argument se saisit selon sa forme : `fixe` (le `pid`), `choix`, `nombre`, `texte`, `objet` (champ par champ) ou `json`. Le geste attendu est marqué `attendu`, d'après le `drive`.
- **Le panneau parle au joueur.** `src/hote/ecran.ts` (neuf) donne `panneauDuCombat` : le tour, la fiche (États par `conditionLabel`), l'aperçu avec son coût, la fin du combat, le libellé de chaque offre. La raison de la barre est masquée quand une fenêtre tient la main.
- **La vue du pont change.** `VueDuPont` porte `fenetre`, `defense` et `panneau`. Elle perd `parametres`. `champ` vaut maintenant `{ combattant, case }` (`CLICS_DU_CHAMP`), au lieu d'une liste à deviner par forme.
- **`fallChoose` prend `pid` en premier paramètre** (`actionsDuNoyau.ts`).
- **Défaut du noyau trouvé par le témoin `<flux>Set…`, et corrigé.**
  - Le défaut : les fenêtres réactives (Contre-sort, opposition de cible, Fuir) ne déclaraient pas les verbes de leur flux. `counterspellSetForcedRoll`, `oppositionSetForcedRoll` et `fleeSetForcedRoll` n'étaient dans aucune fenêtre.
  - La correction : `FENETRE_DU_JET.<jet>.reactives` devient la source unique. `STEP_WINDOW_AUTO` en dérive, `fenetreDuJeu` et `verbesDuJet` ajoutent le flux réactif ouvert. `jetsEnVue.ts` dérive ses flux d'étape de cette même table, et l'ancienne `FLUX_D_ETAPE` est supprimée.
- **Changement de l'hôte texte, annoncé ici.**
  - La ligne « verbes » de la vue texte et le message « verbe inconnu » portent déjà, depuis la première passe, les réglages `FENETRE_DU_JET.reglages`.
  - Ils portent maintenant aussi, quand une fenêtre réactive est ouverte, les verbes de son flux (`counterspell*`, `opposition*`, `flee*`).
  - La suite de l'hôte texte reste verte. `scripts/docs/build-hote-texte.mjs:78` n'est pas encore mis à jour (voir plus bas).

### Rapport du juge de diff (`6c-JUGE.md`)

| Point | État | Ce qui reste |
|---|---|---|
| B1, garde GDScript creuse | **Non fait** | Réécrire `scripts/guards/lib/gdscriptSansRegle.mjs` (copie au scratchpad, `node --check`, puis `cp`), son `.d.mts` et son test. Voir le dessin retenu, après ce tableau. |
| B2, fenêtre générique | **Partiel** | Côté TS, fait (`gestes.ts`, réglages nommés, `CLICS_DU_CHAMP`, tests). Côté GDScript, rien. Voir le détail après ce tableau. |
| B3, poison de commentaire du `.gd` | **Non fait** | Voir le dessin retenu, après ce tableau. |
| 1, assertions de la recette | **Non fait** | `hotes/godot/recette.mjs` : un `assert` par étape du critère 4 (round ouvert, fenêtre d'attaque fermée, déplacement de Berta, Défense au héros, round 2), et `erreursGlobales.erreurs.length === 0` au code de sortie. |
| 2, hôte texte et témoin `<flux>Set…` | **Partiel** | Le témoin est fait (`fenetres-nomment-leurs-verbes.hors-store.test.ts`, « chaque réglage d'un flux de jet… »). Il a trouvé trois verbes non déclarés, corrigés (voir plus haut). L'annonce est faite ci-dessus. Reste `scripts/docs/build-hote-texte.mjs:78`, qui doit nommer `FENETRE_DU_JET.reglages` et `reactives`. |
| 3, licence KayKit Skeletons | **Non fait** | Verser la licence verbatim du pack « Skeletons » à côté de `hotes/godot/projet/modeles/Skeleton_Warrior.glb`. |
| 4, `ECRIT_LU['godot:sonde'].lit` | **Non fait** | Ajouter `src/lib/` (ou les zones, comme `pont:godot`) dans `scripts/gates/toutes.mjs`, puis vérifier à l'enregistreur de lectures. Si `ecrivainsAtteints` bouge, mettre son test à jour. |
| 5, test du plateau | **Fait** | `contrat.hors-store.test.ts` : la vue égale `plateauDeLaScene(scene)`. Sur une scène témoin, un mur posé en (4, 3) est infranchissable, et l'herbe en (5, 3) franchissable. |
| 6, `wfrpEcran.pas` | **Non fait** | Le supprimer de `combat.gd` et de `CONTRAT.md`, ou faire attendre à la recette le `pas` suivant. |
| Remarque : angle mort de la sonde | **Non fait** | Dire dans `docs/plans/2026-10-21-vague6-hote-godot.md` (M-f) que `--check-only` ne voit pas une méthode renommée d'une autre `class_name`. |
| Remarque : captures périmées | **Non fait** | Voir la ligne 5 du tableau du juge-vision. |
| Remarque : deux lexeurs | Non fait (facultative) | — |

**B1, dessin retenu pour la garde GDScript.**
- `hasard` : tout identifiant qui répond à `/rand|shuffl/i`, ou `seed` exact. Cela couvre `randi`, `RandomNumberGenerator`, `pick_random`, `randomize`, `rand_from_seed` et `shuffle`.
- Hors d'un unique module de mise en page, trois interdits :
  - toute arithmétique binaire (`+ - * / % ** << >>` et leurs affectations composées). Restent permis le moins unaire, `->`, et `%` ou `+` après un littéral de chaîne. Les chemins `$Noeud/Enfant` sont blanchis avant la lecture ;
  - toute comparaison d'ordre (`< > <= >=`) ;
  - tout appel de mesure (`abs`, `sign`, `clamp`, `min`, `max`, `floor`, `ceil`, `round`, `snapped`, `sqrt`, `pow`, `posmod`, `fmod`, `wrap`, `lerp`, `remap`, avec leur suffixe `i` ou `f`, puis `distance_to`, `length`, `dot`, `cross`, `angle_to`, `direction_to`, `move_toward`).
- Le module de mise en page se reconnaît par sa structure, jamais par son nom : seulement des `const` et des `static func`, chacune typée `Vector2`, `Vector2i`, `Vector3`, `Vector3i` ou `float`, et ni `var` ni `signal` au niveau du script. `derive-du-noyau` vérifie qu'il en existe exactement un.
- Les 9 calculs de la sonde du juge deviennent chacun un cas rouge.
- `pont.gd` attend par minuteur, sans soustraction. Un `mise_en_page.gd` neuf porte la case vers le monde, les ms vers les s, le centre, le quart de tour, le zoom et la case du point.

**B2, ce qui reste côté GDScript.**
- `fenetre.gd`, `combat.gd` et `interface.gd` lisent encore `vue.parametres`, qui a disparu, et `vue.champ` comme une liste. **L'hôte Godot est donc cassé contre la vue actuelle.** La sonde reste verte : `--check-only` ne type pas les dictionnaires.
- `fenetre.gd` doit rendre `vue.fenetre` :
  - le titre, l'étape et le propriétaire ;
  - chaque geste, selon son `rendu` et la `saisie` de chaque argument ;
  - le focus sur le geste `attendu` ;
  - un fond opaque, la fenêtre placée sans masquer les pions.
- `combat.gd` doit lire `vue.champ.combattant` et `vue.champ.case`. `interface.gd` doit lire `vue.panneau`.
- Il manque aussi les lignes du corps de la fenêtre : qui attaque qui, les jets, le DR net et l'issue, en clés `ecran.*` dans le catalogue. Ce rendu côté TS dans `gestes.ts` n'est pas écrit.
- Reste à corriger `CONTRAT.md:72` et sa section Vue.

**B3, dessin retenu pour le poison de commentaire.**
- Dans `scripts/guards/lib/commentPoison.mjs`, une table d'extracteurs par dialecte : TS pour `.ts`, `.tsx`, `.mts` et `.mjs`, GDScript (`lexemesGdscript`) pour `.gd`. `PERIMETRE_DES_GARDES.extensions` dérive des clés de cette table.
- Écarter les `.gd` des gardes qui ne lisent que du TS (`corpusDesGardes`, `analyserCorpus`), par exemple par `scriptKindDe` en refus.
- Un témoin rouge `.gd` dans `src/comment-poison-guard.test.ts`, et le stock reste à zéro.

### Rapport du juge-vision (`6c-JUGE-VISION.md`)

| Point | État | Ce qui reste |
|---|---|---|
| 1, ids bruts à l'écran (verbes, offres, en-tête, difficulté) | **Partiel** | La vue porte chaque libellé : `fenetre.gestes[].libelle`, `fenetre.titre` et `etape`, `panneau.offres`, `attaque.jet.pending.difficulte`. Le GDScript ne les lit pas encore. |
| 2, glyphe « → » manquant | **Non fait** | Le corps de la fenêtre doit être rendu en texte du catalogue, sans ce glyphe (GDScript, plus les lignes côté TS). |
| 3, captures 1 et 6 absentes | **Non fait** | Refaire l'export, puis la recette. Verser `public/qc/soldes/2928-6c-{1-round,2-attaque-apercu,3-attaque-jet,4-deplacement-apercu,5-defense,6-apres-defense}.png`, et remplacer les quatre PNG actuels, qui sont périmés. |
| Cible non nommée dans l'attaque | **Partiel** | Les données sont dans la vue (`attaque.cibleId`). Le rendu n'est pas fait. |
| Défense : qui attaque qui, avec quel jet | **Partiel** | Les données sont là (`vue.defense` : attaquant, défenseur, arme, Test). Le rendu n'est pas fait. |
| Fenêtre opaque, pions non masqués | **Non fait** | GDScript. |
| Coût de l'aperçu du déplacement | **Partiel** | Le texte existe (`panneau.apercu`). L'affichage n'est pas fait. |
| Aperçu et survol effacés après le geste | **Non fait** | `plateau.gd`. |
| Focus sur le geste attendu | **Partiel** | `geste.attendu` est vrai pour le jet avant qu'il tombe, puis pour la confirmation (assuré par le test du tour). Le focus GDScript n'est pas fait. |
| Jargon « une fenêtre tient la main » | **Partiel** | `panneau.raison` vaut `null` quand une fenêtre est ouverte. Le GDScript ne le lit pas encore. |
| Étiquettes Ilyanwe et Orc qui se chevauchent | **Non fait** | `Combattant.tscn` et `combattant.gd` : étiquette plus étroite, avec retour à la ligne. |
| « Action : libre » pour l'Orc pendant son attaque | **Non vérifié** | Hypothèse : l'action ne se consomme qu'à la confirmation. Reste à le prouver dans l'état. Le libellé devient « disponible » ou « jouée » (`ecran.action.*`). |

### Tests ajoutés ou réécrits

- `hotes/godot/pont/pont.testkit.ts` : `fautesDeLaFenetre`, `gesteDe`, `argsDe`.
- `tour.hors-store.test.ts` :
  - le tour se joue par les gestes de la vue ;
  - à chaque réponse, chaque verbe de la fenêtre ouverte a son geste et chacun de ses arguments, nommés ;
  - les fenêtres `roundStart`, `cascade:attackJet` et `cascade:defenseJet` sont vues.
- `contrat.hors-store.test.ts` : le témoin du plateau, et les gestes.
- `src/noyau/fenetres.testkit.ts` (neuf) : relevé commun des fenêtres, fenêtres réactives comprises.
- `fenetres-nomment-leurs-verbes.hors-store.test.ts` : chaque verbe a son libellé, chaque fenêtre son titre, et le témoin `<flux>Set…`.
- `src/hote/gestes.hors-store.test.ts` (neuf) : chaque paramètre, champ et littéral de chaque verbe de fenêtre a son libellé, et chaque désignation existe.

### Preuves (rejouées au premier plan après le redémarrage du conteneur, code relevé sans pipe)

| Commande | Code | Relevé |
|---|---|---|
| `npm run typecheck` | 0 | 0 ligne `error TS` |
| `npm run lint` | 0 | — |
| `npm run deps:unused` | 0 | « exports morts : 10 (gelés, 5 fichiers) — aucun nouveau » |
| `npm run test:noyau` | 0 | 18 fichiers, 418 tests verts |
| `npm run test:perimetre` | 0 | joué(s) 246 (vitest 74, node 172) |
| `npm run test:hooks` | 0 | 2886 pass, 0 fail |
| `npm run test:corpus` | 0 | 92 pass, 0 fail |
| `npm run test:corpus-isole` | 0 | 4 pass, 0 fail |
| `npm run pont:godot` | 0 | « demarrer dome et vue ok, second demarrer refusé, erreursGlobales vide » |
| `npm run godot:sonde` | 0 | 6 scripts contrôlés. **N'atteste pas** que les `.gd` sont compatibles avec la nouvelle vue. |
| `node --test scripts/guards/lib/gdscriptSansRegle.test.mjs scripts/recette/lib.test.mjs` | 0 | 290 pass, 0 fail, 1 saut (PowerShell absent). Il s'agit de l'**ancienne** garde. |
| `npm test -- src/comment-poison-guard.test.ts` | 0 | 104 tests verts |
| Export Godot et recette navigateur | non rejoués | Le GDScript n'est pas adapté. Les captures du dépôt sont périmées. |

Le premier `test:perimetre` de la passe a rougi sur `src/state/cascade-step-difficulty-guard.test.ts`. L'étape témoin, déplacée dans `fenetres.testkit.ts`, n'avait pas de `difficulty`. Elle porte maintenant `difficulty: 'intermediaire'`, et le cliquet est vert.

### Poison hors périmètre relevé

- `src/hote/projection.ts:107-110` : `nomDe` rend le littéral `'tous'`, et l'id brut quand le porteur est inconnu. C'est un libellé hors catalogue, et un id peut s'afficher.
- `src/noyau/designations.ts` : la désignation des héros de `roundStartPromote` et d'`armPreempt` liste aussi les adversaires (`lesCombattants`), constaté dans la vue de `roundStart`.
- Les chaînes libres sans désignation n'offrent aucun choix à l'hôte. Il faudrait une désignation dans le noyau pour chacune :
  - `shantySetSong.shantyId` ;
  - `councilPay.decision` ;
  - `harvestCreature.creatureId` ;
  - `defenseSetMode.subSkillId`.
