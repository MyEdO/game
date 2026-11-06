/**
 * L'ÉDITEUR DE CARTE PAR LE PONT (#3508) : `editer` ouvre la première scène d'une campagne du jeu, joue les gestes que
 * ses zones offrent et les gestes du pointeur, rend la surcouche du geste en cours, et le monde à l'ouverture, au
 * changement de couche et à chaque écriture finie, jamais pendant le geste. Ouverte du texte que sert le dépôt, la carte
 * s'y enregistre : `editer` rend le texte à écrire, et la tient pour enregistrée à l'issue réussie de l'écriture.
 */
import { describe, expect, it } from 'vitest';
import { erreurDe, table, type Reponse } from './pont.testkit';
import type { AreteDessinee, VolumeDuMonde } from '../../../src/noyau/index';
import { allBuiltinCampaigns } from '../../../src/scenes/campaign';
import type { Bouton, Choix, Ligne } from '../../../src/hote/elements';
import type { SurcoucheDeLEdition, ZonesDeLEditeur } from '../../../src/hote/editeur';
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
}

/** L'édition d'une réponse réussie, ou l'échec qui dit la réponse. */
function editionDe(r: Reponse): Edition {
  if (!r.ok || !r.vue || !('surcouche' in r)) throw new Error(`réponse sans édition : ${JSON.stringify(r).slice(0, 400)}`);
  return r as unknown as Edition;
}

/** Le bouton d'id `id` des zones de l'éditeur, posé seul ou parmi les valeurs d'un choix. */
function boutonDe(e: Edition, id: string): Bouton {
  const b = Object.values(e.vue.zones).flat().flatMap((el: Ligne | Choix | Bouton) => (el.type === 'bouton' ? [el] : el.type === 'ligne' ? [] : el.valeurs)).find((v) => v.id === id);
  if (!b) throw new Error(`aucun bouton ${id}`);
  return b;
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
    const autre = (terrain.vue.zones['editeur.options'].find((c) => c.id === 'terrains')!.valeurs).find((b) => !avant.includes(` · ${b.libelle} · `))!;
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
    const materiau = portes.vue.zones['editeur.options'].find((c) => c.id === 'structures')!.valeurs[1];
    presser(materiau);
    const posee = jouer({ geste: 'appui', point: { case: { x: 1, y: 1 }, f: { x: 1, y: 0.6 } } });
    expect(auNord(posee.aretes!), 'la porte posée, au monde rendu').toEqual([{ case: { x: 1, y: 1 }, milieu: { x: 1, y: 0.5 }, sens: { x: 1, y: 0 }, porte: true, ouverte: true }]);
    jouer({ geste: 'relache', point: { case: { x: 1, y: 1 }, f: { x: 1, y: 0.6 } } });

    presser(boutonDe(posee, 'outil/select'));
    const choisie = jouer({ geste: 'appui', point: { case: { x: 1, y: 1 }, f: { x: 1, y: 0.6 } } });
    expect(choisie.vue.zones['editeur.pointee'].map((l) => l.texte)).toContain(`Arête 1, 1 N · couche 0 · porte · ${materiau.libelle}`);
    expect(choisie.surcouche.arete).toEqual(auNord(posee.aretes!)[0]);
    jouer({ geste: 'relache', point: { case: { x: 1, y: 1 }, f: { x: 1, y: 0.6 } } });

    expect(auNord(presser(boutonDe(choisie, 'annuler')).aretes!)).toEqual([]);
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
    const autre = terrain.vue.zones['editeur.options'].find((c) => c.id === 'terrains')!.valeurs.find((b) => !b.presse)!;
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
