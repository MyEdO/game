import { describe, it, expect } from 'vitest';
import type { RNG } from './dice';
import { createHero } from './character';
import { makeRNG } from './dice';
import { difficultyFromModifier } from './tests';
import { RULE_REF } from './ruleRefs';
import {
  rollRiverWind, tickRiverWind, riverWindEffect, savoirVoiesFluvialesBonus, riverPilotSkill,
  riverControlKept, rowingAgilityFactor, riverDayKm, riverDriftKm, navPenaltyMods,
  capsizeRightDifficulty, capsizeRightCumulative, capsizeSinkTurns, holeSinkMinutes,
  riverCritical, resolveRiverImpact, rollBarrage, echouageDamage, findRiverPeril, RIVER_PERILS,
} from './riverNavigation';
import { rollShipCritical } from './shipCritical';
import { RIVER_CRIT_SET } from '../data/shipCriticals';

/**
 * NAVIGATION FLUVIALE — couche PURE de MSRC 7 (« Navigation fluviale »). Tables VERBATIM du chapitre,
 * jets déterministes (RNG injecté). Chaque assertion cite la ligne source.
 */

/** RNG constant : renvoie toujours la borne haute (d100 → 100, d10 → 10) ou basse (→ 1). */
const hi: RNG = { int: (_min, max) => max };
const lo: RNG = { int: (min) => min };

describe('Table des vents (MSRC 7 l.21-33)', () => {
  it('force + direction tirées sur 1d10 chacun (bandes VERBATIM)', () => {
    expect(rollRiverWind(lo)).toEqual({ force: 'calme', dir: 'arriere' }); // d10=1 → Calme / Vent arrière
    expect(rollRiverWind(hi)).toEqual({ force: 'tres-fort', dir: 'contraire' }); // d10=10 → Très fort / contraire
  });

  it('effet du vent (%) — colonnes VERBATIM du Tableau des vents (l.29-33)', () => {
    expect(riverWindEffect('leger', 'arriere')).toEqual({ pct: 5 });
    expect(riverWindEffect('leger', 'contraire')).toEqual({ pct: -5 });
    expect(riverWindEffect('modere', 'cote')).toEqual({ pct: 5, tack: true }); // note 3 : louvoyer
    expect(riverWindEffect('fort', 'arriere')).toEqual({ pct: 20 });
    expect(riverWindEffect('calme', 'arriere')).toEqual({ drift: true }); // note 2 : Dérive
    expect(riverWindEffect('tres-fort', 'cote')).toEqual({ capsizeRisk: true }); // note 4 : chavirage
    expect(riverWindEffect('tres-fort', 'contraire')).toEqual({ pct: -25, riggingRisk: true }); // note 5
  });

  it('la force change d\'un cran sur un 1 (bornes : Calme→Léger, Très fort→Fort)', () => {
    // hi : d10=10 ≠ 1 → aucun changement.
    expect(tickRiverWind('modere', hi)).toBe('modere');
    // lo : d10=1 (== seuil), puis d10=1 ≤ 5 → forcir ; Calme ne peut que devenir Léger.
    expect(tickRiverWind('calme', lo)).toBe('leger');
    // Très fort borné : lo forcirait, mais Très fort ne peut que devenir Fort (l.21).
    expect(tickRiverWind('tres-fort', lo)).toBe('fort');
  });
});

describe('Navigation & rame (l.11-17)', () => {
  it('Savoir (Voies fluviales) → +1 DR si la Compétence est ACQUISE (avances > 0), sinon 0 (l.13)', () => {
    const h = createHero({ speciesId: 'humains-reiklander', careerId: 'batelier', label: 'B', motivation: 'x', seed: 1 });
    expect(savoirVoiesFluvialesBonus(h)).toBe(0);
    h.skills.push({ id: 'savoir', spec: 'voies-fluviales', characteristic: 'intelligence', advances: 10 });
    expect(savoirVoiesFluvialesBonus(h)).toBe(1);
  });

  it('embarcation : Voile si voilure, sinon Ramer — barque (l.11-13)', () => {
    expect(riverPilotSkill(true)).toBe('voile');
    expect(riverPilotSkill(false)).toBe('ramer');
  });

  it('contrôle gardé : réussite TOUJOURS ; échec de peu rattrapé par Savoir +1 DR (l.13)', () => {
    expect(riverControlKept(true, -5, 0)).toBe(true); // une réussite garde le cap
    expect(riverControlKept(false, -1, 1)).toBe(true); // échec −1 DR + Savoir +1 = 0 → rattrapé
    expect(riverControlKept(false, -1, 0)).toBe(false); // sans Savoir → contrôle perdu
    expect(riverControlKept(false, -5, 1)).toBe(false); // trop loin (−5 + 1 = −4) → perdu
  });

  it('Test d\'Agilité de rame : réussite = 1 ; échec = 0,8 (−20 %) ; Échec spectaculaire (−6 DR) = 0,5 (÷2) (l.17)', () => {
    expect(rowingAgilityFactor(true, 3)).toBe(1);
    expect(rowingAgilityFactor(false, -2)).toBeCloseTo(0.8);
    expect(rowingAgilityFactor(false, -6)).toBe(0.5);
    expect(rowingAgilityFactor(false, -7)).toBe(0.5);
  });

  it('km du jour = base × (1 + vent %) × Agilité ; dérive = 25 % de la base (l.29-33, note 2)', () => {
    expect(riverDayKm(48, 25, 1)).toBe(60); // vent arrière +25 %
    expect(riverDayKm(48, -25, 1)).toBe(36); // vent contraire −25 %
    expect(riverDayKm(48, 0, 0.8)).toBeCloseTo(38.4); // Agilité ratée
    expect(riverDriftKm(48)).toBe(12); // 25 %
  });

  it('les malus de Navigation sont des MODIFICATEURS NOMMÉS, pas des Difficultés (l.38 dérive −10, l.41 hors de contrôle −20)', () => {
    expect(navPenaltyMods({})).toEqual([]);
    // Chaque malus PORTE sa fiche de règle (#1117 L5b) : la chip s'ouvre sur la note du Tableau des Vents.
    expect(navPenaltyMods({ drift: true })).toEqual([{ label: 'Dérive', value: -10, famille: 'jet', ref: RULE_REF['navigation-derive'] }]);
    expect(navPenaltyMods({ outOfControl: true })).toEqual([{ label: 'Hors de contrôle', value: -20, famille: 'jet', ref: RULE_REF['navigation-greement'] }]);
    expect(navPenaltyMods({ drift: true, outOfControl: true }).reduce((s, m) => s + m.value, 0)).toBe(-30);
    expect(difficultyFromModifier(20)).toBe('accessible');
  });

  it('renflouage à l\'échouage (l.99) : Test de Force malus = Enc du bateau → cran de difficulté', () => {
    // « un Test de Force avec un malus égal au nombre total de Points d'Encombrement du bateau » (l.99).
    // Le malus (−Enc) se compose en difficulté par le MÊME helper que les malus de Navigation (crans de 10).
    expect(difficultyFromModifier(-6)).toBe('complexe'); // coracle Enc 6 → −6 ≈ −10 (Complexe)
    expect(difficultyFromModifier(-25)).toBe('difficile'); // barque Enc 25 → −25 ≈ −20 (Difficile)
    expect(difficultyFromModifier(0)).toBe('intermediaire'); // Enc inconnu (barge LDB) → pas de malus
  });
});

describe('Chavirage & naufrage (note 4 l.40 ; l.101-103)', () => {
  it('redressement : la cible du 1ᵉʳ Round est la Navigation Accessible (+20), sans malus', () => {
    expect(capsizeRightDifficulty()).toBe('accessible');
  });

  it('chaque Round échoué ajoute −5 à la cible du suivant (note 4, l.40)', () => {
    expect(capsizeRightCumulative()).toBe(-5);
  });

  it('temporisation du naufrage : chavirage = BE tours ; coque percée = E minutes (l.40 / l.103)', () => {
    expect(capsizeSinkTurns(45)).toBe(4); // Bonus d'Endurance de 45
    expect(holeSinkMinutes(45)).toBe(45); // « un nombre de minutes égal à son Endurance »
  });
});

describe('Critiques de bateau (l.72-94)', () => {
  it('la vue « voyage » ne rend QUE ce que la COQUE encaisse : dérive (gréement l.78), percée (coque l.90)', () => {
    expect(riverCritical('greement')).toEqual({ driftUntilRepair: true });
    expect(riverCritical('coque')).toEqual({ hole: true });
  });

  /** Ce que le coup fait à l'ÉQUIPAGE ne se DÉRIVE plus ici (#1657 B3-2) : voyage et combat lisent la
   *  MÊME source par le MÊME résolveur (`rollShipCritical` → nœud `test` rendu à la porte). Une
   *  seconde dérivation qui renaîtrait ici rendrait de nouveau DEUX régimes de jet pour un fait RAW. */
  it('AUCUNE conséquence d’équipage ne s’y dérive — le nœud vit dans la donnée, lu par le résolveur unique', () => {
    for (const loc of ['greement', 'avirons', 'gouvernail', 'coque', 'superstructure']) {
      expect(
        Object.keys(riverCritical(loc) ?? {}).filter((k) => !['driftUntilRepair', 'hole'].includes(k)),
        `${loc} : une clé d’équipage est revenue dans la vue voyage`,
      ).toEqual([]);
    }
    expect(rollShipCritical('greement', makeRNG(1), 1, RIVER_CRIT_SET).crewHit?.test?.test.characteristic).toBe('initiative');
  });
});

describe('Dangers de rivière (l.119-166)', () => {
  it('les quatre périls du chapitre sont chargés (débris/barrage/rochers/eaux peu profondes)', () => {
    expect(RIVER_PERILS.map((p) => p.id).sort()).toEqual(['barrage', 'debris', 'eaux-peu-profondes', 'rochers']);
    expect(findRiverPeril('debris')?.onFail).toEqual({ hullHits: 2, damagePerHit: 10 }); // l.125
  });

  it('impact sur rochers (l.140) : +15 Dégâts, 50 % percée, 20 % échouage', () => {
    const onHit = findRiverPeril('rochers')!.onHit!;
    expect(resolveRiverImpact(onHit, lo)).toEqual({ hullDamage: 15, holed: true, echoue: true }); // d100=1 ≤ 50 et ≤ 20
    expect(resolveRiverImpact(onHit, hi)).toEqual({ hullDamage: 15, holed: false, echoue: false }); // d100=100
  });

  it('barrage : Endurance 1d10 × 10, 2d10 Blessures (l.128) ; échouage = 12 Dégâts (l.99)', () => {
    const obs = findRiverPeril('barrage')!.obstacle!;
    expect(rollBarrage(obs, lo)).toEqual({ endurance: 10, wounds: 2 });
    expect(rollBarrage(obs, hi)).toEqual({ endurance: 100, wounds: 20 });
    expect(echouageDamage()).toBe(12);
  });
});
