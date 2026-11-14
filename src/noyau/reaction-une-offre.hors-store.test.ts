/**
 * Une réaction à Attaque gratuite n'est offerte qu'UNE fois par déclencheur (#3159, LDB 10 l.500) : le bus
 * (`applyTriggeredEffects`) saute tout Flow `flowHasFreeAttack`, `resolveFreeAttacks` en est le seul
 * émetteur et lit la MÊME enveloppe d'effet (`ciblesDeLEffet`), avec l'arme de la touche.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { resolveFreeAttacks, runEnemyAI, doAttack, fileDesGratuites } from './combatFlow';
import { distanceDeContact } from './monde/footprint';
import { addCondition } from '../engine/conditions';
import { emitCombatEvent } from './combatEvents';
import { battleRng } from './battleRng';
import { avanceEtapeCascade } from './cascade.testkit';
import { listerDossier } from '../../scripts/guards/lib/lister.mjs';
import { createHero } from '../engine/character';
import { setCadence } from '../engine/cadence';
import { testScene } from '../scenes/test-fixture';
import { traits } from '../data';
import { setDataset } from '../data/overrides';
import type { Combatant, Weapon } from '../engine/types';
import type { TriggeredEffect } from '../engine/flowCore';
import { triggeredEffectSchema } from '../data/schemas/grammaire/mecanique';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });
const TRAITS_LIVRES = [...traits];
afterEach(() => { setDataset('traits', TRAITS_LIVRES as never); });

function setup() {
  const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
  banc.setState({ party: [hero] });
  banc.getState().lancerLaScene(testScene());
  banc.getState().lancerLeCombat('enc-mutants');
  banc.getState().fenetreValider('debutDuRound');
  banc.abandonner();
  const b = banc.getState().battle!;
  const H = b.combatants.find((c) => c.kind === 'heros')!;
  const E = b.combatants.find((c) => c.kind === 'ennemi')!;
  b.combatants = [H, E];
  H.pos = { x: 10, y: 10 };
  E.pos = { x: 11, y: 10 };
  return { H, E };
}
const vif = (id: string): Combatant => banc.getState().battle!.combatants.find((c) => c.id === id)!;
const etapes = () => banc.getState().pendingCascade?.participants.map((p) => p.kind) ?? [];
const etapeCourante = () => { const pc = banc.getState().pendingCascade; return pc ? pc.participants[pc.cursor] : undefined; };
/** Mène la séquence ouverte jusqu'à sa fermeture (`avanceEtapeCascade`). */
function fermerLaSequence(): void {
  for (let i = 0; i < 12 && banc.getState().pendingCascade; i++) avanceEtapeCascade(banc.getState);
}
/** Attaques gratuites imputées à `id` par source (`key`), hors marque « 1 par chargeur » (`<key>:<chargeur>`). */
const imputees = (id: string, tiersId: string) => Object.entries(vif(id).freeAttacksThisTurn ?? {}).filter(([k]) => !k.endsWith(`:${tiersId}`)).reduce((a, [, n]) => a + (n ?? 0), 0);

/** Les Tests d'Initiative du journal, vus au fil des écritures (journal de combat et file différée). */
function ecouterLesTestsDInitiative(): { vus: string[]; fin: () => void } {
  const vus: string[] = [];
  const noter = (l: string) => { if (/Initiative/.test(l) && !vus.includes(l)) vus.push(l); };
  const fin = banc.subscribe((s) => {
    for (const x of s.pendingLogQueue ?? []) noter(x.line);
    for (const e of s.battle?.log ?? []) noter(e.text);
  });
  return { vus, fin };
}

describe('#3159 — une réaction n’est offerte qu’une fois par déclencheur', () => {
  it.each(['oui', 'non'] as const)('A : une IA charge un héros MANUEL porteur de Frappe réactive — UNE offre (%s), puis le tour du chargeur reprend', (reponse) => {
    banc.getState().ensemencerLeTirage(2);
    const { H, E } = setup();
    H.talents = [...(H.talents ?? []), { talentId: 'frappe-reactive', times: 1 }];
    H.characteristics.initiative = 99;
    E.pos = { x: 15, y: 10 };
    const b = banc.getState().battle!;
    banc.setState({ battle: { ...b, order: [E.id, H.id], baseOrder: [E.id, H.id], turn: 0, acted: false, movementUsed: 0 } });
    expect(() => {
      runEnemyAI(banc.getState, banc.setState, E.id);
      for (let i = 0; i < 6 && banc.enAttente() && !banc.getState().pendingCascade; i++) banc.reprendreLesEnAttente();
    }).not.toThrow();
    expect(vif(E.id).chargedThisTurn).toBe(true);
    expect(etapes()).toEqual(['choixDeclenche']);
    const etapesVues = new Map<string, string>();
    banc.subscribe((st) => { for (const p of st.pendingCascade?.participants ?? []) etapesVues.set(p.id, p.kind); });
    avanceEtapeCascade(banc.getState, undefined, () => reponse);
    if (reponse === 'oui') {
      expect(etapeCourante()?.kind).toBe('testDeclenche');
      avanceEtapeCascade(banc.getState);
      expect(vif(H.id).freeAttacksThisTurn?.['frappe-reactive']).toBe(1);
      fermerLaSequence();
      expect([...etapesVues.values()].filter((k) => k === 'testDeclenche')).toHaveLength(1);
    } else {
      expect(banc.getState().pendingCascade).toBeNull();
      expect(vif(H.id).freeAttacksThisTurn).toBeUndefined();
    }
    for (let i = 0; i < 6 && banc.enAttente() && !banc.getState().pendingDefense; i++) banc.reprendreLesEnAttente();
    expect(banc.getState().pendingDefense?.attackerId).toBe(E.id);
  });

  it('B : un héros en Auto-combat charge un porteur ENNEMI — UN Test d’Initiative, une riposte', () => {
    setCadence('auto');
    banc.getState().ensemencerLeTirage(2);
    const { H, E } = setup();
    E.talents = [...(E.talents ?? []), { talentId: 'frappe-reactive', times: 1 }];
    E.characteristics.initiative = 99;
    H.pos = { x: 15, y: 10 };
    const b = banc.getState().battle!;
    banc.setState({ battle: { ...b, order: [H.id, E.id], baseOrder: [H.id, E.id], turn: 0, acted: false, movementUsed: 0 } });
    const tests = ecouterLesTestsDInitiative();
    runEnemyAI(banc.getState, banc.setState, H.id);
    for (let i = 0; i < 3 && banc.enAttente(); i++) banc.reprendreLesEnAttente();
    tests.fin();
    expect(tests.vus).toHaveLength(1);
    expect(vif(E.id).freeAttacksThisTurn?.['frappe-reactive']).toBe(1);
  });

  it('d : une Charge sans bonus d’Avantage (LDB 15 l.35-37) émet onCharged — la riposte est offerte', () => {
    banc.getState().ensemencerLeTirage(2);
    const { H, E } = setup();
    H.talents = [...(H.talents ?? []), { talentId: 'frappe-reactive', times: 1 }];
    E.movement = 8;
    E.pos = { x: 13, y: 10 };
    const avantage = E.advantage;
    const b = banc.getState().battle!;
    banc.setState({ battle: { ...b, order: [E.id, H.id], baseOrder: [E.id, H.id], turn: 0, acted: false, movementUsed: 0 } });
    runEnemyAI(banc.getState, banc.setState, E.id);
    for (let i = 0; i < 6 && banc.enAttente() && !banc.getState().pendingCascade; i++) banc.reprendreLesEnAttente();
    expect(vif(E.id).pos).not.toEqual({ x: 13, y: 10 });
    expect(vif(E.id).advantage).toBe(avantage);
    expect(vif(E.id).chargedThisTurn).toBe(true);
    expect(etapes()).toEqual(['choixDeclenche']);
  });

  it.each([[2, false], [4, true]] as const)('C1 : Cornes (LDB 85 l.83) — Charge à distance %i : Cornes en file = %s (l’Avantage de la Charge, LDB 15 l.37)', (d, cornes) => {
    banc.getState().ensemencerLeTirage(2);
    const { H, E } = setup();
    E.traits = [...(E.traits ?? []), { id: 'cornes', value: 6 } as never];
    E.movement = 8;
    E.pos = { x: 10 + d, y: 10 };
    const b = banc.getState().battle!;
    banc.setState({ battle: { ...b, order: [E.id, H.id], baseOrder: [E.id, H.id], turn: 0, acted: false, movementUsed: 0 } });
    let file: string[] | undefined;
    const fin = banc.subscribe((st) => { const e = st.battle?.combatants.find((c) => c.id === E.id); if (e?.chargedThisTurn && !file) file = fileDesGratuites(e).melee; });
    runEnemyAI(banc.getState, banc.setState, E.id);
    for (let i = 0; i < 6 && banc.enAttente() && !file; i++) banc.reprendreLesEnAttente();
    fin();
    expect(file, 'la Charge a eu lieu').toBeDefined();
    expect(file!.includes('cornes')).toBe(cornes);
  });

  it('C2 : une IA À Terre qui rampe au contact ne Charge pas (LDB 15 l.35 ; LDB 16 l.35)', () => {
    banc.getState().ensemencerLeTirage(2);
    const { H, E } = setup();
    H.talents = [...(H.talents ?? []), { talentId: 'frappe-reactive', times: 1 }];
    E.movement = 8;
    E.pos = { x: 12, y: 10 };
    addCondition(E, 'a-terre');
    const avantage = E.advantage;
    const b = banc.getState().battle!;
    banc.setState({ battle: { ...b, order: [E.id, H.id], baseOrder: [E.id, H.id], turn: 0, acted: false, movementUsed: 0 } });
    let charge = false;
    const fin = banc.subscribe((st) => { if (st.battle?.combatants.find((c) => c.id === E.id)?.chargedThisTurn) charge = true; });
    runEnemyAI(banc.getState, banc.setState, E.id);
    for (let i = 0; i < 2 && banc.enAttente() && !banc.getState().pendingCascade && !banc.getState().pendingDefense; i++) banc.reprendreLesEnAttente();
    fin();
    expect(distanceDeContact(banc.getState().scene, vif(E.id), vif(H.id)), 'au contact').toBeLessThanOrEqual(1);
    expect(charge).toBe(false);
    expect(vif(E.id).advantage).toBe(avantage);
    expect(etapes()).not.toContain('choixDeclenche');
  });
});

/** Inventaire des effets déclenchés de la donnée qui accordent une attaque gratuite — scan JSON, sans le prédicat. */
function effetsAGratuiteDeLaDonnee(): { ou: string; eff: TriggeredEffect }[] {
  const dir = resolve(__dirname, '../data');
  const out: { ou: string; eff: TriggeredEffect }[] = [];
  const parcourir = (n: unknown, ou: string): void => {
    if (Array.isArray(n)) { n.forEach((x, i) => parcourir(x, `${ou}[${i}]`)); return; }
    if (!n || typeof n !== 'object') return;
    const o = n as Record<string, unknown>;
    if (typeof o.trigger === 'string' && o.flow && JSON.stringify(o.flow).includes('"grantFreeAttack"')) out.push({ ou, eff: triggeredEffectSchema.parse(o) });
    for (const [k, v] of Object.entries(o)) parcourir(v, `${ou}.${k}`);
  };
  for (const fichier of listerDossier(dir).filter((x: string) => x.endsWith('.json'))) parcourir(JSON.parse(readFileSync(join(dir, fichier), 'utf8')), fichier);
  return out;
}

const MIXTE: TriggeredEffect = {
  trigger: 'onHit', on: 'victime', attackType: 'distance',
  flow: { kind: 'effet', effet: { type: 'ops', on: 'target', ops: [{ op: 'condition', id: { id: 'empetre' }, value: 1 }, { op: 'grantFreeAttack', weapon: 'held', when: 'immediate' } as never] } },
};
const ATOUT: TriggeredEffect = {
  trigger: 'onHit', on: 'soi',
  flow: { kind: 'effet', effet: { type: 'ops', on: 'caster', ops: [{ op: 'grantFreeAttack', weapon: 'held', when: 'immediate' } as never] } },
};
type Porteur = 'manuel' | 'auto' | 'ennemi';
const PORTEURS: Porteur[] = ['manuel', 'auto', 'ennemi'];
const empetre = (id: string) => vif(id).conditions.find((x) => x.id === 'empetre')?.value ?? 0;

/** Pose `eff` sur le porteur : en Trait synthétique, ou en Atout de son arme (`onHitEffects`). Rend l'arme de la touche. */
function poser(porteur: Combatant, eff: TriggeredEffect, enAtout: boolean): Weapon {
  if (enAtout) {
    const w = { ...porteur.weapons[0], onHitEffects: [eff] } as Weapon;
    porteur.weapons = [w, ...porteur.weapons.slice(1)];
    return w;
  }
  setDataset('traits', [...TRAITS_LIVRES, { id: 'synth-gratuite', label: 'synth-gratuite', effects: [eff] } as never]);
  porteur.traits = [...(porteur.traits ?? []), { id: 'synth-gratuite' } as never];
  return porteur.weapons[0];
}

function scene(qui: Porteur) {
  if (qui === 'auto') setCadence('auto');
  banc.getState().ensemencerLeTirage(2);
  const { H, E } = setup();
  const [porteur, tiers] = qui === 'ennemi' ? [E, H] : [H, E];
  porteur.advantage = 3;
  porteur.characteristics.initiative = 99;
  return { porteur, tiers };
}

describe('#3159 — classe : le bus ne joue aucun Flow à attaque gratuite, resolveFreeAttacks l’offre une fois', () => {
  const inventaire = effetsAGratuiteDeLaDonnee();
  it('inventaire de la donnée non vide (diagnostic)', () => {
    expect(inventaire.length, inventaire.map((x) => x.ou).join('\n')).toBeGreaterThan(0);
  });
  const cas = [
    ...inventaire.map(({ ou, eff }) => ({ nom: ou, eff, enAtout: false })),
    { nom: 'synthétique mixte {on:victim, attackType:ranged}', eff: MIXTE, enAtout: false },
    { nom: 'synthétique Atout d’arme', eff: ATOUT, enAtout: true },
  ];
  for (const { nom, eff, enAtout } of cas) {
    it.each(PORTEURS)(`${nom} — porteur %s`, (qui) => {
      const { porteur, tiers } = scene(qui);
      const weapon = poser(porteur, eff, enAtout);
      const attackType = eff.attackType ?? 'melee';
      const avant = { adv: vif(porteur.id).advantage, log: banc.getState().battle!.log.length, file: banc.getState().pendingLogQueue?.length ?? 0 };
      const sink: string[] = [];
      emitCombatEvent(eff.trigger, { get: banc.getState, set: banc.setState, battle: banc.getState().battle!, self: porteur, sink: (l) => sink.push(l), triggerCtx: { victim: tiers, weapon, attackType, rng: battleRng() } });
      expect(banc.getState().pendingCascade).toBeNull();
      expect(sink).toEqual([]);
      expect(banc.getState().battle!.log.length).toBe(avant.log);
      expect(banc.getState().pendingLogQueue?.length ?? 0).toBe(avant.file);
      expect(vif(porteur.id).advantage).toBe(avant.adv);
      expect(vif(porteur.id).freeAttacksThisTurn).toBeUndefined();
      expect(empetre(tiers.id) + empetre(porteur.id)).toBe(0);
      resolveFreeAttacks(banc.getState, banc.setState, porteur, eff.trigger, tiers, { weapon, attackType });
      for (let i = 0; i < 4 && etapeCourante()?.kind === 'choixDeclenche'; i++) avanceEtapeCascade(banc.getState, undefined, () => 'oui');
      if (etapeCourante()?.kind === 'testDeclenche') avanceEtapeCascade(banc.getState);
      expect(imputees(porteur.id, tiers.id)).toBeLessThanOrEqual(1);
      expect(imputees(porteur.id, tiers.id) + empetre(tiers.id), 'resolveFreeAttacks a joué le Flow').toBeGreaterThan(0);
    });
  }
});

describe('#3159 — enveloppe et arme', () => {
  it('E1 : l’effet mixte attackType:ranged ne s’exerce pas sur une touche de mêlée, et s’exerce sur la victime en tir', () => {
    const { porteur, tiers } = scene('ennemi');
    const weapon = poser(porteur, MIXTE, false);
    resolveFreeAttacks(banc.getState, banc.setState, porteur, 'onHit', tiers, { weapon, attackType: 'melee' });
    expect(empetre(tiers.id) + empetre(porteur.id)).toBe(0);
    expect(vif(porteur.id).freeAttacksThisTurn).toBeUndefined();
    resolveFreeAttacks(banc.getState, banc.setState, porteur, 'onHit', tiers, { weapon, attackType: 'distance' });
    expect(empetre(tiers.id)).toBe(1);
    expect(empetre(porteur.id)).toBe(0);
  });

  it('E2 : l’Atout d’arme n’est une source que de l’arme de la touche', () => {
    const { porteur, tiers } = scene('ennemi');
    const weapon = poser(porteur, ATOUT, true);
    resolveFreeAttacks(banc.getState, banc.setState, porteur, 'onHit', tiers);
    expect(vif(porteur.id).freeAttacksThisTurn).toBeUndefined();
    resolveFreeAttacks(banc.getState, banc.setState, porteur, 'onHit', tiers, { weapon, attackType: 'melee' });
    expect(Object.keys(vif(porteur.id).freeAttacksThisTurn ?? {}).filter((k) => k.startsWith('weapon:'))).toHaveLength(1);
  });

  it.each([
    ['b : Assaut féroce', false],
    ['c : Atout d’arme', true],
  ] as const)('%s — la touche PRINCIPALE d’un héros en Auto-combat (doAttack) joue ses gratuites onHit, avec l’arme de la touche', (_nom, enAtout) => {
    const { porteur, tiers } = scene('auto');
    porteur.characteristics['capacite-de-combat'] = 99;
    tiers.characteristics['capacite-de-combat'] = 1;
    tiers.characteristics.agilite = 1;
    tiers.wounds = { ...tiers.wounds, current: 99 };
    if (enAtout) poser(porteur, ATOUT, true);
    else porteur.talents = [...(porteur.talents ?? []), { talentId: 'assaut-feroce', times: 1 }];
    doAttack(banc.getState, banc.setState, porteur, tiers);
    fermerLaSequence();
    expect(banc.getState().battle!.log.some((l) => l.actorId === porteur.id && l.kind === 'attaque'), 'la touche principale a eu lieu').toBe(true);
    const E = vif(porteur.id);
    const cles = Object.keys(vif(E.id).freeAttacksThisTurn ?? {});
    expect(cles.filter((k) => (enAtout ? k.startsWith('weapon:') : k === 'assaut-feroce'))).toHaveLength(1);
  });
});
