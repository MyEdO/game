import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { openRoundStartPsych, openRoundEndCascade } from './combatFlow';
import { FLOWS } from './rollFlowSpecs';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import type { Combatant } from '../engine/types';
import type { BatchParticipant, CascadeStep } from './pendings';
import { addCondition, COND } from '../engine/conditions';
import { modalOwnerOf } from './modalArbiter';

/**
 * Psychologie de COMBAT — régime CASCADE de Round (LDB 21). Les Traits ciblés et les NOUVELLES
 * Terreurs se testent au DÉBUT du Round (l.9 : « un Test de Calme au début du Round »,
 * `openRoundStartPsych`) ; la Peur est un Test ÉTENDU testé à la FIN de chaque Round (l.25,
 * `openRoundEndCascade`). Depuis la VAGUE MULTI (#1117 L2) : chaque collecte ouvre UNE cascade
 * `purpose:'combat'` de BANDES — une étape `kind:'combatPsych'` PAR ENTRÉE DE RÈGLE (type psy +
 * source + cible + Indice), une RANGÉE (`participants`) par héros appelé, ce qui diverge par héros
 * (DR déjà cumulé, Sans Peur) vivant sur la rangée (`meta`). On vérifie ce contrat.
 */

/** Bande COURANTE de la cascade. */
const band = (): CascadeStep => useGame.getState().pendingCascade!.participants[0];
/** Rangée d'un héros dans la bande courante. */
const row = (id: string): BatchParticipant => band().participants!.find((p) => p.id === id)!;
const heroOf = (id: string) => useGame.getState().battle!.combatants.find((c) => c.id === id)!;

describe('Psychologie de combat héros — cascade de Round (Peur/Terreur)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    useGame.setState({ pendingCascade: null, battle: null });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  /** Combat à `n` héros face à UNE source ennemie de Taille `enemySize` (LdV dégagée). */
  function setup(enemySize: Combatant['size'], n = 1) {
    const party = Array.from({ length: n }, (_, i) =>
      createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: `H${i + 1}`, seed: i + 1 }));
    useGame.setState({ party });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const heroes = b.combatants.filter((c) => c.kind === 'hero');
    const enemies = b.combatants.filter((c) => c.kind === 'enemy');
    const E = enemies[0];
    enemies.slice(1).forEach((e) => (e.dead = true)); // une seule source
    E.size = enemySize;
    heroes.forEach((h, i) => (h.pos = { x: 10, y: 10 + i }));
    E.pos = { x: 11, y: 10 }; // Ligne de Vue dégagée
    const turn = b.order.indexOf(heroes[0].id);
    useGame.setState({ battle: { ...b, turn }, pendingCascade: null }); // vide la révélation d'Initiative
    return { H: heroes[0], heroes, E };
  }

  it('Terreur : openRoundStartPsych ouvre la BANDE (déclaration sur l’étape, jet sur la rangée) ; cascadeBatchRoll+cascadeNext applique le Brisé', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup('enorme'); // gap 2 → Terreur 2
    H.characteristics['force-mentale'] = 10; // Test de Calme raté → Brisé
    openRoundStartPsych(useGame.getState, useGame.setState);
    const c = useGame.getState().pendingCascade;
    expect(c).toBeTruthy();
    expect(c!.purpose).toBe('combat');
    expect(band().kind).toBe('combatPsych');
    expect(band().combatPsych?.kind).toBe('terreur');
    expect(band().combatPsych?.sourceId).toBe(E.id);
    // BANDE : le jet vit sur la RANGÉE, jamais sur l'étape (contrat `aggregate:'none'`).
    expect(band().aggregate).toBe('none');
    expect(band().target).toBeUndefined();
    expect(row(H.id).result).toBeNull();

    useGame.getState().cascadeBatchRoll(H.id);
    useGame.getState().cascadeNext();
    const h = heroOf(H.id);
    expect(h.conditions.some((x) => x.id === 'brise')).toBe(true);
    expect((h.psychState ?? []).some((p) => p.type === 'peur' && p.sourceId === E.id)).toBe(true); // la Terreur devient une Peur
    expect(useGame.getState().pendingCascade).toBeNull(); // cascade close (1 rangée)
  });

  it('Peur : openRoundEndCascade ouvre la bande (kind peur) et cumule le DR', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup('grande'); // gap 1 → Peur 1
    openRoundEndCascade(useGame.getState, useGame.setState);
    expect(band().combatPsych?.kind).toBe('peur');
    expect(band().combatPsych?.sourceId).toBe(E.id);
    useGame.getState().cascadeBatchRoll(H.id);
    expect(typeof row(H.id).result!.sl).toBe('number');
    useGame.getState().cascadeNext();
    expect(useGame.getState().pendingCascade).toBeNull();
  });

  it('Peur — Résilience « Je ne faillirai pas ! » par rangée : réussite forcée (DR maximal) + Résilience consommée', () => {
    useGame.getState().seedRng(2);
    const { H } = setup('grande'); // Peur 1 (Indice 1)
    H.resilience = 2;
    openRoundEndCascade(useGame.getState, useGame.setState);
    expect(band().combatPsych?.kind).toBe('peur');

    // Résilience AVANT le jet : réussite garantie (dé 01 → DR max), −1 Résilience. La bande générique
    // force le succès ; l'applier 'combatPsych' cumule le DR vers l'Indice (vainc à ≥ Indice).
    useGame.getState().cascadeBatchForceSuccess(H.id);
    const r = row(H.id).result!;
    expect(r.success).toBe(true);
    expect(r.roll).toBe(1);
    expect(heroOf(H.id).resilience).toBe(1);

    useGame.getState().cascadeNext();
    const peur = (heroOf(H.id).psychState ?? []).find((p) => p.type === 'peur');
    expect(peur).toBeTruthy();
    expect(peur!.calmeDR! >= 1).toBe(true); // DR maximal du dé 01 ≥ Indice 1 → Peur surmontée
  });

  it('Détermination sur une Peur de combat = immunité TEMPORAIRE (LDB 17 l.59), jouée PAR RANGÉE : calmeDR INCHANGÉ, Peur NON surmontée', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup('grande'); // E est une source de Peur (Taille)
    H.resolve = 2;
    const round = useGame.getState().battle!.round;
    // Peur déjà ENTAMÉE (Test étendu) : 1 DR cumulé sur 3 requis, Test de ce Round non encore effectué.
    H.psychState = [{ type: 'peur', sourceId: E.id, indice: 3, calmeDR: 1, lastTestRound: round - 1 }];
    openRoundEndCascade(useGame.getState, useGame.setState);
    expect(band().combatPsych?.kind).toBe('peur');
    // Le DR déjà cumulé est une divergence PAR HÉROS : il vit sur la rangée (charge utile + barre).
    expect(row(H.id).meta?.prevDR).toBe(1);
    expect(row(H.id).extendedDrDone).toBe(1);
    expect(row(H.id).extendedDrTarget).toBe(3);

    // Détermination : NE force PAS le succès — immunité temporaire. -1 Détermination, ActiveEffect psychImmune (2 Rounds).
    useGame.getState().cascadeBatchDetermine(H.id);
    expect(row(H.id).immune).toBe(true);
    const hMid = heroOf(H.id);
    expect(hMid.resolve).toBe(1);
    expect(hMid.activeEffects?.find((e) => e.psychImmune)?.duration).toEqual({ scale: 'rounds', left: 2 });

    useGame.getState().cascadeNext();
    const peur = (heroOf(H.id).psychState ?? []).find((p) => p.type === 'peur' && p.sourceId === E.id)!;
    expect(peur).toBeTruthy();
    expect(peur.calmeDR).toBe(1); // DR INCHANGÉ : la Peur n'a PAS été cumulée…
    expect(peur.calmeDR! >= peur.indice!).toBe(false); // …ni surmontée (toujours sous l'emprise)
    expect(useGame.getState().pendingCascade).toBeNull();
  });

  it('Résilience « Je ne faillirai pas ! » sur une Peur de combat : le DR gagné suit le dé CHOISI (LDB 17 l.68), dé POSÉ offert PAR RANGÉE', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup('grande');
    H.resilience = 2;
    const round = useGame.getState().battle!.round;
    H.psychState = [{ type: 'peur', sourceId: E.id, indice: 6, calmeDR: 0, lastTestRound: round - 1 }];
    openRoundEndCascade(useGame.getState, useGame.setState);
    expect(band().combatPsych?.kind).toBe('peur');

    // forceSuccess (dé par défaut 01 → DR max) PUIS dé CHOISI : on prend un dé MOYEN (réussite à plus
    // faible DR que le 01). Le DR gagné DOIT suivre ce dé (pas rester au max). La surface de pose du dé
    // est celle de la RANGÉE (flux `cascadeBatch`), pas de l'étape.
    useGame.getState().cascadeBatchForceSuccess(H.id);
    const target = row(H.id).result!.target;
    expect(FLOWS.cascadeBatch.picker?.(row(H.id), H)).toBeTruthy();
    const maxDR = row(H.id).result!.sl; // DR du dé 01 (max)
    const chosen = Math.max(1, target - 5); // dé élevé encore réussi → DR plus faible
    useGame.getState().cascadeBatchSetForcedRoll(H.id, chosen);
    const r = row(H.id).result!;
    expect(r.roll).toBe(chosen);
    expect(r.success).toBe(true);
    expect(r.sl).toBeLessThan(maxDR); // le DR gagné SUIT le dé choisi (plus faible qu'au 01)

    useGame.getState().cascadeNext();
    const peur = (heroOf(H.id).psychState ?? []).find((p) => p.type === 'peur' && p.sourceId === E.id)!;
    expect(peur.calmeDR).toBe(r.sl); // le DR cumulé est exactement celui du dé choisi (prevDR 0 + r.sl)
  });

  // LDB 17 l.68 : « au lieu de lancer les dés pour un Test, vous choisissez le résultat » — SANS
  // restriction de forme de Test. Le choix du dé est donc offert AUSSI sur une bande BINAIRE (Terreur) ;
  // ce qui distingue le binaire, c'est que l'ISSUE ne dépend pas du dé : elle reste une réussite.
  it('le dé se choisit AUSSI sur une bande BINAIRE (Terreur) — l’issue reste une réussite', () => {
    useGame.getState().seedRng(2);
    const { H } = setup('enorme'); // Terreur 2 (bande binaire)
    H.resilience = 1;
    openRoundStartPsych(useGame.getState, useGame.setState);
    expect(band().combatPsych?.kind).toBe('terreur');
    useGame.getState().cascadeBatchForceSuccess(H.id);
    expect(FLOWS.cascadeBatch.picker?.(row(H.id), H)).toBeTruthy();
    const chosen = Math.max(1, row(H.id).result!.target - 5);
    useGame.getState().cascadeBatchSetForcedRoll(H.id, chosen);
    const r = row(H.id).result!;
    expect(r.roll).toBe(chosen);
    expect(r.success).toBe(true); // binaire : le dé change le DR affiché, jamais l'issue
  });

  it('Sans Peur (Ennemi, LDB 10 l.1051) : allègement PAR RANGÉE (Calme Accessible +20) ; réussite → Peur ignorée', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup('grande'); // source de Peur 1 (Taille)
    E.groups = ['Ogre'];
    H.talents = [...(H.talents ?? []), { talentId: 'sans-peur', spec: 'Ogre', times: 1 }]; // Sans Peur (Ogre)
    openRoundEndCascade(useGame.getState, useGame.setState);
    expect(band().combatPsych?.kind).toBe('peur');
    // L'allègement est PROPRE au porteur du Talent : il vit sur SA rangée, jamais sur la déclaration.
    expect(row(H.id).meta?.sansPeur).toBe(true);
    expect(row(H.id).difficulty).toBe('accessible');
    expect(row(H.id).target).toBe(row(H.id).base + 20); // Accessible (+20), pas Intermédiaire (+0)

    // Une réussite IGNORE la Peur d'emblée (un seul Test) → DR porté à l'Indice (Peur surmontée).
    useGame.getState().cascadeBatchForceSuccess(H.id);
    useGame.getState().cascadeNext();
    const peur = (heroOf(H.id).psychState ?? []).find((p) => p.type === 'peur' && p.sourceId === E.id)!;
    expect(peur).toBeTruthy();
    expect(peur.calmeDR! >= peur.indice!).toBe(true); // ignorée (vaincue) en un seul Test
  });

  it('pas de source de peur (ennemi de même Taille) → aucune cascade (ni début ni fin de Round)', () => {
    setup('moyenne');
    openRoundStartPsych(useGame.getState, useGame.setState);
    expect(useGame.getState().pendingCascade).toBeNull();
    openRoundEndCascade(useGame.getState, useGame.setState);
    expect(useGame.getState().pendingCascade).toBeNull();
  });

  it('la Peur ne se teste PAS au début de Round (réservée à la fin) ; la Terreur PAS à la fin', () => {
    useGame.getState().seedRng(2);
    setup('grande'); // Peur 1
    openRoundStartPsych(useGame.getState, useGame.setState); // Peur exclue du début → aucune cascade
    expect(useGame.getState().pendingCascade).toBeNull();

    setup('enorme'); // Terreur 2
    openRoundEndCascade(useGame.getState, useGame.setState); // Terreur exclue de la fin → aucune cascade
    expect(useGame.getState().pendingCascade).toBeNull();
  });
});

/**
 * BANDES (#1117 L2) — une fenêtre PAR ENTRÉE DE RÈGLE : deux héros appelés par la MÊME Peur/Terreur
 * (même source, même Indice) tiennent UNE seule étape à deux rangées ; deux entrées distinctes font
 * deux étapes. Le verdict et le cumul restent PAR RANGÉE.
 */
describe('Psychologie de combat — regroupement en BANDES', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    useGame.setState({ pendingCascade: null, battle: null });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  /** Combat à 2 héros face à 2 ennemis (LdV dégagée), sans Peur de Taille par défaut. */
  function duo() {
    const party = [1, 2].map((i) =>
      createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: `H${i}`, seed: i }));
    useGame.setState({ party });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const [A, B] = b.combatants.filter((c) => c.kind === 'hero');
    const enemies = b.combatants.filter((c) => c.kind === 'enemy');
    const [E1, E2] = enemies;
    enemies.slice(2).forEach((e) => (e.dead = true));
    A.pos = { x: 10, y: 10 };
    B.pos = { x: 10, y: 11 };
    E1.pos = { x: 11, y: 10 };
    if (E2) E2.pos = { x: 11, y: 11 };
    for (const c of [A, B, E1, ...(E2 ? [E2] : [])]) { c.size = 'moyenne'; c.causesPeur = undefined; c.causesTerreur = undefined; }
    useGame.setState({ battle: { ...b, turn: b.order.indexOf(A.id) }, pendingCascade: null });
    return { A, B, E1, E2 };
  }

  it('DÉBUT de Round : deux héros au MÊME Trait ciblé → UNE étape à DEUX rangées (une fenêtre, pas « jet 1/2 »)', () => {
    useGame.getState().seedRng(7);
    const { A, B, E1 } = duo();
    E1.groups = ['Mort-vivant'];
    for (const h of [A, B]) {
      h.psychTraits = [{ type: 'animosite', cible: 'Mort-vivant' }];
      h.characteristics['force-mentale'] = 1; // Test de Calme raté quasi sûr
    }
    openRoundStartPsych(useGame.getState, useGame.setState);
    const c = useGame.getState().pendingCascade!;
    expect(c.participants.length).toBe(1);
    expect(c.participants[0].combatPsych?.kind).toBe('animosite');
    expect(c.participants[0].participants!.map((p) => p.id)).toEqual([A.id, B.id]);
    // La bande n'est PRÊTE qu'une fois toutes ses rangées jouées — puis la cascade se clôt d'un coup.
    useGame.getState().cascadeBatchRoll(A.id);
    useGame.getState().cascadeNext();
    expect(useGame.getState().pendingCascade!.cursor).toBe(0); // rangée B pas encore jouée
    useGame.getState().cascadeBatchRoll(B.id);
    useGame.getState().cascadeNext();
    expect(useGame.getState().pendingCascade).toBeNull();
    const psy = useGame.getState().battle!.combatants
      .filter((x) => x.kind === 'hero')
      .map((h) => (h.psychState ?? []).filter((p) => p.type === 'animosite').length);
    expect(psy).toEqual([1, 1]); // chaque rangée a reçu SA conséquence
  });

  // POSSESSION de la bande (#1262 V2 lot 3) : le mint la pose — plusieurs porteurs → fenêtre PARTAGÉE,
  // un seul → SON `actorId`. Un owner `undefined` rendrait la fenêtre à l'HÔTE SEUL (`modalArbiter`,
  // entrée `cascade`) : l'hôte roulerait le Test de Calme du héros d'un invité (classe #1268).
  it('POSSESSION : deux héros appelés → fenêtre PARTAGÉE ; un seul → la bande EST la sienne', () => {
    useGame.getState().seedRng(7);
    const { A, B, E1 } = duo();
    E1.groups = ['Mort-vivant'];
    for (const h of [A, B]) h.psychTraits = [{ type: 'animosite', cible: 'Mort-vivant' }];
    openRoundStartPsych(useGame.getState, useGame.setState);
    const deux = useGame.getState().pendingCascade!.participants[0];
    expect(deux.groupOwner).toBe(true);
    expect(modalOwnerOf(useGame.getState())).toBe('*');

    useGame.setState({ pendingCascade: null });
    A.psychTraits = [];
    openRoundStartPsych(useGame.getState, useGame.setState);
    const seule = useGame.getState().pendingCascade!.participants[0];
    expect(seule.participants!.map((p) => p.id)).toEqual([B.id]);
    expect(seule.groupOwner).toBeUndefined();
    expect(seule.actorId).toBe(B.id);
    expect(modalOwnerOf(useGame.getState())).toBe(B.id);
  });

  it('FIN de Round : deux héros craignant la MÊME source → une bande ; deux sources → deux bandes', () => {
    useGame.getState().seedRng(3);
    const { A, B, E1, E2 } = duo();
    E1.causesPeur = 2;
    openRoundEndCascade(useGame.getState, useGame.setState);
    const bandes = useGame.getState().pendingCascade!.participants.filter((s) => s.kind === 'combatPsych');
    expect(bandes.length).toBe(1);
    expect(bandes[0].participants!.map((p) => p.id)).toEqual([A.id, B.id]);

    // Deux sources DISTINCTES (deux entrées de règle) → deux fenêtres. Un héros ne teste qu'UNE Peur
    // par Round (`collectHeroRoundEndPsych`) : A a déjà vaincu celle de E1, sa Peur DUE est celle de E2.
    useGame.setState({ pendingCascade: null });
    E1.causesPeur = 2;
    E2!.causesPeur = 3;
    const b = useGame.getState().battle!;
    A.psychState = [{ type: 'peur', sourceId: E1.id, indice: 2, calmeDR: 2 }];
    B.psychState = [];
    useGame.setState({ battle: { ...b, round: b.round + 1 } });
    openRoundEndCascade(useGame.getState, useGame.setState);
    const deux = useGame.getState().pendingCascade!.participants.filter((s) => s.kind === 'combatPsych');
    expect(deux.length).toBe(2);
    expect(deux.map((s) => s.combatPsych!.sourceId)).toEqual([E2!.id, E1.id]); // ordre de première rencontre
    expect(deux.map((s) => s.participants!.map((p) => p.id))).toEqual([[A.id], [B.id]]);
  });

  it('Test ÉTENDU par rangée (LDB 21 l.25) : le cumul progresse d’un Round à l’autre, la bande suivante part du DR déjà gagné', () => {
    useGame.getState().seedRng(3);
    const { A, B, E1 } = duo();
    E1.causesPeur = 6; // Indice élevé : le Test étendu ne se solde pas en un Round
    openRoundEndCascade(useGame.getState, useGame.setState);
    const bande1 = useGame.getState().pendingCascade!.participants.find((s) => s.kind === 'combatPsych')!;
    expect(bande1.participants!.every((p) => (p.meta?.prevDR ?? 0) === 0)).toBe(true);
    // Réussites FORCÉES (dé 01 → DR max) : chaque rangée gagne son propre DR.
    for (const h of [A, B]) { h.resilience = 2; }
    useGame.getState().cascadeBatchForceSuccess(A.id);
    useGame.getState().cascadeBatchForceSuccess(B.id);
    const jouee = useGame.getState().pendingCascade!.participants.find((s) => s.kind === 'combatPsych')!;
    const gagne = Object.fromEntries(jouee.participants!.map((p) => [p.id, p.result!.sl]));
    useGame.getState().cascadeNext();
    const drOf = (id: string) => (useGame.getState().battle!.combatants.find((c) => c.id === id)!.psychState ?? [])
      .find((p) => p.type === 'peur' && p.sourceId === E1.id)!.calmeDR ?? 0;
    expect(drOf(A.id)).toBe(gagne[A.id]);
    expect(drOf(B.id)).toBe(gagne[B.id]);
    expect(drOf(A.id)).toBeGreaterThan(0);

    // Round suivant : la MÊME entrée de règle → une bande, dont CHAQUE rangée part de SON cumul.
    const b = useGame.getState().battle!;
    useGame.setState({ battle: { ...b, round: b.round + 1 }, pendingCascade: null });
    openRoundEndCascade(useGame.getState, useGame.setState);
    const bande2 = useGame.getState().pendingCascade!.participants.find((s) => s.kind === 'combatPsych')!;
    expect(bande2.participants!.length).toBe(2);
    for (const p of bande2.participants!) {
      expect(p.meta?.prevDR).toBe(drOf(p.id));
      expect(p.extendedDrDone).toBe(drOf(p.id));
      expect(p.extendedDrTarget).toBe(6);
    }
    // …et le cumul CONTINUE de progresser à ce second Round.
    useGame.getState().cascadeBatchForceSuccess(A.id);
    const avant = drOf(A.id);
    useGame.getState().cascadeBatchForceSuccess(B.id);
    useGame.getState().cascadeNext();
    expect(drOf(A.id)).toBeGreaterThan(avant);
  });

  it('ORDRE de fin de Round : tous les upkeeps INFLUENÇABLES précèdent les bandes de Peur', () => {
    useGame.getState().seedRng(5);
    const { A, B, E1 } = duo();
    E1.causesPeur = 2;
    for (const h of [A, B]) addCondition(h, COND.empoisonne, 2);
    openRoundEndCascade(useGame.getState, useGame.setState);
    const kinds = useGame.getState().pendingCascade!.participants.map((s) => s.kind);
    expect(kinds.filter((k) => k === 'combatPsych').length).toBe(1);
    expect(kinds.lastIndexOf('triggeredTest')).toBeLessThan(kinds.indexOf('combatPsych'));
  });

  /**
   * SONDE A (juge) — Test ÉTENDU sur 2 Rounds dont un ÉCHEC : `LDB 12` (Tests étendus) borne le cumul
   * par le BAS (le total ne descend pas sous 0), et le Round suivant repart de ce total, pas de zéro.
   */
  it('cumul étendu : un Round RATÉ retire les DR négatifs (plancher 0), le Round suivant repart du total réel', () => {
    useGame.getState().seedRng(3);
    const { A, E1 } = duo();
    E1.causesPeur = 6;
    const b0 = useGame.getState().battle!;
    A.psychState = [{ type: 'peur', sourceId: E1.id, indice: 6, calmeDR: 1, lastTestRound: b0.round - 1 }];
    openRoundEndCascade(useGame.getState, useGame.setState);
    const bande1 = useGame.getState().pendingCascade!.participants.find((s) => s.kind === 'combatPsych')!;
    // Jet POSÉ : échec à DR −3 sur la rangée de A (1 + (−3) → planché à 0).
    const rows1 = bande1.participants!.map((p) => ({ ...p, result: { roll: 99, target: p.target, sl: -3, success: false } }));
    const pc1 = useGame.getState().pendingCascade!;
    useGame.setState({ pendingCascade: { ...pc1, participants: pc1.participants.map((s) => (s === bande1 ? { ...s, participants: rows1 } : s)) } });
    useGame.getState().cascadeNext();
    const drOf = (id: string) => (useGame.getState().battle!.combatants.find((c) => c.id === id)!.psychState ?? [])
      .find((p) => p.type === 'peur' && p.sourceId === E1.id)!.calmeDR ?? 0;
    expect(drOf(A.id)).toBe(0); // planché, jamais négatif

    // Round suivant : RÉUSSITE à DR +2 → le cumul repart de 0 et vaut 2 (pas 2 − 3, pas 1 + 2).
    const b = useGame.getState().battle!;
    useGame.setState({ battle: { ...b, round: b.round + 1 }, pendingCascade: null });
    openRoundEndCascade(useGame.getState, useGame.setState);
    const bande2 = useGame.getState().pendingCascade!.participants.find((s) => s.kind === 'combatPsych')!;
    expect(bande2.participants!.find((p) => p.id === A.id)!.meta?.prevDR).toBe(0);
    const rows2 = bande2.participants!.map((p) => ({ ...p, result: { roll: 1, target: p.target, sl: 2, success: true } }));
    const pc2 = useGame.getState().pendingCascade!;
    useGame.setState({ pendingCascade: { ...pc2, participants: pc2.participants.map((s) => (s === bande2 ? { ...s, participants: rows2 } : s)) } });
    useGame.getState().cascadeNext();
    expect(drOf(A.id)).toBe(2);
  });

  /**
   * SONDE B (juge) — une bande peut porter DEUX Difficultés : la clé est l'entrée de RÈGLE, pas le
   * Test de chacun. Sans Peur (LDB 10 l.1051) allège la SEULE rangée de son porteur.
   */
  it('DEUX difficultés dans UNE bande : le porteur de Sans Peur teste en Accessible, l’autre en Intermédiaire', () => {
    useGame.getState().seedRng(3);
    const { A, B, E1 } = duo();
    E1.causesPeur = 2;
    E1.groups = ['Ogre'];
    A.talents = [...(A.talents ?? []), { talentId: 'sans-peur', spec: 'Ogre', times: 1 }];
    openRoundEndCascade(useGame.getState, useGame.setState);
    const bande = useGame.getState().pendingCascade!.participants.find((s) => s.kind === 'combatPsych')!;
    expect(bande.participants!.map((p) => p.id)).toEqual([A.id, B.id]); // UNE fenêtre malgré la divergence
    const [ra, rb] = bande.participants!;
    expect([ra.difficulty, rb.difficulty]).toEqual(['accessible', 'intermediaire']);
    expect(ra.meta?.sansPeur).toBe(true);
    expect(rb.meta?.sansPeur).toBeUndefined();
    expect(ra.target - ra.base).toBe(20);
    expect(rb.target - rb.base).toBe(0);
  });

  /**
   * SONDE Bbis (juge) — pénalité d'ÉTAT : LDB 16 (États) « -10 à tous vos Tests » par palier. La
   * rangée doit la SUBIR (cible) et la NOMMER (chip), jamais la fondre ni l'oublier.
   */
  it('pénalité d’État (LDB 16) : la cible de la rangée la subit ET la ligne la NOMME', () => {
    useGame.getState().seedRng(3);
    const { A, B, E1 } = duo();
    E1.causesPeur = 2;
    addCondition(A, COND.brise, 2); // −20 sur les Tests de A
    openRoundEndCascade(useGame.getState, useGame.setState);
    const bande = useGame.getState().pendingCascade!.participants.find((s) => s.kind === 'combatPsych')!;
    const ra = bande.participants!.find((p) => p.id === A.id)!;
    const rb = bande.participants!.find((p) => p.id === B.id)!;
    // La pénalité MORD sur la cible (Difficulté Intermédiaire = +0) — A et B n'ont pas le même Calme,
    // chacun se compare donc à SA base.
    expect(ra.target).toBe(ra.base - 20);
    expect(rb.target).toBe(rb.base);
    // …et elle est NOMMÉE (chip), jamais fondue dans la base : base + Σ mods + Difficulté === cible.
    const somme = ra.base + (ra.mods ?? []).reduce((s, m) => s + m.value, 0);
    expect(somme).toBe(ra.target);
    expect((ra.mods ?? []).some((m) => m.value === -20 && m.label.length > 0)).toBe(true);
    expect(rb.mods ?? []).toEqual([]); // B n'a aucun État : aucune chip inventée
  });
});
