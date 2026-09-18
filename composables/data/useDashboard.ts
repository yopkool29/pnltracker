import type { AccountType } from '~/schema/account'
import type { TradeFilter } from '~/type'
import { transformAdvancedFilters } from '~/utils/filter-utils'
import { calculateTradePerformance } from '~/utils/tradePerformance'
import {
    getDailyPnlArray,
    getTotalTradingDays,
    getBusinessDaysFromTrades,
    getWinningWeeksPercent,
    getWinningMonthsPercent,
    getWinningDaysCount,
    getLosingDaysCount,
    getBreakevenDaysCount,
    getMaxConsecutiveWinningDays,
    getMaxConsecutiveLosingDays,
    getAverageDailyPnl,
    getAverageWinningDayPnl,
    getAverageLosingDayPnl,
    getLargestProfitableDay,
    getLargestLosingDay,
    getDailyMaxDrawdownWithPercent,
    getAverageDrawdown,
    getAverageDrawdownPercent
} from '~/utils/dashboard'

export const buildFiltersForApi = (
    startDate: Date | null,
    endDate: Date | null,
    includeEndDay: boolean,
    accountIds: number[] = [],
    advancedFilters: TradeFilter[] = []
): TradeFilter[] => {
    const _startDate = startDate ? startDate.getTime() : null
    const _endDate = endDate ? endDate.getTime() : null

    const filtersForApi: TradeFilter[] = []
    if (_startDate) {
        filtersForApi.push({ column: 'closeDate', operator: '>=', value: _startDate })
    }
    if (_endDate) {
        const operator = includeEndDay ? '<=' : '<'
        filtersForApi.push({ column: 'closeDate', operator, value: _endDate })
    }

    // Gestion des comptes sélectionnés
    if (accountIds && accountIds.length > 0) {
        if (accountIds.length === 1) {
            filtersForApi.push({ column: 'accountId', operator: '=', value: accountIds[0] })
        } else {
            filtersForApi.push({
                column: 'accountId',
                operator: 'in',
                value: accountIds
            })
        }
    }

    // Ajouter les filtres avancés (exclure ceux avec valeur vide)
    if (advancedFilters && advancedFilters.length > 0) {
        filtersForApi.push(...transformAdvancedFilters(advancedFilters))
    }

    return filtersForApi
}

export const useDashboard = () => {

    const accounts = ref<AccountType[]>([])
    const { fetchTrades } = useTrades()
    const userStore = useUserStore()
    const dataStore = useDataStore()

    const fetchAccounts = async () => {
        if (!userStore.user) return
        accounts.value = await $fetch('/api/account') as AccountType[]
    }

    const fetchData = async (startDate: Date | null, endDate: Date | null, includeEndDay: boolean, accountIds: number[] = [], useNet: boolean = true, advancedFilters: TradeFilter[] = []) => {
        const filtersForApi = buildFiltersForApi(startDate, endDate, includeEndDay, accountIds, advancedFilters)

        let trades = await fetchTrades(filtersForApi, -1)

        // Filtrer les trades dont le P&L absolu est inférieur au seuil
        const pnlThreshold = userStore.user?.settings_object?.pnlThreshold || 0
        if (pnlThreshold > 0) {
            trades = trades.filter(t => Math.abs(t.netProfit || 0) >= pnlThreshold)
        }

        // Stocker dans le store non-persistant (memoire uniquement)
        dataStore.lastTrades = trades

        const perfResult = calculateTradePerformance(trades, { useNet, round: 2, pnlRound: 0 })

        // Métriques existantes - utiliser useNet pour basculer entre net et brut
        dataStore.dashboardResult.pnl = perfResult.pnl
        dataStore.dashboardResult.appt = perfResult.appt
        dataStore.dashboardResult.plRatio = perfResult.plRatio
        dataStore.dashboardResult.winrate = perfResult.winrate
        dataStore.dashboardResult.profitFactor = perfResult.profitFactor
        dataStore.dashboardResult.recoveryFactor = perfResult.recoveryFactor
        dataStore.dashboardResult.sharpeRatio = perfResult.sharpeRatio
        dataStore.dashboardResult.sortinoRatio = perfResult.sortinoRatio
        dataStore.dashboardResult.calmarRatio = perfResult.calmarRatio
        dataStore.dashboardResult.ulcerIndex = perfResult.ulcerIndex
        dataStore.dashboardResult.tradesCount = perfResult.tradesCount

        // ALL TRADES - Nouvelles métriques
        dataStore.dashboardResult.grossPnl = perfResult.grossPnl
        dataStore.dashboardResult.totalContracts = perfResult.totalContracts
        dataStore.dashboardResult.avgTradeDuration = perfResult.avgTradeDuration
        dataStore.dashboardResult.maxTradeDuration = perfResult.maxTradeDuration
        dataStore.dashboardResult.expectancy = perfResult.expectancy
        dataStore.dashboardResult.totalCommission = perfResult.totalCommission
        dataStore.dashboardResult.totalSwap = perfResult.totalSwap

        // PROFIT TRADES
        dataStore.dashboardResult.totalProfit = perfResult.winning.totalProfit
        dataStore.dashboardResult.winningTradesCount = perfResult.winning.count
        dataStore.dashboardResult.winningContractsCount = perfResult.winning.totalContracts
        dataStore.dashboardResult.largestWin = perfResult.winning.largest
        dataStore.dashboardResult.avgWin = perfResult.winning.average
        dataStore.dashboardResult.stdDevWin = perfResult.winning.stdDev
        dataStore.dashboardResult.avgWinDuration = perfResult.winning.avgDuration
        dataStore.dashboardResult.maxWinDuration = perfResult.winning.maxDuration
        dataStore.dashboardResult.winningTradesCommission = perfResult.winning.totalCommission
        dataStore.dashboardResult.winningTradesSwap = perfResult.winning.totalSwap

        // Max Run-up avec dates
        dataStore.dashboardResult.maxRunUp = perfResult.runUp.maxRunUp
        dataStore.dashboardResult.maxRunUpDateFrom = perfResult.runUp.dateFrom
        dataStore.dashboardResult.maxRunUpDateTo = perfResult.runUp.dateTo

        // LOSING TRADES
        dataStore.dashboardResult.totalLoss = perfResult.losing.totalLoss
        dataStore.dashboardResult.losingTradesCount = perfResult.losing.count
        dataStore.dashboardResult.losingContractsCount = perfResult.losing.totalContracts
        dataStore.dashboardResult.largestLoss = perfResult.losing.largest
        dataStore.dashboardResult.avgLoss = perfResult.losing.average
        dataStore.dashboardResult.stdDevLoss = perfResult.losing.stdDev
        dataStore.dashboardResult.avgLossDuration = perfResult.losing.avgDuration
        dataStore.dashboardResult.maxLossDuration = perfResult.losing.maxDuration
        dataStore.dashboardResult.losingTradesCommission = perfResult.losing.totalCommission
        dataStore.dashboardResult.losingTradesSwap = perfResult.losing.totalSwap

        // Max Drawdown avec dates
        dataStore.dashboardResult.maxDrawdown = perfResult.drawdown.maxDrawdown
        dataStore.dashboardResult.maxDrawdownDateFrom = perfResult.drawdown.dateFrom
        dataStore.dashboardResult.maxDrawdownDateTo = perfResult.drawdown.dateTo

        // BREAKEVEN TRADES
        dataStore.dashboardResult.breakevenTradesCount = perfResult.breakeven.count
        dataStore.dashboardResult.breakevenContractsCount = perfResult.breakeven.totalContracts

        // STREAKS (trades triés par closeDate pour un calcul correct)
        dataStore.dashboardResult.maxWinningStreak = perfResult.maxWinningStreak
        dataStore.dashboardResult.maxLosingStreak = perfResult.maxLosingStreak

        // DAILY METRICS
        const dailyPnls = getDailyPnlArray(trades, useNet, userStore.settingsObject)
        dataStore.dashboardResult.totalTradingDays = getTotalTradingDays(dailyPnls)
        const businessDays = getBusinessDaysFromTrades(trades)
        dataStore.dashboardResult.tradeFrequency = businessDays > 0 ? trades.length / businessDays : 0
        dataStore.dashboardResult.winningDays = getWinningDaysCount(dailyPnls)
        dataStore.dashboardResult.losingDays = getLosingDaysCount(dailyPnls)
        dataStore.dashboardResult.breakevenDays = getBreakevenDaysCount(dailyPnls)
        dataStore.dashboardResult.maxConsecutiveWinningDays = getMaxConsecutiveWinningDays(dailyPnls)
        dataStore.dashboardResult.maxConsecutiveLosingDays = getMaxConsecutiveLosingDays(dailyPnls)
        dataStore.dashboardResult.winningWeeksPercent = getWinningWeeksPercent(trades, useNet, userStore.settingsObject)
        dataStore.dashboardResult.winningMonthsPercent = getWinningMonthsPercent(trades, useNet, userStore.settingsObject)
        dataStore.dashboardResult.averageDailyPnl = getAverageDailyPnl(dailyPnls, 2)
        dataStore.dashboardResult.averageWinningDayPnl = getAverageWinningDayPnl(dailyPnls, 2)
        dataStore.dashboardResult.averageLosingDayPnl = getAverageLosingDayPnl(dailyPnls, 2)

        const largestProfitableDay = getLargestProfitableDay(dailyPnls)
        dataStore.dashboardResult.largestProfitableDayPnl = largestProfitableDay?.pnl ?? 0
        dataStore.dashboardResult.largestProfitableDayDate = largestProfitableDay ? new Date(largestProfitableDay.date) : null

        const largestLosingDay = getLargestLosingDay(dailyPnls)
        dataStore.dashboardResult.largestLosingDayPnl = largestLosingDay?.pnl ?? 0
        dataStore.dashboardResult.largestLosingDayDate = largestLosingDay ? new Date(largestLosingDay.date) : null

        const dailyDrawdown = getDailyMaxDrawdownWithPercent(dailyPnls, 2)
        dataStore.dashboardResult.dailyMaxDrawdown = dailyDrawdown.maxDrawdown
        dataStore.dashboardResult.dailyMaxDrawdownPercent = dailyDrawdown.maxDrawdownPercent
        dataStore.dashboardResult.averageDrawdown = getAverageDrawdown(dailyPnls, 2)
        dataStore.dashboardResult.averageDrawdownPercent = getAverageDrawdownPercent(dailyPnls, 2)

        // R-MULTIPLE METRICS
        // Le R-multiple est calculé depuis le stopLoss (ratio de prix) ou par hypothèse (perte = SL touché)
        // Pas besoin de plannedRisk manuel — voir docs/dev/rr-design.md
        dataStore.dashboardResult.rMultipleCoverage = Math.round(perfResult.r.coverage * 100)
        dataStore.dashboardResult.rMultipleReliability = perfResult.r.reliability
        dataStore.dashboardResult.tradesWithStopLoss = perfResult.r.tradesWithStopLoss
        dataStore.dashboardResult.totalR = perfResult.r.totalR
        dataStore.dashboardResult.apptR = perfResult.r.apptR
        dataStore.dashboardResult.profitFactorR = perfResult.r.profitFactorR
        dataStore.dashboardResult.plRatioR = perfResult.r.plRatioR
        dataStore.dashboardResult.avgWinR = perfResult.r.avgWinR
        dataStore.dashboardResult.avgLossR = perfResult.r.avgLossR
        dataStore.dashboardResult.largestWinR = perfResult.r.largestWinR
        dataStore.dashboardResult.largestLossR = perfResult.r.largestLossR
        dataStore.dashboardResult.totalProfitR = perfResult.r.totalProfitR
        dataStore.dashboardResult.totalLossR = perfResult.r.totalLossR
        dataStore.dashboardResult.tradesWithRMultiple = perfResult.r.tradesWithRMultiple
        // SQN nécessite les R-multiples (Van Tharp)
        dataStore.dashboardResult.sqn = perfResult.r.sqn

        return trades
    }

    const clearLastTrades = () => {
        dataStore.lastTrades = []
    }

    return {
        accounts,
        dashBoardLastTrades: computed(() => dataStore.lastTrades),
        dashBoardResult: computed(() => dataStore.dashboardResult),
        fetchAccounts,
        fetchData,
        clearLastTrades
    }
}
