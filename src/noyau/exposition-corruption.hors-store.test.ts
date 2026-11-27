/**
 * L'EXPOSITION à une Influence corruptrice en combat (#4202) : Test de Résistance ou de Calme (LDB 19 l.29),
 * Points selon le niveau et le DR (LDB 19 l.35 ; LDB 19 l.48 ; LDB 19 l.58). Les crochets de Corruption
 * (`corruptionFlow.crochetsDeCorruption`) sont installés aux portes qui tiennent l'état ; ce banc les joue
 * par le dispatch réel des armes du catalogue (`emitCombatEvent`, le MÊME appel que `combatFlow`), par la
 * porte d'une feuille (`applyLeafOps`) et par la reprise d'un contexte porté (`ctxRepris`).
 * Armes : ZI 13 l.205 (pistolet à malepierre) ; ZI 13 l.197 (canon ratling) ; ZI 13 l.201 (lance-maleflamme) ;
 * MDG 16 l.515 (Atout Malepierre).
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { emitCombatEvent } from './combatEvents';
import { createHero } from '../engine/character';
import { battleRng } from './battleRng';
import { testScene } from '../scenes/test-fixture';
import { itemFromTrappingById, weaponFromItem } from '../engine/items';
import { DIFFICULTY_LABELS, type Combatant, type Weapon } from '../engine/types';
import { hasCondition } from '../engine/conditions';
import { applyLeafOps, ctxRepris, porterOpsCtx } from './combatEffects';
import { applyOps } from '../engine/ops';
import { corruptionGain } from '../engine/corruption';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); banc.getState().ensemencerLeTirage(7); });

const get = () => banc.getState();
const arme = (id: string): Weapon => weaponFromItem(itemFromTrappingById(id, idsDeTest)!);
const combattant = (id: string): Combatant => get().battle!.combatants.find((c) => c.id === id)!;
const EXPOSITION = { op: 'corruptionExposure', level: 'mineure', nature: 'physique' } as const;

/** Un héros du groupe et un ennemi en combat. */
function setup(): { H: Combatant; E: Combatant } {
  const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
  banc.setState({ party: [hero] });
  get().lancerLaScene(testScene());
  get().lancerLeCombat('enc-mutants');
  get().fenetreValider('debutDuRound');
  banc.abandonner();
  const b = get().battle!;
  return { H: b.combatants.find((c) => c.kind === 'heros')!, E: b.combatants.find((c) => c.kind === 'ennemi')! };
}

/** La touche (ou le Critique) telle que `combatFlow` l'émet : porteur, victime, arme, Blessures infligées. */
function frapper(evenement: 'onHit' | 'onCrit', attaquant: Combatant, victime: Combatant, weapon: Weapon, woundsDealt = 3): void {
  emitCombatEvent(evenement, {
    get, set: banc.setState, battle: get().battle!, self: attaquant, sink: (l) => get().ecrireAuJournal(l),
    triggerCtx: { victim: victime, weapon, location: 'corps', woundsDealt, attackType: weapon.type, rng: battleRng() },
  });
}

const PENDING_MINEURE = { level: 'mineure', nature: 'physique', natureFixee: true, menace: 'corruption' } as const;

describe('Exposition à la Corruption en combat — LDB 19 l.29', () => {
  it('héros tenu par un humain, blessé par un pistolet à malepierre : la modale de Corruption s’ouvre chez lui, le gain suit la table', () => {
    const { H, E } = setup();
    frapper('onHit', E, H, arme('pistolet-a-malepierre'));
    const pc = get().pendingCorruption;
    expect(pc).toMatchObject({ heroId: H.id, ...PENDING_MINEURE });
    banc.setState({ pendingCorruption: { ...pc!, roll: 99, target: 30, success: false, sl: -6 } });
    get().jetValider('corruption');
    expect(combattant(H.id).corruption ?? 0).toBe(corruptionGain('mineure', false, -6));
  });

  it('une touche sans Blessure n’expose personne', () => {
    const { H, E } = setup();
    frapper('onHit', E, H, arme('pistolet-a-malepierre'), 0);
    expect(get().pendingCorruption).toBeNull();
  });

  it('le Critique d’une arme à l’Atout Malepierre prend le même chemin (MDG 16 l.515)', () => {
    const { H, E } = setup();
    frapper('onCrit', E, H, arme('encensoir-de-la-peste'));
    expect(get().pendingCorruption).toMatchObject({ heroId: H.id, ...PENDING_MINEURE });
  });

  it('slot occupé : l’exposition prend son rang dans la file (#1282)', () => {
    const { H, E } = setup();
    frapper('onHit', E, H, arme('pistolet-a-malepierre'));
    frapper('onHit', E, H, arme('pistolet-a-malepierre'));
    expect(get().corruptionQueue).toEqual([expect.objectContaining({ heroId: H.id, ...PENDING_MINEURE })]);
  });

  it('PNJ personnage sans siège : le Test se joue sans modale, sa ligne de dé au journal, le gain suit la table', () => {
    const { H, E } = setup();
    Object.assign(combattant(E.id), { followsCharacterRules: true, corruption: 0 });
    banc.setState({ journal: [] });
    frapper('onHit', H, combattant(E.id), arme('pistolet-a-malepierre'));
    expect(get().pendingCorruption).toBeNull();
    const trace = get().journal.map((e) => e.texte).find((l) => l.includes(E.label) && /Résistance/.test(l));
    expect(trace, get().journal.map((e) => e.texte).join('\n')).toBeTruthy();
    const echec = /échec/i.test(trace!);
    expect(combattant(E.id).corruption ?? 0).toBe(echec ? 1 : 0);
  });

  it('ennemi personnage tenu par le siège MJ : la modale s’ouvre chez lui', () => {
    const { H, E } = setup();
    Object.assign(combattant(E.id), { followsCharacterRules: true });
    banc.setState({ net: { ...get().net, gmSeat: 1 } });
    frapper('onHit', H, combattant(E.id), arme('pistolet-a-malepierre'));
    expect(get().pendingCorruption).toMatchObject({ heroId: E.id, ...PENDING_MINEURE });
  });

  it('créature hors règles de personnage (#143) : aucun Test, aucun point, aucune ligne', () => {
    const { H, E } = setup();
    Object.assign(combattant(E.id), { followsCharacterRules: false });
    banc.setState({ journal: [] });
    const avant = combattant(E.id).corruption;
    frapper('onHit', H, E, arme('pistolet-a-malepierre'));
    expect(get().pendingCorruption).toBeNull();
    expect(combattant(E.id).corruption).toBe(avant);
    expect(get().journal.filter((l) => l.texte.includes(E.label))).toEqual([]);
  });
});

describe('Exposition : le chemin direct et la reprise d’un contexte porté posent la même chose (#1508)', () => {
  it('direct, par la porte d’une feuille (`applyLeafOps`)', () => {
    const { H } = setup();
    applyLeafOps(get, banc.setState, combattant(H.id), { type: 'ops', ops: [EXPOSITION] }, { idNeuf: idsDeTest, rng: battleRng() });
    expect(get().pendingCorruption).toMatchObject({ heroId: H.id, ...PENDING_MINEURE });
  });

  it('repris, après un aller-retour JSON du contexte porté (`ctxRepris`)', () => {
    const { H } = setup();
    const porte = JSON.parse(JSON.stringify(porterOpsCtx({ idNeuf: idsDeTest, rng: battleRng() })));
    applyOps(combattant(H.id), [EXPOSITION], ctxRepris(get, banc.setState, porte)!);
    expect(get().pendingCorruption).toMatchObject({ heroId: H.id, ...PENDING_MINEURE });
  });
});

describe('Exposition à la Difficulté imprimée par la source (ZI 13 l.197, l.201)', () => {
  it('héros blessé par un canon ratling : le Test de Corruption Mineure s’ouvre Accessible (+20)', () => {
    const { H, E } = setup();
    frapper('onHit', E, H, arme('canon-ratling'));
    expect(get().pendingCorruption).toMatchObject({ heroId: H.id, ...PENDING_MINEURE, difficulteFixee: 'accessible', test: { difficulty: 'accessible' } });
  });

  it('PNJ personnage sans siège blessé par un canon ratling : le Test sans pilote est Accessible (+20)', () => {
    const { H, E } = setup();
    Object.assign(combattant(E.id), { followsCharacterRules: true, corruption: 0 });
    banc.setState({ journal: [] });
    frapper('onHit', H, combattant(E.id), arme('canon-ratling'));
    expect(get().pendingCorruption).toBeNull();
    const trace = get().journal.map((e) => e.texte).find((l) => l.includes(E.label) && /Résistance/.test(l));
    expect(trace, get().journal.map((e) => e.texte).join('\n')).toContain(DIFFICULTY_LABELS.accessible);
  });

  it('héros touché et blessé par un lance-maleflamme : En flammes, puis Test de Corruption Modérée à la Difficulté du Test', () => {
    const { H, E } = setup();
    frapper('onHit', E, H, arme('lance-maleflamme'));
    expect(hasCondition(combattant(H.id), 'en-flammes')).toBe(true);
    expect(get().pendingCorruption).toMatchObject({ heroId: H.id, level: 'moderee', nature: 'physique', test: { difficulty: 'intermediaire' } });
  });

  it('nature laissée au joueur : la Difficulté imposée survit à son choix', () => {
    const { H } = setup();
    applyLeafOps(get, banc.setState, combattant(H.id), { type: 'ops', ops: [{ op: 'corruptionExposure', level: 'mineure', difficulty: 'accessible' }] }, { idNeuf: idsDeTest, rng: battleRng() });
    get().jetRegler('corruption', 'nature', 'spirituelle');
    expect(get().pendingCorruption).toMatchObject({ nature: 'spirituelle', test: { skill: { id: 'calme' }, difficulty: 'accessible' } });
  });
});
