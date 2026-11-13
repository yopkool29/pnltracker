export const useUiStateSync = () => {
    const dbStateStore = useDbStateStore()
    const userStore = useUserStore()
    const { currentDatabase } = useDatabase()
    const { log_error, log_info } = useLogView()

    const UI_STATE_VERSION = 100
    const LOCAL_SAVED_AT_KEY = 'uiStateLocalSavedAt'

    const readLocalSavedAtMap = (): Record<string, string> => {
        try {
            const parsed: unknown = JSON.parse(localStorage.getItem(LOCAL_SAVED_AT_KEY) || '')
            return parsed && typeof parsed === 'object' ? parsed as Record<string, string> : {}
        } catch {
            // Legacy format (plain ISO string) or unavailable localStorage
            return {}
        }
    }

    const setLocalSavedAt = (dbName: string, iso: string) => {
        try {
            const map = readLocalSavedAtMap()
            map[dbName] = iso
            localStorage.setItem(LOCAL_SAVED_AT_KEY, JSON.stringify(map))
        } catch {
            // localStorage might be unavailable (SSR, private mode)
        }
    }

    const updateLocalSavedAt = (dbName: string) => {
        setLocalSavedAt(dbName, new Date().toISOString())
    }

    const getLocalSavedAt = (dbName: string): Date | null => {
        try {
            const raw = localStorage.getItem(LOCAL_SAVED_AT_KEY)
            if (!raw) return null
            try {
                const parsed: unknown = JSON.parse(raw)
                const ts = (parsed as Record<string, string>)[dbName]
                return ts ? new Date(ts) : null
            } catch {
                // Ancien format : ISO string globale — chaque save poussait
                // toutes les DBs, la date reste valide comme borne par-db
                const d = new Date(raw)
                return isNaN(d.getTime()) ? null : d
            }
        } catch {
            return null
        }
    }

    const UI_STATE_KEYS = [
        'customInputsPerDb',
        'recentColorsPerDb',
        'recentColors2PerDb',
        'tradeOptionsPerDb',
        'dashBoardFiltersPerDb',
        'dailyFiltersPerDb',
        'calendarFiltersPerDb',
        'columnVisibilityPerDb',
        'showDetailedNotePerDb',
        'tradeChartTfPerDb',
        'tradeChartShowAdjacentPerDb',
        'tradeChartShowAdjacentLinesPerDb',
        'tradeChartRthPerDb',
        'tradeChartForceDarkPerDb',
        'chartSettingsPerDb',
    ] as const

    // Slice d'une seule DB : chaque clé *PerDb devient { [dbName]: value }
    const collectUiState = (dbName: string): Record<string, unknown> => {
        const state: Record<string, unknown> = {}
        for (const key of UI_STATE_KEYS) {
            const value = (dbStateStore as unknown as Record<string, unknown>)[key]
            if (value && typeof value === 'object' && (value as Record<string, unknown>)[dbName]) {
                state[key] = { [dbName]: JSON.parse(JSON.stringify((value as Record<string, unknown>)[dbName])) }
            }
        }
        return state
    }

    const compressGzip = async (data: string): Promise<string> => {
        const stream = new Blob([data]).stream()
        const compressed = stream.pipeThrough(new CompressionStream('gzip'))
        const buffer = await new Response(compressed).arrayBuffer()
        const bytes = new Uint8Array(buffer)
        let binary = ''
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i])
        }
        return btoa(binary)
    }

    const saveUiStateForDb = async (db: { id: number; name: string }): Promise<boolean> => {
        if (!userStore.user) return false
        try {
            const uiState = collectUiState(db.name)
            const compressed = await compressGzip(JSON.stringify(uiState))
            const response = await fetch(`/api/database/${db.id}/ui-state`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ compressed, version: UI_STATE_VERSION }),
            })
            if (!response.ok) throw new Error(`HTTP ${response.status}`)
            updateLocalSavedAt(db.name)
            return true
        } catch (err) {
            log_error('Failed to save UI state: ' + String(err))
            return false
        }
    }

    const saveUiState = async (): Promise<boolean> => {
        if (!currentDatabase.value) return false
        const ok = await saveUiStateForDb(currentDatabase.value)
        if (ok) log_info('UI state saved to server')
        return ok
    }

    // Persiste le slice de chaque DB — après un sync dashboard qui écrit
    // dans les *PerDb des autres bases (le save courant ne pousserait
    // que la DB active, le reste resterait coincé en localStorage).
    const saveAllUiStates = async (): Promise<void> => {
        const { databases } = useDatabase()
        const results = await Promise.all(databases.value.map(db => saveUiStateForDb(db)))
        if (results.every(Boolean)) {
            log_info('UI state saved to server for all databases')
        }
    }

    // fetch keepalive (~64KB max) pour beforeunload : JSON brut synchrone si ça
    // rentre — le fetch est initié avant que la page ne se décharge — sinon
    // gzip async en best-effort (le fetch part après résolution de la promesse)
    const saveUiStateBeacon = (): boolean => {
        if (!userStore.user || !currentDatabase.value) return false
        const dbId = currentDatabase.value.id
        const dbName = currentDatabase.value.name
        try {
            const blob = new Blob([JSON.stringify(collectUiState(dbName))], { type: 'application/json' })
            const post = (body: BodyInit) => fetch(`/api/database/${dbId}/ui-state`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body,
                keepalive: true,
            }).then(() => {
                updateLocalSavedAt(dbName)
            }).catch(() => {})

            if (blob.size < 60 * 1024) {
                post(blob)
            } else {
                const stream = blob.stream().pipeThrough(new CompressionStream('gzip'))
                new Response(stream).arrayBuffer().then(buffer => {
                    const bytes = new Uint8Array(buffer)
                    let binary = ''
                    for (let i = 0; i < bytes.length; i++) {
                        binary += String.fromCharCode(bytes[i])
                    }
                    post(JSON.stringify({ compressed: btoa(binary), version: UI_STATE_VERSION }))
                }).catch(() => {})
            }
            return true
        } catch {
            return false
        }
    }

    const restoreUiState = (metadata: unknown, dbName: string): boolean => {
        try {
            if (!metadata || typeof metadata !== 'object') return false
            const meta = metadata as Record<string, unknown>
            const pnltracker = meta.pnltracker as Record<string, unknown> | undefined
            if (!pnltracker || typeof pnltracker !== 'object') return false
            const uiState = pnltracker.uiState as Record<string, unknown> | undefined
            if (!uiState || typeof uiState !== 'object') return false

            const savedVersion = pnltracker.uiStateVersion
            if (savedVersion !== undefined && savedVersion !== UI_STATE_VERSION) {
                log_info(`UI state version mismatch (saved: ${savedVersion}, current: ${UI_STATE_VERSION}), skipping restore`)
                return false
            }

            const serverSavedAt = pnltracker.uiStateSavedAt
                ? new Date(pnltracker.uiStateSavedAt as string)
                : null
            const localSavedAt = getLocalSavedAt(dbName)
            if (serverSavedAt && localSavedAt && localSavedAt >= serverSavedAt) {
                log_info(`Local UI state is up to date (local: ${localSavedAt.toISOString()}, server: ${serverSavedAt.toISOString()}), skipping restore`)
                return false
            }

            const deepMerge = (target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> => {
                const result = { ...target }
                for (const key of Object.keys(source)) {
                    const srcVal = source[key]
                    const tgtVal = result[key]
                    if (Array.isArray(srcVal)) {
                        result[key] = srcVal
                    } else if (srcVal && typeof srcVal === 'object' && tgtVal && typeof tgtVal === 'object' && !Array.isArray(tgtVal)) {
                        result[key] = deepMerge(tgtVal as Record<string, unknown>, srcVal as Record<string, unknown>)
                    } else {
                        result[key] = srcVal
                    }
                }
                return result
            }

            for (const key of UI_STATE_KEYS) {
                const savedValue = uiState[key]
                if (savedValue && typeof savedValue === 'object') {
                    const storeRef = (dbStateStore as unknown as Record<string, unknown>)[key]
                    if (storeRef && typeof storeRef === 'object') {
                        const cloned = JSON.parse(JSON.stringify(savedValue)) as Record<string, unknown>
                        const current = storeRef as Record<string, unknown>
                        const merged = deepMerge(current, cloned)
                        Object.keys(merged).forEach(k => { current[k] = merged[k] })
                    }
                }
            }
            // Le local reflète désormais le serveur à serverSavedAt
            if (serverSavedAt) setLocalSavedAt(dbName, serverSavedAt.toISOString())
            log_info('UI state restored from server')
            return true
        } catch (err) {
            log_error('Failed to restore UI state, ignoring: ' + String(err))
            return false
        }
    }

    return {
        saveUiState,
        saveUiStateForDb,
        saveAllUiStates,
        saveUiStateBeacon,
        restoreUiState,
    }
}
