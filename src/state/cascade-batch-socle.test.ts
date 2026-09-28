import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { bonus } from '../engine/characteristics';
import { startCascade } from './cascade';
import { spyApplier } from './cascadeTestKit';
import { FLOW_VERBS } from './flowVerbs';
import { frozenOpposedBatchStep } from './combat/triggeredTest';
import type { CascadeStep, BatchParticipant } from './pendings';
import type { Combatant } from '../engine/types';
import { EMPTY_FLOW, type FlowTest } from './flow';
import './travelPostes'; // enregistre l'applier de BANDE de voyage `weatherResistance` (EDOC 8 l.86/127)

/**
 * SOCLE des BANDES de cascade (#1117, flux `cascadeBatch`) — les trois capacités qu'une rangée doit
 * offrir pour qu'une bande vaille une étape MONO :
 *  1. CHARGE UTILE par rangée (`BatchParticipant.meta`) : l'applier d'une bande lit, PAR RANGÉE, ce qui
 *     diverge d'un héros à l'autre. L'enjeu, lui, reste celui de l'ÉTAPE (la clé d'une bande EST
 *     l'entrée de règle mise en jeu) ;
 *  2. DÉTERMINATION par rangée (LDB 17 l.59) : `BatchParticipant.immune` marque LE porteur, les autres
 *     rangées gardant leur conséquence ;
 *  3. RÉSISTANCE (Menace) par rangée (LDB 10 l.1016-1020) : une bande dont le Test est tagué `menace`
 *     se construit (plus de fail-fast) et chaque rangée peut jouer SON auto-succès.
 */

const bandHero = (id: string, over: Partial<Combatant> = {}): Combatant => {
  const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: id, seed: 2 });
  h.id = id;
  h.characteristics.endurance = 43; // Bonus d'Endurance = 4 (DR imposé de la Résistance)
  Object.assign(h, over);
  return h;
};

/** Bande GÉNÉRIQUE (`aggregate:'none'` — jets indépendants) : une rangée par héros, cible 50. La
 *  POSSESSION se dérive des rangées comme dans `bandStep` (plusieurs porteurs → `groupOwner`, un seul →
 *  SON `actorId`) : une bande anonyme n'entre plus dans une séquence (#1262 V2 L4). */
const band = (kind: string, parts: BatchParticipant[], over: Partial<CascadeStep> = {}): CascadeStep =>
  ({
    id: 'bande', kind, label: 'Bande', aggregate: 'none', participants: parts, result: null,
    ...(new Set(parts.map((p) => p.id)).size > 1 ? { groupOwner: true } : { actorId: parts[0]?.id }),
    ...over,
  }) as CascadeStep;

const row = (id: string, over: Partial<BatchParticipant> = {}): BatchParticipant =>
  ({ id, interactive: true, base: 50, target: 50, result: null, ...over });

beforeEach(() => {
  useGame.setState({ battle: null, pendingCascade: null, suspendedCascades: [], journal: [] });
  useGame.getState().seedRng(7);
});

describe('parité des VERBES : une bande offre ce qu’offre l’étape mono', () => {
  it('`cascadeBatch` expose TOUS les verbes de `cascade` (resist compris) PLUS `determine`', () => {
    const mono = FLOW_VERBS.cascade.verbs as readonly string[];
    const bande = FLOW_VERBS.cascadeBatch.verbs as readonly string[];
    const manquants = mono.filter((v) => !bande.includes(v));
    expect(manquants, 'verbe de l’étape mono absent de la bande — la rangée ne peut pas jouer sa règle').toEqual([]);
    // La Psychologie ne se testant qu'en bandes, `determine` (LDB 17 l.59) n'est plus exposé QUE là :
    // le filet de parité ci-dessus ne le couvre plus, il s'exige donc nommément.
    expect(bande, 'la Détermination n’est plus jouable nulle part').toContain('determine');
  });

  it('les délégués de store correspondants existent', () => {
    const s = useGame.getState();
    expect(typeof s.cascadeBatchResist).toBe('function');
    expect(typeof s.cascadeBatchDetermine).toBe('function');
  });
});

describe('CHARGE UTILE par rangée (`meta`) — l’applier lit la donnée DE LA RANGÉE', () => {
  it('chaque rangée porte SA donnée d’applier ; l’enjeu reste celui de l’étape', () => {
    const h1 = bandHero('h1'); const h2 = bandHero('h2');
    useGame.setState({ party: [h1, h2] });
    const vues: { id: string; meta: unknown }[] = [];
    spyApplier('bande-meta', vues, (step) => ({ id: 'step', meta: (step.participants ?? []).map((p) => ({ id: p.id, ...p.meta })) }));
    startCascade(useGame.getState, useGame.setState, {
      title: 'Bande', purpose: 'test',
      steps: [band('bande-meta', [
        row(h1.id, { meta: { psychKind: 'peur', prevDR: 2 } }),
        row(h2.id, { meta: { psychKind: 'peur', prevDR: 0 } }),
      ])],
    });
    useGame.getState().cascadeBatchRoll(h1.id);
    useGame.getState().cascadeBatchRoll(h2.id);
    useGame.getState().cascadeNext();
    expect(vues[0].meta).toEqual([
      { id: 'h1', psychKind: 'peur', prevDR: 2 },
      { id: 'h2', psychKind: 'peur', prevDR: 0 },
    ]);
  });
});

describe('DÉTERMINATION par rangée (LDB 17 l.59)', () => {
  const psychBand = () =>
    band('bande-psy', [row('h1'), row('h2')], {
      combatPsych: { kind: 'peur', sourceId: 'e1', sourceName: 'Bête', indice: 2 },
    });

  it('le verbe agit sur LA rangée : `immune` posé, Détermination débitée, l’autre rangée intacte', () => {
    const h1 = bandHero('h1', { resolve: 2 }); const h2 = bandHero('h2', { resolve: 2 });
    useGame.setState({ party: [h1, h2] });
    const vues: { parts: { id: string; immune?: boolean }[] }[] = [];
    spyApplier('bande-psy', vues, (step) => ({ parts: (step.participants ?? []).map((p) => ({ id: p.id, immune: p.immune })) }));
    startCascade(useGame.getState, useGame.setState, { title: 'Peur', purpose: 'test', steps: [psychBand()] });

    useGame.getState().cascadeBatchDetermine(h1.id);
    const st = useGame.getState().pendingCascade!.participants[0];
    expect(st.participants![0].immune).toBe(true);
    expect(st.participants![0].result).toEqual({ roll: 50, target: 50, sl: 0, success: true });
    expect(st.participants![1].immune).toBeUndefined();
    expect(st.participants![1].result).toBeNull();
    expect(useGame.getState().party.find((c) => c.id === h1.id)!.resolve).toBe(1);
    expect(useGame.getState().party.find((c) => c.id === h2.id)!.resolve).toBe(2);

    useGame.getState().cascadeBatchRoll(h2.id);
    useGame.getState().cascadeNext();
    // L'applier de bande lit le flag PAR RANGÉE (h1 immunisé, h2 non).
    expect(vues[0].parts).toEqual([{ id: 'h1', immune: true }, { id: 'h2', immune: undefined }]);
  });

  it('bande NON psychologique → no-op (aucune Détermination brûlée)', () => {
    const h1 = bandHero('h1', { resolve: 2 });
    useGame.setState({ party: [h1] });
    spyApplier('bande-nue', [], () => null);
    startCascade(useGame.getState, useGame.setState, { title: 'X', purpose: 'test', steps: [band('bande-nue', [row(h1.id)])] });
    useGame.getState().cascadeBatchDetermine(h1.id);
    expect(useGame.getState().pendingCascade!.participants[0].participants![0].result).toBeNull();
    expect(useGame.getState().party[0].resolve).toBe(2);
  });
});

describe('RÉSISTANCE (Menace) par rangée (LDB 10 l.1016-1020)', () => {
  it('le verbe agit sur LA rangée taguée : auto-succès à DR = Bonus d’Endurance, l’autre rangée intacte', () => {
    const talents = [{ talentId: 'resistance', spec: 'maladie', times: 1 }];
    const h1 = bandHero('h1', { talents }); const h2 = bandHero('h2', { talents });
    useGame.setState({ party: [h1, h2] });
    spyApplier('bande-menace', [], () => null);
    startCascade(useGame.getState, useGame.setState, {
      title: 'Contagion', purpose: 'test',
      steps: [band('bande-menace', [row(h1.id, { menace: 'maladie' }), row(h2.id, { menace: 'maladie' })], { menace: 'maladie' })],
    });
    useGame.getState().cascadeBatchResist(h1.id);
    const st = useGame.getState().pendingCascade!.participants[0];
    expect(st.participants![0].result).toEqual({ roll: 1, target: 50, sl: bonus(43), success: true });
    expect(st.participants![1].result).toBeNull();
    expect(useGame.getState().party.find((c) => c.id === h1.id)!.resistanceUsed).toContain('maladie');
    expect(useGame.getState().party.find((c) => c.id === h2.id)!.resistanceUsed ?? []).toEqual([]);
  });

  it('rangée NON taguée → no-op (la spec du talent n’est pas consommée)', () => {
    const h1 = bandHero('h1', { talents: [{ talentId: 'resistance', spec: 'maladie', times: 1 }] });
    useGame.setState({ party: [h1] });
    spyApplier('bande-nue2', [], () => null);
    startCascade(useGame.getState, useGame.setState, { title: 'X', purpose: 'test', steps: [band('bande-nue2', [row(h1.id)])] });
    useGame.getState().cascadeBatchResist(h1.id);
    expect(useGame.getState().pendingCascade!.participants[0].participants![0].result).toBeNull();
    expect(useGame.getState().party[0].resistanceUsed ?? []).toEqual([]);
  });
});

describe('bande d’un Test tagué MENACE — la construction n’est plus refusée', () => {
  it('`frozenOpposedBatchStep` bâtit l’étape et propage le tag sur CHAQUE rangée', () => {
    const attaquant = bandHero('e1'); const d1 = bandHero('h1'); const d2 = bandHero('h2');
    const ft: FlowTest = {
      skill: { id: 'resistance' }, menace: 'maladie',
      opposed: { attacker: 'endurance', attackerSkill: 'resistance' },
    };
    const step = frozenOpposedBatchStep(
      [d1, d2], ft, { onSuccess: EMPTY_FLOW, onFail: EMPTY_FLOW }, EMPTY_FLOW, 'intermediaire', attaquant,
      { roll: 40, target: 50, sl: 1, success: true, isDouble: false },
    );
    expect(step).toBeTruthy();
    expect(step!.menace).toBe('maladie');
    expect(step!.participants!.map((p) => p.menace)).toEqual(['maladie', 'maladie']);
  });
});

/**
 * SEAM `onOwnTestFailed` d'une BANDE (#1117 L1, réparation au SOCLE) — `commitStep` l'émet PAR RANGÉE
 * PERDANTE. Le RAW ne scope pas : MSRC 16 l.152-158 (Crampes abdominales) dit « Lorsqu'un Test se solde
 * par un échec normal ou pire, il se plie en deux de douleur, incapable de bouger ou d'agir pendant le
 * prochain Round, et gagne l'État *Sonné*. » — TOUT Test. Les bandes préexistantes (voyage) étaient donc
 * en DETTE depuis leur naissance ; la réparation au socle les guérit du même geste.
 */
const COLIQUE = { id: 'colique', phase: 'active' as const, symptoms: [{ symptomId: 'crampes-abdominales' }], minutesLeft: 1e5, durationMinutes: 1e5 };

/** Pose des jets DÉTERMINISTES sur les rangées de l'étape courante, puis valide (aucun RNG en jeu). */
function commitRows(results: BatchParticipant['result'][]): void {
  const pc = useGame.getState().pendingCascade!;
  const st = pc.participants[pc.cursor];
  const participants = st.participants!.map((p, k) => ({ ...p, result: results[k] }));
  useGame.setState({ pendingCascade: { ...pc, participants: pc.participants.map((x, i) => (i === pc.cursor ? { ...x, participants } : x)) } });
  useGame.getState().cascadeNext();
}

const LOSE = (target: number) => ({ roll: 99, target, sl: -2, success: false });
const WIN = (target: number) => ({ roll: 1, target, sl: 2, success: true });

describe('SEAM `onOwnTestFailed` PAR RANGÉE — toute bande, pas seulement la Psychologie', () => {
  it('bande de VOYAGE (`weatherResistance`, EDOC 8 l.86/127) : la rangée ratée déclenche les Crampes de SON porteur', () => {
    const h1 = bandHero('h1', { diseases: [{ ...COLIQUE }] });
    const h2 = bandHero('h2', { diseases: [{ ...COLIQUE }] });
    useGame.setState({ party: [h1, h2] });
    startCascade(useGame.getState, useGame.setState, {
      title: 'Traversée', purpose: 'test',
      steps: [band('weatherResistance', [row(h1.id), row(h2.id)])],
    });
    commitRows([LOSE(50), WIN(50)]);
    const [a, b] = useGame.getState().party;
    expect(a.conditions.some((c) => c.id === 'sonne')).toBe(true);
    expect(b.conditions.some((c) => c.id === 'sonne')).toBe(false);
    // L'applier de la bande a bien joué SA propre conséquence en plus du seam (Exténué sur l'échec).
    expect(a.conditions.some((c) => c.id === 'extenue')).toBe(true);
    expect(b.conditions.some((c) => c.id === 'extenue')).toBe(false);
  });

  it('étampe `noOwnTestFailed` : au niveau de la BANDE elle coupe tout, au niveau d’une RANGÉE elle ne coupe QUE la sienne', () => {
    const h1 = bandHero('h1', { diseases: [{ ...COLIQUE }] });
    const h2 = bandHero('h2', { diseases: [{ ...COLIQUE }] });
    useGame.setState({ party: [h1, h2] });
    spyApplier('bande-seam', [], () => null);
    startCascade(useGame.getState, useGame.setState, {
      title: 'X', purpose: 'test',
      steps: [
        band('bande-seam', [row(h1.id), row(h2.id)], { meta: { noOwnTestFailed: true } }),
        band('bande-seam', [row(h1.id, { meta: { noOwnTestFailed: true } }), row(h2.id)], { id: 'bande-2' }),
      ],
    });
    commitRows([LOSE(50), LOSE(50)]); // bande ENTIÈREMENT étampée → personne n'est Sonné
    expect(useGame.getState().party.every((c) => !c.conditions.some((x) => x.id === 'sonne'))).toBe(true);
    commitRows([LOSE(50), LOSE(50)]); // 2ᵉ bande : seule la rangée h1 est étampée
    const [a, b] = useGame.getState().party;
    expect(a.conditions.some((c) => c.id === 'sonne')).toBe(false);
    expect(b.conditions.some((c) => c.id === 'sonne')).toBe(true);
  });
});
