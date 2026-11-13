/**
 * Colère des dieux, rangées 41-45 et 76-80 (LDB 40 l.64, l.74) :
 *  - 41-45 « Votre cause est indigne » : « vos cibles gagnent l'État À Terre. Elles ne pourront plus être l'objet
 *    d'aucune Bénédiction ou Miracle de votre divinité, qui échouent automatiquement pendant les 1d10 + (Points de
 *    Péché) prochains jours. »
 *  - 76-80 « Vous avez péché contre moi » : « vous oblige à effectuer des Tests de Prière pour votre Action pendant
 *    les 1d10 + (Points de Péché) prochains Rounds ».
 *
 * Contrat : 41-45 frappe les CIBLES de la Prière (À Terre + bannissement keyé par la divinité du prêtre, échéance
 * d'horloge en jours) ; une Prière du même dieu échoue sur elles, celle d'un autre dieu passe ; à l'échéance, tout
 * redevient normal. 76-80 : toute Action autre qu'une Prière est refusée avec sa raison (offre, incantation de
 * Sort, IA), le Mouvement reste libre, et la contrainte tombe après N Rounds.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { draineEtapes, poseSurDeNonTombe } from './cascade.testkit';
import { auContact, reluDans } from './combatDeTest.testkit';
import { actionGate } from './actionRegistry';
import { castSpell } from './combatFlow';
import { chooseEnemyAction, type CastableSpell } from './monde/ai';
import { emptyScene } from './monde/scene';
import { groupeDeScenario } from '../scenes/test-scenarios/_heros';
import { findSpellById } from '../data';
import { testScene } from '../scenes/test-fixture';
import { rollMiscast, miscastRowSource, miscastTableId } from '../engine/miscast';
import { applyOps } from '../engine/ops';
import { prayerForActionBy } from '../engine/magic';
import { hasCondition, tickDurations } from '../engine/conditions';
import { setDesFixes, resetDesFixes } from '../engine/fixedDie';
import { MINUTES_PER_DAY } from '../engine/clock';
import { aucunDe, desEnSuite } from '../engine/dice.testkit';
import type { Combatant } from '../engine/types';
import type { CastResult } from '../engine/magic';

const MAINTENANT = 8 * 60;
const GUERISON = 'benediction-de-guerison';

let banc: Banc;
beforeEach(() => {
  banc = ouvrirLeBanc();
  banc.setState({ battle: null, pendingCast: null, pendingCascade: null, party: [], journal: [], gameTime: MAINTENANT });
  banc.getState().ensemencerLeTirage(11);
});
afterEach(() => resetDesFixes());

/** Un prêtre de Sigmar (`beni` spécialisé) et un allié blessé. */
function pretreEtAllie(peche: number) {
  const [pretre, allie] = groupeDeScenario(idsDeTest, 'pretre', 'soldat');
  pretre.sinPoints = peche;
  allie.wounds.current = allie.wounds.max - 5;
  return { pretre, allie };
}

/** Pose une Bénédiction de Guérison au résultat FIGÉ (`roll`), puis « Appliquer » ; la cascade se draine, tout dé
 *  de table non tombé posé à `deDeTable` (dé NATUREL de la Colère). */
function benir(casterId: string, targetId: string, roll: number, deDeTable = 50) {
  const result: CastResult = { cast: true, roll, target: 60, sl: 1, isCritical: false, isFumble: false, log: 'Prière exaucée.' };
  banc.setState({ pendingCast: { casterId, targetId, spellId: GUERISON, missile: false, focused: false, result } });
  banc.getState().jetValider('incantation');
  draineEtapes(banc.getState, 50, poseSurDeNonTombe(deDeTable));
}

const heros = (id: string) => banc.getState().party.find((h) => h.id === id)!;
const bannissement = (c: Combatant) => (c.activeEffects ?? []).find((e) => e.deityBan);

describe('Colère des dieux — 41-45 « Votre cause est indigne » (LDB 40 l.64)', () => {
  it('les cibles tombent À Terre ; les Bénédictions du même dieu échouent sur elles, celles d\'un autre passent, jusqu\'à l\'échéance', () => {
    setDesFixes(true);
    const { pretre, allie } = pretreEtAllie(3);
    banc.setState({ party: [pretre, allie] });

    // Dé des unités 1 ≤ 3 Péchés → Colère ; dé naturel 11 + 3 × 10 = 41.
    benir(pretre.id, allie.id, 41, 11);
    const cible = heros(allie.id);
    expect(hasCondition(cible, 'a-terre')).toBe(true);
    expect(hasCondition(heros(pretre.id), 'a-terre')).toBe(false);
    const ban = bannissement(cible)!;
    expect(ban.deityBan).toBe('sigmar');
    expect(ban.duration.scale).toBe('clock');
    const echeance = ban.duration.scale === 'clock' ? ban.duration.until : NaN;
    // 1d10 + 3 Points de Péché (lus avant l'expiation) jours.
    expect(echeance - MAINTENANT).toBeGreaterThanOrEqual(4 * MINUTES_PER_DAY);
    expect(echeance - MAINTENANT).toBeLessThanOrEqual(13 * MINUTES_PER_DAY);
    expect(heros(pretre.id).sinPoints).toBe(2);

    // Même dieu : échec automatique sur la cible bannie (dé des unités 5 > 2 Péchés : aucune Colère).
    const avant = cible.wounds.current;
    banc.setState({ journal: [] });
    benir(pretre.id, allie.id, 45);
    expect(heros(allie.id).wounds.current).toBe(avant);
    expect(banc.getState().journal.join('\n')).toMatch(/échoue automatiquement/);

    // Autre divinité : la Bénédiction passe.
    const ulric = structuredClone(heros(pretre.id));
    ulric.talents = ulric.talents.map((t) => (t.talentId === 'beni' ? { ...t, spec: 'ulric' } : t));
    banc.setState({ party: [ulric, heros(allie.id)] });
    benir(pretre.id, allie.id, 45);
    expect(heros(allie.id).wounds.current).toBe(avant + 1);

    // Retour à l'échéance : une minute avant, le dieu refuse encore ; à l'échéance, il exauce.
    const sigmar = structuredClone(heros(pretre.id));
    sigmar.talents = sigmar.talents.map((t) => (t.talentId === 'beni' ? { ...t, spec: 'sigmar' } : t));
    banc.setState({ party: [sigmar, heros(allie.id)] });
    banc.getState().avancerLeTemps(echeance - MAINTENANT - 1);
    benir(pretre.id, allie.id, 45);
    expect(heros(allie.id).wounds.current).toBe(avant + 1);
    banc.getState().avancerLeTemps(1);
    expect(bannissement(heros(allie.id))).toBeUndefined();
    benir(pretre.id, allie.id, 45);
    expect(heros(allie.id).wounds.current).toBe(avant + 2);
  });
});

describe('Colère des dieux — 76-80 « Vous avez péché contre moi » (LDB 40 l.74)', () => {
  /** Le prêtre en combat, au contact d'un ennemi, son tour ; la rangée 76-80 subie (1d10 = `de`). */
  function penitent(de: number) {
    const [pretre] = groupeDeScenario(idsDeTest, 'pretre');
    pretre.sinPoints = 2;
    banc.setState({ party: [pretre] });
    banc.getState().lancerLaScene(testScene());
    banc.getState().lancerLeCombat('enc-mutants');
    banc.getState().fenetreValider('debutDuRound');
    banc.abandonner();
    const { H, E, patch } = auContact(banc.getState());
    banc.setState(patch);
    const m = rollMiscast('colere', desEnSuite([de]), 2, undefined, 56); // 56 + 2 × 10 = 76
    expect(m.rowId).toBe('colere-vous-avez-peche-contre-moi');
    applyOps(H, m.ops, { idNeuf: idsDeTest, rng: desEnSuite([de]), label: m.label, now: MAINTENANT, source: miscastRowSource(miscastTableId('colere'), m.rowId) });
    return { H, E };
  }
  const gate = (H: Combatant, id: string, spellId?: string) =>
    actionGate(id, { scene: banc.getState().scene, active: H, battle: banc.getState().battle!, gameTime: MAINTENANT, ...(spellId ? { args: { spellId } } : {}) });

  it('toute Action autre qu\'une Prière est refusée avec sa raison ; la Prière passe ; le Mouvement reste libre', () => {
    const { H, E } = penitent(5); // 1d10 = 5 → 5 + 2 Rounds
    const effet = (H.activeEffects ?? []).find((e) => e.prayerForAction)!;
    expect(effet.duration).toMatchObject({ scale: 'rounds', left: 7 });

    for (const id of ['attaque', 'defensive', 'soins', 'dissipation']) {
      expect(gate(H, id), id).toMatchObject({ ok: false, reason: expect.stringMatching(/Test de Prière pour son Action/) });
    }
    expect(gate(H, 'incantation', 'arme-aethyrique').ok).toBe(false);
    expect(gate(H, 'incantation', GUERISON).ok).toBe(true);
    expect(gate(H, 'mouvement').ok).toBe(true);
    expect(gate(H, 'usage-objet').ok, 'Action gratuite, LDB 13 l.106').toBe(true);

    castSpell(banc.getState, banc.setState, reluDans(banc.getState, H), reluDans(banc.getState, E), 'arme-aethyrique');
    expect(banc.getState().pendingCast).toBeNull();
    expect(banc.getState().battle!.log.map((e) => e.text).join('\n')).toMatch(/Test de Prière pour son Action/);
    castSpell(banc.getState, banc.setState, reluDans(banc.getState, H), reluDans(banc.getState, H), GUERISON);
    expect(banc.getState().pendingCast?.spellId).toBe(GUERISON);
  });

  it('la contrainte tombe après N Rounds', () => {
    const { H } = penitent(1); // 1d10 = 1 → 1 + 2 = 3 Rounds
    for (let r = 0; r < 2; r++) tickDurations(H);
    expect(prayerForActionBy(H)).not.toBeNull();
    expect(gate(H, 'defensive').ok).toBe(false);
    tickDurations(H);
    expect(prayerForActionBy(H)).toBeNull();
    expect(gate(H, 'defensive').ok).toBe(true);
  });

  it('l\'IA sous pénitence ne choisit qu\'une Prière (ou son Mouvement), jamais une attaque', () => {
    const { H, E } = penitent(5);
    const pretreIA = { ...structuredClone(H), kind: 'ennemi' as const, pos: { x: 1, y: 1 } };
    const proie = { ...structuredClone(E), kind: 'heros' as const, pos: { x: 2, y: 1 } };
    const sortDe = (id: string): CastableSpell => {
      const data = findSpellById(id)!;
      return { id, data, cn: data.cn ?? 0, range: null, shape: 'single', landProb: 1, focusState: 'none', active: false };
    };
    const base = { enemy: pretreIA, heroes: [proie], scene: emptyScene('scene-test', 8, 8), blocked: new Set<string>(), movement: 4 };
    const libre = chooseEnemyAction({ ...base, enemy: { ...pretreIA, activeEffects: [] }, spells: [] });
    expect(libre.kind).toBe('melee');
    const contraint = chooseEnemyAction({ ...base, spells: [sortDe('arme-aethyrique')] });
    expect(['melee', 'tir', 'incantation', 'incantationDeZone', 'focalisation']).not.toContain(contraint.kind);
  });
});

describe('les rangées portent leurs ops (LDB 40 l.64, l.74)', () => {
  it('41-45 n\'agit que sur les cibles, 76-80 que sur le prêtre', () => {
    const indigne = rollMiscast('colere', aucunDe, 0, undefined, 41);
    expect(indigne.ops).toEqual([]);
    expect(indigne.targetOps.map((o) => o.op)).toEqual(['condition', 'deityBan']);
    const peche = rollMiscast('colere', aucunDe, 0, undefined, 76);
    expect(peche.ops.map((o) => o.op)).toEqual(['prayerForAction']);
    expect(peche.targetOps).toEqual([]);
  });
});
