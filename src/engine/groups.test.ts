import { describe, it, expect } from 'vitest';
import { groupesDe, groupsFor, groupMatch, hiddenGroupsOf } from './groups';
import { targetedTrigger } from './psychology';
import type { Combatant } from './types';
import { creatures, findCreatureById, findGodById, findGroupById, findSpeciesById, findTalentById, findTraitById } from '../data';
import { resetData, setDataset } from '../data/overrides';
import { schema as groupsSchema } from '../data/schemas/defs/groups';
import groupsJson from '../data/groups.json';

describe('Groupes — dérivation par id canonique & matching strict (LDB 21, P3)', () => {
  it('la CATÉGORIE de la créature est DÉCLARÉE sur son entrée (`grantGroups`) — plus aucune dérivation par folder', () => {
    expect(groupsFor({ creature: findCreatureById('gobelin') })).toContain('peau-verte');
    expect(groupsFor({ creature: findCreatureById('zombie') })).toContain('mort-vivant');
    expect(groupsFor({ creature: findCreatureById('ungor') })).toContain('homme-bete');
    expect(groupsFor({ creature: findCreatureById('ungor') })).not.toContain('bete');
    expect(groupsFor({ creature: findCreatureById('guerrier-des-clans') })).toContain('skaven');
    expect(groupsFor({ creature: findCreatureById('cultiste') })).toContain('cultiste');
    expect(groupsFor({ creature: findCreatureById('cheval') })).toContain('bete');
    // Une entrée sans catégorie de monstre ne déclare aucun Groupe (« Les peuples du Reikland »).
    expect(findCreatureById('humain')?.grantGroups).toBeUndefined();
  });

  it('espèce → ids DÉCLARÉS par l’entrée (`grantGroups`) + extras, puis carrière lue en direct (dédup, ids)', () => {
    const g = groupesDe({ career: 'soldat', groups: groupsFor({ speciesId: 'humains-reiklander', extras: ['sigmarite'] }) });
    expect(g).toEqual(expect.arrayContaining(['humain', 'soldat', 'sigmarite']));
  });

  it('dédup : un même id n’apparaît qu’une fois', () => {
    const g = groupsFor({ speciesId: 'humains-reiklander', extras: ['humain'] });
    expect(g.filter((x) => x === 'humain').length).toBe(1);
  });

  it('Trait (mort-vivant/demoniaque) → id de Groupe, même hors bestiaire (unifie avec domainAttributes)', () => {
    expect(groupesDe({ traits: [{ id: 'mort-vivant' }] })).toEqual(['mort-vivant']);
    expect(groupesDe({ traits: [{ id: 'demoniaque' }] })).toEqual(['demon']);
    expect(groupesDe({ traits: [{ id: 'vol' }] })).toEqual([]); // trait sans Groupe déclaré → aucun
  });

  it('Trait DISSIMULÉ : le Groupe qu’il déclare n’est PAS exposé au ciblage psy tant que la dissimulation tient (#1357)', () => {
    // Haine (mort-vivant) portée par un Répurgateur face à un porteur du Trait Mort-vivant caché.
    const chasseur = {
      id: 'repurgateur', name: 'Répurgateur', kind: 'hero', groups: [],
      psychTraits: [{ type: 'haine' as const, cible: 'mort-vivant' }],
    } as unknown as Combatant;
    const cache = [{ id: 'mort-vivant', hidden: true }];
    const dissimule = { id: 'v-1', name: 'Vampire', kind: 'enemy', groups: [], traits: cache } as unknown as Combatant;
    expect(groupesDe(dissimule)).toEqual(['mort-vivant']); // le Groupe EXISTE bien sur le porteur
    expect(hiddenGroupsOf(dissimule)).toEqual(['mort-vivant']); // …mais il est masqué
    expect(targetedTrigger(chasseur, [dissimule])).toBeNull();

    // Marque levée : le même Groupe redevient visible et la Haine se déclenche.
    const vu = [{ id: 'mort-vivant' }];
    const revele = { ...dissimule, traits: vu } as unknown as Combatant;
    expect(hiddenGroupsOf(revele)).toEqual([]);
    expect(targetedTrigger(chasseur, [revele])).toEqual({ type: 'haine', cible: 'mort-vivant', sourceId: 'v-1', indice: undefined });
  });

  it('classe « Roublards » → Groupe « criminel » auto-dérivé (Épée de justice / Traits psy ciblés)', () => {
    for (const id of ['voleur', 'hors-la-loi', 'charlatan', 'receleur']) {
      expect(groupesDe({ career: id })).toContain('criminel');
    }
    expect(groupesDe({ career: 'soldat' })).not.toContain('criminel'); // classe Guerriers
    expect(groupMatch('criminel', groupesDe({ career: 'voleur' }))).toBe(true);
  });

  it('carrières MILITAIRES précises (soldat/garde/chevalier) → leur propre id — pas toute la classe Guerriers', () => {
    expect(groupesDe({ career: 'soldat' })).toContain('soldat');
    expect(groupesDe({ career: 'garde' })).toContain('garde');
    expect(groupesDe({ career: 'chevalier' })).toContain('chevalier');
    // Cavalier est aussi classe Guerriers mais N'EST PAS une des 3 carrières militaires ciblées.
    expect(groupesDe({ career: 'cavalier' })).toEqual([]);
  });

  it('groupMatch : appartenance STRICTE par id (plus de tolérance pluriel/casse/sous-type)', () => {
    expect(groupMatch('elfe', ['elfe'])).toBe(true);
    expect(groupMatch('mort-vivant', ['mort-vivant'])).toBe(true);
    expect(groupMatch('peau-verte', ['peau-verte'])).toBe(true);
    expect(groupMatch('nain', ['humain'])).toBe(false);
    expect(groupMatch('Elfe', ['elfe'])).toBe(false); // casse différente → id DIFFÉRENT (pas de normalisation)
    expect(groupMatch('elfe', ['Elfe'])).toBe(false);
    expect(groupMatch('elfe', ['elfe-noir'])).toBe(false); // pas de raffinement de sous-type (YAGNI)
  });

  it('SOUS-ESPÈCE Tiléen : aplatit la hiérarchie — l’entrée déclare le racial ET le sous-type', () => {
    expect(groupsFor({ speciesId: 'humains-tileens' })).toEqual(expect.arrayContaining(['humain', 'tileen']));
    expect(groupsFor({ speciesId: 'humains-reiklander' })).not.toContain('tileen'); // pas de faux positif
  });

  it('carrières Bailli/Juriste/Noble → leur propre id de Groupe (Traits psy ciblés, LDB 21)', () => {
    expect(groupesDe({ career: 'bailli' })).toContain('bailli');
    expect(groupesDe({ career: 'juriste' })).toContain('juriste');
    expect(groupesDe({ career: 'noble' })).toContain('noble');
  });

  it('Talent Béni(Sigmar/Ulric) → Groupe religieux (comble le trou Phase 2 : sigmarite n’était dérivé de rien)', () => {
    expect(groupesDe({ talents: [{ talentId: 'beni', spec: 'sigmar' }] })).toContain('sigmarite');
    expect(groupesDe({ talents: [{ talentId: 'beni', spec: 'ulric' }] })).toContain('ulricain');
    expect(groupesDe({ talents: [{ talentId: 'beni', spec: 'manann' }] })).toEqual([]); // culte sans Groupe dédié
    expect(groupesDe({ talents: [{ talentId: 'autre-talent' }] })).toEqual([]); // pas Béni → rien
  });

  it('le culte n’est lu QUE via un Talent porteur de `grantSpecGroups` (le `spec` seul ne suffit pas)', () => {
    // Les deux faces du champ, sur la donnée RÉELLE : Béni le porte, Invocation non — même `spec`,
    // même dieu, un seul des deux ouvre le Groupe.
    expect(findTalentById('beni')?.grantSpecGroups).toBe(true);
    expect(findTalentById('invocation')?.grantSpecGroups).toBeUndefined();
    expect(findGodById('sigmar')?.grantGroups).toEqual(['sigmarite']);
    expect(groupesDe({ talents: [{ talentId: 'invocation', spec: 'sigmar' }] })).toEqual([]);
  });

  it('cibles spéciales : « tout » matche toujours, « vivant » exclut mort-vivant/démon', () => {
    expect(groupMatch('tout', [])).toBe(true);
    expect(groupMatch('tout', ['demon'])).toBe(true);
    expect(groupMatch('vivant', ['humain'])).toBe(true);
    expect(groupMatch('vivant', ['mort-vivant'])).toBe(false);
    expect(groupMatch('vivant', ['demon'])).toBe(false);
  });

  it('vérité — une créature avec Animosité (tileen) réagit à un combattant Tiléen', () => {
    expect(groupMatch('tileen', groupsFor({ speciesId: 'humains-tileens' }))).toBe(true);
    expect(groupMatch('tileen', groupsFor({ speciesId: 'humains-reiklander' }))).toBe(false);
  });

  it('vérité — Préjugé (noble) cible un combattant de carrière Noble', () => {
    expect(groupMatch('noble', groupesDe({ career: 'noble' }))).toBe(true);
    expect(groupMatch('noble', groupesDe({ career: 'soldat' }))).toBe(false);
  });

  it('vérité — Haine (vivant) d’un mort-vivant frappe les vivants, pas les morts-vivants', () => {
    const vivant = groupsFor({ speciesId: 'humains-reiklander' });
    const mortVivant = groupesDe({ traits: [{ id: 'mort-vivant' }] });
    expect(groupMatch('vivant', vivant)).toBe(true);
    expect(groupMatch('vivant', mortVivant)).toBe(false);
  });

  it('Trait porté (Mort-vivant/Démoniaque) → Groupe DÉCLARÉ par `capabilities.grantGroups` (#1357)', () => {
    expect(findTraitById('mort-vivant')?.capabilities?.grantGroups).toEqual(['mort-vivant']);
    expect(findTraitById('demoniaque')?.capabilities?.grantGroups).toEqual(['demon']);
  });

  it('ESPÈCE : les Groupes d’une espèce sont ses `grantGroups`, jamais un mot-clé de son libellé', () => {
    expect(findSpeciesById('gnomes')?.grantGroups).toEqual(['gnome']);
    expect(findSpeciesById('hauts-elfes')?.grantGroups).toEqual(['elfe']);
    expect(findSpeciesById('humains-tileens')?.grantGroups).toEqual(['humain', 'tileen']);
  });

  it('JOKER : `groupMatch` lit `matchesAll`/`exceptGroups` sur l’entrée de `groups.json`', () => {
    expect(findGroupById('tout')?.matchesAll).toBe(true);
    expect(findGroupById('vivant')?.exceptGroups).toEqual(['mort-vivant', 'demon']);
    expect(findGroupById('humain')?.matchesAll).toBeUndefined(); // un Groupe ordinaire n'est pas joker
    expect(groupMatch('groupe-inexistant', ['humain'])).toBe(false); // id fantôme → aucun joker implicite
  });
});

describe('Groupes du Tableau des Obsessions portés par le moteur (EDOC 12 l.180-181)', () => {
  it('Mutants : le porteur d’au moins une mutation (EDOC 12 l.56, l.181), après ses Groupes déclarés', () => {
    expect(groupesDe({ groups: ['cultiste'], mutations: [{ id: 'mutation-fixture' }] })).toEqual(['cultiste', 'mutants']);
    expect(groupesDe({ groups: ['cultiste'], mutations: [] })).toEqual(['cultiste']);
    expect(groupesDe({ groups: ['cultiste'], traits: [{ id: 'corruption-mentale' }] })).not.toContain('mutants');
  });

  it('genre : une créature reçoit les Groupes déclarés de son genre, de genre en genre (Monstres compris)', () => {
    const fiche = (id: string, champs: { grantGroups?: string[]; genre?: { id: string } }) => ({ ...creatures[0], id, grantGroups: undefined, genre: undefined, ...champs });
    try {
      setDataset('creatures', [...creatures, fiche('genre-fixture', { grantGroups: ['monstres'] }), fiche('espece-fixture', { grantGroups: ['groupe-fixture'], genre: { id: 'genre-fixture' } })]);
      expect(groupsFor({ creature: { genre: { id: 'espece-fixture' } } })).toEqual(['groupe-fixture', 'monstres']);
      expect(groupsFor({ creature: { grantGroups: ['groupe-fixture'] } })).toEqual(['groupe-fixture']);
    } finally {
      resetData();
    }
  });
});

describe('schéma de groups.json : un id de Groupe suit le motif des Groupes (#1463)', () => {
  it('le registre commité passe', () => {
    expect(groupsSchema.safeParse(groupsJson).success).toBe(true);
  });

  it('un id hors du motif est refusé, dont un `@` en tête', () => {
    for (const id of [`@${groupsJson[0].id}`, groupsJson[0].label]) {
      const refus = groupsSchema.safeParse(groupsJson.map((g, i) => (i === 0 ? { ...g, id } : g)));
      expect(refus.success, id).toBe(false);
      expect(JSON.stringify(refus.error?.issues), id).toMatch(/id de Groupe/);
    }
  });
});
