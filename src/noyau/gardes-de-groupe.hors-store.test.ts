/**
 * Gardes de groupe (#3059 L7) : chaque verdict est UNE fonction du noyau, que le geste DIT quand il
 * refuse — composition du groupe, Rassemblement, table de taverne, récupération de nuit, réponse de
 * dialogue. Oracles littéraux.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { initialNet } from './etat';
import { groupeDeScenario } from '../scenes/test-scenarios/_heros';
import { profilsStandard } from '../data';
import { pretire } from '../data/pregens';
import { PRETIRE_DE_TEST, poserLesPretires } from './creation/pretireDeTest.testkit';
import { ensureBourse, setBourseBrass } from '../engine/bourse';
import { seedBattleRng } from './battleRng';
import { refusDAjoutAuGroupe } from './partyFlow';
import { refusDeRassemblement } from './massBattleFlow';
import { refusDeJouer, type ReglageDePartie } from './tavernFlow';
import { refusDeRecuperation, needsRecoveryRoll, applyRecoveryDay } from '../engine/rest';
import { restCost } from './restFlow';
import { refusDeLaValidationNommee } from './validationDeFenetre';
import { appliquerLIntentionDUnSiege } from './intentionsDeSiege';
import { toBrass } from '../engine/money';
import { t } from '../i18n';
import { fixtureText } from '../i18n/fixtureText';
import { addCondition, hasCondition } from '../engine/conditions';
import { ouvrirDialogue, reponsesDuNoeud } from './dialogue';
import type { Dialogue } from './monde/scene';
import type { Combatant } from '../engine/types';

let banc: Banc;
beforeEach(() => { poserLesPretires(); banc = ouvrirLeBanc(); seedBattleRng(7); });
const get = () => banc.getState();
const dernier = () => get().journal[get().journal.length - 1];

const heros = (n: number): Combatant[] =>
  groupeDeScenario(idsDeTest, 'soldat', 'tueur', 'sorcier', 'pretre', 'chasseur').slice(0, n).map((h) => ensureBourse(h, idsDeTest));
/** L'engagement du prétiré de test, posé au registre par `poserLesPretires`. */
const engagement = { pretire: PRETIRE_DE_TEST.id };

describe('composition du groupe — `refusDAjoutAuGroupe`', () => {
  it('hôte coop au quota épuisé, groupe 1/4 : le verdict et le geste disent le quota', () => {
    const [a] = heros(1);
    banc.setState({ party: [a], net: { ...initialNet(), mode: 'hote', slots: [0, 1, 1, 1], ownership: { [a.id]: 0 } } });
    expect(refusDAjoutAuGroupe(get(), undefined, 0)).toBe('Tous vos emplacements du groupe sont remplis.');
    get().recruterLeHeros(engagement);
    expect(get().party.map((h) => h.id)).toEqual([a.id]);
    expect(dernier()).toBe('Tous vos emplacements du groupe sont remplis.');
  });

  it('groupe plein : le geste dit le groupe complet', () => {
    banc.setState({ party: heros(4) });
    get().recruterLeHeros(engagement);
    expect(get().party).toHaveLength(4);
    expect(dernier()).toBe('Le groupe est complet (4 héros).');
  });

  it('pré-tiré inconnu : le geste le refuse et le dit', () => {
    const [a] = heros(1);
    banc.setState({ party: [a] });
    get().recruterLeHeros({ pretire: 'inconnu' });
    expect(get().party.map((h) => h.id)).toEqual([a.id]);
    expect(dernier()).toBe('Aucun pré-tiré ne porte l’id « inconnu ».');
  });

  it('héros déjà présent : le geste le nomme', () => {
    const a = pretire(idsDeTest, PRETIRE_DE_TEST.id);
    banc.setState({ party: [a] });
    get().recruterLeHeros(engagement);
    expect(dernier()).toBe(`${a.label} fait déjà partie du groupe.`);
  });
});

describe('Rassemblement — `refusDeRassemblement` (ADE II 08 l.122 : « tous les Personnages »)', () => {
  it('un héros NON blessé peut se rassembler entre deux Rounds', () => {
    const [a] = heros(1);
    expect(a.wounds.current).toBe(a.wounds.max);
    const mb = { phase: 'round', awaitingNext: true, ralliedHeroes: [] } as never;
    expect(refusDeRassemblement({ massBattle: mb, party: [a] })).toBeNull();
  });

  it('tous l’ont tenté ce Round : le refus le dit', () => {
    const [a] = heros(1);
    const mb = { phase: 'round', awaitingNext: true, ralliedHeroes: [a.id] } as never;
    expect(refusDeRassemblement({ massBattle: mb, party: [a] })).toBe('Tous les Personnages ont déjà tenté le Rassemblement ce Round.');
  });
});

describe('table de taverne — `refusDeJouer` (NADJ 16 l.17)', () => {
  const alZahr = (extra: Partial<ReglageDePartie> = {}): ReglageDePartie => ({
    gameId: 'al-zahr', opponent: { kind: 'profil', id: profilsStandard()[0] }, ...extra,
  });

  it('challenger à 11 sous de cuivre, mise de 11 sous : la partie s’ouvre, mise entière', () => {
    const [a] = heros(1);
    setBourseBrass(a, 11, idsDeTest);
    banc.setState({ party: [a] });
    const partie = alZahr({ stakeBrass: 11, tablePlayers: 3 });
    expect(refusDeJouer(get(), a.id, partie)).toBeNull();
    get().jouerALaTaverne(a.id, partie);
    expect((get().sequence!.chargeUtile as { stakeBrass: number }).stakeBrass).toBe(11);
  });

  it('table de 12 joueurs : acceptée, douze sièges', () => {
    const [a] = heros(1);
    setBourseBrass(a, 11, idsDeTest);
    banc.setState({ party: [a] });
    get().jouerALaTaverne(a.id, alZahr({ stakeBrass: 1, tablePlayers: 12 }));
    expect((get().sequence!.chargeUtile as { seats: unknown[] }).seats).toHaveLength(12);
  });

  it('sans mise : le verdict et le geste disent le même texte', () => {
    const [a] = heros(1);
    banc.setState({ party: [a] });
    const partie = alZahr({ stakeBrass: 0 });
    const texte = `${a.label} ne pose aucune mise : aucune partie ne s’ouvre.`;
    expect(refusDeJouer(get(), a.id, partie)).toBe(texte);
    get().jouerALaTaverne(a.id, partie);
    expect(get().sequence).toBeNull();
    expect(dernier()).toBe(texte);
  });
});

describe('récupération de nuit — `refusDeRecuperation` (LDB 18 l.338, LDB 16 l.74, l.105)', () => {
  const blesse = (): Combatant => {
    const [a] = heros(1);
    a.wounds = { ...a.wounds, current: a.wounds.max - 5 };
    return a;
  };

  it('héros assoiffé : pas de récupération', () => {
    const a = blesse();
    a.thirst = { days: 1, tests: 0, failures: 0 } as never;
    expect(refusDeRecuperation(a)).toBe('privé de vivres ou d’eau (pas de récupération)');
    expect(needsRecoveryRoll(a)).toBe(false);
  });

  it('Hémorragique : à stabiliser', () => {
    const a = blesse();
    addCondition(a, 'hemorragique', 1);
    expect(refusDeRecuperation(a)).toBe('à stabiliser (pas de repos réparateur)');
  });

  it('Empoisonné : bloque le soin à 0 Blessure, pas au-dessus', () => {
    const a = blesse();
    addCondition(a, 'empoisonne', 1);
    expect(refusDeRecuperation(a)).toBeNull();
    a.wounds = { ...a.wounds, current: 0 };
    expect(refusDeRecuperation(a)).toBe('empoisonné à 0 Blessure (aucune Blessure soignée)');
  });

  it('Empoisonné à 0 Blessure : la nuit ne soigne aucune Blessure, mais l’Exténué se dissipe', () => {
    const a = blesse();
    a.wounds = { ...a.wounds, current: 0 };
    addCondition(a, 'empoisonne', 1);
    addCondition(a, 'extenue', 1);
    applyRecoveryDay(a, { sl: 3, success: true });
    expect(a.wounds.current).toBe(0);
    expect(hasCondition(a, 'extenue')).toBe(false);
  });
});

describe('nuit — la validation du repos (`refusDeLaValidationNommee`, LDB 66)', () => {
  const ouvrir = (places: Record<string, boolean>) => get().offrirLeRepos({ lieu: fixtureText('Ici'), places } as never);

  it('solo, nuit gratuite : « Dormir » ouvre la nuit d’un appel', () => {
    banc.setState({ party: heros(1) });
    ouvrir({ camp: true });
    expect(refusDeLaValidationNommee(get(), 'repos')).toBeNull();
    get().fenetreValider('repos');
    expect(get().pendingRest, 'la nuit s’est ouverte').toBeNull();
  });

  it('coop : l’appel de l’hôte le marque prêt ; l’invité, prêt, ne dort pas ; l’hôte, au quorum, dort', () => {
    const [a, b] = heros(2);
    banc.setState({ party: [a, b], net: { ...initialNet(), mode: 'hote', seatNames: { 0: 'Hôte', 1: 'Invité' }, ownership: { [a.id]: 0, [b.id]: 1 }, slots: [1, 1, 0, 0] } });
    ouvrir({ camp: true });
    get().fenetreValider('repos');
    expect(get().pendingRest?.readyBySeat, '« Dormir » avant le quorum marque l’hôte prêt').toEqual({ 0: true });
    expect(refusDeLaValidationNommee(get(), 'repos')).toBe(t('jet.ferme.quorumAttendu'));
    expect(appliquerLIntentionDUnSiege(get, 1, 'fenetreValider', ['repos'])).toBe('appliquee');
    expect(get().pendingRest?.readyBySeat, 'le dernier prêt d’un invité ne dort pas pour l’hôte').toEqual({ 0: true, 1: true });
    get().fenetreValider('repos');
    expect(get().pendingRest, 'au quorum, l’hôte dort').toBeNull();
  });

  it('hôte seul non prêt : son appel le marque prêt et, seul siège requis, la nuit s’ouvre', () => {
    const [a] = heros(1);
    banc.setState({ party: [a], net: { ...initialNet(), mode: 'hote', seatNames: { 0: 'Hôte' }, ownership: { [a.id]: 0 } } });
    ouvrir({ camp: true });
    expect(refusDeLaValidationNommee(get(), 'repos')).toBeNull();
    get().fenetreValider('repos');
    expect(get().pendingRest, 'la nuit s’est ouverte').toBeNull();
  });

  it('bourse insuffisante pour la chambre : refusé, la raison dite', () => {
    const [a] = heros(1);
    setBourseBrass(a, 0, idsDeTest);
    banc.setState({ party: [a] });
    ouvrir({ auberge: true });
    get().fenetreChoisir('repos', 'couchage', 'privee', a.id);
    expect(toBrass(restCost(get().pendingRest!, get().party)), 'témoin : la chambre a un prix').toBeGreaterThan(0);
    expect(refusDeLaValidationNommee(get(), 'repos')).toBe(t('jet.ferme.noteNonCouverte'));
  });
});

describe('dialogue — le refus d’une réponse est un TEXTE, dit par le choix `dialogue.reponse`', () => {
  const dlg: Dialogue = { id: 'dlg-l7', start: { id: 'n1' }, nodes: [{ id: 'n1', desc: 'Alors ?', choices: [{ id: 'payer', label: 'Payer', cost: { gold: 50 }, next: { id: 'n1' } }] }] } as Dialogue;

  it('bourse trop courte : l’écran et le geste disent le même texte', () => {
    const [a] = heros(1);
    setBourseBrass(a, 0, idsDeTest);
    banc.setState({ party: [a] });
    banc.setState({ screen: 'campaign', dialogue: ouvrirDialogue(get(), dlg) });
    expect(reponsesDuNoeud(get())[0].refus).toBe('Pas assez d’argent pour cette option.');
    get().fenetreChoisir('dialogue', 'reponse', 'payer');
    expect(dernier()).toBe('Pas assez d’argent pour cette option.');
  });

  it('siège qui ne décide pas pour le groupe : le refus nomme le siège qui répond, et le geste le dit', () => {
    const [a] = heros(1);
    banc.setState({ party: [a], net: { ...initialNet(), mode: 'hote', gmSeat: 1, seatNames: { 1: 'Greta' } } });
    banc.setState({ screen: 'campaign', dialogue: ouvrirDialogue(get(), dlg) });
    expect(reponsesDuNoeud(get())[0].refus).toBe('Greta répond pour le groupe.');
    get().fenetreChoisir('dialogue', 'reponse', 'payer');
    expect(dernier()).toBe('Greta répond pour le groupe.');
  });
});
