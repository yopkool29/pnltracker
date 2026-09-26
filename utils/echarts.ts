import type {
    EChartsOption,
    LineSeriesOption,
    ScatterSeriesOption,
} from 'echarts'
import type { BreakdownMetric } from '~/type'

// --- ECharts builders ---

export type EChartsGridOption = {
    left?: number
    right?: number
    top?: number
    bottom?: number
}

type EChartsItemStyle = {
    color?: string
    borderRadius?: number | number[]
    borderColor?: string
    borderWidth?: number
}

type EChartsLineStyle = {
    width?: number
    color?: string
    type?: 'solid' | 'dashed' | 'dotted'
}

export type EChartsAreaStyle = {
    color?: string
    opacity?: number
    origin?: number | 'start' | 'end' | 'auto'
}

export type EChartsFormatterParams<V = number> = {
    seriesName?: string
    name?: string
    value: V
    dataIndex: number
    seriesIndex: number
    data: unknown
}

interface BarDataItem {
    value: number
    itemStyle?: {
        color?: string
        borderRadius?: number | number[]
    }
}

interface BarSeriesConfig {
    data: BarDataItem[]
    barMaxWidth?: number
    barMinHeight?: number
    barGap?: string
    barCategoryGap?: string
    emphasis?: {
        disabled?: boolean
        itemStyle?: {
            borderColor?: string
            borderWidth?: number
        }
    }
}

interface LineSeriesConfig {
    name: string
    data: (number | null)[]
    color: string
    smooth?: number
    symbol?: string
    symbolSize?: number
    showSymbol?: boolean
    areaStyle?: EChartsAreaStyle
    lineStyle?: EChartsLineStyle
    connectNulls?: boolean
}

type ScatterDataPoint = {
    value: number[]
    itemStyle?: {
        color?: string
        borderColor?: string
        borderWidth?: number
        borderType?: string
    }
}

interface ScatterSeriesConfig {
    data: ScatterDataPoint[]
    symbolSize?: number | ((data: unknown[]) => number)

    emphasis?: {
        scale?: number
        itemStyle?: {
            borderColor?: string
            borderWidth?: number
        }
    }
}

export const buildBarColors = (
    values: number[],
    positiveColor: string,
    negativeColor: string,
    neutralColor: string
): string[] => {
    return values.map((v) =>
        v > 0 ? positiveColor : v < 0 ? negativeColor : neutralColor
    )
}

export const buildBarData = (
    values: (number | null)[],
    colors: string[],
    borderRadiusFn?: (v: number) => number[]
): BarDataItem[] => {
    return values.map((v, i) => ({
        value: v,
        itemStyle: {
            color: colors[i],
            borderRadius:
                borderRadiusFn && v != null ? borderRadiusFn(v) : [3, 3, 0, 0],
        },
    }))
}

export const buildBarSeries = (
    config: BarSeriesConfig
): EChartsOption['series'] => {
    return [
        {
            type: 'bar' as const,
            data: config.data,
            barMaxWidth: config.barMaxWidth ?? 32,
            barMinHeight: config.barMinHeight ?? 1,
            barGap: config.barGap,
            barCategoryGap: config.barCategoryGap,
            emphasis: config.emphasis ?? { disabled: true },
        },
    ]
}

export const buildLineSeries = (config: LineSeriesConfig): LineSeriesOption => {
    return {
        type: 'line' as const,
        name: config.name,
        data: config.data,
        smooth: config.smooth ?? 0.2,
        symbol: config.symbol ?? 'circle',
        symbolSize: config.symbolSize ?? 4,
        showSymbol:
            config.showSymbol ?? (config.symbolSize === 0 ? false : undefined),
        lineStyle: (config.lineStyle ?? {
            width: 2,
            color: config.color,
        }) as LineSeriesOption['lineStyle'],
        itemStyle: { color: config.color },
        areaStyle: config.areaStyle as LineSeriesOption['areaStyle'],
        connectNulls: config.connectNulls ?? false,
        emphasis: { disabled: true },
    }
}

export const buildScatterSeries = (
    config: ScatterSeriesConfig,
    isDark?: boolean
): ScatterSeriesOption => {
    return {
        type: 'scatter' as const,
        data: config.data as ScatterSeriesOption['data'],
        symbolSize: config.symbolSize ?? 10,
        emphasis: config.emphasis ?? {
            scale: 1.3,
            itemStyle: {
                borderColor: isDark ? '#ffffff' : '#1f2937',
                borderWidth: 2,
            },
        },
    }
}

export const echartsFontFamily =
    'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"'

export const getEchartsBaseOption = (
    fontFamily?: string
): Partial<EChartsOption> => ({
    animation: true,
    animationDuration: 300,
    animationEasing: 'cubicOut' as const,
    textStyle: { fontFamily: fontFamily || echartsFontFamily },
    grid: { left: 70, right: 16, top: 12, bottom: 28 },
})

export const getEchartsAxisColors = (isDark: boolean) => ({
    axisColor: isDark ? '#4b5563' : '#ccc',
    textColor: isDark ? '#eeeeee' : '#444',
})

export const getEchartsTooltipColors = () => ({
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderColor: 'transparent',
    textColor: '#e5e7eb',
})

export const getEchartsCenterTextGraphic = (
    text: string,
    textColor: string,
    fontFamily: string
) => ({
    type: 'text' as const,
    left: 'center' as const,
    top: 'center' as const,
    style: {
        text,
        textAlign: 'center' as const,
        textVerticalAlign: 'middle' as const,
        fontSize: 18,
        fontWeight: 'bold' as const,
        fill: textColor,
        fontFamily,
    },
})

// --- Chart colors ---

type MetricCategory = 'monetary' | 'percent' | 'raw'

const monetaryMetrics: BreakdownMetric[] = [
    'pnl',
    'appt',
    'avgWin',
    'avgLoss',
    'expectancy',
    'drawdown',
    'currentDrawdown',
]

const percentMetrics: BreakdownMetric[] = ['winrate']

const getMetricCategory = (metric: BreakdownMetric): MetricCategory => {
    if (monetaryMetrics.includes(metric)) return 'monetary'
    if (percentMetrics.includes(metric)) return 'percent'
    return 'raw'
}

export const isMonetaryMetric = (metric: BreakdownMetric): boolean =>
    getMetricCategory(metric) === 'monetary'

export const chartColors = {
    profit: '#16a34a',
    loss: '#dc2626',
    neutral: '#9ca3af',
} as const

export const profitFactorColor = (
    pf: number,
    saturation = 45,
    lightness = 55
): string => {
    const clamped = pf === Infinity ? 999 : pf
    let hue: number
    if (clamped < 1) {
        hue = 30
    } else if (clamped <= 3) {
        hue = 30 + ((clamped - 1) / 2) * 90
    } else {
        hue = 120
    }
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`
}

// --- Axis scale ---

export type AxisBounds = {
    axisMin: number
    axisMax: number
    minVal: number
    maxVal: number
    step: number
    logMin: number
    logMinNeg: number
}

export const computeAxisBounds = (finiteVals: number[]): AxisBounds => {
    if (finiteVals.length === 0)
        return {
            axisMin: 0,
            axisMax: 1,
            minVal: 0,
            maxVal: 1,
            step: 1,
            logMin: 0,
            logMinNeg: 0,
        }
    const minVal = Math.min(...finiteVals)
    const maxVal = Math.max(...finiteVals)
    const step = (maxVal - minVal) / 8 || Math.abs(maxVal) || 1
    const allPositive = finiteVals.every((v) => v >= 0)
    const allNegative = finiteVals.every((v) => v <= 0)
    const axisMin = allPositive ? 0 : minVal - step
    const axisMax = allNegative ? 0 : maxVal + step
    const positiveVals = finiteVals.filter((v) => v > 0)
    const negativeVals = finiteVals.filter((v) => v < 0)
    const logMin =
        positiveVals.length > 0 ? Math.log(Math.min(...positiveVals)) : 0
    const logMinNeg =
        negativeVals.length > 0
            ? Math.log(Math.abs(Math.max(...negativeVals)))
            : 0
    return { axisMin, axisMax, minVal, maxVal, step, logMin, logMinNeg }
}

export const scaleValue = (
    val: number,
    bounds: AxisBounds,
    _useLog: boolean
): number => {
    const { axisMin, axisMax } = bounds
    if (val === Infinity || val === -Infinity) return axisMax
    if (isNaN(val)) return axisMin
    if (val > axisMax) return axisMax
    if (val < axisMin) return axisMin
    return val
}

export const makeAxisLabel =
    (bounds: AxisBounds, _useLog: boolean, formatFn: (v: number) => string) =>
    (v: number) =>
        formatFn(v)
