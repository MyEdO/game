/**
 * LE CALENDRIER D'UN TEST OPPOSÉ À JET FIGÉ EN COOP (#990, #3059 J6), sur transport en mémoire (`FakeTransport`) :
 * l'hôte du siège 0 tient le rôle MJ et jette pour l'ennemi ; l'invité du siège 1 répond avec son héros, chez l'hôte
 * (`appliquerLIntentionDUnSiege`). Avant la réponse, le jet figé de l'ennemi est révélé à l'hôte, qui l'a jeté, et
 * masqué chez l'invité (`jetFigeRevele`), dans la fenêtre comme dans ses jets en vue (`jetsEnVue`) ; après, les deux côtés
 * voient la même ligne. En Défense, puis au Contre-sort.
 */
import { describe, it, expect, onTestFinished, vi } from 'vitest';
import { FakeTransport } from './transport.testkit';
import { HostSession, GuestSession } from './session';
import { ouvrirLeBanc, type Banc } from '../../noyau/banc.testkit';
import { appliquerLIntentionDUnSiege } from '../../noyau/intentionsDeSiege';
import { openAttackCascade } from '../../noyau/combatFlow';
import { JET_FIGE, jetFigeRevele } from '../../noyau/netOwnership';
import { jetsEnVue } from '../../noyau/jetsEnVue';
import type { FlowKey } from '../../noyau/flowVerbs';
import { seedBattleRng } from '../../noyau/battleRng';
import { armerLeCarreau, lancerLeCarreau, netDuTest as NET, repondantDuContreSort } from '../../noyau/contre-sort.testkit';
import { projeter } from '../projection';
import { fenetreADessiner } from '../gestes';
import { zonesDeLEcran } from '../ecran';
import { SANS_ROSTER } from '../roster';
import { rendreLaVue } from '../../hoteTexte/vue';
import { t } from '../../i18n';
import { testScene } from '../../scenes/test-fixture';
import { herosDeScenario } from '../../scenes/test-scenarios/_heros';
import { idsDeTest } from '../../engine/idsDeTest.testkit';
import { appliquerLInstantane, instantaneDeLaCoop } from '../../noyau/coop';
import { etatInitialDuJeu, type BattleState, type Jeu } from '../../noyau/etat';
import type { Combatant, Weapon } from '../../engine/types';
import { blessuresSurLeProfil, blessuresDeBase } from '../../engine/combattantDeTest.testkit';
import { buildSeaPlan } from '../../noyau/seaVoyageFlow';
import { MINUTES_PER_DAY } from '../../engine/clock';

const sorcierDeTest = () => herosDeScenario(idsDeTest, 'sorcier');

function table(banc: Banc, invite: string) {
  const host = new HostSession({
    build: 'test',
    applyIntent: (action, args, seat) => { appliquerLIntentionDUnSiege(banc.getState, seat, action, args); },
    getSnapshot: () => instantaneDeLaCoop(banc.getState()),
  });
  const invites = [1, 2, 3].map((siege) => {
    let recu: Record<string, unknown> | null = null;
    const [a, b] = FakeTransport.pair();
    const guest = new GuestSession({ build: 'test', label: 'Antoine', applySnapshot: (snapshot) => { recu = snapshot; } });
    host.addGuest(a, siege);
    guest.connect(b);
    const etat = (): Jeu => {
      host.broadcastSnapshot();
      expect(recu).not.toBeNull();
      return { ...banc.getState(), ...appliquerLInstantane(recu!, { ...etatInitialDuJeu(), net: NET('invite', siege, invite) }).etat };
    };
    return { guest, etat };
  });
  return { guest: invites[0].guest, chezLInvite: invites[0].etat, invites };
}

/** Les deux sorties de présentation produites ensemble par le pont, après sérialisation. */
function presentation(etat: Jeu) {
  const projection = projeter(etat, 0, etat.journal.length, { autres: Infinity, offres: Infinity, cibles: Infinity, gestes: Infinity, entites: Infinity });
  const zones = zonesDeLEcran(etat, projection, fenetreADessiner(etat), null, SANS_ROSTER);
  const json = JSON.stringify({ projection, zones });
  return { ...JSON.parse(json) as { projection: typeof projection; zones: typeof zones }, json };
}

const chars = { 'capacite-de-combat': 45, 'capacite-de-tir': 50, force: 35, endurance: 35, initiative: 30, agilite: 40, dexterite: 30, intelligence: 40, 'force-mentale': 30, sociabilite: 30 };
const rapiere: Weapon = { name: 'Rapière', label: 'Rapière', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, uid: 'ra', qualities: [{ id: 'rapide' }] } as unknown as Weapon;
const mk = (id: string, kind: 'heros' | 'ennemi', pos: { x: number; y: number }): Combatant =>
  (blessuresSurLeProfil({ id, name: id, label: id, kind, characteristics: { ...chars }, conditions: [], engagedWith: [], skills: [], talents: [], items: [],
     weapons: [rapiere], advantage: 0, size: 'moyenne', pos, wounds: blessuresDeBase(18),
     armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4 }) as unknown as Combatant);

/** Ce que la Défense montre de l'attaque figée : son verdict de révélation, et la ligne de l'attaquant. */
function attaqueVue(s: Jeu): { revele: boolean; ligne: unknown } {
  const pd = s.pendingDefense!;
  return { revele: jetFigeRevele(s, JET_FIGE.defense(pd)), ligne: pd.result ? pd.result.attackerDetail : pd.atk };
}

/** La ligne de `qui` dans les jets en vue du flux `flux`. */
const ligneEnVue = (s: Jeu, flux: FlowKey, qui: string) => jetsEnVue(s).find((v) => v.flux === flux)?.lignes.find((l) => l.qui === qui);

describe('Test opposé à jet figé en coop : masqué chez l’invité avant sa réponse, la même ligne ensuite', () => {
  it.each(['mêlée', 'tir en mer'] as const)('Défense du héros de l’invité contre l’ennemi que l’hôte jette au siège MJ (%s)', (attaque) => {
    const banc = ouvrirLeBanc({ etat: { net: NET('hote', 0, 'h') } });
    seedBattleRng(7);
    const enMer = attaque === 'tir en mer';
    const arc: Weapon = { label: 'Arc', uid: 'arc', type: 'distance', damage: { plusBF: false, flat: 3 }, range: 150, qualities: [] };
    const arme = enMer ? arc : rapiere;
    const ennemi = mk('e', 'ennemi', { x: enMer ? 6 : 1, y: 0 });
    ennemi.weapons = [arme];
    const combatants = [ennemi, mk('h', 'heros', { x: 0, y: 0 })];
    const order = combatants.map((c) => c.id);
    banc.setState({
      battle: { combatants, order, baseOrder: order, turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
        movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null } as unknown as BattleState,
      mode: 'battle', scene: { ...testScene(), metresPerTile: 2 }, party: combatants.filter((c) => c.kind === 'heros'),
    });
    if (enMer) {
      banc.setState({ gameTime: 8 * 60, vessel: {
        vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] },
        meteosImposees: [{ label: 'Brouillard', jusqua: MINUTES_PER_DAY, meteo: { visibilite: { id: 'brouillard' } } }],
      } });
      const plan = buildSeaPlan(banc.getState, 'route', 'a', 'b', { km: 100, seaHeading: 'est' })!;
      banc.setState({ travelPlan: { ...plan, interrupted: true } });
    }
    const { guest, chezLInvite } = table(banc, 'h');
    openAttackCascade(banc.getState, banc.setState, { attackerId: 'e', targetId: 'h', location: null, result: null, weaponUid: arme.uid }, 'Attaque', 'action/attaquer');
    banc.getState().jetLancer('attaque');
    const attaqueJouee = banc.getState().pendingAttack!.result!.attackerDetail!;
    banc.getState().jetValider('attaque');
    const pd = banc.getState().pendingDefense;
    expect(pd?.result, 'chemin : la Défense du héros de l’invité s’ouvre, sans réponse').toBeNull();
    const modsDR = enMer ? [expect.objectContaining({ label: 'Brouillard', value: -2 })] : undefined;
    expect(attaqueJouee.modsDR).toEqual(modsDR);
    expect(attaqueVue(banc.getState()).revele, 'l’hôte a jeté l’attaque : il la voit').toBe(true);
    expect(attaqueVue(chezLInvite()).revele, 'l’invité n’a pas répondu : l’attaque lui est masquée').toBe(false);
    const jetDeLAttaque = { d100: attaqueJouee.roll, dr: attaqueJouee.sl, reussi: attaqueJouee.success };
    expect(ligneEnVue(banc.getState(), 'defense', 'e'), 'jets en vue de l’hôte : l’attaque tombée')
      .toMatchObject({ jet: jetDeLAttaque, ...(modsDR ? { modsDR } : {}) });
    expect(ligneEnVue(chezLInvite(), 'defense', 'e'), 'jets en vue de l’invité : l’attaque à lancer, sans d100 ni DR ni verdict')
      .toMatchObject({ genre: 'test', qui: 'e', etat: 'masque', cible: null, jet: null });
    expect(jetsEnVue(chezLInvite()).find((v) => v.flux === 'defense')?.oppose, 'aucune gagnante ni DR net chez l’invité').toBeNull();
    guest.sendIntent('jetLancer', ['defense']);
    expect(banc.getState().pendingDefense?.result, 'la réponse de l’invité est posée chez l’hôte').toBeTruthy();
    expect(attaqueVue(chezLInvite())).toEqual({ ...attaqueVue(banc.getState()), revele: true });
    expect(ligneEnVue(chezLInvite(), 'defense', 'e'), 'après la réponse : l’attaque tombée chez l’invité')
      .toMatchObject({ jet: jetDeLAttaque, ...(modsDR ? { modsDR } : {}) });
    expect(jetsEnVue(chezLInvite()), 'après la réponse : les mêmes jets en vue des deux côtés').toEqual(jetsEnVue(banc.getState()));
  });

  it('le Contre-sort révèle le jet figé à l’hôte, puis au répondant et aux deux tiers', () => {
    onTestFinished(() => { vi.restoreAllMocks(); });
    const banc = ouvrirLeBanc();
    const get = banc.getState;
    armerLeCarreau(banc, testScene(), sorcierDeTest);
    const { guest, invites } = table(banc, repondantDuContreSort);
    expect(get().pendingCast?.result).toBeNull();

    const vues = () => [get(), ...invites.map((invite) => invite.etat())].map(presentation);
    const lanceur = (p: ReturnType<typeof presentation>) => p.projection.jets.find((j) => j.flux === 'incantation')!.lignes[0];
    const elementDuDe = (p: ReturnType<typeof presentation>) => p.zones['fenetre.corps'].find((e) => e.id === 'jet');
    const avant = vues();
    for (const p of avant) {
      const ligne = lanceur(p);
      expect(ligne).toMatchObject({ etat: 'aJouer', cible: 75, reference: { genre: 'sort', id: 'carreau' }, composition: { base: 65 }, mods: [expect.objectContaining({ value: 10 })], jet: null });
      expect(elementDuDe(p)).toMatchObject({ cible: '≤ 75', resultat: null, dr: null, modificateurs: [expect.objectContaining({ valeur: '+10' })] });
    }

    lancerLeCarreau(banc);
    expect(get().pendingCounterspell?.participants).toMatchObject([{ id: 'L', interactive: true, result: null }]);
    const test = get().pendingCast!.result!;
    expect(test).toMatchObject({ roll: 30, target: 75 });
    const [hote, ...avantReponse] = vues();
    expect(elementDuDe(hote)).toMatchObject({ resultat: '30', cible: '≤ 75', dr: 'DR +4' });
    for (const p of avantReponse) {
      expect(elementDuDe(p)).toMatchObject({ resultat: t('ecran.jet.cache'), cible: null, dr: null, verdict: null, detail: null, modificateurs: [] });
      expect(p.json).not.toMatch(/"≤ 75"|"d100":30|"resultat":"30"|"DR \+4"|"1 pas sur 1"/);
      expect(p.zones['fenetre.corps'].map((e) => e.id)).not.toContain('surincantation');
      expect(lanceur(p)).toMatchObject({ etat: 'masque', cible: null, jet: null });
      expect(lanceur(p)).not.toHaveProperty('composition');
      expect(lanceur(p)).not.toHaveProperty('mods');
      expect(p.projection.jets.find((j) => j.flux === 'contreSort')?.oppose).toBeNull();
      expect(p.projection.fenetre!.gestes.every((g) => g.flux !== 'incantation')).toBe(true);
      expect(p.projection.fenetre!.gestes.some((g) => g.flux === 'contreSort' && g.verbe === 'jetLancer')).toBe(true);
      expect(Object.keys(p.projection.fenetre!.fermes).every((id) => !id.includes('@incantation'))).toBe(true);
      const ligneTexte = rendreLaVue(p.projection).find((l) => l.startsWith('jet incantation :'));
      expect(ligneTexte).toContain(t('ecran.jet.cache'));
      expect(ligneTexte).not.toContain('30/75');
    }
    expect(lanceur(hote)).toMatchObject({ etat: 'revele', jet: { d100: 30, dr: 4 } });

    guest.sendIntent('jetRegler', ['contreSort', 'declaration', 'solo', 'L']);
    guest.sendIntent('jetLancer', ['contreSort', 'L']);
    expect(get().pendingCounterspell?.participants[0].result).toBeTruthy();
    for (const p of vues()) {
      expect(lanceur(p)).toMatchObject({ id: expect.any(String), etat: 'revele', cible: 75, jet: { d100: 30, dr: 4, verdict: 'reussite' } });
      expect(elementDuDe(p)).toMatchObject({ resultat: '30', cible: '≤ 75', dr: 'DR +4' });
    }
    get().jetValider('contreSort');
    expect(get().pendingCounterspell).toBeNull();
    expect(get().pendingCast?.result).toBeTruthy();
    for (const p of vues()) {
      expect(p.projection.jets.some((j) => j.flux === 'contreSort')).toBe(false);
      expect(lanceur(p).jet).toMatchObject({ d100: 30, dr: 4, verdict: 'reussite' });
    }
    const resultat = get().pendingCast!.result!;
    expect(resultat.sl).not.toBe(4);
    get().jetAjouterUnDR('incantation');
    expect(get().pendingCast!.result!.sl).toBe(resultat.sl + 1);
    for (const p of vues()) {
      expect(lanceur(p).jet).toMatchObject({ d100: 30, dr: 5, verdict: 'reussite' });
    }
  });

  it('Contre-sort : deux répondants reçoivent le jet figé après leur réponse respective', () => {
    onTestFinished(() => { vi.restoreAllMocks(); });
    const banc = ouvrirLeBanc();
    const [premier, second] = armerLeCarreau(banc, testScene(), sorcierDeTest, 2);
    const { invites } = table(banc, premier);
    lancerLeCarreau(banc, 95, 98);
    const reponses = () => banc.getState().pendingCounterspell!.participants;
    expect(reponses()).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: premier, interactive: true, result: null }),
      expect.objectContaining({ id: second, interactive: true, result: null }),
    ]));
    const lire = () => invites.map(({ etat }) => presentation(etat()).projection.jets);
    const etats = () => lire().map((jets) => jets.find((j) => j.flux === 'incantation')!.lignes[0].etat);
    expect(etats()).toEqual(['masque', 'masque', 'masque']);

    invites[0].guest.sendIntent('jetRegler', ['contreSort', 'declaration', 'solo', premier]);
    invites[1].guest.sendIntent('jetRegler', ['contreSort', 'declaration', 'solo', second]);
    invites[0].guest.sendIntent('jetLancer', ['contreSort', premier]);
    expect(reponses().find((p) => p.id === premier)?.result).toBeTruthy();
    expect(reponses().find((p) => p.id === second)?.result).toBeNull();
    expect(etats()).toEqual(['revele', 'masque', 'revele']);
    expect(lire().map((jets) => jets.find((j) => j.flux === 'contreSort')!.comparaisons?.length ?? 0)).toEqual([1, 0, 1]);

    invites[1].guest.sendIntent('jetLancer', ['contreSort', second]);
    expect(reponses().find((p) => p.id === second)?.result).toBeTruthy();
    expect(etats()).toEqual(['revele', 'revele', 'revele']);
    expect(lire().map((jets) => jets.find((j) => j.flux === 'contreSort')!.comparaisons?.length ?? 0)).toEqual([2, 2, 2]);
  });
});
