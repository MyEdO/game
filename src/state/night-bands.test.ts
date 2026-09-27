/**
 * BANDES de la NUIT (#1117 L3) — les jets de nuit ne défilent plus un par un : ils font UNE fenêtre
 * par entrée de RÈGLE et par JOUR (`state/nightBands`), une RANGÉE par héros appelé.
 *
 * Ce que ce fichier verrouille :
 *  1. la CLÉ contient le JOUR — trois jours franchis font trois fenêtres de Dessoûlage, jamais trois
 *     rangées de même id dans une seule (elles seraient INJOIGNABLES : les surfaces de rangée keyent
 *     par id nu) ; et l'INVARIANT structurel « aucune bande ne contient deux rangées de même id » ;
 *  2. une bande = N rangées (Faim de plusieurs affamés dans la MÊME fenêtre) ;
 *  3. la gueule de bois est due par TOUTE rangée du dessoûlage (LDB 09 l.485 : « Une fois tous les
 *     effets dissipés, effectuez un nouveau Test »), et forme UNE bande ;
 *  4. une bande par MALADIE (la contagion ne mélange pas deux entrées de règle) ;
 *  5. la file de fin de combat est SCINDÉE par pilote : rangées manuelles influençables, témoins
 *     résolus d'office DANS LEUR PROPRE bande (jamais `interactive:false` dans la bande jouée).
 */
import { fixtureText } from '../i18n/fixtureText';
import { describe, it, expect, beforeEach } from 'vitest';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { seedBattleRng } from './battleRng';
import { emptyScene } from './scene';
import { MINUTES_PER_DAY } from '../engine/clock';
import { nightBands, splitBandRows, EXPOSURE_BAND_KINDS } from './nightBands';
import { pushStep } from './cascade';
import { modalOwnerOf } from './modalArbiter';
import { seatOwns } from './netOwnership';
import { checkBattleOver, applyEffects } from './combatFlow';
import { addCondition } from '../engine/conditions';
import { contractDisease } from '../engine/disease';
import type { Combatant, Difficulty } from '../engine/types';
import type { CascadeStep, CascadeStepMeta } from './pendings';
import { monoStep, type BuiltCascadeStep } from './rollSeam';
import { nightStakeRef } from '../data';

const get = useGame.getState;
const set = useGame.setState;

function h(id: string, over: Partial<Combatant> = {}): Combatant {
  const c = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: id, rng: makeRNG(4) });
  c.id = id;
  Object.assign(c, over);
  return c;
}

/** Étape MONO de nuit MINTÉE : la fabrique accepte seulement des produits de la porte (#1262 V2). La
 *  ligne est posée telle quelle (`montee`) — chaque cas fixe ses propres valeurs de jet. */
function nuit(spec: {
  id: string; kind: string; hero?: string; label?: string; rollLabel?: string;
  base?: number; target?: number; difficulty?: Difficulty; menace?: string; meta?: CascadeStepMeta;
}): BuiltCascadeStep {
  const step = monoStep({
    id: spec.id, kind: spec.kind, actor: h(spec.hero ?? 'h1'), label: fixtureText(spec.label ?? ''),
    rollLabel: spec.rollLabel ?? 'Résistance', difficulty: spec.difficulty ?? 'intermediaire',
    montee: { base: spec.base ?? 40, target: spec.target ?? 40 },
    stake: nightStakeRef('faim'),
    ...(spec.menace ? { menace: spec.menace } : {}),
    ...(spec.meta ? { meta: spec.meta } : {}),
  })!;
  // Une étape restaurée d'une sauvegarde peut n'avoir AUCUN intitulé ; le mint, lui, en exige un.
  if (spec.label === undefined) delete (step as { label?: string }).label;
  return step;
}

/** Toutes les bandes d'un `kind` de la cascade ouverte. */
const bandsOf = (kind: string): CascadeStep[] =>
  (get().pendingCascade?.participants ?? []).filter((s) => s.kind === kind);

beforeEach(() => {
  seedBattleRng(1);
  set({
    battle: null, pendingCascade: null, suspendedCascades: [], deferredUpkeepQueue: [],
    pendingRest: null, pendingVictory: null, journal: [], scene: emptyScene(6, 6),
    gameTime: 0, lastUpkeepDay: 0, lastNightDay: 0,
  } as never);
});

describe('CLÉ de bande = (entrée de règle, JOUR)', () => {
  it('3 jours franchis, 1 héros ivre → TROIS bandes de Dessoûlage (une par jour), jamais une bande à 3 rangées', () => {
    set({ party: [h('h1', { drunk: { failedTests: 3, drunk: true } })] } as never);
    get().advanceTime(3 * MINUTES_PER_DAY);

    const bandes = bandsOf('dessoulage');
    expect(bandes).toHaveLength(3); // un Test par journée franchie (LDB 09 l.485), donc trois fenêtres
    expect(bandes.map((b) => b.meta?.day)).toEqual([1, 2, 3]);
    expect(bandes.every((b) => b.participants!.length === 1)).toBe(true);
  });

  /** SONDE du juge de design : aucune fenêtre ne peut contenir deux rangées de même porteur — une
   *  seconde serait INJOIGNABLE (les verbes de rangée s'adressent à `part.id`). */
  it('INVARIANT : aucune bande de nuit ne contient deux rangées de même id', () => {
    set({ party: [h('h1', { drunk: { failedTests: 2, drunk: true } }), h('h2', { drunk: { failedTests: 1, drunk: true } })] } as never);
    get().advanceTime(3 * MINUTES_PER_DAY);

    const doublons: string[] = [];
    for (const band of get().pendingCascade!.participants) {
      const ids = (band.participants ?? []).map((p) => p.id);
      if (new Set(ids).size !== ids.length) doublons.push(`${band.id} : ${ids.join(',')}`);
    }
    expect(doublons, `bande(s) à rangées injoignables :\n${doublons.join('\n')}`).toEqual([]);
  });

  it('la fabrique SÉPARE aussi deux jets de même entrée le MÊME jour chez le MÊME héros (deux fenêtres)', () => {
    const mono = (id: string, day: number) => nuit({
      id, kind: 'traumaFracture', label: 'Convalescence', base: 40, difficulty: 'accessible', target: 60, meta: { day },
    });
    const out = nightBands([mono('a', 4), mono('b', 4)]);
    expect(out).toHaveLength(2); // deux Convalescences échéant le même jour : deux fenêtres, jamais un doublon
    expect(out.every((b) => b.participants!.length === 1)).toBe(true);
  });

  /**
   * #1277 — le DISCRIMINANT d'id. Deux jets de MÊME entrée, MÊME jour, MÊME héros ET MÊME `step.id`
   * (deux Convalescences échéant ensemble sur la même fiche) font DEUX fenêtres — dont les ids
   * doivent différer : le lookup-par-id de prod (`meta.nextWaveOf`) et les coordonnées de rangée
   * (`nightRowId`) viseraient sinon la mauvaise. Le jour ne suffit pas : il faut aussi le rang.
   */
  const conv = (id: string, day?: number) => nuit({
    id, kind: 'traumaFracture', label: 'Convalescence', base: 40, difficulty: 'accessible', target: 60,
    ...(day !== undefined ? { meta: { day } } : {}),
  });

  it('deux bandes dédoublées le MÊME jour portent des ids DISTINCTS (#1277)', () => {
    const out = nightBands([conv('conv-h1', 4), conv('conv-h1', 4)]);
    expect(out).toHaveLength(2);
    expect(new Set(out.map((b) => b.id)).size, `ids de bande DUPLIQUÉS : ${out.map((b) => b.id).join(',')}`).toBe(2);
    // Le JOUR est préfixé `j` (espace de noms qui lui est propre) ; le rang ne s'ajoute qu'au doublon.
    expect(out[0].id).toBe('bande-conv-h1-j4');
    expect(out[1].id).toBe('bande-conv-h1-j4#2');
  });

  /** Les deux discriminants vivent dans des ESPACES DE NOMS SÉPARÉS : une étape SANS jour (la file de
   *  fin de combat en porte) prend le RANG nu, une étape avec jour prend `j<jour>` — un rang `2` et un
   *  jour `2` ne peuvent plus se confondre. */
  it('rang (sans jour) et jour ne partagent pas le même espace de noms (#1277)', () => {
    const out = nightBands([conv('conv'), conv('conv'), conv('conv', 2)]);
    expect(out).toHaveLength(3);
    const ids = out.map((b) => b.id);
    expect(new Set(ids).size, `ids de bande DUPLIQUÉS : ${ids.join(',')}`).toBe(3);
    expect(ids).toEqual(['bande-conv-1', 'bande-conv-2', 'bande-conv-j2']);
  });

  /** Une étape de nuit SANS intitulé ne doit pas donner une bande au libellé VIDE : `undefined` traverse
   *  la fabrique, et la fenêtre qui l'accueille prend son repli (`cascade.ts` : « Conséquences »). */
  it('une bande sans libellé ne porte pas de `label` — la fenêtre garde son repli', () => {
    const sansLabel = nuit({ id: 'faim-h1', kind: 'faim', base: 40, target: 40, meta: { day: 1 } });
    const [band] = nightBands([sansLabel]);
    expect('label' in band, 'aucun libellé vide posé à la place de l’absence').toBe(false);
    pushStep(set, band, 'test');
    expect(get().pendingCascade!.title).toBe('Conséquences');
  });

  /** Le JOUR est dans la CLÉ, pas seulement rattrapé par le filet anti-doublon : sans lui, la rangée
   *  d'un héros NON encore présent rejoindrait la fenêtre d'un AUTRE jour — un Test du jour 2 joué
   *  dans la fenêtre du jour 1, sous l'enjeu et le décompte de celle-ci. */
  it('deux JOURS, des porteurs différents : chaque fenêtre ne mêle QUE des rangées de son jour', () => {
    const mono = (id: string, hero: string, day: number) => nuit({
      id, kind: 'faim', hero, label: 'Faim', base: 40, target: 40, meta: { day },
    });
    const out = nightBands([mono('a', 'h1', 1), mono('b', 'h1', 2), mono('c', 'h2', 2)]);
    expect(out).toHaveLength(2);
    expect(out.map((b) => b.meta?.day)).toEqual([1, 2]);
    expect(out.map((b) => b.participants!.map((r) => r.id))).toEqual([['h1'], ['h1', 'h2']]);
    // Aucune fenêtre ne mêle deux jours : chaque rangée porte le jour de SA fenêtre.
    for (const band of out) expect(band.participants!.every((r) => r.meta?.day === band.meta?.day)).toBe(true);
  });
});

describe('une bande, N rangées', () => {
  it('deux affamés le même jour → UNE fenêtre « Faim » à deux rangées', () => {
    const affame = (id: string) => h(id, { hunger: { days: 1, tests: 0, failures: 0 } });
    set({ party: [affame('h1'), affame('h2')] } as never);
    get().advanceTime(MINUTES_PER_DAY);

    const faim = bandsOf('faim');
    expect(faim).toHaveLength(1);
    expect(faim[0].participants!.map((p) => p.id)).toEqual(['h1', 'h2']);
    expect(faim[0].aggregate).toBe('none'); // jets INDÉPENDANTS : chaque rangée porte SA conséquence
    expect(faim[0].participants!.every((p) => p.interactive && p.result === null)).toBe(true);
  });
});

/**
 * POSSESSION des bandes de nuit (#1268, fermé par #1262 V1 lot 5c) — la fabrique passe par le
 * constructeur du socle (`rollSeam.bandStep`). Sans possession, l'arbitre (`modalArbiter`, entrée
 * `cascade`) rendait `undefined` : la fenêtre échoyait à l'HÔTE SEUL, et le siège qui tient le
 * dormeur ne voyait jamais la rangée où se joue son jet de nuit.
 */
describe('POSSESSION d’une bande de nuit (#1268)', () => {
  const affame = (id: string) => h(id, { hunger: { days: 1, tests: 0, failures: 0 } });

  it('DEUX dormeurs → `groupOwner` (chaque siège voit la fenêtre où se tient SA rangée)', () => {
    set({ party: [affame('h1'), affame('h2')] } as never);
    get().advanceTime(MINUTES_PER_DAY);

    const faim = bandsOf('faim')[0];
    expect(faim.groupOwner, 'plus d’un porteur : la fenêtre est partagée').toBe(true);
    expect(faim.actorId, 'et n’appartient à personne en particulier').toBeUndefined();
    expect(modalOwnerOf(get())).toBe('*');
  });

  it('UN dormeur → SON `actorId`, et la fenêtre part à SON siège (plus à l’hôte)', () => {
    const solo = affame('h1');
    set({ party: [solo] } as never);
    get().advanceTime(MINUTES_PER_DAY);
    const faim = bandsOf('faim')[0];
    expect(faim.actorId, 'une bande d’un seul porteur EST son porteur').toBe('h1');
    expect(faim.groupOwner).toBeUndefined();

    // Deux sièges : le siège 1 possède le dormeur — l'hôte ne doit plus être le destinataire par défaut.
    set({ net: { ...get().net, mode: 'host', mySeat: 0, slots: [0, 1, 0, 0], ownership: { h1: 1 } } } as never);
    expect(modalOwnerOf(get())).toBe('h1');
    expect(seatOwns(get(), 1, 'h1'), 'la fenêtre est au siège qui tient le dormeur').toBe(true);
    expect(seatOwns(get(), 0, 'h1'), 'et plus à l’hôte').toBe(false);
  });

  /**
   * MURAGE (#1262 B4) : `splitBandRows` ne RECOPIE plus la bande d'origine — chaque moitié repasse par
   * le constructeur du socle (`bandStep`) depuis la déclaration relue. La possession se re-DÉRIVE donc
   * de SES rangées : une moitié à un seul porteur le NOMME (`actorId`), au lieu de garder le
   * `groupOwner` (owner `'*'`, n'importe quel siège) de la bande multi-porteurs dont elle sort.
   * L'inverse exact de la sonde-résidu du lot 5c, comme annoncé à son commentaire.
   */
  it('une moitié de `splitBandRows` à UNE rangée NOMME son porteur (possession re-dérivée)', () => {
    set({ party: [affame('h1'), affame('h2')] } as never);
    get().advanceTime(MINUTES_PER_DAY);
    const faim = bandsOf('faim')[0];
    expect(faim.groupOwner, 'la bande d’origine est bien partagée').toBe(true);

    const { kept, others } = splitBandRows(faim, (id) => id === 'h1');

    expect(kept!.participants!.map((r) => r.id)).toEqual(['h1']);
    expect(others!.participants!.map((r) => r.id)).toEqual(['h2']);
    expect(kept!.actorId, 'une bande d’un seul porteur EST son porteur').toBe('h1');
    expect(kept!.groupOwner, 'et n’est plus une fenêtre partagée').toBeUndefined();
    expect(others!.actorId).toBe('h2');
    expect(others!.groupOwner).toBeUndefined();

    // La fenêtre part au siège qui tient le dormeur, plus à l'hôte (assertion COOP, #1262 B7).
    set({ pendingCascade: { title: 'T', purpose: 'test', cursor: 0, log: [], participants: [kept!] } } as never);
    set({ net: { ...get().net, mode: 'host', mySeat: 0, slots: [0, 1, 0, 0], ownership: { h1: 1 } } } as never);
    expect(modalOwnerOf(get())).toBe('h1');
    expect(seatOwns(get(), 1, 'h1')).toBe(true);
    expect(seatOwns(get(), 0, 'h1'), 'l’hôte ne tranche pas le jet de l’invité').toBe(false);
  });
});

describe('gueule de bois (LDB 09 l.485) — due par TOUTE rangée du dessoûlage', () => {
  it('deux ivres, l’un réussit l’autre rate → UNE bande de gueule de bois à DEUX rangées', () => {
    set({ party: [h('h1', { drunk: { failedTests: 2, drunk: true } }), h('h2', { drunk: { failedTests: 4, drunk: true } })] } as never);
    get().advanceTime(MINUTES_PER_DAY);
    const desso = bandsOf('dessoulage')[0];
    expect(desso.participants).toHaveLength(2);

    const p = get().pendingCascade!;
    const rows = desso.participants!.map((r, i) => ({
      ...r, result: i === 0 ? { roll: 1, target: r.target, sl: 3, success: true } : { roll: 99, target: r.target, sl: -3, success: false },
    }));
    set({ pendingCascade: { ...p, participants: p.participants.map((s) => (s.id === desso.id ? { ...s, participants: rows } : s)) } });
    get().cascadeNext();

    const hangover = bandsOf('dessoulageHangover');
    expect(hangover, 'le 2ᵉ Test est dû « une fois tous les effets dissipés », pas aux seuls perdants').toHaveLength(1);
    expect(hangover[0].participants!.map((r) => r.id)).toEqual(['h1', 'h2']);
  });
});

describe('une bande par MALADIE', () => {
  const contagion = (id: string, hero: string, maladie: string) => nuit({
    id, kind: 'contagion', hero, label: `Contagion (${maladie})`,
    base: 40, difficulty: 'accessible', target: 60,
    menace: 'maladie', meta: { diseaseName: maladie, day: 2 },
  });

  it('deux MALADIES distinctes → DEUX fenêtres ; deux héros exposés à la MÊME → UNE fenêtre à deux rangées', () => {
    // La clé de dédoublonnage du RAW est la maladie (LDB 20 l.206, « Toux et éternuements ») — une
    // `ContagionSpec` ne porte AUCUN id de source : la bande « par source » est inconstructible.
    const deux = nightBands([contagion('c1', 'h1', 'verole-urticante'), contagion('c2', 'h1', 'courante-galopante')]);
    expect(deux).toHaveLength(2);
    expect(deux.map((band) => band.meta?.diseaseName)).toEqual(['verole-urticante', 'courante-galopante']);

    const une = nightBands([contagion('c1', 'h1', 'verole-urticante'), contagion('c2', 'h2', 'verole-urticante')]);
    expect(une).toHaveLength(1);
    expect(une[0].participants!.map((r) => r.id)).toEqual(['h1', 'h2']);
    expect(une[0].menace, 'le tag Menace de la Résistance (LDB 10) survit à la bande').toBe('maladie');
  });

  it('CHEMIN RÉEL : un compagnon contagieux ouvre UNE fenêtre de Contagion, une rangée par héros sain', () => {
    const sick = contractDisease('verole-urticante', { int: () => 1 } as never, { incubation: 0, duration: 5 })!;
    set({ party: [h('m1', { diseases: [sick] }), h('s1'), h('s2')], scene: emptyScene(6, 6) } as never);
    get().openRest({ places: { camp: true } });
    for (const id of ['m1', 's1', 's2']) get().restSet(id, { food: 'rien' });
    get().restSleep();

    const cont = bandsOf('contagion');
    expect(cont).toHaveLength(1);
    expect(cont[0].participants!.map((r) => r.id).sort()).toEqual(['s1', 's2']);
  });
});

/**
 * Le `kind` 'exposure' a TROIS producteurs (nuit de repos, effet de scène `exposureNight`, entretien
 * de mer) et UN SEUL applier — d'escalade cumulative (LDB 18 l.330/334). Si l'un d'eux restait MONO,
 * l'applier de bande RENONCERAIT sur ses étapes : jets lancés, aucune conséquence, en silence (le
 * sinistre du migrateur psy). Garde STRUCTURELLE : tout FICHIER qui construit une étape d'Exposition
 * mentionne la fabrique de vagues.
 * PORTÉE MESURÉE — le détecteur est à granularité FICHIER, pas SITE : il ne voit que les littéraux
 * `kind:` de l'INDEX des kinds d'Exposition (`EXPOSURE_BAND_KINDS`, jamais un nom recopié) et la simple
 * PRÉSENCE de `exposureWaveBand` dans le même fichier. Un SECOND site
 * d'Exposition ajouté dans un fichier déjà conforme (ex. un 2ᵉ montage dans `restFlow.ts`) passerait
 * donc MUET ici ; ce qui le rattraperait est le comportement, mesuré par les tests de bout en bout.
 */
describe('les TROIS producteurs d’Exposition passent par la MÊME fabrique de vagues', () => {
  it('aucun site ne construit d’étape d’Exposition sans `exposureWaveBand`', () => {
    const rxExposition = new RegExp(`kind: '(?:${EXPOSURE_BAND_KINDS.join('|')})'`);
    const producteurs = readCorpus(['src']).filter((f) => rxExposition.test(f.text));
    expect(producteurs.map((f) => f.rel), 'le stock de producteurs a bougé — vérifier que le nouveau passe par la fabrique')
      .toEqual(['src/state/combatEffects.ts', 'src/state/restFlow.ts', 'src/state/seaVoyageFlow.ts']);
    const sansFabrique = producteurs.filter((f) => !f.text.includes('exposureWaveBand')).map((f) => f.rel);
    expect(sansFabrique, `producteur d’Exposition hors fabrique :\n${sansFabrique.join('\n')}`).toEqual([]);
  });
});

describe('file de fin de combat — SCISSION par pilote (invariant 7)', () => {
  it('`splitBandRows` rend DEUX bandes entières, aucune rangée `interactive:false` dans la jouée', () => {
    const band: CascadeStep = {
      id: 'bande-faim', kind: 'faim', label: fixtureText('Faim'), aggregate: 'none',
      participants: [
        { id: 'manuel', interactive: true, label: 'Résistance', base: 40, target: 40, result: null },
        { id: 'temoin', interactive: true, label: 'Résistance', base: 35, target: 35, result: null },
      ],
    };
    const { kept, others } = splitBandRows(band, (id) => id === 'manuel');
    expect(kept!.participants!.map((r) => r.id)).toEqual(['manuel']);
    expect(others!.participants!.map((r) => r.id)).toEqual(['temoin']);
    expect(kept!.participants!.every((r) => r.interactive !== false)).toBe(true);
    expect(others!.participants!.every((r) => r.interactive !== false)).toBe(true);
    expect(others!.id).not.toBe(kept!.id); // deux étapes DISTINCTES, jamais le même id dans la séquence
  });

  it('fin de combat : le témoin HORS D’ACTION voit sa conséquence appliquée d’office, le manuel garde son jet', () => {
    const manuel = h('manuel', { hunger: { days: 2, tests: 0, failures: 0 } });
    const temoin = h('temoin', { hunger: { days: 2, tests: 0, failures: 0 } });
    addCondition(temoin, 'inconscient', 1); // hors d'action → jamais un jet à influencer
    const ennemi = { id: 'e', kind: 'enemy', label: 'Bandit', characteristics: { endurance: 30 } as never,
      wounds: { current: 0, max: 10 }, dead: true, conditions: [], skills: [], items: [], weapons: [], movement: 4, advantage: 0 } as unknown as Combatant;
    const queue = nightBands([
      nuit({ id: 'faim-manuel-0', kind: 'faim', hero: 'manuel', label: 'Faim', base: 40, target: 40, meta: { day: 1 } }),
      nuit({ id: 'faim-temoin-1', kind: 'faim', hero: 'temoin', label: 'Faim', base: 35, target: 35, meta: { day: 1 } }),
    ]);
    expect(queue).toHaveLength(1); // une SEULE fenêtre est mise en file (même règle, même jour)
    set({
      party: [manuel, temoin],
      battle: { combatants: [{ ...manuel }, { ...temoin }, ennemi], order: ['manuel', 'temoin', 'e'], turn: 0, round: 1, log: [], over: null } as never,
      deferredUpkeepQueue: queue, pendingCascade: null, pendingVictory: null,
    } as never);

    expect(checkBattleOver(get, set)).toBe(true);
    expect(get().deferredUpkeepQueue).toHaveLength(0); // file consommée
    const faim = (get().pendingCascade?.participants ?? []).filter((s) => s.kind === 'faim');
    expect(faim).toHaveLength(1);
    expect(faim[0].participants!.map((r) => r.id), 'seul le pilote manuel joue son jet').toEqual(['manuel']);
    // Le témoin, lui, a bien SUBI son Test (résolu d'office dans sa propre bande) — jamais un silence.
    expect(get().party.find((c) => c.id === 'temoin')!.hunger!.tests).toBe(1);
    expect(get().party.find((c) => c.id === 'manuel')!.hunger!.tests).toBe(0);
  });

  /** SONDE A — FAIL-OPEN : une étape que la fabrique REFUSE de bander (kind hors vocabulaire de nuit)
   *  ne doit pas se dissoudre dans la scission de rangées. `splitBandRows` rendrait `{}` sur elle : la
   *  file étant VIDÉE dans le même geste, l'étape — et sa conséquence — disparaîtraient en silence. */
  it('SONDE A : une étape NON bandable de la file survit (chemin d’origine), jamais dissoute par la scission', () => {
    const manuel = h('manuel');
    const ennemi = { id: 'e', kind: 'enemy', label: 'Bandit', characteristics: { endurance: 30 } as never,
      wounds: { current: 0, max: 10 }, dead: true, conditions: [], skills: [], items: [], weapons: [], movement: 4, advantage: 0 } as unknown as Combatant;
    // `combatEndDisease` n'est PAS un `NightTestKind` → `nightBands` la laisse passer INTACTE.
    const etrangere = nuit({
      id: 'combatEndDisease-manuel-x', kind: 'combatEndDisease', hero: 'manuel', label: 'Résistance',
      base: 40, target: 40, meta: { disease: 'courante-galopante' },
    });
    expect(nightBands([etrangere])[0]).toBe(etrangere); // garde du prémisse : elle traverse la fabrique telle quelle
    set({
      party: [manuel],
      battle: { combatants: [{ ...manuel }, ennemi], order: ['manuel', 'e'], turn: 0, round: 1, log: [], over: null } as never,
      deferredUpkeepQueue: [etrangere], pendingCascade: null, pendingVictory: null,
    } as never);

    expect(checkBattleOver(get, set)).toBe(true);
    const vues = (get().pendingCascade?.participants ?? []).filter((s) => s.kind === 'combatEndDisease');
    expect(vues, 'l’étape non bandable a disparu de la file ET de la cascade').toHaveLength(1);
    expect(vues[0].id).toBe('combatEndDisease-manuel-x');
  });
});

/**
 * SONDE B — les ids de BANDE doivent rester uniques dans une séquence : deux insertions issues du
 * MÊME `step.id` (la gueule de bois `dessoulageHangover-<héros>` de deux Dessoûlages) proviennent de
 * DEUX appels distincts à la fabrique, qui ne peut donc pas les dédoublonner entre elles — c'est le
 * DISCRIMINANT de clé porté par l'id (le jour, sinon le rang) qui les sépare.
 */
describe('SONDE B — ids de bande UNIQUES dans la séquence', () => {
  it('deux jours de Dessoûlage → deux bandes de gueule de bois aux ids DISTINCTS', () => {
    set({ party: [h('h1', { drunk: { failedTests: 3, drunk: true } })] } as never);
    get().advanceTime(2 * MINUTES_PER_DAY);
    expect(bandsOf('dessoulage')).toHaveLength(2);

    // Déroule TOUTE la séquence (chaque Dessoûlage INSÈRE sa gueule de bois derrière lui) en relevant
    // les fenêtres traversées : les insertions viennent de DEUX appels distincts à la fabrique.
    const vus: { kind: string; id: string }[] = [];
    let guard = 0;
    while (get().pendingCascade && guard++ < 30) {
      const p = get().pendingCascade!;
      const cur = p.participants[p.cursor];
      vus.push({ kind: cur.kind, id: String(cur.id) });
      const rows = cur.participants!.map((r) => ({ ...r, result: { roll: 50, target: r.target, sl: 0, success: true } }));
      set({ pendingCascade: { ...p, participants: p.participants.map((s, k) => (k === p.cursor ? { ...s, participants: rows } : s)) } });
      get().cascadeNext();
    }

    const hangovers = vus.filter((v) => v.kind === 'dessoulageHangover');
    expect(hangovers, 'chaque Dessoûlage doit sa gueule de bois (LDB 09 l.485)').toHaveLength(2);
    const ids = vus.map((v) => v.id);
    const doublons = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(doublons, `ids de bande DUPLIQUÉS dans la séquence : ${doublons.join(',')}`).toEqual([]);
  });
});

/**
 * SONDE D — Exposition BOUT EN BOUT sur le store (le cycle que ni l'unité ni le chemin de repos ne
 * jouent en entier) : bande de vague 0 à DEUX rangées → une seule offre un délestage (LDB 18 l.332,
 * seul h1 porte une Possession lourde) → « jeter » ANNULE l'échec de h1 et déclenche la construction
 * de la vague 1 → l'escalade y vaut 0 pour h1 (annulé) et 1 pour h2.
 */
describe('SONDE D — Exposition (chaleur) de bout en bout : drop → cancelsRowId → vague N+1', () => {
  it('la vague 1 porte priorFails { h1: 0, h2: 1 } — l’échec annulé ne compte que pour son porteur', () => {
    const heavy = { uid: 'sac', trappingId: 'grand-sac', label: 'Grand sac à dos', kind: 'misc', qualities: [], equipped: true, enc: 3 } as never;
    const h1 = h('h1'); h1.items = [heavy];
    const h2 = h('h2'); h2.items = [];
    set({ party: [h1, h2], pendingCascade: null, journal: [] } as never);
    applyEffects(get, set, [{ type: 'exposureNight', kind: 'chaleur', count: 2, target: 'party' }]);

    const wave0 = get().pendingCascade!.participants[0];
    expect(wave0.participants!.map((r) => r.id)).toEqual(['h1', 'h2']);
    expect(wave0.meta?.waves).toBe(2);
    // Les DEUX ratent leur Test.
    const p = get().pendingCascade!;
    const rows = wave0.participants!.map((r) => ({ ...r, result: { roll: 99, target: r.target, sl: -5, success: false } }));
    set({ pendingCascade: { ...p, participants: p.participants.map((s, k) => (k === p.cursor ? { ...s, participants: rows } : s)) } });
    get().cascadeNext();

    // UN SEUL délestage inséré (h2 n'a rien de lourd à jeter — sa conséquence est immédiate).
    const cur = () => { const c = get().pendingCascade!; return c.participants[c.cursor]; };
    expect(cur().kind).toBe('exposure-heat-drop');
    expect(cur().actorId).toBe('h1');
    expect(cur().meta?.cancelsRowId).toBe(`${wave0.id}:h1`);
    get().cascadeChoose(cur().id, 'jeter');
    get().cascadeNext();

    const wave1 = cur();
    expect(wave1.kind).toBe('exposure');
    expect(wave1.meta?.wave).toBe(1);
    expect(Object.fromEntries(wave1.participants!.map((r) => [r.id, r.meta?.priorFails])))
      .toEqual({ h1: 0, h2: 1 }); // h1 : échec ANNULÉ par le délestage ; h2 : échec bien compté
    expect(get().party.find((c) => c.id === 'h1')!.items).toHaveLength(0); // la Possession a bien été jetée
  });
});
