/**
 * Les services du hameau : un bâtiment s'ouvre en grand sur le village, au-dessus du socle, comme dans Darkest
 * Dungeon. En tête, sur une ligne, le bâtiment (son palier, ce qu'il deviendra, le geste qui le bâtit) et la bourse ;
 * puis sa page, qui remplit le cadre de grandes cartes (une recrue, un soin, une arme, une route) dont chacune porte
 * son geste, prix compris (`achat`) ; la croix rend le village. Le socle dit ce qu'un clic fait : servir ce héros
 * (relais, forge, hospice, salle d'armes), l'emmener (départ), ou ouvrir sa fiche (ailleurs).
 */
import * as J from '../jeu';
import { blessuresARendre, encombrement, maniement, nomDeCreature, protection, talentsAcquis, texteDuTalent, type Maniement } from '../noyau';
import { medaillon, picto, plaque } from '../kit';
import { CADRES_DE_L_HOTE, type Socle } from './ecran';
import { progressionDuHeros } from './fiche';
import {
  achat, apercuDe, sejours, apercuDeProvision, cadreA, carriereDe, casesDuSac, encombrementDe, esc, etats, etiquettesDeQualites, etiquettesDeSequelles, glose, herosEnTete,
  iconeDArme, iconeDeProvision, portraitDeHeros, voieLisible,
} from './pieces';

/** L'emplacement que la forge garnit : une main, l'arme à distance, ou l'armure. */
export type Emplacement = J.Tenue | 'armure';
/** Ce que les services lisent de l'interface : l'état, le héros servi, l'emplacement ouvert à la forge, au départ
 *  la route et ceux qu'on emmène, et le héros dont le renvoi attend confirmation. */
export interface Contexte { e: J.Etat; client: string | null; emplacement: Emplacement; dest: string | null; choix: ReadonlySet<string>; congediement: string | null }
export type Service = J.IdBatiment | 'depart' | 'chronique';

export const PICTO_DU_BATIMENT: Record<J.IdBatiment, string> = { relais: 'chope', temple: 'soin', salle: 'epee', forge: 'enclume', cartographe: 'carte', peage: 'pieces', memorial: 'croix' };
const SERVENT_UN_HEROS: ReadonlySet<Service> = new Set(['relais', 'forge', 'temple', 'salle']);
const niveaux = (n: number, max: number) => `<span class="niveaux" aria-label="palier ${n + 1} sur ${max}">${Array.from({ length: max }, (_, i) => `<i class="${i <= n ? 'plein' : ''}"></i>`).join('')}</span>`;
const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;
/** Le maître d'une route et sa suite, chaque créature dite une fois avec son nombre. */
const maitres = (d: J.Destination) => [...new Set(d.boss)].map((id) => { const n = d.boss.filter((x) => x === id).length; return `${n > 1 ? `${n} × ` : ''}${nomDeCreature(id)}`; }).join(', ');

/** Le cartouche du lieu : son pictogramme, son nom, ce qu'il est. */
export const cartouche = (icone: string, nom: string, sous: string) => `<div class="cartouche">${medaillon(icone, 'grand')}<div><div class="titre gothique">${esc(nom)}</div><div class="sous-titre">${esc(sous)}</div></div></div>`;

/** Ce qui manque pour bâtir le palier suivant d'un bâtiment (or, trophées), ou rien. */
function manqueAuPalier(e: J.Etat, b: J.Batiment): string | null {
  const suivant = b.paliers[e.batiments[b.id] + 1];
  if (!suivant) return null;
  const manque = [e.or < suivant.cout ? `${suivant.cout - e.or} CO` : '', e.trophees < suivant.trophees ? pluriel(suivant.trophees - e.trophees, 'trophée') : ''].filter(Boolean);
  return manque.length ? `Il manque ${manque.join(' et ')}.` : null;
}

/** Ce qu'apporte un palier : un apport par ligne, son chiffre en marque ; `avecPicto` : son pictogramme l'ouvre. */
const apports = (p: J.Batiment['paliers'][number], avecPicto = false) => p.apports.map(({ picto: icone, chiffre, texte }) => {
  const marque = chiffre ? esc(texte).replace(esc(chiffre), () => `<b class="chiffres">${esc(chiffre)}</b>`) : esc(texte);
  return `<span class="apport">${avecPicto ? picto(icone, 20, 1.6) : ''}<span>${marque}</span></span>`;
}).join('');

/** Le prix d'un palier en deux cases du tableau, ses couronnes puis ses trophées, chacune à son pictogramme ; `e` :
 *  ce que la bourse ne couvre pas se dit en rouge. */
const prixDuPalier = (p: J.Batiment['paliers'][number], e?: J.Etat) => {
  const cout = (n: number, icone: string, dit: string, avoir?: number) => `<td class="prix${avoir != null && avoir < n ? ' manque' : ''}">${n ? `<span class="cout" aria-label="${n} ${dit}">${picto(icone, 20, 1.7)}<b class="chiffres">${n}</b></span>` : ''}</td>`;
  return cout(p.cout, 'pieces', 'CO', e?.or) + cout(p.trophees, 'crane', p.trophees > 1 ? 'trophées' : 'trophée', e?.trophees);
};

/** Le tableau des paliers d'un bâtiment, au survol de son palier actuel comme du geste qui l'agrandit : chaque rang
 *  en losanges et son état (départ, bâti, ici, prochain), ses apports à leur pictogramme, puis son prix tant qu'il
 *  reste à payer, la coche une fois payé ; le prochain est encadré ; au pied, ce qui manque pour bâtir. */
function apercuDesPaliers(e: J.Etat, b: J.Batiment) {
  const n = e.batiments[b.id];
  const refus = manqueAuPalier(e, b);
  const lignes = b.paliers.map((p, i) => {
    const etat = i < n ? 'bati' : i === n ? 'ici' : i === n + 1 ? 'prochain' : 'loin';
    return `<tr class="${etat}"${i === n ? ' aria-current="true"' : ''}><th scope="row">${niveaux(i, b.paliers.length)}<span class="rub">${{ bati: i ? 'Bâti' : 'Départ', ici: 'Ici', prochain: 'Prochain', loin: '' }[etat]}</span></th>
      <td class="offre">${apports(p, true)}</td>
      ${i <= n ? `<td class="prix acquis" colspan="2">${i ? picto('coche', 20, 2) : ''}</td>` : prixDuPalier(p, etat === 'prochain' ? e : undefined)}</tr>`;
  }).join('');
  return apercuDe({
    nom: b.nom, nature: `Palier ${n + 1} sur ${b.paliers.length}${J.enRuine(e.batiments, b.id) ? ' · en ruine' : ''}`,
    planche: `<table class="paliers-apercu"><tbody>${lignes}</tbody></table>`,
    ...(refus ? { pied: refus } : {}),
  });
}

/** Le prix du palier suivant d'un bâtiment, en geste d'achat : ce qui manque (or, trophées) le ferme ; tous les paliers
 *  au survol. */
function batir(e: J.Etat, b: J.Batiment, taille: 'petite' | 'moyenne' = 'moyenne') {
  const suivant = b.paliers[e.batiments[b.id] + 1];
  return achat({
    verbe: J.enRuine(e.batiments, b.id) ? 'Relever' : 'Bâtir', prix: suivant.cout, avoir: e.or, taille, icone: 'enclume', refus: manqueAuPalier(e, b),
    attrs: `data-a="ameliorer" data-id="${b.id}"${apercuDesPaliers(e, b)}`,
    ...(suivant.trophees ? { suite: pluriel(suivant.trophees, 'trophée') } : {}),
  });
}

/** La tête du panneau, sur une ligne : le bâtiment, son palier actuel et ce qu'il offre (tous les paliers au survol),
 *  et le geste qui l'agrandit. */
function teteDuBatiment(e: J.Etat, b: J.Batiment) {
  const n = e.batiments[b.id];
  const paliers = apercuDesPaliers(e, b);
  return `<div class="enseigne-service"${paliers}>${medaillon(PICTO_DU_BATIMENT[b.id], 'moyen', J.enRuine(e.batiments, b.id))}<div><div class="nom-propre petit gothique">Palier ${n + 1} sur ${b.paliers.length}</div>${niveaux(n, b.paliers.length)}</div></div>
    <div class="paliers"><p class="effet-actuel"${paliers}>${esc(J.phraseDuPalier(b.paliers[n]))}</p></div>
    ${b.paliers[n + 1] ? batir(e, b) : '<span class="etiquette rectangle or">Achevé</span>'}`;
}

/** La vignette d'une carte : son pictogramme en grand, sur un fond sombre. */
const vignette = (icone: string, ferme = false) => `<div class="vignette-carte">${medaillon(icone, 'grand', ferme)}</div>`;

/** Ce qu'une page dit quand elle n'a rien à montrer : un pictogramme, un mot, une précision. */
const placard = (icone: string, titre: string, sous = '') => `<div class="placard">${medaillon(icone, 'grand', true)}<div class="nom-propre grand gothique">${esc(titre)}</div>${sous ? glose(esc(sous)) : ''}</div>`;

// ─── Les pages des services ─────────────────────────────────────────────────────────────────────────────────

/** Une page de service : son corps, qui remplit le cadre, et son pied (l'action principale). `classe` : sa disposition. */
interface Page { classe: string; corps: string; pied?: string }
/** Ce qu'une page lit : l'état, le héros servi, l'emplacement ouvert à la forge, au départ ceux qu'on emmène, et le
 *  héros dont le renvoi attend confirmation. */
interface Lecture { e: J.Etat; servi: J.Heros | undefined; emplacement: Emplacement; choix: ReadonlySet<string>; congediement: string | null }

/** La chambre du relais pour le héros servi : une semaine au lit, au prix et à la qualité du palier, et pourquoi elle
 *  est refusée ; puis son renvoi, confirmé avant d'agir. LDB 66 */
function servicesDuRelais(e: J.Etat, h: J.Heros, congediement: string | null): string {
  const id = `data-id="${h.c.id}"`;
  const refus = J.refusDeChambre(e, h);
  const qualite = J.qualiteDeLaChambre(e);
  const chambre = `<article class="carte-service soin${refus ? ' clos' : ''}">${vignette('lit', !!refus)}<div class="nom-propre moyen gothique">Chambre ${esc(NOM_DE_QUALITE[qualite])}</div>
    <p class="effet">${esc(h.c.label)} ne part pas une semaine et se repose au lit, jour après jour : Blessures et fatigue. Au hameau, on ne se repose qu’ici ou à l’hospice, qui soigne d’un coup, panse et opère.</p><span class="sous-titre">une semaine à l’auberge</span>
    ${achat({ verbe: 'Louer', prix: J.prixDeLaChambre(e), avoir: e.or, attrs: `data-a="chambre" ${id}`, refus })}</article>`;
  const refusDeRenvoi = J.refusDeRenvoi(e, h);
  const geste = congediement === h.c.id
    ? `${plaque('Confirmer le renvoi', `data-a="congedier-ok" ${id}`, { taille: 'petite', armee: true })}${plaque('Garder', 'data-a="congedier-non"', { taille: 'petite' })}`
    : plaque('Renvoyer', `data-a="congedier" ${id}`, { armee: !refusDeRenvoi, fermee: !!refusDeRenvoi, titre: esc(refusDeRenvoi ?? '') });
  const renvoi = `<article class="carte-service soin${refusDeRenvoi ? ' clos' : ''}">${vignette('pieces', !!refusDeRenvoi)}<div class="nom-propre moyen gothique">Renvoyer</div>
    <p class="effet">${esc(h.c.label)} quitte la compagnie, sans rien en retour.</p><span class="sous-titre">sans retour</span>${geste}</article>`;
  return `${chambre}${renvoi}`;
}
const NOM_DE_QUALITE: Record<J.QualiteDeRepos, string> = { pietre: 'piètre', normale: 'normale', grande: 'de grande qualité' };

/** Le relais : la chambre et le renvoi du héros servi (`servicesDuRelais`) ; puis chaque voyageur en carte — son
 *  rôle, sa carrière, le Collège ou le dieu que le sort lui a donné, le Talent qui la définit, et le geste qui
 *  l'engage. */
function pageDuRelais({ e, servi, congediement }: Lecture): Page {
  const gratuit = J.engagementSansSolde(e);
  const candidats = e.candidats.map((c, i) => {
    const role = J.roleDe(c.carriere);
    const r = role && J.ROLES[role];
    const propre = J.PROFILS.find((p) => p.id === c.carriere)?.identite.talent.id;
    const talent = talentsAcquis(c.c).find((t) => t.id === propre);
    const voie = voieLisible(c);
    return `<article class="carte-service recrue">${portraitDeHeros(c, 'affiche')}
      <div class="nom-propre grand gothique">${esc(c.c.label)}</div>
      <div class="sous-titre">${esc(carriereDe(c))} · ${esc(J.nomDEspece(c.espece))}</div>
      ${r ? `<div class="role">${picto(r.picto, 18, 1.8)}${esc(r.nom)}</div>` : ''}<p class="effet">${esc(J.deviseDe(c.carriere))}</p>
      <div class="traits">${voie ? `<span class="etiquette rectangle qualite voie"${apercuDe(voie.apercu)}>${voie.signe}${esc(voie.nom)}</span>` : ''}${talent ? `<span class="etiquette rectangle qualite"${apercuDe({ nom: talent.label, nature: 'Talent', texte: texteDuTalent(talent.id) })}>${esc(talent.label)}</span>` : ''}<span class="etiquette rectangle qualite neutre">${c.c.wounds.max} Blessures</span></div>
      ${achat({ verbe: 'Engager', prix: gratuit ? 0 : c.prix, offert: 'sans solde', avoir: e.or, attrs: `data-a="recruter" data-i="${i}"` })}</article>`;
  }).join('');
  return { classe: 'rangee', corps: `${servi ? servicesDuRelais(e, servi, congediement) : ''}${candidats || placard('chope', 'Personne au relais', 'D’autres voyageurs arriveront avec la prochaine diligence.')}` };
}

type Tendance = 'hausse' | 'baisse' | 'egal';
const tendance = (ecart: number): Tendance => (ecart > 0 ? 'hausse' : ecart < 0 ? 'baisse' : 'egal');
/** Une mesure d'un objet : son nom, sa valeur, et face à ce que le héros porte son sens (`ecart`) ; `chiffre` : l'écart
 *  se dit en nombre. */
const mesure = (nom: string, valeur: string | number, ecart?: number, o: { chiffre?: boolean; bulle?: string } = {}) =>
  `<div class="mesure${typeof valeur === 'string' ? ' mot' : ''} ${ecart == null ? '' : tendance(ecart)}"${o.bulle ? ` data-bulle="${esc(o.bulle)}"` : ''}><span class="sous-titre">${nom}</span><b class="chiffres">${valeur}</b>${ecart ? `<i class="chiffres">${ecart > 0 ? '▲' : '▼'}${o.chiffre ? `${ecart > 0 ? '+' : '−'}${Math.abs(ecart)}` : ''}</i>` : ecart === 0 ? '<i class="chiffres">=</i>' : ''}</div>`;

/** Ce que dit l'étiquette d'une arme mal maîtrisée : sans sa Spécialisation (Caractéristique seule), ou maniée par une
 *  autre Spécialisation de Tir qui lui fait perdre ses Atouts. LDB 62 l.180-184 */
const MAITRISE: Partial<Record<Maniement['maitrise'], { mot: string; bulle: string }>> = {
  aucun: { mot: 'Non entraîné', bulle: 'sa Compétence ne couvre pas ce Groupe d’armes, il tire sur la Caractéristique seule' },
  degrade: { mot: 'Sans ses Atouts', bulle: 'une autre Spécialisation de Tir garde son bonus, l’arme perd ses Atouts' },
};

/** La forge pour le héros servi : à gauche ce qu'il porte — ses deux mains, son arme à distance, qu'il tire de loin
 *  en gardant l'arme de mêlée pour le corps à corps, son armure —, un emplacement ouvert ; à droite ce que la forge
 *  propose pour cet emplacement, chaque offre mesurée entre ses mains et face à ce qu'il tient. */
function pageDeLaForge({ e, servi: h, emplacement }: Lecture): Page {
  if (!h) return { classe: 'rangee', corps: placard('enclume', 'Personne à équiper') };
  const p = J.panoplie(h);
  const charge = encombrement(h.c);
  const tropLourd = (enc: number, remplace = 0) => {
    const apres = charge.porte - remplace + enc;
    return apres > charge.capacite ? `<span class="etiquette rectangle qualite defaut" data-bulle="Encombrement ${apres} / ${charge.capacite}">Trop lourd</span>` : '';
  };
  /** Les mesures d'une arme du catalogue entre les mains du héros ; `tenue` : celle qu'elle remplacerait. */
  const mesuresDArme = (a: { id?: string; allonge?: string; portee?: number }, tenue?: J.PieceDecrite) => {
    if (!a.id) return '';
    const m = maniement(h.c, a.id);
    const t = tenue?.id ? maniement(h.c, tenue.id) : undefined;
    const allonge = a.portee ? mesure('Portée', `${a.portee} m`, tenue?.portee ? a.portee - tenue.portee : undefined)
      : a.allonge ? mesure('Allonge', esc(a.allonge.toLowerCase()), t && !tenue?.portee && m.rangDAllonge != null && t.rangDAllonge != null ? m.rangDAllonge - t.rangDAllonge : undefined) : '';
    return `${mesure('Attaque', m.attaque, t && m.attaque - t.attaque, { chiffre: true, bulle: `Test de ${m.test}${MAITRISE[m.maitrise]?.bulle ? ` — ${MAITRISE[m.maitrise]!.bulle}` : ''}` })}${mesure('Dégâts', m.degats, t && m.degats - t.degats, { chiffre: true })}${allonge}`;
  };
  const armure = protection(h.c);
  /** Les PA par zone : ceux du héros, ou ceux `pa` qu'il porterait, face aux siens. */
  const mesuresDArmure = (pa?: { zone: string; pa: number }[]) =>
    (pa ?? armure).map((z) => mesure(esc(z.zone), z.pa, pa ? z.pa - (armure.find((x) => x.zone === z.zone)?.pa ?? 0) : undefined)).join('');

  /** Un emplacement du porteur : ce qu'il y tient ; ouvert, ses mesures, ses qualités et ses munitions ; fermé, ses
   *  mesures en une ligne (`resume`). */
  const tuile = (k: Emplacement, titre: string, porte: J.PieceDecrite | undefined, icone: string, mesures: string, resume: string, vide: string) => {
    const ouvert = k === emplacement;
    const reste = porte?.munitions;
    const traits = porte && (porte.qualites.length || reste) ? `<span class="traits">${etiquettesDeQualites(porte.qualites)}${reste ? `<span class="etiquette rectangle qualite ${reste.nombre ? 'neutre' : 'defaut'}">${esc(reste.label)} × ${reste.nombre}</span>` : ''}</span>` : '';
    return `<button type="button" class="emplacement${ouvert ? ' choisi' : ''}" data-a="emplacement" data-k="${k}"><span class="boite-objet${porte ? '' : ' sans-objet'}">${porte ? picto(icone, ouvert ? 26 : 22, 1.6) : ''}</span>
      <span class="t"><span class="sous-titre">${titre}</span><span class="nom-objet">${esc(porte?.label ?? vide)}</span>${ouvert ? `${mesures ? `<span class="mesures">${mesures}</span>` : ''}${traits}` : resume ? `<span class="resume chiffres">${esc(resume)}</span>` : ''}</span></button>`;
  };
  const tuileDArme = (k: J.Tenue, titre: string, vide: string) => {
    const x = p[k];
    const m = x?.id ? maniement(h.c, x.id) : undefined;
    return tuile(k, titre, x, iconeDArme(x?.label ?? ''), x ? mesuresDArme(x) : '', m ? `Attaque ${m.attaque} · Dégâts ${m.degats}${x?.portee ? ` · ${x.portee} m` : ''}` : '', vide);
  };
  const deuxMains = p.main?.mains === 2;
  const gauche = `${herosEnTete(h, 'grand', encombrementDe(h.c))}
    ${tuileDArme('main', 'Main principale', 'Vide')}
    ${tuileDArme('secondaire', 'Main secondaire', deuxMains ? 'Prise par l’arme à deux mains' : 'Vide')}
    ${tuileDArme('tir', 'À distance', 'Aucune arme de tir')}
    ${tuile('armure', 'Armure', p.armure, 'armure', mesuresDArmure(), `PA · ${armure.map((z) => `${z.zone} ${z.pa}`).join(' · ')}`, 'Sans armure')}`;

  const article = (icone: string, nom: string, mesures: string, traits: string, geste: string) =>
    `<article class="carte-service article"><header><span class="boite-objet">${picto(icone, 26, 1.6)}</span><span class="nom-propre petit gothique">${esc(nom)}</span></header><div class="mesures">${mesures}</div><div class="traits">${traits}</div>${geste}</article>`;
  const tenue = emplacement === 'armure' ? undefined : p[emplacement];
  const armes = emplacement === 'armure' ? [] : J.armesEnVente(e, h).filter((a) => a.tenue === emplacement && a.id !== tenue?.id && (emplacement !== 'secondaire' || /^bouclier/.test(a.id) || J.manieDeuxArmes(h)))
    .map((a) => ({ a, m: maniement(h.c, a.id) })).sort((x, y) => y.m.attaque - x.m.attaque || y.m.degats - x.m.degats);
  const offres = emplacement === 'armure'
    ? J.armuresEnVente(e, h).map((a) => article('armure', a.label, `${mesuresDArmure(a.pa)}${mesure('Enc.', a.enc)}`, `${etiquettesDeQualites(a.qualites)}${tropLourd(a.enc, p.armure?.enc)}`,
      achat({ verbe: 'Acheter', prix: a.prix, avoir: e.or, attrs: `data-a="armure" data-id="${h.c.id}" data-k="${a.id}"`, taille: 'petite' })))
    : armes.map(({ a, m }) => article(iconeDArme(a.label), a.label, mesuresDArme(a, tenue),
      `${a.mains === 2 && emplacement !== 'tir' ? `<span class="etiquette rectangle qualite defaut"${p.secondaire ? ` data-bulle="${esc(p.secondaire.label)} quitte sa main."` : ''}>Deux mains${p.secondaire ? `<span class="suite"> · sans ${esc(p.secondaire.label.toLowerCase())}</span>` : ''}</span>` : ''}${MAITRISE[m.maitrise] ? `<span class="etiquette rectangle qualite defaut suite" data-bulle="${esc(`${MAITRISE[m.maitrise]!.bulle} : ${m.test}`)}">${MAITRISE[m.maitrise]!.mot}</span>` : ''}${etiquettesDeQualites(a.qualites)}${tropLourd(a.enc, tenue?.enc)}`,
      achat({ verbe: 'Acheter', prix: a.prix, avoir: e.or, attrs: `data-a="arme" data-id="${h.c.id}" data-k="${a.id}"`, taille: 'petite', ...(emplacement === 'secondaire' && deuxMains ? { refus: `${p.main!.label} prend les deux mains.` } : {}) })));
  return {
    classe: 'forge',
    corps: `<div class="porteur">${gauche}</div><div class="etal${offres.length <= 4 ? ' ample' : ''}" style="--colonnes:${offres.length <= 4 ? 4 : 5}">${offres.join('') || placard('enclume', 'Rien d’autre ici', 'La forge agrandie en proposera davantage.')}</div>`,
  };
}

/** Les potions et remèdes que l'hospice vend au héros `h`, une ligne chacun avec son achat, ou rien : l'hospice en
 *  ruine n'en vend pas. Lus à l'hospice comme au départ. */
function provisions(e: J.Etat, h: J.Heros): string {
  const vente = J.provisionsEnVente(e);
  const refus = J.sejourDit(h);
  return vente.length ? `<div class="provisions">${vente.map((a) => `<div class="provision"${apercuDe(apercuDeProvision(a.id))}>${picto(iconeDeProvision(a.id), 20, 1.6)}<span class="n">${esc(a.label)}</span>${achat({ verbe: 'Acheter', prix: a.prix, avoir: e.or, attrs: `data-a="provision" data-id="${h.c.id}" data-k="${a.id}"`, taille: 'petite', refus })}</div>`).join('')}</div>` : '';
}

/** L'hospice pour le héros servi : son état à gauche, chaque soin en carte — ce qu'il fait, ce qu'il coûte, et
 *  pourquoi il est fermé —, puis les potions et remèdes qu'il lui vend (`provisionsEnVente`). LDB 18 l.204-239 ; LDB 42 */
function pageDeLaChapelle({ e, servi: h }: Lecture): Page {
  if (!h) return { classe: 'rangee', corps: placard('soin', 'Personne à soigner') };
  const ruine = J.enRuine(e.batiments, 'temple') ? 'L’hospice est en ruine.' : null;
  const hospice = J.sejourDit(h);
  const tarif = J.tarifDuSoin(e);
  const soin = (o: { icone: string; nom: string; effet: string; duree: string; verbe: string; prix: number | null; attrs: string; refus: string | null }) => {
    const refus = ruine ?? (o.prix == null ? 'L’hospice agrandi l’offrira.' : hospice ?? o.refus);
    return `<article class="carte-service soin${refus ? ' clos' : ''}">${vignette(o.icone, !!refus)}<div class="nom-propre moyen gothique">${esc(o.nom)}</div><p class="effet">${esc(o.effet)}</p><span class="sous-titre">${esc(o.duree)}</span>
      ${o.prix == null ? plaque(esc(o.verbe), '', { fermee: true, titre: esc(refus ?? '') }) : achat({ verbe: o.verbe, prix: o.prix, avoir: e.or, attrs: o.attrs, refus })}</article>`;
  };
  const id = `data-id="${h.c.id}"`;
  const vente = provisions(e, h);
  const remedes = vente ? `<article class="carte-service remedes"><div class="nom-propre moyen gothique">Potions et remèdes</div>${vente}</article>` : '';
  return {
    classe: 'chapelle',
    corps: `<div class="porteur">${herosEnTete(h, 'affiche')}${etats(h.c)}${etiquettesDeSequelles(h.c)}${hospice ? glose(esc(hospice), 'avertissement') : ''}${e.roster.some((x) => x.sejour?.ou === 'temple') ? `<div class="rub">À l’hospice</div><div class="sejours">${sejours(e, 'temple')}</div>` : ''}</div>
      <div class="etal ample" style="--colonnes:4">
      ${soin({ icone: 'soin', nom: 'Soigner', effet: 'Tous les Points de Blessure, et les États de la rencontre.', duree: J.blesse(h) ? `${Math.max(0, h.c.wounds.current)} → ${h.c.wounds.max} Blessures${tarif ? ` · ${blessuresARendre(h.c)} Blessures × ${tarif} CO` : ''}` : 'en pleine santé', verbe: 'Soigner', prix: J.prixDuSoin(e, h), attrs: `data-a="soigner" ${id}`, refus: J.blesse(h) ? null : 'Aucune blessure.' })}
      ${soin({ icone: 'lit', nom: 'Panser', effet: 'Les sœurs pansent les plaies : une déchirure mineure guérit plus vite, une fracture est réduite.', duree: `dans la journée · Test de Guérison des sœurs (${J.GUERISON_DE_L_HOSPICE})`, verbe: 'Panser', prix: J.prixDeLHospice(e, 'panser'), attrs: `data-a="hospice" ${id} data-k="panser"`, refus: J.refusDeLHospice(e, h, 'panser') })}
      ${soin({ icone: 'dague', nom: 'Opérer', effet: 'Le chirurgien opère les blessures qui l’exigent : plaie d’amputation, fracture majeure, artère.', duree: 'une semaine à l’hospice', verbe: 'Opérer', prix: J.prixDeLHospice(e, 'operer'), attrs: `data-a="hospice" ${id} data-k="operer"`, refus: J.refusDeLHospice(e, h, 'operer') })}
      ${soin({ icone: 'etoile', nom: 'Larmes de Shallya', effet: 'Le miracle guérit une Blessure critique de convalescence, jamais une amputation.', duree: 'une séquelle', verbe: 'Prier', prix: J.prixDeSequelle(e), attrs: `data-a="sequelle" ${id}`, refus: J.sequellesGuerissables(h) ? null : 'Aucune séquelle que la prière puisse guérir.' })}
      ${remedes}</div>`,
  };
}

/** La salle d'armes pour le héros servi : son bloc de progression (`progressionDuHeros`). */
function pageDeLaSalle({ e, servi: h }: Lecture): Page {
  if (!J.niveauMaximal(e)) return { classe: 'rangee', corps: placard('epee', 'En ruine', 'Les PX attendent : il faut relever la salle d’armes pour les dépenser.') };
  if (!h) return { classe: 'rangee', corps: placard('epee', 'Personne à entraîner') };
  return { classe: 'salle', corps: progressionDuHeros(e, h) };
}

/** Le cartographe : chaque route en carte — ce qui l'attend, son maître, et le geste qui la prépare. */
function pageDuCartographe({ e }: Lecture): Page {
  return {
    classe: 'rangee',
    corps: J.DESTINATIONS.map((d) => {
      const close = d.palier > e.batiments.cartographe;
      return `<article class="carte-service route${close ? ' clos' : ''}">${vignette('route', close)}<div class="nom-propre moyen gothique">${esc(d.nom)}</div>
        <p class="effet">${esc(d.recit)}</p><span class="sous-titre">${d.salles} salles · maître : ${esc(maitres(d))}</span>
        ${e.bossVaincus.includes(d.id) ? '<span class="etiquette rectangle or">Purgée</span>' : ''}
        ${plaque('Préparer', close ? '' : `data-a="preparer" data-id="${d.id}"`, { icone: 'route', armee: !close, fermee: close, titre: close ? 'Le Cartographe agrandi ouvrira cette route.' : '' })}</article>`;
    }).join(''),
  };
}

/** Les paliers d'un bâtiment en cartes : ceux qui sont bâtis, celui d'aujourd'hui, et le prochain avec son geste. */
function paliers(e: J.Etat, id: J.IdBatiment): string {
  const b = J.BATIMENTS.find((x) => x.id === id)!;
  const n = e.batiments[id];
  return b.paliers.map((p, i) => `<article class="carte-service palier${i === n ? ' courant' : i > n ? ' clos' : ''}">${vignette(PICTO_DU_BATIMENT[id], i > n)}${niveaux(i, b.paliers.length)}<p class="effet">${apports(p)}</p>
    ${i <= n ? `<span class="sous-titre">${i === n ? 'aujourd’hui' : 'bâti'}</span>` : i === n + 1 ? batir(e, b) : `<span class="sous-titre">${p.cout} CO${p.trophees ? ` · ${pluriel(p.trophees, 'trophée')}` : ''}</span>`}</article>`).join('');
}

const pageDuPeage = ({ e }: Lecture): Page => ({ classe: 'rangee', corps: paliers(e, 'peage') });

const pageDuJardin = ({ e }: Lecture): Page => ({
  classe: 'tombes',
  corps: e.cimetiere.length
    ? e.cimetiere.map((t) => `<article class="carte-service tombe">${medaillon('croix', 'moyen')}<div class="nom-propre petit gothique">${esc(t.nom)}</div><span class="sous-titre">${esc(J.nomDeCarriere(t.carriere))}</span>
      <span class="effet">${esc(t.ou)} · jour ${t.jour}</span><span class="effet">${pluriel(t.expeditions, 'expédition')}</span></article>`).join('')
    : placard('croix', 'Aucune tombe', 'Puisse-t-il en rester ainsi.'),
});

const pageDeLaChronique = ({ e }: Lecture): Page => ({ classe: 'annales', corps: `<ol class="chronique">${e.journal.map((l) => `<li>${esc(l)}</li>`).join('')}</ol>` });

/** Le départ : ceux qu'on emmène (choisis au socle), une colonne chacun — son sac, et ce que l'hospice lui vend. */
function pageDuDepart({ e, choix }: Lecture): Page {
  const groupe = e.roster.filter((h) => choix.has(h.c.id)).map((h) => `<section class="carte-service emporte">${herosEnTete(h)}
    <div class="cases-sac">${casesDuSac(h, false) || glose('sac vide')}</div>${provisions(e, h)}</section>`);
  const libres = Array.from({ length: Math.max(0, J.TAILLE_DU_GROUPE - groupe.length) }, () => `<section class="carte-service emporte libre"><span class="portrait-vide"></span><span class="place-libre">Place libre</span><span class="sous-titre">un héros du socle</span></section>`);
  return {
    classe: 'rangee',
    corps: [...groupe, ...libres].join(''),
    pied: plaque(`Partir avec ${choix.size} héros`, 'data-a="partir"', { icone: 'route', armee: choix.size > 0, fermee: !choix.size, taille: 'appel', titre: choix.size ? '' : 'Choisissez au moins un héros au socle.' }),
  };
}

/** Chaque service, sa page. */
const PAGES: Record<Service, (l: Lecture) => Page> = {
  relais: pageDuRelais, forge: pageDeLaForge, temple: pageDeLaChapelle, salle: pageDeLaSalle, cartographe: pageDuCartographe,
  peage: pageDuPeage, memorial: pageDuJardin, chronique: pageDeLaChronique, depart: pageDuDepart,
};

// ─── L'écran ────────────────────────────────────────────────────────────────────────────────────────────────

/** Le rail des bâtiments : on passe de l'un à l'autre sans revenir au village ; l'ouvert est armé. */
const railDesBatiments = (e: J.Etat, actif: Service) => `<nav class="rail-batiments">${[...J.BATIMENTS.map((b) => plaque(esc(b.nom), `data-a="batiment" data-id="${b.id}"`, { icone: PICTO_DU_BATIMENT[b.id], armee: b.id === actif, taille: 'petite', fermee: false, titre: J.enRuine(e.batiments, b.id) ? 'En ruine' : '' })),
  plaque('Chronique', 'data-a="chronique"', { icone: 'livre', armee: actif === 'chronique', taille: 'petite' })].join('')}</nav>`;

/** Le panneau d'un service, et le socle qui le sert. */
export interface PanneauDeService { cadre: string; socle: Socle }

export function panneauDeService(ctx: Contexte, service: Service): PanneauDeService {
  const { e } = ctx;
  const servi = e.roster.find((h) => h.c.id === ctx.client) ?? (service === 'temple' ? e.roster.find(J.aSoigner) : undefined) ?? e.roster[0];
  const b = J.BATIMENTS.find((x) => x.id === service);
  const destination = service === 'depart' ? J.DESTINATIONS.find((x) => x.id === ctx.dest) : undefined;
  const pourQui = SERVENT_UN_HEROS.has(service) ? servi : undefined;
  const page = PAGES[service]({ e, servi, emplacement: ctx.emplacement, choix: ctx.choix, congediement: ctx.congediement });
  const progresse = (h: J.Heros) => J.peutProgresser(e, h);
  const socle: Socle = service === 'depart'
    ? { heros: e.roster, geste: 'choisir', choisi: (h) => ctx.choix.has(h.c.id), refus: J.refusDeDepart, consigne: `Choisir le groupe · ${ctx.choix.size} / ${J.TAILLE_DU_GROUPE}` }
    : pourQui ? { heros: e.roster, refus: (h) => (h.sejour && h.sejour.ou !== service ? J.sejourDit(h) : null), geste: 'client', choisi: (h) => h.c.id === pourQui.c.id, progresse, consigne: 'Choisir le héros à servir' } : { heros: e.roster, geste: 'heros', choisi: () => false, progresse };
  const tete = b ? teteDuBatiment(e, b)
    : destination ? `<div class="enseigne-service">${medaillon('route', 'moyen')}<div><div class="nom-propre petit gothique">${destination.salles} salles</div><div class="sous-titre">maître : ${esc(maitres(destination))}</div></div></div>
      <div class="paliers"><p class="effet">${esc(destination.recit)}</p></div>${plaque('Autre route', 'data-a="batiment" data-id="cartographe"', { icone: 'carte' })}`
    : `<div class="enseigne-service">${medaillon('livre', 'moyen')}<div><div class="nom-propre petit gothique">Jour ${e.jour}</div><div class="sous-titre">ce que la compagnie a vécu</div></div></div><div class="paliers"></div>`;
  return {
    cadre: cadreA(CADRES_DE_L_HOTE.batiment, `<div class="tete-service">${tete}<div class="ressources bourse-service"><span class="etiquette compte or">${e.or} CO</span><span class="etiquette compte or">${pluriel(e.trophees, 'trophée')}</span></div>
      <button type="button" class="croix-panneau" data-a="fermer-panneau" aria-label="Fermer" data-bulle="Fermer">×</button></div>
      ${destination || e.expedition ? '' : railDesBatiments(e, service)}<div class="corps-service ${page.classe}">${page.corps}</div>${page.pied ? `<div class="pied-service">${page.pied}</div>` : ''}`, { ruban: esc(b ? b.nom : destination ? destination.nom : 'Chronique'), classe: 'page-service', etire: true }),
    socle,
  };
}
