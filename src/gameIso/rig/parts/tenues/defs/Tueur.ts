import type { TenueDef } from '../types';
import { BOTTE_CUIR } from '../botte-gabarit';

export const tenue: TenueDef = {
  label: "Tueur",
  id: "tueur",
  palette: {"vet1":"#a06a44","vet1O":"#5a3a1f","metalH":"#c8a24a","metal":"#8a6a20","cuir":"#4a2e16","cuirO":"#2a1809","vet2":"#4a4a2c","vet2O":"#2c2c18"},
  set: {
    pied: BOTTE_CUIR,
    torse: { front: `<!-- Tueur: torse nu (chair), bardé de sangles de cuir et ceinture cloutée -->
<path d="M-14 -28 Q0 -33 14 -28 Q15 -10 13 4 Q12 22 10 34 Q0 38 -10 34 Q-12 22 -13 4 Q-15 -10 -14 -28 Z" fill="url(#dg-v-@peauH-@peauO)" stroke="@vet1O" stroke-width="0.6"/>
<!-- pectoraux / ombre centrale musculature -->
<path d="M0 -22 Q-7 -16 -8 -2 Q0 2 0 2 Q0 -10 0 -22 Z" fill="@vet1" opacity="0.45"/>
<path d="M0 -22 Q7 -16 8 -2 Q0 2 0 2 Q0 -10 0 -22 Z" fill="@vet1" opacity="0.35"/>
<path d="M-7 6 Q-3 12 0 12 Q3 12 7 6" fill="none" stroke="@vet1H" stroke-width="0.8" opacity="0.5"/>
<!-- tatouages bleus du Tueur sur le torse -->
<path d="M-6 -14 Q-9 -8 -7 -2" fill="none" stroke="#2f5a8a" stroke-width="1.1" opacity="0.7"/>
<path d="M5 -16 Q9 -10 7 -3 Q5 1 8 5" fill="none" stroke="#2f5a8a" stroke-width="1.1" opacity="0.7"/>
<path d="M-4 16 Q-2 20 -5 24" fill="none" stroke="#2f5a8a" stroke-width="1" opacity="0.6"/>
<!-- sangle de cuir en bandoulière épaule G -> hanche D -->
<path d="M-13 -25 L11 18 L8 24 L-15 -19 Z" fill="@vet1O" stroke="@vet1O" stroke-width="0.5"/>
<!-- rivets sur la sangle -->
<circle cx="-8" cy="-12" r="0.9" fill="@metalH"/>
<circle cx="-1" cy="0" r="0.9" fill="@metalH"/>
<circle cx="6" cy="12" r="0.9" fill="@metalH"/>
<!-- ceinture large cloutée à la taille -->
<path d="M-13 24 Q0 28 13 24 L12 34 Q0 38 -12 34 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.6"/>
<circle cx="-8" cy="30" r="1" fill="@metalH"/>
<circle cx="-3" cy="31" r="1" fill="@metalH"/>
<circle cx="3" cy="31" r="1" fill="@metalH"/>
<circle cx="8" cy="30" r="1" fill="@metalH"/>
<!-- boucle de ceinture en bronze -->
<rect x="-3" y="27" width="6" height="5" rx="1" fill="@metalH" stroke="@metal" stroke-width="0.5"/>`, back: `<!-- Tueur DOS: torse nu (chair) vu de dos, dos musclé, SANS détails de face (boucle, tatouages de poitrine, ombre pectorale) -->
<path d="M-14 -28 Q0 -33 14 -28 Q15 -10 13 4 Q12 22 10 34 Q0 38 -10 34 Q-12 22 -13 4 Q-15 -10 -14 -28 Z" fill="url(#dg-v-@peauH-@peauO)" stroke="#7a4f33" stroke-width="0.6"/>
<!-- gouttière vertébrale (sillon dorsal central) -->
<path d="M0 -24 Q1 -8 0 6 Q-1 20 0 32" fill="none" stroke="#7a4f33" stroke-width="1.1" opacity="0.55"/>
<!-- masses des omoplates / dorsaux -->
<path d="M-3 -24 Q-11 -18 -12 -2 Q-8 4 -3 2 Q-2 -10 -3 -24 Z" fill="#8a5a38" opacity="0.35"/>
<path d="M3 -24 Q11 -18 12 -2 Q8 4 3 2 Q2 -10 3 -24 Z" fill="#8a5a38" opacity="0.35"/>
<path d="M-9 12 Q0 16 9 12" fill="none" stroke="#8a5a38" stroke-width="0.8" opacity="0.45"/>
<!-- tatouages bleus du Tueur sur le dos -->
<path d="M-7 -16 Q-10 -8 -8 0 Q-6 6 -9 12" fill="none" stroke="#2f5a8a" stroke-width="1.1" opacity="0.7"/>
<path d="M7 -16 Q10 -8 8 0 Q6 6 9 12" fill="none" stroke="#2f5a8a" stroke-width="1.1" opacity="0.7"/>
<path d="M-3 -10 Q0 -4 0 4 Q0 12 -2 18" fill="none" stroke="#2f5a8a" stroke-width="1" opacity="0.6"/>
<!-- sangle de cuir en bandoulière, vue de dos (épaule D -> hanche G) -->
<path d="M13 -25 L-11 18 L-8 24 L15 -19 Z" fill="#5a3a1f" stroke="#3a2410" stroke-width="0.5"/>
<circle cx="8" cy="-12" r="0.9" fill="#c8a24a"/>
<circle cx="1" cy="0" r="0.9" fill="#c8a24a"/>
<circle cx="-6" cy="12" r="0.9" fill="#c8a24a"/>
<!-- ceinture large cloutée vue de dos (PAS de boucle) -->
<path d="M-13 24 Q0 28 13 24 L12 34 Q0 38 -12 34 Z" fill="#4a2e16" stroke="#2a1809" stroke-width="0.6"/>
<circle cx="-8" cy="30" r="1" fill="#c8a24a"/>
<circle cx="-3" cy="31" r="1" fill="#c8a24a"/>
<circle cx="3" cy="31" r="1" fill="#c8a24a"/>
<circle cx="8" cy="30" r="1" fill="#c8a24a"/>`, profile: `<!-- Tueur PROFIL (tourné à droite): torse nu de côté, ÉTROIT (~moitié largeur), une épaule/bras de profil, drapé latéral des sangles -->
<!-- buste de profil: ventre bombé à droite, dos arqué à gauche -->
<path d="M-6 -28 Q4 -31 8 -26 Q9 -12 8 0 Q7 16 6 34 Q-1 38 -7 34 Q-8 18 -7 2 Q-8 -12 -6 -28 Z" fill="url(#dg-v-@peauH-@peauO)" stroke="#7a4f33" stroke-width="0.6"/>
<!-- ligne du dos (arrière, à gauche) marquée pour lisibilité -->
<path d="M-6 -26 Q-8 -10 -7 4 Q-8 18 -6 32" fill="none" stroke="#7a4f33" stroke-width="1" opacity="0.5"/>
<!-- pectoral / ventre de côté (avant, à droite) -->
<path d="M7 -20 Q3 -12 4 -2 Q7 0 8 -2 Q8 -12 7 -20 Z" fill="#a06a44" opacity="0.4"/>
<path d="M5 6 Q5 16 4 24" fill="none" stroke="#8a5a38" stroke-width="0.8" opacity="0.45"/>
<!-- épaule/bras de profil (avant-plan) -->
<path d="M2 -28 Q9 -27 10 -20 Q11 -10 9 -2 Q5 -6 4 -16 Q3 -24 2 -28 Z" fill="url(#dg-v-@peauH-@peauO)" stroke="#7a4f33" stroke-width="0.6"/>
<ellipse cx="7" cy="-21" rx="3" ry="4" fill="#a06a44" opacity="0.3"/>
<!-- tatouage bleu visible sur le flanc -->
<path d="M5 -14 Q8 -8 6 0 Q4 6 6 12" fill="none" stroke="#2f5a8a" stroke-width="1.1" opacity="0.7"/>
<!-- sangle de cuir vue de côté (descend en oblique de l'épaule au flanc) -->
<path d="M3 -25 L-4 16 L-1 20 L6 -22 Z" fill="#5a3a1f" stroke="#3a2410" stroke-width="0.5"/>
<circle cx="4" cy="-14" r="0.9" fill="#c8a24a"/>
<circle cx="1" cy="2" r="0.9" fill="#c8a24a"/>
<!-- ceinture cloutée de profil (bande latérale) -->
<path d="M-7 24 Q0 27 7 24 L6 34 Q0 37 -7 34 Z" fill="#4a2e16" stroke="#2a1809" stroke-width="0.6"/>
<circle cx="-3" cy="30" r="1" fill="#c8a24a"/>
<circle cx="2" cy="30" r="1" fill="#c8a24a"/>` },
    jambes: `<!-- Tueur: pantalon rude vert-brun, en lambeaux, jambières de cuir -->
<path d="M-4 0 Q-5 0 -5 2 L-4.5 30 Q-4 42 -3.5 50 L3.5 50 Q4 42 4.5 30 L5 2 Q5 0 4 0 Z" fill="@vet2" stroke="@vet2O" stroke-width="0.5"/>
<!-- pli central / ombre -->
<path d="M0 2 L0.5 30 L0 50" fill="none" stroke="@vet2O" stroke-width="0.8" opacity="0.6"/>
<!-- déchirures / lambeaux sur la cuisse et le mollet -->
<path d="M-4 18 L-1.5 22 L-4 24 Z" fill="@vet2O"/>
<path d="M4 30 L1.5 34 L4 36 Z" fill="@vet2O"/>
<path d="M-4 40 L-1 43 L-4 46" fill="none" stroke="@vet2O" stroke-width="0.9"/>
<!-- sangle / lanière de cuir enroulée au mollet -->
<path d="M-4 38 L4 39" stroke="@vet1O" stroke-width="2.2"/>
<path d="M-4 43 L4 44" stroke="@vet1O" stroke-width="2.2"/>
<!-- pied/botte de cuir nu en bas -->
<path d="M-3.5 48 Q0 47 3.5 48 L3.5 50 L-3.5 50 Z" fill="@vet1O"/>`,
    bras: {
      front: `<!-- Tueur: bras nu (chair) musclé, brassard de cuir clouté + lanières au poignet -->
<rect x="-3.4" y="-2" width="6.8" height="34" rx="3.2" fill="url(#dg-v-@peauH-@peauO)" stroke="@vet1O" stroke-width="0.5"/>
<!-- relief du biceps -->
<path d="M-3 2 Q-4.5 8 -2.5 14" fill="none" stroke="@vet1" stroke-width="1" opacity="0.5"/>
<!-- tatouage bleu sur le bras -->
<path d="M2 4 Q3.5 9 2 14 Q0.5 18 2 22" fill="none" stroke="#2f5a8a" stroke-width="0.9" opacity="0.65"/>
<!-- brassard de cuir clouté en haut du bras -->
<rect x="-3.6" y="3" width="7.2" height="6" rx="1.5" fill="@vet1O" stroke="@vet1O" stroke-width="0.5"/>
<circle cx="-1.5" cy="6" r="0.7" fill="@metalH"/>
<circle cx="1.5" cy="6" r="0.7" fill="@metalH"/>
<!-- lanières de cuir enroulées au poignet/avant-bras -->
<path d="M-3.4 24 L3.4 24" stroke="@cuir" stroke-width="2"/>
<path d="M-3.4 28 L3.4 28" stroke="@cuir" stroke-width="2"/>
<path d="M-3.4 31 L3.4 31" stroke="@cuir" stroke-width="1.8"/>`,
      profile: `<rect x="-3" y="-2" width="6" height="34" rx="2.9" fill="url(#dg-v-@peauH-@peauO)" stroke="@vet1O" stroke-width="0.5"/>
<path d="M-3 -1.4 Q-4.4 8 -2.6 18 Q-3 26 -2.4 31.6 L-0.4 31.8 Q-1 20 -0.6 -1.8 Z" fill="@vet1O" opacity="0.5" stroke="none"/>
<path d="M2.2 0.6 Q3.6 7 2.4 14 Q1.6 9 1.2 4 Z" fill="@vet1H" opacity="0.5" stroke="none"/>
<path d="M-2.4 14.6 Q-3.4 18 -2.2 21.4" fill="none" stroke="@vet1O" stroke-width="0.6" opacity="0.7"/>
<rect x="-3.2" y="3" width="6.4" height="6" rx="1.5" fill="@vet1O" stroke="@vet1O" stroke-width="0.5"/>
<path d="M-3.2 3 L3.2 3 L3.2 4.2 L-3.2 4.2 Z" fill="@cuirH" opacity="0.4" stroke="none"/>
<circle cx="1.8" cy="6" r="0.7" fill="@metalH"/>
<path d="M-3 24 L3 24" stroke="@cuir" stroke-width="2"/>
<path d="M-3 28 L3 28" stroke="@cuir" stroke-width="2"/>
<path d="M-3 31 L3 31" stroke="@cuir" stroke-width="1.8"/>
<path d="M-3 23.4 L3 23.4 M-3 27.4 L3 27.4 M-3 30.4 L3 30.4" stroke="@cuirO" stroke-width="0.45" opacity="0.75"/>`,
      back: `<rect x="-3.4" y="-2" width="6.8" height="34" rx="3.2" fill="url(#dg-v-@peauH-@peauO)" stroke="@vet1O" stroke-width="0.5"/>
<path d="M0.8 -1.8 Q2 10 1.4 21 Q1.8 27 1.2 31.8 L3 31.6 Q3.6 20 3.2 -1.6 Z" fill="@vet1O" opacity="0.52" stroke="none"/>
<path d="M-2.8 0.6 Q-4.2 7 -2.8 15 Q-1.8 9 -1.4 3 Z" fill="@vet1H" opacity="0.45" stroke="none"/>
<path d="M-2.6 11 Q0 12.6 2.6 11" fill="none" stroke="@vet1O" stroke-width="0.5" opacity="0.5"/>
<path d="M-2.4 16 Q0 17.4 2.4 16 Q0 18.8 -2.4 16 Z" fill="@vet1O" opacity="0.5" stroke="none"/>
<rect x="-3.6" y="3" width="7.2" height="6" rx="1.5" fill="@vet1O" stroke="@vet1O" stroke-width="0.5"/>
<path d="M-3.6 3 L3.6 3 L3.6 4.2 L-3.6 4.2 Z" fill="@cuirH" opacity="0.35" stroke="none"/>
<rect x="-1.4" y="4.2" width="2.8" height="3.6" rx="0.5" fill="@cuir" stroke="@cuirO" stroke-width="0.4"/>
<circle cx="0" cy="6" r="0.55" fill="@metalH"/>
<path d="M-3.4 24 L3.4 24" stroke="@cuir" stroke-width="2"/>
<path d="M-3.4 28 L3.4 28" stroke="@cuir" stroke-width="2"/>
<path d="M-3.4 31 L3.4 31" stroke="@cuir" stroke-width="1.8"/>
<path d="M-3.4 23.4 L3.4 23.4 M-3.4 27.4 L3.4 27.4 M-3.4 30.4 L3.4 30.4" stroke="@cuirO" stroke-width="0.45" opacity="0.75"/>
<path d="M-1.6 22.8 l3.2 2.4 M-1.6 26.8 l3.2 2.4" stroke="@cuirO" stroke-width="0.5" opacity="0.6" fill="none"/>`,
    },
  },
};
