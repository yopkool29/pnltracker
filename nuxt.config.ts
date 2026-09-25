// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    compatibilityDate: '2024-11-01',
    // Dossiers non-source exclus du watcher vite/nuxt (chokidar) :
    // - tauri-cef-linux : symlinks auto-référents quick-sharun (ELOOP)
    //   + target/ ~20 GB d'artifacts rust
    // - src-tauri/target : ~17 GB d'artifacts rust (42k fichiers watchés)
    // - pnltracker-tools/-private : scripts invoqués à l'exécution
    //   (spawn subprocess, pas des imports)
    // - .cache / temp : caches et exports runtime
    ignore: [
        'tauri-cef-linux/**',
        'src-tauri/target/**',
        'pnltracker-tools/**',
        'pnltracker-private-tools/**',
        '.cache/**',
        'temp/**',
    ],
    devServer: {
        port: 3001,
    },

    modules: [
        '@nuxt/ui',
        '@nuxt/eslint',
        '@nuxt/fonts',
        '@nuxt/icon',
        '@nuxt/image',
        '@nuxt/scripts',
        '@pinia/nuxt',
        'pinia-plugin-persistedstate/nuxt',
        '@nuxtjs/color-mode',
        'nuxt-zod-i18n',
        '@nuxtjs/i18n'
    ],

    imports: {
        dirs: [
            'composables',
            'composables/**',
        ],
    },

    components: [
        {
            path: '~/components',
            ignore: ['**/old/**'],
        },
        {
            path: '~/old',
            ignore: ['**/*'],
        },
    ],

    fonts: {
        providers: {
            fontshare: false
        }
    },

    devtools: {
        enabled: true,
        // timeline: {
        //     enabled: true
        // }
    },

    experimental: {
        appManifest: process.env.VITEST !== 'true',
        asyncContext: true,
    },

    vite: {
        optimizeDeps: {
            include: [
                '@internationalized/date',
                'vue-chartjs',
                'lightweight-charts',
                'chart.js',
                'echarts',
                'vue-echarts',
                '@milkdown/core',
                '@milkdown/ctx',
                '@milkdown/prose',
                '@milkdown/utils',
                '@milkdown/transformer',
                '@fontsource/inter',
                '@fontsource/jetbrains-mono',
                '@fontsource/geist',
                '@fontsource/plus-jakarta-sans',
                '@fontsource/archivo',
                '@fontsource/source-sans-3',
            ]
        },
        resolve: {
            alias: [
                { find: 'element-resize-detector', replacement: '~/shims/element-resize-detector.js' },
                // Redirige les imports @milkdown/kit/* vers les vrais packages.
                // customResolver repasse par la résolution normale vite (exports
                // map des packages) — nécessaire pour les sous-chemins CSS
                // (kit/prose/view/style/x.css → prose/lib/style/x.css) et évite
                // le warning "not an absolute path" / modules dupliqués.
                {
                    find: /^@milkdown\/kit\/(utils|ctx|transformer|core|prose)(.*)/,
                    replacement: '@milkdown/$1$2',
                    customResolver(id: string, importer: string | undefined) {
                        return this.resolve(id, importer, { skipSelf: true })
                    },
                },
            ],
            dedupe: [
                '@milkdown/core',
                '@milkdown/ctx',
                '@milkdown/utils',
                '@milkdown/transformer',
                '@milkdown/prose',
            ]
        },
        server: {
            allowedHosts: [
                '.ngrok-free.dev',
                '.ngrok.io'
            ]
        },
        ssr: {
            noExternal: ['vue', 'vue-router']
        },
        build: {
            chunkSizeWarningLimit: 1000,
            rollupOptions: {
                output: {
                    manualChunks: (id) => {
                        // Charts libraries
                        if (id.includes('chart.js') || id.includes('vue-chartjs') || id.includes('lightweight-charts') || id.includes('echarts') || id.includes('vue-echarts') || id.includes('zrender')) {
                            return 'charts'
                        }
                        // Milkdown editor
                        if (id.includes('@milkdown')) {
                            return 'editor'
                        }
                        // Date libraries
                        if (id.includes('date-fns') || id.includes('@internationalized/date')) {
                            return 'dates'
                        }
                        // Dashboard chart components
                        if (id.includes('/dashboard/') && (
                            id.includes('Winrate') ||
                            id.includes('Chart') ||
                            id.includes('Pnl') ||
                            id.includes('Pie')
                        )) {
                            return 'dashboard-charts'
                        }
                    }
                }
            }
        }
    },

    sourcemap: {
        server: false,
        client: false
        // server: process.env.NODE_ENV !== 'production',
        // client: process.env.NODE_ENV !== 'production'
    },

    routeRules: {
        '/': { ssr: true },
        '/**': { ssr: false },
    },

    debug: false,

    app: {
        head: {
            title: 'PnlTracker - Journal de Trading',
            meta: [
                { charset: 'utf-8' },
                { name: 'viewport', content: 'width=device-width, initial-scale=1' },
                { name: 'description', content: 'PnlTracker - Votre journal de trading pour suivre et analyser vos performances' }
            ],
            link: [
                { rel: 'icon', type: 'image/svg+xml', href: '/img/favicon.svg' }
            ],
            script: [
                {
                    // Appliquer les thèmes custom (dark-gold, light-blue) avant le paint
                    // dark-gold nécessite aussi la classe .dark (html.dark.dark-gold dans le CSS)
                    innerHTML: `(function(){try{var t=localStorage.getItem('nuxt-color-mode');if(t==='dark-gold'){document.documentElement.classList.add('dark');document.documentElement.classList.add('dark-gold');}if(t==='light-blue')document.documentElement.classList.add('light-blue');}catch(e){}})();`,
                    tagPosition: 'head',
                    tagPriority: -1
                }
            ]
        }
    },

    i18n: {
        locales: [
            { code: 'en', iso: 'en-US', file: 'en.js' },
            { code: 'fr', iso: 'fr-FR', file: 'fr.js' },
        ],
        defaultLocale: 'en',
        lazy: true,
        langDir: 'locales',
        strategy: 'no_prefix',
        bundle: {
            optimizeTranslationDirective: false,
        }
    },
    icon: {
        clientBundle: {
            scan: true,
            collections: ['heroicons', 'lucide']
        },
    },

    runtimeConfig: {
        public: {
            maxScreenshots: 9,
            maxFileSize: 10 * 1024 * 1024, // 10MB
            debugMode: process.env.DEBUG_MODE === 'true',
            quantowerEnable: process.env.QUANTOWER_ENABLE === 'true',
            appTagVersion: process.env.APP_VERSION,
            enableRouteLogger: false,
            enableApiLogger: process.env.DEBUG_MODE === 'true',
            pluginsEnabled: process.env.PLUGINS_ENABLED === 'true',
            showLogView: process.env.SHOW_LOG_VIEW === 'true',
            tradeCountThreshold: 1000,
            logoutHardReload: process.env.LOGOUT_HARD_RELOAD !== 'false',
        }
    },

    // image: {
    //     providers: {
    //         selfproxyhost: {
    //             name: 'selfproxyhost',
    //             provider: '~/providers/selfproxyhost.ts',
    //             options: {
    //             },
    //         },
    //         selfhost: {
    //             name: 'selfhost',
    //             provider: '~/providers/selfhost.ts',
    //             options: {
    //             },
    //         },
    //     },
    // },

    css: ['~/assets/css/main.css', '~/assets/css/milkdown-global.scss'],

    colorMode: {
        classSuffix: '',
        preference: 'light',
        fallback: 'light',
    },
    nitro: {
        esbuild: {
            options: {
                target: 'es2020'
            }
        },
        experimental: {
            wasm: false
        },
        externals: {
            inline: ['xlsx'],
            external: ['@prisma/client', 'prisma', '.prisma/client', '@prisma/client/runtime/library'],
            // Windows: skip @vercel/nft file tracing (40x slower + creates broken symlinks EISDIR).
            // Dependencies are installed via npm install --omit=dev in prepare-tauri-runtime.ts instead.
            // See https://github.com/nuxt/nuxt/issues/34753
            ...(process.platform === 'win32' ? { trace: false } : {}),
        },
        compressPublicAssets: {
            gzip: true,
            brotli: true
        },
        publicAssets: [
            {
                dir: 'upload',
                baseURL: '/upload'
            }
        ]
    },
    typescript: {
        tsConfig: {
            compilerOptions: {
                sourceMap: false
            }
        }
    }
})