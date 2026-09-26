import { dirname, join } from 'node:path'
import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, rm, stat, copyFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import extract from 'extract-zip'
import { getDataDb } from '../utils/db'
import type { Prisma } from '~/generated/prisma-data'
import { getUploadPath } from "./index"
import { createAppError } from './errors'
import { migrateImageUrlsInContent, migrateScreenshotUrl, migrateScreenshotsDir } from './export-utils'
import type { InstrumentType } from '~/type'
import { EXPORT_BASE_DIR, VERSION_MANIFEST, versionToInt } from './backupShared'
import type { ExportManifest } from './backupShared'

interface ImportData {
    accounts: Awaited<ReturnType<typeof prisma.account.findMany>>
    tagGroups: Awaited<ReturnType<typeof prisma.tagGroup.findMany>>
    tags: Awaited<ReturnType<typeof prisma.tag.findMany>>
    trades: Awaited<ReturnType<typeof prisma.trade.findMany<{
        include: {
            tags: {
                include: {
                    tag: true
                }
            }
            screenshots: true
        }
    }>>>
    dayTags: Awaited<ReturnType<typeof prisma.dayTag.findMany<{
        include: {
            DayTagAssociation: {
                include: {
                    tag: true
                }
            }
        }
    }>>>
    configSymbols: Awaited<ReturnType<typeof prisma.configSymbol.findMany>>
    dailyNotes: Awaited<ReturnType<typeof prisma.dailyNote.findMany>>
    plugins?: Awaited<ReturnType<typeof prisma.plugin.findMany>>
    importProfiles?: Array<{
        id: number
        name: string
        provider: string
        importMode: string
        timezone: string
        keepExistingTrades: boolean
        instrumentType: InstrumentType
        ibkrFlexQueryToken: string | null
        ibkrFlexQueryId: string | null
        metadata: Prisma.JsonValue | null
        createdAt: Date | string
        updatedAt: Date | string
        dayTags: Array<{ tagId: number }>
        tradeTags: Array<{ tagId: number }>
    }>
}

/**
 * Restores from a backup file
 * @param backupPath Path to the backup zip file
 * @param userId User ID for the database
 * @param dbName Database name
 */
export async function restoreBackup(backupPath: string, userId: number, dbName: string = 'default'): Promise<void> {
    const tempDir = join(EXPORT_BASE_DIR, 'restore', randomUUID())
    try {
        if (!existsSync(backupPath)) {
            throw new Error('Backup file not found')
        }

        await mkdir(tempDir, { recursive: true })

        // Extract backup
        await extract(backupPath, { dir: tempDir })


        // Read manifest
        const manifestPath = join(tempDir, 'manifest.json')
        if (!existsSync(manifestPath)) {
            throw new Error('Invalid backup: manifest.json not found')
        }

        const manifest: ExportManifest = JSON.parse(
            await readFile(manifestPath, 'utf-8')
        )

        const backupVersion = manifest.metadata?.version || '1.0.0'
        const backupVersionInt = versionToInt(backupVersion)

        console.log(`Restoring backup version ${backupVersion}`)

        const sanitizeName_1_0_0 = (name: string) =>
            backupVersionInt === 100 && !/^[\p{L}\p{N}_]+$/u.test(name)
                ? name.replace(/[^\p{L}\p{N}_]/gu, '_')
                : name

        // Restore data from JSON file
        const dataSource = join(tempDir, manifest.dataFile)
        if (!existsSync(dataSource)) {
            throw new Error('Data file not found in backup')
        }

        const data: ImportData = JSON.parse(await readFile(dataSource, 'utf-8'))

        // Migration des URLs de screenshots : uniquement pour les backups antérieurs à la version courante
        if (backupVersionInt < versionToInt(VERSION_MANIFEST)) {
            console.log('Migrating screenshot URLs to screenshots/filename format...')

            data.trades = data.trades.map(trade => {
                const migratedScreenshots = trade.screenshots.map(s => ({
                    ...s,
                    url: migrateScreenshotUrl(s.url)
                }))
                if (trade.metadata && typeof trade.metadata === 'object' && 'detailedNote' in trade.metadata) {
                    const detailedNote = trade.metadata.detailedNote
                    if (typeof detailedNote === 'string') {
                        return {
                            ...trade,
                            screenshots: migratedScreenshots,
                            metadata: {
                                ...trade.metadata,
                                detailedNote: migrateImageUrlsInContent(detailedNote)
                            }
                        }
                    }
                }
                return { ...trade, screenshots: migratedScreenshots }
            })

            data.dailyNotes = data.dailyNotes.map(note => ({
                ...note,
                content: migrateImageUrlsInContent(note.content) || note.content
            }))
        }

        // Get the correct database for this user
        const { getDataDb } = await import('./db')
        const dataDb = await getDataDb(userId, dbName)

        // Clear existing data (be careful with this in production!)
        await dataDb.$transaction([
            dataDb.tradeTagAssociation.deleteMany({}),
            dataDb.dayTagAssociation.deleteMany({}),
            dataDb.importProfileDayTag.deleteMany({}),
            dataDb.importProfileTradeTag.deleteMany({}),
            dataDb.screenshot.deleteMany({}),
            dataDb.trade.deleteMany({}),
            dataDb.dayTag.deleteMany({}),
            dataDb.tag.deleteMany({}),
            dataDb.tagGroup.deleteMany({}),
            dataDb.account.deleteMany({}),
            dataDb.configSymbol.deleteMany({}),
            dataDb.dailyNote.deleteMany({}),
            dataDb.importProfile.deleteMany({}),
            dataDb.plugin.deleteMany({})
        ])

        // console.log(backupVersionInt)

        // Restore data in the correct order to respect foreign key constraints
        await dataDb.$transaction([
            // 1. TagGroups (no dependencies)
            ...data.tagGroups.map(group =>
                dataDb.tagGroup.create({
                    data: {
                        id: group.id,
                        name: sanitizeName_1_0_0(group.name),
                        metadata: (group as { metadata?: Prisma.JsonValue }).metadata || null as Prisma.InputJsonValue | null,
                        createdAt: new Date(group.createdAt),
                        updatedAt: new Date(group.updatedAt)
                    }
                })
            ),

            // 2. Tags (depends on TagGroups)
            ...data.tags.map(tag =>
                dataDb.tag.create({
                    data: {
                        id: tag.id,
                        name: sanitizeName_1_0_0(tag.name),
                        description: tag.description,
                        color: tag.color,
                        dark_fg_reverse: tag.dark_fg_reverse ?? false,
                        groupId: tag.groupId,
                        metadata: (tag as { metadata?: Prisma.JsonValue }).metadata || null as Prisma.InputJsonValue | null,
                        createdAt: new Date(tag.createdAt),
                        updatedAt: new Date(tag.updatedAt)
                    }
                })
            ),

            // 3. Accounts (no dependencies)
            ...data.accounts.map(account =>
                dataDb.account.create({
                    data: {
                        id: account.id,
                        name: sanitizeName_1_0_0(account.name),
                        displayName: account.displayName || 'abcdef',
                        fullname: account.fullname,
                        aliases: account.aliases || '',
                        metadata: (account as { metadata?: Prisma.JsonValue }).metadata || null as Prisma.InputJsonValue | null,
                        createdAt: new Date(account.createdAt),
                    }
                })
            ),


            // 4. Trades (depends on Accounts)
            ...data.trades.map(trade => {
                const tradeData = {
                    ...trade,
                    netProfit: backupVersionInt < 115 ? trade.profit - (trade.commission ?? 0) : trade.netProfit,
                    instrumentType: trade.instrumentType || 'any',
                    exchange: trade.exchange ?? 0,
                    openDate: new Date(trade.openDate),
                    closeDate: new Date(trade.closeDate),
                    createdAt: new Date(trade.createdAt),
                    updatedAt: new Date(trade.updatedAt),
                    tags: {
                        create: trade.tags.map(tag => ({
                            tag: { connect: { id: tag.tagId } }
                        }))
                    },
                    screenshots: {
                        create: trade.screenshots.map(screenshot => ({
                            url: screenshot.url,
                            metadata: (screenshot as { metadata?: Prisma.JsonValue }).metadata || null as Prisma.InputJsonValue | null,
                            createdAt: new Date(screenshot.createdAt)
                        }))
                    }
                }

                return dataDb.trade.create({ data: tradeData })
            }),

            // 5. ConfigSymbols (no dependencies)
            ...data.configSymbols.map(symbol =>
                dataDb.configSymbol.create({
                    data: {
                        id: symbol.id,
                        symbol: symbol.symbol,
                        digit: symbol.digit,
                        active: symbol.active,
                        notes: symbol.notes,
                        aliases: symbol.aliases || '',
                        pricePerPoint: symbol.pricePerPoint ?? -1,
                        metadata: (symbol as { metadata?: Prisma.JsonValue }).metadata || null as Prisma.InputJsonValue | null,
                        createdAt: new Date(symbol.createdAt),
                        updatedAt: new Date(symbol.updatedAt)
                    }
                })
            ),

            // 6. DayTags and their associations
            ...data.dayTags.map(dayTag =>
                dataDb.dayTag.create({
                    data: {
                        id: dayTag.id,
                        note: dayTag.note,
                        metadata: (dayTag as { metadata?: Prisma.JsonValue }).metadata || null as Prisma.InputJsonValue | null,
                        date: new Date(dayTag.date),
                        createdAt: new Date(dayTag.createdAt),
                        updatedAt: new Date(dayTag.updatedAt),
                        // Handle many-to-many relations
                        DayTagAssociation: {
                            create: dayTag.DayTagAssociation.map(assoc => ({
                                tag: { connect: { id: assoc.tagId } }
                            }))
                        }
                    }
                })
            ),

            ...data.dailyNotes.map(note =>
                dataDb.dailyNote.create({
                    data: {
                        id: note.id,
                        content: note.content,
                        metadata: (note as { metadata?: Prisma.JsonValue }).metadata || null as Prisma.InputJsonValue | null,
                        date: new Date(note.date),
                        createdAt: new Date(note.createdAt),
                        updatedAt: new Date(note.updatedAt)
                    }
                })
            ),

            // 8. ImportProfiles with tag relations (depends on Tags) — skip for 1.0.0 backups
            ...(backupVersion === '1.0.0' ? [] : (data.importProfiles || [])).map(profile =>
                dataDb.importProfile.create({
                    data: {
                        id: profile.id,
                        name: profile.name,
                        provider: profile.provider,
                        importMode: profile.importMode,
                        timezone: profile.timezone,
                        keepExistingTrades: profile.keepExistingTrades,
                        instrumentType: profile.instrumentType || "any",
                        ibkrFlexQueryToken: profile.ibkrFlexQueryToken,
                        ibkrFlexQueryId: profile.ibkrFlexQueryId,
                        metadata: profile.metadata || null as Prisma.InputJsonValue | null,
                        createdAt: new Date(profile.createdAt),
                        updatedAt: new Date(profile.updatedAt),
                        dayTags: {
                            create: (profile.dayTags || []).map((t: { tagId: number }) => ({ tagId: t.tagId }))
                        },
                        tradeTags: {
                            create: (profile.tradeTags || []).map((t: { tagId: number }) => ({ tagId: t.tagId }))
                        },
                    }
                })
            )

        ])

        // Restore plugins (version >= 1.1.7)
        if (backupVersionInt >= 117 && data.plugins?.length) {
            for (const plugin of data.plugins) {
                await dataDb.plugin.upsert({
                    where: { id: plugin.id },
                    create: {
                        id: plugin.id,
                        name: plugin.name,
                        version: plugin.version,
                        description: plugin.description,
                        enabled: plugin.enabled,
                        createdAt: new Date(plugin.createdAt),
                        updatedAt: new Date(plugin.updatedAt),
                    },
                    update: {
                        name: plugin.name,
                        version: plugin.version,
                        description: plugin.description,
                        enabled: plugin.enabled,
                    },
                })
            }
        }

        // Reset all auto-increment sequences to avoid unique constraint errors
        // after inserting records with explicit IDs
        const tables = ['TagGroup', 'Tag', 'Account', 'Trade', 'Screenshot', 'DayTag', 'DailyNote', 'ConfigSymbol', 'ImportProfile']
        for (const table of tables) {
            try {
                await dataDb.$executeRawUnsafe(
                    `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 0) + 1, false)`
                )
            } catch {
                // Some tables might not have a serial sequence, ignore
            }
        }

        const uploadDir = join(process.cwd(), getUploadPath(userId, dbName))

        // Restore uploads
        const uploadsSource = join(tempDir, 'uploads')
        if (existsSync(uploadsSource)) {
            // Clear existing uploads
            if (existsSync(uploadDir)) {
                await rm(uploadDir, { recursive: true, force: true })
            }

            // Copy new uploads
            await mkdir(uploadDir, { recursive: true })

            // Process the uploads directory recursively
            const processDirectory = async (dir: string, baseDir: string) => {
                const entries = await readdir(dir, { withFileTypes: true })

                for (const entry of entries) {
                    const fullPath = join(dir, entry.name)
                    const relativePath = dir.replace(uploadsSource, '')
                    const destPath = join(uploadDir, relativePath, entry.name)

                    if (entry.isDirectory()) {
                        await mkdir(destPath, { recursive: true })
                        await processDirectory(fullPath, baseDir)
                    } else if (entry.isFile()) {
                        await mkdir(dirname(destPath), { recursive: true })
                        await copyFile(fullPath, destPath)
                    }
                }
            }

            await processDirectory(uploadsSource, uploadsSource)
        }

        // Migration fichiers physiques : uniquement pour les backups antérieurs à la version courante
        if (backupVersionInt < versionToInt(VERSION_MANIFEST)) {
            await migrateScreenshotsDir(uploadDir)
        }

    } catch (err) {
        console.error('restoreBackup error:', err)
        throw createAppError({
            statusCode: 500,
            message: 'Restore failed',
            error: err instanceof Error ? err.message : 'Unknown error during restore'
        })
    } finally {
        // Cleanup
        if (existsSync(tempDir)) {
            console.log('Removing temp directory', tempDir)
            await rm(tempDir, { recursive: true, force: true })
        }
    }
}
