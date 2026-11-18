/**
 * LE COMPENDIUM PAR LE PONT (#4020, section « Compendium ») : `compendium` s'ouvre sur une entrée, rend ses zones, la
 * fiche entière où chaque référence se suit d'un bouton, joue les boutons et les formulaires que ses zones offrent et
 * refuse les autres ; « Enregistrer » joue la transaction et rend le texte à écrire au dépôt, son empreinte d'avant
 * avec lui, puis tient l'atelier fermé à l'issue réussie de l'écriture ; une entrée désignée ne se supprime pas.
 */
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { erreurDe, table, type Reponse } from './pont.testkit';
import type { Bouton, Choix, Entite, Formulaire } from '../../../src/hote/elements';
import type { ZonesDuCompendium } from '../../../src/hote/compendium';
import { datasetArray, datasetObject, resetData } from '../../../src/data/overrides';
import { hash32 } from '../../../src/lib/hash';
import { categoryByKey } from '../../../src/noyau/index';

/** Le libellé de fiche de l'entrée `id` de la catégorie `categorie`. */
const libelleDe = (categorie: string, id: string): string => categoryByKey(categorie)!.items.find((i) => i.id === id)!.label;

afterEach(() => resetData());

const zonesDe = (r: Reponse): ZonesDuCompendium => {
  expect(r.ok, JSON.stringify(r).slice(0, 400)).toBe(true);
  return (r as unknown as { zones: ZonesDuCompendium }).zones;
};

/** Le premier niveau de carrière, et le premier talent qu'il accorde. */
const NIVEAU = datasetArray('careerLevels')[0];
const TALENT = NIVEAU.talents.flatMap((r) => ('id' in r ? [r.id] : []))[0];

/** Le bouton d'id `id` des zones `zones`, parmi les boutons à plat, les valeurs des choix et les éléments des entités. */
function boutonDe(zones: ZonesDuCompendium, id: string): Bouton {
  const tous = Object.values(zones).flat().flatMap((e: Bouton | Choix | Entite | Formulaire | { type: string }) =>
    e.type === 'bouton' ? [e as Bouton] : e.type === 'choix' || e.type === 'liste' ? (e as Choix).valeurs : e.type === 'entite' ? (e as Entite).elements.filter((x): x is Bouton => x.type === 'bouton') : []);
  const b = tous.find((x) => x.id === id);
  expect(b, `bouton ${id}`).toBeDefined();
  return b!;
}

describe('compendium', () => {
  it('s’ouvre sur une entrée, sa fiche entière, chaque référence un bouton qui la suit ; avant l’ouverture, tout est refusé', () => {
    const { appel } = table();
    expect(erreurDe(appel('compendium', { compendium: { geste: 'modifier' } })).message).toBe('compendium : aucun Compendium ouvert, compendium { ouvrir } d’abord');
    const zones = zonesDe(appel('compendium', { ouvrir: true, categorie: 'careerLevels', id: NIVEAU.id }));
    expect(zones['compendium.fiche'][0].nom).toBe(libelleDe('careerLevels', NIVEAU.id));
    const suivre = Object.values(zones['compendium.fiche']).flatMap((e) => e.elements).find((x): x is Bouton => x.type === 'bouton' && JSON.stringify(x.jeu).includes(`"id":"${TALENT}"`))!;
    const talent = zonesDe(appel('compendium', suivre.jeu));
    expect(talent['compendium.fiche'][0].nom).toBe(libelleDe('talents', TALENT));
    expect(erreurDe(appel('compendium', { compendium: { geste: 'montrer', id: 'nulle-part' } })).categorie).toBe('validation');
  });

  it('modifier, écrire une valeur, enregistrer : le texte à écrire et l’empreinte d’avant ; l’issue réussie ferme l’atelier', () => {
    const { appel } = table();
    const ouvert = zonesDe(appel('compendium', { ouvrir: true, categorie: 'talents', id: TALENT }));
    const atelier = zonesDe(appel('compendium', boutonDe(ouvert, 'modifier').jeu));
    const libelle = atelier['compendium.atelier'].find((e): e is Formulaire => e.type === 'formulaire' && e.id === 'valeur/label')!;
    const [porteur, chemin] = libelle.champs.map((c) => (c.type === 'fixe' ? c.valeur : undefined));
    const ecrit = zonesDe(appel('compendium', { type: 'valeur', args: [porteur, chemin, 'Libellé édité'] }));
    const avant = readFileSync('src/data/talents.json', 'utf8');
    const r = appel('compendium', boutonDe(ecrit, 'enregistrer').jeu) as unknown as { donnees: { fichier: string; texte: string; avant: number } };
    expect([r.donnees.fichier, r.donnees.avant, r.donnees.texte.includes('Libellé édité')]).toEqual(['talents.json', hash32(avant), true]);
    const fermee = zonesDe(appel('compendium', { compendium: { geste: 'enregistrement', reussi: true } }));
    expect(fermee['compendium.atelier'].map((e) => e.id)).toEqual(['modifier', 'creer']);
    expect(fermee['compendium.fiche'][0].nom).toBe('Libellé édité');
    expect(erreurDe(appel('compendium', { compendium: { geste: 'enregistrement', reussi: true } })).message).toBe('compendium : aucun enregistrement ni suppression en cours');
  });

  it('un nombre que le schéma veut entier se saisit au pas de 1 : la page d’une source', () => {
    const { appel } = table();
    const ouvert = zonesDe(appel('compendium', { ouvrir: true, categorie: 'talents', id: TALENT }));
    const atelier = zonesDe(appel('compendium', boutonDe(ouvert, 'modifier').jeu));
    const page = atelier['compendium.atelier'].find((e): e is Formulaire => e.type === 'formulaire' && e.id === 'valeur/source/page')!;
    expect(page.champs.find((c) => c.type === 'saisieNombre')).toMatchObject({ pas: 1 });
  });

  it('une écriture au dépôt refusée remet la donnée en mémoire telle qu’avant, et l’atelier reste ouvert', () => {
    const { appel } = table();
    const ouvert = zonesDe(appel('compendium', { ouvrir: true, categorie: 'talents', id: TALENT }));
    const atelier = zonesDe(appel('compendium', boutonDe(ouvert, 'modifier').jeu));
    const libelle = atelier['compendium.atelier'].find((e): e is Formulaire => e.type === 'formulaire' && e.id === 'valeur/label')!;
    zonesDe(appel('compendium', { type: 'valeur', args: [...libelle.champs.slice(0, 2).map((c) => (c.type === 'fixe' ? c.valeur : undefined)), 'Libellé refusé'] }));
    const avant = datasetArray('talents').find((t) => t.id === TALENT)!.label;
    const r = appel('compendium', { compendium: { geste: 'enregistrer' } }) as unknown as { donnees: { texte: string } };
    expect(r.donnees.texte.includes('Libellé refusé')).toBe(true);
    const refusee = zonesDe(appel('compendium', { compendium: { geste: 'enregistrement', reussi: false, refus: 'disque changé' } }));
    expect([datasetArray('talents').find((t) => t.id === TALENT)!.label, refusee['compendium.etat'][0].texte]).toEqual([avant, 'disque changé']);
    const encore = appel('compendium', { compendium: { geste: 'enregistrer' } }) as unknown as { donnees: { avant: number } };
    expect(encore.donnees.avant).toBe(hash32(readFileSync('src/data/talents.json', 'utf8')));
  });

  it('l’identifiant d’un élément de liste à clé se change à son formulaire, son chemin fixé ; une clé que le moteur fige n’en a pas', () => {
    const { appel } = table();
    appel('compendium', { ouvrir: true });
    for (const g of [{ geste: 'famille', famille: categoryByKey('seaPerils')!.group }, { geste: 'categorie', categorie: 'seaPerils' }]) appel('compendium', { compendium: g });
    const atelier = zonesDe(appel('compendium', { compendium: { geste: 'modifier' } }))['compendium.atelier'];
    const rang = datasetObject('seaPerils').tourbillons.findIndex((t) => t.id === 'maelstrom-primordial');
    const formulaire = atelier.find((e): e is Formulaire => e.type === 'formulaire' && e.id === `identifier/tourbillons/${rang}`)!;
    expect(formulaire.champs.map((c) => [c.type, c.type === 'fixe' ? c.valeur : null])).toEqual([['fixe', ['tourbillons', rang]], ['saisieTexte', null]]);
    const renomme = zonesDe(appel('compendium', { type: 'identifier', args: [['tourbillons', rang], 'maelstrom-ultime'] }))['compendium.atelier'];
    expect(renomme.find((e): e is Formulaire => e.type === 'formulaire' && e.id === `identifier/tourbillons/${rang}`)!.champs[1]).toMatchObject({ valeur: 'maelstrom-ultime' });
    expect(erreurDe(appel('compendium', { type: 'identifier', args: [['tourbillons', 99], 'x'] })).categorie, 'un chemin qu’aucun formulaire ne fixe').toBe('validation');
    appel('compendium', { compendium: { geste: 'abandonner' } });
    for (const g of [{ geste: 'famille', famille: categoryByKey('riverNavigation')!.group }, { geste: 'categorie', categorie: 'riverNavigation' }]) appel('compendium', { compendium: g });
    const fleuve = zonesDe(appel('compendium', { compendium: { geste: 'modifier' } }))['compendium.atelier'];
    expect(fleuve.some((e) => e.id.startsWith('identifier/windForces/')), 'une force de vent se renomme (#1692)').toBe(true);
    expect(fleuve.some((e) => e.id.startsWith('identifier/windDirections/')), 'une direction est fixée par le schéma').toBe(false);
  });

  it('le dé de la table s’écrit par deux saisies de nombre entier de 1, enregistré avec l’entrée ; zéro dé refusé (#4056)', () => {
    const { appel } = table();
    const [rangee] = datasetArray('drunkenness');
    const atelier = zonesDe(appel('compendium', boutonDe(zonesDe(appel('compendium', { ouvrir: true, categorie: 'drunkenness', id: rangee.id })), 'modifier').jeu));
    const de = atelier['compendium.atelier'].find((e): e is Formulaire => e.type === 'formulaire' && e.id === 'enTete')!;
    expect(de.champs.map((c) => [c.type, c.nom, 'min' in c ? c.min : null, 'pas' in c ? c.pas : null, 'valeur' in c ? c.valeur : null])).toEqual([['saisieNombre', 'n', 1, 1, 1], ['saisieNombre', 'sides', 1, 1, 10]]);
    expect(erreurDe(appel('compendium', { type: 'enTete', args: [0, 10] }))).toMatchObject({ categorie: 'regle', message: 'compendium : Trop petit : nombre doit être >=1' });
    expect(erreurDe(appel('compendium', { type: 'enTete', args: ['2d10'] })).categorie).toBe('validation');
    const ecrit = zonesDe(appel('compendium', { type: 'enTete', args: [2, 10] }));
    const r = appel('compendium', boutonDe(ecrit, 'enregistrer').jeu) as unknown as { donnees: { fichier: string; texte: string } };
    expect(JSON.parse(r.donnees.texte).die).toEqual({ n: 2, sides: 10 });
  });

  it('supprimer une entrée désignée est refusé en règle, sa raison dite', () => {
    const { appel } = table();
    appel('compendium', { ouvrir: true, categorie: 'talents', id: TALENT });
    const atelier = zonesDe(appel('compendium', { compendium: { geste: 'modifier' } }));
    const supprimer = boutonDe(atelier, 'supprimer');
    expect(supprimer.refus).toMatch(/^D’autres données désignent cette entrée/);
    expect(erreurDe(appel('compendium', supprimer.jeu))).toEqual({ categorie: 'regle', message: `compendium : ${supprimer.refus}` });
  });

  it('un geste de liste ne porte que l’élément à son rang : le plus gros jeu de l’atelier d’une table de noms, l’élément le plus gros d’une de ses listes et son enveloppe (#4020)', () => {
    const { appel } = table();
    const [entree] = datasetArray('names');
    const atelier = zonesDe(appel('compendium', boutonDe(zonesDe(appel('compendium', { ouvrir: true, categorie: 'names', id: entree.id })), 'modifier').jeu))['compendium.atelier'];
    const jeux = atelier.flatMap((e) => (e.type === 'bouton' ? [e.jeu] : e.type === 'choix' || e.type === 'liste' ? e.valeurs.map((v) => v.jeu) : []));
    const valeurDe = (jeu: unknown): unknown => {
      const j = jeu as { compendium?: { valeur?: unknown }; args?: unknown[] };
      return j.compendium ? j.compendium.valeur : j.args?.[2];
    };
    const taille = (v: unknown): number => (v === undefined ? 0 : JSON.stringify(v).length);
    const elements = Object.values(entree).flatMap((v) => (Array.isArray(v) ? v.map(taille) : []));
    const enveloppe = Math.max(...jeux.map((j) => taille(j) - taille(valeurDe(j))));
    expect(Math.max(...elements), 'l’entrée porte des listes').toBeGreaterThan(0);
    expect(Math.max(...jeux.map(taille))).toBeLessThanOrEqual(Math.max(...elements) + enveloppe);
  });

  it('un record à clé ouverte s’édite par gestes : une clé ajoutée par son formulaire, sa valeur écrite, une clé retirée au-delà du minimum', () => {
    const { appel } = table();
    const atelier = zonesDe(appel('compendium', boutonDe(zonesDe(appel('compendium', { ouvrir: true, categorie: 'terrains', id: 'bois' })), 'modifier').jeu));
    const formulaire = (zones: ZonesDuCompendium, id: string) => zones['compendium.atelier'].find((e): e is Formulaire => e.type === 'formulaire' && e.id === id);
    const fixes = (f: Formulaire | undefined) => f!.champs.flatMap((c) => (c.type === 'fixe' ? [c.valeur] : []));
    const retirer = (zones: ZonesDuCompendium) => zones['compendium.atelier'].filter((e) => /^valeur\/stops\/[^/]+\/retirer$/.test(e.id)).length;
    expect(retirer(atelier), 'deux arrêts : aucun ne se retire').toBe(0);
    const ajoutee = zonesDe(appel('compendium', { type: 'valeur', args: [...fixes(formulaire(atelier, 'valeur/stops/ajouter')), '50%'] }));
    const ecrite = zonesDe(appel('compendium', { type: 'valeur', args: [...fixes(formulaire(ajoutee, 'valeur/stops/50%')), '#808080'] }));
    expect(retirer(ecrite), 'trois arrêts : chacun se retire').toBe(3);
    expect(erreurDe(appel('compendium', { type: 'valeur', args: [...fixes(formulaire(ecrite, 'valeur/stops/ajouter')), 'milieu'] })).categorie, 'une clé que le record n’admet pas').toBe('regle');
    const retiree = zonesDe(appel('compendium', boutonDe(ecrite, 'valeur/stops/100%/retirer').jeu));
    const r = appel('compendium', boutonDe(retiree, 'enregistrer').jeu) as unknown as { donnees: { texte: string } };
    expect((JSON.parse(r.donnees.texte) as { id: string; stops: Record<string, string> }[]).find((t) => t.id === 'bois')!.stops).toEqual({ '0%': '#4d7a38', '50%': '#808080' });
  });
});
