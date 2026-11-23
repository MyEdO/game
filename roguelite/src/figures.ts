/**
 * Les figurines du combat et leurs bustes : des pions peints à plat, cernés d'encre, que la silhouette suffit à
 * nommer (coiffe, arme, bouclier, barbe, cornes). Pied en (0, 0), boîte -50 -130 100 150, regard vers la droite.
 */

type Signe = 'plastron' | 'masque' | 'cape' | 'coeur' | 'comete' | 'creves' | 'chaines' | 'tatouages' | 'tentacule' | 'carquois';

export interface Gabarit {
  taille: number;
  carrure: number;
  tenue: string;
  peau: string;
  cheveux?: string;
  barbe?: boolean;
  coiffe?: 'casque' | 'chapeau' | 'capuche' | 'crete' | 'heaume' | 'cornes' | 'casque-a-cornes' | 'capotain' | 'pointu' | 'plume' | 'beret' | 'feutre' | 'tonsure';
  arme?: 'epee' | 'hache' | 'baton' | 'arc' | 'arbalete' | 'fronde' | 'lance' | 'fleau' | 'grande-epee' | 'massue' | 'marteau' | 'dague';
  bouclier?: boolean;
  corps?: 'tunique' | 'robe' | 'voute' | 'os' | 'torse-nu' | 'armure' | 'brute';
  bete?: 'loup' | 'rat';
  /** La tête d'une engeance ; sans elle, un visage d'homme. */
  museau?: 'vert' | 'bouc' | 'crane' | 'troll' | 'mort';
  /** L'échelle de la tête sur le corps (nains et halflings ont la tête forte). */
  chef?: number;
  signes?: Signe[];
}

const TENUES: Record<string, Partial<Gabarit>> = {
  soldat: { tenue: 'f-rouge', coiffe: 'casque', signes: ['plastron'] },
  chasseur: { tenue: 'f-vert', coiffe: 'feutre', signes: ['cape', 'carquois'] },
  'hors-la-loi': { tenue: 'f-cuir', coiffe: 'capuche', signes: ['masque', 'cape'] },
  pretre: { tenue: 'f-os', corps: 'robe', coiffe: 'capuche', signes: ['coeur'] },
  sorcier: { tenue: 'f-rouge', corps: 'robe', coiffe: 'pointu' },
  tueur: { tenue: 'f-cuir', corps: 'torse-nu', coiffe: 'crete', cheveux: '#e8701c', barbe: true, signes: ['tatouages'] },
  repurgateur: { tenue: 'f-noir', coiffe: 'capotain', signes: ['cape'] },
  'pretre-guerrier': { tenue: 'f-acier', corps: 'armure', coiffe: 'tonsure', signes: ['cape', 'comete'] },
  duelliste: { tenue: 'f-robe', coiffe: 'plume', signes: ['cape'] },
  'joueur-d-epee': { tenue: 'f-or', coiffe: 'beret', signes: ['creves', 'plastron'] },
  flagellant: { tenue: 'f-os', corps: 'torse-nu', cheveux: '#6a5a48', barbe: true, signes: ['chaines'] },
  'chasseur-de-primes': { tenue: 'f-fourrure', coiffe: 'chapeau', signes: ['masque'] },
};

/** La famille d'une arme d'après son libellé, pour sa figure et son pictogramme. */
export function armeDuLibelle(libelle = ''): Gabarit['arme'] {
  const l = libelle.toLowerCase();
  if (/zweih|bâtarde|batarde|grande épée/.test(l)) return 'grande-epee';
  if (/arbal/.test(l)) return 'arbalete';
  if (/arc/.test(l)) return 'arc';
  if (/fronde/.test(l)) return 'fronde';
  if (/hache/.test(l)) return 'hache';
  if (/fléau|fleau/.test(l)) return 'fleau';
  if (/lance|hallebarde|pique/.test(l)) return 'lance';
  if (/bâton|baton/.test(l)) return 'baton';
  if (/marteau/.test(l)) return 'marteau';
  if (/masse|gourdin/.test(l)) return 'massue';
  if (/dague|couteau/.test(l)) return 'dague';
  return 'epee';
}

/** Le gabarit d'un héros : sa carrière l'habille et le coiffe, son espèce lui donne sa taille, ses armes sa main. */
export function gabaritDuHeros(carriere: string, espece: string, armes: string[]): Gabarit {
  const nain = espece === 'nains', halfling = espece === 'halflings';
  return {
    taille: nain ? 0.8 : halfling ? 0.7 : 1, carrure: nain ? 1.3 : 1, tenue: 'f-cuir', peau: nain ? '#c99a7a' : '#d6b596',
    cheveux: nain ? '#8a3a12' : halfling ? '#7a4a22' : '#4a2f1b', barbe: nain, chef: nain ? 1.18 : halfling ? 1.22 : 1,
    ...TENUES[carriere], arme: armeDuLibelle(armes[0]), bouclier: armes.some((a) => /bouclier/i.test(a)),
  };
}

/** Le gabarit d'une créature du Bestiaire, par famille. */
export function gabaritDeCreature(id: string): Gabarit {
  const base: Gabarit = { taille: 1, carrure: 1, tenue: 'f-cuir', peau: '#d6b596', cheveux: '#2a1d14', arme: 'epee' };
  const vert: Gabarit = { ...base, tenue: 'f-gob', peau: '#86a05e', museau: 'vert', cheveux: undefined };
  const bouc: Gabarit = { ...base, tenue: 'f-fourrure', corps: 'torse-nu', museau: 'bouc', coiffe: 'cornes', cheveux: undefined };
  if (/loup-funeste/.test(id)) return { ...base, taille: 1.2, bete: 'loup', tenue: 'f-noir' };
  if (/loup/.test(id)) return { ...base, bete: 'loup', tenue: 'f-fourrure' };
  if (/chien/.test(id)) return { ...base, taille: 0.8, bete: 'loup', tenue: 'f-cuir' };
  if (/rat/.test(id)) return { ...base, taille: 0.75, bete: 'rat', tenue: 'f-rat' };
  if (/sorcier|necromancien/.test(id)) return { ...base, tenue: 'f-noir', peau: '#c9c2a8', corps: 'robe', coiffe: 'capuche', arme: 'baton', barbe: true, cheveux: '#b9b3a4' };
  if (/snotling/.test(id)) return { ...vert, taille: 0.55, peau: '#9ab06a', chef: 1.3, arme: 'massue' };
  if (/chamane/.test(id)) return { ...vert, taille: 0.75, tenue: 'f-noir', corps: 'robe', coiffe: 'cornes', chef: 1.15, arme: 'baton' };
  if (/gobelin/.test(id)) return { ...vert, taille: 0.75, tenue: 'f-noir', coiffe: 'capuche', chef: 1.15, arme: 'lance', bouclier: true };
  if (/orc/.test(id)) return { ...vert, taille: 1.05, tenue: 'f-orc', peau: '#6f8a52', corps: 'brute', arme: 'hache' };
  if (/troll/.test(id)) return { ...base, taille: 1.1, tenue: 'f-troll', peau: '#7d8c7a', corps: 'brute', museau: 'troll', cheveux: undefined, arme: 'massue' };
  if (/minotaure/.test(id)) return { ...bouc, taille: 1.08, carrure: 1.1, peau: '#5a3a26', corps: 'brute', chef: 1.2, arme: 'hache' };
  if (/ungor/.test(id)) return { ...bouc, taille: 0.88, carrure: 0.9, peau: '#8a6a48', arme: 'lance' };
  if (/gor/.test(id)) return { ...bouc, carrure: 1.15, peau: '#6b4a30', chef: 1.1, arme: 'hache', bouclier: true };
  if (/chaos/.test(id)) return { ...base, taille: 1.1, carrure: 1.2, tenue: 'f-chaos', corps: 'armure', coiffe: 'casque-a-cornes', arme: 'hache', bouclier: true, signes: ['cape'] };
  if (/chevalier/.test(id)) return { ...base, carrure: 1.1, tenue: 'f-noir', corps: 'armure', coiffe: 'heaume', arme: 'epee', bouclier: true };
  if (/squelette/.test(id)) return { ...base, tenue: 'f-rouge', peau: '#d8d2bf', corps: 'os', museau: 'crane', cheveux: undefined, bouclier: true };
  if (/goule|necrophage/.test(id)) return { ...base, tenue: 'f-zombie', peau: '#a9b09a', corps: 'voute', museau: 'mort', cheveux: undefined, arme: undefined };
  if (/zombie/.test(id)) return { ...base, tenue: 'f-cuir', peau: '#8a9a7a', corps: 'voute', museau: 'mort', arme: undefined };
  if (/cultiste/.test(id)) return { ...base, tenue: 'f-rouge', corps: 'robe', coiffe: 'capuche', arme: 'dague', signes: ['masque'] };
  if (/mutant/.test(id)) return { ...base, carrure: 1.1, tenue: 'f-zombie', peau: '#b08a8a', corps: 'voute', coiffe: 'cornes', arme: 'massue', signes: ['tentacule'], cheveux: undefined };
  if (/brigand/.test(id)) return { ...base, coiffe: 'chapeau', signes: ['masque'] };
  return base;
}

const ENCRE = '#15100c';
const C = `stroke="${ENCRE}" stroke-width=".8" stroke-linejoin="round"`;
const p = (d: string, fill: string, extra = C) => `<path d="${d}" fill="${fill}"${extra ? ` ${extra}` : ''}/>`;
const trait = (d: string, couleur: string, epaisseur: number, extra = '') => `<path d="${d}" stroke="${couleur}" stroke-width="${epaisseur}" stroke-linecap="round" stroke-linejoin="round" fill="none"${extra ? ` ${extra}` : ''}/>`;
const rond = (x: number, y: number, r: number, fill: string, extra = '') => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"${extra ? ` ${extra}` : ''}/>`;
const assombrir = (h: string, k = 0.65) => `#${[1, 3, 5].map((i) => Math.round(parseInt(h.slice(i, i + 2), 16) * k).toString(16).padStart(2, '0')).join('')}`;
/** Un trait cerné : d'encre dessous, de `couleur` dessus (os, hampes, cordes). */
const cerne = (d: string, couleur: string, e: number) => trait(d, ENCRE, e + 1.5) + trait(d, couleur, e);

const ACIER = 'url(#f-acier)', BRONZE = '#c9a14a', LAME = '#d9dce2', HAMPE = '#6b4a2a';

/** Les teintes de tenue (clair, sombre) ; leurs dégradés sont posés une fois dans la page. */
const TEINTES: Record<string, [string, string]> = {
  'f-cuir': ['#b98a58', '#5a3d2a'], 'f-robe': ['#7c88ad', '#2b3350'], 'f-rouge': ['#b0503a', '#5a1a10'], 'f-vert': ['#7a8a4e', '#2f3a1f'],
  'f-noir': ['#5a5662', '#18161c'], 'f-acier': ['#c0c4cc', '#4a4e56'], 'f-os': ['#ece4cc', '#8a8068'], 'f-orc': ['#7b6a4c', '#2f2a1e'],
  'f-gob': ['#8a6a44', '#3b2a1b'], 'f-fourrure': ['#8a7660', '#3a2c20'], 'f-rat': ['#7a6a5a', '#2e2620'], 'f-troll': ['#6a5a40', '#2a2418'],
  'f-chaos': ['#6a4a5a', '#141018'], 'f-zombie': ['#7a806a', '#2a2e24'], 'f-or': ['#e0b24e', '#7a4a16'],
};

// ——— les armes, tenues par la main droite en (13.5, -35) ———
function arme(g: Gabarit): string {
  const lame = (d: string) => p(d, LAME, 'stroke="#2a2c30" stroke-width=".7" stroke-linejoin="round"');
  switch (g.arme) {
    case 'epee': return lame('M13.2,-38.6L16,-37.6L22.8,-63L22.4,-67.4L19.6,-64Z') + cerne('M11,-36.6L18.2,-39.4', BRONZE, 1.6) + cerne('M12.4,-31.6L14.2,-37', '#3a2c1a', 1.8);
    case 'dague': return lame('M13.4,-38.4L15.8,-37.6L19.4,-50L19.2,-53L17,-50.6Z') + cerne('M11.6,-37L17.4,-39', BRONZE, 1.4) + cerne('M12.6,-32.4L14.2,-37', '#3a2c1a', 1.8);
    case 'grande-epee': return lame('M13.6,-44.6L17.4,-43.6L25,-83L24.4,-88L21,-84Z') + cerne('M9.4,-42L21.6,-46.4', BRONZE, 1.9) + cerne('M11.2,-26L15,-43', '#3a2c1a', 2) + rond(11, -25, 1.8, BRONZE, C);
    case 'hache': return cerne('M10.6,-20L19.4,-66', HAMPE, 2.4) + lame('M17.6,-67C25,-72.4 34,-67 34.6,-55C29,-58.6 24,-58 19.4,-55.4Z') + trait('M20.6,-64.6C25,-66.6 29.6,-64 31.6,-59.6', '#f4f6f8', 0.8);
    case 'marteau': return cerne('M10.6,-20L19.4,-64', HAMPE, 2.4) + p('M12.4,-70.4L27.6,-66.6L25.6,-57L10.4,-60.8Z', ACIER) + trait('M19.6,-68.6L17.8,-59', BRONZE, 1.6);
    case 'massue': return p('M11.6,-24L15.6,-23L24.6,-55C26,-61 19,-64 16.6,-58.4Z', '#6a4c2e') + trait('M17.4,-56l-3.4,-1.2M21.6,-48.6l3.6,.6M17,-47l-3.4,-.4M22.6,-57l3,-1.6', '#cfc7b0', 1.5);
    case 'lance': return cerne('M9.6,1L19.4,-86', HAMPE, 1.9) + lame('M19.2,-83.4L15.6,-88.4L20.6,-98L23.4,-87.4Z');
    case 'baton': return cerne('M9.6,1L18.6,-80', '#5a4226', 2.2) + trait('M18.6,-80C16,-88 22,-92.6 25.6,-88.4', '#5a4226', 2.2)
      + rond(21, -86.4, 7, g.tenue === 'f-noir' ? '#7adf6a' : '#ffb347', 'opacity=".3"') + rond(21, -86.4, 3.2, g.tenue === 'f-noir' ? '#b6f59a' : '#ffd778', C);
    case 'arc': return cerne('M8,-63Q21.5,-35.5 8,-8', '#7a5230', 2.2) + trait('M8,-63L8,-8', '#e9dcc0', 0.6);
    case 'arbalete': return cerne('M6,-36L26,-41.6', '#6b4a2a', 3) + cerne('M23,-53Q31.6,-42.6 25,-30.6', '#3a3c42', 1.8) + trait('M23,-53L12,-37.6L25,-30.6', '#e9dcc0', 0.6);
    case 'fronde': return trait('M13.5,-35C12,-28 14,-22 17,-18M13.5,-35C16,-28 18,-23 17,-18', '#5a3f26', 1.1) + rond(17, -17, 3.2, '#8a8478', C);
    case 'fleau': return cerne('M11,-27L17,-52', '#4a3a28', 2.2) + trait('M17,-52Q23,-60 27,-51', '#8a8e96', 1.3, 'stroke-dasharray="1.6 1.3"')
      + p('M27,-51l2.2,-5.4 1.2,3.6 4,-1.4 -2.2,3.6 3,2.4 -4,.6 .2,4.2 -3,-2.8 -3.4,2 1.2,-3.8 -3,-2Z', '#5a5e66');
    default: return '';
  }
}

/** Le bouclier au bras gauche : l'écu des gens d'armes, la rondache des engeances. */
function bouclier(g: Gabarit): string {
  const x = -13 * g.carrure;
  if (g.museau || g.coiffe === 'casque-a-cornes') {
    const chaos = g.tenue === 'f-chaos';
    return `<ellipse cx="${x}" cy="-37" rx="10.6" ry="12.6" fill="${chaos ? '#2a1a22' : '#6f4d30'}" ${C}/><ellipse cx="${x}" cy="-37" rx="7.6" ry="9.4" fill="none" stroke="${chaos ? BRONZE : '#3a2a1a'}" stroke-width="1.1"/>`
      + (chaos ? trait(`M${x},-46v18M${x - 7},-37h14M${x - 5},-43.4l10,12.8M${x + 5},-43.4l-10,12.8`, BRONZE, 0.9) : rond(x, -37, 2.8, '#9a9488', C));
  }
  return `<g transform="translate(${x},0)">${p('M-9.4,-50Q0,-52.6 9.4,-50V-38C9.4,-30 0,-24.4 0,-24.4C0,-24.4 -9.4,-30 -9.4,-38Z', `url(#${g.tenue === 'f-acier' ? 'f-rouge' : g.tenue})`)}${p('M0,-51.4V-24.4C0,-24.4 9.4,-30 9.4,-38V-50Q4.6,-51.2 0,-51.4Z', '#e9dcc0', 'opacity=".85"')}${p('M-9.4,-50Q0,-52.6 9.4,-50V-38C9.4,-30 0,-24.4 0,-24.4C0,-24.4 -9.4,-30 -9.4,-38Z', 'none', 'stroke="#15100c" stroke-width="1.5" stroke-linejoin="round"')}${rond(0, -40, 2, BRONZE, C)}</g>`;
}

// ——— les têtes, dessinées autour de leur centre (0, 0) ———
function visage(g: Gabarit): string {
  const o = assombrir(g.peau, 0.72);
  let s = p('M-6.2,-2C-6.4,4 -3.6,8.4 0,8.4C3.6,8.4 6.4,4 6.2,-2C6.2,-9.6 -6.2,-9.6 -6.2,-2Z', g.peau)
    + p('M-6.2,-2C-6.4,4 -3.6,8.4 0,8.4C-2.6,5 -3.8,0 -3,-8C-5,-7 -6.2,-5 -6.2,-2Z', '#000', 'opacity=".13"');
  if (g.museau === 'mort') return s + `<ellipse cx="-2.6" cy="-.4" rx="1.9" ry="2.1" fill="#1a1410"/><ellipse cx="2.8" cy="-.4" rx="1.9" ry="2.1" fill="#1a1410"/>${rond(-2.4, -0.2, 0.6, '#e9e2c0')}${rond(3, -0.2, 0.6, '#e9e2c0')}`
    + p('M-2.6,4.2Q0,3.2 2.8,4.2Q2,7.4 0,7.4Q-2,7.4 -2.6,4.2Z', '#1a1410', '') + trait('M-1.4,4.2v1.2M1.4,4.2v1.2', '#e9e2c0', 0.7);
  s += trait('M-3.5,.2h1.9M1.9,.2h1.9', '#1a110b', 1.25) + trait('M-4.3,-1.9l3,.7M4.7,-1.9l-3,.7', '#2a1c12', 0.6)
    + trait('M.5,.8l.9,2.5l-1.6,.3', o, 0.7) + trait('M-1.5,5.3q1.6,.6 3.2,0', '#6a3222', 0.7);
  if (g.signes?.includes('masque')) s += p('M-6.3,1.8Q0,3.8 6.3,1.8C6.2,5.4 3.6,8.6 0,8.6C-3.6,8.6 -6.2,5.4 -6.3,1.8Z', '#6a1c12');
  if (g.barbe) {
    const b = g.cheveux ?? '#8a3a12';
    s += p('M-6.4,.6C-8.6,10 -5,19 -1.6,23L0,20.4L1.6,23C5,19 8.6,10 6.4,.6C5,4 2.8,4.4 0,3.4C-2.8,4.4 -5,4 -6.4,.6Z', b)
      + trait('M-3,9v9M3,9v9M0,8v10', assombrir(b, 0.6), 0.6) + trait('M-4,3.9Q-1.6,2.6 0,3.6Q1.6,2.6 4,3.9', assombrir(b, 0.6), 0.9) + rond(0.4, 2, 1.7, o, C);
  }
  return s;
}

const MUSEAUX: Record<'vert' | 'bouc' | 'crane' | 'troll', (g: Gabarit) => string> = {
  vert: (g) => p('M-5.5,-1L-17.6,-6.4L-6,3.4ZM5.5,-1L17.6,-6.4L6,3.4Z', g.peau)
    + p('M-7,-3C-7,-9.4 7,-9.4 7,-3L7.6,4C6,9.4 -6,9.4 -7.6,4Z', g.peau) + p('M-6.8,-2.6H6.8L5,.2H-5Z', '#000', 'opacity=".32"')
    + rond(-2.8, -0.6, 1.1, '#f2562c') + rond(2.8, -0.6, 1.1, '#f2562c') + trait('M-4.8,5H4.8', '#1a1410', 1) + trait('M-.9,2.2v.1M.9,2.2v.1', '#1a1410', 0.9)
    + p('M-4.4,5.2l1,-3.4 1,3.4ZM2.4,5.2l1,-3.4 1,3.4Z', '#efe6c8', 'stroke="#15100c" stroke-width=".4"'),
  bouc: (g) => p('M-5,-3.4l-7.6,2.4 6.4,2.8Z', assombrir(g.peau, 0.8))
    + p('M-6,-5C-6,-10 5,-10 6.5,-5L11.4,4C11.6,7 7.4,8 5,7.4L3.6,13L1,7.2C-4,7 -6.6,1 -6,-5Z', g.peau)
    + rond(3, -2.8, 1.3, '#ffcf5a', 'stroke="#15100c" stroke-width=".4"') + trait('M2.6,-2.8h.9', '#15100c', 0.7) + rond(9.6, 4, 0.7, '#15100c') + trait('M5.4,6L10.8,5.6', '#15100c', 0.7)
    + (g.corps === 'brute' ? `<circle cx="10.4" cy="6.6" r="1.8" fill="none" stroke="${BRONZE}" stroke-width=".9"/>` : ''),
  crane: (g) => p('M-6.2,-2C-6.2,-10 6.2,-10 6.2,-2C6.2,2 5,3.6 4,4.4V8.2H-4V4.4C-5,3.6 -6.2,2 -6.2,-2Z', g.peau)
    + '<ellipse cx="-2.6" cy="-.6" rx="1.9" ry="2.2" fill="#15100c"/><ellipse cx="2.6" cy="-.6" rx="1.9" ry="2.2" fill="#15100c"/>'
    + p('M0,1.8l-1,2.2h2Z', '#15100c', '') + trait('M-3.6,5.8H3.6M-2,4.8v3M0,4.8v3M2,4.8v3', '#15100c', 0.5),
  troll: (g) => p('M-6.6,-3L-15,-8L-8,3Z', g.peau)
    + p('M-7.5,-3C-8,-10.4 6,-11 8,-4L9.4,3C9.4,8.4 3,10.4 -2,9.6C-6,9 -8,4 -7.5,-3Z', g.peau) + p('M4.6,-2.6C9.6,-1.6 12,3 9,5.6C7,5.2 5.2,3 4.6,-2.6Z', assombrir(g.peau, 0.78))
    + rond(1.8, -3.6, 1.1, '#ffd24a') + rond(-3.2, -3.4, 1.1, '#ffd24a') + trait('M-1,6.8H8', '#15100c', 0.9)
    + p('M1,6.8l1,-2.8 1,2.8ZM5,6.8l1,-2.8 1,2.8Z', '#efe6c8', 'stroke="#15100c" stroke-width=".4"') + rond(-4.6, 3, 0.8, assombrir(g.peau, 0.7)) + rond(-2, -7, 0.7, assombrir(g.peau, 0.7)),
};

const CORNES = 'M-5,-5.4C-13,-8 -17.4,-16 -13.6,-24.6C-12,-17 -8.6,-12.6 -3,-9ZM5,-5.4C13,-8 17.4,-16 13.6,-24.6C12,-17 8.6,-12.6 3,-9Z';
const BORD = 'M-14,-3.2Q0,-8 14,-3.2Q0,-.4 -14,-3.2Z';

function coiffe(g: Gabarit): string {
  const t = `url(#${g.tenue})`;
  switch (g.coiffe) {
    case 'casque': return p('M-7,-2.6C-7.4,-12.6 7.4,-12.6 7,-2.6Z', '#9a9ea6') + p('M-10.8,-2Q0,-6.2 10.8,-2L10,-.2Q0,-3.8 -10,-.2Z', '#c6cad0') + trait('M0,-10.2v5', '#5a5e66', 0.9);
    case 'chapeau': return p('M-6.6,-5C-7,-13 7,-13 6.6,-5Q0,-6.8 -6.6,-5Z', '#4a3524') + p(BORD, '#3a2819') + trait('M-6.4,-6.4Q0,-8.2 6.4,-6.4', '#1c130c', 1.3);
    case 'capotain': return p('M-6.2,-5L-4.6,-18Q0,-19.6 4.6,-18L6.2,-5Q0,-6.8 -6.2,-5Z', '#24202a') + p(BORD, '#1b181f') + trait('M-5.9,-7.6Q0,-9.4 5.9,-7.6', '#6a5a3a', 1.7)
      + `<rect x="-1.7" y="-10" width="3.4" height="3" fill="none" stroke="${BRONZE}" stroke-width=".9"/>`;
    case 'pointu': return p('M-6.6,-5C-5,-12 -3,-19 5.6,-25.4C3.6,-18 6,-11 6.6,-5Q0,-6.8 -6.6,-5Z', t) + p('M-12.6,-3.2Q0,-7.8 12.6,-3.2Q0,-.6 -12.6,-3.2Z', t) + trait('M-6.2,-7.2Q0,-9 6.3,-7.2', BRONZE, 1.4);
    case 'plume': return p('M-4,-8.6C-13,-10 -19.6,-17 -16.4,-26.4C-11,-21 -6,-17 -1.6,-10.4Z', '#ece4cc') + trait('M-3,-10C-9,-13 -13.6,-18 -15.4,-23.6', '#8a8068', 0.6)
      + p('M-6.4,-5C-7,-12.4 6.6,-13 6.6,-5Q0,-6.8 -6.4,-5Z', t) + p('M-13.4,-6Q0,-8 15,-1.6Q2,-.4 -13.4,-6Z', t) + trait('M-6.2,-6.6Q0,-8.4 6.4,-6.4', BRONZE, 1.1);
    case 'beret': return p('M-8,-8C-14,-11 -17.6,-17 -16,-23C-12,-18.6 -9,-15 -5,-10Z', '#ece4cc') + p('M-5.6,-9C-10,-13 -11.6,-19 -9,-24C-7,-19 -5,-15 -2.6,-10.6Z', '#b0352a')
      + p('M-12.6,-4C-13.6,-11.6 10,-14.6 13.2,-5.4Q0,-2.4 -12.6,-4Z', t) + trait('M-8,-8.6l1.4,3.6M-2,-10.6l1,4.2M4.6,-10.6l.4,4.4M9.6,-8.6l-.4,3', '#7c1f14', 1);
    case 'feutre': return p('M-3,-9.6L-14.6,-20L-8.6,-10.6Z', '#b0503a') + p('M-7,-3C-8,-11 1,-13.6 5,-9.4L15.6,-3L3,-2Q-3,-4 -7,-3Z', t);
    case 'capuche': return p('M-8.8,8.6C-12,-5 -6.6,-13 0,-13.4C6.6,-13 12,-5 8.8,8.6C8.2,1 5.8,-5.4 0,-5.6C-5.8,-5.4 -8.2,1 -8.8,8.6Z', t) + p('M-6,-1.4C-5.4,-5.6 5.4,-5.6 6,-1.4C3,-3.6 -3,-3.6 -6,-1.4Z', '#000', 'opacity=".35"');
    case 'crete': return p('M-2.8,-6.4C-4.6,-13 -3.4,-20 -1.6,-25L.2,-19L2.4,-27L3.6,-19.4L6.2,-23C6.6,-15 5.4,-10 3.4,-6.6Z', g.cheveux ?? '#e8701c');
    case 'tonsure': return p('M-6.3,.6C-7.8,-3.4 -6.8,-6.4 -5.2,-7L-5.2,-1ZM6.3,.6C7.8,-3.4 6.8,-6.4 5.2,-7L5.2,-1Z', g.cheveux ?? '#4a2f1b');
    case 'heaume': return p('M-7.4,8.8V-3C-7.4,-11.8 7.4,-11.8 7.4,-3V8.8Q0,10.6 -7.4,8.8Z', '#6a6e76') + trait('M-5.6,-1.2H5.6', '#0b0807', 2) + trait('M0,-9.6V9.4', '#2a2c30', 0.8)
      + rond(-2.6, -1.2, 0.8, '#9adf7a') + rond(2.6, -1.2, 0.8, '#9adf7a');
    case 'cornes': return p(CORNES, '#d8cdb4', `${C} transform="scale(${g.corps === 'brute' ? '1.25,1' : g.carrure < 1 ? 0.7 : 1})"`);
    case 'casque-a-cornes': return p(CORNES, '#cfc4a8', C) + p('M-7.6,8.8V-3C-7.6,-12.2 7.6,-12.2 7.6,-3V8.8L0,11.6Z', '#2a2430')
      + trait('M-7.4,-4.6Q0,-7 7.4,-4.6M0,-11.4V11', '#8a6a26', 0.9) + trait('M-5,-1.4L-1.4,-.2M5,-1.4L1.4,-.2', '#ff5a3a', 1.3);
    default: return g.cheveux && !g.museau ? p('M-6.5,-.4C-8.4,-11.4 8.4,-11.4 6.5,-.4C5.4,-4.6 2.4,-6.8 -1,-6.2C-4,-5.8 -5.8,-3.8 -6.5,-.4Z', g.cheveux) : '';
  }
}

/** Où se tient la tête d'un corps. */
const tete = (g: Gabarit): [number, number] => (g.corps === 'voute' ? [5, -56] : g.corps === 'brute' ? [0, -58] : [0, -62]);
/** De combien la main droite s'écarte de (13.5, -35). */
const MAIN: Partial<Record<NonNullable<Gabarit['corps']>, string>> = { voute: 'translate(9,5) rotate(18,13.5,-35)', brute: 'translate(6.4,8)' };

const JAMBES = 'M-8.4,-36L-9.6,-9V0H-.4L-1.6,-3.4L-.8,-36ZM.8,-36L1.6,-9V0H12L10.6,-3.4L8.4,-36Z';
const BOTTES = 'M-9.6,-12V0H-.4L-1.6,-3.4L-1.5,-12ZM1.6,-12V0H12L10.6,-3.4L9.5,-12Z';
const HAUT = 'M-10,-55C-12.6,-48 -12,-40 -11,-34Q0,-32 11,-34C12,-40 12.6,-48 10,-55Q0,-58.4 -10,-55Z';
const JUPE = 'M-11,-34.6L-12.8,-20.6Q0,-18 12.8,-20.6L11,-34.6Q0,-32.6 -11,-34.6Z';
const BRAS_G = 'M-9.6,-54.6C-15,-52 -16.4,-43 -15,-35.4L-10.8,-36C-11.4,-42 -10.4,-48 -8,-51Z';
const BRAS_D = 'M9.6,-54.6C15,-52.6 17,-45 15.8,-37L11.6,-37C11.6,-43 10.6,-48.6 8,-51Z';

/** Le corps debout : `[derrière la tenue, la tenue, par-dessus la main armée]`. */
function debout(g: Gabarit): [string, string, string] {
  const t = `url(#${g.tenue})`, a = (s: Signe) => g.signes?.includes(s), nu = g.corps === 'torse-nu', armure = g.corps === 'armure';
  const chair = nu ? g.peau : t, sombre = TEINTES[g.tenue]?.[1] ?? '#2a1d14';
  let dos = '';
  if (a('cape')) dos += p('M-10.6,-55C-18.6,-42 -19,-20 -16.4,-5Q0,-9.6 16.4,-5C19,-20 18.6,-42 10.6,-55Z', g.tenue === 'f-acier' ? '#7c1f14' : assombrir(sombre, 0.85));
  if (a('carquois') || g.arme === 'arc' || g.arme === 'arbalete') dos += p('M-13.6,-60L-7,-40L-3,-41.6L-9.6,-61.6Z', '#5a3d2a') + trait('M-12.6,-61l-1.6,-5M-10.6,-61.6l-.6,-5.6', '#e9dcc0', 1.1);
  let s = p(JAMBES, armure ? '#7a7e86' : g.museau === 'bouc' ? assombrir(g.peau, 0.8) : '#3d2e24') + p(BOTTES, armure ? '#5a5e66' : '#1e1510');
  s += a('tentacule') ? trait('M-9,-46C-20,-48 -27,-40 -23,-31C-20,-25 -14,-28 -16.4,-33', '#8a4a6a', 4.4) : p(BRAS_G, chair) + rond(-12.9, -33.6, 2.3, g.peau, C);
  s += p(JUPE, t) + p(HAUT, chair);
  if (nu) s += trait('M-7,-46.4Q-3.4,-44 0,-46.4Q3.4,-44 7,-46.4M0,-46V-37', assombrir(g.peau, 0.7), 0.7);
  if (a('tatouages')) s += trait('M-6.6,-51q3.4,2.6 .4,6M6,-51q-3.4,2 -1,5.6M-4,-40q2,-2 4,0', '#35568a', 1);
  if (a('chaines')) s += trait('M-9.6,-52L9,-37', '#8a8e96', 1.7, 'stroke-dasharray="1.7 1.2"') + trait('M-5,-49l2,4M3,-50l-1.6,3.6M5,-44l-2,2', '#8a2a1c', 0.7);
  if (armure) s += trait('M-10.6,-41Q0,-39 10.6,-41M-12,-27.6Q0,-25 12,-27.6M0,-56V-34', '#00000066', 0.8) + p('M-10,-56C-17.6,-57.6 -19.6,-50 -16,-45.6L-8.6,-49ZM10,-56C17.6,-57.6 19.6,-50 16,-45.6L8.6,-49Z', t);
  if (a('plastron')) s += p('M-7.6,-54.4C-9.4,-48 -8.8,-41 -7.6,-36.6Q0,-35 7.6,-36.6C8.8,-41 9.4,-48 7.6,-54.4Q0,-57 -7.6,-54.4Z', ACIER) + trait('M0,-56V-36', '#5a5e66', 0.7);
  if (a('creves')) s += p('M-9,-56C-17,-57 -19,-48 -15.6,-43L-8.6,-47ZM9,-56C17,-57 19,-48 15.6,-43L8.6,-47Z', t) + trait('M-14.6,-53l2,6M-11.6,-54.4l1.4,5.6M14.6,-53l-2,6M11.6,-54.4l-1.4,5.6', '#7c1f14', 1);
  if (a('coeur')) s += p('M0,-45.6c-2.6,-3.6 -6,-1 -3.6,2.2L0,-40L3.6,-43.4C6,-46.6 2.6,-49.2 0,-45.6Z', '#b0352a');
  if (a('comete')) s += rond(2, -48.6, 2, BRONZE, C) + p('M.8,-47L-5.4,-39.6L-1.6,-43L-2.6,-37.6L2.4,-46Z', BRONZE, 'stroke="#15100c" stroke-width=".4"');
  s += trait('M-11.1,-34.4Q0,-32.4 11.1,-34.4', '#24170e', 2.4) + `<rect x="-1.6" y="-35.2" width="3.2" height="3.2" fill="${BRONZE}" stroke="${ENCRE}" stroke-width=".5"/>`;
  return [dos, s, p(BRAS_D, chair) + rond(13.6, -35, 2.4, g.peau, C)];
}

function enRobe(g: Gabarit): [string, string, string] {
  const t = `url(#${g.tenue})`;
  let s = p('M-9.6,-54.6C-16,-52 -18.4,-42 -17.4,-33L-10.6,-34.6C-11,-42 -10.4,-48 -8,-51Z', t) + rond(-14, -32, 2.3, g.peau, C)
    + p('M-10,-55C-13,-45 -13.4,-24 -15.6,-2.4Q0,2.8 15.6,-2.4C13.4,-24 13,-45 10,-55Q0,-58.4 -10,-55Z', t)
    + trait('M-5,-30L-6.8,-2M5,-30L6.8,-2M-1,-30L-1.4,0', '#000', 0.8, 'opacity=".22"') + trait('M-15,-6Q0,-.6 15,-6', g.tenue === 'f-os' ? '#b0352a' : BRONZE, 1.3, 'opacity=".8"')
    + trait('M-11.7,-35.4Q0,-33 11.7,-35.4M3.4,-33.8L4.8,-24', '#8a6a3a', 1.6);
  if (g.signes?.includes('coeur')) s += p('M0,-45.6c-2.6,-3.6 -6,-1 -3.6,2.2L0,-40L3.6,-43.4C6,-46.6 2.6,-49.2 0,-45.6Z', '#b0352a');
  return ['', s, p('M9.6,-54.6C16,-52.6 19,-44 17.8,-35L11.2,-37C11.6,-43 10.6,-48.6 8,-51Z', t) + rond(13.6, -35, 2.4, g.peau, C)];
}

function squelette(g: Gabarit): [string, string, string] {
  const o = (d: string, e: number) => cerne(d, g.peau, e);
  return ['', o('M-4,-32L-5,-16L-4.4,-2M4,-32L5,-16L5.4,-2M-4.4,-1h4.6M5.4,-1h4.6', 2.2) + o('M-9,-54L-12.6,-44L-12.8,-34', 2)
    + p('M-7,-35L-9,-24L-5,-27L-3,-21L0,-27L3,-22L5,-27L9,-24L7,-35Z', `url(#${g.tenue})`) + o('M0,-55V-35', 2.2)
    + o('M-7,-51Q0,-53.8 7,-51M-7.6,-47Q0,-49.8 7.6,-47M-7,-43Q0,-45.8 7,-43M-5.6,-39Q0,-41.6 5.6,-39', 1.5) + o('M-9,-54.4H9', 2.2), o('M9,-54L12.8,-45L13.6,-35', 2)];
}

function voute(g: Gabarit): [string, string, string] {
  const t = `url(#${g.tenue})`;
  const dos = g.signes?.includes('tentacule') ? trait('M-6,-44C-18,-48 -26,-40 -22,-31C-19,-25 -13,-28 -15.4,-33', '#8a4a6a', 4.4) : '';
  const s = p('M-9,-26L-11,-3V0H-1.6L-2.6,-3L-2,-24ZM2,-24L3,-3V0H12.4L11,-3L10,-26Z', '#3a3228')
    + p('M-11,-27C-15.6,-37 -12,-49 -3,-53C5,-56 13,-51 14.6,-43C15.8,-35 13,-29 11.4,-25L9,-19L6,-24L3,-18L0,-24L-3,-18.6L-6,-24.6L-9,-20Z', t)
    + trait('M-4,-44l5,3M1,-36l4,2', '#000', 0.8, 'opacity=".3"');
  return [dos, s, p('M10,-48C18,-46 23.6,-40 24.6,-33L20.6,-31.4C19,-37 15,-40.6 9,-42Z', g.peau) + trait('M24.6,-33l3.6,.8M24,-31.4l3.2,2.8M22.4,-30.8l1.6,3.6', ENCRE, 1)];
}

function brute(g: Gabarit): [string, string, string] {
  const o = assombrir(g.peau, 0.72), t = `url(#${g.tenue})`;
  const s = p('M-11.6,-30L-13,-3V0H-1.4L-2.6,-3L-1.6,-28ZM1.6,-28L2.4,-3V0H14L12.6,-3L11.6,-30Z', o)
    + p('M-17,-53C-24,-49 -25.6,-38 -22.6,-28L-16.4,-29.4C-18.4,-37 -16.6,-44 -13,-48.6Z', g.peau) + rond(-19.6, -26.4, 3.5, g.peau, C)
    + p('M-12.6,-34L-14,-19.6L-9,-22L-5,-17L0,-21.6L5,-17L9,-22L14,-19.6L12.6,-34Z', t)
    + p('M-17,-53C-21,-45 -17,-37 -12.6,-32Q0,-29 12.6,-32C17,-37 21,-45 17,-53C10,-59.6 -10,-59.6 -17,-53Z', g.peau)
    + trait('M-10,-45Q-5,-42 0,-45Q5,-42 10,-45M0,-44.6V-33', o, 0.8) + trait('M-13,-56L10,-32.6', '#3a2a1c', 2.6)
    + (g.museau === 'vert' ? p('M9,-56.6C16,-61 23.6,-57 22,-48.6L13.4,-50.6Z', '#4a4640') + trait('M16,-58.6l1.6,-4.4M20.6,-55l4,-2.4', '#9a9488', 1.3) : '')
    + trait('M-12.7,-33Q0,-30 12.7,-33', '#24170e', 2.6);
  return ['', s, p('M17,-53C24,-49 25.6,-38 22.6,-28L16.4,-29.4C18.4,-37 16.6,-44 13,-48.6Z', g.peau) + rond(19.6, -26.6, 3.6, g.peau, C)];
}

const CORPS: Record<NonNullable<Gabarit['corps']>, (g: Gabarit) => [string, string, string]> = { tunique: debout, 'torse-nu': debout, armure: debout, robe: enRobe, os: squelette, voute, brute };

function humanoide(g: Gabarit): string {
  const corps = g.corps ?? 'tunique', [hx, hy] = tete(g), c = g.carrure, derriere = g.arme === 'lance' || g.arme === 'baton';
  const [dos, tenue, main] = CORPS[corps](g);
  const enMain = `<g transform="translate(${(13.5 * (c - 1)).toFixed(1)},0) ${MAIN[corps] ?? ''}">${arme(g)}</g>`;
  const large = (s: string) => (c === 1 ? s : `<g transform="scale(${c},1)">${s}</g>`);
  return large(dos) + (derriere ? enMain : '') + large(tenue)
    + `<g transform="translate(${hx},${hy}) scale(${g.chef ?? 1})">${g.museau && g.museau !== 'mort' ? MUSEAUX[g.museau](g) : visage(g)}${coiffe(g)}</g>`
    + (g.bouclier ? bouclier(g) : '') + (derriere ? '' : enMain) + large(main);
}

function bete(g: Gabarit): string {
  const t = `url(#${g.tenue})`, sombre = assombrir(TEINTES[g.tenue]?.[1] ?? '#2a1d14', 0.8), funeste = g.tenue === 'f-noir';
  if (g.bete === 'rat') {
    return trait('M-22,-8C-34,-6 -41,-14 -37,-22C-35,-26 -30,-25 -31.6,-21.6', '#b07a6a', 2.2)
      + p('M-24,-6C-27,-17 -17,-25.6 -3,-25.6C8,-25.6 15,-21 19,-17C24,-16 29.6,-13.6 32.6,-10L30,-7.2L24,-6C20,-2 14,0 6,0H-14C-20,0 -23,-2 -24,-6Z', t)
      + trait('M-12,0h7M7,0h8', '#b07a6a', 1.8) + p('M9.6,-21C8.6,-28.6 16.4,-29.6 17.4,-23Z', '#b07a6a') + trait('M-14,-24l2.6,-3.4 2,3 3,-3.6 1.6,3.4', sombre, 1.1)
      + rond(22.6, -14, 1.5, '#ff5a3a', 'stroke="#15100c" stroke-width=".4"') + p('M29,-7.6l.7,3 1.5,-2.8Z', '#efe6c8', 'stroke="#15100c" stroke-width=".4"') + trait('M28,-11l6,-2M28.6,-10l6.4,1', '#15100c', 0.4);
  }
  return p('M-28,-18C-39,-17 -47,-22 -45,-32C-40,-27 -35,-26 -29,-25Z', t)
    + p('M-20,-17L-17,-8L-18.4,0H-12L-11.4,-8L-9,-16ZM2,-17L3.4,-7L2,0H8.4L8,-8L9,-16Z', sombre)
    + p('M-31,-22C-30,-31 -16,-35.4 -2,-34.4C8,-34 14,-36.4 19,-41C21,-47 25,-50 28.6,-49.6L30.4,-56.6L34.4,-49C38,-48 42,-44.6 45,-40.4L43.6,-37.6L36.4,-36.4L41.6,-33L40,-30.6C34,-30.6 29,-31 25.6,-33C23,-26 19,-20 12,-17C2,-14 -18,-14 -26,-16C-29,-17 -31,-19 -31,-22Z', t)
    + p('M-27,-19C-30.6,-12 -27.6,-7 -25,-3L-27.4,0H-20L-19.4,-4C-19,-9 -16,-13 -15,-18ZM8,-19L9.8,-7L8.4,0H15.4L15,-7L17,-19Z', t)
    + trait(funeste ? 'M-22,-30l2,-6 3,5 2.6,-7 3,6.4 3,-7 3,7 3.4,-6.6 2.6,6.4 4,-6 2,6.6' : 'M-6,-34.4l3,-4 2,3.6 3,-4.6 2,4 3.6,-4.6 1.4,4.8', sombre, 1.3)
    + p('M36.6,-36.2l1.2,2.6 1.2,-2.2 1.4,2.2 .8,-2.4Z', '#efe6c8', 'stroke="#15100c" stroke-width=".3"') + rond(44.4, -40, 1.1, '#15100c')
    + rond(35, -44.4, 1.4, funeste ? '#ff4a2a' : '#ffcf5a', 'stroke="#15100c" stroke-width=".4"');
}

const dessin = (g: Gabarit) => (g.bete ? bete(g) : humanoide(g));

/** La figurine sur son socle : un `<svg>` dont le pied est au bas, tournée vers la droite (héros) ou la gauche. */
export function figurine(g: Gabarit, camp: 'heros' | 'ennemi'): string {
  const anneau = camp === 'ennemi' ? '#d2553a' : '#e9dcc0';
  return `<svg class="figurine" viewBox="-50 -130 100 150" aria-hidden="true">
    <ellipse class="halo" cx="0" cy="0" rx="42" ry="20"/>
    <ellipse cx="7" cy="7" rx="29" ry="12" fill="#000" opacity=".5"/>
    <path d="M-24,0v5a24,11 0 0 0 48,0v-5z" fill="#0b0807"/>
    <ellipse class="socle" cx="0" cy="0" rx="24" ry="11" fill="#2a211b" stroke="${anneau}" stroke-width="2"/>
    <ellipse cx="0" cy="0" rx="17.5" ry="7.8" fill="none" stroke="#000" stroke-opacity=".3"/>
    <g class="corps"><g transform="${camp === 'ennemi' ? 'scale(-1,1) ' : ''}scale(${g.taille})">${dessin(g)}</g></g>
  </svg>`;
}

const HAUTES: ReadonlySet<Gabarit['coiffe']> = new Set(['pointu', 'capotain', 'crete', 'plume', 'beret', 'cornes', 'casque-a-cornes', 'feutre']);

/** Le buste d'une figurine : la même figure, cadrée sur sa tête et sa coiffe, pour les portraits. */
export function buste(g: Gabarit, camp: 'heros' | 'ennemi'): string {
  const t = g.taille, sens = camp === 'ennemi' ? -1 : 1, k = g.chef ?? 1, haute = HAUTES.has(g.coiffe);
  const [hx, hy] = tete(g);
  const [cx, haut, r] = g.bete === 'rat' ? [19, -31, 14] : g.bete === 'loup' ? [31, -62, 17] : [hx, hy - (haute ? 27 : 15) * k, (haute ? 22 : 19) * k];
  return `<svg class="buste-fig" viewBox="${(cx * sens - r) * t} ${haut * t} ${2 * r * t} ${2.3 * r * t}" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><g transform="${camp === 'ennemi' ? 'scale(-1,1) ' : ''}scale(${t})">${dessin(g)}</g></svg>`;
}

export const DEGRADES_DES_FIGURINES = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${Object.entries(TEINTES).map(([id, [clair, sombre]]) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${clair}"/><stop offset=".55" stop-color="${sombre}"/><stop offset="1" stop-color="${assombrir(sombre)}"/></linearGradient>`).join('')}</defs></svg>`;
