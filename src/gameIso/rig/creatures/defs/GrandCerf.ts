import type { CreatureDef } from '../types';

// Grand Cerf (ZI) — être transcendant des forêts, « manifestation suprême de l'âme d'une forêt ».
// Réf art : art-ref/zi/page014_full.png — cerf MASSIF au pelage presque NOIR hirsute, en plein
// BRAMEMENT : encolure tendue vers le ciel, museau levé gueule ouverte, immense ramure dense
// (une dizaine d'andouillers par perche) balayée vers l'arrière, épaisse toison de gorge/fanon
// qui déborde sur le poitrail. Quadrupède 'equine' porté en masse :
//   - pose : neckAngle -16 (encolure ~72° au-dessus de l'horizontale) + headPitch -112 (tête
//     rejetée en arrière, museau ~50° au-dessus de l'horizontale, oreilles couchées) — valeurs
//     calculées pour que le museau reste DANS la boîte 120×150 (à -58 il sortait du cadre) ;
//   - ramure : deco.tete (éventail SYMÉTRIQUE ±35° dessiné dressé → couronne large de face/dos,
//     et basculé avec la tête en profil = perches balayées en arrière au-dessus du dos, andouillers
//     vers le haut, comme l'illustration) — remplace headgear 'bois' (2-3 branches, trop simple) ;
//   - brame : deco['tete#profile'] PAR-DESSUS l'art de tête (le canal deco est rendu dans le
//     repère de l'art, cf. quadAnchor) — mâchoire inférieure décrochée + gueule sombre béante
//     sous le museau levé ;
//   - fanon : deco.encolure (os sans art de face/dos → profil seulement) — frange de toison
//     dentelée le long de la gorge qui retombe en fanon sur le poitrail ;
//   - robe charbon quasi noir (@corps), toison et ramure noires (@cheveux), reflets gris cendré.
const RAMURE_COTE = (sx: number): string => {
  const X = (n: number) => (n * sx).toFixed(1);
  // deux PERCHES par côté qui s'élèvent en s'incurvant, hérissées d'andouillers vers le haut/dehors
  const perches = `M${X(3)} -8 Q${X(10)} -17 ${X(15)} -25 Q${X(18)} -31 ${X(17)} -37 ` +
    `M${X(1.5)} -9 Q${X(5)} -19 ${X(7.5)} -28 Q${X(9)} -34 ${X(7)} -40`;
  const andouillers = `M${X(3)} -6.5 Q${X(9)} -6 ${X(12.5)} -10 ` + // andouiller d'œil (au-dessus du chanfrein)
    `M${X(8)} -14.5 Q${X(14)} -16 ${X(17)} -21 M${X(11.5)} -20.5 Q${X(17)} -23 ${X(20)} -28 ` +
    `M${X(14)} -27 Q${X(19.5)} -30 ${X(22)} -35 M${X(16)} -33 Q${X(20)} -37 ${X(21)} -42 ` +
    `M${X(4)} -17 Q${X(8)} -19 ${X(10)} -24 M${X(6)} -24 Q${X(10)} -27 ${X(11.5)} -32 ` +
    `M${X(7.5)} -31 Q${X(11)} -35 ${X(11)} -40 M${X(7)} -37 Q${X(4)} -41 ${X(2)} -43`;
  return `<path d="${perches}" stroke="@cheveux" stroke-width="2.4"/>` +
    `<path d="${andouillers}" stroke="@cheveux" stroke-width="1.5"/>` +
    `<path d="${perches}" stroke="@cheveuxO" stroke-width="0.55" opacity="0.6"/>` +
    `<path d="${perches}" stroke="@corpsH" stroke-width="0.35" opacity="0.35"/>`; // liseré cendré (lisibilité du noir sur noir)
};
const RAMURE = `<g data-deco="ramure" fill="none" stroke-linecap="round">${RAMURE_COTE(-1)}${RAMURE_COTE(1)}</g>`;

// Gueule de brame, repère de l'ART de tête (quadAnchor ; rotate(8) = celui de l'art 'cheval') :
// museau du gabarit 'cheval' vers +x, tip (19,17), naseau (16,17). Charnière de mâchoire vers
// (10,13) → gape sombre + mandibule décrochée vers le côté gorge (+y local = côté encolure une
// fois la tête rejetée en arrière).
const GUEULE =
  `<g data-deco="gueule" transform="rotate(8)">` +
  `<path d="M10.5 13 L19.6 17.6 L16.4 26.4 Z" fill="#180c07"/>` + // gueule béante ouverte vers le ciel
  `<path d="M12.6 15.4 L17.8 18.2 L16 22.6 Z" fill="#6e2422"/>` + // langue au fond de la gueule
  // mandibule inférieure décrochée (pend vers la gorge, charnière sous la joue)
  `<path d="M9.8 13.4 Q15.5 19.5 17.6 26.2 Q18.2 29.3 15.6 28.7 Q10.4 24.4 7.6 16.6 Q7.8 13.6 9.8 13.4 Z" fill="@corps" stroke="@corpsO" stroke-width="0.55"/>` +
  `<path d="M8.6 19.4 l0.4 3.2 l2.6 -1 l0.6 3.2 l2.6 -0.8 l0.8 3" stroke="@cheveux" stroke-width="1.1" fill="none" stroke-linecap="round"/>` + // barbiche sous la mandibule
  `</g>`;

// Repère local de l'encolure (base du cou = origine, -y vers la tête).
const FANON =
  `<g data-deco="fanon">` +
  // toison de gorge : frange dentelée le long du devant de l'encolure, qui s'épaissit en
  // descendant et retombe en FANON sur le poitrail (le poil déborde la base du cou)
  `<path d="M6.2 -28 L10.8 -24.6 L8.2 -21.4 L12.4 -17.6 L9.6 -14.6 L13.6 -10.4 L10.8 -7.4 L14.6 -3 L11.8 0 L15.4 4.6 L12 6.8 L16 12 L10.5 16.5 L12.8 21 L7 18 Q4.5 6 4.8 -12 Q5 -22 6.2 -28 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.5"/>` +
  `<path d="M7.5 -20 Q8.5 -6 9.5 8" stroke="@cheveuxO" stroke-width="0.5" fill="none" opacity="0.5"/>` + // mèches internes
  `</g>`;

export const creature: CreatureDef = {
  label: 'Grand Cerf',
  id: "grand-cerf",
  plan: 'quadruped',
  quad: {
    sl: 1.12, build: 'equine', girth: 1.16, bodyLen: 1.02, neckLen: 1.05, neckAngle: -8, headPitch: -108, legLen: 1.16,
    head: 'cheval', tail: 'touffe', mane: 'hirsute', ears: 'pointues', foot: 'sabot', headScale: 0.9, tailLen: 0.5,
    deco: { tete: RAMURE, 'tete#profile': GUEULE, encolure: FANON },
    palette: { corps: '#2e2921', corpsO: '#0f0c09', corpsH: '#5a5244', cheveux: '#241f18', cheveuxO: '#0b0906', cuir: '#161210' },
  },
};
