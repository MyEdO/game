// Mécanique du garde-fou « les références portées par les `GameOp` de la DONNÉE COMMITÉE résolvent »
// (#847). `applyOps` (`src/engine/ops.ts`) empile sans valider : un `talentId` fantôme produit une op
// silencieusement inerte, un `ref` fantôme un mannequin de repli visible (`src/state/spawn.ts ›
// spawnEnemy`). Le gate posé à l'ÉDITION ne protège que ce qui passe par l'UI ; les `.json` commités, non.
//
// PÉRIMÈTRE DÉRIVÉ, PAS RECOPIÉ. Les champs surveillés sont ÉNUMÉRÉS par le TypeChecker depuis l'union
// `GameOp` de `src/engine/ops.ts` (`gameOpStringFields`) : chaque propriété dont le type admet `string`
// ouvert, ou `string[]`. Chacune DOIT porter une classification dans `GAMEOP_FIELD_TARGETS` ; un champ
// ajouté demain à l'union sort en `unclassified` et fait ÉCHOUER le test consommateur. Symétriquement,
// une entrée de la table qui ne correspond plus à aucun champ sort en `stale`. La table est donc tenue
// par le type, jamais par la mémoire de l'auteur.
//
// LE PARSE D'ABORD. Un champ d'op dont le payload STRICT d'`OP_DEFS` (`src/data/schemas/grammaire/
// mecanique.ts`) porte une feuille `idDe` est vérifié AU PARSE, et sa cible est déclarée par cette
// feuille : c'est un CHAMP D'OP À SLOT (`champsDOpASlot`, `scripts/docs/lib/slots-registre.mts`),
// injecté ici par le consommateur TS. Il sort du périmètre dérivé, et une entrée de la table sur lui
// sort en `stale` — une cible ne se déclare qu'une fois. Que le parse juge CHAQUE occurrence est
// prouvé par le consommateur : tout nœud `GameOp` que ce scan visite (`noeudsDOp`) est un nœud d'op
// ATTEINT par le parse de mesure (`opsDuParse`, `scripts/docs/lib/slots-registre.mts`), hors d'un
// stock nominatif dont chaque chaîne de champ à slot est une case validée par `idDe` au parse de son
// document (`slotsDOpNonJuges`, même fichier).
// Cette table garde le RESTE, et chaque reste a son lot de mort :
//   - les champs des ops de `OPS_NON_TYPEES` (`src/data/schemas/grammaire/mecanique.ts`) meurent au
//     typage de leur op dans `OP_DEFS`, lot L1c #1468 ;
//   - les champs dont le type n'a pas d'entrée à `TYPES` (`src/data/schemas/grammaire/ref.ts` :
//     Qualité, Groupe d'arme, Groupe, Psychologie, Séquelle, type de Test d'équipage, table de
//     Mutation, ton de lumière) meurent à l'entrée de leur type, lot R2 de #1473 ;
//   - les `nonRef` ne visent aucun registre : ils restent, justifiés.
//
// POURQUOI PARTIR DU CHAMP, PAS DU LITTÉRAL. `scripts/guards/lib/registryIdBranch.mjs` a mesuré
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
import { parUnitesDeCode } from './lister.mjs';
import path from 'node:path';
import ts from 'typescript';

/** Nom du type dont l'union fournit le périmètre, et le fichier qui le déclare. */
const OPS_FILE = 'src/engine/ops.ts';
const OPS_TYPE = 'GameOp';

/**
 * Cible de CHAQUE champ `string`/`string[]` de l'union `GameOp` hors champs d'op à slot, par clé
 * `op.champ` :
 *   - `{ registry }`            — référence DURE : la valeur doit résoudre dans ce registre.
 *   - `{ nonRef }`              — la valeur n'est la clé d'aucun registre ; le texte dit quoi et qui la lit.
 *   - `{ coveredBy }`           — champ de référence gardé AILLEURS (garde nommée), pas ré-vérifié ici.
 * Ces trois formes sont l'ensemble FERMÉ du format : `src/data/refs-migrated.test.ts` refuse toute clé
 * hors `registry`/`nonRef`/`coveredBy`, et toute valeur non résolue est un offenseur.
 */
export const GAMEOP_FIELD_TARGETS = {
  // ── États (etats.json) ──
  'condition.id': { registry: 'etats' },
  'condition.onlyIfCondition': { registry: 'etats' },
  'condition.unlessCondition': { registry: 'etats' },
  'removeCondition.id': { registry: 'etats' },
  // ── Groupes (groups.json) — `groupMatch` (src/engine/groups.ts) compare par id ──
  'wounds.onlyGroups': { registry: 'groups' },
  'condition.onlyGroups': { registry: 'groups' },
  'grantTrait.onlyGroups': { registry: 'groups' },
  'banish.onlyGroups': { registry: 'groups' },
  // ── Psychologie (psychology.json) ──
  'endPsych.type': { registry: 'psychology' },
  'beginPsych.type': { registry: 'psychology' },
  'grantPsychTrait.psychType': { registry: 'psychology' },
  'removePsychTrait.psychType': { registry: 'psychology' },
  // La Cible d'un Trait psy est un id de Groupe (`groupMatch`, src/engine/groups.ts, où
  // `tout`/`vivant` sont des entrées de `groups.json`).
  'grantPsychTrait.cible': { registry: 'groups' },
  'beginPsych.cible': { registry: 'groups' },
  'beginPsych.sourceId': { nonRef: 'id de combattant RUNTIME — la créature SOURCE d\'une Peur/Terreur (`targetedTrigger` le pose, src/engine/psychology.ts ; purgé à la mort par `clearPsychOf`), jamais authoré en donnée' },
  // ── Traits / Talents / Compétences ──
  'grantTrait.traitId': { registry: 'traits' },
  'skillDRBonus.testType': { registry: 'crewTestTypes' },

  // ── Séquelles (traumas.json) — `permanentAmputations` (src/engine/trauma.ts) instancie CHAQUE id ──
  'amputer.sequels': { registry: 'traumas' },
  // ── Possessions / qualités / groupes d'arme ──
  'augmentWeapon.addQualities': { registry: 'qualities' },
  'augmentWeapon.removeQualities': { registry: 'qualities' },
  'grantWeapon.qualities': { registry: 'qualities' },
  'grantNaturalWeapon.qualities': { registry: 'qualities' },
  'grantWeapon.subType': { registry: 'weaponGroups' },
  'grantNaturalWeapon.subType': { registry: 'weaponGroups' },
  // ── Tables ──
  'rollMutation.table': { registry: 'mutationTables' },
  // ── Tons de lumière (lightTones.json) — APPARENCE d'une source, résolue au bord du rendu
  // (`gameIso/stage/stagePointLights.ts::resolveTone`). Absent = `flamme`.
  'light.tone': { registry: 'lightTones' },
  // ── Champs qui ne visent AUCUN registre ──
  'narrative.text': { nonRef: 'prose d\'arbitrage, journalisée verbatim (src/engine/ops.ts › applyOps, `case \'narrative\'`)' },
  'grantWeapon.label': { nonRef: 'nom affiché de l\'arme invoquée (l\'arme n\'a pas d\'entrée de catalogue)' },
  'grantNaturalWeapon.label': { nonRef: 'nom affiché de l\'attaque naturelle conférée' },
  'grantFreeAttack.label': { nonRef: 'libellé de l\'option d\'attaque surfacée au Tour' },
  'giveTrapping.custom': { nonRef: 'objet CUSTOM (misc), défini par ce nom faute d\'entrée de catalogue (src/engine/items.ts › itemFromGive)' },
  'grantNaturalWeapon.uid': { nonRef: 'identité d\'INSTANCE de l\'arme injectée dans `c.weapons` (déduplication)' },
  'grantNaturalWeapon.attackKind': { nonRef: 'kind d\'attaque naturelle, lu par le rig (src/gameIso/rig/anim/handling.ts) — espace de noms du geste, pas un registre de données' },
  'transform.tag': { nonRef: 'étiquette de GROUPEMENT des effets posés, relue par `endTransform` (retrait atomique)' },
  'endTransform.tag': { nonRef: 'étiquette de groupement posée par `transform`' },
  'scheduleRespawn.cancelFlag': { nonRef: 'nom de drapeau de SCÈNE posé par un Effet, espace de noms de l\'auteur de scène' },
  'teamCommander.commanderId': { nonRef: 'id de combattant RUNTIME (posé par le flux de combat), jamais authoré en donnée' },
  'grantTrait.arg': { nonRef: 'argument d\'INSTANCE du trait, polymorphe selon le trait porteur (id de Groupe, niveau de Difficulté, portée, prose) — aucun registre unique' },
  'augmentWeapon.requiresWeapon': { nonRef: 'mot-clé de FAMILLE d\'arme, matché par normalisation de `label`+`subType` (src/engine/weaponDamage.ts › weaponMatchesFamily)' },
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
 * Confrontation du périmètre DÉRIVÉ à la table DÉCLARÉE. `champsASlot` : les clés `op.champ` des
 * champs d'op à slot (`champsDOpASlot`), retirées du périmètre dérivé — le parse les vérifie.
 * `unclassified` : champ du périmètre sans cible déclarée. `stale` : cible déclarée hors périmètre,
 * chacune avec sa raison (`{ key, raison }`).
 */
export function auditFieldCoverage(root, { champsASlot }) {
  const aSlot = new Set(champsASlot);
  const tous = gameOpStringFields(root);
  const derived = tous.filter((f) => !aSlot.has(f.key));
  const declared = Object.keys(GAMEOP_FIELD_TARGETS);
  const cibles = new Set(declared);
  const unclassified = derived.filter((f) => !cibles.has(f.key)).map((f) => f.key);
  const seen = new Set(derived.map((f) => f.key));
  const stale = declared
    .filter((k) => !seen.has(k))
    .sort(parUnitesDeCode)
    .map((key) => ({
      key,
      raison: aSlot.has(key)
        ? 'champ d’op à slot : typé AU PARSE par sa feuille `idDe` d’`OP_DEFS` (src/data/schemas/grammaire/mecanique.ts), qui déclare sa cible — l’entrée meurt'
        : 'aucun champ `string`/`string[]` de ce nom dans l’union `GameOp` (src/engine/ops.ts)',
    }));
  return { derived, unclassified, stale };
}

/** Un nœud est-il une `GameOp` ? (`op` string SANS `kind` : les `Condition` de `flowCore` réutilisent
 *  la clé `op` pour un opérateur de comparaison et portent toujours un `kind`.) */
const isGameOp = (o) => typeof o.op === 'string' && !('kind' in o);

/**
 * Scan des références d'ops d'un corpus de documents.
 * `sources` : `[{ file, data }]`. `resolvers` : `{ <registre>: (id) => boolean }` — un registre visé
 * par la table sans résolveur fourni est rapporté en `missingResolvers` (jamais ignoré en silence).
 * `softIds` : `{ <registre>: ids[] }`, marqueurs NARRATIFS d'un registre sans entrée d'entité, injectés
 * par le consommateur depuis leur registre unique — valides partout où ce registre est visé.
 * `champsASlot` : clés `op.champ` des champs d'op à slot, jamais jugées ici (le parse les juge).
 * Retourne `{ offenders, missingResolvers, noeudsDOp }` : TOUTE valeur d'un champ à `registry` qui ne
 * résout pas, hors `softIds`, est un offenseur — la garde n'accorde aucun budget. `noeudsDOp` : chaque
 * nœud `GameOp` visité (`{ file, path, op, noeud }`), que le consommateur joint au parse de mesure.
 */
export function scanGameOpRefs({ sources, resolvers, softIds = {}, champsASlot = [] }) {
  const aSlot = new Set(champsASlot);
  const missingResolvers = new Set();
  const found = []; // { file, path, op, field, value, registry }
  const noeudsDOp = [];
  const walk = (node, file, where) => {
    if (Array.isArray(node)) { node.forEach((v, i) => walk(v, file, `${where}[${i}]`)); return; }
    if (!node || typeof node !== 'object') return;
    if (isGameOp(node)) {
      const op = node.op;
      noeudsDOp.push({ file, path: where, op, noeud: node });
      for (const [field, raw] of Object.entries(node)) {
        if (aSlot.has(`${op}.${field}`)) continue;
        const target = GAMEOP_FIELD_TARGETS[`${op}.${field}`];
        if (!target || !target.registry) continue;
        const resolve = resolvers[target.registry];
        if (!resolve) { missingResolvers.add(target.registry); continue; }
        const soft = softIds[target.registry] ?? [];
        const values = Array.isArray(raw) ? raw : [raw];
        values.forEach((v, i) => {
          if (typeof v !== 'string') return;
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

  return { offenders: found, missingResolvers: [...missingResolvers].sort(), noeudsDOp };
}

/** Rendu d'un offender en une ligne actionnable. */
export const formatOffender = (o) =>
  `${o.file} ${o.path} : ${o.op}.${o.field} = ${JSON.stringify(o.value)} — introuvable dans « ${o.registry} »`;
