# QC sprites — audit de reconnaissabilité du RIG (runbook)

> **Barème** : chaque créature/élément doit se **reconnaître au premier coup d'œil, sans
> connaître son nom**. Reconnaître ≠ parfait — c'est le socle ; le vernis esthétique vient après.

Tout le bestiaire passe désormais par le **rig** (`src/gameIso/rig/`) : plus aucun sprite
monolithique. Une créature bipède = **Plan × Gabarit (carrure) × Race (peau/tête/traits/posture)
× Perso** ; une créature NON bipède = le **def** de son plan (`src/gameIso/rig/creatures/defs/<Nom>.ts`,
bloc d'espèce du plan : `quad`…). On améliore un bipède en éditant **sa Race** (ou son Gabarit), un
non-bipède en éditant **son def**, jamais une table centrale : la carrure vit au registre
`src/gameIso/rig/gabarits/defs/`, l'apparence d'espèce dans la donnée `src/data/raceAppearance.json`
(résolue par `src/gameIso/rig/races/index.ts`).

Méthode **headless** (pas besoin de naviguer le jeu) : on rend chaque créature en PNG via le rig
(étape 1), des **agents aveugles** devinent ce que c'est, on corrige
la Race, le Gabarit ou le def (étape 3), puis on re-rend avec le MÊME outil et on re-vérifie
(étape 5). Rasterisation SVG→PNG via `@resvg/resvg-js` ; inspection directe par `Read` (le
contrôleur ET les agents voient les images).

## Pipeline

### 1. Rendre le bestiaire en PNG
Trois outils, qui rendent par le rig et rasterisent par Resvg, tous par la couture
`scripts/qc/aveugle.mts`. Le **dossier de sortie est un argument OBLIGATOIRE** : sans lui, l'outil
affiche son usage et sort en erreur. Toute créature y est nommée par son **id** (record, def, arme du
catalogue), jamais par son libellé : un id non résolu LÈVE, au lieu de rendre sans un mot la race par
défaut ou une case désarmée.

**Bipèdes** (Race × Gabarit) — planche AVEUGLE `scripts/_qc-blind.mts` : chaque case porte un
numéro, jamais un nom, et montre face + profil côte à côte, résolus par `entityRigProfile` +
`resolveRig` (le chemin du jeu). Les cases sont le tableau `TRUTH` du script (`{ id, arme? }` : id de
record de créature, id d'arme du catalogue) : l'orchestrateur y place les créatures à auditer, dont
celles qu'il vient de corriger (étape 5). Chaque rig est réduit au besoin pour que sa boîte
englobante tienne dans sa case ; les deux vues d'une case gardent la même échelle.
```powershell
npx tsx scripts/_qc-blind.mts <dossier-de-sortie>
# → <dossier-de-sortie>/_blind-sheet.png  : la planche, seule image montrée aux juges
#   <dossier-de-sortie>/_blind-truth.json : [{ cell, plan, id, truth }], la vérité PRIVÉE, jamais montrée
```

**Tous gabarits mélangés** — planche AVEUGLE `scripts/_qc-all-blind.mts`, même forme : tableau
`ENTRIES` (def non bipède par id, ou record bipède + arme), profil + face par case.
```powershell
npx tsx scripts/_qc-all-blind.mts <dossier-de-sortie>
# → <dossier-de-sortie>/_qc-all-blind.png + _qc-all-truth.json ([{ cell, plan, id, truth }], PRIVÉE)
```

**Non bipèdes** — `scripts/qc/render-creature.mts`, **mono-créature**, sur les defs du registre
`CREATURES` :
```powershell
npx tsx scripts/qc/render-creature.mts --list                    # JSON [{ id, label, plan }] des créatures riguées non bipèdes (registre CREATURES)
npx tsx scripts/qc/render-creature.mts <id du def> <dossier-de-sortie> [prefixe]
# → <dossier-de-sortie>/<prefixe>-front.png + <prefixe>-profile.png (préfixe par défaut : l'id)
```
Un def de plan `biped`, un id inconnu ou une espèce absente de son plan LÈVENT : un bipède passe par
la planche.

Pour un audit en LOT (cf. étape 2), la liste des non-bipèdes vient du registre (`--list`), jamais
d'une liste recopiée. L'orchestrateur rend chaque créature sous un préfixe neutre
(`render-creature.mts <id> <dossier> cNN` → `<dossier>/cNN-front.png`, pas de manifest) et tient
l'appariement `cNN → id` dans son propre fil ; côté planches, cet appariement est le JSON de vérité.
Dans les deux cas, il n'est jamais montré aux juges : un juge ne reçoit que le chemin du PNG. Pose de
repos.

### 2. Audit aveugle (par LOTS de ≤5 agents)
Dispatcher des subagents qui `Read` un PNG **sans le nom** et répondent : *meilleure hypothèse +
confiance 1–5 + indices visuels + défauts*. Donner la liste des types WFRP possibles (humain, nain,
elfe, orc, gobelin, ogre, troll, skaven, mort-vivant, homme-bête, guerrier du Chaos, mutant…).
> ⚠️ **Lots de ≤5 agents** : au-delà, l'API serveur rate-limit (cf. session 2026-06-08). Plusieurs
> lots séquentiels plutôt qu'un gros fan-out.

**Critère de succès** : la créature est lue correctement avec **confiance ≥ 3** par la majorité.

### 3. Corriger — éditer la RACE ou le GABARIT (bipède), le DEF (non bipède), pas le code central
Bipède — l'entrée de sa race dans `src/data/raceAppearance.json`, ou son gabarit :
- **Carrure fausse** (trop trapu/élancé) → `src/gameIso/rig/gabarits/defs/<id>.ts` (sl/st/legs/arms/
  head) ou un `gabaritOverride` fin dans la Race.
- **Peau / cheveux** → `palette` de la Race (+ `paletteF` pour la variante féminine).
- **Posture de repos** → `pose` (deltas d'angle, appliqués front+profil).
- **Tête caractéristique** → `head` (id d'une part de `HEADS`, `src/gameIso/rig/parts/monster/`).
- **Traits de corps** (panse+plastron, barbe, cornes, oreilles, plastron sombre…) → `featureKeys`,
  clés du catalogue `src/gameIso/rig/parts/elements/defs/`, dont chaque calque est un `RaceFeature`.
  Un calque `scale:'bone'` **suit l'échelle de l'os** qu'il habille → il
  REMPLIT le corps (ex. le gutplate de l'Ogre, l'os `torse` étant épais en gabarit `brute`).
  `scale:'fixed'` garde une taille constante (enveloppe d'échelle inverse). `layer<0` = derrière la
  part de l'os (cornes derrière la tête) ; `view` limite à une vue (crocs de face seulement).
- **Art SVG** : itérer **à la vue** (rendre → `Read` le PNG → ajuster les chemins) ; valider par un
  audit aveugle final. Réutiliser les jetons de palette (`@peau/@metal/@cheveux…`) pour rester
  recoloriable. Pas de `<defs>` inventés (les dégradés fixes sont émis par `defsGlobaux()`, `gameIso/sprites.ts`).

Non bipède — son def `src/gameIso/rig/creatures/defs/<Nom>.ts`, bloc d'espèce de son plan (ex. `quad`
du Loup : carrure, tête, queue, palette).

### 4. Garde-fou iso-rendu : le golden master
`src/gameIso/rig/golden/biped-golden.test.ts` fige le SVG résolu de chaque bipède (front+profil) +
des cas héros équipés. Toute refacto de `composeRig`/registres doit le garder **VERT à 0 snapshot
modifié** (le rig est partagé avec les héros). Un changement **intentionnel** (Ogre, tell de race) :
```powershell
npm test -- src/gameIso/rig/golden -u
git diff -W -- src/gameIso/rig/golden/__snapshots__/biped-golden.test.ts.snap   # vérifier que SEULS les snapshots ciblés bougent
```
Recouper les lignes des hunks (`git diff -U0 ... | Select-String "^@@"`) avec les bornes des blocs
`exports[...]` pour confirmer le périmètre exact avant de committer.

### 5. Re-vérifier
Re-rendre les créatures corrigées avec l'outil de l'étape 1 qui sert leur plan — un bipède placé
dans `TRUTH` de `_qc-blind.mts`, un non-bipède par `render-creature.mts` —, refaire l'audit aveugle
(étape 2) sur elles, confirmer ≥3.

## Conventions & pièges
- **Le rig est un pantin 2D de face** (rotations dans le plan, pas de profondeur) : voir
  `src/gameIso/rig/PART-CONTRACT.md`. `torse+` bascule LATÉRALEMENT — pas d'accroupi réel.
- **Anti-blob** : silhouette reconnaissable d'abord ; éviter l'aplat vert uniforme (réserver aux
  peaux-vertes/Chaos). Donner des tells nets (barbe naine ancrée à la mâchoire, oreilles elfes au
  niveau de la joue, gutplate+heaume de l'ogre, plastron sombre+cornes du Guerrier du Chaos).
- **« rig » ≠ bonne silhouette** : qu'une créature passe par le rig ne garantit pas qu'elle se lise
  bien — c'est précisément ce que cet audit mesure.
- **PowerShell** pour les runners ici (Bash s'auto-met en arrière-plan et traîne).

## Périmètre fait / à faire
- **Fait (SP1, bipèdes)** : registres Gabarit + Race ; features échelonnées à l'os ; pilote Ogre
  (réparé) ; tells Nain/Elfe/Guerrier du Chaos/Mutant. Audits aveugles : Ogre 4/5, Nain 5/5,
  Elfe 4/5, Chaos 4/5, Mutant 5/5.
- **Fait depuis (2026-07-04)** : hommes-bêtes Gor/Ungor + Chamane-Brey ont désormais leurs propres
  defs riguées (`src/gameIso/rig/creatures/defs/`).
- **À faire (SP2/SP3)** : quadrupèdes (longueur de pattes + corps par espèce + vue profil + tête de
  loup) ; rollout des sous-espèces skaven (clanrat/stormvermin — `Skaven.ts` reste un def générique
  unique).
```
