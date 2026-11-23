/**
 * La fiche du héros, au gabarit commun (`./ecran`) et à la disposition de la fiche des maquettes : l'identité et ce
 * que son niveau exige, la bande des Caractéristiques, les Compétences (ou, en route, ce qui se fait entre deux
 * salles), Talents, Sorts et Équipement en onglets. Talents, sorts, provisions et prières sont des entrées
 * (`entree`), armes et armures des cases (`caseObjet`), toutes avec leur aperçu. Ce qui s'achète en PX (bourse,
 * Caractéristiques, Compétences, Talents, sorts, niveau suivant) est fait de blocs que la salle d'armes pose aussi
 * (`./services`) : chacun porte son geste d'achat (`achat`), prix compris.
 */
import * as J from '../jeu';
import { carac, ficheDeCompetence, ficheDuSort, libelleDeCarac, prixDuSort, protection, talentsAcquis, texteDeCarac, texteDuTalent, type CharKey } from '../noyau';
import { picto, plaque } from '../kit';
import { CADRES, ecran } from './ecran';
import {
  achat, apercuDe, apercuDePiece, apercuDeProvision, type Apercu, cadreA, carriereDe, caseObjet, casesDuSac, encombrementDe, entree, esc, essentielDe, etats, portraitDeHeros,
  etiquettesDeSequelles, glose, iconeDArme, iconeDeProvision, ligneDeVie, onglets, sejourDe,
} from './pieces';

export type Onglet = 'talents' | 'sorts' | 'equipement';
/** Ce que la fiche lit de l'interface : l'état du jeu, et le héros dont on confirme le renvoi. */
export interface Contexte { e: J.Etat; congediement: string | null }
type Offres = ReturnType<typeof J.offresDeCarriere>;

const CARACS_DU_PROFIL: CharKey[] = ['capacite-de-combat', 'capacite-de-tir', 'force', 'endurance', 'initiative', 'agilite', 'dexterite', 'intelligence', 'force-mentale', 'sociabilite'];
const coche = (fait: boolean) => (fait ? `<i class="trou plein">${picto('coche', 14, 2.4)}</i>` : '<i class="trou"></i>');
const exige = (fait: boolean, texte: string, compte = '') => `<div class="exige">${coche(fait)}<span>${texte}</span>${compte ? `<span class="cpt chiffres">${compte}</span>` : ''}</div>`;
/** Une Augmentation à acheter : « +1 · prix ». */
const augmenter = (h: J.Heros, cout: number, attrs: string) => achat({ verbe: '+1', prix: cout, monnaie: 'PX', avoir: h.c.xp ?? 0, attrs: `${attrs} data-id="${h.c.id}"`, taille: 'petite' });

// ─── Ce qui s'achète en PX ──────────────────────────────────────────────────────────────────────────────────

/** Les PX à dépenser, et le niveau de carrière où il en est. */
export const bourseDePX = (h: J.Heros, o: Offres) =>
  `<div class="bourse-px"><div class="px laiton"><div class="chiffres">${h.c.xp ?? 0}</div></div><div><b>PX à dépenser</b>${glose(`${esc(J.nomDeCarriere(h.carriere))} · niveau ${o.niveau} : ${esc(o.titre)}`)}</div></div>`;

/** Le niveau suivant : ce qu'il exige, où le héros en est, et son geste. LDB 07 l.124-131 */
export function niveauSuivant(e: J.Etat, h: J.Heros, o: Offres): string {
  const suivant = o.suivant;
  if (!suivant) return glose('Sommet de la carrière.');
  const caracsAFaire = o.caracs.filter((k) => k.augmentations < o.requis).map((k) => libelleDeCarac(k.id).abr);
  const caracsFaites = o.caracs.length - caracsAFaire.length;
  const compsFaites = Math.min(8, o.competences.filter((k) => k.augmentations >= o.requis).length);
  const manque = [caracsAFaire.length ? `${caracsAFaire.join(', ')} à +${o.requis}` : '', compsFaites < 8 ? `${8 - compsFaites} Compétence${compsFaites < 7 ? 's' : ''} à +${o.requis}` : '', o.talentAcquis ? '' : 'un Talent'].filter(Boolean);
  const refus = suivant.niveau > J.niveauMaximal(e) ? 'La salle d’armes n’enseigne pas encore ce niveau : agrandissez-la.' : manque.length ? `Il manque : ${manque.join(' ; ')}.` : null;
  return `<div class="rub">Niveau ${suivant.niveau} · ${esc(suivant.titre)}</div><div class="exigences">
      ${exige(caracsFaites >= o.caracs.length, `${o.caracs.map((k) => esc(libelleDeCarac(k.id).abr)).join(', ')} : +${o.requis} chacune`, `${caracsFaites} / ${o.caracs.length}`)}
      ${exige(compsFaites >= 8, `Huit Compétences à +${o.requis}`, `${compsFaites} / 8`)}
      ${exige(o.talentAcquis, 'Un Talent de ce niveau')}</div>
    ${achat({ verbe: `Passer ${suivant.titre}`, prix: suivant.cout, monnaie: 'PX', avoir: h.c.xp ?? 0, attrs: `data-a="niveau" data-id="${h.c.id}"`, refus })}`;
}

/** Les Caractéristiques en cases : celles de la carrière, cernées de laiton, disent où elles en sont du niveau et
 *  s'augmentent d'un clic ; `toutes` : le profil entier (la bande de la fiche), sinon celles de la carrière. */
export function caracteristiques(h: J.Heros, o: Offres, progresse: boolean, toutes: boolean): string {
  const parCarac = new Map(o.caracs.map((k) => [k.id, k]));
  const xp = h.c.xp ?? 0;
  return (toutes ? CARACS_DU_PROFIL : o.caracs.map((k) => k.id)).map((k) => {
    const of = parCarac.get(k);
    const { abr, label } = libelleDeCarac(k);
    const cellule = `<span class="ab">${esc(abr)}</span><span class="v chiffres">${carac(h.c, k)}</span>`;
    const livre = (pied?: string) => apercuDe({ nom: label, nature: `Caractéristique · ${carac(h.c, k)}`, texte: texteDeCarac(k), ...(pied ? { pied } : {}) });
    if (!of) return `<div class="c"${livre()}>${cellule}</div>`;
    const ou = `<span class="crans" aria-label="${of.augmentations} Augmentation${of.augmentations > 1 ? 's' : ''} sur ${o.requis}">${Array.from({ length: o.requis }, (_, i) => `<i class="${i < of.augmentations ? 'plein' : ''}"></i>`).join('')}</span>`;
    const augs = `${label} : ${of.augmentations} Augmentation${of.augmentations > 1 ? 's' : ''} sur ${o.requis} pour ce niveau`;
    if (!progresse) return `<div class="c carr"${livre(augs)}>${cellule}${ou}</div>`;
    return `<button type="button" class="c carr${of.augmentations >= o.requis ? ' faite' : ''}" data-a="carac" data-id="${h.c.id}" data-k="${k}" ${livre(xp < of.cout ? `${augs} · il manque ${of.cout - xp} PX` : augs)}${xp < of.cout ? ' disabled' : ''}>${cellule}${ou}<span class="etiquette compte ${xp >= of.cout ? 'or' : 'fer'}">+1 · ${of.cout} PX</span></button>`;
  }).join('');
}

/** Les Compétences de la carrière, une ligne chacune : où elle en est du niveau, la valeur de son Test, son geste. */
/** L'aperçu d'une Compétence : son texte du livre, la valeur de son Test, et où elle sert dans le roguelite. */
const apercuDeCompetence = (k: Offres['competences'][number]): Apercu => {
  const f = ficheDeCompetence(k.ref.id);
  return { nom: k.label, nature: `Compétence · ${f.carac ? libelleDeCarac(f.carac).label : k.carac} · Test ${k.valeur}`, texte: f.texte, pied: `${k.augmentations} Augmentation${k.augmentations > 1 ? 's' : ''}` };
};

export const competences = (h: J.Heros, o: Offres) => o.competences.map((k, i) =>
  `<div class="achat${k.augmentations >= o.requis ? ' faite' : ''}"><span class="fait">${k.augmentations >= o.requis ? picto('coche', 15, 2.4) : ''}</span>${k.carac ? `<span class="etiquette rectangle">${esc(k.carac)}</span>` : ''}<span class="n"${apercuDe(apercuDeCompetence(k))}>${esc(k.label)}</span><span class="aug chiffres">+${k.augmentations}/${o.requis}</span><span class="val chiffres" data-bulle="Valeur de son Test">${k.valeur}</span>${augmenter(h, k.cout, `data-a="competence" data-i="${i}"`)}</div>`).join('');

/** Les Talents du niveau qui agissent en combat : acquis, ou à apprendre. */
export const talentsDuNiveau = (h: J.Heros, o: Offres) => o.talents.map((t, i) => entree({
  icone: t.possede ? 'etoile' : 'livre', nom: t.label, etat: t.possede ? `Acquis${t.possede > 1 ? ` ×${t.possede}` : ''}` : 'À apprendre', acquis: t.possede > 0,
  apercu: { nom: t.label, nature: 'Talent', texte: texteDuTalent(t.ref.id) },
  ...(t.auMaxi ? {} : { action: achat({ verbe: t.possede ? 'Renforcer' : 'Apprendre', prix: t.cout, monnaie: 'PX', avoir: h.c.xp ?? 0, attrs: `data-a="talent" data-id="${h.c.id}" data-i="${i}"`, taille: 'petite' }) }),
})).join('');

const sort = (id: string, etat: string, action?: string) => { const f = ficheDuSort(id); return entree({ icone: 'feu', nom: f.label, etat, acquis: !action, apercu: { nom: f.label, nature: f.nature, texte: f.texte }, action }); };

/** Les sorts que la voie du héros lui ouvre, à apprendre : chacun avec son prix ; avant le Talent de la voie, ce
 *  qui les ouvrira. */
export function sortsAApprendre(h: J.Heros): string {
  const voie = J.voieDe(h.carriere, h.c);
  if (!voie) return '';
  const appris = h.c.talents.some((t) => t.talentId === voie.talent);
  const liste = !appris ? glose(`Au niveau 2, le Talent ${esc(voie.nom)} ouvre ces sorts.`) : voie.sorts.filter((id) => !(h.c.spells ?? []).includes(id)).map((id) => {
    const prix = prixDuSort(h.c, id);
    return sort(id, 'À apprendre', prix == null ? plaque('Apprendre', '', { taille: 'petite', fermee: true, titre: 'Ce héros ne peut pas l’apprendre.' })
      : achat({ verbe: 'Apprendre', prix, monnaie: 'PX', avoir: h.c.xp ?? 0, attrs: `data-a="sort" data-id="${h.c.id}" data-k="${id}"`, taille: 'petite' }));
  }).join('') || glose('Tout est appris.');
  return `<div class="rub">${esc(voie.nom)}</div>${liste}`;
}

/** L'onglet des sorts : au hameau, ceux qui s'apprennent d'abord ; puis ceux qu'il connaît. */
function ongletSorts(h: J.Heros, progresse: boolean): string {
  const voie = J.voieDe(h.carriere, h.c);
  const connus = `<div class="rub">Connus ${glose('lancés seuls en combat')}</div>${(h.c.spells ?? []).map((id) => sort(id, ficheDuSort(id).nature || 'Connu')).join('') || glose('aucun')}`;
  return progresse ? `${sortsAApprendre(h)}${connus}` : `${connus}${voie ? `<div class="rub">${esc(voie.nom)}</div>${glose(`Au hameau, la salle d’armes enseigne ${esc(voie.nom)}.`)}` : ''}`;
}

// ─── La fiche ───────────────────────────────────────────────────────────────────────────────────────────────

function identite(ctx: Contexte, h: J.Heros, o: Offres, progresse: boolean) {
  const { e } = ctx;
  const c = h.c;
  const progression = progresse ? `${bourseDePX(h, o)}${niveauSuivant(e, h, o)}` : e.expedition ? '' : glose('Relevez la salle d’armes pour dépenser les PX.');
  const refusDeRenvoi = J.refusDeRenvoi(e, h);
  const renvoi = e.expedition ? '' : `<div class="gestes-ident">${refusDeRenvoi ? glose(esc(refusDeRenvoi)) : ctx.congediement === c.id
    ? `${plaque('Confirmer le renvoi', `data-a="congedier-ok" data-id="${c.id}"`, { taille: 'petite', armee: true })}${plaque('Garder', 'data-a="congedier-non"', { taille: 'petite' })}`
    : `<button type="button" class="lien" data-a="congedier" data-id="${c.id}">Renvoyer de la compagnie · prime ${J.primeDeDepart(h)} CO</button>`}</div>`;
  return `<div class="tete">${portraitDeHeros(h, 'grand')}<div class="q"><div class="nom-propre moyen gothique">${esc(c.label)}</div>
    <div class="l">${esc(J.nomDEspece(h.espece))}</div><div class="l">${esc(carriereDe(h))}</div><div class="l">Destin ${c.fate ?? 0} · ${h.expeditions} expédition${h.expeditions > 1 ? 's' : ''}</div></div></div>
    ${glose(esc(J.deviseDe(h.carriere)))}${ligneDeVie(c)}${h.sejour ? sejourDe(h.sejour) : ''}${etats(c)}${etiquettesDeSequelles(c)}${progression}${renvoi}`;
}

/** En route : les provisions du héros et sa prière, en entrées. */
function entreDeuxSalles(e: J.Etat, h: J.Heros) {
  const provisions = J.provisionsPortees(h).map((q) => entree({
    icone: iconeDeProvision(q.id), nom: q.label, etat: `×${q.nombre}`, ferme: !!q.refus, apercu: { ...apercuDeProvision(q.id), ...(q.refus ? { pied: q.refus } : {}) },
    action: plaque('Utiliser', `data-a="utiliser" data-id="${h.c.id}" data-k="${q.uid}"`, { taille: 'petite', fermee: !!q.refus, armee: !q.refus }),
  })).join('');
  const priere = (h.c.spells ?? []).includes('benediction-de-guerison') ? (() => {
    const f = ficheDuSort('benediction-de-guerison');
    const blesses = J.herosDuGroupe(e).filter((x) => x.c.wounds.current < x.c.wounds.max);
    const refus = !J.peutPrier(e, h) ? 'Déjà priée pendant cette expédition.' : blesses.length ? '' : 'Personne n’est blessé.';
    return `<div class="rub">${esc(f.label)} ${glose('une fois par expédition')}</div>${refus ? glose(refus) : blesses.map((x) => entree({
      icone: 'soin', nom: x.c.label, etat: `${Math.max(0, x.c.wounds.current)} / ${x.c.wounds.max} Blessures`, apercu: { nom: f.label, nature: f.nature, texte: f.texte },
      action: plaque('Prier', `data-a="prier" data-id="${h.c.id}" data-k="${x.c.id}"`, { taille: 'petite', armee: true }),
    })).join('')}`;
  })() : '';
  return `<div class="rub">Provisions ${glose('utilisables entre deux salles')}</div>${provisions || glose('Aucune provision : le relais en vend au départ.')}${priere}`;
}

function panneauGauche(e: J.Etat, h: J.Heros, o: Offres, enRoute: boolean, progresse: boolean) {
  if (enRoute) return entreDeuxSalles(e, h);
  if (!progresse) return glose(e.expedition ? 'Ce héros attend au hameau.' : 'Relevez la salle d’armes pour augmenter les Compétences.');
  return `<div class="defile">${competences(h, o)}</div>`;
}

/** Les Talents : au hameau, ceux du niveau à acheter ; sinon ceux qu'il porte. Seuls ceux qui agissent en combat. */
function ongletTalents(e: J.Etat, h: J.Heros, o: Offres, progresse: boolean) {
  if (progresse) return `<div class="rub">Du niveau ${glose('ceux qui agissent en combat')}</div>${talentsDuNiveau(h, o)}`;
  const acquis = talentsAcquis(h.c);
  const autres = acquis.filter((t) => !t.combat).length;
  return `<div class="rub">Acquis ${glose('ceux qui agissent en combat')}</div>${acquis.filter((t) => t.combat).map((t) => entree({
    icone: 'etoile', nom: t.label, etat: t.fois > 1 ? `Acquis ×${t.fois}` : 'Acquis', acquis: true, apercu: { nom: t.label, nature: 'Talent', texte: texteDuTalent(t.id) },
  })).join('')}${autres ? glose(`Et ${autres} autre${autres > 1 ? 's' : ''}, sans effet en combat.`) : ''}
    ${glose(e.expedition ? 'Les Talents s’achètent au hameau.' : 'Relevez la salle d’armes pour en apprendre d’autres.')}`;
}

/** L'équipement : quatre cases (mains, arme à distance, armure), l'encombrement, le sac. */
function ongletEquipement(e: J.Etat, h: J.Heros) {
  const p = J.panoplie(h);
  const deuxMains = p.main?.mains === 2 && !p.secondaire;
  const zones = `PA · ${protection(h.c).map((z) => `${z.zone} ${z.pa}`).join(' · ')}`;
  const piece = (titre: string, x: J.PieceDecrite | undefined, icone: string, mesures = '') => { const a = x && apercuDePiece(titre, x); return caseObjet({ icone: x ? icone : undefined, nom: x ? x.label : titre, apercu: a ? { ...a, texte: [mesures, a.texte].filter(Boolean).join('\n') } : { nom: titre, texte: 'Vide.' }, taille: 'grande' }); };
  const sac = casesDuSac(h, !!e.expedition?.groupe.includes(h.c.id));
  return `<div class="rub">Porté ${glose('le détail au survol')}</div>
    <div class="cases-equipement">${piece('Main principale', p.main, iconeDArme(p.main?.label ?? ''))}
      ${deuxMains ? caseObjet({ nom: 'Prise à deux mains', apercu: { nom: 'Main secondaire', texte: 'Prise par l’arme à deux mains.' }, taille: 'grande' }) : piece('Main secondaire', p.secondaire, iconeDArme(p.secondaire?.label ?? ''))}
      ${piece('À distance', p.tir, iconeDArme(p.tir?.label ?? ''), p.tir?.munitions ? `${p.tir.munitions.label} × ${p.tir.munitions.nombre}` : '')}
      ${piece('Armure', p.armure, 'armure', zones)}</div>
    <div class="essentiels">${[p.main, p.tir].map((x) => (x ? `<span>${esc(`${x.label} · ${essentielDe(x)}`)}</span>` : '')).join('')}<span>${esc(zones)}</span></div>
    ${encombrementDe(h.c)}
    <div class="rub">Sac</div><div class="cases-sac">${sac || glose('Aucune provision : le relais en vend au départ.')}</div>
    ${e.expedition ? '' : `<div class="pied-equipement">${plaque('Aller à la forge', `data-a="batiment" data-id="forge" data-client="${h.c.id}"`, { icone: 'enclume', taille: 'petite', armee: true })}</div>`}`;
}

export function ecranDuHeros(ctx: Contexte, id: string, onglet: Onglet | null): string {
  const { e } = ctx;
  const h = e.roster.find((x) => x.c.id === id);
  if (!h) return '';
  const enRoute = !!e.expedition?.groupe.includes(h.c.id);
  const progresse = !e.expedition && J.niveauMaximal(e) > 0;
  const o = J.offresDeCarriere(h);
  const lanceur = !!J.voieDe(h.carriere, h.c) || (h.c.spells ?? []).length > 0;
  const noms: [Onglet, string][] = [['talents', 'Talents'], ...(lanceur ? [['sorts', 'Sorts'] as [Onglet, string]] : []), ['equipement', 'Équipement']];
  const actif: Onglet = onglet && noms.some(([k]) => k === onglet) ? onglet : progresse ? 'talents' : 'equipement';
  const droite = actif === 'talents' ? ongletTalents(e, h, o, progresse) : actif === 'sorts' ? ongletSorts(h, progresse) : ongletEquipement(e, h);
  return ecran({
    nom: h.c.label,
    cadres: `${cadreA(CADRES.identite, identite(ctx, h, o, progresse), { classe: 'ident' })}
      ${cadreA(CADRES.bande, caracteristiques(h, o, progresse, true), { ruban: 'Caractéristiques', classe: 'bande' })}
      ${cadreA(CADRES.gauche, panneauGauche(e, h, o, enRoute, progresse), { ruban: enRoute ? 'Entre deux salles' : 'Compétences', classe: 'competences' })}
      ${cadreA(CADRES.droite, droite, { classe: 'droite', tete: onglets(noms, actif) })}`,
    socle: { heros: enRoute ? J.herosDuGroupe(e) : e.roster, geste: 'heros', choisi: (x) => x.c.id === h.c.id, progresse: (x) => J.peutProgresser(e, x) },
  });
}
