/**
 * Voyage par Étapes (EDOC 8) — fonctions PURES.
 * Vérifie : nombre d'Étapes (l.34) ± bonus, table de Météo VERBATIM seedée (l.44-51), difficulté
 * d'Exposition selon l'équipement (l.73), rendement d'Approvisionnement (LDB 09 l.568-572), saisons.
 */
import { describe, it, expect } from 'vitest';
import { makeRNG } from './dice';
import {
  seasonOfMonth, isColdSeason,
  weatherFromRoll, rollStageWeather, weatherRanges,
  stageCount, stageExposureDifficulty, forageYield,
  weatherRangedMod, weatherRangedUseless, weatherPowderUseless, weatherVisibiliteM,
  weatherMovementWalkOnly, weatherResistanceTest, weatherLightningNervous,
  type Season,
} from './travelStages';
import { activityById } from './activities';
import { weatherTestMods } from './weatherTestMod';
import { setRule, resetRule } from './policy';
import { setDataset } from '../data/overrides';
import { weather } from '../data';

describe('seasonOfMonth (calendrier impérial → table de Météo)', () => {
  it('Jahrdrung/Pflugzeit/Sigmarzeit = printemps ; Sommerzeit = été ; Erntezeit = automne ; Vorhexen/Nachhexen = hiver', () => {
    expect(seasonOfMonth(1)).toBe('printemps'); // Jahrdrung (départ EiS)
    expect(seasonOfMonth(2)).toBe('printemps'); // Pflugzeit
    expect(seasonOfMonth(3)).toBe('printemps'); // Sigmarzeit
    expect(seasonOfMonth(4)).toBe('ete'); // Sommerzeit
    expect(seasonOfMonth(7)).toBe('automne'); // Erntezeit
    expect(seasonOfMonth(10)).toBe('hiver'); // Ulriczeit
    expect(seasonOfMonth(11)).toBe('hiver'); // Vorhexen
    expect(seasonOfMonth(0)).toBe('hiver'); // Nachhexen
  });
  it('jour intercalaire (month null) → printemps par défaut', () => {
    expect(seasonOfMonth(null)).toBe('printemps');
  });
  it('saisons froides (rhume, l.75) = printemps + hiver', () => {
    expect(isColdSeason('printemps')).toBe(true);
    expect(isColdSeason('hiver')).toBe(true);
    expect(isColdSeason('ete')).toBe(false);
    expect(isColdSeason('automne')).toBe(false);
  });
});

describe('table de Météo VERBATIM (EDOC 8 l.50-59)', () => {
  // Plages bornes (max inclus) — lit la table telle que transcrite.
  it('printemps : 01-10 sec, 11-30 beau, 31-90 pluie, 91-95 diluvienne, 96-00 neige', () => {
    expect(weatherFromRoll(1, 'printemps')).toBe('sec');
    expect(weatherFromRoll(10, 'printemps')).toBe('sec');
    expect(weatherFromRoll(11, 'printemps')).toBe('beau');
    expect(weatherFromRoll(30, 'printemps')).toBe('beau');
    expect(weatherFromRoll(31, 'printemps')).toBe('pluie');
    expect(weatherFromRoll(90, 'printemps')).toBe('pluie');
    expect(weatherFromRoll(91, 'printemps')).toBe('pluie-diluvienne');
    expect(weatherFromRoll(95, 'printemps')).toBe('pluie-diluvienne');
    expect(weatherFromRoll(96, 'printemps')).toBe('neige');
    expect(weatherFromRoll(100, 'printemps')).toBe('neige');
  });
  it('été : pas de neige ni blizzard (01-40 sec, 41-70 beau, 71-95 pluie, 96-00 diluvienne)', () => {
    expect(weatherFromRoll(40, 'ete')).toBe('sec');
    expect(weatherFromRoll(70, 'ete')).toBe('beau');
    expect(weatherFromRoll(95, 'ete')).toBe('pluie');
    expect(weatherFromRoll(96, 'ete')).toBe('pluie-diluvienne');
    expect(weatherFromRoll(100, 'ete')).toBe('pluie-diluvienne');
    const weathers = weatherRanges('ete').map((r) => r.weather);
    expect(weathers).not.toContain('neige');
    expect(weathers).not.toContain('blizzard');
  });
  it('automne : 01-30 sec, 31-60 beau, 61-90 pluie, 91-98 diluvienne, 99-00 neige', () => {
    expect(weatherFromRoll(30, 'automne')).toBe('sec');
    expect(weatherFromRoll(60, 'automne')).toBe('beau');
    expect(weatherFromRoll(90, 'automne')).toBe('pluie');
    expect(weatherFromRoll(98, 'automne')).toBe('pluie-diluvienne');
    expect(weatherFromRoll(99, 'automne')).toBe('neige');
    expect(weatherFromRoll(100, 'automne')).toBe('neige');
  });
  it('hiver : pas de temps sec (01-10 beau, 11-60 pluie, 61-65 diluvienne, 66-90 neige, 91-00 blizzard)', () => {
    expect(weatherFromRoll(10, 'hiver')).toBe('beau');
    expect(weatherFromRoll(60, 'hiver')).toBe('pluie');
    expect(weatherFromRoll(65, 'hiver')).toBe('pluie-diluvienne');
    expect(weatherFromRoll(90, 'hiver')).toBe('neige');
    expect(weatherFromRoll(91, 'hiver')).toBe('blizzard');
    expect(weatherFromRoll(100, 'hiver')).toBe('blizzard');
    expect(weatherRanges('hiver').map((r) => r.weather)).not.toContain('sec');
  });
  it('édition LIVE au Codex : éditer la météo (setDataset) change le tirage', () => {
    const orig = weather.map((s) => ({ ...s, ranges: s.ranges.map((r) => ({ ...r })) }));
    setDataset('weather', weather.map((s) => (s.id === 'printemps' ? { ...s, ranges: [{ min: 1, max: 100, weather: 'blizzard' }] } : s)));
    expect(weatherFromRoll(50, 'printemps')).toBe('blizzard'); // lecture LIVE de la donnée éditée
    setDataset('weather', orig); // restaurer pour l'isolation des autres tests
    expect(weatherFromRoll(50, 'printemps')).not.toBe('blizzard');
  });
  it('l’ORDRE des rangées ne décide plus du tirage : une saison réordonnée au Codex rend la MÊME météo', () => {
    // Le verrou de la migration #1463 L4 P2. Tant que la table n'avait que sa borne HAUTE, le lookup
    // était un `for (…) if (roll <= r.max)` : la borne basse était la position, donc réorganiser deux
    // rangées au Codex changeait la météo tirée SANS UN MOT. Les deux bornes étant en donnée
    // (EDOC 08 l.52-59) et le lookup étant `findTableEntry` (borné des DEUX côtés), l'ordre est inerte.
    const seasons: Season[] = ['printemps', 'ete', 'automne', 'hiver'];
    const orig = weather.map((s) => ({ ...s, ranges: s.ranges.map((r) => ({ ...r })) }));
    const avant = seasons.map((s) => Array.from({ length: 100 }, (_, i) => weatherFromRoll(i + 1, s)));
    // Réordonnement réel : les rangées de chaque saison à l'ENVERS.
    setDataset('weather', orig.map((s) => ({ ...s, ranges: [...s.ranges].reverse() })));
    const apres = seasons.map((s) => Array.from({ length: 100 }, (_, i) => weatherFromRoll(i + 1, s)));
    setDataset('weather', orig);
    expect(apres, 'le tirage dépend encore de l’ORDRE des rangées — la borne basse est reconstruite par position quelque part.').toEqual(avant);
  });
  it('chaque saison couvre le d100 EXACTEMENT une fois — aucun trou, aucun chevauchement', () => {
    // Contrat STRUCTUREL sur les fourchettes, PAS un aller-retour par `weatherFromRoll` : celui-ci
    // passe par `findTableEntry`, qui REPLIE sur la dernière rangée quand aucune ne couvre le jet —
    // il rend donc une météo même sur une table trouée, et un `toBeTruthy()` reste vert. Ce qu'on
    // mesure ici est la partition : chaque jet de 1 à 100 appartient à UNE fourchette et une seule.
    const seasons: Season[] = ['printemps', 'ete', 'automne', 'hiver'];
    for (const s of seasons) {
      const ranges = weatherRanges(s);
      const fautifs = Array.from({ length: 100 }, (_, i) => i + 1)
        .map((jet) => ({ jet, couvert: ranges.filter((r) => jet >= r.min && jet <= r.max).length }))
        .filter((c) => c.couvert !== 1);
      expect(fautifs, `saison ${s} : des jets couverts 0 fois (trou) ou 2 fois (chevauchement)`).toEqual([]);
    }
  });
  it('rollStageWeather : déterministe sous une graine, et cohérent avec weatherFromRoll', () => {
    const rng = makeRNG(42);
    const a = rollStageWeather(rng, 'hiver');
    expect(a.roll).toBeGreaterThanOrEqual(1);
    expect(a.roll).toBeLessThanOrEqual(100);
    expect(a.weather).toBe(weatherFromRoll(a.roll, 'hiver'));
    // Même graine → même tirage (reproductible pour la coop/les tests).
    expect(rollStageWeather(makeRNG(42), 'hiver')).toEqual(rollStageWeather(makeRNG(42), 'hiver'));
  });
});

describe('stageCount (EDOC 8 l.40) — distance → Étapes ± bonus', () => {
  it('village proche (≤ 25 km) = 1 Étape', () => {
    expect(stageCount(10)).toBe(1);
    expect(stageCount(25)).toBe(1);
    expect(stageCount(0)).toBe(1); // minimum 1 (l.19/22)
  });
  it('ville à ville (26-150 km) = 2 à 4 Étapes', () => {
    expect(stageCount(26)).toBe(2);
    expect(stageCount(74)).toBe(2);
    expect(stageCount(75)).toBe(3);
    expect(stageCount(125)).toBe(4);
    expect(stageCount(150)).toBe(4); // plafonné à 4 (l.34 « entre 2 et 4 étapes »)
  });
  it('au-delà : +1 Étape par tranche de 50 km', () => {
    expect(stageCount(200)).toBe(5);
    expect(stageCount(250)).toBe(6);
  });
  it('bonus d’Étapes (règle travel-etapes-count-bonus) : +N additif', () => {
    expect(stageCount(10, 2)).toBe(3); // 1 + 2
    expect(stageCount(75, 3)).toBe(6); // 3 + 3
    expect(stageCount(10, 0)).toBe(1); // bonus 0 = inerte
  });
  it('bonus négatif ignoré (jamais < base)', () => {
    expect(stageCount(75, -3)).toBe(3);
  });
  it('sans paramètre, le bonus est LU sur la règle optionnelle `travel-etapes-count-bonus`', () => {
    expect(stageCount(10)).toBe(1); // défaut de la règle = 0
    setRule('travel-etapes-count-bonus', 2);
    expect(stageCount(10)).toBe(3); // 1 + 2 (EDOC 8 l.40 « augmentez le nombre d'Étapes de 2 ou plus »)
    resetRule('travel-etapes-count-bonus');
    expect(stageCount(10)).toBe(1);
  });
});

describe('stageCount — modificateur de Mouvement du groupe (EDOC 8 l.25)', () => {
  it('sans Mouvement de groupe fourni : aucun modificateur (comportement inchangé)', () => {
    expect(stageCount(75)).toBe(3);
  });
  it('Mouvement le plus faible ≤ 3 : +N Étapes (règle `travel-etapes-low-move-bonus`, défaut 1)', () => {
    expect(stageCount(75, 0, 3)).toBe(4); // 3 (base) + 1 (défaut de la règle)
    expect(stageCount(10, 0, 1)).toBe(2); // 1 (base) + 1
  });
  it('règle `travel-etapes-low-move-bonus` = 2 : +2 Étapes', () => {
    setRule('travel-etapes-low-move-bonus', 2);
    expect(stageCount(75, 0, 3)).toBe(5); // 3 + 2
    resetRule('travel-etapes-low-move-bonus');
  });
  it('Mouvement le plus faible entre 4 et 5 : aucun modificateur (ni bonus ni division)', () => {
    expect(stageCount(75, 0, 4)).toBe(3);
    expect(stageCount(75, 0, 5)).toBe(3);
  });
  it('TOUS les Personnages ont Mouvement ≥ 6 : nombre d’Étapes divisé par deux', () => {
    expect(stageCount(200, 0, 6)).toBe(2); // base 5 → 2 (floor)
    expect(stageCount(76, 0, 8)).toBe(1);  // base 3 → 1 (floor)
  });
  it('division par deux : minimum 1 (l.25 « résultat minimum de 1 »)', () => {
    expect(stageCount(10, 0, 6)).toBe(1); // base 1 → floor(0.5) = 0 → plancher 1
  });
  it('bonus d’Étapes (l.34) appliqué AVANT le modificateur de Mouvement (l.25)', () => {
    expect(stageCount(10, 2, 6)).toBe(1); // (1 + 2) = 3 → ÷2 = 1 (floor 1.5)
  });
});

describe('stageExposureDifficulty (EDOC 8 l.90) — difficulté du Test selon équipement', () => {
  it('beau temps / sec : aucun Test', () => {
    expect(stageExposureDifficulty('beau', false, false)).toBeNull();
    expect(stageExposureDifficulty('sec', false, false)).toBeNull();
  });
  it('pluie/neige bien équipé (manteau + tente) : aucun Test', () => {
    expect(stageExposureDifficulty('pluie', true, true)).toBeNull();
    expect(stageExposureDifficulty('neige', true, true)).toBeNull();
  });
  it('pluie/neige, un seul manquant → Complexe (-10) ; les deux → Difficile (-20)', () => {
    expect(stageExposureDifficulty('pluie', true, false)).toBe('complexe');
    expect(stageExposureDifficulty('pluie', false, true)).toBe('complexe');
    expect(stageExposureDifficulty('neige', false, false)).toBe('difficile');
  });
  it('averse (pluie diluvienne) / blizzard : Test TOUJOURS, même manteau + tente (l.73)', () => {
    expect(stageExposureDifficulty('pluie-diluvienne', true, true)).toBe('intermediaire');
    expect(stageExposureDifficulty('blizzard', true, true)).toBe('intermediaire');
    expect(stageExposureDifficulty('blizzard', true, false)).toBe('complexe');
    expect(stageExposureDifficulty('blizzard', false, false)).toBe('difficile');
  });
});

describe('modificateurs météo d’Activité — DONNÉE (ActivityDef.weatherMod, EDOC 8 l.141/l.68)', () => {
  it('Plein Air : -10 par degré de temps éloigné de Beau temps', () => {
    const wm = activityById('plein-air')!.weatherMod!;
    expect(wm.beau).toBe(0);
    expect(wm.pluie).toBe(-10);
    expect(wm.neige).toBe(-20);
    expect(wm.blizzard).toBe(-30);
  });
  it('Approvisionnement : -10 par temps sec (eau plus rare), 0 sinon', () => {
    const wm = activityById('approvisionnement')!.weatherMod!;
    expect(wm.sec).toBe(-10);
    expect(wm.beau).toBeUndefined();
    expect(wm.pluie).toBeUndefined();
  });
});

describe('effets météo TERRESTRES en DONNÉE (EDOC 8 « conditions »)', () => {
  it('Pluie : visibilité 25 m, tir -10, aucune poudre/mouvement/Résistance', () => {
    expect(weatherVisibiliteM('pluie')).toBe(25);
    expect(weatherRangedMod('pluie')).toBe(-10);
    expect(weatherPowderUseless('pluie')).toBe(false);
    expect(weatherMovementWalkOnly('pluie')).toBe(false);
    expect(weatherResistanceTest('pluie')).toBeUndefined();
  });
  it('Pluie diluvienne : visibilité ~0, tir -20, poudre morte, Tests physiques -10, éclairs Nerveux', () => {
    expect(weatherVisibiliteM('pluie-diluvienne')).toBe(0);
    expect(weatherRangedMod('pluie-diluvienne')).toBe(-20);
    expect(weatherPowderUseless('pluie-diluvienne')).toBe(true);
    expect(weatherLightningNervous('pluie-diluvienne')).toBe(true);
    expect(weatherTestMods('pluie-diluvienne', 'force').map((l) => l.value)).toEqual([-10]);
    expect(weatherTestMods('pluie-diluvienne', 'capacite-de-tir').map((l) => l.value)).toEqual([-10]);
    // I / FM / Soc ne sont PAS physiques (liste maison) → aucun malus.
    expect(weatherTestMods('pluie-diluvienne', 'intelligence').map((l) => l.value)).toEqual([]);
    expect(weatherTestMods('pluie-diluvienne', 'sociabilite').map((l) => l.value)).toEqual([]);
  });
  it('Neige : visibilité 45 m, marche seule, Résistance Accessible ou Exténué', () => {
    expect(weatherVisibiliteM('neige')).toBe(45);
    expect(weatherMovementWalkOnly('neige')).toBe(true);
    expect(weatherResistanceTest('neige')).toMatchObject({ difficulty: 'accessible', onFail: 'extenue' });
    expect(weatherResistanceTest('neige')?.enjeu).toContain('Résistance Accessible (+20)'); // enjeu verbatim EDOC 8 l.86
  });
  it('Blizzard : visibilité ~0, tir inutile, marche seule, Résistance Intermédiaire ou Exténué', () => {
    expect(weatherVisibiliteM('blizzard')).toBe(0);
    expect(weatherRangedUseless('blizzard')).toBe(true);
    expect(weatherMovementWalkOnly('blizzard')).toBe(true);
    expect(weatherResistanceTest('blizzard')).toMatchObject({ difficulty: 'intermediaire', onFail: 'extenue' });
    expect(weatherResistanceTest('blizzard')?.enjeu).toContain('Résistance Intermédiaire (+0)'); // enjeu verbatim EDOC 8 l.127
  });
  it('Temps sec / beau : aucun effet de combat/mouvement', () => {
    expect(weatherRangedMod('sec')).toBe(0);
    expect(weatherRangedMod('beau')).toBe(0);
    expect(weatherTestMods('pluie', 'force').map((l) => l.value)).toEqual([]);
  });
});

describe('forageYield (LDB 09 l.568-572)', () => {
  it('Recherche de nourriture : 1 + DR personnes nourries', () => {
    expect(forageYield(0, 'recherche')).toBe(1);
    expect(forageYield(2, 'recherche')).toBe(3);
  });
  it('Chasse / pêche : 2 + 2×DR', () => {
    expect(forageYield(0, 'chasse')).toBe(2);
    expect(forageYield(2, 'chasse')).toBe(6);
  });
  it('Piégeage : même rendement que la chasse', () => {
    expect(forageYield(3, 'piegeage')).toBe(forageYield(3, 'chasse'));
  });
  it('échec (DR < 0) : 0 ration', () => {
    expect(forageYield(-1, 'recherche')).toBe(0);
    expect(forageYield(-2, 'chasse')).toBe(0);
  });
  it('défaut = recherche', () => {
    expect(forageYield(1)).toBe(forageYield(1, 'recherche'));
  });
});
