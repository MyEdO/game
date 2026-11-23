/**
 * La fiche du héros, au gabarit commun (`./ecran`) et à la disposition de la fiche des maquettes : l'identité et ce
 * que son niveau exige, la bande des Caractéristiques, les Compétences (ou, en route, ce qui se fait entre deux
 * salles), Talents, Sorts et Équipement en onglets. Talents, sorts, provisions et prières sont des entrées
 * (`entree`), armes et armures des cases (`caseObjet`), toutes avec leur aperçu.
 */
import * as J from '../jeu';
import { carac, ficheDuSort, libelleDeCarac, talentsAcquis, texteDuTalent, type CharKey } from '../noyau';
import { picto, plaque, portrait } from '../kit';
import { CADRES, ecran } from './ecran';
import {
  apercuDePiece, apercuDeProvision, busteDuHeros, cadreA, caseObjet, casesDuSac, encombrementDe, entree, esc, essentielDe, etats,
  etiquettesDeSequelles, glose, iconeDArme, iconeDeProvision, ligneDeVie, onglets,
} from './pieces';

export type Onglet = 'talents' | 'sorts' | 'equipement';
/** Ce que la fiche lit de l'interface : l'état du jeu, et le héros dont on confirme le renvoi. */
export interface Contexte { e: J.Etat; congediement: string | null }
type Offres = ReturnType<typeof J.offresDeCarriere>;

const CARACS_DU_PROFIL: CharKey[] = ['capacite-de-combat', 'capacite-de-tir', 'force', 'endurance', 'initiative', 'agilite', 'dexterite', 'intelligence', 'force-mentale', 'sociabilite'];
const coche = (fait: boolean) => (fait ? `<i class="trou plein">${picto('coche', 14, 2.4)}</i>` : '<i class="trou"></i>');
export const exige = (fait: boolean, texte: string, compte = '') => `<div class="exige">${coche(fait)}<span>${texte}</span>${compte ? `<span class="cpt chiffres">${compte}</span>` : ''}</div>`;
const prixPX = (cout: number, xp: number, attrs: string) => plaque('', attrs, { prix: `${cout} PX`, taille: 'petite', fermee: xp < cout });

/** Ce que le niveau exige pour passer au suivant, et son geste. LDB 07 l.124-131 */
export function exigencesDuNiveau(e: J.Etat, h: J.Heros, o: Offres): string {
  const xp = h.c.xp ?? 0;
  const suivant = o.suivant;
  if (!suivant) return glose('Sommet de la carrière.');
  const caracsFaites = o.caracs.filter((k) => k.augmentations >= o.requis).length;
  const compsFaites = Math.min(8, o.competences.filter((k) => k.augmentations >= o.requis).length);
  const bloque = suivant.niveau > J.niveauMaximal(e);
  return `<div class="rub">Pour passer ${esc(suivant.titre)}</div><div class="exigences">
      ${exige(caracsFaites >= o.caracs.length, `${o.requis} Augmentations par Caractéristique dorée`, `${caracsFaites} / ${o.caracs.length}`)}
      ${exige(compsFaites >= 8, `${o.requis} dans huit Compétences`, `${compsFaites} / 8`)}
      ${exige(o.talentAcquis, 'Un Talent du niveau')}</div>
    <div class="pied">${plaque(`Niveau ${suivant.niveau}`, `data-a="niveau" data-id="${h.c.id}"`, { prix: String(suivant.cout), armee: o.complet && xp >= suivant.cout && !bloque, fermee: !o.complet || xp < suivant.cout || bloque })}${bloque ? glose('La salle d’armes n’enseigne pas encore ce niveau.') : ''}</div>`;
}

function identite(ctx: Contexte, h: J.Heros, o: Offres, progresse: boolean) {
  const { e } = ctx;
  const c = h.c;
  const progression = progresse
    ? `<div class="bourse-px"><div class="px laiton"><div class="chiffres">${c.xp ?? 0}</div></div><div><b>PX à dépenser</b>${glose(`niveau ${o.niveau} : ${esc(o.titre)}`)}</div></div>${exigencesDuNiveau(e, h, o)}`
    : e.expedition ? '' : glose('Relevez la salle d’armes pour dépenser les PX.');
  const renvoi = e.expedition ? '' : `<div class="gestes-ident">${ctx.congediement === c.id
    ? `${plaque('Confirmer le renvoi', `data-a="congedier-ok" data-id="${c.id}"`, { taille: 'petite', armee: true })}${plaque('Garder', 'data-a="congedier-non"', { taille: 'petite' })}`
    : `<button type="button" class="lien" data-a="congedier" data-id="${c.id}">Renvoyer de la compagnie</button>`}</div>`;
  return `<div class="tete">${portrait(busteDuHeros(h), 'heros', 'grand')}<div class="q"><div class="nom-propre moyen gothique">${esc(c.label)}</div>
    <div class="l">${esc(J.nomDEspece(h.espece))}</div><div class="l">${esc(J.nomDeCarriere(h.carriere))}</div><div class="l">Destin ${c.fate ?? 0} · ${h.expeditions} expédition${h.expeditions > 1 ? 's' : ''}</div></div></div>
    ${glose(esc(J.deviseDe(h.carriere)))}${ligneDeVie(c)}${etats(c)}${etiquettesDeSequelles(c)}${progression}${renvoi}`;
}

/** La bande des Caractéristiques : celles de la carrière, cernées de laiton, s'augmentent d'un clic au hameau. */
function bande(h: J.Heros, o: Offres, progresse: boolean) {
  const parCarac = new Map(o.caracs.map((k) => [k.id, k]));
  const xp = h.c.xp ?? 0;
  return CARACS_DU_PROFIL.map((k) => {
    const of = parCarac.get(k);
    const { abr, label } = libelleDeCarac(k);
    const cellule = `<span class="ab">${esc(abr)}</span><span class="v chiffres">${carac(h.c, k)}</span><span class="aug chiffres">${of?.augmentations ? `+${of.augmentations}` : ''}</span>`;
    if (!of || !progresse) return `<div class="c${of ? ' carr' : ''}" data-bulle="${esc(label)}">${cellule}</div>`;
    return `<button type="button" class="c carr${of.augmentations >= o.requis ? ' faite' : ''}" data-a="carac" data-id="${h.c.id}" data-k="${k}" data-bulle="${esc(`${label} : +1 pour ${of.cout} PX`)}"${xp < of.cout ? ' disabled' : ''}>${cellule}<span class="etiquette compte ${xp >= of.cout ? 'or' : 'fer'}">${of.cout} PX</span></button>`;
  }).join('');
}

const ligneDAchat = (fait: boolean, car: string, nomme: string, droite: string) => `<div class="achat"><span class="fait">${fait ? picto('coche', 15, 2.4) : ''}</span>${car ? `<span class="etiquette rectangle">${esc(car)}</span>` : ''}<span class="n">${nomme}</span>${droite}</div>`;

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
  const xp = h.c.xp ?? 0;
  return `<div class="tete-l"><div class="rub">De la carrière ${glose('une Augmentation à la fois')}</div><span class="rub colonnes"><span>Test</span><span>Coût</span></span></div>
    <div class="defile">${o.competences.map((k, i) => ligneDAchat(k.augmentations >= o.requis, k.carac, esc(k.label), `<span class="aug chiffres">+${k.augmentations}</span><span class="val chiffres">${k.valeur}</span>${prixPX(k.cout, xp, `data-a="competence" data-id="${h.c.id}" data-i="${i}"`)}`)).join('')}</div>`;
}

/** Les Talents : au hameau, ceux du niveau à acheter ; sinon ceux qu'il porte. Seuls ceux qui agissent en combat. */
function ongletTalents(e: J.Etat, h: J.Heros, o: Offres, progresse: boolean) {
  const xp = h.c.xp ?? 0;
  if (progresse) {
    return `<div class="rub">Du niveau ${glose('ceux qui agissent en combat')}</div>${o.talents.map((t, i) => entree({
      icone: t.possede ? 'etoile' : 'livre', nom: t.label, etat: t.possede ? `Acquis${t.possede > 1 ? ` ×${t.possede}` : ''}` : 'À apprendre', acquis: t.possede > 0,
      apercu: { nom: t.label, nature: `Talent · ${t.cout} PX`, texte: texteDuTalent(t.ref.id) }, action: prixPX(t.cout, xp, `data-a="talent" data-id="${h.c.id}" data-i="${i}"`),
    })).join('')}`;
  }
  const acquis = talentsAcquis(h.c);
  const autres = acquis.filter((t) => !t.combat).length;
  return `<div class="rub">Acquis ${glose('ceux qui agissent en combat')}</div>${acquis.filter((t) => t.combat).map((t) => entree({
    icone: 'etoile', nom: t.label, etat: t.fois > 1 ? `Acquis ×${t.fois}` : 'Acquis', acquis: true, apercu: { nom: t.label, nature: 'Talent', texte: texteDuTalent(t.id) },
  })).join('')}${autres ? glose(`Et ${autres} autre${autres > 1 ? 's' : ''}, sans effet en combat.`) : ''}
    ${glose(e.expedition ? 'Les Talents s’achètent au hameau.' : 'Relevez la salle d’armes pour en apprendre d’autres.')}`;
}

/** Les sorts : ceux qu'il connaît, puis ceux que sa voie ouvre. */
function ongletSorts(h: J.Heros, progresse: boolean) {
  const voie = J.voieDe(h.carriere);
  const sort = (id: string, etat: string, action?: string) => { const f = ficheDuSort(id); return entree({ icone: 'feu', nom: f.label, etat, acquis: !action, apercu: { nom: f.label, nature: f.nature, texte: f.texte }, action }); };
  const connus = (h.c.spells ?? []).map((id) => sort(id, ficheDuSort(id).nature || 'Connu')).join('');
  const initie = !!voie && h.c.talents.some((t) => t.talentId === voie.talent);
  const aApprendre = voie && initie ? voie.sorts.filter((id) => !(h.c.spells ?? []).includes(id)) : [];
  const voieHtml = !voie ? '' : !progresse ? glose(`Au hameau, la salle d’armes enseigne ${esc(voie.nom)}.`)
    : !initie ? glose(`Au niveau 2, le Talent ${esc(voie.nom)} ouvre ces sorts.`)
    : aApprendre.map((id) => sort(id, 'À apprendre', plaque('Apprendre', `data-a="sort" data-id="${h.c.id}" data-k="${id}"`, { taille: 'petite' }))).join('') || glose('Tout est appris.');
  return `<div class="rub">Connus ${glose('lancés seuls en combat')}</div>${connus || glose('aucun')}${voie ? `<div class="rub">${esc(voie.nom)}</div>${voieHtml}` : ''}`;
}

/** L'équipement : trois cases (mains, armure), l'encombrement, le sac. */
function ongletEquipement(e: J.Etat, h: J.Heros) {
  const p = J.panoplie(h);
  const deuxMains = p.main?.mains === 2 && !p.secondaire;
  const piece = (titre: string, x: J.PieceDecrite | undefined, icone: string) => caseObjet({ icone: x ? icone : undefined, nom: x ? x.label : titre, apercu: x ? apercuDePiece(titre, x) : { nom: titre, texte: 'Vide.' }, taille: 'grande' });
  const sac = casesDuSac(h, !!e.expedition?.groupe.includes(h.c.id));
  return `<div class="rub">Porté ${glose('le détail au survol')}</div>
    <div class="cases-equipement">${piece('Main principale', p.main, iconeDArme(p.main?.label ?? ''))}
      ${deuxMains ? caseObjet({ nom: 'Prise à deux mains', apercu: { nom: 'Main secondaire', texte: 'Prise par l’arme à deux mains.' }, taille: 'grande' }) : piece('Main secondaire', p.secondaire, iconeDArme(p.secondaire?.label ?? ''))}
      ${piece('Armure', p.armure, 'armure')}</div>
    <div class="essentiels">${[p.main, p.armure].filter((x): x is J.PieceDecrite => !!x).map((x) => `<span>${esc(essentielDe(x))}</span>`).join('')}</div>
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
  const lanceur = !!J.voieDe(h.carriere) || (h.c.spells ?? []).length > 0;
  const noms: [Onglet, string][] = [['talents', 'Talents'], ...(lanceur ? [['sorts', 'Sorts'] as [Onglet, string]] : []), ['equipement', 'Équipement']];
  const actif: Onglet = onglet && noms.some(([k]) => k === onglet) ? onglet : progresse ? 'talents' : 'equipement';
  const droite = actif === 'talents' ? ongletTalents(e, h, o, progresse) : actif === 'sorts' ? ongletSorts(h, progresse) : ongletEquipement(e, h);
  return ecran({
    nom: h.c.label,
    cadres: `${cadreA(CADRES.identite, identite(ctx, h, o, progresse), { classe: 'ident' })}
      ${cadreA(CADRES.bande, bande(h, o, progresse), { ruban: 'Caractéristiques', classe: 'bande' })}
      ${cadreA(CADRES.gauche, panneauGauche(e, h, o, enRoute, progresse), { ruban: enRoute ? 'Entre deux salles' : 'Compétences', classe: 'competences' })}
      ${cadreA(CADRES.droite, droite, { classe: 'droite', tete: onglets(noms, actif) })}`,
    socle: { heros: enRoute ? J.herosDuGroupe(e) : e.roster, geste: 'heros', choisi: (x) => x.c.id === h.c.id, progresse: (x) => J.peutProgresser(e, x) },
  });
}
