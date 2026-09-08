// Patch Nitro pour éviter ENOTEMPTY sur Windows.
// fsp.rm(dir, { recursive: true, force: true }) échoue sur Windows quand des handles
// sont ouverts (antivirus, IDE, indexer). cmd /c rmdir /s /q est plus robuste.
// Ce script est appelé via postinstall pour réappliquer le patch après npm install.
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const nitroPath = join(rootDir, 'node_modules', 'nitropack', 'dist', 'core', 'index.mjs')

const original = `async function prepareDir(dir) {
  await fsp.rm(dir, { recursive: true, force: true });
  await fsp.mkdir(dir, { recursive: true });
}`

const patched = `async function prepareDir(dir) {
  if (process.platform === 'win32') {
    // Sur Windows, fsp.rm échoue souvent avec ENOTEMPTY à cause de handles ouverts.
    // cmd /c rmdir /s /q est plus robuste.
    const { execFileSync } = await import('node:child_process');
    try { execFileSync('cmd', ['/c', 'rmdir', '/s', '/q', dir], { stdio: 'ignore' }); } catch {}
  } else {
    await fsp.rm(dir, { recursive: true, force: true });
  }
  await fsp.mkdir(dir, { recursive: true });
}`

try {
	const content = await readFile(nitroPath, 'utf8')
	if (content.includes('execFileSync') && content.includes('rmdir')) {
		console.log('Nitro already patched for Windows')
		process.exit(0)
	}
	if (!content.includes(original)) {
		console.warn('Nitro prepareDir not found — skipping patch (Nitro version may have changed)')
		process.exit(0)
	}
	await writeFile(nitroPath, content.replace(original, patched))
	console.log('Nitro patched for Windows ENOTEMPTY fix')
} catch (error) {
	console.warn('Could not patch Nitro:', error instanceof Error ? error.message : String(error))
}
