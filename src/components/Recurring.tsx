import React, { useState, useEffect } from 'react';
import { useAppContext } from '../store';
import { v4 as uuidv4 } from 'uuid';
import { Trash2, Plus, RefreshCw, Calendar as CalendarIcon, DollarSign, Tag, CreditCard, Hash, ChevronLeft, ChevronRight, List } from 'lucide-react';
import { format, set, isAfter, isBefore, addMonths, startOfDay, getYear, getMonth, getDate, isSameMonth, isSameYear, endOfMonth, startOfMonth, getDay, subMonths } from 'date-fns';

export const Recurring: React.FC = () => {
  const { data, updateData } = useAppContext();
  const { recurring, categories, transactions } = data;

  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [calendarDate, setCalendarDate] = useState(new Date());

  const [newRec, setNewRec] = useState({
    name: '',
    amount: '',
    category: Object.keys(categories)[0] || 'Uncategorized',
    account: 'Chequing',
    day: 1,
    type: 'expense' as 'expense' | 'credit',
    startYear: new Date().getFullYear(),
    startMonth: new Date().getMonth() + 1,
    endYear: '' as string | number,
    endMonth: '' as string | number
  });

  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; ruleId: string | null; ruleName: string }>({
    isOpen: false,
    ruleId: null,
    ruleName: ''
  });

  const handleUpdate = (index: number, field: string, value: any) => {
    const newRecurring = [...recurring];
    newRecurring[index] = { ...newRecurring[index], [field]: value };
    updateData({ recurring: newRecurring });
  };

  const handleDeleteClick = (id: string, name: string) => {
    setDeleteConfirm({ isOpen: true, ruleId: id, ruleName: name });
  };

  const confirmDelete = (deleteTransactions: boolean) => {
    if (!deleteConfirm.ruleId) return;

    const ruleId = deleteConfirm.ruleId;
    const rule = recurring.find(r => r.id === ruleId);

    if (!rule) {
      setDeleteConfirm({ isOpen: false, ruleId: null, ruleName: '' });
      return;
    }

    const newRecurring = recurring.filter(r => r.id !== ruleId);
    let newTransactions = [...transactions];

    if (deleteTransactions) {
      newTransactions = newTransactions.filter(t => t.recurringId !== ruleId);
    }

    updateData({
      recurring: newRecurring,
      transactions: newTransactions
    });

    setDeleteConfirm({ isOpen: false, ruleId: null, ruleName: '' });
  };

  const handleAdd = () => {
    if (!newRec.name || !newRec.amount) return;

    const amountVal = parseFloat(newRec.amount);
    if (isNaN(amountVal)) return;

    const newRule = {
      id: uuidv4(),
      name: newRec.name,
      amount: amountVal,
      category: newRec.category,
      account: newRec.account,
      day: newRec.day,
      type: newRec.type,
      startYear: newRec.startYear,
      startMonth: newRec.startMonth,
      endYear: newRec.endYear ? parseInt(String(newRec.endYear)) : undefined,
      endMonth: newRec.endMonth ? parseInt(String(newRec.endMonth)) : undefined
    };

    // Generate transactions ONLY up to today
    const newTransactions = [];
    const today = startOfDay(new Date());
    
    // Start date
    let ruleDate = new Date(newRule.startYear, newRule.startMonth - 1, newRule.day);
    
    // End date check
    let endDate: Date | null = null;
    if (newRule.endYear && newRule.endMonth) {
      endDate = endOfMonth(new Date(newRule.endYear, newRule.endMonth - 1));
    }

    // Loop while ruleDate is <= today AND (if endDate exists, ruleDate <= endDate)
    while (
      (isBefore(ruleDate, today) || (isSameMonth(ruleDate, today) && getDate(ruleDate) <= getDate(today))) &&
      (!endDate || isBefore(ruleDate, endDate) || isSameMonth(ruleDate, endDate))
    ) {
       // Double check we aren't adding future dates
       if (isAfter(ruleDate, today)) break;

       newTransactions.push({
        id: uuidv4(),
        date: format(ruleDate, 'yyyy-MM-dd'),
        description: newRule.name,
        amount: newRule.amount,
        type: newRule.type,
        account: newRule.account,
        category: newRule.category,
        hidden: false,
        recurringId: newRule.id
      });

      ruleDate = addMonths(ruleDate, 1);
    }

    updateData({
      recurring: [...recurring, newRule],
      transactions: [...transactions, ...newTransactions]
    });

    setNewRec({ ...newRec, name: '', amount: '', endYear: '', endMonth: '' });
    // alert(`Recurring rule added. ${newTransactions.length} past/current transactions generated.`);
  };

  const totalMonthly = recurring.filter(r => r.type === 'expense').reduce((sum, r) => sum + r.amount, 0);
  const totalIncome = recurring.filter(r => r.type === 'credit').reduce((sum, r) => sum + r.amount, 0);

  // Calendar Logic
  const monthStart = startOfMonth(calendarDate);
  const monthEnd = endOfMonth(calendarDate);
  const startDate = startOfDay(monthStart);
  const endDate = startOfDay(monthEnd);
  const startDay = getDay(startDate); // 0 = Sunday
  const daysInMonth = getDate(endDate);

  const calendarDays = [];
  // Pad empty days
  for (let i = 0; i < startDay; i++) {
    calendarDays.push(null);
  }
  // Fill days
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(i);
  }

  const getRecurringForDay = (day: number) => {
    return recurring.filter(r => {
        // Basic check: does the day match?
        if (r.day !== day) return false;

        // Check start date
        const rStart = new Date(r.startYear || 2000, (r.startMonth || 1) - 1, 1);
        if (isBefore(new Date(calendarDate.getFullYear(), calendarDate.getMonth(), day), rStart)) return false;

        // Check end date
        if (r.endYear && r.endMonth) {
            const rEnd = endOfMonth(new Date(r.endYear, r.endMonth - 1));
            if (isAfter(new Date(calendarDate.getFullYear(), calendarDate.getMonth(), day), rEnd)) return false;
        }

        return true;
    });
  };

  const totalForViewedMonth = (() => {
    let total = 0;
    for (let i = 1; i <= daysInMonth; i++) {
        const items = getRecurringForDay(i);
        items.forEach(item => {
            if (item.type === 'expense') total += item.amount;
        });
    }
    return total;
  })();

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end gap-4 justify-between">
        <div>
          <h1 className="text-4xl font-bold text-white tracking-tight font-display">Recurring Transactions</h1>
          <p className="text-zinc-400 font-mono text-sm mt-2">
            Manage your regular expenses and income.
          </p>
        </div>
        <div className="flex gap-4 text-sm font-mono items-center">
          <div className="bg-[#252525] px-4 py-2 rounded-xl border border-white/5">
            <span className="text-zinc-500 block text-xs">Monthly Expenses</span>
            <span className="text-white font-bold">${totalMonthly.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="bg-[#252525] px-4 py-2 rounded-xl border border-white/5">
            <span className="text-zinc-500 block text-xs">Monthly Income</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">${totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          
          <div className="flex bg-[#252525] p-1 rounded-xl border border-white/5 ml-4">
            <button 
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-blue-600 text-white shadow-lg' : 'text-zinc-400 hover:text-zinc-900 dark:hover:text-white'}`}
            >
                <List size={18} />
            </button>
            <button 
                onClick={() => setViewMode('calendar')}
                className={`p-2 rounded-lg transition-all ${viewMode === 'calendar' ? 'bg-blue-600 text-white shadow-lg' : 'text-zinc-400 hover:text-zinc-900 dark:hover:text-white'}`}
            >
                <CalendarIcon size={18} />
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'calendar' ? (
        <div className="bg-[#1e1e1e] border border-white/5 rounded-2xl shadow-xl p-6">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-6">
                    <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                        <CalendarIcon size={20} />
                        {format(calendarDate, 'MMMM yyyy')}
                    </h3>
                    <div className="text-sm font-mono text-zinc-400 bg-[#252525] px-3 py-1 rounded-lg border border-white/5">
                        Est. Total: <span className="text-white font-bold">${totalForViewedMonth.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setCalendarDate(subMonths(calendarDate, 1))} className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
                        <ChevronLeft size={20} />
                    </button>
                    <button onClick={() => setCalendarDate(new Date())} className="px-3 py-1 text-xs font-mono bg-[#252525] hover:bg-white/[0.04] rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors border border-white/5">
                        Today
                    </button>
                    <button onClick={() => setCalendarDate(addMonths(calendarDate, 1))} className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
                        <ChevronRight size={20} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-7 gap-px bg-[#2a2a2a] border border-white/5 rounded-xl overflow-hidden">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="bg-zinc-100 dark:bg-[#18181b] p-3 text-center text-xs font-bold text-zinc-500 uppercase tracking-wider">
                        {day}
                    </div>
                ))}
                
                {calendarDays.map((day, i) => {
                    const items = day ? getRecurringForDay(day) : [];
                    const isToday = day && isSameMonth(calendarDate, new Date()) && day === new Date().getDate();

                    return (
                        <div key={i} className={`bg-[#141414] min-h-[120px] p-2 border-t border-white/5 relative group hover:bg-white/[0.02] transition-colors ${!day ? 'bg-[#141414]/50' : ''}`}>
                            {day && (
                                <>
                                    <div className={`text-xs font-mono mb-2 ${isToday ? 'bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center' : 'text-zinc-500'}`}>
                                        {day}
                                    </div>
                                    <div className="space-y-1">
                                        {items.map(item => (
                                            <div key={item.id} className={`text-[10px] px-1.5 py-1 rounded border truncate ${item.type === 'credit' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' : 'bg-[#252525] text-zinc-600 dark:text-zinc-300 border-white/5'}`}>
                                                <div className="font-semibold truncate">{item.name}</div>
                                                <div>${item.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
      ) : (
        <>
        {/* Add New Form */}
        <div className="bg-[#1e1e1e] border border-white/5 rounded-2xl shadow-xl p-6 border border-blue-500/20 shadow-lg shadow-blue-900/10 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3 tracking-tight">
            <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-lg shadow-blue-500/30">
                <Plus size={18} />
            </div>
            Add New Recurring Rule
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Name & Amount */}
            <div className="space-y-4">
                <div>
                <label className="text-xs text-zinc-500 mb-1.5 font-mono flex items-center gap-2">
                    <Tag size={12} /> NAME
                </label>
                <input
                    type="text"
                    placeholder="e.g. Rent"
                    value={newRec.name}
                    onChange={e => setNewRec({ ...newRec, name: e.target.value })}
                    className="w-full bg-[#1a1a1a] border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all hover:bg-black/10 dark:hover:bg-white/5"
                />
                </div>
                <div>
                <label className="text-xs text-zinc-500 mb-1.5 font-mono flex items-center gap-2">
                    <DollarSign size={12} /> AMOUNT
                </label>
                <input
                    type="number"
                    value={newRec.amount}
                    onChange={e => setNewRec({ ...newRec, amount: e.target.value })}
                    className="w-full bg-[#1a1a1a] border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all hover:bg-black/10 dark:hover:bg-white/5 font-mono"
                    min="0"
                    step="50"
                    placeholder="0.00"
                />
                </div>
            </div>

            {/* Category & Account */}
            <div className="space-y-4">
                <div>
                <label className="text-xs text-zinc-500 mb-1.5 font-mono flex items-center gap-2">
                    <Hash size={12} /> CATEGORY
                </label>
                <select
                    value={newRec.category}
                    onChange={e => setNewRec({ ...newRec, category: e.target.value })}
                    className="w-full bg-[#1a1a1a] border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all hover:bg-black/10 dark:hover:bg-white/5 appearance-none"
                >
                    {Object.keys(categories).map(c => <option key={c} value={c} className="bg-[#1e1e1e] text-white">{c}</option>)}
                </select>
                </div>
                <div>
                <label className="text-xs text-zinc-500 mb-1.5 font-mono flex items-center gap-2">
                    <CreditCard size={12} /> ACCOUNT
                </label>
                <input
                    type="text"
                    value={newRec.account}
                    onChange={e => setNewRec({ ...newRec, account: e.target.value })}
                    className="w-full bg-[#1a1a1a] border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all hover:bg-black/10 dark:hover:bg-white/5"
                />
                </div>
            </div>

            {/* Timing */}
            <div className="space-y-4">
                <div className="flex gap-4">
                <div className="flex-1">
                    <label className="text-xs text-zinc-500 mb-1.5 font-mono flex items-center gap-2">
                    <CalendarIcon size={12} /> DAY OF MONTH
                    </label>
                    <input
                    type="number"
                    value={newRec.day}
                    onChange={e => setNewRec({ ...newRec, day: parseInt(e.target.value) || 1 })}
                    className="w-full bg-[#1a1a1a] border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all hover:bg-black/10 dark:hover:bg-white/5 font-mono"
                    min="1"
                    max="31"
                    />
                </div>
                <div className="flex-1">
                    <label className="text-xs text-zinc-500 mb-1.5 font-mono">TYPE</label>
                    <select
                    value={newRec.type}
                    onChange={e => setNewRec({ ...newRec, type: e.target.value as 'expense' | 'credit' })}
                    className="w-full bg-[#1a1a1a] border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all hover:bg-black/10 dark:hover:bg-white/5 appearance-none"
                    >
                    <option value="expense" className="bg-[#1e1e1e] text-white">Expense</option>
                    <option value="credit" className="bg-[#1e1e1e] text-white">Income</option>
                    </select>
                </div>
                </div>
                <div>
                <label className="text-xs text-zinc-500 mb-1.5 font-mono">START DATE (MM/YYYY)</label>
                <div className="flex gap-2">
                    <input
                    type="number"
                    value={newRec.startMonth}
                    onChange={e => setNewRec({ ...newRec, startMonth: parseInt(e.target.value) || 1 })}
                    className="w-full bg-[#1a1a1a] border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all hover:bg-black/10 dark:hover:bg-white/5 font-mono text-center"
                    min="1"
                    max="12"
                    placeholder="MM"
                    />
                    <input
                    type="number"
                    value={newRec.startYear}
                    onChange={e => setNewRec({ ...newRec, startYear: parseInt(e.target.value) || new Date().getFullYear() })}
                    className="w-full bg-[#1a1a1a] border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all hover:bg-black/10 dark:hover:bg-white/5 font-mono text-center"
                    min="2000"
                    max="2100"
                    placeholder="YYYY"
                    />
                </div>
                </div>
                <div>
                <label className="text-xs text-zinc-500 mb-1.5 font-mono">END DATE (Optional)</label>
                <div className="flex gap-2">
                    <input
                    type="number"
                    value={newRec.endMonth}
                    onChange={e => setNewRec({ ...newRec, endMonth: e.target.value })}
                    className="w-full bg-[#1a1a1a] border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all hover:bg-black/10 dark:hover:bg-white/5 font-mono text-center"
                    min="1"
                    max="12"
                    placeholder="MM"
                    />
                    <input
                    type="number"
                    value={newRec.endYear}
                    onChange={e => setNewRec({ ...newRec, endYear: e.target.value })}
                    className="w-full bg-[#1a1a1a] border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all hover:bg-black/10 dark:hover:bg-white/5 font-mono text-center"
                    min="2000"
                    max="2100"
                    placeholder="YYYY"
                    />
                </div>
                </div>
            </div>

            {/* Action */}
            <div className="flex items-end">
                <button
                onClick={handleAdd}
                disabled={!newRec.name || !newRec.amount}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-xl transition-all text-sm shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
                >
                <Plus size={18} />
                Add Rule & Generate
                </button>
            </div>
            </div>
        </div>

        {/* Upcoming Bills */}
        {recurring.length > 0 && (
            <div className="bg-[#1e1e1e] border border-white/5 rounded-2xl shadow-xl p-6">
            <h3 className="text-xl font-bold text-white mb-6 tracking-tight">Upcoming Bills (Next 30 Days)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {recurring
                .filter(r => r.type === 'expense')
                .map(r => {
                    const today = new Date();
                    const currentMonth = today.getMonth() + 1;
                    const currentYear = today.getFullYear();
                    
                    // Calculate next occurrence
                    let nextDate = new Date(currentYear, currentMonth - 1, r.day);
                    if (isBefore(nextDate, startOfDay(today))) {
                    nextDate = addMonths(nextDate, 1);
                    }
                    
                    // Check if it's within 30 days
                    const diffTime = Math.abs(nextDate.getTime() - today.getTime());
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                    
                    return { ...r, nextDate, diffDays };
                })
                .filter(r => r.diffDays <= 30)
                .sort((a, b) => a.nextDate.getTime() - b.nextDate.getTime())
                .map(r => (
                    <div key={r.id} className="bg-[#252525] border border-white/5 rounded-xl p-4 flex items-center justify-between">
                    <div>
                        <div className="text-zinc-400 text-xs font-mono mb-1">{format(r.nextDate, 'MMM do')} ({r.diffDays === 0 ? 'Today' : `in ${r.diffDays} days`})</div>
                        <div className="font-semibold text-white">{r.name}</div>
                    </div>
                    <div className="text-right">
                        <div className="font-bold text-white">${r.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                        <div className="text-xs text-zinc-500">{r.category}</div>
                    </div>
                    </div>
                ))}
                {recurring.filter(r => r.type === 'expense').length === 0 && (
                    <div className="text-zinc-500 text-sm col-span-full">No upcoming bills found for the next 30 days.</div>
                )}
            </div>
            </div>
        )}

        {/* Existing Rules List */}
        {recurring.length > 0 && (
            <div className="space-y-4">
            <h3 className="text-xl font-bold text-white tracking-tight">Active Rules</h3>
            <div className="grid gap-4">
                {recurring.map((r, i) => (
                <div key={r.id} className="bg-[#1e1e1e] border border-white/5 rounded-2xl shadow-xl p-4 flex flex-col lg:flex-row gap-4 lg:items-center group hover:bg-white/[0.02] transition-colors">
                    {/* Main Info */}
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-1">
                        <label className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">Name</label>
                        <input
                        type="text"
                        value={r.name}
                        onChange={e => handleUpdate(i, 'name', e.target.value)}
                        className="w-full bg-transparent border-b border-transparent focus:border-blue-500 text-sm text-white outline-none transition-colors pb-1"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">Amount</label>
                        <div className="flex items-center gap-1">
                        <span className="text-zinc-500 text-sm">$</span>
                        <input
                            type="number"
                            value={r.amount}
                            onChange={e => handleUpdate(i, 'amount', parseFloat(e.target.value) || 0)}
                            className="w-full bg-transparent border-b border-transparent focus:border-blue-500 text-sm text-white outline-none transition-colors pb-1 font-mono"
                        />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">Category</label>
                        <select
                        value={r.category}
                        onChange={e => handleUpdate(i, 'category', e.target.value)}
                        className="w-full bg-transparent border-b border-transparent focus:border-blue-500 text-sm text-zinc-600 dark:text-zinc-300 outline-none transition-colors pb-1 appearance-none cursor-pointer"
                        >
                        {Object.keys(categories).map(c => <option key={c} value={c} className="bg-[#1e1e1e] text-white">{c}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">Account</label>
                        <input
                        type="text"
                        value={r.account}
                        onChange={e => handleUpdate(i, 'account', e.target.value)}
                        className="w-full bg-transparent border-b border-transparent focus:border-blue-500 text-sm text-zinc-600 dark:text-zinc-300 outline-none transition-colors pb-1"
                        />
                    </div>
                    </div>

                    {/* Secondary Info */}
                    <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4 lg:border-l lg:border-white/5 lg:pl-6">
                    <div className="space-y-1">
                        <label className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">Day</label>
                        <input
                        type="number"
                        value={r.day}
                        onChange={e => handleUpdate(i, 'day', parseInt(e.target.value) || 1)}
                        className="w-full bg-transparent border-b border-transparent focus:border-blue-500 text-sm text-zinc-600 dark:text-zinc-300 outline-none transition-colors pb-1 font-mono"
                        min="1"
                        max="31"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">Type</label>
                        <select
                        value={r.type}
                        onChange={e => handleUpdate(i, 'type', e.target.value)}
                        className="w-full bg-transparent border-b border-transparent focus:border-blue-500 text-sm text-zinc-600 dark:text-zinc-300 outline-none transition-colors pb-1 appearance-none cursor-pointer"
                        >
                        <option value="expense" className="bg-[#1e1e1e] text-white">Expense</option>
                        <option value="credit" className="bg-[#1e1e1e] text-white">Income</option>
                        </select>
                    </div>
                    <div className="space-y-1 col-span-2">
                        <label className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">Start Date</label>
                        <div className="flex gap-2">
                        <input
                            type="number"
                            value={r.startMonth || 1}
                            onChange={e => handleUpdate(i, 'startMonth', parseInt(e.target.value) || 1)}
                            className="w-12 bg-transparent border-b border-transparent focus:border-blue-500 text-sm text-zinc-600 dark:text-zinc-300 outline-none transition-colors pb-1 font-mono text-center"
                            placeholder="MM"
                        />
                        <span className="text-zinc-400 dark:text-zinc-600">/</span>
                        <input
                            type="number"
                            value={r.startYear || new Date().getFullYear()}
                            onChange={e => handleUpdate(i, 'startYear', parseInt(e.target.value) || new Date().getFullYear())}
                            className="w-16 bg-transparent border-b border-transparent focus:border-blue-500 text-sm text-zinc-600 dark:text-zinc-300 outline-none transition-colors pb-1 font-mono text-center"
                            placeholder="YYYY"
                        />
                        </div>
                    </div>
                    <div className="space-y-1 col-span-2">
                        <label className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">End Date</label>
                        <div className="flex gap-2">
                        <input
                            type="number"
                            value={r.endMonth || ''}
                            onChange={e => handleUpdate(i, 'endMonth', e.target.value ? parseInt(e.target.value) : undefined)}
                            className="w-12 bg-transparent border-b border-transparent focus:border-blue-500 text-sm text-zinc-600 dark:text-zinc-300 outline-none transition-colors pb-1 font-mono text-center"
                            placeholder="MM"
                        />
                        <span className="text-zinc-400 dark:text-zinc-600">/</span>
                        <input
                            type="number"
                            value={r.endYear || ''}
                            onChange={e => handleUpdate(i, 'endYear', e.target.value ? parseInt(e.target.value) : undefined)}
                            className="w-16 bg-transparent border-b border-transparent focus:border-blue-500 text-sm text-zinc-600 dark:text-zinc-300 outline-none transition-colors pb-1 font-mono text-center"
                            placeholder="YYYY"
                        />
                        </div>
                    </div>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end lg:w-12">
                    <button
                        onClick={() => handleDeleteClick(r.id, r.name)}
                        className="w-10 h-10 flex items-center justify-center text-zinc-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all"
                        title="Delete Rule"
                    >
                        <Trash2 size={18} />
                    </button>
                    </div>
                </div>
                ))}
            </div>
            </div>
        )}
        </>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm.isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1e1e1e] border border-white/5 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-2">Delete Recurring Rule</h3>
            <p className="text-zinc-400 mb-6">
              You are about to delete <span className="text-white font-semibold">"{deleteConfirm.ruleName}"</span>.
              What would you like to do with the existing transactions generated by this rule?
            </p>
            
            <div className="space-y-3">
              <button
                onClick={() => confirmDelete(false)}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                Delete Rule Only
                <span className="text-blue-200 text-xs font-normal">(Keep Transactions)</span>
              </button>
              
              <button
                onClick={() => confirmDelete(true)}
                className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20 font-medium py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                Delete Rule & Transactions
              </button>
              
              <button
                onClick={() => setDeleteConfirm({ isOpen: false, ruleId: null, ruleName: '' })}
                className="w-full text-zinc-500 hover:text-zinc-900 dark:hover:text-white py-2 text-sm transition-colors mt-2"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
