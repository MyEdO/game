/**
 * LE ROSTER ET L'EXPORT DE HÉROS, leur forme et leurs transformations pures (#2404, #3041) : lecture contrôlée et
 * élaguée (#1463 LD.1), écriture sous `FORMAT_ROSTER`, mise à jour d'une entrée, export/import sous
 * `FORMAT_EXPORT_HEROS`.
 */
import { describe, it, expect } from 'vitest';
import { ecrireLeRoster, lireLeRoster, rosterAvecLeHeros, rosterExport, rosterImport, type HerosDuRoster, type RosterEntry } from './roster';
import { FORMAT_EXPORT_HEROS, FORMAT_ROSTER } from './formats.generated';
import { migrerLEntreeAvantLesDeuxCouleurs, migrerLEntreeAvantLesReferences } from './referencesDeCreation';
import { nommerLesRetraits } from './elagage';
import { t } from '../../i18n';
import { ciblePsy } from '../../engine/psych/ciblage';
import { libelleDeCouleur } from '../../data';
import { idsDeTest } from '../../engine/idsDeTest.testkit';
import { buildHero, newDraft, rollDraftDetails, withCareer, withSpecies } from '../creation/brouillon';

/** Un État du registre courant, et un id qu'aucun registre ne porte. */
const ETAT_CONNU = 'a-terre';
const ETAT_INCONNU = 'etat-hors-registre';
/** Un Groupe de `groups.json`, et un id qu'il ne porte pas. */
const GROUPE_CONNU = 'skaven';
const GROUPE_INCONNU = 'groupe-hors-registre';

const hero = (id: string, label = 'Héros'): HerosDuRoster => ({ id, label, kind: 'heros' }) as unknown as HerosDuRoster;
const BROUILLON = { label: 'Brouillon', motivation: '', ambitionShort: '', ambitionLong: '' } as unknown as RosterEntry['draft'];
const entry = (id: string): RosterEntry => ({ hero: hero(id), wealth: { gold: 1, silver: 2, brass: 3 }, draft: BROUILLON });
const porteur = (id: string, ...etats: string[]): RosterEntry => ({ ...entry(id), hero: { ...hero(id), conditions: etats.map((e) => ({ id: e, value: 1 })) } as unknown as HerosDuRoster });

describe('roster — lecture et écriture sous `FORMAT_ROSTER`', () => {
  it('écrit sous son format et se relit à l’identique, brouillon du créateur compris, sans retrait', () => {
    const draft = { speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'Brouillon', pettySpells: ['putrefaction'] } as unknown as RosterEntry['draft'];
    const heros = [entry('h1'), { ...entry('h2'), draft }];
    const brut = ecrireLeRoster(heros);
    expect(JSON.parse(brut)).toEqual({ version: FORMAT_ROSTER, heros });
    expect(lireLeRoster(brut)).toEqual({ heros, retraits: null });
  });

  it('la conversion d’une ancienne entrée porte les références du héros et de son brouillon', () => {
    const original = entry('reiklander');
    const ancien = {
      ...original,
      hero: {
        ...original.hero, species: 'humains-reiklander',
        details: { eyes: 'Bleu', hair: 'Brun clair' },
      },
      draft: {
        ...original.draft, speciesId: 'humains-reiklander', eyes: 'Bleu', hair: 'Couleur inconnue',
        speciesTalentChoices: { choix: { pick: 1, of: [{ pick: 1, of: [{ random: 2 }, { id: 'doue-en-calcul' }] }] } },
      },
    };
    const attendu = {
      ...ancien,
      hero: {
        ...ancien.hero,
        details: { eyes: [{ id: 'bleu', colonne: 'humain' }], hair: { id: 'brun-clair', colonne: 'humain' } },
      },
      draft: {
        ...ancien.draft, eyes: [{ label: 'Bleu' }], hair: { label: 'Couleur inconnue' },
        speciesTalentChoices: {
          choix: { pick: 1, of: [{ pick: 1, of: [{ pick: 2, table: { id: 'talents-aleatoires' } }, { id: 'doue-en-calcul' }] }] },
        },
      },
    };
    migrerLEntreeAvantLesReferences(ancien);
    expect(ancien).toEqual(attendu);
  });

  it('enveloppe la référence de couleur unique du héros et celle de son brouillon', () => {
    const original = entry('elfe');
    const couleur = { id: 'bleu', colonne: 'haut-elfe' };
    const ancien = {
      ...original,
      hero: { ...original.hero, details: { eyes: couleur } },
      draft: { ...original.draft, eyes: { label: 'Saphir historique' } },
    };
    const attendu = {
      ...ancien,
      hero: { ...ancien.hero, details: { eyes: [couleur] } },
      draft: { ...ancien.draft, eyes: [{ label: 'Saphir historique' }] },
    };
    migrerLEntreeAvantLesDeuxCouleurs(ancien);
    expect(ancien).toEqual(attendu);
  });

  it('restitue les couleurs tirées dans le héros et dans le brouillon du roster et de l’export', () => {
    const original = entry('elfe');
    const draft = rollDraftDetails(withCareer(withSpecies(newDraft(7), 'elfes-sylvains'), 'soldat'));
    const personnage = buildHero(draft, idsDeTest, original.hero.id);
    const porteur: RosterEntry = { ...original, hero: { ...personnage, id: original.hero.id }, draft };
    const dansLeRoster = lireLeRoster(ecrireLeRoster([porteur]))?.heros[0];
    const dansLExport = rosterImport(rosterExport(porteur)).entry;
    const attendu = [
      { id: 'marron-fonce', colonne: 'elfe-sylvain' },
      { id: 'gris-pale', colonne: 'elfe-sylvain' },
    ];
    for (const lue of [dansLeRoster, dansLExport]) {
      expect(lue?.hero.details?.eyes).toEqual(attendu);
      expect(lue?.draft.eyes).toEqual(attendu);
    }
  });

  it('préserve le physique tiré avant un changement d’espèce sans lui attribuer sa nouvelle colonne', () => {
    const tire = rollDraftDetails(withSpecies(newDraft(149), 'humains-reiklander'));
    const draft = withCareer(withSpecies(tire, 'nains'), 'soldat');
    const personnage = buildHero(draft, idsDeTest, 'ancien-physique');
    const libelles = { eyes: libelleDeCouleur('eyes', draft.eyes?.[0]), hair: libelleDeCouleur('hairs', draft.hair) };
    expect(libelles).toEqual({ eyes: 'Bleu', hair: 'Brun foncé' });
    expect(personnage.species).toBe('nains');
    const ancien = {
      ...entry(personnage.id),
      draft: { ...draft, ...libelles },
      hero: { ...personnage, details: { ...personnage.details, ...libelles } },
    };
    migrerLEntreeAvantLesReferences(ancien);
    const couleurs = { eyes: [{ label: 'Bleu' }], hair: { label: 'Brun foncé' } };
    expect(ancien.hero.details).toMatchObject(couleurs);
    expect(ancien.draft).toMatchObject(couleurs);
  });

  it('refuse le roster et l’export antérieurs aux nouvelles références des Effets', () => {
    const original = entry('h1');
    const ancien = {
      ...original,
      hero: {
        ...original.hero,
        activeEffects: [{
          label: 'Récolte de Rhya',
          bonus: 0,
          duration: { scale: 'rounds', left: 2 },
          opsPerRound: [{ op: 'giveTrapping', trappingId: 'ration' }],
        }],
      },
    };
    expect(lireLeRoster(JSON.stringify({ version: '974d8daa87ece06f', heros: [ancien] }))).toBeNull();
    expect(rosterImport(JSON.stringify({ kind: 'wfrp4-hero', version: '372cd4f616141f86', ...ancien })).error)
      .toBe(t('picker.import.error.autreFormat'));
  });

  it('d’un autre format, sans tableau de héros, ou illisible : `null`', () => {
    for (const brut of [JSON.stringify({ version: 'autre-format', heros: [entry('h1')] }), JSON.stringify([entry('h1')]), JSON.stringify({ version: FORMAT_ROSTER }), 'null', '{pas du json']) {
      expect(lireLeRoster(brut), brut).toBeNull();
    }
  });

  it('un héros qui porte un État hors du registre est GARDÉ sans cet État, retrait rendu (#1463 LD.1)', () => {
    const lu = lireLeRoster(ecrireLeRoster([entry('h1'), porteur('h2', ETAT_CONNU, ETAT_INCONNU)]));
    expect(lu?.heros.map((e) => e.hero.id), 'aucun héros perdu').toEqual(['h1', 'h2']);
    expect(lu?.heros[1].hero.conditions).toEqual([{ id: ETAT_CONNU, value: 1 }]);
    expect(lu?.retraits).toEqual({ regles: [], etats: [ETAT_INCONNU], groupes: [] });
  });
});

describe('roster — Trait psychologique à Cible hors de `groups.json` (#1463 LD.1, LDB 21 l.17-21)', () => {
  const connu = { type: 'animosite', cible: ciblePsy.groupe(GROUPE_CONNU) };
  const inconnu = { type: 'haine', cible: ciblePsy.groupe(GROUPE_INCONNU) };
  const peur = { type: 'peur', sourceId: 'goule-1', indice: 1 };
  const avecPsy = (traits: object[]): RosterEntry => ({
    ...entry('h1'),
    hero: {
      ...hero('h1'), conditions: [{ id: ETAT_CONNU, value: 1 }], psychTraits: [...traits, { type: 'trauma' }],
      psychState: [...traits.map((x) => ({ ...x, active: true })), peur], activeEffects: [{ id: 'baume', suppressedPsych: traits }],
    } as unknown as HerosDuRoster,
  });

  it('roster lu ET export importé : le Trait est retiré ENTIER (Traits, afflictions, Traits suspendus), Cible nommée, le reste intact', () => {
    const attendu = { ...avecPsy([connu]).hero };
    const lu = lireLeRoster(ecrireLeRoster([entry('h0'), avecPsy([inconnu, connu])]));
    expect(lu?.heros.map((e) => e.hero.id), 'aucun héros perdu').toEqual(['h0', 'h1']);
    expect(lu?.heros[1].hero).toEqual(attendu);
    expect(lu?.retraits).toEqual({ regles: [], etats: [], groupes: [GROUPE_INCONNU] });
    expect(nommerLesRetraits(lu!.retraits!)).toBe(t('elagage.groupes', { ids: GROUPE_INCONNU }));
    const importe = rosterImport(rosterExport(avecPsy([inconnu, connu])));
    expect(importe.entry?.hero).toEqual(attendu);
    expect(importe.retraits).toEqual({ regles: [], etats: [], groupes: [GROUPE_INCONNU] });
  });

  it('Cibles connues : rien retiré', () => {
    expect(lireLeRoster(ecrireLeRoster([avecPsy([connu])]))?.retraits).toBeNull();
    expect(rosterImport(rosterExport(avecPsy([connu]))).retraits).toBeUndefined();
  });

  it('porteur mal formé (listes non-listes, entrées `null`) : relu sans lever, le Trait à Cible inconnue retiré et nommé', () => {
    const malForme = (champs: object): RosterEntry => ({ ...entry('h1'), hero: { ...hero('h1'), ...champs } as unknown as HerosDuRoster });
    const cas: [object, object][] = [
      [{ psychTraits: [inconnu], psychState: 'x' }, { psychTraits: [], psychState: 'x' }],
      [{ psychTraits: [inconnu], activeEffects: [null] }, { psychTraits: [], activeEffects: [null] }],
      [{ psychTraits: [inconnu], activeEffects: [{ suppressedPsych: 'x' }] }, { psychTraits: [], activeEffects: [{ suppressedPsych: 'x' }] }],
      [{ psychTraits: [null, inconnu], psychState: {} }, { psychTraits: [null], psychState: {} }],
    ];
    for (const [champs, attendu] of cas) {
      const lu = lireLeRoster(ecrireLeRoster([malForme(champs)]));
      expect(lu?.heros[0].hero).toEqual({ ...hero('h1'), ...attendu });
      expect(lu?.retraits).toEqual({ regles: [], etats: [], groupes: [GROUPE_INCONNU] });
    }
  });

  it('Cible vide : le Trait est retiré sans nommer de Cible', () => {
    const vide = { type: 'haine', cible: '' };
    const lu = lireLeRoster(ecrireLeRoster([avecPsy([vide, connu, inconnu])]));
    expect(lu?.heros[0].hero).toEqual(avecPsy([connu]).hero);
    expect(lu?.retraits).toEqual({ regles: [], etats: [], groupes: [GROUPE_INCONNU] });
    const seule = lireLeRoster(ecrireLeRoster([avecPsy([vide])]));
    expect(seule?.heros[0].hero).toEqual(avecPsy([]).hero);
    expect(seule?.retraits).toBeNull();
  });
});

describe('roster — mise à jour d’une entrée (`rosterAvecLeHeros`)', () => {
  it('porte le héros édité à son entrée, brouillon resynchronisé (motivation, ambitions), les autres intactes', () => {
    const edited = { ...hero('h1'), motivation: 'Foi', details: { ambitionShort: 'Survivre', ambitionLong: 'Régner' } } as unknown as HerosDuRoster;
    const apres = rosterAvecLeHeros([entry('h1'), entry('h2')], edited);
    expect(apres?.map((e) => e.hero.id)).toEqual(['h1', 'h2']);
    expect(apres?.[0].hero).toEqual(edited);
    expect(apres?.[0].draft).toMatchObject({ label: 'Brouillon', motivation: 'Foi', ambitionShort: 'Survivre', ambitionLong: 'Régner' });
    expect(apres?.[1]).toEqual(entry('h2'));
  });

  it('un héros absent du roster n’y entre pas : `null`', () => {
    expect(rosterAvecLeHeros([entry('h1')], hero('absent'))).toBeNull();
  });
});

describe('roster — export / import (portabilité, sous `FORMAT_EXPORT_HEROS`)', () => {
  it('round-trip valide → entry restituée', () => {
    const back = rosterImport(rosterExport(entry('h1')));
    expect(back).toEqual({ entry: entry('h1') });
  });

  it('l’export porte son `kind` et le format d’export', () => {
    expect(JSON.parse(rosterExport(entry('h1')))).toMatchObject({ kind: 'wfrp4-hero', version: FORMAT_EXPORT_HEROS });
  });

  it('autre format, numéro de version ou RosterEntry nu → message « autre format » ou invalide, jamais un import silencieux', () => {
    const doc = JSON.parse(rosterExport(entry('h1')));
    for (const autre of [{ ...doc, version: 'autre-format' }, { kind: 'wfrp4-hero', v: 8, hero: doc.hero, wealth: doc.wealth }]) {
      const res = rosterImport(JSON.stringify(autre));
      expect(res.entry).toBeUndefined();
      expect(res.error).toContain('autre format');
    }
    expect(rosterImport(JSON.stringify(entry('h2'))).error).toBe('Fichier de personnage invalide.');
  });

  it('héros qui porte un État hors du registre : importé sans cet État, retrait rendu (#1463 LD.1)', () => {
    const res = rosterImport(rosterExport(porteur('h1', ETAT_CONNU, ETAT_INCONNU)));
    expect(res.error).toBeUndefined();
    expect(res.entry?.hero.conditions).toEqual([{ id: ETAT_CONNU, value: 1 }]);
    expect(res.retraits).toEqual({ regles: [], etats: [ETAT_INCONNU], groupes: [] });
    expect(rosterImport(rosterExport(porteur('h1', ETAT_CONNU))).retraits, 'un héros connu entier ne rend aucun retrait').toBeUndefined();
  });

  it('kind différent, JSON invalide, hero.id manquant ou non-chaîne, brouillon absent → message explicite, jamais null muet', () => {
    for (const brut of [
      JSON.stringify({ kind: 'autre-chose', version: FORMAT_EXPORT_HEROS, hero: { id: 'h5' } }),
      'pas du json',
      '{}',
      JSON.stringify({ kind: 'wfrp4-hero', version: FORMAT_EXPORT_HEROS, hero: {}, wealth: {} }),
      JSON.stringify({ kind: 'wfrp4-hero', version: FORMAT_EXPORT_HEROS, hero: { id: 42 }, wealth: {} }),
      JSON.stringify({ kind: 'wfrp4-hero', version: FORMAT_EXPORT_HEROS, hero: { id: 'h5' }, wealth: {} }),
    ]) {
      const res = rosterImport(brut);
      expect(res.entry, brut).toBeUndefined();
      expect(res.error, brut).toBeTruthy();
    }
  });
});
