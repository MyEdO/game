/**
 * Garde-fou INVARIANT (multilangue) : les champs de référence migrés ne contiennent QUE des refs
 * STRUCTURÉES (par id), jamais de libellé brut, et les ids de catalogue résolvent. Toute régression
 * (un libellé qui se faufile, un id fantôme) casse ici. Cf. `CLAUDE.md` § Pour TOUT agent.
 */
import { describe, it, expect } from 'vitest';
import {
  trappings, qualities, spells, creatures, classes, careers, careerLevels, species, gods, etats, maladies, weaponGroups,
  traits, stars, talents, maneuvers, skills, domains, crewRoles, groups, raceAppearance,
  byId, findTalentById, findTrappingById, findQualityById, findSpellById, findSeaShantyById,
  findCareerById, findClassById, findSpeciesById, findConditionById, findDiseaseById, findWeaponGroupById, findSymptomById,
  findCreatureById, findVehicleById, refEntiteResolue, findGroupById, findPsychologyById, findTraitById, findCrewTestTypeById, findLightToneById,
  mutationTables,
  specLabel, refLabel, specEntryId, specEntryLabel, specResolves, SPEC_SOURCES, type SpecsSource, type SpecEntry, books,
} from './index';
import { avancement } from './schemas/grammaire/avancement';
import { itemFromTrappingById } from '../engine/items';
import { COND } from '../engine/conditions';
import { DISEASES } from '../engine/disease';
import { effectTables } from './effectTables';
import { findLieuServiceById } from './index';
import { SERVICE_CITE } from '../state/worldMap';
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
  GAMEOP_FIELD_TARGETS, auditFieldCoverage, collectJsonFiles, scanGameOpRefs, formatOffender,
} from '../../scripts/guards/lib/gameOpRefFk.mjs';
import { extractedBooks, frenchSourceDirs, isSentinel, sourceDirOf, walkSkillRefs } from '../../scripts/data/lib/skillSpecWalk.mjs';

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x != null;

/** Les DEUX racines authiorées, pour les filets qui doivent être EXHAUSTIFS par construction plutôt
 *  que par liste de datasets (une liste se périme en silence).
 *
 *  PÉRIMÈTRE — ce sont les documents **JSON** des deux racines, et EUX SEULS. Les scènes écrites en
 *  TypeScript (`src/scenes/test-scenarios/*.ts` — `opera.ts`, `piege-caveau.ts`…) n'y entrent pas :
 *  leurs références ne sont couvertes que par `tsc`, via le TYPAGE des slots (`FlowTest.skill`,
 *  payloads d'op). Une graphie plate y serait rouge au typecheck, jamais ici. */
const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const DOCUMENTS_AUTHORES = [
  ...collectJsonFiles(fileURLToPath(new URL('.', import.meta.url)), REPO_ROOT),
  ...collectJsonFiles(fileURLToPath(new URL('../scenes', import.meta.url)), REPO_ROOT),
].map((s) => s.data);

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

  it('creatures : spells (Ref) résolvent ; skills/talents/optionals/trappings structurés (zéro chaîne)', () => {
    for (const c of creatures) {
      for (const s of c.spells) { expect(isObj(s)).toBe(true); expect(findSpellById(s.id)).toBeTruthy(); }
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

  it('gods.blessings/miracles = Ref[] {id} de sort qui résout', () => {
    for (const g of gods) for (const r of [...g.blessings, ...g.miracles]) expect(findSpellById(r.id)).toBeTruthy();
  });

  it('species/careerLevels skills+talents = AdvancementRef[] structuré ; characteristics = CharKey', () => {
    const advLists = [
      ...species.flatMap((s) => [s.skills, s.talents]),
      ...careerLevels.flatMap((l) => [l.skills, l.talents]),
    ];
    for (const list of advLists) for (const a of list) expect(isObj(a)).toBe(true);
    for (const l of careerLevels) for (const k of l.characteristics) expect(CHAR_KEYS as readonly string[]).toContain(k);
  });

  it('chaque service de lieu que le code cite par id (`SERVICE_CITE`) existe au catalogue (#1906)', () => {
    expect(Object.values(SERVICE_CITE).filter((id) => !findLieuServiceById(id))).toEqual([]);
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

  it('ops grantTalent → { talentId } qui résout (jamais un libellé « talent »)', () => {
    walk(opDatasets, (o) => {
      if (o.op !== 'grantTalent') return;
      expect('talent' in o, `grantTalent legacy { talent } résiduel : ${JSON.stringify(o)}`).toBe(false);
      expect(typeof o.talentId, JSON.stringify(o)).toBe('string');
      expect(findTalentById(o.talentId as string), String(o.talentId)).toBeTruthy();
    });
  });

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

  // FILET SUR LE WALK, jamais sur `talents.passive` seul : `gameOpRefFk.mjs` est AVEUGLE aux réfs
  // OBJET (angle mort déclaré :23-33), donc ce test EST la couverture des `skill.id` d'op. Une op de
  // cette liste posée demain dans `traits.json`/`creatures.json`/un Flow de sort tombe ici.
  // LISTE DÉRIVÉE de l'union `GameOp` : toute op dont le payload porte un slot `skill`.
  const OPS_A_REF_DE_COMPETENCE = ['grantCareerSkill', 'skillMod', 'skillDRBonus', 'grantReverseToken', 'castPenalty', 'corruptionExposure'];
  // Les ops dont la référence est OBLIGATOIRE (les autres admettent l'absence : `skillDRBonus` ancré
  // sur un `testType` naval, `castPenalty` sur TOUTE magie, `grantReverseToken` sur tout Test).
  const REF_DE_COMPETENCE_REQUISE = new Set(['grantCareerSkill', 'skillMod']);

  /** VERDICT PUR du filet, sur un corpus quelconque : la liste des graphies fautives rencontrées.
   *  L'extraire permet de MESURER que le filet mord (contrôle positif ci-dessous) au lieu de le
   *  croire sur un vert. */
  const echecsDeRefDeCompetence = (corpus: unknown): string[] => {
    const echecs: string[] = [];
    walk(corpus, (o) => {
      if (typeof o.op !== 'string' || !OPS_A_REF_DE_COMPETENCE.includes(o.op)) return;
      if (o.skill == null) {
        if (REF_DE_COMPETENCE_REQUISE.has(o.op)) echecs.push(`${o.op} sans référence de Compétence : ${JSON.stringify(o)}`);
        return;
      }
      if (!isObj(o.skill)) { echecs.push(`${o.op} sans réf emboîtée { skill: { id } } : ${JSON.stringify(o)}`); return; }
      if (o.spec !== undefined) echecs.push(`${o.op} : « spec » FRÈRE de « skill » — la spécialisation vit DANS la référence : ${JSON.stringify(o)}`);
      if (!byId('skill', (o.skill as { id: string }).id)) echecs.push(`${o.op} : id de Compétence qui ne résout pas : ${JSON.stringify(o)}`);
    });
    return echecs;
  };

  it('ops à référence de Compétence (grantCareerSkill, skillMod, skillDRBonus, grantReverseToken, castPenalty, corruptionExposure) = `skill: { id, spec? }` qui résout', () => {
    // PÉRIMÈTRE EXHAUSTIF PAR CONSTRUCTION (`DOCUMENTS_AUTHORES`), jamais une liste de datasets : ces
    // ops vivent aussi bien dans `traumas`/`trappings`/`tables`/`miscast`/`activities`/`drunkenness`/
    // `mutations`/`naval-traits`/`sea-shanties` que dans les entités, et une liste se périme en
    // silence — MESURÉ : la graphie plate remise dans `traumas.json` passait sous un walk listé.
    expect(echecsDeRefDeCompetence(DOCUMENTS_AUTHORES)).toEqual([]);
  });

  it('CONTRÔLE POSITIF — le filet MORD sur les deux graphies mortes (mutation EN MÉMOIRE, jamais au disque)', () => {
    const corpus = DOCUMENTS_AUTHORES;
    // Le corpus AU REPOS est propre : sans ça, les deux mesures ci-dessous ne prouveraient rien.
    expect(echecsDeRefDeCompetence(corpus)).toEqual([]);

    // (a) réf remise À PLAT (`skill: "corps-a-corps"`) — la régression mesurée sur `traumas.json`.
    const aPlat = JSON.parse(JSON.stringify(corpus)) as unknown;
    let mutesAPlat = 0;
    walk(aPlat, (o) => {
      if (typeof o.op !== 'string' || !OPS_A_REF_DE_COMPETENCE.includes(o.op) || !isObj(o.skill)) return;
      const r = o.skill as { id: string; spec?: string };
      if (r.spec != null) o.spec = r.spec;
      o.skill = r.id;
      mutesAPlat++;
    });
    expect(mutesAPlat, 'aucune réf à muter — le contrôle ne mesurerait rien').toBeGreaterThan(0);
    expect(echecsDeRefDeCompetence(aPlat).length).toBe(mutesAPlat);
    expect(echecsDeRefDeCompetence(aPlat)[0]).toContain('sans réf emboîtée');

    // (b) `spec` remise en FRÈRE de `skill` — une seule occurrence suffit à faire rougir.
    const specFrere = JSON.parse(JSON.stringify(corpus)) as unknown;
    let pose = false;
    walk(specFrere, (o) => {
      if (pose || typeof o.op !== 'string' || !OPS_A_REF_DE_COMPETENCE.includes(o.op) || !isObj(o.skill)) return;
      o.spec = 'bagarre';
      pose = true;
    });
    expect(pose).toBe(true);
    const echecs = echecsDeRefDeCompetence(specFrere);
    expect(echecs).toHaveLength(1);
    expect(echecs[0]).toContain('« spec » FRÈRE');
  });

  it('ops grantCareerTalent (→ carrière) = réf par id qui résout (jamais un libellé)', () => {
    walk([...opDatasets, ...talents], (o) => {
      if (o.op === 'grantCareerTalent') expect(findTalentById(o.talentId as string), JSON.stringify(o)).toBeTruthy();
    });
  });

  // ── Spine des Tests : aucune compétence résolue par LIBELLÉ (multilangue) ──
  // Un Test déclenché authoré est désormais un nœud de STRUCTURE Flow (`{kind:'test', test:FlowTest}`) ;
  // ses Compétences (côté défenseur `test.skill`, côté attaquant OPPOSÉ `test.opposed.attackerSkill`)
  // sont des skillId stables. L'op `test` SUBSISTE pour les tables d'Imparfaites/Colère (miscast, code).
  // Les ops `test`/`skillMod`/`skillDRBonus` portent aussi un skillId. Tous doivent RÉSOUDRE.
  it('FlowTest.skill / FlowTest.opposed.attackerSkill / ops test·skillMod·skillDRBonus → skillId qui résout (jamais un libellé)', () => {
    const skillCarrying = [...spells, ...traits, ...maneuvers, ...qualities, ...creatures, ...stars];
    walk(skillCarrying, (o) => {
      // RÉFÉRENCES emboîtées `{ id, spec? }` (le slot `skill` d'un conteneur de Test ou d'une op)…
      const refs: unknown[] = [];
      if ((o.op === 'test' || o.op === 'skillMod' || o.op === 'skillDRBonus') && o.skill != null) refs.push(o.skill);
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
      for (const id of ['bon-marcheur', 'haine', 'maitre-artisan', 'sans-peur', 'savant', 'savoir-vivre', 'travailleur-qualifie', 'vice']) {
        const t = findTalentById(id)!;
        expect(t.specsOpen, id).toBe(true);
        for (const entry of t.specs ?? []) expect(isObj(entry) && typeof (entry as { id: unknown }).id === 'string', `${id} → ${JSON.stringify(entry)}`).toBe(true);
      }
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

  // ── GARDE EXHAUSTIVE (Phase 3 complétude) — remplace TOUTES les gardes par-domaine ci-dessus/passées.
  // Construit AUTOMATIQUEMENT, à partir de skills.json/talents.json eux-mêmes, l'ensemble des ids valides
  // de CHAQUE def à `specs` non vide (`specEntryId` — id inline OU id mirroré d'un `specsSource`) ; parcourt
  // ENSUITE toutes les données (y compris skills.json/talents.json EUX-MÊMES pour les auto-références —
  // passive/test.matches d'un talent vers un AUTRE domaine, ex. Oreille absolue → Divertissement) et les
  // pré-tirés RUNTIME (`makePregens()`, via import). AUCUNE exception silencieuse :
  //  - domaine FERMÉ (`specsOpen` absent/falsy) : toute instance DOIT résoudre à un id connu (ou la
  //    sentinelle « (Au choix) ») ; sinon le test ÉCHOUE. AUCUNE exception nominative.
  //  - domaine OUVERT (`specsOpen:true`) : une instance DOIT être soit un id connu, soit un texte
  //    GENUINEMENT hors catalogue (texte libre toléré) — mais SI son normalisé correspond à un libellé
  //    FR CONNU de sa `specs[]`, c'est une RÉGRESSION de migration (devrait être l'id) → le test ÉCHOUE.
  // Ajouter un domaine à `specs[]` = automatiquement couvert ici ; plus JAMAIS besoin d'étendre une liste.
  describe('GARDE EXHAUSTIVE — toute compétence/talent à specs[] non vide (Phase 3 complétude)', () => {
    const norm = (s: string): string => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
    const isSentinel = (s: string): boolean => norm(s) === 'au choix';

    const ALL_SPEC_DEFS = [...skills, ...talents].filter((d) => d.specsSource || (Array.isArray(d.specs) && d.specs.length > 0));
    const CLOSED = new Map<string, Set<string>>();
    const OPEN = new Map<string, { ids: Set<string>; byLabel: Map<string, string> }>();
    // Def à `specsSource` : la VALIDITÉ d'une spéc = `SPEC_SOURCES[src].resolves(id)` (l'id existe dans le
    // registre sous-jacent), un sur-ensemble du pool joueur `pool()` — un statbloc RAW peut porter une spéc
    // réelle hors du pool choisissable (Triton). Séparé de CLOSED (specs[] inline énuméré).
    const SOURCE_OF = new Map<string, keyof typeof SPEC_SOURCES>();
    for (const def of ALL_SPEC_DEFS) {
      if (def.specsSource) { SOURCE_OF.set(def.id, def.specsSource); continue; }
      const ids = new Set(def.specs!.map((e) => specEntryId(e)));
      if (def.specsOpen) OPEN.set(def.id, { ids, byLabel: new Map(def.specs!.map((e) => [norm(specEntryLabel(e)), specEntryId(e)])) });
      else CLOSED.set(def.id, ids);
    }

    const unresolved: string[] = [];
    function checkSpec(defId: string, spec: unknown, where: string): void {
      if (typeof spec !== 'string' || isSentinel(spec)) return;
      const source = SOURCE_OF.get(defId);
      if (source) {
        // VALIDITÉ = l'id résout dans le REGISTRE de la source (⊇ pool joueur) : couvre les statblocs RAW hors
        // pool (le Triton FOCALISE « magie-des-mers-de-triton », un domaine RÉEL non choisissable par un PC).
        // Data-driven, plus aucune exception au cas par cas.
        if (SPEC_SOURCES[source].resolves(spec)) return;
        unresolved.push(`${where} : ${defId} → ${JSON.stringify(spec)} (specsSource ${source}, id inconnu du registre)`);
        return;
      }
      const closedIds = CLOSED.get(defId);
      if (closedIds) {
        if (closedIds.has(spec)) return;
        unresolved.push(`${where} : ${defId} → ${JSON.stringify(spec)} (FERMÉ, id inconnu de specs[])`);
        return;
      }
      const open = OPEN.get(defId);
      if (open) {
        if (open.ids.has(spec)) return; // déjà un id
        const knownId = open.byLabel.get(norm(spec));
        if (knownId) unresolved.push(`${where} : ${defId} → ${JSON.stringify(spec)} (OUVERT, libellé FR CONNU non migré — devrait être « ${knownId} »)`);
        // sinon texte libre GENUINEMENT hors catalogue — toléré (domaine OUVERT).
      }
    }
    function walk(node: unknown, where: string): void {
      if (Array.isArray(node)) { node.forEach((x) => walk(x, where)); return; }
      if (!isObj(node)) return;
      const idLike = (node.id ?? node.skillId ?? node.talentId ?? node.skill) as string | undefined;
      if (typeof idLike === 'string') {
        if (isObj(node.spec)) { for (const [k, v] of Object.entries(node.spec)) checkSpec(k, v, `${where}.spec{${k}}`); }
        else checkSpec(idLike, node.spec, where);
      }
      const wcId = (node.wildcard as { id?: string } | undefined)?.id;
      if (wcId && Array.isArray(node.specOptions)) for (const so of node.specOptions as unknown[]) checkSpec(wcId, so, `${where}.wildcard{${wcId}}.specOptions`);
      for (const v of Object.values(node)) walk(v, where);
    }

    it('creatures/careerLevels/species/stars/traits/trappings/talents/skills/crewRoles/tavernGames/seaWeather/pregens(runtime) : toute spec resout (fermé) ou id/texte-libre valide (ouvert)', () => {
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
      expect(unresolved, unresolved.join('\n')).toEqual([]);
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
/** Une spéc RENCONTRÉE qui ne résout pas, nommée par sa clé stable `fichier|porteur|refId|spec`.
 *  `catalogue` = la def PORTE un catalogue de spécs (`specs[]` non vide ou `specsSource`). */
type SpecHors = { where: string; key: string; book: string; refId: string; spec: string; catalogue: boolean };

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
        hors.push({ where: `${file}(${owner})`, key: `${file}|${owner}|${node.id}|${node.spec}`, book, refId: node.id, spec: node.spec, catalogue });
      }, arrName);
    }
  }
  return { hors, nues, seen, sentinelles };
}

describe('spec de Compétence d’un livre EXTRAIT — résout au catalogue (#1342 L2-a)', () => {
  const ROOT = fileURLToPath(new URL('../../', import.meta.url));
  const { extraits: EXTRAITS, dirManquant } = extractedBooks(books, ROOT);
  const { hors, nues, seen } = collecteSpecs('skills', (id) => byId('skill', id));

  // Le stock « la ligne imprime un CHOIX, pas une spéc » (6 clés : « Artisanat (Armurier OU
  // Forgeron) », « Savoir (Rivières_ou_Chemins) » ×2, « Savoir (Divinité) » ×3) est ÉTEINT au commit
  // 4bis de L2 #1548 : ces lignes portent désormais `choix: [ids]`, que la marche ci-dessus rend au
  // régime `choix` (ligne 721) et ne confronte plus au catalogue en tant que spéc.

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

// ── CONTRAT POSITIF (#1457 B1) — `talents[].spec` d'une entrée SOURCÉE d'un livre EXTRAIT : la spéc
// RÉSOUT au catalogue du Talent, ou elle est NOMMÉE au stock ci-dessous. Les listes de spécialisation
// des Talents concernés sont OUVERTES au RAW (`LDB 10 l.117`, `LDB 10 l.1071`) : le geste juste est de
// CRÉER l'entrée `talents.json#specs[]` avec sa `source` (patron `savoir-vivre›mercenaires`,
// `AA 04 l.119`), jamais de mapper une valeur imprimée vers un id voisin. Ce lot pose l'INSTRUMENT :
// les créations d'entrées se font aux lots B2 (livres officiels) et B3 (frenchy-bzh).
describe('spec de Talent d’un livre EXTRAIT — résout au catalogue, stock nominatif DÉCROISSANT (#1457 B1)', () => {
  const ROOT = fileURLToPath(new URL('../../', import.meta.url));
  const { extraits: EXTRAITS } = extractedBooks(books, ROOT);
  const { hors, seen, sentinelles } = collecteSpecs('talents', (id) => findTalentById(id));
  const dette = hors.filter((h) => h.catalogue);
  const textesDInstance = hors.filter((h) => !h.catalogue);

  /** STOCK NOMINATIF DÉCROISSANT — mesure du 2026-09-01 (après B3) : 5 spécs de Talent à créer au
   *  catalogue, clé `fichier|porteur|talentId|spec`. Par Talent : bon-marcheur 5 ; par livre :
   *  frenchy-bzh 5 — les livres OFFICIELS y sont à ZÉRO. Une clé se RETIRE quand sa spéc résout.
   *
   *  CE QUI RESTE, ET POURQUOI : les 5 lignes impriment un CHOIX BORNÉ entre deux terrains, pas une
   *  spéc — « Arpenteur (Plaine_OU_Forêt) » (`frenchy.bzh 26 l.366`, `l.413`) et « Arpenteur
   *  (Forêt_ou_Plaine) » (`l.686`, `l.950`, `l.1008`), toutes cinq décrites « Bonus +N DR pour les
   *  Tests d'Athlétisme réussis dans l'environnement CHOISI ». La forme canonique du dépôt pour ce
   *  cas est `choix: [ids]` (L2 #1548) ; `talentRefSchema` (`schemas/grammaire/reference.ts`) n'a
   *  pas ce régime, concept LOTÉ L3 #1463 (`schemas/defs-scenes/narratif.ts` l.127-133). La
   *  sentinelle libre « au choix » les éteindrait en perdant la BORNE imprimée : elles restent ici.
   *
   *  ANGLE MORT ÉNONCÉ (mesure du 2026-09-01, #1646) — le contrat ne walke que les TABLEAUX
   *  `talents[]` de `creatures`/`careerLevels`/`species` (`walkSkillRefs`), seuls fichiers qui en
   *  portent (221 / 172 / 40 spécs relevées). Une réf de Talent spécialisée par un AUTRE champ
   *  échappe à l'instrument : 18 porteurs `{ talentId, spec }` mesurés hors de ces tableaux —
   *  `spells.json` 6, `mutations.json` 5, `traits.json` 4, `stars.json` 2, `axes.json` 1. Les deux
   *  de la MÊME classe que le stock ci-dessus (`traits.json:2051` `savoir-vivre|disciples-de-tzeentch`
   *  et `traits.json:2692` `savoir-vivre|suivants-de-khorne`) sont SOLDÉS par B3 : leurs entrées
   *  sont au catalogue, sourcées à la desc verbatim de leur Trait (`EDOC 13 l.524` folio 83,
   *  `MDG 07 l.250` folio 56). Reste un cas de la classe du texte d'instance (Talent SANS catalogue,
   *  #1621) : `mutations.json:1619` `attirant|Mutants et hommes-bêtes`. */
  const SPECS_DE_TALENT_A_CREER = new Set<string>([
    'creatures|haut-druide-de-la-foi-antique|bon-marcheur|ForêtouPlaine',
    'creatures|haut-pretre-rodeur-de-taal|bon-marcheur|ForêtouPlaine',
    'creatures|maitre-des-taillis|bon-marcheur|PlaineOUForêt',
    'creatures|pretre-rodeur-de-taal|bon-marcheur|ForêtouPlaine',
    'creatures|rebouteux|bon-marcheur|PlaineOUForêt',
  ]);

  it('creatures/careerLevels/species : zéro spec de Talent hors catalogue sous un livre extrait, hors stock nominatif', () => {
    // NON-VACUITÉ : sans lignes scannées ni extraction sur disque, le contrat serait vert à vide.
    expect(seen).toBeGreaterThan(300);
    expect(EXTRAITS.size).toBeGreaterThan(10);
    const bad = dette
      .filter((h) => EXTRAITS.has(h.book) && !SPECS_DE_TALENT_A_CREER.has(h.key))
      .map((h) => `${h.where} [${h.book}] : ${h.refId} → ${JSON.stringify(h.spec)} — clé ${h.key}`);
    expect(bad, `spec de Talent qui ne résout pas et qui n'est pas au stock — créer l'entrée sourcée dans talents.json#specs[] :\n${bad.join('\n')}`).toEqual([]);
  });

  it('le stock DÉCROÎT : une clé dont la spéc RÉSOUT (ou dont le porteur a disparu) est retirée', () => {
    const vues = new Set(hors.map((h) => h.key));
    const perimes = [...SPECS_DE_TALENT_A_CREER].filter((k) => !vues.has(k));
    expect(perimes, `clé(s) du stock sans instance non résolue — RETIRER du stock :\n${perimes.join('\n')}`).toEqual([]);
  });

  it('un Talent SANS catalogue de spécs (destinee, frenesie) porte un TEXTE d’instance : compté à part, jamais au stock de dette (#1621)', () => {
    const PLAFOND = 24;
    const parTalent = [...textesDInstance.reduce((m, h) => m.set(h.refId, (m.get(h.refId) ?? 0) + 1), new Map<string, number>())]
      .sort((a, b) => b[1] - a[1]).map(([id, n]) => `${id}:${n}`).join(', ');
    // Cliquet UNIDIRECTIONNEL : PLAFOND, pas stock nominatif. Une 25e instance rougit (#1621) ; une
    // chute de 24 vers 1 reste verte — le régime du champ texte d'instance se tranche à #1621.
    expect(textesDInstance.length).toBeGreaterThan(0);
    expect(textesDInstance.length, `${parTalent} — un texte d'instance de PLUS : le régime du champ se tranche à #1621`).toBeLessThanOrEqual(PLAFOND);
    const melanges = textesDInstance.filter((h) => SPECS_DE_TALENT_A_CREER.has(h.key)).map((h) => h.key);
    expect(melanges, `texte d'instance stocké comme dette de spec :\n${melanges.join('\n')}`).toEqual([]);
  });

  it('les sentinelles « Au choix » de talents[] sont ÉCARTÉES de la résolution mais COMPTÉES et BORNÉES (#1621)', () => {
    const PLAFOND = 12;
    // Même lecture que le PLAFOND des textes d'instance ci-dessus : cliquet UNIDIRECTIONNEL, pas
    // stock nominatif. La sentinelle est un EMPLACEMENT de spéc, pas une spéc : elle ne peut pas
    // résoudre au catalogue, donc `collecteSpecs` la saute avant `seen++` — sans ce compte, elle
    // sortait de la mesure sans laisser de trace. Le régime `choix` des réfs de Talent (qui les
    // éteindra en portant la borne imprimée) se tranche à #1621 ; d'ici là, une 13e rougit.
    const parTalent = [...sentinelles.reduce((m, k) => m.set(k.split('|')[2], (m.get(k.split('|')[2]) ?? 0) + 1), new Map<string, number>())]
      .sort((a, b) => b[1] - a[1]).map(([id, n]) => `${id}:${n}`).join(', ');
    expect(sentinelles.length).toBeGreaterThan(0);
    expect(
      sentinelles.length,
      `${parTalent} — une sentinelle « Au choix » de PLUS sur un talents[] : poser la spéc imprimée, ou trancher le régime choix (#1621) :\n${sentinelles.join('\n')}`,
    ).toBeLessThanOrEqual(PLAFOND);
  });

  it('CONTRÔLE POSITIF — une spec de Talent inconnue posée sur une créature FIXTURE est ATTRAPÉE (mutation EN MÉMOIRE, jamais au disque)', () => {
    const fixture = { id: 'fixture-1457-b1', source: { book: 'frenchy-bzh' }, talents: [{ id: 'savoir-vivre', spec: 'Vagabonds fantômes' }] };
    const corpus = [['creatures', [fixture]]] as unknown as [string, { id?: string; label?: string; source?: { book?: string } }[]][];
    const { hors: mordu } = collecteSpecs('talents', (id) => findTalentById(id), corpus);
    expect(mordu.map((h) => h.key)).toEqual(['creatures|fixture-1457-b1|savoir-vivre|Vagabonds fantômes']);
    expect(mordu[0].catalogue, 'savoir-vivre PORTE un catalogue de spécs : la fixture mesure bien une DETTE de spec').toBe(true);
    expect(SPECS_DE_TALENT_A_CREER.has(mordu[0].key)).toBe(false);
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
  const ENTITY_KINDS = new Set(['heroStart', 'personnage', 'prop']);
  function sweep(node: unknown, where: string, out: string[]): void {
    if (Array.isArray(node)) { node.forEach((x, i) => sweep(x, `${where}[${i}]`, out)); return; }
    if (!isObj(node)) return;
    if (typeof node.kind === 'string' && ENTITY_KINDS.has(node.kind) && isObj(node.pos)) {
      const who = `${where}(${node.id ?? node.label ?? node.kind})`;
      if (node.kind === 'personnage' && typeof node.ref === 'string' && !refEntiteResolue(node.ref))
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
// champs d'op portent une référence) est DÉRIVÉ de l'union `GameOp` par le TypeChecker, la CIBLE de
// chaque champ est déclarée dans `scripts/guards/lib/gameOpRefFk.mjs` — dont l'en-tête écrit ce que
// la garde ne voit pas. Les registres sont câblés ICI, où ils sont typés.
describe('GameOp — toute référence de la donnée committée résout dans son registre (#847)', () => {
  const DATA_DIR = fileURLToPath(new URL('.', import.meta.url));
  const SCENES_DIR = fileURLToPath(new URL('../scenes', import.meta.url));

  const MUTATION_TABLE_IDS = new Set(mutationTables.map((t) => t.id));
  const EFFECT_TABLE_IDS = new Set(effectTables.map((t) => t.id));
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
    effectTables: (id) => EFFECT_TABLE_IDS.has(id),
    terrains: (id) => terrainEntree(id) !== undefined,
    lightTones: (id) => !!findLightToneById(id),
  };

  const sources = [...collectJsonFiles(DATA_DIR, REPO_ROOT), ...collectJsonFiles(SCENES_DIR, REPO_ROOT)];
  const scan = scanGameOpRefs({ sources, resolvers });

  it('le périmètre est DÉRIVÉ de l’union GameOp : aucun champ de référence sans cible déclarée', () => {
    const { derived, unclassified, stale } = auditFieldCoverage(REPO_ROOT);
    expect(derived.length, 'aucun champ dérivé — l’extraction du type a échoué').toBeGreaterThan(40);
    expect(unclassified, `champs de GameOp sans cible déclarée (gameOpRefFk.mjs) :\n${unclassified.join('\n')}`).toEqual([]);
    expect(stale, `cibles déclarées sans champ correspondant dans GameOp :\n${stale.join('\n')}`).toEqual([]);
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
  // `{ registry, self? }` | `{ nonRef }` | `{ coveredBy }`. Une clé hors de cet ensemble serait lue par
  // PERSONNE dans `scanGameOpRefs` — donc une tolérance muette, ou un champ tenu pour gardé sans l'être.
  it('le format d’une cible est fermé : aucune clé hors registry/self/nonRef/coveredBy', () => {
    const CLES = new Set(['registry', 'self', 'nonRef', 'coveredBy']);
    const anomalies: string[] = [];
    for (const [cible, decl] of Object.entries(GAMEOP_FIELD_TARGETS as Record<string, Record<string, unknown>>)) {
      for (const cle of Object.keys(decl)) {
        if (!CLES.has(cle)) anomalies.push(`${cible} : clé « ${cle} » hors du format fermé`);
      }
      const formes = ['registry', 'nonRef', 'coveredBy'].filter((k) => k in decl);
      if (formes.length !== 1) {
        anomalies.push(`${cible} : ${formes.length} forme(s) déclarée(s) [${formes.join(', ')}] — il en faut une et une seule`);
      }
      if ('self' in decl) {
        if (decl.self !== true) anomalies.push(`${cible} : « self » vaut ${JSON.stringify(decl.self)} au lieu de true`);
        if (!('registry' in decl)) anomalies.push(`${cible} : « self » sans « registry » — le mot réservé ne se tolère que sur une référence dure`);
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
      data: [{ effects: [{ flow: { effect: { ops: [{ op: 'grantTalent', talentId: 'sans-peur' }] } } }] }],
    }];
    expect(scanGameOpRefs({ sources: fixture, resolvers }).offenders).toEqual([]);
    const phantom = [{
      file: 'fixture.json',
      data: [{ effects: [{ flow: { effect: { ops: [{ op: 'grantTalent', talentId: 'sans-peur-fantome' }] } } }] }],
    }];
    const out = scanGameOpRefs({ sources: phantom, resolvers }).offenders;
    expect(out).toHaveLength(1);
    expect(out[0].registry).toBe('talents');
    expect(out[0].path).toBe('fixture.json[0].effects[0].flow.effect.ops[0].talentId');
  });

  it('le vocabulaire toléré reste vert — $arg, self, et les marqueurs narratifs déclarés', () => {
    const legit = [{
      file: 'fixture.json',
      data: [
        { op: 'exposeDisease', disease: '$arg' },
        { op: 'scheduleRespawn', ref: 'self', delayDays: 1 },
        { op: 'condition', id: 'petrifie' },
      ],
    }];
    expect(scanGameOpRefs({ sources: legit, resolvers }).offenders.map(formatOffender)).toEqual([]);
    // Le mot réservé `self` n'est toléré QUE sur le champ qui le déclare.
    const misplaced = [{ file: 'fixture.json', data: [{ op: 'summon', ref: 'self', count: 1 }] }];
    expect(scanGameOpRefs({ sources: misplaced, resolvers }).offenders).toHaveLength(1);
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
