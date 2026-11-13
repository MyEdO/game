/**
 * L'ÉDITEUR DE CARTE PAR LE PONT (#3508) : `editer` ouvre la première scène d'une campagne du jeu, joue les gestes que
 * ses zones offrent et les gestes du pointeur, rend la surcouche du geste en cours, et le monde à l'ouverture, au
 * changement de couche et à chaque écriture finie, jamais pendant le geste. Ouverte du texte que sert le dépôt, la carte
 * s'y enregistre : `editer` rend le texte à écrire, et la tient pour enregistrée à l'issue réussie de l'écriture. Les
 * entités et les entrées de la couche éditée se repèrent en surcouche ; le formulaire de l'inspecteur les nomme. Le
 * formulaire tiré du schéma écrit la condition d'entrée d'un déclencheur, le Test de traversée et les effets d'une zone d'effet (#3606).
 * Les écrivains dédiés de la scène y passent aussi : sa musique, son message d'introduction saisi sur plusieurs lignes,
 * ses ancres de bataille, ses groupes, et l'apparence d'une ouverture de façade (#3606). Le formulaire tiré du schéma
 * d'un personnage écrit son rôle au combat, ses options au contexte de sa fiche, et ses onglets se partagent ses
 * éléments (#3606 M1a). Une adresse de prose s'y désigne par des choix seuls, son chapitre demandé à l'hôte puis rendu,
 * chacun de ses fragments scellé par le noyau (#3606 M2g).
 */
import { describe, expect, it } from 'vitest';
import { erreurDe, modelesCommites, morceauxDe, servirLesModeles, table, type Reponse } from './pont.testkit';
import type { MondeDuPont, MorceauxDuPont, NavireServi } from './pont';
import { UNITES_DU_PLAN_DE_CARTE, type AreteDessinee, type RetraitDuMonde, type Scene } from '../../../src/noyau/index';
import { allBuiltinCampaigns } from '../../../src/scenes/campaign';
import type { Bouton, Choix, Formulaire, Ligne, Plan } from '../../../src/hote/elements';
import type { CalqueAffiche, SurcoucheDeLEdition, ZonesDeLEditeur } from '../../../src/hote/editeur';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findCreatureById, traits } from '../../../src/data';
import { statblockDeLaCreature } from '../../../src/data/valeursNeuves';
import { emptyScene } from '../../../src/noyau/monde/scene';
import { parseTraitInstance } from '../../../src/data/refFormatLivre';
import { idsDeLaSousListe } from '../../../src/data/schemas/grammaire/ref';
import { CIBLE_D_APPARTENANCE } from '../../../src/data/schemas/grammaire/sousListes';
import { dossierDesProjetsLivres, listerProjetsLivres, PROJETS_MANUSCRITS } from '../../../scripts/guards/lib/projetsLivres.mjs';
import { lireProjetLivre } from '../../../scripts/source/projetLivre.mjs';
import type { Fragment } from '../../../src/data/source/decoupe';

interface Edition {
  vue: { zones: ZonesDeLEditeur; couche: number };
  surcouche: SurcoucheDeLEdition;
  monde?: NonNullable<MondeDuPont['monde']>;
  retrait?: RetraitDuMonde;
  aretes?: AreteDessinee[];
  navires?: Record<string, NavireServi>;
  depot?: { id: string; texte: string };
  calque: CalqueAffiche | null;
  planche?: { image: string };
  chapitre?: { book: string; ch: string };
  memoire?: { calques: { version: string; calques: Record<string, Record<string, Record<string, unknown>>> }; oublier: string[]; deplacer: { de: string; vers: string }[] };
}

/** L'édition d'une réponse réussie, ou l'échec qui dit la réponse. */
function editionDe(r: Reponse): Edition {
  if (!r.ok || !r.vue || !('surcouche' in r)) throw new Error(`réponse sans édition : ${JSON.stringify(r).slice(0, 400)}`);
  return r as unknown as Edition;
}

/** Le bouton d'id `id` des zones de l'éditeur, posé seul ou parmi les valeurs d'un choix. */
function boutonDe(e: Edition, id: string): Bouton {
  const b = Object.values(e.vue.zones).flat().flatMap((el: Ligne | Choix | Bouton | Formulaire | Plan) => (el.type === 'bouton' ? [el] : el.type === 'choix' || el.type === 'liste' ? el.valeurs : [])).find((v) => v.id === id);
  if (!b) throw new Error(`aucun bouton ${id}`);
  return b;
}

/** Les valeurs du choix d'id `id` des options de l'outil. */
function valeursDe(e: Edition, id: string): Bouton[] {
  const c = e.vue.zones['editeur.options'].find((el) => el.id === id);
  if (c?.type !== 'choix' && c?.type !== 'liste') throw new Error(`aucun choix ${id}`);
  return c.valeurs;
}

/** Les valeurs du choix d'id `id` de l'inspecteur. */
function valeursDeLInspecteur(e: Edition, id: string): Bouton[] {
  const c = e.vue.zones['editeur.inspecteur'].find((el) => el.id === id);
  if (c?.type !== 'choix' && c?.type !== 'liste') throw new Error(`aucun choix ${id}`);
  return c.valeurs;
}

/** La première campagne du jeu : chaque scène a au moins deux cases de côté. */
const CAMPAGNE = allBuiltinCampaigns[0].id;
const COMMITES = await modelesCommites();
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
    expect(ouverte.monde!.morceaux.length, 'le manifeste du monde de la scène, à l’ouverture').toBeGreaterThan(0);
    expect(ouverte.retrait, 'et le masque de la couche éditée').toMatchObject({ largeur: expect.any(Number), rangees: 2 * ouverte.monde!.hauteurs.length * ouverte.monde!.hauteurs[0].rangees.length });
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
    const empreinteAvant = new Map(ouverte.monde!.morceaux.map((m) => [m.cle, m.empreinte]));
    const bouges = fini.monde!.morceaux.filter((m) => empreinteAvant.get(m.cle) !== m.empreinte);
    expect(bouges.length, 'des morceaux ont bougé').toBeGreaterThan(0);
    expect(bouges.map((m) => m.cle).filter((cle) => !/^(sol|pose)\/0\/0\/0$/.test(cle)), 'seuls ceux du bloc de la case peinte').toEqual([]);
    const recus = appel('morceaux', { source: 'edition', volume: bouges.map((m) => m.cle), toits: [], couronnes: [] }) as unknown as MorceauxDuPont;
    expect(recus.volume.map((m) => [m.cle, m.empreinte]), 'morceaux, source edition, les rend tels qu’au manifeste').toEqual(bouges.map((m) => [m.cle, m.empreinte]));
    const cles = fini.monde!.morceaux.map((m) => m.cle);
    const tous = appel('morceaux', { source: 'edition', volume: ['sol/99/0/0', ...[...cles].reverse()], toits: [], couronnes: [] }) as unknown as MorceauxDuPont;
    expect(cles.length, 'plusieurs morceaux').toBeGreaterThan(1);
    expect(tous.volume.map((m) => m.cle), 'dans l’ordre du manifeste, l’inconnue omise').toEqual(cles);

    const annule = presser(boutonDe(fini, 'annuler'));
    expect(annule.monde).toEqual(ouverte.monde);
    expect(boutonDe(annule, 'retablir').refus).toBeNull();
  });

  it('pendant une glisse, morceaux source edition rend la scène du dernier manifeste ; au relâché, celle du neuf', () => {
    const { appel } = table();
    const jouer = (edition: unknown) => editionDe(appel('editer', { edition }));
    const presser = (b: Bouton) => editionDe(appel('editer', b.jeu));
    const ouverte = editionDe(appel('editer', { ouvrir: CAMPAGNE }));
    const avant = jouer({ geste: 'appui', point: point(1, 1) }).vue.zones['editeur.pointee'][0].texte;
    jouer({ geste: 'relache', point: point(1, 1) });
    presser(valeursDe(presser(boutonDe(ouverte, 'outil/tile')), 'terrains').find((b) => !avant.includes(` · ${b.libelle} · `))!);
    jouer({ geste: 'appui', point: point(1, 1) });
    const glisse = jouer({ geste: 'glisse', point: point(2, 1) });
    expect([glisse.monde, glisse.surcouche.cases.length], 'la glisse ne rend que la surcouche').toEqual([undefined, 2]);
    const cles = ouverte.monde!.morceaux.map((m) => m.cle);
    const pendant = appel('morceaux', { source: 'edition', volume: cles, toits: [], couronnes: [] }) as unknown as MorceauxDuPont;
    expect(pendant.volume.map((m) => [m.cle, m.empreinte]), 'les morceaux de l’ouverture').toEqual(ouverte.monde!.morceaux.map((m) => [m.cle, m.empreinte]));
    const fini = jouer({ geste: 'relache', point: point(2, 1) });
    const bouges = fini.monde!.morceaux.filter((m) => ouverte.monde!.morceaux.find((o) => o.cle === m.cle)?.empreinte !== m.empreinte);
    expect(bouges.length, 'le trait relâché change des morceaux').toBeGreaterThan(0);
    const apres = appel('morceaux', { source: 'edition', volume: bouges.map((m) => m.cle), toits: [], couronnes: [] }) as unknown as MorceauxDuPont;
    expect(apres.volume.map((m) => [m.cle, m.empreinte]), 'ceux du manifeste neuf').toEqual(bouges.map((m) => [m.cle, m.empreinte]));
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
    expect(auNord(posee.aretes!), 'la porte posée, au monde rendu').toEqual([{ cle: '1,1,N,0', cases: [{ x: 1, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }], milieu: { x: 1, y: 0.5 }, sens: { x: 1, y: 0 }, pied: 0, piece: 'porte-ouverte', famille: 'colombage', hauteurM: 4, bloc: '0/0/0' }]);
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
    expect(valeursDeLInspecteur(barree, 'valeur/barrier/blockGroups/ajouter').map((v) => (v.jeu as { args: unknown[] }).args.slice(1)), 'barrée, elle offre les groupes qu’elle bloque, au catalogue des Groupes d’appartenance').toEqual(idsDeLaSousListe('groupe', CIBLE_D_APPARTENANCE).map((id) => [['barrier', 'blockGroups'], [id]]));
    expect(inspecteur(opaque).some((el) => el.id.startsWith('valeur/barrier')), 'ouverte, aucun').toBe(false);

    expect(inspecteur(posee).find((el) => el.id === 'zone/couvre')).toMatchObject({ type: 'ligne', texte: 'Aucune entrée de fiche couverte.' });
    const offerte = (inspecteur(barree).find((el) => el.id === 'zone/couvre/ajouter') as Choix).valeurs[0];
    const couverte = presser(offerte);
    const id = offerte.id.slice('zone/couvre/ajouter/'.length);
    expect(inspecteur(couverte).find((el) => el.id === `zone/couvre/${id}`)).toMatchObject({ type: 'ligne', texte: `Couvre ${offerte.libelle}` });
    expect((inspecteur(couverte).find((el) => el.id === 'zone/couvre/ajouter') as Choix).valeurs.some((v) => v.id === offerte.id), 'une entrée couverte ne s’offre plus').toBe(false);
    expect(inspecteur(presser(boutonDe(couverte, `zone/couvre/retirer/${id}`))).find((el) => el.id === 'zone/couvre')?.type, 'retirée, la zone n’en couvre aucune').toBe('ligne');
  });

  it('un déclencheur se renomme, sous un nom libre seulement, et couvre une entrée de fiche', () => {
    const { appel, presser, posee } = tracee('trigger');
    const renomme = editionDe(appel('editer', { type: 'nommer', args: ['arrivee-au-relais'] }));
    expect(renomme.surcouche.zones.find((z) => z.choisi)).toMatchObject({ sorte: 'declencheur', nom: 'arrivee-au-relais' });
    const ancien = posee.surcouche.zones.find((z) => z.choisi)!.nom;
    expect(renomme.surcouche.zones.some((z) => z.nom === ancien), 'le déclencheur ne garde pas son ancien nom').toBe(false);
    const couvert = presser((renomme.vue.zones['editeur.inspecteur'].find((el) => el.id === 'zone/couvre/ajouter') as Choix).valeurs[0]);
    expect((couvert.vue.zones['editeur.inspecteur'].find((el) => el.id === 'zone/couvre/retirer') as Choix).valeurs).toHaveLength(1);
  });
});

describe('l’éditeur de carte par le pont, la logique (#3606 M3b2)', () => {
  /** Une table ouverte sur la campagne et le dialogue neuf que la zone Logique y ajoute, sélectionné. */
  function ajoute() {
    const { appel } = table();
    const jouer = (edition: unknown) => editionDe(appel('editer', { edition }));
    const presser = (b: Bouton) => editionDe(appel('editer', b.jeu));
    const ouverte = editionDe(appel('editer', { ouvrir: CAMPAGNE }));
    const avant = ouverte.vue.zones['editeur.logique'].find((el) => el.id === 'logique/dialogue') as Ligne;
    const ajoutee = presser(boutonDe(ouverte, 'logique/dialogue/ajouter'));
    return { appel, jouer, presser, ouverte, avant, ajoutee };
  }
  const inspecte = (e: Edition, id: string) => e.vue.zones['editeur.inspecteur'].find((el) => el.id === id);

  it('la zone liste les déclencheurs et les dialogues de la scène, comptés ; « Ajouter un dialogue » le crée sélectionné, son inspecteur à son formulaire', () => {
    const { ouverte, avant, ajoutee } = ajoute();
    const lignes = ouverte.vue.zones['editeur.logique'].filter((el): el is Ligne => el.type === 'ligne');
    expect(lignes.map((el) => el.id)).toEqual(expect.arrayContaining(['logique/declencheur', 'logique/dialogue']));
    expect(lignes.filter((el) => el.texte.startsWith('ecran.')).map((el) => el.id), 'chaque sorte listée a son texte').toEqual([]);
    const n = Number(/\((\d+)\)/.exec(avant.texte)![1]);
    expect((ajoutee.vue.zones['editeur.logique'].find((el) => el.id === 'logique/dialogue') as Ligne).texte).toBe(`Dialogues (${n + 1})`);
    const liste = ajoutee.vue.zones['editeur.logique'].find((el) => el.id === 'logique/dialogue/liste') as Choix;
    const choisi = liste.valeurs.filter((b) => b.presse);
    expect(choisi).toHaveLength(1);
    expect(choisi[0].jeu).toEqual({ edition: { geste: 'selectionner', porteur: { sorte: 'dialogue', id: choisi[0].libelle } } });
    expect(inspecte(ajoutee, 'nommer')).toMatchObject({ type: 'formulaire', champs: [{ valeur: choisi[0].libelle }] });
    expect(inspecte(ajoutee, 'dialogue/noeud/n1')).toMatchObject({ type: 'ligne', texte: '▶ n1' });
    expect(inspecte(ajoutee, 'valeur/nodes/0')).toMatchObject({ type: 'ligne', texte: 'nœuds 1 « n1 »' });
    expect(boutonDe(ajoutee, 'dialogue/supprimer').refus, 'un dialogue que rien ne désigne se retire').toBeNull();
  });

  it('sélectionner un porteur de la liste ouvre son inspecteur ; un déclencheur s’y sélectionne aussi', () => {
    const { presser, ajoutee, appel } = ajoute();
    const id = ((inspecte(ajoutee, 'nommer') as Formulaire).champs[0] as { valeur: string }).valeur;
    const scene = presser(boutonDe(editionDe(appel('editer', { edition: { geste: 'outil', outil: { mode: 'selection' } } })), 'logique/dialogue/ajouter'));
    expect(inspecte(scene, 'nommer')).not.toMatchObject({ champs: [{ valeur: id }] });
    const reprise = presser(boutonDe(scene, `logique/dialogue/${id}`));
    expect(boutonDe(reprise, `logique/dialogue/${id}`).presse).toBe(true);
    expect(inspecte(reprise, 'nommer')).toMatchObject({ champs: [{ valeur: id }] });
    const declencheurs = reprise.vue.zones['editeur.logique'].find((el) => el.id === 'logique/declencheur/liste') as Choix | undefined;
    if (declencheurs) expect(inspecte(presser(declencheurs.valeurs[0]), 'zone/uneFois')?.type, 'le déclencheur s’inspecte comme sur la carte').toBe('bouton');
  });

  it('un dialogue se renomme ; un nœud ajouté porte son identifiant, se renomme, et le départ le suit', () => {
    const { appel, presser, ajoutee } = ajoute();
    const renomme = editionDe(appel('editer', { type: 'nommer', args: ['accueil-du-relais'] }));
    expect(boutonDe(renomme, 'logique/dialogue/accueil-du-relais').presse).toBe(true);
    const noeud = valeursDeLInspecteur(renomme, 'valeur/nodes/ajouter').find((b) => b.libelle === 'n2')!;
    const deux = presser(noeud);
    expect(inspecte(deux, 'dialogue/noeud/n2')).toMatchObject({ type: 'ligne', texte: 'n2' });
    expect((inspecte(deux, 'identifier/noeud/n2') as Formulaire).champs.map((c) => c.type)).toEqual(['fixe', 'saisieTexte']);
    const depart = presser(valeursDeLInspecteur(deux, 'valeur/start/id').find((b) => b.libelle === 'n2')!);
    expect(inspecte(depart, 'dialogue/noeud/n2')).toMatchObject({ texte: '▶ n2' });
    const renommee = editionDe(appel('editer', { type: 'identifier', args: ['n2', 'salut'] }));
    expect(inspecte(renommee, 'dialogue/noeud/salut')).toMatchObject({ texte: '▶ salut' });
    expect(inspecte(renommee, 'valeur/nodes/1')).toMatchObject({ texte: 'nœuds 2 « salut »' });
    expect(ajoutee.vue.zones['editeur.inspecteur'].some((el) => el.id === 'identifier/noeud/salut')).toBe(false);
  });

  it('un dialogue qu’un personnage désigne ne se supprime pas, la raison dite ; désigné ailleurs, il se supprime', () => {
    const { appel, jouer, presser, ajoutee } = ajoute();
    const id = ((inspecte(ajoutee, 'nommer') as Formulaire).champs[0] as { valeur: string }).valeur;
    const outil = presser(boutonDe(ajoutee, 'outil/personnage'));
    presser(valeursDe(outil, 'fiches')[0]);
    jouer({ geste: 'appui', point: point(1, 1) });
    const pose = jouer({ geste: 'relache', point: point(1, 1) });
    const offre = pose.vue.zones['editeur.inspecteur'].find((el) => el.id.startsWith('valeur/dialogueId') && el.type !== 'ligne') as Choix;
    const designe = presser(offre.valeurs.find((b) => b.libelle === id)!);
    const dialogue = presser(boutonDe(designe, `logique/dialogue/${id}`));
    const refus = boutonDe(dialogue, 'dialogue/supprimer').refus;
    expect(refus, 'la raison du retrait refusé').toMatch(/\S/);
    expect(erreurDe(appel('editer', boutonDe(dialogue, 'dialogue/supprimer').jeu))).toMatchObject({ categorie: 'regle', message: `editer : ${refus}` });
    const libre = presser(boutonDe(dialogue, 'annuler'));
    const retenu = presser(boutonDe(libre, `logique/dialogue/${id}`));
    expect(boutonDe(retenu, 'dialogue/supprimer').refus, 'plus désigné, il se retire').toBeNull();
    const supprime = presser(boutonDe(retenu, 'dialogue/supprimer'));
    expect((supprime.vue.zones['editeur.logique'].find((el) => el.id === 'logique/dialogue/liste') as Choix | undefined)?.valeurs.some((b) => b.libelle === id) ?? false).toBe(false);
  });
});

describe('l’éditeur de carte par le pont, la rencontre (#3606 M4c)', () => {
  /** Une table ouverte sur la campagne, sa scène `scene` éditée (la première sans elle). */
  function ouverte(scene?: string) {
    const { appel } = table();
    const jouer = (edition: unknown) => editionDe(appel('editer', { edition }));
    const presser = (b: Bouton) => editionDe(appel('editer', b.jeu));
    const premiere = editionDe(appel('editer', { ouvrir: CAMPAGNE }));
    return { appel, jouer, presser, e: scene ? presser(boutonDe(premiere, `scenes/${scene}`)) : premiere };
  }
  const inspecte = (e: Edition, id: string) => e.vue.zones['editeur.inspecteur'].find((el) => el.id === id);
  /** Les ids des éléments de l'inspecteur, et des valeurs de ses choix, sous `prefixe`. */
  const idsSous = (e: Edition, prefixe: string) => e.vue.zones['editeur.inspecteur']
    .flatMap((el) => (el.type === 'choix' || el.type === 'liste' ? [el.id, ...el.valeurs.map((v) => v.id)] : [el.id])).filter((id) => id.startsWith(prefixe));

  it('« Ajouter une rencontre » la crée sélectionnée, son inspecteur à son formulaire ; un personnage s’y enrôle à son inspecteur, et la liste des membres n’écrit que leur monture', () => {
    const { jouer, presser, e } = ouverte();
    const ajoutee = presser(boutonDe(e, 'logique/rencontre/ajouter'));
    const choisi = (ajoutee.vue.zones['editeur.logique'].find((el) => el.id === 'logique/rencontre/liste') as Choix).valeurs.filter((b) => b.presse);
    expect(choisi.map((b) => b.jeu)).toEqual([{ edition: { geste: 'selectionner', porteur: { sorte: 'rencontre', id: choisi[0].libelle } } }]);
    const id = choisi[0].libelle;
    expect(inspecte(ajoutee, 'nommer')).toMatchObject({ type: 'formulaire', refus: null, champs: [{ valeur: id }] });
    expect(inspecte(ajoutee, 'rencontre/membres')).toMatchObject({ type: 'ligne', texte: 'Membres (0) — un personnage s’enrôle à son inspecteur' });
    expect(boutonDe(ajoutee, 'rencontre/supprimer').refus, 'une rencontre que rien ne désigne se retire').toBeNull();
    presser(valeursDe(presser(boutonDe(ajoutee, 'outil/personnage')), 'fiches')[0]);
    jouer({ geste: 'appui', point: point(1, 1) });
    const pose = jouer({ geste: 'relache', point: point(1, 1) });
    const enrole = presser(valeursDeLInspecteur(pose, `rencontre/${id}`).find((b) => b.id === `rencontre/${id}/enrole`)!);
    const inspectee = presser(boutonDe(enrole, `logique/rencontre/${id}`));
    const membres = inspectee.vue.zones['editeur.inspecteur'].filter((el): el is Ligne => el.id.startsWith('rencontre/membre'));
    expect(membres.map((l) => l.texte)).toEqual(['Membres (1) — un personnage s’enrôle à son inspecteur', expect.stringMatching(/ — Ennemi$/)]);
    expect(idsSous(inspectee, 'valeur/members')).toEqual(['valeur/members', 'valeur/members/0', 'valeur/members/0/mount', 'valeur/members/0/mount/0', 'valeur/members/0/mount/1', 'valeur/members/0/mount/aucune']);
  });

  it('une rencontre renommée l’est dans le « Démarrer un combat » du déclencheur qui la lance', () => {
    const { appel, presser, e } = ouverte();
    presser(boutonDe(e, 'logique/rencontre/enc-zone1'));
    const renommee = editionDe(appel('editer', { type: 'nommer', args: ['enc-cour'] }));
    expect(boutonDe(renommee, 'logique/rencontre/enc-cour').presse).toBe(true);
    const declencheur = presser(boutonDe(renommee, 'logique/declencheur/fight-enc-zone1'));
    const lance = declencheur.vue.zones['editeur.inspecteur'].flatMap((el) => (el.type === 'choix' || el.type === 'liste') && el.id.endsWith('/encounter/id') ? el.valeurs.filter((v) => v.presse).map((v) => v.libelle) : []);
    expect(lance).toEqual(['enc-cour']);
  });

  it('une rencontre qu’une embuscade de route lance se renomme, à cette embuscade aussi ; la supprimer reste refusé, la route dite à l’auteur', () => {
    const { appel, presser, e } = ouverte('arene-route-embuscade');
    const choisie = presser(boutonDe(e, 'logique/rencontre/enc-embuscade'));
    expect((inspecte(choisie, 'nommer') as Formulaire).refus).toBeNull();
    const renommee = editionDe(appel('editer', { type: 'nommer', args: ['enc-bois'] }));
    expect(boutonDe(renommee, 'logique/rencontre/enc-bois').presse).toBe(true);
    const supprimer = boutonDe(renommee, 'rencontre/supprimer');
    expect([supprimer.refus?.includes('« enc-bois »'), supprimer.refus?.includes('« route-futaie »')]).toEqual([true, true]);
    expect(erreurDe(appel('editer', supprimer.jeu))).toEqual(expect.objectContaining({ categorie: 'regle', message: `editer : ${supprimer.refus}` }));
  });

  it('la cible d’un objectif « seuil de dommage » se choisit parmi les membres ; la monture chevauchée, parmi les seules montures', () => {
    const { presser, e } = ouverte();
    const choisie = presser(boutonDe(e, 'logique/rencontre/enc-zone1'));
    const membres = idsSous(choisie, 'rencontre/membre/').map((id) => id.slice('rencontre/membre/'.length));
    expect(membres).toHaveLength(6);
    const seuil = presser(valeursDeLInspecteur(choisie, 'valeur/victoryCondition/type').find((b) => b.libelle === 'Sortie à seuil de dommage')!);
    expect(valeursDeLInspecteur(seuil, 'valeur/victoryCondition/targetId/ajouter').map((b) => b.libelle)).toEqual(membres);
    const monture = presser(boutonDe(choisie, 'valeur/members/1/mount/1'));
    expect(inspecte(monture, `rencontre/membre/${membres[1]}`)).toMatchObject({ texte: expect.stringMatching(/ — Ennemi, monture$/) });
    expect(valeursDeLInspecteur(monture, 'valeur/members/0/ridesEntityId/ajouter').map((b) => b.libelle)).toEqual([membres[1]]);
  });
});

describe('l’éditeur de carte par le pont, la carte du monde (#3606 M5)', () => {
  it('le menu Fichier ouvre la carte du monde, son inspecteur au formulaire de la carte, sans cran ; il rend la scène, à son inspecteur', () => {
    const { appel } = table();
    const presser = (b: Bouton) => editionDe(appel('editer', b.jeu));
    const e = editionDe(appel('editer', { ouvrir: CAMPAGNE }));
    expect(boutonDe(e, 'document/scene').presse).toBe(true);
    const carte = presser(boutonDe(e, 'document/carte'));
    const ids = (x: Edition) => x.vue.zones['editeur.inspecteur'].map((el) => el.id);
    expect([boutonDe(carte, 'document/carte').presse, boutonDe(carte, 'annuler').refus !== null]).toEqual([true, true]);
    expect(ids(carte).filter((id) => /^valeur\/[^/]+(\/ajouter)?$/.test(id))).toEqual(['valeur/label', 'valeur/background', 'valeur/params/ajouter', 'valeur/activeAxes/ajouter']);
    const scene = presser(boutonDe(carte, 'document/scene'));
    expect([boutonDe(scene, 'document/scene').presse, ids(scene)]).toEqual([true, ids(e)]);
  });

  /** Le geste du pointeur au point `(u, v)` du cadre du plan de la carte (`UNITES_DU_PLAN_DE_CARTE`). */
  const surLePlan = (geste: 'appui' | 'glisse' | 'relache', u: number, v: number) =>
    ({ edition: { geste, point: { case: { x: Math.floor(u * 100), y: Math.floor(v * 100) }, f: { x: u * 100, y: v * 100 } } } });
  const planDe = (x: Edition) => x.vue.zones['editeur.carte'][0] as Plan;
  const choisi = (x: Edition) => planDe(x).points.find((p) => p.ton === 'alerte')?.id;

  it('la carte ouverte montre son plan, ses outils, ses lieux et ses routes à la zone Logique, les zones de la scène vides ; l’outil Lieu pose un lieu au point appuyé', () => {
    const { appel } = table();
    const presser = (b: Bouton) => editionDe(appel('editer', b.jeu));
    const e = editionDe(appel('editer', { ouvrir: CAMPAGNE }));
    const logique = (x: Edition) => x.vue.zones['editeur.logique'].map((el) => el.id);
    expect([e.vue.zones['editeur.carte'], logique(e).filter((id) => /^logique\/(lieu|route)/.test(id))]).toEqual([[], []]);
    const carte = presser(boutonDe(e, 'document/carte'));
    const z = carte.vue.zones;
    expect([z['editeur.scenes'], z['editeur.options'], z['editeur.couches'], z['editeur.presse'], z['editeur.pointee'], z['editeur.calque']]).toEqual([[], [], [], [], [], []]);
    expect((z['editeur.outils'][0] as Choix).valeurs.map((b) => [b.id, b.presse])).toEqual([['outil/select', true], ['outil/lieu', false], ['outil/chemin', false]]);
    expect(logique(carte).filter((id) => !/^logique\/(lieu|route)/.test(id)), 'la logique de la scène ne s’y liste pas').toEqual([]);
    const lieux = (z['editeur.logique'].find((el) => el.id === 'logique/lieu/liste') as Choix).valeurs.map((b) => b.libelle);
    const plan = planDe(carte);
    expect([plan.id, plan.unites], 'le plan publie les unités de son pointeur').toEqual(['carte/plan', UNITES_DU_PLAN_DE_CARTE]);
    expect(plan.points.map((p) => p.id), 'chaque lieu de la liste est un point du plan').toEqual(lieux);
    expect(plan.traits.every((tr) => lieux.includes(tr.de) && lieux.includes(tr.vers))).toBe(true);
    const lieu = presser(boutonDe(carte, 'outil/lieu'));
    const pose = editionDe(appel('editer', surLePlan('appui', 0.85, 0.15)));
    const neuf = choisi(pose)!;
    expect([lieux.includes(neuf), planDe(pose).points.find((p) => p.id === neuf)]).toEqual([false, { type: 'point', id: neuf, nom: expect.any(String), x: 0.85, y: 0.15, ton: 'alerte', elements: [] }]);
    expect([boutonDe(lieu, 'outil/lieu').presse, boutonDe(pose, 'annuler').refus]).toEqual([true, null]);
  });

  it('à l’outil Chemin, la route tirée se montre au plan jusqu’au pointeur puis se pose sur le lieu relâché ; son sens s’oriente à l’inspecteur ; « Relier à » la double depuis un lieu ; sans sélection, la carte se retire du projet', () => {
    const { appel } = table();
    const presser = (b: Bouton) => editionDe(appel('editer', b.jeu));
    const pointer = (geste: 'appui' | 'glisse' | 'relache', u: number, v: number) => editionDe(appel('editer', surLePlan(geste, u, v)));
    const carte = presser(boutonDe(editionDe(appel('editer', { ouvrir: CAMPAGNE })), 'document/carte'));
    presser(boutonDe(carte, 'outil/lieu'));
    pointer('appui', 0.85, 0.15);
    const neuf = choisi(pointer('relache', 0.85, 0.15))!;
    const depart = planDe(carte).points[0];
    presser(boutonDe(carte, 'outil/chemin'));
    pointer('appui', depart.x, depart.y);
    const tiree = pointer('glisse', 0.7, 0.2);
    expect([planDe(tiree).points.find((p) => p.id === 'brouillon/route'), planDe(tiree).traits.find((tr) => tr.id === 'brouillon/route')])
      .toEqual([{ type: 'point', id: 'brouillon/route', nom: '', x: 0.7, y: 0.2, ton: 'neutre', elements: [] }, { id: 'brouillon/route', de: depart.id, vers: 'brouillon/route', ton: 'reussite' }]);
    const posee = pointer('relache', 0.85, 0.15);
    const route = planDe(posee).traits.find((tr) => tr.ton === 'reussite')!;
    expect([route.de, route.vers, planDe(posee).points.some((p) => p.id === 'brouillon/route')]).toEqual([depart.id, neuf, false]);
    expect(valeursDeLInspecteur(posee, 'route/sens').map((b) => [b.id, b.presse])).toEqual([['route/sens/deux', true], [`route/sens/${depart.id}`, false], [`route/sens/${neuf}`, false]]);
    const orientee = presser(boutonDe(posee, `route/sens/${neuf}`));
    expect(valeursDeLInspecteur(orientee, 'route/sens').find((b) => b.presse)?.id).toBe(`route/sens/${neuf}`);
    const depuis = presser(boutonDe(orientee, `logique/lieu/${depart.id}`));
    const retour = presser(boutonDe(depuis, `logique/route/ajouter/${neuf}`));
    expect(planDe(retour).traits.filter((tr) => [tr.de, tr.vers].sort().join() === [depart.id, neuf].sort().join())).toHaveLength(2);
    const sans = presser(boutonDe(retour, 'route/supprimer'));
    expect(sans.vue.zones['editeur.inspecteur'].map((el) => el.id).filter((id) => id.endsWith('/supprimer') || id.endsWith('/retirer'))).toEqual(['carte/retirer']);
    const retiree = presser(boutonDe(sans, 'carte/retirer'));
    expect([boutonDe(retiree, 'document/scene').presse, retiree.vue.zones['editeur.carte']]).toEqual([true, []]);
  });

  it('« Plan du lieu » montre au plan les points d’intérêt du lieu, aux outils du plan : Épingler en pose un au point, le glissé le déplace, « Retirer le point d’intérêt » l’ôte ; le refermer rend la carte', () => {
    const { appel } = table();
    const presser = (b: Bouton) => editionDe(appel('editer', b.jeu));
    const pointer = (geste: 'appui' | 'glisse' | 'relache', u: number, v: number) => editionDe(appel('editer', surLePlan(geste, u, v)));
    const carte = presser(boutonDe(editionDe(appel('editer', { ouvrir: CAMPAGNE })), 'document/carte'));
    const lieu = planDe(carte).points[0].id;
    const choisi = presser(boutonDe(carte, `logique/lieu/${lieu}`));
    expect([boutonDe(choisi, 'lieu/plan').presse, choisi.vue.zones['editeur.inspecteur'].some((el) => el.id === 'lieu/poi/retirer')]).toEqual([false, false]);
    const ouvert = presser(boutonDe(choisi, 'lieu/plan'));
    expect([planDe(ouvert).id, planDe(ouvert).unites, boutonDe(ouvert, 'lieu/plan').presse, boutonDe(ouvert, 'lieu/poi/retirer').refus !== null]).toEqual(['lieu/plan', UNITES_DU_PLAN_DE_CARTE, true, true]);
    expect((ouvert.vue.zones['editeur.outils'][0] as Choix).valeurs.map((b) => [b.id, b.presse])).toEqual([['outil/select', true], ['outil/epingler', false]]);
    const avant = planDe(ouvert).points.length;
    presser(boutonDe(ouvert, 'outil/epingler'));
    const pose = pointer('appui', 0.3, 0.4);
    const neuf = planDe(pose).points.find((p) => p.ton === 'alerte')!;
    expect([planDe(pose).points.length, neuf.x, neuf.y, boutonDe(pose, 'lieu/poi/retirer').refus]).toEqual([avant + 1, 0.3, 0.4, null]);
    pointer('relache', 0.3, 0.4);
    presser(boutonDe(pose, 'outil/select'));
    pointer('appui', 0.3, 0.4);
    pointer('glisse', 0.55, 0.6);
    const glisse = pointer('relache', 0.55, 0.6);
    expect(planDe(glisse).points.find((p) => p.id === neuf.id)).toEqual({ ...neuf, x: 0.55, y: 0.6 });
    const retire = presser(boutonDe(glisse, 'lieu/poi/retirer'));
    expect(planDe(retire).points.map((p) => p.id)).toEqual(planDe(ouvert).points.map((p) => p.id));
    const annule = presser(boutonDe(retire, 'annuler'));
    expect([planDe(annule).id, planDe(annule).points.some((p) => p.id === neuf.id), boutonDe(annule, 'lieu/plan').presse], '« Annuler » au plan du lieu le garde ouvert, son lieu à l’inspecteur').toEqual(['lieu/plan', true, true]);
    const ferme = presser(boutonDe(annule, 'lieu/plan'));
    expect([planDe(ferme).id, boutonDe(ferme, 'lieu/plan').presse]).toEqual(['carte/plan', false]);
  });

  it('sur la carte sans sélection, les axes actifs du projet s’ajoutent parmi ceux du catalogue, et se retirent', () => {
    const { appel } = table();
    const presser = (b: Bouton) => editionDe(appel('editer', b.jeu));
    const carte = presser(boutonDe(editionDe(appel('editer', { ouvrir: CAMPAGNE })), 'document/carte'));
    const offerts = valeursDeLInspecteur(carte, 'valeur/activeAxes/ajouter');
    expect(offerts.map((b) => b.libelle)).toContain('Mêlée');
    const ajoute = presser(offerts.find((b) => b.libelle === 'Mêlée')!);
    const retirer = ajoute.vue.zones['editeur.inspecteur'].flatMap((el) => (el.type === 'bouton' && el.id.startsWith('valeur/activeAxes/') && el.id.endsWith('/retirer') ? [el] : []));
    expect(retirer).toHaveLength(1);
    const retire = presser(retirer[0]);
    expect(valeursDeLInspecteur(retire, 'valeur/activeAxes/ajouter').map((b) => b.libelle)).toEqual(offerts.map((b) => b.libelle));
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
    expect(boutonDe(posee, 'architecture/selection').presse, 'la façade posée, le clic revient à la sélection').toBe(true);
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

  it('la toiture d’un corps : son profil, sa pente réglée puis suivie, sa couverture ; une exclusion tirée sur la couche, puis retirée', () => {
    const { appel } = table();
    const jouer = (edition: unknown) => editionDe(appel('editer', { edition }));
    const presser = (b: Bouton) => editionDe(appel('editer', b.jeu));
    const inspecteur = (e: Edition) => e.vue.zones['editeur.inspecteur'];
    presser(boutonDe(editionDe(appel('editer', { ouvrir: CAMPAGNE })), 'outil/architecture'));
    jouer({ geste: 'appui', point: point(2, 2) });
    const bati = presser(boutonDe(jouer({ geste: 'relache', point: point(2, 2) }), 'batir/corps'));
    expect(boutonDe(bati, 'toiture/profil/suit').presse, 'sans intention, le profil suit la portée').toBe(true);
    expect(boutonDe(presser(boutonDe(bati, 'toiture/profil/shed')), 'toiture/egout/aucun').presse, 'un appentis déclare son égout').toBe(true);

    const pente = (e: Edition) => inspecteur(e).find((el) => el.id === 'toiture/pente');
    const avant = pente(bati);
    const relevee = presser(boutonDe(bati, 'toiture/pente/plus'));
    expect(pente(relevee)).not.toEqual(avant);
    expect(boutonDe(relevee, 'toiture/pente/defaut').presse).toBe(false);
    expect(pente(presser(boutonDe(relevee, 'toiture/pente/defaut')))).toEqual(avant);
    const couverture = (inspecteur(bati).find((el) => el.id === 'toiture/couverture') as Choix).valeurs.find((v) => !v.presse && v.id !== 'toiture/couverture/suit')!;
    const couverte = presser(couverture);
    expect(boutonDe(couverte, couverture.id).presse).toBe(true);
    expect(boutonDe(couverte, 'toiture/couverture/suit').presse).toBe(false);

    presser(boutonDe(couverte, 'architecture/exclusion'));
    jouer({ geste: 'appui', point: point(3, 3) });
    jouer({ geste: 'glisse', point: point(4, 5) });
    const exclue = jouer({ geste: 'relache', point: point(4, 5) });
    expect(boutonDe(exclue, 'architecture/selection').presse, 'l’exclusion tirée, le clic revient à la sélection').toBe(true);
    expect(inspecteur(exclue).find((el) => el.id === 'toiture/exclusion/0')).toMatchObject({ texte: 'Exclusion de toiture : 2 × 3 cases depuis 3, 3 · couche 0' });
    expect(inspecteur(presser(boutonDe(exclue, 'toiture/exclusion/0/retirer'))).some((el) => el.id.startsWith('toiture/exclusion/'))).toBe(false);
  });

  it('une masse bâtie sur la case pointée : ses niveaux bornés à un, son profil, son faîtage, sa pente', () => {
    const { appel } = table();
    const jouer = (edition: unknown) => editionDe(appel('editer', { edition }));
    const presser = (b: Bouton) => editionDe(appel('editer', b.jeu));
    const inspecteur = (e: Edition) => e.vue.zones['editeur.inspecteur'];
    presser(boutonDe(editionDe(appel('editer', { ouvrir: CAMPAGNE })), 'outil/architecture'));
    jouer({ geste: 'appui', point: point(2, 2) });
    const bati = presser(boutonDe(jouer({ geste: 'relache', point: point(2, 2) }), 'batir/corps'));
    const masse = presser(boutonDe(bati, 'batir/masse'));
    expect(masse.surcouche.zones.find((z) => z.choisi)).toMatchObject({ sorte: 'masse', cases: [{ x: 2, y: 2, z: 0 }] });
    expect(boutonDe(masse, 'masse/couche/0').presse).toBe(true);
    expect(inspecteur(masse).find((el) => el.id === 'masse/niveaux')).toMatchObject({ texte: 'Niveaux : 1' });
    expect(boutonDe(masse, 'masse/niveaux/moins').refus).toBe('Déjà au minimum');
    const haute = presser(boutonDe(masse, 'masse/niveaux/plus'));
    expect(inspecteur(haute).find((el) => el.id === 'masse/niveaux')).toMatchObject({ texte: 'Niveaux : 2' });
    expect(boutonDe(presser(boutonDe(haute, 'masse/faitage/y')), 'masse/faitage/y').presse).toBe(true);
    const appentis = presser(boutonDe(haute, 'masse/profil/shed'));
    expect(boutonDe(appentis, 'masse/egout/aucun').presse).toBe(true);
    expect(boutonDe(presser(boutonDe(appentis, 'masse/egout/S')), 'masse/egout/S').presse).toBe(true);
    const pente = inspecteur(appentis).find((el) => el.id === 'masse/pente');
    expect(inspecteur(presser(boutonDe(appentis, 'masse/pente/moins'))).find((el) => el.id === 'masse/pente')).not.toEqual(pente);
  });

  it('sans corps, la façade et les ouvrages d’un corps se refusent', () => {
    const { appel } = table();
    const outil = editionDe(appel('editer', boutonDe(editionDe(appel('editer', { ouvrir: CAMPAGNE })), 'outil/architecture').jeu));
    expect(boutonDe(outil, 'architecture/facade').refus).toBe('Aucun corps dans la scène');
    expect(['etage', 'partie', 'masse'].map((o) => boutonDe(outil, `batir/${o}`).refus)).toEqual(Array(3).fill('Aucun corps dans la scène'));
  });
});

describe('l’éditeur de carte par le pont, la scène', () => {
  it('sans sélection, l’inspecteur règle la scène : son nom, sa description, sa grille, son nord, sa météo, son relief, sa toiture, son repos, ses drapeaux', () => {
    const { appel } = table();
    const presser = (b: Bouton) => editionDe(appel('editer', b.jeu));
    const inspecteur = (e: Edition) => e.vue.zones['editeur.inspecteur'];
    const champ = (e: Edition, verbe: string) => (inspecteur(e).find((el) => el.type === 'formulaire' && el.verbe === verbe) as Formulaire).champs[0];
    const ouverte = editionDe(appel('editer', { ouvrir: CAMPAGNE }));
    const texte = (e: Edition, id: string) => (inspecteur(e).find((el) => el.id === id) as Ligne).texte;
    const nombre = (e: Edition, id: string) => Number(/-?\d+/.exec(texte(e, id))![0]);
    expect(champ(ouverte, 'nommer')).toMatchObject({ valeur: ouverte.vue.zones['editeur.titre'][0].texte });
    expect(editionDe(appel('editer', { type: 'nommer', args: ['Relais de poste'] })).vue.zones['editeur.titre'][0]).toMatchObject({ texte: 'Relais de poste' });
    expect(champ(editionDe(appel('editer', { type: 'decrire', args: ['Une note'] })), 'decrire')).toMatchObject({ valeur: 'Une note' });
    expect(champ(editionDe(appel('editer', { type: 'decrire', args: [] })), 'decrire')).toMatchObject({ valeur: '' });

    const large = presser(boutonDe(ouverte, 'scene/largeur/plus'));
    expect(nombre(large, 'scene/largeur')).toBe(nombre(ouverte, 'scene/largeur') + 1);
    expect(texte(large, 'scene/nord'), 'aucune scène livrée ne déclare son nord').toBe('Nord : vers le haut du plan');
    const tourne = presser(boutonDe(large, 'scene/nord/plus'));
    expect(texte(tourne, 'scene/nord')).toBe('Nord : 15° dans le sens horaire');
    expect(boutonDe(presser(boutonDe(tourne, 'scene/nord/defaut')), 'scene/nord/defaut').presse).toBe(true);

    const meteo = valeursDeLInspecteur(tourne, 'scene/meteo').find((b) => !b.presse && b.id !== 'scene/meteo/aucune')!;
    expect(boutonDe(presser(meteo), meteo.id).presse).toBe(true);
    const falaise = valeursDeLInspecteur(tourne, 'scene/relief/cliff').find((b) => !b.presse)!;
    expect(boutonDe(presser(falaise), falaise.id).presse).toBe(true);
    const pente = presser(boutonDe(tourne, 'scene/toiture/pente/plus'));
    expect(nombre(pente, 'scene/toiture/pente')).toBe(nombre(tourne, 'scene/toiture/pente') + 5);
    const camp = boutonDe(pente, 'scene/repos/camp');
    expect(boutonDe(presser(camp), 'scene/repos/camp').presse).toBe(!camp.presse);

    const drapeau = editionDe(appel('editer', { type: 'drapeau', args: ['pont-leve'] }));
    expect(boutonDe(drapeau, 'scene/drapeau/pont-leve').presse).toBe(true);
    expect(boutonDe(presser(boutonDe(drapeau, 'scene/drapeau/pont-leve')), 'scene/drapeau/pont-leve').presse).toBe(false);
    const retire = presser(boutonDe(drapeau, 'scene/drapeau/retirer/pont-leve'));
    expect(() => boutonDe(retire, 'scene/drapeau/pont-leve')).toThrow();
    expect(erreurDe(appel('editer', { type: 'drapeau', args: [' '] })).categorie).toBe('validation');
  });

  it('la validation relève le défaut que l’édition pose ; « Y aller » le suit en surcouche, à l’outil de sélection ; corrigé, il s’efface', () => {
    const { appel } = table();
    const jouer = (edition: unknown) => editionDe(appel('editer', { edition }));
    const presser = (b: Bouton) => editionDe(appel('editer', b.jeu));
    const defaut = (e: Edition) => e.surcouche.zones.filter((z) => z.sorte === 'defaut');
    const releve = (e: Edition, rang: number) => (e.vue.zones['editeur.validation'][rang] as Ligne).texte;
    const ouverte = editionDe(appel('editer', { ouvrir: CAMPAGNE }));
    expect(releve(ouverte, 0)).toMatch(/^Validation : aucun défaut détecté/);

    const porte = { case: { x: 1, y: 1 }, f: { x: 1, y: 0.6 } };
    presser(boutonDe(presser(boutonDe(ouverte, 'outil/wall')), 'arete/door'));
    jouer({ geste: 'appui', point: porte });
    const isolee = jouer({ geste: 'relache', point: porte });
    expect(isolee.vue.zones['editeur.validation'].map((el) => el.id)).toEqual(['validation', 'validation/0', 'validation/0/aller']);
    expect(releve(isolee, 1)).toMatch(/^Avertissement : Porte posée sur une arête isolée — la porte N de \(1,1\)/);
    expect(defaut(isolee), 'aucun défaut suivi avant « Y aller »').toEqual([]);

    const suivie = presser(boutonDe(isolee, 'validation/0/aller'));
    expect(boutonDe(suivie, 'outil/select').presse).toBe(true);
    expect(defaut(suivie)).toEqual([{ sorte: 'defaut', nom: 'Défaut', cases: [{ x: 1, y: 1, z: 0 }], choisi: true }]);

    const corrigee = presser(boutonDe(suivie, 'annuler'));
    expect(releve(corrigee, 0)).toMatch(/^Validation : aucun défaut détecté/);
    expect(defaut(corrigee), 'le défaut corrigé ne se suit plus').toEqual([]);
  });
});

describe('l’éditeur de carte par le pont, les scènes du projet', () => {
  it('chaque scène du projet s’édite à sa pression, ses changements gardés ; une scène s’ajoute vide, se duplique, se retire, se renomme', () => {
    const { appel } = table();
    const presser = (b: Bouton) => editionDe(appel('editer', b.jeu));
    const scenes = (e: Edition) => valeursDe({ ...e, vue: { ...e.vue, zones: { ...e.vue.zones, 'editeur.options': e.vue.zones['editeur.scenes'] } } }, 'scenes');
    const titre = (e: Edition) => e.vue.zones['editeur.titre'][0].texte;
    const derniere = (e: Edition) => scenes(e)[scenes(e).length - 1];
    const ouverte = editionDe(appel('editer', { ouvrir: CAMPAGNE }));
    const [premiere, seconde] = scenes(ouverte);
    expect(scenes(ouverte).length, 'les scènes de la campagne, la première éditée').toBeGreaterThan(1);
    expect([premiere.presse, seconde.presse]).toEqual([true, false]);

    editionDe(appel('editer', { type: 'nommer', args: ['Relais de poste'] }));
    const ailleurs = presser(seconde);
    expect([titre(ailleurs), scenes(ailleurs)[0].libelle, scenes(ailleurs)[1].presse]).toEqual([seconde.libelle, 'Relais de poste', true]);
    const revenue = presser(scenes(ailleurs)[0]);
    expect(titre(revenue), 'revenue, la scène garde son nom').toBe('Relais de poste');
    expect(titre(presser(boutonDe(presser(seconde), 'annuler'))), 'annuler depuis une autre scène montre la scène du cran').toBe(premiere.libelle);
    expect(titre(presser(boutonDe(revenue, 'retablir')))).toBe('Relais de poste');

    const neuve = presser(boutonDe(ailleurs, 'scenes/ajouter'));
    expect([titre(neuve), scenes(neuve).length, derniere(neuve).id]).toEqual(['Nouvelle scène', scenes(ouverte).length + 1, 'scenes/scene-0']);
    const copie = presser(boutonDe(neuve, 'scenes/dupliquer'));
    expect([titre(copie), derniere(copie).id]).toEqual(['Nouvelle scène (copie)', 'scenes/scene-1']);
    const retiree = presser(boutonDe(copie, 'scenes/retirer'));
    expect([titre(retiree), scenes(retiree).length], 'la copie retirée, sa précédente éditée').toEqual(['Nouvelle scène', scenes(neuve).length]);

    const renommee = editionDe(appel('editer', { type: 'identifier', args: ['cour'] }));
    expect(derniere(renommee)).toMatchObject({ id: 'scenes/cour', presse: true });
    expect(derniere(editionDe(appel('editer', { type: 'identifier', args: [premiere.id.slice('scenes/'.length)] }))).id, 'un identifiant déjà pris se refuse').toBe('scenes/cour');
  });
});

describe('l’éditeur de carte par le pont, l’essai', () => {
  it('« Tester la scène » met la scène éditée à l’essai : demarrer { essai } la joue, à jour, par le groupe vitrine', () => {
    const { appel } = table();
    expect(erreurDe(appel('demarrer', { essai: true })).message).toBe('demarrer : essai, aucune scène mise à l’essai par editer');
    const ouverte = editionDe(appel('editer', { ouvrir: CAMPAGNE }));
    const seconde = (ouverte.vue.zones['editeur.scenes'][0] as Choix).valeurs[1];
    const ailleurs = editionDe(appel('editer', seconde.jeu));
    editionDe(appel('editer', { type: 'nommer', args: ['Relais de poste'] }));
    const testee = appel('editer', boutonDe(ailleurs, 'tester').jeu) as Reponse & { essai?: boolean };
    expect(testee.essai).toBe(true);
    const partie = appel('demarrer', { essai: true }) as Reponse & { vue?: { projection: { scene: { id: string } | null } } };
    expect(partie.ok).toBe(true);
    expect(partie.vue!.projection.scene, 'la partie s’ouvre sur la scène éditée, à jour').toEqual({ id: seconde.id.slice('scenes/'.length), nom: 'Relais de poste' });
    expect(erreurDe(appel('demarrer', { essai: true })).message).toBe('demarrer : une partie est ouverte ; quitter d’abord');
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

  it('un personnage : son inventaire d’auteur, un objet ajouté du catalogue, porté, une seconde pièce de la même couche l’ôte, retiré (#3684)', () => {
    const { appel } = table();
    const jouer = (edition: unknown) => editionDe(appel('editer', { edition }));
    const presser = (b: Bouton) => editionDe(appel('editer', b.jeu));
    const ouverte = editionDe(appel('editer', { ouvrir: CAMPAGNE }));
    presser(boutonDe(ouverte, 'outil/personnage'));
    jouer({ geste: 'appui', point: point(1, 1) });
    const pnj = jouer({ geste: 'relache', point: point(1, 1) });
    expect(pnj.vue.zones['editeur.inspecteur'].some((el) => el.id === 'inventaire'), 'sans objet, une ligne le dit').toBe(true);
    const cotte = presser(boutonDe(pnj, 'inventaire/ajouter/cotte-de-mailles'));
    const chemise = presser(boutonDe(cotte, 'inventaire/ajouter/chemise-de-mailles'));
    expect(valeursDeLInspecteur(chemise, 'inventaire/cotte-de-mailles').map((b) => [b.id, b.presse])).toEqual([['inventaire/cotte-de-mailles/porte', false], ['inventaire/cotte-de-mailles/retirer', false]]);
    expect(valeursDeLInspecteur(chemise, 'inventaire/ajouter').some((b) => b.id === 'inventaire/ajouter/chemise-de-mailles'), 'un objet de l’inventaire ne s’y ajoute plus').toBe(false);
    const portee = presser(boutonDe(chemise, 'inventaire/cotte-de-mailles/porte'));
    expect(boutonDe(portee, 'inventaire/cotte-de-mailles/porte').presse).toBe(true);
    const otee = presser(boutonDe(portee, 'inventaire/chemise-de-mailles/porte'));
    expect([boutonDe(otee, 'inventaire/cotte-de-mailles/porte').presse, boutonDe(otee, 'inventaire/chemise-de-mailles/porte').presse], 'deux mailles sur le Corps ne se portent pas ensemble').toEqual([false, true]);
    const retiree = presser(boutonDe(otee, 'inventaire/cotte-de-mailles/retirer'));
    expect([boutonDe(retiree, 'inventaire/chemise-de-mailles/porte').presse, retiree.vue.zones['editeur.inspecteur'].some((el) => el.id === 'inventaire/cotte-de-mailles')]).toEqual([true, false]);
  });

  it('un personnage de carrière : une carrière ajoutée, son Niveau, un Talent désigné, une dotation choisie, son profil porté (#773)', () => {
    const { appel } = table();
    const jouer = (edition: unknown) => editionDe(appel('editer', { edition }));
    const presser = (b: Bouton) => editionDe(appel('editer', b.jeu));
    const ligneDe = (e: Edition, id: string) => (e.vue.zones['editeur.inspecteur'].find((el) => el.id === id) as Ligne | undefined)?.texte;
    presser(boutonDe(editionDe(appel('editer', { ouvrir: CAMPAGNE })), 'outil/personnage'));
    jouer({ geste: 'appui', point: point(1, 1) });
    const pnj = jouer({ geste: 'relache', point: point(1, 1) });
    expect(ligneDe(pnj, 'profil/statut'), 'sans carrière, aucun profil').toBeUndefined();
    const medecin = presser(boutonDe(pnj, 'carriere/ajouter/medecin'));
    const doktor = presser(boutonDe(medecin, 'carriere/medecin/niveau/3'));
    expect(boutonDe(doktor, 'carriere/medecin/niveau/3').presse).toBe(true);
    expect(ligneDe(doktor, 'profil/statut')).toMatch(/Argent 5/);
    expect(ligneDe(doktor, 'profil/mentions/personne'), 'ses mentions, une ligne par nature').toBe('Personnes : Apprenti');
    const chirurgien = presser(boutonDe(doktor, 'carriere/medecin/talents/2/chirurgie'));
    expect(boutonDe(chirurgien, 'carriere/medecin/talents/2/chirurgie').presse).toBe(true);
    expect(ligneDe(chirurgien, 'profil/talents')).toMatch(/Chirurgie/);
    const soldat = presser(boutonDe(presser(boutonDe(chirurgien, 'carriere/medecin/retirer')), 'carriere/ajouter/soldat'));
    const hallebardier = presser(boutonDe(presser(boutonDe(soldat, 'carriere/soldat/niveau/2')), 'carriere/dotation/dotation:3/hallebarde'));
    expect([boutonDe(hallebardier, 'carriere/dotation/dotation:3/hallebarde').presse, boutonDe(hallebardier, 'carriere/dotation/dotation:3/tiree').presse]).toEqual([true, false]);
    expect(ligneDe(hallebardier, 'profil/possessions')).toMatch(/Hallebarde/);
    const tirees = (e: Edition) => valeursDeLInspecteur(e, 'valeur/combat/randomChars').find((b) => (b.jeu as { args: unknown[] }).args[2] === true)!;
    expect(tirees(presser(tirees(presser(boutonDe(hallebardier, 'valeur/combat/ajouter'))))).presse, 'ses Caractéristiques tirées au formulaire de son rôle au combat').toBe(true);
    expect(ligneDe(presser(boutonDe(hallebardier, 'carriere/soldat/retirer')), 'profil/statut'), 'sa seule carrière retirée, le profil part').toBeUndefined();
  });

  it('un personnage du Bestiaire : son profil porté, son rôle au combat au formulaire tiré du schéma, ses options au contexte de sa fiche, ses onglets sans id commun (#3606 M1a)', () => {
    const { appel } = table();
    const jouer = (edition: unknown) => editionDe(appel('editer', { edition }));
    const presser = (b: Bouton) => editionDe(appel('editer', b.jeu));
    const ligneDe = (e: Edition, id: string) => (e.vue.zones['editeur.inspecteur'].find((el) => el.id === id) as Ligne | undefined)?.texte;
    const valeurJouee = (b: Bouton) => (b.jeu as { args: unknown[] }).args[2];
    presser(boutonDe(presser(boutonDe(editionDe(appel('editer', { ouvrir: CAMPAGNE })), 'outil/personnage')), 'personnage/griffon-zoo-imperial'));
    jouer({ geste: 'appui', point: point(1, 1) });
    const griffon = jouer({ geste: 'relache', point: point(1, 1) });
    expect(ligneDe(griffon, 'profil/caracteristiques'), 'le profil porté se lit sans carrière').toMatch(/Blessures/);
    expect(ligneDe(griffon, 'profil/statut')).toBeUndefined();
    const ajouter = boutonDe(presser(boutonDe(griffon, 'valeur/combat/ajouter')), 'valeur/combat/optionals/ajouter');
    expect(ajouter.libelle).toBe('Ajouter : options');
    const option = presser(ajouter);
    const offerts = valeursDeLInspecteur(option, 'valeur/combat/optionals/0/id').map(valeurJouee);
    const fiche = findCreatureById('griffon-zoo-imperial')!;
    const facultatifs = fiche.optionals.flatMap((o) => ('id' in o && offerts.includes(o.id) ? [o.id] : []));
    const standard = traits.filter((t) => t.standard && !facultatifs.includes(t.id)).map((t) => t.id);
    expect(offerts).toHaveLength(128);
    expect(facultatifs.length, 'la fiche a des Traits facultatifs').toBeGreaterThan(0);
    expect(offerts.slice(0, facultatifs.length + standard.length), 'les Facultatifs de la fiche, puis les Traits standard (LDB 76 l.35)').toEqual([...facultatifs, ...standard]);
    const note = fiche.optionals.find((o) => 'note' in o);
    const variantes = valeursDeLInspecteur(option, 'valeur/combat/optionals/0/note');
    expect(variantes.map((b) => [b.presse, valeurJouee(b)]), 'le Trait posé, ou la note « swap » de la fiche, entière').toEqual([[true, { id: 'a-distance' }], [false, note]]);
    const swap = presser(variantes[1]);
    expect(ligneDe(swap, 'valeur/combat/optionals/0/remove'), 'posée, la note s’édite').toBeDefined();
    const ecran = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../projet/scenes/Editeur.tscn'), 'utf8');
    const zones = [...ecran.matchAll(/source = "editeur\.inspecteur"(?:\nids = PackedStringArray\(([^)]*)\))?/g)].map((m) => (m[1] ? [...m[1].matchAll(/"([^"]*)"/g)].map((i) => i[1]) : null));
    expect(zones.filter((ids) => ids === null), 'un onglet montre le reste').toHaveLength(1);
    const nomme = (ids: readonly string[], id: string) => ids.some((i) => i === id || (i.endsWith('/') && id.startsWith(i)));
    for (const e of [griffon, option, swap].flatMap((x) => x.vue.zones['editeur.inspecteur'])) {
      expect(zones.filter((ids) => ids && nomme(ids, e.id)).length, e.id).toBeLessThanOrEqual(1);
    }
    expect(zones.filter((ids) => ids && nomme(ids, 'valeur/combat/optionals/0/id')).length).toBe(1);
  });

  it('l’Indice d’un Trait posé s’écrit à l’écran en nombre ou par les formes de sa formule : « Arme (BF +4) » (LDB 76 l.35 ; #3606 M1a)', () => {
    const { appel } = table();
    const jouer = (edition: unknown) => editionDe(appel('editer', { edition }));
    const presser = (b: Bouton) => editionDe(appel('editer', b.jeu));
    const forme = (e: Edition, id: string, libelle: string) => valeursDeLInspecteur(e, `${id}/forme`).find((b) => b.libelle === libelle)!;
    const saisie = (e: Edition, id: string) => e.vue.zones['editeur.inspecteur'].find((el) => el.id === id) as Formulaire;
    const ecrire = (e: Edition, id: string, v: unknown) => { const f = saisie(e, id); return editionDe(appel('editer', { type: 'valeur', args: [(f.champs[0] as { valeur: unknown }).valeur, (f.champs[1] as { valeur: unknown }).valeur, v] })); };
    presser(boutonDe(editionDe(appel('editer', { ouvrir: CAMPAGNE })), 'outil/personnage'));
    jouer({ geste: 'appui', point: point(1, 1) });
    const pnj = jouer({ geste: 'relache', point: point(1, 1) });
    const option = presser(boutonDe(presser(boutonDe(pnj, 'valeur/combat/ajouter')), 'valeur/combat/optionals/ajouter'));
    const V = 'valeur/combat/optionals/0/value';
    expect(valeursDeLInspecteur(option, `${V}/forme`).map((b) => b.libelle), 'Indice absent : le nombre et chaque forme de la formule').toEqual(expect.arrayContaining(['nombre', 'somme', 'bonus de caractéristique']));
    const trois = ecrire(presser(forme(option, V, 'nombre')), V, 3);
    expect(saisie(trois, V).champs.map((c) => c.type), 'un Indice chiffré se saisit en nombre').toEqual(['fixe', 'fixe', 'saisieNombre']);
    expect(valeursDeLInspecteur(trois, `${V}/forme`).find((b) => b.presse)?.libelle, 'et garde le choix de sa forme').toBe('nombre');
    const somme = presser(boutonDe(presser(forme(trois, V, 'somme')), `${V}/sum/ajouter`));
    const bonus = presser(valeursDeLInspecteur(presser(forme(somme, `${V}/sum/0`, 'bonus de caractéristique')), `${V}/sum/0/bonusOf`).find((b) => (b.jeu as { args: unknown[] }).args[2] === 'force')!);
    const arme = ecrire(presser(boutonDe(bonus, `${V}/sum/ajouter`)), `${V}/sum/1`, 4);
    expect(valeursDeLInspecteur(arme, `${V}/forme`).find((b) => b.presse)?.libelle).toBe('somme');
    expect((valeursDeLInspecteur(arme, `${V}/forme`).find((b) => b.presse)!.jeu as { args: unknown[] }).args[2], 'la valeur écrite est celle de « Arme (BF +4) »').toEqual(parseTraitInstance('Arme (BF +4)').value);
  });

  it('une durée en formule d’une op de zone s’écrit de même : nombre, dés, somme (#3606 M1a)', () => {
    const { appel } = table();
    const presser = (b: Bouton) => editionDe(appel('editer', b.jeu));
    const jouer = (edition: unknown) => editionDe(appel('editer', { edition }));
    const ouverte = editionDe(appel('editer', { ouvrir: CAMPAGNE }));
    presser(boutonDe(presser(boutonDe(ouverte, 'outil/zone')), 'zone/effect'));
    jouer({ geste: 'appui', point: point(2, 2) });
    const zone = jouer({ geste: 'relache', point: point(3, 3) });
    const op = presser(valeursDeLInspecteur(presser(boutonDe(zone, 'valeur/onCross/ajouter')), 'valeur/onCross/0/op').find((b) => (b.jeu as { args: unknown[] }).args[2] && ((b.jeu as { args: { op: string }[] }).args[2]).op === 'charMod')!);
    const formes = valeursDeLInspecteur(op, 'valeur/onCross/0/durationRounds/forme').map((b) => b.libelle);
    expect(formes, 'une durée absente : le nombre, les dés et chaque forme').toEqual(expect.arrayContaining(['nombre', 'dés', 'somme']));
    const des = presser(valeursDeLInspecteur(op, 'valeur/onCross/0/durationRounds/forme').find((b) => b.libelle === 'dés')!);
    expect(des.vue.zones['editeur.inspecteur'].some((el) => el.id.startsWith('valeur/onCross/0/durationRounds/dice')), 'les dés posés se décomposent').toBe(true);
  });

  it('une troupe : le formulaire borné pose N copies sur des cases libres, ids neufs, profils tirés, rencontre héritée ; une annulation la défait (#3704)', () => {
    const { appel } = table();
    const jouer = (edition: unknown) => editionDe(appel('editer', { edition }));
    const presser = (b: Bouton) => editionDe(appel('editer', b.jeu));
    const ouverte = editionDe(appel('editer', { ouvrir: CAMPAGNE }));
    presser(boutonDe(ouverte, 'outil/personnage'));
    jouer({ geste: 'appui', point: point(1, 1) });
    const pnj = presser(boutonDe(jouer({ geste: 'relache', point: point(1, 1) }), 'rencontre/neuve'));
    const original = pnj.surcouche.reperes.find((r) => r.choisi)!;
    const enc = (pnj.vue.zones['editeur.inspecteur'].find((el) => el.type === 'choix' && el.id.startsWith('rencontre/') && el.valeurs.some((v) => v.id.endsWith('/enrole') && v.presse)) as Choix).id;
    expect(pnj.vue.zones['editeur.inspecteur'].find((el) => el.id === 'troupe')).toMatchObject({ type: 'formulaire', verbe: 'troupe', champs: [{ type: 'saisieNombre', nom: 'nombre', min: 2, max: 30, pas: 1 }] });
    for (const args of [[1], [31], [2.5], ['4'], [4, 1]]) expect(erreurDe(appel('editer', { type: 'troupe', args })).categorie, JSON.stringify(args)).toBe('validation');

    const troupe = editionDe(appel('editer', { type: 'troupe', args: [4] }));
    const avant = pnj.surcouche.reperes;
    const copies = troupe.surcouche.reperes.filter((r) => !avant.some((a) => a.id === r.id));
    expect(copies.map((c) => [c.sorte, c.z]), 'quatre personnages neufs, sur la couche de l’original').toEqual(Array(4).fill(['personnage', original.z]));
    const cases = troupe.surcouche.reperes.map((r) => `${r.x},${r.y}`);
    expect(new Set(cases).size, 'aucune copie ne chevauche une entité').toBe(cases.length);
    expect(troupe.surcouche.reperes.find((r) => r.choisi)?.id, 'l’original reste sélectionné').toBe(original.id);
    jouer({ geste: 'appui', point: point(copies[0].x, copies[0].y) });
    const copie = jouer({ geste: 'relache', point: point(copies[0].x, copies[0].y) });
    expect(copie.surcouche.reperes.find((r) => r.choisi)?.id).toBe(copies[0].id);
    const tirees = valeursDeLInspecteur(copie, 'valeur/combat/randomChars').find((b) => b.presse);
    expect([(tirees?.jeu as { args: unknown[] } | undefined)?.args[2], boutonDe(copie, `${enc}/enrole`).presse], 'ses Caractéristiques tirées, enrôlée dans la rencontre de l’original').toEqual([true, true]);
    const annulee = presser(boutonDe(copie, 'annuler'));
    expect(annulee.surcouche.reperes.map((r) => r.id), 'un seul cran : l’annulation retire les quatre').toEqual(avant.map((r) => r.id));
  });

  it('un personnage de carrière : un Talent qu’ajoute un Talent choisi est offert aux Niveaux suivants (LDB 10 l.467 ; #773)', () => {
    const { appel } = table();
    const jouer = (edition: unknown) => editionDe(appel('editer', { edition }));
    const presser = (b: Bouton) => editionDe(appel('editer', b.jeu));
    presser(boutonDe(editionDe(appel('editer', { ouvrir: CAMPAGNE })), 'outil/personnage'));
    jouer({ geste: 'appui', point: point(1, 1) });
    const pnj = jouer({ geste: 'relache', point: point(1, 1) });
    const flagellant = presser(boutonDe(presser(boutonDe(pnj, 'carriere/ajouter/flagellant')), 'carriere/flagellant/niveau/2'));
    const soldat = presser(boutonDe(flagellant, 'carriere/ajouter/soldat'));
    expect(() => boutonDe(soldat, 'carriere/soldat/talents/1/frenesie'), 'sans Flagellant, Frénésie n’est pas offerte au Soldat').toThrow();
    const voue = presser(boutonDe(soldat, 'carriere/flagellant/talents/2/flagellant'));
    expect(boutonDe(presser(boutonDe(voue, 'carriere/soldat/talents/1/frenesie')), 'carriere/soldat/talents/1/frenesie').presse).toBe(true);
  });

  it('un personnage lanceur de sorts : un sort choisi au formulaire, retiré ; au-delà du quota de Magie mineure, refusé ; les sorts au combat (#3715, #3606 étape S)', () => {
    const { appel } = table();
    const jouer = (edition: unknown) => editionDe(appel('editer', { edition }));
    const presser = (b: Bouton) => editionDe(appel('editer', b.jeu));
    const ligneDe = (e: Edition, id: string) => (e.vue.zones['editeur.inspecteur'].find((el) => el.id === id) as Ligne | undefined)?.texte;
    const ajout = (e: Edition, id: string) => valeursDeLInspecteur(e, 'valeur/combat/spells/ajouter').find((b) => { const l = (b.jeu as { args: unknown[][] }).args[2]; return l[l.length - 1] === id; });
    presser(boutonDe(editionDe(appel('editer', { ouvrir: CAMPAGNE })), 'outil/personnage'));
    jouer({ geste: 'appui', point: point(1, 1) });
    const pnj = presser(boutonDe(jouer({ geste: 'relache', point: point(1, 1) }), 'valeur/combat/ajouter'));
    expect(ligneDe(pnj, 'sorts/connus'), 'sans Talent de lanceur, aucune section').toBeUndefined();
    expect(pnj.vue.zones['editeur.inspecteur'].some((el) => el.id.startsWith('valeur/combat/spells')), 'ni sorts à choisir').toBe(false);
    const niveau2 = presser(boutonDe(presser(boutonDe(pnj, 'carriere/ajouter/pyromancien')), 'carriere/pyromancien/niveau/2'));
    const pyromancien = presser(boutonDe(presser(boutonDe(niveau2, 'carriere/pyromancien/talents/1/magie-mineure')), 'carriere/pyromancien/talents/2/magie-des-arcanes|feu'));
    expect(ligneDe(pyromancien, 'sorts/connus'), 'les Sorts mineurs du quota, tirés').toMatch(/^Sorts au combat : [^,]+(, [^,]+)*$/);
    expect(ajout(pyromancien, 'cauteriser')?.libelle).toBe('Cautériser');
    const cauterise = presser(ajout(pyromancien, 'cauteriser')!);
    expect(ligneDe(cauterise, 'sorts/connus')).toMatch(/Cautériser/);
    expect(valeursDeLInspecteur(cauterise, 'valeur/combat/spells/0').find((b) => b.presse)?.libelle, 'le sort choisi se lit à son rang').toBe('Cautériser');
    const retire = presser(boutonDe(cauterise, 'valeur/combat/spells/0/retirer'));
    expect(ligneDe(retire, 'sorts/connus')).not.toMatch(/Cautériser/);
    expect(retire.vue.zones['editeur.inspecteur'].some((el) => el.id === 'valeur/combat'), 'son seul sort retiré, le rôle au combat vide part').toBe(false);
    let e = presser(boutonDe(retire, 'valeur/combat/ajouter'));
    const choisis: string[] = [];
    for (const id of ['alerte', 'bruits', 'choc', 'conservation', 'drain', 'flechette']) {
      if (ajout(e, id)!.refus) break;
      e = presser(ajout(e, id)!);
      choisis.push(id);
    }
    const refus = ajout(e, 'flechette')!.refus;
    expect(refus).toMatch(/Magie mineure : \d/);
    expect(choisis).toHaveLength(Number(refus!.match(/: (\d)/)![1]));
    expect(ajout(e, 'destrier-d-ombre'), 'un sort d’aucune liste ouverte n’est pas offert').toBeUndefined();
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

  it('un décor : une action ajoutée sous son identifiant libre, renommée à son formulaire, écrite au formulaire tiré du schéma, à l’onglet Rôles (#3606 M1e)', () => {
    const { appel } = table();
    const jouer = (edition: unknown) => editionDe(appel('editer', { edition }));
    const presser = (b: Bouton) => editionDe(appel('editer', b.jeu));
    const decors = presser(boutonDe(editionDe(appel('editer', { ouvrir: CAMPAGNE })), 'outil/prop'));
    presser(valeursDe(decors, 'decors').find((b) => b.id === 'prop/brasero')!);
    jouer({ geste: 'appui', point: point(5, 5) });
    const pose = jouer({ geste: 'relache', point: point(5, 5) });
    const [fouiller] = valeursDeLInspecteur(pose, 'valeur/usable/ajouter');
    expect(fouiller.libelle).toBe('fouiller');
    const une = presser(fouiller);
    expect(boutonDe(une, 'valeur/usable/retirer').libelle, 'sans assise, l’utilisable se retire entier').toBe('Retirer : utilisable');
    const deux = presser(valeursDeLInspecteur(une, 'valeur/usable/actions/ajouter')[0]);
    const formulaire = (e: Edition, id: string) => e.vue.zones['editeur.inspecteur'].find((el) => el.id === id) as Formulaire | undefined;
    expect(formulaire(deux, 'identifier/action/fouiller-2')?.champs.map((c) => c.type)).toEqual(['fixe', 'saisieTexte']);
    expect(boutonDe(deux, 'valeur/usable/actions/1/flow/etapes/ajouter').libelle, 'les pas de l’enchaînement s’ajoutent au formulaire (#3606 M2b)').toMatch(/^Ajouter/);
    const renommee = editionDe(appel('editer', { type: 'identifier', args: ['fouiller-2', 'coffre'] }));
    expect(formulaire(renommee, 'identifier/action/coffre')?.champs[1]).toMatchObject({ valeur: 'coffre' });
    expect(erreurDe(appel('editer', { type: 'identifier', args: ['coffre'] })).categorie, 'sans action désignée').toBe('validation');
    expect(erreurDe(appel('editer', { type: 'identifier', args: ['absente', 'x'] })).categorie, 'une action que l’inspecteur ne montre pas').toBe('validation');
    const consommee = presser(valeursDeLInspecteur(renommee, 'valeur/usable/actions/1/consume').find((b) => (b.jeu as { args: unknown[] }).args[2] === true)!);
    expect(valeursDeLInspecteur(consommee, 'valeur/usable/actions/1/consume').find((b) => b.presse)?.jeu).toMatchObject({ args: [{ sorte: 'entite' }, ['usable', 'actions', 1, 'consume'], true] });
    const ecran = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../projet/scenes/Editeur.tscn'), 'utf8');
    const roles = ecran.match(/Inspecteur\/Rôles"\]\nscript = [^\n]*\nsource = "editeur\.inspecteur"\nids = PackedStringArray\(([^)]*)\)/)![1];
    expect([...roles.matchAll(/"([^"]*)"/g)].map((m) => m[1])).toEqual(expect.arrayContaining(['valeur/usable', 'valeur/usable/', 'identifier/action/']));
  });

  it('une table à l’assise posée : « Retirer : utilisable », qui l’emporterait, n’est pas offert ; ses actions se retirent une à une, l’assise reste (#3606 M1e)', () => {
    const { appel } = table();
    const jouer = (edition: unknown) => editionDe(appel('editer', { edition }));
    const presser = (b: Bouton) => editionDe(appel('editer', b.jeu));
    const decors = presser(boutonDe(editionDe(appel('editer', { ouvrir: CAMPAGNE })), 'outil/prop'));
    presser(valeursDe(decors, 'decors').find((b) => b.id === 'prop/table-ronde-4-tabourets')!);
    jouer({ geste: 'appui', point: point(5, 5) });
    const assise = presser(boutonDe(jouer({ geste: 'relache', point: point(5, 5) }), 'assise'));
    const avec = presser(valeursDeLInspecteur(assise, 'valeur/usable/actions/ajouter')[0]);
    const ids = (e: Edition) => e.vue.zones['editeur.inspecteur'].map((el) => el.id);
    expect(ids(avec)).toContain('valeur/usable/actions/0/retirer');
    expect(ids(avec)).not.toContain('valeur/usable/retirer');
    const { porteur } = (boutonDe(avec, 'valeur/usable/actions/0/retirer').jeu as { edition: { porteur: unknown } }).edition;
    expect(erreurDe(appel('editer', { type: 'valeur', args: [porteur, ['usable']] })).categorie, 'un retrait que l’inspecteur ne montre pas').toBe('validation');
    let retiree = avec;
    while (ids(retiree).includes('valeur/usable/actions/0/retirer')) retiree = presser(boutonDe(retiree, 'valeur/usable/actions/0/retirer'));
    expect(ids(retiree).filter((id) => id.startsWith('valeur/usable')), 'l’utilisable reste, sans action').toEqual(['valeur/usable', 'valeur/usable/actions/ajouter']);
    expect(boutonDe(retiree, 'assise').presse, 'l’assise reste').toBe(true);
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
    expect(e.vue.zones['editeur.inspecteur'].map((el) => el.id).filter((id) => !id.startsWith('scene/') && !id.startsWith('valeur/startMessage') && !['nommer', 'identifier', 'decrire', 'drapeau'].includes(id)), 'l’arête supprimée, l’inspecteur de la scène').toEqual([]);
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

describe('l’éditeur de carte par le pont, l’adresse de prose (#3606 M2g)', () => {
  /** Un chapitre de fixture : une section à un paragraphe et une table légendée, une autre section. */
  const TEXTE = [
    '# Les Armes', '', 'Les armes du Vieux Monde sont nombreuses et variées, de la dague à l’arquebuse.', '',
    '**TABLE DES ARMES**', '', '| Arme | Dégâts | Prix |', '|---|---|---|', '| Dague | BF+2 | 1 pa |', '| Épée | BF+4 | 10 co |', '',
    '# Les Armures', '', 'Une armure protège son porteur des coups, au prix de sa discrétion.', '',
  ].join('\n');
  const MANIFESTE = JSON.stringify({ 'livre-de-base': { abbr: 'LDB', chapitres: [{ ch: '01', fichier: '01 - Armes.md', titre: 'Les Armes', octets: TEXTE.length }] } });
  const D = 'valeur/flow/etapes/0/effet/descRef';
  const jeuDe = (b: Bouton) => (b.jeu as { args: unknown[] }).args[2];

  /** La première campagne du jeu ouverte, avec ou sans le `Source/` servi, un déclencheur tracé dont la première étape
   *  écrit au journal, sans adresse. */
  function auJournal(manifeste?: string) {
    const { appel } = table();
    const presser = (b: Bouton) => editionDe(appel('editer', b.jeu));
    const choisir = (e: Edition, id: string, voulu: (v: unknown) => boolean) => presser(valeursDeLInspecteur(e, id).find((b) => voulu(jeuDe(b)))!);
    let e = editionDe(appel('editer', { ouvrir: CAMPAGNE, ...(manifeste ? { manifeste } : {}) }));
    presser(boutonDe(presser(boutonDe(e, 'outil/zone')), 'zone/trigger'));
    editionDe(appel('editer', { edition: { geste: 'appui', point: point(2, 2) } }));
    e = presser(boutonDe(editionDe(appel('editer', { edition: { geste: 'relache', point: point(2, 2) } })), 'valeur/flow/etapes/ajouter'));
    e = choisir(e, 'valeur/flow/etapes/0/kind', (v) => (v as { kind: string }).kind === 'effet');
    e = choisir(e, 'valeur/flow/etapes/0/effet/type', (v) => (v as { type: string }).type === 'journal');
    return { appel, choisir, e };
  }

  it('une cellule de table se désigne par des choix seuls : le livre, le chapitre que l’hôte charge à la demande, la cellule, sa table, sa ligne, sa colonne ; l’empreinte n’est jamais offerte', () => {
    const { appel, choisir, e: journal } = auJournal(MANIFESTE);
    const livre = choisir(journal, `${D}/ajouter`, (v) => (v as { book: string }).book === 'livre-de-base');
    expect(livre.chapitre, 'sans chapitre choisi, rien ne se charge').toBeUndefined();
    const demande = choisir(livre, `${D}/ch`, (v) => v === '01');
    expect(demande.chapitre).toEqual({ book: 'livre-de-base', ch: '01' });
    expect(demande.vue.zones['editeur.inspecteur'].find((el) => el.id === `${D}/etat`)).toMatchObject({ texte: 'Chargement du chapitre…' });
    expect(erreurDe(appel('editer', { edition: { geste: 'chapitre', book: 'livre-de-base', ch: '02', texte: TEXTE } })).message, 'un autre chapitre que l’attendu se refuse').toBe('editer : chapitre, livre-de-base ch.02 n’est pas le chapitre attendu');
    const charge = editionDe(appel('editer', { edition: { geste: 'chapitre', book: 'livre-de-base', ch: '01', texte: TEXTE } }));
    expect(charge.chapitre, 'reçu, il ne se redemande pas').toBeUndefined();
    let e = choisir(charge, `${D}/parts/ajouter`, (v) => (v as Fragment[])[0].kind === 'cellule');
    e = choisir(e, `${D}/parts/0/row`, (v) => v === 'Épée');
    e = choisir(e, `${D}/parts/0/table`, (v) => v === 'table des armes#1');
    e = choisir(e, `${D}/parts/0/col`, (v) => v === 'Prix');
    const ids = e.vue.zones['editeur.inspecteur'].map((el) => el.id);
    expect(ids.filter((id) => id.startsWith(`${D}/parts/0/`) && !id.includes('/', `${D}/parts/0/`.length)), 'l’empreinte n’est jamais offerte').toEqual([`${D}/parts/0/kind`, `${D}/parts/0/sec`, `${D}/parts/0/secOcc`, `${D}/parts/0/row`, `${D}/parts/0/col`, `${D}/parts/0/table`, `${D}/parts/0/retirer`]);
    expect(e.vue.zones['editeur.inspecteur'].find((el) => el.id === `${D}/etat`)).toMatchObject({ texte: 'Passage : 10 co' });
  });

  it('sans Source servi, l’adresse le dit et ne se compose pas ; aucun chapitre ne s’attend, un chapitre rendu se refuse', () => {
    const { appel, e } = auJournal();
    expect(e.vue.zones['editeur.inspecteur'].find((el) => el.id.startsWith(D))).toMatchObject({ id: `${D}/etat`, texte: 'Le Source n’est pas servi : l’adresse s’édite sur le poste de développement.' });
    expect(erreurDe(appel('editer', { edition: { geste: 'chapitre', book: 'livre-de-base', ch: '01', texte: TEXTE } })).categorie).toBe('validation');
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
    expect(charge.memoire).toEqual({ calques: { version: expect.any(String), calques: { [sceneId]: { 0: expect.objectContaining({ largeur: 200, hauteur: 100 }) } } }, oublier: [], deplacer: [] });
  });

  it('la scène renommée garde son calque : sa planche se déplace sous son nouvel identifiant ; la scène retirée le garde pour une annulation', () => {
    const { appel, ouverte, jouer, presser } = ouvrirLaCarte();
    presser(boutonDe(ouverte, 'calque/charger'));
    const charge = jouer({ geste: 'chargement', image: { largeur: 200, hauteur: 100 } });
    const renommee = editionDe(appel('editer', { type: 'identifier', args: ['cour'] }));
    expect(renommee.calque?.image).toBe(`calques/${CAMPAGNE}/cour/0`);
    expect(renommee.memoire).toEqual({ calques: { version: expect.any(String), calques: { cour: { 0: expect.objectContaining({ largeur: 200 }) } } }, oublier: [], deplacer: [{ de: charge.calque!.image, vers: `calques/${CAMPAGNE}/cour/0` }] });
    const retiree = presser(boutonDe(renommee, 'scenes/retirer'));
    expect(retiree.memoire, 'le retrait s’annule : rien d’oublié').toBeUndefined();
    expect(presser(boutonDe(retiree, 'annuler')).calque?.image).toBe(`calques/${CAMPAGNE}/cour/0`);
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
      expect(ecartee.memoire, 'les calques retirés, à garder vides').toEqual({ calques: { version: charge.memoire!.calques.version, calques: {} }, oublier: [], deplacer: [] });
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
    const ouverte = editionDe(appel('editer', ouvrir()));
    expect(boutonDe(ouverte, 'enregistrer').refus).toBe('Rien à enregistrer');
    const scenes = ouverte.vue.zones['editeur.scenes'][0] as Choix;
    if (scenes.valeurs.length > 1) expect(boutonDe(editionDe(appel('editer', scenes.valeurs[1].jeu)), 'enregistrer').refus, 'une autre scène éditée, rien de changé').toBe('Rien à enregistrer');
    expect(boutonDe(editionDe(appel('editer', { edition: { geste: 'scenes', quoi: 'ajouter' } })), 'enregistrer').refus, 'une scène ajoutée est à enregistrer').toBeNull();
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

describe('l’éditeur de carte par le pont, une scène bâtie de bout en bout', () => {
  const manuscrit = listerProjetsLivres().find((rel) => rel.split('/').pop()! in PROJETS_MANUSCRITS)!;
  const servi = lireProjetLivre(manuscrit) as { id: string; scenes: { id: string }[] };

  it('une scène neuve reçoit les ouvrages de la Diligence ; enregistrée, rouverte du dépôt, sa validation ne dit aucune erreur', { timeout: 240_000 }, () => {
    const { appel } = table();
    let e = editionDe(appel('editer', { ouvrir: servi.id, projet: JSON.stringify(servi) }));
    const jouer = (edition: unknown) => (e = editionDe(appel('editer', { edition })));
    const presser = (id: string) => (e = editionDe(appel('editer', boutonDe(e, id).jeu)));
    const pres = (x: number, y: number, fx = x, fy = y) => ({ case: { x, y }, f: { x: fx, y: fy } });
    const cliquer = (x: number, y: number, fx = x, fy = y) => { jouer({ geste: 'appui', point: pres(x, y, fx, fy) }); jouer({ geste: 'relache', point: pres(x, y, fx, fy) }); };
    const tirer = (cases: [number, number][]) => {
      jouer({ geste: 'appui', point: point(...cases[0]) });
      for (const c of cases.slice(1)) jouer({ geste: 'glisse', point: point(...c) });
      jouer({ geste: 'relache', point: point(...cases[cases.length - 1]) });
    };
    const pointee = () => e.vue.zones['editeur.pointee'].map((l) => (l as Ligne).texte);

    const [ox, oy] = [3, 3];
    const ici = (dx: number, dy: number) => ({ x: ox + dx, y: oy + dy });
    const cliquerLaCase = (dx: number, dy: number) => cliquer(ox + dx, oy + dy);
    /** Un clic sur la case (`dx`, `dy`), tout près de son côté qui la sépare de sa voisine (`vx`, `vy`). */
    const cliquerLeCote = ([dx, dy]: [number, number], [vx, vy]: [number, number]) => cliquer(ox + dx, oy + dy, ox + dx + 0.45 * (vx - dx), oy + dy + 0.45 * (vy - dy));
    const tirerPar = (chemin: [number, number][]) => tirer(chemin.map(([dx, dy]) => [ox + dx, oy + dy]));
    const palier: [number, number][] = [[8, 0], [8, 1], [8, 2]];

    presser('scenes/ajouter');
    presser('couche/ajouter');
    presser('outil/tile'); presser('pinceau/1'); presser('terrain/dalle');
    for (const c of palier) cliquerLaCase(...c);
    presser('outil/height'); presser('pinceau/1'); presser('hauteur/haute');
    for (const c of palier) cliquerLaCase(...c);
    presser('couche/0');

    presser('outil/wall'); presser('structure/mur-a-ossature-en-bois');
    for (const d of [0, 1, 2]) {
      cliquerLeCote([d, 0], [d, -1]);
      cliquerLeCote([d, 2], [d, 3]);
      cliquerLeCote([0, d], [-1, d]);
      cliquerLeCote([2, d], [3, d]);
    }
    presser('arete/door'); cliquerLeCote([1, 0], [1, -1]);
    presser('outil/select'); cliquerLeCote([2, 2], [2, 3]); presser('arete/fenetre');
    expect(pointee()[1]).toBe(`Arête ${ox + 2}, ${oy + 3} N · couche 0 · fenêtre · Mur à ossature en bois`);

    presser('outil/zone'); presser('zone/room'); tirerPar([[0, 0], [1, 1], [2, 2]]);
    presser('outil/architecture'); cliquerLaCase(0, 0); presser('batir/corps'); presser('batir/etage');
    expect(e.vue.couche, 'l’étage bâti s’édite').toBe(1);
    presser('couche/0'); presser('architecture/facade'); cliquerLeCote([2, 0], [2, -1]); presser('baie/ajouter');

    presser('outil/stair'); presser('etage/1'); tirerPar([[4, 1], [5, 1], [6, 1], [7, 1]]);
    expect(e.vue.zones['editeur.options'].filter((l) => l.type === 'ligne').map((l) => (l as Ligne).texte)).toEqual(['Tracé : 4 cases', '0 m → 4 m · cotes 1 · 2 · 3 · 4 m']);
    presser('volee/poser');

    presser('outil/prop'); cliquerLaCase(5, 4); presser('outil/select'); cliquerLaCase(5, 4); presser('entite/cap/E');
    presser('outil/heroStart'); cliquerLaCase(3, 5);
    presser('outil/zone'); presser('zone/trigger'); tirerPar([[6, 4], [7, 5], [8, 6]]);
    expect((e.vue.zones['editeur.validation'][0] as Ligne).texte).toMatch(/^Validation : 0 erreur\(s\)/);
    expect((appel('editer', boutonDe(e, 'tester').jeu) as Reponse & { essai?: boolean }).essai, 'la scène bâtie se met à l’essai').toBe(true);

    const enregistree = editionDe(appel('editer', boutonDe(e, 'enregistrer').jeu));
    const projet = JSON.parse(enregistree.depot!.texte) as typeof servi;
    const neuve = projet.scenes.find((sc) => !servi.scenes.some((d) => d.id === sc.id)) as unknown as Scene;
    expect(neuve.layers.map((l) => l.z), 'deux couches').toEqual([0, 1]);
    expect([4, 5, 6, 7].map((dx) => neuve.layers[0].height![(oy + 1) * neuve.dimensions.w + ox + dx]), 'la volée cotée de cran en cran').toEqual([1, 2, 3, 4]);
    expect(neuve.walls!.filter((w) => w.structure === 'mur-a-ossature-en-bois'), 'onze murs à ossature en bois').toHaveLength(11);
    expect(neuve.walls!.filter((w) => w.door).map((w) => [w.x, w.y, w.side])).toEqual([[ox + 1, oy, 'N']]);
    expect(neuve.walls!.filter((w) => w.window).map((w) => [w.x, w.y, w.side])).toEqual([[ox + 2, oy + 3, 'N']]);
    const [corps] = neuve.architecture!;
    expect(corps.storeys.map((st) => st.z), 'un corps de deux étages').toEqual([0, 1]);
    expect(corps.facades!.flatMap((f) => f.features ?? []).map((f) => f.kind), 'une façade et son ouverture').toEqual(['gable']);
    expect(neuve.effectZones!.map((z) => [z.presentation, z.area]), 'la pièce').toEqual([['interior', { kind: 'rect', ...ici(0, 0), w: 3, h: 3 }]]);
    expect(neuve.entities.map((en) => [en.kind, en.pos, en.facing])).toEqual([['prop', ici(5, 4), 'E'], ['heroStart', ici(3, 5), undefined]]);
    expect(neuve.triggers.map((tr) => [tr.rect, tr.flow]), 'le déclencheur tiré, au flux vide').toEqual([[{ ...ici(6, 4), w: 3, h: 3 }, { kind: 'sequence', etapes: [] }]]);

    const { appel: rouvrir } = table();
    const depot = mkdtempSync(join(tmpdir(), 'editeur-3508-'));
    const fichier = join(dossierDesProjetsLivres(depot), manuscrit);
    mkdirSync(dirname(fichier), { recursive: true });
    writeFileSync(fichier, enregistree.depot!.texte);
    const rouverte = editionDe(rouvrir('editer', { ouvrir: servi.id, projet: JSON.stringify(lireProjetLivre(manuscrit, depot)) }));
    rmSync(depot, { recursive: true, force: true });
    const relue = editionDe(rouvrir('editer', boutonDe(rouverte, `scenes/${neuve.id}`).jeu));
    expect((relue.vue.zones['editeur.validation'][0] as Ligne).texte, 'rouverte du dépôt, la porte la lit et la validation ne dit aucune erreur').toMatch(/^Validation : 0 erreur\(s\)/);
  });
});

describe('l’éditeur de carte par le pont, le navire (#3772)', () => {
  it('l’outil navire pose la caraque à son cap ; la réponse sert son corps, le monde le sol de ses ponts sans le peindre, et ses ponts sont des couches', () => {
    const { appel } = table();
    servirLesModeles(appel, COMMITES);
    const presser = (b: Bouton) => editionDe(appel('editer', b.jeu));
    const ouverte = editionDe(appel('editer', { ouvrir: CAMPAGNE }));
    expect(ouverte.navires).toEqual({});
    const outil = presser(boutonDe(ouverte, 'outil/navire'));
    expect(valeursDe(outil, 'navires').map((b) => [b.id, b.libelle, b.refus])).toEqual([['navire/caraque', 'Caraque', null], ['navire/barge-fluviale', 'Barge fluviale', null]]);
    expect(valeursDe(outil, 'navire/cap').map((b) => b.id)).toEqual(['navire/cap/N', 'navire/cap/E', 'navire/cap/S', 'navire/cap/O']);
    presser(boutonDe(outil, 'navire/cap/E'));
    const posee = editionDe(appel('editer', { edition: { geste: 'appui', point: point(10, 6) } }));
    expect(Object.keys(posee.navires!)).toEqual(['navire-0']);
    expect(posee.navires!['navire-0']).toMatchObject({ corps: { element: 'vehicule--caraque', cap: 'E', taille: 'reelle' } });
    const surfaces = morceauxDe(appel, 'edition', posee.monde!).flatMap((m) => m.surfaces);
    expect(surfaces.filter((sf) => sf.navire === 'navire-0').length, 'le sol de ses ponts, touché sans être peint').toBeGreaterThan(0);
    expect(surfaces.filter((sf) => sf.flottaison === 'navire-0').length, 'sa mer').toBeGreaterThan(0);
    const couches = posee.vue.zones['editeur.couches'].find((el) => el.id === 'couches') as Choix;
    expect(couches.valeurs.map((b) => b.id)).toEqual(['couche/0', 'couche/1', 'couche/2', 'couche/3']);
    const pont = presser(boutonDe(posee, 'couche/2'));
    expect([pont.vue.couche, boutonDe(pont, 'couche/retirer').refus]).toEqual([2, 'Seuls les ponts d’un navire posent cette couche']);
    expect(pont.aretes!.filter(({ cases: [{ x, y }] }) => x >= 3 && x <= 20 && y >= 6 && y <= 10), 'aucune arête de ses ponts, que son modèle montre').toEqual([]);
  });

  it('l’inspecteur du navire : son cap parmi ceux de ses ponts, qui le tourne ; son équipage et ses Améliorations restent offerts', () => {
    const { appel } = table();
    servirLesModeles(appel, COMMITES);
    const presser = (b: Bouton) => editionDe(appel('editer', b.jeu));
    presser(boutonDe(editionDe(appel('editer', { ouvrir: CAMPAGNE })), 'outil/navire'));
    const posee = editionDe(appel('editer', { edition: { geste: 'appui', point: point(10, 6) } }));
    expect(valeursDeLInspecteur(posee, 'entite/cap').map((b) => [b.id, b.presse])).toEqual([['entite/cap/N', true], ['entite/cap/E', false], ['entite/cap/S', false], ['entite/cap/O', false]]);
    expect(posee.vue.zones['editeur.inspecteur'].some((el) => el.id === 'equipage'), 'son équipage exposé').toBe(true);
    expect(JSON.stringify(posee.vue.zones['editeur.inspecteur']), 'ses Améliorations, au formulaire tiré du schéma').toContain('"upgrades"');
    const tournee = presser(boutonDe(posee, 'entite/cap/O'));
    expect(tournee.navires!['navire-0'].corps.cap).toBe('O');
    expect(erreurDe(appel('editer', { edition: { geste: 'entite', patch: { facing: 'NE' } } })).categorie, 'aucun bouton n’offre un cap de biais').toBe('validation');
  });

  it('une scène qui n’est pas à l’échelle des ponts refuse l’outil navire et chaque type, la raison dite', () => {
    const { appel } = table();
    const presser = (b: Bouton) => editionDe(appel('editer', b.jeu));
    const ouverte = editionDe(appel('editer', { ouvrir: CAMPAGNE }));
    const outil = presser(boutonDe(ouverte, 'outil/navire'));
    const echelle = presser(boutonDe(editionDe(appel('editer', { edition: { geste: 'outil', outil: { mode: 'selection' } } })), 'scene/echelle/plus'));
    expect(boutonDe(echelle, 'outil/navire').refus).toBe('Ses ponts ne se posent pas dans une scène à 3 m par case');
    expect(erreurDe(appel('editer', boutonDe(echelle, 'outil/navire').jeu)).categorie).toBe('regle');
    expect(boutonDe(outil, 'navire/caraque').refus).toBeNull();
  });
});

describe('l’éditeur de carte par le pont, le formulaire tiré du schéma (#3606)', () => {
  const manuscrit = listerProjetsLivres().find((rel) => rel.split('/').pop()! in PROJETS_MANUSCRITS)!;
  const servi = lireProjetLivre(manuscrit) as { id: string };

  it('la condition d’entrée et le flux d’un déclencheur, le Test de traversée et les listes d’ops d’une zone d’effet s’écrivent au formulaire, variante par variante, élément par élément ; enregistrés, rouverts du dépôt, ils sont relus et la validation ne dit aucune erreur', { timeout: 120_000 }, () => {
    const { appel } = table();
    let e = editionDe(appel('editer', { ouvrir: servi.id, projet: JSON.stringify(servi) }));
    const jouer = (edition: unknown) => (e = editionDe(appel('editer', { edition })));
    const presser = (id: string) => (e = editionDe(appel('editer', boutonDe(e, id).jeu)));
    /** La valeur de libellé `libelle` du choix d'id `id` de l'inspecteur : le bouton qui la joue. */
    const option = (id: string, libelle: string) => valeursDeLInspecteur(e, id).find((b) => b.libelle === libelle) ?? (() => { throw new Error(`aucune valeur ${libelle} sous ${id}`); })();
    const choisir = (id: string, libelle: string) => (e = editionDe(appel('editer', option(id, libelle).jeu)));
    const inspecteur = () => e.vue.zones['editeur.inspecteur'];
    const formulaire = (id: string) => inspecteur().find((el): el is Formulaire => el.type === 'formulaire' && el.id === id) ?? (() => { throw new Error(`aucun formulaire ${id}`); })();
    const saisir = (id: string, valeur: unknown) => {
      const [porteur, chemin] = formulaire(id).champs.map((c) => (c.type === 'fixe' ? c.valeur : undefined));
      return (e = editionDe(appel('editer', { type: 'valeur', args: [porteur, chemin, valeur] })));
    };
    const tracer = (sorte: string, de: [number, number], a: [number, number]) => {
      presser('outil/zone'); presser(`zone/${sorte}`);
      jouer({ geste: 'appui', point: point(...de) });
      jouer({ geste: 'relache', point: point(...a) });
    };
    const porteurDe = (id: string) => ((boutonDe(e, id).jeu as { edition: { porteur: { sorte: string; id: string } } }).edition.porteur);
    const validation = () => (e.vue.zones['editeur.validation'][0] as Ligne).texte;
    const sansErreur = /^Validation : (aucun défaut|0 erreur\(s\))/;
    expect(validation()).toMatch(sansErreur);

    presser('scenes/ajouter');
    tracer('trigger', [0, 0], [1, 1]);
    const declencheur = porteurDe('valeur/when/kind/aucune');
    expect(declencheur.sorte).toBe('declencheur');
    expect(boutonDe(e, 'valeur/when/kind/aucune').presse, 'sans condition d’entrée').toBe(true);
    expect(valeursDeLInspecteur(e, 'valeur/flow/kind').map((b) => [b.libelle, b.presse]), 'le flux requis : ses cinq branches, la séquence neuve pressée, aucun retrait').toEqual([
      ['Séquence', true], ['Effet', false], ['Si', false], ['Test', false], ['Choix', false],
    ]);
    presser('valeur/flow/etapes/ajouter');
    choisir('valeur/flow/etapes/0/kind', 'Effet');
    saisir('valeur/flow/etapes/0/effet/flag', 'porte');
    expect(erreurDe(appel('editer', { type: 'valeur', args: [declencheur, ['once'], false] })).categorie, 'un champ qu’un geste dédié écrit, hors du formulaire').toBe('validation');
    choisir('valeur/when/kind', 'TOUS (ET)');
    expect(option('valeur/when/kind', 'TOUS (ET)').presse).toBe(true);
    expect(inspecteur().some((el) => el.id.startsWith('valeur/when/of/0')), 'TOUS de « Toujours » : une liste vide').toBe(false);
    presser('valeur/when/of/ajouter');
    choisir('valeur/when/of/0/kind', 'Drapeaux');
    saisir('valeur/when/of/0/expr', 'porte');
    presser('valeur/when/of/ajouter');
    choisir('valeur/when/of/1/kind', 'NON');
    choisir('valeur/when/of/1/of/kind', 'Ennemi en Ligne de Vue');
    expect(boutonDe(e, 'valeur/when/of/1/monter').libelle).toMatch(/^Monter/);
    expect(inspecteur().some((el) => el.id === 'valeur/when/of/0/monter'), 'le premier ne monte pas').toBe(false);

    tracer('effect', [2, 2], [3, 3]);
    const zone = porteurDe('valeur/onCross/ajouter');
    expect(zone.sorte).toBe('zone');
    expect(option('valeur/onCross/0/op', 'Blessures (ignore BE/PA)').presse, 'la zone posée porte l’op de sa graine').toBe(true);
    expect(['amount', 'onlyGroups/ajouter', 'ignoreTB', 'ignoreAP', 'apFrom', 'min'].every((champ) => inspecteur().some((el) => el.id === `valeur/onCross/0/${champ}`)), 'l’op typée offre ses champs (#3606 M2a)').toBe(true);
    expect(inspecteur().some((el) => el.id === 'valeur/onCross/0/motif'), 'sans repli JSON').toBe(false);
    saisir('valeur/onCross/0/amount', 3);
    choisir('valeur/onCross/0/ignoreTB', 'Non');
    choisir('valeur/onCross/0/apFrom', 'la Localisation la moins protégée');
    expect(formulaire('valeur/onCross/0/amount').champs[2], 'sa quantité écrite').toMatchObject({ valeur: 3 });
    expect([option('valeur/onCross/0/ignoreTB', 'Non').presse, option('valeur/onCross/0/apFrom', 'la Localisation la moins protégée').presse], 'ses choix écrits').toEqual([true, true]);
    choisir('valeur/onCross/0/op', 'Poser un État');
    expect(['id/id', 'value', 'perRound', 'onlyGroups/ajouter', 'grapple', 'carried'].every((champ) => inspecteur().some((el) => el.id === `valeur/onCross/0/${champ}`)), 'l’op `condition` offre ses champs (#3606 M2a2)').toBe(true);
    expect(inspecteur().some((el) => el.id === 'valeur/onCross/0/motif'), 'sans repli JSON').toBe(false);
    expect(['Sonné', 'Pétrifié'].map((libelle) => (valeursDeLInspecteur(e, 'valeur/onCross/0/id/id').find((b) => b.libelle === libelle)?.jeu as { args: unknown[] } | undefined)?.args[2]), 'l’État se choisit au catalogue et parmi les marqueurs narratifs, chacun à son libellé').toEqual(['sonne', 'petrifie']);
    choisir('valeur/onCross/0/id/id', 'Sonné');
    saisir('valeur/onCross/0/value', 2);
    expect([option('valeur/onCross/0/id/id', 'Sonné').presse, formulaire('valeur/onCross/0/value').champs[2]], 'son État et ses pions écrits').toMatchObject([true, { valeur: 2 }]);
    choisir('valeur/onCross/0/op', 'Standing temporaire (prochaine aventure)');
    expect(inspecteur().find((el) => el.id === 'valeur/onCross/0/motif'), 'une op sans forme déclarée le dit').toMatchObject({ type: 'ligne' });
    saisir('valeur/onCross/0', { op: 'statusMod', amount: 1 });
    expect(formulaire('valeur/onCross/0').champs[2], 'et se saisit en JSON').toMatchObject({ type: 'saisieJson', valeur: '{"op":"statusMod","amount":1}' });
    presser('valeur/onCross/0/retirer');
    expect(inspecteur().some((el) => el.id === 'valeur/onCross'), 'vidée, la liste quitte la zone').toBe(false);
    presser('valeur/crossTest/ajouter');
    choisir('valeur/crossTest/characteristic', 'Force');
    choisir('valeur/crossTest/stake/forme', 'clé');
    expect(inspecteur().filter((el) => el.id.startsWith('valeur/crossTest/stake/key/')).map((el) => [el.id.slice('valeur/crossTest/stake/key/'.length), el.type]), 'la forme authorée d’un enjeu au catalogue est sa clé seule, chaque champ à son contrôle (#3606 M2e3)').toEqual([['dataset', 'choix'], ['kind', 'formulaire'], ['entryId', 'formulaire'], ['entryCategory', 'formulaire']]);
    presser('valeur/crossTest/stake/forme/aucune');
    presser('valeur/onCross/ajouter');
    choisir('valeur/onCross/0/op', 'Points de Corruption');
    saisir('valeur/onCross/0/amount', 2);
    presser('valeur/onCross/ajouter');
    choisir('valeur/onCross/1/op', 'Modif. de caractéristique');
    choisir('valeur/onCross/1/characteristic', 'Agilité');
    saisir('valeur/onCross/1/mod', -5);
    presser('valeur/onCross/1/monter');
    expect(option('valeur/onCross/0/op', 'Modif. de caractéristique').presse, 'montée, la seconde op passe première').toBe(true);
    expect(option('valeur/onCross/1/op', 'Points de Corruption').presse).toBe(true);
    expect(erreurDe(appel('editer', { type: 'valeur', args: [zone, ['label'], 'Fosse'] })).categorie, 'un champ que le formulaire n’offre pas').toBe('validation');
    const horsSorte = erreurDe(appel('editer', { type: 'valeur', args: [zone, ['onCross', 0, 'mod'], 'cinq'] }));
    expect([horsSorte.categorie, horsSorte.message], 'une valeur hors de la sorte de son champ, refusée avec sa raison').toEqual(['regle', expect.stringContaining('onCross/0/mod')]);
    expect(validation()).toMatch(sansErreur);

    const enregistree = editionDe(appel('editer', boutonDe(e, 'enregistrer').jeu));
    const depot = mkdtempSync(join(tmpdir(), 'editeur-3606-'));
    const fichier = join(dossierDesProjetsLivres(depot), manuscrit);
    mkdirSync(dirname(fichier), { recursive: true });
    writeFileSync(fichier, enregistree.depot!.texte);
    const { appel: rouvrir } = table();
    const rouverte = editionDe(rouvrir('editer', { ouvrir: servi.id, projet: JSON.stringify(lireProjetLivre(manuscrit, depot)) }));
    rmSync(depot, { recursive: true, force: true });
    const neuve = (JSON.parse(enregistree.depot!.texte) as { scenes: Scene[] }).scenes.find((sc) => sc.effectZones?.some((z) => z.id === zone.id))!;
    expect(neuve.triggers.find((t) => t.id === declencheur.id)).toMatchObject({
      when: { kind: 'all', of: [{ kind: 'flag', expr: 'porte' }, { kind: 'not', of: { kind: 'foeInLoS' } }] },
      flow: { kind: 'sequence', etapes: [{ kind: 'effet', effet: { type: 'setFlag', flag: 'porte' } }] },
    });
    expect(neuve.effectZones!.find((z) => z.id === zone.id)).toMatchObject({
      crossTest: { characteristic: 'force' },
      onCross: [{ op: 'charMod', characteristic: 'agilite', mod: -5 }, { op: 'corruption', amount: 2 }],
    });
    rouvrir('editer', boutonDe(rouverte, `scenes/${neuve.id}`).jeu);
    rouvrir('editer', { edition: { geste: 'appui', point: point(0, 0) } });
    e = editionDe(rouvrir('editer', { edition: { geste: 'relache', point: point(0, 0) } }));
    expect(option('valeur/when/kind', 'TOUS (ET)').presse, 'rouverte, la condition du déclencheur').toBe(true);
    expect(option('valeur/when/of/1/of/kind', 'Ennemi en Ligne de Vue').presse).toBe(true);
    expect(formulaire('valeur/when/of/0/expr').champs[2]).toMatchObject({ valeur: 'porte' });
    expect(formulaire('valeur/flow/etapes/0/effet/flag').champs[2], 'rouvert, le flux du déclencheur').toMatchObject({ valeur: 'porte' });
    rouvrir('editer', { edition: { geste: 'appui', point: point(3, 3) } });
    e = editionDe(rouvrir('editer', { edition: { geste: 'relache', point: point(3, 3) } }));
    expect(option('valeur/onCross/0/characteristic', 'Agilité').presse, 'rouverte, les ops de la zone').toBe(true);
    expect(formulaire('valeur/onCross/1/amount').champs[2]).toMatchObject({ valeur: 2 });
    expect(validation(), 'rouverte du dépôt, la validation ne dit aucune erreur').toMatch(sansErreur);
  });

  it('un flux s’écrit branche par branche : l’action d’un décor et le flux d’une op à la traversée d’une zone reçoivent une séquence, un pas « Effet » et un pas « Si » ; enregistrés, la validation ne dit aucune erreur (#3606 M2b)', { timeout: 120_000 }, () => {
    const { appel } = table();
    let e = editionDe(appel('editer', { ouvrir: servi.id, projet: JSON.stringify(servi) }));
    const jouer = (edition: unknown) => (e = editionDe(appel('editer', { edition })));
    const presser = (id: string) => (e = editionDe(appel('editer', boutonDe(e, id).jeu)));
    const option = (id: string, libelle: string) => valeursDeLInspecteur(e, id).find((b) => b.libelle === libelle) ?? (() => { throw new Error(`aucune valeur ${libelle} sous ${id}`); })();
    const choisir = (id: string, libelle: string) => (e = editionDe(appel('editer', option(id, libelle).jeu)));
    const formulaire = (id: string) => e.vue.zones['editeur.inspecteur'].find((el): el is Formulaire => el.type === 'formulaire' && el.id === id) ?? (() => { throw new Error(`aucun formulaire ${id}`); })();
    const saisir = (id: string, valeur: unknown) => {
      const [porteur, chemin] = formulaire(id).champs.map((c) => (c.type === 'fixe' ? c.valeur : undefined));
      return (e = editionDe(appel('editer', { type: 'valeur', args: [porteur, chemin, valeur] })));
    };
    /** Le flux d'id `flux` reçoit une séquence, où s'écrit un pas « Effet » par `effet`, puis un pas « Si » de condition
     *  « Drapeaux » `drapeau` ; un troisième pas ajouté se retire. */
    const ecrireLeFlux = (flux: string, effet: (pas: string) => void, drapeau: string) => {
      expect(option(`${flux}/kind`, 'Séquence').presse, 'le flux neuf est une séquence').toBe(true);
      presser(`${flux}/etapes/ajouter`);
      choisir(`${flux}/etapes/0/kind`, 'Séquence');
      presser(`${flux}/etapes/0/etapes/ajouter`);
      choisir(`${flux}/etapes/0/etapes/0/kind`, 'Effet');
      effet(`${flux}/etapes/0/etapes/0/effet`);
      presser(`${flux}/etapes/ajouter`);
      choisir(`${flux}/etapes/1/kind`, 'Si');
      choisir(`${flux}/etapes/1/condition/kind`, 'Drapeaux');
      saisir(`${flux}/etapes/1/condition/expr`, drapeau);
      presser(`${flux}/etapes/ajouter`);
      presser(`${flux}/etapes/2/retirer`);
    };
    const validation = () => (e.vue.zones['editeur.validation'][0] as Ligne).texte;

    presser('scenes/ajouter');
    presser('outil/prop');
    presser(valeursDe(e, 'decors').find((b) => b.id === 'prop/brasero')!.id);
    jouer({ geste: 'appui', point: point(5, 5) });
    jouer({ geste: 'relache', point: point(5, 5) });
    e = editionDe(appel('editer', valeursDeLInspecteur(e, 'valeur/usable/ajouter')[0].jeu));
    ecrireLeFlux('valeur/usable/actions/0/flow', (pas) => {
      choisir(`${pas}/type`, 'Définir un indicateur');
      saisir(`${pas}/flag`, 'braise');
    }, 'braise');

    presser('outil/zone'); presser('zone/effect');
    jouer({ geste: 'appui', point: point(1, 1) });
    jouer({ geste: 'relache', point: point(2, 2) });
    presser('valeur/onCross/0/retirer');
    presser('valeur/onCross/ajouter');
    choisir('valeur/onCross/0/op', 'Infestation du navire');
    e = editionDe(appel('editer', valeursDeLInspecteur(e, 'valeur/onCross/0/crewTestType/id')[0].jeu));
    ecrireLeFlux('valeur/onCross/0/chaqueNuit', (pas) => {
      presser(`${pas}/ops/ajouter`);
      choisir(`${pas}/ops/0/op`, 'Points de Corruption');
      saisir(`${pas}/ops/0/amount`, 1);
    }, 'rats');
    expect(validation()).toMatch(/^Validation : (aucun défaut|0 erreur\(s\))/);

    const enregistree = editionDe(appel('editer', boutonDe(e, 'enregistrer').jeu));
    const scene = (JSON.parse(enregistree.depot!.texte) as { scenes: Scene[] }).scenes.find((sc) => sc.effectZones?.some((z) => z.onCross?.some((o) => o.op === 'infestation')))!;
    const si = (drapeau: string) => ({ kind: 'si', condition: { kind: 'flag', expr: drapeau }, alors: { kind: 'sequence', etapes: [] } });
    expect(scene.entities?.find((en) => en.usable)?.usable?.actions?.[0].flow).toEqual({ kind: 'sequence', etapes: [
      { kind: 'sequence', etapes: [{ kind: 'effet', effet: { type: 'setFlag', flag: 'braise' } }] },
      si('braise'),
    ] });
    expect(scene.effectZones!.flatMap((z) => z.onCross ?? []).find((o) => o.op === 'infestation')).toMatchObject({ chaqueNuit: { kind: 'sequence', etapes: [
      { kind: 'sequence', etapes: [{ kind: 'effet', effet: { type: 'ops', ops: [{ op: 'corruption', amount: 1 }] } }] },
      si('rats'),
    ] } });
  });

  it('une référence d’un flux se choisit dans la liste de sa portée, exactement : nul marchand parmi les décors de SA scène, les scènes du projet pour une transition ; choisie, elle s’écrit (#3606 M2d)', { timeout: 120_000 }, () => {
    const { appel } = table();
    let e = editionDe(appel('editer', { ouvrir: servi.id, projet: JSON.stringify(servi) }));
    const jouer = (edition: unknown) => (e = editionDe(appel('editer', { edition })));
    const presser = (id: string) => (e = editionDe(appel('editer', boutonDe(e, id).jeu)));
    const choisir = (id: string, libelle: string) => (e = editionDe(appel('editer', valeursDeLInspecteur(e, id).find((b) => b.libelle === libelle)!.jeu)));
    const valeurDe = (b: Bouton) => (b.jeu as { args: unknown[] }).args[2];

    presser('scenes/ajouter');
    presser('outil/prop');
    presser(valeursDe(e, 'decors').find((b) => b.id === 'prop/brasero')!.id);
    jouer({ geste: 'appui', point: point(5, 5) });
    jouer({ geste: 'relache', point: point(5, 5) });
    presser('outil/zone'); presser('zone/trigger');
    jouer({ geste: 'appui', point: point(0, 0) });
    jouer({ geste: 'relache', point: point(1, 1) });
    presser('valeur/flow/etapes/ajouter');
    choisir('valeur/flow/etapes/0/kind', 'Effet');
    choisir('valeur/flow/etapes/0/effet/type', 'Ouvrir une boutique');
    expect(valeursDeLInspecteur(e, 'valeur/flow/etapes/0/effet/entityId/id'), 'le brasero posé n’est pas un marchand de la scène').toEqual([]);
    choisir('valeur/flow/etapes/0/effet/type', 'Transition de scène');
    const offertes = valeursDeLInspecteur(e, 'valeur/flow/etapes/0/effet/scene/id');
    e = editionDe(appel('editer', offertes[0].jeu));
    expect(valeursDeLInspecteur(e, 'valeur/flow/etapes/0/effet/scene/id')[0].presse, 'la scène choisie est écrite').toBe(true);

    const enregistree = editionDe(appel('editer', boutonDe(e, 'enregistrer').jeu));
    const projet = JSON.parse(enregistree.depot!.texte) as { scenes: Scene[] };
    expect(offertes.map(valeurDe), 'les scènes du projet, exactement').toEqual(projet.scenes.map((sc) => sc.id));
    const scene = projet.scenes.find((sc) => sc.triggers.some((t) => JSON.stringify(t.flow).includes('"transition"')))!;
    expect(scene.triggers[0].flow).toEqual({ kind: 'sequence', etapes: [{ kind: 'effet', effet: { type: 'transition', scene: { id: valeurDe(offertes[0]) } } }] });
  });

  it('la musique, les ancres de bataille, les groupes du lieu et l’apparence d’une ouverture s’écrivent par leurs écrivains dédiés, le message de départ sur plusieurs lignes au formulaire tiré du schéma de la scène, vidé, retiré avec sa provenance ; enregistrés, rouverts du dépôt, ils sont relus et la validation ne dit aucune erreur', { timeout: 120_000 }, () => {
    const { appel } = table();
    let e = editionDe(appel('editer', { ouvrir: servi.id, projet: JSON.stringify(servi) }));
    const jouer = (edition: unknown) => (e = editionDe(appel('editer', { edition })));
    const presser = (id: string) => (e = editionDe(appel('editer', boutonDe(e, id).jeu)));
    const inspecteur = () => e.vue.zones['editeur.inspecteur'];
    const liste = (id: string) => valeursDeLInspecteur(e, id);
    const choisir = (id: string, rang = 0) => (e = editionDe(appel('editer', liste(id).filter((b) => !b.presse)[rang].jeu)));
    const formulaireDuMessage = () => inspecteur().find((el): el is Formulaire => el.type === 'formulaire' && el.id === 'valeur/startMessage/texte');
    const message = () => formulaireDuMessage()?.champs[2];
    const ecrireLeMessage = (...valeur: unknown[]) => {
      const [porteur, chemin] = formulaireDuMessage()!.champs.map((c) => (c.type === 'fixe' ? c.valeur : undefined));
      e = editionDe(appel('editer', { type: 'valeur', args: [porteur, chemin, ...valeur] }));
    };
    const validation = () => (e.vue.zones['editeur.validation'][0] as Ligne).texte;
    const sansErreur = /^Validation : (aucun défaut|0 erreur\(s\))/;
    presser('scenes/ajouter');

    const piste = liste('scene/musique/ambient').find((b) => !['scene/musique/ambient/auto', 'scene/musique/ambient/silence'].includes(b.id))!;
    presser(piste.id);
    presser('scene/musique/combat/silence');
    expect([boutonDe(e, piste.id).presse, boutonDe(e, 'scene/musique/combat/silence').presse], 'ambiance choisie, combat au silence').toEqual([true, true]);
    presser('scene/musique/ambient/auto');
    presser('scene/musique/combat/auto');
    expect([boutonDe(e, 'scene/musique/ambient/auto').presse, boutonDe(e, 'scene/musique/combat/auto').presse], 'retirées, les deux suivent le contexte').toEqual([true, true]);

    expect(message(), 'sans message de départ, il s’ajoute').toBeUndefined();
    presser('valeur/startMessage/ajouter');
    expect(message(), 'le message de départ, une prose, se saisit sur plusieurs lignes ; laissé vide, il part absent').toMatchObject({ type: 'saisieMultiligne', valeur: '', optionnel: true });
    const texte = 'Le relais est désert.\n\nUne lanterne bat au vent.';
    ecrireLeMessage('Brouillon');
    presser('valeur/startMessage/adapteDe/ajouter');
    ecrireLeMessage();
    expect([message(), boutonDe(e, 'valeur/startMessage/ajouter').libelle], 'vidé, il se retire avec sa provenance').toEqual([undefined, expect.stringMatching(/^Ajouter/)]);
    presser('valeur/startMessage/ajouter');
    ecrireLeMessage(texte);
    expect(message()).toMatchObject({ valeur: texte });

    expect(inspecteur().find((el) => el.id === 'scene/stations')).toMatchObject({ texte: 'Aucune ancre de bataille : les Scènes de Round s’étalent d’office.' });
    choisir('scene/stations/ajouter');
    choisir('scene/stations/ajouter', 1);
    expect(boutonDe(e, 'scene/stations/0/pointee').refus, 'sans case pointée').toBe('Appuyez d’abord sur une case de la carte');
    jouer({ geste: 'appui', point: point(1, 2) });
    jouer({ geste: 'relache', point: point(1, 2) });
    presser('scene/stations/1/pointee');
    expect(inspecteur().find((el) => el.id === 'scene/stations/1/position')).toMatchObject({ texte: 'Ancre 2 : case (1, 2), couche 0' });
    presser('scene/stations/0/retirer');
    const ancre = liste('scene/stations/0').find((b) => b.presse)!;

    choisir('scene/groupes/ajouter');
    const groupe = (inspecteur().find((el) => el.id === 'scene/groupes/retirer') as Choix).valeurs[0].libelle;

    presser('outil/architecture');
    jouer({ geste: 'appui', point: point(2, 2) });
    jouer({ geste: 'relache', point: point(2, 2) });
    presser('batir/corps');
    presser('architecture/facade');
    jouer({ geste: 'appui', point: { case: { x: 2, y: 2 }, f: { x: 2, y: 1.55 } } });
    presser('baie/ajouter');
    const baie = inspecteur().find((el) => el.id.startsWith('baie/') && el.id.endsWith('/apparence'))!.id;
    expect(boutonDe(e, `${baie}/defaut`).presse, 'sans apparence, le défaut du rendu').toBe(true);
    choisir(baie);
    const apparence = liste(baie).find((b) => b.presse)!;
    expect(apparence.id).not.toBe(`${baie}/defaut`);
    expect(validation()).toMatch(sansErreur);

    const enregistree = editionDe(appel('editer', boutonDe(e, 'enregistrer').jeu));
    const depot = mkdtempSync(join(tmpdir(), 'editeur-3606-m0c-'));
    const fichier = join(dossierDesProjetsLivres(depot), manuscrit);
    mkdirSync(dirname(fichier), { recursive: true });
    writeFileSync(fichier, enregistree.depot!.texte);
    const { appel: rouvrir } = table();
    const rouverte = editionDe(rouvrir('editer', { ouvrir: servi.id, projet: JSON.stringify(lireProjetLivre(manuscrit, depot)) }));
    rmSync(depot, { recursive: true, force: true });
    const neuve = (JSON.parse(enregistree.depot!.texte) as { scenes: Scene[] }).scenes.find((sc) => sc.architecture?.length && sc.startMessage)!;
    expect(neuve.music, 'retirée, la musique quitte la scène').toBeUndefined();
    expect(neuve.startMessage).toEqual({ texte });
    expect(neuve.stations).toEqual([{ sceneId: ancre.id.split('/').pop(), pos: { x: 1, y: 2 } }]);
    expect(neuve.groups).toEqual([groupe]);
    expect(neuve.architecture![0].facades[0].features![0].appearance).toBe(apparence.id.split('/').pop());
    e = editionDe(rouvrir('editer', boutonDe(rouverte, `scenes/${neuve.id}`).jeu));
    expect(message(), 'rouverte du dépôt, le message sur ses lignes').toMatchObject({ type: 'saisieMultiligne', valeur: texte });
    expect(validation(), 'rouverte du dépôt, la validation ne dit aucune erreur').toMatch(sansErreur);
  });
});

describe('le retrait d’un champ que son objet exige, par le pont (#3606)', () => {
  const manuscrit = listerProjetsLivres().find((rel) => rel.split('/').pop()! in PROJETS_MANUSCRITS)!;
  const servi = lireProjetLivre(manuscrit) as { id: string; scenes: Scene[] };
  const FLUX = { kind: 'si', condition: { kind: 'flag', expr: 'porte_ouverte' }, alors: { kind: 'effet', effet: { type: 'setFlag', flag: 'entre' } }, sinon: { kind: 'effet', effet: { type: 'setFlag', flag: 'refoule' } } };
  const scene = {
    ...emptyScene('retrait', 6, 6),
    dialogues: [{ id: 'dlg-flux', start: { id: 'n1' }, nodes: [{ id: 'n1', desc: 'Une porte close.', choices: [{ id: 'choix1', label: 'Entrer', flow: FLUX }] }] }],
    entities: [{ id: 'ombre', kind: 'personnage', pos: { x: 1, y: 1 }, creature: { id: 'l-ombre-du-fleuve' }, statblock: statblockDeLaCreature(findCreatureById('l-ombre-du-fleuve')!) }],
    effectZones: [{ id: 'z-porte', label: 'Pont-levis', area: { kind: 'rect', x: 3, y: 1, w: 1, h: 1 }, crossTest: { skill: { id: 'athletisme' }, difficulty: 'intermediaire', gate: { kind: 'flag', expr: 'pont_baisse' } } }],
  };
  const projet = { ...servi, scenes: [scene, ...servi.scenes] };

  it('vidés, le drapeau d’un flux `si` et le nom d’un profil copié sont requis, leur saisie requise et le geste refusé, dit ; celui de la porte d’un Test de traversée la retire', () => {
    const { appel } = table();
    let e = editionDe(appel('editer', { ouvrir: servi.id, projet: JSON.stringify(projet) }));
    const jouer = (edition: unknown) => (e = editionDe(appel('editer', { edition })));
    const presser = (id: string) => (e = editionDe(appel('editer', boutonDe(e, id).jeu)));
    const cliquer = (x: number, y: number) => { jouer({ geste: 'appui', point: { case: { x, y }, f: { x, y } } }); jouer({ geste: 'relache', point: { case: { x, y }, f: { x, y } } }); };
    const formulaire = (id: string) => e.vue.zones['editeur.inspecteur'].find((el): el is Formulaire => el.type === 'formulaire' && el.id === id)!;
    const vider = (id: string) => {
      const [porteur, chemin] = formulaire(id).champs.map((c) => (c.type === 'fixe' ? c.valeur : undefined));
      return appel('editer', { type: 'valeur', args: [porteur, chemin] });
    };
    const ecrite = () => (JSON.parse(editionDe(appel('editer', boutonDe(e, 'enregistrer').jeu)).depot!.texte) as { scenes: Scene[] }).scenes[0];

    presser('logique/dialogue/dlg-flux');
    const expr = 'valeur/nodes/0/choices/0/flow/condition/expr';
    expect(formulaire(expr).champs[2], 'le drapeau, requis, ne se laisse pas vide').toMatchObject({ type: 'saisieTexte', optionnel: false });
    expect(erreurDe(vider(expr))).toEqual({ categorie: 'regle', message: 'editer : le champ « nodes/0/choices/0/flow/condition/expr » est requis' });

    cliquer(1, 1);
    const nom = 'valeur/statblock/label';
    expect(formulaire(nom).champs[2], 'le nom du profil, requis, ne se laisse pas vide').toMatchObject({ type: 'saisieTexte', optionnel: false });
    expect(erreurDe(vider(nom))).toEqual({ categorie: 'regle', message: 'editer : le champ « statblock/label » est requis' });

    cliquer(3, 1);
    const porte = 'valeur/crossTest/gate/expr';
    expect(formulaire(porte).champs[2], 'le drapeau de la porte se laisse vide').toMatchObject({ type: 'saisieTexte', optionnel: true });
    e = editionDe(vider(porte));
    const lue = ecrite();
    expect([lue.dialogues?.find((d) => d.id === 'dlg-flux')?.nodes[0].choices[0].flow, lue.entities.find((x) => x.id === 'ombre')?.statblock?.label, lue.effectZones?.find((z) => z.id === 'z-porte')?.crossTest], 'le flux et le profil entiers, la porte retirée')
      .toEqual([FLUX, findCreatureById('l-ombre-du-fleuve')!.label, { skill: { id: 'athletisme' }, difficulty: 'intermediaire' }]);
  });
});

describe('l’éditeur de carte par le pont, le narratif (#3606 M6)', () => {
  const manuscrit = listerProjetsLivres().find((rel) => rel.split('/').pop()! in PROJETS_MANUSCRITS)!;
  type Servi = { id: string; scenes: { triggers?: unknown[] }[]; narratif: { affaires: unknown[]; indices: unknown[] } };
  const servi = lireProjetLivre(manuscrit) as Servi;
  /** Le projet servi, son narratif enrichi d'une affaire et d'un indice à deux stades, que révèle un déclencheur de sa
   *  première scène. */
  const SERVI: Servi = {
    ...servi,
    scenes: servi.scenes.map((sc, i) => (i ? sc : {
      ...sc,
      triggers: [...(sc.triggers ?? []), { id: 't-pont', rect: { x: 0, y: 0, w: 1, h: 1 }, once: true, flow: { kind: 'sequence', etapes: [{ kind: 'effet', effet: { type: 'revealClue', indiceId: 'ind-pont', stade: 'lu' } }] } }],
    })),
    narratif: {
      ...servi.narratif,
      affaires: [...servi.narratif.affaires, { id: 'aff-pont', titre: 'L’affaire du pont' }],
      indices: [...servi.narratif.indices, { id: 'ind-pont', affaireId: 'aff-pont', kind: 'indice', titre: 'La lettre', stades: [{ id: 'lu', prose: 'a' }, { id: 'vu', prose: 'b' }] }],
    },
  };
  /** Une table ouverte sur ce projet, le narratif ouvert. */
  function surLeNarratif() {
    const { appel } = table();
    const presser = (b: Bouton) => editionDe(appel('editer', b.jeu));
    const ouverte = editionDe(appel('editer', { ouvrir: SERVI.id, projet: JSON.stringify(SERVI) }));
    return { appel, presser, ouverte, narratif: presser(boutonDe(ouverte, 'document/narratif')) };
  }
  const inspecte = (e: Edition, id: string) => e.vue.zones['editeur.inspecteur'].find((el) => el.id === id);
  const liste = (e: Edition, sorte: string) => ((e.vue.zones['editeur.logique'].find((el) => el.id === `logique/${sorte}/liste`) as Choix | undefined)?.valeurs ?? []).map((b) => b.libelle);
  /** Le déclencheur `t-pont` du projet que rend l'enregistrement de l'édition `e`. */
  function revele(presser: (b: Bouton) => Edition, e: Edition): unknown {
    const depot = presser(boutonDe(e, 'enregistrer')).depot!;
    const projet = JSON.parse(depot.texte) as { scenes: { triggers: { id: string; flow: { etapes: { effet: unknown }[] } }[] }[] };
    return projet.scenes[0].triggers.find((tr) => tr.id === 't-pont')!.flow.etapes[0].effet;
  }

  it('le menu Fichier ouvre le narratif, sans cran : ses registres à la zone Logique, comptés, les zones de la scène vides, son inspecteur à son ouverture et sa clôture ; il rend la scène', () => {
    const { presser, ouverte, narratif } = surLeNarratif();
    const z = narratif.vue.zones;
    expect([boutonDe(narratif, 'document/narratif').presse, boutonDe(narratif, 'annuler').refus !== null]).toEqual([true, true]);
    expect([z['editeur.scenes'], z['editeur.outils'], z['editeur.options'], z['editeur.couches'], z['editeur.carte']]).toEqual([[], [], [], [], []]);
    expect(z['editeur.logique'].filter((el) => el.type === 'ligne').map((el) => el.id)).toEqual(['logique/affaires', 'logique/indices', 'logique/presetsPnj', 'logique/documents', 'logique/etats', 'logique/ecart']);
    expect(z['editeur.logique'].filter((el): el is Ligne => el.type === 'ligne' && el.texte.startsWith('ecran.')), 'chaque registre a son texte').toEqual([]);
    expect([...new Set(z['editeur.inspecteur'].map((el) => el.id.split('/').slice(0, 2).join('/')))]).toEqual(['valeur/ouverture', 'valeur/cloture']);
    const scene = presser(boutonDe(narratif, 'document/scene'));
    expect([boutonDe(scene, 'document/scene').presse, scene.vue.zones['editeur.titre']]).toEqual([true, ouverte.vue.zones['editeur.titre']]);
  });

  it('« Ajouter » crée une entrée de chaque registre créable, sélectionnée, son inspecteur à son nom et à son formulaire ; un champ s’y écrit', () => {
    const { appel, presser, narratif } = surLeNarratif();
    let e = narratif;
    for (const sorte of ['affaires', 'indices', 'presetsPnj', 'documents', 'etats']) {
      const avant = liste(e, sorte);
      e = presser(boutonDe(e, `logique/${sorte}/ajouter`));
      const neuve = liste(e, sorte).filter((id) => !avant.includes(id));
      expect([neuve.length, boutonDe(e, `logique/${sorte}/${neuve[0]}`).presse, inspecte(e, 'nommer')], sorte).toEqual([1, true, expect.objectContaining({ champs: [expect.objectContaining({ valeur: neuve[0] })] })]);
    }
    const affaire = presser(boutonDe(e, 'logique/affaires/aff-pont'));
    const ecrite = editionDe(appel('editer', { type: 'valeur', args: [{ sorte: 'affaires', id: 'aff-pont' }, ['titre'], 'La route d’Altdorf'] }));
    expect([inspecte(affaire, 'valeur/titre'), inspecte(ecrite, 'valeur/titre')]).toMatchObject([{ type: 'formulaire' }, { type: 'formulaire', champs: [{}, {}, { valeur: 'La route d’Altdorf' }] }]);
  });

  it('un indice que désigne une scène se renomme, la scène suit, une annulation défait les deux ; un identifiant pris se refuse, dit ; le supprimer se refuse, dit', () => {
    const { appel, presser, narratif } = surLeNarratif();
    const indice = presser(boutonDe(narratif, 'logique/indices/ind-pont'));
    expect(erreurDe(appel('editer', { type: 'nommer', args: ['aff-pont'] }))).toMatchObject({ categorie: 'regle', message: 'editer : Identifiant « aff-pont » déjà porté par l\'affaire « L’affaire du pont »' });
    const refus = boutonDe(indice, 'indices/supprimer').refus;
    expect(refus).toMatch(/^Encore désigné par : scène/);
    expect(erreurDe(appel('editer', boutonDe(indice, 'indices/supprimer').jeu))).toMatchObject({ categorie: 'regle', message: `editer : ${refus}` });
    const renomme = editionDe(appel('editer', { type: 'nommer', args: ['ind-missive'] }));
    expect([boutonDe(renomme, 'logique/indices/ind-missive').presse, revele(presser, renomme)]).toEqual([true, { type: 'revealClue', indiceId: 'ind-missive', stade: 'lu' }]);
    editionDe(appel('editer', { edition: { geste: 'enregistrement', reussi: false } }));
    const annule = editionDe(appel('editer', { edition: { geste: 'annuler' } }));
    expect([liste(annule, 'indices').includes('ind-pont'), boutonDe(annule, 'enregistrer').refus], 'le projet, scène comprise, est celui du dépôt').toEqual([true, 'Rien à enregistrer']);
  });

  it('un stade s’ajoute, se renomme, se retire ; un stade désigné, comme le dernier, ne se retire pas, dit', () => {
    const { appel, presser, narratif } = surLeNarratif();
    const indice = presser(boutonDe(narratif, 'logique/indices/ind-pont'));
    const ajoute = presser(boutonDe(indice, 'stade/ajouter'));
    expect(inspecte(ajoute, 'identifier/stade/stade-3')).toMatchObject({ type: 'formulaire' });
    const renomme = editionDe(appel('editer', { type: 'identifier', args: ['stade-3', 'releve'] }));
    expect(erreurDe(appel('editer', { type: 'identifier', args: ['releve', 'vu'] }))).toMatchObject({ categorie: 'regle', message: 'editer : Identifiant « vu » déjà porté par le stade 2' });
    expect(boutonDe(renomme, 'stade/lu/supprimer').refus).toMatch(/^Encore désigné par : scène/);
    const retire = presser(boutonDe(renomme, 'stade/releve/supprimer'));
    expect(retire.vue.zones['editeur.inspecteur'].some((el) => el.id === 'identifier/stade/releve')).toBe(false);
    const seul = presser(boutonDe(presser(boutonDe(retire, 'logique/indices/ajouter')), 'logique/indices/ajouter'));
    const id = liste(seul, 'indices').slice(-1)[0];
    expect(boutonDe(presser(boutonDe(seul, `logique/indices/${id}`)), 'stade/stade-1/supprimer').refus).toBe('Un indice garde au moins un stade.');
  });

  it('un écart s’ajoute par la liste des entrées libres de la zone Logique ; son entrée se change au choix parmi la sienne et les libres', () => {
    const { appel, presser, narratif } = surLeNarratif();
    const offre = narratif.vue.zones['editeur.logique'].find((el) => el.id === 'logique/ecart/ajouter') as Choix;
    expect([offre.type, offre.valeurs.every((b) => b.id.startsWith('logique/ecart/ajouter/'))]).toEqual(['liste', true]);
    const [premiere, seconde] = offre.valeurs.map((b) => b.id.slice('logique/ecart/ajouter/'.length));
    const ecarte = presser(offre.valeurs[0]);
    const reste = (ecarte.vue.zones['editeur.logique'].find((el) => el.id === 'logique/ecart/ajouter') as Choix).valeurs.map((b) => b.id);
    expect([liste(ecarte, 'ecart'), boutonDe(ecarte, `logique/ecart/${premiere}`).presse, reste.includes(offre.valeurs[0].id)]).toEqual([[premiere], true, false]);
    expect(inspecte(ecarte, 'valeur/motif')).toMatchObject({ type: 'formulaire' });
    const nom = (inspecte(ecarte, 'nommer') as Formulaire).champs[0];
    expect(nom.type === 'saisieChoix' && [nom.valeurs.find((v) => v.presse)?.valeur, nom.valeurs.length, nom.valeurs.some((v) => v.valeur === seconde)]).toEqual([premiere, reste.length + 1, true]);
    const deplace = editionDe(appel('editer', { type: 'nommer', args: [seconde] }));
    expect([liste(deplace, 'ecart'), boutonDe(deplace, `logique/ecart/${seconde}`).presse]).toEqual([[seconde], true]);
  });

  it('une faute du narratif se lit à la zone de validation avant l’enregistrement : « Y aller », depuis la scène, rouvre le narratif sur son porteur ; corrigée, elle s’efface', () => {
    const { appel, presser, narratif } = surLeNarratif();
    const offre = narratif.vue.zones['editeur.logique'].find((el) => el.id === 'logique/ecart/ajouter') as Choix;
    const entree = offre.valeurs[0].id.slice('logique/ecart/ajouter/'.length);
    const ecarte = presser(offre.valeurs[0]);
    const releves = (e: Edition) => e.vue.zones['editeur.validation'].filter((el): el is Ligne => el.type === 'ligne' && /^validation\/\d+$/.test(el.id) && el.texte.includes(entree));
    const [faute] = releves(ecarte);
    expect(faute?.texte).toMatch(/motif vide/);
    const scene = presser(boutonDe(ecarte, 'document/scene'));
    const vu = presser(boutonDe(scene, `${faute.id}/aller`));
    expect([boutonDe(vu, 'document/narratif').presse, boutonDe(vu, `logique/ecart/${entree}`).presse]).toEqual([true, true]);
    const corrige = editionDe(appel('editer', { type: 'valeur', args: [{ sorte: 'ecart', id: entree }, ['motif'], 'Hors du chapitre'] }));
    expect(releves(corrige)).toEqual([]);
  });

  it('un état change de forme par les boutons de son inspecteur, la courante pressée ; avec une identité, l’autre forme se refuse, dite', () => {
    const { appel, presser, narratif } = surLeNarratif();
    const etat = presser(boutonDe(narratif, 'logique/etats/ajouter'));
    expect([boutonDe(etat, 'etat/forme/heros').presse, boutonDe(etat, 'etat/forme/enum').refus]).toEqual([true, null]);
    const enumere = presser(boutonDe(etat, 'etat/forme/enum'));
    expect([boutonDe(enumere, 'etat/forme/enum').presse, inspecte(enumere, 'identifier/valeur/valeur-1')?.type]).toEqual([true, 'formulaire']);
    const heros = presser(boutonDe(enumere, 'etat/forme/heros'));
    const ajout = inspecte(heros, 'valeur/forme/identite/ajouter') as Choix;
    const identite = presser(ajout.valeurs[0]);
    const refus = boutonDe(identite, 'etat/forme/enum').refus;
    expect(refus).toBe('Retirez d’abord l’identité de l’état : une autre forme n’en porte pas.');
    expect(erreurDe(appel('editer', boutonDe(identite, 'etat/forme/enum').jeu))).toMatchObject({ categorie: 'regle', message: `editer : ${refus}` });
  });

  it('l’identité d’un état héros : ses repères s’ajoutent, s’identifient et se retirent par leurs gestes, le dernier refusé, dit', () => {
    const { appel, presser, narratif } = surLeNarratif();
    const etat = presser(boutonDe(narratif, 'logique/etats/ajouter'));
    const identite = presser((inspecte(etat, 'valeur/forme/identite/ajouter') as Choix).valeurs[0]);
    expect(boutonDe(identite, 'repere/repere-1/supprimer').refus).toBe('Une identité garde au moins un repère.');
    const ajoute = presser(boutonDe(identite, 'repere/ajouter'));
    expect(inspecte(ajoute, 'identifier/repere/repere-2')).toMatchObject({ type: 'formulaire' });
    const renomme = editionDe(appel('editer', { type: 'identifier', args: ['repere-2', 'titre'] }));
    expect(erreurDe(appel('editer', { type: 'identifier', args: ['titre', 'repere-1'] }))).toMatchObject({ categorie: 'regle', message: 'editer : Identifiant « repere-1 » déjà porté par le repère 1' });
    const retire = presser(boutonDe(renomme, 'repere/titre/supprimer'));
    expect([inspecte(renomme, 'identifier/repere/titre')?.type, inspecte(retire, 'identifier/repere/titre')]).toEqual(['formulaire', undefined]);
  });
});
