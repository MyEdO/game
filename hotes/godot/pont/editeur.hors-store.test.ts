/**
 * L'ÉDITEUR DE CARTE PAR LE PONT (#3508) : `editer` ouvre la première scène d'une campagne du jeu, joue les gestes que
 * ses zones offrent et les gestes du pointeur, rend la surcouche du geste en cours, et le monde à l'ouverture, au
 * changement de couche et à chaque écriture finie, jamais pendant le geste. Ouverte du texte que sert le dépôt, la carte
 * s'y enregistre : `editer` rend le texte à écrire, et la tient pour enregistrée à l'issue réussie de l'écriture. Les
 * entités et les entrées de la couche éditée se repèrent en surcouche ; le formulaire de l'inspecteur les nomme.
 */
import { describe, expect, it } from 'vitest';
import { erreurDe, table, type Reponse } from './pont.testkit';
import type { AreteDessinee, VolumeDuMonde } from '../../../src/noyau/index';
import { allBuiltinCampaigns } from '../../../src/scenes/campaign';
import type { Bouton, Choix, Formulaire, Ligne } from '../../../src/hote/elements';
import type { CalqueAffiche, SurcoucheDeLEdition, ZonesDeLEditeur } from '../../../src/hote/editeur';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { dossierDesProjetsLivres, listerProjetsLivres, PROJETS_MANUSCRITS } from '../../../scripts/guards/lib/projetsLivres.mjs';
import { lireProjetLivre } from '../../../scripts/source/projetLivre.mjs';

interface Edition {
  vue: { zones: ZonesDeLEditeur; couche: number };
  surcouche: SurcoucheDeLEdition;
  monde?: VolumeDuMonde;
  aretes?: AreteDessinee[];
  depot?: { id: string; texte: string };
  calque: CalqueAffiche | null;
  planche?: { image: string };
  memoire?: { calques: { version: string; calques: Record<string, Record<string, Record<string, unknown>>> }; oublier: string[] };
}

/** L'édition d'une réponse réussie, ou l'échec qui dit la réponse. */
function editionDe(r: Reponse): Edition {
  if (!r.ok || !r.vue || !('surcouche' in r)) throw new Error(`réponse sans édition : ${JSON.stringify(r).slice(0, 400)}`);
  return r as unknown as Edition;
}

/** Le bouton d'id `id` des zones de l'éditeur, posé seul ou parmi les valeurs d'un choix. */
function boutonDe(e: Edition, id: string): Bouton {
  const b = Object.values(e.vue.zones).flat().flatMap((el: Ligne | Choix | Bouton | Formulaire) => (el.type === 'bouton' ? [el] : el.type === 'choix' || el.type === 'liste' ? el.valeurs : [])).find((v) => v.id === id);
  if (!b) throw new Error(`aucun bouton ${id}`);
  return b;
}

/** Les valeurs du choix d'id `id` des options de l'outil. */
function valeursDe(e: Edition, id: string): Bouton[] {
  const c = e.vue.zones['editeur.options'].find((el) => el.id === id);
  if (c?.type !== 'choix' && c?.type !== 'liste') throw new Error(`aucun choix ${id}`);
  return c.valeurs;
}

/** La première campagne du jeu : chaque scène a au moins deux cases de côté. */
const CAMPAGNE = allBuiltinCampaigns[0].id;
const point = (x: number, y: number) => ({ case: { x, y }, f: { x, y } });

describe('l’éditeur de carte par le pont', () => {
  it('sans carte ouverte, un geste se refuse ; une campagne inconnue aussi', () => {
    const { appel } = table();
    expect(erreurDe(appel('editer', { edition: { geste: 'annuler' } })).message).toBe('editer : aucune carte ouverte, editer { ouvrir } d’abord');
    expect(erreurDe(appel('editer', { ouvrir: 'nulle-part' })).categorie).toBe('validation');
    expect(erreurDe(appel('editer', { ouvrir: CAMPAGNE, edition: { geste: 'annuler' } })).categorie).toBe('validation');
  });

  it('peindre une case : la surcouche pendant le trait, le monde au relâché, annuler le rend tel qu’à l’ouverture', () => {
    const { appel } = table();
    const jouer = (edition: unknown) => editionDe(appel('editer', { edition }));
    const presser = (b: Bouton) => editionDe(appel('editer', b.jeu));
    const ouverte = editionDe(appel('editer', { ouvrir: CAMPAGNE }));
    expect(ouverte.vue.zones['editeur.titre']).toHaveLength(1);
    expect(boutonDe(ouverte, 'outil/select').presse).toBe(true);
    expect(ouverte.monde!.cases.length, 'le monde de la scène, à l’ouverture').toBeGreaterThan(0);
    expect(boutonDe(ouverte, 'annuler').refus).toBe('Rien à annuler');

    const visee = jouer({ geste: 'appui', point: point(1, 1) });
    expect(visee.monde, 'un appui de sélection n’écrit rien').toBeUndefined();
    const avant = visee.vue.zones['editeur.pointee'][0].texte;
    expect(avant).toMatch(/^Case 1, 1 · couche 0 · /);
    jouer({ geste: 'relache', point: point(1, 1) });

    const terrain = presser(boutonDe(visee, 'outil/tile'));
    const autre = valeursDe(terrain, 'terrains').find((b) => !avant.includes(` · ${b.libelle} · `))!;
    presser(autre);
    const trait = jouer({ geste: 'appui', point: point(1, 1) });
    expect(trait.surcouche.cases, 'la case peinte, à la surcouche').toEqual([{ x: 1, y: 1, z: 0 }]);
    expect(trait.monde, 'pendant le trait, le monde ne se rend pas').toBeUndefined();
    expect(trait.vue.zones['editeur.pointee'][0].texte).toContain(` · ${autre.libelle} · `);
    const fini = jouer({ geste: 'relache', point: point(1, 1) });
    expect(fini.surcouche.cases).toEqual([]);
    expect(fini.monde, 'au relâché, le monde peint').toBeDefined();
    expect(fini.monde).not.toEqual(ouverte.monde);

    const annule = presser(boutonDe(fini, 'annuler'));
    expect(annule.monde).toEqual(ouverte.monde);
    expect(boutonDe(annule, 'retablir').refus).toBeNull();
  });

  it('un geste que les zones n’offrent pas, ou un point mal formé, se refuse ; un bouton refusé se refuse en règle', () => {
    const { appel } = table();
    appel('editer', { ouvrir: CAMPAGNE });
    expect(erreurDe(appel('editer', { edition: { geste: 'pinceau', taille: 3 } })).categorie, 'pas de pinceau en sélection').toBe('validation');
    expect(erreurDe(appel('editer', { edition: { geste: 'appui', point: { case: { x: 1.5, y: 1 }, f: { x: 1.5, y: 1 } } } })).categorie).toBe('validation');
    expect(erreurDe(appel('editer', { edition: { geste: 'couche', z: 4 } })).categorie, 'une couche absente').toBe('validation');
    expect(erreurDe(appel('editer', { edition: { geste: 'annuler' } }))).toEqual({ categorie: 'regle', message: 'editer : Rien à annuler' });
    expect(erreurDe(appel('editer', { edition: { geste: 'retirerCouche' } }))).toEqual({ categorie: 'regle', message: 'editer : Le rez ne se retire pas' });
  });

  it('les couches : en ajouter une l’édite, en changer rend le monde de la couche éditée, retirer l’éditée rend le rez', () => {
    const { appel } = table();
    const presser = (b: Bouton) => editionDe(appel('editer', b.jeu));
    const rez = editionDe(appel('editer', { ouvrir: CAMPAGNE }));
    expect([boutonDe(rez, 'couche/0').presse, rez.vue.couche]).toEqual([true, 0]);
    const ajoutee = presser(boutonDe(rez, 'couche/ajouter'));
    const z = ajoutee.vue.couche;
    expect(z, 'la couche ajoutée, au-dessus de la plus haute, s’édite').toBeGreaterThan(0);
    expect([boutonDe(ajoutee, `couche/${z}`).presse, ajoutee.monde !== undefined]).toEqual([true, true]);
    const auRez = presser(boutonDe(ajoutee, 'couche/0'));
    expect([auRez.vue.couche, auRez.monde !== undefined]).toEqual([0, true]);
    expect(presser(boutonDe(auRez, 'outil/tile')).monde, 'un outil choisi ne rend pas le monde').toBeUndefined();
    const retiree = presser(boutonDe(presser(boutonDe(auRez, `couche/${z}`)), 'couche/retirer'));
    expect([boutonDe(retiree, 'couche/0').presse, retiree.vue.couche]).toEqual([true, 0]);
    expect(() => boutonDe(retiree, `couche/${z}`)).toThrow();
  });
});

describe('l’éditeur de carte par le pont, les murs', () => {
  it('l’outil murs pose une porte du matériau choisi sur l’arête la plus proche ; la sélection la décrit ; annuler la retire', () => {
    const { appel } = table();
    const jouer = (edition: unknown) => editionDe(appel('editer', { edition }));
    const presser = (b: Bouton) => editionDe(appel('editer', b.jeu));
    const ouverte = editionDe(appel('editer', { ouvrir: CAMPAGNE }));
    const auNord = (aretes: AreteDessinee[]) => aretes.filter((a) => a.milieu.x === 1 && a.milieu.y === 0.5);
    expect(auNord(ouverte.aretes!), 'l’arête nord de la case 1, 1, libre à l’ouverture').toEqual([]);
    const murs = presser(boutonDe(ouverte, 'outil/wall'));
    expect(boutonDe(murs, 'arete/wall').presse).toBe(true);
    const portes = presser(boutonDe(murs, 'arete/door'));
    const materiau = valeursDe(portes, 'structures')[1];
    presser(materiau);
    const posee = jouer({ geste: 'appui', point: { case: { x: 1, y: 1 }, f: { x: 1, y: 0.6 } } });
    expect(auNord(posee.aretes!), 'la porte posée, au monde rendu').toEqual([{ case: { x: 1, y: 1 }, milieu: { x: 1, y: 0.5 }, sens: { x: 1, y: 0 }, pied: 0, piece: 'porte-ouverte', famille: 'colombage', hauteurM: 4 }]);
    jouer({ geste: 'relache', point: { case: { x: 1, y: 1 }, f: { x: 1, y: 0.6 } } });

    presser(boutonDe(posee, 'outil/select'));
    const choisie = jouer({ geste: 'appui', point: { case: { x: 1, y: 1 }, f: { x: 1, y: 0.6 } } });
    expect(choisie.vue.zones['editeur.pointee'].map((l) => l.texte)).toContain(`Arête 1, 1 N · couche 0 · porte · ${materiau.libelle}`);
    expect(choisie.surcouche.arete).toEqual(auNord(posee.aretes!)[0]);
    jouer({ geste: 'relache', point: { case: { x: 1, y: 1 }, f: { x: 1, y: 0.6 } } });

    expect(auNord(presser(boutonDe(choisie, 'annuler')).aretes!)).toEqual([]);
  });
});

describe('l’éditeur de carte par le pont, les entités', () => {
  it('l’outil décor pose le décor choisi, repéré et inspecté ; le formulaire le nomme ; il s’oriente, se copie, se colle sur la case pointée, se supprime', () => {
    const { appel } = table();
    const jouer = (edition: unknown) => editionDe(appel('editer', { edition }));
    const presser = (b: Bouton) => editionDe(appel('editer', b.jeu));
    const ouverte = editionDe(appel('editer', { ouvrir: CAMPAGNE }));
    const decors = presser(boutonDe(ouverte, 'outil/prop'));
    const decor = valeursDe(decors, 'decors')[1];
    presser(decor);
    const pose = jouer({ geste: 'appui', point: point(1, 1) });
    jouer({ geste: 'relache', point: point(1, 1) });
    const repere = pose.surcouche.reperes.find((r) => r.choisi)!;
    expect(repere).toMatchObject({ sorte: 'prop', x: 1, y: 1, z: 0, nom: decor.libelle });
    expect(pose.vue.zones['editeur.pointee'].map((l) => l.texte)).toContain(`Décor « ${decor.libelle} » · case 1, 1 · couche 0`);
    expect(pose.vue.zones['editeur.inspecteur'].find((e) => e.type === 'formulaire')).toMatchObject({ verbe: 'nommer', champs: [{ type: 'saisieTexte', nom: 'nom', valeur: decor.libelle }] });

    const nomme = editionDe(appel('editer', { type: 'nommer', args: ['Comptoir'] }));
    expect(nomme.surcouche.reperes.find((r) => r.choisi)?.nom).toBe('Comptoir');
    expect(erreurDe(appel('editer', { type: 'nommer', args: [3] })).categorie).toBe('validation');
    expect(erreurDe(appel('editer', { type: 'renommer', args: ['x'] })).categorie).toBe('validation');
    const tourne = presser(boutonDe(nomme, 'entite/cap/E'));
    expect(boutonDe(tourne, 'entite/cap/E').presse).toBe(true);

    const copie = presser(boutonDe(tourne, 'copier'));
    expect(boutonDe(copie, 'coller').refus, 'la case pointée est celle du décor : le coller s’y pose').toBeNull();
    presser(boutonDe(copie, 'outil/select'));
    jouer({ geste: 'appui', point: point(3, 2) });
    const collee = presser(boutonDe(jouer({ geste: 'relache', point: point(3, 2) }), 'coller'));
    expect(collee.surcouche.reperes.filter((r) => r.nom === 'Comptoir').map((r) => [r.x, r.y, r.choisi])).toEqual([[1, 1, false], [3, 2, true]]);
    const supprimee = presser(boutonDe(collee, 'entite/supprimer'));
    expect(supprimee.surcouche.reperes.filter((r) => r.nom === 'Comptoir')).toHaveLength(1);
    expect(supprimee.monde, 'le monde suit l’écriture').toBeDefined();
  });

  it('l’outil entrée pose une entrée nommée, que le formulaire renomme et que la case pointée décrit', () => {
    const { appel } = table();
    const jouer = (edition: unknown) => editionDe(appel('editer', { edition }));
    const presser = (b: Bouton) => editionDe(appel('editer', b.jeu));
    presser(boutonDe(editionDe(appel('editer', { ouvrir: CAMPAGNE })), 'outil/entry'));
    const posee = jouer({ geste: 'appui', point: point(1, 1) });
    const nom = posee.surcouche.reperes.find((r) => r.choisi && r.sorte === 'entree')!.nom;
    const renommee = editionDe(appel('editer', { type: 'nommer', args: ['cour-des-coches'] }));
    expect(renommee.surcouche.reperes.find((r) => r.choisi)).toMatchObject({ sorte: 'entree', nom: 'cour-des-coches', x: 1, y: 1 });
    expect(renommee.vue.zones['editeur.pointee'].map((l) => l.texte)).toContain('Entrée « cour-des-coches » · case 1, 1 · couche 0');
    expect(nom).not.toBe('cour-des-coches');
  });
});

describe('l’éditeur de carte par le pont, les zones', () => {
  /** Une table ouverte sur la campagne, l'outil Zone pris à la sorte `sorte`, et la zone tracée du rectangle (2, 2)–(3, 3). */
  function tracee(sorte: string) {
    const { appel } = table();
    const jouer = (edition: unknown) => editionDe(appel('editer', { edition }));
    const presser = (b: Bouton) => editionDe(appel('editer', b.jeu));
    const outil = presser(boutonDe(editionDe(appel('editer', { ouvrir: CAMPAGNE })), 'outil/zone'));
    expect(valeursDe(outil, 'zones').map((b) => b.id)).toEqual(['zone/room', 'zone/trigger', 'zone/rest', 'zone/effect']);
    presser(boutonDe(outil, `zone/${sorte}`));
    jouer({ geste: 'appui', point: point(2, 2) });
    expect(jouer({ geste: 'glisse', point: point(3, 3) }).surcouche.cases, 'le rectangle tiré, en surcouche').toHaveLength(4);
    return { appel, jouer, presser, posee: jouer({ geste: 'relache', point: point(3, 3) }) };
  }

  it('une pièce tracée au rectangle est sélectionnée, nommée en surcouche ; sa poignée la redimensionne, que l’annulation défait', () => {
    const { jouer, presser, posee } = tracee('room');
    const choisie = posee.surcouche.zones.filter((z) => z.choisi);
    expect(choisie).toEqual([{ sorte: 'piece', nom: 'Pièce', cases: [{ x: 2, y: 2, z: 0 }, { x: 3, y: 2, z: 0 }, { x: 2, y: 3, z: 0 }, { x: 3, y: 3, z: 0 }], choisi: true }]);
    expect(posee.surcouche.poignee, 'la poignée, au coin sud-est').toEqual({ x: 3, y: 3, z: 0 });
    expect(posee.vue.zones['editeur.pointee'].map((l) => l.texte)).toContain('Pièce « Pièce » · 2 × 2 cases depuis 2, 2 · couche 0');
    expect(boutonDe(posee, 'zone/nature/interior').presse).toBe(true);

    presser(boutonDe(posee, 'outil/select'));
    jouer({ geste: 'appui', point: point(3, 3) });
    jouer({ geste: 'glisse', point: point(5, 4) });
    const agrandie = jouer({ geste: 'relache', point: point(5, 4) });
    expect(agrandie.vue.zones['editeur.pointee'].map((l) => l.texte)).toContain('Pièce « Pièce » · 4 × 3 cases depuis 2, 2 · couche 0');
    expect(agrandie.surcouche.poignee).toEqual({ x: 5, y: 4, z: 0 });
    expect(presser(boutonDe(agrandie, 'annuler')).surcouche.zones.find((z) => z.nom === 'Pièce')?.cases, 'annuler défait le redimensionnement').toHaveLength(4);
  });

  it('une zone d’effet : son nom, sa nature, sa forme, son emprise au pinceau puis toute son aire ; elle se supprime', () => {
    const { appel, jouer, presser, posee } = tracee('effect');
    expect(posee.surcouche.zones.find((z) => z.choisi)).toMatchObject({ sorte: 'zone', nom: 'Piège' });
    const nommee = editionDe(appel('editer', { type: 'nommer', args: ['Fosse'] }));
    expect(nommee.surcouche.zones.find((z) => z.choisi)?.nom).toBe('Fosse');
    expect(boutonDe(nommee, 'zone/nature/aucune').presse).toBe(true);
    expect(presser(boutonDe(nommee, 'zone/nature/exterior')).surcouche.zones.find((z) => z.choisi)?.sorte, 'un piège reste une zone, à ciel ouvert').toBe('zone');
    expect(boutonDe(nommee, 'zone/pleine').refus).toBe('La zone occupe déjà toute son aire');

    const pinceau = presser(boutonDe(nommee, 'emprise/remove'));
    expect(boutonDe(pinceau, 'emprise/remove').presse).toBe(true);
    jouer({ geste: 'appui', point: point(2, 2) });
    const decoupee = jouer({ geste: 'relache', point: point(2, 2) });
    expect(decoupee.surcouche.zones.find((z) => z.choisi)?.cases, 'la case retirée de l’emprise').toHaveLength(3);
    const pleine = presser(boutonDe(decoupee, 'zone/pleine'));
    expect(pleine.surcouche.zones.find((z) => z.choisi)?.cases).toHaveLength(4);

    const disque = presser(boutonDe(presser(boutonDe(pleine, 'emprise/finir')), 'zone/forme/disc'));
    expect(boutonDe(disque, 'zone/forme/disc').presse).toBe(true);
    const supprimee = presser(boutonDe(disque, 'zone/supprimer'));
    expect(supprimee.surcouche.zones.some((z) => z.choisi)).toBe(false);
    expect(supprimee.surcouche.poignee).toBeNull();
  });

  it('un déclencheur joue une fois, ou à chaque entrée ; une zone de repos offre ses lieux, piètre ; chacune change de couche', () => {
    const declencheur = tracee('trigger');
    expect(declencheur.posee.surcouche.zones.find((z) => z.choisi)?.sorte).toBe('declencheur');
    expect(boutonDe(declencheur.posee, 'zone/uneFois').presse, 'un déclencheur naît à usage unique').toBe(true);
    const rejouable = declencheur.presser(boutonDe(declencheur.posee, 'zone/uneFois'));
    expect(boutonDe(rejouable, 'zone/uneFois').presse).toBe(false);
    expect(boutonDe(declencheur.presser(boutonDe(rejouable, 'zone/uneFois')), 'zone/uneFois').presse).toBe(true);

    const repos = tracee('rest');
    expect(repos.posee.surcouche.zones.find((z) => z.choisi)).toMatchObject({ sorte: 'repos', nom: 'Zone de repos' });
    const camp = boutonDe(repos.posee, 'zone/lieux/camp').presse;
    const auberge = repos.presser(boutonDe(repos.posee, 'zone/lieux/auberge'));
    expect([boutonDe(auberge, 'zone/lieux/auberge').presse, boutonDe(auberge, 'zone/lieux/camp').presse]).toEqual([true, camp]);
    expect(boutonDe(repos.presser(boutonDe(auberge, 'zone/pietre')), 'zone/pietre').presse).toBe(true);

    const etage = repos.presser(boutonDe(repos.presser(boutonDe(auberge, 'couche/ajouter')), 'couche/0'));
    repos.presser(boutonDe(etage, 'outil/select'));
    const reprise = repos.jouer({ geste: 'appui', point: point(2, 2) });
    expect(reprise.surcouche.zones.find((z) => z.choisi)?.sorte, 'la sélection la reprend sur la carte').toBe('repos');
    const montee = repos.presser(boutonDe(reprise, 'zone/couche/1'));
    expect(montee.surcouche.zones.some((z) => z.choisi), 'montée d’une couche, elle quitte la surcouche du rez').toBe(false);
    expect(montee.surcouche.poignee).toBeNull();
    expect(etage.vue.couche).toBe(0);
  });

  it('une zone d’effet change d’identifiant, coupe la ligne de vue, barre le passage ; elle couvre une entrée de fiche, que sa pression retire', () => {
    const { appel, presser, posee } = tracee('effect');
    const inspecteur = (e: Edition) => e.vue.zones['editeur.inspecteur'];
    const identifiee = editionDe(appel('editer', { type: 'identifier', args: ['fosse-aux-loups'] }));
    expect(inspecteur(identifiee).find((el) => el.id === 'identifier')).toMatchObject({ type: 'formulaire', champs: [{ valeur: 'fosse-aux-loups' }] });
    expect(erreurDe(appel('editer', { type: 'identifier', args: [] })).categorie, 'sans identifiant saisi').toBe('validation');

    const opaque = presser(boutonDe(identifiee, 'zone/blocksLoS'));
    expect(boutonDe(opaque, 'zone/blocksLoS').presse).toBe(true);
    const barree = presser(boutonDe(opaque, 'zone/barrier'));
    expect([boutonDe(barree, 'zone/barrier').presse, boutonDe(presser(boutonDe(barree, 'zone/barrier')), 'zone/barrier').presse]).toEqual([true, false]);

    expect(inspecteur(posee).find((el) => el.id === 'zone/couvre')).toMatchObject({ type: 'ligne', texte: 'Aucune entrée de fiche couverte.' });
    const offerte = (inspecteur(barree).find((el) => el.id === 'zone/couvre/ajouter') as Choix).valeurs[0];
    const couverte = presser(offerte);
    const id = offerte.id.slice('zone/couvre/ajouter/'.length);
    expect(boutonDe(couverte, `zone/couvre/${id}`)).toMatchObject({ presse: true, libelle: offerte.libelle });
    expect((inspecteur(couverte).find((el) => el.id === 'zone/couvre/ajouter') as Choix).valeurs.some((v) => v.id === offerte.id), 'une entrée couverte ne s’offre plus').toBe(false);
    expect(inspecteur(presser(boutonDe(couverte, `zone/couvre/${id}`))).find((el) => el.id === 'zone/couvre')?.type, 'retirée, la zone n’en couvre aucune').toBe('ligne');
  });

  it('un déclencheur se renomme, sous un nom libre seulement, et couvre une entrée de fiche', () => {
    const { appel, presser, posee } = tracee('trigger');
    const renomme = editionDe(appel('editer', { type: 'nommer', args: ['arrivee-au-relais'] }));
    expect(renomme.surcouche.zones.find((z) => z.choisi)).toMatchObject({ sorte: 'declencheur', nom: 'arrivee-au-relais' });
    const ancien = posee.surcouche.zones.find((z) => z.choisi)!.nom;
    expect(renomme.surcouche.zones.some((z) => z.nom === ancien), 'le déclencheur ne garde pas son ancien nom').toBe(false);
    const couvert = presser((renomme.vue.zones['editeur.inspecteur'].find((el) => el.id === 'zone/couvre/ajouter') as Choix).valeurs[0]);
    expect((couvert.vue.zones['editeur.inspecteur'].find((el) => el.id === 'zone/couvre') as Choix).valeurs.map((v) => v.presse)).toEqual([true]);
  });
});

describe('l’éditeur de carte par le pont, l’architecture', () => {
  it('un corps bâti sur la case pointée se nomme et se type ; un étage au-dessus devient la couche éditée, où se bâtit une partie ; le dernier étage ne se supprime pas', () => {
    const { appel } = table();
    const jouer = (edition: unknown) => editionDe(appel('editer', { edition }));
    const presser = (b: Bouton) => editionDe(appel('editer', b.jeu));
    const outil = presser(boutonDe(editionDe(appel('editer', { ouvrir: CAMPAGNE })), 'outil/architecture'));
    expect(boutonDe(outil, 'batir/corps').refus).toBe('Appuyez d’abord sur une case de cette couche');
    jouer({ geste: 'appui', point: point(2, 2) });
    const pointee = jouer({ geste: 'relache', point: point(2, 2) });
    const bati = presser(boutonDe(pointee, 'batir/corps'));
    const corps = valeursDe(bati, 'corps').find((b) => b.presse)!;
    expect(bati.surcouche.zones.find((z) => z.sorte === 'partie')?.cases, 'sa partie de départ, la case pointée').toEqual([{ x: 2, y: 2, z: 0 }]);
    const nomme = editionDe(appel('editer', { type: 'nommer', args: ['Relais'] }));
    expect(valeursDe(nomme, 'corps').find((b) => b.presse)?.libelle).toBe('Relais');
    const style = (nomme.vue.zones['editeur.inspecteur'].find((el) => el.id === 'corps/style') as Choix).valeurs[1];
    expect(boutonDe(presser(style), style.id).presse).toBe(true);
    expect(boutonDe(nomme, 'architecture/supprimer').refus).toBeNull();

    const etage = presser(boutonDe(nomme, 'batir/etage'));
    expect(etage.vue.couche).toBe(1);
    expect(etage.vue.zones['editeur.inspecteur'].find((el) => el.id === 'etage')).toMatchObject({ type: 'ligne' });
    expect(boutonDe(etage, 'batir/partie').refus, 'la case pointée est au rez').toBe('Appuyez d’abord sur une case de cette couche');
    jouer({ geste: 'appui', point: point(4, 4) });
    const partie = presser(boutonDe(jouer({ geste: 'relache', point: point(4, 4) }), 'batir/partie'));
    expect(partie.surcouche.zones.find((z) => z.choisi)).toMatchObject({ sorte: 'partie', cases: [{ x: 4, y: 4, z: 1 }] });
    expect(partie.surcouche.poignee).toEqual({ x: 4, y: 4, z: 1 });

    const rez = presser(boutonDe(presser(boutonDe(partie, 'couche/0')), corps.id));
    expect(rez.vue.zones['editeur.inspecteur'].find((el) => el.id === 'corps/etages')).toMatchObject({ texte: '2 étages' });
  });

  it('une façade posée sur l’arête appuyée : son apparence, une ouverture à sa sorte, à sa position, retirée', () => {
    const { appel } = table();
    const jouer = (edition: unknown) => editionDe(appel('editer', { edition }));
    const presser = (b: Bouton) => editionDe(appel('editer', b.jeu));
    presser(boutonDe(editionDe(appel('editer', { ouvrir: CAMPAGNE })), 'outil/architecture'));
    jouer({ geste: 'appui', point: point(2, 2) });
    const bati = presser(boutonDe(jouer({ geste: 'relache', point: point(2, 2) }), 'batir/corps'));
    presser(boutonDe(bati, 'architecture/facade'));
    const posee = jouer({ geste: 'appui', point: { case: { x: 2, y: 2 }, f: { x: 2, y: 1.55 } } });
    const inspecteur = (e: Edition) => e.vue.zones['editeur.inspecteur'];
    expect(boutonDe(posee, 'architecture/select').presse, 'la façade posée, le clic revient à la sélection').toBe(true);
    expect(inspecteur(posee).find((el) => el.id === 'facade/apparence')).toMatchObject({ type: 'liste' });
    const apparence = (inspecteur(posee).find((el) => el.id === 'facade/apparence') as Choix).valeurs.find((v) => !v.presse)!;
    expect(boutonDe(presser(apparence), apparence.id).presse).toBe(true);

    const ouverte = presser(boutonDe(posee, 'baie/ajouter'));
    const sorte = inspecteur(ouverte).find((el) => el.id.startsWith('baie/') && el.id.endsWith('/sorte')) as Choix;
    const id = sorte.id.slice(0, -'/sorte'.length);
    expect(inspecteur(ouverte).find((el) => el.id === `${id}/position`)).toMatchObject({ texte: 'Position : 50 % de l’arête (défaut)' });
    const decalee = presser(boutonDe(ouverte, `${id}/position/plus`));
    expect(inspecteur(decalee).find((el) => el.id === `${id}/position`)).toMatchObject({ texte: 'Position : 55 % de l’arête' });
    const autre = sorte.valeurs.find((v) => !v.presse)!;
    expect(boutonDe(presser(boutonDe(decalee, autre.id)), autre.id).presse).toBe(true);
    const retiree = presser(boutonDe(decalee, `${id}/retirer`));
    expect(inspecteur(retiree).some((el) => el.id.startsWith(`${id}/`))).toBe(false);
  });

  it('sans corps, la façade et les ouvrages d’un corps se refusent', () => {
    const { appel } = table();
    const outil = editionDe(appel('editer', boutonDe(editionDe(appel('editer', { ouvrir: CAMPAGNE })), 'outil/architecture').jeu));
    expect(boutonDe(outil, 'architecture/facade').refus).toBe('Aucun corps dans la scène');
    expect(['etage', 'partie', 'masse'].map((o) => boutonDe(outil, `batir/${o}`).refus)).toEqual(Array(3).fill('Aucun corps dans la scène'));
  });
});

describe('l’éditeur de carte par le pont, le combat et l’ameublement', () => {
  it('un emplacement de siège posé à l’outil : son engin, son arc, ses servants et leur chef ; un personnage enrôlé dans une rencontre neuve, allié piloté', () => {
    const { appel } = table();
    const jouer = (edition: unknown) => editionDe(appel('editer', { edition }));
    const presser = (b: Bouton) => editionDe(appel('editer', b.jeu));
    const ouverte = editionDe(appel('editer', { ouvrir: CAMPAGNE }));
    presser(boutonDe(ouverte, 'outil/personnage'));
    const pnj = jouer({ geste: 'appui', point: point(1, 1) });
    jouer({ geste: 'relache', point: point(1, 1) });
    const pnjId = pnj.surcouche.reperes.find((r) => r.choisi)!.id;
    const enrole = presser(boutonDe(pnj, 'rencontre/neuve'));
    const choixDeRencontre = enrole.vue.zones['editeur.inspecteur'].find((el) => el.type === 'choix' && el.id.startsWith('rencontre/') && el.valeurs.some((v) => v.id.endsWith('/enrole') && v.presse)) as Choix;
    const enc = choixDeRencontre.id;
    const allie = presser(boutonDe(enrole, `${enc}/allie`));
    expect(boutonDe(presser(boutonDe(allie, `${enc}/ia`)), `${enc}/ia`).presse).toBe(true);

    const engins = presser(boutonDe(allie, 'outil/emplacement'));
    const engin = valeursDe(engins, 'engins')[1];
    presser(engin);
    const pose = jouer({ geste: 'appui', point: point(3, 3) });
    jouer({ geste: 'relache', point: point(3, 3) });
    expect(boutonDe(pose, `poste/engin/${engin.id.slice('engin/'.length)}`).presse).toBe(true);
    const tribord = presser(boutonDe(pose, 'poste/arc/tribord'));
    expect([boutonDe(tribord, 'poste/arc/tribord').presse, boutonDe(tribord, 'poste/arc/omni').presse]).toEqual([true, false]);
    const servi = presser(boutonDe(tribord, `poste/servants/${pnjId}`));
    expect(boutonDe(servi, `poste/chef/${pnjId}`).presse).toBe(true);
    expect(boutonDe(servi, `equipage/${pnjId}`).presse, 'l’équipage exposé est une autre liste').toBe(false);
  });

  it('un décor : sa lumière allumée, son rayon au pas, son ton ; son assise ouverte, une place tenue par un emplacement du groupe', () => {
    const { appel } = table();
    const jouer = (edition: unknown) => editionDe(appel('editer', { edition }));
    const presser = (b: Bouton) => editionDe(appel('editer', b.jeu));
    const decors = presser(boutonDe(editionDe(appel('editer', { ouvrir: CAMPAGNE })), 'outil/prop'));
    presser(valeursDe(decors, 'decors').find((b) => b.id === 'prop/table-ronde-4-tabourets')!);
    const pose = jouer({ geste: 'appui', point: point(5, 5) });
    jouer({ geste: 'relache', point: point(5, 5) });
    const texte = (e: Edition, id: string) => e.vue.zones['editeur.inspecteur'].find((el) => el.id === id && el.type === 'ligne') as Ligne | undefined;
    expect(texte(pose, 'lumiere/rayon'), 'éteinte, pas de rayon').toBeUndefined();
    const allumee = presser(boutonDe(pose, 'lumiere'));
    expect(texte(allumee, 'lumiere/rayon')?.texte).toBe('Rayon d’éclairage : 6 m');
    const plus = presser(boutonDe(allumee, 'lumiere/plus'));
    expect(texte(plus, 'lumiere/rayon')?.texte).toBe('Rayon d’éclairage : 7 m');
    expect(boutonDe(presser(boutonDe(plus, 'lumiere/ton/lanterne')), 'lumiere/ton/lanterne').presse).toBe(true);
    expect(boutonDe(presser(boutonDe(plus, 'assise')), 'assise').presse).toBe(true);
    const place = pose.vue.zones['editeur.inspecteur'].find((el) => el.type === 'liste' && el.id.startsWith('place/')) as Choix;
    expect(boutonDe(pose, `${place.id}/personne`).presse).toBe(true);
    const tenue = presser(boutonDe(pose, `${place.id}/heros-1`));
    expect([boutonDe(tenue, `${place.id}/heros-1`).presse, boutonDe(tenue, `${place.id}/personne`).presse]).toEqual([true, false]);
  });
});

describe('l’éditeur de carte par le pont, l’inspecteur d’arête', () => {
  it('porte secrète : le brouillon attend difficulté et face, puis l’écrit fermée ; fenêtre franchissable : l’allège à la réglette', () => {
    const { appel } = table();
    const jouer = (edition: unknown) => editionDe(appel('editer', { edition }));
    const presser = (b: Bouton) => editionDe(appel('editer', b.jeu));
    const auNord = { case: { x: 1, y: 1 }, f: { x: 1, y: 0.6 } };
    presser(boutonDe(editionDe(appel('editer', { ouvrir: CAMPAGNE })), 'outil/wall'));
    jouer({ geste: 'appui', point: auNord });
    presser(boutonDe(jouer({ geste: 'relache', point: auNord }), 'outil/select'));
    let e = jouer({ geste: 'appui', point: auNord });
    jouer({ geste: 'relache', point: auNord });
    const inspecte = (id: string) => e.vue.zones['editeur.inspecteur'].find((el) => el.id === id);
    expect(boutonDe(e, 'arete/cloison').presse).toBe(true);

    e = presser(boutonDe(e, 'arete/porte'));
    e = presser(boutonDe(e, 'arete/secrete'));
    expect(inspecte('arete/secreteIncomplete'), 'la porte secrète attend').toMatchObject({ ton: 'alerte' });
    expect(boutonDe(e, 'arete/fermee').presse, 'rien d’écrit au brouillon').toBe(false);
    e = presser(boutonDe(e, 'arete/perception/difficile'));
    e = presser(boutonDe(e, 'arete/face/porteuse'));
    expect([inspecte('arete/secreteIncomplete'), boutonDe(e, 'arete/fermee').presse, boutonDe(e, 'arete/fermee').refus])
      .toEqual([undefined, true, 'Une porte secrète est fermée au départ : décochez d’abord « Porte secrète »']);

    e = presser(boutonDe(e, 'arete/cloison'));
    e = presser(boutonDe(e, 'arete/fenetre'));
    e = presser(boutonDe(e, 'arete/franchissable'));
    expect(inspecte('arete/allege')).toMatchObject({ ton: 'alerte' });
    expect(boutonDe(e, 'arete/allege/moins').refus).toBe('Déjà au minimum');
    e = presser(boutonDe(e, 'arete/allege/plus'));
    e = presser(boutonDe(e, 'arete/allege/plus'));
    expect(inspecte('arete/allege')).toMatchObject({ texte: 'Hauteur d’allège : 0.2 m', ton: 'neutre' });
    e = presser(boutonDe(e, 'arete/suspendu/plus'));
    expect(inspecte('arete/suspendu')).toMatchObject({ texte: 'Chute si l’on se suspend d’abord : 0.5 m' });

    e = presser(boutonDe(e, 'arete/supprimer'));
    expect(e.vue.zones['editeur.inspecteur'], 'l’arête supprimée, plus d’inspecteur').toEqual([]);
  });
});

describe('l’éditeur de carte par le pont, le crénelage et la gomme', () => {
  it('le crénelage marque la case d’un parapet, que la case pointée dit ; sa gomme l’efface ; la gomme n’a pas d’option', () => {
    const { appel } = table();
    const jouer = (edition: unknown) => editionDe(appel('editer', { edition }));
    const presser = (b: Bouton) => editionDe(appel('editer', b.jeu));
    const crenelage = presser(boutonDe(editionDe(appel('editer', { ouvrir: CAMPAGNE })), 'outil/crenellated'));
    const parapet = valeursDe(crenelage, 'parapets')[0];
    expect(parapet.presse, 'la première structure crénelable, portée par l’outil').toBe(true);
    const dite = (e: Edition) => e.vue.zones['editeur.pointee'].find((l) => l.id === 'crenelage')?.texte;
    jouer({ geste: 'appui', point: point(1, 1) });
    expect(dite(jouer({ geste: 'relache', point: point(1, 1) }))).toBe(`Parapet crénelé : ${parapet.libelle}`);
    presser(boutonDe(crenelage, 'crenelage/gomme'));
    jouer({ geste: 'appui', point: point(1, 1) });
    expect(dite(jouer({ geste: 'relache', point: point(1, 1) }))).toBeUndefined();

    expect(presser(boutonDe(crenelage, 'outil/erase')).vue.zones['editeur.options'], 'la gomme, sans option').toEqual([]);
  });
});

describe('l’éditeur de carte par le pont, la volée', () => {
  it('l’outil volée trace ses cases en surcouche ; poser une volée que son plan refuse se refuse, sa raison en clair ; effacer vide le tracé', () => {
    const { appel } = table();
    const jouer = (edition: unknown) => editionDe(appel('editer', { edition }));
    const presser = (b: Bouton) => editionDe(appel('editer', b.jeu));
    const volee = presser(boutonDe(editionDe(appel('editer', { ouvrir: CAMPAGNE })), 'outil/stair'));
    expect(boutonDe(volee, 'volee/effacer').refus).toBe('Aucune case tracée');
    const tracee = jouer({ geste: 'appui', point: point(1, 1) });
    jouer({ geste: 'relache', point: point(1, 1) });
    expect(tracee.surcouche.cases).toEqual([{ x: 1, y: 1, z: 0 }]);
    const ligneDes = (id: string) => tracee.vue.zones['editeur.options'].find((e) => e.id === id);
    expect(ligneDes('trace')).toMatchObject({ texte: 'Tracé : 1 case' });
    const poser = boutonDe(tracee, 'volee/poser');
    expect(poser.refus).toBeTruthy();
    expect(ligneDes('plan'), 'la raison du plan, en clair').toMatchObject({ texte: poser.refus });
    expect(erreurDe(appel('editer', poser.jeu))).toEqual({ categorie: 'regle', message: `editer : ${poser.refus}` });
    expect(presser(boutonDe(tracee, 'volee/effacer')).surcouche.cases).toEqual([]);
  });
});

describe('l’éditeur de carte par le pont, le calque de référence', () => {
  /** Le pont d'une carte ouverte, ses calques gardés `calques` s'ils sont donnés, et ses gestes. */
  const ouvrirLaCarte = (calques?: string) => {
    const { appel } = table();
    const ouverte = editionDe(appel('editer', { ouvrir: CAMPAGNE, ...(calques === undefined ? {} : { calques }) }));
    return { appel, ouverte, jouer: (edition: unknown) => editionDe(appel('editer', { edition })), presser: (b: Bouton) => editionDe(appel('editer', b.jeu)) };
  };
  const lignes = (e: Edition) => Object.fromEntries(e.vue.zones['editeur.calque'].flatMap((el) => (el.type === 'ligne' ? [[el.id, el.texte]] : [])));

  it('charger une planche : la demande rend son chemin, son issue pose le calque neuf sur toute la carte, à garder', () => {
    const { appel, ouverte, jouer, presser } = ouvrirLaCarte();
    expect([ouverte.calque, ouverte.memoire]).toEqual([null, undefined]);
    expect(lignes(ouverte)).toEqual({ calque: 'Calque de référence · couche 0', 'calque/aucun': 'Décalquer une planche de livre (image locale) sur cette couche.' });
    expect(erreurDe(appel('editer', { edition: { geste: 'chargement', image: null } })).message).toBe('editer : aucun chargement de planche en cours');
    const demande = presser(boutonDe(ouverte, 'calque/charger'));
    expect(demande.planche?.image).toMatch(new RegExp(`^calques/${CAMPAGNE}/[^/]+/0$`));
    expect(lignes(demande)['calque/chargement']).toBe('Choisissez l’image de la planche.');
    expect(erreurDe(appel('editer', { edition: { geste: 'chargement', image: { largeur: 0, hauteur: 10 } } })).categorie, 'une image sans pixel').toBe('validation');
    const renonce = jouer({ geste: 'chargement', image: null });
    expect([renonce.calque, renonce.memoire, lignes(renonce)['calque/aucun']], 'l’auteur renonce : rien de posé').toEqual([null, undefined, expect.any(String)]);

    presser(boutonDe(renonce, 'calque/charger'));
    const charge = jouer({ geste: 'chargement', image: { largeur: 200, hauteur: 100 } });
    expect(charge.calque).toMatchObject({ image: demande.planche!.image, plan: 0, opacite: 0.6, dessus: true });
    const [hg, hd, bd, bg] = charge.calque!.coins;
    expect(hg, 'le coin haut-gauche de l’image au coin de la case 0, 0').toEqual({ x: -0.5, y: -0.5 });
    expect([hd.y, bd.x - hd.x, bg.x, (hd.x - hg.x) / (bg.y - hg.y)], 'l’image droite, sans déformation').toEqual([-0.5, 0, -0.5, 2]);
    const sceneId = demande.planche!.image.split('/')[2];
    expect(charge.memoire).toEqual({ calques: { version: expect.any(String), calques: { [sceneId]: { 0: expect.objectContaining({ largeur: 200, hauteur: 100 }) } } }, oublier: [] });
  });

  it('caler par deux points : un point de l’image, son nœud, un second point, son nœud ; la planche se pose sur la grille', () => {
    const { ouverte, jouer, presser } = ouvrirLaCarte();
    presser(boutonDe(ouverte, 'calque/charger'));
    const charge = jouer({ geste: 'chargement', image: { largeur: 100, hauteur: 100 } });
    const [hg, hd] = charge.calque!.coins;
    const auPixel = (px: number, py: number) => ({ case: { x: 0, y: 0 }, f: { x: hg.x + ((hd.x - hg.x) * px) / 100, y: hg.y + ((hd.x - hg.x) * py) / 100 } });
    const enCalage = presser(boutonDe(charge, 'calque/caler'));
    expect(lignes(enCalage)['calque/calage']).toBe('Cliquez un 1ᵉʳ coin repérable sur l’image (angle de mur, coin de bâtiment)');
    const pas = [
      { geste: 'appui', point: auPixel(10, 10) },
      { geste: 'appui', point: { case: { x: 2, y: 3 }, f: { x: 2.2, y: 3.1 } } },
      { geste: 'appui', point: auPixel(60, 10) },
    ].map((g) => lignes(jouer(g))['calque/calage']);
    expect(pas).toEqual([
      'Cliquez l’intersection de la grille qui correspond à ce coin',
      'Cliquez un 2ᵉ coin repérable sur l’image, loin du premier',
      'Cliquez l’intersection de la grille qui correspond à ce 2ᵉ coin',
    ]);
    expect(jouer({ geste: 'glisse', point: point(4, 4) }).surcouche.cases, 'le glissé n’ouvre aucun geste pendant le calage').toEqual([]);
    const cale = jouer({ geste: 'appui', point: { case: { x: 7, y: 3 }, f: { x: 7.3, y: 3.2 } } });
    expect(lignes(cale)['calque/echelle'], 'cinquante pixels pour cinq cases').toBe('10 px par case');
    expect(cale.calque!.coins[0], 'le pixel 10, 10 sur le nœud 2,5 · 3,5').toEqual({ x: 1.5, y: 2.5 });
    expect(cale.vue.zones['editeur.pointee'], 'les clics du calage ne pointent aucune case').toEqual([]);
  });

  it('régler, cacher, retirer : chaque changement gardé, la planche retirée oubliée ; changer de couche abandonne le calage', () => {
    const { ouverte, jouer, presser } = ouvrirLaCarte();
    presser(boutonDe(ouverte, 'calque/charger'));
    const charge = jouer({ geste: 'chargement', image: { largeur: 100, hauteur: 100 } });
    const plus = presser(boutonDe(charge, 'calque/opacite/plus'));
    expect([plus.calque!.opacite, lignes(plus)['calque/opacite']]).toEqual([0.7, 'Opacité : 70 %']);
    expect(presser(boutonDe(plus, 'calque/dessous')).calque!.dessus).toBe(false);
    const cache = presser(boutonDe(plus, 'calque/visible'));
    expect([cache.calque, boutonDe(cache, 'calque/caler').refus]).toEqual([null, 'Un calque caché ne se cale pas']);
    expect(cache.memoire?.calques.calques[charge.calque!.image.split('/')[2]][0]).toMatchObject({ visible: false, dessus: false, opacite: 0.7 });
    const visible = presser(boutonDe(cache, 'calque/visible'));
    presser(boutonDe(visible, 'calque/caler'));
    const ajoutee = presser(boutonDe(visible, 'couche/ajouter'));
    expect(lignes(ajoutee).calque).toBe(`Calque de référence · couche ${ajoutee.vue.couche}`);
    const rez = presser(boutonDe(ajoutee, 'couche/0'));
    expect(lignes(rez)['calque/calage'], 'revenue au rez, le calage abandonné').toBeUndefined();
    const retire = presser(boutonDe(rez, 'calque/retirer'));
    expect([retire.calque, retire.memoire?.oublier]).toEqual([null, [charge.calque!.image]]);
  });

  it('rouverte avec les calques gardés, le calque revient ; d’un autre format ou illisibles, ils sont retirés et dits', () => {
    const premiere = ouvrirLaCarte();
    premiere.presser(boutonDe(premiere.ouverte, 'calque/charger'));
    const charge = premiere.jouer({ geste: 'chargement', image: { largeur: 100, hauteur: 50 } });
    const gardes = JSON.stringify(charge.memoire!.calques);
    const rouverte = ouvrirLaCarte(gardes).ouverte;
    expect([rouverte.calque, rouverte.memoire]).toEqual([charge.calque, undefined]);
    for (const autre of [JSON.stringify({ ...charge.memoire!.calques, version: 'ancien' }), '{']) {
      const ecartee = ouvrirLaCarte(autre).ouverte;
      expect(ecartee.calque).toBeNull();
      expect(ecartee.memoire, 'les calques retirés, à garder vides').toEqual({ calques: { version: charge.memoire!.calques.version, calques: {} }, oublier: [] });
      expect(lignes(ecartee)['calque/ecartes']).toBe('Calques d’un autre format : ils ont été retirés.');
    }
  });
});

describe('l’éditeur de carte par le pont, au dépôt', () => {
  const manuscrit = listerProjetsLivres().find((rel) => rel.split('/').pop()! in PROJETS_MANUSCRITS)!;
  const servi = lireProjetLivre(manuscrit) as { id: string };
  const ouvrir = (doc: unknown = servi) => ({ ouvrir: servi.id, projet: JSON.stringify(doc) });

  it('ouverte du jeu, elle ne s’enregistre pas ; ouverte du dépôt, rien à enregistrer tant qu’elle n’a pas changé', () => {
    const { appel } = table();
    expect(boutonDe(editionDe(appel('editer', { ouvrir: servi.id })), 'enregistrer').refus).toBe('Ouverte du jeu, hors du dépôt : elle ne s’enregistre pas');
    expect(boutonDe(editionDe(appel('editer', ouvrir())), 'enregistrer').refus).toBe('Rien à enregistrer');
  });

  it('un projet servi illisible, d’un autre id ou refusé par la porte se refuse', () => {
    const { appel } = table();
    expect(erreurDe(appel('editer', { ouvrir: servi.id, projet: '{' })).message).toBe('editer : projet, JSON illisible');
    expect(erreurDe(appel('editer', ouvrir({ ...servi, id: CAMPAGNE }))).categorie).toBe('validation');
    expect(erreurDe(appel('editer', ouvrir({ ...servi, scenes: [] }))).message).toMatch(/^editer : Ouverture refusée/);
  });

  it('enregistrer rend le texte du dépôt, la case peinte comprise ; l’issue réussie le tient pour enregistré, l’échouée non', () => {
    const { appel } = table();
    const jouer = (edition: unknown) => editionDe(appel('editer', { edition }));
    const presser = (b: Bouton) => editionDe(appel('editer', b.jeu));
    const ouverte = editionDe(appel('editer', ouvrir()));
    expect(erreurDe(appel('editer', { edition: { geste: 'enregistrement', reussi: true } })).message).toBe('editer : aucun enregistrement en cours');
    const terrain = presser(boutonDe(ouverte, 'outil/tile'));
    const avant = jouer({ geste: 'appui', point: point(1, 1) });
    const autre = valeursDe(terrain, 'terrains').find((b) => !b.presse)!;
    jouer({ geste: 'relache', point: point(1, 1) });
    presser(autre);
    jouer({ geste: 'appui', point: point(1, 1) });
    const peinte = jouer({ geste: 'relache', point: point(1, 1) });
    expect(avant.vue.zones['editeur.pointee'][0].texte).not.toContain(` · ${autre.libelle} · `);

    const enCours = presser(boutonDe(peinte, 'enregistrer'));
    expect(enCours.depot!.id).toBe(servi.id);
    expect(boutonDe(enCours, 'enregistrer').refus).toBe('Enregistrement en cours');
    expect(boutonDe(jouer({ geste: 'enregistrement', reussi: false }), 'enregistrer').refus, 'l’écriture échouée laisse la carte à enregistrer').toBeNull();
    presser(boutonDe(peinte, 'enregistrer'));
    expect(boutonDe(jouer({ geste: 'enregistrement', reussi: true }), 'enregistrer').refus).toBe('Rien à enregistrer');

    const depot = mkdtempSync(join(tmpdir(), 'editeur-3508-'));
    const fichier = join(dossierDesProjetsLivres(depot), manuscrit);
    mkdirSync(dirname(fichier), { recursive: true });
    writeFileSync(fichier, enCours.depot!.texte);
    const { appel: rouvrir } = table();
    rouvrir('editer', ouvrir(lireProjetLivre(manuscrit, depot)));
    rmSync(depot, { recursive: true, force: true });
    const relue = editionDe(rouvrir('editer', { edition: { geste: 'appui', point: point(1, 1) } }));
    expect(relue.vue.zones['editeur.pointee'][0].texte, 'rouverte, la case porte le terrain peint').toContain(` · ${autre.libelle} · `);
  });
});
