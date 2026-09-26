/**
 * Replaces special HTML characters in a string with their corresponding HTML entities.
 * @param str - The string to replace the HTML characters in.
 * @returns The string with replaced HTML characters.
 */
export const safeTagsReplace = (str: string): string => {
    return str.replace(/[&<>]/g, replaceTag)
}

/**
 * Replaces special HTML characters with their corresponding HTML entities.
 * @param tag - The HTML character to replace.
 * @returns The replaced HTML character.
 */
const replaceTag = (tag: string): string => {
    const tagsToReplace: { [key: string]: string } = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
    }

    return tagsToReplace[tag] || tag
}
