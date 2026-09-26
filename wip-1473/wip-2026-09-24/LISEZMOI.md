# Fil #1463 Référence (#1473) — pause du 2026-09-24 13:10 UTC (quota de Clément à 98 %)

Sauvegarde du travail NON committé et des rapports, pour reprendre à froid. Les worktrees vivent dans un conteneur
éphémère : si `.wt-1473-t2` ou `.wt-1473-r2c3` ont disparu, recréer le worktree sur la tête indiquée et appliquer le
patch (`git apply --binary <patch>`), puis détarer les non suivis.

## Train 2a2 — `chantier/1473-t2`, tête `6a55a5d7c`

- Patch : `t2-6a55a5d7c.patch` (diff du train 2a2 jusqu'aux corrections 4 comprises) ; non suivis :
  `t2-non-suivis.txt`, `t2-non-suivis.tgz`.
- État : corrections 4 FAITES, portes du codeur vertes (typecheck:fast 0, 32 fichiers vitest / 822 tests, garde
  memeRef, kit de recette). Rapport : `rapports/2a2-corr4-rendu.md`. Brief : #1473 issuecomment-5814500508.
- Reste avant commit :
  1. Relire le diff de corr4 (orchestrateur).
  2. Deux écarts du codeur à trancher : (a) une entrée de `specs[]` ne peut pas porter `maison`
     (`specEntrySchema`, `valeurs.ts:295-301`), et `SpecsField` ne saisit ni `source` ni `maison` ; (b) `Icon`
     (`src/ui/Icon.tsx:40-48`) ne porte aucun id d'icône au DOM (proposer `data-icon`).
  3. Recette navigateur parties B et C (Maître artisan → rangée « Métier (Forgeron) » ; spécialisations au
     Compendium) et puces de provenance (N4 a changé `TalentChip`), puis juge vision sur captures.
  4. Juge de diff sur corr4 (ou cumul corr3+corr4 ; verdict corr3 : `rapports/2a2-corr3-juge.md`).
  5. Typecheck complet, `docs:build` (`index-moteur.md`, `test-scenarios.md`), `docs:check`, commit (lignes
     `CLIQUET:`, `REFUTATION:`, `JUGE:`, `JUGE-VISION:`), push, CI.

## R2 C4a — `chantier/1473-r2`, tête `61fef43d7`

- État : diff de C4a (48 fichiers + 3 neufs) dans `.wt-1473-r2c3`, typecheck complet vert (orchestrateur), juge de
  diff FRAGILE (`rapports/c4a-juge.md` : B1 lecteurs de spécialisations, B2 racines vivantes = image de
  `DATASET_FICHIER_DERIVE`). Un codeur de corrections (brief `rapports/c4a-corr-brief.md`, #1473
  issuecomment-5814631845 : K1 racines, K2 écritures de test hors seam, K3 N1/N3/N5/N7) a été ARRÊTÉ au début ; son
  état partiel est décrit dans `rapports/c4a-corr-rendu.md` s'il existe. Patch : `r2c3-61fef43d7.patch` et non suivis.
- Corrections arrêtées (`rapports/c4a-corr-rendu.md`) : K1 fait (phase 2 émet `_racines-vivantes.generated.ts`, 105
  documents, image de `DATASET_FICHIER_DERIVE` ; garde D5 réécrite, mutations rouges) et N3 fait (`idsDeLEspace(cle,
  lire)` seul suit l'univers). N1 codé (`atteindre` exporté, ne lève pas sur un doublon) mais sans test ni rejeu de
  `sonde-doublon.mts`. Non faits : mesure du bundle (K1.3), lexique et doc faux depuis K1
  (`scripts/docs/lib/structures-lexique.mts:187`, `scripts/docs/build-donnees.mjs:413`), K2 (`actions.json` n'a aucune
  clé de dataset : les `ACTIONS.push` des tests n'ont pas d'écrivain du seam, décision d'`exposition` à prendre ;
  `seam-ecriture-guard.test.ts` ne voit pas la classe), N5, N7. Tests à rejouer après N1 : `co-descente`,
  `ids-vivants-regime`, `espaces-contrat`, `pastille-entite`, `CombatConsole`. typecheck:fast vert.
- Reste : finir K1-K3 ci-dessus, relire, juge court, `docs:build` (`structures-donnees.md`, `donnees.md`,
  `codex-relations.md`), commit, push, CI. Puis train « lecteurs de spécialisations » (B1 : l'index garde
  l'indirection `{ source }`, `specResolves` fondu dans `ref.ts`, `specCatalogOf`/`specPoolOf`/`specLabel` lisent la
  lecture, `specLabel` par type), puis C4b (écriture, D6-D7, fusion des deux `…SerializeRoot`).

## Designs

- Socle « marque de nœud » : v3 `../1463-marque-de-noeud-design-v3.md`, posté #1473 issuecomment-5814545902 (v2
  FRAGILE intégré). Train après C4b ; M5 dans C5. Sonde : `rapports/sonde-trace-def.mjs`.
- Référence polymorphe : v2 RÉFUTÉ (`rapports/reference-polymorphe-v2-juge.json`, 1 structurel + 11). Grounding v3 :
  `rapports/reference-polymorphe-v3-lecteur.md`. Direction retenue pour la v3, à écrire puis juger :
  - une LIGNE de table est une entité typée : la catégorie d'un def `niche` nomme le type de ses lignes
    (`niche.categories: { <catégorie>: { suite, type } }`) ; l'espace d'un type de ligne est l'union de ses
    catégories (patron des sous-listes de `material`, `idDe(type, catégorie)` pour la sous-liste) ; une Localisation de
    plus ne coûte aucune ligne à `TYPES` ; les catégories d'un type partagent un fichier (ids uniques par fichier,
    mesuré ; collisions entre fichiers : cargaisons, `tempete`) ;
  - la page se dérive de la référence (type ET id) : table GÉNÉRÉE pure par la phase 2 ; le moteur ne rend que des
    références (`critEntryCodexCategory`, `shipCritEntryCodexCategory`, `MISCAST_ROW_CATEGORY`, `codexCategory` de
    `miscast.json` meurent) ;
  - le rôle s'appelle d'un nom qui n'est pas une clé de `TYPES` (candidat : `provenance`, qui fonde aussi
    `ProvenanceDAjout` ; sonder les collisions) ; `rule` ne garde alors que « règle optionnelle » et `{rule}` ne se
    renomme pas ;
  - intégrer les 11 non structurels du verdict (StakeKey, 91 littéraux de `kind`, 42 catégories de l'UI du Codex,
    lexique « référence de dotation polymorphe », prose « foyer de règle »).
- Attendent : par-membre v2 et marqueur au champ (après le socle), grantTrait et Maxi v3 (juger sur t2 après le commit
  de 2a2).

## Publication

Rien n'est publié sur `main` : `ops:publier` attend l'accord explicite de Clément.

---
_Generated by [Claude Code](https://claude.ai/code)_
