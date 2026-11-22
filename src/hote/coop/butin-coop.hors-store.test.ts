import { expect, it, onTestFinished, vi } from 'vitest';
import { combattantDeTest } from '../../engine/combattantDeTest.testkit';
import { avecSequelles, type SequelleNeuve } from '../../engine/trauma';
import { t } from '../../i18n';
import { ouvrirLeBanc, type Banc } from '../../noyau/banc.testkit';
import { draineCascade } from '../../noyau/cascade.testkit';
import { applyEffects, nePeutPasDifferer } from '../../noyau/combatEffects';
import { checkBattleOver } from '../../noyau/combatFlow';
import { poserLeCombat } from '../../noyau/combatOrParty.testkit';
import { appliquerLInstantane } from '../../noyau/coop';
import { etatInitialDuJeu, type Jeu } from '../../noyau/etat';
import { appliquerLIntentionDUnSiege } from '../../noyau/intentionsDeSiege';
import { flowFromEffects } from '../../noyau/monde/flow';
import type { Ecrit } from '../../noyau/proprietaireDuJeu';
import { creerActionsDuReseau } from '../../noyau/reseau';
import { gesteDuVerbe, SANS_PISTE } from '../geste';
import { fenetreADessiner } from '../gestes';
import { parseMessage } from './protocol';
import { FakeSocket, portsDuTest, roomOuverte, stockageEnMap } from './relay.testkit';
import { creerLeSalon, type PortsDuSalon } from './salon';

function salonDuBanc(socket: FakeSocket, abonner: PortsDuSalon['abonner'] = () => () => {}) {
  return creerLeSalon({
    ...portsDuTest(() => socket),
    relais: () => 'http://localhost:8787',
    fetch: roomOuverte,
    stockage: stockageEnMap().stockage,
    abonner,
  });
}

async function relierLesSalons(hote: Banc) {
  vi.useFakeTimers();
  let miroir: ReturnType<Banc['getState']> = {
    ...hote.getState(), ...etatInitialDuJeu(),
    fenetreChoisir: () => { throw new Error('L’invité applique localement le choix de fenêtre'); },
  };
  const getState = () => miroir;
  const setState = (ecrit: Ecrit) => {
    miroir = { ...miroir, ...(typeof ecrit === 'function' ? ecrit(miroir) : ecrit) };
  };
  setState(creerActionsDuReseau(getState, setState));
  const invite = { getState, setState };
  const wsHote = new FakeSocket('ws://localhost:8787');
  const wsInvite = new FakeSocket('ws://localhost:8787');
  const salonHote = salonDuBanc(wsHote, hote.subscribe);
  const salonInvite = salonDuBanc(wsInvite);
  onTestFinished(() => {
    salonInvite.quitter(invite.getState);
    salonHote.quitter(hote.getState);
    vi.useRealTimers();
  });
  const appliquer = vi.fn((action: string, args: unknown[], siege: number) => {
    let refus: string | undefined;
    appliquerLIntentionDUnSiege(hote.getState, siege, action, args, (texte) => { refus = texte; });
    return refus;
  });
  const refusRecus: string[] = [];
  expect(await salonHote.heberger(hote.getState, appliquer, 'Hôte')).toBeNull();
  wsHote.open();
  const jonction = salonInvite.rejoindre(invite.getState,
    (donnees) => invite.setState(appliquerLInstantane(donnees, invite.getState()).etat),
    'ABC234', 'Invitée', (texte) => { refusRecus.push(texte); });
  wsHote.onSend = (brut) => {
    if (JSON.parse(brut).to === 1) wsInvite.receive(brut);
  };
  wsInvite.onSend = (brut) => {
    wsHote.receive(JSON.stringify({ ...JSON.parse(brut), from: 1 }));
  };
  wsInvite.open();
  wsHote.receive(JSON.stringify({ evt: 'join', seat: 1, name: 'Invitée' }));
  wsInvite.receive(JSON.stringify({ evt: 'seated', seat: 1, token: 'INV' }));
  expect(await jonction).toBeNull();
  const destinatairesDesRefus = () => wsHote.sent.flatMap((brut) => {
    const { to, data } = JSON.parse(brut) as { to?: number; data?: string };
    return data !== undefined && parseMessage(data)?.kind === 'intent-refused' ? [to] : [];
  });
  return { invite, appliquer, refusRecus, destinatairesDesRefus };
}

function victoire() {
  const banc = ouvrirLeBanc({ desFixes: true });
  const { hero: premier, ally, enemy } = poserLeCombat(banc.setState, {
    onVictory: flowFromEffects([
      { type: 'giveTrapping', objet: { id: 'dague' }, identified: false },
      { type: 'giveTrapping', objet: { id: 'bouclier' }, identified: false },
    ]),
  });
  const hero: typeof premier = {
    ...premier,
    characteristics: { ...premier.characteristics, intelligence: 80 },
    skills: [{ id: 'evaluation', characteristic: 'intelligence', advances: 5 }],
  };
  const bataille = banc.getState().battle!;
  banc.setState({ party: [hero, ally], battle: { ...bataille, combatants: [hero, ally, { ...enemy, dead: true }] } });
  expect(checkBattleOver(banc.getState, banc.setState)).toBe(true);
  const lignes = banc.getState().pendingVictory!.gear!;
  expect(lignes.map((ligne) => ligne.effect.objet?.id)).toEqual(['dague', 'bouclier']);
  expect(new Set(lignes.map((ligne) => ligne.uid)).size).toBe(2);
  return { banc, hero, ally, lignes };
}

function lignesOffertes(etat: Jeu, verbe: string, parametre: string): string[] {
  const geste = fenetreADessiner(etat)!.gestes.find((g) => g.cle === verbe)!;
  expect(geste.ouvert).toBe(true);
  const argument = geste.arguments.find((a) => a.nom === parametre)!;
  expect(argument.saisie).toBe('choix');
  return argument.valeurs!.map(({ valeur, refus }) => {
    expect(refus).toBeNull();
    if (typeof valeur !== 'string') throw new Error('Une ligne de butin doit être désignée par son identifiant');
    return valeur;
  });
}

function choisirLaLigne(banc: Pick<Banc, 'getState'>, uid: string, heroId: string) {
  const etat = banc.getState();
  const geste = gesteDuVerbe(etat, { type: 'fenetreChoisir', args: ['victoire', 'ligne', uid, heroId] }, SANS_PISTE);
  Reflect.apply(etat.fenetreChoisir, undefined, geste.args);
}

const attribution = (etat: Jeu) => lignesOffertes(etat, 'fenetreChoisir@victoire#ligne', 'valeur');
const inventaires = (banc: Pick<Banc, 'getState'>) => banc.getState().party.map((h) => (h.items ?? []).map((o) => o.trappingId));

it('en coop, un geste de victoire conserve sa ligne quand l’hôte retire la précédente', async () => {
  const { banc: hote, hero, ally, lignes } = victoire();
  const { invite, appliquer, refusRecus, destinatairesDesRefus } = await relierLesSalons(hote);
  hote.getState().affecterLeHerosAuSiege(ally.id, 1);
  await vi.advanceTimersToNextTimerAsync();
  expect(invite.getState().net).toMatchObject({ mode: 'invite', mySeat: 1, ownership: { [ally.id]: 1 } });
  const [premiere, seconde] = attribution(invite.getState());
  expect([premiere, seconde]).toEqual(lignes.map((ligne) => ligne.uid));

  choisirLaLigne(hote, attribution(hote.getState())[0], hero.id);
  expect(hote.getState().pendingVictory?.gear?.map((ligne) => ligne.uid)).toEqual([seconde]);
  expect(attribution(invite.getState())).toEqual([premiere, seconde]);
  expect(inventaires(hote)).toEqual([['dague'], []]);

  choisirLaLigne(invite, premiere, ally.id);
  Reflect.apply(invite.getState().fenetreChoisir, undefined, ['victoire', 'ligne', 0, ally.id]);
  await vi.advanceTimersByTimeAsync(0);
  expect(refusRecus).toEqual([t('coop.intentRefused'), t('coop.intentRefused')]);
  expect(appliquer).not.toHaveBeenCalled();
  expect(inventaires(hote)).toEqual([['dague'], []]);

  choisirLaLigne(invite, seconde, ally.id);
  await vi.advanceTimersByTimeAsync(0);
  expect(appliquer.mock.calls).toEqual([['fenetreChoisir', ['victoire', 'ligne', seconde, ally.id], 1]]);
  expect(inventaires(hote)).toEqual([['dague'], ['bouclier']]);
  expect(hote.getState().pendingVictory?.gear).toEqual([]);

  choisirLaLigne(invite, seconde, ally.id);
  await vi.advanceTimersByTimeAsync(0);
  expect(appliquer).toHaveBeenCalledTimes(1);
  expect(inventaires(hote)).toEqual([['dague'], ['bouclier']]);
  expect(refusRecus).toEqual(Array(3).fill(t('coop.intentRefused')));
  expect(destinatairesDesRefus()).toEqual([1, 1, 1]);
  expect(hote.getState().refus).toBeNull();

  await vi.advanceTimersToNextTimerAsync();
  expect(inventaires(invite)).toEqual([['dague'], ['bouclier']]);
});

it('l’évaluation de victoire identifie la ligne encore offerte après l’attribution', () => {
  const { banc, hero, lignes } = victoire();
  choisirLaLigne(banc, attribution(banc.getState())[0], hero.id);
  const etat = banc.getState();
  const options = lignesOffertes(etat, 'evaluerLObjet', 'aEvaluer');
  expect(options).toEqual([lignes[1].uid]);
  const geste = gesteDuVerbe(etat, { type: 'evaluerLObjet', args: options }, SANS_PISTE);
  Reflect.apply(etat.evaluerLObjet, undefined, geste.args);
  expect(banc.getState().pendingAppraise).toMatchObject({ gear: { scope: 'victoire', uid: lignes[1].uid }, itemName: lignes[1].label });
  expect(banc.getState().pendingVictory!.gear![0].effect.identified).toBe(false);

  banc.getState().jetImposerLeResultat('evaluation', 1);
  expect(banc.getState().pendingAppraise).toMatchObject({ roll: 1, success: true });
  banc.getState().jetValider('evaluation');
  const [bouclier] = banc.getState().pendingVictory!.gear!;
  expect(bouclier.uid).toBe(lignes[1].uid);
  expect(bouclier.effect.identified).toBeUndefined();
  const dague = banc.getState().party.find((h) => h.id === hero.id)!.items!.find((o) => o.trappingId === 'dague');
  expect(dague?.identified).toBe(false);
});

function patient(id: string, localisations: [SequelleNeuve['location'], SequelleNeuve['location']]) {
  const traumas = avecSequelles([], localisations.map((location, index) => ({
    label: `Plaie ${id}${index + 1}`,
    location,
    needsSurgery: true,
  })));
  return { ...combattantDeTest({ id, kind: 'heros', label: id }), traumas };
}

function laSecondePlaie(etat: Jeu, premierePlaie: string, secondePlaie: string) {
  const choix = fenetreADessiner(etat)!.gestes.find((g) => g.cle === 'fenetreChoisir@infirmerie#plaie')!;
  expect(choix.ouvert).toBe(true);
  const [premiere, seconde] = choix.arguments.find((a) => a.nom === 'valeur')!.valeurs!;
  expect(premiere.libelle).toContain(premierePlaie);
  expect(seconde.libelle).toContain(secondePlaie);
  const geste = gesteDuVerbe(etat, { type: choix.verbe, args: ['infirmerie', 'plaie', seconde.valeur] }, SANS_PISTE);
  return geste.args;
}

function soignant() {
  return combattantDeTest({
    id: 'soignant', label: 'Soignant', kind: 'heros',
    characteristics: { intelligence: 95 },
    skills: [{ id: 'guerison', advances: 30, characteristic: 'intelligence' }],
    talents: [{ talentId: 'chirurgie', times: 1 }],
  });
}

const traumasDuPatient = (etat: Jeu, id: string) => etat.party.find((h) => h.id === id)!.traumas!;

it('en coop, le choix d’une plaie reste attaché au patient affiché', async () => {
  const a = patient('A', ['jambeG', 'brasD']);
  const b = patient('B', ['brasG', 'tete']);
  expect(a.traumas[1].uid).toBe(b.traumas[1].uid);
  const hote = ouvrirLeBanc({ etat: { party: [soignant(), a, b] } });
  const { invite, appliquer, refusRecus, destinatairesDesRefus } = await relierLesSalons(hote);
  hote.getState().ouvrirLeMedecin(a.id);
  await vi.advanceTimersToNextTimerAsync();
  expect(invite.getState().pendingHeal?.targetId).toBe(a.id);
  const choixPourA = laSecondePlaie(invite.getState(), 'Plaie A1', 'Plaie A2');

  hote.getState().fenetreChoisir('infirmerie', 'patient', b.id);
  const [bras, tete] = traumasDuPatient(hote.getState(), b.id);
  expect(hote.getState().pendingHeal).toMatchObject({ targetId: b.id, plaie: bras.uid });
  expect(invite.getState().pendingHeal?.targetId).toBe(a.id);
  Reflect.apply(invite.getState().fenetreChoisir, undefined, choixPourA);
  await vi.advanceTimersByTimeAsync(0);
  expect(hote.getState().pendingHeal).toMatchObject({ targetId: b.id, plaie: bras.uid });
  expect(appliquer).not.toHaveBeenCalled();
  expect(refusRecus).toEqual([t('coop.intentRefused')]);
  expect(hote.getState().refus).toBeNull();
  expect(destinatairesDesRefus()).toEqual([1]);

  await vi.advanceTimersToNextTimerAsync();
  expect(invite.getState().pendingHeal?.targetId).toBe(b.id);
  const choixPourB = laSecondePlaie(invite.getState(), 'Plaie B1', 'Plaie B2');
  Reflect.apply(invite.getState().fenetreChoisir, undefined, choixPourB);
  await vi.advanceTimersByTimeAsync(0);
  expect(appliquer.mock.calls).toEqual([['fenetreChoisir', choixPourB, 1]]);
  expect(hote.getState().pendingHeal).toMatchObject({ targetId: b.id, plaie: tete.uid });
  expect(refusRecus).toEqual([t('coop.intentRefused')]);
});

it('en coop, la plaie qui remplace une plaie opérée ne reçoit pas le geste périmé', async () => {
  const a = patient('A', ['jambeG', 'brasD']);
  const hote = ouvrirLeBanc({
    desFixes: true, reglesMaison: { 'chirurgie-dr-cible': 5 },
    etat: { party: [soignant(), a] },
  });
  const { invite, appliquer, refusRecus, destinatairesDesRefus } = await relierLesSalons(hote);
  hote.getState().ouvrirLeMedecin(a.id);
  await vi.advanceTimersToNextTimerAsync();
  const anciennePlaie = laSecondePlaie(invite.getState(), 'Plaie A1', 'Plaie A2');

  const operation = laSecondePlaie(hote.getState(), 'Plaie A1', 'Plaie A2');
  Reflect.apply(hote.getState().fenetreChoisir, undefined, operation);
  hote.getState().jetLancer('soins');
  hote.getState().jetImposerLeResultat('chirurgie', 1);
  expect(hote.getState().pendingSurgery).toMatchObject({ roll: 1, success: true });
  hote.getState().jetValider('chirurgie');
  draineCascade(hote.getState);
  expect(traumasDuPatient(hote.getState(), a.id).map((p) => p.location)).toEqual(['jambeG']);

  nePeutPasDifferer(applyEffects(hote.getState, hote.setState, [
    { type: 'inflictTrauma', kind: 'fracture', severity: 'majeur', location: 'tete', heroId: a.id },
  ]), 'fracture à la tête après la chirurgie');
  draineCascade(hote.getState);
  hote.getState().jetRegler('soins', 'mode', 'chirurgie');
  const [jambe, tete] = traumasDuPatient(hote.getState(), a.id);
  expect([jambe.location, tete.location]).toEqual(['jambeG', 'tete']);
  expect(hote.getState().pendingHeal).toMatchObject({ targetId: a.id, plaie: jambe.uid });

  Reflect.apply(invite.getState().fenetreChoisir, undefined, anciennePlaie);
  await vi.advanceTimersByTimeAsync(0);
  expect(hote.getState().pendingHeal).toMatchObject({ targetId: a.id, plaie: jambe.uid });
  expect(appliquer).not.toHaveBeenCalled();
  expect(refusRecus).toEqual([t('coop.intentRefused')]);
  expect(destinatairesDesRefus()).toEqual([1]);

  await vi.advanceTimersToNextTimerAsync();
  const nouvellePlaie = laSecondePlaie(invite.getState(), jambe.label, tete.label);
  Reflect.apply(invite.getState().fenetreChoisir, undefined, nouvellePlaie);
  await vi.advanceTimersByTimeAsync(0);
  expect(appliquer.mock.calls).toEqual([['fenetreChoisir', nouvellePlaie, 1]]);
  expect(hote.getState().pendingHeal).toMatchObject({ targetId: a.id, plaie: tete.uid });
});
