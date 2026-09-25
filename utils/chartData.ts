import type { TradeType } from '~/schema/trade'

// --- Générateurs de données pour les charts ---

// Génère les données pour un graphique d'évolution du PnL intraday
export const generateIntradayPnlChartData = (
    trades: TradeType[]
): Array<{ count: number; pnl: number; date?: Date }> => {
    if (!trades || trades.length === 0) return []

    let cumulativePnl = 0
    let count = 0
    const dataPoints: Array<{ count: number; pnl: number; date?: Date }> =
        trades.map((trade) => {
            cumulativePnl += trade.profit || 0
            count++
            return {
                count,
                date: trade.closeDate,
                pnl: parseFloat(cumulativePnl.toFixed(2)),
            }
        })

    if (dataPoints.length > 0) {
        dataPoints.unshift({ count: 0, date: undefined, pnl: 0 })
    }

    return dataPoints
}
