import React, { useEffect } from 'react';
import { BarChart3, List, Target, Lightbulb, Database, Briefcase, Tags, Repeat, Info, PieChart, Gem } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'motion/react';
import { useAppContext } from '../store';
import { v4 as uuidv4 } from 'uuid';
import { startOfDay, isBefore, isSameMonth, isAfter, getDate, isSameYear, format, addMonths } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type Page = 'Dashboard' | 'Transactions' | 'Budget' | 'Insights' | 'Data Sources' | 'Categories' | 'Recurring' | 'About';

interface LayoutProps {
  children: React.ReactNode;
  activePage: Page;
  setActivePage: (page: Page) => void;
  dateFilter: string;
  setDateFilter: (filter: string) => void;
  customDateRange: { start: string; end: string };
  setCustomDateRange: (range: { start: string; end: string }) => void;
}

const NAV_ITEMS: { name: Page; icon: React.ReactNode }[] = [
  { name: 'Dashboard', icon: <BarChart3 size={18} /> },
  { name: 'Transactions', icon: <List size={18} /> },
  { name: 'Budget', icon: <PieChart size={18} /> },
  { name: 'Insights', icon: <Lightbulb size={18} /> },
  { name: 'Data Sources', icon: <Database size={18} /> },
  { name: 'Categories', icon: <Tags size={18} /> },
  { name: 'Recurring', icon: <Repeat size={18} /> },
  { name: 'About', icon: <Info size={18} /> },
];

const DATE_FILTERS = ['This Month', 'Last Month', 'Last 3 Months', 'This Year', 'Last Year', 'Year Before Last', 'All Time', 'Custom Range'];

export const Layout: React.FC<LayoutProps> = ({ children, activePage, setActivePage, dateFilter, setDateFilter, customDateRange, setCustomDateRange }) => {
  const { data, updateData } = useAppContext();
  const { recurring, transactions, theme = 'dark' } = data;

  useEffect(() => {
    const root = window.document.documentElement;
    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // Check for due recurring transactions on mount and when recurring rules change
  useEffect(() => {
    const checkDueTransactions = () => {
      const today = startOfDay(new Date());
      const newTransactions: any[] = [];
      let hasChanges = false;

      recurring.forEach(rule => {
        // Determine start date for this rule
        // Safeguard: don't go back before 2000 to prevent massive transaction generation
        let ruleDate = new Date(
          Math.max(rule.startYear || today.getFullYear(), 2000), 
          (rule.startMonth || 1) - 1,
          rule.day
        );

        // Loop from rule start date until today
        let iterations = 0;
        while (isBefore(ruleDate, today) || isSameMonth(ruleDate, today)) {
          iterations++;
          if (iterations > 1000) { // Safeguard against infinite loops
             console.warn(`Infinite loop detected for rule: ${rule.name}`);
             break;
          }

          // Check end date
          if (rule.endYear && rule.endMonth) {
             const ruleYear = ruleDate.getFullYear();
             const ruleMonth = ruleDate.getMonth() + 1;
             if (ruleYear > rule.endYear || (ruleYear === rule.endYear && ruleMonth > rule.endMonth)) {
               break;
             }
          }

          // Check if we've gone past today (allow current day)
          if (isAfter(ruleDate, today) && !isSameMonth(ruleDate, today) && getDate(ruleDate) > getDate(today)) {
             break;
          }
          
          if (isAfter(ruleDate, today)) {
            break;
          }

          // Check if transaction already exists for this rule and month
          const exists = transactions.some(t => 
            (t.recurringId === rule.id && isSameMonth(new Date(t.date), ruleDate) && isSameYear(new Date(t.date), ruleDate)) ||
            (!t.recurringId && t.description === rule.name && 
            t.amount === rule.amount && 
            isSameMonth(new Date(t.date), ruleDate) &&
            isSameYear(new Date(t.date), ruleDate))
          );

          if (!exists) {
            newTransactions.push({
              id: uuidv4(),
              date: format(ruleDate, 'yyyy-MM-dd'),
              description: rule.name,
              amount: rule.amount,
              type: rule.type,
              account: rule.account,
              category: rule.category,
              hidden: false,
              recurringId: rule.id // Ensure we link it!
            });
            hasChanges = true;
          }

          // Move to next month
          ruleDate = addMonths(ruleDate, 1);
        }
      });

      if (hasChanges && newTransactions.length > 0) {
        // Limit to 50 transactions to prevent massive bugs
        const limitedTransactions = newTransactions.slice(0, 50);
        if (newTransactions.length > 50) {
            console.warn(`Generated ${newTransactions.length} transactions, but limiting to 50 for safety.`);
            alert(`Warning: Attempted to generate ${newTransactions.length} recurring transactions. Limiting to 50 for safety. Please check your recurring rule start dates.`);
        }

        updateData({
          transactions: [...transactions, ...limitedTransactions]
        });
        console.log(`Generated ${limitedTransactions.length} due recurring transactions.`);
      }
    };

    checkDueTransactions();
  }, [recurring, transactions.length]);

  return (
    <div className="flex h-screen w-full bg-[#141414] text-zinc-100 font-sans overflow-hidden transition-colors duration-300">
      {/* Sidebar */}
      <div className="w-[240px] min-w-[240px] bg-[#1e1e1e] border-r border-white/5 flex flex-col h-full relative z-20 transition-colors duration-300">
        <div className="p-6 pb-4 border-b border-white/5 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#8b5cf6] flex items-center justify-center shadow-lg shadow-[#8b5cf6]/20">
              <Gem size={18} className="text-white" />
            </div>
            <div>
              <div className="text-[15px] font-bold text-white tracking-tight font-display">Kilo</div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2 no-scrollbar">
          <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500 mt-1">Menu</div>
          <div className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const isActive = activePage === item.name;
              return (
                <button
                  key={item.name}
                  onClick={() => setActivePage(item.name)}
                  className={cn(
                    "relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 text-left group overflow-hidden",
                    isActive ? "text-white" : "text-zinc-400 hover:text-zinc-200"
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeNav"
                      className="absolute inset-0 bg-white/5 border border-white/10 rounded-xl"
                      initial={false}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  <div className="relative z-10 flex items-center gap-3">
                    <span className={cn("transition-colors duration-300", isActive ? "text-[#8b5cf6]" : "text-zinc-500 group-hover:text-zinc-400")}>
                      {item.icon}
                    </span>
                    {item.name}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-6"></div>

          <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500 mt-1">Time Period</div>
          <div className="px-2 space-y-2">
            <div className="relative">
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full appearance-none bg-[#141414] border border-white/10 rounded-xl text-white text-sm px-4 py-2.5 outline-none focus:border-[#8b5cf6]/50 focus:ring-1 focus:ring-[#8b5cf6]/50 transition-all cursor-pointer hover:bg-white/5"
              >
                {DATE_FILTERS.map((f) => (
                  <option key={f} value={f} className="bg-[#1e1e1e] text-white">{f}</option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
              </div>
            </div>
            {dateFilter === 'Custom Range' && (
              <div className="flex flex-col gap-2 p-3 bg-[#141414] rounded-xl border border-white/10">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1 block">Start Date</label>
                  <input 
                    type="date" 
                    value={customDateRange.start}
                    onChange={e => setCustomDateRange({ ...customDateRange, start: e.target.value })}
                    className="w-full bg-[#1e1e1e] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-[#8b5cf6]/50"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1 block">End Date</label>
                  <input 
                    type="date" 
                    value={customDateRange.end}
                    onChange={e => setCustomDateRange({ ...customDateRange, end: e.target.value })}
                    className="w-full bg-[#1e1e1e] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-[#8b5cf6]/50"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-white/5 bg-[#141414] transition-colors duration-300">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center text-sm font-bold text-zinc-300">
              T
            </div>
            <div>
              <div className="text-[13px] font-semibold text-white">Tomin</div>
              <div className="text-[11px] text-zinc-500">Personal Space</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6 md:p-8 relative z-10 bg-[#141414] transition-colors duration-300 w-full">
        <div className="max-w-6xl mx-auto w-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={activePage}
              initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
