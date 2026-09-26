# Système de passifs unifié & Corruption

> ⚠️ Fichier GÉNÉRÉ par `node scripts/docs/build-passifs.mjs` (`npm run docs:passifs`) — NE PAS ÉDITER À LA MAIN.

**Périmètre mesuré / angles morts** — sont DÉRIVÉS à chaque génération : les 10 membres de
`PassiveKind` (`src/engine/ops.ts`) et leur commentaire de queue, la table `PASSIVE_CANCELLERS`
(`src/engine/trauma.ts:884`), le mode de combinaison (le seul kind ADDITIF reconnu par
`isAdditiveKind` est `intrinseque`), les 14 branches d'émission du collecteur
`passiveMods` avec leur ligne, les 6 producteurs nommés qu'il appelle, et les
9 documents qui déclarent un champ de passif (def zod + population réelle du `.json`).
**Angles morts** : le catalogue des `GameOp` n'est PAS repris ici — il vit dans
`docs/vocabulaire-mecanique.md`, source unique (une seconde copie divergerait) ; quelles ops sont
effectivement LUES par quel consommateur n'est pas dérivable (le filtrage se fait par type d'op au
point de lecture) ; une branche du collecteur n'est comptée que si elle appelle `out.push` au
PREMIER niveau de la fonction ; le rôle rapporté est la 1re phrase du commentaire du CODE ; la
frontière « ce qui n'est PAS un passif » est de l'ÉDITORIAL fixé dans le script.

Référence du système qui modélise **tout modificateur PASSIF continu** dans **UN seul vocabulaire
d'ops**, lu par **UN seul collecteur**, et **éditable en données** au Codex avec le même éditeur que
les sorts.

> Passif = effet CONTINU, lu à chaque calcul. Ce n'est ni un effet DÉCLENCHÉ (`TriggeredEffect`, qui
> se joue sur un événement — cf. `docs/ajouter-une-mecanique.md`), ni un effet appliqué une fois à
> l'incantation d'un sort. Un passif n'a pas de déclencheur.

## 1. Le vocabulaire — `GameOp`, puis `PassiveMod`

Un passif est une liste de `GameOp` : **le même vocabulaire que les sorts**, catalogué dans
`docs/vocabulaire-mecanique.md` (y chercher l'op AVANT de conclure qu'elle manque). Au runtime, le
collecteur emballe chaque op dans un `PassiveMod = { op, kind?, src?, label? }` (`src/engine/ops.ts`) :
`kind` porte le profil d'annulation ET de combinaison ; `src`/`label` NOMMENT l'entité émettrice
pour l'affichage d'une composante de jet, et ne sont jamais lus par le calcul.

## 2. `PassiveKind` — annulation et combinaison

| `kind` | Ce qu’il désigne | Annulé par | Combinaison |
|---|---|---|---|
| `douleur` | pénalité de douleur (séquelle) : Détermination + Insensible + prothèse 'all' | `determination`, `painless`, `prosthesis-all` | pool non-cumul (meilleur bonus + pire malus) |
| `mobilite` | pénalité de mobilité (séquelle de jambe) : idem + prothèse 'movement' | `determination`, `painless`, `prosthesis-move` | pool non-cumul (meilleur bonus + pire malus) |
| `structurel` | membre perdu : prothèse 'all' SEULE (ni Détermination ni Insensible) | `prosthesis-all` | pool non-cumul (meilleur bonus + pire malus) |
| `sensoriel` | organe perdu : rien | rien | pool non-cumul (meilleur bonus + pire malus) |
| `maladie` | symptôme de maladie : Détermination SEULE (pas Insensible) | LDB 17 l.59-61 n'ouvre la Détermination QUE sur Psychologie / modificateurs de Critique / retrait d'UN État — la fenêtre de conscience de LDB 20 l.170 suspend la SOURCE qui porte l'État (`suspendSource`), pas le canal | pool non-cumul (meilleur bonus + pire malus) |
| `faim` | pénalité de Faim : « Plus besoin de manger » | annulé par `noHunger` (flag de sort) — géré à la source Faim (P2), pas par une prothèse de séquelle | pool non-cumul (meilleur bonus + pire malus) |
| `magique` | effet de SORT actif (ActiveEffect) : inconditionnel mais combiné en POOL non-cumul ; expire seul | sort actif : rien ne l'annule (il expire), mais il se combine en POOL non-cumul (≠ `intrinseque` additif) | pool non-cumul (meilleur bonus + pire malus) |
| `etat` | pénalité/effet d'un État (LDB 16) : pool NON-CUMUL, le pire seul (l.20) ; Exténué ×stacks | État (LDB 16) : annulé NON PAS ici mais par le flag de combat `ignoreStatePenalties` (au consommateur) ; pool non-cumul | pool non-cumul (meilleur bonus + pire malus) |
| `ivresse` | pénalité d'Ivresse (LDB 09 l.475) : pool non-cumul ; ignorée 1 Round par la Détermination (flag `drunkIgnore`) | Ivresse (LDB 09) : gaté à la SOURCE par le flag `drunkIgnore` (Détermination, 1 Round) ; pool non-cumul | pool non-cumul (meilleur bonus + pire malus) |
| `intrinseque` | trait/mutation/qualité : inconditionnel ET ADDITIF (Σ dans la base — corps/équipement permanent) | rien | Σ dans la BASE (additif) |

Table des annulateurs : `PASSIVE_CANCELLERS` (`src/engine/trauma.ts:884`) — elle doit rester
TOTALE sur l'union (ce générateur échoue si un kind n'y figure plus). Seul `intrinseque` se somme
dans la base ; tout le reste se combine en pool NON-CUMUL.

Pour une SÉQUELLE, le `kind` n'est pas stocké : il est dérivé du type d'op par `traumaOpKind` —
`maxWeaponHands` → `structurel` · `senseLoss` → `sensoriel` · `moveScale` → `mobilite`, tout le reste → `douleur` (charMod / skillMod).

## 3. Le collecteur — `passiveMods(c)`

`passiveMods` (`src/engine/trauma.ts:983`) est le **point de
lecture UNIQUE**. Ses 14 branches d'émission, dans l'ordre du code :

| Ligne | `kind` émis | Producteur | Ce que la branche collecte (commentaire du code) |
|---|---|---|---|
| `src/engine/trauma.ts:985` | — | `traumaPassiveMods` | — |
| `src/engine/trauma.ts:991` | — | `diseasePassiveOps` | Maladies (kind `maladie`, annulée par Détermination ; passifs des symptômes via `diseasePassiveOps`) + Faim (kind `faim`, non annulée : `noHunger` purge l'état à l'entretien, pas ici). |
| `src/engine/trauma.ts:994` | `faim` | inline | — |
| `src/engine/trauma.ts:997` | `faim` | inline | — |
| `src/engine/trauma.ts:1002` | `ivresse` | inline | Ivresse (LDB 09 l.475) : −10/échec aux CC/CT/Ag/Dex/Int (pool non-cumul, kind `ivresse`). |
| `src/engine/trauma.ts:1012` | `etat` | inline | États (LDB 16) : leur `passive: GameOp[]` (pénalité de Test → `testMod`, bonus à l'attaquant → `incomingAttackMod`, échelle de Mouvement…) émis kind `etat` (pool NON-CUMUL, le pire seul, LDB 16 l.13). |
| `src/engine/trauma.ts:1017` | `etat` | inline | États PSYCHOLOGIQUES (LDB 21, `psychology.json`) : leur `passive` (Frénésie → `sbBonus +1`) émis dans le MÊME pool `etat` que les États — MÊME folding générique, zéro chemin parallèle. |
| `src/engine/trauma.ts:1025` | `intrinseque` | inline | Mutations de Corruption (LDB 19) : modifs PERMANENTES du corps → leur `passive: GameOp[]` (vocab unifié, `mutations.json`) émis tel quel en kind `intrinseque`, COMME les traits. |
| `src/engine/trauma.ts:1028` | — | `wornSocialMods` | Qualités d'objet équipées (LDB 60), producteurs sans cycle (wearPenalty est une feuille) : objet Laid → −Soc aux Tests sociaux (testMod char-qualifié) ; port d'armure → −N% par compétence (skillMod, intrinsèque). |
| `src/engine/trauma.ts:1029` | — | `qualityWearMods` | — |
| `src/engine/trauma.ts:1036` | `intrinseque` | inline | Objets PORTÉS (equipped) ou TENUS (arme du loadout actif `c.weapons`) : leur `passive: GameOp[]` (skillMod des Bésicles…) émis kind 'intrinseque' — comme les mutations. |
| `src/engine/trauma.ts:1042` | — | `traitPassiveMods` | Traits à modificateur de PROFIL appliqués en DIRECT (LDB 85 : Élite/Coriace/Brutal/Rapide… facultatifs, statbloc d'éditeur, traits accordés) — leurs `PassiveMod` (vocab GameOp unifié, `TraitData.passive`) émis TELS QUELS. |
| `src/engine/trauma.ts:1045` | — | `talentPassiveMods` | Talents POSSÉDÉS (LDB 10) : leur `passive: GameOp[]` (Coup puissant, Dur à cuire… ou Frénésie → grantFreeAttack) émis kind `intrinseque`, par niveau — comme les traits. |
| `src/engine/trauma.ts:1053` | `magique` | inline | — |

Producteurs nommés, avec leur site réel :

| Producteur | Site | Rôle (JSDoc) |
|---|---|---|
| `diseasePassiveOps` | `src/engine/disease.ts:299` | Passifs de TOUTES les maladies ACTIVES (collecte unifiée, reprise telle quelle par `passiveMods`). |
| `qualityWearMods` | `src/engine/wearPenalty.ts:45` | Pénalités de port → ops `skillMod` skill-qualifiées (kind `intrinseque`, Σ) pour le collecteur passif unifié, chacune ATTRIBUÉE à la pièce qui la porte (`src`) pour que le détail de jet la NOMME. |
| `talentPassiveMods` | `src/engine/talentEffects.ts:255` | Modificateurs PASSIFS continus des talents POSSÉDÉS (`TalentData.passive` : Coup puissant, Dur à cuire…, ou Frénésie → `grantFreeAttack`) en `GameOp[]`, émis kind `intrinseque` et RÉPÉTÉS par niveau (`t.times`). |
| `traitPassiveMods` | `src/engine/traits/dispatch.ts:195` | PassiveMod[] de PROFIL des traits — la DONNÉE éditable `TraitData.passive` (vocab GameOp unifié, éditée par GameOpEditor comme un sort). |
| `traumaPassiveMods` | `src/engine/trauma.ts:962` | Ops PASSIVES des SÉQUELLES seules (`c.traumas`), `kind` résolu (surcharge de fiche > `traumaOpKind`) et gating `modSurvives` appliqué. |
| `wornSocialMods` | `src/engine/wearPenalty.ts:52` | Modificateurs de Sociabilité (≤ 0) des objets ÉQUIPÉS de `c` (objet Laid −10, LDB 60 l.54), UN PAR QUALITÉ émettrice : le `src` porte la qualité, donc le détail de jet la NOMME (« −10 Laid ») au lieu d'un total anonyme. |

**Ajouter une source de passif = ajouter une branche ICI**, jamais un second collecteur ni une
lecture directe d'un champ typé au consommateur. Les consommateurs
(`effectiveChar`/`testValue`/`defenseValue`/`effectiveMovement`/`recomputeLoadout`) passent
tous par les helpers d'extraction de `src/engine/trauma.ts`, qui filtrent par type d'op et par mode de
combinaison.

### Anti-cycle

Le collecteur ne peut importer que des **feuilles** (aucune n'important en retour trauma ou
characteristics) ; les sources portées par le Combattant lui-même (mutations, objets, États) sont
lues INLINE. C'est cette contrainte, pas une préférence de style, qui décide de la forme d'une
branche : un producteur nommé quand le module est une feuille, une boucle inline sinon.

## 4. Où vivent les passifs — DONNÉE éditable

Chaque document qui porte un passif le DÉCLARE dans son def zod ; la colonne de droite est la
population qui l'exerce vraiment aujourd'hui.

| Document | Champ(s) | Def | Entrées porteuses |
|---|---|---|---|
| `src/data/etats.json` | `passive` | `src/data/schemas/defs/etats.ts` | 9 / 21 |
| `src/data/mutations.json` | `passive` | `src/data/schemas/defs/mutations.ts` | 84 / 116 |
| `src/data/naval-traits.json` | `passive` | `src/data/schemas/defs/naval-traits.ts` | 9 / 27 |
| `src/data/psychology.json` | `passive` | `src/data/schemas/defs/psychology.ts` | 1 / 9 |
| `src/data/qualities.json` | `passive` | `src/data/schemas/defs/qualities.ts` | 17 / 59 |
| `src/data/symptoms.json` | `passive`, `passiveBySeverity`, `visiblePassive` | `src/data/schemas/defs/symptoms.ts` | 10 / 18 |
| `src/data/talents.json` | `passive` | `src/data/schemas/defs/talents.ts` | 21 / 187 |
| `src/data/traits.json` | `passive` | `src/data/schemas/defs/traits.ts` | 26 / 132 |
| `src/data/trappings.json` | `passive` | `src/data/schemas/defs/trappings.ts` | 15 / 441 |

Le `kind` n'est PAS dans la donnée : le collecteur l'affecte à l'émission (le kind d'une séquelle
est dérivé, celui d'un trait/mutation/objet est `intrinseque`). **Un seul format en donnée :
`GameOp[]`.**

## 5. Mutations & Tables de Corruption — DÉCOUPLÉES

Une **mutation** est une entité (identité + effets), SANS plage de tirage :
`src/data/mutations.json` porte 116 entrées, de `kind` `mentale` / `physique`.
Une **Table de Corruption** (`src/data/mutationTables.json`, 17 tables) n'est qu'une
suite de plages d100 qui RÉFÉRENCENT des mutations **par id**. Plusieurs tables peuvent donc pointer
la même mutation à des plages différentes, sans collision.
Mesuré : 3 mutations ne sont référencées par aucune table (tirées autrement, ou octroyées directement).

Le `kind` (physique/mentale) reste sur la MUTATION — c'est sa nature, lue par les limites de
Corruption — indépendamment de la table qui l'a tirée.

## 6. Éditer — au Codex

Tout passe par le Compendium in-app (écran Codex) :

- champ `passive` d'un trait / d'une qualité / d'une mutation / d'un talent / d'un État / d'un
  objet → `GameOpEditor`, **le composant de liste d'ops EXISTANT**, celui qui sert aussi aux sorts.
  Ajouter un modificateur de profil = ajouter une op, jamais un widget de plus ;
- Tables de Corruption : l'éditeur de plages (intervalle d100 + mutation référencée, autocomplétée
  depuis le dataset des mutations) ;
- la sauvegarde réécrit le `.json` app-owned ; Vite recharge.

## 7. Frontières — ce qui n'est PAS un passif `GameOp`

- **Apparence** (cornes, écailles, peau d'une mutation) : couche RIG séparée. Le visuel n'est pas le
  mécanique.
- **Armure naturelle** d'une mutation (`apAll`/`apLocations`) : lue par la couche d'armure, pas par
  le collecteur de stats.
- **Effets STRUCTURELS ou comportementaux** d'un trait/d'une qualité (vol, sauvegarde, déclencheur de
  critique…) : ce sont des `capabilities` — drapeaux que le moteur INTERROGE, sans valeur numérique.
  Le choix entre les trois canaux est décrit dans `docs/ajouter-une-mecanique.md`.
- Un effet à DÉCLENCHEUR n'est pas un passif : il vit dans `effects` et passe par le dispatcher
  unique (même doc).

## 8. Recettes

- **Donner un modificateur de profil à un trait** : Codex → le trait → `passive` → `+` une op de
  modificateur. La def TS du registre ne porte que le libellé.
- **Créer une mutation** : Codex → Mutations → identité + `passive`. L'armure naturelle reste un
  champ à part (§7).
- **Ajouter une table de Corruption** (un dieu du Chaos) : Codex → Tables de Corruption → une entrée
  dont les plages référencent des mutations EXISTANTES par id.
<!-- sources-empreinte: bc22322294dd808c3fe0efebe191e363a437277e (144 fichiers, 1 dossiers) corps: 9be3df941a12e1842016c8cf6b1a62acad36fd8a -->
