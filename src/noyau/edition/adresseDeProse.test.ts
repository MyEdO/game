/**
 * L'adresse de prose au formulaire tiré du schéma (#3606 M2g) : ses choix sur le chapitre chargé (`choixDuChamp`), son
 * empreinte jamais offerte ni écrite, chaque fragment scellé à l'écriture sur son chapitre (`adressesScellees`), le seul
 * qui change, « Resceller après relecture » qui les rescelle tous, et le chapitre que la session demande puis reçoit.
 */
import { describe, expect, it } from 'vitest';
import { emptyNarratif } from '../monde/campaignNarratif';
import { emptyScene, type Scene, type Trigger } from '../monde/scene';
import { addTrigger, avecLAdresseRescellee, avecLaValeurDuPorteur, type Segment } from '../sceneEdit';
import { choixDuChamp, formulaireDe, type CadreDuPorteur } from '../sceneEditLecture';
import { empreinteDe, parseChapitre, type DescRef, type Fragment } from '../../data/source/decoupe';
import { cleDuChapitre, etatDeLAdresse, type SourceDeLEdition } from './adresseDeProse';
import { editer, ouvrirLEdition, sceneEditee, texteAEnregistrer, type SessionDEdition } from './session';
import { gestesDeLaListe } from '../valeursNeuves';

/** Un chapitre de fixture : un préambule, une section titrée à un paragraphe et une table légendée, une autre section. */
const TEXTE = [
  '*Pages PDF 1-2*', '', '# Les Armes', '', 'Les armes du Vieux Monde sont nombreuses et variées, de la dague à l’arquebuse.', '',
  '**TABLE DES ARMES**', '', '| Arme | Dégâts | Prix |', '|---|---|---|', '| Dague | BF+2 | 1 pa |', '| Épée | BF+4 | 10 co |', '',
  '# Les Armures', '', 'Une armure protège son porteur des coups, au prix de sa discrétion.', '',
].join('\n');
const CHAPITRE = parseChapitre(TEXTE);
const LIVRE = 'livre-de-base';
const MANIFESTE = { [LIVRE]: { abbr: 'LDB', chapitres: [{ ch: '01', fichier: '01 - Armes.md', titre: 'Les Armes', octets: TEXTE.length }, { ch: '02', fichier: '02 - Magie.md', titre: 'La Magie', octets: 1 }] } };
const CHARGEE: SourceDeLEdition = { manifeste: MANIFESTE, chapitres: { [cleDuChapitre(LIVRE, '01')]: CHAPITRE } };
const cadre = (source: SourceDeLEdition): CadreDuPorteur => ({ scene: emptyScene('s', 4, 4), projet: { scenes: [], narratif: emptyNarratif() }, source });

/** La cellule « Dague × Dégâts » de la table des armes, à sceller. */
const DAGUE: Fragment = { kind: 'cellule', sec: 'les-armes', secOcc: 1, row: 'Dague', col: 'Dégâts', sum: '' };
/** Le paragraphe des armures, à sceller. */
const ARMURES: Fragment = { kind: 'blocs', sec: 'les-armures', secOcc: 1, b0: 0, b1: 0, sum: '' };
const scelle = (f: Fragment): Fragment => ({ ...f, sum: empreinteDe(CHAPITRE, f) as string });

const TRIG = addTrigger(emptyScene('s', 4, 4), { x: 0, y: 0, w: 1, h: 1 }).scene.triggers[0];
const ICI: Segment[] = ['flow', 'etapes', 0, 'effet', 'descRef'];
/** Le déclencheur dont le flux écrit au journal l'adresse `descRef` (absente : sans adresse). */
const avecJournal = (descRef?: DescRef): Trigger => ({ ...TRIG, flow: { kind: 'sequence', etapes: [{ kind: 'effet', effet: { type: 'journal', ...(descRef ? { descRef } : {}) } }] } }) as Trigger;
const effetDe = (t: unknown) => (t as { flow: { etapes: { effet: { descRef: DescRef; desc?: string } }[] } }).flow.etapes[0].effet;
const adresseDe = (t: unknown): DescRef => effetDe(t).descRef;
const ecrire = (t: Trigger, chemin: Segment[], valeur: unknown, source = CHARGEE) => avecLaValeurDuPorteur('declencheur', t, chemin, valeur, cadre(source));
const valeursAuChemin = (t: Trigger, chemin: Segment[], source = CHARGEE) => choixDuChamp('declencheur', t, chemin, cadre(source))?.map((c) => c.valeur);

describe('les choix d’une adresse de prose', () => {
  it('absente, chaque livre servi à composer ; son chapitre parmi ceux du livre ; sa table parmi les tables titrées de sa section, sa ligne et sa colonne parmi les siennes', () => {
    expect(valeursAuChemin(avecJournal(), ICI)).toEqual([{ book: LIVRE, ch: '', parts: [] }]);
    const cellule = avecJournal({ book: LIVRE, ch: '01', parts: [DAGUE] });
    expect(valeursAuChemin(cellule, [...ICI, 'ch'])).toEqual(['01', '02']);
    expect(valeursAuChemin(cellule, [...ICI, 'parts', 0, 'table'])).toEqual(['table des armes#1']);
    expect(valeursAuChemin(cellule, [...ICI, 'parts', 0, 'row'])).toEqual(['Dague', 'Épée']);
    expect(valeursAuChemin(cellule, [...ICI, 'parts', 0, 'col'])).toEqual(['Arme', 'Dégâts', 'Prix']);
    expect(valeursAuChemin(cellule, [...ICI, 'parts', 0, 'sec']), 'les sections titrées d’abord, le préambule en dernier').toEqual(['les-armes', 'les-armures', '']);
    expect(valeursAuChemin(cellule, [...ICI, 'parts', 1]), 'un fragment neuf, scellé : des blocs, ou une cellule').toEqual([
      scelle({ kind: 'blocs', sec: 'les-armes', secOcc: 1, b0: 0, b1: 2, sum: '' }),
      scelle(DAGUE),
    ]);
  });

  it('sans chapitre chargé, aucun fragment ne se choisit ; l’empreinte n’est jamais offerte', () => {
    const cellule = avecJournal({ book: LIVRE, ch: '01', parts: [DAGUE] });
    expect(valeursAuChemin(cellule, [...ICI, 'parts', 1], { manifeste: MANIFESTE, chapitres: {} })).toEqual([]);
    const [flow] = formulaireDe('declencheur', cellule, cadre(CHARGEE)).filter((f) => f.key === 'flow');
    expect(flow.contexte!.offert([...ICI, 'parts', 0, 'table'])).toBe(true);
    expect(flow.contexte!.offert([...ICI, 'parts', 0, 'sum'])).toBe(false);
  });
});

describe('l’écriture d’une adresse de prose scelle ses fragments, jamais une empreinte saisie', () => {
  it('le fragment choisi est scellé sur son chapitre ; sans chapitre chargé, aucun ne s’ajoute, ni ne se colle avec une empreinte', () => {
    const vide = avecJournal({ book: LIVRE, ch: '01', parts: [] });
    const ecrite = ecrire(vide, [...ICI, 'parts'], valeursAuChemin(vide, [...ICI, 'parts'])!.find((v) => (v as Fragment[])[0]?.kind === 'cellule'));
    expect(ecrite.ok && adresseDe(ecrite.valeur).parts).toEqual([scelle(DAGUE)]);
    expect(ecrite.ok && effetDe(ecrite.valeur).desc, 'sa prose, matérialisée, est le texte qu’elle résout').toBe('BF+2');
    const sansChapitre: SourceDeLEdition = { manifeste: MANIFESTE, chapitres: {} };
    expect(ecrire(vide, [...ICI, 'parts'], [scelle(DAGUE)], sansChapitre), 'même scellé, aucun fragment ne s’ajoute sans son chapitre').toEqual({ ok: false, refus: 'horsSorte' });
    expect(ecrire(avecJournal(), ['flow'], avecJournal({ book: LIVRE, ch: '01', parts: [{ ...DAGUE, sum: 'ffffffffffffffff' }] }).flow, sansChapitre)).toEqual({ ok: false, refus: 'nonOffert' });
  });

  it('l’empreinte ne s’écrit ni à son chemin, ni dans l’effet ou le flux écrits entiers', () => {
    const FORGEE = 'ffffffffffffffff';
    const scellee = avecJournal({ book: LIVRE, ch: '01', parts: [scelle(DAGUE)] });
    expect(ecrire(scellee, [...ICI, 'parts', 0, 'sum'], FORGEE)).toEqual({ ok: false, refus: 'nonOffert' });
    expect(ecrire(scellee, ['flow', 'etapes', 0, 'effet', 'desc'], 'Prose forgée.'), 'la prose qu’elle résout non plus').toEqual({ ok: false, refus: 'nonOffert' });
    const forgee = { book: LIVRE, ch: '01', parts: [{ ...DAGUE, sum: FORGEE }] };
    const effet = ecrire(scellee, ['flow', 'etapes', 0, 'effet'], { type: 'journal', descRef: forgee });
    expect(effet.ok && effetDe(effet.valeur), 'le fragment forgé est rescellé sur son chapitre').toEqual({ type: 'journal', descRef: { ...forgee, parts: [scelle(DAGUE)] } });
    const flux = ecrire(avecJournal(), ['flow'], avecJournal(forgee).flow);
    expect(flux.ok && adresseDe(flux.valeur).parts, 'le fragment neuf est scellé sur son chapitre').toEqual([scelle(DAGUE)]);
  });

  it('seul le fragment que l’écriture change est scellé ; « Resceller après relecture » les rescelle tous', () => {
    const DIVERGENTE = '0000000000000000';
    const deux = avecJournal({ book: LIVRE, ch: '01', parts: [scelle(DAGUE), { ...ARMURES, sum: DIVERGENTE }] });
    expect(etatDeLAdresse(CHARGEE, adresseDe(deux))).toMatchObject({ etat: 'refusee', erreur: { error: 'empreinte-divergente', fragment: 1 } });
    const prix = ecrire(deux, [...ICI, 'parts', 0, 'col'], 'Prix');
    expect(prix.ok && adresseDe(prix.valeur).parts).toEqual([scelle({ ...DAGUE, col: 'Prix' }), { ...ARMURES, sum: DIVERGENTE }]);
    const rescellee = avecLAdresseRescellee('declencheur', deux, ICI, cadre(CHARGEE));
    expect(rescellee.ok && adresseDe(rescellee.valeur).parts).toEqual([scelle(DAGUE), scelle(ARMURES)]);
    expect(rescellee.ok && etatDeLAdresse(CHARGEE, adresseDe(rescellee.valeur)).etat).toBe('resolue');
  });

  it('un livre qui change part sans chapitre ni fragment ; un chapitre qui change, sans fragment', () => {
    const cellule = avecJournal({ book: LIVRE, ch: '01', parts: [scelle(DAGUE)] });
    const deuxLivres: SourceDeLEdition = { ...CHARGEE, manifeste: { ...MANIFESTE, 'autre-livre': { abbr: 'AL', chapitres: [] } } };
    const livre = ecrire(cellule, [...ICI, 'book'], 'autre-livre', deuxLivres);
    expect(livre.ok && adresseDe(livre.valeur)).toEqual({ book: 'autre-livre', ch: '', parts: [] });
    const chapitre = ecrire(cellule, [...ICI, 'ch'], '02');
    expect(chapitre.ok && adresseDe(chapitre.valeur)).toEqual({ book: LIVRE, ch: '02', parts: [] });
    const meme = ecrire(cellule, [...ICI, 'ch'], '01');
    expect(meme.ok && adresseDe(meme.valeur).parts, 'le même chapitre garde ses fragments').toEqual([scelle(DAGUE)]);
  });
});

describe('la prose d’une adresse suit son adresse, à tout chemin', () => {
  const BF2 = 'BF+2';
  const journal = (descRef: DescRef) => ({ kind: 'effet', effet: { type: 'journal', descRef, desc: BF2 } });
  /** Le déclencheur dont le flux pose un indicateur, puis écrit au journal la cellule de la dague, sa prose matérialisée. */
  const DEUX = { ...TRIG, flow: { kind: 'sequence', etapes: [{ kind: 'effet', effet: { type: 'setFlag', flag: 'x' } }, journal({ book: LIVRE, ch: '01', parts: [scelle(DAGUE)] })] } } as Trigger;
  const etapes = (t: unknown) => (t as { flow: { etapes: { effet: { desc?: string; descRef?: DescRef } }[] } }).flow.etapes;
  const gestes = gestesDeLaListe(etapes(DEUX), undefined).elements;
  const SANS: SourceDeLEdition = { manifeste: MANIFESTE, chapitres: {} };
  const ECHEC: SourceDeLEdition = { manifeste: MANIFESTE, chapitres: { [cleDuChapitre(LIVRE, '01')]: null } };

  it('« Monter » le journal, son chapitre pas encore reçu ou introuvable, et « Retirer » l’étape qui le précède gardent sa prose', () => {
    for (const source of [SANS, ECHEC]) {
      const monte = ecrire(DEUX, ['flow', 'etapes'], gestes[1].monter, source);
      expect(monte.ok && etapes(monte.valeur).map((e) => e.effet.desc)).toEqual([BF2, undefined]);
    }
    const retire = ecrire(DEUX, ['flow', 'etapes'], gestes[0].retirer, SANS);
    expect(retire.ok && etapes(retire.valeur).map((e) => e.effet.desc)).toEqual([BF2]);
  });

  it('« Retirer » l’adresse retire la prose qu’elle donnait : l’enregistrement n’emporte aucun texte du Source', () => {
    const retiree = ecrire(DEUX, ['flow', 'etapes', 1, 'effet', 'descRef'], undefined);
    expect(retiree.ok && etapes(retiree.valeur)[1].effet).toEqual({ type: 'journal' });
    const avecTrig = addTrigger(emptyScene('s', 4, 4), { x: 0, y: 0, w: 1, h: 1 });
    const projet = { id: 'p', type: 'projet', label: 'P', versionContenu: 1, maison: 'adresse', scenes: [{ ...avecTrig.scene, triggers: [DEUX] }], narratif: emptyNarratif() };
    const porteur = { sorte: 'declencheur' as const, id: TRIG.id };
    const sansAdresse = editer(ouvrirLEdition(projet as unknown as Parameters<typeof ouvrirLEdition>[0], true, undefined, null), { geste: 'valeur', porteur, chemin: ['flow', 'etapes', 1, 'effet', 'descRef'] });
    expect(texteAEnregistrer(sansAdresse).ok, 'le journal sans texte ne s’enregistre pas').toBe(false);
    const saisie = editer(sansAdresse, { geste: 'valeur', porteur, chemin: ['flow', 'etapes', 1, 'effet', 'desc'], valeur: 'Texte saisi.' });
    const texte = texteAEnregistrer(saisie);
    expect(texte.ok && [texte.valeur.includes('Texte saisi.'), texte.valeur.includes(BF2)]).toEqual([true, false]);
  });

  it('une écriture sans rapport garde la prose saisie d’un journal voisin, et cette prose s’écrit', () => {
    const SAISIE = 'Texte saisi par l’auteur.';
    const TROIS = { ...DEUX, flow: { kind: 'sequence', etapes: [...etapes(DEUX), { kind: 'effet', effet: { type: 'journal', desc: SAISIE } }] } } as Trigger;
    const drapeau = ecrire(TROIS, ['flow', 'etapes', 0, 'effet', 'flag'], 'z');
    expect(drapeau.ok && etapes(drapeau.valeur).map((e) => e.effet.desc)).toEqual([undefined, BF2, SAISIE]);
    const reecrite = ecrire(TROIS, ['flow', 'etapes', 2, 'effet', 'desc'], 'Autre texte saisi.');
    expect(reecrite.ok && etapes(reecrite.valeur).map((e) => e.effet.desc)).toEqual([undefined, BF2, 'Autre texte saisi.']);
  });

  it('choisie à la session, une cellule de table s’enregistre scellée, sa table comprise, sans la prose qu’elle résout', () => {
    const avecTrig = addTrigger(emptyScene('s', 4, 4), { x: 0, y: 0, w: 1, h: 1 });
    const projet = { id: 'p', type: 'projet', label: 'P', versionContenu: 1, maison: 'adresse', scenes: [{ ...avecTrig.scene, triggers: [avecJournal({ book: LIVRE, ch: '01', parts: [] })] }], narratif: emptyNarratif() };
    const ouverte = ouvrirLEdition(projet as unknown as Parameters<typeof ouvrirLEdition>[0], true, undefined, MANIFESTE);
    const demande = editer(ouverte, { geste: 'appui', point: { case: { x: 0, y: 0 }, f: { x: 0, y: 0 } } });
    const chargee = editer(demande, { geste: 'chapitre', book: LIVRE, ch: '01', texte: TEXTE });
    const cellule = choixDuChamp('declencheur', sceneEditee(chargee).triggers[0], [...ICI, 'parts'], cadre(CHARGEE))!.find((c) => c.libelle === 'cellule')!.valeur;
    const porteur = { sorte: 'declencheur' as const, id: TRIG.id };
    const ecrite = editer(chargee, { geste: 'valeur', porteur, chemin: [...ICI, 'parts'], valeur: cellule });
    const deTable = editer(ecrite, { geste: 'valeur', porteur, chemin: [...ICI, 'parts', 0, 'table'], valeur: 'table des armes#1' });
    const texte = texteAEnregistrer(deTable);
    const enregistree = scelle({ ...DAGUE, table: 'table des armes#1' });
    expect(enregistree.sum, 'scellée').not.toBe('');
    expect(texte.ok && effetDe((JSON.parse(texte.valeur) as { scenes: Scene[] }).scenes[0].triggers[0])).toEqual({ type: 'journal', descRef: { book: LIVRE, ch: '01', parts: [enregistree] } });
  });
});

describe('le chapitre que la session demande', () => {
  const avecTrig = addTrigger(emptyScene('s', 4, 4), { x: 0, y: 0, w: 1, h: 1 });
  const ouverte = (manifeste: typeof MANIFESTE | null): SessionDEdition => {
    const scene = { ...avecTrig.scene, triggers: [avecJournal({ book: LIVRE, ch: '01', parts: [] })] };
    return ouvrirLEdition({ scenes: [scene], narratif: emptyNarratif() } as unknown as Parameters<typeof ouvrirLEdition>[0], false, undefined, manifeste);
  };
  const selectionne = (s: SessionDEdition) => editer(s, { geste: 'appui', point: { case: { x: 0, y: 0 }, f: { x: 0, y: 0 } } });

  it('sélectionner un porteur dont l’adresse a un chapitre le demande ; son texte le charge, son absence s’en souvient, sans le redemander', () => {
    const demande = selectionne(ouverte(MANIFESTE));
    expect(demande.sel).toEqual({ type: 'trigger', id: TRIG.id });
    expect(demande.chapitreEnAttente).toEqual({ book: LIVRE, ch: '01' });
    expect(editer(demande, { geste: 'chapitre', book: LIVRE, ch: '02', texte: TEXTE }), 'un autre chapitre que l’attendu ne change rien').toBe(demande);
    const chargee = editer(demande, { geste: 'chapitre', book: LIVRE, ch: '01', texte: TEXTE });
    expect([chargee.chapitreEnAttente, chargee.chapitres[cleDuChapitre(LIVRE, '01')]]).toEqual([null, CHAPITRE]);
    const introuvable = editer(demande, { geste: 'chapitre', book: LIVRE, ch: '01', texte: null });
    expect([introuvable.chapitreEnAttente, introuvable.chapitres[cleDuChapitre(LIVRE, '01')]]).toEqual([null, null]);
    expect(selectionne(introuvable).chapitreEnAttente, 'l’échec gardé, aucune demande en boucle').toBeNull();
    expect(selectionne(ouverte(null)).chapitreEnAttente, 'sans Source servi, rien ne se demande').toBeNull();
  });

  it('choisir un chapitre le demande', () => {
    const chargee = editer(selectionne(ouverte(MANIFESTE)), { geste: 'chapitre', book: LIVRE, ch: '01', texte: TEXTE });
    const autre = editer(chargee, { geste: 'valeur', porteur: { sorte: 'declencheur', id: TRIG.id }, chemin: [...ICI, 'ch'], valeur: '02' });
    expect(adresseDe(sceneEditee(autre).triggers[0])).toEqual({ book: LIVRE, ch: '02', parts: [] });
    expect(autre.chapitreEnAttente).toEqual({ book: LIVRE, ch: '02' });
  });
});
