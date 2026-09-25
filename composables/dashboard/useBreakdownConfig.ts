import type { BreakdownBaseKey, BreakdownConfig, BreakdownDimension, BreakdownMetric, TimeSeriesConfig, WorkspaceConfig, DashboardGridItem } from '~/type'
import { generateBreakdownKey, getBreakdownChartType, getBreakdownBaseKey } from '~/type'
import { defaultConfigByType, defaultGridSize, getTemplateById } from '~/composables/dashboard/breakdownTemplates'

// Construit le patch workspace pour les 3 breakpoints (lg/md/sm) :
// visFn transforme chaque map de visibilité, layoutFn chaque layout.
const forEachBreakpoint = (
	workspace: WorkspaceConfig | undefined | null,
	visFn: (vis: Record<string, boolean>) => Record<string, boolean>,
	layoutFn: (layout: DashboardGridItem[], bp: 'Lg' | 'Md' | 'Sm') => DashboardGridItem[]
) => ({
	dashboardChartVisibilityLg: visFn(workspace?.dashboardChartVisibilityLg || {}),
	dashboardChartVisibilityMd: visFn(workspace?.dashboardChartVisibilityMd || {}),
	dashboardChartVisibilitySm: visFn(workspace?.dashboardChartVisibilitySm || {}),
	dashboardGridLayout: layoutFn(workspace?.dashboardGridLayout || [], 'Lg'),
	dashboardGridLayoutMd: layoutFn(workspace?.dashboardGridLayoutMd || [], 'Md'),
	dashboardGridLayoutSm: layoutFn(workspace?.dashboardGridLayoutSm || [], 'Sm'),
})

// Composable pour gérer la config d'une instance de widget breakdown
// itemId = clé unique (ex: 'breakdownBar_a3f_1699999999')
export const useBreakdownConfig = (itemId: string) => {
	const { activeWorkspace, updateActiveWorkspace } = useDashboardWorkspace()

	// Détecte le chartType depuis le préfixe de la clé
	const chartType = computed(() => getBreakdownChartType(itemId) || 'bar')

	// Récupère la config persistée pour cet item, ou une config par défaut selon le type
	const config = computed<BreakdownConfig | TimeSeriesConfig>(() => {
		const configs = activeWorkspace.value?.breakdownConfigs
		const saved = configs?.[itemId]
		if (saved) return saved
		// Config par défaut selon le préfixe
		const baseKey = getBreakdownBaseKey(itemId) || 'breakdownBar'
		return defaultConfigByType[baseKey] || { dimension: 'ticker', metric: 'pnl', chartType: 'bar' }
	})

	// Met à jour la config et persiste
	const updateConfig = (patch: Partial<BreakdownConfig>) => {
		const currentConfigs = activeWorkspace.value?.breakdownConfigs || {}
		const newConfig = { ...config.value, ...patch }
		const newConfigs = { ...currentConfigs, [itemId]: newConfig }
		updateActiveWorkspace({ breakdownConfigs: newConfigs } as Partial<WorkspaceConfig>)
	}

	const setDimension = (dimension: BreakdownDimension) => updateConfig({ dimension })
	const setMetric = (metric: BreakdownMetric) => updateConfig({ metric })

	return {
		config,
		chartType,
		setDimension,
		setMetric,
		updateConfig,
	}
}

// Composable pour gérer les instances de breakdown (création, suppression, listing)
export const useBreakdownInstances = () => {
	const { activeWorkspace, updateActiveWorkspace } = useDashboardWorkspace()

	// Liste toutes les clés d'instances de breakdown existantes (depuis breakdownConfigs + visibilité + layout)
	const instanceKeys = computed<string[]>(() => {
		const keys = new Set<string>()
		const configs = activeWorkspace.value?.breakdownConfigs || {}
		Object.keys(configs).forEach(k => keys.add(k))
		// Aussi depuis les visibilités (au cas où la config n'existerait pas encore)
		const vis = activeWorkspace.value?.dashboardChartVisibilityLg || {}
		Object.keys(vis).forEach(k => {
			if (getBreakdownChartType(k)) keys.add(k)
		})
		return Array.from(keys)
	})

	// Liste les instances par type de base
	const instancesByType = computed<Record<BreakdownBaseKey, string[]>>(() => {
		const result: Record<BreakdownBaseKey, string[]> = {
			breakdownBar: [],
			breakdownBarVertical: [],
			breakdownScatter: [],
			breakdownScatter2D: [],
			breakdownScatterTrades: [],
			breakdownTable: [],
			breakdownHeatmap: [],
			breakdownBoxplot: [],
			breakdownCalendar: [],
			breakdownRadar: [],
			timeSeries: [],
		}
		for (const key of instanceKeys.value) {
			const baseKey = getBreakdownBaseKey(key)
			if (baseKey) result[baseKey].push(key)
		}
		return result
	})

	// Crée une nouvelle instance de breakdown
	const createInstance = (baseKey: BreakdownBaseKey): string => {
		const newKey = generateBreakdownKey(baseKey)
		const config = defaultConfigByType[baseKey]
		const size = defaultGridSize[baseKey]

		// 1. Ajoute la config
		const currentConfigs = activeWorkspace.value?.breakdownConfigs || {}
		const newConfigs = { ...currentConfigs, [newKey]: config }

		// 2. Ajoute à la visibilité (visible par défaut sur les 3 breakpoints)
		// 3. Ajoute au grid layout (à la fin, position auto ; sm = pleine largeur 3)
		const newItem: DashboardGridItem = { w: size.w, h: size.h, x: 0, y: 0, i: newKey }
		updateActiveWorkspace({
			breakdownConfigs: newConfigs,
			...forEachBreakpoint(
				activeWorkspace.value,
				vis => ({ ...vis, [newKey]: true }),
				(layout, bp) => [...layout, { ...newItem, w: bp === 'Sm' ? 3 : size.w }]
			),
		} as Partial<WorkspaceConfig>)

		return newKey
	}

	// Crée une nouvelle instance depuis un template pré-configuré
	const createFromTemplate = (templateId: string): string | null => {
		const template = getTemplateById(templateId)
		if (!template) return null
		const newKey = generateBreakdownKey(template.baseKey)
		// Merge : config par défaut du type + override du template
		const baseConfig = defaultConfigByType[template.baseKey]
		const config: BreakdownConfig = { ...baseConfig, ...template.config } as BreakdownConfig
		const size = defaultGridSize[template.baseKey]

		const currentConfigs = activeWorkspace.value?.breakdownConfigs || {}
		const newConfigs = { ...currentConfigs, [newKey]: config }

		const newItem: DashboardGridItem = { w: size.w, h: size.h, x: 0, y: 0, i: newKey }
		updateActiveWorkspace({
			breakdownConfigs: newConfigs,
			...forEachBreakpoint(
				activeWorkspace.value,
				vis => ({ ...vis, [newKey]: true }),
				(layout, bp) => [...layout, { ...newItem, w: bp === 'Sm' ? 3 : size.w }]
			),
		} as Partial<WorkspaceConfig>)

		return newKey
	}

	// Supprime une instance de breakdown
	const deleteInstance = (key: string) => {
		// 1. Retire la config
		const currentConfigs = { ...(activeWorkspace.value?.breakdownConfigs || {}) }
		const { [key]: _omit, ...restConfigs } = currentConfigs

		// 2. Retire des visibilités + du grid layout sur les 3 breakpoints
		const removeKey = (obj: Record<string, boolean>) => {
			const { [key]: _o, ...rest } = obj
			return rest
		}
		updateActiveWorkspace({
			breakdownConfigs: restConfigs,
			...forEachBreakpoint(
				activeWorkspace.value,
				removeKey,
				layout => layout.filter(item => item.i !== key)
			),
		} as Partial<WorkspaceConfig>)
	}

	return {
		instanceKeys,
		instancesByType,
		createInstance,
		createFromTemplate,
		deleteInstance,
	}
}
