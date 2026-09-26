# Carte des Effects de scène — GÉNÉRÉ

> ⚠️ Fichier GÉNÉRÉ par `node scripts/docs/build-effects.mjs` (`npm run docs:effects`) — NE PAS ÉDITER À LA MAIN.
> Source : les schémas de `src/data/schemas/defs-scenes/effets.ts` (l'union `effectSchema`). Vocabulaire des actions authorées d'une
> scène/campagne, posées dans un `Flow` (`onVictory`, choix de dialogue, trigger, `delayedEffect`…).
> Voir `docs/campagne-authoring.md`.

**Périmètre mesuré / angles morts** — cette carte énumère le VOCABULAIRE AUTHORABLE de l'union `effectSchema` (AST
TypeScript de `src/data/schemas/defs-scenes/effets.ts` : nom, champs, 1re phrase de JSDoc). Elle ne mesure NI où chaque `Effect` est réellement
interprété (aucune colonne « Résolveurs », contrairement à `docs/vocabulaire-mecanique.md`) NI son usage réel dans
une scène/campagne (aucune colonne « Donnée ») : un `Effect` listé ici peut être un type authorable sans handler
câblé côté `src/state`, ou n'être jamais posé dans aucun JSON de campagne — cette carte ne le dira pas.

| Effect (`type`) | Champs | Rôle |
|---|---|---|
| `setFlag` | `flag`, `value?` | — |
| `setObjective` | `id`, `desc`, `...ScheduleSpec` | Pose/met à jour un OBJECTIF courant (surface « je fais quoi maintenant ? », #238) sur la pile `store.objectives`, keyé par `id` STABLE : re-poser le même `id` MET À JOUR sa prose (`desc`). |
| `clearObjective` | `id?` | Retire un objectif de la pile : `id` précis, ou TOUS si absent (fin d'acte). |
| `giveTrapping` | `trappingId?`, `custom?`, `heroId?`, `qualities?`, `identified?`, `skin?`, `magicKnown?`, `detectTried?`, `appraiseTriedDay?`, `price?` | Donne un objet à un héros (défaut : le premier). |
| `givePossession` | `nature`, `ref`, `heroId?` | — |
| `giveMoney` | `montant` | Donne (ou RETIRE, montant négatif) de l'argent au groupe. |
| `giveXp` | `amount` | Octroie des Points d'Expérience à TOUT le groupe (XP de session, identique pour tous). |
| `startCombat` | `encounter` | — |
| `startMassBattle` | `battle` | Combat de masse / Puissance de Bataille (`ADE II 8`) : ouvre l'écran de bataille sur le `MassBattleSpec` AUTHORÉ (armées, Rounds prévus, situations de Scènes par Round, rencontres des Scènes de combat, modificateur permanent). |
| `transition` | `scene`, `entry?` | — |
| `transitionBack` | — | Retour à la scène précédente (sortie d'intérieur), à la case d'entrée. |
| `startDialogue` | `dialogue`, `speakerId?` | Ouvre le dialogue scripté `dialogue`. |
| `journal` | `desc` | — |
| `document` | `title`, `desc` | — |
| `revealClue` | `indiceId`, `stade?` | Mécanique MAISON du carnet d'enquête (#670, aucune règle RAW) : révèle/avance un `Indice` de `campaignNarratif`. |
| `discreditClue` | `indiceId` | Écarte un indice comme fausse piste (barré, relisible au carnet) — mécanique MAISON (#670). |
| `extendedTest` | `skill?`, `characteristic?`, `difficulty?`, `label`, `targetDR`, `flag?`, `stake?` | Test ÉTENDU (`LDB 12 l.172-174`) : un acteur cumule des DR Round par Round jusqu'à `targetDR` (crocheter une serrure, forcer un mécanisme…). |
| `forceDoor` | `label`, `doorBE`, `doorB`, `flag?` | Enfoncer une PORTE/objet à PLUSIEURS (`EDO Appendice 2`) : objet (BE = Bonus d'Endurance, B = Blessures) ; chaque héros frappe (Bagarre, dégâts = DR + BF − BE). |
| `setTime` | `phase?`, `hour?`, `minute?` | Règle l'horloge par SAUT EN AVANT (le temps ne recule jamais) : soit sur une `phase` de la journée (« passe à l'aube/…/nuit »), soit sur une heure précise (`hour`[`:minute`]) — jamais les deux, jamais aucune des deux. |
| `delayedEffect` | `flow`, `cancelFlag?`, `...ScheduleSpec` | Effet PROGRAMMÉ (Lot 0, étendu #668) : `flow` est appliqué quand l'horloge atteint l'échéance, résolue par `scheduleAt` (`engine/clock`) selon la `ScheduleSpec` fournie — priorité `atDate` (date impériale absolue) > `afterDays` (« J+N », à `atHour:atMinute`, défaut minuit) > `afterMinutes` (compte à rebours relatif : mèche de bombe) > `atHour`/`atMinute` seuls (prochaine occurrence de cette heure du jour). |
| `openMerchant` | `entityId` | Ouvre la boutique d'une entité marchande (par son id) — permet d'inclure le Marchand dans un dialogue (ex. choix « Montrez-moi vos marchandises »). |
| `openPort` | `placeId` | Ouvre le PORT d'un lieu de la carte du monde (`MDG 15`) — SCRIPTÉ (arrivée mise en scène, cinématique de quête) sur le MÊME chemin que l'accostage en mer (`openPortAt`, state/seaVoyageFlow) : avec profil de port → relâche à terre en attente de décision (`pendingShoreLeave`) ; sans profil → transition directe. |
| `medicalAid` | `acts?`, `entityId` | Soins PAYANTS d'un PNJ (médecin/guérisseur/temple — `LDB 75` « Docteur en médecine », l'aide médicale se paie À L'ACTE, 4-6 pistoles) : ouvre l'INFIRMERIE du PNJ (modale persistante, state/medicFlow) avec ses actes et leurs tarifs — `acts` liste {act, cost?} ; le débit a lieu au lancement de chaque acte (remboursé si annulé avant le jet). |
| `restoreFortune` | — | Début de session (`LDB 17 l.41`) : chaque héros regagne tous ses Points de Chance, jusqu'à un maximum égal à son Destin actuel. |
| `rest` | `days?`, `lodging?`, `quality?` | Repos (`LDB 16/18/21`) : ouvre la MODALE DE NUIT (state/restFlow) — par héros : couchage + pitance, prix RAW calculés (`LDB 66` : commune 10 sc, privée 10 pa pour 2, repas 1 pa — débit dans la modale), puis bilan globalisé (Exposition dehors, récupération, cauchemars, contagion). |
| `mealParty` | — | Repas (#T2 — auberge, hôte généreux…) : nourrit TOUT le groupe pour la journée SANS consommer de ration — remet les compteurs/malus de Faim à zéro (`LDB 18 l.337-343`). |
| `inflictNightmares` | `heroId?` | Inflige le trauma « Cauchemars » (`LDB 21 l.95`) à un héros (défaut : le premier) après une scène marquante : chaque nuit, Test de Calme Facile (+40) ou Exténué. |
| `ambitionLost` | `heroId?` | Trauma (`ADE II Annexe I` « Troubles psychologiques », règle facultative `psych-acquisition-optional`) : un héros TÉMOIN d'un événement rendant une de ses Ambitions complètement irréalisable → Test de Calme Accessible (+20) ; échec → Trait psychologique *Trauma*. |
| `inflictPsychology` | `kind`, `indice`, `label`, `target?`, `heroId?` | Source de PEUR/TERREUR scénique (`LDB 21`) — une apparition, un présage, une vision d'horreur mise en scène par l'auteur (PAS un PNJ de la scène : hors combat, la Peur/Terreur de créature ne se teste QUE scriptée, cf. `engine/encounterPsych`). |
| `inflictDisease` | `disease`, `heroId?` | Inflige une Maladie (`LDB 20`) à un héros (défaut : le premier) — nourriture avariée, contact infecté, morsure… L'auteur choisit la maladie (diseaseDefs()) ; incubation/durée sont tirées à la contraction. |
| `inflictHunger` | `days?`, `target?`, `heroId?` | Impose la Faim (`LDB 18 l.337-343`) : `days` échecs de Test de Faim déjà encaissés — 1ᵉʳ → −10 F/E ; 2ᵉ+ → −10 aux autres Caractéristiques + 1d10 Dégâts (ignore les PA, min 1). |
| `inflictThirst` | `days?`, `target?`, `heroId?` | Impose la Soif (`LDB 18 l.340`, miroir de la Faim) : `days` échecs de Test de Soif déjà encaissés — 1ᵉʳ → −10 Int/FM/Soc ; 2ᵉ+ → −10 aux autres Caractéristiques + 1d10 Dégâts (ignore les PA, min 1). |
| `exposureNight` | `kind`, `count?`, `target?`, `heroId?` | Exposition au froid ou à la chaleur (`LDB 18 l.326-334`) : `count` Tests de Résistance (Intermédiaire), échecs en cascade (froid : −10 CT/Ag/Dex, puis −10 le reste, puis 1d10 Dégâts ignorant les PA, Inconscient à 0 PB ; chaleur : −10 Int/FM + Exténué, puis −10 le reste + Exténué, puis 1d10). |
| `inflictTrauma` | `kind`, `severity?`, `location`, `heroId?` | — |
| `ops` | `ops`, `on?`, `heroId?`, `untilTime?`, `label?` | EFFECTOP — pont UNIQUE entre la logique authorée (Flow) et le moteur mécanique des sorts : applique des `GameOp` à une cible (`party`/`hero` scène, ou `caster`/`target` incantation). |
| `zoneBlast` | `center`, `radius`, `ops` | Souffle de ZONE (Lot 3) centré sur une case : tous les combattants à `radius` cases (Chebyshev) — en combat par position, hors combat le groupe (à partyPos) — subissent les `ops` (vocabulaire unique `GameOp`, appliquées par `applyOps` cible par cible). |
| `fall` | `target`, `heroId?`, `metres`, `to?` | Chute (`LDB 15 l.80-84`) : la cible tombe de `metres` mètres → 3 Dégâts/mètre + 1d10, réduits par le Bonus d'Endurance mais PAS par les PA ; si les Blessures subies dépassent le BE → État À Terre. |
| `setLight` | `level` | Mise en scène (Lot L) : règle le niveau de LUMIÈRE de la scène (0 = noir, 1 = plein jour) — « les lumières baissent, le rideau se lève ». |
| `setDoor` | `x`, `y`, `side`, `z?`, `open` | Porte dynamique (brouillard de guerre) : ouvre/ferme la porte de l'arête (x,y,side) — une porte fermée bloque vue ET passage. |
| `moveEntity` | `id`, `to?`, `remove?` | Repositionne (ANIMÉ) ou RETIRE une entité de scène posée — mise en scène scriptée (#701 : fuite, entrée, disparition d'un figurant). |
| `playSfx` | `id` | Son PONCTUEL (cloche de minuit, cri hors-champ…) — id du registre audio (#701). |
| `giveSin` | `amount?`, `heroId?` | Points de Péché (`LDB 40 l.30-36`) : l'auteur/MJ sanctionne une infraction aux commandements du dieu d'un Bienheureux — 1 à 3 selon la gravité (l.36). |
| `corruptionExposure` | `level`, `skill?`, `align?`, `heroId?` | Exposition à une Influence corruptrice (`LDB 19 l.23-75`) : Test de Résistance (Influence physique) ou de Calme (spirituelle) par MODALE ; Points de Corruption selon le niveau et le DR. |
| `waterExposure` | `mode`, `source?`, `target?`, `heroId?` | Exposition HYDRIQUE (`MSRC 16` p.91 — « Maladies transmises par l'eau ») : Test de **Résistance Intermédiaire (+0)** modifié (tableau 1 « Source d'eau » = `source`, choix d'auteur de la zone d'eau ; tableau 2 « Blessures et États » DÉRIVÉ du héros, immersion seule) ; raté → d100 « +10 pour chaque DR négatif » → maladie CONTRACTÉE directement (le Test d'exposition EST le test — jamais un second Test de Contraction). |
| `learnSpell` | `spell`, `heroId?` | Enseigne un sort SANS coût en PX (trouvaille de campagne : grimoire d'un maître, parchemin…) au héros que son Talent de lanceur rend éligible, désigné ou non — sinon refus NOMMÉ au journal (`LDB 46 l.14`). |
| `castSpell` | `casterId`, `spellId`, `targetId?`, `mode?` | Incantation SCRIPTÉE (#98) : rituel scénique, piège magique, PNJ qui lance à un beat précis (dialogue, trigger, effet différé). |
| `petitePriere` | `heroId?`, `reward` | « Petites Prières » (`LDB 25 l.22-24`, option `prayer-petites`) : posé sur un SITE SACRÉ (autel, sanctuaire). |
| `sessionEnd` | — | FIN DE SÉANCE (`LDB 05` Ambitions l.793-841 + Détermination `LDB 17 l.81`) : ouvre l'écran de fin de séance EXISTANT (`SessionEndModal`) où le MJ/les joueurs cochent les Ambitions accomplies et les Motivations suivies — l'octroi (PX +50/+500, Détermination, Chance restaurée) passe par `endSession` (state/partyFlow), déjà câblé derrière cette modale. |
| `openCharacterCreator` | — | CRÉATION DE PERSONNAGE (#83) : ouvre l'assistant EXISTANT (`src/ui/creator/`) pour un NOUVEAU héros (comme le bouton « + » de l'écran Groupe) — un remplaçant scénarisé, un compagnon rejoignant le groupe. |
| `interlude` | `weeks?` | « Entre deux aventures » (`LDB 22-23`, Jalon 5) : ouvre l'interlude — Événement d100 par héros, min(3, semaines) Activités chacun, puis Argent à gaspiller et le temps passe. |
| `grantFavor` | `heroId?`, `level`, `owedTo`, `desc` | Faveur (`LDB 23 l.139-153`, #509) : contrepartie future acceptée en échange d'une aide immédiate — Faveur de départ de campagne, ou octroi narratif hors flux d'Activité. |
| `startPursuit` | `partyRole?`, `distance`, `escapeAt?`, `skill`, `foes`, `encounter?`, `policy?` | Poursuite TERRESTRE jouable (`LDB 15 l.88-108`) — à poser sur un trigger/dialogue (« ils prennent la fuite », « rattrapez-les ! »). |
| `openTavernGames` | — | Ouvre les JEUX DE TAVERNE (`NADJ 16`, option `tavern-games`) — à poser sur un choix de dialogue d'aubergiste (« Une partie ? ») ou une entité de taverne. |
| `openWorldMap` | — | Ouvre la CARTE DU MONDE (#T2) — à poser sur la porte/route d'un lieu (« partir en voyage »). |
| `setVessel` | `vehicleId`, `label?`, `morale?`, `hullCurrent?`, `hullMax?`, `saboteurDR?`, `waterLitres?`, `provisions?`, `crew?` | Dote le groupe d'un NAVIRE DE CAMPAGNE (`state.vessel`, `MDG 13-15`) — à poser quand le groupe reçoit/achète un bateau (don d'un patron, chantier). |
| `adjustManann` | `factorId?`, `delta?` | Fait varier l'HUMEUR DE MANANN du navire de campagne (`MDG 15 l.83-125`) — à poser sur une bénédiction de prêtre, un sacrifice ou tout événement narratif d'auteur. |
| `adjustVessel` | `label?`, `morale?`, `hullCurrent?`, `hullMax?`, `saboteurDR?`, `waterLitres?`, `provisions?`, `crew?` | AJUSTE le navire de campagne EXISTANT (#233) — patch des SEULS champs fournis, contrairement à `setVessel` (remplacement total : effacerait Humeur de Manann/dégâts/Moral accumulés). |
| `endDialogue` | — | — |

_58 Effects — dérivés de `src/data/schemas/defs-scenes/effets.ts`._
<!-- sources-empreinte: a3766bd699875e0f5898c88db04fce4d3ae8671a (6 fichiers, 0 dossiers) corps: 3d2fdf07b755219f6c98ba17be2b89b63f00b18a -->
