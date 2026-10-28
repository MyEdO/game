import { describe, it, expect } from 'vitest';
import { creatureAttacks, souffleDuType } from './creatureAttacks';
import { findManeuverById } from '../data';
import { difficulteDeLArg } from './tests';
import type { TraitInstance } from './statEntry';

const DRAGON: TraitInstance[] = [{ id: 'arme', value: 10 }, { id: 'armure', value: 5 }, { id: 'attaque-caudale', value: 9 }, { id: 'morsure', value: 10 }, { id: 'souffle', value: 15, arg: 'feu' }, { id: 'taille', arg: 'Énorme' }, { id: 'vol', value: 80 }];
const by = (ts: TraitInstance[], k: string) => creatureAttacks(ts).find((a) => a.kind === k)!;

describe('creatureAttacks — attaques + RÈGLES dérivées des traits (RAW)', () => {
  it('le Dragon a Arme, Attaque caudale, Morsure, Souffle (ordre des traits)', () => {
    expect(creatureAttacks(DRAGON).map((a) => a.kind)).toEqual(['arme', 'caudale', 'morsure', 'souffle']);
  });
  it('extrait l’Indice de Dégâts (+N)', () => {
    expect(by(DRAGON, 'morsure').bonus).toBe(10);
    expect(by(DRAGON, 'caudale').bonus).toBe(9);
    expect(by(DRAGON, 'souffle').bonus).toBe(15);
  });

  it('Arme = action normale, sans coût d’Avantage', () => {
    const a = by(DRAGON, 'arme');
    expect(a.trigger).toBe('action');
    expect(a.avantage).toBe(0);
  });
  it('Morsure = Attaque gratuite à 1 Avantage', () => {
    const a = by(DRAGON, 'morsure');
    expect(a.trigger).toBe('free');
    expect(a.avantage).toBe(1);
  });
  it('Attaque caudale = gratuite 1 Avantage (À Terre sur cible plus petite = effet onHit migré)', () => {
    const a = by(DRAGON, 'caudale');
    expect([a.trigger, a.avantage]).toEqual(['free', 1]);
  });
  it('Cornes = Attaque gratuite à la CHARGE (pas de coût d’Avantage)', () => {
    const a = by([{ id: 'cornes', value: 7 }], 'cornes');
    expect([a.trigger, a.avantage]).toEqual(['charge', 0]);
  });
  it('Souffle = gratuite 2 Avantages, zone, magique, Type lu', () => {
    const a = by(DRAGON, 'souffle');
    expect([a.trigger, a.avantage, a.aoe, a.magic, a.type]).toEqual(['free', 2, true, true, 'feu']);
  });
  it('Souffle « (divers) » → Type non spécifié', () => {
    expect(by([{ id: 'souffle', value: 12, arg: 'divers' }], 'souffle').type).toBeUndefined();
  });
  it('le trait octroie la manœuvre PAR ID (grantsManeuvers → findManeuverById) ; le Type de Souffle la compose', () => {
    expect(by(DRAGON, 'souffle').def).toEqual(souffleDuType(findManeuverById('souffle')!, 'feu'));
    expect(by([{ id: 'souffle', value: 10, arg: 'poison', difficulte: 'difficile' }], 'souffle').def).toEqual(souffleDuType(findManeuverById('souffle')!, 'poison', 'difficile'));
    // L'Indice de l'instance est porté (injecté en {indiceOf}).
    const m = by([{ id: 'morsure', value: 10 }], 'morsure');
    expect([m.def.id, m.indice]).toEqual(['morsure', 10]);
  });
  it('l’attaque porte les Traits que son Trait confère (ZI 03 l.77)', () => {
    expect(by([{ id: 'attaque-caudale', value: 12, confere: [{ id: 'venin' }] }], 'caudale').confere).toEqual([{ id: 'venin' }]);
    expect(by([{ id: 'attaque-caudale', value: 12 }], 'caudale').confere).toBeUndefined();
  });
  it('Tentacules = une Attaque gratuite PAR tentacule, sans coût d’Avantage (Empêtré = effet onHit migré)', () => {
    const a = by([{ id: 'tentacules', value: 6 }], 'tentacules');
    expect([a.trigger, a.avantage, a.perTentacle]).toEqual(['free', 0, true]);
  });
  it('« 8 Tentacules +9 » (Pieuvre des tourbières) : compte en tête lu, Indice non avalé', () => {
    const a = by([{ id: 'tentacules', count: 8, value: 9 }], 'tentacules');
    expect([a.count, a.bonus, a.avantage]).toEqual([8, 9, 0]);
  });
  it('Étreinte glaciale = 2 Avantages + Action, magique', () => {
    const a = by([{ id: 'etreinte-glaciale' }], 'etreinte');
    expect([a.trigger, a.avantage, a.magic]).toEqual(['action', 2, true]);
  });

  it('le Venin n’est PAS une attaque (Atout de la Morsure)', () => {
    expect(creatureAttacks([{ id: 'venin', arg: 'difficile' }, { id: 'morsure', value: 8 }]).map((a) => a.kind)).toEqual(['morsure']);
  });
  it('difficulteDeLArg : la Difficulté du Venin se lit à l’id de son arg (LDB 85 l.423) ; un arg qui n’en désigne aucune vaut `DIFFICULTE_PAR_DEFAUT`', () => {
    expect(difficulteDeLArg('difficile')).toBe('difficile');
    expect(difficulteDeLArg('tresDifficile')).toBe('tresDifficile');
    expect(difficulteDeLArg('facile')).toBe('facile');
    expect(difficulteDeLArg('Difficile')).toBe('intermediaire');
    expect(difficulteDeLArg('de Très Facile à Très Difficile')).toBe('intermediaire');
  });
  it('ignore les traits non-attaque (Armure, Taille, Vol…)', () => {
    expect(creatureAttacks([{ id: 'armure', value: 3 }, { id: 'taille', arg: 'Grande' }, { id: 'vision-nocturne' }])).toEqual([]);
  });
});
