/**
 * L'interface de Grisefosse, habillée du kit des maquettes (`./kit`, `kit.css`). Le hameau est un lieu : sa scène
 * (`./hameau`), une enseigne par bâtiment, la compagnie en bandeau, une page sur parchemin pour ce qu'on ouvre.
 * DOM nu, un rendu complet par geste, délégation des clics par `data-a`. Le combat se rejoue pas à pas depuis les
 * relevés du noyau.
 */
import * as J from './jeu';
import { carac, coutDAugmentation, libelleDeCarac, libelleDEtat, nomDeCreature, type IssueDuCombat, type Pas, type PionDuPlateau, type Combatant } from './combat';
import { BUSTES, cadre, jauge, medaillon, plaque, portrait, poserLesTextures, rond } from './kit';
import { ANCRES, HAUTEUR, LARGEUR, sceneDuHameau } from './hameau';

const $ = <T extends HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T;
const esc = (s: unknown) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

type Panneau = { type: 'batiment'; id: J.IdBatiment } | { type: 'heros'; id: string } | { type: 'depart'; dest: string | null; choix: Set<string> } | { type: 'chronique' };
let etat: J.Etat = J.charger() ?? J.nouvellePartie(Date.now() % 100000);
let panneau: Panneau | null = null;
let modale: { type: 'recit'; recit: J.RecitDeSalle; illustration?: string } | { type: 'reset' } | null = null;
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

// ─── Portraits ──────────────────────────────────────────────────────────────────────────────────────────────

const BUSTES_HUMAINS = ['bjorn', 'mira', 'aldric', 'greta', 'astrid', 'kirsten', 'sigrid', 'berta'];
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const busteDuHeros = (h: Pick<J.Heros, 'espece' | 'c'>) => (h.espece === 'humains-reiklander' ? BUSTES_HUMAINS[hash(h.c.label) % BUSTES_HUMAINS.length] : 'harbull');
const BUSTES_ENNEMIS: [RegExp, string][] = [[/gobelin|snotling/, 'gobelin'], [/orc|gor|ungor|minotaure|troll|chaos|mutant|bestigor/, 'orc'], [/brigand|cultiste|necromancien|chevalier|squelette|zombie|goule|vampire/, 'aldric']];
const busteDeCreature = (id = '') => BUSTES_ENNEMIS.find(([re]) => re.test(id))?.[1];

function busteDuPion(q: PionDuPlateau): string | undefined {
  if (q.camp === 'heros') {
    const h = etat.roster.find((x) => x.c.id === q.id);
    return h ? busteDuHeros(h) : undefined;
  }
  return busteDeCreature(q.creature);
}

// ─── Pièces communes ────────────────────────────────────────────────────────────────────────────────────────

const STATS = ['capacite-de-combat', 'force', 'endurance', 'initiative', 'agilite', 'force-mentale'] as const;
const croix = '<button type="button" class="croix" data-a="fermer-panneau" aria-label="Fermer">×</button>';
const page = (titre: string, corps: string) => `<aside class="page" aria-label="${esc(titre)}">${cadre(`${croix}${corps}`, { ruban: esc(titre), fond: 'parchemin', balise: 'div' })}</aside>`;
const ligneDeVie = (c: Combatant) => `<span class="vie"><span>Blessures</span><span class="chiffres">${Math.max(0, c.wounds.current)} / ${c.wounds.max}</span></span>${jauge(Math.max(0, c.wounds.current) / Math.max(1, c.wounds.max), { taille: 'forte' })}`;
const etats = (c: Combatant) => (c.conditions.length ? `<div class="etats">${c.conditions.map((e) => `<span class="etiquette rectangle cire">${esc(libelleDEtat(e.id, e.value))}</span>`).join('')}</div>` : '');
const niveaux = (n: number, max: number) => `<span class="niveaux" aria-label="palier ${n + 1} sur ${max}">${Array.from({ length: max }, (_, i) => `<i class="${i <= n ? 'plein' : ''}"></i>`).join('')}</span>`;

/** Un bâtiment est en ruine tant qu'on ne l'a pas relevé ; le relais et le cartographe servent dès le premier jour. */
const enRuine = (id: J.IdBatiment) => etat.batiments[id] === 0 && id !== 'relais' && id !== 'cartographe';
const PICTO_DU_BATIMENT: Record<J.IdBatiment, string> = { relais: 'chope', temple: 'soin', salle: 'epee', cartographe: 'carte', peage: 'pieces', memorial: 'croix' };

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
      const gratuit = J.rosterVide(etat) && etat.or < c.prix;
      return `<li>${portrait(busteDuHeros(c), 'heros', 'petit')}<span class="qui"><b class="gothique">${esc(c.c.label)}</b><span>${esc(J.nomDeCarriere(c.carriere))} · ${esc(J.nomDEspece(c.espece))} · ${c.c.wounds.max} PB · CC ${carac(c.c, 'capacite-de-combat')}</span><span class="glose">${gratuit ? 'Servira sans solde' : `Solde : ${c.prix} couronnes`}</span></span>${plaque('Engager', `data-a="recruter" data-i="${i}"`, { prix: gratuit ? '' : String(c.prix), taille: 'petite', armee: gratuit || etat.or >= c.prix, fermee: !gratuit && etat.or < c.prix })}</li>`;
    }).join('')}</ul>` : '<p class="glose">Personne au relais. D’autres voyageurs arriveront demain.</p>';
  } else if (id === 'temple') {
    const prix = J.prixDuSoin(etat);
    corps = prix == null ? '<p class="glose">La chapelle est en ruine : il faut la relever pour que les sœurs soignent les blessés.</p>'
      : `<div class="sous-titre">Les blessés</div>${listeDeHeros((h) => (J.blesse(h) ? plaque('Soigner', `data-a="soigner" data-id="${h.c.id}"`, { icone: 'soin', prix: prix ? String(prix) : '', taille: 'petite', armee: etat.or >= prix }) : '<span class="glose">indemne</span>'))}`;
  } else if (id === 'salle') {
    corps = n === 0 ? '<p class="glose">La salle d’armes est en ruine : il faut la relever pour dépenser les PX.</p>'
      : `<div class="sous-titre">S’entraîner · jusqu’à ${J.plafondDAugmentations(etat)} Augmentations</div>${listeDeHeros((h) => plaque('Entraîner', `data-a="heros" data-id="${h.c.id}"`, { icone: 'epee', taille: 'petite' }))}`;
  } else if (id === 'cartographe') {
    corps = pageDesDestinations();
  } else if (id === 'peage') {
    corps = `<p class="glose">${n ? 'Les péagers prélèvent leur dû sur les voyageurs du pont, et versent la part de la compagnie à chaque expédition qui franchit au moins une salle.' : 'Le pont est sans barrière : aucun voyageur ne paie.'}</p>`;
  } else {
    corps = etat.cimetiere.length ? `<div class="sous-titre">${etat.cimetiere.length} tombe${etat.cimetiere.length > 1 ? 's' : ''}</div><ul class="tombes">${etat.cimetiere.map((t) => `<li><b class="gothique">${esc(t.nom)}</b><span>${esc(J.nomDeCarriere(t.carriere))}, tombé·e à ${esc(t.ou)}, jour ${t.semaine}</span></li>`).join('')}</ul>` : '<p class="glose">Aucune tombe encore. Puisse-t-il en rester ainsi.</p>';
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
  return page(d.nom, `<p class="glose consigne">${esc(d.recit)} Choisissez jusqu’à quatre héros : les blessures ne guérissent qu’au camp et au hameau.</p>
    <div class="choix">${etat.roster.map((h) => {
      const ok = J.valide(h);
      return `<label class="${ok ? '' : 'hors'}${p.choix.has(h.c.id) ? ' coche' : ''}"><input type="checkbox" id="pick-${h.c.id}" data-a="choisir" data-id="${h.c.id}"${p.choix.has(h.c.id) ? ' checked' : ''}${ok ? '' : ' disabled'}>
        ${portrait(busteDuHeros(h), 'heros', 'petit')}<span class="qui"><b class="gothique">${esc(h.c.label)}</b><span>${esc(J.nomDeCarriere(h.carriere))} · ${Math.max(0, h.c.wounds.current)}/${h.c.wounds.max} PB</span></span></label>`;
    }).join('') || '<p class="glose">Personne à envoyer.</p>'}</div>
    <div class="gestes">${plaque(`Partir avec ${p.choix.size} héros`, 'data-a="partir"', { icone: 'route', armee: p.choix.size > 0, fermee: !p.choix.size })}${plaque('Autre route', 'data-a="ouvrir-depart"', { taille: 'petite' })}</div>`);
}

function pageDuHeros(id: string) {
  const h = etat.roster.find((x) => x.c.id === id);
  if (!h) return '';
  const c = h.c;
  const plafond = J.plafondDAugmentations(etat);
  const enExpedition = !!etat.expedition;
  const entrainement = enExpedition ? '' : etat.batiments.salle
    ? `<div class="sous-titre">Salle d’armes · ${c.xp ?? 0} PX à dépenser</div>
      <table class="entrainement"><thead><tr><th>Caractéristique</th><th>Valeur</th><th>Augm.</th><th>Coût en PX</th></tr></thead><tbody>
      ${J.CARACS_ENTRAINABLES.map((k) => {
        const n = c.charAdvances?.[k] ?? 0;
        const cout = coutDAugmentation(c, k);
        const ok = n < plafond && (c.xp ?? 0) >= cout;
        return `<tr><td>${esc(libelleDeCarac(k).label)}</td><td class="chiffres">${carac(c, k)}</td><td class="chiffres">${n}/${plafond}</td><td>${plaque('+1', `data-a="augmenter" data-id="${c.id}" data-k="${k}"`, { prix: String(cout), taille: 'petite', fermee: !ok })}</td></tr>`;
      }).join('')}</tbody></table><p class="glose">Hors de la carrière, une Augmentation coûte le double.</p>`
    : '<p class="glose">Relevez la salle d’armes pour dépenser les PX.</p>';
  const prix = J.prixDuSoin(etat);
  const gestes = enExpedition ? '' : `<div class="gestes">
    ${J.blesse(h) && prix != null ? plaque('Soigner à la chapelle', `data-a="soigner" data-id="${c.id}"`, { icone: 'soin', prix: prix ? String(prix) : '', taille: 'petite', armee: etat.or >= prix }) : ''}
    ${congediement === c.id ? `${plaque('Confirmer le renvoi', `data-a="congedier-ok" data-id="${c.id}"`, { taille: 'petite', armee: true })}${plaque('Garder', 'data-a="congedier-non"', { taille: 'petite' })}` : `<button type="button" class="lien" data-a="congedier" data-id="${c.id}">Renvoyer de la compagnie</button>`}</div>`;
  return page(c.label, `<div class="tete-page">${portrait(busteDuHeros(h), 'heros', 'grand')}<div class="qui"><div class="nom-propre moyen gothique">${esc(J.nomDeCarriere(h.carriere))}</div><div class="sous-titre">${esc(J.nomDEspece(h.espece))} · ${h.expeditions} expédition${h.expeditions > 1 ? 's' : ''}</div>${ligneDeVie(c)}</div></div>
    <dl class="stats">${STATS.map((k) => `<div><dt title="${esc(libelleDeCarac(k).label)}">${esc(libelleDeCarac(k).abr)}</dt><dd class="chiffres">${carac(c, k)}</dd></div>`).join('')}</dl>
    <p class="meta"><span class="etiquette pastille or">${c.xp ?? 0} PX</span><span class="etiquette pastille fer">Destin ${c.fate ?? 0}</span><span class="glose">${esc(c.weapons.map((w) => w.label).join(', ') || 'mains nues')}</span></p>
    ${etats(c)}${entrainement}${gestes}`);
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
    <div class="cartouche-lieu">${cadre(`<div class="cartouche">${medaillon('ville', 'grand')}<div><div class="titre gothique">Grisefosse</div><div class="sous-titre">Hameau du Reikland · jour ${etat.semaine}</div></div></div>
      <div class="ressources"><span class="etiquette compte or">${etat.or} CO</span><span class="etiquette compte or">${etat.trophees} trophée${etat.trophees > 1 ? 's' : ''}</span><span class="etiquette compte fer">${etat.roster.length} héros</span></div>`, { balise: 'div' })}
      <p class="recit-lieu ombre">${esc(etat.journal[0]?.replace(/^Jour \d+ — /, '') ?? '')}</p></div>
    <div class="coin-droit">
      ${cadre(`<div class="partir"><div><div class="nom-propre petit gothique">${ouvertes} route${ouvertes > 1 ? 's' : ''} ouverte${ouvertes > 1 ? 's' : ''}</div><div class="sous-titre">${etat.bossVaincus.length} maître${etat.bossVaincus.length > 1 ? 's' : ''} vaincu${etat.bossVaincus.length > 1 ? 's' : ''}</div></div>${plaque('Choisir une route', 'data-a="ouvrir-depart"', { icone: 'route', armee: true })}</div>`, { ruban: 'Partir', balise: 'div' })}
      <div class="outils"><span class="seul-etroit">${rond('route', 'Partir', 'data-a="ouvrir-depart"')}</span>${rond('lune', 'Se reposer', 'data-a="reposer"')}${rond('livre', 'Chronique', 'data-a="chronique"')}${rond('sablier', 'Recommencer', 'data-a="reset"')}</div>
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
    <img class="fond-expe" src="bivouac.jpg" alt="">
    <div class="cartouche-lieu">${cadre(`<div class="cartouche">${medaillon('route', 'grand')}<div><div class="titre gothique">${esc(d.nom)}</div><div class="sous-titre">Salle ${x.index + 1} sur ${x.salles.length} · jour ${etat.semaine}</div></div></div>
      <div class="ressources"><span class="etiquette compte or">${x.or} CO</span><span class="etiquette compte or">${x.trophees} trophée${x.trophees > 1 ? 's' : ''}</span><span class="etiquette compte fer">${x.px} PX chacun</span></div>`, { balise: 'div' })}</div>
    <div class="piste-cadre">${cadre(`<ol class="piste">${x.salles.map((s, i) => `<li class="${s.faite ? 'faite' : ''}${i === x.index ? ' ici' : ''}">${medaillon(PICTO_DE_SALLE[s.type], i === x.index ? 'grand' : 'moyen', s.faite)}<span class="sous-titre">${NOM_DE_SALLE[s.type]}</span></li>`).join('')}</ol>`, { balise: 'div', ruban: 'La route' })}</div>
    <div class="salle-cadre">${cadre(`<div class="nom-propre grand gothique">${NOM_DE_SALLE[salle.type]}</div><p class="glose consigne">${esc(annonce)}</p>
      <div class="gestes colonne">${plaque(appel, 'data-a="avancer"', { icone: PICTO_DE_SALLE[salle.type], armee: !!valides, fermee: !valides, taille: 'appel' })}${plaque('Rentrer au hameau', 'data-a="rentrer"', { icone: 'route' })}</div>
      ${valides < groupe.length ? `<p class="glose avertissement">${groupe.length - valides} héros hors de combat ne se battront pas tant qu’ils n’auront pas récupéré.</p>` : ''}`, { fond: 'parchemin', balise: 'div' })}</div>
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
  return boite(r.titre, `${modale.illustration ? `<img class="illustration" src="${modale.illustration}" alt="">` : ''}<div class="recit ${r.fin ?? ''}">${r.lignes.map((l) => `<p>${esc(l)}</p>`).join('')}</div>
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
}

// ─── Rejeu du combat ────────────────────────────────────────────────────────────────────────────────────────

let rejeu: { issue: IssueDuCombat; i: number; vitesse: number; minuteur: number; fin: () => void } | null = null;
const DELAI = 520;

function ouvrirLeRejeu(issue: IssueDuCombat, fin: () => void) {
  const scene = $('#combat');
  scene.hidden = false;
  const cases = Array.from({ length: issue.largeur * issue.hauteur }, () => '<i></i>').join('');
  scene.innerHTML = `<div class="arene-cadre">
    <header><div class="titre gothique">Combat</div><span class="etiquette compte fer" id="round">Round 1</span>
      <div class="vitesse" role="group" aria-label="Vitesse">${[1, 2, 4].map((v) => `<button type="button" class="plaque petite laiton${v === 1 ? ' armee' : ''}" data-v="${v}"><div>×${v}</div></button>`).join('')}<button type="button" class="plaque petite laiton" data-v="0"><div>Passer</div></button></div></header>
    <div class="arene-corps">${cadre(`<div class="arene-zone"><div class="arene" style="--w:${issue.largeur};--h:${issue.hauteur}">${cases}<div class="pions"></div></div></div>`, { classe: 'plateau', balise: 'div' })}
      ${cadre(`<div class="effectifs"><div class="sous-titre">Compagnie</div><ul data-camp="heros"></ul><div class="sous-titre">Adversaires</div><ul data-camp="ennemi"></ul></div>`, { balise: 'div', classe: 'panneau-eff' })}</div>
    ${cadre('<ol class="journal" aria-live="polite"></ol>', { fond: 'parchemin', balise: 'div', classe: 'panneau-journal' })}
    <footer id="combat-fin-place"></footer>
  </div>`;
  rejeu = { issue, i: 0, vitesse: 1, minuteur: 0, fin };
  poserLePas(issue.pas[0], null);
  planifier();
}

function planifier() {
  if (!rejeu) return;
  clearTimeout(rejeu.minuteur);
  if (rejeu.i >= rejeu.issue.pas.length - 1) return terminerLeRejeu();
  rejeu.minuteur = window.setTimeout(() => {
    if (!rejeu) return;
    rejeu.i++;
    poserLePas(rejeu.issue.pas[rejeu.i], rejeu.issue.pas[rejeu.i - 1]);
    planifier();
  }, DELAI / rejeu.vitesse);
}

function contenuDuPion(q: PionDuPlateau): string {
  const buste = busteDuPion(q);
  return buste ? `<svg viewBox="0 0 78 90" preserveAspectRatio="xMidYMax slice" aria-hidden="true">${BUSTES[buste]}</svg>` : `<b class="gothique">${esc(q.label[0])}</b>`;
}

function poserLePas(p: Pas, avant: Pas | null) {
  const zone = $('#combat .pions');
  const anciens = new Map((avant?.pions ?? []).map((q) => [q.id, q]));
  for (const q of p.pions) {
    let el = zone.querySelector<HTMLElement>(`[data-id="${CSS.escape(q.id)}"]`);
    if (!el) {
      el = document.createElement('div');
      el.dataset.id = q.id;
      el.className = `pion camp-${q.camp}`;
      el.innerHTML = `<div class="disque">${contenuDuPion(q)}</div><span class="pv"><i></i></span>`;
      el.title = q.label;
      zone.append(el);
    }
    el.style.setProperty('--x', String(q.x));
    el.style.setProperty('--y', String(q.y));
    el.style.setProperty('--n', String(q.cases));
    el.classList.toggle('hors', q.hors);
    (el.querySelector('.pv i') as HTMLElement).style.width = `${(100 * q.pv) / Math.max(1, q.max)}%`;
    const a = anciens.get(q.id);
    if (a && a.pv !== q.pv) {
      const delta = q.pv - a.pv;
      const f = document.createElement('span');
      f.className = `degat chiffres ${delta < 0 ? 'perte' : 'gain'}`;
      f.textContent = delta < 0 ? String(delta) : `+${delta}`;
      el.append(f);
      el.classList.remove('touche'); void el.offsetWidth; el.classList.add('touche');
      setTimeout(() => f.remove(), 1100);
    }
  }
  for (const camp of ['heros', 'ennemi'] as const) {
    $(`#combat .effectifs [data-camp="${camp}"]`).innerHTML = p.pions.filter((q) => q.camp === camp).map((q) => {
      const buste = busteDuPion(q);
      return `<li class="rang ${camp}${q.hors ? ' hors' : ''}">${buste ? portrait(buste, camp, 'petit') : `<div class="portrait fer ennemi petit"><div class="initiale gothique">${esc(q.label[0])}</div></div>`}
        <div class="qui"><div class="nom">${esc(q.label)}${q.hors ? ' <span class="glose">hors de combat</span>' : ''}</div>${jauge(q.pv / Math.max(1, q.max))}<span class="chiffres pv-t">${q.pv} / ${q.max}</span></div></li>`;
    }).join('');
  }
  $('#round').textContent = `Round ${p.round}`;
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
  if (place && !place.innerHTML) {
    place.innerHTML = plaque('Voir l’issue', 'id="combat-fin"', { armee: true, taille: 'appel' });
    $('#combat-fin').focus();
  }
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
      for (let i = rejeu.i + 1; i < rejeu.issue.pas.length; i++) poserLePas(rejeu.issue.pas[i], rejeu.issue.pas[i - 1]);
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
    case 'augmenter': return agir(() => J.entrainer(etat, id, k as J.CharKey));
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
      const camp = etat.expedition?.salles[etat.expedition.index].type === 'camp';
      const recit = J.avancer(etat);
      J.sauver(etat);
      const montrer = () => { modale = { type: 'recit', recit, ...(camp ? { illustration: 'bivouac.jpg' } : {}) }; rendre(); };
      if (recit.combat) { rendre(); ouvrirLeRejeu(recit.combat, montrer); } else montrer();
      return;
    }
    case 'revoir': {
      if (modale?.type !== 'recit' || !modale.recit.combat) return;
      const m = modale;
      modale = null; rendre();
      return ouvrirLeRejeu(m.recit.combat!, () => { modale = m; rendre(); });
    }
    case 'rentrer': {
      panneau = null;
      const lignes = J.rentrer(etat, false);
      J.sauver(etat);
      modale = { type: 'recit', recit: { titre: 'Retour au hameau', lignes } };
      return rendre();
    }
    case 'reposer': return agir(() => { J.seReposer(etat); toast('Un jour passe. Les blessés récupèrent, de nouveaux voyageurs attendent au relais.'); });
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
  const pano = document.querySelector<HTMLElement>('.panorama');
  if (pano) pano.scrollLeft = (pano.scrollWidth - pano.clientWidth) * 0.42;
});

poserLesTextures();
rendre();
