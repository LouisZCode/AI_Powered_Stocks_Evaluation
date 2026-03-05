/** Shared pricing constants — single source of truth for tiers, costs, and FAQ */

export interface Tier {
  id: string;
  name: string;
  price: string;
  tokens: string;
  tokensNum: number | null;
  watchlistLimit: number | null;
  features: string[];
  highlighted: boolean;
  badge?: string;
}

export const TIERS: Tier[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    tokens: "70 tokens",
    tokensNum: 70,
    watchlistLimit: 3,
    features: [
      "3 watchlist slots",
      "Fast models only",
      "Basic analysis",
    ],
    highlighted: false,
  },
  {
    id: "hobbyist",
    name: "Hobbyist",
    price: "$20",
    tokens: "500 tokens",
    tokensNum: 500,
    watchlistLimit: 10,
    features: [
      "10 watchlist slots",
      "Fast + deep models",
      "Multi-LLM debate",
      "Priority queue",
    ],
    highlighted: false,
  },
  {
    id: "investor",
    name: "Investor",
    price: "$49",
    tokens: "1,200 tokens",
    tokensNum: 1200,
    watchlistLimit: 25,
    features: [
      "25 watchlist slots",
      "Fast + deep models",
      "Multi-LLM debate",
      "Priority queue",
      "Export reports",
    ],
    highlighted: false,
  },
  {
    id: "trader",
    name: "Trader",
    price: "$89",
    tokens: "2,500 tokens",
    tokensNum: 2500,
    watchlistLimit: 50,
    features: [
      "50 watchlist slots",
      "Fast + deep models",
      "Multi-LLM debate",
      "Priority queue",
      "Export reports",
      "API access",
    ],
    highlighted: true,
    badge: "Best Value",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Contact",
    tokens: "Custom",
    tokensNum: null,
    watchlistLimit: null,
    features: [
      "Unlimited watchlist",
      "All models",
      "Custom integrations",
      "Dedicated support",
      "SLA guarantee",
    ],
    highlighted: false,
  },
];

export interface TokenCostRow {
  action: string;
  cost: string;
  note: string;
}

export const TOKEN_COSTS: TokenCostRow[] = [
  { action: "Fast analysis", cost: "2 tokens / model", note: "GPT-4o, Claude Sonnet, etc." },
  { action: "Deep analysis", cost: "10 tokens / model", note: "o3, Claude Opus, etc." },
  { action: "Fast debate", cost: "1 token / model / metric / round", note: "Standard resolution" },
  { action: "Deep debate", cost: "2 tokens / model / metric / round", note: "Deep resolution" },
];

export interface RunExample {
  label: string;
  tokens: number;
  description: string;
}

export const RUN_EXAMPLES: RunExample[] = [
  { label: "Light", tokens: 18, description: "3 fast models, 2 metrics, 2-round debate" },
  { label: "Standard", tokens: 102, description: "5 fast + 4 deep models, 2 metrics, 2-round debate" },
  { label: "Heavy", tokens: 375, description: "5 fast + 4 deep models, 5 metrics, 5-round debate" },
];

export interface FaqItem {
  question: string;
  answer: string;
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: "What are tokens?",
    answer: "Tokens are the currency for running analyses and debates. Each action costs a certain number of tokens depending on the models and settings you choose. Your balance resets monthly.",
  },
  {
    question: "When do tokens reset?",
    answer: "Your token balance resets on the first of each month. Unused tokens do not roll over.",
  },
  {
    question: "Can I upgrade or downgrade?",
    answer: "Yes. You can change your plan at any time. Upgrades take effect immediately with a prorated charge. Downgrades take effect at the start of your next billing cycle.",
  },
  {
    question: "What are deep models?",
    answer: "Deep models (like o3, Claude Opus) use more advanced reasoning and produce higher-quality analysis, but cost more tokens per run. Fast models are great for quick checks.",
  },
];
