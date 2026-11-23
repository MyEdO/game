/**
 * Les deux lieux où l'on se tient, au gabarit commun (`./ecran`, classe `lieu`) posé sur leur décor : le hameau (son
 * panorama et ses enseignes) et l'expédition (la cour du terrain, le groupe debout). Le cartouche, la route, la salle,
 * les sacs et le socle de la compagnie sont aux rectangles des maquettes, les mêmes que ceux des services et de la
 * fiche : rien ne saute d'un écran à l'autre. Un service ouvert se pose en panneau sur le hameau, une fiche couvre le
 * lieu ; un carton (récit d'une salle, Recommencer) n'y laisse que le cartouche et le socle.
 */
import * as J from '../jeu';
import { ficheDuSort, nomDeCreature, partiesDuTest, type Epreuve } from '../noyau';
import { dessinerLaCour } from '../cour';
import { figurine } from '../figures';
import { ANCRES, HAUTEUR, LARGEUR, sceneDuHameau } from '../hameau';
import { jauge, medaillon, picto, plaque, portrait, rondMuet } from '../kit';
import type { Vignette } from '../vignettes';
import { CADRES, CADRES_DE_L_HOTE, carton, ecran, TAILLES, tailleChoisie, type Socle, type Taille } from './ecran';
import { busteDuHeros, cadreA, caseObjet, casesDuSac, esc, gabaritDe, glose, herosEnLigne, place } from './pieces';
import { cartouche, PICTO_DU_BATIMENT, type PanneauDeService } from './services';

/** Un tableau de la cour du `terrain` où se tiennent les figurines des `heros` ; mis à l'échelle par `ajusterLesTableaux`. */
export function tableau(terrain: string, heros: J.Heros[], classe: string): string {
  const c = dessinerLaCour(7, 4, terrain);
  const places = heros.map((_, i) => c.centre(2 + (i % 2) * 2, i, 1));
  const figs = heros.map((h, i) => {
    const [px, py] = places[i];
    return `<div class="fig camp-heros${J.valide(h) ? '' : ' hors'}" style="left:${px - 50}px;top:${py - 130}px;z-index:${Math.round(py)}">${figurine(gabaritDe(h), 'heros')}</div>`;
  }).join('');
  const { x, y, largeur, hauteur } = c.cadrage;
  const [gx, gy] = places.length ? [places.reduce((t, p) => t + p[0], 0) / places.length, places.reduce((t, p) => t + p[1], 0) / places.length - 50] : [x + largeur / 2, y + hauteur / 2];
  return `<div class="tableau ${classe}" data-cadrage="${x} ${y} ${largeur} ${hauteur}" data-groupe="${gx} ${gy}" aria-hidden="true"><div class="cour" style="width:${c.largeur}px;height:${c.hauteur}px">${c.svg}<div class="figures">${figs}</div></div></div>`;
}

/** Où se tient le groupe d'un fond, en part de la place au-dessus du socle : entre les colonnes des cadres. */
const CENTRE_DU_GROUPE = [0.5, 0.5];
/** La hauteur d'une figurine du fond, en part de la place libre. */
const HAUTEUR_DE_FIGURINE = 0.24;

/** Cadre chaque tableau : un fond (`fond-expe`) couvre l'écran, le groupe au centre de la place libre ; une vignette
 *  tient sa cour entière. */
export function ajusterLesTableaux(): void {
  document.querySelectorAll<HTMLElement>('.tableau').forEach((t) => {
    const [x, y, l, h] = (t.dataset.cadrage ?? '').split(' ').map(Number);
    const cour = t.querySelector<HTMLElement>('.cour')!;
    const W = t.clientWidth;
    const H = t.clientHeight;
    if (!t.classList.contains('fond-expe')) {
      const k = Math.min(W / l, H / h);
      cour.style.transform = `translate(${(W - l * k) / 2}px, ${(H - h * k) / 2}px) scale(${k}) translate(${-x}px, ${-y}px)`;
      return;
    }
    const [gx, gy] = (t.dataset.groupe ?? '').split(' ').map(Number);
    const libre = H - (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--bas')) || 0);
    // Une figurine (150 px de haut) ne passe pas le quart de la place libre ; la cour couvre l'écran quand elle le peut.
    const k = Math.min(Math.max(W / l, H / h), (libre * HAUTEUR_DE_FIGURINE) / 150);
    const tx = W * CENTRE_DU_GROUPE[0] - (gx - x) * k;
    const ty = libre * CENTRE_DU_GROUPE[1] - (gy - y) * k;
    cour.style.transform = `translate(${tx}px, ${ty}px) scale(${k}) translate(${-x}px, ${-y}px)`;
  });
}

const ressources = (...e: string[]) => `<div class="ressources">${e.map((x) => `<span class="etiquette compte or">${x}</span>`).join('')}</div>`;

function enseigne(e: J.Etat, b: J.Batiment) {
  const [x, y] = ANCRES[b.id];
  const suivant = b.paliers[e.batiments[b.id] + 1];
  const peutBatir = !!suivant && e.or >= suivant.cout && e.trophees >= suivant.trophees;
  const ruine = J.enRuine(e.batiments, b.id);
  return `<button type="button" class="enseigne${ruine ? ' ruine' : ''}" style="left:${(100 * x) / LARGEUR}%;top:${(100 * y) / HAUTEUR}%" data-a="batiment" data-id="${b.id}">
    ${medaillon(PICTO_DU_BATIMENT[b.id], 'petit', ruine)}<span><span class="nom gothique">${esc(b.nom)}</span><span class="sous">${ruine ? 'en ruine' : b.role}</span></span>${peutBatir ? '<i class="pastille-batir" data-bulle="Vous pouvez bâtir"></i>' : ''}${b.id === 'temple' && !ruine && e.roster.some(J.aSoigner) ? '<i class="pastille-soins" data-bulle="Des blessés à soigner"></i>' : ''}</button>`;
}

/** Le but de la partie, sous le cartouche : l'Autel du Chaos et un losange par maître de route, plein une fois vaincu. */
function but(e: J.Etat): string {
  const maitres = J.DESTINATIONS.map((d) => `<i class="${e.bossVaincus.includes(d.id) ? 'plein' : ''}" data-bulle="${esc(d.nom)}"></i>`).join('');
  return `<div class="but"><span class="nom-propre petit gothique">${J.victoireFinale(e) ? 'L’Autel du Chaos est tombé' : 'Abattre l’Autel du Chaos'}</span><span class="niveaux" aria-label="${e.bossVaincus.length} sur ${J.DESTINATIONS.length} maîtres vaincus">${maitres}</span></div>`;
}

/** L'action du coin : partir, ou, quand personne n'est en état de partir, attendre une semaine. */
const actionDuHameau = (e: J.Etat) => `<div class="action-de-coin" ${place(CADRES['action-de-coin'])}>${J.compagnieEpuisee(e)
  ? plaque('Attendre une semaine', 'data-a="attendre"', { icone: 'lune', armee: true, titre: 'Personne n’est en état de partir : la compagnie panse ses plaies.' })
  : plaque('Partir', 'data-a="ouvrir-depart"', { icone: 'route', armee: true, taille: 'appel' })}</div>`;

/** Le hameau : son panorama et ses enseignes, et par-dessus sa scène (cartouche, dernier récit, départ, coins,
 *  socle). Un bâtiment ouvert s'y pose en grand au-dessus du socle ; une fiche le couvre ; un carton n'y laisse que
 *  le cartouche et le socle. */
export function ecranDuHameau(e: J.Etat, fiche: string, service: PanneauDeService | null, carte: string): string {
  const titre = cadreA(CADRES.cartouche, cartouche('ville', 'Grisefosse', `Hameau du Reikland · jour ${e.jour}`), { fond: '', classe: 'cartouche-lieu-fixe' });
  const socleDuHameau = { heros: e.roster, geste: 'heros', choisi: () => false, progresse: (h: J.Heros) => J.peutProgresser(e, h) };
  const scene = (!carte && fiche) || ecran({
    nom: 'Grisefosse', classe: 'lieu',
    cadres: carte ? titre + carte : service ? service.cadre : `${titre}
      <div class="recit-lieu" ${place(CADRES_DE_L_HOTE['carnet-du-hameau'])}>${ressources(`${e.or} CO`, `${e.trophees} trophée${e.trophees > 1 ? 's' : ''}`)}${but(e)}<p>${esc(e.journal[0]?.replace(/^Jour \d+ — /, '') ?? '')}</p></div>
      <div class="coins haut" ${place(CADRES_DE_L_HOTE['coins-du-hameau'])}>${rondMuet('livre', 'Chronique', 'data-a="chronique"')}${rondMuet('systeme', 'Réglages', 'data-a="reglages"')}</div>
      ${actionDuHameau(e)}`,
    socle: !carte && service ? service.socle : socleDuHameau,
    vide: 'La compagnie est vide. Engagez des voyageurs à l’auberge relais : quand la bourse est vide, l’un d’eux sert sans solde.',
  });
  return `<div class="ecran hameau">
    <div class="panorama"><div class="toile">${sceneDuHameau(e.batiments)}${fiche || carte || service ? '' : J.BATIMENTS.map((b) => enseigne(e, b)).join('')}</div></div>
    ${J.victoireFinale(e) ? '<div class="bandeau-victoire gothique">L’Autel du Chaos est tombé</div>' : ''}
    ${scene}
  </div>`;
}

export const NOM_DE_SALLE: Record<J.TypeDeSalle, string> = { combat: 'Embuscade', elite: 'Élite', camp: 'Camp', tresor: 'Cache', boss: 'Maître' };
export const PICTO_DE_SALLE: Record<J.TypeDeSalle, string> = { combat: 'duel', elite: 'bouclier', camp: 'tente', tresor: 'coffre', boss: 'couronne' };

/** Les sacs du groupe : une rangée par héros ; un clic sur une case utilise l'objet ; la Bénédiction de Guérison d'un
 *  Béni est une case de plus, une fois par expédition, sur le plus blessé. */
function sacsDuGroupe(e: J.Etat, groupe: J.Heros[]) {
  const plusBlesse = groupe.filter((x) => !x.c.dead).sort((a, b) => a.c.wounds.current / a.c.wounds.max - b.c.wounds.current / b.c.wounds.max)[0];
  const f = ficheDuSort('benediction-de-guerison');
  return `<div class="sacs">${groupe.map((h) => {
    const priere = (h.c.spells ?? []).includes('benediction-de-guerison') ? caseObjet({
      icone: 'soin', nom: f.label, apercu: { nom: f.label, nature: f.nature, texte: f.texte },
      ...(plusBlesse ? { attrs: `data-a="prier" data-id="${h.c.id}" data-k="${plusBlesse.c.id}"` } : {}),
      refus: !J.peutPrier(e, h) ? 'Déjà priée pendant cette expédition, ou le Béni est hors de combat.' : !plusBlesse || plusBlesse.c.wounds.current >= plusBlesse.c.wounds.max ? 'Personne n’est blessé.' : null,
    }) : '';
    return `<div class="sac-heros">${herosEnLigne(h)}<div class="cases-sac">${casesDuSac(h, true) + priere || glose('sac vide')}</div></div>`;
  }).join('')}</div>`;
}

/** Une pièce d'épreuve : sa marque (sceau, portrait, médaillon), sa rubrique et son corps ; avec un `geste`, un bouton. */
const pieceDEpreuve = (classe: string, marque: string, rub: string, corps: string, geste = '') =>
  `<${geste ? `button type="button" ${geste}` : 'article'} class="piece-epreuve ${classe}">${marque}<span class="dit"><span class="rub">${rub}</span>${corps}</span></${geste ? 'button' : 'article'}>`;

/** Les Blessures que coûte l'échec d'une épreuve : celles que sa branche d'échec inflige. */
function blessuresDeLEchec(ep: Epreuve): number {
  const f = ep.flux.echec;
  return f?.kind === 'effet' && f.effet.type === 'ops' ? f.effet.ops.reduce((n, o) => n + (o.op === 'wounds' && typeof o.amount === 'number' ? o.amount : 0), 0) : 0;
}

const PICTO_D_ACTION: Record<J.ActionDeSalle, string> = { fouiller: 'oeil', desarmer: 'systeme', passer: 'route' };

/** La salle à choix ouverte, en carton : son annonce, puis une pièce par action, qui est son geste — son Test
 *  (Compétence, Difficulté), ce que rapporte sa réussite et ce que coûte son échec, combien du groupe savent la
 *  tenter ; `choix` : l'action à jet qui attend son héros au socle. */
function salleAChoixEnCarton(e: J.Etat, choix: J.IdActionAJet | null): string {
  const x = e.expedition!;
  const cache = J.EPREUVES.tresor;
  const groupe = J.herosDuGroupe(e);
  const titre = (id: J.ActionDeSalle, libelle: string) => `<span class="nom-propre moyen gothique">${picto(PICTO_D_ACTION[id], 18, 1.8)}${esc(libelle)}</span>`;
  const action = (id: J.IdActionAJet) => {
    const a = cache.actions[id];
    const parties = a.epreuves.map((ep) => partiesDuTest(ep.flux));
    const savent = groupe.filter((h) => !J.refusDAction(h, id)).length;
    const cout = blessuresDeLEchec(a.epreuves[0]);
    return pieceDEpreuve(`action${choix === id ? ' choisi' : ''}`, '', `Test de ${esc(parties.map((p) => p.competence).join(' ou '))}`,
      `${titre(id, a.libelle)}<span class="difficulte">${esc(parties[0].difficulte)}</span>
      <span class="enjeu"><span class="gain">${picto('pieces', 15, 1.8)}Bourse cachée</span>${cout ? `<span class="risque">Raté −${cout} Blessures</span>` : ''}</span>
      <span class="qui-peut${savent ? '' : ' personne'}">${savent === groupe.length ? 'Tous savent le tenter' : savent ? `${savent} sur ${groupe.length} sait le tenter`.replace(/^([2-9].*) sait/, '$1 savent') : 'Personne ne sait le tenter'}</span>`,
      `data-a="action" data-k="${id}"${savent ? '' : ' disabled'}`);
  };
  const passer = pieceDEpreuve('action passer', '', 'Sans Test',
    `${titre('passer', cache.passer.libelle)}<span class="enjeu"><span>${esc(cache.passer.issue.replace(/^./, (c) => c.toUpperCase()))}</span></span>`, 'data-a="action" data-k="passer"');
  return carton({
    ruban: NOM_DE_SALLE.tresor, vignette: 'tresor', titre: cache.titre, surTitre: `${J.destinationCourante(e)!.nom} · salle ${x.index + 1} sur ${x.salles.length}`,
    texte: `<div class="recit epreuve choix"><p>${esc(cache.annonce)}</p><div class="pieces-epreuve">${(Object.keys(cache.actions) as J.IdActionAJet[]).map(action).join('')}${passer}</div></div>`,
    gestes: glose(choix ? 'Un second clic sur l’action y renonce.' : 'Choisissez une action.'),
  });
}

/** L'expédition : la cour du terrain, et par-dessus sa scène (cartouche, sacs, salle, route, socle du groupe). Une
 *  salle à choix ouverte s'y pose en carton (`salleAChoixEnCarton`) ; tant qu'aucune action n'est prise, le socle
 *  ouvre les fiches ; puis il demande qui tente l'action `choix`, chaque carte fermée disant pourquoi elle l'est. */
export function ecranDeLExpedition(e: J.Etat, fiche: string, recit: string, choix: J.IdActionAJet | null): string {
  const x = e.expedition!;
  const d = J.destinationCourante(e)!;
  const salle = x.salles[x.index];
  const groupe = J.herosDuGroupe(e);
  const valides = groupe.filter(J.valide).length;
  const aChoisir = !recit && J.salleAChoisir(e);
  const carte = aChoisir ? salleAChoixEnCarton(e, choix) : recit;
  const socle: Socle = !aChoisir || !choix ? { heros: groupe, geste: 'heros', choisi: () => false }
    : { heros: groupe, geste: 'tenter', choisi: () => false, refus: (h) => J.refusDAction(h, choix), consigne: J.EPREUVES.tresor.actions[choix].question };
  const annonce = salle.type === 'camp' ? 'Un abri se devine entre les arbres. Le groupe pourra y passer la nuit.'
    : salle.type === 'tresor' ? J.EPREUVES.tresor.annonce
    : `Devant : ${salle.ennemis.map(nomDeCreature).join(', ')}.`;
  const appel = salle.type === 'boss' ? 'Affronter le maître' : salle.type === 'camp' ? 'Camper' : salle.type === 'tresor' ? 'Approcher' : 'Engager le combat';
  const titre = cadreA(CADRES.cartouche, cartouche('route', d.nom, `Salle ${x.index + 1} sur ${x.salles.length} · jour ${e.jour + x.index}`), { fond: '', classe: 'cartouche-lieu-fixe' });
  const scene = (!recit && fiche) || ecran({
    nom: d.nom, classe: 'lieu',
    cadres: carte ? titre + carte : `${titre}
      ${cadreA(CADRES['colonne-gauche'], sacsDuGroupe(e, groupe), { ruban: 'Sacs', classe: 'colonne-sacs' })}
      ${cadreA(CADRES['colonne-droite'], `${ressources(`${x.or} CO`, `${x.trophees} trophée${x.trophees > 1 ? 's' : ''}`, `${x.px} PX chacun`)}<div class="nom-propre grand gothique">${NOM_DE_SALLE[salle.type]}</div><p class="glose consigne">${esc(annonce)}</p>
        ${valides < groupe.length ? glose(`${groupe.length - valides} héros hors de combat ne se battront pas tant qu’ils n’auront pas récupéré.`, 'avertissement') : ''}
        <div class="gestes colonne pied-salle">${plaque(appel, 'data-a="avancer"', { icone: PICTO_DE_SALLE[salle.type], armee: !!valides, fermee: !valides, taille: 'appel' })}${plaque('Rentrer au hameau', 'data-a="rentrer"', { icone: 'route' })}</div>`, { classe: 'carte-salle' })}
      <div class="coins" ${place(CADRES.coins)}>${rondMuet('livre', 'Chronique', 'data-a="chronique"')}${rondMuet('systeme', 'Réglages', 'data-a="reglages"')}</div>
      <ol class="frise-route" ${place(CADRES.frise)}>${x.salles.map((s, i) => `<li class="${s.faite ? 'faite' : ''}${i === x.index ? ' ici' : ''}" data-bulle="${NOM_DE_SALLE[s.type]}">${medaillon(PICTO_DE_SALLE[s.type], 'petit', s.faite)}</li>`).join('')}</ol>`,
    socle,
    vide: 'Personne.',
  });
  return `<div class="ecran expedition">${tableau(d.id, groupe, 'fond-expe')}${scene}</div>`;
}

/** Le récit d'une épreuve en pièces : le Test (qui le passe, sa Compétence et sa Difficulté, son issue et ses DR au sceau
 *  de cire), chaque touché à son portrait, ses Blessures avant et après et sa vie restante en jauge, la bourse prise (s'il y en a une) en
 *  couronnes ; dessous, ce qu'il advient du piège. */
function epreuveEnPieces(x: J.EpreuveDuRecit, heros: readonly J.Heros[]): string {
  const qui = (id: string) => heros.find((h) => h.c.id === id)!;
  const dr = `${x.dr >= 0 ? '+' : '−'}${Math.abs(x.dr)}`;
  let pieces = pieceDEpreuve(`test ${x.reussite ? 'reussi' : 'rate'}`, `<div class="marque-dr"><div class="sceau maitre${x.reussite ? ' reussite' : ''}"><b>${dr}</b></div><span class="rub">DR</span></div>`, `Test de ${esc(x.competence)}`,
    `<span class="nom-propre moyen gothique">${esc(qui(x.testeur).c.label)}</span><span class="issue"><span class="etiquette rectangle cire">${x.reussite ? 'Réussi' : 'Raté'}</span>${x.difficulte ? `<span class="difficulte">${esc(x.difficulte)}</span>` : ''}</span>`);
  for (const v of x.victimes) {
    const h = qui(v.id);
    pieces += pieceDEpreuve('touche', portrait(busteDuHeros(h), 'heros', 'moyen'), 'Touché·e', `<span class="nom-propre moyen gothique">${esc(h.c.label)}</span>${jauge(v.apres / Math.max(1, v.max), { taille: 'forte' })}<span class="reste"><b class="chiffres">${v.avant} → ${v.apres} / ${v.max}</b> Blessures</span>`);
  }
  if (x.or) pieces += pieceDEpreuve('bourse', '', 'Bourse cachée', `<span class="somme">${picto('pieces', 26, 1.7)}<b class="chiffres">+${x.or}</b> CO</span>`);
  return `<div class="recit epreuve"><div class="pieces-epreuve">${pieces}</div><p>${esc(x.dit)}</p></div>`;
}

/** Le récit d'une salle franchie, ou du retour, en carton : une épreuve en pièces (`heros` : le groupe, qui lui donne
 *  ses noms et ses portraits), tout autre récit en lignes ; la défaite colore sa première ligne. */
export function recitEnCarton(r: J.RecitDeSalle, o: { ruban: string; vignette: Vignette; surTitre: string }, heros: readonly J.Heros[]): string {
  return carton({
    ruban: o.ruban, vignette: o.vignette, titre: r.titre, surTitre: o.surTitre,
    texte: r.epreuve ? epreuveEnPieces(r.epreuve, heros) : `<div class="recit ${r.fin ?? ''}">${r.lignes.map((l) => `<p>${esc(l)}</p>`).join('')}</div>`,
    gestes: `${r.combat ? plaque('Revoir le combat', 'data-a="revoir"', { icone: 'oeil' }) : ''}${plaque('Continuer', 'data-a="fermer"', { armee: true })}`,
  });
}

/** Les réglages : la taille de l'interface, et Recommencer. */
export function reglagesEnCarton(): string {
  const noms: Record<Taille, string> = { petite: 'Petite', moyenne: 'Moyenne', grande: 'Grande' };
  const actuelle = tailleChoisie();
  return carton({
    ruban: 'Réglages', vignette: 'reglages', titre: 'Réglages', surTitre: 'Grisefosse',
    texte: `<div class="rub">Taille de l’interface</div><div class="gestes">${(Object.keys(TAILLES) as Taille[]).map((t) => plaque(noms[t], `data-a="taille" data-k="${t}"`, { armee: t === actuelle, taille: 'petite' })).join('')}</div>
      <div class="rub">La partie</div><div class="gestes">${plaque('Recommencer…', 'data-a="reset"', { icone: 'sablier', taille: 'petite' })}</div>`,
    gestes: plaque('Fermer', 'data-a="fermer"', { armee: true }),
  });
}

/** Recommencer : la partie effacée, ou gardée. */
export function recommencerEnCarton(): string {
  return carton({
    ruban: 'Recommencer', titre: 'Recommencer ?', surTitre: 'Grisefosse',
    vignette: 'recommencer',
    texte: '<div class="recit"><p>Le hameau, la compagnie et le Jardin de Morr seront effacés.</p></div>',
    gestes: `${plaque('Garder ma partie', 'data-a="fermer"', { armee: true })}${plaque('Tout effacer', 'data-a="reset-ok"')}`,
  });
}
