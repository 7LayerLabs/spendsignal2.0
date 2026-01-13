// Spending Insights Generator
// Generates personalized, actionable spending advice

import type { TrafficLightZone } from '@/constants/traffic-light';

interface Transaction {
  id: string;
  amount: number;
  merchantName: string | null;
  description: string;
  date: Date | string;
  defaultCategory: string | null;
}

interface Categorization {
  transactionId: string;
  zone: TrafficLightZone;
}

interface SpendingInsight {
  type: 'warning' | 'tip' | 'win' | 'action';
  title: string;
  message: string;
  impact?: string;
  priority: number; // 1-10, higher = more important
}

interface CategorySpending {
  category: string;
  total: number;
  count: number;
  zone: TrafficLightZone;
}

/**
 * Generate personalized spending insights
 */
export function generateInsights(
  transactions: Transaction[],
  categorizations: Categorization[],
  monthlyIncome?: number
): SpendingInsight[] {
  const insights: SpendingInsight[] = [];
  const categorizationMap = new Map(categorizations.map(c => [c.transactionId, c.zone]));

  // Calculate totals by zone
  let greenTotal = 0, yellowTotal = 0, redTotal = 0;
  let greenCount = 0, yellowCount = 0, redCount = 0;

  // Track spending by category
  const categorySpending = new Map<string, CategorySpending>();

  // Track merchants
  const merchantSpending = new Map<string, { total: number; count: number; zone: TrafficLightZone | null }>();

  transactions.forEach(txn => {
    const zone = categorizationMap.get(txn.id);
    const amount = Number(txn.amount);
    const merchant = txn.merchantName?.toLowerCase() || txn.description.toLowerCase();
    const category = txn.defaultCategory || 'Uncategorized';

    // Update merchant tracking
    const existing = merchantSpending.get(merchant) || { total: 0, count: 0, zone: null };
    merchantSpending.set(merchant, {
      total: existing.total + amount,
      count: existing.count + 1,
      zone: zone || existing.zone,
    });

    // Update category tracking
    if (zone) {
      const catExisting = categorySpending.get(category) || { category, total: 0, count: 0, zone };
      categorySpending.set(category, {
        ...catExisting,
        total: catExisting.total + amount,
        count: catExisting.count + 1,
      });
    }

    if (zone === 'GREEN') {
      greenTotal += amount;
      greenCount++;
    } else if (zone === 'YELLOW') {
      yellowTotal += amount;
      yellowCount++;
    } else if (zone === 'RED') {
      redTotal += amount;
      redCount++;
    }
  });

  const totalSpending = greenTotal + yellowTotal + redTotal;
  const totalCategorized = greenCount + yellowCount + redCount;

  // === CRITICAL WARNINGS ===

  // Red zone over 20%
  if (totalSpending > 0 && redTotal / totalSpending > 0.2) {
    const redPercent = Math.round((redTotal / totalSpending) * 100);
    insights.push({
      type: 'warning',
      title: 'Red Zone Alert',
      message: `${redPercent}% of your spending is in the Red Zone. Every dollar here is money you'll never see again.`,
      impact: `$${redTotal.toFixed(0)} wasted this period`,
      priority: 10,
    });
  }

  // Yellow + Red over 50%
  if (totalSpending > 0 && (yellowTotal + redTotal) / totalSpending > 0.5) {
    insights.push({
      type: 'warning',
      title: 'Discretionary Spending Too High',
      message: 'More than half your money is going to wants, not needs. You\'re trading future freedom for present comfort.',
      priority: 9,
    });
  }

  // === SPECIFIC CATEGORY CALLOUTS ===

  // Coffee shop spending
  const coffeeSpending = Array.from(merchantSpending.entries())
    .filter(([m]) => m.includes('starbucks') || m.includes('dunkin') || m.includes('coffee'))
    .reduce((sum, [, data]) => sum + data.total, 0);

  if (coffeeSpending > 50) {
    const yearlyProjection = coffeeSpending * 4; // Assuming monthly data
    insights.push({
      type: 'action',
      title: 'Coffee Shop Habit',
      message: `$${coffeeSpending.toFixed(0)} on coffee shops. Make coffee at home and invest the difference.`,
      impact: `$${yearlyProjection.toFixed(0)}/year if this continues`,
      priority: 7,
    });
  }

  // Delivery app spending
  const deliverySpending = Array.from(merchantSpending.entries())
    .filter(([m]) => m.includes('doordash') || m.includes('uber eats') || m.includes('grubhub') || m.includes('postmates'))
    .reduce((sum, [, data]) => sum + data.total, 0);

  if (deliverySpending > 0) {
    insights.push({
      type: 'action',
      title: 'Delivery App Drain',
      message: `$${deliverySpending.toFixed(0)} on delivery apps. The fees alone could fund a nice home-cooked meal.`,
      impact: 'Delivery fees typically add 30-40% to food cost',
      priority: 8,
    });
  }

  // Fast food spending
  const fastFoodSpending = Array.from(merchantSpending.entries())
    .filter(([m]) => m.includes('mcdonald') || m.includes('burger king') || m.includes('wendy') || m.includes('taco bell'))
    .reduce((sum, [, data]) => sum + data.total, 0);

  if (fastFoodSpending > 100) {
    insights.push({
      type: 'warning',
      title: 'Fast Food Adding Up',
      message: `$${fastFoodSpending.toFixed(0)} on fast food. Your wallet and health both pay the price.`,
      priority: 6,
    });
  }

  // Amazon spending
  const amazonSpending = Array.from(merchantSpending.entries())
    .filter(([m]) => m.includes('amazon') || m.includes('amzn'))
    .reduce((sum, [, data]) => sum + data.total, 0);

  if (amazonSpending > 200) {
    const amazonCount = Array.from(merchantSpending.entries())
      .filter(([m]) => m.includes('amazon') || m.includes('amzn'))
      .reduce((sum, [, data]) => sum + data.count, 0);

    insights.push({
      type: 'tip',
      title: 'Amazon Impulse Check',
      message: `${amazonCount} Amazon orders totaling $${amazonSpending.toFixed(0)}. Try the 24-hour rule before clicking "Buy Now."`,
      priority: 6,
    });
  }

  // Subscription services
  const streamingSpending = Array.from(categorySpending.entries())
    .filter(([cat]) => cat.includes('Streaming') || cat.includes('Music'))
    .reduce((sum, [, data]) => sum + data.total, 0);

  if (streamingSpending > 50) {
    insights.push({
      type: 'tip',
      title: 'Subscription Stack',
      message: `$${streamingSpending.toFixed(0)} on streaming services. Are you really watching all of them?`,
      priority: 5,
    });
  }

  // Gambling
  const gamblingSpending = Array.from(merchantSpending.entries())
    .filter(([m]) => m.includes('draftkings') || m.includes('fanduel') || m.includes('bet') || m.includes('casino'))
    .reduce((sum, [, data]) => sum + data.total, 0);

  if (gamblingSpending > 0) {
    insights.push({
      type: 'warning',
      title: 'Gambling Alert',
      message: `$${gamblingSpending.toFixed(0)} on gambling. The house always wins - be honest about entertainment vs. "investing."`,
      priority: 10,
    });
  }

  // === POSITIVE REINFORCEMENT ===

  // Good green ratio
  if (totalSpending > 0 && greenTotal / totalSpending > 0.7) {
    insights.push({
      type: 'win',
      title: 'Strong Financial Discipline',
      message: `${Math.round((greenTotal / totalSpending) * 100)}% of spending on essentials. You're building real wealth habits.`,
      priority: 4,
    });
  }

  // Low red zone
  if (totalSpending > 0 && redTotal / totalSpending < 0.1 && redTotal > 0) {
    insights.push({
      type: 'win',
      title: 'Red Zone Under Control',
      message: 'Less than 10% in the Red Zone. You\'re making conscious choices about impulse spending.',
      priority: 3,
    });
  }

  // === INCOME-BASED INSIGHTS ===

  if (monthlyIncome && monthlyIncome > 0) {
    const savingsRate = ((monthlyIncome - totalSpending) / monthlyIncome) * 100;

    if (savingsRate < 10) {
      insights.push({
        type: 'warning',
        title: 'Savings Rate Critical',
        message: `Only saving ${savingsRate.toFixed(0)}% of income. Aim for at least 20% to build real financial security.`,
        priority: 9,
      });
    } else if (savingsRate >= 20) {
      insights.push({
        type: 'win',
        title: 'Great Savings Rate',
        message: `${savingsRate.toFixed(0)}% savings rate. Keep this up and financial freedom is inevitable.`,
        priority: 4,
      });
    }

    if (redTotal > monthlyIncome * 0.1) {
      insights.push({
        type: 'action',
        title: 'Red Zone vs Income',
        message: `Red Zone spending is ${((redTotal / monthlyIncome) * 100).toFixed(0)}% of your income. Cut this in half and invest the difference.`,
        impact: `$${(redTotal * 6).toFixed(0)}/year potential savings`,
        priority: 8,
      });
    }
  }

  // === UNCATEGORIZED WARNING ===

  const uncategorizedCount = transactions.length - totalCategorized;
  if (uncategorizedCount > 5) {
    insights.push({
      type: 'action',
      title: 'Complete Your Review',
      message: `${uncategorizedCount} transactions still need categorizing. Full awareness requires full data.`,
      priority: 5,
    });
  }

  // Sort by priority
  return insights.sort((a, b) => b.priority - a.priority);
}

/**
 * Get a single headline insight for the dashboard
 */
export function getHeadlineInsight(
  transactions: Transaction[],
  categorizations: Categorization[],
  monthlyIncome?: number
): SpendingInsight | null {
  const insights = generateInsights(transactions, categorizations, monthlyIncome);
  return insights.length > 0 ? insights[0] : null;
}
