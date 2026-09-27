import type { CreatureDef } from '../types';

// Griffon — fidélité à l'artwork officiel (art-ref/ldb/page322_img7643.png) : TRICOLORE net —
// ailes brun-roux FONCÉ (famille @aile* propre, patron pégase), tête/encolure/poitrail plumage
// DORÉ clair (robe + crinière hirsute dorées), arrière-train de LION fauve RAYÉ TIGRÉ (markings
// 'rayures' + rayures de cuisse en deco). Ailes portées DRESSÉES à demi-ouvertes (wingPose,
// le port de l'artwork — plus l'aile couchée plate). Avant-train d'AIGLE : serres jaunes
// (frontFoot 'serre', @cuir vif) sur TARSE écailleux jaune + culotte de plumes (deco des
// antérieurs) — nettement distinct des pattes félines arrière (foot 'patte', griffes sombres).
export const creature: CreatureDef = {
  label: "Griffon",
  id: "griffon",
  plan: 'winged',
  quad: {
    sl: 1.15, build: 'feline', girth: 1.05, bodyLen: 1, neckLen: 0.82, neckAngle: -26,
    legLen: 0.92, head: 'aigle', tail: 'leonine', ears: 'pointues', foot: 'patte',
    frontFoot: 'serre', wings: 'plumes', wingSpan: 1.42, wingPose: 'dressees',
    mane: 'hirsute', headScale: 1.15, tailLen: 1.15, markings: 'rayures',
    deco: {
      // ANTÉRIEURS d'aigle : tarse écailleux jaune (bas du canon) + culotte de plumes dorées
      // retombant de la cuisse — le contraste serre/patte de l'artwork (repère local du membre,
      // y 0 = haut du segment).
      basAvD: `<g data-deco="tarse-aigle"><path d="M-2.7 5.5 L2.7 5.5 L2.3 20 Q0 21.6 -2.3 20 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.5"/><path d="M-2.4 8.5 h4.8 M-2.3 11.5 h4.6 M-2.2 14.5 h4.4 M-2.1 17.5 h4.2" stroke="@cuirO" stroke-width="0.5" opacity="0.7" fill="none"/></g>`,
      basAvG: `<g data-deco="tarse-aigle"><path d="M-2.7 5.5 L2.7 5.5 L2.3 20 Q0 21.6 -2.3 20 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.5"/><path d="M-2.4 8.5 h4.8 M-2.3 11.5 h4.6 M-2.2 14.5 h4.4 M-2.1 17.5 h4.2" stroke="@cuirO" stroke-width="0.5" opacity="0.7" fill="none"/></g>`,
      hautAvD: `<g data-deco="culotte-plumes"><path d="M-4 20.5 q-0.6 4 0.6 6.4 l1.6 -3 l1 3.6 l1.7 -3.2 l1.1 3.4 l1.6 -2.9 q1.1 -2.4 0.6 -4.3 Q0 18.5 -4 20.5 Z" fill="@corps" stroke="@corpsO" stroke-width="0.45"/></g>`,
      hautAvG: `<g data-deco="culotte-plumes"><path d="M-4 20.5 q-0.6 4 0.6 6.4 l1.6 -3 l1 3.6 l1.7 -3.2 l1.1 3.4 l1.6 -2.9 q1.1 -2.4 0.6 -4.3 Q0 18.5 -4 20.5 Z" fill="@corps" stroke="@corpsO" stroke-width="0.45"/></g>`,
      // POSTÉRIEURS de tigre : barres sombres en travers de la cuisse (le rayé continue des
      // flancs — markings 'rayures' — jusque sur l'arrière-main).
      hautArD: `<g data-deco="rayures-cuisse" opacity="0.55" stroke="@corpsO" stroke-width="1.8" fill="none" stroke-linecap="round"><path d="M-4.6 6 q4.6 1.6 9 0.6 M-4.2 10.5 q4.2 1.6 8.4 0.6 M-3.6 15 q3.6 1.4 7.2 0.5 M-3 19.5 q3 1.2 6 0.4"/></g>`,
      hautArG: `<g data-deco="rayures-cuisse" opacity="0.55" stroke="@corpsO" stroke-width="1.8" fill="none" stroke-linecap="round"><path d="M-4.6 6 q4.6 1.6 9 0.6 M-4.2 10.5 q4.2 1.6 8.4 0.6 M-3.6 15 q3.6 1.4 7.2 0.5 M-3 19.5 q3 1.2 6 0.4"/></g>`,
    },
    palette: {
      corps: '#c08e3e', corpsO: '#59360f', corpsH: '#eed08a', // robe fauve dorée, rayures/ombres brun sombre
      cheveux: '#e6bd52', cheveuxO: '#8a5c16', // collerette/crinière dorée claire (tête-poitrail)
      cuir: '#d2a02c', // serres + tarses jaune vif (raccord au bec #d4a82e)
      aile: '#6d3920', aileO: '#37180a', aileH: '#c98a52', // plumage d'aile brun-roux foncé, arêtes cuivrées
    },
  },
};
