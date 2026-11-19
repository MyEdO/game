import { afterEach, describe, expect, it } from 'vitest';
import { signature } from '../hote/formes';
import { VERBES } from '../hote/verbes.generated';
import { DEFAULT_VOYAGE_ORDERS } from '../noyau/index';
import { fermerLaTable, table } from './hote.testkit';
import { lireLeFichier, rejouer } from './partieTexte';
import type { EntreesDeJouer } from './serveur';
import { BORNES, projeter, rendreLaCarte } from './vue';

afterEach(fermerLaTable);

describe('départ en voyage depuis la carte de l’hôte texte', () => {
  it('lit un trajet et joue le geste lu avec une cadence différente du défaut', () => {
    const hote = table();
    expect(hote.nouvelle('voyage', { graine: 7 }).erreur).toBeNull();
    const avant = hote.fichier();
    const carte = hote.lire('carte');
    expect(carte.texte).toMatch(/^r-grandroute · Steinbruck \(p-bourg\) · 30 km\n {2}pied · À pied · 2 j/m);
    expect(carte.texte).toContain('Jour par jour (jourParJour, par défaut)');
    expect(hote.fichier()).toBe(avant);

    const cadence = /Sous vos ordres \((\w+)\)/.exec(carte.texte)?.[1];
    const appel = /`jouer (\{[^\n]+?"r-grandroute", "pied"[^\n]+?\})`/.exec(carte.texte)?.[1];
    if (!appel || !cadence) throw new Error(carte.texte);
    const { gestes } = JSON.parse(appel) as EntreesDeJouer;
    expect(cadence).not.toBe(DEFAULT_VOYAGE_ORDERS.cadence);
    const reponse = hote.jouer(...gestes.map((geste) => ({ ...geste, args: [...(geste.args ?? []), { cadence }] })));
    expect(reponse.erreur, reponse.texte).toBeNull();
    expect(reponse.texte).toContain('En route vers Steinbruck (30 km, à pied)');

    const { entete, gestes: enregistres } = lireLeFichier(hote.fichier());
    fermerLaTable();
    const { partie } = rejouer(entete, enregistres);
    try {
      expect(partie.etat().travelPlan).toMatchObject({ routeId: 'r-grandroute', orders: { cadence } });
    } finally {
      partie.fermer();
    }
  });

  it('donne le refus d’un mode sans durée ni geste et la durée du mode ouvert', () => {
    const hote = table();
    expect(hote.nouvelle('commerce-fluvial', { graine: 7 }).erreur).toBeNull();
    const carte = hote.lire('carte');
    expect(carte.texte).toMatch(/^r-grunburg-altdorf · Altdorf \(p-altdorf\) · 45 km\n {2}barge · Barge · 1 j\n {2}`jouer .+\n {2}pied · À pied · refus : Le groupe est trop chargé pour avancer — allégez les sacs\.$/m);
    expect(carte.texte).not.toContain('"r-grunburg-altdorf", "pied"');
  });

  it('pagine les lignes de la carte sans perdre les entités de la scène', () => {
    const hote = table();
    expect(hote.nouvelle('voyage', { graine: 7 }).erreur).toBeNull();
    const carte = hote.lire('carte');
    expect(carte.lignes).toHaveLength(BORNES.lignes.carte);
    const suite = /`lire (\{.+\})`/.exec(carte.lignes[carte.lignes.length - 1])?.[1];
    if (!suite) throw new Error(carte.texte);
    expect(JSON.parse(suite)).toEqual({ quoi: 'carte', depuis: BORNES.lignes.carte - 1 });
    expect(hote.lire('carte', JSON.parse(suite)).lignes).toEqual([
      '  aubergiste · personnage · Aubergiste · (8,3)',
      '  heroStart-0 · heroStart · (3,4)',
    ]);
  });

  it('réserve l’offre de cadence aux parties locales', () => {
    const hote = table();
    expect(hote.nouvelle('voyage', { graine: 7 }).erreur).toBeNull();
    const { entete, gestes } = lireLeFichier(hote.fichier());
    fermerLaTable();
    const { partie } = rejouer(entete, gestes);
    try {
      const etat = partie.etat();
      const enCoop = { ...etat, net: { ...etat.net, mode: 'hote' as const } };
      const carte = rendreLaCarte(enCoop, projeter(enCoop, 0, 0)).join('\n');
      expect(carte).toContain('r-grandroute · Steinbruck');
      expect(carte).not.toContain('Cadence de voyage');
    } finally {
      partie.fermer();
    }
  });

  it('développe les champs du départ avec un nom exact ou un fragment unique', () => {
    const hote = table();
    const exacte = hote.lire('verbes', { id: 'partirEnVoyage' });
    expect(hote.lire('verbes', { id: 'partirenvoy' }).lignes).toEqual(exacte.lignes);
    expect(exacte.lignes[0]).toBe(signature('partirEnVoyage', VERBES.partirEnVoyage));
    expect(exacte.lignes.slice(1).join(' ')).toMatch(
      /^opts : \{"classeId"\?: .+ "hoursPerDay"\?: nombre, "allure"\?: .+ "seaPace"\?: nombre, "fast"\?: booleen, "cadence"\?:\s+"commande" \| "jourParJour"\}$/,
    );
    expect(hote.lire('verbes', { id: 'fenetreChoisir' }).texte).toBe(signature('fenetreChoisir', VERBES.fenetreChoisir));
  });
});
