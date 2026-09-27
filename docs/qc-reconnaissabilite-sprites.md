# QC sprites — audit de reconnaissabilité du RIG (runbook)

> **Barème** : chaque créature/élément doit se **reconnaître au premier coup d'œil, sans
> connaître son nom**. Reconnaître ≠ parfait — c'est le socle ; le vernis esthétique vient après.

Tout le bestiaire passe désormais par le **rig** (`src/gameIso/rig/`) : plus aucun sprite
monolithique. Une créature bipède = **Plan × Gabarit (carrure) × Race (peau/tête/traits/posture)
× Perso**. On améliore une créature en éditant **sa Race** (ou son Gabarit), pas une table centrale
(les ex-`PROPS`/`SPECIES_PALETTES`/`SPECIES_POSE`/`bipedConfig` ont été dissoutes dans les registres
`gabarits/defs/` et `races/defs/`).

Méthode **headless** (pas besoin de naviguer le jeu) : on rend chaque créature en PNG via le rig,
des **agents aveugles** devinent ce que c'est, on corrige la Race, on re-vérifie. Rasterisation
SVG→PNG via `@resvg/resvg-js` ; inspection directe par `Read` (le contrôleur ET les agents voient
les images).

## Pipeline

### 1. Rendre le bestiaire en PNG
Le rendu QC est **mono-créature** :
```powershell
npx tsx scripts/qc/render-creature.mts --list                    # JSON des créatures riguées (nom/plan/alias)
npx tsx scripts/qc/render-creature.mts "<Nom du def>" [dossier] [prefixe]
# → public/qc/creatures/<slug>-front.png + <slug>-profile.png (défauts)
```
Pour un audit en LOT (cf. étape 2), pré-rendre chaque créature à la main sous `public/qc/<id>.png`
(pas de manifest — les juges reçoivent un nom de fichier neutre `cNN.png`, l'appariement `id →
intended` reste dans le script d'audit, jamais montré aux juges). Front, pose de repos.

### 2. Audit aveugle (par LOTS de ≤5 agents)
Dispatcher des subagents qui `Read` un PNG **sans le nom** et répondent : *meilleure hypothèse +
confiance 1–5 + indices visuels + défauts*. Donner la liste des types WFRP possibles (humain, nain,
elfe, orc, gobelin, ogre, troll, skaven, mort-vivant, homme-bête, guerrier du Chaos, mutant…).
> ⚠️ **Lots de ≤5 agents** : au-delà, l'API serveur rate-limit (cf. session 2026-06-08). Plusieurs
> lots séquentiels plutôt qu'un gros fan-out.

**Critère de succès** : la créature est lue correctement avec **confiance ≥ 3** par la majorité.

### 3. Corriger — éditer la RACE (ou le Gabarit), pas le code central
- **Carrure fausse** (trop trapu/élancé) → `src/gameIso/rig/gabarits/defs/<id>.ts` (sl/st/legs/arms/
  head) ou un `gabaritOverride` fin dans la Race.
- **Peau / cheveux** → `races/defs/<Race>.ts` `palette` (+ `paletteF` pour la variante féminine).
- **Posture de repos** → `pose` (deltas d'angle, appliqués front+profil).
- **Tête caractéristique** → `head` (id d'une part de `parts/monster/`) ou `monster:{tete}` (forme
  simple existante).
- **Traits de corps** (panse+plastron, barbe, cornes, oreilles, plastron sombre…) → `features:
  RaceFeature[]`. Une feature `scale:'bone'` **suit l'échelle de l'os** qu'elle habille → elle
  REMPLIT le corps (ex. le gutplate de l'Ogre, l'os `torse` étant épais en gabarit `brute`).
  `scale:'fixed'` garde une taille constante (enveloppe d'échelle inverse). `layer<0` = derrière la
  part de l'os (cornes derrière la tête) ; `view` limite à une vue (crocs de face seulement).
- **Art SVG** : itérer **à la vue** (rendre → `Read` le PNG → ajuster les chemins) ; valider par un
  audit aveugle final. Réutiliser les jetons de palette (`@peau/@metal/@cheveux…`) pour rester
  recoloriable. Pas de `<defs>` inventés (les dégradés fixes sont émis par `defsGlobaux()`, `gameIso/sprites.ts`).

### 4. Garde-fou iso-rendu : le golden master
`src/gameIso/rig/golden/biped-golden.test.ts` fige le SVG résolu de chaque bipède (front+profil) +
des cas héros équipés. Toute refacto de `composeRig`/registres doit le garder **VERT à 0 snapshot
modifié** (le rig est partagé avec les héros). Un changement **intentionnel** (Ogre, tell de race) :
```powershell
npx vitest run src/gameIso/rig/golden -u
git diff -W -- src/gameIso/rig/golden/__snapshots__/biped-golden.test.ts.snap   # vérifier que SEULS les snapshots ciblés bougent
```
Recouper les lignes des hunks (`git diff -U0 ... | Select-String "^@@"`) avec les bornes des blocs
`exports[...]` pour confirmer le périmètre exact avant de committer.

### 5. Re-vérifier
Re-rendre (étape 1), refaire l'audit aveugle (étape 2) sur les créatures corrigées, confirmer ≥3.

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
  unique) ; migrer les ~12 races encore en `monster` vers `head`+`features` quand on veut les enrichir.
```
