import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { openRoundStartPsych, openRoundEndCascade } from './combatFlow';
import { FLOWS } from './rollFlowSpecs';
import { jete } from '../engine/tests.testkit';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import type { Combatant } from '../engine/types';
import type { BatchParticipant, CascadeStep } from './pendings';
import { addCondition, COND } from '../engine/conditions';
import { modalOwnerOf } from './modalArbiter';
import { ligneDe } from '../engine/modLine.testkit';
import { t } from '../i18n';
import { sansPeurLabel } from '../engine/psychology';
import { ciblePsy } from '../engine/psych/ciblage';
import { actorIn } from './monde/combatants';
import { nomDe } from '../engine/nom';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * Psychologie de COMBAT — passes de Round (LDB 21 l.9, l.25) : `openRoundStartPsych`,
 * `openRoundEndCascade`. Depuis la VAGUE MULTI (#1117 L2) : chaque collecte ouvre UNE cascade
 * `purpose:'combat'` de BANDES — une étape `kind:'psychologieDeCombat'` PAR ENTRÉE DE RÈGLE (type psy +
 * source + cible + Indice), une RANGÉE (`participants`) par héros appelé, ce qui diverge par héros
 * (DR déjà cumulé, Sans Peur) vivant sur la rangée (`meta`). On vérifie ce contrat.
 */

/** Bande COURANTE de la cascade. */
const band = (): CascadeStep => banc.getState().pendingCascade!.participants[0];
/** Rangée d'un héros dans la bande courante. */
const row = (id: string): BatchParticipant => band().participants!.find((p) => p.id === id)!;
const jet = (id: string) => jete(row(id).result);
const heroOf = (id: string) => banc.getState().battle!.combatants.find((c) => c.id === id)!;

describe('Psychologie de combat héros — cascade de Round (Peur/Terreur)', () => {
  beforeEach(() => {
    banc.setState({ pendingCascade: null, battle: null });
  });

  /** Combat à `n` héros face à UNE source ennemie de Taille `enemySize` (LdV dégagée). */
  function setup(enemySize: Combatant['size'], n = 1) {
    const party = Array.from({ length: n }, (_, i) =>
      createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: `H${i + 1}`, seed: i + 1 }));
    banc.setState({ party });
    banc.getState().lancerLaScene(testScene());
    banc.getState().lancerLeCombat('enc-mutants');
    banc.getState().fenetreValider('debutDuRound');
    banc.abandonner();
    const b = banc.getState().battle!;
    const heroes = b.combatants.filter((c) => c.kind === 'heros');
    const enemies = b.combatants.filter((c) => c.kind === 'ennemi');
    const E = enemies[0];
    enemies.slice(1).forEach((e) => (e.dead = true)); // une seule source
    E.size = enemySize;
    heroes.forEach((h, i) => (h.pos = { x: 10, y: 10 + i }));
    E.pos = { x: 11, y: 10 }; // Ligne de Vue dégagée
    const turn = b.order.indexOf(heroes[0].id);
    banc.setState({ battle: { ...b, turn }, pendingCascade: null }); // vide la révélation d'Initiative
    // La Taille déplace le maximum des Blessures : l'écriture a copié l'ennemi, les acteurs se relisent par leur id.
    const lu = (c: Combatant) => actorIn(banc.getState(), c.id)!;
    return { H: lu(heroes[0]), heroes: heroes.map(lu), E: lu(E) };
  }

  it('Terreur : openRoundStartPsych ouvre la BANDE (déclaration sur l’étape, jet sur la rangée) ; jetLancer@cascadeEnBande+jetValider@cascade applique le Brisé', () => {
    banc.getState().ensemencerLeTirage(2);
    const { H, E } = setup('enorme'); // gap 2 → Terreur 2
    H.characteristics['force-mentale'] = 10; // Test de Calme raté → Brisé
    openRoundStartPsych(banc.getState, banc.setState);
    const c = banc.getState().pendingCascade;
    expect(c).toBeTruthy();
    expect(c!.purpose).toBe('combat');
    expect(band().kind).toBe('psychologieDeCombat');
    expect(band().psychologieDeCombat?.kind).toBe('terreur');
    expect(band().psychologieDeCombat?.sourceId).toBe(E.id);
    // BANDE : le jet vit sur la RANGÉE, jamais sur l'étape (contrat `aggregate:'none'`).
    expect(band().aggregate).toBe('none');
    expect(band().target).toBeUndefined();
    expect(row(H.id).result).toBeNull();

    banc.getState().jetLancer('cascadeEnBande', H.id);
    banc.getState().jetValider('cascade');
    const h = heroOf(H.id);
    expect(h.conditions.some((x) => x.id === 'brise')).toBe(true);
    expect((h.psychState ?? []).some((p) => p.type === 'peur' && p.sourceId === E.id)).toBe(true); // la Terreur devient une Peur
    expect(banc.getState().pendingCascade).toBeNull(); // cascade close (1 rangée)
  });

  it('Peur : openRoundEndCascade ouvre la bande (kind peur) et cumule le DR', () => {
    banc.getState().ensemencerLeTirage(2);
    const { H, E } = setup('grande'); // gap 1 → Peur 1
    openRoundEndCascade(banc.getState, banc.setState);
    expect(band().psychologieDeCombat?.kind).toBe('peur');
    expect(band().psychologieDeCombat?.sourceId).toBe(E.id);
    banc.getState().jetLancer('cascadeEnBande', H.id);
    expect(typeof row(H.id).result!.sl).toBe('number');
    banc.getState().jetValider('cascade');
    expect(banc.getState().pendingCascade).toBeNull();
  });

  it('Peur — Résilience « Je ne faillirai pas ! » par rangée : réussite forcée (DR maximal) + Résilience consommée', () => {
    banc.getState().ensemencerLeTirage(2);
    const { H } = setup('grande'); // Peur 1 (Indice 1)
    H.resilience = 2;
    openRoundEndCascade(banc.getState, banc.setState);
    expect(band().psychologieDeCombat?.kind).toBe('peur');

    // Résilience AVANT le jet : réussite garantie (dé 01 → DR max), −1 Résilience. La bande générique
    // force le succès ; l'applier 'psychologieDeCombat' cumule le DR vers l'Indice (vainc à ≥ Indice).
    banc.getState().jetForcerLaReussite('cascadeEnBande', H.id);
    const r = row(H.id).result!;
    expect(r.success).toBe(true);
    expect(r.roll).toBe(1);
    expect(heroOf(H.id).resilience).toBe(1);

    banc.getState().jetValider('cascade');
    const peur = (heroOf(H.id).psychState ?? []).find((p) => p.type === 'peur');
    expect(peur).toBeTruthy();
    expect(peur!.calmeDR! >= 1).toBe(true); // DR maximal du dé 01 ≥ Indice 1…
    expect(peur!.surmontee).toBe(true); // …→ Peur surmontée
  });

  it('Détermination sur une Peur de combat = immunité TEMPORAIRE (LDB 17 l.59), jouée PAR RANGÉE : calmeDR INCHANGÉ, Peur NON surmontée', () => {
    banc.getState().ensemencerLeTirage(2);
    const { H, E } = setup('grande'); // E est une source de Peur (Taille)
    H.resolve = 2;
    const clos = banc.getState().battle!.round - 1; // le Round que clôt `openRoundEndCascade`
    // Peur déjà ENTAMÉE (Test étendu) : 1 DR cumulé sur 3 requis, Test de ce Round non encore effectué.
    H.psychState = [{ type: 'peur', sourceId: E.id, indice: 3, calmeDR: 1, lastTestRound: clos - 1 }];
    openRoundEndCascade(banc.getState, banc.setState);
    expect(band().psychologieDeCombat?.kind).toBe('peur');
    // Le DR déjà cumulé est une divergence PAR HÉROS : il vit sur la rangée (charge utile + barre).
    expect(row(H.id).extendedDrDone).toBe(1);
    expect(row(H.id).extendedDrTarget).toBe(3);

    // Détermination : NE force PAS le succès — immunité temporaire. -1 Détermination, ActiveEffect psychImmune (2 Rounds).
    banc.getState().depenserLaDetermination(H.id, 'immuniserALaPsychologie');
    expect(row(H.id).immune).toBe(true);
    const hMid = heroOf(H.id);
    expect(hMid.resolve).toBe(1);
    expect(hMid.activeEffects?.find((e) => e.psychImmune)?.duration).toEqual({ scale: 'rounds', left: 2 });

    banc.getState().jetValider('cascade');
    const peur = (heroOf(H.id).psychState ?? []).find((p) => p.type === 'peur' && p.sourceId === E.id)!;
    expect(peur).toBeTruthy();
    expect(peur.calmeDR).toBe(1); // DR INCHANGÉ : la Peur n'a PAS été cumulée…
    expect(peur.surmontee).toBeUndefined(); // …ni surmontée (toujours sous l'emprise)
    expect(banc.getState().pendingCascade).toBeNull();
  });

  it('Résilience « Je ne faillirai pas ! » sur une Peur de combat : le DR gagné suit le dé CHOISI (LDB 17 l.68), dé POSÉ offert PAR RANGÉE', () => {
    banc.getState().ensemencerLeTirage(2);
    const { H, E } = setup('grande');
    H.resilience = 2;
    const clos = banc.getState().battle!.round - 1; // le Round que clôt `openRoundEndCascade`
    H.psychState = [{ type: 'peur', sourceId: E.id, indice: 6, calmeDR: 0, lastTestRound: clos - 1 }];
    openRoundEndCascade(banc.getState, banc.setState);
    expect(band().psychologieDeCombat?.kind).toBe('peur');

    // forceSuccess (dé par défaut 01 → DR max) PUIS dé CHOISI : on prend un dé MOYEN (réussite à plus
    // faible DR que le 01). Le DR gagné DOIT suivre ce dé (pas rester au max). La surface de pose du dé
    // est celle de la RANGÉE (flux `cascadeEnBande`), pas de l'étape.
    banc.getState().jetForcerLaReussite('cascadeEnBande', H.id);
    const target = jet(H.id).target;
    expect(FLOWS.cascadeEnBande.picker?.(row(H.id), H)).toBeTruthy();
    const maxDR = row(H.id).result!.sl; // DR du dé 01 (max)
    const chosen = Math.max(1, target - 5); // dé élevé encore réussi → DR plus faible
    banc.getState().jetImposerLeResultat('cascadeEnBande', chosen, H.id);
    const r = row(H.id).result!;
    expect(r.roll).toBe(chosen);
    expect(r.success).toBe(true);
    expect(r.sl).toBeLessThan(maxDR); // le DR gagné SUIT le dé choisi (plus faible qu'au 01)

    banc.getState().jetValider('cascade');
    const peur = (heroOf(H.id).psychState ?? []).find((p) => p.type === 'peur' && p.sourceId === E.id)!;
    expect(peur.calmeDR).toBe(r.sl); // le DR cumulé est exactement celui du dé choisi (prevDR 0 + r.sl)
  });

  // LDB 17 l.68 : « au lieu de lancer les dés pour un Test, vous choisissez le résultat » — SANS
  // restriction de forme de Test. Le choix du dé est donc offert AUSSI sur une bande BINAIRE (Terreur) ;
  // ce qui distingue le binaire, c'est que l'ISSUE ne dépend pas du dé : elle reste une réussite.
  it('le dé se choisit AUSSI sur une bande BINAIRE (Terreur) — l’issue reste une réussite', () => {
    banc.getState().ensemencerLeTirage(2);
    const { H } = setup('enorme'); // Terreur 2 (bande binaire)
    H.resilience = 1;
    openRoundStartPsych(banc.getState, banc.setState);
    expect(band().psychologieDeCombat?.kind).toBe('terreur');
    banc.getState().jetForcerLaReussite('cascadeEnBande', H.id);
    expect(FLOWS.cascadeEnBande.picker?.(row(H.id), H)).toBeTruthy();
    const chosen = Math.max(1, jet(H.id).target - 5);
    banc.getState().jetImposerLeResultat('cascadeEnBande', chosen, H.id);
    const r = row(H.id).result!;
    expect(r.roll).toBe(chosen);
    expect(r.success).toBe(true); // binaire : le dé change le DR affiché, jamais l'issue
  });

  it('Sans Peur (Ennemi, LDB 10 l.1051) : allègement PAR RANGÉE (Calme Accessible +20) ; réussite → Peur ignorée', () => {
    banc.getState().ensemencerLeTirage(2);
    const { H, E } = setup('grande'); // source de Peur 1 (Taille)
    E.groups = ['ogre'];
    H.talents = [...(H.talents ?? []), { talentId: 'sans-peur', spec: 'ogre', times: 1 }]; // Sans Peur (Ogre)
    openRoundEndCascade(banc.getState, banc.setState);
    expect(band().psychologieDeCombat?.kind).toBe('peur');
    // L'allègement est PROPRE au porteur du Talent : il vit sur SA rangée, jamais sur la déclaration.
    expect(row(H.id).meta?.sansPeur).toBe(true);
    expect(row(H.id).difficulty).toBe('accessible');
    expect(row(H.id).target).toBe(row(H.id).base + 20); // Accessible (+20), pas Intermédiaire (+0)

    // Une réussite IGNORE la Peur d'emblée (un seul Test) → DR porté à l'Indice (Peur surmontée).
    banc.getState().jetForcerLaReussite('cascadeEnBande', H.id);
    banc.getState().jetValider('cascade');
    const peur = (heroOf(H.id).psychState ?? []).find((p) => p.type === 'peur' && p.sourceId === E.id)!;
    expect(peur).toBeTruthy();
    expect(peur.surmontee).toBe(true); // ignorée en un seul Test
  });

  it('Sans Peur RATÉ face à une Peur 0 : surmontée par le Test étendu, jamais « ignorée » (LDB 10 l.1051 ; LDB 85 l.122)', () => {
    banc.getState().ensemencerLeTirage(2);
    const { H, E } = setup('moyenne');
    E.groups = ['ogre'];
    H.psychTraits = [{ type: 'phobie', cible: ciblePsy.groupe('ogre'), indice: 0 }];
    H.talents = [...(H.talents ?? []), { talentId: 'sans-peur', spec: 'ogre', times: 1 }];
    openRoundEndCascade(banc.getState, banc.setState);
    expect(band().psychologieDeCombat).toMatchObject({ kind: 'peur', indice: 0 });
    expect(row(H.id).meta?.sansPeur).toBe(true);
    const pc = banc.getState().pendingCascade!;
    const participants = band().participants!.map((p) => ({ ...p, result: { roll: 99, target: p.target, sl: -2, success: false } }));
    banc.setState({ pendingCascade: { ...pc, participants: [{ ...band(), participants }, ...pc.participants.slice(1)] } });
    const rangee = row(H.id); // l'applier écrit SON verdict sur cette rangée (la cascade se ferme après)
    banc.getState().jetValider('cascade');
    expect((heroOf(H.id).psychState ?? []).find((p) => p.type === 'peur' && p.sourceId === E.id)?.surmontee).toBe(true);
    const journal = rangee.outcome!.map((l) => l.text);
    expect(journal).toContain(t('out.fearOvercome', { name: nomDe(H), foe: nomDe(E) }));
    expect(journal).not.toContain(t('turn.fearVanquished', { name: nomDe(H), foe: nomDe(E), talent: sansPeurLabel() }));
  });

  it('pas de source de peur (ennemi de même Taille) → aucune cascade (ni début ni fin de Round)', () => {
    setup('moyenne');
    openRoundStartPsych(banc.getState, banc.setState);
    expect(banc.getState().pendingCascade).toBeNull();
    openRoundEndCascade(banc.getState, banc.setState);
    expect(banc.getState().pendingCascade).toBeNull();
  });

  it('la Peur s’enregistre au début du Round sans Test (LDB 21 l.25) ; la Terreur ne se teste PAS à la fin', () => {
    banc.getState().ensemencerLeTirage(2);
    const { H, E } = setup('grande'); // Peur 1
    openRoundStartPsych(banc.getState, banc.setState); // Peur enregistrée, testée à la fin → aucune cascade
    expect(banc.getState().pendingCascade).toBeNull();
    expect(heroOf(H.id).psychState).toEqual([{ type: 'peur', sourceId: E.id, indice: 1, calmeDR: 0 }]);

    setup('enorme'); // Terreur 2
    openRoundEndCascade(banc.getState, banc.setState); // Terreur exclue de la fin → aucune cascade
    expect(banc.getState().pendingCascade).toBeNull();
  });
});

/**
 * BANDES (#1117 L2) — une fenêtre PAR ENTRÉE DE RÈGLE : deux héros appelés par la MÊME Peur/Terreur
 * (même source, même Indice) tiennent UNE seule étape à deux rangées ; deux entrées distinctes font
 * deux étapes. Le verdict et le cumul restent PAR RANGÉE.
 */
describe('Psychologie de combat — regroupement en BANDES', () => {
  beforeEach(() => {
    banc.setState({ pendingCascade: null, battle: null });
  });

  /** Combat à 2 héros face à 2 ennemis (LdV dégagée), sans Peur de Taille par défaut. */
  function duo() {
    const party = [1, 2].map((i) =>
      createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: `H${i}`, seed: i }));
    banc.setState({ party });
    banc.getState().lancerLaScene(testScene());
    banc.getState().lancerLeCombat('enc-mutants');
    banc.getState().fenetreValider('debutDuRound');
    banc.abandonner();
    const b = banc.getState().battle!;
    const [A, B] = b.combatants.filter((c) => c.kind === 'heros');
    const enemies = b.combatants.filter((c) => c.kind === 'ennemi');
    const [E1, E2] = enemies;
    enemies.slice(2).forEach((e) => (e.dead = true));
    A.pos = { x: 10, y: 10 };
    B.pos = { x: 10, y: 11 };
    E1.pos = { x: 11, y: 10 };
    if (E2) E2.pos = { x: 11, y: 11 };
    for (const c of [A, B, E1, ...(E2 ? [E2] : [])]) { c.size = 'moyenne'; c.causesPeur = undefined; c.causesTerreur = undefined; }
    banc.setState({ battle: { ...b, turn: b.order.indexOf(A.id) }, pendingCascade: null });
    return { A, B, E1, E2 };
  }

  it('DÉBUT de Round : deux héros au MÊME Trait ciblé → UNE étape à DEUX rangées (une fenêtre, pas « jet 1/2 »)', () => {
    banc.getState().ensemencerLeTirage(7);
    const { A, B, E1 } = duo();
    E1.groups = ['mort-vivant'];
    for (const h of [A, B]) {
      h.psychTraits = [{ type: 'animosite', cible: ciblePsy.groupe('mort-vivant') }];
      h.characteristics['force-mentale'] = 1; // Test de Calme raté quasi sûr
    }
    openRoundStartPsych(banc.getState, banc.setState);
    const c = banc.getState().pendingCascade!;
    expect(c.participants.length).toBe(1);
    expect(c.participants[0].psychologieDeCombat?.kind).toBe('animosite');
    expect(c.participants[0].participants!.map((p) => p.id)).toEqual([A.id, B.id]);
    // La bande n'est PRÊTE qu'une fois toutes ses rangées jouées — puis la cascade se clôt d'un coup.
    banc.getState().jetLancer('cascadeEnBande', A.id);
    banc.getState().jetValider('cascade');
    expect(banc.getState().pendingCascade!.cursor).toBe(0); // rangée B pas encore jouée
    banc.getState().jetLancer('cascadeEnBande', B.id);
    banc.getState().jetValider('cascade');
    expect(banc.getState().pendingCascade).toBeNull();
    const psy = banc.getState().battle!.combatants
      .filter((x) => x.kind === 'heros')
      .map((h) => (h.psychState ?? []).filter((p) => p.type === 'animosite').length);
    expect(psy).toEqual([1, 1]); // chaque rangée a reçu SA conséquence
  });

  // POSSESSION de la bande (#1262 V2 lot 3) : le mint la pose — plusieurs porteurs → fenêtre PARTAGÉE,
  // un seul → SON `actorId`. Un owner `undefined` rendrait la fenêtre à l'HÔTE SEUL (`modalArbiter`,
  // entrée `cascade`) : l'hôte roulerait le Test de Calme du héros d'un invité (classe #1268).
  it('POSSESSION : deux héros appelés → fenêtre PARTAGÉE ; un seul → la bande EST la sienne', () => {
    banc.getState().ensemencerLeTirage(7);
    const { A, B, E1 } = duo();
    E1.groups = ['mort-vivant'];
    for (const h of [A, B]) h.psychTraits = [{ type: 'animosite', cible: ciblePsy.groupe('mort-vivant') }];
    openRoundStartPsych(banc.getState, banc.setState);
    const deux = banc.getState().pendingCascade!.participants[0];
    expect(deux.groupOwner).toBe(true);
    expect(modalOwnerOf(banc.getState())).toBe('*');

    banc.setState({ pendingCascade: null });
    A.psychTraits = [];
    openRoundStartPsych(banc.getState, banc.setState);
    const seule = banc.getState().pendingCascade!.participants[0];
    expect(seule.participants!.map((p) => p.id)).toEqual([B.id]);
    expect(seule.groupOwner).toBeUndefined();
    expect(seule.actorId).toBe(B.id);
    expect(modalOwnerOf(banc.getState())).toBe(B.id);
  });

  it('FIN de Round : deux héros craignant la MÊME source → une bande ; deux sources → deux bandes', () => {
    banc.getState().ensemencerLeTirage(3);
    const { A, B, E1, E2 } = duo();
    E1.causesPeur = 2;
    openRoundEndCascade(banc.getState, banc.setState);
    const bandes = banc.getState().pendingCascade!.participants.filter((s) => s.kind === 'psychologieDeCombat');
    expect(bandes.length).toBe(1);
    expect(bandes[0].participants!.map((p) => p.id)).toEqual([A.id, B.id]);

    // Deux sources DISTINCTES (deux entrées de règle) → deux fenêtres ; chaque Peur due a sa rangée
    // (LDB 21 l.25) : A a déjà vaincu celle de E1, B craint les deux.
    banc.setState({ pendingCascade: null });
    E1.causesPeur = 2;
    E2!.causesPeur = 3;
    const b = banc.getState().battle!;
    A.psychState = [{ type: 'peur', sourceId: E1.id, indice: 2, calmeDR: 2, surmontee: true }];
    B.psychState = [];
    banc.setState({ battle: { ...b, round: b.round + 1 } });
    openRoundEndCascade(banc.getState, banc.setState);
    const deux = banc.getState().pendingCascade!.participants.filter((s) => s.kind === 'psychologieDeCombat');
    expect(deux.length).toBe(2);
    expect(deux.map((s) => s.psychologieDeCombat!.sourceId).sort()).toEqual([E1.id, E2!.id].sort());
    const rangees = Object.fromEntries(deux.map((s) => [s.psychologieDeCombat!.sourceId, s.participants!.map((p) => p.id)]));
    expect(rangees).toEqual({ [E1.id]: [B.id], [E2!.id]: [A.id, B.id] });
  });

  it('Test ÉTENDU par rangée (LDB 21 l.25) : le cumul progresse d’un Round à l’autre, la bande suivante part du DR déjà gagné', () => {
    banc.getState().ensemencerLeTirage(3);
    const { A, B, E1 } = duo();
    E1.causesPeur = 6; // Indice élevé : le Test étendu ne se solde pas en un Round
    openRoundEndCascade(banc.getState, banc.setState);
    const bande1 = banc.getState().pendingCascade!.participants.find((s) => s.kind === 'psychologieDeCombat')!;
    expect(bande1.participants!.every((p) => (p.extendedDrDone ?? 0) === 0)).toBe(true);
    // Réussites FORCÉES (dé 01 → DR max) : chaque rangée gagne son propre DR.
    for (const h of [A, B]) { h.resilience = 2; }
    banc.getState().jetForcerLaReussite('cascadeEnBande', A.id);
    banc.getState().jetForcerLaReussite('cascadeEnBande', B.id);
    const jouee = banc.getState().pendingCascade!.participants.find((s) => s.kind === 'psychologieDeCombat')!;
    const gagne = Object.fromEntries(jouee.participants!.map((p) => [p.id, p.result!.sl]));
    banc.getState().jetValider('cascade');
    const drOf = (id: string) => (banc.getState().battle!.combatants.find((c) => c.id === id)!.psychState ?? [])
      .find((p) => p.type === 'peur' && p.sourceId === E1.id)!.calmeDR ?? 0;
    expect(drOf(A.id)).toBe(gagne[A.id]);
    expect(drOf(B.id)).toBe(gagne[B.id]);
    expect(drOf(A.id)).toBeGreaterThan(0);

    // Round suivant : la MÊME entrée de règle → une bande, dont CHAQUE rangée part de SON cumul.
    const b = banc.getState().battle!;
    banc.setState({ battle: { ...b, round: b.round + 1 }, pendingCascade: null });
    openRoundEndCascade(banc.getState, banc.setState);
    const bande2 = banc.getState().pendingCascade!.participants.find((s) => s.kind === 'psychologieDeCombat')!;
    expect(bande2.participants!.length).toBe(2);
    for (const p of bande2.participants!) {
      expect(p.extendedDrDone).toBe(drOf(p.id));
      expect(p.extendedDrTarget).toBe(6);
    }
    // …et le cumul CONTINUE de progresser à ce second Round.
    banc.getState().jetForcerLaReussite('cascadeEnBande', A.id);
    const avant = drOf(A.id);
    banc.getState().jetForcerLaReussite('cascadeEnBande', B.id);
    banc.getState().jetValider('cascade');
    expect(drOf(A.id)).toBeGreaterThan(avant);
  });

  it('ORDRE de fin de Round : tous les upkeeps INFLUENÇABLES précèdent les bandes de Peur', () => {
    banc.getState().ensemencerLeTirage(5);
    const { A, B, E1 } = duo();
    E1.causesPeur = 2;
    for (const h of [A, B]) addCondition(h, COND.empoisonne, 2);
    openRoundEndCascade(banc.getState, banc.setState);
    const kinds = banc.getState().pendingCascade!.participants.map((s) => s.kind);
    expect(kinds.filter((k) => k === 'psychologieDeCombat').length).toBe(1);
    expect(kinds.lastIndexOf('testDeclenche')).toBeLessThan(kinds.indexOf('psychologieDeCombat'));
  });

  /**
   * SONDE A (juge) — Test ÉTENDU sur 2 Rounds dont un ÉCHEC : `LDB 12` (Tests étendus) borne le cumul
   * par le BAS (le total ne descend pas sous 0), et le Round suivant repart de ce total, pas de zéro.
   */
  it('cumul étendu : un Round RATÉ retire les DR négatifs (plancher 0), le Round suivant repart du total réel', () => {
    banc.getState().ensemencerLeTirage(3);
    const { A, E1 } = duo();
    E1.causesPeur = 6;
    const b0 = banc.getState().battle!;
    A.psychState = [{ type: 'peur', sourceId: E1.id, indice: 6, calmeDR: 1, lastTestRound: b0.round - 2 }]; // avant le Round que clôt `openRoundEndCascade`
    openRoundEndCascade(banc.getState, banc.setState);
    const bande1 = banc.getState().pendingCascade!.participants.find((s) => s.kind === 'psychologieDeCombat')!;
    // Jet POSÉ : échec à DR −3 sur la rangée de A (1 + (−3) → planché à 0).
    const rows1 = bande1.participants!.map((p) => ({ ...p, result: { roll: 99, target: p.target, sl: -3, success: false } }));
    const pc1 = banc.getState().pendingCascade!;
    banc.setState({ pendingCascade: { ...pc1, participants: pc1.participants.map((s) => (s === bande1 ? { ...s, participants: rows1 } : s)) } });
    banc.getState().jetValider('cascade');
    const drOf = (id: string) => (banc.getState().battle!.combatants.find((c) => c.id === id)!.psychState ?? [])
      .find((p) => p.type === 'peur' && p.sourceId === E1.id)!.calmeDR ?? 0;
    expect(drOf(A.id)).toBe(0); // planché, jamais négatif

    // Round suivant : RÉUSSITE à DR +2 → le cumul repart de 0 et vaut 2 (pas 2 − 3, pas 1 + 2).
    const b = banc.getState().battle!;
    banc.setState({ battle: { ...b, round: b.round + 1 }, pendingCascade: null });
    openRoundEndCascade(banc.getState, banc.setState);
    const bande2 = banc.getState().pendingCascade!.participants.find((s) => s.kind === 'psychologieDeCombat')!;
    expect(bande2.participants!.find((p) => p.id === A.id)!.extendedDrDone ?? 0).toBe(0);
    const rows2 = bande2.participants!.map((p) => ({ ...p, result: { roll: 1, target: p.target, sl: 2, success: true } }));
    const pc2 = banc.getState().pendingCascade!;
    banc.setState({ pendingCascade: { ...pc2, participants: pc2.participants.map((s) => (s === bande2 ? { ...s, participants: rows2 } : s)) } });
    banc.getState().jetValider('cascade');
    expect(drOf(A.id)).toBe(2);
  });

  /**
   * SONDE B (juge) — une bande peut porter DEUX Difficultés : la clé est l'entrée de RÈGLE, pas le
   * Test de chacun. Sans Peur (LDB 10 l.1051) allège la SEULE rangée de son porteur.
   */
  it('DEUX difficultés dans UNE bande : le porteur de Sans Peur teste en Accessible, l’autre en Intermédiaire', () => {
    banc.getState().ensemencerLeTirage(3);
    const { A, B, E1 } = duo();
    E1.causesPeur = 2;
    E1.groups = ['ogre'];
    A.talents = [...(A.talents ?? []), { talentId: 'sans-peur', spec: 'ogre', times: 1 }];
    openRoundEndCascade(banc.getState, banc.setState);
    const bande = banc.getState().pendingCascade!.participants.find((s) => s.kind === 'psychologieDeCombat')!;
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
    banc.getState().ensemencerLeTirage(3);
    const { A, B, E1 } = duo();
    E1.causesPeur = 2;
    addCondition(A, COND.brise, 2); // −20 sur les Tests de A
    openRoundEndCascade(banc.getState, banc.setState);
    const bande = banc.getState().pendingCascade!.participants.find((s) => s.kind === 'psychologieDeCombat')!;
    const ra = bande.participants!.find((p) => p.id === A.id)!;
    const rb = bande.participants!.find((p) => p.id === B.id)!;
    // La pénalité MORD sur la cible (Difficulté Intermédiaire = +0) — A et B n'ont pas le même Calme,
    // chacun se compare donc à SA base.
    expect(ra.target).toBe(ra.base - 20);
    expect(rb.target).toBe(rb.base);
    // …et elle est NOMMÉE (chip), jamais fondue dans la base : base + Σ mods + Difficulté === cible.
    const somme = ra.base + (ra.mods ?? []).reduce((s, m) => s + m.value, 0);
    expect(somme).toBe(ra.target);
    expect(ligneDe(ra.mods, { category: 'etats', id: 'brise' })?.value).toBe(-20);
    expect(rb.mods ?? []).toEqual([]); // B n'a aucun État : aucune chip inventée
  });
});
