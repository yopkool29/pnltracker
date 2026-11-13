/**
 * Delete a database with password verification
 */
import bcrypt from 'bcryptjs'
import { getAuthDb, wipeUserDatabase } from '../../utils/db'
import { createAppError } from '../../utils/errors'
import auth from '../../utils/auth'

export default defineEventHandler(async (event) => {
    await auth(event)
    
    try {
        const userId = event.context.userId
        
        if (!userId) {
            throw createAppError({
                statusCode: 401,
                message: 'Unauthorized',
                tag: 'api.database.common.unauthorized'
            })
        }

        const { databaseId, password } = await readBody(event)

        if (!databaseId || !password) {
            throw createAppError({
                statusCode: 400,
                message: 'Database ID and password are required',
                tag: 'api.database.delete.missing_params'
            })
        }

        // Get auth database
        const authDb = getAuthDb()

        // Verify database belongs to user
        const database = await authDb.database.findFirst({
            where: {
                id: databaseId,
                userId: parseInt(userId)
            }
        })

        if (!database) {
            throw createAppError({
                statusCode: 404,
                message: 'Database not found',
                tag: 'api.database.common.not_found'
            })
        }

        // Verify user password
        const user = await authDb.user.findUnique({
            where: {
                id: parseInt(userId)
            }
        })

        if (!user || !(await bcrypt.compare(password, user.password))) {
            throw createAppError({
                statusCode: 401,
                message: 'Invalid password',
                tag: 'api.database.delete.invalid_password'
            })
        }

        // Wipe schema, role, record and directories (shared helper, process #236)
        try {
            await wipeUserDatabase(parseInt(userId), database.name)
        } catch (error) {
            console.error('Failed to wipe database:', error)
            throw createAppError({
                statusCode: 500,
                message: 'Failed to delete database schema',
                tag: 'api.database.delete.schema_error',
                error
            })
        }

        return {
            success: true,
            message: 'Database deleted successfully'
        }
    } catch (error) {
        const err = error as { statusCode?: number; data?: { tag?: string } }
        if (err.statusCode && err.data?.tag) {
            throw error
        }

        throw createAppError({
            statusCode: 500,
            message: 'Failed to delete database',
            tag: 'api.database.common.server_error',
            error
        })
    }
})
