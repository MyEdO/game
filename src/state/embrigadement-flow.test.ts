import { describe, it, expect, beforeEach } from 'vitest';
import { emptyScene } from './scene';
import { useGame } from './store';
import { makePregens } from '../data/pregens';
import { resolvePortArrival } from './seaVoyageFlow';
import { advanceCascade, setCascadeChoice } from './cascade';
import { creditBourse, partyMoneyTotal } from './bourseFlow';
import { seedBattleRng } from './battleRng';
import type { RNG } from '../engine/dice';
import { skillBaseValue, testValue, soutienDetail } from '../engine/skills';
import { skillCharacteristicById } from '../engine/character';
import { DIFFICULTY_MODIFIERS } from '../engine/types';
import { inexplique, soutienDe } from './cascadeTestKit';
import { resolveStake } from '../data';

/**
 * EMBRIGADEMENT — recouvrement d'équipage (MDG 15 l.245, #164). La perte de 2d10 marins est persistée,
 * puis le groupe DÉCIDE de tenter (opt-in RAW « Vous pouvez ») ou renoncer ; s'il tente, une SÉQUENCE
 * de Tests influençables permet de les récupérer : Ragot Intermédiaire → rançon 2d10 CO OU Discrétion
 * Complexe ; un échec sur l'un des deux coûte 1d10 marins de plus. Les jets de la
 * cascade sont pilotés ici en INJECTANT le résultat de l'étape courante (le cycle Chance/Résilience de
 * `FLOWS.cascade` est testé ailleurs) — on vérifie les CONSÉQUENCES (recouvrement = delta NÉGATIF, +1d10).
 */
const get = useGame.getState.bind(useGame);
const set = useGame.setState.bind(useGame);

// Tous les d10 → 1 (quel que soit l'index) : événement de port min 1 (Embrigadement, avec Humeur −1),
// lostCrew 2d10 = 2, ransomCO 2d10 = 2, failExtraLostCrew 1d10 = 1.
const ones: RNG = { int: (min) => min };

function fresh() {
  seedBattleRng(1);
  useGame.setState({
    party: makePregens().slice(0, 3),
    scene: { ...emptyScene(2, 2), id: 'port', label: 'Port', layers: [{ z: 0, tiles: ['sol', 'sol', 'sol', 'sol'] }] },
    battle: null,
    pendingCascade: null,
    // Humeur de Manann −1 : place le tirage 2d10=2 sur l'événement n°1 (Embrigadement).
    vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] }, manann: { score: -1, applied: [] } },
    journal: [],
  } as never);
  creditBourse(get, set, get().party[0].id, { gold: 100, silver: 0, brass: 0 }); // bourse de groupe = 100 CO
}

/** Injecte le résultat de l'étape-jet courante puis valide (comme le ferait la modale après un jet). */
function jet(success: boolean): void {
  const p = get().pendingCascade!;
  const i = p.cursor;
  const cur = p.participants[i];
  const result = { roll: success ? 5 : 95, target: cur.target!, sl: success ? 2 : -2, success };
  set({ pendingCascade: { ...p, participants: p.participants.map((x, k) => (k === i ? { ...x, result } : x)) } });
  advanceCascade(get, set);
}

/** Tranche l'étape « choix » courante puis valide. */
function choose(key: string): void {
  const p = get().pendingCascade!;
  setCascadeChoice(get, set, p.participants[p.cursor].id, key);
  advanceCascade(get, set);
}

describe('Embrigadement — recouvrement (MDG 15 l.245, #164)', () => {
  beforeEach(fresh);

  it('déclenche la perte de 2d10 marins ET ouvre la cascade sur la DÉCISION opt-in', () => {
    resolvePortArrival(get, set, undefined, ones);
    expect(get().vessel!.crewLost).toBe(2); // 2d10 = 2 marins enlevés (cogue, nominal 15)
    const p = get().pendingCascade!;
    expect(p.title).toBe('Embrigadement');
    expect(p.participants[0].kind).toBe('embrigadementDecision'); // tenter/renoncer AVANT tout Test
    expect(p.participants[0].options?.map((o) => o.key)).toEqual(['tenter', 'renoncer']);
  });

  it('RENONCER : aucun Test, aucune perte supplémentaire (RAW « Vous pouvez »)', () => {
    resolvePortArrival(get, set, undefined, ones);
    choose('renoncer');
    expect(get().pendingCascade).toBeNull(); // séquence close sans risque
    expect(get().vessel!.crewLost).toBe(2); // perte 2d10 encaissée, PAS de 1d10 de plus
  });

  it('Ragot réussi + PAIEMENT : rançon débitée (2d10 CO) et marins récupérés (delta NÉGATIF)', () => {
    resolvePortArrival(get, set, undefined, ones);
    choose('tenter'); // opt-in → étape Ragot
    jet(true); // Ragot réussi → étape « choix »
    choose('payer'); // rançon 2 CO
    expect(get().pendingCascade).toBeNull();
    expect(get().vessel!.crewLost).toBe(0); // les 2 marins reviennent (applyVesselCrewLoss négatif)
    expect(partyMoneyTotal(get).gold).toBe(98); // 100 − 2 CO (payFromGroup, dépense de bande)
  });

  it('Ragot réussi + DISCRÉTION réussie : marins récupérés sans dépense', () => {
    resolvePortArrival(get, set, undefined, ones);
    choose('tenter');
    jet(true); // Ragot
    choose('discretion'); // → étape-jet Discrétion Complexe
    jet(true); // Discrétion réussie
    expect(get().pendingCascade).toBeNull();
    expect(get().vessel!.crewLost).toBe(0);
    expect(partyMoneyTotal(get).gold).toBe(100); // bourse intacte
  });

  /**
   * ENJEU (#1117/#1262 V2 L6b) — mesuré sur le CHEMIN RÉEL : les deux étapes-jet de la séquence
   * portent leur `stake`, et le texte rendu est celui que `resolveStake` produit pour la modale.
   * Le renvoi descend à la Compétence jetée : c'est elle qui porte la règle du Test.
   */
  it('les deux étapes-jet DISENT ce qu’elles mettent en jeu (Ragot, puis Discrétion)', () => {
    resolvePortArrival(get, set, undefined, ones);
    choose('tenter');
    const ragot = get().pendingCascade!.participants[get().pendingCascade!.cursor];
    expect(ragot.kind).toBe('embrigadementRagot');
    const eRagot = resolveStake(ragot.stake!);
    expect(eRagot.text, 'le joueur doit lire ce que l’échec coûte').toContain('1d10 membres d\'équipage de plus');
    expect(eRagot.rule).toEqual({ category: 'skills', id: 'ragot' });
    jet(true);
    choose('discretion');
    const disc = get().pendingCascade!.participants[get().pendingCascade!.cursor];
    expect(disc.kind).toBe('embrigadementDiscretion');
    const eDisc = resolveStake(disc.stake!);
    expect(eDisc.text).toContain('libérés');
    expect(eDisc.rule).toEqual({ category: 'skills', id: 'discretion' });
  });

  it('Ragot RATÉ : l\'autre navire lève l\'ancre → 1d10 marins de plus perdus', () => {
    resolvePortArrival(get, set, undefined, ones);
    choose('tenter');
    jet(false); // Ragot raté
    expect(get().pendingCascade).toBeNull(); // séquence terminée
    expect(get().vessel!.crewLost).toBe(3); // 2 + 1d10 (=1)
  });

  it('Discrétion RATÉE : 1d10 marins de plus perdus (pas de récupération)', () => {
    resolvePortArrival(get, set, undefined, ones);
    choose('tenter');
    jet(true); // Ragot
    choose('discretion');
    jet(false); // Discrétion ratée
    expect(get().pendingCascade).toBeNull();
    expect(get().vessel!.crewLost).toBe(3); // 2 + 1
  });

  it('PAIEMENT bourse insuffisante : aucun débit, marins NON récupérés', () => {
    set({ party: makePregens().slice(0, 3) }); // groupe neuf : bourses à 0 (aucun crédit)
    resolvePortArrival(get, set, undefined, ones);
    choose('tenter');
    jet(true);
    choose('payer');
    expect(get().pendingCascade).toBeNull();
    expect(partyMoneyTotal(get).gold).toBe(0);
    expect(get().vessel!.crewLost).toBe(2); // rançon impayable → captifs
  });

  it('perte plafonnée au nominal : aucun marin réellement enlevé → pas de cascade (rien à récupérer)', () => {
    set({ vessel: { ...get().vessel!, crewLost: 15 } }); // déjà tout l'équipage perdu (cogue nominal 15)
    resolvePortArrival(get, set, undefined, ones);
    expect(get().vessel!.crewLost).toBe(15);
    expect(get().pendingCascade).toBeNull(); // recover === 0 → openEmbrigadementRecovery s'arrête
  });

  it('personne à bord pour mener le Ragot (équipage = les PJ, MDG 14 l.39, tous morts) : AUCUNE fenêtre, journal explicite', () => {
    set({ party: get().party.map((h) => ({ ...h, dead: true })) });
    resolvePortArrival(get, set, undefined, ones);
    // Le meneur PORTE la décision de tenter : sans meneur, il n'y a pas de décision à ouvrir — la voie
    // a seulement une issue, et elle se dit au journal au lieu d'une fenêtre à un seul bouton.
    expect(get().pendingCascade).toBeNull();
    expect(get().vessel!.crewLost).toBe(2); // perte de base inchangée, pas de récupération tentée
    expect(get().journal.some((l) => l.includes('Personne à bord ne peut mener l\'enquête'))).toBe(true);
  });
});

/**
 * #1153 L2bis — l'étape-jet du recouvrement pose le Niveau de Compétence NU (`LDB 09 l.17`) et sort
 * le Soutien (LDB 12 l.187-200) en ligne de mod NOMMÉE ; la CIBLE, elle, ne bouge pas d'un point :
 * elle reste dérivée de la valeur SOUTENUE (l.189-190). Un meneur sous ÉTAT le PROUVE — la pénalité
 * d'État sépare la nue (`skillBaseValue`) de la valeur jetée (`testValue`), qu'une base fondue
 * confondrait.
 */
describe('Embrigadement — base NUE + Soutien NOMMÉ, cible invariante (#1153 L2bis)', () => {
  beforeEach(fresh);

  it('Ragot : `base` = Compétence NUE du meneur EMPOISONNÉ, chip « Soutien », cible = valeur soutenue', () => {
    const [lead, aide, autre] = get().party;
    // DEUX soutiens (+20) : le Soutien ne compense pas exactement l'État (−10), donc une base FONDUE
    // ne peut pas se faire passer pour la nue par coïncidence arithmétique.
    for (const [h, adv] of [[lead, 30], [aide, 5], [autre, 2]] as const) {
      if (adv > 0) h.skills.push({ id: 'ragot', characteristic: skillCharacteristicById('ragot'), advances: adv } as never);
    }
    lead.conditions = [{ id: 'empoisonne', value: 1 }] as never; // l'État MORD le jet, pas le Niveau de Compétence
    set({ party: [lead, aide, autre] });

    const nue = skillBaseValue(lead, 'ragot');
    const jetee = testValue(lead, 'ragot');
    expect(jetee, 'l’État sépare bien la nue de la valeur jetée').toBeLessThan(nue);
    const soutien = soutienDetail(get().party, lead, 'ragot');
    expect(soutien.bonus, 'un camarade éligible soutient (l.195)').toBeGreaterThan(0);

    resolvePortArrival(get, set, undefined, ones);
    choose('tenter');
    const step = get().pendingCascade!.participants[get().pendingCascade!.cursor];
    expect(step.kind).toBe('embrigadementRagot');
    expect(step.actorId).toBe(lead.id);
    expect(step.base, 'Niveau de Compétence NU (LDB 09 l.17)').toBe(nue);
    expect(soutienDe(step), 'le Soutien est une ligne de mod NOMMÉE').toBe(soutien.bonus);
    // CIBLE INVARIANTE : la valeur SOUTENUE que roulait l'ancien contrat (base fondue + Difficulté).
    expect(step.target).toBe(jetee + soutien.bonus + DIFFICULTY_MODIFIERS.intermediaire);
    // CLIQUET « zéro chip anonyme » : l'État est NOMMÉ lui aussi, il ne reste aucun écart muet.
    expect(inexplique(step), 'aucune chip « autres » : États compris, tout est nommé').toBe(0);
  });
});
