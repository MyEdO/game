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
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { fixtureText } from '../i18n/fixtureText';
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { specificateursDe } from '../../scripts/guards/lib/importGraph.mjs';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { createHero } from '../engine/character';
import { combatStakeRef } from '../data';
import { monoStep } from './rollSeam';
import { startSequence, activeSequence, sequenceCumulsDeLaManche, sequenceScoreOf } from './sequenceCore';
import { SEQUENCE_MAX_ROUNDS, type SequenceRound, type SequenceState, type SequenceVerdict } from './sequenceContract';
import { avecLesTables, sequenceDeFixture, cleDeFixture } from './noyau.testkit';
import { tablesDuJeu } from './tablesDuJeu';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/** LA STRUCTURE = le contrat + son implémentation légère. Les deux sont sous garde. */
const FICHIERS = ['./sequenceContract.ts', './sequenceCore.ts'];
const SOURCES = FICHIERS.map((fichier) => ({ fichier, texte: readFileSync(new URL(fichier, import.meta.url), 'utf-8') }));
const SOURCE = SOURCES.map(({ texte }) => texte).join('\n');

/** Le CODE seul (commentaires retirés) — la prose des fichiers NOMME leurs clients, le code ne doit pas. */
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('Structure d’orchestrateur — garde structurelle (elle ne connaît aucun de ses systèmes)', () => {
  it('aucun import d’un domaine : ni poursuite, ni jeux de taverne', () => {
    const imports = SOURCES.flatMap(({ fichier, texte }) => specificateursDe(fichier, texte).map(({ spec }) => spec));
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
   * radar — mesuré par mutation. `pendingCascade` est la fenêtre de la manche : le socle la LIT pour
   * savoir si la manche est entamée ou résolue (LDB 12 l.176), jamais ne l'écrit — même l'abandon la
   * ferme par la queue de clôture de toute cascade.
   */
  it('le SEUL champ d’état écrit est le SIEN (`sequence`) ; la fenêtre est lue, jamais écrite', () => {
    const AUTORISES = ['sequence'];
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
    expect([...ecrits], 'le champ autorisé est VIVANT — aucune entrée morte dans la liste').toEqual(
      expect.arrayContaining(AUTORISES),
    );
    const lus = new Set([...CODE.matchAll(/get\(\)\.(\w+)/g)].map((m) => m[1]));
    for (const champ of lus) expect([...AUTORISES, 'pendingCascade', 'ecrireAuJournal', 'forgerUnId']).toContain(champ);
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
const traceNavale: { manche: number; metres: number; cumuls: Record<string, number> }[] = [];
/** Manches ouvertes par la séquence qui ne conclut jamais (`test-boucle-infinie`). */
let manches = 0;

beforeEach(() => { avecLesTables({ sequences: { ...tablesDuJeu().sequences, [NAVAL]: sequenceDeFixture<SeaCrisisPayload>({
  manche: (get, seq): SequenceRound<SeaCrisisPayload> | undefined => {
    const barreur = get().party[0];
    if (!barreur) return undefined;
    traceNavale.push({ manche: seq.manche, metres: seq.chargeUtile.metres, cumuls: { ...seq.cumuls } });
    const step = monoStep({
      id: `crise-${seq.manche}`, kind: cleDeFixture('testCriseNavale'), label: fixtureText(`Manœuvre — manche ${seq.manche}`),
      actor: barreur, difficulty: 'intermediaire', ligne: { test: { skill: { id: 'navigation' } } },
      stake: combatStakeRef('poursuite-manche', { values: { distance: seq.chargeUtile.metres, evasion: 500 } }),
    });
    if (!step) return undefined;
    return {
      title: fixtureText(`Crise de mer — manche ${seq.manche}`),
      steps: [step],
      immediate: true, // aucune fenêtre à montrer dans ce harnais : le socle résout et enchaîne
      chargeUtile: { ...seq.chargeUtile, manches: [...seq.chargeUtile.manches, seq.manche] },
    };
  },
  clore: ({ seq, mancheClose }): SequenceVerdict<SeaCrisisPayload> => {
    const dr = mancheClose.participants[0]?.result?.sl ?? 0;
    // ACCUMULATEUR PAR CAMP du socle (aucun compteur local) + FORMULE DE SCORE en donnée.
    const { cumuls } = sequenceCumulsDeLaManche(seq, {
      navire: { success: dr >= 0, sl: Math.abs(dr) + 1 },
      poursuivant: { success: true, sl: 1 },
    });
    const avance = sequenceScoreOf(seq.parametres.score?.navire, [cumuls.navire, cumuls.poursuivant]);
    const chargeUtile: SeaCrisisPayload = { ...seq.chargeUtile, metres: seq.chargeUtile.metres + avance };
    if (seq.manche >= 2) return { suite: 'fin', issue: 'semé', cumuls, chargeUtile };
    return { suite: 'poursuivre', cumuls, chargeUtile };
  },
}), 'test-boucle-infinie': sequenceDeFixture<{ n: number }>({
      manche: (get, seq) => {
        manches = seq.manche;
        const h = get().party[0];
        const step = monoStep({
          id: `b-${seq.manche}`, kind: cleDeFixture('testCriseNavale'), label: fixtureText('Boucle'), actor: h,
          difficulty: 'intermediaire', montee: { base: 50, target: 50 },
          stake: combatStakeRef('poursuite-manche', { values: { distance: 1, evasion: 10 } }),
        });
        return step ? { title: fixtureText('Boucle'), steps: [step], immediate: true } : undefined;
      },
      clore: () => ({ suite: 'poursuivre' }), // ne conclut JAMAIS
    }) } }); });

describe('Structure d’orchestrateur — instanciable par une crise NAVALE (2 manches déroulées)', () => {
  beforeEach(() => {
    const h = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Barreur', seed: 1 });
    banc.setState({ battle: null, party: [h], journal: [], pendingCascade: null, sequence: null });
    banc.getState().ensemencerLeTirage(9);
  });

  it('deux manches s’enchaînent, l’état PERSISTE entre elles et la charge navale traverse intacte', () => {
    traceNavale.length = 0;
    startSequence<SeaCrisisPayload>(banc.getState, banc.setState, {
      definition: NAVAL,
      parametres: { target: 6, score: { navire: 'max' }, maxRounds: 4 },
      chargeUtile: { crise: 'poursuite-navale', vessel: { hullWounds: 3 }, metres: 120, manches: [] },
    });
    // DEUX manches ouvertes par le socle (la 2ᵉ sans que le domaine ne la redemande : c'est le cycle).
    expect(traceNavale.map((t) => t.manche)).toEqual([1, 2]);
    // La charge NAVALE a traversé la clôture : le sillage de la 1ʳᵉ manche est l'état de départ de la 2ᵉ.
    expect(traceNavale[0].metres).toBe(120);
    expect(traceNavale[1].metres).toBeGreaterThan(120);
    // …et l'accumulateur par camp aussi (vide à l'ouverture, garni à la 2ᵉ manche).
    expect(traceNavale[0].cumuls).toEqual({});
    expect(Object.keys(traceNavale[1].cumuls).sort()).toEqual(['navire', 'poursuivant']);
    // Issue atteinte : la séquence est retirée du slot (aucune fuite d'état entre deux crises).
    expect(activeSequence(banc.getState)).toBeNull();
  });

  it('l’accumulateur PAR CAMP est celui de la structure (Record générique), jamais deux compteurs jumeaux', () => {
    const seq: SequenceState<SeaCrisisPayload> = {
      definition: NAVAL, manche: 1, cumuls: { navire: 2, poursuivant: 5 }, parametres: { target: 6 },
      chargeUtile: { crise: 'poursuite-navale', vessel: { hullWounds: 0 }, metres: 0, manches: [] },
    };
    const { cumuls, atteints } = sequenceCumulsDeLaManche(seq, {
      navire: { success: true, sl: 3 },
      poursuivant: { success: false, sl: -2 },
    });
    expect(cumuls).toEqual({ navire: 5, poursuivant: 3 });
    expect(atteints, 'aucun camp n’a atteint la cible de 6').toEqual([]);
    const { atteints: atteint } = sequenceCumulsDeLaManche({ ...seq, cumuls: { navire: 5 } }, { navire: { success: true, sl: 1 } });
    expect(atteint).toEqual(['navire']);
  });

  it('la BORNE anti-boucle est un invariant du CONTRAT, jamais un compteur par système', () => {
    expect(SEQUENCE_MAX_ROUNDS).toBe(50);
    manches = 0;
    startSequence(banc.getState, banc.setState, { definition: 'test-boucle-infinie', chargeUtile: { n: 0 } });
    expect(activeSequence(banc.getState), 'la séquence s’est arrêtée').toBeNull();
    expect(manches).toBe(SEQUENCE_MAX_ROUNDS);
    // La borne se COMPTE en manches ouvertes par le socle ; elle se DIT en tours, parce que la
    // manche n'a pas le même prix partout (un lancer de dés autour d'une table en est une aussi).
    expect(banc.getState().journal.some((l) => l.includes('borne de 50 tours'))).toBe(true);
  });
});
