/**
 * Mécanique de la lentille « obtenabilité réelle » (#321 lentille 1) : graphe DONNÉE→DONNÉE pour
 * chaque Talent (talents.json) et chaque Sort (spells.json) — chemins RÉELS de carrière/niveau,
 * espèce, créature-statblock, Table des Talents aléatoires (LDB), Table d'effets (`tables.json`),
 * GameOp `grantTalent` (mutations/étoiles/possessions/sorts/scènes), Effet de scène `learnSpell`, ou
 * achat PX légal (Talent de lanceur + Domaine/Culte atteignable, cf. `engine/grimoire.ts`). Réutilise `specPoolOf`
 * (src/data/index.ts, SOURCE UNIQUE du pool de spéc) plutôt que ré-implémenter la mécanique
 * des Talents de lanceur. Module PUR — consommé par le CLI (`obtainability-graph.mts`) ET par la
 * garde (`src/data/obtainability-guard.test.ts`).
 *
 * #326 (triage RAW) : un Talent `TalentData.codexOnly` (contenu de référence PNJ/campagne scriptée,
 * jamais un chemin de progression PJ standard) est EXEMPTÉ de `talentNever` ; les Sorts de la famille
 * `chaos`, exclusivement dépendants du Talent `magie-du-chaos` (lui-même `codexOnly`), sont exemptés
 * de `spellNever` pour la même raison — verdicts RAW cités sur les entrées, pas un silence.
 */
import { readFileSync, globSync } from 'node:fs';
import { join } from 'node:path';
import {
  talents, spells, careerLevels, species, creatures, mutations, stars, trappings, gods, effectTables,
  findTalentById, specPoolOf,
  type AdvancementRef, type TalentData,
} from '../../../src/data/index';
import { META_CATALOG_ENTRIES } from '../../guards/lib/entityConsumers.mjs';

export interface CasterInfo { obtainable: boolean; specs: Set<string>; anyUnspecialized: boolean }
export interface SpellVerdict { id: string; label: string; reachable: boolean; via: string[] }
export interface ObtainabilityResult {
  talentSources: Map<string, Set<string>>;
  talentNever: TalentData[];
  casterInfo: Map<string, CasterInfo>;
  spellVerdicts: SpellVerdict[];
  spellNever: SpellVerdict[];
}

function walkNode(node: unknown, onNode: (n: Record<string, unknown>) => void) {
  if (Array.isArray(node)) { for (const x of node) walkNode(x, onNode); return; }
  if (node && typeof node === 'object') {
    const n = node as Record<string, unknown>;
    onNode(n);
    for (const v of Object.values(n)) walkNode(v, onNode);
  }
}

export function computeObtainability(root: string): ObtainabilityResult {
  const talentSources = new Map<string, Set<string>>();
  const addTalentSource = (id: string, src: string) => {
    if (!talentSources.has(id)) talentSources.set(id, new Set());
    talentSources.get(id)!.add(src);
  };

  let sawRandomEntry = false;
  const walkAdvancement = (entries: AdvancementRef[], srcTag: string) => {
    for (const e of entries) {
      if ('pick' in e) walkAdvancement(e.of, srcTag);
      else if ('random' in e) sawRandomEntry = true;
      else addTalentSource(e.id, srcTag);
    }
  };
  for (const sp of species) walkAdvancement(sp.talents, `espece:${sp.id}`);
  for (const cl of careerLevels) walkAdvancement(cl.talents, `carriere:${cl.career}#${cl.level}`);
  for (const cr of creatures) for (const t of cr.talents ?? []) addTalentSource(t.id, `creature:${cr.id}`);

  for (const m of mutations) walkNode(m, (n) => { if (n.op === 'grantTalent') addTalentSource((n.talent as { id: string }).id, `mutation:${m.id}`); });
  for (const s of stars) walkNode(s, (n) => { if (n.op === 'grantTalent') addTalentSource((n.talent as { id: string }).id, `etoile:${s.id}`); });
  for (const tr of trappings) walkNode(tr, (n) => { if (n.op === 'grantTalent') addTalentSource((n.talent as { id: string }).id, `possession:${tr.id}`); });
  for (const sp of spells) walkNode(sp, (n) => { if (n.op === 'grantTalent') addTalentSource((n.talent as { id: string }).id, `sort:${sp.id}`); });
  for (const t of effectTables) walkNode(t, (n) => { if (n.op === 'grantTalent') addTalentSource((n.talent as { id: string }).id, `table:${t.id}`); });

  if (sawRandomEntry) for (const t of talents) if (t.rand != null) addTalentSource(t.id, 'table-talents-aleatoires');

  const learnSpellIds = new Set<string>();
  for (const f of globSync('src/scenes/**/*.json', { cwd: root })) {
    const text = readFileSync(join(root, f), 'utf8');
    if (!text.includes('"grantTalent"') && !text.includes('"learnSpell"')) continue;
    let json: unknown;
    try { json = JSON.parse(text); } catch { continue; }
    walkNode(json, (n) => {
      if (n.op === 'grantTalent') addTalentSource((n.talent as { id: string }).id, `scene:${f}`);
      if (n.type === 'learnSpell' && typeof n.spell === 'string') learnSpellIds.add(n.spell);
    });
  }

  // #326 : un Talent `codexOnly` (contenu de référence PNJ/campagne, cf. `TalentData.codexOnly`) est
  // EXPLIQUÉ par sa donnée — jamais compté comme une dette d'obtenabilité oubliée. Un Talent listé dans
  // `META_CATALOG_ENTRIES` (`scripts/guards/lib/entityConsumers.mjs`, SOURCE UNIQUE partagée avec
  // `src/data/entity-orphans.test.ts`) est une entrée MÉTA (ligne de table RAW, jamais un Talent
  // possédable) — même exemption, jamais re-déclarée ici.
  const talentNever = talents.filter((t) => !talentSources.has(t.id) && !t.codexOnly && !META_CATALOG_ENTRIES.has(`talents:${t.id}`));

  // Les Talents de LANCEUR sont ceux qui DÉCLARENT la famille de Sort qu'ils ouvrent
  // (`combat.castingKind`, `TalentData` — même union fermée que `SpellData.family`). Aucune liste
  // d'ids : un Talent de lanceur de plus se déclare en donnée et entre ici sans toucher ce fichier.
  const CASTER_TALENTS = talents.filter((t) => t.combat?.castingKind != null);

  function reachableSpecs(talentId: string): CasterInfo {
    const specs = new Set<string>();
    let anyUnspecialized = false;
    const scanAdvancement = (entries: AdvancementRef[]) => {
      for (const e of entries) {
        if ('pick' in e) { scanAdvancement(e.of); continue; }
        if (!('id' in e) || e.id !== talentId) continue;
        if (Array.isArray(e.choix)) for (const s of e.choix) specs.add(s);
        else if (e.choix == null && e.spec) specs.add(e.spec);
        else anyUnspecialized = true;
      }
    };
    for (const sp of species) scanAdvancement(sp.talents);
    for (const cl of careerLevels) scanAdvancement(cl.talents);
    for (const cr of creatures) for (const t of cr.talents ?? []) {
      if (t.id === talentId) { if (t.spec) specs.add(t.spec); else anyUnspecialized = true; }
    }
    if (anyUnspecialized) {
      const def = findTalentById(talentId);
      if (def) for (const s of specPoolOf(def)) specs.add(s); // spéc ATTEIGNABLE par achat PX = ce que le pool propose
    }
    return { specs, anyUnspecialized, obtainable: true };
  }

  const casterInfo = new Map<string, CasterInfo>();
  for (const t of CASTER_TALENTS) {
    const obtainable = talentSources.has(t.id);
    casterInfo.set(t.id, obtainable ? reachableSpecs(t.id) : { obtainable: false, specs: new Set(), anyUnspecialized: false });
  }

  // Sorts qu'un CULTE confère, TOUS pools confondus (`gods.json` : miracles / bénédictions / sorts du
  // Chaos). La famille est déjà tranchée par le `castingKind` du Talent au site d'appel — le pool
  // AUTHORÉ du dieu suffit ensuite à dire l'appartenance, sans table champ↔famille à tenir à jour.
  const godSpellIds = new Map(gods.map((g) => [
    g.id, new Set([...g.miracles, ...g.blessings, ...(g.chaosSpells ?? [])]),
  ]));

  const spellVerdicts: SpellVerdict[] = [];
  for (const sp of spells) {
    const via: string[] = [];
    if (learnSpellIds.has(sp.id)) via.push('scene:learnSpell');
    const fam = sp.family;
    // UN seul chemin par Talent de lanceur, entièrement DÉDUIT de l'entrée du Talent :
    //  - `combat.castingKind` dit la FAMILLE qu'il ouvre ;
    //  - `specsSource` dit la NATURE de sa spéc — absente = aucune (Magie mineure) ;
    //    `grantsArcaneDomain` = un DOMAINE (comparé au `domainId` du Sort) ; sinon un CULTE (le pool
    //    authoré du dieu dit l'appartenance du Sort).
    for (const t of CASTER_TALENTS) {
      if (t.combat!.castingKind !== fam) continue;
      const c = casterInfo.get(t.id)!;
      if (!c.obtainable) continue;
      if (t.specsSource == null) { via.push(`talent:${t.id}`); continue; }
      if (t.grantsArcaneDomain) {
        if (sp.domainId == null) via.push(`talent:${t.id}(commun)`);
        else if (c.anyUnspecialized) via.push(`talent:${t.id}(non-spécialisé, matche tout Domaine)`);
        else if (c.specs.has(sp.domainId)) via.push(`talent:${t.id}(${sp.domainId})`);
        continue;
      }
      if (c.anyUnspecialized) { via.push(`talent:${t.id}(non-spécialisé)`); continue; }
      for (const godId of c.specs) {
        if (godSpellIds.get(godId)?.has(sp.id)) via.push(`talent:${t.id}(${godId})`);
      }
    }
    spellVerdicts.push({ id: sp.id, label: sp.label, reachable: via.length > 0, via });
  }
  // #326 : une famille dont TOUS les Talents de lanceur sont `codexOnly` (référence PNJ, cf.
  // `TalentData.codexOnly`) a son inaccessibilité PJ déjà EXPLIQUÉE par cette donnée — pas une dette
  // distincte à re-signaler Sort par Sort. Déduit du `castingKind` déclaré, sans nommer de famille :
  // le cas mesuré est `chaos` (seul `magie-du-chaos` l'ouvre, et il est `codexOnly`).
  const famillesCodexOnly = new Set(
    CASTER_TALENTS.filter((t) => t.codexOnly === true).map((t) => t.combat!.castingKind!)
      .filter((k) => CASTER_TALENTS.filter((t) => t.combat!.castingKind === k).every((t) => t.codexOnly === true)),
  );
  const familyById = new Map(spells.map((sp) => [sp.id, sp.family]));
  const spellNever = spellVerdicts.filter((v) => {
    if (v.reachable) return false;
    if (famillesCodexOnly.has(familyById.get(v.id)!)) return false;
    return true;
  });

  return { talentSources, talentNever, casterInfo, spellVerdicts, spellNever };
}
