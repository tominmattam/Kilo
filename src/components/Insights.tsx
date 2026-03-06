import React, { useMemo } from 'react';
import { useAppContext } from '../store';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { parseISO, format, getDay, subMonths, isAfter, startOfMonth } from 'date-fns';
import { Lightbulb, TrendingUp, TrendingDown, Calendar, AlertTriangle, CheckCircle, Activity, ShoppingBag, Hourglass, Anchor, PiggyBank, ArrowRight, Target } from 'lucide-react';

export const Insights: React.FC = () => {
  const { data } = useAppContext();
  const { transactions, categories, budgets, networth, recurring } = data;

  const { 
    nonPayExpenses, monthlyTotals, catTotals, dowAvg, topVendor, topVendorAmt, 
    momChange, prevAmt, currAmt, mostVolatile, budAlerts, wknd, wkdy, 
    possibleSubscriptions, largeTransactions,
    runwayMonths, fixedCostRatio, lifestyleCreep, projectedSavings,
    monthsToDebtFree, forecastAmt, budgetRecommendations
  } = useMemo(() => {
    const ignoredCategories = ['Payments', 'Transfer', 'Credit Card Payment', 'Investing'];
    const sixMonthsAgo = startOfMonth(subMonths(new Date(), 5));
    
    const allNp = transactions.filter(t => {
      const d = parseISO(t.date);
      return t.type === 'expense' && !t.hidden && !ignoredCategories.includes(t.category) && d >= sixMonthsAgo;
    });
    
    const allIncome = transactions.filter(t => {
      const d = parseISO(t.date);
      return t.type === 'credit' && !t.hidden && !ignoredCategories.includes(t.category) && d >= sixMonthsAgo;
    });
    
    const catTotals: Record<string, number> = {};
    const monthly: Record<string, number> = {};
    const monthlyIncome: Record<string, number> = {};
    const vendors: Record<string, number> = {};
    const dow: Record<number, { sum: number, count: number }> = {};
    const catMonthly: Record<string, Record<string, number>> = {};
    
    let wknd = 0;
    let wkdy = 0;

    allNp.forEach(t => {
      const amt = t.amount;
      const date = parseISO(t.date);
      const month = t.date.substring(0, 7);
      const day = getDay(date); // 0 = Sunday, 6 = Saturday
      const shortDesc = t.description.substring(0, 35);

      if (t.splits && t.splits.length > 0) {
        t.splits.forEach(s => {
          catTotals[s.category] = (catTotals[s.category] || 0) + s.amount;
          if (!catMonthly[s.category]) catMonthly[s.category] = {};
          catMonthly[s.category][month] = (catMonthly[s.category][month] || 0) + s.amount;
        });
      } else {
        catTotals[t.category] = (catTotals[t.category] || 0) + amt;
        if (!catMonthly[t.category]) catMonthly[t.category] = {};
        catMonthly[t.category][month] = (catMonthly[t.category][month] || 0) + amt;
      }

      monthly[month] = (monthly[month] || 0) + amt;
      vendors[shortDesc] = (vendors[shortDesc] || 0) + amt;
      
      if (!dow[day]) dow[day] = { sum: 0, count: 0 };
      dow[day].sum += amt;
      dow[day].count += 1;

      if (day === 0 || day === 6) wknd += amt;
      else wkdy += amt;
    });

    allIncome.forEach(t => {
        const month = t.date.substring(0, 7);
        monthlyIncome[month] = (monthlyIncome[month] || 0) + t.amount;
    });

    const sortedMonths = Object.keys(monthly).sort();
    const monthlyTotals = sortedMonths.map(m => ({ month: m, amount: monthly[m] }));

    // --- Basic Stats ---
    let momChange = 0;
    let prevAmt = 0;
    let currAmt = 0;
    if (monthlyTotals.length >= 2) {
      prevAmt = monthlyTotals[monthlyTotals.length - 2].amount;
      currAmt = monthlyTotals[monthlyTotals.length - 1].amount;
      momChange = prevAmt > 0 ? ((currAmt - prevAmt) / prevAmt) * 100 : 0;
    }

    let topVendor = null;
    let topVendorAmt = 0;
    Object.entries(vendors).forEach(([v, a]) => {
      if (a > topVendorAmt) {
        topVendorAmt = a;
        topVendor = v;
      }
    });

    const dowNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    let topDow = null;
    let topDowAvg = 0;
    Object.entries(dow).forEach(([d, { sum, count }]) => {
      const avg = sum / count;
      if (avg > topDowAvg) {
        topDowAvg = avg;
        topDow = dowNames[parseInt(d)];
      }
    });

    // --- Volatility ---
    let mostVolatile = null;
    let maxStdDev = 0;
    Object.entries(catMonthly).forEach(([cat, mData]) => {
      const vals = Object.values(mData);
      if (vals.length > 1) {
        const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
        const variance = vals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / vals.length;
        const stdDev = Math.sqrt(variance);
        if (stdDev > maxStdDev) {
          maxStdDev = stdDev;
          mostVolatile = { cat, stdDev };
        }
      }
    });

    const budAlerts = Object.entries(budgets)
      .filter(([c, b]: [string, any]) => b > 0 && (catTotals[c] || 0) > b)
      .map(([c, b]: [string, any]) => ({ cat: c, pct: ((catTotals[c] || 0) / b) * 100, sp: catTotals[c] || 0, bud: b }))
      .sort((a, b) => b.pct - a.pct);

    // --- Subscriptions ---
    const subMap: Record<string, { count: number, amt: number, desc: string }> = {};
    allNp.forEach(t => {
      const key = `${t.description.substring(0, 20)}_${Math.round(t.amount)}`;
      if (!subMap[key]) subMap[key] = { count: 0, amt: t.amount, desc: t.description };
      subMap[key].count += 1;
    });
    const possibleSubscriptions = Object.values(subMap)
      .filter(s => s.count >= 2 && s.amt > 0 && s.amt < 200)
      .sort((a, b) => b.count - a.count);

    // --- Large Transactions ---
    let largeTransactions: any[] = [];
    const allAmts = allNp.map(t => t.amount);
    if (allAmts.length > 0) {
      const meanAmt = allAmts.reduce((a, b) => a + b, 0) / allAmts.length;
      const varAmt = allAmts.reduce((a, b) => a + Math.pow(b - meanAmt, 2), 0) / allAmts.length;
      const stdDevAmt = Math.sqrt(varAmt);
      largeTransactions = allNp
        .filter(t => t.amount > meanAmt + (2.5 * stdDevAmt) && t.amount > 100)
        .sort((a, b) => b.amount - a.amount);
    }

    // --- NEW AI INSIGHTS ---

    // 1. Financial Runway
    const totalAssets = networth.assets.reduce((sum, a) => sum + a.value, 0);
    const avgMonthlyExpense = monthlyTotals.length > 0 
        ? monthlyTotals.reduce((sum, m) => sum + m.amount, 0) / monthlyTotals.length 
        : 0;
    const runwayMonths = avgMonthlyExpense > 0 ? totalAssets / avgMonthlyExpense : 0;

    // 2. Fixed Cost Ratio
    const totalRecurringMonthly = recurring
        .filter(r => r.type === 'expense')
        .reduce((sum, r) => sum + r.amount, 0);
    const fixedCostRatio = avgMonthlyExpense > 0 ? (totalRecurringMonthly / avgMonthlyExpense) * 100 : 0;

    // 3. Lifestyle Creep (Last 3 months vs Previous 3 months)
    let lifestyleCreep = 0;
    if (monthlyTotals.length >= 6) {
        const last3 = monthlyTotals.slice(-3);
        const prev3 = monthlyTotals.slice(-6, -3);
        const avgLast3 = last3.reduce((s, m) => s + m.amount, 0) / 3;
        const avgPrev3 = prev3.reduce((s, m) => s + m.amount, 0) / 3;
        if (avgPrev3 > 0) {
            lifestyleCreep = ((avgLast3 - avgPrev3) / avgPrev3) * 100;
        }
    }

    // 4. Projected Savings
    const avgMonthlyIncome = Object.values(monthlyIncome).length > 0
        ? Object.values(monthlyIncome).reduce((a, b) => a + b, 0) / Object.values(monthlyIncome).length
        : 0;
    const projectedSavings = (avgMonthlyIncome - avgMonthlyExpense) * 12;

    // 5. Debt Freedom
    const totalLiabilities = networth.liabilities.reduce((sum, l) => sum + l.value, 0);
    const monthlySurplus = avgMonthlyIncome - avgMonthlyExpense;
    const monthsToDebtFree = (totalLiabilities > 0 && monthlySurplus > 0) ? totalLiabilities / monthlySurplus : 0;

    // 6. End of Month Forecast
    const today = new Date();
    const currentMonthKey = format(today, 'yyyy-MM');
    const currentMonthSpent = monthly[currentMonthKey] || 0;
    const daysInMonth = 30; // Approximation or use date-fns getDaysInMonth
    const dayOfMonth = today.getDate();
    const forecastAmt = dayOfMonth > 0 ? (currentMonthSpent / dayOfMonth) * daysInMonth : 0;

    // 7. Smart Budget Recommendations
    const budgetRecommendations: { cat: string, avg: number, curr: number, diff: number }[] = [];
    Object.entries(catMonthly).forEach(([cat, mData]) => {
        const vals = Object.values(mData);
        if (vals.length >= 2) {
             const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
             const currBud = budgets[cat] || 0;
             if (currBud > 0 && avg > currBud * 1.15) {
                 budgetRecommendations.push({ cat, avg, curr: currBud, diff: avg - currBud });
             }
        }
    });

    return {
      nonPayExpenses: allNp,
      monthlyTotals,
      catTotals,
      dowAvg: { topDow, topDowAvg },
      topVendor,
      topVendorAmt,
      momChange,
      prevAmt,
      currAmt,
      mostVolatile,
      budAlerts,
      wknd,
      wkdy,
      possibleSubscriptions,
      largeTransactions,
      runwayMonths,
      fixedCostRatio,
      lifestyleCreep,
      projectedSavings,
      monthsToDebtFree,
      forecastAmt,
      budgetRecommendations
    };
  }, [transactions, budgets, networth, recurring]);

  if (nonPayExpenses.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-white tracking-tight">AI Insights</h1>
        <div className="bg-[#1e1e1e] border border-white/5 rounded-2xl shadow-xl p-12 text-center">
          <div className="w-16 h-16 bg-[#252525] rounded-full flex items-center justify-center mx-auto mb-4">
            <Lightbulb size={32} className="text-zinc-400 dark:text-zinc-600" />
          </div>
          <h3 className="text-white font-bold text-lg">No Insights Yet</h3>
          <p className="text-zinc-500 mt-2">Upload transactions to generate personalized insights.</p>
        </div>
      </div>
    );
  }

  const totalAll = wknd + wkdy;
  const wkndPct = totalAll > 0 ? (wknd / totalAll) * 100 : 0;

  const topCat = Object.entries(catTotals).sort((a: [string, any], b: [string, any]) => b[1] - a[1])[0] as [string, number] | undefined;
  const topCatPct = totalAll > 0 && topCat ? (topCat[1] / totalAll) * 100 : 0;

  const avgAll = monthlyTotals.length > 0 ? monthlyTotals.reduce((s, m) => s + m.amount, 0) / monthlyTotals.length : 0;

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-end gap-4">
        <h1 className="text-4xl font-bold text-white tracking-tight font-display">Insights</h1>
      </div>
      <p className="text-zinc-400 font-mono text-sm">Personalised analysis of your spending patterns.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-6">
          {/* --- NEW: Financial Runway --- */}
          {runwayMonths > 0 && (
            <InsightCard
                icon={<Hourglass size={24} />}
                title="Financial Runway"
                body={<span>At your current spending rate, your assets could sustain you for <b>{runwayMonths.toFixed(1)} months</b> without income. {runwayMonths < 3 ? 'Consider building an emergency fund.' : 'You have a solid safety net.'}</span>}
                accent={runwayMonths > 6 ? '#10b981' : runwayMonths > 3 ? '#f59e0b' : '#ef4444'}
                badge={`${runwayMonths.toFixed(1)} Months`}
            />
          )}

          {/* --- NEW: Lifestyle Creep --- */}
          {lifestyleCreep !== 0 && (
            <InsightCard
                icon={<TrendingUp size={24} />}
                title="Lifestyle Trends"
                body={<span>Your spending has {lifestyleCreep > 0 ? 'increased' : 'decreased'} by <b>{Math.abs(lifestyleCreep).toFixed(1)}%</b> over the last 3 months compared to the prior period. {lifestyleCreep > 5 ? 'Watch out for lifestyle inflation.' : 'Good job keeping costs stable.'}</span>}
                accent={lifestyleCreep > 5 ? '#ef4444' : '#3b82f6'}
                badge={lifestyleCreep > 0 ? 'Inflation' : 'Deflation'}
            />
          )}

          {/* --- NEW: Forecast --- */}
          {forecastAmt > 0 && (
            <InsightCard
                icon={<TrendingUp size={24} />}
                title="End of Month Forecast"
                body={<span>Based on your daily spending, you are projected to spend <b>${forecastAmt.toLocaleString(undefined, { maximumFractionDigits: 0 })}</b> this month.</span>}
                accent="#3b82f6"
                badge={`Proj: $${forecastAmt.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            />
          )}

          {/* --- NEW: Smart Budget --- */}
          {budgetRecommendations.length > 0 && (
            <InsightCard
                icon={<Target size={24} />}
                title="Smart Budget Tip"
                body={<span>You consistently spend <b>${budgetRecommendations[0].avg.toLocaleString(undefined, { maximumFractionDigits: 0 })}</b> on <b>{budgetRecommendations[0].cat}</b>, which is over your <b>${budgetRecommendations[0].curr}</b> budget. Consider increasing it by <b>${budgetRecommendations[0].diff.toLocaleString(undefined, { maximumFractionDigits: 0 })}</b>.</span>}
                accent="#f59e0b"
                badge="Adjustment"
            />
          )}

          {/* Top Category */}
          {topCat && (
            <InsightCard
              icon={<ShoppingBag size={24} />}
              title="Biggest Category"
              body={<span><b>{categories[topCat[0]]?.icon || '📦'} {topCat[0]}</b> is your top expense at <b>${Number(topCat[1]).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b> ({topCatPct.toFixed(0)}% of spending). {topCatPct > 40 ? 'Consider reviewing this.' : 'Looks reasonable.'}</span>}
              accent="#f97316"
              badge={`$${Number(topCat[1]).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            />
          )}

          {/* MoM */}
          {monthlyTotals.length >= 2 && (
            <InsightCard
              icon={momChange > 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
              title="Month-over-Month"
              body={<span>Spending went <b>{momChange > 0 ? 'up' : 'down'} {Math.abs(momChange).toFixed(1)}%</b> vs last month (<b>${prevAmt.toLocaleString(undefined, { maximumFractionDigits: 0 })}</b> → <b>${currAmt.toLocaleString(undefined, { maximumFractionDigits: 0 })}</b>). {momChange > 20 ? 'A significant spike — worth investigating!' : momChange < -10 ? 'Great reduction!' : 'Fairly steady.'}</span>}
              accent={momChange > 10 ? '#ff453a' : momChange > 0 ? '#ff9f0a' : '#34c759'}
              badge={`${momChange >= 0 ? '+' : ''}${momChange.toFixed(1)}%`}
            />
          )}

          {/* Weekend */}
          <InsightCard
            icon={<Calendar size={24} />}
            title="Weekend vs Weekday"
            body={<span><b>{wkndPct.toFixed(0)}%</b> of your spending happens on weekends (${wknd.toLocaleString(undefined, { maximumFractionDigits: 0 })}). Weekdays: ${wkdy.toLocaleString(undefined, { maximumFractionDigits: 0 })}. {wkndPct > 40 ? 'Weekends are your main splurge zone.' : 'Well balanced.'}</span>}
            accent="#8b5cf6"
            badge={`${wkndPct.toFixed(0)}% weekends`}
          />

          {/* Subscriptions */}
          {possibleSubscriptions.length > 0 && (
            <InsightCard
              icon={<Activity size={24} />}
              title="Hidden Subscriptions?"
              body={<span>We noticed you paid <b>{possibleSubscriptions[0].desc}</b> exactly <b>${possibleSubscriptions[0].amt.toLocaleString(undefined, { minimumFractionDigits: 2 })}</b> {possibleSubscriptions[0].count} times. Make sure you're still using this service!</span>}
              accent="#ec4899"
              badge="Recurring"
            />
          )}
        </div>

        <div className="space-y-6">
          {/* --- NEW: Fixed Cost Burden --- */}
          {fixedCostRatio > 0 && (
            <InsightCard
                icon={<Anchor size={24} />}
                title="Fixed Cost Burden"
                body={<span><b>{fixedCostRatio.toFixed(0)}%</b> of your spending is locked into recurring bills. {fixedCostRatio > 50 ? 'High fixed costs reduce your financial flexibility.' : 'You have good flexibility.'}</span>}
                accent={fixedCostRatio > 50 ? '#f59e0b' : '#3b82f6'}
                badge={`${fixedCostRatio.toFixed(0)}% Fixed`}
            />
          )}

          {/* --- NEW: Projected Savings --- */}
          {projectedSavings !== 0 && (
            <InsightCard
                icon={<PiggyBank size={24} />}
                title="Annual Projection"
                body={<span>Based on your current averages, you are on track to {projectedSavings > 0 ? 'save' : 'lose'} <b>${Math.abs(projectedSavings).toLocaleString(undefined, { maximumFractionDigits: 0 })}</b> this year.</span>}
                accent={projectedSavings > 0 ? '#10b981' : '#ef4444'}
                badge={projectedSavings > 0 ? 'Growing' : 'Shrinking'}
            />
          )}

          {/* --- NEW: Debt Freedom --- */}
          {monthsToDebtFree > 0 && (
            <InsightCard
                icon={<CheckCircle size={24} />}
                title="Debt Freedom"
                body={<span>With your current surplus, you could be debt-free in <b>{monthsToDebtFree.toFixed(1)} months</b> (approx {format(subMonths(new Date(), -Math.round(monthsToDebtFree)), 'MMM yyyy')}).</span>}
                accent="#8b5cf6"
                badge="Goal"
            />
          )}

          {/* Top Vendor */}
          {topVendor && (
            <InsightCard
              icon={<ShoppingBag size={24} />}
              title="Top Merchant"
              body={<span><b>{topVendor}</b> has received the most money: <b>${topVendorAmt.toLocaleString(undefined, { maximumFractionDigits: 0 })}</b> total. If it's a subscription or habit, verify you're still getting value.</span>}
              accent="#0ea5e9"
              badge={`$${topVendorAmt.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            />
          )}

          {/* Large Transactions */}
          {largeTransactions.length > 0 && (
            <InsightCard
              icon={<AlertTriangle size={24} />}
              title="Unusual Spike"
              body={<span>You had a massive transaction at <b>{largeTransactions[0].description}</b> for <b>${largeTransactions[0].amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</b>. This is way above your normal spending average.</span>}
              accent="#eab308"
              badge="Outlier"
            />
          )}

          {/* DOW */}
          {dowAvg.topDow && (
            <InsightCard
              icon={<Calendar size={24} />}
              title="Peak Spending Day"
              body={<span>You spend the most on <b>{dowAvg.topDow}s</b> (avg <b>${dowAvg.topDowAvg.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>/transaction). Being mindful on this day could have a big impact.</span>}
              accent="#fb923c"
              badge={dowAvg.topDow}
            />
          )}

          {/* Budget */}
          {budAlerts.length > 0 ? (
            <InsightCard
              icon={<AlertTriangle size={24} />}
              title="Budget Alert"
              body={<span><b>{categories[budAlerts[0].cat]?.icon || '📦'} {budAlerts[0].cat}</b> is at <b>{budAlerts[0].pct.toFixed(0)}%</b> of budget (<b>${budAlerts[0].sp.toLocaleString(undefined, { maximumFractionDigits: 0 })}</b> of <b>${budAlerts[0].bud.toLocaleString(undefined, { maximumFractionDigits: 0 })}</b>). {budAlerts[0].pct >= 100 ? 'Over limit!' : 'Approaching limit.'}</span>}
              accent={budAlerts[0].pct >= 100 ? '#ff453a' : '#ff9f0a'}
              badge={budAlerts[0].pct >= 100 ? 'Over!' : 'Near limit'}
            />
          ) : (
            <InsightCard
              icon={<CheckCircle size={24} />}
              title="Budget Health"
              body="All categories are within budget. Great job! Consider moving savings into investments."
              accent="#34c759"
              badge="On Track"
            />
          )}

          {/* Volatility */}
          {mostVolatile && mostVolatile.stdDev > 30 && (
            <InsightCard
              icon={<Activity size={24} />}
              title="Most Volatile Category"
              body={<span><b>{categories[mostVolatile.cat]?.icon || '📦'} {mostVolatile.cat}</b> varies the most month-to-month (std dev: <b>${mostVolatile.stdDev.toLocaleString(undefined, { maximumFractionDigits: 0 })}</b>). Set a generous buffer for this category.</span>}
              accent="#a855f7"
              badge="High Variance"
            />
          )}
        </div>
      </div>

      {/* History Chart */}
      {monthlyTotals.length >= 2 && (
        <div className="bg-[#1e1e1e] border border-white/5 rounded-2xl shadow-xl p-6 mt-8">
          <h3 className="text-white font-bold text-lg tracking-tight mb-6 flex items-center gap-2">
            <TrendingUp size={20} className="text-blue-400" />
            Spending History
          </h3>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyTotals} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="historyGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={1}/>
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.6}/>
                  </linearGradient>
                  <linearGradient id="historyGradientAlert" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={1}/>
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0.6}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-subtle)" />
                <XAxis 
                  dataKey="month" 
                  tickFormatter={(val) => {
                    try { return format(parseISO(`${val}-01`), "MMM ''yy"); } catch(e) { return val; }
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
                <Bar dataKey="amount" radius={[6, 6, 0, 0]} barSize={40}>
                  {monthlyTotals.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.amount > avgAll * 1.2 ? 'url(#historyGradientAlert)' : 'url(#historyGradient)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};

const InsightCard = ({ icon, title, body, accent, badge }: { icon: React.ReactNode, title: string, body: React.ReactNode, accent: string, badge?: string }) => (
  <div className="bg-[#1e1e1e] border border-white/5 rounded-2xl shadow-xl p-6 relative overflow-hidden group hover:border-blue-500/30 transition-all duration-300">
    <div className="absolute inset-0 bg-gradient-to-br from-black/5 dark:from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
    <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: accent }}></div>
    <div className="flex items-start gap-4 relative z-10">
      <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg" style={{ backgroundColor: `${accent}20`, color: accent, boxShadow: `0 10px 15px -3px ${accent}20` }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-white font-bold text-lg tracking-tight font-display">{title}</h3>
          {badge && <span className="text-[11px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border font-mono" style={{ color: accent, borderColor: `${accent}40`, backgroundColor: `${accent}10` }}>{badge}</span>}
        </div>
        <p className="text-zinc-400 text-sm leading-relaxed">{body}</p>
      </div>
    </div>
  </div>
);
