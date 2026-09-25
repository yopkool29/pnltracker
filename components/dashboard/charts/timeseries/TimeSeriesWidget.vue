<template>
    <DashboardChartsBaseWidgetCard
        :title="chartTitle"
        :enlarged-title="chartTitle + ' (enlarged)'"
        :chart-option="chartOption"
        :loading="loading"
        :subtitle="aggregationLabel"
        @settings-open="onSettingsOpen"
        @settings-cancel="onSettingsCancel"
        @settings-apply="onSettingsApply"
    >
        <!-- Dropdown métrique dans le header (barMA et area) + toggle scrollX -->
        <template #header-extra>
            <div class="flex items-center gap-1.5 flex-wrap">
                <div v-if="config.seriesType === 'barMA' || config.seriesType === 'area'" class="flex items-center gap-1.5">
                    <span class="text-xs text-secondary">{{ $t('components.dashboard.breakdown.metric') }}</span>
                    <USelectMenu v-model="selectedMetric" :items="metricItems" value-key="value" class="w-32" size="xs" />
                </div>
                <div class="flex items-center gap-1.5">
                    <span class="text-xs text-secondary">{{ $t('components.dashboard.breakdown.scroll_x') }}</span>
                    <USwitch v-model="showScrollX" size="xs" />
                </div>
            </div>
        </template>
        <!-- Menu settings : paramètres selon le type de chart -->
        <template #settings>
            <div class="space-y-2">
                <!-- Agrégation (sauf pour bar = par trade) — draft validé au moment de l'apply -->
                <div v-if="config.seriesType !== 'bar'" class="flex flex-col gap-1">
                    <span class="text-sm font-medium">{{ $t('components.dashboard.common.aggregation') }}</span>
                    <USelect v-model="draftAggregation" :items="aggregationOptions" size="sm" />
                </div>
                <!-- Max trades (bar = par trade seulement) -->
                <div v-if="config.seriesType === 'bar'" class="flex flex-col gap-1">
                    <span class="text-sm font-medium">{{ $t('components.dashboard.common.max_trades') }}</span>
                    <USelect v-model="maxTrades" :items="maxTradesOptions" size="sm" />
                </div>
                <!-- Show bars (barMA) — draft validé au moment de l'apply -->
                <div v-if="config.seriesType === 'barMA'" class="flex items-center gap-2">
                    <UCheckbox v-model="draftShowBars" />
                    <span class="text-sm">{{ $t('components.dashboard.common.show_bars') }}</span>
                </div>
                <!-- Show MA (barMA) — draft validé au moment de l'apply -->
                <div v-if="config.seriesType === 'barMA'" class="flex items-center gap-2">
                    <UCheckbox v-model="draftShowMovingAverage" />
                    <span class="text-sm">{{ $t('components.dashboard.common.show_moving_average') }}</span>
                </div>
                <!-- Show threshold (area + pnl seulement) -->
                <div v-if="config.seriesType === 'area' && config.metric === 'pnl'" class="flex items-center gap-2">
                    <UCheckbox v-model="showThreshold" />
                    <span class="text-sm">{{ $t('components.dashboard.common.show_threshold') }}</span>
                </div>
                <!-- Métriques supplémentaires dans le tooltip (barMA et area) -->
                <div v-if="config.seriesType === 'barMA' || config.seriesType === 'area'" class="space-y-1 border-t border-default pt-2">
                    <span class="text-sm font-medium">{{ $t('components.dashboard.breakdown.tooltip_metrics') }}</span>
                    <div v-for="m in metricItems" :key="m.value" class="flex items-center gap-2">
                        <UCheckbox
                            :model-value="selectedTooltipMetrics.includes(m.value as BreakdownMetric)"
                            @update:model-value="toggleTooltipMetric(m.value as BreakdownMetric)"
                        />
                        <span class="text-sm">{{ m.label }}</span>
                    </div>
                </div>
                <!-- Propriétés du trade dans le tooltip (bar = P&L par Trade) -->
                <div v-if="config.seriesType === 'bar'" class="space-y-1 border-t border-default pt-2">
                    <span class="text-sm font-medium">{{ $t('components.dashboard.breakdown.tooltip_metrics') }}</span>
                    <div v-for="opt in tradeTooltipOptionItems" :key="opt.value" class="flex items-center gap-2">
                        <UCheckbox
                            :model-value="selectedTooltipMetrics.includes(opt.value)"
                            @update:model-value="toggleTooltipMetric(opt.value)"
                        />
                        <span class="text-sm">{{ opt.label }}</span>
                    </div>
                </div>
            </div>
        </template>
        <!-- Réticule : 1 bouton toggle (cross ↔ line) -->
        <template #header-actions>
            <button
                class="px-1.5 py-1 rounded cursor-pointer hover:bg-accented focus:outline-none transition-colors text-primary"
                :title="crosshairType === 'cross' ? $t('components.dashboard.common.crosshair_cross') : $t('components.dashboard.common.crosshair_line')"
                @click="crosshairType = crosshairType === 'cross' ? 'line' : 'cross'"
            >
                <UIcon :name="crosshairType === 'cross' ? 'i-lucide-cross' : 'i-lucide-minus'" class="w-4 h-4" />
            </button>
        </template>
    </DashboardChartsBaseWidgetCard>
</template>

<script setup lang="ts">
import type { EChartsOption } from 'echarts'
import type { BreakdownMetric } from '~/type'
import { calculateMetricsByDimension } from '~/composables/analytics/useAnalytics'
import { getMetricValueForMetric, formatMetricValueForMetric } from '~/composables/analytics/breakdownMetrics'
import type { BreakdownMetrics } from '~/composables/analytics/breakdownMetrics'
import { useTooltipMetrics } from '~/composables/charts/useTooltipMetrics'
import { tradeTooltipOptions } from '~/composables/dashboard/breakdownTemplates'
import type { TradeExtendedType } from '~/schema/trade'
import { useTimeSeriesConfig } from '~/composables/charts/useTimeSeriesConfig'
import { buildTimeSeriesChartOption } from '~/composables/charts/builders/timeSeriesChart'

const props = defineProps<{
    itemId: string
    loading?: boolean
    startingCapital?: number | null
}>()

const { t, locale } = useI18n()
const { displayModeNet } = useNetGrossDisplay()
const { formatCurrency } = useUtils()
const dataStore = useDataStore()
const userStore = useUserStore()
const { getGroupedTrades } = useAggregationCache()

// Couleurs selon le type de chart (utilise les user settings comme les anciens composants)
const pnlColors = useTypeColors('pnlBarChart')
const timeSeriesColors = useTypeColors('timeSeriesChart')

const {
    config, updateConfig,
    draftAggregation, draftShowBars, draftShowMovingAverage,
    onSettingsOpen, onSettingsCancel, onSettingsApply,
    metricItems, selectedMetric,
    aggregationOptions, maxTradesOptions,
    aggregation, maxTrades, showBars, showMovingAverage,
    showThreshold, crosshairType, showScrollX,
    chartTitle, aggregationLabel,
} = useTimeSeriesConfig(props.itemId)

// --- Métriques supplémentaires dans le tooltip (barMA seulement) ---
const { selectedTooltipMetrics, toggleTooltipMetric, buildTradeTooltipLines } = useTooltipMetrics(config, updateConfig)

// Options de propriétés du trade pour le chart "P&L par Trade"
const tradeTooltipOptionItems = computed(() =>
    tradeTooltipOptions.map(opt => ({ value: opt.value, label: t(opt.labelKey) }))
)

// --- Formatage axe Y (utilise le même formatage que les breakdowns) ---
const yAxisFormatter = computed<(v: number) => string>(() => {
    const metric = config.value.metric
    return (v: number) => formatMetricValueForMetric(v, metric)
})

// --- Données PnL par trade (seriesType: 'bar') ---
const pnlData = computed(() => {
    if (config.value.seriesType !== 'bar') return null
    const trades: TradeExtendedType[] = dataStore.lastTrades || []
    const sorted = [...trades].sort((a, b) => {
        const aClose = a.closeDate ? new Date(a.closeDate).getTime() : 0
        const bClose = b.closeDate ? new Date(b.closeDate).getTime() : 0
        if (aClose !== bClose) return aClose - bClose
        const aOpen = a.openDate ? new Date(a.openDate).getTime() : 0
        const bOpen = b.openDate ? new Date(b.openDate).getTime() : 0
        if (aOpen !== bOpen) return aOpen - bOpen
        return (a.id || 0) - (b.id || 0)
    })
    const max = config.value.maxTrades ?? 50
    const display = sorted.slice(-max)
    return {
        trades: display,
        labels: display.map((_, i) => `#${i + 1}`),
        values: display.map((tr) => (displayModeNet.value ? tr.netProfit || 0 : tr.profit || 0)),
    }
})

const getPeriodMetrics = () => {
    const trades: TradeExtendedType[] = dataStore.lastTrades || []
    if (!trades.length) return null
    const grouped = getGroupedTrades(aggregation.value)
    const metric = config.value.metric
    const labels: string[] = []
    const values: number[] = []
    const allMetrics: BreakdownMetrics[] = []
    for (const key of Object.keys(grouped).sort()) {
        const groupTrades = grouped[key]
        if (!groupTrades?.length) continue
        labels.push(key)
        const metrics = calculateMetricsByDimension(groupTrades as TradeExtendedType[], () => ['all'], displayModeNet.value)[0]
        values.push(metrics ? getMetricValueForMetric(metrics, metric) : 0)
        allMetrics.push(metrics || ({} as BreakdownMetrics))
    }
    return { labels, values, allMetrics }
}

// Cumul uniquement pour pnl, valeur brute pour les autres métriques
const shouldCumulate = computed(() => config.value.metric === 'pnl')
const cumulatedData = computed(() => {
    if (config.value.seriesType !== 'area') return null
    const periodMetrics = getPeriodMetrics()
    if (!periodMetrics) return null
    const values = shouldCumulate.value
        ? periodMetrics.values.reduce<number[]>((acc, value) => [...acc, (acc[acc.length - 1] || 0) + value], [])
        : periodMetrics.values
    return { ...periodMetrics, values }
})

const periodMetricsData = computed(() => {
    if (config.value.seriesType !== 'barMA') return null
    const periodMetrics = getPeriodMetrics()
    if (!periodMetrics) return null
    const maWindow = config.value.movingAverageWindow ?? 5
    const maValues = periodMetrics.values.map((_, index, values) => {
        const window = values.slice(Math.max(0, index - maWindow + 1), index + 1)
        return window.reduce((sum, value) => sum + value, 0) / window.length
    })
    return { ...periodMetrics, maValues }
})

// --- Chart option ---
const { getChartContext, getCrosshairConfig, buildTooltip } = useEchartsChartOption()
const chartOption = computed<EChartsOption | undefined>(() => {
    const ctx = getChartContext()
    const axisPointerConfig = getCrosshairConfig(crosshairType.value)
    return buildTimeSeriesChartOption({
        seriesType: config.value.seriesType,
        ctx,
        tooltipBase: buildTooltip(ctx, axisPointerConfig),
        scrollXEnabled: showScrollX.value,
        yFmt: yAxisFormatter.value,
        locale: locale.value as 'fr' | 'en' | 'us',
        t,
        displayModeNet: displayModeNet.value,
        metric: config.value.metric,
        userSettings: userStore.user?.settings_object || {},
        formatCurrency,
        buildTradeTooltipLines,
        selectedTooltipMetrics: selectedTooltipMetrics.value,
        pnlData: pnlData.value,
        cumulatedData: cumulatedData.value,
        periodMetricsData: periodMetricsData.value,
        shouldCumulate: shouldCumulate.value,
        pnlColors: {
            profit: pnlColors.profitColor.value,
            loss: pnlColors.lossColor.value,
            breakeven: pnlColors.breakevenColor.value,
        },
        tsColors: {
            bar: timeSeriesColors.barColor.value,
            rawMetric: timeSeriesColors.rawMetricColor.value,
            movingAverage: timeSeriesColors.movingAverageColor.value,
            profit: timeSeriesColors.profitColor.value,
            loss: timeSeriesColors.lossColor.value,
        },
        startingCapital: props.startingCapital,
        showThreshold: showThreshold.value,
        showMovingAverage: showMovingAverage.value,
        showBars: showBars.value,
        yMin: config.value.yAxisMin,
        yMax: config.value.yAxisMax,
        metricLabel: metricItems.value.find((m) => m.value === config.value.metric)?.label,
    })
})
</script>
