// Tableau de conversion des points en dollars pour les contrats futures
export const symbolPricePerPoint = {
    // Contrats standards
    'ES': 50,    // S&P 500
    'NQ': 20,    // NASDAQ
    'YM': 5,     // Dow Jones
    'RTY': 5,    // Russell 2000
    'CL': 1000,  // Crude Oil
    'GC': 100,   // Gold
    'SI': 5000,  // Silver

    // Mini contrats
    'MES': 5,    // Micro E-mini S&P 500 (1/10 de ES)
    'MNQ': 2,    // Micro E-mini NASDAQ (1/10 de NQ)
    'MYM': 0.5,  // Micro E-mini Dow Jones (1/10 de YM)
    'M2K': 0.5,  // Micro E-mini Russell 2000 (1/10 de RTY)
    'MCL': 100,  // Micro Crude Oil (1/10 de CL)
    'MGC': 10,   // Micro Gold (1/10 de GC)
    'SIL': 500,  // Micro Silver (1/10 de SI)

    // E-mini contrats
    'EMD': 100,  // E-mini S&P MidCap 400
    'QM': 500,   // E-mini Crude Oil (1/2 de CL)

    // Autres contrats populaires
    'ZB': 1000,  // 30-Year U.S. Treasury Bond
    'ZN': 1000,  // 10-Year U.S. Treasury Note
    'ZF': 1000,  // 5-Year U.S. Treasury Note
    '6E': 125000, // Euro FX
    '6J': 12500,  // Japanese Yen
    '6B': 62500,  // British Pound
    '6C': 100000, // Canadian Dollar
    '6A': 100000, // Australian Dollar
};
