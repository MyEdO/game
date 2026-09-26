# Atlas RAW — Classes, Carrières & Statut

> Référentiel autosuffisant des règles WFRP4 (RAW). Chaque règle cite `LDB NN l.X` (source = dernier recours). Voir [`sources.md`](../sources.md), [`00-index.md`](00-index.md).
> ⚠️ Les champs **Implémente** sont GÉNÉRÉS (`npm run raw:implemente` — source éditoriale : `src/data/raw.manifest.json`) — ne pas les éditer à la main.

Ce fichier couvre le **système de Classes et Carrières** (structure, avancement, changement) et le **Statut social** (Échelons, Standing, effets, revenus). L'index de carrières donne les 4 noms de niveau et le Statut de chaque niveau pour toutes les carrières LDB + suppléments.

**NE COUVRE PAS** : les coûts PX d'Augmentation (→ [`avancement.md`](avancement.md)), les compétences et talents disponibles par niveau (→ [`competences.md`](competences.md), [`talents.md`](talents.md)), les détails par niveau (compétences/talents/possessions de chaque niveau) = catalogue volumineux à transcrire séparément (présent dans `src/data/careerLevels.json`).

## Sommaire

- [Classes](#classes)
- [Structure d'une Carrière](#structure-dune-carrière)
- [Avancement au sein d'une Carrière](#avancement-au-sein-dune-carrière)
- [Compléter un Niveau de Carrière](#compléter-un-niveau-de-carrière)
- [Changer de Carrière](#changer-de-carrière)
- [Carrières hors classe et changements alternatifs](#carrières-hors-classe-et-changements-alternatifs)
- [Statut](#statut)
  - [Échelons et Standing](#échelons-et-standing)
  - [Effets du Statut](#effets-du-statut)
  - [Gagner de l'argent](#gagner-de-largent)
  - [Table de revenus (verbatim)](#table-de-revenus-verbatim)
- [Index des carrières](#index-des-carrières)
  - [LDB — 8 Classes (64 carrières)](#ldb--8-classes-64-carrières)
  - [Suppléments](#suppléments)

- **La Mer des Griffes (MDG)** <!-- MDG-INTEGRATION -->
- **Classe Côtier (MDG)** — 9ᵉ Classe ; remplace les Riverains au tirage ; 8 Carrières maritimes + table d100 par Race + Possessions de Classe.
- **Nouveaux Talents de la Classe Côtier (MDG)** — Chanson de marin, Commandant d'équipe, Commandant émérite (Maxi/Tests + effets RAW).
- **Chansons de marins (MDG)** — 7 chansons d'équipage (effets +10/+1 DR/État) ; lien Manann/Mathlann.
- **Carrières norses (MDG)** — table d100 dédiée (30 Carrières existantes réinterprétées) + substitutions (Projectiles → Lancer, Escrime → Deux-mains, plates → maille).
- **Origines norses et Personnages norses (MDG)** — création (3×+5 / 3×+3 Augm., langue Norse) ; 3 origines (bjornlings/sarls/skaelings).
- **Trait Marque de Khorne (MDG)** — Frénésie + Savoir-vivre (Suivants de Khorne) + Animosité Slaanesh ; blocage Langue (Magick)/Focalisation ; 10 Talents en Augmentations.

- **Les Vents de Magie (VDM)** <!-- VDM-INTEGRATION -->
- [Nouvelles Carrières arcaniques (VDM)](#nouvelles-carrières-arcaniques-vdm) — `VDM 03 l.9-21`
- [Obtenir aléatoirement les nouvelles Carrières (VDM)](#obtenir-aléatoirement-les-nouvelles-carrières-vdm) — `VDM 03 l.15-31`
- [10 Compétences de départ (VDM)](#10-compétences-de-départ-vdm) — `VDM 03 l.35-37`
- [Carrière Alchimiste ordinaire (VDM)](#carrière-alchimiste-ordinaire-vdm) — `VDM 03 l.42-141`
- [Carrière Bedeau (VDM)](#carrière-bedeau-vdm) — `VDM 03 l.144-197`
- [Carrière Devin (VDM)](#carrière-devin-vdm) — `VDM 03 l.236-287`
- [Carrière Magister Vigilant (VDM)](#carrière-magister-vigilant-vdm) — `VDM 03 l.349-374`

---

## Classes

> « Warhammer Fantasy (**WFJDR)** regroupe les Carrières similaires en Classes. »
> — LDB 07 l.9

Les 8 Classes du LDB (avec renvois source) :

| Classe | Source LDB (page) |
|---|---|
| **Citadins** | p. 53 |
| **Courtisans** | p. 61 |
| **Guerriers** | p. 69 |
| **Itinérants** | p. 77 |
| **Lettrés** | p. 85 |
| **Riverains** | p. 93 |
| **Roublards** | p. 101 |
| **Ruraux** | p. 109 |

Les Classes ont plusieurs rôles (LDB 07 l.13) :
- Regrouper les Carrières similaires.
- Influencer le changement de Carrière (même classe = 100 PX vs classe différente = +100 PX de surcoût).
- Certaines Classes donnent accès à des Activités spécifiques entre deux aventures.

**Sources RAW** : `LDB 07 l.9-17`

---

## Structure d'une Carrière

> « Chaque Carrière possède quatre Niveaux, chacun étant meilleur que le précédent. »
> — LDB 07 l.26

Chaque Carrière est structurée ainsi (LDB 08 l.130-142) :

- **Nom** : nom de la Carrière.
- **Restriction** : Races qui embrassent généralement la Carrière.
- **Résumé** : une phrase de présentation.
- **Description** : 1-2 paragraphes.
- **Schéma de Progression** : les 10 Caractéristiques avec marqueurs par niveau (h = Niveau 1, ◆ cuivré = N2, ◆ argenté = N3, ◆ or = N4).
- **Évolution de Carrière** : pour chacun des 4 niveaux — Nom de niveau, Statut, Compétences, Talents, Possessions.

### Les 4 niveaux

Un Personnage démarre **toujours au Niveau 1** de la Carrière choisie (LDB 07 l.35).

**Schéma de Progression** (LDB 07 l.41-44) :

- Niveau 1 : les 3 Caractéristiques marquées h.
- Niveau 2 : + la Caractéristique ◆ cuivré.
- Niveau 3 : + la Caractéristique ◆ argenté.
- Niveau 4 : + la Caractéristique ◆ or.

Les Augmentations de Caractéristique des niveaux précédents restent disponibles aux niveaux supérieurs (cumul).

### Emplacements « Au choix »

Quand une entrée de Compétence ou Talent porte « (Au choix) », le joueur choisit la spécialisation au moment où il alloue une Augmentation (LDB 09 l.40). Au sein d'une même Carrière, deux slots ne peuvent pas être désignés sur le même libellé concret.

**Jokers restreints** : « (Fléau ou À deux mains) » = uniquement les specs listées.

**Sources RAW** : `LDB 07 l.26-163` + `LDB 09 l.34-45` (compétences groupées) + `LDB 10 l.15-20` (talents à spécialisations).  
**Refs code** : `src/engine/careerSlots.ts l.1-21` (commentaires RAW sur l'accumulation des compétences par niveaux ≤ courant et les talents du niveau courant uniquement) ; `l.153-156` (`skillSlots` cumul LDB 07 l.76) ; `l.158-162` (`talentSlots` niveau courant uniquement LDB 07 l.103).

---

## Avancement au sein d'une Carrière

> « Chaque Carrière propose trois formes d'Augmentation : Augmentation de Caractéristique, Augmentation de Compétence et Augmentation de Talent. »
> — LDB 07 l.37

### Compétences disponibles

- Le joueur peut Augmenter les Compétences de son niveau **et de tous les niveaux précédents** (LDB 07 l.76).
- La Compétence en italique au Niveau 1 est celle « que vous utiliserez pour Gagner de l'argent » (LDB 07 l.82).

### Talents disponibles

- Les Talents ne sont disponibles **qu'au niveau de Carrière où ils sont indiqués** — pas ceux des niveaux précédents (LDB 07 l.103).
- Coût : 100 PX + 100 PX par fois où le Talent a déjà été pris (LDB 07 l.105).
- Certains Talents ne peuvent pas être pris plusieurs fois (voir description du Talent).

### Augmentations hors Carrière

- Coût doublé pour Caractéristiques et Compétences hors Carrière (LDB 07 l.90-91).
- Les Talents hors Carrière ne peuvent normalement pas être achetés avec des PX (sauf Activités Entraînement / Apprentissage particulier, LDB 07 l.93).

**Sources RAW** : `LDB 07 l.37-109`

---

## Compléter un Niveau de Carrière

Pour **compléter** un Niveau de Carrière et débloquer le changement à 100 PX (LDB 07 l.121-133) :

- Avoir acquis le nombre d'Augmentations ci-dessous dans toutes les Caractéristiques disponibles et **huit** des Compétences disponibles à ce niveau.
- Posséder **au moins un Talent** de ce niveau.

| Niveau | Augmentations requises |
|---|---|
| 1 | 5 |
| 2 | 10 |
| 3 | 15 |
| 4 | 20 |

> Remarque : achever un niveau n'oblige pas à en changer. On peut rester indéfiniment au Niveau 1.

**Sources RAW** : `LDB 07 l.121-133`

---

## Changer de Carrière

### Coûts

| Action | Carrière achevée | Carrière non achevée |
|---|---|---|
| Passer au niveau suivant (ou inférieur) de la même Carrière | 100 PX | — |
| Commencer le Niveau 1 d'une autre Carrière **même Classe** | 100 PX | 200 PX |
| Commencer le Niveau 1 d'une autre Carrière **Classe différente** | 200 PX | 300 PX |
| Accéder au **même Niveau** d'une autre Carrière même Classe (accord MJ requis) | 100 PX | — |

Source : LDB 07 l.136-137 (changement de niveau), l.9-16 (changement de Carrière).

> Remarque : il est possible de **sauter des niveaux** avec accord du MJ (justifié par les événements de jeu). Coût = 100 PX si achevé, 200 PX sinon (LDB 07 l.140).

**Sources RAW** : `LDB 07 l.112-139` + `LDB 08 l.1-30`

---

## Carrières hors classe et changements alternatifs

Le MJ peut proposer un **changement de Carrière inattendu** en cours de partie (Garde d'Honneur, Hors-la-loi forcé, etc.) — fortement recommandé pour lier les choix de Carrière aux événements (LDB 08 l.5-5).

Entre deux aventures, l'Activité **Changement de Carrière** (LDB p. 197) permet aussi de changer.

**Nouvelle règle (Middenheim ANN.II)** : certaines Carrières comme Frère Loup peuvent proposer plus de 8 Compétences au premier Niveau. Il suffit d'en augmenter 8 pour passer au niveau suivant, mais la Compétence en italique (Gagner de l'argent) **doit** être augmentée.

**Sources RAW** : `LDB 08 l.5-5` + `Middenheim ANN.II l.93-94`

---

## Statut

> « Le Vieux Monde est particulièrement hiérarchisé. »
> — LDB 08 l.5

### Échelons et Standing

Le Statut = **Échelon** (Bronze / Argent / Or) + **Standing** (chiffre, généralement 1-5) (LDB 08 l.9).

- Échelon supérieur → Statut supérieur (indépendamment du Standing).
- Même Échelon → Standing supérieur = Statut supérieur.

**Les trois Échelons** (LDB 08 l.15-23) :

| Échelon | Profil social |
|---|---|
| **Or** | Dirigeants, conseillers directs, protecteurs de l'ordre, riches. Tous riches et très respectés. |
| **Argent** | Professions qualifiées, commerçants, artisans, marchands, prestataires de service. Vie humble mais respectable. |
| **Bronze** | Paysans, professions sans compétence particulière, criminels, sans-abri. |

### Détermination du Statut

Le Statut est indiqué **à côté du nom de chaque Niveau de Carrière** (ex. « Bronze 3 », « Argent 1 ») et change automatiquement lors d'un changement de Carrière (LDB 08 l.25-26).

**Causes de changement de Statut** (LDB 08 l.30-34) :
1. Changement de Carrière.
2. Talent qui modifie le Statut.
3. Décision du MJ liée aux événements de jeu.

### Conserver son Statut

- Agir en adéquation avec son rôle social est requis pour bénéficier du Statut (LDB 08 l.86-91).
- Passer incognito = Statut Bronze 3 par défaut.
- Ne pas maintenir son train de vie → perte de 1 Standing par semaine (LDB 08 l.95-103).
- Si Standing atteint 0 : l'Échelon baisse de 1, Standing remonte à 5 (LDB 08 l.101).

### Effets du Statut

| Compétence sociale | Effet |
|---|---|
| **Charme** | Échelon supérieur → +10 ; Échelon inférieur → -10 (LDB 08 l.53-58). |
| **Intimidation** | Statut supérieur → +10 (LDB 08 l.73). |
| **Ragot** | Échelons différents → -10 (LDB 08 l.76-77). |
| **Commandement** | 1 Échelon au-dessus → +10 ; 2 Échelons au-dessus → +20 (LDB 08 l.81-83). |
| **Divertissement** | Le Statut n'influe pas directement (LDB 08 l.65-69). |

**Réaction aléatoire des PNJ au Statut** (LDB 08 l.40-46) :

| 1d10 | Réaction |
|---|---|
| 1-2 | Brave le Statut : ignore les effets du Statut. |
| 3-8 | Réactions classiques : suit les règles normales. |
| 9-10 | Opinions extrêmes : modifier les Tests liés au Statut de ±10. |

**Sources RAW** : `LDB 08 l.5-103`

---

### Gagner de l'argent

Pour Gagner de l'argent (LDB 08 l.107-122), le Personnage passe une semaine à travailler sa Carrière (accord MJ, lieu approprié) :

- Test **Spectaculaire Accessible (+20)** contre la Compétence de Carrière en italique.
- Succès → somme pleine ; Échec → moitié ; Échec Stupéfiant (-6 DR) → rien.

### Table de revenus (verbatim)

Source : LDB 08 l.115

| Échelon | Somme gagnée **par Standing** |
|---|---|
| Bronze | 2d10 sous de cuivre |
| Argent | 1d10 pistoles d'argent |
| Or | 1 couronne d'or |

> La même somme s'applique à l'Activité *Revenus* (LDB p. 199).

**Sources RAW** : `LDB 08 l.106-122`

---

## Index des carrières

Format des colonnes : **Carrière | Classe | Niveau 1 (Statut) | Niveau 2 (Statut) | Niveau 3 (Statut) | Niveau 4 (Statut) | Source**

> **Note** : Les détails par niveau des carrières (compétences/talents/possessions) = catalogue volumineux à transcrire séparément (présent dans `src/data/careerLevels.json`).

### LDB — 8 Classes (64 carrières)

#### Classe : Citadins

| Carrière | N1 (Statut) | N2 (Statut) | N3 (Statut) | N4 (Statut) |
|---|---|---|---|---|
| **Agitateur** | Pamphlétaire (Bronze 1) | Agitateur (Bronze 2) | Fauteur de Troubles (Bronze 3) | Démagogue (Bronze 5) |
| **Artisan** | Apprenti Artisan (Bronze 2) | Artisan (Argent 1) | Maître Artisan (Argent 3) | Maître de Guilde (Or 1) |
| **Bourgeois** | Employé (Argent 1) | Bourgeois (Argent 2) | Conseiller Municipal (Argent 5) | Bourgmestre (Or 1) |
| **Enquêteur** | Limier (Argent 1) | Enquêteur (Argent 2) | Maître Enquêteur (Argent 3) | Détective (Argent 5) |
| **Marchand** | Négociant (Argent 2) | Marchand (Argent 5) | Maître Marchand (Or 1) | Prince Marchand (Or 3) |
| **Mendiant** | Indigent (Bronze 0) | Mendiant (Bronze 2) | Maître Mendiant (Bronze 4) | Roi des Mendiants (Argent 2) |
| **Milicien** | Recrue de la Milice (Bronze 3) | Milicien (Argent 1) | Sergent de la Milice (Argent 3) | Capitaine de la Milice (Or 1) |
| **Ratier** | Chasseur de Rat (Bronze 3) | Ratier (Argent 1) | Égoutier (Argent 2) | Exterminateur (Argent 3) |

#### Classe : Courtisans

| Carrière | N1 (Statut) | N2 (Statut) | N3 (Statut) | N4 (Statut) |
|---|---|---|---|---|
| **Artiste** | Artiste Apprenti (Argent 1) | Artiste (Argent 3) | Artiste de Renom (Argent 5) | Maestro (Or 2) |
| **Conseiller** | Assistant (Argent 2) | Conseiller (Argent 4) | Consultant (Or 1) | Chancelier (Or 3) |
| **Duelliste** | Escrimeur (Argent 3) | Duelliste (Argent 5) | Maître Duelliste (Or 2) | Champion de Justice (Or 4) |
| **Émissaire** | Héraut (Argent 2) | Émissaire (Argent 4) | Diplomate (Or 1) | Ambassadeur (Or 2) |
| **Espion** | Informateur (Bronze 3) | Espion (Argent 3) | Agent Secret (Or 1) | Maître Espion (Or 4) |
| **Intendant** | Gardien (Argent 1) | Intendant (Argent 3) | Sénéchal (Or 1) | Gouverneur (Or 3) |
| **Noble** | Héritier (Or 1) | Noble (Or 3) | Magnat (Or 5) | Noble Seigneur (Or 7) |
| **Serviteur** | Domestique (Argent 1) | Serviteur (Argent 3) | Valet (Argent 5) | Régisseur (Or 1) |

#### Classe : Guerriers

| Carrière | N1 (Statut) | N2 (Statut) | N3 (Statut) | N4 (Statut) |
|---|---|---|---|---|
| **Cavalier** | Apprenti Cavalier (Argent 2) | Cavalier (Argent 4) | Sergent de Cavalerie légère (Or 1) | Officier de Cavalerie Légère (Or 2) |
| **Chevalier** | Écuyer (Argent 3) | Chevalier (Argent 5) | Chevalier Commandeur (Or 2) | Chevalier du Cercle Intérieur (Or 4) |
| **Garde** | Sentinelle (Argent 1) | Garde (Argent 2) | Garde d'Honneur (Argent 3) | Garde Officier (Argent 5) |
| **Gladiateur** | Pugiliste (Bronze 4) | Gladiateur (Argent 2) | Champion de Fosse (Argent 5) | Légende de la Fosse (Or 2) |
| **Prêtre Guerrier** | Novice (Argent 1) | Prêtre Guerrier (Argent 3) | Prêtre Sergent (Argent 5) | Prêtre Capitaine (Or 1) |
| **Soldat** | Recrue (Bronze 3) | Soldat (Argent 1) | Sergent (Argent 3) | Officier (Argent 5) |
| **Spadassin** | Matamore (Bronze 2) | Spadassin (Argent 1) | Tueur à Gages (Argent 4) | Assassin (Or 1) |
| **Tueur** *(Nain seul)* | Tueur de Trolls (Bronze 2) | Tueur de Géants (Bronze 2) | Tueur de Dragons (Bronze 2) | Tueur de Démons (Bronze 2) |

#### Classe : Itinérants

| Carrière | N1 (Statut) | N2 (Statut) | N3 (Statut) | N4 (Statut) |
|---|---|---|---|---|
| **Chasseur de Primes** | Chasseur de Voleurs (Bronze 1) | Chasseur de Primes (Bronze 4) | Maître Chasseur de Primes (Argent 2) | Chasseur de Primes Vétéran (Argent 5) |
| **Cocher** | Postillon (Bronze 2) | Cocher (Argent 1) | Maître Cocher (Or 1) | Maître des Routes (Or 2) |
| **Colporteur** | Vagabond (Bronze 1) | Colporteur (Bronze 4) | Maître Colporteur (Argent 2) | Négociant Itinérant (Argent 5) |
| **Flagellant** | Zélote (Bronze 0) | Flagellant (Bronze 0) | Pénitent (Bronze 0) | Prophète du Destin (Bronze 0) |
| **Messager** | Coureur (Bronze 3) | Messager (Argent 1) | Estafette (Argent 3) | Messager Vétéran (Argent 5) |
| **Patrouilleur Routier** | Péager (Bronze 0) | Patrouilleur Routier (Bronze 0) | Sergent Patrouilleur (Argent 1) | Capitaine Patrouilleur (Argent 3) |
| **Répurgateur** | Interrogateur (Argent 1) | Répurgateur (Argent 3) | Inquisiteur (Argent 5) | Répurgateur Vétéran (Or 1) |
| **Saltimbanque** | Musicien de Rues (Bronze 3) | Saltimbanque (Bronze 5) | Troubadour (Argent 3) | Chef de Troupe (Or 1) |

#### Classe : Lettrés

| Carrière | N1 (Statut) | N2 (Statut) | N3 (Statut) | N4 (Statut) |
|---|---|---|---|---|
| **Apothicaire** | Apprenti Apothicaire (Bronze 3) | Apothicaire (Argent 1) | Maître Apothicaire (Argent 3) | Apothicaire de Renom (Or 1) |
| **Érudit** | Étudiant (Bronze 3) | Érudit (Argent 2) | Chercheur (Argent 5) | Professeur (Or 1) |
| **Ingénieur** | Étudiant Ingénieur (Bronze 4) | Ingénieur (Argent 2) | Maître Ingénieur (Argent 4) | Ingénieur Agréé (Or 2) |
| **Juriste** | Étudiant en Droit (Bronze 4) | Juriste (Argent 3) | Maître du Barreau (Or 1) | Juge (Or 2) |
| **Médecin** | Étudiant en Médecine (Bronze 1) | Médecin (Bronze 4) | Docteur en Médecine (Argent 2) | Médecin de la Cour (Argent 5) |
| **Nonne** | Novice (Bronze 2) | Nonne (Argent 1) | Abbesse (Or 1) | Prieure Générale (Or 2) |
| **Prêtre** | Initié (Bronze 3) | Prêtre (Argent 3) | Grand Prêtre (Or 1) | Lecteur (Or 2) |
| **Sorcier** | Sorcier Novice (Argent 1) | Sorcier (Argent 2) | Maître Sorcier (Or 1) | Seigneur Sorcier (Or 3) |

#### Classe : Riverains

| Carrière | N1 (Statut) | N2 (Statut) | N3 (Statut) | N4 (Statut) |
|---|---|---|---|---|
| **Batelier** | Canotier (Bronze 2) | Batelier (Argent 1) | Chef de Bord (Or 1) | Capitaine (Or 2) |
| **Contrebandier** | Coureur de Rivières (Bronze 3) | Contrebandier (Argent 1) | Maître Contrebandier (Argent 3) | Roi des Contrebandiers (Argent 5) |
| **Débardeur** | Porteur (Bronze 2) | Débardeur (Bronze 3) | Contremaître (Bronze 5) | Maître des Docks (Argent 2) |
| **Femme du Fleuve** | Alevin (Bronze 3) | Femme du Fleuve (Argent 1) | Sage des Rives (Argent 3) | Ancienne du Fleuve (Argent 5) |
| **Marin** | Marin d'Eau Douce (Argent 1) | Marin (Argent 3) | Maître d'Équipage (Argent 5) | Capitaine de Navire (Or 2) |
| **Naufrageur** | Pilleur d'Épaves (Bronze 2) | Naufrageur (Bronze 3) | Pirate des Rivières (Bronze 5) | Capitaine Naufrageur (Argent 2) |
| **Nautonier** | Guide Fluvial (Bronze 4) | Nautonier (Agent 1*) | Pilote (Argent 3) | Maître Nocher (Argent 5) |
| **Patrouilleur Fluvial** | Recrue Fluviale (Argent 1) | Patrouilleur Fluvial (Argent 2) | Abordeur (Argent 3) | Maître Abordeur (Argent 1†) |

> *Typo dans `careerLevels.json` : « Agent 1 » pour Nautonier N2 (doit être Argent 1 — ne pas corriger en code sans vérification source). †Maître Abordeur N4 : `"status": "Argent 1"` dans les données — à confirmer.

#### Classe : Roublards

| Carrière | N1 (Statut) | N2 (Statut) | N3 (Statut) | N4 (Statut) |
|---|---|---|---|---|
| **Charlatan** | Filou (Bronze 3) | Charlatan (Bronze 5) | Arnaqueur (Argent 2) | Escroc (Argent 4) |
| **Entremetteur** | Prostitué (Bronze 2) | Entremetteur (Bronze 3) | Souteneur (Argent 1) | Meneur (Argent 5) |
| **Hors-la-loi** | Bandit (Bronze 1) | Hors-la-loi (Bronze 2) | Chef de Bande (Bronze 4) | Roi des Bandits (Argent 2) |
| **Pilleur de Tombes** | Trafiquant de Cadavres (Bronze 2) | Pilleur de Tombes (Bronze 3) | Pilleur de Tombeaux (Argent 1) | Chasseur de Trésors (Argent 5) |
| **Rançonneur** | Coupe-Jarret (Bronze 1) | Rançonneur (Bronze 2) | Chef de Gang (Bronze 3) | Baron du Crime (Bronze 5) |
| **Receleur** | Brocanteur (Argent 1) | Receleur (Argent 2) | Maître Receleur (Argent 3) | Professionnel du Marché Noir (Argent 1†) |
| **Sorcier Dissident** | Ensorceleur (Bronze 1) | Sorcier Dissident (Bronze 3) | Devin (Argent 1) | Démoniste (Argent 3) |
| **Voleur** | Rôdeur (Bronze 1) | Voleur (Bronze 3) | Maître Voleur (Bronze 5) | Cambrioleur (Argent 3) |

> †Receleur N4 : `"status": "Argent 1"` dans les données — le Roi des Mendiants est Argent 2, ce qui semble cohérent ; le Professionnel du Marché Noir à Argent 1 paraît bas, à confirmer sur la source.

#### Classe : Ruraux

| Carrière | N1 (Statut) | N2 (Statut) | N3 (Statut) | N4 (Statut) |
|---|---|---|---|---|
| **Bailli** | Percepteur (Argent 1) | Bailli (Argent 5) | Préfet (Or 1) | Magistrat (Or 3) |
| **Chasseur** | Traqueur (Bronze 2) | Chasseur (Bronze 4) | Pisteur (Argent 1) | Maître de la Chasse (Argent 3) |
| **Éclaireur** | Coureur des Bois (Bronze 2) | Éclaireur (Bronze 4) | Guide (Bronze 5) | Explorateur (Argent 4) |
| **Herboriste** | Cueilleur (Bronze 1) | Herboriste (Bronze 2) | Maître Herboriste (Bronze 3) | Herboriste de Renom (Bronze 4) |
| **Mineur** | Prospecteur (Bronze 2) | Mineur (Bronze 3) | Maître Mineur (Bronze 4) | Contremaître de la Mine (Argent 2) |
| **Mystique** | Voyant (Bronze 3) | Mystique (Argent 2) | Sage (Argent 5) | Prophète (Or 1) |
| **Sorcier de Village** | Apprenti Sorcier de Village (Bronze 1) | Sorcier de Village (Bronze 2) | Maître Sorcier de Village (Bronze 3) | Sage de Village (Bronze 4) |
| **Villageois** | Paysan (Bronze 2) | Villageois (Bronze 3) | Échevin (Bronze 4) | Doyen (Argent 2) |

---

### Suppléments

#### ADE I — Archives de l'Empire Vol. 1 (source : `ADE I 7 p.88` / `ADE I 8 p.92`)

Ces carrières suivent les règles habituelles. Elles peuvent être choisies à la création ou lors d'un changement de Carrière.

| Carrière | Races | N1 (Statut) | N2 (Statut) | N3 (Statut) | N4 (Statut) | Classe |
|---|---|---|---|---|---|---|
| **Chevaucheur de Blaireau** | Halfling (Moot) | Taquineur de Blaireau (Argent 1) | Chevaucheur de Blaireau (Argent 3) | Sergent Blaireau (Argent 5) | Maître Blaireau (Or 1) | Guerriers |
| **Gardechamps** | Halfling | Garde Novice (Bronze 4) | Gardechamps (Argent 1) | Sergent Gardechamps (Argent 3) | Capitaine Gardechamps (Argent 5) | Itinérants |
| **Patrouilleur des Karak** | Nain | Coureur des Forts (Bronze 3) | Patrouilleur des Karak (Argent 1) | Gardien des Routes des Karak (Argent 2) | Arpenteur des Karak (Argent 4) | Itinérants |
| **Rôdeur Fantôme** | Elfe Sylvain | Garde Forestier (Bronze 3) | Rôdeur Fantôme (Bronze 5) | Esprit du Vent (Argent 1) | Courroux de la Forêt (Argent 3) | Itinérants |

**Conditions d'accès** :
- **Chevaucheur de Blaireau** : Halfling du Mootland uniquement + doit imiter le cri de guerre du blaireau 😄. Sur tirage aléatoire Soldat → peut choisir Chevaucheur de Blaireau à la place.
- **Gardechamps** : Halfling. Sur tirage aléatoire Patrouilleur Routier → peut choisir Gardechamps.
- **Patrouilleur des Karak** : Nain. Sur tirage aléatoire Messager → peut choisir Patrouilleur des Karak.
- **Rôdeur Fantôme** : Elfe Sylvain. Sur tirage aléatoire Chasseur de Primes → peut choisir Rôdeur Fantôme.

#### ADE II — Archives de l'Empire Vol. 2 (source : `ADE II 2 p.35`)

| Carrière | Races | N1 (Statut) | N2 (Statut) | N3 (Statut) | N4 (Statut) | Classe |
|---|---|---|---|---|---|---|
| **Mangeur d'Hommes** | Ogre | Chair Fraîche (Bronze 3) | Mangeur d'Hommes (Argent 2) | Broyeur d'Hommes (Argent 5) | Capitaine Mangeur d'Hommes (Or 1) | Guerriers |
| **Boucher Ogre** | Ogre | Faiseur de Bouillie (Bronze 3) | Boucher Ogre (Argent 2) | Sage de la Gueule (Argent 5) | Maître Massacreur (Or 1) | Lettrés |

> Ces deux carrières sont ogres-exclusives. Les profils ogres viennent d'ADE II (chap. 2).

ADE II contient également les carrières militaires de la série **Aux Armes (AA)** intégrées dans `src/data/careerLevels.json` :

| Carrière | N1 (Statut) | N2 (Statut) | N3 (Statut) | N4 (Statut) | Classe |
|---|---|---|---|---|---|
| **Archer** | Tireur à l'Arc (Argent 1) | Archer (Argent 2) | Sergent Archer (Or 1) | Capitaine Archer (Or 2) | Guerriers |
| **Arquebusier** | Recrue Arquebusier (Bronze 2) | Arquebusier (Bronze 3) | Sergent Arquebusier (Argent 1) | Capitaine Arquebusier (Argent 5) | Guerriers |
| **Artilleur** | Apprenti Artilleur (Bronze 3) | Artilleur (Argent 2) | Capitaine Artilleur (Argent 4) | Maître Artilleur (Or 2) | Guerriers |
| **Cartographe** | Arpenteur (Bronze 4) | Cartographe (Argent 3) | Cartographe Reconnu (Or 1) | Maître Cartographe (Or 2) | Lettrés |
| **Cavalier Léger** | Cavalier (Bronze 3) | Cavalier Léger (Argent 2) | Cavalier Léger Lancier (Argent 5) | Capitaine Cavalier Léger (Or 1) | Guerriers |
| **Chevalier du Loup Blanc** | Novice (Argent 1) | Chevalier du Loup Blanc (Argent 2) | Sergent Templier (Or 1) | Commandant de Compagnie (Or 3) | Guerriers |
| **Chevalier du Soleil Flamboyant** | Novice (Argent 3) | Chevalier du Soleil Flamboyant (Argent 5) | Hochmeister (Or 2) | Chevalier du Cercle Intérieur (Or 4) | Guerriers |
| **Chevalier Errant** | Écuyer (Argent 1) | Chevalier Errant (Argent 2) | Capitaine Indépendant (Or 1) | Chevalier Commandant (Or 3) | Guerriers |
| **Chevalier Panthère** | Écuyer (Argent 3) | Chevalier Panthère (Argent 5) | Chevalier Commandeur (Or 2) | Commandant de Compagnie (Or 4) | Guerriers |
| **Gardien de Troupeaux de Rhinox** | Voleur de Rhinox (Argent 1) | Gardien de Troupeaux de Rhinox (Argent 3) | Dompteur de Rhinox (Argent 5) | Maître des Rhinox (Or 1) | Ruraux |
| **Hallebardier** | Recrue Hallebardier (Bronze 3) | Hallebardier (Argent 1) | Sergent Hallebardier (Argent 3) | Capitaine Hallebardier (Argent 5) | Guerriers |
| **Joueur d'Épée** | Cadet Joueur d'Épée (Argent 3) | Joueur d'Épée (Argent 5) | Sergent Joueur d'Épée (Or 2) | Capitaine Joueur d'Épée (Or 4) | Guerriers |
| **Piquier** | Recrue (Bronze 2) | Piquier (Bronze 3) | Chef de File (Bronze 4) | Capitaine d'Étendard (Argent 2) | Guerriers |
| **Prêtre de Myrmidia** | Premier Aigle (Argent 3) | Prêtre de Myrmidia (Argent 5) | Prêtre Sergent (Or 2) | Prêtre Capitaine (Or 4) | Lettrés |
| **Spécialiste de Siège** | Arbalétrier (Bronze 4) | Spécialiste de Siège (Argent 3) | Sapeur (Or 1) | Maître de Siège (Or 2) | Guerriers |
| **Suiveur de Camp** | Ribaud (Bronze 1) | Suiveur de Camp (Bronze 2) | Pillard Chevronné (Bronze 3) | Chef de Camp (Bronze 4) | Itinérants |

#### Middenheim — Cité du Loup Blanc (source : `Middenheim ANN.II l.275-311`)

| Carrière | Races | N1 (Statut) | N2 (Statut) | N3 (Statut) | N4 (Statut) | Classe |
|---|---|---|---|---|---|---|
| **Frère Loup** | Humain | Survivant (Bronze 0) | Frère Loup (Bronze 0) | Compagnon Loup (Bronze 0) | Grand Loup (Bronze 0) | Itinérants |

**Conditions d'accès** : Humain originaire du nord de l'Empire. Sur tirage aléatoire pour les Middenheimers (66-68), Middenlanders (59-60) et Nordlanders (57-58). Un Personnage qui tire Frère Loup peut à la place choisir Flagellant.

**Règle spéciale** : le Frère Loup propose plus de 8 Compétences au Niveau 1 (10 compétences). Il suffit d'en augmenter 8, mais la Compétence en italique (*Survie en extérieur*) **doit** être augmentée pour compléter le niveau.

**Note** : Un Personnage qui gagne Frère Loup + Noblesse peut renoncer au Talent Noblesse pour devenir Enfant d'Ulric (option très puissante — accord MJ requis).

Middenheim introduit aussi 3 origines humaines supplémentaires (Middenheimer, Middenlander, Nordlander) avec tables de tirage de Carrière et compétences/talents d'origine distincts des Reiklanders (voir `Middenheim ANN.II`).

---


---

<!-- MDG-INTEGRATION -->

## Classe Côtier (MDG)

> « La Classe Côtier est une nouvelle Classe à utiliser dans **Warhammer Fantasy le Jeu de Rôle**, qui représente les Carrières suivies par les gens vivant près des littoraux du Vieux Monde. »
> — `MDG 09 l.7`

La **Classe Côtier** est une 9ᵉ Classe (en sus des 8 du LDB). Elle a beaucoup en commun avec les **Riverains** : certaines Carrières appartiennent aux deux Classes — **Nautonier, Marin et Naufrageur** (`MDG 09 l.7`). Sa table de tirage est conçue pour **remplacer la partie Riverains** du tableau des Classes et Carrières aléatoires (LDB p. 30-31) : le joueur qui détermine sa Carrière choisit, **avant de lancer les dés**, s'il remplace les Riverains par les Côtiers (`MDG 09 l.9`).

Les Carrières de Riverain possédant la Compétence **Savoir (Voies fluviales)** peuvent la remplacer par **Savoir (Océans)** — beaucoup de gens prenant la mer sur de courtes distances gardent un style de vie de Batelier, Contrebandier ou Femme du fleuve (`MDG 09 l.11`).

**Possessions de Classe** (`MDG 09 l.15`) :
> « Côtiers : besace contenant 10 mètres de corde et une flasque d'alcool, bourse, cape, dague, vêtements »

**Table de tirage de Carrière (d100) par Race** — remplace la portion Riverains (`MDG 09 l.21-30`) :

| Carrière | Humain | Nain | Halfling | Haut elfe | Elfe sylvain |
|---|---|---|---|---|---|
| Artilleur de navire | 60–61 | 73–75 | 64–65 | 65 | – |
| Chansonnier | 62 | – | – | 66 | – |
| Marin | 63–66 | 76–78 | 66–71 | 67–76 | – |
| Naufrageur | 67 | 79 | – | – | 61 |
| Nautonier | 68 | 80–81 | 72–73 | 77 | – |
| Officier | 69–70 | 82–83 | – | 78–81 | – |
| Prêtre marin de Manann | 71 | – | – | – | – |
| Ratisseur de plages | 72–73 | – | 74–77 | – | – |

Les 8 Carrières de la Classe (Race d'accès : ligne explicite de la Carrière quand elle existe — `MDG 09 l.59`, `l.626`, `l.718` — sinon déduite de la table de tirage `l.21-30`) :
- **Artilleur de navire** — Halfling, haut elfe, humain, nain (`MDG 09 l.59`) ; 4 niveaux : Mousse artilleur (Bronze 3) → Artilleur de navire (Argent 3) → Capitaine d'artillerie (Argent 5) → Maître artilleur (Or 1). Compétence d'acquisition (italique N1) = **Projectiles (Poudre noire)**. Variante hauts elfes : **Projectiles (Arbalète)** à la place de Poudre noire (`MDG 09 l.134`).
- **Chansonnier** — Humain, haut elfe (déduit de la table `l.24`) ; Chanteur (Argent 1) → Chansonnier (Argent 3) → Capitaine chansonnier (Argent 5) → Maître chansonnier (Or 1). Italique N1 = **Divertissement (Chant)**.
- **Marin** — Mousse (Argent 1) → Marin (Argent 3) → Quartier-maître (Argent 5) → Bosco (Or 2). Italique N1 = **Voile**.
- **Naufrageur** — Pilleur d'épaves (Bronze 2) → Naufrageur (Bronze 3) → Pirate (Bronze 5) → Capitaine pirate (Argent 2). Italique N1 = **Corps à corps (Base)**.
- **Nautonier** — Guide portuaire (Bronze 4) → Nautonier (Argent 1) → Pilote (Argent 3) → Maître pilote (Argent 5). Italique N1 = **Orientation**.
- **Officier** — Enseigne (Argent 1) → Officier (Argent 5) → Capitaine (Or 2) → Amiral (Or 5). Italique N1 = **Commandement**.
- **Prêtre marin de Manann** — Humain (`MDG 09 l.626`) ; Initié (Bronze 2) → Prêtre marin (Argent 1) → Prêtre capitaine (Or 1) → Seigneur des vagues (Or 2). Italique N1 = **Prière**.
- **Ratisseur de plages** — Halfling, humain (`MDG 09 l.718`) ; Récupérateur (Bronze 1) → Ratisseur de plages (Bronze 3) → Dériveur (Bronze 5) → Maître des plages (Argent 2). Italique N1 = **Perception**.

Détails complets par niveau (compétences/talents/possessions) → [`catalogue-carrieres.md`](catalogue-carrieres.md) section **[MDG 09]**.

**Sources RAW** : `MDG 09 l.3-30` + `l.57-757`
**Voir aussi** : [Index des carrières](#index-des-carrières) · [Carrières norses (MDG)](#carrières-norses-mdg) · [`talents.md`](talents.md) (Chanson de marin, Commandant d'équipe, Commandant émérite)
**Implémente :** _(généré — `npm run raw:implemente`)_
- `MDG 9` (l.3-30, l.59, l.626, l.718) → `ShantyModal`, `rollCrewRole`, `forceCrewRole`, `CreatorDraft`, `CombatFeature`, `CrewContributor`, `QUART_MINUTES`, `SHANTY_LABEL`, `applyShantyToCrew`, `Condition`, +34 — `src/data/careerLevels.json`, `src/data/careers.json`, `src/data/flow-stakes.json`, `src/data/progression-schemas.derived.json` ⚠hors-app, `src/data/talents.json`, `src/engine/combatFeatures/dispatch.ts`, +16 fichiers
- sans code : `MDG 9` (l.134)

---

## Nouveaux Talents de la Classe Côtier (MDG)

La Classe Côtier introduit trois nouveaux Talents (`MDG 09 l.32-54`).

**Chanson de marin** — Maxi : Bonus d'Intelligence ; Tests : Divertissement (Chant) (`MDG 09 l.34`).
> « Ce Talent permet à un Personnage d'apprendre une chanson de marin (voir page 67). Chaque fois qu'un Personnage achète un nouveau niveau dans ce Talent, il apprend une nouvelle chanson. »
> — `MDG 09 l.36`

Une chanson de marin affecte un équipage entier. Le Personnage doit trouver un endroit d'où il peut être entendu d'autant de membres d'équipage que possible et réussir un **Test de Divertissement (Chant)**. Il met **30 secondes** à chanter ; l'effet dure ensuite **trois minutes + 1 minute par DR** sur le Test. La seule action de combat possible pendant le chant est une **Esquive** (avec accord MJ : Perception ou Calme). Subir des Dégâts ou rater un Test opposé met fin à la chanson. **Une seule chanson de marin par quart** (`MDG 09 l.38-40`).

**Commandant d'équipe** — Maxi : Bonus d'Initiative ; Tests : Projectiles pour les tirs avec une arme dotée du Défaut *Arme d'équipe* (`MDG 09 l.44-46`). Le Personnage peut effectuer un **Test de Commandement Intermédiaire (+0)** pour aider une équipe à portée de voix maniant une arme à Défaut *Arme d'équipe* ; en cas de réussite, les membres de l'équipe utilisent ensuite **le score de Compétence Projectiles du Personnage** pour tirer (`MDG 09 l.48`).

**Commandant émérite** — Maxi : Bonus de Sociabilité ; Tests : Commandement (`MDG 09 l.52`).
> « Pour tout Test de Commandement approprié effectué à bord de votre bateau ou impliquant votre équipage, vous gagnez un bonus de DR égal à votre nombre de niveaux en Commandant émérite. Ce bonus s'applique aux Tests d'équipage comme aux Tests de Commandement individuels. »
> — `MDG 09 l.54`

**Sources RAW** : `MDG 09 l.32-54`
**Voir aussi** : [Classe Côtier (MDG)](#classe-côtier-mdg) · [Chansons de marins (MDG)](#chansons-de-marins-mdg) · [`talents.md`](talents.md)
**Implémente :** _(généré — `npm run raw:implemente`)_
- `MDG 9` (l.32-54) → `ShantyModal`, `rollCrewRole`, `forceCrewRole`, `CombatFeature`, `CrewContributor`, `QUART_MINUTES`, `SHANTY_LABEL`, `applyShantyToCrew`, `Condition`, `endShanty`, +20 — `src/data/careerLevels.json`, `src/data/careers.json`, `src/data/flow-stakes.json`, `src/data/progression-schemas.derived.json` ⚠hors-app, `src/data/talents.json`, `src/engine/combatFeatures/dispatch.ts`, +14 fichiers

---

## Chansons de marins (MDG)

La liste des chansons utilisables via le Talent **Chanson de marin** (`MDG 09 l.218-248`).
> « Les Chansons de marins ne sont pas des actes de vénération en tant que tels et aucun pouvoir divin ne se manifeste quand quelqu'un les entonne. Elles sont subtiles et nécessitent la participation de l'équipage du navire […] pour fonctionner. »
> — `MDG 09 l.224`

| Chanson | Effet RAW |
|---|---|
| **Naviguons tous ensemble, ho hisse, ho hisse…** | +10 sur les Tests individuels de chaque membre d'équipage impliqué dans un Test d'équipage (`MDG 09 l.224`). |
| **Jacques Bret a rencontré notre acier sur les mers !** | +1 DR sur tout Test de Corps à corps réussi pour tous les membres de l'équipage (`MDG 09 l.228`). |
| **De toutes les terreurs sur les mers…** | +1 DR sur les Tests de Calme (`MDG 09 l.232`). |
| **Camarades d'équipage, rassemblez-vous…** | +1 DR sur tout Test de Sociabilité visant à fraterniser avec d'autres membres ou à les apaiser (`MDG 09 l.236`). |
| **Tous à la vigie, car la nuit a des yeux…** | +20 sur tous les Tests qui endormiraient en cas d'échec, et +10 sur tout Test de Perception (`MDG 09 l.240`). |
| **Les dames de L'Anguille…** | Toute personne qui participe peut ignorer un État (`MDG 09 l.244`). |
| **Suivez le capitaine, suivez le héros…** | +20 à tout Test de Sociabilité tenté par le capitaine ou une figure d'autorité ciblant l'équipage (`MDG 09 l.248`). |

Le **Chansonnier** est inextricablement lié au culte de **Manann** ; d'autres dieux peuvent inspirer des Chansonniers (le culte elfique de **Mathlann** est une possibilité évidente) (`MDG 09 l.206-216`).

**Sources RAW** : `MDG 09 l.206-248`
**Voir aussi** : [Nouveaux Talents de la Classe Côtier (MDG)](#nouveaux-talents-de-la-classe-côtier-mdg)
**Implémente :** _(généré — `npm run raw:implemente`)_
- `MDG 9` (l.206-248) → `naviguons-tous-ensemble`, `tenueDeCarriere`, `jacques-bret-a-rencontre-notre-acier`, `doc`, `de-toutes-les-terreurs-sur-les-mers`, `camarades-d-equipage-rassemblez-vous`, `tous-a-la-vigie`, `les-dames-de-l-anguille`, `suivez-le-capitaine`, `skillDRBonus`, +24 — `src/data/careerLevels.json`, `src/data/careers.json`, `src/data/index.ts`, `src/data/progression-schemas.derived.json` ⚠hors-app, `src/data/schemas/defs/careers.ts`, `src/data/sea-shanties.json`, +8 fichiers

---

## Carrières norses (MDG)

Les Personnages norses déterminent leur Carrière de départ via un tableau dédié, plus restreint (`MDG 07 l.263-303`). Les norses sont considérés comme **des humains** pour l'acquisition de nouvelles Carrières : un norse ne peut pas *commencer* Sorcier, mais peut le devenir en cours de jeu (`MDG 07 l.265`).

**Table des Classes et Carrières norses (d100)** (`MDG 07 l.271-303`) :

| Classe | Carrière | d100 |
|---|---|---|
| CITADINS | Agitateur | 01-02 |
| CITADINS | Artisan | 03-06 |
| CITADINS | Marchand | 07-08 |
| CITADINS | Mendiant | 09-10 |
| CITADINS | Ratier | 11 |
| CÔTIERS | Marin | 12-19 |
| CÔTIERS | Naufrageur | 20-24 |
| CÔTIERS | Nautonier | 25-27 |
| CÔTIERS | Ratisseur de plages | 28-29 |
| COURTISANS | Artiste | 30 |
| COURTISANS | Conseiller | 31-33 |
| COURTISANS | Noble | 34 |
| COURTISANS | Serviteur | 35-41 |
| GUERRIERS | Cavalier | 42-44 |
| GUERRIERS | Gladiateur | 45-48 |
| GUERRIERS | Soldat | 49-56 |
| GUERRIERS | Spadassin | 57-59 |
| ITINÉRANTS | Colporteur | 60-62 |
| ITINÉRANTS | Messager | 63 |
| ITINÉRANTS | Saltimbanque | 64-65 |
| LETTRÉS | Érudit | 66-67 |
| LETTRÉS | Nonne | 68-69 |
| ROUBLARDS | Charlatan | 70-71 |
| ROUBLARDS | Hors-la-loi | 72-74 |
| ROUBLARDS | Sorcier dissident | 75-77 |
| ROUBLARDS | Voleur | 78-81 |
| RURAUX | Chasseur | 82-85 |
| RURAUX | Éclaireur | 86-88 |
| RURAUX | Herboriste | 89-91 |
| RURAUX | Mystique | 92-94 |
| RURAUX | Villageois | 95-00 |

Ces Carrières sont les Carrières **existantes** (LDB + Côtiers), réinterprétées selon la société norse — un skald peut être Agitateur, Érudit ou Saltimbanque ; un/une vitki un Mystique, une Nonne ou un Sorcier dissident (`MDG 07 l.307`).

**Substitutions RAW** (`MDG 07 l.305-311`) :
> « Chaque fois qu'une Carrière suggère qu'un Personnage acquiert des Compétences, des Talents et des Possessions servant à utiliser Projectiles (Poudre noire, Ingénierie ou Arbalète), un Personnage norse n'a besoin d'apprendre que Projectiles (Lancer) à la place. »
> — `MDG 07 l.309`

- **Corps à corps (Escrime)** → remplacé par **Corps à corps (Deux-mains)** (`MDG 07 l.309`).
- L'**armure de plates** est rare en Norsca → la **maille** la remplace comme Possession (`MDG 07 l.309`).
- Toute Compétence/Talent/Possession inadaptée au style norse est facultative ou remplacée par une alternative ; un norse qui commence une nouvelle vie ailleurs ignore ces restrictions (`MDG 07 l.309-311`).

**Sources RAW** : `MDG 07 l.263-311`
**Voir aussi** : [Classe Côtier (MDG)](#classe-côtier-mdg) · [Origines norses et Personnages norses (MDG)](#origines-norses-et-personnages-norses-mdg)
**Implémente :** _(généré — `npm run raw:implemente`)_
- `MDG 7` (l.263-311) → `humains-bjornling-norse`, `humains-sarl-norse`, `humains-skaeling-norse`, `norsca`, `marque-de-khorne`, `suivants-de-khorne` — `src/data/skills.json`, `src/data/species.json`, `src/data/talents.json`, `src/data/traits.json`
- sans code : `MDG 7` (l.305-311)

---

## Origines norses et Personnages norses (MDG)

Règles de création d'un Personnage norse, **en remplacement** des règles Reiklander (LDB p. 36) (`MDG 07 l.222-260`).

À la création, un Personnage norse peut sélectionner **3 Compétences à +5 Augmentations chacune** et **3 Compétences à +3 Augmentations chacune** ; les Talents aléatoires se tirent au tableau LDB p. 36 (relance si déjà possédé) ; langue maternelle = **Norse** (`MDG 07 l.226`).

Trois origines humaines norses (`MDG 07 l.228-246`) :

- **Humains (Norses bjornlings)** — Compétences : Corps à corps (Base), Évaluation, Langue (Reikspiel), Langue (Wastelander), Marchandage, Métier (Au choix), Natation, Ragot, Ramer, Résistance à l'alcool, Savoir (Norsca), Voile. Talents : Guerrier né *ou* Pied marin, Pêcheur *ou* Seigneur de guerre, **Résistance (Chaos)**, 2 Talents aléatoires (`MDG 07 l.228-232`).
- **Humains (Norses sarls)** — Compétences : Chevaucher (Cheval), Corps à corps (Base), Langue (Reikspiel), Langue (Gospodarin), Métier (Au choix), Natation, Ragot, Ramer, Résistance à l'alcool, Soin aux animaux, Savoir (Norsca), Voile. Talents : Cavalier émérite *ou* Pied marin, Claquer le fouet *ou* Loup de mer, **Résistance (Corruption)**, 2 Talents aléatoires (`MDG 07 l.234-238`).
- **Humains (Norses skaelings)** — Compétences : Calme, Corps à corps (Base), Corps à corps (Deux-mains), Divertissement (Narration), Langue (Reikspiel), Langue (Wastelander), Natation, Ramer, Résistance, Résistance à l'alcool, Savoir (Khorne), Voile. Talents : Charge berserk *ou* Fuite !, Déterminé *ou* Insignifiant, **Résistance (Chaos)**, 2 Talents aléatoires (`MDG 07 l.240-244`).

**Règle skaeling** : un skaeling qui tire le Talent **Âme pure** comme Talent aléatoire peut prendre à la place le nouveau Trait de créature **Marque de Khorne** (`MDG 07 l.246`).

**Noms de famille** : les humains norses utilisent le système de noms de famille majoritaire chez les nains (LDB p. 38) — tradition issue des liens commerciaux entre humains et nains norses — mais avec des surnoms **qui ne sont pas en khazalid**, portant surtout sur des prouesses personnelles, des vantardises intimidantes ou des prétentions d'avoir des démons ou des monstres pour cousins (`MDG 07 l.260`).

**Sources RAW** : `MDG 07 l.222-260`
**Voir aussi** : [Carrières norses (MDG)](#carrières-norses-mdg) · [Trait Marque de Khorne (MDG)](#trait-marque-de-khorne-mdg)
**Implémente :** _(généré — `npm run raw:implemente`)_
- `MDG 7` (l.222-260) → `hiddenGroupsOf`, `TraitInstance`, `passiveCastPenalties`, `careerTalentAdditions`, `traitGrantedTalents`, `effectiveTalents`, `humains-bjornling-norse`, `humains-sarl-norse`, `humains-skaeling-norse`, `norsca`, +5 — `src/data/creatures.json`, `src/data/index.ts`, `src/data/mutations.json`, `src/data/skills.json`, `src/data/species.json`, `src/data/talents.json`, +5 fichiers

---

## Trait Marque de Khorne (MDG)

Nouveau Trait de créature introduit pour les Personnages skaelings (`MDG 07 l.250-252`).
> « Khorne a apposé une marque physique sur cette créature pour la proclamer fidèle à sa cause. La créature bénéficie du Talent Frénésie. Elle gagne le Talent Savoir-vivre (Suivants de Khorne) et éprouve de l'Animosité envers ceux qui sont ouvertement des suivants de Slaanesh. »
> — `MDG 07 l.250`

Les suivants de Slaanesh éprouvent aussi de l'Animosité envers la créature si la Marque est visible. Le Personnage **ne peut jamais utiliser** les Compétences **Langue (Magick)** et **Focalisation**, sauf pour dissiper un sort (`MDG 07 l.250`).

De plus, le Personnage peut acheter les Talents suivants **comme s'ils étaient des Augmentations de Carrière** au coût en PX normal (`MDG 07 l.252`) : Assaut féroce, Charge berserk, Combat instinctif, Coup puissant, Déterminé, Endurci, Guerrier né, Résistance (Magie), Résistance à la magie, Vigilance.

**Sources RAW** : `MDG 07 l.250-252`
**Voir aussi** : [Origines norses et Personnages norses (MDG)](#origines-norses-et-personnages-norses-mdg) · [`talents.md`](talents.md) (Frénésie)
**Implémente :** _(généré — `npm run raw:implemente`)_
- `MDG 7` (l.250-252) → `hiddenGroupsOf`, `TraitInstance`, `passiveCastPenalties`, `careerTalentAdditions`, `traitGrantedTalents`, `effectiveTalents`, `humains-bjornling-norse`, `humains-sarl-norse`, `humains-skaeling-norse`, `norsca`, +3 — `src/data/index.ts`, `src/data/skills.json`, `src/data/species.json`, `src/data/talents.json`, `src/data/traits.json`, `src/engine/groups.ts`, +3 fichiers

<!-- VDM-CARRIERES-ARCANIQUES -->

## Nouvelles Carrières arcaniques (VDM)

*Les Vents de Magie* ajoute **quatre nouvelles Carrières** liées à la pratique de la Magie dans l'Empire — **Alchimiste ordinaire, Bedeau, Devin, Magister Vigilant** — en plus des **huit Carrières de Sorciers** de Collège détaillées aux chapitres 4 à 11 (Hiérophante, Alchimiste, Druide, Astromancien, Umbramancien, Spirite, Pyromancien, Chamane). Ces carrières de Collège n'obsolètent PAS la Carrière générale de Sorcier du LDB (p. 92).

> « En plus des quatre nouvelles Carrières liées à la pratique de la Magie dans l'Empire, ce livre présente également huit Carrières de Sorciers (voir les **Chapitres 4 à 11**). Chacune expose l'une des traditions de Magie enseignées par les Collèges de Magie, fondés sur les instructions de Teclis, l'ancienne carrière de Sorcier n'est pas obsolète pour autant. »
> — VDM 03 l.9

**Choix Sorcier de Collège vs Sorcier général** (VDM 03 l.11) : à la création d'un Sorcier ou en accédant à la carrière de Sorcier, le joueur choisit soit une carrière de Collège de ce livre, soit le Sorcier du LDB (p. 92).

**Affiliation obligatoire à un Collège** — dans les deux cas :

> « Dans les deux cas, le Personnage doit s'affilier à l'un des Collèges de Magie. Les Carrières de ce livre imposent une adhésion sincère aux traditions et usages de l'un d'entre eux, alors que celle du **Livre de Règles de WFJDR** propose une approche plus générale ou individuelle de la pratique d'un Domaine de Magie. »
> — VDM 03 l.13

Les quatre nouvelles Carrières restent des Carrières **communes à l'Empire**, accessibles par changement de Carrière comme n'importe quelle autre :

> « De plus, ces Carrières sont toujours communes à l'Empire et les Joueurs peuvent s'acheminer vers n'importe laquelle, si l'expérience et la situation le permettent. »
> — VDM 03 l.21

Détails par niveau (compétences/talents/possessions) de chaque carrière → catalogue (`src/data/careerLevels.json`), comme pour le reste de l'index.

**Sources RAW** : `VDM 03 l.9`, `l.11`, `l.13`, `l.21`
**Voir aussi** : [Structure d'une Carrière](#structure-dune-carrière) · [Changer de Carrière](#changer-de-carrière) · [Index des carrières](#index-des-carrières)

---

## Obtenir aléatoirement les nouvelles Carrières (VDM)

Quand on tire une Carrière au tableau des Carrières aléatoires du LDB (p. 30-31), certaines Carrières existantes ouvrent un **second lancer** qui peut donner à la place une nouvelle Carrière de ce livre.

> « Si vous vous servez du tableau des Carrières aléatoires de **WFJDR** (pages 30–31) pour en choisir une, référez-vous au tableau ci-dessous pour voir si elle peut donner lieu à plus d'options. Si c'est le cas, lancez à nouveau les dés pour voir si celles de ce livre s'appliquent à la place. »
> — VDM 03 l.17

Le joueur peut **toujours** renoncer au second lancer et rester dans sa Carrière d'origine (VDM 03 l.19).

**Tableau d'obtention aléatoire (d100 au second lancer)** (verbatim, `VDM 03 l.23-31`) :

| Carrière existante | Second lancer |
|---|---|
| **LETTRÉS** | |
| Apothicaire | 01-15 : Alchimiste ordinaire<br>16-00 : Apothicaire |
| Sorcier | 01–95 : Choisissez la Carrière de Sorcier dans le Livre de Règles de WFJDR ou bien l'une de celles spécifiques à un Collège (Hiérophante, Alchimiste, Druide, Astromancien, Umbramancien, Spirite, Pyromancien ou Chamane).<br>96–00 : Magister Vigilant |
| **GUERRIERS** | |
| Garde | 01–15 : Bedeau<br>16–00 : Garde |
| **RURAUX** | |
| Mystique | 01–10 : Devin<br>11–00 : Mystique |

> Lecture des Classes : le second lancer place chaque nouvelle Carrière dans la Classe de la Carrière existante dont elle dérive — **Alchimiste ordinaire** et **Magister Vigilant** = Lettrés ; **Bedeau** = Guerriers ; **Devin** = Ruraux.

**Sources RAW** : `VDM 03 l.17`, `l.19`, `l.23-31`
**Voir aussi** : [Carrières hors classe et changements alternatifs](#carrières-hors-classe-et-changements-alternatifs) · [Index des carrières](#index-des-carrières)

---

## 10 Compétences de départ (VDM)

Les Carrières de ce livre proposent **10 Compétences** au premier Niveau au lieu de 8.

> « Vous noterez que plutôt que d'avoir 8 Compétences disponibles à choisir au premier Niveau de Carrière, ceux de ce livre en ont 10. »
> — VDM 03 l.35

Pour compléter le niveau et progresser, il faut en augmenter **au moins 8** (2 peuvent rester non augmentées) :

> « Pour progresser vers un nouveau Niveau de Carrière, vous devez augmenter au moins 8 de ces Compétences, comme indiqué dans le **Livre de Règles de WFJDR**. Vous pouvez donc en choisir 2 à ne pas augmenter. »
> — VDM 03 l.37

> Même mécanique que la carrière **Frère Loup** (Middenheim ANN.II) déjà couverte plus bas : plus de 8 Compétences au N1, seulement 8 à augmenter pour compléter le niveau. (VDM 03 ne rappelle pas ici l'obligation d'augmenter la Compétence en italique « Gagner de l'argent » ; cette règle LDB reste valable par ailleurs.)

**Sources RAW** : `VDM 03 l.35`, `l.37`
**Voir aussi** : [Compléter un Niveau de Carrière](#compléter-un-niveau-de-carrière) · [Carrières hors classe et changements alternatifs](#carrières-hors-classe-et-changements-alternatifs)

---

## Carrière Alchimiste ordinaire (VDM)

- **Classe** : Lettrés (dérive d'Apothicaire au tableau d'obtention, VDM 03 l.26).
- **Races** : Nain, Halfling, Humain (VDM 03 l.42).
- **Niveaux (nom — Statut)** : Rétameur (Bronze 3) → Alchimiste ordinaire (Argent 2) → Maître Alchimiste ordinaire (Argent 3) → Transmutateur (Or 1) (VDM 03 l.64, l.72, l.78, l.86). Détails par niveau → catalogue.

Experts des propriétés de la matière (matériaux, préparations chimiques, poudre noire, savons, teintures, médicaments…) :

> « Rompus aux propriétés de la matière, les Alchimistes sont des experts dans la création de matériaux nouveaux et dans l'amélioration de ceux déjà existants. »
> — VDM 03 l.46

**Lien à Chamon et au Collège Doré** (place dans les Collèges) :

> « L'art de l'alchimie est inextricablement lié à *Chamon*, le vent de la transmutation et de l'expérimentation. »
> — VDM 03 l.111

> « C'est pourquoi le Collège Doré entretient de bonnes relations avec des institutions alchimiques dans l'Empire et les soutient même financièrement. »
> — VDM 03 l.113

### Lancement de sorts pour les alchimistes (règle)

L'Alchimiste ordinaire peut accéder aux Talents **Magie mineure** et **Magie des Arcanes (Métal)**, mais ceux qui les prennent ne peuvent apprendre qu'une **liste fermée** de sorts (VDM 03 l.131) :

> « Les alchimistes peuvent accéder aux Talents Magie mineure et Magie des Arcanes (Métal). Pour représenter un lien inné et instinctif avec *Chamon*, ceux qui les choisissent ne peuvent apprendre que les Sorts suivants : »
> — VDM 03 l.131

- **Magie mineure :** Alerte, Choc, Repères, Serrure ouverte (VDM 03 l.133).
- **Sorts d'Arcane :** Aura ordinaire, Protection (VDM 03 l.135).
- **Domaine du Métal :** Arme enchantée, Forge de *Chamon*, Métal changeant, L'Or des fous (VDM 03 l.137).

Pour davantage de sorts et une licence de pratique, il faut prendre une Carrière de Sorcier :

> « Il faudrait qu'ils choisissent une Carrière de Sorcier s'ils voulaient avoir accès à plus de sorts et obtenir une licence de pratique de la Magie. »
> — VDM 03 l.139

**Restriction raciale de lancement** :

> « Les alchimistes nains et halflings ne peuvent pas devenir des lanceurs de sorts et ne peuvent pas prendre les Talents suivants : *Magie mineure* et *Magie des Arcanes (Métal)*. »
> — VDM 03 l.141

**Sources RAW** : `VDM 03 l.42`, `l.46`, `l.64`, `l.72`, `l.78`, `l.86`, `l.111`, `l.113`, `l.131`, `l.133`, `l.135`, `l.137`, `l.139`, `l.141`
**Voir aussi** : [Structure d'une Carrière](#structure-dune-carrière) · [Obtenir aléatoirement les nouvelles Carrières (VDM)](#obtenir-aléatoirement-les-nouvelles-carrières-vdm) · [Index des carrières](#index-des-carrières)

---

## Carrière Bedeau (VDM)

- **Classe** : Guerriers (dérive de Garde au tableau d'obtention, VDM 03 l.29).
- **Niveaux (nom — Statut)** : Aide bedeau (Argent 1) → Bedeau (Argent 2) → Gardien des lieux (Argent 4) → Terreur de la faculté (Argent 5) (VDM 03 l.160, l.166, l.174, l.182). Détails par niveau → catalogue.

Garde spécialisé des institutions savantes (universités, Collèges de Magie) :

> « Vous êtes un garde spécialisé, contrebalançant surveillance et bras armé par la dignité qu'attend l'institution que vous protégez. »
> — VDM 03 l.144

> « C'est pourquoi ces dernières ont besoin de personnel plus pragmatique : les bedeaux. Ils protègent les salles, les bibliothèques et les laboratoires des établissements contre les voleurs ou les espions, et avant tout contre les étudiants qui se comportent mal. »
> — VDM 03 l.148

**Rôle et responsabilités** (VDM 03 l.197) : entretien des bâtiments, gestion des fournitures, relations avec les autorités, rites et traditions de l'établissement.

> « Les bedeaux ont la responsabilité de veiller à ce que les universitaires d'une institution soient pleinement secondés afin qu'ils puissent se consacrer à leurs travaux. »
> — VDM 03 l.202

**Sources RAW** : `VDM 03 l.144`, `l.148`, `l.160`, `l.166`, `l.174`, `l.182`, `l.197`
**Voir aussi** : [Structure d'une Carrière](#structure-dune-carrière) · [Obtenir aléatoirement les nouvelles Carrières (VDM)](#obtenir-aléatoirement-les-nouvelles-carrières-vdm) · [Index des carrières](#index-des-carrières)

---

## Carrière Devin (VDM)

- **Classe** : Ruraux (dérive de Mystique au tableau d'obtention, VDM 03 l.31).
- **Niveaux (nom — Statut)** : Hanté (Bronze 1) → Devin (Bronze 3) → Psychométricien (Argent 2) → Rétrolecteur (Or 1) (VDM 03 l.259, l.267, l.277, l.287). Détails par niveau → catalogue.

Le Devin lit le passé au contact d'une personne, d'un objet ou d'un lieu (capacité innée rare, portée par la Compétence Psychométrie) :

> « Vous possédez la capacité rare de comprendre des faits passés au contact d'une personne, d'un objet ou d'un endroit. »
> — VDM 03 l.241

> « Très peu d'humains possèdent la capacité de voir le passé en touchant un objet ou une personne en particulier ou ce qui s'est déroulé à un endroit précis. »
> — VDM 03 l.243

**Interaction avec la Compétence Psychométrie** : les restrictions d'apprentissage de Psychométrie (nécessité d'entamer d'abord une Carrière donnée) ne s'appliquent PAS au Personnage dont la Carrière de départ est Devin :

> « Ces limites ne s'appliquent pas aux Personnages dont la Carrière de départ est Devin. »
> — VDM 03 l.611

**Sources RAW** : `VDM 03 l.236`, `l.238`, `l.259`, `l.267`, `l.277`, `l.287`, `l.569`
**Voir aussi** : [Structure d'une Carrière](#structure-dune-carrière) · [Obtenir aléatoirement les nouvelles Carrières (VDM)](#obtenir-aléatoirement-les-nouvelles-carrières-vdm) · [`competences.md`](competences.md) (Psychométrie)

---

## Carrière Magister Vigilant (VDM)

- **Classe** : Lettrés (obtenue au second lancer depuis Sorcier, résultat **96–00**, VDM 03 l.27).
- **Rôle** : chasse et élimine les sorciers renégats pour protéger la réputation des Collèges. Détails par niveau → catalogue.

> « Vous protégez la réputation des Collèges en chassant et en éliminant les sorciers renégats. »
> — VDM 03 l.358

**Place dans les Collèges** — chaque Collège en finance un petit effectif ; existence officiellement niée :

> « Bien que les Patriarches des Collèges refusent de confirmer leur existence, même le dernier des apprentis sorciers a entendu parler des Magisters Vigilants : ces sorciers qui débusquent et détruisent tous les parjures et traîtres à leur ordre. Chaque Collège finance un petit effectif de Magisters Vigilants, mais on raconte que le Collège Gris commandite plusieurs de leurs membres pour endosser ce rôle au cours de leurs carrières. »
> — VDM 03 l.360

**Profil de la Carrière** — plutôt qu'un sorcier « vitrine », un hybride espion/investigateur/répurgateur/sorcier :

> « Contrairement aux autres sorciers, il ne faut pas s'attendre à ce que les Magisters Vigilants prennent en charge des apprentis ou fassent étalage de tous leurs talents de sorcier. »
> — VDM 03 l.414

> « Les Magisters Vigilants font leurs rapports au patriarche d'un Collège, leur supérieur, souvent seul à connaître leur rôle secret. Et même s'ils le consultent, ils sont juge, juré et bourreau, tout à la fois. »
> — VDM 03 l.416

**Sources RAW** : `VDM 03 l.27`, `l.349`, `l.351`, `l.372`, `l.374`
**Voir aussi** : [Obtenir aléatoirement les nouvelles Carrières (VDM)](#obtenir-aléatoirement-les-nouvelles-carrières-vdm) · [Structure d'une Carrière](#structure-dune-carrière) · [Index des carrières](#index-des-carrières)

## Bilan

- **Système** : couvert (Classes, structure des 4 niveaux, Schéma de Progression, emplacements Au choix, avancement, hors-carrière, complétion, changement de Carrière avec tous les coûts).
- **Statut** : couvert (Échelons Bronze/Argent/Or, Standing, effets sociaux par compétence, réactions PNJ, conserver les apparences, table de revenus verbatim).
- **Carrières indexées** :
  - LDB : 64 carrières (8 par classe × 8 classes), noms des 4 niveaux + Statut de chaque niveau.
  - ADE I : 4 carrières raciales (Chevaucheur de Blaireau, Gardechamps, Patrouilleur des Karak, Rôdeur Fantôme).
  - ADE II / AA : 18 carrières supplémentaires (Mangeur d'Hommes, Boucher Ogre, + 16 militaires/ordres).
  - Middenheim : 1 carrière (Frère Loup), 3 origines humaines.
  - MDG : 9 carrières (8 Côtiers + Prêtre de Stromfels, MDG 11), 3 origines humaines norses + nains norses.
- **Refs code couvertes** : `src/engine/careerSlots.ts` — accumulation de compétences (`skillSlots` l.153-156), talents du niveau courant uniquement (`talentSlots` l.158-162), emplacements Au choix (`parseEntry`, `wildcardSpecs`), maxi talent (`talentMaxById`).
- **Détails par niveau des carrières (compétences/talents/possessions) = catalogue volumineux à transcrire séparément (présent dans `src/data/careerLevels.json`).**
- **Anomalies données** : typo « Agent 1 » pour Nautonier N2 dans `careerLevels.json` (ligne 15499) ; Receleur N4 et Patrouilleur Fluvial N4 avec Argent 1 semblent inattendus — à vérifier contre la source LDB p. 101+.
