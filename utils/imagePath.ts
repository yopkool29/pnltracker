export const getImagePath = (src: string, userId?: number, dbName?: string): string => {
    // If src is already a complete URL (from NoteEditor), return as-is
    if (src.startsWith('/api/image?path=') || src.startsWith('http')) {
        return src
    }
    if (userId && dbName) {
        return `/api/image?path=${src}`
    }
    return src
}
