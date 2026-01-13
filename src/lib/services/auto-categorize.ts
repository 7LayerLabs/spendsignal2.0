// Auto-categorization service
// Automatically assigns traffic light zones to transactions based on merchant/description patterns

import type { TrafficLightZone } from '@/constants/traffic-light';

interface CategoryRule {
  patterns: string[];
  zone: TrafficLightZone;
  category: string;
}

// GREEN - Essential spending (needs, bills, investments)
const GREEN_RULES: CategoryRule[] = [
  { patterns: ['mortgage', 'rent', 'property tax'], zone: 'GREEN', category: 'Housing' },
  { patterns: ['electric', 'gas bill', 'water bill', 'utility', 'eversource', 'national grid', 'psnh'], zone: 'GREEN', category: 'Utilities' },
  { patterns: ['health insurance', 'medical', 'pharmacy', 'cvs pharmacy', 'walgreens rx', 'doctor', 'hospital', 'dental', 'vision'], zone: 'GREEN', category: 'Healthcare' },
  { patterns: ['grocery', 'market basket', 'stop & shop', 'stop and shop', 'trader joe', 'whole foods', 'aldi', 'hannaford', 'shaws', 'wegmans', 'costco', 'bjs wholesale', 'sams club'], zone: 'GREEN', category: 'Groceries' },
  { patterns: ['car insurance', 'auto insurance', 'geico', 'progressive', 'state farm', 'allstate', 'liberty mutual'], zone: 'GREEN', category: 'Insurance' },
  { patterns: ['car payment', 'auto loan', 'toyota financial', 'honda financial', 'ford credit'], zone: 'GREEN', category: 'Auto Loan' },
  { patterns: ['student loan', 'nelnet', 'navient', 'great lakes', 'fedloan'], zone: 'GREEN', category: 'Student Loans' },
  { patterns: ['daycare', 'childcare', 'tuition', 'school fee'], zone: 'GREEN', category: 'Childcare/Education' },
  { patterns: ['401k', 'ira', 'vanguard', 'fidelity investment', 'schwab', 'retirement'], zone: 'GREEN', category: 'Investments' },
  { patterns: ['savings transfer', 'emergency fund'], zone: 'GREEN', category: 'Savings' },
  { patterns: ['internet', 'comcast', 'xfinity', 'verizon fios', 'spectrum'], zone: 'GREEN', category: 'Internet' },
  { patterns: ['cell phone', 'verizon wireless', 't-mobile', 'at&t wireless', 'sprint'], zone: 'GREEN', category: 'Phone' },
  { patterns: ['gas station', 'shell', 'exxon', 'mobil', 'bp ', 'sunoco', 'cumberland farms', 'irving', 'chevron', 'fuel'], zone: 'GREEN', category: 'Gas/Fuel' },
];

// YELLOW - Discretionary but reasonable (wants with some value)
const YELLOW_RULES: CategoryRule[] = [
  { patterns: ['amazon', 'amzn', 'amazon prime'], zone: 'YELLOW', category: 'Online Shopping' },
  { patterns: ['target', 'walmart', 'kohls', 'tjmaxx', 'marshalls', 'homegoods', 'bed bath'], zone: 'YELLOW', category: 'Retail' },
  { patterns: ['netflix', 'hulu', 'disney+', 'disney plus', 'hbo max', 'peacock', 'paramount+', 'apple tv', 'youtube premium'], zone: 'YELLOW', category: 'Streaming' },
  { patterns: ['spotify', 'apple music', 'pandora', 'audible'], zone: 'YELLOW', category: 'Music/Audio' },
  { patterns: ['gym', 'planet fitness', 'anytime fitness', 'orange theory', 'crossfit', 'ymca', 'peloton'], zone: 'YELLOW', category: 'Fitness' },
  { patterns: ['home depot', 'lowes', 'ace hardware', 'menards'], zone: 'YELLOW', category: 'Home Improvement' },
  { patterns: ['pet supplies', 'petco', 'petsmart', 'chewy'], zone: 'YELLOW', category: 'Pet Supplies' },
  { patterns: ['hair salon', 'barber', 'nail salon', 'spa', 'massage'], zone: 'YELLOW', category: 'Personal Care' },
  { patterns: ['dry cleaner', 'laundry'], zone: 'YELLOW', category: 'Laundry' },
  { patterns: ['uber ', 'lyft', 'taxi', 'cab '], zone: 'YELLOW', category: 'Rideshare' },
  { patterns: ['parking', 'meter'], zone: 'YELLOW', category: 'Parking' },
  { patterns: ['chipotle', 'panera', 'subway', 'five guys', 'shake shack', 'chick-fil-a', 'wendys', 'burger king', 'taco bell', 'kfc', 'popeyes'], zone: 'YELLOW', category: 'Fast Casual' },
  { patterns: ['restaurant', 'grille', 'bistro', 'cafe', 'diner', 'kitchen', 'eatery', 'tavern', 'pub '], zone: 'YELLOW', category: 'Dining Out' },
];

// RED - Indulgent spending (wasteful, impulsive, or harmful)
const RED_RULES: CategoryRule[] = [
  { patterns: ['ice cream', 'coldstone', 'baskin robbins', 'dairy queen', 'dq ', 'friendlys', 'ben & jerry', "ben and jerry"], zone: 'RED', category: 'Ice Cream' },
  { patterns: ['starbucks', 'dunkin', 'coffee shop', 'caribou coffee', 'peets coffee'], zone: 'RED', category: 'Coffee Shops' },
  { patterns: ['mcdonald', 'mcdonalds', 'wendys drive', 'burger king drive', 'taco bell drive', 'fast food'], zone: 'RED', category: 'Fast Food' },
  { patterns: ['bar ', 'liquor', 'wine store', 'beer store', 'brewery', 'taproom', 'pub ', 'tavern', 'alcohol'], zone: 'RED', category: 'Alcohol' },
  { patterns: ['casino', 'gambling', 'lottery', 'draftkings', 'fanduel', 'betmgm', 'caesars sports', 'barstool'], zone: 'RED', category: 'Gambling' },
  { patterns: ['doordash', 'uber eats', 'ubereats', 'grubhub', 'postmates', 'seamless', 'instacart'], zone: 'RED', category: 'Delivery Apps' },
  { patterns: ['candy', 'vending', 'snack'], zone: 'RED', category: 'Snacks' },
  { patterns: ['game', 'playstation', 'xbox', 'nintendo', 'steam', 'epic games', 'gaming'], zone: 'RED', category: 'Gaming' },
  { patterns: ['tobacco', 'smoke shop', 'vape'], zone: 'RED', category: 'Tobacco' },
  { patterns: ['strip club', 'adult', 'onlyfans'], zone: 'RED', category: 'Adult Entertainment' },
  { patterns: ['fashion nova', 'shein', 'wish.com', 'aliexpress'], zone: 'RED', category: 'Impulse Shopping' },
  { patterns: ['late fee', 'overdraft', 'nsf fee', 'penalty'], zone: 'RED', category: 'Fees/Penalties' },
  { patterns: ['atm fee', 'foreign transaction', 'service charge'], zone: 'RED', category: 'Bank Fees' },
];

// All rules combined
const ALL_RULES = [...GREEN_RULES, ...YELLOW_RULES, ...RED_RULES];

export interface AutoCategorizeResult {
  zone: TrafficLightZone;
  category: string;
  confidence: number;
  reasoning: string;
}

/**
 * Auto-categorize a transaction based on merchant name and description
 * Always returns a suggestion - never returns null
 */
export function autoCategorize(
  merchantName: string,
  description: string,
  amount?: number
): AutoCategorizeResult {
  const searchText = `${merchantName} ${description}`.toLowerCase();

  // First, try to match against known patterns
  for (const rule of ALL_RULES) {
    for (const pattern of rule.patterns) {
      if (searchText.includes(pattern.toLowerCase())) {
        return {
          zone: rule.zone,
          category: rule.category,
          confidence: 0.85,
          reasoning: `Matched "${pattern}" → ${rule.category}`,
        };
      }
    }
  }

  // No exact match - use heuristics based on keywords and amount
  const amt = amount || 0;

  // Check for payment/transfer keywords (likely GREEN - bills)
  if (searchText.includes('payment') || searchText.includes('bill pay') ||
      searchText.includes('autopay') || searchText.includes('direct debit')) {
    return {
      zone: 'GREEN',
      category: 'Bill Payment',
      confidence: 0.6,
      reasoning: 'Appears to be a bill payment or scheduled payment',
    };
  }

  // Check for transfer keywords
  if (searchText.includes('transfer') || searchText.includes('xfer') ||
      searchText.includes('zelle') || searchText.includes('venmo') || searchText.includes('paypal')) {
    return {
      zone: 'YELLOW',
      category: 'Transfer',
      confidence: 0.5,
      reasoning: 'Money transfer - review if this was necessary',
    };
  }

  // Check for restaurant/food keywords
  if (searchText.includes('restaurant') || searchText.includes('grill') ||
      searchText.includes('kitchen') || searchText.includes('cafe') ||
      searchText.includes('pizza') || searchText.includes('burger') ||
      searchText.includes('food') || searchText.includes('dining')) {
    return {
      zone: 'YELLOW',
      category: 'Dining Out',
      confidence: 0.65,
      reasoning: 'Appears to be a restaurant or food purchase',
    };
  }

  // Check for retail/shopping keywords
  if (searchText.includes('store') || searchText.includes('shop') ||
      searchText.includes('mart') || searchText.includes('retail') ||
      searchText.includes('outlet') || searchText.includes('mall')) {
    return {
      zone: 'YELLOW',
      category: 'Shopping',
      confidence: 0.55,
      reasoning: 'Retail purchase - consider if this was planned',
    };
  }

  // Amount-based heuristics for completely unknown merchants
  if (amt > 0) {
    // Very small purchases under $10 - likely impulse
    if (amt < 10) {
      return {
        zone: 'RED',
        category: 'Small Purchase',
        confidence: 0.45,
        reasoning: `Small $${amt.toFixed(0)} purchase - often impulse buys add up`,
      };
    }

    // Medium purchases $10-50 - probably discretionary
    if (amt < 50) {
      return {
        zone: 'YELLOW',
        category: 'Uncategorized',
        confidence: 0.4,
        reasoning: 'Unknown merchant - review and categorize based on actual need',
      };
    }

    // Larger purchases $50-200 - could be either
    if (amt < 200) {
      return {
        zone: 'YELLOW',
        category: 'Uncategorized',
        confidence: 0.35,
        reasoning: `$${amt.toFixed(0)} purchase - was this planned or impulsive?`,
      };
    }

    // Large purchases over $200 - likely intentional
    return {
      zone: 'YELLOW',
      category: 'Large Purchase',
      confidence: 0.4,
      reasoning: `Large $${amt.toFixed(0)} purchase - verify this was a planned expense`,
    };
  }

  // Fallback for zero/unknown amount
  return {
    zone: 'YELLOW',
    category: 'Uncategorized',
    confidence: 0.3,
    reasoning: 'Unknown merchant - drag to the correct zone',
  };
}

/**
 * Auto-categorize multiple transactions
 */
export function autoCategorizeMany(
  transactions: Array<{
    id: string;
    merchantName: string | null;
    description: string;
    amount: number;
  }>
): Map<string, AutoCategorizeResult> {
  const results = new Map<string, AutoCategorizeResult>();

  for (const txn of transactions) {
    const result = autoCategorize(
      txn.merchantName || '',
      txn.description,
      txn.amount
    );
    if (result) {
      results.set(txn.id, result);
    }
  }

  return results;
}

/**
 * Get suggested zone based on merchant - used for quick lookups
 */
export function getSuggestedZone(merchantName: string): TrafficLightZone | null {
  const result = autoCategorize(merchantName, '', undefined);
  return result?.zone || null;
}

/**
 * Get all category rules for display/editing
 */
export function getCategoryRules() {
  return {
    green: GREEN_RULES,
    yellow: YELLOW_RULES,
    red: RED_RULES,
  };
}
