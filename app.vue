<template>
    <UApp :locale="locale == 'fr' ? fr : en">
        <NuxtLayout>
            <NuxtPage />
        </NuxtLayout>
        <!-- Overlay global de fermeture -->
        <div v-if="shuttingDown" class="shutdown-overlay">
            <div class="shutdown-content">
                <img src="/img/logo-dark.svg" alt="PnlTracker" class="shutdown-logo" />
                <div class="shutdown-spinner" />
                <p class="shutdown-text">{{ t('app.shuttingDown') }}</p>
            </div>
        </div>
    </UApp>
</template>

<script setup lang="ts">
import { fr, en } from '@nuxt/ui/locale'

const { locale, t } = useI18n()
const shuttingDown = useState<boolean>('shuttingDown', () => false)

// Helper: import dynamique pour éviter que @tauri-apps/api/core soit inclus dans le bundle SSR
// Guard: window.__TAURI_INTERNALS__ n'existe que dans la webview Tauri, pas en navigateur normal
const tauriInvoke = async (cmd: string, args?: Record<string, unknown>) => {
	const w = window as unknown as { __TAURI_INTERNALS__?: unknown }
	if (!w.__TAURI_INTERNALS__) return
	const { invoke } = await import('@tauri-apps/api/core')
	return invoke(cmd, args).catch((e) => console.error(`[app.vue] ${cmd} failed:`, e))
}

// Synchroniser la langue avec Tauri pour les boîtes de dialogue natives
watch(locale, (lang) => {
	console.log('[app.vue] locale changed to:', lang)
	tauriInvoke('set_app_language', { lang })
})

// Fermer le splashscreen Tauri et sync la langue initiale
onMounted(() => {
	tauriInvoke('set_app_language', { lang: locale.value })
	tauriInvoke('close_splashscreen')
})
</script>

<style scoped>
.shutdown-overlay {
	position: fixed;
	inset: 0;
	z-index: 9999;
	background: #0f0f14;
	display: flex;
	align-items: center;
	justify-content: center;
}
.shutdown-content {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 24px;
}
.shutdown-logo {
	width: 200px;
	height: 60px;
}
.shutdown-spinner {
	width: 32px;
	height: 32px;
	border: 2px solid rgba(255, 255, 255, 0.06);
	border-top-color: rgba(255, 255, 255, 0.35);
	border-radius: 50%;
	animation: shutdown-spin 0.9s linear infinite;
}
.shutdown-text {
	color: #e0e0e0;
	font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
	font-size: 14px;
}
@keyframes shutdown-spin {
	to { transform: rotate(360deg); }
}
</style>
