import type { TradeExtendedType } from '~/schema/trade'
import { round as _round } from '~/utils/format'
import {
    getAPPT,
    getAvgTradeDuration,
    getBreakevenTradesMetrics,
    getCalmarRatio,
    getExpectancy,
    getLosingTradesMetrics,
    getMaxDrawdownWithDates,
    getMaxLosingStreak,
    getMaxRunUpWithDates,
    getMaxTradeDuration,
    getMaxWinningStreak,
    getPLRatio,
    getPNL,
    getProfitFactor,
    getRecoveryFactor,
    getSharpeRatio,
    getSortinoRatio,
    getSQN,
    getTotalContracts,
    getUlcerIndex,
    getWinningTradesMetrics,
    getWinrate,
    sortTradesByCloseDate,
} from '~/utils/tradeStats'
import {
    countTradesWithStopLoss,
    getRMultipleCoverage,
    getRMultipleReliability,
    getRMultiples,
    type RMultipleReliability,
    type RMultipleTrade,
} from '~/utils/rMultiple'

type TradePerformanceOptions = {
    useNet: boolean
    round: number
    pnlRound: number
}

type RPerformance = {
    coverage: number
    reliability: RMultipleReliability
    tradesWithStopLoss: number
    tradesWithRMultiple: number
    totalR: number | null
    apptR: number | null
    profitFactorR: number | null
    plRatioR: number | null
    avgWinR: number | null
    avgLossR: number | null
    largestWinR: number | null
    largestLossR: number | null
    totalProfitR: number | null
    totalLossR: number | null
    sqn: number
}

export type TradePerformance = {
    sortedTrades: TradeExtendedType[]
    pnl: number
    appt: number
    plRatio: number
    winrate: number
    profitFactor: number
    recoveryFactor: number
    sharpeRatio: number
    sortinoRatio: number
    calmarRatio: number
    ulcerIndex: number
    tradesCount: number
    grossPnl: number
    totalContracts: number
    avgTradeDuration: number
    maxTradeDuration: number
    expectancy: number
    totalCommission: number
    totalSwap: number
    winning: ReturnType<typeof getWinningTradesMetrics>
    losing: ReturnType<typeof getLosingTradesMetrics>
    breakeven: ReturnType<typeof getBreakevenTradesMetrics>
    runUp: ReturnType<typeof getMaxRunUpWithDates>
    drawdown: ReturnType<typeof getMaxDrawdownWithDates>
    maxWinningStreak: number
    maxLosingStreak: number
    r: RPerformance
}

// Extract only the riskReward field from metadata without full Zod validation.
// The full KnownTradeMetadataSchema.safeParse was taking ~4.5s for 1960 trades
// because of nested objects/arrays. getRMultiple only needs metadata.riskReward.
const getRMultipleMetadata = (
    metadata: unknown
): Record<string, unknown> | null => {
    if (!metadata) return null
    let parsed = metadata
    if (typeof metadata === 'string') {
        try {
            parsed = JSON.parse(metadata)
        } catch {
            return null
        }
    }
    if (typeof parsed !== 'object' || parsed === null) return null
    const rr = (parsed as Record<string, unknown>).riskReward
    if (typeof rr === 'number' && rr > 0 && rr <= 500) {
        return { riskReward: rr }
    }
    return null
}

const toRMultipleTrades = (trades: TradeExtendedType[]): RMultipleTrade[] =>
    trades.map((trade) => ({
        profit: trade.profit,
        netProfit: trade.netProfit,
        openPrice: trade.openPrice,
        closePrice: trade.closePrice,
        stopLoss: trade.stopLoss || 0,
        type: trade.type,
        metadata: getRMultipleMetadata(trade.metadata),
    }))

// Convention du codebase : round < 0 = pas d'arrondi
// (comme getTotalRMultiple/getSQN — round(2, -1) retournerait 0)
const roundR = (value: number, round: number) => (round < 0 ? value : _round(value, round))

const calculateRPerformance = (
    trades: TradeExtendedType[],
    options: TradePerformanceOptions
): RPerformance => {
    const rTrades = toRMultipleTrades(trades)
    const reliability = getRMultipleReliability(rTrades)
    // Compute rMultiples ONCE and derive all metrics from it — avoids 7 redundant
    // passes over 1960 trades (each calling getAvgLossInEuros + getRMultiple).
    const rMultiples =
        reliability === 'none' ? [] : getRMultiples(rTrades, options.useNet)
    const hasRMultiples = rMultiples.length > 0

    // Derive all R metrics from the pre-computed rMultiples array
    const winningRs = hasRMultiples ? rMultiples.filter((r) => r > 0) : []
    const losingRs = hasRMultiples ? rMultiples.filter((r) => r < 0) : []
    const sumWin = winningRs.reduce((acc, r) => acc + r, 0)
    const sumLoss = losingRs.reduce((acc, r) => acc + r, 0)
    const countWin = winningRs.length
    const countLoss = losingRs.length
    const avgWin = countWin > 0 ? sumWin / countWin : 0
    const avgLoss = countLoss > 0 ? sumLoss / countLoss : 0
    const largestWin = countWin > 0 ? Math.max(...winningRs) : null
    const largestLoss = countLoss > 0 ? Math.min(...losingRs) : null
    const totalR = hasRMultiples ? roundR(sumWin + sumLoss, options.round) : null
    const apptR = hasRMultiples && rMultiples.length > 0
        ? roundR((sumWin + sumLoss) / rMultiples.length, options.round)
        : null
    const profitFactorR = hasRMultiples && sumLoss !== 0
        ? roundR(sumWin / Math.abs(sumLoss), options.round)
        : null
    const plRatioR = hasRMultiples && avgLoss !== 0
        ? roundR(avgWin / Math.abs(avgLoss), options.round)
        : null

    return {
        coverage: getRMultipleCoverage(rTrades),
        reliability,
        tradesWithStopLoss: countTradesWithStopLoss(rTrades),
        tradesWithRMultiple: rMultiples.length,
        totalR,
        apptR,
        profitFactorR,
        plRatioR,
        avgWinR: hasRMultiples ? roundR(avgWin, options.round) : null,
        avgLossR: hasRMultiples ? roundR(avgLoss, options.round) : null,
        largestWinR: largestWin !== null ? roundR(largestWin, options.round) : null,
        largestLossR: largestLoss !== null ? roundR(largestLoss, options.round) : null,
        totalProfitR: hasRMultiples ? roundR(sumWin, options.round) : null,
        totalLossR: hasRMultiples ? roundR(sumLoss, options.round) : null,
        sqn: hasRMultiples ? getSQN(rMultiples, options.round) : 0,
    }
}

export const calculateTradePerformance = (
    trades: TradeExtendedType[],
    options: TradePerformanceOptions
): TradePerformance => {
    const sortedTrades = sortTradesByCloseDate(trades)

    const pnl = getPNL(sortedTrades, options.pnlRound, options.useNet)
    const appt = getAPPT(sortedTrades, true, options.round, options.useNet)
    const plRatio = getPLRatio(sortedTrades, options.round, options.useNet)
    const winrate = getWinrate(sortedTrades, options.round, options.useNet)
    const profitFactor = getProfitFactor(sortedTrades, options.round, options.useNet)
    const recoveryFactor = getRecoveryFactor(sortedTrades, options.round, options.useNet)

    const sharpeRatio = getSharpeRatio(sortedTrades, 0, options.round, options.useNet)
    const sortinoRatio = getSortinoRatio(sortedTrades, 0, options.round, options.useNet)
    const calmarRatio = getCalmarRatio(sortedTrades, options.round, options.useNet)
    const ulcerIndex = getUlcerIndex(sortedTrades, options.round, options.useNet)

    const totalContracts = getTotalContracts(sortedTrades)
    const avgTradeDuration = getAvgTradeDuration(sortedTrades, options.round)
    const maxTradeDuration = getMaxTradeDuration(sortedTrades, options.round)
    const expectancy = getExpectancy(sortedTrades, options.round, options.useNet)
    const totalCommission = sortedTrades.reduce((sum, trade) => sum + (trade.commission || 0), 0)
    const totalSwap = sortedTrades.reduce((sum, trade) => sum + (trade.exchange || 0), 0)

    const winning = getWinningTradesMetrics(sortedTrades, options.useNet)
    const losing = getLosingTradesMetrics(sortedTrades, options.useNet)
    const breakeven = getBreakevenTradesMetrics(sortedTrades, options.useNet)

    const runUp = getMaxRunUpWithDates(sortedTrades, options.useNet)
    const drawdown = getMaxDrawdownWithDates(sortedTrades, options.useNet)
    const maxWinningStreak = getMaxWinningStreak(sortedTrades, options.useNet)
    const maxLosingStreak = getMaxLosingStreak(sortedTrades, options.useNet)

    const r = calculateRPerformance(sortedTrades, options)

    return {
        sortedTrades,
        pnl,
        appt,
        plRatio,
        winrate,
        profitFactor,
        recoveryFactor,
        sharpeRatio,
        sortinoRatio,
        calmarRatio,
        ulcerIndex,
        tradesCount: sortedTrades.length,
        grossPnl: getPNL(sortedTrades, options.round, options.useNet),
        totalContracts,
        avgTradeDuration,
        maxTradeDuration,
        expectancy,
        totalCommission,
        totalSwap,
        winning,
        losing,
        breakeven,
        runUp,
        drawdown,
        maxWinningStreak,
        maxLosingStreak,
        r,
    }
}
