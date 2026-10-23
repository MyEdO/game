/**
 * #1479 — IL N'Y A PAS DE « CLASSE SPÉCIALE » DE JET. Utilisateur, 2026-08-24 (verbatim) : « On a pas
 * 36 types de jets différents dans l'application que je sache. A partir du moment ou je dois faire un
 * jet, il doit apparaitre. Y'a pas de "classe spéciale" si je suis a l'initiative, que je le subit,
 * face a un adversaire ou face a ... une maladie ».
 *
 * La surface d'un jet se DÉRIVE donc de trois choses, et de rien d'autre :
 *  1. la cadence déférée à un automate (`cadenceAuto`) — pour la porte d'un JET (`surfaceDeLEtape`) ;
 *  2. la politique d'ORDRES d'une traversée (`resoluSousOrdres`) — « Traversée commandée sans fenêtre » ;
 *  3. la TENUE des porteurs (`sieges.tenuParUnHumain`), le prédicat de #1426.
 *
 * Ce fichier PROMEUT en contrat les sondes du juge du lot : la matrice des Tests de mer, le mono
 * qu'aucun humain ne tient (qui bloquait la cascade), et la bande que personne ne tient.
 */
import { tableTotale } from '../lib/tableTotale';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame } from './store';
import { makePregens } from '../data/pregens';
import { buildBand, bandStep, monoStep, surfaceDesEtapes, surfaceDeLEtape } from '../noyau/rollSeam';
import { type BuiltCascadeStep } from '../noyau/stepBrand';
import { startCascade } from '../noyau/cascade';
import { draineCascade } from './cascade.testkit';
import { setCadence, resetCadence } from '../engine/cadence';
import { fixtureText } from '../i18n/fixtureText';
import { voyageStakeRef } from '../data';
import { KINDS_SOUS_ORDRES } from '../noyau/voyageCadence';
import type { Combatant } from '../engine/types';
import { ECHEC_SANS_JET } from '../engine/tests';
import { refusNePeutTenter } from '../engine/skills';
import { seedBattleRng, battleRng } from '../noyau/battleRng';
import { makeRNG } from '../engine/dice';
import { avecLesTables, cleDeFixture } from '../noyau/noyau.testkit';
import { tablesDuJeu } from '../noyau/tablesDuJeu';
import type { GenreDeCascade } from '../noyau/tablesPosees';
import { idNeufDeBanc } from '../lib/entityId.testkit';

const get = useGame.getState.bind(useGame);
const set = useGame.setState.bind(useGame);
const NET0 = get().net;

/** Les `kind` que couvrent les ORDRES d'une traversée, lus à leur source. */
const SOUS_ORDRES = [...KINDS_SOUS_ORDRES];

/** Les `kind` de l'entretien-survie maritime, tels que les émettent les trois phases du jour. */
const KINDS_DE_MER = ['sea-tonneau-expose', 'sea-tonneau-contamine', 'sea-mal-de-mer', 'sea-scorbut', 'sea-exposition', 'sea-epuisement'] as const;

const ligne = { test: { skill: 'resistance', char: 'endurance' } } as const;

function bandeDe(kind: GenreDeCascade, porteurs: Combatant[]): BuiltCascadeStep {
  return buildBand(get, { id: kind, kind, label: fixtureText(kind), difficulty: 'intermediaire', porteurs: porteurs.map((actor) => ({ actor, ligne })) })!;
}

function traversee(cadence: 'commande' | 'jour-par-jour', mode: 'sea' | 'river' = 'sea'): void {
  set({ travelPlan: { routeId: 'r', fromPlaceId: 'a', toPlaceId: 'b', mode, hoursPerDay: 8, km: 10, kmDone: 0, interrupted: false, orders: { cadence } } as never });
}

beforeEach(() => {
  resetCadence();
  set({ battle: null, party: makePregens(idNeufDeBanc).slice(0, 3), pendingCascade: null, suspendedCascades: [], travelPlan: null, journal: [] } as never);
  set({ net: { ...NET0, mode: 'local', mySeat: 0, gmSeat: undefined, ownership: {} } } as never);
});
afterEach(() => {
  resetCadence();
  set({ net: NET0, pendingCascade: null, suspendedCascades: [], travelPlan: null } as never);
});

describe('#1479 — MATRICE des Tests de mer : ordres × siège, pour CHAQUE kind', () => {
  it('solo jour-par-jour : la fenêtre s’ouvre (M) pour tous les kinds — un jet subi n’est plus muet', () => {
    traversee('jour-par-jour');
    const mesure = KINDS_DE_MER.map((k) => [k, surfaceDesEtapes(get, [bandeDe(k, get().party)])] as const);
    expect(Object.fromEntries(mesure)).toEqual(tableTotale(KINDS_DE_MER, () => 'M'));
  });

  it('traversée COMMANDÉE : aucun de ces kinds n’ouvre de fenêtre (I) — l’ordre a été donné au départ', () => {
    traversee('commande');
    const mesure = KINDS_DE_MER.map((k) => [k, surfaceDesEtapes(get, [bandeDe(k, get().party)])] as const);
    expect(Object.fromEntries(mesure)).toEqual(tableTotale(KINDS_DE_MER, () => 'I'));
  });

  /**
   * COOP × COMMANDÉE : la résolution sans fenêtre est hôte-seule (`docs/architecture.md`, « Coop en ligne —
   * limitations connues ») ; la porte lit la MÊME source que les gardes du jour (`traverseeCommandee`).
   * Le héros d'un invité garde sa fenêtre sous des ordres commandés, sur chaque route.
   */
  it('COOP × COMMANDÉE : le héros d’un invité garde sa fenêtre (M) pour chaque kind sous ordres, mer comme fleuve', () => {
    const invite = get().party[0];
    set({ net: { ...get().net, mode: 'host', mySeat: 0, slots: [0, 1, 0, 0], ownership: { [invite.id]: 1 } } } as never);
    for (const mode of ['sea', 'river'] as const) {
      traversee('commande', mode);
      const mesure = SOUS_ORDRES.map((k) => [k, surfaceDesEtapes(get, [bandeDe(k, [invite])])] as const);
      expect(Object.fromEntries(mesure), mode).toEqual(tableTotale(SOUS_ORDRES, () => 'M'));
    }
  });

  it('LOCAL × COMMANDÉE, CONTRÔLE POSITIF : les mêmes kinds se résolvent d’office (I), mer comme fleuve', () => {
    for (const mode of ['sea', 'river'] as const) {
      traversee('commande', mode);
      const mesure = SOUS_ORDRES.map((k) => [k, surfaceDesEtapes(get, [bandeDe(k, get().party)])] as const);
      expect(Object.fromEntries(mesure), mode).toEqual(tableTotale(SOUS_ORDRES, () => 'I'));
    }
  });

  /**
   * L'EXPOSITION DE NUIT/SCÈNE N'EST PAS SOUS LES ORDRES D'UNE TRAVERSÉE (#1479) — même RÈGLE
   * (LDB 18 l.326-334, même applier), autre ROUTE : « cap tenu, ne me réveillez pas » ne commande
   * que l'entretien du BORD (`sea-exposition`). Un ordre de traversée qui éteindrait aussi
   * l'Exposition d'un camp ou d'un effet de scène volerait au joueur un jet qu'il doit faire
   * (« A partir du moment ou je dois faire un jet, il doit apparaitre », utilisateur 2026-08-24) —
   * et il le volerait sur un plan FLUVIAL comme sur un plan de MER, la politique ne lisant que la
   * cadence.
   */
  it('l’Exposition de NUIT/SCÈNE (`exposure`) GARDE sa fenêtre sous ordres commandés — fleuve comme mer', () => {
    for (const mode of ['river', 'sea'] as const) {
      traversee('commande', mode);
      expect(surfaceDesEtapes(get, [bandeDe('exposure', get().party)]), `« exposure » sous ordres commandés (${mode})`).toBe('M');
      // CONTRÔLE POSITIF, même montage : la route de MER, elle, EST commandée.
      expect(surfaceDesEtapes(get, [bandeDe('sea-exposition', get().party)]), `« sea-exposition » sous ordres commandés (${mode})`).toBe('I');
    }
  });

  it('CONTRÔLE POSITIF — un kind HORS de la politique d’ordres garde sa fenêtre, traversée commandée ou non', () => {
    traversee('commande');
    expect(surfaceDesEtapes(get, [bandeDe('tourbillon', get().party)]), 'une CRISE interrompt toujours').toBe('M');
    // Et la politique DISCRIMINE bien : un kind de routine d'équipage se tait sous les mêmes ordres.
    expect(surfaceDesEtapes(get, [bandeDe('progression', get().party)])).toBe('I');
  });

  it('siège MJ : la bande reste au JOUEUR (M) — le MJ ne prend que les dés qu’il TIENT (V pour le monde)', () => {
    traversee('jour-par-jour');
    set({ net: { ...get().net, mode: 'host', mySeat: 0, gmSeat: 1 } } as never);
    for (const k of KINDS_DE_MER) {
      expect(surfaceDesEtapes(get, [bandeDe(k, get().party)]), `« ${k} » : le porteur est un héros, son joueur le tient`).toBe('M');
    }
    const deMonde = monoStep({
      id: 'x', kind: cleDeFixture('x'), monde: true, label: fixtureText('Désertion'), difficulty: 'intermediaire',
      ligne: { valeur: 40 }, stake: voyageStakeRef('sea-salissures'),
    })!;
    expect(surfaceDesEtapes(get, [deMonde]), 'le dé du MONDE, lui, revient au siège qui le tient').toBe('V');
  });

  it('cadence DÉFÉRÉE : la porte d’un JET rend I ; la fenêtre d’une SÉQUENCE, elle, reste (le pilote la déroule)', () => {
    traversee('jour-par-jour');
    setCadence('rapide');
    const h = get().party[0];
    const jet = monoStep({ id: 'sea-scorbut', kind: 'sea-scorbut', label: fixtureText('Scorbut'), actor: h, difficulty: 'intermediaire', ligne: { valeur: 40 }, stake: voyageStakeRef('sea-scorbut') })!;
    expect(surfaceDeLEtape(get, jet), 'un dé isolé se résout inline en cadence déférée').toBe('I');
    expect(surfaceDesEtapes(get, [bandeDe('sea-scorbut', get().party)]), 'la bande garde son bilan — `combatAuto` la déroule').toBe('M');
  });
});

beforeEach(() => { avecLesTables({ appliers: { ...tablesDuJeu().appliers, 'sonde-1479': () => ({ consequences: [] }) } }); });

describe('#1479 — le mono qu’AUCUN humain ne tient ne bloque plus la cascade', () => {
  const jet = (actor: Combatant, id: string): BuiltCascadeStep => monoStep({
    id, kind: cleDeFixture('sonde-1479'), actor, label: fixtureText(id), difficulty: 'intermediaire', ligne,
    stake: voyageStakeRef('sea-epuisement', { condition: 'Exténué' }),
  })!;

  it('héros conduit par l’IA : le socle TIRE son étape et la séquence la FRANCHIT (jamais un `cascadeNext` en no-op)', () => {
    const party = get().party.map((h, i) => (i === 0 ? { ...h, aiControlled: true } : h));
    set({ party } as never);
    startCascade(get, set, { title: 'Sonde', purpose: 'test', steps: [jet(party[0], 'ia'), jet(party[1], 'joueur')] });
    const casc = get().pendingCascade!;
    expect(casc.participants[0].result, 'personne ne la tient : le dé tombe à la pose du curseur').toBeTruthy();
    expect(casc.cursor, 'et la fenêtre s’ouvre bien SUR elle — c’est « Suivant » qui la franchit').toBe(0);
    get().cascadeNext();
    const apres = get().pendingCascade!;
    expect(apres.cursor, 'le curseur a franchi l’étape non tenue et s’est posé sur celle du joueur').toBe(1);
    expect(apres.participants[1].result, 'que son joueur tient : elle attend SON dé').toBeNull();
    draineCascade(get);
    expect(get().pendingCascade, 'la séquence se dénoue').toBeNull();
  });

  it('un porteur INCONNU (aucun combattant) ne bloque pas davantage : son étape se résout d’office', () => {
    const fantome = { ...get().party[0], id: 'FANTOME' } as Combatant;
    startCascade(get, set, { title: 'Sonde', purpose: 'test', steps: [jet(fantome, 'inconnu')] });
    expect(get().pendingCascade!.participants[0].result).toBeTruthy();
    draineCascade(get);
    expect(get().pendingCascade).toBeNull();
  });

  it('siège DISTANT : le héros d’un invité TIENT sa rangée chez l’hôte (elle ne se tire pas en silence)', () => {
    const invite = get().party[0];
    set({ net: { ...get().net, mode: 'host', mySeat: 0, slots: [0, 1, 0, 0], ownership: { [invite.id]: 1 } } } as never);
    const bande = bandeDe('sea-scorbut', [invite]);
    expect(bande.participants![0].interactive, 'c’est SON joueur qui la roulera').toBe(true);
    expect(bande.participants![0].result).toBeNull();
    expect(surfaceDesEtapes(get, [bande])).toBe('M');
  });
});

describe('mono non tentable = cas N=0 de la bande (LDB 09 l.30 ; #2588 Q1)', () => {
  it('`monoStep` à ligne refusée naît ÉCHEC SANS JET avec son refus, et la séquence n’y tire aucun dé', () => {
    const h = get().party[0];
    const refus = refusNePeutTenter(h, { skill: 'resistance' });
    const step = monoStep({
      id: 'muet', kind: cleDeFixture('sonde-1479'), actor: h, label: fixtureText('muet'), difficulty: 'intermediaire', ligne: { ...ligne, refus },
      stake: voyageStakeRef('sea-epuisement', { condition: 'Exténué' }),
    })!;
    expect(step.result).toEqual(ECHEC_SANS_JET);
    expect(step.refus).toBe(refus);
    seedBattleRng(9);
    startCascade(get, set, { title: 'Sonde', purpose: 'test', steps: [step] });
    get().cascadeRoll('muet');
    expect(get().pendingCascade!.participants[0].result).toEqual(ECHEC_SANS_JET);
    expect(battleRng().int(1, 1_000_000)).toBe(makeRNG(9).int(1, 1_000_000));
  });
});

describe('#1479 — une bande que PERSONNE ne tient se résout d’office (jamais une fenêtre)', () => {
  it('tous les porteurs conduits par l’IA → I', () => {
    const party = get().party.map((h) => ({ ...h, aiControlled: true }));
    set({ party } as never);
    expect(surfaceDesEtapes(get, [bandeDe('sea-scorbut', party as Combatant[])])).toBe('I');
  });

  it('rangée d’id FANTÔME (aucun combattant derrière) → I : un id inconnu n’est tenu par personne', () => {
    const bande = bandStep({ id: 'fantome', kind: 'sea-scorbut', label: fixtureText('Fantôme') }, [
      { id: 'FANTOME-1', interactive: true, result: null, base: 30, target: 30, difficulty: 'intermediaire' },
      { id: 'FANTOME-2', interactive: true, result: null, base: 30, target: 30, difficulty: 'intermediaire' },
    ])!;
    expect(bande.groupOwner, 'deux porteurs : la bande se déclare de GROUPE').toBe(true);
    expect(surfaceDesEtapes(get, [bande])).toBe('I');
  });

  it('CONTRÔLE POSITIF — la MÊME bande avec un porteur RÉEL s’ouvre (la sonde discrimine)', () => {
    expect(surfaceDesEtapes(get, [bandeDe('sea-scorbut', [get().party[0]])])).toBe('M');
  });
});
