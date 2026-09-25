import { isBreakdownKey } from '~/type'

// --- Grid layout ---

export interface GridTemplateItem {
    w: number
    h: number
    i: string
    // Inséré en haut (y=0) quand il manque à un layout sauvegardé
    atTop?: boolean
}

export const defaultGridItemsLg: GridTemplateItem[] = [
    { w: 12, h: 3, i: 'metricsCards', atTop: true },
    { w: 6, h: 6, i: 'timeSeries_defaultPnlByTrade' },
    { w: 6, h: 6, i: 'timeSeries_defaultCumulatedPnl' },
    { w: 6, h: 6, i: 'timeSeries_defaultAppt' },
    { w: 6, h: 6, i: 'timeSeries_defaultWinrate' },
    { w: 3, h: 12, i: 'allTrades' },
    { w: 3, h: 12, i: 'profitTrades' },
    { w: 3, h: 12, i: 'losingTrades' },
    { w: 3, h: 7, i: 'winLossComparison' },
    { w: 3, h: 6, i: 'riskRatios' },
    { w: 6, h: 8, i: 'dayStatistics' },
    { w: 6, h: 6, i: 'breakdownHeatmap_defaultHourDay' },
    { w: 6, h: 6, i: 'breakdownBarVertical_defaultWinrateByHour' },
    { w: 6, h: 6, i: 'breakdownBarVertical_defaultPnlByDayOfWeek' },
]

export const defaultGridItemsMd: GridTemplateItem[] = [
    { w: 6, h: 4, i: 'metricsCards', atTop: true },
    { w: 6, h: 6, i: 'timeSeries_defaultPnlByTrade' },
    { w: 6, h: 6, i: 'timeSeries_defaultCumulatedPnl' },
    { w: 6, h: 6, i: 'timeSeries_defaultAppt' },
    { w: 6, h: 6, i: 'timeSeries_defaultWinrate' },
    { w: 3, h: 12, i: 'allTrades' },
    { w: 3, h: 12, i: 'profitTrades' },
    { w: 3, h: 12, i: 'losingTrades' },
    { w: 3, h: 8, i: 'winLossComparison' },
    { w: 3, h: 10, i: 'riskRatios' },
    { w: 6, h: 8, i: 'dayStatistics' },
    { w: 6, h: 6, i: 'breakdownHeatmap_defaultHourDay' },
    { w: 6, h: 6, i: 'breakdownBarVertical_defaultWinrateByHour' },
    { w: 3, h: 6, i: 'breakdownBarVertical_defaultPnlByDayOfWeek' },
]

export const defaultGridItemsSm: GridTemplateItem[] = [
    { w: 3, h: 6, i: 'metricsCards', atTop: true },
    { w: 3, h: 6, i: 'timeSeries_defaultPnlByTrade' },
    { w: 3, h: 6, i: 'timeSeries_defaultCumulatedPnl' },
    { w: 3, h: 6, i: 'timeSeries_defaultAppt' },
    { w: 3, h: 6, i: 'timeSeries_defaultWinrate' },
    { w: 3, h: 12, i: 'allTrades' },
    { w: 3, h: 12, i: 'profitTrades' },
    { w: 3, h: 12, i: 'losingTrades' },
    { w: 3, h: 8, i: 'winLossComparison' },
    { w: 3, h: 10, i: 'riskRatios' },
    { w: 6, h: 8, i: 'dayStatistics' },
    { w: 3, h: 6, i: 'breakdownBarVertical_defaultWinrateByHour' },
    { w: 3, h: 6, i: 'breakdownBarVertical_defaultPnlByDayOfWeek' },
]

const compactItems = (items: GridTemplateItem[], cols: number) => {
    let currentX = 0
    let currentY = 0
    let rowHeight = 0
    return items.map((item) => {
        if (currentX + item.w > cols) {
            currentX = 0
            currentY += rowHeight
            rowHeight = 0
        }
        const { atTop: _atTop, ...gridItem } = item
        const positioned = { ...gridItem, x: currentX, y: currentY }
        currentX += item.w
        rowHeight = Math.max(rowHeight, item.h)
        return positioned
    })
}

export const defaultDashboardGridLayout = compactItems(defaultGridItemsLg, 12)
export const defaultDashboardGridLayoutMd = compactItems(defaultGridItemsMd, 6)
export const defaultDashboardGridLayoutSm = compactItems(defaultGridItemsSm, 3)

// Items that can be resized in the grid layout
// Les items breakdown sont resizable — on détecte par préfixe au runtime
// (les clés sont dynamiques : breakdownBar_abc_123...)
export const isResizableItem = (itemId: string): boolean => {
    if (resizableGridItems.includes(itemId)) return true
    return isBreakdownKey(itemId)
}

export const resizableGridItems = [
    'metricsCards',
    'allTrades',
    'profitTrades',
    'losingTrades',
    'winLossComparison',
    'riskRatios',
    'dayStatistics',
]
