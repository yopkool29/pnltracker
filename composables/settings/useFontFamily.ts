// Applique la police selectionnee sur le body
const fontCssValues: Record<string, string> = {
    system: 'ui-sans-serif, system-ui, sans-serif',
    inter: "'Inter', ui-sans-serif, system-ui, sans-serif",
    jetbrains: "'JetBrains Mono', ui-monospace, monospace",
    geist: "'Geist', ui-sans-serif, system-ui, sans-serif",
    jakarta: "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif",
    archivo: "'Archivo', ui-sans-serif, system-ui, sans-serif",
    'source-sans': "'Source Sans 3', ui-sans-serif, system-ui, sans-serif",
}

export const useFontFamily = () => {
    const userStore = useUserStore()

    const applyFont = (font: string) => {
        if (import.meta.server) return
        const body = document.body
        body.style.fontFamily = fontCssValues[font] || fontCssValues.system
        if (font === 'jetbrains') {
            body.style.letterSpacing = '-0.01em'
        } else {
            body.style.letterSpacing = ''
        }
    }

    watch(
        () => userStore.user?.settings_object?.fontFamily,
        (font) => {
            if (font) applyFont(font)
        },
        { immediate: true },
    )

    return { applyFont }
}
