/**
 * LES OBJETS AU SOL (#3741) : un héros pose un objet de son inventaire (`poserLObjet`), un décor naît à la case du
 * groupe et l'objet vit dans `objetsAuSol` ; l'exploration offre de le ramasser, comme le clic sur son décor (`actionsDe`), il revient
 * intact (uids, état, contenu) et son décor sort avec son entrée ; il survit à l'aller-retour de scène
 * (`SceneMutation.entitesChangees`) et à une sauvegarde rechargée. En combat (#3744), l'actif pose d'une Action gratuite
 * (`depot`) et l'arme qu'un Coup Critique fait lâcher tombe à la case de son porteur (`OpsCtx.onLacher`).
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { createHero } from '../engine/character';
import { BOURSE_TRAPPING_ID } from '../engine/bourse';
import type { Combatant, ItemInstance } from '../engine/types';
import type { BattleState } from './etat';
import { resolveCritique } from '../engine/critical';
import { desDuTest } from '../engine/dice.testkit';
import { applyCriticalToTarget } from './combatFlow';
import { objetSourceDeLArme } from '../engine/weaponLoad';
import { estUneVraieArme } from '../engine/items';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { emptyScene, type Scene } from './monde/scene';
import { chargerSurLeBanc, sauverLeBanc } from './persistance/save.testkit';
import { gestesDExploration } from './gestesDExploration';
import { ACTION_RAMASSER, estUtilisable } from './monde/usable';
import { refusDePoser } from './objetsAuSol';
import { t } from '../i18n';

const scene = (id: string): Scene => {
  const s = emptyScene('scene-test', 6, 6);
  s.id = id;
  s.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 2, y: 2 } });
  return s;
};

const heros = (label: string, seed: number): Combatant => createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label, seed });

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/** Un héros dont un contenant porte un autre de ses objets, au début de la scène A d'un projet à deux scènes. */
function partie() {
  const a = heros('A', 3);
  const sac = a.items!.find((i) => i.container)!;
  const range = a.items!.find((i) => !i.container && !i.equipped && i.uid !== sac.uid)!;
  range.inside = sac.uid;
  banc.setState({ party: [a, heros('B', 4)] });
  banc.getState().chargerLeProjet({ scenes: [scene('scene-a'), scene('scene-b')], entryId: 'scene-a', projet: null });
  return { a, sac, range };
}

const objetsDe = (id: string): ItemInstance[] => banc.getState().party.find((h) => h.id === id)!.items ?? [];
const decorsAuSol = () => banc.getState().scene!.entities.filter((e) => e.id in banc.getState().objetsAuSol);

describe('poser un objet au sol et le ramasser', () => {
  it('hors combat, le contenant et son contenu quittent le héros, un décor naît à la case du groupe, et tout revient intact', () => {
    const { a, sac, range } = partie();
    banc.getState().poserLObjet(sac.uid);
    expect(objetsDe(a.id).some((i) => i.uid === sac.uid || i.uid === range.uid), 'le lot quitte son porteur').toBe(false);
    const [decor] = decorsAuSol();
    expect(decor, 'un sac à la case du groupe').toMatchObject({ kind: 'prop', decor: { id: 'bourse' }, pos: { x: 2, y: 2 } });
    expect(banc.getState().objetsAuSol[decor.id].map((i) => i.uid), 'l’objet, puis son contenu').toEqual([sac.uid, range.uid]);

    const ramasser = gestesDExploration(banc.getState()).find((g) => g.libelle === t('exploration.offre', { porteur: decor.label!, action: t('usable.ramasser') }));
    expect(ramasser?.gestes, 'l’exploration offre de le ramasser, comme le clic sur le sac').toEqual([{ verbe: 'jouerAction', args: [decor.id, ACTION_RAMASSER] }]);
    expect(estUtilisable(banc.getState().scene!, decor, banc.getState()), 'le sac posé appelle son geste').toBe(true);
    banc.getState().jouerAction(decor.id, ACTION_RAMASSER);
    const leader = banc.getState().party[0].id;
    expect(objetsDe(leader).find((i) => i.uid === sac.uid), 'le meneur le reçoit, libre').toEqual({ ...sac, equipped: false, inside: undefined });
    expect(objetsDe(leader).find((i) => i.uid === range.uid)?.inside, 'son contenu y est toujours rangé').toBe(sac.uid);
    expect([decorsAuSol(), banc.getState().objetsAuSol, banc.getState().scene!.entities.some((e) => e.id === decor.id)], 'le décor sort avec son entrée').toEqual([[], {}, false]);
  });

  it('une Bourse ramassée par un héros qui a la sienne s’y verse : il n’en porte qu’une', () => {
    partie();
    const [a, b] = banc.getState().party;
    const bourse = a.items!.find((i) => i.trappingId === BOURSE_TRAPPING_ID)!;
    const sienne = b.items!.find((i) => i.trappingId === BOURSE_TRAPPING_ID)!;
    banc.getState().poserLObjet(bourse.uid);
    banc.getState().ramasserLObjet(decorsAuSol()[0].id, bourse.uid, b.id);
    expect(objetsDe(b.id).filter((i) => i.trappingId === BOURSE_TRAPPING_ID).map((i) => i.uid)).toEqual([sienne.uid]);
  });

  it('se refuse sans sol, en combat, et pour une arme conjurée', () => {
    const { a, sac } = partie();
    const s = banc.getState();
    expect(refusDePoser({ ...s, scene: null }, sac.uid)).toBe(t('pf.poserSansScene', { item: sac.label }));
    expect(refusDePoser({ ...s, battle: s.battle ?? ({} as NonNullable<typeof s.battle>) }, sac.uid)).toBe(t('pf.inventoryLocked'));
    const conjure = { ...a, items: a.items!.map((i) => (i.uid === sac.uid ? { ...i, conjured: true } : i)) };
    expect(refusDePoser({ ...s, party: [conjure, ...s.party.slice(1)] }, sac.uid)).toBe(t('pf.poserConjure', { item: sac.label }));
  });

  it('l’objet posé survit à l’aller-retour de scène et à une sauvegarde rechargée', () => {
    const { sac } = partie();
    banc.getState().poserLObjet(sac.uid);
    const [decor] = decorsAuSol();
    banc.getState().quitterLaScene('scene-b');
    const texte = sauverLeBanc(banc);
    banc.setState({ sceneInstances: {}, objetsAuSol: {} });
    chargerSurLeBanc(banc, texte);
    banc.getState().quitterLaScene('scene-a');
    expect(banc.getState().scene!.entities.find((e) => e.id === decor.id), 'le décor est revenu avec sa scène').toEqual(decor);
    banc.getState().ramasserLObjet(decor.id, sac.uid);
    expect(objetsDe(banc.getState().party[0].id).some((i) => i.uid === sac.uid), 'et se ramasse').toBe(true);
  });
});

describe('en combat', () => {
  /** Le héros A, seul combattant au tour, à la case (2, 2) de la scène A. */
  function bataille(): Combatant {
    partie();
    const s = banc.getState();
    const actif: Combatant = { ...structuredClone(s.party[0]), pos: { x: 2, y: 2 } };
    const battle: BattleState = {
      combatants: [actif], order: [actif.id], turn: 0, round: 1, action: null, selectedSpellId: null,
      reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
    };
    banc.setState({ mode: 'battle', battle });
    return actif;
  }
  const combattant = () => banc.getState().battle!.combatants[0];

  it('l’actif pose un objet d’une Action gratuite, à sa case ; le ramasser coûte l’Action', () => {
    const actif = bataille();
    const objet = actif.items!.find((i) => !i.inside && !i.container)!;
    banc.jouerLaCase('depot', { itemUid: objet.uid });
    const [decor] = decorsAuSol();
    expect(combattant().items!.some((i) => i.uid === objet.uid), 'il quitte le combattant').toBe(false);
    expect([decor?.pos, banc.getState().battle!.acted], 'à sa case, sans prendre l’Action').toEqual([{ x: 2, y: 2 }, false]);
    banc.getState().ramasserLObjet(decor.id, objet.uid);
    expect([combattant().items!.some((i) => i.uid === objet.uid), banc.getState().battle!.acted], 'ramassé d’une Action').toEqual([true, true]);
  });

  it('l’arme qu’un Coup Critique fait lâcher tombe au sol, à la case de son porteur', () => {
    const actif = bataille();
    const tenue = objetSourceDeLArme(actif, actif.weapons.find((w) => estUneVraieArme(w) && w.derivedFromItem == null && (w.hands === 2 || w.hand !== 'secondaire'))!)!;
    const crit = resolveCritique('ldb', combattant(), 'brasD', desDuTest, { forcedRoll: 5 });
    expect(crit.ops, 'Choc au bras : il lâche ce qu’il tient').toContainEqual({ op: 'disarm' });
    applyCriticalToTarget(combattant(), 'brasD', 0, [], banc.setState, { prerolled: crit, get: banc.getState });
    const [decor] = decorsAuSol();
    expect(combattant().items!.some((i) => i.uid === tenue.uid), 'elle quitte son porteur').toBe(false);
    expect([decor?.pos, banc.getState().objetsAuSol[decor?.id]?.map((i) => i.uid)], 'et gît à sa case').toEqual([{ x: 2, y: 2 }, [tenue.uid]]);
  });
});
