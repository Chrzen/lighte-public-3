// src/app/utils/quoteUtils.js

/**
 * Calculates the total value of a quote.
 * @param {object} quote The quote object.
 * @returns {Promise<number>} The total value.
 */
async function calculateQuoteTotal(quote) {
    if (!quote || !quote.items) return 0;
    const total = quote.items.reduce((sum, item) => sum + item.lineTotal, 0);
    return total.toFixed(2); // Return as a string with 2 decimal places
}

module.exports = {
    calculateQuoteTotal
};