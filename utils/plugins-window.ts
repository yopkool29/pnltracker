import type { TJPlugin, TJPluginPageSlot } from '~/type/plugin'

// Initialize plugin window globals
export const initPluginWindowGlobals = () => {
    if (typeof window === 'undefined') return

    window.__TJ_PLUGIN_ACTIONS__ = []
    window.__TJ_PLUGIN_MODALS__ = []
    window.__TJ_PLUGIN_PAGE_SLOTS__ = []
}

// Clean up plugin data from window globals
export const cleanupPluginData = (
    pluginId: string,
    pluginPageSlots: { value: TJPluginPageSlot[] }
) => {
    if (typeof window === 'undefined') return

    // Remove plugin actions
    window.__TJ_PLUGIN_ACTIONS__ = window.__TJ_PLUGIN_ACTIONS__.filter(
        (a) => !a.id.startsWith(pluginId)
    )

    // Remove plugin modals
    window.__TJ_PLUGIN_MODALS__ = window.__TJ_PLUGIN_MODALS__.filter(
        (m) => !m.id.startsWith(pluginId)
    )

    // Remove plugin page slots
    pluginPageSlots.value = pluginPageSlots.value.filter(
        (s) => s.pluginId !== pluginId
    )
    window.__TJ_PLUGIN_PAGE_SLOTS__ = pluginPageSlots.value

    // Remove plugin reference
    ;(window as unknown as { [key: string]: TJPlugin | undefined })[pluginId] =
        undefined
}

// Check if plugin is already loaded
export const isPluginLoaded = (pluginId: string): boolean => {
    if (typeof window === 'undefined') return false

    const plugin = (window as unknown as { [key: string]: TJPlugin })[pluginId]
    return !!plugin
}

// Get plugin from window
export const getPlugin = (pluginId: string): TJPlugin | undefined => {
    if (typeof window === 'undefined') return undefined

    return (window as unknown as { [key: string]: TJPlugin })[pluginId]
}

// Dispatch plugin load event
export const dispatchPluginLoadEvent = (pluginId: string) => {
    if (typeof window === 'undefined') return

    window.dispatchEvent(
        new CustomEvent('tj-plugin-load', { detail: { pluginId } })
    )
}

// Dispatch plugin open modal event
export const dispatchPluginOpenModalEvent = (modalId: string) => {
    if (typeof window === 'undefined') return

    window.dispatchEvent(
        new CustomEvent('tj-plugin-open-modal', { detail: { id: modalId } })
    )
}

// Add plugin action
export const addPluginAction = (action: {
    id: string
    label: string
    icon?: string
    run: () => void
}) => {
    if (typeof window === 'undefined') return

    const idx = window.__TJ_PLUGIN_ACTIONS__.findIndex(
        (a) => a.id === action.id
    )
    if (idx >= 0) {
        window.__TJ_PLUGIN_ACTIONS__.splice(idx, 1, action)
    } else {
        window.__TJ_PLUGIN_ACTIONS__.push(action)
    }
}

// Add plugin modal
export const addPluginModal = (modal: {
    id: string
    title: string
    description?: string
    message?: string
    component?: unknown
    onClose?: () => void
}) => {
    if (typeof window === 'undefined') return

    const idx = window.__TJ_PLUGIN_MODALS__.findIndex((m) => m.id === modal.id)
    if (idx >= 0) {
        window.__TJ_PLUGIN_MODALS__.splice(idx, 1, modal)
    } else {
        window.__TJ_PLUGIN_MODALS__.push(modal)
    }
}

// Add plugin page slot
export const addPluginPageSlot = (
    slotId: string,
    config: { id: string; label: string; icon?: string; onClick: () => void },
    pluginId: string,
    pluginPageSlots: { value: TJPluginPageSlot[] }
) => {
    if (typeof window === 'undefined') return

    const slot = {
        id: config.id,
        slotId,
        pluginId,
        label: config.label,
        icon: config.icon,
        onClick: config.onClick,
    }
    const idx = pluginPageSlots.value.findIndex((s) => s.id === config.id)
    if (idx >= 0) {
        pluginPageSlots.value.splice(idx, 1, slot)
    } else {
        pluginPageSlots.value.push(slot)
    }
    window.__TJ_PLUGIN_PAGE_SLOTS__ = pluginPageSlots.value
}

// Find plugin modal by id
export const findPluginModal = (modalId: string) => {
    if (typeof window === 'undefined') return undefined

    return window.__TJ_PLUGIN_MODALS__.find((m) => m.id === modalId)
}

// Find plugin actions starting with plugin id
export const findPluginActionsByPluginId = (pluginId: string) => {
    if (typeof window === 'undefined') return []

    return window.__TJ_PLUGIN_ACTIONS__.filter((a) => a.id.startsWith(pluginId))
}


