/**
 * Montures en voyage (EDOC 7) — moteur PUR : vitesse par allure (EDOC 07 l.140), endurance des
 * allures (l.142-144), cascade de sur-endurance + Incidents de monte (l.146-174), données verbatim
 * (`montures.json`). Monture = Possession `nature: 'bete'` (SOCLE POSSESSIONS #617/#618).
 */
import { describe, it, expect } from 'vitest';
import { makeRNG } from './dice';
import type { Combatant } from './types';
import type { Possession } from './possession';
import { MOUNT_INCIDENTS } from './travelTables';
import {
  ALLURE_KMH_PER_M, MOUNT_PROFILES, mountProfileById, mountProfileForCreature, mountBE,
  heroMount, partyMounts, partyFullyMounted, availableAllures, mountedSpeedKmh,
  allureEnduranceHours, lameLedCapKmh, resolveMountIncident, resolveMountedDay,
  type PartyMount, type MountInjury,
} from './mountTravel';
import { blessuresSurLeProfil, blessuresDeBase } from './combattantDeTest.testkit';

const hero = (p: Partial<Combatant> = {}): Combatant =>
  (blessuresSurLeProfil({
    id: 'h', label: 'Hilda', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 35, sociabilite: 30 },
    wounds: blessuresDeBase(12), advantage: 0, conditions: [], skills: [], talents: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    items: [], movement: 4,
    ...p,
  }) as Combatant);

const beast = (ownerId: string, creatureId: string, injury?: MountInjury): Possession => ({
  uid: `pos-${ownerId}-${creatureId}`, ownerId, nature: 'bete', ref: { creatureId },
  location: { kind: 'avec-le-groupe' }, items: [], mountInjury: injury,
});

const mountOf = (creatureId: string, injury?: MountInjury): PartyMount => {
  const h = hero();
  const m = heroMount(h, [beast(h.id, creatureId, injury)]);
  if (!m) throw new Error(`pas de profil pour ${creatureId}`);
  return m;
};

describe('montures.json — table EDOC 07 verbatim (profils l.17-96, allures l.119-130)', () => {
  it('les 8 lignes de la table sont présentes, M/E/trot conformes', () => {
    const byId = Object.fromEntries(MOUNT_PROFILES.map((p) => [p.id, p]));
    expect(MOUNT_PROFILES.length).toBe(8);
    expect(byId['chien']).toMatchObject({ m: 4, e: 20, trot: false });
    expect(byId['poney-ane-ou-mule']).toMatchObject({ m: 4, e: 45, trot: false });
    expect(byId['cheval-de-trait']).toMatchObject({ m: 5, e: 45, trot: false });
    expect(byId['cheval-de-trait-lourd']).toMatchObject({ m: 4, e: 50, trot: false });
    expect(byId['boeuf']).toMatchObject({ m: 3, e: 55, trot: false });
    expect(byId['cheval-de-monte']).toMatchObject({ m: 7, e: 45, trot: true });
    expect(byId['cheval-de-guerre']).toMatchObject({ m: 7, e: 35, trot: true });
    expect(byId['cheval-de-guerre-lourd']).toMatchObject({ m: 4, e: 50, trot: true });
  });

  it('lien créature → profil (cheval-de-monte, mule, destrier)', () => {
    expect(mountProfileForCreature('cheval-de-monte')?.id).toBe('cheval-de-monte');
    expect(mountProfileForCreature('mule')?.id).toBe('poney-ane-ou-mule');
    expect(mountProfileForCreature('destrier-cheval-de-guerre-lourd')?.id).toBe('cheval-de-guerre-lourd');
    expect(mountProfileForCreature('epee')).toBeUndefined();
  });
});

describe('vitesse de voyage (EDOC 07 l.140 : M × 1,5 / 2,5 / 3 km/h)', () => {
  it('Palefroi M7 : pas 10,5 — trot 17,5 — galop 21 km/h', () => {
    const m = mountOf('cheval-de-monte');
    expect(mountedSpeedKmh([m], 'pas')).toBeCloseTo(7 * 1.5);
    expect(mountedSpeedKmh([m], 'trot')).toBeCloseTo(7 * 2.5);
    expect(mountedSpeedKmh([m], 'galop')).toBeCloseTo(7 * 3);
    expect(ALLURE_KMH_PER_M).toEqual({ pas: 1.5, trot: 2.5, galop: 3 });
  });

  it('la vitesse du groupe est celle de la bête la plus lente', () => {
    expect(mountedSpeedKmh([mountOf('cheval-de-monte'), mountOf('poney')], 'galop')).toBeCloseTo(4 * 3);
  });

  it('Perte d’un fer : la bête reste au pas (l.166) quelle que soit l’allure du groupe', () => {
    expect(mountedSpeedKmh([mountOf('cheval-de-monte', 'perte-d-un-fer')], 'galop')).toBeCloseTo(7 * 1.5);
  });

  it('une bête qui ne trotte pas (l.121-130) reste au pas quand le groupe trotte', () => {
    expect(mountedSpeedKmh([mountOf('mule')], 'trot')).toBeCloseTo(4 * 1.5);
  });
});

describe('allures disponibles et endurance (EDOC 07 l.142-144)', () => {
  it('le trot exige que TOUTES les bêtes trottent', () => {
    expect(availableAllures([mountOf('cheval-de-monte')])).toEqual(['pas', 'trot', 'galop']);
    expect(availableAllures([mountOf('cheval-de-monte'), mountOf('mule')])).toEqual(['pas', 'galop']);
  });

  it('endurance : 12 h au pas ; BE heures au trot ; ½ BE au galop (Palefroi E45 → BE 4)', () => {
    const p = mountProfileById('cheval-de-monte')!;
    expect(mountBE(p)).toBe(4);
    expect(allureEnduranceHours(p, 'pas')).toBe(12);
    expect(allureEnduranceHours(p, 'trot')).toBe(4);
    expect(allureEnduranceHours(p, 'galop')).toBe(2);
  });
});

describe('montures du groupe (bêtes possédées)', () => {
  it('heroMount ignore les bêtes qui ne peuvent plus être montées (Boiteux/Patte brisée, l.157-163)', () => {
    const h = hero();
    expect(heroMount(h, [beast(h.id, 'poney', 'boiteux')])).toBeUndefined();
    expect(heroMount(h, [beast(h.id, 'poney', 'patte-brisee')])).toBeUndefined();
    expect(heroMount(h, [beast(h.id, 'poney', 'perte-d-un-fer')])).toBeDefined();
  });

  it('partyFullyMounted : chaque héros VIVANT doit avoir une monture', () => {
    const a = hero({ id: 'a' });
    const b = hero({ id: 'b' });
    expect(partyFullyMounted([a, b], [beast('a', 'poney')])).toBe(false);
    const possessions = [beast('a', 'poney'), beast('b', 'cheval-de-monte')];
    expect(partyFullyMounted([a, b], possessions)).toBe(true);
    expect(partyMounts([a, b], possessions).length).toBe(2);
  });

  it('lameLedCapKmh : une bête Boiteuse menée plafonne à ½ vitesse de marche (l.157)', () => {
    const a = hero({ id: 'a' });
    expect(lameLedCapKmh([a], [beast('a', 'cheval-de-monte', 'boiteux')])).toBeCloseTo((7 * 1.5) / 2);
    expect(lameLedCapKmh([hero()], [])).toBeNull();
  });
});

describe('resolveMountIncident (EDOC 07 l.157-174)', () => {
  const entry = (id: string) => MOUNT_INCIDENTS.find((e) => e.id === id)!;

  it('Sangle cassée : Test de Chevaucher du cavalier + état persistant', () => {
    const r = resolveMountIncident(entry('sangle-cassee'), mountOf('cheval-de-monte'), makeRNG(3));
    expect(r.injury).toBe('sangle-cassee');
    expect(r.riderTest).toBeDefined();
    if (!r.riderTest!.success) expect(r.riderFallM).toBe(2);
  });

  it('Perte d’un fer : Test de Chevaucher + la bête au pas (injury)', () => {
    const r = resolveMountIncident(entry('perte-d-un-fer'), mountOf('poney'), makeRNG(5));
    expect(r.injury).toBe('perte-d-un-fer');
    expect(r.riderTest).toBeDefined();
  });

  it('une Sangle cassée antérieure inflige -20 aux Tests de Chevaucher suivants (l.174)', () => {
    const sain = resolveMountIncident(entry('perte-d-un-fer'), mountOf('cheval-de-monte'), makeRNG(1));
    const abime = resolveMountIncident(entry('perte-d-un-fer'), mountOf('cheval-de-monte', 'sangle-cassee'), makeRNG(1));
    expect(abime.riderTest!.base).toBe(sain.riderTest!.base - 20);
  });

  it('Boiteux / Patte brisée : pas de Test cavalier, état posé', () => {
    const b = resolveMountIncident(entry('boiteux'), mountOf('poney'), makeRNG(1));
    expect(b.injury).toBe('boiteux');
    expect(b.riderTest).toBeUndefined();
    const p = resolveMountIncident(entry('patte-brisee'), mountOf('poney'), makeRNG(1));
    expect(p.injury).toBe('patte-brisee');
  });

  it('le JOURNAL dit la séquelle ET sa portée : pénalité + condition de fin, allure imposée + fin, issue de la bête', () => {
    // Ce que le joueur DOIT continuer de lire (EDOC 07 l.157-174, verbatim des entrées) : le −20 « jusqu'à
    // ce que la partie abîmée soit réparée », le pas « jusqu'à ce que le fer ait été remplacé par un
    // maréchal-ferrant », et la gravité d'une patte brisée. Ces fragments sont AUTHORÉS sur l'entrée.
    const sangle = resolveMountIncident(entry('sangle-cassee'), mountOf('cheval-de-monte'), makeRNG(3)).lines.join('\n');
    expect(sangle).toContain('-20 aux Tests de Chevaucher');
    expect(sangle).toContain('jusqu’à réparation de la sellerie'.replace('’', "'"));

    const fer = resolveMountIncident(entry('perte-d-un-fer'), mountOf('poney'), makeRNG(5)).lines.join('\n');
    expect(fer).toContain('ne peut plus aller qu’au pas');
    expect(fer).toContain('maréchal-ferrant');

    const boiteux = resolveMountIncident(entry('boiteux'), mountOf('poney'), makeRNG(1)).lines.join('\n');
    expect(boiteux).toContain('ne peut plus être montée ni attelée');

    const patte = resolveMountIncident(entry('patte-brisee'), mountOf('poney'), makeRNG(1)).lines.join('\n');
    expect(patte).toContain('Fracture (Majeure)');
    expect(patte).toContain('peu d’espoir'.replace('’', "'"));
    expect(patte).toContain('soins d’une halte');
  });
});

describe('resolveMountedDay — sur-endurance (EDOC 07 l.146)', () => {
  it('dans l’endurance de l’allure : aucune fatigue, aucun incident', () => {
    const outs = resolveMountedDay([mountOf('cheval-de-monte')], 2, 'galop', makeRNG(1)); // galop = ½ BE = 2 h
    expect(outs[0].overHours).toBe(0);
    expect(outs[0].extenue).toBe(0);
    expect(outs[0].tests.length).toBe(0);
    expect(outs[0].incidents.length).toBe(0);
  });

  it('au-delà : +1 Exténué et un Test de Résistance PAR heure supplémentaire', () => {
    // Palefroi (BE 4) au trot 6 h → 2 heures au-delà de l'endurance.
    const outs = resolveMountedDay([mountOf('cheval-de-monte')], 6, 'trot', makeRNG(2));
    const o = outs[0];
    expect(o.overHours).toBeCloseTo(2);
    expect(o.extenue).toBeGreaterThanOrEqual(2);
    expect(o.tests.length).toBeGreaterThanOrEqual(1);
    // Chaque échec de Résistance a produit un Incident de monte (l.146).
    const failures = o.tests.filter((t) => t.label.startsWith('Résistance (') && !t.label.includes('effondrement') && !t.success).length;
    expect(o.incidents.length).toBe(failures);
  });

  it('endurance comptée sur le JOUR calendaire (#340) : deux trajets 3 h+3 h au trot (BE 4) → sur-endurance au 2ᵉ', () => {
    // Palefroi (BE 4) : endurance trot = 4 h. 3 h seules restent dans l'endurance ; un 2ᵉ trajet de 3 h le
    // MÊME jour (priorHours = 3) porte le cumul à 6 h → 2 h de sur-endurance testées, comme un seul jour de 6 h.
    const seg1 = resolveMountedDay([mountOf('cheval-de-monte')], 3, 'trot', makeRNG(2), 0)[0];
    expect(seg1.overHours).toBe(0);
    expect(seg1.tests.length).toBe(0);
    const seg2 = resolveMountedDay([mountOf('cheval-de-monte')], 3, 'trot', makeRNG(2), 3)[0];
    expect(seg2.overHours).toBeCloseTo(2);
    expect(seg2.tests.length).toBeGreaterThanOrEqual(1);
  });

  it('Exténué > BE : la bête s’effondre (Sonné + À Terre) puis Test de Résistance sans modificateur', () => {
    // Chien de trait (E 20, BE 2 — EDOC 07 folio 22) au galop (endurance 1 h) poussé 6 h : effondrement garanti (Exténué 3 > 2 au
    // plus tard à la 2e heure supplémentaire), sauf Boiteux/Patte brisée qui stoppe la journée avant.
    let collapsedSeen = false;
    for (let seed = 1; seed <= 12 && !collapsedSeen; seed++) {
      const o = resolveMountedDay([mountOf('chien-de-trait')], 6, 'galop', makeRNG(seed))[0];
      if (o.collapsed) {
        collapsedSeen = true;
        const last = o.tests[o.tests.length - 1];
        expect(last.label).toContain('effondrement');
        expect(last.base).toBe(20); // « sans aucun modificateur » : E pleine, pas de malus d'Exténué
        if (!last.success) expect(o.dead).toBe(true);
      } else {
        // journée stoppée par une bête qui ne peut plus être montée
        expect(o.incidents.some((i) => i.injury === 'boiteux' || i.injury === 'patte-brisee')).toBe(true);
      }
    }
    expect(collapsedSeen).toBe(true);
  });
});
