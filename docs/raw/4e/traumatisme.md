# Atlas RAW — Traumatisme & Blessures critiques (LDB 18)

> Référentiel **scoped** des règles WFRP4 (RAW) du **chapitre 18 — Traumatisme** du Livre de base,
> à usage d'agent (vérifier que le code respecte le RAW). Chaque règle cite `LDB 18 l.X-Y`
> (l = lignes du fichier `Source/Warhammer v4 - Livre de base version corrigee/18 - Traumatisme.md`).
> Abréviations : [`sources.md`](../sources.md). Index : [`00-index.md`](00-index.md).
>
> ⚠️ **Tables de Critiques** (Tête / Bras / Torse / Jambe, `LDB 18 l.56-187`) — déjà transcrites verbatim dans
> **[combat.md § Critiques et Frappe Mortelle](combat.md#critiques-et-frappe-mortelle)** (lignes 542–641).
> Ce fichier ne les re-transcrit **pas** — renvoi systématique.
> ⚠️ Les champs **Implémente** sont GÉNÉRÉS (`npm run raw:implemente` — source éditoriale : `src/data/raw.manifest.json`) — ne pas les éditer à la main.

## Sommaire

- [Points de Blessure — perte, réduction, À Terre et Inconscient](#1-points-de-blessure--perte-réduction-à-terre-et-inconscient)
- [Blessures Critiques — déclenchement et overflow](#2-blessures-critiques--déclenchement-et-overflow)
- [Retenir ses coups](#3-retenir-ses-coups)
- [Tableaux des Critiques — renvoi](#4-tableaux-des-critiques--renvoi)
- [Mort — condition et mort lente](#5-mort--condition-et-mort-lente)
- [Option : Mort Subite](#6-option--mort-subite)
- [Fractures (Mineure / Majeure)](#7-fractures-mineure--majeure)
- [Déchirures musculaires (Mineure / Majeure)](#8-déchirures-musculaires-mineure--majeure)
- [Amputation — choc, traitement et séquelles permanentes](#9-amputation--choc-traitement-et-séquelles-permanentes)
- [Guérison des Points de Blessure](#10-guérison-des-points-de-blessure)
- [Guérison des Blessures Critiques — Aide Médicale et Chirurgie](#11-guérison-des-blessures-critiques--aide-médicale-et-chirurgie)
- [Exposition (chaleur et froid)](#12-exposition-chaleur-et-froid)
- [Faim et Soif](#13-faim-et-soif)
- [Noyade et Suffocation](#14-noyade-et-suffocation)

---

## 1. Points de Blessure — perte, réduction, À Terre et Inconscient

**Formule de base** (`LDB 18 l.12-19`) :

> Dégâts infligés − Bonus d'Endurance (BE) − PA = PB perdus

BE et PA réduisent les Dégâts **sauf indication contraire** (certaines règles les ignorent explicitement : Blessures critiques overflow, Suffocation, Exposition — voir sections ci-dessous).

**À 0 PB** (`LDB 18 l.15`) : le personnage gagne l'État **À Terre** s'il ne le possède pas déjà. Il ne peut pas s'en débarrasser tant qu'il n'a pas récupéré au moins 1 PB. Si aucune guérison ne survient **avant un nombre de Rounds égal à son BE**, il gagne l'État **Inconscient**. Il ne reprend pas conscience tant qu'il n'a pas récupéré au moins 1 PB.

> « Si vous perdez tous vos Points de Blessure, les atteintes vous accablent et vous gagnez l'État *À Terre* si vous ne le possédez pas déjà. […] si vous n'êtes pas guéri avant un nombre de Rounds égal à votre Bonus d'Endurance, vous perdrez connaissance, et gagnerez l'État *Inconscient*. » — `LDB 18 l.15`

**Minimum 0** (`LDB 18 l.19`) : les PB ne passent jamais en négatif au runtime — le minimum est 0. La valeur « négative fictive » est calculée uniquement pour le modificateur d'overflow sur les Critiques (§ 2).

**Sources RAW** : `LDB 18 l.12-19`.

**Voir aussi** : États À Terre / Inconscient → [etats.md](etats.md) (LDB 16) ; [Guérison des PB](#10-guérison-des-points-de-blessure).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 18` (l.12-19) → `followsCharacterRules`, `isHealable`, `doc`, `estDebout`, `outOfCombatUpkeep`, `niMortNiATerre`, `HealWoundsOptions`, `needsRecoveryRoll`, `applyHealWounds`, `ACTION_GATES`, +24 — `src/data/index.ts`, `src/data/schemas/defs/etats.ts`, `src/engine/combat.ts`, `src/engine/conditions.ts`, `src/engine/critical.ts`, `src/engine/healing.ts`, +14 fichiers

---

## 2. Blessures Critiques — déclenchement et overflow

**Deux sources** (`LDB 18 l.22-38`) :

1. **Coup Critique** — déclenché en combat (double réussi en CC/Projectiles ; voir [combat.md](combat.md)).
2. **Overflow de PB** — on subit plus de Dégâts qu'on ne possède de PB (excédent négatif).

**Modificateur d'overflow** (`LDB 18 l.17`) : si le total de PB tomberait à un valeur négative dont la valeur absolue est **inférieure** au BE, appliquer **−20 au résultat sur le Tableau des Critiques**, minimum 01.

> « Si vos Points de Blessure en négatifs sont inférieurs à votre Bonus d'Endurance, vous ôtez -20 à votre résultat sur le Tableau des Critiques avec un résultat minimum de 01. » — `LDB 18 l.17`

Exemple : BE = 4, PB restants = 2, Dégâts = 8 → PB fictifs = −6 → |−6| = 6 > BE 4 → **pas** de −20. Mais si PB fictifs = −3 → |−3| = 3 < BE 4 → **−20 appliqué**.

**PB d'une Blessure critique** (`LDB 18 l.53`) : les PB perdus indiqués dans le Tableau **ignorent BE et PA**. Ces PB perdus n'entraînent **pas** eux-mêmes de nouvelles Blessures critiques.

**Sources RAW** : `LDB 18 l.17`, `l.34-41`, `l.62`.

**Voir aussi** : déclenchement du Coup Critique → [combat.md § Critiques](combat.md#critiques-et-frappe-mortelle) (LDB 13/14) ; tableaux complets → [§ 4](#4-tableaux-des-critiques--renvoi).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 18` (l.17, l.22-38, l.53) → `criticals-ldb-tete`, `CritEntry`, `isHealable`, `blessure-spectaculaire`, `doc`, `coupure-mineure`, `estDebout`, `outOfCombatUpkeep`, `niMortNiATerre`, `coup-a-l-il`, +61 — `src/data/combat-stakes.json`, `src/data/criticals.json`, `src/data/criticals.ts`, `src/data/index.ts`, `src/data/regles.json`, `src/data/reglesOptionnelles.json`, +25 fichiers

---

## 3. Retenir ses coups

(`LDB 18 l.30`) Le personnage peut **déclarer qu'il retient ses coups avant d'effectuer le lancer**. Tout Coup Critique obtenu est alors ignoré. Applicable en entraînement ou pour maîtriser un adversaire sans le blesser grièvement.

> « Une fois ces spécificités présentes dans votre esprit, vous pouvez décider d'ignorer tout Coup Critique que vous obtiendrez si vous déclarez que vous "retenez vos coups" **avant d'effectuer votre lancer**. » — `LDB 18 l.30`

**Sources RAW** : `LDB 18 l.30`.

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 18` (l.30) → `EtatPanel`, `combat-sudden-death`, `PendingDeviation`, `inDeathCondition`, `applyAttackResult`, `appliquerToucheDeProjectile` — `src/data/reglesOptionnelles.json`, `src/engine/conditions.ts`, `src/state/combatFlow.ts`, `src/state/pendings.ts`, `src/ui/EtatPanel.tsx`

---

## 4. Tableaux des Critiques — renvoi

> ⚠️ **Les quatre tableaux de Critiques (Tête / Bras / Torse / Jambe, `LDB 18 l.56-187`) sont transcrits verbatim dans [combat.md § Critiques et Frappe Mortelle](combat.md#critiques-et-frappe-mortelle) (lignes 542–641). Ne pas re-transcrire ici.**

**Procédure de tirage** (`LDB 18 l.53-55`) :

1. Lancer **1ᵉʳ d100** → Tableau de Localisation humanoïde (Tête / Bras / Torse / Jambe).
2. Lancer **2ᵉ d100** → ligne du Tableau des Critiques de la localisation.
3. Appliquer les **PB perdus** (ignorent BE et PA).
4. Appliquer les **Effets supplémentaires** (États, Fractures, Déchirures, Amputations).
5. Les Dégâts non critiques de l'attaque utilisent **la nouvelle localisation** (`LDB 18 l.55`).

Certains résultats indiquent **Inconscient** — le personnage reste inconscient jusqu'à la fin de la rencontre ou jusqu'à Aide Médicale, sauf mention contraire dans l'entrée.

Résultat **00** dans l'un des quatre tableaux = **mort instantanée** (Décapitation / Éventré / Démembrement brutal / Bassin fracassé).

**Sources RAW** : `LDB 18 l.53-55`.

**Voir aussi** : tables complètes → [combat.md § Critiques](combat.md#critiques-et-frappe-mortelle) ; Fractures → [§ 7](#7-fractures-mineure--majeure) ; Déchirures → [§ 8](#8-déchirures-musculaires-mineure--majeure) ; Amputations → [§ 9](#9-amputation--choc-traitement-et-séquelles-permanentes).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 18` (l.53-55, l.56-187) → `criticals-ldb-tete`, `CritEntry`, `dechirure-jambe-mineure`, `blessure-spectaculaire`, `HealMode`, `actBlockReason`, `MedicState`, `availableHealModes`, `critEscalationSchema`, `dechirure-autre-mineure`, +137 — `src/data/combat-stakes.json`, `src/data/criticals.json`, `src/data/criticals.ts`, `src/data/flow-stakes.json`, `src/data/night-stakes.json`, `src/data/regles.json`, +19 fichiers

---

## 5. Mort — condition et mort lente

**Mort lente** (`LDB 18 l.42-43`) : si un personnage est **Inconscient** avec **0 PB**, comparer son **total de Blessures critiques** à son **BE**. Si ce total **dépasse** le BE → mort à la **fin du Round**, sauf si quelqu'un guérit au moins une Blessure critique avant.

> « Si vous obtenez l'État *Inconscient* et que vous avez 0 Point de Blessure, comparez le total de Blessures critiques dont vous souffrez avec votre Bonus d'Endurance. Si le total de Blessures critiques dépasse celui de votre Bonus d'Endurance, vous succombez à vos terribles lésions et mourrez à la fin du Round. » — `LDB 18 l.34`

**Mort instantanée par résultat 00** (`LDB 18 l.38-40`) : certains résultats des Tableaux de Critiques indiquent directement Mort — mort immédiate, pas de Test de Résistance possible.

**Destin** (`LDB 18 l.40`) : si la mort est imminente, le joueur peut dépenser un Point de Destin (renvoi LDB 17 — voir [destin.md](destin.md)).

**Sources RAW** : `LDB 18 l.38-40` (mort instantanée) ; `LDB 18 l.42-43` (mort lente).

**Voir aussi** : [Option : Mort Subite](#6-option--mort-subite) ; Destin → [destin.md](destin.md).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 18` (l.34, l.38-40, l.42-43) → `criticals-ldb-tete`, `blessure-spectaculaire`, `coupure-mineure`, `coup-a-l-il`, `frappe-a-l-oreille`, `coup-percutant`, `il-au-beurre-noir`, `crit-severity`, `critWoundLocation`, `crit-row-test`, +26 — `src/data/combat-stakes.json`, `src/data/criticals.json`, `src/data/regles.json`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs/criticals.ts`, `src/data/traumas.json`, +7 fichiers

---

## 6. Option : Mort Subite

(`LDB 18 l.44-46`) Règle optionnelle : quand une cible subit **plus de Dégâts qu'elle ne possède de PB**, elle meurt de façon dramatique ou gagne immédiatement l'État **Inconscient** (au choix du MJ). Recommandée pour les PNJ non importants. **Ne s'applique jamais aux PJ ni aux PNJ importants.**

> « Lorsque votre cible subit plus de Dégâts qu'elle ne possède de Points de Blessure, elle meurt de façon dramatique ou gagne immédiatement l'État *Inconscient*. » — `LDB 18 l.46`

**Sources RAW** : `LDB 18 l.44-46`.

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 18` (l.44-46) → `criticals-ldb-tete`, `blessure-spectaculaire`, `coupure-mineure`, `coup-a-l-il`, `frappe-a-l-oreille`, `coup-percutant`, `il-au-beurre-noir`, `crit-severity`, `critWoundLocation`, `crit-row-test`, +24 — `src/data/combat-stakes.json`, `src/data/criticals.json`, `src/data/regles.json`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs/criticals.ts`, `src/data/traumas.json`, +6 fichiers

---

## 7. Fractures (Mineure / Majeure)

Source : `LDB 18 l.193-213`.

Un traumatisme **Fracture** est soit **Mineure** soit **Majeure**. La Localisation touchée est **inutilisable** tant que l'os n'est pas guéri. Les effets selon la localisation sont communs aux deux variantes :

| Localisation | Effets immédiats |
|---|---|
| **Bras / Jambe** | Règles de Membre Amputé (voir [§ 9](#9-amputation--choc-traitement-et-séquelles-permanentes)) |
| **Tête** | Régime liquide obligatoire, −30 aux Tests de Langue |
| **Torse** | −30 en Force et en Agilité ; Mouvement ÷ 2 |

### Fracture (Mineure) — `LDB 18 l.197-204`

L'os est fracturé mais aligné ; peut guérir sans intervention chirurgicale.

**Guérison** :
- Durée : **30 + 1d10 jours**.
- À la fin : Test de **Résistance Accessible (+20)**. Succès → guérison complète. Échec → pénalité **permanente −5** aux Tests liés (Agilité pour Bras/Jambe/Torse ; Tests de Langue pour Tête).
- Avec un **Test de Guérison Accessible (+20) réussi dans la semaine** suivant la fracture : pas de Test de Résistance requis (zone bandée et immobile pendant toute la guérison). Si le bandage est défait : second Test de Guérison dans les 24 h pour éviter le Test de Résistance final.

### Fracture (Majeure) — `LDB 18 l.207-213`

L'os est salement fracturé ou a éclaté : « Il est fort peu probable qu'il se soigne correctement sans intervention médicale » (`LDB 18 l.208`).

**Guérison** :
- Durée : **40 + 1d10 jours** (10 jours supplémentaires).
- Tous les Tests de guérison passent en **Intermédiaire (+0)** (au lieu de Accessible +20).
- Pénalité permanente en cas d'échec : **−10** (au lieu de −5).

**Sources RAW** : `LDB 18 l.197-204` (Mineure) ; `LDB 18 l.207-213` (Majeure).

**Voir aussi** : [Amputation — Membre amputé](#9-amputation--choc-traitement-et-séquelles-permanentes) ; [Guérison des Blessures Critiques](#11-guérison-des-blessures-critiques--aide-médicale-et-chirurgie).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 18` (l.193-213) → `dechirure-jambe-mineure`, `availableHealModes`, `dechirure-autre-mineure`, `fracture-torse-mineure`, `trauma-fracture`, `fracture-torse-majeure`, `fracture-jambe-mineure`, `fracture-jambe-majeure`, `fracture-tete-mineure`, `fracture-tete-majeure`, +27 — `src/data/criticals.json`, `src/data/flow-stakes.json`, `src/data/night-stakes.json`, `src/data/regles.json`, `src/data/traumas.json`, `src/engine/combat.ts`, +7 fichiers

---

## 8. Déchirures musculaires (Mineure / Majeure)

Source : `LDB 18 l.215-231`.

### Déchirure musculaire (Mineure) — `LDB 18 l.219-222`

Un muscle est déchiré : **−10 à tous les Tests** concernant la Localisation touchée. Si **Jambe** : Mouvement ÷ 2.

**Guérison** :
- Durée : **30 − BE jours**.
- Un Test de **Guérison réussi** réduit cette durée d'1 jour (+ 1 par DR supplémentaire). Cet avantage ne peut être obtenu **qu'une seule fois**.

### Déchirure musculaire (Majeure) — `LDB 18 l.226-231`

Pénalité portée à **−20** (même localisation/Mouvement que Mineure).

**Guérison en deux temps** :
1. Première moitié (**30 − BE jours**) → pénalité passe à **−10**.
2. Seconde moitié (**30 − BE jours** supplémentaires) → guérison complète.

La Compétence Guérison ne raccourcit pas la Majeure (elle informe seulement que le membre est inutilisable jusqu'à guérison complète).

**Sources RAW** : `LDB 18 l.219-222` (Mineure) ; `LDB 18 l.226-231` (Majeure).

**Voir aussi** : [Guérison des Blessures Critiques](#11-guérison-des-blessures-critiques--aide-médicale-et-chirurgie).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 18` (l.215-231) → `dechirure-jambe-mineure`, `CritEntry`, `amputationWoundDesc`, `availableHealModes`, `dechirure-jambe-majeure`, `feuille`, `OP_DEFS`, `dechirure-autre-mineure`, `Amputation`, `dechirure-autre-majeure`, +40 — `src/data/criticals.ts`, `src/data/flow-stakes.json`, `src/data/night-stakes.json`, `src/data/regles.json`, `src/data/schemas/defs/criticals.ts`, `src/data/schemas/grammaire/mecanique.ts`, +11 fichiers

---

## 9. Amputation — choc, traitement et séquelles permanentes

Source : `LDB 18 l.233-285`.

### Mécanique de choc (`LDB 18 l.237-239`)

Quand un résultat de Critique indique **Amputation (Difficulté)**, Test de **Résistance** à la difficulté indiquée :

| Résultat | Effet |
|---|---|
| Succès | Aucun effet supplémentaire |
| Échec (jusqu'à −2 DR) | État *À Terre* |
| Échec (−2 DR ou pire) | État *À Terre* + État *Sonné* |
| Échec (−4 DR ou pire) | État *À Terre* + *Sonné* + *Inconscient* |

> « À chaque fois que vous subissez une Blessure critique où il est indiqué *Amputation (Difficulté)*, vous devez réussir un Test de **Résistance** (la difficulté est indiquée entre parenthèses) ou gagner 1 État *À Terre*. Sur un échec (−2 DR) ou pire, vous recevez également un État *Sonné*. Si vous échouez avec au moins −4 DR, gagnez un État *Inconscient*. » — `LDB 18 l.237`

### Traitement (`LDB 18 l.239`)

Toute amputation nécessite une **Chirurgie** pour être traitée. La blessure ne peut pas guérir sans intervention d'un chirurgien (voir [§ 11](#11-guérison-des-blessures-critiques--aide-médicale-et-chirurgie)).

### Séquelles permanentes par partie amputée (`LDB 18 l.242-285`)

| Partie | Effets permanents |
|---|---|
| **Bras** | Règles de la main + impossible de sangler un bouclier à ce bras. Deux bras : autonomie sévèrement réduite. |
| **Dents** | −1 Sociabilité par paire perdue. Plus de la moitié : nourriture solide très difficile. (Humains 16 / Elfes 18 / Nains & Halflings 20 dents.) |
| **Doigts** | −5 aux Tests de la main par doigt perdu. Unités 1 = Maladresse, 2 = unités 1 et 2, etc. 4 doigts+ → règle main tranchée. |
| **Jambe** | Règles du pied + impossible d'utiliser le Talent Esquive. |
| **Langue** | Tout Test de Langue impliquant la parole = échec automatique. |
| **Main** | −20 aux Tests de cette main ; pas d'arme à deux mains. Main principale perdue : −20 aux Tests d'Arme de la main secondaire (réductible −5 par 100 PX). |
| **Nez** | −20 Sociabilité permanent + −30 aux Tests d'odorat. |
| **Œil** | Deux yeux perdus : −30 aux Tests liés à la vue. −5 Sociabilité par orbite vide visible. |
| **Oreille** | Deux oreilles perdues : −20 aux Tests de Perception (ouïe). −5 Sociabilité par oreille perdue visible. |
| **Orteils** | −1 permanent Agilité + −1 permanent Capacité de Combat par orteil perdu. |
| **Pied** | Mouvement ÷ 2 permanent + −20 aux Tests de mobilité (Esquive inclus). Deux pieds : marche quasi impossible. |

**Sources RAW** : `LDB 18 l.237-285`.

**Voir aussi** : [Chirurgie](#11-guérison-des-blessures-critiques--aide-médicale-et-chirurgie) ; États → [etats.md](etats.md).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 18` (l.233-285) → `faim`, `cumulSchema`, `isFumble`, `soif`, `dechirure-jambe-mineure`, `recovery`, `CritEntry`, `amputationWoundDesc`, `TraumaCumul`, `dechirure-jambe-majeure`, +62 — `src/data/criticals.ts`, `src/data/flow-stakes.json`, `src/data/night-stakes.json`, `src/data/regles.json`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs/criticals.ts`, +13 fichiers

---

## 10. Guérison des Points de Blessure

Source : `LDB 18 l.289-300`.

Un personnage est **blessé** s'il a perdu au moins 1 PB. Il n'y a **aucune pénalité** à être blessé (les PB perdus représentent petites coupures et bleus).

**Guérison naturelle** (une fois par jour, après une bonne nuit de sommeil) :
1. Test de **Résistance Accessible (+20)**.
2. Sur succès : récupère **DR + BE** PB.

**Guérison par repos** : pour chaque **journée de repos complet**, récupère également **BE** PB (sans Test).

**Guérison assistée** (`LDB 18 l.298`) : via Compétence Guérison ou matériel (bandages, cataplasmes). Avec matériel stérile → pas d'Infection suite à la blessure. Voir Compétence Guérison (LDB 09).

> « Une fois par jour, vous pouvez tenter, sans aide médicale, un Test de **Résistance Accessible (+20)**, après avoir passé une bonne nuit de sommeil. Vous guérissez un nombre de Points de Blessure équivalent à votre DR + Bonus d'Endurance. » — `LDB 18 l.296`

**Sources RAW** : `LDB 18 l.289-300`.

**Voir aussi** : Compétence Guérison → [competences.md](competences.md) (LDB 09 l.255-269) ; [Guérison des Blessures Critiques](#11-guérison-des-blessures-critiques--aide-médicale-et-chirurgie) ; Faim/Soif → [§ 13](#13-faim-et-soif) (sans provisions : pas de récupération naturelle).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 9` (l.255-269) → `carryOverState`, `useDefenseJetProps`, `healDifficulty`, `healWoundsDelta`, `rederiveAttack`, `stopBleedOutcome`, `HealWoundsOptions`, `applyHealWounds`, `defenseSubOf`, `heal-wounds`, +11 — `src/data/flow-stakes.json`, `src/data/index.ts`, `src/data/skills.json`, `src/engine/healing.ts`, `src/engine/persistence.ts`, `src/engine/types.ts`, +4 fichiers
- `LDB 18` (l.289-300) → `faim`, `cumulSchema`, `soif`, `recovery`, `dechirure-jambe-majeure`, `OP_DEFS`, `exposure`, `dechirure-autre-majeure`, `critEscalationSchema`, `exposure-heat-drop`, +37 — `src/data/night-stakes.json`, `src/data/regles.json`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs/criticals.ts`, `src/data/schemas/defs/traumas.ts`, `src/data/schemas/grammaire/mecanique.ts`, +12 fichiers

---

## 11. Guérison des Blessures Critiques — Aide Médicale et Chirurgie

Source : `LDB 18 l.303-320`.

**Gravement Blessé** (`LDB 18 l.304`) : au moins une Blessure critique présente. Les Blessures critiques ne sont pas guéries tant que tous les États associés n'ont pas été retirés ET que les modificateurs non permanents n'ont pas été supprimés.

### Aide Médicale (`LDB 18 l.307-312`)

Certaines entrées des Tableaux de Critiques exigent une **Aide Médicale** pour retirer un État ou lever une restriction. Formes acceptées :
- Compétence Guérison (Test réussi).
- Bandage, cataplasme ou équivalent.
- Sort ou Prière de soin.

### Chirurgie (`LDB 18 l.314-320`)

Certaines entrées exigent une **Chirurgie** (indiquée dans le résultat). Les pénalités persistent jusqu'à intervention d'un chirurgien compétent (barbier-chirurgien, magie, prière). Une amputation ne peut pas guérir sans chirurgie.

> « Certaines blessures requièrent bien plus que l'application de cataplasmes à l'odeur nauséabonde et quelques points de suture. » — `LDB 18 l.316`

**Sources RAW** : `LDB 18 l.304-305` (Gravement Blessé) ; `LDB 18 l.307-312` (Aide Médicale) ; `LDB 18 l.314-320` (Chirurgie).

**Voir aussi** : Compétence Guérison → [competences.md](competences.md) ; [Fractures](#7-fractures-mineure--majeure) ; [Déchirures](#8-déchirures-musculaires-mineure--majeure) ; [Amputation](#9-amputation--choc-traitement-et-séquelles-permanentes).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 18` (l.303-320) → `faim`, `soif`, `bandEntry`, `recovery`, `SEA_KINDS_SOUS_ORDRES`, `exposure`, `ExposureKind`, `critEscalationSchema`, `exposure-heat-drop`, `exposureTestCount`, +29 — `src/data/night-stakes.json`, `src/data/regles.json`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs-scenes/effets.ts`, `src/data/schemas/defs/criticals.ts`, `src/data/voyage-stakes.json`, +15 fichiers

---

## 12. Exposition (chaleur et froid)

Source : `LDB 18 l.327-334`.

Après **4 heures** dans un environnement difficile (températures négatives, désert brûlant, tempête), un Test de **Résistance** est requis. En conditions **extrêmes** : toutes les **2 heures**.

### Chaleur (`LDB 18 l.330-332`)

| Échec n° | Effet |
|---|---|
| 1er | −10 Intelligence + −10 Force Mentale + 1 État *Exténué* |
| 2e | Toutes les autres Caractéristiques −10 + 1 État *Exténué* supplémentaire |
| 3e+ | 1d10 Dégâts (ignorent PA ; minimum 1 PB) |

Se débarrasser d'une Possession lourde annule 1 Test échoué.

### Froid (`LDB 18 l.334`)

| Échec n° | Effet |
|---|---|
| 1er | −10 CT + −10 Agilité + −10 Dextérité |
| 2e | Toutes les autres Caractéristiques −10 |
| 3e+ | 1d10 Dégâts (ignorent PA ; minimum 1 PB). À 0 PB : *Inconscient* immédiat |

**Sources RAW** : `LDB 18 l.327-334`.

**Voir aussi** : Possessions accordant bonus/malus aux Tests d'Exposition (LDB 65 l.44 / LDB 74 p.309).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 18` (l.327-334) → `faim`, `soif`, `bandEntry`, `recovery`, `SEA_KINDS_SOUS_ORDRES`, `hungerThirstPenalty`, `effectiveChar`, `RESISTANCE_TEST`, `HungerState`, `ThirstState`, +43 — `src/data/night-stakes.json`, `src/data/regles.json`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs-scenes/effets.ts`, `src/data/voyage-stakes.json`, `src/engine/characteristics.ts`, +14 fichiers
- `LDB 65` (l.44) → `exposureTarget`, `vetements-et-accessoires`, `ItemCapabilities`, `amulette`, `bijoux`, `bottes`, `canne-de-marche`, `cape`, `capuchon`, `masque`, +29 — `src/data/index.ts`, `src/data/reglesOptionnelles.json`, `src/data/trappings.json`, `src/data/weaponGroups.json`, `src/engine/exposure.ts`

---

## 13. Faim et Soif

Source : `LDB 18 l.337-343`.

Tests de Résistance de difficulté croissante (−10 supplémentaires par Test raté). Sans provisions : **impossible de récupérer des PB** ou de se débarrasser de l'État *Exténué* naturellement.

### Eau (`LDB 18 l.340`)

Test de Résistance chaque **jour** sans eau.

| Échec n° | Effet |
|---|---|
| 1er | −10 Intelligence + −10 Force Mentale + −10 Sociabilité |
| 2e+ | Toutes les autres Caractéristiques −10 + 1d10 Dégâts (ignorent PA ; minimum 1 PB) |

### Nourriture (`LDB 18 l.342`)

Test de Résistance tous les **deux jours** sans nourriture.

| Échec n° | Effet |
|---|---|
| 1er | −10 Force + −10 Endurance |
| 2e+ | Toutes les autres Caractéristiques −10 + 1d10 Dégâts (ignorent PA ; minimum 1 PB) |

**Sources RAW** : `LDB 18 l.337-343`.

**Voir aussi** : Provisions / rations → [deplacement.md](deplacement.md#provisions-en-voyage) (consommation par jour), [maladies.md](maladies.md#provisions-et-privations-en-mer--eau-rations-faim-mdg) (eau, rations, faim en mer) ; [Guérison des PB](#10-guérison-des-points-de-blessure) (sans provisions : pas de récupération).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 18` (l.337-343) → `faim`, `soif`, `bandEntry`, `recovery`, `SEA_KINDS_SOUS_ORDRES`, `hungerThirstPenalty`, `effectiveChar`, `RESISTANCE_TEST`, `HungerState`, `ThirstState`, +50 — `src/data/night-stakes.json`, `src/data/regles.json`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs-scenes/effets.ts`, `src/data/voyage-stakes.json`, `src/engine/characteristics.ts`, +18 fichiers

---

## 14. Noyade et Suffocation

Source : `LDB 18 l.346`.

**Retenir son souffle** (préparation) : durée = **BE × 10 secondes** sans Test.

**Suffocation soudaine** (sans préparation) : perd **1 PB par Round**. À 0 PB → État *Inconscient* immédiat. Après un nombre de Rounds égal au **BE** à 0 PB → mort.

> « Vous perdez 1 Point de blessure par Round que vous passez à suffoquer. Si vos Points de blessure passent à 0, gagnez immédiatement l'État Inconscient. Après cela, et au bout d'un nombre de Rounds égal à votre Bonus d'Endurance, vous mourez par suffocation ou par noyade. » — `LDB 18 l.346`

**Sources RAW** : `LDB 18 l.346`.

**Voir aussi** : États → [etats.md](etats.md) ; sorts infligeant Suffocation (Ombres étrangleuses, Transmutation de Chamon).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 18` (l.346) → `faim`, `soif`, `recovery`, `hungerThirstPenalty`, `effectiveChar`, `RESISTANCE_TEST`, `HungerState`, `ThirstState`, `breathHoldSeconds`, `exposure`, +38 — `src/data/night-stakes.json`, `src/data/regles.json`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs-scenes/effets.ts`, `src/data/voyage-stakes.json`, `src/engine/characteristics.ts`, +14 fichiers
