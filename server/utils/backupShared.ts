// Constantes et types partagés entre l'export et l'import de backups
import { join } from 'node:path'

export const EXPORT_BASE_DIR = join(process.cwd(), 'temp/exports')
export const VERSION_MANIFEST = '1.1.9'
export const versionToInt = (version: string): number => {
    const parts = version.split('.').map(p => parseInt(p, 10))
    return (parts[0] || 0) * 100 + (parts[1] || 0) * 10 + (parts[2] || 0)
}

export interface ExportManifest {
    id: string
    createdAt: string
    dataFile: string
    uploads: string[]
    metadata: {
        version: string
        totalFiles: number
        totalSize: number
        dataStats: {
            accounts: number
            tagGroups: number
            tags: number
            trades: number
            dayTags: number
            configSymbols: number
            dailyNotes: number
            plugins: number
        }
    }
}
