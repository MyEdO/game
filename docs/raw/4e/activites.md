# Atlas RAW — Activités & Événements (Entre deux aventures)

> Base de connaissance des **règles WFRP4 (RAW)**, consolidées sur les livres autorisés, à usage d'agent
> (vérifier que le code respecte le RAW). Chaque règle cite sa source `LIVRE NN l.X-Y`
> (NN = préfixe du fichier de chapitre, l = lignes du `.md` source). **Voir aussi** tisse les renvois
> entre règles ; **Implémente** pointe le(s) module(s) `src/` correspondant(s).
> Conventions d'abréviation : voir [`sources.md`](../sources.md).
> ⚠️ Les champs **Implémente** sont GÉNÉRÉS (`npm run raw:implemente` — source éditoriale : `src/data/raw.manifest.json`) — ne pas les éditer à la main.

---

## Sommaire

- [Cadre général « Entre deux aventures »](#cadre-général--entre-deux-aventures-)
- [Tableau des Événements (d100)](#tableau-des-événements-d100)
- [Argent à gaspiller](#argent-à-gaspiller)
- [Devoirs et Responsabilités](#devoirs-et-responsabilités)
  - [Avec le pouvoir (Niveaux 3-4)](#avec-le-pouvoir-niveaux-3-4)
  - [Amélioration Elfique / Prestige Elfique](#amélioration-elfique--prestige-elfique)
- [Activités Répandues (LDB 23)](#activités-répandues-ldb-23)
  - [Apprentissage Particulier](#apprentissage-particulier)
  - [Artisanat](#artisanat)
  - [Changement de Carrière](#changement-de-carrière)
  - [Consulter Un Expert](#consulter-un-expert)
  - [Dressage](#dressage)
  - [Entraînement](#entraînement)
  - [Faites-moi une Faveur !](#faites-moi-une-faveur-)
  - [Invention !](#invention-)
  - [Opérations Bancaires](#opérations-bancaires)
  - [Passer Commande](#passer-commande)
  - [Revenus](#revenus)
- [Activités de Classe (LDB 23)](#activités-de-classe-ldb-23)
  - [Dernières Nouvelles (Itinérants, Riverains)](#dernières-nouvelles-itinérants-riverains)
  - [Entraînement au Combat (Guerriers, Itinérants)](#entraînement-au-combat-guerriers-itinérants)
  - [Observer Une Cible (Roublards)](#observer-une-cible-roublards)
  - [Recherche de Savoir (Lettrés)](#recherche-de-savoir-lettrés)
  - [Réputation (Citadins, Courtisans, Lettrés)](#réputation-citadins-courtisans-lettrés)
  - [Semer la Dissension (Citadins, Ruraux)](#semer-la-dissension-citadins-ruraux)
- [Activités de Guerrier — AA Annexe II](#activités-de-guerrier--aa-annexe-ii)
- [Activités de Bataille — ADE II 8](#activités-de-bataille--ade-ii-8)
- [Activités de Voyage — EDOC 5](#activités-de-voyage--edoc-5)
- [Nouvelle Activité : Convalescence — ADE II Annexe I](#nouvelle-activité--convalescence--ade-ii-annexe-i)
- [Règles optionnelles connexes](#règles-optionnelles-connexes)
- [Voir aussi](#voir-aussi)

- **La Mer des Griffes (MDG)** <!-- MDG-INTEGRATION -->
- **Activités en mer (MDG 15)** — 1 Activité/Personnage par semaine de 8 jours à bord ; règles d'interlude *Argent à gaspiller / Avec le pouvoir / Amélioration elfique* suspendues ; liste LDB/AA réalisable ; *Semer la dissension* contre les officiers = −2d10 Moral.
- **Commerce d'opportunité** — investir jusqu'à la valeur d'Encombrement libre en CO ; Test étendu de Marchandage Complexe (−10), 10 DR, 3 tentatives ; gains −tout / −moitié / +10 % / +20 %.
- **Cartographie** — Métier (Cartographe) Complexe (−10), 2 ports ; carte = DR en CO + 2 DR d'Orientation ; option Planque (découverte sur 50 ou moins).
- **Entraînement d'équipage** — Commandement Difficile (−20) + Compétence Difficile (−20) ; +DR(Commandement) à l'équipage PNJ, plafonné aux Augmentations de l'instructeur ; 2 pistoles d'argent/membre.
- **Entretien du navire** — au port (mer −20, chantier +20) ; Métier (Charpentier/Constructeur) Intermédiaire pour l'Usure, Difficile (−20) pour les Critiques ; pièces détachées = Taille du navire, 2 Enc/5 Blessures réparées.
- **Aldorf, la Couronne de l'Empire (ACE)** <!-- ACE-INTEGRATION -->
- **Activités à Altdorf (ACE Annexe I)** — 5 Activités gate `where: altdorf` (proposables SEULEMENT à Altdorf) : Pénitence, Entraînement avec une arme inhabituelle, Tester des objets magiques, Mécénat, Recherche universitaire.
- **Pénitence** — Prière Accessible (+20) ; succès −1 Péché (−2 sur Impressionnant/+4 DR ou mieux) ; échec → État Exténué 1er jour prochaine aventure ; Maladresse → Test Colère des dieux à la place.
- **Entraînement avec une arme inhabituelle** — Corps à corps ou Projectiles Complexe (−10) selon l'arme ; succès = arme maîtrisée, échec = recommencer au prochain interlude.
- **Tester des objets magiques** — Recherche Complexe (−10) ; DR ≥ +4 = plein potentiel + dangers, DR 0 à +3 = fonction principale, échec = rien, échec ≤ −4 = Exposition mineure à la Corruption.
- **Mécénat** — variante d'Opérations bancaires, mise ≥ 5 CO, retrait par Évaluation Intermédiaire (+0) ; bandes de DR de +20 % de profit à perte totale + inspecteur/répurgateur.
- **Recherche universitaire** — Recherche Intermédiaire (+0) ; chaque +DR = −100 PX sur le prix d'un sort (mini 100 PX), achat immédiat requis.

---

## Cadre général « Entre deux aventures »

**Source :** LDB 22 l.3-5, LDB 23 l.1-11.

> « Cela peut prendre plusieurs séances de jeu, mais finalement toutes les aventures s'achèvent. Vous
> pouvez alors passer plusieurs semaines durant lesquelles votre Personnage n'a plus rien à faire avant
> le début de la prochaine aventure. »

Séquence obligatoire :

1. **Lancer 1d100** sur le Tableau des Événements (un tirage par Personnage — LDB 22 l.5).
2. **Dépenser l'argent** de la dernière aventure (voir *Argent à gaspiller*).
3. **Choisir les Activités** (max 1/semaine, max 3 au total — LDB 23 l.5).
4. **Résoudre les conséquences** avant la prochaine aventure.

> « Chaque règle de ce chapitre est optionnelle. » — LDB 21 l.110 (sous le titre `# OPTION : TOUT EST FACULTATIF`, LDB 21 l.108 — l'extraction ouvre la section « Entre deux aventures » en fin de `21 - Psychologie.md`).

**Règle maison recommandée :** la règle optionnelle peut être désactivée entièrement (flag `interlude-enabled`, entrée de `src/data/reglesOptionnelles.json` lue par `src/engine/policy.ts`).

---

## Tableau des Événements (d100)

**Source :** LDB 22 l.11-135.

Lancer **1d100** par Personnage. Certains événements n'affectent que le Personnage tirant, d'autres le groupe entier.

| d100 | Événement | Mécanique clé |
|------|-----------|---------------|
| 01–03 | **Allié Inculpé** | Savoir (Loi) Accessible (+20) = 1 Activité ; ou 3 Activités groupe = disculpé. Succès → Faveur Majeure. Échec → allié pendu. |
| 04–06 | **Enchères Ésotériques** | Payer 10 CO → vieux livre ; Lettrés : +20 aux Tests *Recherche de Savoir*. |
| 07–10 | **Trahison !** | Un ami/parent/allié se retourne. Influence la prochaine aventure. |
| 11–14 | **Imprévu** | Monture enfuie → Dressage (Cheval) Accessible (+20). Échec = monture perdue. Sans monture : ampoule (cosmétique). |
| 15–18 | **Eh ! Tu as Renversé Ma Pinte !** | Conflit local, un PNJ cherche vengeance. |
| 19–21 | **Répression du Crime** | Voleurs : aucun Revenu liquide ; Opérations Bancaires → dépôt Haut Risque uniquement. |
| 22–25 | **Le Prévôt Arrive** | Tous perdent **30 %** de leur argent avant les Activités. |
| 26–29 | **Fausse Monnaie** | 1/5 des pièces concerné. Opérations Bancaires : −20 % de l'argent placé ; Revenus : −20 %. |
| 30–33 | **Profits Abondants** | Riverains : +50 % sur l'Activité *Revenus*. |
| 34–36 | **Un Homme Averti En Vaut Deux** | Présage cryptique : **+1 Point de Chance max** pour la prochaine aventure. |
| 37–40 | **Festivités** | Perd **1 Activité** (fête locale). |
| 41–44 | **Météo Défavorable** | Compétences sociales −10 prochaine aventure ; nourriture +20 %. |
| 45–48 | **Météo Radieuse** | Peut ajouter **1 nouvelle Ambition**. |
| 49–52 | **Mauvaise Récolte** | Ruraux : aucun Revenu. Nourriture ×2 dans la région pour la prochaine aventure. |
| 53–56 | **Maladie Pernicieuse** | Test d'**Endurance Facile (+40)**. Échec → contracte le **Flux Sanglant** (LDB 20). |
| 57–60 | **Complications Monstrueuses** | *Revenus* bloqués jusqu'à résolution. Chaque Personnage peut sacrifier 1 Activité pour régler la menace (joué en scène) ; succès → 1 *Revenus* gratuit. |
| 61–63 | **L'Étreinte de Morr** | Mort d'un parent/ami/allié. Causes naturelles ou sinistres. |
| 64–65 | **Nouvelle Lune** | Voleurs : +20 % sur l'Activité *Revenus*. |
| 66–67 | **Vieilles Dettes** | Une Faveur Importante/Majeure s'active. Perd 1 Activité en préparation. |
| 68–69 | **Opportunité de Passage** | Citadins & Ruraux : +50 % d'argent via *Revenus*. |
| 70–71 | **Paix et Sérénité** | Pleine forme au début de la prochaine aventure. |
| 72–73 | **Colporteur** | 3 sc → +10 à tous les Tests *Dernières nouvelles*. |
| 74–76 | **Animal Domestique Malade** | Test **Soin aux animaux Intermédiaire (+0)**. Échec → animal meurt. |
| 77–79 | **Mise À Sac** | Planque dévalisée avant toute *Opérations bancaires*. Si < 1 CO → équipement le plus précieux aussi volé. |
| 80–82 | **Émeutes** | Courtisans : aucun *Revenus*. Banques réputées → vérifier faillite immédiate. *Semer la dissension* : +10 à tous les Tests. |
| 83–85 | **Kleptomane** | Perd **50 %** de l'argent de la dernière aventure. |
| 86–88 | **Soupçonné d'Hérésie** | Test **Charme Très Difficile (−30)**. Échec → gagne un Répurgateur comme némésis. |
| 89–91 | **Suspect** | Tous renoncent à 1 Activité (profil bas). Voleurs : aucun *Revenus* jusqu'à la prochaine aventure. |
| 92–94 | **Rien À Signaler** | Début d'aventure avec un appétit pour le risque. |
| 95–97 | **Considération Inattendue** | Récompense d'un PNJ aidé par le passé. Peut être un objet ou une bourse (disponible à la prochaine aventure). |
| 98–00 | **Mercenaires Particuliers** | Entraînement/Apprentissage particulier : −20 % des coûts. *Entraînement au Combat* : +20 % à tout Test adapté. |

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 22` (l.11-135) → `allie-inculpe`, `encheres-esoteriques`, `trahison`, `imprevu`, `eh-tu-as-renverse-ma-pinte`, `repression-du-crime`, `le-prevot-arrive`, `fausse-monnaie`, `profits-abondants`, `un-homme-averti-en-vaut-deux`, +24 — `src/data/combat-stakes.json`, `src/data/interludeEvents.json`, `src/state/favorFlow.ts`, `src/state/interludeFlow.ts`

---

## Argent à gaspiller

**Source :** LDB 23 l.14-19.

> « Après avoir effectué un lancer sur le Tableau des Événements, vous pouvez dépenser l'argent avec
> lequel vous avez terminé la dernière aventure. […] tout l'argent restant à votre Personnage est
> considéré dépensé. En totalité. »

L'argent non sécurisé (voir *Opérations Bancaires*) disparaît avant la prochaine aventure. Les Revenus sont crédités **après** le gaspillage (LDB 23 l.191 : « seulement une fois que vous avez disposé de l'argent de votre dernière aventure »).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 23` (l.14-19, l.191) → `MassBattleState`, `revenus`, `heroBudget`, `consumeActivity`, `ActivityDef`, `everBelongedClasses`, `openCatalogActivity`, `confirmActivity`, `Combatant`, `dernieres-nouvelles`, +2 — `src/data/activities.json`, `src/data/reglesOptionnelles.json`, `src/engine/activities.ts`, `src/engine/types.ts`, `src/state/interludeFlow.ts`, `src/state/massBattleFlow.ts`

---

## Devoirs et Responsabilités

**Source :** LDB 23 l.22-56.

Les Personnages peuvent **perdre des Activités** à cause de leur Carrière, Statut ou race.

### Avec le pouvoir (Niveaux 3-4)

**Source :** LDB 23 l.31-37.

Si un Personnage a atteint le **Niveau 3 ou 4** de son Évolution de Carrière et **n'entreprend pas l'Activité *Revenus*** :

> « vous baissez d'un Niveau dans votre Évolution de Carrière ; vous repassez du quatrième Niveau au
> troisième, ou du troisième au deuxième. Cela ne coûte aucun Point d'Expérience. »

Le Statut inférieur entraîne des Revenus moindres lors des futures Activités. Pour récupérer le Niveau perdu : payer à nouveau le coût en PX.

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 23` (l.22-56) → `craft`, `finishInterludeEvent`, `learn`, `interlude-elf-duty` — `src/data/activities.json`, `src/data/reglesOptionnelles.json`, `src/state/interludeFlow.ts`
- sans code : `LDB 23` (l.31-37)

### Amélioration Elfique / Prestige Elfique

**Source :** LDB 23 l.40-56.

Les Personnages **elfes** doivent entreprendre **1 Activité** supplémentaire pour maintenir le contact avec les leurs (rapports aux agents d'Ulthuan ou aux espions du roi asraï). Cette Activité n'offre aucun avantage mécanique.

**Restriction :** les elfes ne perdent cette Activité **que si la durée entre deux aventures est d'au moins trois semaines** (LDB 23 l.56). Un elfe dispose donc toujours d'au moins deux Activités.

> « Évidemment, si vous pensez que cela pénalise injustement un Personnage elfe, ou rend le jeu moins
> amusant, n'hésitez pas à ignorer une ou deux restrictions. » — LDB 23 l.54.

**Règle optionnelle :** flag `interlude-elf-duty` (`src/engine/policy.ts` l.342-348).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 23` (l.40-56) → `craft`, `finishInterludeEvent`, `learn`, `interlude-elf-duty` — `src/data/activities.json`, `src/data/reglesOptionnelles.json`, `src/state/interludeFlow.ts`

---

## Activités Répandues (LDB 23)

**Source :** LDB 23 l.59-250.

> « Vous pouvez entreprendre un maximum d'une Activité par semaine, et vous pouvez tenter un **maximum
> de trois Activités** au total, et ce, quelle que soit la durée de la période entre deux aventures. »
> — LDB 23 l.5.

N'importe quel Personnage peut tenter n'importe quelle Activité de Classe, mais hors de sa Classe la Difficulté monte d'un Niveau (LDB 23 l.197).

---

### Apprentissage Particulier

**Source :** LDB 23 l.67-72.

Apprendre un Talent **en dehors de sa Carrière**, avec un tuteur. Nécessite un tuteur (chercher via *Consulter un expert* si le Talent est obscur ou hors grande ville).

**Coût tuteur :** `2D10 pistoles d'argent par tranche de 100 PX` que coûte l'achat du Talent.

**Test :** Difficile (−20) avec la Caractéristique ou Compétence la plus pertinente (selon MJ).

- Succès → Talent appris.
- Échec → peut réessayer à une future Activité ; gagne **+10 par tentative ratée**.

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 23` (l.5, l.59-250) → `FavorLevel`, `ReverseButton`, `Duration`, `favorLevelSchema`, `resetInterruptedFavorProgress`, `tokenReverseAvailable`, `useTestJetProps`, `useDefenseJetProps`, `FavorRow`, `InterludeHeroState`, +44 — `src/data/activities.json`, `src/data/gods.json`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs-scenes/effets.ts`, `src/engine/activities.ts`, `src/engine/duration.ts`, +20 fichiers

---

### Artisanat

**Source :** LDB 23 l.75-103.

Créer de l'équipement du Guide de l'équipement (LDB 11) si le Personnage possède la Compétence Métier appropriée, avec outils et atelier adéquats.

**Matériaux :** coûtent **un quart du prix** de l'équipement (à acheter avant l'Activité — LDB 23 l.76).

**Test étendu de Métier** — Difficulté selon Disponibilité :

| Disponibilité | Difficulté |
|---------------|------------|
| Commune | Accessible (+20) |
| Limitée | Intermédiaire (+0) |
| Rare | Complexe (−10) |
| Exotique | Très difficile (−30) |

**DR requis** selon prix courant :

| Prix courant | DR |
|--------------|----|
| Bronze | 5 |
| Argent | 10 |
| Or | 15+ |

**Modificateurs de DR :**
- Chaque **Défaut** diminue de moitié le nombre de DR requis.
- Chaque **Atout** ajoute +5 (ajouté **après** avoir appliqué les Défauts).

Chaque Activité *Artisanat* = un lancer de Test étendu. Le travail inachevé se conserve.

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 23` (l.75-103) → `craft`, `learn`, `entrainement`, `interlude-elf-duty`, `dressage`, `Combatant` — `src/data/activities.json`, `src/data/reglesOptionnelles.json`, `src/engine/types.ts`

---

### Changement de Carrière

**Source :** LDB 23 l.105-108.

Avec accord du MJ :
- Carrière actuelle **achevée** → changement gratuit vers tout Niveau compatible.
- Carrière **non achevée** → coûte **100 PX**.

Le temps illustre présentations, pots-de-vin, licences, etc.

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 23` (l.105-108) → `craft`, `learn`, `entrainement`, `interlude-elf-duty`, `dressage`, `Combatant` — `src/data/activities.json`, `src/data/reglesOptionnelles.json`, `src/engine/types.ts`

---

### Consulter Un Expert

**Source :** LDB 23 l.111-126.

En deux étapes :

1. **Localiser l'expert :** Test **Ragot Intermédiaire (+0)** (Difficulté selon taille de la ville). Succès = expert qualifié trouvé. Échec = charlatan local.
2. **Consulter :** le convvaincre peut demander un Test **Charme**, un don au Temple de Verena, ou une Faveur (Mineure à Importante selon la difficulté du sujet).

Sur succès d'une consultation de savoir : gagne une **Relance Experte** (utilisable uniquement pour un Test lié à ce savoir, avant la fin de la prochaine aventure).

Une relation établie avec un expert = consultable gratuitement (sans Activité) lors des futurs interludes.

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 23` (l.111-126) → `creatureToCombatant`, `entrainement`, `statblockToCombatant`, `dressage`, `Combatant` — `src/data/activities.json`, `src/engine/types.ts`, `src/state/spawn.ts`

---

### Dressage

**Source :** LDB 23 l.129-130.

Test **Dressage Accessible (+20)**. Succès → ajouter 1 Compétence à un animal, choisie parmi les Traits **Dressé** (LDB 85 p.339).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 23` (l.129-130) → `FavorLevel`, `InterludeHeroState`, `creatureToCombatant`, `entrainement`, `statblockToCombatant`, `grantFavorSchema`, `GameState`, `fr`, `dressage`, `EFFECT_HANDLERS` — `src/data/activities.json`, `src/data/schemas/defs-scenes/effets.ts`, `src/engine/favor.ts`, `src/i18n/messages/fr.ts`, `src/state/combatEffects.ts`, `src/state/favorFlow.ts`, +3 fichiers

---

### Entraînement

**Source :** LDB 23 l.133-153.

S'entraîner dans une Compétence ou Caractéristique **en dehors de la Carrière**, avec tuteur.

**Coûts :**
- Compétences de Base + Caractéristiques : PX + **1D10 sous de cuivre** (où PX = coût en PX de l'Augmentation).
- Compétences Avancées : **double** du montant ci-dessus.

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 23` (l.133-153) → `FavorLevel`, `favorLevelSchema`, `resetInterruptedFavorProgress`, `FavorRow`, `InterludeHeroState`, `revenus`, `creatureToCombatant`, `entrainement`, `statblockToCombatant`, `grantFavorSchema`, +7 — `src/data/activities.json`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs-scenes/effets.ts`, `src/engine/favor.ts`, `src/i18n/messages/fr.ts`, `src/state/combatEffects.ts`, +6 fichiers

---

### Faites-moi une Faveur !

**Source :** LDB 23 l.140-151.

Système transversal aux Activités : une **Faveur** est un engagement futur accepté en échange d'une aide immédiate. Briser une Faveur : réputation ternie, Niveau réduit de 1 (minimum 0) si la rumeur se répand.

**Niveaux de Faveur :**

| Niveau | Description | Résolution |
|--------|-------------|------------|
| **Mineure** | Mission simple, quelques heures | 1 Activité |
| **Majeure** | Entreprise longue et risquée, plusieurs semaines, peut impliquer un voyage | 2+ Activités consécutives |
| **Importante** | Risque mortel, mois de voyage, violence extrême probable | Joué comme aventure complète (pas via Activités) |

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 23` (l.140-151) → `FavorLevel`, `favorLevelSchema`, `resetInterruptedFavorProgress`, `FavorRow`, `InterludeHeroState`, `creatureToCombatant`, `entrainement`, `statblockToCombatant`, `grantFavorSchema`, `ActivityList`, +6 — `src/data/activities.json`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs-scenes/effets.ts`, `src/engine/favor.ts`, `src/i18n/messages/fr.ts`, `src/state/combatEffects.ts`, +6 fichiers

---

### Invention !

**Source :** LDB 23 l.154-162.

En deux étapes :

**1. Planifier :** décider quels équipements combiner. Test **Métier (Ingénieur)** — Difficulté selon l'extravagance (MJ). Succès → DR obtenus = bonus DR à la phase Construction.

**2. Construire :** via *Artisanat* ou *Passer commande*.
- *Artisanat* : Test Très difficile (−30) ; matériaux = 2× le prix courant des équipements à combiner ; Disponibilité = celle de l'équipement le plus limité.
- *Passer commande* : trouver d'abord un expert (*Consulter un expert*) ; coût = 6× le prix courant des équipements à combiner.

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 23` (l.154-162) → `FavorLevel`, `favorLevelSchema`, `resetInterruptedFavorProgress`, `InterludeHeroState`, `BankDeposit`, `revenus`, `entrainement`, `grantFavorSchema`, `ActivityList`, `GameState`, +5 — `src/data/activities.json`, `src/data/schemas/defs-scenes/effets.ts`, `src/engine/favor.ts`, `src/i18n/messages/fr.ts`, `src/state/combatEffects.ts`, `src/state/favorFlow.ts`, +3 fichiers

---

### Opérations Bancaires

**Source :** LDB 23 l.165-176.

Permettent de **sauver des fonds** pour la prochaine aventure (sinon perdus selon *Argent à gaspiller*). Deux options :

**Investir (Statuts Or et Argent uniquement) :**
- Choisir un *Indice* d'intérêts entre 1 et 10 (ou lancer 1d10). C'est à la fois le taux d'intérêts (%) et le risque de faillite.
- Retrait → autre Activité *Opérations bancaires* → lancer 1d100 : si résultat ≤ Indice → **faillite, argent perdu** ; sinon → fonds + intérêts.

**Planque (tous Personnages) :**
- Cacher sur soi, dans un matelas ou enterré.
- Pas d'intérêts.
- Retrait avant aventure : sans Activité.
- Lancer 1d100 : si résultat ≤ 10 → **planque découverte, argent perdu** ; sinon → somme intacte.

> *Exemple verbatim* — « Gerhard décide de placer son argent dans la prestigieuse banque privée Bent, Crooke & Scarper. Le MJ lance 1d10 avec un résultat de 6. Gerhard gagnera 6 % d'intérêts sur son placement (12 pistoles d'argent), et la banque fera faillite s'il fait 6 ou moins en lançant le d100 quand il tentera d'effectuer un retrait. »

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 23` (l.165-176) → `BankDeposit`, `revenus` — `src/data/activities.json`, `src/state/interludeFlow.ts`

---

### Passer Commande

**Source :** LDB 23 l.179-184.

Acquérir des objets de rareté **Exotique** (ou très spécialisés, jamais en stock). Nécessite connaître un fournisseur — sinon, faire d'abord *Consulter un expert*.

**Coût :** prix de l'objet à la commande.

**Délai :** l'objet est livré **après la prochaine aventure** (= au début de l'interlude suivant, LDB 23 l.182).

Un seul objet Exotique par Activité *Passer commande*.

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 23` (l.179-184) → `BankDeposit`, `revenus`, `dernieres-nouvelles`, `entrainement-au-combat`, `observer-une-cible` — `src/data/activities.json`, `src/state/interludeFlow.ts`

---

### Revenus

**Source :** LDB 23 l.187-193 + LDB 08 l.106-122 (table Gagner de l'argent grâce au Statut).

Gagner de l'argent entre aventures selon le Statut. Le Personnage décrit brièvement son activité (chasse les primes, patrouille, touche une rente…).

Les Revenus ne sont crédités **qu'après** le gaspillage (LDB 23 l.191). Certains événements du Tableau peuvent directement modifier les Revenus (+/−%).

**Revenus par Statut** (LDB 08 l.110-122) :

| Échelon social | Revenu par Standing |
|----------------|---------------------|
| Bronze | 2d10 sous de cuivre |
| Argent | 1d10 pistoles d'argent |
| Or | 1 couronne d'or |

Test de Compétence de Carrière :
- **Succès** → revenu plein.
- **Échec** → moitié de la somme.
- **Échec Stupéfiant (−6)** → rien.

Les Personnages aux Niveaux 3-4 qui entreprennent *Revenus* **maintiennent automatiquement leur Statut** (voir *Avec le pouvoir*).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 8` (l.106-122) → `statusOf`, `incomeSkillOf`, `social-begging-bonus`, `social-charm-intra-tier`, `statusIncomeMax`, `RevenusPane`, `openCatalogActivity`, `runActivityResolver`, `statut`, `statusIncome` — `src/data/regles.json`, `src/data/reglesOptionnelles.json`, `src/engine/activities.ts`, `src/engine/social.ts`, `src/state/interludeFlow.ts`, `src/ui/InterludeScreen.tsx`
- `LDB 23` (l.187-193) → `revenus`, `ActivityDef`, `everBelongedClasses`, `openCatalogActivity`, `Combatant`, `dernieres-nouvelles`, `entrainement-au-combat`, `observer-une-cible` — `src/data/activities.json`, `src/engine/activities.ts`, `src/engine/types.ts`, `src/state/interludeFlow.ts`

---

## Activités de Classe (LDB 23)

**Source :** LDB 23 l.196-250.

Hors Classe spécifiée : Difficulté +1 Niveau (Difficile au lieu de Complexe, etc. — LDB 23 l.197).

---

### Dernières Nouvelles (Itinérants, Riverains)

**Source :** LDB 23 l.200-203 + l.197-198 (le texte est split dans le source OCR).

Apprendre des rumeurs de loin. Test **Ragot Intermédiaire (+0)**.

- Succès → 1 rumeur (chaque DR = 1 rumeur supplémentaire, possiblement liée à la prochaine aventure).
- Échec Impressionnant → rumeur fausse crue vraie (MJ peut lancer en secret).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 23` (l.196-250) → `ReverseButton`, `Duration`, `tokenReverseAvailable`, `useTestJetProps`, `useDefenseJetProps`, `InterludeHeroState`, `purgeAdventureEffects`, `useAttackJetProps`, `startInterlude`, `revenus`, +20 — `src/data/activities.json`, `src/data/gods.json`, `src/engine/activities.ts`, `src/engine/duration.ts`, `src/engine/ops.ts`, `src/engine/reverseToken.ts`, +9 fichiers

---

### Entraînement au Combat (Guerriers, Itinérants)

**Source :** LDB 23 l.206-209.

S'entraîner avec les armes connues. Test **Compétence (Corps à corps ou Projectiles) Intermédiaire (+0)**.

- Succès → peut **inverser** un Test de la Compétence associée **une fois** pendant la prochaine aventure.

Peut être entrepris plusieurs fois (une inversion par Activité réussie).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 23` (l.206-209) → `ReverseButton`, `Duration`, `tokenReverseAvailable`, `useTestJetProps`, `useDefenseJetProps`, `purgeAdventureEffects`, `useAttackJetProps`, `startInterlude`, `RollFlowSpec`, `PendingActivityFields`, +15 — `src/data/activities.json`, `src/engine/activities.ts`, `src/engine/duration.ts`, `src/engine/ops.ts`, `src/engine/reverseToken.ts`, `src/engine/types.ts`, +8 fichiers

---

### Observer Une Cible (Roublards)

**Source :** LDB 23 l.211-221.

Surveiller une cible (marchand, temple, personnalité) pour bénéficier d'un avantage lors d'une future action criminelle ou d'escroquerie.

Test **Perception Intermédiaire (+0)** (Difficulté modifiée selon la cible).

- Succès → peut **inverser** un Test concernant la cible **une fois** pendant la prochaine aventure.
- DR supplémentaires → informations (ou désinformations !) sur la cible.

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 23` (l.211-221) → `ReverseButton`, `Duration`, `tokenReverseAvailable`, `useTestJetProps`, `useDefenseJetProps`, `purgeAdventureEffects`, `useAttackJetProps`, `startInterlude`, `RollFlowSpec`, `PendingActivityFields`, +14 — `src/data/activities.json`, `src/engine/activities.ts`, `src/engine/duration.ts`, `src/engine/ops.ts`, `src/engine/reverseToken.ts`, `src/engine/types.ts`, +8 fichiers

---

### Recherche de Savoir (Lettrés)

**Source :** LDB 23 l.222-227.

Étendre ses connaissances sur un sujet spécifique (bataille, événement, individu…). Requiert accès à une bibliothèque, des archives de forteresse naine, des registres de Guilde ou un Temple de Verena.

Test **Savoir Accessible (+20)** (spécialisation appropriée). Sans la bonne spécialisation (mais Lettré) : Test **Intelligence Complexe (−10)**.

- Succès → connaissance intéressante, utile ou cachée (chaque DR = une tranche supplémentaire).
- Échec Impressionnant → fausse information crue vraie (MJ peut lancer en secret).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 23` (l.222-227) → `Duration`, `tokenReverseAvailable`, `useTestJetProps`, `useDefenseJetProps`, `InterludeHeroState`, `purgeAdventureEffects`, `RollFlowSpec`, `PendingActivityFields`, `heroStatus`, `statusIncomeMax`, +12 — `src/data/activities.json`, `src/engine/activities.ts`, `src/engine/duration.ts`, `src/engine/ops.ts`, `src/engine/reverseToken.ts`, `src/engine/types.ts`, +6 fichiers

---

### Réputation (Citadins, Courtisans, Lettrés)

**Source :** LDB 23 l.229-234.

Dépenser de l'argent pour augmenter son Standing de +1 pour la prochaine aventure (bonus temporaire).

**Coût :** maximum des revenus standards (= revenus max par Statut × Standing). Test **Compétence de Carrière Intermédiaire (+0)**.

- Succès → Standing +1.
- Succès Stupéfiant (+6) → Standing +2.
- Échec → argent perdu (aucun effet).
- Échec Stupéfiant (−6) → Standing −1 pour la prochaine aventure entière.

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 23` (l.229-234) → `Duration`, `InterludeHeroState`, `purgeAdventureEffects`, `PendingActivityFields`, `heroStatus`, `ActivityDef`, `statusIncomeMax`, `GameOp`, `openCatalogActivity`, `ActiveEffect`, +5 — `src/data/activities.json`, `src/engine/activities.ts`, `src/engine/duration.ts`, `src/engine/ops.ts`, `src/engine/types.ts`, `src/state/interludeFlow.ts`, +1 fichiers

---

### Semer la Dissension (Citadins, Ruraux)

**Source :** LDB 23 l.237-249.

Créer des troubles sociaux contre un individu, groupe ou institution. Requiert **deux Activités** (compte aussi comme *Revenus* pour les Agitateurs).

**Étape 1 :** Test **Ragot Accessible (+20)** → identifier les personnes influentes.

**Étape 2 :** Test **Charme** — Difficulté selon la cible :
- Noble oppresseur : Facile (+40).
- Hospice de Shallya : Difficile (−20).

Échec à l'une des étapes → Activité échouée.

**Succès :** pendant la prochaine aventure, peut tenter un Test **Charme** pour ameuter une foule contre la même cible (Difficulté MJ).

- 1 succès → foule qui accoste, crie, lance des légumes.
- Succès Impressionnant/Stupéfiant → lynchage ou incendie possible.
- Échec → pas de révolte ; Échec de plusieurs DR → la cible apprend vos actions.

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 23` (l.237-249) → `Duration`, `InterludeHeroState`, `purgeAdventureEffects`, `handrich`, `PendingActivityFields`, `heroStatus`, `ActivityDef`, `statusIncomeMax`, `GameOp`, `openCatalogActivity`, +6 — `src/data/activities.json`, `src/data/gods.json`, `src/engine/activities.ts`, `src/engine/duration.ts`, `src/engine/ops.ts`, `src/engine/types.ts`, +2 fichiers

---

## Activités de Guerrier — AA Annexe II

**Source :** AA 12 l.5-144 (Annexe II — Activités de Guerrier).

> « N'importe quel Personnage peut tenter ces Activités, mais s'il n'a jamais appartenu à la Classe des
> Guerriers, la Difficulté de tous les Tests qu'il effectue monte d'un Niveau. »

| Activité | Test | Bénéfice (prochaine aventure) |
|----------|------|-------------------------------|
| **Tir Parfait de Fanmaris** | Projectiles (Arc) Complexe (−10) | 1×/aventure : après 1 Round de visée, déclarer Tir Parfait — effets cumulatifs par DR (choix localisation / Perforante / Critique auto / Dévastatrice) |
| **Défense de Leitdorf** | Corps à Corps Complexe (−10) | 1×/aventure : attaque opposée −10 où l'adversaire ne peut ni utiliser ses Talents ni ajouter ses Augmentations ; succès = attaquant subit 1d10 Dégâts ignorant armure ; échec adverse = Coup Critique sur l'attaquant |
| **Méthode Alcatani** *(requiert Coude-à-coude ×2)* | Commandement Complexe (−10) | +1 rang Coude-à-coude à jusqu'à DR Personnages pour la durée de l'aventure |
| **Fabuleuse Vente des Aventures du Comte de Punchausen** | Charme Complexe (−10) **ou** Divertissement (Narration) Intermédiaire (+0) | Reçoit 2d10 pistoles + 1× inversion Test Charme/Narration dans l'aventure |
| **Remaniement du Contremaître** | Ragot (+0) pour localiser, puis Corps à Corps **ou** Projectiles Complexe (−10) | Reçoit l'objet désiré + Critique sur localisation aléatoire (gravité variable selon résultat) |

**Implémente :** _(généré — `npm run raw:implemente`)_
- `AA 12` (l.5-144) → `skillRefSchema`, `ActivitySkill`, `artilleur`, `changeCareer`, `PendingActivityFields`, `battement`, `ActivityDef`, `team-command`, `everBelongedClasses`, `bestActivitySkill`, +16 — `src/data/activities.json`, `src/data/combat-stakes.json`, `src/data/index.ts`, `src/data/schemas/defs/activities.ts`, `src/data/tables.json`, `src/data/talents.json`, +4 fichiers

---

## Activités de Bataille — ADE II 8

**Source :** ADE II 08 l.89-131.

> « Cette section comprend des Activités supplémentaires auxquelles peuvent s'adonner les Personnages
> *Entre deux aventures*. Le MJ décide du temps que les Personnages ont à leur disposition et, comme à
> l'accoutumée, ils ne peuvent participer qu'à un maximum de trois Activités. »

Contexte : préparation d'une bataille (siège, campagne militaire). Les Activités ratées **ne peuvent être réessayées** sans une approche différente.

| Activité | Test | Effet |
|----------|------|-------|
| **Discours Inspirant** | Commandement — Difficulté selon écart de Puissance (arrondi dizaine) | Succès → armée +10 au Test de Puissance du 1er Round |
| **Infiltration** *(requiert Planification réussie)* | Discrétion + Perception combiné, **ou** Interprétation + Perception combiné | Succès → +20 à Planification. Échec → doit fuir le camp ennemi |
| **Planification** | Savoir (Guerre) — Difficulté selon écart de Puissance + champ de bataille + plan | Succès → armée +10 à tous les Tests de Puissance. Succès Stupéfiant (+6) → +20 |
| **Rassembler des Forces** | Variable selon la méthode (Commandement, Charme, Intimidation…) | Succès → Puissance +5. Succès Stupéfiant (+6) → +10. Échec Stupéfiant (−6) → −10 |
| **Repérage** | Chevaucher + Perception Intermédiaire (+0) combiné | Succès → effectifs/distance/troupes adverses + +10 à Planification. Échec → fausses infos ou retard |
| **Sabotage** *(requiert Repérage réussi)* | Discrétion **ou** Interprétation — peut s'intégrer à Infiltration | Succès → ennemi −5 Puissance. Succès Stupéfiant (+6) → −10. Échec → combat/fuite |
| **Autres Préparations** | À définir (Compétence + Difficulté + récompense + pénalité sur Échec Stupéfiant) | Variable |

**Option coût de la guerre** : entretien = Σ Statuts des soldats/jour (réduction 50 % → −10 à tous les Tests de Puissance ; aucun entretien → armée se disperse en 2 jours).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `ADE II 8` (l.89-131) → `scene`, `MassBattleView`, `ActivityContext`, `RESOLVER_OWNER`, `doc`, `inspire`, `planification`, `infiltration`, `rassembler-des-forces`, `reperage`, +2 — `src/data/activities.json`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs/activities.ts`, `src/engine/activities.ts`, `src/scenes/test-scenarios/13-bataille-de-masse.ts`, `src/state/combatFlow.ts`, +1 fichiers

---

## Activités de Voyage — EDOC 5

**Source :** EDOC 8 l.129-180.

> « En parcourant les routes de l'Empire, les Personnages se retrouveront avec une quantité surprenante
> de temps libre. […] chaque Personnage bénéficie d'une Activité par Étape de son voyage. »

Les Activités de voyage durent toute une Étape de voyage et restent **fatigantes** : un Test raté → État *Exténué*.

À la discrétion du MJ, les Activités LDB 6 peuvent s'effectuer en voyage (EDOC 8 l.135).

| Activité | Test | Effet |
|----------|------|-------|
| **Plein Air** | Survie en extérieur Intermédiaire (+0), −10/degré de météo défavorable | Succès → le groupe n'a pas à tester l'Exposition due à la météo pendant cette Étape |
| **Approvisionnement** | Survie en extérieur (voir LDB 9 l.558-565) | Se réapprovisionner en nourriture/eau |
| **Recueillir des Informations** | Ragot Intermédiaire (+0) | DR questions auxquelles le MJ répond sincèrement selon les habitants |
| **Rester aux Aguets** | Perception Intermédiaire (+0) | Succès → groupe non surpris pendant cette Étape |
| **Établir des Cartes** | Test étendu : Métier (Cartographe) **ou** Art (Dessin) — DR requis = 2 × nombre d'Étapes | Carte terminée → Savoir/Orientation lors d'un voyage futur Accessible (+20) au lieu de (+0) |
| **Pratiquer Une Compétence** | Compétence praticable en voyage — Intermédiaire (+0) | Succès → peut inverser 1 Test de cette Compétence pendant l'aventure suivante ou une étape ultérieure |
| **Récupérer** | — (automatique si aucun État *Exténué* pendant l'Étape) | Cette Étape compte comme « repos » pour la guérison des Blessures |
| **Monter Un Camp** | Survie en extérieur **ou** Guérison Intermédiaire (+0) | Chaque DR retire 1 État *Exténué* d'un Personnage ou le guérit |

Note sur les Revenus en voyage : l'Activité *Revenus* (LDB 23) n'est **pas adaptée** pour la plupart des Carrières en voyage — sauf juges/huissiers itinérants, chasseurs, éclaireurs, cochers (EDOC 8 l.167).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 9` (l.558-565) → `shelter`, `ForageMethod`, `forageYield`, `survie-en-exterieur`, `voile` — `src/data/night-stakes.json`, `src/data/skills.json`, `src/engine/travelStages.ts`
- `EDOC 8` (l.129-180) → `plein-air`, `printemps`, `approvisionnement`, `doc`, `gatherInnInfo`, `ete`, `recueillir-informations`, `EncounterCategory`, `rester-aux-aguets`, `automne`, +28 — `src/data/activities.json`, `src/data/maladies.json`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs/maladies.ts`, `src/data/weather.json`, `src/engine/activities.ts`, +9 fichiers

---

## Nouvelle Activité : Convalescence — ADE II Annexe I

**Source :** ADE II 09 l.32-33.

Requiert accès à un lieu de repos (hospice, monastère, temple). Contexte : surmonter un Trauma Psychologique.

**Test :** Calme Très Difficile (−30) (Difficulté réductible selon qualité des soins).

- Succès → éliminer **un Trait Psychologique** de son choix.
- Échec → se sent mieux quand même ; peut **inverser** un Test de **Calme** pour résister aux effets du Trait lors de la prochaine aventure.

**Implémente :** _(généré — `npm run raw:implemente`)_
- `ADE II 9` (l.32-33) → `convalescence`, `psych-acquisition-optional` — `src/data/activities.json`, `src/data/reglesOptionnelles.json`

---

## Règles optionnelles connexes

| Règle | Source | Flag / Note |
|-------|--------|-------------|
| Tout le chapitre est optionnel | LDB 22 l.4 | flag `interlude-enabled` (`policy.ts`) |
| Prestige Elfique / Devoir elfique | LDB 23 l.54-56 | flag `interlude-elf-duty` (`policy.ts`) |
| Revenus : restriction Investir aux Statuts Or/Argent | LDB 23 l.168 | Non vérifiée côté code (arbitrage jeu-sans-MJ) |
| Activités LDB 6 pendant un voyage | EDOC 5 l.101 | À discrétion du MJ |

---

## Voir aussi

- [`economie.md`](economie.md) — monnaie, Statut, revenus standards (LDB 08).
- [`avancement.md`](avancement.md) — coûts PX, Évolution de Carrière, Niveaux.
- [`maladies.md`](maladies.md) — Flux Sanglant (événement 53-56).
- [`destin.md`](destin.md) — Points de Chance, Points de Destin.
- [`psychologie.md`](psychologie.md) — Traits Psychologiques, Trauma (lien Convalescence).
- [`deplacement.md`](deplacement.md) — Étapes de voyage (Activités EDOC).

---

---

<!-- MDG-INTEGRATION -->

## Activités en mer — MDG 15

**Source :** MDG 15 l.17, MDG 15 l.266-272.

Cadre spécifique aux **longs voyages maritimes** : les Activités s'intercalent dans la boucle de voyage (vitesse du navire, Humeur de Manann, événements de bord tous les 1d10 jours) au rythme d'**une Activité par semaine complète passée à bord**.

> « Pour chaque semaine complète de voyage, une Activité à bord peut être entreprise. » — `MDG 15 l.17`

Le détail : chaque Personnage dispose d'**une Activité par semaine de 8 jours** de voyage. Ces Activités, parce qu'elles se déroulent en mer, **échappent aux règles d'interlude habituelles** *Argent à gaspiller*, *Avec le pouvoir*… et *Amélioration elfique*.

> « Pour chaque semaine (8 jours) de voyage en mer, chaque Personnage a l'occasion d'effectuer une Activité. Comme elles ont lieu sur les flots, ces Activités ne sont pas soumises aux règles *Argent à gaspiller*, *Avec le pouvoir*… et *Amélioration elfique* (voir page de **WFJDR**, page 195). » — `MDG 15 l.268`

**Activités LDB/AA réalisables à bord** (sous réserve d'installations et d'instructeurs adaptés) : *Apprentissage particulier, Artisanat, Entraînement, Entraînement au combat, Invention !, Recherche de savoir, Semer la dissension*, plus toutes les Activités d'entraînement du supplément *Aux Armes !*.

> « Les Activités suivantes peuvent être entreprises, à condition que des installations et des instructeurs adaptés soient disponibles : *Apprentissage particulier, Artisanat, Entraînement, Entraînement au combat, Invention !, Recherche de savoir, Semer la dissension* et toutes les Activités impliquant un entraînement du supplément **Aux Armes !**. » — `MDG 15 l.270`

**Cas particulier — *Semer la dissension* à bord** : une Activité *Semer la dissension* réussie et **dirigée contre les officiers du navire** coûte **2d10 de Moral** à l'équipage.

> « Une Activité *Semer la dissension* réussie cause une perte de 2d10 de Moral si elle est dirigée contre les officiers du navire. » — `MDG 15 l.272`

À ces Activités importées s'ajoutent **quatre Activités propres à la mer** (ci-dessous) : *Commerce d'opportunité*, *Cartographie*, *Entraînement d'équipage* et *Entretien du navire*.

**Voir aussi** : [Activités Répandues (LDB 23)](#activités-répandues-ldb-23) (Apprentissage particulier, Artisanat, Entraînement, Invention !), [Activités de Classe (LDB 23)](#activités-de-classe-ldb-23) (Recherche de savoir, Semer la dissension, Entraînement au combat), [Activités de Guerrier — AA Annexe II](#activités-de-guerrier--aa-annexe-ii), [Commerce d'opportunité (en mer)](#commerce-dopportunité-en-mer), [Cartographie (Activité en mer)](#cartographie-activité-en-mer), [Entraînement d'équipage](#entraînement-déquipage), [Entretien du navire](#entretien-du-navire).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `MDG 15` (l.17, l.266-272) → `SeaActivitiesModal`, `WorldMapView`, `SeaVoyageState`, `SEA_WEEK_DAYS`, `startTravel`, `sea-embrigadement-ragot`, `sea-embrigadement-discretion`, `sea-cargo`, `cruiseM`, `activites-en-mer`, +25 — `src/data/regles.json`, `src/data/sea-cargo.json`, `src/data/sea-events.json`, `src/data/voyage-stakes.json`, `src/state/pendings.ts`, `src/state/seaActivities.ts`, +5 fichiers

---

## Commerce d'opportunité (en mer)

**Source :** MDG 15 l.274-286.

Activité de spéculation rapide lors d'une escale appropriée. Le Personnage **investit jusqu'à l'équivalent en couronnes d'or de la valeur d'Encombrement disponible et non surchargé** de son navire, puis résout un **Test étendu de Marchandage Complexe (−10) nécessitant 10 DR, en au maximum trois tentatives**.

> « Vous pouvez investir jusqu'à l'équivalent de la valeur totale d'Encombrement disponible et non surchargé de votre bateau en couronnes d'or. Effectuez un Test étendu de **Marchandage Complexe (–10)** nécessitant 10 DR et autorisant jusqu'à trois tentatives. » — `MDG 15 l.276`

| Résultat du Test étendu | Conséquences |
|-------------------------|--------------|
| **Échec de 6 DR** | Vous perdez toutes les couronnes d'or investies. |
| **Échec** | Vous récupérez la moitié des couronnes investies. |
| **Succès** | Vous récupérez toutes les couronnes d'or investies **+10 %**. |
| **Succès de 6 DR** | Vous récupérez toutes les couronnes d'or investies **+20 %**. |

*Exemple verbatim* : « vous disposez de 200 points d'Encombrement disponibles sur votre bateau, donc vous investissez 200 couronnes d'or, puis vous effectuez vos 3 tentatives et vous réussissez. Vous gagnez 220 couronnes d'or. » (`MDG 15 l.286`)

**Voir aussi** : [Activités en mer — MDG 15](#activités-en-mer--mdg-15), [`economie.md`](economie.md) (Marchandage, couronnes d'or, Encombrement).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `MDG 15` (l.274-286) → `SeaActivitiesModal`, `BankDeposit`, `doc`, `SEA_WEEK_DAYS`, `sea-embrigadement-ragot`, `sea-embrigadement-discretion`, `sea-cargo`, `sellRefusal`, `buildPostProgressionSteps`, `bankWithdrawOutcome`, +26 — `src/data/regles.json`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs/trappings.ts`, `src/data/sea-cargo.json`, `src/data/sea-events.json`, `src/data/voyage-stakes.json`, +9 fichiers

---

## Cartographie (Activité en mer)

**Source :** MDG 15 l.288-292.

Dessiner une carte revendable et utile à l'orientation. **Test de Métier (Cartographe) Complexe (−10)** en désignant **deux ports**. En cas de succès, la carte vaut en CO le **nombre de DR obtenus** et accorde **+2 DR aux Tests d'Orientation** lorsqu'on voyage entre les deux ports désignés.

> « Effectuez un Test de **Métier (Cartographe) Complexe (–10)** et désignez deux ports. En cas de succès, vous produisez une carte ayant une valeur en CO égale au nombre de DR obtenus sur le Test. Quand vous voyagez entre les deux ports désignés, la carte fournit +2 DR sur les Tests d'Orientation. » — `MDG 15 l.290`

**Option Planque** : pendant la confection de la carte, on peut tenter **gratuitement** l'Activité *Opérations bancaires : Planque* pour cacher un butin à un endroit indiqué sur la carte. Le trésor est sûr tant qu'on conserve la carte, mais si elle tombe en de mauvaises mains, le butin est **découvert sur un 50 ou moins** (au lieu du 10 ou moins habituel) au lancer d'1d100.

> « si quelqu'un met la main dessus, il est découvert sur un 50 ou moins plutôt que le 10 ou moins habituel sur le lancer d'1d100. » — `MDG 15 l.292`

**Voir aussi** : [Activités en mer — MDG 15](#activités-en-mer--mdg-15), [Opérations Bancaires](#opérations-bancaires) (Planque, découverte sur 10 ou moins), [Activités de Voyage — EDOC 5](#activités-de-voyage--edoc-5) (Établir des Cartes — équivalent terrestre).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `MDG 15` (l.288-292) → `SeaActivitiesModal`, `BankDeposit`, `doc`, `sea-cargo`, `sellRefusal`, `buildPostProgressionSteps`, `bankWithdrawOutcome`, `activites-en-mer`, `PendingExtendedTest`, `bankWithdrawInner`, +4 — `src/data/regles.json`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs/trappings.ts`, `src/data/sea-cargo.json`, `src/engine/activities.ts`, `src/i18n/messages/fr.ts`, +7 fichiers

---

## Entraînement d'équipage

**Source :** MDG 15 l.294-300.

Former l'équipage (PNJ) dans une **Compétence utile à la gestion du bateau**. **Test de Commandement Difficile (−20)** suivi d'un **Test Difficile (−20) dans la Compétence à enseigner**. En cas de succès, le score de l'équipage dans cette Compétence augmente du **nombre de DR obtenus au Test de Commandement** ; coût : **2 pistoles d'argent par membre entraîné** (frais et grog). Le score enseigné **ne peut dépasser les propres Augmentations** de l'instructeur, et **seuls les PNJ** profitent de l'Activité.

> « Effectuez un Test de **Commandement Difficile (–20)** suivi d'un Test **Difficile (–20)** dans la Compétence à entraîner. En cas de succès, augmentez le score de l'équipage dans la Compétence que vous lui avez apprise d'un nombre égal au nombre de DR obtenus sur le Test de Commandement et dépensez 2 pistoles d'argent en frais et en grog de félicitations par membre de l'équipage entraîné. » — `MDG 15 l.296`

> « Vous ne pouvez pas augmenter un score de Compétence au-delà de vos propres Augmentations dans cette Compétence. Seuls les PNJ peuvent gagner des Augmentations grâce à cette Activité. » — `MDG 15 l.296`

*Exemple verbatim* : « un Personnage possédant 9 Augmentations dans Projectiles (Poudre noire) pourrait servir d'instructeur à un équipage de 30 personnes. Il obtient 5 DR sur son Test de Commandement et réussit son Test de Projectiles (Poudre noire), ce qui fait grimper la Compétence Projectiles (Poudre noire) de l'équipage de 5 Augmentations et lui fait payer 60 pistoles d'argent. » (`MDG 15 l.298`)

**Voir aussi** : [Activités en mer — MDG 15](#activités-en-mer--mdg-15), [Entraînement](#entraînement) (Activité d'Augmentation LDB 23).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `MDG 15` (l.294-300) → `SeaActivitiesModal`, `BankDeposit`, `doc`, `commerce`, `minimum-vital`, `sea-cargo`, `port-buy-bargain`, `sellRefusal`, `buildPostProgressionSteps`, `bankWithdrawOutcome`, +7 — `src/data/combat-stakes.json`, `src/data/regles.json`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs/sea-cargo.ts`, `src/data/schemas/defs/trappings.ts`, `src/data/sea-cargo.json`, +9 fichiers

---

## Entretien du navire

**Source :** MDG 15 l.302-306.

Réparer l'usure du vaisseau (planches pourries, voiles, coque incrustée). **De préférence au port** ; en mer, **pénalité supplémentaire de −20** ; un port doté de vastes installations de construction navale donne **+20**.

**Usure générale** — **Test de Métier (Charpentier *ou* Constructeur de navires) Intermédiaire (+0)**. Succès → dépenser un Encombrement de **pièces détachées de navire égal à la Taille du navire** et retirer les effets de l'événement de bord *Usure*.

> « effectuez un Test de **Métier (Charpentier** *ou* **Constructeur de navires) Intermédiaire (+0)**. En cas de succès, vous dépensez un nombre de points d'Encombrement de pièces détachées de navire égal à la Taille de votre navire et vous retirez les effets de l'événement de bord Usure. » — `MDG 15 l.304`

**Réparer les Blessures du navire** : **2 points d'Encombrement de pièces détachées par tranche de 5 Blessures** restaurées.

> « vous pouvez les réparer pour un coût de 2 points d'Encombrement de pièces détachées de navire par tranche de 5 Blessures restaurées. » — `MDG 15 l.306`

**Réparer une Blessure Critique** : **Test de Métier (Charpentier *ou* Constructeur de navires) Difficile (−20)**. Succès → dépenser un Encombrement de pièces détachées **et de bois égal à la Taille du navire** et retirer la Blessure Critique.

> « Si votre navire a subi des Blessures Critiques, vous pouvez les réparer en effectuant un Test de **Métier (Charpentier** *ou* **Constructeur de navires) Difficile (–20)**. » — `MDG 15 l.306`

**Voir aussi** : [Activités en mer — MDG 15](#activités-en-mer--mdg-15), [Artisanat](#artisanat) (Métier, Test étendu).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `MDG 15` (l.302-306) → `SeaActivitiesModal`, `BankDeposit`, `commerce`, `minimum-vital`, `sea-cargo`, `port-buy-bargain`, `bankWithdrawOutcome`, `activites-en-mer`, `bankWithdrawInner`, `GameState`, +2 — `src/data/combat-stakes.json`, `src/data/regles.json`, `src/data/schemas/defs/sea-cargo.ts`, `src/data/sea-cargo.json`, `src/engine/activities.ts`, `src/i18n/messages/fr.ts`, +5 fichiers

---

<!-- ACE-INTEGRATION -->

## Activités à Altdorf — ACE Annexe I

**Source :** ACE 12 l.3-7.

Annexe I de **Aldorf, la Couronne de l'Empire (ACE)** : cinq nouvelles Activités d'interlude, réservées à la capitale impériale. Gate géographique STRICT — contrairement aux Activités Répandues/de Classe (LDB 23), ces cinq-là ne sont proposables qu'au lieu Altdorf de la carte du monde.

> « Elle offre donc aux Personnages tout le loisir de s'adonner à différentes activités entre deux aventures. Dans la section suivante se trouve une liste d'Activités potentielles pour les Personnages. Elles fonctionnent avec les règles de **WFJDR**, p. 195. » — `ACE 12 l.7`

Les cinq Activités : *Pénitence*, *Entraînement avec une arme inhabituelle*, *Tester des objets magiques*, *Mécénat*, *Recherche universitaire* (détail dans les sous-sections ci-dessous).

**Voir aussi** : [Cadre général « Entre deux aventures »](#cadre-général--entre-deux-aventures-), [Activités Répandues (LDB 23)](#activités-répandues-ldb-23) (Opérations Bancaires — Mécénat en est une variante), [Pénitence (LDB 41)](religion.md#pénitence) (renvoi — pénitence MJ-arbitrée en réponse à la Colère des dieux, distincte de l'Activité *Pénitence* ci-dessous), [Colère des dieux — déclencheur Maladresse](religion.md#colère-des-dieux--déclencheur-maladresse), [Corruption & mutation](corruption.md) (Tester des objets magiques — Exposition mineure).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `ACE 12` (l.3-7) → `InterludeHeroState`, `matchOutcomes`, `combatSkillPick`, `weaponGroupSkillMode`, `itemFromTrappingById`, `penitence`, `entrainement-arme-inhabituelle`, `tester-objets-magiques`, `runActivityResolver`, `ItemInstance`, +4 — `src/data/activities.json`, `src/data/index.ts`, `src/engine/activities.ts`, `src/engine/combat.ts`, `src/engine/items.ts`, `src/engine/types.ts`, +1 fichiers

---

## Pénitence (ACE)

**Source :** ACE 12 l.9-15.

Pèlerinage à Altdorf (ou parcours des chemins saints si déjà sur place) pour se défaire de Points de Péché accumulés.

> « Après un pèlerinage adéquat, faites un Test de **Prière Accessible (+20)**. Si vous réussissez, enlevez 1 point de Péché, ou 2 sur un Succès Impressionnant (+4 DR) ou mieux. Si vous échouez ce Test, vous subissez 1 État *Exténué* le premier jour de votre prochaine aventure : vous souffrez d'une fatigue physique et spirituelle. Si vous faites une Maladresse sur le jet, réalisez un Test sur le Tableau de la Colère des Dieux (**WFJDR**, p. 218) à la place. » — `ACE 12 l.15`

- Test **Prière Accessible (+20)**.
- Succès (+4 DR ou mieux) → **−2** Points de Péché ; succès (0 à +3 DR) → **−1** Point de Péché.
- Échec → 1 État *Exténué* le premier jour de la prochaine aventure.
- Maladresse → Test sur le Tableau de la Colère des dieux **à la place** du résultat normal.

**Voir aussi** : [Points de Péché — définition et accumulation](religion.md#points-de-péché--définition-et-accumulation), [Colère des dieux — déclencheur Maladresse](religion.md#colère-des-dieux--déclencheur-maladresse), [Table d100 — Colère des dieux (verbatim)](religion.md#table-d100--colère-des-dieux-verbatim).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `ACE 12` (l.9-15) → `InterludeHeroState`, `matchOutcomes`, `combatSkillPick`, `weaponUnmastered`, `weaponGroupSkillMode`, `itemFromTrappingById`, `penitence`, `entrainement-arme-inhabituelle`, `tester-objets-magiques`, `openCatalogActivity`, +7 — `src/data/activities.json`, `src/data/index.ts`, `src/engine/activities.ts`, `src/engine/combat.ts`, `src/engine/items.ts`, `src/engine/types.ts`, +2 fichiers

---

## Entraînement avec une arme inhabituelle (ACE)

**Source :** ACE 12 l.17-21.

Maîtriser une arme trop singulière pour un usage immédiat (ex. l'arme de Harald l'Infâme) exige un entraînement dédié.

> « Après ce difficile entraînement, faites un Test de **Corps à corps** ou de **Projectiles Complexe (−10)** selon la spécialisation de l'arme que vous tentez de maîtriser. Si le Test réussit, vous avez maîtrisé l'arme. Si vous échouez, le Personnage devra attendre le prochain moment de pause après une aventure pour recommencer. » — `ACE 12 l.21`

- Test **Corps à corps** ou **Projectiles Complexe (−10)**, selon la catégorie de l'arme visée.
- Succès → arme maîtrisée (lève le prérequis `requiresMastery`).
- Échec → nouvelle tentative reportée au prochain interlude.

**Implémente :** _(généré — `npm run raw:implemente`)_
- `ACE 12` (l.17-21) → `InterludeHeroState`, `OutcomeBand`, `matchOutcomes`, `combatSkillPick`, `weaponUnmastered`, `weaponGroupSkillMode`, `itemFromTrappingById`, `penitence`, `entrainement-arme-inhabituelle`, `tester-objets-magiques`, +8 — `src/data/activities.json`, `src/data/index.ts`, `src/engine/activities.ts`, `src/engine/combat.ts`, `src/engine/items.ts`, `src/engine/types.ts`, +2 fichiers

---

## Tester des objets magiques (ACE)

**Source :** ACE 12 l.23-42.

Étudier un artefact magique dont l'activation n'est pas évidente (code secret, geste, énigme), via la Compétence Recherche — risqué en cas d'échec sévère.

> « Ce qu'ils apprennent dépend du résultat d'un Test de **Recherche Complexe (−10)**. » — `ACE 12 l.29`

Table des résultats (`ACE 12 l.31-42`) :

| DR | Résultat | Information apprise |
|---|---|---|
| +4 ou plus | Succès Impressionnant/Stupéfiant | Étude en profondeur : plein potentiel de l'objet et tous ses dangers éventuels. |
| +0 à +3 | Succès Minime à Succès | Fonction principale de l'objet et comment l'activer. |
| −0 à −3 | Échec Minime à Échec | Aucune information utile sur l'artéfact. |
| −4 ou moins | Échec Impressionnant/Stupéfiant | Rien appris, **et** Test d'Exposition mineure à la Corruption (contamination magique). |

**Voir aussi** : [Corruption & mutation](corruption.md) (Exposition mineure).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `ACE 12` (l.23-42) → `InterludeHeroState`, `BankDeposit`, `OutcomeBand`, `matchOutcomes`, `combatSkillPick`, `weaponUnmastered`, `weaponGroupSkillMode`, `itemFromTrappingById`, `penitence`, `PendingActivityFields`, +17 — `src/data/activities.json`, `src/data/index.ts`, `src/engine/activities.ts`, `src/engine/combat.ts`, `src/engine/items.ts`, `src/engine/types.ts`, +3 fichiers

---

## Mécénat (ACE)

**Source :** ACE 12 l.45-49, ACE 12 l.57-65 (table).

Variante d'Opération Bancaire (ch.23) pratiquée à Altdorf : sponsoriser un dramaturge prometteur plutôt qu'épargner.

> « Comme pour n'importe quel investissement, vous devez réaliser deux Opérations : une première quand vous donnez votre argent (au moins 5 CO) et une seconde quand vous essayez de le récupérer. Quand vous tentez de récupérer votre investissement, faites un Test d'**Évaluation Intermédiaire (+0)** pour voir si vous avez été capable de trouver un auteur de talent, et consultez le tableau ci-contre pour déterminer le résultat. » — `ACE 12 l.49`

Table des résultats (`ACE 12 l.57-65`) :

| DR | Résultat |
|---|---|
| +6 ou plus | Classique instantané ; inverse tout Test de Sociabilité (amateur de théâtre) la prochaine aventure ; investissement récupéré avec un profit de 20 %. |
| +3 à +5 | Succès modéré ; inverse un Test de Sociabilité (amateur d'art) ; investissement récupéré intégralement. |
| +0 à +2 | Trop moralisatrice mais places vendues ; inverse un Test de Sociabilité (amateur d'art) ; moitié de l'investissement récupérée. |
| −0 à −2 | Extrêmement ennuyeuse ; investissement perdu. |
| −3 à −5 | Insultante ; investissement perdu, un noble offensé jure de provoquer en duel les financeurs. |
| −6 ou moins | Désastre ; investissement perdu, attire un inspecteur fiscal ou un répurgateur (au choix). |

**Voir aussi** : [Opérations Bancaires](#opérations-bancaires) (ch.23, dépôt invest/planque).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `ACE 12` (l.45-49, l.57-65) → `BankDeposit`, `OutcomeBand`, `penitence`, `PendingActivityFields`, `ActivityDef`, `entrainement-arme-inhabituelle`, `tester-objets-magiques`, `mecenat`, `buySpell`, `recherche-universitaire`, +8 — `src/data/activities.json`, `src/engine/activities.ts`, `src/i18n/messages/fr.ts`, `src/state/interludeFlow.ts`, `src/state/partyFlow.ts`, `src/ui/InterludeScreen.tsx`

---

## Recherche universitaire (ACE)

**Source :** ACE 12 l.51-55, ACE 12 l.67.

Consultation des bibliothèques/laboratoires d'un Collège de Magie à Altdorf pour mémoriser un sort à moindre coût.

> « Une fois au Collège, réalisez un Test de **Recherche Intermédiaire (+0)**. Chaque +DR vous permet de mémoriser un sort pour 100PX de moins que son prix normal (pour un minimum de 100PX). Pour bénéficier de cette réduction, vous devez acheter le sort immédiatement. » — `ACE 12 l.55`

> « inutile pour les nouveaux sorciers qui n'ont pas encore appris un nombre de sorts égal à leur Bonus d'Intelligence, mais les sorciers plus expérimentés bénéficient grandement de ces visites, qui leur permettent de rafraîchir leurs connaissances. » — `ACE 12 l.67`

- Test **Recherche Intermédiaire (+0)**.
- Chaque +DR → −100 PX sur le prix du prochain sort mémorisé (plancher 100 PX).
- Achat du sort **immédiat**, sinon la remise est perdue.

**Implémente :** _(généré — `npm run raw:implemente`)_
- `ACE 12` (l.51-55, l.67) → `BankDeposit`, `OutcomeBand`, `penitence`, `PendingActivityFields`, `ActivityDef`, `entrainement-arme-inhabituelle`, `tester-objets-magiques`, `mecenat`, `buySpell`, `recherche-universitaire`, +8 — `src/data/activities.json`, `src/engine/activities.ts`, `src/i18n/messages/fr.ts`, `src/state/interludeFlow.ts`, `src/state/partyFlow.ts`, `src/ui/InterludeScreen.tsx`

