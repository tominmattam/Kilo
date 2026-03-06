import React, { useMemo } from 'react';
import { useAppContext } from '../store';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, Sankey, Layer, Rectangle } from 'recharts';
import { format, subDays, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, parseISO, addMonths, endOfDay, startOfDay } from 'date-fns';
import { TrendingUp, TrendingDown, DollarSign, Wallet, PiggyBank, CreditCard, Activity, PieChart as PieChartIcon } from 'lucide-react';

import { CATEGORY_GROUPS } from '../constants';

interface DashboardProps {
  dateFilter: string;
  customDateRange: { start: string; end: string };
  setActivePage: (page: any) => void;
  setCategoryFilter: (category: string) => void;
}

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#64748b'];

// Monarch-inspired palette
const GROUP_COLORS: Record<string, string> = {
  'Income': '#0ea5e9', // Sky blue
  'Savings': '#22c55e', // Green
  'Housing': '#8b5cf6', // Violet
  'Food & Dining': '#f43f5e', // Rose
  'Auto & Transport': '#f97316', // Orange
  'Bills & Utilities': '#06b6d4', // Cyan
  'Shopping': '#d946ef', // Fuchsia
  'Entertainment': '#ec4899', // Pink
  'Health & Wellness': '#ef4444', // Red
  'Deficit': '#ef4444', // Red
  'Other': '#64748b', // Slate
};

export const Dashboard: React.FC<DashboardProps> = ({ dateFilter, customDateRange, setActivePage, setCategoryFilter }) => {
  const { data } = useAppContext();
  const { transactions, categories, budgets, networth } = data;

  const totalAssets = useMemo(() => networth.assets.reduce((sum, item) => sum + item.value, 0), [networth.assets]);
  const totalLiabilities = useMemo(() => networth.liabilities.reduce((sum, item) => sum + item.value, 0), [networth.liabilities]);
  const totalNetWorth = totalAssets - totalLiabilities;

  const filteredTransactions = useMemo(() => {
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
      start = subDays(today, 90);
      end = endOfMonth(today);
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

    return transactions.filter(t => {
      if (t.hidden) return false;
      const d = parseISO(t.date);
      if (start && d < start) return false;
      if (end && d > end) return false;
      return true;
    });
  }, [transactions, dateFilter, customDateRange]);

  const expenses = filteredTransactions.filter(t => t.type === 'expense');
  const credits = filteredTransactions.filter(t => t.type === 'credit');
  
  const ignoredCategories = ['Payments', 'Transfer', 'Credit Card Payment', 'Investing'];
  const nonPayExpenses = expenses.filter(t => !ignoredCategories.includes(t.category));
  const validCredits = credits.filter(t => !ignoredCategories.includes(t.category));

  const totalSpent = nonPayExpenses.reduce((sum, t) => sum + t.amount, 0);
  const totalCred = validCredits.reduce((sum, t) => sum + t.amount, 0);
  const net = totalCred - totalSpent;
  const savingsPct = totalCred > 0 ? (net / totalCred) * 100 : 0;
  const avgTxn = nonPayExpenses.length > 0 ? totalSpent / nonPayExpenses.length : 0;

  // Calculate trend (vs previous period)
  const trend = useMemo(() => {
    // Simple approximation: compare this period's daily average to previous?
    // Or just use monthly totals if available.
    return 0; // Placeholder for now, can be enhanced
  }, []);

  // Helper to generate distinct colors
  const getDistinctColor = (index: number) => {
    const hue = (index * 137.508) % 360; // Golden angle approximation
    return `hsl(${hue}, 70%, 50%)`;
  };

  const categoryTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    nonPayExpenses.forEach(t => {
      if (t.splits && t.splits.length > 0) {
        t.splits.forEach(s => {
          totals[s.category] = (totals[s.category] || 0) + s.amount;
        });
      } else {
        totals[t.category] = (totals[t.category] || 0) + t.amount;
      }
    });
    return Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], index) => ({ 
        name, 
        value, 
        // Use generated distinct color based on rank/index
        color: getDistinctColor(index), 
        icon: categories[name]?.icon || '📦' 
      }));
  }, [nonPayExpenses, categories]);

  const allNonPayExpenses = useMemo(() => {
    const ignoredCategories = ['Payments', 'Transfer', 'Credit Card Payment', 'Investing'];
    return transactions.filter(t => 
      t.type === 'expense' && 
      !t.hidden && 
      !ignoredCategories.includes(t.category)
    );
  }, [transactions]);

  const monthlyTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    allNonPayExpenses.forEach(t => {
      const month = t.date.substring(0, 7);
      totals[month] = (totals[month] || 0) + t.amount;
    });

    // Generate last 6 months keys to ensure continuity
    const result = [];
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
        const d = subMonths(today, i);
        const key = format(d, 'yyyy-MM');
        result.push({
            month: key,
            amount: totals[key] || 0
        });
    }
    return result;
  }, [allNonPayExpenses]);

  const topMerchants = useMemo(() => {
    const merchants: Record<string, { total: number; count: number }> = {};
    nonPayExpenses.forEach(t => {
      const short = t.description.substring(0, 34);
      if (!merchants[short]) merchants[short] = { total: 0, count: 0 };
      merchants[short].total += t.amount;
      merchants[short].count += 1;
    });
    return Object.entries(merchants)
      .map(([name, { total, count }]) => ({ name, total, count }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [nonPayExpenses]);

  const sankeyData = useMemo(() => {
    if (totalSpent === 0 && totalCred === 0) return null;

    const nodes: { id: string, name: string, color: string }[] = [];
    const links: { source: number, target: number, value: number }[] = [];
    
    // We will build nodes in a specific order to help the layout engine
    // 1. Income Sources & Deficit (Level 0)
    // 2. Main Income Node (Level 1)
    // 3. Savings & Groups (Level 2)
    // 4. Categories (Level 3)

    const nodeIndices = new Map<string, number>();
    const addNode = (id: string, name: string, color: string) => {
      if (!nodeIndices.has(id)) {
        nodeIndices.set(id, nodes.length);
        nodes.push({ id, name, color });
      }
      return nodeIndices.get(id)!;
    };

    // --- Level 1: Main Income Node ---
    const incomeNodeIdx = addNode('node-income', 'Income', GROUP_COLORS['Income']);

    // --- Level 0: Income Sources ---
    const incomeByCat: Record<string, number> = {};
    validCredits.forEach(t => {
      incomeByCat[t.category] = (incomeByCat[t.category] || 0) + t.amount;
    });

    Object.entries(incomeByCat).forEach(([cat, val]) => {
      if (val > 0) {
        const idx = addNode(`source-${cat}`, cat, categories[cat]?.color || '#10b981');
        links.push({ source: idx, target: incomeNodeIdx, value: val });
      }
    });

    // --- Level 0: Deficit (if any) ---
    if (net < 0) {
      const deficitIdx = addNode('node-deficit', 'Deficit', GROUP_COLORS['Deficit']);
      links.push({ source: deficitIdx, target: incomeNodeIdx, value: Math.abs(net) });
    }

    // --- Level 2: Savings (if any) ---
    if (net > 0) {
      const savingsIdx = addNode('node-savings', 'Savings', GROUP_COLORS['Savings']);
      links.push({ source: incomeNodeIdx, target: savingsIdx, value: net });
    }

    // --- Level 2 & 3: Groups and Categories ---
    // Prepare group data
    const groupTotals: Record<string, number> = {};
    const groupToCats: Record<string, typeof categoryTotals> = {};

    const catToGroup: Record<string, string> = {};
    Object.entries(CATEGORY_GROUPS).forEach(([group, cats]) => {
      cats.forEach(c => catToGroup[c] = group);
    });

    categoryTotals.forEach(cat => {
      const group = catToGroup[cat.name] || 'Other';
      groupTotals[group] = (groupTotals[group] || 0) + cat.value;
      if (!groupToCats[group]) groupToCats[group] = [];
      groupToCats[group].push(cat);
    });

    // Sort groups by value for better visual layout
    const sortedGroups = Object.entries(groupTotals).sort((a, b) => b[1] - a[1]);

    sortedGroups.forEach(([group, val]) => {
      if (val > 0) {
        const groupIdx = addNode(`group-${group}`, group, GROUP_COLORS[group] || GROUP_COLORS['Other']);
        
        // Link Income -> Group
        links.push({ source: incomeNodeIdx, target: groupIdx, value: val });

        // Link Group -> Categories
        const groupCats = groupToCats[group];
        if (groupCats) {
          // Sort categories by value
          groupCats.sort((a, b) => b.value - a.value);
          
          groupCats.forEach(cat => {
            if (cat.value > 0) {
              const catIdx = addNode(`cat-${cat.name}`, cat.name, cat.color);
              links.push({ source: groupIdx, target: catIdx, value: cat.value });
            }
          });
        }
      }
    });

    if (nodes.length < 2 || links.length === 0) return null;

    return { nodes, links };
  }, [totalCred, totalSpent, net, categoryTotals, validCredits, categories]);

  const handleCategoryClick = (categoryName: string) => {
    if (!categoryName) return;
    setCategoryFilter(categoryName);
    setActivePage('Transactions');
  };

  // Custom Sankey Link
  const SankeyLink = ({ sourceX, targetX, sourceY, targetY, sourceControlX, targetControlX, linkWidth, index, payload }: any) => {
    if (isNaN(sourceX) || isNaN(targetX) || isNaN(sourceY) || isNaN(targetY)) return null;

    const sourceColor = payload.source.color || '#8884d8';
    const targetColor = payload.target.color || '#8884d8';
    const gradientId = `linkGradient-${index}`;

    return (
      <Layer key={`CustomLink${index}`}>
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={sourceColor} stopOpacity={0.4} />
            <stop offset="100%" stopColor={targetColor} stopOpacity={0.4} />
          </linearGradient>
        </defs>
        <path
          d={`
            M${sourceX},${sourceY}
            C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}
          `}
          stroke={`url(#${gradientId})`}
          strokeWidth={Math.max(1, linkWidth)}
          fill="none"
          className="transition-all duration-300 opacity-60 hover:opacity-100"
        />
      </Layer>
    );
  };

  // Custom Sankey Node
  const SankeyNode = ({ x, y, width, height, index, payload }: any) => {
    if (isNaN(x) || isNaN(y) || isNaN(width) || isNaN(height)) return null;
    
    // Determine node level based on x position to align text
    const isLeft = x < 300;

    const isClickable = payload.id 
      ? (payload.id.startsWith('cat-') || payload.id.startsWith('source-'))
      : !['Income', 'Savings', 'Deficit', ...Object.keys(CATEGORY_GROUPS)].includes(payload.name);

    return (
      <Layer 
        key={`CustomNode${index}`} 
        onClick={() => isClickable && handleCategoryClick(payload.name)}
        style={{ cursor: isClickable ? 'pointer' : 'default' }}
      >
        <defs>
          <filter id={`shadow-${index}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#000000" floodOpacity="0.3" />
          </filter>
        </defs>
        <Rectangle 
          x={x} y={y} 
          width={width} 
          height={height} 
          fill={payload.color || '#8884d8'} 
          fillOpacity="1" 
          rx={4} 
          filter={`url(#shadow-${index})`}
          className={isClickable ? "transition-all duration-200 hover:brightness-110" : ""}
        />
        
        {/* Label */}
        <text
          textAnchor={isLeft ? 'end' : 'start'}
          x={isLeft ? x - 12 : x + width + 12}
          y={y + height / 2 - 6}
          fontSize="13"
          fontWeight="600"
          fill="#ffffff"
          dominantBaseline="middle"
          style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
        >
          {payload.name}
        </text>
        
        {/* Value */}
        {height > 12 && (
          <text
            textAnchor={isLeft ? 'end' : 'start'}
            x={isLeft ? x - 12 : x + width + 12}
            y={y + height / 2 + 10}
            fontSize="12"
            fill="rgba(255,255,255,0.6)"
            dominantBaseline="middle"
            fontFamily="monospace"
          >
            ${payload.value?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </text>
        )}
      </Layer>
    );
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-end gap-4">
        <h1 className="text-4xl font-bold text-white tracking-tight font-display">Dashboard</h1>
        <span className="text-zinc-500 pb-1.5 font-mono text-sm px-3 py-1 bg-[#252525] rounded-full border border-white/5">{dateFilter}</span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <MetricCard 
          label="Net Worth" 
          value={`$${totalNetWorth.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} 
          sub={`${networth.assets.length + networth.liabilities.length} items`}
          icon={<PiggyBank size={18} className="text-emerald-400" />}
          valueColor={totalNetWorth >= 0 ? 'text-emerald-400' : 'text-red-400'}
        />
        <MetricCard 
          label="Total Spent" 
          value={`$${totalSpent.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} 
          sub={`${nonPayExpenses.length} transactions`}
          icon={<CreditCard size={18} className="text-blue-400" />}
          trend="neutral"
          valueColor="text-white"
        />
        <MetricCard 
          label="Income" 
          value={`$${totalCred.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} 
          icon={<DollarSign size={18} className="text-emerald-400" />}
          trend="up"
          valueColor="text-white"
        />
        <MetricCard 
          label="Net Cash Flow" 
          value={`$${net.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} 
          valueColor={net >= 0 ? 'text-emerald-400' : 'text-red-400'} 
          icon={<Wallet size={18} className={net >= 0 ? 'text-emerald-400' : 'text-red-400'} />}
        />
        <MetricCard 
          label="Savings Rate" 
          value={`${Math.max(0, savingsPct).toFixed(1)}%`} 
          icon={<TrendingUp size={18} className="text-violet-400" />}
          valueColor="text-white"
        />
        <MetricCard 
          label="Avg / Txn" 
          value={`$${avgTxn.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} 
          icon={<Activity size={18} className="text-orange-400" />}
          valueColor="text-white"
        />
      </div>

      {/* Sankey Chart */}
      {sankeyData ? (
        <div className="bg-[#1e1e1e] border border-white/5 rounded-2xl shadow-xl p-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-violet-500 to-emerald-500 opacity-50"></div>
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-white font-bold text-xl tracking-tight flex items-center gap-2">
                <Activity size={20} className="text-blue-400" />
                Cash Flow Visualization
              </h3>
              <p className="text-zinc-400 text-sm mt-1">Trace how your income flows into expenses and savings.</p>
            </div>
          </div>
          <div className="-mx-4" style={{ height: Math.max(800, categoryTotals.length * 45 + 200) }}>
            <ResponsiveContainer width="100%" height="100%">
              <Sankey
                data={sankeyData}
                node={<SankeyNode />}
                link={<SankeyLink />}
                nodePadding={20}
                nodeWidth={12}
                margin={{ left: 150, right: 150, top: 20, bottom: 20 }}
              >
                <Tooltip
                  formatter={(value: number) => `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                  contentStyle={{ 
                    backgroundColor: 'var(--color-bg-panel)', 
                    borderColor: 'var(--color-border-subtle)', 
                    borderRadius: '12px', 
                    color: 'var(--color-text-primary)', 
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                    backdropFilter: 'blur(12px)'
                  }}
                  itemStyle={{ color: 'var(--color-text-primary)', fontFamily: 'monospace' }}
                />
              </Sankey>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="bg-[#1e1e1e] border border-white/5 rounded-2xl shadow-xl p-12 text-center">
          <div className="w-16 h-16 bg-[#252525] rounded-full flex items-center justify-center mx-auto mb-4">
            <Activity size={32} className="text-zinc-400 dark:text-zinc-600" />
          </div>
          <h3 className="text-white font-bold text-lg">Not Enough Data</h3>
          <p className="text-zinc-500 mt-2">Add more income and expenses to visualize your cash flow.</p>
        </div>
      )}

      {/* Category Spending - Full Width */}
      <div className="bg-[#1e1e1e] border border-white/5 rounded-2xl shadow-xl p-8 flex flex-col">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-white font-bold text-xl tracking-tight flex items-center gap-2">
            <PieChartIcon size={20} className="text-violet-400" />
            Spending by Category
          </h3>
        </div>
        <div className="flex flex-col lg:flex-row gap-12 flex-1 items-center">
          <div className="w-full lg:w-5/12 h-[400px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryTotals}
                  cx="50%"
                  cy="50%"
                  innerRadius="65%"
                  outerRadius="85%"
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                  cornerRadius={4}
                  onClick={(data) => handleCategoryClick(data?.name || data?.payload?.name)}
                  className="cursor-pointer"
                >
                  {categoryTotals.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.color} 
                      stroke="rgba(0,0,0,0.2)" 
                      strokeWidth={2} 
                      className="transition-all duration-200 hover:opacity-80"
                    />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => `$${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                  contentStyle={{ backgroundColor: 'var(--color-bg-panel)', borderColor: 'var(--color-border-subtle)', borderRadius: '12px', color: 'var(--color-text-primary)', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', backdropFilter: 'blur(12px)' }}
                  itemStyle={{ color: 'var(--color-text-primary)' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <div className="text-3xl font-bold text-white mb-1">${totalSpent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <div className="text-sm text-zinc-500 font-medium">Total</div>
              </div>
            </div>
          </div>
          <div className="w-full lg:w-7/12 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-8 gap-y-6">
            {categoryTotals.slice(0, 12).map((cat, idx) => (
              <div 
                key={idx} 
                className="flex flex-col group cursor-pointer p-2 -m-2 rounded-lg hover:bg-white/5 transition-colors"
                onClick={() => handleCategoryClick(cat.name)}
              >
                <div className="flex items-center gap-2 min-w-0 mb-1">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                  <span className="text-sm text-zinc-300 truncate font-medium group-hover:text-white transition-colors">{cat.name}</span>
                </div>
                <div className="flex items-center gap-2 text-xs pl-4.5">
                  <span className="font-bold text-white">${cat.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  <span className="text-zinc-500">({((cat.value / totalSpent) * 100).toFixed(1)}%)</span>
                </div>
              </div>
            ))}
            {categoryTotals.length > 12 && (
              <div className="col-span-full mt-4">
                <button className="text-sm text-blue-400 hover:text-blue-300 transition-colors font-medium flex items-center gap-1">
                  Show all {categoryTotals.length} categories
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6">
        {/* Monthly Trend */}
        <div className="bg-[#1e1e1e] border border-white/5 rounded-2xl shadow-xl p-6 flex flex-col">
          <h3 className="text-white font-bold text-lg tracking-tight mb-6 flex items-center gap-2">
            <TrendingUp size={18} className="text-orange-400" />
            Monthly Spending Trend
          </h3>
          <div className="flex-1 min-h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyTotals} margin={{ top: 20, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fb923c" stopOpacity={1}/>
                    <stop offset="100%" stopColor="#fb923c" stopOpacity={0.6}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-subtle)" />
                <XAxis 
                  dataKey="month" 
                  tickFormatter={(val) => {
                    try { return format(parseISO(`${val}-01`), 'MMM'); } catch { return val; }
                  }} 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: 'var(--color-text-muted)', fontSize: 14, fontWeight: 500 }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: 'var(--color-text-muted)', fontSize: 14 }} 
                  tickFormatter={(val) => `$${val.toLocaleString(undefined, { notation: 'compact' })}`} 
                />
                <Tooltip 
                  formatter={(value: number) => `$${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                  contentStyle={{ backgroundColor: 'var(--color-bg-panel)', borderColor: 'var(--color-border-subtle)', borderRadius: '12px', color: 'var(--color-text-primary)', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', backdropFilter: 'blur(12px)' }}
                  cursor={{ fill: 'var(--color-border-subtle)' }}
                />
                <Bar 
                  dataKey="amount" 
                  fill="url(#barGradient)" 
                  radius={[6, 6, 0, 0]} 
                  barSize={32}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent & Upcoming Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Transactions */}
        <div className="bg-[#1e1e1e] border border-white/5 rounded-2xl shadow-xl p-6">
          <h3 className="text-white font-bold text-lg tracking-tight mb-6">Recent Transactions</h3>
          <div className="space-y-1">
            {filteredTransactions.slice(0, 5).map(t => (
              <div key={t.id} className="grid grid-cols-[1fr_auto] py-3 border-b border-white/5 text-sm items-center hover:bg-white/[0.02] transition-colors -mx-2 px-4 rounded-lg group">
                <div className="min-w-0 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#252525] flex items-center justify-center text-lg shadow-inner">
                    {categories[t.category]?.icon || '📦'}
                  </div>
                  <div>
                    <div className="text-zinc-700 dark:text-zinc-200 truncate font-medium group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">{t.description}</div>
                    <div className="text-xs text-zinc-500 flex gap-2">
                      <span>{format(parseISO(t.date), 'MMM d')}</span>
                      <span className="text-zinc-300 dark:text-zinc-700">•</span>
                      <span className="text-zinc-400">{t.category}</span>
                    </div>
                  </div>
                </div>
                <div className={`text-right font-bold font-mono ${t.type === 'credit' ? 'text-emerald-500' : 'text-white'}`}>
                  {t.type === 'credit' ? '+' : ''}${t.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            ))}
            {filteredTransactions.length === 0 && <div className="text-zinc-500 text-sm py-4 text-center">No transactions found.</div>}
          </div>
        </div>

        {/* Upcoming Recurring */}
        <div className="bg-[#1e1e1e] border border-white/5 rounded-2xl shadow-xl p-6">
          <h3 className="text-white font-bold text-lg tracking-tight mb-6">Upcoming Bills</h3>
             <div className="space-y-3">
            {(() => {
               const { recurring } = data;
               
               const upcoming = recurring
                .filter(r => r.type === 'expense')
                .map(r => {
                  const today = new Date();
                  const currentMonth = today.getMonth() + 1;
                  const currentYear = today.getFullYear();
                  let nextDate = new Date(currentYear, currentMonth - 1, r.day);
                  if (nextDate < startOfDay(today)) {
                    nextDate = addMonths(nextDate, 1);
                  }
                  const diffTime = Math.abs(nextDate.getTime() - today.getTime());
                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                  return { ...r, nextDate, diffDays };
                })
                .filter(r => r.diffDays <= 30)
                .sort((a, b) => a.nextDate.getTime() - b.nextDate.getTime())
                .slice(0, 5);

               if (upcoming.length === 0) return <div className="text-zinc-500 text-sm py-4 text-center">No upcoming bills in the next 30 days.</div>;

               return upcoming.map(r => (
                 <div key={r.id} className="flex items-center justify-between bg-[#252525] border border-white/5 rounded-xl p-3 hover:bg-white/[0.04] transition-colors group">
                   <div className="flex items-center gap-3">
                     <div className="bg-zinc-100 dark:bg-[#111318] text-zinc-400 text-xs font-bold px-2.5 py-1.5 rounded-lg border border-white/5 text-center min-w-[44px] shadow-sm">
                       <div className="text-[9px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500">{format(r.nextDate, 'MMM')}</div>
                       <div className="text-base text-white font-display">{format(r.nextDate, 'd')}</div>
                     </div>
                     <div>
                       <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-200 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">{r.name}</div>
                       <div className={`text-xs font-medium ${r.diffDays === 0 ? 'text-orange-500' : 'text-zinc-500'}`}>
                         {r.diffDays === 0 ? 'Due today' : `In ${r.diffDays} days`}
                       </div>
                     </div>
                   </div>
                   <div className="font-bold text-white text-sm font-mono bg-[#252525] px-2 py-1 rounded-md border border-white/5">
                     ${r.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                   </div>
                 </div>
               ));
            })()}
          </div>
        </div>
      </div>
    </div>
  );
};

const MetricCard = ({ label, value, sub, valueColor = 'text-white', icon, trend }: { label: string, value: string, sub?: string, valueColor?: string, icon?: React.ReactNode, trend?: 'up' | 'down' | 'neutral' }) => (
  <div className="bg-[#1e1e1e] border border-white/5 rounded-2xl shadow-xl p-5 relative overflow-hidden group hover:border-blue-500/30 transition-all duration-300">
    <div className="absolute inset-0 bg-gradient-to-br from-black/5 dark:from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
    
    <div className="flex justify-between items-start mb-3 relative z-10">
      <div className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">{label}</div>
      {icon && <div className="text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">{icon}</div>}
    </div>
    
    <div className={`text-3xl font-bold tracking-tight font-display relative z-10 transition-colors duration-300 ${valueColor}`}>
      {value}
    </div>
    
    {sub && <div className="text-xs text-zinc-500 mt-2 relative z-10 font-mono flex items-center gap-1">
      {sub}
    </div>}
  </div>
);
