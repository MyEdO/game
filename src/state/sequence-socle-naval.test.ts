/**
 * LE CONTRAT D'UNIVERSALITÉ de la structure d'orchestrateur (#1279) — la preuve PERMANENTE qu'elle
 * n'a pas pris la forme de ses premiers clients. Tant que ce fichier est vert, « utilisable par
 * l'ensemble des systèmes » est une mesure, pas une phrase de design ; le jour où il rougit, c'est
 * que la structure s'est mise à connaître un domaine, et c'est LA qu'il faut la rendre générique.
 *
 * Deux volets :
 *  1. GARDE STRUCTURELLE sur les DEUX fichiers de la structure (le CONTRAT `sequenceContract.ts` et
 *     son IMPLÉMENTATION LÉGÈRE `sequenceCore.ts`) : aucun import d'un système, aucun mot de domaine
 *     dans le code, et pour seuls champs d'état les siens — l'état est générique sur sa charge utile.
 *  2. UNE INSTANCE de forme NAVALE — une charge ÉTRANGÈRE au socle, donc la preuve qu'il est générique : une crise de mer
 *     (coque, sillage en mètres, deux camps) déroule DEUX manches par la structure — cycle,
 *     accumulateur par camp, persistance entre les manches, borne, issue.
 */
import { fixtureText } from '../i18n/fixtureText';
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { combatStakeRef } from '../data';
import { monoStep } from './rollSeam';
import {
  registerSequence, startSequence, activeSequence, sequenceCumRound, sequenceScoreOf,
  SEQUENCE_MAX_ROUNDS, type SequenceRound, type SequenceState, type SequenceVerdict,
} from './sequenceCore';

/** LA STRUCTURE = le contrat + son implémentation légère. Les deux sont sous garde. */
const FICHIERS = ['./sequenceContract.ts', './sequenceCore.ts'];
const SOURCE = FICHIERS.map((f) => readFileSync(new URL(f, import.meta.url), 'utf-8')).join('\n');

/** Le CODE seul (commentaires retirés) — la prose des fichiers NOMME leurs clients, le code ne doit pas. */
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('Structure d’orchestrateur — garde structurelle (elle ne connaît aucun de ses systèmes)', () => {
  it('aucun import d’un domaine : ni poursuite, ni jeux de taverne', () => {
    const imports = [...CODE.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]);
    expect(imports).not.toContain('./pursuitFlow');
    expect(imports).not.toContain('./tavernFlow');
    expect(imports).not.toContain('../engine/pursuit');
    expect(imports).not.toContain('../engine/tavernGame');
    // `rollSeam` contient « sea » : on nomme les MODULES de domaine, pas une sous-chaîne au hasard.
    const domaines = ['pursuitFlow', 'tavernFlow', 'pursuit', 'tavernGame', 'seaVoyageFlow', 'riverVoyageFlow', 'seaActivities', 'combatFlow', 'travelFlow', 'massBattleFlow'];
    expect(imports.filter((i) => domaines.includes(i.split('/').pop()!)), 'aucun module de domaine').toEqual([]);
  });

  it('aucun mot de domaine dans le CODE (la charge utile est opaque au socle)', () => {
    expect(/pursuit|tavern|dominos|vessel|hull/i.test(CODE)).toBe(false);
  });

  /**
   * Les champs ÉCRITS se lisent sur le LITTÉRAL ENTIER de chaque `set({...})`, pas sur son premier
   * champ : une écriture glissée en 2ᵉ position (`set({ sequence, battle })`) passerait sinon sous le
   * radar — mesuré par mutation. `pendingCascade` est autorisé pour un seul geste, l'ABANDON, qui
   * ferme la fenêtre en même temps qu'il retire la séquence.
   */
  it('les SEULS champs d’état écrits sont les SIENS (`sequence`, et la fenêtre qu’elle ferme)', () => {
    const AUTORISES = ['sequence', 'pendingCascade'];
    // Les champs de PREMIER NIVEAU de chaque `set({...})` — un compteur d'accolades, parce qu'une
    // valeur imbriquee (`set({ sequence: { ...seq, payload } })`) n'est PAS un champ d'etat ecrit.
    const ecrits = new Set<string>();
    for (const ouverture of [...CODE.matchAll(/set\(\{/g)]) {
      let i = ouverture.index! + ouverture[0].length;
      let profondeur = 0;
      let niveau1 = '';
      for (; i < CODE.length; i++) {
        const c = CODE[i];
        if (c === '{' || c === '(' || c === '[') profondeur++;
        else if (c === '}' && profondeur === 0) break;
        else if (c === '}' || c === ')' || c === ']') profondeur--;
        else if (profondeur === 0) niveau1 += c;
      }
      for (const champ of niveau1.matchAll(/([A-Za-z_$][\w$]*)\s*:/g)) ecrits.add(champ[1]);
      for (const court of niveau1.split(',')) {
        const nom = court.trim();
        if (/^[A-Za-z_$][\w$]*$/.test(nom)) ecrits.add(nom);
      }
    }
    expect(ecrits.size, 'la garde doit VOIR des écritures, sinon elle ne mesure rien').toBeGreaterThan(0);
    for (const champ of ecrits) expect(AUTORISES).toContain(champ);
    expect([...ecrits], 'les deux champs autorisés sont VIVANTS — aucune entrée morte dans la liste').toEqual(
      expect.arrayContaining(AUTORISES),
    );
    const lus = new Set([...CODE.matchAll(/get\(\)\.(\w+)/g)].map((m) => m[1]));
    for (const champ of lus) expect(['sequence', 'log']).toContain(champ);
  });
});

/* ── L'INSTANCE NAVALE : une crise de mer déroulée par le socle ──────────────────────────────────
 * Forme de charge utile d'une crise (calque `SeaCrisis` : la coque du navire, la distance en mètres,
 * les deux camps) — AUCUN de ces champs n'existe dans le socle, qui la transporte telle quelle. */
interface SeaCrisisPayload {
  crise: 'poursuite-navale';
  vessel: { hullWounds: number };
  metres: number;
  manches: number[];
}

const NAVAL = 'test-crise-navale';

/** Ce que le socle a REDONNÉ au domaine à chaque ouverture de manche — la preuve que l'état a persisté
 *  d'une manche à l'autre (rang, cumuls, charge navale). */
const traceNavale: { round: number; metres: number; cum: Record<string, number> }[] = [];

registerSequence<SeaCrisisPayload>(NAVAL, {
  round: (get, seq): SequenceRound<SeaCrisisPayload> | undefined => {
    const barreur = get().party[0];
    if (!barreur) return undefined;
    traceNavale.push({ round: seq.round, metres: seq.payload.metres, cum: { ...seq.cum } });
    const step = monoStep({
      id: `crise-${seq.round}`, kind: 'testCriseNavale', label: fixtureText(`Manœuvre — manche ${seq.round}`),
      actor: barreur, difficulty: 'intermediaire', ligne: { test: { skill: 'navigation' } },
      stake: combatStakeRef('pursuitMove', { values: { distance: seq.payload.metres, evasion: 500 } }),
    });
    if (!step) return undefined;
    return {
      title: fixtureText(`Crise de mer — manche ${seq.round}`),
      steps: [step],
      immediate: true, // aucune fenêtre à montrer dans ce harnais : le socle résout et enchaîne
      payload: { ...seq.payload, manches: [...seq.payload.manches, seq.round] },
    };
  },
  close: ({ seq, done }): SequenceVerdict<SeaCrisisPayload> => {
    const dr = done.participants[0]?.result?.sl ?? 0;
    // ACCUMULATEUR PAR CAMP du socle (aucun compteur local) + FORMULE DE SCORE en donnée.
    const { cum } = sequenceCumRound(seq, {
      navire: { success: dr >= 0, sl: Math.abs(dr) + 1 },
      poursuivant: { success: true, sl: 1 },
    });
    const avance = sequenceScoreOf(seq.params.score?.navire, [cum.navire, cum.poursuivant]);
    const payload: SeaCrisisPayload = { ...seq.payload, metres: seq.payload.metres + avance };
    if (seq.round >= 2) return { go: 'end', outcome: 'semé', cum, payload };
    return { go: 'continue', cum, payload };
  },
});

describe('Structure d’orchestrateur — instanciable par une crise NAVALE (2 manches déroulées)', () => {
  beforeEach(() => {
    const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Barreur', seed: 1 });
    useGame.setState({ battle: null, party: [h], journal: [], pendingCascade: null, sequence: null });
    useGame.getState().seedRng(9);
  });

  it('deux manches s’enchaînent, l’état PERSISTE entre elles et la charge navale traverse intacte', () => {
    traceNavale.length = 0;
    startSequence<SeaCrisisPayload>(useGame.getState, useGame.setState, {
      def: NAVAL,
      params: { target: 6, score: { navire: 'max' }, maxRounds: 4 },
      payload: { crise: 'poursuite-navale', vessel: { hullWounds: 3 }, metres: 120, manches: [] },
    });
    // DEUX manches ouvertes par le socle (la 2ᵉ sans que le domaine ne la redemande : c'est le cycle).
    expect(traceNavale.map((t) => t.round)).toEqual([1, 2]);
    // La charge NAVALE a traversé la clôture : le sillage de la 1ʳᵉ manche est l'état de départ de la 2ᵉ.
    expect(traceNavale[0].metres).toBe(120);
    expect(traceNavale[1].metres).toBeGreaterThan(120);
    // …et l'accumulateur par camp aussi (vide à l'ouverture, garni à la 2ᵉ manche).
    expect(traceNavale[0].cum).toEqual({});
    expect(Object.keys(traceNavale[1].cum).sort()).toEqual(['navire', 'poursuivant']);
    // Issue atteinte : la séquence est retirée du slot (aucune fuite d'état entre deux crises).
    expect(activeSequence(useGame.getState)).toBeNull();
  });

  it('l’accumulateur PAR CAMP est celui de la structure (Record générique), jamais deux compteurs jumeaux', () => {
    const seq: SequenceState<SeaCrisisPayload> = {
      def: NAVAL, round: 1, cum: { navire: 2, poursuivant: 5 }, params: { target: 6 },
      payload: { crise: 'poursuite-navale', vessel: { hullWounds: 0 }, metres: 0, manches: [] },
    };
    const { cum, done } = sequenceCumRound(seq, {
      navire: { success: true, sl: 3 },
      poursuivant: { success: false, sl: -2 },
    });
    expect(cum).toEqual({ navire: 5, poursuivant: 3 });
    expect(done, 'aucun camp n’a atteint la cible de 6').toEqual([]);
    const { done: atteint } = sequenceCumRound({ ...seq, cum: { navire: 5 } }, { navire: { success: true, sl: 1 } });
    expect(atteint).toEqual(['navire']);
  });

  it('la BORNE anti-boucle est un invariant du CONTRAT, jamais un compteur par système', () => {
    expect(SEQUENCE_MAX_ROUNDS).toBe(50);
    let manches = 0;
    registerSequence<{ n: number }>('test-boucle-infinie', {
      round: (get, seq) => {
        manches = seq.round;
        const h = get().party[0];
        const step = monoStep({
          id: `b-${seq.round}`, kind: 'testCriseNavale', label: fixtureText('Boucle'), actor: h,
          difficulty: 'intermediaire', montee: { base: 50, target: 50 },
          stake: combatStakeRef('pursuitMove', { values: { distance: 1, evasion: 10 } }),
        });
        return step ? { title: fixtureText('Boucle'), steps: [step], immediate: true } : undefined;
      },
      close: () => ({ go: 'continue' }), // ne conclut JAMAIS
    });
    startSequence(useGame.getState, useGame.setState, { def: 'test-boucle-infinie', payload: { n: 0 } });
    expect(activeSequence(useGame.getState), 'la séquence s’est arrêtée').toBeNull();
    expect(manches).toBe(SEQUENCE_MAX_ROUNDS);
    // La borne se COMPTE en manches ouvertes par le socle ; elle se DIT en tours, parce que la
    // manche n'a pas le même prix partout (un lancer de dés autour d'une table en est une aussi).
    expect(useGame.getState().journal.some((l) => l.includes('borne de 50 tours'))).toBe(true);
  });
});
