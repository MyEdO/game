/**
 * #337 — filage FINAL de la Magie des mers (MDG 02 l.178-186) : le moteur pur (`resolveFocus`,
 * `resolveCasting`, `evaluateCasting`) sait déjà tout (`domainAttributes.test.ts`, 12 tests verts) ;
 * ici on vérifie le CÂBLAGE côté state — `seaMagicContext` (`combatOrParty.ts`) fournit `{ atSea, wind }`
 * aux deux call-sites (`combatSlice.castRoll`, `rollFlowSpecs` spec `cast`/`focus`) et l'exception
 * Harmonisation aethyrique de Vie (`combatSlice.focusConfirm`).
 */
import { describe, it, beforeEach, expect } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { draineEtLit } from './cascade.testkit';
import { pregen, PREGEN } from '../data/pregens';
import type { Combatant } from '../engine/types';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

function wizard(domainId: string): Combatant {
  const w = pregen(PREGEN.sorcier);
  w.skills = (w.skills as Combatant['skills']).filter((s) => s.id !== 'langue' && s.id !== 'focalisation');
  w.skills.push({ id: 'langue', spec: 'magick', advances: 30 } as never);
  w.skills.push({ id: 'focalisation', spec: domainId, advances: 30 } as never);
  w.characteristics = { ...w.characteristics, intelligence: 80, 'force-mentale': 80 };
  w.talents = w.talents.filter((t) => t.talentId !== 'harmonisation-aethyrique');
  return w;
}

function freshCastState(w: Combatant, travelPlan: unknown = null): void {
  banc.setState({
    battle: null, party: [w], journal: [], pendingCast: null, pendingFocus: null, 
    travelPlan: travelPlan as never, vessel: null,
  });
}

describe('#337 — Magie des mers, filage state (seaMagicContext)', () => {
  describe('Cieux (Azyr, MDG 02 l.184) — resolveCasting via castRoll : le DR bouge selon le vent', () => {
    const spellId = 'arc-de-t-essla'; // Domaine Cieux

    function castSl(w: Combatant, travelPlan: unknown): number {
      freshCastState(w, travelPlan);
      banc.getState().seedRng(21);
      banc.setState({ pendingCast: { casterId: w.id, targetId: w.id, spellId, missile: false, focused: true, result: null } });
      banc.getState().castRoll();
      return banc.getState().pendingCast!.result!.sl;
    }

    it('hors mer (travelPlan=null) : comportement STRICTEMENT inchangé (pas de modificateur)', () => {
      const w = wizard('cieux');
      const baseline = castSl(w, null);
      const again = castSl(w, null);
      expect(again).toBe(baseline); // déterministe, aucune dérive
    });

    it('en mer, Violente tempête : +1 DR sur le Test d\'Incantation', () => {
      const w = wizard('cieux');
      const baseline = castSl(w, null);
      const storm = castSl(w, { mode: 'mer', sea: { weather: { vent: 'violente-tempete' } } });
      expect(storm).toBe(baseline + 1);
    });

    it('en mer, Calme plat : -1 DR sur le Test d\'Incantation', () => {
      const w = wizard('cieux');
      const baseline = castSl(w, null);
      const calm = castSl(w, { mode: 'mer', sea: { weather: { vent: 'calme-plat' } } });
      expect(calm).toBe(baseline - 1);
    });

    it('un navire de campagne possédé (vessel non-null) mais SANS voyage maritime ET SANS combat d\'abordage : pas atSea (régression)', () => {
      const w = wizard('cieux');
      freshCastState(w, null);
      banc.setState({ vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] } } as never });
      banc.getState().seedRng(21);
      banc.setState({ pendingCast: { casterId: w.id, targetId: w.id, spellId, missile: false, focused: true, result: null } });
      banc.getState().castRoll();
      const withVesselOnly = banc.getState().pendingCast!.result!.sl;
      const baseline = castSl(w, null);
      expect(withVesselOnly).toBe(baseline);
    });
  });

  describe('Cieux (Azyr, MDG 02 l.184) — resolveMagicMissile via castRoll (#337, dernier reliquat) : le DR bouge selon le vent', () => {
    const spellId = 'arc-de-t-essla'; // Domaine Cieux, Projectile magique (LDB 46 l.101 : le Projectile EST le Test d'Incantation)

    function missileSl(w: Combatant, travelPlan: unknown): number {
      freshCastState(w, travelPlan);
      banc.getState().seedRng(21);
      banc.setState({ pendingCast: { casterId: w.id, targetId: w.id, spellId, missile: true, focused: true, result: null } });
      banc.getState().castRoll();
      return banc.getState().pendingCast!.result!.sl;
    }

    it('hors mer (travelPlan=null) : comportement STRICTEMENT inchangé (pas de modificateur)', () => {
      const w = wizard('cieux');
      const baseline = missileSl(w, null);
      const again = missileSl(w, null);
      expect(again).toBe(baseline);
    });

    it('en mer, Violente tempête : +1 DR sur le Test d\'Incantation du Projectile', () => {
      const w = wizard('cieux');
      const baseline = missileSl(w, null);
      const storm = missileSl(w, { mode: 'mer', sea: { weather: { vent: 'violente-tempete' } } });
      expect(storm).toBe(baseline + 1);
    });

    it('en mer, Calme plat : -1 DR sur le Test d\'Incantation du Projectile', () => {
      const w = wizard('cieux');
      const baseline = missileSl(w, null);
      const calm = missileSl(w, { mode: 'mer', sea: { weather: { vent: 'calme-plat' } } });
      expect(calm).toBe(baseline - 1);
    });
  });

  describe('Vie (Ghyran, MDG 02 l.186) — focusConfirm : Harmonisation aethyrique en mer', () => {
    const spellId = 'don-de-vie'; // Domaine Vie

    // Le jet de Focalisation est POSÉ (Critique) : seule la CIBLE du contrecoup est sous mesure —
    // quel TABLEAU d'Imparfaite est joué (Mineure/Majeure). Ce tableau se tire au d100 (`applyMiscast`
    // → `rollMiscast`, `battleRng`) : sans graine, ce dé est AMBIANT (position du flux RNG partagé du
    // worker sous `isolate:false`) et une Mineure en 96-00 CASCADE sur la table Majeure
    // (`engine/miscast.ts` l.437) — la prémisse fuyait alors dans l'assertion « pas de Majeure »
    // (#1014, sighting fondateur). Graine posée comme dans les helpers voisins : draw hors cascade.
    function focusCritConfirm(w: Combatant, travelPlan: unknown): string {
      freshCastState(w, travelPlan);
      banc.getState().seedRng(21);
      w.spells = [spellId];
      banc.setState({
        party: [w],
        pendingFocus: { casterId: w.id, spellId, result: { dr: 0, isCritical: true, isFumble: false, roll: 33, log: 'Focalisation critique !' } },
      });
      banc.getState().focusConfirm();
      // Le contrecoup est une ÉTAPE à table : elle se joue, et ce qu'elle rend au joueur vit sur elle
      // (révélation) autant qu'au journal.
      return draineEtLit(banc.getState).join('\n');
    }

    it('SANS Harmonisation, en mer : Focalisation Critique de Vie → Imparfaite MAJEURE (au lieu de Mineure)', () => {
      const w = wizard('vie');
      const j = focusCritConfirm(w, { mode: 'mer' });
      expect(j).toMatch(/Incantation Imparfaite Majeure/);
      expect(j).not.toMatch(/Incantation Imparfaite Mineure/);
    });

    it('SANS Harmonisation, HORS mer : Focalisation Critique de Vie → Imparfaite Mineure (régression, comportement historique)', () => {
      const w = wizard('vie');
      const j = focusCritConfirm(w, null);
      expect(j).toMatch(/Incantation Imparfaite Mineure/);
      expect(j).not.toMatch(/Incantation Imparfaite Majeure/);
    });

    it('AVEC Harmonisation aethyrique, en mer : lance quand même sur le tableau des MINEURES (n\'échappe plus au contrecoup, MDG 02 l.186)', () => {
      const w = wizard('vie');
      w.talents.push({ talentId: 'harmonisation-aethyrique', times: 1 });
      const j = focusCritConfirm(w, { mode: 'mer' });
      expect(j).toMatch(/Incantation Imparfaite Mineure/);
      expect(j).not.toMatch(/Harmonisation aethyrique : le contrecoup est maîtrisé/);
    });

    it('AVEC Harmonisation aethyrique, HORS mer : aucun contrecoup (régression, comportement historique)', () => {
      const w = wizard('vie');
      w.talents.push({ talentId: 'harmonisation-aethyrique', times: 1 });
      const j = focusCritConfirm(w, null);
      expect(j).toMatch(/Harmonisation aethyrique : le contrecoup est maîtrisé/);
      expect(j).not.toMatch(/Incantation Imparfaite/);
    });
  });
});
