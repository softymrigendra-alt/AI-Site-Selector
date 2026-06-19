// All ROI math lives here — LLM never touches these numbers

export const CHARGER_CONFIG = {
  'Level 2 AC': {
    hardwareCost: 1200,
    installCost: 3000,
    revenuePerSession: 8,
    sessionsPerDay: 3,
    monthlyMaintenance: 50,
  },
  'DC Fast': {
    hardwareCost: 25000,
    installCost: 15000,
    revenuePerSession: 18,
    sessionsPerDay: 8,
    monthlyMaintenance: 250,
  },
  'Ultra-Fast': {
    hardwareCost: 75000,
    installCost: 35000,
    revenuePerSession: 28,
    sessionsPerDay: 12,
    monthlyMaintenance: 500,
  },
};

const SITE_PREP_COST = 5000;
const PERMIT_COST = 2500;
const UTILIZATION_RATE = 0.65;
const MONTHLY_SOFTWARE_FEE = 30; // per charger

/**
 * @param {object} input
 * @param {string} input.chargerType  - one of the CHARGER_CONFIG keys
 * @param {number} input.targetChargers
 * @returns {{ totalSetupCost, monthlyGrossRevenue, monthlyNetRevenue, breakEvenMonths, year1NetProfit, year3NetProfit, year5NetProfit }}
 */
export function calculateROI(input) {
  const { chargerType, targetChargers } = input;
  const cfg = CHARGER_CONFIG[chargerType];
  if (!cfg) throw new Error(`Unknown charger type: ${chargerType}`);

  const n = Number(targetChargers);

  const totalSetupCost =
    (cfg.hardwareCost + cfg.installCost) * n + SITE_PREP_COST + PERMIT_COST;

  const monthlyGrossRevenue =
    n * cfg.revenuePerSession * cfg.sessionsPerDay * 30 * UTILIZATION_RATE;

  const monthlyOpEx =
    (cfg.monthlyMaintenance + MONTHLY_SOFTWARE_FEE) * n;

  const monthlyNetRevenue = monthlyGrossRevenue - monthlyOpEx;

  const breakEvenMonths =
    monthlyNetRevenue > 0 ? totalSetupCost / monthlyNetRevenue : Infinity;

  const yearNProfit = (years) =>
    monthlyNetRevenue * years * 12 - totalSetupCost;

  return {
    totalSetupCost,
    monthlyGrossRevenue,
    monthlyNetRevenue,
    breakEvenMonths,
    year1NetProfit: yearNProfit(1),
    year3NetProfit: yearNProfit(3),
    year5NetProfit: yearNProfit(5),
  };
}

export function formatCurrency(n) {
  if (!isFinite(n)) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatMonths(n) {
  if (!isFinite(n)) return 'Never';
  if (n < 1) return '< 1 month';
  const years = Math.floor(n / 12);
  const months = Math.round(n % 12);
  if (years === 0) return `${months} mo`;
  if (months === 0) return `${years} yr`;
  return `${years} yr ${months} mo`;
}
