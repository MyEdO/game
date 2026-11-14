import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { FLOWS } from './rollFlowSpecs';
import { FLOW_VERBS, type FlowKey, type NomDeVerbeDeJet } from './flowVerbs';
import { fermeturesDuFlux } from './verbesOuverts';
import type { Combatant } from '../engine/types';
import { FIXTURES, FLUX, FOE, HERO, PERDANT } from './inventaireDuDeFixe.testkit';

/**
 * GARDE EXHAUSTIVE de l'option « Dés fixés » — le socle, pas 36 copies.
 *
 * L'évaluation d'un dé saisi vit dans `makeRollFlow` : elle prend la cible que l'ACCESSEUR DE DÉ du flux
 * (`RollFlowSpec.die`, ou sa dérivation depuis la lentille) désigne, l'évalue par `evaluateTest`, puis la
 * projette par le `write` du même accesseur. Aucun résolveur de flux n'est sollicité — ils traitent
 * `forcee` comme un auto-succès de Résilience et rendraient une réussite GRATUITE en ignorant la saisie.
 *
 * Cette garde ouvre un pending FIXTURE RÉEL pour CHAQUE flux portant `imposerLeResultat` et vérifie les deux
 * invariants du socle :
 *   1. un dé fixé PERDANT ne devient jamais une réussite ;
 *   2. la valeur APPLIQUÉE est la valeur SAISIE.
 * Un flux dont la fixture manque ÉCHOUE la garde : impossible d'en ajouter un en le laissant dehors. Option active, la
 * pose est OUVERTE sur chaque flux (`fermeturesDuFlux`).
 */
let banc: Banc;
/** Le verbe de jet `nom` sur le flux `k`, ses `args` puis la rangée `pid` d'un flux multi (`VerbesDeJet`). */
const jet = (nom: NomDeVerbeDeJet, k: FlowKey, pid: string | undefined, ...args: unknown[]): void =>
  (banc.actions[nom] as (flux: FlowKey, ...reste: unknown[]) => void)(k, ...args, ...(pid ? [pid] : []));

const ouvrir = (desFixes: boolean): void => {
  banc = ouvrirLeBanc({ desFixes });
  banc.setState({
    party: [HERO],
    battle: { combatants: [HERO, FOE], log: [], order: ['H', 'E'], turn: 0, round: 1 } as never,
    net: { mode: 'local', mySeat: 0, roomCode: null, seatNames: {}, presence: {}, ownership: {} } as never,
  });
};

describe('socle du dé fixé — les flux passent TOUS par le même chemin', () => {
  beforeEach(() => ouvrir(true));

  it('chaque flux portant `imposerLeResultat` sait réévaluer un dé saisi (accesseur complet)', () => {
    const sans = FLUX.filter((k) => !FLOWS[k].fixable);
    expect(sans, 'flux sans ACCESSEUR DE DÉ — déclarer `die` (ou une lentille) sur sa spec').toEqual([]);
  });

  it('chaque flux a sa FIXTURE (un flux ajouté sans fixture échoue ICI, jamais en silence)', () => {
    const sans = FLUX.filter((k) => !FIXTURES[k]);
    expect(sans, 'flux sans fixture de garde').toEqual([]);
  });

  for (const k of FLUX) {
    it(`${k} — un dé fixé PERDANT échoue, et la valeur appliquée est la valeur saisie`, () => {
      const f = FIXTURES[k]!;
      banc.setState(f.state as never);
      jet('jetImposerLeResultat', k, f.pid, PERDANT);
      const got = f.read(banc.getState());
      expect(got.roll, `${k} : la valeur appliquée n'est pas la valeur saisie`).toBe(PERDANT);
      expect(got.success, `${k} : un dé PERDANT est devenu une réussite (réussite gratuite)`).toBe(false);
    });

    it(`${k} — option active, la pose est OUVERTE au siège qui contrôle le jet`, () => {
      const f = FIXTURES[k]!;
      banc.setState(f.state as never);
      expect(fermeturesDuFlux(banc.getState(), k, f.pid).imposerLeResultat, `${k} : la pose est fermée`).toBeNull();
    });
  }
});

/**
 * GARDE JUMELLE — le dé CHOISI au titre de la Résilience (LDB 17 l.68 : « au lieu de lancer les dés pour
 * un Test, vous choisissez le résultat ») emprunte le MÊME chemin de socle, avec sa POLITIQUE : le dé doit
 * rester une réussite, le DR est planché (Test opposé : « vous l'emportez avec au moins DR +1 »), et la
 * réussite PAYÉE par le point est conservée.
 *
 * Deux régressions que cette garde ferme : les Tests opposés binaires RELANÇAIENT un dé aléatoire (point de
 * Résilience perdu, réussite détruite) ; quatorze flux rendaient le sélecteur en IGNORANT la saisie.
 */
// Le dé CHOISI est un geste de RÉSILIENCE : il n'a de sens que pour les flux qui la déclarent. Un
// flux qui n'offre que la POSE (lot de dés d'étal : `verbs: ['imposerLeResultat']`) n'a pas de
// `forcerLaReussite` à appeler — l'itérer ici mesurerait un verbe qui n'existe pas.
const FLUX_RESILIENCE = FLUX.filter((k) => (FLOW_VERBS[k].verbs as readonly string[]).includes('forcerLaReussite'));

describe('socle du dé choisi (Résilience) — même chemin, politique en paramètre', () => {
  beforeEach(() => ouvrir(false));
  const CHOISI = 11; // ≤ cible (45) : le plus bas double réussi — le dé de l'exemple Salundra (l.70)
  for (const k of FLUX_RESILIENCE) {
    it(`${k} — le dé choisi s'applique, la réussite achetée tient, le point n'est pas re-dépensé`, () => {
      const f = FIXTURES[k]!;
      // Acteur FRAIS par fixture : un objet partagé verrait sa Résilience épuisée par les cas précédents,
      // et les derniers flux ne forceraient plus rien (piège mesuré).
      const hero = { ...HERO, resilience: 3 } as Combatant;
      const foe = { ...FOE, resilience: 3 } as Combatant;
      banc.setState({
        party: [hero],
        battle: { combatants: [hero, foe], log: [], order: ['H', 'E'], turn: 0, round: 1 } as never,
      });
      banc.setState(f.state as never);
      jet('jetForcerLaReussite', k, f.pid);
      const apres = banc.getState().battle!.combatants.find((c) => c.id === 'H')!.resilience;
      expect(apres, `${k} : la Résilience n'a pas été dépensée (le forçage n'a pas pris)`).toBe(2);
      const forced = f.read(banc.getState());
      expect(forced.success, `${k} : « Je ne faillirai pas ! » n'a pas produit de réussite`).toBe(true);

      jet('jetImposerLeResultat', k, f.pid, CHOISI);
      const got = f.read(banc.getState());
      expect(got.roll, `${k} : le dé CHOISI n'est pas celui appliqué (jet relancé ou saisie ignorée)`).toBe(CHOISI);
      expect(got.success, `${k} : la réussite PAYÉE par le point de Résilience a été perdue`).toBe(true);
      expect(banc.getState().battle!.combatants.find((c) => c.id === 'H')!.resilience,
        `${k} : le choix du dé a re-dépensé une ressource`).toBe(apres);
    });
  }
});
