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
- **Piège — la fin du combat n'est pas la fin de la rencontre.** À `battle.over`, les combattants du champ
  portent encore l'état de la rencontre : `roundsAtZero`, `initiative`, `tookCriticalThisFight`,
  `meleeThisRound`, `defensiveStance`, `soinRencontreUtilise`, une position. Un hôte qui les lit là et les
  sauvegarde fait entrer ces champs dans la rencontre suivante. C'est la fermeture de la fenêtre `victoire`
  (`fenetreFermer`) qui rend la main au noyau : retour en exploration, et `etat().party` débarrassé de ces
  champs. Rien ne le dit à un hôte. Idée : une issue de rencontre explicite (`rencontreClose`, ou
  `party` rendu par l'appel qui ferme), et le `jouerJusquAIssue` ci-dessus qui la rendrait.
- **Friction — le coup n'est lisible qu'à travers le bus interne.** Pour animer un combat (qui frappe qui, touche,
  Blessures, parade, esquive, Critique), la seule source structurée est `EVT.ANIM_ATTACK` et sa `ChargeDAttaque`
  (`src/noyau/bus.ts`), que `Partie` relaie dans `evenements`. Le type et le nom de l'événement ne sont pas dans la
  surface (`src/noyau/index.ts`) : l'hôte importe `bus.ts`. Sans eux, il devrait relire le texte du journal. Le
  résultat d'un sort (`CastResult`) n'a pas la même forme que celui d'une arme (`AttackResult`), l'hôte normalise.
- **Piège — l'arme lâchée par un héros tombé reste sur la scène après la rencontre.** Un héros qui tombe
  Inconscient perd la pièce qu'il tenait : après `fenetreFermer`, elle n'est plus dans ses `items` ni dans sa
  panoplie (constaté : groupe de quatre, un héros à 1 Blessure contre deux gobelins, victoire, sa main vide).
  Un hôte sans scène persistante (combat en arène jetable) perd l'objet pour de bon, sans que rien ne le dise.
  Contournement de l'hôte : `ramasser` (`roguelite/src/noyau/combat.ts`) remet au vainqueur les pièces disparues,
  chacune dans sa main. Idée : que l'issue de rencontre liste ce qui est resté au sol, par porteur, ou un verbe
  « ramasser tout » à la clôture d'une victoire.
- **Piège — `Combatant.weapons` ne suit pas la panoplie.** Un Chasseur né avec sa dotation de carrière porte une
  Fronde équipée (`items`, panoplie) que `weapons` ne liste pas, et le combat s'en sert (23 coups à distance sur 24
  sur six rencontres). Un hôte qui affiche `weapons` montre une arme de mêlée à un tireur. Lire la panoplie
  (`loadouts`, `activeLoadoutId`, `items`) ; idée : retirer `weapons` de ce qu'un hôte peut lire, ou le dériver.
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
- **Trou — un mage ne focalise jamais tant qu'un sort offensif se lance d'un jet.** Un lanceur de Collège qui connaît
  Fléchette (Sort mineur, NI 0) la lance chaque tour : l'IA ne focalise un sort de NI plus haut que si aucun sort
  offensif lançable d'un jet n'existe (`src/noyau/monde/ai.ts:1060`, `focusState` posé à `src/noyau/combatFlow.ts:6414`).
  Mesuré (2026-11-23, 48 combats par niveau, six Collèges) : 0 % des combats où un mage de niveau 2 ou 3 pose un sort
  de sa voie, 8 % au niveau 4 ; sans ses Sorts mineurs, 11 % au niveau 2, la Focalisation prenant plusieurs tours.
  Idée : peser la Focalisation contre le sort mineur à l'espérance de dégâts ou d'effet, pas à la seule existence d'un
  jet possible.
- **Trou — la réserve de Focalisation de VDM n'est pas jouée sous `magie-vdm-incantation`.** VDM 02 l.129-139 : chaque
  DR de Focalisation réduit le NI de tout sort du Vent canalisé, et le lanceur incante quand il le veut au NI réduit.
  Le noyau garde la Focalisation du Livre de base sous l'option : DR accumulés sur UN sort, lancé seulement quand
  DR ≥ NI (`focalisationAboutie`, `src/engine/magic.ts:356` ; `caster.focus`, `src/noyau/combatSlice.ts:3399`).

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
  héros brûle un Destin pour revenir (LDB 17 l.31), ou meurt s'il n'en a plus. Le noyau a pu en brûler un
  pendant le combat (« Meurs un autre jour ») : l'hôte compare le Destin d'avant et d'après pour ne pas le
  faire payer deux fois, faute d'une trace de cette dépense sur le héros rendu.

## Hors combat : équipement, carrière, repos

- **Constat — les verbes de fiche marchent dans une partie d'exploration générée.** `acheterLaCaracteristique`,
  `acheterLaCompetence`, `acheterLeTalent`, `acheterLeSort`, `changerDeCarriere`, `utiliserLObjet`, `incanterLeSort`
  se jouent sur une arène sans rencontre, et leurs refus s'écrivent au journal. L'hôte n'a rien recodé de l'avancement
  (`roguelite/src/combat.ts`, `auHameau`).
- **Piège — `equiperLObjet` bascule.** Un objet né `equipped: true` (pièce d'armure fabriquée par l'hôte) est
  *déséquipé* par le verbe, et l'armure dérivée tombe à 0 PA sans un mot. Une arme, elle, ne se « porte » pas : elle va
  en main par `garnirLaPanoplie(héros, panoplie, main, uid)`, que rien ne relie à `equiperLObjet` côté hôte. Idée : un
  verbe idempotent (`porterLObjet(uid, porte)`) à côté de la bascule.
- **Trou — aucun achat d'objet sans scène de marchand.** Le noyau vend par `merchantFlow`, qui suppose un marchand en
  scène. Un hôte qui tient une boutique hors scène (forge, relais) donne l'objet par `doterLePorteur` et tient la bourse
  lui-même.
- **Friction — une spécialisation ouverte n'apparaît pas dans les créneaux de carrière.** `talentSlots` rend
  « Magie des Arcanes » et « Invocation » comme option sans `spec` (le domaine, le dieu sont au choix) : un lecteur
  qui ne garde que les options achetables les perd. L'hôte doit savoir que le créneau attend une spécialisation et la
  fournir (`aSpecifier`, `offresDeCarriere`).
- **Friction — utiliser un objet : le verdict est hors surface.** Savoir avant le clic que des Bandages ne servent à rien
  (« n'attend aucune Aide Médicale ») demande `refusDeConsommer` (`src/noyau/consumableFlow.ts`) et `consommableDe`
  (`src/engine/consumables.ts`) : ni l'un ni l'autre n'est dans `src/noyau/index.ts`. `gestesDeLObjet` les compose, mais
  rend des gestes de fiche, pas un verdict par objet.
- **Friction — rien ne dit qu'un consommable n'a d'effet que dans une mécanique que l'hôte ne joue pas.** Le
  Cataplasme de guérison porte `preventInfection` et `aideMedicale` : utiles avec l'infection et les Tests de soin
  du noyau, inertes dans un hôte qui ne les joue pas. L'hôte l'a vendu longtemps comme un soin. Idée : un lecteur
  public des ops d'un consommable (par famille : soin, état, infection, aide médicale), pour qu'un hôte filtre ce
  qu'il propose.
- **Piège — un consommable que rien ne refuse peut ne rien faire.** `refusDeConsommer` laisse passer une Potion de
  guérison sur un héros indemne, et sur un héros à 0 Blessure alors que sa propre condition (`si` sur
  `woundsCurrent >= 1`) la rend inerte : l'hôte vendait et laissait boire une potion sans effet. Contournement de
  l'hôte : `sansEffet` (`roguelite/src/noyau/equipement.ts`) évalue la condition du flux (`evalCondition` sur
  `activityConditionCtx`) et refuse un soin sur un héros indemne. Idée : que le verdict de consommation du noyau
  évalue la condition du flux et dise « sans effet » quand l'effet ne changerait rien.
- **Constat — le combat à deux armes passe par un Talent que l'hôte doit lire seul.** Une arme en main secondaire
  ne sert en mêlée qu'avec Maniement de deux armes (`talents.json`, `combat.dualStrikeDefense`) ; rien dans la
  surface ne dit à un hôte qu'une dague en main secondaire est inutile sans lui. L'hôte filtre la forge sur
  `talentId === 'maniement-de-deux-armes'`. Idée : un lecteur public « ce que cette main peut faire » par héros.
- **Trou — le repos du noyau ne récupère rien sur une arène.** `ouvrirLeRepos` sur une scène générée (`restPlaces`
  `maison`) fait passer la nuit (« Le groupe dort jusqu'à l'aube »), mais aucun Point de Blessure ne revient et aucune
  ligne ne dit pourquoi (pitance, privation ?). L'hôte joue donc le repos par les primitives du moteur, `restRecovery` et
  `tickTraumaRecovery` (`reposer`).
- **Friction — la fin de convalescence d'une fracture exige une porte.** `tickTraumaRecovery` diffère le Test de fin
  (`UpkeepDeferTest`) ; hors de la cascade de nuit, l'hôte lance lui-même le jet (`testValue`, `rollTest`) et applique
  `applyFractureEnd`. Un résolveur « immédiat » public éviterait cette recopie.

- **Friction — l'infirmerie du noyau suppose un joueur et un soigneur en scène.** `ouvrirLeMedecin(patientId)` ouvre une
  fenêtre à choix (acte, soigneur, passes d'un Test étendu) sans drive automatique, et le soigneur PNJ (`MedicNpc`) n'est
  pas un argument du verbe public. Un hôte qui tient un hospice (« le chirurgien opère, le héros reste une semaine »)
  appelle les primitives pures `treatTrauma` et `removeSurgicalTrauma` (`engine/trauma.ts`) et lance lui-même le Test de
  Guérison. Idée : un verbe `soignerParUnPNJ(patient, acte, valeur)` qui joue l'acte de bout en bout.

## Bundle navigateur

- **Friction — 9 Mo minifiés pour un combat.** Le graphe d'import tire tout le corpus : `creatures.json`
  (0,84 Mo), `spells.json` (0,58 Mo), les messages i18n (0,34 Mo), et même les projets de scènes
  `diligence-projet.json` (0,30 Mo) et `arene-projet.json` (0,22 Mo), qu'un combat généré n'utilise pas.
  Idée : charger les projets de campagne et les gros catalogues à la demande.

## Événements, compagnon, progression

Sondes à graine fixe (`npx tsx`), sur des recrues de `nouvelleRecrue` et des parties ouvertes par `ouvrirLeLancement`
sur une arène générée.

- **Friction — aucun verbe « Test de Compétence » hors combat ; le seul chemin public est une entité forgée.** Les portes
  de jet `openPartyTest`, `openRoll`, `openWorldTest` (`src/noyau/rollSeam.ts`) prennent `(get, set, …)`, or une `Partie`
  n'expose que `etat` (un `Get`) et `envoyer` : aucun `set` (constaté : clés `etat, reprojeterLArmement,
  reprendreLaCadence, envoyer, lancer, reprendre, abonner, relever, recevoir, fermer`). Ce qui marche : poser sur
  l'arène une entité `{ kind: 'prop', usable: { actions: [{ id, label, flow }] } }` dont le `flow` est un nœud
  `{ kind: 'test', test: { skill: { id: 'perception' }, difficulty: 'difficile' }, reussite, echec }`, puis envoyer
  `jouerAction(entite, action)`. Le meilleur du groupe jette (Soutien compris), aux dés de la partie : même graine, même
  sortie octet pour octet. Idée : un verbe `testerLaCompetence(ref, difficulte, heroId?)` qui rende l'issue, sans décor.
- **Friction — l'issue d'un Test n'est lisible que sur le bus interne.** Succès, DR, jet et cible sortent dans
  `EVT.TEST_RESOLVED` (`{"actorId":"r32-hero-13","success":false,"sl":-4,"roll":52,"target":12}`), relayé par
  `evenements` ; ni `EVT` ni `bus.ts` ne sont dans `src/noyau/index.ts`. Sans eux, il reste le journal (« Greta échoue. »).
- **Piège — choisir qui jette impose la cadence manuelle.** En cadence `auto`, le Test se résout dans l'appel de
  `jouerAction` : aucune fenêtre, le meilleur jette. En `manuel`, la fenêtre `test` porte `candidates` et
  `jetRegler('test', 'testeur', heroId)` désigne le lanceur avant `jetLancer` (constaté : Ulli désigné, valeur 42 → 45).
  Un hôte automatique qui veut « le crocheteur du groupe » doit piloter la fenêtre lui-même.
- **Piège — la conséquence ne vise pas celui qui a raté.** Dans la branche `echec`, un `{ type: 'ops' }` sans `on` frappe
  tout le groupe (6 Blessures à Hans, Greta et Ulli quand Greta rate) ; `on: 'heros'` vise le premier héros (Hans), pas le
  testeur (Ulli) ; `on: 'membreAuHasard'` en tire un. Aucune cible « le héros qui a jeté ». L'hôte qui sait d'avance qui
  jettera peut poser `heroId`, mais seulement en cadence manuelle (entrée précédente).
- **Piège — un flux d'entité n'est validé par personne avant de jouer.** L'arène générée n'est pas parsée : un flux mal
  formé passe jusqu'à l'exécution et lève au milieu de l'appel (`{ op: 'condition', id: 'empoisonne' }` au lieu de
  `id: { id: … }` : `Error: État inconnu : « {id} »`, gabarit non rempli ; difficulté `tres-difficile` : `rollLine :
  Difficulté inconnue`). D'autres fautes passent sans bruit : `target: 'party'` pour une chute, `severity: 'mineure'`
  s'appliquent quand même. L'hôte valide par `sceneFlowSchema.safeParse` (`src/data/schemas/defs-scenes/effets.ts`),
  hors surface. Idée : valider à `lancer`, ou exposer le schéma du flux.
- **Friction — une action d'entité sans `label` s'affiche par sa clé.** « Dalle suspecte : usable.chute… » au journal :
  le libellé retombe sur la clé i18n `usable.<id>`, absente pour un id d'hôte.
- **Constat — Blessures, États et séquelles hors combat passent par les effets de scène.** Sur l'entité forgée :
  `{ type: 'ops', ops: [{ op: 'wounds', amount: 6 }] }` (Blessures, « ignorant BE et PA »),
  `{ op: 'condition', id: { id: 'hemorragique' }, value: 1 }` (État), `{ type: 'fall', target: 'groupe', metres: 2 }`
  (« Hans — chute de 2 m : 4 Blessure(s) (À Terre) »), `{ type: 'inflictTrauma', kind: 'fracture', severity: 'mineur',
  location: 'brasG' }` (« Hans subit une Blessure Critique (fracture, brasG) », `criticalWounds` 0 → 1). Aucun effet ne
  tire une Blessure critique sur la table : `inflictTrauma` pose la séquelle choisie par l'appelant, et un `wounds` qui
  amène à 0 n'en tire aucune (Hans à 0/10, `criticalWounds` 0). Un `Empoisonné 2` hors combat se résout d'un bloc dans
  l'appel : Tests de Résistance et Blessures enchaînés jusqu'à l'Inconscience des trois héros.
- **Constat — l'infirmerie se joue avec un soigneur du groupe, par verbes publics.** `ouvrirLeMedecin(patient)` puis
  `jetLancer('soins')` et `jetValider('soins')` : le soigneur et l'acte (`blessures`) sont choisis d'office
  (`pendingHeal.healerId`), le jet suit la graine (« Hans : +3 PB (6/9) » ; ailleurs « le soin tourne mal — 1 Blessure(s)
  en plus »). L'infirmerie reste ouverte après (`fenetreFermer('infirmerie')`). Il faut un héros qui possède Guérison
  (`refusDeSoins`, `peutTenter`), et l'acheter hors carrière est refusé (« « Guérison » hors carrière, non acquérable »). Précise l'entrée
  « l'infirmerie du noyau suppose un joueur » : le drive manque, mais deux verbes suffisent.
- **Constat — l'infirmerie se tait sur un blessé qu'elle ne soigne pas.** Une recette du camp a montré un patient
  blessé (6/8) pour qui `ouvrirLeMedecin` ne pose ni `pendingHeal` ni refus : le noyau ne dit pas pourquoi (son message
  « {name} n’a rien à soigner. », `src/i18n/messages/fr.ts:3955`, n'est pas émis). L'hôte se rabat sur sa propre phrase
  (`roguelite/src/noyau/soins.ts`, `ouvrirLeSoin`) ; la liste des patients du camp lit ce même verdict (`verdictDuSoin`),
  donc l'écran ne propose plus ce patient. Cause à mesurer dans `src/noyau/medicFlow`.
- **Friction — aucun réglage du soigneur à l'infirmerie.** Le soin du camp (`soignerUnCompagnon`) ouvre l'infirmerie
  sur le seul couple choisi : le noyau confie l'acte au meilleur en Guérison des deux (`bestHealerFor`), l'autre le
  soutient (constaté : soigneur voulu à 39, patient à 48, `healerId` = le patient, `support` +10 du soigneur voulu).
  `jetRegler('soins')` règle `mode`, `test` et `bandages`, jamais le soigneur : l'hôte refuse donc, avant tout jet, le soin
  que le noyau confierait à un autre. Idée : un réglage `soigneur` du flux `soins`, offert aux héros qui peuvent tenter
  la Guérison. Constaté aussi : le noyau laisse un héros se soigner lui-même (le camp le refuse : le soigneur soigne
  un autre héros) ; après un soin, aucun brouillon ne se repose sur le même patient dans la même partie, mais rien ne
  survit à la partie : l'hôte plafonne à un soin par blessé et par camp. Une recrue de chaque carrière tirée à la
  graine 7 : la Nonne, le Tueur, le Répurgateur, le Médecin, le Duelliste et le Prêtre-guerrier tentent la Guérison,
  aucune n'a Chirurgie ; l'opération (`jetLancer('chirurgie')`, `jetValider('chirurgie')` par passe) n'est pas jouée
  au camp.
- **Trou — aucun compagnon dans le noyau.** Le Ratier reçoit `{ "id": "chien", "type": "creature" }` : la partie le sème
  en possession `bete` (`seedStartingPossessions`, `ref: { id: 'chien' }`, le Chien du bestiaire, Taille Petite, pas
  `chien-de-ratier`), attachée au héros, mais seule une monture entre en combat (`heroCombatMount`,
  `src/noyau/combatSlice.ts:1701`) : constaté, combat d'un Ratier contre un Snotling, pions « Rolf, Snotling ». Dressage et
  Emprise sur les animaux ne sont lus que par les Activités d'interlude. L'hôte peut forger le chien en combattant
  (`spawnEnemy({ ref: 'chien-de-ratier' }, id)`, `kind = 'heros'`) et le glisser dans le groupe : il se bat
  (« Chien de Ratier touche Snotling (Bras droit) : 14 dégâts − 2 (BE+PA) = 12 Blessures ») et revient dans le groupe
  rendu. Mais `spawnEnemy` n'est pas dans la surface. Idée : faire entrer en combat la bête possédée qui accompagne son
  maître, alliée, à côté de la monture.
- **Constat — le chien de Ratier fuit tout ce qui est plus grand que lui.** Taille Très petite : Peur ou Terreur de
  Taille (LDB 85 l.382-383) face à un Gobelin, un Loup, un Brigand (« Chien de Ratier est terrifié par Wulf-Erich
  Helmuts : 4 État(s) Brisé, puis Peur 2 ») : un seul coup porté en sept combats contre eux, deux ou trois par combat
  contre des Snotlings. Un compagnon de combat devra être choisi en connaissance de cause.
- **Piège — les verbes de fiche acceptent une créature comme un héros.** Dans `auHameau`, le chien forgé achète
  Capacité de Combat et Perception « hors carrière » (−50, −20 PX) et porte une armure légère (`equiperLObjet`, 1 PA au
  corps). Rien ne dit si une Augmentation d'animal suit une autre règle : le noyau la traite comme celle d'un héros sans
  carrière.
- **Constat — Dur à cuire n'est pas un Talent d'espèce.** Humains du Reikland : Affable ou Perspicace, Destinée, trois
  tirages sur la table des Talents aléatoires (`src/data/species.json:3-80`) ; Dur à cuire n'y est qu'au 37-40
  (`talents-aleatoires.json`, LDB 05 l.514-531). Mesuré : 37 humains sur 220, dont 20 Chasseurs qui le choisissent ;
  17 sur 200 ailleurs. Les Halflings l'ont en choix d'espèce contre Brouet.
- **Piège — le choix « A ou B » d'espèce retombe sur la première option.** `createHero` sans `speciesTalentChoices` prend
  `ref.of[0]` (`src/engine/character.ts:112`) : 200 Reiklanders sur 200 sont Affables, aucun n'a Perspicace par
  l'espèce. Silencieux pour un hôte qui ne passe pas le choix.
- **Trou — aucune recrue née au Niveau 2 sans recopier la création.** Deux chemins du noyau, aucun propre à un hôte :
  - `porterAuParcours(c, { carrieres: { repurgateur: 2 } })` (`src/engine/pnjDeCarriere.ts:202`), pensé pour un PNJ au
    profil de base, appliqué à une recrue de `createHero` : `careerLevel` 2, Arbalète de poing tirée de la dotation, mais
    +5 bruts par Niveau sur les Caractéristiques (CC 35 → 45, CT 35 → 40) sans toucher `charAdvances` (reste
    `{"capacite-de-combat":2,"endurance":2,"force-mentale":1}`), le Niveau 1 compté deux fois (Augmentations de création,
    puis +5), un seul Talent par Niveau (Menaçant, Maniement de deux armes ; pas Tireur de précision). La suite est
    incohérente : `progression` lit 2 Augmentations sur 10 requises, et `changerDeCarriere(…, 3)` refuse (« niveau actuel
    non complété ») un héros dont la fiche porte déjà +10.
  - `heroDeFiche` (`src/engine/heroDeFiche.ts:85`, les prétirés) est cohérent : un Chasseur 2 imprimé porte
    `charAdvances` à 5, `progression` en demande 10 (LDB 07, 5 × Niveau), et rien n'est à racheter au-delà. Mais la fiche
    exige les Initiales, les Augmentations, les Compétences et les Talents déjà décidés : l'hôte devrait les calculer, donc
    recopier la création.
  Idée : `createHero({ careerLevel: 2 })`, qui joue la création puis les Niveaux franchis comme des achats (Augmentations
  posées dans `charAdvances` et `skills`, Talents du Niveau, dotation du Niveau).
- **Piège — `porterAuParcours` remplace l'inventaire d'un héros et laisse sa panoplie dans le vide.** Après le port, les
  dotations de classe ont disparu (Cape, Vêtements, Dague, Bourse…), remplacées par celles des Niveaux 1 à 2 ; la
  panoplie `lo-0` pointe encore `r71-it-9` et `r71-it-3`, absents, et `weapons` liste toujours « Arme simple, Dague ».
- **Constat — la dotation de Niveau 2 du Répurgateur entre en combat à cheval.** Le Cheval de monte (`type: creature`)
  est semé en possession au lancement de la partie et monte en combat comme monture (« Matthias est désarçonné — sa
  monture (Cheval de monte) est hors de combat »). Un hôte qui ne veut pas de chevaux dans une salle de crypte n'a pas de
  réglage pour l'en empêcher.
- **Friction — le second pistolet ne sert presque pas.** Répurgateur avec Maniement de deux armes, deux Pistolets
  garnis par `garnirLaPanoplie(heros, 'lo-0', 'main' | 'secondaire', uid)` (panoplie
  `{"main":"pp-it-1","secondaire":"pp-it-2"}`), 12 Balles et Poudre chacun. Sur cinq combats, l'arme de chaque tir lue
  dans `ChargeDAttaque.weapon` : 14 tirs, 12 du pistolet de la main principale, 2 de la main secondaire, jamais deux tirs
  au même tour. Entre deux tirs, « Matthias recharge Pistolet (0/1 DR) » deux fois, alors que les deux armes à distance
  sont chargées au début du combat (`loadWeapon` par arme, `combatSlice.ts`). L'IA recharge l'arme vide plutôt que de
  tirer avec l'arme chargée. Le rechargement et l'usage de la main secondaire sont joués ; c'est le choix de l'IA qui
  laisse le second pistolet de côté.
- **Friction — aucun événement ne dit quelle Compétence un combat fait jeter.** `TestResolu` porte
  `actorId, success, sl, roll, target` ; `CombatEvent` porte `kind, text, actorId, targetId, etat` ; `ChargeDAttaque`
  porte l'arme mais pas la Compétence. Pour compter, l'hôte relit le texte du journal (« Gor — Test de Calme
  Intermédiaire (+0) : 62/1 → échec (DR -6). »), et le Test d'incantation ou de prière n'y est pas nommé (« échoue à
  incanter Fléchette. »). Mesuré sur 50 combats du roster contre les rencontres des quatre destinations (43 victoires,
  3,7 Rounds en moyenne), héros et ennemis confondus : Calme 200, Athlétisme 165 (Test Accessible de la course
  surtout), Résistance 161, Force Mentale 8 (Bénédiction de Protection) ; côté héros, 296 attaques de mêlée, 26 tirs,
  98 sorts portés, 199 parades et 30 esquives. Aucun Test de Perception ni d'Intimidation. Idée : `skill` (réf.
  désignée) sur `TestResolu`, et le Test d'incantation nommé.
- **Constat — un Talent passif ne laisse aucune trace.** Sur les mêmes 50 combats, Frénésie est le seul Talent de héros
  que le journal nomme (7 lignes, dont une d'un Gor). Guerrier né (porté 45 fois), Dur à cuire (35), Tireur de précision (22), Réflexes
  foudroyants (17) agissent sur une valeur ou un seuil sans ligne à eux. Un hôte qui veut montrer « ce Talent a servi »
  n'a pas de signal : il faudrait que le détail d'un jet (`ligne.mods`) nomme ses sources jusqu'au journal ou à
  l'événement.
- **Idée — la bête de combat d'un héros, par le chemin des montures.** Le noyau sait déjà faire entrer en combat la
  bête possédée par un héros : `combatSlice.ts:1701-1720` la fait naître alliée (`spawnEnemy` sur sa créature,
  `kind: 'heros'`, id `pos-<uid>`), avec ses Blessures, ses Caractéristiques tirées et ses Traits appris, et
  `finalizeBattle` réécrit son état dans la possession (#618). Deux filtres la réservent aux montures :
  `heroCombatMount` (`engine/mountTravel.ts:106`) ne prend que la bête qui accepte un cavalier
  (`possessionCombatRideable`), et `mountUp` la soude au cavalier (même case). Un chien n'en diffère que par là : il
  peut porter une créature plus petite que lui, et sinon il combat à côté de son maître. Modification proposée :
  - naître alliée pour **toute** bête de combat possédée avec le groupe, pas seulement la première montable ;
  - n'appeler `mountUp` que si la bête porte effectivement ce héros (taille, `possessionCombatRideable`) ;
  - sinon la poser sur une case voisine de son maître, avec son propre tour d'Initiative et son IA d'allié.
  Ce qui reste à trancher au livre : quelle bête combat (Trait Dressé, Guerre ou Garde ?) et si la Peur ou la Terreur
  de Taille la font fuir quand elle est dressée. Ce qu'il faut côté données : la dotation `ratier-1` désigne `chien`
  (le chien générique) alors que le Bestiaire a `chien-de-ratier`. Progression et armure de la bête : la possession
  porte déjà `charsRolled`, `learnedTraits` et `items` ; il manque des verbes de fiche qui les visent.

- **Défaut — l'horloge d'une action d'entité passe avant son Test.** `jouerAction` pose `pendingTest`, puis la clôture
  `avancerHorloge` (`src/noyau/interactionsDExploration.ts:317-318`, 10 min) joue tout de suite 10 Rounds d'entretien
  hors combat (`outOfCombatUpkeep`) : un héros Hémorragique 2 saigne jusqu'à l'Inconscience avant son jet, l'anéantis-
  sement prend la main et le Test n'est jamais résolu (graine 15 : 13/19 → 1 Blessure, Inconscient, `partyWiped`).
  Classe de MyEdO/game#2689 (`cloturer` sous la modale du nœud `test`), commentée le 2026-11-23. L'hôte rend un refus
  (`IssueDEpreuve.refus`), sans contourner l'horloge.

## Corruption et maladies

- **Trou — aucune couture « une journée de maladie, résolue sur place ».** `dailyDiseaseUpkeep` (`src/engine/rest.ts`)
  diffère ses Tests (`maladie-test-quotidien`, `maladie-gangrene`, `maladie-persistance`) ; leurs appliers vivent dans
  la table de la cascade de nuit (`src/noyau/restFlow.ts:987-1010`, `bandeDeNuit`), liés à `get`/`set`. Les deux verbes
  qui font passer des jours (`avancerLeTemps`, `reposerLeGroupe`) passent par `runDailyUpkeep`, qui joue aussi la Faim,
  la Soif et le Dessoûlage (le second soigne en plus), et aucun ne reçoit `caredFor` d'un soignant hors du groupe (les
  sœurs de l'hospice) : `avancerLeTemps` ne le passe jamais (`src/noyau/horloge.ts:38`). L'hôte jette donc les Tests
  différés sur place et rejoue la dispatch des trois appliers (`entretenirLesMaladies`, `roguelite/src/noyau/soins.ts`).
  Idée : une journée de maladie résolue sur place, pure, dans `src/engine/rest.ts`, qui porte cette dispatch et que la
  bande de nuit comme tout hôte appelleraient.
- **Défaut — en combat, l'issue du seuil de Corruption tranchée après la victoire est perdue (MyEdO/game#4860).**
  Mesuré (un Soldat au seuil, Résilience 2, contre un mutant) : la fenêtre `renier` s'ouvre à `battle.over ===
  'victoire'` ; l'hôte y répond `false` (la mutation vient, `CONCEPTION.md`, « Corruption »), le journal dit « MUTE »,
  mais le héros rendu au groupe n'a aucune mutation : `resolveRenounce` (`src/noyau/corruptionFlow.ts:341`) mute le
  combattant du champ d'`actorIn`, alors que le groupe a déjà été rendu à la victoire. Hors combat (épreuve), la
  mutation porte.
