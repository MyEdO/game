/**
 * Possession réseau (Jalon 7, P3) : l'hôte ne rejoue un intent que si le siège émetteur possède
 * le combattant concerné — modale ouverte → son concerné seul ('*' = tous) ; sinon le tour actif.
 */
import { describe, it, expect } from 'vitest';
import { intentAllowedFor, modalOwnerOf, seatOwns, seatSlotsRemaining, controlsActive, controlsCombatant, pilotedByHuman, aiDriven, ownsLocally, rolledLocally } from './netOwnership';
import { setCadence, resetCadence } from '../engine/cadence';
import type { GameState } from './store';
import { cascadeDeTest } from './cascadeTestKit';

const base = (over: Partial<GameState>): GameState =>
  ({
    net: { mode: 'host', mySeat: 0, seatNames: { 0: 'Hôte', 1: 'Antoine' }, ownership: { h2: 1 }, slots: [0, 0, 0, 0] },
    // `kind` PORTÉ par le groupe (comme tout héros réel, `createHero`) : hors combat, `seatInfluences`
    // résout le porteur d'un jet dans `party` et distingue héros ⇄ ennemi sur ce champ.
    party: [{ id: 'h1', kind: 'hero' }, { id: 'h2', kind: 'hero' }],
    battle: { order: ['h1', 'h2'], turn: 0, combatants: [
      { id: 'h1', kind: 'hero' }, { id: 'h2', kind: 'hero' }, { id: 'e1', kind: 'enemy' },
    ] },
    ...over,
  }) as unknown as GameState;

describe('rolledLocally (#990) — « ce siège a-t-il produit CE jet ? », base du masque de présentation', () => {
  const solo = () => base({ net: { mode: 'local', mySeat: 0, seatNames: {}, ownership: {}, slots: [0, 0, 0, 0] } } as unknown as Partial<GameState>);

  it('SOLO : `ownsLocally` est vrai pour TOUS — seul `rolledLocally` distingue mon jet de celui de l’IA', () => {
    const s = solo();
    expect(ownsLocally(s, 'e1'), 'le masque bâti sur ownsLocally serait mort en solo').toBe(true);
    expect(rolledLocally(s, 'e1'), 'l’ennemi IA n’a rien roulé à ce siège').toBe(false);
    expect(rolledLocally(s, 'h1'), 'mon héros : je ne me masque jamais mon propre dé').toBe(true);
  });

  it('allié PNJ `aiControlled` : son jet n’est PAS le mien (l’automate le joue, comme un ennemi IA)', () => {
    const s = base({
      net: { mode: 'local', mySeat: 0, seatNames: {}, ownership: {}, slots: [0, 0, 0, 0] },
      battle: { order: ['h1', 'h2'], turn: 0, combatants: [{ id: 'h1', kind: 'hero' }, { id: 'h2', kind: 'hero', aiControlled: true }, { id: 'e1', kind: 'enemy' }] },
    } as unknown as Partial<GameState>);
    expect(rolledLocally(s, 'h2')).toBe(false);
  });

  it('adversaire ABSTRAIT (table de taverne, aucun Combatant) : jamais produit ici', () => {
    expect(rolledLocally(solo(), undefined)).toBe(false);
    expect(rolledLocally(solo(), 'inconnu')).toBe(false);
  });

  it('COOP : l’ennemi conduit par le MJ est masqué pour l’invité, pas pour le MJ', () => {
    const gm = base({ net: { mode: 'host', mySeat: 0, gmSeat: 0, seatNames: {}, ownership: { h2: 1 }, slots: [0, 0, 0, 0] } } as unknown as Partial<GameState>);
    expect(rolledLocally(gm, 'e1'), 'le MJ a roulé ce jet lui-même').toBe(true);
    const invite = { ...gm, net: { ...gm.net, mySeat: 1 } } as GameState;
    expect(rolledLocally(invite, 'e1'), 'l’invité n’a pas roulé le jet du MJ').toBe(false);
    expect(rolledLocally(invite, 'h2'), 'son propre héros, si').toBe(true);
    expect(rolledLocally(invite, 'h1'), 'le héros de l’hôte, non').toBe(false);
  });

  it('Auto-combat : mon héros joué par l’automate a quand même roulé À CE SIÈGE (≠ controlsCombatant)', () => {
    const s = solo();
    setCadence('auto');
    try {
      expect(controlsCombatant(s, s.battle!.combatants[0]), 'aucune affordance de tour en Auto-combat').toBe(false);
      expect(rolledLocally(s, 'h1'), 'mais son dé reste le mien — rien à me masquer').toBe(true);
    } finally {
      resetCadence();
    }
  });
});
describe('possession réseau (netOwnership)', () => {
  it('sans modale : seul le propriétaire du combattant ACTIF agit', () => {
    const s = base({}); // actif = h1 (non attribué → hôte)
    expect(intentAllowedFor(s, 0, 'battleEndTurn')).toBe(true);
    expect(intentAllowedFor(s, 1, 'battleEndTurn')).toBe(false);
    const s2 = base({ battle: { ...base({}).battle!, turn: 1 } }); // actif = h2 (siège 1)
    expect(intentAllowedFor(s2, 1, 'battleClickEntity')).toBe(true);
    expect(intentAllowedFor(s2, 0, 'battleClickEntity')).toBe(false);
  });

  it('modale ouverte : seul son CONCERNÉ agit (défense du héros de l’invité)', () => {
    // La défense est désormais une étape `jet:'defense'` de la cascade `combat` (pendingDefense = porteur de
    // données) ; l'owner de la modale `cascade` = l'actorId de l'étape (le défenseur h2).
    const s = base({
      pendingDefense: { attackerId: 'e1', defenderId: 'h2' } as GameState['pendingDefense'],
      pendingCascade: cascadeDeTest([{ id: 'd', jet: 'defense', kind: 'defenseJet', actorId: 'h2' }]),
    });
    expect(modalOwnerOf(s)).toBe('h2');
    expect(intentAllowedFor(s, 1, 'defenseRoll')).toBe(true);
    expect(intentAllowedFor(s, 0, 'defenseRoll')).toBe(false);
  });

  it("sort ENNEMI ('*') : tout le monde peut agir (Contre-sort multi)", () => {
    // Wrapper-fold : l'incantation est une étape `jet:'cast'` de la cascade. Sort ENNEMI → la cascade
    // est ouverte avec `groupOwner:true` → l'entrée `cascade`
    // met l'owner à '*' (moment partagé + Contre-sort multi en coop). `pendingCast` coexiste comme data.
    const s = base({
      pendingCast: { casterId: 'e1', targetId: 'h1' } as GameState['pendingCast'],
      pendingCascade: cascadeDeTest([{ id: 'c', jet: 'cast', kind: 'cast', actorId: 'e1', groupOwner: true }]),
    });
    expect(modalOwnerOf(s)).toBe('*');
    expect(intentAllowedFor(s, 1, 'castCounterspell')).toBe(true);
  });

  it('révélation SANS sujet (entretien) → hôte seul ; roundStartReady → toujours permis', () => {
    // #942 L8 : une révélation est une ÉTAPE d'affichage de la cascade — l'owner suit `actorId`
    // (absent pour un entretien de Round) → `seatOwns(…, undefined)` = l'hôte, et le verbe
    // d'acquittement est celui de la cascade (`cascadeNext`).
    const s = base({
      pendingCascade: cascadeDeTest([{ id: 'r', kind: 'round', reveal: { kind: 'round', title: 'x', lines: [] } }]),
    });
    expect(intentAllowedFor(s, 0, 'cascadeNext')).toBe(true);
    expect(intentAllowedFor(s, 1, 'cascadeNext')).toBe(false);
    expect(intentAllowedFor(s, 1, 'roundStartReady')).toBe(true);
  });

  it('seatOwns : héros non attribué → hôte', () => {
    const s = base({});
    expect(seatOwns(s, 0, 'h1')).toBe(true);
    expect(seatOwns(s, 1, 'h1')).toBe(false);
    expect(seatOwns(s, 1, 'h2')).toBe(true);
  });

  it('partyAddHero : permis tant que le siège a des emplacements à remplir, refusé ensuite', () => {
    // 2 slots au siège 1, il possède déjà h2 → 1 restant.
    const s = base({
      net: { mode: 'host', mySeat: 0, seatNames: { 0: 'Hôte', 1: 'Antoine' }, ownership: { h2: 1 }, slots: [0, 1, 1, 0] },
      battle: null,
    } as unknown as Partial<GameState>);
    expect(seatSlotsRemaining(s, 1)).toBe(1);
    expect(intentAllowedFor(s, 1, 'partyAddHero', [{ id: 'h3' }])).toBe(true);
    // Quota épuisé : h3 ajouté au siège 1 → refus.
    const full = base({
      net: { mode: 'host', mySeat: 0, seatNames: { 0: 'Hôte', 1: 'Antoine' }, ownership: { h2: 1, h3: 1 }, slots: [0, 1, 1, 0] },
      party: [{ id: 'h1' }, { id: 'h2' }, { id: 'h3' }],
      battle: null,
    } as unknown as Partial<GameState>);
    expect(seatSlotsRemaining(full, 1)).toBe(0);
    expect(intentAllowedFor(full, 1, 'partyAddHero', [{ id: 'h4' }])).toBe(false);
  });

  it('partyRemoveHero : seul le propriétaire du héros peut le retirer', () => {
    const s = base({ battle: null } as unknown as Partial<GameState>);
    expect(intentAllowedFor(s, 1, 'partyRemoveHero', ['h2'])).toBe(true);
    expect(intentAllowedFor(s, 1, 'partyRemoveHero', ['h1'])).toBe(false);
  });

  it('partyReplaceHero : seul le propriétaire de l’ANCIEN héros (1er arg) peut le remplacer', () => {
    const s = base({ battle: null } as unknown as Partial<GameState>);
    expect(intentAllowedFor(s, 1, 'partyReplaceHero', ['h2'])).toBe(true);  // h2 = siège 1
    expect(intentAllowedFor(s, 1, 'partyReplaceHero', ['h1'])).toBe(false); // h1 = hôte
  });

  it('carnet d’enquête (#2415) : l’invité épingle et marque vu hors combat sans modale, en combat aussi', () => {
    const vu = [{ id: 'ind', étapes: 1, statut: 'révélé', stadeCourant: 's1' }];
    const horsCombat = base({ battle: null } as unknown as Partial<GameState>);
    expect(intentAllowedFor(horsCombat, 1, 'toggleCluePin', ['ind']), 'épingle refusée à l’invité hors combat').toBe(true);
    expect(intentAllowedFor(horsCombat, 1, 'markCluesSeen', [vu]), 'nouveauté vue refusée à l’invité hors combat').toBe(true);
    expect(intentAllowedFor(horsCombat, 1, 'partyRemoveHero', ['h1']), 'opposé : un geste de groupe POSSÉDÉ reste refusé').toBe(false);
    const enCombat = base({}); // actif = h1 (hôte) : le repli refuserait le siège 1
    expect(intentAllowedFor(enCombat, 1, 'toggleCluePin', ['ind'])).toBe(true);
    expect(intentAllowedFor(enCombat, 1, 'markCluesSeen', [vu])).toBe(true);
  });
});

describe('controlsActive — gating d’affichage : le tour d’un héros distant est inerte (comme un tour ennemi)', () => {
  const withSeat = (s: GameState, mySeat: number): GameState =>
    ({ ...s, net: { ...s.net, mySeat } }) as GameState;

  it('mode local / hors combat : toujours vrai', () => {
    expect(controlsActive(base({ net: { ...base({}).net, mode: 'local' } } as unknown as Partial<GameState>))).toBe(true);
    expect(controlsActive(base({ battle: null } as unknown as Partial<GameState>))).toBe(true);
  });

  it('tour du héros d’un AUTRE joueur : faux — pour l’hôte aussi', () => {
    const s = base({ battle: { ...base({}).battle!, turn: 1 } }); // actif = h2 (siège 1), vu de l'hôte
    expect(controlsActive(s)).toBe(false); // l'hôte ne pilote PAS le héros de l'invité
    expect(controlsActive(withSeat(s, 1))).toBe(true); // son propriétaire, si
  });

  it('tour de SON héros : vrai ; tour ennemi : vrai pour tous (l’IA est déjà inerte)', () => {
    const s = base({}); // actif = h1 (non attribué → hôte)
    expect(controlsActive(s)).toBe(true);
    expect(controlsActive(withSeat(s, 1))).toBe(false);
    const enemyTurn = base({ battle: { ...base({}).battle!, order: ['e1', 'h1', 'h2'], turn: 0 } });
    expect(controlsActive(enemyTurn)).toBe(true);
    expect(controlsActive(withSeat(enemyTurn, 1))).toBe(true);
  });
});

describe('controlsCombatant / rôle MJ (bac-à-sable) — un ennemi conduit par le siège MJ', () => {
  const enemyTurn = (gmSeat?: number, mySeat = 0): GameState => {
    const s = base({ battle: { ...base({}).battle!, order: ['e1', 'h1'], turn: 0 } });
    return { ...s, net: { ...s.net, mySeat, ...(gmSeat != null ? { gmSeat } : {}) } } as GameState;
  };
  const cid = (s: GameState, id: string) => s.battle!.combatants.find((c) => c.id === id)!;

  it('sans MJ (gmSeat absent) : ennemi = IA, aucun contrôle joueur', () => {
    const s = enemyTurn();
    expect(aiDriven(s, cid(s, 'e1'))).toBe(true);
    expect(pilotedByHuman(s, cid(s, 'e1'))).toBe(false);
    expect(controlsCombatant(s, cid(s, 'e1'))).toBe(false);
    expect(controlsActive(s)).toBe(true); // tour IA → UI inerte par ses propres verrous (inchangé)
  });

  it('rôle MJ posé sur MON siège : l’ennemi devient contrôlable, son tour est à moi', () => {
    const s = enemyTurn(0, 0); // le siège 0 (moi) porte le rôle MJ
    expect(aiDriven(s, cid(s, 'e1'))).toBe(false);
    expect(pilotedByHuman(s, cid(s, 'e1'))).toBe(true);
    expect(controlsCombatant(s, cid(s, 'e1'))).toBe(true);
    expect(controlsActive(s)).toBe(true);
  });

  it('rôle MJ sur un AUTRE siège (coop) : je ne conduis pas les ennemis', () => {
    const s = enemyTurn(1, 0); // le MJ = siège 1 ; moi = siège 0
    expect(pilotedByHuman(s, cid(s, 'e1'))).toBe(true); // les jets du monde remontent au MJ (n'importe quel siège)
    expect(controlsCombatant(s, cid(s, 'e1'))).toBe(false); // …mais seul le siège MJ le PILOTE
    expect(controlsActive(s)).toBe(false);
  });

  it('les héros restent inchangés quel que soit le MJ', () => {
    const s = enemyTurn(0, 0);
    expect(controlsCombatant(s, cid(s, 'h1'))).toBe(true); // h1 non attribué → hôte (moi)
    expect(pilotedByHuman(s, cid(s, 'h1'))).toBe(true);
  });

  it('seatOwns route les intents d’un ennemi vers le siège MJ (pas ownership)', () => {
    const s = enemyTurn(1, 0);
    expect(seatOwns(s, 1, 'e1')).toBe(true);  // le siège MJ possède l’intent du tour ennemi
    expect(seatOwns(s, 0, 'e1')).toBe(false);
    expect(seatOwns(s, 0, 'h1')).toBe(true);  // héros : ownership inchangé (non attribué → hôte)
  });
});

describe('Activités d’interlude en coop (audit M7/M8) — chacun mène SES héros', () => {
  const interludeState = (over: Partial<GameState> = {}): GameState => base({
    battle: null,
    interlude: { weeks: 2, phase: 'activities', perHero: { h1: { eventRoll: 1, left: 2, revenueBrass: 0 }, h2: { eventRoll: 2, left: 2, revenueBrass: 0 } } },
    bank: [{ heroId: 'h2', kind: 'stash', brass: 100, rate: 0 }],
    ...over,
  } as Partial<GameState>);

  it('activité visant un héros : son propriétaire agit, pas les autres', () => {
    const s = interludeState();
    expect(intentAllowedFor(s, 1, 'interludeActivity', ['h2', 'revenus'])).toBe(true);
    expect(intentAllowedFor(s, 1, 'interludeActivity', ['h1', 'revenus'])).toBe(false);
    expect(intentAllowedFor(s, 0, 'interludeCraftStart', ['h1', 'Dague', [], []])).toBe(true);
    expect(intentAllowedFor(s, 0, 'interludeActivity', ['h2', 'learn', { talentId: 'chanceux' }])).toBe(false);
    expect(intentAllowedFor(s, 1, 'interludeBank', ['h2', 'stash', 120])).toBe(true);
  });

  it('retrait bancaire : le dépôt appartient à un héros — son propriétaire retire', () => {
    const s = interludeState();
    expect(intentAllowedFor(s, 1, 'interludeWithdraw', [0])).toBe(true); // dépôt de h2 (siège 1)
    expect(intentAllowedFor(s, 0, 'interludeWithdraw', [0])).toBe(false);
    expect(intentAllowedFor(s, 0, 'interludeWithdraw', [99])).toBe(false); // index inconnu → personne
  });

  it('modale de jet d’Activité (arbitre M8) : owner = héros du pending', () => {
    const s = interludeState({ pendingActivity: { heroId: 'h2', kind: 'catalog', activityId: 'revenus' } as GameState['pendingActivity'] });
    expect(modalOwnerOf(s)).toBe('h2');
    expect(intentAllowedFor(s, 1, 'activityRoll')).toBe(true);
    expect(intentAllowedFor(s, 0, 'activityRoll')).toBe(false);
  });
});
