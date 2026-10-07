import {
    ColorType,
    type ISeriesApi,
    type UTCTimestamp,
    LineSeries,
} from 'lightweight-charts'
import type { PolygonBar } from '~/utils/polygonSymbol'

export const useTradeChartHelpers = () => {
	const isDark = useIsDark()

	const getChartColors = (dark?: boolean) => {
		const darkMode = dark ?? isDark.value
		return {
			background: darkMode
				? { type: ColorType.Solid, color: '#1e1e1e' }
				: { type: ColorType.VerticalGradient, topColor: '#e5e7eb', bottomColor: '#f3f4f6' },
			textColor: darkMode ? '#d1d5db' : '#333',
			gridColor: darkMode ? '#2d2d2d' : '#e1e1e1',
			upColor: darkMode ? '#22c55e' : '#26a69a',
			downColor: darkMode ? '#ef4444' : '#ef5350',
			buyColor: darkMode ? '#4ade80' : '#16a34a',
			sellColor: darkMode ? '#f87171' : '#dc2626',
			exitColor: darkMode ? '#facc15' : '#d97706',
			lineColor: darkMode ? '#60a5fa' : '#2563eb',
		}
	}

	const findBarIndex = (data: PolygonBar[], timestamp: number): number => {
		let result = -1
		for (let i = 0; i < data.length; i++) {
			if (data[i].time <= timestamp) {
				result = i
			} else {
				break
			}
		}
		if (result !== -1) return result
		return 0
	}

	const isInRange = (data: PolygonBar[], timestamp: number): boolean => {
		if (data.length === 0) return false
		return timestamp >= data[0].time && timestamp <= data[data.length - 1].time
	}

	const priceSegmentPadding = 2

	const addPriceSegment = (
		chart: ReturnType<typeof import('lightweight-charts').createChart>,
		data: PolygonBar[],
		barIdx: number,
		price: number,
		color: string,
		priceSegments: ISeriesApi<'Line'>[],
	): ISeriesApi<'Line'>[] => {
		const fromIdx = Math.max(0, barIdx - priceSegmentPadding)
		const toIdx = Math.min(data.length - 1, barIdx + priceSegmentPadding)
		const segment = chart.addSeries(LineSeries, {
			color,
			lineWidth: 2,
			crosshairMarkerVisible: false,
			lastValueVisible: false,
			priceLineVisible: false,
			pointMarkersVisible: false,
		})
		segment.setData([
			{ time: data[fromIdx].time as UTCTimestamp, value: price },
			{ time: data[toIdx].time as UTCTimestamp, value: price },
		])
		return [...priceSegments, segment]
	}

	const clearPriceSegments = (
		chart: ReturnType<typeof import('lightweight-charts').createChart> | null,
		priceSegments: ISeriesApi<'Line'>[],
	): ISeriesApi<'Line'>[] => {
		if (!chart) return []
		for (const series of priceSegments) {
			chart.removeSeries(series)
		}
		return []
	}

	const getVisibleBarsForTf = (tfMinutes: number): number => {
		if (tfMinutes <= 1) return 500
		if (tfMinutes <= 5) return 300
		if (tfMinutes <= 15) return 200
		if (tfMinutes <= 60) return 120
		return 100
	}

	return {
		getChartColors,
		findBarIndex,
		isInRange,
		addPriceSegment,
		clearPriceSegments,
		getVisibleBarsForTf,
	}
}
