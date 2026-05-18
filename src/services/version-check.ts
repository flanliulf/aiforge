import { execFile } from 'node:child_process'

const GEMINI_MINIMUM_VERSION = [0, 26, 0] as const

function parseGeminiVersion(output: string): string | null {
  const match = output.match(/(\d+)\.(\d+)\.(\d+)/)
  return match ? match[0] : null
}

function isVersionAtLeast(version: string, minimum: readonly number[]): boolean {
  const currentParts = version.split('.').map((part) => Number.parseInt(part, 10))

  for (let index = 0; index < minimum.length; index++) {
    const current = currentParts[index] ?? 0
    const required = minimum[index] ?? 0
    if (current > required) return true
    if (current < required) return false
  }

  return true
}

export async function checkGeminiVersion(): Promise<{
  version: string | null
  meetsRequirement: boolean
}> {
  return await new Promise((resolve) => {
    try {
      execFile('gemini', ['--version'], { timeout: 2000 }, (error, stdout, stderr) => {
        if (error) {
          resolve({ version: null, meetsRequirement: false })
          return
        }

        const version = parseGeminiVersion(`${stdout}\n${stderr}`)
        if (!version) {
          resolve({ version: null, meetsRequirement: false })
          return
        }

        resolve({
          version,
          meetsRequirement: isVersionAtLeast(version, GEMINI_MINIMUM_VERSION),
        })
      })
    } catch {
      resolve({ version: null, meetsRequirement: false })
    }
  })
}
