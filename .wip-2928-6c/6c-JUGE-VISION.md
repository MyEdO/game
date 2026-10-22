VERDICT: REFUSÉ

# Juge-vision, lot 6c (#2928) : hôte Godot, recette du tour complet

Captures jugées : `public/qc/soldes/2928-6c-{2,3,4,5}-*.png`. J'ai aussi regardé les six captures brutes de la même passe, dans `scratchpad/captures/godot-{1..6}-*.png` : les quatre versées au dépôt leur sont identiques octet pour octet (`cmp`). Je n'ai pas relancé la recette : aucun doute visuel ne demandait une seconde passe. Référence : `2928-6b2-attaque-{apercu,jet}.png` (fenêtre web).

## Motifs du refus (BLOQUANT)

1. **Identifiants techniques bruts montrés au joueur, sur toutes les captures.** Ils sont en anglais pour la plupart.
   - Boutons de la fenêtre : `attackRoll`, `attackConfirm`, `attackReroll`, `attackBonusSL`, `attackDarkPact`, `attackCancel`, `attackForceSuccess`, `attackReverse`, `defenseRoll`, `defenseConfirm`… Cause : `hotes/godot/projet/scripts/fenetre.gd:50` (`bouton.text = verbe`).
   - Barre d'actions : `defend (Action)`, `resolve-psych-immune (gratuit)`, `resolve-ignore-crit (gratuit)`, `end-turn`, `switch-loadout (gratuit)`. Les ids `attaque`, `charge`, `course`, `mouvement` tombent juste en français par hasard. Cause : `interface.gd:81` (`offre.id`).
   - En-tête de fenêtre : `cascade · Ilyanwe la Voilée`, `étape attackJet (affichage)`, `étape defenseJet (affichage)`, et `roundStart · tous` dans les captures brutes 1 et 6. Cause : `fenetre.gd:36` et `fenetre.gd:38` (clé, genre et interaction de l'étape).
   - Difficulté donnée par sa clé : `Parade (intermediaire)` (sans accent) et `(difficile)`. Cause : `fenetre.gd:85` et `fenetre.gd:88` (`pending.difficulty`). Le web affiche « Intermédiaire (+0) ».
2. **Un glyphe manquant rend illisible la ligne du jet**, dans la capture 2. Entre la base et la cible, `38 ▯ 28` montre une boîte de repli « 2192 » au lieu de la flèche « → ». La police du thème par défaut n'a pas U+2192 (`fenetre.gd:85`).
3. **Deux étapes du tour complet n'ont aucune preuve visuelle au dépôt.**
   - L'ouverture du round : la Fenêtre du round, validée par Entrée.
   - L'issue de la Défense : `defenseRoll` puis `defenseConfirm`, le retour à `roundStart` et le round 2.
   La recette les capture pourtant (`recette.mjs:79` `godot-1-round`, `recette.mjs:127` `godot-6-apres-defense`), mais seules 2 à 5 ont été versées, et le rapport ne cite pas les deux autres. La brute 6 prouve bien l'issue (« Orc rate son attaque ; Ilyanwe la Voilée gagne +1 Avantage. — Round 2 — ») : il faut la verser, et la 1 avec.

## Capture par capture

### `2928-6c-2-attaque-apercu.png` : fenêtre d'attaque, localisation choisie
Ce qu'elle montre : Round 1, tour 1/4, fiche d'Ilyanwe (10/18, Mouvement 0/4 après la charge). On lit l'intitulé « Ilyanwe la Voilée — Attaque (Corps à corps (Armes d'hast)) », « Bâton de combat · Dégâts +6 », et les boutons de localisation avec « Tête (-20) » en surbrillance. La ligne du jet donne 38, puis la cible 28, avec +10 Avantage. La parade est en attente. Elle montre bien l'étape annoncée.
- BLOQUANT : les boutons de verbes sont bruts, l'en-tête `cascade` / `étape attackJet (affichage)` aussi, tout comme `(intermediaire)`. Le glyphe « → » est manquant (voir plus haut).
- À CORRIGER : la cible n'est pas nommée dans la fenêtre. Le web montre l'attaquant, une flèche et le portrait de la cible. Ici l'Orc n'apparaît nulle part dans la fenêtre, et son pion est caché sous elle.
- À CORRIGER : le panneau est semi-transparent et posé sur le plateau. Les étiquettes « Berta 12/12 » et « Ilyanwe la Voilée 10/18 », ainsi que le pion de l'Orc (14/14), transparaissent sous le texte. Elles sont masquées, et le texte de la fenêtre se lit sur un fond chargé.
- À CORRIGER : « une fenêtre tient la main » (`interface.gd:75`, `barre.raison`) est un jargon interne affiché au joueur.

### `2928-6c-3-attaque-jet.png` : jet de l'attaque
Ce qu'elle montre : la même fenêtre après `attackRoll`. On lit « Corps à corps (Armes d'hast) : 7 contre 28, DR +2, réussite · +10 Avantage », puis « Parade : 98 contre 35, DR -6, échec », « DR net +8 », et l'issue « Ilyanwe la Voilée touche Orc (Tête) : 14 dégâts − 7 (BE+PA) = 7 Blessures. ». Elle montre bien l'étape annoncée. Les DR, le DR net, l'issue et l'emplacement sont présents.
- BLOQUANT : les mêmes verbes et le même en-tête bruts que la capture 2.
- À CORRIGER : après le jet, le focus reste sur `attackRoll`, qui est encore offert. Le web ne propose plus qu'« Appliquer ». Le geste attendu (confirmer) n'est pas désigné.
- À CORRIGER : mêmes remarques que la capture 2 sur la cible non nommée et la transparence.

### `2928-6c-4-deplacement-apercu.png` : aperçu du déplacement de Berta
Ce qu'elle montre : Round 1, tour 2/4, Berta active (12/12, Mouvement 4/4). La zone atteignable est peinte en vert et la case visée (1,5), en ocre, touche Berta. On voit l'Orc à 7/14, ce qui prouve la confirmation de l'attaque, qui n'a pas d'autre capture. Le journal porte la touche et le test de Force contre Résistance. Les positions sont cohérentes avec la capture brute 1 et les captures 2 et 3. Elle montre bien l'étape annoncée.
- BLOQUANT : la barre d'actions montre `defend`, `resolve-psych-immune`, `resolve-ignore-crit`, `end-turn` et `switch-loadout`.
- À CORRIGER : l'aperçu n'affiche ni coût ni chemin. Le rapport cite `cout: 1`, lu dans la vue, mais rien de tel n'apparaît à l'écran.
- À CORRIGER : les étiquettes « Ilyanwe la Voilée 10/18 » et « Orc 7/14 » se chevauchent en partie. Elles restent lisibles en zoom, mais tout juste.

### `2928-6c-5-defense.png` : Défense ouverte après l'attaque adverse
Ce qu'elle montre : Round 1, tour 4/4, Orc actif (7/14), avec « Orc n'est pas piloté par ce siège ». Berta est sur (1,5) : le déplacement a bien été exécuté et elle est tournée de dos. Ilyanwe est à 5/18, ce qui s'accorde avec le journal (« Tireur gobelin touche Ilyanwe la Voilée (Corps) : 9 dégâts − 4 = 5 Blessures »). La fenêtre de Défense est ouverte. Les PV et les positions sont cohérents avec la capture 4.
- BLOQUANT : l'en-tête `cascade` / `étape defenseJet (affichage)` et les boutons `defenseRoll`, `defenseConfirm`, etc. sont bruts.
- À CORRIGER : la fenêtre ne dit ni qui attaque qui, ni avec quoi, ni le test de défense, ni sa cible. On n'y trouve que les verbes. Rien à l'écran ne montre que l'Orc attaque Ilyanwe, puisque le journal n'a pas encore de ligne pour l'Orc. Le web montre l'attaquant, la cible, la compétence opposée et sa valeur. Le rapport le reconnaît en partie (« la fenêtre de Défense ne projette pas ses choix »), mais le minimum (attaquant, cible, jet) manque aussi.
- À CORRIGER : la case ocre de l'aperçu reste peinte sous Berta pendant le tour de l'Orc, et encore au round 2 dans la brute 6. C'est un marqueur d'aperçu qui n'a pas été effacé.
- À CORRIGER : le panneau gauche affiche « Action : libre » pour l'Orc, alors que son attaque est en cours. C'est à vérifier : soit le panneau est en retard sur l'état, soit l'action n'est consommée qu'à la confirmation.

### Hors dépôt : `godot-1-round.png` et `godot-6-apres-defense.png`
- La 1 montre le round 1, tour 0/4, « aucun combattant au tour », et une fenêtre `roundStart · tous` dont le seul bouton est `confirmRoundStart`. Elle est bloquante pour la même raison (ids bruts).
- La 6 montre le round 2, tour 0/4, avec le journal « Orc rate son attaque… — Round 2 — » : elle prouve l'issue de la Défense. Elle porte les mêmes ids bruts.
- Il faut verser les deux sous `2928-6c-1-round.png` et `2928-6c-6-apres-defense.png`, et les citer au rapport.

## Ce qui est en ordre
- Aucun écran noir ni texte d'erreur.
- Aucune incohérence de position ou de PV entre les six captures : 18 → 10 → 5 pour Ilyanwe, 14 → 7 pour l'Orc, et Berta qui avance d'une case seulement après le geste.
- Le journal est en français et lisible.
- L'étape de chaque capture correspond à son nom et au rapport.

## Pour lever le refus
- Afficher des libellés français à la place des ids : verbes de fenêtre, offres de la barre, clé et étape de fenêtre, difficulté. Ces libellés doivent venir de la vue ou du noyau, comme le web les a, et non d'une table GDScript, à cause de la garde des noms.
- Utiliser une police qui couvre « → », ou bien un autre séparateur.
- Verser et citer les captures 1 et 6.
