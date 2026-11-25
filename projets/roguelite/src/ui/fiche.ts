/**
 * La fiche du héros, au gabarit commun (`./ecran`) et à la disposition de la fiche des maquettes : l'identité, la
 * bande des Caractéristiques, les Compétences (ou, en route, ce qui se fait entre deux salles), Talents, Sorts et
 * Équipement en onglets. Talents, sorts, provisions et prières sont des entrées (`entree`), armes et armures des cases
 * (`caseObjet`), toutes avec leur aperçu. Ce qui s'achète en PX est un bloc unique (`progressionDuHeros`), que la
 * salle d'armes (`./services`) et l'onglet Progression de la fiche posent tels quels.
 */
import * as J from '../jeu';
import {
  carac,
  ficheDeCompetence,
  ficheDuSort,
  libelleDeCarac,
  nomDeCarriere,
  PAS,
  prixDuSort,
  protection,
  talentsAcquis,
  texteDeCarac,
  texteDuTalent,
  type CharKey,
  type EtapeDuPlan,
  type Exigence,
} from '../noyau';
import { picto, plaque } from '../kit';
import { CADRES, CADRES_DE_L_HOTE, ecran } from './ecran';
import {
  achat, apercuDe, apercuDePiece, apercuDeProvision, type Apercu, cadreA, carriereDe, caseObjet, casesDuSac, encombrementDe, entree, esc, essentielDe, etats, herosEnTete, portraitDeHeros,
  etiquettesDeSequelles, etiquettesDeSouillure, glose, iconeDArme, iconeDeProvision, ligneDeVie, onglets, sejourDe,
} from './pieces';

export type Onglet = 'progression' | 'talents' | 'sorts' | 'equipement';
/** Ce que la fiche lit de l'interface : l'état du jeu, et le héros dont on confirme le renvoi. */
export interface Contexte { e: J.Etat; congediement: string | null }
type Offres = ReturnType<typeof J.offresDeCarriere>;

const CARACS_DU_PROFIL: CharKey[] = ['capacite-de-combat', 'capacite-de-tir', 'force', 'endurance', 'initiative', 'agilite', 'dexterite', 'intelligence', 'force-mentale', 'sociabilite'];
/** Les Caractéristiques dont le Bonus compte en combat : Dégâts, Blessures. */
const CARACS_A_BONUS: ReadonlySet<CharKey> = new Set(['force', 'endurance', 'force-mentale']);
const coche = (fait: boolean) => (fait ? `<i class="trou plein">${picto('coche', 14, 2.4)}</i>` : '<i class="trou"></i>');
const exige = (fait: boolean, texte: string, compte = '') => `<div class="exige">${coche(fait)}<span>${texte}</span>${compte ? `<span class="cpt chiffres">${compte}</span>` : ''}</div>`;

/** Les points d'une Caractéristique ou d'une Compétence de carrière tiennent-ils l'exigence `completion` du niveau ? */
const tient = (points: number, x: Exigence | null): boolean => x?.type === 'completion' && points >= x.points;

/** La marque des points, la même pour Caractéristiques et Compétences : sous l'exigence `completion`, un cran par pas
 *  de +5 qu'elle exige, chacun rempli à sa part ; sinon, les points. */
const marqueDesPoints = (points: number, x: Exigence | null) => (x?.type !== 'completion' ? `<span class="points chiffres">+${points}</span>`
  : `<span class="crans" role="img" aria-label="+${points} sur +${x.points}">${Array.from({ length: x.points / PAS }, (_, i) => {
    const part = Math.max(0, Math.min(PAS, points - i * PAS)) / PAS;
    return part >= 1 ? '<i class="plein"></i>' : part > 0 ? `<i style="--part:${part * 100}%"></i>` : '<i></i>';
  }).join('')}</span>`);

/** Ce qu'un avancement change en combat (`J.effetDeLAvancement`), une ligne par valeur qui bouge : chaque Test et l'écart
 *  de ses chances, le Bonus des Caractéristiques qui comptent en combat, les Blessures. */
function lignesDeLEffet(h: J.Heros, a: J.Avancement): string[] | null {
  const effet = J.effetDeLAvancement(h, a);
  if (!effet) return null;
  const bouge = (x: { avant: number; apres: number }) => x.avant !== x.apres;
  const ecart = (x: { avant: number; apres: number }) => `${x.apres > x.avant ? '+' : '−'}${Math.abs(x.apres - x.avant)}`;
  return [
    ...effet.tests.filter(bouge).map((t) => `${t.label} ${t.avant} → ${t.apres}${bouge(t.chances) ? ` : ${ecart(t.chances)} % de chances${t.attaque ? ' de toucher' : ''}` : ''}`),
    ...effet.bonus.filter((b) => CARACS_A_BONUS.has(b.id) && bouge(b)).map((b) => `Bonus de ${libelleDeCarac(b.id).label} ${b.avant} → ${b.apres}`),
    ...(bouge(effet.blessures) ? [`Blessures ${effet.blessures.avant} → ${effet.blessures.apres}`] : []),
  ];
}

/** Le geste d'un pas (« +gain · prix ») : ce qu'il achète (`J.pasDe`), et en aperçu ce qu'il change en combat
 *  (`lignesDeLEffet`). */
function pasAAcheter(h: J.Heros, cible: J.CibleDuPas, nom: string): string {
  const pas = J.pasDe(h, cible);
  const lignes = lignesDeLEffet(h, cible);
  if (!pas || !lignes) return '';
  const cibleAttrs = cible.genre === 'carac' ? `data-g="carac" data-k="${cible.id}"` : `data-g="competence" data-k="${cible.ref.id}"${cible.ref.spec ? ` data-s="${esc(cible.ref.spec)}"` : ''}`;
  const apercu = apercuDe({ nom: `${nom} +${pas.points}`, nature: `${pas.fois} Augmentation${pas.fois > 1 ? 's' : ''} · ${pas.prix} PX`, texte: lignes.join('\n') || 'Aucun Test de combat ne change.' });
  return achat({ verbe: `+${pas.points}`, prix: pas.prix, monnaie: 'PX', avoir: h.c.xp ?? 0, attrs: `data-a="pas" data-id="${h.c.id}" ${cibleAttrs}${apercu}`, taille: 'petite' });
}

// ─── Ce qui s'achète en PX ──────────────────────────────────────────────────────────────────────────────────

/** Les PX à dépenser, et le niveau de carrière où il en est. */
const bourseDePX = (h: J.Heros, o: Offres) =>
  `<div class="bourse-px"><div class="px laiton"><div class="chiffres">${h.c.xp ?? 0}</div></div><div><b>PX à dépenser</b>${glose(`${esc(nomDeCarriere(h.c))} · niveau ${o.niveau} : ${esc(o.titre)}`)}</div></div>`;

/** L'exigence du niveau selon le passage du modèle du héros (`Exigence`) : ses lignes, et ce qui manque encore.
 *  LDB 07 l.124-131 ; CRB 048 l.45 */
function exigencesDuNiveau(o: Offres): { lignes: string; manque: string[] } {
  const x = o.exigence;
  if (!x) return { lignes: '', manque: [] };
  if (x.type === 'cases') {
    const reste = x.seuil - x.cases;
    return { lignes: exige(o.complet, 'Cases de carrière cochées à ce niveau', `${x.cases} / ${x.seuil}`), manque: o.complet ? [] : [`${reste} case${reste > 1 ? 's' : ''} de carrière`] };
  }
  const caracsAFaire = o.caracs.filter((k) => !tient(k.points, x)).map((k) => libelleDeCarac(k.id).abr);
  const caracsFaites = o.caracs.length - caracsAFaire.length;
  const compsFaites = Math.min(x.competences, o.competences.filter((k) => tient(k.points, x)).length);
  return {
    lignes: `${exige(caracsFaites >= o.caracs.length, `${o.caracs.map((k) => esc(libelleDeCarac(k.id).abr)).join(', ')} : +${x.points} chacune`, `${caracsFaites} / ${o.caracs.length}`)}
      ${exige(compsFaites >= x.competences, `${x.competences} Compétences à +${x.points}`, `${compsFaites} / ${x.competences}`)}
      ${exige(o.talentAcquis, 'Un Talent de ce niveau')}`,
    manque: [caracsAFaire.length ? `${caracsAFaire.join(', ')} à +${x.points}` : '', compsFaites < x.competences ? `${x.competences - compsFaites} Compétence${x.competences - compsFaites > 1 ? 's' : ''} à +${x.points}` : '', o.talentAcquis ? '' : 'un Talent'].filter(Boolean),
  };
}

/** Le niveau suivant : ce qu'il exige (`exigencesDuNiveau`), où le héros en est, et son geste, ouvert par `complet`. */
function niveauSuivant(e: J.Etat, h: J.Heros, o: Offres): string {
  const suivant = o.suivant;
  if (!suivant) return glose('Sommet de la carrière.');
  const { lignes, manque } = exigencesDuNiveau(o);
  const refus = suivant.niveau > J.niveauMaximal(e) ? 'La salle d’armes n’enseigne pas encore ce niveau : agrandissez-la.' : o.complet ? null : manque.length ? `Il manque : ${manque.join(' ; ')}.` : 'Le noyau ne valide pas encore ce niveau.';
  return `<div class="rub">Niveau ${suivant.niveau} · ${esc(suivant.titre)}</div><div class="exigences">
      ${lignes}</div>
    ${achat({ verbe: `Passer ${suivant.titre}`, prix: suivant.cout, monnaie: 'PX', avoir: h.c.xp ?? 0, attrs: `data-a="niveau" data-id="${h.c.id}"`, refus })}`;
}

/** Le plan conseillé en un clic (`J.planVersLeNiveau`) : son total, et en aperçu ses étapes ; fermé avec sa raison
 *  quand les PX ne paient pas sa première étape. */
function planConseille(h: J.Heros): string {
  const { etapes, total } = J.planVersLeNiveau(h);
  if (!etapes.length) return '';
  const xp = h.c.xp ?? 0;
  const ligne = (x: EtapeDuPlan) => `${x.genre === 'carac' ? libelleDeCarac(x.id).abr : x.label}${x.genre === 'carac' || x.genre === 'competence' ? ` +${x.points}` : ''} · ${x.cout} PX`;
  const refus = xp < etapes[0].cout ? `Il faut ${etapes[0].cout} PX pour sa première étape.` : '';
  return `<div class="plan"${apercuDe({ nom: 'Le plan conseillé', nature: `${etapes.length} étape${etapes.length > 1 ? 's' : ''} · ${total} PX`, texte: etapes.map(ligne).join('\n') })}>${achat({ verbe: 'Suivre le plan', prix: total, monnaie: 'PX', avoir: xp, attrs: `data-a="plan" data-id="${h.c.id}"`, refus })}</div>`;
}

/** Les Caractéristiques en cases : celles de la carrière, cernées de laiton, portent la marque de leurs Augmentations
 *  et, à la progression (`achats`), le geste de leur pas ; `toutes` : le profil entier (la bande de la fiche). */
function caracteristiques(h: J.Heros, o: Offres, toutes: boolean, achats: boolean): string {
  const parCarac = new Map(o.caracs.map((k) => [k.id, k]));
  return (toutes ? CARACS_DU_PROFIL : o.caracs.map((k) => k.id)).map((k) => {
    const of = parCarac.get(k);
    const { abr, label } = libelleDeCarac(k);
    const cellule = `<span class="ab">${esc(abr)}</span><span class="v chiffres">${carac(h.c, k)}</span>`;
    const livre = (pied?: string) => apercuDe({ nom: label, nature: `Caractéristique · ${carac(h.c, k)}`, texte: texteDeCarac(k), ...(pied ? { pied } : {}) });
    if (!of) return `<div class="c"${livre()}>${cellule}</div>`;
    const augs = o.exigence?.type === 'completion' ? `${label} : +${of.points} sur +${o.exigence.points} pour ce niveau` : `${label} : +${of.points}`;
    return `<div class="c carr${tient(of.points, o.exigence) ? ' faite' : ''}"${livre(augs)}>${cellule}${marqueDesPoints(of.points, o.exigence)}${achats ? pasAAcheter(h, { genre: 'carac', id: k }, label) : ''}</div>`;
  }).join('');
}

/** L'aperçu d'une Compétence : son texte du livre, la valeur de son Test, et où elle sert dans le roguelite. */
const apercuDeCompetence = (k: Offres['competences'][number]): Apercu => {
  const f = ficheDeCompetence(k.ref.id);
  return { nom: k.label, nature: `Compétence · ${f.carac ? libelleDeCarac(f.carac).label : k.carac} · Test ${k.valeur}`, texte: f.texte, pied: `+${k.points}` };
};

/** Les Compétences que la salle d'armes montre (`J.competencesMontrees`), une ligne chacune : la marque de ses
 *  Augmentations, la valeur de son Test et, à la progression (`achats`), le geste de son pas. */
const competences = (h: J.Heros, o: Offres, achats: boolean) => J.competencesMontrees(h).map((k) =>
  `<div class="achat${tient(k.points, o.exigence) ? ' faite' : ''}">${k.carac ? `<span class="etiquette rectangle">${esc(k.carac)}</span>` : ''}<span class="n"${apercuDe(apercuDeCompetence(k))}>${esc(k.label)}</span>${k.pourLeNiveau ? '<span class="etiquette pour-le-niveau">pour le niveau</span>' : ''}${marqueDesPoints(k.points, o.exigence)}<span class="val chiffres" data-bulle="Valeur de son Test">${k.valeur}</span>${achats ? pasAAcheter(h, { genre: 'competence', ref: k.ref }, k.label) : ''}</div>`).join('');

/** Le geste d'un Talent du niveau (« Apprendre · prix »), et en aperçu ce qu'il change en combat (`lignesDeLEffet`) quand
 *  il bouge une valeur de combat. */
function achatDuTalent(h: J.Heros, t: Offres['talents'][number], i: number): string {
  const lignes = lignesDeLEffet(h, { genre: 'talent', ref: t.ref });
  const apercu = lignes?.length ? apercuDe({ nom: t.label, nature: `Talent · ${t.cout} PX`, texte: lignes.join('\n') }) : '';
  return achat({ verbe: t.possede ? 'Renforcer' : 'Apprendre', prix: t.cout, monnaie: 'PX', avoir: h.c.xp ?? 0, attrs: `data-a="talent" data-id="${h.c.id}" data-i="${i}"${apercu}`, taille: 'petite' });
}

/** Les Talents du niveau qui agissent en combat : acquis, ou à apprendre. */
const talentsDuNiveau = (h: J.Heros, o: Offres) => o.talents.map((t, i) => entree({
  icone: t.possede ? 'etoile' : 'livre', nom: t.label, etat: t.possede ? `Acquis${t.possede > 1 ? ` ×${t.possede}` : ''}` : 'À apprendre', acquis: t.possede > 0,
  apercu: { nom: t.label, nature: 'Talent', texte: texteDuTalent(t.ref.id) },
  ...(t.auMaxi ? {} : { action: achatDuTalent(h, t, i) }),
})).join('');

const sort = (id: string, etat: string, action?: string) => { const f = ficheDuSort(id); return entree({ icone: 'feu', nom: f.label, etat, acquis: !action, apercu: { nom: f.label, nature: f.nature, texte: f.texte }, action }); };

/** Les sorts que la voie du héros lui ouvre, à apprendre : chacun avec son prix ; avant le Talent de la voie, ce
 *  qui les ouvrira. */
function sortsAApprendre(h: J.Heros): string {
  const voie = J.voieDe(h.carriere, h.c);
  if (!voie) return '';
  const appris = h.c.talents.some((t) => t.talentId === voie.talent);
  const liste = !appris ? glose(`Au niveau 2, le Talent ${esc(voie.nom)} ouvre ces sorts.`) : J.sortsProposes(h).map((id) => {
    const prix = prixDuSort(h.c, id);
    return sort(id, 'À apprendre', prix == null ? plaque('Apprendre', '', { taille: 'petite', fermee: true, titre: 'Ce héros ne peut pas l’apprendre.' })
      : achat({ verbe: 'Apprendre', prix, monnaie: 'PX', avoir: h.c.xp ?? 0, attrs: `data-a="sort" data-id="${h.c.id}" data-k="${id}"`, taille: 'petite' }));
  }).join('') || glose(voie.sorts.every((s) => (h.c.spells ?? []).includes(s.id)) ? 'Tout est appris.' : 'Rien d’autre à ce niveau de carrière.');
  return `<div class="rub">${esc(voie.nom)}</div><div class="deux-colonnes">${liste}</div>`;
}

/** Le bloc de progression, unique : à gauche le héros, ses PX, son niveau suivant et le plan conseillé ; puis les
 *  Caractéristiques de carrière et les Talents du niveau ; puis, sur deux colonnes, ses Compétences et les sorts de
 *  sa voie. La salle d'armes et l'onglet Progression de la fiche le posent tel quel. */
export function progressionDuHeros(e: J.Etat, h: J.Heros): string {
  const o = J.offresDeCarriere(h);
  return `<div class="progression"><div class="porteur">${herosEnTete(h)}${bourseDePX(h, o)}${niveauSuivant(e, h, o)}${planConseille(h)}</div>
    <div class="colonne"><div class="rub">Caractéristiques</div><div class="caracs">${caracteristiques(h, o, false, true)}</div>
      <div class="rub">Talents ${glose('ceux qui agissent en combat')}</div>${talentsDuNiveau(h, o)}</div>
    <div class="colonne"><div class="rub">Compétences ${glose('celles qui servent ici')}</div><div class="deux-colonnes">${competences(h, o, true)}</div>${sortsAApprendre(h)}</div></div>`;
}

/** L'onglet des sorts : ceux qu'il connaît, et la voie que la salle d'armes enseigne. */
function ongletSorts(h: J.Heros): string {
  const voie = J.voieDe(h.carriere, h.c);
  const connus = `<div class="rub">Connus ${glose('lancés seuls en combat')}</div>${(h.c.spells ?? []).map((id) => sort(id, ficheDuSort(id).nature || 'Connu')).join('') || glose('aucun')}`;
  return `${connus}${voie ? `<div class="rub">${esc(voie.nom)}</div>${glose(`Au hameau, la salle d’armes enseigne ${esc(voie.nom)}.`)}` : ''}`;
}

// ─── La fiche ───────────────────────────────────────────────────────────────────────────────────────────────

function identite(ctx: Contexte, h: J.Heros, progresse: boolean) {
  const { e } = ctx;
  const c = h.c;
  const progression = progresse || e.expedition ? '' : glose('Relevez la salle d’armes pour dépenser les PX.');
  const refusDeRenvoi = J.refusDeRenvoi(e, h);
  const renvoi = e.expedition ? '' : `<div class="gestes-ident">${refusDeRenvoi ? glose(esc(refusDeRenvoi)) : ctx.congediement === c.id
    ? `${plaque('Confirmer le renvoi', `data-a="congedier-ok" data-id="${c.id}"`, { taille: 'petite', armee: true })}${plaque('Garder', 'data-a="congedier-non"', { taille: 'petite' })}`
    : `<button type="button" class="lien" data-a="congedier" data-id="${c.id}">Renvoyer de la compagnie</button>`}</div>`;
  return `<div class="tete">${portraitDeHeros(h, 'grand')}<div class="q"><div class="nom-propre moyen gothique">${esc(c.label)}</div>
    <div class="l">${esc(J.nomDEspece(h.espece))}</div><div class="l">${esc(carriereDe(h))}</div><div class="l">Destin ${c.fate ?? 0} · ${h.expeditions} expédition${h.expeditions > 1 ? 's' : ''}</div></div></div>
    ${glose(esc(J.deviseDe(h.carriere)))}${ligneDeVie(c)}${h.sejour ? sejourDe(h.sejour) : ''}${etats(c)}${etiquettesDeSequelles(c)}${etiquettesDeSouillure(c)}${progression}${renvoi}`;
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
  return `<div class="defile">${competences(h, o, false)}</div>`;
}

/** Les Talents qu'il porte, seuls ceux qui agissent en combat ; hors du hameau ou salle fermée, où les apprendre. */
function ongletTalents(e: J.Etat, h: J.Heros, progresse: boolean) {
  const acquis = talentsAcquis(h.c);
  const autres = acquis.filter((t) => !t.combat).length;
  return `<div class="rub">Acquis ${glose('ceux qui agissent en combat')}</div>${acquis.filter((t) => t.combat).map((t) => entree({
    icone: 'etoile', nom: t.label, etat: t.fois > 1 ? `Acquis ×${t.fois}` : 'Acquis', acquis: true, apercu: { nom: t.label, nature: 'Talent', texte: texteDuTalent(t.id) },
  })).join('')}${autres ? glose(`Et ${autres} autre${autres > 1 ? 's' : ''}, sans effet en combat.`) : ''}
    ${progresse ? '' : glose(e.expedition ? 'Les Talents s’achètent au hameau.' : 'Relevez la salle d’armes pour en apprendre d’autres.')}`;
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

/** La fiche : quand la salle d’armes est ouverte au héros, l’onglet Progression pose son bloc à la place de la salle
 *  d’armes (`CADRES_DE_L_HOTE.batiment`), étiré comme elle. */
export function ecranDuHeros(ctx: Contexte, id: string, onglet: Onglet | null): string {
  const { e } = ctx;
  const h = e.roster.find((x) => x.c.id === id);
  if (!h) return '';
  const enRoute = !!e.expedition?.groupe.includes(h.c.id);
  const progresse = !e.expedition && J.niveauMaximal(e) > 0;
  const o = J.offresDeCarriere(h);
  const lanceur = !!J.voieDe(h.carriere, h.c) || (h.c.spells ?? []).length > 0;
  const noms: [Onglet, string][] = [...(progresse ? [['progression', 'Progression'] as [Onglet, string]] : []), ['talents', 'Talents'], ...(lanceur ? [['sorts', 'Sorts'] as [Onglet, string]] : []), ['equipement', 'Équipement']];
  const actif: Onglet = onglet && noms.some(([k]) => k === onglet) ? onglet : progresse ? 'progression' : 'equipement';
  const droite = actif === 'talents' ? ongletTalents(e, h, progresse) : actif === 'sorts' ? ongletSorts(h) : ongletEquipement(e, h);
  return ecran({
    nom: h.c.label,
    cadres: actif === 'progression' ? cadreA(CADRES_DE_L_HOTE.batiment, progressionDuHeros(e, h), { classe: 'progresser', tete: onglets(noms, actif), etire: true })
      : `${cadreA(CADRES.identite, identite(ctx, h, progresse), { classe: 'ident' })}
      ${cadreA(CADRES.bande, caracteristiques(h, o, true, false), { ruban: 'Caractéristiques', classe: 'bande' })}
      ${cadreA(CADRES.gauche, panneauGauche(e, h, o, enRoute, progresse), { ruban: enRoute ? 'Entre deux salles' : 'Compétences', classe: 'competences' })}
      ${cadreA(CADRES.droite, droite, { classe: 'droite', tete: onglets(noms, actif) })}`,
    socle: { heros: enRoute ? J.herosDuGroupe(e) : e.roster, geste: 'heros', choisi: (x) => x.c.id === h.c.id, progresse: (x) => J.peutProgresser(e, x) },
  });
}
