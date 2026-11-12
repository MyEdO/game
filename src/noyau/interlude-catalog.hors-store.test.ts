/**
 * Catalogue d'Activités d'interlude data-driven (`activities.json`) — Activités d'Altdorf
 * (ACE 12 l.9-67) branchées dans le flux d'interlude :
 *  - gate géographique `where` résolu contre le lieu courant (carte du monde ↔ scène) ;
 *  - Pénitence : ±Péché (op sinMod), Exténué DIFFÉRÉ à la clôture, Maladresse → Colère des dieux ;
 *  - Tester des objets magiques : identification (voie ACE, coexiste avec l'ADE II) + Exposition ;
 *  - Entraînement d'arme inhabituelle : `masteredWeapons` ;
 *  - Mécénat : dépôt ≥ 5 CO, retrait par Test d'Évaluation (bandes payoutPct) ;
 *  - Recherche universitaire : mémorisation avec remise (achat immédiat).
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { draineCascade } from './cascade.testkit';
import { createHero } from '../engine/character';
import { toBrass, fromBrass, PA_PER_CO } from '../engine/money';
import { partyMoneyTotal, creditBourse } from './bourseFlow';
import { hasCondition } from '../engine/conditions';
import { spells } from '../data';
import { testScene } from '../scenes/test-fixture';
import { pratiquer } from './interlude.testkit';
import { reglageDuChoixDeFenetre } from './choixDeFenetre';
import { t } from '../i18n';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

describe('Catalogue d’Activités d’interlude (ACE Annexe I, data-driven)', () => {
  beforeEach(() => {
    const a = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 1 });
    // Prière et Recherche sont avancées : le héros les a apprises pour tenter Pénitence et l'étude (LDB 09 l.30).
    a.skills.push({ id: 'priere', characteristic: 'sociabilite', advances: 5 }, { id: 'recherche', characteristic: 'intelligence', advances: 5 });
    banc.setState({ party: [a] });
    banc.getState().lancerLaScene(testScene());
    banc.setState({ lieu: 'altdorf' });
    creditBourse(banc.getState, banc.setState, banc.getState().party[0].id, fromBrass(5000));
    banc.getState().ensemencerLeTirage(13);
    banc.getState().ouvrirLInterlude(3);
    draineCascade(banc.getState); // les dés d'Événement sont des étapes de séquence : elle se joue avant les Activités
    // Neutralise l'événement d100 tiré (on teste le catalogue, pas l'événement).
    const itl = banc.getState().interlude!;
    itl.perHero[hero().id] = { ...st(), fx: undefined, left: 3 };
    banc.setState({ interlude: { ...itl } });
  });

  function hero() { return banc.getState().party[0]; }
  function st() { return banc.getState().interlude!.perHero[hero().id]; }
  const forceRoll = (roll: number, success: boolean, sl: number) => {
    banc.getState().jetLancer('activite');
    banc.setState({ pendingActivity: { ...banc.getState().pendingActivity!, roll, success, sl } });
    banc.getState().jetValider('activite');
  };

  it('gate `where` : hors d’Altdorf (le groupe à aucun lieu), la Pénitence n’est pas offerte, et le geste est refusé', () => {
    banc.setState({ lieu: null });
    const offertes = reglageDuChoixDeFenetre(banc.getState(), 'interlude', 'activite', hero().id).valeurs?.map((v) => v.valeur);
    expect(offertes, 'témoin : le catalogue de ce lieu est offert').toContain('convalescence');
    expect(offertes).not.toContain('penitence');
    const journal = banc.getState().journal.length;
    pratiquer(banc.getState, hero().id, 'penitence');
    expect(banc.getState().pendingActivity).toBeNull();
    expect(banc.getState().journal.slice(journal)).toEqual([t('choix.refus.valeur')]);
  });

  it('Pénitence — succès : −1 Péché (−2 dès +4 DR), Activité consommée, note VERBATIM à l’écran', () => {
    hero().sinPoints = 3;
    pratiquer(banc.getState, hero().id, 'penitence');
    const pa = banc.getState().pendingActivity;
    expect(pa?.kind).toBe('catalog');
    expect(pa?.activityId).toBe('penitence');
    expect(pa?.difficulty).toBe('accessible'); // « Test de Prière Accessible (+20) »
    forceRoll(5, true, 4);
    expect(hero().sinPoints).toBe(1); // « ou 2 sur un Succès Impressionnant (+4 DR) ou mieux »
    expect(st().left).toBe(2);
    expect(banc.getState().journal.join('\n')).toMatch(/Point\(s\) de Péché/);
  });

  it('Pénitence — échec : Exténué DIFFÉRÉ à la clôture (posé APRÈS le repos, « premier jour de la prochaine aventure »)', () => {
    hero().sinPoints = 1;
    pratiquer(banc.getState, hero().id, 'penitence');
    forceRoll(97, false, -2);
    expect(hero().sinPoints).toBe(1); // l'échec n'expie rien
    expect(hasCondition(hero(), 'extenue')).toBe(false); // rien MAINTENANT (serait dissipé au repos)
    expect(st().closeOps).toEqual([{ ops: [{ op: 'condition', id: { id: 'extenue' } }], ctx: { label: 'Pénitence', source: { kind: 'activite', id: 'penitence' }, sl: -2 } }]);
    const avant = banc.getState().journal.length;
    banc.getState().fenetreValider('interlude');
    expect(hasCondition(hero(), 'extenue')).toBe(true); // posé après les nuits de clôture
    expect(banc.getState().journal.slice(avant)).toContain('A reçoit 1 État Exténué.');
  });

  it('Pénitence — Maladresse : Colère des dieux « à la place » (table LDB 40, −1 Péché expié), pas d’Exténué', () => {
    hero().sinPoints = 2;
    pratiquer(banc.getState, hero().id, 'penitence');
    const parquees = banc.getState().suspendedCascades.length;
    forceRoll(44, false, -1); // 44 = double raté → Maladresse
    // Le tirage sur la table de la Colère est une étape de la séquence (#1426) : c'est en la jouant
    // que le contrecoup se dénoue — et donc que le Péché s'expie. HORS COMBAT, cette étape ne PARQUE
    // aucune séquence d'accueil : le contrecoup rejoint ce qui est en vol, il ne l'évince pas.
    expect(banc.getState().suspendedCascades.length, 'le contrecoup a parqué une séquence hors combat').toBe(parquees);
    draineCascade(banc.getState);
    expect(banc.getState().suspendedCascades.length).toBe(parquees);
    const journal = banc.getState().journal.join('\n');
    expect(journal).toMatch(/Colère/);
    expect(st().closeOps).toBeUndefined(); // « à la place » : l'issue d'échec ne tombe pas
    expect(hero().sinPoints).toBe(1); // « réduisez vos Points de Péché de 1 » (LDB 40 l.46)
  });

  // ── Tester des objets magiques (voie ACE — coexiste avec l'identification ADE II) ────────────────
  function armArtefact() {
    const h = hero();
    h.items = [...(h.items ?? []), { uid: 'art1', name: 'Amulette étrange', kind: 'trapping', qualities: [], enc: 0, equipped: false, identified: false } as never];
    banc.setState({ party: [...banc.getState().party] });
  }
  const artefact = () => hero().items!.find((i) => i.uid === 'art1')!;

  it('Tester des objets : ≥ +4 DR → étude en profondeur (identifié, Particularités révélées)', () => {
    armArtefact();
    pratiquer(banc.getState, hero().id, 'tester-objets-magiques', { itemUid: 'art1' });
    expect(banc.getState().pendingActivity?.kind).toBe('catalog');
    forceRoll(3, true, 5);
    expect(artefact().identified).toBe(true);
    expect(artefact().magicKnown).toBe(true);
    expect(st().left).toBe(2);
  });

  it('Tester des objets : succès ≤ +3 → fonction principale (magicKnown), pas les règles complètes', () => {
    armArtefact();
    pratiquer(banc.getState, hero().id, 'tester-objets-magiques', { itemUid: 'art1' });
    forceRoll(20, true, 2);
    expect(artefact().identified).toBe(false);
    expect(artefact().magicKnown).toBe(true);
  });

  it('Tester des objets : ≤ −4 DR → contamination : Test d’Exposition mineure à la Corruption (modale)', () => {
    armArtefact();
    pratiquer(banc.getState, hero().id, 'tester-objets-magiques', { itemUid: 'art1' });
    forceRoll(98, false, -5);
    const pc = banc.getState().pendingCorruption;
    expect(pc?.level).toBe('mineure');
    expect(pc?.nature).toBe('physique');
    expect(artefact().identified).toBe(false);
  });

  // ── Entraînement avec une arme inhabituelle ────────────────────────────────────────────────────
  function armUnusualWeapon() {
    const h = hero();
    h.items = [...(h.items ?? []), {
      uid: 'wm1', trappingId: 'couteau-de-harald', name: 'Couteau de Harald', kind: 'melee',
      qualities: [], enc: 0, equipped: false, requiresMastery: true,
    } as never];
    banc.setState({ party: [...banc.getState().party] });
  }

  it('Entraînement : la compétence est IMPOSÉE par l’arme ; le succès inscrit la maîtrise (masteredWeapons)', () => {
    armUnusualWeapon();
    pratiquer(banc.getState, hero().id, 'entrainement-arme-inhabituelle', { itemUid: 'wm1' });
    const pa = banc.getState().pendingActivity;
    expect(pa?.kind).toBe('catalog');
    expect(pa?.skillLabel).toMatch(/Corps à corps/); // arme de mêlée → CC imposé (« selon la spécialisation de l'arme »)
    expect(pa?.difficulty).toBe('complexe'); // « Complexe (−10) »
    forceRoll(4, true, 2);
    expect(hero().masteredWeapons).toEqual(['couteau-de-harald']);
    expect(st().left).toBe(2);
  });

  it('Entraînement : l’échec ne maîtrise rien (« attendre le prochain moment de pause ») ; arme ordinaire refusée', () => {
    armUnusualWeapon();
    pratiquer(banc.getState, hero().id, 'entrainement-arme-inhabituelle', { itemUid: 'wm1' });
    forceRoll(96, false, -3);
    expect(hero().masteredWeapons ?? []).toEqual([]);
    // Une arme SANS requiresMastery n'est pas une cible d'entraînement.
    const ordinary = hero().items!.find((i) => i.uid !== 'wm1' && (i.kind === 'melee' || i.kind === 'distance'));
    if (ordinary) {
      pratiquer(banc.getState, hero().id, 'entrainement-arme-inhabituelle', { itemUid: ordinary.uid });
      expect(banc.getState().pendingActivity).toBeNull();
    }
  });

  // ── Mécénat (variante d'Opération bancaire) ────────────────────────────────────────────────────
  it('Mécénat : mise minimale 5 CO ; dépôt puis retrait par Test d’Évaluation — +6 DR = 120 %', () => {
    const h = hero();
    banc.getState().deposerALaBanque(h.id, 'mecenat', 100); // < 5 CO → refus
    expect(banc.getState().bank).toHaveLength(0);
    expect(banc.getState().journal.join('\n')).toMatch(/mise minimale/);
    const stake = 5 * PA_PER_CO;
    banc.getState().deposerALaBanque(h.id, 'mecenat', stake);
    expect(banc.getState().bank).toEqual([{ uid: expect.any(String), heroId: h.id, kind: 'mecenat', brass: stake, rate: 0 }]);
    expect(st().left).toBe(2);
    const before = toBrass(partyMoneyTotal(banc.getState));
    const depot = banc.getState().bank[0].uid;
    banc.getState().retirerDeLaBanque(depot);
    const pa = banc.getState().pendingActivity;
    expect(pa?.kind).toBe('catalog');
    expect(pa?.depotId).toBe(depot);
    expect(pa?.skillLabel).toMatch(/valuation/); // Test d'Évaluation
    forceRoll(2, true, 6);
    expect(banc.getState().bank).toHaveLength(0);
    expect(toBrass(partyMoneyTotal(banc.getState))).toBe(before + Math.floor(stake * 1.2)); // « profit de 20 % »
    expect(st().left).toBe(1); // le retrait a coûté une Activité
  });

  it('Mécénat : échec du Test d’Évaluation = investissement perdu (payout 0)', () => {
    const h = hero();
    const stake = 5 * PA_PER_CO;
    banc.getState().deposerALaBanque(h.id, 'mecenat', stake);
    const before = toBrass(partyMoneyTotal(banc.getState));
    banc.getState().retirerDeLaBanque(banc.getState().bank[0].uid);
    forceRoll(97, false, -1);
    expect(banc.getState().bank).toHaveLength(0);
    expect(toBrass(partyMoneyTotal(banc.getState))).toBe(before); // rien ne revient
    expect(banc.getState().journal.join('\n')).toMatch(/perd son investissement/);
  });

  // ── Recherche universitaire ────────────────────────────────────────────────────────────────────
  it('Recherche universitaire : chaque +DR = −100 PX sur la mémorisation d’UN sort (plancher 100), achat immédiat', () => {
    const h = hero();
    h.talents.push({ talentId: 'magie-des-arcanes', spec: 'feu', times: 1 } as never);
    const feu = spells.filter((s) => s.family === 'arcane' && s.subType === 'Feu').map((s) => s.id);
    // BInt de A (Int ~30) = 3 → avec 4 sorts d'Arcane connus, le prochain coûte 100 × ⌈4/3⌉ = 200 PX.
    h.spells = feu.slice(0, 4);
    h.xp = 500;
    banc.setState({ party: [...banc.getState().party] });
    pratiquer(banc.getState, h.id, 'recherche-universitaire', { spellId: feu[4] });
    const pa = banc.getState().pendingActivity;
    expect(pa?.kind).toBe('catalog');
    expect(pa?.spellId).toBe(feu[4]);
    forceRoll(10, true, 1); // +1 DR → remise 100 : 200 − 100 = 100 PX
    expect(hero().spells).toContain(feu[4]);
    expect(hero().xp).toBe(400);
    expect(banc.getState().journal.join('\n')).toMatch(/remise de 100 PX/);
    expect(st().left).toBe(2);
  });

  it('Recherche universitaire : sans sort payant à mémoriser, l’Activité ne s’ouvre pas', () => {
    pratiquer(banc.getState, hero().id, 'recherche-universitaire', { spellId: 'drain' });
    expect(banc.getState().pendingActivity).toBeNull(); // soldat sans Talent de lanceur
  });

  it('les DEUX voies d’identification coexistent : ADE II (Savoir Magie) ET ACE (Recherche, à Altdorf)', () => {
    armArtefact();
    const h = hero();
    h.skills.push({ id: 'savoir', spec: 'magie', characteristic: 'intelligence', advances: 10 } as never);
    pratiquer(banc.getState, h.id, 'identify', { itemUid: 'art1' }); // voie ADE II (Savoir Magie)
    expect(banc.getState().pendingActivity?.activityId).toBe('identify');
    banc.getState().jetAnnuler('activite');
    pratiquer(banc.getState, h.id, 'tester-objets-magiques', { itemUid: 'art1' }); // voie ACE
    expect(banc.getState().pendingActivity?.kind).toBe('catalog');
  });
});
