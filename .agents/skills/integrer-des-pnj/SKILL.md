---
name: integrer-des-pnj
description: À utiliser pour entrer des profils de PNJ ou de créatures au bestiaire, ou poser des PNJ en scène (carrière, troupe, anonyme, équipé, lanceur de sorts).
---
<!-- GENERATED: agents:sync; source=.claude/skills/integrer-des-pnj/SKILL.md -->

# Intégrer des PNJ

Deux gestes distincts : **entrer un profil au bestiaire** (`src/data/creatures.json`, donnée app-owned,
`.claude/rules/donnees.md`) et **poser un PNJ dans une scène** (`SceneEntity`, `docs/campagne-authoring.md`).
Toute valeur vient du `Source/` (Atlas `docs/raw/4e/bestiaire.md` d'abord) ; une donnée mécanique absente de
la VF se prend à la VO (fiche `user-doctrine-vo-fournit-la-donnee-mecanique-absente-de-la-vf`).

## Entrer des profils au bestiaire

1. **Le livre d'abord** : `books.json` porte le livre, chaque profil sa `source` (`book`, `page`) ;
   `docs/ajouter-un-livre-source.md`. Un lot de profils entre par une migration datée, rejouable et NO-OP
   au second passage (`scripts/migrations/`), jamais par une édition à la main de 300 entrées. Modèle :
   `scripts/migrations/2026-11-08-3656-bestiaire-frenchy.mjs` (en-tête : la liste de ses gestes).
2. **Check-first par concept** : un profil réimprimé ailleurs devient un emplacement secondaire (`alsoIn`)
   du premier, jamais un doublon ; un id déjà pris se suffixe du livre (`src/data/id-collisions.test.ts`).
   Une entrée qu'aucune scène ne cite reste au catalogue (fiche `user-doctrine-catalogue-sans-garde-d-orphelines`).
3. **Tout est un id** (fiche `user-doctrine-ids-stables-labels-affichage`) : `appearance.species` (le plan
   `planDeBestiaire.json` doit la connaître), l'`arg` d'un Trait, la spécialisation d'un Talent
   (Domaine de `domains.json`, dieu de `gods.json`), les Compétences « au choix » en `choix` borné, jamais
   une Compétence nue ni un libellé.
4. **Armes et armure imprimées** : une arme est un Trait Arme (mêlée) ou À distance (Indice, portée) dont
   l'`arg` est l'id de la possession ; le Dégât imprimé fait foi. Une arme du corps (crocs, griffes, pinces,
   poings…) porte `natural: true` : elle reste quand le PNJ tient une vraie arme (`traitsDevantLEquipement`,
   `src/engine/creatureEquip.ts`). Les Points d'Armure se posent `parLocalisation` avec leur `matiere`.
   Un guide fan peut compter le bouclier dans ses PA : relis son Avertissement avant de recopier.
5. **Sorts imprimés** : la liste du profil (`spells`) fait foi en entier et n'est jamais complétée : n'y
   mets jamais une liste partielle. Sans liste imprimée, pose seulement les Talents et Traits de lanceur
   (règle ci-dessous). Un sort qui n'existe qu'en VO ou sans GameOp reste hors du profil et va au ticket.

## Poser un PNJ dans une scène

Le détail de chaque champ vit dans `docs/campagne-authoring.md` ; l'inspecteur Godot (`src/hote/editeur.ts`,
`hotes/godot/pont/CONTRAT.md`) porte chaque geste.

- **Équipement réel** : `inventaire` (`inventaireDAuteurSchema`), un record possession → portée. L'objet
  réel fait céder le Trait qui le résumait (arme de mêlée tenue → Trait Arme, arme de tir → À distance,
  armure portée → Armure) ; les armes naturelles et les mutations restent.
- **PNJ de carrière** (`EDO 11 l.17-21`, arbitrages au ticket #773) : un `ref` du Bestiaire, sans statbloc
  ni preset ni tenue d'auteur, et `carrieres` (la dernière est l'actuelle). L'auteur choisit Talents,
  Compétences à choix et dotations ; le reste se tire sur l'id. Aucune monture n'est posée avec lui :
  l'auteur la pose à côté. Sa bourse : les dés de Gagner de l'argent à son Statut, sans Test
  (`argentDuPnj`, `EDO 11 l.42-46`). `refusDuPnjDeCarriere` refuse au parse ce que ses Niveaux n'offrent pas.
- **PNJ anonyme** : laisse `label` vide. Une fiche non nommée d'une espèce jouable reçoit un nom et des
  détails tirés sur son id (`nomDEntite`, `ficheDEntite`, `src/noyau/monde/sceneNpc.ts`) ; donne-lui son
  sexe. Un `label`, un preset ou un statbloc fixent le nom. Lis toujours le nom par `nomDEntite`.
- **Troupe** : N copies variées en un geste (`poserUneTroupe`, `src/noyau/sceneEdit.ts`, de 2 à 30),
  jamais des copies à la main.
- **Lanceur de sorts** (`sortsDuPnj`, `src/engine/sortsDuPnj.ts`, arbitrage au ticket #3715) : Magie
  mineure (Bonus de Force Mentale), Invocation (un Miracle) et Magie du Chaos (un Sort par prise) se
  remplissent seuls ; Magie des Arcanes et les Traits Lanceur de Sorts et Miracles ne donnent rien
  d'office : l'auteur choisit (`combat.spells`). Béni donne les Bénédictions de son culte.
- **PNJ nommé** de la campagne : un preset du narratif (`presetId`), un seul pour toutes ses apparitions.

## Prouver

`serializeDataset`, puis `npm run typecheck` en sortie complète, `npm run test:perimetre`,
`npm run docs:check` ; une scène passe `validateScene` (refus d'un parcours ou d'un sort choisi). Un écart
entre la donnée et le `Source/` se tranche écart par écart (`.claude/rules/donnees.md`). Un choix que le
livre laisse au MJ passe par la cérémonie d'arbitrage, verbatim daté au ticket, et l'Atlas en garde la
lecture.
