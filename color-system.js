/**
 * INVESTMENT VALUATION APP - COLOR SYSTEM UTILITIES
 * Helper functions to apply colors based on valuation scores and changes
 */

/**
 * Get valuation badge class based on score (0-10)
 * @param {number} score - Valuation score between 0-10
 * @returns {string} - CSS class name for the badge
 */
function getValuationBadgeClass(score) {
  if (score <= 2) return 'badge-very-cheap';
  if (score <= 4) return 'badge-cheap';
  if (score <= 6) return 'badge-fair';
  if (score <= 8) return 'badge-expensive';
  return 'badge-very-expensive';
}

/**
 * Get valuation badge text based on score
 * @param {number} score - Valuation score between 0-10
 * @returns {string} - Human readable label
 */
function getValuationLabel(score) {
  if (score <= 2) return 'Very Cheap';
  if (score <= 4) return 'Cheap';
  if (score <= 6) return 'Fair';
  if (score <= 8) return 'Expensive';
  return 'Very Expensive';
}

/**
 * Get price change color class based on percentage
 * @param {number} changePercent - Percentage change (positive or negative)
 * @returns {string} - CSS class name
 */
function getPriceChangeClass(changePercent) {
  return changePercent >= 0 ? 'change-positive' : 'change-negative';
}

/**
 * Format price change as string with sign
 * @param {number} changePercent - Percentage change
 * @returns {string} - Formatted string e.g., "+1.2%" or "−0.2%"
 */
function formatPriceChange(changePercent) {
  const sign = changePercent >= 0 ? '+' : '−';
  return `${sign}${Math.abs(changePercent).toFixed(1)}%`;
}

/**
 * Color codes for signal bars and metrics
 * Use these for dynamic styling of charts and indicators
 */
const colorSystem = {
  valuations: {
    veryCheap: '#10B981',
    cheap: '#34D399',
    fair: '#F59E0B',
    expensive: '#EF4444',
    veryExpensive: '#DC2626',
  },
  changes: {
    positive: '#10B981',
    negative: '#EF4444',
  },
  neutral: {
    primary: '#1A1A1A',
    secondary: '#666666',
    tertiary: '#999999',
    bg: '#FAFAF9',
  },
};
