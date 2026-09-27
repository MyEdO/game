import { RollShell } from './RollShell';
import { useHealJetProps } from './jetProps/useHealJetProps';

/** Modale de soin autonome — COMBAT seulement (hors combat, l'infirmerie embarque le flux). */
export function HealModal() {
  const jet = useHealJetProps();
  return jet && <RollShell {...jet} />;
}
