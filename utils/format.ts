/**
  * Truncates a string to a specified length.
  * @param str - The string to truncate.
  * @param len - The maximum length of the truncated string. Default is 60.
  * @returns The truncated string.
  */
export const truncate = (str: string, len: number = 60) => {
    return str.substring(0, len)
}

/**
 * Rounds a number to a specified precision.
 * @param number - The number to round.
 * @param precision - The number of decimal places to round to. Default is 2.
 * @returns The rounded number.
 */
export const round = (number: number, precision: number = 0): number => {
    return Math.round(number * Math.pow(10, precision)) / Math.pow(10, precision)
}

/**
 * Delays the execution of a function by a specified number of milliseconds.
 * @param milliseconds - The number of milliseconds to delay the execution by.
 * @returns A promise that resolves after the specified number of milliseconds.
 */
export const delay = (milliseconds: number) => {
    return new Promise((resolve) => {
        setTimeout(resolve, milliseconds)
    })
}

export const formatToReadableSize = (size: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    if (size < 1) return '0 ' + sizes[0];
    const i = Math.floor(Math.log(size) / Math.log(1024));
    return Math.round(size / Math.pow(1024, i)) + ' ' + sizes[i];
}

/**
 * Format a number as a dollar amount
 * @param value - The number to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted dollar string (e.g. "$1,234.56")
 */
export function formatCurrency(value: number | string, decimals: number = 2, currency: string = 'USD'): string {
    if (typeof value === 'string') {
        value = Number(value.replace(',', '.'))
    }
    if (currency == "USD") {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
        }).format(value);
    } else {
        return new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
        }).format(value);
    }
}

export const getDatePlaceholderFormat = () => {
    // Utilise la locale du navigateur pour afficher un exemple de date
    const locale = typeof navigator !== 'undefined' ? navigator.language || 'fr-FR' : 'fr-FR'
    const example = new Date(2025, 4, 27) // 27 mai 2025
    return "ex: " + example.toLocaleDateString(locale)
}
