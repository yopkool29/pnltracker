// Écouter l'événement de fermeture émis par Rust après confirmation du dialog.
// Rust s'occupe d'arrêter les services et de quitter ; le frontend
// affiche juste l'overlay pendant l'arrêt.
import { listen } from '@tauri-apps/api/event'

export default defineNuxtPlugin(() => {
	const w = window as unknown as { __TAURI_INTERNALS__?: unknown }
	if (!w.__TAURI_INTERNALS__) return

	const shuttingDown = useState<boolean>('shuttingDown', () => false)

	listen('app:shutdown', () => {
		shuttingDown.value = true
	})
})
