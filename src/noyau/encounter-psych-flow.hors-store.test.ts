import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { sceneFearSources, openScriptedPsych } from './encounterPsychFlow';
import { modalOwnerOf } from './modalArbiter';
import { seatOwns } from './sieges';
import { psychDRAdjust } from '../engine/combat';
import { stacks } from '../engine/conditions';
import type { Combatant } from '../engine/types';
import { createHero } from '../engine/character';
import { DEFAULT_RELIEF_DEFAULTS, DEFAULT_ROOF_DEFAULTS, type Scene, type SceneEntity } from './monde/scene';
import { type CustomStatblock } from '../engine/statblock';
import { emptyNarratif } from './monde/campaignNarratif';
import { presetDuNarratif } from './monde/resolveursDuNarratif';
import { initialNet } from './etat';
import { ligneDe } from '../engine/modLine.testkit';
import { psychTest, sansPeurLabel } from '../engine/psychology';
import { parsePsychTraits } from '../engine/psych/registry';
import { refLabel } from '../data';
import { t } from '../i18n';
import { ciblePsy } from '../engine/psych/ciblage';

/**
 * Flux de Psychologie À LA RENCONTRE, hors combat (couture C). Depuis 2026-06-10 : la Peur/Terreur de
 * CRÉATURE est COMBAT seulement → hors combat, seuls les Traits psy CIBLÉS du HÉROS se déclenchent —
 * Animosité/Haine/Préjugé/Amour/Camaraderie par leur Test propre, Phobie par le régime qu'elle CAUSE
 * (Peur, LDB 21 l.87). Depuis la VAGUE MULTI (#1117 L1) : c'est UNE cascade `purpose:'test'` de
 * BANDES — une étape `kind:'psychologieDeRencontre'` PAR ENTRÉE DE RÈGLE mise en jeu (type psy + source), et
 * une RANGÉE (`participants`) par héros concerné, au lieu d'une étape par héros. On vérifie ce contrat.
 */
let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/** Le résolveur de preset du narratif chargé sur le banc. */
const presetPnjById = (id: string) => presetDuNarratif(banc.getState().campaignNarratif)(id);

const TERREUR2: CustomStatblock = { type: 'statblock', label: 'Spectre', char: { force: 30, endurance: 30, 'force-mentale': 30 }, traits: [{ id: 'terreur', value: 2 }] };
const ELFE: CustomStatblock = { type: 'statblock', label: 'Elfe', char: { B: 10 }, groups: ['elfe'] };

function ent(over: Partial<SceneEntity> & Pick<SceneEntity, 'id'>): SceneEntity {
  return { kind: 'personnage', pos: { x: 1, y: 1 }, ...over } as SceneEntity;
}

function scene(entities: SceneEntity[]): Scene {
  return {
    type: 'scene', id: 's', label: 'S', dimensions: { w: 4, h: 4 }, reliefDefaults: structuredClone(DEFAULT_RELIEF_DEFAULTS), roofDefaults: structuredClone(DEFAULT_ROOF_DEFAULTS),
    layers: [{ z: 0, tiles: Array(16).fill('herbe') }], entities,
    dialogues: [], triggers: [], encounters: [], flags: {},
  };
}

/** Héros au Calme bas (FM 1, 0 avance) → Test simple raté de façon déterministe (cible basse). */
function timoreux(name: string, fm = 1) {
  const h = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: name, seed: 1 });
  h.characteristics['force-mentale'] = fm;
  h.skills = []; // pas d'avance de Calme → calmeValue = FM brut
  return h;
}
/** Héros timoré portant une Animosité (Elfe) — le Trait social qui se déclenche hors combat. */
function animosite(name: string) {
  const h = timoreux(name);
  h.psychTraits = [{ type: 'animosite', cible: ciblePsy.groupe('elfe') }];
  return h;
}

describe('encounterPsychFlow — Psychologie à la rencontre HORS COMBAT (bandes : une fenêtre par entrée de règle)', () => {
  beforeEach(() => {
    banc.getState().ensemencerLeTirage(2);
  });

  it('sceneFearSources ne dérive QUE les entités « personnage » (ignore props/heroStart)', () => {
    const sources = sceneFearSources(
      scene([
        ent({ id: 'pnj', statblock: TERREUR2 }),
        ent({ id: 'porte', kind: 'prop', decor: { id: 'Tonneau' } }),
        ent({ id: 'depart', kind: 'heroStart' }),
      ]),
      presetPnjById,
    );
    expect(sources.map((s) => s.id)).toEqual(['pnj']);
    expect(sources[0].causesTerreur).toBe(2);
  });

  it('sceneFearSources honore le `presetId` : le PNJ nommé garde SA fiche (même résolution que combatSlice/tavernFlow)', () => {
    banc.setState({ campaignNarratif: { ...emptyNarratif(), presetsPnj: [{ id: 'pnj-nomme', base: { id: 'humain' }, profil: { label: 'Nommé Test', traits: [{ id: 'terreur', value: 2 }] } }] } });
    const src = sceneFearSources(scene([ent({ id: 'pnj', presetId: 'pnj-nomme' })]), presetPnjById)[0];
    expect(src.label).toBe('Nommé Test');
    expect(src.causesTerreur).toBe(2);
  });

  /** #1882 — la source de la rencontre est LA fiche du PNJ (`ficheDEntite`) : un Trait optionnel choisi par
   *  l'auteur (`combat.optionals`, LDB 76 l.11) en fait partie, et l'appartenance qu'il octroie (Mort-vivant)
   *  est une Cible de Haine, jouée à la rencontre comme en combat. */
  it('un Trait OPTIONNEL de la fiche (Mort-vivant) fait du PNJ la Cible d’une Haine à la rencontre', () => {
    const h = timoreux('H');
    h.psychTraits = [{ type: 'haine', cible: ciblePsy.groupe('mort-vivant') }];
    banc.setState({ party: [h] });
    banc.getState().lancerLaScene(scene([ent({ id: 'revenant', creature: { id: 'humain' }, combat: { optionals: [{ id: 'mort-vivant' }] } })]));
    const step = banc.getState().pendingCascade?.participants[0];
    expect(step?.psychologieDeRencontre?.kind).toBe('haine');
    expect(step?.psychologieDeRencontre?.cible).toBe(ciblePsy.groupe('mort-vivant'));
  });

  it('une Terreur ne déclenche AUCUNE cascade à la rencontre (hors combat = non hostile)', () => {
    banc.setState({ party: [timoreux('H')] });
    banc.getState().lancerLaScene(scene([ent({ id: 'spectre', statblock: TERREUR2 })]));
    expect(banc.getState().pendingCascade).toBeNull();
  });

  it('un Trait ciblé social (Animosité Elfes) ouvre une BANDE face à un Elfe présent (déclaration sur l’étape, jet sur la rangée)', () => {
    const h = animosite('H');
    banc.setState({ party: [h] });
    banc.getState().lancerLaScene(scene([ent({ id: 'elfe', statblock: ELFE })]));
    const c = banc.getState().pendingCascade!;
    expect(c).toBeTruthy();
    expect(c.purpose).toBe('test');
    const step = c.participants[0];
    expect(step.kind).toBe('psychologieDeRencontre');
    expect(step.psychologieDeRencontre?.kind).toBe('animosite');
    expect(step.psychologieDeRencontre?.cible).toBe(ciblePsy.groupe('elfe'));
    // BANDE : le jet vit sur la RANGÉE, jamais sur l'étape (contrat `aggregate:'none'`).
    expect(step.aggregate).toBe('none');
    expect(step.target).toBeUndefined();
    expect(step.participants?.map((p) => p.id)).toEqual([h.id]);
    expect(step.participants?.[0].result).toBeNull();
  });

  it('Animosité ratée + Continuer → affliction active en psychState ; cascade close (1 héros)', () => {
    const h = animosite('H');
    banc.setState({ party: [h] });
    banc.getState().lancerLaScene(scene([ent({ id: 'elfe', statblock: ELFE })]));
    banc.getState().jetLancer('cascadeEnBande', h.id);
    banc.getState().jetValider('cascade');
    const hero = banc.getState().party[0];
    expect((hero.psychState ?? []).some((p) => p.type === 'animosite' && p.cible === ciblePsy.groupe('elfe') && p.active === true)).toBe(true);
    expect(banc.getState().pendingCascade).toBeNull();
  });

  it('Résilience (force le succès) → animosité maîtrisée, Résilience consommée', () => {
    const h = animosite('H');
    h.resilience = 1;
    banc.setState({ party: [h] });
    banc.getState().lancerLaScene(scene([ent({ id: 'elfe', statblock: ELFE })]));
    banc.getState().jetForcerLaReussite('cascadeEnBande', h.id);
    banc.getState().jetValider('cascade');
    const hero = banc.getState().party[0];
    expect((hero.psychState ?? []).some((p) => p.type === 'animosite' && p.active === true)).toBe(false);
    expect(hero.resilience).toBe(0);
  });

  it('Détermination = immunité temporaire (LDB 17 l.59) : psychImmuneRoundsLeft posé, animosité inerte (≈ succès one-shot), -1 Détermination', () => {
    const h = animosite('H');
    h.resolve = 1;
    banc.setState({ party: [h] });
    banc.getState().lancerLaScene(scene([ent({ id: 'elfe', statblock: ELFE })]));
    const step = banc.getState().pendingCascade!.participants[0];
    expect(step.psychologieDeRencontre?.kind).toBe('animosite');
    banc.getState().depenserLaDetermination(h.id, 'immuniserALaPsychologie');
    expect(banc.getState().pendingCascade!.participants[0].participants![0].immune).toBe(true);
    banc.getState().jetValider('cascade');
    const hero = banc.getState().party[0];
    expect(hero.resolve).toBe(0);
    expect(hero.activeEffects?.find((e) => e.psychImmune)?.duration).toEqual({ scale: 'rounds', left: 2 });
    // One-shot : immune ≈ inerte = même état final qu'un succès (pas d'affliction active → pas de re-déclenchement).
    expect((hero.psychState ?? []).some((p) => p.type === 'animosite' && p.active === true)).toBe(false);
    expect(banc.getState().pendingCascade).toBeNull();
  });

  it('BANDE : deux héros sur la MÊME entrée de règle → UNE étape à DEUX rangées (une fenêtre, pas « jet 1/2 »)', () => {
    const a = animosite('A');
    const b = animosite('B');
    banc.setState({ party: [a, b] });
    banc.getState().lancerLaScene(scene([ent({ id: 'elfe', statblock: ELFE })]));
    const c = banc.getState().pendingCascade!;
    expect(c.participants.length).toBe(1);
    const band = c.participants[0];
    expect(band.psychologieDeRencontre?.kind).toBe('animosite');
    expect(band.participants?.map((p) => p.id)).toEqual([a.id, b.id]);
    // La bande n'est PRÊTE qu'une fois toutes ses rangées jouées — puis la cascade se clôt d'un coup.
    banc.getState().jetLancer('cascadeEnBande', a.id);
    banc.getState().jetValider('cascade');
    expect(banc.getState().pendingCascade!.cursor).toBe(0); // rangée B pas encore jouée
    banc.getState().jetLancer('cascadeEnBande', b.id);
    banc.getState().jetValider('cascade');
    expect(banc.getState().pendingCascade).toBeNull();
    const psy = banc.getState().party.map((h) => (h.psychState ?? []).filter((p) => p.type === 'animosite').length);
    expect(psy).toEqual([1, 1]); // chaque rangée a reçu SA conséquence
  });

  it('BANDES : deux entrées de règle DIFFÉRENTES → deux étapes, dans l’ordre de première rencontre', () => {
    const a = animosite('A');
    const b = timoreux('B');
    b.psychTraits = [{ type: 'haine', cible: ciblePsy.groupe('elfe') }];
    banc.setState({ party: [a, b] });
    banc.getState().lancerLaScene(scene([ent({ id: 'elfe', statblock: ELFE })]));
    const c = banc.getState().pendingCascade!;
    expect(c.participants.map((s) => s.psychologieDeRencontre?.kind)).toEqual(['animosite', 'haine']);
    expect(c.participants.map((s) => s.participants?.map((p) => p.id))).toEqual([[a.id], [b.id]]);
  });

  it('Détermination PAR RANGÉE : le porteur est immunisé, l’autre rangée garde sa conséquence', () => {
    const a = animosite('A');
    a.resolve = 1;
    const b = animosite('B');
    b.resolve = 1;
    banc.setState({ party: [a, b] });
    banc.getState().lancerLaScene(scene([ent({ id: 'elfe', statblock: ELFE })]));
    banc.getState().depenserLaDetermination(a.id, 'immuniserALaPsychologie');
    const band = banc.getState().pendingCascade!.participants[0];
    expect(band.participants![0].immune).toBe(true);
    expect(band.participants![1].immune).toBeUndefined();
    expect(band.participants![1].result).toBeNull();
    banc.getState().jetLancer('cascadeEnBande', b.id);
    banc.getState().jetValider('cascade');
    const [ha, hb] = banc.getState().party;
    expect(ha.resolve).toBe(0);
    expect(hb.resolve).toBe(1); // B n'a RIEN dépensé : la Détermination est jouée PAR RANGÉE
    expect((ha.psychState ?? []).some((p) => p.type === 'animosite' && p.active === true)).toBe(false);
    expect((hb.psychState ?? []).some((p) => p.type === 'animosite' && p.active === true)).toBe(true);
    // Verdict PAR RANGÉE : chaque rangée porte SA conséquence (jamais un agrégat de bande).
    const done = banc.getState().journal;
    expect(done.some((l) => /A .*insensible/.test(l))).toBe(true);
  });

  // Sonde du juge (L1) : une bande ne doit pas être SOURDE au seam `onOwnTestFailed` — MSRC 16 l.152-158
  // (Crampes abdominales) : « Lorsqu'un Test se solde par un échec normal ou pire, il se plie en deux de
  // douleur […] et gagne l'État *Sonné*. » Le trigger est dû au TEST, pas à la forme de la fenêtre.
  it('Crampes abdominales : une RANGÉE perdante de la bande émet onOwnTestFailed → État Sonné pour SON porteur', () => {
    const a = animosite('A');
    a.diseases = [{ id: 'colique', phase: 'active', symptoms: [{ symptomId: 'crampes-abdominales' }], minutesLeft: 1e5, durationMinutes: 1e5 }];
    const b = animosite('B');
    b.diseases = [{ id: 'colique', phase: 'active', symptoms: [{ symptomId: 'crampes-abdominales' }], minutesLeft: 1e5, durationMinutes: 1e5 }];
    banc.setState({ party: [a, b] });
    banc.getState().lancerLaScene(scene([ent({ id: 'elfe', statblock: ELFE })]));
    const pc = banc.getState().pendingCascade!;
    const band = pc.participants[0];
    // Jets POSÉS (déterministes) : A rate d'un échec normal (DR −2 → palier 1), B réussit.
    const rows = band.participants!.map((p, k) => ({
      ...p,
      result: k === 0 ? { roll: 99, target: p.target, sl: -2, success: false } : { roll: 1, target: p.target, sl: 2, success: true },
    }));
    banc.setState({ pendingCascade: { ...pc, participants: [{ ...band, participants: rows }] } });
    banc.getState().jetValider('cascade');
    const [ha, hb] = banc.getState().party;
    expect(ha.conditions.some((c) => c.id === 'sonne')).toBe(true);
    expect(hb.conditions.some((c) => c.id === 'sonne')).toBe(false); // rangée RÉUSSIE : muette
  });

  it('aucune source sociale (PNJ neutre) → aucune cascade', () => {
    banc.setState({ party: [animosite('H')] });
    banc.getState().lancerLaScene(scene([ent({ id: 'paysan', statblock: { type: 'statblock', label: 'Paysan', char: { B: 10 } } })]));
    expect(banc.getState().pendingCascade).toBeNull();
  });

  it('immunité (Frénésie) → aucune cascade même sociale', () => {
    const h = animosite('H');
    (h.psychState ??= []).push({ type: 'frenesie' });
    banc.setState({ party: [h] });
    banc.getState().lancerLaScene(scene([ent({ id: 'elfe', statblock: ELFE })]));
    expect(banc.getState().pendingCascade).toBeNull();
  });

  /** #1224 — LDB 21 l.87 : « Traitez l'objet de la *Phobie* comme causant *Peur 1*. » La porte est portée
   *  par l'OBSERVATEUR (le Trait du héros), pas par le statbloc croisé : l'exclusion de la Peur de CRÉATURE
   *  hors combat (playtest 2026-06-10) ne l'atteint pas. Mesuré sur le flux RÉEL (`lancerLaScene`). */
  it('Phobie (Araignées) : une araignée présente ouvre la bande du régime PEUR — hors combat', () => {
    const h = timoreux('H');
    h.psychTraits = [{ type: 'phobie', cible: ciblePsy.groupe('bete'), indice: 1 }];
    banc.setState({ party: [h] });
    banc.getState().lancerLaScene(scene([ent({ id: 'arai', statblock: { type: 'statblock', label: 'Araignée géante', char: { B: 10 }, groups: ['bete'] } })]));
    const c = banc.getState().pendingCascade;
    expect(c, 'aucune bande : le phobique ne teste plus rien hors combat').toBeTruthy();
    const step = c!.participants[0];
    expect(step.kind).toBe('psychologieDeRencontre');
    expect(step.psychologieDeRencontre).toMatchObject({ kind: 'peur', indice: 1, sourceId: 'arai', cible: ciblePsy.groupe('bete') });
    expect(step.participants!.map((p) => p.id)).toEqual([h.id]);
  });

  it('Phobie, héros Exténué ×3 : la rangée nomme l’État et le jet affronte Calme −30 (LDB 16 l.90)', () => {
    const h = timoreux('H', 60);
    h.talents = [];
    h.psychTraits = [{ type: 'phobie', cible: ciblePsy.groupe('bete'), indice: 1 }];
    h.conditions = [{ id: 'extenue', value: 3 }];
    banc.setState({ party: [h] });
    banc.getState().lancerLaScene(scene([ent({ id: 'arai', statblock: { type: 'statblock', label: 'Araignée géante', char: { B: 10 }, groups: ['bete'] } })]));
    const rangee = () => banc.getState().pendingCascade!.participants[0].participants![0];
    expect(rangee().base, 'base nue : Calme 60').toBe(60);
    expect(ligneDe(rangee().mods, { category: 'etats', id: 'extenue' })?.value, 'l’État est nommé sur la rangée').toBe(-30);
    expect(rangee().target, 'Calme 60 −30 Exténué, Intermédiaire').toBe(30);
    banc.getState().jetLancer('cascadeEnBande', h.id);
    expect((rangee().result as { target?: number }).target, 'le jet affronte la cible annoncée').toBe(30);
  });

  it('Sans Peur (Ennemi) : la rangée du porteur est Accessible et nommée, celle du voisin reste déclarée (LDB 10 l.1051)', () => {
    const brave = timoreux('Brave');
    brave.psychTraits = [{ type: 'phobie', cible: ciblePsy.groupe('bete'), indice: 1 }];
    brave.talents = [{ talentId: 'sans-peur', spec: 'bete', times: 1 }];
    const autre = timoreux('Autre');
    autre.psychTraits = [{ type: 'phobie', cible: ciblePsy.groupe('bete'), indice: 1 }];
    banc.setState({ party: [brave, autre] });
    banc.getState().lancerLaScene(scene([ent({ id: 'arai', statblock: { type: 'statblock', label: 'Araignée géante', char: { B: 10 }, groups: ['bete'] } })]));
    const [b, a] = banc.getState().pendingCascade!.participants[0].participants!;
    const { skill, difficulty } = psychTest('peur');
    expect(b.difficulty).toBe('accessible');
    expect(b.label).toBe(t('step.sansPeur', { skill: refLabel('skills', skill), talent: sansPeurLabel() }));
    expect(b.meta?.sansPeur).toBe(true);
    expect(a.difficulty).toBe(difficulty);
    expect(a.meta?.sansPeur).toBeUndefined();
  });

  it('Phobie hors de sa Cible : aucune bande (la porte reste bornée au Groupe du Trait)', () => {
    const h = timoreux('H');
    h.psychTraits = [{ type: 'phobie', cible: ciblePsy.groupe('bete'), indice: 1 }];
    banc.setState({ party: [h] });
    banc.getState().lancerLaScene(scene([ent({ id: 'elfe', statblock: ELFE })]));
    expect(banc.getState().pendingCascade).toBeNull();
  });

  it('TÉMOIN — l’Animosité garde son Test PROPRE (binaire), la Phobie ne l’a pas absorbée', () => {
    const h = animosite('H');
    h.psychTraits = [...h.psychTraits!, { type: 'phobie', cible: ciblePsy.groupe('bete'), indice: 1 }];
    banc.setState({ party: [h] });
    banc.getState().lancerLaScene(scene([ent({ id: 'elfe', statblock: ELFE })]));
    const step = banc.getState().pendingCascade!.participants[0];
    expect(step.psychologieDeRencontre).toMatchObject({ kind: 'animosite', cible: ciblePsy.groupe('elfe') });
  });
});

/**
 * TERREUR → PEUR (#1190) — LDB 21, § Terreur, verbatim :
 *   « Sur un succès, vous ne subissez aucun effet supplémentaire à cause de la *Terreur*. Sur un échec,
 *     vous gagnez autant d'États *Brisé* que l'*Indice* de *Terreur* de la créature […]. »
 *   « Une fois ce Test de Psychologie effectué, la créature cause la *Peur*, avec un *Indice* de *Peur*
 *     équivalent à son *Indice* de *Terreur*. »
 * L'exemption du succès est scopée à LA TERREUR ; la seconde phrase est INCONDITIONNELLE. La Peur qui
 * suit se pose donc à PLEIN Indice dans les deux cas — et non « déjà surmontée sur une réussite ».
 * La couture qui mord est le prédicat unique `sousPeur` (`psychDRAdjust`, la même lecture que le Test
 * de Peur de fin de Round et l'approche menaçante).
 */
describe('Terreur réussie : la Peur qui en découle est due à PLEIN Indice (LDB 21)', () => {
  const SOURCE_ID = 'scripted:Un spectre hurlant';
  /** La source, telle que la voit `psychDRAdjust` (l'id est celui posé par `openScriptedPsych`). */
  const spectre = { id: SOURCE_ID, label: 'Un spectre hurlant', groups: [] } as unknown as Combatant;

  /** Ouvre la bande de Terreur (Indice 3) sur `h`, y POSE le jet voulu, puis valide. */
  function terreurBand(h: Combatant, result: { success: boolean; sl: number }) {
    banc.setState({ party: [h], pendingCascade: null, battle: null });
    openScriptedPsych(banc.getState, banc.setState, 'terreur', 3, 'Un spectre hurlant', [h]);
    const pc = banc.getState().pendingCascade!;
    const band = pc.participants[0];
    const participants = band.participants!.map((part) => ({
      ...part, result: { roll: result.success ? 1 : 99, target: part.target, sl: result.sl, success: result.success },
    }));
    banc.setState({ pendingCascade: { ...pc, participants: [{ ...band, participants }] } });
    banc.getState().jetValider('cascade');
    return banc.getState().party[0];
  }
  const peurOf = (c: Combatant) => (c.psychState ?? []).find((p) => p.type === 'peur' && p.sourceId === SOURCE_ID);

  it('SUCCÈS : aucun Brisé (l’exemption ne couvre que la Terreur), mais Peur d’Indice 3 ACTIVE — le −1 DR mord', () => {
    const hero = terreurBand(timoreux('H'), { success: true, sl: 2 });
    expect(stacks(hero, 'brise')).toBe(0); // « aucun effet supplémentaire à cause de la Terreur »
    const peur = peurOf(hero);
    expect(peur?.indice).toBe(3); // plein Indice, jamais 0
    expect(peur?.surmontee, 'jamais testée EN TANT QUE Peur').toBe(false);
    // Elle MORD : Peur active non vaincue vs sa source (LDB 21 l.27) — la couture réelle, pas le champ.
    expect(psychDRAdjust(hero, spectre)).toBe(-1);
  });

  it('ÉCHEC : États Brisé posés ET la MÊME Peur d’Indice 3 active', () => {
    const hero = terreurBand(timoreux('H'), { success: false, sl: -2 });
    expect(stacks(hero, 'brise')).toBeGreaterThan(0);
    expect(peurOf(hero)?.indice).toBe(3);
    expect(psychDRAdjust(hero, spectre)).toBe(-1);
  });

  it('DÉTERMINATION (LDB 17 l.59) : le Test est ignoré, la Peur reste due à PLEIN Indice pour l’après', () => {
    const h = timoreux('H');
    h.resolve = 1;
    banc.setState({ party: [h], pendingCascade: null, battle: null });
    openScriptedPsych(banc.getState, banc.setState, 'terreur', 3, 'Un spectre hurlant', [h]);
    banc.getState().depenserLaDetermination(h.id, 'immuniserALaPsychologie');
    banc.getState().jetValider('cascade');
    const hero = banc.getState().party[0];
    expect(stacks(hero, 'brise')).toBe(0); // le Test de Terreur n'a pas eu lieu
    expect(peurOf(hero)?.indice).toBe(3); // l'immunité est TEMPORAIRE, jamais une Peur vaincue à jamais
    // …et pendant l'immunité, c'est le marqueur qui protège (`isPsychImmune` → 0), pas un Indice nul.
    expect(psychDRAdjust(hero, spectre)).toBe(0);
  });
});

/**
 * COOP (#1262 V2 lot 3) — la bande de Psychologie de RENCONTRE ne déclarait AUCUNE possession : son
 * `modalOwnerOf` valait `undefined`, c'est-à-dire fenêtre à l'HÔTE SEUL (`netOwnership.ownsLocal`),
 * qui jouait alors le Test de Calme du héros d'un invité (classe #1268). Le mint (`bandStep`, via
 * `makeBandFactory`) la pose : plusieurs appelés → `groupOwner`, un seul → SON porteur.
 */
describe('encounterPsychFlow — POSSESSION de la bande (classe #1268)', () => {
  const NET0 = initialNet();

  it('deux héros appelés → fenêtre PARTAGÉE ; un seul → la bande EST la sienne', () => {
    const a = timoreux('A'); a.id = 'psy-a';
    const b = timoreux('B'); b.id = 'psy-b';
    banc.setState({ party: [a, b], pendingCascade: null, battle: null, net: { ...NET0, mode: 'hote', mySeat: 0, slots: [0, 1, 0, 0], ownership: { [b.id]: 1 } } } as never);
    openScriptedPsych(banc.getState, banc.setState, 'terreur', 2, 'Une vision', [a, b]);
    const bande = banc.getState().pendingCascade!.participants[0];
    expect(bande.participants!.map((p) => p.id)).toEqual([a.id, b.id]);
    expect(bande.groupOwner).toBe(true);
    expect(modalOwnerOf(banc.getState()), 'jamais `undefined` : c’était la fenêtre hôte-seul').toBe('*');

    banc.setState({ pendingCascade: null });
    openScriptedPsych(banc.getState, banc.setState, 'terreur', 2, 'Une vision', [b]);
    const seule = banc.getState().pendingCascade!.participants[0];
    expect(seule.groupOwner).toBeUndefined();
    expect(seule.actorId).toBe(b.id);
    expect(seatOwns(banc.getState(), 1, modalOwnerOf(banc.getState()) as string), 'la fenêtre est au siège qui tient le héros').toBe(true);
    expect(seatOwns(banc.getState(), 0, modalOwnerOf(banc.getState()) as string), 'et plus à l’hôte').toBe(false);
  });
});

describe('encounterPsychFlow — l’étiquette de la scène, source sans PNJ (#3045)', () => {
  beforeEach(() => {
    banc.getState().ensemencerLeTirage(2);
  });
  const etiquetee = (groups?: string[]): Scene => ({ ...scene([]), groups });

  it('Haine (Richesse) dans une scène qui porte la richesse, sans PNJ : Test dû, et l’échec laisse la Haine active', () => {
    const h = timoreux('H');
    h.psychTraits = [{ type: 'haine', cible: ciblePsy.groupe('richesse') }];
    banc.setState({ party: [h] });
    banc.getState().lancerLaScene(etiquetee(['richesse']));
    const step = banc.getState().pendingCascade!.participants[0];
    expect([step.psychologieDeRencontre?.kind, step.psychologieDeRencontre?.cible, step.psychologieDeRencontre?.sourceId]).toEqual(['haine', ciblePsy.groupe('richesse'), 'scene']);
    expect(step.participants?.map((p) => p.id)).toEqual([h.id]);
    banc.getState().jetLancer('cascadeEnBande', h.id);
    banc.getState().jetValider('cascade');
    expect((banc.getState().party[0].psychState ?? []).filter((p) => p.type === 'haine').map((p) => [p.cible, p.active])).toEqual([[ciblePsy.groupe('richesse'), true]]);
  });

  it('Effrayé (Feu) dans une scène qui porte le feu : la bande de Peur (Indice 0) de l’étiquette (LDB 21 l.87 ; EDOC 12 l.241)', () => {
    const h = timoreux('H');
    h.psychTraits = parsePsychTraits([{ id: 'effraye', arg: 'feu' }]).psychTraits;
    banc.setState({ party: [h] });
    banc.getState().lancerLaScene(etiquetee(['feu']));
    const ep = banc.getState().pendingCascade!.participants[0].psychologieDeRencontre;
    expect([ep?.kind, ep?.indice, ep?.sourceId, ep?.sourceName]).toEqual(['peur', 0, 'scene', 'S']);
  });

  it('une scène sans Groupe n’est la source de rien', () => {
    const h = timoreux('H');
    h.psychTraits = [{ type: 'haine', cible: ciblePsy.groupe('richesse') }];
    banc.setState({ party: [h] });
    banc.getState().lancerLaScene(etiquetee());
    expect(banc.getState().pendingCascade).toBeNull();
  });
});
