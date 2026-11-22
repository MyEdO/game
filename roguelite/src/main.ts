/**
 * L'interface de Grisefosse, habillée du kit des maquettes (`./kit`, `kit.css`). Le hameau est un lieu : sa scène
 * (`./hameau`), une enseigne par bâtiment, la compagnie en bandeau, une page sur parchemin pour ce qu'on ouvre.
 * DOM nu, un rendu complet par geste, délégation des clics par `data-a`. Le combat se rejoue pas à pas depuis les
 * relevés du noyau.
 */
import * as J from './jeu';
import { carac, encombrement, libelleDeCarac, libelleDEtat, nomDeCreature, nomDeSort, sequelles, type Coup, type IssueDuCombat, type Pas, type PionDuPlateau, type Combatant } from './combat';
import { DEGRADES_DES_FIGURINES, buste, figurine, gabaritDeCreature, gabaritDuHeros } from './figures';
import { dessinerLaCour, type Cour } from './cour';
import { cadre, jauge, medaillon, plaque, portrait, poserLesTextures, rond } from './kit';
import { ANCRES, HAUTEUR, LARGEUR, sceneDuHameau } from './hameau';

const $ = <T extends HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T;
const esc = (s: unknown) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

type Panneau = { type: 'batiment'; id: J.IdBatiment } | { type: 'heros'; id: string } | { type: 'depart'; dest: string | null; choix: Set<string> } | { type: 'chronique' };
let etat: J.Etat = J.charger() ?? J.nouvellePartie(Date.now() % 100000);
let panneau: Panneau | null = null;
let modale: { type: 'recit'; recit: J.RecitDeSalle; vignette?: J.Heros[]; terrain?: string } | { type: 'reset' } | null = null;
/** Le héros que servent la forge et le relais. */
let client: string | null = null;
let congediement: string | null = null;
let panoramaCentre = false;

function toast(msg: string | null) {
  if (!msg) return;
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(Number(t.dataset.h));
  t.dataset.h = String(window.setTimeout(() => (t.hidden = true), 2800));
}

function agir(f: () => string | null | void) {
  const err = f();
  J.sauver(etat);
  rendre();
  if (err) toast(err);
}

// ─── Portraits et tableaux ──────────────────────────────────────────────────────────────────────────────────

const gabaritDe = (h: Pick<J.Heros, 'carriere' | 'espece' | 'c'>) => gabaritDuHeros(h.carriere, h.espece, h.c.weapons.map((w) => w.label));
/** Le portrait d'un héros : le buste de sa figurine. */
const busteDuHeros = (h: Pick<J.Heros, 'carriere' | 'espece' | 'c'>) => buste(gabaritDe(h), 'heros');

/** Un tableau de la cour du `terrain` où se tiennent les figurines des `heros` ; mis à l'échelle par `ajusterLesTableaux`. */
function tableau(terrain: string, heros: J.Heros[], classe: string): string {
  const c = dessinerLaCour(7, 4, terrain);
  const figs = heros.map((h, i) => {
    const [px, py] = c.centre(2 + (i % 2) * 2, i, 1);
    return `<div class="fig camp-heros${J.valide(h) ? '' : ' hors'}" style="left:${px - 50}px;top:${py - 130}px;z-index:${Math.round(py)}">${figurine(gabaritDe(h), 'heros')}</div>`;
  }).join('');
  const { x, y, largeur, hauteur } = c.cadrage;
  return `<div class="tableau ${classe}" data-cadrage="${x} ${y} ${largeur} ${hauteur}" aria-hidden="true"><div class="cour" style="width:${c.largeur}px;height:${c.hauteur}px">${c.svg}<div class="figures">${figs}</div></div></div>`;
}

/** Cadre chaque tableau : il couvre son fond (`fond-expe`) ou tient dans sa vignette. */
function ajusterLesTableaux() {
  document.querySelectorAll<HTMLElement>('.tableau').forEach((t) => {
    const [x, y, l, h] = (t.dataset.cadrage ?? '').split(' ').map(Number);
    const couvre = t.classList.contains('fond-expe');
    const k = (couvre ? Math.max : Math.min)(t.clientWidth / l, t.clientHeight / h);
    const dx = (t.clientWidth - l * k) / 2;
    const dy = (t.clientHeight - h * k) / 2;
    t.querySelector<HTMLElement>('.cour')!.style.transform = `translate(${dx}px, ${dy}px) scale(${k}) translate(${-x}px, ${-y}px)`;
  });
}

// ─── Pièces communes ────────────────────────────────────────────────────────────────────────────────────────

const STATS = ['capacite-de-combat', 'force', 'endurance', 'initiative', 'agilite', 'force-mentale'] as const;
const croix = '<button type="button" class="croix" data-a="fermer-panneau" aria-label="Fermer">×</button>';
const page = (titre: string, corps: string) => `<aside class="page" aria-label="${esc(titre)}">${cadre(`${croix}${corps}`, { ruban: esc(titre), fond: 'parchemin', balise: 'div' })}</aside>`;
const ligneDeVie = (c: Combatant) => `<span class="vie"><span>Blessures</span><span class="chiffres">${Math.max(0, c.wounds.current)} / ${c.wounds.max}</span></span>${jauge(Math.max(0, c.wounds.current) / Math.max(1, c.wounds.max), { taille: 'forte' })}`;
const etats = (c: Combatant) => (c.conditions.length ? `<div class="etats">${c.conditions.map((e) => `<span class="etiquette rectangle cire">${esc(libelleDEtat(e.id, e.value))}</span>`).join('')}</div>` : '');
const niveaux = (n: number, max: number) => `<span class="niveaux" aria-label="palier ${n + 1} sur ${max}">${Array.from({ length: max }, (_, i) => `<i class="${i <= n ? 'plein' : ''}"></i>`).join('')}</span>`;

const enRuine = (id: J.IdBatiment) => J.enRuine(etat.batiments, id);
const PICTO_DU_BATIMENT: Record<J.IdBatiment, string> = { relais: 'chope', temple: 'soin', salle: 'epee', forge: 'enclume', cartographe: 'carte', peage: 'pieces', memorial: 'croix' };

/** L'encombrement porté, et ses pénalités au-delà de la capacité. LDB 61 l.35-40 */
function ligneDEncombrement(c: Combatant) {
  const e = encombrement(c);
  const trop = e.porte > e.capacite;
  return `<p class="encombrement${trop ? ' surcharge' : ''}">Encombrement <b class="chiffres">${e.porte} / ${e.capacite}</b>${trop ? (e.immobile ? ' · Immobilisé' : ` · Surchargé : Mouvement −${e.mouvement}, Agilité −${Math.abs(e.agilite)}`) : ''}</p>`;
}

/** Les héros entre qui choisir le client de la forge ou du relais. */
function choixDuClient(id: string) {
  return `<div class="choix-client">${etat.roster.map((h) => `<button type="button" data-a="client" data-id="${h.c.id}" title="${esc(h.c.label)}" class="${h.c.id === id ? 'choisi' : ''}">${portrait(busteDuHeros(h), 'heros', 'petit', h.c.id === id ? 'choisi' : '')}<span>${esc(h.c.label.split(' ')[0])}</span></button>`).join('')}</div>`;
}
const leClient = (): J.Heros | undefined => etat.roster.find((h) => h.c.id === client) ?? etat.roster[0];
const etal = (articles: { label: string; detail: string; prix: number; attrs: string }[]) =>
  `<ul class="etal">${articles.map((a) => `<li><span class="qui"><b>${esc(a.label)}</b><span>${esc(a.detail)}</span></span>${plaque('Acheter', a.attrs, { prix: String(a.prix), taille: 'petite', armee: etat.or >= a.prix, fermee: etat.or < a.prix })}</li>`).join('')}</ul>`;

function pageDeForge() {
  const h = leClient();
  if (!h) return '<p class="glose">Personne à équiper.</p>';
  const eq = J.equipement(h);
  return `${choixDuClient(h.c.id)}<p class="detail">En main : ${esc(eq.main ?? 'rien')}${eq.secondaire ? ` et ${esc(eq.secondaire)}` : ''} · Armure : ${esc(eq.armure ?? 'aucune')}</p>${ligneDEncombrement(h.c)}
    <div class="sous-titre">Armures</div>${etal(J.armuresEnVente(etat).map((a) => ({ label: a.label, detail: `${a.pa} PA partout · Enc. ${a.enc}`, prix: a.prix, attrs: `data-a="armure" data-id="${h.c.id}" data-k="${a.poids}"` })))}
    <div class="sous-titre">Armes</div>${etal(J.armesEnVente(etat).map((a) => ({ label: a.label, detail: `Enc. ${a.enc}`, prix: a.prix, attrs: `data-a="arme" data-id="${h.c.id}" data-k="${a.id}"` })))}
    <p class="glose">L’objet remplacé reste au forgeron. Au-delà de sa capacité, un héros surchargé perd Mouvement et Agilité.</p>`;
}

function sectionDesProvisions() {
  const h = leClient();
  if (!h) return '';
  const portees = J.provisionsPortees(h);
  return `<div class="sous-titre">Provisions</div>${choixDuClient(h.c.id)}
    <p class="detail">${portees.length ? `Dans le sac : ${portees.map((p) => `${esc(p.label)} ×${p.nombre}`).join(', ')}` : 'Le sac est vide.'}</p>
    ${etal(J.provisionsEnVente(etat).map((a) => ({ label: a.label, detail: a.desc ? a.desc.split('. ')[0] : '', prix: a.prix, attrs: `data-a="provision" data-id="${h.c.id}" data-k="${a.id}"` })))}
    <p class="glose">Chaque héros porte ses provisions et les utilise entre deux salles.</p>`;
}

function carteDeHeros(h: J.Heros, choisi: boolean) {
  const c = h.c;
  return `<button type="button" class="carte-heros${J.valide(h) ? '' : ' hors'}${choisi ? ' choisi' : ''}" data-a="heros" data-id="${c.id}">
    ${portrait(busteDuHeros(h), 'heros', 'grand', choisi ? 'choisi' : '')}
    <span class="qui"><span class="nom-propre petit gothique">${esc(c.label)}</span><span class="sous-titre">${esc(J.nomDeCarriere(h.carriere))}</span>
    ${ligneDeVie(c)}<span class="ligne-etat">${c.conditions.length ? esc(c.conditions.map((e) => libelleDEtat(e.id, e.value)).join(', ')) : J.valide(h) ? `${c.xp ?? 0} PX · Destin ${c.fate ?? 0}` : 'hors de combat'}</span></span>
  </button>`;
}

function bandeauDesHeros(heros: J.Heros[], vide: string) {
  const choisi = panneau?.type === 'heros' ? panneau.id : null;
  return `<div class="bandeau-heros">${cadre(heros.length ? `<div class="rang-heros">${heros.map((h) => carteDeHeros(h, h.c.id === choisi)).join('')}</div>` : `<p class="glose courante vide">${vide}</p>`, { balise: 'div' })}</div>`;
}

// ─── Pages du hameau ────────────────────────────────────────────────────────────────────────────────────────

function sectionBatir(b: J.Batiment) {
  const n = etat.batiments[b.id];
  const suivant = b.paliers[n + 1];
  if (!suivant) return '<p class="sous-titre acheve">Bâtiment achevé</p>';
  const peut = etat.or >= suivant.cout && etat.trophees >= suivant.trophees;
  return `<div class="batir"><div class="sous-titre">${enRuine(b.id) ? 'Relever' : 'Agrandir'}</div><p>${esc(suivant.effet)}</p>
    <p class="cout">${suivant.cout} couronnes${suivant.trophees ? ` et ${suivant.trophees} trophée${suivant.trophees > 1 ? 's' : ''}` : ''}</p>
    ${plaque(enRuine(b.id) ? 'Relever' : 'Bâtir', `data-a="ameliorer" data-id="${b.id}"`, { icone: 'enclume', armee: peut, fermee: !peut })}</div>`;
}

function listeDeHeros(action: (h: J.Heros) => string) {
  return etat.roster.length ? `<ul class="liste-h">${etat.roster.map((h) => `<li>${portrait(busteDuHeros(h), 'heros', 'petit')}<span class="qui"><b class="gothique">${esc(h.c.label)}</b><span>${esc(J.nomDeCarriere(h.carriere))} · ${Math.max(0, h.c.wounds.current)}/${h.c.wounds.max} PB · ${h.c.xp ?? 0} PX</span></span>${action(h)}</li>`).join('')}</ul>` : '<p class="glose">Personne dans la compagnie.</p>';
}

function pageDuBatiment(id: J.IdBatiment) {
  const b = J.BATIMENTS.find((x) => x.id === id)!;
  const n = etat.batiments[id];
  let corps: string;
  if (id === 'relais') {
    corps = etat.candidats.length ? `<div class="sous-titre">Voyageurs à engager</div><ul class="liste-h">${etat.candidats.map((c, i) => {
      const gratuit = etat.roster.length === 0 && etat.or < c.prix;
      return `<li>${portrait(busteDuHeros(c), 'heros', 'petit')}<span class="qui"><b class="gothique">${esc(c.c.label)}</b><span>${esc(J.nomDeCarriere(c.carriere))} · ${esc(J.nomDEspece(c.espece))} · ${c.c.wounds.max} PB · CC ${carac(c.c, 'capacite-de-combat')}</span><span class="glose">${esc(J.deviseDe(c.carriere))} ${gratuit ? 'Servira sans solde.' : `Solde : ${c.prix} couronnes.`}</span></span>${plaque('Engager', `data-a="recruter" data-i="${i}"`, { prix: gratuit ? '' : String(c.prix), taille: 'petite', armee: gratuit || etat.or >= c.prix, fermee: !gratuit && etat.or < c.prix })}</li>`;
    }).join('')}</ul>` : '<p class="glose">Personne au relais. D’autres voyageurs arriveront avec la prochaine diligence.</p>';
    corps += sectionDesProvisions();
  } else if (id === 'temple') {
    const prix = J.prixDuSoin(etat);
    const larmes = J.prixDeSequelle(etat);
    corps = prix == null ? '<p class="glose">La chapelle est en ruine : il faut la relever pour que les sœurs soignent les blessés. En attendant, seuls les héros restés au hameau se reposent.</p>'
      : `<div class="sous-titre">Les blessés</div>${listeDeHeros((h) => `<span class="gestes-h">${J.blesse(h) ? plaque('Soigner', `data-a="soigner" data-id="${h.c.id}"`, { icone: 'soin', prix: prix ? String(prix) : '', taille: 'petite', armee: etat.or >= prix }) : '<span class="glose">indemne</span>'}${larmes != null && J.sequellesGuerissables(h) ? plaque('Larmes de Shallya', `data-a="sequelle" data-id="${h.c.id}"`, { prix: String(larmes), taille: 'petite', armee: etat.or >= larmes }) : ''}</span>`)}`;
  } else if (id === 'salle') {
    corps = n === 0 ? '<p class="glose">La salle d’armes est en ruine : il faut la relever pour dépenser les PX.</p>'
      : `<div class="sous-titre">Carrières · jusqu’au niveau ${J.niveauMaximal(etat)}</div>${listeDeHeros((h) => plaque('Progresser', `data-a="heros" data-id="${h.c.id}"`, { icone: 'epee', taille: 'petite', armee: (h.c.xp ?? 0) >= 100 }))}`;
  } else if (id === 'forge') {
    corps = pageDeForge();
  } else if (id === 'cartographe') {
    corps = pageDesDestinations();
  } else if (id === 'peage') {
    corps = `<p class="glose">${n ? 'Les péagers prélèvent leur dû sur les voyageurs du pont, et versent la part de la compagnie à chaque expédition qui franchit au moins une salle.' : 'Le pont est sans barrière : aucun voyageur ne paie.'}</p>`;
  } else {
    corps = etat.cimetiere.length ? `<div class="sous-titre">${etat.cimetiere.length} tombe${etat.cimetiere.length > 1 ? 's' : ''}</div><ul class="tombes">${etat.cimetiere.map((t) => `<li><b class="gothique">${esc(t.nom)}</b><span>${esc(J.nomDeCarriere(t.carriere))}, tombé·e à ${esc(t.ou)}, jour ${t.jour}</span></li>`).join('')}</ul>` : '<p class="glose">Aucune tombe encore. Puisse-t-il en rester ainsi.</p>';
  }
  return page(b.nom, `<div class="tete-page">${medaillon(PICTO_DU_BATIMENT[id], 'grand', enRuine(id))}<div><div class="nom-propre moyen gothique">${esc(b.role)}</div>${niveaux(n, b.paliers.length)}</div></div>
    <p class="glose consigne">${esc(b.paliers[n].effet)}</p>${corps}${sectionBatir(b)}`);
}

function pageDesDestinations() {
  const fermees = J.DESTINATIONS.filter((d) => d.palier > etat.batiments.cartographe);
  return `<div class="sous-titre">Routes connues</div><ul class="destinations">${J.destinationsOuvertes(etat).map((d) => `<li>
      <div class="nom-propre petit gothique">${esc(d.nom)}${etat.bossVaincus.includes(d.id) ? ' <span class="etiquette pastille or">purgée</span>' : ''}</div>
      <p class="glose">${esc(d.recit)}</p><p class="detail">${d.salles} salles · maître : ${esc(d.boss.map(nomDeCreature).join(' et '))}</p>
      ${plaque('Préparer l’expédition', `data-a="preparer" data-id="${d.id}"`, { icone: 'route', taille: 'petite', armee: true })}</li>`).join('')}</ul>
    ${fermees.length ? `<p class="glose">${fermees.length} route${fermees.length > 1 ? 's' : ''} encore inconnue${fermees.length > 1 ? 's' : ''} : le Cartographe ouvrira celle de ${esc(fermees[0].nom)}.</p>` : ''}`;
}

function pageDuDepart(p: Extract<Panneau, { type: 'depart' }>) {
  if (!p.dest) return page('Partir', pageDesDestinations());
  const d = J.DESTINATIONS.find((x) => x.id === p.dest)!;
  return page(d.nom, `<p class="glose consigne">${esc(d.recit)} Choisissez jusqu’à quatre héros. Pendant l’expédition, seuls ceux qui restent au hameau se reposent.</p>
    <div class="choix">${etat.roster.map((h) => {
      const ok = J.valide(h);
      return `<label class="${ok ? '' : 'hors'}${p.choix.has(h.c.id) ? ' coche' : ''}"><input type="checkbox" id="pick-${h.c.id}" data-a="choisir" data-id="${h.c.id}"${p.choix.has(h.c.id) ? ' checked' : ''}${ok ? '' : ' disabled'}>
        ${portrait(busteDuHeros(h), 'heros', 'petit')}<span class="qui"><b class="gothique">${esc(h.c.label)}</b><span>${esc(J.nomDeCarriere(h.carriere))} · ${Math.max(0, h.c.wounds.current)}/${h.c.wounds.max} PB</span></span></label>`;
    }).join('') || '<p class="glose">Personne à envoyer.</p>'}</div>
    <div class="gestes">${plaque(`Partir avec ${p.choix.size} héros`, 'data-a="partir"', { icone: 'route', armee: p.choix.size > 0, fermee: !p.choix.size })}${plaque('Autre route', 'data-a="ouvrir-depart"', { taille: 'petite' })}</div>`);
}

function sectionDesSequelles(c: Combatant) {
  const l = sequelles(c);
  return l.length ? `<div class="sous-titre">Séquelles</div><ul class="sequelles">${l.map((q) => `<li title="${esc(q.desc ?? '')}"><b>${esc(q.label)}</b><span>${q.jours != null ? `${q.jours} jour${q.jours > 1 ? 's' : ''} de convalescence` : 'permanente'}</span></li>`).join('')}</ul>` : '';
}

/** Entre deux salles : les provisions du héros, et la prière de soin d'un Béni. */
function sectionDeRoute(h: J.Heros) {
  const provisions = J.provisionsPortees(h);
  const blesses = J.herosDuGroupe(etat).filter((x) => x.c.wounds.current < x.c.wounds.max);
  const benit = (h.c.spells ?? []).includes('benediction-de-guerison');
  const priere = !benit ? '' : J.peutPrier(etat, h)
    ? `<div class="sous-titre">Bénédiction de Guérison · une fois par expédition</div><div class="gestes">${blesses.length ? blesses.map((x) => plaque(`Prier pour ${x.c.label.split(' ')[0]}`, `data-a="prier" data-id="${h.c.id}" data-k="${x.c.id}"`, { icone: 'soin', taille: 'petite', armee: true })).join('') : '<span class="glose">Personne n’est blessé.</span>'}</div>`
    : '<p class="glose">A déjà prié pour soigner pendant cette expédition.</p>';
  return `<div class="sous-titre">Provisions</div>${provisions.length ? `<ul class="etal">${provisions.map((p) => `<li><span class="qui"><b>${esc(p.label)} ×${p.nombre}</b>${p.refus ? `<span>${esc(p.refus)}</span>` : ''}</span>${plaque('Utiliser', `data-a="utiliser" data-id="${h.c.id}" data-k="${p.uid}"`, { taille: 'petite', armee: !p.refus, fermee: !!p.refus })}</li>`).join('')}</ul>` : '<p class="glose">Aucune provision. Le relais en vend.</p>'}${priere}`;
}

/** La carrière du héros : Augmentations et Talents de son niveau, niveau suivant, sorts ou miracles de sa voie. */
function sectionDeCarriere(h: J.Heros) {
  if (!J.niveauMaximal(etat)) return '<p class="glose">Relevez la salle d’armes pour dépenser les PX.</p>';
  const o = J.offresDeCarriere(h);
  const xp = h.c.xp ?? 0;
  const ligne = (label: string, valeur: string, augm: number, cout: number, attrs: string) =>
    `<tr><td>${esc(label)}</td><td class="chiffres">${valeur}</td><td class="chiffres${augm >= o.requis ? ' acquis' : ''}">${augm}/${o.requis}</td><td>${plaque('+1', attrs, { prix: String(cout), taille: 'petite', fermee: xp < cout })}</td></tr>`;
  const voie = J.voieDe(h.carriere);
  const initie = voie && h.c.talents.some((t) => t.talentId === voie.talent);
  const aApprendre = voie && initie ? voie.sorts.filter((id) => !(h.c.spells ?? []).includes(id)) : [];
  const suivant = o.suivant;
  return `<div class="sous-titre">${esc(o.titre)} · niveau ${o.niveau} · ${xp} PX à dépenser</div>
    <table class="entrainement"><thead><tr><th>Caractéristique</th><th>Valeur</th><th>Augm.</th><th>PX</th></tr></thead><tbody>
    ${o.caracs.map((k) => ligne(k.label, String(k.valeur), k.augmentations, k.cout, `data-a="carac" data-id="${h.c.id}" data-k="${k.id}"`)).join('')}</tbody></table>
    <table class="entrainement"><thead><tr><th>Compétence</th><th></th><th>Augm.</th><th>PX</th></tr></thead><tbody>
    ${o.competences.map((k, i) => ligne(k.label, '', k.augmentations, k.cout, `data-a="competence" data-id="${h.c.id}" data-i="${i}"`)).join('')}</tbody></table>
    <div class="sous-titre">Talents du niveau</div><ul class="etal">${o.talents.map((t, i) => `<li><span class="qui"><b>${esc(t.label)}</b><span>${t.possede ? `acquis${t.possede > 1 ? ` ×${t.possede}` : ''}` : 'à apprendre'}</span></span>${plaque(t.possede ? 'Encore' : 'Apprendre', `data-a="talent" data-id="${h.c.id}" data-i="${i}"`, { prix: String(t.cout), taille: 'petite', fermee: xp < t.cout })}</li>`).join('')}</ul>
    ${aApprendre.length ? `<div class="sous-titre">${esc(voie!.nom)}</div><div class="gestes">${aApprendre.map((id) => plaque(`Apprendre ${nomDeSort(id)}`, `data-a="sort" data-id="${h.c.id}" data-k="${id}"`, { taille: 'petite' })).join('')}</div>` : ''}
    ${suivant ? `<div class="niveau-suivant"><span class="qui"><b>${esc(suivant.titre)}</b><span>${o.complet ? 'Niveau achevé.' : `Pour passer : ${o.requis} Augmentations dans chaque Caractéristique et dans 8 Compétences de la carrière, et un Talent du niveau.`}${suivant.niveau > J.niveauMaximal(etat) ? ' La salle d’armes n’enseigne pas encore ce niveau.' : ''}</span></span>${plaque(`Niveau ${suivant.niveau}`, `data-a="niveau" data-id="${h.c.id}"`, { prix: String(suivant.cout), taille: 'petite', armee: o.complet && xp >= suivant.cout, fermee: !o.complet || xp < suivant.cout || suivant.niveau > J.niveauMaximal(etat) })}</div>` : '<p class="glose">Sommet de la carrière.</p>'}`;
}

function pageDuHeros(id: string) {
  const h = etat.roster.find((x) => x.c.id === id);
  if (!h) return '';
  const c = h.c;
  const enRoute = !!etat.expedition?.groupe.includes(c.id);
  const prix = J.prixDuSoin(etat);
  const eq = J.equipement(h);
  const hameau = etat.expedition ? '' : `${sectionDeCarriere(h)}<div class="gestes">
    ${J.blesse(h) && prix != null ? plaque('Soigner à la chapelle', `data-a="soigner" data-id="${c.id}"`, { icone: 'soin', prix: prix ? String(prix) : '', taille: 'petite', armee: etat.or >= prix }) : ''}
    ${congediement === c.id ? `${plaque('Confirmer le renvoi', `data-a="congedier-ok" data-id="${c.id}"`, { taille: 'petite', armee: true })}${plaque('Garder', 'data-a="congedier-non"', { taille: 'petite' })}` : `<button type="button" class="lien" data-a="congedier" data-id="${c.id}">Renvoyer de la compagnie</button>`}</div>`;
  return page(c.label, `<div class="tete-page">${portrait(busteDuHeros(h), 'heros', 'grand')}<div class="qui"><div class="nom-propre moyen gothique">${esc(J.nomDeCarriere(h.carriere))}</div><div class="sous-titre">${esc(J.nomDEspece(h.espece))} · ${h.expeditions} expédition${h.expeditions > 1 ? 's' : ''}</div><p class="glose devise">${esc(J.deviseDe(h.carriere))}</p>${ligneDeVie(c)}</div></div>
    <dl class="stats">${STATS.map((k) => `<div><dt title="${esc(libelleDeCarac(k).label)}">${esc(libelleDeCarac(k).abr)}</dt><dd class="chiffres">${carac(c, k)}</dd></div>`).join('')}</dl>
    <p class="meta"><span class="etiquette pastille or">${c.xp ?? 0} PX</span><span class="etiquette pastille fer">Destin ${c.fate ?? 0}</span><span class="glose">${esc(eq.main ?? 'mains nues')}${eq.secondaire ? ` et ${esc(eq.secondaire)}` : ''} · ${esc(eq.armure ?? 'sans armure')}</span></p>
    ${ligneDEncombrement(c)}${etats(c)}${sectionDesSequelles(c)}${enRoute ? sectionDeRoute(h) : hameau}`);
}

function pageDeLaChronique() {
  return page('Chronique', `<ol class="chronique">${etat.journal.map((l) => `<li>${esc(l)}</li>`).join('')}</ol>`);
}

function pageOuverte(): string {
  if (!panneau) return '';
  if (panneau.type === 'batiment') return pageDuBatiment(panneau.id);
  if (panneau.type === 'heros') return pageDuHeros(panneau.id);
  if (panneau.type === 'depart') return pageDuDepart(panneau);
  return pageDeLaChronique();
}

// ─── Écrans ─────────────────────────────────────────────────────────────────────────────────────────────────

function enseigne(b: J.Batiment) {
  const [x, y] = ANCRES[b.id];
  const n = etat.batiments[b.id];
  const ouvert = panneau?.type === 'batiment' && panneau.id === b.id;
  const suivant = b.paliers[n + 1];
  const peutBatir = !!suivant && etat.or >= suivant.cout && etat.trophees >= suivant.trophees;
  return `<button type="button" class="enseigne${enRuine(b.id) ? ' ruine' : ''}${ouvert ? ' ouverte' : ''}" style="left:${(100 * x) / LARGEUR}%;top:${(100 * y) / HAUTEUR}%" data-a="batiment" data-id="${b.id}">
    ${medaillon(PICTO_DU_BATIMENT[b.id], 'petit', enRuine(b.id))}<span><span class="nom gothique">${esc(b.nom)}</span><span class="sous">${enRuine(b.id) ? 'en ruine' : b.role}</span></span>${peutBatir ? '<i class="pastille-batir" title="Vous pouvez bâtir"></i>' : ''}</button>`;
}

function ecranDuHameau() {
  const ouvertes = J.destinationsOuvertes(etat).length;
  return `<div class="ecran hameau">
    <div class="panorama"><div class="toile">${sceneDuHameau(etat.batiments)}${J.BATIMENTS.map(enseigne).join('')}</div></div>
    <div class="cartouche-lieu">${cadre(`<div class="cartouche">${medaillon('ville', 'grand')}<div><div class="titre gothique">Grisefosse</div><div class="sous-titre">Hameau du Reikland · jour ${etat.jour}</div></div></div>
      <div class="ressources"><span class="etiquette compte or">${etat.or} CO</span><span class="etiquette compte or">${etat.trophees} trophée${etat.trophees > 1 ? 's' : ''}</span><span class="etiquette compte fer">${etat.roster.length} héros</span></div>`, { balise: 'div' })}
      <p class="recit-lieu ombre">${esc(etat.journal[0]?.replace(/^Jour \d+ — /, '') ?? '')}</p></div>
    <div class="coin-droit">
      ${cadre(`<div class="partir"><div><div class="nom-propre petit gothique">${ouvertes} route${ouvertes > 1 ? 's' : ''} ouverte${ouvertes > 1 ? 's' : ''}</div><div class="sous-titre">${etat.bossVaincus.length} maître${etat.bossVaincus.length > 1 ? 's' : ''} vaincu${etat.bossVaincus.length > 1 ? 's' : ''}</div></div>${plaque('Choisir une route', 'data-a="ouvrir-depart"', { icone: 'route', armee: true })}</div>`, { ruban: 'Partir', balise: 'div' })}
      <div class="outils"><span class="seul-etroit">${rond('route', 'Partir', 'data-a="ouvrir-depart"')}</span>${J.compagnieEpuisee(etat) ? rond('lune', 'Attendre une semaine', 'data-a="attendre"') : ''}${rond('livre', 'Chronique', 'data-a="chronique"')}${rond('sablier', 'Recommencer', 'data-a="reset"')}</div>
    </div>
    ${J.victoireFinale(etat) ? '<div class="bandeau-victoire gothique">L’Autel du Chaos est tombé</div>' : ''}
    ${pageOuverte()}
    ${bandeauDesHeros(etat.roster, 'La compagnie est vide. Engagez des voyageurs au relais de diligence : quand la bourse est vide, l’un d’eux sert sans solde.')}
  </div>`;
}

const NOM_DE_SALLE: Record<J.TypeDeSalle, string> = { combat: 'Embuscade', elite: 'Élite', camp: 'Camp', tresor: 'Cache', boss: 'Maître' };
const PICTO_DE_SALLE: Record<J.TypeDeSalle, string> = { combat: 'epee', elite: 'bouclier', camp: 'tente', tresor: 'bourse', boss: 'couronne' };

function ecranDeLExpedition() {
  const x = etat.expedition!;
  const d = J.destinationCourante(etat)!;
  const salle = x.salles[x.index];
  const groupe = J.herosDuGroupe(etat);
  const valides = groupe.filter(J.valide).length;
  const annonce = salle.type === 'camp' ? 'Un abri se devine entre les arbres. Le groupe pourra y passer la nuit.'
    : salle.type === 'tresor' ? 'Des pierres semblent avoir été déplacées.'
    : `Devant : ${salle.ennemis.map(nomDeCreature).join(', ')}.`;
  const appel = salle.type === 'boss' ? 'Affronter le maître' : salle.type === 'camp' ? 'Camper' : salle.type === 'tresor' ? 'Fouiller' : 'Engager le combat';
  return `<div class="ecran expedition">
    ${tableau(d.id, groupe, 'fond-expe')}
    <div class="cartouche-lieu">${cadre(`<div class="cartouche">${medaillon('route', 'grand')}<div><div class="titre gothique">${esc(d.nom)}</div><div class="sous-titre">Salle ${x.index + 1} sur ${x.salles.length} · jour ${etat.jour + x.index}</div></div></div>
      <div class="ressources"><span class="etiquette compte or">${x.or} CO</span><span class="etiquette compte or">${x.trophees} trophée${x.trophees > 1 ? 's' : ''}</span><span class="etiquette compte fer">${x.px} PX chacun</span></div>`, { balise: 'div' })}</div>
    <div class="piste-cadre">${cadre(`<ol class="piste">${x.salles.map((s, i) => `<li class="${s.faite ? 'faite' : ''}${i === x.index ? ' ici' : ''}">${medaillon(PICTO_DE_SALLE[s.type], i === x.index ? 'grand' : 'moyen', s.faite)}<span class="sous-titre">${NOM_DE_SALLE[s.type]}</span></li>`).join('')}</ol>`, { balise: 'div', ruban: 'La route' })}</div>
    <div class="salle-cadre">${cadre(`<div class="nom-propre grand gothique">${NOM_DE_SALLE[salle.type]}</div><p class="glose consigne">${esc(annonce)}</p>
      <div class="gestes colonne">${plaque(appel, 'data-a="avancer"', { icone: PICTO_DE_SALLE[salle.type], armee: !!valides, fermee: !valides, taille: 'appel' })}${plaque('Rentrer au hameau', 'data-a="rentrer"', { icone: 'route' })}</div>
      ${valides < groupe.length ? `<p class="glose avertissement">${groupe.length - valides} héros hors de combat ne se battront pas tant qu’ils n’auront pas récupéré.</p>` : ''}
      <p class="glose">La fiche d’un héros donne ses provisions et, pour un Béni, sa prière de soin.</p>`, { fond: 'parchemin', balise: 'div' })}</div>
    ${pageOuverte()}
    ${bandeauDesHeros(groupe, 'Personne.')}
  </div>`;
}

function vueModale(): string {
  if (!modale) return '';
  const boite = (titre: string, corps: string) => `<div class="modale" role="dialog" aria-modal="true" aria-label="${esc(titre)}">${cadre(corps, { ruban: esc(titre), fond: 'parchemin', classe: 'boite', balise: 'div' })}</div>`;
  if (modale.type === 'reset') {
    return boite('Recommencer ?', `<p class="glose consigne">Le hameau, la compagnie et le Jardin de Morr seront effacés.</p>
      <div class="gestes">${plaque('Tout effacer', 'data-a="reset-ok"', { armee: true })}${plaque('Garder ma partie', 'data-a="fermer"')}</div>`);
  }
  const r = modale.recit;
  return boite(r.titre, `${modale.vignette ? tableau(modale.terrain ?? 'reikwald', modale.vignette, 'illustration') : ''}<div class="recit ${r.fin ?? ''}">${r.lignes.map((l) => `<p>${esc(l)}</p>`).join('')}</div>
    <div class="gestes">${r.combat ? plaque('Revoir le combat', 'data-a="revoir"', { icone: 'oeil' }) : ''}${plaque('Continuer', 'data-a="fermer"', { armee: true })}</div>`);
}

function rendre() {
  const avant = document.querySelector<HTMLElement>('.panorama')?.scrollLeft;
  $('#jeu').innerHTML = etat.expedition ? ecranDeLExpedition() : ecranDuHameau();
  $('#modale').innerHTML = vueModale();
  const pano = document.querySelector<HTMLElement>('.panorama');
  if (pano) {
    if (avant != null && panoramaCentre) pano.scrollLeft = avant;
    else { pano.scrollLeft = (pano.scrollWidth - pano.clientWidth) * 0.42; panoramaCentre = true; }
  }
  ajusterLesTableaux();
}

// ─── Rejeu du combat ────────────────────────────────────────────────────────────────────────────────────────

let rejeu: { issue: IssueDuCombat; i: number; vitesse: number; minuteur: number; fin: () => void } | null = null;

function gabaritDuPion(q: PionDuPlateau) {
  if (q.camp === 'heros') {
    const h = etat.roster.find((x) => x.c.id === q.id);
    if (h) return gabaritDuHeros(h.carriere, h.espece, h.c.weapons.map((w) => w.label));
    return gabaritDeCreature(q.creature ?? '');
  }
  return gabaritDeCreature(q.creature ?? '');
}

let cour: Cour | null = null;

/** L'échelle de la cour : elle tient dans l'écran sur un bureau ; sur un écran étroit, elle garde une taille lisible et défile. */
function mettreALEchelle() {
  const cadreCour = document.querySelector<HTMLElement>('#combat .cour-cadre');
  if (!cadreCour || !cour) return;
  const { x, y, largeur, hauteur } = cour.cadrage;
  const dispo = Math.max(240, window.innerHeight - 290);
  const k = Math.max(0.62, Math.min(1.25, (window.innerWidth - 32) / largeur, dispo / hauteur));
  cadreCour.style.setProperty('--k', String(k));
  cadreCour.style.width = `${largeur * k}px`;
  cadreCour.style.height = `${hauteur * k}px`;
  cadreCour.querySelector<HTMLElement>('.cour')!.style.transform = `scale(${k}) translate(${-x}px, ${-y}px)`;
}

function ouvrirLeRejeu(issue: IssueDuCombat, fin: () => void, terrain: string) {
  const scene = $('#combat');
  scene.hidden = false;
  cour = dessinerLaCour(issue.largeur, issue.hauteur, terrain);
  scene.innerHTML = `<div class="combat-ecran">
    <header class="combat-tete">
      ${cadre(`<div class="cartouche">${medaillon('epee', 'grand')}<div><div class="titre gothique">Combat</div><div class="sous-titre" id="round">Round 1</div></div></div>`, { balise: 'div', classe: 'cartouche-combat' })}
      <ol class="ordre" aria-label="Ordre du round"></ol>
      <div class="vitesse" role="group" aria-label="Vitesse">${[1, 2, 4].map((v) => `<button type="button" class="plaque petite laiton${v === 1 ? ' armee' : ''}" data-v="${v}"><div>×${v}</div></button>`).join('')}<button type="button" class="plaque petite laiton" data-v="0"><div>Passer</div></button></div>
    </header>
    <div class="tour" id="tour" aria-live="polite"></div>
    <div class="champ"><div class="cour-cadre"><div class="cour" style="width:${cour.largeur}px;height:${cour.hauteur}px">${cour.svg}<div class="figures"></div></div></div></div>
    <div class="combat-pied">
      ${cadre('<ol class="journal"></ol>', { fond: 'parchemin', balise: 'div', classe: 'panneau-journal' })}
      <div class="rang-heros vivant"></div>
    </div>
    <div class="issue-place" id="combat-fin-place"></div>
  </div>`;
  mettreALEchelle();
  rejeu = { issue, i: 0, vitesse: 1, minuteur: 0, fin };
  poserLePas(issue.pas[0]);
  planifier();
}

/** La durée d'un pas : le temps de ses coups, un mouvement, ou un battement bref. */
function dureeDuPas(p: Pas, avant: Pas | null): number {
  const bouge = !!avant && p.pions.some((q) => { const a = avant.pions.find((x) => x.id === q.id); return a && (a.x !== q.x || a.y !== q.y); });
  const base = p.coups.length ? 380 + p.coups.length * 720 : bouge ? 520 : p.etats.length ? 520 : p.actif !== avant?.actif ? 420 : 160;
  return base / (rejeu?.vitesse ?? 1);
}

function planifier() {
  if (!rejeu) return;
  clearTimeout(rejeu.minuteur);
  if (rejeu.i >= rejeu.issue.pas.length - 1) return terminerLeRejeu();
  const p = rejeu.issue.pas[rejeu.i];
  rejeu.minuteur = window.setTimeout(() => {
    if (!rejeu) return;
    rejeu.i++;
    poserLePas(rejeu.issue.pas[rejeu.i]);
    planifier();
  }, dureeDuPas(p, rejeu.issue.pas[rejeu.i - 1] ?? null));
}

/** Joue une animation de figurine : efface les autres, la pose, la retire à sa fin. */
function animer(el: HTMLElement, classe: 'fente' | 'tire' | 'frappe' | 'esquive') {
  el.classList.remove('fente', 'tire', 'frappe', 'esquive');
  void el.offsetWidth;
  el.classList.add(classe);
  el.addEventListener('animationend', () => el.classList.remove(classe), { once: true });
}

const figureDe = (id: string) => document.querySelector<HTMLElement>(`#combat .fig[data-id="${CSS.escape(id)}"]`);

function flotter(el: HTMLElement | null, texte: string, genre: string) {
  if (!el) return;
  const f = document.createElement('span');
  f.className = `flottant ${genre}`;
  f.textContent = texte;
  el.append(f);
  setTimeout(() => f.remove(), 1500);
}

/** Un coup : la fente ou le trait, puis l'impact et son issue, écrite. */
function jouerLeCoup(c: Coup, vitesse: number) {
  const de = figureDe(c.de);
  const vers = figureDe(c.vers);
  if (!de || !vers) return;
  const pos = (el: HTMLElement) => [Number(el.dataset.px), Number(el.dataset.py)];
  const [x0, y0] = pos(de);
  const [x1, y1] = pos(vers);
  const impact = 300 / vitesse;
  const allie = de.classList.contains('camp-ennemi') === vers.classList.contains('camp-ennemi');
  // LDB 21 l.19-20 (Animosité)
  if (allie && c.genre !== 'spell') {
    flotter(de, 'Animosité !', 'querelle');
    $('#tour').innerHTML = `<span class="ruban gothique">${esc(de.title)} cède à son Animosité contre ${esc(vers.title)}</span>`;
  }
  vers.classList.add('cible');
  setTimeout(() => vers.classList.remove('cible'), impact + 500 / vitesse);
  if (c.genre === 'distance' || c.genre === 'spell') {
    const t = document.createElement('i');
    t.className = `trait ${c.genre}`;
    t.style.cssText = `left:${x0}px;top:${y0 - 50}px;--dx:${x1 - x0}px;--dy:${y1 - y0}px;--duree:${impact}ms;--angle:${Math.atan2(y1 - y0, x1 - x0)}rad`;
    de.parentElement!.append(t);
    setTimeout(() => t.remove(), impact + 60);
    animer(de, 'tire');
  } else {
    const n = Math.hypot(x1 - x0, y1 - y0) || 1;
    de.style.setProperty('--fx', `${((x1 - x0) / n) * 26}px`);
    de.style.setProperty('--fy', `${((y1 - y0) / n) * 26}px`);
    de.style.setProperty('--duree', `${560 / vitesse}ms`);
    animer(de, 'fente');
  }
  setTimeout(() => {
    if (c.touche && allie) {
      flotter(vers, c.sort ?? 'Sort', 'etat');
    } else if (c.touche) {
      animer(vers, 'frappe');
      flotter(vers, c.blessures ? `−${c.blessures}` : 'Touché', c.critique ? 'degat critique' : 'degat');
      if (c.critique) setTimeout(() => flotter(vers, 'Critique !', 'critique-mot'), 120);
    } else if (c.genre === 'spell') {
      flotter(de, 'Échec', 'evite');
    } else {
      flotter(vers, c.defense === 'parade' ? 'Paré' : c.defense === 'esquive' ? 'Esquivé' : 'Raté', 'evite');
      animer(vers, 'esquive');
    }
  }, impact);
}

/** Pose un pas sur le plateau ; `anime` faux le pose sans jouer ses coups (« Passer »). */
function poserLePas(p: Pas, anime = true) {
  const zone = $('#combat .figures');
  const vitesse = rejeu?.vitesse ?? 1;
  for (const q of p.pions) {
    let el = figureDe(q.id);
    if (!el) {
      const g = gabaritDuPion(q);
      el = document.createElement('div');
      el.dataset.id = q.id;
      el.className = `fig camp-${q.camp}`;
      el.title = q.label;
      el.style.setProperty('--s', String(q.cases > 1 ? 1.5 : 1));
      el.style.setProperty('--haut', `${(g.bete ? 46 : 74) * g.taille + 14}px`);
      el.innerHTML = `${figurine(g, q.camp)}<span class="pv-fig"><i></i></span>`;
      zone.append(el);
    }
    const [px, py] = cour!.centre(q.x, q.y, q.cases);
    el.dataset.px = String(px);
    el.dataset.py = String(py);
    el.style.left = `${px - 50}px`;
    el.style.top = `${py - 130}px`;
    el.style.zIndex = String(Math.round(py));
    el.classList.toggle('hors', q.hors);
    el.classList.toggle('actif', q.id === p.actif);
    (el.querySelector('.pv-fig i') as HTMLElement).style.width = `${(100 * q.pv) / Math.max(1, q.max)}%`;
  }
  if (anime) {
    p.coups.forEach((c, k) => setTimeout(() => jouerLeCoup(c, vitesse), (k * 720) / vitesse));
    const apres = (p.coups.length * 720 + 200) / vitesse;
    p.etats.forEach((e, k) => setTimeout(() => flotter(figureDe(e.porteur), libelleDEtat(e.etat, 1), 'etat'), apres + k * 160));
  }
  const actif = p.pions.find((q) => q.id === p.actif);
  const champ = document.querySelector<HTMLElement>('#combat .champ');
  if (actif && champ && champ.scrollWidth > champ.clientWidth) {
    const k = Number(document.querySelector<HTMLElement>('#combat .cour-cadre')?.style.getPropertyValue('--k')) || 1;
    champ.scrollTo({ left: (Number(figureDe(actif.id)!.dataset.px) - cour!.cadrage.x) * k - champ.clientWidth / 2, behavior: anime ? 'smooth' : 'auto' });
  }
  $('#round').textContent = `Round ${p.round}`;
  $('#tour').innerHTML = actif ? `<span class="ruban gothique">${actif.camp === 'heros' ? 'Au tour de' : 'Tour adverse :'} ${esc(actif.label)}</span>` : '';
  $('#tour').className = `tour ${actif?.camp ?? ''}`;
  const parId = new Map(p.pions.map((q) => [q.id, q]));
  $('#combat .ordre').innerHTML = p.ordre.map((id) => parId.get(id)).filter((q): q is PionDuPlateau => !!q).map((q) => {
    return `<li class="${q.id === p.actif ? 'actif' : ''}${q.hors ? ' hors' : ''}" title="${esc(q.label)}">${portrait(buste(gabaritDuPion(q), q.camp), q.camp, 'petit')}</li>`;
  }).join('');
  $('#combat .rang-heros').innerHTML = p.pions.filter((q) => q.camp === 'heros').map((q) => {
    const h = etat.roster.find((x) => x.c.id === q.id);
    return `<div class="carte-heros${q.hors ? ' hors' : ''}${q.id === p.actif ? ' choisi' : ''}">${h ? portrait(busteDuHeros(h), 'heros', 'moyen') : ''}<span class="qui"><span class="nom-propre petit gothique">${esc(q.label)}</span><span class="vie"><span>Blessures</span><span class="chiffres">${q.pv} / ${q.max}</span></span>${jauge(q.pv / Math.max(1, q.max), { taille: 'forte' })}</span></div>`;
  }).join('');
  const j = $('#combat .journal');
  for (const l of p.lignes) {
    const li = document.createElement('li');
    li.textContent = l;
    if (/Victoire|Défaite/.test(l)) li.className = 'fort';
    else if (/CRITIQUE|hors de combat|s'effondre/.test(l)) li.className = 'rouge';
    j.append(li);
  }
  j.scrollTop = j.scrollHeight;
}

function terminerLeRejeu() {
  const place = $('#combat-fin-place');
  if (!place || place.innerHTML || !rejeu) return;
  const victoire = rejeu.issue.issue === 'victoire';
  place.innerHTML = `<div class="banniere-issue ${victoire ? 'victoire' : 'defaite'}"><span class="gothique">${victoire ? 'Victoire' : rejeu.issue.issue === 'defaite' ? 'Déroute' : 'Le combat s’enlise'}</span></div>${plaque('Voir l’issue', 'id="combat-fin"', { armee: true, taille: 'appel' })}`;
  $('#combat-fin').focus();
}

function fermerLeRejeu() {
  if (!rejeu) return;
  clearTimeout(rejeu.minuteur);
  const fin = rejeu.fin;
  rejeu = null;
  $('#combat').hidden = true;
  fin();
}

// ─── Gestes ─────────────────────────────────────────────────────────────────────────────────────────────────

const basculer = (p: Panneau) => {
  const meme = !!panneau && panneau.type === p.type && (!('id' in p) || ('id' in panneau && panneau.id === p.id));
  panneau = meme ? null : p;
  congediement = null;
  rendre();
};

document.addEventListener('click', (ev) => {
  const cible = ev.target as Element;
  const v = cible.closest<HTMLElement>('[data-v]');
  if (v && rejeu) {
    const n = Number(v.dataset.v);
    if (n === 0) {
      clearTimeout(rejeu.minuteur);
      for (let i = rejeu.i + 1; i < rejeu.issue.pas.length; i++) poserLePas(rejeu.issue.pas[i], false);
      rejeu.i = rejeu.issue.pas.length - 1;
      terminerLeRejeu();
    } else {
      rejeu.vitesse = n;
      document.querySelectorAll('#combat [data-v]').forEach((b) => b.classList.toggle('armee', b === v));
      planifier();
    }
    return;
  }
  if (cible.closest('#combat-fin')) return fermerLeRejeu();
  const el = cible.closest<HTMLElement>('[data-a]');
  if (!el || (el as HTMLButtonElement).disabled) return;
  const { a, id = '', i, k } = el.dataset;
  switch (a) {
    case 'batiment': return basculer({ type: 'batiment', id: id as J.IdBatiment });
    case 'heros': return basculer({ type: 'heros', id });
    case 'chronique': return basculer({ type: 'chronique' });
    case 'ouvrir-depart': panneau = { type: 'depart', dest: null, choix: new Set() }; return rendre();
    case 'fermer-panneau': panneau = null; congediement = null; return rendre();
    case 'ameliorer': return agir(() => J.ameliorer(etat, id as J.IdBatiment));
    case 'recruter': return agir(() => J.recruter(etat, Number(i)));
    case 'soigner': return agir(() => J.soignerAuTemple(etat, id));
    case 'sequelle': return agir(() => J.guerirUneSequelle(etat, id));
    case 'client': client = id; return rendre();
    case 'arme': return agir(() => J.acheterUneArme(etat, id, k!));
    case 'armure': return agir(() => J.acheterUneArmure(etat, id, k as J.PoidsDArmure));
    case 'provision': return agir(() => J.acheterUneProvision(etat, id, k!));
    case 'carac': return agir(() => J.acheter(etat, id, { genre: 'carac', id: k! }));
    case 'sort': return agir(() => J.acheter(etat, id, { genre: 'sort', id: k! }));
    case 'niveau': return agir(() => J.acheter(etat, id, { genre: 'niveau' }));
    case 'competence': case 'talent': {
      const h = etat.roster.find((x) => x.c.id === id);
      const o = h && J.offresDeCarriere(h);
      const ref = o && (a === 'competence' ? o.competences : o.talents)[Number(i)]?.ref;
      return ref ? agir(() => J.acheter(etat, id, { genre: a, ref })) : undefined;
    }
    case 'utiliser': { const ligne = J.utiliserUneProvision(etat, id, k!); J.sauver(etat); rendre(); return toast(ligne); }
    case 'prier': { const ligne = J.prier(etat, id, k!); J.sauver(etat); rendre(); return toast(ligne); }
    case 'congedier': congediement = id; return rendre();
    case 'congedier-non': congediement = null; return rendre();
    case 'congedier-ok': congediement = null; panneau = null; return agir(() => J.congedier(etat, id));
    case 'preparer': panneau = { type: 'depart', dest: id, choix: new Set(etat.roster.filter(J.valide).slice(0, 4).map((h) => h.c.id)) }; return rendre();
    case 'choisir': {
      if (panneau?.type !== 'depart') return;
      const input = el as HTMLInputElement;
      if (input.checked && panneau.choix.size >= 4) { input.checked = false; return toast('Quatre héros au plus.'); }
      if (input.checked) panneau.choix.add(id); else panneau.choix.delete(id);
      return rendre();
    }
    case 'partir': {
      if (panneau?.type !== 'depart' || !panneau.dest) return;
      const p = panneau;
      panneau = null;
      return agir(() => J.partir(etat, p.dest!, [...p.choix]));
    }
    case 'avancer': {
      panneau = null;
      const terrain = etat.expedition?.destination ?? 'reikwald';
      const camp = etat.expedition?.salles[etat.expedition.index].type === 'camp';
      const groupe = J.herosDuGroupe(etat);
      const recit = J.avancer(etat);
      J.sauver(etat);
      const montrer = () => { modale = { type: 'recit', recit, terrain, ...(camp ? { vignette: groupe } : {}) }; rendre(); };
      if (recit.combat) { rendre(); ouvrirLeRejeu(recit.combat, montrer, terrain); } else montrer();
      return;
    }
    case 'revoir': {
      if (modale?.type !== 'recit' || !modale.recit.combat) return;
      const m = modale;
      modale = null; rendre();
      return ouvrirLeRejeu(m.recit.combat!, () => { modale = m; rendre(); }, m.terrain ?? 'reikwald');
    }
    case 'rentrer': {
      panneau = null;
      const lignes = J.rentrer(etat, false);
      J.sauver(etat);
      modale = { type: 'recit', recit: { titre: 'Retour au hameau', lignes } };
      return rendre();
    }
    case 'attendre': return agir(() => J.attendreUneSemaine(etat));
    case 'fermer': modale = null; return rendre();
    case 'reset': modale = { type: 'reset' }; return rendre();
    case 'reset-ok': J.effacer(); etat = J.nouvellePartie(Date.now() % 100000); modale = null; panneau = null; congediement = null; return agir(() => null);
  }
});

document.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Escape') return;
  if (rejeu) return fermerLeRejeu();
  if (modale?.type === 'reset') { modale = null; return rendre(); }
  if (panneau) { panneau = null; rendre(); }
});

window.addEventListener('resize', () => {
  mettreALEchelle();
  ajusterLesTableaux();
  const pano = document.querySelector<HTMLElement>('.panorama');
  if (pano) pano.scrollLeft = (pano.scrollWidth - pano.clientWidth) * 0.42;
});

document.body.insertAdjacentHTML('beforeend', DEGRADES_DES_FIGURINES);
poserLesTextures();
J.sauver(etat);
rendre();
