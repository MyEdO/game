/**
 * LA SORTIE D'UN ÉTAT (#4993) : quand la dernière instance d'un État quitte son porteur, quelle que soit la voie, la
 * conséquence que l'État déclare (`EtatData.aLaSortie`) est posée, et chaque pose a sa ligne au journal. Les sorties
 * sont celles que ce fichier déclare (`declarerLesSorties`), jamais celles de la donnée livrée.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { blessuresDeBase, combattantDeTest } from '../engine/combattantDeTest.testkit';
import { deFixe } from '../engine/dice.testkit';
import { declarerLesSorties } from '../engine/sortiesDeTest.testkit';
import { stacks, removeCondition, releaseConditionLocks, tickDurations, removeActiveEffects, purgerEtats } from '../engine/conditions';
import { applyHealWounds } from '../engine/healing';
import { applyOps } from '../engine/ops';
import { carryOverState } from '../engine/persistence';
import { purgeClockEffects } from './upkeep';
import { texteDuFait, type Applique } from '../engine/faits';
import type { Combatant, ConditionInstance } from '../engine/types';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const vide = (): Applique => ({ lignes: [], faits: [] });
const porteur = (conditions: ConditionInstance[], blessures = 12): Combatant =>
  combattantDeTest({ id: 'h', label: 'Hilde', kind: 'heros', conditions, wounds: blessuresDeBase(12, blessures) });
/** Les ids des États portés, avec leurs pions. */
const portes = (c: Pick<Combatant, 'conditions'>): Record<string, number> => Object.fromEntries(c.conditions.map((x) => [x.id, x.value]));
/** La ligne de journal d'une pose d'1 pion de `id` sur `c`. */
const ligneDePose = (c: Combatant, id: string): string => texteDuFait({ genre: 'etat', cible: c.id, camp: 'groupe', id, valeur: 1 }, c.label);

declarerLesSorties({
  brise: [{ op: 'condition', id: { id: 'aveugle' } }],
  empoisonne: [{ op: 'condition', id: { id: 'assourdi' } }],
  hemorragique: [{ op: 'condition', id: { id: 'surpris' } }],
  inconscient: [{ op: 'condition', id: { id: 'a-terre' } }, { op: 'condition', id: { id: 'extenue' } }],
  sonne: [{ op: 'condition', id: { id: 'extenue' }, unlessCondition: { id: 'extenue' } }],
});

describe('sorties simultanées (#4993)', () => {
  // #4993
  it('Sonné et Inconscient sortis ensemble : le « si absent » de Sonné se lit AVANT la sortie, quel que soit l’ordre', () => {
    for (const ordre of [['sonne', 'inconscient'], ['inconscient', 'sonne']]) {
      const c = porteur(ordre.map((id) => ({ id, value: 1 })));
      purgerEtats(c, (x) => x.id === 'sonne' || x.id === 'inconscient', vide());
      expect(portes(c), ordre.join(' puis ')).toEqual({ 'a-terre': 1, extenue: 2 });
    }
  });
});

describe('removeCondition : la sortie suit le DERNIER pion', () => {
  it('un pion restant ne pose rien, le dernier pose la sortie et sa ligne', () => {
    const c = porteur([{ id: 'hemorragique', value: 2 }]);
    const a = vide();
    removeCondition(c, 'hemorragique', 1, a);
    expect(portes(c)).toEqual({ hemorragique: 1 });
    removeCondition(c, 'hemorragique', 1, a);
    expect(portes(c)).toEqual({ surpris: 1 });
    expect(a.lignes).toEqual([ligneDePose(c, 'surpris')]);
    expect(a.faits).toEqual([{ genre: 'etat', cible: 'h', camp: 'groupe', id: 'surpris', valeur: 1 }]);
  });

  it('une sortie à deux poses : les deux, dans leur ordre', () => {
    const c = porteur([{ id: 'inconscient', value: 1 }]);
    const a = vide();
    removeCondition(c, 'inconscient', 1, a);
    expect(portes(c)).toEqual({ 'a-terre': 1, extenue: 1 });
    expect(a.lignes).toEqual([ligneDePose(c, 'a-terre'), ligneDePose(c, 'extenue')]);
  });

  it('l’`unlessCondition` : la pose si le porteur n’a pas l’État, rien s’il l’a', () => {
    const sans = porteur([{ id: 'sonne', value: 1 }]);
    removeCondition(sans, 'sonne', 1, vide());
    expect(portes(sans)).toEqual({ extenue: 1 });
    const avec = porteur([{ id: 'sonne', value: 1 }, { id: 'extenue', value: 1 }]);
    const a = vide();
    removeCondition(avec, 'sonne', 1, a);
    expect(portes(avec)).toEqual({ extenue: 1 });
    expect(a.lignes).toEqual([]);
  });

  it('l’op `removeCondition` (flux d’un État) : le retrait, puis la sortie', () => {
    const c = porteur([{ id: 'empoisonne', value: 1 }]);
    const { lignes } = applyOps(c, [{ op: 'removeCondition', id: { id: 'empoisonne' }, value: 1 }], { idNeuf: idsDeTest, rng: deFixe(1) });
    expect(portes(c)).toEqual({ assourdi: 1 });
    expect(lignes[lignes.length - 1]).toBe(ligneDePose(c, 'assourdi'));
  });
});

describe('chaque voie de retrait traverse la même sortie', () => {
  it('Aide médicale : l’État verrouillé qu’elle lève pose sa sortie', () => {
    const c = porteur([{ id: 'hemorragique', value: 1, unlockBy: 'medicalAid' }]);
    const { lignes } = releaseConditionLocks(c, 'medicalAid');
    expect(portes(c)).toEqual({ surpris: 1 });
    expect(lignes).toContain(ligneDePose(c, 'surpris'));
  });

  it('réveil par les Blessures : l’Inconscient part, À Terre et Exténué se posent, au journal du soin', () => {
    const c = porteur([{ id: 'inconscient', value: 1 }], 0);
    const lignes = applyHealWounds(c, 3);
    expect(portes(c)).toEqual({ 'a-terre': 1, extenue: 1 });
    expect(lignes).toEqual(expect.arrayContaining([ligneDePose(c, 'a-terre'), ligneDePose(c, 'extenue')]));
  });

  it('expiration en Rounds : l’État échu pose sa sortie', () => {
    const c = porteur([{ id: 'sonne', value: 1, roundsLeft: 1 }]);
    const lignes = tickDurations(c);
    expect(portes(c)).toEqual({ extenue: 1 });
    expect(lignes).toContain(ligneDePose(c, 'extenue'));
  });

  it('pion porté qui tombe : l’État que portait l’effet retiré pose sa sortie', () => {
    const c = porteur([]);
    applyOps(c, [{ op: 'condition', id: { id: 'empoisonne' }, value: 1, carried: true, durationRounds: 3 }], { idNeuf: idsDeTest, rng: deFixe(1), label: 'Venin' });
    expect(stacks(c, 'empoisonne')).toBe(1);
    const a = vide();
    removeActiveEffects(c, () => true, a);
    expect(portes(c)).toEqual({ assourdi: 1 });
    expect(a.lignes).toContain(ligneDePose(c, 'assourdi'));
  });

  it('report de fin de combat : l’État de rencontre part, sa conséquence persistante reste, la transitoire tombe', () => {
    const c = porteur([{ id: 'inconscient', value: 1, finDeRencontre: true }]);
    const a = vide();
    const sorti = carryOverState(c, a);
    expect(portes(sorti as Combatant)).toEqual({ extenue: 1 });
    expect(a.lignes).toEqual([ligneDePose(c, 'extenue')]);
    expect(portes(c), 'le combattant de la rencontre n’est pas touché').toEqual({ inconscient: 1 });
  });

  it('purge d’horloge : l’État d’horloge échu pose sa sortie, au journal', () => {
    const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    hero.conditions = [{ id: 'inconscient', value: 1, untilTime: 10 }];
    banc.setState({ party: [hero], gameTime: 20 });
    const lignes = purgeClockEffects(banc.getState, banc.setState).map((l) => l.text);
    const h = banc.getState().party[0];
    expect(portes(h)).toEqual({ 'a-terre': 1, extenue: 1 });
    expect(lignes).toEqual(expect.arrayContaining([ligneDePose(h, 'a-terre'), ligneDePose(h, 'extenue')]));
  });

  it('Détermination : le dernier pion retiré pose sa sortie, au journal du combat', () => {
    const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    banc.setState({ party: [hero] });
    banc.getState().lancerLaScene(testScene());
    banc.getState().lancerLeCombat('enc-mutants');
    banc.getState().fenetreValider('debutDuRound');
    banc.abandonner();
    const b = banc.getState().battle!;
    const H = b.combatants.find((x) => x.kind === 'heros')!;
    H.resolve = 1;
    H.conditions = [{ id: 'brise', value: 1 }];
    banc.setState({ battle: { ...b } });
    banc.getState().depenserLaDetermination(H.id, 'retirerUnEtat', 'brise');
    const apres = banc.getState().battle!.combatants.find((x) => x.id === H.id)!;
    expect(portes(apres)).toEqual({ aveugle: 1 });
    expect(banc.getState().battle!.log.map((e) => e.text)).toContain(ligneDePose(apres, 'aveugle'));
  });
});
