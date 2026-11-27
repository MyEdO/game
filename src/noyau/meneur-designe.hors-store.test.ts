/**
 * LE MENEUR COMMUN DÉSIGNÉ PAR LE SIÈGE DU MONDE (#4530). Question tenue ici : le siège du monde désigne un héros
 * debout (`designerLeMeneur`) ; qui marche, qui porte la lampe, qui la projection met en tête, et qui mène quand ce héros
 * tombe, se relève, quitte le groupe ou y revient ? Et quel siège peut le désigner, par l'intention routée comme par le
 * geste local de l'hôte ?
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { emptyScene, type Scene } from './monde/scene';
import { meneurDuMonde } from './monde/combatants';
import { sceneLightSources } from './visionState';
import { gestesDExploration } from './gestesDExploration';
import { appliquerLIntentionDUnSiege } from './intentionsDeSiege';
import { creerPartie, etatInitialDuJeu, type EntreesDeLaPartie, type EtatDeJeu } from './index';
import { initialNet, type NetState } from './etat';
import { bus, EVT } from './bus';
import { projeter } from '../hote/projection';
import { chargerSurLeBanc, sauverLeBanc } from './persistance/save.testkit';
import { idDuPretire } from '../data/pregens';
import { engage } from './creation/engagement.testkit';
import { combattantDeTest, blessuresDeBase } from '../engine/combattantDeTest.testkit';
import { t } from '../i18n';
import type { Combatant } from '../engine/types';
import type { LigneDuJournal } from './partie';

let banc: Banc;

const A = idDuPretire('a');
const B = idDuPretire('b');

const hero = (id: string, wounds = 12): Combatant =>
  combattantDeTest({ id, label: id.toUpperCase(), kind: 'heros', species: 'humains-reiklander', xp: 0, wounds: blessuresDeBase(12, wounds), conditions: [], movement: 4 });

/** `id` à `wounds` Blessures, le reste du groupe inchangé. */
const blesser = (id: string, wounds: number) =>
  banc.setState({ party: banc.getState().party.map((h) => (h.id === id ? { ...h, wounds: { ...h.wounds, current: wounds } } : h)) });

function salle(): Scene {
  const s = emptyScene('scene-test', 12, 12);
  s.id = 'salle';
  s.entities = [{ id: 'hs', kind: 'heroStart', pos: { x: 5, y: 5 } }];
  return s;
}

/** `salle()` et sa sortie vers une autre scène en (8,5) : un geste de marche offert (`exploration.sortie`). */
function salleASortie(): Scene {
  return { ...salle(), triggers: [{ id: 'sortie', rect: { x: 8, y: 5, w: 1, h: 1 }, flow: { kind: 'effet', effet: { type: 'transition', scene: { id: 'ailleurs' } } } }] } as Scene;
}

function poser(party: Combatant[], net: Partial<NetState> = {}, scene: Scene = salle()) {
  banc.setState({ party, scene: null, mode: 'exploration', journal: [], battle: null, dialogue: null, pendingInteract: null });
  banc.getState().lancerLaScene(scene);
  banc.setState({ net: { ...initialNet(), seatNames: { 0: 'Hôte', 1: 'Invité' }, ...net } });
}

const journal = () => banc.getState().journal.map((e) => e.texte);
const BORNES = { autres: 9, offres: 9, cibles: 9, gestes: 99, entites: 9 };
const gestesDeMarche = () => gestesDExploration(banc.getState()).filter((g) => g.gestes.some((x) => x.verbe === 'cliquerLaCase'));
const gestesDuMeneur = () => gestesDExploration(banc.getState()).filter((g) => g.gestes.some((x) => x.verbe === 'designerLeMeneur'));

describe('le meneur désigné mène le groupe', () => {
  beforeEach(() => { banc = ouvrirLeBanc(); poser([hero(A), hero(B)]); });

  it('désigné, il est celui que la marche anime, qui porte la lampe et que la projection met en tête', () => {
    banc.getState().designerLeMeneur(B);
    expect(meneurDuMonde(banc.getState())?.id).toBe(B);
    const anims: string[] = [];
    const ecoute = (p: { id: string }) => anims.push(p.id);
    bus.on(EVT.ANIM_MOVE, ecoute as never);
    banc.getState().avancerDUnPas('avant');
    bus.off(EVT.ANIM_MOVE, ecoute as never);
    expect(anims, 'la marche anime le meneur désigné').toEqual([B]);
    banc.setState({ party: banc.getState().party.map((h) => (h.id === A ? ({ ...h, activeEffects: [{ light: { radiusM: 6 } }] } as unknown as Combatant) : h)) });
    expect(sceneLightSources(banc.getState()).filter((src) => src.carried).map((src) => src.srcId), 'la lampe du groupe est portée par le meneur désigné').toEqual([B]);
    expect(projeter(banc.getState(), 0, 0, BORNES).exploration?.heros.map((h) => h.id)).toEqual([B, A]);
  });

  it('sans désignation, la projection met en tête le meneur élu : le premier debout', () => {
    blesser(A, 0);
    expect(projeter(banc.getState(), 0, 0, BORNES).exploration?.heros.map((h) => h.id)).toEqual([B, A]);
  });

  it('à terre, l’élection reprend ; relevé, il mène de nouveau', () => {
    banc.getState().designerLeMeneur(B);
    blesser(B, 0);
    expect(meneurDuMonde(banc.getState())?.id).toBe(A);
    expect(banc.getState().meneurChoisi, 'à terre, il reste du groupe et désigné').toBe(B);
    blesser(B, 12);
    expect(meneurDuMonde(banc.getState())?.id).toBe(B);
  });

  it('renvoyé, sa désignation tombe ; re-recruté sous le même id, l’élection mène', () => {
    banc.getState().designerLeMeneur(B);
    banc.getState().renvoyerLeHeros(B);
    expect(banc.getState().meneurChoisi).toBeNull();
    expect(meneurDuMonde(banc.getState())?.id).toBe(A);
    banc.getState().recruterLeHeros(engage(B));
    expect(banc.getState().party.map((h) => h.id)).toEqual([A, B]);
    expect(meneurDuMonde(banc.getState())?.id).toBe(A);
  });

  it('en combat, le geste local est refusé et dit, comme l’intention routée', () => {
    banc.setState({ battle: { combatants: banc.getState().party } as never });
    banc.getState().designerLeMeneur(B);
    expect(banc.getState().meneurChoisi).toBeNull();
    expect(banc.getState().refus?.texte).toBe(t('meneur.refus.enCombat'));
  });

  it('refus dits : un héros hors du groupe, un héros qui n’est pas debout', () => {
    banc.getState().designerLeMeneur('inconnu');
    expect(journal()).toContain(t('meneur.refus.horsDuGroupe', { id: 'inconnu' }));
    blesser(B, 0);
    banc.getState().designerLeMeneur(B);
    expect(journal()).toContain(t('meneur.refus.aTerre', { heros: B.toUpperCase() }));
    expect(banc.getState().meneurChoisi).toBeNull();
  });

  it('l’offre : un geste par autre héros debout, aucun pour le meneur ni pour un héros à terre', () => {
    expect(gestesDuMeneur()).toEqual([{ libelle: t('exploration.meneur', { heros: B.toUpperCase() }), gestes: [{ verbe: 'designerLeMeneur', args: [B] }] }]);
    banc.getState().designerLeMeneur(B);
    expect(gestesDuMeneur().map((g) => g.gestes[0].args)).toEqual([[A]]);
    blesser(A, 0);
    expect(gestesDuMeneur()).toEqual([]);
  });
});

describe('la sauvegarde garde le meneur désigné', () => {
  it('sauvée puis reprise, la désignation mène encore', () => {
    banc = ouvrirLeBanc();
    poser([hero(A), hero(B)]);
    banc.getState().designerLeMeneur(B);
    const texte = sauverLeBanc(banc);
    banc.setState({ meneurChoisi: null });
    chargerSurLeBanc(banc, texte);
    expect(banc.getState().meneurChoisi).toBe(B);
    expect(meneurDuMonde(banc.getState())?.id).toBe(B);
  });
});

describe('le siège du monde désigne le meneur — intention routée', () => {
  beforeEach(() => { banc = ouvrirLeBanc(); });
  const HOTE: Partial<NetState> = { mode: 'hote', mySeat: 0, ownership: { [A]: 0, [B]: 1 }, slots: [0, 1, 0, 0] };
  const intention = (siege: number, heroId: string) => appliquerLIntentionDUnSiege(banc.getState, siege, 'designerLeMeneur', [heroId]);

  it('sans siège MJ : l’hôte désigne, l’invité est refusé', () => {
    poser([hero(A), hero(B)], HOTE);
    expect(intention(1, B)).toBe('refusee');
    expect(banc.getState().meneurChoisi).toBeNull();
    expect(intention(0, B)).toBe('appliquee');
    expect(banc.getState().meneurChoisi).toBe(B);
  });

  it('avec un siège MJ : le siège MJ désigne, l’hôte est refusé', () => {
    poser([hero(A), hero(B)], { ...HOTE, gmSeat: 1 });
    expect(intention(0, B)).toBe('refusee');
    expect(banc.getState().meneurChoisi).toBeNull();
    expect(intention(1, B)).toBe('appliquee');
    expect(banc.getState().meneurChoisi).toBe(B);
  });

  it('en combat : refusé', () => {
    poser([hero(A), hero(B)], HOTE);
    banc.setState({ battle: { combatants: banc.getState().party } as never });
    expect(intention(0, B)).toBe('refusee');
    expect(banc.getState().meneurChoisi).toBeNull();
  });

  it('un héros qui n’est pas debout : le geste le refuse', () => {
    poser([hero(A), hero(B, 0)], HOTE);
    expect(intention(0, B)).toBe('appliquee');
    expect(banc.getState().meneurChoisi).toBeNull();
    expect(journal()).toContain(t('meneur.refus.aTerre', { heros: B.toUpperCase() }));
  });

  it('l’offre porte le refus quand ce siège ne tient pas la décision : la désignation et la marche', () => {
    poser([hero(A), hero(B)], { ...HOTE, gmSeat: 1 }, salleASortie());
    const refus = t('groupe.refus.siege', { siege: 'Invité' });
    expect(gestesDuMeneur().map((g) => g.refus)).toEqual([refus]);
    expect(gestesDeMarche().map((g) => g.refus), 'la marche vers la sortie').toEqual([refus]);
    banc.setState({ net: { ...banc.getState().net, gmSeat: undefined } });
    expect(gestesDeMarche().map((g) => g.refus), 'au siège du monde, la marche s’offre').toEqual([undefined]);
  });
});

describe('le siège du monde désigne le meneur — geste local de la partie', () => {
  const ENTREES: EntreesDeLaPartie = { graine: 7, reglesMaison: {}, cadence: 'manuel', desFixes: true, persisterLeHeros: () => {} };

  /** Une partie en exploration de `salle()`, le groupe [A, B] en (5,5), sous la session `net`. */
  function partieEnExploration(net: Partial<NetState>) {
    const ouverture = creerPartie(etatInitialDuJeu(), ENTREES);
    ouverture.lancer({ party: [hero(A), hero(B)], scene: salle(), projet: null });
    const garde: EtatDeJeu = ouverture.etat();
    ouverture.fermer();
    return creerPartie({ ...garde, net: { ...initialNet(), seatNames: { 0: 'Hôte', 1: 'Invité' }, ...net } }, ENTREES);
  }
  const textes = (r: { journal: LigneDuJournal[] }) => r.journal.flatMap((l) => (l.de === 'journal' ? [l.entree.texte] : []));
  const refusAuMJ = t('groupe.refus.siege', { siege: 'Invité' });

  it('l’hôte, quand un siège MJ existe : désigner et marcher hors combat sont refusés, et le refus est dit', () => {
    const partie = partieEnExploration({ mode: 'hote', mySeat: 0, gmSeat: 1, ownership: { [A]: 0, [B]: 1 }, slots: [0, 1, 0, 0] });
    try {
      const designer = partie.envoyer({ type: 'designerLeMeneur', args: [B] });
      expect(textes(designer)).toContain(refusAuMJ);
      expect(partie.etat().meneurChoisi).toBeNull();
      const marcher = partie.envoyer({ type: 'cliquerLaCase', args: [{ x: 8, y: 5 }] });
      expect(textes(marcher)).toContain(refusAuMJ);
      expect(partie.etat().partyPos).toMatchObject({ x: 5, y: 5 });
    } finally {
      partie.fermer();
    }
  });

  it('en solo, jamais refusé', () => {
    const partie = partieEnExploration({ mode: 'local' });
    try {
      partie.envoyer({ type: 'designerLeMeneur', args: [B] });
      expect(partie.etat().meneurChoisi).toBe(B);
      partie.envoyer({ type: 'cliquerLaCase', args: [{ x: 8, y: 5 }] });
      expect(partie.etat().partyPos).toMatchObject({ x: 8, y: 5 });
    } finally {
      partie.fermer();
    }
  });
});
