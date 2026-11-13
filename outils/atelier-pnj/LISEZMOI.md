# Atelier des PNJ

Générateur de PNJ pour WFRP 4e, publié en artefact claude.ai : https://claude.ai/artifact/DWFzHYcSbEjv7BfCT4H7Cf. Il lit `src/data/*.json` en lecture seule et ne fait pas partie du jeu.

## Construire

`node outils/atelier-pnj/build.mjs` écrit `outils/atelier-pnj/atelier-des-pnj.html` (non suivi) : les données du dépôt et celles de `entrees/` injectées dans `template.html`. Les mots abîmés (U+FFFD) de `talents.json` (2) et de `careers.json` (6) sont réparés au build jusqu'à #3628 ; tout autre U+FFFD fait échouer le build.

Pour publier : un Claude ayant l'accès en écriture à l'artefact (menu Partager de la page) publie ce fichier sur l'URL ci-dessus, avec la capacité `downloads` (export de Mes PNJ).

## Entrées non officielles

`entrees/pnj-guide.json` et `entrees/ajouts-guide.json` : PNJ du *Guide fan v4.5*, convertis aux ids du dépôt. `entrees/pnj-bno.json` et `entrees/ajouts-bno.json` : créatures, traits et sorts du *Bestiaire non officiel* absents du jeu et du guide.

## Contenu non officiel

Les modèles de carrière, les profils de héros (Chef d'unité, Héros mineur, Héros majeur) et les rôles de bête (Prédateur, Proie) viennent du *Bestiaire non officiel* (Le Ratier Bretonnien, v2.03, p.4-5). Ils sont marqués comme tels dans la page.

Les profils du *Guide fan v4.5* et les créatures du *Bestiaire non officiel* absentes du jeu et du guide sont ajoutés par `build.mjs` depuis `entrees/`, avec leurs traits et sorts manquants, tous tagués « (maison) » par le nom de leur livre. Décision de Clément, 2026-11-06 : « Pour les éléments manquants, tu peux les reprendre du fanmade et le tagger ainsi ? ». Elle remplace l'exclusion antérieure des nouveaux traits (« Ce qui me dérange c'est les nouveaux traits/talents », même jour).

## Carrières suivantes (2026-11-06)

Un PNJ part de sa carrière de départ (`S.career`, `S.level`) et peut enchaîner des carrières suivantes (`S.next`, ordre chronologique) ; la dernière est la carrière actuelle (`curCar`). Les Augmentations sont un total par Caractéristique et par Compétence : chaque carrière au niveau N garantit 5×N (LDB 07 l.124-131), on retient le maximum. Talents et possessions de chaque niveau parcouru s'ajoutent. Statut, bourse et marques « De carrière » suivent la carrière actuelle (LDB 07 l.27, l.144). Un modèle de carrière (NOF) ne peut être que la carrière de départ.

## Restrictions de race (2026-11-13)

Comme la création de personnage du jeu (`careersForSpecies`), les menus de carrière et le tirage au hasard ne proposent que les carrières ouvertes à la race (colonnes du Tableau des Classes et Carrières, `careers.json` `rand`, LDB 05 l.310-312), pour les profils standard et la création façon PJ ; les autres profils du bestiaire restent libres. Un profil standard à plusieurs espèces (Humain, Elfe) ouvre l'union de leurs colonnes. La case « Ignorer les restrictions de race » (LDB 05 l.314), décochée par défaut, est retenue par le navigateur (`pnj-race-libre`). Une carrière déjà choisie hors de la race reste affichée, marquée « (hors race) ».

## Mes PNJ (2026-11-07)

Les PNJ gardés vivent dans le `localStorage` du navigateur (`pnj-saved`). Une sauvegarde exportée est un fichier `{"format":"atelier-des-pnj","version":1,"pnj":[…]}` ; l'import ne garde que les entrées lisibles (`isNpc`) et remplace celles du même nom. Le champ `renc` (rencontre, séance) n'existe que sur les PNJ gardés : la liste le range et le regroupe, ouvrir un PNJ ne le copie pas dans le formulaire, et le garder à nouveau depuis l'atelier conserve sa rencontre. Un export dont tous les PNJ partagent une rencontre porte son nom.

« Garder en troupe… » (menu de l'encadré) garde N copies du PNJ affiché, dans une rencontre au choix : noms tirés au hasard dans son groupe de noms (sinon numérotés), profils variés par `rollProfile` (LDB p.314). Les noms restent uniques dans Mes PNJ.

Notes du MJ : `S.notes` (texte libre) et `S.notesOn` ; dans l'encadré, les copies et l'impression seulement si la case est cochée, toujours visibles et cherchables dans Mes PNJ. La recherche de Mes PNJ porte sur le nom, le sous-titre, la rencontre et les notes ; « Tout » et la case d'un groupe ne cochent que les PNJ affichés.

## Impression (2026-11-08)

Le cadre des artefacts claude.ai (`sandbox="allow-scripts allow-same-origin allow-forms"`, sans `allow-modals` ni, le plus souvent, `allow-popups`) ignore `window.print()` et bloque les onglets, sous Firefox comme sous Chromium. Imprimer tente `print()` (qui marche page ouverte seule) ; sinon il remplit la zone d'impression et ouvre une fenêtre qui invite à faire Ctrl+P (sur écran tactile : Partager, puis Imprimer). L'impression de la page claude.ai imprime le cadre, remonté en haut, à la hauteur que le document lui a déclarée : la page se hausse donc à la zone d'impression dès qu'elle est remplie, et de `beforeprint` à `afterprint` ne montre qu'elle (l'encadré affiché, ou la sélection du dernier clic sur Imprimer). Vérifié sous Firefox headless, cadre claude.ai reproduit : un PNJ, et cinq PNJ de Mes PNJ sans coupure.
