export interface TransactionSplit {
  category: string;
  amount: number;
  notes?: string;
}

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'expense' | 'credit';
  account: string;
  category: string;
  hidden: boolean;
  filename?: string;
  recurringId?: string;
  tags?: string[];
  notes?: string;
  splits?: TransactionSplit[];
}

export interface Category {
  icon: string;
  color: string;
}

export interface CustomRule {
  keyword: string;
  category: string;
}

export interface Recurring {
  id: string;
  name: string;
  amount: number;
  category: string;
  account: string;
  day: number;
  type: 'expense' | 'credit';
  startYear?: number;
  startMonth?: number;
  endYear?: number;
  endMonth?: number;
}

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string; // ISO date string
  icon?: string;
  color?: string;
}

export interface NetWorthItem {
  id: string;
  name: string;
  value: number;
}

export interface AppData {
  transactions: Transaction[];
  budgets: Record<string, number>;
  networth: {
    assets: NetWorthItem[];
    liabilities: NetWorthItem[];
  };
  files: string[];
  file_meta: Record<string, any>;
  categories: Record<string, Category>;
  custom_rules: CustomRule[];
  recurring: Recurring[];
  goals: Goal[];
  tags: string[];
  hiddenBudgetCategories?: string[];
  theme?: 'light' | 'dark' | 'system';
}
