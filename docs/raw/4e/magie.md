# Atlas RAW — Magie (règles)

> Base de connaissance des **règles WFRP4 (RAW)**, consolidées sur les livres autorisés, à usage d'agent
> (vérifier que le code respecte le RAW). Chaque règle cite sa source `LIVRE NN l.X-Y`
> (NN = préfixe du fichier de chapitre, l = lignes du `.md` source). **Voir aussi** tisse les renvois
> entre règles ; **Implémente** pointe le(s) module(s) `src/engine/` correspondant(s).
> Conventions d'abréviation : voir [`sources.md`](../sources.md).
>
> ⚠️ **Brouillon agent-généré** — fidélité contrôlée par une passe de vérification adversariale (voir
> § *Bilan de fidélité* en bas). Les entrées marquées y restent à corriger.
> ⚠️ Les champs **Implémente** sont GÉNÉRÉS (`npm run raw:implemente` — source éditoriale : `src/data/raw.manifest.json`) — ne pas les éditer à la main.
>
> **Catalogue de sorts** (sorts mineurs, arcanes, de domaine, du chaos, magie noire) : à transcrire
> séparément depuis `LDB 47 - Listes des sorts.md`, `LDB 48 - Magie des Couleurs.md`,
> `LDB 49 - Sorcellerie.md`, `LDB 50 - Magie noire.md`, `LDB 51 - Magie du Chaos.md`
> et `Source/Warhammer v4 - 1.0 L'ennemi dans l'Ombre/` (sorts de Tzeentch).
> Ce fichier couvre les **règles** et les **tables mécaniques** uniquement.

## Sommaire

- [L'Aethyr et les Vents de Magie](#laethyr-et-les-vents-de-magie)
- [Seconde Vue](#seconde-vue)
- [Types de sorts](#types-de-sorts)
- [Mémoriser des sorts](#mémoriser-des-sorts)
- [Test d'incantation](#test-dincantation)
- [Incantation Critique](#incantation-critique)
- [Maladresse d'incantation → Incantation Imparfaite](#maladresse-dincantation--incantation-imparfaite)
- [Influences Malfaisantes (le « 8 »)](#influences-malfaisantes-le--8-)
- [Tableau des Incantations Imparfaites Mineures (d100 verbatim)](#tableau-des-incantations-imparfaites-mineures-d100-verbatim)
- [Tableau des Incantations Imparfaites Majeures (d100 verbatim)](#tableau-des-incantations-imparfaites-majeures-d100-verbatim)
- [Focalisation (Test étendu)](#focalisation-test-étendu)
- [Focalisation Critique](#focalisation-critique)
- [Maladresse de Focalisation](#maladresse-de-focalisation)
- [Interruptions de Focalisation](#interruptions-de-focalisation)
- [Repousser les Vents (armure et tenue)](#repousser-les-vents-armure-et-tenue)
- [Dissipation / Contre-sort](#dissipation--contre-sort)
- [Dissiper des sorts permanents](#dissiper-des-sorts-permanents)
- [Durée des sorts](#durée-des-sorts)
- [Grimoires (lancer depuis le livre)](#grimoires-lancer-depuis-le-livre)
- [Projectiles Magiques](#projectiles-magiques)
- [Composants / Ingrédients](#composants--ingrédients)
- [Restrictions d'incantation (parole, unicité, ligne de vue)](#restrictions-dincantation-parole-unicité-ligne-de-vue)
- [Sorts de Contact en Combat](#sorts-de-contact-en-combat)
- [Avantages et Magie](#avantages-et-magie)
- [Attributs des domaines de la Magie des Couleurs (LDB 48)](#attributs-des-domaines-de-la-magie-des-couleurs-ldb-48)
- [Zone d'Effet (ZdE)](#zone-deffet-zde)
- [Magie Elfique (Qhaysh)](#magie-elfique-qhaysh)
- [Magie Noire (Dhar)](#magie-noire-dhar)
- [Malepierre](#malepierre)
- [Magie Naturelle](#magie-naturelle)
- [Sorcellerie (domaine hors-Collège)](#sorcellerie-domaine-hors-collège)
- [Bilan de fidélité](#bilan-de-fidélité)

- **La Mer des Griffes (MDG)** <!-- MDG-INTEGRATION -->
- Magie des mers — modificateurs des Vents en mer (Bête/Feu/Cieux/Vie) — `MDG 02 l.178-186`
- Sorts de magie des mers (collège du baron Henryk) — 6 sorts Vie/Cieux — `MDG 02 l.189-262`

- **Les Vents de Magie (VDM)** <!-- VDM-INTEGRATION -->
  - [Seconde vue (révision VDM)](#seconde-vue-révision-vdm) — `VDM 02 l.11`
  - [Mémoriser des sorts (révision VDM)](#mémoriser-des-sorts-révision-vdm) — `VDM 02 l.19`
  - [Grimoires (révision VDM)](#grimoires-révision-vdm) — `VDM 02 l.23-25`
  - [Incantation Critique révisée (Puissance totale)](#incantation-critique-révisée-puissance-totale) — `VDM 02 l.52-56`
  - [Projectiles magiques (révision VDM)](#projectiles-magiques-révision-vdm) — `VDM 02 l.68`
  - [Vortex aléatoires (nouveau — VDM)](#vortex-aléatoires-nouveau--vdm) — `VDM 02 l.70-97`
  - [Sorts de Contact — bâton enchanté (ajout VDM)](#sorts-de-contact--bâton-enchanté-ajout-vdm) — `VDM 02 l.103`
  - [Test de Focalisation révisé (réserve d'énergie)](#test-de-focalisation-révisé-réserve-dénergie) — `VDM 02 l.131-141`
  - [Focalisation Critique révisée (VDM)](#focalisation-critique-révisée-vdm) — `VDM 02 l.145`
  - [Maladresse de Focalisation révisée (VDM)](#maladresse-de-focalisation-révisée-vdm) — `VDM 02 l.149`
  - [Influences malveillantes (révision VDM)](#influences-malveillantes-révision-vdm) — `VDM 02 l.157-159`
  - [Malepierre (révision VDM — consommation)](#malepierre-révision-vdm--consommation) — `VDM 02 l.163-165`
  - [Repousser les Vents (ajouts VDM)](#repousser-les-vents-ajouts-vdm) — `VDM 02 l.169`
  - [Dissipation (ajouts VDM)](#dissipation-ajouts-vdm) — `VDM 02 l.186`
  - [Domaines magiques multiples (nouveau — VDM)](#domaines-magiques-multiples-nouveau--vdm) — `VDM 02 l.190-192`
  - [Surincantation révisée + Tableau de Surincantation (VDM)](#surincantation-révisée--tableau-de-surincantation-vdm) — `VDM 02 l.194-215`
  - [Tableau des Incantations Imparfaites Mineures — révision VDM (d100 verbatim)](#tableau-des-incantations-imparfaites-mineures--révision-vdm-d100-verbatim) — `VDM 02 l.220-240`
  - [Tableau des Incantations Imparfaites Majeures — révision VDM (d100 verbatim)](#tableau-des-incantations-imparfaites-majeures--révision-vdm-d100-verbatim) — `VDM 02 l.243-263`
  - [Nouveaux Sorts d'Arcane (VDM)](#nouveaux-sorts-darcane-vdm) — `VDM 02 l.266-359`
  - [La Magie Rituelle (nouveau — VDM)](#la-magie-rituelle-nouveau--vdm) — `VDM 02 l.361-393`
  - [Rituels — liste (VDM)](#rituels--liste-vdm) — `VDM 02 l.396-764`
  - [Créer un Fabriqué — profil & Traits de Fabriqué (VDM)](#créer-un-fabriqué--profil--traits-de-fabriqué-vdm) — `VDM 02 l.444-493`
  - [Élémentaires mineurs (VDM)](#élémentaires-mineurs-vdm) — `VDM 02 l.446-460`
  - [Créer un familier — Traits de familier (VDM)](#créer-un-familier--traits-de-familier-vdm) — `VDM 02 l.495-533`
  - [Nouvelles Activités magiques (VDM)](#nouvelles-activités-magiques-vdm) — `VDM 02 l.767-800`
  - [Saturation environnementale (niveaux d'intensité)](#saturation-environnementale-niveaux-dintensité) — `VDM 14 l.13-34`
  - [Corruption environnementale](#corruption-environnementale) — `VDM 14 l.37-75`
  - [Tempêtes de Magie](#tempêtes-de-magie) — `VDM 14 l.86-115`
  - [Lignes de force et pierres gardiennes](#lignes-de-force-et-pierres-gardiennes) — `VDM 14 l.118-137`
  - [Propriétés des pierres gardiennes](#propriétés-des-pierres-gardiennes) — `VDM 14 l.146-179`
  - [Cercles d'oghams](#cercles-doghams) — `VDM 14 l.182-187`
  - [Corruption des lignes de force et pierres gardiennes](#corruption-des-lignes-de-force-et-pierres-gardiennes) — `VDM 14 l.215-231`
  - [Nexus de puissance et jonctions telluriques](#nexus-de-puissance-et-jonctions-telluriques) — `VDM 14 l.233-249`
  - [Appuis arcaniques](#appuis-arcaniques) — `VDM 14 l.252-272`
  - [Grand Vortex](#grand-vortex) — `VDM 14 l.206-212`
  - [Corruption des Nexus et Appuis arcaniques (Morrslieb)](#corruption-des-nexus-et-appuis-arcaniques-morrslieb) — `VDM 14 l.274-279`
  - [Résumé des phénomènes arcaniques (table verbatim)](#résumé-des-phénomènes-arcaniques-table-verbatim) — `VDM 14 l.282-305`

---

## L'Aethyr et les Vents de Magie

**Sources RAW :** `LDB 44 l.3-39`

L'Aethyr est une dimension infinie, lieu de reproduction des démons et des esprits, existant au-delà du monde physique. Une grande déchirure vers l'Aethyr existe dans le Nord de l'Empire ; la magie en suinte à l'état brut. Ces énergies tournoyantes — les **Vents de Magie** — soufflent à travers le monde.

Les Collèges de Magie (comme les elfes) enseignent que la magie se divise en **huit Vents distincts**, chacun identifié par une couleur. Chaque Collège humain se spécialise dans un unique Vent ; les humains ne doivent utiliser qu'un seul Vent (décret des elfes : utiliser plusieurs Vents est trop dangereux pour l'esprit humain, trop facilement corruptible).

- Les **elfes** perçoivent les Vents naturellement (Seconde vue) et peuvent étudier la Haute Magie (*Qhaysh*).
- Les **nains** méprisent la magie et y sont partiellement insensibles ; aucun sorcier nain n'est connu.
- Les **halflings** n'en ont cure sauf pour les spectacles.

**Voir aussi :** [Magie Elfique](#magie-elfique-qhaysh), [Magie Noire](#magie-noire-dhar), [Sorcellerie](#sorcellerie-domaine-hors-collège)

---

## Seconde Vue

**Sources RAW :** `LDB 46 l.7-10`

Le Talent **Seconde vue** (LDB 10) permet de percevoir les Vents de Magie et leur influence sur le monde. Elle affecte tous les sens (manifestation dépend de l'expérience du lanceur). Avec la Seconde vue, on peut utiliser les compétences **Intuition**, **Perception** et **Pistage** avec les sens aethyriques. La Seconde vue ne se désactive pas : le MJ peut demander des Tests spontanés pour percevoir des détails magiques.

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 46` (l.7-10) → `miscast-mineure`, `mineure-signe-de-sorciere`, `mineure-lait-caille`, `mineure-mildiou`, `hasArcaneTalent` ⚠sans-appelant, `mineure-cerumen`, `mineure-lueur-occulte`, `mineure-murmures-mortels`, `mineure-rupture`, `mineure-secousse-spirituelle`, +36 — `src/data/miscast.json`, `src/data/schemas/defs-scenes/effets.ts`, `src/engine/domainAttributes.ts`, `src/state/combatEffects.ts`, `src/state/partyFlow.ts`
- dette : #463

---

## Types de sorts

**Sources RAW :** `LDB 46 l.13-15`

Quatre types de sorts :
- **Sorts Mineurs** : tours utilisant des quantités négligeables de Magie.
- **Sorts d'Arcane** : sorts génériques accessibles à tout étudiant de n'importe quel Domaine de Magie ou de Magie du Chaos.
- **Sorts de Domaine** : nécessitent le Talent `Magie des Arcanes (X)` correspondant.
- **Sorts du Chaos** : pratiqués par ceux qui ont vendu leur âme au Chaos.

**Voir aussi :** [Magie Noire](#magie-noire-dhar), [Magie du Chaos — LDB 51](#magie-elfique-qhaysh)

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 46` (l.13-15) → `miscast-mineure`, `mineure-signe-de-sorciere`, `mineure-lait-caille`, `mineure-mildiou`, `hasArcaneTalent` ⚠sans-appelant, `mineure-cerumen`, `mineure-lueur-occulte`, `mineure-murmures-mortels`, `mineure-rupture`, `mineure-secousse-spirituelle`, +44 — `src/data/miscast.json`, `src/data/schemas/defs-scenes/effets.ts`, `src/engine/domainAttributes.ts`, `src/engine/magic.ts`, `src/state/combatEffects.ts`, `src/state/combatSlice.ts`, +2 fichiers

---

## Mémoriser des sorts

**Sources RAW :** `LDB 46 l.17-21`

Transcrire un sort dans un grimoire ne suffit pas à l'apprendre. Pour **mémoriser** un sort (pouvoir le lancer sans grimoire), il faut dépenser le montant de PX indiqué dans le Talent de lanceur de sorts. Un sort mémorisé est connu de façon permanente, sauf circonstances particulières.

> **Verbatim** (l.47-48) : « Une fois qu'un Sort a été mémorisé, un lanceur de Sorts le connaît de façon permanente, sauf circonstances particulières. »

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 46` (l.17-21) → `miscast-mineure`, `mineure-signe-de-sorciere`, `mineure-lait-caille`, `mineure-mildiou`, `hasArcaneTalent` ⚠sans-appelant, `mineure-cerumen`, `mineure-lueur-occulte`, `mineure-murmures-mortels`, `mineure-rupture`, `mineure-secousse-spirituelle`, +56 — `src/data/miscast.json`, `src/data/schemas/defs-scenes/effets.ts`, `src/engine/domainAttributes.ts`, `src/engine/magic.ts`, `src/state/combatEffects.ts`, `src/state/combatFlow.ts`, +5 fichiers

---

## Test d'incantation

**Sources RAW :** `LDB 46 l.23-25`

Pour lancer un sort : effectuer un **Test de Langue (Magick)** (compétence avancée, Caractéristique = Intelligence).

- **Succès ET DR ≥ NI du sort** → sort lancé.
- **Succès mais DR < NI** → tentative échoue (sort pas assez puissant), rien ne se produit.
- **Échec** → tentative échoue, rien ne se produit.

La compétence **Prière**, **Langue (Magick)** et **Focalisation** sont des **compétences avancées** : sans au moins 1 Augmentation, le Test est impossible (pas de repli sur la Caractéristique seule). Exception : le Trait de créature **Lanceur de Sorts** (LDB 85 l.206-207) autorise l'incantation sans la compétence — Test sur la Caractéristique seule.

> **Verbatim NI** (l.50) : « Si votre DR est égal ou supérieur au Niveau d'Incantation (NI) du Sort (indiqué dans sa description), il est lancé comme dans la description du Sort. »

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 46` (l.23-25) → `miscast-mineure`, `mineure-signe-de-sorciere`, `mineure-lait-caille`, `mineure-mildiou`, `hasArcaneTalent` ⚠sans-appelant, `mineure-cerumen`, `mineure-lueur-occulte`, `mineure-murmures-mortels`, `mineure-rupture`, `mineure-secousse-spirituelle`, +57 — `src/data/miscast.json`, `src/data/schemas/defs-scenes/effets.ts`, `src/engine/domainAttributes.ts`, `src/engine/magic.ts`, `src/state/combatEffects.ts`, `src/state/combatFlow.ts`, +5 fichiers
- `LDB 85` (l.206-207) → `TraitDef`, `morsure`, `ManeuverPostHitHook`, `spawnMutations`, `Condition`, `langue-prehensile`, `TriggerCtx`, `isUnstable` ⚠sans-appelant, `pullToward`, `startleCauseSchema`, +24 — `src/data/maneuvers.json`, `src/data/schemas/grammaire/mecanique.ts`, `src/data/traits.json`, `src/engine/flowCore.ts`, `src/engine/ops.ts`, `src/engine/traits/dispatch.ts`, +8 fichiers

---

## Incantation Critique

**Sources RAW :** `LDB 46 l.27-32`

Un **Critique** au Test d'incantation (double réussi) signifie que les Vents ont développé une force dangereuse. À moins de posséder le Talent **Diction instinctive**, effectuer un jet sur le Tableau des Incantations Imparfaites Mineures. On peut choisir l'un des effets suivants à la place :

- **Incantation Critique** : si le sort inflige des Dégâts, il inflige également une Blessure Critique (voir traumatisme).
- **Puissance totale** : le sort est lancé quel que soient son NI et le DR obtenu — mais il peut être Dissipé.
- **Force inéluctable** : si le DR est suffisant pour lancer le sort, il ne peut pas être Dissipé.

> **Verbatim** (l.28) : « À moins que vous n'ayez le Talent Diction instinctive, effectuez un lancer sur le Tableau des Incantations Imparfaites Mineures lorsque la puissance dépasse votre contrôle. Mais vous pouvez aussi choisir l'un des effets suivants : »
> **Verbatim** (l.31-32) : « **Puissance totale :** le Sort est lancé, quels que soient son NI et votre DR obtenu, mais il peut être Dissipé. » / « **Force inéluctable :** si vous obtenez suffisamment de DR pour lancer votre Sort, il ne peut être Dissipé. »

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 46` (l.27-32) → `miscast-mineure`, `mineure-signe-de-sorciere`, `mineure-lait-caille`, `mineure-mildiou`, `mineure-cerumen`, `mineure-lueur-occulte`, `mineure-murmures-mortels`, `mineure-rupture`, `mineure-secousse-spirituelle`, `mineure-delie`, +55 — `src/data/miscast.json`, `src/engine/magic.ts`, `src/state/combatEffects.ts`, `src/state/combatFlow.ts`, `src/state/combatSlice.ts`, `src/state/partyFlow.ts`, +3 fichiers

---

## Maladresse d'incantation → Incantation Imparfaite

**Sources RAW :** `LDB 46 l.84-86`

Un **double raté** au Test d'incantation entraîne une **Incantation Imparfaite**. Lancer 1d100 et consulter le Tableau des Incantations Imparfaites Mineures.

> **Verbatim** (l.143-145) : « Si vous perdez le contrôle de l'énergie magique que vous focalisez, les choses se passent toujours mal. Si vous obtenez une Maladresse à votre Test d'Incantation, vous subissez une Incantation Imparfaite. Lancez 1d100 et consultez le Tableau des Incantations Imparfaites Mineures. »

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 46` (l.84-86) → `combat-spell-plus`, `lecture-au-grimoire`, `canCastFromGrimoire`, `miscast-table`, `miscast-row-test`, `malevolentInfluenceSeverity`, `ALL_MAGIC`, `magic-composant`, `incantation-imparfaite`, `useSpellComponent`, +3 — `src/data/combat-stakes.json`, `src/data/regles.json`, `src/data/reglesOptionnelles.json`, `src/engine/grimoire.ts`, `src/engine/magic.ts`, `src/engine/miscast.ts`, +2 fichiers

---

## Surincantation

**Sources RAW :** `LDB 47 l.13-17` (Sorts) · `LDB 41 l.21-27` (Bénédictions) · `LDB 42 l.7-13` (Miracles)

Dépenser le surplus de Degrés de Réussite pour amplifier un sort réussi. Budget = **un pas par +2 DR de
surplus** — surplus = `DR − NI` pour un Sort (DR entier si Focalisé, NI déjà payé) ; **DR entier** pour une
Prière (Bénédiction/Miracle : pas de NI). Le surplus se répartit librement entre les axes (même axe
répétable). L'EFFET d'un pas **dépend de la source** :

| Source (`spell.family`) | Axes | Effet d'UN pas |
| --- | --- | --- |
| **Sort** (`arcane`/`mineure`/`chaos`/domaines) | Portée · **ZdE** · Durée · Cible | **+valeur initiale** (×initial) |
| **Miracle** (`invocation`) | Portée · Durée · Cible (**pas de ZdE**) | **+valeur initiale** (×initial) |
| **Bénédiction** (`beni`) | Portée · Durée · Cible (**pas de ZdE**) | **+6 m** Portée / **+1** Cible / **+6 Rounds** Durée (FIXE) |

Restrictions (RAW) : Portée/Cible « **Vous** » → seul le lanceur, non augmentables ; Portée « **Contact** »
non extensible **pour un Sort/Miracle** (une **Bénédiction** étend même le Contact : `LDB 41 l.27`, Guérison
touchée → 6 m / 12 m) ; sans Durée (Instantané) → pas de prolongation ; Cible « **Spécial** » → pas de
cibles supplémentaires (`LDB 47 l.28`).

> **Verbatim Sort** (`LDB 47 l.15`) : « Pour chaque +2 DR que vous obtenez à un Test d'Incantation, vous
> pouvez ajouter une valeur de Portée, de Zone d'Effet, de Durée ou de Cible égale à la valeur initiale
> indiquée dans la description du Sort. »
> **Verbatim Bénédiction** (`LDB 41 l.23-25`) : « • Portée : +6 mètres • Cibles : +1 • Durée : +6 Rounds »

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 41` (l.21-27) → `BLESSING_STEP`, `effectiveRangeMetres`, `effectiveSpellRangeTiles` — `src/engine/magic.ts`, `src/engine/overcast.ts`
- `LDB 42` (l.7-13) → `src/engine/overcast.ts`
- `LDB 47` (l.13-17, l.28) → `CastingNumberRounding`, `SpellTarget`, `overcastBudget`, `CastModal`, `zoneDiameterMultiplier`, `DECLARATIONS_D_OPS`, `carriedGrimoire`, `SpellbookSection`, `zdeDiameterMeters`, `bestAreaCenter`, +22 — `src/data/index.ts`, `src/data/schemas/grammaire/mecanique.ts`, `src/engine/castingNumber.ts`, `src/engine/grimoire.ts`, `src/engine/magic.ts`, `src/engine/ops.ts`, +12 fichiers

---

## Influences Malfaisantes (le « 8 »)

**Sources RAW :** `LDB 46 l.88-90`

Incanter à proximité d'une **source de Corruption** (voir LDB 19) rend le contrôle des Vents plus difficile. Lors d'un Test de Langue (Magick) ou de Focalisation à proximité d'une Influence corruptrice :

- tout lancer dont le **dé des unités est 8** (symbole à huit pointes du Chaos) → **Incantation Imparfaite Mineure**.
- Si une Incantation Imparfaite Mineure avait déjà été obtenue pour une autre raison lors de ce Test → elle devient **Majeure**.

> **Verbatim** (l.147-148) : « tout lancer obtenant un 8 (représentant le symbole du Chaos à huit pointes) sur le dé des unités entraîne une Incantation Imparfaite Mineure, car la Magie s'emballe. »

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 46` (l.88-90) → `combat-spell-plus`, `lecture-au-grimoire`, `canCastFromGrimoire`, `miscast-table`, `miscast-row-test`, `malevolentInfluenceSeverity`, `ALL_MAGIC`, `magic-composant`, `incantation-imparfaite`, `useSpellComponent`, +2 — `src/data/combat-stakes.json`, `src/data/regles.json`, `src/data/reglesOptionnelles.json`, `src/engine/grimoire.ts`, `src/engine/magic.ts`, `src/engine/miscast.ts`, +2 fichiers

---

## Tableau des Incantations Imparfaites Mineures (d100 verbatim)

**Sources RAW :** `LDB 46 l.33-53`

| d100 | Nom | Effet |
|------|-----|-------|
| 01–05 | Signe de Sorcière | La prochaine créature vivante à naître dans un rayon de 1 km mute. |
| 06–10 | Lait caillé | Tout le lait dans un rayon de 1d100 mètres tourne instantanément. |
| 11–15 | Mildiou | Un nombre de champs égal au Bonus de Force Mentale dans un rayon de (BFM) km subissent une calamité ; toutes les cultures pourrissent pendant la nuit. |
| 16–20 | Cérumen | Les oreilles se bouchent instantanément de cire épaisse. Gagnez 1 État **Assourdi**, qui ne peut être retiré que par un Test réussi de Guérison. |
| 21–25 | Lueur occulte | Lueur sinistre liée au Domaine, émettant autant de lumière qu'un grand bûcher, durée au moins 1d10 Rounds. |
| 26–30 | Murmures mortels | Réussir un Test de **Force Mentale Accessible (+20)** ou gagner 1 Point de Corruption. |
| 31–35 | Rupture | Le nez, les yeux et les oreilles saignent. Gagnez 1d10 États **Hémorragique**. |
| 36–40 | Secousse spirituelle | Gagnez l'État **À Terre**. |
| 41–45 | Délié | Sur la personne, toutes les boucles se détachent et tous les lacets se délacent (chute de ceintures, sacs, ouverture de poches, glissement d'armure). |
| 46–50 | Tenue indisciplinée | Les vêtements semblent se tordre par leur propre volonté. Recevez 1 État **Enchevêtré** avec une Force de 1d10 × 5 pour résister. |
| 51–55 | Malédiction de la sobriété | Tout l'alcool dans un rayon de 1d100 mètres s'évente, goût infect et amer. |
| 56–60 | Drain de l'âme | Gagnez 1 État **Exténué**, qui dure 1d10 heures. |
| 61–65 | Distraction | Si Engagé en combat : gagnez l'État **Surpris**. Sinon : complètement décontenancé, incapable de se concentrer quelques instants. |
| 66–70 | Visions impies | Des visions éphémères d'actes profanes vous harcèlent. Recevez l'État **Aveuglé** ; réussir un Test de **Calme Intermédiaire (+0)** ou en gagner un autre. |
| 71–75 | Langue maladroite | Tous les Tests de Langue (y compris d'Incantation) subissent −10 pendant 1d10 Rounds. |
| 76–80 | L'horreur ! | Réussir un Test de **Calme Difficile (−20)** ou gagner 1 État **Brisé**. |
| 81–85 | Malédiction de corruption | Gagnez 1 Point de Corruption. |
| 86–90 | Double problème | L'effet du sort se produit ailleurs dans un rayon de 1d10 km. À la discrétion du MJ, cela devrait avoir des conséquences. |
| 91–95 | Multiplication d'infortune | Effectuer deux lancers sur cette table, en relançant tout résultat entre 91–00. |
| 96–00 | Chaos en cascade | Effectuer un nouveau lancer sur le Tableau des Incantations Imparfaites **Majeures**. |

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 46` (l.33-53) → `miscast-mineure`, `mineure-signe-de-sorciere`, `mineure-lait-caille`, `mineure-mildiou`, `MiscastResult`, `mineure-cerumen`, `mineure-lueur-occulte`, `mineure-murmures-mortels`, `mineure-rupture`, `mineure-secousse-spirituelle`, +61 — `src/data/miscast.json`, `src/data/schemas/defs-scenes/effets.ts`, `src/engine/magic.ts`, `src/engine/miscast.ts`, `src/engine/types.ts`, `src/state/combatFlow.ts`, +4 fichiers

---

## Tableau des Incantations Imparfaites Majeures (d100 verbatim)

**Sources RAW :** `LDB 46 l.55-80`

| d100 | Nom | Effet |
|------|-----|-------|
| 01–05 | Voix fantomatiques | Toutes les personnes dans un rayon de (Force Mentale) mètres entendent de sombres murmures du Chaos. Toutes les créatures douées de conscience : Test de **Calme Accessible (+20)** ou gagner 1 Point de Corruption. |
| 06–10 | Regard maudit | Les yeux prennent une couleur anormale liée au Domaine pendant 1d10 heures. Tant que les yeux ont cette couleur : 1 État **Aveuglé** qui ne peut être retiré d'aucune façon. |
| 11–15 | Choc aethyrique | Subir 1d10 Blessures ignorant le Bonus d'Endurance et les PA. Test de **Résistance Accessible (+20)** ou gagner également 1 État **Sonné**. |
| 16–20 | Marche de la mort | Pendant 1d10 heures, toutes les plantes vivantes proches fanent et meurent. |
| 21–25 | Rébellion intestinale | Les intestins deviennent incontrôlables. Gagnez 1 État **Exténué** qui ne peut être retiré tant qu'on ne peut pas changer de vêtement et se nettoyer. |
| 26–30 | Feu de l'âme | Gagnez 1 État **Enflammé** : enveloppé de flammes impies de la couleur du Domaine. |
| 31–35 | Propos ésotériques | Jacassements inintelligibles pendant 1d10 Rounds. Impossible de communiquer verbalement ni d'effectuer de Test d'Incantation ; actions normales sinon. |
| 36–40 | Essaim | Engagé par une nuée de rats, araignées géantes, serpents aethyriques (au choix du MJ) avec le Trait Nuée. Après 1d10 Rounds (si non détruite), la nuée bat en retraite. |
| 41–45 | Poupée de chiffon | Projeté à 1d10 mètres dans les airs dans une direction aléatoire. 1d10 Points de Blessure à l'atterrissage ignorant les PA + État **À Terre**. |
| 46–50 | Membre gelé | Un membre (déterminé au hasard) gèle sur place pendant 1d10 heures, inutile comme s'il avait été **Amputé**. |
| 51–55 | Vue assombrie | Perte du bénéfice du Talent Seconde vue pendant 1d10 heures. Les Tests de Focalisation subissent également −20 pour la durée. |
| 56–60 | Clairvoyance chaotique | Gagner une réserve bonus de 1d10 Points de Chance (peut dépasser la limite naturelle). Chaque dépense = +1 Point de Corruption. Points restants perdus en fin de session. |
| 61–65 | Lévitation | Soulevé par les Vents, flottant 1d10 mètres au-dessus du sol pendant 1d10 minutes. Retour continuel à la position de lévitation quand laissé tranquille. Voir règles de Chute à la fin. |
| 66–70 | Régurgitation | Vomissements incontrôlables. Gagnez l'État **Sonné**, qui dure 1d10 Rounds. |
| 71–75 | Secousse du Chaos | Toutes les créatures dans un rayon de 1d100 mètres : Test d'**Athlétisme Accessible (+20)** ou gagner l'État **À Terre**. |
| 76–80 | Cœur de traître | Les Dieux Sombres incitent à commettre une horrible perfidie. Attaquer ou trahir un allié dans toute la mesure de ses capacités → regagner tous les Points de Chance. Faire perdre un Point de Destin à un autre Personnage → gagner +1 Point de Destin. |
| 81–85 | Terrible affaiblissement | Gagner 1 Point de Corruption + 1 État **À Terre** + 1 État **Exténué**. |
| 86–90 | Puanteur infernale | Gagner le Trait de Créature Perturbant (voir LDB 85) ; inimitié de quiconque a de l'odorat. Dure 1d10 heures. |
| 91–95 | Drain de puissance | Incapable d'utiliser le Talent permettant de lancer des Sorts (Magie des Arcanes / Magie du Chaos ou similaire) pendant 1d10 minutes. |
| 96–00 | Contre-réaction aethyrique | Quiconque dans un rayon en mètres = BFM (allié ou ennemi) subit 1d10 Blessures ignorant BE et PA + État **À Terre**. Si aucune cible à portée : la tête du lanceur **explose**, mort instantanée. |

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 46` (l.55-80) → `miscast-mineure`, `mineure-signe-de-sorciere`, `mineure-lait-caille`, `mineure-mildiou`, `MiscastResult`, `mineure-cerumen`, `combat-spell-plus`, `mineure-lueur-occulte`, `mineure-murmures-mortels`, `mineure-rupture`, +50 — `src/data/combat-stakes.json`, `src/data/miscast.json`, `src/data/regles.json`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs-scenes/effets.ts`, `src/engine/magic.ts`, +4 fichiers

> **Note :** La table de la **Colère des dieux** (prières, LDB 40 l.52-101) est implémentée dans `WRATH` (`src/engine/miscast.ts` l.164-206) mais appartient au domaine **Religion** → voir `religion.md` (à construire).

---

## Focalisation (Test étendu)

**Sources RAW :** `LDB 46 l.129-151`

Certains sorts nécessitent plus de magie que disponible normalement. La **Focalisation** permet d'attirer les Vents et de les concentrer via la Compétence **Focalisation** (avancée, Caractéristique = Force Mentale, spécialisée par Domaine/Vent).

**Procédure :**
1. Effectuer un **Test étendu de Focalisation** (chaque Round = 1 jet).
2. Quand le **DR cumulé atteint le NI du sort** choisi : la Focalisation est réussie.
3. Au **Round suivant**, lancer le sort avec les règles d'incantation normales, mais en considérant le NI du sort comme **0**.
4. Si le Test d'incantation échoue après une Focalisation réussie : l'énergie focalisée est perdue + Incantation Imparfaite Mineure (l'énergie se libère de l'emprise aethyrique).

> **Verbatim** (l.181-184) : « Quand votre DR atteint le NI du Sort choisi, vous avez réussi à focaliser suffisamment de magie pour le lancer. Pendant le prochain Round, vous pouvez lancer votre Sort en utilisant les règles d'Incantation normales, mais considérez le Niveau d'Incantation du Sort choisi comme étant de 0. »

Les Avantages **ne s'appliquent pas** aux Tests de Focalisation (contrairement aux Tests d'Incantation).

> **Verbatim** (l.176) : « Les Avantages en combat s'appliquent aux Tests d'Incantation, pas aux Tests de Focalisation. »

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 46` (l.129-151) → `DispelModal`, `STEP_WINDOW_AUTO`, `combat-spell-plus`, `HoverTargeting`, `useHoverTargeting`, `CastableSpell`, `FocusInterruptHook`, `focalisation-etendue`, `lecture-au-grimoire`, `jetSurfaced`, +73 — `src/data/actions.json`, `src/data/combat-stakes.json`, `src/data/flow-stakes.json`, `src/data/index.ts`, `src/data/regles.json`, `src/data/reglesOptionnelles.json`, +23 fichiers

---

## Focalisation Critique

**Sources RAW :** `LDB 46 l.135-137`

Un **Critique** (double réussi) lors de la Focalisation signifie qu'un flux puissant a été concentré : le sort peut être lancé au Round suivant **quel que soit le DR cumulé atteint jusqu'alors**. Cependant, tant de magie concentrée si rapidement entraîne un contrecoup : lancer 1d100 sur le Tableau des Incantations Imparfaites Mineures, **sauf** si le Talent **Harmonisation aethyrique** est possédé.

> **Verbatim** (l.186-187) : « tant de magie concentrée si rapidement en un endroit entraîne un contrecoup magique : lancez 1d100 et consultez le Tableau des Incantations Imparfaites Mineures (voir p.234), sauf si vous possédez le Talent Harmonisation aethyrique (voir p.138). »

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 46` (l.135-137) → `combat-spell-plus`, `FocusInterruptHook`, `focalisation-etendue`, `lecture-au-grimoire`, `dispel-roll`, `castingBaseValue`, `castingValue`, `miscast-table`, `miscast-row-test`, `BattleState`, +22 — `src/data/actions.json`, `src/data/combat-stakes.json`, `src/data/flow-stakes.json`, `src/data/regles.json`, `src/data/reglesOptionnelles.json`, `src/engine/magic.ts`, +7 fichiers

---

## Maladresse de Focalisation

**Sources RAW :** `LDB 46 l.139-141`

La définition de **Maladresse est élargie** lors d'un Test de Focalisation : considérer comme Maladresse tout double **ou** tout résultat se terminant par un 0 au-delà de la Compétence : donc 00, 99, 90, 88, etc. Une Maladresse de Focalisation → Incantation Imparfaite **Majeure** (pas Mineure).

> **Verbatim** (l.190-192) : « Concentrer les Vents de la Magie en un flux important est dangereux. Considérez comme Maladresse tout double ou tout résultat terminant par un 0 au-delà de votre Compétence, donc 00, 99, 90, 88, etc. Si vous obtenez une Maladresse à un Test de Focalisation, vous subissez une Incantation Imparfaite. Lancez 1d100 et consultez le Tableau des Incantations Imparfaites Majeures. »

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 46` (l.139-141) → `FocusInterruptHook`, `focalisation-etendue`, `dispel-roll`, `armourCastDRPenalty`, `dispel`, `dispel-spell`, `focus-interrupt`, `createCombatSlice`, `runCombatFlow`, `CastTestKind`, +13 — `src/data/actions.json`, `src/data/combat-stakes.json`, `src/data/flow-stakes.json`, `src/data/index.ts`, `src/data/regles.json`, `src/data/schemas/defs/weaponGroups.ts`, +7 fichiers

---

## Interruptions de Focalisation

**Sources RAW :** `LDB 46 l.143-145`

La concentration est vitale pour focaliser. Si perturbé par quelque chose (bruits forts, Dégâts subis, lumières aveuglantes ou autres) : réussir un Test de **Calme Difficile (−20)** ou subir une **Incantation Imparfaite Mineure** et perdre **tous les DR accumulés** jusqu'alors au Test étendu de Focalisation.

> **Verbatim** (l.193-195) : « Si vous êtes perturbé par quelque chose – bruits forts, Dégâts subis, lumières aveuglantes ou autres –, vous devrez réussir un Test de Calme Difficile (−20) ou subir une Incantation Imparfaite Mineure et perdre tous les DR accumulés jusque-là au Test étendu de Focalisation. »

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 46` (l.143-145) → `FocusInterruptHook`, `focalisation-etendue`, `dispel-roll`, `armourCastDRPenalty`, `dispel`, `dispel-spell`, `focus-interrupt`, `createCombatSlice`, `runCombatFlow`, `CastTestModsContext`, +13 — `src/data/actions.json`, `src/data/combat-stakes.json`, `src/data/flow-stakes.json`, `src/data/index.ts`, `src/data/regles.json`, `src/data/schemas/defs/weaponGroups.ts`, +7 fichiers

---

## Repousser les Vents (armure et tenue)

**Sources RAW :** `LDB 46 l.150-152` ; troisième exemption (Sorcier du Chaos) `VDM 02 l.169`, gatée par la règle optionnelle `magic-vdm-incantation` (VDM 02 l.5)

Porter les couleurs appropriées au Vent manipulé aide à l'attirer. C'est pourquoi la majorité des Magisters portent la tenue de leur Ordre.

**Pénalités :**
- **Tenue inappropriée** : −1 DR à tous les Tests d'Incantation et de Focalisation.
- **Armure en métal** (chargée de *Chamon*, le vent doré) : −1 DR par PA de la localisation **la mieux protégée** du corps, pour chaque PA d'armure portée.
- **Armure en cuir** (conserve des traces de *Ghur*, l'ambré) : même pénalité.

**Exemptions par Talent :**
- `Magie des Arcanes (Métal)` → peut porter des armures métalliques sans pénalité.
- `Magie des Arcanes (Bêtes)` → peut ignorer les pénalités des armures de cuir.
- `Magie du Chaos` (VDM 02 l.169, règle `magic-vdm-incantation`) → peut ignorer les pénalités des armures du Chaos.

> **Verbatim** (l.150) : « tout Lanceur de Sorts portant une armure subit une pénalité de −1 DR à tous ses Tests d'Incantation et de Focalisation, pour chaque PA sur la Localisation la mieux protégée du corps. »

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 46` (l.150-152) → `DispelModal`, `STEP_WINDOW_AUTO`, `HoverTargeting`, `FocusInterruptHook`, `focalisation-etendue`, `jetSurfaced`, `dispel-roll`, `armourCastDRPenalty`, `RollRowProps`, `dispel`, +54 — `src/data/actions.json`, `src/data/combat-stakes.json`, `src/data/flow-stakes.json`, `src/data/index.ts`, `src/data/regles.json`, `src/data/schemas/defs/weaponGroups.ts`, +20 fichiers
- `VDM 2` (l.5, l.169) → `surincantation`, `doc`, `armourCastDRPenalty`, `armure-du-chaos`, `malevolentInfluenceSeverity`, `magic-vdm-incantation`, `ItemInstance`, `malepierreDR`, `malepierreCharge`, `malepierreReserveOf`, +5 — `src/data/index.ts`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs/trappings.ts`, `src/data/surincantation.json`, `src/data/trappings.json`, `src/data/weaponGroups.json`, +4 fichiers

---

## Dissipation / Contre-sort

**Sources RAW :** `LDB 46 l.154-156` · `LDB 13 l.108-110` — chanter une salve de dissipations est l'une des postures de la règle **OPTION** « Sur la défensive » (titre l.108) : elle range la Dissipation parmi les **Tests de défense**, qui gagnent +20 jusqu'au début du prochain Tour.

Si un sort **vous cible** ou vise un point **visible** à une distance en mètres **égale** à votre Force Mentale, vous pouvez opposer le Test d'Incantation avec Langue (Magick), en chantant un **Contre-sort**. *(Échelle du plateau : 2 m par case — la portée RAW en mètres devient `floor(FM / 2)` cases, `counterspellCandidates`.)*

**Procédure :**
1. Effectuer un **Test opposé de Langue (Magick)**.
2. **Succès** : le sort est **dissipé**.
3. **Échec** : le sort se résout normalement, mais utilise le **DR du Test opposé** (le DR net : DR lanceur − DR contre-lanceur) pour déterminer si l'incantation a réussi.

**Limites :**
- On ne peut tenter de dissiper qu'un **seul sort chaque Round**.
- Les Prières (Bénédictions/Miracles) ne peuvent pas être dissipées — **INFÉRENCE** du mot « Sort » de l.156 (aucun passage n'énonce le cas des Prières, dont la résolution vit sous `LDB 40`), pas un verbatim.
- Le seul verrou RAW est **Force inéluctable** (l.32) : c'est l'un des **trois effets d'Incantation Critique au CHOIX** du lanceur (l.30-32), et il n'immunise qu'« si vous obtenez suffisamment de DR pour lancer votre Sort ». Les deux autres choix n'immunisent pas — « **Puissance totale** » (l.31) est explicitement dissipable. Sans choix, l'Incantation Critique renvoie au **Tableau des Incantations Imparfaites Mineures** (l.28), à moins du Talent Diction instinctive.

> **Verbatim** (l.156) : « Si un Sort vous cible, ou vise un point que vous pouvez voir à une distance en mètres égale à votre Force Mentale, vous pouvez opposer le Test d'Incantation avec Langue (Magick), car vous chantez un Contre-sort. Effectuez un Test opposé de Langue (Magick). Sur un succès, vous dissipez le Sort ; sur un échec, le Sort utilise le DR du Test opposé pour déterminer si l'incantation a réussi normalement. Vous ne pouvez tenter de dissiper qu'un seul Sort chaque Round. »
> **Verbatim** (l.31-32) : « **Puissance totale :** le Sort est lancé, quels que soient son NI et votre DR obtenu, mais il peut être Dissipé. » / « **Force inéluctable :** si vous obtenez suffisamment de DR pour lancer votre Sort, il ne peut être Dissipé. »
> **Verbatim** (`LDB 13 l.110`) : « Qu'en est-il si vous souhaitez vous préparer à éviter ou parer les coups, à tenir une position défensive ou utiliser Langue (Magick) afin de lancer une salve de dissipations ? Pour votre Action, choisissez une Compétence que vous allez utiliser en défense et vous gagnerez un bonus de +20 à tous les Tests de défense que vous effectuerez jusqu'au début du prochain Tour. »

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 13` (l.108-110) → `AuContactModal`, `GrappleModal`, `useHoverTargeting`, `entityBlockedAt`, `useDefenseJetProps`, `useAttackJetProps`, `DisengageModal`, `cleFeuilleRamassee`, `sur-la-defensive`, `ACTION_GATES`, +19 — `src/data/actions.json`, `src/data/regles.json`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs/actions.ts`, `src/engine/combat.ts`, `src/gameIso/stage/useHoverTargeting.ts`, +15 fichiers
- `LDB 46` (l.154-156) → `DispelModal`, `STEP_WINDOW_AUTO`, `HoverTargeting`, `FocusInterruptHook`, `focalisation-etendue`, `jetSurfaced`, `dispel-roll`, `armourCastDRPenalty`, `RollRowProps`, `dispel`, +54 — `src/data/actions.json`, `src/data/combat-stakes.json`, `src/data/flow-stakes.json`, `src/data/index.ts`, `src/data/regles.json`, `src/data/schemas/defs/weaponGroups.ts`, +20 fichiers
- dette : #1033

---

## Dissiper des sorts permanents

**Sources RAW :** `LDB 46 l.159-162`

Pour dissiper un sort à **effet durable** déjà en place :
- Action entière du dissipateur.
- **Test étendu de Langue (Magick)** : quand le DR cumulé atteint le NI du sort, il est dissipé.
- Plusieurs lanceurs sur le même sort : chacun lance séparément. S'ils utilisent le même Domaine, ils peuvent choisir d'effectuer un **Test Soutenu** à la place.

> **Verbatim** (l.160, l.162) : « Il faut pour cela effectuer un Test étendu de Langue (Magick). Quand votre DR atteint la NI du Sort, vous le dissipez avec succès. » / « Plusieurs lanceurs de Sorts tentant de dissiper le même Sort effectuent leur lancer séparément. S'ils incantent en utilisant le même Domaine, ils peuvent décider d'effectuer un Test Soutenu à la place. »

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 46` (l.159-162) → `DispelModal`, `force-des-vents`, `STEP_WINDOW_AUTO`, `HoverTargeting`, `focalisation-etendue`, `jetSurfaced`, `dispel-roll`, `armourCastDRPenalty`, `RollRowProps`, `dispel`, +49 — `src/data/actions.json`, `src/data/combat-stakes.json`, `src/data/flow-stakes.json`, `src/data/index.ts`, `src/data/regles.json`, `src/data/reglesOptionnelles.json`, +21 fichiers

---

## Durée des sorts

**Sources RAW :** `LDB 46 l.92-94`

Un sort lancé avec succès reste actif pour sa **Durée** (indiquée dans la description du sort) à moins d'être dissipé. On **ne peut pas simplement mettre fin à ses sorts** déjà en jeu — il faut Dissiper.

Les durées se lisent :
- **Instantanée** : effet immédiat, pas de persistance.
- **N Rounds** (littéral ou formule `(Bonus de X) Rounds`).
- **N minutes / heures / jours** (horloge de campagne).
- **Jusqu'au lever du soleil** : durée jusqu'à la prochaine aube.

> **Verbatim** (l.149-151) : « Si un Sort est lancé avec succès, il reste actif pour sa Durée à moins d'être dissipé. Vous ne pouvez pas simplement mettre fin à vos Sorts déjà en jeu, mais vous pouvez tenter de les Dissiper. »

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 46` (l.92-94) → `overcastAxes`, `combat-spell-plus`, `missileComponent`, `missileOvercastDamageBonus`, `lecture-au-grimoire`, `canCastFromGrimoire`, `miscast-table`, `miscast-row-test`, `malevolentInfluenceSeverity`, `ALL_MAGIC`, +5 — `src/data/combat-stakes.json`, `src/data/regles.json`, `src/data/reglesOptionnelles.json`, `src/engine/grimoire.ts`, `src/engine/magic.ts`, `src/engine/miscast.ts`, +4 fichiers

---

## Grimoires (lancer depuis le livre)

**Sources RAW :** `LDB 46 l.96-99`

Un lanceur peut activer un sort depuis un **grimoire** si le sort appartient au Domaine qu'il possède, mais cela **double le Niveau d'Incantation** (NI × 2).

> **Verbatim** (l.152-154) : « Un lanceur de Sorts peut en activer un depuis un grimoire si le Sort appartient au Domaine qu'il possède, mais cela double le Niveau d'Incantation. »

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 46` (l.96-99) → `followsCharacterRules`, `overcastAxes`, `combat-spell-plus`, `missileComponent`, `missileOvercastDamageBonus`, `lecture-au-grimoire`, `canCastFromGrimoire`, `miscast-table`, `miscast-row-test`, `SpellbookSection`, +11 — `src/data/combat-stakes.json`, `src/data/regles.json`, `src/data/reglesOptionnelles.json`, `src/engine/grimoire.ts`, `src/engine/magic.ts`, `src/engine/miscast.ts`, +8 fichiers

---

## Projectiles Magiques

**Sources RAW :** `LDB 46 l.101-105`

Les sorts indiqués *Projectile magique* suivent des règles de résolution spécifiques :

1. **Localisation atteinte** : déterminée en **inversant les dés** du Test de Langue (Magick), puis en consultant le Tableau des Localisations (LDB 13 l.133). Il n'y a **pas de « coup ciblé » libre** (RAW).
2. **Dégâts totaux** = Dégâts du sort + DR du Test de Langue (Magick) + Bonus de Force Mentale du lanceur.
3. Ces Dégâts sont **réduits normalement** par le Bonus d'Endurance et les PA de la cible.

> **Verbatim** (l.155-157) : « Quand un Projectile magique est lancé avec succès et qu'il cible un autre Personnage, la Localisation atteinte est déterminée en inversant les dés lancés pour le Test de Langue (Magick). […] Le DR du Test de Langue (Magick) est ajouté aux Dégâts du Sort et à votre Bonus de Force Mentale pour déterminer le total de Dégâts infligés. Ces Dégâts sont réduits normalement par l'Endurance et les PA de la cible. »

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 13` (l.133) → `localisation`, `useDefenseJetProps`, `hitLocation`, `useAttackJetProps`, `toucheSauvee`, `FLOWS`, `previewDefense`, `rangedDefenseModes`, `GameState`, `applyAttackResult`, +3 — `src/data/localisation.json`, `src/data/schemas/defs/localisation.ts`, `src/engine/combat.ts`, `src/state/combat/hitModifiers.ts`, `src/state/combatFlow.ts`, `src/state/combatSlice.ts`, +4 fichiers
- `LDB 46` (l.101-105) → `followsCharacterRules`, `overcastAxes`, `combat-spell-plus`, `missileComponent`, `missileOvercastDamageBonus`, `lecture-au-grimoire`, `canCastFromGrimoire`, `miscast-table`, `miscast-row-test`, `componentDowngrade`, +14 — `src/data/combat-stakes.json`, `src/data/regles.json`, `src/data/reglesOptionnelles.json`, `src/engine/grimoire.ts`, `src/engine/magic.ts`, `src/engine/miscast.ts`, +10 fichiers

---

## Composants / Ingrédients

**Sources RAW :** `LDB 46 l.107-114`

Les lanceurs peuvent focaliser leur magie au moyen d'un **composant approprié** avant le déclenchement, protégeant contre les Incantations Imparfaites.

**Effets :**
- Toute **Incantation Imparfaite Majeure** devient une **Mineure**.
- Aucune **Incantation Imparfaite Mineure** n'a d'effet.
- Le composant est **consumé** (même sans Imparfaite).

**Coût :** pour les Sorts d'Arcane et de Domaine = NI du sort en **pistoles d'argent**. Les composants sont spécifiques à un sort (indiqués dans la liste de sorts du Domaine).

**Exceptions par Domaine :**
- **Magie Naturelle** : composants obligatoires pour tout lancement ; trouvables avec Savoir (Herboristerie) ou achetables 5 sous de cuivre chacun. (DR + 1 composants sur un jet réussi.)
- **Sorcellerie** : coût en **sous de cuivre** (NI du sort en sc, pas en pa) ; trouvables par Survie en extérieur (1 + DR composants). Sans composant = jet obligatoire sur Imparfaites Mineures.

> **Verbatim** (l.160-162) : « Si vous utilisez un composant quand vous incantez, toute Incantation Imparfaite Majeure devient une Incantation Imparfaite Mineure, et aucune Incantation Imparfaite Mineure n'a d'effet. Utilisé ainsi, le composant est consumé ou détruit par le processus, même si aucune Incantation Imparfaite n'a été obtenue. »

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 46` (l.107-114) → `followsCharacterRules`, `overcastAxes`, `combat-spell-plus`, `useHoverTargeting`, `CastableSpell`, `missileComponent`, `missileOvercastDamageBonus`, `lecture-au-grimoire`, `canCastFromGrimoire`, `castingBaseValue`, +31 — `src/data/combat-stakes.json`, `src/data/regles.json`, `src/data/reglesOptionnelles.json`, `src/engine/grimoire.ts`, `src/engine/magic.ts`, `src/engine/miscast.ts`, +12 fichiers

---

## Restrictions d'incantation (parole, unicité, ligne de vue)

**Sources RAW :** `LDB 46 l.116-121`

- **Parole** : il faut être capable de parler (ni bâillonné, ni asphyxié, ni immergé) pour incanter. Voix inhibée → difficulté augmentée par le MJ. La Langue Magick doit être parlée (ou chantée pour le Domaine de la Lumière) clairement et **souvent à voix haute** — la magie est tout sauf subtile. Plus le NI est élevé, plus le sort est chanté fort.
- **Unicité** : chaque sort ne peut être **actif qu'une seule fois** simultanément. Il faut attendre la fin du sort ou sa Dissipation avant de le relancer.
- **Non-cumul des bonus** : les sorts fournissant des bonus ou pénalités **ne se cumulent pas**. Le **meilleur bonus** et la **pire pénalité** sont appliqués.
- **Ligne de vue** : sauf indication contraire, le lanceur doit **voir** sa cible.

> **Verbatim** (l.168) : « les Sorts fournissant des bonus ou des pénalités ne se cumulent pas. Au lieu de cela, le meilleur bonus et la pire pénalité sont appliqués à chaque Sort lancé sur vous. »

---

## Sorts de Contact en Combat

**Sources RAW :** `LDB 46 l.123-124`

Pour les sorts nécessitant de **toucher la cible** en combat (ou si la cible ne veut pas être touchée) :
1. Effectuer le Test d'Incantation.
2. Puis effectuer un **Test opposé de Corps à corps (Bagarre)** (vs Corps à corps ou Esquive de la cible).
3. Si le sort est un *Projectile magique*, le Test de Corps à corps (Bagarre) est utilisé pour déterminer la **Localisation** (à la place du Test de Langue Magick inversé).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 46` (l.123-124) → `combat-spell-plus`, `useHoverTargeting`, `CastableSpell`, `focalisation-etendue`, `lecture-au-grimoire`, `dispel-roll`, `castingBaseValue`, `castingValue`, `miscast-table`, `miscast-row-test`, +32 — `src/data/actions.json`, `src/data/combat-stakes.json`, `src/data/flow-stakes.json`, `src/data/regles.json`, `src/data/reglesOptionnelles.json`, `src/engine/magic.ts`, +11 fichiers

---

## Avantages et Magie

**Sources RAW :** `LDB 46 l.122-126`

- Les Avantages en combat s'appliquent aux Tests d'**Incantation** (pas de Focalisation).
- Gain d'Avantage spécifique pendant l'incantation : si la cible a déjà été visée par un sort **du même Domaine** durant ce Round → +1 Avantage (le renforcement du Vent aide à focaliser la magie).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 46` (l.122-126) → `combat-spell-plus`, `useHoverTargeting`, `CastableSpell`, `focalisation-etendue`, `lecture-au-grimoire`, `dispel-roll`, `castingBaseValue`, `castingValue`, `miscast-table`, `miscast-row-test`, +33 — `src/data/actions.json`, `src/data/combat-stakes.json`, `src/data/flow-stakes.json`, `src/data/regles.json`, `src/data/reglesOptionnelles.json`, `src/engine/magic.ts`, +11 fichiers

---

## Attributs des domaines de la Magie des Couleurs (LDB 48)

> Ces Attributs s'appliquent **automatiquement** (ou de façon optionnelle selon le libellé « vous pouvez ») chaque fois qu'un sort **du Domaine concerné** est lancé avec succès. Ils complètent les règles d'incantation générales décrites ci-dessus (Test d'incantation, Focalisation, etc.). Les sorts d'Arcane communs (LDB 47) ou les Prières n'ont **pas** de Domaine assigné et ne bénéficient donc d'aucun Attribut.

**Sources RAW :** `LDB 48 l.11 / l.106 / l.203 / l.302 / l.399 / l.501 / l.588 / l.690` (Bête/Cieux/Feu/Lumière/Métal/Mort/Ombres/Vie)

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 48` (l.11) → `forme-bestiale`, `incarnation-de-wyssan`, `la-lance-d-ambre`, `langue-bestiale`, `maitre-de-la-bete` — `src/data/spells.json`, `src/engine/domainAttributes.ts`

---

### Domaine de la Bête (Ghur — Vent Ambre)

**Sources RAW :** `LDB 48 l.7`

> « Chaque fois que vous lancez avec succès un Sort du Domaine de la Bête, vous pouvez aussi gagner le Trait de créature Peur 1 (voir page 341) pour les 1d10 prochains Rounds. »

Effet post-incantation appliqué **au lanceur** : acquisition optionnelle de `Peur 1` pour `1d10` Rounds.

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 48` (l.7) → `forme-bestiale`, `incarnation-de-wyssan`, `la-lance-d-ambre`, `langue-bestiale`, `maitre-de-la-bete` — `src/data/spells.json`, `src/engine/domainAttributes.ts`

---

### Domaine des Cieux (Azyr — Vent Céruléen)

**Sources RAW :** `LDB 48 l.105`

> « Les Sorts infligeant des Dégâts ignorent les PA des armures en métal, et se dirigent vers toutes les autres cibles dans les 2 mètres, à l'exception de ceux possédant le Talent Magie des Arcanes (Cieux), infligeant un nombre de Dégâts égal à votre Bonus de Force Mentale, traités comme un Projectile magique. »

Double effet : (1) bypass PA métal sur la cible principale ; (2) propagation électrique dans 2 m aux autres cibles (BFM dégâts, Projectile magique), sauf porteurs du Talent `Magie des Arcanes (Cieux)`.

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 48` (l.105) → `maitre-de-la-bete`, `peau-de-chasseur`, `serres-d-ambre`, `vol-du-destin`, `arc-de-t-essla`, `bouclier-ceruleen` — `src/data/spells.json`, `src/engine/domainAttributes.ts`

---

### Domaine du Feu (Aqshy — Vent Rouge)

**Sources RAW :** `LDB 48 l.201`

> « Vous pouvez infliger +1 État Enflammé à quiconque ciblé par des Sorts du Domaine du Feu, à moins qu'il ne possède également le Talent Magie des Arcanes (Feu). Chaque État Enflammé situé à une distance en mètres égale à votre Bonus de Force Mentale ajoute +10 aux tentatives de Focalisation ou d'Incantation avec Aqshy. »

Double effet : (1) rider optionnel `+1 État Enflammé` sur chaque cible (sauf porteurs du Talent) ; (2) chaque état `Enflammé` actif à portée (≤ BFM mètres) octroie `+10` aux Tests de Focalisation/Incantation du lanceur.

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 48` (l.201) → `comete-de-cassandora`, `ironie-du-destin`, `le-premier-signe-d-amul`, `le-second-signe-d-amul`, `le-troisieme-signe-d-amul`, `maudit`, `cauteriser`, `coeurs-ardents`, `couronne-de-flammes`, `castContextMods` — `src/data/spells.json`, `src/engine/domainAttributes.ts`, `src/state/combatFlow.ts`

---

### Domaine de la Lumière (Hysh — Vent Blanc)

**Sources RAW :** `LDB 48 l.302-304`

> « Vous pouvez infliger un État Aveuglé aux cibles des Sorts du Domaine de la Lumière, à moins qu'ils ne possèdent le Talent Magie des Arcanes (Lumière).
> Si une cible possède les Traits de créature Démoniaque ou Mort-vivant, les Sorts infligent une frappe supplémentaire avec un nombre de Dégâts égal à votre Bonus d'Intelligence qui ignore le Bonus d'Endurance et les PA. »

Double effet : (1) rider optionnel `+1 État Aveuglé` sur chaque cible (sauf porteurs du Talent) ; (2) frappe supplémentaire `BInt` dégâts ignorant BE+PA contre les cibles `Démoniaque` ou `Mort-vivant`.

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 48` (l.302-304) → `grands-feux-d-u-zhul`, `l-egide-d-aqshy`, `l-epee-ardente-de-rhuin`, `mur-de-feu`, `purification`, `bannissement`, `castContextMods` — `src/data/spells.json`, `src/engine/domainAttributes.ts`, `src/state/combatFlow.ts`

---

### Domaine du Métal (Chamon — Vent Doré)

**Sources RAW :** `LDB 48 l.398`

> « Les Sorts infligeant des Dégâts ignorent les PA des armures métalliques, et infligent un bonus de Dégâts égal au nombre de PA de l'armure métallique portée à n'importe quelle Localisation frappée. Donc, si votre Sort frappe un Bras protégé par 2 PA d'une armure métallique, il inflige +2 Dégâts supplémentaires et ignore les PA. »

Bypass des PA en métal **et** bonus de dégâts égal aux PA bypassés (Métal = arme qui inflige les PA qu'elle pénètre).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 48` (l.398) → `gainCorruption`, `isProfane`, `GameOp`, `clarte-d-esprit`, `fauche-demon`, `filet-d-amyntok`, `lumiere-aveuglante`, `lumiere-de-guerison`, `pensee-rapide`, `castContextMods`, +3 — `src/data/spells.json`, `src/engine/corruption.ts`, `src/engine/domainAttributes.ts`, `src/engine/ops.ts`, `src/state/combatFlow.ts`, `src/state/corruptionFlow.ts`

---

### Domaine de la Mort (Shyish — Vent Améthyste)

**Sources RAW :** `LDB 48 l.497`

> « Vous pouvez assigner +1 État Exténué à chaque cible vivante affectée par un Sort de ce Domaine. Une cible peut n'avoir qu'un seul État Exténué gagné de cette façon à la fois. »

Rider optionnel `+1 État Exténué` sur chaque cible vivante (sans limite par sort, mais une cible ne peut accumuler qu'un seul état `Exténué` issu de cet Attribut à la fois).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 48` (l.497) → `effectSourcesOf`, `doc`, `refusLoose`, `GameOp`, `removeActiveEffects`, `ActiveEffect`, `OpFields`, `passiveMods`, `Combatant`, `applyOps`, +15 — `src/data/schemas/defs/spells.ts`, `src/data/schemas/grammaire/mecanique.ts`, `src/data/spells.json`, `src/engine/conditions.ts`, `src/engine/dispel.ts`, `src/engine/domainAttributes.ts`, +7 fichiers

---

### Domaine des Ombres (Ulgu — Vent Gris)

**Sources RAW :** `LDB 48 l.582-585`

> « les Sorts lancés depuis le Domaine des Ombres ignorent tous les PA non magiques. »

Bypass systématique de **tous les PA non magiques** (cuir, métal ordinaire — seuls les PA magiques résistent).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 48` (l.582-585) → `castContextMods`, `caresse-de-laniph`, `dernieres-paroles`, `la-faux-de-shyish`, `le-voile-violet-de-shyish`, `mort-rapide`, `sanctifier`, `vol-de-vie`, `vortex-d-ames`, `destrier-d-ombre`, +7 — `src/data/spells.json`, `src/engine/domainAttributes.ts`, `src/state/combatFlow.ts`

---

### Domaine de la Vie (Ghyran — Vent de Jade)

**Sources RAW :** `LDB 48 l.679-689`

> « Recevez un bonus de +10 aux lancers pour Incanter ou Focaliser dans un environnement rural ou sauvage. Les créatures vivantes – par exemple, les créatures ne possédant pas les Traits Démoniaque ou Mort-vivant – ciblées par des Sorts d'Arcane issus du Domaine de la Vie se voient retirer tous les États Exténué et Hémorragique, après que tous les autres effets ont été appliqués, alors que des flots magiques de vie les traversent. Les créatures avec le Trait de créature Mort-vivant, à l'inverse, subissent un nombre de Dégâts supplémentaires égal à votre Bonus de Force Mentale, ignorant le Bonus d'Endurance et les PA, si elles sont affectées par un Sort issu du Domaine de la Vie. »

Triple effet : (1) `+10` à Incanter/Focaliser en environnement rural/sauvage (bonus du lanceur) ; (2) toutes les cibles **vivantes** voient retirer leurs états `Exténué` et `Hémorragique` après application des effets ; (3) toutes les cibles `Mort-vivant` subissent `+BFM` dégâts ignorant BE+PA.

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 48` (l.679-689) → `domainEnvironmentBonus`, `Scene`, `setEnvironment`, `sceneSchema`, `FLOWS`, `GameOp`, `DomainData`, `castContextMods`, `destrier-d-ombre`, `illusion`, +11 — `src/data/index.ts`, `src/data/schemas/defs-scenes/scene.ts`, `src/data/spells.json`, `src/engine/domainAttributes.ts`, `src/engine/ops.ts`, `src/state/combatFlow.ts`, +3 fichiers

---

**Voir aussi :** [Test d'incantation](#test-dincantation), [Focalisation](#focalisation-test-étendu), [Projectiles Magiques](#projectiles-magiques)

---

## Zone d'Effet (ZdE)

**Sources RAW :** `LDB 47 l.28`

Les sorts marqués **ZdE** affectent tous les individus à l'intérieur de ce **diamètre** (pas d'un rayon). Diamètre typique : `(Bonus de Force Mentale) mètres`, valeur littérale, ou `Spécial`.

> **Verbatim** (LDB 47 l.28) : « les Sorts marqués ZdE affectent tous les individus à l'intérieur de ce DIAMÈTRE ».

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 47` (l.28) → `CastingNumberRounding`, `SpellTarget`, `CastModal`, `DECLARATIONS_D_OPS`, `carriedGrimoire`, `SpellbookSection`, `zdeDiameterMeters`, `bestAreaCenter`, `overcastAffordance`, `TIER`, +18 — `src/data/index.ts`, `src/data/schemas/grammaire/mecanique.ts`, `src/engine/castingNumber.ts`, `src/engine/grimoire.ts`, `src/engine/magic.ts`, `src/engine/ops.ts`, +11 fichiers

---

## Magie Elfique (Qhaysh)

**Sources RAW :** `LDB 44 l.101-105`

*Qhaysh* est le mélange de plusieurs Vents de Magie réunis en une énergie étincelante — la **Haute Magie** des elfes. Les hauts elfes expérimentent plusieurs Vents dans leur apprentissage avant que les plus prometteurs n'étudient Qhaysh. Les elfes sylvains se concentrent sur les Vents jade (Ghyran) et ambre (Ghur) ; les plus puissants étudient soit la Haute Magie, soit la Magie noire.

> **Verbatim** (LDB 44 l.103) : « C'est le mélange de plusieurs Vents de Magie réunis en une énergie étincelante et aveuglante. Cette magie est impressionnante et difficile, et les elfes affirment qu'elle dépasse les capacités du genre humain. »

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 44` (l.101-105) → `doc` — `src/data/schemas/defs/trappings.ts`
- bloqué : passage de lore (LDB 44 l.101-109), aucune règle mécanique — vérifié au Source le 2026-07-16

---

## Magie Noire (Dhar)

**Sources RAW :** `LDB 44 l.107-111`

*Dhar* (Magie noire) est la méthode **plus dangereuse** de lancer des sorts en utilisant plusieurs Vents simultanément (contrairement à Qhaysh). Pratiquée principalement par les enchanteurs maléfiques, nécromanciens et sorcières puissantes. Source de puissance brute mais souillée d'effets secondaires terribles — corruption, déformation physique et mentale surnaturelle.

*Dhar* se perçoit comme un bourbier stagnant pour ceux ayant la Seconde vue. Il se rassemble dans les endroits saturés de mal ou de corruption. Si dense, il peut se cristalliser en **malepierre**.

**Voir aussi :** [Malepierre](#malepierre), [Magie Noire — LDB 50 (sorts)](#listes-de-sorts--à-transcrire-séparément)

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 44` (l.107-111) → `doc` — `src/data/schemas/defs/trappings.ts`
- dette : #517

---

## Malepierre

**Sources RAW :** `LDB 44 l.113-119` · `LDB 19 l.40` (Exposition à la Corruption au contact/usage) · `LDB 19 l.51-53` (contact/usage prolongés, exposition modérée) · `LDB 46 l.164-173` (mécanique d'usage en Incantation/Focalisation).

La **malepierre** est un éclat de magie pure dans le plan matériel — manifestation de l'essence du Chaos, très corruptrice. Facettes dures comme du silex, lueur verte désagréable. Propriétés :
- Contact direct : risque de maladie, folie, mutation.
- Ingestion même en petite quantité : transformation abominable garantie.
- Source d'énergie pour sorts et rituels (utilisée par cultistes du Chaos et skavens malgré les dangers).
- Utilisation **officiellement interdite** par les pouvoirs en place.
- `LDB 46 l.173` : « Un Sorcier utilisant une malepierre pour Incanter ou Focaliser double son DR
  pour les Tests appropriés. En plus, Incanter ou Focaliser à l'aide d'une malepierre entraîne une
  influence corruptrice. » — règle INCONDITIONNELLE (`engine/magic.ts:malepierreDR`), sans gate
  d'option. Seule la réserve FINIE de NI (`VDM 02 l.165`, `1 g = 20 NI`) relève de l'option
  `magic-vdm-incantation` (`TrappingData.niPerGram`/`niConsumedPerDR`).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 19` (l.40, l.51-53) → `CorruptionModal`, `combat-end-corruption`, `sombre-pacte`, `EXPOSURE_LADDER`, `testDeCorruption`, `physique`, `exposureLevelSchema`, `corruption-mineure`, `corruption-moderee`, `doc`, +18 — `src/data/characteristics.json`, `src/data/combat-stakes.json`, `src/data/flow-stakes.json`, `src/data/mutationTables.json`, `src/data/regles.json`, `src/data/schemas/defs-scenes/effets.ts`, +10 fichiers
- `LDB 44` (l.113-119) → `doc` — `src/data/schemas/defs/trappings.ts`
- `LDB 46` (l.164-173) → `DispelModal`, `windsModFromRoll`, `FocusModal`, `force-des-vents`, `rollWindsOfMagic`, `STEP_WINDOW_AUTO`, `doc`, `windsMagicModOf`, `HoverTargeting`, `focalisation-etendue`, +67 — `src/data/actions.json`, `src/data/combat-stakes.json`, `src/data/flow-stakes.json`, `src/data/index.ts`, `src/data/regles.json`, `src/data/reglesOptionnelles.json`, +31 fichiers
- `VDM 2` (l.165) → `surincantation`, `doc`, `armourCastDRPenalty`, `armure-du-chaos`, `malevolentInfluenceSeverity`, `ItemInstance`, `malepierreDR`, `malepierreCharge`, `malepierreReserveOf`, `consumeMalepierre`, +4 — `src/data/index.ts`, `src/data/reglesOptionnelles.json`, `src/data/schemas/defs/trappings.ts`, `src/data/surincantation.json`, `src/data/trappings.json`, `src/data/weaponGroups.json`, +4 fichiers
- dette : #884

---

## Magie Naturelle

**Sources RAW :** `LDB 44 l.125-127`, `LDB 48 l.792-798`

Pratiquée en marge de l'Empire, en dehors des Collèges. Concerne l'espace entre le monde matériel et le royaume des esprits, le folklore et les esprits. Jadis répandue, pratiquement éradiquée par deux siècles de persécution.

**Règles spécifiques :**
- Les composants sont **obligatoires** pour tout lancement (partie intégrante du processus).
- Composants trouvables avec **Savoir (Herboristerie)** : DR + 1 composants sur un jet réussi de recherche de nourriture.
- Achat : **5 sous de cuivre** chacun.

**Voir aussi :** [Composants / Ingrédients](#composants--ingrédients)

---

## Sorcellerie (domaine hors-Collège)

**Sources RAW :** `LDB 44 l.129-131`, `LDB 49 l.5-7`

La Sorcellerie n'est pas réellement malveillante mais a une réputation méritée de lien avec le mal. Les sorciers sont souvent autodidactes, utilisent plusieurs Vents, manquent de discipline et courent un risque considérable de corruption.

**Règles spécifiques du Domaine de Sorcellerie :**
- **Corruption obligatoire** : chaque fois qu'un jet est effectué sur le Tableau des Incantations Imparfaites (quelle que soit la cause), gagner **1 Point de Corruption**.
- **État Hémorragique infligeable** : on peut infliger 1 État Hémorragique à toute cible d'un sort du Domaine de Sorcellerie.
- **Imparfaite systématique** : focaliser ou lancer des Sorts de ce Domaine **nécessite systématiquement** un jet sur le Tableau des Incantations Imparfaites Mineures, à moins d'utiliser un composant (qui annule le jet ou réduit la sévérité normalement).
- **Composants bon marché** : NI du sort en **sous de cuivre** (au lieu des pistoles d'argent habituelles). Trouvables avec Survie en extérieur : 1 + DR composants.

> **Verbatim** (LDB 49 l.5-5) : « À chaque fois qu'un pratiquant de la Sorcellerie fait un jet sur le Tableau des Incantations Imparfaites, il gagne 1 Point de Corruption. »

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 44` (l.129-131) → `doc` — `src/data/schemas/defs/trappings.ts`
- `LDB 49` (l.5-7) → `MiscastResult`, `rollMiscast`, `liveSinPoints`, `sorceryCorruptionLines`, `finishMiscast` — `src/data/reglesOptionnelles.json`, `src/engine/miscast.ts`, `src/state/combatFlow.ts`

---

## Listes de sorts — à transcrire séparément

Les catalogues de sorts (NI, portée, cible, durée, description mécanique) sont dans les fichiers source suivants. Ils ne sont **pas** dans ce fichier (volume trop important) :

| Fichier source | Contenu |
|---|---|
| `LDB 47 - Listes des sorts.md` | Sorts Mineurs, Sorts d'Arcane, Sorts de Domaine de chaque Collège (Feu, Lumière, Jade, Céleste, Ambre, Or, Métal, Ombres) |
| `LDB 48 - Magie des Couleurs.md` | Attributs de Domaine par Vent (règles spécifiques de Cieux, Métal, Ombres…) + sorts complémentaires |
| `LDB 49 - Sorcellerie.md` | Sorts de Magie Naturelle + Sorcellerie |
| `LDB 50 - Magie noire.md` | Sorts de Nécromancie + Démonologie |
| `LDB 51 - Magie du Chaos.md` | Sorts de Nurgle, Slaanesh, Tzeentch (LDB) |
| `EDO - Sorts de Tzeentch` | Sorts additionnels Tzeentch (`Source/Warhammer v4 - 1.0 L'ennemi dans l'Ombre/`) |

Les specs curées de tous ces sorts sont dans `src/data/spellspecs/` (une entrée par sort, couvrant les 243 sorts) — voir `src/engine/spellspec.ts`.

---


---

<!-- MDG-INTEGRATION -->

## Magie des mers — modificateurs des Vents en mer

**Sources RAW :** `MDG 02 l.178-186`

Le « Département des arts magiques maritimes » du collège du baron Henryk (Marienburg) prévient les apprentis que les Vents de Magie se rassemblent et soufflent de manière étrange sur les mers. Certains Vents sont plus difficiles à contrôler, d'autres déferlent en rafales écrasantes. Les modificateurs suivants s'appliquent aux Tests de **Focalisation** et d'**Incantation** en mer, par Domaine :

- **Domaine de la Bête (*Ghur*)** : la définition de Maladresse — et de Critique — est élargie pour les Sorts de ce Domaine. Les Incantations/Focalisations critiques **et** les Maladresses se produisent à la fois sur les **doubles** et sur les **résultats se terminant par un 0** (Ghur repose parmi les bêtes de l'abysse et peut réagir au lanceur).
- **Domaine du Feu (*Aqshy*)** : les Tests de **Focalisation** subissent **−1 DR** en mer (*Aqshy* est difficile à invoquer). **Exception** : si un bateau est actuellement rongé par les flammes, Focaliser *Aqshy* sur ce vaisseau donne **+1 DR** (en plus des bénéfices normaux des États *En flammes* appliqués au Domaine du Feu — cf. Attribut Feu LDB 48).
- **Domaine des Cieux (*Azyr*)** : météo-dépendant. Les Sorts du Domaine des Cieux lancés pendant une **Violente tempête** bénéficient de **+1 DR** aux Tests d'**Incantation** ; ceux lancés en période de **Calme plat** subissent **−1 DR** aux Tests d'**Incantation**.
- **Domaine de la Vie (*Ghyran*)** : *Ghyran* sature les mers (puissance facile pour un sorcier de Jade) mais fluctue. Les **DR des Tests de Focalisation sont doublés** sur les mers, mais une **Focalisation Critique** y donne une **Incantation Imparfaite Majeure** (au lieu de Mineure). Avec le Talent **Harmonisation aethyrique**, on lance sur le tableau des Incantations Imparfaites **Mineures** à la place.

> **Verbatim** (l.180) : « Pour les Sorts de ce Domaine, les Incantations et Focalisations critiques ainsi que les Maladresses se produisent à la fois sur les doubles et les résultats se terminant par un 0. »

> **Verbatim** (l.182) : « Les Tests de Focalisation pour ce Domaine subissent -1 DR. Cependant, si un bateau est en feu, *Aqshy* se précipite vers lui. Focaliser *Aqshy* sur un vaisseau actuellement rongé par les flammes donne +1 DR »

> **Verbatim** (l.184) : « Les Sorts du Domaine des Cieux lancés pendant une Violente tempête bénéficient de +1 DR sur les Tests d'Incantation. Les Sorts lancés en période de Calme plat subissent -1 DR sur les Tests d'Incantation. »

> **Verbatim** (l.186) : « Les DR des Tests de Focalisation sont doublés sur les mers, mais une Focalisation Critique donne une Incantation Imparfaite Majeure au lieu de Mineure. Si vous possédez le Talent *Harmonisation aethyrique*, faites un lancer sur le tableau des Incantations Imparfaites Mineures à la place. »

**Voir aussi :** [Focalisation (Test étendu)](#focalisation-test-étendu), [Focalisation Critique](#focalisation-critique), [Maladresse de Focalisation](#maladresse-de-focalisation), [Domaine du Feu (Aqshy — Vent Rouge)](#domaine-du-feu-aqshy--vent-rouge)

**Implémente :** _(généré — `npm run raw:implemente`)_
- `MDG 2` (l.178-186) → `seaMagicContext`, `crew`, `doc`, `SeaWind`, `CastTestModsContext`, `castTestDRMods`, `resolveCasting`, `evaluateCasting`, `resolveMagicMissile`, `resolveFocus`, +8 — `src/data/index.ts`, `src/data/schemas/defs/domains.ts`, `src/data/spells.json`, `src/engine/domainAttributes.ts`, `src/engine/magic.ts`, `src/scenes/test-scenarios/14-voyage-maritime.ts`, +2 fichiers

---

## Sorts de magie des mers (collège du baron Henryk)

**Sources RAW :** `MDG 02 l.189-262`

Le collège du baron Henryk enseigne des Sorts particulièrement adaptés à la vie en mer, peu connus hors de Marienburg, rattachés aux Domaines de la **Vie** (*Ghyran*) et des **Cieux** (*Azyr*). Six sorts sont décrits (NI, portée, cible, durée, effet mécanique → transcrits dans [`catalogue-sorts.md`](catalogue-sorts.md)) :

- **Domaine de la Vie** — *Bourbier vivant* (NI 8 : enlise un navire, −2 Mouvement et −3 DR de Manœuvre, dégagement par Test étendu de Navigation) ; *Que d'eau, que d'eau* (NI 6 : purifie et remplit les tonneaux d'eau du navire) ; *Tourbillon* (NI 6 : crée un tourbillon dans la ZdE, agrandissable par Surincantation — Tourbillon / Puissant vortex / Maelstrom / Maelstrom primordial selon le DR).
- **Domaine des Cieux** — *Bienfait de Bel Shanaar* (NI 2 : +2 DR aux Tests d'Orientation du sorcier vers une destination connue) ; *Mer d'huile* (NI 10 : impose l'effet *Calme plat* du tableau Effet du vent sur la ZdE) ; *Solution de tir optimal de Niezlib* (NI 6 : +1 DR aux Tests pour tirer au canon depuis le navire).

Ces sorts manipulent des objets de jeu « navals » (navire, Manœuvre, tourbillon, Effet du vent, canon) propres aux règles maritimes de MDG ; seul *Bienfait de Bel Shanaar* (bonus d'Orientation) relève d'une mécanique générique RAW déjà supportée.

> **Verbatim** (l.205, *Bourbier vivant*) : « Tant qu'il est pris dans le bourbier, le bateau subit -2 à sa Caractéristique de Mouvement et ajuste sa Caractéristique de Manœuvre de -3 DR. »

> **Verbatim** (l.262, *Solution de tir optimal de Niezlib*) : « Pendant toute la durée du Sort, les Tests effectués pour tirer avec un canon bénéficient de +1 DR. »

**Voir aussi :** [Magie des mers — modificateurs des Vents en mer](#magie-des-mers--modificateurs-des-vents-en-mer), [Surincantation](#surincantation), [Zone d'Effet (ZdE)](#zone-deffet-zde)

**Implémente :** _(généré — `npm run raw:implemente`)_
- `MDG 2` (l.189-262) → `seaMagicContext`, `crew`, `doc`, `SeaWind`, `CastTestModsContext`, `castTestDRMods`, `resolveCasting`, `evaluateCasting`, `resolveMagicMissile`, `resolveFocus`, +8 — `src/data/index.ts`, `src/data/schemas/defs/domains.ts`, `src/data/spells.json`, `src/engine/domainAttributes.ts`, `src/engine/magic.ts`, `src/scenes/test-scenarios/14-voyage-maritime.ts`, +2 fichiers

---

## Seconde vue (révision VDM)

> **Ruleset OPTIONNEL** (`VDM 02 l.5-7`) : VDM 02 propose des règles d'incantation qui **remplacent** celles du LDB (chap. 8 = Atlas folios 46-51) **si le groupe choisit de les activer** — c'est une règle optionnelle, module-gatée, jamais un remplacement forcé (doctrine « une entité, N livres, N variantes »). Verbatim (l.7) : « *Bien entendu, vous êtes libre d'utiliser celles que vous souhaitez.* » Les topics ci-dessous ne documentent QUE ce que VDM change ou ajoute par rapport aux topics LDB déjà présents plus haut dans cette fiche.

**Sources RAW :** `VDM 02 l.11`, `l.13`

Delta VDM sur la [Seconde Vue](#seconde-vue) du LDB : outre Intuition / Perception / Pistage, VDM ouvre la Seconde vue à **« d'autres Compétences »** pour obtenir des renseignements sur les Vents, et précise que le Talent est **inaliénable** (le lanceur ne peut en être privé), au risque d'être submergé par les Vents à un moment inopportun.

> **Verbatim** (l.11) : « il peut utiliser ce Talent et effectuer des Tests d'Intuition, de Perception, de Pistage ou d'autres Compétences pour obtenir des renseignements. »
> **Verbatim** (l.13) : « Les Personnages dotés de ce Talent, dont ils ne sauraient être privés, peuvent être conscients des Vents de Magie, ou même submergés par eux à un moment inopportun. »

**Voir aussi :** [Seconde Vue (LDB)](#seconde-vue), [Types de sorts](#types-de-sorts)

---

## Mémoriser des sorts (révision VDM)

**Sources RAW :** `VDM 02 l.19`

Delta VDM : le coût de mémorisation d'un sort est explicitement rattaché au montant de PX indiqué dans les Talents **`Magie mineure`** (sorts mineurs) ou **`Magie des Arcanes`** (sorts de Domaine).

> **Verbatim** (l.19) : « Les lanceurs de sorts les mémorisent en dépensant un montant de PX indiqué dans les Talents *Magie mineure* ou *Magie des Arcanes*. »

**Voir aussi :** [Mémoriser des sorts (LDB)](#mémoriser-des-sorts)

---

## Grimoires (révision VDM)

**Sources RAW :** `VDM 02 l.23`, `l.25`

Delta VDM sur les [Grimoires (LDB)](#grimoires-lancer-depuis-le-livre) : un grimoire contient **généralement quatre sorts d'un même Domaine** ; pour lancer depuis le livre, le lanceur doit avoir **ses deux mains libres** pour en feuilleter les pages. Le doublement du NI (déjà couvert par le LDB) est confirmé.

> **Verbatim** (l.23) : « Les grimoires sont des livres contenant des instructions pour lancer des Sorts, généralement quatre du même Domaine de Magie. »
> **Verbatim** (l.25) : « Il doit avoir ses deux mains libres pour en feuilleter les pages. Pour symboliser sa méconnaissance du Sort, son NI est doublé. »

**Voir aussi :** [Grimoires (LDB)](#grimoires-lancer-depuis-le-livre)

---

## Incantation Critique révisée (Puissance totale)

**Sources RAW :** `VDM 02 l.52`, `l.54`, `l.55`, `l.56`

Delta VDM sur l'[Incantation Critique (LDB)](#incantation-critique). Un double sur un Test d'incantation **réussi** entraîne une Incantation Critique : jet sur le Tableau des Incantations Imparfaites Mineures (sauf Talent `Diction instinctive`), et choix possible d'un des trois effets. **VDM redéfinit « Puissance totale »** : au lieu de « le sort est lancé quel que soit le DR », le sort est lancé ET le lanceur **ajoute le chiffre des dizaines de son lancer d'Incantation à son DR** pour obtenir une Surincantation. Les deux autres effets sont inchangés.

> **Verbatim** (l.54) : « **Incantation Critique :** si le Sort inflige des Dégâts, il inflige aussi une Blessure Critique. »
> **Verbatim** (l.55) : « **Puissance totale :** le Sort est lancé. Le lanceur peut ajouter le chiffre des dizaines de son lancer d'Incantation à son DR pour obtenir une Surincantation (voir page 23). »
> **Verbatim** (l.56) : « **Force inéluctable :** le Sort ne peut pas être Dissipé. »

**Voir aussi :** [Incantation Critique (LDB)](#incantation-critique), [Surincantation révisée (VDM)](#surincantation-révisée--tableau-de-surincantation-vdm)

---

## Projectiles magiques (révision VDM)

**Sources RAW :** `VDM 02 l.68`

Delta VDM sur les [Projectiles Magiques (LDB)](#projectiles-magiques). La localisation reste déterminée en **inversant le résultat** du Test d'Incantation (Tableau des Localisations). **VDM simplifie le calcul des Dégâts** : Dégâts totaux = **Dégâts du Sort + Bonus de Force Mentale du lanceur** — le DR du Test d'Incantation **n'est plus ajouté** (le LDB ajoutait sort + DR + BFM). Endurance et PA de la cible sont retranchés comme d'habitude.

> **Verbatim** (l.68) : « Pour calculer les Dégâts, ajoutez le Bonus de Force Mentale du lanceur aux Dégâts du Sort. »

**Voir aussi :** [Projectiles Magiques (LDB)](#projectiles-magiques), [Sorts de Contact en Combat](#sorts-de-contact-en-combat)

---

## Vortex aléatoires (nouveau — VDM)

**Sources RAW :** `VDM 02 l.72`, `l.74`, `l.78`, `l.79`, `l.82`, `l.84` (table)

Nouveauté VDM : certains sorts portent *« Vortex aléatoire »* dans leur description — un maelstrom d'énergie magique échappant au contrôle du lanceur, qui peut dévier vers le lanceur ou ses alliés, à effet durable et déplacement aléatoire chaque Round. Fonctionnement :

1. Test d'Incantation réussi → le vortex est invoqué ; sa **Zone d'Effet est adjacente au lanceur mais ne le touche pas**. Le lanceur choisit une direction et effectue un Test de **Force Mentale Accessible (+20)** pour la trajectoire initiale.
2. Test réussi → la ZdE s'écarte immédiatement de **2d10 mètres** dans la direction choisie ; échec → déplacement immédiat dans une direction **aléatoire**. Dans les deux cas, le vortex impacte tout sur son chemin (**y compris le lanceur**).
3. À chaque Round suivant, à la fin du tour du lanceur, le vortex se déplace de **2d10 mètres** dans une direction aléatoire. Un **1** au dé de direction fait disparaître prématurément le vortex ; sinon il continue jusqu'à la fin de la Durée du Sort.

> **Verbatim** (l.72) : « Un *Vortex aléatoire* est généralement très dangereux, car il peut dévier en direction du lanceur ou de ses alliés. »
> **Verbatim** (l.78) : « il invoque un vortex. La Zone d'Effet est adjacente au lanceur, mais ne le touche pas. Il choisit alors une direction et effectue un Test de **Force Mentale Accessible (+20)** pour déterminer la trajectoire initiale. »
> **Verbatim** (l.79) : « Si le Test est réussi, la Zone d'Effet s'écarte immédiatement de 2d10 mètres du lanceur dans la direction choisie. »
> **Verbatim** (l.82) : « Obtenir 1 sur le dé de direction aléatoire conduit à la disparition prématurée du vortex. »

**Tableau de mouvements du vortex (d10, recopié verbatim VDM 02 l.84-97) :**

| Lancer | Direction du mouvement – Sur une grille | Direction du mouvement – De manière abstraite |
|--------|------------------------------------------|-----------------------------------------------|
| 1 | Disparition du vortex | Disparition du vortex |
| 2 | Nord | Le lanceur choisit une direction |
| 3 | Nord-est | Le lanceur choisit une direction |
| 4 | Est | Le lanceur choisit une direction |
| 5 | Le vortex ne bouge pas | Le lanceur choisit une direction |
| 6 | Sud-est | Le vortex ne bouge pas |
| 7 | Sud | Le MJ choisit une direction |
| 8 | Sud-ouest | Le MJ choisit une direction |
| 9 | Ouest | Le MJ choisit une direction |
| 10 | Nord-ouest | Le MJ choisit une direction |

**Voir aussi :** [Zone d'Effet (ZdE)](#zone-deffet-zde), [Durée des sorts](#durée-des-sorts)

---

## Sorts de Contact — bâton enchanté (ajout VDM)

**Sources RAW :** `VDM 02 l.103`

Ajout VDM aux [Sorts de Contact en Combat (LDB)](#sorts-de-contact-en-combat). Le socle reste : Test d'Incantation réussi, puis **Test opposé de Corps à corps (Bagarre)** contre Corps à corps ou Esquive (localisation d'un *Projectile magique* déterminée par ce test). VDM ajoute que certains objets magiques (ex. bâtons enchantés) permettent de profiter de leur **allonge** : on remplace alors le Test de Corps à corps (Bagarre) par un Test de **Corps à corps plus approprié** (ex. *Corps à corps (Arme d'hast)* pour un bâton enchanté). Ce test sert **uniquement** à toucher la cible avec l'objet — ce n'est **pas** une attaque infligeant des Dégâts en plus des effets du Sort.

> **Verbatim** (l.103) : « Certains objets magiques, comme des bâtons enchantés, permettent à un lanceur de sorts de profiter de leur allonge quand ils lancent des Sorts de contact. »

**Voir aussi :** [Sorts de Contact en Combat](#sorts-de-contact-en-combat)

---

## Test de Focalisation révisé (réserve d'énergie)

**Sources RAW :** `VDM 02 l.131`, `l.133`, `l.137`, `l.141`

**Changement majeur VDM** sur la [Focalisation (LDB)](#focalisation-test-étendu) (« une Focalisation plus intéressante », intro l.7). Le modèle passe d'un « DR cumulé qui doit atteindre le NI puis lancer à NI 0 » à une **réserve d'énergie** : le lanceur choisit le Vent à canaliser, dépense une Action pour un **Test étendu de Focalisation**, et **chaque DR obtenu réduit le NI du sort de 1, jusqu'à un minimum de 0**. Quand il juge la réserve suffisante, il effectue son Test d'Incantation en lançant au **NI réduit** ; toute énergie excédentaire est perdue une fois le sort lancé. Un échec du Test d'Incantation après Focalisation → énergie perdue + Incantation Imparfaite Mineure.

- L'énergie canalisée **ne peut pas** servir à surincanter un sort (mais réduire assez le NI rend la Surincantation plus probable).
- Interrompre la Focalisation pour autre chose que lancer le sort est une **Interruption** ; le lanceur peut prendre une Action en début de tour pour **évacuer en sécurité** l'énergie accumulée.

> **Verbatim** (l.131) : « Chaque DR s'ajoute à une réserve spéciale d'énergie que le Personnage peut utiliser pour réduire le NI de tout Sort qu'il est capable de lancer en se servant du Vent canalisé. »
> **Verbatim** (l.133) : « Chaque DR obtenu de cette manière réduit le NI d'un Sort de 1, jusqu'à un minimum de 0. Une fois que le Personnage pense avoir amassé suffisamment d'énergie, il doit faire un Test d'Incantation, lançant ainsi le Sort au NI réduit. Toute énergie supplémentaire est perdue une fois que le Sort est lancé. »
> **Verbatim** (l.137) : « L'énergie canalisée ne peut pas être utilisée pour surincanter un Sort, même si, bien sûr, réduire suffisamment le NI d'un Sort rendra la Surincantation plus probable. »

**Voir aussi :** [Focalisation (LDB)](#focalisation-test-étendu), [Interruptions de Focalisation](#interruptions-de-focalisation), [Surincantation révisée (VDM)](#surincantation-révisée--tableau-de-surincantation-vdm)

---

## Focalisation Critique révisée (VDM)

**Sources RAW :** `VDM 02 l.145`

Delta VDM sur la [Focalisation Critique (LDB)](#focalisation-critique). Un double **réussi** au Test de Focalisation permet d'ajouter **immédiatement un DR bonus égal au Bonus de Force Mentale** au Test étendu de Focalisation (le LDB, lui, autorisait à lancer le sort au Round suivant quel que soit le DR cumulé). Le lanceur doit aussi jeter sur le Tableau des Incantations Imparfaites Mineures, **sauf** s'il possède le Talent `Harmonisation aethyrique`.

> **Verbatim** (l.145) : « il peut immédiatement ajouter au Test étendu de Focalisation un DR bonus égal à son Bonus de Force Mentale. Il doit également faire un lancer sur le Tableau des Incantations Imparfaites Mineures, sauf s'il possède le Talent *Harmonisation aethyrique*. »

**Voir aussi :** [Focalisation Critique (LDB)](#focalisation-critique)

---

## Maladresse de Focalisation révisée (VDM)

**Sources RAW :** `VDM 02 l.149`

Delta VDM sur la [Maladresse de Focalisation (LDB)](#maladresse-de-focalisation). VDM **simplifie** la définition (Maladresse = simplement **un double raté** au Test étendu de Focalisation ; le LDB élargissait aux résultats terminant par 0 : 00, 99, 90, 88…) **et adoucit la conséquence** : le jet se fait sur le Tableau des Incantations Imparfaites **Mineures** (le LDB envoyait sur les **Majeures**).

> **Verbatim** (l.149) : « Si le lanceur de sorts rate un Test étendu de Focalisation et obtient un double, il commet une Maladresse : il doit effectuer un lancer sur le Tableau des Incantations Imparfaites Mineures. »

**Voir aussi :** [Maladresse de Focalisation (LDB)](#maladresse-de-focalisation)

---

## Influences malveillantes (révision VDM)

**Sources RAW :** `VDM 02 l.157`, `l.159`

**Changement VDM** sur les [Influences Malfaisantes « le 8 » (LDB)](#influences-malfaisantes-le--8-). À proximité d'une Influence corruptrice, VDM **abandonne le mécanisme du dé des unités à 8** : désormais **tout lancer raté** (Test d'Incantation ou de Focalisation) impose un jet sur le Tableau des Incantations Imparfaites Mineures. Si le Test aboutissait déjà à un jet sur les Mineures (ex. Focalisation Critique, Maladresse de Focalisation), il se fait **à la place sur les Majeures**. Précision : les lanceurs de **Domaines sombres** ne sont pas eux-mêmes considérés comme une Influence malveillante pour leurs propres Tests.

> **Verbatim** (l.157) : « Tout lancer raté impose au Personnage un lancer sur le Tableau des Incantations Imparfaites Mineures. »
> **Verbatim** (l.159) : « Les lanceurs de sorts qui utilisent des Domaines sombres ne sont pas considérés comme étant des Influences malveillantes pour ce qui est de leurs propres Tests d'Incantation et de Focalisation. »

**Voir aussi :** [Influences Malfaisantes (LDB)](#influences-malfaisantes-le--8-), [Malepierre (révision VDM)](#malepierre-révision-vdm--consommation)

---

## Malepierre (révision VDM — consommation)

**Sources RAW :** `VDM 02 l.163`, `l.165`

Delta VDM sur la [Malepierre (LDB)](#malepierre). L'usage de malepierre **double tout DR** obtenu aux Tests d'Incantation ou de Focalisation, mais exerce une Influence corruptrice dangereuse et compte comme **Influence malveillante** (cf. topic ci-dessus). VDM ajoute une **règle de consommation chiffrée** : il faut suivre le nombre de NI qu'un morceau peut fournir avant épuisement — **1 gramme de malepierre ≈ 20 NI d'énergie magique**.

> **Verbatim** (l.163) : « Un lanceur de sorts qui utilise de la malepierre double tout DR qu'il obtient lors de Tests d'Incantation ou de Focalisation. »
> **Verbatim** (l.165) : « Habituellement, 1 gramme de malepierre équivaut à 20 NI d'énergie magique. »

**Voir aussi :** [Malepierre (LDB)](#malepierre), [Influences malveillantes (VDM)](#influences-malveillantes-révision-vdm)

---

## Repousser les Vents (ajouts VDM)

**Sources RAW :** `VDM 02 l.169`

Ajouts VDM à [Repousser les Vents (LDB)](#repousser-les-vents-armure-et-tenue). Le socle reste : **−1 DR** aux Tests d'Incantation et de Focalisation **par PA** sur la Localisation la mieux protégée (métal = *Chamon*, cuir = *Ghur*), exemptions `Magie des Arcanes (Métal)` pour le métal et `Magie des Arcanes (Bête)` pour le cuir. VDM ajoute : les **Sorciers du Chaos peuvent porter des armures du Chaos sans pénalité**, et le MJ peut décider que d'autres tenues sont inappropriées et imposer des pénalités similaires.

> **Verbatim** (l.169) : « Les Sorciers du Chaos peuvent porter des armures du Chaos sans pénalité. »

**Voir aussi :** [Repousser les Vents (LDB)](#repousser-les-vents-armure-et-tenue)

---

## Dissipation (ajouts VDM)

**Sources RAW :** `VDM 02 l.186`

Ajout VDM à la [Dissipation / Contre-sort (LDB)](#dissipation--contre-sort) et à [Dissiper des sorts permanents](#dissiper-des-sorts-permanents). Le socle reste inchangé (Test opposé de Langue (Magick), une seule tentative par Round ; sorts permanents = Test étendu jusqu'à ce que le DR cumulé atteigne le NI ; plusieurs dissipateurs d'un même Domaine peuvent faire un **Test Soutenu**). VDM ajoute un bonus : un lanceur qui **dissipe son propre Sort** reçoit **+1 DR** au Test de Langue (Magick).

> **Verbatim** (l.186) : « Un lanceur de sorts qui dissipe son propre Sort reçoit un bonus de +1 DR au Test de Langue (Magick). »

**Voir aussi :** [Dissipation / Contre-sort (LDB)](#dissipation--contre-sort), [Dissiper des sorts permanents](#dissiper-des-sorts-permanents)

---

## Domaines magiques multiples (nouveau — VDM)

**Sources RAW :** `VDM 02 l.190`, `l.192`

Nouveauté VDM. Un lanceur **elfe** peut apprendre un nombre de **Domaines magiques égal à son Bonus de Force Mentale**. Il ne peut acheter un nouveau Talent `Magie des Arcanes` qu'après avoir dépensé **au moins 20 Améliorations dans la Compétence Focalisation** ET **appris 8 Sorts du Domaine précédent**. Par ailleurs, **n'importe quel** lanceur peut apprendre **un unique Domaine sombre** en plus d'un autre Domaine.

> **Verbatim** (l.190) : « Un lanceur de sorts elfe peut apprendre un nombre de Domaines magiques égal à son Bonus de Force Mentale. »
> **Verbatim** (l.192) : « N'importe quel lanceur de sorts peut apprendre un unique Domaine sombre en plus d'un autre Domaine. »

**Voir aussi :** [Magie Elfique (Qhaysh)](#magie-elfique-qhaysh), [Magie Noire (Dhar)](#magie-noire-dhar)

---

## Surincantation révisée + Tableau de Surincantation (VDM)

**Sources RAW :** `VDM 02 l.196`, `l.201`, `l.205` (titre), `l.207`, `l.215` (table)

**Système de Surincantation révisé par VDM** (à distinguer de la [Surincantation LDB](#surincantation)). Les DR générés au-delà du NI peuvent être dépensés pour améliorer un sort réussi, sous restrictions : la Surincantation augmente **Portée, Zone d'Effet, Durée ou nombre de Cibles** (et **Dégâts** pour un *Projectile magique*) ; les Portées « Vous »/« Contact » et les Durées « Instantané » ne s'augmentent pas ; les sorts sans ZdE ne s'agrandissent pas ; Cible « Spécial » interdit les cibles supplémentaires. **VDM introduit un tableau à seuils de DR** (au lieu du « ×valeur initiale par pas » du LDB) : les effets se choisissent **dans plusieurs colonnes, mais chaque colonne une seule fois par incantation** ; tout DR restant est perdu.

> **Verbatim** (l.196) : « Si un lancer d'Incantation génère des DR au-delà de ceux requis pour lancer un Sort, le lanceur de sorts peut dépenser les DR restants en Surincantation. »
> **Verbatim** (l.201) : « Les effets peuvent être choisis dans plusieurs colonnes, mais chacune ne peut être choisie qu'une seule fois par incantation. Tout DR restant est perdu. »

**Tableau de Surincantation (recopié verbatim VDM 02 l.207-215) :**

| DR | Cible additionnelle | Dégât en plus | Portée étendue | ZdE étendue | Durée prolongée |
|------------|---------------------|---------------|----------------|-------------|-----------------|
| 1 | +1 Cible | +1 Dégât | 2 × Portée | ZdE listée | Durée listée |
| 2 | +1 Cible | +2 Dégâts | 2 × Portée | ZdE listée | 2 × Durée |
| 3 | +1 Cible | +3 Dégâts | 2 × Portée | 2 × ZdE | 2 × Durée |
| 5 | +2 Cibles | +4 Dégâts | 3 × Portée | 2 × ZdE | 2 × Durée |
| 8 | +2 Cibles | +5 Dégâts | 3 × Portée | 2 × ZdE | 3 × Durée |
| 13 | +2 Cibles | +6 Dégâts | 3 × Portée | 2 × ZdE | 3 × Durée |
| 21 ou plus | +3 Cibles | +7 Dégâts | 4 × Portée | 3 × ZdE | 3 × Durée |

*Exemple RAW (l.203) : Hengus lance Fléchette (NI 0) avec 5 DR ; sorts sans ZdE et Instantané → il dépense 3 DR pour +3 Dégâts (0 + BFM + 3) et 1 DR pour doubler la Portée (2 × Force Mentale mètres) ; le DR restant est perdu.*

**Voir aussi :** [Surincantation (LDB)](#surincantation), [Incantation Critique révisée (VDM)](#incantation-critique-révisée-puissance-totale), [Zone d'Effet (ZdE)](#zone-deffet-zde)

---

## Tableau des Incantations Imparfaites Mineures — révision VDM (d100 verbatim)

**Sources RAW :** `VDM 02 l.218` (titre), `l.220`, `l.240` (bornes de table `l.220-240`)

Table d100 **révisée par VDM** (entrées différentes de la table LDB : ajout de *Souffle glacial*, *Regard maudit*, *Murmures mortels*, *Marqué par la Magie*, etc.). Recopiée verbatim (fourchettes intactes) :

| d100 | Effet |
|------|-------|
| 01–05 | Signe de Sorcière : la prochaine créature vivante à naître dans un rayon de 1 mille mute. |
| 06–10 | Lait caillé : tout le lait dans un rayon de 1d100 mètres tourne instantanément. |
| 11–15 | Mildiou : un nombre de champs égal à votre Bonus de Force Mentale dans un rayon de (Bonus de Force Mentale) milles subissent une calamité, et toutes les cultures pourrissent pendant la nuit. |
| 16–20 | Cérumen : vos oreilles se bouchent instantanément à cause d'une cire épaisse. Recevez 1 État Assourdi, qui ne peut être retiré jusqu'à ce que quelqu'un les nettoie pour vous (avec un Test de Guérison Accessible (+20) réussi). |
| 21–25 | Souffle glacial : la température de votre environnement immédiat baisse soudainement et l'air expiré est visible. Les personnes situées dans un rayon de (Bonus de Force Mentale) mètres autour de vous doivent réussir un Test de Résistance Intermédiaire (+0) ou bien subir soudain un malus de −10 à leur Capacité de Tir, Agilité et Dextérité à cause du froid jusqu'à ce qu'ils quittent la zone. Cet effet dure 1 minute. |
| 26–30 | Délié : sur votre personne, toutes les boucles se détachent et tous les lacets se délacent, ce qui peut entraîner la chute de ceintures et de sacs, l'ouverture des poches et le glissement de l'armure. |
| 31–35 | Tenue indisciplinée : vos vêtements semblent se tordre par leur propre volonté. Recevez 1 État Empêtré avec une Force de 1d10 × 5 pour résister. |
| 36–40 | Malédiction de la sobriété : tout l'alcool dans un rayon de 1d100 mètres s'évente, prenant un goût infect et amer. Ceci aide à comprendre pourquoi le lancement de sorts est mal vu dans de nombreuses tavernes du Vieux Monde. |
| 41–45 | Langue maladroite : vous subissez une pénalité de −10 à tous les Tests de Langue (y compris les Tests d'Incantation) pendant 1d10 Rounds. |
| 46–50 | Distraction : si vous êtes engagé en combat, vous recevez l'État Surpris. Sinon, vous êtes complètement décontenancé, le cœur battant et incapable de vous concentrer pendant quelques instants. |
| 51–55 | Visions impies : des visions éphémères d'actes profanes et impies vous harcèlent. Recevez l'État Aveuglé ; réussissez un Test de Calme Intermédiaire (+0) ou gagnez-en un autre. |
| 56–60 | Regard maudit : vos yeux prennent une couleur anormale associée à votre Domaine pendant 1d10 heures. Tant que vos yeux gardent cette couleur, vous possédez 1 État Aveuglé qui ne peut être retiré d'aucune façon. Durant cette période, vous perdez la capacité d'utiliser les Talents Perception de la magie et Seconde vue. |
| 61–65 | Rupture : votre nez, vos yeux et vos oreilles saignent abondamment. Recevez 1 État Hémorragique. |
| 66–70 | Murmures mortels : le MJ peut choisir deux symboles inversés dans le Tableau des Symboles (voir page 45). Réussissez un Test de Force Mentale Accessible (+20) ou recevez 1 Point de Corruption. |
| 71–75 | L'horreur ! : vous êtes bouleversé par un afflux soudain de visions dérangeantes du Royaume du Chaos. Le MJ peut choisir un symbole inversé dans le Tableau des Symboles (voir page 45). Réussissez un Test de Calme Difficile (−20) ou recevez 1 État Brisé. |
| 76–80 | Malédiction de corruption : recevez 1 Point de Corruption. |
| 81–85 | Rébellion intestinale : vos intestins deviennent incontrôlables et vous vous souillez. Recevez 1 État Exténué qui ne peut être retiré tant que vous ne pouvez pas changer de vêtements et vous nettoyer. |
| 86–90 | Marqué par la Magie : le vent que vous manipulez vous marque physiquement. Consultez la page 58 pour les Marques de Hysh, la page 70 pour les Marques de Chamon, la page 82 pour les Marques de Ghyran, la page 94 pour les Marques d'Azyr, la page 106 pour les Marques d'Ulgu, la page 118 pour les Marques de Shyish, la page 130 pour les Marques d'Aqshy et la page 142 pour les Marques de Ghur. Si aucune Marque arcanique ne convient à votre tradition magique, ou si vous obtenez une Marque que vous possédez déjà, effectuez un nouveau lancer sur le Tableau des Incantations Imparfaites Majeures. |
| 91–95 | Multiplication d'infortune : effectuez deux lancers sur cette table, en relançant tous les résultats entre 91–00. |
| 96–00 | Chaos en cascade : effectuez un nouveau lancer sur le Tableau des Incantations Imparfaites Majeures. |

**Voir aussi :** [Tableau des Incantations Imparfaites Mineures (LDB)](#tableau-des-incantations-imparfaites-mineures-d100-verbatim), [Influences malveillantes (VDM)](#influences-malveillantes-révision-vdm)

---

## Tableau des Incantations Imparfaites Majeures — révision VDM (d100 verbatim)

**Sources RAW :** `VDM 02 l.243`, `l.263` (bornes de table `l.243-263`)

Table d100 **révisée par VDM** (imprimée à la suite des Mineures, sans en-tête réimprimé dans l'extraction ; référencée comme « Tableau des Incantations Imparfaites Majeures » aux l.157, 238, 240). Recopiée verbatim :

| d100 | Effet |
|------|-------|
| 01–05 | Voix fantomatiques : toutes les personnes dans un rayon de (Force Mentale) mètres entendent de sombres murmures envoûtants émanant du Royaume du Chaos. Toutes les créatures douées de conscience doivent réussir un Test de Calme Accessible (+20) ou recevoir 1 Point de Corruption. |
| 06–10 | Choc aethyrique : vous subissez 1d10 Blessures qui ignorent le Bonus d'Endurance et les Points d'Armure. Réussissez un Test de Résistance Accessible (+20) ou recevez également 1 État Sonné. |
| 11–15 | Marche de la mort : vos pas sèment la mort sur votre passage. Pour les 1d10 prochaines heures, toutes les plantes vivantes près de vous fanent et meurent. |
| 16–20 | Double problème : l'effet du Sort que vous lancez se produit également ailleurs dans un rayon de 1d10 milles. À la discrétion du MJ, dans la mesure du possible, cela devrait entraîner des conséquences. |
| 21–25 | Feu de l'âme : recevez 1 État En flammes, alors que vous êtes enveloppé de flammes impies de la couleur associée à votre Domaine. |
| 26–30 | Propos ésotériques : vous jacassez de façon inintelligible pendant 1d10 Rounds. Pendant ce temps, vous ne pouvez pas communiquer verbalement ni effectuer de Test d'Incantation, mais vous pouvez tout de même agir normalement. |
| 31–35 | Essaim : vous êtes Engagé par une nuée aethyrique de rats, araignées géantes ou autres créatures similaires (au choix du MJ). Utilisez les profils standards pour le type de créature concerné, en ajoutant le Trait de créature Nuée. Après 1d10 Rounds, si elle n'a pas été détruite, la nuée bat en retraite. |
| 36–40 | Poupée de chiffon : vous êtes projeté à 1d10 mètres dans les airs dans une direction aléatoire, subissant 1d10 Points de Blessure à l'atterrissage qui ignorent les Points d'Armure, et recevez l'État À Terre. |
| 41–45 | Membre gelé : l'un de vos membres (déterminé au hasard) gèle sur place pendant 1d10 heures, il est inutile comme s'il avait été Amputé (voir WFJDR, page 180). |
| 46–50 | Vue assombrie : vous perdez le bénéfice du Talent Seconde vue pendant 1d10 heures. Les Tests de Focalisation subissent également une pénalité de −20 pour la durée de l'effet. |
| 51–55 | Clairvoyance chaotique : gagnez une réserve bonus de 1d10 Points de Chance (qui peut dépasser votre limite naturelle). Chaque fois que vous dépensez l'un de ces points, recevez 1 Point de Corruption. Tous les Points restant à la fin de la session sont perdus. Le MJ peut également vous attribuer un nombre de symboles inversés égal à votre Bonus de Force Mentale (voir page 45). |
| 56–60 | Lévitation : vous êtes soulevé par les Vents de Magie, flottant 1d10 mètres au-dessus du sol pendant 1d10 minutes. Les autres Personnages peuvent vous déplacer de force, et vous pouvez avancer à l'aide de Sorts, d'ailes ou autres, mais vous revenez continuellement à votre position de lévitation lorsqu'on vous laisse tranquille. Référez-vous aux règles de Chute (voir WFJDR, page 166) pour voir ce qui arrive quand la lévitation prend fin. |
| 61–65 | Régurgitation : vous régurgitez de façon incontrôlable bien plus de vomissures nauséabondes que votre corps ne peut en contenir. Recevez l'État Sonné, qui dure 1d10 Rounds. |
| 66–70 | Secousse du Chaos : toutes les créatures dans un rayon de 1d100 mètres doivent réussir un Test d'Athlétisme Accessible (+20) ou recevoir l'État À Terre. |
| 71–75 | Oubli : le Sort que vous essayez de lancer a disparu de votre mémoire. Si vous l'aviez appris par cœur auparavant, vous ne vous rappelez plus et vous devez à nouveau le mémoriser. Si vous le lancez à l'aide d'un grimoire, la page sur laquelle il est inscrit s'enflamme. Le Sort est perdu et, à moins qu'une action appropriée ne soit entreprise rapidement, le grimoire reçoit un État En flammes. |
| 76–80 | Cœur de traître : les Dieux Sombres vous incitent à commettre une horrible perfidie. Si vous attaquez ou trahissez un allié dans toute la mesure de vos capacités, regagnez tous vos Points de Chance. Si vous faites perdre un Point de Destin à un autre Personnage, gagnez +1 Point de Destin. |
| 81–85 | Terrible affaiblissement : recevez 1 Point de Corruption, 1 État À Terre et 1 État Exténué. |
| 86–90 | Puanteur infernale : vous sentez vraiment mauvais ! Vous recevez le Trait de créature Perturbant (voir WFJDR, page 341), et probablement l'inimitié de toute personne ayant de l'odorat. Cet effet dure 1d10 heures. |
| 91–95 | Drain de puissance : vous êtes incapable d'utiliser le Talent vous permettant de lancer des Sorts (en général Magie des Arcanes), pendant 1d10 minutes. |
| 96–00 | Contre-réaction aethyrique : quiconque situé dans un rayon en mètres égal à votre Bonus de Force Mentale, qu'il soit allié ou ennemi, subit 1d10 Points de Blessure qui ignorent le Bonus d'Endurance et les PA, et reçoit 1 État À Terre. S'il n'y a aucune cible à portée, la magie n'a nulle part où aller, donc votre tête explose, vous tuant instantanément. |

**Voir aussi :** [Tableau des Incantations Imparfaites Majeures (LDB)](#tableau-des-incantations-imparfaites-majeures-d100-verbatim), [Tableau des Incantations Imparfaites Mineures (VDM)](#tableau-des-incantations-imparfaites-mineures--révision-vdm-d100-verbatim)

---

## Nouveaux Sorts d'Arcane (VDM)

**Sources RAW :** `VDM 02 l.268`, `l.270`, `l.276-278`, `l.284-286`, `l.292-294`, `l.304-306`, `l.316-318`, `l.326`, `l.328-330`, `l.341-343`, `l.349`, `l.351`, `l.353-355`

VDM ajoute des Sorts d'Arcane, apprenables par un lanceur de **n'importe quel Domaine**. Cadre : ils sont considérés **en tous points comme des Sorts de Domaine** et ne s'apprennent/enseignent qu'entre porteurs du même Talent `Magie des Arcanes`. Plusieurs sont conçus pour renforcer les **Fabriqués** (ex. la bête des marais). *Le détail mécanique de ces sorts relève du catalogue de sorts (`src/data/spells.json`) ; on ne consigne ici que le cadre et la liste des NI.*

> **Verbatim** (l.268) : « Les lanceurs de sorts de n'importe quel Domaine de Magie peuvent apprendre des Sorts d'Arcane. »
> **Verbatim** (l.270) : « Ils ne peuvent être appris et enseignés qu'à ceux partageant le même Talent *Magie des Arcanes* (voir **WFJDR**, page 242) »

| Sort d'Arcane (VDM) | NI | Note (règle) |
|---|---|---|
| Agressivité de la Maresang | 2 | Octroie le Trait *Frénésie* à une bête des marais. |
| Argile fertile | 4 | Une bête des marais régénère le double de Points de Blessure. |
| Décrypter une malédiction | 4 | Révèle si un objet est maudit ; échec au Test d'Intelligence → Exposition Modérée à la Corruption. |
| Effondrement de Fabriqué | 6 | Test opposé Force Mentale/Endurance vs Fabriqué → le rend inerte. |
| Perturber la Magie | 8 | Dissipation agressive : cible un sorcier en train de focaliser un Sort/Rituel ; Test opposé de Force Mentale → son sort échoue + Incantation Imparfaite Mineure. |
| Secourir un serviteur magique | 2 | Soigne un Fabriqué/familier (BEnd Points de Blessure ; double avec +3 DR). |
| Silence | 4 | ZdE (BFM) m sans aucun son ; l'incantation dans la zone subit −3 DR. |
| Varech avarié | 4 | Octroie le Trait *Perturbant* à une bête des marais. |

> **Verbatim** *Perturber la Magie* (l.326) : « Vous disposez d'une forme plus agressive de Dissipation qui cible un sorcier en train de focaliser de la magie pour un Sort ou un Rituel. »
> **Verbatim** *Silence* (l.349 → l.351) : « Ceci perturbe l'incantation qui subit une » … « pénalité de −3 DR. »

**Voir aussi :** [Types de sorts](#types-de-sorts), [Dissipation (ajouts VDM)](#dissipation-ajouts-vdm), [La Magie Rituelle (VDM)](#la-magie-rituelle-nouveau--vdm)

---

## La Magie Rituelle (nouveau — VDM)

**Sources RAW :** `VDM 02 l.363`, `l.369`, `l.379`, `l.385`, `l.387`, `l.389`, `l.391`

Nouveauté VDM : les **Rituels** sont des sorts puissants et complexes dont l'incantation dépend souvent d'un environnement particulier et de composants rassemblés ; opérations dangereuses exigeant de concentrer de grandes quantités de magie et de **renoncer à une partie de soi**. Un Rituel peut être commencé **depuis un grimoire** (si le Domaine est possédé, deux mains libres) mais son **NI est alors quatre fois** la normale.

> **Verbatim** (l.369) : « Le NI du Rituel est alors quatre fois ce qu'il serait en temps normal. »

**Anatomie d'un Rituel (VDM 02 l.377-393) :**
- **NI** : comme les Sorts, mais les Rituels demandent bien plus d'énergie.
- **Type** : Domaine(s) autorisé(s) — un lanceur hors de ces Domaines ne peut pas y prendre part.
- **PX d'apprentissage** : coût en PX pour mémoriser le Rituel.
- **Composants** : **non facultatifs** (contrairement aux Sorts) — nécessaires et **consommés** durant le Rituel.
- **Conditions** : exigences environnementales (lieu précis, forte concentration d'énergie magique…).
- **Sacrifices** : le sorcier se défait d'une partie de lui-même au début du Rituel (souvent un risque de blessure, parfois davantage).
- **Conséquences** : une fois entamé, le Rituel doit être achevé, sinon les conséquences décrites se produisent.
- **Description** : effets du Rituel.

> **Verbatim** (l.385) : « **Composants :** les Composants limitent les risques d'Incantation Imparfaite comme pour les Sorts, mais ils ne sont pas facultatifs. Pour que le Rituel fonctionne, les Composants sont donc nécessaires et consommés durant celui-ci. »

**Voir aussi :** [Rituels — liste (VDM)](#rituels--liste-vdm), [Nouvelles Activités magiques (VDM)](#nouvelles-activités-magiques-vdm), [Composants / Ingrédients](#composants--ingrédients)

---

## Rituels — liste (VDM)

**Sources RAW :** `VDM 02 l.398`, `l.414`, `l.430`, `l.497`, `l.537`, `l.549`, `l.567`, `l.588`, `l.604`, `l.620`, `l.640`, `l.663`, `l.681`, `l.700`, `l.718`, `l.736`, `l.752`

Liste des Rituels VDM (NI / Type / PX d'apprentissage lus dans chaque bloc de règles ; *les descriptions complètes relèvent du catalogue*). Bien noter les NI **variables** (Force Mentale de l'entité, Points de Blessure de la bête).

| Rituel | NI | Type | PX | Effet (résumé) |
|---|---|---|---|---|
| Art de la malédiction | 50 (25) | N'importe quel Domaine (réduit : Sorcellerie/Démonologie/Nécromancie/Chaos) | 200 (100) | Imprègne un objet d'un bienfait + méfait. Sacrifice : 1 PB définitif + Exposition Modérée à la Corruption. |
| Corrompre une pierre gardienne | 60 | N'importe quel Domaine sombre | 450 | Corrompt une pierre gardienne ; interrompt la ligne de force (les hauts elfes de Saphery traquent les responsables). |
| Créer un Fabriqué | 60 | N'importe quel Domaine | 400 | Anime une forme brute en Fabriqué (profil ci-dessous) ; Traits additionnels = +NI. |
| Créer un familier | 45 | N'importe quel Domaine | 250 | Crée un familier (pouvoir/sorts/combat). Sacrifice définitif : 1 PB, Destin ou Résilience. 2ᵉ familier : NI 80, 2 points. |
| Créer une pierre de pouvoir | 64 | N'importe quel Domaine des Huit Vents | 400 | Produit une pierre de pouvoir du Domaine. Jonction tellurique/Appui arcanique → NI ÷ 2. |
| Créer une propriété de pierre gardienne | 40 | N'importe quel Domaine | 300 | Crée un effet Amplification/Isolation/Atténuation/Réfraction sur une pierre gardienne active. |
| Les Faux croisées | Force Mentale de l'entité | Domaine de la Mort | 400 | Grave un seuil bloquant les morts-vivants (Test de Calme/Résistance Très difficile pour passer). |
| Graver une pierre d'ogham | 50 | N'importe quel Domaine | 450 | Crée une pierre d'ogham (Attraction/Isolation/Atténuation). |
| Imprégner un bâton | 35 | N'importe quel Domaine des Huit Vents | 100 | Enchante un bâton de combat / une baguette en métal. Sacrifice : 1 Point de Chance ou Détermination. |
| Invocation de démon | Force Mentale du démon | Domaine de la Démonologie | 400 | Invoque un démon dans un *Octogramme* préparé ; reste BInt jours. Bonus +3 DR selon les recherches sur son nom. |
| Invocation de l'élémentaire incarné de la Mort | 90 | Domaine de la Mort | 500 | Fait éclore un élémentaire incarné de la Mort d'un sablier d'os de monarque. |
| Invocation de Jack des Cendres | 85 | Domaine du Feu | 500 | Convoque un élémentaire incarné du Feu (bûcher). |
| Invocation du Prédateur sanglant | 85 | Domaine de la Bête | 500 | Convoque un élémentaire incarné de la Bête (totem d'os et de peaux). |
| Lever une malédiction | 40 | N'importe quel Domaine | 200 | Lève une malédiction décryptée ; une arme conserve son Atout *Magique*. |
| Lier une bête monstrueuse | égal aux Points de Blessure de la Bête | Domaine de la Bête | 400 | Asservit une bête (BFM jours) via Test opposé de Force Mentale. |
| Lier un esprit à une pierre de pouvoir | 32 | N'importe quel Domaine des Huit Vents | 600 | Lie un élémentaire mineur/esprit à une pierre de pouvoir. Jonction/Appui → NI ÷ 2. |
| Matérialiser le marais-vivant | 40 | Mort, Vie, Ombres, Magie naturelle, Sorcellerie | 400 | Assemble une bête des marais (Fabriqué), vit BFM jours. |

> **Verbatim NI variable** (l.718) : « **NI :** égal aux Points de Blessure de la Bête **Type :** Domaine de la Bête »
> **Verbatim NI variable** (l.567) : « **NI :** Force Mentale de l'entité **Type :** Domaine de la Mort **PX d'apprentissage :** 400 »

**Voir aussi :** [La Magie Rituelle (VDM)](#la-magie-rituelle-nouveau--vdm), [Créer un Fabriqué (VDM)](#créer-un-fabriqué--profil--traits-de-fabriqué-vdm), [Créer un familier (VDM)](#créer-un-familier--traits-de-familier-vdm)

---

## Créer un Fabriqué — profil & Traits de Fabriqué (VDM)

**Sources RAW :** `VDM 02 l.444`, `l.463-466` (profil), `l.468`, `l.470`, `l.472` (titre), `l.474-493` (table)

Le Rituel *Créer un Fabriqué* (NI 60, cf. liste) façonne un corps de matériaux bruts (automate de métal, marionnette, amas organique, armure vide…). Profil par défaut d'un Fabriqué :

> **Verbatim** (l.444) : « Par défaut, un Fabriqué a le profil suivant : »

| M | CC | CT | F | E | I | Ag | Dex | Int | FM | Soc | B |
|---|----|----|----|----|----|----|-----|-----|----|-----|----|
| 4 | 25 | – | 45 | 45 | 10 | 20 | 10 | – | – | – | 32 |

**Traits :** Arme +8, Fabriqué, Insensible à la douleur, Instable, Taille (Grande).

Ajouter des Traits de créature augmente le NI du Rituel (force/résistance plus faciles, manœuvrabilité plus difficile) :

**Traits de Fabriqué (modificateur de NI, recopié verbatim VDM 02 l.474-493) :**

| Trait | NI |
|---|---|
| Brutal | +5 |
| Champion | +10 |
| Coriace | +10 |
| Cornes (BF +3) | +5 |
| Endurant | +5 |
| Foulée | +20 |
| Grand | +10 |
| Grimpant | +20 |
| Increvable | +10 |
| Rapide | +20 |
| Se cabrer | +5 |
| Taille (Minuscule) | −20 |
| Taille (Très petite) | −15 |
| Taille (Petite) | −10 |
| Taille (Moyenne) | −5 |
| Taille (Énorme) | +60 |
| Taille (Monstrueuse) | +120 |
| Vol (20) | +30 |

> **Verbatim** (l.468) : « **Traits :** Arme +8, Fabriqué, Insensible à la douleur, Instable, Taille (Grande) »

**Voir aussi :** [Rituels — liste (VDM)](#rituels--liste-vdm), [Élémentaires mineurs (VDM)](#élémentaires-mineurs-vdm)

---

## Élémentaires mineurs (VDM)

**Sources RAW :** `VDM 02 l.450`, `l.452`, `l.454`, `l.456`, `l.458`

Les élémentaires mineurs et esprits de la nature stupides sont considérés comme des **Fabriqués** ; leur convocation suit le Rituel *Créer un Fabriqué* avec ces changements :
- Traits décidés comme pour un assemblage ; s'ils n'occupent pas d'enveloppe, le **NI total est doublé**.
- Ils ont le Trait de créature **Magique**, le Talent **Empreint de Magie (Vent)** correspondant au Vent d'invocation, et le Trait **Taille (Petite)**.
- À la manifestation, l'invocateur fait un **Test opposé de Force Mentale/Force** pour le contrôler ; incontrôlés, ils réagissent au gré du MJ.
- Ils vivent **(Bonus de Force Mentale) jours** ; en Saturation Élevée/Extrême, durée de vie **doublée**. Un élémentaire mineur peut être **lié à une pierre de pouvoir** (Rituel dédié) pour rester sur le plan matériel.

> **Verbatim** (l.450) : « Si les élémentaires mineurs n'ont pas besoin d'occuper une enveloppe, les matérialiser demande plus de Magie. Le NI total est alors doublé. »
> **Verbatim** (l.458) : « La créature vit un nombre de jours égal au Bonus de Force Mentale de l'invocateur. Tant que l'élémentaire mineur se trouve dans une zone de Saturation environnementale Élevée ou Extrême, sa durée de vie est doublée. »

**Voir aussi :** [Créer un Fabriqué (VDM)](#créer-un-fabriqué--profil--traits-de-fabriqué-vdm), [Rituels — liste (VDM)](#rituels--liste-vdm)

---

## Créer un familier — Traits de familier (VDM)

**Sources RAW :** `VDM 02 l.501`, `l.505`, `l.513`, `l.515`, `l.520` (titre), `l.522-533` (table) · `VDM 13 l.189`, `VDM 13 l.201`, `VDM 13 l.203-210` (table), `VDM 13 l.292-359` (apparences)

Le Rituel *Créer un familier* (NI 45) imprègne un **réceptacle** (marionnette, chat, petit squelette, grimoire… ou une idée/concept — dans ce cas **NI doublé**) d'une part de l'essence du sorcier. On obtient un familier de **pouvoir**, de **sorts** ou de **combat** — ce sont des Personnages à part entière, obligés de protéger et obéir. **Sacrifice définitif** : au choix 1 Point de Blessure, de Destin ou de Résilience. Un **second familier** porte le NI à **80** et exige **2** de ces points.

> **Verbatim** (l.505) : « Durant le Rituel, le lanceur de sorts doit définitivement abandonner au choix 1 Point de Blessure, de Destin ou de Résilience. »
> **Verbatim** (l.513) : « Le NI passe à 80 et les Sacrifices exigent 2 Points de Blessure, de Destin ou de Résilience. »

Changer la forme du familier modifie le NI :

**Traits de familier (modificateur de NI, recopié verbatim VDM 02 l.522-533) :**

| Trait | NI |
|---|---|
| Amphibie | +20 |
| Foulée | +10 |
| Infravision | +5 |
| Protection (10+) | +30 |
| Sans bras | −10 |
| Sans odorat | −5 |
| Sans parole | −10 |
| Taille (Minuscule) | −10 |
| Taille (Très petite) | −5 |
| Vol (20) | +20 |

**Catégories et Domaine.** Les trois catégories sont mécaniquement distinctes (`VDM 13 l.189`) : **combat** = garde du corps du créateur, **pouvoir** = seconde son maître (lancement de sorts, compréhension de la magie), **sorts** = magicien de plein droit. Le Domaine du lanceur décide des catégories qui lui sont accessibles et de l'apparence habituelle.

**DOMAINES ET FAMILIERS (recopié verbatim `VDM 13 l.203-210`) :**

| Domaine | Apparence habituelle du familier | Catégorie de familier |
|---|---|---|
| Un des Domaines de Collège | Variable, voir page 182 | Combat, pouvoir ou sorts |
| Domaine de la Sorcellerie | Animal de compagnie | Pouvoir |
| Domaine de la Magie naturelle | Animal de compagnie | Pouvoir |
| Domaine de la Nécromancie | Petit fabriqué mort-vivant | Combat ou pouvoir |
| Domaine de la Démonologie ou du Chaos | Entité démoniaque toute petite | Combat, pouvoir ou sorts |

> **Verbatim** (`VDM 13 l.201`) : « Partez du principe qu'ils sont rarement plus grands qu'un chat domestique replet. Les familiers de combat sont un peu plus grands, approchant la taille d'un halfling. »
> **Verbatim** (`VDM 02 l.515`) : « Par défaut, on suppose que les familiers ont une apparence humanoïde. »

**Apparences par Vent.** Ce défaut humanoïde est précisé par `VDM 13 l.292-359` (« Apparences des familiers ») : une forme décrite pour chacune des 24 cases 8 Vents (*Hysh*, *Chamon*, *Ghyran*, *Azyr*, *Ulgu*, *Shyish*, *Aqshy*, *Ghur*) × 3 catégories (combat, pouvoir, sorts) — ex. `VDM 13 l.339` (*Shyish*, combat) : « Un corbeau étrangement grand et puissant avec des yeux améthyste. » Les 24 descriptions vivent verbatim dans [`catalogue-creatures.md`](catalogue-creatures.md) (§ `[VDM 13] Créatures magiques`).

**Voir aussi :** [Rituels — liste (VDM)](#rituels--liste-vdm), [Nouvelles Activités magiques (VDM)](#nouvelles-activités-magiques-vdm)

---

## Nouvelles Activités magiques (VDM)

**Sources RAW :** `VDM 02 l.769`, `l.777`, `l.783`, `l.787-790`, `l.794`, `l.796`, `l.798`

VDM ajoute des Activités disponibles entre deux aventures pour les lanceurs de sorts (les Activités de confection d'objets magiques restant dans *Archives de l'Empire Vol. II*).

- **Accomplir un Rituel** : mener un Rituel en Activité, dans un lieu propice (Saturation magique Élevée/Extrême aisée à trouver si MJ + Joueur d'accord). Avantage : le **NI du Rituel est réduit de moitié (arrondi à l'entier supérieur)** ; risque : les effets peuvent s'estomper au retour à l'aventure, ou les ennemis prendre des contre-mesures.
- **Améliorer un familier** : le créateur choisit cette Activité et fait un **Test de Recherche Difficile (−20)** ; en cas de succès, le familier peut alors entreprendre une Activité (Entraînement, Apprentissage particulier — sauf Talents Béni/Invocation/Âme pure —, Entraînement à une arme inhabituelle ou Test d'objets magiques selon son type).
- **Brasser une potion** : suit le procédé de fabrication ; requiert tous les ingrédients (ou *Passer commande* / *Réunir des ingrédients*) et l'accès à un **laboratoire**, sauf Talent `Concocter`.
- **Réunir des ingrédients** : passer une semaine dans un lieu adéquat pour rassembler des ingrédients de potions ; réessayable via une seconde Activité en cas d'échec.

> **Verbatim** (l.777) : « Afin de représenter ce second avantage, le NI du Rituel est réduit de moitié (arrondi à l'entier supérieur). »
> **Verbatim** (l.783) : « Pour améliorer son familier, le sorcier qui l'a créé doit choisir cette Activité et effectuer un Test de **Recherche Difficile (−20)**. »

**Voir aussi :** [La Magie Rituelle (VDM)](#la-magie-rituelle-nouveau--vdm), [Créer un familier (VDM)](#créer-un-familier--traits-de-familier-vdm)

---

## Saturation environnementale (niveaux d'intensité)

**Sources RAW :** `VDM 14 l.13-34`

Quand la nature absorbe la magie plus vite qu'elle ne se dissipe, l'environnement se **sature**. La Saturation est classée en **cinq niveaux** : Basse, Normale, Élevée, Extrême, Corrompue. La magie terrestre s'équilibre rarement par couleur : selon la configuration des lieux, un à deux Vents prédominent et déterminent les Effets de Saturation. Des effets de Vents différents peuvent coexister là où plusieurs couleurs sont majoritaires. En temps normal la Saturation **augmente d'1 niveau par an** ; une Tempête de Magie peut la faire grimper brusquement, une ligne de force menant au Grand Vortex peut la faire baisser. Dans une région où un Vent souffle fort, suivre la progression **par couleur** : celle qui a la plus forte saturation détermine le niveau de la région.

Nombre d'Effets de Saturation par niveau :

| Niveau | Effets de Saturation |
|---|---|
| **Basse** | Pas d'Effets de Saturation |
| **Normale** | Pas d'Effets de Saturation |
| **Élevée** | 1 à 2 Effets de Saturation |
| **Extrême** | 3 à 4 Effets de Saturation |

> **Verbatim** (l.17) : « **Élevée :** 1 à 2 Effets de Saturation **Extrême :** 3 à 4 Effets de Saturation »

**Règles d'Incantation (modificateurs de DR selon le niveau)** — toute la magie terrestre ambiante est utilisable par tous les lanceurs de sorts :

- **Basse** (régions pauvres en magie) : **−1 DR** aux Tests d'Incantation **et** de Focalisation de **tous** les Domaines.
- **Normale** : aucun modificateur.
- **Élevée** : **+1 DR** aux Tests d'Incantation **et** de Focalisation pour le ou les **Domaines prépondérants**.
- **Extrême** : **+2 DR** en Incantation pour le ou les Domaines prédominants et **+1 DR** pour tous les autres Domaines (la prose ne mentionne l'Extrême qu'en Incantation ; le *Résumé des phénomènes arcaniques* y ajoute **+1 DR en Focalisation** selon le vent dominant).
- **Corrompue** : voir la [Corruption environnementale](#corruption-environnementale) ci-dessous et le *Résumé* (« +2/+1 DR Domaine de la Magie noire ou du Chaos », exposition mineure à la corruption).

> **Verbatim** (l.26) : « les lanceurs de sorts reçoivent +1 DR à leurs Tests d'Incantation et de Focalisation s'ils se servent du ou des Domaines de Magie prépondérants »
> **Verbatim** (l.26) : « Là où elle est Extrême, les Tests d'Incantation reçoivent un bonus de +2 DR pour le ou les Domaines prédominants et +1 DR pour tous les autres Domaines. »
> **Verbatim** (l.26) : « Une Saturation Basse, c'est-à-dire les régions pauvres en magie, impose une pénalité de −1 DR aux Tests d'Incantation et de Focalisation de tous les Domaines. »

**Effets de Saturation environnementale par Vent** (l.34) — les effets en *italique* apparaissent en premier ; ceux en **gras** ne se rencontrent qu'au niveau Extrême :

| Vent | Environnements sensibles | Effets de Saturation | Surnoms |
|---|---|---|---|
| **Ghyran** (Vie) | Forêts, rivières, terres agricoles, lacs, sources, jungles | *Croissance végétale* ; air embrumé ; animaux sociables ; **arbres conscients** | Les Seins maternels, l'Océan de verdure |
| **Azyr** (Cieux) | Océans, rivières, montagnes, lacs, tours | *Forte pluie* ; jacinthes des bois ; nuées d'oiseaux ; **orages violents** | La Tempête de l'aigle, la Bagarre rugissante |
| **Shyish** (Mort) | Champs de batailles, déserts, cimetières, marais, marécages, cavernes | *Calme anormal* ; plantes flétries ; nuages de corbeaux ; **apparitions fantomatiques** | La Cueillette des corbeaux, le Voile mortel |
| **Chamon** (Métal) | Montagnes, mines, vallées, villages, régions volcaniques | *Pression atmosphérique élevée* ; orchidées des montagnes ; les animaux se disputent et font des provisions ; **sol ferrugineux** | La Couverture du mineur, la Lourde Bataille |
| **Hysh** (Lumière) | Plaines, déserts, toundra, villages, littoraux, lacs | *Ciel dégagé* ; chants d'oiseaux harmonieux ; ail des ours ; **lumière aveuglante** | Le Rayonnement de la jouvencelle, les Rayons scintillants |
| **Ulgu** (Ombres) | Vallées, marais, villages, forêts, grottes | *Brouillard épais* ; champignons hallucinogènes ; animaux silencieux ; **illusions dans le brouillard** | La Brume du filou, la Purée de pois tourneboulante, le Méli-mélo mystérieux |
| **Ghur** (Bête) | Toundra, forêts, collines, terres agricoles, plaines, jungles | *Animaux sauvages* ; buissons ronceux ; vents hurlants ; **animaux gigantesques** | Le Hurlement de rage, le Râtelier du cerf |
| **Aqshy** (Feu) | Déserts, jungles, villages, régions volcaniques | *Vague de chaleur* ; grandes orties ; animaux irascibles ; **feux de forêt soudains** | La Fureur de la comète, la Sécheresse ardente, le Bûcher du sorcier |

**Voir aussi :** [Test d'incantation](#test-dincantation), [Focalisation (Test étendu)](#focalisation-test-étendu), [Grand Vortex](#grand-vortex), [Résumé des phénomènes arcaniques](#résumé-des-phénomènes-arcaniques-table-verbatim)

---

## Corruption environnementale

**Sources RAW :** `VDM 14 l.37-75`

L'énergie magique stagnante se corrompt : ce n'est qu'une question de temps dès qu'une région atteint le niveau **Extrême**. Deux fois par an, à son périgée, **Morrslieb** corrompt créatures et terre (dans l'Empire : **Geheimnisnacht** et **Hexensnacht**). Lors de ces nuits, une zone de Saturation Extrême a **10 % de chance d'être corrompue**. Le MJ choisit alors la nature — **chaotique** ou **nécromantique**.

> **Verbatim** (l.39) : « une zone de Saturation Extrême a 10 % de chance d'être corrompue »

**Corruption chaotique** (l.43-58) : lancer **deux fois** sur le Tableau de Corruption chaotique. Les lanceurs de **Magie du Chaos** gagnent **+1 DR** en Incantation et Focalisation.

> **Verbatim** (l.45) : « Les lanceurs de sorts qui se servent de la Magie du Chaos ont un bonus de +1 DR à leurs Tests d'Incantation et de Focalisation. »

| Lancer | Effet                 | Lancer | Effet                               |
|--------|-----------------------|--------|-------------------------------------|
| 1–5    | Colonnes de<br>crânes | 51–55  | Arbres<br>cristallisés              |
| 6–10   | Ciel de plomb         | 56–60  | Terre multicolore                   |
| 11–15  | Pluie de sang         | 61–65  | Eau<br>phosphorescente              |
| 16–20  | Animaux enragés       | 66–70  | Foudre verte                        |
| 21–25  | Herbe<br>tranchante   | 71–75  | Temps<br>inconstant                 |
| 26–30  | Arbres<br>murmurants  | 76–80  | Plantes<br>pourrissantes            |
| 31–35  | Fleurs toxiques       | 81–85  | Arbres malades                      |
| 36–40  | Voix attirantes       | 86–90  | Eau putride                         |
| 41–45  | Animaux sans<br>poils | 91–95  | Nuées de<br>mouches<br>boursouflées |
| 46–50  | Vrilles de chair      | 96–00  | Pustules en<br>germination          |

**Corruption nécromantique** (l.60-75) : lancer **deux fois** sur le Tableau de Corruption nécromantique. Les lanceurs de **Magie noire** gagnent **+1 DR** en Incantation et Focalisation ; les morts non bénis par Morr se relèvent en zombies et squelettes.

> **Verbatim** (l.62) : « Les lanceurs de sorts qui emploient la Magie noire reçoivent un bonus de +1 DR à leurs Tests d'Incantation et de Focalisation. »

| Lancer | Effet                      | Lancer | Effet                      |
|--------|----------------------------|--------|----------------------------|
| 1–5    | Forêt fossilisée           | 51–55  | Tas d'ossements            |
| 6–10   | Champs stériles            | 56–60  | Ciel dépourvu de<br>soleil |
| 11–15  | Loups funestes             | 61–65  | Pluie de cendres           |
| 16–20  | Chauves-souris<br>vampires | 66–70  | Nuées d'esprits            |
| 21–25  | Eau<br>empoisonnée         | 71–75  | Meutes de<br>goules        |
| 26–30  | Morts qui<br>marchent      | 76–80  | Marais fétide              |
| 31–35  | Terre noircie              | 81–85  | Froid glacial              |
| 36–40  | Plantes flétries           | 86–90  | Animaux<br>squelettiques   |
| 41–45  | Nuées d'insectes           | 91–95  | Nuées de<br>chauves-souris |
| 46–50  | Oiseaux<br>charognards     | 96–00  | Brume effroyable           |

**Voir aussi :** [Saturation environnementale](#saturation-environnementale-niveaux-dintensité), [Influences Malfaisantes (le « 8 »)](#influences-malfaisantes-le--8-), [Magie Noire (Dhar)](#magie-noire-dhar), [Malepierre](#malepierre)

---

## Tempêtes de Magie

**Sources RAW :** `VDM 14 l.86-115`

Certaines conjonctions célestes provoquent des **Tempêtes de Magie** qui permettent de lancer des sorts extrêmement puissants ; généralement limitées à une zone réduite, elles se résorbent vite mais laissent une nature sursaturée (corruption, monstres éveillés). Tous les deux ou trois siècles, une tempête de grande ampleur déferle sur le monde ; les conflits gravitent alors autour des [appuis arcaniques](#appuis-arcaniques).

**Règles d'Incantation :** pendant une Tempête, les Tests d'Incantation reçoivent **+2 DR** (cumulatifs avec les autres bonus). À **chaque Round**, lancer **1d10** sur le tableau de Flux magique : les sorts du Domaine indiqué bénéficient **automatiquement d'une Incantation Critique** (à condition que le Test d'Incantation réussisse). Un sorcier qui **contrôle un appui arcanique** peut tenter un **Test de Focalisation Difficile (−20)** pour choisir le Flux magique de toute la région.

> **Verbatim** (l.94) : « Pendant une Tempête de Magie, les Tests d'Incantation sont améliorés avec +2 DR (qui s'ajoutent à d'autres bonus). »
> **Verbatim** (l.94) : « Les sorciers qui contrôlent un appui arcanique peuvent essayer un Test de **Focalisation Difficile (−20)** afin de choisir un Flux magique pour l'ensemble de la région. »

| 1d10 | Flux magique |
|------|--------------|
| 1 | Domaine de la Bête |
| 2 | Domaine de la Mort |
| 3 | Domaine du Feu |
| 4 | Domaine des Cieux |
| 5 | Domaine du Métal |
| 6 | Domaine de la Vie |
| 7 | Domaine de la Lumière |
| 8 | Domaine des Ombres |
| 9 | Sorcellerie |
| 10 | Magie noire et Magie du Chaos |

> ⚠ La ré-extraction Marker fusionne les entrées **8-9** (l.105-107 : cellule « Domaine des Ombres<br>Sorcellerie » sur la ligne 8, ligne 9 vide). Réparti ici selon la table WFRP4 (Ombres = 8, Sorcellerie = 9) ; à re-vérifier au `Source/` si le mot compte.

**Règles environnementales :** une Tempête **augmente instantanément la Saturation d'1 niveau**. À chaque Sort lancé durant la Tempête, le MJ lance **2d10** et ajoute des effets de **[Surincantation](#surincantation)** (à sa discrétion, pas nécessairement à l'avantage du lanceur) — ces effets s'ajoutent **après** que le lanceur a choisi les siens.

> **Verbatim** (l.111) : « Une Tempête de Magie augmente instantanément la Saturation environnementale de la région d'un niveau »
> **Verbatim** (l.113) : « le MJ lance 2d10 et se sert du résultat pour rajouter des effets de Surincantation, décrits à la page 23 »

**Voir aussi :** [Incantation Critique](#incantation-critique), [Surincantation](#surincantation), [Focalisation (Test étendu)](#focalisation-test-étendu), [Appuis arcaniques](#appuis-arcaniques), [Saturation environnementale](#saturation-environnementale-niveaux-dintensité)

---

## Lignes de force et pierres gardiennes

**Sources RAW :** `VDM 14 l.118-137`

Les **lignes de force** sont des axes de puissance magique. Les **naturelles** apparaissent le long des rivières, chaînes de montagnes et autres milieux où l'attraction sensible draine les Vents (canalisées par les « Racines du monde » ou la « Toile Géomantique »). Les **artificielles** — réseau de **pierres gardiennes** et cercles de pierres levées créé par elfes, nains et slanns — acheminent l'excédent de magie vers le [Grand Vortex](#grand-vortex). Les pierres gardiennes sont taillées dans une roche magmatique riche en quartz qui entre en résonance avec l'énergie qui la traverse.

**Règles d'Incantation :** ceux qui lancent des sorts **à proximité d'une ligne de force** reçoivent **+1 DR** au Test d'Incantation.

> **Verbatim** (l.136) : « ceux qui lancent des sorts à proximité d'une ligne de force reçoivent un bonus de +1 DR à leur Test d'Incantation »

**Règles environnementales** (l.137) : les effets diffèrent selon le type de ligne —
- **Naturelle** : augmente la Saturation environnementale de **+1 niveau par an** dans les régions traversées.
- **Artificielle** : **réduit** la Saturation selon les règles du [Grand Vortex](#grand-vortex).
- La saturation magique d'une ligne naturelle peut être **annulée** par une ligne artificielle traversant la même zone.

> **Verbatim** (l.137) : « Les premières augmentent la Saturation environnementale de +1 niveau par an dans les régions par lesquelles elle passe. Les secondes réduisent la Saturation environnementale selon les règles du Grand Vortex »

**Voir aussi :** [Propriétés des pierres gardiennes](#propriétés-des-pierres-gardiennes), [Nexus de puissance et jonctions telluriques](#nexus-de-puissance-et-jonctions-telluriques), [Grand Vortex](#grand-vortex), [Corruption des lignes de force et pierres gardiennes](#corruption-des-lignes-de-force-et-pierres-gardiennes)

---

## Propriétés des pierres gardiennes

**Sources RAW :** `VDM 14 l.146-179`

La composition minérale d'une pierre gardienne, ses runes et pierres de pouvoir modifient les Vents. Une propriété peut s'appliquer à toute la pierre ou à **un seul de ses parements** (chaque côté d'un même monolithe peut différer).

**Attraction** (l.150-154) — propriété la plus courante : la pierre absorbe la magie et la transmet à la suivante (la première est la « pierre de rassemblement »). Chaque parement peut attirer **une** ligne de force. Là où plusieurs lignes convergent → **Jonction tellurique**. Si l'écoulement n'atteint pas la pierre suivante → **Jonction tellurique saturée** (les Vents s'accumulent et tournoient). Aucun modificateur d'Incantation propre.

> **Verbatim** (l.154) : « Chaque parement de pierre gardienne peut attirer une ligne de force. »

**Réfraction** (l.156-161) — divise la magie brute en ses couleurs. Les Tests de **Focalisation** pour les Domaines enseignés dans les collèges impériaux gagnent **+1 DR** ; **tous les autres Domaines −1 DR**. Quand la pierre réfracte un ou des Vents précis dans une direction, le bonus ne vaut que pour les Domaines liés à ces Vents.

> **Verbatim** (l.160) : « Les Tests de Focalisation réalisés pour des sorts des Domaines enseignés dans les collèges impériaux bénéficient de +1 DR. Tous les autres Domaines reçoivent un malus de −1 DR. »

**Atténuation** (l.163-167) — absorbe l'excédent de magie. Tests d'**Incantation à proximité −2 DR**, mais Tests de **Dissipation +2 DR**. Empêche les Jonctions telluriques d'être saturées. (À la longue, la pierre sature et exige un rituel de purification.)

> **Verbatim** (l.167) : « Les Tests d'Incantation réalisés à proximité de la pierre reçoivent un malus de −2 DR, mais les Tests de Dissipation reçoivent un bonus de +2 DR. »

**Isolation** (l.169-173) — renvoie l'énergie vers sa source (Oracles d'Albion, elfes sylvains ; disposées en groupe/cercle). La **Saturation environnementale et la Corruption ne se propagent pas** dans les lignes créées par des pierres d'isolation.

> **Verbatim** (l.173) : « La Saturation environnementale et la Corruption (page 198) ne se propagent pas dans les lignes de force créées par des pierres d'isolation. »

**Amplification** (l.175-179) — accroît l'énergie à proximité. Ceux qui lancent un sort près d'une pierre d'amplification reçoivent **+2 DR** en Incantation. Si la pierre n'est **pas** sur une ligne de force opérationnelle, la Saturation de la région augmente de **+1 niveau par an**.

> **Verbatim** (l.179) : « ceux qui lancent un sort à proximité d'une pierre d'amplification reçoivent +2 DR à leurs Tests d'Incantation. »

**Voir aussi :** [Lignes de force et pierres gardiennes](#lignes-de-force-et-pierres-gardiennes), [Dissipation / Contre-sort](#dissipation--contre-sort), [Nexus de puissance et jonctions telluriques](#nexus-de-puissance-et-jonctions-telluriques), [Cercles d'oghams](#cercles-doghams)

---

## Cercles d'oghams

**Sources RAW :** `VDM 14 l.182-187`

Les cercles de « pierres d'oghams » (monolithes imprégnés de *Ghyran*, gravés de triskèles par les anciens Belthani) ont développé des propriétés divines en plus de celles d'origine.

**Règles d'incantation :** les sorts du **Domaine de la Vie** et de la **Magie naturelle** lancés au sein d'un cercle druidique reçoivent **+1 DR** aux Tests d'Incantation **et** de Focalisation ; ce bonus est **cumulable** avec d'autres.

> **Verbatim** (l.186) : « les Sorts du Domaine de la Vie et de la Magie naturelle lancés au sein d'un cercle druidique reçoivent +1 DR à leurs Tests d'Incantation et de Focalisation. Ce bonus peut s'ajouter à d'autres. »

**Propriété de pierre gardienne :** une pierre d'ogham peut sinon recevoir **une seule** [propriété de pierre gardienne](#propriétés-des-pierres-gardiennes) ; les cercles dotés de l'**Isolation** sont souvent disposés autour d'une source de corruption.

**Voir aussi :** [Magie Naturelle](#magie-naturelle), [Propriétés des pierres gardiennes](#propriétés-des-pierres-gardiennes)

---

## Corruption des lignes de force et pierres gardiennes

**Sources RAW :** `VDM 14 l.215-231`

Une ligne se corrompt quand des pierres gardiennes sont abîmées ou détruites : elle devient une **ligne de *Dhar*** charriant les huit couleurs en flot brut, où la magie s'accumule en **réserves de *Dhar***. Les pierres gardiennes profanées par les hommes-bêtes deviennent des « pierres des hardes ».

**Lignes de *Dhar* :** les lanceurs gagnent **+1 DR** en Incantation avec la **Sorcellerie**, la **Magie noire** ou le **Chaos** à proximité ; ces lignes comptent comme **Influences malveillantes**.

> **Verbatim** (l.221) : « les lanceurs de sorts gagnent +1 DR à leurs Tests d'Incantation quand ils se servent de la Sorcellerie, de la Magie noire ou du Chaos à proximité d'une ligne de *Dhar* »

Incidence de la corruption selon la propriété de la pierre (l.223-229) :

| Propriété corrompue | Effet |
|---|---|
| **Attraction** | La magie non évacuée forme une **réserve de *Dhar* en une semaine** autour de la pierre. |
| **Réfraction** | Mélange des couleurs → **ligne de *Dhar* en une journée**. |
| **Atténuation** | La pierre saturée devient un **réceptacle de *Dhar*** (Influence malveillante). |
| **Isolation** | Brèches et fuites localisées. |
| **Amplification** | **Double** le taux de magie aux jonctions saturées → réserve de *Dhar* **en 4 jours** (au lieu d'une semaine). |

> **Verbatim** (l.229) : « ces pierres doublent le taux de magie aux jonctions saturées et deviennent des réserves de *Dhar* (en 4 jours au lieu d'une semaine). »

**Voir aussi :** [Magie Noire (Dhar)](#magie-noire-dhar), [Sorcellerie](#sorcellerie-domaine-hors-collège), [Corruption des Nexus et Appuis arcaniques (Morrslieb)](#corruption-des-nexus-et-appuis-arcaniques-morrslieb)

---

## Nexus de puissance et jonctions telluriques

**Sources RAW :** `VDM 14 l.233-249`

Les **nexus de puissance** se situent à l'intersection de plusieurs lignes de force (le plus souvent une pierre gardienne ou un cercle, parfois un point de maillage de la **Toile Géomantique**). En règle générale stables, car la magie y transite continuellement vers le Vortex.

**Jonctions telluriques :** deux à quatre lignes « d'arrivée » et **une seule** de « sortie » qui fusionnent en une ligne plus puissante. On peut y améliorer sorts et rituels, ou fabriquer des **pierres de pouvoir**. Une sortie interrompue → saturation puis corruption.

**Règles :** un lanceur situé à une Jonction tellurique reçoit un bonus d'Incantation dépendant du **nombre de lignes entrantes**, **réductible** par des pierres à propriété **Atténuation** — généralement **+1 DR**, jusqu'à **+3 DR**.

> **Verbatim** (l.243) : « En règle générale, il est de +1 DR, mais il peut atteindre +3 DR. »

**Toile Géomantique :** un maillage d'énergies telluriques naturelles couvrant la planète (utilisé par les prêtres-mages slanns). **Règles :** un lanceur à un **nexus géomantique** reçoit **+2 DR** aux Tests de **Focalisation**.

> **Verbatim** (l.249) : « les lanceurs de sorts qui se trouvent à un nexus géomantique reçoivent +2 DR à leurs Tests de Focalisation. »

**Voir aussi :** [Lignes de force et pierres gardiennes](#lignes-de-force-et-pierres-gardiennes), [Appuis arcaniques](#appuis-arcaniques), [Focalisation (Test étendu)](#focalisation-test-étendu)

---

## Appuis arcaniques

**Sources RAW :** `VDM 14 l.252-272`

Les **appuis arcaniques** sont des lieux d'énergie si instables qu'on préconise de livrer bataille pour les contrôler. L'appui lui-même est souvent un simple élément du paysage (cercle de pierres, crevasse, geyser) mais son influence peut porter sur des milles.

**Jonctions saturées** (l.256-260) — appui né d'une saturation à l'intersection de lignes interrompues (ou surchargées par une Tempête). **Règles :** bonus d'Incantation de **+2 à +8 DR** selon les conditions de création ; l'**Incantation Critique est deux fois plus probable** (elle survient sur des **doubles** *ou* des réussites **se terminant par 0**) ; la Saturation augmente de **+1 niveau par mois** ; non éliminée dans l'année → la jonction se mue en **réserve de *Dhar***.

> **Verbatim** (l.260) : « les lanceurs de sorts reçoivent un bonus aux Tests d'Incantation qui va de +2 à +8 DR selon les conditions de création de l'appui. »

**Failles du Warp** (l.262-266) — brèches dans le tissu de la réalité (accidents d'incantation, afflux violents). **Règles :** bonus d'Incantation **aléatoire relancé à chaque Round, +1 à +5 DR (1d10/2)** ; comptent comme **Influences malfaisantes** ; le **nombre de démons invoqués est doublé** ; magie non contenue par des pierres gardiennes ou une ligne artificielle → Saturation **+1 niveau par mois**.

> **Verbatim** (l.266) : « les Tests d'Incantation des lanceurs de sorts reçoivent un bonus aléatoire, lancé à chaque Round, qui va de +1 DR à +5 DR (1d10/2) »

**Portails magiques** (l.268-272) — failles ouvertes intentionnellement pour prélever de la magie de l'Aethyr en flux contrôlé. **Règles :** traités comme des failles du Warp, mais ils ne produisent **qu'une seule couleur** de magie et **ne comptent pas** comme Influence malfaisante.

> **Verbatim** (l.272) : « les portails magiques sont considérés comme des failles du Warp, mais ils ne produisent qu'une seule couleur de magie et ne comptent pas comme une Influence malfaisante. »

**Voir aussi :** [Tempêtes de Magie](#tempêtes-de-magie), [Incantation Critique](#incantation-critique), [Influences Malfaisantes (le « 8 »)](#influences-malfaisantes-le--8-), [Corruption des Nexus et Appuis arcaniques (Morrslieb)](#corruption-des-nexus-et-appuis-arcaniques-morrslieb)

---

## Grand Vortex

**Sources RAW :** `VDM 14 l.206-212`

Le Grand Vortex (sur Ulthuan) draine les Vents de Magie du monde via le réseau de lignes de force artificielles.

**Règles :** le Vortex **diminue la Saturation environnementale d'1 niveau par an** dans toute région traversée par des lignes de force **artificielles** — d'où la tendance de ces régions à conserver une quantité de magie **stable**.

> **Verbatim** (l.212) : « le Vortex diminue la Saturation environnementale (page 189) de n'importe quelle région par laquelle transitent des lignes de force artificielles à raison d'1 niveau par an »

**Voir aussi :** [Lignes de force et pierres gardiennes](#lignes-de-force-et-pierres-gardiennes), [Saturation environnementale](#saturation-environnementale-niveaux-dintensité)

---

## Corruption des Nexus et Appuis arcaniques (Morrslieb)

**Sources RAW :** `VDM 14 l.274-279`

À chaque **Hexensnacht** et **Geheimnisnacht**, Morrslieb provoque des tempêtes de magie viciée : des démons franchissent le monde par les appuis arcaniques corrompus et subsistent grâce au *Dhar* accumulé aux nexus. L'influence de Morrslieb ne peut être expurgée que durant ses phases décroissantes.

- **Nexus** — quand Morrslieb est **pleine**, les **jonctions telluriques saturées deviennent des réserves de *Dhar*** ; celles-ci **annulent le Trait de créature Instable**, ajoutent **+2 DR** en Incantation pour les Domaines de la **Sorcellerie, de la Magie noire et du Chaos**, et sont des **Influences malfaisantes**.
- **Appuis arcaniques** — quand Morrslieb est pleine, les **failles du Warp peuvent se transformer en portails du Chaos** et faire apparaître des démons.

> **Verbatim** (l.278) : « Lorsque Morrslieb est pleine, les jonctions telluriques saturées deviennent des réserves de *Dhar*. »
> **Verbatim** (l.279) : « Lorsque Morrslieb est pleine, les failles du Warp peuvent se transformer en portails du Chaos et des démons éventuellement apparaître. »

**Voir aussi :** [Corruption des lignes de force et pierres gardiennes](#corruption-des-lignes-de-force-et-pierres-gardiennes), [Appuis arcaniques](#appuis-arcaniques), [Magie du Chaos — LDB 51](#magie-elfique-qhaysh), [Magie Noire (Dhar)](#magie-noire-dhar)

---

## Résumé des phénomènes arcaniques (table verbatim)

**Sources RAW :** `VDM 14 l.282-305`

Table de synthèse des modificateurs (Incantation / Focalisation / Saturation) et particularités de chaque phénomène.

| Phénomène | Incantation | Focalisation | Saturation | Particularité |
|---|---|---|---|---|
| Ligne de force — **Naturelle** | +1 DR | – | +1 niveau/an | – |
| Ligne de force — **Artificielle** | +1 DR | – | Voir le Grand Vortex | Est reliée au Grand Vortex |
| Pierre gardienne — **Attraction** | – | – | – | Crée une jonction tellurique |
| Pierre gardienne — **Réfraction** | – | +1 DR pour les Domaines des Collèges ; −1 DR pour les autres | – | – |
| Pierre gardienne — **Atténuation** | −2 DR | – | – | +2 DR aux Tests de Dissipation |
| Pierre gardienne — **Isolation** | – | – | Empêche | Ignore le Grand Vortex |
| Pierre gardienne — **Amplification** | +2 DR | – | +1 niveau/an | La ligne de force évacue la saturation |
| **Cercle d'oghams** | +1 DR pour le Domaine de la Vie ou de la Magie naturelle | +1 DR pour le Domaine de la Vie ou de la Magie naturelle | – | Peut posséder une propriété de pierre gardienne |
| **Grand Vortex** | – | – | −1 niveau/an | – |
| Nexus de puissance — **Jonction tellurique** | +1 DR à +3 DR | – | – | – |
| Nexus de puissance — **Toile Géomantique** | – | +2 DR | – | – |
| Nexus de puissance — **Jonction saturée** | +1 à +8 DR ; critiques sur un 0 ou un double | – | +1 niveau/mois | Peut devenir une réserve de Dhar |
| Appui arcanique — **Faille du Warp** | +1 à +5 DR : (1d10/2)/Round | – | +1 niveau/mois | Influence malfaisante |
| Appui arcanique — **Portail magique** | +1 à +5 DR : (1d10/2)/Round | – | +1 niveau/mois | Une unique couleur de magie |
| **Tempête de Magie** | +2 DR, Incantation Critique selon le flux magique | Un Appui arcanique peut contrôler le flux magique | +1 niveau, les Jonctions telluriques peuvent saturer | Flux magique aléatoire lancé à chaque Round |
| Saturation environnementale — **Basse** | −1 DR | −1 DR | – | – |
| Saturation environnementale — **Normale** | – | – | – | – |
| Saturation environnementale — **Élevée** | +1 DR selon le(s) vent(s) dominant(s) | +1 DR selon le(s) vent(s) dominant(s) | 1 à 2 effets | – |
| Saturation environnementale — **Extrême** | +2 DR selon le(s) vent(s) dominant(s), +1 DR pour les autres | +1 DR selon le vent dominant | 3 à 4 effets | – |
| Saturation environnementale — **Corrompue** | +2/+1 DR Domaine de la Magie noire ou du Chaos | +2/+1 DR Domaine de la Magie noire ou du Chaos | 2 corruptions +1 par niveau | Exposition mineure à la corruption |

> ⚠ Table recopiée verbatim (l.284-305) ; les `<br>` de la source ont été aplatis. La ligne **Extrême** ajoute une colonne Focalisation **+1 DR** absente de la prose (l.26, qui ne mentionne l'Extrême qu'en Incantation) — à trancher au `Source/` si le mot compte.

**Voir aussi :** [Saturation environnementale](#saturation-environnementale-niveaux-dintensité), [Lignes de force et pierres gardiennes](#lignes-de-force-et-pierres-gardiennes), [Appuis arcaniques](#appuis-arcaniques), [Grand Vortex](#grand-vortex)

## Bilan de fidélité

### Règles couvertes

| Règle | Source | Statut |
|---|---|---|
| Vents de Magie (8 couleurs, restriction 1 Vent) | LDB 44 l.3-39 | OK |
| Types de sorts (Mineurs/Arcane/Domaine/Chaos) | LDB 46 l.13-15 | OK |
| Mémoriser un sort (PX) | LDB 46 l.17-21 | OK |
| Test d'incantation (Langue Magick, DR ≥ NI) | LDB 46 l.23-25 | OK |
| Compétence avancée (0 avance = pas de test) | LDB 09 | OK |
| Incantation Critique (double réussi) | LDB 46 l.27-32 | OK |
| Maladresse → Imparfaite Mineure | LDB 46 l.84-86 | OK |
| Influence corruptrice → le 8 | LDB 46 l.88-90 | OK |
| Tableau Imparfaites Mineures (20 entrées) | LDB 46 l.33-53 | OK — verbatim |
| Tableau Imparfaites Majeures (20 entrées) | LDB 46 l.55-80 | OK — verbatim |
| Focalisation (Test étendu, NI → 0) | LDB 46 l.129-133 | OK |
| Focalisation Critique (Harmonisation aethyrique) | LDB 46 l.135-137 | OK |
| Maladresse Focalisation élargie (0 terminal) | LDB 46 l.139-141 | OK |
| Interruptions de Focalisation (Calme −20) | LDB 46 l.143-145 | OK |
| Repousser les Vents (armure −1 DR/PA) | LDB 46 l.148-151 | OK |
| Avantages → incantation (pas focalisation) | LDB 46 l.125 | OK |
| Dissipation / Contre-sort (Test opposé) | LDB 46 l.154-156 | OK |
| Dissiper sorts permanents (Test étendu) | LDB 46 l.159-162 | OK |
| Durée (pas de fin volontaire) | LDB 46 l.92-94 | OK |
| Grimoire (NI × 2) | LDB 46 l.96-99 | OK |
| Projectile magique (localisation inversée, dégâts) | LDB 46 l.101-105 | OK |
| Composants (Majeure→Mineure, Mineure→annulée) | LDB 46 l.107-114 | OK |
| Restrictions (parole, unicité, non-cumul, LoS) | LDB 46 l.116-121 | OK |
| Sort de Contact en combat (Corps à corps Bagarre) | LDB 46 l.123-124 | OK |
| Attributs de Domaine — Bête (Peur 1 post-incantation) | LDB 48 l.7 | OK — `domainAfterCast` |
| Attributs de Domaine — Cieux (bypass PA métal + AoE 2 m) | LDB 48 l.105 | OK — `domainMissileMods` / `domainOnHitEffects` |
| Attributs de Domaine — Lumière (Aveuglé + frappe BInt vs Démons/Mort-vivants) | LDB 48 l.302 | OK — `domainOnHitEffects` |
| Attributs de Domaine — Métal (bypass PA métal + bonus = PA ignorés) | LDB 48 l.398 | OK — `domainMissileMods` (bonusFromBypass) |
| Attributs de Domaine — Mort (Exténué sur vivants, cap 1) | LDB 48 l.497 | OK — `domainOnHitEffects` |
| Attributs de Domaine — Ombres (bypass tous PA non magiques) | LDB 48 l.582 | OK — `domainMissileMods` |
| ZdE = diamètre | LDB 47 l.28 | OK |
| Surincantation — Sort (×initial Portée/ZdE/Durée/Cible, +2 DR/pas) | LDB 47 l.13-17 | OK — `engine/overcast.ts` |
| Surincantation — Bénédiction (+6 m / +1 Cible / +6 Rounds FIXE, pas de ZdE) | LDB 41 l.21-27 | OK — `engine/overcast.ts` |
| Surincantation — Miracle (×initial Portée/Durée/Cible, pas de ZdE, « Vous » non augmentable) | LDB 42 l.7-13 | OK — `engine/overcast.ts` |
| Magie Noire / Dhar | LDB 44 l.107-111 | OK |
| Malepierre | LDB 44 l.113-119 | OK |
| Sorcellerie (corruption + Hémorragique + Imparfaite systématique) | LDB 49 l.5-7 | OK |
| Magie Naturelle (composants obligatoires) | LDB 48 l.792-798 | OK |

### Tables d100 transcrites

- Tableau des Incantations Imparfaites Mineures (20 entrées, 01–00) — verbatim LDB 46 l.33-53.
- Tableau des Incantations Imparfaites Majeures (20 entrées, 01–00) — verbatim LDB 46 l.55-80.
- Tableau de la Colère des dieux (LDB 40 l.52-101) → **non transcrit ici** — appartient à `religion.md` (à construire). Implémenté dans `WRATH` (`src/engine/miscast.ts` l.164-206).

### Refs-code couvertes

Toutes les refs `LDB 46 l.XXX` présentes dans `src/engine/magic.ts` et `src/engine/miscast.ts` sont couvertes par une entrée de ce document. La Surincantation (LDB 47/41/42) est implémentée dans `src/engine/overcast.ts` (math source-aware pure) + `effectiveSpellRangeTiles`/`spellTargetCount` (`magic.ts`), alloué/résolu par `castAllocOvercast`/`applyCast`/`overcastTargetCandidates`.

### Écarts / points à vérifier

1. **Magie Elfique (Qhaysh)** : hors périmètre joueur actuellement.
2. **Sorts du Chaos (LDB 51) et Magie noire (LDB 50)** : les règles de Domaine (Démonologie, Nécromancie, Nurgle/Slaanesh/Tzeentch) et leurs sorts ne sont pas couverts par ce fichier — voir catalogue séparé.
3. **EDO sorts Tzeentch** : intégrés dans `src/data/` mais leur règle de Domaine spécifique (EDO) n'est pas encore documentée ici.
4. **Propagation latérale Cieux (AoE 2 m)** (LDB 48 l.105) : déclarée en données (`DomainData.effects`) mais sa mécanique précise (BFM dégâts Projectile magique vers toutes cibles à 2 m sauf porteurs du Talent) mérite vérification dans `triggeredEffects`.
