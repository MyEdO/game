// Point d'entrée du bundle `wfrp-pont.js` (IIFE) : contrat `poc/godot/pont/CONTRAT.md`.
import { creerPont, type Pont } from './pont';

(globalThis as typeof globalThis & { wfrpPont: Pont }).wfrpPont = creerPont();
