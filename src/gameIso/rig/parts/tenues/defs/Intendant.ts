import type { TenueDef } from '../types';
import { BOTTE_CUIR } from '../botte-gabarit';

export const tenue: TenueDef = {
  label: "Intendant",
  id: "intendant",
  palette: {"parementO":"#27521f","vet1":"#e7dab6","vet1O":"#9c855a","vet2":"#a83030","parement":"#3f7a3c","cuirO":"#3e2c15","cuir":"#6a4a22","metal":"#d8a83a","metalH":"#e0b440","metalO":"#7a5a1c"},
  set: {
    pied: BOTTE_CUIR,
    torse: { front: `<!-- Intendant: pourpoint creme matelasse bouffant, echarpe verte, rosettes rouges, large ceinture d'intendant garnie d'etuis a parchemin -->

<!-- corps du pourpoint, ventre rebondi -->
<path d="M-15 -27 Q0 -32 15 -27 L14 6 Q15 24 11 33 Q0 39 -11 33 Q-15 24 -14 6 Z" fill="url(#dg-v3-@vet1H-@vet1H-@vet1O)" stroke="@vet1O" stroke-width="0.8"/>
<!-- epaules bouffantes matelassees (puff) -->
<path d="M-15 -27 Q-22 -24 -19 -14 Q-13 -16 -10 -22 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.7"/>
<path d="M15 -27 Q22 -24 19 -14 Q13 -16 10 -22 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.7"/>
<!-- crevettes / fentes matelassees du plastron -->
<path d="M-8 -22 Q-9 -8 -8 6" fill="none" stroke="@vet1O" stroke-width="0.8" stroke-linecap="round"/>
<path d="M0 -24 L0 4" fill="none" stroke="@vet1O" stroke-width="0.8" stroke-linecap="round"/>
<path d="M8 -22 Q9 -8 8 6" fill="none" stroke="@vet1O" stroke-width="0.8" stroke-linecap="round"/>
<!-- echarpe / col vert en travers de la poitrine -->
<path d="M-13 -24 Q-2 -16 13 -25 L12 -19 Q-1 -10 -13 -18 Z" fill="@parement" stroke="@parementO" stroke-width="0.6"/>
<path d="M-11 -16 Q-4 -8 6 0 L4 4 Q-6 -4 -12 -11 Z" fill="@vet2" stroke="@vet2O" stroke-width="0.5"/>
<!-- rosette rouge a l'epaule droite -->
<g transform="translate(9,-21)"><circle r="3.4" fill="@vet2"/><circle r="1.4" fill="@metal"/><path d="M-3 -3 L-1 -5 M3 -3 L5 -4 M-3 3 L-5 5" stroke="@vet2O" stroke-width="1" stroke-linecap="round"/></g>
<!-- petite rosette rouge centre-poitrine -->
<g transform="translate(-3,-4)"><circle r="2.3" fill="@vet2"/><circle r="0.9" fill="@metalH"/></g>
<!-- large ceinture d'intendant -->
<rect x="-14" y="5" width="28" height="7" rx="2" fill="@vet1O" stroke="@cuirO" stroke-width="0.7"/>
<rect x="-3" y="5.5" width="6" height="6" rx="1" fill="@metal" stroke="@metalO" stroke-width="0.6"/>
<!-- etuis a parchemin / rouleaux pendus a la ceinture (attribut de l'intendant) -->
<g stroke="@cuir" stroke-width="0.6"><rect x="-11" y="11" width="3.4" height="13" rx="1.4" fill="@vet1H"/><rect x="-6.7" y="11" width="3.4" height="15" rx="1.4" fill="@vet1H"/><rect x="-2.4" y="11" width="3.4" height="12" rx="1.4" fill="@vet1"/></g>
<!-- bourse a clefs a droite -->
<path d="M5 11 Q11 11 11 18 Q11 24 6 24 Q3 22 4 16 Q3 12 5 11 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.7"/>
<!-- basque matelassee rouge sous la ceinture -->
<path d="M-13 12 Q0 16 13 12 L11 33 Q0 38 -11 33 Z" fill="@vet2" stroke="@vet2O" stroke-width="0.7"/>
<path d="M-7 14 L-7 32 M0 15 L0 35 M7 14 L7 32" stroke="@vet2O" stroke-width="0.7"/>`, back: `<!-- Intendant DOS: pourpoint creme matelasse, echarpe verte nouee dans le dos, ceinture d'intendant, basque rouge, etuis a parchemin de cote -->

<!-- corps du pourpoint vu de dos, meme silhouette -->
<path d="M-15 -27 Q0 -32 15 -27 L14 6 Q15 24 11 33 Q0 39 -11 33 Q-15 24 -14 6 Z" fill="url(#dg-v3-#efe4c4-#d9c79c-#b39d6e)" stroke="#8a734a" stroke-width="0.8"/>
<!-- epaules bouffantes matelassees (puff) -->
<path d="M-15 -27 Q-22 -24 -19 -14 Q-13 -16 -10 -22 Z" fill="#e7dab6" stroke="#9c855a" stroke-width="0.7"/>
<path d="M15 -27 Q22 -24 19 -14 Q13 -16 10 -22 Z" fill="#e7dab6" stroke="#9c855a" stroke-width="0.7"/>
<!-- couture dorsale centrale + omoplates -->
<path d="M0 -26 L0 5" fill="none" stroke="#a8946a" stroke-width="1" stroke-linecap="round"/>
<path d="M-7 -22 Q-9 -8 -7 5" fill="none" stroke="#b8a578" stroke-width="0.7" stroke-linecap="round"/>
<path d="M7 -22 Q9 -8 7 5" fill="none" stroke="#b8a578" stroke-width="0.7" stroke-linecap="round"/>
<!-- pli d'omoplate -->
<path d="M-12 -22 Q-6 -19 -3 -23" fill="none" stroke="#c2b083" stroke-width="0.6"/>
<path d="M12 -22 Q6 -19 3 -23" fill="none" stroke="#c2b083" stroke-width="0.6"/>
<!-- echarpe verte croisant le haut du dos -->
<path d="M-13 -24 Q0 -19 13 -25 L12 -19 Q0 -13 -13 -18 Z" fill="#356b34" stroke="#234f1d" stroke-width="0.6"/>
<!-- ceinture d'intendant (dos, sans boucle) -->
<rect x="-14" y="5" width="28" height="7" rx="2" fill="url(#dg-v-#a07840-#5e4322)" stroke="#3e2c15" stroke-width="0.7"/>
<path d="M-14 8.5 L14 8.5" stroke="#7a5a2c" stroke-width="0.5" opacity="0.6"/>
<!-- noeud de l'echarpe verte pendant dans le dos -->
<path d="M-2 6 Q-5 10 -3 16 Q0 12 0 8 Q0 12 3 16 Q5 10 2 6 Z" fill="#3f7a3c" stroke="#27521f" stroke-width="0.6"/>
<!-- etuis a parchemin entrevus de cote a la hanche gauche -->
<g stroke="#6a4a22" stroke-width="0.6"><rect x="-12" y="11" width="3.2" height="12" rx="1.4" fill="#cdb682"/><rect x="-8" y="11" width="3.2" height="13" rx="1.4" fill="#c6ad77"/></g>
<!-- basque matelassee rouge sous la ceinture (dos) -->
<path d="M-13 12 Q0 16 13 12 L11 33 Q0 38 -11 33 Z" fill="#a23230" stroke="#6e1d1c" stroke-width="0.7"/>
<path d="M-6 14 L-6 32 M0 15 L0 35 M6 14 L6 32" stroke="#7d2120" stroke-width="0.7"/>`, profile: `<!-- Intendant PROFIL (tourne a droite): torse etroit vu de cote, une epaule bouffante, echarpe verte en diagonale, ceinture laterale, basque rouge drapee -->
<!-- corps du pourpoint, silhouette etroite de profil, ventre proeminent vers l'avant (droite) -->
<path d="M-7 -27 Q2 -31 9 -26 Q12 -10 11 6 Q12 22 9 33 Q1 38 -6 33 Q-8 22 -7 6 Z" fill="url(#dg-v3-@vet1H-@vet1H-@vet1O)" stroke="#8a734a" stroke-width="0.8"/>
<!-- epaule bouffante matelassee unique (de profil) -->
<path d="M-6 -27 Q-13 -24 -10 -14 Q-3 -16 1 -23 Z" fill="#e7dab6" stroke="#9c855a" stroke-width="0.7"/>
<!-- bras de profil le long du flanc -->
<path d="M-7 -20 Q-11 -8 -9 8 Q-6 12 -3 8 Q-5 -6 -2 -19 Z" fill="#ddcca0" stroke="#9c855a" stroke-width="0.6"/>
<!-- drape lateral / pli vertical du plastron -->
<path d="M3 -24 Q4 -8 3 6" fill="none" stroke="#b8a578" stroke-width="0.8" stroke-linecap="round"/>
<!-- echarpe verte en diagonale sur l'epaule visible -->
<path d="M-6 -25 Q3 -20 9 -23 L8 -17 Q2 -14 -6 -19 Z" fill="#3f7a3c" stroke="#27521f" stroke-width="0.6"/>
<path d="M-5 -17 Q1 -11 6 -4 L4 0 Q-1 -7 -6 -12 Z" fill="#356b34" stroke="#234f1d" stroke-width="0.5"/>
<!-- ceinture d'intendant vue de cote -->
<path d="M-7 5 Q2 4 11 6 L11 12 Q2 11 -7 12 Z" fill="@vet1O" stroke="#3e2c15" stroke-width="0.7"/>
<!-- un etui a parchemin pendu au flanc -->
<rect x="-3" y="11" width="3.2" height="14" rx="1.4" fill="#d7c28e" stroke="#6a4a22" stroke-width="0.6"/>
<!-- basque matelassee rouge, drapee de cote -->
<path d="M-7 12 Q2 15 11 12 L9 33 Q1 38 -6 33 Z" fill="#a23230" stroke="#6e1d1c" stroke-width="0.7"/>
<path d="M2 14 L2 35 M-3 14 L-3 32" stroke="#7d2120" stroke-width="0.7"/>` },
    jambes: `<!-- Intendant: haut-de-chausses bouffant raye rouge/creme (pluderhosen) puis bas de chausse uni, botte brune. Cote gauche, miroite a droite. -->
<!-- pluderhosen bouffant (cuisse) raye rouge et creme -->
<path d="M-5 0 Q-9 2 -8 12 Q-9 22 -3 24 Q3 24 4 14 Q5 4 3 0 Z" fill="@vet1H" stroke="@vet1O" stroke-width="0.7"/>
<path d="M-7 4 Q-8 12 -5 20" fill="none" stroke="@vet2" stroke-width="2" stroke-linecap="round"/>
<path d="M-2 2 Q-1 12 -1 22" fill="none" stroke="@vet2" stroke-width="2" stroke-linecap="round"/>
<path d="M3 3 Q3 12 1 21" fill="none" stroke="@vet2" stroke-width="1.6" stroke-linecap="round"/>
<!-- jarretiere a la base du pluderhosen -->
<path d="M-7 22 Q-2 26 4 22 L4 25 Q-2 28 -7 25 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.6"/>
<!-- bas de chausse uni (mollet) -->
<path d="M-4 25 Q-5 36 -3 42 L3 42 Q4 34 3 25 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.6"/>
<!-- botte brune souple -->
<path d="M-4 41 Q-5 47 -3 50 L5 50 Q6 46 4 41 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.8"/>
<path d="M-4 43 Q0 44 4 43" fill="none" stroke="@cuirO" stroke-width="0.6"/>`,
    bras: { front: `<!-- Intendant: manche creme bouffante matelassee + gant vert. Bras gauche, miroite a droite. -->
<!-- haut de manche bouffant (epaule->coude) -->
<path d="M-4 -2 Q-9 0 -8 9 Q-9 17 -3 18 Q3 18 4 10 Q5 2 3 -2 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.7"/>
<path d="M-5 1 Q-6 9 -4 16 M1 0 Q2 9 1 16" fill="none" stroke="@vet1O" stroke-width="0.7" stroke-linecap="round"/>
<!-- crevee laissant voir le tissu interieur clair -->
<path d="M-2 4 Q-3 10 -1 14" fill="none" stroke="@vet1H" stroke-width="1.4" stroke-linecap="round"/>
<!-- avant-bras: manche serree creme -->
<path d="M-3 17 Q-4 23 -3 27 L3 27 Q4 22 3 17 Z" fill="@vet1H" stroke="@vet1O" stroke-width="0.6"/>
<!-- gant vert -->
<path d="M-3 26 Q-4 31 -2 34 Q1 35 3 33 Q4 29 3 26 Z" fill="@parement" stroke="@parementO" stroke-width="0.7"/>
<path d="M-2 33 L-2 34 M0 34 L0 35 M2 33 L2 34" stroke="@parementO" stroke-width="0.6" stroke-linecap="round"/>`, profile: `<!-- Intendant PROFIL (tourne a droite) : manche bouffante de cote, coude qui plie, avant-bras serre porte en avant (+x), gant vert jusqu'a la main -->
<path d="M-3.8 -2 Q-8.4 0.4 -7.8 9 Q-8.4 15.8 -2.8 17.4 Q2.6 16.9 3.7 10.4 Q4.7 2 2.9 -2 Q-0.5 -3.8 -3.8 -2 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.7"/>
<path d="M-4.6 1 Q-5.7 9 -4 15.6 M0.9 0 Q1.9 9 0.9 15.4" fill="none" stroke="@vet1O" stroke-width="0.7" stroke-linecap="round"/>
<path d="M-1.6 4 Q-2.6 10 -0.9 14" fill="none" stroke="@vet1H" stroke-width="1.4" stroke-linecap="round"/>
<path d="M-2.3 16.8 Q0.6 18 3.3 16.8 Q4.4 21 3.9 26.6 L-1.4 26.4 Q-2.9 21.4 -2.3 16.8 Z" fill="@vet1H" stroke="@vet1O" stroke-width="0.6"/>
<path d="M-1.3 26.2 Q1.4 27.3 4 26.1 Q4.9 29.4 3.8 32.6 Q1 34.4 -1.3 33 Q-2.2 29.4 -1.3 26.2 Z" fill="@parement" stroke="@parementO" stroke-width="0.7"/>
<path d="M-1.2 27.6 Q1.4 28.7 3.9 27.5" fill="none" stroke="@parementO" stroke-width="0.5"/>
<path d="M2.9 32.4 L3 33.4 M1 33.6 L1 34.6" stroke="@parementO" stroke-width="0.6" stroke-linecap="round"/>`, back: `<!-- Intendant DOS : manche bouffante vue de dos — matelassure en coutures dorsales, capsule d'epaule assombrie, cote corps (+x) ombre ; crevee frontale retiree, gant lisse sans coutures de doigts -->
<path d="M-4 -2 Q-9 0 -8 9 Q-9 17 -3 18 Q3 18 4 10 Q5 2 3 -2 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.7"/>
<path d="M-4 -2 Q-0.5 -3.6 3 -2 Q3.4 -0.6 3.6 1.2 Q-1 -1 -6.4 1.8 Q-5.4 -1 -4 -2 Z" fill="@vet1O" opacity="0.35" stroke="none"/>
<path d="M-2.2 -1.6 Q-2.8 8 -2 17.6" fill="none" stroke="@vet1O" stroke-width="0.8" stroke-linecap="round"/>
<path d="M-5.6 0.4 Q-6.6 9 -5 16" fill="none" stroke="@vet1O" stroke-width="0.7" stroke-linecap="round" opacity="0.8"/>
<path d="M1.4 -1 Q2.6 8 1.8 17.2 L3.4 16 Q4.4 8 3.6 -1.2 Z" fill="@vet1O" opacity="0.4" stroke="none"/>
<path d="M-3 17 Q-4 23 -3 27 L3 27 Q4 22 3 17 Z" fill="@vet1H" stroke="@vet1O" stroke-width="0.6"/>
<path d="M1.2 17.4 Q1.9 22 1.6 26.7 L3 27 Q3.7 22 3.2 17.1 Z" fill="@vet1O" opacity="0.35" stroke="none"/>
<path d="M-3 26 Q-4 31 -2 34 Q1 35 3 33 Q4 29 3 26 Z" fill="@parement" stroke="@parementO" stroke-width="0.7"/>
<path d="M-2.5 27.4 Q0.2 28.5 2.8 27.3" fill="none" stroke="@parementO" stroke-width="0.5" opacity="0.8"/>
<path d="M1.2 27.5 Q1.9 30 1.6 33.6 L3 33 Q3.7 30 3.35 26.6 Z" fill="@parementO" opacity="0.3" stroke="none"/>` },
  },
};
