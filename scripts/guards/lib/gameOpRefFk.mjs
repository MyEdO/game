// Mécanique du garde-fou « les références portées par les `GameOp` de la DONNÉE COMMITÉE résolvent »
// (#847). `applyOps` (`src/engine/ops.ts:1573`) empile sans valider : un `talentId` fantôme produit une
// op silencieusement inerte, un `ref` fantôme un refus au spawn (`RefIrresoluble`, `src/state/spawn.ts`).
// Le gate posé à l'ÉDITION ne protège que ce qui passe par l'UI ; les `.json` commités, non.
//
// PÉRIMÈTRE DÉRIVÉ, PAS RECOPIÉ. Les champs surveillés sont ÉNUMÉRÉS par le TypeChecker depuis l'union
// `GameOp` de `src/engine/ops.ts` (`gameOpStringFields`) : chaque propriété dont le type admet `string`
// ouvert, ou `string[]`. Chacune DOIT porter une classification dans `GAMEOP_FIELD_TARGETS` ; un champ
// ajouté demain à l'union sort en `unclassified` et fait ÉCHOUER le test consommateur. Symétriquement,
// une entrée de la table qui ne correspond plus à aucun champ sort en `stale`. La table est donc tenue
// par le type, jamais par la mémoire de l'auteur.
//
// POURQUOI PAS LES SCHÉMAS ZOD. `src/data/schemas/` ne déclare AUCUNE cible de référence : un `GameOp`
// y est `z.looseObject({ op: z.string() })` (`src/data/schemas/grammaire/mecanique.ts`) et un `trappingId` de
// prothèse y est un `z.string()` nu (`src/data/schemas/defs/traumas.ts:19`). La seule déclaration
// existante de la forme d'une op est l'union TypeScript — c'est donc elle la source du périmètre.
//
// POURQUOI PARTIR DU CHAMP, PAS DU LITTÉRAL. `scripts/guards/lib/registryIdBranch.mjs:14-20` a mesuré
// et écarté le critère « ce littéral est-il un id réel d'un `src/data/*.json` ? » : 648 sites, quasi
// tous des `.kind`/`.type` légitimes, le vocabulaire des ids recouvrant celui des discriminants
// d'union. C'est le CHAMP qui dit quel registre il vise.
//
// CE QUE CETTE GARDE NE VOIT PAS — à lire AVANT de conclure de son vert que les refs d'ops sont saines :
//   - les champs de type OBJET ou tableau d'objets d'une op (`thresholds`, `rows`, `onHitEffects`,
//     `addTraits`, `activeIf`…) : seules les feuilles `string`/`string[]` DIRECTES d'un membre de
//     l'union sont énumérées. Les `GameOp[]` imbriqués (`perRound.ops`, `delayed.ops`, `zone.onCross`)
//     sont en revanche bien visités par le SCAN, qui descend dans tout le document ;
//   - les refs portées par le vocabulaire VOISIN (`Condition` de `flowCore`, `TriggeredEffect.trigger`,
//     `FlowTest.skill`) : elles ne sont pas des `GameOp` — `src/data/refs-migrated.test.ts` les garde
//     par ailleurs ;
//   - les ops construites au RUNTIME (`engine/miscast.ts::expandOp`, `polymorphOps`) : le scan ne lit
//     que des fichiers `.json` commités ;
//   - les valeurs non-`string` (une ref posée en nombre ou en objet ne serait pas comparée).
//
// Module ESM pur — consommé par `src/data/refs-migrated.test.ts`.
import fs from 'node:fs';
import { parUnitesDeCode, listerArbre } from './lister.mjs';
import path from 'node:path';
import ts from 'typescript';

/** Nom du type dont l'union fournit le périmètre, et le fichier qui le déclare. */
const OPS_FILE = 'src/engine/ops.ts';
const OPS_TYPE = 'GameOp';

/**
 * Vocabulaires TOLÉRÉS, déclarés par leur MÉCANISME (jamais par un id d'offenseur ni un fichier).
 *
 *  - `templates` : `'$arg'`/`'$indice'` sont des SUBSTITUTIONS d'instance, remplacées avant exécution
 *    par `withArg` (`src/state/triggeredEffects.ts`) — la valeur écrite n'est pas la valeur exécutée.
 *  - `selfRef` : `'self'` désigne le porteur lui-même, mot réservé documenté à `src/engine/ops.ts:741`
 *    (`scheduleRespawn` ré-invoque « la défunte, par son `creatureId` »). Toléré uniquement sur les
 *    champs qui le DÉCLARENT (`self: true`).
 *  - `softIds` : marqueurs NARRATIFS d'un registre — des tags d'arbitrage sans entrée d'entité, avec
 *    leurs consommateurs propres. Déclarés PAR REGISTRE, donc valides partout où ce registre est visé.
 */
export const TOLERATED = {
  templates: ['$arg', '$indice'],
  selfRef: 'self',
  softIds: {
    // Pétrifié (LDB 85 l.290) n'a pas d'entrée `etats.json` : sa seule mécanique câblée est un libellé,
    // une sévérité et une icone d'affichage, portés par `NARRATIVE_MARKERS` (`src/engine/conditions.ts`).
    // SOURCE UNIQUE de la liste : `src/data/data-wellformed.test.ts:66` l'IMPORTE d'ici.
    etats: ['petrifie'],
  },
};

/**
 * Cible de CHAQUE champ `string`/`string[]` de l'union `GameOp`, par clé `op.champ` :
 *   - `{ registry }`            — référence DURE : la valeur doit résoudre dans ce registre.
 *   - `{ registry, self }`      — idem, plus le mot réservé `'self'`.
 *   - `{ nonRef }`              — la valeur n'est la clé d'aucun registre ; le texte dit quoi et qui la lit.
 *   - `{ coveredBy }`           — champ de référence gardé AILLEURS (garde nommée), pas ré-vérifié ici.
 * Ces trois formes sont l'ensemble FERMÉ du format : `src/data/refs-migrated.test.ts` refuse toute clé
 * hors `registry`/`self`/`nonRef`/`coveredBy`, et toute valeur non résolue est un offenseur.
 */
export const GAMEOP_FIELD_TARGETS = {
  // ── États (etats.json) ──
  'condition.id': { registry: 'etats' },
  'condition.onlyIfCondition': { registry: 'etats' },
  'condition.unlessCondition': { registry: 'etats' },
  'removeCondition.id': { registry: 'etats' },
  // ── Groupes (groups.json) — `groupMatch` (src/engine/groups.ts:154) compare par id ──
  'wounds.onlyGroups': { registry: 'groups' },
  'condition.onlyGroups': { registry: 'groups' },
  'grantTrait.onlyGroups': { registry: 'groups' },
  'banish.onlyGroups': { registry: 'groups' },
  // ── Psychologie (psychology.json) ──
  'endPsych.type': { registry: 'psychology' },
  'beginPsych.type': { registry: 'psychology' },
  'grantPsychTrait.psychType': { registry: 'psychology' },
  'removePsychTrait.psychType': { registry: 'psychology' },
  // La Cible d'un Trait psy est un id de Groupe (`groupMatch`, src/engine/groups.ts:147-157, où
  // `tout`/`vivant` sont des entrées de `groups.json`).
  'grantPsychTrait.cible': { registry: 'groups' },
  'beginPsych.cible': { registry: 'groups' },
  'beginPsych.sourceId': { nonRef: 'id de combattant RUNTIME — la créature SOURCE d\'une Peur/Terreur (`targetedTrigger` le pose depuis `m.id`, src/engine/psychology.ts:331 ; purgé à la mort par `deadId`, l.235), jamais authoré en donnée' },
  // ── Traits / Talents / Compétences ──
  'grantTrait.traitId': { registry: 'traits' },
  'removeTrait.traitId': { registry: 'traits' },
  'domeWard.traitId': { registry: 'traits' },
  'grantTalent.talentId': { registry: 'talents' },
  'grantCareerTalent.talentId': { registry: 'talents' },
  // `skill` d'op = RÉFÉRENCE EMBOÎTÉE `{ id, spec? }` — hors de portée de ce filet (aveugle aux réfs
  // OBJET, angle mort déclaré :23-33). Couverture : `refs-migrated.test.ts` § ops à réf de Compétence.
  'testMod.exceptSkills': { registry: 'skills' },
  'skillDRBonus.testType': { registry: 'crewTestTypes' },
  // Spécialisations : résolution assurée par la GARDE EXHAUSTIVE Phase 3 de
  // `src/data/refs-migrated.test.ts`, qui connaît le domaine porteur (fermé/ouvert/`specsSource`).
  'grantTalent.spec': { coveredBy: 'refs-migrated.test.ts § GARDE EXHAUSTIVE (Phase 3 complétude)' },
  'grantCareerTalent.spec': { coveredBy: 'refs-migrated.test.ts § GARDE EXHAUSTIVE (Phase 3 complétude)' },

  // ── Séquelles (traumas.json) — `permanentAmputations` (src/engine/trauma.ts) instancie CHAQUE id ──
  'amputer.sequels': { registry: 'traumas' },
  // ── Maladies / symptômes ──
  'exposeDisease.disease': { registry: 'maladies' },
  'contractDisease.disease': { registry: 'maladies' },
  'reduceDiseaseDays.disease': { registry: 'maladies' },
  'diseaseTestMod.diseases': { registry: 'maladies' },
  'suppressSymptom.symptomId': { registry: 'symptoms' },
  'aggravateSymptom.disease': { registry: 'maladies' },
  'aggravateSymptom.symptomId': { registry: 'symptoms' },
  'attenuateSymptom.disease': { registry: 'maladies' },
  'attenuateSymptom.symptomId': { registry: 'symptoms' },
  'grantSymptom.disease': { registry: 'maladies' },
  'grantSymptom.symptomId': { registry: 'symptoms' },
  // ── Possessions / qualités / groupes d'arme ──
  'giveTrapping.trappingId': { registry: 'trappings' },
  'augmentWeapon.addQualities': { registry: 'qualities' },
  'augmentWeapon.removeQualities': { registry: 'qualities' },
  'grantWeapon.qualities': { registry: 'qualities' },
  'grantNaturalWeapon.qualities': { registry: 'qualities' },
  'grantWeapon.subType': { registry: 'weaponGroups' },
  'grantNaturalWeapon.subType': { registry: 'weaponGroups' },
  // Silhouette de rendu d'une arme invoquée, résolue par id (`findTrappingById(w.form)`,
  // src/gameIso/rig/parts/equipment.ts:65).
  'grantWeapon.form': { registry: 'trappings' },
  // ── Créatures ──
  'summon.ref': { registry: 'creatures' },
  'polymorph.ref': { registry: 'creatures' },
  'scheduleRespawn.ref': { registry: 'creatures', self: true },
  'transform.morphRef': { registry: 'creatures' },
  // ── Tables ──
  'rollTable.tableId': { registry: 'effectTables' },
  'rollMutation.table': { registry: 'mutationTables' },
  // ── Terrain (dataset `src/data/terrains.json`) ──
  'offTerrainMod.terrain': { registry: 'terrains' },
  // ── Tons de lumière (lightTones.json) — APPARENCE d'une source, résolue au bord du rendu
  // (`gameIso/stage/stagePointLights.ts::resolveTone`). Absent = `flamme`.
  'light.tone': { registry: 'lightTones' },
  // ── Champs qui ne visent AUCUN registre ──
  'narrative.text': { nonRef: 'prose d\'arbitrage, journalisée verbatim (src/engine/ops.ts:956)' },
  'grantWeapon.label': { nonRef: 'nom affiché de l\'arme invoquée (l\'arme n\'a pas d\'entrée de catalogue)' },
  'grantNaturalWeapon.label': { nonRef: 'nom affiché de l\'attaque naturelle conférée' },
  'grantFreeAttack.label': { nonRef: 'libellé de l\'option d\'attaque surfacée au Tour' },
  'giveTrapping.custom': { nonRef: 'objet CUSTOM (misc), défini par ce nom faute d\'entrée de catalogue (src/engine/ops.ts:627-631)' },
  'grantNaturalWeapon.uid': { nonRef: 'identité d\'INSTANCE de l\'arme injectée dans `c.weapons` (déduplication)' },
  'grantNaturalWeapon.attackKind': { nonRef: 'kind d\'attaque naturelle, lu par le rig (src/gameIso/rig/anim/handling.ts:61) — espace de noms du geste, pas un registre de données' },
  'transform.tag': { nonRef: 'étiquette de GROUPEMENT des effets posés, relue par `endTransform` (retrait atomique)' },
  'endTransform.tag': { nonRef: 'étiquette de groupement posée par `transform`' },
  'scheduleRespawn.cancelFlag': { nonRef: 'nom de drapeau de SCÈNE posé par un Effet, espace de noms de l\'auteur de scène' },
  'teamCommander.commanderId': { nonRef: 'id de combattant RUNTIME (posé par le flux de combat), jamais authoré en donnée' },
  'grantTrait.arg': { nonRef: 'argument d\'INSTANCE du trait, polymorphe selon le trait porteur (id de Groupe, niveau de Difficulté, portée, prose) — aucun registre unique' },
  'augmentWeapon.requiresWeapon': { nonRef: 'mot-clé de FAMILLE d\'arme, matché par normalisation de `label`+`subType` (src/engine/weaponDamage.ts:17-21)' },
};

const norm = (p) => p.replace(/\\/g, '/');

const PROGRAM_CACHE = new Map();

function opsProgram(root) {
  const key = norm(path.resolve(root));
  const hit = PROGRAM_CACHE.get(key);
  if (hit) return hit;
  const cfgPath = ts.findConfigFile(key, ts.sys.fileExists, 'tsconfig.json');
  if (!cfgPath) throw new Error(`tsconfig.json introuvable sous ${key}`);
  const cfg = ts.parseJsonConfigFileContent(
    ts.readConfigFile(cfgPath, ts.sys.readFile).config,
    ts.sys,
    path.dirname(cfgPath),
  );
  const entry = path.join(key, OPS_FILE);
  const program = ts.createProgram({ rootNames: [entry], options: cfg.options });
  const value = { program, entry: norm(entry) };
  PROGRAM_CACHE.set(key, value);
  return value;
}

/** Le type admet-il une `string` OUVERTE (≠ union de littéraux, déjà close par `tsc`) ? */
function admitsOpenString(type) {
  const parts = type.isUnion() ? type.types : [type];
  return parts.some((t) => (t.flags & ts.TypeFlags.String) !== 0);
}

/**
 * Champs `string`/`string[]` de CHAQUE membre de l'union `GameOp`, énumérés par le TypeChecker.
 * Retourne `[{ key: 'op.champ', op, field, array }]`, trié.
 */
export function gameOpStringFields(root) {
  const { program, entry } = opsProgram(root);
  const checker = program.getTypeChecker();
  const sf = program.getSourceFile(entry);
  if (!sf) throw new Error(`${OPS_FILE} absent du programme`);
  let alias;
  sf.forEachChild((n) => {
    if (ts.isTypeAliasDeclaration(n) && n.name.text === OPS_TYPE) alias = n;
  });
  if (!alias) throw new Error(`type ${OPS_TYPE} introuvable dans ${OPS_FILE}`);
  const union = checker.getTypeAtLocation(alias.name);
  const members = union.isUnion() ? union.types : [union];
  const out = new Map();
  for (const member of members) {
    const opSym = member.getProperty('op');
    if (!opSym) continue;
    const opType = checker.getTypeOfSymbolAtLocation(opSym, alias);
    if (!opType.isStringLiteral()) continue;
    const op = opType.value;
    for (const prop of member.getProperties()) {
      if (prop.name === 'op') continue;
      const type = checker.getTypeOfSymbolAtLocation(prop, alias);
      const parts = type.isUnion() ? type.types : [type];
      const scalar = admitsOpenString(type);
      let array = false;
      for (const part of parts) {
        if (!checker.isArrayType(part)) continue;
        const el = checker.getTypeArguments(part)[0];
        if (el && admitsOpenString(el)) array = true;
      }
      if (!scalar && !array) continue;
      out.set(`${op}.${prop.name}`, { key: `${op}.${prop.name}`, op, field: prop.name, array });
    }
  }
  return [...out.values()].sort((a, b) => parUnitesDeCode(a.key, b.key));
}

/**
 * Confrontation du périmètre DÉRIVÉ à la table DÉCLARÉE.
 * `unclassified` : champ de l'union sans cible déclarée. `stale` : cible déclarée sans champ.
 */
export function auditFieldCoverage(root) {
  const derived = gameOpStringFields(root);
  const declared = new Set(Object.keys(GAMEOP_FIELD_TARGETS));
  const unclassified = derived.filter((f) => !declared.has(f.key)).map((f) => f.key);
  const seen = new Set(derived.map((f) => f.key));
  const stale = [...declared].filter((k) => !seen.has(k)).sort();
  return { derived, unclassified, stale };
}

/** Fichiers `.json` d'un dossier, récursivement, en ORDRE TOTAL. */
export function collectJsonFiles(dir, root) {
  return listerArbre(dir, { filtre: (rel) => rel.endsWith('.json') }).map((rel) => {
    const p = path.join(dir, rel);
    return { file: norm(path.relative(root, p)), data: JSON.parse(fs.readFileSync(p, 'utf8')) };
  });
}

/** Un nœud est-il une `GameOp` ? (`op` string SANS `kind` : les `Condition` de `flowCore` réutilisent
 *  la clé `op` pour un opérateur de comparaison et portent toujours un `kind`.) */
const isGameOp = (o) => typeof o.op === 'string' && !('kind' in o);

/**
 * Scan des références d'ops d'un corpus de documents.
 * `sources` : `[{ file, data }]`. `resolvers` : `{ <registre>: (id) => boolean }` — un registre visé
 * par la table sans résolveur fourni est rapporté en `missingResolvers` (jamais ignoré en silence).
 * Retourne `{ offenders, missingResolvers }` : TOUTE valeur d'un champ à `registry` qui ne résout pas,
 * hors vocabulaire `TOLERATED`, est un offenseur — la garde n'accorde aucun budget.
 */
export function scanGameOpRefs({ sources, resolvers }) {
  const missingResolvers = new Set();
  const found = []; // { file, path, op, field, value, registry }
  const walk = (node, file, where) => {
    if (Array.isArray(node)) { node.forEach((v, i) => walk(v, file, `${where}[${i}]`)); return; }
    if (!node || typeof node !== 'object') return;
    if (isGameOp(node)) {
      const op = node.op;
      for (const [field, raw] of Object.entries(node)) {
        const target = GAMEOP_FIELD_TARGETS[`${op}.${field}`];
        if (!target || !target.registry) continue;
        const resolve = resolvers[target.registry];
        if (!resolve) { missingResolvers.add(target.registry); continue; }
        const soft = TOLERATED.softIds[target.registry] ?? [];
        const values = Array.isArray(raw) ? raw : [raw];
        values.forEach((v, i) => {
          if (typeof v !== 'string') return;
          if (TOLERATED.templates.includes(v)) return;
          if (target.self && v === TOLERATED.selfRef) return;
          if (soft.includes(v)) return;
          if (resolve(v)) return;
          const at = Array.isArray(raw) ? `${where}.${field}[${i}]` : `${where}.${field}`;
          found.push({ file, path: at, op, field, value: v, registry: target.registry, key: `${op}.${field}` });
        });
      }
    }
    for (const [k, v] of Object.entries(node)) if (v && typeof v === 'object') walk(v, file, `${where}.${k}`);
  };
  for (const s of sources) walk(s.data, s.file, s.file);

  return { offenders: found, missingResolvers: [...missingResolvers].sort() };
}

/** Rendu d'un offender en une ligne actionnable. */
export const formatOffender = (o) =>
  `${o.file} ${o.path} : ${o.op}.${o.field} = ${JSON.stringify(o.value)} — introuvable dans « ${o.registry} »`;
