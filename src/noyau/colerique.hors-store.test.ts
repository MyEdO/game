/**
 * COLÉRIQUE, de bout en bout sans store (#1463 β2) : le palier se choisit au DR, la personne se désigne,
 * l'amitié ouvre le Test de Calme Accessible, la durée suit le palier et l'horloge retire le Trait.
 * VDM 10 l.324-332. Décideur non surfacé et lecture d'« amis » : #3045.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { draineEtapes } from './cascade.testkit';
import { groupeDeScenario, type RoleDeScenario } from '../scenes/test-scenarios/_heros';
import { testScene } from '../scenes/test-fixture';
import { testScenarios } from '../scenes/test-scenarios';
import { lancementDuScenario } from '../scenes/test-scenarios/_shared';
import { lancerLeScenario } from './lancementDeScenario';
import { combattantEnVue, connaissanceDuGroupe, entiteConnue, nomDejaVu } from './visionDuGroupe';
import { personneDuDecideurAuto, personnesCandidates, personnesConnues } from './personneChoisie';
import { runCombatFlow } from './combat/triggeredTest';
import { buildEncounter } from './monde/encounterAuthoring';
import { emptyScene } from './monde/scene';
import { castSpell } from './combatFlow';
import { resolveFormula } from '../engine/ops';
import { desDuTest } from '../engine/dice.testkit';
import { MINUTES_PER_DAY } from '../engine/clock';
import { ciblePsy } from '../engine/psych/ciblage';
import type { Combatant } from '../engine/types';
import type { CascadeStep } from './pendings';

const SOURCE = { kind: 'sort', id: 'colerique' } as const;
const HEURE = 60;

/** Ce que tranche le joueur : le palier (Haine, Animosité), la personne, le dé du Test de Calme. */
interface Gestes { haine?: boolean; animosite?: boolean; personne?: string; calme?: number }

function reussirLIncantation(banc: Banc, dr: number): void {
  if (!banc.getState().pendingCast!.result) banc.getState().jetLancer('incantation');
  const pc = banc.getState().pendingCast!;
  banc.setState({ pendingCast: { ...pc, result: { ...pc.result!, cast: true, sl: dr, isCritical: false, isFumble: false } } });
  banc.getState().jetValider('incantation');
}

/** L'incantation ouverte réussit à `dr` DR, puis la cascade se joue selon `gestes` ; rend ses étapes. */
function reussirEtJouer(banc: Banc, dr: number, gestes: Gestes = {}): CascadeStep[] {
  reussirLIncantation(banc, dr);
  const oui = (v: boolean | undefined) => (v ? 'oui' : 'non');
  return draineEtapes(banc.getState, 20, (e) => (e.kind === 'testDeclenche' ? gestes.calme : undefined), (e) => {
    if (e.kind === 'personneChoisie') {
      if (gestes.personne === undefined) return undefined;
      const option = e.options?.find((o) => o.label === gestes.personne);
      if (!option) throw new Error(`Personne non offerte : ${gestes.personne}`);
      return option.key;
    }
    if (e.kind !== 'choixDeclenche') return undefined;
    return e.label?.includes('Haine') ? oui(gestes.haine) : oui(gestes.animosite);
  });
}

const genres = (vues: CascadeStep[]) => vues.map((v) => v.kind);
const bfm = (lanceur: Combatant) => resolveFormula({ bonusOf: 'force-mentale' }, lanceur, desDuTest);
/** Les Traits accordés par Colérique, et l'échéance de leur effet porteur. */
const accordes = (c: Combatant) => ({
  traits: (c.psychTraits ?? []).filter((p) => p.src?.id === SOURCE.id),
  echeances: (c.activeEffects ?? []).filter((e) => e.grantedPsychTrait).map((e) => (e.duration.scale === 'clock' ? e.duration.until : null)),
});

describe('Colérique hors combat — le lanceur du groupe tranche tout (VDM 10 l.324-330)', () => {
  function auCamp() {
    const [w, s, p] = groupeDeScenario(idsDeTest, 'sorcier', 'soldat', 'pretre');
    w.spells = [...(w.spells ?? []), SOURCE.id];
    const banc = ouvrirLeBanc({ graine: 7, etat: { party: [w, s, p] } });
    banc.getState().incanterLeSort(w.id, 'colerique', s.id);
    const heros = (id: string) => banc.getState().party.find((c) => c.id === id)!;
    return { banc, w, s, p, heros, maintenant: banc.getState().gameTime };
  }

  it('DR 2 : aucun palier à choisir ; Préjugé envers la personne désignée, (BFM) heures', () => {
    const { banc, w, s, p, heros, maintenant } = auCamp();
    const vues = reussirEtJouer(banc, 2, { personne: p.label, calme: 100 });
    expect(genres(vues)).toEqual(['personneChoisie', 'testDeclenche']);
    expect(vues[0].actorId, 'le lanceur désigne').toBe(w.id);
    expect(vues[0].options?.map((o) => o.label), 'une autre personne que la cible').toEqual([w.label, p.label]);
    expect(accordes(heros(s.id))).toEqual({
      traits: [{ type: 'prejuge', cible: ciblePsy.individu(p.id), src: SOURCE }],
      echeances: [maintenant + bfm(w) * HEURE],
    });
  });

  it('les deux personnes sont amies : le Test de Calme Accessible réussi annule le Sort', () => {
    const { banc, s, p, heros } = auCamp();
    const vues = reussirEtJouer(banc, 2, { personne: p.label, calme: 1 });
    const test = vues.find((v) => v.kind === 'testDeclenche')!;
    expect(test.actorId, 'la cible résiste').toBe(s.id);
    expect(test.difficulty).toBe('accessible');
    expect(accordes(heros(s.id))).toEqual({ traits: [], echeances: [] });
  });

  it('DR 5 : l’Animosité se choisit, (BFM) jours', () => {
    const { banc, w, s, p, heros, maintenant } = auCamp();
    const vues = reussirEtJouer(banc, 5, { animosite: true, personne: p.label, calme: 100 });
    expect(genres(vues)).toEqual(['choixDeclenche', 'personneChoisie', 'testDeclenche']);
    expect(vues[0].actorId).toBe(w.id);
    expect(accordes(heros(s.id))).toEqual({
      traits: [{ type: 'animosite', cible: ciblePsy.individu(p.id), src: SOURCE }],
      echeances: [maintenant + bfm(w) * 24 * HEURE],
    });
  });

  it('DR 5, Animosité refusée : le Préjugé reste', () => {
    const { banc, s, p, heros } = auCamp();
    reussirEtJouer(banc, 5, { animosite: false, personne: p.label, calme: 100 });
    expect(accordes(heros(s.id)).traits.map((t) => t.type)).toEqual(['prejuge']);
  });

  it('DR 9 : la Haine se choisit, (BFM) semaines', () => {
    const { banc, w, s, p, heros, maintenant } = auCamp();
    reussirEtJouer(banc, 9, { haine: true, personne: p.label, calme: 100 });
    expect(accordes(heros(s.id))).toEqual({
      traits: [{ type: 'haine', cible: ciblePsy.individu(p.id), src: SOURCE }],
      echeances: [maintenant + bfm(w) * 8 * MINUTES_PER_DAY],
    });
  });

  it('DR 9, Haine refusée : l’Animosité s’offre encore', () => {
    const { banc, s, p, heros } = auCamp();
    const vues = reussirEtJouer(banc, 9, { haine: false, animosite: true, personne: p.label, calme: 100 });
    expect(genres(vues)).toEqual(['choixDeclenche', 'choixDeclenche', 'personneChoisie', 'testDeclenche']);
    expect(accordes(heros(s.id)).traits.map((t) => t.type)).toEqual(['animosite']);
  });

  it('l’échéance d’horloge retire le Trait (VDM 10 l.332)', () => {
    const { banc, w, s, p, heros } = auCamp();
    reussirEtJouer(banc, 2, { personne: p.label, calme: 100 });
    banc.getState().avancerLHorloge(bfm(w) * HEURE - 1);
    expect(accordes(heros(s.id)).traits).toHaveLength(1);
    banc.getState().avancerLHorloge(1);
    expect(accordes(heros(s.id))).toEqual({ traits: [], echeances: [] });
  });
});

describe('Colérique en combat', () => {
  function enCombat(lanceur: RoleDeScenario) {
    const [a, s, p] = groupeDeScenario(idsDeTest, lanceur, 'soldat', 'pretre');
    const banc = ouvrirLeBanc({ graine: 7, etat: { party: [a, s, p] } });
    banc.getState().lancerLaScene(testScene());
    banc.getState().lancerLeCombat('enc-mutants');
    banc.getState().fenetreValider('debutDuRound');
    banc.abandonner();
    const b = banc.getState().battle!;
    const [e0, e1, e2] = b.combatants.filter((c) => c.kind === 'ennemi');
    const de = (id: string) => b.combatants.find((c) => c.id === id)!;
    de(a.id).pos = { x: 5, y: 15 };
    de(s.id).pos = { x: 5, y: 11 };
    de(p.id).pos = { x: 5, y: 12 };
    e0.pos = { x: 6, y: 10 };
    e1.pos = { x: 7, y: 10 };
    e1.label = 'Mutant du gué';
    e2.pos = { x: 6, y: 13 };
    return { banc, de, a: de(a.id), s: de(s.id), p: de(p.id), e0, e1 };
  }

  it('un héros vise un Mutant envers un héros : pas d’amis, pas de Test de Calme', () => {
    const { banc, a, e0, e1 } = enCombat('sorcier');
    castSpell(banc.getState, banc.setState, a, e0, 'colerique');
    const vues = reussirEtJouer(banc, 9, { haine: true, personne: a.label });
    const designation = vues.find((v) => v.kind === 'personneChoisie')!;
    const defaut = designation.options?.find((o) => o.key === designation.defaultChoice);
    expect(defaut?.label, 'la proposition par défaut est l’allié le plus proche en vue').toBe(e1.label);
    expect(genres(vues)).not.toContain('testDeclenche');
    expect(accordes(e0).traits).toEqual([{ type: 'haine', cible: ciblePsy.individu(a.id), src: SOURCE }]);
  });

  it('un lanceur PNJ désigne l’allié le plus proche de la cible et prend le palier le plus haut (#3045)', () => {
    const { banc, s, p, e0 } = enCombat('chasseur');
    e0.skills.push({ id: 'langue', spec: 'magick', characteristic: 'intelligence', advances: 30 } as never);
    castSpell(banc.getState, banc.setState, e0, s, 'colerique');
    const vues = reussirEtJouer(banc, 9, { calme: 100 });
    expect(genres(vues), 'rien ne se surface au camp des héros, sinon le Test de la cible').toEqual(['testDeclenche']);
    expect(accordes(s).traits).toEqual([{ type: 'haine', cible: ciblePsy.individu(p.id), src: SOURCE }]);
  });

  it('un lanceur PNJ sans allié de la cible à désigner : le Trait reste sans effet', () => {
    const [s] = groupeDeScenario(idsDeTest, 'soldat');
    const banc = ouvrirLeBanc({ graine: 7, etat: { party: [s] } });
    banc.getState().lancerLaScene(testScene());
    banc.getState().lancerLeCombat('enc-mutants');
    banc.getState().fenetreValider('debutDuRound');
    banc.abandonner();
    const b = banc.getState().battle!;
    const S = b.combatants.find((c) => c.id === s.id)!;
    const e0 = b.combatants.find((c) => c.kind === 'ennemi')!;
    S.pos = { x: 5, y: 11 };
    e0.pos = { x: 6, y: 11 };
    e0.skills.push({ id: 'langue', spec: 'magick', characteristic: 'intelligence', advances: 30 } as never);
    castSpell(banc.getState, banc.setState, e0, S, 'colerique');
    reussirEtJouer(banc, 9);
    expect(accordes(S)).toEqual({ traits: [], echeances: [] });
    expect(banc.getState().battle!.log.map((l) => l.entree.texte)).toContain('Colérique : aucune personne à désigner pour Soldat, sans effet.');
  });
});

describe('Colérique — la personne désignée par le groupe (#4017)', () => {
  it('conserve en exploration le nom découvert pendant le combat d’une ancienne embusquée', () => {
    const [lanceur, cible] = groupeDeScenario(idsDeTest, 'sorcier', 'soldat');
    lanceur.spells = [...(lanceur.spells ?? []), 'colerique'];
    const banc = ouvrirLeBanc({ etat: { party: [lanceur, cible] } });
    const scene = emptyScene('ancienne-embuscade-colerique', 60, 16);
    const rencontre = buildEncounter({
      id: 'ancienne-embuscade', hidden: true,
      enemies: [{ creature: { id: 'humain' }, pos: { x: 7, y: 10 }, label: 'Ancienne embusquée' }],
    });
    const [autre] = rencontre.entities;
    const sentinelle = { ...autre, id: 'sentinelle-jamais-vue', label: 'Sentinelle jamais vue', pos: { x: 7, y: 11 } };
    scene.entities = [testScene().entities[0], autre, sentinelle];
    scene.encounters = [rencontre.encounter];
    banc.getState().lancerLaScene(scene);
    expect(nomDejaVu(banc.getState(), autre.id)).toBeUndefined();
    banc.getState().lancerLeCombat(rencontre.encounter.id);
    expect(nomDejaVu(banc.getState(), autre.id)).toBe(autre.label);
    expect(nomDejaVu(banc.getState(), sentinelle.id)).toBeUndefined();
    banc.abandonner();

    const repliee = { ...autre, pos: { x: 58, y: 13 } };
    const courante = banc.getState().scene!;
    banc.setState({ battle: null, mode: 'exploration', pendingCascade: null,
      scene: { ...courante, entities: courante.entities.map((e) => e.id === autre.id ? repliee : e) } });
    expect(entiteConnue(banc.getState(), repliee)).toBe(false);
    expect(personnesConnues(banc.getState(), cible).find((p) => p.id === autre.id)).toMatchObject({ label: autre.label });
    expect(personnesConnues(banc.getState(), cible).some((p) => p.id === sentinelle.id)).toBe(false);
    banc.getState().incanterLeSort(lanceur.id, 'colerique', cible.id);
    reussirEtJouer(banc, 2, { personne: autre.label });
    expect(accordes(banc.getState().party.find((c) => c.id === cible.id)!).traits).toContainEqual({
      type: 'prejuge', cible: ciblePsy.individu(autre.id), src: SOURCE,
    });
  });

  it('en cadence auto, le lanceur tenu par un joueur délègue son choix parmi les personnes connues', () => {
    const banc = ouvrirLeBanc({ cadence: 'auto' });
    const scenario = testScenarios.find((s) => s.id === 'siege-enceinte')!;
    lancerLeScenario(banc.getState, banc.setState, lancementDuScenario(scenario, idsDeTest));
    banc.abandonner();
    const etat = banc.getState();
    const battle = etat.battle!;
    const lanceur = battle.combatants.find((c) => c.id === 'sorcier-de-test')!;
    const adversaire = battle.combatants.find((c) => c.id === 'personnage-7')!;
    const cible = { ...adversaire, pos: { x: 16, y: 44, z: 0 } };
    const jamaisVu = { ...adversaire, id: 'personne-inconnue-auto', pos: { x: 13, y: 32, z: 0 } };
    banc.setState({ battle: { ...battle, combatants: [lanceur, cible, jamaisVu] } });

    expect(combattantEnVue(banc.getState(), jamaisVu)).toBe(false);
    expect(personneDuDecideurAuto(cible, personnesCandidates(banc.getState(), cible))?.id).toBe(jamaisVu.id);
    expect(personnesConnues(banc.getState(), cible).map((p) => p.id)).toEqual([lanceur.id]);
    runCombatFlow({
      get: banc.getState, set: banc.setState, caster: lanceur, target: cible, label: 'Colérique', opsCtx: { source: SOURCE },
    }, { kind: 'effet', effet: { type: 'ops', ops: [{ op: 'grantPsychTrait', psychType: { id: 'prejuge' }, envers: 'personneChoisie' }] } });
    expect(banc.getState().pendingCascade?.participants.some((e) => e.kind === 'personneChoisie') ?? false).toBe(false);
    expect(accordes(cible).traits).toEqual([
      { type: 'prejuge', cible: ciblePsy.individu(lanceur.id), src: SOURCE },
    ]);
  });

  it('offre le dernier nom vu et une clé de choix sans lien avec la case de combat', () => {
    const banc = ouvrirLeBanc();
    const scenario = testScenarios.find((s) => s.id === 'siege-enceinte')!;
    lancerLeScenario(banc.getState, banc.setState, lancementDuScenario(scenario, idsDeTest));
    const jeu = banc.getState;
    const parId = (id: string) => jeu().battle!.combatants.find((c) => c.id === id)!;
    const sorcier = parId('sorcier-de-test');
    const soldat = parId('soldat-de-test');
    const visible = parId('personnage-7');
    const cache = parId('personnage-5');
    const caseCachee = cache.pos!;
    const caseVue = { x: 16, y: 44, z: 0 };
    const nomVu = 'Témoin aperçu';
    const nomCache = 'Témoin renommé hors de vue';
    const jamaisVu = { ...cache, id: 'personne-jamais-vue', label: 'Personne jamais vue' };
    const deplacer = (c: Combatant, pos: NonNullable<Combatant['pos']>) => {
      const battle = jeu().battle!;
      banc.setState({ battle: { ...battle, combatants: battle.combatants.map((x) => (x.id === c.id ? { ...x, pos } : x)) } });
    };
    deplacer(soldat, caseCachee);
    deplacer(soldat, soldat.pos!);
    expect(connaissanceDuGroupe(jeu())(`${caseCachee.x},${caseCachee.y},${caseCachee.z ?? 0}`)).toBe('explored');

    const ajouter = (c: Combatant) => {
      const battle = jeu().battle!;
      banc.setState({ battle: { ...battle, combatants: [...battle.combatants, c] } });
    };
    const apercu = { ...cache, id: 'personne-apercue', label: nomVu, pos: caseVue };
    ajouter(apercu);
    expect(combattantEnVue(jeu(), apercu)).toBe(true);
    const battle = jeu().battle!;
    banc.setState({ battle: { ...battle, combatants: battle.combatants.map((c) =>
      c.id === apercu.id ? { ...c, pos: caseCachee, label: nomCache } : c) } });
    ajouter(jamaisVu);
    expect(combattantEnVue(jeu(), parId(apercu.id))).toBe(false);
    expect(combattantEnVue(jeu(), jamaisVu)).toBe(false);
    expect(combattantEnVue(jeu(), visible)).toBe(true);
    const offerte = () => personnesConnues(jeu(), parId(soldat.id)).find((p) => p.id === apercu.id);
    expect(offerte()).toMatchObject({ label: nomVu });
    expect(offerte()?.pos).toBeUndefined();
    const scene = jeu().scene!;
    banc.setState({ scene: { ...scene, id: 'siege-enceinte-autre-instance' } });
    expect(offerte()).toBeUndefined();
    banc.setState({ scene });


    banc.abandonner();
    castSpell(jeu, banc.setState, sorcier, parId(soldat.id), SOURCE.id);
    reussirLIncantation(banc, 2);
    const cascade = jeu().pendingCascade!;
    const choix = cascade.participants[cascade.cursor];
    expect(choix.kind).toBe('personneChoisie');
    const options = choix.options ?? [];
    expect(options.map((o) => o.label)).toContain(nomVu);
    expect(options.map((o) => o.label)).not.toContain(nomCache);
    expect(options.map((o) => o.label)).not.toContain(jamaisVu.label);
    expect(options.map((o) => o.label)).toContain(visible.label);
    const cle = options.find((o) => o.label === nomVu)!.key;
    expect(cle).not.toBe(apercu.id);

    jeu().jetRegler('cascade', 'choix', apercu.id, choix.id);
    expect(jeu().pendingCascade?.participants[cascade.cursor].chosen).toBeUndefined();
    jeu().jetRegler('cascade', 'choix', cle, choix.id);
    jeu().jetValider('cascade');
    draineEtapes(jeu, 20);
    expect(accordes(parId(soldat.id)).traits).toEqual([
      { type: 'prejuge', cible: ciblePsy.individu(apercu.id), src: SOURCE },
    ]);
  });
});
