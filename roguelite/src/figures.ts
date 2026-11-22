/**
 * Les figurines du combat, dans la manière des pions de la maquette de combat du kit (`FIGURES` et `pion` de
 * `combat/cour.js`, branche `chantier/4585-catalogue`) : tenue en dégradé diagonal, visage, coiffe, bouclier, arme, sur
 * un socle cerclé de la couleur du camp. Pied en (0, 0), boîte -50 -130 100 150.
 */

export interface Gabarit {
  taille: number;
  carrure: number;
  tenue: string;
  peau: string;
  cheveux?: string;
  barbe?: boolean;
  coiffe?: 'casque' | 'chapeau' | 'capuche' | 'crete' | 'heaume' | 'bonnet' | 'cornes' | 'oreilles' | 'casque-a-cornes';
  arme?: 'epee' | 'hache' | 'baton' | 'arc' | 'fronde' | 'lance' | 'fleau' | 'grande-epee' | 'massue' | 'dague';
  bouclier?: boolean;
  corps?: 'tunique' | 'robe' | 'voute' | 'os';
  bete?: 'loup' | 'rat';
}

const TENUES: Record<string, Partial<Gabarit>> = {
  soldat: { tenue: 'f-rouge', coiffe: 'casque' }, chasseur: { tenue: 'f-vert', coiffe: 'capuche' }, 'hors-la-loi': { tenue: 'f-cuir', coiffe: 'capuche' },
  pretre: { tenue: 'f-os', corps: 'robe', coiffe: 'capuche' }, sorcier: { tenue: 'f-rouge', corps: 'robe', coiffe: 'chapeau' },
  tueur: { tenue: 'f-cuir', coiffe: 'crete' }, repurgateur: { tenue: 'f-noir', coiffe: 'chapeau' }, 'pretre-guerrier': { tenue: 'f-acier', coiffe: 'casque' },
  duelliste: { tenue: 'f-robe', coiffe: 'chapeau' },
  'joueur-d-epee': { tenue: 'f-rouge', coiffe: 'casque' }, flagellant: { tenue: 'f-os' }, 'chasseur-de-primes': { tenue: 'f-noir', coiffe: 'chapeau' },
};

/** La famille d'une arme d'après son libellé, pour sa figure et son pictogramme. */
export function armeDuLibelle(libelle = ''): Gabarit['arme'] {
  const l = libelle.toLowerCase();
  if (/zweih|bâtarde|batarde|grande épée/.test(l)) return 'grande-epee';
  if (/arc|arbal/.test(l)) return 'arc';
  if (/fronde/.test(l)) return 'fronde';
  if (/hache/.test(l)) return 'hache';
  if (/fléau|fleau/.test(l)) return 'fleau';
  if (/lance|hallebarde|pique/.test(l)) return 'lance';
  if (/bâton|baton/.test(l)) return 'baton';
  if (/marteau|masse|gourdin/.test(l)) return 'massue';
  if (/dague|couteau/.test(l)) return 'dague';
  return 'epee';
}

/** Le gabarit d'un héros : sa carrière l'habille et le coiffe, son espèce lui donne sa taille, ses armes sa main. */
export function gabaritDuHeros(carriere: string, espece: string, armes: string[]): Gabarit {
  const nain = espece === 'nains', halfling = espece === 'halflings';
  return {
    taille: nain ? 0.8 : halfling ? 0.7 : 1, carrure: nain ? 1.3 : 1, tenue: 'f-cuir', peau: nain ? '#c99a7a' : '#d6b596', cheveux: nain ? '#8a3a12' : '#4a2f1b', barbe: nain,
    ...TENUES[carriere], arme: armeDuLibelle(armes[0]), bouclier: armes.some((a) => /bouclier/i.test(a)),
  };
}

/** Le gabarit d'une créature du Bestiaire, par famille. */
export function gabaritDeCreature(id: string): Gabarit {
  const peauVerte = '#7f9a62', base: Gabarit = { taille: 1, carrure: 1, tenue: 'f-cuir', peau: '#d6b596', cheveux: '#2a1d14', arme: 'epee' };
  if (/loup/.test(id)) return { ...base, bete: 'loup', tenue: 'f-fourrure' };
  if (/chien/.test(id)) return { ...base, taille: 0.8, bete: 'loup', tenue: 'f-fourrure' };
  if (/rat/.test(id)) return { ...base, taille: 0.75, bete: 'rat', tenue: 'f-rat' };
  if (/snotling/.test(id)) return { ...base, taille: 0.55, tenue: 'f-gob', peau: '#8ea064', coiffe: 'oreilles', arme: 'massue' };
  if (/gobelin/.test(id)) return { ...base, taille: 0.75, tenue: 'f-gob', peau: '#86a05e', coiffe: 'oreilles', arme: 'lance', bouclier: true };
  if (/orc/.test(id)) return { ...base, taille: 1.05, carrure: 1.35, tenue: 'f-orc', peau: peauVerte, arme: 'hache' };
  if (/troll/.test(id)) return { ...base, carrure: 1.5, tenue: 'f-troll', peau: '#6f7f6a', corps: 'voute', arme: 'massue' };
  if (/minotaure/.test(id)) return { ...base, taille: 1.05, carrure: 1.45, tenue: 'f-fourrure', peau: '#5a3a26', coiffe: 'cornes', arme: 'hache' };
  if (/ungor/.test(id)) return { ...base, taille: 0.9, tenue: 'f-fourrure', peau: '#7a5a3a', coiffe: 'cornes', arme: 'lance' };
  if (/gor|bestigor/.test(id)) return { ...base, carrure: 1.2, tenue: 'f-fourrure', peau: '#6b4a30', coiffe: 'cornes', arme: 'hache', bouclier: true };
  if (/chaos/.test(id)) return { ...base, taille: 1.1, carrure: 1.35, tenue: 'f-chaos', peau: '#2a2a30', coiffe: 'casque-a-cornes', arme: 'hache', bouclier: true };
  if (/chevalier/.test(id)) return { ...base, carrure: 1.15, tenue: 'f-noir', coiffe: 'heaume', arme: 'epee', bouclier: true };
  if (/squelette/.test(id)) return { ...base, tenue: 'f-os', peau: '#d8d2bf', corps: 'os', arme: 'epee', bouclier: true };
  if (/zombie|goule|necrophage/.test(id)) return { ...base, tenue: 'f-zombie', peau: '#8a9a7a', corps: 'voute', arme: undefined };
  if (/necromancien/.test(id)) return { ...base, tenue: 'f-noir', corps: 'robe', coiffe: 'capuche', arme: 'baton' };
  if (/cultiste/.test(id)) return { ...base, tenue: 'f-rouge', corps: 'robe', coiffe: 'capuche', arme: 'dague' };
  if (/mutant/.test(id)) return { ...base, carrure: 1.15, tenue: 'f-zombie', peau: '#b08a8a', corps: 'voute', arme: 'massue' };
  if (/brigand/.test(id)) return { ...base, tenue: 'f-cuir', coiffe: 'chapeau', arme: 'epee' };
  return base;
}

const p = (d: string, fill: string, extra = '') => `<path d="${d}" fill="${fill}"${extra ? ` ${extra}` : ''}/>`;
const trait = (d: string, couleur: string, epaisseur: number) => `<path d="${d}" stroke="${couleur}" stroke-width="${epaisseur}" stroke-linecap="round" fill="none"/>`;
const CONTOUR = 'stroke="#15100c" stroke-width=".8"';

const CORPS: Record<NonNullable<Gabarit['corps']>, string> = {
  tunique: 'M-13,0C-15,-20 -13,-38 -9,-48C-7,-54 7,-54 9,-48C13,-38 15,-20 13,0Z',
  robe: 'M-15,0C-16,-22 -12,-40 -9,-48C-7,-54 7,-54 9,-48C12,-40 16,-22 15,0Z',
  voute: 'M-15,0C-17,-18 -15,-32 -6,-44C0,-50 12,-48 15,-40C17,-28 16,-14 14,0Z',
  os: 'M-8,0L-6,-28L-9,-46C-6,-52 6,-52 9,-46L6,-28L8,0Z',
};

function coiffe(g: Gabarit, hy: number): string {
  switch (g.coiffe) {
    case 'casque': return p(`M-8.5,${hy}C-9.5,${hy - 13} 9.5,${hy - 13} 8.5,${hy}Z`, '#8a8e96', CONTOUR) + `<rect x="-1" y="${hy - 2}" width="2" height="7" fill="#5a5e66"/>`;
    case 'chapeau': return p(`M-15,${hy - 4}h30l-2,3h-26z`, '#2a1d14', CONTOUR) + p(`M-7,${hy - 4}c0,-10 14,-10 14,0z`, '#2a1d14', CONTOUR);
    case 'capuche': return p(`M-9.5,${hy + 4}C-12,${hy - 10} -4,${hy - 16} 0,${hy - 16}C4,${hy - 16} 12,${hy - 10} 9.5,${hy + 4}C6,${hy - 3} 3,${hy - 5} 0,${hy - 5}C-3,${hy - 5} -6,${hy - 3} -9.5,${hy + 4}Z`, `url(#${g.tenue})`, CONTOUR);
    case 'crete': return p(`M-2,${hy - 6}l1,-14 2,6 1,-9 2,9 1,8z`, '#e06a1a', CONTOUR);
    case 'heaume': return p(`M-8.5,${hy + 7}V${hy - 4}C-8.5,${hy - 12} 8.5,${hy - 12} 8.5,${hy - 4}V${hy + 7}Z`, '#8a8e96', CONTOUR) + `<rect x="-6" y="${hy - 2}" width="12" height="2" fill="#15100c"/>`;
    case 'bonnet': return p(`M-8,${hy - 1}C-8,${hy - 11} 8,${hy - 11} 8,${hy - 1}Z`, '#6a2a1a', CONTOUR) + p(`M6,${hy - 8}l8,3 -6,3z`, '#6a2a1a');
    case 'cornes': return p(`M-6,${hy - 5}C-14,${hy - 9} -17,${hy - 18} -13,${hy - 24}C-12,${hy - 17} -9,${hy - 13} -4,${hy - 9}ZM6,${hy - 5}C14,${hy - 9} 17,${hy - 18} 13,${hy - 24}C12,${hy - 17} 9,${hy - 13} 4,${hy - 9}Z`, '#d8cdb4', CONTOUR);
    case 'oreilles': return p(`M-6,${hy - 2}L-17,${hy - 9}L-6,${hy + 3}ZM6,${hy - 2}L17,${hy - 9}L6,${hy + 3}Z`, g.peau, CONTOUR);
    case 'casque-a-cornes': return p(`M-8.5,${hy + 1}C-9.5,${hy - 13} 9.5,${hy - 13} 8.5,${hy + 1}Z`, '#2a2a30', CONTOUR) + p(`M-7,${hy - 6}C-16,${hy - 10} -19,${hy - 20} -15,${hy - 27}C-14,${hy - 19} -10,${hy - 14} -5,${hy - 10}ZM7,${hy - 6}C16,${hy - 10} 19,${hy - 20} 15,${hy - 27}C14,${hy - 19} 10,${hy - 14} 5,${hy - 10}Z`, '#d8cdb4', CONTOUR);
    default: return g.cheveux ? p(`M-8,${hy}C-9,${hy - 12} 9,${hy - 12} 8,${hy}C4,${hy - 5} -4,${hy - 5} -8,${hy}Z`, g.cheveux) : '';
  }
}

function arme(g: Gabarit): string {
  switch (g.arme) {
    case 'epee': return trait('M13,-30L23,-60', '#d5d8de', 2.6) + trait('M9,-33L18,-29', '#3a2c1a', 2.4);
    case 'dague': return trait('M12,-28L18,-42', '#d5d8de', 2.2) + trait('M9,-30L15,-26', '#3a2c1a', 2);
    case 'grande-epee': return trait('M12,-22L26,-84', '#d5d8de', 3.2) + trait('M7,-28L20,-24', '#3a2c1a', 2.6);
    case 'hache': return trait('M14,-14L21,-66', '#4a3a28', 3.4) + p('M19,-70L34,-63L31,-46L22,-52Z', '#aeb2b8', 'stroke="#2a2c30" stroke-width=".9"');
    case 'lance': return trait('M12,4L20,-86', '#6b4a2a', 2.4) + p('M20,-94l4,10h-8z', '#cfd4dc', 'stroke="#2a2c30" stroke-width=".6"');
    case 'baton': return trait('M14,3L18,-88', '#6b5234', 2.8) + `<circle cx="18" cy="-90" r="4" fill="#9ad0ff" stroke="#2a3a5a" stroke-width=".8"/>`;
    case 'arc': return trait('M12,-62Q28,-36 12,-10', '#6b4a2a', 2.4) + trait('M12,-62L12,-10', '#cfc7b0', 0.8);
    case 'fronde': return trait('M12,-30L20,-48', '#5a3f26', 2) + `<circle cx="21" cy="-50" r="3" fill="#7a5a3a"/>`;
    case 'fleau': return trait('M12,-28L18,-50', '#4a3a28', 2.6) + trait('M18,-50Q24,-56 26,-50', '#5a5e66', 1.4) + `<circle cx="27" cy="-48" r="4" fill="#5a5e66" stroke="#2a2c30" stroke-width=".8"/>`;
    case 'massue': return trait('M12,-22L20,-56', '#5a3f26', 3.4) + `<ellipse cx="21" cy="-60" rx="6" ry="8" fill="#6a4c2e" stroke="#2a1d12" stroke-width=".9"/>`;
    default: return '';
  }
}

function bete(g: Gabarit): string {
  if (g.bete === 'rat') {
    return trait('M-24,-6C-38,-4 -42,-16 -36,-24', '#7a5a4a', 2.4)
      + p('M-24,-4C-26,-14 -16,-22 -2,-22C10,-22 18,-18 22,-12L30,-10L24,-6C22,-2 16,0 8,0Z', `url(#${g.tenue})`, CONTOUR)
      + `<circle cx="20" cy="-14" r="1.6" fill="#ff6a4a"/>` + p('M10,-20l4,-6 3,6z', '#6a4a3a');
  }
  return p('M-32,-16C-26,-30 -8,-32 8,-32C16,-32 20,-36 24,-42L28,-50L32,-42L37,-40L40,-34L33,-31C30,-25 26,-21 20,-21L20,-11L22,0H16L13,-15H-14L-18,0H-24L-22,-14C-26,-14 -30,-14 -32,-16Z', `url(#${g.tenue})`, CONTOUR)
    + p('M-32,-17C-40,-22 -44,-30 -41,-38C-38,-31 -34,-27 -28,-25Z', `url(#${g.tenue})`, CONTOUR) + `<circle cx="31" cy="-40" r="1.6" fill="#ffcf5a"/>`;
}

function humanoide(g: Gabarit): string {
  const corps = g.corps ?? 'tunique';
  const hy = corps === 'voute' ? -50 : -59;
  const hx = corps === 'voute' ? 8 : 0;
  let s = '';
  if (g.arme === 'lance' || g.arme === 'baton') s += arme(g);
  s += p(CORPS[corps], `url(#${g.tenue})`, `${CONTOUR} transform="scale(${g.carrure},1)"`);
  if (corps === 'os') s += trait('M-6,-40H6M-6,-34H6M-5,-28H5', '#5a5444', 1.2);
  s += `<g transform="translate(${hx},0)"><circle cx="0" cy="${hy}" r="7.2" fill="${g.peau}" ${CONTOUR}/>`;
  if (corps === 'os') s += `<circle cx="-2.5" cy="${hy - 1}" r="1.6" fill="#15100c"/><circle cx="2.5" cy="${hy - 1}" r="1.6" fill="#15100c"/>`;
  if (g.barbe) s += p(`M-6.5,${hy + 3}C-7,${hy + 14} 7,${hy + 14} 6.5,${hy + 3}C3,${hy + 6} -3,${hy + 6} -6.5,${hy + 3}Z`, g.cheveux ?? '#8a3a12');
  s += `${coiffe(g, hy)}</g>`;
  if (g.bouclier) s += `<ellipse cx="${-12 * g.carrure}" cy="-27" rx="9.5" ry="13.5" fill="#6f4d30" ${CONTOUR}/><ellipse cx="${-12 * g.carrure}" cy="-27" rx="6" ry="9.5" fill="none" stroke="#b9b3a4" stroke-width="1" opacity=".7"/><circle cx="${-12 * g.carrure}" cy="-27" r="2.4" fill="#b9b3a4"/>`;
  if (g.arme !== 'lance' && g.arme !== 'baton') s += arme(g);
  return s;
}

/** La figurine sur son socle : un `<svg>` dont le pied est au bas, tournée vers la droite (héros) ou la gauche. */
export function figurine(g: Gabarit, camp: 'heros' | 'ennemi'): string {
  const anneau = camp === 'ennemi' ? '#d2553a' : '#e9dcc0';
  const corps = g.bete ? bete(g) : humanoide(g);
  return `<svg class="figurine" viewBox="-50 -130 100 150" aria-hidden="true">
    <ellipse class="halo" cx="0" cy="0" rx="42" ry="20"/>
    <ellipse cx="7" cy="6" rx="28" ry="12" fill="#000" opacity=".5"/>
    <ellipse cx="0" cy="4" rx="24" ry="11" fill="#0b0807"/>
    <ellipse class="socle" cx="0" cy="0" rx="24" ry="11" fill="#201915" stroke="${anneau}" stroke-width="2"/>
    <g class="corps"><g transform="${camp === 'ennemi' ? 'scale(-1,1) ' : ''}scale(${g.taille})">${corps}</g></g>
  </svg>`;
}

/** Le buste d'une figurine : la même figure, cadrée sur sa tête, pour les portraits. */
export function buste(g: Gabarit, camp: 'heros' | 'ennemi'): string {
  const t = g.taille;
  const sens = camp === 'ennemi' ? -1 : 1;
  const voute = g.corps === 'voute';
  const tete: [number, number, number] = g.bete === 'rat' ? [16, -12, 12] : g.bete === 'loup' ? [28, -36, 16] : [voute ? 8 : 0, (voute ? -50 : -59) + 9, 19];
  const [cx, cy, r] = [tete[0] * sens * t, tete[1] * t, tete[2] * t];
  return `<svg class="buste-fig" viewBox="${cx - r} ${cy - r * 1.1} ${2 * r} ${2.3 * r}" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><g transform="${camp === 'ennemi' ? 'scale(-1,1) ' : ''}scale(${t})">${g.bete ? bete(g) : humanoide(g)}</g></svg>`;
}

/** Les dégradés de tenue (`teinte` de `cour.js` : clair, sombre, sombre assombri), posés une fois dans la page. */
const TEINTES: Record<string, [string, string]> = {
  'f-cuir': ['#b98a58', '#5a3d2a'], 'f-robe': ['#7c88ad', '#2b3350'], 'f-rouge': ['#b0503a', '#5a1a10'], 'f-vert': ['#7a8a4e', '#2f3a1f'],
  'f-noir': ['#5a5662', '#18161c'], 'f-acier': ['#b4b8c0', '#4a4e56'], 'f-os': ['#e0d8c0', '#7a7260'], 'f-orc': ['#7b8f5c', '#2f3a26'],
  'f-gob': ['#8ea064', '#3b4a2b'], 'f-fourrure': ['#8a7660', '#3a2c20'], 'f-rat': ['#7a6a5a', '#2e2620'], 'f-troll': ['#7a8a74', '#2a3428'],
  'f-chaos': ['#5a4a5a', '#141018'], 'f-zombie': ['#7a806a', '#2a2e24'],
};
const assombrir = (h: string) => `#${[1, 3, 5].map((k) => Math.round(parseInt(h.slice(k, k + 2), 16) * 0.65).toString(16).padStart(2, '0')).join('')}`;
export const DEGRADES_DES_FIGURINES = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${Object.entries(TEINTES).map(([id, [clair, sombre]]) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${clair}"/><stop offset=".55" stop-color="${sombre}"/><stop offset="1" stop-color="${assombrir(sombre)}"/></linearGradient>`).join('')}</defs></svg>`;
