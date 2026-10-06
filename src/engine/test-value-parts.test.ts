import { describe, it, expect } from 'vitest';
import { testValue, skillBaseValue, testValueParts } from './skills';
import { volatileCharLines } from './characteristics';
import { addCondition, COND, passivePartLine } from './conditions';
import { talentPassiveMods } from './talentEffects';
import { etats, findMutationById, qualities, refLabel, skills, spells, talents, trappings, traits } from '../data';
import type { Combatant, CharKey, SkillInstance } from './types';
import { avecObjetsDeCampagne, objetDeTest } from './objetDeTest.testkit';

/**
 * GARDE DE CLÔTURE du décomposeur de `testValue` (#1153). L'écran n'a le droit d'annoncer une base NUE
 * (`LDB 09 l.17`, la grandeur qui départage à DR égal — `LDB 12 l.160`) que si TOUT l'écart avec la
 * valeur de Test se lit en composantes NOMMÉES : sinon on troque une divergence numérique contre une
 * chip anonyme « autres » (`ui/RollLine.tsx`), contraire à #1117.
 *
 * INVARIANT vérifié sur une GRILLE : nu, chaque poste SEUL, puis combinaisons —
 *     testValue(c, skill, char, spec) === skillBaseValue(c, skill, spec, char) + Σ testValueParts(…)
 * Un poste AJOUTÉ à `testValue` sans son producteur de parts fait ROUGIR ce test : c'est lui la garde
 * (le décomposeur ne peut pas « oublier » un canal en silence).
 */
const CK: CharKey = 'sociabilite';

function hero(over: Partial<Combatant> = {}): Combatant {
  return {
    id: 'h', label: 'Cobaye', kind: 'hero', speciesId: 'humains-reiklander',
    characteristics: { sociabilite: 40, agilite: 40, dexterite: 40, intelligence: 40 } as Combatant['characteristics'],
    skills: [{ id: 'marchandage', advances: 15 }] as SkillInstance[],
    talents: [], items: [], conditions: [], advantage: 0,
    ...over,
  } as unknown as Combatant;
}

/** Id STABLE d'un cas — clé des listes d'exception : un renommage du libellé FR ne doit pas dénouer
 *  un arbitrage (le `nom` est de l'affichage de test, l'`id` est le contrat). */
type CasId =
  | 'nu' | 'pure-carac' | 'etat' | 'mutation' | 'qualite-laid' | 'effet-char' | 'port-armure'
  | 'encombrement' | 'outil' | 'trait' | 'sort-skillmods' | 'mutation-perimee'
  | 'sequelle' | 'instance-id-only' | 'etat+mutation' | 'etat+effet' | 'mutation+laid';

/** Un cas de la grille : son id stable, son nom lisible, le cobaye, et le Test visé. */
interface Cas { id: CasId; nom: string; c: Combatant; skill?: string; char?: CharKey; spec?: string }

/** Le −20 de la mutation « Visage inversé » (`mutations.json`) — lue en DONNÉE, jamais recopiée. */
const visageInverse = () => {
  const m = findMutationById('visage-inverse');
  expect(m, 'mutation `visage-inverse` absente du catalogue').toBeTruthy();
  return { id: m!.id, label: m!.label, desc: m!.desc, kind: m!.kind, roll: 1, passive: m!.passive };
};

function withEtat(): Combatant {
  const c = hero();
  addCondition(c, COND.empoisonne);
  return c;
}

function withMutation(): Combatant {
  return hero({ mutations: [visageInverse()] as Combatant['mutations'] });
}

/** Effet actif char-qualifié (Mystracine « −10 Ag/I/Int », LDB 71 l.33) DÉCLARANT sa source : c'est elle
 *  qui donne à la chip son renvoi Codex (`effectRef` → `CATEGORY_BY_SOURCE_KIND`). */
function withEffetCharQualifie(): Combatant {
  return hero({ activeEffects: [{ label: 'Mystracine', testMod: -10, testModChar: CK, source: { kind: 'trapping', id: 'mystracine' } }] as unknown as Combatant['activeEffects'] });
}

/** Le MÊME effet SANS source déclarée — seul cas structurellement non liable au Codex (cf. test dédié). */
function withEffetSansSource(): Combatant {
  return hero({ activeEffects: [{ label: 'Malédiction de malchance', testMod: -10, testModChar: CK }] as unknown as Combatant['activeEffects'] });
}

function withLaid(): Combatant {
  // Objet ÉQUIPÉ portant la qualité `laid` (`qualities.json` : testMod −10 Sociabilité, LDB 60 l.54).
  return hero({ items: [objetDeTest({ uid: 'i1', trappingId: 'chemise-de-mailles', kind: 'armor', equipped: true, qualities: [{ id: 'laid' }] })] as Combatant['items'] });
}

function withArmureLourde(): Combatant {
  // Port d'armure (LDB 63) : pseudo-qualité `en-discretion` −10 → pèse sur un Test de Discrétion.
  return hero({
    skills: [{ id: 'discretion', advances: 15 }] as SkillInstance[],
    items: [objetDeTest({ uid: 'i2', trappingId: 'cotte-de-mailles', kind: 'armor', equipped: true, qualities: [{ id: 'en-discretion', value: -10 }] })] as Combatant['items'],
  });
}

/** Pièce d'armure d'un objet de CAMPAGNE (`narratif.objets`, #767) : absente du catalogue, nommée par
 *  son entrée de campagne, que voit `resoudreObjet` (#2324). */
const HARNOIS = { ...trappings.find((t) => t.id === 'cotte-de-mailles')!, id: 'campagne-harnois-du-forgeron', label: 'Harnois du forgeron' };
function withArmureDeCampagne(): Combatant {
  return hero({
    skills: [{ id: 'discretion', advances: 15 }] as SkillInstance[],
    items: [objetDeTest({ uid: 'i3', trappingId: HARNOIS.id, kind: 'armor', equipped: true, qualities: [{ id: 'en-discretion', value: -10 }] })] as Combatant['items'],
  });
}

function withEncombrement(): Combatant {
  // Charge > limite (LDB 61 « Surchargé ») : −10 en Agilité — ne pèse QUE sur un Test d'Agilité.
  return hero({
    skills: [{ id: 'athletisme', advances: 15 }] as SkillInstance[],
    characteristics: { sociabilite: 40, agilite: 40, force: 20, endurance: 20 } as Combatant['characteristics'],
    items: Array.from({ length: 12 }, (_, i) => (objetDeTest({ uid: `enc${i}`, trappingId: 'sac-a-dos', kind: 'misc', enc: 1, qualities: [], equipped: false }))) as unknown as Combatant['items'],
  });
}

/** Trait à passif `skillMod` (`traits.json` `dresse-divertir` : +10 Divertissement). */
function withTrait(): Combatant {
  return hero({ skills: [{ id: 'divertissement', advances: 15 }] as SkillInstance[], liveTraits: [{ id: 'dresse-divertir' }] as Combatant['liveTraits'] });
}

/**
 * Instance ID-ONLY d'une SAUVEGARDE PÉRIMÉE : un `TalentInstance` ne stocke QU'un id (≠ mutation, qui
 * porte l'objet complet) et cet id a disparu du catalogue. ARBITRAGE : l'instance ne PEUT pas stamper
 * un `label` — elle n'en a jamais eu, le nom vivait dans le catalogue qui l'a perdu. Le producteur ne
 * peut donc rien nommer… mais il n'émet rien non plus : `findTalentById` ne rend aucun `passive`, donc
 * AUCUNE composante n'atteint le jet. Le trou est refermé par l'ABSENCE, pas par un nom inventé.
 */
function withTalentPerime(): Combatant {
  return hero({ talents: [{ talentId: 'talent-disparu-du-catalogue', times: 1 }] as Combatant['talents'] });
}

/** SÉQUELLE de traumatisme à `skillMod` (LDB 18) : le Combattant porte l'objet `Trauma`, donc son
 *  `label` — les séquelles ne sont pas une catégorie du Codex, d'où l'absence de lien. */
function withSequelle(): Combatant {
  return hero({ traumas: [{ label: 'Fracture à la mâchoire', ops: [{ op: 'skillMod', skill: { id: 'marchandage' }, mod: -10 }] }] as unknown as Combatant['traumas'] });
}

/** Premier TALENT du catalogue portant un passif — pris à la donnée, jamais forgé. AUCUN talent ne porte
 *  aujourd'hui de `skillMod`/`testMod` (leurs passifs sont `charMod`/`grantCareerSkill`/`attrMod`/…), donc
 *  ce canal ne peut pas être exercé de bout en bout par `testValueParts` : il est gardé À SON PRODUCTEUR
 *  (`talentPassiveMods` stampe `src`), ce qui mord aussi le jour où un talent recevra un `skillMod`. */
const TALENT_PASSIF = talents.find((t) => (t.passive ?? []).length > 0)!;

/** `ActiveEffect.passive` d'un SORT — le canal qui s'annonçait « Séquelle » (mutilation permanente).
 *  Le sort est pris au CATALOGUE (jamais un id forgé) : son lien Codex doit résoudre. */
const SORT = spells[0];

function withSortSkillMod(): Combatant {
  return hero({
    skills: [{ id: 'marchandage', advances: 15 }] as SkillInstance[],
    activeEffects: [{ label: SORT.label, passive: [{ op: 'skillMod', skill: { id: 'marchandage' }, mod: -20 }], source: { kind: 'spell', id: SORT.id } }] as unknown as Combatant['activeEffects'],
  });
}

/** Mutation d'une SAUVEGARDE PÉRIMÉE (l'entrée a disparu du catalogue depuis) : le Combattant en porte
 *  l'objet COMPLET, donc son nom tient ; seul le lien Codex manque. */
function withMutationPerimee(): Combatant {
  return hero({ mutations: [{ id: 'trogne-de-goret', label: 'Trogne de goret', desc: '', kind: 'physique', roll: 1, passive: [{ op: 'testMod', amount: -15, char: CK }] }] as unknown as Combatant['mutations'] });
}

/**
 * EXCEPTIONS DÉCLARÉES au RENVOI Codex — la liste vit ICI, pas dans un commentaire. Le NOM, lui, n'a
 * AUCUNE exception : l'entité attachée le porte toujours (`Combatant.mutations` stocke l'objet complet,
 * `ItemInstance` son `label`, `Trauma` le sien), donc `passivePartLine` le lit sous la main. Seul le
 * LIEN peut manquer, pour DEUX raisons mesurées :
 *  - l'émetteur n'a rien à pointer : effet actif sans `source` ni `sourceSpellId`, séquelle (les
 *    traumatismes ne sont pas une catégorie du Codex) ;
 *  - l'id ne RÉSOUT plus : entrée de catalogue supprimée depuis une vieille sauvegarde — on n'offre
 *    alors pas une chip morte.
 * Retirer une entrée d'ici la remet sous l'exigence générale ; en ajouter une est un ARBITRAGE à énoncer.
 */
const SANS_REF_DECLARE = new Set<CasId>(['mutation-perimee', 'sequelle']);

/** Replis de FAMILLE : jamais un nom d'octroyeur (`passivePartLine` n'en produit aucun ; cette liste
 *  interdit qu'on en réintroduise un). */
const FAMILLES = ['Passif', 'Séquelle', 'État', 'Symptôme', 'Aura', 'Maladie', 'Faim/Soif', 'Ivresse', 'intrinseque', 'magique'];

/** Ids RÉELS d'une catégorie du Codex — contrat POSITIF : un libellé qui est l'un de ces ids est un id
 *  BRUT échappé du résolveur. Remplace l'heuristique de forme (« contient un tiret »), aveugle sur les
 *  ids d'un seul mot (mesure : 85/130 traits, 80/187 talents, 15/20 États, 106/576 sorts). */
const IDS_PAR_CATEGORIE: Record<string, string[]> = {
  traits: traits.map((x) => x.id),
  talents: talents.map((x) => x.id),
  spells: spells.map((x) => x.id),
  etats: etats.map((x) => x.id),
  qualities: qualities.map((x) => x.id),
  trappings: trappings.map((x) => x.id),
  skills: skills.map((x) => x.id),
};

const GRILLE: Cas[] = [
  { id: 'nu', nom: 'nu (aucun modificateur)', c: hero(), skill: 'marchandage' },
  { id: 'pure-carac', nom: 'Test de PURE Caractéristique', c: hero(), char: CK },
  { id: 'etat', nom: 'État (Empoisonné −10)', c: withEtat(), skill: 'marchandage' },
  { id: 'mutation', nom: 'mutation char-qualifiée (Visage inversé −20)', c: withMutation(), skill: 'marchandage' },
  { id: 'qualite-laid', nom: 'qualité d’objet (Laid −10)', c: withLaid(), skill: 'marchandage' },
  { id: 'effet-char', nom: 'effet actif char-qualifié (−10 Soc)', c: withEffetCharQualifie(), skill: 'marchandage' },
  { id: 'port-armure', nom: 'port d’armure skill-qualifié (−10 Discrétion)', c: withArmureLourde(), skill: 'discretion' },
  { id: 'encombrement', nom: 'Encombrement (Agilité)', c: withEncombrement(), skill: 'athletisme' },
  { id: 'outil', nom: 'outil manquant (Crochetage sans crochets)', c: hero({ skills: [{ id: 'crochetage', advances: 15 }] as SkillInstance[] }), skill: 'crochetage' },
  // Les canaux que la garde de la passe 3 ne voyait pas (sondes du juge).
  { id: 'trait', nom: 'TRAIT à passif skillMod (Dressé pour divertir)', c: withTrait(), skill: 'divertissement' },
  { id: 'sort-skillmods', nom: 'SORT à `skillMod` passif (effet actif temporaire)', c: withSortSkillMod(), skill: 'marchandage' },
  { id: 'mutation-perimee', nom: 'mutation d’une sauvegarde périmée', c: withMutationPerimee(), skill: 'marchandage' },
  { id: 'sequelle', nom: 'SÉQUELLE (traumatisme à skillMod)', c: withSequelle(), skill: 'marchandage' },
  { id: 'instance-id-only', nom: 'instance ID-ONLY d’une sauvegarde périmée', c: withTalentPerime(), skill: 'marchandage' },
  // COMBINAISONS — les postes doivent s'additionner sans trou ni double-compte.
  { id: 'etat+mutation', nom: 'État + mutation', c: (() => { const c = withMutation(); addCondition(c, COND.empoisonne); return c; })(), skill: 'marchandage' },
  { id: 'etat+effet', nom: 'État + effet char-qualifié', c: (() => { const c = withEffetCharQualifie(); addCondition(c, COND.empoisonne); return c; })(), skill: 'marchandage' },
  { id: 'mutation+laid', nom: 'mutation + qualité Laid', c: hero({ mutations: [visageInverse()] as Combatant['mutations'], items: withLaid().items }), skill: 'marchandage' },
];

describe('#1153 — `testValueParts` décompose EXHAUSTIVEMENT `testValue` (socle d’affichage)', () => {
  it.each(GRILLE)('invariant : base NUE + Σ parts = valeur de Test — $nom', ({ c, skill, char, spec }) => {
    const nue = skillBaseValue(c, skill, spec, char);
    const parts = testValueParts(c, skill, char, spec);
    const somme = parts.reduce((s, p) => s + p.value, 0);
    expect(nue + somme, `résidu NON nommé de ${testValue(c, skill, char, spec) - nue - somme} — un poste de \`testValue\` échappe au décomposeur`)
      .toBe(testValue(c, skill, char, spec));
  });

  it.each(GRILLE)('chaque part est NOMMÉE : ni vide, ni id brut, ni repli de FAMILLE — $nom', ({ c, skill, char, spec }) => {
    for (const p of testValueParts(c, skill, char, spec)) {
      expect(p.label.length, `part sans libellé : ${JSON.stringify(p)}`).toBeGreaterThan(0);
      // Id BRUT : le libellé APPARTIENT au jeu d'ids d'une catégorie (contrat positif, pas une forme).
      for (const [cat, ids] of Object.entries(IDS_PAR_CATEGORIE)) {
        expect(ids, `libellé = id brut de \`${cat}\` : « ${p.label} » — le résolveur n'a pas trouvé le nom`).not.toContain(p.label);
      }
      expect(FAMILLES, `libellé de FAMILLE au lieu du nom de l'octroyeur : « ${p.label} » — poser le \`src\`/\`label\` à l'ÉMISSION`).not.toContain(p.label);
      expect(p.value, 'part de valeur nulle : elle ne devrait pas être rendue').not.toBe(0);
    }
  });

  /**
   * Les 3 cas que la recette avait mesurés KO (résidu « autres » à l'écran) — ils sont ici NOMMÉS.
   * Les magnitudes viennent de la DONNÉE (`mutations.json` −20, `etats.json` −10) : le test lit le
   * catalogue plutôt que de recopier un nombre qui pourrait dériver.
   */
  it('les composantes portent le NOM de leur émetteur, pas celui de leur famille', () => {
    const mutLabel = findMutationById('visage-inverse')!.label;
    expect(testValueParts(withMutation(), 'marchandage').map((p) => p.label)).toEqual([mutLabel]);
    expect(testValueParts(withEtat(), 'marchandage').map((p) => p.label)).toEqual(['Empoisonné']);
    expect(testValueParts(withEffetCharQualifie(), 'marchandage').map((p) => p.label)).toEqual(['Mystracine']);
    expect(testValueParts(withLaid(), 'marchandage').map((p) => p.label)).toEqual(['Laid']);
    // Cumul : les deux composantes coexistent, chacune à son nom (aucune fusion anonyme).
    const cumul = (() => { const c = withMutation(); addCondition(c, COND.empoisonne); return c; })();
    expect(testValueParts(cumul, 'marchandage').map((p) => p.label).sort()).toEqual(['Empoisonné', mutLabel].sort());
  });

  /** SONDES DU JUGE (passe 3) promues en tests : les 3 canaux qui rendaient une chip anonyme/fausse. */
  it('(A) TRAIT : la composante porte le nom du trait, pas « Passif »', () => {
    const parts = testValueParts(withTrait(), 'divertissement');
    expect(parts).toEqual([{ label: refLabel('traits', { id: 'dresse-divertir' }), value: 10, famille: 'jet', ref: { category: 'traits', id: 'dresse-divertir' } }]);
  });

  /** Canal TALENT : gardé À SA SOURCE (aucun talent ne porte encore de `skillMod`, cf. `TALENT_PASSIF`).
   *  Le `src` stampé à l'émission est ce qui NOMMERA la chip le jour où l'un en portera un. */
  it('(A bis) TALENT : `talentPassiveMods` stampe le talent émetteur (garde au PRODUCTEUR)', () => {
    const c = hero({ talents: [{ talentId: TALENT_PASSIF.id, times: 1 }] as Combatant['talents'] });
    const mods = talentPassiveMods(c);
    expect(mods.length).toBeGreaterThan(0);
    for (const m of mods) expect(m.src).toEqual({ category: 'talents', id: TALENT_PASSIF.id });
    // …et ce `src` produit bien le NOM du talent, pas un repli de famille.
    expect(passivePartLine(mods[0], -1).label).toBe(refLabel('talents', { id: TALENT_PASSIF.id }));
  });

  it('(B) SORT : la composante porte le nom du SORT — jamais « Séquelle » (un sort n’est pas une mutilation)', () => {
    const [part, ...reste] = testValueParts(withSortSkillMod(), 'marchandage');
    expect(reste).toEqual([]);
    expect(part.label).toBe(SORT.label);
    expect(part.ref).toEqual({ category: 'spells', id: SORT.id }); // lien Codex VERS LE SORT
    expect(part.value).toBe(-20);
  });

  it('(C) armure de CAMPAGNE : NOMMÉE par son entrée de campagne — ni « Passif », ni un id brut', () => {
    const [part, ...reste] = avecObjetsDeCampagne([HARNOIS], () => testValueParts(withArmureDeCampagne(), 'discretion'));
    expect(reste).toEqual([]);
    expect(part.label).toBe('Harnois du forgeron');
    expect(part.label).not.toBe(HARNOIS.id);
    expect(part.value).toBe(-10);
  });

  it('(C bis) mutation d’une sauvegarde périmée : le NOM tient (objet complet), seul le LIEN manque', () => {
    const [part, ...reste] = testValueParts(withMutationPerimee(), 'marchandage');
    expect(reste).toEqual([]);
    expect(part.label).toBe('Trogne de goret'); // le Combattant porte l'objet COMPLET, pas une référence
    expect(part.label).not.toBe('trogne-de-goret'); // l'id brut est INTERDIT (cf. garde d'appartenance)
    expect(part.ref).toBeUndefined(); // l'entrée a disparu du catalogue : pas de chip morte
  });

  it('(C ter) SÉQUELLE : NOMMÉE par le traumatisme porté (hors catégorie Codex, donc sans lien)', () => {
    const [part, ...reste] = testValueParts(withSequelle(), 'marchandage');
    expect(reste).toEqual([]);
    expect(part.label).toBe('Fracture à la mâchoire'); // jamais « Séquelle », le nom de sa famille
    expect(part.ref).toBeUndefined();
  });

  /**
   * SONDE D1 — un MÊME octroyeur porte le MÊME nom sur TOUS les canaux. La séquelle est prise au
   * CATALOGUE de critiques ; elle pèse à la fois par `charMod` (→ modale d'ATTAQUE, `volatileCharLines`)
   * et par `skillMod` (→ `testValueParts`). Les deux doivent dire « Fracture », pas « Séquelle ».
   */
  it('D1 — un même octroyeur porte le MÊME nom sur les canaux charMod ET skillMod', () => {
    const c = hero({
      traumas: [{ label: 'Fracture', ops: [{ op: 'charMod', char: 'capacite-de-combat', mod: -30 }, { op: 'skillMod', skill: { id: 'marchandage' }, mod: -30 }] }] as unknown as Combatant['traumas'],
    });
    const canalCharMod = volatileCharLines(c, 'capacite-de-combat').map((l) => l.label);
    const canalSkillMod = testValueParts(c, 'marchandage').map((p) => p.label);
    expect(canalCharMod).toEqual(['Fracture']); // modale d'ATTAQUE — disait « Séquelle »
    expect(canalSkillMod).toEqual(['Fracture']);
    expect(canalCharMod).toEqual(canalSkillMod); // MÊME octroyeur ⇒ MÊME nom, quel que soit le canal
  });

  it('D1 bis — Faim/Soif et Ivresse gardent leur famille : aucune entité ne les octroie', () => {
    const affame = hero({ hunger: { days: 3, tests: 0, failures: 2 } } as Partial<Combatant>);
    const lignes = volatileCharLines(affame, 'force').map((l) => l.label);
    if (lignes.length) expect(lignes).toEqual(['Faim/Soif']); // repli de famille ASSUMÉ, et le seul
  });

  /** Le NOM n'a AUCUNE exception : c'est l'entité attachée qui le porte, elle l'a toujours. */
  it('aucun nom ne peut manquer : toute part de la grille porte un libellé non vide', () => {
    for (const cas of GRILLE) {
      for (const p of testValueParts(cas.c, cas.skill, cas.char, cas.spec)) {
        expect(p.label.trim(), `nom VIDE (${cas.nom}) — l'émetteur n'a fourni ni \`label\` ni \`src\``).not.toBe('');
      }
    }
  });

  it('chaque part porte son renvoi Codex — sauf les exceptions DÉCLARÉES ci-dessous', () => {
    for (const cas of GRILLE) {
      for (const p of testValueParts(cas.c, cas.skill, cas.char, cas.spec)) {
        if (SANS_REF_DECLARE.has(cas.id)) { expect(p.ref, `exception périmée (${cas.nom}) : la part « ${p.label} » a désormais un renvoi — la retirer de SANS_REF_DECLARE`).toBeUndefined(); continue; }
        expect(p.ref, `part sans renvoi Codex (${cas.nom}) : ${p.label} — poser le \`src\` à l'ÉMISSION, ou déclarer l'exception`).toBeTruthy();
      }
    }
  });

  /**
   * SEULE exception STRUCTURELLE au renvoi Codex, énoncée plutôt que subie : un `ActiveEffect` qui ne
   * DÉCLARE pas sa source (`ActiveEffect.source`/`sourceSpellId` absents — le déclencheur ne l'a pas
   * propagée) n'a aucune identité d'entité à pointer. La composante reste NOMMÉE par le `label` que
   * l'effet porte : elle ne retombe JAMAIS dans « autres ». Poser la source à l'émission suffit à lui
   * rendre son lien (cas `withEffetCharQualifie` ci-dessus).
   */
  it('exception DÉCLARÉE : un effet actif sans source reste NOMMÉ, mais sans renvoi Codex', () => {
    const [part, ...reste] = testValueParts(withEffetSansSource(), 'marchandage');
    expect(reste).toEqual([]);
    expect(part.label).toBe('Malédiction de malchance'); // nommé par l'effet lui-même
    expect(part.ref).toBeUndefined(); // …mais aucune entité à ouvrir : la source n'a pas été propagée
    expect(part.value).toBe(-10);
  });

  /** Le cas de recette : Compétence 55, Empoisonné + mutation → cible 25, écart ENTIÈREMENT nommé. */
  it('cas de recette : aucun résidu « autres » ne subsiste, même postes cumulés', () => {
    const c = withMutation();
    addCondition(c, COND.empoisonne);
    expect(skillBaseValue(c, 'marchandage')).toBe(55);
    expect(testValue(c, 'marchandage')).toBe(25); // 55 − 10 (État) − 20 (mutation)
    const parts = testValueParts(c, 'marchandage');
    expect(parts.reduce((s, p) => s + p.value, 0)).toBe(-30); // l'écart ENTIER est nommé
    expect(55 + (-30)).toBe(testValue(c, 'marchandage'));
  });
});
