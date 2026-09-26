# Architecture — où trouver quoi (référence vivante)

> À lire quand on cherche où vit un module, avant de créer un fichier, ou pour l'état courant des
> systèmes. La table des primitives partagées vit dans `docs/primitives.md` (GÉNÉRÉ depuis
> `src/data/primitives.manifest.json`, `npm run docs:primitives`).

## Politique de `docs/`

Ce dossier ne contient que des **références vivantes**, maintenues au fil du code. Les plans de
refonte et sorties de brainstorming sont des artefacts **DATÉS** : ils vont dans `docs/plans/`,
portent leur date en tête, et sont supprimés une fois exécutés (git porte l'historique). Ne JAMAIS
s'appuyer sur un doc de plan pour décider de l'architecture actuelle — le code et les références
vivantes font foi.

Garde `npm run docs:check` (`scripts/docs/check-doc-refs.mjs`) : chaque chemin `src/…`/`scripts/…` et
chaque symbole backtiqué cités par `docs/*.md` (hors `docs/plans/` et `docs/raw/`) doivent exister,
et chaque `label` de `src/data/primitives.manifest.json` doit être un EXPORT réel — exit 1 avec la
liste `fichier:ligne` sinon. Un renvoi à une DOC, lui, se juge partout : tout chemin `docs/….md`
écrit sous `src/`, sous `scripts/` ou dans la prose d'une doc — les pages de l'Atlas comprises, à
toute profondeur — doit désigner un fichier existant (exclusions structurelles : `docs/plans/`, qui a
sa garde dédiée, et les épreuves DATÉES, qui disent l'arbre de leur jour). Une référence vivante qui
ment ne se tague pas, elle se corrige.

**Fusion des docs DÉRIVÉS** (`.gitattributes`, trois familles, pilote
`scripts/git-hooks/merge-docs.mjs` déclaré par `npm run postinstall`) :

- `merge=docs-generes` — docs 100 % générés : la version courante est retenue, `docs:build` régénère.
- `merge=docs-catalogue` — `docs/raw/**/catalogue-*.md` : dérivés SAUF leurs blocs `<!-- X-INTEGRATION -->`,
  correctifs manuels dont la perte est refusée.
- `merge=docs-fiche-raw` — fiches `docs/raw/**/*.md` mixtes (prose manuscrite + champ `**Implémente :**`
  dérivé) : fusion 3-voies de la PROSE seule, chaque champ réinjecté PAR IDENTITÉ (heading porteur),
  donc une section ajoutée par l'entrant garde SON champ ; un conflit restant est un vrai conflit humain.

Après toute fusion ou tout rebase : `npm run docs:build` (`scripts/docs/build-all.mjs`) régénère et
nomme ce qui a bougé — les hooks `post-merge`/`post-rewrite` le lancent, le commit reste à toi.

## Frontière orchestrateur · machinerie · data-driven

Un Trigger doit fonctionner pour TOUT kind d'entité (maladie, talent, trait, sort, état, mutation)
**sans code spécifique**. Données = `effects`/`passive` sur l'entité, dispatchées par l'unique
`fireTriggers` ; machinerie = hooks `registerCombatHook`, règles universelles de l'arène qui ne
nomment AUCUNE entité. « Difficile à exprimer » n'autorise JAMAIS la machinerie : on étend le
vocabulaire (`GameOp`, `Formula`, `Condition`). Détail et cas limites : `docs/combat-events-coherence.md` §3bis.

## Pistes de mutualisation ÉVALUÉES puis ÉCARTÉES

Sites trop divergents pour une source unique propre — ne pas « globaliser » de force.

- `confirmPending` : les `xConfirm` divergent par leur garde de résultat et réutilisent `battle`
  localement ; un wrapper ne raccourcirait rien.
- `useMasterDetail` : le rejet portait sur le HOOK D'ÉTAT partagé (marchand ⇄ carte divergent après
  sélection) et reste valide. Le GABARIT DE LAYOUT (slots liste/détail, aucun état) en a été extrait
  en primitive sous #330 → `MasterDetail` dans `docs/primitives.md`.
- `StatChip` / `itemStatParts` : trois formes de données différentes (chaîne d'`ItemInstance`,
  `Combatant.weapons` résolues, table par famille).
- Sweep `actorIn` dans `store.ts` : `battle` y reste en portée pour le `set` final.

## Arborescence

```
Source/                     Livres en .md (vérité citable : FR + Core Rulebook 5e, CLAUDE.md § Sources VF)
src/data/                   NOTRE base APP-OWNED (JSON commité, éditable dans le Compendium) + index.ts (accès typé), pregens.ts
                            EXCEPTIONS manuscrites (tables verbatim sourcées) : criticals.ts, oups.ts,
                            mutations.ts (Tableaux de Corruption LDB 19). Les métadonnées de résolution
                            des sorts vivent dans SpellData (spells.json) — l'ancien registre spellspecs/
                            et le repli regex sont SUPPRIMÉS (Migration #5)
                            SEAM d'ÉCRITURE (`overrides.ts`) : `setDataset`/`setObjectDataset`/`resetData`
                            remplacent le CONTENU d'un dataset sans réassigner son binding (`splice` en
                            place) ET VERSIONNENT l'écriture (`bumperDataset`, module FEUILLE
                            `versionDataset.ts`) — l'identité du tableau ne bougeant jamais, cette version
                            est le SEUL témoin qu'un lecteur indexé peut consulter. Tout index de niveau
                            module se bâtit donc par `indexParId`/`indexParChamp`/`memoParVersion`
                            (#1692) ; deux gardes structurelles le tiennent : `index-vif-guard.test.ts`
                            (aucun index figé à l'import sur un dataset du seam) et
                            `seam-ecriture-guard.test.ts` (aucun `push`/`splice` hors `overrides.ts`)
  schemas/                    CONTRAT de la donnée. Chaque dataset a UN def (`defs/<nom>.ts`,
                              `defs-scenes/<nom>.ts`) qui DÉCLARE son document par la fabrique
                              `document()` (`grammaire/document.ts`) : enveloppe commune posée par la
                              fabrique (id/type/label, provenance source ∨ maison), emballage du fichier
                              par famille (entite/table/config/record), méta d'édition et exposition
                              Codex/éditeur. Registres GÉNÉRÉS (`_registry*.generated.ts`,
                              `_ids.generated.ts`) par `npm run gen` — jamais édités à la main.
                              Le nom FR d'une VALEUR d'enum vit sur le NŒUD (`enumNomme`,
                              `grammaire/valeurs.ts`, lu par `valeursDe`/`libelleDeValeur` de
                              `grammaire/meta.ts`), donc à toute profondeur et pour tous les
                              consommateurs — jamais un Record de libellés côté UI (cliquet
                              `grammaire/records-de-libelles.test.ts`).
                              Détail : `docs/donnees.md` §E-bis
  source/                     Parseur de DÉCOUPE des chapitres de `Source/` (`decoupe.ts` : sections,
                              blocs, folios, empreinte `sumOf`, résolution d'une adresse `DescRef`) +
                              `normalize.ts` (normalisation de citation, source unique partagée avec
                              `scripts/raw/_lib.mjs`). Module PUR : chargé tel quel par Node nu
                              (`scripts/source/*.mjs`) et par vitest — d'où les imports internes à
                              extension explicite ; sans entrée/sortie, donc chargeable par le navigateur.
                              Le chemin JOUEUR ne résout RIEN : la prose adressée est MATÉRIALISÉE au
                              build par le plugin Vite `scripts/source/prose-source-plugin.mjs`, qui
                              l'injecte sous `desc` dans le module JSON servi. Invariant « hors Vite =
                              forme disque » : un script Node lit une entrée adressée SANS `desc` — les
                              consommateurs Node de prose sont inventoriés par
                              `scripts/source/inventaire-consommateurs-prose.mjs` et câblés sur
                              `materialiser` (`scripts/source/resoudre.mjs`) à la migration de leur famille.
                              Le même plugin émet les chapitres en assets à nom stable
                              (`source/<livre>/<NN>.md` + `source/manifest.json`) et les sert en dev :
                              l'adresse EST l'URL, et `chapitres.ts` les charge dans le navigateur pour le
                              SEUL éditeur d'adresse (`src/ui/compendium/DescRefField.tsx`)
  hash.ts                     Hachage déterministe partagé (`hash32` FNV-1a, `seedStream`) : empreinte
                              de découpe ET seeds du rendu (`src/gameIso`)
scripts/source/             Le côté NODE de la chaîne d'adressage de prose — entrées/sorties seulement,
                            le parsing vit dans `src/data/source/decoupe.ts` (PUR). `lecteur-fs.mjs` lit
                            et mémorise un chapitre du `Source/` ; `resoudre.mjs` porte les deux portes
                            FAIL-CLOSED (`resoudreProse` pour UNE entrée, `materialiser` pour une racine
                            de document) et `cheminChapitre` ; `derive-decoupes.mjs` DÉRIVE une adresse
                            d'une `desc` existante et rend le verdict d'adressabilité (`judge`, consommé
                            par les migrations) ; `adresses.mjs` est L'INVENTAIRE des adresses du dépôt
                            (walk unique des deux racines par `listerArbre`, lu par la garde de
                            re-résolution, par la sonde de matérialisation et par l'outil de réparation) ;
                            `reecriture-ancree.mjs` remplace un fragment de TEXTE à sa place exacte
                            (`remplacerAncre`/`compterAncre` — indentation et ordre des clés du document
                            authoré préservés, ancre non unique = refus), consommé par les migrations et
                            par `reparer-adresses.mjs` ; `reparer-adresses.mjs` relocalise une adresse
                            cassée par son texte d'origine (`git show <ref>:<chapitre>`) et n'écrit que
                            ses `RECALÉE` (geste humain : `docs/ajouter-un-livre-source.md` §7) ;
                            `mesurer-prose-inline.mjs` et `inventaire-consommateurs-prose.mjs` mesurent
                            le stock qui reste à adresser et ses consommateurs Node ; `decoupe-cli.mjs`
                            inspecte un chapitre à la main ; `prose-source-plugin.mjs` est le plugin Vite
                            `wfrp:prose-source` (matérialisation au build, service des chapitres en dev)
scripts/migrations/         Migrations de donnée REJOUABLES (une par lot, datée) : rejouées sur l'arbre
                            courant elles ne réécrivent RIEN. `npm run migrations:replay` (replay.mjs)
                            les rejoue dans l'ordre lexical, EN PLACE, et mesure l'arbre par git diff
                            (suivi) ET git status (non suivi) — toute donnée réécrite ou tout fichier
                            neuf est ROUGE et NOMMÉ. Sur un arbre en WIP ce rejeu est destructif :
                            `npm run migrations:replay:head` (replay-head.mjs) le joue sur un EXPORT
                            jetable de la tête, mesuré par EMPREINTE (`lib/empreinteRejeu.mjs` —
                            hors dépôt, `git diff` bascule en `--no-index` et rend un faux vert), et
                            le hook `pre-push` l'arme dès que la plage poussée touche le périmètre
src/geometry/                Géométrie/simulation PURE partagée `state` ⇄ `gameIso` (#161 : `state` en a
                            besoin pour SA PROPRE logique — curseur de combat, IA, cadence des beats —
                            pas seulement le rendu ; zéro dépendance framework). `iso.ts` : projection
                            isométrique (Dims, tileCenter, rotTile…) — `gameIso/iso.ts` la ré-importe pour
                            ses dérivés qui ont besoin du MONDE (WALL_H_M/isoPxToM, via state/relief).
                            `walk.ts` : interpolation temporelle le long d'un chemin (walkMs/walkXY,
                            STEP_MS) — cadence l'attente de fin de marche AVANT résolution de combat.
src/engine/                 Règles WFRP4, PUR + testé :
  types.ts                    Caractéristiques, Combatant, Weapon, ItemInstance, Difficulty…
  tests.ts                    Tests & Degrés de Réussite (DR), tests opposés.
                              **INVARIANT — `base` = le Niveau de Compétence NU (Caractéristique +
                              Augmentations, LDB 09 l.17), PARTOUT.** Tout modificateur (Avantage,
                              États, Soutien, ward, Difficulté…) voyage dans le `modifier`/la cible,
                              jamais fondu dans une « value » : c'est cette valeur nue que
                              `resolveOpposed` compare à DR égal (LDB 12 l.160). Source UNIQUE de la
                              formule : `skillBaseValue` (`castingBaseValue` n'en délègue que la
                              variante Domaine) ; deux points d'étranglement la relisent à la source
                              pour le chemin magie (`evaluateCasting`, `counterspellOutcomeFrom`).
                              Corollaire de NOMMAGE : une fonction dont le nom promet une valeur mais
                              qui y fond des modificateurs est un bug (`castingValue`, #1150) — le
                              site qui a besoin de la nue APPELLE l'accesseur, il ne soustrait pas.
  combat.ts                   touche/localisation inversée/dégâts/critique/initiative
  characteristics.ts          bonus, Blessures (BF+2×BE+BFM)
  character.ts                création de personnage (espèce+2d10, 40 augmentations, talents…)
  creation.ts                 tables de création LDB 04/05 : d100 espèce/carrière, bonus PX,
                              100 Points, Richesse initiale, âge/taille/yeux/cheveux
  careerSlots.ts              spécialisations & emplacements « (Au choix) » des carrières :
                              parsing, désignations par carrière, Maxi des talents
  talentEffects.ts            talents à effet création/attributs (+5 carac de départ, addSkill,
                              Dur à cuire/Chanceux/Obstiné/Véloce)
  advancement.ts              coûts PX, complétion de Niveau, changement de carrière (validé)
  items.ts                    inventaire/équipement : itemFromTrapping, recomputeLoadout, encombrement
  skills.ts                   valeur d'un test de compétence (partyBest) hors combat
  conditions.ts               États (+ durées d'États de sort, États récurrents)
  ops.ts                      **`GameOp` = LA langue UNIQUE de tout EFFET mécanique** (soin, retrait/pose
                              d'État, octroi de trait/talent/arme, dégâts, modificateurs, corruption…),
                              exécutée par `applyOps(target, ops, ctx)` et éditée par `GameOpEditor`.
                              AVANT de modéliser un effet en type/champ ad hoc → l'exprimer en `GameOp[]`.
                              Consommée par : sorts, Imparfaites (miscast), mutations, traits, qualités
                              (`passive`), effets déclenchés (`Flow`/`Trigger`), CONSOMMABLES. Jalon 2.6 :
                              PerSL (échelle par DR), onlyGroups, grantTrait/grantTalent/augmentWeapon/…
                              CATALOGUE GÉNÉRÉ des 102 ops (+ `Condition`/`Flow`/`EffectTrigger` de
                              flowCore.ts) : `docs/vocabulaire-mecanique.md` (`npm run docs:vocabulaire`)
                              — index par CONCEPT en français, résolution mesurée (« exécutée » /
                              « inerte au switch » / « hors switch » : les deux dernières = impur résolu
                              par src/state, ou passif lu par un collecteur — jamais « inutilisable »),
                              usages réels en donnée. À CONSULTER avant de conclure à un manque du moteur.
  spellspec.ts                spellSupport : classification mécanique/partiel/narratif d'un sort depuis
                              SpellData (duck typing — l'interface SpellSpec, le registre spellspecs/ et
                              le repli regex fallbackSpec sont supprimés, métadonnées migrées en donnée)
  magic.ts                    incantation/Focalisation/Péché/ZdE/portée/armure (« Repousser les Vents »)
  miscast.ts                  tables d'Imparfaites & Colère des dieux (d100 → GameOps, verbatim)
  corruption.ts               Corruption & mutations (LDB 19 : expositions, seuil, limites → damné)
  grimoire.ts                 apprentissage/mémorisation des sorts (coûts par Talent) + lecture au livre
  travel.ts                   voyage RAW (#T2) : vitesses km/h, 6 h/jour, marche forcée, coûts diligence/barge
  provisions.ts               rations & Faim (LDB 18 l.337-342) : consommation/jour, Tests, malus, Brouet
  axes.ts                      axes de forces/faiblesses (#409, mécanique MAISON) : axisScore/axesProfile/
                                partyCoverage/dominantAxes depuis `data/axes.json` (`derivation` en ids de
                                skills/talents) — SOURCE UNIQUE du mini-radar, du rail de composition (#417)
                                et des « rôles » de carte (`heroRoles`, `ui/CharCard.tsx`, réconcilié dessus)
src/state/
  scene.ts                  SCÈNE : 35 fonctions PURES (tuiles, murs, portes, relief) + 39 types exportés,
                            dont 24 `z.infer` des schémas de `data/schemas/defs-scenes/`, 2 ré-exports
                            (`CustomStatblock`, `TemporalCondition`) et 1 COMPOSÉ : l'union `Effect`
                            (55 `z.infer` de `defs-scenes/effets.ts` + `DelayedEffect`/`PetitePriere`/
                            `EffectOp` = 58 membres). Restent 12 MANUSCRITS : `Scene`, `SceneEntity`,
                            `AuMoinsUnPorteurDeFiche` (au moins un porteur de fiche, dérivé de
                            `PORTEURS_DU_TYPE`), `ActionAuthoree` (geste authoré d'une instance de décor),
                            `SceneEffectZone` (corps du document), `DelayedEffect`, `PetitePriere`
                            (annotations du `z.lazy`), `Layer` (l'infer du schéma dont `tiles` est
                            ÉLARGI à l'alias ci-dessous : `idDe('terrain')` brande l'id qu'il rend, et
                            l'authoring TS n'est pas parsé), `WallOverlay` (ce qu'un char de légende
                            d'arête ÉCRIT sur une arête : `structure`/`appearance`),
                            `Terrain`, `CellSide` (alias primitifs), `Fige` (marque de type d'une
                            valeur GELÉE : ce qu'une migration rejoue, jamais la semence du jour).
                            Comptes
                            et liste GATÉS par `ui/editor/scene-field-editability-guard.test.ts`.
                            `CellSide` = l'ARÊTE d'une case (quel bord porte un mur) ; le CAP, lui, vit
                            au foyer des caps (`state/dir8.ts`)
  worldMap.ts               SCHÉMA DE CARTE DU MONDE (#T2) : lieux/routes au niveau projet + format projet v2
                            (`ProjectDoc`, `activeAxes?: string[]` #409 — axes de forces/faiblesses ACTIFS de
                            la campagne, ids de `data/axes.json`, défaut `coreAxisIds` via `resolveActiveAxes`).
                            DONNÉES DE LIEU (#343) : le nœud `MapPlace` est LA source des services d'un lieu —
                            `port` (schéma riche + catalogue `naval-ports.json`), `market` (LandMarketProfile) et
                            `services[]` EXTENSIBLES (catalogue `lieux-services.json` : auberge/temple/forgeron/
                            guilde…). API UNIQUE `placeServices(place, scene?)` : compose ces trois sources +
                            l'auberge (offre PROPRE au service OU dérivée de l'offre de repos de la scène liée) en
                            une liste `ResolvedPlaceService[]` — payloads RÉFÉRENCÉS, jamais recopiés (zéro
                            duplication de vérité). Consommée par le hub de lieu (#343) et l'auberge ; les
                            consommateurs actuels (portFlow/landMarketFlow/restPlacesHere) restent inchangés.
  campaignNarratif.ts       SCHÉMA du bloc NARRATIF d'un paquet de campagne (schema 3, #765) : `NarratifBlock`
                            = `{affaires, indices, presetsPnj, objets}`, EMBARQUÉ dans le JSON du projet, jamais
                            copié dans `src/data` global (`narratifSchema` refuse toute collision d'id).
  campaignData.ts           COUTURE UNIQUE de résolution de la couche de campagne runtime (#767) : lit le slot
                            `campaignNarratif` (posé par `loadProject`) par id STABLE. `presetPnjById`/`affaireById`/
                            `indiceById` = COUCHE-SEULEMENT (n'existent pas au global) ; `trappingById` chaîne
                            campagne-D'ABORD puis règle globale (`findTrappingById`). Maps mémoïsées par référence du
                            bloc. Le moteur reste PUR : `engine/items` reçoit ce `trappingById` en résolveur injecté
                            (défaut = global) aux sites d'état `giveTrapping` — il n'importe jamais le store.
                            PNJ nommés (#671) : `resolvePresetCreature` résout un `presetId` de scène en créature mergée
                            (`mergeCreatureProfile`, base globale + surcharges du preset) + apparence embarquée ; câblée au
                            spawn de rencontre (`combatSlice` → `spawnEnemy` canal `presetCreature`, `spawn.ts` reste sans
                            import de cette couche) et au portrait de dialogue (`gameIso/tokenBodyKind.tsx`).
  store.ts                  store Zustand : GameState + vue (caméra/zoom) + campagne (scènes, dialogues,
                            effets, temps/repos) + actions de combat — délègue aux modules (get,set) :
  combatFlow.ts               flux de combat tour par tour (IA, attaques, effets, fin de combat).
                              CONVENTION « baril » : les clusters FEUILLES extraits sont des modules
                              séparés que combatFlow ré-exporte (`export * from './combatX'`) pour ne
                              pas casser les importeurs — un module feuille n'importe RIEN de combatFlow
                              (tout passe par get().xxx / modules feuilles). Déjà sortis : combatGeometry.ts
                              (géométrie pure) et combatEffects.ts (effets de scène/campagne : applyEffects,
                              butin attribuable, checkTriggers, pushReveal). NE PAS extraire le preview
                              (previewAttack/Defense) : il partage attackEnv/bestDefenseMode avec la
                              résolution → cycle. La cohésion preview↔résolution est voulue.
  rollFlowFactory.ts / rollFlowSpecs.ts  FABRIQUE générique des flux de jet différé (« une situation = une modale ») +
                              specs des flux (attack/defense/cast/disengage/trample/run/focus/psych/
                              frenzy/approach/test/heal + reload/recover/activity/corruption/appraise/
                              bargain) — un nouveau jet = 1 spec + 1 xConfirm. Résilience « Je ne
                              faillirai pas ! » (LDB 17 l.68, GLOBALE) : mécanisme UNIQUE (factory
                              `forceSuccess`/`setForcedRoll` + UI `ForcedRollPicker`). Un flux qui
                              l'offre déclare `caps: { forced: true }` ; son `resolve(s,p,actor,get,
                              forced?)` porte alors LES TROIS cas dans UN seul résolveur : `forced`
                              absent = jet normal (RNG) ; `{}` = `forceSuccess` (dé par défaut : 01→DR
                              max, ou opposé→jet courant forcé à ≥ DR+1) ; `{ roll }` = `setForcedRoll`
                              (dé choisi, doit rester une réussite). PLUS de dérives `force`/`forceRoll`
                              séparées (l'ancien « code dérivé ») — la résolution forcée VIT dans le
                              résolveur du Test, à côté du jet normal. La localisation suit le dé inversé
                              (attaque LDB 13 l.142, Projectile magique LDB 46 l.156) : choisir le dé la
                              re-dérive — il n'y a PAS de « coup ciblé » libre pour un Projectile (RAW).
  corruptionFlow.ts           gainCorruption (seuil → mutation → damnation, révélation 🧬) + cibles
  pendings.ts                 types Pending* (ré-exportés par store.ts)
  partyFlow.ts                équipement, avancement PX, consommables de fiche, butin
  merchantFlow.ts             marchand : réassort, panier, achat/vente/réparation, Marchandage, Évaluation
  travelFlow.ts               voyage jour par jour (temps, fatigue, péripéties d10+auteur, interruption/reprise)
  upkeep.ts                   entretien QUOTIDIEN (#T3 cascade : rations/faim + maladies + convalescence
                              des critiques, jours CALENDAIRES) + purge des effets a duree d'horloge
                              (castPenalties/ActiveEffect.untilTime) — anti-double-comptage lastUpkeepDay
  spawn.ts / path.ts / bus.ts
  dir8.ts                     Dir8 (8 caps grille) + géométrie associée : rotateDir8, DIR8_DELTA,
                              facingToward (#161 : ex-`gameIso/rig/facing.ts` — la géométrie de cap grille
                              n'est pas du rendu, `gameIso` la ré-importe pour l'orientation écran)
  viewLevel.ts                override DEBUG de l'étage AFFICHÉ (`__wfrp.viewLevel(z)`, #161 : ex-
                              `gameIso/viewLevel.ts`) — SOURCE dans `state`, lu par l'hôte du monde
                              (`gameIso/stage/MondeDeCampagne`)
  stageYaw.ts                 LACET CONTINU de la caméra du stage (#1176, P2-7) : cible + courant qui y
                              court, `viewYawDeg` (projection) et `viewRot` (cran EFFECTIF du dégagement)
  combatLog.ts                CombatEvent/CombatEventKind + CombatTone/toneOf/isImportantEvent/
                              lastEventTone (#161 : cadence des beats, `gameIso/combatNarration` les
                              réutilise pour l'icône/la coloration par camp, hors du périmètre `state`)
  migrateDoc.ts                PRIMITIVE GÉNÉRIQUE de migration séquentielle de document versionné
                              (`{version, ...}` → `MigrationMap` chaînée jusqu'à `targetVersion` ;
                              refuse net — jamais ne corrompt — objet malformé/version future/trou
                              dans la chaîne). Consommée par `roster.ts` (`ROSTER_MIGRATIONS`) et
                              `worldMap.ts` (`PROJECT_MIGRATIONS`) ; PAS par les saves de partie
  saves.ts                    Sauvegarde/chargement de partie (localStorage 3 slots + export/import
                              JSON). POLITIQUE DE VERSION (arbitrage utilisateur 2026-08-17) : un
                              changement de forme persistée bump `SAVE_VERSION` et RIEN d'autre —
                              aucune chaîne de migration, aucune fixture golden. Une save dont la
                              version diffère de `SAVE_VERSION` est REJETÉE et RETIRÉE du stockage
                              par `readSlot` (clé stable ET clés versionnées historiques), et le
                              témoin `takeObsoleteNotice` fait afficher le message au joueur par
                              `ui/SaveLoadModal`.
                              Save AUTO-SUFFISANTE (#766) : le slot `campaignDoc`
                              (`store.ts`, snapshotté via `stateFields`) embarque le DOCUMENT SOURCE du
                              paquet chargé (scènes + carte + narratif + scène d'entrée). Au chargement,
                              `applyLoadedSave` RÉ-ENREGISTRE toutes ses scènes (`registerScene`) et
                              RE-DÉRIVE `campaignNarratif` — sans lui, le `sceneRegistry` en mémoire
                              module ne connaîtrait que l'Arène + la scène courante et les transitions
                              vers les AUTRES scènes du paquet échoueraient en silence. `campaignNarratif`
                              reste NON persisté (re-dérivé de `campaignDoc`).
  roster.ts                   Roster persistant (localStorage) des personnages créés au créateur —
                              son propre couple `EXPORT_VERSION`/`ROSTER_MIGRATIONS` (même primitive
                              `migrateDoc`), indépendant de `saves.ts` (le roster ne voyage PAS dans
                              la save de partie)
  seating.ts                  ASSISE — source UNIQUE des places assises d'une Scène : `seatSlotsOf`
                              (places déclarées par le TYPE de décor → abord EFFECTIF, jamais partagé
                              avec une autre place de la scène), `seatIsOccupiable`/`seatPoseOf`,
                              `assignSeat`/`releaseSeat` et l'élagage (`pruneSeatAssignments`,
                              `releaseUnavailableSeats`). PUR : aucun store, aucun rendu, aucun `gameIso`
  projectLibrary.ts           Bibliothèque des projets de campagne de l'éditeur (`SavedProject`).
                              Backend IndexedDB (db `wfrp4-library`, store `projects`, une source de
                              vérité — supporte les grandes campagnes qui dépassent le quota
                              localStorage, #766 lot B). `projectsLoad`/`publishedProjects` SYNC
                              (cache mémoire) ; `projectSave`/`projectRemove` ASYNC (persistance
                              IndexedDB awaitée, ne rejette jamais — `LibraryWriteOutcome`). `cache`
                              chargé une fois par `initLibrary()` (awaité dans `main.tsx` avant le
                              premier rendu). Réconciliation localStorage⇄IndexedDB PAR ID à CHAQUE
                              `initLibrary` (jamais un flag one-shot, #776) ; `indexedDB` absent
                              (test/SSR) → repli localStorage.
src/gameIso/                Rendu du monde. Le moteur est le monde VOLUMIQUE three.js ; les surcouches
                            de jeu sont du SVG posé sur son canevas. Pipeline détaillé (pivot, peintres,
                            matériaux, QC) : docs/rendu-pipeline.md
  builders/                 GÉOMÉTRIE PURE en espace MONDE : types.ts (`SceneEl` = floor/wall/roof/prop/
                            token, discriminé par kind) + floors/walls/roofs/props/tokens/highlights/
                            dynamicMarks/interactHalos/tokenChrome. Un builder n'importe NI caméra NI
                            Dims — sa sortie survit à toute rotation et sert les deux vues.
                            propVolumes.ts = compilation PURE de la recette volumique d'un décor
                            (`buildPropVolumes` : primitives locales × cap × ancre monde, posées sur le
                            pied de l'ancrage = sol de la case + surélévation déclarée → `Face[]`
                            monde). Chaque site de `buildProps` (entité, feature de façade, ornement de
                            bâtiment) DÉCLARE son ancrage et un émetteur unique tranche : recette →
                            volume, sinon billboard
  backends/webgl/           SEUL backend du monde : cuisson des SceneEl en géométrie three (sceneMeshes,
                            faceBake, periodTexture, atlasBake des billboards) + caméras réelles
                            (cameras.ts, ortho pour les vues de plateau, perspective en POV)
  stage/                    hôtes et surcouches du monde : MondeDeCampagne (#1385 = l'HÔTE de l'écran de
                            campagne — il POSSÈDE le canevas et ne se démonte qu'avec l'écran ; vision,
                            exploré, teinte, éléments, marche, caméra et picking y vivent, et la bascule
                            plateau ⇄ première personne n'y change qu'un `frame` et une surcouche) ;
                            GameStage3D (boucle de rendu three) monté par VolumetricWorld ; viewPolicy.ts = POLITIQUE DE VUE (module PUR : d'un regard
                            — plateau iso, dessus, POV — il dérive ce que l'écran CHOISIT de montrer :
                            `mursAuTrait`, `grilleTactique`, `pionsEnDisques`, `toitsVisibles`,
                            `etageIsole`, `ombreSoleil`, `nappesMonde`, `precipitations`,
                            `montesDissocies` — un verdict de plus = une ligne) ; layers.tsx
                            (`wallTraitObjs`, murs au trait), TokenChromeOverlay (pions-disques +
                            chrome d'état), PlanWorldCanvas (matière du plan de station),
                            SansWebgl (sans contexte WebGL, l'hôte le DIT — pas de second peintre)
  authoring/                peintres SVG d'AUTHORING (floorsSvg, wallsSvg, roofsSvg, detailSvg), pilotés
                            par Dims ; pont monde→écran UNIQUE `projGP` (project.ts) — la rotation
                            caméra et l'élévation-écran vivent LÀ, jamais dans un builder. Trois
                            consommateurs : plan de station, aperçu de l'éditeur, oracles de parité
                            du monde volumique. Ils ne peignent AUCUNE image de partie
  pov/                      première personne : le MÊME monde volumique regardé à hauteur d'œil —
                            SurcouchePov.tsx n'en porte que les voiles d'écran
                            + camera.ts (caméra et brume) + billboardCore.ts
  detail/                   détail de surface en DONNÉE (`DetailRecipe`, `expandRecipe` → primitives UV
                            seedées) — même recette cuite par le monde et posée en pattern par le SVG
  iso.ts                    dérivés MÉTRIQUES de la projection (WALL_H_M, isoPxToM — besoin du monde,
                            via state/relief) ; la projection elle-même (Dims, tileCenter, diamondPath,
                            screenToTile, stageSize…) vit dans `src/geometry/iso.ts` (#161)
  sprites.ts                décor (props/villageois/terrain en relief) + defsGlobaux() (gradients) — PLUS de sprite créature
  rig/                      gabarits corporels (bipède + quadrupède/ailé/serpentin/…) — rend TOUT le bestiaire
                            AJOUTER une créature : suivre docs/creer-une-creature.md (registre defs/,
                            corps nu ≠ tenue, illustration art-ref obligatoire, pièges codifiés)
  tokenBodyKind.tsx         classifieur unique : rig humanoïde / gabarit animé / sprite décor
  SurcoucheIso.tsx          SURCOUCHE DE PLATEAU : l'arbre SVG posé SUR le canevas
                            (grille tactique `geometry/grid.gridLines`, murs au trait, portes/escaliers/
                            télégraphes, FxLayer, TokenChromeOverlay = pions et chrome, curseur, aperçu
                            de chemin). Elle ne dérive AUCUNE vérité monde : l'hôte la lui sert
  TopoScene.tsx             plan de station : sols cuits par PlanWorldCanvas, murs/portes/marqueurs en
                            surcouche SVG — la MÊME loi de composition que la vue du dessus de jeu
  fx/                       FX de combat pilotés par le bus : useCombatFx (flottants/projectiles/halos/
                            zones) + FxLayer (rendu) + useWalkAnim (marche animée)
src/ui/                     React : menus, CampaignView (HUD), CharacterSheet, modales
  creator/                    assistant de création multi-étapes (LDB 04/05) : CharacterCreator.tsx
                              (rendu) + draft.ts (état pur : tirages figés, bonus PX, validation)
  gallery/DesignGallery.tsx   galerie design system IN-APP (#412, DEV uniquement) : MasterDetail
                              liste de primitives → spécimen vivant (données réelles) — référence de
                              goût pérenne du canon UI, voir docs/charte-ui.md § « Galerie design
                              system »
  RollShell.tsx               coquille PARTAGÉE et UNIQUE des modales de jet (mono, opposé, ou N
                              contributeurs — le mono = N=1) : Lancer→Chance→Pacte→Résilience→Appliquer
                              + frisson + pickers (dé forcé `caps.picker` / localisation du Critique) +
                              <Dice>. TOUTE modale de jet la PARAMÈTRE : contrôles en props, métier en
                              slots (setup/preInfluence/postRollExtra/forcedExtra) — cf. les hooks
                              `jetProps/*` (ex. useDefenseJetProps) ; aucune mécanique générique
                              réécrite par modale. (Désengagement : pré-jet = MENU d'options via
                              <OptionChooser>, pas un « preview + Lancer » ; le coup dans le dos de
                              « Fuir » est montré INLINE dans la modale.)
  MapCanvas.tsx               primitive de CARTE SVG panoramable/zoomable (#343) : caméra (pan/zoom molette-
                              vers-le-curseur/pinch tactile), fond, TRACÉS et MARQUEURS cliquables data-driven
                              (`paths[]`/`markers[]`/`overlay`/`chrome`), cibles de clic FIABLES (fond
                              pointer-events:none, hit-target large par tracé). AUCUNE logique de voyage dedans
                              (elle reste dans WorldMapView, premier consommateur ; le plan de ville #343-B sera
                              le second). Caméra pure = `worldMapViewport.ts` (clamp/fit/viewOn).
  editor/                     Éditeur v2 : Editor.tsx (shell), editorState.ts (sélection unifiée +
                              mutations PURES), EditorCanvas (pointeur/overlays/resize), Palette (rail
                              d'outils + contenu contextuel), Inspector (DOCKÉ, folds ; scène si rien
                              de sélectionné), LogicDock (triggers/dialogues/rencontres/validation en
                              master-détail, édition live), EffectList (rangées repliées + picker),
                              useSceneHistory (undo/redo), useEditorView (caméra)
src/scenes/                 Documents de scène + campaign.ts (campagne = l'Arène, `arene/arene-projet.json`,
                            projet v2 {scenes, worldMap} — 20 scènes : Bourg+intérieurs, 13 zones, 3 expéditions,
                            embuscade ; AUTHORING par `scripts/arene/generate.mjs`, cartes ASCII → JSON canonique
                            qui RESTE la source éditable dans l'éditeur)
                            + test-fixture.ts (scène neutre `testScene` + rencontre `enc-mutants` des tests de combat)
src/state/asciiMap.ts       AUTHORING de map en ASCII — la MÉTHODE À PRIVILÉGIER pour tout contenu de
                            map (scène/scénario) plutôt que poser les tuiles une à une. `parseAsciiRows(rows,
                            base, legend)` → {w,h,tiles} (1 char = 1 tuile) ; `parseWalledAscii` (box-drawing
                            (2W+1)×(2H+1) : tuiles + MURS d'arête, `:` = porte). Légende de base : `#`mur
                            `~`eau `D`porte `_`fosse `=`planches (surchargeable). Garde-fou : lignes de
                            largeurs inégales / char inconnu → throw. Entités/props/départ : poser des
                            MARQUEURS custom dans l'ASCII (ex. `@BFLr`), nettoyer avant le parse (`replace`)
                            puis scanner leurs positions.
src/net/                    Coop en ligne (relay WebSocket) : relay.ts (RelayClient heartbeat/backoff,
                            RoomHost = un Transport virtuel par siège, RoomGuest), session.ts (hôte-
                            autoritaire : intents allowlist + snapshots), protocol.ts, compress.ts,
                            intents.ts — codes de room 6 chars, reconnexion auto par token (grace 2 min)
                            Reprise du lien invité ou retour de l'hôte (host-up) : GuestSession.rejoin
                            relance le handshake, puis reçoit campagne et snapshot autoritaire frais.
server/                     Worker Cloudflare du relay coop (Durable Object « Room », hibernation WS,
                            TTL 30 min) — npm run relay:dev / relay:deploy
art-ref/                    Illustrations extraites des PDFs + mapping.json (GITIGNORÉ — droits Cubicle 7)
```

## Coop en ligne — limitations connues (traçabilité #254)

Deux restrictions posées en 0cd24a01 (#232/#91) sans ticket au moment du commit — RESTENT en l'état
(lever = travail coop futur, hors #254 qui ferme sur DOCUMENTATION seule) :

- **Cadence COMMANDÉE désactivée hors mode local** — `src/state/seaVoyageFlow.ts` l.876 et l.1541
  gatent la résolution immédiate/headless d'une journée de routine (`runCascadeImmediate`) par
  `get().net.mode === 'local'` (en plus de `seaAutoResolves`/`seaDayAllRoutine`) ; en coop la cadence
  reste JOUR-PAR-JOUR quels que soient les ordres (commentaire au site : « coop = cadence manuelle,
  pas d'auto-pilote des postes d'autrui »). Raison technique : la résolution immédiate est un bloc
  synchrone HÔTE-SEUL qui ne passe par AUCUN owner/intent du registre de modales (`modalArbiter.ts`)
  — elle piloterait donc silencieusement les Tests de routine des postes tenus par des PERSONNAGES
  D'INVITÉS sans leur passer la main (contradiction avec le gating spectateur/ownership déjà posé
  ailleurs, `netOwnership.controlsActive`), même si le résultat reste tracé au PV. Lever ⇒ router les
  Tests de routine par owner de poste comme le fait déjà le registre de modales pour les interruptions.
- **Conseil de bord (paie hebdomadaire + Moral, #229) hostOnly** — `src/state/modalArbiter.ts` l.110-112 :
  décision de bourse PARTAGÉE (argent du groupe) → seul l'hôte la tranche, comme les autres actions à
  l'argent du groupe (achat/vente marchand…) ; aucun routage d'intent coop pour cette décision. Lever
  ⇒ router `pendingCouncil` en intent coop (vote/délégation) comme le reste des décisions partagées.

## Systèmes clés (état actuel)

- **Schéma de Scène + Effets** (`data/schemas/defs-scenes/`) : `Effect` = setFlag, journal, document, **giveTrapping**
  (donner un objet — `trappingId` = id du CATALOGUE → objet à stats ; `custom` = nom libre hors-base → objet
  `misc` ; il n'y a PLUS de `giveItem`/inventaire de groupe), giveMoney, giveXp, startCombat, **transition**
  (scène+entry), startDialogue, **test** (compétence + difficulté + `onSuccess`/`onFailure`),
  endDialogue. Tout est appliqué par `applyEffects` dans le store.
- **Moteur de campagne** : transitions de scènes (registre depuis `campaign`), tests de
  compétence interactifs (modal + branches), inventaire/argent/handouts (state party-level).
- **Inventaire/équipement** : chaque héros a `items: ItemInstance[]` ; `weapons`/`armour`
  ACTIFS dérivés via `recomputeLoadout` (équiper change le combat). Fiche = `CharacterSheet.tsx`.
- **Rendu des entités** : tout passe par `tokenBodyKind` → le **rig** (`src/gameIso/rig/`) : humanoïdes
  bipèdes (carrière + arme + armure + mutations visibles) et créatures non-bipèdes via gabarit corporel
  animé (quadrupède/ailé/serpentin/…). `sprites.ts` ne fournit plus que le décor (props).
  Le sprite monolithique (`creatureSprites.json` + `enemySprite`/`creatureView`) a été retiré (juin 2026).
- **Objets ORIENTÉS** (navires, engins de siège, véhicules terrestres, props directionnels) : un SEUL
  contrat de vues `ViewArt` (`src/gameIso/rig/viewArt.ts`, `front?`/`profile?`/`back?`), sélectionné par
  l'UNIQUE résolveur `project(dir, camRot)` (`rig/facing.ts`) + repli `pickView` ; couverture de vues en
  galerie QC (`oriented-objects.html`). Les véhicules à coque sont routés par `hull.propulsion`
  (`bodyPlan.ts`) : mer/fleuve → gabarit `navire`, terrestre → gabarit `terrestre` (plus de repli
  accidentel d'un attelage vers la coque de navire). Détail : `docs/rendu-pipeline.md` § « Objets orientés ».
- **Éditeur v2** (juin 2026, interface refaite de 0) : iso WYSIWYG, rail d'outils + contenu
  contextuel (pose directe depuis les catalogues), inspecteur DOCKÉ (plus aucune modale d'édition),
  panneau Logique en bas (triggers/dialogues/rencontres/validation, master-détail, édition live →
  undo global), points d'entrée ⚑ et zones de repos dessinés sur la carte, resize à la poignée,
  barre de statut. Bouton « Tester » lance la scène en jeu.
- **Passifs unifiés + corruption data-driven** (réf. **`docs/systeme-passifs.md`**) : tout modificateur
  PASSIF continu (trait/mutation/qualité/trauma/maladie/faim/sort) = une liste de `GameOp` lue par UN
  collecteur `passiveMods(c)` (`engine/trauma.ts`), emballée en `PassiveMod{op, kind}` — le `kind` porte
  l'annulation ET la combinaison (`intrinsèque` = Σ dans la base / autres = pool non-cumul). `charMod` =
  SEUL op de modif de carac (passif ET sort) ; `moveMod` pour le Mouvement (≠ carac : `M` ∉ `CharKey`).
  Traits de profil appliqués `spawn→live` (`Combatant.liveTraits` + `baseWithTraits`, sans double-compte
  du profil bestiaire imprimé FINAL). **Édité en DONNÉES au Codex** : `TraitData`/`QualityData`/`Mutation`
  ont `passive: GameOp[]`, édité par le `<GameOpEditor>` EXISTANT (comme un sort — NE PAS réinventer de
  widget de liste d'ops). **Mutation découplée de sa table** : `mutations.json` (entités) ⊥
  `mutationTables.json` (plages d100 → réf mutation) → plusieurs tables (une par dieu du Chaos, Compagnon T1)
  sans collision. L'APPARENCE d'une mutation (cornes/peau…) reste couche **rig** (≠ GameOp).

## Rigueur compilateur (tsconfig.json / server/tsconfig.json)

- `strict: true` (racine + serveur) + `noUnusedLocals`/`noUnusedParameters: true` (les deux
  configs) — le code mort ne compile plus en silence (#300 cran 1).
- `noUncheckedIndexedAccess` et `exactOptionalPropertyTypes` restent **désactivés** — verdict
  mesuré #300 cran 2 (2026-07-11) : essai en ligne de commande (`tsc --noUncheckedIndexedAccess`
  / `--exactOptionalPropertyTypes`, hors config commitée) sur la racine → **3732** et **960**
  erreurs respectivement, réparties dans QUASIMENT tous les dossiers au prorata de leur taille
  (`src/state` 2094, `src/gameIso` 697, `src/engine` 441, `src/ui` 270, `src/scenes` 142 pour le
  premier flag) — aucun dossier propre à cliqueter isolément. Activation = chantier dédié
  multi-session (refonte des accès indexés / des types optionnels site par site), pas une purge
  mécanique comme le cran 1. Différé, pas écarté.

## Direction visuelle & apparence

- **Un monde VOLUMIQUE, plusieurs regards.** La scène est bâtie en géométrie réelle (unités de grille
  et mètres, cuite par `src/gameIso/backends/webgl/`) puis regardée par une caméra. Trois regards :
  plateau ISOMÉTRIQUE 2.5D « à la Baldur's Gate » (vue 3/4, lacet et zoom CONTINUS), plateau du DESSUS
  de facture tabletop/VTT (grille de cases, murs au trait, pions-disques), et PREMIÈRE PERSONNE (le
  même monde à hauteur d'œil). Aucun regard ne duplique la scène : ce qu'il choisit de MONTRER se lit
  dans le module pur `viewPolicy` (`src/gameIso/stage/viewPolicy.ts`), un verdict par ligne.
- **Le rendu se sert du moteur, jamais l'inverse** : il consomme le moteur de règles pur
  (`src/engine`), le store et le schéma de Scène. Art dessiné/calculé à la main (gabarits corporels
  `rig/`, décor `sprites.ts`, matériaux en donnée), scènes détaillées et ANIMÉES (idle, marche,
  attaque, mort) — pas de carrés de couleur générés par code.
- **Toute apparence (couleur/matériau/géométrie SVG) vit dans un registre `defs/`**, consommée
  par TOUS les renderers — jamais codée en dur dans un renderer, jamais choisie par regex/label
  sur l'id (ban total du regex). Un même élément cuit par le monde volumique et peint par un peintre
  d'authoring (`src/gameIso/authoring/`) partage UNE def. Avant de colorer/dessiner une entité : chercher ou créer sa def
  (`structureAppearance(id)`, `TerrainDef`, etc.), classer par CHAMP DONNÉE (`kind`/`fortified`/…),
  jamais par pattern d'id. Nouveau type de rendu ⇒ étendre la def + le registre `gen-registry.mjs`,
  pas un `if` dans le renderer.
