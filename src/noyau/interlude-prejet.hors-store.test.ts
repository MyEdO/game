/**
 * LE PRÉ-JET D'UNE ACTIVITÉ, sans store (#3059 S6) : pour chaque Activité d'interlude que le catalogue ouvre, le
 * Test que le volet affiche (`preJetDActivite`) est celui que le geste pose (`pendingActivity`) — voie, valeur,
 * Difficulté, modificateurs —, et chacun vaut l'oracle figé de la fiche ; une Activité dont le héros ne peut tenter
 * aucune voie est refusée à l'ouverture, et le dit. Préparation de bataille : la cible que rend le volet
 * (`preJetDeBatailleRendu`) est celle du jet posé, Soutien et Test combiné compris.
 * LDB 09 l.30, LDB 12 l.187-206, LDB 23 l.66-72, LDB 23 l.197, ADE II 8 l.65-106
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { draineCascade } from './cascade.testkit';
import { emptyScene } from './monde/scene';
import { createHero, skillCharacteristicById } from '../engine/character';
import { withBourseMoney } from '../engine/bourse';
import { activitiesFor, activityById, craftCatalog, craftSpecOf, craftTarget, learnableTalents, metierOf } from '../engine/activities';
import { avecActivite } from '../engine/activiteMer.testkit';
import { learnableSpells } from '../engine/grimoire';
import { soutienMod, testValue } from '../engine/skills';
import { findTrappingById, spells, testSkillLabel } from '../data';
import { ciblesDActivite, preJetDActivite, refusDeLaComposition, refusDeRetrait, type CiblesChoisies } from './verdictsDInterlude';
import { battleActivityById, battlePrepEntries, preJetDePreparation, refusDePrepaDeBataille } from './massBattleFlow';
import careers from '../data/careers.json';
import type { Combatant, Difficulty, ItemInstance } from '../engine/types';
import type { ActivityDef } from '../engine/activities';
import { pratiquer } from './interlude.testkit';

const SCENE = { ...emptyScene('altdorf-centre', 2, 2), label: 'Altdorf', layers: [{ z: 0, tiles: ['sol', 'sol', 'sol', 'sol'] }] };

const COUTEAU_DE_HARALD = { uid: 'arme-1', trappingId: 'couteau-de-harald', label: 'Couteau de Harald', kind: 'melee', qualities: [], enc: 0, equipped: false, requiresMastery: true } as unknown as ItemInstance;
const AMULETTE = { uid: 'art-1', label: 'Amulette étrange', kind: 'trapping', qualities: [], enc: 0, equipped: false, identified: false } as unknown as ItemInstance;
/** Les Compétences avancées que le Vétéran instruit a apprises. */
const INSTRUCTION: [string, string?][] = [['priere'], ['recherche'], ['dressage'], ['projectiles', 'arc'], ['augure']];
const SORTS_DE_FEU = spells.filter((sp) => sp.family === 'arcane' && sp.subType === 'Feu').map((sp) => sp.id).slice(0, 4);

/** Le Vétéran (soldat), sorcier du Feu instruit en Savoir (Magie), forgeron, riche de 1000 PX, qui porte une arme inhabituelle, un artefact,
 *  une Peur et un Péché : chaque Activité du catalogue trouve sa cible. */
function vétéran(seed = 1601, instruit = false): Combatant {
  const h = withBourseMoney(createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Vétéran', seed }), { gold: 20, silver: 0, brass: 0 }, idsDeTest);
  h.items = [...(h.items ?? []), COUTEAU_DE_HARALD, AMULETTE];
  h.psychTraits = [{ type: 'peur' }];
  h.sinPoints = 1;
  h.talents.push({ talentId: 'magie-des-arcanes', spec: 'feu', times: 1 } as never);
  h.spells = SORTS_DE_FEU;
  h.skills.push({ id: 'savoir', spec: 'magie', characteristic: 'intelligence', advances: 5 } as never);
  h.skills.push({ id: 'metier', spec: 'forgeron', characteristic: 'dexterite', advances: 8 } as never);
  h.xp = 1000;
  if (instruit) for (const [id, spec] of INSTRUCTION) h.skills.push({ id, ...(spec ? { spec } : {}), characteristic: skillCharacteristicById(id), advances: 5 } as never);
  return h;
}

/** Un banc à Altdorf, dés d'Événement posés, sur `party`. */
function banc(party: Combatant[]): Banc {
  const b = ouvrirLeBanc({ graine: 7, desFixes: false, etat: { party, scene: SCENE, lieu: 'altdorf' } });
  b.actions.ouvrirLInterlude(3);
  draineCascade(b.getState);
  expect(b.getState().interlude?.phase, 'témoin : le tirage est dénoué').toBe('activities');
  return b;
}

const héros = (b: Banc, id: string): Combatant => b.getState().party.find((h) => h.id === id)!;

/** Les cibles que chaque Activité lit, et ce qu'elle exige d'engager avant (ouvrage, dépôt). */
const CIBLES: Record<string, (b: Banc, heroId: string) => CiblesChoisies> = {
  craft: (b, id) => { pratiquer(b.getState, id, 'craft', { ouvrage: craftCatalog()[0].id }); return {}; },
  learn: (b, id) => ({ talentId: learnableTalents(héros(b, id))[0].id }),
  identify: () => ({ itemUid: 'art-1' }),
  'tester-objets-magiques': () => ({ itemUid: 'art-1' }),
  'entrainement-arme-inhabituelle': () => ({ itemUid: 'arme-1' }),
  convalescence: () => ({ traitPsy: 'peur' }),
  mecenat: (b, id) => { b.actions.deposerALaBanque(id, 'mecenat', 1200); return { depotId: b.getState().bank[0]?.uid }; },
  'recherche-universitaire': (b, id) => ({ spellId: learnableSpells(héros(b, id)).find((x) => x.cost > 0)!.spell.id }),
};

/** ORACLES FIGÉS du Vétéran : le Test, sa valeur et sa Difficulté, lus sur sa fiche (gate de Classe LDB 23 l.197). */
const ORACLES: Record<string, { test: string; valeur: number; difficulte: Difficulty }> = {
  revenus: { test: 'Athlétisme', valeur: 42, difficulte: 'accessible' },
  craft: { test: 'Métier (Forgeron)', valeur: 41, difficulte: 'accessible' },
  learn: { test: 'Agilité', valeur: 37, difficulte: 'difficile' },
  identify: { test: 'Savoir (Magie)', valeur: 41, difficulte: 'intermediaire' },
  convalescence: { test: 'Calme', valeur: 42, difficulte: 'tresDifficile' },
  'entrainement-arme-inhabituelle': { test: 'Corps à corps', valeur: 41, difficulte: 'complexe' },
  mecenat: { test: 'Évaluation', valeur: 39, difficulte: 'intermediaire' },
  'dernieres-nouvelles': { test: 'Ragot', valeur: 36, difficulte: 'complexe' },
  'entrainement-au-combat': { test: 'Corps à corps', valeur: 41, difficulte: 'intermediaire' },
  'observer-une-cible': { test: 'Perception', valeur: 29, difficulte: 'complexe' },
  'recherche-de-savoir': { test: 'Savoir (Magie)', valeur: 41, difficulte: 'intermediaire' },
  reputation: { test: 'Athlétisme', valeur: 42, difficulte: 'complexe' },
  'semer-dissension-reperage': { test: 'Ragot', valeur: 36, difficulte: 'intermediaire' },
  leitdorf: { test: 'Corps à corps', valeur: 41, difficulte: 'complexe' },
  alcatani: { test: 'Commandement', valeur: 41, difficulte: 'complexe' },
  punchausen: { test: 'Divertissement (Narration)', valeur: 36, difficulte: 'intermediaire' },
  'remaniement-contremaitre': { test: 'Ragot', valeur: 36, difficulte: 'intermediaire' },
  mendier: { test: 'Charme', valeur: 41, difficulte: 'intermediaire' },
};

/** ORACLES FIGÉS du Vétéran INSTRUIT, sur les Activités dont le Vétéran ne peut tenter aucune voie. */
const ORACLES_INSTRUIT: Record<string, { test: string; valeur: number; difficulte: Difficulty }> = {
  penitence: { test: 'Prière', valeur: 41, difficulte: 'accessible' },
  'tester-objets-magiques': { test: 'Recherche', valeur: 41, difficulte: 'complexe' },
  'recherche-universitaire': { test: 'Recherche', valeur: 41, difficulte: 'intermediaire' },
  dressage: { test: 'Dressage', valeur: 41, difficulte: 'accessible' },
  fanmaris: { test: 'Projectiles (Arc)', valeur: 36, difficulte: 'complexe' },
  augure: { test: 'Augure', valeur: 41, difficulte: 'intermediaire' },
};

/** Le refus dit au Vétéran, sur chaque Activité dont il ne peut tenter aucune voie (LDB 09 l.30). */
const REFUS: Record<string, string> = {
  penitence: 'Vétéran ne peut pas tenter le Test de Prière.',
  'tester-objets-magiques': 'Vétéran ne peut pas tenter le Test de Recherche.',
  'recherche-universitaire': 'Vétéran ne peut pas tenter le Test de Recherche.',
  dressage: 'Vétéran ne peut pas tenter le Test de Dressage.',
  fanmaris: 'Vétéran ne peut pas tenter le Test de Projectiles (Arc).',
  augure: 'Vétéran ne peut pas tenter le Test d’Augure.',
};

/** Toutes les carrières de la donnée. */
const CARRIERES = (careers as { id: string }[]).map((c) => c.id);

/** Les Activités d'interlude jouables, et ce que la boucle des carrières a confronté. */
const OUVRABLES = activitiesFor('interlude');
const confrontees = new Set<string>();
let soutenues = 0;
let combinees = 0;

/** La Compétence de Revenus du conseiller sans Augmentation. */
const REVENUS_CONSEILLER = 'Marchandage';

/** Le pré-jet rendu de la Planification soutenue : base et cible. */
const PLANIF = { base: 46, cible: 56 };

/** Le geste qui ouvre `def` : le retrait du dépôt de Mécénat (`retirerDeLaBanque`), sinon pratiquer sa composition. */
function geste(b: Banc, heroId: string, def: ActivityDef, cibles: CiblesChoisies): void {
  if (def.resolver === 'mecenat') b.actions.retirerDeLaBanque(cibles.depotId!);
  else pratiquer(b.getState, heroId, def.id, cibles);
}

/** Ouvre `id` par son geste : le pending posé et le pré-jet que le volet lit, sur le même état. */
function ouvrir(id: string, prepare?: (b: Banc) => void, seed?: number, instruit = false) {
  const h = vétéran(seed, instruit);
  const b = banc([h]);
  prepare?.(b);
  const cibles = CIBLES[id]?.(b, h.id) ?? {};
  const def = activityById(id)!;
  const preJet = preJetDActivite(b.getState(), h.id, def, cibles);
  const journal = b.getState().journal.length;
  geste(b, h.id, def, cibles);
  return { b, h: héros(b, h.id), preJet, pa: b.getState().pendingActivity, dit: b.getState().journal.slice(journal) };
}

/** Le jet posé et le pré-jet confrontés à l'oracle : Test, valeur, Difficulté et modificateurs. */
function confronte(o: ReturnType<typeof ouvrir>, id: string, oracle: { test: string; valeur: number; difficulte: Difficulty }): void {
  const { pa, preJet } = o;
  expect(pa?.activityId, 'témoin : le geste ouvre le jet').toBe(id);
  expect({ test: pa!.skillLabel, valeur: pa!.skillValue, difficulte: pa!.difficulty }, 'jet posé').toEqual(oracle);
  expect(preJet, 'le volet a un pré-jet').toBeDefined();
  expect({ test: testSkillLabel(preJet!.test), valeur: preJet!.value, difficulte: preJet!.difficulty }, 'pré-jet').toEqual(oracle);
  expect(preJet!.mods.reduce((n, m) => n + m.value, 0), 'modificateurs').toBe(pa!.mod ?? 0);
}

describe('Pré-jet d’Activité — le volet affiche le Test que le geste pose', () => {
  it.each(Object.keys(ORACLES))('%s : voie, valeur, Difficulté et modificateurs du pré-jet == ceux du jet posé == l’oracle', (id) => {
    confronte(ouvrir(id), id, ORACLES[id]);
  });
  it.each(Object.keys(ORACLES_INSTRUIT))('%s, Vétéran instruit : le pré-jet == le jet posé == l’oracle', (id) => {
    confronte(ouvrir(id, undefined, undefined, true), id, ORACLES_INSTRUIT[id]);
  });
});

describe('Pré-jet d’Activité — aucune voie tentable : l’ouverture est refusée et le dit (LDB 09 l.30)', () => {
  it.each(Object.keys(REFUS))('%s : le Vétéran ne peut tenter aucune voie, rien ne s’ouvre, rien n’est consommé', (id) => {
    const { b, h, pa, preJet, dit } = ouvrir(id);
    expect(pa, 'aucun jet posé').toBeNull();
    expect(dit).toEqual([REFUS[id]]);
    expect(preJet?.refus, 'le pré-jet porte le même refus').toBe(REFUS[id]);
    expect(b.getState().interlude!.perHero[h.id].left, 'aucune Activité consommée').toBe(3);
  });

});

describe('Pré-jet d’Activité — la voie retenue est TENTABLE (LDB 09 l.30)', () => {
  it('Entraînement au Combat sans Projectiles : Corps à corps, même quand la Capacité de Tir nue dépasse', () => {
    // Graine 1607 : Capacité de Tir 42, Capacité de Combat 31.
    const { pa, preJet, h } = ouvrir('entrainement-au-combat', (b) => {
      const v = b.getState().party[0];
      v.skills = v.skills.filter((k) => k.id !== 'projectiles').map((k) => (k.id === 'corps-a-corps' ? { ...k, advances: 0 } : k));
      b.setState((s) => ({ party: [...s.party] }));
    }, 1607);
    expect(testValue(h, { skill: { id: 'projectiles' } }), 'témoin : la valeur nue de Projectiles dépasse Corps à corps').toBeGreaterThan(testValue(h, { skill: { id: 'corps-a-corps' } }));
    expect([pa!.chosenSkill, pa!.skillValue]).toEqual([{ id: 'corps-a-corps' }, testValue(h, { skill: { id: 'corps-a-corps' } })]);
    expect(preJet!.test).toEqual({ skill: { id: 'corps-a-corps' } });
  });
});

describe('Pré-jet d’Apprentissage — l’acharnement est un modificateur du Test (LDB 23 l.72)', () => {
  it('après une tentative ratée : Agilité 37, Difficile, +10 nommé', () => {
    const { b, h } = ouvrir('learn');
    b.actions.jetLancer('activite');
    b.setState((s) => ({ pendingActivity: { ...s.pendingActivity!, roll: 99, success: false, sl: -2 } }));
    b.actions.jetValider('activite');
    const talentId = learnableTalents(h)[0].id;
    expect(b.getState().interlude!.perHero[h.id].learnFails?.[talentId], 'témoin : une tentative ratée').toBe(1);
    const preJet = preJetDActivite(b.getState(), h.id, activityById('learn')!, { talentId })!;
    pratiquer(b.getState, h.id, 'learn', { talentId });
    const pa = b.getState().pendingActivity!;
    expect({ valeur: pa.skillValue, difficulte: pa.difficulty, mod: pa.mod, modLabel: pa.modLabel })
      .toEqual({ valeur: 37, difficulte: 'difficile', mod: 10, modLabel: 'Acharnement' });
    expect({ valeur: preJet.value, difficulte: preJet.difficulty, mods: preJet.mods.map((m) => [m.label, m.value]) })
      .toEqual({ valeur: 37, difficulte: 'difficile', mods: [['Acharnement', 10]] });
  });
});

describe('Pré-jet de préparation de bataille — la cible rendue par le volet est celle du jet posé (ADE II 8 l.75-102)', () => {
  it('Planification soutenue par le Second : Savoir (Guerre) soutenu, cible rendue == cible posée', () => {
    const instruit = (h: Combatant, advances: number) => { h.skills.push({ id: 'savoir', spec: 'guerre', characteristic: 'intelligence', advances } as never); return h; };
    const meneur = instruit(vétéran(), 10);
    const second = instruit(withBourseMoney(createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Second', seed: 1602 }), { gold: 1, silver: 0, brass: 0 }, idsDeTest), 5);
    const b = banc([meneur, second]);
    b.actions.amorcerLaBataille({ puissanceAlliee: 50, puissanceEnnemie: 55, plannedRounds: 3 });
    for (const id of [meneur.id, second.id]) b.actions.fenetreChoisir('batailleDeMasse', 'ajouterAuPoste', 'planification', id);
    const s = b.getState();
    const { ligne } = preJetDePreparation(s, s.massBattle!, héros(b, meneur.id), battleActivityById('planification')!)!.pending;
    b.actions.menerLActionDeBataille(meneur.id, 'planification');
    const pa = b.getState().pendingActivity!;
    expect(pa.support, 'témoin : le Second soutient').toMatchObject({ count: 1, ids: [second.id] });
    expect({ base: ligne.base, cible: ligne.target }).toEqual({ base: PLANIF.base, cible: PLANIF.cible });
    expect(ligne.mods, 'la ligne nomme le Soutien').toContainEqual(soutienMod(pa.support));
    expect(pa.target).toBe(PLANIF.cible);
  });

  it.each(CARRIERES)('%s : chaque préparation tentable, Soutien, Test combiné et réservoir compris', (careerId) => {
    const i = CARRIERES.indexOf(careerId);
    const instruit = (id: string, seed: number): Combatant => {
      const x = withBourseMoney(createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: id, label: id, seed }), { gold: 1, silver: 0, brass: 0 }, idsDeTest);
      x.skills.push({ id: 'savoir', spec: 'guerre', characteristic: 'intelligence', advances: 3 + (seed % 7) } as never);
      return x;
    };
    const a = instruit(careerId, 9000 + i);
    const second = instruit(CARRIERES[(i + 17) % CARRIERES.length], 9500 + i);
    const b = ouvrirLeBanc({ graine: 7, desFixes: false, etat: { party: [a, second], scene: SCENE } });
    b.actions.ouvrirLInterlude(4);
    draineCascade(b.getState);
    b.actions.amorcerLaBataille({ puissanceAlliee: 40 + (i % 30), puissanceEnnemie: 55, plannedRounds: 3 });
    // Réservoir de modificateur posé, comme un Repérage réussi le pose (ADE II 8 l.100).
    if (i % 2) b.setState((s) => ({ massBattle: { ...s.massBattle!, planningBonus: 20 } }));
    const ecarts: string[] = [];
    for (const { def } of battlePrepEntries(b.getState().massBattle!)) {
      if (def.assisted) for (const id of [a.id, second.id]) b.actions.fenetreChoisir('batailleDeMasse', 'ajouterAuPoste', def.id, id);
      const s = b.getState();
      const pj = preJetDePreparation(s, s.massBattle!, héros(b, a.id), def);
      const refus = refusDePrepaDeBataille(s.massBattle!, héros(b, a.id), def);
      b.setState(() => ({ pendingActivity: null }));
      b.actions.menerLActionDeBataille(a.id, def.id);
      const pa = b.getState().pendingActivity;
      if (!pj || !pa) { if (refus == null) ecarts.push(`${def.id} : ouverte sans refus, pré-jet ${!!pj}, jet posé ${!!pa}`); continue; }
      const affiche = { cible: pj.pending.ligne.target, cible2: pj.ligne2?.target, difficulte: pj.pending.ligne.difficulty };
      const jet = { cible: pa.target, cible2: pa.target2, difficulte: pa.difficulty };
      if (JSON.stringify(affiche) !== JSON.stringify(jet)) ecarts.push(`${def.id} affiché ${JSON.stringify(affiche)} ≠ posé ${JSON.stringify(jet)}`);
      // La ligne rendue NOMME le Soutien que la valeur posée porte (LDB 12 l.187-200).
      const soutien = soutienMod(pa.support);
      if (soutien && !pj.pending.ligne.mods.some((m) => JSON.stringify(m) === JSON.stringify(soutien))) ecarts.push(`${def.id} : Soutien absent de la ligne`);
      if (pa.support) soutenues++;
      if (pa.target2 != null) combinees++;
    }
    expect(ecarts).toEqual([]);
  });

  it('couverture : des préparations soutenues et combinées ont été confrontées', () => {
    expect(soutenues, 'Soutien').toBeGreaterThan(0);
    expect(combinees, 'Test combiné').toBeGreaterThan(0);
  });
});

describe('Pré-jet d’Activité — les `testMods` de la donnée entrent au pré-jet de TOUT volet (LDB 09 l.97)', () => {
  it('Revenus éditée au Compendium avec un modificateur de situation : le pré-jet et le jet le portent', () => {
    const revenus = { ...activityById('revenus')!, testMods: [{ mod: -10, label: 'Mauvaise saison' }] };
    avecActivite(revenus, () => {
      const { pa, preJet } = ouvrir('revenus');
      expect([pa!.mod, pa!.modLabel]).toEqual([-10, 'Mauvaise saison']);
      expect(preJet!.mods.map((m) => [m.label, m.value])).toEqual([['Mauvaise saison', -10]]);
      expect(preJet!.target).toBe(42 + 20 - 10);
    });
  });
});

/** Une variante de fiche : brute, Exténuée, sans aucune Augmentation, ou sorcier forgeron dont un Métier non
 *  augmenté précède le bon. */
function variante(careerId: string, seed: number, n: number): Combatant {
  const h = withBourseMoney(createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId, label: careerId, seed }), { gold: 30, silver: 0, brass: 0 }, idsDeTest);
  h.items = [...(h.items ?? []), COUTEAU_DE_HARALD, AMULETTE];
  h.psychTraits = [{ type: 'peur' }];
  h.sinPoints = 1;
  h.xp = 2000;
  if (n === 1) h.conditions = [{ id: 'extenue', value: 1 }];
  if (n === 2) h.skills = h.skills.map((k) => ({ ...k, advances: 0 }));
  if (n === 3) {
    h.talents.push({ talentId: 'magie-des-arcanes', spec: 'feu', times: 1 } as never);
    h.spells = SORTS_DE_FEU;
    h.skills = [
      { id: 'metier', spec: 'cartographe', characteristic: 'dexterite', advances: 0 } as never,
      ...h.skills.filter((k) => k.id !== 'metier'),
      { id: 'savoir', spec: 'magie', characteristic: 'intelligence', advances: 5 } as never,
      { id: 'metier', spec: 'forgeron', characteristic: 'dexterite', advances: 8 } as never,
    ];
  }
  return h;
}

/** Les cibles que lit l'ouverture de `def` : la première de chaque liste du noyau (`ciblesDActivite`). */
function premieresCibles(h: Combatant, def: ActivityDef): CiblesChoisies {
  const c = ciblesDActivite(h, def);
  if (def.resolver === 'learnTalent') return learnableTalents(h)[0] ? { talentId: learnableTalents(h)[0].id } : {};
  if (c.armes[0]) return { itemUid: c.armes[0].uid };
  if (c.artefacts[0]) return { itemUid: c.artefacts[0].uid };
  if (c.sorts[0]) return { spellId: c.sorts[0].spell.id };
  return c.traitsPsy[0] ? { traitPsy: c.traitsPsy[0].cle } : {};
}

/** Ouvre `def` par son geste : refusé (`refusDeLaComposition`, `refusDeRetrait`) ⇔ aucun jet ; ouvert, le pré-jet rendu par le volet == le jet posé, cible lancée comprise. */
function confronteAuVolet(b: Banc, heroId: string, def: ActivityDef, cibles: CiblesChoisies, ecarts: string[], ctx = ''): boolean {
  const s = b.getState();
  const refus = def.resolver === 'mecenat' ? refusDeRetrait(s, cibles.depotId!) : refusDeLaComposition(s, heroId, { activite: def.id, cibles, atouts: [], defauts: [] });
  const pj = preJetDActivite(s, heroId, def, cibles);
  b.setState(() => ({ pendingActivity: null }));
  geste(b, heroId, def, cibles);
  const pa = b.getState().pendingActivity;
  if (!pa || !pj) {
    if (refus == null) ecarts.push(`${ctx} ${def.id} : ouvert sans refus, pré-jet ${!!pj}, jet posé ${!!pa}`);
    return false;
  }
  if (refus != null || pj.refus != null) ecarts.push(`${ctx} ${def.id} : jet posé malgré le refus « ${refus ?? pj.refus} »`);
  b.actions.jetLancer('activite');
  const lance = b.getState().pendingActivity!;
  const affiche = { test: testSkillLabel(pj.test), valeur: pj.value, difficulte: pj.ligne.difficulty, mod: pj.mods.reduce((n, m) => n + m.value, 0), cible: pj.ligne.target };
  const jet = { test: pa.skillLabel, valeur: pa.skillValue, difficulte: pa.difficulty, mod: pa.mod ?? 0, cible: lance.target };
  if (JSON.stringify(affiche) !== JSON.stringify(jet)) ecarts.push(`${ctx} ${def.id} affiché ${JSON.stringify(affiche)} ≠ posé ${JSON.stringify(jet)}`);
  confrontees.add(def.id);
  b.setState(() => ({ pendingActivity: null }));
  return true;
}

describe('Pré-jet d’Activité — sur toute carrière et toute fiche, le volet rend le jet que le geste pose', () => {
  // Variantes : 0 brute, 1 Exténuée, 2 sans Augmentation, 3 sorcier forgeron.
  it.each(CARRIERES.flatMap((c) => [0, 1, 2, 3].map((n) => [c, n] as const)))('%s, variante %s', (careerId, n) => {
    const ecarts: string[] = [];
    {
      const h = variante(careerId, 4000 + CARRIERES.indexOf(careerId), n);
      const b = banc([h]);
      for (const def of OUVRABLES) {
        if (def.resolver === 'craftExtended' || def.resolver === 'mecenat') continue;
        if (def.resolver === 'dissensionEmeute') {
          b.setState((s) => ({ interlude: { ...s.interlude!, perHero: { ...s.interlude!.perHero, [h.id]: { ...s.interlude!.perHero[h.id], dissensionReady: true } } } }));
        }
        confronteAuVolet(b, h.id, def, premieresCibles(héros(b, h.id), def), ecarts, `v${n}`);
      }
      // Artisanat : le pré-jet d'engagement est celui de l'ouvrage une fois engagé, puis son lancer.
      const ouvrage = craftCatalog().find((o) => { const t = findTrappingById(o.id); return t && craftSpecOf(t); });
      if (metierOf(héros(b, h.id)) && ouvrage) {
        const engagement = preJetDActivite(b.getState(), h.id, activityById('craft')!, {}, { ouvrage: craftTarget(ouvrage.tier, ouvrage.avail, 0, 0) });
        pratiquer(b.getState, h.id, 'craft', { ouvrage: ouvrage.id });
        if (héros(b, h.id).craft) {
          expect(preJetDActivite(b.getState(), h.id, activityById('craft')!), `v${n} engagement`).toEqual(engagement);
          // L'ouvrage engagé se lance sur le Métier qui l'a engagé (`metierOf`, LDB 23 l.76).
          expect(confronteAuVolet(b, h.id, activityById('craft')!, {}, ecarts, `v${n}`), `v${n} lancer de l'ouvrage`).toBe(true);
        }
      }
      b.actions.deposerALaBanque(h.id, 'mecenat', 1200);
      if (b.getState().bank.length) confronteAuVolet(b, h.id, activityById('mecenat')!, { depotId: b.getState().bank[0].uid }, ecarts, `v${n}`);
    }
    expect(ecarts).toEqual([]);
  });

  it('couverture : chaque Activité qui s’ouvre par le catalogue a été confrontée', () => {
    expect(OUVRABLES.filter((d) => d.resolver !== 'entrainement' && !confrontees.has(d.id)).map((d) => d.id)).toEqual([]);
  });
});


describe('Revenus — la Compétence de carrière se tente (LDB 08 l.110, LDB 09 l.30)', () => {
  it('conseiller sans aucune Augmentation : le Test se joue sur une Compétence de Niveau 1 qu’il possède', () => {
    const h = withBourseMoney(createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'conseiller', label: 'Conseiller', seed: 4001 }), { gold: 5, silver: 0, brass: 0 }, idsDeTest);
    h.skills = h.skills.map((k) => ({ ...k, advances: 0 }));
    const b = banc([h]);
    pratiquer(b.getState, h.id, 'revenus');
    expect(b.getState().pendingActivity?.skillLabel).toBe(REVENUS_CONSEILLER);
  });
});
