import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, onTestFinished, vi } from 'vitest';
import { nouvelEntete, ouvrirLaPartie } from './partieDeTest';
import { projeter } from './projection';
import { porteurDObjetDeCampagne } from '../scenes/fixtures/objetDeCampagne.testkit';
import { frenzyTarget } from '../noyau/combatFlow';
import type { Combatant } from '../engine/types';
import { createHero } from '../engine/character';
import { setRule, resetRule } from '../engine/policy';
import { testValue } from '../engine/skills';
import { ouvrirLeBanc } from '../noyau/banc.testkit';
import { applyEffects } from '../noyau/combatEffects';
import { imposerLesD100 } from '../noyau/battleRng.testkit';
import { voyageEnVue } from '../noyau/voyageEnVue';
import { carteEnVue } from '../noyau/carteEnVue';
import { dayPhase, toDate } from '../engine/clock';
import { scenario as fluvial } from '../scenes/test-scenarios/15-commerce-fluvial';

describe('projection d’un objet de campagne', () => {
  it('publie l’apparence de naissance, tenue en main, sur l’actif et dans la liste des combattants', () => {
    const { partie } = ouvrirLaPartie(nouvelEntete('dome', { graine: 7 }), () => {});
    try {
      const base = partie.etat();
      const { hero, narratif, candidats } = porteurDObjetDeCampagne(idsDeTest, 'hache_naine');
      const ancien = base.battle!.combatants.find((c) => c.kind === 'heros')!;
      hero.id = ancien.id;
      hero.pos = ancien.pos;
      const etat = {
        ...base, campaignNarratif: narratif,
        party: base.party.map((c) => c.id === hero.id ? hero : c),
        battle: {
          ...base.battle!,
          combatants: base.battle!.combatants.map((c) => c.id === hero.id ? hero : c),
          order: [hero.id, ...base.battle!.order.filter((id) => id !== hero.id)], turn: 0,
        },
      };
      const vue = projeter(etat, 0, 0, { autres: 100, offres: 100, cibles: 100, gestes: 100, entites: 100 });
      expect(candidats).toEqual(['hache_naine', 'hache']);
      const tenue = expect.objectContaining({ cle: { champ: 'apparence', id: 'hache_naine', racine: 'hache' }, point: 'main' });
      expect(vue.combat!.actif!.portee?.portees).toContainEqual(tenue);
      expect(vue.combat!.voisins.liste.find((c) => c.id === hero.id)!.portee?.portees).toContainEqual(tenue);
    } finally {
      partie.fermer();
    }
  });
});

describe('projection des cibles du Tab (`combat.cibles`)', () => {
  it('Frénésie, deux adversaires adjacents : seule la cible imposée est publiée (LDB 21 l.33)', () => {
    const { partie } = ouvrirLaPartie(nouvelEntete('dome', { graine: 7 }), () => {});
    try {
      const base = partie.etat(); // pause de début de Round ouverte : refermée ci-dessous
      const heros = { ...base.battle!.combatants.find((c) => c.kind === 'heros')!, pos: { x: 6, y: 6 }, engagedWith: [], psychState: [{ type: 'frenesie' }] } as Combatant;
      const modele = base.battle!.combatants.find((c) => c.kind === 'ennemi')!;
      const proche = { ...modele, id: 'adverse-est', label: 'Est', pos: { x: 7, y: 6 }, engagedWith: [] } as Combatant;
      const autre = { ...modele, id: 'adverse-ouest', label: 'Ouest', pos: { x: 5, y: 6 }, engagedWith: [] } as Combatant;
      const combatants = [heros, proche, autre];
      const etat = { ...base, pendingRoundStart: null, battle: { ...base.battle!, combatants, order: combatants.map((c) => c.id), turn: 0, action: null, acted: false, movementUsed: 0, preview: null } };
      const imposee = frenzyTarget(() => etat, heros)!;
      expect([proche.id, autre.id], 'témoin : la Frénésie impose l’un des deux').toContain(imposee.id);
      const vue = projeter(etat, 0, 0, { autres: 100, offres: 100, cibles: 100, gestes: 100, entites: 100 });
      expect(vue.combat!.barre.forme, 'témoin : la barre du tour est ouverte').toBe('ouverte');
      expect(vue.combat!.cibles.liste).toEqual([imposee.id]);
    } finally {
      partie.fermer();
    }
  });
});

describe('projection du verdict propre et de l’opposition', () => {
  const bornes = { autres: Infinity, offres: Infinity, cibles: Infinity, gestes: Infinity, entites: Infinity };

  function heros() {
    return createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Sigmund', seed: 101, talentsRolled: false });
  }

  it('la Corruption expose le Test simple, puis applique son gain au porteur à l’acquittement', () => {
    onTestFinished(() => { vi.restoreAllMocks(); });
    const h = heros();
    const banc = ouvrirLeBanc({ desFixes: true, etat: { party: [h] } });
    const get = banc.getState;
    const jet = () => projeter(get(), 0, 0, bornes).jets.find((j) => j.flux === 'corruption');
    applyEffects(get, banc.setState, [{ type: 'corruptionExposure', level: 'mineure', nature: 'physique', heroId: h.id }]);
    const avant = jet()!;
    expect(avant).toMatchObject({ sorte: 'simple', oppose: null });
    expect(avant.lignes[0]).toMatchObject({
      qui: h.id, id: expect.any(String), etat: 'aJouer', reference: { genre: 'competence', id: 'resistance' }, jet: null,
    });
    imposerLesD100(18);
    get().jetLancer('corruption');
    expect(jet()!.lignes[0]).toMatchObject({ id: avant.lignes[0].id, etat: 'revele', jet: { d100: 18 } });
    get().jetImposerLeResultat('corruption', 99);
    expect(jet()!.lignes[0]).toMatchObject({ id: avant.lignes[0].id, etat: 'revele', jet: { d100: 99, verdict: 'echec' } });
    expect(get().party[0].corruption ?? 0).toBe(0);
    get().jetValider('corruption');
    expect(get().party[0].corruption).toBe(1);
    expect(jet()).toBeUndefined();
  });

  it('les Dominos contre la salle gardent la victoire de l’opposition distincte du double échec individuel', () => {
    onTestFinished(() => { vi.restoreAllMocks(); resetRule('jeux-de-taverne'); });
    const h = heros();
    h.skills = h.skills.filter((s) => s.id !== 'pari');
    h.skills.push({ id: 'pari', characteristic: 'intelligence', advances: 70 - testValue(h, { skill: { id: 'pari' } }) });
    const banc = ouvrirLeBanc({ desFixes: true, etat: { party: [h] } });
    const get = banc.getState;
    const jet = () => projeter(get(), 0, 0, bornes).jets.find((j) => j.flux === 'cascade');
    setRule('jeux-de-taverne', true);
    imposerLesD100(99);
    get().jouerALaTaverne(h.id, { gameId: 'dominos', opponent: { kind: 'profil', id: 'elfe-haut-et-sylvain' } });
    const etape = get().pendingCascade!.participants[0];
    expect(etape.meta?.opposed?.aT.roll).toBe(99);
    const avant = jet()!;
    expect(avant).toMatchObject({ sorte: 'oppose', oppose: null });
    expect(avant.lignes).toMatchObject([
      { etat: 'masque', cible: null, jet: null },
      { etat: 'aJouer', qui: h.id, jet: null },
    ]);

    get().jetLancer('cascade', etape.id);
    expect(etape.target).toBeLessThan(95);
    get().jetImposerLeResultat('cascade', 95, etape.id);
    const joue = jet()!;
    expect(joue.lignes.map((l) => l.id)).toEqual(avant.lignes.map((l) => l.id));
    expect(joue.lignes).toMatchObject([
      { etat: 'revele', jet: { d100: 99, verdict: 'echec' } },
      { etat: 'revele', qui: h.id, jet: { d100: 95, verdict: 'echec' } },
    ]);
    expect(joue.oppose).toMatchObject({ gagnante: 1, drNet: expect.any(Number) });
    expect(get().pendingCascade!.participants[0].result?.success).toBe(true);
    get().jetValider('cascade');
    expect(jet()).toBeUndefined();
  });
});

describe('projection du temps, du voyage et de la carte', () => {
  const bornes = { autres: 0, offres: 0, cibles: 0, gestes: 0, entites: 0 };

  /** Un banc sur la carte du scénario fluvial, le groupe à l'un des bouts de sa route à pied, à `heure`. */
  function surLaCarte(heure: number) {
    const banc = ouvrirLeBanc();
    const carte = fluvial.construire(idsDeTest).worldMap!;
    const route = carte.routes.find((r) => r.modes.includes('pied'))!;
    banc.setState({ worldMap: carte, lieu: route.a.id, gameTime: heure, mode: 'exploration', battle: null });
    return { banc, route };
  }

  it('le temps : la date impériale et le moment du jour de l’heure de la partie', () => {
    const heure = 41 * 24 * 60 + 14 * 60;
    const { banc } = surLaCarte(heure);
    const vue = projeter(banc.getState(), 0, 0, bornes);
    expect(vue.temps).toEqual({ date: toDate(heure), moment: { id: dayPhase(heure).id, nom: dayPhase(heure).label } });
    expect(vue.temps).toMatchObject({ date: { mois: { id: 'jahrdrung' }, day: 9, semaine: { id: 'wellentag' } }, moment: { id: 'apresmidi' } });
  });

  it('en route : le voyage du lecteur, et aucune carte', () => {
    const { banc, route } = surLaCarte(8 * 60);
    banc.setState({ travelPlan: { routeId: route.id, fromPlaceId: route.a.id, toPlaceId: route.b.id, mode: 'pied', departAt: 0, hoursPerDay: 6, km: route.km, kmDone: 3.5, interrupted: false } });
    const vue = projeter(banc.getState(), 0, 0, bornes);
    expect(vue.voyage).not.toBeNull();
    expect(vue.voyage).toEqual(voyageEnVue(banc.getState()));
    expect(vue.carte).toBeNull();
  });

  it('la carte ouverte : la carte du lecteur, et aucun voyage', () => {
    const { banc } = surLaCarte(8 * 60);
    banc.setState({ worldMapOpen: true });
    const vue = projeter(banc.getState(), 0, 0, bornes);
    expect(vue.carte).not.toBeNull();
    expect(vue.carte).toEqual(carteEnVue(banc.getState()));
    expect(vue.voyage).toBeNull();
  });
});
