/** Les réducteurs de lobby de `NetState` (#3041) : attribution d'un héros, d'un emplacement, rôle MJ — hôte-autoritaires,
 *  refusés par leur verdict (`refusDAttribuer*`, `refusDuSiegeMJ`) ; les sièges de la table et les emplacements du groupe
 *  (#3059 F10) ; les attributions de siège offertes à l'hôte (#3009). */
import { describe, expect, it } from 'vitest';
import { etatInitialDuJeu, initialNet, type EtatDeJeu, type NetState } from './etat';
import {
  attribuerLEmplacement, attribuerLeHeros, emplacementsDuGroupe, fermerLeSiege, poserLeSiegeMJ, rangDAjout,
  refusDAttribuerLEmplacement, refusDAttribuerLeHeros, refusDuSiegeMJ, siegeDuHeros, siegesDeLaTable, siegesOfferts,
} from './sieges';
import { creerPartie, type EntreesDeLaPartie } from './partie';
import { CLASSE_DES_ACTIONS_DU_NOYAU } from './intentionsDeSiege';
import { createHero } from '../engine/character';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import type { Combatant } from '../engine/types';
import { t } from '../i18n';

/** L'hôte d'une room à deux invités, aucun héros attribué. */
const hoteADeuxInvites = (): NetState => ({ ...initialNet(), mode: 'hote', roomCode: 'ABC234', seatNames: { 0: 'Hôte', 1: 'Anna', 2: 'Bruno' } });
/** L'invité Anna, assis au siège 1. */
const inviteAnna = (): NetState => ({ ...initialNet(), mode: 'invite', mySeat: 1, roomCode: 'ABC234' });
/** Une partie solo. */
const solo = (): NetState => initialNet();
/** Le groupe des tests : un seul héros. */
const groupe = [{ id: 'soldat-de-test' }];

const SIEGE_INCONNU = t('coop.assign.seatUnknown');

describe('attribuerLeHeros', () => {
  it("l'hôte attribue un héros à un siège, puis le réattribue", () => {
    const net = attribuerLeHeros(attribuerLeHeros(hoteADeuxInvites(), groupe, 'soldat-de-test', 1), groupe, 'soldat-de-test', 2);
    expect(net.ownership).toEqual({ 'soldat-de-test': 2 });
  });

  it('un invité ou une partie solo : le réseau est rendu inchangé', () => {
    for (const net of [inviteAnna(), solo()]) expect(attribuerLeHeros(net, groupe, 'soldat-de-test', 1)).toBe(net);
  });

  it('refusé pour un siège hors de la table ou un héros hors du groupe : le réseau est rendu inchangé', () => {
    const hote = hoteADeuxInvites();
    expect(refusDAttribuerLeHeros(hote, groupe, 'soldat-de-test', 3)).toBe(SIEGE_INCONNU);
    expect(refusDAttribuerLeHeros(hote, groupe, 'absent', 1)).toBe(t('coop.assign.heroAbsent'));
    expect(refusDAttribuerLeHeros(hote, groupe, 'soldat-de-test', 1)).toBeNull();
    expect(attribuerLeHeros(hote, groupe, 'soldat-de-test', 3)).toBe(hote);
    expect(attribuerLeHeros(hote, groupe, 'absent', 1)).toBe(hote);
  });
});

describe('poserLeSiegeMJ', () => {
  it('le rôle MJ est UNIQUE : le poser à un siège le retire au précédent ; null le rend à l’IA', () => {
    const anna = poserLeSiegeMJ(hoteADeuxInvites(), 1);
    expect(anna.gmSeat).toBe(1);
    expect(poserLeSiegeMJ(anna, 2).gmSeat).toBe(2);
    expect(poserLeSiegeMJ(anna, null).gmSeat).toBeUndefined();
  });

  it('en solo, le siège unique prend le rôle', () => {
    expect(refusDuSiegeMJ(solo(), 0)).toBeNull();
    expect(poserLeSiegeMJ(solo(), 0).gmSeat).toBe(0);
  });

  it('un invité ne pose pas le rôle : le réseau est rendu inchangé', () => {
    const net = inviteAnna();
    expect(poserLeSiegeMJ(net, 1)).toBe(net);
  });

  it('refusé pour un siège hors de la table, jamais pour l’IA', () => {
    const hote = hoteADeuxInvites();
    expect(refusDuSiegeMJ(hote, 5)).toBe(SIEGE_INCONNU);
    expect(refusDuSiegeMJ(hote, null)).toBeNull();
    expect(poserLeSiegeMJ(hote, 5)).toBe(hote);
  });
});

describe('attribuerLEmplacement', () => {
  it("l'hôte attribue un emplacement vide à un siège de la table", () => {
    expect(attribuerLEmplacement(hoteADeuxInvites(), [], 1, 2).slots).toEqual([0, 2, 0, 0]);
  });

  it('hors des emplacements, chez un invité ou en solo : le réseau est rendu inchangé', () => {
    const hote = hoteADeuxInvites();
    expect(refusDAttribuerLEmplacement(hote, [], 4, 1)).toBe(t('coop.assign.slotUnknown'));
    expect(attribuerLEmplacement(hote, [], 4, 1)).toBe(hote);
    expect(attribuerLEmplacement(hote, [], -1, 1)).toBe(hote);
    for (const net of [inviteAnna(), solo()]) expect(attribuerLEmplacement(net, [], 1, 1)).toBe(net);
  });

  it('refusé sur un emplacement occupé ou vers un siège hors de la table : le réseau est rendu inchangé', () => {
    const hote = { ...hoteADeuxInvites(), rangs: { 'soldat-de-test': 1 } };
    expect(refusDAttribuerLEmplacement(hote, groupe, 1, 2)).toBe(t('coop.assign.slotTaken'));
    expect(attribuerLEmplacement(hote, groupe, 1, 2)).toBe(hote);
    expect(refusDAttribuerLEmplacement(hote, groupe, 0, 7)).toBe(SIEGE_INCONNU);
    expect(attribuerLEmplacement(hote, groupe, 0, 7)).toBe(hote);
  });
});

describe('siegesDeLaTable', () => {
  it('l’hôte (siège 0) en est TOUJOURS, nommé ou non ; les sièges nommés suivent, dans l’ordre', () => {
    expect(siegesDeLaTable(solo()).map((x) => x.seat)).toEqual([0]);
    expect(siegesDeLaTable(solo())[0]).toEqual({ seat: 0, nom: t('party.seat.host'), moi: true, absent: false });
    const net = { ...hoteADeuxInvites(), presence: { 2: 'absent' as const } };
    expect(siegesDeLaTable(net)).toEqual([
      { seat: 0, nom: 'Hôte', moi: true, absent: false },
      { seat: 1, nom: 'Anna', moi: false, absent: false },
      { seat: 2, nom: 'Bruno', moi: false, absent: true },
    ]);
  });
});

describe('emplacementsDuGroupe', () => {
  const party = (...ids: string[]) => ids.map((id) => ({ id }));

  it('chaque héros à son rang ; un rang sans héros reste vide en place', () => {
    const net = { ...solo(), rangs: { a: 0, c: 2 } };
    expect(emplacementsDuGroupe({ net, party: party('a', 'c') }).map((e) => e.heroId)).toEqual(['a', null, 'c', null]);
  });

  it('un héros sans rang va au premier rang vide, dans l’ordre du groupe', () => {
    const net = { ...solo(), rangs: { b: 0 } };
    expect(emplacementsDuGroupe({ net, party: party('a', 'b', 'c') }).map((e) => e.heroId)).toEqual(['b', 'a', 'c', null]);
  });

  it('coop : le siège de l’emplacement et le siège du héros, qui diffèrent après une réattribution', () => {
    const net = { ...hoteADeuxInvites(), slots: [0, 1, 1, 0], ownership: { a: 1, b: 0 }, rangs: { a: 1, b: 0 } };
    expect(emplacementsDuGroupe({ net, party: party('a', 'b') })).toEqual([
      { rang: 0, siege: 0, heroId: 'b', proprietaire: 0 },
      { rang: 1, siege: 1, heroId: 'a', proprietaire: 1 },
      { rang: 2, siege: 1, heroId: null, proprietaire: null },
      { rang: 3, siege: 0, heroId: null, proprietaire: null },
    ]);
    const reattribue = { ...net, ownership: { a: 2, b: 0 } };
    expect(emplacementsDuGroupe({ net: reattribue, party: party('a', 'b') })[1]).toEqual({ rang: 1, siege: 1, heroId: 'a', proprietaire: 2 });
  });

  it('le rang d’ajout : le premier emplacement vide du siège, sinon le premier vide, null groupe complet', () => {
    const net = { ...hoteADeuxInvites(), slots: [0, 1, 1, 0], rangs: { a: 1 } };
    expect(rangDAjout({ net, party: party('a') }, 1)).toBe(2);
    expect(rangDAjout({ net, party: party('a') }, 0)).toBe(0);
    expect(rangDAjout({ net, party: party('a') }, 2)).toBe(0);
    expect(rangDAjout({ net: solo(), party: party('a', 'b', 'c', 'd') }, 0)).toBeNull();
  });
});

describe('siegesOfferts (#3009)', () => {
  const ENTREES: EntreesDeLaPartie = { graine: 7, reglesMaison: {}, cadence: 'manuel', desFixes: true, persisterLeHeros: () => {} };
  const HEROS = ['h0', 'h1', 'h2', 'h3'].map((id, i) => {
    const h = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: `Héros ${i}`, seed: 11 + i });
    h.id = id;
    return h;
  });
  const etatHote = (net: Partial<NetState>, party: Combatant[]): EtatDeJeu => ({ ...etatInitialDuJeu(), party, net: { ...initialNet(), mode: 'hote', roomCode: 'ABC234', ...net } });

  /** Ce que le choix `siege` de l'offre `id` annonce, lu dans `net`. */
  const annonce = (net: NetState, id: string, siege: number | null): boolean => {
    const [genre, cle] = id.split('/');
    if (genre === 'heros') return siegeDuHeros(net, cle) === siege;
    if (genre === 'emplacement') return net.slots[Number(cle)] === siege;
    return (net.gmSeat ?? null) === siege;
  };

  /** Joue chaque choix de chaque offre de `etat` dans une partie neuve : il pose ce qu'il annonce, sans refus, et devient
   *  `tenu` ; un choix déjà `tenu` laisse les offres égales en valeur (un héros sans siège dans `net.ownership` est
   *  tenu par l'hôte, `siegeDuHeros`, et son choix l'y écrit). Rend le nombre de choix joués. */
  const jouerChaqueChoix = (etat: EtatDeJeu, cas: string): number => {
    let joues = 0;
    for (const offre of siegesOfferts(etat)) {
      for (const choix of offre.choix) {
        const partie = creerPartie(etat, ENTREES);
        try {
          const { journal } = partie.envoyer(choix.intention);
          const net = partie.etat().net;
          const ici = `${cas} ${offre.id} → ${choix.siege}`;
          expect(journal, ici).toEqual([]);
          expect(annonce(net, offre.id, choix.siege), ici).toBe(true);
          if (choix.tenu) expect(siegesOfferts(partie.etat()), ici).toEqual(siegesOfferts(etat));
          expect(siegesOfferts(partie.etat()).find((o) => o.id === offre.id)?.choix.find((c) => c.siege === choix.siege)?.tenu, ici).toBe(true);
          joues++;
        } finally {
          partie.fermer();
        }
      }
    }
    return joues;
  };

  it('Z1 : aucune offre en mode `local` ni en mode `invite`', () => {
    expect(siegesOfferts({ net: solo(), party: HEROS.slice(0, 2) })).toEqual([]);
    expect(siegesOfferts({ net: inviteAnna(), party: HEROS.slice(0, 2) })).toEqual([]);
  });

  it('Z2 : à deux sièges, un héros et trois emplacements vides, une offre par héros, par emplacement vide, et le rôle MJ, chacune jouée', () => {
    const etat = etatHote({ seatNames: { 0: 'Hôte', 1: 'Anna' } }, HEROS.slice(0, 1));
    const offres = siegesOfferts(etat);
    expect(offres.map((o) => o.id)).toEqual(['heros/h0', 'emplacement/1', 'emplacement/2', 'emplacement/3', 'mj']);
    expect(offres.map((o) => o.choix.map((c) => c.siege))).toEqual([[0, 1], [0, 1], [0, 1], [0, 1], [null, 0, 1]]);
    expect(offres.find((o) => o.id === 'mj')!.choix.map((c) => c.tenu)).toEqual([true, false, false]);
    expect(jouerChaqueChoix(etat, 'Z2')).toBe(11);
  });

  it('Z3 : tout choix offert se joue, sur la matrice des tables ; un emplacement occupé ne s’offre pas et se refuse', () => {
    let joues = 0;
    for (const sieges of [1, 2, 3]) {
      for (const nbHeros of [0, 1, 2, 3, 4]) {
        for (const variante of ['nue', 'absent', 'ferme', 'reattribue'] as const) {
          const party = HEROS.slice(0, nbHeros);
          const seatNames: Record<number, string> = Object.fromEntries(Array.from({ length: sieges }, (_, s) => [s, `Siège ${s}`]));
          const dernier = sieges - 1;
          let net: NetState = { ...initialNet(), mode: 'hote', roomCode: 'ABC234', seatNames };
          if (variante === 'absent') net = { ...net, presence: { [dernier]: 'absent' } };
          if (variante === 'ferme') {
            const ferme = sieges;
            net = fermerLeSiege({ ...net, seatNames: { ...seatNames, [ferme]: 'Parti' }, slots: [0, 0, 0, ferme], gmSeat: ferme, ownership: nbHeros ? { h0: ferme } : {} }, ferme);
          }
          if (variante === 'reattribue') net = { ...net, slots: [dernier, dernier, 0, dernier], ownership: nbHeros ? { h0: dernier } : {}, gmSeat: dernier };
          const etat = etatHote(net, party);
          const cas = `${sieges} siège(s), ${nbHeros} héros, ${variante}`;
          joues += jouerChaqueChoix(etat, cas);
          const occupes = emplacementsDuGroupe(etat).filter((e) => e.heroId !== null);
          const offerts = siegesOfferts(etat).map((o) => o.id);
          for (const e of occupes) {
            expect(offerts, cas).not.toContain(`emplacement/${e.rang}`);
            const partie = creerPartie(etat, ENTREES);
            try {
              expect(partie.envoyer({ type: 'affecterLEmplacementAuSiege', args: [e.rang, 0] }).journal, cas).toEqual([{ de: 'journal', texte: t('coop.assign.slotTaken'), heure: etat.gameTime }]);
            } finally {
              partie.fermer();
            }
          }
        }
      }
    }
    expect(joues).toBe(660);
  });

  it('Z5 : chaque intention offerte est d’un verbe de classe `hôte`', () => {
    const etat = etatHote({ seatNames: { 0: 'Hôte', 1: 'Anna', 2: 'Bruno' } }, HEROS.slice(0, 2));
    const verbes = new Set(siegesOfferts(etat).flatMap((o) => o.choix.map((c) => c.intention.type)));
    expect([...verbes].sort()).toEqual(['affecterLEmplacementAuSiege', 'affecterLeHerosAuSiege', 'affecterLeSiegeMJ']);
    for (const v of verbes) expect((CLASSE_DES_ACTIONS_DU_NOYAU as Record<string, string>)[v], v).toBe('hôte');
  });
});
