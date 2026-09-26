import type { TenueDef } from '../types';
import { BOTTE_CUIR } from '../botte-gabarit';

export const tenue: TenueDef = {
  label: "Gladiateur",
  id: "gladiateur",
  palette: {"metal":"#8b94a6","cuirO":"#3d2a16","cuir":"#5a3f24","vet1H":"#e0d6bf","cuirH":"#b87a4a","metalO":"#2a3038","vet1":"#8a6e44","vet2":"#a82a22","vet2O":"#6a1812","vet2H":"#d24a3a"},
  set: {
    pied: BOTTE_CUIR,
    torse: { front: `<!-- Gladiateur : torse nu musclé + baldric de cuir + ceinture large à trophées. Origine (0,0)=taille, épaules en -28 -->
<!-- chair du torse (pectoraux -> abdomen -> hanches) -->
<path d="M-14 -28 Q0 -32 14 -28 Q15 -18 12 -8 L11 4 Q11 22 8 34 Q0 38 -8 34 Q-11 22 -11 4 L-12 -8 Q-15 -18 -14 -28 Z" fill="url(#dg-v-@peauH-@peauO)" stroke="@peauO" stroke-width="0.8"/>
<!-- ombre flanc droit pour le volume -->
<path d="M2 -30 Q14 -28 14 -28 Q15 -18 12 -8 L11 4 Q11 22 8 34 Q4 36 2 35 Q6 22 7 4 L7 -10 Q8 -20 2 -30 Z" fill="@peauH" opacity="0.4" stroke="none"/>
<!-- pectoraux -->
<path d="M-12 -22 Q-6 -16 -1 -16 L-1 -22 Q-7 -25 -12 -22 Z" fill="@peauH" opacity="0.5" stroke="@peauO" stroke-width="0.5"/>
<path d="M12 -22 Q6 -16 1 -16 L1 -22 Q7 -25 12 -22 Z" fill="@cuirH" opacity="0.55" stroke="@peauO" stroke-width="0.5"/>
<path d="M-1 -24 L-1 -15 M1 -24 L1 -15" stroke="@cuir" stroke-width="0.7" fill="none"/>
<!-- abdominaux -->
<path d="M-7 -10 Q0 -8 7 -10 M-6 -3 Q0 -1 6 -3 M-5 4 Q0 6 5 4" stroke="@cuir" stroke-width="0.6" fill="none" opacity="0.8"/>
<line x1="0" y1="-13" x2="0" y2="8" stroke="@cuir" stroke-width="0.6" opacity="0.7"/>
<!-- baldric (sangle de cuir en diagonale, épaule gauche -> hanche droite) -->
<path d="M-14 -29 L-9 -28 L11 14 L7 16 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.8"/>
<path d="M-13 -28 L-10.5 -27.5 L9.5 13 L8 13.6 Z" fill="@cuir" opacity="0.6" stroke="none"/>
<line x1="-11" y1="-22" x2="-9.5" y2="-22" stroke="@peau" stroke-width="0.5"/>
<line x1="-4" y1="-7" x2="-2.5" y2="-7" stroke="@peau" stroke-width="0.5"/>
<line x1="4" y1="6" x2="5.5" y2="6" stroke="@peau" stroke-width="0.5"/>
<!-- bretelle de cuir épaule droite (fourrure/cuir) -->
<path d="M6 -29 Q12 -27 13 -20 L9 -20 Q9 -26 5 -28 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.7"/>
<!-- ceinture large à la taille -->
<rect x="-12" y="16" width="24" height="9" rx="1.5" fill="@cuir" stroke="@cuirO" stroke-width="0.9"/>
<rect x="-12" y="17" width="24" height="2.4" fill="@cuir" opacity="0.6" stroke="none"/>
<!-- boucle métal centrale -->
<rect x="-3.5" y="17" width="7" height="7" rx="1" fill="url(#g_steelD)" stroke="@metalO" stroke-width="0.6"/>
<rect x="-1.8" y="18.5" width="3.6" height="4" rx="0.6" fill="@metalO" stroke="none"/>
<!-- rivets de ceinture -->
<circle cx="-8" cy="20.5" r="0.9" fill="@peau"/><circle cx="8" cy="20.5" r="0.9" fill="@peau"/>
<!-- lanières pendantes -->
<path d="M-9 25 L-10 33 L-8 33 L-7.5 25 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.6"/>
<path d="M8 25 L9 32 L11 31 L9.5 25 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.6"/>
<!-- trophée : crâne accroché à la ceinture (côté droit) -->
<g stroke="@cuir" stroke-width="0.5"><path d="M9.5 25 L9.5 28" stroke="@cuirO" stroke-width="0.8"/><path d="M7 29 Q7 33.5 10 33.5 Q13 33.5 13 29 Q13 26 10 26 Q7 26 7 29 Z" fill="@vet1H"/><circle cx="8.7" cy="29" r="0.9" fill="@cuirO" stroke="none"/><circle cx="11.3" cy="29" r="0.9" fill="@cuirO" stroke="none"/><path d="M10 30.5 L9.4 32 L10.6 32 Z" fill="@cuirO" stroke="none"/><path d="M8.4 32.4 L8.6 34 M10 32.6 L10 34 M11.6 32.4 L11.4 34" stroke="@vet1O"/></g>
<!-- petit os / fétiche pendu (côté gauche) -->
<g stroke="@cuir" stroke-width="0.5"><path d="M-9 25 L-9 30" stroke="@cuirO" stroke-width="0.7"/><path d="M-9 30 Q-10.5 30 -10.5 31.4 Q-10.5 32.6 -9 32.4 L-9 34.4 Q-10.4 34.2 -10.4 35.6 Q-10.4 37 -9 36.8 Q-7.6 37 -7.6 35.6 Q-7.6 34.2 -9 34.4 L-9 32.4 Q-7.6 32.6 -7.6 31.4 Q-7.6 30 -9 30 Z" fill="@vet1H"/></g>`, back: `<!-- Gladiateur DOS : torse nu musclé vu de dos (omoplates + sillon vertébral + lats) + baldric en diagonale inverse + arrière de la ceinture à trophées. Origine (0,0)=taille, épaules en -28 -->
<!-- chair du dos (épaules -> dos -> hanches), même empreinte que le front -->
<path d="M-14 -28 Q0 -32 14 -28 Q15 -18 12 -8 L11 4 Q11 22 8 34 Q0 38 -8 34 Q-11 22 -11 4 L-12 -8 Q-15 -18 -14 -28 Z" fill="url(#dg-v-@peauH-@peauO)" stroke="#7a4a28" stroke-width="0.8"/>
<!-- ombre flanc droit pour le volume -->
<path d="M2 -30 Q14 -28 14 -28 Q15 -18 12 -8 L11 4 Q11 22 8 34 Q4 36 2 35 Q6 22 7 4 L7 -10 Q8 -20 2 -30 Z" fill="#c98a5a" opacity="0.4" stroke="none"/>
<!-- sillon vertébral central -->
<line x1="0" y1="-26" x2="0" y2="14" stroke="#8a5430" stroke-width="0.8" opacity="0.75"/>
<!-- creux des reins -->
<path d="M-5 12 Q0 16 5 12" stroke="#8a5430" stroke-width="0.6" fill="none" opacity="0.7"/>
<!-- omoplate gauche -->
<path d="M-12 -24 Q-6 -22 -3 -14 Q-7 -13 -11 -17 Q-12 -20 -12 -24 Z" fill="#b87a4a" opacity="0.5" stroke="#7a4a28" stroke-width="0.5"/>
<!-- omoplate droite -->
<path d="M12 -24 Q6 -22 3 -14 Q7 -13 11 -17 Q12 -20 12 -24 Z" fill="#b87a4a" opacity="0.55" stroke="#7a4a28" stroke-width="0.5"/>
<!-- muscles dorsaux (lats) qui se rejoignent vers le bas du dos -->
<path d="M-11 -10 Q-5 0 -3 12 M11 -10 Q5 0 3 12" stroke="#8a5430" stroke-width="0.6" fill="none" opacity="0.75"/>
<!-- baldric vu de dos : passe sur l'épaule droite -> hanche gauche (diagonale inversée par rapport au front) -->
<path d="M14 -29 L9 -28 L-11 14 L-7 16 Z" fill="#6a4a2a" stroke="#3d2a16" stroke-width="0.8"/>
<path d="M13 -28 L10.5 -27.5 L-9.5 13 L-8 13.6 Z" fill="#8a6438" opacity="0.6" stroke="none"/>
<!-- bretelle de cuir épaule droite vue de dos -->
<path d="M6 -29 Q12 -27 13 -20 L9 -20 Q9 -26 5 -28 Z" fill="#5a3f24" stroke="#3d2a16" stroke-width="0.7"/>
<!-- ceinture large vue de dos (PAS de boucle de face, juste la sangle dorsale) -->
<rect x="-12" y="16" width="24" height="9" rx="1.5" fill="#5a3f24" stroke="#3d2a16" stroke-width="0.9"/>
<rect x="-12" y="17" width="24" height="2.4" fill="#7a5630" opacity="0.6" stroke="none"/>
<!-- couture dorsale verticale de la ceinture + passants -->
<line x1="0" y1="16" x2="0" y2="25" stroke="#3d2a16" stroke-width="0.7"/>
<rect x="-6.5" y="15.6" width="2" height="9.8" fill="none" stroke="#3d2a16" stroke-width="0.6"/>
<rect x="4.5" y="15.6" width="2" height="9.8" fill="none" stroke="#3d2a16" stroke-width="0.6"/>
<!-- rivets de ceinture -->
<circle cx="-9" cy="20.5" r="0.9" fill="#caa46a"/><circle cx="9" cy="20.5" r="0.9" fill="#caa46a"/>
<!-- lanières pendantes (dos) -->
<path d="M-9 25 L-10 33 L-8 33 L-7.5 25 Z" fill="#5a3f24" stroke="#3d2a16" stroke-width="0.6"/>
<path d="M8 25 L9 32 L11 31 L9.5 25 Z" fill="#5a3f24" stroke="#3d2a16" stroke-width="0.6"/>
<!-- trophées (crâne / os) accrochés aux hanches, visibles depuis l'arrière sur les côtés -->
<g stroke="#5a4a32" stroke-width="0.5"><path d="M9.5 25 L9.5 28" stroke="#3d2a16" stroke-width="0.8"/><path d="M7 29 Q7 33.5 10 33.5 Q13 33.5 13 29 Q13 26 10 26 Q7 26 7 29 Z" fill="#d8cdb4"/><path d="M8 27 Q8.5 31 10 33 M12 27 Q11.5 31 10 33" stroke="@vet1O" stroke-width="0.4" fill="none"/></g>
<g stroke="#5a4a32" stroke-width="0.5"><path d="M-9 25 L-9 30" stroke="#3d2a16" stroke-width="0.7"/><path d="M-9 30 Q-10.5 30 -10.5 31.4 Q-10.5 32.6 -9 32.4 L-9 34.4 Q-10.4 34.2 -10.4 35.6 Q-10.4 37 -9 36.8 Q-7.6 37 -7.6 35.6 Q-7.6 34.2 -9 34.4 L-9 32.4 Q-7.6 32.6 -7.6 31.4 Q-7.6 30 -9 30 Z" fill="#e0d6bf"/></g>`, profile: `<!-- Gladiateur PROFIL (tourné à droite) : torse nu de côté, étroit (~moitié de largeur), une épaule/bras de profil, baldric sur l'épaule descendant le flanc, ceinture qui enveloppe. Origine (0,0)=taille -->
<!-- chair du torse de profil : poitrine bombée à l'avant (droite), dos cambré à l'arrière (gauche), étroit -->
<path d="M-7 -28 Q3 -31 8 -26 Q9 -18 7 -10 Q6 -4 6 2 Q6 18 4 32 Q0 37 -4 33 Q-6 20 -6 6 Q-7 -4 -7 -14 Q-8 -22 -7 -28 Z" fill="url(#dg-v-@peauH-@peauO)" stroke="#7a4a28" stroke-width="0.8"/>
<!-- ombre du dos (arrière = côté gauche) pour le volume -->
<path d="M-7 -26 Q-7 -10 -6 6 Q-6 20 -4 33 Q-2 34 -2 33 Q-4 20 -4 6 Q-5 -10 -5 -26 Z" fill="#b87a4a" opacity="0.45" stroke="none"/>
<!-- lumière sur la poitrine/abdomen (avant = côté droit) -->
<path d="M3 -28 Q8 -25 8 -18 Q8 -8 6 0 Q5 14 3 30 Q5 14 6 0 Q7 -10 5 -24 Z" fill="#e0a878" opacity="0.4" stroke="none"/>
<!-- pectoral de profil (saillie avant) -->
<path d="M2 -22 Q8 -22 8 -16 Q4 -15 2 -18 Z" fill="#c98a5a" opacity="0.55" stroke="#7a4a28" stroke-width="0.5"/>
<!-- relief abdominal de côté -->
<path d="M3 -8 Q6 -7 6 -5 M3 -1 Q6 0 5 2 M2 5 Q5 6 4 8" stroke="#8a5430" stroke-width="0.55" fill="none" opacity="0.75"/>
<!-- épaule + amorce de bras de profil (avant) -->
<path d="M2 -29 Q9 -29 9 -22 Q9 -16 6 -13 Q5 -18 4 -24 Z" fill="url(#dg-v-@peauH-@peauO)" stroke="#7a4a28" stroke-width="0.7"/>
<path d="M6 -27 Q9 -25 9 -21" stroke="#8a5430" stroke-width="0.5" fill="none" opacity="0.7"/>
<!-- baldric de profil : sangle sur l'épaule descendant le flanc avant vers la hanche -->
<path d="M2 -29 L6 -28 L7 -2 L3 -2 Z" fill="#6a4a2a" stroke="#3d2a16" stroke-width="0.8"/>
<path d="M3 -28 L5 -27.5 L5.6 -3 L4 -3 Z" fill="#8a6438" opacity="0.6" stroke="none"/>
<line x1="4" y1="-20" x2="5.4" y2="-20" stroke="#caa46a" stroke-width="0.5"/>
<line x1="4.5" y1="-8" x2="5.8" y2="-8" stroke="#caa46a" stroke-width="0.5"/>
<!-- bretelle de cuir sur l'épaule (vue de côté) -->
<path d="M1 -29 Q7 -28 8 -22 L5 -22 Q5 -27 0 -28 Z" fill="#5a3f24" stroke="#3d2a16" stroke-width="0.7"/>
<!-- ceinture large enveloppant la taille de profil -->
<path d="M-6 16 Q0 14 7 16 L7 25 Q0 23 -6 25 Z" fill="#5a3f24" stroke="#3d2a16" stroke-width="0.9"/>
<path d="M-6 17 Q0 15 7 17 L7 19.4 Q0 17.4 -6 19.4 Z" fill="#7a5630" opacity="0.6" stroke="none"/>
<!-- amorce de boucle visible sur le côté avant -->
<rect x="4.5" y="17.6" width="3.4" height="6" rx="0.8" fill="url(#g_steelD)" stroke="#2a3038" stroke-width="0.6"/>
<circle cx="-3" cy="20.5" r="0.9" fill="#caa46a"/>
<!-- lanière pendante (avant) -->
<path d="M4 25 L5 33 L7 32 L5.6 25 Z" fill="#5a3f24" stroke="#3d2a16" stroke-width="0.6"/>
<!-- lanière pendante (arrière) -->
<path d="M-3 25 L-4 33 L-2 33 L-1.5 25 Z" fill="#5a3f24" stroke="#3d2a16" stroke-width="0.6"/>
<!-- trophée crâne pendu au flanc avant, de profil (étroit) -->
<g stroke="#5a4a32" stroke-width="0.5"><path d="M6 25 L6.5 28" stroke="#3d2a16" stroke-width="0.8"/><path d="M4.5 29 Q4.5 33.5 7 33.5 Q9.5 33.5 9.5 29 Q9.5 26 7 26 Q4.5 26 4.5 29 Z" fill="#d8cdb4"/><circle cx="6" cy="29" r="0.9" fill="#2a2018" stroke="none"/><path d="M7.3 30.5 L6.8 32 L7.8 32 Z" fill="#2a2018" stroke="none"/><path d="M5.6 32.4 L5.8 34 M7.4 32.6 L7.4 34" stroke="@vet1O"/></g>` },
    jambes: `<!-- Gladiateur : braie ample ocre, sangle de cuir à la cuisse, jambière enroulée, botte fourrée. Origine (0,0)=hanche, +y descend -->
<!-- braie / pantalon de toile sale (haut de cuisse -> genou) -->
<path d="M-5 0 Q0 -1.5 5 0 L5.5 12 Q5.6 20 4.4 26 L-4.4 26 Q-5.6 20 -5.5 12 Z" fill="@vet1H" stroke="@cuir" stroke-width="0.7"/>
<path d="M-5 0 Q0 -1.5 5 0 L5.2 8 Q0 6 -5.2 8 Z" fill="@vet1H" opacity="0.5" stroke="none"/>
<!-- plis du tissu -->
<path d="M-2.6 1 Q-3.2 12 -2.4 24" stroke="@cuir" stroke-width="0.5" fill="none" opacity="0.7"/>
<path d="M2.6 1 Q3.2 12 2.4 24" stroke="@cuir" stroke-width="0.5" fill="none" opacity="0.7"/>
<path d="M0 2 Q0.4 13 0 24" stroke="@cuir" stroke-width="0.4" fill="none" opacity="0.5"/>
<!-- bord déchiré de la braie au genou -->
<path d="M-4.4 26 L-3.6 24 L-2.4 26.5 L-1 24.5 L0.4 26.5 L1.8 24.5 L3 26.5 L4.4 26 L4 27 L-4 27 Z" fill="@vet1" stroke="none"/>
<!-- sangle de cuir à la cuisse + bouton -->
<rect x="-5.2" y="9" width="10.4" height="3" rx="1" fill="@cuir" stroke="@cuirO" stroke-width="0.6"/>
<circle cx="0" cy="10.5" r="1" fill="@peau" stroke="@cuirO" stroke-width="0.4"/>
<!-- bandes de cuir enroulées sur le tibia -->
<path d="M-4.6 27 L4.6 27 L4.3 31 L-4.3 31 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.6"/>
<g stroke="@cuirO" stroke-width="0.6" fill="none"><path d="M-4.4 31 L4.4 33 M-4.3 33.5 L4.3 35.5 M-4.1 36 L4.1 38"/></g>
<path d="M-4.4 31 Q0 30 4.4 31 L4.1 39 Q0 40.5 -4.1 39 Z" fill="@cuir" opacity="0.55" stroke="none"/>
<!-- botte fourrée : revers de fourrure en haut -->
<path d="M-5 38 Q-6 40 -4.6 41 Q0 39.5 4.6 41 Q6 40 5 38 Q0 37 -5 38 Z" fill="@vet1" stroke="@cuirO" stroke-width="0.6"/>
<path d="M-4.6 38.4 Q-5 40 -3.8 40.4 M-2 37.8 L-2.2 40.6 M0 37.6 L0 40.8 M2 37.8 L2.2 40.6 M4.6 38.4 Q5 40 3.8 40.4" stroke="@cuir" stroke-width="0.5"/>
<!-- corps du pied / botte de cuir -->
<path d="M-4.6 41 Q0 40 4.6 41 L4.4 48 Q4.6 50 2 50 L-3 50 Q-5 50 -4.6 47 Z" fill="@cuirO" stroke="@cuirO" stroke-width="0.7"/>
<path d="M-4.6 41 Q0 40 4.6 41 L4.5 44 Q0 43 -4.6 44 Z" fill="@cuir" opacity="0.6" stroke="none"/>
<path d="M-3 50 L4.4 50 L4.6 48.5 L-3.2 48.5 Z" fill="@cuirO" stroke="none"/>`,
    bras: { front: `<!-- Gladiateur : bras nu musclé + brassard de cuir au biceps + manchette/vambrace de cuir à l'avant-bras. Origine (0,0)=épaule, +y vers le poignet -->
<!-- chair du bras (épaule -> poignet) -->
<path d="M-4.6 -2 Q0 -4 4.6 -2 Q5 6 4 16 Q3.4 24 3 30 Q0 31.5 -3 30 Q-3.4 24 -4 16 Q-5 6 -4.6 -2 Z" fill="url(#dg-v-@peauH-@peauO)" stroke="@peauO" stroke-width="0.7"/>
<!-- volume du biceps -->
<path d="M-4 0 Q-5 6 -3.6 11 Q-1.6 9 -1 4 Q-2 0 -4 0 Z" fill="@peauH" opacity="0.45" stroke="none"/>
<path d="M2 0 Q4.4 5 3.6 12 Q2.6 8 1.4 3 Z" fill="@cuirH" opacity="0.5" stroke="none"/>
<!-- brassard de cuir au biceps (haut) -->
<rect x="-4.5" y="1" width="9" height="3.4" rx="1" fill="@cuir" stroke="@cuirO" stroke-width="0.6"/>
<circle cx="0" cy="2.7" r="0.9" fill="@peau" stroke="@cuirO" stroke-width="0.3"/>
<!-- vambrace de cuir cloutée à l'avant-bras (bas) -->
<path d="M-4 18 Q0 17 4 18 L3.4 30 Q0 31.5 -3.4 30 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.7"/>
<path d="M-4 18 Q0 17 4 18 L3.8 22 Q0 21 -3.8 22 Z" fill="@cuir" opacity="0.55" stroke="none"/>
<line x1="0" y1="18" x2="0" y2="30" stroke="@cuirO" stroke-width="0.6"/>
<g stroke="@cuirO" stroke-width="0.5" fill="none"><path d="M-3.6 21 L3.6 21 M-3.4 25 L3.4 25 M-3.2 28 L3.2 28"/></g>
<g fill="@peau"><circle cx="-2.2" cy="19.4" r="0.7"/><circle cx="2.2" cy="19.4" r="0.7"/></g>`, profile: `<!-- Gladiateur PROFIL (tourné à droite) : bras nu qui plie — biceps bombé, coude marqué à l'arrière, avant-bras porté en avant (+x), vambrace de cuir jusqu'au poignet -->
<path d="M-4.4 -2 Q0 -4.2 4.4 -2 Q5 4 4.2 10 Q3.9 12.6 3 14.2 L-3 13.6 Q-4.4 7 -4.4 -2 Z" fill="url(#dg-v-@peauH-@peauO)" stroke="@peauO" stroke-width="0.7"/>
<path d="M-4.2 -1 Q-4.9 6 -3.6 13 L-1.6 12.8 Q-2.6 6 -2.4 -1.4 Z" fill="@peauO" opacity="0.3" stroke="none"/>
<path d="M1.8 0 Q4.4 5 3.8 10.6 Q2.6 7 1.4 2.8 Z" fill="@peauH" opacity="0.5" stroke="none"/>
<!-- pli du coude (arrière) -->
<path d="M-3.2 12.8 Q-1 14.6 1 14.4" fill="none" stroke="@peauO" stroke-width="0.5" opacity="0.7"/>
<!-- brassard de cuir au biceps, de côté -->
<path d="M-4.4 1 Q0 -0.6 4.5 1 L4.3 4.4 Q0 2.9 -4.3 4.4 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.6"/>
<circle cx="3.2" cy="2.6" r="0.8" fill="@peau" stroke="@cuirO" stroke-width="0.3"/>
<!-- avant-bras en avant : vambrace de cuir jusqu'au poignet -->
<path d="M-2.6 14.8 Q1 13 5 14.8 Q5.8 21 5 28.8 Q1.4 30.6 -1.8 29.4 Q-3.2 21.6 -2.6 14.8 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.7"/>
<path d="M-2.4 15.2 Q1 13.6 4.8 15.2 L4.7 18.2 Q1 16.8 -2.3 18.2 Z" fill="@cuirH" opacity="0.35" stroke="none"/>
<g stroke="@cuirO" stroke-width="0.5" fill="none"><path d="M-2.3 18.6 L4.8 18.6 M-2.1 22.4 L4.9 22.4 M-1.9 26 L4.8 26"/></g>
<path d="M3.9 15.4 Q4.9 21 4.3 28.6" fill="none" stroke="@cuirO" stroke-width="0.6"/>
<g fill="@peau"><circle cx="3.4" cy="16.9" r="0.7"/><circle cx="3.6" cy="20.5" r="0.7"/></g>`, back: `<!-- Gladiateur DOS : bras nu vu de dos — capsule d'épaule assombrie, ligne de triceps, côté corps (+x) ombré ; brassard sans bouton (couture axiale), vambrace lacée au dos, clous frontaux retirés -->
<path d="M-4.6 -2 Q0 -4 4.6 -2 Q5 6 4 16 Q3.4 24 3 30 Q0 31.5 -3 30 Q-3.4 24 -4 16 Q-5 6 -4.6 -2 Z" fill="url(#dg-v-@peauH-@peauO)" stroke="@peauO" stroke-width="0.7"/>
<path d="M1.2 -1.6 Q3 -1.9 4.6 -2 Q5 6 4 16 Q3.4 24 3 30 Q2 30.6 1 30.8 Q1.8 22 2.2 15 Q2.4 5 1.2 -1.6 Z" fill="@peauO" opacity="0.32" stroke="none"/>
<path d="M-4.6 -2 Q0 -4 4.6 -2 Q4.8 0.6 4.5 2.8 Q0 0.8 -4.5 2.8 Q-4.8 0.6 -4.6 -2 Z" fill="@peauO" opacity="0.25" stroke="none"/>
<path d="M0 0.4 Q1.2 7 0.6 13.4" fill="none" stroke="@peauO" stroke-width="0.5" opacity="0.6"/>
<!-- brassard au biceps vu de dos : couture axiale, pas de bouton -->
<rect x="-4.5" y="1" width="9" height="3.4" rx="1" fill="@cuir" stroke="@cuirO" stroke-width="0.6"/>
<path d="M0 1.2 L0 4.2" stroke="@cuirO" stroke-width="0.6"/>
<path d="M-1.2 1.8 L1.2 2.6 M1.2 3 L-1.2 3.8" stroke="@cuirO" stroke-width="0.4" fill="none"/>
<!-- vambrace vue de dos : laçage croisé dorsal, pas de clous -->
<path d="M-4 18 Q0 17 4 18 L3.4 30 Q0 31.5 -3.4 30 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.7"/>
<path d="M1.4 17.6 Q2.4 24 1.9 30.4 L3.4 30 Q4 24 4 18 Z" fill="@cuirO" opacity="0.35" stroke="none"/>
<path d="M0 17.4 L0 30.6" stroke="@cuirO" stroke-width="0.6"/>
<g stroke="@cuirO" stroke-width="0.5" fill="none"><path d="M-1.6 19.6 L1.6 21 M1.6 22.4 L-1.6 23.8 M-1.6 25.2 L1.6 26.6 M1.6 28 L-1.6 29.2"/></g>` },
    tete: { front: `<!-- Gladiateur : calotte de cuir/fer cloutée, deux cornes recourbées, plumet rouge. Repère tête, calotte sur le crâne (y de -16 à +4) -->
<!-- calotte de cuir couvrant le haut du crâne -->
<path d="M-9 -1 Q-10 -13 0 -15.5 Q10 -13 9 -1 Q0 -5 -9 -1 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.9"/>
<path d="M-9 -1 Q-10 -13 0 -15.5 Q10 -13 9 -1 Q0 -5 -9 -1 Z" fill="@cuir" opacity="0.35" stroke="none"/>
<!-- bandeau de fer cloutée à la base de la calotte -->
<path d="M-9.4 -1.5 Q0 -5 9.4 -1.5 L9 2.5 Q0 -0.5 -9 2.5 Z" fill="url(#g_steelD)" stroke="@metalO" stroke-width="0.7"/>
<g fill="@peau" stroke="@cuirO" stroke-width="0.3"><circle cx="-6" cy="-0.4" r="0.8"/><circle cx="-2" cy="-1.4" r="0.8"/><circle cx="2" cy="-1.4" r="0.8"/><circle cx="6" cy="-0.4" r="0.8"/></g>
<!-- couture centrale de la calotte -->
<path d="M0 -15 Q1 -8 0.6 -2" stroke="@cuirO" stroke-width="0.6" fill="none"/>
<!-- corne gauche (recourbée vers le haut/extérieur) -->
<path d="M-7 -10 Q-13 -13 -15 -20 Q-15.5 -24 -13 -25 Q-13.5 -22 -12 -19 Q-10 -15 -6 -12 Z" fill="@vet1H" stroke="@vet1O" stroke-width="0.7"/>
<path d="M-8 -11 Q-12 -14 -13.6 -19" stroke="@vet1O" stroke-width="0.5" fill="none"/>
<!-- corne droite -->
<path d="M7 -10 Q13 -13 15 -20 Q15.5 -24 13 -25 Q13.5 -22 12 -19 Q10 -15 6 -12 Z" fill="@vet1H" stroke="@vet1O" stroke-width="0.7"/>
<path d="M8 -11 Q12 -14 13.6 -19" stroke="@vet1O" stroke-width="0.5" fill="none"/>
<!-- attache des cornes (cuir noué) -->
<circle cx="-7" cy="-10" r="1.4" fill="@cuirO"/><circle cx="7" cy="-10" r="1.4" fill="@cuirO"/>
<!-- plumet rouge planté au sommet -->
<path d="M0 -15 Q-2 -22 -5 -27 Q-2 -25 -1 -22 Q-2 -28 -2 -32 Q0 -28 1 -23 Q3 -27 5 -29 Q3 -24 1 -20 Q1 -17 0 -15 Z" fill="@vet2" stroke="@vet2O" stroke-width="0.5"/>
<path d="M0 -16 Q-1 -22 -2 -28" stroke="@vet2H" stroke-width="0.5" fill="none" opacity="0.8"/>
<!-- base de la plume liée -->
<path d="M-2 -14.5 L2 -14.5 L1.4 -17 L-1.4 -17 Z" fill="@cuirO" stroke="none"/>`, back: `<!-- Gladiateur DOS : calotte de cuir/fer cloutée vue de l'arrière (couture dorsale, bandeau cloutée), deux cornes recourbées (vues de dos), plumet rouge planté au sommet. Repère tête, y de -16 à +4 -->
<!-- calotte de cuir couvrant l'arrière du crâne (PAS de couture de face, dos lisse) -->
<path d="M-9 -1 Q-10 -13 0 -15.5 Q10 -13 9 -1 Q0 -5 -9 -1 Z" fill="#5a3f24" stroke="#3d2a16" stroke-width="0.9"/>
<path d="M-9 -1 Q-10 -13 0 -15.5 Q10 -13 9 -1 Q0 -5 -9 -1 Z" fill="#6a4a28" opacity="0.35" stroke="none"/>
<!-- bandeau de fer cloutée à la base, vu de dos -->
<path d="M-9.4 -1.5 Q0 -5 9.4 -1.5 L9 2.5 Q0 -0.5 -9 2.5 Z" fill="url(#g_steelD)" stroke="#2a3038" stroke-width="0.7"/>
<g fill="#caa46a" stroke="#3d2a16" stroke-width="0.3"><circle cx="-6" cy="-0.4" r="0.8"/><circle cx="-2" cy="-1.4" r="0.8"/><circle cx="2" cy="-1.4" r="0.8"/><circle cx="6" cy="-0.4" r="0.8"/></g>
<!-- couture dorsale centrale (laçage arrière de la calotte) -->
<path d="M0 -15 L0 -2" stroke="#3d2a16" stroke-width="0.6" fill="none"/>
<g stroke="#3d2a16" stroke-width="0.5"><path d="M-1.6 -12 L1.6 -10.5 M1.6 -8 L-1.6 -6.5 M-1.6 -4.5 L1.6 -3"/></g>
<!-- corne gauche (vue de dos, recourbée vers le haut/extérieur) -->
<path d="M-7 -10 Q-13 -13 -15 -20 Q-15.5 -24 -13 -25 Q-13.5 -22 -12 -19 Q-10 -15 -6 -12 Z" fill="#d8cdb4" stroke="#7a6a48" stroke-width="0.7"/>
<path d="M-8 -11 Q-12 -14 -13.6 -19" stroke="@vet1O" stroke-width="0.5" fill="none"/>
<!-- corne droite (vue de dos) -->
<path d="M7 -10 Q13 -13 15 -20 Q15.5 -24 13 -25 Q13.5 -22 12 -19 Q10 -15 6 -12 Z" fill="#d8cdb4" stroke="#7a6a48" stroke-width="0.7"/>
<path d="M8 -11 Q12 -14 13.6 -19" stroke="@vet1O" stroke-width="0.5" fill="none"/>
<!-- attache des cornes (cuir noué) vue de dos -->
<circle cx="-7" cy="-10" r="1.4" fill="#3d2a16"/><circle cx="7" cy="-10" r="1.4" fill="#3d2a16"/>
<!-- plumet rouge planté au sommet (vu de dos, mêmes couleurs) -->
<path d="M0 -15 Q-2 -22 -5 -27 Q-2 -25 -1 -22 Q-2 -28 -2 -32 Q0 -28 1 -23 Q3 -27 5 -29 Q3 -24 1 -20 Q1 -17 0 -15 Z" fill="#8a221a" stroke="#6a1812" stroke-width="0.5"/>
<path d="M0 -16 Q-1 -22 -2 -28" stroke="#a82a22" stroke-width="0.5" fill="none" opacity="0.7"/>
<!-- base de la plume liée -->
<path d="M-2 -14.5 L2 -14.5 L1.4 -17 L-1.4 -17 Z" fill="#3d2a16" stroke="none"/>`, profile: `<!-- Gladiateur PROFIL (tourné à droite) : calotte de cuir/fer cloutée de côté, étroite, UNE corne visible en avant + l'amorce de l'autre derrière, plumet rouge au sommet. Repère tête, y de -16 à +4 -->
<!-- calotte de cuir de profil (étroite, suit la courbe du crâne) -->
<path d="M-6 -1 Q-8 -13 0 -15.5 Q7 -14 8 -3 Q8 -1 7 -0.5 Q1 -4 -6 -1 Z" fill="#5a3f24" stroke="#3d2a16" stroke-width="0.9"/>
<path d="M-6 -1 Q-8 -13 0 -15.5 Q7 -14 8 -3 Q1 -5 -6 -1 Z" fill="#7a5630" opacity="0.35" stroke="none"/>
<!-- bandeau de fer cloutée à la base, de profil -->
<path d="M-6.4 -1.5 Q1 -4.5 7.6 -1 L7.2 3 Q1 0 -6 2.5 Z" fill="url(#g_steelD)" stroke="#2a3038" stroke-width="0.7"/>
<g fill="#caa46a" stroke="#3d2a16" stroke-width="0.3"><circle cx="-3" cy="-0.2" r="0.8"/><circle cx="1" cy="-1.4" r="0.8"/><circle cx="5" cy="-1" r="0.8"/></g>
<!-- couture latérale de la calotte -->
<path d="M0 -15 Q2 -8 3 -2" stroke="#3d2a16" stroke-width="0.6" fill="none"/>
<!-- corne AVANT (la plus visible, recourbée vers le haut/avant) -->
<path d="M5 -10 Q11 -13 14 -19 Q15 -23 12.5 -24.5 Q13 -21 11.5 -18 Q9.5 -14 4 -12 Z" fill="#e0d6bf" stroke="#7a6a48" stroke-width="0.7"/>
<path d="M6 -11 Q10 -14 12.4 -18" stroke="@vet1O" stroke-width="0.5" fill="none"/>
<!-- corne ARRIÈRE (partiellement masquée par la calotte, plus terne) -->
<path d="M-2 -11 Q-7 -14 -9 -19 Q-9.5 -22 -7.5 -23 Q-7.5 -20 -6 -17 Q-4.5 -14 -1 -12.5 Z" fill="#c8bda4" stroke="#7a6a48" stroke-width="0.6"/>
<!-- attache de corne (cuir noué) avant -->
<circle cx="4.5" cy="-10.5" r="1.4" fill="#3d2a16"/>
<circle cx="-2" cy="-11" r="1.1" fill="#2f2012"/>
<!-- plumet rouge au sommet, de profil (panache rabattu vers l'arrière) -->
<path d="M0 -15 Q-3 -21 -7 -25 Q-4 -24 -2 -21 Q-5 -27 -6 -31 Q-3 -27 -1 -22 Q-1 -18 0 -15 Z" fill="#a82a22" stroke="#6a1812" stroke-width="0.5"/>
<path d="M-0.5 -16 Q-2 -21 -4 -26" stroke="#d24a3a" stroke-width="0.5" fill="none" opacity="0.8"/>
<!-- base de la plume liée -->
<path d="M-2 -14.5 L1.6 -15 L1 -17.4 L-1.6 -17 Z" fill="#3d2a16" stroke="none"/>` }}};
