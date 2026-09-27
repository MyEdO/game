# Atlas RAW — Équipement, objets & encombrement

> Référentiel **autosuffisant** des règles WFRP4 (RAW), consolidé sur les livres autorisés, à usage
> d'agent (répondre + auditer le code sans rouvrir les livres). Chaque règle cite `LDB NN l.X-Y`
> (NN = préfixe du fichier de chapitre, l = lignes du `.md` source).
> Abréviations : [`sources.md`](../sources.md). Index : [`00-index.md`](00-index.md).
>
> **Périmètre de ce fichier** : Encombrement, qualités/défauts d'objet, Disponibilité/fabrication
> (→ renvoi `economie.md`), Drogues & Poisons (LDB 71), Herbes & Potions (LDB 72), Prothèses (LDB 73),
> Outils à effet mécanique (LDB 67), Possessions diverses à effet (LDB 74).
> Armes → [`combat.md`](combat.md). Armures → [`combat.md`](combat.md).
> Encombrement voyage + pénalités Mouvement → [`deplacement.md`](deplacement.md) (table complète là-bas).
> ⚠️ Les champs **Implémente** sont GÉNÉRÉS (`npm run raw:implemente` — source éditoriale : `src/data/raw.manifest.json`) — ne pas les éditer à la main.
> Prix / Disponibilité / Fabrication → [`economie.md`](economie.md).

## Sommaire

- [Encombrement — calcul et seuils](#encombrement--calcul-et-seuils)
- [Encombrement — pénalités (Surchargé)](#encombrement--pénalités-surchargé)
- [Encombrement — règles spéciales](#encombrement--règles-spéciales)
- [Qualités d'objet — Atouts et Défauts → voir economie.md](#qualités-dobjet--atouts-et-défauts-renvoi)
- [Drogues et poisons](#drogues-et-poisons)
- [Herbes et potions](#herbes-et-potions)
- [Prothèses](#prothèses)
- [Outils et nécessaires à effet mécanique](#outils-et-nécessaires-à-effet-mécanique)
- [Possessions diverses à effet](#possessions-diverses-à-effet)
- [Catalogue banal — à transcrire séparément](#catalogue-banal--à-transcrire-séparément)
- [Voir aussi](#voir-aussi)
- [Implémente (refs code)](#implémente-refs-code)

- **La Mer des Griffes (MDG)** <!-- MDG-INTEGRATION -->
- Navires — profil et Caractéristiques (MDG) : Caractéristiques de bateau (Coût, Équipage, Voiles/Avirons M (É), Man, Taille, E/BE, B/BB, Contenance), table de surcharge, Traits vs Améliorations
- Construction navale (MDG) : 4 étapes (Taille → propulsion ±2 M / min 3 → coût-Manœuvre → coût-vitesse), tables standard et de coût
- Traits de navire (MDG) : Peu maniable, Renforcé, Robuste, Solide (effets E/B/Contenance/DR + modif. coût)
- Améliorations de navire (MDG) : Ancre, Bélier, Blindage, Cabine de luxe, Clinfoc, Embarcation de bord, Figure de proue, Freins, Lissage, Nid-de-pie, Propulsion à vapeur, Ralentisseurs latéraux, Sabord
- Pièces d'artillerie navale (MDG) : Balistes/Canons/Mortiers/Pierriers, munitions, placement des canons, nouveaux Atouts/Défauts (Arme d'équipe, Tir de zone)

---

## Encombrement — calcul et seuils

**Source : LDB 61 l.4-17**

> Verbatim LDB 61 l.4 : « Le nombre de Points d'Encombrement que vous pouvez gérer sans pénalité est
> déterminé par votre Bonus de Force + votre Bonus d'Endurance. »

**Capacité sans pénalité** = **Bonus de Force (BF) + Bonus d'Endurance (BE)**

*Exemple* : humain moyen (F 30, E 30) → BF 3 + BE 3 = **6 Points d'Enc**.

### Exemples d'Encombrement (LDB 61 l.8-16)

| Enc | Possessions types |
|---|---|
| 0 | Couteaux, pièces, bijoux |
| 1 | Épée, mandoline, besace |
| 2 | Épée longue, tente, sac à dos |
| 3 | Hallebarde, tonneau, grand sac |

---

## Encombrement — pénalités (Surchargé)

**Source : LDB 61 l.33-43**

> Verbatim LDB 61 l.33 : « Les Personnages qui dépassent leur capacité d'Encombrement peuvent être
> ralentis, et seront fatigués par le voyage. La réduction de Mouvement et la Fatigue du voyage
> résultant de l'Encombrement se cumulent avec toutes les pénalités d'Armure. »

| Enc porté | Pénalité |
|---|---|
| ≤ capacité | Pas de pénalité |
| ≤ 2 × capacité | −1 Mouvement (min 3), −10 Agilité, +1 Fatigue du voyage |
| ≤ 3 × capacité | −2 Mouvement (min 2), −20 Agilité, +2 Fatigue du voyage |
| > 3 × capacité | Immobilisé (« Vous ne pouvez pas vous déplacer ») |

**États Exténué bonus** : chaque fois qu'un personnage Surchargé gagne un État *Exténué*
pour une raison autre que la Surcharge elle-même, il gagne **+1 État supplémentaire**
(LDB 61 l.33).

**Pénalités de Mouvement** : appliquées **immédiatement** ; disparaissent seulement en se
débarrassant d'équipement (LDB 61 l.43).

**Fatigue du voyage** : États *Exténué* accumulés **en fin de journée de voyage** ;
ne s'annulent qu'avec un long repos (LDB 61 l.47).

> Voir [`deplacement.md`](deplacement.md) §§ « Encombrement et fatigue de voyage »
> pour l'intégration dans la cascade de voyage.

---

## Encombrement — règles spéciales

**Source : LDB 61 l.16-29**

### Bêtes de somme (LDB 61 l.16-19)

Les animaux de trait (mules, chevaux, charrettes, chariots) **ignorent** la formule
BF + BE ; leur capacité est listée dans leur description (champ `Contenu`).
Chaque passager de taille humaine compte pour **~10 Points d'Enc** (modulable par le MJ).

### Objets portés (LDB 61 l.21)

Les objets **portés** (armures, vêtements, bijoux) voient leur Encombrement **réduit de 1**,
comptant souvent à **0** quand ils sont portés.

> Exception LDB 60 l.62 (Défaut « Volumineux ») : une armure/vêtement Volumineux compte
> **Enc 1 même porté** ; ses pénalités de Fatigue sont **×2**. Voir [economie.md §Fabrication](economie.md).

### Objets surdimensionnés (LDB 61 l.24-25)

Certains objets valent **4 Enc ou plus** (barils, fontes de selles…).
- En principe, on ne peut transporter **qu'un seul** objet surdimensionné.
- Cela nécessite **les deux mains**.

### Petits objets — monnaie (LDB 61 l.28-29)

> Verbatim LDB 61 l.29 : « la monnaie vaut 1 Point d'Encombrement pour 200 pièces. »

Le bon sens dicte le nombre de petits objets transportables.

---

## Qualités d'objet — Atouts et Défauts (renvoi)

Les règles de **Fabrication** (Atouts Léger/Pratique/Raffiné/Solide, Défauts Bâclé/Laid/Peu Fiable/
Volumineux) sont dans **[`economie.md`](economie.md) § Fabrication (LDB 60 l.3-62)**.

L'effet Encombrement des Atouts/Défauts est intégré ci-dessus (§ Objets portés et § Objets surdimensionnés).

---

## Drogues et poisons

**Source : LDB 71 l.5-35**

> LDB 71 l.5 : « Les drogues récréatives, bien qu'elles ne soient pas illégales dans la majeure
> partie de l'Empire, sont fréquemment associées aux rituels douteux et au Culte de Sigmar. »
> « Le poison n'est pas illégal non plus, mais en posséder soulève inévitablement des questions sur
> l'utilisation prévue. »

Toutes ces substances ont **Enc 0**.

### Drogues récréatives

#### Bave (1 CO, Rare)
Hallucinogène extrait d'oursins caméléons des marais. Donne des visions d'un désir profond
(amour perdu, ami décédé, enfant disparu).

- Effet : Test d'**Endurance Très difficile (−30)** ou perdu dans un fantasme réaliste
  (géré par le MJ).
- **Durée** : 1d10 minutes.

#### Bonnet de fou (5 CO, Exotique)
Champignons hallucinogènes consommés par les gobelins fanatiques avant la bataille.

- Effet : +10 Force, +4 Blessures, Talent **Frénésie**.
- En fin d'effet : perd **1d10 Points de Blessure**.
- Non peaux-vertes : Test de **Résistance Intermédiaire (+0)** ou **Infection mineure**.
- **Durée** : actif tant que mâché + 2d10 minutes supplémentaires.

#### Délice de Ranald (18/–, Limitée)
Stimulant très addictif, composé synthétique (soufre, mercure…). Inhalé en poudre.

- Effet immédiat : +1 Mouvement, +10 en F / E / Ag / CC.
- Effet différé (après 3 heures) : −2 Mouvement, −20 en CC / E / F / Ag.
- **Durée** : 1 jour.

#### Fleur de lune (5 CO, Limitée)
Mousse séchée de la forêt Laurelorn. Utilisée comme tranquillisant et anesthésique.

- Effets sur les elfes : +30 aux Tests pour résister à la Peste noire.
- Effets sur les autres races (vapeurs inhalées) :
  - Test de **Force Mentale Très difficile (−30)** raté → État *Inconscient*.
  - Réussi : +20 aux Tests de Calme + 1 État *Exténué*.
- **Durée** : 1d10 + 5 heures.

#### Mystracine (4/–, Rare)
Drogue de rue courante. Mâchée pour euphorie et hallucinations.

- Effet : +10 aux Tests d'Endurance et de Force Mentale ; −10 aux Tests d'Agilité,
  d'Initiative et d'Intelligence.
- **Durée** : active tant que mâchée + 1d10 × 10 minutes supplémentaires.

#### Racine de mandragore (1 CO, Rare)
Substance hallucinogène extrêmement addictive. Pousse sous les potences.

- Effet : chaque Round, Test de **Force Mentale** pour effectuer une Action ou un Mouvement
  (un au choix). Mouvement réduit de moitié. +20 aux Tests de Calme.
- **Durée** : active tant que mâchée + 1d10 × 10 minutes supplémentaires.

### Poisons

#### Brise-cœur (40 CO, Exotique)
Combinaison du venin d'Amphisbaena et de Jabberslythe. Inodore et incolore.

- Effet : ingéré → **4 États *Empoisonné*** infligés.
- Antidote : Test de **Résistance Complexe (−10)**.

#### Lotus noir (20 CO, Exotique)
Sève d'une plante des jungles des Terres du Sud. Utilisée pour enduire les lames.

- Effet : toute victime subissant au moins **1 Point de Blessure** d'une lame
  enduite reçoit immédiatement **2 États *Empoisonné***.
- Antidote : Test de **Résistance Complexe (−10)**.

### État Empoisonné — mécanique (rappel, LDB 16)

> Voir [`etats.md`](etats.md) § Empoisonné pour la mécanique complète.

Synthèse : chaque Point de Blessure infligé par Empoisonné ignore les modificateurs.
Test de **Résistance** en fin de Round : succès → retire 1 + DR pions d'Empoisonné,
mais gagne 1 État *Exténué*.

---

## Herbes et potions

**Source : LDB 72 l.3-32**

> LDB 72 l.25 : « Les herbes médicinales peuvent être achetées ou cueillies dans la nature (voir
> Trouver de la nourriture et des herbes page 131). Une préparation avec des Outils de profession
> (Herboriste) est en général nécessaire pour extraire les principes médicinaux des plantes et
> concocter des cataplasmes. Les potions peuvent être brassées en utilisant la Compétence
> Métier (Apothicaire). »

Toutes ces substances ont **Enc 0**.

### Table (LDB 72 l.26-32)

| Objet | Coût | Disponibilité |
|---|---|---|
| Belladone | 3 CO | Rare |
| Cataplasme de guérison | 12/– | Commune |
| Faxtoryll | 15/– | Exotique |
| Potion de guérison | 10/– | Limitée |
| Potion de vitalité | 18/– | Limitée |
| Racine de terre | 5 CO | Limitée |
| Soude commune | 12/– | Commune |
| Tonique digestif | 3/– | Commune |

### Effets

#### Belladone (3 CO, Rare)
Plonge la victime dans un profond sommeil au bout de 2-3 heures, sauf si elle réussit
un Test de **Résistance**.

- Sommeil induit : **1d10 + 4 heures**.
- **Dose** : 1 par personne.

#### Cataplasme de guérison (12/–, Commune)
Bande médicinale à base d'excréments et d'urine animaux + herbes communes
(sigmafoil, tarrabeth, valériane).

- Effet : **aucune Infection mineure** ne résulte d'une Blessure Critique traitée avec ce cataplasme.

#### Faxtoryll (15/–, Exotique)
Coagulant végétal appliqué sur une plaie.

- Effet : retire **tous les États *Hémorragique*** sans Test de Guérison.
- **Dose** : 1 par Blessure Critique.

#### Potion de guérison (10/–, Limitée)
> Verbatim LDB 72 l.24 : « si vous avez plus de 0 Blessure, récupérez immédiatement un nombre
> de Points de Blessure égal à votre Bonus d'Endurance. »

- Condition d'usage : avoir > 0 Blessure.
- Soin : = **Bonus d'Endurance** du buveur.
- **Dose** : 1 par rencontre.

#### Potion de vitalité (18/–, Limitée)
> Verbatim LDB 72 l.28 : « boire cette décoction retire instantanément tous les États *Exténué*. »

- Effet : retire **tous** les pions *Exténué*.

#### Racine de terre (5 CO, Limitée)
Ingérée pour annuler les effets de bubons causés par la Peste noire.

- Effet : annule les bubons de Peste noire (l'odeur persiste). +10 à tous les Tests concernant la maladie.
- **Dose** : 1 par jour.

#### Soude commune (12/–, Commune)
Branche écrasée maintenue sous le nez.

- Effet : retire **1 État *Sonné***.
- **Dose** : 1 par rencontre.

#### Tonique digestif (3/–, Commune)
- Effet : +20 aux Tests pour se remettre de maux d'estomac (Courante galopante, Flux sanglant — LDB 20).

---

## Prothèses

**Source : LDB 73 l.4-29**

> LDB 73 l.4 : « Que ce soit à cause d'une maladie, de la guerre ou de la malchance, il est assez
> courant dans l'Empire de perdre une partie de son corps. »

> LDB 73 l.5 : « Toutes les prothèses ont un Encombrement de 0 quand elles sont portées. »

### Table (LDB 73 l.7-18)

| Objet | Coût | Enc (non porté) | Disponibilité |
|---|---|---|---|
| Cache-œil | 6 sc | 0 | Commune |
| Crochet | 3/4 | 1 | Commune |
| Dents en bois | 10/– | 0 | Rare |
| Fausse jambe | 16/– | 2 | Limitée |
| Merveille d'ingénierie | 20 CO | 1 | Exotique |
| Nez doré | 18/– | 0 | Limitée |
| Œil de verre | 1 CO | 0 | Rare |

### Effets

#### Cache-œil (6 sc)
Souvent décoratif. Recouvre un globe oculaire meurtri. Pas d'effet mécanique propre.

#### Crochet (3/4, Commune)
Remplace une main manquante.

- Pénalité de base : **−20** à tous les Tests impliquant deux mains.
- Réduction de la pénalité : pour **100 PX** chaque tranche de 5 points soustraite.
  Pénalité entière supprimée pour **400 PX**.
- En combat : le Crochet est considéré comme une **Dague**.

#### Dents en bois (10/–, Rare)
Souvent magnifiquement sculptées. Ignorent **toutes les pénalités** dues à la perte de dents.

#### Fausse jambe (16/–, Limitée)

> LDB 73 l.23 : « une fausse jambe (ou juste un faux pied, pour la moitié du prix) vous permet
> d'ignorer 1 Point de Mouvement perdu par la perte de votre membre. »

- Faux pied uniquement : **moitié du prix** (8/–).
- Ignore **1 Point de Mouvement** perdu.
- Pour **100 PX** : récupère le dernier Point de Mouvement perdu (entraînement).
- Pour **200 PX** supplémentaires : réapprend **Esquive** (perdue avec la jambe).
- Condition : ne pas perdre la fausse jambe elle-même.

#### Merveille d'ingénierie (20 CO, Exotique)
Prothèse à vapeur commandée à une Guilde d'Ingénieurs.

- Ignore complètement la perte d'une oreille, d'une main, d'un bras ou d'une jambe
  (tant que la machinerie fonctionne).
- Si la Merveille subit une **Blessure Critique** : tombe en panne automatiquement.
  Réparation : **≥ 10 % du prix de base** (selon la Blessure).

#### Nez doré (18/–, Limitée)
Souvent en bois ou céramique (le terme « doré » est resté).

- Ignore la perte de **Sociabilité** due à l'absence de nez.

#### Œil de verre (1 CO, Rare)
Du bois au verre poli. Pas d'effet mécanique propre (cosmétique).

---

## Outils et nécessaires à effet mécanique

**Source : LDB 67 l.3-63**

> LDB 67 l.3 : « La majorité des outils sont considérés comme des armes Improvisées quand ils sont
> utilisés durant un combat. Cependant les MJ peuvent décider que des outils lourds ou tranchants
> (par exemple les pieds-de-biche et les faucilles) comptent comme des Armes de poing. »

Seuls les outils conférant un **bonus ou effet de règle** sont listés ici. Les listes de prix
complètes (aiguille, balai, binette…) relèvent du catalogue banal.

### Outils à effet

#### Bésicles (3 CO, Rare ; Enc 0)
> LDB 67 l.7 : « confèrent un bonus de +20 aux Tests de Lire/Écrire pour déchiffrer une écriture
> minuscule ou inintelligible. »

+20 aux Tests de **Perception** pour chercher des détails précis (porte/compartiment secret).

#### Menottes (18/–, Limitée ; Enc 0)
> LDB 67 l.11 : « les prisonniers qui essaient de se libérer de menottes subissent 1 Blessure et
> doivent réussir un Test de Force Très difficile (−30). »

#### Nécessaire antipoison (3 CO, Limitée ; Enc 0)
Contient : petit couteau + herbes + bocal de sangsue.

> LDB 67 l.13 : « Un Test de Guérison réussi avec un nécessaire antipoison retire tous les États
> *Empoisonné*. Le traitement prend au moins deux Rounds. »

#### Nécessaire de déguisement (6/6, Limitée ; Enc 0)
Pas de bonus chiffré dans LDB 67 — l'usage relève de la Compétence **Tromperie** (LDB 09).
Inclus pour mémoire (référencé dans les Carrières).

#### Outils de crochetage (15/–, Limitée ; Enc 0)
Requis pour tenter **Crochetage de serrure** (LDB 09 — Dextérité). Sans eux : pénalité ou impossibilité selon le MJ.

#### Télescope (5 CO, Rare ; Enc 0)
Pas de bonus RAW chiffré dans LDB 67 — effet à discrétion du MJ (amélioration de Perception à distance).

### Principe général : Outils de profession

Les Outils de profession et les Ateliers (LDB 69) sont **requis** pour la plupart des Activités
professionnelles (Artisanat, Soins, Herboristerie, Alchimie…). L'absence d'outil approprié
entraîne une **impossibilité ou une pénalité de Test** fixée par le MJ.
Détail complet → [`activites.md`](activites.md) § Artisanat.

---

## Possessions diverses à effet

**Source : LDB 74 l.5-62 (début de section « Possessions Diverses »)**

Les objets divers sans effet mécanique (affiche, allumette, assiette…) relèvent du catalogue banal.
Seuls les effets chiffrés sont transcrits ici.

#### Bandages (4 sc, Commune ; Enc 0)
> LDB 74 l.41 : « un Test de Guérison ou de Dextérité réussi retire +1 État *Hémorragique*
> supplémentaire. »

*Note* : l'effet « Objet porté lors d'un soin : pas d'Infection » relève du Cataplasme de guérison
(LDB 72), pas des Bandages seuls.

#### Bougie / douzaine (1/–, Commune ; Enc 0)
> LDB 74 l.43 : « fournit un éclairage sur **10 mètres** lorsqu'elle est allumée. »

#### Lanterne (2/–, Commune ; Enc 1)
> LDB 74 l.58 : « fournit un éclairage sur **20 mètres**. »

#### Lampe tempête (5/–, Peu commune ; Enc 1)
> LDB 74 l.56 : « des obturateurs protègent la flamme du vent, et permet également de diriger la lumière dans un arc de 90° ou de l'obscurcir complètement. Fournit un éclairage sur 20 mètres, ou 30 quand il est ciblé. »

---

### Éclairage — récapitulatif mécanique

| Source | Rayon standard | Rayon ciblé | Ref |
|---|---|---|---|
| Bougie (ou équivalent) | 10 m | — | `LDB 74 l.43` |
| Lanterne | 20 m | — | `LDB 74 l.58` |
| Lampe tempête | 20 m | 30 m (arc 90°) | `LDB 74 l.56` |

Échelle moteur : 1 case = 2 m → Bougie = 5 cases, Lanterne = 10 cases, Lampe tempête 10/15 cases.

Le Talent **Vision nocturne** étend le rayon effectif de toute source de lumière de **+20 m / niveau** (`LDB 11 l.176`).

**Sources RAW :** `LDB 74 l.43` (Bougie), `LDB 74 l.56-58` (Lampe tempête, Lanterne)

**Voir aussi :** `talents.md` § Vision nocturne — extension de portée d'éclairage.

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 11` (l.176) → `ambush-vigilance`, `TraitCapabilities`, `trappeur`, `travailleur-qualifie`, `tres-fort`, `tres-resistant`, `tricheur`, `tueur`, `veloce`, `vigilance`, +5 — `src/data/combat-stakes.json`, `src/data/index.ts`, `src/data/talents.json`, `src/state/vision.ts`
- `LDB 74` (l.5-62) → `SANS_LIVRE`, `doc`, `rayonEnCases`, `PropData`, `possessions-diverses`, `ItemCapabilities`, `GameOp` — `src/data/index.ts`, `src/data/props.json`, `src/data/props.types.ts`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs/props.ts`, `src/data/schemas/grammaire/sans-livre.ts`, +3 fichiers

#### Grappin (1 CO, Limitée ; Enc 1)
> LDB 74 l.45 : « couplé à une corde, il permet de gravir des surfaces inaccessibles. »

Utilisé avec Corde (Enc 1, 8/4 la corde de 10 m). Test d'Athlétisme selon MJ.

---

## Catalogue banal — à transcrire séparément

Les chapitres suivants contiennent essentiellement des **listes de prix** sans règle propre :

| Chapitre LDB | Contenu | Traitement |
|---|---|---|
| **64** — Sacs et contenants | Besaces, sacs à dos, coffres… + capacité (Contenu en Enc) | Catalogue — Disponibilité et Contenu utiles pour l'éditeur |
| **65** — Vêtements et accessoires | Chemises, manteaux, bottes, bijoux… | Catalogue banal |
| **66** — Nourriture, boisson et hébergement | Rations, bière, auberge/pension… | Catalogue + règles Faim → [`activites.md`](activites.md) |
| **68** — Livres et documents | Cartes, parchemins, journaux intimes… | Catalogue banal |
| **69** — Outils professionnels et Ateliers | Kits par métier (Forgeron, Herboriste…) | Catalogue — requis pour les Activités (voir `activites.md`) |
| **74** — Possessions diverses | Objet courant (corde, tente, sac de couchage…) | Catalogue — exceptions à effet listées ci-dessus |
| **75** — Mercenaires | Coût journalier / hebdomadaire + bonus | Catalogue de PNJ recrutables |
| **70** — Animaux et véhicules | Montures, véhicules, animaux de trait + Contenu | Catalogue + règles montures → [`deplacement.md`](deplacement.md) |

---

## Voir aussi

- **Combat** [`combat.md`](combat.md) — armes, armures, dégâts d'arme, dégâts d'armure
- **Déplacement** [`deplacement.md`](deplacement.md) — Mouvement, Encombrement et fatigue voyage,
  montures, véhicules
- **Économie** [`economie.md`](economie.md) — prix, Disponibilité, Marchandage, Fabrication (Atouts/Défauts)
- **États** [`etats.md`](etats.md) — Empoisonné, Hémorragique, Exténué, Sonné (mécaniques complètes)
- **Maladies** [`maladies.md`](maladies.md) — Infection mineure, Peste noire, Courante galopante…
- **Activités** [`activites.md`](activites.md) — Soins, Artisanat, Trouver de la nourriture et herbes

---

## Implémente (refs code)

| Ref source | Fichier | Mécanique |
|---|---|---|
| `LDB 61 l.4` | `src/engine/items.ts` : `maxEncumbrance` | Capacité = BF + BE + bonus talent Robuste |
| `LDB 61 l.21` | `src/engine/items.ts` : `totalEncumbrance` l.205 | Objet porté : Enc −1 (armure/vêtement) |
| `LDB 60 l.18/62` | `src/engine/items.ts` : `totalEncumbrance` l.202 | Léger −1 / Volumineux +1 via `craftEncDelta` |
| `LDB 61 l.33-43` | `src/engine/encumbrance.ts` : `encumbrancePenalties` | Table seuils 0/1/2/3× → paliers Mouvement/Agilité/Fatigue |
| `LDB 61 l.43-43` | `src/engine/encumbrance.ts` : commentaires | Mouvement immédiat ; Fatigue = échelle voyage (fin de journée) |
| `LDB 62 l.28` | `src/engine/items.ts` l.269 | Mains nues : +BF+0, Personnelle, Inoffensive |
| `LDB 63 l.18-21` | `src/engine/items.ts` l.481 / `damageArmour` | PA nette = PA − dégâts pris ; endommagement armure |
| `LDB 72 l.5-6` (p.307) | `src/engine/consumables.ts` | Parsing desc `récupérer/Blessure` → soin (Bonus d'Endurance) ; parsing `retire … État` → retrait d'État |
| `LDB 72 l.24` | `src/engine/consumables.ts` : `parseConsumable` | Potion de guérison : Bonus d'Endurance, garde-fou poison/drogue |
| `LDB 72 l.28` | `src/engine/consumables.ts` + test | Potion de vitalité : retire tout *Exténué* |
| `LDB 74 l.41` | `src/engine/consumables.ts` : `removeStacks: 1` (Bandages) | +1 pion *Hémorragique* retiré (pas « tout ») |
| `LDB 18 l.263` | `src/engine/items.ts` l.309 | Amputation → pas d'arme à 2 mains |

**Fichiers engine** : `src/engine/encumbrance.ts`, `src/engine/items.ts`, `src/engine/consumables.ts`

**Store / State** : `src/state/partyFlow.ts` (`usePartyItem`), `src/state/combatFlow.ts` (`battleUseItem`)

**Données** : `src/data/trappings.json` (catalogue avec `enc`, `kind`, `desc`)

**Écarts code ↔ RAW** :
- **Drogues** (LDB 71 : Bave, Bonnet de fou, Délice de Ranald, Mystracine, Racine de mandragore)
  et **Poisons** (Brise-cœur, Lotus noir) : effets **non modélisés** dans le moteur.
  Les données sont dans `trappings.json` (desc verbatim) mais aucun `parseConsumable` ne les active
  (effets complexes : Tests à la consommation, modificateurs temporaires de carac, dégâts différés).
- **Prothèses** : Crochet (réduction pénalité par PX) et Fausse jambe (récupération Mouvement + Esquive)
  non suivis dans `src/engine/`. Le `Combatant` n'a pas de champ `prosthetics` — à implémenter si les
  Blessures Critiques permanentes sont jouées (LDB 18).
- **Nécessaire antipoison** : règle « retire tous les États Empoisonné après Test Guérison » non
  distincte dans le moteur (le Test Guérison retire Empoisonné via `poisonResistApply` en fin de Round,
  mais le nécessaire comme objet requis n'est pas vérifié).
- **Bésicles** : +20 Lire/Écrire et +20 Perception non intégrés (objet passif non géré).

---

<!-- MDG-INTEGRATION -->

## Navires — profil et Caractéristiques (MDG)

**Source : MDG 12 l.5-81**

Comme les Personnages, les navires ont des **Caractéristiques** qui décrivent leurs capacités et peuvent porter des **Traits** leur donnant des aptitudes spéciales. Aucun bateau n'est strictement identique à un autre : son profil varie selon l'usure, la qualité de construction, l'aménagement et le style. Le profil canonique d'un navire suit le gabarit : *Nom · Coût · Équipage · Voiles M (É) · Avirons M (É) · Man · Taille · E · B · Contenance · Traits et Améliorations* (tables complètes au catalogue).

> « Comme les Personnages, les bateaux ont des Caractéristiques qui décrivent leurs capacités. » — `MDG 12 l.5`

**Coût** : prix d'un bateau neuf sortant du chantier (`MDG 12 l.17`).

**Équipage** : nombre de membres que le navire porte sans problème de place et normalement attendu à bord. Au-delà, le surnombre inflige les pénalités liées à la **Contenance** (`MDG 12 l.21`). Chaque occupant consomme de l'espace d'Équipage **et** de la Contenance selon sa Taille :

| Taille | Espaces d'équipage occupés | Enc |
|---|---|---|
| Minuscule | – | – |
| Très Petite | 0,25 | 1 |
| Petite | 0,5 | 3 |
| Moyenne | 1 | 6 |
| Grande | 3 | 18 |
| Énorme | 9 | 54 |
| Monstrueuse | 27 | 162 |

Les objets personnels portés ne comptent pas, sauf très volumineux/lourds : tant qu'un objet n'atteint pas le volume d'une petite caisse (≈30 cm³), il est ignoré pour l'Encombrement du bateau ; le MJ tranche les cas limites (`MDG 12 l.35`).

**Voiles M (É)** et **Avirons M (É)** : Caractéristique en deux nombres. Le premier (**M**) est le Mouvement du navire avec l'équipage minimum, temps beau, allure modérée. Le second (**É**) est l'effectif minimum requis pour tenir cette vitesse sur une **Période de travail** (8 h pour la voile ; 2 h pour la rame) — un effectif plus important est nécessaire pour une durée plus longue (`MDG 12 l.39`, `MDG 12 l.41`, `MDG 12 l.45`).

**Manœuvre (Man)** : modificateur appliqué aux Tests où la réactivité et l'agilité du navire comptent — notamment les Tests de **Voile** et de **Ramer** en zone dangereuse (`MDG 12 l.50`).

**Taille** : longueur du vaisseau en mètres ; influe sur la vitesse et détermine la Contenance (`MDG 12 l.54`).

**Endurance (E)** : sert à résister aux Dégâts.

> « Le premier chiffre de l'Endurance du bateau est aussi employé comme Bonus d'Endurance (BE). Le BE d'un bateau est déduit de tous les Dégâts qui lui sont infligés avant de les appliquer aux Blessures. » — `MDG 12 l.58`

**Blessures (B)** : quantité de Dégâts encaissable.

> « Le nombre des dizaines des Blessures du vaisseau est aussi employé comme Bonus de Blessures (BB). Ce Bonus est basé sur les Blessures actuelles d'un navire, c'est pourquoi il peut changer au cours d'une rencontre. » — `MDG 12 l.64`

**Contenance** : Encombrement de cargaison portable sans pénalité ; au-delà, vitesse et manœuvrabilité chutent (`MDG 12 l.68`) :

| Encombrement supplémentaire | Effet |
|---|---|
| Supérieur à la Contenance | –1 M, –1 DR Manœuvre |
| Supérieur de 20 % à la Contenance | –2 M, –2 DR Manœuvre |
| Supérieur de 40 % à la Contenance | –3 M, –3 DR Manœuvre |
| Supérieur de 50 % à la Contenance | Impossible de prendre la mer |

**Traits et Améliorations** : les **Traits** sont intégrés à la construction initiale (immuables), les **Améliorations** peuvent être ajoutées/retirées plus tard (`MDG 12 l.81`).

**Sources RAW :** `MDG 12 l.5-81` (intro, Équipage l.21, table espaces l.23-35, Voiles/Avirons l.37-45, Manœuvre l.48-50, Taille l.52-54, E/BE l.56-58, B/BB l.60-64, Contenance + table surcharge l.66-77, Traits/Améliorations l.79-81).

**Voir aussi :** [`catalogue-equipement.md`](catalogue-equipement.md) § [MDG 12] (tables *Exemples de bateaux* et *Caractéristiques de bateau standard*) · § Construction navale (MDG) · § Traits de navire (MDG) · § Améliorations de navire (MDG) · [`deplacement.md`](deplacement.md) (voyage, vitesses).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `MDG 12` (l.5-81) → `SIZE_SHIPBOARD_ENC`, `cargoTone`, `OverloadPalier`, `PortState`, `ShipDossierView`, `vesselMaxLoadEnc`, `OVERLOAD_HARD_CAP_PCT`, `CargoOverload`, `shipboardSouls`, `cargoOverload`, +12 — `src/data/schemas/defs/sizes.ts`, `src/data/sea-cargo.json`, `src/engine/possession.ts`, `src/engine/seaVoyage.ts`, `src/engine/size.ts`, `src/engine/types.ts`, +9 fichiers
- sans code : `MDG 12` (l.5)

---

## Construction navale (MDG)

**Source : MDG 12 l.108-164**

Procédure pour qu'un Personnage construise (ou fasse construire) son vaisseau, ou que le MJ en crée un. On fixe successivement : Taille, mode de propulsion, manœuvrabilité, vitesse, puis Traits/Améliorations (`MDG 12 l.110`). Certains exemples de bateaux ne sont pas reproductibles à l'identique par ces règles — la diversité des constructeurs de la Mer des Griffes l'explique ; la table standard sert de guide approximatif (`MDG 12 l.118`).

**Étape 1 – Taille** : choisir une Taille/un type donne des Caractéristiques de base (table *Caractéristiques de bateau standard*, au catalogue), à ajuster ensuite ; le prix indiqué vaut pour un navire de cette Taille sans modificateur ni élément additionnel (`MDG 12 l.116-129`).

**Étape 2 – Propulsion principale (voiles ou avirons)** : beaucoup de navires ont les deux Caractéristiques mais comptent surtout sur l'une. Choisir la méthode principale et **réduire de 2 le Mouvement de l'autre** (minimum 3). Les plus grandes catégories ne peuvent pas être propulsées à la rame (`MDG 12 l.133`).

**Étape 3 – Coût selon la manœuvrabilité** : un bonus de Manœuvre exige une fabrication minutieuse et coûte cher ; les défauts la réduisent et abaissent le prix (`MDG 12 l.137`) :

| Modificateur de Manœuvre | Modificateur de coût |
|---|---|
| –2 DR | –40 % |
| –1 DR | –20 % |
| +1 DR | +20 % |

**Étape 4 – Coût selon la vitesse** : la vitesse dérive du M des Voiles/Avirons et s'ajuste ; un gain de vitesse rogne la Contenance (et inversement), les pénalités de Manœuvre se cumulant avec l'étape 3 (`MDG 12 l.147`) :

| Trait de vitesse | Mod. vitesse | Mod. Contenance | Mod. Man | Mod. coût |
|---|---|---|---|---|
| Escargot | –3 | Double la Contenance | –2 DR | – |
| Très lent | –2 | +50 % de Contenance | –1 DR | – |
| Lent | –1 | +25 % de Contenance | – | – |
| Moyen | – | – | – | – |
| Rapide | +1 | –25 % de Contenance | – | – |
| Très rapide | +2 | –50 % de Contenance | – | +10 % |
| Foudroyant | +3 | –75 % de Contenance | – | +10 % |

**Sources RAW :** `MDG 12 l.108-164` (intro l.108-112, Étape 1 l.114-129, Étape 2 l.131-133, Étape 3 + table l.135-143, Étape 4 + table l.145-164).

**Voir aussi :** [`catalogue-equipement.md`](catalogue-equipement.md) § [MDG 12] (table *Caractéristiques de bateau standard*) · § Navires — profil et Caractéristiques (MDG) · § Traits de navire (MDG) · § Améliorations de navire (MDG).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `MDG 12` (l.108-164) → `BandeOuverte`, `minuscule`, `peu-maniable`, `renforce`, `tres-petite`, `cogueDEssai`, `robuste`, `petite`, `solide`, `doc`, +36 — `src/data/index.ts`, `src/data/naval-traits.json`, `src/data/schemas/defs/ship-construction.ts`, `src/data/schemas/defs/vehicles.ts`, `src/data/schemas/grammaire/valeurs.ts`, `src/data/sea-cargo.json`, +11 fichiers

---

## Traits de navire (MDG)

**Source : MDG 12 l.167-193**

Les **Traits** sont intégrés à la construction initiale et, contrairement aux Améliorations, ne peuvent être ni ajoutés ni modifiés une fois la charpente terminée (`MDG 12 l.169`).

**Peu maniable (Indice)** — jusqu'à **3 niveaux** ; chaque niveau impose **–1 DR** sur tous les Tests de **Ramer** et de **Voile**, et **réduit le coût de base de 10 % par niveau** (`MDG 12 l.171-175`).

**Renforcé (Indice)** — bateau bâti pour le combat ; chaque niveau ajoute **+10 à l'Endurance**, jusqu'à **3 niveaux**. Par niveau : **–10 % de Contenance de base** et **+10 % au coût de base** (`MDG 12 l.177-181`).

**Robuste** — modèle fiable et bien fabriqué ; **+2 DR** sur les Tests d'équipage d'**Affaler les voiles**. **+10 % au coût de base** (`MDG 12 l.183-187`).

**Solide (Indice)** — construit pour endurer la guerre ; jusqu'à **3 niveaux**, chaque niveau **augmente les Blessures de 30 %**. Par niveau : **–10 % de Contenance de base** et **+20 % au coût de base** (`MDG 12 l.189-193`).

**Sources RAW :** `MDG 12 l.167-193` (Peu maniable l.171-175, Renforcé l.177-181, Robuste l.183-187, Solide l.189-193).

**Voir aussi :** [`catalogue-equipement.md`](catalogue-equipement.md) § [MDG 12] (Traits dans la colonne *Traits et Améliorations* des exemples) · § Navires — profil et Caractéristiques (MDG) · § Construction navale (MDG).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `MDG 12` (l.167-193) → `minuscule`, `peu-maniable`, `renforce`, `tres-petite`, `robuste`, `petite`, `solide`, `navalSkillTestDR`, `moyenne`, `ancre`, +26 — `src/data/naval-traits.json`, `src/data/schemas/defs/ship-construction.ts`, `src/data/ship-construction.json`, `src/engine/navalTraits.ts`, `src/engine/shipBuild.ts`, `src/i18n/messages/fr.ts`, +2 fichiers

---

## Améliorations de navire (MDG)

**Source : MDG 12 l.195-364**

Modifications ajoutables après coup à un vaisseau ; d'autres figurent dans le **Compagnon de Mort sur le Reik**, mais MDG ne retient que celles pertinentes pour les navires et navires de guerre **maritimes** (`MDG 12 l.197-199`). Les bateaux Minuscules et Très Petits sont souvent trop courts pour la plupart de ces Améliorations (`MDG 12 l.203`). Coûts et Poids (Enc) au catalogue.

**Ancre** — fixe le bateau en place : tant qu'elle est abaissée à un emplacement approprié (l'océan est souvent trop profond), ni vents ni courants n'affectent le navire. La **lever rapidement** demande un **Test étendu de Force** au cabestan, **Complexe (–10)** (Petits/Moyens) ou **Difficile (–20)** (plus grands), DR total fonction de la profondeur (≈15 DR en général) (`MDG 12 l.205-213`).

**Bélier** — éperon métallique fixé à l'avant : fournit **5 PA** contre les Dégâts de collision/attaque venant de l'avant, et ajoute **+5 au Bonus d'Endurance** pour le calcul de l'Indice de Collision quand le navire au Bélier frappe l'autre de sa proue (`MDG 12 l.215-221`).

**Blindage** — posable uniquement sur chantier spécialisé (2 semaines pour Petits/Moyens, 1 mois au-delà). Fonctionne comme une armure : les coups à la **Coque** voient leurs Dégâts réduits des **PA** puis du **BE** ; contrairement à l'armure personnelle, il **ne peut pas être sacrifié pour éviter une Blessure Critique**. **Bronze : 1 PA** ; **Fer : 2 PA** mais si le navire devient *Sali*, les plaques de fer rouillent et perdent leurs PA (`MDG 12 l.223-236`).

**Cabine de luxe** — occupe deux cabines normales ; sur autorisation du MJ, son occupant gagne **+10 aux Tests de Sociabilité** faits à l'intérieur (`MDG 12 l.238-244`).

**Clinfoc** — misaine supplémentaire ; nécessite un beaupré (qui rallonge le navire de 10 %). Un bateau à voiles doté d'un Clinfoc utilise la table *Effet du vent (Clinfoc)* au lieu de la table standard (`MDG 12 l.246-264`).

| Effet du vent (Clinfoc) — d10 | Vent arrière | Vent latéral | Vent de face |
|---|---|---|---|
| Calme plat | Encalminé | Encalminé | Encalminé |
| Légère brise | +10 % | +0 % | –10 % |
| Brise fraîche | +25 % | Virement de bord +25 % | –25 % |
| Vent modéré | +25 % | Virement de bord +25 % | –50 % |
| Vent violent | +50 % | Affaler les voiles | Affaler les voiles |
| Violente tempête | Affaler les voiles | Affaler les voiles | Affaler les voiles |

**Embarcation de bord** — un navire à Contenance suffisante peut embarquer un autre bateau (transbordement cargaison/passagers, canot de sauvetage, voire remorquage du grand navire à **M1 et Man –4 DR**). L'embarcation va de Taille Minuscule à Très Petite ; son Coût et son Poids sont ceux de son modèle (`MDG 12 l.266-272`).

**Figure de proue** — sculpture de proue censée porter chance. Si elle est de très bonne facture (au moins deux Atouts *Raffiné*), elle **ajoute +1 au Moral total** (`MDG 12 l.274-282`).

**Freins** — deux ailettes de bois dépliables sur les côtés : ouvrir les freins augmente la résistance et **réduit le M de 1 ou 2** (ouverture à moitié ou totale). Dans un Détroit ou un Tourbillon, ils augmentent d'autant le **M effectif du courant** (`MDG 12 l.284`).

**Lissage** — coque polie pour réduire la résistance ; pose d'1 à 2 semaines en chantier. Confère **M +1**. Réparer une coque lissée coûte **+50 %** ; des réparations moins chères font perdre le bénéfice du Lissage (`MDG 12 l.287-295`).

**Nid-de-pie** — plateforme au sommet du mât ; un Personnage qui s'y trouve gagne sur ses Tests de **Perception** pour repérer en mer **+1 DR** (Taille Petite à Moyenne) ou **+2 DR** (Grande à Monstrueuse) (`MDG 12 l.297-303`).

**Propulsion à vapeur** — confère **M 4** quelle que soit la direction du vent tant qu'il reste du carburant ; entretien par un ingénieur, les Tests de **Navigation** étant remplacés par des Tests de **Métier (Ingénieur)**. Sur un double raté à ce Test, un Échec Stupéfiant ou un Coup Critique à la Coque, on lance dans la table *Panne de Vapeur* (au catalogue) (`MDG 12 l.305-313`).

**Ralentisseurs latéraux** — Amélioration listée (Coût/Poids par Taille au catalogue) (`MDG 12 l.315-354`).

**Sabord** — trappe refermable permettant de tirer à l'abri d'un couvert (grands Sabords : canons/balistes ; petits : arquebuses, arcs, arbalètes). Sans Sabords, on tire depuis le pont, **sans aucun couvert** ; un Sabord donne une **couverture totale**. L'ouvrir/le fermer est **une seule action** ; ouverts, ils sont un danger si le navire coule (`MDG 12 l.356-364`).

**Sources RAW :** `MDG 12 l.195-364` (Ancre l.205-213, Bélier l.215-221, Blindage l.223-236, Cabine de luxe l.238-244, Clinfoc + table l.246-264, Embarcation de bord l.266-272, Figure de proue l.274-282, Freins l.284, Lissage l.287-295, Nid-de-pie l.297-303, Propulsion à vapeur l.305-313, Ralentisseurs latéraux l.315-354, Sabord l.356-364).

**Voir aussi :** [`catalogue-equipement.md`](catalogue-equipement.md) § [MDG 12] (Coûts/Poids des Améliorations, table *Panne de Vapeur*) · § Navires — profil et Caractéristiques (MDG) · § Pièces d'artillerie navale (MDG) (Sabords & tir).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `MDG 12` (l.195-364) → `SteamSaveModal`, `moteur-broute`, `fuite-de-vapeur`, `CollisionShip`, `nid-de-pie`, `peu-maniable`, `doc`, `perte-de-pression`, `renforce`, `resolveCollision`, +46 — `src/data/flow-stakes.json`, `src/data/index.ts`, `src/data/naval-traits.json`, `src/data/schemas/defs/naval-traits.ts`, `src/data/schemas/defs/ship-construction.ts`, `src/data/schemas/defs/ship-stations.ts`, +20 fichiers

---

## Pièces d'artillerie navale (MDG)

**Source : MDG 12 l.367-472**

Même les petits marchands s'arment ; MDG liste les pièces les plus fréquentes sur les navires de l'Empire (liste plus complète dans **Aux Armes !**). Les pièces d'artillerie suivent les **règles des armes à main** : impossible de manier une arme de siège sans la compétence du **Groupe d'armes** approprié — les armes du Groupe **Poudre noire** exigent un équipage doté de **Projectiles (Ingénierie ou Poudre noire)** (`MDG 12 l.373-375`). Pour une **baliste**, n'importe quel Personnage peut tenter un Test de **Projectiles (Arbalète)** avec sa CT, mais l'arme **perd alors tous ses Atouts** tout en conservant ses Défauts (`MDG 12 l.377`). Les munitions sont spécifiques : un canon ne tire pas de balles d'arquebuse, ni une baliste de carreaux d'arbalète (`MDG 12 l.379`).

Catégories : **Balistes** (grandes arbalètes à torsion, carreaux à pointe de fer), **Canons** (armes de précision, surtout de Nuln), **Mortiers** (tir en cloche, peu efficaces sur la coque mais mortels sur le pont et incendiaires) et **Pierriers** (tromblons géants sur pivot/trépied) (`MDG 12 l.381-395`). Stats, prix, Enc et munitions : tables au catalogue.

**Placement des canons sur le pont** : concentrer les pièces d'un côté (bordée) ou à la proue donne un avantage tactique mais compromet le déplacement (`MDG 12 l.430`) :
- poids d'un côté **> 25 % de la Contenance** → **–1** supplémentaire au M et à la Man, et **–1 DR** aux Tests de Navigation (`MDG 12 l.432`) ;
- poids d'un côté **> 50 % de la Contenance** → **–2** au M et à la Man, et **–2 DR** aux Tests de Navigation (`MDG 12 l.433`).

Un placement équilibré n'impose pas de pénalité ; du lest de compensation (sacs de sable) peut rééquilibrer la répartition (`MDG 12 l.435`).

**Nouveaux Atouts et Défauts d'arme :**

**Arme d'équipe (Indice)** — Défaut : l'arme n'est efficace qu'avec une équipe entière (tous dotés de la compétence Projectiles requise) ; l'un d'eux est nommé pour faire le Test (`MDG 12 l.440-444`). Un équipage incomplet inflige des pénalités cumulatives :

| Équipage présent | Arme d'équipe 2 | Arme d'équipe 3 | Arme d'équipe 4 |
|---|---|---|---|
| 4 | N/A | N/A | N/A |
| 3 | N/A | N/A | Temps de Recharge doublé |
| 2 | N/A | Temps de recharge doublé | Reçoit le Défaut *Imprécise* |
| 1 | Temps de recharge doublé | Reçoit le Défaut *Imprécise* | Reçoit le Défaut *Dangereuse* |

Si un Défaut ainsi reçu est déjà présent, c'est **–10** supplémentaire à tous les Tests de Projectiles. Un membre peut apporter son **Soutien** au Test de recharge ; un Incident de tir affecte **tous** les membres de l'équipe (`MDG 12 l.458-464`).

**Tir de zone (Indice)** — Atout : nuage de projectiles frappant plusieurs cibles, selon la portée (`MDG 12 l.466-472`) :
- **Bout portant** : une seule cible ; **ajoute l'Indice aux Dégâts**.
- **Courte à Longue** : la cible **plus les (Indice) créatures visibles les plus proches**, deux cibles ne pouvant être à plus de (Indice) mètres l'une de l'autre.
- **Extrême** : comme Courte à Longue, mais **réduit les Dégâts de (Indice)**.

**Sources RAW :** `MDG 12 l.367-472` (règles d'usage l.367-379, catégories l.381-395, tables pièces & munitions l.397-426, placement l.428-435, Arme d'équipe + table l.440-464, Tir de zone l.466-472).

**Voir aussi :** [`catalogue-equipement.md`](catalogue-equipement.md) § [MDG 12] (tables *Pièces d'artillerie* et *Munitions pour pièces d'artillerie*) · [`combat.md`](combat.md) (armes à distance, Atouts/Défauts, Portée) · § Améliorations de navire (MDG) (Sabords).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `MDG 12` (l.367-472) → `ammoSeq`, `moteur-broute`, `crewedPenalty`, `canon`, `warMachineCrewPenalty`, `fuite-de-vapeur`, `nid-de-pie`, `ReloadModalView`, `placementPenalty`, `VolleyShot`, +27 — `src/data/flow-stakes.json`, `src/data/index.ts`, `src/data/naval-traits.json`, `src/data/qualities.json`, `src/data/ship-stations.json`, `src/data/steam-breakdown.json`, +20 fichiers
- sans code : `MDG 12` (l.377, l.379)

