# Retiré des maquettes pour une raison de MOTEUR : DELTA seul

Ticket: #4411


Sources lues : `hotes/godot/cibles/propositions/*.md` (9 notes de famille), `git log -p` des notes (commits `cc2cd66c7`,
`444ceaecb`, `4aa0029d2`, `bc1619095`, `d76592fb5`, `dd177b34e`, `ab9feee21`, `853454977`), état initial `a774927cf`,
`/mnt/project-files/audit-verbes-3935/dette-verifiee.md` (DV) et `transversal.md` (T §4A-E, §1c, §1d).
Les corps des commits n'ont que leur titre : la raison est dans les notes. Les retraits de retouche portent pour la plupart
`#4411` (2026-11-17) ; le rendu depuis JSON (`455f733c7`, 2026-11-18) a supprimé `sources/lieux-et-nuit/bivouac.{js,css,html}`
au profit de `sources/maquettes/bivouac.ts`, qui ne dessine que ce que le noyau sert (couchage « Dehors », nourriture Ration/Rien).

## 1. Déjà couvert (un renvoi par écran, pas de recopie)

| Écran | Couvert |
|---|---|
| bivouac | abri de fortune Survie LDB 09 l.554 : DV C10 ; sac de couchage LDB 74 l.60 : DV C9 ; « Tente / Belle étoile » : T 4D (« options inventées ») |
| nuit-a-l-auberge | choix de qualité : T 4D ; écurie LDB 66 l.14 : DV C11 ; boire : DV §2 (« Boire à l'auberge », manque de geste) |
| interlude-en-ville | « Passer la semaine » + tableau des semaines (« le noyau ne tient pas de semaine courante ») : T 4B dernière puce |
| services-du-lieu-medecin | compte puis « Payer » : T 4B ; Chirurgie 15/– : T 4E |
| sauvegardes | portraits du groupe et vignette du lieu retirés (`save.ts:26-34`) : T 4E |
| evenement-de-route, voyage-fluvial, voyage-en-mer | « Faire halte » (« aucun verbe », LDB 51 l.195) : T 4D ; « Rebrousser chemin » / « Attendre » : T 4D ; barreur : DV C20 |
| postes-de-bord | « Veille » (Perception) et « Tir de batterie » retirés des Tests du jour : T 4E |
| course-poursuite-en-mer | manche par jour, gain net, « +2 contre +1 » : DV C7, T 4E |
| bataille-de-masse(-test) | Rassemblement héros par héros : T 4E ; aide Guérison/potions : DV C5 ; Horreurs de la Guerre : DV §2 |
| corruption-mutation | « Je te renie ! » avant le tirage : DV §2, T 4B |
| debut-du-round | Chance dépensée au clic de la carte : T 4B |
| creation-identite | Motivation, Ambitions, nom sans saisie (vue Godot) : DV §2, #3009 |
| fin-de-seance | Ambition de groupe sans champ : DV C17 ; retraite LDB 05 l.799 : DV C18 |
| exploration-premiere-personne | `pivoterLeGroupe`, `avancerDUnPas` : T 1c |
| carte-du-monde | « Reprendre le voyage » (`carteEnVue.reprendre`) : T 1d |
| butin | « Laisser » sans verbe : T 6 (verbe à créer) |

## 2. DELTA : retiré ou non dessiné pour le moteur, absent de DV et T

| # | Famille | Écran | Retiré / non dessiné | Réf livre (telle que la note) | Raison donnée | Où |
|---|---|---|---|---|---|---|
| 1 | lieux-et-nuit | bivouac | pastille « Lever le camp » (sortie de la halte) | aucune citée ; la note dit « sans règle de marche forcée » (LDB 51 l.195 cité ailleurs pour la marche forcée) | « sans règle de marche forcée » ; retouche : « Aucune sortie : la halte de voyage ne se quitte pas » | `lieux-et-nuit.md` bivouac, `cc2cd66c7` (état initial `a774927cf`) ; `modalArbiter.ts:192` |
| 2 | combat, combat-suite | jet de défense, test-de-corruption, fuite, maladresse, poursuite (cascade) | geste « Annuler » retiré (dessiné à l'origine sur corruption et désengagement) | aucune | « Pas d'« Annuler » : le flux n'en a pas » | `combat.md` defense-avant-le-de ; `combat-suite.md` test-de-corruption, fuite, course-poursuite-en-mer-test ; `4aa0029d2` |
| 3 | combat-suite | dissipation-entree | Soutien d'un lanceur du même Domaine non montré | LDB 46 l.162 | « que le noyau fond dans le seuil » | `combat-suite.md` dissipation-entree |
| 4 | combat | defense-avant-le-de / defense-riposte | Porte-bouclier et Riposte jamais ensemble (deux images) ; tout réglage que le jet n'offre pas est « absent, jamais grisé » | AA 13 l.76-84 ; LDB 10 l.1028-1037 | « le noyau n'offre jamais Porte-bouclier et Riposte ensemble » | `combat.md` écran 1 |
| 5 | combat | jet-avant-le-de-armes / -empoigner | « Empoigner » seulement à mains nues, sans choix d'arme ; « Des deux armes » retire la rangée Arme | LDB 10 l.767-773, LDB 14 l.159 | « le noyau n'offrant « Empoigner » qu'à mains nues » | `combat.md` écran 4 |
| 6 | combat-suite | surincantation, incantation-critique | axe « Dégâts » de la règle révisée ; compteur « Jets de table choisis » ; Tableau des Incantations Imparfaites Mineures qu'impose un Critique, non annoncé | VDM 02 l.194-205 ; EDOC 13 l.276 ; LDB 46 l.28 | « n'est pas dessiné » (raison non dite) | `combat-suite.md` surincantation, incantation-critique |
| 7 | combat-suite | corruption-mutation | texte « Pattes d'animaux · +1 Mouvement » retiré des textes repris | LDB 19 l.118 | aucune raison dans la note | `4aa0029d2` (diff de `combat-suite.md`) |
| 8 | commerce | port-avitaillement | jours de vivres que l'achat donne à l'équipage ; Encombrement des vivres dans la cale | MDG 14 l.236-252 | « aucun lecteur ne les sert » | `commerce.md` port-avitaillement |
| 9 | commerce | halle, port | refus (bourse sous le plancher, porteur plein, cale pleine, effectif complet), aucun acheteur, moitié du lot proposée, évaluation du vin résolue, Marchandage de vente, Marchandage perdu, Amélioration à unités, pose en cours : non dessinés | MSRC 13 l.146-160 ; MDG 15 l.389 | aucune raison, liste « Non dessiné » | `commerce.md` « Non dessiné » |
| 10 | commerce | halle-achat | « Conclure » : le coût sans payeur / parts réglables par bourse que le noyau ne prend pas en argument (il débite le groupe) | MSRC 13 ; MDG 15 l.331-341 | « le noyau ne les prend pas en argument » (image au-dessus du moteur, non retirée) | `commerce.md` port-achat |
| 11 | exploration-et-recit | dialogue | payeur du coût d'une réponse non dit | aucune | « le noyau le prend au total des bourses (`partyMoneyTotal`) » | `exploration-et-recit.md` dialogue |
| 12 | exploration-et-recit | soins-entre-heros | Chirurgie entre héros non dessinée | LDB 09 l.260 cité pour Panser seulement ; Chirurgie LDB 10 l.184 citée ailleurs | aucune raison | `exploration-et-recit.md` soins-entre-heros |
| 13 | heros | progression-changement-de-carriere | restriction des Sorciers non dessinée ; plaque de confirmation de la colonne Carrière ; carrières hors Livre de base | LDB 07 l.148 | « n'est pas vérifiée par le noyau, donc pas dessinée » | `heros.md` progression-changement-de-carriere |
| 14 | heros | creation-caracteristiques, creation-signe-astral, creation-presentation | prose verbatim de la Caractéristique ; champ « Dieux » ; Blessures, réserves, Compétences, Talents, signe, bourse | LDB (prose, sans ligne) | « n'est pas servie par la vue » ; « absent » ; « la vue ne sert ni… » | `heros.md` (3 écrans) |
| 15 | accueil-et-systeme | menu-de-la-partie, fin-de-chapitre, fin-de-seance | refus de « Terminer la séance » hors exploration ou chez l'invité ; état invité (« Masquer ») ; champ de l'Ambition suivante et Ambitions écrites dans les colonnes de fin-de-chapitre ; gain par héros que « aucune vue de `src/hote` » ne sert | LDB 05 l.795-799, LDB 17 l.81 | « non dessiné » ; `heroSessionXp` non servi | `accueil-et-systeme.md` |
| 16 | accueil-et-systeme | nouvelle-partie, sauvegardes, accueil | état « aucune sauvegarde », état sans partie, sauvegarde refusée (hors combat) | aucune | « non dessiné » | `accueil-et-systeme.md` |
| 17 | voyage | arrivee | cartouche « Lignes du Rochet » et « Prendre un billet » retirés ; classe de passage, heures par jour, allure, cadence et « Marchander » relégués à la carte ou à la plaque de mode | aucune ; tarif LDB 51 l.184 | « le billet se paie au départ » (`billetFlow.ts:1-9`) ; audit §7 | `voyage.md` arrivee, `444ceaecb`. Voisin de T 1d (`marchanderLeBillet`) mais pas de la même chose |
| 18 | voyage | activites-en-mer | « Entraînement d'équipage » dessiné FERMÉ (non retiré) | MDG 15 l.294-300 | `seaActivities.ts:103-105` le ferme alors que le navire a des marins PNJ | `voyage.md` activites-en-mer |
| 19 | voyage | combat-naval | tour de Mira hors manœuvre (plaques Manœuvrer / Bordée / Attaque) retiré de l'image ; Distance de course-poursuite non montrée ici | MDG 13 l.354-403 | « le jeu la joue pendant la traversée » | `voyage.md` combat-naval, `444ceaecb` |
| 20 | voyage | evenement-de-route-echec | jour qui ne s'arrête pas sur un échec influençable : l'image montre ce que le noyau ne fait pas (jour par jour : arrêt avant le dé ; sous ordres : jamais) | LDB 17 l.23 | « ce que le noyau ne fait pas » (audit M2) | `voyage.md` evenement-de-route-echec |
| 21 | outils | coop-salon | médaillon sur le « siège à pourvoir » retiré ; rangée d'emplacement vide non dessinée | aucune | « il ne se presse pas, l'invité entre par le code » ; `sieges.ts:41`, `:180` | `outils.md` coop-salon, `444ceaecb` |
| 22 | outils | compendium-atelier, éditeur, compendium | « Supprimer » en deux pressions (pas d'« Annuler » d'historique) ; non dessinés : document Narratif, options des outils hors Terrain, architecture, calques, validation avec défauts, recherche active, table et dé, `resceller`, coop échec / hors réseau / invité / hôte déconnecté | aucune | « le compendium n'a pas d'« Annuler » d'historique » ; le reste sans raison | `outils.md` |

Décompte du delta par famille : combat 2 (4, 5) + 1 partagé (2) ; combat-suite 4 (2, 3, 6, 7) ; voyage 4 (17-20) ;
lieux-et-nuit 1 (1) ; commerce 3 (8, 9, 10) ; exploration-et-recit 2 (11, 12) ; heros 2 (13, 14) ; accueil-et-systeme 2 (15, 16) ;
outils 2 (21, 22).

## 3. Raison de RÈGLE (retrait légitime, hors liste principale)

| Écran | Retiré | Réf | Raison |
|---|---|---|---|
| bivouac | les huit postes d'Activité d'Étape et leur billet, dont « Rester aux aguets » (aperçu Perception) | EDOC 08 l.131, l.155-157 | une Activité par Étape se joue dans la journée ; `voyage-etapes` éteinte par défaut (réglage de config, `travelPostes.ts`) |
| bivouac | veille de nuit / tour de garde | LDB 13 l.53-59, l.64, EDOC 08 l.155-157 | « Aucune règle de tour de garde aux livres » (en plus : « Absent du code ») |
| evenement-de-route | « Rebrousser chemin », « Attendre » | LDB 51 l.215 | « le livre n'en pose pas » |
| nuit-a-l-auberge | choix de qualité par le joueur | LDB 66 l.5-28 | la qualité est une donnée de l'établissement (`logis-qualites`) |
| butin | case « barrée si trop chargé » | LDB 61 l.33 | le livre permet de charger |
| postes-de-bord | Test de Perception (Vigie) et Tir de batterie dans « Ce que la journée jouera » | MDG 14 l.80-82 | Perception sur circonstance seulement ; Tir de batterie en combat |
| jet-de-competence, incantation, contre-sort, dissipation, focalisation, corruption | « Relancer » et « Résilience » fermées sur une réussite | LDB 17 l.23, l.68 | règle du livre ; T 4B signale en plus la divergence du noyau sur la Résilience (arbitrage) |
| test-de-corruption | dessiné hors combat | LDB 19 l.29 | l'exposition n'est pas une Action du tour |
| interlude-en-ville | trois semaines fixes | LDB 23 l.5 | le livre compte trois Activités par interlude (le noyau idem) |
| exploration | case d'arrivée au sol | aucune | décision utilisateur 2026-11-17 (`exploration-premiere-personne`) |

## 4. Poison et incohérences rencontrés (non corrigés)

- `sources/voyage/fleuve.js:41` et `sources/voyage/mer.js:78` : `retour('Faire halte', 'ancre')` dans la branche par défaut, alors que
  `voyage.md` dit « Aucune pastille « Faire halte » » (fluvial) et « le bas gauche reste vide » (mer). Vérifier si la branche rend encore.
- `voyage.md` evenement-de-route : texte « aucun verbe, LDB 51 l.195 » cite une ligne de marche forcée comme raison d'absence de verbe.
- Note `lieux-et-nuit.md` « Ce qui se joue la nuit » : « Absent du code : veille de nuit ; abri de fortune complet ; sac de couchage +20 ; boire une pinte » est toujours là (DV C9, C10 couvrent les deux du milieu).

## 5. Non couvert

`kit.md` et `dispositions.md` (non lus pour retraits), les `sources/*/*.js` hors greps ciblés, `../ecrites/*.md`, `docs/vocabulaire-mecanique.md`
et `docs/index-moteur.md` (aucune conclusion d'absence de vocabulaire n'est portée ici), `brief-retouches.md` et les rapports par famille de l'audit
(seuls DV et T lus).
