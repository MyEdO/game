import type { PropViz } from '../../types';
import { P } from '../../decorPalette';

export const prop: PropViz = { id: "orme", render: ()=>`<g><ellipse cx="60" cy="148" rx="26" ry="11" fill="${P.ombre}" opacity="0.3"/><path d="M56 150 L58 96 L46 70 L52 68 L60 88 L68 68 L74 70 L62 96 L64 150 Z" fill="${P.boisSombre2}"/><path d="M60 26 C96 30 104 60 92 84 C80 92 40 92 28 84 C16 60 24 30 60 26 Z" fill="${P.feuillageFonce}"/><path d="M60 34 C84 38 92 58 84 76 L60 70 Z" fill="${P.feuillageMoyen2}" opacity="0.6"/></g>` };
