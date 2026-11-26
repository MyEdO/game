/**
 * #4381 — catalogue des engins distinct des objets, références ordonnées pour le théâtre de guerre.
 * Entrées : src/data/trappings.json, src/data/mass-battle.json, src/data/qualities.json et, au rejeu,
 * src/data/siege-engines.json. AA 10 l.148-173, ADE II 08 l.249-278. Les postes et les possessions gardent leurs ids.
 */
import { deepStrictEqual, ok } from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { norm } from '../../src/lib/normalize.ts';
import { tableTotale } from '../../src/lib/tableTotale.ts';
import { serializeDataset } from '../../src/data/schemas/serialize.ts';
import { estDeContenu, estErreur, fragmentBlocs, resoudreAdresse, unitesDuTexte } from '../../src/data/schemas/source/decoupe.ts';
import { lireChapitre } from '../source/lecteur-fs.mjs';

const dansData = (nom) => new URL(`../../src/data/${nom}.json`, import.meta.url);
const lire = (nom) => {
  const brut = readFileSync(dansData(nom), 'utf8');
  const doc = JSON.parse(brut);
  ok(brut === serializeDataset(doc), `${nom}.json : forme non canonique`);
  return doc;
};
const ecrire = (nom, doc) => writeFileSync(dansData(nom), serializeDataset(doc));
const deSiege = (objet) => objet.subType?.id === 'armes-de-siege';

const AA = 'les-armes-de-siege';
const ADE = 'machines-de-guerre';
const SUITE_ADE = 'vert-de-jalousie';
const ADRESSES = {
  baliste: [[AA, 7], [AA, 5]],
  'catapulte-petite': [[AA, 14]],
  'catapulte-moyenne': [[AA, 14]],
  'catapulte-grande': [[AA, 14]],
  'batterie-tonnerre-de-feu': [[AA, 8]],
  'canon-a-repetition': [[AA, 10, 12]],
  'canon-a-repetition-feu-d-enfer': [[AA, 13]],
  'canon-petit': [[AA, 9]],
  'canon-moyen': [[AA, 9]],
  'canon-grand': [[AA, 9]],
  mortier: [[AA, 15]],
  pierrier: [[AA, 16]],
  'baliste-ade2': [[ADE, 7], [ADE, 6]],
  'belier-ade2': [[ADE, 8], [ADE, 4]],
  'batterie-tonnerre-de-feu-ade2': [[ADE, 9], [ADE, 6]],
  'canon-a-repetition-feu-d-enfer-ade2': [[ADE, 10], [ADE, 6]],
  'canon-ade2': [[ADE, 11], [ADE, 6]],
  'canon-a-flammes-nain-ade2': [[SUITE_ADE, 1], [ADE, 6]],
  'mangonneau-ade2': [[SUITE_ADE, 2], [ADE, 6]],
  'onagre-ade2': [[SUITE_ADE, 3], [ADE, 6]],
  'trebuchet-ade2': [[SUITE_ADE, 4], [ADE, 5, 6]],
  'mortier-ade2': [[SUITE_ADE, 5], [ADE, 5, 6]],
};

/** AA 10 l.129, l.156, l.160, l.169, l.189-191. */
const FOLIOS_DE_PROSE = new Map([
  ['catapulte-petite', 123],
  ['catapulte-moyenne', 123],
  ['catapulte-grande', 123],
  ['canon-petit', 122],
  ['canon-moyen', 122],
  ['canon-grand', 122],
]);

const contenu = (texte) => unitesDuTexte(texte).filter(estDeContenu).map((u) => u.norm).join('').replaceAll(' ', '');

function provenanceDeLaProse({ id, desc, source, alsoIn }) {
  const { book } = source;
  const choix = ADRESSES[id];
  ok(choix && typeof desc === 'string', `${id} : ancienne prose sans adresse`);
  const ch = choix[0][0] === AA ? '10' : '08';
  const chapitre = lireChapitre(book, ch);
  ok(chapitre, `${id} : source ${book} ${ch} introuvable`);
  const ref = { book, ch, parts: choix.map(([sec, b0, b1 = b0]) => fragmentBlocs(chapitre, { sec, secOcc: 1, b0, b1 })) };
  const rendu = resoudreAdresse(chapitre, ref);
  ok(!estErreur(rendu), `${id} : ${rendu.detail}`);

  /** AA 10 l.158-167. */
  const paragraphes = desc.split('\n\n');
  if (id === 'canon-a-repetition') {
    const hellblaster = resoudreAdresse(chapitre, {
      book, ch, parts: [fragmentBlocs(chapitre, { sec: AA, secOcc: 1, b0: 13, b1: 13 })],
    });
    const ancienAjout = paragraphes.pop();
    ok(ancienAjout && !estErreur(hellblaster) && contenu(hellblaster.md).includes(contenu(ancienAjout)),
      `${id} : le paragraphe retiré appartient au feu d’enfer`);
  }
  const entier = contenu(rendu.md).replace('danswarhammerfantasylejeuderôle', '');
  for (const paragraphe of paragraphes) {
    ok(entier.includes(contenu(paragraphe)), `${id} : paragraphe absent du Source adressé`);
  }
  const folio = FOLIOS_DE_PROSE.get(id);
  if (folio === undefined) return { descRef: ref };
  deepStrictEqual(rendu.folios, [folio], `${id} : folio de la prose AA`);
  const provenance = { source: { ...source, page: folio }, descRef: ref };
  if (folio !== 122) return provenance;
  return { ...provenance, alsoIn: [...(alsoIn ?? []), { book, page: 123 }] };
}

const objets = lire('trappings');
const bataille = lire('mass-battle');
const aDeplacer = objets.filter(deSiege);

if (!aDeplacer.length && bataille.warMachines.every((r) => typeof r === 'string') && existsSync(dansData('siege-engines'))) {
  console.log('#4381 : catalogue des engins et références déjà en place.');
} else {
  ok(!existsSync(dansData('siege-engines')), '#4381 : un catalogue des engins existe déjà');
  ok(aDeplacer.length && bataille.warMachines.every((r) => r && typeof r === 'object'), '#4381 : stock partiellement déplacé');
  const engins = aDeplacer.map(({ loc, pa, desc, ...engin }) => {
    ok(loc == null && pa == null, `${engin.id} : caractéristiques d’armure présentes`);
    return { ...engin, type: 'siege-engines', ...provenanceDeLaProse({ ...engin, desc }) };
  });
  const ids = new Set(objets.map((objet) => objet.id));
  ok(ids.size === objets.length, '#4381 : identités d’objets en double');

  const qualites = new Map(lire('qualities').map(({ id, label }) => [id, label]));
  const libelles = (profil) => new Set(profil.qualities.map(({ id, value }) => {
    const label = id === 'a-explosion' ? 'Explosion' : qualites.get(id);
    ok(label !== undefined, `${profil.id} : qualité inconnue « ${id} »`);
    return norm(value === undefined ? label : `${label} ${value}`);
  }));
  const refs = bataille.warMachines.map((ligne) => {
    const profil = engins.find(({ id, source }) =>
      id === `${ligne.id}-ade2` && source.book === ligne.source?.book && source.page === ligne.source?.page);
    ok(profil, `${ligne.id} : profil ADE II introuvable`);
    const { damage: degats, range, reach } = profil;
    const [equipe] = profil.qualities.filter(({ id }) => id === 'equipe');
    const valeurs = {
      label: profil.label,
      price: profil.price,
      availability: profil.availability,
      range: String(range ?? reach),
      damage: degats.literal ?? `${degats.plusBF ? '+BF ' : ''}+${degats.flat}`,
      crew: equipe?.value,
      siege: profil.qualities.some(({ id }) => id === 'siege'),
    };
    deepStrictEqual(valeurs, tableTotale(Object.keys(valeurs), (cle) => ligne[cle]), profil.id);
    const traits = libelles(profil);
    for (const trait of ligne.traits.split(', ')) ok(traits.has(norm(trait)), `${profil.id} : qualité « ${trait} » introuvable`);
    return profil.id;
  });
  ok(new Set(refs).size === refs.length, '#4381 : références de bataille en double');
  deepStrictEqual(new Set(refs),
    new Set(engins.filter(({ source }) => source.book === 'archives-de-l-empire-2').map(({ id }) => id)));

  ecrire('siege-engines', engins);
  ecrire('trappings', objets.filter((objet) => !deSiege(objet)));
  ecrire('mass-battle', { ...bataille, warMachines: refs });
  console.log(`#4381 : ${engins.length} profils déplacés, ${refs.length} références de bataille.`);
}
