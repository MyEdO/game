/**
 * Les pièces communes de l'interface, montées sur le kit (`../kit`) : le texte échappé, la note, la vie, les États,
 * les séquelles, le portrait d'un héros, sa carte, les deux façons de montrer une chose qu'on possède — l'entrée
 * (Talent, sort, provision), la case d'objet (arme, armure, provision) — et le geste d'achat, seule forme d'un prix :
 * une plaque « verbe · prix », fermée avec sa raison au survol. Chaque chose porte son aperçu au survol
 * (`data-apercu`, posé par `./bulles`) : son nom, sa nature, le texte du livre.
 */
import * as J from '../jeu';
import {
  articleDuCatalogue,
  encombrement,
  libelleDEtat,
  maladies,
  nomDeCarriere,
  nomDeSort,
  sequelles,
  souillure,
  type Combatant,
  type Qualite,
  type Visee,
  causesDEtat,
} from '../noyau';
import { armeDuLibelle, buste, gabaritDuHeros } from '../figures';
import { cadre, jauge, medaillon, picto, PICTOS, plaque, portrait } from '../kit';

export const esc = (s: unknown) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
/** La note du kit : une précision, une aide (`courante`), ou un coût, un refus (`avertissement`). */
export const glose = (texte: string, variante: 'courante' | 'avertissement' = 'courante') => `<span class="glose ${variante}">${texte}</span>`;

/** Ce qu'un aperçu montre : le nom, ce qu'il est, le texte (du livre, ou des chiffres), et au pied un refus ; ou, à la
 *  place du texte, une `planche` que l'interface compose elle-même (HTML déjà échappé), sur bois sombre. */
export interface Apercu { nom: string; nature?: string; texte?: string; planche?: string; pied?: string }
export const apercuDe = (a: Apercu) => ` data-apercu="${esc(JSON.stringify(a))}"`;

// ─── Le héros ───────────────────────────────────────────────────────────────────────────────────────────────

type Porteur = Pick<J.Heros, 'carriere' | 'espece' | 'c'>;
/** Le gabarit d'un héros. Une arme de mêlée que sa spécialisation nomme hache (« Arme simple (Hache) ») en prend la
 *  forme, que le catalogue ne lui donne pas. */
export function gabaritDe(h: Porteur) {
  const allure = J.allure(h);
  const tenue = (h.c.loadouts ?? []).map((l) => h.c.items?.find((i) => i.uid === l.main)).find((i) => i?.kind === 'melee');
  return gabaritDuHeros(h.carriere, h.espece, allure.main && /^hache$/i.test(tenue?.spec ?? '') ? { ...allure, main: { ...allure.main, forme: 'hache' } } : allure, J.dieuDe(h.c), h.c.appearance?.sex);
}
/** Le portrait d'un héros : le buste de sa figurine. */
export const busteDuHeros = (h: Porteur) => buste(gabaritDe(h), 'heros');

/** Le signe d'une voie de lanceur, par spécialisation (un Collège, un dieu) : sa teinte et son emblème, tracé 24 × 24. */
const SIGNES_DE_VOIE: Record<string, { teinte: string; trace: string }> = {
  feu: { teinte: '#e8693a', trace: PICTOS.feu },
  lumiere: { teinte: '#fff3c4', trace: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v3.5M12 18v3.5M2.5 12H6M18 12h3.5M5.3 5.3l2.5 2.5M16.2 16.2l2.5 2.5M5.3 18.7l2.5-2.5M16.2 7.8l2.5-2.5"/>' },
  vie: { teinte: '#6cc487', trace: '<path d="M4.5 19.5C4.5 10 10 4.5 19.5 4.5c0 9.5-5.5 15-15 15z"/><path d="M4.5 19.5L14 10"/>' },
  bete: { teinte: '#d0903e', trace: '<path d="M6.5 3.5c1.5 5.5 1.2 11-1.5 17M12.5 3.5c1.5 5.5 1.2 11-1.5 17M18.5 3.5c1.5 5.5 1.2 11-1.5 17"/>' },
  metal: { teinte: '#ecc64e', trace: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="1.8"/>' },
  mort: { teinte: '#a67fd6', trace: PICTOS.crane },
  sigmar: { teinte: '#e6c36a', trace: '<circle cx="16.5" cy="7.5" r="3.6"/><path d="M13.4 9.2L3.5 14.5M14.8 10.6L9 20.5"/>' },
  ulric: { teinte: '#d3dde4', trace: '<path d="M4.5 3.5l4 4.5h7l4-4.5-.6 8.5L12 20.5 5.1 12z"/><path d="M9.3 12.2l1.4.8M14.7 12.2l-1.4.8"/>' },
  myrmidia: { teinte: '#8fb0e6', trace: '<path d="M12 2v20M10 5l2-3 2 3"/><path d="M6.5 8Q12 6.5 17.5 8v5c0 3.6-5.5 6-5.5 6s-5.5-2.4-5.5-6z"/>' },
  shallya: { teinte: '#f6efdc', trace: PICTOS.coeur },
};
/** La voie de lanceur d'un héros, lisible d'un coup d'œil : son `nom` court (la spécialisation, entre parenthèses
 *  dans le libellé du Talent : « Feu », « Ulric »), son `signe`, et son `apercu` (les sorts que le noyau en joue). */
export function voieLisible(h: Porteur): { nom: string; signe: string; apercu: Apercu } | undefined {
  const voie = J.voieDe(h.carriere, h.c);
  if (!voie) return undefined;
  const nom = voie.nom.replace(/^[^(]*\(|\)$/g, '');
  const s = SIGNES_DE_VOIE[voie.spec];
  const signe = s ? `<i class="signe-de-voie" style="--teinte:${s.teinte}" aria-label="${esc(nom)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${s.trace}</svg></i>` : '';
  return { nom, signe, apercu: { nom: voie.nom, nature: voie.talent === 'magie-des-arcanes' ? 'Collège de magie' : 'Culte', ...(voie.sorts.length ? { texte: voie.sorts.map((s) => nomDeSort(s.id)).join(' · ') } : {}) } };
}
/** La carrière d'un héros et, pour un lanceur, son Collège ou son dieu : « Pyromancien · Feu », « Prêtre guerrier · Ulric ». */
export function carriereDe(h: Porteur): string {
  const carriere = nomDeCarriere(h.c), v = voieLisible(h);
  return v && !carriere.includes(v.nom) ? `${carriere} · ${v.nom}` : carriere;
}
/** Le portrait d'un héros, le signe de sa voie à son coin ; `nomme` : le nom de la voie à côté du signe. */
export function portraitDeHeros(h: Porteur, taille: 'petit' | 'moyen' | 'grand' | 'affiche', etat = '', nomme = false): string {
  const v = voieLisible(h);
  return portrait(busteDuHeros(h), 'heros', taille, etat).replace(/<\/div>$/, `${v?.signe ? `<span class="voie-au-portrait">${v.signe}${nomme ? `<b>${esc(v.nom)}</b>` : ''}</span>` : ''}</div>`);
}
export const ligneDeVie = (c: Combatant) => `<span class="vie"><span>Blessures</span><span class="chiffres">${Math.max(0, c.wounds.current)} / ${c.wounds.max}</span></span>${jauge(Math.max(0, c.wounds.current) / Math.max(1, c.wounds.max), { taille: 'forte' })}`;
/** Ce qui fait porter un État au héros, tel que le noyau le dit (`causesDEtat`) ; son silence est dit. */
export const causeDEtat = (c: Combatant, e: Combatant['conditions'][number]): string => causesDEtat(c, e).join(' ') || 'Cause non précisée.';
export const etats = (c: Combatant) => (c.conditions.length ? `<div class="etats">${c.conditions.map((e) => `<span class="etiquette rectangle cire"${apercuDe({ nom: libelleDEtat(e.id, e.value), nature: 'État', texte: causeDEtat(c, e) })}>${esc(libelleDEtat(e.id, e.value))}</span>`).join('')}</div>` : '');

/** Le séjour d'un héros, à la place de sa vie : son bâtiment, les jours qui restent, et la jauge du séjour écoulé. */
export const sejourDe = ({ ou, reste, total }: J.Sejour) =>
  `<span class="vie sejour-hospice"><span>${J.LIEUX_DE_SEJOUR[ou].nom}</span><span class="chiffres">${reste} j</span></span>${jauge(1 - reste / Math.max(reste, total), { teinte: 'or', taille: 'forte' })}`;

/** La carte d'un héros : portrait, nom, rôle, carrière et voie, vie, état ; son identité et la cause de ses États au survol. `geste` : ce qu'un
 *  clic fait (ouvrir sa fiche, le servir, l'emmener) ; `refus` : pourquoi il n'est pas disponible pour ce geste, qui
 *  ferme la carte et se dit au survol ; `visee` : sa Compétence, la cible de son Test et ses chances, dites à la
 *  place de son état ; `meilleur` : ses chances sont les meilleures du socle ;
 *  `progresse` : il peut acheter un avancement. Un héros en séjour garde sa place et ses couleurs : sa carte porte
 *  la marque du bâtiment sur son portrait, et son séjour (jours restants, jauge) à la place de sa vie. */
export function carteDeHeros(h: J.Heros, choisi: boolean, geste = 'heros', o: { refus?: string | null; progresse?: boolean; visee?: Visee; meilleur?: boolean } = {}) {
  const c = h.c;
  const role = J.roleDe(h.carriere);
  const r = role && J.ROLES[role];
  const voie = voieLisible(h);
  const lePortrait = portraitDeHeros(h, 'grand', choisi ? 'choisi' : '', true);
  const identite: Apercu = {
    nom: c.label, nature: [carriereDe(h), r?.nom, J.nomDEspece(h.espece)].filter(Boolean).join(' · '),
    texte: [J.deviseDe(h.carriere), voie && [`**${voie.apercu.nom}**`, voie.apercu.texte].filter(Boolean).join(' : '), ...c.conditions.map((e) => `**${libelleDEtat(e.id, e.value)}** : ${causeDEtat(c, e)}`)].filter(Boolean).join('\n\n'),
  };
  const s = h.sejour;
  return `<button type="button" class="carte-heros${J.valide(h) ? '' : ' hors'}${s ? ' retrait' : ''}${choisi ? ' choisi' : ''}${o.meilleur ? ' meilleur' : ''}" data-a="${geste}" data-id="${c.id}"${o.refus ? ` disabled data-bulle="${esc(o.refus)}"` : ''}${apercuDe(identite)}>
    ${s ? `<span class="au-batiment">${lePortrait}${medaillon(J.LIEUX_DE_SEJOUR[s.ou].picto, 'petit')}</span>` : lePortrait}${o.progresse ? '<i class="pastille-progres" aria-label="Peut progresser"></i>' : ''}
    <span class="qui"><span class="nom-propre petit gothique">${esc(c.label)}</span><span class="sous-titre">${r ? picto(r.picto, 12, 1.8) : ''}${esc(nomDeCarriere(h.c))}</span>
    ${s ? sejourDe(s) : ligneDeVie(c)}<span class="ligne-etat${o.visee ? ' visee' : ''}">${o.visee ? `${esc(o.visee.competence)} ${o.visee.cible} · <b class="chiffres">${o.visee.chances}\u00a0%</b>` : c.conditions.length ? esc(c.conditions.map((e) => libelleDEtat(e.id, e.value)).join(', ')) : s ? `<span class="revient">de retour dans ${s.reste} jour${s.reste > 1 ? 's' : ''}</span>` : !J.valide(h) ? 'hors de combat' : sequelles(c).length ? `<span class="marque">${sequelles(c).length > 1 ? `${sequelles(c).length} séquelles` : esc(sequelles(c)[0].label)}</span>` : maladies(c).length ? `<span class="marque">${maladies(c).length > 1 ? `${maladies(c).length} maladies` : esc(maladies(c)[0].label)}</span>` : `${c.xp ?? 0} PX · Destin ${c.fate ?? 0}`}</span></span>
  </button>`;
}

/** Le héros qu'un bâtiment sert, en tête de sa page : portrait, nom, rôle et carrière, et sa `mesure` (sa vie, à
 *  défaut d'une autre). */
export function herosEnTete(h: J.Heros, taille: 'grand' | 'affiche' = 'grand', mesure = ligneDeVie(h.c)): string {
  const role = J.roleDe(h.carriere);
  const r = role && J.ROLES[role];
  return `<div class="heros-en-tete${J.valide(h) ? '' : ' hors'}">${portraitDeHeros(h, taille)}<div class="qui"><span class="nom-propre moyen gothique">${esc(h.c.label)}</span>
    <span class="sous-titre">${r ? `${picto(r.picto, 13, 1.8)}${esc(r.nom)} · ` : ''}${esc(carriereDe(h))}</span>${mesure}</div></div>`;
}

/** La carte d'un héros en ligne, là où il est déjà choisi (ses sacs) : la même grammaire que la carte,
 *  portrait, nom, vie et état hors de combat, sans geste. */
export function herosEnLigne(h: J.Heros): string {
  const c = h.c;
  return `<div class="heros-en-ligne${J.valide(h) ? '' : ' hors'}">${portrait(busteDuHeros(h), 'heros', 'petit')}<span class="qui"><span class="nom-propre petit gothique">${esc(c.label)}</span>${jauge(Math.max(0, c.wounds.current) / Math.max(1, c.wounds.max))}</span></div>`;
}

/** Ceux qui séjournent au bâtiment `ou` : chacun, ses jours restants et la jauge de son séjour ; un clic ouvre sa fiche. */
export const sejours = (e: J.Etat, ou: J.LieuDeSejour): string => e.roster.flatMap((h) => (h.sejour?.ou === ou ? [
  `<button type="button" class="sejour" data-a="heros" data-id="${h.c.id}">${portrait(busteDuHeros(h), 'heros', 'petit')}<span class="qui"><span class="nom-propre petit gothique">${esc(h.c.label)}</span>${sejourDe(h.sejour)}</span></button>`] : [])).join('');

/** L'encombrement porté et sa jauge ; au-delà de la capacité, ses pénalités. LDB 61 l.35-40 */
export function encombrementDe(c: Combatant) {
  const e = encombrement(c);
  const trop = e.porte > e.capacite;
  return `<div class="rub">Encombrement ${glose(`${e.porte} / ${e.capacite}${trop ? (e.immobile ? ' · immobilisé' : ` · Mouvement −${e.mouvement}, Agilité −${Math.abs(e.agilite)}`) : ''}`, trop ? 'avertissement' : 'courante')}</div>
    ${jauge(Math.min(1, e.porte / Math.max(1, e.capacite)), { teinte: trop ? 'cire' : 'or', taille: 'forte' })}`;
}

/** Les séquelles en étiquettes : une par nature (×N si plusieurs) et son issue ; le texte du livre au survol. */
export function etiquettesDeSequelles(c: Combatant) {
  const groupes = new Map<string, { n: number; jours?: number; chirurgie: boolean; desc?: string }>();
  for (const q of sequelles(c)) {
    const g = groupes.get(q.label);
    if (g) { g.n++; if (q.jours != null) g.jours = Math.max(g.jours ?? 0, q.jours); } else groupes.set(q.label, { n: 1, jours: q.jours, chirurgie: q.chirurgie, desc: q.desc });
  }
  const issue = (g: { jours?: number; chirurgie: boolean }) => (g.jours != null ? `repos ${g.jours} j` : g.chirurgie ? 'chirurgie' : 'permanente');
  return groupes.size ? `<div class="etiquettes-sequelles" aria-label="Séquelles">${[...groupes].map(([label, g]) =>
    `<span class="etiquette sequelle${g.jours == null && !g.chirurgie ? ' permanente' : ''}"${apercuDe({ nom: label, nature: `Séquelle · ${issue(g)}`, texte: g.desc })}>${esc(label)}${g.n > 1 ? ` ×${g.n}` : ''} · ${issue(g)}</span>`).join('')}</div>` : '';
}

/** La Corruption face à son seuil, les mutations et les maladies en étiquettes, à la manière des séquelles : la maladie
 *  dit sa phase et ses jours, ses symptômes au survol. LDB 19 l.80 ; LDB 20 */
export function etiquettesDeSouillure(c: Combatant) {
  const s = souillure(c);
  const m = maladies(c);
  const corruption = `<span class="etiquette sequelle${s.points > s.seuil ? ' permanente' : ''}"${apercuDe({ nom: 'Corruption', nature: `${s.points} / ${s.seuil}` })}>Corruption ${s.points} / ${s.seuil}</span>`;
  const mutations = s.mutations.map((l) => `<span class="etiquette sequelle permanente"${apercuDe({ nom: l, nature: 'Mutation' })}>${esc(l)}</span>`).join('');
  const malades = m.map((d) => {
    const phase = `${d.declaree ? 'déclarée' : 'incubation'} · ${d.jours} j`;
    return `<span class="etiquette sequelle"${apercuDe({ nom: d.label, nature: `Maladie · ${phase}`, texte: d.symptomes.join(', ') })}>${esc(d.label)} · ${phase}</span>`;
  }).join('');
  return `<div class="etiquettes-sequelles" aria-label="Corruption et maladies">${corruption}${mutations}${malades}</div>`;
}

// ─── Ce qu'on possède ou qu'on achète ───────────────────────────────────────────────────────────────────────

/** Une entrée : médaillon (ou portrait d'une personne), nom, état ; une action à droite (une plaque) ; l'aperçu au
 *  survol. Talents, sorts, provisions, prières, voyageurs et routes s'y montrent de la même façon. */
export function entree(o: { icone: string; portrait?: string; nom: string; etat: string; acquis?: boolean; ferme?: boolean; action?: string; apercu: Apercu }) {
  return `<div class="talent${o.acquis ? ' acquis' : ''}${o.ferme ? ' clos' : ''}"${apercuDe(o.apercu)}>${o.portrait ? portrait(o.portrait, 'heros', 'petit') : medaillon(o.icone, 'moyen', !!o.ferme)}<div class="t"><div class="nom-propre petit gothique">${esc(o.nom)}</div><i>${esc(o.etat)}</i></div>${o.action ?? ''}</div>`;
}

const PICTO_D_ARME: Record<string, string> = { 'grande-epee': 'epee', massue: 'marteau', fronde: 'arc' };
export const iconeDArme = (label: string) => (/bouclier/i.test(label) ? 'bouclier' : PICTO_D_ARME[armeDuLibelle(label) ?? 'epee'] ?? armeDuLibelle(label) ?? 'epee');
export const iconeDeProvision = (id: string) => (id.startsWith('potion') ? 'fiole' : 'pot');

/** Une case d'objet : son pictogramme, son compte, son nom dessous, son aperçu ; `attrs` en fait un bouton, `refus`
 *  le ferme et se dit au survol. Sans icône, la case est vide. */
export function caseObjet(o: { icone?: string; nom: string; apercu: Apercu; compte?: number; attrs?: string; refus?: string | null; taille?: 'grande' | 'petite' }) {
  const vide = !o.icone;
  const corps = `${vide ? '' : picto(o.icone!, o.taille === 'grande' ? 30 : 22, 1.6)}${o.compte && o.compte > 1 ? `<em class="chiffres">${o.compte}</em>` : ''}`;
  const apercu = apercuDe(o.apercu);
  const boite = o.attrs
    ? `<button type="button" class="boite-objet" ${o.attrs}${apercu}${o.refus ? ` disabled data-bulle="${esc(o.refus)}"` : ''}>${corps}</button>`
    : `<span class="boite-objet"${apercu}>${corps}</span>`;
  return `<div class="case-objet ${o.taille ?? 'petite'}${vide ? ' vide' : ''}">${boite}<span class="nom-objet">${esc(o.nom)}</span></div>`;
}

/** L'essentiel d'une pièce portée, en une ligne de chiffres. */
export const essentielDe = (x: J.PieceDecrite) => [x.degats && `Dégâts ${x.degats}`, x.mains === 2 && 'deux mains', x.allonge && `allonge ${x.allonge.toLowerCase()}`, x.portee && `portée ${x.portee} m`].filter(Boolean).join(' · ');
/** L'aperçu d'une pièce portée : son nom, ce qu'elle est, ses chiffres et ses qualités. */
export const apercuDePiece = (titre: string, x: J.PieceDecrite): Apercu => ({ nom: x.label, nature: titre, texte: [essentielDe(x), x.qualites.map((q) => q.nom).join(' · ')].filter(Boolean).join('\n') });
/** Les qualités d'un objet en étiquettes, à leur nom du livre ; son texte au survol. */
export const etiquettesDeQualites = (qs: readonly Qualite[]) => qs.map((q) => `<span class="etiquette rectangle qualite${q.defaut ? ' defaut' : ''}"${apercuDe({ nom: q.nom, nature: q.defaut ? 'Défaut' : 'Atout', texte: q.texte })}>${esc(q.nom)}</span>`).join('');
/** L'aperçu d'une provision : son nom et le texte du catalogue. */
export const apercuDeProvision = (id: string): Apercu => { const a = articleDuCatalogue(id); return { nom: a.label, nature: 'Provision', texte: a.desc }; };

/** Le sac d'un héros en cases ; `utilisable` : un clic utilise l'objet (en expédition). */
export const casesDuSac = (h: J.Heros, utilisable: boolean) => J.provisionsPortees(h).map((q) => caseObjet({
  icone: iconeDeProvision(q.id), nom: q.label, apercu: apercuDeProvision(q.id), compte: q.nombre,
  ...(utilisable ? { attrs: `data-a="utiliser" data-id="${h.c.id}" data-k="${q.uid}"`, refus: q.refus } : {}),
})).join('');

/** Le geste d'achat, seule forme d'un prix : une plaque « verbe · prix ». Faute de quoi payer, ou sur un `refus`,
 *  elle est fermée et dit pourquoi au survol ; un prix nul se dit « gratuit ». `suite` : ce qui s'ajoute au prix (des
 *  trophées). */
export function achat(o: { verbe: string; prix: number; avoir: number; attrs: string; monnaie?: 'CO' | 'PX'; refus?: string | null; suite?: string; icone?: string; taille?: 'petite' | 'moyenne' | 'appel' }) {
  const monnaie = o.monnaie ?? 'CO';
  const refus = o.refus ?? J.refusDuPrix(o.avoir, o.prix, monnaie);
  const prix = [o.prix ? `${o.prix} ${monnaie}` : 'gratuit', o.suite].filter(Boolean).join(' · ');
  return plaque(`${esc(o.verbe)} · ${esc(prix)}`, o.attrs, { armee: !refus, fermee: !!refus, taille: o.taille ?? 'moyenne', icone: o.icone ?? '', titre: refus ? esc(refus) : '' });
}

/** Ce qui se pose à un rectangle de la scène fixe : `data-rect`, que `ajusterLaScene` ancre au bord le plus proche. */
export const place = (rect: readonly number[]) => `data-rect="${rect.join(' ')}" style="left:${rect[0]}px;top:${rect[1]}px${rect[2] ? `;width:${rect[2]}px;height:${rect[3]}px` : ''}"`;
/** Un cadre du kit posé à son rectangle d'une scène fixe (`CADRES` des maquettes) ; `etire` : il prend la place que
 *  l'écran laisse au-delà de la vue de référence (`ajusterLaScene`). */
export const cadreA = (rect: [number, number, number, number], contenu: string, o: { ruban?: string; fond?: string; classe?: string; tete?: string; etire?: boolean } = {}) =>
  `<div class="place-cadre" ${place(rect)}${o.etire ? ' data-etire' : ''}>${cadre(contenu, { fond: o.fond ?? 'parchemin', ruban: o.ruban ?? '', classe: `pan ${o.classe ?? ''}`, balise: 'div', tete: o.tete ?? '' })}</div>`;
/** Les onglets du kit sur le bord haut d'un cadre : l'actif est le ruban, les autres des plaques. */
export const onglets = (noms: [string, string][], actif: string) => `<div class="onglets">${noms.map(([id, nomme]) => (id === actif ? `<div class="ruban gothique">${nomme}</div>` : plaque(nomme, `data-a="onglet" data-k="${id}"`, { taille: 'petite' }))).join('')}</div>`;
