import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame } from './store';
import { sceneFearSources, openScriptedPsych } from './encounterPsychFlow';
import { modalOwnerOf } from './modalArbiter';
import { seatOwns } from './netOwnership';
import { psychDRAdjust } from '../engine/combat';
import { stacks } from '../engine/conditions';
import type { Combatant } from '../engine/types';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { DEFAULT_RELIEF_DEFAULTS, DEFAULT_ROOF_DEFAULTS, type Scene, type SceneEntity, type CustomStatblock } from './scene';
import { emptyNarratif } from './campaignNarratif';

/**
 * Flux de Psychologie À LA RENCONTRE, hors combat (couture C). Depuis 2026-06-10 : la Peur/Terreur de
 * CRÉATURE est COMBAT seulement → hors combat, seuls les Traits psy CIBLÉS du HÉROS se déclenchent —
 * Animosité/Haine/Préjugé/Amour/Camaraderie par leur Test propre, Phobie par le régime qu'elle CAUSE
 * (Peur, LDB 21 l.87). Depuis la VAGUE MULTI (#1117 L1) : c'est UNE cascade `purpose:'test'` de
 * BANDES — une étape `kind:'encounterPsych'` PAR ENTRÉE DE RÈGLE mise en jeu (type psy + source), et
 * une RANGÉE (`participants`) par héros concerné, au lieu d'une étape par héros. On vérifie ce contrat.
 */
const TERREUR2: CustomStatblock = { type: 'statblock', label: 'Spectre', char: { force: 30, endurance: 30, 'force-mentale': 30 }, traits: [{ id: 'terreur', value: 2 }] };
const ELFE: CustomStatblock = { type: 'statblock', label: 'Elfe', char: { B: 10 }, groups: ['elfe'] };

function ent(over: Partial<SceneEntity> & Pick<SceneEntity, 'id'>): SceneEntity {
  return { kind: 'personnage', pos: { x: 1, y: 1 }, ...over } as SceneEntity;
}

function scene(entities: SceneEntity[]): Scene {
  return {
    type: 'scene', id: 's', label: 'S', dimensions: { w: 4, h: 4 }, reliefDefaults: { ...DEFAULT_RELIEF_DEFAULTS }, roofDefaults: { ...DEFAULT_ROOF_DEFAULTS },
    layers: [{ z: 0, tiles: Array(16).fill('herbe') }], entities,
    dialogues: [], triggers: [], encounters: [], flags: {},
  };
}

/** Héros au Calme bas (FM 1, 0 avance) → Test simple raté de façon déterministe (cible basse). */
function timoreux(name: string, fm = 1) {
  const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: name, rng: makeRNG(1) });
  h.characteristics['force-mentale'] = fm;
  h.skills = []; // pas d'avance de Calme → calmeValue = FM brut
  return h;
}
/** Héros timoré portant une Animosité (Elfe) — le Trait social qui se déclenche hors combat. */
function animosite(name: string) {
  const h = timoreux(name);
  h.psychTraits = [{ type: 'animosite', cible: 'elfe' }];
  return h;
}

describe('encounterPsychFlow — Psychologie à la rencontre HORS COMBAT (bandes : une fenêtre par entrée de règle)', () => {
  beforeEach(() => {
    useGame.setState({ battle: null, pendingCascade: null, scene: null, party: [], campaignNarratif: null });
    useGame.getState().seedRng(2);
  });

  it('sceneFearSources ne dérive QUE les entités « personnage » (ignore props/heroStart)', () => {
    const sources = sceneFearSources(
      scene([
        ent({ id: 'pnj', statblock: TERREUR2 }),
        ent({ id: 'porte', kind: 'prop', ref: 'Tonneau' }),
        ent({ id: 'depart', kind: 'heroStart' }),
      ]),
    );
    expect(sources.map((s) => s.id)).toEqual(['pnj']);
    expect(sources[0].causesTerreur).toBe(2);
  });

  it('sceneFearSources honore le `presetId` : le PNJ nommé garde SA fiche (même résolution que combatSlice/tavernFlow)', () => {
    useGame.setState({ campaignNarratif: { ...emptyNarratif(), presetsPnj: [{ id: 'pnj-nomme', base: 'brigand', profil: { label: 'Nommé Test', traits: [{ id: 'terreur', value: 2 }] } }] } });
    const src = sceneFearSources(scene([ent({ id: 'pnj', presetId: 'pnj-nomme' })]))[0];
    expect(src.label).toBe('Nommé Test');
    expect(src.causesTerreur).toBe(2);
  });

  /** #1882 — la source de la rencontre est LA fiche du PNJ (`ficheDEntite`) : un Trait optionnel choisi par
   *  l'auteur (`combat.optionals`, LDB 76 l.11) en fait partie, et l'appartenance qu'il octroie (Mort-vivant)
   *  est une Cible de Haine, jouée à la rencontre comme en combat. */
  it('un Trait OPTIONNEL de la fiche (Mort-vivant) fait du PNJ la Cible d’une Haine à la rencontre', () => {
    const h = timoreux('H');
    h.psychTraits = [{ type: 'haine', cible: 'mort-vivant' }];
    useGame.setState({ party: [h] });
    useGame.getState().startScene(scene([ent({ id: 'revenant', ref: 'humain', combat: { optionals: [{ id: 'mort-vivant' }] } })]));
    const step = useGame.getState().pendingCascade?.participants[0];
    expect(step?.encounterPsych?.kind).toBe('haine');
    expect(step?.encounterPsych?.cible).toBe('mort-vivant');
  });

  it('une Terreur ne déclenche AUCUNE cascade à la rencontre (hors combat = non hostile)', () => {
    useGame.setState({ party: [timoreux('H')] });
    useGame.getState().startScene(scene([ent({ id: 'spectre', statblock: TERREUR2 })]));
    expect(useGame.getState().pendingCascade).toBeNull();
  });

  it('un Trait ciblé social (Animosité Elfes) ouvre une BANDE face à un Elfe présent (déclaration sur l’étape, jet sur la rangée)', () => {
    const h = animosite('H');
    useGame.setState({ party: [h] });
    useGame.getState().startScene(scene([ent({ id: 'elfe', statblock: ELFE })]));
    const c = useGame.getState().pendingCascade!;
    expect(c).toBeTruthy();
    expect(c.purpose).toBe('test');
    const step = c.participants[0];
    expect(step.kind).toBe('encounterPsych');
    expect(step.encounterPsych?.kind).toBe('animosite');
    expect(step.encounterPsych?.cible).toBe('elfe');
    // BANDE : le jet vit sur la RANGÉE, jamais sur l'étape (contrat `aggregate:'none'`).
    expect(step.aggregate).toBe('none');
    expect(step.target).toBeUndefined();
    expect(step.participants?.map((p) => p.id)).toEqual([h.id]);
    expect(step.participants?.[0].result).toBeNull();
  });

  it('Animosité ratée + Continuer → affliction active en psychState ; cascade close (1 héros)', () => {
    const h = animosite('H');
    useGame.setState({ party: [h] });
    useGame.getState().startScene(scene([ent({ id: 'elfe', statblock: ELFE })]));
    useGame.getState().cascadeBatchRoll(h.id);
    useGame.getState().cascadeNext();
    const hero = useGame.getState().party[0];
    expect((hero.psychState ?? []).some((p) => p.type === 'animosite' && p.cible === 'elfe' && p.active === true)).toBe(true);
    expect(useGame.getState().pendingCascade).toBeNull();
  });

  it('Résilience (force le succès) → animosité maîtrisée, Résilience consommée', () => {
    const h = animosite('H');
    h.resilience = 1;
    useGame.setState({ party: [h] });
    useGame.getState().startScene(scene([ent({ id: 'elfe', statblock: ELFE })]));
    useGame.getState().cascadeBatchForceSuccess(h.id);
    useGame.getState().cascadeNext();
    const hero = useGame.getState().party[0];
    expect((hero.psychState ?? []).some((p) => p.type === 'animosite' && p.active === true)).toBe(false);
    expect(hero.resilience).toBe(0);
  });

  it('Détermination = immunité temporaire (LDB 17 l.59) : psychImmuneRoundsLeft posé, animosité inerte (≈ succès one-shot), -1 Détermination', () => {
    const h = animosite('H');
    h.resolve = 1;
    useGame.setState({ party: [h] });
    useGame.getState().startScene(scene([ent({ id: 'elfe', statblock: ELFE })]));
    const step = useGame.getState().pendingCascade!.participants[0];
    expect(step.encounterPsych?.kind).toBe('animosite');
    useGame.getState().cascadeBatchDetermine(h.id);
    expect(useGame.getState().pendingCascade!.participants[0].participants![0].immune).toBe(true);
    useGame.getState().cascadeNext();
    const hero = useGame.getState().party[0];
    expect(hero.resolve).toBe(0);
    expect(hero.activeEffects?.find((e) => e.psychImmune)?.duration).toEqual({ scale: 'rounds', left: 2 });
    // One-shot : immune ≈ inerte = même état final qu'un succès (pas d'affliction active → pas de re-déclenchement).
    expect((hero.psychState ?? []).some((p) => p.type === 'animosite' && p.active === true)).toBe(false);
    expect(useGame.getState().pendingCascade).toBeNull();
  });

  it('BANDE : deux héros sur la MÊME entrée de règle → UNE étape à DEUX rangées (une fenêtre, pas « jet 1/2 »)', () => {
    const a = animosite('A');
    const b = animosite('B');
    useGame.setState({ party: [a, b] });
    useGame.getState().startScene(scene([ent({ id: 'elfe', statblock: ELFE })]));
    const c = useGame.getState().pendingCascade!;
    expect(c.participants.length).toBe(1);
    const band = c.participants[0];
    expect(band.encounterPsych?.kind).toBe('animosite');
    expect(band.participants?.map((p) => p.id)).toEqual([a.id, b.id]);
    // La bande n'est PRÊTE qu'une fois toutes ses rangées jouées — puis la cascade se clôt d'un coup.
    useGame.getState().cascadeBatchRoll(a.id);
    useGame.getState().cascadeNext();
    expect(useGame.getState().pendingCascade!.cursor).toBe(0); // rangée B pas encore jouée
    useGame.getState().cascadeBatchRoll(b.id);
    useGame.getState().cascadeNext();
    expect(useGame.getState().pendingCascade).toBeNull();
    const psy = useGame.getState().party.map((h) => (h.psychState ?? []).filter((p) => p.type === 'animosite').length);
    expect(psy).toEqual([1, 1]); // chaque rangée a reçu SA conséquence
  });

  it('BANDES : deux entrées de règle DIFFÉRENTES → deux étapes, dans l’ordre de première rencontre', () => {
    const a = animosite('A');
    const b = timoreux('B');
    b.psychTraits = [{ type: 'haine', cible: 'elfe' }];
    useGame.setState({ party: [a, b] });
    useGame.getState().startScene(scene([ent({ id: 'elfe', statblock: ELFE })]));
    const c = useGame.getState().pendingCascade!;
    expect(c.participants.map((s) => s.encounterPsych?.kind)).toEqual(['animosite', 'haine']);
    expect(c.participants.map((s) => s.participants?.map((p) => p.id))).toEqual([[a.id], [b.id]]);
  });

  it('Détermination PAR RANGÉE : le porteur est immunisé, l’autre rangée garde sa conséquence', () => {
    const a = animosite('A');
    a.resolve = 1;
    const b = animosite('B');
    b.resolve = 1;
    useGame.setState({ party: [a, b] });
    useGame.getState().startScene(scene([ent({ id: 'elfe', statblock: ELFE })]));
    useGame.getState().cascadeBatchDetermine(a.id);
    const band = useGame.getState().pendingCascade!.participants[0];
    expect(band.participants![0].immune).toBe(true);
    expect(band.participants![1].immune).toBeUndefined();
    expect(band.participants![1].result).toBeNull();
    useGame.getState().cascadeBatchRoll(b.id);
    useGame.getState().cascadeNext();
    const [ha, hb] = useGame.getState().party;
    expect(ha.resolve).toBe(0);
    expect(hb.resolve).toBe(1); // B n'a RIEN dépensé : la Détermination est jouée PAR RANGÉE
    expect((ha.psychState ?? []).some((p) => p.type === 'animosite' && p.active === true)).toBe(false);
    expect((hb.psychState ?? []).some((p) => p.type === 'animosite' && p.active === true)).toBe(true);
    // Verdict PAR RANGÉE : chaque rangée porte SA conséquence (jamais un agrégat de bande).
    const done = useGame.getState().journal;
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
    useGame.setState({ party: [a, b] });
    useGame.getState().startScene(scene([ent({ id: 'elfe', statblock: ELFE })]));
    const pc = useGame.getState().pendingCascade!;
    const band = pc.participants[0];
    // Jets POSÉS (déterministes) : A rate d'un échec normal (DR −2 → palier 1), B réussit.
    const rows = band.participants!.map((p, k) => ({
      ...p,
      result: k === 0 ? { roll: 99, target: p.target, sl: -2, success: false } : { roll: 1, target: p.target, sl: 2, success: true },
    }));
    useGame.setState({ pendingCascade: { ...pc, participants: [{ ...band, participants: rows }] } });
    useGame.getState().cascadeNext();
    const [ha, hb] = useGame.getState().party;
    expect(ha.conditions.some((c) => c.id === 'sonne')).toBe(true);
    expect(hb.conditions.some((c) => c.id === 'sonne')).toBe(false); // rangée RÉUSSIE : muette
  });

  it('aucune source sociale (PNJ neutre) → aucune cascade', () => {
    useGame.setState({ party: [animosite('H')] });
    useGame.getState().startScene(scene([ent({ id: 'paysan', statblock: { type: 'statblock', label: 'Paysan', char: { B: 10 } } })]));
    expect(useGame.getState().pendingCascade).toBeNull();
  });

  it('immunité (Frénésie) → aucune cascade même sociale', () => {
    const h = animosite('H');
    (h.psychState ??= []).push({ type: 'frenesie' });
    useGame.setState({ party: [h] });
    useGame.getState().startScene(scene([ent({ id: 'elfe', statblock: ELFE })]));
    expect(useGame.getState().pendingCascade).toBeNull();
  });

  /** #1224 — LDB 21 l.87 : « Traitez l'objet de la *Phobie* comme causant *Peur 1*. » La porte est portée
   *  par l'OBSERVATEUR (le Trait du héros), pas par le statbloc croisé : l'exclusion de la Peur de CRÉATURE
   *  hors combat (playtest 2026-06-10) ne l'atteint pas. Mesuré sur le flux RÉEL (`startScene`). */
  it('Phobie (Araignées) : une araignée présente ouvre la bande du régime PEUR — hors combat', () => {
    const h = timoreux('H');
    h.psychTraits = [{ type: 'phobie', cible: 'araignees', indice: 1 }];
    useGame.setState({ party: [h] });
    useGame.getState().startScene(scene([ent({ id: 'arai', statblock: { type: 'statblock', label: 'Araignée géante', char: { B: 10 }, groups: ['araignees'] } })]));
    const c = useGame.getState().pendingCascade;
    expect(c, 'aucune bande : le phobique ne teste plus rien hors combat').toBeTruthy();
    const step = c!.participants[0];
    expect(step.kind).toBe('encounterPsych');
    expect(step.encounterPsych).toMatchObject({ kind: 'peur', indice: 1, sourceId: 'arai', cible: 'araignees' });
    expect(step.participants!.map((p) => p.id)).toEqual([h.id]);
  });

  it('Phobie hors de sa Cible : aucune bande (la porte reste bornée au Groupe du Trait)', () => {
    const h = timoreux('H');
    h.psychTraits = [{ type: 'phobie', cible: 'araignees', indice: 1 }];
    useGame.setState({ party: [h] });
    useGame.getState().startScene(scene([ent({ id: 'elfe', statblock: ELFE })]));
    expect(useGame.getState().pendingCascade).toBeNull();
  });

  it('TÉMOIN — l’Animosité garde son Test PROPRE (binaire), la Phobie ne l’a pas absorbée', () => {
    const h = animosite('H');
    h.psychTraits = [...h.psychTraits!, { type: 'phobie', cible: 'araignees', indice: 1 }];
    useGame.setState({ party: [h] });
    useGame.getState().startScene(scene([ent({ id: 'elfe', statblock: ELFE })]));
    const step = useGame.getState().pendingCascade!.participants[0];
    expect(step.encounterPsych).toMatchObject({ kind: 'animosite', cible: 'elfe' });
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
 * La couture qui mord est le prédicat unique `calmeDR < indice` (`psychDRAdjust`, la même lecture que
 * le Test de Peur de fin de Round et l'approche menaçante) : Indice 0 la rendait INERTE.
 */
describe('Terreur réussie : la Peur qui en découle est due à PLEIN Indice (LDB 21)', () => {
  const SOURCE_ID = 'scripted:Un spectre hurlant';
  /** La source, telle que la voit `psychDRAdjust` (l'id est celui posé par `openScriptedPsych`). */
  const spectre = { id: SOURCE_ID, label: 'Un spectre hurlant', groups: [] } as unknown as Combatant;

  /** Ouvre la bande de Terreur (Indice 3) sur `h`, y POSE le jet voulu, puis valide. */
  function terreurBand(h: Combatant, result: { success: boolean; sl: number }) {
    useGame.setState({ party: [h], pendingCascade: null, battle: null });
    openScriptedPsych(useGame.getState, useGame.setState, 'terreur', 3, 'Un spectre hurlant', [h]);
    const pc = useGame.getState().pendingCascade!;
    const band = pc.participants[0];
    const participants = band.participants!.map((part) => ({
      ...part, result: { roll: result.success ? 1 : 99, target: part.target, sl: result.sl, success: result.success },
    }));
    useGame.setState({ pendingCascade: { ...pc, participants: [{ ...band, participants }] } });
    useGame.getState().cascadeNext();
    return useGame.getState().party[0];
  }
  const peurOf = (c: Combatant) => (c.psychState ?? []).find((p) => p.type === 'peur' && p.sourceId === SOURCE_ID);

  it('SUCCÈS : aucun Brisé (l’exemption ne couvre que la Terreur), mais Peur d’Indice 3 ACTIVE — le −1 DR mord', () => {
    const hero = terreurBand(timoreux('H'), { success: true, sl: 2 });
    expect(stacks(hero, 'brise')).toBe(0); // « aucun effet supplémentaire à cause de la Terreur »
    const peur = peurOf(hero);
    expect(peur?.indice).toBe(3); // plein Indice, jamais 0
    expect(peur?.calmeDR ?? 0).toBe(0); // jamais testée EN TANT QUE Peur
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
    useGame.setState({ party: [h], pendingCascade: null, battle: null });
    openScriptedPsych(useGame.getState, useGame.setState, 'terreur', 3, 'Un spectre hurlant', [h]);
    useGame.getState().cascadeBatchDetermine(h.id);
    useGame.getState().cascadeNext();
    const hero = useGame.getState().party[0];
    expect(stacks(hero, 'brise')).toBe(0); // le Test de Terreur n'a pas eu lieu
    expect(peurOf(hero)?.indice).toBe(3); // l'immunité est TEMPORAIRE, jamais une Peur vaincue à jamais
    // …et pendant l'immunité, c'est le marqueur qui protège (`isPsychImmune` → 0), pas un Indice nul.
    expect(psychDRAdjust(hero, spectre)).toBe(0);
  });
});

/**
 * COOP (#1262 V2 lot 3) — la bande de Psychologie de RENCONTRE ne déclarait AUCUNE possession : son
 * `modalOwnerOf` valait `undefined`, c'est-à-dire fenêtre à l'HÔTE SEUL (`netOwnership.ownsLocally`),
 * qui jouait alors le Test de Calme du héros d'un invité (classe #1268). Le mint (`bandStep`, via
 * `makeBandFactory`) la pose : plusieurs appelés → `groupOwner`, un seul → SON porteur.
 */
describe('encounterPsychFlow — POSSESSION de la bande (classe #1268)', () => {
  const NET0 = useGame.getState().net;
  afterEach(() => useGame.setState({ net: NET0, pendingCascade: null } as never));

  it('deux héros appelés → fenêtre PARTAGÉE ; un seul → la bande EST la sienne', () => {
    const a = timoreux('A'); a.id = 'psy-a';
    const b = timoreux('B'); b.id = 'psy-b';
    useGame.setState({ party: [a, b], pendingCascade: null, battle: null, net: { ...NET0, mode: 'host', mySeat: 0, slots: [0, 1, 0, 0], ownership: { [b.id]: 1 } } } as never);
    openScriptedPsych(useGame.getState, useGame.setState, 'terreur', 2, 'Une vision', [a, b]);
    const bande = useGame.getState().pendingCascade!.participants[0];
    expect(bande.participants!.map((p) => p.id)).toEqual([a.id, b.id]);
    expect(bande.groupOwner).toBe(true);
    expect(modalOwnerOf(useGame.getState()), 'jamais `undefined` : c’était la fenêtre hôte-seul').toBe('*');

    useGame.setState({ pendingCascade: null });
    openScriptedPsych(useGame.getState, useGame.setState, 'terreur', 2, 'Une vision', [b]);
    const seule = useGame.getState().pendingCascade!.participants[0];
    expect(seule.groupOwner).toBeUndefined();
    expect(seule.actorId).toBe(b.id);
    expect(seatOwns(useGame.getState(), 1, modalOwnerOf(useGame.getState()) as string), 'la fenêtre est au siège qui tient le héros').toBe(true);
    expect(seatOwns(useGame.getState(), 0, modalOwnerOf(useGame.getState()) as string), 'et plus à l’hôte').toBe(false);
  });
});
