# Atlas RAW — Déplacement & Voyage (hors combat)

> Base de connaissance des **règles WFRP4 (RAW)**, consolidées sur les livres autorisés, à usage d'agent
> (vérifier que le code respecte le RAW). Chaque règle cite sa source `LIVRE NN l.X-Y`
> (NN = préfixe du fichier de chapitre, l = lignes du `.md` source). **Voir aussi** tisse les renvois
> entre règles ; **Implémente** pointe le(s) module(s) `src/engine/` correspondant(s).
> Conventions d'abréviation : voir [`sources.md`](../sources.md).
>
> **Périmètre de ce fichier** : Mouvement hors combat (règles générales), voyage entre lieux, montures
> et véhicules, Encombrement et fatigue de voyage, poursuites.
> Les règles de Charge, Désengagement, Fuite, Escalade, Saut et Chute *en combat* sont dans
> [`combat.md`](combat.md) §§ correspondants — ce fichier les renvoie sans les re-transcrire.
> ⚠️ Les champs **Implémente** sont GÉNÉRÉS (`npm run raw:implemente` — source éditoriale : `src/data/raw.manifest.json`) — ne pas les éditer à la main.

## Sommaire

- [Tableau des Mouvements (valeurs de base)](#tableau-des-mouvements)
- [Course hors combat (sprint)](#course-hors-combat)
- [Escalade, Saut, Chute — voir combat.md](#escalade-saut-chute)
- [Voyage à pied : vitesse, durée, marche forcée](#voyage-à-pied)
- [Transports payants : Diligence, Barge, Fiacre, Ferry](#transports-payants)
- [Montures : allures, endurance, incidents, sellerie](#montures)
- [Véhicules tirés : conduite, incidents, tableau](#véhicules)
- [Encombrement et fatigue de voyage](#encombrement-et-fatigue-de-voyage)
- [Péripéties de voyage (LdB)](#péripéties-ldb)
- [Système par Étapes (EDOC — optionnel)](#système-par-étapes-edoc--optionnel)
- [Poursuites](#poursuites)
- [Voir aussi](#voir-aussi)
- [Implémente](#implémente)

- **La Mer des Griffes (MDG)** <!-- MDG-INTEGRATION -->
- Navigation maritime — Tests de Navigation (MDG)
- Progression d'un navire (MDG)
- Forcer le rythme et épuisement (MDG)
- Manœuvres et vitesses maximum (MDG)
- Salissures de coque (MDG)
- Météo de la Mer des Griffes (MDG)
- Vents (MDG)
- Orientation et phares (MDG)
- Course-poursuite navale (MDG)
- Collisions de navires (MDG)
- Périls en mer (MDG)
- Détroits et tourbillons (MDG)
- Réparer un navire (MDG)
- Tests d'équipage (MDG)
- Moral de l'équipage (MDG)
- Maladies et provisions en mer (MDG)
- Provisions et équipement de navigation (MDG)
- Longs voyages : résolution et vitesse (MDG)
- Humeur de Manann et événements en mer (MDG)
- Activités en mer (MDG)
- Entretien du navire (Activité en mer) (MDG)
- Commerce maritime (MDG)

---

## Tableau des Mouvements

**Source :** LDB 15 l.19-31

Le Tableau des Mouvements donne la distance couverte *en mètres* pour un tour de combat selon la
caractéristique **M** (Mouvement). Pour le voyage, les valeurs de marche/course en mètres/tour
*ne sont pas directement utilisées* — seul **M exprimé en km/h** sert (voir § Voyage à pied).

| Mouvement | Marche (m/tour) | Course (m/tour) |
|:---------:|:---------:|:--------:|
| 0 | 0 | 0 |
| 1 | 2 | 4 |
| 2 | 4 | 8 |
| 3 | 6 | 12 |
| 4 | 8 | 16 |
| 5 | 10 | 20 |
| 6 | 12 | 24 |
| 7 | 14 | 28 |
| 8 | 16 | 32 |
| 9 | 18 | 36 |
| 10 | 20 | 40 |

**Grille (option)** : cases de 3 cm = 2 m en jeu. M 4 = 4 cases par tour. LDB 15 l.12.

> **Règle :** si M = 4, Marche = 4×2 = 8 m, Course = 4×4 = 16 m.
> Formule généralisée : Marche = M×2, Course = M×4.

**Voir aussi :** [`combat.md`](combat.md) § Déplacement en combat pour Charge, Mouvement du tour
et options d'Action.

---

## Course hors combat

**Source :** LDB 15 l.41 (section « Course »)

Utiliser son Action pour courir : Test **Athlétisme Accessible (+20)**.
- Distance couverte EN PLUS du Mouvement normal : **Mouvement de Course + DR** mètres.
- Exemple : M 4, DR +2 → 16 + 2 = 18 m supplémentaires.
- Exemple : M 4, DR −2 → 16 − 2 = 14 m supplémentaires.

---

## Escalade, Saut, Chute

Ces règles s'appliquent en et hors combat.
→ Voir [`combat.md`](combat.md) § Escalade, Saut et Chute (transcription complète là-bas).

---

## Voyage à pied

### Vitesse

**Source :** LDB 51 l.192-193

> « Utilisez le Déplacement pour déterminer la vitesse du voyage en kilomètre par heure. Ainsi,
> si le Déplacement le plus lent d'un groupe est de 3, il voyagerait approximativement à 3
> kilomètres par heure. »

- **Vitesse (km/h) = M du personnage le plus lent du groupe.**
- M est le **M effectif** (après pénalités d'Encombrement, voir § Encombrement).
- LDB 05 l.449 (définition du Mouvement) dit la même chose : « À plus long terme, il indique
  combien de kilomètres par heure vous pouvez aisément parcourir à pied. »

### Heures de marche par jour sans Test

**Source :** LDB 51 l.195

> « En prenant en compte les temps de repos, les arrêts nécessaires et une topographie standard,
> un groupe peut voyager l'équivalent de **6 heures par jour** sans avoir besoin de Tests de
> Résistance. »

### Marche forcée (au-delà de 6 h/j)

**Source :** LDB 51 l.195

> « S'il voyage plus rapidement ou plus loin, donnez un État *Exténué* à ceux échouant à ce Test,
> et un État *Exténué* supplémentaire si le Personnage est Encombré (voir page 293). »

- Test : **Résistance Intermédiaire (+0)**.
- Échec → +1 Exténué.
- Échec + Surchargé → +2 Exténué (1 marche forcée + 1 Encombrement).
- Plafond journalier de marche forcée : **non défini par le canon** (paramétrable en jeu : 10 h/j
  par défaut).

### Barges et courant

**Source :** LDB 51 l.197

> « La vitesse d'une barge peut augmenter ou diminuer jusqu'à 30 % si elle est en aval ou en
> amont, si vous jugez que c'est approprié. »

---

## Transports payants

### Table des Coûts de Trajet

**Source :** LDB 51 l.177-190 (verbatim)

> « Tous les coûts listés ici sont par kilomètre parcouru, et sont seulement des indications
> approximatives. Les diligences et les barges les plus rapides coûtent généralement deux fois
> plus. Les modèles plus lents coûtent deux fois moins cher. Augmentez ou diminuez le Mouvement
> de +/-1 pour des modèles plus rapides ou plus lents. »

| Transport | Déplacement (km/h) | Coût |
|---|:---:|---|
| **Diligence** | 6 | |
| — Intérieur | | –/2 par km |
| — Extérieur | | –/1 par km |
| **Barge** | 8 | |
| — Cabine | | –/5 par km |
| — Pont | | –/2 par km |
| **Fiacre** | 6 | –/3 par quartier |
| **Ferry** | 4 | –/1 par 20 mètres |

Notes d'application :
- Les prix **n'incluent pas** les repas, l'hébergement ou le fourrage. LDB 51 l.170.
- Barge de passagers haut de gamme : peut coûter ×10 ou plus. LDB 51 l.174.
- Le coût d'une barge de cargo *peut être réduit* en échange de travail à bord. LDB 51 l.172.

### Contexte narratif

**Source :** LDB 51 l.157-166

- Route : option la plus **dangereuse** mais la moins chère.
- Rivière : souvent plus sûre et relaxante ; les barges n'acceptent pas toujours les escales hors
  des villes principales (pot-de-vin ou persuasion nécessaire). LDB 51 l.166.
- Auberges relais espacées d'environ 50 km (½ journée à cheval, 1 journée à pied). EDOC 06 (ch.3).

### Compagnies de diligences (couleur locale)

**Source :** EDOC 06 l. (ch.3 Les routes et grandes routes)

Les Quatre Saisons, Lignes Rochet, Lignes Cartak (Altdorf), Diligences Flèche rouge (Averheim),
Diligences de la Tour du Roc (Middenheim), Diligences du Loup coureur (Middenheim), Cannon Ball
Express, L'Express impérial (Nuln), Diligences du Tunnel (Talabheim).

---

## Montures

**Source :** EDOC 07 (ch.4 Montures et véhicules)

### Profils des montures courantes

| Animal | M | CC | F | E | I | Ag | B |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Chien | 4 | 25 | 20 | 20 | 35 | 30 | 7 |
| Poney/âne/mule | 4 | 25 | 30 | 45 | 20 | 30 | 12 |
| Cheval de trait | 5 | 25 | 45 | 45 | 17 | 25 | 26 |
| Cheval de trait lourd | 4 | 25 | 50 | 50 | 15 | 20 | 32 |
| Bœuf | 3 | 25 | 55 | 55 | 15 | 20 | 32 |
| Cheval de monte (Palefroi) | 7 | 25 | 30 | 45 | 20 | 30 | 24 |
| Cheval de guerre léger | 7 | 35 | 45 | 35 | 20 | 30 | 22 |
| Cheval de guerre lourd (Destrier) | 4 | 35 | 50 | 50 | 20 | 20 | 32 |

### Tableau des allures (Mouvement en mètres/tour)

**Source :** EDOC 07 l.115-130

| Animal | M | Pas (m) | Trot (m) | Petit galop (m) |
|---|:--:|:--:|:--:|:--:|
| Chien | 4 | 8 | — | 24 |
| Poney, âne ou mule | 4 | 8 | — | 16 |
| Cheval de trait | 5 | 10 | — | 20 |
| Cheval de trait lourd | 4 | 8 | — | 16 |
| Bœuf | 3 | 6 | — | 12 |
| Cheval de monte (Palefroi) | 7 | 14 | 21 | 42 |
| Cheval de guerre (Courant) | 7 | 14 | 21 | 42 |
| Cheval de guerre lourd (Destrier) | 4 | 8 | 12 | 24 |

### Vitesse de voyage des montures

**Source :** EDOC 07 l.138-140

> « Chaque point de Mouvement équivaut à **1,5 km par heure au pas**, **2,5 km par heure au trot**,
> et **3 km par heure au galop**. »

Formule : vitesse (km/h) = M × facteur d'allure.

| Allure | Facteur | Exemple M 7 |
|---|:--:|:--:|
| Pas | ×1,5 | 10,5 km/h |
| Trot | ×2,5 | 17,5 km/h |
| Petit galop (course) | ×3 | 21 km/h |

### Endurance des allures

**Source :** EDOC 07 l.142-148

- **Pas** : jusqu'à 12 heures sans repos ; ensuite 1 h de pause + eau → BE heures supplémentaires.
- **Trot** : pendant **BE heures**.
- **Petit galop** : pendant **½ BE heures**.

Au-delà de la limite :
- Par heure supplémentaire → +1 Exténué + Test **Résistance Intermédiaire (+0)**.
- Échec → +1 Exténué supplémentaire → jet sur Tableau des Incidents de Monte.
- Exténué > BE → s'effondre (*Sonné* + *À Terre*) + Test Résistance Intermédiaire (+0) ; échec =
  mort de la bête.

### Tableau des Incidents de Monte (1d100)

**Source :** EDOC 07 l.150-155

| 1d100 | Incident |
|:---:|---|
| 01–40 | Sangle cassée |
| 41–85 | Perte d'un fer |
| 86–98 | Boiteux |
| 99–00 | Patte (Jambe) brisée |

**Boiteux** : max ½ vitesse de marche ; impossible d'être monté, portée ou tirée. Prolonger le
trajet augmente la durée d'une Étape. EDOC 07 l.157-159.

**Patte brisée** : Fracture (Majeure) + immobilisation. M divisé par 2 si guérison. EDOC 07
l.145-147.

**Perte d'un fer** : Test **Chevaucher Complexe (-10)** ou chute (2 m). Déplacement au pas jusqu'au
maréchal-ferrant. EDOC 07 l.165-167.

**Sangle cassée** : Test **Chevaucher Complexe (-10)** ou chute (2 m). −20 à tous futurs Tests
Chevaucher jusqu'à réparation. EDOC 07 l.171-174.

### Coût et disponibilité des animaux

**Source :** EDOC 07 l.97-115

| Animal | Coût | Enc portée | Disponibilité |
|---|:--:|:--:|:--:|
| Poulet | 5 sc | 0 | Commune |
| Mouton | 3 /- | 2 | Commune |
| Cochon | 4 /- | 3 | Commune |
| Chien | 2 CO | 8 | Rare |
| Poney | 10 CO | 14 | Commune |
| Âne ou mule | 5 CO | 14 | Commune |
| Cheval de trait | 4 CO | 20 | Commune |
| Cheval de trait lourd | 8 CO | 30 | Limitée |
| Bœuf | 15 CO | 30 | Commune |
| Cheval de monte (Palefroi) | 15 CO | 16 | Commune |
| Cheval de guerre léger | 70 CO* | 18 | Commune |
| Cheval de guerre lourd (Destrier) | 230 CO* | 20 | Limitée |

\* Prix peut doubler ou tripler en temps de guerre.

### Sellerie — selle et harnais

**Source :** LDB 70 l.7-25 · LDB 08 l.551-557

| Objet | Coût | Enc | Contenu | Disponibilité |
|---|:--:|:--:|:--:|:--:|
| Selle et Harnais | 6 CO | 4 | – | Commune |

Les Possessions d'un Niveau de Carrière monté nomment la bête ET sa sellerie (LDB 08 l.557,
Capitaine de la Milice — Or 1) :

> **Possessions :** cheval de selle avec selle et harnais, chapeau de qualité, arme simple de
> qualité, symbole de grade de qualité

---

## Véhicules

**Source :** EDOC 07 (ch.4 « Véhicules routiers dans l'Empire »)

### Tableau des Véhicules de l'Empire

**Source :** EDOC 07 l.231-243

| Véhicule | Coût | Enc | Chargement | Dispo | Animaux/Porteurs | Endurance | Blessures |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Charrette | 20 CO | 10 | 25 | Commune | 1 A | 25 | p.10 |
| Chaise (Bordeleaux) | 25 CO | 5 | 10 | Rare | 2 P | 20 | p.8 |
| Diligence | 150 CO | 100 | 80 | Rare | 2-4 A | 45 | p.50 |
| Charrette à bras | 10 CO | 5 | 50 | Commune | 1-2 P | 20 | p.8 |
| Petite litière | 30 CO | 10 | 10 | Commune | 2 P | 30 | p.20 |
| Grande litière | 45 CO | 20 | 20 | Exotique | 2-4 P | 35 | p.35 |
| Chariot léger | 75 CO | 30 | 30 | Commune | 2-4 A | 50 | p.35 |
| Chariot moyen | 100 CO | 50 | 60 | Commune | 2-6 A | 50 | p.60 |
| Chariot lourd | 125 CO | 75 | 100 | Commune | 2-8 A | 50 | p.95 |

A = Animaux ; P = Porteurs. Tirer un véhicule à roues = 1/10 de son Enc total pour l'animal.

### Vitesse des Véhicules

**Source :** EDOC 07 l.227-229

> « Les animaux qui tirent un véhicule ne peuvent que **marcher ou trotter en toute sécurité.** »

Course forcée (galop en tirant) :
- Test **Conduite d'attelages Intermédiaire (+0)** par km, pénalité −10 par km déjà parcouru au
  galop.
- Échec → retour au pas + Test **Résistance Intermédiaire (+0)** de l'animal (échec = Exténué).
- Échec Stupéfiant (−6 DR ou pire) → jet sur Tableau des Problèmes de Véhicule.

### Tableau des Problèmes de Véhicule (1d100)

**Source :** EDOC 07 l.257-264

| 1d100 | Résultat |
|:---:|---|
| 01–50 | Incontrôlable |
| 51–79 | Endommagé |
| 80–95 | Cassé |
| 96–00 | Accident |

**Incontrôlable** : rênes cassées, pas de contrôle ; collision en 1d10 rounds si pas maîtrisé →
Endommagé (pas) ou Accident (plus vite). EDOC 07 l.282-286.

**Endommagé** : ne peut rouler qu'au pas jusqu'à réparation (Métier Charpentier/Charron). Si forcé
plus vite : Cassé après 1d10 rounds. EDOC 07 l.278-280.

**Cassé** : harnais/roue/essieu brisé. Véhicule immobilisé. Conducteur : Test **Athlétisme
Intermédiaire (+0)** pour ne pas être arraché ; échec = chute (+ éventuellement Traîné au sol).
EDOC 07 l.270-276.

**Accident** : collision violente. Occupants : 2d10 Blessures (−BE, −PA, min 1). Véhicule : 2d10
Blessures (−BE, min 1). Réparation obligatoire avant usage. EDOC 07 l.266-268.

---

## Encombrement et Fatigue de Voyage

**Source :** LDB 61 l.4-49

### Capacité de charge

- Limite sans pénalité = **Bonus de Force + Bonus d'Endurance**. LDB 61 l.4-5.
- Objets portés (armures, vêtements, bijoux) : Enc −1 (souvent = 0). LDB 61 l.21.
- Monnaie : 1 Enc pour 200 pièces. LDB 61 l.30.

### Seuils de surcharge et pénalités

**Source :** LDB 61 l.34-41 (verbatim)

| Enc | Pénalité |
|---|---|
| Jusqu'à la limite | Pas de pénalité |
| Jusqu'au double de la limite | −1 Mouvement (min 3), −10 en Agilité, +1 Fatigue du voyage |
| Jusqu'au triple de la limite | −2 Mouvement (min 2), −20 en Agilité, +2 Fatigue du voyage |
| Plus de ×3 | Impossible de se déplacer |

**Fatigue du Voyage** : États *Exténué* accumulés à la **fin d'une journée de voyage**, annulés
uniquement par un long repos. LDB 61 l.47-48.

**Cumul avec marche forcée** : LDB 61 l.33

> « chaque fois que vous gagnez un État *Exténué* en étant Surchargé, pour une raison autre que la
> Surcharge, gagnez +1 État supplémentaire. »

Donc marche forcée (Test Résistance raté) + surchargé = +1 (marche forcée) +1 (cumul) = +2 Exténué.
C'est ce que confirme LDB 51 l.195 (« État *Exténué* supplémentaire si Encombré »).

---

## Péripéties LdB

**Source :** LDB 51 l.200-225

Mécanisme : le MJ peut lancer **1d10 par jour** de voyage ; événement si résultat **= 8** (le
symbole à 8 pointes du Chaos). Certains MJ préfèrent 1 événement par voyage ≥ 1 jour. LDB 51 l.209.

| 1d10 | Péripétie |
|:---:|---|
| 1 | **Voyage reposant** : guérit toutes Blessures, retire tous les États *Exténué*. |
| 2 | **Quelque chose d'intéressant** : rencontre fortuite, auberge de qualité, ruines. |
| 3 | **À présent, c'est utile !** : ragot, message perdu, scène dont les PJ ne devaient pas être témoins. |
| 4 | **Voyage éreintant** : route bloquée (pont effondré, inondation…). Test **Survie en extérieur Accessible (+20)** pour un itinéraire de remplacement ; sinon +1 jour + *Exténué*. |
| 5 | **Poursuivis !** : un ennemi retrouve la trace des PJ ; confrontation ou détour de quelques jours. |
| 6 | **Voleurs !** : les PJ se font dévaliser. |
| 7 | **Pas encore !** : rival ou contrariété mineure, ennuyeuse mais pas violente. |
| 8 | **Mauvaise influence !** : compagnon de route aux intentions sinistres. |
| 9 | **Même la nature vous déteste !** : danger naturel (animaux, orages, maladies, insectes). |
| 10 | **Attaqués !** : attaque pendant le voyage. Test **Perception Accessible (+20)** raté → embuscade. |

---

## Système par Étapes (EDOC — optionnel)

**Source :** EDOC 08 (ch.5 Voyager) — règles optionnelles qui *enrichissent* LDB 51 sans le remplacer.

### Nombre d'Étapes

**Source :** EDOC 08 l.21-27+40

- Déterminé par le MJ ; courts voyages = 1 Étape, villes importantes = 2-4, très longs = davantage.
- **M ≤ 3** du plus lent → +1-2 Étapes.
- **M ≥ 6** pour toute la troupe → ÷2 Étapes (min 1).
- Test **Orientation Intermédiaire (+0)** ou Savoir (région) réussi → −1 Étape (min 1).
- Carte correcte de l'itinéraire → Test **Accessible (+20)**.

### Météo par Étape

**Source :** EDOC 08 l.50-59 (verbatim du tableau + effets l.62-127)

Jet au début de chaque Étape (d100) :

| Météo | Printemps | Été | Automne | Hiver |
|---|:---:|:---:|:---:|:---:|
| Temps sec | 01–10 | 01–40 | 01–30 | — |
| Beau temps | 11–30 | 41–70 | 31–60 | 01–10 |
| Pluie | 31–90 | 71–95 | 61–90 | 11–60 |
| Pluie diluvienne | 91–95 | 96–00 | 91–98 | 61–65 |
| Neige | 96–00 | — | 99–00 | 66–90 |
| Blizzard | — | — | — | 91–00 |

Ajustements : régions plus au nord → +10 à +30 ; plus au sud → −10 à −30. EDOC 08 l.62.

**Effets météo :**

| Météo | Effets |
|---|---|
| **Temps sec** | −10 à Approvisionnement (eau rare). |
| **Beau temps** | Aucun danger météo. |
| **Pluie** | Visibilité ≤ 25 m ; armes à distance −10. |
| **Pluie diluvienne** | −10 tous Tests physiques ; armes à distance −20 ; poudre inutilisable. |
| **Neige** | Visibilité ≤ 45 m ; max marche ; Test **Résistance Accessible (+20)** ou *Exténué*. |
| **Blizzard** | Visibilité ≈ 0 ; max marche ; armes à distance inutiles ; Test **Résistance Intermédiaire (+0)** ou *Exténué*. |

> **§ Écarts / état de câblage (#341).** Les effets ci-dessus vivent en DONNÉE (`weather.json`
> `conditions`, mêmes formes que `sea-weather.json`). **Câblé :** modificateur météo des Activités
> (`ActivityDef.weatherMod`, plus d'`id` en dur) ; « conditions du jour » en COMBAT ouvert pendant une
> journée de voyage — le tir encaisse la pénalité de temps (Pluie −10 / Pluie diluvienne −20), la poudre
> exposée meurt, le Blizzard rend le tir impossible, et le Corps à corps (Test de CC) encaisse le −10
> « Tests physiques » de la pluie diluvienne, ligne LIBELLÉE « Météo : … » dans le détail du jet
> (`attackEnv`, `src/state/combatFlow.ts`). « Tests physiques » = liste MAISON éditable
> (`weather.json` `physicalTestChars` : CC/CT/F/E/Ag/Dex). **Différé (STOP-and-report, seams identifiés) :**
> (a) mod « Tests physiques » sur les Tests d'ACTIVITÉ non-combat (les rangées BATCH d'Activité n'exposent
> pas de breakdown de mods — surface UI à créer) ; (b) Tests de Résistance Neige/Blizzard « ou Exténué »
> au démarrage du jour (données posées, `weatherResistanceTest` ; reste un applier de cascade batch) ;
> (c) éclairs → montures Nerveux (couture `fireTriggers(onStartled, 'noise')` existante, mais la CADENCE
> d'un éclair est RAW-indéfinie et il n'y a pas de contexte de combat pendant la marche) ; (d) plafond de
> visibilité en mètres sur la portée du tir (donnée `visibiliteM` posée ; le cap sur `effectiveWeaponRange`
> attend la résolution de l'échelle tuile↔mètre). Le Blizzard/la Pluie diluvienne (visibilité ≈ 0) sont
> déjà neutralisés côté tir par `rangedUseless` / le −20.

### Option « Attraper Froid »

**Source :** EDOC 08 l.88-92

Fin de chaque Étape : tout PJ exposé à pluie ou neige sans **manteau ET tente** → Test **Exposition**
(LDB 18 l.326-334). Pluie diluvienne/blizzard : Test même avec les deux. Manteau *ou* tente manquant →
Complexe (−10) ; les deux manquants → Difficile (−20). Hiver ou printemps après échec → **Rhume
commun** (EDOC 08 l.110-122).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 18` (l.326-334) → `faim`, `soif`, `bandEntry`, `recovery`, `SEA_KINDS_SOUS_ORDRES`, `hungerThirstPenalty`, `effectiveChar`, `RESISTANCE_TEST`, `HungerState`, `ThirstState`, +43 — `src/data/night-stakes.json`, `src/data/regles.json`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs-scenes/effets.ts`, `src/data/voyage-stakes.json`, `src/engine/characteristics.ts`, +14 fichiers
- `EDOC 8` (l.21-40, l.50-59, l.62, l.88-92, l.110-122) → `plein-air`, `Season`, `weatherIdSchema`, `printemps`, `approvisionnement`, `doc`, `Weather`, `dessin`, `ete`, `recueillir-informations`, +54 — `src/data/activities.json`, `src/data/index.ts`, `src/data/maladies.json`, `src/data/regles.json`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs/maladies.ts`, +19 fichiers
- dette : #674

### Activités de Voyage (1 par Étape)

**Source :** EDOC 08 l.129-180

Échec à un Test pendant une Activité → +1 *Exténué*.

| Activité | Test | Effet réussite |
|---|---|---|
| **Plein Air** | Survie en extérieur Intermédiaire (+0) −10/degré depuis Beau temps | Dispense le groupe du Test d'Exposition. |
| **Approvisionnement** | Survie en extérieur (règle « Trouver nourriture ») | Chaque DR = +1 personne nourrie. |
| **Recueillir des informations** | Ragot Intermédiaire (+0) | Autant de questions au MJ que de DR. |
| **Rester aux Aguets** | Perception Intermédiaire (+0) | Groupe insurprisable cette Étape. |
| **Établir des Cartes** | Test étendu Métier (Cartographe) ou Art (Dessin), DR requis = 2 × nb Étapes | Carte → Tests Savoir/Orientation Accessibles (+20) lors de futurs voyages. |
| **Pratiquer une Compétence** | Test Intermédiaire (+0) d'une compétence praticable en voyage | Peut inverser un jet sur cette compétence lors de la prochaine aventure ou Étape. |
| **Récupérer** | (Aucun test) — condition : pas d'*Exténué* cette Étape | Compte comme repos (guérison de Blessures). |
| **Monter un Camp** | Survie en extérieur ou Guérison Intermédiaire (+0) | Chaque DR = retirer 1 *Exténué* d'un PJ OU guérir PB. |

### Provisions en voyage

**Source :** EDOC 08 l.46

> « Les Personnages et leurs montures consomment **1 Encombrement en nourriture par jour**, pour un
> coût de 2/–. »

---

## Poursuites

**Source :** LDB 15 l.88-108

### Procédure en 4 étapes

**Étape 1 — Déterminer la Distance initiale**
Le MJ choisit une valeur de **Distance** (1 à 8) :
- 1 = presque à portée
- 4 = avance confortable
- 8 = presque hors de portée

**Étape 2 — Test de Mouvement**
Chaque participant effectue un Test adapté aux circonstances :
- À pied → **Athlétisme**
- À cheval → **Chevaucher**
- En véhicule → **Conduite d'attelages**

**Étape 3 — Actualiser la Distance**
Comparer le **DR le plus bas** des poursuivis au **DR le plus haut** des poursuivants.
- Si les poursuivis l'emportent : Distance augmente de la différence.
- Si les poursuivants l'emportent : Distance diminue de la différence.

**Étape 4 — Déterminer l'issue**
- Distance ≤ 0 : les poursuivants ont rejoint leur cible. **Trois décisions + un recalcul** (l.94, verbatim) :

  > « Les poursuivis ont alors la possibilité, **pour ce Round**, de sacrifier le plus lent d'entre eux
  > afin de ralentir les poursuivants et de poursuivre leur fuite, **ou ils peuvent s'arrêter et les
  > affronter**. Si le plus lent des poursuivis est abandonné, les poursuivants décident de qui s'arrête
  > pour l'affronter et qui continue la poursuite. Si le pauvre retardataire n'est pas une cible
  > prioritaire, il se peut qu'il soit **purement et simplement ignoré** ! »

  Après l'abandon du plus lent, la Distance se **recalcule** sans lui (l.100-102, exemple) : Distance 2,
  cultistes DR 0/2/2, Sigrid DR 3 → −3 = rattrapés ; le DR 0 abandonné, l'étape 3 se rejoue sur le
  **prochain poursuivi le plus lent** (DR 2) contre Sigrid (DR 3) → Distance 2 − 1 = **1**, et la
  poursuite repart avec un poursuivant de moins (Sigrid s'est arrêtée).
- Distance ≥ 10 : fuite réussie, poursuite terminée.
- Distance 1–9 : retour à l'Étape 2.

### Modificateurs de Mouvement

**Source :** LDB 15 l.106-108

Si un participant a un **M supérieur** aux autres, il gagne autant de **DR bonus** que la différence.

> Exemple : Poursuivant M 5 vs poursuivi M 4 → +1 DR bonus au test de poursuite.
> Exemple : Perdita (cheval M 8) vs Bandit 1 (M 7) vs Bandit 2 (M 9) → Perdita +1 DR, Bandit 2 +2 DR.

---

## Voir aussi

- [`combat.md`](combat.md) — Charge, Désengagement, Fuite, Avantage, Escalade, Saut, Chute,
  Poursuite en combat, Combat Monté (règles de base).
- [`etats.md`](etats.md) — État *Exténué* (accumulation et récupération).
- [`traumatisme.md`](traumatisme.md) — Blessures Critiques (Fracture Majeure d'une patte).
- [`tests.md`](tests.md) — Difficulté des Tests (Accessible +20, Intermédiaire +0, etc.).

---

## Implémente

| Module | Ce qu'il couvre |
|---|---|
| `src/engine/travel.ts` | Vitesse de groupe (`partyWalkSpeed`), `travelSpeed` (dont allures EDOC en selle / attelage forcé), `travelPlanCalc`, `transportCost`, `forcedMarchTest`/`applyForcedMarch`, `applyTravelFatigue`. Transports payants lus depuis `src/data/vehicles.json`. |
| `src/engine/mountTravel.ts` | Montures en voyage (EDOC 4, règle optionnelle `travel-allures`) : profils/allures en donnée (`src/data/montures.json`), vitesse M × 1,5/2,5/3 km/h (l.140), endurance des allures 12 h / BE / ½ BE (l.142-144), cascade de sur-endurance (+Exténué, Test de Résistance, effondrement/mort, l.146) et Incidents de monte (l.148-174, `resolveMountIncident`/`resolveMountedDay`). |
| `src/engine/travelStages.ts` | Système par Étapes EDOC : `stageCount` (bonus lu sur la règle `travel-etapes-count-bonus`), météo (`weatherRanges`), `stageExposureDifficulty`, `forageYield`, saisons (calendrier impérial). EFFETS météo en DONNÉE (`weather.json` `conditions`) : `WeatherCondition`, `weatherRangedMod`, `weatherRangedUseless`, `weatherPowderUseless`, `weatherPhysicalTestMod`, `weatherMovementWalkOnly`, `weatherResistanceTest`, `weatherVisibiliteM`, `weatherLightningNervous`. Le modificateur météo par Activité est désormais DONNÉE (`ActivityDef.weatherMod`). |
| `src/engine/provisions.ts` | Faim (LDB 18 l.337-343) : consommation/jour, Test Résistance, malus, Brouet. |
| `src/engine/encumbrance.ts` | `effectiveMovement(c)` (M après pénalités Enc), `encumbrancePenalties()` (tiers + travelFatigue). |
| `src/state/travelFlow.ts` | Voyage jour par jour, `TravelPlan` + reprise, `TravelRecap`, cascade influençable de marche forcée, sous-système Étapes optionnel ; journée en selle (`resolveMountedTravelDay`) et attelage forcé au pas de course (`forcedPaceDay` : Test de Conduite d'attelage par km, Échec Stupéfiant → `applyVehicleProblem` + Dégâts occupants `occupantOps` en GameOp). |
| `src/data/vehicles.json` | Table des transports payants RAW (Diligence/Barge/Fiacre/Ferry), éditable au Compendium. |
| `src/data/montures.json` | Table « Mouvement pour les montures » + Endurance des profils (verbatim EDOC 07), liée aux trappings `animaux-et-vehicules`. |
| `src/data/peripeties.ts` | Table des péripéties de voyage (1d10, verbatim LDB 51 l.212-222). |

### Écarts code ↔ RAW relevés

| Point | RAW | Code | Statut |
|---|---|---|---|
| Budget d'heures PAR JOUR CALENDAIRE | « 6 heures **par jour** sans Test » (l.224) — PAR JOUR, pas par trajet | `store.travelDayHours` (accumulateur UNIQUE keyé sur `dayIndex`, remis à zéro au franchissement de jour) : les trajets à pied/en selle ENCHAÎNÉS le même jour cumulent leur budget → marche forcée dès que le cumul dépasse 6 h (un seul Test/jour, drapeau `marched`), plafond dur au-delà de `forcedMaxHours` (halte forcée) ; endurance de monture comptée sur le jour (`resolveMountedDay(priorHours)`) | **Corrigé #340** (avant : `startTravel` repartait à neuf par trajet — 3×4 h ne déclenchaient jamais la marche forcée). |
| Heure de départ (terre & fleuve) | Canon muet (le budget/jour ne dit pas quand la journée commence) | Porte maison `travel-departure-gate` (défaut ON) : départ à pied/en selle/fluvial JOUÉ de l'aube au crépuscule ; de nuit → « Attendre l'aube » (nuit jouée) ou annuler (`pendingDeparture`). Mer exemptée. | Valeur maison éditable (#340). |
| Navigation fluviale de nuit (halte au crépuscule) | Canon muet (MSRC 5) | La descente JOUÉE s'arrête au crépuscule (`finishRiverDay`) et reprend à l'aube — même cadence maison que la porte de départ | Re-tag sincérité #340 : valeur maison (ne se croit plus RAW). |
| Privation de sommeil | Canon muet (LDB 18 : Exténué non lié au sommeil manqué) | Règle maison OPT-IN `travel-sleep-forced` : chaque jour calendaire franchi sans nuit jouée (`lastNightDay`) → +1 Exténué « privation de sommeil » (via `applyOps` condition, retiré au prochain vrai repos) | Valeur maison éditable, désactivée par défaut (#340). |
| Voguer de nuit en mer (÷2) | « La distance parcourue par jour suppose que le vaisseau en question est doté d'un équipage assez nombreux et des installations nécessaires pour pouvoir voguer de nuit. Dans le cas contraire, divisez par deux la distance couverte en un jour. » (MDG 15 l.76) | `applySeaProgress` lit la règle maison `sea-night-sailing` (équipage abstrait, MDG 14 l.39) : ON (défaut) = distance pleine ; OFF = `seaMilesPerDay(m, false)` → ÷2 | **Câblé #340** (avant : `nightSailing` codé en dur à `true` → le ÷2 n'était jamais appliqué). |
| Plafond marche forcée | Canon muet | 10 h/j par défaut (paramétrable) | Choix documenté dans `TRAVEL_DEFAULTS.forcedMaxHours`. |
| Barges + courant | ±30 % | Implémenté via `route.speed[mode]` | Conforme. |
| Péripétie seuil d10 | « événement sur un résultat de 8 » | `perilDie = 8` (0 = désactivé) | Conforme. |
| Vitesse monture en km/h | M × 1,5 / 2,5 / 3 (EDOC 07 l.140) | `mountedSpeedKmh` (bête la plus lente, allure plafonnée par Perte d'un fer / non-trot) | Conforme (règle `travel-allures`). |
| Endurance monture (allures) | EDOC 07 l.142-146 : 12 h au pas, BE h au trot, ½ BE au galop ; au-delà +Exténué/Tests/effondrement | `allureEnduranceHours` + `resolveMountedDay` (Exténué journalier des bêtes — la halte de nuit vaut repos) | Conforme. |
| Tableau Incidents de Monte | EDOC 07 l.148-174 | `rollMountIncident` + `resolveMountIncident` (chute cavalier 2 m, -20 Chevaucher, fer→pas, Boiteux/Patte brisée) — fer/sangle/boiteux REMIS EN ÉTAT à l'arrivée (RAW sans coût ni durée) | Conforme ; remise en état à l'étape = choix documenté. |
| Véhicules (Problèmes de Véhicule) | EDOC 07 l.229 (allure forcée : Test de Conduite d'attelage/km, -10/km au galop) + l.253 (Échec Stupéfiant → table) | `forcedPaceDay` (travelFlow) → `applyVehicleProblem` ; Incontrôlable non maîtrisé plus vite que le pas → Accident (l.286) ; Endommagé → cadence de base jusqu'à réparation | Conforme ; après un échec, le galop ne reprend pas le même jour (choix documenté, RAW muet). |

---

<!-- MDG-INTEGRATION -->

## Navigation maritime — Tests de Navigation (MDG)

**Source :** MDG 13 l.17-20, l.22-24

« Test de Navigation » est le terme générique pour les Tests de Compétence assurant qu'un navire progresse et manœuvre correctement. La Compétence dépend du mode de propulsion : **Voile** (Personnage à la barre) pour un voilier, **Ramer** (rameur au score le plus élevé, les autres en Soutien) pour un bateau à avirons. **Savoir (Océans)** donne un bonus sur les Tests de Navigation égal au **premier chiffre** du score (Savoir (Océans) 36 → +3) ; ce bonus ne s'applique que sur l'océan. Contrairement à la navigation fluviale, sans la Compétence **Voile** on ne peut piloter un voilier en mer, et des Tests sont obligatoires pour progresser.

Le **Personnage à la barre** est celui le mieux placé pour influencer le mouvement du vaisseau au moment du Test ; il n'est pas forcément littéralement à la barre (gouvernail, voiles, avirons). Il peut recevoir du **Soutien**.

> « *Tests de Navigation* » est un terme générique pour désigner les Tests de Compétence nécessaires afin de s'assurer qu'un navire progresse sur son trajet et effectue ses manœuvres de manière appropriée. » — `MDG 13 l.17`

Autres formes de propulsion : Propulsion à vapeur → **Métier (Ingénieur)** ; Bête captive → **Dressage** ; Roue à aubes → **Commandement** (coureurs consentants) ou **Intimidation** (non consentants) ; Magie → **Langue (Magick)**. `MDG 13 l.30-36`

**Voir aussi :** [Progression d'un navire (MDG)](#progression-dun-navire-mdg), [Tests d'équipage (MDG)](#tests-déquipage-mdg), [`tests.md`](tests.md) (Soutien, Difficulté).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `MDG 13` (l.17-20, l.30-36) → `plus2`, `plus1`, `normal`, `vesselPropulsion`, `minus1`, `half`, `savoirOceansBonus`, `nav-progression`, `navigation-progression` — `src/data/naval-progression.json`, `src/data/regles.json`, `src/data/schemas/defs/sea-navigation.ts`, `src/data/voyage-stakes.json`, `src/engine/seaNavigation.ts`, `src/engine/shipBuild.ts`

---

## Progression d'un navire (MDG)

**Source :** MDG 13 l.41-81

Comme un personnage, un navire a un Attribut **Mouvement (M)** déterminant sa vitesse. Le Test de Navigation est comparé au tableau de Progression, l'effet modifiant le M utilisé pour le déplacement :

| DR du Test | Effet |
|---|---|
| 4 ou plus | Vitesse maximale : déplacement de **M+2** |
| 1 à 3 | Bonne progression : **M+1** |
| –2 à 0 | Normal : **M** |
| –3 à –4 | Lent : **M–1** |
| –5 ou moins | Lutte : **½ M** (arrondi inférieur) |

Vitesses de Mouvement (extrait) : M = mètres/Round = M×2 ; milles par Période de travail de 2 h ≈ M (M1→2, M5→8, M10→15) ; par Période de 8 h ≈ M×... (M1→8, M5→32, M10→60). `MDG 13 l.47-60`

Les **Périodes de travail** sont des laps liés à la fatigue : rameurs ≈ **2 h** avant Test contre l'épuisement, voiles/barre ≈ **8 h**. `MDG 13 l.62`

Le MJ fixe la fréquence et la difficulté des Tests selon les conditions : Mer calme → **Accessible (+20)**, 1 Test/Période de travail ; Eaux agitées → **Intermédiaire (+0)**, 1/Période ; Fort vent et grosses vagues / côte rocailleuse → **Complexe (–10)**, 1/heure ; côte rocailleuse + épais brouillard → **Difficile (–20)**, 1/heure ; Gueule du dragon en tempête → **Très Difficile (–30)**, 1/Round. `MDG 13 l.85-92`

**Voir aussi :** [Navigation maritime — Tests de Navigation (MDG)](#navigation-maritime--tests-de-navigation-mdg), [Forcer le rythme et épuisement (MDG)](#forcer-le-rythme-et-épuisement-mdg), [Manœuvres et vitesses maximum (MDG)](#manœuvres-et-vitesses-maximum-mdg).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `MDG 13` (l.41-81, l.85-92) → `sea-navigation`, `progressionModeSchema`, `plus2`, `plus1`, `normal`, `minus1`, `half`, `forcePaceDifficulty`, `WorldMapView`, `SeaVoyageState`, +10 — `src/data/naval-progression.json`, `src/data/regles.json`, `src/data/schemas/defs/naval-progression.ts`, `src/data/schemas/defs/sea-navigation.ts`, `src/data/sea-navigation.json`, `src/data/voyage-stakes.json`, +3 fichiers

---

## Forcer le rythme et épuisement (MDG)

**Source :** MDG 13 l.95-111

Un équipage peut tenter d'augmenter sa vitesse via un **Test de Voile ou de Ramer** (ce n'est PAS un Test de Navigation, donc Savoir (Océans) n'aide pas) :
- **+1 M** : Voile **Très Difficile (–30)** ou Ramer **Difficile (–20)**.
- **+2 M** : Voile n/a ; Ramer **Très Difficile (–30)**.

Le bonus dure jusqu'à la prochaine Période de travail (8 h voiles, 2 h avirons) ou jusqu'au prochain Test de Navigation imposé par les circonstances.

**Épuisement** : à la fin d'une Période de travail, chaque membre d'équipage maniant voiles/avirons réussit un **Test de Résistance Accessible (+20)** ou reçoit un État *Exténué*. S'ils ont Forcé le rythme, ce Test devient **Résistance Complexe (–10)**.

> « À la fin d'une Période de travail, les membres d'équipage impliqués dans le maniement des voiles ou des avirons doivent réussir un Test de **Résistance Accessible (+20)** sous peine de recevoir un État *Exténué*. » — `MDG 13 l.111`

**Voir aussi :** [Progression d'un navire (MDG)](#progression-dun-navire-mdg), [`etats.md`](etats.md) (Exténué).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `MDG 13` (l.95-111) → `sea-navigation`, `plus2`, `plus1`, `SEA_KINDS_SOUS_ORDRES`, `normal`, `resolveShipManeuver`, `minus1`, `half`, `forcePaceDifficulty`, `exhaustionDifficulty`, +17 — `src/data/naval-progression.json`, `src/data/regles.json`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs/sea-navigation.ts`, `src/data/sea-navigation.json`, `src/data/voyage-stakes.json`, +7 fichiers

---

## Manœuvres et vitesses maximum (MDG)

**Source :** MDG 13 l.113-142

**Test de Manœuvre** : chaque fois qu'une manœuvre est nécessaire (éviter un obstacle, pointer les canons), le Personnage à la barre effectue un Test de Navigation modifié par la **Caractéristique Man** du bateau. C'est un type de Test de Navigation (tous les modificateurs de Navigation s'y appliquent), mais les facteurs propres aux Manœuvres ne s'appliquent qu'à elles.

**Vitesse maximum** : un navire peut aller jusqu'à **M+4** sans risque. Au-delà, **Test d'Endurance** sous peine de Dégâts (tableau *Ça va lâcher, capitaine !*) :

| Mouvement | Test de Résistance | Régularité | Dégâts |
|---|---|---|---|
| M+5 | Accessible (+20) | 1/heure | 1+X |
| M+6 | Intermédiaire (+0) | 1/heure | 2+X |
| M+7 | Complexe (–10) | 1/minute | 3+X |
| M+8 | Difficile (–20) | 1/Round | 5+X |
| M+9 ou plus | Très Difficile (–30) | 1/Round | 8+X |

X = nombre de DR négatifs du Test de Résistance raté. `MDG 13 l.142`

**Voir aussi :** [Progression d'un navire (MDG)](#progression-dun-navire-mdg), [Collisions de navires (MDG)](#collisions-de-navires-mdg), [`tests.md`](tests.md) (DR).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `MDG 13` (l.113-142) → `sea-navigation`, `SEA_KINDS_SOUS_ORDRES`, `resolveShipManeuver`, `forcePaceDifficulty`, `exhaustionDifficulty`, `OverspeedRow`, `WorldMapView`, `overspeedRow`, `overspeedDamage`, `rollOverspeedDamage` ⚠sans-appelant, +18 — `src/data/reglesOptionnelles.json`, `src/data/schemas/defs/sea-navigation.ts`, `src/data/sea-navigation.json`, `src/data/voyage-stakes.json`, `src/engine/seaNavigation.ts`, `src/engine/shipNavigation.ts`, +7 fichiers

---

## Salissures de coque (MDG)

**Source :** MDG 13 l.144-159

Sans entretien, un navire accumule algues, coquillages, tarets et xylophages. Pour chaque **semaine** en mer sans entretien, **Test de Résistance** pour le vaisseau ; chaque échec ajoute un niveau de Salissures :

| Niveau | Effets | Réparation |
|---|---|---|
| 1 | –1 DR Manœuvres | 5 % du coût de base |
| 2 | –1 DR Manœuvres, –1 M | 10 % |
| 3 | –2 DR Manœuvres, –1 M | 15 % |
| 4 | –2 DR Manœuvres, –2 M | 20 % |
| 5 | –3 DR Manœuvres, –2 M, –1 DR tous Tests de Navigation | 25 % |

Les petits navires peuvent être nettoyés par Compétences/Sorts/Miracles ou en les échouant ; un bateau de Taille Moyenne ou plus doit aller en **cale sèche** pour gratter sa coque. `MDG 13 l.150`

**Voir aussi :** [Réparer un navire (MDG)](#réparer-un-navire-mdg), [Entretien du navire (Activité en mer) (MDG)](#entretien-du-navire-activité-en-mer-mdg).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `MDG 13` (l.144-159) → `sea-navigation`, `sea-weather`, `SEA_KINDS_SOUS_ORDRES`, `OverspeedRow`, `overspeedDamage`, `rollOverspeedDamage` ⚠sans-appelant, `FoulingLevel`, `rollWeeklyFouling`, `aucune`, `legeres`, +22 — `src/data/reglesOptionnelles.json`, `src/data/schemas/defs/sea-navigation.ts`, `src/data/schemas/defs/sea-weather.ts`, `src/data/sea-navigation.json`, `src/data/sea-weather.json`, `src/data/trappings.json`, +6 fichiers

---

## Météo de la Mer des Griffes (MDG)

**Source :** MDG 13 l.162-243

Lancer 1d10 pour chaque aspect (Précipitations, Température, Visibilité, Vents) au tableau *Météo de la Mer des Griffes*. Scores de base = été ; **+2** en automne/printemps, **+4** en hiver. Mer plus chaude : –2 (min 1) sur Température et Visibilité.

**Effets des Précipitations** (pont) : Légères → –10 Athlétisme/Escalade/Projectiles (Poudre noire) ; Abondantes → –20 à ces Tests + –10 Commandement/Orientation/Perception/Ramer/Voile ; Très abondantes → –30 / –20 / –10 sur tous les autres Tests. `MDG 13 l.189-200`

**Température** : Caniculaire → Test **Résistance Intermédiaire (+0)** toutes les 2 h (échec = Exposition à la Chaleur), 4 L d'eau/jour sinon Soif ; Chaude → **Résistance Accessible (+20)** toutes les 4 h, 3 L/jour ; Médiane → aucun effet ; Froide → **Accessible (+20)** toutes les 4 h (Exposition au Froid) ; Glaciale → **Intermédiaire (+0)** toutes les 2 h. `MDG 13 l.207-225`

**Visibilité** : Dégagé → rien ; Brume → –1 DR Projectiles/Orientation/Perception à la vue au-delà de 20 m ; Brouillard → –2 DR au-delà de 10 m ; Purée de pois → –3 DR au-delà de 5 m. `MDG 13 l.231-243`

**Voir aussi :** [Vents (MDG)](#vents-mdg), [Orientation et phares (MDG)](#orientation-et-phares-mdg), [`etats.md`](etats.md) (Exposition).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `MDG 13` (l.162-243) → `sea-navigation`, `sea-weather`, `SEA_KINDS_SOUS_ORDRES`, `champs`, `carte`, `PendingTest`, `FoulingLevel`, `aucune`, `applyExposureFailure`, `legeres`, +32 — `src/data/schemas/defs/sea-navigation.ts`, `src/data/schemas/defs/sea-weather.ts`, `src/data/sea-navigation.json`, `src/data/sea-weather.json`, `src/data/trappings.json`, `src/engine/exposure.ts`, +8 fichiers

---

## Vents (MDG)

**Source :** MDG 13 l.246-304

Le vent affecte surtout la voile. **Rose des vents** (1d10) : 1-6 dominant (ouest sur la Mer des Griffes), 7 nord, 8 sud, 9 ouest, 10 est. La direction du vent comparée à celle du bateau donne un Vent de face, arrière ou latéral (bâbord/tribord). `MDG 13 l.250-270`

Force du vent tirée au début, mise à jour à l'aube/midi/crépuscule/minuit (1d10, un 1 = changement d'un cran). **Effet du vent** (% avant la barre = voiles, après = autres moyens) :

| Force | Vent arrière | Vent latéral | Vent de face |
|---|---|---|---|
| Calme plat | Encalminé | Encalminé | Encalminé |
| Légère brise | +0/+0 | +0/+0 | –10/+0 |
| Brise fraîche | +10/+0 | Virement +10/+0 | –25/+0 |
| Vent modéré | +25/+0 | Virement +25/+0 | –50/–10 |
| Vent violent | +25/+10 | Affaler/–5 | Affaler/–25 |
| Tempête | Affaler | Affaler | Affaler |

**Affaler les voiles** : Test **Navigation Intermédiaire (+0)** ; échec = Critique immédiat sur les voiles. Tant que le vent souffle ainsi, jeter l'Ancre ou se déplacer à 25 % de la vitesse dans la direction poussée. **Encalminé** : pas de déplacement à la voile (immobile ou tiré par le courant, M1 en général ; remorquage par embarcation de bord = ensemble M1, –4 DR Man). **Virement de bord** : augmente le M via Test **Navigation Intermédiaire (+0)** réussi. `MDG 13 l.288-304`

**Voir aussi :** [Météo de la Mer des Griffes (MDG)](#météo-de-la-mer-des-griffes-mdg), [Détroits et tourbillons (MDG)](#détroits-et-tourbillons-mdg).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `MDG 13` (l.246-304) → `sea-weather`, `windDirectionSchema`, `windAspectSchema`, `carte`, `WorldMapRoutePanel`, `MapRoute`, `OrientationOutcome`, `aucune`, `orientationOutcome`, `legeres`, +28 — `src/data/flow-stakes.json`, `src/data/schemas/defs-scenes/worldmap.ts`, `src/data/schemas/defs/sea-navigation.ts`, `src/data/schemas/defs/sea-weather.ts`, `src/data/sea-navigation.json`, `src/data/sea-weather.json`, +7 fichiers

---

## Orientation et phares (MDG)

**Source :** MDG 13 l.307-351

Un **Test d'Orientation** par jour de voyage (règle de base). Tableau *Repères* :

| DR | Effets |
|---|---|
| 4 ou plus | Le Navigateur connaît la direction et peut pointer le bateau sur une carte |
| 0 à 3 | Le bateau avance dans la direction supposée |
| –2 à –0 | Légère déviation : sans effet la 1ʳᵉ fois ; si répété → Changement de cap |
| –3 à –4 | Déviation : jet sur Changement de cap |
| –5 ou moins | Forte déviation : Changement de cap +2 |

**Changement de cap** (1d10 ; direction 1-5 tribord, 6-10 bâbord) : 1-3 perd sa position sur la carte (sans conséquence) ; 4-6 +10 % de temps ; 7-9 +25 % ; 10-11 déviation de 90° ; 12 demi-tour. `MDG 13 l.322-331`

**Phares** : visibles, ils donnent un bonus aux Tests d'Orientation = premier chiffre de Savoir (Océans). Voir la lumière = **Test de Perception** : Facile (+40) à ≤5 milles, Intermédiaire (+0) à 5-10, Difficile (–20) à 10-15. Phare près d'un danger : +20 pour repérer ce danger. **Clochers** (ex. Bilbali) : seulement +2 DR à l'Orientation, distances divisées par deux, mais utiles par brouillard. `MDG 13 l.333-351`

**Voir aussi :** [Provisions et équipement de navigation (MDG)](#provisions-et-équipement-de-navigation-mdg) (Boussole +1 DR), [Tests d'équipage (MDG)](#tests-déquipage-mdg).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `MDG 13` (l.307-351) → `portProfileSchema`, `MapPlace`, `rollCrewRole`, `crew`, `carte`, `OrientationOutcome`, `OrientationResult`, `orientationOutcome`, `rollCourseChange`, `lighthouseSpotDifficulty`, +26 — `src/data/flow-stakes.json`, `src/data/schemas/defs-scenes/worldmap.ts`, `src/data/schemas/defs/sea-navigation.ts`, `src/data/schemas/defs/sea-weather.ts`, `src/data/sea-navigation.json`, `src/data/sea-weather.json`, +10 fichiers

---

## Course-poursuite navale (MDG)

**Source :** MDG 13 l.354-420

Adaptation des règles de Poursuite terrestres à plus grande échelle. Sauf interaction directe (canons, sorts), demander les Tests de Distance **tous les 10 Rounds** et **×10** le résultat ; revenir au Round normal dès que les équipages peuvent interagir. Chaque bateau = un individu ; on parle de **Cible** et de **Poursuivants**.

**1 — Déterminer la Distance** : avance de la Cible ; 1 point = **10 mètres**. Distance d'échappement selon l'environnement : brouillard/labyrinthe rocheux 10 ; fjords/criques 30 ; brume + rochers 50 ; mer houleuse 70 ; mer d'huile/temps dégagé 100. `MDG 13 l.364-370`

**2 — Test et actualisation** : par ordre d'Initiative, **Test de Navigation** pour le Mouvement ; tableau dédié (m parcourus ÷10, min 1, puis +1 / inchangé / –1 / –2 selon DR). Pénalité de petit M : M3 –1 DR, M2 –2 DR, M1 –3 DR. `MDG 13 l.378-399`

**3 — Déterminer l'issue** : recalculer la Distance, retour à l'étape 2. Distance 0 = Cible attrapée → attaquer ou poursuivre un autre membre. `MDG 13 l.401-403`

**Voir aussi :** [`deplacement.md`](deplacement.md#poursuites) (Poursuite terrestre LdB 15), [Tests d'équipage (MDG)](#tests-déquipage-mdg).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `MDG 13` (l.354-420) → `portProfileSchema`, `MapPlace`, `scene`, `perilManagement` ⚠sans-appelant, `lighthouseSpotDifficulty`, `sea-navigation`, `lighthouseOrientationDR`, `pursuitLowMPenalty`, `WorldMapPlacePanel`, `pursuitDistanceGain`, +12 — `src/data/flow-stakes.json`, `src/data/schemas/defs-scenes/worldmap.ts`, `src/data/schemas/defs/sea-navigation.ts`, `src/data/schemas/defs/sea-perils.ts`, `src/data/sea-navigation.json`, `src/data/sea-perils.json`, +10 fichiers

---

## Collisions de navires (MDG)

**Source :** MDG 13 l.423-464

La vigie a **trois chances** de repérer une trajectoire de collision ; ensuite le Personnage à la barre fait un **Test de Manœuvre** pour l'éviter. *Gestion des périls* (selon distance) : 100 m → Perception Difficile (–20) / Manœuvre Facile (+40) ; 50 m → Intermédiaire (+0) / Accessible (+20) ; 10 m → Accessible (+20) / Complexe (–10). Après tout péril croisé, un **Test d'Orientation** est nécessaire. `MDG 13 l.429-438`

**Indice de Collision** = Bonus d'Endurance du bateau + ses Blessures restantes (E 20, 15 Blessures → IC 3 : BE 2 + BB 1). En collision, chaque navire reçoit des Dégâts = **IC de l'autre + M du navire qui a causé la collision**. `MDG 13 l.442-446`

**Facteurs** : cible qui s'éloigne → Dégâts –M (min 0) ; touché à la poupe → 2 PA ; touché au milieu de coque → Dégâts ×2 ; manœuvre pour limiter/aggraver → Test de Manœuvre, les DR ±= IC des deux navires ; collision frontale → Dégâts = IC de l'autre + **M total des deux**. Sauf précision, la collision touche la **Coque**. `MDG 13 l.452-464`

**Voir aussi :** [Manœuvres et vitesses maximum (MDG)](#manœuvres-et-vitesses-maximum-mdg), [Périls en mer (MDG)](#périls-en-mer-mdg).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `MDG 13` (l.423-464) → `sea-perils`, `collisionIndex`, `iceberg`, `debris-marins`, `resolveCollision`, `rocher`, `bas-fonds`, `perilManagement` ⚠sans-appelant, `strandingPenalty`, `faible`, +10 — `src/data/schemas/defs/sea-perils.ts`, `src/data/sea-perils.json`, `src/data/voyage-stakes.json`, `src/engine/collision.ts`, `src/engine/seaNavigation.ts`, `src/engine/seaPerils.ts`, +4 fichiers

---

## Périls en mer (MDG)

**Source :** MDG 13 l.467-499

**Échouer** : le navire s'arrête net et ne bouge plus jusqu'à dégagement ; **Test de Force** avec pénalité = total d'Encombrement du navire + cargaison ; aides possibles avec assez de cordes. `MDG 13 l.471-473`

**Icebergs** : M1, Indice de Collision moyen **25**. `MDG 13 l.475-479`

**Débris marins** : M1, IC **3** ; 20 % d'empêtrement selon Taille (Minuscule-Petite : –2 DR Man, –1 M ; Moyenne-Grande : –1 DR Man ; > Grande : rien). Dégagement = Test étendu **Force Accessible (+20)** pour 10 DR. `MDG 13 l.481-491`

**Rochers et bas-fonds** : Rocher moyen IC **47**, 20 % de chance d'*Échouer* ; Bas-fonds IC **10**, 40 % de chance d'*Échouer*. `MDG 13 l.493-499`

**Voir aussi :** [Collisions de navires (MDG)](#collisions-de-navires-mdg), [Détroits et tourbillons (MDG)](#détroits-et-tourbillons-mdg).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `MDG 13` (l.467-499) → `sea-perils`, `iceberg`, `SeaHazardDef`, `debris-marins`, `resolveCollision`, `rocher`, `pickSeaHazard`, `bas-fonds`, `strandingPenalty`, `faible`, +11 — `src/data/schemas/defs/sea-perils.ts`, `src/data/sea-perils.json`, `src/data/voyage-stakes.json`, `src/engine/collision.ts`, `src/engine/seaPerils.ts`, `src/i18n/messages/fr.ts`, +2 fichiers

---

## Détroits et tourbillons (MDG)

**Source :** MDG 13 l.501-564

**Détroits** : zones de fort courant, dotées d'un M. Le navire est entraîné dans la direction du courant au M du Détroit avant de progresser. Tous les Tests de Navigation y subissent une pénalité : Détroit Faible (M4) –1 DR, Moyen (M8) –2 DR, Fort (M16) –3 DR. `MDG 13 l.501-511`

**Tourbillons** : caractéristiques M / Zone (distance d'attraction en m, puis longueur de spirale en M) / Man (pénalité) / IC (au centre) / Évasion. Entré dans la Zone, le navire se déplace vers le centre au M du Tourbillon chaque Round ; le Personnage à la barre réussit un Test de Manœuvre pour continuer sa route. Un nageur dans la Zone : **Natation Complexe (–10)** ou commence à se noyer. Au centre, le bateau subit des Dégâts de collision (IC) chaque Round jusqu'à évasion. `MDG 13 l.516-528`

| Tourbillon | M | Zone | Man | IC | Évasion (Test étendu Manœuvre) |
|---|---|---|---|---|---|
| Rotation lente | 2 | 15 m/25 | – | 4 | Accessible (+20), 10 DR |
| Tourbillon | 4 | 30 m/50 | –1 DR | 8 | Intermédiaire (+0), 20 DR |
| Puissant vortex | 6 | 45 m/75 | –1 DR | 12 | Complexe (–10), 25 DR |
| Maelstrom | 8 | 60 m/100 | –2 DR | 20 | Difficile (–20), 35 DR |
| Maelstrom primordial | 10 | 100 m/150 | –2 DR | 50 | Très Difficile (–30), 45 DR |

**Voir aussi :** [Vents (MDG)](#vents-mdg) (Encalminé/courant), [Périls en mer (MDG)](#périls-en-mer-mdg).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `MDG 13` (l.501-564) → `sea-perils`, `iceberg`, `SeaHazardDef`, `debris-marins`, `rocher`, `pickSeaHazard`, `bas-fonds`, `faible`, `strandingOccurs`, `resolveVolley`, +29 — `src/data/reglesOptionnelles.json`, `src/data/schemas/defs/sea-perils.ts`, `src/data/sea-perils.json`, `src/data/vehicles.json`, `src/data/voyage-stakes.json`, `src/engine/seaPerils.ts`, +4 fichiers

---

## Réparer un navire (MDG)

**Source :** MDG 13 l.639-651

Réparation permanente : **Test de Métier (Constructeur de navires)** (ou **Métier (Charpentier)** à **–10**), avec outils et matériaux (planches, poix, toile…). Les Dégâts à la **Coque** ne se réparent définitivement qu'en **cale sèche** ou à quai sec. Un constructeur naval de port répare pour **1 CO par Blessure** restaurée ; chaque Test réussi prend **1d10 heures** et restaure **1d10 Blessures**. Les Norses (coques à clins) ne réparent correctement que coracles, chaloupes, knarrs, langskips et similaires. `MDG 13 l.641-645`

**Réparations temporaires** : sans cale sèche, **Métier (Constructeur de navires/Charpentier)** de **Complexe (–10)** à **Très Difficile (–30)** ; succès = 1 heure, restaure **1d10 Blessures**. Mais le navire fait ensuite un **Test d'Endurance** par jour complet de voyage et à chaque Test de Manœuvre ; chaque échec inflige **1d10–4 Dégâts** (la réparation cède). `MDG 13 l.647-651`

**Voir aussi :** [Salissures de coque (MDG)](#salissures-de-coque-mdg), [Entretien du navire (Activité en mer) (MDG)](#entretien-du-navire-activité-en-mer-mdg), [Tests d'équipage (MDG)](#tests-déquipage-mdg) (Entretien).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `MDG 13` (l.639-651) → `meleeVsHullBE`, `VolleyShot`, `PortView`, `RepairTick`, `sea-navigation`, `voie-d-eau`, `isOutOfAction`, `applyHit`, `GameState` — `src/data/etats.json`, `src/data/sea-navigation.json`, `src/engine/combat.ts`, `src/engine/conditions.ts`, `src/engine/shipBuild.ts`, `src/engine/shipMelee.ts`, +3 fichiers

---

## Tests d'équipage (MDG)

**Source :** MDG 14 l.7-55

Pour un grand vaisseau, remplacer les Tests individuels par un **Test d'équipage** : plusieurs Personnages tiennent des **rôles**, font leur Test individuel, et **tous les DR sont additionnés** (≥ 1 DR = succès ; 0 possible selon le MJ). Un **rôle essentiel** (en italique) compte **double** (ses DR, positifs ou négatifs, sont doublés). Le **Mousse** est le rôle par défaut, mais facultatif si la Compétence est insuffisante. `MDG 14 l.9-19`

Rôles courants : **Capitaine** (Commandement), **Timonier** (Voile), **Vigie** (Perception), **Mousse** (Voile/Ramer), **Navigateur** (Orientation), **Artilleur** (Projectiles (Poudre noire)), **Cuisinier** (Métier (Cuisinier)), **Chirurgien** (Guérison), **Chansonnier** (Divertissement (Chant), peut donner des bonus via la chanson de marin). `MDG 14 l.24-32`

Un Personnage tenant un rôle lance pour tous ceux du même rôle ; si les PJ tiennent les rôles importants, les PNJ ne contribuent pas. Saboteurs : pas de Test, mais **–1 à –5 DR** imposés. **Manque de bras** : cumuler deux rôles = deux jets à **+2 crans de Difficulté** ; sous le minimum d'équipage, **–2 DR** et jamais mieux qu'un Succès Minime (pour les grands navires, par tranche de 10 % d'équipage manquant). `MDG 14 l.39-55`

**Types** (rôle essentiel *en italique*) : Progression (*Capitaine*) ; Progression en Poursuite (*Mousse*) ; Manœuvres (*Timonier*) ; Perception (*Vigie*) ; Orientation (*Navigateur*) ; Affaler les voiles (*Mousse*) ; Extermination des nuisibles (*Mousse* ; test étendu, nid de rats = Intermédiaire (+0)/10 DR ; Ratier en rôle essentiel via Projectiles (Fronde), chat/chien +1 DR) ; **Rude épreuve** (*Cuisinier* ; DR négatifs → réduit le Moral d'autant) ; **Entretien** (*Mousse* ; **–2 DR** s'il remplace Métier (Charpentier/Tailleur)) ; Tir de batterie (*Artilleur*). `MDG 14 l.61-130`

**Voir aussi :** [Moral de l'équipage (MDG)](#moral-de-léquipage-mdg), [Réparer un navire (MDG)](#réparer-un-navire-mdg), [Course-poursuite navale (MDG)](#course-poursuite-navale-mdg).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `MDG 14` (l.7-55, l.61-130) → `ship-criticals`, `paie-genereuse`, `ShipBatteryModal`, `skill`, `progression`, `capitaine-competent`, `doc`, `faveur-de-manann`, `progression-poursuite`, `un-officier-pour-10`, +108 — `src/data/crew-morale.json`, `src/data/crew-test-types.json`, `src/data/etats.json`, `src/data/flow-stakes.json`, `src/data/index.ts`, `src/data/localisation.json`, +26 fichiers

---

## Moral de l'équipage (MDG)

**Source :** MDG 14 l.133-202

Le **Moral** mesure la confiance de l'équipage envers son capitaine ; on peut l'ignorer si la majorité est très investie (ex. PJ ou dévotion fervente). Il débute en général à **75** et est **recalculé une fois par semaine**. `MDG 14 l.135-143`

Modificateurs (extrait) : paie généreuse / capitaine compétent → **+2d10** ; faveur de Manann probable, ≥1 officier pour 10, capitaine vaillant, nourriture > rations, bon présage, paie régulière, relâche à terre → **+1d10** ; manque de bras, pas de port depuis une semaine, mauvais présage, paie irrégulière, eaux non cartographiées, monstre marin vu, biscuits seuls → **–1d10** ; pas de relâche après accostage, eaux hostiles, < 1 officier pour 30, déplaisir de Manann, sous-ration, maladie, capitaine lâche/irrespectueux/incompétent, paie chiche → **–2d10** ; pas de paie, < 1 officier pour 50 → **–3d10**. `MDG 14 l.149-179`

**Effets du Moral** : 101+ → Tests de Commandement du capitaine +2 DR, tous les Tests d'équipage +1 DR ; 76-100 → Commandement +1 DR ; 51-75 → équipage satisfait (1d100 par membre en relâche, ≤04 ne revient pas) ; 50 ou moins → Commandement –1 DR, Tests d'équipage –1 DR, ≤16 ne revient pas en relâche. `MDG 14 l.186-202`

**Voir aussi :** [Tests d'équipage (MDG)](#tests-déquipage-mdg) (Rude épreuve), [Humeur de Manann et événements en mer (MDG)](#humeur-de-manann-et-événements-en-mer-mdg).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `MDG 14` (l.133-202) → `ship-criticals`, `paie-genereuse`, `ShipBatteryModal`, `capitaine-competent`, `faveur-de-manann`, `doc`, `un-officier-pour-10`, `MoraleBand`, `capitaine-vaillant`, `manoeuvre`, +78 — `src/data/crew-morale.json`, `src/data/crew-test-types.json`, `src/data/etats.json`, `src/data/localisation.json`, `src/data/maladies.json`, `src/data/regles.json`, +16 fichiers

---

## Maladies et provisions en mer (MDG)

**Source :** MDG 14 l.204-283

**Maladies** : un symptôme toux/éternuements expose tout le bord ; un malade de peste noire, flux sanglant, courante galopante ou vérole urticante qui boit dans un tonneau d'eau fait un **Test de Résistance Intermédiaire (+0)** (échec = tonneau contagieux ; la petite bière y échappe). `MDG 14 l.206-209`

**Mal de mer** : les elfes y sont immunisés. Sinon : **Résistance Complexe (–10)** au premier voyage, **Résistance Intermédiaire (+0)** par mauvais temps (Vent violent ou plus). Durée : Test **Intermédiaire (+0)** par jour (succès = guéri à vie de cette forme) ou par heure (cause temporaire). Symptômes : malaise, nausée. `MDG 14 l.211-222`

**Scorbut** : pour chaque mois sans nourriture correcte, **Test de Résistance Intermédiaire (+0)** (**Facile (+40)** si soupe de chou fermenté régulière) ; persiste 1d10 jours après reprise de fruits/légumes frais. Symptômes : blessé, intoxication alimentaire, malaise, nausée ; 1 % de perdre une dent/jour. `MDG 14 l.224-234`

**Provisions** : un **Tonneau d'eau douce** = 145 L ; un marin boit 2-3 L/jour. La **petite bière** remplace l'eau (anti-contamination). **Biscuits de mer** évitent la famine mais régime médiocre. Table : Tonneau d'eau douce 8/6 (Enc 9) ; Tonneau de petite bière 11/– ; ration biscuits 1/– ; ration préservée 2/– ; soupe de chou fermenté 3/– ; Boussole 10/– ; Peau de phoque 1 CO 10/– ; Pièces détachées de navire 10/–. `MDG 14 l.242-255`

**Voir aussi :** [Provisions et équipement de navigation (MDG)](#provisions-et-équipement-de-navigation-mdg), [`traumatisme.md`](traumatisme.md#13-faim-et-soif) (Faim et Soif), [`maladies.md`](maladies.md#provisions-et-privations-en-mer--eau-rations-faim-mdg) (rations en mer).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `MDG 14` (l.204-283) → `doc`, `MoraleBand`, `sealskinDR`, `mousse`, `DiseaseDef`, `shipboardSouls`, `SeaVoyageState`, `scenario`, `exposureNight`, `dailyWaterLitres`, +32 — `src/data/crew-morale.json`, `src/data/crew-roles.json`, `src/data/index.ts`, `src/data/maladies.json`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs/crew-roles.ts`, +17 fichiers

---

## Provisions et équipement de navigation (MDG)

**Source :** MDG 14 l.273-302

**Boussole** : les Tests d'**Orientation** bénéficient de **+1 DR**. **Peau de phoque** : +1 DR sur les Tests de Résistance contre l'exposition au froid (mais mitaines = pas d'action de dextérité). **Pièces détachées de navire** : planches, poix, cordes, tissu ; consommées par l'Activité *Entretien du navire*. `MDG 14 l.273-283`

**Mercenaires d'équipage** (coût quotidien / hebdomadaire) : Mousse 3/– (1 CO 4/–), Marin 9/– (3 CO 12/–), Nautonier 3/– (1 CO 4/–), Officier 15/– (5 CO), Mercenaire expérimenté 9/– (3 CO 12/–), Médecin de bord 15/– (5 CO). **Parts de prise** : 50 % propriétaire (ou entretien), 10 % capitaine, 40 % répartis entre l'équipage ; officiers et non-combattants y renoncent souvent. `MDG 14 l.285-302`

**Voir aussi :** [Orientation et phares (MDG)](#orientation-et-phares-mdg), [Maladies et provisions en mer (MDG)](#maladies-et-provisions-en-mer-mdg).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `MDG 14` (l.273-302) → `doc`, `sealskinDR`, `mousse`, `exposureNight`, `genuineExposureFail`, `chirurgien`, `weeklyCrewWageBrass`, `skillDRBonus`, `buildExposureBand`, `crewTalentDR`, +14 — `src/data/crew-roles.json`, `src/data/index.ts`, `src/data/schemas/defs/crew-roles.ts`, `src/data/trappings.json`, `src/engine/crewMorale.ts`, `src/engine/exposure.ts`, +7 fichiers

---

## Longs voyages : résolution et vitesse (MDG)

**Source :** MDG 15 l.3-78

Pour un voyage de plusieurs semaines : on calcule la vitesse moyenne (modifiée par les vents dominants) pour la distance/jour, on suit l'**Humeur de Manann**, un **événement de bord** tous les **1d10 jours** (les jours en mer ne sont pas forcément consécutifs), un **événement de port** dans les **2d10 heures** après accostage, et une **Activité à bord** par semaine complète. `MDG 15 l.11-19`

**Vitesse moyenne** (milles/jour) : M1→18, M2→36, M3→54, M4→72, M5→90, M6→108, M7→126, M8→144, M9→162, M10→180, M11→198, M12→216. La distance/jour suppose un équipage permettant de voguer de nuit ; sinon **÷2**. Chaque DR du Test d'équipage de Navigation modifie la progression du jour d'environ **±10 %**. `MDG 15 l.57-78`

**Longs voyages très rapides** : durée via distance/vitesse ; noter la dizaine de l'Humeur de Manann ; faire un **Test d'équipage de Rude épreuve** ; lancer 1d10 sur le tableau *Voyage rapide* en **–1 par semaine en mer**, **+** dizaine d'Humeur, **+** DR de Rude épreuve. Résultats : ≤0 désastreux (50 % PNJ manquants, 75 % cargaison perdue, –75 % Blessures, 3 Critiques) … 10+ parfait. `MDG 15 l.21-37`

**Voir aussi :** [Humeur de Manann et événements en mer (MDG)](#humeur-de-manann-et-événements-en-mer-mdg), [Commerce maritime (MDG)](#commerce-maritime-mdg), [Tests d'équipage (MDG)](#tests-déquipage-mdg).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `MDG 15` (l.3-78) → `vaincre-stromfels`, `grand-sacrifice`, `coiffe-de-naissance`, `sacrifice-moyen`, `pretre-sans-peche`, `prieres-jouees`, `mannslieb-pleine`, `WorldMapView`, `chat-heureux`, `petit-sacrifice`, +37 — `src/data/activities.json`, `src/data/regles.json`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs-scenes/effets.ts`, `src/data/schemas/defs/sea-events.ts`, `src/data/sea-events.json`, +9 fichiers

---

## Humeur de Manann et événements en mer (MDG)

**Source :** MDG 15 l.81-263

Chaque jour en mer, on tient un **total cumulé d'Humeur de Manann** (chaque modificateur une seule fois, sacrifices non cumulatifs) qui modifie les jets sur le **Tableau des événements de bord** (1d10 jours d'intervalle). `MDG 15 l.83-89`

**Effet sur l'Humeur** (extrait) : vaincre des suivants de Stromfels +3d10 ; grand sacrifice à Manann +5+2d10 ; coiffe de naissance +2d10 ; prêtre de Manann sans Péché +5+1d10 ; prières à chaque quart +5 à +1d10 ; Mannslieb pleine +1d10 ; chat du navire heureux +1d10 ; ciel rouge –5 ; chapeau perdu par-dessus bord –5 ; voyage commencé un Festag –1d10 ; cargaison de bananes –1d10 ; invoquer d'autres dieux que Manann –(5+1d10) ; insulter la mer –2d10 ; tuer un albatros –(5+2d10) ; invoquer les Puissances de la Ruine/Stromfels –5d10. `MDG 15 l.99-124`

**Événements de bord** (d100 modifié par l'Humeur, extrait) : ≤–65 Triton ; –60/–64 Maelstrom ; –50/–53 Ouragan (Test d'équipage **Affaler les voiles Difficile (–20)** sinon 3 Critiques au Gréement) ; –35/–39 Bateau endommagé (Critique aléatoire) ; –6/–10 Infestation de rats (Test étendu Extermination Intermédiaire (+0)/10 DR) ; 00/05 Collision soudaine ; 06/09 crabes boxeurs (–1 M, –1 DR Man) ; 48/80 Navigation ordinaire ; 96/98 Rafale de Ghyran (+2 DR Focalisation (Ghyran)/Guérison/Résistance) ; 131/134 Vents favorables (+1 M). `MDG 15 l.134-236`

**Événements d'escale au port** (2d10, ±1 selon Humeur, extrait) : 1 Embrigadement ; 2 Prêtre de Manann ; 3 Contrôle à quai (10 % de douane) ; 4 Tempête ; 9-12 Pas d'événement ; 13 Constructeur de navires itinérant ; 17 Rumeurs commerciales ; 18 Fête de Manann (+2d10 Humeur). `MDG 15 l.129, l.243-263`

**Voir aussi :** [Longs voyages : résolution et vitesse (MDG)](#longs-voyages--résolution-et-vitesse-mdg), [Moral de l'équipage (MDG)](#moral-de-léquipage-mdg).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `MDG 15` (l.81-263) → `ShoreLeaveBody`, `ManannBody`, `vaincre-stromfels`, `SeaActivitiesModal`, `portProfileSchema`, `grand-sacrifice`, `openEmbrigadementRecovery`, `coiffe-de-naissance`, `EscaleTab`, `sacrifice-moyen`, +127 — `src/data/activities.json`, `src/data/regles.json`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs-scenes/effets.ts`, `src/data/schemas/defs-scenes/scene.ts`, `src/data/schemas/defs-scenes/worldmap.ts`, +21 fichiers

---

## Activités en mer (MDG)

**Source :** MDG 15 l.266-306

Pour chaque **semaine (8 jours)** en mer, chaque Personnage peut faire une Activité (hors *Argent à gaspiller*, *Avec le pouvoir*, *Amélioration elfique*). Activités autorisées : Apprentissage particulier, Artisanat, Entraînement, Entraînement au combat, Invention !, Recherche de savoir, Semer la dissension, et les Activités d'entraînement d'*Aux Armes !*. *Semer la dissension* réussie contre les officiers → **–2d10 Moral**. `MDG 15 l.268-272`

- **Commerce d'opportunité** : investir jusqu'à la valeur d'Enc disponible en CO ; **Test étendu Marchandage Complexe (–10)**, 10 DR, 3 tentatives ; Échec de 6 DR = tout perdu, Échec = ½, Succès = +10 %, Succès de 6 DR = +20 %. `MDG 15 l.274-286`
- **Cartographie** : **Métier (Cartographe) Complexe (–10)** entre deux ports ; succès = carte valant en CO le nombre de DR et **+2 DR** d'Orientation entre ces ports. `MDG 15 l.288-292`
- **Entraînement d'équipage** : **Commandement Difficile (–20)** + Test **Difficile (–20)** dans la Compétence ; succès = +DR du Commandement à la Compétence de l'équipage (plafonné à ses propres Augmentations ; seuls les PNJ progressent), 2 pistoles/membre. `MDG 15 l.294-300`

**Entretien du navire** (Activité) : voir topic dédié. `MDG 15 l.302-306`

**Voir aussi :** [Entretien du navire (Activité en mer) (MDG)](#entretien-du-navire-activité-en-mer-mdg), [Commerce maritime (MDG)](#commerce-maritime-mdg), [`deplacement.md`](deplacement.md#activités-de-voyage-1-par-étape) (Activités de Voyage EDOC).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `MDG 15` (l.266-306) → `SeaActivitiesModal`, `BankDeposit`, `doc`, `SEA_WEEK_DAYS`, `commerce`, `minimum-vital`, `sea-cargo`, `sea-embrigadement-ragot`, `port-buy-bargain`, `sea-embrigadement-discretion`, +30 — `src/data/combat-stakes.json`, `src/data/regles.json`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs/sea-cargo.ts`, `src/data/schemas/defs/trappings.ts`, `src/data/sea-cargo.json`, +11 fichiers

---

## Entretien du navire (Activité en mer) (MDG)

**Source :** MDG 15 l.302-306

Activité de réparation/usure, de préférence au port. En mer : **–20** supplémentaire ; vastes installations de chantier : **+20**. **Test de Métier (Charpentier *ou* Constructeur de navires) Intermédiaire (+0)** : succès = dépenser des pièces détachées de navire (Enc = Taille du navire) et retirer l'événement *Usure*. Réparer des Blessures : **2 Enc de pièces détachées pour 5 Blessures** restaurées. Réparer une **Blessure Critique** : **Métier Difficile (–20)** + pièces détachées et bois (Enc = Taille du navire). `MDG 15 l.304-306`

**Voir aussi :** [Réparer un navire (MDG)](#réparer-un-navire-mdg), [Salissures de coque (MDG)](#salissures-de-coque-mdg), [Tests d'équipage (MDG)](#tests-déquipage-mdg) (Entretien).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `MDG 15` (l.302-306) → `SeaActivitiesModal`, `BankDeposit`, `commerce`, `minimum-vital`, `sea-cargo`, `port-buy-bargain`, `bankWithdrawOutcome`, `activites-en-mer`, `bankWithdrawInner`, `GameState`, +2 — `src/data/combat-stakes.json`, `src/data/regles.json`, `src/data/schemas/defs/sea-cargo.ts`, `src/data/sea-cargo.json`, `src/engine/activities.ts`, `src/i18n/messages/fr.ts`, +5 fichiers

---

## Commerce maritime (MDG)

**Source :** MDG 15 l.309-436

Deux actes : **acheter** une cargaison, la **vendre** ailleurs. Chaque port a une **Production**, un **Surplus** (toujours produit) et une **Demande** (toujours acheté).

**Acheter** (3 étapes) : (1) type via colonnes Production/Surplus, ou cargaison aléatoire si « commerce » ; (2) taille = (Taille + Richesse du Lieu + Surplus) × **1d10×10** Enc (un 1 = rien) ; (3) prix = Enc × prix de base, puis **Test opposé de Marchandage** (±10 %, ±20 % avec *Négociateur*). Marchandage d'un commerçant = 3d10+40 (3d10+55 à Marienburg/Lothern). Acheter moins que disponible ou un Surplus → +1 DR au vendeur. `MDG 15 l.315-349`

**Vendre** : (1) trouver un acheteur via 1d100 ≤ nombre visé = (Taille + Demande)×10 (+30 si « commerce ») ; ne pas produire la cargaison facilite la vente, la produire (–2 DR Marchandage) ou en Surplus (–3 DR) la complique. (2) **Prix d'offre** selon Richesse+Taille+Demande : 1 → –50 %, 2 → –25 %, 3 → –10 %, 4+ → prix de base ; puis Test opposé de Marchandage. En dernier recours : ¼ du prix de base là où il y a « commerce » ou Demande. `MDG 15 l.355-399`

**Cargaisons aléatoires** (1d100 par saison) et **prix de base** par saison : Céréales, Armes, Produits de luxe, Métaux, Bois, Vin (3d10), Laine, Sel, Huile, Poisson salé, Pièces détachées de navire. Prix en CO par point d'Enc. `MDG 15 l.404-436`

**Distances** entre ports (milles, ≥10 milles de la côte) et **Index des ports** (Taille, Richesse, Production, Surplus, Demande) figurent dans le chapitre. `MDG 15 l.40-47, l.439-507`

**Voir aussi :** [Longs voyages : résolution et vitesse (MDG)](#longs-voyages--résolution-et-vitesse-mdg), [Activités en mer (MDG)](#activités-en-mer-mdg) (Commerce d'opportunité), [`merchantFlow.ts`](../../../src/state/merchantFlow.ts) (Marchandage).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `MDG 15` (l.40-47, l.309-436) → `BandeOuverte`, `SeaActivitiesModal`, `l-anguille`, `doc`, `PORT_PRODUITS`, `cereales`, `portProfileSchema`, `PortHeader`, `MapPlace`, `CargoMarkerDef`, +73 — `src/data/combat-stakes.json`, `src/data/index.ts`, `src/data/naval-ports.json`, `src/data/regles.json`, `src/data/schemas/defs-scenes/worldmap.ts`, `src/data/schemas/defs/naval-ports.ts`, +27 fichiers

