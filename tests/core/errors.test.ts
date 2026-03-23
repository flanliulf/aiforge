import { describe, it, expect } from 'vitest'
import {
  AiforgeError,
  EXIT_SUCCESS,
  EXIT_INSTALL_FAILURE,
  EXIT_AUTH_FAILURE,
  EXIT_ARG_ERROR,
  authError,
  argError,
} from '../../src/core/errors.js'
import type { ExitCode } from '../../src/core/errors.js'

describe('AiforgeError — unified error type (AC: #2)', () => {
  it('extends Error', () => {
    const err = new AiforgeError('something broke', 'ERR_TEST', 1, 'fatal', 'because test', [])
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(AiforgeError)
  })

  it('has name AiforgeError', () => {
    const err = new AiforgeError('msg', 'ERR_TEST', 1, 'fatal', 'why', [])
    expect(err.name).toBe('AiforgeError')
  })

  it('stores code', () => {
    const err = new AiforgeError('msg', 'ERR_AUTH', 2, 'fatal', 'why', [])
    expect(err.code).toBe('ERR_AUTH')
  })

  it('stores exitCode', () => {
    const err = new AiforgeError('msg', 'ERR_AUTH', 2, 'fatal', 'why', [])
    expect(err.exitCode).toBe(2)
  })

  it('stores severity fatal', () => {
    const err = new AiforgeError('msg', 'ERR_TEST', 1, 'fatal', 'why', [])
    expect(err.severity).toBe('fatal')
  })

  it('stores severity partial', () => {
    const err = new AiforgeError('msg', 'ERR_TEST', 1, 'partial', 'why', [])
    expect(err.severity).toBe('partial')
  })

  it('stores why', () => {
    const err = new AiforgeError('msg', 'ERR_TEST', 1, 'fatal', 'token expired', [])
    expect(err.why).toBe('token expired')
  })

  it('stores fix array', () => {
    const err = new AiforgeError('msg', 'ERR_TEST', 1, 'fatal', 'why', [
      'aiforge init',
      'aiforge install',
    ])
    expect(err.fix).toEqual(['aiforge init', 'aiforge install'])
  })

  it('message is accessible via .message', () => {
    const err = new AiforgeError('something broke', 'ERR_TEST', 1, 'fatal', 'why', [])
    expect(err.message).toBe('something broke')
  })
})

describe('exit code constants (AC: #2)', () => {
  it('EXIT_SUCCESS is 0', () => {
    expect(EXIT_SUCCESS).toBe(0)
  })

  it('EXIT_INSTALL_FAILURE is 1', () => {
    expect(EXIT_INSTALL_FAILURE).toBe(1)
  })

  it('EXIT_AUTH_FAILURE is 2', () => {
    expect(EXIT_AUTH_FAILURE).toBe(2)
  })

  it('EXIT_ARG_ERROR is 3', () => {
    expect(EXIT_ARG_ERROR).toBe(3)
  })

  it('exit code constants are assignable to ExitCode type', () => {
    const codes: ExitCode[] = [
      EXIT_SUCCESS,
      EXIT_INSTALL_FAILURE,
      EXIT_AUTH_FAILURE,
      EXIT_ARG_ERROR,
    ]
    expect(codes).toEqual([0, 1, 2, 3])
  })
})

describe('factory functions (AC: #2)', () => {
  it('authError() creates AiforgeError with exitCode 2', () => {
    const err = authError('token invalid', 'token expired', ['aiforge init'])
    expect(err).toBeInstanceOf(AiforgeError)
    expect(err.exitCode).toBe(EXIT_AUTH_FAILURE)
    expect(err.severity).toBe('fatal')
    expect(err.message).toBe('token invalid')
    expect(err.why).toBe('token expired')
    expect(err.fix).toEqual(['aiforge init'])
  })

  it('authError() has code ERR_AUTH', () => {
    const err = authError('msg', 'why', [])
    expect(err.code).toBe('ERR_AUTH')
  })

  it('argError() creates AiforgeError with exitCode 3', () => {
    const err = argError('missing source', 'source argument required', ['aiforge install <source>'])
    expect(err).toBeInstanceOf(AiforgeError)
    expect(err.exitCode).toBe(EXIT_ARG_ERROR)
    expect(err.severity).toBe('fatal')
  })

  it('argError() has code ERR_ARG', () => {
    const err = argError('msg', 'why', [])
    expect(err.code).toBe('ERR_ARG')
  })
})
