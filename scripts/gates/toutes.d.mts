export function tuerArbre(pid: number | undefined, options?: {
  plateforme?: NodeJS.Platform;
  lister?: () => string;
  tuer?: (pid: number) => void;
}): void;
