/**
 * Cadre de campagne (#717) — l'ARCHIVE et la DÉRIVATION, headless.
 *
 * Rien n'est écrit au fil du jeu : le récap se déduit d'une BORNE (`chapitreDepuis`, posée à
 * l'acquittement de l'ouverture) et des objectifs SOLDÉS (poussés par l'Effet `clearObjective` au
 * lieu d'être perdus). L'armement passe par la couture UNIQUE de fin d'application d'effets.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { applyEffects } from './combatEffects';
import { deriveChapterRecap, snapshotChapitre } from './chapitreRecap';
import { snapshotSave } from './saves';
import { diligenceCampaign, paquetDuJeu } from '../scenes/campaign';
import { testScene } from '../scenes/test-fixture';
import type { Combatant } from '../engine/types';
import { emptyNarratif, type NarratifBlock } from './campaignNarratif';

function hero(id: string, xp: number, over: Partial<Combatant> = {}): Combatant {
  return {
    id, label: id.toUpperCase(), kind: 'hero', xp,
    characteristics: {} as Combatant['characteristics'],
    items: [], talents: [], skills: [], conditions: [], advantage: 0, wounds: { current: 10, max: 10 },
    ...over,
  } as unknown as Combatant;
}

const CLOTURE = { when: { kind: 'flag' as const, expr: 'chapitre-clos' }, titre: 'Chapitre 1 — accompli' };
const narratifClos: NarratifBlock = { ...emptyNarratif(), cloture: CLOTURE };

const get = () => useGame.getState();
const set = useGame.setState;

beforeEach(() => {
  useGame.getState().startScene(testScene());
  useGame.setState({ party: [], campaignNarratif: null });
});

describe('clearObjective — l’objectif soldé est ARCHIVÉ, jamais perdu (#717)', () => {
  it('solder un objectif le pousse dans `objectifsSoldes` (et le re-solder ne le double pas)', () => {
    applyEffects(get, set, [{ type: 'setObjective', id: 'obj-1', desc: 'Atteindre Altdorf' }]);
    expect(get().objectives.map((o) => o.id)).toEqual(['obj-1']);
    applyEffects(get, set, [{ type: 'clearObjective', id: 'obj-1' }]);
    expect(get().objectives).toEqual([]);
    expect(get().objectifsSoldes.map((o) => o.text)).toEqual(['Atteindre Altdorf']);
    applyEffects(get, set, [{ type: 'setObjective', id: 'obj-1', desc: 'Atteindre Altdorf' }]);
    applyEffects(get, set, [{ type: 'clearObjective', id: 'obj-1' }]);
    expect(get().objectifsSoldes).toHaveLength(1);
  });

  it('un `clearObjective` SANS id (purge) archive tout ce qui était en cours', () => {
    applyEffects(get, set, [
      { type: 'setObjective', id: 'a', desc: 'A' },
      { type: 'setObjective', id: 'b', desc: 'B' },
      { type: 'clearObjective' },
    ]);
    expect(get().objectives).toEqual([]);
    expect(get().objectifsSoldes.map((o) => o.id)).toEqual(['a', 'b']);
  });
});

describe('deriveChapterRecap — le récap est une DIFFÉRENCE, pas un journal (#717)', () => {
  it('compte les PX DU CHAPITRE (xp courant − xp à la borne)', () => {
    const depuis = snapshotChapitre([hero('h1', 100), hero('h2', 40)], 0);
    const r = deriveChapterRecap({
      cloture: CLOTURE, depuis, objectifsSoldes: [], party: [hero('h1', 220), hero('h2', 60)], lieux: [],
    });
    expect(r.px).toBe(140);
    expect(r.titre).toBe('Chapitre 1 — accompli');
  });

  it('un mort AVANT la borne n’est pas « tombé en chemin » ; un mort APRÈS l’est', () => {
    const depuis = snapshotChapitre([hero('vif', 0), hero('deja', 0, { dead: true })], 0);
    const r = deriveChapterRecap({
      cloture: CLOTURE, depuis, objectifsSoldes: [],
      party: [hero('vif', 0, { dead: true }), hero('deja', 0, { dead: true })], lieux: [],
    });
    expect(r.tombes.map((t) => t.id)).toEqual(['vif']);
  });

  it('la chronique reprend les objectifs soldés et les tombés, en `RecapLine` (vocabulaire partagé)', () => {
    const depuis = snapshotChapitre([hero('h1', 0)], 0);
    const r = deriveChapterRecap({
      cloture: CLOTURE, depuis,
      objectifsSoldes: [{ id: 'o', text: 'Atteindre Altdorf' }],
      party: [hero('h1', 0)], lieux: ['Altdorf'],
    });
    expect(r.chronique.map((l) => l.text)).toEqual(['Atteindre Altdorf']);
    expect(r.chronique[0].tone).toBe('ok');
    expect(r.lieux).toEqual(['Altdorf']);
  });
});

describe('armement du récap — la CLÔTURE est une Condition relue après chaque lot d’effets (#717)', () => {
  it('faux → vrai arme le récap UNE fois ; un paquet SANS clôture ne l’arme jamais', () => {
    useGame.setState({ party: [hero('h1', 10)], campaignNarratif: narratifClos });
    applyEffects(get, set, [{ type: 'setFlag', flag: 'autre-chose', value: true }]);
    expect(get().pendingChapterRecap).toBeNull();
    applyEffects(get, set, [{ type: 'setFlag', flag: 'chapitre-clos', value: true }]);
    const arme = get().pendingChapterRecap;
    expect(arme?.titre).toBe('Chapitre 1 — accompli');
    applyEffects(get, set, [{ type: 'setFlag', flag: 'encore', value: true }]);
    expect(get().pendingChapterRecap).toBe(arme); // idempotent : pas de re-dérivation

    useGame.setState({ pendingChapterRecap: null, campaignNarratif: { ...narratifClos, cloture: undefined } });
    applyEffects(get, set, [{ type: 'setFlag', flag: 'peu-importe', value: true }]);
    expect(get().pendingChapterRecap).toBeNull();
  });

  it('le récap n’ouvre pas par-dessus l’ouverture non acquittée', () => {
    useGame.setState({
      party: [hero('h1', 10)], campaignNarratif: narratifClos,
      pendingOuverture: { titre: 'T', pitch: 'P' },
    });
    applyEffects(get, set, [{ type: 'setFlag', flag: 'chapitre-clos', value: true }]);
    expect(get().pendingChapterRecap).toBeNull();
  });
});

describe('cycle de vie de la borne (#717)', () => {
  it('`loadProject` pose l’ouverture APRÈS `startScene` ; `startScene` seul efface le cadre', () => {
    const { scenes, worldMap, narratif } = paquetDuJeu(diligenceCampaign);
    useGame.getState().loadProject(scenes, scenes[0].id, worldMap, narratif);
    expect(get().pendingOuverture?.titre).toBe(narratif.ouverture!.titre);

    useGame.getState().acquitterOuverture();
    expect(get().pendingOuverture).toBeNull();
    expect(get().chapitreDepuis).not.toBeNull();

    useGame.getState().startScene(testScene());
    expect(get().pendingOuverture).toBeNull();
    expect(get().chapitreDepuis).toBeNull();
  });

  it('save/load : la borne et l’archive entrent au snapshot (sinon le récap mentirait)', () => {
    useGame.setState({
      party: [hero('h1', 50)],
      objectifsSoldes: [{ id: 'o', text: 'Atteindre Altdorf' }],
      chapitreDepuis: snapshotChapitre([hero('h1', 10)], 0),
    });
    const save = snapshotSave(get() as unknown as Record<string, unknown>, useGame.getInitialState() as unknown as Record<string, unknown>, '2026-08-31T00:00:00.000Z');
    expect(save.data.objectifsSoldes).toEqual([{ id: 'o', text: 'Atteindre Altdorf' }]);
    expect(save.data.chapitreDepuis).toEqual({ xpParHeros: { h1: 10 }, vivants: ['h1'], gameTime: 0 });
    expect(save.data.clotureConsommee).toBe(false);
  });
});

describe('la clôture se CONSOMME : « Terminer la séance » ferme le chapitre pour de bon (#717)', () => {
  it('après `cloreChapitre`, aucun lot d’effets ultérieur ne ré-arme le récap', () => {
    useGame.setState({ party: [hero('h1', 10)], campaignNarratif: narratifClos });
    applyEffects(get, set, [{ type: 'setObjective', id: 'obj-1', desc: 'Atteindre Altdorf' }]);
    applyEffects(get, set, [{ type: 'clearObjective', id: 'obj-1' }]);
    applyEffects(get, set, [{ type: 'setFlag', flag: 'chapitre-clos', value: true }]);
    expect(get().pendingChapterRecap?.chronique).toEqual([
      { text: 'Atteindre Altdorf', icon: 'map-tool/start-flag', tone: 'ok' },
    ]);

    useGame.getState().cloreChapitre();
    expect(get().clotureConsommee).toBe(true);

    // La Condition de clôture est TOUJOURS vraie (un drapeau ne se retire pas) : c'est le fait de
    // clôture qui tient, lot après lot — sinon le récap se rouvrirait VIDE, indéfiniment.
    applyEffects(get, set, [{ type: 'setFlag', flag: 'autre-chose', value: true }]);
    expect(get().pendingChapterRecap).toBeNull();
    applyEffects(get, set, [{ type: 'setFlag', flag: 'chapitre-clos', value: true }]);
    expect(get().pendingChapterRecap).toBeNull();
    expect(get().flags['chapitre-clos']).toBe(true);
  });

  it('une partie NEUVE rouvre la clôture (le fait meurt avec l’état, il ne se traîne pas)', () => {
    useGame.setState({ party: [hero('h1', 10)], campaignNarratif: narratifClos });
    applyEffects(get, set, [{ type: 'setFlag', flag: 'chapitre-clos', value: true }]);
    useGame.getState().cloreChapitre();
    expect(get().clotureConsommee).toBe(true);

    useGame.getState().startScene(testScene());
    expect(get().clotureConsommee).toBe(false);
  });
});

describe('cadre de campagne en COOP — l’invité VOIT, l’hôte TOURNE LA PAGE (#717)', () => {
  const guest = () => useGame.setState({ net: { ...get().net, mode: 'guest', mySeat: 1 } });

  it('chez l’invité, les trois gestes du cadre sont INERTES (aucune mutation locale)', () => {
    useGame.setState({
      party: [hero('h1', 10)],
      pendingOuverture: { titre: 'T', pitch: 'P' },
      pendingChapterRecap: { titre: 'C', px: 0, chronique: [], tombes: [], lieux: [] },
      objectifsSoldes: [{ id: 'o', text: 'Atteindre Altdorf' }],
    });
    guest();

    useGame.getState().acquitterOuverture();
    expect(get().pendingOuverture?.titre).toBe('T');
    expect(get().chapitreDepuis).toBeNull();

    useGame.getState().ajournerChapterRecap();
    expect(get().pendingChapterRecap?.titre).toBe('C');

    useGame.getState().cloreChapitre();
    expect(get().pendingChapterRecap?.titre).toBe('C');
    expect(get().objectifsSoldes).toEqual([{ id: 'o', text: 'Atteindre Altdorf' }]);
    expect(get().clotureConsommee).toBe(false);
  });

  it('en solo, les mêmes gestes mutent (la garde ne vise QUE l’invité)', () => {
    useGame.setState({
      party: [hero('h1', 10)],
      pendingOuverture: { titre: 'T', pitch: 'P' },
    });
    useGame.getState().acquitterOuverture();
    expect(get().pendingOuverture).toBeNull();
    expect(get().chapitreDepuis).not.toBeNull();
  });
});
