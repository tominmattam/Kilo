import { Category } from './types';

export const DEFAULT_CATEGORIES: Record<string, Category> = {
  // Income
  'Paychecks': { icon: '💵', color: '#10b981' },
  'Interest': { icon: '💸', color: '#10b981' },
  'Business Income': { icon: '💰', color: '#10b981' },
  'Other Income': { icon: '💰', color: '#10b981' },
  // Gifts & Donations
  'Charity': { icon: '🎗', color: '#f43f5e' },
  'Gifts': { icon: '🎁', color: '#f43f5e' },
  // Auto & Transport
  'Auto Payment': { icon: '🚗', color: '#3b82f6' },
  'Public Transit': { icon: '🚃', color: '#3b82f6' },
  'Gas': { icon: '⛽️', color: '#3b82f6' },
  'Auto Maintenance': { icon: '🔧', color: '#3b82f6' },
  'Parking & Tolls': { icon: '🏢', color: '#3b82f6' },
  'Taxi & Ride Shares': { icon: '🚕', color: '#3b82f6' },
  // Housing
  'Mortgage': { icon: '🏠', color: '#8b5cf6' },
  'Rent': { icon: '🏠', color: '#8b5cf6' },
  'Home Improvement': { icon: '🔨', color: '#8b5cf6' },
  // Bills & Utilities
  'Garbage': { icon: '🗑', color: '#0ea5e9' },
  'Water': { icon: '💧', color: '#0ea5e9' },
  'Gas & Electric': { icon: '⚡️', color: '#0ea5e9' },
  'Internet & Cable': { icon: '🌐', color: '#0ea5e9' },
  'Phone': { icon: '📱', color: '#0ea5e9' },
  // Food & Dining
  'Groceries': { icon: '🍏', color: '#f97316' },
  'Restaurants & Bars': { icon: '🍽', color: '#f97316' },
  'Coffee Shops': { icon: '☕️', color: '#f97316' },
  // Travel & Lifestyle
  'Travel & Vacation': { icon: '🏝', color: '#ec4899' },
  'Entertainment & Recreation': { icon: '🎥', color: '#ec4899' },
  'Personal': { icon: '👑', color: '#ec4899' },
  'Pets': { icon: '🐶', color: '#ec4899' },
  'Fun Money': { icon: '😜', color: '#ec4899' },
  // Shopping
  'Shopping': { icon: '🛍', color: '#d946ef' },
  'Clothing': { icon: '👕', color: '#d946ef' },
  'Furniture & Housewares': { icon: '🪑', color: '#d946ef' },
  'Electronics': { icon: '🖥', color: '#d946ef' },
  // Children
  'Child Care': { icon: '👶', color: '#14b8a6' },
  'Child Activities': { icon: '⚽️', color: '#14b8a6' },
  // Education
  'Education': { icon: '🏫', color: '#f59e0b' },
  'Student Loans': { icon: '🎓', color: '#f59e0b' },
  // Health & Wellness
  'Medical': { icon: '💊', color: '#ef4444' },
  'Dentist': { icon: '🦷', color: '#ef4444' },
  'Fitness': { icon: '💪', color: '#ef4444' },
  // Financial
  'Loan Repayment': { icon: '💰', color: '#64748b' },
  'Financial & Legal Services': { icon: '🗄', color: '#64748b' },
  'Financial Fees': { icon: '🏦', color: '#64748b' },
  'Cash & ATM': { icon: '🏧', color: '#64748b' },
  'Insurance': { icon: '☂️', color: '#64748b' },
  'Taxes': { icon: '🏛️', color: '#64748b' },
  // Other
  'Uncategorized': { icon: '❓', color: '#a1a1aa' },
  'Check': { icon: '💸', color: '#a1a1aa' },
  'Miscellaneous': { icon: '💲', color: '#a1a1aa' },
  'Hide from Budgets & Trends': { icon: '⚪️', color: '#a1a1aa' },
  'Returned Purchase': { icon: '⚪️', color: '#a1a1aa' },
  'Kids Activities': { icon: '⚪️', color: '#a1a1aa' },
  // Business
  'Advertising & Promotion': { icon: '📣', color: '#84cc16' },
  'Business Utilities & Communication': { icon: '📞', color: '#84cc16' },
  'Employee Wages & Contract Labor': { icon: '💵', color: '#84cc16' },
  'Business Travel & Meals': { icon: '🍴', color: '#84cc16' },
  'Business Auto Expenses': { icon: '🚖', color: '#84cc16' },
  'Business Insurance': { icon: '📁', color: '#84cc16' },
  'Office Supplies & Expenses': { icon: '📎', color: '#84cc16' },
  'Office Rent': { icon: '🏢', color: '#84cc16' },
  'Postage & Shipping': { icon: '📦', color: '#84cc16' },
  'Future': { icon: '🛸', color: '#84cc16' },
  // Transfers
  'Investing': { icon: '💰', color: '#06b6d4' },
  'Transfer': { icon: '🔁', color: '#06b6d4' },
  'Credit Card Payment': { icon: '💳', color: '#06b6d4' },
  'Balance Adjustments': { icon: '⚖️', color: '#06b6d4' },
};

export const CATEGORY_GROUPS: Record<string, string[]> = {
  'Income': ['Paychecks', 'Interest', 'Business Income', 'Other Income'],
  'Gifts & Donations': ['Charity', 'Gifts'],
  'Auto & Transport': ['Auto Payment', 'Public Transit', 'Gas', 'Auto Maintenance', 'Parking & Tolls', 'Taxi & Ride Shares'],
  'Housing': ['Mortgage', 'Rent', 'Home Improvement'],
  'Bills & Utilities': ['Garbage', 'Water', 'Gas & Electric', 'Internet & Cable', 'Phone'],
  'Food & Dining': ['Groceries', 'Restaurants & Bars', 'Coffee Shops'],
  'Travel & Lifestyle': ['Travel & Vacation', 'Entertainment & Recreation', 'Personal', 'Pets', 'Fun Money'],
  'Shopping': ['Shopping', 'Clothing', 'Furniture & Housewares', 'Electronics'],
  'Children': ['Child Care', 'Child Activities', 'Kids Activities'],
  'Education': ['Education', 'Student Loans'],
  'Health & Wellness': ['Medical', 'Dentist', 'Fitness'],
  'Financial': ['Loan Repayment', 'Financial & Legal Services', 'Financial Fees', 'Cash & ATM', 'Insurance', 'Taxes'],
  'Business': ['Advertising & Promotion', 'Business Utilities & Communication', 'Employee Wages & Contract Labor', 'Business Travel & Meals', 'Business Auto Expenses', 'Business Insurance', 'Office Supplies & Expenses', 'Office Rent', 'Postage & Shipping', 'Future'],
  'Transfers': ['Investing', 'Transfer', 'Credit Card Payment', 'Balance Adjustments'],
  'Other': ['Uncategorized', 'Check', 'Miscellaneous', 'Hide from Budgets & Trends', 'Returned Purchase']
};

export const GROUP_PRIORITY = [
  'Housing',
  'Bills & Utilities',
  'Food & Dining',
  'Auto & Transport',
  'Health & Wellness',
  'Children',
  'Education',
  'Shopping',
  'Travel & Lifestyle',
  'Gifts & Donations',
  'Financial',
  'Transfers',
  'Income',
  'Other',
  'Business'
];

export const DEFAULT_BUDGETS: Record<string, number> = {
  'Rent': 1400.0,
  'Groceries': 600.0,
  'Gas': 200.0,
  'Restaurants & Bars': 300.0,
  'Shopping': 200.0,
  'Medical': 100.0,
  'Public Transit': 80.0,
  'Entertainment & Recreation': 100.0,
  'Internet & Cable': 50.0,
};

export const BASE_RULES: [string[], string][] = [
  [['RENT', 'LANDLORD', 'PROPERTY MGT', 'PROPERTY MANAGEMENT', 'HOUSING'], 'Rent'],
  [['GAS STATION', 'PETRO', 'SHELL', 'MOBIL', 'EXXON', 'CHEVRON', 'FUEL', 'GAS BAR'], 'Gas'],
  [['GROCERY', 'SUPERMARKET', 'MARKET', 'WHOLESALE', 'FOODS', 'SAFEWAY', 'COSTCO', 'WALMART GROCERY', 'FRESH', 'FRUIT', 'MEAT'], 'Groceries'],
  [['PUB', 'BAR', 'GRILL', 'LOUNGE', 'RESTAURANT', 'DINER', 'BISTRO', 'CAFE', 'COFFEE', 'STARBUCKS', 'TIM HORTONS', 'MCDONALDS', 'BURGER', 'PIZZA', 'SUSHI', 'TACO', 'NOODLE', 'STEAKHOUSE', 'BREWERY'], 'Restaurants & Bars'],
  [['PHARMACY', 'DRUG STORE', 'DENTAL', 'DOCTOR', 'CLINIC', 'MEDICAL', 'PHYSIO', 'OPTOMETRY', 'VISION', 'HOSPITAL', 'HEALTH'], 'Medical'],
  [['UBER', 'LYFT', 'TAXI', 'CAB', 'PARKING', 'TRANSIT', 'BUS', 'TRAIN', 'SUBWAY', 'METRO'], 'Public Transit'],
  [['CLOTHING', 'APPAREL', 'SHOES', 'FASHION', 'WEAR', 'GAP', 'OLD NAVY', 'ZARA', 'H&M', 'UNIQLO', 'NIKE', 'ADIDAS'], 'Clothing'],
  [['AMAZON', 'WALMART', 'TARGET', 'DOLLAR STORE', 'HOME DEPOT', 'LOWES', 'IKEA', 'BEST BUY', 'ELECTRONICS', 'HARDWARE', 'SHOPPING'], 'Shopping'],
  [['NETFLIX', 'SPOTIFY', 'APPLE', 'GOOGLE', 'ADOBE', 'SUBSCRIPTION', 'MEMBERSHIP', 'VPN', 'HOSTING', 'DOMAIN'], 'Internet & Cable'],
  [['HOTEL', 'AIRBNB', 'EXPEDIA', 'FLIGHT', 'AIRLINE', 'TRAVEL', 'RESORT', 'MOTEL', 'VACATION', 'LUGGAGE', 'HOSTEL', 'BOOKING.COM'], 'Travel & Vacation'],
  [['CINEMA', 'THEATRE', 'MOVIE', 'MUSEUM', 'ZOO', 'AMUSEMENT', 'TICKET', 'EVENT', 'BOWLING', 'GOLF', 'SKI', 'RECREATION', 'ENTERTAINMENT'], 'Entertainment & Recreation'],
  [['UTILITIES', 'WATER', 'ELECTRICITY', 'POWER', 'HYDRO', 'ENERGY', 'GAS', 'INTERNET', 'CABLE', 'PHONE', 'MOBILE', 'WIRELESS'], 'Gas & Electric'],
  [['PAYROLL', 'PAYCHECK', 'SALARY', 'WAGE', 'INCOME', 'DEPOSIT', 'E-TRANSFER IN', 'REFUND', 'CASHBACK', 'REWARD', 'DIVIDEND', 'INTEREST'], 'Paychecks'],
  [['TRANSFER', 'E-TRANSFER', 'PAYMENT', 'CREDIT CARD', 'MASTERCARD', 'VISA', 'AMEX', 'LOAN', 'MORTGAGE', 'LINE OF CREDIT', 'LOC', 'BILL PAY', 'FUNDS TRANSFER'], 'Transfer'],
];
