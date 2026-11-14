/**
 * IDENTITÉ d'un état `heros` à l'affichage (EDO 02 l.112-127, #686) : le couple espèce × sexe du héros
 * se FIGE à sa désignation (EDO 02 l.114, choix `designationHeros.heros`) ; `identitesResolues` y lit la ligne,
 * `nommer` substitue ses repères dans une prose de paquet. Chemin réel : Effet `designerHeros`, puis le
 * choix du héros au noyau.
 */
import { idsDeTest } from '../../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { createHero } from '../../engine/character';
import { emptyNarratif } from './campaignNarratif';
import { identitesDe, identitesResolues, nommer } from './identites';
import { narratifSchema, type NarratifBlock } from '../../data/schemas/defs-scenes/narratif';
import { emptyScene } from './scene';
import { ouvrirLeBanc, type Banc } from '../banc.testkit';
import { runFlow } from '../combatEffects';
import { newDraft, withSpecies } from '../creation/brouillon';
import { fillDraftDefaults } from '../creation/defauts';
import type { HerosEngage } from '../creation/engagement';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const P27 = { book: 'ennemi-dans-l-ombre', page: 27, note: 'EDO 02 l.114-125' } as const;
const L127 = { book: 'ennemi-dans-l-ombre', page: 27, note: 'EDO 02 l.127' } as const;

const narratif = (): NarratifBlock => ({
  ...emptyNarratif(),
  etats: [{
    id: 'sosie', label: 'Le sosie', source: { book: 'ennemi-dans-l-ombre', page: 26, note: 'EDO 02 l.91' },
    forme: {
      kind: 'heros',
      identite: {
        ancres: ['Kastor', 'Lieberung'],
        reperes: [{ id: 'nom', fragment: 'Lieberung' }, { id: 'salutation', fragment: 'Cher Herr Lieberung' }, { id: 'complet', fragment: 'Kastor Lieberung' }],
        lignes: [
          { espece: 'humain', sexe: 'M', valeurs: [{ repere: 'nom', valeur: 'Lieberung', source: P27 }, { repere: 'salutation', valeur: 'Cher Herr Lieberung', adapteDe: L127 }, { repere: 'complet', valeur: 'Kastor Lieberung', source: P27 }] },
          { espece: 'nain', sexe: 'F', valeurs: [{ repere: 'nom', valeur: 'Linkassniz', adapteDe: L127 }, { repere: 'salutation', valeur: 'Chère Frau Linkassniz', adapteDe: L127 }, { repere: 'complet', valeur: 'Kallar Linkassniz', source: P27 }] },
        ],
      },
    },
  }],
});

const heros = (id: string, speciesId: string, sex?: 'M' | 'F') =>
  ({ ...createHero({ idNeuf: idsDeTest, speciesId, careerId: 'soldat', label: id, seed: 7, ...(sex ? { apparence: { sex } } : {}) }), id });
/** L'engagement d'un brouillon complet de l'espèce `speciesId` et du sexe `sex`, sous l'id `id`. */
const engageDe = (id: string, speciesId: string, sex: 'M' | 'F'): HerosEngage => {
  const d = fillDraftDefaults(withSpecies(newDraft(7), speciesId), 'presentation');
  return { brouillon: { ...d, label: id, apparence: { ...d.apparence, sex } }, id };
};

const get = () => banc.getState();
const enVigueur = () => identitesResolues(get());

/** Charge le paquet, pose le groupe, puis désigne `heroId` par l'Effet `designerHeros`. */
function designer(party: ReturnType<typeof heros>[], heroId?: string) {
  const s = emptyScene('scene-test', 4, 4); s.id = 'sc'; s.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } });
  banc.setState({ campaignNarratif: null, scene: null, etats: {}, identitesFigees: {}, pendingDesignationHeros: null, net: { ...get().net, mode: 'local' } });
  get().chargerLeProjet({ scenes: [s], entryId: 'sc', narratif: narratif(), projet: null });
  banc.setState({ party });
  if (heroId === undefined) return;
  runFlow(get, banc.setState, { kind: 'effet', effet: { type: 'designerHeros', etat: 'sosie' } });
  get().fenetreChoisir('designationHeros', 'heros', heroId);
}

const LETTRE = '*Cher Herr Lieberung,*\n\nKastor Lieberung, dernier des Lieberung. Mon cher Herr Kuftsos.';

describe('identitesResolues + nommer — le paquet suit le héros désigné', () => {
  it('le narratif de ce test PARSE', () => {
    expect(narratifSchema.safeParse(narratif()).success).toBe(true);
  });

  it('naine désignée : « Kastor Lieberung » devient « Kallar Linkassniz », le reste de la lettre suit', () => {
    designer([heros('h1', 'humains-reiklander', 'M'), heros('h2', 'nains', 'F')], 'h2');
    expect(get().identitesFigees.sosie).toEqual({ espece: 'nain', sexe: 'F' });
    expect(nommer(LETTRE, enVigueur())).toBe('*Chère Frau Linkassniz,*\n\nKallar Linkassniz, dernier des Linkassniz. Mon cher Herr Kuftsos.');
  });

  it('humain désigné : le texte est identique à l’octet', () => {
    designer([heros('h1', 'humains-reiklander', 'M')], 'h1');
    expect(nommer(LETTRE, enVigueur())).toBe(LETTRE);
  });

  it('non désigné : verbatim', () => {
    designer([heros('h2', 'nains', 'F')]);
    expect(enVigueur().table.size).toBe(0);
    expect(nommer(LETTRE, enVigueur())).toBe(LETTRE);
  });

  it('héros sans sexe d’apparence : aucun couple figé, verbatim', () => {
    designer([heros('h2', 'nains')], 'h2');
    expect(get().etats.sosie).toBe('h2');
    expect(get().identitesFigees.sosie).toBeUndefined();
    expect(nommer(LETTRE, enVigueur())).toBe(LETTRE);
  });

  it('« Mon cher Herr Kuftsos » reste intact : seul un repère se substitue', () => {
    designer([heros('h2', 'nains', 'F')], 'h2');
    expect(nommer('Mon cher Herr Kuftsos', enVigueur())).toBe('Mon cher Herr Kuftsos');
  });

  it('un sosie MORT garde son identité', () => {
    designer([heros('h2', 'nains', 'F')], 'h2');
    banc.setState({ party: get().party.map((h) => ({ ...h, dead: true })) });
    expect(nommer('Kastor Lieberung', enVigueur())).toBe('Kallar Linkassniz');
  });

  it('le désigné REMPLACÉ dans le groupe : le nom reste celui figé à la désignation', () => {
    designer([heros('h1', 'humains-reiklander', 'M'), heros('h2', 'nains', 'F')], 'h2');
    get().remplacerLeHeros('h2', engageDe('h3', 'humains-reiklander', 'M'));
    expect(nommer('Kastor Lieberung', enVigueur())).toBe('Kallar Linkassniz');
  });

  it('le désigné RÉÉDITÉ (même id, autre espèce et sexe) : le nom reste celui figé à la désignation', () => {
    designer([heros('h2', 'nains', 'F')], 'h2');
    get().remplacerLeHeros('h2', engageDe('h2', 'humains-reiklander', 'M'));
    expect(nommer('Kastor Lieberung', enVigueur())).toBe('Kallar Linkassniz');
  });

  it('aucune ligne pour le couple figé : verbatim', () => {
    designer([heros('h3', 'ogres', 'M')], 'h3');
    expect(nommer(LETTRE, enVigueur())).toBe(LETTRE);
  });
});

describe('nommer — le motif', () => {
  it('le repère le plus long l’emporte, quel que soit l’ordre de déclaration', () => {
    const ids = identitesDe(new Map([['Herr Lieberung', 'Frau Linkassniz'], ['Herr Lieberung von Middenheim', 'Frau Linkassniz de Karak Hirn']]));
    expect(nommer('Herr Lieberung von Middenheim', ids)).toBe('Frau Linkassniz de Karak Hirn');
  });

  it('un repère ne se substitue qu’en mot entier (bornes Unicode)', () => {
    const ids = identitesDe(new Map([['Lieberung', 'Linkassniz']]));
    expect(nommer('Lieberungs Lieberungé ÉLieberung Lieberung.', ids)).toBe('Lieberungs Lieberungé ÉLieberung Linkassniz.');
  });

  it('une seule passe : une valeur insérée n’est jamais relue', () => {
    const ids = identitesDe(new Map([['Kastor Lieberung', 'Kastelle Lieberung'], ['Lieberung', 'Lieberung de Middenheim']]));
    expect(nommer('Kastor Lieberung', ids)).toBe('Kastelle Lieberung');
  });
});
