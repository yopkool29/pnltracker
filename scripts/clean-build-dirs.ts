import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const isWindows = process.platform === 'win32'

// Nettoyer .nuxt et .output avant le build pour éviter ENOTEMPTY/EPERM sur Windows.
// Sur Windows, rm de node:fs échoue souvent avec ENOTEMPTY/EPERM à cause de handles
// ouverts (IDE, Defender, indexing). cmd /c rmdir /s /q est plus robuste.
const robustRm = async (target: string) => {
	if (isWindows) {
		try {
			// rmdir /s /q supprime le dossier et tout son contenu de façon silencieuse
			await execFileAsync('cmd', ['/c', 'rmdir', '/s', '/q', target], { stdio: 'ignore' })
		} catch {
			// Si rmdir échoue (dossier n'existe pas ou verrouillé), on ignore
		}
	} else {
		await rm(target, { recursive: true, force: true })
	}
}

console.log('Cleaning .nuxt and .output...')
await robustRm(join(rootDir, '.nuxt'))
await robustRm(join(rootDir, '.output'))
console.log('Clean done.')
