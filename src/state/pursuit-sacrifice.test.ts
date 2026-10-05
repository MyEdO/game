/**
 * LE SACRIFICE DU PLUS LENT (LDB 15 l.94 + exemple l.100-102) — les QUATRE points que ni le code ni la
 * fiche Atlas ne portaient avant #1279 :
 *  (a) les poursuivis sacrifient leur plus lent OU s'arrêtent et affrontent ;
 *  (b) les poursuivants décident qui s'arrête pour l'affronter et qui continue ;
 *  (c) le retardataire qui n'est pas une cible prioritaire peut être purement et simplement IGNORÉ ;
 *  (d) la Distance se RECALCULE sans le sacrifié (l'étape 3 se rejoue sur la Distance d'AVANT la manche).
 *
 * L'INVARIANT DU RECALCUL, mesuré sans connaître le jet adverse (roulé au RNG semé) : retirer le
 * retardataire décale la variation de Distance d'EXACTEMENT (DR du deuxième plus lent − DR du plus
 * lent). Les deux lignes de journal (manche, puis recalcul) le donnent à l'unité près.
 */
import { fixtureText } from '../i18n/fixtureText';
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { pursuitOf, PURSUIT_POLICY_DEFAUT, type PursuitPayload } from './pursuitFlow';
import type { PursuitFoe } from '../engine/pursuit';
import { closeSequenceRound, type SequenceState, type MancheClose } from './sequenceCore';
import { createHero } from '../engine/character';
import type { Combatant } from '../engine/types';
import type { CascadeStep } from './pendings';

function heroes(): Combatant[] {
  const a = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Alix', seed: 1 });
  const b = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Brun', seed: 2 });
  const c = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Cott', seed: 3 });
  // Mouvements ÉGAUX : aucun DR de vitesse (l.105-108) ne vient troubler l'arithmétique mesurée ici ;
  // le plus lent se départage alors au DR de la manche (`pursuitLaggard`).
  for (const h of [a, b, c]) h.movement = 4;
  useGame.setState({ party: [a, b, c] });
  return [a, b, c];
}

/** SÉQUENCE de poursuite en cours (l'état vit dans le socle). */
function pursuitSeq(p: Partial<PursuitPayload> & { foes: PursuitFoe[] }): SequenceState<PursuitPayload> {
  return {
    def: 'pursuit', round: 1, cum: {},
    params: { score: { fleeing: 'min', pursuers: 'max' } },
    payload: {
      partyRole: 'fleeing', distance: 2, escapeAt: 10, skill: 'athletisme',
      policy: { ...PURSUIT_POLICY_DEFAUT }, manche: 1, phase: 'course', retires: [],
      ...p,
      foes: p.foes.map((f, i) => ({ ...f, id: f.id ?? `foe-${i + 1}` })),
    },
  };
}

/** Manche FIGÉE : une rangée par coureur, DR imposé (le jet adverse, lui, tombe au RNG semé). */
function doneRound(rows: { id: string; sl: number }[]): MancheClose {
  const participants: CascadeStep[] = [{
    id: 'pursuit-1', kind: 'pursuitMove', label: fixtureText('Manche 1 — Athlétisme'), aggregate: 'none',
    participants: rows.map((r) => ({
      id: r.id, label: 'Athlétisme', base: 40, target: 40, interactive: true,
      result: { roll: 40, target: 40, sl: r.sl, success: r.sl >= 0 },
    })),
  }];
  return { participants };
}

/** Les variations de Distance journalisées : celle de la manche, puis celle du recalcul (l.100-102). */
function deltas(): { manche: number; recalcul: number } {
  const j = useGame.getState().journal;
  const manche = j.find((l) => l.startsWith('Manche '));
  const recalc = j.find((l) => l.includes('Distance recalculée'));
  const nb = (l: string | undefined, re: RegExp) => Number(re.exec(l ?? '')?.[1] ?? NaN);
  return {
    manche: nb(manche, /\(([+-]?\d+) →/),
    recalcul: nb(recalc, /: ([+-]?\d+) →/),
  };
}

/**
 * L'EXEMPLE DU SOURCE, rejoué à l'unité près (LDB 15 l.98-102) — le seul ancrage VERBATIM du recalcul,
 * donc le test de référence de la manche de rattrapage :
 *   « Les cultistes possèdent une avance confortable, et le MJ leur attribue Distance 2. […] Sigrid
 *   obtient DR 3, les cultistes DR 0, DR 2 et DR 2, et Eichengard obtient DR 2. […] la différence entre
 *   le cultiste le plus lent (0) et le poursuivant le plus rapide (Sigrid avec 3) est de 3, ce qui
 *   signifie que les Personnages rattrapent les cultistes. Les clowns du chaos […] décident de laisser
 *   derrière eux le plus lent d'entre eux […], et Sigrid s'arrête pour s'occuper de cette anormalité.
 *   Au début du Round suivant, les cultistes ont Distance 1 […], et Eichengard n'a besoin que de les
 *   battre de 1 DR pour les rattraper à nouveau. »
 * Les DR des cultistes tombent du RNG SEMÉ (graine 340 → d100 41/21/20 contre une valeur de 40 → DR
 * 0/2/2) : les jets sont réels, pas des valeurs posées à la main dans l'état.
 */
describe('Poursuite — l’exemple canonique du Source (LDB 15 l.98-102)', () => {
  beforeEach(() => useGame.setState({ battle: null, party: [], journal: [], pendingCascade: null, sequence: null }));

  it('Distance 2, cultistes DR 0/2/2 contre Sigrid DR 3 → rattrapés, sacrifice, Distance 1, Sigrid sortie', () => {
    useGame.getState().seedRng(340);
    const [sigrid, eichengard] = heroes();
    useGame.setState({ party: [sigrid, eichengard] });
    useGame.setState({
      sequence: pursuitSeq({
        partyRole: 'pursuing', distance: 2,
        foes: [
          { label: 'Cultiste 1', movement: 4, skill: 40 },
          { label: 'Cultiste 2', movement: 4, skill: 40 },
          { label: 'Cultiste 3', movement: 4, skill: 40 },
        ],
      }),
    });
    closeSequenceRound(useGame.getState, useGame.setState, doneRound([{ id: sigrid.id, sl: 3 }, { id: eichengard.id, sl: 2 }]));

    // Étape 3 : 0 − 3 = −3 → Distance −1, les Personnages rattrapent (l.100).
    expect(deltas().manche).toBe(-3);
    // Le camp PNJ poursuivi sacrifie son plus lent (DR 0) — pas de fenêtre : il est tenu par le jeu.
    expect(useGame.getState().journal.some((l) => l.includes('abandonnent Cultiste 1'))).toBe(true);
    // (b) le GROUPE poursuit : c'est LUI qui décide qui s'arrête — Sigrid, comme au Source.
    const choix = useGame.getState().pendingCascade!.participants[0];
    expect(choix.options?.map((o) => o.key)).toEqual([`arreter:${sigrid.id}`, `arreter:${eichengard.id}`, 'ignorer']);
    useGame.getState().cascadeChoose(choix.id, `arreter:${sigrid.id}`);
    useGame.getState().cascadeNext();

    const p = pursuitOf(useGame.getState())!;
    // (d) l'étape 3 rejouée sans le sacrifié : 2 − 3 = −1 sur la Distance d'AVANT la manche → 1.
    expect(deltas().recalcul).toBe(-1);
    expect(p.distance, '« Au début du Round suivant, les cultistes ont Distance 1 »').toBe(1);
    expect(p.retires, '« Sigrid s’arrête pour s’occuper de cette anormalité »').toEqual([sigrid.id]);
    expect(p.foes.map((f) => f.label), 'le sacrifié quitte le pool des fuyards').toEqual(['Cultiste 2', 'Cultiste 3']);
    // « Eichengard n'a besoin que de les battre de 1 DR » : la course continue, lui seul en chasse.
    expect(p.phase).toBe('course');
  });
});

describe('Poursuite — sacrifier le plus lent (LDB 15 l.94)', () => {
  beforeEach(() => useGame.setState({ battle: null, party: [], journal: [], pendingCascade: null, sequence: null }));

  it('(a) le camp du GROUPE poursuivi choisit — la voie « sacrifier » nomme le plus lent', () => {
    useGame.getState().seedRng(4);
    const [a, b, c] = heroes();
    useGame.setState({ sequence: pursuitSeq({ distance: 1, foes: [{ label: 'Cavalier', movement: 4, skill: 95 }] }) });
    closeSequenceRound(useGame.getState, useGame.setState, doneRound([{ id: a.id, sl: -6 }, { id: b.id, sl: 2 }, { id: c.id, sl: 3 }]));
    const choix = useGame.getState().pendingCascade!.participants[0];
    expect(choix.options?.find((o) => o.key === 'sacrifier')?.label).toBe('Abandonner Alix'); // DR le plus bas
    expect(choix.actorId, 'jamais l’abandonné qui décide de son sort').not.toBe(a.id);
  });

  it('(a)+(d) sacrifier : le plus lent sort de la course et la Distance se RECALCULE sans lui', () => {
    useGame.getState().seedRng(4);
    const [a, b, c] = heroes();
    useGame.setState({ sequence: pursuitSeq({ distance: 1, foes: [{ label: 'Cavalier', movement: 4, skill: 95 }] }) });
    closeSequenceRound(useGame.getState, useGame.setState, doneRound([{ id: a.id, sl: -6 }, { id: b.id, sl: 2 }, { id: c.id, sl: 3 }]));
    const choix = useGame.getState().pendingCascade!.participants[0];
    useGame.getState().cascadeChoose(choix.id, 'sacrifier');
    useGame.getState().cascadeNext();

    const p = pursuitOf(useGame.getState())!;
    expect(p.retires, 'le sacrifié quitte le pool des coureurs').toEqual([a.id]);
    expect(p.phase, 'la poursuite repart en course').toBe('course');
    const d = deltas();
    // (d) : l'étape 3 rejouée sans le DR −6 se compare au suivant (+2) — l'écart est EXACTEMENT 8.
    expect(d.recalcul - d.manche).toBe(8);
    expect(p.distance).toBe(1 + d.recalcul); // recalculée depuis la Distance d'AVANT la manche
  });

  it('(b) camp PNJ poursuivant : le plus lent des poursuivants s’arrête, les autres continuent', () => {
    useGame.getState().seedRng(4);
    const [a, b, c] = heroes();
    useGame.setState({
      // `escapeAt` haut : la manche recalculée ne peut pas SEMER les poursuivants, elle continue.
      sequence: pursuitSeq({ distance: 1, escapeAt: 30, foes: [{ label: 'Cavalier vif', movement: 6, skill: 60 }, { label: 'Trainard', movement: 4, skill: 60 }] }),
    });
    // Les deux coureurs restants sont rapides : le recalcul (d) laisse la poursuite OUVERTE, ce qui rend
    // le retrait du poursuivant arrêté observable dans l'état.
    closeSequenceRound(useGame.getState, useGame.setState, doneRound([{ id: a.id, sl: -6 }, { id: b.id, sl: 12 }, { id: c.id, sl: 13 }]));
    useGame.getState().cascadeChoose(useGame.getState().pendingCascade!.participants[0].id, 'sacrifier');
    useGame.getState().cascadeNext();
    const p = pursuitOf(useGame.getState())!;
    expect(p.foes.map((f) => f.label), 'le poursuivant le plus lent quitte la chasse').toEqual(['Cavalier vif']);
    expect(useGame.getState().journal.some((l) => l.includes('Trainard s’arrête pour affronter Alix'))).toBe(true);
  });

  it('(c) le retardataire qui n’est PAS une cible prioritaire est purement et simplement IGNORÉ', () => {
    useGame.getState().seedRng(4);
    const [a, b, c] = heroes();
    useGame.setState({
      sequence: pursuitSeq({
        distance: 1,
        foes: [{ label: 'Cavalier', movement: 4, skill: 60 }],
        policy: { ...PURSUIT_POLICY_DEFAUT, prioritaires: [b.id] }, // la scène ne veut QUE Brun
      }),
    });
    closeSequenceRound(useGame.getState, useGame.setState, doneRound([{ id: a.id, sl: -6 }, { id: b.id, sl: 2 }, { id: c.id, sl: 3 }]));
    useGame.getState().cascadeChoose(useGame.getState().pendingCascade!.participants[0].id, 'sacrifier');
    useGame.getState().cascadeNext();
    const p = pursuitOf(useGame.getState())!;
    expect(p.foes, 'aucun poursuivant ne s’arrête pour un retardataire sans intérêt').toHaveLength(1);
    expect(p.retires).toEqual([a.id]);
    expect(useGame.getState().journal.some((l) => l.includes('n’est pas une cible prioritaire'))).toBe(true);
  });

  it('(b)+(c) quand c’est le GROUPE qui poursuit, la décision est une FENÊTRE : qui s’arrête, ou ignorer', () => {
    useGame.getState().seedRng(4);
    const [a, b, c] = heroes();
    useGame.setState({
      sequence: pursuitSeq({
        partyRole: 'pursuing', distance: 6,
        // Deux fuyards PNJ : le second est un poids mort (M 3 contre M 5, et il court mal) — la
        // politique du camp le sacrifie ; le premier garde assez d'avance pour que la course continue.
        foes: [{ label: 'Voleur agile', movement: 5, skill: 90 }, { label: 'Gros Jean', movement: 3, skill: 1 }],
      }),
    });
    closeSequenceRound(useGame.getState, useGame.setState, doneRound([{ id: a.id, sl: 3 }, { id: b.id, sl: 3 }, { id: c.id, sl: 3 }]));
    const p = pursuitOf(useGame.getState())!;
    expect(p.phase).toBe('choix-poursuivants');
    const choix = useGame.getState().pendingCascade!.participants[0];
    expect(choix.options?.map((o) => o.key)).toEqual([`arreter:${a.id}`, `arreter:${b.id}`, `arreter:${c.id}`, 'ignorer']);
    useGame.getState().cascadeChoose(choix.id, `arreter:${b.id}`);
    useGame.getState().cascadeNext();
    const apres = pursuitOf(useGame.getState())!;
    expect(apres.retires, 'le héros qui s’arrête quitte la course').toEqual([b.id]);
    expect(apres.foes.map((f) => f.label), 'le sacrifié quitte le pool des fuyards').toEqual(['Voleur agile']);
  });
});
