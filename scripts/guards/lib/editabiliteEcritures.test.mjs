import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cheminsCreditesJoues } from './editabiliteEcritures.mjs';
import { auChemin } from '../../../src/lib/objet.mjs';

const jouee = (avant, apres, chemin, detail) => ({ avant, apres, chemin, valeur: auChemin(apres, chemin), saisie: 'bouton', ...detail });
const chemins = (e) => cheminsCreditesJoues([e]).map((x) => x.chemin);
const forme = (document, chemin) => auChemin(document, [...chemin, 'forme']);
const cleDeListe = (_document, chemin, element) => chemin.at(-1) === 'vitesses' ? element :
  chemin.at(-1) === 'reperes' ? element.id : chemin.at(-1) === 'valeurs' ? element.repere : element.id;
const modele = { forme, cleDeListe };

test('une insertion en tête et un échange gardent les champs décalés hors du crédit', () => {
  const a = { id: 'a', couvre: ['a'] };
  const b = { id: 'b', couvre: ['b'] };
  const avant = { routes: [a] };
  const apres = { routes: [b, { ...a, couvre: ['a'] }] };
  assert.deepEqual(chemins(jouee(avant, apres, ['routes'])), [['routes']]);
  assert.deepEqual(chemins(jouee(avant, apres, ['routes'], { modele, mouvement: { geste: 'inserer', chemin: ['routes', 0] } })), [['routes']]);
  assert.deepEqual(chemins(jouee(avant, apres, ['routes', 0], { modele, mouvement: { geste: 'inserer', chemin: ['routes', 0] } })), [['routes', 0]]);
  assert.deepEqual(chemins(jouee(avant, apres, ['routes', 0])), [['routes', 0]]);
  const montee = { routes: [a, b] };
  assert.deepEqual(chemins(jouee(apres, montee, ['routes'], { modele, mouvement: { geste: 'monter', chemin: ['routes', 1] } })), [['routes']]);
  assert.deepEqual(chemins(jouee(apres, montee, ['routes', 0, 'id'], { modele })), []);
  assert.deepEqual(chemins(jouee(montee, { routes: [b] }, ['routes'], { modele, mouvement: { geste: 'retirer', chemin: ['routes', 0] } })), [['routes']]);
});

test('un champ de structure modifié suit le porteur déplacé identifié par sa clé', () => {
  const a = { id: 'a', couvre: ['a'] };
  const b = { id: 'b', couvre: ['b'] };
  const avant = { routes: [a, b] };
  const apres = { routes: [b, { ...a, couvre: ['x'] }] };
  assert.deepEqual(chemins(jouee(avant, apres, ['routes'], { modele })),
    [['routes'], ['routes', 1], ['routes', 1, 'couvre']]);
});

test('un porteur anonyme sans preuve de continuité ne crédite pas les champs de son occupant', () => {
  const avant = { titre: 'A', routes: [{ couvre: ['x'], vitesse: 1 }, { couvre: ['y'], vitesse: 2 }] };
  const apres = { titre: 'B', routes: [{ couvre: ['a'], vitesse: 3 }, { couvre: ['b'], vitesse: 4 }] };
  assert.deepEqual(chemins(jouee(avant, apres, ['titre'])), [['titre']]);
  assert.deepEqual(chemins(jouee(avant, { ...apres, titre: avant.titre }, ['routes'])), [['routes']]);
  assert.deepEqual(chemins(jouee(avant, apres, ['routes', 0, 'vitesse'])), []);
});

test('le geste à la clé ou au rang crédite son entrée scalaire à l’ajout et à l’édition', () => {
  const avant = { vitesses: [1, 2], couts: { lettre: 2 } };
  const apres = { ...avant, vitesses: [3, 1, 2] };
  assert.deepEqual(chemins(jouee(avant, apres, ['vitesses', 0], { modele, mouvement: { geste: 'inserer', chemin: ['vitesses', 0] } })), [['vitesses', 0]]);
  assert.deepEqual(chemins(jouee(avant, { ...avant, vitesses: [3, 2] }, ['vitesses', 0], { modele })), [['vitesses', 0]]);
  assert.deepEqual(chemins(jouee(avant, { vitesses: [2, 1] }, ['vitesses', 0], { modele, mouvement: { geste: 'monter', chemin: ['vitesses', 1] } })), []);
  assert.deepEqual(chemins(jouee(avant, { ...avant, couts: { lettre: 3 } }, ['couts', 'lettre'])), [['couts', 'lettre']]);
  assert.deepEqual(chemins(jouee(avant, { ...avant, couts: { ...avant.couts, pli: 1 } }, ['couts', 'pli'])), [['couts', 'pli']]);
});

test('une offre au rang peut changer une composante de la clé sans remplacer le porteur', () => {
  const ligne = { espece: 'humain', sexe: 'M', valeurs: ['ancien'] };
  const stable = { espece: 'halfelin', sexe: 'M', valeurs: ['autre'] };
  const avant = { lignes: [ligne, stable] };
  const editee = { ...ligne, sexe: 'F' };
  const apres = { lignes: [editee, stable] };
  const chemin = ['lignes', 0, 'sexe'];
  const modele = {
    cleDeListe: (_document, _chemin, e) => [e.espece, e.sexe].join(' '),
    forme: () => 'ligne',
  };
  assert.deepEqual(cheminsCreditesJoues([jouee(avant, apres, chemin, { modele })]),
    [{ apres, chemin, temoin: { avant, chemin } }]);
  const autreVariante = { ...modele, forme: (document, ici) => auChemin(document, [...ici, 'sexe']) };
  assert.deepEqual(chemins(jouee(avant, apres, chemin, { modele: autreVariante })), []);
  assert.deepEqual(chemins(jouee(avant, { lignes: [stable, editee] }, ['lignes', 1, 'sexe'], { modele })), []);
  assert.deepEqual(chemins(jouee(avant, { lignes: [{ ...editee, valeurs: ['neuf'] }, stable] }, chemin, { modele })), []);
  assert.deepEqual(chemins(jouee(avant, { lignes: [{ ...editee, espece: stable.espece }, stable] }, chemin, { modele })), []);
  assert.deepEqual(chemins(jouee({ lignes: [ligne, { ...ligne, valeurs: ['autre'] }] },
    { lignes: [editee, { ...ligne, valeurs: ['autre'] }] }, chemin, { modele })), []);
  const autreAuMemesCles = { ...editee, valeurs: ['autre'] };
  assert.deepEqual(chemins(jouee({ lignes: [ligne, autreAuMemesCles] },
    { lignes: [editee, autreAuMemesCles] }, chemin, { modele })), []);
});

test('un rescellement suit le fragment, une homonymie de variante ne suit pas son porteur', () => {
  const avant = { parties: [{ forme: 'cellule', ligne: 1, empreinte: 'a' }], autre: { forme: 'a', n: 1 } };
  const apres = { parties: [{ forme: 'cellule', ligne: 2, empreinte: 'b' }], autre: { forme: 'b', n: 2 } };
  const ecriture = jouee(avant, apres, ['parties', 0, 'ligne'], { modele });
  assert.deepEqual(cheminsCreditesJoues([ecriture]), [
    { apres, chemin: ['parties', 0, 'ligne'], temoin: { avant, chemin: ['parties', 0, 'ligne'] } },
    { apres, chemin: ['parties', 0, 'empreinte'], incident: true, temoin: { avant, chemin: ['parties', 0, 'empreinte'] } },
  ]);
  assert.deepEqual(chemins(jouee(avant, apres, ['autre', 'forme'], { modele, variante: 'forme' })), [['autre', 'forme']]);
});

test('un champ directement visé garde un témoin permettant de refuser un homonyme de variante', () => {
  const avant = { v: { forme: 'a', n: 1 } };
  const apres = { v: { forme: 'b', n: 2 } };
  const chemin = ['v', 'n'];
  const preuve = cheminsCreditesJoues([jouee(avant, apres, chemin)]).find((x) => x.chemin.at(-1) === 'n');
  assert.deepEqual(preuve, { apres, chemin, temoin: { avant, chemin } });
  const autre = { v: { forme: 'a' } };
  const nouvel = cheminsCreditesJoues([jouee(autre, apres, chemin)]).find((x) => x.chemin.at(-1) === 'n');
  assert.deepEqual(nouvel, { apres, chemin, temoin: { avant: autre, chemin } });
  assert.deepEqual(chemins(jouee(avant, apres, chemin, { modele })), []);
});

test('un renommage avéré conserve la clé propagée au même porteur dans sa portée', () => {
  const valeurs = [{ repere: 'a', contenu: 'même' }, { repere: 'x', contenu: 'autre' }];
  const deplacees = [valeurs[1], { repere: 'b', contenu: 'même' }];
  const avant = { identite: { reperes: [{ id: 'a' }], valeurs }, autre: { valeurs } };
  const apres = { identite: { reperes: [{ id: 'b' }], valeurs: deplacees }, autre: { valeurs: deplacees } };
  const chemin = ['identite', 'reperes', 0, 'id'];
  const ecriture = jouee(avant, apres, chemin, { modele, renommage: { avant: 'a', apres: 'b' } });
  assert.deepEqual(cheminsCreditesJoues([ecriture]), [
    { apres, chemin, temoin: { avant, chemin } },
    { apres, chemin: ['identite', 'valeurs', 1, 'repere'], incident: true, temoin: { avant, chemin: ['identite', 'valeurs', 0, 'repere'] } },
  ]);
  assert.deepEqual(chemins({ ...ecriture, renommage: undefined }), [chemin]);
});

test('le nœud effectivement renommé conserve son identité quand sa réponse réécrit son renvoi', () => {
  const avant = { dialogues: [{ id: 'd', nodes: [{ id: 'a', choices: [{ id: 'boucle', next: 'a' }] }] }] };
  const apres = { dialogues: [{ id: 'd', nodes: [{ id: 'b', choices: [{ id: 'boucle', next: 'b' }] }] }] };
  const chemin = ['dialogues', 0, 'nodes', 0, 'id'];
  const ecriture = jouee(avant, apres, chemin, { modele, renommage: { avant: 'a', apres: 'b' } });
  assert.deepEqual(chemins(ecriture), [chemin, ['dialogues', 0, 'nodes', 0, 'choices', 0, 'next']]);
});


test('un contrôle de composite prouve son parent immédiat dans la même branche', () => {
  const avant = { outer: { parent: { forme: 'a', champ: 1, autre: { défaut: 1 } } } };
  const apres = { outer: { parent: { ...avant.outer.parent, champ: 2 } } };
  const modele = {
    cleDeListe: () => undefined,
    forme: (document, chemin) => chemin.length === 2 ? document.outer.parent.forme : undefined,
  };
  const geste = { avant, apres, chemin: ['outer', 'parent', 'champ'], valeur: 2, saisie: 'saisieNombre', modele, crediteParent: true };
  assert.deepEqual(cheminsCreditesJoues([geste]).map(({ chemin, incident }) => [chemin, incident]), [
    [['outer', 'parent', 'champ'], undefined],
    [['outer', 'parent'], true],
  ]);
  const change = { outer: { parent: { ...apres.outer.parent, forme: 'b' } } };
  assert.deepEqual(cheminsCreditesJoues([{ ...geste, apres: change }]), []);
});
