import { describe, it, expect } from 'vitest';
import { attackModifiers, defenseModifiers, baseTestMods } from './combat';
import { weatherTestMods } from './weatherTestMod';
import { Combatant, Weapon, type ModLine } from './types';

/**
 * CONFORMANCE TRANSVERSALE du canal météo « Tests physiques » (EDOC 8 l.82, #341). LE test qui aurait
 * attrapé le trou de la DÉFENSE (et de l'Empoignade) AVANT l'audit : il déroule LA MÊME condition (pluie
 * diluvienne) sur les QUATRE familles de Test physique — ATTAQUE (CC/CT), DÉFENSE (Parade→CC / Esquive→Ag),
 * ACTIVITÉ de voyage (carac de la compétence), FORCE brute (Empoignade) — et exige que le −10 arrive dans
 * les quatre via LE MÊME canal (`weatherTestMods`, lu depuis `Combatant.envWeather`). Si l'Empoignade
 * l'obtient GRATUITEMENT (sans câblage propre), le canal est au bon étage. `pluie` simple → RIEN partout ;
 * pas de double-compte à l'attaque.
 */
const mk = (over: Partial<Combatant> = {}): Combatant =>
  ({
    id: 'x', name: 'X', kind: 'enemy',
    characteristics: { 'capacite-de-combat': 50, 'capacite-de-tir': 50, force: 30, endurance: 30, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], weapons: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, skills: [], talents: [], movement: 4,
    ...over,
  }) as unknown as Combatant;

const sword: Weapon = { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] };
const bow: Weapon = { label: 'Arc', type: 'ranged', damage: { plusBF: false, flat: 8 }, range: 60, qualities: [] };
const DELUGE = 'pluie-diluvienne';
const METEO = (mods: ModLine[]) => mods.filter((m) => m.ref?.category === 'weatherConditions');

describe('#341 — canal météo « Tests physiques » : les 4 familles traversent LE MÊME canal', () => {
  it('pluie diluvienne → −10 à l’ATTAQUE (CC en mêlée, CT au tir), une seule ligne', () => {
    const melee = METEO(attackModifiers(mk({ envWeather: DELUGE }), mk(), sword, { kind: 'melee' }));
    expect(melee).toHaveLength(1); // pas de double-compte
    expect(melee[0].value).toBe(-10);
    const ranged = METEO(attackModifiers(mk({ envWeather: DELUGE }), mk(), bow, { kind: 'ranged', distanceTiles: 5 }));
    expect(ranged.map((m) => m.value)).toEqual([-10]);
  });

  it('pluie diluvienne → −10 à la DÉFENSE, Parade (CC) ET Esquive (Agilité)', () => {
    const d = mk({ envWeather: DELUGE, weapons: [sword] });
    expect(METEO(defenseModifiers(d, 'parade', [], sword)).map((m) => m.value)).toEqual([-10]);
    expect(METEO(defenseModifiers(d, 'esquive')).map((m) => m.value)).toEqual([-10]);
  });

  it('pluie diluvienne → −10 à une ACTIVITÉ de voyage physique (carac de la compétence)', () => {
    // La rangée d'Activité passe SA carac au même canal (ici Agilité, physique) → −10.
    expect(weatherTestMods(DELUGE, 'agilite').map((m) => m.value)).toEqual([-10]);
    expect(weatherTestMods(DELUGE, 'sociabilite')).toEqual([]); // carac NON physique → rien
  });

  it('pluie diluvienne → −10 à l’EMPOIGNADE (Force brute) GRATUITEMENT via baseTestMods', () => {
    const grappler = mk({ envWeather: DELUGE });
    expect(baseTestMods(grappler, 'force')).toBe(baseTestMods(mk({ envWeather: undefined }), 'force') - 10);
    // Désengagement / coup dans le dos (CC brut) : même canal.
    expect(baseTestMods(mk({ envWeather: DELUGE }), 'capacite-de-combat')).toBe(-10);
  });

  it('pluie SIMPLE → aucune pénalité « Tests physiques » nulle part (attaque/défense/force)', () => {
    expect(METEO(attackModifiers(mk({ envWeather: 'pluie' }), mk(), sword, { kind: 'melee' }))).toEqual([]);
    expect(METEO(defenseModifiers(mk({ envWeather: 'pluie', weapons: [sword] }), 'esquive'))).toEqual([]);
    expect(baseTestMods(mk({ envWeather: 'pluie' }), 'force')).toBe(0);
    expect(weatherTestMods('pluie', 'agilite')).toEqual([]);
  });
});

describe('#2724 — le canal est la seule porte de weatherTestMod.ts', () => {
  it('le module n’exporte que weatherTestMods ; le calcul brut ne se nomme pas au type', async () => {
    // @ts-expect-error TS2339
    type Brut = (typeof import('./weatherTestMod'))['weatherPhysicalTestMod'];
    const brut: Brut | undefined = undefined;
    expect(Object.keys(await import('./weatherTestMod'))).toEqual(['weatherTestMods']);
    expect(brut).toBeUndefined();
  });
});
