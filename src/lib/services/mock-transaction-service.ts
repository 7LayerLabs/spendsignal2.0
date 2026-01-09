// Mock Transaction Service - Generates realistic demo transactions
// This allows the app to work fully without Plaid/external services

import { generateId, randomInt, randomDecimal, randomPick, weightedRandomPick } from '@/lib/utils';
import type { Transaction, TransactionSource } from '@/types';
import type { TrafficLightZone } from '@/constants/traffic-light';

// Realistic merchant data organized by typical zone
const MOCK_MERCHANTS = {
  GREEN: [
    { name: 'Whole Foods Market', category: 'Groceries', range: [45, 180] },
    { name: 'Safeway', category: 'Groceries', range: [35, 150] },
    { name: "Trader Joe's", category: 'Groceries', range: [40, 120] },
    { name: 'Costco', category: 'Groceries', range: [80, 300] },
    { name: 'PG&E', category: 'Utilities', range: [80, 200] },
    { name: 'Comcast Internet', category: 'Internet', range: [70, 100] },
    { name: 'AT&T Wireless', category: 'Phone', range: [60, 120] },
    { name: 'State Farm Insurance', category: 'Insurance', range: [120, 200] },
    { name: 'Geico Auto', category: 'Insurance', range: [100, 180] },
    { name: 'Shell Gas Station', category: 'Transportation', range: [40, 80] },
    { name: 'Chevron', category: 'Transportation', range: [45, 85] },
    { name: 'CVS Pharmacy', category: 'Healthcare', range: [15, 80] },
    { name: 'Walgreens', category: 'Healthcare', range: [12, 60] },
    { name: 'Kaiser Permanente', category: 'Healthcare', range: [20, 50] },
    { name: 'Rent Payment', category: 'Housing', range: [1500, 2800], monthly: true },
    { name: 'Water Utility', category: 'Utilities', range: [30, 80], monthly: true },
  ],
  YELLOW: [
    // Food delivery - the "I'm too tired to cook" trap
    { name: 'Uber Eats', category: 'Food Delivery', range: [22, 55] },
    { name: 'DoorDash', category: 'Food Delivery', range: [25, 65] },
    { name: 'Grubhub', category: 'Food Delivery', range: [20, 50] },
    { name: 'Postmates', category: 'Food Delivery', range: [18, 45] },
    // Streaming - the subscription creep
    { name: 'Netflix', category: 'Streaming', range: [15.99, 22.99], monthly: true },
    { name: 'Spotify', category: 'Streaming', range: [10.99, 16.99], monthly: true },
    { name: 'Hulu', category: 'Streaming', range: [7.99, 17.99], monthly: true },
    { name: 'Disney+', category: 'Streaming', range: [7.99, 13.99], monthly: true },
    { name: 'HBO Max', category: 'Streaming', range: [15.99, 15.99], monthly: true },
    { name: 'Apple Music', category: 'Streaming', range: [10.99, 16.99], monthly: true },
    { name: 'YouTube Premium', category: 'Streaming', range: [13.99, 22.99], monthly: true },
    { name: 'Paramount+', category: 'Streaming', range: [5.99, 11.99], monthly: true },
    { name: 'Peacock', category: 'Streaming', range: [5.99, 11.99], monthly: true },
    { name: 'Amazon Prime', category: 'Subscription', range: [14.99, 14.99], monthly: true },
    // Coffee - daily habit that bleeds money
    { name: 'Starbucks', category: 'Coffee', range: [5, 12] },
    { name: 'Starbucks', category: 'Coffee', range: [6, 15] }, // Duplicated for higher frequency
    { name: 'Dunkin', category: 'Coffee', range: [4, 10] },
    { name: "Peet's Coffee", category: 'Coffee', range: [5, 12] },
    // Fast food - "just grabbing something quick"
    { name: 'McDonalds', category: 'Fast Food', range: [8, 18] },
    { name: 'Chick-fil-A', category: 'Fast Food', range: [10, 22] },
    { name: 'Taco Bell', category: 'Fast Food', range: [8, 18] },
    { name: 'Wendys', category: 'Fast Food', range: [9, 16] },
    { name: 'Chipotle', category: 'Fast Casual', range: [14, 25] },
    { name: 'Panera Bread', category: 'Fast Casual', range: [12, 22] },
    { name: 'Five Guys', category: 'Fast Casual', range: [15, 25] },
    // Shopping - impulse territory
    { name: 'Target', category: 'Shopping', range: [25, 120] },
    { name: 'Amazon', category: 'Shopping', range: [12, 85] },
    { name: 'Walmart', category: 'Shopping', range: [20, 80] },
    { name: 'TJ Maxx', category: 'Shopping', range: [25, 75] },
    // Unused subscriptions - money drains
    { name: 'Planet Fitness', category: 'Fitness', range: [24.99, 24.99], monthly: true },
    { name: 'Headspace', category: 'Subscription', range: [12.99, 12.99], monthly: true },
    { name: 'Audible', category: 'Subscription', range: [14.95, 14.95], monthly: true },
    { name: 'iCloud Storage', category: 'Subscription', range: [2.99, 9.99], monthly: true },
    // Rideshare - adds up fast
    { name: 'Uber', category: 'Rideshare', range: [15, 45] },
    { name: 'Lyft', category: 'Rideshare', range: [12, 40] },
    // Entertainment
    { name: 'AMC Theatres', category: 'Entertainment', range: [18, 40] },
  ],
  RED: [
    // Late night Amazon - the classic trap
    { name: 'Amazon', category: 'Late Night Shopping', range: [20, 120] },
    { name: 'Amazon', category: 'Impulse Buy', range: [15, 75] },
    // Convenience store runs - small leaks
    { name: '7-Eleven', category: 'Convenience', range: [8, 25] },
    { name: 'Wawa', category: 'Convenience', range: [10, 30] },
    { name: 'Circle K', category: 'Convenience', range: [8, 22] },
    // Alcohol - social and solo
    { name: 'Total Wine', category: 'Alcohol', range: [25, 80] },
    { name: 'BevMo', category: 'Alcohol', range: [20, 65] },
    { name: 'Bar Tab', category: 'Nightlife', range: [35, 120] },
    { name: 'Happy Hour', category: 'Nightlife', range: [25, 60] },
    // Fast fashion - cheap but adds up
    { name: 'SHEIN', category: 'Fast Fashion', range: [25, 85] },
    { name: 'Zara', category: 'Fast Fashion', range: [40, 120] },
    { name: 'H&M', category: 'Fast Fashion', range: [30, 90] },
    { name: 'Forever 21', category: 'Fast Fashion', range: [20, 70] },
    // Beauty & self-care splurges
    { name: 'Sephora', category: 'Beauty', range: [35, 120] },
    { name: 'Ulta Beauty', category: 'Beauty', range: [25, 90] },
    // Electronics & gadgets
    { name: 'Apple Store', category: 'Electronics', range: [30, 200] },
    { name: 'Best Buy', category: 'Electronics', range: [40, 150] },
    // Gaming - microtransactions and games
    { name: 'PlayStation Store', category: 'Gaming', range: [15, 70] },
    { name: 'Steam Games', category: 'Gaming', range: [15, 60] },
    { name: 'Xbox Store', category: 'Gaming', range: [15, 70] },
    // Food delivery when too lazy (premium prices)
    { name: 'DoorDash', category: 'Lazy Meal', range: [35, 60] },
    // Vending machines & snacks
    { name: 'Vending Machine', category: 'Snacks', range: [3, 8] },
    { name: 'Gas Station Snacks', category: 'Snacks', range: [5, 15] },
    // Entertainment splurges
    { name: 'Ticketmaster', category: 'Events', range: [50, 200] },
    { name: 'StubHub', category: 'Events', range: [60, 250] },
    // Lottery & gambling (small amounts)
    { name: 'Lottery Tickets', category: 'Gambling', range: [5, 20] },
    { name: 'Scratch Offs', category: 'Gambling', range: [10, 30] },
  ],
} as const;

// Zone weights for random selection - reflects someone who NEEDS SpendSignal
// Heavy on discretionary (Yellow) and impulse (Red) spending
const ZONE_WEIGHTS = {
  GREEN: 25,
  YELLOW: 45,
  RED: 30,
};

// Merchant type definition
type MerchantData = {
  name: string;
  category: string;
  range: readonly [number, number];
  monthly?: boolean;
};

interface GenerateOptions {
  userId: string;
  startDate: Date;
  endDate: Date;
  transactionsPerDay?: { min: number; max: number };
  includeRecurring?: boolean;
}

// Generate demo transactions for a user
export function generateDemoTransactions(options: GenerateOptions): Omit<Transaction, 'createdAt' | 'updatedAt'>[] {
  const {
    userId,
    startDate,
    endDate,
    transactionsPerDay = { min: 1, max: 5 },
    includeRecurring = true,
  } = options;

  const transactions: Omit<Transaction, 'createdAt' | 'updatedAt'>[] = [];
  const currentDate = new Date(startDate);

  // Track recurring transactions to add monthly
  const recurringTransactions: Array<{
    merchant: MerchantData;
    zone: keyof typeof MOCK_MERCHANTS;
    dayOfMonth: number;
  }> = [];

  // Set up recurring transactions
  if (includeRecurring) {
    // Rent on the 1st
    recurringTransactions.push({
      merchant: MOCK_MERCHANTS.GREEN.find(m => m.name === 'Rent Payment')!,
      zone: 'GREEN',
      dayOfMonth: 1,
    });

    // Utilities around 15th
    recurringTransactions.push({
      merchant: MOCK_MERCHANTS.GREEN.find(m => m.name === 'PG&E')!,
      zone: 'GREEN',
      dayOfMonth: 15,
    });

    // Streaming services scattered
    const streamingServices = MOCK_MERCHANTS.YELLOW.filter(m => m.category === 'Streaming');
    streamingServices.slice(0, 3).forEach((service, i) => {
      recurringTransactions.push({
        merchant: service,
        zone: 'YELLOW',
        dayOfMonth: 5 + i * 7, // 5th, 12th, 19th
      });
    });
  }

  // Generate daily transactions
  while (currentDate <= endDate) {
    const dayOfMonth = currentDate.getDate();
    const dayOfWeek = currentDate.getDay();

    // Add recurring transactions for this day
    recurringTransactions.forEach(recurring => {
      if (recurring.dayOfMonth === dayOfMonth) {
        transactions.push(createTransaction(
          userId,
          recurring.merchant,
          new Date(currentDate),
          true
        ));
      }
    });

    // Generate random daily transactions
    // More transactions on weekends
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const txCount = randomInt(
      transactionsPerDay.min,
      isWeekend ? transactionsPerDay.max + 2 : transactionsPerDay.max
    );

    for (let i = 0; i < txCount; i++) {
      const zone = getWeightedRandomZone();
      const allMerchants = MOCK_MERCHANTS[zone] as readonly MerchantData[];
      const merchants = allMerchants.filter(m => !m.monthly);

      if (merchants.length > 0) {
        const merchant = randomPick([...merchants]);

        // Add some time variation within the day
        const txDate = new Date(currentDate);
        txDate.setHours(randomInt(7, 22));
        txDate.setMinutes(randomInt(0, 59));

        transactions.push(createTransaction(userId, merchant, txDate, false));
      }
    }

    // Add occasional impulse purchases (late night, weekends)
    if ((isWeekend || currentDate.getHours() > 21) && Math.random() < 0.15) {
      const redMerchants = MOCK_MERCHANTS.RED as readonly MerchantData[];
      const impulseMerchant = randomPick([...redMerchants]);
      const impulseDate = new Date(currentDate);
      impulseDate.setHours(randomInt(21, 23));
      transactions.push(createTransaction(userId, impulseMerchant, impulseDate, false));
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Sort by date descending (newest first)
  return transactions.sort((a, b) => b.date.getTime() - a.date.getTime());
}

// Create a single transaction
function createTransaction(
  userId: string,
  merchant: MerchantData,
  date: Date,
  isRecurring: boolean
): Omit<Transaction, 'createdAt' | 'updatedAt'> {
  const amount = merchant.range
    ? randomDecimal(merchant.range[0], merchant.range[1])
    : randomDecimal(10, 100);

  return {
    id: generateId(),
    userId,
    amount,
    description: `${merchant.name} - ${merchant.category}`,
    merchantName: merchant.name,
    date,
    source: 'DEMO' as TransactionSource,
    externalId: `demo-${generateId()}`,
    defaultCategory: merchant.category,
    pending: false,
    isRecurring,
  };
}

// Get weighted random zone
function getWeightedRandomZone(): keyof typeof MOCK_MERCHANTS {
  const zones = Object.keys(ZONE_WEIGHTS) as Array<keyof typeof ZONE_WEIGHTS>;
  const weights = zones.map(z => ZONE_WEIGHTS[z]);
  return weightedRandomPick(zones, weights);
}

// Generate AI suggestion for a transaction
export function generateAISuggestion(transaction: Omit<Transaction, 'createdAt' | 'updatedAt'>): {
  zone: TrafficLightZone;
  confidence: number;
  reasoning: string;
} {
  const merchantName = transaction.merchantName || '';
  const category = transaction.defaultCategory || '';
  const amount = Number(transaction.amount);

  // Find which zone this merchant typically belongs to
  let suggestedZone: TrafficLightZone = 'YELLOW';
  let confidence = 0.7;
  let reasoning = 'Evaluate if this adds real value to your life.';

  // Check GREEN merchants
  const greenMatch = MOCK_MERCHANTS.GREEN.find(
    m => merchantName.toLowerCase().includes(m.name.toLowerCase().split(' ')[0])
  );
  if (greenMatch) {
    suggestedZone = 'GREEN';
    confidence = 0.95;
    reasoning = getGreenReasoning(category);
  }

  // Check RED merchants
  const redMatch = MOCK_MERCHANTS.RED.find(
    m => merchantName.toLowerCase().includes(m.name.toLowerCase().split(' ')[0])
  );
  if (redMatch) {
    suggestedZone = 'RED';
    confidence = 0.85;
    reasoning = getRedReasoning(category, amount);
  }

  // Check YELLOW merchants
  const yellowMatch = MOCK_MERCHANTS.YELLOW.find(
    m => merchantName.toLowerCase().includes(m.name.toLowerCase().split(' ')[0])
  );
  if (yellowMatch) {
    suggestedZone = 'YELLOW';
    confidence = 0.8;
    reasoning = getYellowReasoning(category, merchantName);
  }

  return { zone: suggestedZone, confidence, reasoning };
}

function getGreenReasoning(category: string): string {
  const reasons: Record<string, string> = {
    Groceries: 'Food is essential. Eating at home saves money.',
    Utilities: 'Keeping the lights on. Non-negotiable.',
    Housing: 'Roof over your head. No question.',
    Insurance: 'Protecting what matters. Smart move.',
    Healthcare: 'Your health is worth it.',
    Transportation: 'Getting to work. Essential.',
    Phone: 'Staying connected in 2025. Necessary.',
    Internet: 'Required for modern life. Accept it.',
  };
  return reasons[category] || 'Essential expense. Keep it.';
}

function getYellowReasoning(category: string, merchant: string): string {
  const reasons: Record<string, string[]> = {
    'Food Delivery': [
      'Delivery fees + tip + markup = 40% more than cooking.',
      'Third delivery this week. See a pattern?',
      'Your kitchen is literally right there.',
    ],
    Streaming: [
      'You have 7 streaming services. Do the math.',
      'When did you last actually watch this one?',
      'That\'s $150/year for background noise.',
    ],
    Subscription: [
      'Forgot you had this, didn\'t you?',
      'Auto-renew is how they get you.',
      'Cancel and see if you miss it. Bet you won\'t.',
    ],
    Coffee: [
      '$6 x 5 days x 52 weeks = $1,560/year. On coffee.',
      'Home brew costs $0.25. Just saying.',
      'This coffee shop knows your name. Red flag.',
    ],
    'Fast Food': [
      'Quick and cheap? Actually neither.',
      'Your body and wallet both felt that.',
      'Meal prep Sunday exists for a reason.',
    ],
    'Fast Casual': [
      '$15 for a bowl you could make for $4.',
      'Chipotle again? That\'s the third time.',
      'Convenience has a 300% markup.',
    ],
    Shopping: [
      'Need or want? Be brutally honest.',
      'Will this spark joy in 30 days?',
      'The cart is a trap. Walk away.',
    ],
    Fitness: [
      'That gym membership judging you from your bank statement.',
      'Paying to not go is peak irony.',
      'Cancel it or actually use it.',
    ],
    Rideshare: [
      'Surge pricing is highway robbery.',
      'That 10 minute drive cost $25.',
      'Bus pass is $100/month. Do the math.',
    ],
    Entertainment: [
      'Fun money is fine. Is this budgeted?',
      'Will you remember this next month?',
      'Worth skipping retirement contribution for?',
    ],
  };
  const categoryReasons = reasons[category] || ['Does this actually add value to your life?'];
  return randomPick(categoryReasons);
}

function getRedReasoning(category: string, amount: number): string {
  const reasons: Record<string, string[]> = {
    'Late Night Shopping': [
      '2am Amazon orders are never good decisions.',
      'Sleep on it. Literally.',
      'Your tired brain is not your financial advisor.',
    ],
    'Impulse Buy': [
      'Would you buy this if you had to drive to get it?',
      'One-click ordering is financial sabotage.',
      'That dopamine hit cost you $' + amount.toFixed(0) + '.',
    ],
    Convenience: [
      'Convenience store = 200% markup.',
      'You paid $4 for a drink you have at home.',
      'These small purchases are the real budget killers.',
    ],
    Alcohol: [
      'Liquid calories and liquid money. Both gone.',
      'That\'s a lot of wine for a Tuesday.',
      'Your liver and wallet are both concerned.',
    ],
    Nightlife: [
      'Fun night, regretful morning, empty wallet.',
      'Drunk you has no financial sense.',
      'The bar tab never lies.',
    ],
    'Fast Fashion': [
      'Cheap clothes you\'ll throw away in 3 months.',
      'Your closet is full. This won\'t fix that.',
      'Fast fashion, fast regret.',
    ],
    Beauty: [
      'Your bathroom is already a Sephora.',
      'Marketing convinced you that you need this.',
      'Will this actually get used or collect dust?',
    ],
    Electronics: [
      'The one you have still works fine.',
      'Upgrade culture is a financial trap.',
      'That\'s $' + amount.toFixed(0) + ' for marginal improvement.',
    ],
    Gaming: [
      'Steam library: 200 games. Games played: 5.',
      'Another game for the backlog.',
      'Your entertainment budget called. It\'s concerned.',
    ],
    'Lazy Meal': [
      'Premium delivery for food you could make.',
      'That burger cost $45 with fees.',
      'Peak laziness has a high price tag.',
    ],
    Snacks: [
      'Gas station snacks add up fast.',
      '$5 here, $5 there = $150/month.',
      'Snacking your way to broke.',
    ],
    Events: [
      'FOMO is expensive.',
      'Will you remember this in a year?',
      'That\'s rent money for a concert.',
    ],
    Gambling: [
      'The house always wins. Always.',
      'Lottery is a tax on people bad at math.',
      'Zero return on investment. Literally.',
    ],
  };
  const categoryReasons = reasons[category] || [`$${amount.toFixed(0)} that could be building your future instead.`];
  return randomPick(categoryReasons);
}

// Get suggested zone for a new transaction based on merchant history
export function getSuggestedZone(
  merchantName: string,
  userHistory: Array<{ merchantName: string; zone: TrafficLightZone }>
): TrafficLightZone | null {
  const previousCategorizations = userHistory.filter(
    h => h.merchantName?.toLowerCase() === merchantName.toLowerCase()
  );

  if (previousCategorizations.length >= 2) {
    // User has categorized this merchant before - use their preference
    const zoneCounts = previousCategorizations.reduce((acc, h) => {
      acc[h.zone] = (acc[h.zone] || 0) + 1;
      return acc;
    }, {} as Record<TrafficLightZone, number>);

    const mostCommon = Object.entries(zoneCounts)
      .sort(([, a], [, b]) => b - a)[0];

    return mostCommon[0] as TrafficLightZone;
  }

  return null;
}
