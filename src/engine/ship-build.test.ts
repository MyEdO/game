import { describe, it, expect } from 'vitest';
import {
  buildShip, shipSizeOfLength, installCost, rollPortRepair, rollTemporaryRepair,
  temporaryRepairFailureDamage, steamBreakdownFor, steamBreakdownTriggered,
} from './shipBuild';
import { findNavalTrait } from '../data';
import type { RNG } from './dice';
import { desEnSuite } from './dice.testkit';

const seq = (...vals: number[]): RNG => desEnSuite(vals, { boucle: true, borne: true });

describe('buildShip — CONSTRUIRE UN NAVIRE en 4 étapes (MDG 12 l.108-164)', () => {
  it('étape 1 : les Caractéristiques de bateau standard (Moyenne : 500 CO, 6(8)/5(20), E 40, B 90, 400)', () => {
    const s = buildShip({ size: 'moyenne', primary: 'voile', secondary: true });
    expect(s.crew).toBe(20);
    expect(s.sail).toMatchObject({ m: 6, crew: 8 });
    expect(s.e).toBe(40);
    expect(s.b).toBe(90);
    expect(s.capacity).toBe(400);
  });

  it('étape 2 : la propulsion secondaire perd 2 M (min 3) ; non gardée → absente ; Énorme n’a pas d’avirons', () => {
    const s = buildShip({ size: 'moyenne', primary: 'voile', secondary: true });
    expect(s.oars!.m).toBe(3); // 5 − 2 = 3
    const noOars = buildShip({ size: 'moyenne', primary: 'voile' });
    expect(noOars.oars).toBeUndefined();
    const rower = buildShip({ size: 'petite', primary: 'avirons', secondary: true });
    expect(rower.oars!.m).toBe(5);
    expect(rower.sail!.m).toBe(3); // 5 − 2
    expect(buildShip({ size: 'enorme', primary: 'voile', secondary: true }).oars).toBeUndefined();
  });

  it('étape 3 : la Manœuvre ajuste le coût (−2 DR → −40 % ; +1 DR → +20 %)', () => {
    expect(buildShip({ size: 'moyenne', primary: 'voile', manDR: -2 }).costGold).toBe(300);
    expect(buildShip({ size: 'moyenne', primary: 'voile', manDR: 1 }).costGold).toBe(600);
  });

  it('étape 4 : Rapide = +1 M, −25 % Contenance ; Foudroyant = +3 M, −75 %, +10 % coût ; Escargot = −3 M, ×2 Contenance, −2 DR Man', () => {
    const fast = buildShip({ size: 'moyenne', primary: 'voile', speedTraitId: 'rapide' });
    expect(fast.sail!.m).toBe(7);
    expect(fast.capacity).toBe(300);
    const bolt = buildShip({ size: 'moyenne', primary: 'voile', speedTraitId: 'foudroyant' });
    expect(bolt.sail!.m).toBe(9);
    expect(bolt.capacity).toBe(100);
    expect(bolt.costGold).toBe(550);
    const snail = buildShip({ size: 'moyenne', primary: 'voile', speedTraitId: 'escargot' });
    expect(snail.sail!.m).toBe(3);
    expect(snail.capacity).toBe(800);
    expect(snail.manDR).toBe(-2);
  });

  it('Traits de construction (l.167-193) : Renforcé +10 E, −10 % Contenance, +10 % coût / niveau ; Solide +30 % B ; Peu maniable −10 %', () => {
    const war = buildShip({ size: 'moyenne', primary: 'voile', traits: [{ id: 'renforce', level: 2 }, { id: 'solide', level: 1 }] });
    expect(war.e).toBe(60); // 40 + 2×10
    expect(war.b).toBe(117); // 90 × 1,3
    expect(war.capacity).toBe(280); // 400 × (1 − 0,2 − 0,1)
    expect(war.costGold).toBe(700); // 500 × (1 + 0,2 + 0,2)
    const cheap = buildShip({ size: 'petite', primary: 'voile', traits: [{ id: 'peu-maniable', level: 3 }] });
    expect(cheap.costGold).toBe(140); // 200 × 0,7
  });
});

describe('installCost — pose d’une Amélioration par PALIER DE LONGUEUR (MDG 12 l.195-364, #277)', () => {
  it('Taille dérivée de la longueur (l.120-129) — SOURCE UNIQUE, les DEUX bornes de chaque bande', () => {
    // Le tableau CARACTÉRISTIQUES DE BATEAU STANDARD, colonne « Taille » (l.123-129) : sept bandes,
    // bornes INCLUSIVES, la dernière ouverte (« 81+ »). La table est lue en donnée par
    // `findTableEntry` — les bornes BASSES comptent donc autant que les hautes.
    expect(shipSizeOfLength(1)).toBe('minuscule');
    expect(shipSizeOfLength(10)).toBe('minuscule');
    expect(shipSizeOfLength(11)).toBe('tres-petite');
    expect(shipSizeOfLength(15)).toBe('tres-petite');
    expect(shipSizeOfLength(16)).toBe('petite');
    expect(shipSizeOfLength(20)).toBe('petite');
    expect(shipSizeOfLength(21)).toBe('moyenne');
    expect(shipSizeOfLength(35)).toBe('moyenne');
    expect(shipSizeOfLength(36)).toBe('grande');
    expect(shipSizeOfLength(50)).toBe('grande');
    expect(shipSizeOfLength(51)).toBe('enorme');
    expect(shipSizeOfLength(80)).toBe('enorme');
    expect(shipSizeOfLength(81)).toBe('monstrueuse');
    // La bande finale n'a PAS de plafond : le « 130 » que la donnée portait n'est imprimé nulle part.
    expect(shipSizeOfLength(130)).toBe('monstrueuse');
    expect(shipSizeOfLength(400)).toBe('monstrueuse');
  });

  it('hors du domaine (0, négatif, longueur FRACTIONNAIRE) : anomalie NOMMÉE, jamais une Taille de repli', () => {
    // La colonne « Taille » est une table d'ENTIERS contiguë depuis 1 m : entre deux bandes, il n'y a
    // pas de rangée à rendre. Les deux replis possibles mentent — la DERNIÈRE bande rendrait
    // « Monstrueuse » à une chaloupe, la PREMIÈRE rendrait « Minuscule » à un trois-mâts de 80,5 m.
    // Le porteur, lui, est borné au schéma (`ship.lengthM: z.number().int().min(1)`).
    for (const hors of [0, -5, 0.5, 10.5, 15.5, 20.5, 35.5, 50.5, 80.5]) {
      expect(() => shipSizeOfLength(hors), `la longueur ${hors} m a reçu une Taille au lieu d’un refus`)
        .toThrowError(/ne tombe dans aucune bande de la colonne/);
    }
    // AU-DESSUS de 81 m il n'y a plus de trou : la bande finale est OUVERTE (« 81+ », l.129) — une
    // longueur fractionnaire y tombe, et c'est la seule qui passe.
    expect(shipSizeOfLength(130.5)).toBe('monstrueuse');
  });

  it('Ancre : 10 CO / 50 Enc jusqu’à 35 m (borne « moyenne »), 20 CO / 75 Enc au-delà (l.207-209)', () => {
    const ancre = findNavalTrait('ancre')!.install!;
    expect(installCost(ancre, 25)).toEqual({ gold: 10, enc: 50 });
    expect(installCost(ancre, 60)).toEqual({ gold: 20, enc: 75 });
  });

  it('#277 — transcription MDG à l’IDENTIQUE : palier de longueur ⟺ ancienne bande de Taille (aucune valeur ne change)', () => {
    // Bélier (MDG 12 l.221) : la bande [min:petite, max:moyenne] devient maxLengthM:35 (borne « moyenne »).
    const belier = findNavalTrait('belier')!.install!;
    expect(installCost(belier, 20)).toEqual({ gold: 30, enc: 60 }); // 20 m = Petite (avant) = ≤35 m (après)
    expect(installCost(belier, 35)).toEqual({ gold: 30, enc: 60 }); // 35 m = Moyenne (avant) = ≤35 m (après)
    expect(installCost(belier, 36)).toEqual({ gold: 60, enc: 120 }); // 36 m = Grande (avant) = palier suivant (après)
  });

  it('Blindage (fer) : « par tranche de 5 mètres de Taille » (l.225) — caraque 35 m = 7 tranches × 330 CO', () => {
    const fer = findNavalTrait('blindage-fer')!.install!;
    expect(installCost(fer, 35)).toEqual({ gold: 2310, enc: 1120 }); // 7 × 330 / 7 × 160
  });

  it('Cabine de luxe : « par cabine » (l.240) — 2 cabines = 310 CO / 80 Enc', () => {
    const cab = findNavalTrait('cabine-de-luxe')!.install!;
    expect(installCost(cab, 35, 2)).toEqual({ gold: 310, enc: 80 });
  });

  it('Embarcation de bord : coût « du modèle » → null (résolu par l’appelant, l.268)', () => {
    const emb = findNavalTrait('embarcation-de-bord')!.install!;
    expect(installCost(emb, 35).gold).toBeNull();
  });
});

describe('Réparations (MDG 13 l.639-651)', () => {
  it('port : Test réussi → 1d10 h, 1d10 Blessures, 1 CO/Blessure ; Lissage +50 % (ch.12 l.295)', () => {
    // jet 20 (réussite), heures d10=4, blessures d10=6.
    const r = rollPortRepair(60, 20, seq(20, 4, 6));
    expect(r).toMatchObject({ success: true, hours: 4, wounds: 6, costGold: 6 });
    const lisse = rollPortRepair(60, 20, seq(20, 4, 6), { lissage: true });
    expect(lisse.costGold).toBe(9);
    // Restauration plafonnée aux Blessures manquantes.
    expect(rollPortRepair(60, 3, seq(20, 4, 8)).wounds).toBe(3);
    expect(rollPortRepair(60, 20, seq(99, 4)).wounds).toBe(0); // Test raté
  });

  it('temporaire : 1 h, 1d10 Blessures ; une réparation qui cède inflige 1d10−4 Dégâts (min 0)', () => {
    const r = rollTemporaryRepair(50, 20, 'complexe', seq(15, 7));
    expect(r).toMatchObject({ success: true, hours: 1, wounds: 7, costGold: 0 });
    expect(temporaryRepairFailureDamage(seq(9))).toBe(5);
    expect(temporaryRepairFailureDamage(seq(2))).toBe(0);
  });
});

describe('Panne de Vapeur (MDG 12 l.313-352)', () => {
  it('déclencheurs : double sur un Test de Métier (Ingénieur) RATÉ, ou Échec Stupéfiant', () => {
    expect(steamBreakdownTriggered({ success: false, sl: -2, isDouble: true })).toBe(true);
    expect(steamBreakdownTriggered({ success: false, sl: -7 })).toBe(true);
    expect(steamBreakdownTriggered({ success: false, sl: -2 })).toBe(false);
    expect(steamBreakdownTriggered({ success: true, sl: 2, isDouble: true })).toBe(false);
  });

  it('table d100 : 01-40 moteur broute (M −3) ; 61-70 perte de pression (M 0) ; 96-00 explosion (Critique Coque)', () => {
    expect(steamBreakdownFor(30)).toMatchObject({ id: 'moteur-broute', mMod: -3 });
    expect(steamBreakdownFor(65)).toMatchObject({ id: 'perte-de-pression', mSet: 0 });
    expect(steamBreakdownFor(98)).toMatchObject({ id: 'explosion', engineDestroyed: true, hullCritical: true, compartmentDamage: 12 });
  });
});
