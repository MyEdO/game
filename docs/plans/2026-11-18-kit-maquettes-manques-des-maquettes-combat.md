# Ce que le jeu montre en combat et que les maquettes ne savent pas dire (#4411), 2026-11-18

Lecture seule, famille combat. Verbatim de l'utilisateur (2026-11-18) : « si la maquette ne permet pas d exprimer des
informations importantes, c est un manque de la maquette ».

Critère : un manque est retenu quand aucun type de `sources/maquettes/maquette.ts` (`M:`) ni aucune pièce de
`sources/rendu.js` (`R:`) ne permet de dire l'information. Chemins : `M` = `hotes/godot/cibles/propositions/sources/maquettes/maquette.ts`,
`R` = `.../sources/rendu.js`, `K` = `.../propositions/kit.md`, `G` = `.../sources/gestes.js`,
`E` = `src/hote/elements.ts`, `Z` = `src/hote/ecran.ts`, `S` = `hotes/godot/projet/scenes/Ecran.tscn`.
Sources lues : `M` en entier, `R` en entier, `K` (tableau § 2), `dome.ts` et les 12 fichiers d'écran, `E` en entier, `Z:290-486`,
`Z:900-1135`, `Z:1363-1452`, `FenetreDAttaque`, `FenetreDeDefense`, `FenetreDIncantation`, `S` (liaisons `source =`),
`ecrans/cascade/*.tscn`. Règles vérifiées au `Source/` (`Warhammer v4 - Livre de base version corrigee/`).

## Fait structurant : la barre de l'actif n'est pas une maquette en donnée

`EtatDeCombat.gabarit` vaut `'fenetre-du-bas'` seul (`M:246`) ; `R` pose le système, le chrome (round, ordre, journal, fin du
tour) et la fenêtre (`R:GABARITS['fenetre-du-bas']`). Le meuble de l'actif (Blessures, Mouvement, Action, Avantage, États,
plaques, rapides, aperçu) ne vit que dans des pages HTML : `sources/combat/socle.js` (`meuble`, `mesure`, `JETONS`, `pas`,
`etatPorte`), `combat.js`, `combat-rapides.html`, `meuble-*.html`, `tour-adverse.html` (`combat.md:8` : « Le tour de l'actif,
`fin-victoire`, `cible-montee` et `visee-de-siege` restent des pages »). Pour les manques 5 à 9 ci-dessous, les pièces existent donc
dans `socle.js`, mais aucun type ne les porte et `rendu.js` ne les pose pas. Le chrome posé par `R` fige le bouton de fin du tour :
`R:150` écrit `<div id="fin" class="ferme">` sans raison, sans état ouvert.

---

## 1. IMPORTANT : à ajouter aux maquettes

### 1. Composition de la cible d'un Test : base, Difficulté, paliers, plafond, détail de chaque modificateur
- Écrans : `jet-avant-le-de`, `jet-d-attaque` (+ `relance-a-la-chance`), `defense`, `incantation` (lanceur).
- Mots de joueur : « Corps à corps 45, Difficulté Difficile (−20), Avantage +10, Courte portée +20, total 55 » ; « Combinée (+30) » ;
  « plafonné à +60 / plancher à −30 » ; ce que chaque modificateur désigne (renvoi au Codex).
- Le jeu : `Jet.modificateurs` (une puce par part) et `Jet.detail` (base, Difficulté et paliers, écrêtage, inversion), `E:47-66` ;
  construit par `Z:296-340` (`detailDuJet`, `jetTombe`), `Z:352-378` (attaque, défense), `Z:383-399` (incantation), `Z:451-466` (défense) ;
  source `RollBreakdown` (`src/engine/combat.ts:472-` : `base`, `difficulty`, `difficultyCombined`, `difficultyParts`, `clamped`) et `ModLine.ref`/`by`
  (`src/engine/types.ts:645-`). Godot : `ecrans/cascade/attaque.tscn:19` (`ids = "jet"`, forme `jetDuCamp`), `:120` (`defense`, `jetDuCampEnMiroir`), détail au survol.
- La maquette : `Testeur` = `seuil` nu + `modificateurs: Modificateur[]` `{nom, valeur}` (`M:59`, `M:76`), dessiné en une ligne
  `modif` (`R:25`, `R:31-41`). Ni base, ni Difficulté, ni écrêtage, ni détail au survol. Contournement possible : un `Modificateur` « Difficulté », qui
  mélange ce que le moteur sépare exprès (`RollBreakdown.difficulty` : « n'entre JAMAIS dans `mods` (#1072) »).
- Pourquoi : c'est ce qui explique le seuil et la réussite. Règle : LDB 14 l.91-96 (« COMBINER LES DIFFICULTÉS » : somme des pénalités sans dépasser
  Très Difficile −30, pénalité et bonus se somment) ; LDB 14 l.73 (−20 pour une Localisation visée).
- Pièce du kit : aucune dédiée. Approchantes : `.modif` (rubrique), « Bulle de refus » (`K` ligne 118 ; `G:261` `raison()`) pour un survol, la table `.enjeu`
  (`R:enjeuDu`) pour « une ligne par part ».

### 2. Les Dégâts de l'arme, avant le jet
- Écrans : `jet-avant-le-de` (et ses variantes arme, empoigner, harpon).
- Mots : « Dégâts +6 » (Bâton de combat).
- Le jeu : puce `degats` (`Z:360`), `FenetreDAttaque.degats` (`src/noyau/fenetreDAttaque.ts:89`, rempli `:210`). Godot : `attaque.tscn` zone « Coup », ids `degats`.
- La maquette : `Porte {arme, cible}` (`M:168`) et `Centre 'attaque'` (`M:190-`) n'ont aucun champ de Dégâts. Le chiffre n'apparaît qu'après, en texte du
  verdict ou du journal (« 10 dégâts − 7 (BE+PA) »). Seule la page HTML `#apercu` de `combat.js:115-121` a une ligne « Dégâts +6 ».
- Pourquoi : c'est l'enjeu du coup, à lire avant d'engager Lancer. Règle : LDB 13 l.151-159 (Dégâts de l'arme, puis BE et PA soustraits).
- Pièce du kit : aucune. Approchante : `.modif` ou la table `.enjeu`.

### 3. La Zone d'Effet d'un Sort : côté en cases, « à poser », et sa pose
- Écran : `incantation` (avant et après le dé).
- Mots : « Zone : 3 × 3 cases », à poser sur la carte après le jet ; cases couvertes.
- Le jeu : puce `zone` en `alerte` tant qu'elle reste à poser (`Z:390`, `ecran.incantation.cote`), `FenetreDIncantation.zone {cote, aPoser}` (`src/noyau/fenetreDIncantation.ts:78`, `:229`),
  `pose` (`:89`, `refusDeLaPose`). Godot : `incantation.tscn:18` (zone `fenetre.corps`).
- La maquette : seul un axe « Zone » de la Surincantation (`AxeDeSurincantation`, `M:187`, `R:119-` `surincantation`) ; `Cour.marques` ne connaît que
  `'vise' | 'cerne' | 'dome'` (`M:52-55`) : aucune marque de gabarit de zone au sol. `Centre 'sort'` ne porte que `ni`, `sort`, `issue`.
- Pourquoi : qui est touché dépend de la zone. Règle : LDB 47 l.28 (les Sorts ZdE affectent tous les individus dans ce diamètre) ; LDB 47 l.15 (Surincantation : +Zone d'Effet).
- Pièce du kit : aucune. Approchante : `cour.js` (marque `cerne`, `dome`) pour la marque au sol, `sceau` ou `disque` pour le chiffre.

### 4. L'incantation avant le dé : réglages (Discrètement, forme conjurée) et état du Sort
- Écran : `incantation` (aucun état « avant le dé » : tous passent par `apresLeDe`, `incantation.ts`).
- Mots : « À voix haute / Discrètement », forme d'arme invoquée, effet d'Incantation Critique à choisir, Sort et cible.
- Le jeu : `FenetreDIncantation.ton`, `.forme`, `.critique` (`fenetreDIncantation.ts:230-250`) arrivent en `fenetre.reglages` (`incantation.tscn:67-68`).
- La maquette : `Centre 'attaque'` exige `porte {arme, cible}` et `localisation` (`M:190-`) ; `Centre 'sort'` est post-dé. Un réglage d'incantation n'a pas de rôle de centre ;
  seules les cartes `choix` (Incantation Critique) existent.
- Pourquoi : choix du joueur avant d'engager le jet. Règle : « Discrètement » est une Difficulté laissée au MJ (LDB 40 l.40-42 : « le MJ peut exiger »), donc règle maison
  optionnelle ; forme conjurée : LDB 47 ; effet Critique : LDB 46 l.26-32.
- Pièce du kit : aucune dédiée ; `Reglage`/`segments` (`R:optionsDu`) serviraient, comme pour la Défense.

### 5. L'Avantage du combattant (le compteur)
- Chrome : barre de l'actif ; aussi la fenêtre (le modificateur « Avantage +10 » existe déjà).
- Mots : « Avantage : 2 » ; ce qu'il rapporte et ce qu'il paie (Porte-bouclier « 2 Av. »).
- Le jeu : puce `avantage` de l'actif (`Z:975`, zone `combat.actif`, `S:268`) ; `CombattantProjete.avantage` (`src/hote/projection.ts:52`). Absent des rangs de l'ordre (`Z:1097-1119`).
- La maquette : `Combattant` = `nom, buste, ennemi, blessures, max, etats` (`M:19-26`) : pas d'Avantage. Le modificateur dans un Test (`{nom:'Avantage', valeur:10}`) s'écrit,
  le compteur non. Page HTML seule : `JETONS` (`socle.js:28`, « Avantage » + chiffre), non typée.
- Pourquoi : première ressource tactique. Règle : LDB 14 l.215 (« Chaque Avantage ajoute +10… ») ; gains LDB 14 l.200-211.
- Pièce du kit : `disque` / `compteur` (`K` lignes 104-106) pour le chiffre ; `JETONS` de `socle.js`.

### 6. Action et Mouvement de l'actif (reste sur total)
- Chrome : barre de l'actif.
- Mots : « Action disponible / prise » ; « Mouvement : 3 sur 4 cases ».
- Le jeu : puce `action` (libre = `reussite`) et entité `mouvement` (un jeton par case, `reste`) (`Z:959-979`, `src/hote/projection.ts:138`).
- La maquette : aucun type. Pièces HTML : `pas(n)` (`socle.js:31`, rangée de losanges), `JETONS` (Action). Kit : « Pas en losanges » `rangDePas` (`K` ligne 123).
- Pourquoi : ce qu'il reste à jouer ce tour. Règle : Atlas `docs/raw/4e/combat.md:215` (Action, Mouvement et options du Tour) ; non rouvert au `Source/` ici.
- Pièce du kit : `rangDePas` ; « Action » : `sceau` ou `jeton` de `socle.js`.

### 7. Tous les États, pas deux
- Chrome et écrans : ordre du tour, `determination`, `coup-critique`.
- Mots : Sonné, Assourdi, Aveuglé, Empêtré, Empoisonné, En flammes, Exténué, Inconscient, Surpris, etc., avec leur nombre.
- Le jeu : `Combatant.conditions` (`ConditionId = string`, `src/engine/types.ts:487`) ; l'actif en puces (`etatsEnPuces`, `Z:1199`) ; États infligés par un Critique en puces `critique/etat/<id>` (`Z:936-939`).
- La maquette : `EtatPorte.etat: 'aTerre' | 'hemorragique'` (`M:29-34`) et `PICTO_DE_L_ETAT` (`R:142`) : union fermée à deux. Aucun type pour « l'État que ce Critique inflige »
  (`Touche` = zone, atteinte, blessures, `M:124` ; `Centre 'critique'` = nom et effet en texte).
- Pourquoi : un État change ce que le combattant peut faire (À Terre, Empêtré) et la table des malus. Règle : LDB 16 (Liste complète des États, `16 - Etats.md` : une quinzaine).
- Pièce du kit : `sceau` + pictogramme (`K` « Sceau » lignes 107-108, `PICTOS` ligne 124) ; il manque les pictogrammes, pas la pièce.

### 8. La raison d'un refus, hors des gestes de la fenêtre
- Écrans : fin du tour (chrome), plaques de la barre, cartes de choix fermées (`determination`, `contre-sort`, `dissipation`, `debut-du-round`).
- Mots : « Ne peut que ramper : se relever d'abord » ; « Aucun lanceur du même Domaine à portée » ; raison de la fin du tour fermée.
- Le jeu : `Bouton.refus` (`E:150`), `Choix.refus`, `Valeur.refus` ; fin du tour fermée de la `raison` de la barre (`finDuTourFermee`, `Z:1028-1034`) ; ligne `raison` en `alerte` (`avisDuCombat`, `Z:1127-1131`) ;
  `OffreEnVue.refus` (`projection.ts`) ; chaque valeur d'un choix refusée avec sa raison (`E:valeursDuChoix`).
- La maquette : `Geste.refus` + `survol` (`M:219`, `R:gestesDe`) couvrent les gestes de la fenêtre. Pas couverts : (a) `Carte.refus` existe en type (`M:138`) mais `carteDe` (`R:73-`)
  ne l'écrit pas, il ne fait que griser (`fermee: !!c.refus`) ; (b) la fin du tour est figée fermée sans raison (`R:150`) ; (c) les plaques de la barre n'ont aucun type.
- Pourquoi : « loi du refus visible » : le joueur doit savoir pourquoi un bouton est fermé. Pas une règle de livre.
- Pièce du kit : « Bulle de refus » (`K` ligne 118 ; `G:261` `raison()`) existe ; `plaque` fermée aussi. Il manque le champ et le câblage.

### 9. Les touches clavier
- Chrome : fin du tour, les six emplacements rapides ; réponses du dialogue (hors famille).
- Mots : « 1 » à « 6 » sur les cases rapides ; touche de « Fin du tour ».
- Le jeu : `Bouton.touche` et `Ligne.touche` (`E:14-24`, 158) ; `TOUCHES_RAPIDES` (`E:22`), `toucheDuRang` (`Z:1074`), `TOUCHES_DES_OFFRES` (`Z:1014`, `fin_de_tour`) ; `rapidesDuCombat` (`Z:1080-1086`). Godot : `S:241` (zone `combat.rapides`), `S:316`.
- La maquette : `Geste` = `libelle, principal, refus, survol` (`M:219`) : pas de touche ; `gestesDe` (`R:134`) n'appelle jamais `plaque({ numero })`.
- Pourquoi : savoir quelle touche joue quoi. Pas une règle de livre.
- Pièce du kit : existe : `plaque(libelle, { numero })` (« la touche en tête, rond `--lit` de 19 px », `K` ligne 93 ; `G:194`). Manque le champ de la donnée.

### 10. Les emplacements rapides et la fiche d'un sort au survol
- Chrome : barre de l'actif.
- Mots : six cases : nom du sort ou de l'objet, dessin de l'action, armée, refusée ou « Libre » ; au survol : coût (part du tour), Niveau d'incantation, Portée, Cible, Durée.
- Le jeu : `rapidesDuCombat` (`Z:1080-1086`), `ficheDuSort` (`Z:1001-1011` : `formatSpellRange`, `formatSpellTarget`, `formatSpellDuration`), `S:241`.
- La maquette : aucun type ; page HTML `combat-rapides.html`, non typée. C'est ici que vit la portée d'un Sort : aucune fenêtre de l'incantation ne la montre non plus (le jeu non plus).
- Pourquoi : choisir quel sort lancer sur qui. Règle : portée et cible d'un Sort : LDB 47 l.28 (Cible, ZdE).
- Pièce du kit : `plaque` + `numero`, `outil` (`K` ligne 100).

### 11. L'issue du combat : Victoire (Expérience, argent, vaincus, butin)
- Écran : `fin-du-combat`.
- Mots : « 20 PX », « 14 couronnes », les vaincus groupés, chaque objet à attribuer, « Dépecer ».
- Le jeu : `victoire` (`Z:904-914` : puces `xp`, `argent`, une ligne par vaincu, messages), butin et dépeçage par les gestes de `fenetreDuButin`, `Z:1127` (`combat.avis` `fin`).
- La maquette : `IssueDuCombat` = `titre, suite, action` (`M:256-`) ; `fin-du-combat.ts` ne contient que défaite, repli, anéantissement. La victoire reste une page HTML
  (`sources/combat/fin-victoire.html`, `combat.md:65-77`).
- Pourquoi : le bilan que le joueur attend. Règle : dépeçage ZI 13 l.304-316 (selon `combat.md:72`, non rouvert ici).
- Pièce du kit : `ruban`, `rang`, `bandeau` (`K` ligne 275, doublons 7 et 8) ; absente du type.

### 12. Le détail des lignes du journal (conséquences repliées)
- Chrome : journal.
- Mots : sous une ligne, ses suites : « perd son prochain Mouvement », « perd son Action », réaction de bouclier repoussée, interruption de focalisation.
- Le jeu : sous-lignes `↳` rangées dans le `detail` de la ligne qui précède (`lignesDuJournal`, `Z:1435-1452` ; événements `kind:'detail'`, `src/noyau/combatFlow.ts:3353`, `3632-3638`, `3899`).
- La maquette : `EntreeDuJournal = string | { round, commence }` (`M:37`), dessinée `vieux`/`neuf` (`R:145`) : aucune sous-ligne, aucun détail.
- Pourquoi : c'est le seul endroit qui dit ce que le coup a coûté au-delà des Blessures.
- Pièce du kit : « Bulle de refus » (survol) ou `filet`/`losange` ; aucune dédiée au journal.

---

## 2. SECONDAIRE

1. **Camp « PNJ allié »** (ordre, portraits). Le jeu : `Combatant.kind: 'heros' | 'ennemi' | 'pnj'` (`src/engine/types.ts:1294`), `CombattantProjete.camp` (`projection.ts:51`). La maquette :
   `Combattant.ennemi: boolean` (`M:19`) ; `portraitDe` (`R:portraitDe`) ne passe que `heros`/`ennemi`. Le kit connaît le camp `pnj` (`K` ligne 119). Pièce : `portrait({ camp: 'pnj' })`. Dans l'ordre le jeu
   ne distingue pas non plus un `pnj` d'un héros (`ton` : `echec` pour l'ennemi seulement, `Z:1105`).
2. **Postures de tir et perte sans équipe** (`jet-avant-le-de`). Le jeu : `posture('tirDansLeTas')`, `posture('tirImmobile')` (état, note, `sansObjet` en `alerte`, `Z:346-347`, `361-362`), `sansEquipe` (`Z:359`).
   La maquette : `Bascule {libelle, allumee}` et `note` libre (`M:Centre 'attaque'`) ; l'état « armée à la console mais sans objet sur ce coup » n'a pas de forme. Règle : LDB 14 l.106 (groupe de cibles +20/+40/+60), LDB 14 l.116 (cible Engagée −20), LDB 14 l.70 (Complexe −10).
3. **Pourquoi aucun jet n'est possible** (ligne de vue, portée) : ligne `bloque` en `alerte` (`Z:363`, `fenetreDAttaque.ts:103`). La maquette peut au mieux le dire en `Geste.refus` de « Lancer » (non vérifié que le noyau l'y pose).
   Règle : LDB 14 l.43 (pas de tir Engagé, sauf Pistolet) ; portée : LDB 14 l.54 (Bout Portant +40).
4. **Ce que donnerait le dé inversé** (`jet-d-attaque`). Le jeu : `ecran.attaque.inversion` au détail du jet (`Z:365`) ; `FenetreDAttaque.influences.inversion` (`fenetreDAttaque.ts:~115`). La maquette : `Modificateur {nom, de, vers}` (`M:59`)
   dit le jet inversé *posé*, pas l'aperçu avant. Règle : LDB 23 l.209 (Activité d'entraînement : inverser un Test une fois).
5. **Ton et date du journal**. Le jeu : ligne `round` en `alerte`, événement grave (Critique, mort) en `echec` si frappé camp héros, sinon `reussite` ; une ligne de date impériale en `alerte` par jour (`Z:1423-1452`). La maquette : texte nu.
6. **Aperçu du premier clic** (`combat.apercu`, `Z:982-987` : coût en Mouvement ou cible visée ; `S:567`). La maquette typée : rien ; page HTML `#apercu` (`combat.js:113-121`, `combat.css:60`), plus riche que le jeu (tableau de Test, Dégâts).
7. **Fiche ouverte sur un rang de l'ordre** (`boutonDeFiche` pressé, `Z:1097-1119`). La maquette : `combattant(…, classe)` connaît `lu` (`socle.js:14`), `rangDe` (`R:144`) ne le passe jamais ; `Combat` n'a pas de champ `fiche`.
8. **Qui tient la main** : `ProprietaireDeLaFenetre` `tous | aucun | porteur` (`projection.ts:177-187`) ; son nom en `fenetre.etape` (`Z:1375`). La maquette : `Fenetre.heros` dit l'acteur ; « tous les sièges » et « aucun propriétaire » n'ont pas de forme.
9. **Attente d'une Défense adverse** (`attente`, `fenetreDAttaque.ts:127`, `287`) : ligne sans équivalent dans `Centre 'attaque'` ni `'verdict'`.
10. **Mort, hors combat, hors de vue** : le jeu filtre l'ordre aux combattants en vue (`ordreEnVue`, `projection.ts:227`) ; `Combattant` n'a pas d'état « mort ».

---

## 3. Vérifiés et NON retenus (l'écart est dans l'autre sens, ou le jeu ne le porte pas)

- **États par rang de l'ordre** : la maquette les dessine (`R:144`, `M:19`), mais le jeu n'en met aucun dans `combat.ordre` (rang = portrait + jauge Blessures + bouton fiche, `Z:1097-1119`) ; seul l'actif les montre (`combat.actif`). Écart à signaler au lot, pas un manque de maquette.
- **Niveau d'incantation** : calculé par le noyau (`FenetreDIncantation.ni`, `fenetreDIncantation.ts:66`) mais jamais projeté par `Z:383-399`. La maquette le montre (`Centre 'sort'`, `'etendu'`). Idem `coutDuPas`, `bonusDeDegats`, `jetsSurLeTableau` (`SurincantationEnVue`) : noyau seul.
- **Siège en coopération / qui contrôle un combattant** : aucune zone `combat.*` ni `fenetre.*` ne le porte (`grep siege` dans `Z` et `projection.ts` : aucune occurrence) ; il vit au salon (`src/hote/coop/`, `Salon.tscn`) et dans le refus `rangeeTemoin`
  (« lanceur d'un autre siège », `fenetreDIncantation.ts:~165`), que `Geste.refus` sait dire.
- **Blessures de chaque combattant de l'ordre** : couverts (`Combattant.blessures/max`, `R:144`). **Camp héros/ennemi** : couvert (`ennemi`). **Round et tour** : couverts (`Combat.round/tour`, borne `R:147`).
  **Réserves Chance / Résilience / Détermination** : couvertes (`Reserve`, `M:228`). **Modificateur « Avantage »** dans un Test : couvert (nom + valeur). **Raison d'un refus d'un geste de fenêtre** : couvert (`Geste.refus`, `survol`).
- **PA par localisation** : le jeu ne les porte que dans la fiche (`fiche.sections` « Armure », `Z:1263-1300`, `armure/<i>`), hors des treize écrans ; le détail d'un coup les dit en phrase (« 10 dégâts − 7 (BE+PA) »). Pas de PA dans `fiche-au-clic.html` ni `combat.js`.
  Règle : LDB 13 l.159. À traiter avec la maquette de la fiche, non lue ici.
- **Portée** : elle n'est dans aucune fenêtre du jeu (seulement `ficheDuSort` au survol, manque 10, et le refus `bloque`, secondaire 3). La carte du contre-sort `{qui, distance, portee}` (`M:LigneDeCarte`) est une valeur de maquette sans producteur lu côté jeu (déclaration de Contre-sort non lue).

## 4. Poison rencontré (signalé, non corrigé)

- `src/hote/ecran.ts:380-382` : le commentaire de `corpsDeLIncantation` dit « le Sort et sa cible, son NI et sa Zone d'Effet », or `corpsDeLIncantation` (`Z:383-399`) ne projette pas le NI. Paraphrase fausse de contrat.
- `M:1-8` : l'en-tête dit que la maquette « ne dit jamais où ni comment se dessine ce qu'elle porte », mais `Cour.etat` (`M:53`) est une clé de scène nommant un décor (`'fin-victoire'` pour `test-de-corruption`, `test-de-corruption.ts:15`) : un état de combat pour un écran hors combat. Signalement seul.
- `combat.md:19` (« À valider : le meuble ne montre ni Mouvement, ni Action, ni Avantage ») : des manques de la maquette consignés comme « à valider », ce que le verbatim du 2026-11-18 requalifie.

## 5. Non couvert (non lu)

- Les écrans hors liste (`sauvetage-par-le-destin`, `relance-a-la-chance` lu seulement via `jet-d-attaque.ts`, poursuites, bataille de masse, désengagement, fuite).
- Les scènes Godot de `ecrans/cascade/*` au-delà des ids de `attaque.tscn` (lus : lignes 9-125) ; `defense.tscn` et `incantation.tscn` seulement par leurs `source`/`ids`.
- Les sources JS de `sources/combat/` autres que `socle.js` (en entier), `jet.js` (signatures), `combat.js` (lignes 37-130) ; `cour.js` non lu.
- Le producteur de la déclaration de Contre-sort, de la Dissipation et de la Focalisation côté jeu (fenêtres génériques de cascade : `jetsEnVue.ts`, `revelationDeLEtape`, `issueDeLEtape`) : lus à la surface, sans énumérer leurs étapes.
- La fiche (`fiche.*`), le salon et la création ; le catalogue `src/i18n/messages/fr.ts` hors quelques clés.
- Les refs de règle non rouvertes au `Source/` : Atlas `docs/raw/4e/combat.md:215` (Action, Mouvement), ZI 13 l.304-316 (dépeçage, repris de `combat.md:72`), LDB 14 l.43, l.54, LDB 46 l.26-32, LDB 47 l.15 (lu), LDB 16 (titres lus, pas les 15 États un à un).
- Aucun fichier n'a été modifié, hors celui-ci.
