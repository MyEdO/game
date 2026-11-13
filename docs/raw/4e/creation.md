# Atlas RAW — Création de Personnage

> Référentiel autosuffisant des règles WFRP4 (RAW). Chaque règle cite `LDB NN l.X` (source = dernier recours). Voir [`sources.md`](../sources.md), [`00-index.md`](00-index.md).
> Les champs **Implémente** référencent le [rapport calculé](../implemente.generated.md) (`npm run raw:implemente`).

Ce fichier couvre le **processus complet de création de Personnage** (étapes 1 à 9 du LDB 04/05) avec toutes les tables verbatim. Il renvoie à [`carrieres.md`](carrieres.md) pour le contenu des Carrières (schémas, compétences/talents par niveau), à [`competences.md`](competences.md) et [`talents.md`](talents.md) pour leurs définitions, et à [`avancement.md`](avancement.md) pour la dépense des PX bonus obtenus à la création.

---

## Sommaire

- [Résumé des 9 étapes](#résumé-des-9-étapes)
- [Étape 1 — Race (Espèce)](#étape-1--race-espèce)
- [Étape 2 — Classe et Carrière](#étape-2--classe-et-carrière)
- [Étape 3 — Attributs (Caractéristiques, Blessures, Destin/Résilience, Mouvement)](#étape-3--attributs)
- [Étape 4 — Compétences et Talents](#étape-4--compétences-et-talents)
- [Étape 5 — Possessions de départ](#étape-5--possessions-de-départ)
- [Étape 6 — Détails supplémentaires (âge, taille, yeux, cheveux, ambitions)](#étape-6--détails-supplémentaires)
- [Étape 7 — Groupe](#étape-7--groupe)
- [Étape 8 — Insuffler la Vie](#étape-8--insuffler-la-vie)
- [Étape 9 — Progression (dépense des PX bonus)](#étape-9--progression)
- [Supplément Middenheim — 3 origines humaines](#supplément-middenheim--3-origines-humaines)
- [Supplément ADE I — Nouvelles Carrières de départ](#supplément-ade-i--nouvelles-carrières-de-départ)
- [Suppléments AA et VDM — Seconds jets de Carrière](#suppléments-aa-et-vdm--seconds-jets-de-carrière)
- [Option 100 Points (création par points)](#option-100-points)
- [Prétirés officiels — fiches imprimées](#prétirés-officiels--fiches-imprimées)
- [Sources RAW](#sources-raw)
- [Voir aussi](#voir-aussi)
- [Implémenté](#implémenté)

---

## Résumé des 9 étapes

> « Suivez les neuf étapes suivantes pour créer votre Personnage. »
> — LDB 04 l.63-82

| # | Étape | PX bonus possibles |
|---|-------|--------------------|
| 1 | Race | +20 PX (résultat aléatoire conservé) |
| 2 | Classe et Carrière | +50 PX (1er jet accepté) ou +25 PX (1 des 3 jets) |
| 3 | Attributs | +50 PX (2d10 gardés tels quels) ou +25 PX (réassignés) |
| 4 | Compétences et Talents | — (choix dans la liste Race + Carrière N1) |
| 5 | Possessions | — |
| 6 | Détails supplémentaires | — |
| 7 | Groupe | — |
| 8 | Insuffler la vie | — |
| 9 | Progression (dépense PX bonus) | — |

**Sources RAW :** `LDB 04 l.56-82`

---

## Étape 1 — Race (Espèce)

> « Votre Personnage sera un humain, un nain, un halfling, un haut elfe ou un elfe sylvain. Sinon, vous pouvez lancer un d100, consulter le Tableau des Races aléatoires, et gagner 20 PX si vous acceptez le premier résultat. »
> — LDB 04 l.91

### Tableau des Races aléatoires (verbatim)

`LDB 04 l.95-101`

| 1d100 | Race |
|-------|------|
| 01–90 | Humain |
| 91–94 | Halfling |
| 95–98 | Nain |
| 99 | Haut Elfe |
| 00 | Elfe Sylvain |

### Tableau des Races aléatoires avec le Gnome (verbatim)

`NADJ 14 l.66-75` (folio 87) — race jouable sous la règle optionnelle `creation-gnome-jouable` (`NADJ 14 l.5`).

| 1D100 | Race |
|-------|------|
| 01-89 | Humain |
| 90-93 | Halfling |
| 94-97 | Nain |
| 98 | Gnome |
| 99 | Haut elfe |
| 00 | Elfe sylvain |

### Tableau des Races aléatoires avec l'Ogre

`ADE II 02 l.112-121` (folio 18) — race jouable sous la règle optionnelle `creation-ogre-jouable` (`ADE II 02 l.110`).
La VF imprime la seule colonne Race (Humain, Halfling, Nain, Ogre, Haut elfe, Elfe sylvain) : la colonne 1d100
est perdue. Bornes prises à la VO, nombres seuls (`Archives of the Empire - Vol II/04 - Grabbing a Bite- Ogre
Player Characters.md` l.94-97) : 01-89 / 90-93 / 94-97 / 98 / 99 / 00.

### Table maison avec le Gnome et l'Ogre

Aucun livre n'imprime la table des deux races. Valeur `maison` (`src/data/especes-aleatoires.json ›
races-gnome-et-ogre`) : NADJ 14 l.70 et la VO d’ADE II (« Grabbing a Bite », l.95) ôtent chacun 1 valeur à la seule plage Humain
(LDB 04 l.97 : 01-90 → 01-89) pour leur race ; Halfling et Nain gardent 4 valeurs chacun et se décalent. Avec
les deux races, Humain cède 2 valeurs : 01-88 Humain / 89-92 Halfling / 93-96 Nain / 97 Gnome / 98 Ogre /
99 Haut elfe / 00 Elfe sylvain.

Une rangée désigne une race : le joueur y choisit l'espèce (variante régionale, clan) et garde les +20 PX
(`LDB 04 l.91` ; `ADE I 02 l.257`).

**Bonus PX :** +20 PX si le résultat aléatoire est conservé. `LDB 04 l.91`

---

## Étape 2 — Classe et Carrière

> « Lancez 1d100 sur le Tableau des Classes et Carrières aléatoires. Si le résultat vous satisfait, conservez-le et gagnez +50 PX. Sinon, faites deux lancers de plus (total 3 choix) ; si l'un convient, gagnez +25 PX. Sinon, choisissez librement sans bonus. »
> — LDB 05 l.210-212

### Tableau des Classes et Carrières aléatoires (verbatim)

`LDB 05 l.213-349`

| Classe | Carrière | Humain | Nain | Halfling | Haut Elfe | Elfe Sylvain |
|--------|----------|--------|------|----------|-----------|--------------|
| CITADINS | Agitateur | 01 | 01–02 | 01–02 | — | — |
| CITADINS | Artisan | 02–03 | 03–08 | 03–07 | 01–03 | 01–05 |
| CITADINS | Bourgeois | 04–06 | 09–14 | 08–10 | 04–05 | — |
| CITADINS | Enquêteur | 07 | 15–16 | 11–12 | 06–07 | — |
| CITADINS | Marchand | 08 | 17–20 | 13–16 | 08–12 | — |
| CITADINS | Mendiant | 09–10 | 21 | 17–20 | — | — |
| CITADINS | Milicien | 11 | 22–24 | 21–22 | 13 | — |
| CITADINS | Ratier | 12–13 | 25 | 23–25 | — | — |
| COURTISANS | Artiste | 14 | 26 | 26–27 | 14 | 06–09 |
| COURTISANS | Conseiller | 15 | 27–28 | 28 | 15–16 | 10–13 |
| COURTISANS | Duelliste | 16 | 29 | — | 17–18 | — |
| COURTISANS | Émissaire | 17 | 30–31 | 29 | 19–21 | 14–20 |
| COURTISANS | Espion | 18 | 32 | 30 | 22–24 | 21–24 |
| COURTISANS | Intendant | 19 | 33–34 | 31–32 | 25–26 | — |
| COURTISANS | Noble | 20 | 35 | — | 27–29 | 25–30 |
| COURTISANS | Serviteur | 21–23 | 36 | 33–38 | — | — |
| GUERRIERS | Cavalier | 24–25 | — | — | 30–33 | 31–35 |
| GUERRIERS | Chevalier | 26 | — | — | 34 | 36–37 |
| GUERRIERS | Garde | 27–28 | 37–39 | 39–40 | 35–36 | 38–39 |
| GUERRIERS | Gladiateur | 29 | 40–42 | 41 | 37–38 | 40–41 |
| GUERRIERS | Prêtre Guerrier | 30 | — | — | — | — |
| GUERRIERS | Soldat | 31–34 | 43–45 | 42–44 | 39–40 | 42–45 |
| GUERRIERS | Spadassin | 35 | 46–48 | — | 41 | — |
| GUERRIERS | Tueur | — | 49–52 | — | — | — |
| ITINÉRANTS | Chasseur de primes | 36 | 53–56 | 45 | 42–44 | 46–47 |
| ITINÉRANTS | Cocher | 37 | 57 | 46–47 | — | — |
| ITINÉRANTS | Colporteur | 38 | 58–59 | 48–49 | — | — |
| ITINÉRANTS | Flagellant | 39–40 | — | — | — | — |
| ITINÉRANTS | Messager | 41 | 60–61 | 50–51 | 45 | 48–50 |
| ITINÉRANTS | Patrouilleur routier | 42 | — | 52 | — | — |
| ITINÉRANTS | Répurgateur | 43 | — | — | — | — |
| ITINÉRANTS | Saltimbanque | 44–45 | 62–63 | 53–55 | 46–48 | 51–55 |
| LETTRÉS | Apothicaire | 46 | 64 | 56 | 49–50 | — |
| LETTRÉS | Érudit | 47–48 | 65–66 | 57–58 | 51–54 | 56 |
| LETTRÉS | Ingénieur | 49 | 67–69 | 59 | — | — |
| LETTRÉS | Juriste | 50 | 70–71 | 60–61 | 55–58 | — |
| LETTRÉS | Médecin | 51 | 72 | 62–63 | 59–60 | — |
| LETTRÉS | Nonne | 52–53 | — | — | — | — |
| LETTRÉS | Prêtre | 54–58 | — | — | — | — |
| LETTRÉS | Sorcier | 59 | — | — | 61–64 | 57–60 |
| RIVERAINS | Batelier | 60–61 | 73–74 | 64 | 65 | — |
| RIVERAINS | Contrebandier | 62 | 75–76 | 65–68 | 66 | — |
| RIVERAINS | Débardeur | 63–64 | 77–78 | 69–71 | — | — |
| RIVERAINS | Femme du fleuve | 65–67 | 79–80 | 72–74 | — | — |
| RIVERAINS | Marin | 68–69 | 81 | 75 | 67–81 | — |
| RIVERAINS | Naufrageur | 70 | 82 | — | — | 61 |
| RIVERAINS | Nautonier | 71 | 83 | 76 | — | — |
| RIVERAINS | Patrouilleur fluvial | 72–73 | — | 77 | — | — |
| ROUBLARDS | Charlatan | 74 | — | 78 | 82–84 | — |
| ROUBLARDS | Entremetteur | 75–76 | — | 79–81 | 85–86 | — |
| ROUBLARDS | Hors-la-loi | 77–80 | 84–86 | 82 | 87–89 | 62–67 |
| ROUBLARDS | Pilleur de tombes | 81 | — | 83 | — | — |
| ROUBLARDS | Rançonneur | 82 | 87 | 84 | — | — |
| ROUBLARDS | Receleur | 83 | 88 | 85 | — | — |
| ROUBLARDS | Sorcier dissident | 84 | — | — | — | — |
| ROUBLARDS | Voleur | 85–87 | 89 | 86–89 | — | — |
| RURAUX | Bailli | 88 | 90–91 | 90 | — | — |
| RURAUX | Chasseur | 89–90 | 92–93 | 91–92 | 90–92 | 68–77 |
| RURAUX | Éclaireur | 91 | 94 | 93 | 93–98 | 78–88 |
| RURAUX | Herboriste | 92 | — | 94–96 | 99–00 | 89–95 |
| RURAUX | Mineur | 93 | 95–99 | 97 | — | — |
| RURAUX | Mystique | 94 | — | — | — | 96–00 |
| RURAUX | Sorcier de village | 95 | — | — | — | — |
| RURAUX | Villageois | 96–00 | 00 | 98–00 | — | — |

**Note :** Un résultat de Race ou de Carrière non disponible (—) : relancer ou choisir librement avec accord du MJ. `LDB 05 l.309-363`

### Classes — description courte

`LDB 05 l.253-357`

- **Citadins** : citoyens respectueux des lois, classe moyenne. Carrières : Agitateur, Artisan, Bourgeois, Enquêteur, Marchand, Mendiant, Milicien, Ratier.
- **Courtisans** : dirigeants et leurs serviteurs spécialisés, statut plus élevé. Carrières : Artiste, Conseiller, Duelliste, Espion, Intendant, Émissaire, Noble, Serviteur.
- **Guerriers** : combattants qualifiés, milieux variés. Carrières : Cavalier, Chevalier, Garde, Gladiateur, Prêtre Guerrier, Spadassin, Soldat, Tueur.
- **Itinérants** : vie sur les routes, majoritairement classe inférieure. Carrières : Chasseur de primes, Cocher, Colporteur, Flagellant, Messager, Patrouilleur routier, Répurgateur, Saltimbanque.
- **Lettrés** : érudits, souvent seuls à savoir lire et écrire. Carrières : Apothicaire, Érudit, Ingénieur, Juriste, Médecin, Nonne, Prêtre, Sorcier.
- **Riverains** : vie sur les rivières et voies navigables, classe inférieure. Carrières : Batelier, Contrebandier, Débardeur, Femme du fleuve, Marin, Naufrageur, Nautonier, Patrouilleur fluvial.
- **Roublards** : activités illégales ou peu recommandables, classe inférieure. Carrières : Charlatan, Entremetteur, Hors-la-loi, Pilleur de tombes, Rançonneur, Receleur, Sorcier dissident, Voleur.
- **Ruraux** : fermes, villages et campagnes, classe inférieure. Carrières : Bailli, Chasseur, Éclaireur, Herboriste, Mineur, Mystique, Sorcier de village, Villageois.

---

## Étape 3 — Attributs

### Détermination des Caractéristiques

> « Lancez 2d10 pour chacune de vos dix Caractéristiques et notez les résultats. »
> — LDB 05 l.337

Trois options, dans l'ordre :

1. **Garder** les 10 résultats tels quels → ajouter les bonus de profil → noter → **+50 PX**. `LDB 05 l.337`
2. **Réassigner** les 10 résultats (changer de Caractéristique, garder les dés) → **+25 PX**. `LDB 05 l.339`
3. **Relancer** ou ignorer les dés → **0 PX**. Option : répartir 100 Points (min 4, max 18 par Caractéristique, avant ajout des bonus). `LDB 05 l.341`

### Tableau des Attributs — profils d'espèce (verbatim)

`LDB 05 l.351-413`

| Attribut | Humain | Nain | Halfling | Elfe (Haut + Sylvain) |
|----------|--------|------|----------|-----------------------|
| Capacité de Combat (CC) | 2d10+20 | 2d10+30 | 2d10+10 | 2d10+30 |
| Capacité de Tir (CT) | 2d10+20 | 2d10+20 | 2d10+30 | 2d10+30 |
| Force (F) | 2d10+20 | 2d10+20 | 2d10+10 | 2d10+20 |
| Endurance (E) | 2d10+20 | 2d10+30 | 2d10+20 | 2d10+20 |
| Initiative (I) | 2d10+20 | 2d10+20 | 2d10+20 | 2d10+40 |
| Agilité (Ag) | 2d10+20 | 2d10+10 | 2d10+20 | 2d10+30 |
| Dextérité (Dex) | 2d10+20 | 2d10+30 | 2d10+30 | 2d10+30 |
| Intelligence (Int) | 2d10+20 | 2d10+20 | 2d10+20 | 2d10+30 |
| Force Mentale (FM) | 2d10+20 | 2d10+40 | 2d10+30 | 2d10+30 |
| Sociabilité (Soc) | 2d10+20 | 2d10+10 | 2d10+30 | 2d10+20 |
| Points de Blessures | BF+(2×BE)+BFM | BF+(2×BE)+BFM | (2×BE)+BFM | BF+(2×BE)+BFM |
| Points de Destin | 2 | 0 | 0 | — (voir p. 0) |
| Résilience | 1 | 2 | 2 | — (voir p. 0) |
| Points supplémentaires | 3 | 2 | 3 | — (voir p. 2) |
| Mouvement (M) | 4 | 3 | 3 | — (voir p. 5) |

**Note :** Les Hauts Elfes et Elfes Sylvains partagent le même profil de Caractéristiques (colonne Elfe). Les valeurs de Destin, Résilience et Mouvement des elfes sont renvoyées aux pages correspondantes du LDB car non imprimées dans ce tableau.

**Blessures (B) :** `BF + (2 × BE) + BFM` ; les halflings ont automatiquement le Talent **Petit** et débutent avec moins de Points de Blessure. `LDB 05 l.418`

**Bonus de Caractéristique (BC) :** premier chiffre de la dizaine. Exemple : F 39 → BF 3. `LDB 05 l.406-444`

### Destin et Résilience

> « Vous commencez avec une valeur de base pour le Destin et la Résilience, puis vous disposez d'un nombre de Points supplémentaires à répartir entre ces Attributs comme bon vous semble. »
> — LDB 05 l.426-458

- **Chance de départ** = valeur de Destin. **Détermination de départ** = valeur de Résilience. `LDB 05 l.430`
- **Motivation** : un mot ou une phrase résumant ce pour quoi le Personnage vit. Utilisée pour regagner des Points de Détermination. `LDB 05 l.433-476`

### Mouvement

| M | Marche | Charge |
|---|--------|--------|
| 3 | 6 | 12 |
| 4 | 8 | 16 |
| 5 | 10 | 20 |

`LDB 05 l.451-485` — voir [`deplacement.md`](deplacement.md) pour l'usage en jeu.

### Augmentations de Caractéristique gratuites (à la création)

> « Consultez votre Carrière au **Chapitre 3 : Classes et Carrières**. Recherchez dans le Schéma de progression les trois Caractéristiques marquées […] sans bordure bronze, argent ou or. Vous pouvez répartir comme bon vous semble un total de 5 Augmentations entre les Caractéristiques […] »
> — LDB 05 l.459

`LDB 05 l.459-463` — les 5 Augmentations initiales s'ajoutent à la valeur après tirage 2d10+bonus.

---

## Étape 4 — Compétences et Talents

### Compétences et Talents liés à la Race

> « Vous pouvez sélectionner 3 Compétences auxquelles ajouter 5 Augmentations à chacune, et 3 Compétences auxquelles ajouter 3 Augmentations à chacune. »
> — LDB 05 l.484

`LDB 05 l.483-553`

#### Humains (Reiklanders)
**Compétences :** Calme, Charme, Commandement, Corps à corps (Base), Évaluation, Langue (bretonnien), Langue (wastelander), Marchandage, Projectiles (Arc), Ragot, Savoir (Reikland), Soin aux animaux.
**Talents :** Affable *ou* Perspicace, Destinée, 3 Talents aléatoires.

#### Nains
**Compétences :** Calme, Corps à corps (Base), Divertissement (Narration), Évaluation, Intimidation, Langue (khazalid), Métier (un au choix), Résistance, Résistance à l'alcool, Savoir (Géologie), Savoir (Métallurgie), Savoir (Nains).
**Talents :** Costaud, Déterminé *ou* Obstiné, Lire/Écrire *ou* Impitoyable, Résistance à la Magie, Vision nocturne.

#### Halflings
**Compétences :** Charme, Discrétion (au choix), Escamotage, Esquive, Intuition, Langue (halfling), Marchandage, Métier (Cuisinier), Pari, Perception, Résistance à l'alcool, Savoir (Reikland).
**Talents :** Petit, Résistance (Corruption), Sens aiguisé (Goût), Vision nocturne, 2 Talents aléatoires.

#### Hauts Elfes
**Compétences :** Calme, Commandement, Corps à corps (Base), Divertissement (Chant), Évaluation, Musicien (un instrument au choix), Langue (elthàrin), Natation, Orientation, Perception, Projectiles (Arc), Voile.
**Talents :** Lire/Écrire, Imperturbable *ou* Perspicace, Sens aiguisé (Vue), Seconde vue *ou* Sixième sens, Vision nocturne.

#### Elfes Sylvains
**Compétences :** Athlétisme, Corps à corps (Base), Discrétion (Rurale), Divertissement (Chant), Escalade, Intimidation, Langue (elthàrin), Perception, Pistage, Projectiles (Arc), Résistance, Survie en extérieur.
**Talents :** Dur à cuire *ou* Seconde vue, Lire/Écrire *ou* Très résistant, Nomade, Sens aiguisé (Vue), Vision nocturne.

### Tableau des Talents aléatoires (verbatim)

`LDB 05 l.514-543`

| Lancer | Talent | Lancer | Talent |
|--------|--------|--------|--------|
| 01–03 | Affable | 53–55 | Linguistique |
| 04–06 | Affinité avec les animaux | 56–58 | Lire/Écrire |
| 07–09 | Ambidextre | 59–61 | Maître artisan (un au choix) |
| 10–13 | Âme pure | 62–63 | Noblesse |
| 14–16 | Artiste | 64–66 | Oreille absolue |
| 17–19 | Attirant | 67–69 | Perspicace |
| 20–22 | Bonnes jambes | 70–72 | Réflexes foudroyants |
| 23–26 | Chanceux | 73–75 | Résistance (une au choix) |
| 27–29 | Costaud | 76–78 | Sens aiguisé (un au choix) |
| 30–32 | Doigts de fée | 79–81 | Sens de l'orientation |
| 33–36 | Doué en calcul | 82–85 | Sixième sens |
| 37–40 | Dur à cuire | 86–88 | Tireur de précision |
| 41–43 | Fuite ! | 89–91 | Très fort |
| 44–46 | Guerrier né | 92–94 | Très résistant |
| 47–49 | Imitation | 95–97 | Vision nocturne |
| 50–52 | Imperturbable | 98–00 | Vivacité |

> « Si vous tombez sur un Talent que vous possédez déjà, vous pouvez relancer. » `LDB 05 l.484`

### Compétences et Talents de Carrière

> « Vous commencez au premier niveau de Carrière listé sur votre Évolution de Carrière. Il y a 8 Compétences et 4 Talents répertoriés à ce niveau, et vous pouvez choisir ceux qui vous conviennent le mieux. Répartissez 40 Points d'Augmentations entre vos huit Compétences de départ, sans dépasser plus de 10 Points alloués à une seule Compétence à ce stade. […] Vous pouvez aussi choisir un unique Talent à apprendre. »
> — LDB 05 l.535

`LDB 05 l.534-553`

**Règle Magie mineure à la création :** si le Personnage possède le Talent Magie mineure (Sorcier N1, etc.), il mémorise un nombre de sorts égal à son BFM au départ. `LDB 10 l.714` (voir aussi `src/noyau/creation/brouillon.ts`, `pettySpellQuota`)

---

## Étape 5 — Possessions de départ

### Possessions par Classe

`LDB 05 l.554-573`

- **Citadins :** cape, vêtements, dague, chapeau, bourse, besace (déjeuner).
- **Courtisans :** costume luxueux, dague, bourse (pince à épiler, cure-oreilles, peigne).
- **Guerriers :** vêtements, arme simple, dague, bourse.
- **Itinérants :** cape, vêtements, dague, bourse, sac à dos (boîte à amadou, couverture, rations 1 jour).
- **Lettrés :** vêtements, dague, bourse, besace (nécessaire d'écriture, 1d10 feuilles de parchemin).
- **Riverains :** cape, vêtements, dague, bourse, besace (flasque d'alcool).
- **Roublards :** vêtements, dague, bourse, besace (2 bougies, 1d10 allumettes, capuchon *ou* masque).
- **Ruraux :** cape, vêtements, dague, bourse, besace (rations 1 jour).

### Possessions de Carrière (Niveau 1)

Voir le **Chapitre 3 : Classes et Carrières** pour les possessions spécifiques à chaque Carrière au Niveau 1. `LDB 05 l.569-576`

### Richesse initiale

> « Découvrez le Statut de votre Personnage (Bronze, Argent ou Or, avec un numéro appelé Standing). Multipliez votre Standing par la Richesse initiale. »
> — LDB 05 l.574-583

`LDB 05 l.578-583`

| Statut | Richesse initiale |
|--------|-------------------|
| Bronze | 2d10 sous de cuivre × Standing |
| Argent | 1d10 pistoles d'argent × Standing |
| Or | 1 couronne d'or × Standing |

**Exemple :** Bronze 3 = 6d10 sous de cuivre ; Argent 3 = 3d10 pistoles d'argent ; Or 3 = 3 couronnes d'or.

---

## Étape 6 — Détails supplémentaires

### Âge

`LDB 05 l.705-711`

> « L'espérance de vie moyenne pour un humain est d'environ 60 ans, 120 pour les halflings, et plus de 200 pour un nain. Les elfes ne semblent pas vieillir et sont réputés vivre un millier d'années ou plus. »

| Race | Formule |
|------|---------|
| Humain | 15 + 1d10 |
| Nain | 15 + 10d10 |
| Elfe (Haut / Sylvain) | 30 + 10d10 |
| Halfling | 15 + 5d10 |

### Taille

`LDB 05 l.722-728`

> « Les tailles moyennes sont : nain (1,45 mètre), elfe (1,90 mètre), halfling (1 mètre). Les humains ont des tailles qui varient beaucoup plus, se situant dans une moyenne de 1m75 dans le Reikland. Si vous voulez une taille vraiment aléatoire pour les humains, si l'un des dés obtient un 10, lancez un dé supplémentaire et ajoutez le résultat à la hauteur totale. »

| Race | Formule |
|------|---------|
| Humain | 145 + 5d10 cm |
| Nain | 130 + 3d10 cm |
| Elfe (Haut / Sylvain) | 180 + 2d10 cm |
| Halfling | 90 + 2d10 cm |

### Couleur des Yeux (verbatim)

`LDB 05 l.742-754`

> Note : les elfes lancent **deux fois** (yeux bigarrés par leur nature magique).

| 2d10 | Humain Reiklander | Nain | Halfling | Haut Elfe | Elfe Sylvain |
|------|------------------|------|----------|-----------|--------------|
| 2 | Au choix | Houille | Gris clair | Jais | Ivoire |
| 3 | Vert | Plomb | Gris | Améthyste | Anthracite |
| 4 | Bleu pâle | Acier | Bleu pâle | Aigue-marine | Vert lierre |
| 5–7 | Bleu | Bleu | Bleu | Saphir | Vert mousse |
| 8–11 | Gris pâle | Brun terre | Vert | Turquoise | Châtaigne |
| 12–14 | Gris | Marron foncé | Noisette | Émeraude | Châtaigne |
| 15–17 | Marron | Noisette | Marron | Ambre | Marron foncé |
| 18 | Noisette | Vert | Cuivre | Cuivre | Ocre |
| 19 | Marron foncé | Cuivre | Marron foncé | Citrine | Châtain clair |
| 20 | Noir | Or | Marron foncé | Or | Violet |

### Couleur des Cheveux (verbatim)

`LDB 05 l.756-768`

> Toutes les races (sauf elfes) voient leur chevelure grisonner avec l'âge. Les elfes paraissent éternellement jeunes.

| 2d10 | Humain Reiklander | Nain | Halfling | Haut Elfe | Elfe Sylvain |
|------|------------------|------|----------|-----------|--------------|
| 2 | Blond blanc | Blanc | Gris | Argent | Bouleau argenté |
| 3 | Blond doré | Gris | Paille | Blanc | Blond cendré |
| 4 | Blond roux | Blond pâle | Roussâtre | Blond pâle | Or rose |
| 5–7 | Brun doré | Doré | Miel | Blond | Blond miel |
| 8–11 | Brun clair | Cuivre | Châtaigne | Blond intense | Brun |
| 12–14 | Brun foncé | Bronze | Gingembre | Blond cuivré | Brun acajou |
| 15–17 | Noir | Brun | Moutarde | Blond ambré | Brun foncé |
| 18 | Auburn | Brun foncé | Amande | Auburn | Brun clair |
| 19 | Roux | Brun roux | Chocolat | Roux | Ébène |
| 20 | Gris | Noir | Réglisse | Noir | Noir bleuté |

### Ambitions

> « Tous les Personnages ont une Ambition à court terme et une Ambition à long terme. »
> — LDB 05 l.732

- **Court terme :** objectif en quelques jours ou semaines (≥ 2–3 sessions). Réalisé → **+50 PX**. `LDB 05 l.738-740, 795`
- **Long terme :** objectif de plusieurs mois ou années. Réalisé → **+500 PX** ou retraite du Personnage. `LDB 05 l.779-781, 799-800`
- **Ambitions de groupe** : court terme réalisé → **+50 PX chacun** ; long terme réalisé → **+500 PX chacun**. `LDB 05 l.810-812, 837, 841`

---

## Étape 7 — Groupe

`LDB 05 l.785-810`

Concerter les histoires, raisons de se connaître, ambitions communes. Voir LDB 05 pour les exemples. Pas de mécanique de création propre à cette étape.

---

## Étape 8 — Insuffler la Vie

`LDB 05 l.855-867`

Questions de background : origines, famille, enfance, amis, désirs, croyances, loyautés. Pas de mécanique de création ; peut conduire à réviser les choix d'étapes antérieures.

---

## Étape 9 — Progression

> « La dernière étape de la création de votre Personnage consiste à dépenser les bonus de PX que vous avez potentiellement gagnés pendant le processus de création. Dans un premier temps, vous pouvez seulement dépenser vos PX pour augmenter les 3 Caractéristiques, 8 Compétences et 4 Talents disponibles dans votre niveau de Carrière. »
> — LDB 05 l.907

`LDB 05 l.906-907` — voir [`avancement.md`](avancement.md) pour les coûts complets (table verbatim).

---

## Option 100 Points

> « Si vous n'êtes toujours pas satisfait de vos résultats, ignorez tout simplement les dés ! Répartissez comme bon vous semble 100 Points entre les 10 Caractéristiques, avec un minimum de 4 et un maximum de 18 Points alloués à chaque Caractéristique. Ajoutez les bonus du Tableau des Attributs. Il n'y a pas de bonus de PX. »
> — LDB 05 l.341

`LDB 05 l.341` — c'est l'équivalent de relancer, sans bonus PX.

---

## Supplément Middenheim — 3 origines humaines

Source : **Middenheim : la Cité du Loup Blanc**, Annexe II, pages PDF 151–157 (`Middenheim ANNEXE II l.1-311`).

Les personnages originaires du **nord de l'Empire** (Middenheim, Middenland, Nordland) n'ont pas accès aux mêmes Compétences et Talents que les Reiklanders à la création. Même répartition : 3 Compétences +5 Augmentations chacune, 3 Compétences +3 Augmentations chacune. `Middenheim ANNEXE II l.6`

### Tableau des Classes et Carrières — Origines nordiques (verbatim)

`Middenheim ANNEXE II l.13-164`

| Classe | Carrière | Middenheimer | Middenlander | Nordlander |
|--------|----------|--------------|--------------|------------|
| LETTRÉS | Apothicaire | 01 | 01 | 01 |
| LETTRÉS | Ingénieur | 02 | 02 | 02 |
| LETTRÉS | Juriste | 03 | 03 | 03 |
| LETTRÉS | Nonne | 04–05 | 04–05 | 04–05 |
| LETTRÉS | Médecin | 06 | 06 | 06 |
| LETTRÉS | Prêtre | 07–11 | 07–11 | 07–10 |
| LETTRÉS | Érudit | 12–13 | 12–13 | 11–12 |
| LETTRÉS | Sorcier | 14 | 14 | 13 |
| CITADINS | Agitateur | 15 | 15 | 14 |
| CITADINS | Artisan | 16–18 | 16–17 | 15–16 |
| CITADINS | Mendiant | 19–21 | 18–19 | 17–18 |
| CITADINS | Enquêteur | 22 | 20 | 19 |
| CITADINS | Marchand | 23–24 | 21 | 20 |
| CITADINS | Ratier | 25–26 | 22–23 | 21–22 |
| CITADINS | Bourgeois | 27–28 | 24–26 | 23–24 |
| CITADINS | Milicien | 29–31 | 27 | 25 |
| COURTISANS | Conseiller | 32 | 28 | 26 |
| COURTISANS | Artiste | 33 | 29 | 27 |
| COURTISANS | Duelliste | 34 | 30 | 28 |
| COURTISANS | Émissaire | 35 | 31 | 29 |
| COURTISANS | Noble | 36 | 32 | 30 |
| COURTISANS | Serviteur | 37–39 | 33–35 | 31–33 |
| COURTISANS | Espion | 40 | 36 | 34 |
| COURTISANS | Intendant | 41 | 37 | 35 |
| RURAUX | Bailli | 42 | 38 | 36 |
| RURAUX | Sorcier de village | 43 | 39 | 37 |
| RURAUX | Herboriste | 44 | 40 | 38 |
| RURAUX | Chasseur | 45 | 41–42 | 39–40 |
| RURAUX | Mineur | 46–47 | 43 | 41 |
| RURAUX | Mystique | 48 | 44 | 42 |
| RURAUX | Éclaireur | 49 | 45 | 43 |
| RURAUX | Villageois | 50–54 | 46–50 | 44–48 |
| ITINÉRANTS | Chasseur de primes | 55 | 51 | 49 |
| ITINÉRANTS | Cocher | 56–57 | 52 | 50 |
| ITINÉRANTS | Saltimbanque | 58–60 | 53–54 | 51–52 |
| ITINÉRANTS | Messager | 61 | 55 | 53 |
| ITINÉRANTS | Colporteur | 62–63 | 56 | 54 |
| ITINÉRANTS | Patrouilleur routier | 64 | 57 | 55 |
| ITINÉRANTS | Répurgateur | 65 | 58 | 56 |
| ITINÉRANTS | Frère Loup | 66–68 | 59–60 | 57–58 |
| RIVERAINS | Batelier | — | 61–62 | 59–60 |
| RIVERAINS | Nautonier | — | 63 | 61 |
| RIVERAINS | Patrouilleur fluvial | — | 64–65 | 62–63 |
| RIVERAINS | Femme du fleuve | — | 66–68 | 64–66 |
| RIVERAINS | Marin | — | 69–70 | 67–70 |
| RIVERAINS | Contrebandier | 69 | 71 | 71–72 |
| RIVERAINS | Débardeur | 70–71 | 72–73 | 73–74 |
| RIVERAINS | Naufrageur | — | 74 | 75 |
| ROUBLARDS | Entremetteur | 72–73 | 75–76 | 76–77 |
| ROUBLARDS | Charlatan | 74 | 77 | 78 |
| ROUBLARDS | Receleur | 75–76 | 78 | 79 |
| ROUBLARDS | Pilleur de tombes | 77 | 79 | 80 |
| ROUBLARDS | Hors-la-loi | 78–79 | 80–83 | 81–84 |
| ROUBLARDS | Rançonneur | 80–82 | 84 | 85 |
| ROUBLARDS | Voleur | 83–86 | 85–87 | 86–87 |
| ROUBLARDS | Sorcier dissident | 87 | 88 | 88 |
| GUERRIERS | Cavalier | 88–89 | 89–90 | 89–90 |
| GUERRIERS | Garde | 90–92 | 91–92 | 91–92 |
| GUERRIERS | Chevalier | 93 | 93 | 93 |
| GUERRIERS | Gladiateur | 94 | 94 | 94 |
| GUERRIERS | Spadassin | 95 | 95 | 95 |
| GUERRIERS | Soldat | 96–99 | 96–99 | 96–99 |
| GUERRIERS | Tueur | — | — | — |
| GUERRIERS | Prêtre guerrier | 100 | 100 | 100 |

**Note Frère Loup :** la Carrière Frère Loup est exclusive aux personnages nordiques. Un résultat Flagellant (Middenheimer) peut être remplacé par Frère Loup. Voir section suivante. `Middenheim ANNEXE II l.96`

### Humains de Middenheim

`Middenheim ANNEXE II l.213-218`

**Compétences :** Calme, Charme, Commandement, Corps à corps (Base), Divertissement, Évaluation, Marchandage, Métier (un au choix), Projectiles (Arc), Ragot, Savoir (Middenheim), Subornation.
**Talents :** Destinée, Savoir-vivre (au choix) *ou* Infatigable, 3 Talents aléatoires.

**Spécificité :** les Middenheimers ont toujours le Talent Destinée (accès à l'oratoire de Morr au Morrspark). `Middenheim ANNEXE II l.190`

### Humains du Middenland

`Middenheim ANNEXE II l.241-246`

**Compétences :** Calme, Commandement, Corps à corps (Base), Évaluation, Intimidation, Langue (Wastelander), Marchandage, Projectiles (Arc), Ragot, Savoir (Middenland), Soin aux animaux, Survie en extérieur.
**Talents :** Destinée *ou* Talent aléatoire supplémentaire, Menaçant *ou* Guerrier né, 3 Talents aléatoires.

### Humains du Nordland

`Middenheim ANNEXE II l.266-271`

**Compétences :** Corps à corps (Base), Évaluation, Langue (Norse), Langue (Wastelander), Marchandage, Métier (un au choix), Natation, Projectiles (Arc), Ragot, Résistance à l'alcool, Savoir (Nordland), Voile.
**Talents :** Destinée *ou* Talent aléatoire supplémentaire, Pêcheur *ou* Nomade, Cœur vaillant *ou* Très résistant, 2 Talents aléatoires.

### Carrière : Frère Loup (nordique uniquement)

`Middenheim ANNEXE II l.275-310`

Humain, Bronze 0. Zélotes solitaires d'Ulric, vivent dans la nature, affrontent leurs ennemis en combat individuel. Pas d'uniforme, pas de prédication.

**Alternative Flagellant :** un Personnage qui tombe sur Frère Loup peut à la place choisir de devenir Flagellant. `Middenheim ANNEXE II l.96`

**Schéma de progression :** CC ☐, F ☐, E ☐ (sans bordure de niveau).

**Niveau 1 — Survivant (Bronze 0) :**
Compétences : Calme, Corps à corps (Bagarre), Corps à corps (Base), Escalade, Guérison, Intimidation, Intuition, Résistance, Savoir (Ulric), *Survie en extérieur*.
Talents : Brouet, Charge berserk, Frénésie, Nomade.
Possessions : arme simple, haillons.

**Niveau 2 — Frère Loup (Bronze 0) :**
Compétences : Athlétisme, Discrétion (Rurale), Esquive, Savoir (Bêtes), Savoir (Herbes).
Talents : Dur à Cuire, Endurci, Foulée (au choix), Sens aiguisé (au choix).
Possessions : arme simple, haillons.

**Niveau 3 — Compagnon Loup (Bronze 0) :**
Compétences : Orientation, Perception, Pistage.
Talents : Assaut féroce, Pansement de fortune, Sens de l'orientation, Voyageur aguerri.
Possessions : arme simple, haillons.

**Niveau 4 — Grand Loup (Bronze 0) :**
Compétences : Natation, Soin aux animaux.
Talents : Contrôle de la Frénésie, Effrayant, Ferveur ardente, Sans peur (Hommes-bêtes).
Possessions : arme simple, haillons, respect des autres Frères Loups.

**Règle Carrières plus longues :** certaines Carrières (dont Frère Loup) proposent plus de 8 Compétences au N1 ; il suffit d'en augmenter 8 pour passer au niveau suivant, dont obligatoirement la Compétence pour Gagner de l'argent (italique). `Middenheim ANNEXE II l.93-94`

---

## Noms nains — suffixes patronymiques

`LDB 05 l.627-633`

> « Les noms de famille nains sont basés sur ceux des personnes qui les ont élevés, et les suffixes suivants sont les plus courants : »

| Suffixe | Sens |
|---------|------|
| **–sdottir** | fille de… |
| **–snev** | neveu de… |
| **–sniz** | nièce de… |
| **–sson** | fils de… |

**Exemples :** Ariksson, Grunnasdottir, Skagsnev, Sovrissniz

> « Il est courant, à mesure que les nains vieillissent et accomplissent leurs propres hauts faits, qu'ils adoptent un surnom en fonction de leur apparence physique, leurs prouesses ou leurs actes. Ils sont généralement accordés par consensus de clan, et il est considéré comme déshonorant d'attribuer un nom qui ne représente pas le véritable caractère d'un nain. Si un tel surnom est adopté, il remplace en général le nom de famille. »

**Exemples de surnoms :** Porte-hache, Main habile, Barbe fourchue, Tresse d'acier, Masse rouge, Poing de pierre

**Sources RAW :** `LDB 05 l.623-624`

**Voir aussi :** `talents.md` § Vision nocturne (Talent de départ nain) ; `carrieres.md` § Nains.

**Implémente :** [État calculé](../implemente.generated.md#4ecreationnoms-nains-suffixes-patronymiques)

---

## Supplément ADE I — Nouvelles Carrières de départ

Source : **Les Archives de l'Empire vol. 1**, Annexe I, pages PDF 88–92 (`ADE I ANNEXE I l.1-80`).

Quatre nouvelles Carrières disponibles à la création par remplacement d'un résultat aléatoire du tableau LDB :

| Nouvelle Carrière | Race | Remplace (si résultat aléatoire) |
|-------------------|------|----------------------------------|
| Chevaucheur de Blaireau | Halfling du Mootland | Soldat |
| Gardechamps | Halfling | Patrouilleur routier |
| Patrouilleur des Karak | Nain | Messager |
| Rôdeur Fantôme | Elfe sylvain | Chasseur de primes |

Ces Carrières peuvent aussi être choisies librement à la création. `ADE I ANNEXE I l.6-21`

---

## Suppléments AA et VDM — Seconds jets de Carrière

> « Plusieurs nouvelles Carrières sont proposées dans ce livre. Si vous utilisez les tableaux de Carrières aléatoires des pages 30-31 de **WFJDR** pour générer une Carrière, reportez-vous au tableau suivant pour voir si la Carrière générée offre d'autres options. Si c'est le cas, relancez le dé pour voir si l'une des Carrières de cet ouvrage s'applique à la place. »
> — `AA 02 l.109`

> « Un Joueur peut toujours choisir de conserver la première Carrière générée, donc s'il génère un Colporteur, il peut décider d'en rester là. Mais, il peut aussi tenter de voir s'il peut devenir un suiveur de camp. En outre, les Carrières sont toutes communes à l'Empire, et les joueurs peuvent y accéder en fonction de leur expérience et des circonstances. »
> — `AA 02 l.111`

> « *Exemple : Gerd Braun est un Personnage généré aléatoirement. Lors de son jet de Carrière, Gerd obtient un 98, ce qui signifie qu'il est Soldat. Gerd décide de relancer le dé pour voir de quel type. Son deuxième jet est de 47, donc Gerd est un archer.* »
> — `AA 02 l.113`

### Jet optionnel d'AA (verbatim)

`AA 02 l.115-128`

| Carrière | Jet optionnel |
|----------|---------------|
| Cavalier | 01 – 75 : Cavalier ; 76 – 00 : Cavalier léger |
| Chevalier | 01 – 55 : Chevalier ; 56 – 65 : Chevalier errant ; 66 – 70 : Chevalier du Soleil flamboyant ; 71 – 85 : Chevalier du Loup Blanc ; 86 – 00 : Chevalier Panthère |
| Prêtre Guerrier | 01 – 85 : Prêtre Guerrier ; 86 – 00 : Prêtre de Myrmidia |
| Soldat | 01 – 40 : Soldat ; 41 – 50 : Archer ; 51 – 70 : Hallebardier ; 71 – 85 : Arquebusier ; 86 – 90 : Joueur d'épée ; 91 – 96 : Piquier ; 97 – 00 : Spécialiste de siège |
| Colporteur | 01 – 75 : Colporteur ; 76 – 00 : Suiveur de camp |
| Érudit | 01 – 85 : Érudit ; 86 – 00 : Cartographe |
| Ingénieur | 01 – 75 : Ingénieur ; 76 – 00 : Artilleur |

### Second lancer du VDM (verbatim)

> « Si vous vous servez du tableau des Carrières aléatoires de **WFJDR** (pages 30–31) pour en choisir une, référez-vous au tableau ci-dessous pour voir si elle peut donner lieu à plus d'options. Si c'est le cas, lancez à nouveau les dés pour voir si celles de ce livre s'appliquent à la place. »
> — `VDM 03 l.17`

`VDM 03 l.23-31`

| Carrière existante | Second lancer |
|--------------------|---------------|
| Apothicaire | 01-15 : Alchimiste ordinaire ; 16-00 : Apothicaire |
| Sorcier | 01–95 : Choisissez la Carrière de Sorcier dans le Livre de Règles de WFJDR ou bien l'une de celles spécifiques à un Collège (Hiérophante, Alchimiste, Druide, Astromancien, Umbramancien, Spirite, Pyromancien ou Chamane). 96–00 : Magister Vigilant |
| Garde | 01–15 : Bedeau ; 16–00 : Garde |
| Mystique | 01–10 : Devin ; 11–00 : Mystique |

**Portée :** les « tableaux des pages 30-31 » sont les colonnes Humain, Nain, Halfling, Haut Elfe et Elfe sylvain du [Tableau des Classes et Carrières aléatoires](#tableau-des-classes-et-carrières-aléatoires-verbatim) (portions Côtiers comprises, `MDG 09 l.9`). Les colonnes Middenheimer, Middenlander et Nordlander les reçoivent en valeur maison (`AA 02 l.111` ; « Globalement, les Middenlanders ont le même type d'occupation que les Reiklanders » `Middenheim 09 l.51` ; #3908) ; la table norse (`MDG 07 l.271-303`), distincte, non.

---

## Prétirés officiels — fiches imprimées

Les compagnons de campagne et *Le Zoo impérial* impriment des Personnages prêts à jouer, sans tirage : ligne « Initiales », « Augmentation » et « Courantes », Compétences et Talents à leur Augmentation, possessions, « Richesse de départ » (un nombre de d10 d'une monnaie), « Apparence et personnalité », « Historique » et « Secrets ». Où vit chaque fiche :

| Prétiré | Fiche | Apparence et personnalité | Historique | Secrets |
|---|---|---|---|---|
| Harbull Piedvelu | `EDOC 16 l.421` | `EDOC 16 l.549` | `EDOC 16 l.555` | `EDOC 16 l.561` |
| Werner Murrmann | `EDOC 16 l.577` | `EDOC 16 l.704` | `EDOC 16 l.712` | `EDOC 16 l.718` |
| Wanda Weltschmertz | `EDOC 16 l.734` | `EDOC 16 l.855` | `EDOC 16 l.861` | `EDOC 16 l.865` |
| Johann « Dam'de nage » Dassbüt | `EDOC 16 l.887` | `EDOC 16 l.1012` | `EDOC 16 l.1020` | `EDOC 16 l.1026` |
| Malmir Giluviel | `EDOC 16 l.1042` | `EDOC 16 l.1167` | `EDOC 16 l.1175` | `EDOC 16 l.1183` |
| Kirsten Krank | `EDOC 16 l.1199` | `EDOC 16 l.1315` | `EDOC 16 l.1327` | `EDOC 16 l.1335` |
| Sigrid Sommerfeld | `MSRC 19 l.498` | `MSRC 19 l.635` | `MSRC 19 l.641` | `MSRC 19 l.645` |
| Erina Eberhauer | `PDTP 01 l.3` | `PDTP 01 l.157` | `PDTP 01 l.163` | `PDTP 01 l.167` |
| Golthog | `PDTP 01 l.204` | `PDTP 01 l.355` | `PDTP 01 l.361` | `PDTP 01 l.367` |
| Erich Massenbach | `ZI 14 l.55` | `ZI 14 l.180` | `ZI 14 l.180` | `ZI 14 l.202` |
| Jorunn Gromsdottir | `ZI 14 l.219` | `ZI 14 l.359` | `ZI 14 l.365` | `ZI 14 l.369` |
| Lynathryn Chantenuit | `ZI 14 l.386` | `ZI 14 l.490` | `ZI 14 l.496` | `ZI 14 l.510` |
| Theodosius Schreiber | `ZI 14 l.527` | `ZI 14 l.666` | `ZI 14 l.672` | `ZI 14 l.684` |
| Vasya Ghorshkov | `ZI 14 l.700` | `ZI 14 l.817` | `ZI 14 l.823` | `ZI 14 l.827` |
| Kistiane Brockdorf | `ZI 14 l.848` | `ZI 14 l.974` | `ZI 14 l.980` | `ZI 14 l.984` |

Spécialisations imprimées par ces fiches : Bon marcheur (Rural) `EDOC 16 l.493`, Musicien (Mandoline) `EDOC 16 l.1110`, Savoir (Ostermark) `ZI 14 l.761`.

---

## Sources RAW

| Ref code | Source |
|----------|--------|
| `LDB 04 l.XX` | Livre de Base VF corrigé, chapitre 04 (_GoBack) |
| `LDB 05 l.XX` | Livre de Base VF corrigé, chapitre 05 (_gjdgxs) |
| `LDB 10 l.714` | Livre de Base VF corrigé, chapitre 10 — Magie mineure à la création |
| `Middenheim ANNEXE II l.XX` | Middenheim la Cité du Loup Blanc, Annexe II |
| `ADE I ANNEXE I l.XX` | Archives de l'Empire vol. 1, Annexe I |
| `AA 02 l.XX` | Aux Armes, chapitre 02 — Introduction |
| `VDM 03 l.XX` | Les Vents de Magie, chapitre 03 — Travaux arcaniques |
| `EDOC 16 l.XX` | L'Ennemi dans l'Ombre — Compagnon, chapitre 12 — prétirés |
| `MSRC 19 l.XX` | Mort sur le Reik — Compagnon, chapitre 17 — prétiré |
| `PDTP 01 l.XX` | Le Pouvoir derrière le Trône — Prétirés |
| `ZI 14 l.XX` | Le Zoo impérial, Expéditions prévues — prétirés |

---

## Voir aussi

- [`carrieres.md`](carrieres.md) — Schémas de progression, compétences/talents par niveau, liste complète des Carrières
- [`competences.md`](competences.md) — Définitions des Compétences, valeur de test
- [`talents.md`](talents.md) — Définitions des Talents, effets
- [`avancement.md`](avancement.md) — Coûts PX, changement de Carrière
- [`destin.md`](destin.md) — Destin/Résilience/Chance/Détermination en jeu
- [`caracteristiques.md`](caracteristiques.md) — Définitions des Caractéristiques, Bonus, usage en combat

---

## Implémenté

| Mécanique | Fichier(s) code |
|-----------|----------------|
| Tirage espèce d100 / +20 PX | `src/engine/creation.ts l.31, 62` — `LDB 04 l.91, 93` |
| Tirage carrière d100 / +50/+25 PX | `src/engine/creation.ts l.32-33, 74` — `LDB 05 l.210-211` |
| Tirage 2d10 Caractéristiques / +50/+25 PX | `src/engine/creation.ts l.34-35` · `src/engine/character.ts l.315` — `LDB 05 l.337-385` |
| Profils d'espèce (bonus de Caractéristique) | `src/data/species.json` |
| Blessures = BF+(2×BE)+BFM | `src/engine/characteristics.ts` |
| Richesse initiale (Bronze/Argent/Or × Standing) | `src/engine/creation.ts l.11, 102` — `LDB 05 l.578-583` |
| Âge par espèce (15+d10 / 15+10d10 / …) | `src/engine/creation.ts l.109` — `LDB 05 l.705-711` |
| Taille par espèce (145+5d10 cm / …) | `src/engine/creation.ts l.114` — `LDB 05 l.728` |
| Couleur des yeux (2d10, table par espèce) | `src/engine/creation.ts l.119` — `LDB 05 l.742-754` |
| Couleur des cheveux (2d10, table par espèce) | `src/engine/creation.ts l.124` — `LDB 05 l.756-768` |
| 5 Augmentations gratuites sur 3 Caractéristiques de carrière | `src/engine/character.ts l.256, 263` — `LDB 05 l.459, 463` |
| 40 Augmentations de Compétences de carrière (max 10 / Comp.) | `src/engine/character.ts` (`CAREER_SKILL_ADVANCES`) · `src/noyau/creation/brouillon.ts` |
| Magie mineure : BFM sorts mémorisés à la création | `src/noyau/creation/brouillon.ts` (`pettySpellQuota`) — `LDB 10 l.714` |
| Compétences/Talents des Races LDB | `src/data/species.json` |
