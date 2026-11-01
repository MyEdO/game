# Sous-projet #1 — Qualité d'objet (Fabrication WFRP4)

*Spec de conception — 2026-06-07. Effort « ultracode » (max RAW, exhaustif).*

## 0. Place dans l'ensemble (décomposition en 3 sous-projets)

La demande initiale (« scénario arène + loot + marchand entre les vagues ») a convergé,
après cadrage, vers **le Marchand comme livrable central**, paramétrable dans l'éditeur.
Le choix « Évaluation complète » a fait apparaître un **prérequis** : un système de **Qualité
d'objet (Fabrication)**, car Évaluation sert précisément à révéler la qualité (Atouts/Défauts)
d'un objet. D'où la décomposition validée (séquence **Qualité → Marchand → Arène**) :

| # | Sous-projet | Dépend de | Spec |
|---|---|---|---|
| **1** | **Qualité d'objet (Fabrication)** | — | **CE DOCUMENT** |
| 2 | Marchand (Disponibilité, prix, Marchandage, Évaluation, achat/vente, UI, éditeur, registre) | #1 | à venir |
| 3 | Arène (vagues croissantes + interlude marchand + loot) — banc d'essai | #2 | à venir |

Décisions déjà arrêtées pour #2/#3 (consignées ici pour ne pas les perdre ; détaillées dans leurs specs) :
- **Marchand** = famille de registre `defs/` (archétypes réutilisables) + référence/override par entité de scène.
- **Disponibilité** = jets RAW en % par taille de colonie (LDB 59) ; quantités village 1 / ville 1d10.
- **Marchandage** = Test opposé RAW ; gagner −10 % (achat) / +10 % (vente) ; **−20 % si DR net ≥ 6** *ou* talent Négociateur (LDB 60 l.12). **Un jet par transaction, verrouillé** (anti-abus : ouvrir/fermer ne re-tire pas).
- **Vente** base ½ prix catalogue (LDB 60 l.22).
- Knobs éditeur (non-RAW, défaut = RAW) : `priceMultiplier`, override de remise, toggle marchandage, source d'inventaire (liste vs catégorie auto), `restockOnVisit`.
- **Réparation d'armure** (10 %/PA, 30 % si brisé — LDB 63 l.97) = service marchand côté #2, **mais s'appuie sur les dégâts d'armure définis ici**.

---

## 1. Objectif du sous-projet #1

Modéliser, **fidèlement au RAW (LDB ch. « Guide de l'équipement », Fabrication)**, la **qualité
d'objet** : des **Atouts** et **Défauts d'objet** (artisanat) portés par une *instance* d'objet,
avec **tous** leurs effets (économiques, encombrement, combat sur armes ET armures, tests,
social), plus le **système de dégâts d'armure** et la **Déviation Critique**.

But concret : qu'acheter/posséder une « épée Solide 2 » ou une « cotte de mailles Bâclée »
*change réellement* le jeu, et que **Évaluation** (sous-projet #2) ait une vraie qualité cachée à révéler.

Périmètre validé : **Tout (A + B + C)**, précédé d'une **Phase 0 de fondation** (registre de
qualités unifié, refacto iso-comportement) pour ne pas empiler la dette — voir §3 et §3.1.

---

## 2. Sources RAW (citées — règle « ne rien inventer »)

Fichiers sous `Source/Warhammer v4 - Livre de base version corrigée/` :

### 2.1 Atouts/Défauts d'objet — `60 - Fabrication.md`
- **Cadre** (l.43-44) : « Un Atout d'objet rend sa Possession un peu meilleure, mais plus difficile à trouver. Un Défaut… moins bonne, mais plus facile à trouver. Une Possession sans aucun Défaut, et avec plus d'Atouts que d'Encombrement est appelée une Possession de **Haute Qualité**. »
- **Atouts** (l.46-47) : « Possession de Qualité si plus d'Atouts que de Défauts. Pour chaque Atout d'objet, **doublez son prix et baissez sa disponibilité d'un cran**. » Exemple (l.53) : 2 Atouts → ×4 prix, Commune→Rare.
  - **Léger** (l.55-56) : « Réduit les Points d'Encombrement de 1. »
  - **Pratique** (l.58-59) : « Un échec à un Test utilisant cet objet reçoit **+1 DR**. Si l'objet est une pièce d'armure, **toutes les pénalités découlant de son port sont réduites d'un niveau** (ex. de -30 à -20). »
  - **Raffiné** (l.61-62) : « signe de statut social, peut être pris plusieurs fois. » (Pas de bonus chiffré RAW.)
  - **Solide (Indice)** (l.64-67) : « peut encaisser *Indice* Points de Dégâts avant de subir des pénalités + un **Test de Sauvegarde de 9+ sur 1d10 contre une cassure instantanée**. Cumulable : chaque prise améliore la sauvegarde de 1 (9+→8+). »
- **Défauts** (l.74-75) : « Possession Défectueuse si plus de Défauts que d'Atouts. **Chaque Défaut divise le prix par deux et améliore la Disponibilité d'un cran**. Un Test (Évaluation, ou Corps à corps pour armes, Métier pour outils) peut révéler la supercherie d'un vendeur. » Exotique non modifié (l.77).
  - **Bâclé** (l.81-82) : « casse quand utilisé lors de tout **Test échoué obtenant un double**. Une armure Bâclée casse si **tout Coup Critique** est subi à la Localisation qu'elle protège. »
  - **Laid** (l.84-85) : « les Tests de Sociabilité associés peuvent subir **-10**. »
  - **Peu Fiable** (l.87-88) : « Un échec à un Test utilisant l'objet reçoit **-1 DR**. Les **pénalités d'armure Peu fiable sont doublées**. »
  - **Volumineux** (l.90-91) : « **Augmente l'Encombrement de 1**. Vêtements/armures Volumineux ont **Enc 1 même portés**, et les **pénalités de Fatigue sont doublées**. »
- **Option Guildes d'artisans** (l.69-72) : en ville à guilde, chaque Défaut *réduit* la Dispo (au lieu de l'augmenter) et le **1er Atout ne réduit pas** la Dispo ; prix inchangés.

### 2.2 Armure & dégâts d'armure — `63 - Armures.md`
- **Schéma armure** (l.36-50) : Type / Prix / Enc / **Pénalité** (de port, au-delà de l'Enc) / Emplacement / PA / Atouts-Défauts.
- **Pénalités de port concrètes** (table l.73-95) : Coiffe de mailles −10 % Perception ; Heaume −20 % Perception ; Heaume ouvert −10 % Perception ; Jambières d'acier −10 Discrétion ; **toute maille/plate = −10 Discrétion** ; cuir souple = sans pénalité.
- **Dégâts d'armure** (l.52-66) : « Chaque fois qu'une pièce d'armure est endommagée, **les PA de l'emplacement sont réduits de 1**. Si PA < 0, l'armure devient inutilisable. » Sources : (1) capacité spéciale/sort/talent, (2) **Déviation Critique**.
- **Déviation Critique** (l.63-66) : « Si vous subissez une Blessure Critique sur un emplacement protégé par une armure, vous pouvez **choisir** d'endommager votre armure de **1 PA pour ignorer la Blessure Critique**. Vous subissez toujours les Blessures normales (et, PA réduits de 1, probablement +1 Blessure). »
- **Taille** (arme — l.8) : « Si vous touchez, vous **Endommagez de 1 Point une pièce d'armure ou un Bouclier** frappé, en plus de blesser. »
- **Réparation** (l.97-98) : 10 % du prix de base par PA perdu ; 30 % si pièce brisée. *(→ service marchand #2.)*
- **Atouts d'armure** : Flexible (l.105-106), Impénétrable (l.108-109 : critiques d'un toucher impair ignorés). **Défauts d'armure** : Partielle (l.114-115 : toucher pair ou critique ignore les PA), Points Faibles (l.117-118 : Empaleuse + critique ignore les PA). *(Couche intrinsèque au type d'armure, distincte de l'artisanat — voir §3 phase C2.)*

### 2.3 Encombrement & Fatigue
- `61 - Encombrement.md` : cap = **BF + BE** (l.8) ; **objets portés −1 Enc** (l.22) ; paliers de surcharge (l.30-38) : ≤ cap = 0 ; ≤ 2× = −1 Mvt/−10 Ag/+1 Fatigue ; ≤ 3× = −2 Mvt/−20 Ag/+2 Fatigue ; > 3× = immobile. Pénalités d'Enc + d'armure **se cumulent** (l.31).
- `16 - États.md` : **Exténué** = **−10 par cran à TOUS les Tests** (l.18) ; États *différents* ne se cumulent pas (on prend le pire, l.20).

### 2.4 Distinction terminologique cruciale
- **Qualités d'arme** (Empaleuse, Défensive, Perforante, Précise…) et **Atouts/Défauts d'armure intrinsèques** (Flexible, Impénétrable, Partielle, Points Faibles) = propriétés du **type** d'objet → données du *def* (`trappings.json`/`qualities.json`).
- **Atouts/Défauts d'OBJET (artisanat)** (Léger, Pratique, Raffiné, Solide ; Bâclé, Laid, Peu Fiable, Volumineux) = propriétés de l'**instance** (la même « Hache » peut être forgée Solide ou Bâclée). → **nouveau champ d'instance**, séparé.

---

## 3. Périmètre (Tout = A + B + C) et phasage

> **Fondation d'abord** (§3.1) : avant d'empiler la qualité d'objet, on **consolide** le traitement
> des qualités dans un **registre unifié** (refacto *iso-comportement*, garanti par golden-master).
> Ensuite chaque qualité (artisanat, armure) devient **une entrée de registre**, pas des `hasQ()`
> éparpillés. Consolider le code avant d'ajouter des éléments pour le garder sain et extensible (#3175).

| Phase | Contenu | RAW | Risque |
|---|---|---|---|
| **0 — Fondation (refacto)** | Registre de qualités d'objet unifié + dispatcher **pur** ; migration des ~9 checks `hasQ()`/regex épars (Précise, Perforante, Pointue, Empaleuse, Défensive, À Enroulement, Pistolet, Incassable, Recharge…) derrière le registre, sous **golden-master**. **Iso-comportement** (aucune règle changée). | n/a (refacto) | Moyen (couvert par golden-master) |
| **A — Données & économie** | Champ `craft` sur `ItemInstance` ; catalogue des 8 qualités ; fonctions pures prix (×2/÷2), disponibilité (∓1 cran, exception Exotique, option Guilde), classification (Qualité/Défectueuse/Haute Qualité) ; effets d'**encombrement** (Léger −1 / Volumineux +1, réconcilié avec « porté −1 ») ; **flag d'identification** ; **affichage** (badges). | LDB 60 l.43-92, 61 | Faible |
| **B — Combat ARMES** | Solide(N) (absorption de dégâts d'arme + sauvegarde 9+/1d10) ; Bâclé (casse sur maladresse) ; Pratique/Peu Fiable (±1 DR à l'attaque ratée). | LDB 60 | Moyen |
| **C1 — Dégâts d'armure + Déviation Critique** | `damageTaken` réutilisé sur les pièces d'armure ; PA de localisation **dérivée nette des dégâts** ; **Déviation Critique** (choix joueur, modale) ; qualité d'arme **Taille** endommage l'armure ; Bâclé armure (casse sur critique à la localisation) ; Solide(N) sur armure. | LDB 63 l.8,52-66 | Moyen (rayon limité, voir §6) |
| **C2 — Tests hors combat & social & pénalités d'armure** | Liaison **objet↔test** (`itemUid` sur `Effect.test`/`PendingTest`) pour Pratique/Peu Fiable hors combat ; **pénalités de port d'armure** (Discrétion/Perception, données LDB 63) appliquées aux tests du porteur ; Pratique (−1 niveau) / Peu Fiable (×2) sur ces pénalités ; **Laid** (−10 Soc) ; Volumineux (Enc porté = 1, Fatigue ×2). | LDB 60, 63 | Moyen |
| **C3 — (adjacent, optionnel) Atouts/Défauts d'armure intrinsèques** | Flexible, Impénétrable, Partielle, Points Faibles (touchent le flux critique/PA, déjà ouvert par C1). À inclure si on veut la correction RAW complète du combat ; sinon phase distincte. | LDB 63 l.105-118 | Moyen |

> **Hors périmètre #1 (→ specs #2/#3 ou suites)** : Marchandage, Évaluation (le *test* de révélation), Disponibilité en boutique, prix/monnaie en jeu, réparation payante, Fabrication *active* (créer un objet), Troc. **#1 fournit les briques** (qualité cachée, modificateurs prix/dispo purs, dégâts d'armure) que #2 consomme.

---

## 3.1 Phase 0 — Fondation : registre de qualités d'objet unifié

**Problème (mesuré, cf. inventaire)** : les qualités d'arme sont testées par ~9-14 `hasQ()`/regex
**éparpillés** sur `combat.ts`, `weaponDamage.ts`, `combatFlow.ts`, `oups.ts`, `items.ts`, avec
**3 patterns incohérents** (`hasQ` startsWith / `/regex/i.test` / `.startsWith`), `Incassable`
**dupliqué** (weaponDamage.ts:9 + combatFlow.ts:538), `Recharge` parsé à la main (items.ts:95).
**22 qualités d'arme + 4 d'armure (Flexible/Impénétrable/Partielle/Points Faibles) + 90+ traits**
existent en **données** (`qualities.json`/`traits.json`) **sans code**. Ajouter l'artisanat dans
ce style = aggraver la dette et éditer N fichiers par qualité.

**Solution — couche de comportement unifiée pour les qualités d'OBJET** (arme + armure + artisanat),
nouveau dossier `src/engine/qualities/` :
- `registry.ts` : `QualityDef` keyé par **label FR**, avec **hooks optionnels par moment** —
  `attackMods`, `defenseDR`, `damageDR`, `armourReduction`, `critTrigger`/`critFilter`, `onHit`
  (HitIntent : condition / dégât d'armure / déviation), `breakCheck`, `reload`, `fumble`,
  `economy` (facteur prix/dispo), `social`. Champs `type` (Atout/Défaut), `subType`
  (Arme/Armure/Objet), `beats[]` (**préséance** RAW, ex. *Imprécise > Précise*, LDB Armes l.20).
- `dispatch.ts` : dispatcher **pur** — `foldQualities(items, moment, ctx)` replie les hooks
  présents ; **les hooks renvoient des données, ne mutent jamais**. S'aligne sur les bons patterns
  existants (`ModLine`/`combineMods`, registre `conditions.ts`, préséance `effectiveChar`) — on
  **ne les refactore pas**, on s'y branche.
- `qualities.json` reste le **catalogue** (texte canon) ; la couche TS porte le **comportement** ;
  un **test de parité** vérifie que chaque qualité de données a un comportement (ou un opt-out
  explicite « cosmétique/narratif »).
- Combat/items appellent le dispatcher **au lieu** des `hasQ()` codés en dur.

**Migration sûre (golden-master, iso-comportement)** :
0. **Golden master** d'abord : capturer des combats seedés (séquences de jets/dégâts) comme filet anti-régression.
1. Types + registre + `dispatch` + parité **non-stricte**.
2. Migrer les hooks **numériques un par un** (Précise → Perforante → Pointue → Défensive/À Enroulement → Empaleuse), **golden après chaque**.
3. Pistolet (capacité), puis `Incassable` (**dédup** weaponDamage + combatFlow:538), `Recharge` (typé, fin du parse fragile), Poudre noire (fumble).
4. `Assommante` (HitIntent : Test opposé + condition Sonné ; RNG au call-site pour préserver l'ordre).
5. Parité **stricte**.
6. **AJOUTER** les nouvelles qualités comme **entrées de registre** → c'est là que se branchent les phases B/C1/C2/C3 (artisanat, armure intrinsèque, Taille-endommage-armure, Déviation Critique).
7. Supprimer le `hasQ` mort + les patterns dupliqués.

**Garde-fou (NE PAS toucher — discipline de périmètre)** : traits de créature & `spawn.ts` ;
`conditions.ts` / `ModLine` / `effectiveChar` / `trauma.ts` / `encumbrance.ts` (déjà propres) ;
Taille T2-T6 ; flux de combat / `battleRng` / modales / `bus` ; le **texte** de `qualities.json` ;
les **règles** elles-mêmes pendant la migration (refacto = iso-comportement). Périmètre =
`src/engine/qualities/` + les points d'appel listés en §7.

**Bénéfice** : après Phase 0, ajouter une qualité (artisanat, armure, ou plus tard une des 22+
qualités/90+ traits en attente) = **une entrée de registre testée**, pas des édits dispersés.

---

## 4. Modèle de données

### 4.1 Catalogue des qualités d'artisanat — entrées du **registre unifié** (§3.1)
Les 8 qualités d'artisanat (set canonique **fixe**, LDB 60) sont **des entrées du registre**
`src/engine/qualities/` créé en Phase 0 (leur *comportement* via hooks), avec leur métadonnée
canonique. Elles ne forment **pas** un module isolé parallèle — c'est tout l'intérêt de la Phase 0.

```ts
export type CraftAtoutKey = 'Léger' | 'Pratique' | 'Raffiné' | 'Solide';
export type CraftDefautKey = 'Bâclé' | 'Laid' | 'Peu Fiable' | 'Volumineux';

// Métadonnée (catalogue) — le COMPORTEMENT vit dans les hooks de la QualityDef du registre.
export interface CraftQualityMeta {
  key: CraftAtoutKey | CraftDefautKey;
  type: 'Atout' | 'Défaut';
  subType: 'Objet';
  stackable: boolean;        // Raffiné, Solide
  hasIndice: boolean;        // Solide (N)
  desc: string;              // texte canon (FR)
  source: { book: 'LDB'; page: number };
}
```
Hand-authored (pas via `build-data`, car absent de `all-data.json`) ; idéalement injecté dans
`qualities.json` (subType `Objet`) si on veut une source de vérité unique catalogue — à trancher au plan.

### 4.2 Champ d'instance — `ItemInstance.craft`
```ts
export interface CraftQuality { key: CraftAtoutKey | CraftDefautKey; indice?: number } // indice = N de Solide
export interface ItemCraft {
  atouts: CraftQuality[];
  defauts: CraftQuality[];
  identified: boolean;       // false = qualité cachée (révélée par Évaluation #2)
}
// types.ts : ItemInstance gagne `craft?: ItemCraft`
```
- **Séparé** de `qualities` (qualités d'arme) et des Atouts/Défauts d'armure intrinsèques (def).
- **Réutilise** `ItemInstance.damageTaken` (déjà présent) pour les pièces d'armure ET les armes.
- **Authoring** : les `EncounterDef.enemies[]` / `SceneEntity` / `giveTrapping` (et plus tard le marchand) peuvent fixer `craft`. Un helper `withCraft(item, {atouts, defauts, identified})` construit l'instance.

### 4.3 Pénalités de port d'armure — données
Le `def` d'armure (TrappingData) gagne un champ optionnel `wearPenalty` (depuis la table LDB 63) :
```ts
wearPenalty?: { skill: string; value: number }[]   // ex. [{skill:'Discrétion', value:-10}]
```
Source : table LDB 63 l.73-95. Renseigné par patch post-build (les `.json` sont régénérés ; cf. §8)
ou ajouté à `all-data.json`. *(Décision d'implémentation à trancher dans le plan — voir §9.)*

---

## 5. Couche économique (pure, sans état) — `src/engine/craftEconomy.ts`

Fonctions pures testables, **consommées par le marchand #2** :

- `craftPriceFactor(craft): number` → `2 ** nAtouts * 0.5 ** nDefauts` (chaque Atout ×2, chaque Défaut ÷2 ; Solide/Raffiné comptés à leur multiplicité). LDB 60 l.47/75.
- `craftAvailabilityShift(craft, opts?: { guild?: boolean }): number` → `(-nAtouts + nDefauts)` crans sur l'échelle `Commune < Limitée < Rare < Exotique` (Atout −1 = plus rare, Défaut +1 = plus courant). Exceptions : Exotique non modifié par les Défauts (l.77) ; option Guilde (l.69-72) → Défauts réduisent la Dispo et le 1er Atout ne la réduit pas.
- `qualityClass(item): 'Haute Qualité' | 'Qualité' | 'Standard' | 'Défectueuse'` :
  - **Haute Qualité** = 0 Défaut ET nAtouts > Enc (l.44) ;
  - **Qualité** = nAtouts > nDefauts ; **Défectueuse** = nDefauts > nAtouts ; sinon **Standard**.

> Note : ces fonctions ne *modifient* pas le prix stocké (les prix restent les prix catalogue
> du def) ; elles renvoient des **facteurs** que #2 applique au moment d'afficher/vendre.

---

## 6. Effets gameplay

### 6.1 Encombrement (Phase A) — `items.ts:totalEncumbrance` (74-79)
- Enc effectif d'un objet = `base + (Volumineux ? +1 : 0) + (Léger ? -1 : 0)`, plancher 0.
- Règle « porté −1 » (armure équipée) inchangée et **cumulative**.
- **Volumineux porté** : l'Enc porté est **forcé à 1** (l.91) → le « −1 » d'objet porté ne descend pas sous 1 si Volumineux. `maxEncumbrance` inchangé (BF+BE).
- Les paliers de surcharge (déjà dans `encumbrance.ts`) restent la consommation en aval.

### 6.2 Combat — armes (Phase B)
- **Solide(N)** — `weaponDamage.ts:damageWeapon` (46) : un compteur d'absorption ; tant que `damageTaken < N`, l'arme **encaisse sans pénalité** (l'effet de `effectiveWeaponDamage` ne s'applique qu'au-delà de N) → modéliser `effectiveWeaponDamage` avec un seuil `solideN`. À la cassure (destroyWeapon), **sauvegarde 9+ − (N−1) sur 1d10** (cumul Solide améliore le seuil) avant de casser. Seedable (`makeRNG`).
- **Bâclé** — hook fumble (`combatFlow.ts:509-517` + `oups.ts:isFumble`) : si l'attaquant **maladresse** (échec + double) avec une arme Bâclée → **destroyWeapon** (sans sauvegarde, hors Incassable). Généralisé aux tests hors combat en C2 (échec-double).
- **Pratique / Peu Fiable** — `combat.ts:applyHit` (456) où `effDR = dr + Pointue` : si l'**attaque échoue** et l'arme est Pratique → `+1 DR` ; Peu Fiable → `-1 DR`. (Impact marginal sur l'attaque mais RAW.) Il faut passer l'`ItemInstance` (ou ses flags craft) jusqu'à `applyHit` — cf. §7.

### 6.3 Combat — armure & Déviation Critique (Phase C1)
- **PA dérivée nette** — `items.ts:recomputeLoadout` (87-112) : pour chaque localisation, `PA = Σ (pièce.pa − pièce.damageTaken)`, plancher 0 ; pièce avec `pa − damageTaken < 0` ⇒ inutilisable (l.55). **Aucun refactor de `Combatant.armour`** : on garde le record dérivé, simplement calculé net des dégâts.
- **Déviation Critique** (l.63-66) — hook `combatFlow.ts:applyCriticalToTarget` (398-428) : si la cible a, à la localisation touchée, une pièce d'armure avec PA effective > 0, **proposer un choix** :
  - **Joueur** → modale `pendingDeviation` (pattern « si jet/choix → modale », cf. `game-roll-modal-pattern`) : *Dévier (−1 PA, ignore le critique)* / *Subir le critique*. Si dévier : on **n'appelle pas** `rollCritical`, on applique les Blessures normales **recalculées avec PA−1** (probable +1 Blessure), et on incrémente `damageTaken` de la pièce.
  - **IA/ennemi** → **dévie systématiquement** tant qu'une pièce d'armure utilisable protège la localisation (PA effective ≥ 1) : un Critique (trauma/condition/létalité) vaut bien plus qu'1 PA (décision utilisateur). Seule exception (sans objet) : si les Blessures normales le mettent déjà hors de combat. ⇒ l'armure ennemie **s'use** au fil du combat (synergie avec la réparation d'armure du marchand #2).
- **Taille** (arme, l.8) — `combat.ts:applyHit` : sur touche réussie avec une arme **Taille**, incrémenter `damageTaken` d'une pièce à la localisation frappée (ou bouclier).
- **Bâclé armure** (l.82) — si un **Coup Critique** est subi à une localisation protégée par une pièce **Bâclée** → la pièce **casse** (damageTaken = pa).

### 6.4 Tests hors combat, pénalités d'armure, social (Phase C2)
- **Liaison objet↔test** : `Effect.test` (scene.ts:156-166) et `PendingTest` (store.ts:88-106) gagnent `itemUid?` (l'outil utilisé). À la résolution (`store.ts:resolveTest` 1566), si **échec** et l'outil est Pratique → `+1 DR` ; Peu Fiable → `-1 DR` (ajuste `pt.sl` avant les branches `onSuccess/onFailure`). Bâclé hors combat : casse sur échec-double.
- **Pénalités de port d'armure** : quand un acteur fait un test (combat ou `Effect.test`) dont la compétence figure dans `wearPenalty` d'une armure qu'il **porte** → appliquer la pénalité. **Pratique** la réduit d'un −10 ; **Peu Fiable** la double. Hook : `skills.ts:testValue` (passer les pénalités du porteur) + `combat.ts:attackModifiers` si la compétence touche le combat.
- **Laid** (l.85) : −10 aux Tests de Sociabilité (`characteristic === 'Soc'`) du porteur. **Raffiné** : pas de bonus chiffré RAW (statut narratif) → seulement prix/dispo/affichage (assumé, cf. §10).
- **Volumineux** : Fatigue (Exténué dû à la surcharge) doublée — interaction nichée, modélisée a minima (cf. §10).

### 6.5 Atouts/Défauts d'armure intrinsèques (Phase C3, adjacente)
Implémenter au passage, puisque C1 ouvre le flux critique/PA :
- **Impénétrable** (l.109) : critiques issus d'un **toucher impair** ignorés.
- **Partielle** (l.115) : **toucher pair** ou critique ⇒ PA ignorés.
- **Points Faibles** (l.118) : **Empaleuse + critique** ⇒ PA ignorés.
- **Flexible** (l.106) : peut être portée sous une armure non-Flexible (cumul PA). (Touche `recomputeLoadout` empilement.)

---

## 7. Points d'intégration (file:line)

- **Fondation (Phase 0)** : nouveau `src/engine/qualities/` (registry + dispatch + parité). Les points ci-dessous sont **routés par le dispatcher** au lieu des `hasQ()` codés en dur ; les phases B/C/C3 = nouvelles **entrées de registre**, pas de nouveaux `if` épars.
- **Données** : `ItemInstance` (`types.ts:124-145`) +`craft`, `damageTaken` réutilisé armures ; `TrappingData` (`data/index.ts:76-91`) +`wearPenalty`.
- **Construction** : `itemFromTrapping` (`items.ts:34-62`) lit/initialise `craft` ; `withCraft()` helper.
- **Économie** : nouveau `craftEconomy.ts` (pur) — consommé par #2.
- **Encombrement** : `items.ts:totalEncumbrance` (74-79).
- **Loadout / PA nette** : `items.ts:recomputeLoadout` (87-112).
- **Dégâts/cassure d'arme** : `weaponDamage.ts` (damageWeapon 46, destroyWeapon 52, effectiveWeaponDamage 20, effectiveWeapon 40) ; `combatFlow.ts:wearActiveWeapon` (535-552, exemption Incassable).
- **Maladresse** : `oups.ts:isFumble` (18) ; `tests.ts:isDoubleRoll` (37) ; `combatFlow.ts` (509-517).
- **Attaque/DR/Taille** : `combat.ts:applyHit` (443-483, effDR 456) — **passer l'ItemInstance/flags** (signature ou cache `Combatant`).
- **Critique/Déviation** : `combatFlow.ts:applyCriticalToTarget` (398-428) ; `critical.ts:rollCritical` (44) ; nouvelle modale `pendingDeviation` (store).
- **Tests/itemUid** : `scene.ts` Effect.test (156-166) ; `store.ts` PendingTest (88-106), testRoll (1529), resolveTest (1566) ; `combatFlow.ts` création test (207-232).
- **Social/pénalités** : `skills.ts:testValue/partyBest` (16-40) ; `combat.ts:attackModifiers` (141-177) ; `characteristics.ts:effectiveChar` (22-31).
- **Affichage** : `CharacterSheet.tsx:itemStats` (73-80) + ligne item (168-174) → badges typés (Atout/Défaut/Haute Qualité/qualité inconnue), affichage `damageTaken` armure, Enc effectif.

---

## 8. Données & pipeline

- `trappings.json`/`qualities.json` sont **régénérés** par `npm run build:data` (filtre LDB/ADE) → **ne pas hand-éditer**.
- **Catalogue d'artisanat** : `src/engine/craftQualities.ts` (constante, hors pipeline) — set fixe de 8.
- **`wearPenalty`** d'armure : soit ajouté à `Source/all-data.json` puis mappé dans `build-data.ts` (231-246), soit table de patch post-build. *(À trancher au plan ; préférence : source de vérité dans `all-data.json` pour rester cohérent avec le filtre RAW.)*
- **`craft` d'instance** persiste déjà avec `ItemInstance` (sérialisation existante) — vérifier `persistence.ts`/`carryOverState` pour `damageTaken` d'armure.
- ⚠️ **Réconciliation monnaie** : `price.bronze` (data) vs `Money.brass` (store) — non bloquant pour #1 (pas de prix en jeu ici), **à corriger dans #2**. Noté.

---

## 9. Tests (Vitest, moteur pur d'abord)

- **Phase 0** : `qualities/parity.test.ts` (chaque qualité de `qualities.json` a un comportement ou un opt-out déclaré) ; **golden-master** de combats seedés (avant migration → après chaque étape, diff nul) ; tests unitaires du dispatcher (`foldQualities`, préséance `beats`).
- `craftEconomy.test.ts` : prix ×2/÷2 (multiplicités), shift de dispo (+ exception Exotique + option Guilde), `qualityClass` (Haute Qualité/Qualité/Défectueuse/Standard), exemples canon (pelle 2 Atouts ×4 Commune→Rare ; cotte Volumineux+Peu Fiable ¼ Rare→Commune).
- `encumbrance` : Léger/Volumineux + porté −1 + Volumineux-porté=1.
- `weaponDamage` : Solide(N) absorption seuil + sauvegarde 9+/8+ (RNG seedé) ; Bâclé casse sur maladresse ; Incassable prioritaire.
- `armourDamage` (nouveau) : PA dérivée nette ; pièce inutilisable < 0 ; Taille endommage ; Bâclé armure casse sur critique.
- `deviation` : Déviation Critique (choix dévier → pas de critique, +1 Blessure probable, −1 PA) ; IA heuristique ; modale (`pendingDeviation`) — piège fake-timers (`clearAllTimers`, cf. `game-roll-modal-pattern`).
- `test DR` : Pratique/Peu Fiable ±1 DR sur attaque ratée et `Effect.test` raté (via `itemUid`).
- `social/pénalités` : Laid −10 Soc ; pénalité de port d'armure appliquée + modifiée Pratique/Peu Fiable.
- (C3) `armourQualities` : Impénétrable/Partielle/Points Faibles/Flexible.
- **Recette navigateur** (Playwright MCP) via scénario de test : équiper objets de qualité, déclencher critique → modale Déviation, vérifier console 0 erreur (cf. `game-browser-verif-tempo`).

---

## 10. Décisions, hypothèses & écarts RAW assumés

- **Raffiné** : aucun bonus de test chiffré en RAW (« signe de statut ») → impacte uniquement prix/dispo/affichage. (Pas d'invention de bonus.)
- **Volumineux / Fatigue ×2** : modélisé a minima (interaction surcharge) — niche ; détaillé au plan.
- **« −20 % » marchandage** (sous-projet #2) : déclenché sur **DR net** du test opposé ≥ 6 (décision utilisateur).
- **Heuristique IA Déviation Critique** (décision utilisateur) : l'ennemi **dévie toujours** tant qu'il reste de la PA utilisable sur la localisation (un Critique > 1 PA). Côté joueur = choix libre via modale.
- **`wearPenalty` source** : à trancher (all-data.json vs patch) — préférence all-data.json.
- **Passage de l'ItemInstance à `applyHit`** : nécessite un changement de signature *ou* un cache `Combatant.activeWeaponItem` — à trancher au plan (préférence : paramètre explicite, moteur pur).
- **Phase C3** (Atouts/Défauts d'armure intrinsèques) : recommandée car C1 ouvre déjà le flux critique/PA ; peut être déplacée hors #1 si on veut borner.

---

## 11. Definition of Done (#1)

- [ ] **Phase 0** : registre `src/engine/qualities/` + dispatcher pur ; ~9 checks épars migrés ; `Incassable`/`Recharge` dédupliqués/typés ; parité + golden-master verts ; **iso-comportement** prouvé.
- [ ] `craft` modélisé sur l'instance + catalogue des 8 qualités (RAW cité).
- [ ] Économie pure (prix/dispo/classe) testée — **prête pour #2**.
- [ ] Encombrement Léger/Volumineux (+ porté/−1 + Volumineux=1).
- [ ] Combat armes : Solide(N)+sauvegarde, Bâclé, Pratique/Peu Fiable.
- [ ] Dégâts d'armure (PA nette) + **Déviation Critique** (modale + IA) + Taille + Bâclé armure.
- [ ] Tests hors combat (`itemUid`), pénalités de port d'armure, Laid.
- [ ] (C3) Atouts/Défauts d'armure intrinsèques.
- [ ] Affichage (badges, qualité inconnue, PA endommagée, Enc effectif).
- [ ] `npm test` + `npm run typecheck` verts ; recette navigateur OK.
- [ ] Aucune règle inventée hors écarts §10 (tous tracés + cités).
