/**
 * L'ÉDITEUR DE CARTE PAR LE PONT (#3508) : `editer` ouvre la première scène d'une campagne du jeu, joue les gestes que
 * ses zones offrent et les gestes du pointeur, rend la surcouche du geste en cours, et le monde à l'ouverture, au
 * changement de couche et à chaque écriture finie, jamais pendant le geste.
 */
import { describe, expect, it } from 'vitest';
import { erreurDe, table, type Reponse } from './pont.testkit';
import type { VolumeDuMonde } from '../../../src/noyau/index';
import { allBuiltinCampaigns } from '../../../src/scenes/campaign';
import type { Bouton, Choix, Ligne } from '../../../src/hote/elements';
import type { SurcoucheDeLEdition, ZonesDeLEditeur } from '../../../src/hote/editeur';

interface Edition {
  vue: { zones: ZonesDeLEditeur; couche: number };
  surcouche: SurcoucheDeLEdition;
  monde?: VolumeDuMonde;
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
