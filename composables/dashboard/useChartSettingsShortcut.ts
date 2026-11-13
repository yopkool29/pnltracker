// Handle de settings du widget sous le curseur — enregistré par
// BaseWidgetCard au mouseenter, basculé par le raccourci clavier (S).
// Un seul popover settings ouvert à la fois : ouvrir un handle ferme le précédent.
type SettingsHandle = {
	isOpen: () => boolean
	close: () => void
	toggle: () => void
}

let hoveredHandle: SettingsHandle | null = null
let openedHandle: SettingsHandle | null = null

export const useChartSettingsShortcut = () => {
	const registerHoveredSettingsHandle = (handle: SettingsHandle) => {
		hoveredHandle = handle
	}
	const unregisterHoveredSettingsHandle = (handle: SettingsHandle) => {
		if (hoveredHandle === handle) hoveredHandle = null
	}

	// Chaque carte notifie l'ouverture/fermeture de son popover (clic ou raccourci)
	const notifySettingsState = (handle: SettingsHandle, open: boolean) => {
		if (open) {
			if (openedHandle && openedHandle !== handle) openedHandle.close()
			openedHandle = handle
		} else if (openedHandle === handle) {
			openedHandle = null
		}
	}

	const toggleHoveredSettings = () => {
		if (openedHandle && openedHandle !== hoveredHandle) openedHandle.close()
		hoveredHandle?.toggle()
	}

	return { registerHoveredSettingsHandle, unregisterHoveredSettingsHandle, notifySettingsState, toggleHoveredSettings }
}
