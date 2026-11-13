import { join } from 'node:path'
import { existsSync, createWriteStream } from 'node:fs'
import { mkdir, readdir, rm, stat, writeFile, copyFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import archiver from 'archiver'
import { formatDateForFilename } from '~/utils/date-utils'
import { getDataDb, validateSchemaExists } from '../utils/db'
import type { Prisma } from '~/generated/prisma-data'
import { getUploadPath } from "./index"
import { createAppError } from './errors'
import { EXPORT_BASE_DIR, VERSION_MANIFEST } from './backupShared'
import type { ExportManifest } from './backupShared'

interface ExportData {
    accounts: Awaited<ReturnType<typeof prisma.account.findMany>>
    tagGroups: Awaited<ReturnType<typeof prisma.tagGroup.findMany>>
    tags: Awaited<ReturnType<typeof prisma.tag.findMany>>
    trades: Awaited<ReturnType<typeof prisma.trade.findMany>>
    dayTags: Awaited<ReturnType<typeof prisma.dayTag.findMany>>
    configSymbols: Awaited<ReturnType<typeof prisma.configSymbol.findMany>>
    dailyNotes: Awaited<ReturnType<typeof prisma.dailyNote.findMany>>
    importProfiles: Awaited<ReturnType<typeof prisma.importProfile.findMany>>
    plugins: Awaited<ReturnType<typeof prisma.plugin.findMany>>
}

/**
 * Creates a backup of the database and uploads directory
 * @param userId - User ID
 * @param dbName - Database name to include in the backup filename
 * @returns Path to the created backup file
 */
export async function createBackup(userId: number, dbName: string, appVersion?: string): Promise<string> {
    try {
        // Get the correct Prisma client for this user's schema
        const prisma = await getDataDb(userId, dbName)

        await validateSchemaExists(userId, dbName)

        // Create user-specific export directory: /temp/exports/user_{userId}/db_{dbName}
        const userExportDir = join(EXPORT_BASE_DIR, `user_${userId}`, `db_${dbName}`)
        await mkdir(userExportDir, { recursive: true })

        const exportId = randomUUID()
        const formattedDate = formatDateForFilename()
        const resolvedAppVersion = appVersion ?? useRuntimeConfig().public.appTagVersion
        const exportName = `backup-${dbName}-${resolvedAppVersion}-${formattedDate}-${exportId.slice(0, 8)}.zip`
        const exportPath = join(userExportDir, exportName)
        const tempDir = join(userExportDir, 'temp', exportId)

        // Create temp directory for export contents
        await mkdir(tempDir, { recursive: true })

        // Create manifest
        const manifest: ExportManifest = {
            id: exportId,
            createdAt: new Date().toISOString(),
            dataFile: 'database.db',
            uploads: [],
            metadata: {
                version: VERSION_MANIFEST,
                totalFiles: 0,
                totalSize: 0,
                dataStats: {
                    accounts: 0,
                    tagGroups: 0,
                    tags: 0,
                    trades: 0,
                    dayTags: 0,
                    configSymbols: 0,
                    dailyNotes: 0,
                    plugins: 0
                }
            }
        }

        // Export all data from Prisma
        const exportData: ExportData = {
            accounts: await prisma.account.findMany({
                include: {
                    trades: true
                }
            }),
            tagGroups: await prisma.tagGroup.findMany({
                include: {
                    tags: true
                }
            }),
            tags: await prisma.tag.findMany({
                include: {
                    group: true,
                    tradeTags: true,
                    dayTags: true
                }
            }),
            trades: await prisma.trade.findMany({
                include: {
                    tags: true,
                    screenshots: true
                }
            }),
            dayTags: await prisma.dayTag.findMany({
                include: {
                    tags: true,
                    DayTagAssociation: true
                }
            }),
            configSymbols: await prisma.configSymbol.findMany(),
            dailyNotes: await prisma.dailyNote.findMany(),
            plugins: await prisma.plugin.findMany(),
            importProfiles: await prisma.importProfile.findMany({
                include: {
                    dayTags: { select: { tagId: true } },
                    tradeTags: { select: { tagId: true } },
                }
            })
        }

        // Save the data to a JSON file
        const dataExportPath = join(tempDir, 'data.json')
        await writeFile(dataExportPath, JSON.stringify(exportData, null, 2))

        // Update manifest with data stats
        manifest.metadata.dataStats = {
            accounts: exportData.accounts.length,
            tagGroups: exportData.tagGroups.length,
            tags: exportData.tags.length,
            trades: exportData.trades.length,
            dayTags: exportData.dayTags.length,
            configSymbols: exportData.configSymbols.length,
            dailyNotes: exportData.dailyNotes.length,
            plugins: exportData.plugins.length
        }

        // Update manifest with the data file
        manifest.dataFile = 'data.json'
        const stats = await stat(dataExportPath)
        manifest.metadata.totalSize = stats.size
        manifest.metadata.totalFiles = 1 // data.json

        const uploadDir = join(process.cwd(), getUploadPath(userId, dbName))

        // Copy uploads if they exist
        if (existsSync(uploadDir)) {
            const uploadsDest = join(tempDir, 'uploads')
            await mkdir(uploadsDest, { recursive: true })

            // Custom function to get files with full paths
            const getFiles = async (dir: string, parentPath = ''): Promise<Array<{ name: string, parentPath: string, isFile: () => boolean }>> => {
                const dirents = await readdir(dir, { withFileTypes: true });
                const files = [];
                for (const dirent of dirents) {
                    const res = join(dir, dirent.name);
                    if (dirent.isDirectory()) {
                        files.push(...(await getFiles(res, join(parentPath, dirent.name))));
                    } else {
                        files.push({
                            ...dirent,
                            parentPath,
                            isFile: () => true
                        });
                    }
                }
                return files;
            };

            const files = await getFiles(uploadDir);

            for (const file of files) {
                if (file.isFile()) {
                    // Get the parent directory path
                    const parentPath = file.parentPath || ''
                    const source = join(uploadDir, parentPath, file.name)
                    const relativePath = parentPath.replace(uploadDir, '')
                    const destDir = join(uploadsDest, relativePath)

                    await mkdir(destDir, { recursive: true })
                    const dest = join(destDir, file.name)
                    await copyFile(source, dest)

                    const stats = await stat(source)
                    manifest.uploads.push(join(relativePath, file.name).replace(/^[\\/]/, ''))
                    manifest.metadata.totalFiles++
                    manifest.metadata.totalSize += stats.size
                }
            }
        }

        // Write manifest
        await writeFile(
            join(tempDir, 'manifest.json'),
            JSON.stringify(manifest, null, 2)
        )

        // Create zip archive
        await new Promise<void>((resolve, reject) => {
            const output = createWriteStream(exportPath)
            const archive = archiver('zip', {
                zlib: { level: 9 } // Maximum compression
            })

            const cleanup = () => {
                output.off('close', resolve as () => void)
                output.off('error', onError)
                archive.off('error', onError)
            }

            const onError = (error: unknown) => {
                cleanup()
                reject(error instanceof Error ? error : new Error(String(error)))
            }

            output.once('close', () => {
                cleanup()
                resolve()
            })

            output.once('error', (err: Error) => onError(err))
            archive.once('error', (err: Error) => onError(err))

            archive.pipe(output)
            archive.directory(tempDir, false)
            archive.finalize()
        })

        // Cleanup temp directory
        await rm(tempDir, { recursive: true, force: true })

        return exportPath
    } catch (err: unknown) {
        throw createAppError({
            statusCode: 500,
            message: 'Backup creation failed',
            error: err instanceof Error ? err.message : 'Unknown error during backup creation'
        })
    }
}