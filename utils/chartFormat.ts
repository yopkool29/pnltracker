import type { BreakdownDimension, TradeTooltipField } from '~/type'
import type { TradeExtendedType } from '~/schema/trade'
import { formatDurationMinutes } from '~/utils/dates/duration'
import { formatCurrency } from '~/utils'

// --- Formatage ---

export const formatNumberValue = (
    value: number | null | undefined,
    decimals: number = 2
): string => {
    if (value === undefined || value === null || !isFinite(value)) return '---'
    return value.toFixed(decimals)
}

export const formatDimensionLabel = (
    dimension: BreakdownDimension,
    key: string,
    translate: (key: string) => string
): string => {
    if (dimension === 'dayOfWeekOpen' || dimension === 'dayOfWeekClose') {
        const dayKeys = [
            'sunday',
            'monday',
            'tuesday',
            'wednesday',
            'thursday',
            'friday',
            'saturday',
        ]
        const index = parseInt(key, 10)
        if (index >= 0 && index <= 6)
            return translate(`common.weekdays.long.${dayKeys[index]}`)
        return key
    }
    if (dimension === 'monthOpen' || dimension === 'monthClose') {
        const index = parseInt(key, 10)
        if (index >= 0 && index <= 11)
            return translate(`common.months.long.${index}`)
        return key
    }
    if (dimension === 'monthYearOpen' || dimension === 'monthYearClose') {
        const [year, monthNumber] = key.split('-')
        const index = parseInt(monthNumber, 10) - 1
        if (index >= 0 && index <= 11)
            return `${translate(`common.months.long.${index}`)} ${year}`
    }
    return key
}


// --- Couleurs ---

export const hexToRgba = (hex: string, alpha: number = 1): string => {
    hex = hex.replace('#', '')

    if (hex.length === 3) {
        hex = hex
            .split('')
            .map((char) => char + char)
            .join('')
    }

    const r = parseInt(hex.substring(0, 2), 16)
    const g = parseInt(hex.substring(2, 4), 16)
    const b = parseInt(hex.substring(4, 6), 16)

    return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export const rgbaToHex = (rgba: string): string => {
    const match = rgba.match(/rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/)

    if (!match) {
        return '#000000'
    }

    const r = parseInt(match[1])
    const g = parseInt(match[2])
    const b = parseInt(match[3])

    const toHex = (n: number) => {
        const hex = n.toString(16)
        return hex.length === 1 ? '0' + hex : hex
    }

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase()
}

export const colorToRgba = (color: string, alpha: number = 1): string => {
    if (color.startsWith('rgba(')) {
        return color.replace(/[\d.]+\)$/, `${alpha})`)
    }

    if (color.startsWith('rgb(')) {
        return color.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`)
    }

    if (color.startsWith('#')) {
        return hexToRgba(color, alpha)
    }

    return `rgba(0, 0, 0, ${alpha})`
}

export const normalizeColorToHex = (color: string): string => {
    if (color.startsWith('#')) {
        return color.toUpperCase()
    }

    if (color.startsWith('rgba(') || color.startsWith('rgb(')) {
        return rgbaToHex(color)
    }

    return '#000000'
}


// --- Tooltip formatting ---

export const formatTradeTooltipField = (
    tr: TradeExtendedType,
    field: TradeTooltipField,
    t: (key: string) => string,
    durationMin?: number
): string => {
    const tradeFields: TradeTooltipField[] = [
        'lot',
        'openPrice',
        'closePrice',
        'commission',
        'mfe',
        'mae',
        'side',
        'duration',
        'pnl',
        'netProfit',
        'profit',
        'swap',
    ]
    if (!tradeFields.includes(field)) return ''
    const label = t(`components.dashboard.breakdown.trade_property.${field}`)
    switch (field) {
        case 'lot':
            return `${label}: ${tr.lot}`
        case 'openPrice':
            return `${label}: ${tr.openPrice}`
        case 'closePrice':
            return `${label}: ${tr.closePrice}`
        case 'commission':
            return tr.commission
                ? `${label}: ${formatCurrency(tr.commission)}`
                : ''
        case 'mfe':
            return `${label}: ${tr.mfe != null ? tr.mfe : '-'}`
        case 'mae':
            return `${label}: ${tr.mae != null ? tr.mae : '-'}`
        case 'side':
            return `${label}: ${tr.type}`
        case 'duration': {
            const min = durationMin ?? (tr.closeDate && tr.openDate
                ? (new Date(tr.closeDate).getTime() - new Date(tr.openDate).getTime()) / 60000
                : 0)
            return `${label}: ${formatDurationMinutes(min)}`
        }
        case 'pnl':
            return `${label}: ${formatCurrency(tr.profit)}`
        case 'netProfit':
            return `${label}: ${formatCurrency(tr.netProfit)}`
        case 'profit':
            return `${label}: ${formatCurrency(tr.profit)}`
        case 'swap':
            return `${label}: ${formatCurrency(tr.exchange || 0)}`
        default:
            return ''
    }
}
