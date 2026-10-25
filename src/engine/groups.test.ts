import { describe, it, expect } from 'vitest';
import { groupsFor, groupMatch, hiddenGroupsOf } from './groups';
import { targetedTrigger } from './psychology';
import type { Combatant } from './types';
import { findCreatureById, findGodById, findGroupById, findSpeciesById, findTalentById, findTraitById } from '../data';

describe('Groupes — dérivation par id canonique & matching strict (LDB 21, P3)', () => {
  it('la CATÉGORIE de la créature est DÉCLARÉE sur son entrée (`grantGroups`) — plus aucune dérivation par folder', () => {
    expect(groupsFor({ extras: findCreatureById('gobelin')?.grantGroups })).toContain('peau-verte');
    expect(groupsFor({ extras: findCreatureById('zombie')?.grantGroups })).toContain('mort-vivant');
    expect(groupsFor({ extras: findCreatureById('ungor')?.grantGroups })).toContain('homme-bete');
    expect(groupsFor({ extras: findCreatureById('ungor')?.grantGroups })).not.toContain('bete');
    expect(groupsFor({ extras: findCreatureById('guerrier-des-clans')?.grantGroups })).toContain('skaven');
    expect(groupsFor({ extras: findCreatureById('cultiste')?.grantGroups })).toContain('cultiste');
    expect(groupsFor({ extras: findCreatureById('cheval')?.grantGroups })).toContain('bete');
    // Une entrée sans catégorie de monstre ne déclare aucun Groupe (« Les peuples du Reikland »).
    expect(findCreatureById('humain')?.grantGroups).toBeUndefined();
  });

  it('espèce → ids DÉCLARÉS par l’entrée (`grantGroups`) + carrière + extras (dédup, ids)', () => {
    const g = groupsFor({ speciesId: 'humains-reiklander', careerId: 'soldat', extras: ['sigmarite'] });
    expect(g).toEqual(expect.arrayContaining(['humain', 'soldat', 'sigmarite']));
  });

  it('dédup : un même id n’apparaît qu’une fois', () => {
    const g = groupsFor({ speciesId: 'humains-reiklander', extras: ['humain'] });
    expect(g.filter((x) => x === 'humain').length).toBe(1);
  });

  it('Trait (mort-vivant/demoniaque) → id de Groupe, même hors bestiaire (unifie avec domainAttributes)', () => {
    expect(groupsFor({ traits: [{ id: 'mort-vivant' }] })).toEqual(['mort-vivant']);
    expect(groupsFor({ traits: [{ id: 'demoniaque' }] })).toEqual(['demon']);
    expect(groupsFor({ traits: [{ id: 'vol' }] })).toEqual([]); // trait sans Groupe déclaré → aucun
  });

  it('Trait DISSIMULÉ : le Groupe qu’il déclare n’est PAS exposé au ciblage psy tant que la dissimulation tient (#1357)', () => {
    // Haine (mort-vivant) portée par un Répurgateur face à un porteur du Trait Mort-vivant caché.
    const chasseur = {
      id: 'repurgateur', name: 'Répurgateur', kind: 'hero', groups: [],
      psychTraits: [{ type: 'haine' as const, cible: 'mort-vivant' }],
    } as unknown as Combatant;
    const cache = [{ id: 'mort-vivant', hidden: true }];
    const dissimule = { id: 'v-1', name: 'Vampire', kind: 'enemy', groups: groupsFor({ traits: cache }), traits: cache } as unknown as Combatant;
    expect(dissimule.groups).toEqual(['mort-vivant']); // le Groupe EXISTE bien sur le porteur
    expect(hiddenGroupsOf(dissimule)).toEqual(['mort-vivant']); // …mais il est masqué
    expect(targetedTrigger(chasseur, [dissimule])).toBeNull();

    // Marque levée : le même Groupe redevient visible et la Haine se déclenche.
    const vu = [{ id: 'mort-vivant' }];
    const revele = { ...dissimule, groups: groupsFor({ traits: vu }), traits: vu } as unknown as Combatant;
    expect(hiddenGroupsOf(revele)).toEqual([]);
    expect(targetedTrigger(chasseur, [revele])).toEqual({ type: 'haine', cible: 'mort-vivant', sourceId: 'v-1', indice: undefined });
  });

  it('classe « Roublards » → Groupe « criminel » auto-dérivé (Épée de justice / Traits psy ciblés)', () => {
    for (const id of ['voleur', 'hors-la-loi', 'charlatan', 'receleur']) {
      expect(groupsFor({ careerId: id })).toContain('criminel');
    }
    expect(groupsFor({ careerId: 'soldat' })).not.toContain('criminel'); // classe Guerriers
    expect(groupMatch('criminel', groupsFor({ careerId: 'voleur' }))).toBe(true);
  });

  it('carrières MILITAIRES précises (soldat/garde/chevalier) → leur propre id — pas toute la classe Guerriers', () => {
    expect(groupsFor({ careerId: 'soldat' })).toContain('soldat');
    expect(groupsFor({ careerId: 'garde' })).toContain('garde');
    expect(groupsFor({ careerId: 'chevalier' })).toContain('chevalier');
    // Cavalier est aussi classe Guerriers mais N'EST PAS une des 3 carrières militaires ciblées.
    expect(groupsFor({ careerId: 'cavalier' })).toEqual([]);
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
    expect(groupsFor({ careerId: 'bailli' })).toContain('bailli');
    expect(groupsFor({ careerId: 'juriste' })).toContain('juriste');
    expect(groupsFor({ careerId: 'noble' })).toContain('noble');
  });

  it('Talent Béni(Sigmar/Ulric) → Groupe religieux (comble le trou Phase 2 : sigmarite n’était dérivé de rien)', () => {
    expect(groupsFor({ talents: [{ talentId: 'beni', spec: 'sigmar' }] })).toContain('sigmarite');
    expect(groupsFor({ talents: [{ talentId: 'beni', spec: 'ulric' }] })).toContain('ulricain');
    expect(groupsFor({ talents: [{ talentId: 'beni', spec: 'manann' }] })).toEqual([]); // culte sans Groupe dédié
    expect(groupsFor({ talents: [{ talentId: 'autre-talent' }] })).toEqual([]); // pas Béni → rien
  });

  it('le culte n’est lu QUE via un Talent porteur de `grantSpecGroups` (le `spec` seul ne suffit pas)', () => {
    // Les deux faces du champ, sur la donnée RÉELLE : Béni le porte, Invocation non — même `spec`,
    // même dieu, un seul des deux ouvre le Groupe.
    expect(findTalentById('beni')?.grantSpecGroups).toBe(true);
    expect(findTalentById('invocation')?.grantSpecGroups).toBeUndefined();
    expect(findGodById('sigmar')?.grantGroups).toEqual(['sigmarite']);
    expect(groupsFor({ talents: [{ talentId: 'invocation', spec: 'sigmar' }] })).toEqual([]);
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
    expect(groupMatch('noble', groupsFor({ careerId: 'noble' }))).toBe(true);
    expect(groupMatch('noble', groupsFor({ careerId: 'soldat' }))).toBe(false);
  });

  it('vérité — Haine (vivant) d’un mort-vivant frappe les vivants, pas les morts-vivants', () => {
    const vivant = groupsFor({ speciesId: 'humains-reiklander' });
    const mortVivant = groupsFor({ traits: [{ id: 'mort-vivant' }] });
    expect(groupMatch('vivant', vivant)).toBe(true);
    expect(groupMatch('vivant', mortVivant)).toBe(false);
  });

  it('Trait porté (Mort-vivant/Démoniaque) → Groupe DÉCLARÉ par `capabilities.grantGroups` (#1357)', () => {
    expect(findTraitById('mort-vivant')?.capabilities?.grantGroups).toEqual(['mort-vivant']);
    expect(findTraitById('demoniaque')?.capabilities?.grantGroups).toEqual(['demon']);
  });

  it('ESPÈCE : les 27 entrées portent leur `grantGroups` (aucune ne dépend plus d’un mot-clé de label)', () => {
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
