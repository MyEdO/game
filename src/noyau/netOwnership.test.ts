/**
 * Possession réseau (Jalon 7, P3) : l'hôte ne rejoue un intent que si le siège émetteur possède
 * le combattant concerné — modale ouverte → son concerné seul ('*' = tous) ; sinon le tour actif.
 */
import { describe, it, expect } from 'vitest';
import {
  intentAllowedFor,
  seatSlotsRemaining,
  controlsActive,
  controlsCombatant,
  pilotedByHuman,
  aiDriven,
  ownsLocal,
  rolledLocally,
  reponseDonnee,
  jetFigeRevele,
} from './netOwnership';
import { spectatorSeatOfModal } from './combatAuto';
import { modalOwnerOf } from './modalArbiter';
import { fermerLeSiege, seatOwns } from './sieges';
import { setCadence, resetCadence } from '../engine/cadence';
import type { Jeu } from './etat';
import { cascadeDeTest } from './cascade.testkit';
import { GUEST_INTENTS } from './intentionsDeSiege';

const base = (over: Partial<Jeu>): Jeu =>
  ({
    net: { mode: 'hote', mySeat: 0, seatNames: { 0: 'Hôte', 1: 'Antoine' }, ownership: { h2: 1 }, slots: [0, 0, 0, 0] },
    // `kind` PORTÉ par le groupe (comme tout héros réel, `createHero`) : hors combat, `seatInfluences`
    // résout le porteur d'un jet dans `party` et distingue héros ⇄ ennemi sur ce champ.
    party: [{ id: 'h1', kind: 'heros' }, { id: 'h2', kind: 'heros' }],
    battle: { order: ['h1', 'h2'], turn: 0, combatants: [
      { id: 'h1', kind: 'heros' }, { id: 'h2', kind: 'heros' }, { id: 'e1', kind: 'ennemi' },
    ] },
    ...over,
  }) as unknown as Jeu;

describe('fermerLeSiege — le départ définitif d’un siège rend ses héros, ses emplacements et le rôle MJ', () => {
  it('héros et emplacements reviennent à l’hôte, le rôle MJ tombe, les autres sièges restent', () => {
    const s = base({});
    const net = { ...s.net, seatNames: { 0: 'Hôte', 1: 'Antoine', 2: 'Léa' }, presence: { 1: 'absent' as const, 2: 'present' as const }, ownership: { h1: 2, h2: 1 }, slots: [1, 2, 0, 1], gmSeat: 1 };
    const apres = fermerLeSiege(net, 1);
    expect(apres).toMatchObject({ seatNames: { 0: 'Hôte', 2: 'Léa' }, presence: { 2: 'present' }, ownership: { h1: 2, h2: 0 }, slots: [0, 2, 0, 0], gmSeat: undefined });
    expect(pilotedByHuman({ ...s, net: apres }, { id: 'e1', kind: 'ennemi' } as never), 'sans MJ, l’ennemi revient à l’IA').toBe(false);
    expect(fermerLeSiege(net, 2).gmSeat, 'fermer un autre siège garde le MJ').toBe(1);
  });
});

describe('rolledLocally (#990) — « ce siège a-t-il produit CE jet ? », base du masque de présentation', () => {
  const solo = () => base({ net: { mode: 'local', mySeat: 0, seatNames: {}, ownership: {}, slots: [0, 0, 0, 0] } } as unknown as Partial<Jeu>);

  it('SOLO : `ownsLocal` est vrai pour TOUS — seul `rolledLocally` distingue mon jet de celui de l’IA', () => {
    const s = solo();
    expect(ownsLocal(s, 'e1'), 'le masque bâti sur ownsLocal serait mort en solo').toBe(true);
    expect(rolledLocally(s, 'e1'), 'l’ennemi IA n’a rien roulé à ce siège').toBe(false);
    expect(rolledLocally(s, 'h1'), 'mon héros : je ne me masque jamais mon propre dé').toBe(true);
  });

  it('allié PNJ `aiControlled` : son jet n’est PAS le mien (l’automate le joue, comme un ennemi IA)', () => {
    const s = base({
      net: { mode: 'local', mySeat: 0, seatNames: {}, ownership: {}, slots: [0, 0, 0, 0] },
      battle: { order: ['h1', 'h2'], turn: 0, combatants: [{ id: 'h1', kind: 'heros' }, { id: 'h2', kind: 'heros', aiControlled: true }, { id: 'e1', kind: 'ennemi' }] },
    } as unknown as Partial<Jeu>);
    expect(rolledLocally(s, 'h2')).toBe(false);
  });

  it('adversaire ABSTRAIT (table de taverne, aucun Combatant) : jamais produit ici', () => {
    expect(rolledLocally(solo(), undefined)).toBe(false);
    expect(rolledLocally(solo(), 'inconnu')).toBe(false);
  });

  it('COOP : l’ennemi conduit par le MJ est masqué pour l’invité, pas pour le MJ', () => {
    const gm = base({ net: { mode: 'hote', mySeat: 0, gmSeat: 0, seatNames: {}, ownership: { h2: 1 }, slots: [0, 0, 0, 0] } } as unknown as Partial<Jeu>);
    expect(rolledLocally(gm, 'e1'), 'le MJ a roulé ce jet lui-même').toBe(true);
    const invite = { ...gm, net: { ...gm.net, mySeat: 1 } } as Jeu;
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

describe('reponseDonnee et jetFigeRevele (#990) — le calendrier d’un Test opposé à jet figé, par siège', () => {
  // h1 et h3 : héros de l'hôte (siège 0) ; h2 : héros de l'invité (siège 1) ; e1 : ennemi de l'IA. Le siège 2
  // ne tient aucun combattant : il regarde la table.
  const net = (mode: 'hote' | 'invite', mySeat: number) =>
    ({ mode, mySeat, seatNames: { 0: 'Hôte', 1: 'Antoine', 2: 'Léa' }, ownership: { h2: 1 }, slots: [0, 0, 0, 0] });
  const table = (mode: 'hote' | 'invite', mySeat: number): Jeu => base({
    net: net(mode, mySeat),
    battle: { order: ['h1', 'h2', 'h3'], turn: 0, combatants: [
      { id: 'h1', kind: 'heros' }, { id: 'h2', kind: 'heros' }, { id: 'h3', kind: 'heros' }, { id: 'e1', kind: 'ennemi' },
    ] },
  } as unknown as Partial<Jeu>);
  const hote = table('hote', 0);
  const invite = table('invite', 1);
  const spectateur = table('invite', 2);
  const jete = { roll: 40 };
  const defense = (id: string, result?: unknown) => [{ id, interactive: true, result }];

  it('Défense du héros de l’invité contre l’IA : masqué partout avant sa réponse, révélé partout après', () => {
    for (const [nom, s] of [['hôte', hote], ['invité', invite], ['spectateur', spectateur]] as const) {
      expect(jetFigeRevele(s, { ownerId: 'e1', participants: defense('h2') }), `${nom} : avant la réponse`).toBe(false);
      expect(jetFigeRevele(s, { ownerId: 'e1', participants: defense('h2', jete) }), `${nom} : après la réponse`).toBe(true);
    }
  });

  it('un siège ne se masque jamais son propre dé ; un autre siège attend la réponse', () => {
    expect(jetFigeRevele(hote, { ownerId: 'h1', participants: defense('h2') }), 'l’hôte a jeté pour h1').toBe(true);
    expect(jetFigeRevele(invite, { ownerId: 'h1', participants: defense('h2') }), 'l’invité attend sa propre réponse').toBe(false);
    expect(jetFigeRevele(spectateur, { ownerId: 'h1', participants: defense('h2') }), 'le spectateur attend la première réponse').toBe(false);
    expect(jetFigeRevele(invite, { ownerId: 'h2', participants: defense('h1') }), 'l’invité a jeté pour h2').toBe(true);
  });

  it('multi : chaque rangée de ce siège doit avoir répondu ; le spectateur suit la première réponse', () => {
    const parts = [{ id: 'h1', interactive: true, result: jete }, { id: 'h3', interactive: true }, { id: 'h2', interactive: true }];
    expect(reponseDonnee(hote, parts), 'h3, rangée de l’hôte, n’a pas jeté').toBe(false);
    expect(reponseDonnee(invite, parts), 'h2, rangée de l’invité, n’a pas jeté').toBe(false);
    expect(reponseDonnee(spectateur, parts), 'h1 a répondu : le spectateur voit').toBe(true);
    expect(reponseDonnee(hote, [{ id: 'h1', interactive: false }, { id: 'h2', interactive: true, result: jete }]),
      'une rangée témoin de ce siège ne s’attend pas').toBe(true);
    expect(reponseDonnee(hote, []), 'aucun répondant : rien à attendre').toBe(true);
  });
});

describe('spectatorSeatOfModal — le siège attendu sur la modale prioritaire', () => {
  const defense = (over: Partial<Jeu>) => base({
    pendingDefense: { attackerId: 'e1', defenderId: 'h2' } as Jeu['pendingDefense'],
    pendingCascade: cascadeDeTest([{ id: 'd', jet: 'defense', kind: 'jetDeDefense', actorId: 'h2' }]),
    ...over,
  });

  it('la Défense du héros de l’invité : l’hôte et le spectateur attendent le siège 1, l’invité aucun', () => {
    expect(spectatorSeatOfModal(defense({}))).toBe(1);
    expect(spectatorSeatOfModal(defense({ net: { ...base({}).net, mode: 'invite', mySeat: 1 } }))).toBeNull();
    expect(spectatorSeatOfModal(defense({ net: { ...base({}).net, mode: 'invite', mySeat: 2 } }))).toBe(1);
  });

  it('solo, ou aucune modale : aucun siège attendu', () => {
    expect(spectatorSeatOfModal(defense({ net: { ...base({}).net, mode: 'local' } }))).toBeNull();
    expect(spectatorSeatOfModal(base({}))).toBeNull();
  });
});
describe('possession réseau (netOwnership)', () => {
  it('sans modale : seul le propriétaire du combattant ACTIF agit', () => {
    const s = base({}); // actif = h1 (non attribué → hôte)
    expect(intentAllowedFor(s, 0, 'terminerLeTour')).toBe(true);
    expect(intentAllowedFor(s, 1, 'terminerLeTour')).toBe(false);
    const s2 = base({ battle: { ...base({}).battle!, turn: 1 } }); // actif = h2 (siège 1)
    expect(intentAllowedFor(s2, 1, 'cliquerLaCase')).toBe(true);
    expect(intentAllowedFor(s2, 0, 'cliquerLaCase')).toBe(false);
  });

  it('modale ouverte : seul son CONCERNÉ agit (défense du héros de l’invité)', () => {
    // La défense est désormais une étape `jet:'defense'` de la cascade `combat` (pendingDefense = porteur de
    // données) ; l'owner de la modale `cascade` = l'actorId de l'étape (le défenseur h2).
    const s = base({
      pendingDefense: { attackerId: 'e1', defenderId: 'h2' } as Jeu['pendingDefense'],
      pendingCascade: cascadeDeTest([{ id: 'd', jet: 'defense', kind: 'jetDeDefense', actorId: 'h2' }]),
    });
    expect(modalOwnerOf(s)).toBe('h2');
    expect(intentAllowedFor(s, 1, 'jetLancer', ['defense'])).toBe(true);
    expect(intentAllowedFor(s, 0, 'jetLancer', ['defense'])).toBe(false);
  });

  it("sort ENNEMI ('*') : tout le monde peut agir (Contre-sort multi)", () => {
    // Wrapper-fold : l'incantation est une étape `jet:'incantation'` de la cascade. Sort ENNEMI → la cascade
    // est ouverte avec `groupOwner:true` → l'entrée `cascade`
    // met l'owner à '*' (moment partagé + Contre-sort multi en coop). `pendingCast` coexiste comme data.
    const s = base({
      pendingCast: { casterId: 'e1', targetId: 'h1' } as Jeu['pendingCast'],
      pendingCascade: cascadeDeTest([{ id: 'c', jet: 'incantation', kind: 'incantation', actorId: 'e1', groupOwner: true }]),
    });
    expect(modalOwnerOf(s)).toBe('*');
    expect(intentAllowedFor(s, 1, 'castCounterspell')).toBe(true);
  });

  it('révélation SANS sujet (entretien) → hôte seul ; sans pause de Round ouverte, sa validation ne se route à aucun siège', () => {
    // #942 L8 : une révélation est une ÉTAPE d'affichage de la cascade — l'owner suit `actorId`
    // (absent pour un entretien de Round) → `seatOwns(…, undefined)` = l'hôte, et le verbe
    // d'acquittement est celui de la cascade (`jetValider('cascade')`).
    const s = base({
      pendingCascade: cascadeDeTest([{ id: 'r', kind: 'round', reveal: { kind: 'round', title: 'x', lines: [] } }]),
    });
    expect(intentAllowedFor(s, 0, 'jetValider', ['cascade'])).toBe(true);
    expect(intentAllowedFor(s, 1, 'jetValider', ['cascade'])).toBe(false);
    expect(intentAllowedFor(s, 1, 'fenetreValider', ['debutDuRound'])).toBe(false);
  });

  it("valider l'étape (`jetValider('cascade')`) : le propriétaire de la fenêtre — l'acteur de l'étape, tous sur une étape de groupe", () => {
    const etape = (over: object) => base({ pendingCascade: cascadeDeTest([{ id: 'e', kind: 'round', ...over }]) });
    const acteur = etape({ actorId: 'h2' });
    expect(intentAllowedFor(acteur, 1, 'jetValider', ['cascade']), 'le siège de l’acteur').toBe(true);
    expect(intentAllowedFor(acteur, 0, 'jetValider', ['cascade']), 'un autre siège').toBe(false);
    const groupe = etape({ actorId: 'h2', groupOwner: true });
    expect([0, 1].map((seat) => intentAllowedFor(groupe, seat, 'jetValider', ['cascade'])), 'étape de groupe').toEqual([true, true]);
  });

  it('seatOwns : héros non attribué → hôte', () => {
    const s = base({});
    expect(seatOwns(s, 0, 'h1')).toBe(true);
    expect(seatOwns(s, 1, 'h1')).toBe(false);
    expect(seatOwns(s, 1, 'h2')).toBe(true);
  });

  it('recruterLeHeros : la route laisse passer, le quota du siège se compte par `seatSlotsRemaining` (le geste tranche)', () => {
    // 2 slots au siège 1, il possède déjà h2 → 1 restant.
    const s = base({
      net: { mode: 'hote', mySeat: 0, seatNames: { 0: 'Hôte', 1: 'Antoine' }, ownership: { h2: 1 }, slots: [0, 1, 1, 0] },
      battle: null,
    } as unknown as Partial<Jeu>);
    expect(seatSlotsRemaining(s, 1)).toBe(1);
    expect(intentAllowedFor(s, 1, 'recruterLeHeros', [{ id: 'h3' }])).toBe(true);
    // Quota épuisé : h3 ajouté au siège 1 → refus.
    const full = base({
      net: { mode: 'hote', mySeat: 0, seatNames: { 0: 'Hôte', 1: 'Antoine' }, ownership: { h2: 1, h3: 1 }, slots: [0, 1, 1, 0] },
      party: [{ id: 'h1' }, { id: 'h2' }, { id: 'h3' }],
      battle: null,
    } as unknown as Partial<Jeu>);
    expect(seatSlotsRemaining(full, 1)).toBe(0);
    expect(intentAllowedFor(full, 1, 'recruterLeHeros', [{ id: 'h4' }])).toBe(true);
  });

  it('renvoyerLeHeros, remplacerLeHeros : la route laisse passer, le geste tranche la possession (`refusDeComposerLeHeros`)', () => {
    const s = base({ battle: null } as unknown as Partial<Jeu>);
    for (const verbe of ['renvoyerLeHeros', 'remplacerLeHeros']) {
      expect(intentAllowedFor(s, 1, verbe, ['h2'])).toBe(true);
      expect(intentAllowedFor(s, 1, verbe, ['h1'])).toBe(true);
    }
  });

  it('carnet d’enquête (#2415) : l’invité épingle et marque vu hors combat sans modale, en combat aussi', () => {
    const vu = [{ id: 'ind', étapes: 1, statut: 'revele', stadeCourant: 's1' }];
    const horsCombat = base({ battle: null } as unknown as Partial<Jeu>);
    expect(intentAllowedFor(horsCombat, 1, 'epinglerLIndice', ['ind', true]), 'épingle refusée à l’invité hors combat').toBe(true);
    expect(intentAllowedFor(horsCombat, 1, 'marquerLesIndices', [vu]), 'nouveauté vue refusée à l’invité hors combat').toBe(true);
    expect(intentAllowedFor(horsCombat, 1, 'commanderLObjet', ['h1']), 'opposé : un geste POSSÉDÉ reste refusé').toBe(false);
    const enCombat = base({}); // actif = h1 (hôte) : le repli refuserait le siège 1
    expect(intentAllowedFor(enCombat, 1, 'epinglerLIndice', ['ind', true])).toBe(true);
    expect(intentAllowedFor(enCombat, 1, 'marquerLesIndices', [vu])).toBe(true);
  });
});

describe('les verbes de la barre (#3610) : la route du combattant actif', () => {
  it('un verbe de la barre suit le combattant actif ; l’armement d’une intention, local, ne voyage pas', () => {
    const s = base({}); // actif = h1 (non attribué → hôte)
    expect(intentAllowedFor(s, 0, 'terminerLeTour'), 'le siège de l’actif').toBe(true);
    expect(intentAllowedFor(s, 1, 'terminerLeTour'), 'un autre siège').toBe(false);
    expect(intentAllowedFor(s, 1, 'prendreLaVisee'), 'un autre siège').toBe(false);
    expect(GUEST_INTENTS.has('armerLIntention'), 'l’armement d’une intention, local à l’émetteur, n’est pas une intention de siège').toBe(false);
  });

  it('le relais de la levée de main émet `leverLaMain`, admis hors de son tour dans les deux sens', () => {
    const s = base({}); // actif = h1, au siège 0
    expect(intentAllowedFor(s, 1, 'leverLaMain', [true])).toBe(true);
    expect(intentAllowedFor(s, 1, 'leverLaMain', [false])).toBe(true);
  });
});

describe('controlsActive — gating d’affichage : le tour d’un héros distant est inerte (comme un tour ennemi)', () => {
  const withSeat = (s: Jeu, mySeat: number): Jeu =>
    ({ ...s, net: { ...s.net, mySeat } }) as Jeu;

  it('mode local / hors combat : toujours vrai', () => {
    expect(controlsActive(base({ net: { ...base({}).net, mode: 'local' } } as unknown as Partial<Jeu>))).toBe(true);
    expect(controlsActive(base({ battle: null } as unknown as Partial<Jeu>))).toBe(true);
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
  const enemyTurn = (gmSeat?: number, mySeat = 0): Jeu => {
    const s = base({ battle: { ...base({}).battle!, order: ['e1', 'h1'], turn: 0 } });
    return { ...s, net: { ...s.net, mySeat, ...(gmSeat != null ? { gmSeat } : {}) } } as Jeu;
  };
  const cid = (s: Jeu, id: string) => s.battle!.combatants.find((c) => c.id === id)!;

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
  const interludeState = (over: Partial<Jeu> = {}): Jeu => base({
    battle: null,
    interlude: { weeks: 2, phase: 'activities', perHero: { h1: { eventRoll: 1, left: 2, revenueBrass: 0 }, h2: { eventRoll: 2, left: 2, revenueBrass: 0 } } },
    bank: [{ uid: 'depot-h2', heroId: 'h2', kind: 'planque', brass: 100, rate: 0 }],
    ...over,
  } as Partial<Jeu>);

  it('activité visant un héros : son propriétaire agit, pas les autres', () => {
    const s = interludeState();
    expect(intentAllowedFor(s, 1, 'fenetreChoisir', ['interlude', 'activite', 'revenus', 'h2'])).toBe(true);
    expect(intentAllowedFor(s, 1, 'fenetreChoisir', ['interlude', 'pratiquer', true, 'h1'])).toBe(false);
    expect(intentAllowedFor(s, 0, 'fenetreChoisir', ['interlude', 'ouvrage', 'dague', 'h1'])).toBe(true);
    expect(intentAllowedFor(s, 0, 'fenetreChoisir', ['interlude', 'talent', 'chanceux', 'h2'])).toBe(false);
    expect(intentAllowedFor(s, 1, 'deposerALaBanque', ['h2', 'planque', 120])).toBe(true);
  });

  it('Entraînement, Faveur et préparation de bataille (héros en 1er argument) : son propriétaire agit, pas les autres', () => {
    const s = interludeState();
    expect(intentAllowedFor(s, 1, 'fenetreChoisir', ['interlude', 'entrainement', 'intelligence', 'h2'])).toBe(true);
    expect(intentAllowedFor(s, 1, 'fenetreChoisir', ['interlude', 'entrainement', 'intelligence', 'h1'])).toBe(false);
    expect(intentAllowedFor(s, 1, 'solderLaFaveur', ['h2'])).toBe(true);
    expect(intentAllowedFor(s, 1, 'solderLaFaveur', ['h1'])).toBe(false);
    expect(intentAllowedFor(s, 1, 'menerLActionDeBataille', ['h2', 'planification'])).toBe(true);
    expect(intentAllowedFor(s, 1, 'menerLActionDeBataille', ['h1', 'planification'])).toBe(false);
    expect(intentAllowedFor(s, 0, 'menerLActionDeBataille', ['h2', 'planification'])).toBe(false);
  });

  it('retrait bancaire : le dépôt appartient à un héros — son propriétaire retire', () => {
    const s = interludeState();
    expect(intentAllowedFor(s, 1, 'retirerDeLaBanque', ['depot-h2'])).toBe(true); // dépôt de h2 (siège 1)
    expect(intentAllowedFor(s, 0, 'retirerDeLaBanque', ['depot-h2'])).toBe(false);
    expect(intentAllowedFor(s, 0, 'retirerDeLaBanque', ['depot-inconnu'])).toBe(false); // dépôt inconnu → personne
  });

  it('modale de jet d’Activité (arbitre M8) : owner = héros du pending', () => {
    const s = interludeState({ pendingActivity: { heroId: 'h2', kind: 'catalog', activityId: 'revenus' } as Jeu['pendingActivity'] });
    expect(modalOwnerOf(s)).toBe('h2');
    expect(intentAllowedFor(s, 1, 'jetLancer', ['activite'])).toBe(true);
    expect(intentAllowedFor(s, 0, 'jetLancer', ['activite'])).toBe(false);
  });
});
