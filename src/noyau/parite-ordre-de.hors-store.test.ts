/**
 * PARITÉ du coup, quel que soit le RANG du dé (#1426) — la fenêtre unique de la Blessure critique ne
 * change PAS ce qu'un coup produit : même Blessure, même compteur, même ENSEMBLE de dés consommés. Ce
 * qui bouge est l'ORDRE : le d100 de sévérité tombe quand le curseur atteint l'étape, plus dans
 * `applyHit`.
 *
 * Mesuré sur 25 graines et sur les DEUX AXES qui pourraient cacher un code « spécial porteur » :
 *  — le KIND (héros / ennemi), et surtout la TENUE (`sieges.tenuParUnHumain`) — c'est elle, et
 *    jamais le kind, qui décide si les voies Dévier/Subir s'ouvrent (LDB 63 l.30) ;
 *  — l'ARMURE : une fixture SANS PA n'ouvre AUCUNE voie et évite donc toute la branche de Déviation.
 *    Les porteurs BLINDÉS sont mesurés ici aussi, sans quoi le chemin qui compte n'est pas couvert.
 *
 * La consommation de dés n'est pas jugée « > 0 » (qui passe sur n'importe quoi) mais comparée à un
 * SNAPSHOT MESURÉ : le journal des tirages (bornes → valeur) à graine fixée.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { applyAttackResult } from './combatFlow';
import { tenuParUnHumain } from './sieges';
import { draineCascade } from './cascade.testkit';
import { seedBattleRng, battleRng } from './battleRng';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { recomputeLoadout } from '../engine/items';
import type { Mutation } from '../engine/corruption';
import type { Weapon, Combatant, ArmourPoints, HitLocation } from '../engine/types';
import type { AttackResult } from '../engine/combat';
import { OPS_DIFFEREES } from './combatEffects';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const hache: Weapon = { label: 'Hache', type: 'melee', damage: { plusBF: false, flat: 0 }, qualities: [] };
const SANS_PA: ArmourPoints = { tete: 0, corps: 0, brasG: 0, brasD: 0, jambeG: 0, jambeD: 0 };
/** PA déviatable à TOUTES les localisations : la branche de Déviation s'ouvre quel que soit le d100 de
 *  localisation du Coup Critique (LDB 18 l.55) — la fixture ne peut pas la manquer par chance. */
const AVEC_PA: ArmourPoints = { tete: 3, corps: 3, brasG: 3, brasD: 3, jambeG: 3, jambeD: 3 };
const PA_TOTAL = 18;

/** Dernière Blessure critique SUBIE (id d'entrée) — l'historique d'occurrence (LDB 18 l.71). */
const lastCrit = (c: Combatant): string | undefined => (c.critEntriesSuffered ?? [])[(c.critEntriesSuffered ?? []).length - 1];
/** PA d'armure naturelle d'une mutation (`ap` par Localisation) : la source d'où se dérive le PA d'un héros. LDB 19 */
const mutationDePA = (pa: ArmourPoints): Mutation => ({
  id: 'peau-de-test', label: 'Peau de test', desc: '', kind: 'physique', roll: 0,
  passive: (Object.entries(pa) as [HitLocation, number][]).filter(([, n]) => n > 0).map(([loc, amount]) => ({ op: 'ap', loc, amount })),
});
const paTotalDe = (c: Combatant): number => Object.values(c.armour).reduce((s, v) => s + v, 0);
const relire = (id: string): Combatant => banc.getState().battle!.combatants.find((c) => c.id === id)!;

const critHit = (woundsLost = 2): AttackResult => ({
  hit: true, attackerRoll: 44, netSL: 4, location: 'corps', critLocation: 'corps', damage: 6, woundsLost,
  critical: true, advantageTo: 'attacker', defenderDefeated: false, log: 'touche',
});

function startFight(seed: number, opts: { pa?: ArmourPoints; gmSeat?: number } = {}) {
  banc.setState({ battle: null, pendingCascade: null, suspendedCascades: [] });
  banc.getState().seedRng(seed);
  const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed });
  banc.setState({ party: [hero] });
  banc.getState().startScene(structuredClone(testScene()));
  banc.getState().startCombat('enc-mutants');
  banc.getState().confirmRoundStart();
  banc.abandonner();
  banc.setState({ net: { ...banc.getState().net, mode: 'local', mySeat: 0, gmSeat: opts.gmSeat } });
  const b = banc.getState().battle!;
  const H = b.combatants.find((c) => c.kind === 'hero')!;
  const E = b.combatants.find((c) => c.kind === 'enemy')!;
  E.important = true; // LDB 18 l.44 : hors Mort subite
  const pa = opts.pa ?? SANS_PA;
  H.items = []; // aucune pièce portée à départager : le PA du héros se dérive de sa mutation, celui de l'ennemi est son profil
  H.mutations = [mutationDePA(pa)];
  recomputeLoadout(H);
  E.armour = { ...pa };
  return { H, E };
}

/** JOURNAL des dés consommés au flux de bataille pendant `acte` — `min-max=>valeur` par tirage. La
 *  grandeur de parité : l'ordre peut bouger, l'ENSEMBLE non. Mesuré en instrumentant le générateur scellé. */
function journalDes(seed: number, acte: () => void): string[] {
  seedBattleRng(seed);
  const rng = battleRng();
  const brut = rng.int.bind(rng);
  const journal: string[] = [];
  (rng as { int: typeof brut }).int = (a: number, b: number) => { const v = brut(a, b); journal.push(`${a}-${b}=>${v}`); return v; };
  try { acte(); } finally { (rng as { int: typeof brut }).int = brut; }
  return journal;
}

/** SNAPSHOT MESURÉ à la graine 7 (`journalDes`) — ce que le coup consomme réellement, tirage par
 *  tirage. Un chemin qui perdrait ou gagnerait un dé (sévérité tirée puis jetée, re-pose qui re-tire)
 *  se voit ici, là où un `> 0` laisserait passer. */
const SNAPSHOT_GRAINE_7: Record<string, string[]> = {
  // UN seul d100 — celui de la SÉVÉRITÉ, tiré dans la fenêtre. La localisation ne coûte rien ici
  // (`critLocation` figée par la fixture), et la même valeur tombe pour les QUATRE porteurs tenus :
  // héros ou ennemi, blindé ou nu, c'est le MÊME code et le MÊME dé.
  heroSansPa: ['1-100=>2'],
  heroBlinde: ['1-100=>2'],
  ennemiSansPa: ['1-100=>2'],
  // Seul cas où AUCUN dé n'est consommé : l'automate a tranché avant la fenêtre, donc aucune sévérité
  // n'est tirée — elle serait tirée puis JETÉE.
  ennemiBlinde: [],
  ennemiBlindeTenu: ['1-100=>2'],
};

describe('#1426 — parité du coup : l’ordre du dé change, jamais son issue', () => {
  it('HÉROS SANS PA (siège humain) : 25 graines — une Blessure critique, sa ligne appliquée, l’étape ne porte que le tirage', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const { H, E } = startFight(seed);
      const avant = H.wounds.current;
      journalDes(seed, () => {
        const suspendu = applyAttackResult(banc.getState, banc.setState, E, H, hache, critHit());
        expect(suspendu, `graine ${seed} : la fenêtre de Blessure critique doit s’ouvrir`).toBe(OPS_DIFFEREES);
        const etapes = banc.getState().pendingCascade!.participants.filter((s) => s.kind === 'deviation');
        expect(etapes[0].options, `graine ${seed} : rien à sacrifier → aucune voie`).toBeUndefined();
        draineCascade(banc.getState);
      });
      const victime = relire(H.id);
      expect(victime.criticalWounds, `graine ${seed}`).toBe(1);
      expect(lastCrit(victime), `graine ${seed} : aucune ligne de Blessure appliquée`).toBeTruthy();
      expect(victime.wounds.current, `graine ${seed} : les Blessures de base doivent être appliquées`).toBeLessThan(avant);
    }
  });

  it('HÉROS BLINDÉ (siège humain) : 25 graines — les voies Dévier/Subir sont OFFERTES, « Dévier » sacrifie 1 PA et le Critique est ignoré', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const { H, E } = startFight(seed, { pa: AVEC_PA });
      const suspendu = applyAttackResult(banc.getState, banc.setState, E, H, hache, critHit());
      expect(suspendu, `graine ${seed}`).toBe(OPS_DIFFEREES);
      const etapes = banc.getState().pendingCascade!.participants.filter((s) => s.kind === 'deviation');
      expect(etapes, `graine ${seed} : une seule fenêtre`).toHaveLength(1);
      expect(etapes[0].options?.map((o) => o.key), `graine ${seed}`).toEqual(['devier', 'subir']);
      draineCascade(banc.getState); // `defaultChoice` = « Dévier »
      const victime = relire(H.id);
      expect(victime.criticalWounds ?? 0, `graine ${seed} : « Dévier » ignore le Critique`).toBe(0);
      expect(paTotalDe(victime), `graine ${seed} : exactement 1 PA sacrifié (LDB 63 l.30)`).toBe(PA_TOTAL - 1);
    }
  });

  it('ENNEMI SANS PA, aucun siège : 25 graines — MÊME code, l’étape existe, sa table est résolue d’office et sa ligne appliquée', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const { H, E } = startFight(seed);
      expect(tenuParUnHumain(banc.getState(), E.id), `graine ${seed}`).toBe(false);
      const suspendu = applyAttackResult(banc.getState, banc.setState, H, E, hache, critHit());
      expect(suspendu, `graine ${seed}`).toBe(OPS_DIFFEREES);
      const etapes = banc.getState().pendingCascade!.participants.filter((s) => s.kind === 'deviation');
      expect(etapes, `graine ${seed} : une seule étape pour la Blessure critique`).toHaveLength(1);
      const ligne = etapes[0].table!.result;
      expect(ligne, `graine ${seed} : le socle n’a pas tiré la table du porteur sans siège`).toBeTruthy();
      draineCascade(banc.getState);
      expect(lastCrit(relire(E.id)), `graine ${seed} : la ligne résolue d’office n’est pas celle appliquée`).toBe(ligne!.id);
    }
  });

  it('ENNEMI BLINDÉ, aucun siège : 25 graines — l’AUTOMATE tranche AVANT la fenêtre, aucune étape, aucun d100 de sévérité gaspillé', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const { H, E } = startFight(seed, { pa: AVEC_PA });
      const journal = journalDes(seed, () => {
        const suspendu = applyAttackResult(banc.getState, banc.setState, H, E, hache, critHit());
        expect(suspendu, `graine ${seed} : rien à suspendre, l’automate a tranché`).toBeUndefined();
      });
      expect(banc.getState().pendingCascade?.participants.some((s) => s.kind === 'deviation') ?? false,
        `graine ${seed} : aucune étape de Blessure critique`).toBe(false);
      expect(journal.filter((d) => d.startsWith('1-100')), `graine ${seed} : un d100 de sévérité tiré puis jeté`).toHaveLength(0);
      const victime = relire(E.id);
      expect(victime.criticalWounds ?? 0, `graine ${seed} : Critique ignoré`).toBe(0);
      expect(paTotalDe(victime), `graine ${seed} : exactement 1 PA sacrifié`).toBe(PA_TOTAL - 1);
    }
  });

  it('ENNEMI BLINDÉ TENU par un siège MJ : 25 graines — il reçoit la MÊME fenêtre que le héros blindé (la TENUE décide, pas le kind)', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const { H, E } = startFight(seed, { pa: AVEC_PA, gmSeat: 1 });
      expect(tenuParUnHumain(banc.getState(), E.id), `graine ${seed} : le MJ tient ses ennemis`).toBe(true);
      const suspendu = applyAttackResult(banc.getState, banc.setState, H, E, hache, critHit());
      expect(suspendu, `graine ${seed} : la fenêtre doit s’ouvrir pour le porteur tenu`).toBe(OPS_DIFFEREES);
      const etapes = banc.getState().pendingCascade!.participants.filter((s) => s.kind === 'deviation');
      expect(etapes, `graine ${seed} : une seule fenêtre`).toHaveLength(1);
      expect(etapes[0].options?.map((o) => o.key), `graine ${seed}`).toEqual(['devier', 'subir']);
      expect(paTotalDe(relire(E.id)), `graine ${seed} : aucun PA sacrifié avant que le MJ tranche`).toBe(PA_TOTAL);
    }
  });

  it('SNAPSHOT MESURÉ (graine 7) : le journal des dés consommés, tirage par tirage, sur les CINQ porteurs', () => {
    const mesure = (label: string, monte: () => { attaquant: Combatant; cible: Combatant }) => {
      const { attaquant, cible } = monte();
      const journal = journalDes(7, () => {
        applyAttackResult(banc.getState, banc.setState, attaquant, cible, hache, critHit());
        draineCascade(banc.getState);
      });
      expect(journal, label).toEqual(SNAPSHOT_GRAINE_7[label]);
    };
    mesure('heroSansPa', () => { const { H, E } = startFight(7); return { attaquant: E, cible: H }; });
    mesure('heroBlinde', () => { const { H, E } = startFight(7, { pa: AVEC_PA }); return { attaquant: E, cible: H }; });
    mesure('ennemiSansPa', () => { const { H, E } = startFight(7); return { attaquant: H, cible: E }; });
    mesure('ennemiBlinde', () => { const { H, E } = startFight(7, { pa: AVEC_PA }); return { attaquant: H, cible: E }; });
    mesure('ennemiBlindeTenu', () => { const { H, E } = startFight(7, { pa: AVEC_PA, gmSeat: 1 }); return { attaquant: H, cible: E }; });
  });
});
