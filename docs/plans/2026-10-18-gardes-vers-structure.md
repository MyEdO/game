# #2724 — Structure avant garde : rendre le branchement hors du chemin prévu impossible à écrire

Ticket: #2724

> **Plan DATÉ du 2026-10-18** (politique `docs/`, `docs/architecture.md`) — à SUPPRIMER une fois
> exécuté ; git porte l'historique. Mesures prises sur `a81f6f5f5` (tête de `main`). Version 3 :
> la v1 a été jugée PARTIELLE (12 griefs, dont 5 majeurs), la v2 aussi (17 griefs, dont 9
> majeurs, sondes vérifiées au code) ; tous sont intégrés ci-dessous. Le second inventaire (tests
> et murs de lint) est en annexe B.

## 1. Le problème réel

Verbatims utilisateur :
- 2026-10-17 (ouverture du ticket) : « Le projet va finir en un amalgame de garde. »
- 2026-10-18T09:35 : « Pour le ticket 2724, il a été créé sans avoir les recommandation de la
  certification. Le plan qu'il propose n'est pas forcement le meilleur, ni la facon de le résoudre.
  Une chose est certaine, le projet est mal foutu et permet a n'importe quel agent de se brancher un
  peu ou il veut et court-circuiter le bon fonctionnement et créer de la dette »
- 2026-10-18T09:40 : « Même si tu dois prendre de la hauteur pour corriger le probleme a l'origine,
  tu dois aussi corriger les sequelles. On ne peut pas laisser une telle dette dormir eternellement »
- 2026-10-18T09:48, à propos d'une tentative antérieure (`critique.ts`) : « De toute facon c'est
  toi qui gagne et non son patron s'il devait en exister un »

Le plan du ticket n'est donc pas une contrainte. Le but : **qu'un agent ne puisse plus se brancher
hors du chemin prévu** (la cause), et **que les branchements déjà faits soient défaits** (les
séquelles).

Constat : TypeScript n'a qu'un niveau de visibilité, `export`. Tout ce qu'un module exporte pour un
voisin légitime est appelable depuis les quelque 1 990 fichiers de production de `src/`. Un agent qui
cherche « la fonction qui fait X » trouve l'applicateur interne avant la porte, l'appelle, et la CI
passe. Le projet a répondu par un scanner de texte et une liste d'exceptions par chemin prévu. Une
telle garde est déterministe, mais elle a deux défauts qu'une structure n'a pas :
- son stock RATIFIE l'existant (« pas plus qu'aujourd'hui », jamais « jamais ») ;
- elle juge un TEXTE, pas une dépendance : elle se satisfait en reformatant (cas mesuré :
  `hardcode.mjs` exempte une lecture d'État si la même ligne porte `wounds.current <= 0`,
  `MACHINERY_RX`, `scripts/guards/lib/hardcode.mjs:169`).

## 2. Fondement

- **Doctrine utilisateur** `user-doctrine-structure-avant-garde` (2026-10-17) : une garde seulement
  là où la structure ne peut pas porter l'invariant. Elle fonde la hiérarchie du §4.
- **Règle du dépôt** (`.claude/rules/gardes-et-hooks.md`, utilisateur 2026-08-16 : « Pas de
  demi-migration ou de guard qui valident l'existent et empeche les nouvelles apparitions, on est
  bien d'accord ? ») : un stock nominatif est une dette vers ZÉRO ; aucun stock neuf. Elle fonde le
  mandat des séquelles (§6).
- **Guide de certification**, pour les deux formes qu'il nomme :
  - leçon 2.3, « Generic tools enable misuse. Constrained alternatives […] enforce the principle of
    least privilege » : rangs 1 et 2 (le module n'expose que ses entrées) ;
  - leçon 1.4, « prerequisite gates that physically block downstream tools until prerequisites
    complete » (le `process_refund` qui exige le `customer_id` que seul `get_customer` rend) :
    rang 3 (la signature exige la preuve).

## 3. Mesure

- **Inventaire 1** (`scripts/guards/lib/`, annexe A) : 203 modules hors tests et `.d.mts` (258
  `.mjs` tests compris ; le ticket en comptait 248 à `e2207b10c`) : OUTIL 90, F2 55, F1→F2 32, F1 26.
  60 portent ou alimentent une liste.
- **Inventaire 2** (annexe B) : les 78 tests qui portent leur propre liste, et les murs d'
  `oxlint.config.mjs`. 31 invariants F1 de plus, dont 4 doublons d'un mur ou d'un autre test.
- Sept lecteurs indépendants pour l'inventaire 1, quatre pour l'inventaire 2 ; chaque ligne lue au
  module et à ses consommateurs.

## 4. Hiérarchie des remèdes

Une conversion prend le PREMIER rang qui tient, vérifié au code avant le geste.

1. **Non exporté.** Le symbole quitte l'`export` ; ses appelants légitimes passent par l'entrée.
2. **Interne de dossier** (primitive neuve, §5) : un fichier sous `X/interne/` n'est importable que
   depuis `X/`. Le « package-private » que TypeScript n'a pas, lisible dans l'arbre, sans liste.
3. **Preuve dans la signature.** L'étape aval exige un type marqué (`unique symbol`) que seule
   l'étape amont fabrique. Patron existant : `src/engine/testOutcome.ts`, `src/i18n/playerText.ts`,
   `src/state/stepBrand.ts`. Le cast qui forgerait la marque est refusé en l'ajoutant à `MARQUES`
   (`oxlint.config.mjs:5`, `murs/marques`). Chaque fabrique légitime est NOMMÉE (réhydratation de
   sauvegarde et setters compris).
4. **Type fermé.** Union de littéraux dérivée du registre, `readonly`, `champ?: never` dans un patch.
5. **Couche.** Règle de direction entre dossiers, forme `murs/purete-imports`.
6. **Mur global.** Lint sur un global (`setTimeout`, `localStorage`, `Math.random`) ou une syntaxe
   (`JSXAttribute role`, littéral `'Escape'`) qu'aucun module ne peut rendre privé. Seule exemption :
   le fichier propriétaire, par `excludeFiles`. Jamais un site.
7. **Reste.** La garde reste, avec sa RAISON NOMMÉE (annexes) et SANS liste (§6).

Chaque conversion :
- supprime dans le même commit la garde, son stock, son test, et le poison de commentaire de son
  périmètre ;
- ajoute la PREUVE STRUCTURELLE qui remplace le test : une ligne `@ts-expect-error` dans un
  `*.test.ts` (patron existant, 32 fichiers) pour les rangs 1, 3, 4 ; un banc `lint.testkit.mjs`
  pour les rangs 2, 5, 6. Le cas qui faisait rougir l'ancienne garde, réintroduit, doit rougir ;
- passe `npm run typecheck:fast` et `npm run test:perimetre` en local, la CI tranche le reste.

Une garde qui n'a jamais rien arrêté de réel (mesuré au `git log` de son déclenchement) se
SUPPRIME sans conversion (`.claude/rules/gardes-et-hooks.md`).

## 5. Primitive : `murs/interne`

- Règle JS du plugin `murs` (`scripts/guards/lib/interneLint.mjs`, enregistrée par `mursLint.mjs`),
  branchée dans `oxlint.config.mjs` sur `src/**` et `scripts/**`, donc jouée par l'éditeur, le
  pre-commit et la CI.
- **Normalisation lexicale, sans lire le disque.** Le pre-commit ne lint que les fichiers stagés,
  recopiés dans un dossier jetable (`lintDeLIndex`, `scripts/guards/lib/lintStage.mjs`) : une
  résolution qui exige l'existence de la cible (`resolveImport`) s'y tairait. Le relatif se résout
  par `path.resolve` ; les alias sont lus dans le `tsconfig.json` du DÉPÔT (`aliasDuDepot`) et
  reposés sous `context.cwd`. L'alias `@/` et les `../` détournés ne contournent donc rien.
- **Énoncé** : si le chemin obtenu porte un segment de DOSSIER `interne`, l'importeur doit vivre
  sous le parent du DERNIER de ces segments. Formes : `import`, `import type`, `export … from`,
  `import()` (chaîne ou gabarit sans expression), `typeof import()`, `require`,
  `import x = require()`.
- **`export *` d'un interne est refusé** hors de ce dossier `interne` : la porte de `X/` réexporte
  par nom.
- **Aucune exemption de test.** Le banc d'un interne vit sous `X/`, où la règle l'admet déjà ; un
  test d'ailleurs passe par la porte, comme la production.
- **Banc** (`scripts/guards/lib/interneLint.test.mjs`, config réelle via `lint.testkit.mjs`) : admis
  (frère, fichier de `X/`, descendant, test sous `X/`) ; refusé (cousin sous les 9 formes, alias
  `@/`, `../` détourné, `export *` depuis `X/`, interne imbriqué, test hors `X/`, cible absente du
  disque, `scripts/`) ; cas fondateur (#495). Mutation : la règle neutralisée, 5 cas rougissent.
- **Coût** (mesure du juge) : 5,5 s pour le plugin seul contre 26,8 s pour le lint complet de
  `src scripts`. Effet de bord déclaré : `fermetureDeConfig` inclut désormais `importGraph.mjs` et
  ses imports ; un staging partiel de l'un d'eux fait sauter le lint du pre-commit, comme pour
  tout module du plugin.
- **Premier consommateur dans le même commit** : `src/ui/editor/interne/resumeDOp.ts`
  (`opSummary`, `formulaSummary`) et `resumeDeCondition.ts` (`condSummary`). Leurs aides partagées
  avec l'atelier ou le Compendium (`OP_LABEL`, `OP_REF_FIELDS`, `opMissingRefs`…) vont dans
  `src/ui/editor/refsDOp.ts`, hors `interne/` (le Compendium les lit). Conversion pure. Supprime
  `src/ui/editor-quarantine-guard.test.ts` (#495) : volet (a) devenu structurel ; volet (b)
  (allowlist de 4 surfaces d'atelier) n'a rien arrêté depuis sa création (`git log` : trois
  commits, aucun ne touche la liste), il se supprime sans conversion.

## 6. Séquelles : chaque stock F1 finit à zéro

Mandat (09:40) : la cause (§5) ne suffit pas. Chaque F1 et chaque partie F1 d'un F1→F2 finit dans
UN de ces états, sans exception :
- **converti** : garde, stock et test supprimés, preuve structurelle en place ;
- **rang 7** : la garde reste, sa raison est nommée, et sa liste est VIDÉE en migrant chaque site
  vers le chemin prévu ; elle devient absolue (`.claude/rules/gardes-et-hooks.md`).

Une liste de propriétaires (`CHANNEL_ALLOWED`, les directives `murs/marques` au site) est un stock
comme un autre. Sa forme cible : les propriétaires sous un même `X/`, le symbole sous
`X/interne/` (rang 2) ; pour une marque, UN seul minteur, placé sous `X/interne/` (rang 2 + rang
3 : une directive par marque, et seuls les fichiers de `X/` fabriquent). Si aucun dossier ne
regroupe les propriétaires sans avaler la moitié d'une couche, la question va à l'utilisateur
avant tout rang 7.

Une conversion qui changerait un comportement n'est plus une conversion pure : elle migre ses sites
dans le même commit, avec sa recette navigateur si un écran change (credo, « Vérifié = prouvé »).

## 7. Vagues

**Vague 1a (cette PR) — la primitive et les conversions pures vérifiées au code :**

| Garde | Rang | Geste |
|---|---|---|
| `murs/interne` + `editor-quarantine-guard` | 2 | §5 |
| `frontiere-state-gameiso.test.ts` | 5 | le mur `murs/purete-imports` refuse aussi l'`import type` de `gameIso` depuis `state` ; `murs/purete` voit l'index du dossier (`(^|/)gameIso(/|$)`), le gabarit sans expression, `require` et `typeof import()`, pour toutes les couches. Bancs dans `lint-parite.test.mjs` (dont les cas a3 et a5 du juge), puis le test part |
| `charKeyLegacy.mjs` | 4 | fermer d'abord les champs typés `string` : `src/data/index.ts:1394` (`char`), `src/data/schemas/defs/creatures.ts:26,68`, `activities.ts:132`, `miscast.ts:70`, `src/data/overrides.ts:98`, vers `charKeySchema`/`CharKey` (et `charStatKeySchema` pour un profil de créature). Preuve : `@ts-expect-error` sur les formes, refus zod au chargement |
| `weatherTestModQuarantine.mjs`, part `weatherPhysicalTestMod` | 1 | la fonction quitte `travelStages.ts:251` pour `weatherTestMod.ts`, non exportée ; `travelStages.test.ts` réécrit contre `weatherTestMods`. Les deux listes de lecteurs restantes suivent le §6 en vague 2 |
| `journalWrite.mjs` | 4 | le `Set` des flux (`src/state/flowTypes.ts`) prend `PatchDeFlux = Partial<Omit<GameState,'journal'>> & { journal?: never }`. Écrivains légitimes : dans `store.ts`, l'action `log`, l'état initial, `startScene` (`:2298`), `applyLoadedSave` (`:92`) ; dans `netFlow.ts`, `applyNetSnapshot` ; les deux remplaceurs reçoivent `RemplacerLEtat`. Route brute restante : `useGame.setState` (API zustand, 43 sites de production) ; sa fermeture (store exporté au `setState` resserré, remise à zéro des tests par un kit) est en vague 2. `src/state/combatFlow.ts` ne doit pas bouger : sinon la ligne passe en vague 3 |

**Vague 1b (PR suivante) — pures, mêmes critères :** `murs/possession` (rang 1 : `ownsLocally`
non exporté, `ownsLocal` rejoint `state/netOwnership` ; poison `ui/ownership.ts:14-15`, groupe mort
`oxlint.config.mjs:85`, `ownership-lint.test.ts:30-32`), `seam-assise-guard` (rang 1 : `patchEntity`
et `patchEntityCombat`, `sceneEdit.ts:594,733`, non exportés), `nakedTimerScan` (rang 6 :
`no-restricted-globals` + `no-restricted-properties` sur `window`, `globalThis`, `self`, `global` ;
le délai de `src/lib/indexedDb.ts` migre vers la primitive de minuterie, aucune exemption de site),
`stockageWebExclusivity` volet global (rang 6, `no-restricted-properties` par propriété, sans
objet), `serverMathRandom` (rang 6, 0 exemption, tests de `server/src` hors périmètre),
`console-no-title-only` (rang 6, sur le périmètre de `CONSOLE_FILES` : 5 fichiers),
`guest-flow-surface` + `guest-surface-class` (rang 4 : table totale
`Record<ActionStore,'invité'|'hôte'|'local'|'interne'>` d'où dérivent `GUEST_INTENTS` et
`COMBAT_INTENTS` ; les 3 + 154 entrées deviennent des valeurs de la table, reclassement chiffré au
commit. Amendement du juge : une action `<flux><Maj>…` est `invité` par le type, hors ouvreur
`parHote` et élection locale ; seuls les flux à surface dérivée (mono, multi `coop: true`) sortent
de la table ; une ouverture `interne` nomme `<module>.<fonction>`. Le volet émission d'écran → classe
reste en rang 7 sans liste, `src/net/intents.test.ts` : aucun écran n'émet une action `interne`, et
toute action `hôte`/`local` est émise par un écran).

**Vague 2 (PR suivantes du ticket) — sites à migrer, formes à trancher, recette navigateur :**
`aria-primitive-guard` (5 rôles, 4 fichiers), `echap-couture-unique` (2 vivants, 2 périmés),
`no-datalist` (3 sites), `mono-stake-ratchet` (10), `hors-modal-intent-path` (32),
`refus-en-francais` (rang 1, 142 fichiers), `player-text-ratchet` (35 casts en 15 tests),
`murs/canal-issue` (17 importeurs ui), `soundRefs` (le schéma de scène `playSfxSchema.id` et son
défaut `''` changent, `gen-registry` doit émettre l'union : contenu éditable, pas pur),
`batchNavalQuarantine` (machinerie de cascade : règle de couche dérivée d'un dossier
`state/naval/`, sinon rang 7) et `sequence-socle-naval` (dossier `state/sequence/` + couche) :
deux formes distinctes, `cascade-step-difficulty` et `roll-line-difficulty` (sites du moteur
`volley.ts:57`, `combat.ts:1586` : la Difficulté affichée au tir de batterie et au tir dévié est
une question de règle), `vesselWoundsWrite` et `plan-species-vocabulaire` (rang 2 + 3, minteur
unique sous `interne/` ; fabriques de coque `seaVoyageFlow.ts:372,383,2663`,
`14-voyage-maritime.ts:145`, `setVessel` ; seul le bloc des casts de `plan-species` part, et
`murs/marques` s'étend à `scripts/**/*.mts`), canaux météo restants (§6),
`journalWrite` route `useGame.setState`, `emetteurEntreeExclusivity`, `raccourcisGlobaux`,
`marcheursDeFlow`, `sceneEditZWrite`, `migrationsVerdictVivant`, `modulesFeuilles`,
`genericDomainImport`, `zodRetire`, `banc-volumique` (volet imports, rang 5), `heroDebout` (piste
`estDebout`).

**Rang 7 nommés, sans liste** : `creator-ossature` (la marque ne traverse pas JSX : `<X/>` est un
`JSX.Element` ; l'invariant « chaque emplacement une fois, action avant choix » se vérifie au
rendu), `targeting-holder-vs-mode`, `scene-prose-graphie-guard`, `generateurs-contrat`.
`netownership-import-isole` est supprimé par #2942 : `src/state` est fermé au noyau (`COUCHES`).

**Vague 3 — fichiers chauds** (`src/state/combatFlow.ts`, `scripts/guards/lib/rollSeamWhitelist.mjs`) :
`combatEventPort` (rang 2, `src/state/combat/interne/`, `combatFlow.ts:263` `export *` réécrit),
seam de jet (`rollSeam*`, `battleRng*`, rang 3 `SeamRng`), `setScan` (707 sites),
`sceneMutation`, `bindingsVivants`, `inBattleFind` (74 sites), `hardcode` `MACHINERY_RX`,
`effect-rule-anchor`, `cascade-step-stake`.
**Coordination avec #1595** : son train `chantier/1595` est en vol (PR #2764). La vague 3 part après
la fusion de ce train, rebasée sur `main`, et s'annonce par un commentaire sur #1595 qui nomme les
fichiers touchés. Chaque commit chaud reste petit pour qu'un conflit se résolve à la main.

## 8. Hors de ce plan, dit

- Le côté AGENT du même problème (un sous-agent qui écrit hors de son brief) relève des hooks
  (leçons 1.4, 1.5) et a ses tickets : #2725 (M5, `SubagentStop`) et #2181 (une garde qui dépasse
  son délai laisse passer l'appel).
- Les stocks des F2 et F1→F2 (annexe A : `labelLogic`, `jambesGabarit`, `grammaireStock`…) ne sont
  pas des branchements : ils restent la dette de leurs propres gardes, hors de ce ticket.
- `critique.ts` : introuvable sur `main`, sur les 247 branches distantes et dans l'historique
  (sonde du 2026-10-18). Le patron de ce plan prime (verbatim 09:48) ; si le fichier réapparaît, il
  migre vers ce patron.

## 9. Critère de fini

- **Vague 1a** : chaque ligne du tableau convertie, sa preuve structurelle verte, `typecheck`
  complet et suite verts en CI, PR fusionnée, `src/state/combatFlow.ts` intact.
- **Ticket** : les 26 F1 de l'annexe A et les 31 de l'annexe B convertis, ou rang 7 nommés et SANS
  liste. Compte final des modules de `scripts/guards/lib/` comparé aux 258 du ticket, et des lignes
  de stock comparé au compte du ticket (17 045), par la même commande, consignée au solde.

## Annexe A — inventaire classé (2026-10-18)

| Module | Nature | Stock | Forme structurelle (F1) | Coût | Note |
|---|---|---|---|---|---|
| `abaisser-priorite.mjs` | OUTIL | non | - | - | - |
| `analyseRetenue.mjs` | F1->F2 | non | - | - | durée de vie d'une ressource, pas de type linéaire |
| `appelsRunners.mjs` | OUTIL | non | - | - | - |
| `arbreImbrique.mjs` | OUTIL | non | - | - | - |
| `arbreProcessus.mjs` | OUTIL | non | - | - | - |
| `balayagesNonResolus.mjs` | F2 | oui (103) | - | - | outillage de tests |
| `bandeEnLigne.mjs` | F1->F2 | oui (2) | - | - | forme d'un gabarit de chaîne |
| `batchNavalQuarantine.mjs` | F1 | non | suppression (0 site vivant) ou lint-declaratif | S | supprimé par #2942 : `murs/quarantaine` (`couchesLint.mjs`), toutes formes d'arc |
| `battleRngEngineLeak.mjs` | F1 | oui (21) | jeton SeamRng fabriqué par le seam | L | #1595 |
| `battleRngEngineLeakWhitelist.mjs` | F1 | oui (21) | suppression avec battleRngEngineLeak | L | #1595 |
| `bindingsVivants.mjs` | F1 | non | type-ferme ReadonlyArray des datasets ; accesseur | L | - |
| `bourseSnapshot.mjs` | F1->F2 | non | - | - | stabilité référentielle |
| `canonUnique.mjs` | OUTIL | non | - | - | - |
| `charKeyLegacy.mjs` | F1 | non | suppression : CharKey déjà union fermée (à vérifier côté JSON) | S | - |
| `cheminsNommes.mts` | F2 | non | - | - | schémas |
| `chipDeRefusNu.mjs` | F1->F2 | oui (6) | - | - | classes CSS |
| `citationCoverage.mjs` | F2 | oui (32) | - | - | JSON |
| `codeSeul.mjs` | OUTIL | non | - | - | - |
| `codesDeSortie.mjs` | OUTIL | non | - | - | - |
| `combatEventPort.mjs` | F1 | oui (6) | jeton BusToken ou module-prive | M | - |
| `commandeShell.mjs` | OUTIL | non | - | - | - |
| `commentPoison.mjs` | F2 | oui (?) | - | - | commentaires |
| `contratGarde.mjs` | OUTIL | non | - | - | - |
| `controleEcritures.mjs` | OUTIL | non | - | - | - |
| `coupeAuCaractere.mjs` | F1->F2 | non | - | - | forme d'expression de chaîne |
| `coursesCi.mjs` | OUTIL | non | - | - | - |
| `cssConservation.mjs` | OUTIL | non | - | - | - |
| `cssCouches.mjs` | OUTIL | non | - | - | - |
| `cssCouchesAudit.ts` | F2 | oui (~2550) | - | - | CSS |
| `cssCouchesStock.mjs` | F2 | oui (~2550) | - | - | CSS |
| `cssImages.mjs` | OUTIL | non | - | - | - |
| `cssValeurEnTest.mjs` | F2 | non | - | - | texte des tests CSS |
| `cylindreHorsSocle.mjs` | F1->F2 | oui (6 migrations) | - | - | champ public d'un type de donnée |
| `dateLocale.mjs` | OUTIL | non | - | - | - |
| `decisions-baseline.json` | F2 | oui (5) | - | - | commentaires |
| `depotGabarit.mjs` | OUTIL | non | - | - | - |
| `dialecte.mjs` | OUTIL | non | - | - | - |
| `dialogueLabelTest.mjs` | F2 | non | - | - | prose de scène |
| `ecritureJsonAtomique.mjs` | OUTIL | non | - | - | - |
| `ecrituresFichiers.mjs` | OUTIL | non | - | - | - |
| `ecrituresShell.mjs` | OUTIL | non | - | - | - |
| `emetteurEntreeExclusivity.mjs` | F1 | non | deplacement : brancherCdp/geste/frappe dans un module où emetteursBruts est privé | M | scripts/recette |
| `emojiAffordance.mjs` | F2 | non | - | - | Unicode |
| `enfantSupervise.mjs` | OUTIL | non | - | - | - |
| `enteteArbre.mjs` | OUTIL | non | - | - | - |
| `entityConsumers.mjs` | OUTIL | non | - | - | - |
| `entityOrphanStock.mjs` | F2 | oui (~363) | - | - | JSON |
| `eolStage.mjs` | F2 | non | - | - | git |
| `epique.mjs` | OUTIL | non | - | - | - |
| `fermetures.mjs` | OUTIL | non | - | - | - |
| `fichierVitest.mjs` | OUTIL | non | - | - | - |
| `fieldConsumerTargets.mjs` | OUTIL | non | - | - | - |
| `fieldConsumers.mjs` | OUTIL | non | - | - | - |
| `flowTestEngineRoll.mjs` | F1->F2 | non | - | - | graphe d'appels (pas de système d'effets) |
| `folioIntegrity.mjs` | F2 | oui (~108) | - | - | Source |
| `folioLineAlign.mjs` | F2 | oui (40) | - | - | Source |
| `folioLineAlignAudit.ts` | OUTIL | non | - | - | - |
| `folioLineAlignStock.mjs` | F2 | oui (40+8) | - | - | Cohérence citations JSON/Source |
| `folioRatchetStock.mjs` | F2 | oui (108) | - | - | folios JSON vs Source |
| `folioTitleRatchetStock.mjs` | F2 | oui (0, Set vide) | - | - | supprimé par #2942 : la voie C de `book-source-integrity.test.ts` est absolue |
| `formeDeWorkflow.mjs` | F2 | non | - | - | workflows Claude |
| `fuitesPartageesStock.mjs` | F2 | oui (29) | - | - | CSS |
| `fusionPr.mjs` | OUTIL | non | - | - | file de fusion |
| `gameOpRefFk.mjs` | F2 | non | - | - | ids dans JSON |
| `genericDomainImport.mjs` | F1 | non (BASELINES vide) | lint-declaratif ou suppression ; périmètre dérivé d'un manifeste | M | primitive générique n'importe pas un module domanial |
| `gitHorsHote.mjs` | F2 | non | - | - | git dans scripts/ |
| `gitPorte.mjs` | OUTIL | non | - | - | hôte git |
| `globalesNode.mjs` | OUTIL | non | - | - | AST globales Node |
| `grammaireGuard.mjs` | F1->F2 | non | - | - | duplication structurelle de schémas zod, TS ne distingue pas deux déclarations identiques |
| `grammaireStock.mjs` | F1->F2 | oui (~35) | - | - | stock de grammaireGuard |
| `graphiesDHote.mjs` | F1->F2 | non | - | - | globales Node/import.meta, cible scripts/ |
| `groundingCorpus.mjs` | F2 | non | - | - | recherche textuelle docs |
| `hardcode.mjs` | F1->F2 (partie F1) | oui (15 fichiers BASELINES) | deplacement du prédicat wounds<=0 (MACHINERY_RX) vers src/engine/conditions.ts | L | le reste juge un littéral d'id en argument |
| `heroDebout.mjs` | F1->F2 | non (absolu) | piste deplacement vers estDebout | ? | co-occurrence de champs publics |
| `horsStrateAudit.ts` | F2 | non | - | - | JSON |
| `horsStrateStock.mjs` | F2 | oui (~1195) | - | - | JSON |
| `hoteSupervision.ps1` | OUTIL | non | - | - | - |
| `hoteSupervision.py` | OUTIL | non | - | - | - |
| `hunks.mjs` | OUTIL | non | - | - | - |
| `iconRefs.mjs` | F2 | non | - | - | réfs d'icônes TS/JSON vers registre |
| `imperatifSoude.mjs` | F2 | non | - | - | prose Source |
| `importGraph.mjs` | OUTIL | non | - | - | - |
| `inBattleFind.mjs` | F1 | oui (~41 fichiers BASELINES) | deplacement vers inBattleId ; combatants exposé en index | L | - |
| `integriteStock.mjs` | F2 | oui (~1099) | - | - | JSON |
| `intercepterEcritures.mjs` | OUTIL | non | - | - | - |
| `invocation.mjs` | OUTIL | non | - | - | - |
| `jambesGabaritAudit.ts` | F1->F2 | oui (97) | - | - | migration d'art |
| `jambesGabaritStock.mjs` | F1->F2 | oui (97) | - | - | migration d'art |
| `jouer-workflow.mjs` | OUTIL | non | - | - | - |
| `journalWrite.mjs` | F1 | non | type-ferme : patch de set exclut journal hors log (store.ts) ; reste ouvert au type `journal: undefined` (sans `exactOptionalPropertyTypes`), la clé calculée et `useGame.setState` (vague 2) | S | journal écrit hors action log |
| `labelLogic.mjs` | F1->F2 | oui (~30 DETTES_DE_LIBELLE) | - | - | label et id sont des string |
| `lancerDetache.mjs` | OUTIL | non | - | - | - |
| `lancerHook.mjs` | OUTIL | non | - | - | - |
| `lectureDefZod.mjs` | F1->F2 | non | - | - | _zod.def public |
| `lecturesDeLArt.ts` | F1->F2 | non | - | - | littéraux recopiés |
| `legacyVocabStock.mjs` | F2 | oui (222) | - | - | commentaires |
| `liensMarkdown.mjs` | OUTIL | non | - | - | - |
| `lint.testkit.mjs` | OUTIL | non | - | - | - |
| `lintStage.mjs` | OUTIL | non | - | - | - |
| `lister.mjs` | OUTIL | non | - | - | - |
| `litteralJs.mjs` | OUTIL | non | - | - | - |
| `livraison.mjs` | OUTIL | non | - | - | - |
| `livresRecopies.mjs` | F1->F2 | oui (1) | - | - | littéraux recopiant JSON |
| `manualDocsStock.mjs` | F2 | oui (8) | - | - | docs Markdown |
| `marcheursDeFlow.mjs` | F1 | oui (plafond 4) | deplacement : visiteur générique de Flow | M | switch(kind) case seq recopié |
| `marqueursPossedes.mjs` | F1->F2 | oui (OWNERS ~96, 13 poseur absent) | - | - | classes CSS |
| `memoryLinks.mjs` | F2 | non | - | - | mémoire |
| `memosDAnalyse.mjs` | OUTIL | non | - | - | - |
| `migrationsVerdictVivant.mjs` | F1 | non (0 site) | lint-declaratif ou deplacement ; code dans scripts/ | S | migrations n'atteignent pas derive-decoupes |
| `mobilierExemptions.mjs` | F2 | oui (28) | - | - | Source md |
| `modulesFeuilles.mjs` | F1 | oui (1 feuille) | suppression ? (0 importeur) ; sert d'index à sitesDeFermeture | S | scripts/ops |
| `mursLint.mjs` | OUTIL | non | - | - | - |
| `nakedTimerScan.mjs` | F1 | oui (1 fichier + 1 site) | lint-declaratif no-restricted-globals (setTimeout global) | S | - |
| `nature.mjs` | OUTIL | non | - | - | - |
| `natureDuChemin.mjs` | OUTIL | non | - | - | - |
| `nomVisibleDansNom.mjs` | F1->F2 | non | - | - | littéraux JSX accessibilité |
| `npmLockHoisted.mjs` | F2 | non | - | - | Porte sur un fichier de lock npm (JSON), pas sur du code. |
| `occurrencesStock.mjs` | OUTIL | non | - | - | Régénère par AST les compteurs d'occurrences des stocks de structures et de slots (tableaux littéraux exportés). |
| `operationsFs.mjs` | OUTIL | non | - | - | Table des opérations node:fs écrivantes (index des arguments chemin et drapeaux), lue par les détecteurs d'écriture. |
| `paletteLiteralAudit.ts` | F2 | oui (1138, paletteLiteralStock.mjs) | - | - | Porte sur le contenu de chaînes SVG d'art (hex vs jeton), donnée d'art que le compilateur ne voit pas. |
| `paletteLiteralStock.mjs` | F2 | oui (1138) | - | - | Stock de dette sur des données d'art SVG, pas sur du code typable. |
| `palettesDeclarees.ts` | F2 | non | - | - | Porte sur la valeur des couleurs (clarté, chromaticité Oklab) de l'art, hors du système de types. |
| `partViewAudit.ts` | F2 | oui (79 dans rigPartViewStock.mjs + 127 dans rigViewStock.mjs) | - | - | Porte sur la géométrie de chaînes SVG d'art (égalité du front, transforms), invisible au compilateur. |
| `patchCodex.mjs` | OUTIL | non | - | - | Parse, canonise et reconstruit les patchs Codex pour les hooks d'outil. |
| `pdfHorsCouture.mjs` | F2 | oui (17 exemptions) | - | - | Porte sur la forme lexicale de chemins de fichiers dans le code, les JSON et le shell, hors de src/. |
| `perimetreSansEcriture.mjs` | OUTIL | non | - | - | Enveloppe spawnSync qui rejoue les lancements de tests périmétrés sous contrôle d'écriture. |
| `photoArbre.mjs` | OUTIL | non | - | - | Empreinte sha256 de l'arbre de travail git. |
| `pid.mjs` | OUTIL | non | - | - | Primitive unique de sonde d'existence d'un pid. |
| `piloteCascadeAudit.ts` | F1->F2 | oui (36 + 3 exemptions au site) | - | - | Porte sur la forme d'une itération (boucle qui lit ET joue) dans des tests ; TS ne type pas une composition de gestes. |
| `piloteCascadeStock.mjs` | F1->F2 | oui (36) | - | - | Stock de piloteCascadeAudit (même raison). |
| `plageFermante.mjs` | OUTIL | non | - | - | Lecture de ce qu'une plage de commits ferme. |
| `plageStock.mjs` | OUTIL | non | - | - | Porte du push : juge la croissance des stocks nominatifs par commit. |
| `pointDEntree.mjs` | F1->F2 | non | - | - | Porte sur des formes syntaxiques d'expression (lecture d'argv) que TS ne distingue pas d'un usage légitime. |
| `porteDEre.mjs` | OUTIL | non | - | - | Charge la porte telle que le tronc la portait à l'ère d'un commit. |
| `porteSpawn.mjs` | OUTIL | non | - | - | Découpe l'argv des portes du pre-commit sous le plafond Windows. |
| `pregenByLabel.mjs` | F1->F2 | non | - | - | Porte sur la comparaison d'un littéral de chaîne (nom affiché) dans des tests. |
| `processusBorne.mjs` | OUTIL | non | - | - | Lancement borné de processus. |
| `processusJob.cs` | OUTIL | non | - | - | Job object Windows pour superviser les arbres de processus. |
| `processusWorktrees.mjs` | OUTIL | non | - | - | Classe les processus rattachés aux worktrees. |
| `progressionSchemas.mjs` | F2 | non | - | - | Cohérence données JSON / Source. |
| `projetsLivres.mjs` | OUTIL | non | - | - | Lister unique des projets de campagne livrés. |
| `propArtLabels.mjs` | OUTIL | non | - | - | Extraction du label d'une def d'art de décor. |
| `proseInline.mjs` | F2 | oui (52) | - | - | Prose verbatim dans des données JSON. |
| `proseNommee.mjs` | F2 | non | - | - | Nature sémantique d'un champ de schéma (prose ou non). |
| `protectionWorktree.mjs` | OUTIL | non | - | - | Mesure ce qui protège un worktree de la suppression. |
| `provenanceFs.mjs` | OUTIL | non | - | - | Provenance AST des valeurs passées aux opérations fs. |
| `purgerPerimes.mjs` | OUTIL | non | - | - | - |
| `quadDecoAudit.ts` | F2 | non | - | - | art |
| `quadDecoStock.mjs` | F2 | oui (~73) | - | - | art |
| `raccourcisGlobaux.mjs` | F1 | oui (4 marques) | deplacement : primitive unique de touche globale, mode typé | M | - |
| `racineNpm.mjs` | OUTIL | non | - | - | - |
| `racinesBalayees.mjs` | OUTIL | non | - | - | - |
| `racinesDeLaSuite.mjs` | OUTIL | non | - | - | - |
| `rawRefIntegrity.mjs` | F2 | oui (0) | - | - | réfs RAW / Source |
| `reclassementCss.mjs` | F2 | non | - | - | CSS + commit |
| `refsDeLigne.mjs` | F2 | non | - | - | commentaires/docs |
| `regenStock.mts` | OUTIL | non | - | - | - |
| `registreDeDefs.ts` | OUTIL | non | - | - | - |
| `registryIdBranch.mjs` | F1->F2 | oui (~42) | - | - | littéral d'id dans code générique |
| `reglesCoeurLint.mjs` | OUTIL | non | - | - | - |
| `renommageResilient.mjs` | OUTIL | non | - | - | - |
| `requeteMesuree.mjs` | OUTIL | non | - | - | - |
| `revealKindEmission.mjs` | F1->F2 | non | - | - | existence d'un producteur par membre d'union |
| `rigPartViewStock.mjs` | F2 | oui (~79) | - | - | art |
| `rigViewStock.mjs` | F2 | oui (~127) | - | - | art |
| `rollSeamExclusivity.mjs` | F1 | non (stocks dans whitelist) | jeton SeamToken fabriqué par rollSeam.ts + module-prive | L | #1595 ; non pur (surfaçage des jets phase 2) |
| `rollSeamWhitelist.mjs` | F1 | oui (~90) | suppression avec rollSeamExclusivity | L | #1595 |
| `sceneEditZWrite.mjs` | F1 | non | type-ferme : fabrique Placement {rect,z} | M | - |
| `sceneFieldEditability.mjs` | F1->F2 | oui (0) | - | - | atteignabilité UI |
| `sceneMutation.mjs` | F1 | non | type-ferme : DeepReadonly<Scene> au store | L | - |
| `serverMathRandom.mjs` | F1 | non (0) | lint-declaratif no-restricted-properties | S | - |
| `setScan.mjs` | F1 | oui (707 set / 296 resets) | module-prive : set non exposé aux flows ; actions nommées | L | #1595 |
| `sitesDeFermeture.mjs` | F2 | oui (2) | - | - | gh/CI |
| `slotsStock.mjs` | F2 | oui (~268) | - | - | JSON |
| `sondeVitest.mjs` | OUTIL | non | - | - | - |
| `sortByZInline.mjs` | F1->F2 | oui (2) | - | - | réinvention textuelle d'un tri ; TS ne distingue pas une lambda de tri d'un appel à sortByZ |
| `soundRefs.mjs` | F1 | non | type-ferme : playSfx(id: SoundId), union dérivée de SOUND_DEFS ; playSfxSchema.id enum du registre | M | gen-registry émet l'union |
| `sourceCorpus.mjs` | OUTIL | non | - | - | - |
| `sourceRefInline.mjs` | F1->F2 | non | - | - | littéral de schéma zod redéclaré (typage structurel) |
| `spawnResilient.mjs` | OUTIL | non | - | - | - |
| `specLibelle.mjs` | F1->F2 | oui (1) | - | - | ids JSON non brandés |
| `spellNarratifStock.mjs` | F2 | oui (~256+~364) | - | - | données JSON / règle 5 |
| `stdinBorne.mjs` | OUTIL | non | - | - | - |
| `stdinHorsBorne.mjs` | F2 | non | - | - | hooks d'outil Claude hors src/ |
| `stock.mjs` | OUTIL | non | - | - | - |
| `stockDeSites.mjs` | OUTIL | non | - | - | - |
| `stockageWebExclusivity.mjs` | F1 | non | lint-declaratif no-restricted-globals (globaux DOM) ; sous-garde d'unicité des clés reste F2 | S | - |
| `stocksNominatifs.mjs` | OUTIL | non | - | - | - |
| `structuresStock.mjs` | F2 | oui (~1090, 8 collections) | - | - | JSON |
| `suiteVitest.mjs` | OUTIL | non | - | - | - |
| `sujetDeCommit.mjs` | OUTIL | non | - | - | - |
| `superviserProcessus.mjs` | OUTIL | non | - | - | - |
| `tableConsumerAudit.ts` | F2 | non | - | - | JSON |
| `tableConsumerStock.mjs` | F2 | oui (1) | - | - | JSON |
| `tableLookup.mjs` | F1->F2 | non | - | - | réinvention textuelle d'une recherche par fourchette |
| `ticketsGh.mjs` | OUTIL | non | - | - | - |
| `tsProgram.mjs` | OUTIL | non | - | - | - |
| `typesDAgent.mjs` | OUTIL | non | - | - | - |
| `variantRule.mjs` | F2 | non | - | - | JSON |
| `versionsDerivees.mjs` | F1->F2 | non | - | - | origine d'un littéral numérique |
| `vesselWoundsWrite.mjs` | F1 | oui (2 foyers) | type-ferme : HullWounds brandé fabriqué par seaVoyageFlow.ts seul | M | - |
| `weatherTestModQuarantine.mjs` | F1 | oui (6 importeurs) | deplacement+module-prive de weatherPhysicalTestMod ; canal/précipitations restent | M | - |
| `zodRetire.mjs` | F1 | non | lint-declaratif (dépréciation) ; à vérifier | S | - |

## Annexe B — invariants F1 portés par des tests et des murs (2026-10-18)

Quatre lecteurs, 78 tests à liste et les murs d'`oxlint.config.mjs`. Seuls les F1 figurent ici ; les
F2, NON-GARDE et faces de test d'un module déjà classé (DEJA) sont dans les rendus des lecteurs.

| Invariant (fichier) | Liste | Rang | Vague | Note |
|---|---|---|---|---|
| `murs/marques` | 24 directives au site | 2 + 3 | 2 | une directive par marque, au minteur unique sous `interne/` (§6) |
| `murs/conteneur` | tests exclus | 7 | 2 | l'exclusion des tests gèle 35 `as CascadeStep` en 15 fichiers : vidée avec `player-text-ratchet` |
| `murs/possession` | `excludeFiles` 1 (foyer) | 1 | 1b | §7 |
| `murs/canal-issue` | 2 goulots | 1 | 2 | doublon de `cascade-consequence` `ISSUE_GOULOTS` ; 17 importeurs ui des `describe*` |
| `frontiere-state-gameiso.test.ts` | 0 | 5 | 1a | absorbé par `murs/purete*` élargis (§7) |
| `effect-rule-anchor.test.ts` | BASELINE 20 | 4 | 3 | union `OpsCtx` qui exige l'ancrage ; 12 fichiers ; chaud ; non pur |
| `scene-prose-graphie-guard.test.ts` | - | 7 | - | producteurs `.mjs` non typés, déjà refusé au parse |
| `generateurs-contrat.test.mjs` | - | 7 | - | effet d'import |
| `plan-species-vocabulaire.test.ts` | - | 2 + 3 | 2 | `RigSpeciesId` dans `MARQUES`, minteur unique |
| `cascade-step-difficulty-guard.test.ts` | baseline 0 | 4 | 2 | §7 |
| `cascade-step-stake-guard.test.ts` | reste 1 | 4 | 3 | chaud (`testFlow` ×5 dans `combatFlow.ts`) ; enjeu authoré rang 7 |
| `combat-event-port-guard.test.ts` | WHITELIST 6 | 2 | 3 | face de `combatEventPort.mjs` |
| `guest-flow-surface.test.ts` | HORS_SURFACE 3, OUVERTURE 28 | 4 | 1b | §7 |
| `guest-surface-class.test.ts` | HORS_SURFACE_UI 154 | 4 | 1b | §7 |
| `hors-modal-intent-path.test.ts` | EMISSION 32 | 4 | 2 | champ `emission` requis au type de `ROUTES` ; preuve `parUI` rang 7 |
| `player-text-ratchet.test.ts` | 35 casts / 15 fichiers | 3 | 2 | mur d'import `fixtureText` ; `murs/marques` étendu aux tests |
| `roll-seam-exclusivity-guard.test.ts` | LIGNE_A_LA_MAIN 5, ETAPE_A_LA_MAIN 12 | 4 | 3 | face de `rollSeamExclusivity.mjs` ; chaud |
| `sequence-socle-naval.test.ts` | - | 5 | 2 | forme distincte de `batchNavalQuarantine.mjs` |
| `targeting-holder-vs-mode.test.ts` | - | 7 | 3 | deux prédicats jumeaux ; cycle `netOwnership`→`targetingModes`→`combatFlow` |
| `aria-primitive-guard.test.ts` | OWNERS 5, BASELINE 4 fichiers / 5 rôles | 6 | 2 | `CityHubScreen.tsx:362`, `MediaSelect.tsx:73`, `EditorToolbar.tsx:110`, `CharacterCreator.tsx` ×4 |
| `console-no-title-only.test.ts` | CONSOLE_FILES 5 (périmètre) | 6 | 1b | §7 |
| `creator-ossature.test.tsx` | - | 7 | - | la marque ne traverse pas JSX |
| `echap-couture-unique.test.ts` | BASELINE 4 (2 périmées) | 6 | 2 | vivants `KeyBindingsPanel.tsx:45`, `MediaSelect.tsx:66` |
| `editor-quarantine-guard.test.ts` | ALLOWLIST 4 | 2 | 1a | §5 |
| `no-datalist.test.ts` | 2 fichiers / 3 sites | 6 | 2 | `CodexEdit.tsx:2099`, `StructFields.tsx:722,752` |
| `seam-assise-guard.test.ts` | HORS_SEAM 2 | 1 | 1b | §7 |
| `mono-stake-ratchet.test.ts` | BASELINE 10 | 4 | 2 | `stake` requis sur `RollShell` (`ui/RollShell.tsx:125`) |
| `roll-line-difficulty-guard.test.ts` | BASELINE 0 | 4 | 2 | §7 |
| `netownership-import-isole.test.ts` | - | 7 | - | supprimé par #2942 : `netOwnership.ts` vit au noyau, auquel `COUCHES` ferme `src/state` |
| `refus-en-francais.test.ts` | - | 1 | 2 | entrée zod unique (locale posée) + `no-restricted-imports 'zod'` ; 142 fichiers |
| `banc-volumique.test.ts` | - | 5 / 7 | 2 | imports rang 5, le reste rang 7 |
