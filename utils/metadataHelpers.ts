/**
 * Gère les metadata de manière sécurisée
 */
export const metadataHelpers = {
    /**
     * Fusionne les metadata existantes avec de nouvelles données
     * @param existing Les metadata existantes (peut être null ou undefined)
     * @param updates Les nouvelles données à fusionner
     * @returns Les metadata fusionnées, ou null si vides
     */
    merge: (existing: Record<string, unknown> | null | undefined, updates: Record<string, unknown>): Record<string, unknown> | null => {
        // Reconstruire le JSON en ne prenant que les clés non-undefined
        const merged: Record<string, unknown> = {}

        // Ajouter les clés existantes (sauf undefined/null)
        if (existing && typeof existing === 'object') {
            try {
                const entries = Array.isArray(existing) ? [] : Object.entries(existing)
                entries.forEach(([key, value]: [string, unknown]) => {
                    if (value !== undefined && value !== null) {
                        merged[key] = value
                    }
                })
            } catch {
                // Ignorer les erreurs de conversion
            }
        }

        // Appliquer les updates : ajouter si valide, supprimer si undefined/null
        if (updates && typeof updates === 'object') {
            Object.entries(updates).forEach(([key, value]) => {
                if (value === undefined || value === null) {
                    // Supprimer la clé si elle existe
                    const { [key]: _omit, ...rest } = merged
                    Object.assign(merged, rest)
                } else {
                    // Ajouter/mettre à jour la clé
                    merged[key] = value
                }
            })
        }

        return Object.keys(merged).length > 0 ? merged : null
    },

    /**
     * Extrait une valeur spécifique des metadata
     * @param metadata Les metadata
     * @param key La clé à extraire
     * @param defaultValue La valeur par défaut si la clé n'existe pas
     * @returns La valeur extraite ou la valeur par défaut
     */
    get: <T = unknown>(metadata: Record<string, unknown> | null | undefined, key: string, defaultValue?: T): T | undefined => {
        if (!metadata) return defaultValue
        return (metadata[key] ?? defaultValue) as T
    },

    /**
     * Définit une valeur dans les metadata
     * @param metadata Les metadata existantes
     * @param key La clé à définir
     * @param value La valeur à définir
     * @returns Les metadata mises à jour (objet avec la clé définie, ou null si vide)
     */
    set: (metadata: Record<string, unknown> | null | undefined, key: string, value: unknown): Record<string, unknown> | null => {
        // Reconstruire l'objet en ne prenant que les clés valides
        const result: Record<string, unknown> = {}

        // Copier les clés existantes (sauf undefined/null)
        if (metadata && typeof metadata === 'object') {
            Object.entries(metadata).forEach(([k, v]) => {
                if (v !== undefined && v !== null) {
                    result[k] = v
                }
            })
        }

        // Ajouter/mettre à jour la nouvelle clé (sauf si undefined/null)
        if (value !== undefined && value !== null) {
            result[key] = value
        }

        // Retourner l'objet ou null si vide
        return Object.keys(result).length > 0 ? result : null
    },

    /**
     * Supprime une clé des metadata
     * @param metadata Les metadata existantes
     * @param key La clé à supprimer
     * @returns Les metadata mises à jour
     */
    remove: (metadata: Record<string, unknown> | null | undefined, key: string): Record<string, unknown> | null => {
        if (!metadata) return null
        const { [key]: _omit, ...rest } = metadata
        return Object.keys(rest).length > 0 ? rest : null
    },

    /**
     * Vérifie si une clé existe dans les metadata
     * @param metadata Les metadata
     * @param key La clé à vérifier
     * @returns true si la clé existe, false sinon
     */
    has: (metadata: Record<string, unknown> | null | undefined, key: string): boolean => {
        return metadata ? key in metadata : false
    }
}
