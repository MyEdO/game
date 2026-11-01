import { afterAll, describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { scanRegistryIdBranch, scanRawIdEqualities, isRegistryIdBranchExcluded, SCAN_DIRS, SCAN_EXTS, OP_VOCABULARY, VOCABULARY_TYPES } from '../../scripts/guards/lib/registryIdBranch.mjs';
import { analyserCorpus } from '../../scripts/guards/lib/dialecte.mjs';
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
 * Compte de sites par fichier sur `SCAN_DIRS` (`src/gameIso`, `src/data` et `scripts` compris, identité
 * nommée `ref`/`xxxRef`/`book` comprise, boucles `for…of` et tables littérales en `Map` indexées par
 * `.get(<identité>)` comprises). Chaque entrée est un site à TRAITER (attribut déclaré sur l'entrée) ou
 * à réfuter par une correction de la mécanique — jamais à conserver telle quelle.
 */
const KNOWN: Record<string, number> = {
  // GEL NOMINATIF — chaque entrée porte sa CONDITION DE SORTIE ; aucune n'est une exception permanente.
  // Sortie : les deux propriétés du prop (SUSPENDU au-dessus du vide, ADMIS sur les cellules de siège)
  // déclarées sur la def de décor `src/gameIso/catalog/decor/` — périmètre gameIso, hors de ce lot.
  'scripts/qc/opera-furniture-check.mts': 2, // `FLOATING.has(e.ref)` (lustre SUSPENDU) + `e.ref !== 'siege'`
  // Sortie : l'Arène intégrée devient une ENTRÉE de `builtinCampaigns` (une seule boucle de rangées,
  // plus de rangée en dur) — refonte d'ÉCRAN, donc recette navigateur exigée au commit.
  'src/ui/PartyScreen.tsx': 2, // `currentId === 'arene'` ×2 (rangée de la campagne intégrée)
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
 * La mesure se fait par NŒUD : deux comparaisons sur une même ligne pèsent 2.
 *
 * COUVERTURE : la mesure brute résout les CONSTANTES DE MODULE (`const X = 'lit'` → `=== X`) — la
 * factorisation d'un littéral en constante n'assainit pas un site et ne le masque pas.
 */
const RAW_KNOWN: Record<string, number> = {
  'scripts/gen-bestiary-gallery.mts': 1,
  'scripts/gen-creature-attacks-gallery.mts': 2,
  'scripts/qc/opera-furniture-check.mts': 1,
  'src/engine/activities.ts': 1,
  // SAIN (#1612) : `bourseInstanceOf` RETROUVE l'instance de la Bourse dans l'inventaire par l'id
  // STABLE de son trapping (`BOURSE_TRAPPING_ID`, `trappings.json`) — un LOOKUP par référence, pas un
  // branchement de comportement : aucune conduite ne diffère selon l'id. Même patron que le jumeau
  // `careerSlots` ('focalisation') ci-dessous ; la constante de module est
  // résolue par le scan brut (L2 #1548), donc la factorisation ne l'assainit pas et ne le prétend pas.
  'src/engine/bourse.ts': 1,
  'src/engine/careerSlots.ts': 1, // reste `s.id === 'focalisation'` (lookup par id stable)
  'src/engine/corruption.ts': 2,
  'src/engine/crewedWeapon.ts': 1,
  'src/engine/drunkenness.ts': 1,
  'src/engine/engagement.ts': 2,
  'src/engine/equipCompare.ts': 1,
  'src/engine/magic.ts': 2,
  'src/engine/menace.ts': 1,
  'src/engine/provisions.ts': 1,
  'src/engine/psychology.ts': 2,
  // 3 → 2 (L2 #1548, commit 3b) : le Test d'équipage d'un Critique fluvial désigne une CARACTÉRISTIQUE
  // (`crewTest.char === 'initiative'`), plus un id de registre de Compétence.
  'src/engine/riverNavigation.ts': 1,
  'src/engine/seaNavigation.ts': 1,
  // Les trois `o.skill === 'esquive'` de `downgradeTornMuscle`/`traumaDodgePenalty`/`traumaSkillPenalty`
  // (référence de Compétence EMBOÎTÉE, accès par `.id`) : l'Esquive y est NOMMÉE par le RAW (LDB 18).
  // Le poseur UNIQUE de l'annulateur `determination` (`poseDeterminationCanceller`), dans le module qui
  // POSSÈDE la table `PASSIVE_CANCELLERS`. Le reste : pénalité de combat PAR MAIN (doigts/main) + crochet
  // entraîné — axes NON couverts par `cumul`.
  'src/engine/trauma.ts': 7,
  'src/engine/weaponDamage.ts': 1,
  'src/engine/windsOfMagic.ts': 1,
  'src/gameIso/rig/mountedRig.ts': 1,
  'src/gameIso/rig/parts/career.ts': 3,
  'src/gameIso/rig/parts/injuries.ts': 2, // reste le canal APPARENCE (œil remplacé en place), hors `rig` (calques)
  'src/gameIso/stage/Ambiance.tsx': 1,
  'src/gameIso/stage/CrewTooltip.tsx': 1,
  'src/gameIso/tokenBodyKind.tsx': 1,
  'src/noyau/monde/aiSpellValue.ts': 2,
  'src/noyau/combatEffects.ts': 3,
  'src/noyau/combatFlow.ts': 3, // `op.ref === 'self'` hors champ (mot du vocabulaire GameOp)
  'src/noyau/monde/combatGeometry.ts': 1,
  'src/noyau/combatManeuvers.ts': 3,
  'src/noyau/combatSlice.ts': 1,
  'src/noyau/gesteDArete.ts': 1, // `talentId === 'grimpeur'` (LDB 15 l.57)
  // RÉVÉLÉ (jamais neuf) par la résolution des constantes de module, L2 #1548 : `q.id === ARME_D_EQUIPE`
  // est un lookup par id stable d'une Qualité au registre — même patron que `healing`/`careerSlots`.
  'src/noyau/monde/commandTeam.ts': 1,
  'src/state/devtools.ts': 1,
  'src/noyau/interludeFlow.ts': 1,
  'src/noyau/mount.ts': 1,
  'src/noyau/seaVoyageFlow.ts': 3,
  'src/noyau/travelFlow.ts': 6,
  'src/noyau/travelPostes.ts': 2,
  'src/noyau/verdictsDInterlude.ts': 1,
  'src/noyau/monde/vision.ts': 1,
  // Le site de `ui/ownership.ts` est la comparaison au sentinel `'*'` de l'arbitre de modales (owner =
  //  tous les sièges) dans la porte de possession `spectatorSeatOfModal` : un mot du VOCABULAIRE du
  //  protocole de modales, jamais un id d'entité — c'est la décision « qui nomme le siège attendu »,
  //  et elle est UNE (`ActiveModal.tsx` la lit sans la refaire, il ne compte donc aucun site).
  'src/ui/ownership.ts': 1,
  // RÉVÉLÉ (jamais neuf) par la résolution des constantes de module, L2 #1548 : `PINNED_SEL`
  // (`'__pinned__'`) est une SENTINELLE de sélection d'écran (la rangée « Épinglés », qui n'est pas une
  // affaire), jamais l'identité d'une entrée de registre — famille du `''` d'`OP_VOCABULARY`.
  'src/ui/CarnetScreen.tsx': 2,
  'src/ui/MedicModal.tsx': 2,
  'src/ui/MerchantPanel.tsx': 1,
  'src/ui/PartyScreen.tsx': 2,
  'src/ui/creator/CharacterCreator.tsx': 6,
  'src/ui/editor/StatblockEditor.tsx': 1,
  'src/ui/gallery/registry.tsx': 4,
  'src/ui/jetProps/useHealJetProps.tsx': 2,
};

/** Plafond BRUT global du jour (= somme de `RAW_KNOWN`). */
const RAW_CEILING = Object.values(RAW_KNOWN).reduce((s, n) => s + n, 0);

/** Les DEUX détecteurs passent sur le MÊME corpus, fichier par fichier et l'un après l'autre : un
 *  seul parcours de dossiers (`readCorpus`, primitive unique de marche de corpus source — les tests
 *  sont pris puis écartés par `isRegistryIdBranchExcluded`, qui porte AUSSI l'exclusion des
 *  migrations), une seule lecture, et l'arbre syntaxique d'un fichier (`arbreDe`) sert aux deux scans
 *  et meurt avec son tour de boucle. Mémoïsation PARESSEUSE par jeu de dossiers — le corpus est
 *  marché au 1ᵉʳ `it` qui le demande, jamais à la collecte des tests. */
const _analyses = new Map<string, {
  principal: { rel: string; line: number; detail: string; rule: string }[];
  brut: { rel: string; line: number; detail: string }[];
}>();

// Vidée en `afterAll` (#1801).
afterAll(() => {
  _analyses.clear();
});

function analyse(dirs: string[]) {
  const cle = dirs.join('|');
  let a = _analyses.get(cle);
  if (!a) {
    a = { principal: [], brut: [] };
    for (const { fichier: { rel, text }, sourceFile: sf } of analyserCorpus(readCorpus(dirs, { exts: SCAN_EXTS, tests: true }).filter(({ rel }) => !isRegistryIdBranchExcluded(rel)))) {
      if (!sf) continue;
      for (const fd of scanRegistryIdBranch(rel, text, sf)) a.principal.push({ rel, ...fd });
      for (const fd of scanRawIdEqualities(rel, text, sf)) a.brut.push({ rel, ...fd });
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

    // La MÊME table écrite en `Map` : paires littérales, `Object.entries` d'une table littérale, ou en ligne.
    const mapPaires = [
      "const LABELS = new Map([['renforce', 'Renforcé'], ['solide', 'Solide']]);",
      'export function row(t: Trait) { return LABELS.get(t.id) ?? t.id; }',
    ].join('\n');
    expect(rules(mapPaires)).toEqual(['id-record']);

    const mapEntries = [
      "const LABELS: Record<string, string> = { renforce: 'Renforcé', solide: 'Solide' };",
      'const PAR_ID = new Map(Object.entries(LABELS));',
      'export function row(t: Trait) { return PAR_ID.get(t.id) ?? t.id; }',
    ].join('\n');
    expect(rules(mapEntries)).toEqual(['id-record']);

    const mapEnLigne = "export function row(t: Trait) { return new Map([['renforce', 'Renforcé']]).get(t.id) ?? t.id; }";
    expect(rules(mapEnLigne)).toEqual(['id-record']);
  });

  it('CONTRE-ÉPREUVE : un registre d’ENTRÉES qui portent leur `id`, résolu par `indexParId`, n’est pas une table figée', () => {
    const registre = [
      "const MARQUEURS = [{ id: 'petrifie', label: 'Pétrifié', severity: 95 }];",
      "const parId = indexParId('etats', MARQUEURS);",
      'export function connu(id: string) { return parId(id); }',
    ].join('\n');
    expect(rules(registre)).toEqual([]);
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
      // (5) table TOTALE par type : la clé est une union fermée, le compilateur exige l'entrée.
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

    // Le nom EXPORTÉ fait foi (`origineImportee`) : `BoneId` importé sous un autre nom reste exempté…
    const renomme = geometrie
      .replace(/BoneId/g, 'Os')
      .replace('type Os }', 'type BoneId as Os }');
    expect(rules(renomme, 'src/gameIso/rig/fixture.ts')).toEqual([]);
    // …et un autre type du module importé SOUS le nom `BoneId` ne l'est pas.
    const usurpe = shadow.replace('type BoneId = string;', "import { type Skeleton as BoneId } from '../gameIso/rig/bones';");
    expect(rules(usurpe, 'src/state/fixture.ts')).toEqual(['id-membership']);

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
    expect([...VOCABULARY_TYPES.entries()]).toEqual([['BoneId', 'src/gameIso/rig/bones.ts']]);
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

  it('MORSURE : l’identité d’un livre nommée `abbr`/`ab` est vue comme un `id` (#1825)', () => {
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

  it('CLIQUET : aucun site NOUVEAU, et tout site assaini abaisse le plafond', { timeout: 60_000 }, () => {
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
    //     détecteurs sont aveugles. C'est la limite haute de ce cliquet.
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
    //     assaini à la main sous #1318, pas par le détecteur). Élargir `ID_NAME_RX` à ces
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
