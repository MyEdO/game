import { isDeepStrictEqual } from 'node:util';
import { jsonCanonique } from '../../../src/lib/jsonCanonique.mjs';
import { auChemin, estObjet } from '../../../src/lib/objet.mjs';

const conteneur = (v) => estObjet(v) || Array.isArray(v);
const memeChemin = (a, b) => a.length === b.length && a.every((pas, i) => pas === b[i]);

/** Les rangs dont la clé ne désigne qu'un élément dans cette liste. */
function rangsUniques(cles) {
  const rangs = new Map();
  cles.forEach((cle, i) => {
    if (cle !== undefined) rangs.set(cle, rangs.has(cle) ? undefined : i);
  });
  return rangs;
}

/** Un renommage déplace la clé du porteur et reporte la même substitution sur les entrées qui le désignent. */
function memePorteurRenomme(a, b, renommage) {
  return estObjet(a) && estObjet(b) && Object.keys(a).length === Object.keys(b).length &&
    Object.keys(a).every((cle) => Object.hasOwn(b, cle) &&
      (isDeepStrictEqual(a[cle], b[cle]) || (a[cle] === renommage.avant && b[cle] === renommage.apres)));
}

/** Le rang d'avant d'un rang d'après pour un mouvement réellement joué sur cette liste. */
function correspondanceDuMouvement(mouvement, chemin, avant, apres) {
  if (!mouvement || !memeChemin(mouvement.chemin.slice(0, -1), chemin)) return undefined;
  const rang = mouvement.chemin.at(-1);
  if (!Number.isInteger(rang) || rang < 0) return undefined;
  if (mouvement.geste === 'monter' && apres.length === avant.length && rang > 0 && rang < avant.length) {
    return (i) => i === rang - 1 ? rang : i === rang ? rang - 1 : i;
  }
  if (mouvement.geste === 'inserer' && apres.length === avant.length + 1 && rang <= avant.length) {
    return (i) => i < rang ? i : i === rang ? undefined : i - 1;
  }
  if (mouvement.geste === 'retirer' && apres.length === avant.length - 1 && rang < avant.length) {
    return (i) => i < rang ? i : i + 1;
  }
  return undefined;
}

/** L'offre au rang change une seule propriété scalaire du porteur, dans sa variante conservée. */
function ecritUnePropriete(e, avant, apres, cheminAvant, chemin) {
  const cle = e.chemin.at(-1);
  return e.chemin.length === chemin.length + 1 && typeof cle === 'string' && estObjet(avant) && estObjet(apres)
    && Object.hasOwn(avant, cle) && Object.hasOwn(apres, cle) && !conteneur(avant[cle]) && !conteneur(apres[cle])
    && !isDeepStrictEqual(avant[cle], apres[cle]) && isDeepStrictEqual(e.valeur, apres[cle])
    && memeVariante(e, avant, apres, cheminAvant, chemin)
    && Object.keys(avant).length === Object.keys(apres).length
    && Object.keys(avant).every((champ) => champ === cle || (Object.hasOwn(apres, champ) && isDeepStrictEqual(avant[champ], apres[champ])));
}

/** Correspondance d'une liste, du rang d'après à son porteur d'avant. Un rang sans correspondance ne prouve
 *  aucun changement des champs de son occupant. Un geste local de valeur désigne son élément par position. */
function rangsApparies(e, avant, apres, cheminAvant, chemin) {
  const cles = (document, ici, liste) => e.modele?.cleDeListe
    ? liste.map((element) => e.modele.cleDeListe(document, ici, element))
    : [];
  const clesAvant = cles(e.avant, cheminAvant, avant);
  const clesApres = cles(e.apres, chemin, apres);
  const parCleAvant = rangsUniques(clesAvant);
  const parCleApres = rangsUniques(clesApres);
  const paires = new Map();
  const pris = new Set();
  const lier = (i, j, cleChangee = false) => {
    if (i === undefined || paires.has(j) || pris.has(i) || (clesAvant[i] !== clesApres[j] && !cleChangee)) return;
    paires.set(j, i);
    pris.add(i);
  };

  for (const [cle, j] of parCleApres) if (j !== undefined) lier(parCleAvant.get(cle), j);

  const renommage = e.renommage;
  if (renommage && typeof e.chemin.at(-2) === 'number' && renommage.avant !== renommage.apres && e.valeur === renommage.apres
    && !parCleAvant.has(renommage.apres) && !parCleApres.has(renommage.avant)) {
    const i = parCleAvant.get(renommage.avant);
    const j = parCleApres.get(renommage.apres);
    if (i !== undefined && j !== undefined) {
      const cible = memeChemin(e.chemin.slice(0, -1), [...chemin, j]);
      const portee = e.chemin.slice(0, -3);
      const dansPortee = memeChemin(portee, chemin.slice(0, portee.length));
      if (cible || (dansPortee && memePorteurRenomme(avant[i], apres[j], renommage))) lier(i, j, true);
    }
  }

  const parMouvement = correspondanceDuMouvement(e.mouvement, chemin, avant, apres);
  if (parMouvement) {
    apres.forEach((_v, j) => lier(parMouvement(j), j));
    return paires;
  }

  const parReferenceAvant = rangsUniques(avant);
  const parReferenceApres = rangsUniques(apres);
  for (const [valeur, j] of parReferenceApres) if (j !== undefined) lier(parReferenceAvant.get(valeur), j);

  if (paires.size < Math.min(avant.length, apres.length)) {
    const parValeurAvant = rangsUniques(avant.map(jsonCanonique));
    const parValeurApres = rangsUniques(apres.map(jsonCanonique));
    for (const [valeur, j] of parValeurApres) {
      const i = parValeurAvant.get(valeur);
      if (i !== undefined && j !== undefined && isDeepStrictEqual(avant[i], apres[j])) lier(i, j);
    }
  }

  const cible = e.chemin[chemin.length];
  const ecritALaPosition = avant.length === apres.length && Number.isInteger(cible) && cible >= 0 && cible < apres.length
    && memeChemin(e.chemin.slice(0, chemin.length), chemin);
  if (ecritALaPosition && apres.every((valeur, j) =>
    j === cible || paires.has(j) || (!pris.has(j) && isDeepStrictEqual(avant[j], valeur)))) {
    const scalaire = e.chemin.length === chemin.length + 1 && !conteneur(avant[cible]) && !conteneur(apres[cible]);
    const ancienne = clesAvant[cible];
    const nouvelle = clesApres[cible];
    const cleEditee = ancienne !== undefined && nouvelle !== undefined
      && parCleAvant.get(ancienne) === cible && !parCleApres.has(ancienne)
      && parCleApres.get(nouvelle) === cible && !parCleAvant.has(nouvelle)
      && apres.every((_valeur, j) => j === cible || paires.get(j) === j)
      && ecritUnePropriete(e, avant[cible], apres[cible], [...cheminAvant, cible], [...chemin, cible]);
    lier(cible, cible, scalaire || cleEditee);
  }
  return paires;
}

function memeVariante(e, avant, apres, cheminAvant, chemin) {
  if (!e.modele?.forme || !estObjet(avant) || !estObjet(apres)) return true;
  const initiale = e.modele.forme(e.avant, cheminAvant);
  const finale = e.modele.forme(e.apres, chemin);
  return initiale === finale;
}

/** La valeur d'avant au point réellement visé, y compris après un changement de rang. */
function pointAvant(e) {
  let avant = e.avant;
  let apres = e.apres;
  let cheminAvant = [];
  let chemin = [];
  for (const pas of e.chemin) {
    const dernier = chemin.length + 1 === e.chemin.length;
    if (!memeVariante(e, avant, apres, cheminAvant, chemin) && !(dernier && e.variante !== undefined)) return undefined;
    let ancien = pas;
    if (Array.isArray(apres)) {
      const listeAvant = Array.isArray(avant) ? avant : [];
      const paires = rangsApparies(e, listeAvant, apres, cheminAvant, chemin);
      ancien = paires.get(pas);
      if (ancien === undefined) {
        const parMouvement = correspondanceDuMouvement(e.mouvement, chemin, listeAvant, apres);
        const ajout = parMouvement
          ? e.mouvement.geste === 'inserer' && parMouvement(pas) === undefined
          : apres.length === listeAvant.length + 1 && paires.size === listeAvant.length;
        return dernier && ajout ? { valeur: undefined } : undefined;
      }
    }
    avant = auChemin(avant, [ancien]);
    apres = auChemin(apres, [pas]);
    cheminAvant = [...cheminAvant, ancien];
    chemin = [...chemin, pas];
  }
  return { valeur: avant, chemin: cheminAvant };
}

/** Les structures posées au chemin du geste et sous les porteurs qu'il conserve. Un scalaire se prouve par
 *  son contrôle, ou par le choix de son discriminant. Le corps par défaut d'un porteur inséré ne s'écrit pas. */
function cheminsPoses(e, avant, apres, cheminAvant, chemin, out) {
  if (isDeepStrictEqual(avant, apres)) return;
  const direct = chemin.length === e.chemin.length;
  const discriminant = e.variante !== undefined && chemin.length - e.chemin.length <= 1 && chemin.at(-1) === e.variante;
  const structure = conteneur(apres);
  if (!structure && !discriminant && !(direct && e.variante === undefined)) return;
  const conserve = cheminAvant !== undefined && e.variante === undefined
    && (avant !== undefined || conteneur(auChemin(e.avant, cheminAvant.slice(0, -1))));
  out.push({
    apres: e.apres,
    chemin,
    ...(!direct ? { incident: true } : {}),
    ...(conserve ? { temoin: { avant: e.avant, chemin: cheminAvant } } : {}),
  });
  if (!structure || cheminAvant === undefined || (!memeVariante(e, avant, apres, cheminAvant, chemin) && e.variante === undefined)) return;
  if (Array.isArray(apres)) {
    if (!Array.isArray(avant)) return;
    for (const [j, i] of rangsApparies(e, avant, apres, cheminAvant, chemin)) {
      cheminsPoses(e, avant[i], apres[j], [...cheminAvant, i], [...chemin, j], out);
    }
    return;
  }
  for (const [cle, valeur] of Object.entries(apres)) {
    cheminsPoses(e, auChemin(avant, [cle]), valeur, [...cheminAvant, cle], [...chemin, cle], out);
  }
}

/** Les scalaires réécrits hors du point visé, chacun dans le même porteur et la même variante avant et après. */
function scalairesChanges(e, avant, apres, cheminAvant, chemin, out) {
  if (Object.is(avant, apres) || memeChemin(chemin, e.chemin)) return;
  if (Array.isArray(avant) && Array.isArray(apres)) {
    for (const [j, i] of rangsApparies(e, avant, apres, cheminAvant, chemin)) {
      if (conteneur(apres[j])) scalairesChanges(e, avant[i], apres[j], [...cheminAvant, i], [...chemin, j], out);
    }
    return;
  }
  if (estObjet(avant) && estObjet(apres) && memeVariante(e, avant, apres, cheminAvant, chemin)) {
    for (const cle of Object.keys(apres)) {
      if (Object.hasOwn(avant, cle)) scalairesChanges(e, avant[cle], apres[cle], [...cheminAvant, cle], [...chemin, cle], out);
    }
    return;
  }
  if (avant !== undefined && apres !== undefined && !conteneur(avant) && !conteneur(apres)) {
    out.push({ apres: e.apres, chemin, incident: true, temoin: { avant: e.avant, chemin: cheminAvant } });
  }
}

/** Une offre d'un champ composite écrit aussi l'objet parent existant, dans la branche lue avant et après. */
function consignerParent(e, cheminAvant, out) {
  if (!e.crediteParent || e.variante !== undefined || !cheminAvant || e.chemin.length < 2) return;
  const chemin = e.chemin.slice(0, -1);
  const ancien = cheminAvant.slice(0, -1);
  if (!estObjet(auChemin(e.avant, ancien)) || !estObjet(auChemin(e.apres, chemin))) return;
  const forme = e.modele?.forme(e.apres, chemin);
  if (forme === undefined || forme !== e.modele.forme(e.avant, ancien)) return;
  out.push({ apres: e.apres, chemin, incident: true, temoin: { avant: e.avant, chemin: ancien } });
}

/** Les chemins qu'une écriture jouée prouve avec sa valeur relue, sur le document d'après et, quand
 *  le porteur est conservé, avec le chemin du témoin d'avant. Un chemin hors de l'adresse du geste est incident. */
export function cheminsCreditesJoues(ecritures) {
  const out = [];
  for (const e of ecritures) {
    if (e.saisie === 'saisieJson' || e.valeur === undefined || !isDeepStrictEqual(auChemin(e.apres, e.chemin), e.valeur)) continue;
    const avant = pointAvant(e);
    if (!avant || isDeepStrictEqual(avant.valeur, e.valeur)) continue;
    cheminsPoses(e, avant.valeur, e.valeur, avant.chemin, e.chemin, out);
    consignerParent(e, avant.chemin, out);
    if (e.variante === undefined) scalairesChanges(e, e.avant, e.apres, [], [], out);
  }
  return out;
}
