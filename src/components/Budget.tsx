import React, { useMemo, useState } from 'react';
import { useAppContext } from '../store';
import { CATEGORY_GROUPS, GROUP_PRIORITY } from '../constants';
import { startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, parseISO, endOfDay, startOfDay, addMonths, format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';
import { EyeOff, Eye, ChevronDown, ChevronRight, Info, RotateCcw } from 'lucide-react';
import { Page } from './Layout';

interface BudgetProps {
  dateFilter: string;
  customDateRange: { start: string; end: string };
  setActivePage?: (page: Page) => void;
  setCategoryFilter?: (category: string) => void;
}

export const Budget: React.FC<BudgetProps> = ({ dateFilter, customDateRange, setActivePage, setCategoryFilter }) => {
  const { data, updateData } = useAppContext();
  const { transactions, categories, budgets, hiddenBudgetCategories = [] } = data;

  const [activeTab, setActiveTab] = useState<'Budget' | 'Forecast'>('Budget');

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    'Income': true,
    'Expenses': true,
    'Contributions': true,
    ...Object.keys(CATEGORY_GROUPS).reduce((acc, g) => ({ ...acc, [g]: true }), {})
  });

  const [expandedUnbudgeted, setExpandedUnbudgeted] = useState<Record<string, boolean>>({});

  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  const toggleUnbudgeted = (group: string) => {
    setExpandedUnbudgeted(prev => ({ ...prev, [group]: !prev[group] }));
  };

  const handleCategoryClick = (cat: string) => {
    if (setCategoryFilter && setActivePage) {
      setCategoryFilter(cat);
      setActivePage('Transactions');
    }
  };

  const { filteredTransactions, monthsInRange } = useMemo(() => {
    const today = new Date();
    let start: Date | null = null;
    let end: Date | null = null;

    if (dateFilter === 'This Month') {
      start = startOfMonth(today);
      end = endOfMonth(today);
    } else if (dateFilter === 'Last Month') {
      start = startOfMonth(subMonths(today, 1));
      end = endOfMonth(subMonths(today, 1));
    } else if (dateFilter === 'Last 3 Months') {
      start = startOfMonth(subMonths(today, 3));
    } else if (dateFilter === 'This Year') {
      start = startOfYear(today);
      end = endOfMonth(addMonths(today, 1));
    } else if (dateFilter === 'Last Year') {
      start = startOfYear(subMonths(today, 12));
      end = endOfYear(subMonths(today, 12));
    } else if (dateFilter === 'Year Before Last') {
      start = startOfYear(subMonths(today, 24));
      end = endOfYear(subMonths(today, 24));
    } else if (dateFilter === 'Custom Range') {
      if (customDateRange.start) start = startOfDay(parseISO(customDateRange.start));
      if (customDateRange.end) end = endOfDay(parseISO(customDateRange.end));
    } else if (dateFilter === 'All Time') {
      end = endOfDay(today);
    }

    const filtered = transactions.filter(t => {
      if (t.hidden) return false;
      const d = parseISO(t.date);
      if (start && d < start) return false;
      if (end && d > end) return false;
      return true;
    });

    let months = 1;
    if (filtered.length > 0) {
      const dates = filtered.map(t => t.date.substring(0, 7));
      const uniqueMonths = new Set(dates);
      months = Math.max(1, uniqueMonths.size);
    }

    return { filteredTransactions: filtered, monthsInRange: months };
  }, [transactions, dateFilter, customDateRange]);

  const categorySpent = useMemo(() => {
    const spent: Record<string, number> = {};
    filteredTransactions.forEach(t => {
      const amt = t.type === 'credit' ? t.amount : t.amount; 
      
      if (t.splits && t.splits.length > 0) {
        t.splits.forEach(s => {
          spent[s.category] = (spent[s.category] || 0) + s.amount;
        });
      } else {
        spent[t.category] = (spent[t.category] || 0) + amt;
      }
    });
    return spent;
  }, [filteredTransactions]);

  const allBudgetCats = Array.from(new Set(Object.keys(categories)))
    .filter(c => !['Payments'].includes(c));

  const visibleBudgetCats = allBudgetCats.filter(c => !hiddenBudgetCategories.includes(c));
  const hiddenCats = allBudgetCats.filter(c => hiddenBudgetCategories.includes(c));

  const groupedCats = useMemo(() => {
    const groups: Record<string, string[]> = {};
    allBudgetCats.forEach(cat => {
      let foundGroup = 'Other';
      for (const [groupName, cats] of Object.entries(CATEGORY_GROUPS)) {
        if (cats.includes(cat)) {
          foundGroup = groupName;
          break;
        }
      }
      if (!groups[foundGroup]) groups[foundGroup] = [];
      groups[foundGroup].push(cat);
    });
    return groups;
  }, [allBudgetCats]);

  const incomeCats = groupedCats['Income'] || [];
  const expenseGroups = Object.entries(groupedCats)
    .filter(([g]) => g !== 'Income' && g !== 'Transfers')
    .sort(([groupA], [groupB]) => {
      const indexA = GROUP_PRIORITY.indexOf(groupA);
      const indexB = GROUP_PRIORITY.indexOf(groupB);
      return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
    });

  const handleBudgetChange = (cat: string, value: number) => {
    updateData({ budgets: { ...budgets, [cat]: value } });
  };

  const toggleHideCategory = (cat: string) => {
    const newHidden = hiddenBudgetCategories.includes(cat)
      ? hiddenBudgetCategories.filter(c => c !== cat)
      : [...hiddenBudgetCategories, cat];
    updateData({ hiddenBudgetCategories: newHidden });
  };

  const totalIncomeBudget = incomeCats.filter(c => !hiddenBudgetCategories.includes(c)).reduce((sum, c) => sum + (budgets[c] || 0), 0) * monthsInRange;
  const totalIncomeActual = incomeCats.filter(c => !hiddenBudgetCategories.includes(c)).reduce((sum, c) => sum + (categorySpent[c] || 0), 0);
  
  const totalExpenseBudget = expenseGroups.reduce((sum, [_, cats]) => sum + (cats as string[]).filter(c => !hiddenBudgetCategories.includes(c)).reduce((s, c) => s + (budgets[c] || 0), 0), 0) * monthsInRange;
  const totalExpenseActual = expenseGroups.reduce((sum, [_, cats]) => sum + (cats as string[]).filter(c => !hiddenBudgetCategories.includes(c)).reduce((s, c) => s + (categorySpent[c] || 0), 0), 0);

  const leftToBudget = totalIncomeBudget - totalExpenseBudget;

  const historyData = useMemo(() => {
    const data = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = subMonths(today, i);
      const monthStart = startOfMonth(date);
      const monthEnd = endOfMonth(date);
      const monthKey = format(date, 'MMM');

      const monthlyExpenses = transactions.filter(t => {
        const d = parseISO(t.date);
        return t.type === 'expense' && d >= monthStart && d <= monthEnd && !t.hidden;
      });

      const spent = monthlyExpenses.reduce((sum, t) => {
        if (t.splits && t.splits.length > 0) {
          return sum + t.splits.reduce((sSum, s) => {
            if (['Payments'].includes(s.category)) return sSum;
            return sSum + s.amount;
          }, 0);
        }
        if (['Payments'].includes(t.category)) return sum;
        return sum + t.amount;
      }, 0);
      
      const budget = (Object.values(budgets) as number[]).reduce((sum, b) => sum + b, 0);

      data.push({ name: monthKey, Budget: budget, Spent: spent });
    }
    return data;
  }, [transactions, budgets]);

  const renderRow = (cat: string, isIncome: boolean) => {
    const spent = categorySpent[cat] || 0;
    const monthlyBud = budgets[cat] || 0;
    const scaledBud = monthlyBud * monthsInRange;
    const remaining = isIncome ? scaledBud - spent : scaledBud - spent; 
    const icon = categories[cat]?.icon || '📦';

    const pct = scaledBud > 0 ? Math.min(100, (spent / scaledBud) * 100) : 0;
    
    let remColor = 'text-[#22c55e]'; 
    if (!isIncome && remaining < 0) remColor = 'text-[#ef4444]'; 
    if (isIncome && remaining < 0) remColor = 'text-[#22c55e]'; 

    return (
      <div key={cat} className={`group flex flex-col md:flex-row md:items-center justify-between py-3 px-4 hover:bg-white/[0.02] border-b border-white/5 transition-colors gap-2 md:gap-0 ${hiddenBudgetCategories.includes(cat) ? 'opacity-50' : ''}`}>
        <div className="flex items-center gap-3 w-full md:w-3/12 min-w-0">
          <span className="text-lg shrink-0">{icon}</span>
          <span 
            className="text-sm text-zinc-200 truncate cursor-pointer hover:text-blue-400 hover:underline transition-colors block min-w-0" 
            title={cat}
            onClick={() => handleCategoryClick(cat)}
          >
            {cat}
          </span>
          <button onClick={() => toggleHideCategory(cat)} className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-zinc-300 ml-2 shrink-0">
            {hiddenBudgetCategories.includes(cat) ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
        </div>
        
        <div className="w-full md:w-4/12 px-0 md:px-4 flex items-center my-2 md:my-0">
           <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
             <div className={`h-full ${isIncome ? 'bg-[#22c55e]' : (remaining < 0 ? 'bg-[#ef4444]' : 'bg-[#22c55e]')}`} style={{ width: `${pct}%` }} />
           </div>
        </div>

        <div className="flex items-center justify-between md:justify-end gap-2 md:gap-4 w-full md:w-5/12">
          <div className="flex flex-col md:block w-1/3 md:w-28">
            <span className="md:hidden text-[10px] text-zinc-500 uppercase mb-1">Budget</span>
            <div className="relative w-full">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">$</span>
              <input
                type="number"
                value={monthlyBud || ''}
                onChange={e => handleBudgetChange(cat, parseFloat(e.target.value) || 0)}
                className="w-full bg-[#1a1a1a] border border-white/10 rounded-md py-1.5 pl-7 pr-3 text-right text-sm text-white focus:border-[#22c55e] focus:ring-1 focus:ring-[#22c55e] outline-none transition-all"
                placeholder="0"
              />
            </div>
          </div>
          
          <div className="flex flex-col md:block w-1/3 md:w-24 text-right">
             <span className="md:hidden text-[10px] text-zinc-500 uppercase mb-1">Actual</span>
             <div className="text-sm text-zinc-300 truncate">
              ${spent.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </div>
          
          <div className="flex flex-col md:block w-1/3 md:w-24 text-right">
             <span className="md:hidden text-[10px] text-zinc-500 uppercase mb-1">Remaining</span>
             <div className={`text-sm font-medium truncate ${remColor}`}>
              {remaining < 0 && !isIncome ? '-$' : '$'}{Math.abs(remaining).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 text-zinc-100 font-sans">
      <div className="flex-1 space-y-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-semibold text-white">{dateFilter}</h1>
            <div className="flex gap-4 text-sm font-medium border-b border-white/10 pb-1">
              <button 
                onClick={() => setActiveTab('Budget')}
                className={`${activeTab === 'Budget' ? 'text-[#8b5cf6] border-b-2 border-[#8b5cf6]' : 'text-zinc-500 hover:text-zinc-300'} pb-1 transition-colors`}
              >
                Budget
              </button>
              <button 
                onClick={() => setActiveTab('Forecast')}
                className={`${activeTab === 'Forecast' ? 'text-[#8b5cf6] border-b-2 border-[#8b5cf6]' : 'text-zinc-500 hover:text-zinc-300'} pb-1 transition-colors`}
              >
                Forecast
              </button>
            </div>
          </div>
        </div>

        {activeTab === 'Forecast' ? (
          <div className="bg-[#1e1e1e] rounded-xl border border-white/5 p-6 shadow-lg">
            <h3 className="text-white font-semibold mb-6 text-lg tracking-tight">Budget vs Actual (Last 7 Months)</h3>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={historyData} margin={{ top: 5, right: 5, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    stroke="#888" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                    dy={10}
                  />
                  <YAxis 
                    stroke="#888" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={(value) => `$${value/1000}k`}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1a1a1a', borderColor: '#333', borderRadius: '8px', color: '#fff' }}
                    itemStyle={{ color: '#fff' }}
                    cursor={{ fill: '#2a2a2a' }}
                  />
                  <Legend />
                  <Bar dataKey="Budget" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="Spent" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <>
            <div className="hidden md:flex items-center justify-between px-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              <div className="w-3/12">Category</div>
              <div className="w-4/12"></div>
              <div className="flex items-center justify-end gap-4 w-5/12">
                <div className="w-28 text-right">Budget</div>
                <div className="w-24 text-right">Actual</div>
                <div className="w-24 text-right">Remaining</div>
              </div>
            </div>

            <div className="bg-[#1e1e1e] rounded-xl border border-white/5 overflow-hidden shadow-lg">
          <div 
            className="flex flex-col md:flex-row items-center justify-between p-4 bg-[#252525] cursor-pointer hover:bg-[#2a2a2a] transition-colors gap-2 md:gap-0"
            onClick={() => toggleGroup('Income')}
          >
            <div className="flex items-center gap-2 font-medium text-white w-full md:w-3/12">
              {expandedGroups['Income'] ? <ChevronDown size={18} className="text-zinc-400" /> : <ChevronRight size={18} className="text-zinc-400" />}
              Income
            </div>
            <div className="hidden md:block md:w-4/12"></div>
            <div className="flex items-center justify-between md:justify-end gap-2 md:gap-4 w-full md:w-5/12 text-sm font-medium">
              <div className="w-1/3 md:w-28 text-right text-zinc-300">
                <span className="md:hidden text-[10px] text-zinc-500 uppercase mr-1">Budget</span>
                ${totalIncomeBudget.toLocaleString()}
              </div>
              <div className="w-1/3 md:w-24 text-right text-zinc-300">
                <span className="md:hidden text-[10px] text-zinc-500 uppercase mr-1">Actual</span>
                ${totalIncomeActual.toLocaleString()}
              </div>
              <div className="w-1/3 md:w-24 text-right text-[#22c55e]">
                <span className="md:hidden text-[10px] text-zinc-500 uppercase mr-1">Rem.</span>
                ${(totalIncomeBudget - totalIncomeActual).toLocaleString()}
              </div>
            </div>
          </div>
          
          {expandedGroups['Income'] && (
            <div className="bg-[#141414]">
              {incomeCats.filter(c => !hiddenBudgetCategories.includes(c)).map(cat => renderRow(cat, true))}
              
              {incomeCats.filter(c => hiddenBudgetCategories.includes(c)).length > 0 && (
                <>
                  <button 
                    onClick={() => toggleUnbudgeted('Income')}
                    className="flex items-center gap-2 px-4 py-3 text-sm text-zinc-500 hover:text-zinc-300 transition-colors w-full text-left"
                  >
                    <Eye size={14} />
                    {expandedUnbudgeted['Income'] ? 'Hide' : 'Show'} {incomeCats.filter(c => hiddenBudgetCategories.includes(c)).length} unbudgeted
                  </button>
                  {expandedUnbudgeted['Income'] && (
                    <div className="bg-[#141414]">
                      {incomeCats.filter(c => hiddenBudgetCategories.includes(c)).map(cat => renderRow(cat, true))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          
          <div className="flex flex-col md:flex-row items-center justify-between p-4 bg-[#1e1e1e] border-t border-white/5 gap-2 md:gap-0">
            <div className="font-semibold text-white w-full md:w-3/12">Total Income</div>
            <div className="hidden md:block md:w-4/12"></div>
            <div className="flex items-center justify-between md:justify-end gap-2 md:gap-4 w-full md:w-5/12 text-sm font-semibold">
              <div className="w-1/3 md:w-28 text-right text-white">
                <span className="md:hidden text-[10px] text-zinc-500 uppercase mr-1">Budget</span>
                ${totalIncomeBudget.toLocaleString()}
              </div>
              <div className="w-1/3 md:w-24 text-right text-white">
                <span className="md:hidden text-[10px] text-zinc-500 uppercase mr-1">Actual</span>
                ${totalIncomeActual.toLocaleString()}
              </div>
              <div className="w-1/3 md:w-24 text-right text-[#22c55e]">
                <span className="md:hidden text-[10px] text-zinc-500 uppercase mr-1">Rem.</span>
                ${(totalIncomeBudget - totalIncomeActual).toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[#1e1e1e] rounded-xl border border-white/5 overflow-hidden shadow-lg">
          <div 
            className="flex flex-col md:flex-row items-center justify-between p-4 bg-[#252525] cursor-pointer hover:bg-[#2a2a2a] transition-colors gap-2 md:gap-0"
            onClick={() => toggleGroup('Expenses')}
          >
            <div className="flex items-center gap-2 font-medium text-white w-full md:w-3/12">
              {expandedGroups['Expenses'] ? <ChevronDown size={18} className="text-zinc-400" /> : <ChevronRight size={18} className="text-zinc-400" />}
              Expenses
            </div>
            <div className="hidden md:block md:w-4/12"></div>
            <div className="flex items-center justify-between md:justify-end gap-2 md:gap-4 w-full md:w-5/12 text-sm font-medium">
              <div className="w-1/3 md:w-28 text-right text-zinc-300">
                <span className="md:hidden text-[10px] text-zinc-500 uppercase mr-1">Budget</span>
                ${totalExpenseBudget.toLocaleString()}
              </div>
              <div className="w-1/3 md:w-24 text-right text-zinc-300">
                <span className="md:hidden text-[10px] text-zinc-500 uppercase mr-1">Actual</span>
                ${totalExpenseActual.toLocaleString()}
              </div>
              <div className={`w-1/3 md:w-24 text-right ${totalExpenseBudget - totalExpenseActual < 0 ? 'text-[#ef4444]' : 'text-[#22c55e]'}`}>
                <span className="md:hidden text-[10px] text-zinc-500 uppercase mr-1">Rem.</span>
                {totalExpenseBudget - totalExpenseActual < 0 ? '-' : ''}${Math.abs(totalExpenseBudget - totalExpenseActual).toLocaleString()}
              </div>
            </div>
          </div>
          
          {expandedGroups['Expenses'] && (
            <div className="bg-[#141414] p-2 space-y-2">
              {expenseGroups.map(([groupName, cats]) => {
                const catsList = cats as string[];
                const visibleGroupCats = catsList.filter(c => !hiddenBudgetCategories.includes(c));
                const hiddenGroupCats = catsList.filter(c => hiddenBudgetCategories.includes(c));
                
                const groupBud = visibleGroupCats.reduce((s, c) => s + (budgets[c] || 0), 0) * monthsInRange;
                const groupAct = visibleGroupCats.reduce((s, c) => s + (categorySpent[c] || 0), 0);
                const groupRem = groupBud - groupAct;
                
                return (
                  <div key={groupName} className="rounded-lg border border-white/5 overflow-hidden bg-[#1a1a1a]">
                    <div 
                      className="flex flex-col md:flex-row items-center justify-between p-3 cursor-pointer hover:bg-[#222] transition-colors gap-2 md:gap-0"
                      onClick={() => toggleGroup(groupName)}
                    >
                      <div className="flex items-center gap-2 text-sm font-medium text-zinc-100 w-full md:w-3/12">
                        {expandedGroups[groupName] ? <ChevronDown size={16} className="text-zinc-500" /> : <ChevronRight size={16} className="text-zinc-500" />}
                        {groupName}
                      </div>
                      <div className="hidden md:block md:w-4/12"></div>
                      <div className="flex items-center justify-between md:justify-end gap-2 md:gap-4 w-full md:w-5/12 text-sm">
                        <div className="w-1/3 md:w-28 text-right font-medium text-zinc-300">
                          <span className="md:hidden text-[10px] text-zinc-500 uppercase mr-1">Budget</span>
                          ${groupBud.toLocaleString()}
                        </div>
                        <div className="w-1/3 md:w-24 text-right text-zinc-400">
                          <span className="md:hidden text-[10px] text-zinc-500 uppercase mr-1">Actual</span>
                          ${groupAct.toLocaleString()}
                        </div>
                        <div className={`w-1/3 md:w-24 text-right font-medium ${groupRem < 0 ? 'text-[#ef4444] bg-[#ef4444]/10 px-2 py-0.5 rounded' : 'text-[#22c55e]'}`}>
                          <span className="md:hidden text-[10px] text-zinc-500 uppercase mr-1">Rem.</span>
                          {groupRem < 0 ? '-' : ''}${Math.abs(groupRem).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    {expandedGroups[groupName] && (
                      <div className="bg-[#141414] border-t border-white/5">
                        {visibleGroupCats.sort((a, b) => a.localeCompare(b)).map(cat => renderRow(cat, false))}
                        
                        {hiddenGroupCats.length > 0 && (
                          <>
                            <button 
                              onClick={() => toggleUnbudgeted(groupName)}
                              className="flex items-center gap-2 px-4 py-3 text-sm text-zinc-500 hover:text-zinc-300 transition-colors w-full text-left"
                            >
                              <Eye size={14} />
                              {expandedUnbudgeted[groupName] ? 'Hide' : 'Show'} {hiddenGroupCats.length} unbudgeted
                            </button>
                            {expandedUnbudgeted[groupName] && (
                              <div className="bg-[#141414]">
                                {hiddenGroupCats.sort((a, b) => a.localeCompare(b)).map(cat => renderRow(cat, false))}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          
          <div className="flex flex-col md:flex-row items-center justify-between p-4 bg-[#1e1e1e] border-t border-white/5 gap-2 md:gap-0">
            <div className="font-semibold text-white w-full md:w-3/12">Total Expenses</div>
            <div className="hidden md:block md:w-4/12"></div>
            <div className="flex items-center justify-between md:justify-end gap-2 md:gap-4 w-full md:w-5/12 text-sm font-semibold">
              <div className="w-1/3 md:w-28 text-right text-white">
                <span className="md:hidden text-[10px] text-zinc-500 uppercase mr-1">Budget</span>
                ${totalExpenseBudget.toLocaleString()}
              </div>
              <div className="w-1/3 md:w-24 text-right text-white">
                <span className="md:hidden text-[10px] text-zinc-500 uppercase mr-1">Actual</span>
                ${totalExpenseActual.toLocaleString()}
              </div>
              <div className={`w-1/3 md:w-24 text-right ${totalExpenseBudget - totalExpenseActual < 0 ? 'text-[#ef4444]' : 'text-[#22c55e]'}`}>
                <span className="md:hidden text-[10px] text-zinc-500 uppercase mr-1">Rem.</span>
                {totalExpenseBudget - totalExpenseActual < 0 ? '-' : ''}${Math.abs(totalExpenseBudget - totalExpenseActual).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
        </>
        )}

        <div className="sticky bottom-4 bg-[#22c55e] text-zinc-900 rounded-xl p-4 flex items-center justify-between font-bold shadow-lg shadow-[#22c55e]/20">
          <div className="text-lg">Left to Budget</div>
          <div className="text-xl">${leftToBudget.toLocaleString()}</div>
        </div>

      </div>

      <div className="w-full lg:w-80 shrink-0 space-y-6">
        <div className="bg-[#1e1e1e] rounded-xl border border-white/5 p-6 shadow-lg">
          <div className="text-center mb-8">
            <div className={`text-4xl font-bold mb-2 ${leftToBudget >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
              ${leftToBudget.toLocaleString()}
            </div>
            <div className="text-sm text-zinc-400 flex items-center justify-center gap-1">
              Left to budget <Info size={14} />
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <div className="flex justify-between text-sm mb-3">
                <span className="text-zinc-200">Income</span>
                <span className="text-zinc-400">${totalIncomeBudget.toLocaleString()} budget</span>
              </div>
              <div className="h-2 bg-[#2a2a2a] rounded-full overflow-hidden mb-3">
                <div className="h-full bg-[#22c55e]" style={{ width: `${Math.min(100, (totalIncomeActual / (totalIncomeBudget || 1)) * 100)}%` }} />
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white font-medium">${totalIncomeActual.toLocaleString()} earned</span>
                <span className="text-[#22c55e] font-medium">${Math.max(0, totalIncomeBudget - totalIncomeActual).toLocaleString()} remaining</span>
              </div>
            </div>

            <div className="h-px bg-white/5" />

            <div>
              <div className="flex justify-between text-sm mb-3">
                <span className="text-zinc-200">Expenses</span>
                <span className="text-zinc-400">${totalExpenseBudget.toLocaleString()} budget</span>
              </div>
              <div className="h-2 bg-[#2a2a2a] rounded-full overflow-hidden mb-3">
                <div className={`h-full ${totalExpenseActual > totalExpenseBudget ? 'bg-[#ef4444]' : 'bg-[#ef4444]'}`} style={{ width: `${Math.min(100, (totalExpenseActual / (totalExpenseBudget || 1)) * 100)}%` }} />
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white font-medium">${totalExpenseActual.toLocaleString()} spent</span>
                <span className={`font-medium flex items-center gap-1 ${totalExpenseBudget - totalExpenseActual < 0 ? 'text-[#ef4444]' : 'text-zinc-400'}`}>
                  {totalExpenseBudget - totalExpenseActual < 0 && <RotateCcw size={14} />}
                  {totalExpenseBudget - totalExpenseActual < 0 ? '-' : ''}${Math.abs(totalExpenseBudget - totalExpenseActual).toLocaleString()} remaining
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
