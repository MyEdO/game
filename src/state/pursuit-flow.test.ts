/**
 * Poursuite TERRESTRE jouable (#95, LDB 15 l.88-108) : l'Effet `startPursuit` ouvre la boucle de manches
 * (cascade influençable du socle de séquence) ; chaque manche compare le DR le plus bas des poursuivis au
 * DR le plus haut des poursuivants et fait varier la Distance ; issue par `pursuitOutcome` (semé/rattrapé).
 * Réutilise les primitives PARTAGÉES `engine/pursuit` et la CASCADE (state/cascade), pas un flux parallèle.
 */
import { fixtureText } from '../i18n/fixtureText';
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { applyEffects } from './combatFlow';
import { EFFECT_HANDLERS } from './combatEffects';
import { findCreatureById } from '../data';
import {
  startGroundPursuit, pursuitAbandon, pursuitBands, pursuitOf, PURSUIT_POLICY_DEFAUT,
  type PursuitPayload,
} from './pursuitFlow';
import type { PursuitFoe } from '../engine/pursuit';
import { closeSequenceRound, type SequenceState, type MancheClose } from './sequenceCore';
import { startCascade } from './cascade';
import { monoStep, displayStep, type BuiltCascadeStep } from './rollSeam';
import { combatStakeRef } from '../data';
import { createHero } from '../engine/character';
import { skillBaseValue, testValue } from '../engine/skills';
import { intentAllowedFor } from './netOwnership';
import { modalOwnerOf } from './modalArbiter';
import type { Combatant } from '../engine/types';
import type { GameState } from './store';
import type { CascadeStep } from './pendings';

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
function pursuitSeq(p: Partial<PursuitPayload> & { foes: PursuitFoe[] }): SequenceState<PursuitPayload> {
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
      foes: [{ ref: { creatureId: 'brigand' } }, { ref: { creatureId: 'chien-de-chasse' } }],
    });
    const p = pursuitOf(useGame.getState())!;
    // Rien n'est authoré sur l'Effet : chaque coureur EST sa fiche — nom, `char.M` et Athlétisme, et
    // deux fiches différentes donnent deux coureurs différents (`creatures.json` : Brigand M 4 /
    // Athlétisme 40 ; Chien de chasse M 5 / Athlétisme 45).
    expect(p.foes).toEqual([
      { id: 'foe-1', label: 'Brigand', movement: 4, skill: 40 },
      { id: 'foe-2', label: 'Chien de Chasse', movement: 5, skill: 45 },
    ]);
    for (const [id, m, v] of [['brigand', 4, 40], ['chien-de-chasse', 5, 45]] as const) {
      const fiche = findCreatureById(id)!; // la SOURCE, au bestiaire
      expect([fiche.char.M, fiche.skills.find((s) => s.id === 'athletisme')?.value]).toEqual([m, v]);
    }
  });

  it('la Compétence de la course décide ce qui est LU sur la fiche — à cheval, c’est Chevaucher (LDB 15 l.92)', () => {
    heroes();
    startGroundPursuit(useGame.getState, useGame.setState, {
      partyRole: 'pursuing', distance: 4, skill: 'chevaucher', foes: [{ ref: { creatureId: 'capitaine-du-guet' } }],
    });
    const fiche = findCreatureById('capitaine-du-guet')!;
    const chevaucher = fiche.skills.find((s) => s.id === 'chevaucher')!.value;
    const athletisme = fiche.skills.find((s) => s.id === 'athletisme')!.value;
    expect(chevaucher).not.toBe(athletisme); // deux Compétences distinctes sur la MÊME fiche
    expect(pursuitOf(useGame.getState())!.foes[0].skill).toBe(chevaucher);
  });

  it('PORTE : une référence de créature cassée est REFUSÉE à la validation (aucune stat à lire)', () => {
    const ctx = { sceneIds: new Set<string>(), dialogueIds: new Set<string>(), encounterIds: new Set<string>(), entityIds: new Set<string>(), npcSheet: () => undefined, within: () => true };
    const eff = (creatureId: string) => ({
      type: 'startPursuit' as const, partyRole: 'fleeing' as const, distance: 4, skill: { id: 'athletisme' },
      foes: [{ ref: { creatureId } }],
    });
    expect(EFFECT_HANDLERS.startPursuit.refs!(eff('brigand'), ctx)).toEqual([]);
    const issues = EFFECT_HANDLERS.startPursuit.refs!(eff('fantome-inexistant'), ctx);
    expect(issues).toHaveLength(1);
    expect(issues[0].level).toBe('error');
    expect(issues[0].message).toContain('fantome-inexistant');
  });

  it('l’Effet startPursuit ouvre la manche en UNE bande — un rang par coureur, jamais une étape par héros (#1246)', () => {
    const [a, b] = heroes();
    applyEffects(useGame.getState, useGame.setState, [{
      type: 'startPursuit', partyRole: 'fleeing', distance: 4, skill: { id: 'athletisme' },
      foes: [{ ref: { creatureId: 'brigand' } }],
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
      partyRole: 'fleeing', distance: 4, skill: 'athletisme', foes: [{ ref: { creatureId: 'brigand' } }],
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
      partyRole: 'fleeing', distance: 4, skill: 'athletisme', foes: [{ ref: { creatureId: 'brigand' } }],
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
        partyRole: 'fleeing', distance: 4, skill: 'athletisme', foes: [{ ref: { creatureId: 'brigand' } }],
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
    useGame.setState({ sequence: pursuitSeq({ partyRole: 'pursuing', distance: 5, foes: [{ label: 'Voleur', movement: 4, skill: 40 }] }) });
    pursuitAbandon(useGame.getState, useGame.setState);
    expect(pursuitOf(useGame.getState())).toBeNull();
    expect(useGame.getState().journal.some((l) => l.includes('abandonne'))).toBe(true);
  });

  it('poursuite JOUÉE de bout en bout via les bandes (rangées influençables) atteint une issue terminale', () => {
    useGame.getState().seedRng(11);
    heroes();
    startGroundPursuit(useGame.getState, useGame.setState, {
      partyRole: 'fleeing', distance: 5, escapeAt: 8, skill: 'athletisme',
      foes: [{ ref: { creatureId: 'brigand' } }],
    });
    // Pilote la boucle : rouler CHAQUE RANGÉE de la bande puis avancer, manche après manche.
    const manches: number[] = [];
    for (let guard = 0; guard < 40 && useGame.getState().pendingCascade; guard++) {
      const casc = useGame.getState().pendingCascade!;
      manches.push(casc.participants.length);
      const cur = casc.participants[casc.cursor];
      for (const row of cur?.participants ?? []) if (!row.result) useGame.getState().cascadeBatchRoll(row.id);
      // Fenêtre de DÉCISION (rattrapés, l.94) : le pilote tranche la 1ʳᵉ voie — la boucle ne s'arrête pas dessus.
      if (cur?.options?.length && cur.chosen == null) useGame.getState().cascadeChoose(cur.id, cur.options[0].key);
      useGame.getState().cascadeNext();
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
    const etrangere = displayStep({ id: 'reveal-x', kind: 'reveal', label: fixtureText('Une ombre'), worldOwner: true });
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
