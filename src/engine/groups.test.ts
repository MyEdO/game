import { describe, it, expect, afterEach } from 'vitest';
import { groupesDe, groupesPercus, groupsFor, groupMatch, hiddenGroupsOf, racesDe, selonLOrdreDesGroupes } from './groups';
import { targetedTrigger, targetCausedSourcesFor, targetCausedTrigger, sourceCombattant, idDeSource, type PsychType } from './psychology';
import type { Combatant } from './types';
import { addCondition, removeCondition } from './conditions';
import { combattantDeTest } from './combattantDeTest.testkit';
import { creatures, domains, etats, findCreatureById, groups, findGodById, findGroupById, findSpeciesById, findTalentById, findTraitById, psychologies, SPEC_SOURCES, talents, traits, type GroupData, type SpecsSource } from '../data';
import { resetData, setDataset } from '../data/overrides';
import { schema as groupsSchema } from '../data/schemas/defs/groups';
import groupsJson from '../data/groups.json';
import { ciblePsy } from './psych/ciblage';

describe('Groupes — dérivation par id canonique & matching strict (LDB 21, P3)', () => {
  it('la CATÉGORIE de la créature est DÉCLARÉE sur son entrée (`grantGroups`) — plus aucune dérivation par folder', () => {
    expect(groupsFor({ creature: findCreatureById('gobelin') })).toContain('peau-verte');
    expect(groupsFor({ creature: findCreatureById('zombie') })).toContain('mort-vivant');
    expect(groupsFor({ creature: findCreatureById('ungor') })).toContain('homme-bete');
    expect(groupsFor({ creature: findCreatureById('ungor') })).not.toContain('bete');
    expect(groupsFor({ creature: findCreatureById('guerrier-des-clans') })).toContain('skaven');
    expect(groupsFor({ creature: findCreatureById('cultiste') })).toContain('cultiste');
    expect(groupsFor({ creature: findCreatureById('cheval') })).toContain('bete');
    expect(groupsFor({ creature: findCreatureById('humain') })).toContain('humain'); // LDB 77 l.9
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
      id: 'repurgateur', name: 'Répurgateur', kind: 'heros', groups: [],
      psychTraits: [{ type: 'haine' as const, cible: ciblePsy.groupe('mort-vivant') }],
    } as unknown as Combatant;
    const cache = [{ id: 'mort-vivant', hidden: true }];
    const dissimule = { id: 'v-1', name: 'Vampire', kind: 'ennemi', groups: [], traits: cache } as unknown as Combatant;
    expect(groupesDe(dissimule)).toEqual(['mort-vivant']); // le Groupe EXISTE bien sur le porteur
    expect(hiddenGroupsOf(dissimule)).toEqual(['mort-vivant']); // …mais il est masqué
    expect(targetedTrigger(chasseur, [sourceCombattant(dissimule)])).toBeNull();

    // Marque levée : le même Groupe redevient visible et la Haine se déclenche.
    const vu = [{ id: 'mort-vivant' }];
    const revele = { ...dissimule, traits: vu } as unknown as Combatant;
    expect(hiddenGroupsOf(revele)).toEqual([]);
    expect(targetedTrigger(chasseur, [sourceCombattant(revele)])).toEqual({ type: 'haine', cible: ciblePsy.groupe('mort-vivant'), sourceId: 'v-1', indice: undefined });
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
    for (const g of ['soldat', 'garde', 'chevalier']) expect(groupesDe({ career: 'cavalier' })).not.toContain(g);
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
    expect(groupesDe({ talents: [{ talentId: 'beni', spec: 'manann' }] })).toEqual(findGodById('manann')?.grantGroups ?? []); // le culte, rien d'autre
    expect(groupesDe({ talents: [{ talentId: 'autre-talent' }] })).toEqual([]); // pas Béni → rien
  });

  it('le culte n’est lu QUE via un Talent porteur de `grantSpecGroups` (le `spec` seul ne suffit pas)', () => {
    // Les deux faces du champ, sur la donnée RÉELLE : Béni le porte, Invocation non — même `spec`,
    // même dieu, un seul des deux ouvre le Groupe.
    expect(findTalentById('beni')?.grantSpecGroups).toBe(true);
    expect(findTalentById('invocation')?.grantSpecGroups).toBeUndefined();
    expect(findGodById('sigmar')?.grantGroups).toContain('sigmarite');
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

describe('`exceptGroups` retranche ses porteurs de tout Groupe-cible, joker ou composite (#3045)', () => {
  const groupe = (id: string, o: Partial<GroupData> = {}): GroupData => ({ id, type: 'groups', label: id, ...o });
  const avec = (...gs: GroupData[]) => setDataset('groups', [...groups, ...gs] as never);
  const inclus = groupe('inclus-de-banc');
  const exclu = groupe('exclu-de-banc');
  /** Un Trait Dressé, porteur d'Animaux domestiques (Q7 A). */
  const dresse = traits.find((t) => t.id.startsWith('dresse-') && t.capabilities?.grantGroups?.some((g) => g === 'animaux-domestiques'));
  afterEach(() => resetData());

  it('un composite vise le porteur d’un Groupe inclus, sauf s’il porte aussi un Groupe exclu', () => {
    avec(inclus, exclu, groupe('composite-sauf', { inclut: [inclus.id], exceptGroups: [exclu.id] }));
    expect(groupMatch('composite-sauf', [inclus.id])).toBe(true);
    expect(groupMatch('composite-sauf', [inclus.id, exclu.id])).toBe(false);
    expect(groupMatch('composite-sauf', [exclu.id])).toBe(false);
  });

  it('un joker vise tout porteur, sauf celui d’un Groupe exclu', () => {
    avec(inclus, exclu, groupe('joker-sauf', { matchesAll: true, exceptGroups: [exclu.id] }));
    expect(groupMatch('joker-sauf', [])).toBe(true);
    expect(groupMatch('joker-sauf', [inclus.id])).toBe(true);
    expect(groupMatch('joker-sauf', [exclu.id])).toBe(false);
  });

  it('un cycle d’`exceptGroups` termine : le Groupe déjà traversé ne retranche rien', () => {
    avec(inclus, groupe('se-retranche', { inclut: [inclus.id], exceptGroups: ['se-retranche'] }), groupe('sauf-a', { inclut: [inclus.id], exceptGroups: ['sauf-b'] }), groupe('sauf-b', { inclut: [inclus.id], exceptGroups: ['sauf-a'] }));
    expect(groupMatch('se-retranche', [inclus.id])).toBe(true);
    expect(groupMatch('sauf-a', [inclus.id])).toBe(false);
  });

  it('Animaux sauvages : une bête, ni une bête Dressée, ni une bête monstre (LDB 78 l.5, LDB 79 l.5)', () => {
    expect(dresse).toBeDefined();
    expect(groupMatch('animaux-sauvages', groupesDe({ groups: ['bete'] }))).toBe(true);
    expect(groupMatch('animaux-sauvages', groupesDe({ groups: ['bete'], traits: [{ id: dresse!.id }] }))).toBe(false);
    expect(groupMatch('animaux-sauvages', groupesDe({ groups: ['bete', 'monstres'] }))).toBe(false);
    expect(groupMatch('animaux-sauvages', groupesDe({ groups: ['humain'] }))).toBe(false);
  });

  it('cas canonique : Effrayé ou Haine (Animaux sauvages), EDOC 12 l.190, voit un loup ; ni un chien, ni un loup Dressé, ni un dragon', () => {
    const cible = ciblePsy.groupe('animaux-sauvages');
    const effraye = combattantDeTest({ id: 'effraye', psychTraits: [{ type: 'phobie', cible, indice: 0 }] });
    const haineux = combattantDeTest({ id: 'haineux', psychTraits: [{ type: 'haine', cible }] });
    const bete = (creature: string, id = creature, porte: { id: string }[] = []) =>
      sourceCombattant(combattantDeTest({ id, groups: groupsFor({ creature: findCreatureById(creature) }), traits: porte }));
    const loup = bete('loup');
    expect(targetCausedTrigger(effraye, [loup])?.sourceId).toBe('loup');
    expect(targetedTrigger(haineux, [loup])?.sourceId).toBe('loup');
    for (const autre of [bete('chien'), bete('loup', 'loup-dresse', [{ id: dresse!.id }]), bete('dragon')]) {
      expect(targetCausedTrigger(effraye, [autre]), idDeSource(autre)).toBeNull();
      expect(targetedTrigger(haineux, [autre]), idDeSource(autre)).toBeNull();
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

describe('racesDe : les Groupes marqués Race (ADE II 09 l.15 ; #3045)', () => {
  const races = groups.filter((g) => g.race).map((g) => g.id);
  const autres = groups.filter((g) => !g.race).map((g) => g.id);

  it('garde chaque Groupe marqué Race, dans l’ordre reçu, et lui seul', () => {
    expect(races.length).toBeGreaterThan(1);
    expect(autres.length).toBeGreaterThan(0);
    expect(racesDe([...autres, ...races].reverse())).toEqual([...races].reverse());
    expect(racesDe(autres)).toEqual([]);
  });

  it('un id hors registre n’est pas une Race', () => {
    expect(racesDe(['groupe-fantome-qu-aucun-registre-ne-porte'])).toEqual([]);
  });

  it('les Groupes que nomme race un livre sont marqués : LDB 84 l.63, LDB 83 l.11', () => {
    expect(racesDe(['skaven', 'homme-bete'])).toEqual(['skaven', 'homme-bete']);
  });
});

describe('selonLOrdreDesGroupes — l’ordre de `groups.json`', () => {
  it('range les ids connus dans l’ordre de la donnée, retire les inconnus et les doublons', () => {
    expect(selonLOrdreDesGroupes(['skaven', 'groupe-perime', 'humain', 'skaven'])).toEqual(['humain', 'skaven']);
    const ordre = groups.map((g) => g.id);
    expect(ordre.indexOf('humain')).toBeLessThan(ordre.indexOf('skaven'));
  });
});

describe('Groupes d’un fait de fiche, lus par `groupesDe` (EDOC 12 l.170-197 ; #3045)', () => {
  /** Un Talent qui porte des Groupes, un Talent qui n'en porte pas. */
  const talentAGroupes = talents.find((t) => t.grantGroups?.length);
  const talentSansGroupe = talents.find((t) => !t.grantGroups && !t.grantSpecGroups);
  /** Un Domaine qui porte des Groupes, et la définition (Talent, Trait) dont la spécialisation le nomme. */
  const domaine = domains.find((d) => d.grantGroups?.length);
  const nommeLeDomaine = (def: { specsSource?: SpecsSource; grantSpecGroups?: true }) =>
    !!def.grantSpecGroups && !!def.specsSource && SPEC_SOURCES[def.specsSource].entree(domaine!.id) !== undefined;
  const talentDuDomaine = talents.find(nommeLeDomaine);
  const traitDuDomaine = traits.find(nommeLeDomaine);
  /** Un État qui porte des Groupes. */
  const etat = etats.find((e) => e.grantGroups?.length);

  it('précondition : la donnée porte chaque forme', () => {
    expect([talentAGroupes, talentSansGroupe, domaine, talentDuDomaine, traitDuDomaine, etat].every(Boolean)).toBe(true);
  });

  it('un Talent porté accorde ses `grantGroups` ; un Talent sans Groupe, rien', () => {
    expect(groupesDe({ talents: [{ talentId: talentAGroupes!.id }] })).toEqual(talentAGroupes!.grantGroups);
    expect(groupesDe({ talents: [{ talentId: talentSansGroupe!.id }] })).toEqual([]);
  });

  it('la spécialisation d’un Talent qui nomme un Domaine porteur accorde ses Groupes ; sans spécialisation, aucun', () => {
    expect(groupesDe({ talents: [{ talentId: talentDuDomaine!.id, spec: domaine!.id }] })).toEqual(expect.arrayContaining(domaine!.grantGroups!));
    expect(groupesDe({ talents: [{ talentId: talentDuDomaine!.id }] })).not.toEqual(expect.arrayContaining(domaine!.grantGroups!));
  });

  it('l’argument d’un Trait qui nomme un Domaine porteur accorde ses Groupes, retirés de la vue perçue si le Trait est dissimulé', () => {
    const vu = { traits: [{ id: traitDuDomaine!.id, arg: domaine!.id }] };
    expect(groupesDe(vu)).toEqual(expect.arrayContaining(domaine!.grantGroups!));
    expect(groupesPercus(vu)).toEqual(expect.arrayContaining(domaine!.grantGroups!));
    const cache = { traits: [{ id: traitDuDomaine!.id, arg: domaine!.id, hidden: true }] };
    expect(groupesDe(cache)).toEqual(expect.arrayContaining(domaine!.grantGroups!));
    expect(hiddenGroupsOf(cache)).toEqual(expect.arrayContaining(domaine!.grantGroups!));
    for (const g of domaine!.grantGroups!) expect(groupesPercus(cache)).not.toContain(g);
  });

  it('une maladie en incubation ne range dans aucun Groupe ; déclarée, dans `maladie`', () => {
    expect(groupesDe({ diseases: [{ phase: 'incubation' }] })).toEqual([]);
    expect(groupesDe({ diseases: [{ phase: 'active' }] })).toEqual(['maladie']);
  });

  it('un État porté accorde ses Groupes ; retiré, plus rien', () => {
    const c = combattantDeTest();
    addCondition(c, etat!.id);
    expect(groupesDe(c)).toEqual(etat!.grantGroups);
    removeCondition(c, etat!.id, 99);
    expect(groupesDe(c)).toEqual([]);
  });

  it('cas canonique : un Effrayé dont la Cible est le Groupe de l’État voit un combattant qui le porte, comme une scène qui porte ce Groupe', () => {
    const phobie = psychologies.find((p) => p.targetCauses);
    const cible = psychologies.find((p) => !!p.cibles && !p.targetCauses && p.triggerOn !== 'threatened');
    expect(phobie && cible).toBeTruthy();
    const groupe = etat!.grantGroups![0];
    const effraye = combattantDeTest({ id: 'effraye', psychTraits: [{ type: phobie!.id as PsychType, cible: ciblePsy.groupe(groupe), indice: 0 }] });
    const vise = combattantDeTest({ id: 'vise', psychTraits: [{ type: cible!.id as PsychType, cible: ciblePsy.groupe(groupe) }] });
    const source = combattantDeTest({ id: 'source' });
    expect(targetCausedSourcesFor(effraye, sourceCombattant(source))).toEqual([]);
    expect(targetedTrigger(vise, [sourceCombattant(source)])).toBeNull();
    addCondition(source, etat!.id);
    const lieu = { genre: 'etiquette', id: 'scene', label: 'Scène', groups: [groupe] } as const;
    expect(targetCausedSourcesFor(effraye, sourceCombattant(source))).toEqual(targetCausedSourcesFor(effraye, lieu));
    expect(targetCausedSourcesFor(effraye, sourceCombattant(source))).not.toEqual([]);
    expect(targetedTrigger(vise, [sourceCombattant(source)])?.sourceId).toBe('source');
  });
});

describe('`SPEC_SOURCES[src].entree` : une entrée seulement sur un registre de racine (#3045)', () => {
  it('un vocabulaire ou une niche ne rend aucune entrée, sans lever', () => {
    const vocabulaire = (Object.keys(SPEC_SOURCES) as SpecsSource[]).find((s) => s === 'sizes')!;
    expect(() => SPEC_SOURCES[vocabulaire].entree(SPEC_SOURCES[vocabulaire].pool()[0])).not.toThrow();
    expect(SPEC_SOURCES[vocabulaire].entree(SPEC_SOURCES[vocabulaire].pool()[0])).toBeUndefined();
    const culte = SPEC_SOURCES.cultBlessings.pool()[0];
    expect(SPEC_SOURCES.cultBlessings.entree(culte)?.id).toBe(culte);
  });
});
