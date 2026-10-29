/**
 * Poursuite TERRESTRE jouable (#95, LDB 15 l.88-108) : l'Effet `startPursuit` ouvre la boucle de manches
 * (cascade influençable du socle de séquence) ; chaque manche compare le DR le plus bas des poursuivis au
 * DR le plus haut des poursuivants et fait varier la Distance ; issue par `pursuitOutcome` (semé/rattrapé).
 * Réutilise les primitives PARTAGÉES `engine/pursuit` et la CASCADE (noyau/cascade), pas un flux parallèle.
 */
import { fixtureText } from '../i18n/fixtureText';
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { EFFECT_HANDLERS, applyEffects } from '../noyau/combatEffects';
import { findCreatureById } from '../data';
import {
  startGroundPursuit, pursuitBands, pursuitOf, PURSUIT_POLICY_DEFAUT,
  type PursuitPayload,
} from '../noyau/pursuitFlow';
import type { PursuitFoe } from '../engine/pursuit';
import { closeSequenceRound, sequenceAbandonOf } from '../noyau/sequenceCore';
import { type EtatDeFamille, type MancheClose } from '../noyau/sequenceContract';
import { startCascade } from '../noyau/cascade';
import { monoStep, displayStep } from '../noyau/rollSeam';
import { type BuiltCascadeStep } from '../noyau/stepBrand';
import { combatStakeRef } from '../data';
import { createHero } from '../engine/character';
import { skillBaseValue, testValue } from '../engine/skills';
import { intentAllowedFor } from '../noyau/netOwnership';
import { modalOwnerOf } from '../noyau/modalArbiter';
import type { Combatant } from '../engine/types';
import type { GameState } from './store';
import type { CascadeStep } from '../noyau/pendings';
import { avanceEtapeCascade } from '../noyau/cascade.testkit';
import { setCadence, resetCadence } from '../engine/cadence';
import { cleDeFixture } from '../noyau/noyau.testkit';

function heroes() {
  const a = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Alix', seed: 1 });
  const b = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Brun', seed: 2 });
  useGame.setState({ party: [a, b] });
  return [a, b];
}

/** Cascade FIGÉE de manche : la BANDE de la manche, une rangée par coureur ayant roulé son Test de
 *  Mouvement (`sl` imposé) — sert à tester la clôture de manche (`closeSequenceRound`) sans UI. */
function doneRound(party: { id: string }[], sl: number): MancheClose {
  const participants: CascadeStep[] = [{
    id: 'pursuit-1', kind: 'pursuitMove', label: fixtureText('Manche 1 — Athlétisme'), aggregate: 'none',
    participants: party.map((h) => ({
      id: h.id, label: 'Athlétisme', base: 40, target: 40, interactive: true,
      result: { roll: 40, target: 40, sl, success: sl >= 0 },
    })),
  }];
  return { participants };
}

/** SÉQUENCE de poursuite EN COURS — l'état vit dans le socle (`sequence`), la poursuite en est la
 *  charge utile ; les formules de score de camp (l.93) sont des PARAMÈTRES, comme à l'ouverture. */
function pursuitSeq(p: Partial<PursuitPayload> & { foes: PursuitFoe[] }): EtatDeFamille<'pursuit'> {
  return {
    def: 'pursuit', round: p.manche ?? 1, cum: {},
    params: { score: { fleeing: 'min', pursuers: 'max' } },
    payload: {
      partyRole: 'fleeing', distance: 4, escapeAt: 10, skill: 'athletisme',
      policy: { ...PURSUIT_POLICY_DEFAUT }, manche: 1, phase: 'course', retires: [],
      ...p,
      foes: p.foes.map((f, i) => ({ ...f, id: f.id ?? `foe-${i + 1}` })),
    },
  };
}

describe('Poursuite terrestre (#95)', () => {
  beforeEach(() => useGame.setState({ battle: null, party: [], journal: [], pendingCascade: null, sequence: null }));

  it('un adversaire est une RÉFÉRENCE : son Mouvement et sa valeur de Test se LISENT sur la fiche du bestiaire (L2 #1548)', () => {
    heroes();
    startGroundPursuit(useGame.getState, useGame.setState, {
      partyRole: 'fleeing', distance: 4, skill: 'athletisme',
      foes: [{ ref: { creatureId: 'brute' } }, { ref: { creatureId: 'athlete' } }],
    });
    const p = pursuitOf(useGame.getState())!;
    // Rien n'est authoré sur l'Effet : chaque coureur EST sa fiche — nom, `char.M` et Athlétisme, et
    // deux fiches différentes donnent deux coureurs différents (`creatures.json` : Brute M 4 /
    // Athlétisme 45, Middenheim 08 l.13 ; Athlète M 5 / Athlétisme 65, Middenheim 08 l.23).
    expect(p.foes).toEqual([
      { id: 'foe-1', label: 'Brute', movement: 4, skill: 45 },
      { id: 'foe-2', label: 'Athlète', movement: 5, skill: 65 },
    ]);
    for (const [id, m, v] of [['brute', 4, 45], ['athlete', 5, 65]] as const) {
      const fiche = findCreatureById(id)!; // la SOURCE, au bestiaire
      expect([fiche.char.M, fiche.skills.find((s) => s.id === 'athletisme')?.value]).toEqual([m, v]);
    }
  });

  it('la Compétence de la course décide ce qui est LU sur la fiche — à cheval, c’est Chevaucher (LDB 15 l.92)', () => {
    heroes();
    startGroundPursuit(useGame.getState, useGame.setState, {
      partyRole: 'pursuing', distance: 4, skill: 'chevaucher', foes: [{ ref: { creatureId: 'moritz-valgeir' } }],
    });
    const fiche = findCreatureById('moritz-valgeir')!;
    const chevaucher = fiche.skills.find((s) => s.id === 'chevaucher')!.value;
    const athletisme = fiche.skills.find((s) => s.id === 'athletisme')!.value;
    expect(chevaucher).not.toBe(athletisme); // deux Compétences distinctes sur la MÊME fiche
    expect(pursuitOf(useGame.getState())!.foes[0].skill).toBe(chevaucher);
  });

  it('PORTE : une référence de créature cassée est REFUSÉE à la validation (aucune stat à lire)', () => {
    const ctx = { sceneIds: new Set<string>(), dialogueIds: new Set<string>(), encounterIds: new Set<string>(), entityIds: new Set<string>(), npcSheet: () => undefined, within: () => true, walkable: () => true };
    const eff = (creatureId: string) => ({
      type: 'startPursuit' as const, partyRole: 'fleeing' as const, distance: 4, skill: { id: 'athletisme' },
      foes: [{ ref: { creatureId } }],
    });
    expect(EFFECT_HANDLERS.startPursuit.refs!(eff('humain'), ctx)).toEqual([]);
    const issues = EFFECT_HANDLERS.startPursuit.refs!(eff('fantome-inexistant'), ctx);
    expect(issues).toHaveLength(1);
    expect(issues[0].level).toBe('error');
    expect(issues[0].message).toContain('fantome-inexistant');
  });

  it('l’Effet startPursuit ouvre la manche en UNE bande — un rang par coureur, jamais une étape par héros (#1246)', () => {
    const [a, b] = heroes();
    applyEffects(useGame.getState, useGame.setState, [{
      type: 'startPursuit', partyRole: 'fleeing', distance: 4, skill: { id: 'athletisme' },
      foes: [{ ref: { creatureId: 'humain' } }],
    }]);
    const p = pursuitOf(useGame.getState());
    expect(p?.partyRole).toBe('fleeing');
    expect(p?.distance).toBe(4);
    expect(p?.manche).toBe(1);
    const casc = useGame.getState().pendingCascade;
    expect(casc?.purpose).toBe('sequence');
    expect(casc?.participants).toHaveLength(1); // UNE fenêtre pour la manche entière
    const bande = casc!.participants[0];
    expect(bande.aggregate).toBe('none'); // jets INDÉPENDANTS
    expect(bande.participants?.map((r) => r.id).sort()).toEqual([a.id, b.id].sort());
    expect(bande.participants?.every((r) => r.interactive && !r.result)).toBe(true);
  });

  it('la ligne de chaque rangée est montée par le MONTEUR : base NUE + mods NOMMÉS, jamais une valeur fondue (#1246)', () => {
    const [a] = heroes();
    // Un État Sonné (LDB 16) : son malus DOIT apparaître en ligne nommée, pas fondu dans `base`.
    useGame.setState({ party: [{ ...a, conditions: [{ id: 'sonne', value: 2 }] }] });
    startGroundPursuit(useGame.getState, useGame.setState, {
      partyRole: 'fleeing', distance: 4, skill: 'athletisme', foes: [{ ref: { creatureId: 'humain' } }],
    });
    const row = useGame.getState().pendingCascade!.participants[0].participants![0];
    expect(row.base).toBe(skillBaseValue(a, 'athletisme')); // NIVEAU NU
    expect(row.target).toBe(testValue(useGame.getState().party[0], 'athletisme')); // cible DÉRIVÉE
    expect(row.base + (row.mods ?? []).reduce((n, m) => n + m.value, 0)).toBe(row.target); // tout l'écart est NOMMÉ
    expect(row.mods?.some((m) => m.value < 0)).toBe(true); // le Sonné a sa propre ligne
  });

  it('coureur qu’aucun humain ne pilote (héros conduit par l’IA) : sa rangée est un TÉMOIN déjà roulé (#1246)', () => {
    const [a, b] = heroes();
    useGame.setState({ party: [a, { ...b, aiControlled: true }] });
    useGame.getState().seedRng(21);
    startGroundPursuit(useGame.getState, useGame.setState, {
      partyRole: 'fleeing', distance: 4, skill: 'athletisme', foes: [{ ref: { creatureId: 'humain' } }],
    });
    const rows = useGame.getState().pendingCascade!.participants[0].participants!;
    expect(rows.find((r) => r.id === a.id)).toMatchObject({ interactive: true, result: null });
    const temoin = rows.find((r) => r.id === b.id)!;
    expect(temoin.interactive).toBe(false);
    expect(temoin.result).not.toBeNull(); // roulé À LA CONSTRUCTION — son DR comptera à la clôture
  });

  it('COOP : le coureur d’un AUTRE siège garde SA rangée à jouer, et la manche est une fenêtre de GROUPE (#1246)', () => {
    const [a, b] = heroes();
    const net0 = useGame.getState().net;
    useGame.setState({ net: { ...net0, mode: 'host', mySeat: 0, gmSeat: undefined, ownership: { [b.id]: 1 } } as GameState['net'] });
    try {
      useGame.getState().seedRng(7);
      startGroundPursuit(useGame.getState, useGame.setState, {
        partyRole: 'fleeing', distance: 4, skill: 'athletisme', foes: [{ ref: { creatureId: 'humain' } }],
      });
      const band = useGame.getState().pendingCascade!.participants[0];
      // Le jet du héros de l'invité est SURFACÉ (`jetSurfaced`, seat-agnostique) : l'hôte ne le roule pas
      // à sa place — c'est SON joueur qui le tiendra.
      expect(band.participants!.find((r) => r.id === b.id)).toMatchObject({ interactive: true, result: null });
      expect(band.participants!.find((r) => r.id === a.id)).toMatchObject({ interactive: true, result: null });
      // Fenêtre de GROUPE : sans `groupOwner`, l'arbitre rend `undefined` (modale hôte-only) et l'invité
      // ne verrait JAMAIS la manche où se tient son Test.
      expect(band.groupOwner).toBe(true);
      const s = useGame.getState();
      expect(modalOwnerOf(s)).toBe('*');
      expect(intentAllowedFor(s, 1, 'cascadeBatchRoll', [b.id]), 'l’invité roule SA rangée').toBe(true);
      expect(intentAllowedFor(s, 0, 'cascadeBatchRoll', [a.id]), 'l’hôte roule la sienne').toBe(true);
    } finally {
      useGame.setState({ net: net0 });
    }
  });

  it('manche gagnée par les poursuivis (poursuivants médiocres) → Distance grimpe jusqu’à l’évasion', () => {
    useGame.getState().seedRng(3);
    const party = heroes();
    useGame.setState({ sequence: pursuitSeq({ partyRole: 'fleeing', distance: 8, foes: [{ label: 'Bandit', movement: 4, skill: 1 }] }) });
    closeSequenceRound(useGame.getState, useGame.setState, doneRound(party, 6));
    expect(pursuitOf(useGame.getState())).toBeNull(); // dénoué
    expect(useGame.getState().journal.some((l) => l.includes('semé'))).toBe(true);
  });

  it('manche gagnée par les poursuivants (proie lente) → Distance ≤ 0 : le camp poursuivi DÉCIDE (l.94)', () => {
    useGame.getState().seedRng(4);
    const party = heroes();
    useGame.setState({ sequence: pursuitSeq({ partyRole: 'fleeing', distance: 2, foes: [{ label: 'Cavalier', movement: 4, skill: 95 }] }) });
    closeSequenceRound(useGame.getState, useGame.setState, doneRound(party, -6));
    // La poursuite n'est PAS dénouée d'office : « Les poursuivis ont alors la possibilité, pour ce Round,
    // de sacrifier le plus lent d'entre eux […], ou ils peuvent s'arrêter et les affronter » (l.94).
    const p = pursuitOf(useGame.getState());
    expect(p?.phase).toBe('choix-fuyards');
    const choix = useGame.getState().pendingCascade!.participants[0];
    expect(choix.options?.map((o) => o.key)).toEqual(['sacrifier', 'affronter']);
    // Voie « s'arrêter et les affronter » → rattrapage, poursuite close.
    useGame.getState().cascadeChoose(choix.id, 'affronter');
    useGame.getState().cascadeNext();
    expect(pursuitOf(useGame.getState())).toBeNull();
    expect(useGame.getState().journal.some((l) => l.includes('Rattrapés'))).toBe(true);
  });

  it('manche indécise → une nouvelle manche s’ouvre (la poursuite continue)', () => {
    useGame.getState().seedRng(5);
    const party = heroes();
    useGame.setState({ sequence: pursuitSeq({ partyRole: 'fleeing', distance: 5, foes: [{ label: 'Bandit', movement: 4, skill: 40 }] }) });
    closeSequenceRound(useGame.getState, useGame.setState, doneRound(party, 0));
    // Distance reste dans ]0, escapeAt[ → la poursuite n’est pas dénouée, une manche rouvre.
    expect(pursuitOf(useGame.getState())).not.toBeNull();
    expect(useGame.getState().pendingCascade?.purpose).toBe('sequence');
    expect(pursuitOf(useGame.getState())?.manche).toBe(2);
  });

  it('abandon : le groupe renonce et la poursuite se ferme', () => {
    heroes();
    startGroundPursuit(useGame.getState, useGame.setState, { partyRole: 'pursuing', distance: 5, skill: 'athletisme', foes: [{ ref: { creatureId: 'humain' } }] });
    useGame.getState().sequenceAbandon();
    expect(pursuitOf(useGame.getState())).toBeNull();
    expect(useGame.getState().journal.some((l) => l.includes('abandonne'))).toBe(true);
  });

  it.each(['manuel', 'auto'] as const)('abandon d’une poursuite ouverte PAR-DESSUS une cascade hôte (%s) : la cascade parquée reprend — l’abandon immédiat sort par la même queue de clôture que l’abandon demandé', (mode) => {
    setCadence(mode);
    try {
      heroes();
      useGame.setState({ suspendedCascades: [] });
      startCascade(useGame.getState, useGame.setState, { title: 'Journée', purpose: 'test', steps: [displayStep({ id: 'hote-1', kind: cleDeFixture('reveal'), label: fixtureText('Une ombre'), worldOwner: true })] });
      startGroundPursuit(useGame.getState, useGame.setState, { partyRole: 'pursuing', distance: 5, skill: 'athletisme', foes: [{ ref: { creatureId: 'humain' } }] });
      expect(useGame.getState().suspendedCascades.map((c) => c.purpose), 'la cascade hôte est parquée sous la poursuite').toEqual(['test']);
      useGame.getState().sequenceAbandon();
      expect(pursuitOf(useGame.getState())).toBeNull();
      expect(useGame.getState().pendingCascade?.purpose, 'la cascade hôte reprend').toBe('test');
      expect(useGame.getState().suspendedCascades, 'plus rien de parqué').toEqual([]);
    } finally { resetCadence(); }
  });

  it('abandon : libellé et titre suivent le rôle du groupe et la rencontre', () => {
    heroes();
    const libelles = (p: { partyRole: 'fleeing' | 'pursuing'; encounter?: string }) => {
      useGame.setState({ sequence: null, pendingCascade: null });
      startGroundPursuit(useGame.getState, useGame.setState, { distance: 5, skill: 'athletisme', foes: [{ ref: { creatureId: 'humain' } }], ...p });
      const a = sequenceAbandonOf(useGame.getState)!;
      return [a.label, a.title, a.outcome];
    };
    expect(libelles({ partyRole: 'pursuing' })).toEqual(['Abandonner la poursuite', 'Le groupe renonce à traquer sa proie — la poursuite est perdue.', 'abandon']);
    expect(libelles({ partyRole: 'fleeing', encounter: 'embuscade' })).toEqual(['Abandonner la fuite', 'Le groupe cesse de fuir et fait face — les poursuivants fondent sur lui.', 'abandon']);
    expect(libelles({ partyRole: 'fleeing' })).toEqual(['Abandonner la fuite', 'Le groupe cesse de fuir et fait face.', 'abandon']);
  });

  it('cadence AUTO : la bande naît tirée, l’abandon DEMANDÉ clôt la manche par le chemin du joueur (manche appliquée) puis finit la poursuite (LDB 12 l.176)', () => {
    setCadence('auto');
    try {
      heroes();
      startGroundPursuit(useGame.getState, useGame.setState, { partyRole: 'fleeing', distance: 5, skill: 'athletisme', foes: [{ ref: { creatureId: 'humain' } }] });
      const bande = useGame.getState().pendingCascade!.participants[0].participants!;
      expect(bande.every((r) => r.interactive === false && r.result), 'toutes les rangées tirées à l’ouverture').toBe(true);
      expect(sequenceAbandonOf(useGame.getState), 'manche résolue : abandon offert').not.toBeNull();
      useGame.getState().sequenceAbandon();
      const journal = useGame.getState().journal;
      const manche = journal.findIndex((l) => l.startsWith('Manche 1 :'));
      const renonce = journal.indexOf('Le groupe cesse de fuir et fait face.');
      expect(manche, 'la manche tirée est appliquée').toBeGreaterThanOrEqual(0);
      expect(renonce, 'puis le groupe renonce').toBeGreaterThan(manche);
      expect(pursuitOf(useGame.getState())).toBeNull();
      expect(useGame.getState().pendingCascade).toBeNull();
    } finally { resetCadence(); }
  });

  it('cadence AUTO : la clôture menée par l’abandon passe par le dénouement générique — un groupe anéanti est vaincu, il n’abandonne pas', () => {
    setCadence('auto');
    try {
      const [a, b] = heroes();
      startGroundPursuit(useGame.getState, useGame.setState, { partyRole: 'fleeing', distance: 5, skill: 'athletisme', foes: [{ ref: { creatureId: 'humain' } }] });
      expect(sequenceAbandonOf(useGame.getState), 'manche résolue : abandon offert').not.toBeNull();
      useGame.setState({ partyWiped: false, party: [{ ...a, dead: true }, { ...b, dead: true }] });
      useGame.getState().sequenceAbandon();
      expect(useGame.getState().partyWiped, 'checkPartyWiped constate la défaite').toBe(true);
      expect(pursuitOf(useGame.getState())).toBeNull();
      expect(useGame.getState().journal.includes('Le groupe cesse de fuir et fait face.'), 'aucun abandon raconté').toBe(false);
    } finally { resetCadence(); useGame.setState({ partyWiped: false }); }
  });

  it('manche MANUELLE à jet posé mais incomplète : ni offert, ni accepté', () => {
    heroes();
    startGroundPursuit(useGame.getState, useGame.setState, { partyRole: 'fleeing', distance: 5, skill: 'athletisme', foes: [{ ref: { creatureId: 'humain' } }] });
    const bande = () => useGame.getState().pendingCascade!.participants[0].participants!;
    const jouables = bande().filter((r) => r.interactive !== false);
    expect(jouables.length, 'deux héros, deux rangées à jouer').toBe(2);
    useGame.getState().cascadeBatchRoll(jouables[0].id);
    expect(sequenceAbandonOf(useGame.getState)).toBeNull();
    useGame.getState().sequenceAbandon();
    expect(pursuitOf(useGame.getState()), 'la poursuite continue').not.toBeNull();
    expect(bande().find((r) => r.id === jouables[0].id)!.result, 'le jet posé reste à résoudre').toBeTruthy();
  });

  it('poursuite JOUÉE de bout en bout via les bandes (rangées influençables) atteint une issue terminale', () => {
    useGame.getState().seedRng(11);
    heroes();
    startGroundPursuit(useGame.getState, useGame.setState, {
      partyRole: 'fleeing', distance: 5, escapeAt: 8, skill: 'athletisme',
      foes: [{ ref: { creatureId: 'humain' } }],
    });
    // Pilote la boucle : rouler CHAQUE RANGÉE de la bande puis avancer, manche après manche.
    const manches: number[] = [];
    for (let guard = 0; guard < 40 && useGame.getState().pendingCascade; guard++) {
      const casc = useGame.getState().pendingCascade!;
      manches.push(casc.participants.length);
      // Fenêtre de DÉCISION (rattrapés, l.94) : le pilote tranche la 1ʳᵉ voie — la boucle ne s'arrête pas dessus.
      avanceEtapeCascade(useGame.getState, undefined, (st) => st.options![0].key);
    }
    // Chaque manche est UNE fenêtre (le « 1/8 » du signal utilisateur ne peut plus se produire).
    expect(manches.every((n) => n === 1)).toBe(true);
    expect(useGame.getState().pendingCascade).toBeNull();
    expect(pursuitOf(useGame.getState())).toBeNull(); // poursuite dénouée (semé ou rattrapé)
  });

  it('MANCHE SUIVANTE : une manche indécise rouvre UNE bande neuve, jamais la précédente rejouée', () => {
    useGame.getState().seedRng(5);
    const party = heroes();
    useGame.setState({ sequence: pursuitSeq({ partyRole: 'fleeing', distance: 5, foes: [{ label: 'Bandit', movement: 4, skill: 40 }] }) });
    closeSequenceRound(useGame.getState, useGame.setState, doneRound(party, 0));
    const casc = useGame.getState().pendingCascade!;
    expect(casc.participants).toHaveLength(1);
    expect(casc.participants[0].participants?.map((r) => r.id).sort()).toEqual(party.map((h) => h.id).sort());
    expect(casc.participants[0].participants?.every((r) => !r.result)).toBe(true);
  });
});

/**
 * MANCHE RESTAURÉE (#1262 V2 lot 3) — la fabrique de bandification (`pursuitBands`) rendait un
 * littéral SANS possession : `modalOwnerOf` `undefined`, fenêtre à l'HÔTE SEUL, alors que la manche
 * VIVE, elle, était partagée. Depuis la déclaration au socle (`makeBandFactory`), les deux chemins
 * sortent par le MÊME mint.
 */
describe('Poursuite — une manche bandifiée se possède comme la manche vive', () => {
  /** Étape MONO de manche (une par coureur), MINTÉE : la fabrique n'accepte que des produits de la
   *  porte (#1262 V2). */
  const mono = (h: Combatant, round: string): BuiltCascadeStep => monoStep({
    id: `pursuit-${round}-${h.id}`, kind: 'pursuitMove', actor: h, icon: 'travel/foot',
    label: fixtureText(`Manche ${round}`), rollLabel: 'Athlétisme', difficulty: 'intermediaire',
    montee: { base: 40, target: 40 }, stake: combatStakeRef('pursuitMove', { values: { distance: 10, evasion: 3 } }),
  })!;

  it('N coureurs → fenêtre PARTAGÉE ; un seul → la manche EST la sienne', () => {
    const [a, b] = heroes();
    const deux = pursuitBands([mono(a, '1'), mono(b, '1')]);
    expect(deux).toHaveLength(1);
    expect(deux[0].groupOwner, 'deux coureurs : fenêtre de groupe').toBe(true);
    startCascade(useGame.getState, useGame.setState, { title: 'Manche', purpose: 'sequence', steps: deux });
    expect(modalOwnerOf(useGame.getState()), 'jamais `undefined` : c’était la fenêtre hôte-seul').toBe('*');

    useGame.setState({ pendingCascade: null });
    const seul = pursuitBands([mono(b, '2')]);
    expect(seul[0].groupOwner).toBeUndefined();
    expect(seul[0].actorId, 'un seul coureur : la manche EST son étape').toBe(b.id);
  });

  it('une étape ÉTRANGÈRE traverse INTACTE (même référence — la migration compare pour savoir si rien n’a bougé)', () => {
    const [a] = heroes();
    const etrangere = displayStep({ id: 'reveal-x', kind: cleDeFixture('reveal'), label: fixtureText('Une ombre'), worldOwner: true });
    const out = pursuitBands([mono(a, '1'), etrangere]);
    expect(out[1]).toBe(etrangere);
  });

  /**
   * CE QUI DESCEND de l'étape MONO vers la RANGÉE, NOMMÉ (#1262 V2 lot 3) : la bandification passe par
   * le pli UNIQUE du socle (`bandRowOfStep`), donc une manche restaurée recopie aussi `menace` et
   * `meta` — que la fabrique locale d'avant laissait tomber. Inerte aujourd'hui (les monos de manche
   * sortent de `rollStep` sans `menace`), mais `menace` sur une rangée ALLUME l'affordance Résistance
   * (Menace) de la modale (`CascadeModal`) : ce test force la décision consciente le jour où un mono
   * de manche en porterait une.
   */
  it('les champs qui DESCENDENT sur la rangée sont ceux-là, et pas d’autres', () => {
    const [a] = heroes();
    const source = mono(a, '1');
    const rangee = pursuitBands([source])[0].participants![0];
    expect(Object.keys(rangee).sort()).toEqual(['base', 'difficulty', 'id', 'interactive', 'label', 'result', 'target']);
    expect(rangee.menace, 'aucune Menace sur un mono de manche AUJOURD’HUI').toBeUndefined();
    expect(rangee.meta, 'ni charge de rangée').toBeUndefined();
    // …et quand l'étape en porte, elles descendent (pli du socle, jamais un oubli local).
    const avecMenace = monoStep({
      id: `pursuit-9-${a.id}`, kind: 'pursuitMove', actor: a, label: fixtureText('Manche 9'), rollLabel: 'Athlétisme',
      // Tag de catalogue quelconque : ce qui est vérifié ici est le PLI DU SOCLE (le champ descend), pas la Menace.
      difficulty: 'intermediaire', montee: { base: 40, target: 40 }, menace: 'maladie', meta: { round: 9 },
      stake: combatStakeRef('pursuitMove', { values: { distance: 10, evasion: 3 } }),
    })!;
    const r2 = pursuitBands([avecMenace])[0].participants![0];
    expect(r2.menace).toBe('maladie');
    expect(r2.meta).toEqual({ round: 9 });
  });
});
