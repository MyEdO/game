/**
 * Contrat du REGISTRE DE PISTES (#1176, L2) : un geste par acteur à chaque échange, l'émission
 * d'`ANIM_IMPACT` par le registre (une fois, à `impactMs`, sur son horloge propre), et l'unicité des
 * abonnements quel que soit le nombre d'hôtes installés.
 */
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCorpus } from '../../../scripts/guards/lib/sourceCorpus.mjs';
import { bus, EVT } from '../../noyau/bus';
import { PLAN_ATTACK_IMPACT_MS } from '../rig/anim/actorAnimSelect';
import {
  animTracksInstalls,
  installAnimTracks,
  TRACK_PURGE_MARGIN_MS,
  tracksRef,
  type AnimActorCtx,
  type AnimCtxResolver,
} from './animTracks';

const FAUX_TIMERS = ['setTimeout', 'clearTimeout', 'Date', 'performance'] as const;

/** Résolveur de test : voie par acteur, et COMPTE des résolutions (un abonnement en double s'y voit). */
function resolveur(par: Record<string, AnimActorCtx>): AnimCtxResolver & { appels: () => number } {
  let n = 0;
  const f = ((id: string) => {
    n += 1;
    return par[id];
  }) as AnimCtxResolver & { appels: () => number };
  f.appels = () => n;
  return f;
}

const rig: AnimActorCtx = { voie: 'rig', kind: 'hero', rig: {} };
const plan: AnimActorCtx = { voie: 'plan', kind: 'ennemi' };

/** Compteur d'`ANIM_IMPACT` sur le bus, désabonné par l'appelant. */
function espionImpact(): { n: () => number; payloads: unknown[]; off: () => void } {
  const payloads: unknown[] = [];
  const off = bus.on(EVT.ANIM_IMPACT, (d) => void payloads.push(d));
  return { n: () => payloads.length, payloads, off };
}

const nettoyage: (() => void)[] = [];
afterEach(() => {
  for (const f of nettoyage.splice(0)) f();
  vi.useRealTimers();
});

/** HYGIÈNE `isolate: false` : le registre est un SINGLETON de module, partagé par tout le fichier de
 *  suite. Un test qui oublierait sa libération laisserait ses abonnements bus et son horloge vivants
 *  pour les fichiers suivants. */
afterAll(() => {
  expect(animTracksInstalls()).toBe(0);
});

describe('registre de pistes', () => {
  it('une attaque écrit la piste de l’attaquant ET celle du défenseur', () => {
    nettoyage.push(installAnimTracks(resolveur({ a: rig, b: rig })));
    bus.emit(EVT.ANIM_ATTACK, { from: 'a', to: 'b', kind: 'melee', defense: 'esquive', result: { hit: false } });
    const t = tracksRef();
    expect(t.get('a')?.role).toBe('attack');
    expect(t.get('a')?.def.key).toMatch(/^rig:attack:/);
    expect(t.get('b')?.role).toBe('defense');
    expect(t.get('b')?.def.key).toMatch(/^rig:dodge:/);
  });

  it('une attaque TOUCHÉE ne fait pas se dérober la cible (sa piste vient de l’impact)', () => {
    vi.useFakeTimers({ toFake: [...FAUX_TIMERS] });
    nettoyage.push(installAnimTracks(resolveur({ a: rig, b: rig })));
    bus.emit(EVT.ANIM_ATTACK, { from: 'a', to: 'b', kind: 'melee', defense: 'none', result: { hit: true } });
    expect(tracksRef().get('b')).toBeUndefined();
    vi.advanceTimersByTime(tracksRef().get('a')!.def.impactMs! + 20);
    expect(tracksRef().get('b')?.role).toBe('hit');
    expect(tracksRef().get('b')?.def.key).toMatch(/^rig:hit:/);
  });

  it('émet ANIM_IMPACT UNE fois, à impactMs, sur l’horloge du registre', () => {
    vi.useFakeTimers({ toFake: [...FAUX_TIMERS] });
    const spy = espionImpact();
    nettoyage.push(spy.off);
    nettoyage.push(installAnimTracks(resolveur({ a: rig, b: rig })));
    bus.emit(EVT.ANIM_ATTACK, { from: 'a', to: 'b', kind: 'melee', defense: 'none', result: { hit: true } });
    const impactMs = tracksRef().get('a')!.def.impactMs!;
    expect(impactMs).toBeGreaterThan(0);
    vi.advanceTimersByTime(impactMs - 20);
    expect(spy.n()).toBe(0);
    vi.advanceTimersByTime(40);
    expect(spy.n()).toBe(1);
    expect(spy.payloads[0]).toEqual({ to: 'b', result: { hit: true } });
    vi.advanceTimersByTime(5000);
    expect(spy.n()).toBe(1);
  });

  it('deux installations = UN seul abonnement (une résolution par acteur et par évènement)', () => {
    const r = resolveur({ a: rig, b: rig });
    const un = installAnimTracks(r);
    const deux = installAnimTracks(r);
    nettoyage.push(un, deux);
    expect(animTracksInstalls()).toBe(2);
    bus.emit(EVT.ANIM_ATTACK, { from: 'a', to: 'b', kind: 'melee', defense: 'esquive', result: { hit: false } });
    expect(r.appels()).toBe(2);
    // La première libération ne désabonne pas : le second hôte tient encore le registre.
    un();
    bus.emit(EVT.ANIM_ATTACK, { from: 'a', to: 'b', kind: 'melee', defense: 'esquive', result: { hit: false } });
    expect(r.appels()).toBe(4);
    deux();
    bus.emit(EVT.ANIM_ATTACK, { from: 'a', to: 'b', kind: 'melee', defense: 'esquive', result: { hit: false } });
    expect(r.appels()).toBe(4);
    expect(tracksRef().size).toBe(0);
  });

  it('gabarit : l’attaque de créature porte un impactMs et émet son impact', () => {
    vi.useFakeTimers({ toFake: [...FAUX_TIMERS] });
    const spy = espionImpact();
    nettoyage.push(spy.off);
    nettoyage.push(installAnimTracks(resolveur({ m: plan, c: rig })));
    bus.emit(EVT.ANIM_ATTACK, { from: 'm', to: 'c', kind: 'melee', defense: 'none', result: { hit: true }, creatureAttack: 'morsure' });
    const piste = tracksRef().get('m')!;
    expect(piste.def.key).toBe('plan:attack:morsure');
    expect(piste.def.impactMs).toBe(PLAN_ATTACK_IMPACT_MS);
    vi.advanceTimersByTime(PLAN_ATTACK_IMPACT_MS + 20);
    expect(spy.n()).toBe(1);
  });

  it('gabarit : une attaque SUR SOI (souffle) n’arme aucun impact — ni flinch, ni son de touche', () => {
    vi.useFakeTimers({ toFake: [...FAUX_TIMERS] });
    const spy = espionImpact();
    nettoyage.push(spy.off);
    nettoyage.push(installAnimTracks(resolveur({ m: plan })));
    // La forme que `emitCreatureAttackAnim` poste pour une attaque spéciale de créature : `to` = `from`.
    bus.emit(EVT.ANIM_ATTACK, { from: 'm', to: 'm', kind: 'creature', defense: 'none', result: { hit: true }, creatureAttack: 'souffle' });
    const piste = tracksRef().get('m')!;
    expect(piste.role, 'le souffle se JOUE : c’est son impact qui n’a pas de destinataire').toBe('attack');
    expect(piste.impact, 'un impact armé reviendrait à l’attaquant lui-même').toBeUndefined();
    vi.advanceTimersByTime(PLAN_ATTACK_IMPACT_MS + 20);
    expect(spy.n(), 'ANIM_IMPACT sur soi = un bruit de touche parasite').toBe(0);
    expect(tracksRef().get('m')?.role, 'la bête se déroberait au milieu de son propre geste').toBe('attack');
  });

  it('purge les pistes expirées (durée du geste + marge)', () => {
    vi.useFakeTimers({ toFake: [...FAUX_TIMERS] });
    nettoyage.push(installAnimTracks(resolveur({ a: rig, b: rig })));
    bus.emit(EVT.ANIM_ATTACK, { from: 'a', to: 'b', kind: 'melee', defense: 'esquive', result: { hit: false } });
    const piste = tracksRef().get('a')!;
    vi.advanceTimersByTime(piste.expiresAt - piste.start - TRACK_PURGE_MARGIN_MS);
    expect(tracksRef().has('a')).toBe(true);
    vi.advanceTimersByTime(TRACK_PURGE_MARGIN_MS + 32);
    expect(tracksRef().size).toBe(0);
  });

  it('deux hôtes, deux résolveurs : démonter le second rend le service au PREMIER, jamais l’inverse', () => {
    // Le MÊME acteur, vu autrement par chaque hôte : ce que le résolveur en service dit se lit dans
    // le geste choisi (voie plan vs voie rig).
    const rA = resolveur({ x: plan });
    const rB = resolveur({ x: rig });
    const a = installAnimTracks(rA);
    const b = installAnimTracks(rB);
    nettoyage.push(a, b);
    // Le dernier installé sert.
    bus.emit(EVT.ANIM_ATTACK, { from: 'x', kind: 'melee', creatureAttack: 'morsure' });
    expect(tracksRef().get('x')?.def.key).toMatch(/^rig:attack:/);
    expect(rB.appels()).toBe(1);
    b();
    // B démonté : le service revient à A — son résolveur, pas celui de l'hôte parti.
    bus.emit(EVT.ANIM_ATTACK, { from: 'x', kind: 'melee', creatureAttack: 'morsure' });
    expect(tracksRef().get('x')?.def.key).toBe('plan:attack:morsure');
    expect(rA.appels()).toBe(1);
    expect(rB.appels()).toBe(1);
  });
});

/**
 * VERROU PAR CONSTRUCTION du CONTRAT D'ÉMISSION UNIQUE : le registre installé est le seul émetteur
 * d'`ANIM_IMPACT`. Tant qu'aucun hôte de PRODUCTION n'installe le registre, l'émission du stage
 * affine (`useRigAnim`) est la bonne et reste ; dès qu'un hôte l'installe, elle doit partir — sinon
 * deux impacts partent pour un seul geste.
 *
 * ANGLE MORT : la garde ne voit que DEUX faits textuels — l'existence d'un appel à
 * `installAnimTracks` hors tests, et la présence de `bus.emit(EVT.ANIM_IMPACT` dans `useRigAnim.ts`.
 * Elle ne dit rien d'un troisième émetteur ailleurs, ni d'une installation faite par indirection
 * (référence de fonction passée puis appelée), ni de la justesse des payloads.
 */
const ROOT = fileURLToPath(new URL('../../..', import.meta.url)); // src/gameIso/fx/ → racine du projet
const DEFINITION = 'src/gameIso/fx/animTracks.ts';
const HOTE_AFFINE = 'src/gameIso/useRigAnim.ts';
const EMISSION_AFFINE = 'bus.emit(EVT.ANIM_IMPACT';

describe('contrat d’émission unique d’ANIM_IMPACT (verrou structurel)', () => {
  it('un appelant de PRODUCTION d’installAnimTracks interdit l’émission de useRigAnim', () => {
    const appelants = readCorpus(['src'])
      .filter(({ rel, text }) => rel !== DEFINITION && /\binstallAnimTracks\s*\(/.test(text))
      .map(({ rel }) => rel);
    const émetEncore = readFileSync(join(ROOT, HOTE_AFFINE), 'utf8').includes(EMISSION_AFFINE);
    expect(
      émetEncore ? appelants : [],
      `Le registre de pistes est installé en production (${appelants.join(', ')}) ALORS QUE ` +
        `${HOTE_AFFINE} émet encore ANIM_IMPACT : retirer cette émission-là (deux émetteurs = deux impacts).`,
    ).toEqual([]);
  });
});
