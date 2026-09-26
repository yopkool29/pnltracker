import type { ErrorMessage } from "~/type"
import { extractErrorData } from "~/server/utils/errors"

/**
 * Extracts the error data from the received error object.
 * If the error has a 'data' property which contains an object,
 * then the object is returned, otherwise an empty object is returned.
 * @param error the error object
 * @returns The error data object
 */

export const getDetailedError = (error: ErrorMessage) => {
    let message = error.message ?? null
    // Récupérer le message d'erreur spécifique du serveur
    if (error && typeof error === 'object' && 'data' in error) {
        const errorData = error.data as { message?: string }
        message = errorData?.message ?? message
    }
    return message
}

/**
 * Returns an object with keys 'tag' and 'message' based on the received error
 * If the error has a 'data' property which contains a 'tag' property,
 * then the 'tag' key is defined with this value,
 * otherwise the 'tag' key is undefined.
 * If the error has a 'message' property, then the 'message' key is defined with this value,
 * otherwise the 'message' key is defined with the server specific error message
 * (using the `getDetailedError` function).
 * If the `t` function is defined, then if the 'tag' key is defined,
 * the 'message' key is defined with the result of calling `t(tag)`,
 * otherwise the 'message' key is defined with the result of calling `t` with the value of the 'message' key of the error.
 */

export const catchTagMessage = (err: unknown, t?: (key: string) => string) => {
    let tag: string | undefined = undefined
    const message = getDetailedError(err as ErrorMessage)
    const data = extractErrorData(err)
    if (data && data.tag) {
        tag = data.tag as string
    }
    if (t) {
        if (tag) {
            if (tag != t(tag))
                return { tag: tag, message: t(tag) as string }
            else
                return { tag: tag, message: message }
        }
        return { tag: undefined, message }
    }
    return { tag, message }
}
