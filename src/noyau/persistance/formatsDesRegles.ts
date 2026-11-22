/** #3526 */
const TRANSITION_DES_REGLES_DE_CHIRURGIE_ET_FRENESIE = {
  save: { avant: 'f642d26deb938799', apres: '82d04f67e7828613' },
  roster: { avant: '974d8daa87ece06f', apres: '495a3f0fa90e7f2c' },
  exportHeros: { avant: '372cd4f616141f86', apres: '5a7b7626e88e0172' },
} as const;

export function formatAvantLesReglesDeChirurgieEtFrenesie(
  document: keyof typeof TRANSITION_DES_REGLES_DE_CHIRURGIE_ET_FRENESIE,
  formatCourant: string,
): string {
  const { avant, apres } = TRANSITION_DES_REGLES_DE_CHIRURGIE_ET_FRENESIE[document];
  return formatCourant === apres ? avant : formatCourant;
}
