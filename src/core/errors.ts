import type { Severity } from './types.js'

export type ExitCode = 0 | 1 | 2 | 3

export const EXIT_SUCCESS: ExitCode = 0
export const EXIT_INSTALL_FAILURE: ExitCode = 1
export const EXIT_AUTH_FAILURE: ExitCode = 2
export const EXIT_ARG_ERROR: ExitCode = 3

export class AiforgeError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly exitCode: ExitCode,
    public readonly severity: Severity,
    public readonly why: string,
    public readonly fix: string[]
  ) {
    super(message)
    this.name = 'AiforgeError'
  }
}

export function authError(message: string, why: string, fix: string[]): AiforgeError {
  return new AiforgeError(message, 'ERR_AUTH', EXIT_AUTH_FAILURE, 'fatal', why, fix)
}

export function argError(message: string, why: string, fix: string[]): AiforgeError {
  return new AiforgeError(message, 'ERR_ARG', EXIT_ARG_ERROR, 'fatal', why, fix)
}
