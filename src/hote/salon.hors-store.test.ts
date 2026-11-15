/**
 * LE SALON d'un hôte (#3009) : ses zones par état de la partie, de l'ouverture et du réseau ; chaque attribution de
 * siège est l'offre du noyau (`siegesOfferts`) ; la lecture d'un geste de salon dans les zones d'avant le geste.
 */
import { describe, expect, it } from 'vitest';
import { lireUnGesteDuSalon, zonesDuSalon, type OuvertureDuSalon, type ZonesDuSalon } from './salon';
import { ErreurDeGeste } from './partie';
import { initialNet, siegesOfferts, type Jeu as Partie } from '../noyau/index';
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

describe('lireUnGesteDuSalon — un geste que les zones d’avant offrent (S-D3)', () => {
  const echec: OuvertureDuSalon = { echec: 'x' };
  const etats: [string, Pick<Partie, 'net' | 'party'> | null, OuvertureDuSalon, boolean][] = [
    ['sans partie ni réseau', null, null, false], ['sans partie', null, null, true], ['partie locale', partie({}), null, true],
    ['ouverture héberger', partie({}), { enCours: 'heberger' }, true], ['ouverture rejoindre', null, { enCours: 'rejoindre' }, true],
    ['échec', partie({}), echec, true], ['hôte', hote, null, true],
    ['invité', invite({}), null, true], ['invité, reconnexion', invite({ connection: 'reconnexion' }), null, true], ['invité, hôte absent', invite({ hoteAbsent: true }), null, true],
  ];
  /** L'erreur que lève la lecture de `entree` dans `z` : sa catégorie et son message. */
  const refus = (z: ZonesDuSalon, entree: unknown) => {
    try {
      lireUnGesteDuSalon(z, entree);
    } catch (e) {
      if (e instanceof ErreurDeGeste) return [e.categorie, e.message];
      throw e;
    }
    return null;
  };
  const zHote = zonesDuSalon(hote, null, true);
  const zLocale = zonesDuSalon(partie({}), null, true);

  it('L1 : chaque geste offert, dans chaque état, est lu tel que l’élément le porte', () => {
    const sortes = new Set<string>();
    for (const [cas, etat, ouverture, reseau] of etats) {
      const z = zonesDuSalon(etat, ouverture, reseau);
      for (const g of z['salon.gestes']) {
        if (g.type === 'formulaire' && g.verbe === 'heberger' && g.refus === null) {
          expect(lireUnGesteDuSalon(z, { type: 'heberger', args: ['Gunnar'] }), cas).toEqual({ sorte: 'heberger', nom: 'Gunnar' });
          sortes.add('heberger');
        }
        if (g.type === 'formulaire' && g.verbe === 'rejoindre' && g.refus === null) {
          expect(lireUnGesteDuSalon(z, { type: 'rejoindre', args: ['ABC234', 'Anna'] }), cas).toEqual({ sorte: 'rejoindre', code: 'ABC234', nom: 'Anna' });
          sortes.add('rejoindre');
        }
        if (g.type === 'bouton') {
          expect(lireUnGesteDuSalon(z, JSON.parse(JSON.stringify(g.jeu))), cas).toEqual({ sorte: 'quitter' });
          sortes.add('quitter');
        }
      }
      for (const b of z['salon.sieges'].flatMap((c) => c.valeurs)) {
        const lu = lireUnGesteDuSalon(z, JSON.parse(JSON.stringify(b.jeu)));
        expect(lu, cas).toEqual({ sorte: 'siege', intention: b.jeu });
        expect(lu.sorte === 'siege' && lu.intention, cas).toBe(b.jeu);
        sortes.add('siege');
      }
    }
    expect([...sortes].sort()).toEqual(['heberger', 'quitter', 'rejoindre', 'siege']);
  });

  it('L2 : validation, pour un geste non offert', () => {
    expect(refus(zHote, { type: 'heberger', args: ['Gunnar'] })?.[0]).toBe('validation');
    expect(refus(zLocale, { salon: 'quitter' })?.[0]).toBe('validation');
    const offertes = zHote['salon.sieges'].flatMap((c) => c.valeurs.map((b) => b.jeu));
    expect(offertes).toContainEqual({ type: 'affecterLEmplacementAuSiege', args: [1, 1] });
    expect(refus(zHote, { type: 'affecterLEmplacementAuSiege', args: [0, 1] })?.[0], 'emplacement occupé').toBe('validation');
    const mj = { type: 'affecterLeSiegeMJ', args: [0] };
    expect(lireUnGesteDuSalon(zHote, mj)).toEqual({ sorte: 'siege', intention: mj });
    expect(refus(zLocale, mj)?.[0], 'rôle MJ après la fin de la session').toBe('validation');
    expect(refus(zHote, { ...mj, siege: 0 })?.[0], 'une clé de plus').toBe('validation');
  });

  it('L2 : validation, pour des arguments mal formés et une entrée qui n’est pas un objet', () => {
    for (const args of [[5], [], ['Gunnar', 'Anna'], 'Gunnar', undefined]) expect(refus(zLocale, { type: 'heberger', args })?.[0], JSON.stringify(args)).toBe('validation');
    for (const entree of [null, 'heberger', ['heberger', 'Gunnar'], 3]) expect(refus(zLocale, entree)?.[0], JSON.stringify(entree)).toBe('validation');
  });

  it('L2 : `rejoindre` refusé en validation hors des zones qui l’offrent ou sur ses arguments, en règle avec le texte du formulaire', () => {
    const z = zonesDuSalon(null, null, true);
    for (const args of [['ABC234'], ['ABC234', 3], 'ABC234']) expect(refus(z, { type: 'rejoindre', args })?.[0], JSON.stringify(args)).toBe('validation');
    expect(refus(zHote, { type: 'rejoindre', args: ['ABC234', 'Anna'] })?.[0], 'en session').toBe('validation');
    expect(refus(zonesDuSalon(null, { enCours: 'rejoindre' }, true), { type: 'rejoindre', args: ['ABC234', 'Anna'] })?.[0], 'pendant une jonction').toBe('validation');
    expect(refus(zLocale, { type: 'rejoindre', args: ['ABC234', 'Anna'] })).toEqual(['regle', `salon : ${t('ecran.salon.refus.partieOuverte')}`]);
    expect(refus(zonesDuSalon(null, null, false), { type: 'rejoindre', args: ['ABC234', 'Anna'] })).toEqual(['regle', `salon : ${t('ecran.salon.refus.sansReseau')}`]);
  });

  it('L3 : règle, avec le texte du formulaire, pour `heberger` offert mais refusé', () => {
    for (const [etat, reseau, cle] of [[null, true, 'ecran.salon.refus.sansPartie'], [partie({}), false, 'ecran.salon.refus.sansReseau']] as const) {
      expect(refus(zonesDuSalon(etat, null, reseau), { type: 'heberger', args: ['Gunnar'] })).toEqual(['regle', `salon : ${t(cle)}`]);
    }
  });
});
