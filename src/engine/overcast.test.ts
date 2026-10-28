/**
 * Surincantation — math PURE source-aware (RAW verbatim) :
 *  - Arcane  (LDB 47 l.13-17) : par +2 DR au-dessus du NI → +VALEUR INITIALE sur Portée/ZdE/Durée/Cible (×initial).
 *  - Miracle (LDB 42 l.7-13)  : par +2 DR (DR entier, pas de NI) → +initial Portée/Durée/Cible. Pas de ZdE.
 *  - Bénédiction (LDB 41 l.21-27) : par +2 DR → +6 m Portée / +1 Cible / +6 Rounds Durée (FIXE). Pas de ZdE.
 * Les exemples du livre sont encodés tels quels comme cas de test.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { setRule, resetRule } from './policy';
import { VDM_OVERCAST } from './overcast';
import {
  overcastSourceOf, overcastAxesFor, extraTargetCapacity,
  effectiveRangeMetres, overcastDurationParts, overcastStepCost,
  zoneDiameterMultiplier, missileOvercastDamageBonus,
} from './overcast';

describe('overcastSourceOf — dérivé de la famille du sort (aucun champ ajouté)', () => {
  it('beni → bénédiction ; invocation → miracle ; arcane/domaine/chaos → arcane', () => {
    expect(overcastSourceOf({ family: 'beni' })).toBe('blessing');
    expect(overcastSourceOf({ family: 'invocation' })).toBe('miracle');
    expect(overcastSourceOf({ family: 'arcane' })).toBe('arcane');
    expect(overcastSourceOf({ family: 'mineure' })).toBe('arcane');
    expect(overcastSourceOf({ family: 'feu' })).toBe('arcane');
    expect(overcastSourceOf({ family: 'chaos' })).toBe('arcane');
  });
});

/** Sort d'épreuve ouvert sur les quatre axes : Portée chiffrée, ZdE, Durée en Rounds. */
const ouvert = (family: string) => ({
  family, range: { kind: 'distance', value: 6, unit: 'm' }, target: { kind: 'area', span: 'diameter', meters: 4 },
  duration: { kind: 'rounds', value: 3 },
} as const);

describe('overcastAxesFor — ZdE réservée à l’arcane (`LDB 41 l.21-27`, `LDB 42 l.9-11`)', () => {
  it('arcane = Portée/ZdE/Durée ; divin = Portée/Durée', () => {
    expect(overcastAxesFor(ouvert('arcane'), false)).toEqual(['range', 'zone', 'duration']);
    expect(overcastAxesFor(ouvert('invocation'), false)).toEqual(['range', 'duration']);
    expect(overcastAxesFor(ouvert('beni'), false)).toEqual(['range', 'duration']);
  });
  it('l’axe Dégâts n’existe qu’au Projectile magique, sous VDM (`VDM 02 l.198`)', () => {
    const projectile = { ...ouvert('arcane'), target: { kind: 'count', n: 1 } } as const;
    expect(overcastAxesFor(projectile, true)).toEqual(['range', 'duration', 'targets']); // option OFF
    setRule('magic-vdm-incantation', true);
    expect(overcastAxesFor(projectile, true)).toEqual(['range', 'duration', 'targets', 'damage']);
    expect(overcastAxesFor(projectile, false)).toEqual(['range', 'duration', 'targets']);
    expect(overcastAxesFor({ ...projectile, family: 'invocation' }, true)).toEqual(['range', 'duration', 'targets']); // Miracle jamais VDM
    resetRule('magic-vdm-incantation');
  });
  it('« Vous » ferme Portée et Cibles, pas la ZdE centrée sur le lanceur (`LDB 47 l.15`)', () => {
    expect(overcastAxesFor({ ...ouvert('arcane'), range: { kind: 'self' } }, false)).toEqual(['zone', 'duration']);
  });
  it('Durée chiffrée (Rounds, horloge) seule prolongeable (`LDB 47 l.15`, `CRB 070 l.78`)', () => {
    const avec = (duration: object) => overcastAxesFor({ ...ouvert('arcane'), duration } as never, false).includes('duration');
    expect(avec({ kind: 'clock', value: 1, unit: 'hours' })).toBe(true);
    expect(avec({ kind: 'instant' })).toBe(false);
    expect(avec({ kind: 'special', text: 'Spécial' })).toBe(false);
  });
  it('Cible « Spécial » : aucune Cible ajoutée (`LDB 47 l.28`)', () => {
    expect(overcastAxesFor({ ...ouvert('arcane'), target: { kind: 'special', text: 'Spécial' } }, false)).toEqual(['range', 'duration']);
  });
});

describe('overcastStepCost — coût en DR d’un pas, dérivé du même overcastModel (VDM 02 l.196-201)', () => {
  it('LDB (option OFF) : 2 DR par pas ; VDM (option ON) : 1 DR par pas', () => {
    expect(overcastStepCost('arcane')).toBe(2);
    setRule('magic-vdm-incantation', true);
    expect(overcastStepCost('arcane')).toBe(1);
    resetRule('magic-vdm-incantation');
    expect(overcastStepCost('arcane')).toBe(2);
  });
  it('Bénédiction/Miracle ne sont jamais VDM : toujours 2 DR par pas', () => {
    setRule('magic-vdm-incantation', true);
    expect(overcastStepCost('blessing')).toBe(2);
    expect(overcastStepCost('miracle')).toBe(2);
    resetRule('magic-vdm-incantation');
  });
});

describe('extraTargetCapacity — cibles SUPPLÉMENTAIRES par pas', () => {
  it('arcane/miracle = pas × valeur initiale (×initial)', () => {
    // LDB 47 l.17 : +4 DR (2 pas) sur un Sort de Cible 1 → « cibler 3 individus » = 1 + 2 supplémentaires.
    expect(extraTargetCapacity('arcane', 2, 1)).toBe(2);
    // Sort arcane multi-cibles (initial 2) : 1 pas → +2 supplémentaires (×initial), PAS +1.
    expect(extraTargetCapacity('arcane', 1, 2)).toBe(2);
    expect(extraTargetCapacity('miracle', 2, 1)).toBe(2);
  });
  it('bénédiction = +1 par pas (FIXE), quelle que soit la cible initiale', () => {
    // LDB 41 l.27 : +4 DR (2 pas) sur Guérison → « guérir trois cibles » = 1 + 2.
    expect(extraTargetCapacity('blessing', 2, 1)).toBe(2);
    expect(extraTargetCapacity('blessing', 1, 3)).toBe(1); // +1 même si l'initiale vaut 3
  });
});

describe('overcastDurationParts — décomposition mult/bonus, SOURCE UNIQUE de la règle de Durée', () => {
  it('arcane/miracle : mult = 1+pas, bonus = 0 ; bénédiction : mult = 1, bonus = 6×pas', () => {
    expect(overcastDurationParts('arcane', 0)).toEqual({ mult: 1, bonusRounds: 0 });
    expect(overcastDurationParts('arcane', 2)).toEqual({ mult: 3, bonusRounds: 0 });
    expect(overcastDurationParts('miracle', 1)).toEqual({ mult: 2, bonusRounds: 0 });
    // Bénédiction : +6 Rounds FIXE par pas — diverge de ×initial dès que la base ≠ 6 (4 + 12 = 16, pas 12).
    expect(overcastDurationParts('blessing', 1)).toEqual({ mult: 1, bonusRounds: 6 });
    expect(overcastDurationParts('blessing', 2)).toEqual({ mult: 1, bonusRounds: 12 });
  });
});

describe('effectiveRangeMetres — ×initial (arcane/miracle) vs +6 m FIXE (bénédiction)', () => {
  it('arcane/miracle : base × (1 + pas)', () => {
    expect(effectiveRangeMetres('arcane', 50, 1)).toBe(100); // LDB 42 l.9 (miracle) : 50 m → +50 par +2 DR
    expect(effectiveRangeMetres('miracle', 50, 1)).toBe(100);
  });
  it('bénédiction : base + 6 m × pas (FIXE) — étend même une portée Contact (0 m)', () => {
    // LDB 41 l.27 : Guérison (Contact, 0 m) → « 1 cible jusqu’à 12 mètres » avec 2 pas de Portée.
    expect(effectiveRangeMetres('blessing', 0, 2)).toBe(12);
    expect(effectiveRangeMetres('blessing', 6, 1)).toBe(12);
  });
});

/**
 * TABLEAU DE SURINCANTATION (`VDM 02 l.207-215`), désormais en DONNÉE (`src/data/surincantation.json`,
 * V9 #1318). Les 7 paliers imprimés sont rejoués par les points de lecture PUBLICS : la chaîne
 * donnée → moteur est mesurée, pas la constante.
 */
describe('Tableau de Surincantation (VDM) — les 7 paliers imprimés, lus de la donnée', () => {
  /** `[DR dépensés sur la colonne, +Cibles, +Dégât, ×Portée, ×ZdE, ×Durée]` — VDM 02 l.209-215. */
  const PALIERS: [number, number, number, number, number, number][] = [
    [1, 1, 1, 2, 1, 1],
    [2, 1, 2, 2, 1, 2],
    [3, 1, 3, 2, 2, 2],
    [5, 2, 4, 3, 2, 2],
    [8, 2, 5, 3, 2, 3],
    [13, 2, 6, 3, 2, 3],
    [21, 3, 7, 4, 3, 3],
  ];

  it('PARITÉ : la table LUE PAR LE MOTEUR est exactement celle du fichier de donnée', () => {
    // Sans ce volet, ré-inscrire la table en dur dans `overcast.ts` laisserait les paliers ci-dessous
    // verts : ils passent par les fonctions publiques, pas par le fichier. Ici on lit le DISQUE.
    const disque = JSON.parse(
      readFileSync(fileURLToPath(new URL('../data/surincantation.json', import.meta.url)), 'utf8'),
    ) as { id: string; type: string; label: string; source: { book: string; page: number; note?: string }; entries: Record<string, number>[] };
    // (a) le fichier porte bien la table IMPRIMÉE, et sa citation ;
    expect(disque.entries.map((r) => [r.dr, r.targets, r.damage, r.range, r.zone, r.duration])).toEqual(PALIERS);
    expect(disque.source.book).toBe('vents-de-la-magie');
    expect(disque.source.page).toBe(23);
    expect(disque.source.note).toMatch(/VDM 02 /);
    // (b) la table du MOTEUR est celle-là, valeur pour valeur — une ré-inscription en dur (ou une
    //     divergence d'une seule rangée) fait rouge ici.
    expect(VDM_OVERCAST.map((r) => [r.dr, r.targets, r.damage, r.range, r.zone, r.duration])).toEqual(
      disque.entries.map((r) => [r.dr, r.targets, r.damage, r.range, r.zone, r.duration]),
    );
  });

  it('chaque palier rend l’effet imprimé sur les 5 colonnes', () => {
    setRule('magic-vdm-incantation', true);
    try {
      for (const [dr, cibles, degat, portee, zde, duree] of PALIERS) {
        expect(extraTargetCapacity('arcane', dr, 1), `${dr} DR → Cible additionnelle`).toBe(cibles);
        expect(missileOvercastDamageBonus('arcane', dr), `${dr} DR → Dégât en plus`).toBe(degat);
        expect(effectiveRangeMetres('arcane', 10, dr), `${dr} DR → Portée étendue`).toBe(10 * portee);
        expect(zoneDiameterMultiplier('arcane', dr), `${dr} DR → ZdE étendue`).toBe(zde);
        expect(overcastDurationParts('arcane', dr).mult, `${dr} DR → Durée prolongée`).toBe(duree);
      }
    } finally {
      resetRule('magic-vdm-incantation');
    }
  });

  it('0 DR n’ouvre aucun palier ; entre deux paliers c’est le plus haut ATTEINT, et 21 est « ou plus »', () => {
    setRule('magic-vdm-incantation', true);
    try {
      expect(extraTargetCapacity('arcane', 0, 1)).toBe(0);
      expect(missileOvercastDamageBonus('arcane', 0)).toBe(0);
      expect(effectiveRangeMetres('arcane', 10, 0)).toBe(10);
      expect(zoneDiameterMultiplier('arcane', 0)).toBe(1);
      expect(missileOvercastDamageBonus('arcane', 4)).toBe(3); // 4 DR reste au palier 3
      expect(extraTargetCapacity('arcane', 20, 1)).toBe(2); // 20 DR reste au palier 13
      expect(extraTargetCapacity('arcane', 99, 1)).toBe(3); // « 21 ou plus »
      expect(zoneDiameterMultiplier('arcane', 99)).toBe(3);
    } finally {
      resetRule('magic-vdm-incantation');
    }
  });
});
