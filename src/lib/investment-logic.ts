/**
 * Investment yield & Marketplace validation logic
 */

export function calculateAccumulatedProfit(
  investedAmount: number,
  dailyProfitPercent: number,
  lastClaimedAt: number,
  now: number
): number {
  if (investedAmount <= 0 || dailyProfitPercent <= 0) return 0;
  const elapsedMs = Math.max(0, now - lastClaimedAt);
  const oneDayMs = 24 * 60 * 60 * 1000;
  
  // Continuous yield accumulation down to the minute
  const profit = Math.floor(investedAmount * (dailyProfitPercent / 100) * (elapsedMs / oneDayMs));
  return Math.max(0, profit);
}

export function calculateDailyProfit(
  investedAmount: number,
  dailyProfitPercent: number
): number {
  if (investedAmount <= 0 || dailyProfitPercent <= 0) return 0;
  return Math.floor(investedAmount * (dailyProfitPercent / 100));
}

export function validateMarketplaceListingPrice(
  originalCost: number,
  askingPrice: number
): { isValid: boolean; error?: string } {
  if (isNaN(askingPrice) || askingPrice <= 0) {
    return { isValid: false, error: 'Price must be greater than zero' };
  }
  const minPrice = Math.floor(originalCost * 0.2); // At least 20% of original cost
  const maxPrice = Math.floor(originalCost * 5.0); // Maximum 500% of original cost

  if (askingPrice < minPrice) {
    return { isValid: false, error: `Price cannot be below ${minPrice.toLocaleString()} (minimum 20% of value)` };
  }
  if (askingPrice > maxPrice) {
    return { isValid: false, error: `Price cannot exceed ${maxPrice.toLocaleString()} (maximum 500% of value)` };
  }

  return { isValid: true };
}
