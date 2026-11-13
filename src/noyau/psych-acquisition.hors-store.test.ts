import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import type { BattleState } from './etat';
import { seedBattleRng } from './battleRng';
import { setRule, resetRule } from '../engine/policy';
import type { Combatant, TerreurSubie } from '../engine/types';
import { emptyScene } from './monde/scene';
import type { CascadeStep } from './pendings';
import { applyEffects } from './combatEffects';
import { sceneFearSources } from './encounterPsychFlow';
import { presetDuNarratif } from './monde/resolveursDuNarratif';
import { groupesPercus } from '../engine/groups';
import { carryOverState } from '../engine/persistence';
import { finalizeHeroDeath } from './combatFlow';
import { applierDe } from './cascade';
import { draineEtapes, draineEtLit } from './cascade.testkit';
import { bandStep, resultLines } from './rollSeam';
import { groupLabel, psychologyLabel } from '../data';
import { t } from '../i18n';
import { ciblePsy } from '../engine/psych/ciblage';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';
import { nomDe } from '../engine/nom';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * Acquisition de Traits psychologiques — ADE II Annexe I « Troubles psychologiques » (règle facultative
 * `psycho-acquisition-optionnelle`). Vérifie le CÂBLAGE d'état (le noyau pur `ciblesDAnimositeAcquise`/`ciblesDePhobieDuNoir`
 * est testé dans engine/animosite-acquise.test et engine/phobie-du-noir.test) : dépense de Destin → Animosité/Haine ; persistance des Traits acquis.
 * Graines d100 (cf. combat/bleed-death.hors-store.test) : seedBattleRng(1) → 1ᵉʳ jet > 30 (Calme FM 30 ÉCHOUE → acquisition) ;
 * seedBattleRng(7) → 1ᵉʳ jet ≤ 10 (Calme RÉUSSIT → aucun Trait).
 */

const CHARS = { 'capacite-de-combat': 45, 'capacite-de-tir': 45, force: 40, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };

const hero = (p: Partial<Combatant> = {}): Combatant =>
  (blessuresSurLeProfil({
    id: 'h1', name: 'Hardi', kind: 'heros', characteristics: CHARS,
    wounds: blessuresDeBase(15), advantage: 0, conditions: [], movement: 4, skills: [], talents: [],
    engagedWith: [], pos: { x: 0, y: 0 }, size: 'moyenne', weapons: [], items: [], fate: 2,
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    ...p,
  }) as unknown as Combatant);

function setBattle(combatants: Combatant[], fateSave: ReturnType<typeof banc.getState>['pendingFateSave']): void {
  const battle = {
    combatants, order: combatants.map((c) => c.id), baseOrder: combatants.map((c) => c.id),
    turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as unknown as BattleState;
  banc.setState({ battle, mode: 'battle', scene: emptyScene('scene-test'), gameTime: 12 * 60, pendingCascade: null, pendingFateSave: fateSave });
}

/** Le tueur `e1`, aux Groupes déclarés `groups`. */
const adversaire = (groups: string[]) => hero({ id: 'e1', label: 'Brigand de Reikland', kind: 'ennemi', fate: 0, groups } as Partial<Combatant>);

describe('#62 — Animosité & Haine sur dépense de Destin (choix `destin.issue`)', () => {
  beforeEach(() => { setRule('psycho-acquisition-optionnelle', true); });

  const skaven = () => adversaire(['skaven']);

  it('règle ON + Calme ÉCHOUE → Animosité envers la Cible ; un 2ᵉ échec même Cible → Haine (remplace)', () => {
    setBattle([hero(), skaven()], { heroId: 'h1', source: 'hit', foeId: 'e1' });
    seedBattleRng(1); // Calme (FM 30) échoue
    banc.getState().fenetreChoisir('destin', 'issue', 'survivre');
    let got = banc.getState().battle!.combatants.find((c) => c.id === 'h1')!;
    expect(got.psychTraits).toEqual([{ type: 'animosite', cible: ciblePsy.groupe('skaven') }]);

    // Deuxième frôlement de la mort face aux mêmes Skavens → l'Animosité devient une Haine.
    setBattle([got, skaven()], { heroId: 'h1', source: 'hit', foeId: 'e1' });
    seedBattleRng(1);
    banc.getState().fenetreChoisir('destin', 'issue', 'survivre');
    got = banc.getState().battle!.combatants.find((c) => c.id === 'h1')!;
    expect(got.psychTraits).toEqual([{ type: 'haine', cible: ciblePsy.groupe('skaven') }]); // Animosité remplacée, pas doublée
  });

  it('règle ON + Calme RÉUSSIT → aucun Trait acquis', () => {
    setBattle([hero(), skaven()], { heroId: 'h1', source: 'hit', foeId: 'e1' });
    seedBattleRng(7); // Calme (FM 30) réussit
    banc.getState().fenetreChoisir('destin', 'issue', 'survivre');
    const got = banc.getState().battle!.combatants.find((c) => c.id === 'h1')!;
    expect(got.psychTraits ?? []).toEqual([]);
  });

  it('règle OFF → aucune acquisition même sur échec de Calme', () => {
    resetRule('psycho-acquisition-optionnelle'); // défaut = OFF
    setBattle([hero(), skaven()], { heroId: 'h1', source: 'hit', foeId: 'e1' });
    seedBattleRng(1);
    banc.getState().fenetreChoisir('destin', 'issue', 'survivre');
    const got = banc.getState().battle!.combatants.find((c) => c.id === 'h1')!;
    expect(got.psychTraits ?? []).toEqual([]);
  });

  it('mort lente (source slow, sans tueur) → pas d’Animosité (perte de sang, aucun individu)', () => {
    setBattle([hero()], { heroId: 'h1', source: 'slow' });
    seedBattleRng(1);
    banc.getState().fenetreChoisir('destin', 'issue', 'survivre');
    const got = banc.getState().battle!.combatants.find((c) => c.id === 'h1')!;
    expect(got.psychTraits ?? []).toEqual([]);
  });
});

describe('ADE II 09 l.15 — les Cibles qu’offre le tueur (finalizeHeroDeath → choix `destin.issue`)', () => {
  beforeEach(() => { setRule('psycho-acquisition-optionnelle', true); });

  /** Un héros humain frôle la mort sous les coups de `foe`, dépense son Destin et rate son Calme. */
  const frolerLaMort = (foe: Combatant, p: Partial<Combatant> = {}) => {
    const h = hero({ label: 'Hardi', groups: ['humain'], ...p });
    setBattle([h, foe], null);
    finalizeHeroDeath(banc.getState, banc.setState, h, 'hit', 10, foe);
    seedBattleRng(1); // Calme (FM 30) échoue
    banc.getState().fenetreChoisir('destin', 'issue', 'survivre');
  };
  const traitsDuHeros = () => banc.getState().battle!.combatants.find((c) => c.id === 'h1')!.psychTraits ?? [];

  it('une seule Cible : posée d’office, sans étape', () => {
    frolerLaMort(adversaire(['skaven']));
    expect(banc.getState().pendingCascade).toBeNull();
    expect(traitsDuHeros()).toEqual([{ type: 'animosite', cible: ciblePsy.groupe('skaven') }]);
  });

  it('tueur de même Race sans sous-groupe : l’individu, jamais son libellé (#3045)', () => {
    frolerLaMort(adversaire(['humain']));
    expect(traitsDuHeros()).toEqual([{ type: 'animosite', cible: ciblePsy.individu('e1') }]);
  });

  it('plusieurs Cibles : le joueur choisit à une étape `cibleAcquise`, la Race par défaut (Q16 A, #3045)', () => {
    frolerLaMort(adversaire(['nain', 'soldat']));
    expect(traitsDuHeros(), 'rien de posé avant le choix').toEqual([]);
    const vues = draineEtapes(banc.getState, 5, undefined, (e) => (e.kind === 'cibleAcquise' ? ciblePsy.groupe('soldat') : undefined));
    expect(vues.map((v) => v.kind)).toEqual(['cibleAcquise']);
    expect(vues[0].actorId).toBe('h1');
    expect(vues[0].options?.map((o) => o.key)).toEqual([ciblePsy.groupe('nain'), ciblePsy.groupe('soldat')]);
    expect(vues[0].defaultChoice).toBe(ciblePsy.groupe('nain'));
    expect(traitsDuHeros()).toEqual([{ type: 'animosite', cible: ciblePsy.groupe('soldat') }]);
  });

  it('l’étape pose le Trait, dit sa ligne au journal, et republie les acteurs', () => {
    frolerLaMort(adversaire(['nain', 'soldat']));
    const avant = banc.getState().battle!.combatants;
    const lu = draineEtLit(banc.getState);
    expect(lu).toContain(t('cs.animositeGain', { name: 'Hardi', groupe: groupLabel('nain') }));
    expect(banc.getState().battle!.combatants).not.toBe(avant);
  });

  it('une Animosité acquise laisse les Terreurs subies', () => {
    const avant: TerreurSubie[] = [{ brise: 1, groupes: ['skaven'] }];
    frolerLaMort(adversaire(['skaven']), { terreursSubies: avant });
    expect(traitsDuHeros()).toEqual([{ type: 'animosite', cible: ciblePsy.groupe('skaven') }]);
    expect(banc.getState().battle!.combatants.find((c) => c.id === 'h1')!.terreursSubies).toEqual(avant);
  });

  /** L'étape `cibleAcquise` en attente après le frôlement de la mort du héros face à un tueur à deux Cibles. */
  const etapeEnAttente = (): CascadeStep => {
    frolerLaMort(adversaire(['nain', 'soldat']));
    return banc.getState().pendingCascade!.participants.find((e) => e.kind === 'cibleAcquise')!;
  };
  const appliquer = (step: CascadeStep, porteur: Combatant | undefined) =>
    resultLines(applierDe('cibleAcquise')!(banc.getState, banc.setState, step, porteur, { steps: [step], index: 0 })?.consequences ?? []).map((l) => l.text);

  it('une Cible hors des options : aucun Trait, la ligne le dit', () => {
    const step = etapeEnAttente();
    const h = banc.getState().battle!.combatants.find((c) => c.id === 'h1')!;
    expect(appliquer({ ...step, chosen: ciblePsy.groupe('skaven') }, h)).toEqual([t('op.cibleAcquiseAbsente', { name: 'Hardi' })]);
    expect(traitsDuHeros()).toEqual([]);
  });

  it('un porteur absent ou mort : la conséquence n’est pas appliquée (`cascade.cibleDisparue`)', () => {
    const step = { ...etapeEnAttente(), chosen: ciblePsy.groupe('nain') };
    const disparue = [t('cascade.cibleDisparue', { label: step.label ?? '' })];
    expect(appliquer(step, undefined)).toEqual(disparue);
    const h = banc.getState().battle!.combatants.find((c) => c.id === 'h1')!;
    expect(appliquer(step, { ...h, dead: true })).toEqual(disparue);
    expect(traitsDuHeros()).toEqual([]);
  });

  it('l’étape dit, à chaque Cible, le Trait qu’elle donnera : Haine envers une Animosité déjà possédée', () => {
    frolerLaMort(adversaire(['nain', 'soldat']), { psychTraits: [{ type: 'animosite', cible: ciblePsy.groupe('soldat') }] });
    const etape = banc.getState().pendingCascade!.participants.find((e) => e.kind === 'cibleAcquise')!;
    expect(etape.label).toBe(t('step.cibleAcquise', { name: 'Hardi' }));
    expect(etape.options?.map((o) => [o.key, o.detail])).toEqual([
      [ciblePsy.groupe('nain'), psychologyLabel('animosite')],
      [ciblePsy.groupe('soldat'), psychologyLabel('haine')],
    ]);
  });

  it('une Animosité suspendue par un effet devient Haine, et ne revient pas à la fin de l’effet', () => {
    const suspendue = { type: 'animosite' as const, cible: ciblePsy.groupe('skaven') };
    frolerLaMort(adversaire(['skaven']), { activeEffects: [{ id: 'baume', suppressedPsych: [suspendue] }] as never });
    const h = banc.getState().battle!.combatants.find((c) => c.id === 'h1')!;
    expect(h.psychTraits).toEqual([{ type: 'haine', cible: ciblePsy.groupe('skaven') }]);
    expect(h.activeEffects?.[0].suppressedPsych).toEqual([]);
  });

  it('une Animosité devenue Haine désactive son affliction active', () => {
    const animosite = { type: 'animosite' as const, cible: ciblePsy.groupe('skaven') };
    frolerLaMort(adversaire(['skaven']), { psychTraits: [animosite], psychState: [{ ...animosite, active: true }] });
    const h = banc.getState().battle!.combatants.find((c) => c.id === 'h1')!;
    expect(h.psychTraits).toEqual([{ type: 'haine', cible: ciblePsy.groupe('skaven') }]);
    expect(h.psychState?.find((a) => a.type === 'animosite')?.active).toBe(false);
  });

  it('un porteur non surfacé prend la Cible par défaut, sans étape', () => {
    frolerLaMort(adversaire(['nain', 'soldat']), { aiControlled: true });
    expect(banc.getState().pendingCascade).toBeNull();
    expect(traitsDuHeros()).toEqual([{ type: 'animosite', cible: ciblePsy.groupe('nain') }]);
  });
});

describe('ADE II 09 l.9-11 — Phobie du noir en combat (bande `psychologieDeCombat`, Terreur ratée)', () => {
  beforeEach(() => { setRule('psycho-acquisition-optionnelle', true); });

  /** Les `porteurs` du combat ratent leur Calme de 1 DR face à `foe` (Terreur 1 → 2 Brisé), en une bande ;
   *  `result` en donne un autre. */
  const bandeRatee = (foe: Combatant, porteurs: readonly string[], result = { success: false, sl: -1 }) => {
    const decl = { kind: 'terreur' as const, sourceId: foe.id, sourceName: nomDe(foe), indice: 1, round: banc.getState().battle!.round };
    const step = bandStep({ id: `psychologieDeCombat-${foe.id}`, kind: 'psychologieDeCombat', psychologieDeCombat: decl }, porteurs.map((id) => ({ id, interactive: true, result }) as never))!;
    applierDe(step.kind)!(banc.getState, banc.setState, step, undefined, { steps: [step], index: 0 });
    return step;
  };
  const porteur = (id: string) => () => banc.getState().battle!.combatants.find((c) => c.id === id)!;
  /** Le héros (FM 30 → BFM 3, Terreurs déjà subies `avant`) rate son Calme face à `foe`. */
  const terreurRatee = (foe: Combatant, avant: TerreurSubie[]) => {
    setBattle([hero({ label: 'Hardi', terreursSubies: avant }), foe], null);
    const step = bandeRatee(foe, ['h1']);
    return { h: porteur('h1'), lignes: step.participants![0].outcome?.map((l) => l.text) ?? [] };
  };
  const source = (groups: string[]) => hero({ id: 'e1', label: 'Spectre', kind: 'ennemi', fate: 0, groups } as Partial<Combatant>);

  it('une seule cause : Phobie sur l’id de Groupe, journal au libellé, Terreurs vidées', () => {
    const { h, lignes } = terreurRatee(source(['mort-vivant']), [{ brise: 2, groupes: ['mort-vivant'] }]);
    expect(h().psychTraits).toEqual([{ type: 'phobie', cible: ciblePsy.groupe('mort-vivant') }]);
    expect(h().terreursSubies).toEqual([]);
    expect(lignes).toContain(t('cf.phobieAcquise', { name: 'Hardi', groupe: groupLabel('mort-vivant') }));
    expect(groupLabel('mort-vivant')).not.toBe('mort-vivant');
  });

  it('sous le seuil : la Terreur est mémorisée avec les Groupes perçus de sa source', () => {
    const { h } = terreurRatee(source(['mort-vivant']), []);
    expect(h().psychTraits ?? []).toEqual([]);
    expect(h().terreursSubies).toEqual([{ brise: 2, groupes: ['mort-vivant'] }]);
  });

  it('une Terreur résistée (Calme réussi, aucun Brisé) ne se mémorise pas (#3045)', () => {
    const avant: TerreurSubie[] = [{ brise: 1, groupes: ['skaven'] }];
    const foe = source(['mort-vivant']);
    setBattle([hero({ label: 'Hardi', terreursSubies: avant }), foe], null);
    bandeRatee(foe, ['h1'], { success: true, sl: 2 });
    expect(porteur('h1')().terreursSubies).toEqual(avant);
    expect(porteur('h1')().conditions.some((c) => c.id === 'brise')).toBe(false);
  });

  it('règle éteinte : aucune Terreur mémorisée', () => {
    resetRule('psycho-acquisition-optionnelle');
    const { h } = terreurRatee(source(['mort-vivant']), []);
    expect(h().terreursSubies).toEqual([]);
    expect(h().conditions.some((c) => c.id === 'brise')).toBe(true);
  });

  it('les Groupes PERÇUS de la source : un Trait dissimulé ne se mémorise pas', () => {
    const { h } = terreurRatee(hero({ id: 'e1', label: 'Spectre', kind: 'ennemi', fate: 0, groups: ['mort-vivant'], traits: [{ id: 'demoniaque', hidden: true }] } as Partial<Combatant>), []);
    expect(h().terreursSubies).toEqual([{ brise: 2, groupes: ['mort-vivant'] }]);
  });

  it('source sans Groupe → aucune Phobie, Terreurs conservées', () => {
    const { h } = terreurRatee(source([]), [{ brise: 2, groupes: [] }]);
    expect(h().psychTraits ?? []).toEqual([]);
    expect(h().terreursSubies).toEqual([{ brise: 2, groupes: [] }, { brise: 2, groupes: [] }]);
  });

  it('la plus récente ou la plus fréquente : le joueur choisit à une étape `cibleAcquise` (#3045)', () => {
    const { h } = terreurRatee(source(['mort-vivant']), [{ brise: 1, groupes: ['skaven'] }, { brise: 1, groupes: ['skaven'] }]);
    const vues = draineEtapes(banc.getState, 5, undefined, (e) => (e.kind === 'cibleAcquise' ? ciblePsy.groupe('skaven') : undefined));
    expect(vues.map((v) => v.kind)).toEqual(['cibleAcquise']);
    expect(vues[0].options?.map((o) => o.key)).toEqual([ciblePsy.groupe('mort-vivant'), ciblePsy.groupe('skaven')]);
    expect(vues[0].defaultChoice).toBe(ciblePsy.groupe('mort-vivant'));
    expect(h().psychTraits).toEqual([{ type: 'phobie', cible: ciblePsy.groupe('skaven') }]);
    expect(h().terreursSubies).toEqual([]);
  });

  it('la mémoire se vide dès l’étape poussée : une 2ᵉ Terreur avant le choix compte pour la suivante', () => {
    const [spectre, rat] = [source(['mort-vivant']), hero({ id: 'e2', label: 'Rat géant', kind: 'ennemi', fate: 0, groups: ['skaven'] } as Partial<Combatant>)];
    setBattle([hero({ label: 'Hardi', terreursSubies: [{ brise: 1, groupes: ['skaven'] }, { brise: 1, groupes: ['skaven'] }] }), spectre, rat], null);
    const h = porteur('h1');
    bandeRatee(spectre, ['h1']);
    expect(h().terreursSubies, 'vidée à la poussée').toEqual([]);
    bandeRatee(rat, ['h1']);
    expect(h().terreursSubies).toEqual([{ brise: 2, groupes: ['skaven'] }]);
    const vues = draineEtapes(banc.getState, 5);
    expect(vues.map((v) => v.kind)).toEqual(['cibleAcquise']);
    expect(h().psychTraits).toEqual([{ type: 'phobie', cible: ciblePsy.groupe('mort-vivant') }]);
    expect(h().terreursSubies, 'la 2ᵉ Terreur reste au compteur').toEqual([{ brise: 2, groupes: ['skaven'] }]);
  });

  it('plusieurs porteurs dans une bande : chacun sa mémoire, son étape et sa Phobie', () => {
    const foe = source(['mort-vivant']);
    setBattle([
      hero({ label: 'Hardi', terreursSubies: [{ brise: 1, groupes: ['skaven'] }, { brise: 1, groupes: ['skaven'] }] }),
      hero({ id: 'h2', label: 'Brave', terreursSubies: [{ brise: 1, groupes: ['skaven'] }] }),
      hero({ id: 'h3', label: 'Prudent', terreursSubies: [] }),
      foe,
    ], null);
    bandeRatee(foe, ['h1', 'h2', 'h3']);
    expect(porteur('h3')().terreursSubies, 'sous le seuil').toEqual([{ brise: 2, groupes: ['mort-vivant'] }]);
    const vues = draineEtapes(banc.getState, 5, undefined, (e) => (e.actorId === 'h1' ? ciblePsy.groupe('skaven') : undefined));
    expect(vues.map((v) => [v.kind, v.actorId])).toEqual([['cibleAcquise', 'h1'], ['cibleAcquise', 'h2']]);
    expect(porteur('h1')().psychTraits).toEqual([{ type: 'phobie', cible: ciblePsy.groupe('skaven') }]);
    expect(porteur('h2')().psychTraits).toEqual([{ type: 'phobie', cible: ciblePsy.groupe('mort-vivant') }]);
    expect(porteur('h3')().psychTraits ?? []).toEqual([]);
    expect([porteur('h1')().terreursSubies, porteur('h2')().terreursSubies]).toEqual([[], []]);
  });
});

describe('ADE II 09 l.9-11 — Phobie du noir hors combat (Terreur d’auteur `inflictPsychology`, #3045)', () => {
  beforeEach(() => { setRule('psycho-acquisition-optionnelle', true); });

  /** Le héros (FM 30, Terreurs déjà subies `avant`) rate son Calme (d100 = 100) face à une Terreur d'auteur. */
  const terreurDAuteur = (avant: TerreurSubie[]) => {
    banc.setState({ battle: null, mode: 'exploration', journal: [], pendingCascade: null, party: [hero({ label: 'Hardi', terreursSubies: avant })] });
    applyEffects(banc.getState, banc.setState, [{ type: 'inflictPsychology', kind: 'terreur', indice: 1, label: 'Un hurlement dans la nuit', target: 'heros', heroId: 'h1' }]);
    draineEtapes(banc.getState, 5, () => 100);
    return banc.getState().party[0];
  };

  it('une Terreur causée par un PNJ de la scène mémorise ses Groupes perçus', () => {
    const scene = { ...emptyScene('scene-banshee', 20, 20), entities: [{ id: 'banshee-1', kind: 'personnage', creature: { id: 'banshee' }, pos: { x: 5, y: 5 } }] } as never;
    banc.setState({ battle: null, mode: 'exploration', journal: [], pendingCascade: null, scene, party: [hero({ label: 'Hardi', characteristics: { ...CHARS, 'force-mentale': 90 }, terreursSubies: [] })] });
    const [banshee] = sceneFearSources(banc.getState().scene!, presetDuNarratif(banc.getState().campaignNarratif));
    const groupes = groupesPercus(banshee);
    expect(groupes.length).toBeGreaterThan(0);
    const decl = { kind: 'terreur' as const, sourceId: banshee.id, sourceName: nomDe(banshee), indice: 1 };
    const step = bandStep({ id: 'psychologieDeRencontre', kind: 'psychologieDeRencontre', psychologieDeRencontre: decl }, [{ id: 'h1', interactive: true, result: { success: false, sl: -1 } } as never])!;
    applierDe(step.kind)!(banc.getState, banc.setState, step, undefined, { steps: [step], index: 0 });
    expect(banc.getState().party[0].terreursSubies).toEqual([{ brise: 2, groupes }]);
  });

  it('ses États Brisé se mémorisent, sans Groupe', () => {
    const h = terreurDAuteur([]);
    const brise = h.conditions.find((c) => c.id === 'brise')?.value ?? 0;
    expect(brise).toBeGreaterThan(0);
    expect(h.terreursSubies).toEqual([{ brise, groupes: [] }]);
    expect(h.psychTraits ?? []).toEqual([]);
  });

  it('au seuil, la Phobie vient d’une cause mémorisée qui offre un Groupe', () => {
    const h = terreurDAuteur([{ brise: 1, groupes: ['skaven'] }]);
    expect(h.psychTraits).toEqual([{ type: 'phobie', cible: ciblePsy.groupe('skaven') }]);
    expect(h.terreursSubies).toEqual([]);
    const ligne = t('cf.phobieAcquise', { name: 'Hardi', groupe: groupLabel('skaven') });
    expect(banc.getState().journal.some((l) => l.startsWith(ligne)), ligne).toBe(true);
  });
});

describe('#62 — Trauma sur Ambition anéantie (Effet d’auteur `ambitionLost`)', () => {
  beforeEach(() => { banc.setState({ battle: null, mode: 'exploration', journal: [] }); });

  it('règle ON + Calme Accessible (+20) ÉCHOUE → Trauma posé sur le héros visé', () => {
    setRule('psycho-acquisition-optionnelle', true);
    const h = hero({ id: 'h1', characteristics: { ...CHARS, 'force-mentale': 10 } }); // Calme +20 → cible 30
    banc.setState({ party: [h] });
    seedBattleRng(1); // 1ᵉʳ jet > 30 → Calme échoue
    applyEffects(banc.getState, banc.setState, [{ type: 'ambitionLost', heroId: 'h1' }]);
    expect(banc.getState().party[0].psychTraits).toEqual([{ type: 'trauma' }]);
  });

  it('règle OFF → effet inerte (aucun Trauma)', () => {
    const h = hero({ id: 'h1' });
    banc.setState({ party: [h] });
    seedBattleRng(1);
    applyEffects(banc.getState, banc.setState, [{ type: 'ambitionLost', heroId: 'h1' }]);
    expect(banc.getState().party[0].psychTraits ?? []).toEqual([]);
  });
});

describe('#62 — persistance des Traits psy acquis + Terreurs subies (writeback de combat)', () => {
  it('carryOverState reporte psychTraits acquis SANS mutation + les Terreurs subies', () => {
    const h = hero({ psychTraits: [{ type: 'phobie', cible: ciblePsy.groupe('mort-vivant') }], terreursSubies: [{ brise: 2, groupes: ['skaven'] }] });
    const co = carryOverState(h);
    expect(co.psychTraits).toEqual([{ type: 'phobie', cible: ciblePsy.groupe('mort-vivant') }]);
    expect(co.terreursSubies).toEqual([{ brise: 2, groupes: ['skaven'] }]);
  });

  it('carryOverState : le combattant EST le héros — un compteur absent revient absent (#2312)', () => {
    expect(carryOverState(hero({})).terreursSubies).toBeUndefined();
    expect(carryOverState(hero({ psychTraits: [] })).psychTraits).toEqual([]);
  });
});
