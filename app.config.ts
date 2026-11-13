export default defineAppConfig({
	// Configuration des graphiques
	charts: {
		chartjs: false,
		options: {
			canvasHeight: 200,
			// Options communes pour tous les graphiques
			barPercentage: 0.6,
			borderRadius: 2,
			tension: 0.4, // Pour les lignes courbes
			pointRadius: 2,
			// Options spécifiques pour certains types de graphiques
			winrate: {
				max: 100, // Valeur maximale pour l'axe Y du graphique Winrate
				format: (value: number) => value + '%', // Formattage des valeurs
			},
			pnlBarChart: {
				maxTrades: 100, // Nombre maximum de trades à afficher dans le graphique P&L History
			},
			tickerChart: {
				maxTickers: 30, // Nombre maximum de tickers à afficher
			},
		},
	},
	ui: {
		colors: {
			// primary: 'green',
			primary: 'emerald',
			neutral: 'slate',
		},
		// Overlay sombre dans tous les thèmes — le défaut bg-elevated/75 est
		// blanc en light mode (effet blanchi). Assombrit comme en dark mode.
		// app-modal-overlay permet à main.css de n'assombrir que le 1er overlay
		// (modales empilées) au lieu de cumuler l'opacité.
		modal: {
			slots: {
				overlay: 'bg-black/50 app-modal-overlay',
			},
		},
		slideover: {
			slots: {
				overlay: 'bg-black/50 app-modal-overlay',
			},
		},
		drawer: {
			slots: {
				overlay: 'bg-black/50 app-modal-overlay',
			},
		},
		formField: {
			slots: {
				error: 'font-semibold text-red-500',
			},
		},
		collapsible: {
			slots: {
				content:
					'data-[state=open]:animate-[collapsible-down_10ms_ease-out] data-[state=closed]:animate-[collapsible-up_10ms_ease-out] ',
			},
		},
		badge: {
			slots: {},
		},
		tooltip: {
			slots: {
				content: 'data-[state=closed]:animate-none',
			},
		},
		button: {
			slots: {
				base: 'cursor-pointer user-select: none transition-transform hover:scale-105',
			},
		},
		alert: {
			slots: {
				description: 'font-semibold',
			}
		},
		tabs: {
			slots: {
				// trigger: 'hover:text-primary-600',
			},
		},
		card: {
			variants: {
				variant: {
					subtle: {
						root: 'light:bg-gradient-to-br light:from-gray-100 light:to-gray-50 dark:bg-slate-900/50 border-gray-500 dark:border-slate-800'
					}
				}
			}
		}
	},
})
