/**
 * Garde-fou INVARIANT (multilangue) : les champs de référence migrés ne contiennent QUE des refs
 * STRUCTURÉES (par id), jamais de libellé brut. Un id fantôme d'un document se refuse au PARSE de son
 * schéma (`idDe`, `grammaire/ref.ts`) ; restent ici ce que le parse ne voit pas — constantes de code,
 * runtime, stocks nommés. Cf. `AGENTS.md` § Pour TOUT agent.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { ecartsDeStock, cleDeSite, sitesEnEntrees, type EntreeDeSite } from '../../scripts/guards/lib/stock.mjs';
import { COMPETENCES_NUES, TALENTS_TEXTES, TALENTS_SENTINELLES, DOTATIONS_TEXTES } from '../../scripts/guards/lib/integriteStock.mjs';
import {
  creatures, careerLevels, species, gods, etats, maladies, weaponGroups,
  talents, skills, domains,
  byId, findTalentById, findTrappingById, findSeaShantyById,
  findWeaponGroupById, findGroupById, findCrewTestTypeById,
  specLabel, refLabel, specEntryId, specEntryLabel, SPEC_SOURCES, type SpecsSource, type SpecEntry, books,
} from './index';
import { gameOpSchema } from './schemas/grammaire/mecanique';
import type { SchemaDef } from './schemas/types';
import { catalogueSpecs, entreeOuverte, mesureDuParse, refusDeSpec, specAuCatalogue } from './schemas/grammaire/ref';
import { IDS_PAR_ESPACE } from './schemas/_ids.generated';
import { itemFromTrappingById } from '../engine/items';
import { MANANN_FACTORS } from '../engine/seaVoyage';
import { pretires } from './pregens';
import areneProject from '../scenes/arene/arene-projet.json';
import loupProject from '../scenes/loup-et-saumure/loup-et-saumure-projet.json';
import { SCENARIOS } from '../scenes/test-scenarios/_registry.generated';
import { CHAR_KEYS } from '../engine/types';
import { fileURLToPath } from 'node:url';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';
import { fauteDEspece } from './schemas/grammaire/valeurs';
import { GAMEOP_FIELD_TARGETS, auditFieldCoverage, scanGameOpRefs, formatOffender } from '../../scripts/guards/lib/gameOpRefFk.mjs';
import { champsDOpASlot, opsDuParse, slotsDOpNonJuges, slotsDuParse } from '../../scripts/docs/lib/slots-registre.mjs';
import { scanDuCorpus, listerDocuments } from '../../scripts/docs/lib/structures-scan.mjs';
import { extractedBooks, frenchSourceDirs, isSentinel, walkSkillRefs } from '../../scripts/data/lib/skillSpecWalk.mjs';
import { norm } from '../lib/normalize';

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x != null;

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));

/** Le corpus des DEUX racines (`scanDuCorpus`), lu UNE fois pour tout le fichier. */
const CORPUS_SCANNE = scanDuCorpus(REPO_ROOT);

describe('refs migrées — refs structurées par id, zéro libellé résiduel', () => {
  it('weaponGroups portent un id stable + kind valide', () => {
    const kinds = new Set(['weapon', 'ammo', 'armour', 'inventory']);
    for (const g of weaponGroups) { expect(typeof g.id).toBe('string'); expect(kinds.has(g.kind), g.kind).toBe(true); }
  });

  it('itemFromTrappingById pose un trappingId qui pointe le catalogue', () => {
    for (const id of ['arbalete', 'epee-batarde', 'chemise-de-mailles', 'mains-nues']) {
      const it = itemFromTrappingById(id, idsDeTest);
      expect(it, id).toBeTruthy();
      expect(it!.trappingId).toBe(id);
    }
  });

  it('creatures : skills/talents/optionals structurés (zéro chaîne)', () => {
    for (const c of creatures) {
      for (const sk of c.skills) expect(isObj(sk) && typeof sk.id === 'string').toBe(true);
      for (const t of c.talents) expect(isObj(t) && typeof t.id === 'string').toBe(true);
      for (const o of c.optionals) expect(isObj(o)).toBe(true); // OptionalEntry : TraitInstance OU note composée (#174)
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

  it('etats et maladies portent un id', () => {
    for (const e of etats) expect(typeof e.id).toBe('string');
    for (const m of maladies) expect(typeof m.id).toBe('string');
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
      if (!specAuCatalogue(p.cat === 'skills' ? 'skill' : 'talent', p.def, p.id)) { nonResolus.push(`${p.cat}:${p.def} → ${p.id}`); continue; }
      const vu = vues.get(`${p.cat}|${p.def}`) ?? new Set<string>();
      if (!vu.has(p.id)) absents.push(`${p.cat}:${p.def} → ${p.id} (paire FOSSILE : plus aucune référence)`);
      if (vu.has(p.imprime)) morts.push(`${p.cat}:${p.def} → ${JSON.stringify(p.imprime)} (graphie d’origine SURVIVANTE)`);
    }
    expect(nonResolus, nonResolus.join('\n')).toEqual([]);
    expect(absents, absents.join('\n')).toEqual([]);
    expect(morts, morts.join('\n')).toEqual([]);
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
        ['talents', 'sans-peur', 'groupesDAppartenance', (id) => !!findGroupById(id) && !findGroupById(id)!.relatif],
        ['talents', 'haine', 'ciblesPsy', (id) => !!findGroupById(id)],
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
      for (const id of ['bon-marcheur', 'maitre-artisan', 'savant', 'savoir-vivre', 'travailleur-qualifie', 'vice']) {
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
      expect(specLabel('skills', 'savoir', 'Plombiers du Reik')).toBe('Plombiers du Reik');
      expect(refLabel('skills', { id: 'savoir', spec: 'Plombiers du Reik' })).toBe('Savoir (Plombiers du Reik)');
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
  // sur tout document registré de `src/data` et `src/scenes` (`schema-contract.test.ts`), libellé FR connu
  // d'une entrée OUVERTE (`entreeOuverte`) compris. Restent ici les pré-tirés RUNTIME (`pretires(idsDeTest)`),
  // composés en mémoire, jamais parsés par un schéma.
  describe('GARDE — pré-tirés runtime', () => {

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

    it('pregens(runtime — pretires) : aucun libellé FR connu sur une entrée OUVERTE', () => {
      walk(pretires(idsDeTest), 'pregens(runtime — pretires)');
      expect(nonMigres, nonMigres.join('\n')).toEqual([]);
    });

    it('pregens(runtime — pretires) : toute spec de Compétence/Talent est ADMISE par son entrée (`refusDeSpec`)', () => {
      const refus: string[] = [];
      for (const h of pretires(idsDeTest)) {
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

// ── OBSERVATIONS NOMMÉES des `skills[]`/`talents[]` de statbloc, de Carrière et d'espèce : l'ADMISSION
// d'une spéc se juge au parse (`refusDeSpec`, par la fabrique de chaque porteur) ; restent ici les stocks
// que la fabrique admet sans les solder. Le périmètre et la marche viennent du module PARTAGÉ avec la
// migration (`scripts/data/lib/skillSpecWalk.mjs`) : une garde qui remarcherait la donnée à sa façon
// mesurerait autre chose que le geste qu'elle garde.
/** Un texte d'instance de Talent (`nonSpecialisable`, #1621), nommé par sa clé stable `fichier|porteur|refId|spec`. */
type TexteDInstance = { key: string; site: EntreeDeSite };

const empreinteIntegrite = (texte: string): string => createHash('sha256').update(texte).digest('hex');
const siteIntegrite = (famille: string, fichier: string, owner: string, champ: string, id = '', texte = '') => ({ famille, file: fichier, ref: JSON.stringify([owner, champ, id, texte ? empreinteIntegrite(texte) : '']) });
const fichiersDeSpecs = new Map(listerDocuments(REPO_ROOT).map((d) => [d.nom, d.chemin]));
function ecartIntegrite(observe: EntreeDeSite[], stock: readonly EntreeDeSite[], observation = false): void {
  const normalise = sitesEnEntrees(observe.map((s) => ({ famille: s.famille, file: s.fichier, ref: s.ref })));
  const ecart = ecartsDeStock({ observe: normalise, stock, cle: cleDeSite, remede: {
    neuve: (cle, entree) => entree.famille === 'dotation-texte'
      ? `${cle} — migrer la dotation en référence typée (#622).`
      : entree.famille === 'talent-sentinelle'
        ? `${cle} — poser la spécialisation ou le choix imprimé ; régime de choix à #1621.`
        : `${cle} — corriger la donnée vers sa forme cible : scripts/guards/lib/integriteStock.mjs ne fait que décroître.`,
  } });
  expect(ecart.taille, 'Stock dupliqué : retirer les identités répétées').toBe(stock.length);
  expect(ecart.neuves, `Entrées neuves :\n${ecart.neuves.join('\n')}`).toEqual([]);
  if (observation) {
    if (ecart.perimees.length) console.info(`Observations disparues : retirer de scripts/guards/lib/integriteStock.mjs :\n${ecart.perimees.join('\n')}`);
  } else expect(ecart.perimees, `Entrées soldées : retirer de scripts/guards/lib/integriteStock.mjs :\n${ecart.perimees.join('\n')}`).toEqual([]);
}

describe('intégrité des collections nominatives', () => {
  for (const [nom, famille, observation] of [
    ['competences-nues', 'competence-nue', true],
    ['talents-textes', 'talent-texte', true],
    ['talents-sentinelles', 'talent-sentinelle', false],
    ['dotations-textes', 'dotation-texte', false],
  ] as const) {
    const original = { famille, fichier: 'src/data/fixture.json', ref: JSON.stringify(['proprietaire-fixture', 'champ-fixture', 'reference-fixture', 'empreinte-fixture']), occurrence: 1 };
    const stock = [original];
    it(`${nom} : un échange d'identité à cardinal constant rougit`, () => {
      const observe = [{ ...original, ref: `${original.ref}~mutation` }];
      expect(() => ecartIntegrite(observe, [original], observation)).toThrow(/Entrées neuves/);
    });
    it(`${nom} : la baisse conserve son régime`, () => {
      if (observation) {
        expect(() => ecartIntegrite([], [stock[0]], true)).not.toThrow();
        expect(() => ecartIntegrite([{ ...stock[0], ref: `${stock[0].ref}~mutation` }], [stock[0]], true)).toThrow(/Entrées neuves/);
      }
      else expect(() => ecartIntegrite([], [stock[0]])).toThrow(/Entrées soldées/);
    });
    it(`${nom} : une identité de stock répétée rougit`, () => {
      expect(() => ecartIntegrite([original], [original, original], observation)).toThrow(/Stock dupliqué/);
    });
  }
});

type EntreeDeSpecs = { id?: string; label?: string; source?: { book?: string } };

/** Les ENTRÉES PARTIELLES de `creatures.json` embarquées ailleurs (`entreesPartiellesEmbarquees`,
 *  `scripts/docs/lib/structures-scan.mts`), groupées par document hôte : porteur et provenance = ceux
 *  de leur fiche (plus proche ancêtre portant `id`, resp. `source`). */
const partiellesDeCreatures = (): [string, EntreeDeSpecs[]][] => {
  const parHote = new Map<string, EntreeDeSpecs[]>();
  for (const [objet, fiche] of CORPUS_SCANNE.scan.entreesPartielles) {
    if (fiche.document !== 'creatures.json') continue;
    if (typeof fiche.id !== 'string') throw new Error(`${fiche.hote} : entrée partielle creatures sans id de propriétaire`);
    const entree = { ...(objet as object), id: fiche.id, source: fiche.source as EntreeDeSpecs['source'] };
    parHote.set(fiche.hote, [...(parHote.get(fiche.hote) ?? []), entree]);
  }
  return [...parHote];
};

/**
 * MARCHE PARTAGÉE des observations — Compétences (#1342 L2-a) et Talents (#1457 B1) : même périmètre
 * (`creatures`/`careerLevels`/`species`, et les entrées partielles de `creatures` embarquées ailleurs),
 * MÊME walker (`walkSkillRefs`, paramétré par son tableau porteur) et MÊME prédicat (`refusDeSpec`).
 */
function collecteSpecs(
  arrName: 'skills' | 'talents',
): { textes: TexteDInstance[]; nues: { where: string; book: string; refId: string; site: EntreeDeSite }[]; sentinelles: EntreeDeSite[] } {
  const textes: TexteDInstance[] = [];
  const nues: { where: string; book: string; refId: string; site: EntreeDeSite }[] = [];
  const sentinelles: EntreeDeSite[] = [];
  const listes: [string, EntreeDeSpecs[]][] = [
    ['creatures', creatures], ['careerLevels', careerLevels], ['species', species], ...partiellesDeCreatures(),
  ] as [string, EntreeDeSpecs[]][];
  for (const [file, list] of listes) {
    for (const entry of list) {
      const book = entry.source?.book ?? '(sans source)';
      if (typeof entry.id !== 'string') throw new Error(`${file} : propriétaire sans id`);
      const owner = entry.id;
      const fichier = fichiersDeSpecs.get(file.endsWith('.json') ? file : `${file}.json`);
      if (!fichier) throw new Error(`${file} : document absent du corpus`);
      const site = (famille: string, node: { id: string; spec?: string }) => sitesEnEntrees([siteIntegrite(famille, fichier, owner, arrName, node.id, node.spec ?? '')])[0];
      walkSkillRefs(entry, (node) => {
        const type = arrName === 'skills' ? 'skill' : 'talent';
        const catalogue = catalogueSpecs(type, node.id).length > 0;
        // Un nœud à `choix` PORTE un régime de spécialisation (borne ou libre) : ce n'est pas une réf NUE.
        if (node.choix != null) return;
        if (node.spec == null) { if (catalogue) nues.push({ where: `${file}(${owner})`, book, refId: node.id, site: site('competence-nue', node) }); return; }
        if (isSentinel(node.spec)) { sentinelles.push(site('talent-sentinelle', node)); return; }
        if (refusDeSpec(type, node.id, node.spec) !== 'nonSpecialisable') return;
        textes.push({ key: `${file}|${owner}|${node.id}|${node.spec}`, site: site('talent-texte', node) });
      }, arrName);
    }
  }
  return { textes, nues, sentinelles };
}

describe('Compétences de statbloc, de Carrière et d’espèce — observations nommées (#1342 L2-a)', () => {
  const ROOT = fileURLToPath(new URL('../../', import.meta.url));
  const { extraits: EXTRAITS, dirManquant } = extractedBooks(books, ROOT);
  const { nues } = collecteSpecs('skills');

  it('books.json#dir : chaque livre déclaré a son extraction sur disque', () => {
    expect(EXTRAITS.size).toBeGreaterThan(10);
    expect(dirManquant, `books.json#dir sans extraction sur disque : ${dirManquant.join(', ')}`).toEqual([]);
  });

  // Le périmètre se DÉDUIT du dossier déclaré par le livre (`dir`) : une extraction FR que personne ne
  // réclame y serait INVISIBLE. Ce volet la nomme. Les dossiers FR sont reconnus au CONTENU, pas au nom — mesure du 2026-08-23.
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
    const claimed = new Set(books.map((b) => b.dir).filter(Boolean) as string[]);
    const orphelins = dirs.filter((d) => !claimed.has(d));
    const inattendus = orphelins.filter((d) => !NON_RECLAMES.has(d));
    expect(inattendus, `extraction FR qu'aucun livre de books.json ne réclame — poser son dir, ou nommer ici :\n${inattendus.join('\n')}`).toEqual([]);
    const perimes = [...NON_RECLAMES].filter((d) => !orphelins.includes(d));
    expect(perimes, `dossier(s) désormais réclamé(s) — retirer de NON_RECLAMES :\n${perimes.join('\n')}`).toEqual([]);
  });

  // LDB 08 l.3325 ; LDB 08 l.3749 ; LDB 08 l.2448
  it('les compétences nues restent des observations nommées', () => {
    expect(nues.length).toBeGreaterThan(0);
    ecartIntegrite(nues.map((n) => n.site), COMPETENCES_NUES, true);
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

// ── OBSERVATIONS NOMMÉES (#1457 B1) — `talents[]` de statbloc, de Carrière et d'espèce : la spéc est
// admise au parse (`talentRefSchema`, `refOuSpec('talent')`) ; les deux passes de `talentRefSchema`
// (texte d'instance, sentinelle) restent des stocks nommés ici.
describe('Talents de statbloc, de Carrière et d’espèce — observations nommées (#1457 B1)', () => {
  const { textes, sentinelles } = collecteSpecs('talents');

  // LDB 10 l.315
  it('les textes de Talent sans catalogue restent des observations nommées', () => {
    expect(textes.length).toBeGreaterThan(0);
    const RACINES_DE_CORPUS = new Set(['creatures', 'careerLevels', 'species']);
    expect(textes.some((h) => !RACINES_DE_CORPUS.has(h.key.split('|')[0])), 'aucune entrée partielle de texte de Talent').toBe(true);
    ecartIntegrite(textes.map((h) => h.site), TALENTS_TEXTES, true);
  });

  // #1621
  it('les sentinelles de Talent sont nommées et soldées', () => {
    ecartIntegrite(sentinelles, TALENTS_SENTINELLES);
  });
});

// #622
describe('careerLevels.trappings — dotations textuelles nommées', () => {
  it('chaque dotation textuelle est déclarée et soldée', () => {
    const sites: ReturnType<typeof siteIntegrite>[] = [];
    for (const niveau of careerLevels) {
      const walk = (items: unknown[]): void => {
        for (const n of items) {
          if (!isObj(n)) continue;
          if ('text' in n) sites.push(siteIntegrite('dotation-texte', 'src/data/careerLevels.json', niveau.id, 'trappings.text', '', String(n.text)));
          if (Array.isArray(n.choice)) walk(n.choice);
        }
      };
      walk(niveau.trappings);
    }
    ecartIntegrite(sitesEnEntrees(sites), DOTATIONS_TEXTES);
  });
});

// ── GARDE DE CLASSE — `appearance.species` = espèce d'apparence (`fauteDEspece`, `grammaire/valeurs.ts`),
// jamais un LIBELLÉ. `species` absent = OK. Cf. `AGENTS.md` § Pour TOUT agent.
describe('appearance.species — espèce d’apparence (fauteDEspece), jamais un libellé', () => {
  function collect(node: unknown, where: string, out: string[]): void {
    if (Array.isArray(node)) { node.forEach((x, i) => collect(x, `${where}[${i}]`, out)); return; }
    if (!isObj(node)) return;
    const app = node.appearance;
    if (isObj(app) && typeof app.species === 'string' && fauteDEspece(app.species) !== null)
      out.push(`${where}.appearance.species = ${JSON.stringify(app.species)}`);
    for (const [k, v] of Object.entries(node)) collect(v, `${where}.${k}`, out);
  }

  it('scénarios de test : tout appearance.species de la party, construite en TS et jamais parsée, est une espèce d’apparence', () => {
    const bad: string[] = [];
    for (const s of SCENARIOS) collect(s.construire(idsDeTest).party, `${s.id}.party`, bad);
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
      const c = s.construire(idsDeTest);
      walkPostes(c.scene, `${s.id}.scene`, hard);
      if (c.extraScenes) walkPostes(c.extraScenes, `${s.id}.extraScenes`, hard);
      walkPostes(c.party, `${s.id}.party`, hard);
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

// ── RÉFÉRENCES DES `GameOp` DE LA DONNÉE COMMITÉE (#847). Le PÉRIMÈTRE (quels champs d'op portent
// une chaîne) est DÉRIVÉ de l'union `GameOp` par le TypeChecker ; chaque champ est un CHAMP D'OP À SLOT
// d'`OP_DEFS` (`champsDOpASlot`), jugé au parse par sa feuille `idDe`, ou il porte sa classification
// dans `scripts/guards/lib/gameOpRefFk.mjs` (`registry` | `nonRef`). Les registres des
// champs que le parse ne juge pas sont câblés ICI, où ils sont typés.
describe('GameOp — toute référence de la donnée committée est jugée au parse ou résout dans son registre (#847, #1473)', () => {
  const resolvers: Record<string, (id: string) => boolean> = {
    crewTestTypes: (id) => !!findCrewTestTypeById(id),
    seaManannFactors: (id) => MANANN_FACTORS.some((f) => f.id === id),
  };

  /** Le corpus des DEUX racines, celui que parse le registre des slots (`scanDuCorpus`) : une seule
   *  lecture, pour que les nœuds d’op du scan se joignent à ceux du parse par IDENTITÉ d’objet. */
  const { defs: DEFS, scan: CORPUS } = CORPUS_SCANNE;
  const sources = [...CORPUS.brutParNom].map(([file, data]) => ({ file, data }));
  const CHAMPS_A_SLOT = champsDOpASlot();
  const scan = scanGameOpRefs({ sources, resolvers, champsASlot: CHAMPS_A_SLOT });
  it('le périmètre est DÉRIVÉ de l’union GameOp moins les champs d’op à slot : aucun champ de référence sans cible déclarée', { timeout: 30_000 }, () => {
    const { derived, unclassified, stale } = auditFieldCoverage(REPO_ROOT, { champsASlot: CHAMPS_A_SLOT });
    expect(derived.length, 'aucun champ dérivé — l’extraction du type a échoué').toBeGreaterThan(0);
    expect(unclassified, `champs de GameOp sans cible déclarée (gameOpRefFk.mjs) :\n${unclassified.join('\n')}`).toEqual([]);
    expect(stale.map((c) => `${c.key} — ${c.raison}`), 'cibles déclarées hors périmètre').toEqual([]);
  });

  it('une cible déclarée sur un champ d’op à slot sort en `stale`, raison nommée (contre-épreuve)', { timeout: 30_000 }, () => {
    expect(CHAMPS_A_SLOT.has('removeTrait.trait')).toBe(true);
    const declare = GAMEOP_FIELD_TARGETS as Record<string, unknown>;
    declare['removeTrait.trait'] = { nonRef: 'fixture' };
    try {
      const { stale: doublon } = auditFieldCoverage(REPO_ROOT, { champsASlot: CHAMPS_A_SLOT });
      expect(doublon.map((c) => c.key)).toEqual(['removeTrait.trait']);
      expect(doublon[0].raison).toMatch(/typé AU PARSE par sa feuille `idDe` d’`OP_DEFS`/);
    } finally {
      delete declare['removeTrait.trait'];
    }
  });

  // COUVERTURE : un champ d'op à slot est jugé par sa feuille `idDe` là où le parse ATTEINT son
  // nœud. Ce test prouve la JOINTURE : tout nœud `GameOp` du corpus est ATTEINT par le parse de mesure
  // (`opsDuParse`, par IDENTITÉ d'objet). Un nœud non atteint pend sous un conteneur que le parse ne
  // descend pas : son conteneur se type.
  // Stock NOMINATIF, compte EXACT par document : les ops du dialecte `jsonOpSchema`
  // (`schemas/defs/miscast.ts`), lot de mort #1902.
  const HORS_PARSE: Record<string, number> = { 'miscast.json': 84 };
  const ATTEINTES = opsDuParse(CORPUS, DEFS);
  /** La jointure corpus ↔ parse : les nœuds d'op que le parse de mesure n'atteint pas. */
  type NoeudDOp = (typeof scan.noeudsDOp)[number];
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

  // Conteneur OPAQUE de fixture : un `z.record(z.string(), z.unknown())`, que le parse ne descend pas.
  it('une op typée sous un conteneur que le parse ne descend pas est vue du corpus, absente du parse, nommée hors parse (fixture)', () => {
    const def: SchemaDef = { file: 'opaque.json', root: 'src/data', famille: 'config', schema: z.strictObject({ params: z.record(z.string(), z.unknown()) }) };
    const op = { op: 'domeWard', trait: { id: IDS_PAR_ESPACE['traits.json'][0], value: 1 } };
    const document = { params: { ops: [op] } };
    const noeuds = scanGameOpRefs({ sources: [{ file: def.file, data: document }], resolvers, champsASlot: CHAMPS_A_SLOT }).noeudsDOp;
    expect(noeuds.map((n) => n.noeud)).toEqual([op]);
    const atteintes = opsDuParse({ brutParNom: new Map<string, unknown>([[def.file, document]]) }, [def]);
    expect(atteintes.has(op)).toBe(false);
    expect(horsDuParse(noeuds, atteintes).map(ligneHorsParse)).toEqual(['opaque.json.params.ops[0] : domeWard']);
  });

  // Le stock HORS_PARSE n'a pas de parse d'op : chaque chaîne de ses champs d'op à slot est une CASE
  // validée par `idDe` au parse de SON document (`slotsDuParse`), ou elle n'est jugée par personne.
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
    rangee.ops!.push({ op: 'castPenalty', mod: -10 });
    table.entries = [rangee];
    const brutParNom = new Map<string, unknown>([['miscast.json', [table]]]);
    const noeuds = scanGameOpRefs({ sources: [{ file: 'miscast.json', data: [table] }], resolvers }).noeudsDOp;
    const atteintes = opsDuParse({ brutParNom }, [miscastDef!]);
    expect(noeuds.filter((n) => atteintes.has(n.noeud)), 'la fixture doit rester HORS du parse d’op').toEqual([]);
    const slots = slotsDuParse({ brutParNom }, [miscastDef!]);
    expect(slotsDOpNonJuges(noeuds, atteintes, slots, CHAMPS_A_SLOT)).toEqual([]);
    const avecSlot = new Set([...CHAMPS_A_SLOT, 'castPenalty.op']);
    expect(slotsDOpNonJuges(noeuds, atteintes, slots, avecSlot).map(renduNonJuge))
      .toEqual(['miscast.json[0].entries[0].ops[0].op = "castPenalty"', 'miscast.json[0].entries[0].ops[1].op = "castPenalty"']);
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

  it('src/data/*.json + src/scenes/**.json : toute ref d’op que le parse ne juge pas résout', () => {
    expect(sources.length, 'aucun document scanné').toBeGreaterThan(50);
    const lines = scan.offenders.map(formatOffender);
    expect(lines, lines.join('\n')).toEqual([]);
  });

  // Le format d'une cible est un ensemble FERMÉ (`gameOpRefFk.mjs`, doc de `GAMEOP_FIELD_TARGETS`) :
  // `{ registry }` | `{ nonRef }`. Une clé hors de cet ensemble serait lue par
  // PERSONNE dans `scanGameOpRefs` — donc une tolérance muette, ou un champ tenu pour gardé sans l'être.
  it('le format d’une cible est fermé : une seule clé, registry ou nonRef, non vide', () => {
    const CLES = ['registry', 'nonRef'];
    const anomalies: string[] = [];
    for (const [cible, decl] of Object.entries(GAMEOP_FIELD_TARGETS as Record<string, Record<string, unknown>>)) {
      const cles = Object.keys(decl);
      if (cles.length !== 1 || !CLES.includes(cles[0])) anomalies.push(`${cible} : clés [${cles.join(', ')}] hors du format fermé`);
      for (const v of Object.values(decl)) if (typeof v !== 'string' || !v) anomalies.push(`${cible} : valeur absente`);
    }
    expect(anomalies, anomalies.join('\n')).toEqual([]);
  });

  it('la garde n’est pas vacante — une op à référence fantôme est REFUSÉE (contre-épreuve)', () => {
    const fixture = (testType: string) => [{
      file: 'fixture.json',
      data: [{ effects: [{ flow: { effet: { ops: [{ op: 'skillDRBonus', testType, bonus: 1 }] } } }] }],
    }];
    expect(scanGameOpRefs({ sources: fixture('manoeuvre'), resolvers }).offenders).toEqual([]);
    const out = scanGameOpRefs({ sources: fixture('test-fantome'), resolvers }).offenders;
    expect(out).toHaveLength(1);
    expect(out[0].registry).toBe('crewTestTypes');
    expect(out[0].path).toBe('fixture.json[0].effects[0].flow.effet.ops[0].testType');
  });

  it('un champ NON-RÉFÉRENCE porte sa justification', () => {
    for (const [key, t] of Object.entries(GAMEOP_FIELD_TARGETS)) {
      if ('registry' in t) { expect(resolvers[t.registry], `${key} → registre inconnu ${t.registry}`).toBeTruthy(); continue; }
      expect(t.nonRef.length > 20, `${key} : justification absente ou trop maigre`).toBe(true);
    }
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
