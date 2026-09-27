/**
 * Garde-fou INVARIANT (multilangue) : les champs de référence migrés ne contiennent QUE des refs
 * STRUCTURÉES (par id), jamais de libellé brut, et les ids de catalogue résolvent. Toute régression
 * (un libellé qui se faufile, un id fantôme) casse ici. Cf. `CLAUDE.md` § Pour TOUT agent.
 */
import { describe, it, expect } from 'vitest';
import {
  trappings, qualities, spells, creatures, classes, careers, careerLevels, species, gods, etats, maladies, weaponGroups,
  traits, stars, talents, maneuvers, skills, domains, crewRoles, groups, raceAppearance,
  byId, findTalentById, findTrappingById, findQualityById, findSeaShantyById,
  findCareerById, findClassById, findSpeciesById, findConditionById, findDiseaseById, findWeaponGroupById, findSymptomById,
  findCreatureById, findVehicleById, findGroupById, findPsychologyById, findTraitById, findCrewTestTypeById, findLightToneById,
  mutationTables,
  specLabel, refLabel, specEntryId, specEntryLabel, specResolves, SPEC_SOURCES, type SpecsSource, type SpecEntry, books,
} from './index';
import { resolveSpecId } from '../engine/character';
import { avancement } from './schemas/grammaire/avancement';
import { gameOpSchema } from './schemas/grammaire/mecanique';
import { entreeOuverte, mesureDuParse, refusDeSpec } from './schemas/grammaire/ref';
import { IDS_PAR_DATASET } from './schemas/_ids.generated';
import { itemFromTrappingById } from '../engine/items';
import { COND } from '../engine/conditions';
import { DISEASES } from '../engine/disease';
import { terrainEntree } from '../state/terrain';
import pregensJson from './pregens.json';
import { makePregens } from './pregens';
import interludeEventsJson from './interludeEvents.json';
import tavernGamesJson from './tavernGames.json';
import seaWeatherJson from './sea-weather.json';
import traumasJson from './traumas.json';
import areneProject from '../scenes/arene/arene-projet.json';
import loupProject from '../scenes/loup-et-saumure/loup-et-saumure-projet.json';
import { SCENARIOS } from '../scenes/test-scenarios/_registry.generated';
import { creatureSpeciesOptions } from '../gameIso/rig/creatures';
import { SWARM_FORMS } from '../gameIso/rig/swarm/forms';
import { rigSpeciesVocab } from '../gameIso/rig/appearance';
import { wardrobeKeyResolves } from '../gameIso/rig/parts/career';
import { CHAR_KEYS } from '../engine/types';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';
import { listerArbre } from '../../scripts/guards/lib/lister.mjs';
import {
  GAMEOP_FIELD_TARGETS, auditFieldCoverage, scanGameOpRefs, formatOffender,
} from '../../scripts/guards/lib/gameOpRefFk.mjs';
import { champsDOpASlot, opsDuParse, slotsDOpNonJuges, slotsDuParse } from '../../scripts/docs/lib/slots-registre.mjs';
import { scanDuCorpus } from '../../scripts/docs/lib/structures-scan.mjs';
import { NARRATIVE_MARKERS } from '../engine/conditions';
import { extractedBooks, frenchSourceDirs, isSentinel, walkSkillRefs } from '../../scripts/data/lib/skillSpecWalk.mjs';
// @ts-expect-error - bibliothèque RAW ESM JS (pas de types) — même convention que `vite.config.ts`
import { sourceDirOf } from '../../scripts/raw/_lib.mjs';

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x != null;

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));

describe('refs migrées — refs structurées par id, zéro libellé résiduel', () => {
  it('trappings.qualities = QualityRef[] {id} qui résout (id stable)', () => {
    for (const t of trappings) for (const q of t.qualities) {
      expect(isObj(q)).toBe(true);
      expect(findQualityById(q.id)).toBeTruthy();
    }
  });

  it('trappings.subType = weaponGroupId qui résout (jamais un libellé brut) — y compris derivedWeapon.subType imbriqué', () => {
    const groupIds = new Set(weaponGroups.map((g) => g.id));
    for (const t of trappings) {
      if (t.subType != null) {
        expect(groupIds.has(t.subType), `${t.label} → ${t.subType}`).toBe(true);
        expect(findWeaponGroupById(t.subType)).toBeTruthy();
      }
      // derivedWeapon (prothèse-arme, ex. Crochet) PORTE SON PROPRE subType — un libellé y échappait
      // au garde-fou ci-dessus (Crochet.derivedWeapon.subType: "Base" au lieu de l'id "base").
      const dwSubType = t.derivedWeapon?.subType;
      if (dwSubType != null) {
        expect(groupIds.has(dwSubType), `${t.label}.derivedWeapon → ${dwSubType}`).toBe(true);
      }
    }
  });

  it('weaponGroups portent un id stable + kind valide', () => {
    const kinds = new Set(['weapon', 'ammo', 'armour', 'inventory']);
    for (const g of weaponGroups) { expect(typeof g.id).toBe('string'); expect(kinds.has(g.kind), g.kind).toBe(true); }
  });

  it('itemFromTrappingById pose un trappingId qui pointe le catalogue', () => {
    for (const id of ['arbalete', 'epee-batarde', 'chemise-de-mailles', 'mains-nues']) {
      const it = itemFromTrappingById(id);
      expect(it, id).toBeTruthy();
      expect(it!.trappingId).toBe(id);
    }
  });

  it('classes.trappings + careerLevels.trappings = TrappingRef ({id}/{vehicleId}/{creatureId} résout, {text} narratif, {choice}/{wildcard} = emplacements RÉCURSIFS)', () => {
    function checkTrappingRef(tr: unknown): void {
      expect(isObj(tr)).toBe(true);
      const t = tr as Record<string, unknown>;
      if ('choice' in t) { expect(Array.isArray(t.choice)).toBe(true); for (const b of t.choice as unknown[]) checkTrappingRef(b); }
      else if ('wildcard' in t) expect(typeof t.wildcard).toBe('string');
      else if ('vehicleId' in t) expect(findVehicleById(t.vehicleId as string)).toBeTruthy();
      else if ('creatureId' in t) expect(findCreatureById(t.creatureId as string)).toBeTruthy();
      else if ('id' in t) expect(itemFromTrappingById(t.id as string)).toBeTruthy();
      else expect(typeof t.text).toBe('string');
    }
    const all = [...classes.flatMap((c) => c.trappings), ...careerLevels.flatMap((l) => l.trappings)];
    for (const tr of all) checkTrappingRef(tr);
  });

  it('creatures : skills/talents/optionals/trappings structurés (zéro chaîne)', () => {
    for (const c of creatures) {
      for (const sk of c.skills) expect(isObj(sk) && typeof sk.id === 'string').toBe(true);
      for (const t of c.talents) expect(isObj(t) && typeof t.id === 'string').toBe(true);
      for (const o of c.optionals) expect(isObj(o)).toBe(true); // OptionalEntry : TraitInstance OU note composée (#174)
      for (const tr of c.trappings) {
        expect(isObj(tr)).toBe(true);
        if ('creatureId' in tr) expect(findCreatureById(tr.creatureId as string)).toBeTruthy();
        else if ('id' in tr) expect(itemFromTrappingById(tr.id as string)).toBeTruthy();
      }
    }
  });

  it('species/careerLevels skills+talents = AdvancementRef[] structuré ; characteristics = CharKey', () => {
    const advLists = [
      ...species.flatMap((s) => [s.skills, s.talents]),
      ...careerLevels.flatMap((l) => [l.skills, l.talents]),
    ];
    for (const list of advLists) for (const a of list) expect(isObj(a)).toBe(true);
    for (const l of careerLevels) for (const k of l.characteristics) expect(CHAR_KEYS as readonly string[]).toContain(k);
  });

  it('careers/classes/species portent un id ; careers.class = classId qui résout', () => {
    for (const c of careers) { expect(typeof c.id).toBe('string'); expect(findClassById(c.class), c.label).toBeTruthy(); }
    for (const cl of classes) expect(typeof cl.id).toBe('string');
    for (const s of species) expect(typeof s.id).toBe('string');
  });

  it('etats portent un id ; la constante moteur COND est synchrone avec etats.json', () => {
    for (const e of etats) expect(typeof e.id).toBe('string');
    const ids = new Set(etats.map((e) => e.id));
    for (const id of Object.values(COND)) expect(ids.has(id), id).toBe(true); // chaque État canonique existe dans le dataset
    expect(Object.values(COND).length).toBe(12); // les 12 États LDB 16
  });

  it('findConditionById résout les ids canoniques', () => {
    for (const id of Object.values(COND)) expect(findConditionById(id), id).toBeTruthy();
  });

  it('maladies portent un id ; la constante moteur DISEASES est synchrone avec maladies.json', () => {
    for (const m of maladies) expect(typeof m.id).toBe('string');
    const ids = new Set(maladies.map((m) => m.id));
    for (const id of Object.values(DISEASES)) { expect(ids.has(id), id).toBe(true); expect(findDiseaseById(id), id).toBeTruthy(); }
    expect(Object.values(DISEASES).length).toBe(9); // les 9 maladies LDB 20 câblées
  });

  it('chaque maladie.symptoms.symptomId résout dans symptoms.json (catalogue éditable)', () => {
    for (const m of maladies) for (const s of m.symptoms) expect(findSymptomById(s.symptomId), `${m.id}:${s.symptomId}`).toBeTruthy();
  });

  it('careerLevels.career = careerId qui résout', () => {
    for (const l of careerLevels) expect(findCareerById(l.career), l.label).toBeTruthy();
  });

  it('pregens.species/career = ids qui résolvent', () => {
    for (const p of pregensJson as { label: string; species: string; career: string }[]) {
      expect(findSpeciesById(p.species), p.label).toBeTruthy();
      expect(findCareerById(p.career), p.label).toBeTruthy();
    }
  });

  it('interludeEvents.fx.revenue(Blocked)Classes = classId qui résout (ou « * »)', () => {
    for (const e of interludeEventsJson as { fx?: { revenueClasses?: string[]; revenueBlockedClasses?: string[] } }[]) {
      for (const c of [...(e.fx?.revenueClasses ?? []), ...(e.fx?.revenueBlockedClasses ?? [])]) {
        if (c === '*') continue;
        expect(findClassById(c), c).toBeTruthy();
      }
    }
  });

  // `AdvancementRef` (`src/data/index.ts`) : une référence d'avancement porte son `id` À PLAT, que la
  // spécialisation soit arrêtée (`spec`) ou laissée au choix (`choix`) — `advancementBaseId`
  // (index.ts) et `slotOptionsFromRef` (`src/engine/careerSlots.ts`) lisent le MÊME id dans les deux
  // régimes. La CATÉGORIE vient de la liste porteuse (`skills` vs `talents`), jamais d'un
  // « skill OU talent ».
  it('refs d’avancement (régime `spec` comme `choix`) pointent un id de Compétence/Talent réel', () => {
    const bad: string[] = [];
    const ck = (cat: 'skills' | 'talents', a: unknown, where: string): void => {
      if (!isObj(a)) return;
      const find = (id: string) => (cat === 'skills' ? byId('skill', id) : findTalentById(id));
      if ('id' in a) { const id = a.id as string; if (!find(id)) bad.push(`${where} ${cat} → ${JSON.stringify(id)}`); }
      if ('of' in a) (a.of as unknown[]).forEach((o, i) => ck(cat, o, `${where}.of[${i}]`));
    };
    for (const s of species) {
      s.skills.forEach((a, i) => ck('skills', a, `species(${s.id}).skills[${i}]`));
      s.talents.forEach((a, i) => ck('talents', a, `species(${s.id}).talents[${i}]`));
    }
    for (const l of careerLevels) {
      l.skills.forEach((a, i) => ck('skills', a, `careerLevel(${l.label}).skills[${i}]`));
      l.talents.forEach((a, i) => ck('talents', a, `careerLevel(${l.label}).talents[${i}]`));
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });

  // NON-VACANCE de la garde ci-dessus, et VERROU PAR CONSTRUCTION : depuis L2 #1548 la fabrique
  // `avancement(type)` (`schemas/grammaire/avancement.ts`) refine l'id AU PARSE contre le registre
  // généré — un emplacement à id fantôme ne charge plus, quel que soit son régime.
  it('un emplacement d’avancement à id fantôme est REFUSÉ par le schéma (contre-épreuve)', () => {
    const porte = avancement('skill');
    expect(porte.safeParse({ id: 'langue', choix: true }).success).toBe(true);
    expect(porte.safeParse({ id: 'langue-fantome', choix: true }).success).toBe(false);
    expect(porte.safeParse({ pick: 1, of: [{ id: 'langue-fantome' }] }).success).toBe(false);
  });

  /**
   * BIJECTIVITÉ de la migration d'avancement (L2 #1548, `scripts/migrations/
   * 2026-08-31-avancement-vers-grammaire.mjs`). Deux faits distincts, mesurés ici sur la donnée
   * COMMITTÉE — sans jamais rouvrir l'ancien fichier :
   *  1. L'ENVELOPPE est en bijection avec la graphie d'origine : `{ref}`/`{wildcard}`/
   *     `{wildcard,specOptions}`/`{choice}`/`{random}` ⇄ `{id}`/`{id,choix:true}`/`{id,choix:[ids]}`/
   *     `{pick:1,of}`/`{random}`. Aller-retour = identité sur CHAQUE nœud réel : aucune branche
   *     fusionnée, aucun champ perdu, aucune forme hors vocabulaire.
   *  2. Les seules VALEURS qui changent sont les 14 paires NOMMÉES ci-dessous (spéc imprimée au
   *     livre → id de catalogue) : chacune résout dans le catalogue de sa def, chacune est VIVANTE
   *     dans la donnée, et aucune des 14 graphies d'origine n'y subsiste.
   */
  type Graphie = Record<string, unknown>;
  /** Graphie CIBLE → graphie d'ORIGINE. */
  const versOrigine = (n: Graphie): Graphie => {
    if ('random' in n && Object.keys(n).length === 1) return { random: n.random };
    if ('pick' in n) return { choice: (n.of as Graphie[]).map(versOrigine) };
    if ('id' in n) {
      if (n.choix === undefined) return n.spec === undefined ? { ref: { id: n.id } } : { ref: { id: n.id, spec: n.spec } };
      return n.choix === true ? { wildcard: { id: n.id } } : { wildcard: { id: n.id }, specOptions: n.choix };
    }
    return { HORS_VOCABULAIRE: n };
  };
  /** Graphie d'ORIGINE → graphie CIBLE, ENVELOPPE SEULE (la valeur de spéc n'est pas touchée). */
  const versCible = (n: Graphie): Graphie => {
    if ('random' in n) return { random: n.random };
    if ('choice' in n) return { pick: 1, of: (n.choice as Graphie[]).map(versCible) };
    if ('ref' in n) {
      const r = n.ref as Graphie;
      return r.spec === undefined ? { id: r.id } : { id: r.id, spec: r.spec };
    }
    if ('wildcard' in n) {
      const w = n.wildcard as Graphie;
      const opts = n.specOptions as unknown[] | undefined;
      return opts?.length ? { id: w.id, choix: opts } : { id: w.id, choix: true };
    }
    return { HORS_VOCABULAIRE: n };
  };
  /** Tous les nœuds d'avancement de la donnée committée, avec leur provenance. */
  const noeudsAvancement = (): { ou: string; cat: 'skills' | 'talents'; n: Graphie }[] => {
    const out: { ou: string; cat: 'skills' | 'talents'; n: Graphie }[] = [];
    for (const s of species)
      for (const cat of ['skills', 'talents'] as const)
        s[cat].forEach((a, i) => out.push({ ou: `species(${s.id}).${cat}[${i}]`, cat, n: a as unknown as Graphie }));
    for (const l of careerLevels)
      for (const cat of ['skills', 'talents'] as const)
        l[cat].forEach((a, i) => out.push({ ou: `careerLevel(${l.id}).${cat}[${i}]`, cat, n: a as unknown as Graphie }));
    return out;
  };

  /** Spéc imprimée au livre → id de catalogue : les 14 SEULES valeurs que la migration a changées. */
  const PAIRES_NOMMEES: { cat: 'skills' | 'talents'; def: string; imprime: string; id: string }[] = [
    { cat: 'skills', def: 'signes-secrets', imprime: 'guilde-au-choix', id: 'guilde' },
    { cat: 'talents', def: 'bon-marcheur', imprime: 'Montagnes', id: 'montagnes' },
    { cat: 'talents', def: 'maitre-artisan', imprime: 'Fermiers', id: 'fermiers' },
    { cat: 'talents', def: 'sans-peur', imprime: 'Cavalerie', id: 'cavalerie' },
    { cat: 'talents', def: 'sans-peur', imprime: 'Chaos', id: 'chaos' },
    { cat: 'talents', def: 'sans-peur', imprime: 'Grandes bêtes', id: 'grandes-betes' },
    { cat: 'talents', def: 'sans-peur', imprime: 'Tout', id: 'tout' },
    { cat: 'talents', def: 'savoir-vivre', imprime: 'Citadins', id: 'citadins' },
    { cat: 'talents', def: 'savoir-vivre', imprime: 'Criminel', id: 'criminels' },
    { cat: 'talents', def: 'savoir-vivre', imprime: 'Érudit', id: 'erudits' },
    { cat: 'talents', def: 'savoir-vivre', imprime: 'Guilde', id: 'guildes' },
    { cat: 'talents', def: 'savoir-vivre', imprime: 'Mercenaires', id: 'mercenaires' },
    { cat: 'talents', def: 'savoir-vivre', imprime: 'Minus', id: 'minus' },
    { cat: 'talents', def: 'savoir-vivre', imprime: 'Soldat', id: 'soldats' },
  ];

  it('la migration d’avancement est structurellement BIJECTIVE : l’ENVELOPPE fait l’aller-retour à l’identique', () => {
    const casses: string[] = [];
    const horsVocabulaire: string[] = [];
    const parcours = (ou: string, n: Graphie): void => {
      const origine = versOrigine(n);
      if ('HORS_VOCABULAIRE' in origine) { horsVocabulaire.push(`${ou} → ${JSON.stringify(n)}`); return; }
      if (JSON.stringify(versCible(origine)) !== JSON.stringify(n))
        casses.push(`${ou} : ${JSON.stringify(n)} → ${JSON.stringify(origine)} → ${JSON.stringify(versCible(origine))}`);
      if ('of' in n) (n.of as Graphie[]).forEach((b, i) => parcours(`${ou}.of[${i}]`, b));
    };
    for (const { ou, n } of noeudsAvancement()) parcours(ou, n);
    expect(horsVocabulaire, horsVocabulaire.join('\n')).toEqual([]);
    expect(casses, casses.join('\n')).toEqual([]);
  });

  it('les seules VALEURS changées sont les 14 paires NOMMÉES : chacune résout, est VIVANTE, et sa graphie d’origine a DISPARU', () => {
    const specsDe = (n: Graphie): string[] => [
      ...(typeof n.spec === 'string' ? [n.spec] : []),
      ...(Array.isArray(n.choix) ? (n.choix as string[]) : []),
    ];
    const vues = new Map<string, Set<string>>(); // `cat|def` → valeurs de spéc rencontrées
    const collecte = (cat: 'skills' | 'talents', n: Graphie): void => {
      if (typeof n.id === 'string') {
        const cle = `${cat}|${n.id}`;
        if (!vues.has(cle)) vues.set(cle, new Set());
        for (const v of specsDe(n)) vues.get(cle)!.add(v);
      }
      if ('of' in n) (n.of as Graphie[]).forEach((b) => collecte(cat, b));
    };
    for (const { cat, n } of noeudsAvancement()) collecte(cat, n);

    const morts: string[] = [];
    const absents: string[] = [];
    const nonResolus: string[] = [];
    for (const p of PAIRES_NOMMEES) {
      const def = p.cat === 'skills' ? byId('skill', p.def) : findTalentById(p.def);
      if (!def || !specResolves(def, p.id)) { nonResolus.push(`${p.cat}:${p.def} → ${p.id}`); continue; }
      const vu = vues.get(`${p.cat}|${p.def}`) ?? new Set<string>();
      if (!vu.has(p.id)) absents.push(`${p.cat}:${p.def} → ${p.id} (paire FOSSILE : plus aucune référence)`);
      if (vu.has(p.imprime)) morts.push(`${p.cat}:${p.def} → ${JSON.stringify(p.imprime)} (graphie d’origine SURVIVANTE)`);
    }
    expect(nonResolus, nonResolus.join('\n')).toEqual([]);
    expect(absents, absents.join('\n')).toEqual([]);
    expect(morts, morts.join('\n')).toEqual([]);
  });

  // `TrappingRef.wildcard` (`src/data/index.ts`) est une AUTRE forme : une chaîne de CATÉGORIE
  // d'équipement (« n'importe quelle arme »), pas un id de registre — `resolveTrappingChoices`
  // (`src/engine/trappingChoices.ts`) la remplace par l'id choisi, `trappingRefLabel` (index.ts)
  // et le pré-tiré (`src/data/schemas/defs/pregens.ts`) la reconnaissent par sa valeur. Le
  // vocabulaire est donc CLOS : une catégorie inconnue est un emplacement que rien ne sait remplir.
  it('classes/careerLevels : tout {wildcard} de dotation appartient au vocabulaire CLOS des emplacements', () => {
    const SLOTS = new Set(['arme']);
    const bad: string[] = [];
    const ck = (tr: unknown, where: string): void => {
      if (!isObj(tr)) return;
      if ('choice' in tr) { (tr.choice as unknown[]).forEach((b, i) => ck(b, `${where}.choice[${i}]`)); return; }
      if ('wildcard' in tr && !SLOTS.has(tr.wildcard as string)) bad.push(`${where} → ${JSON.stringify(tr.wildcard)}`);
    };
    classes.forEach((c) => c.trappings.forEach((tr, i) => ck(tr, `class(${c.id}).trappings[${i}]`)));
    careerLevels.forEach((l) => l.trappings.forEach((tr, i) => ck(tr, `careerLevel(${l.label}).trappings[${i}]`)));
    expect(bad, bad.join('\n')).toEqual([]);
  });

  // ── Phase F — ops de Flow & champs de talent : qualité/talent par id, jamais un libellé ──
  /** Visite récursive de chaque nœud-objet d'une arborescence de données (Flow/effets imbriqués). */
  const walk = (node: unknown, fn: (o: Record<string, unknown>) => void): void => {
    if (Array.isArray(node)) { node.forEach((x) => walk(x, fn)); return; }
    if (!isObj(node)) return;
    fn(node);
    for (const v of Object.values(node)) walk(v, fn);
  };
  /** Tous les datasets porteurs de `GameOp` (Flow de sorts/traits/etc. + effet de signe). */
  const opDatasets: unknown[] = [...spells, ...traits, ...creatures, ...qualities, ...stars];

  it('ops addQualities / grantWeapon.qualities = id de Qualité qui résout', () => {
    walk(opDatasets, (o) => {
      const lists: unknown[] = [];
      if (o.op === 'augmentWeapon' && Array.isArray(o.addQualities)) lists.push(o.addQualities);
      if ((o.op === 'grantWeapon' || o.op === 'grantNaturalWeapon') && Array.isArray(o.qualities)) lists.push(o.qualities);
      for (const q of lists.flat()) {
        expect(typeof q, JSON.stringify(o)).toBe('string'); // id de Qualité, pas un objet/libellé brut
        expect(findQualityById(q as string), String(q)).toBeTruthy();
      }
    });
  });

  // ── Spine des Tests : aucune compétence résolue par LIBELLÉ (multilangue) ──
  // Un Test déclenché authoré est un nœud de STRUCTURE Flow (`{kind:'test', test:FlowTest}`) ; ses
  // Compétences (côté défenseur `test.skill`, côté attaquant OPPOSÉ `test.opposed.attackerSkill`) sont
  // des skillId stables. Tous doivent RÉSOUDRE.
  it('FlowTest.skill / FlowTest.opposed.attackerSkill → skillId qui résout (jamais un libellé)', () => {
    const skillCarrying = [...spells, ...traits, ...maneuvers, ...qualities, ...creatures, ...stars];
    walk(skillCarrying, (o) => {
      // RÉFÉRENCES emboîtées `{ id, spec? }` (le slot `skill` d'un conteneur de Test)…
      const refs: unknown[] = [];
      // …et l'id NU que reste `opposed.attackerSkill` (slot d'id, pas de référence — lot L3).
      const ids: unknown[] = [];
      if (o.kind === 'test' && isObj(o.test)) {
        const t = o.test as Record<string, unknown>;
        if (t.skill != null) refs.push(t.skill);
        expect(t.spec, `FlowTest : « spec » FRÈRE de « skill » — la spécialisation vit DANS la référence : ${JSON.stringify(o)}`).toBeUndefined();
        if (isObj(t.opposed) && (t.opposed as Record<string, unknown>).attackerSkill != null) ids.push((t.opposed as Record<string, unknown>).attackerSkill);
      }
      for (const r of refs) {
        expect(isObj(r), `réf de Compétence à PLAT : ${JSON.stringify(o)}`).toBe(true);
        const id = (r as { id: string }).id;
        expect(byId('skill', id), `${JSON.stringify(o)} → ${String(id)}`).toBeTruthy();
      }
      for (const s of ids) {
        expect(typeof s, JSON.stringify(o)).toBe('string');
        expect(byId('skill', s as string), `${JSON.stringify(o)} → ${String(s)}`).toBeTruthy();
      }
    });
  });

  it('scènes : FlowTest.skill / extendedTest.skill = skillId qui résout ; corruptionExposure.skill ∈ {resistance,calme}', () => {
    walk(areneProject, (o) => {
      if (o.kind === 'test' && isObj(o.test)) {
        const s = (o.test as Record<string, unknown>).skill;
        if (s != null) expect(byId('skill', (s as { id: string }).id), `FlowTest → ${JSON.stringify(s)}`).toBeTruthy();
        const hs = (o.test as Record<string, unknown>).easierIf;
        if (isObj(hs) && isObj((hs as Record<string, unknown>).hasSkill)) {
          expect(byId('skill', ((hs as Record<string, unknown>).hasSkill as { id: string }).id)).toBeTruthy();
        }
      }
      if (o.type === 'extendedTest' && o.skill != null) expect(byId('skill', (o.skill as { id: string }).id), `extendedTest → ${JSON.stringify(o.skill)}`).toBeTruthy();
      if (o.type === 'corruptionExposure' && o.skill != null) expect(['resistance', 'calme'], JSON.stringify(o.skill)).toContain((o.skill as { id: string }).id);
    });
  });

  it('skills.characteristic = CharKey stable (jamais un libellé inter-table)', () => {
    for (const s of skills) expect(CHAR_KEYS as readonly string[], `${s.label} → ${s.characteristic}`).toContain(s.characteristic);
  });

  it('talents.addCharacteristic = CharKey ou clé d\'attribut dérivé stable (jamais un libellé)', () => {
    const ok = new Set<string>([...CHAR_KEYS, 'wounds', 'fortune', 'resolve', 'move', 'corruption']);
    for (const t of talents) {
      const a = (t as { addCharacteristic?: string }).addCharacteristic;
      if (a != null) expect(ok.has(a), `${t.label} → ${a}`).toBe(true);
    }
  });

  it('domains.castBonus.perCondition = id d\'État qui résout (jamais un libellé inter-table)', () => {
    for (const d of domains) {
      const pc = (d as { castBonus?: { perCondition?: string } }).castBonus?.perCondition;
      if (pc) expect(findConditionById(pc), `${d.label} → ${pc}`).toBeTruthy();
    }
  });

  // ── Phase 3 — sanité de CATALOGUE (structure des defs skills.json/talents.json) : ces quelques
  // `it` fixent des exemples représentatifs de chaque MÉCANISME de specsSource/specsOpen. La
  // RÉSOLUTION EXHAUSTIVE de toutes les INSTANCES (creatures/careerLevels/species/…) est déléguée à
  // LA GARDE UNIQUE ci-dessous (§ Phase 3 complétude) : aucune liste de domaines n'est tenue ici.
  describe('sanité de catalogue — specsSource déclaré, specs[] bien formées (Phase 3)', () => {
    it('skills.json/talents.json : specsSource migré → pool DÉRIVÉ (aucun specs[] inline), ids connus du registre', () => {
      const WEAPON_GROUP_IDS = new Set(weaponGroups.map((g) => g.id));
      const DOMAIN_IDS = new Set(domains.map((d) => d.id));
      const GOD_IDS = new Set(gods.map((g) => g.id));
      const cases: [ 'skills' | 'talents', string, SpecsSource, (id: string) => boolean ][] = [
        ['skills', 'corps-a-corps', 'weaponGroupsMelee', (id) => WEAPON_GROUP_IDS.has(id)],
        ['skills', 'projectiles', 'weaponGroupsRanged', (id) => WEAPON_GROUP_IDS.has(id)],
        ['skills', 'focalisation', 'winds', (id) => DOMAIN_IDS.has(id)],
        ['talents', 'magie-des-arcanes', 'arcaneDomains', (id) => DOMAIN_IDS.has(id)],
        ['talents', 'invocation', 'cultMiracles', (id) => GOD_IDS.has(id)],
        ['talents', 'magie-du-chaos', 'cultChaos', (id) => GOD_IDS.has(id)],
        ['talents', 'beni', 'cultBlessings', (id) => GOD_IDS.has(id)],
        ['talents', 'chanson-de-marin', 'seaShanties', (id) => !!findSeaShantyById(id)],
      ];
      for (const [cat, id, source, ok] of cases) {
        const def = cat === 'skills' ? byId('skill', id) : findTalentById(id);
        expect(def, id).toBeTruthy();
        expect(def!.specsSource, id).toBe(source);
        // Le pool DÉRIVE du registre (SPEC_SOURCES) : plus aucune liste `specs[]` maintenue à la main.
        expect(def!.specs, `${id} ne doit PAS porter de specs[] inline`).toBeUndefined();
        const pool = SPEC_SOURCES[source].pool();
        expect(pool.length, `${id} : pool vide`).toBeGreaterThan(0);
        for (const specId of pool) expect(ok(specId), `${id} → ${specId} inconnu du registre`).toBe(true);
      }
    });

    it('domaines FERMÉS inline (ex. langue/chevaucher/discretion/art/musicien/voile, talents resistance/sens-aiguise) : specs[] = {id,label}, specsOpen absent', () => {
      for (const id of ['langue', 'chevaucher', 'discretion', 'art', 'musicien', 'voile']) {
        const s = byId('skill', id)!;
        expect(s.specsOpen, id).toBeFalsy();
        expect((s.specs?.length ?? 0) > 0, id).toBe(true);
        for (const entry of s.specs ?? []) expect(isObj(entry) && typeof entry.id === 'string' && typeof entry.label === 'string', `${id} → ${JSON.stringify(entry)}`).toBe(true);
      }
      for (const id of ['resistance', 'sens-aiguise', 'artiste']) {
        const t = findTalentById(id)!;
        expect(t.specsOpen, id).toBeFalsy();
        for (const entry of t.specs ?? []) expect(isObj(entry) && typeof (entry as { id: unknown }).id === 'string', `${id} → ${JSON.stringify(entry)}`).toBe(true);
      }
    });

    it('domaines OUVERTS (ex. savoir/metier/divertissement/signes-secrets) : specsOpen:true, specs[] = {id,label}[]', () => {
      for (const id of ['savoir', 'metier', 'divertissement', 'dressage', 'representation', 'signes-secrets']) {
        const s = byId('skill', id)!;
        expect(s.specsOpen, id).toBe(true);
        expect((s.specs?.length ?? 0) > 0, id).toBe(true);
        for (const entry of s.specs ?? []) expect(isObj(entry) && typeof entry.id === 'string' && typeof entry.label === 'string', `${id} → ${JSON.stringify(entry)}`).toBe(true);
      }
    });
    // LDB 10 l.315 (Destinée) ; LDB 09 l.40 — Maître artisan (LDB 10 l.741), Travailleur qualifié (LDB 11 l.126),
    // Savant (LDB 10 l.1059) ; LDB 10 l.117 (Bon marcheur), l.548 (Haine), l.1051 (Sans peur), l.1071
    // (Savoir-vivre) ; ADE II 02 l.265 (Vice).
    it('Talents `specsOpen` : les Talents dont le livre ouvre la liste', () => {
      expect(talents.filter((t) => t.specsOpen).map((t) => t.id).sort()).toEqual([
        'bon-marcheur', 'destinee', 'haine', 'maitre-artisan', 'sans-peur', 'savant', 'savoir-vivre', 'travailleur-qualifie', 'vice',
      ]);
      for (const id of ['maitre-artisan', 'savant', 'travailleur-qualifie']) {
        for (const entry of findTalentById(id)!.specs ?? []) expect(isObj(entry) && typeof (entry as { id: unknown }).id === 'string', `${id} → ${JSON.stringify(entry)}`).toBe(true);
      }
    });
    // LDB 10 l.117, l.548, l.1051, l.1071 ; ADE II 02 l.265 ; LDB 10 l.315.
    it.each([
      ['bon-marcheur', 'Jungle'], ['haine', 'Nains'], ['sans-peur', 'Elfes'], ['savoir-vivre', 'Vagabonds'], ['vice', 'Jeu'],
      ['destinee', 'Noyé dans le Reik'],
    ])('Talent à liste ouverte « %s » : un groupe hors catalogue (« %s ») est admis', (id, groupe) => {
      expect((findTalentById(id)!.specs ?? []).some((e) => e.id === groupe || e.label === groupe), `${groupe} est déjà au catalogue de ${id}`).toBe(false);
      expect(entreeOuverte('talent', id), id).toBe(true);
      expect(refusDeSpec('talent', id, groupe), `${id} (${groupe})`).toBeNull();
    });
  });

  describe('specLabel/refLabel — résolution par domaine (Phase 3), FR verbatim inchangé pour le reste', () => {
    it('refLabel résout une Spé de Groupe d\'arme (weaponGroups) via son id', () => {
      expect(refLabel('skills', { id: 'corps-a-corps', spec: 'deux-mains' })).toBe('Corps à corps (Deux-mains)');
      expect(specLabel('skills', 'corps-a-corps', 'poudre-noire')).toBe(findWeaponGroupById('poudre-noire')!.label);
    });
    it('une spec ouverte hors catalogue (savoir…) reste verbatim (texte libre toléré)', () => {
      expect(specLabel('skills', 'savoir', 'Reikland')).toBe('Reikland');
      expect(refLabel('skills', { id: 'savoir', spec: 'Reikland' })).toBe('Savoir (Reikland)');
    });
    it('une spec MIGRÉE (langue/chevaucher/discretion, talent resistance) résout son id → label FR', () => {
      expect(specLabel('skills', 'langue', 'reikspiel')).toBe('Reikspiel');
      expect(refLabel('skills', { id: 'langue', spec: 'reikspiel' })).toBe('Langue (Reikspiel)');
      expect(refLabel('skills', { id: 'chevaucher', spec: 'cheval' })).toBe('Chevaucher (Cheval)');
      expect(refLabel('skills', { id: 'discretion', spec: 'urbaine' })).toBe('Discrétion (Urbaine)');
      expect(refLabel('talents', { id: 'resistance', spec: 'chaos' })).toBe('Résistance (Chaos)');
    });
    it('une spec de domaine Phase 3 complétude (musicien/sens-aiguise/chanson-de-marin) résout son id → label FR', () => {
      expect(specLabel('skills', 'musicien', 'tambour')).toBe('Tambour');
      expect(refLabel('talents', { id: 'sens-aiguise', spec: 'gout' })).toBe('Sens aiguisé (Goût)');
      expect(refLabel('talents', { id: 'chanson-de-marin', spec: 'jacques-bret-a-rencontre-notre-acier' }))
        .toBe('Chanson de marin (Jacques Bret a rencontré notre acier sur les mers !)');
    });
  });

  // ── L'ADMISSION d'une `spec` se juge au SCHÉMA, par l'ENTRÉE visée (`refusDeSpec`, `grammaire/ref.ts`),
  // sur tout document registré de `src/data` et `src/scenes` (`schema-contract.test.ts`). Restent ici ce
  // que le schéma ne voit pas :
  //  - une entrée OUVERTE (`entreeOuverte`) admet un texte libre, mais un texte dont le normalisé est un
  //    libellé FR CONNU de ses `specs[]` est une régression de migration (devrait être l'id) ;
  //  - les pré-tirés RUNTIME (`makePregens()`), composés en mémoire, jamais parsés par un schéma.
  describe('GARDE — libellés connus sur entrée OUVERTE, et pré-tirés runtime', () => {
    const norm = (s: string): string => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

    const OPEN = new Map<string, { ids: Set<string>; byLabel: Map<string, string> }>();
    for (const [type, defs] of [['skill', skills], ['talent', talents]] as const) {
      for (const def of defs as { id: string; specs?: SpecEntry[] }[]) {
        if (!def.specs?.length || !entreeOuverte(type, def.id)) continue;
        OPEN.set(def.id, { ids: new Set(def.specs.map(specEntryId)), byLabel: new Map(def.specs.map((e) => [norm(specEntryLabel(e)), specEntryId(e)])) });
      }
    }

    const nonMigres: string[] = [];
    function checkSpec(defId: string, spec: unknown, where: string): void {
      if (typeof spec !== 'string') return;
      const open = OPEN.get(defId);
      if (!open || open.ids.has(spec)) return;
      const knownId = open.byLabel.get(norm(spec));
      if (knownId) nonMigres.push(`${where} : ${defId} → ${JSON.stringify(spec)} (OUVERT, libellé FR CONNU non migré — devrait être « ${knownId} »)`);
    }
    function walk(node: unknown, where: string): void {
      if (Array.isArray(node)) { node.forEach((x) => walk(x, where)); return; }
      if (!isObj(node)) return;
      const idLike = (node.id ?? node.skillId ?? node.talentId ?? node.skill) as string | undefined;
      if (typeof idLike === 'string') checkSpec(idLike, node.spec, where);
      const wcId = (node.wildcard as { id?: string } | undefined)?.id;
      if (wcId && Array.isArray(node.specOptions)) for (const so of node.specOptions as unknown[]) checkSpec(wcId, so, `${where}.wildcard{${wcId}}.specOptions`);
      for (const v of Object.values(node)) walk(v, where);
    }

    it('creatures/careerLevels/species/stars/traits/trappings/talents/skills/crewRoles/tavernGames/seaWeather/pregens(runtime) : aucun libellé FR connu sur une entrée OUVERTE', () => {
      walk(creatures, 'creatures');
      walk(careerLevels, 'careerLevels');
      walk(species, 'species');
      walk(stars, 'stars');
      walk(traits, 'traits');
      walk(trappings, 'trappings');
      walk(talents, 'talents(self-réf)'); // ex. Oreille absolue.passive → Divertissement (Chant)
      walk(skills, 'skills(self-réf)');
      walk(crewRoles, 'crewRoles');
      walk(tavernGamesJson, 'tavernGames');
      walk(seaWeatherJson, 'seaWeather');
      walk(makePregens(), 'pregens(runtime — makePregens)'); // composition réelle career/species → Combatant
      expect(nonMigres, nonMigres.join('\n')).toEqual([]);
    });

    it('pregens(runtime — makePregens) : toute spec de Compétence/Talent est ADMISE par son entrée (`refusDeSpec`)', () => {
      const refus: string[] = [];
      for (const h of makePregens()) {
        for (const [type, refs] of [['skill', h.skills], ['talent', h.talents]] as const) {
          for (const r of refs as { id?: string; talentId?: string; spec?: string }[]) {
            const id = r.talentId ?? r.id;
            if (r.spec == null || id == null) continue;
            const motif = refusDeSpec(type, id, r.spec);
            if (motif) refus.push(`${h.id} : ${type} ${id} → ${JSON.stringify(r.spec)} (${motif})`);
          }
        }
      }
      expect(refus, refus.join('\n')).toEqual([]);
    });
  });
});

// ── CONTRAT POSITIF (#1342 L2-a) — `skills[].spec` d'une entrée SOURCÉE d'un livre EXTRAIT dans
// `Source/` : la spéc RÉSOUT au catalogue, toujours. Le statbloc est citable ligne à ligne, donc la
// spéc imprimée est soit une entrée du catalogue, soit une entrée à y créer (`skills.json#specs[]`,
// `source` à l'appui) — jamais du texte libre. Le périmètre et la marche des `skills[]` viennent du
// module PARTAGÉ avec la migration (`scripts/data/lib/skillSpecWalk.mjs`) : une garde qui remarcherait
// la donnée à sa façon mesurerait autre chose que le geste qu'elle garde.
type SpecDef = { specsSource?: SpecsSource; specs?: SpecEntry[] };
/** Une spéc RENCONTRÉE qui ne résout pas, nommée par sa clé stable `fichier|porteur|refId|spec`. */
type SpecHors = { where: string; key: string; book: string; refId: string; spec: string };

/**
 * MARCHE PARTAGÉE des deux contrats positifs — Compétences (#1342 L2-a) et Talents (#1457 B1) : même
 * périmètre (`creatures`/`careerLevels`/`species`), MÊME walker (`walkSkillRefs`, paramétré par son
 * tableau porteur) et MÊME porte de validité (`specResolves`, pool ou hors pool, #1342 L3). Deux
 * marches séparées mesureraient deux choses. `corpus` n'est fourni que par les contre-épreuves.
 */
function collecteSpecs(
  arrName: 'skills' | 'talents',
  defOf: (id: string) => SpecDef | undefined,
  corpus?: [string, { id?: string; label?: string; source?: { book?: string } }[]][],
): { hors: SpecHors[]; nues: { where: string; book: string; refId: string }[]; seen: number; sentinelles: string[] } {
  const hors: SpecHors[] = [];
  const nues: { where: string; book: string; refId: string }[] = [];
  const sentinelles: string[] = [];
  let seen = 0;
  const listes = corpus ?? ([
    ['creatures', creatures], ['careerLevels', careerLevels], ['species', species],
  ] as [string, { id?: string; label?: string; source?: { book?: string } }[]][]);
  for (const [file, list] of listes) {
    for (const entry of list) {
      const book = entry.source?.book ?? '(sans source)';
      const owner = entry.id ?? entry.label ?? '?';
      walkSkillRefs(entry, (node) => {
        const def = defOf(node.id);
        const catalogue = !!def?.specsSource || (Array.isArray(def?.specs) && def.specs.length > 0);
        // Un nœud à `choix` PORTE un régime de spécialisation (borne ou libre) : ce n'est pas une réf NUE.
        if (node.choix != null) return;
        if (node.spec == null) { if (catalogue) nues.push({ where: `${file}(${owner})`, book, refId: node.id }); return; }
        if (isSentinel(node.spec)) { sentinelles.push(`${file}|${owner}|${node.id}|${node.spec}`); return; }
        seen++;
        if (def && specResolves(def, node.spec)) return;
        hors.push({ where: `${file}(${owner})`, key: `${file}|${owner}|${node.id}|${node.spec}`, book, refId: node.id, spec: node.spec });
      }, arrName);
    }
  }
  return { hors, nues, seen, sentinelles };
}

describe('spec de Compétence d’un livre EXTRAIT — résout au catalogue (#1342 L2-a)', () => {
  const ROOT = fileURLToPath(new URL('../../', import.meta.url));
  const { extraits: EXTRAITS, dirManquant } = extractedBooks(books, ROOT);
  const { hors, nues, seen } = collecteSpecs('skills', (id) => byId('skill', id));

  it('creatures/careerLevels/species : zéro spec hors catalogue sous un livre extrait dans Source/', () => {
    // NON-VACUITÉ : sans lignes scannées ni extraction sur disque, le contrat serait vert à vide.
    expect(seen).toBeGreaterThan(500);
    expect(EXTRAITS.size).toBeGreaterThan(10);
    expect(dirManquant, `books.json#dir sans extraction sur disque : ${dirManquant.join(', ')}`).toEqual([]);
    const bad = hors.filter((h) => EXTRAITS.has(h.book)).map((h) => `${h.where} [${h.book}] : ${h.refId} → ${JSON.stringify(h.spec)}`);
    expect(bad, bad.join('\n')).toEqual([]);
  });

  // Le périmètre se DÉDUIT du dossier déclaré par le livre (`dir` pour l'Atlas RAW, `extractionDir`
  // hors Atlas — `sourceDirOf`) : une extraction FR que personne ne réclame y serait INVISIBLE. Ce
  // volet la nomme. Les dossiers FR sont reconnus au CONTENU, pas au nom — mesure du 2026-08-23.
  it('extractions FR de Source/ : chaque dossier est réclamé par un livre de books.json, hors liste nominative', () => {
    // Trois extractions FR sur disque qu'aucun livre de `books.json` ne porte — mesure du
    // 2026-08-23, extinction #1459.
    const NON_RECLAMES = new Set<string>([
      'Source/Boite d\'Initiation WFRP 4e Edition VF',
      'Source/WH4_FR_BI_Livre_Aventure',
      'Source/WH4_FR_BI_Livre_Ubersreik',
    ]);
    const dirs = frenchSourceDirs(ROOT);
    expect(dirs.length).toBeGreaterThan(10);
    const claimed = new Set(books.map((b) => sourceDirOf(b)).filter(Boolean) as string[]);
    const orphelins = dirs.filter((d) => !claimed.has(d));
    const inattendus = orphelins.filter((d) => !NON_RECLAMES.has(d));
    expect(inattendus, `extraction FR qu'aucun livre de books.json ne réclame — poser son dir/extractionDir, ou nommer ici :\n${inattendus.join('\n')}`).toEqual([]);
    const perimes = [...NON_RECLAMES].filter((d) => !orphelins.includes(d));
    expect(perimes, `dossier(s) désormais réclamé(s) — retirer de NON_RECLAMES :\n${perimes.join('\n')}`).toEqual([]);
  });

  // Une `ref` de Compétence GROUPÉE SANS `spec` est une forme RAW LÉGITIME, mesurée : LDB 08 l.3325
  // « Calme, Discrétion (Rurale), Escamotage, Focalisation, Intimidation … » (Ensorceleur) et LDB 08
  // l.3749 « Focalisation, *Intuition*, Langue (Magick) … » (Apprenti Sorcier de Village) impriment
  // Focalisation nue là où LDB 08 l.2448 imprime « Focalisation (Couleur au choix) » ; MCLB 07 l.238
  // imprime « Charme 57, Discrétion 43, Escamotage 45 … ». Le contrat est donc un CLIQUET : le compte
  // ne croît pas — c'est lui qui attrape une migration qui effacerait une `spec` sans retirer sa `ref`.
  it('refs de Compétence groupée SANS spec : compte stable (forme RAW attestée, jamais un résidu de migration)', () => {
    const BASELINE = 341;
    const parFichier = new Map<string, number>();
    for (const n of nues) parFichier.set(n.where.split('(')[0], (parFichier.get(n.where.split('(')[0]) ?? 0) + 1);
    expect(nues.length).toBeGreaterThan(0);
    expect(
      nues.length,
      `${[...parFichier.entries()].map(([f, n]) => `${f}:${n}`).join(', ')} — une ref nue de PLUS = une spec effacée sans sa ref`,
    ).toBeLessThanOrEqual(BASELINE);
  });

  // CONTRAT POSITIF NOMINATIF — `humains-tileens` porte EXACTEMENT les 12 Compétences de AA 05 l.122 :
  // « Calme, Charme, Corps à Corps (Base), Évaluation, Langue (Arabéen), Langue (Estalien), Langue
  // (Reikspiel), Langue (Tiléen), Marchandage, Projectiles (Arbalète), Ragot, Voile (Au choix) ».
  // Le `Savoir (Tilée)` retiré par le lot L2-a n'y était pas ; `Langue (Estalien)` y manquait.
  it('species humains-tileens : les 12 Compétences imprimées AA 05 l.122, sans trou ni surnombre', () => {
    const sp = species.find((s) => s.id === 'humains-tileens');
    expect(sp, 'humains-tileens absente de species.json').toBeTruthy();
    const rendu = sp!.skills.map((a) => {
      const r = a as { id: string; spec?: string; choix?: true | string[] };
      return r.choix != null ? `${r.id}(*)` : `${r.id}${r.spec ? `(${r.spec})` : ''}`;
    });
    expect(rendu).toEqual([
      'calme', 'charme', 'corps-a-corps(base)', 'evaluation',
      'langue(arabien)', 'langue(estalien)', 'langue(reikspiel)', 'langue(tileen)',
      'marchandage', 'projectiles(arbalete)', 'ragot', 'voile(*)',
    ]);
  });
});

// ── CONTRAT POSITIF — `talents[].spec` : toute spec de Talent RÉSOUT au catalogue du Talent par id, ou l'entrée
// porte `specsOpen` (`entreeOuverte`) et le texte libre n'y DÉSIGNE aucune entrée du catalogue par la couture
// label→id `resolveSpecId` (`src/engine/character.ts:69`). LDB 09 l.40, LDB 10 l.315.
describe('spec de Talent — résout au catalogue, ou texte libre d’une entrée specsOpen (LDB 09 l.40, LDB 10 l.315)', () => {
  const { hors, seen, sentinelles } = collecteSpecs('talents', (id) => findTalentById(id));
  /** L'entrée du catalogue que DÉSIGNE un texte libre par la couture label→id, `undefined` si aucune. */
  const designee = (h: SpecHors): string | undefined => {
    const id = resolveSpecId('talents', h.refId, h.spec);
    return id === h.spec ? undefined : id;
  };
  const ouverte = (h: SpecHors) => entreeOuverte('talent', h.refId) && designee(h) === undefined;

  /** Texte libre qui imprime une BORNE : au moins deux termes joints par « ou », chacun une entrée du
   *  catalogue (`frenchy.bzh 26 l.366`, `l.413`, `l.645`, `l.686`, `l.950`, `l.1008`). */
  const borne = (h: SpecHors): boolean => {
    const termes = h.spec.split(/\s+ou\s+/i).map((x) => x.trim()).filter(Boolean);
    return termes.length > 1 && termes.every((x) => resolveSpecId('talents', h.refId, x) !== x);
  };
  /** STOCK NOMINATIF DÉCROISSANT des bornes en texte libre (`borne`), #1473. Clé `fichier|porteur|talentId|spec`.
   *  `talentRefSchema` (`schemas/grammaire/reference.ts`) n'a pas de `choix` : la borne d'un statbloc
   *  n'a pas d'autre graphie que ce texte libre gelé ici, #1621. */
  const BORNES_EN_TEXTE_LIBRE = new Set<string>([
    'creatures|druide-de-la-foi-antique|bon-marcheur|Forêt ou Plaine',
    'creatures|haut-druide-de-la-foi-antique|bon-marcheur|Forêt ou Plaine',
    'creatures|haut-pretre-rodeur-de-taal|bon-marcheur|Forêt ou Plaine',
    'creatures|maitre-des-taillis|bon-marcheur|Plaine OU Forêt',
    'creatures|pretre-rodeur-de-taal|bon-marcheur|Forêt ou Plaine',
    'creatures|rebouteux|bon-marcheur|Plaine OU Forêt',
  ]);

  it('creatures/careerLevels/species : toute spec de Talent résout au catalogue, ou est un texte libre d’entrée specsOpen', () => {
    expect(seen).toBeGreaterThan(300);
    const bad = hors.filter((h) => !ouverte(h)).map((h) => {
      const id = designee(h);
      return `${h.where} [${h.book}] : ${h.refId} → ${JSON.stringify(h.spec)}${id ? ` — désigne l'entrée « ${id} » : écrire son id` : ' — entrée sans specsOpen : créer l\'entrée sourcée dans talents.json#specs[]'}`;
    });
    expect(bad, `spec de Talent qui ne résout pas par id :\n${bad.join('\n')}`).toEqual([]);
  });

  it('les textes libres d’entrée ouverte existent (Destinée, LDB 10 l.315) et le stock des bornes DÉCROÎT', () => {
    expect(hors.filter(ouverte).filter((h) => h.refId === 'destinee').length).toBeGreaterThan(0);
    const bornes = hors.filter(borne).map((h) => h.key);
    expect(bornes.filter((k) => !BORNES_EN_TEXTE_LIBRE.has(k)), 'borne neuve en texte libre : porteur d’emplacement → écrire `choix: [ids]` ; statbloc (`talentRefSchema` sans `choix`, #1621) → la geler dans BORNES_EN_TEXTE_LIBRE').toEqual([]);
    expect([...BORNES_EN_TEXTE_LIBRE].filter((k) => !bornes.includes(k)), 'clé(s) du stock sans borne — RETIRER du stock').toEqual([]);
  });

  it('CONTRÔLE POSITIF — `borne` découpe sur le MOT « ou », jamais dans un terme qui le contient', () => {
    const vue = (refId: string, spec: string) => borne({ refId, spec } as SpecHors);
    expect([
      vue('bon-marcheur', 'Toundra ou Littoral'), vue('bon-marcheur', 'Forêt ou Plaine'),
      vue('bon-marcheur', 'Plaine OU Forêt'), vue('bon-marcheur', 'Toundra'), vue('bon-marcheur', 'ForêtouPlaine'),
    ]).toEqual([true, true, true, false, false]);
  });

  it('les sentinelles « Au choix » de talents[] sont ÉCARTÉES de la résolution mais COMPTÉES et BORNÉES (#1621)', () => {
    const PLAFOND = 12;
    // Cliquet UNIDIRECTIONNEL. La sentinelle est un EMPLACEMENT de spéc, pas une spéc : `collecteSpecs` la
    // saute avant `seen++`, ce compte la garde dans la mesure. Lot de mort : E4, train 2b de #1473.
    const parTalent = [...sentinelles.reduce((m, k) => m.set(k.split('|')[2], (m.get(k.split('|')[2]) ?? 0) + 1), new Map<string, number>())]
      .sort((a, b) => b[1] - a[1]).map(([id, n]) => `${id}:${n}`).join(', ');
    expect(sentinelles.length).toBeGreaterThan(0);
    expect(
      sentinelles.length,
      `${parTalent} — une sentinelle « Au choix » de PLUS sur un talents[] : poser la spéc imprimée, ou trancher le régime choix (#1621) :\n${sentinelles.join('\n')}`,
    ).toBeLessThanOrEqual(PLAFOND);
  });

  it('CONTRÔLE POSITIF — texte libre : refusé sans specsOpen, refusé s’il désigne une entrée du catalogue, admis sinon (mutation EN MÉMOIRE)', () => {
    const fixture = {
      id: 'fixture-talent', source: { book: 'frenchy-bzh' },
      talents: [
        { id: 'sens-aiguise', spec: 'Sixième sens' }, { id: 'maitre-artisan', spec: 'Forgeron' },
        { id: 'maitre-artisan', spec: 'Souffleur de verre' }, { id: 'destinee', spec: 'Noyé dans le Reik' },
        { id: 'haine', spec: 'Nains' },
      ],
    };
    const corpus = [['creatures', [fixture]]] as unknown as [string, { id?: string; label?: string; source?: { book?: string } }[]][];
    const { hors: mordu } = collecteSpecs('talents', (id) => findTalentById(id), corpus);
    expect(mordu.filter((h) => !ouverte(h)).map((h) => `${h.key} → ${designee(h) ?? '-'}`)).toEqual([
      'creatures|fixture-talent|sens-aiguise|Sixième sens → -',
      'creatures|fixture-talent|maitre-artisan|Forgeron → forgeron',
    ]);
    expect(mordu.filter(ouverte).map((h) => h.key)).toEqual([
      'creatures|fixture-talent|maitre-artisan|Souffleur de verre',
      'creatures|fixture-talent|destinee|Noyé dans le Reik',
      'creatures|fixture-talent|haine|Nains',
    ]);
  });
});

// ── CONTRAT POSITIF — Corps à corps / Projectiles sont des Compétences GROUPÉES (LDB 62 l.139) : la
// seule `spec` admissible est un id de `weaponGroups.json`. L'armement naturel d'une créature est porté
// par son TRAIT (LDB 85 l.33), pas par un descripteur posé en `spec`. Contrat SANS liste d'exception :
// une nouvelle entrée de bestiaire qui réintroduirait « Griffes » y échoue.
describe('spec de Compétence GROUPÉE — corps-a-corps/projectiles ne portent QUE des Groupes d’armes', () => {
  const GROUPED_COMBAT_SKILLS = new Set(['corps-a-corps', 'projectiles']);

  function collect(node: unknown, where: string, arrKey: string | null, out: { where: string; skillId: string; spec: string }[], seen: { n: number }): void {
    if (Array.isArray(node)) { node.forEach((x) => collect(x, where, arrKey, out, seen)); return; }
    if (!isObj(node)) return;
    if (arrKey === 'skills' && typeof node.id === 'string' && GROUPED_COMBAT_SKILLS.has(node.id)) {
      seen.n++;
      if (typeof node.spec === 'string') out.push({ where, skillId: node.id, spec: node.spec });
    }
    for (const [k, v] of Object.entries(node)) collect(v, where, Array.isArray(v) ? k : (k === 'ref' ? arrKey : null), out, seen);
  }

  it('creatures/careerLevels/species : toute spec de corps-a-corps/projectiles résout dans weaponGroups', () => {
    const specs: { where: string; skillId: string; spec: string }[] = [];
    const seen = { n: 0 };
    collect(creatures, 'creatures', null, specs, seen);
    collect(careerLevels, 'careerLevels', null, specs, seen);
    collect(species, 'species', null, specs, seen);
    // NON-VACUITÉ : sans lignes scannées, le contrat serait vert à vide.
    expect(seen.n).toBeGreaterThan(0);
    expect(weaponGroups.length).toBeGreaterThan(0);
    const hors = specs.filter((s) => !findWeaponGroupById(s.spec))
      .map((s) => `${s.where} : ${s.skillId} → ${JSON.stringify(s.spec)}`);
    expect(hors, hors.join('\n')).toEqual([]);
  });
});

// ── CLIQUET anti-régression — dotations bête `{text}` de careerLevels.trappings (#622). Compte
// RÉCURSIF (y compris branches `{choice}`) de tout `{text}` narratif restant, y compris ceux qui
// resteront `{text}` (bateaux/véhicules sans entrée catalogue, bundles/choix, T3/T4, équipement).
// cliquet décroissant — un nouveau {text} de dotation échoue la CI ; à migrer en ref typée, jamais
// ajouter ; ABAISSER la baseline après chaque migration (#622).
// 526 → 620 (#730, curation VDM) : les 10 Carrières des *Vents de Magie* apportent 94 dotations que
// le catalogue `trappings.json` ne porte pas (Clefs des Secrets de l'Ordre Flamboyant, faucilles de
// cuivre/argent/or de l'Ordre de Jade, laboratoire alchimique portatif, observatoire, conclave de
// chamanes…) — 6 items (dague, justaucorps de cuir, licence de guilde, nécessaire d'écriture, pilon
// et mortier, plastron) qui ONT une entrée de catalogue sont posées en `{id}`.
// 620 → 628 (#730, Magister Vigilant + Umbramancien) : 2 Carrières manquantes du même corpus VDM
// posent grimoire, bâton de combat, cheval de guerre léger, nécessaire de déguisement, cape,
// capuchon et les 3 robes de sorcier (`robe-de-sorcier-fonctionnelle`/`-ordinaire`/`-elaboree`,
// `passive: skillDRBonus focalisation`) en `{id}`/`{creatureId}`. Il reste 8 dotations en `{text}`
// sur ces 2 Carrières : 7 hors catalogue (licence magique ×2, objet magique ×2, apprenti,
// bibliothèque, cercle d'informateurs) ; `atelier` était un 8e cas distinct — `trappingRefSchema`
// (`schemas/grammaire/reference.ts`) porte un champ `spec` optionnel sur la branche `{id}`, que
// `trappingRefLabel` (SOURCE UNIQUE du libellé affiché, `data/index.ts`) n'affichait pas.
// 628 → 605 (#622) : les 3 robes de sorcier et `filet` n'étaient posées en `{id}` que là où le
// geste précédent les avait touchées (Magister Vigilant/Umbramancien, chasseur-de-primes/femme-du-
// fleuve pour `filet`) ; leurs 7 Carrières sœurs du même corpus VDM (hierophante, alchimiste,
// druide, astromancien, spirite, pyromancien, chamane — niveaux 2 à 4) portaient les mêmes libellés
// en `{text}`, donc SANS `passive: skillDRBonus focalisation` en jeu pour ces Carrières. Les 23
// occurrences (21 robes + 2 `filet`) mesurées à l'identique du catalogue sont posées en `{id}`.
// 605 → 557 (#1463 L-ref-1) : les 48 dotations de `careerLevels` qui NOMMAIENT une possession du
// catalogue sont liées — 32 `{id, spec}` (« Outils professionnels (Maréchal-ferrant) », `LDB 08
// l.1130`), 1 `{choice}` (`alchimiste-4`, « Atelier (Ingénierie ou Magie) ») et 15 graphies non
// littérales (« Cartes »→`carte`, « Carreaux »→`carreau`, « Haches de lancer »→`hache-de-lancer`…).
// `trappingRefLabel` affiche désormais la `spec` (par `refConcrete`), ce qui lève la réserve notée
// plus haut sur `atelier`. Ce qui reste est hors catalogue ou narratif ; le contrat POSITIF qui
// l'atteste ligne à ligne vit dans `src/data/dotations-catalogue.test.ts` — trois portes (libellé
// entier, singulier, tête de parenthèse) et 6 exclusions nominatives, chacune avec sa raison.
describe('careerLevels.trappings — cliquet anti-régression {text} (#622)', () => {
  const BASELINE = 557;

  function countText(items: unknown[]): number {
    let n = 0;
    for (const raw of items) {
      if (!isObj(raw)) continue;
      const t = raw;
      if ('text' in t) n += 1;
      if (Array.isArray(t.choice)) n += countText(t.choice);
    }
    return n;
  }

  it(`careerLevels.flatMap(trappings) : au plus ${BASELINE} {text} (baseline post-migration #622)`, () => {
    const count = countText(careerLevels.flatMap((l) => l.trappings));
    expect(
      count,
      count > BASELINE
        ? `${count - BASELINE} nouvelle(s) dotation(s) {text} — migrer en ref typée ({creatureId}/{vehicleId}/{id}), jamais ajouter`
        : undefined,
    ).toBeLessThanOrEqual(BASELINE);
  });
});

// ── GARDE DE CLASSE — `appearance.species` = id STABLE, jamais un LIBELLÉ. Le champ route (1) le PLAN de
// rig par lookup EXACT `defById` dans DEF_BY_ID et (2) la RACE par `baseSpeciesOf` : un libellé n'y résout
// dans aucun registre exact et vit d'un défaut silencieux. Vocabulaire CANONIQUE des DONNÉES = ids de
// species.json (espèces jouables) ∪ ids de def rig (creatureSpeciesOptions) ∪ ids de raceAppearance.json
// (races d'apparence, sortie de `raceById`/`DEFAULT_RACE_ID`) ∪ formes de nuée (clés de SWARM_FORMS, lues
// par composeSwarm). `species` absent = OK (défaut Humain documenté).
// Cf. `CLAUDE.md` § Pour TOUT agent (« Toute LOGIQUE est keyée par id STABLE »).
describe('appearance.species — id stable (species.json ∪ defs rig ∪ raceAppearance ∪ formes de nuée), jamais un libellé', () => {
  const VALID_SPECIES = new Set<string>([
    ...species.map((s) => s.id),
    ...creatureSpeciesOptions().map((o) => o.id),
    ...raceAppearance.map((r) => r.id),
    ...Object.keys(SWARM_FORMS),
  ]);
  function collect(node: unknown, where: string, out: string[]): void {
    if (Array.isArray(node)) { node.forEach((x, i) => collect(x, `${where}[${i}]`, out)); return; }
    if (!isObj(node)) return;
    const app = node.appearance;
    if (isObj(app) && typeof app.species === 'string' && !VALID_SPECIES.has(app.species))
      out.push(`${where}.appearance.species = ${JSON.stringify(app.species)}`);
    for (const [k, v] of Object.entries(node)) collect(v, `${where}.${k}`, out);
  }

  it('projets Arène + Loup-et-Saumure : tout appearance.species est une clé exacte de species.json ∪ defs rig', () => {
    const bad: string[] = [];
    collect(areneProject, 'arene-projet.json', bad);
    collect(loupProject, 'loup-et-saumure-projet.json', bad);
    expect(bad, bad.join('\n')).toEqual([]);
  });

  it('creatures.json : tout appearance.species des records de créature résout dans le vocabulaire', () => {
    const bad: string[] = [];
    for (const c of creatures) collect(c, `creatures.json(${c.id})`, bad);
    expect(bad, bad.join('\n')).toEqual([]);
  });

  it('scénarios de test (scene + extraScenes + party) : tout appearance.species résout dans le vocabulaire', () => {
    const bad: string[] = [];
    for (const s of SCENARIOS) {
      collect(s.scene, `${s.id}.scene`, bad);
      if (s.extraScenes) collect(s.extraScenes, `${s.id}.extraScenes`, bad);
      collect(s.makeParty(), `${s.id}.party`, bad);
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });
});

// ── GÉNÉRALISATION DE LA GARDE PRÉCÉDENTE À TOUTE LA DONNÉE AUTHORÉE (#1537) : les 4 sources
// importées ci-dessus ne couvrent qu'une part des JSON du dépôt. Ce balayage lit les DEUX racines de
// données (`src/data`, `src/scenes`) sur DISQUE et vérifie tout `appearance.species` /
// `appearanceOverride.species` de chaîne contre `rigSpeciesVocab()` (vocabulaire du producteur
// validant `asRigSpeciesId`, cf. src/gameIso/rig/appearance.ts).
describe('appearance(.Override).species — TOUTE la donnée authorée des deux racines ⊆ rigSpeciesVocab()', () => {
  const RACINES = ['data', 'scenes'].map((d) => fileURLToPath(new URL(`../${d}`, import.meta.url)));
  /** Les `.json` d'une racine de données, à toute profondeur et en ORDRE TOTAL — la marche vient de
   *  `listerArbre` (`scripts/guards/lib/lister.mjs`), pas d'une récursion locale. */
  const jsonFiles = (dir: string): string[] =>
    listerArbre(dir, { filtre: (rel) => rel.endsWith('.json') }).map((rel) => `${dir}/${rel}`);

  it('tout species authoré dans src/data + src/scenes est un id du vocabulaire rig', () => {
    const VOCAB = rigSpeciesVocab();
    const files = RACINES.flatMap(jsonFiles);
    const bad: string[] = [];
    let sites = 0;
    const scan = (node: unknown, fichier: string, chemin: string): void => {
      if (Array.isArray(node)) { node.forEach((x, i) => scan(x, fichier, `${chemin}[${i}]`)); return; }
      if (!isObj(node)) return;
      for (const cle of ['appearance', 'appearanceOverride'] as const) {
        const app = node[cle];
        if (isObj(app) && typeof app.species === 'string') {
          sites++;
          if (!VOCAB.has(app.species))
            bad.push(`${fichier} : ${chemin}.${cle}.species = ${JSON.stringify(app.species)} hors vocabulaire rig`);
        }
      }
      for (const [k, v] of Object.entries(node)) scan(v, fichier, `${chemin}.${k}`);
    };
    for (const f of files) {
      const norm = f.replace(/\\/g, '/');
      const rel = norm.slice(norm.lastIndexOf('/src/') + 1);
      let doc: unknown;
      try { doc = JSON.parse(readFileSync(f, 'utf8')); } catch { continue; }
      scan(doc, rel, '$');
    }
    expect(bad, bad.join('\n')).toEqual([]);
    expect(files.length, 'aucun JSON balayé — le walker est cassé').toBeGreaterThan(100);
    expect(sites, 'la population de sites species s’est effondrée — le walker ne mesure plus rien').toBeGreaterThan(400);
  });
});

// ── SWEEP DE RÉFÉRENCES DE SCÈNE (#223, même walk que la garde species) — chaque `SceneEntity` d'un
// projet/scénario ne porte que des IDS STABLES (doctrine « labels interdits ») qui RÉSOLVENT au
// chargement, sinon repli silencieux/bruyant :
//  - `personnage`.ref → créature ∪ véhicule (coque) ∪ engin de siège (trapping siegeRig), les 3 familles
//    légitimes du spawn (`spawnEnemy`) ; `undefined` (statbloc/générique) toléré.
//  - `weapon` → `trappingId` EXACT du catalogue d'armes (`findTrappingById`).
//  - `appearance.tenue` → id EXACT de garde-robe (carrière ∪ classe ∪ tenue ∪ 'nu', `wardrobeKeyResolves`).
//    Le vocabulaire est le MÊME que le résolveur de rendu (`tenueFor` : une carrière SANS tenue dédiée
//    résout par sa classe) — d'où l'ensemble carrière∪classe∪tenue plutôt que les seules tenues.
// Toute violation ci-dessus = `fichier/entité/valeur`. DUR partout (projets régénérés par l'auteur en ids).
describe('refs de scène — ref/weapon/tenue = ids EXACTS du catalogue (#223, labels interdits)', () => {
  const refResolves = (ref: string): boolean =>
    !!findCreatureById(ref) || !!findVehicleById(ref)?.hull || !!findTrappingById(ref)?.siegeRig;
  const ENTITY_KINDS = new Set(['heroStart', 'personnage', 'prop']);
  function sweep(node: unknown, where: string, out: string[]): void {
    if (Array.isArray(node)) { node.forEach((x, i) => sweep(x, `${where}[${i}]`, out)); return; }
    if (!isObj(node)) return;
    if (typeof node.kind === 'string' && ENTITY_KINDS.has(node.kind) && isObj(node.pos)) {
      const who = `${where}(${node.id ?? node.label ?? node.kind})`;
      if (node.kind === 'personnage' && typeof node.ref === 'string' && !refResolves(node.ref))
        out.push(`${who}.ref = ${JSON.stringify(node.ref)} (ni créature ∪ véhicule ∪ engin de siège)`);
      if (typeof node.weapon === 'string' && !findTrappingById(node.weapon))
        out.push(`${who}.weapon = ${JSON.stringify(node.weapon)} (pas un trappingId du catalogue d'armes)`);
      const app = node.appearance;
      if (isObj(app) && typeof app.tenue === 'string' && !wardrobeKeyResolves(app.tenue))
        out.push(`${who}.appearance.tenue = ${JSON.stringify(app.tenue)} (pas un id carrière ∪ classe ∪ tenue)`);
    }
    for (const [k, v] of Object.entries(node)) sweep(v, `${where}.${k}`, out);
  }

  it('projets Arène + Loup-et-Saumure : ref/weapon/tenue = ids exacts (DUR)', () => {
    const bad: string[] = [];
    sweep(areneProject, 'arene-projet.json', bad);
    sweep(loupProject, 'loup-et-saumure-projet.json', bad);
    expect(bad, bad.join('\n')).toEqual([]);
  });

  it('scénarios de test (scene + extraScenes + party) : ref/weapon/tenue de chaque entité résolvent', () => {
    const bad: string[] = [];
    for (const s of SCENARIOS) {
      sweep(s.scene, `${s.id}.scene`, bad);
      if (s.extraScenes) sweep(s.extraScenes, `${s.id}.extraScenes`, bad);
      sweep(s.makeParty(), `${s.id}.party`, bad);
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });
});

// ── GARDE DE CLASSE (#222) — anti-copie-périmée des POSTES d'artillerie. Un `ShipPoste` AUTHORÉ ne porte que
// sa RÉF catalogue (`trappingId`) ; la base (Dégâts/Qualités/Enc/Portée) est HYDRATÉE au spawn (`hydratePoste`
// → `itemFromTrappingById`), JAMAIS matérialisée dans la donnée de scène (qui dériverait du catalogue).
//  - INVARIANT DUR (toutes scènes) : un poste NEUF (`trappingId` au niveau du poste) NE porte AUCUNE base
//    copiée (`item`/`damage`/`qualities`/`enc`…) et sa réf RÉSOUT au catalogue.
//  - INVARIANT DUR (projets de campagne, #218) : ZÉRO poste en forme ANCIENNE (`item` complet copié) — les
//    deux projets sont régénérés par `scripts/campagne/lib.mjs::poste` (forme référence `{ trappingId, … }`).
describe('postes d’artillerie — réf catalogue hydratée, jamais une base copiée (#222)', () => {
  const BASE_FIELDS = ['item', 'damage', 'qualities', 'enc', 'range', 'reach', 'pa'] as const;
  const walkPostes = (node: unknown, where: string, visit: (poste: Record<string, unknown>, where: string) => void): void => {
    if (Array.isArray(node)) { node.forEach((x, i) => walkPostes(x, `${where}[${i}]`, visit)); return; }
    if (!isObj(node)) return;
    if (Array.isArray(node.postes)) node.postes.forEach((p, i) => { if (isObj(p)) visit(p, `${where}.postes[${i}]`); });
    for (const [k, v] of Object.entries(node)) walkPostes(v, `${where}.${k}`, visit);
  };

  it('INVARIANT DUR — tout poste NEUF (`trappingId`) résout au catalogue et NE matérialise aucune base', () => {
    const bad: string[] = [];
    const hard = (p: Record<string, unknown>, where: string): void => {
      if (typeof p.trappingId !== 'string') return; // forme ancienne (item) → report ci-dessous
      if (!findTrappingById(p.trappingId)) bad.push(`${where} : trappingId « ${p.trappingId} » inconnu du catalogue`);
      for (const f of BASE_FIELDS) if (f in p) bad.push(`${where} : « ${f} » copié alors qu'hydratable de « ${p.trappingId} » (base interdite en donnée, #222)`);
    };
    walkPostes(areneProject, 'arene-projet.json', hard);
    walkPostes(loupProject, 'loup-et-saumure-projet.json', hard);
    for (const s of SCENARIOS) {
      walkPostes(s.scene, `${s.id}.scene`, hard);
      if (s.extraScenes) walkPostes(s.extraScenes, `${s.id}.extraScenes`, hard);
      walkPostes(s.makeParty(), `${s.id}.party`, hard);
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });

  it('INVARIANT DUR (#218) — les projets régénérés ne portent AUCUN poste en forme ANCIENNE (item copié)', () => {
    const stale: string[] = [];
    walkPostes(areneProject, 'arene-projet.json', (p, where) => { if (typeof p.trappingId !== 'string' && isObj(p.item)) stale.push(where); });
    walkPostes(loupProject, 'loup-et-saumure-projet.json', (p, where) => { if (typeof p.trappingId !== 'string' && isObj(p.item)) stale.push(where); });
    expect(stale, `postes old-format (item copié) restants — régénérer via scripts/campagne/lib.mjs::poste :\n${stale.join('\n')}`).toEqual([]);
  });
});

// ── PROTHÈSES (traumas.json) — `prosthesis[].trappingId` est la ref par laquelle une séquelle sait
// quel objet ANNULE son effet (`cancels: 'all'|'movement'`, `src/engine/trauma.ts`). Un id fantôme
// rend l'annulation inatteignable en silence : le porteur garde sa séquelle quoi qu'il équipe.
describe('traumas.prosthesis — trappingId = id du catalogue qui résout', () => {
  interface ProsthesisRow { id: string; prosthesis?: { trappingId: string; cancels: string }[] }
  const rows = traumasJson as ProsthesisRow[];

  const scan = (fiches: ProsthesisRow[]): string[] => {
    const bad: string[] = [];
    for (const f of fiches) {
      (f.prosthesis ?? []).forEach((p, i) => {
        if (!findTrappingById(p.trappingId)) bad.push(`traumas.json(${f.id}).prosthesis[${i}] → ${JSON.stringify(p.trappingId)}`);
      });
    }
    return bad;
  };

  it('chaque prothèse déclarée pointe une entrée réelle de trappings.json', () => {
    const bad = scan(rows);
    expect(bad, bad.join('\n')).toEqual([]);
  });

  it('la garde n’est pas vacante — une fiche à prothèse fantôme est REFUSÉE (contre-épreuve)', () => {
    expect(rows.some((f) => (f.prosthesis?.length ?? 0) > 0)).toBe(true); // le scan a bien de la matière à voir
    expect(scan([{ id: 'fixture', prosthesis: [{ trappingId: 'jambe-de-bois-fantome', cancels: 'movement' }] }])).toHaveLength(1);
  });
});

// ── AURA DE TRAIT (traits.json) — `aura.affectsGroups[]` est la ref par laquelle une aura restreint ses
// bénéficiaires à des Groupes d'appartenance (`groupMatch`, `src/engine/groups.ts`, projection
// `recompute-auras`). Le champ vit sur l'ENTITÉ, pas sur une `GameOp` : il échappe au périmètre dérivé
// de l'union `GameOp` (`gameOpRefFk.mjs`) et se déclare donc ici. Un id fantôme ne matcherait AUCUN
// combattant : l'aura deviendrait muette en silence, sans jamais échouer.
describe('traits.aura.affectsGroups — ids de groups.json qui résolvent', () => {
  interface AuraRow { id: string; aura?: { affectsGroups?: string[] } }
  const rows = traits as unknown as AuraRow[];

  const scan = (entries: AuraRow[]): string[] => {
    const bad: string[] = [];
    for (const t of entries) {
      (t.aura?.affectsGroups ?? []).forEach((g, i) => {
        if (!findGroupById(g)) bad.push(`traits.json(${t.id}).aura.affectsGroups[${i}] → ${JSON.stringify(g)}`);
      });
    }
    return bad;
  };

  it('chaque Groupe visé par une aura pointe une entrée réelle de groups.json', () => {
    const bad = scan(rows);
    expect(bad, bad.join('\n')).toEqual([]);
  });

  it('la garde n’est pas vacante — une aura à Groupe fantôme est REFUSÉE (contre-épreuve)', () => {
    expect(rows.some((t) => (t.aura?.affectsGroups?.length ?? 0) > 0)).toBe(true); // le scan a de la matière à voir
    expect(scan([{ id: 'fixture', aura: { affectsGroups: ['groupe-fantome'] } }])).toHaveLength(1);
  });
});

// ── APPARTENANCE DÉCLARÉE (#1318 E4/C4) — `grantGroups` sur l'entrée d'espèce/carrière/classe/culte/
// créature, et `exceptGroups` sur l'entrée de Groupe JOKER, sont les ids que `groupsFor`/`groupMatch`
// (`src/engine/groups.ts`) poussent TELS QUELS : plus aucune table de mots-clés en code. Un id fantôme
// ne serait jamais visé par une Cible de Trait psy — l'appartenance disparaîtrait en silence.
describe('grantGroups / exceptGroups — ids de groups.json qui résolvent (#1318 E4/C4)', () => {
  interface GrantRow { id: string; grantGroups?: string[] }
  const PORTEURS: [string, GrantRow[]][] = [
    ['species.json', species as GrantRow[]],
    ['careers.json', careers as GrantRow[]],
    ['classes.json', classes as GrantRow[]],
    ['gods.json', gods as GrantRow[]],
    ['creatures.json', creatures as unknown as GrantRow[]],
  ];

  const scan = (file: string, entries: GrantRow[]): string[] =>
    entries.flatMap((e) =>
      (e.grantGroups ?? []).flatMap((g, i) => (findGroupById(g) ? [] : [`${file}(${e.id}).grantGroups[${i}] → ${JSON.stringify(g)}`])),
    );

  it('chaque Groupe accordé par une entrée pointe une entrée réelle de groups.json', () => {
    const bad = PORTEURS.flatMap(([file, entries]) => scan(file, entries));
    expect(bad, bad.join('\n')).toEqual([]);
  });

  it('chaque `exceptGroups` d’un Groupe joker pointe une entrée réelle de groups.json', () => {
    const bad = groups.flatMap((g) =>
      (g.exceptGroups ?? []).flatMap((x, i) => (findGroupById(x) ? [] : [`groups.json(${g.id}).exceptGroups[${i}] → ${JSON.stringify(x)}`])),
    );
    expect(bad, bad.join('\n')).toEqual([]);
    expect(groups.some((g) => (g.exceptGroups?.length ?? 0) > 0)).toBe(true); // matière réelle à voir
  });

  it('la garde n’est pas vacante — chaque registre PORTE le champ, et un id fantôme est REFUSÉ', () => {
    for (const [file, entries] of PORTEURS) {
      expect(entries.some((e) => (e.grantGroups?.length ?? 0) > 0), file).toBe(true);
    }
    expect(scan('fixture.json', [{ id: 'fixture', grantGroups: ['groupe-fantome'] }])).toHaveLength(1);
  });
});

// ── RÉFÉRENCES DES `GameOp` DE LA DONNÉE COMMITÉE (#847) — `applyOps` (`src/engine/ops.ts`)
// empile sans valider ; le gate d'édition ne voit que ce qui passe par l'UI. Le PÉRIMÈTRE (quels
// champs d'op portent une référence) est DÉRIVÉ de l'union `GameOp` par le TypeChecker, moins les
// CHAMPS D'OP À SLOT d'`OP_DEFS` (`champsDOpASlot`), vérifiés au parse ; la CIBLE de chaque autre
// champ est déclarée dans `scripts/guards/lib/gameOpRefFk.mjs` — dont l'en-tête écrit ce que la garde
// ne voit pas. Les registres sont câblés ICI, où ils sont typés.
describe('GameOp — toute référence de la donnée committée résout dans son registre (#847)', () => {
  const MUTATION_TABLE_IDS = new Set(mutationTables.map((t) => t.id));
  const TRAUMA_IDS = new Set((traumasJson as { id: string }[]).map((t) => t.id));

  const resolvers: Record<string, (id: string) => boolean> = {
    etats: (id) => !!findConditionById(id),
    groups: (id) => !!findGroupById(id),
    psychology: (id) => !!findPsychologyById(id),
    traits: (id) => !!findTraitById(id),
    talents: (id) => !!findTalentById(id),
    skills: (id) => !!byId('skill', id),
    maladies: (id) => !!findDiseaseById(id),
    symptoms: (id) => !!findSymptomById(id),
    traumas: (id) => TRAUMA_IDS.has(id),
    trappings: (id) => !!findTrappingById(id),
    qualities: (id) => !!findQualityById(id),
    weaponGroups: (id) => !!findWeaponGroupById(id),
    creatures: (id) => !!findCreatureById(id),
    crewTestTypes: (id) => !!findCrewTestTypeById(id),
    mutationTables: (id) => MUTATION_TABLE_IDS.has(id),
    terrains: (id) => terrainEntree(id) !== undefined,
    lightTones: (id) => !!findLightToneById(id),
  };

  /** Le corpus des DEUX racines, celui que parse le registre des slots (`scanDuCorpus`) : une seule
   *  lecture, pour que les nœuds d’op du scan se joignent à ceux du parse par IDENTITÉ d’objet. */
  const { defs: DEFS, scan: CORPUS } = scanDuCorpus(REPO_ROOT);
  const sources = [...CORPUS.brutParNom].map(([file, data]) => ({ file, data }));
  const CHAMPS_A_SLOT = champsDOpASlot();
  const softIds = { etats: Object.keys(NARRATIVE_MARKERS) };
  const scan = scanGameOpRefs({ sources, resolvers, softIds, champsASlot: CHAMPS_A_SLOT });

  it('le périmètre est DÉRIVÉ de l’union GameOp moins les champs d’op à slot : aucun champ de référence sans cible déclarée', () => {
    const { derived, unclassified, stale } = auditFieldCoverage(REPO_ROOT, { champsASlot: CHAMPS_A_SLOT });
    expect(derived.length, 'aucun champ dérivé — l’extraction du type a échoué').toBeGreaterThan(38);
    expect(unclassified, `champs de GameOp sans cible déclarée (gameOpRefFk.mjs) :\n${unclassified.join('\n')}`).toEqual([]);
    expect(stale.map((c) => `${c.key} — ${c.raison}`), 'cibles déclarées hors périmètre').toEqual([]);
  });

  it('une cible déclarée sur un champ d’op à slot sort en `stale`, raison nommée (contre-épreuve)', () => {
    expect(CHAMPS_A_SLOT.has('removeTrait.traitId')).toBe(true);
    const declare = GAMEOP_FIELD_TARGETS as Record<string, unknown>;
    declare['removeTrait.traitId'] = { registry: 'traits' };
    try {
      const { stale: doublon } = auditFieldCoverage(REPO_ROOT, { champsASlot: CHAMPS_A_SLOT });
      expect(doublon.map((c) => c.key)).toEqual(['removeTrait.traitId']);
      expect(doublon[0].raison).toMatch(/typé AU PARSE par sa feuille `idDe` d’`OP_DEFS`/);
    } finally {
      delete declare['removeTrait.traitId'];
    }
  });

  // COUVERTURE (#1473) : le scan saute les champs d'op à slot (`champsDOpASlot`, dérivé d'`OP_DEFS`), que
  // le parse juge par leur feuille `idDe`. Ce test prouve la JOINTURE : tout nœud `GameOp` que le scan
  // visite est ATTEINT par le parse de mesure (`opsDuParse`, par IDENTITÉ d'objet). « Atteint » seul ne
  // juge rien (`marquerOpAtteinte` précède `OP_DEFS[v.op]`) : c'est le couple « atteint » + champs sautés
  // dérivés d'`OP_DEFS` qui couvre — un champ d'une op de `OPS_NON_TYPEES` reste au scan FK. Un nœud non
  // atteint pend sous un conteneur que le parse ne descend pas : son conteneur se type.
  // Stock NOMINATIF, compte EXACT par document : les ops du dialecte `jsonOpSchema`
  // (`schemas/defs/miscast.ts`), lot de mort #1902.
  const HORS_PARSE: Record<string, number> = { 'miscast.json': 77 };
  const ATTEINTES = opsDuParse(CORPUS, DEFS);
  type NoeudDOp = (typeof scan.noeudsDOp)[number];
  /** La jointure scan ↔ parse : les nœuds d'op visités que le parse de mesure n'atteint pas. */
  const horsDuParse = (noeuds: readonly NoeudDOp[], atteintes: ReadonlySet<object>) => noeuds.filter((n) => !atteintes.has(n.noeud));
  const ligneHorsParse = (n: NoeudDOp) => `${n.path} : ${n.op}`;
  it('tout nœud GameOp du corpus est atteint par le parse de mesure, hors stock nominatif', () => {
    expect(scan.noeudsDOp.length, 'aucun nœud d’op visité — le scan est vide').toBeGreaterThan(500);
    const hors = horsDuParse(scan.noeudsDOp, ATTEINTES);
    const parDocument: Record<string, number> = {};
    for (const n of hors) parDocument[n.file] = (parDocument[n.file] ?? 0) + 1;
    const lignes = hors.filter((n) => !(n.file in HORS_PARSE)).map(ligneHorsParse);
    expect(lignes, `nœuds d’op hors du parse — typer leur conteneur (OP_DEFS) :\n${lignes.join('\n')}`).toEqual([]);
    expect(parDocument, 'le stock HORS_PARSE est EXACT : un compte qui baisse se reporte au stock').toEqual(HORS_PARSE);
  });

  // Conteneur OPAQUE : `seaEventDef.params`, `z.record(z.string(), z.unknown())` (`schemas/defs/sea-events.ts:35`).
  it('une op typée sous un conteneur que le parse ne descend pas est vue du scan, absente du parse, nommée hors parse (fixture)', () => {
    const def = DEFS.find((d) => d.file === 'sea-events.json');
    expect(def, 'def de sea-events.json introuvable').toBeTruthy();
    const document = structuredClone(CORPUS.brutParNom.get('sea-events.json')) as { boardEvents: { params: Record<string, unknown> }[] };
    const op = { op: 'domeWard', traitId: IDS_PAR_DATASET['traits.json'][0], indice: 1 };
    document.boardEvents[0].params.ops = [op];
    const noeuds = scanGameOpRefs({ sources: [{ file: 'sea-events.json', data: document }], resolvers, champsASlot: CHAMPS_A_SLOT }).noeudsDOp;
    expect(noeuds.map((n) => n.noeud)).toEqual([op]);
    const atteintes = opsDuParse({ brutParNom: new Map<string, unknown>([['sea-events.json', document]]) }, [def!]);
    expect(atteintes.has(op)).toBe(false);
    expect(horsDuParse(noeuds, atteintes).map(ligneHorsParse)).toEqual(['sea-events.json.boardEvents[0].params.ops[0] : domeWard']);
  });

  // Le stock HORS_PARSE n'a pas de parse d'op : chaque chaîne de ses champs d'op à slot, que le scan
  // saute, est une CASE validée par `idDe` au parse de SON document (`slotsDuParse`), ou elle n'est
  // jugée par personne.
  const renduNonJuge = (v: { path: string; valeur: string }) => `${v.path} = ${JSON.stringify(v.valeur)}`;
  it('hors du parse d’op, toute chaîne d’un champ d’op à slot est jugée par le parse de son document', () => {
    const nonJuges = slotsDOpNonJuges(scan.noeudsDOp, ATTEINTES, slotsDuParse(CORPUS, DEFS), CHAMPS_A_SLOT).map(renduNonJuge);
    expect(nonJuges, `champs d’op à slot jugés par AUCUN parse — typer leur porteur (idDe) :\n${nonJuges.join('\n')}`).toEqual([]);
  });

  it('hors du parse d’op, un champ d’op à slot que le dialecte ne type pas est REFUSÉ (contre-épreuve)', () => {
    const miscastDef = DEFS.find((d) => d.file === 'miscast.json');
    expect(miscastDef, 'def de miscast.json introuvable').toBeTruthy();
    const [table] = structuredClone(CORPUS.brutParNom.get('miscast.json')) as { entries: { id: string; ops?: object[] }[] }[];
    const rangee = table.entries.find((e) => e.id === 'mineure-langue-maladroite')!;
    rangee.ops!.push({ op: 'condition', id: 'etat-fantome' });
    table.entries = [rangee];
    const brutParNom = new Map<string, unknown>([['miscast.json', [table]]]);
    const noeuds = scanGameOpRefs({ sources: [{ file: 'miscast.json', data: [table] }], resolvers }).noeudsDOp;
    const atteintes = opsDuParse({ brutParNom }, [miscastDef!]);
    expect(noeuds.filter((n) => atteintes.has(n.noeud)), 'la fixture doit rester HORS du parse d’op').toEqual([]);
    const slots = slotsDuParse({ brutParNom }, [miscastDef!]);
    expect(slotsDOpNonJuges(noeuds, atteintes, slots, CHAMPS_A_SLOT)).toEqual([]);
    const avecSlot = new Set([...CHAMPS_A_SLOT, 'condition.id']);
    expect(slotsDOpNonJuges(noeuds, atteintes, slots, avecSlot).map(renduNonJuge))
      .toEqual(['miscast.json[0].entries[0].ops[1].id = "etat-fantome"']);
  });

  it('une op sous un conteneur d’ops est atteinte par le parse : une valeur OBJET fantôme y est REFUSÉE (contre-épreuve)', () => {
    const delayed = (id: string) => ({ op: 'delayed', afterDays: 1, ops: [{ op: 'testMod', amount: -10, exceptSkills: [{ id }] }] });
    expect(mesureDuParse(gameOpSchema, delayed('athletisme')).ops).toEqual([[], ['ops', 0]]);
    const refus = gameOpSchema.safeParse(delayed('competence-fantome'));
    expect(refus.success).toBe(false);
    expect(refus.error?.issues.map((i) => i.path.join('.'))).toEqual(['ops.0.exceptSkills.0.id']);
  });

  it('chaque registre visé par la table a son résolveur câblé', () => {
    expect(scan.missingResolvers, scan.missingResolvers.join(', ')).toEqual([]);
  });

  it('src/data/*.json + src/scenes/**.json : toute ref d’op résout', () => {
    expect(sources.length, 'aucun document scanné').toBeGreaterThan(50);
    const lines = scan.offenders.map(formatOffender);
    expect(lines, lines.join('\n')).toEqual([]);
  });

  // Le format d'une cible est un ensemble FERMÉ (`gameOpRefFk.mjs`, doc de `GAMEOP_FIELD_TARGETS`) :
  // `{ registry }` | `{ nonRef }` | `{ coveredBy }`. Une clé hors de cet ensemble serait lue par
  // PERSONNE dans `scanGameOpRefs` — donc une tolérance muette, ou un champ tenu pour gardé sans l'être.
  it('le format d’une cible est fermé : aucune clé hors registry/nonRef/coveredBy', () => {
    const CLES = new Set(['registry', 'nonRef', 'coveredBy']);
    const anomalies: string[] = [];
    for (const [cible, decl] of Object.entries(GAMEOP_FIELD_TARGETS as Record<string, Record<string, unknown>>)) {
      for (const cle of Object.keys(decl)) {
        if (!CLES.has(cle)) anomalies.push(`${cible} : clé « ${cle} » hors du format fermé`);
      }
      const formes = ['registry', 'nonRef', 'coveredBy'].filter((k) => k in decl);
      if (formes.length !== 1) {
        anomalies.push(`${cible} : ${formes.length} forme(s) déclarée(s) [${formes.join(', ')}] — il en faut une et une seule`);
      }
      for (const k of ['registry', 'nonRef', 'coveredBy']) {
        if (k in decl && (typeof decl[k] !== 'string' || !decl[k])) anomalies.push(`${cible} : « ${k} » n’est pas un texte non vide`);
      }
    }
    expect(anomalies, anomalies.join('\n')).toEqual([]);
  });

  it('la garde n’est pas vacante — une op à référence fantôme est REFUSÉE (contre-épreuve)', () => {
    const fixture = [{
      file: 'fixture.json',
      data: [{ effects: [{ flow: { effect: { ops: [{ op: 'grantTrait', traitId: 'marque-de-tzeentch' }] } } }] }],
    }];
    expect(scanGameOpRefs({ sources: fixture, resolvers }).offenders).toEqual([]);
    const phantom = [{
      file: 'fixture.json',
      data: [{ effects: [{ flow: { effect: { ops: [{ op: 'grantTrait', traitId: 'marque-fantome' }] } } }] }],
    }];
    const out = scanGameOpRefs({ sources: phantom, resolvers }).offenders;
    expect(out).toHaveLength(1);
    expect(out[0].registry).toBe('traits');
    expect(out[0].path).toBe('fixture.json[0].effects[0].flow.effect.ops[0].traitId');
  });

  it('un marqueur narratif (`NARRATIVE_MARKERS`) résout là où son registre est visé, et seulement s’il est injecté', () => {
    const [marqueur] = Object.keys(NARRATIVE_MARKERS);
    const fixture = [{ file: 'fixture.json', data: [{ op: 'condition', id: marqueur }] }];
    expect(scanGameOpRefs({ sources: fixture, resolvers, softIds }).offenders.map(formatOffender)).toEqual([]);
    expect(scanGameOpRefs({ sources: fixture, resolvers }).offenders).toHaveLength(1);
  });

  it('un champ NON-RÉFÉRENCE porte sa justification, un champ gardé ailleurs nomme sa garde', () => {
    for (const [key, t] of Object.entries(GAMEOP_FIELD_TARGETS)) {
      if ('registry' in t) { expect(resolvers[t.registry], `${key} → registre inconnu ${t.registry}`).toBeTruthy(); continue; }
      const why = 'nonRef' in t ? t.nonRef : t.coveredBy;
      expect(typeof why === 'string' && why.length > 20, `${key} : justification absente ou trop maigre`).toBe(true);
    }
  });
});

// ── GARDE STRUCTURELLE — Schéma de Progression d'une Carrière (LDB 07 l.41-43) : 6 marques au
// total, deux à deux disjointes — 3 au niveau 1, puis 1 par niveau (2/3/4). NE vérifie PAS
// l'AFFECTATION marque→caractéristique (quelle Caractéristique porte le cuivre/l'argent/l'or pour
// une Carrière donnée) : une permutation entre deux niveaux passe cette garde. Cette affectation
// se mesure au PDF (rects `non_stroking_color` par colonne) et fait l'objet d'un ticket séparé.
describe('careerLevels — Schéma de Progression : cardinalité 3/1/1/1 et disjonction des marques, PAS l\'affectation marque→caractéristique (LDB 07 l.41-43)', () => {
  it('chaque Carrière : niveau 1 = 3 caractéristiques, niveaux 2/3/4 = 1 chacun, aucun doublon', () => {
    const byCareer = new Map<string, typeof careerLevels>();
    for (const l of careerLevels) {
      const bucket = byCareer.get(l.career) ?? [];
      bucket.push(l);
      byCareer.set(l.career, bucket);
    }
    const offenders: string[] = [];
    for (const [career, levels] of byCareer) {
      const levelCounts = new Map<number, number>();
      for (const l of levels) levelCounts.set(l.level, (levelCounts.get(l.level) ?? 0) + 1);
      const dupLevels = [...levelCounts.entries()].filter(([, n]) => n > 1).map(([lvl]) => lvl);
      if (dupLevels.length > 0) {
        offenders.push(`${career} : niveau(x) en double [${dupLevels.join(', ')}]`);
        continue;
      }
      const byLevel = new Map(levels.map((l) => [l.level, l]));
      const nums = [...byLevel.keys()].sort((a, b) => a - b).join(',');
      if (nums !== '1,2,3,4') { offenders.push(`${career} : niveaux présents [${nums}], attendu [1,2,3,4]`); continue; }
      const perLevel = [1, 2, 3, 4].map((n) => byLevel.get(n)!.characteristics);
      const expected = [3, 1, 1, 1];
      perLevel.forEach((chars, i) => {
        if (chars.length !== expected[i]) {
          offenders.push(`${career} niveau ${i + 1} : ${chars.length} caractéristique(s), attendu ${expected[i]}`);
        }
      });
      const all = perLevel.flat();
      if (new Set(all).size !== all.length) offenders.push(`${career} : doublon parmi [${all.join(', ')}]`);
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });
});

describe('schémas de defs/ — une réf de code cite un FICHIER et un SYMBOLE, jamais un numéro de ligne', () => {
  const LINE_REF = /[\w./-]*\.ts:\d+(?:-\d+)?/g;

  /** Intervalles [début, fin) des commentaires (bloc et ligne) — les chaînes en sont exclues. */
  const commentRanges = (src: string): Array<[number, number]> => {
    const out: Array<[number, number]> = [];
    let i = 0, start = 0, inBlock = false, inLine = false, inStr: string | null = null;
    while (i < src.length) {
      const c = src[i], d = src[i + 1];
      if (inBlock) { if (c === '*' && d === '/') { out.push([start, i + 2]); inBlock = false; i += 2; continue; } i++; continue; }
      if (inLine) { if (c === '\n') { out.push([start, i]); inLine = false; } i++; continue; }
      if (inStr) { if (c === '\\') { i += 2; continue; } if (c === inStr) inStr = null; i++; continue; }
      if (c === '/' && d === '*') { inBlock = true; start = i; i += 2; continue; }
      if (c === '/' && d === '/') { inLine = true; start = i; i += 2; continue; }
      if (c === '"' || c === "'" || c === '`') { inStr = c; i++; continue; }
      i++;
    }
    if (inLine) out.push([start, src.length]);
    return out;
  };

  it('aucun commentaire de src/data/schemas/defs/**.ts ne porte de réf `fichier.ts:N` (tolérance ZÉRO)', () => {
    const offenders: string[] = [];
    for (const { rel, text } of readCorpus(['src/data/schemas/defs'], { exts: ['.ts'], tests: true })) {
      const ranges = commentRanges(text);
      for (const m of text.matchAll(LINE_REF)) {
        if (!ranges.some(([a, b]) => m.index >= a && m.index < b)) continue;
        offenders.push(`${rel}:${text.slice(0, m.index).split('\n').length} → ${m[0]}`);
      }
    }
    expect(
      offenders,
      `Réf(s) de code ancrées sur un numéro de ligne — le numéro dérive au premier commit voisin et la réf ment.\n`
        + `Citer le FICHIER et le SYMBOLE (\`src/engine/types.ts\` + le nom de l'interface), jamais \`:N\` :\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});
