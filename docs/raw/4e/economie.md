# Atlas RAW — Économie : monnaie, marché, fabrication

> Référentiel **autosuffisant** des règles WFRP4 (RAW), consolidé sur les livres autorisés, à usage
> d'agent (répondre + auditer le code sans rouvrir les livres). Chaque règle cite `LIVRE NN l.X-Y`
> (last-recours = la source). Abréviations : [`sources.md`](../sources.md). Index : [`00-index.md`](00-index.md).
>
> Scope : monnaie / achat-vente / Disponibilité / Marchandage / Évaluation / Fabrication / commerce de cargaison (MSRC 11).
> Renvoie à **Équipement** pour les prix individuels des objets (armes, armures, trappings — non retranscrits ici).
> ⚠️ Les champs **Implémente** sont GÉNÉRÉS (`npm run raw:implemente` — source éditoriale : `src/data/raw.manifest.json`) — ne pas les éditer à la main.

## Sommaire

- [Monnaie — conversions et nomenclature](#monnaie--conversions-et-nomenclature)
- [Disponibilité — tiers et table de stock](#disponibilité--tiers-et-table-de-stock)
- [Achat — procédure et Disponibilité](#achat--procédure-et-disponibilité)
- [Marchandage — Test opposé, réductions, Négociateur](#marchandage--test-opposé-réductions-négociateur)
- [Évaluation — identification qualité et estimation prix](#évaluation--identification-qualité-et-estimation-prix)
- [Vente — base ½, Marchandage, Baisse des prix, Troc](#vente--base-½-marchandage-baisse-des-prix-troc)
- [Fabrication (LDB) — Atouts et Défauts d'objet](#fabrication-ldb--atouts-et-défauts-dobjet)
- [Option Guildes d'artisans](#option-guildes-dartisans)
- [Commerce de cargaison (MSRC Compagnon ch.11)](#commerce-de-cargaison-msrc-compagnon-ch11)
- [Voir aussi](#voir-aussi)
- [Implémente (refs code)](#implémente-refs-code)

---

## Monnaie — conversions et nomenclature

**Source : LDB 57 l.3-26**

```
1 couronne d'or (CO)  =  20 pistoles d'argent (/)  =  240 sous de cuivre (sc)
1 pistole (/)         =  12 sous de cuivre (sc)
```

> Verbatim LDB 57 : « 1 pistole d'argent (1/–) = 12 sous de cuivre (12sc). 1CO = 20/– = 240sc »

Pièce habituelle : ~30 g. La valeur est déterminée par le poids — les pièces étrangères s'évaluent à la balance mais attirent les soupçons.

**Noble** : pièce de 80sc (1/3 CO), dite répandue dans l'Empire.

**Notation usuelle** : `6/8` = 6 pistoles et 8 sous = 80sc = 1 noble.

**Simplification de jeu** : tout transposer en sous de cuivre (1sc ≈ 1 € pour s'y retrouver en valeurs relatives). 10 pistoles ≈ 120 €, 10 CO ≈ 2 400 €.

---

## Disponibilité — tiers et table de stock

**Source : LDB 59 l.1-35**

Chaque Possession possède l'un de quatre tiers :

| Disponibilité | Description |
|---|---|
| **Commune** | Disponible partout, toujours en stock — pas de Test requis |
| **Limitée** | Moins courante — Test de Disponibilité selon la taille d'agglomération |
| **Rare** | Peu commune — Test de Disponibilité |
| **Exotique** | Introuvable sans commande ou fabrication spéciale — jamais en stock automatiquement |

### Table de Disponibilité

Verbatim LDB 59 l.25-35 :

| | Village | Ville | Cité |
|---|---|---|---|
| Commune | En Stock ! | En Stock ! | En Stock ! |
| Limitée | 30 % | 60 % | 90 % |
| Rare | 15 % | 30 % | 45 % |
| Exotique | Pas en Stock | Pas en Stock | Pas en Stock |

**Quantité en stock** (LDB 59 l.29-35) :
- Village : 1 objet en stock
- Ville : 1d10 objets
- Cité : autant que le MJ juge approprié
- ×2 pour les objets Communs ; ÷2 (arrondi sup.) pour les Rares

**Échec au Test** : réessayer dans une nouvelle agglomération, ou la semaine suivante si la taille est au moins Ville.

---

## Achat — procédure et Disponibilité

**Source : LDB 59 l.1-20**

Les règles d'achat/vente sont **optionnelles** — le MJ peut simplement déclarer ce qui est disponible.

**Option « Tenir les comptes »** (LDB 59 l.12) : si on suit la monnaie sou par sou :
- Objet coûtant ≤ Statut du personnage (ex. Statut Argent 2 → ≤ 2 pistoles) : achat libre, autant de fois que nécessaire.
- Objet au-delà du Statut : maximum **1 achat par jour**, avec un Test de **Marchandage** (difficulté fixée par le MJ selon le prix et le marché local).

**Objet Exotique** (LDB 59 l.18-20) : uniquement via :
1. Décision du MJ (objet disponible localement)
2. Commande auprès d'un artisan (Activité *Passer Commande*, LDB 23 p.199)
3. Fabrication personnelle (Activité *Artisanat*, LDB 23 p.196)

**Modificateurs de recherche active** (LDB 59 l.50) :
- +10 % à +20 % à la Disponibilité si le personnage appartient à une Carrière pertinente (Marchand, Receleur) ou passe **une journée entière** à chercher et à faire des Tests de Ragot.

---

## Marchandage — Test opposé, réductions, Négociateur

**Source : LDB 59 l.37-43**

Le **Marchandage** se résout en **Test opposé** (acheteur vs. vendeur).

- **Victoire** : réduit le prix de **10 %**.
- **Succès Stupéfiant** (DR net ≥ 6) ou talent **Négociateur** : réduction jusqu'à **20 %**.
- **Défaite grave** : le vendeur se méfie de la monnaie du personnage (botch → commerce bloqué pour la visite).

> Verbatim LDB 59 l.43 : « Marchandage est couramment utilisé par les clients et les vendeurs, généralement avec des Tests opposés. Le Marchandage est prévu et la plupart des prix sont légèrement augmentés pour en tenir compte. Gagner un Test de Marchandage réduit le prix de 10 % (et même jusqu'à 20 % avec un Succès Stupéfiant (+6) ou avec le Talent Négociateur). Rater de beaucoup un Test de Marchandage signifie généralement que le vendeur se méfie de votre monnaie. »

Le MJ peut laisser les achats courants sans Test ; réserver le Marchandage aux achats importants ou aux scènes de PNJ marchands significatifs.

---

## Évaluation — identification qualité et estimation prix

**Source : LDB 59 l.39-41**

La compétence **Évaluation** sert à :

1. **Identifier la qualité d'un objet** (Atouts/Défauts) — permet de détecter un vendeur malhonnête proposant un objet Défectueux comme Standard.
2. **Estimer la valeur** des pièces étrangères ou repérer des contrefaçons (usage vendeur).
3. **Estimer le prix** d'objets Rares ou Exotiques **à ±10 %** (LDB 59 l.41).

> Verbatim LDB 59 l.41 : « Tout le monde peut également utiliser Évaluation pour estimer les prix des objets Rares ou Exotiques à +/-10 %. »

**Compétences qui peuvent révéler un Défaut caché** (LDB 60 l.42) : Évaluation, Corps à corps (armes), Métier (outils) — n'importe laquelle fonctionne.

**Limitation** : échec NET → pas de nouvelle tentative le même jour (LDB 12 l.94 — règle générale des Tests avancés, appliquée ici). Seul un résultat marginal (*Échec Minime*) permet un nouvel essai.

**Talent Détection d'artefact** (LDB 10 l.336) : Test d'Intuition au toucher — une seule tentative par artefact. Révèle l'aura magique et ses règles (par DR).

---

## Vente — base ½, Marchandage, Baisse des prix, Troc

**Source : LDB 59 l.52-76**

### Prix de vente de base

> Verbatim LDB 59 l.54 : « le prix de base quand vous vendez est moitié moins cher que le prix listé de l'objet, ce qui signifie que, lors d'une vente d'objets d'occasion, vous gagnez généralement entre un quart et la moitié de la valeur listée de l'objet après le Marchandage. »

- Base vente : **½ prix listé**
- Avec Marchandage de vente gagné : jusqu'à **½ prix listé** (plafond normal)
- Sans Marchandage ou perdu : **¼ prix listé**
- Avec Carrière Receleur/Marchand + Tests de Ragot actifs : jusqu'à **80 %** du prix listé (à la discrétion du MJ)

**Disponibilité d'un acheteur** : même mécanique que pour le stock d'achat (30/60/90 % selon taille d'agglomération pour les objets Limités).

### Baisse des prix

> Verbatim LDB 59 l.60 : « Chaque fois que vous divisez l'argent que vous êtes disposé à accepter par deux, la Disponibilité d'un acheteur augmente d'un cran. »

*Exemple LDB* : un long fusil d'Hochland (Exotique, valeur 100 CO) → base vente = 50 CO. En divisant 2× par 2 → 12 CO 10/– (+2 crans de Disponibilité : Exotique → Limitée).

### Ratios de Troc

**Source : LDB 59 l.64-76**

| Objet échangé ↓ \ Objet acquis → | Commune | Limitée | Rare | Exotique |
|---|---|---|---|---|
| Commune | 1 : 1 | 2 : 1 | 4 : 1 | 8 : 1 |
| Limitée | 1 : 2 | 1 : 1 | 2 : 1 | 4 : 1 |
| Rare | 1 : 4 | 1 : 2 | 1 : 1 | 2 : 1 |
| Exotique | 1 : 8 | 1 : 4 | 1 : 2 | 1 : 1 |

Les lots sont définis en comparant les prix listés des deux objets pour constituer deux lots de valeur équivalente.

---

## Fabrication (LDB) — Atouts et Défauts d'objet

**Source : LDB 60 l.3-62**

### Principes

Les objets disponibles varient en qualité. Un objet peut avoir des **Atouts** (meilleur, plus cher, plus rare) et des **Défauts** (moins bon, moins cher, plus commun).

**Classes de qualité** (LDB 60 l.10-46) :
- **Haute Qualité** : aucun Défaut ET plus d'Atouts que d'Encombrement
- **Qualité** : plus d'Atouts que de Défauts
- **Standard** : équilibre (ni plus d'Atouts ni plus de Défauts)
- **Défectueuse** : plus de Défauts que d'Atouts

### Atouts d'objet

> Verbatim LDB 60 l.11 : « Pour chaque Atout d'objet de la Possession, doublez son prix et baissez sa disponibilité d'un cran. »

**Facteur prix** : chaque Atout × 2 (cumulatif : 2 Atouts → ×4).
**Disponibilité** : chaque Atout → +1 cran vers Rare/Exotique.

| Atout | Effet mécanique |
|---|---|
| **Léger** | Réduit l'Enc de 1 (LDB 60 l.18) |
| **Pratique** | Échec au Test : +1 DR. Armure : pénalités −1 niveau (ex. −30 → −20) |
| **Raffiné** | Signe de statut social (peut être pris plusieurs fois — cumulatif en prestige) |
| **Solide (Indice)** | Encaisse *Indice* Points de Dégâts avant pénalités + Test de Sauvegarde 9+ (1d10) contre casse instantanée (Lame piégée, etc.) ; chaque prise supplémentaire : sauvegarde +1 (9+→8+→7+…) |

*Exemple LDB* : épée Solide 3 → encaisse 3 Dégâts, Sauvegarde 7+.

*Exemple LDB* : pelle Raffiné+Solide → ×4 prix listé, dispo Commune → Rare.

### Défauts d'objet

> Verbatim LDB 60 l.42 : « Chaque Défaut divise le prix listé par deux et améliore la Disponibilité d'un cran. »

**Exception** : les objets Exotiques restent Exotiques même Défectueux (LDB 60 l.44).

| Défaut | Effet mécanique |
|---|---|
| **Bâclé** | Casse sur tout double lors d'un Test échoué. Armure bâclée : casse sur n'importe quel Coup Critique à sa Localisation |
| **Laid** | Attire des attentions négatives. Tests de Sociabilité associés : pénalité possible −10 |
| **Peu Fiable** | Échec au Test : −1 DR. Armure : pénalités portées ×2 |
| **Volumineux** | +1 Enc (petites babioles exclues). Vêtements/armures : Enc 1 même portés ; pénalités Fatigue ×2 |

*Exemple LDB* : chemise de mailles Volumineuse+Peu fiable → ¼ du prix listé, dispo Rare → Commune.

**Repérer un Défaut caché** (LDB 60 l.42) : Test réussi d'Évaluation, Corps à corps (armes) ou Métier (outils) — la liste n'est pas exhaustive.

---

## Option Guildes d'artisans

**Source : LDB 60 l.34-38**

Si le MJ indique une ville avec une Guilde d'artisans pertinente :
- Les **Défauts ne réduisent plus la Disponibilité** (ils la réduisent au lieu de l'augmenter — l'inverse du régime normal).
- Le **premier Atout ne réduit pas la Disponibilité** (seulement le prix est doublé).
- Les prix restent modifiés normalement.

---

## Commerce de cargaison (MSRC Compagnon ch.11)

**Source : MSRC Compagnon 13 l.1-350** (Chapitre 11 — Règles du commerce)

Ces règles s'appliquent principalement dans le contexte du **voyage en barge sur le Reikland** (Mort sur le Reik). Elles sont une extension optionnelle du commerce LDB pour les **cargaisons en gros**, pas pour les achats d'équipement courant.

> ⚠️ Les contrats de transport sont inaccessibles à l'aventurier classique (réservés aux marchands de talent, plaideurs, noblesse). L'or issu de ces échanges peut être exempté de la règle *Argent à gaspiller* (LDB 23 p.195) à la discrétion du MJ.

### Indices de référence

**Richesse** :

| Richesse | Indice |
|---|---|
| Misérable | — |
| Pauvre | 1 |
| Moyen | 2 |
| Animé | 3 |
| Prospère | 4 |
| Florissant | 5 |

**Taille d'emplacement** :

| Type | Population | Indice |
|---|---|---|
| Hameau | Jusqu'à 200 | 1 |
| Village | Jusqu'à 1 500 | 2 |
| Ville | Jusqu'à 10 000 | 3 |
| Grande ville | > 10 000 | 4 |

> Les prix du commerce de cargaison sont exprimés entièrement **en Couronnes d'or** pour simplifier les calculs (convertir avec LDB 57 si nécessaire).

### Étape 1 — Disponibilité d'une cargaison

Chance de trouver une cargaison = **(Taille + Richesse) × 10 %**. Lancer 1d100 ; ≤ résultat → cargaison disponible.

*Exemple* : hameau Taille 1 + Richesse Moyenne 2 = 3 × 10 = **30 %**.

Un emplacement avec **Commerce** en colonne Produits : lancer 2× (marchandises locales + cargaison aléatoire).

### Étape 2 — Type de cargaison

Si l'emplacement a un produit volumineux listé → c'est le type proposé. Sinon, lancer sur le **Tableau des cargaisons aléatoires** :

#### Tableau des cargaisons aléatoires (d100, par saison)

| d100 | Vivres | Armement | Produits de luxe | Métal | Bois | Vin/Eau-de-vie | Laine |
|---|---|---|---|---|---|---|---|
| Printemps | 01–09 | 10–15 | 16–20 | 21–30 | 31–55 | 56–75 | 76–00 |
| Été | 01–19 | 20–23 | 24–29 | 30–39 | 40–74 | 75–85 | 86–00 |
| Automne | 01–35 | 36–40 | 41–44 | 45–60 | 61–80 | 81–95 | 96–00 |
| Hiver | 01–19 | 20–23 | 24–29 | 30–44 | 45–60 | 61–95 | 96–00 |

#### Tableau des prix de base (CO par 10 PE de cargaison)

| | Vivres | Armement | Produits de luxe | Métal | Bois | Vin/Eau-de-vie | Laine |
|---|---|---|---|---|---|---|---|
| Printemps | 1 | 12 | 50 | 8 | 3 | *variable* | 1 |
| Été | 0,5 | 10 | 50 | 8 | 1,5 | *variable* | 1,5 |
| Automne | 0,25 | 8 | 50 | 8 | 2 | *variable* | 2 |
| Hiver | 0,5 | 10 | 50 | 8 | 3,5 | *variable* | 3 |

**Notes par type** :
- **Vivres** : prix minimal à la récolte (automne), maximal au début du printemps (« disette »).
- **Bois** : plus cher en hiver/printemps (mauvais temps = métier de forestier difficile).
- **Laine** : toujours demandée ; chute au printemps (tonte).
- **Métal** : stable toute l'année ; +10 % prix de vente si l'emplacement de destination a « Travail des métaux » en Produits.
- **Produits de luxe** : prix stable ; inclut textiles locaux, poterie, verre, épices importées, soies, mithril, bière Bugman XXXXXX.
- **Armement** : recherché au printemps (campagnes militaires), demandé en permanence. Armes simples, armures cuir, carreaux (pas de canons/poudre — barges spécialisées).
- **Subsistance** : certains petits emplacements ne produisent rien d'échangeable.

#### Vin et eau-de-vie — qualité secrète

Déterminer la qualité en secret (d10) ; le marchand malhonnête peut tenter de faire passer une qualité inférieure. Test d'**Évaluation Intermédiaire (+0)** pour connaître la vraie qualité. Si Résistance à l'alcool ≥ 50 : Test Accessible (+20). Échec → fausse indication proportionnelle au degré d'échec.

| d10 | Qualité | Prix / 1 cargaison |
|---|---|---|
| 1 | Médiocre | 0,5 CO |
| 2–3 | Passable | 1 CO |
| 4–5 | Moyen | 1,5 CO |
| 6–7 | Bon | 3 CO |
| 8–9 | Excellent | 6 CO |
| 10 | Supérieur | 12 CO |

Certaines zones (ex. Kemperbad) produisent de qualité supérieure → augmenter la qualité de **+2 échelons**.

### Étape 3 — Taille de la cargaison (en Points d'Encombrement)

Taille disponible = **(Taille + Richesse) × résultat 1d100**, arrondi à la dizaine supérieure.

*Exemple* : Dorchen, village Taille 2 + Richesse Moyenne 2 = 4. Jet d100 = 36 → arrondi 40 → cargaison = 4 × 40 = **160 PE**.

**Centre de Commerce** (Richesse issue du Commerce dans l'Index) : inverser le résultat du d100 et prendre le plus grand des deux.
*Suite exemple* : 36 inversé = 63 → arrondi 70 → cargaison = 4 × 70 = **280 PE**.

### Étape 4 — Marchandage à l'achat

Test opposé de **Marchandage** vs. le vendeur : ±10 %, jusqu'à ±20 % avec le talent Négociateur (LDB 59 l.43).

**Compétence Marchandage d'un marchand classique** : 32–50 (lancer 2d10+30 ou choisir).

**Achat partiel** (< 10 PE refusé) : le prix par 10 PE est augmenté de **+10 %** pour compenser.

### Vente de la cargaison

**Demande** :
- Hameaux : pas de demande en général, sauf vivres au printemps (jusqu'à d10 PE d'autres biens à la discrétion du MJ).
- Un emplacement **ne demande pas** ce qu'il produit lui-même (exception : vin/eau-de-vie Supérieur → toujours d10 PE d'acheteurs).
- Interdiction de vendre à l'emplacement d'achat (attendre 1 semaine minimum, ou se déplacer).

**Chance de trouver un acheteur** : Taille × 10, +30 si l'emplacement a Commerce en Produits. Lancer 1d100 ≤ résultat → acheteur trouvé. Si raté : proposer la moitié de la cargaison et relancer.

**Offre de l'acheteur (Mise à prix)** selon la Richesse de l'emplacement :

| Richesse | Offre par rapport au prix de base |
|---|---|
| 1 — Misérable | 50 % du prix de base |
| 2 — Pauvre | −20 % |
| 3 — Moyen | Prix de base |
| 4 — Animé | +5 % |
| 5 — Prospère | +10 % |

Puis Test opposé de **Marchandage** pour ajuster (±10 %/±20 % comme à l'achat).

**Vente d'urgence** (cargaison invendable, lieu Commerce) : toujours possible pour **½ prix de base**.

### Rumeurs commerciales

Test de **Ragot Complexe (−10)** dans une auberge → lancer d100 sur l'Index géographique pour un emplacement → lancer sur le Tableau des rumeurs. Si la marchandise correspond à la rumeur, vendre **au double du prix de base** à cet emplacement.

---

## Voir aussi

- **Équipement** (`docs/raw/` à venir) — prix individuels des armes, armures, trappings (LDB 62–63 + AA)
- **Compétences** (`competences.md`) — fiches Évaluation, Marchandage, Ragot, Métier
- **Activités** (LDB 23 p.196/199) — *Artisanat* et *Passer Commande* pour les objets Exotiques
- **Statut social** (LDB 8) — simplification des achats par Statut
- **Voyage** (`deplacement.md`) — coûts diligence/barge, frais d'écluse (MSRC Compagnon ch.10)
- **Fabrication magique** (ADE II 4) — règles de création d'artefacts magiques (hors scope économie commune ; voir ADE II directement)

---

## Implémente (refs code)

Couverture confirmée des refs `LDB XX l.YY` dans le code :

| Ref source | Fichier implémentant | Mécanique |
|---|---|---|
| `LDB 59 l.25-35` | `src/engine/disponibilite.ts` | Table de Disponibilité RAW (Commune/Limitée/Rare/Exotique × Village/Ville/Cité) ; `rollAvailability`, `fullStock`, `rollStock` |
| `LDB 59 l.18` | `src/engine/disponibilite.ts` + `src/state/merchantFlow.ts` | Règle optionnelle stock sans Test (`fullStock`) ; désactivation Marchandage si `simplifie` |
| `LDB 60 l.3` | `src/engine/appraisal.ts` | Évaluation : estimation ±10 % Rare/Exotique |
| `LDB 60 l.3` | `src/engine/bargain.ts` + `src/state/merchantFlow.ts` | Test opposé Marchandage : −10 % achat ; soured sur botch (DR net ≥ 6 en défaite) ; gel du Marchandage cette visite |
| `LDB 60 l.5` | `src/engine/bargain.ts` + `src/state/merchantFlow.ts` | Vente base = ½ prix listé ; ¼ sans Marchandage gagné, ½ si gagné (`resaleRate`) |
| `LDB 60 l.3-62` | `src/engine/qualities/craftEconomy.ts` | Facteur prix (`craftPriceFactor` : ×2/Atout, ÷2/Défaut) ; décalage Disponibilité (`shiftAvailability`) ; delta Enc (`craftEncDelta` : Léger −1, Volumineux +1) ; classe de qualité (`qualityClass`) |
| `LDB 10 l.336` | `src/state/merchantFlow.ts` | Talent Détection d'artefact : Test Intuition, 1 tentative/artefact, révèle aura par DR |
| `LDB 12 l.94` | `src/state/merchantFlow.ts` | Échec net Évaluation : pas de re-tentative le même jour |

**Fichiers engine** : `src/engine/disponibilite.ts`, `src/engine/bargain.ts`, `src/engine/appraisal.ts`, `src/engine/qualities/craftEconomy.ts`

**Orchestration store** : `src/state/merchantFlow.ts`, `src/state/rollFlows.ts` (flows `bargain`/`appraise`), `src/state/merchants/` (archétypes)

**UI** : `src/ui/MerchantPanel.tsx`, `src/ui/BargainModal.tsx`, `src/ui/AppraiseModal.tsx`

**Règle optionnelle** : `src/engine/policy.ts` (mode marché `simplifie` → pas de Tests de Disponibilité)

