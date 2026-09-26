// Raccourcis clavier du dashboard :
// - D : verrouiller/déverrouiller la grille (le verrouillage sauvegarde le layout)
// - S : ouvrir/fermer les settings du widget survolé (un seul panneau à la fois)
// - Ctrl+Z : annuler la dernière modification du workspace actif
// Ignorés dans les champs éditables et quand une vraie modale est ouverte.
export const useDashboardShortcuts = (
	saveGridLayout: () => void,
	undoWorkspaceChange: () => void,
) => {
	const isGridDraggable = ref(false)
	const { toggleHoveredSettings } = useChartSettingsShortcut()

	const toggleGridDraggable = () => {
		if (isGridDraggable.value) saveGridLayout()
		isGridDraggable.value = !isGridDraggable.value
	}

	const isEditableTarget = (target: EventTarget | null) => {
		const el = target as HTMLElement
		return el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)
	}

	// Le popover settings a aussi role="dialog" (reka) — il ne doit pas bloquer les raccourcis
	const hasBlockingDialog = () => Array.from(document.querySelectorAll('[role="dialog"]'))
		.some(dialog => !dialog.querySelector('[data-chart-settings-popover]'))

	const onKeydown = (e: KeyboardEvent) => {
		if (isEditableTarget(e.target)) return
		const key = e.key.toLowerCase()
		if ((e.ctrlKey || e.metaKey) && key === 'z') {
			e.preventDefault()
			undoWorkspaceChange()
			return
		}
		if (e.ctrlKey || e.metaKey || e.altKey || hasBlockingDialog()) return
		if (key === 'd') toggleGridDraggable()
		else if (key === 's') toggleHoveredSettings()
	}

	onMounted(() => document.addEventListener('keydown', onKeydown))
	onUnmounted(() => document.removeEventListener('keydown', onKeydown))

	return { isGridDraggable, toggleGridDraggable }
}
