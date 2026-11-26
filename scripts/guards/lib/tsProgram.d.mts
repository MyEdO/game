import type { Program, Checker } from 'typescript/unstable/sync';
import type { PasseDesProjets } from './serrureDesProjets.mjs';

export interface SessionProgramme {
  program: Program;
  checker: Checker;
  dispose(): void;
}
export const VIRTUAL_ROOT: string;
export function libererSessions(sessions: Iterable<Pick<SessionProgramme, 'dispose'>>, erreursInitiales?: readonly unknown[]): void;
export function repoProgram(
  root: string,
  choisirRootNames: (fileNames: readonly string[], root: string) => string[],
  recouvrement?: Readonly<Record<string, string>>,
  compilerOptions?: Readonly<Record<string, unknown>>,
  options?: { porte?: PasseDesProjets },
): SessionProgramme;
export function virtualProgram(files: Record<string, string>, options?: Record<string, unknown>): SessionProgramme;
export function syntaxProgram(files: Record<string, string>): SessionProgramme;
