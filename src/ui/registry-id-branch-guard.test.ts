import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { scanRegistryIdBranch, scanRawIdEqualities, isRegistryIdBranchExcluded, SCAN_DIRS, SCAN_EXTS, OP_VOCABULARY, VOCABULARY_TYPES } from '../../scripts/guards/lib/registryIdBranch.mjs';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';

/**
 * Garde-fou « branchement par IDENTITÉ dans du code GÉNÉRIQUE » (#842).
 *
 * Doctrine utilisateur (2026-07-26, verbatim) : « "if (id=" n'est jamais une solution. Si je veux
 * rajouter d'autres options, je ne veux pas voir une suite d'id. Soit la cadence n'a rien a faire
 * dans policy, soit faut lui mettre un flag ». Un code qui itère un registre et traite N entrées de
 * façon uniforme ne teste JAMAIS l'identité d'une entrée : le comportement particulier est un
 * ATTRIBUT DÉCLARÉ sur l'entrée, lu comme n'importe quel autre champ.
 *
 * Mécanique (AST TypeScript, structurelle) : `scripts/guards/lib/registryIdBranch.mjs`. Elle vise
 * quatre formes — égalité, `switch`, appartenance à une liste fermée, table littérale à clé ouverte —
 * TOUJOURS conditionnées à une liaison GÉNÉRIQUE (entrée reçue en paramètre, itérée, ou prop de
 * composant). Un lookup par id stable (`skills.find((s) => s.id === 'resistance')`) et la
 * lecture d'un champ déclaré (`regle.kind === 'flag'`) restent hors de portée : ce sont les formes
 * saines.
 *
 * CLIQUET : `CEILING`/`KNOWN` figent la MESURE du jour. Ce plafond est fait pour DESCENDRE jusqu'à
 * zéro, lot de correction après lot de correction — ce n'est pas une liste d'exceptions permanentes.
 * Le test échoue dans les DEUX sens : un site de plus, ou un site de moins sans abaisser le plafond.
 */
/**
 * Compte de sites par fichier, mesuré au 2026-07-26 sur `SCAN_DIRS` (élargi ce jour-là à `src/gameIso`,
 * `src/data` et `scripts`, et à l'identité nommée `ref`/`xxxRef`). Chaque entrée est un site à TRAITER
 * (attribut déclaré sur l'entrée) ou à réfuter par une correction de la mécanique — jamais à conserver
 * telle quelle.
 *
 * RE-MESURE 2026-08-16 (#1318 V6) : 39 → 60. Deux corrections du DÉTECTEUR ont démasqué des sites
 * qui existaient déjà (aucune régression de code, aucun site corrigé dans ce lot) :
 *  - le trou `for…of` (la variable de boucle, déclarée GÉNÉRIQUE, était aussitôt redéclarée VALEUR
 *    par la re-visite de l'initialiseur : AUCUNE boucle n'était vue) ;
 *  - l'identité `book` ajoutée à `ID_NAME_RX` (`source.book`, sigle de livre).
 * Les entrées neuves portent leur motif NOMINATIF ci-dessous : stock avoué, à faire DÉCROÎTRE.
 * Descente mesurée depuis : 60 → 58 (lots E4/C0+C1, `bc54767e`), puis 58 → 54 (lot E4/C2+C3,
 * 2026-08-17) — `creation.ts` et `CharacterCreator.tsx` (gate d'espèce passé au champ
 * `SpeciesData.gatedByRule`), `combat.ts` et `draft.ts` (tables `Record<union fermée, …>`), puis
 * 54 → 50 (lot E4/C4-groups, 2026-08-17) — `groups.ts` sort de la liste : l'appartenance à un
 * Groupe est DÉCLARÉE en donnée (`grantGroups` d'espèce/carrière/classe/culte/créature,
 * `matchesAll`/`exceptGroups` du Groupe joker), puis 50 → 46 (lot E4/C4-δ1, 2026-08-17) —
 * `persistence.ts` et `exposure.ts` sortent de la liste (persistance d'État déclarée par
 * `EtatData.persistsAfterCombat`, dissipation au répit par `ActiveEffect.expiresOnRespite`) et
 * `seaVoyageFlow.ts` passe de 2 à 1 (`DiseaseDef.contaminatesWaterBarrel`), puis 46 → 37 (lot E4/C4-δ2,
 * 2026-08-17) — `creatureEquip.ts`, `polymorph.ts`, `items.ts`, `conjuredWeapons.ts`, `skills.ts` et
 * `careerSlots.ts` sortent de la liste : Trait exclu d'un octroi en masse
 * (`TraitData.nonTransferable`), Mains nues / Arme improvisée (`TrappingData.unarmed`/`improvised`),
 * Domaine arcanique octroyé (`TalentData.grantsArcaneDomain`) et caractéristique alternative sous règle
 * (`SkillData.altChar`) sont DÉCLARÉS sur l'entrée ; l'armement de créature et « une Compétence de
 * Corps à corps » se lisent, eux, sur le `specsSource` que l'entrée déclarait DÉJÀ (aucun champ neuf
 * à tenir synchrone : `weaponFromTrait` passe cette source telle quelle à son résolveur de catalogue),
 * puis 37 → 27 (lot E4/C4-δ3, 2026-08-17) — la couche ACTIVITÉS/UI : `mountTravel.ts`, `massBattleFlow.ts`,
 * `seaVoyageFlow.ts`, `CityHubScreen.tsx`, `CouncilModal.tsx`, `CrewTestModal.tsx` et `InterludeScreen.tsx`
 * sortent de la liste, `combatFlow.ts` passe de 2 à 1. Ce que l'entrée DÉCLARE désormais : la séquelle
 * d'un Incident de monte (`mount.riderTest`/`ridingPenalty`/`forcedAllure`/`preventsMount`/
 * `notHealedByCare`), le réservoir de modificateur qu'un Test dépense (`testModFrom`) et la difficulté
 * DÉRIVÉE d'un écart d'armées (`difficultyFrom`), le Test d'équipage qui coûte du Moral sur DR négatif
 * (`moraleOnNegativeDR`) et celui qui DIRIGE le navire (`steering`), le choix de paie mis en avant
 * (`recommendedPay`), l'écran vers lequel un service PORTE (`opensScreen`), et la catégorie Codex de
 * chaque table de Maladresse (`codexCategory`, `miscast.json` déclarant désormais ses tables), puis
 * 27 → 20 (lot E4/C4-δ4, 2026-08-17) — l'OUTILLAGE `scripts/` : les deux compilateurs de campagne
 * déclarent l'offre de couchage à l'AUTHORING (`scene({ rest })` → `MapSpec.rest`, les deux tables
 * `REST_OFFERS[s.id]` supprimées), `obtainabilityGraph` lit la famille de Sort qu'un Talent ouvre sur
 * son entrée (`combat.castingKind`), `gen-toise-gallery` passe par la primitive `sizeFromTraits`, la
 * planche `_qc-decor-sheet` prend sa liste de mise en avant EN ARGUMENT (`--new=id1,id2`) et
 * `reconcile.mjs` lit le CŒUR d'un livre au registre (`coeurDe`, champ `coeur` de `books.json`), puis
 * 20 → 9 (lot E4/C-γ, 2026-08-17) — le cluster AMPUTATION/comptage : `critical.ts`, `trauma.ts`,
 * `injuries.ts` et `CharacterSheet.tsx` sortent de la liste. Ce que l'entrée DÉCLARE désormais : la règle
 * de COMPTAGE d'une séquelle cumulative (`TraumaFiche.cumul` — portée, unité, effet par palier, seuil
 * d'escalade `remplace`/`ajoute`), son routage d'APPARENCE sur le rig (`TraumaFiche.rig`), les PALIERS
 * d'entraînement d'une prothèse (`TrappingData.prosthesisTraining`) et les deux escalades de Blessure
 * critique, chacune en AXE paramétré (`escalation.perRound`/`apresDelai` : séquelle visée + cadence/délai),
 * puis 9 → 6 (lot E4/Cε, 2026-08-17) — DEUX formes SAINES de plus dans le scanner, chacune avec sa
 * contre-épreuve (aucun site de code assaini par déclaration ici, sauf le masque du harnais de volume) :
 * le VOCABULAIRE `GameOp` (`op.ref === 'self'` — mot réservé, `OP_VOCABULARY` ; `combatFlow.ts` sort de
 * la liste) et les ids de GÉOMÉTRIE d'union fermée (`VOCABULARY_TYPES` = `BoneId` ; `skeletons.ts` sort,
 * `mesure-volume.mts` aussi une fois son masque de tronc écrit comme ses deux masques voisins,
 * `TORSO_BONES: BoneId[]`).
 */
const KNOWN: Record<string, number> = {
  // GEL NOMINATIF — chaque entrée porte sa CONDITION DE SORTIE ; aucune n'est une exception permanente.
  // Sortie : les deux propriétés du prop (SUSPENDU au-dessus du vide, ADMIS sur les cellules de siège)
  // déclarées sur la def de décor `src/gameIso/catalog/decor/` — périmètre gameIso, hors de ce lot.
  'scripts/qc/opera-furniture-check.mts': 2, // `FLOATING.has(e.ref)` (lustre SUSPENDU) + `e.ref !== 'siege'`
  // Sortie : la zone rémanente déclarée sur la manœuvre (`{ blocksLoS, rounds: ManeuverMeasure }` —
  // la géométrie `smokeZone` est déjà celle, générique, d'un souffle). Le champ seul ne suffit pas :
  // les DEUX textes `manv.smoke`/`manv.smokeZone` (`src/i18n/messages/fr.ts:426-427`) nomment la fumée,
  // et une branche générique les servirait à toute autre manœuvre — leur généralisation change le
  // libellé de zone et la ligne de journal à l'écran (recette navigateur + arbitrage de goût).
  'src/state/combatManeuvers.ts': 1, // `def.id === 'souffle-fumee'` (zone `blocksLoS`, LDB 85 l.329)
  // Sortie : l'Arène intégrée devient une ENTRÉE de `builtinCampaigns` (une seule boucle de rangées,
  // plus de rangée en dur) — refonte d'ÉCRAN, donc recette navigateur exigée au commit.
  'src/ui/PartyScreen.tsx': 2, // `currentId === 'arene'` ×2 (rangée de la campagne intégrée)
  // Sortie : `label` porté par les 4 Traits de construction de `ship-construction.json` (MDG 12 l.167-193)
  // + schéma, la table de libellés supprimée — mouvement de DONNÉE, à commissionner.
  'src/ui/compendium/registry.ts': 1, // `CONSTRUCTION_TRAIT_LABEL[t.id]`
};

/** Plafond GLOBAL du jour (= somme de `KNOWN`), destiné à tomber à 0. */
const CEILING = Object.values(KNOWN).reduce((s, n) => s + n, 0);

/**
 * SECOND CLIQUET — la forme BRUTE « <champ d'identité> === '<littéral>' », sans aucune condition de
 * liaison (`scanRawIdEqualities`). Il ne mesure PAS la doctrine : les formes que le garde principal
 * laisse hors champ à raison (lookup par id stable dans un `.find`/`.some`, entrée tenue par une
 * constante de module) sont ici comptées, et y figurer n'est pas une faute. Ce qu'il verrouille, c'est
 * l'ÉVASION : `if (id === 'x')` réécrit en `xs.some((t) => t.id === 'x')` éteint le garde principal
 * sans rien assainir — le compte brut, lui, ne bouge pas et la fuite se voit.
 *
 * SA COUVERTURE, ET RIEN DE PLUS : le seul critère est le NOM du champ (`id`/`xxxId`/`ref`/`xxxRef`/
 * `book`) sur un nœud d'ÉGALITÉ. Un alias RENOMMÉ (`const cle = t.id; cle === 'x'`) échappe aux DEUX
 * gardes — angle mort mesuré et ASSERTÉ en test ci-dessous, avec les autres (destructuration
 * renommée, `switch`/`includes`, `Object.is`, gabarit à substitution, champ hors convention). Ce
 * cliquet borne l'évasion la plus PROBABLE (déplacer le site dans un prédicat), pas toutes.
 *
 * Deux sens, comme le plafond principal : une hausse est nominative (un branchement brut de plus),
 * une baisse non répercutée est « périmée » (le compte doit descendre dans ce fichier). Ce compte NE
 * DOIT JAMAIS MONTER, et chaque lot d'assainissement doit le faire DESCENDRE.
 * Mesure du 2026-08-17 (#1318 E4/C0-a), par NŒUD (deux comparaisons sur une même ligne pèsent 2) :
 * 169 au moment de la pose du cliquet, 165 après le lot C1 (marqueurs de cargaison passés en donnée —
 * `registry.ts` et `PortView.tsx` sortent de la liste), 163 après le lot C2 (gate d'espèce en champ
 * déclaré : `creation.ts` sort de la liste, `CharacterCreator.tsx` passe de 8 à 7), 160 après le lot
 * C4-groups (appartenance de Groupe déclarée en donnée : `groups.ts` sort de la liste), 158 après le
 * lot C4-δ1 (politique de dissipation déclarée sur l'effet : `exposure.ts` sort de la liste), 146 après
 * le lot C4-δ2 (Trait intransférable, Mains nues / Arme improvisée, Domaine arcanique octroyé et
 * caractéristique alternative déclarés sur l'entrée ; armement de créature et « Compétence de Corps à
 * corps » lus sur le `specsSource` déjà déclaré : `creatureEquip.ts`, `polymorph.ts`, `items.ts`,
 * `conjuredWeapons.ts`, `skills.ts` et `combat.ts` sortent de la liste, `careerSlots.ts` passe de 2 à 1
 * et `CharacterCreator.tsx` de 7 à 6), 136 après le lot C4-δ3 (couche activités/UI : `mountTravel.ts`,
 * `massBattleFlow.ts`, `CityHubScreen.tsx`, `CouncilModal.tsx` et `CrewTestModal.tsx` sortent de la liste,
 * `seaVoyageFlow.ts` passe de 6 à 4, `combatSlice.ts` de 3 à 2 et `InterludeScreen.tsx` de 3 à 2),
 * 131 après le lot C4-δ4 (outillage : `obtainabilityGraph.ts`, `gen-toise-gallery.mts` et
 * `reconcile.mjs` sortent de la liste — famille de Sort lue sur le Talent, Taille lue par
 * `sizeFromTraits`, cœur d'un livre lu au registre `books.json`), 112 après le lot E4/C-γ (cluster
 * amputation/comptage : `CharacterSheet.tsx` et `partyFlow.ts` sortent de la liste — paliers de prothèse
 * déclarés au catalogue —, `critical.ts` passe de 5 à 1, `trauma.ts` de 10 à 4 et `injuries.ts` de 5 à 2 ;
 * la prose de ce lot annonçait 113, la SOMME de la table valait 112 — écart de prose corrigé au lot Cε,
 * mesure re-faite), puis 110 après le lot E4/Cε (mot de VOCABULAIRE `'self'` hors champ des DEUX
 * détecteurs : `combatFlow.ts` passe de 4 à 3 ; masque de tronc du harnais de volume écrit en collection
 * `BoneId[]` : `mesure-volume.mts` sort de la liste), puis 109 après le lot « anneau ami en donnée »
 * (le MODE de ciblage déclare son anneau de candidats sur son entrée — `tmode.anneauCandidats`, plus de
 * `tmode.id === 'heal'` : `highlightLayer.tsx` sort de la liste), puis 108 après le lot #1479 (la
 * conséquence d'une collision en mer lit la DONNÉE qui ouvre l'issue — `entangleChancePct`, symétrique
 * de `strandChancePct` — au lieu de l'id du péril : `seaVoyageFlow.ts` passe de 4 à 3).
 *
 * MONTÉE DE COUVERTURE (L2 #1548), la seule qui fasse MONTER ce plafond sans qu'un site soit né : la
 * mesure brute résout désormais les CONSTANTES DE MODULE (`const X = 'lit'` → `=== X`). Quatre sites
 * PRÉEXISTANTS redeviennent visibles — `healing.ts` (1, dont le littéral venait d'être factorisé en
 * `HEAL_SKILL` : la comparaison n'avait pas bougé), `commandTeam.ts` (1) et `CarnetScreen.tsx` (2),
 * jusque-là comptés 0 par le seul effet de leur écriture. Aucun d'eux n'est un branchement nouveau.
 */
const RAW_KNOWN: Record<string, number> = {
  // SAIN (#1738) : `ref === REF_TRONC` compare `github.ref` à `refs/heads/main` — une REF GIT
  // (`refs/pull/N/merge` en est une autre), pas l'id d'une entrée de registre. Le scan brut le
  // compte parce que le nom `ref` est dans `ID_NAME_RX` et que la constante de module est résolue
  // (L2 #1548) ; aucun attribut déclarable n'existe sur une ref git.
  'scripts/gates/classerPush.mjs': 1,
  'scripts/gen-bestiary-gallery.mts': 1,
  'scripts/gen-creature-attacks-gallery.mts': 2,
  'scripts/qc/opera-furniture-check.mts': 1,
  'src/engine/activities.ts': 1,
  // SAIN (#1612) : `bourseInstanceOf` RETROUVE l'instance de la Bourse dans l'inventaire par l'id
  // STABLE de son trapping (`BOURSE_TRAPPING_ID`, `trappings.json`) — un LOOKUP par référence, pas un
  // branchement de comportement : aucune conduite ne diffère selon l'id. Même patron que les jumeaux
  // `careerSlots` ('focalisation') et `healing` (`HEAL_SKILL`) ci-dessous ; la constante de module est
  // résolue par le scan brut (L2 #1548), donc la factorisation ne l'assainit pas et ne le prétend pas.
  'src/engine/bourse.ts': 1,
  'src/engine/careerSlots.ts': 1, // reste `s.id === 'focalisation'` (lookup par id stable)
  'src/engine/corruption.ts': 2,
  'src/engine/crewedWeapon.ts': 1,
  'src/engine/drunkenness.ts': 1,
  'src/engine/engagement.ts': 2,
  'src/engine/equipCompare.ts': 2,
  // SAIN : lookup par id stable de la Compétence de soin, patron des jumeaux `careerSlots` ('focalisation')
  // et `critical` ('resistance') ci-dessus. Le littéral est factorisé en `HEAL_SKILL` (source unique des
  // sites qui la testent) : la comparaison reste la MÊME et reste COMPTÉE — le scanner brut résout désormais
  // les constantes de module (L2 #1548), une factorisation n'assainit rien.
  'src/engine/healing.ts': 1,
  'src/engine/magic.ts': 3,
  'src/engine/menace.ts': 1,
  'src/engine/provisions.ts': 1,
  'src/engine/psychology.ts': 3,
  // 3 → 2 (L2 #1548, commit 3b) : le Test d'équipage d'un Critique fluvial désigne une CARACTÉRISTIQUE
  // (`crewTest.char === 'initiative'`), plus un id de registre de Compétence.
  'src/engine/riverNavigation.ts': 1,
  'src/engine/seaNavigation.ts': 1,
  // 4 → 7 (L2 #1548, commit 3c) : AUCUNE comparaison neuve — les trois `o.skill === 'esquive'` de
  // `downgradeTornMuscle`/`traumaDodgePenalty`/`traumaSkillPenalty` lisent la MÊME chose qu'avant, mais
  // la référence de Compétence étant EMBOÎTÉE leur accès passe par `.id`, que ce cliquet BRUT compte.
  // L'Esquive y est NOMMÉE par le RAW (LDB 18 : la mobilité d'un membre pèse sur l'Esquive).
  // 7 → 8 (#1599) : le poseur UNIQUE de l'annulateur `determination` (`poseDeterminationCanceller`) vient
  // de `combatSlice.ts` (3 → 2 → 1 ci-dessous) — un DÉPLACEMENT vers le module qui POSSÈDE la table
  // `PASSIVE_CANCELLERS`, à somme nulle, jamais un site neuf. Le reste : pénalité de combat PAR MAIN
  // (doigts/main) + crochet entraîné + Esquive nommée au RAW — axes NON couverts par `cumul`.
  // 8 → 7 (#1692) : `FICHE_BY_ID`/`CUMUL_FICHES` figés à l'import deviennent des accesseurs vifs
  // (`ficheById`/`cumulFiches`) — une comparaison d'id de la construction figée disparaît avec elle.
  'src/engine/trauma.ts': 7,
  'src/engine/weaponDamage.ts': 1,
  'src/engine/windsOfMagic.ts': 1,
  'src/gameIso/rig/mountedRig.ts': 1,
  'src/gameIso/rig/parts/career.ts': 3,
  'src/gameIso/rig/parts/equipment.ts': 1,
  'src/gameIso/rig/parts/injuries.ts': 2, // reste le canal APPARENCE (œil remplacé en place), hors `rig` (calques)
  'src/gameIso/stage/Ambiance.tsx': 1,
  'src/gameIso/stage/CrewTooltip.tsx': 1,
  'src/gameIso/tokenBodyKind.tsx': 1,
  'src/state/aiSpellValue.ts': 2,
  'src/state/combatEffects.ts': 3,
  'src/state/combatFlow.ts': 3, // `op.ref === 'self'` hors champ (mot du vocabulaire GameOp, lot Cε)
  'src/state/combatGeometry.ts': 1,
  'src/state/combatManeuvers.ts': 4,
  'src/state/combatSlice.ts': 1, // 2 → 1 (#1599) : la pose de l'annulateur `determination` part chez son propriétaire (`engine/trauma.ts`)
  // RÉVÉLÉ (jamais neuf) par la résolution des constantes de module, L2 #1548 : `q.id === ARME_D_EQUIPE`
  // est un lookup par id stable d'une Qualité au registre — même patron que `healing`/`careerSlots`.
  'src/state/commandTeam.ts': 1,
  'src/state/devtools.ts': 1,
  'src/state/interludeFlow.ts': 4,
  'src/state/mount.ts': 1,
  'src/state/riverVoyageFlow.ts': 4,
  'src/state/seaVoyageFlow.ts': 3, // 4 → 3 (#1479 : la conséquence d'un péril lit sa DONNÉE `entangleChancePct`, plus `hazard.id === 'debris-marins'`)
  'src/state/store.ts': 1,
  'src/state/travelFlow.ts': 6,
  'src/state/travelPostes.ts': 2,
  'src/state/vision.ts': 1,
  // Le site de `ui/ownership.ts` est la comparaison au sentinel `'*'` de l'arbitre de modales (owner =
  //  tous les sièges) dans la porte de possession `spectatorSeatOfModal` : un mot du VOCABULAIRE du
  //  protocole de modales, jamais un id d'entité — c'est la décision « qui nomme le siège attendu »,
  //  et elle est UNE (`ActiveModal.tsx` la lit sans la refaire, il ne compte donc aucun site).
  'src/ui/ownership.ts': 1,
  // RÉVÉLÉ (jamais neuf) par la résolution des constantes de module, L2 #1548 : `PINNED_SEL`
  // (`'__pinned__'`) est une SENTINELLE de sélection d'écran (la rangée « Épinglés », qui n'est pas une
  // affaire), jamais l'identité d'une entrée de registre — famille du `''` d'`OP_VOCABULARY`.
  'src/ui/CarnetScreen.tsx': 2,
  'src/ui/HealModal.tsx': 2,
  'src/ui/InterludeScreen.tsx': 2,
  'src/ui/MedicModal.tsx': 2,
  'src/ui/MerchantPanel.tsx': 1,
  'src/ui/PartyScreen.tsx': 2,
  'src/ui/creator/CharacterCreator.tsx': 6,
  'src/ui/editor/StatblockEditor.tsx': 1,
  'src/ui/gallery/registry.tsx': 4,
};

/** Plafond BRUT global du jour (= somme de `RAW_KNOWN`). */
const RAW_CEILING = Object.values(RAW_KNOWN).reduce((s, n) => s + n, 0);

/** Les DEUX détecteurs passent sur le MÊME corpus, fichier par fichier et l'un après l'autre : un
 *  seul parcours de dossiers (`readCorpus`, primitive unique de marche de corpus source — les tests
 *  sont pris puis écartés par `isRegistryIdBranchExcluded`, qui porte AUSSI l'exclusion des
 *  migrations), une seule lecture, et l'arbre syntaxique d'un fichier sert aux deux scans (cache de
 *  taille un, `registryIdBranch.mjs`). Mémoïsation PARESSEUSE par jeu de dossiers — le corpus est
 *  marché au 1ᵉʳ `it` qui le demande, jamais à la collecte des tests. */
const _analyses = new Map<string, {
  principal: { rel: string; line: number; detail: string; rule: string }[];
  brut: { rel: string; line: number; detail: string }[];
}>();

function analyse(dirs: string[]) {
  const cle = dirs.join('|');
  let a = _analyses.get(cle);
  if (!a) {
    a = { principal: [], brut: [] };
    for (const { rel, text } of readCorpus(dirs, { exts: SCAN_EXTS, tests: true })) {
      if (isRegistryIdBranchExcluded(rel)) continue;
      for (const fd of scanRegistryIdBranch(rel, text)) a.principal.push({ rel, ...fd });
      for (const fd of scanRawIdEqualities(rel, text)) a.brut.push({ rel, ...fd });
    }
    _analyses.set(cle, a);
  }
  return a;
}

function findingsIn(dirs: string[]): { rel: string; line: number; detail: string; rule: string }[] {
  return analyse(dirs).principal;
}

/** MÊME corpus, MÊMES exclusions, détecteur BRUT (`scanRawIdEqualities`) — le cliquet anti-évasion. */
function rawFindingsIn(dirs: string[]): { rel: string; line: number; detail: string }[] {
  return analyse(dirs).brut;
}

const rules = (src: string, name = 'fixture.ts') => scanRegistryIdBranch(name, src).map((f) => f.rule);

describe('garde-fou « branchement par identité dans du code générique » (#842)', () => {
  it('MORSURE : le branchement sur l’identité d’une entrée reçue est détecté', () => {
    // Cas PLANTÉS = les DEUX motifs réels du panneau « Règles maison » — un panneau dont l'en-tête
    // proclame qu'il « ne connaît aucune règle en dur » : la reprise de cadence branchée sur l'id
    // dans le gestionnaire générique, et le bouton de Chance branché sur l'id de l'entrée rendue.
    const handler = [
      'const change = (id: string, v: RuleValue) => {',
      "  if (id === 'combat-cadence') resumeCadence();",
      '  setHouseRule(id, v);',
      '};',
    ].join('\n');
    expect(rules(handler)).toEqual(['id-equality']);

    const row = [
      'function HouseRuleRow({ regle }: { regle: OptionalRule }) {',
      "  return regle.id === 'fortune-mid-session' ? <FortuneButton /> : null;",
      '}',
    ].join('\n');
    expect(rules(row, 'fixture.tsx')).toEqual(['id-equality']);
  });

  it('MORSURE : les trois autres formes (switch, liste fermée, table à clé ouverte)', () => {
    const sw = ['function render(entry: Entry) {', '  switch (entry.id) {', "    case 'a': return 1;", '  }', '}'].join('\n');
    expect(rules(sw)).toEqual(['id-switch']);

    const membership = [
      "const PERSISTENTS = new Set(['hemorragique', 'aveugle']);",
      'export function keep(list: Cond[]) {',
      '  return list.filter((x) => PERSISTENTS.has(x.id));',
      '}',
    ].join('\n');
    expect(rules(membership)).toEqual(['id-membership']);

    const record = [
      "const LABELS: Record<string, string> = { renforce: 'Renforcé', solide: 'Solide' };",
      'export function row(t: Trait) { return LABELS[t.id] ?? t.id; }',
    ].join('\n');
    expect(rules(record)).toEqual(['id-record']);
  });

  it('MORSURE : un ALIAS d’identité est suivi par sa LIAISON, quel que soit son nom', () => {
    const alias = [
      'function row(regle: OptionalRule) {',
      '  const k = regle.id;',
      "  return k === 'combat-cadence';",
      '}',
    ].join('\n');
    expect(rules(alias)).toEqual(['id-equality']);

    const aliasSwitch = [
      'function row(regle: OptionalRule) {',
      '  const k = regle.id;',
      '  switch (k) {',
      "    case 'a': return 1;",
      '  }',
      '}',
    ].join('\n');
    expect(rules(aliasSwitch)).toEqual(['id-switch']);
  });

  it('CONTRE-ÉPREUVE : les formes SAINES restent vertes', () => {
    const sain = [
      // (1) lire un CHAMP DÉCLARÉ sur l'entrée — la forme que la doctrine demande.
      "function Row({ regle }: { regle: OptionalRule }) { return regle.kind === 'flag' ? <Check /> : <Select />; }",
      // (2) comparer à une VARIABLE : une sélection, pas un branchement en dur.
      'const active = tabs.find((t) => t.id === tabKey);',
      // (3) lookup PAR ID STABLE dans un prédicat de sélection.
      "const sk = c.skills.find((s) => s.id === 'resistance');",
      "const has = c.talents.some((t) => t.talentId === 'frenesie');",
      // (4) sentinelle de vide.
      "function pick(id: string) { return id === '' ? null : byId.get(id); }",
      // (5) table EXHAUSTIVE par type : la clé est une union fermée, le compilateur exige l'entrée.
      "const META: Record<StepId, string> = { species: 'Race', career: 'Carrière' };",
      'export function stepLabel(id: StepId) { return META[id]; }',
      // (6) index CALCULÉ : il suit le registre au lieu de le figer.
      'const byId = new Map(REGISTRY.map((e) => [e.id, e]));',
      'export function get(id: string) { return byId.get(id); }',
      // (7) DISCRIMINANT d'union de type : du polymorphisme, pas une identité de registre.
      "function area(a: Area) { return a.kind === 'disc' ? a.r : a.w; }",
      "function paint(el: El) { return el.kind === 'roof' ? roof(el) : wall(el); }",
      // (8) SQUELETTE `Partial<Record<Union, …>>` : clé FERMÉE déclarée en type — l'indexer par un os
      //     reçu n'est pas une table de valeurs par entrée de registre.
      'const SK: Partial<Record<BoneId, Bone>> = { tronc: b1, croupe: b2 };',
      'export function zOf(id: BoneId) { return SK[id]!.z; }',
    ].join('\n');
    expect(rules(sain, 'fixture.tsx')).toEqual([]);
  });

  it('CONTRE-ÉPREUVE : une valeur réservée se lit par sa CONSTANTE (`SELF_REF`) ; son littéral, comme un id d’entrée, est compté', () => {
    // `{op:'scheduleRespawn', ref: SELF_REF}` désigne le PORTEUR de l'op : le code lit la constante du
    // moteur (`src/engine/ops.ts`), hors de portée du scan per-fichier. Le LITTÉRAL `'self'` n'est pas
    // au vocabulaire exempté : le MÊME site l'écrivant en dur est compté par les DEUX gardes.
    const vocabulaire = "import { SELF_REF } from '../engine/ops';\nfunction respawn(op: Op, actor: C) {\n  return op.ref === SELF_REF ? actor.creatureId : op.ref;\n}";
    expect(rules(vocabulaire)).toEqual([]);
    expect(scanRawIdEqualities('fixture.ts', vocabulaire)).toEqual([]);

    const litteral = "function respawn(op: Op, actor: C) {\n  return op.ref === 'self' ? actor.creatureId : op.ref;\n}";
    expect(rules(litteral)).toEqual(['id-equality']);
    expect(scanRawIdEqualities('fixture.ts', litteral)).toHaveLength(1);

    const idDEntree = "function respawn(op: Op, actor: C) {\n  return op.ref === 'phillipe' ? actor.creatureId : op.ref;\n}";
    expect(rules(idDEntree)).toEqual(['id-equality']);
    expect(scanRawIdEqualities('fixture.ts', idDEntree)).toHaveLength(1);

    // La sentinelle de vide, elle, n'a pas bougé (même liste `OP_VOCABULARY`).
    expect(rules("function pick(id: string) { return id === '' ? null : byId.get(id); }")).toEqual([]);
  });

  it('CONTRE-ÉPREUVE : une liste de VOCABULAIRE FERMÉ (`BoneId[]` importé de son module) sort du champ — pas une liste d’ids de registre, pas un type HOMONYME', () => {
    // Ids de GÉOMÉTRIE : `BoneId` est une UNION DE LITTÉRAUX déclarée (`src/gameIso/rig/bones.ts`) — la
    // liste est bornée par son TYPE, pas par un registre de données. Annotation ET argument de type.
    // L'exemption exige l'IMPORT depuis le module canonique : ici `./bones` depuis `src/gameIso/rig/`.
    const geometrie = [
      "import { BONE_IDS, type BoneId } from './bones';",
      "const WAIST_BONES: BoneId[] = ['cuisseG', 'cuisseD'];",
      "const TORSO: Set<BoneId> = new Set<BoneId>(['torse']);",
      'export function build(sk: Skeleton) {',
      '  for (const id of BONE_IDS) { if (WAIST_BONES.includes(id) || TORSO.has(id)) narrow(id); }',
      '}',
    ].join('\n');
    expect(rules(geometrie, 'src/gameIso/rig/fixture.ts')).toEqual([]);
    // Même source, depuis l'OUTILLAGE : le spécificateur relatif est résolu contre le fichier scanné.
    const depuisOutillage = geometrie.replace("'./bones'", "'../../src/gameIso/rig/bones'");
    expect(rules(depuisOutillage, 'scripts/qc/fixture.mts')).toEqual([]);

    // SHADOW : le même NOM, redéclaré localement en alias de `string` — l'ancrage à l'origine est ce
    // qui empêche de blanchir une liste d'ids de registre en la baptisant `BoneId`. Reste COMPTÉ.
    const shadow = [
      'type BoneId = string;',
      "const PERSISTENTS: BoneId[] = ['hemorragique', 'aveugle'];",
      'export function keep(list: Cond[]) {',
      '  for (const c of list) { if (PERSISTENTS.includes(c.id)) garder(c); }',
      '}',
    ].join('\n');
    expect(rules(shadow, 'src/state/fixture.ts')).toEqual(['id-membership']);

    // …et le même nom IMPORTÉ D'AILLEURS (module homonyme) : pas davantage exempté.
    const autreModule = shadow.replace('type BoneId = string;', "import type { BoneId } from './mesOs';");
    expect(rules(autreModule, 'src/state/fixture.ts')).toEqual(['id-membership']);

    // MÊME forme, annotée par un type d'IDENTITÉ DE REGISTRE : `ConditionId` (`src/engine/types.ts`) est
    // un alias `= string`, donc OUVERT — c'est ce qui interdit le proxy lexical général « l'annotation
    // nomme un type non primitif » et impose la table `VOCABULARY_TYPES`. Le site reste COMPTÉ.
    const registre = [
      "const PERSISTENTS: ConditionId[] = ['hemorragique', 'aveugle'];",
      'export function keep(list: Cond[]) {',
      '  for (const c of list) { if (PERSISTENTS.includes(c.id)) garder(c); }',
      '}',
    ].join('\n');
    expect(rules(registre)).toEqual(['id-membership']);
  });

  it('FIGEAGE : le CONTENU des deux vocabulaires exemptés est dit, pas seulement leur mécanique', () => {
    // Étendre l'une de ces listes SE FAIT JUGER, jamais au geste de confort : un mot de plus
    // blanchirait des branchements réels sans que rien ne le dise. Le contenu est donc figé ICI.
    expect([...OP_VOCABULARY].sort()).toEqual(['']);
    expect([...VOCABULARY_TYPES.entries()]).toEqual([['BoneId', 'src/gameIso/rig/bones']]);
  });

  it('CONTRE-ÉPREUVE : un nom déclaré littéral ICI et calculé LÀ n’accuse plus le second', () => {
    // La pré-passe des tables littérales est à PLAT (tout le fichier) : sans levée d’ambiguïté, le
    // `sk` CALCULÉ de la seconde fonction héritait du `sk` littéral de la première.
    const collision = [
      'function build(p: P) {',
      '  const sk = { corps: bone(p), tete: bone(p) };',
      '  return sk;',
      '}',
      'export function draw(p: P, ids: string[]) {',
      '  const sk = build(p);',
      '  return ids.map((id) => sk[id].z);',
      '}',
    ].join('\n');
    expect(rules(collision)).toEqual([]);
  });

  it('MORSURE : l’identité nommée `ref`/`xxxRef` est vue comme un `id`', () => {
    const byRef = [
      'export function decor(el: SceneEntity) {',
      "  return el.ref === 'tonneau' ? tonneauArt() : genericArt(el);",
      '}',
    ].join('\n');
    expect(rules(byRef)).toEqual(['id-equality']);

    const bySuffix = ["export function place(e: Ent) {", "  switch (e.encRef) {", "    case 'embuscade': return 1;", '  }', '}'].join('\n');
    expect(rules(bySuffix)).toEqual(['id-switch']);
  });

  it('MORSURE : la variable d’une boucle `for…of` est GÉNÉRIQUE, dedans comme dehors (#1318 V6)', () => {
    // Le trou historique : la déclaration GÉNÉRIQUE de la variable de boucle était écrasée par la
    // re-visite de l'initialiseur — aucune boucle du dépôt n'était vue. Même faute, hors boucle
    // (déjà mordue) et dans la boucle (démasquée) : les deux DOIVENT mordre.
    const horsBoucle = "export function f(s: Sp) {\n  return s.source.book === 'nadj';\n}";
    expect(rules(horsBoucle)).toEqual(['id-equality']);

    const dansBoucle = [
      'export function g(all: Sp[]) {',
      '  for (const s of all) {',
      "    if (s.source.book === 'nadj') continue;",
      '  }',
      '}',
    ].join('\n');
    expect(rules(dansBoucle)).toEqual(['id-equality']);

    const dansBoucleParId = "export function h(all: E[]) {\n  for (const e of all) {\n    if (e.id === 'gnome') return e;\n  }\n}";
    expect(rules(dansBoucleParId)).toEqual(['id-equality']);
  });

  it('MORSURE : l’identité d’un LIVRE source (`source.book`) est vue comme un `id` (#1318 V6)', () => {
    const byBook = [
      'export function eligible(s: SpeciesData) {',
      "  return s.source.book === 'nuits-agitees-et-dures-journees';",
      '}',
    ].join('\n');
    expect(rules(byBook)).toEqual(['id-equality']);
  });

  it('MORSURE : l’identité d’un livre nommée `abbr`/`ab` est vue comme un `id` (#1825 E1b)', () => {
    // Sigles INVENTÉS : ce banc éprouve le NOM DU CHAMP, il ne recopie aucune identité du registre.
    const byAbbr = ['export function dossier(b: BookData) {', "  return b.abbr === 'XYZ' ? special() : generic(b);", '}'].join('\n');
    expect(rules(byAbbr)).toEqual(['id-equality']);

    const byAb = ['export function couverture(b) {', "  if (b.ab === 'QRS') return special();", '  return generic(b);', '}'].join('\n');
    expect(rules(byAb, 'scripts/raw/probe.mjs')).toEqual(['id-equality']);
  });

  it('MORSURE : l’outillage `scripts/**` en `.mjs` est parsable et scanné', () => {
    const mjs = ["export function compile(entry) {", "  if (entry.ref === 'auberge') return special();", '  return generic(entry);', '}'].join('\n');
    expect(rules(mjs, 'scripts/arene/probe.mjs')).toEqual(['id-equality']);
  });

  it('CÂBLAGE : le scan de CORPUS consomme réellement le détecteur (sur fixture DISQUE)', () => {
    // Preuve de câblage, pas un test du détecteur : `findingsIn` est la MÊME fonction que le cliquet
    // ci-dessous. Si la ligne qui appelle `scanRegistryIdBranch` disparaît de `findingsIn`, ce test
    // rougit — alors que le cliquet, lui, verrait simplement zéro site et resterait sous le plafond.
    const tmp = mkdtempSync(join(tmpdir(), 'registry-id-branch-wiring-'));
    try {
      writeFileSync(join(tmp, 'probe.ts'), "export function probe(entry: E) {\n  return entry.id === 'sonde-cablage';\n}\n");
      expect(findingsIn([tmp]).map((f) => f.detail)).toContain("return entry.id === 'sonde-cablage';");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('CLIQUET : aucun site NOUVEAU, et tout site assaini abaisse le plafond', () => {
    const findings = findingsIn(SCAN_DIRS);
    const perFile: Record<string, number> = {};
    for (const f of findings) perFile[f.rel] = (perFile[f.rel] ?? 0) + 1;

    const worse = Object.entries(perFile)
      .filter(([rel, n]) => n > (KNOWN[rel] ?? 0))
      .map(([rel, n]) => `${rel}: ${n} (plafond ${KNOWN[rel] ?? 0})\n` + findings.filter((f) => f.rel === rel).map((f) => `    ${f.rel}:${f.line} [${f.rule}] ${f.detail}`).join('\n'));
    expect(
      worse,
      'Branchement par IDENTITÉ dans du code générique — le comportement particulier se déclare en ' +
        "CHAMP sur l'entrée du registre (lu comme `regle.kind`), jamais en test d'id :\n" + worse.join('\n'),
    ).toEqual([]);

    const better = Object.entries(KNOWN).filter(([rel, n]) => (perFile[rel] ?? 0) < n).map(([rel, n]) => `${rel}: ${perFile[rel] ?? 0} < ${n}`);
    expect(
      better,
      "Sites assainis : abaisser leur compte dans KNOWN (le plafond descend, il ne remonte jamais) :\n" + better.join('\n'),
    ).toEqual([]);
    expect(findings.length).toBe(CEILING);
  });

  it('MORSURE BRUTE : les liaisons hors champ du garde principal sont comptées, `.startsWith` non', () => {
    // Ce que le garde principal laisse hors champ À RAISON (lookup par id stable, constante de
    // module) : le compte brut, lui, les voit — c'est ce qui rend l'évasion visible.
    const evasions = [
      "const has = c.talents.some((t) => t.talentId === 'frenesie');",
      "const sk = c.skills.find((s) => s.id === 'resistance');",
      "const isFortune = FORTUNE.id === 'fortune-mid-session';",
      "const noyau = REGISTRE[0];\nconst estCadence = noyau.id === 'combat-cadence';",
    ].join('\n');
    expect(scanRegistryIdBranch('fixture.ts', evasions)).toEqual([]);
    expect(scanRawIdEqualities('fixture.ts', evasions)).toHaveLength(4);

    // Hors périmètre du détecteur brut : ce n'est pas une ÉGALITÉ, ou pas un champ d'identité.
    const horsPerimetre = [
      "const fam = regle.id.startsWith('combat-');",
      "const sel = tabs.find((t) => t.id === tabKey);",
      "const kind = regle.kind === 'flag';",
      "const vide = id === '';",
    ].join('\n');
    expect(scanRawIdEqualities('fixture.ts', horsPerimetre)).toEqual([]);
  });

  it('MORSURE BRUTE : deux comparaisons sur UNE ligne pèsent DEUX (compte par nœud)', () => {
    // Le garde principal déduplique par ligne : n'en éteindre qu'une n'y changerait rien. Ici si.
    const uneLigne = "const l = (id: string) => id === 'commerce' ? 'A' : id === 'minimum-vital' ? 'B' : id;";
    expect(scanRegistryIdBranch('fixture.ts', uneLigne)).toHaveLength(1);
    expect(scanRawIdEqualities('fixture.ts', uneLigne)).toHaveLength(2);
  });

  it('MORSURE BRUTE : une CONSTANTE DE MODULE ne cache pas la comparaison (l’évasion par factorisation, L2 #1548)', () => {
    // Factoriser `e.id === 'commerce'` en `const CLE = 'commerce'` ne change RIEN à la comparaison :
    // la mesure brute résout la constante du MÊME fichier et compte le site comme avant.
    const parConstante = "const CLE = 'commerce';\nfunction f(e: E) { return e.id === CLE; }";
    expect(scanRawIdEqualities('fixture.ts', parConstante)).toHaveLength(1);
    expect(scanRawIdEqualities('fixture.ts', parConstante)[0].line).toBe(2);
    // La résolution s'arrête au FICHIER : une constante IMPORTÉE reste hors de portée (scan per-fichier).
    expect(scanRawIdEqualities('fixture.ts', "import { CLE } from './cles';\nfunction f(e: E) { return e.id === CLE; }")).toEqual([]);
    // Un mot du VOCABULAIRE tenu par une constante ne désigne pas plus d'entrée que son littéral.
    expect(scanRawIdEqualities('fixture.ts', "const VIDE = '';\nfunction f(o: Op) { return o.ref === VIDE; }")).toEqual([]);
    // Une constante qui n'est PAS un littéral chaîne ne désigne rien non plus.
    expect(scanRawIdEqualities('fixture.ts', 'const CLE = compute();\nfunction f(e: E) { return e.id === CLE; }')).toEqual([]);
  });

  it('ANGLES MORTS ASSERTÉS : ce que les deux gardes ne voient PAS, écrit noir sur blanc', () => {
    // Un détecteur ne mesure que SA COUVERTURE. Les formes ci-dessous rendent 0/0 ou 1/0 : c'est un
    // ANGLE MORT CONNU, pas une couverture. Elles sont assertées TELLES QUELLES pour qu'aucune
    // relecture ne les redécouvre comme une garantie, et pour qu'un élargissement futur du détecteur
    // rougisse ICI et se déclare. Format : [principal, brut].
    const mesure = (src: string): [number, number] =>
      [scanRegistryIdBranch('fixture.ts', src).length, scanRawIdEqualities('fixture.ts', src).length];

    // (1) ALIAS RENOMMÉ dans un prédicat : l'évasion COMPLÈTE — le nom porteur a changé, les deux
    //     détecteurs sont aveugles. C'est la limite haute de ce cliquet, assumée.
    expect(mesure("const has = (defs: E[]) => defs.some((t) => {\n  const cle = t.id;\n  return cle === 'commerce';\n});")).toEqual([0, 0]);
    // (2) …et hors prédicat, même aveuglement.
    expect(mesure("const noyau = REG[0];\nconst cle = noyau.id;\nconst x = cle === 'commerce';")).toEqual([0, 0]);
    // (3) DESTRUCTURATION RENOMMÉE — 0/0 ; la destructuration DIRECTE garde le nom et mord (1/1).
    expect(mesure("function f({ id: cle }: E) { return cle === 'commerce'; }")).toEqual([0, 0]);
    expect(mesure("function f({ id }: E) { return id !== 'commerce'; }")).toEqual([1, 1]);
    // (3bis) CONSTANTE DE MODULE : le garde principal reste aveugle, la mesure BRUTE la RÉSOUT
    //     (L2 #1548) — l'angle mort a RÉTRÉCI : factoriser un littéral en constante n'éteint plus rien.
    expect(mesure("const CLE = 'commerce';\nfunction f(e: E) { return e.id === CLE; }")).toEqual([0, 1]);
    //     La constante IMPORTÉE, elle, reste un angle mort des DEUX (le scan est per-fichier).
    expect(mesure("import { CLE } from './cles';\nfunction f(e: E) { return e.id === CLE; }")).toEqual([0, 0]);
    // (4) `switch` et appartenance : vus par le garde principal, HORS de la mesure brute (égalités seules).
    expect(mesure("function f(e: E) { switch (e.id) { case 'commerce': return 1; } }")).toEqual([1, 0]);
    expect(mesure("const L = ['commerce', 'subsistance'];\nfunction f(e: E) { return L.includes(e.id); }")).toEqual([1, 0]);
    // (5) Comparaisons qui ne sont pas un nœud d'égalité, ou dont le littéral n'en est pas un.
    expect(mesure("function f(e: E) { return Object.is(e.id, 'commerce'); }")).toEqual([0, 0]);
    expect(mesure('function f(e: E, p: string) { return e.id === `${p}commerce`; }')).toEqual([0, 0]);
    expect(mesure('function f(e: E) { return e.id === `commerce`; }')).toEqual([1, 1]); // gabarit SANS substitution : vu
    expect(mesure("function f(e: E) { return e.id.startsWith('commerce'); }")).toEqual([0, 0]);
    // (6) Champ d'identité hors convention de nom : le seul critère du scan brut est ce nom.
    expect(mesure("function f(e: E) { return e.cle === 'commerce'; }")).toEqual([0, 0]);
    // (7) VARIABLE d'identité hors convention : un id de registre transporté par un paramètre nommé
    //     `decision`/`choix`/`kind` échappe aux DEUX gardes — angle mort MESURÉ sur le terrain
    //     (`shipCrew.resolveVesselWeek(…, decision)` nommait 'pas-de-paie' sans jamais être compté ;
    //     assaini à la main sous #1318 E4/C4-δ3, pas par le détecteur). Élargir `ID_NAME_RX` à ces
    //     noms est un choix OUVERT : il rougirait ICI d'abord, et se déclarerait.
    expect(mesure("function paie(decision: string) { return decision === 'pas-de-paie'; }")).toEqual([0, 0]);
    expect(mesure("function svc(s: S) { return s.kind === 'auberge'; }")).toEqual([0, 0]);
  });

  it('CLIQUET BRUT : la forme « id === littéral » ne monte jamais, et toute baisse se répercute', () => {
    const findings = rawFindingsIn(SCAN_DIRS);
    const perFile: Record<string, number> = {};
    for (const f of findings) perFile[f.rel] = (perFile[f.rel] ?? 0) + 1;

    const worse = Object.entries(perFile)
      .filter(([rel, n]) => n > (RAW_KNOWN[rel] ?? 0))
      .map(([rel, n]) => `${rel}: ${n} (plafond ${RAW_KNOWN[rel] ?? 0})\n` + findings.filter((f) => f.rel === rel).map((f) => `    ${f.rel}:${f.line} ${f.detail}`).join('\n'));
    expect(
      worse,
      'Comparaison BRUTE d’un champ d’identité à un littéral — ce compte ne monte jamais : un site ' +
        'déplacé dans un `.find`/`.some` pour échapper au garde principal reste compté ICI :\n' + worse.join('\n'),
    ).toEqual([]);

    const better = Object.entries(RAW_KNOWN).filter(([rel, n]) => (perFile[rel] ?? 0) < n).map(([rel, n]) => `${rel}: ${perFile[rel] ?? 0} < ${n}`);
    expect(
      better,
      'Mesure brute PÉRIMÉE : abaisser ces comptes dans RAW_KNOWN (le plafond descend, jamais l’inverse) :\n' + better.join('\n'),
    ).toEqual([]);
    expect(findings.length).toBe(RAW_CEILING);
  });
});
