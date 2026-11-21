import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { createHero } from '../engine/character';
import { setRule } from '../engine/policy';
import { zonesDeLEcran } from '../hote/ecran';
import { fenetreADessiner } from '../hote/gestes';
import { projeter } from '../hote/projection';
import { SANS_ROSTER } from '../hote/roster';
import { t } from '../i18n';
import { appliquerLIntentionDUnSiege } from './intentionsDeSiege';
import { TOUT_RESOUDRE } from './combatAuto';
import { cleDuGeste, modalOwnerOf } from './modalArbiter';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/** Enfoncer une porte à PLUSIEURS (EDO Appendice 2, « Portes ») — flux multi PARALLÈLE, métier =
 *  DÉGÂTS sur objet (BE / B). Chaque héros frappe indépendamment (Bagarre → DR + BF − BE) avec son
 *  propre cycle d'influence ; la somme ronge les Blessures jusqu'à céder. Objets : PAS de minimum 1. */
describe('Enfoncer une porte à plusieurs (objet BE/B, jets indépendants)', () => {
  beforeEach(() => { banc.setState({ battle: null, pendingForceDoor: null, pendingCascade: null, suspendedCascades: [], flags: {} } as never); });

  function heroes() {
    const mk = (name: string, seed: number) => {
      const h = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: name, seed });
      h.fortune = 2; h.resilience = 2; h.characteristics.force = 45; // Bonus de Force 4
      return h;
    };
    const a = mk('A', 1), b = mk('B', 2);
    banc.setState({ party: [a, b] });
    return [a, b];
  }

  it('chacun frappe indépendamment ; les dégâts cumulés font céder la porte (flag posé)', () => {
    banc.getState().ensemencerLeTirage(7);
    const [a, b] = heroes();
    banc.getState().enfoncerLaPorte({ label: 'Porte de la cave', doorBE: 0, doorB: 8, heroIds: [a.id, b.id], flag: 'cave_ouverte' });
    let guard = 0;
    while (banc.getState().pendingForceDoor && guard++ < 40) {
      const p = banc.getState().pendingForceDoor!;
      p.participants.forEach((part) => banc.getState().jetLancer('enfoncerLaPorte', part.id)); // chacun SON jet
      expect(banc.getState().pendingForceDoor!.participants.every((x) => x.result)).toBe(true);
      banc.getState().jetValider('enfoncerLaPorte'); // applique la somme du Round
    }
    expect(banc.getState().pendingForceDoor).toBeNull(); // la porte a cédé
    expect(banc.getState().flags.cave_ouverte).toBe(true); // ouverture en jeu (flag de scène)
    expect(guard).toBeGreaterThanOrEqual(1);
  });

  /**
   * #1262 V2 L4 — l'enfoncement était le DERNIER `groupOwner` monté à la main (une étape littérale
   * hors de la porte). Il passe par `hostStep` en forme de GROUPE : jet de groupe SANS porteur nommé.
   * La possession `'*'` est ce qui donne la fenêtre à TOUS les sièges (chacun n'influençant que SA
   * rangée) — sans elle, l'arbitre la rendrait à l'hôte seul.
   */
  it('l’étape est MINTÉE en forme de GROUPE : `groupOwner`, aucun porteur nommé, fenêtre à tous les sièges', () => {
    const [a, b] = heroes();
    banc.getState().enfoncerLaPorte({ label: 'Porte', doorBE: 0, doorB: 8, heroIds: [a.id, b.id] });
    const casc = banc.getState().pendingCascade!;
    expect(casc.participants).toHaveLength(1);
    const st = casc.participants[0];
    expect(Object.keys(st).sort(), 'la déclaration, et rien d’autre').toEqual(['groupOwner', 'id', 'jet', 'kind']);
    expect(st.jet).toBe('enfoncerLaPorte');
    expect(st.groupOwner).toBe(true);
    expect(st.actorId, 'un jet de GROUPE n’a pas d’acteur unique').toBeUndefined();
    expect(modalOwnerOf(banc.getState()), 'fenêtre ouverte à tous les sièges').toBe('*');
  });

  it('la porte attend sa propre validation : « Tout résoudre » est refusé aux deux sièges puis la fenêtre se ferme', () => {
    const [a, b] = heroes();
    const { getState: get } = banc;
    banc.setState({ net: { ...get().net, mode: 'hote', ownership: { [a.id]: 0, [b.id]: 1 }, slots: [0, 1, 0, 0] } });
    get().enfoncerLaPorte({ label: 'Porte de la cave', doorBE: 0, doorB: 1, heroIds: [a.id, b.id], flag: 'cave_ouverte' });
    const cle = cleDuGeste(TOUT_RESOUDRE);
    const motif = t('jet.ferme.etapeHoteEnAttente');

    const verifierLeRefus = () => {
      const avant = get();
      for (const siege of [0, 1]) {
        const etat = { ...avant, net: { ...avant.net, mySeat: siege } };
        const fenetre = fenetreADessiner(etat);
        const projection = projeter(etat, 0, 0, { autres: 0, offres: 0, cibles: 0, gestes: 0, entites: 0 });
        expect(projection.fenetre?.fermes[cle], 'motif transmis dans la fenêtre').toBe(motif);
        expect(fenetre?.gestes.find((geste) => geste.cle === cle)?.raison).toBe(motif);
        expect(zonesDeLEcran(etat, projection, fenetre, null, SANS_ROSTER)['fenetre.gestes'].find((geste) => geste.id === cle))
          .toMatchObject({ type: 'bouton', refus: motif, jeu: { type: 'jetLancer', args: ['cascade'] } });
      }
      get().jetLancer('cascade');
      expect(get().journal.slice(-1), 'refus local').toEqual([motif]);
      const refus: string[] = [];
      appliquerLIntentionDUnSiege(get, 1, 'jetLancer', ['cascade'], (texte) => refus.push(texte));
      expect(refus, 'refus rendu à l’invité').toEqual([motif]);
      expect(get().pendingCascade).toBe(avant.pendingCascade);
      expect(get().pendingForceDoor).toBe(avant.pendingForceDoor);
      expect(get().flags.cave_ouverte).toBeUndefined();
    };

    verifierLeRefus();
    get().jetForcerLaReussite('enfoncerLaPorte', a.id);
    appliquerLIntentionDUnSiege(get, 1, 'jetForcerLaReussite', ['enfoncerLaPorte', b.id]);
    expect(get().pendingForceDoor?.participants.every((rang) => rang.result !== null)).toBe(true);
    verifierLeRefus();
    get().jetValider('enfoncerLaPorte');
    expect(get().flags.cave_ouverte).toBe(true);
    expect(get().pendingForceDoor).toBeNull();
    expect(get().pendingCascade).toBeNull();
    expect(fenetreADessiner(get())?.gestes.some((geste) => geste.cle === cle) ?? false).toBe(false);
  });

  it('sur un Test étendu attribué, le refus de siège précède l’attente de l’étape', () => {
    const [a] = heroes();
    const { getState: get } = banc;
    banc.setState({ net: { ...get().net, mode: 'hote', ownership: { [a.id]: 1 }, slots: [1, 0, 0, 0] } });
    get().ouvrirLeTestEtendu({ actorId: a.id, label: 'Test étendu', skillLabel: 'Force', target: 70, drCible: 15 });
    const avant = get();
    const cle = cleDuGeste(TOUT_RESOUDRE);
    const motifDeSiege = t('coop.intentRefused');
    const motifDAttente = t('jet.ferme.etapeHoteEnAttente');
    const invite = { ...avant, net: { ...avant.net, mySeat: 1 } };
    expect(fenetreADessiner(avant)?.gestes.find((geste) => geste.cle === cle)?.raison).toBe(motifDeSiege);
    expect(fenetreADessiner(invite)?.gestes.find((geste) => geste.cle === cle)?.raison).toBe(motifDAttente);
    get().jetLancer('cascade');
    expect(get().journal.slice(-1), 'refus de l’appel local direct').toEqual([motifDeSiege]);
    expect(appliquerLIntentionDUnSiege(get, 0, 'jetLancer', ['cascade'])).toBe('refusee');
    expect(get().journal.slice(-2)).toEqual([motifDeSiege, motifDeSiege]);
    const refus: string[] = [];
    appliquerLIntentionDUnSiege(get, 1, 'jetLancer', ['cascade'], (texte) => refus.push(texte));
    expect(refus).toEqual([motifDAttente]);
    expect(get().pendingCascade).toBe(avant.pendingCascade);
    expect(get().pendingExtendedTest).toBe(avant.pendingExtendedTest);
  });

  it('EDO : DR + BF < BE → 0 dégât (la porte ne bouge pas) — objets sans minimum 1', () => {
    const [a, b] = heroes();
    banc.getState().enfoncerLaPorte({ label: 'Porte blindée', doorBE: 8, doorB: 5, heroIds: [a.id, b.id] });
    // Coups faibles (comme Gerhardt : DR −2 + BF 4 = 2 < BE 8 → 0).
    const p = banc.getState().pendingForceDoor!;
    banc.setState({ pendingForceDoor: { ...p, participants: p.participants.map((x) => ({ ...x, result: { roll: 63, target: 46, sl: -2, damage: 0 } })) } });
    banc.getState().jetValider('enfoncerLaPorte');
    expect(banc.getState().pendingForceDoor!.doorB).toBe(5); // 0 dégât → Blessures inchangées, nouveau Round
  });

  it('Résilience garantit un coup ; chaque héros dépense SES propres ressources', () => {
    const [a] = heroes();
    banc.getState().enfoncerLaPorte({ label: 'Porte', doorBE: 0, doorB: 50, heroIds: [a.id] });
    banc.getState().jetForcerLaReussite('enfoncerLaPorte', a.id); // « Je ne faillirai pas ! » → DR max → dégâts
    const r = banc.getState().pendingForceDoor!.participants[0].result!;
    expect(r.damage).toBeGreaterThan(0);
    expect(banc.getState().party[0].resilience).toBe(1); // 1 Point de Résilience dépensé (le SIEN)
  });

  // Non-régression : le dé PAR DÉFAUT de la Résilience doit être policy-aware (`bestForcedRoll`). En Fast DR
  // (LDB 12 l.102, DR = dizaines du JET), l'ancien `1` codé en dur donnait le DR MINIMAL (planché à 1) au lieu
  // du MAXIMAL. RAW LDB 17 l.68 « vous choisissez le résultat » = LE MEILLEUR → dizaines de la cible.
  it('Fast DR : le dé forcé vise le DR MAXIMAL (dizaines de la cible), PAS 1', () => {
    setRule('test-dr-rapide', true); // règle optionnelle : sur une réussite, DR = dizaines du jet
    const [a] = heroes();
    a.characteristics['capacite-de-combat'] = 65; // Bagarre (Corps à corps) → cible ~65 (dizaines 6)
    banc.setState({ party: [a] });
    banc.getState().enfoncerLaPorte({ label: 'Porte', doorBE: 0, doorB: 80, heroIds: [a.id] });
    banc.getState().jetForcerLaReussite('enfoncerLaPorte', a.id); // « Je ne faillirai pas ! »
    const r = banc.getState().pendingForceDoor!.participants[0].result!;
    const maxDR = Math.floor(Math.min(r.target, 95) / 10); // dizaines de la cible = DR forcé MAXIMAL
    expect(maxDR).toBeGreaterThan(1);   // cible élevée → DR max clairement > 1
    expect(r.sl).toBe(maxDR);           // DR forcé = MAXIMAL (dizaines de la cible)...
    expect(r.sl).not.toBe(1);           // ...et PAS le DR minimal (bug du dé 01 codé en dur en Fast DR)
    expect(r.roll).not.toBe(1);         // le dé forcé n'est plus 01 : c'est le plus haut valide
  });
});
