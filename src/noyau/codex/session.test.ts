/**
 * LA SESSION DU COMPENDIUM (#4020) : la consultation (famille, catégorie, recherche, facettes, entrée montrée, renvoi
 * suivi) et l'atelier d'une entrée, chaque geste joué sur la session et chaque refus dit, la donnée jamais mutée : la
 * transaction n'est que décrite (`transactionDemandee`), l'hôte la joue.
 */
import { describe, expect, it } from 'vitest';
import {
  compendium,
  entreeMontree,
  entreesListees,
  facettesOffertes,
  formulaireDeLAtelier,
  ouvrirLeCompendium,
  renvoisDeLEntree,
  transactionDemandee,
  type GesteDuCompendium,
  type SessionDuCompendium,
} from './session';
import { CODEX_GROUPS, categoryByKey } from './registry';
import { reverseGroups } from './relations';
import { datasetArray, datasetObject, entreesDuDataset, deDeLaTable } from '../../data/overrides';
import { noeudDeLEntree, noeudsDesEntrees } from '../../data/schemas/validate';
import { enregistrerEntree } from '../../data/atelierDuCodex';
import { champsDeclares, choixDuNoeud } from './editFields';
import { cleDuChapitre } from '../edition/adresseDeProse';
import { valeurNeuveDe } from '../valeursNeuves';
import { apparencesChoisissablesDObjet, findTrappingById, objetsAApparenceChoisie } from '../../data/apparencesObjets';
import { armesDEntite } from '../equipementDessine';
import { catalogueDuProcessus } from '../../data/catalogueDuProcessus';

/** La session `s` après chacun des gestes `gestes`, dans l'ordre. */
const jouer = (s: SessionDuCompendium, ...gestes: GesteDuCompendium[]): SessionDuCompendium => gestes.reduce(compendium, s);

/** Le Compendium ouvert sans `Source/` ni paquet, sur l'entrée `id` de la catégorie `categorie` si elle est donnée. */
const ouvert = (categorie?: string, id?: string): SessionDuCompendium =>
  ouvrirLeCompendium(null, [], categorie && id ? { categorie, id } : undefined);

/** Le premier niveau de carrière, et le premier talent qu'il accorde, que la donnée désigne donc. */
const NIVEAU = datasetArray('careerLevels')[0];
const TALENT_CITE = NIVEAU.talents.flatMap((r) => ('id' in r ? [r.id] : []))[0];

describe('consultation', () => {
  it('s’ouvre sur la première famille, sans catégorie ; choisir une catégorie pose sa famille, ses entrées listées', () => {
    const s = ouvert();
    expect([s.famille, s.categorie, s.montree, s.atelier, s.refus]).toEqual([CODEX_GROUPS[0], null, null, null, null]);
    const talents = compendium(s, { geste: 'categorie', categorie: 'talents' });
    expect([talents.famille, talents.categorie]).toEqual([categoryByKey('talents')!.group, 'talents']);
    expect(entreesListees(talents).length).toBe(categoryByKey('talents')!.items.length);
    expect(compendium(s, { geste: 'categorie', categorie: 'inconnue' })).toEqual({ ...s, refus: 'La catégorie « inconnue » n’existe pas au Compendium.' });
  });

  it('la recherche et une facette filtrent la liste ; la facette se bascule', () => {
    const talents = jouer(ouvert(), { geste: 'categorie', categorie: 'talents' });
    const { label } = categoryByKey('talents')!.items.find((i) => i.id === TALENT_CITE)!;
    expect(entreesListees(compendium(talents, { geste: 'recherche', terme: label })).map((i) => i.id)).toContain(TALENT_CITE);
    const [{ facet, values }] = facettesOffertes(talents);
    const cochee = compendium(talents, { geste: 'facette', cle: facet.key, valeur: values[0].value });
    expect(entreesListees(cochee).length).toBe(values[0].count);
    expect(compendium(cochee, { geste: 'facette', cle: facet.key, valeur: values[0].value }).facettes).toEqual({ [facet.key]: [] });
    expect(compendium(talents, { geste: 'facette', cle: 'aucune', valeur: 'x' }).refus).toBe('Cette catégorie n’a pas de filtre « aucune ».');
  });

  it('montrer une entrée la montre, son instance avec elle, ses renvois inverses lus ; une entrée absente est refusée', () => {
    const talents = jouer(ouvert(), { geste: 'categorie', categorie: 'talents' });
    const montre = compendium(talents, { geste: 'montrer', id: TALENT_CITE, instance: 'Instance +1' });
    expect([montre.montree, entreeMontree(montre)?.id]).toEqual([{ id: TALENT_CITE, instance: 'Instance +1' }, TALENT_CITE]);
    expect(renvoisDeLEntree(montre)).toEqual(reverseGroups('talents', TALENT_CITE));
    expect(compendium(talents, { geste: 'montrer', id: 'absente' }).refus).toBe('L’entrée « absente » n’est pas dans la catégorie « talents ».');
    expect(compendium(ouvert(), { geste: 'montrer', id: TALENT_CITE }).refus).toBe('Choisissez d’abord une catégorie.');
  });

  it('suivre un renvoi change de famille et de catégorie ; la recherche reste si l’entrée la passe, se vide sinon', () => {
    const competence = NIVEAU.skills.flatMap((r) => ('id' in r ? [r.id] : []))[0];
    const { label } = categoryByKey('skills')!.items.find((i) => i.id === competence)!;
    const cherche = (terme: string) => jouer(ouvert(), { geste: 'categorie', categorie: 'careerLevels' }, { geste: 'recherche', terme });
    const suivie = compendium(cherche(label), { geste: 'suivre', categorie: 'skills', id: competence });
    expect([suivie.famille, suivie.categorie, suivie.montree, suivie.recherche]).toEqual([categoryByKey('skills')!.group, 'skills', { id: competence }, label]);
    expect(compendium(cherche('zzz-aucune'), { geste: 'suivre', categorie: 'skills', id: competence }).recherche).toBe('');
  });

  it('un atelier ouvert refuse la navigation, abandonner la rend', () => {
    const atelier = jouer(ouvert('talents', TALENT_CITE), { geste: 'modifier' });
    expect(compendium(atelier, { geste: 'categorie', categorie: 'skills' })).toEqual({ ...atelier, refus: 'Une entrée est ouverte à l’atelier : enregistrez-la ou abandonnez-la d’abord.' });
    expect(compendium(compendium(atelier, { geste: 'abandonner' }), { geste: 'categorie', categorie: 'skills' }).categorie).toBe('skills');
  });
});

describe('atelier', () => {
  it('modifier ouvre un brouillon de l’entrée montrée, à son rang, sans toucher la donnée', () => {
    const s = jouer(ouvert('careerLevels', NIVEAU.id), { geste: 'modifier' });
    expect(s.atelier).toEqual({ categorie: 'careerLevels', index: 0, idDOrigine: NIVEAU.id, entree: NIVEAU, enTete: [], enCours: null });
    expect(s.atelier!.entree).not.toBe(NIVEAU);
  });

  it('refuse une catégorie en lecture, une modification sans entrée montrée, une configuration à créer', () => {
    const regle = categoryByKey('regles')!.items[0].id;
    expect(jouer(ouvert('regles', regle), { geste: 'modifier' }).refus).toBe('La catégorie « regles » se lit, elle ne s’édite pas.');
    expect(jouer(ouvert(), { geste: 'categorie', categorie: 'talents' }, { geste: 'modifier' }).refus).toBe('Montrez d’abord l’entrée à modifier.');
    expect(jouer(ouvert(), { geste: 'categorie', categorie: 'details' }, { geste: 'creer' }).refus).toBe('Cette catégorie est une configuration unique : modifiez-la, elle ne reçoit pas d’entrée neuve.');
    expect(jouer(ouvert(), { geste: 'valeur', chemin: ['label'], valeur: 'x' }).refus).toBe('Aucune entrée n’est ouverte à l’atelier.');
  });

  it('créer sur une catégorie discriminée pose le premier cas, son nœud ouvert sur lui', () => {
    const s = jouer(ouvert(), { geste: 'categorie', categorie: 'weaponGroups' }, { geste: 'creer' });
    const { entree, index, idDOrigine } = s.atelier!;
    expect([index, idDOrigine]).toEqual([-1, null]);
    const discriminant = champsDeclares(noeudsDesEntrees('weaponGroups')[0])!.find(([cle]) => cle === 'kind')![1];
    expect(entree.kind).toBe(choixDuNoeud(discriminant)![0].valeur);
    expect(() => noeudDeLEntree('weaponGroups', entree, catalogueDuProcessus())).not.toThrow();
    expect(formulaireDeLAtelier(s)!.champs.map((c) => c.key)).toContain('label');
  });

  it('une règle optionnelle change de provenance par retrait puis saisie, dans les deux sens', () => {
    const regle = datasetArray('reglesOptionnelles').find((r) => r.source)!;
    const s = jouer(ouvert('reglesOptionnelles', regle.id), { geste: 'modifier' });
    const provenances = (atelier: SessionDuCompendium) =>
      formulaireDeLAtelier(atelier)!.champs.map((c) => c.key).filter((k) => k === 'source' || k === 'maison').sort();
    expect(provenances(s)).toEqual(['source']);
    expect(compendium(s, { geste: 'valeur', chemin: ['maison'], valeur: 'Raison d’arbitrage.' }).refus)
      .toEqual({ chemin: ['maison'], refus: 'nonOffert' });

    const sansSource = compendium(s, { geste: 'valeur', chemin: ['source'] });
    expect(sansSource.refus).toBeNull();
    expect(sansSource.atelier!.entree.source).toBeUndefined();
    expect(provenances(sansSource)).toEqual(['maison', 'source']);
    const demande = transactionDemandee(compendium(sansSource, { geste: 'enregistrer' }))!;
    expect(demande.sorte).toBe('enregistrer');
    if (demande.sorte === 'enregistrer') {
      const issue = enregistrerEntree(demande.categorie, demande.entree, demande.index, demande.enTete);
      if (issue.ok) issue.reprendre();
      expect(issue).toMatchObject({ ok: false, erreurs: expect.arrayContaining([expect.stringContaining('provenance manquante')]) });
    }

    const maison = compendium(sansSource, { geste: 'valeur', chemin: ['maison'], valeur: 'Raison d’arbitrage.' });
    expect(maison.refus).toBeNull();
    expect(provenances(maison)).toEqual(['maison']);
    expect(compendium(maison, { geste: 'valeur', chemin: ['source'], valeur: regle.source }).refus)
      .toEqual({ chemin: ['source'], refus: 'nonOffert' });
    const sansMaison = compendium(maison, { geste: 'valeur', chemin: ['maison'] });
    expect(sansMaison.refus).toBeNull();
    expect(sansMaison.atelier!.entree.maison).toBeUndefined();
    expect(provenances(sansMaison)).toEqual(['maison', 'source']);
    const champSource = formulaireDeLAtelier(sansMaison)!.champs.find((c) => c.key === 'source')!;
    const amorceSource = valeurNeuveDe(champSource.noeud);
    const ajoutee = compendium(sansMaison, { geste: 'valeur', chemin: ['source'], valeur: amorceSource });
    expect(ajoutee.refus).toBeNull();
    expect(provenances(ajoutee)).toEqual(['source']);
    const livre = compendium(ajoutee, { geste: 'valeur', chemin: ['source', 'book'], valeur: regle.source!.book });
    expect(livre.refus).toBeNull();
    const source = compendium(livre, { geste: 'valeur', chemin: ['source', 'page'], valeur: regle.source!.page });
    expect(source.refus).toBeNull();
    expect(source.atelier!.entree.source).toEqual(regle.source);
  });

  it('l’identité de l’entrée ne s’écrit pas au formulaire : seul `identifier` la change', () => {
    const s = jouer(ouvert('careerLevels', NIVEAU.id), { geste: 'modifier' });
    expect(formulaireDeLAtelier(s)!.champs.map((c) => c.key)).not.toContain('id');
    expect(compendium(s, { geste: 'valeur', chemin: ['id'], valeur: 'autre' }).refus).not.toBeNull();
  });

  it('une valeur s’écrit à un chemin profond du brouillon ; un chemin hors du formulaire est refusé, dit', () => {
    const autre = datasetArray('talents').find((t) => t.id !== TALENT_CITE)!.id;
    const s = jouer(ouvert('careerLevels', NIVEAU.id), { geste: 'modifier' });
    const ecrite = compendium(s, { geste: 'valeur', chemin: ['talents', 0, 'id'], valeur: autre });
    expect([ecrite.refus, (ecrite.atelier!.entree.talents as { id: string }[])[0].id]).toEqual([null, autre]);
    expect(compendium(s, { geste: 'valeur', chemin: ['inexistant'], valeur: 1 }).refus).toEqual({ chemin: ['inexistant'], refus: 'nonOffert' });
    expect(entreesDuDataset('careerLevels')[0]).toBe(NIVEAU);
  });

  it('identifier : refusé vide, pris, ou s’il renomme une entrée que d’autres désignent ; accepté sinon', () => {
    const talent = jouer(ouvert('talents', TALENT_CITE), { geste: 'modifier' });
    const autre = datasetArray('talents')[1].id === TALENT_CITE ? datasetArray('talents')[2].id : datasetArray('talents')[1].id;
    expect(compendium(talent, { geste: 'identifier', id: '  ' }).refus).toBe('L’identifiant ne peut pas être vide.');
    expect(compendium(talent, { geste: 'identifier', id: autre }).refus).toBe(`L’identifiant « ${autre} » est déjà pris par une autre entrée.`);
    expect(compendium(talent, { geste: 'identifier', id: 'talent-renomme' }).refus).toMatch(new RegExp(`^D’autres données désignent « ${TALENT_CITE} », son identifiant ne change pas : .*careerLevels\\.json › `));
    expect(compendium(talent, { geste: 'identifier', id: TALENT_CITE }).refus).toBeNull();
    const neuf = jouer(ouvert(), { geste: 'categorie', categorie: 'talents' }, { geste: 'creer' }, { geste: 'identifier', id: ' talent-neuf ' });
    expect([neuf.refus, neuf.atelier!.entree.id]).toEqual([null, 'talent-neuf']);
  });

  it('identifier un élément de liste à clé : refusé vide, pris par un autre élément, désigné hors de lui, figé par le code ; accepté sinon, au seul brouillon', () => {
    const perils = jouer(ouvert(), { geste: 'categorie', categorie: 'seaPerils' }, { geste: 'modifier' });
    const { hazards, tourbillons } = datasetObject('seaPerils');
    const designe = hazards.findIndex((h) => h.id === 'debris-marins');
    expect(compendium(perils, { geste: 'identifier', chemin: ['hazards', 0], id: '  ' }).refus).toBe('L’identifiant ne peut pas être vide.');
    expect(compendium(perils, { geste: 'identifier', chemin: ['hazards', 0], id: hazards[1].id }).refus).toBe(`L’identifiant « ${hazards[1].id} » est déjà pris par un autre élément de la liste.`);
    expect(compendium(perils, { geste: 'identifier', chemin: ['hazards', designe], id: 'debris-renommes' }).refus).toMatch(/^D’autres données désignent « debris-marins », son identifiant ne change pas : .*sea-events\.json › /);
    expect(compendium(perils, { geste: 'identifier', chemin: ['hazards'], id: 'x' }).refus).toBe('Cet élément de liste ne porte pas d’identifiant.');
    const libre = tourbillons.findIndex((t) => t.id === 'maelstrom-primordial');
    const renomme = compendium(perils, { geste: 'identifier', chemin: ['tourbillons', libre], id: ' maelstrom-ultime ' });
    expect([renomme.refus, (renomme.atelier!.entree.tourbillons as { id: string }[])[libre].id]).toEqual([null, 'maelstrom-ultime']);
    expect(datasetObject('seaPerils').tourbillons[libre].id).toBe('maelstrom-primordial');
    const fleuve = jouer(ouvert(), { geste: 'categorie', categorie: 'riverNavigation' }, { geste: 'modifier' });
    expect(compendium(fleuve, { geste: 'identifier', chemin: ['windDirections', 'entries', 0], id: 'travers' }).refus).toBe('L’identifiant « arriere » est déclaré par le moteur : il ne change pas.');
  });

  it('le dé d’en-tête s’écrit sur une table qui en porte un, vide s’il est le dé imprimé ; refusé ailleurs', () => {
    const rangee = categoryByKey('drunkenness')!.items[0].id;
    const s = jouer(ouvert('drunkenness', rangee), { geste: 'modifier' });
    expect(compendium(s, { geste: 'enTete', valeur: { n: 2, sides: 10 } }).atelier!.enTete).toEqual([{ ancetre: '', champ: 'die', valeur: { n: 2, sides: 10 } }]);
    expect(compendium(compendium(s, { geste: 'enTete', valeur: { n: 2, sides: 10 } }), { geste: 'enTete', valeur: deDeLaTable('drunkenness')! }).atelier!.enTete).toEqual([]);
    expect(jouer(ouvert('talents', TALENT_CITE), { geste: 'modifier' }, { geste: 'enTete', valeur: { n: 1, sides: 10 } }).refus).toBe('Cette table ne porte pas de dé d’en-tête.');
  });

  it('enregistrer décrit la transaction, refusée tant que l’entrée est invalide ; son issue ferme l’atelier sur l’entrée', () => {
    const neuf = jouer(ouvert(), { geste: 'categorie', categorie: 'talents' }, { geste: 'creer' });
    expect(compendium(neuf, { geste: 'enregistrer' }).refus).toMatch(/^L’entrée ne s’enregistre pas : id vide/);
    const s = jouer(ouvert('talents', TALENT_CITE), { geste: 'modifier' }, { geste: 'valeur', chemin: ['label'], valeur: 'Libellé édité' }, { geste: 'enregistrer' });
    expect(transactionDemandee(s)).toEqual({ sorte: 'enregistrer', categorie: 'talents', entree: s.atelier!.entree, index: s.atelier!.index, enTete: [] });
    expect(compendium(s, { geste: 'valeur', chemin: ['label'], valeur: 'x' }).refus).toBe('Un enregistrement ou une suppression est en cours : attendez son issue.');
    const echec = compendium(s, { geste: 'enregistrement', reussi: false, refus: 'disque plein' });
    expect([echec.refus, echec.atelier!.enCours, transactionDemandee(echec)]).toEqual(['disque plein', null, null]);
    const reussi = compendium(s, { geste: 'enregistrement', reussi: true });
    expect([reussi.atelier, reussi.montree]).toEqual([null, { id: TALENT_CITE }]);
    expect(compendium(reussi, { geste: 'enregistrement', reussi: true }).refus).toBe('Aucun enregistrement ni suppression n’est en cours.');
  });

  it('supprimer : refusé en création, sur une configuration, ou sur une entrée désignée ; sinon décrit, et son issue ne montre plus rien', () => {
    expect(jouer(ouvert(), { geste: 'categorie', categorie: 'talents' }, { geste: 'creer' }, { geste: 'supprimer' }).refus).toBe('Une entrée en création ne se supprime pas : abandonnez-la.');
    const detail = categoryByKey('details')!.items[0].id;
    expect(jouer(ouvert('details', detail), { geste: 'modifier' }, { geste: 'supprimer' }).refus).toBe('Une configuration unique ne se supprime pas.');
    expect(jouer(ouvert('talents', TALENT_CITE), { geste: 'modifier' }, { geste: 'supprimer' }).refus).toMatch(/^D’autres données désignent cette entrée, elle ne se supprime pas : .*careerLevels\.json › /);
    const rangee = jouer(ouvert('drunkenness', categoryByKey('drunkenness')!.items[0].id), { geste: 'modifier' }, { geste: 'supprimer' });
    expect(transactionDemandee(rangee)).toEqual({ sorte: 'supprimer', categorie: 'drunkenness', index: 0 });
    expect(compendium(rangee, { geste: 'enregistrement', reussi: true }).montree).toBeNull();
  });

  it('l’apparence des objets d’une créature offre, comme à la scène, les seuls objets de ses armes, et de chacun ses apparences', () => {
    const creatures = datasetArray('creatures');
    const objetsDe = ({ traits, char }: (typeof creatures)[number]) => objetsAApparenceChoisie(armesDEntite(findTrappingById, undefined, { traits, char }));
    const armee = creatures.find((c) => objetsDe(c).length > 0)!;
    const desarmee = creatures.find((c) => objetsDe(c).length === 0)!;
    const choix = (id: string, chemin: readonly (string | number)[]) =>
      formulaireDeLAtelier(jouer(ouvert('creatures', id), { geste: 'modifier' }))!.champs.find((f) => f.key === 'appearance')!.contexte!.choix(['appearance', 'apparencesObjets', ...chemin]);
    const [objet] = objetsDe(armee);
    expect(choix(armee.id, [])?.map((c) => c.valeur)).toEqual(objetsDe(armee));
    expect(choix(armee.id, [objet, 'id'])?.map((c) => c.valeur)).toEqual(apparencesChoisissablesDObjet(objet).map((a) => a.id));
    expect(choix(desarmee.id, [])).toEqual([]);
  });
});

describe('le chapitre que l’atelier demande', () => {
  const MANIFESTE = { 'livre-de-base': { abbr: 'LDB', chapitres: [{ ch: '21', fichier: '21 - Psychologie.md', titre: 'Psychologie', octets: 1 }] } };
  const adressee = datasetArray('psychologies').find((p) => (p as { descRef?: { book: string; ch: string } }).descRef?.book === 'livre-de-base')!;
  const { ch } = (adressee as unknown as { descRef: { ch: string } }).descRef;

  it('ouvrir une entrée dont une adresse a un chapitre le demande ; son issue se garde, sans redemande', () => {
    const s = jouer(ouvrirLeCompendium(MANIFESTE, [], { categorie: 'psychologies', id: adressee.id }), { geste: 'modifier' });
    expect(s.source.chapitreEnAttente).toEqual({ book: 'livre-de-base', ch });
    expect(compendium(s, { geste: 'chapitre', book: 'livre-de-base', ch: '99', texte: '' }).source).toBe(s.source);
    const introuvable = compendium(s, { geste: 'chapitre', book: 'livre-de-base', ch, texte: null });
    expect([introuvable.source.chapitreEnAttente, introuvable.source.chapitres[cleDuChapitre('livre-de-base', ch)]]).toEqual([null, null]);
    expect(compendium(introuvable, { geste: 'valeur', chemin: ['label'], valeur: 'x' }).source.chapitreEnAttente).toBeNull();
    expect(jouer(ouvert('psychologies', adressee.id), { geste: 'modifier' }).source.chapitreEnAttente, 'sans Source servi, rien ne se demande').toBeNull();
  });
});
