/**
 * LE SALON d'un hôte (#3009) : ses zones par état de la partie, de l'ouverture et du réseau ; chaque attribution de
 * siège est l'offre du noyau (`siegesOfferts`), d'un verbe de classe `hôte`.
 */
import { describe, expect, it } from 'vitest';
import { zonesDuSalon, type OuvertureDuSalon, type ZonesDuSalon } from './salon';
import type { Element } from './elements';
import { initialNet, siegesOfferts, type Jeu as Partie } from '../noyau/index';
import { CLASSE_DES_ACTIONS_DU_NOYAU } from '../noyau/intentionsDeSiege';
import { createHero } from '../engine/character';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { t } from '../i18n';

const heros = (() => {
  const h = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Gunnar', seed: 11 });
  h.id = 'h0';
  return h;
})();

const partie = (net: Partial<Partie['net']>): Pick<Partie, 'net' | 'party'> => ({ net: { ...initialNet(), ...net }, party: [heros] });
const hote = partie({ mode: 'hote', roomCode: 'ABC234', seatNames: { 0: 'Hôte', 1: 'Anna' }, presence: { 1: 'absent' } });
const invite = (lien: Partial<Partie['net']>) => partie({ mode: 'invite', mySeat: 1, roomCode: 'ABC234', seatNames: { 0: 'Hôte', 1: 'Anna' }, ...lien });

/** Les formulaires de `z`, par verbe : leur refus. */
const refusDesFormulaires = (z: ZonesDuSalon) => Object.fromEntries(z['salon.gestes'].flatMap((g) => (g.type === 'formulaire' ? [[g.verbe, g.refus]] : [])));
const textes = (z: ZonesDuSalon) => z['salon.etat'].map((l) => l.texte);
const quitter = [{ type: 'bouton', id: 'quitter', libelle: t('ecran.salon.quitter'), jeu: { salon: 'quitter' }, presse: false, focus: false, refus: null }];

describe('zonesDuSalon — par état (Z4)', () => {
  it('sans partie ni réseau : les deux formulaires, refusés', () => {
    const z = zonesDuSalon(null, null, false);
    expect(refusDesFormulaires(z)).toEqual({ heberger: t('ecran.salon.refus.sansReseau'), rejoindre: t('ecran.salon.refus.sansReseau') });
    expect(z['salon.etat']).toEqual([]);
    expect(z['salon.sieges']).toEqual([]);
  });

  it('sans partie, avec réseau : rejoindre offert, héberger refusé ; les champs de chaque verbe', () => {
    const z = zonesDuSalon(null, null, true);
    expect(refusDesFormulaires(z)).toEqual({ heberger: t('ecran.salon.refus.sansPartie'), rejoindre: null });
    expect(z['salon.gestes'].map((g) => (g.type === 'formulaire' ? g.champs.map((c) => c.nom) : []))).toEqual([['nom'], ['code', 'nom']]);
  });

  it('partie locale : héberger offert, rejoindre refusé', () => {
    const z = zonesDuSalon(partie({}), null, true);
    expect(refusDesFormulaires(z)).toEqual({ heberger: null, rejoindre: t('ecran.salon.refus.partieOuverte') });
    expect(z['salon.sieges']).toEqual([]);
  });

  it('ouverture en cours : le bouton « Quitter le salon » seul, la ligne de l’ouverture', () => {
    for (const [enCours, cle] of [['heberger', 'ecran.salon.enCours.heberger'], ['rejoindre', 'ecran.salon.enCours.rejoindre']] as const) {
      const z = zonesDuSalon(enCours === 'heberger' ? partie({}) : null, { enCours }, true);
      expect(z['salon.gestes']).toEqual(quitter);
      expect(textes(z)).toEqual([t(cle)]);
    }
  });

  it('échec : son texte, et les formulaires de nouveau', () => {
    const echec: OuvertureDuSalon = { echec: 'Service coop injoignable — réessayez.' };
    const z = zonesDuSalon(partie({}), echec, true);
    expect(z['salon.etat']).toEqual([{ type: 'ligne', id: 'ouverture', ton: 'echec', texte: echec.echec, detail: null }]);
    expect(refusDesFormulaires(z)).toEqual({ heberger: null, rejoindre: t('ecran.salon.refus.partieOuverte') });
  });

  it('hôte : le code, les sièges et leur présence, une rangée par offre du noyau, « Quitter le salon »', () => {
    const z = zonesDuSalon(hote, null, true);
    expect(textes(z)).toEqual([t('ecran.salon.code', { code: 'ABC234' }), `Hôte${t('party.slot.you')}`, `Anna${t('ecran.salon.absent')}`]);
    expect(z['salon.etat'].map((l) => l.ton)).toEqual(['neutre', 'neutre', 'alerte']);
    expect(z['salon.gestes']).toEqual(quitter);
    const offres = siegesOfferts(hote);
    expect(z['salon.sieges'].map((c) => [c.id, c.libelle, c.refus])).toEqual(offres.map((o) => [o.id, o.nom, null]));
    expect(z['salon.sieges'].map((c) => c.valeurs.map((b) => [b.libelle, b.jeu, b.presse, b.refus]))).toEqual(offres.map((o) => o.choix.map((c) => [c.nom, c.intention, c.tenu, null])));
  });

  it('invité : le code, les sièges, chacun des trois états du lien, aucune rangée', () => {
    for (const [lien, cle, ton] of [
      [{}, 'coop.invite.attente.defaut', 'neutre'],
      [{ connection: 'reconnexion' }, 'coop.invite.attente.reconnexion', 'alerte'],
      [{ hoteAbsent: true }, 'coop.invite.attente.hoteAbsent', 'alerte'],
    ] as const) {
      const z = zonesDuSalon(invite(lien), null, true);
      expect(textes(z)).toEqual([t('ecran.salon.code', { code: 'ABC234' }), 'Hôte', `Anna${t('party.slot.you')}`, t(cle)]);
      expect(z['salon.etat'][z['salon.etat'].length - 1].ton).toBe(ton);
      expect(z['salon.gestes']).toEqual(quitter);
      expect(z['salon.sieges']).toEqual([]);
    }
  });
});

describe('zonesDuSalon — éléments et intentions (Z5)', () => {
  const TYPES_D_ELEMENT = new Set<Element['type']>(['ligne', 'puce', 'jauge', 'jet', 'entite', 'plan', 'portrait', 'icone', 'fond', 'paysage', 'bouton', 'choix', 'liste', 'formulaire', 'fixe', 'saisieChoix', 'saisieCoches', 'saisieNombre', 'saisieTexte', 'saisieMultiligne', 'saisieJson', 'saisieObjet']);
  const etats: [Pick<Partie, 'net' | 'party'> | null, OuvertureDuSalon, boolean][] = [
    [null, null, false], [null, null, true], [partie({}), null, true], [partie({}), { enCours: 'heberger' }, true],
    [null, { echec: 'x' }, true], [hote, null, true], [invite({}), null, true],
  ];

  it('tout élément rendu est d’un type de `Element`, saisies des formulaires comprises', () => {
    for (const [etat, ouverture, reseau] of etats) {
      const z = zonesDuSalon(etat, ouverture, reseau);
      const elements: Element[] = [...z['salon.etat'], ...z['salon.gestes'], ...z['salon.sieges']].flatMap((e): Element[] => [
        e, ...(e.type === 'formulaire' ? e.champs : []), ...(e.type === 'choix' || e.type === 'liste' ? e.valeurs : []),
      ]);
      for (const e of elements) expect(TYPES_D_ELEMENT.has(e.type), e.type).toBe(true);
    }
  });

  it('tout `jeu` d’un bouton de `salon.sieges` est une intention d’un verbe de classe `hôte`', () => {
    const jeux = zonesDuSalon(hote, null, true)['salon.sieges'].flatMap((c) => c.valeurs.map((b) => b.jeu));
    expect(jeux.length).toBeGreaterThan(0);
    for (const jeu of jeux) {
      expect('type' in jeu && 'args' in jeu, JSON.stringify(jeu)).toBe(true);
      const verbe = (jeu as { type: string }).type;
      expect((CLASSE_DES_ACTIONS_DU_NOYAU as Readonly<Record<string, string>>)[verbe], verbe).toBe('hôte');
    }
  });
});
