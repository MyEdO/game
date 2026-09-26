import type { CreatureDef } from '../types';

// Grand Aigle (ZI) — rapace géant (Taille Énorme au record → ×2.7 au spawn). Artwork ZI 6 p.65 :
// aigle en PIQUÉ, ailes déployées immenses en V, serres tendues en avant → mode `raptor` du
// gabarit aviaire (dessin `avian/raptorParts.ts`). Palette de la réf : tête/poitrail brun doré
// (@corpsH), ailes brun très sombre presque noir (@corps), aile lointaine brun pâle (@cheveux),
// pattes/cire jaune d'or (@cuir), serres noires.
export const creature: CreatureDef = {
  label: 'Grand Aigle',
  id: "grand-aigle",
  plan: 'avian',
  bird: {
    sl: 1.05, girth: 1.0, raptor: true,
    palette: { corps: '#3a2a1c', corpsO: '#191009', corpsH: '#c89a4e', cheveux: '#9c8767', cheveuxO: '#57452e', cuir: '#dca62e' },
  },
};
