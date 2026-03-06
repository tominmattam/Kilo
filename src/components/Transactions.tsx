import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useAppContext } from '../store';
import { Transaction } from '../types';
import { format, parseISO, startOfMonth, endOfMonth, subMonths, subDays, startOfYear, endOfYear, addMonths, endOfDay, startOfDay } from 'date-fns';
import { Eye, EyeOff, Trash2, Search, Calendar as CalendarIcon, CheckSquare, Square, X, Plus, StickyNote, Split } from 'lucide-react';

interface TransactionsProps {
  dateFilter: string;
  customDateRange: { start: string; end: string };
  categoryFilter?: string;
  setCategoryFilter?: (category: string) => void;
}

export const Transactions: React.FC<TransactionsProps> = ({ dateFilter, customDateRange, categoryFilter: propCategoryFilter, setCategoryFilter: propSetCategoryFilter }) => {
  const { data, updateData } = useAppContext();
  const { transactions, categories, custom_rules } = data;

  const [search, setSearch] = useState('');
  // Use prop if available, otherwise local state (though we expect prop to be available now)
  const [localCatFilter, setLocalCatFilter] = useState('All categories');
  
  const catFilter = propCategoryFilter !== undefined ? propCategoryFilter : localCatFilter;
  const setCatFilter = propSetCategoryFilter !== undefined ? propSetCategoryFilter : setLocalCatFilter;

  const [acctFilter, setAcctFilter] = useState('All accounts');
  const [sortFilter, setSortFilter] = useState('Newest first');
  const [showHidden, setShowHidden] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notingId, setNotingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showAddModal, setShowAddModal] = useState(false);
  const [splittingId, setSplittingId] = useState<string | null>(null);
  const [splits, setSplits] = useState<{ category: string; amount: number }[]>([]);
  const [newTxn, setNewTxn] = useState<Partial<Transaction>>({
    date: format(new Date(), 'yyyy-MM-dd'),
    description: '',
    amount: 0,
    type: 'expense',
    category: 'Other',
    account: 'Cash',
    hidden: false
  });
  
  // Note input state
  const [noteInput, setNoteInput] = useState('');
  const noteInputRef = useRef<HTMLTextAreaElement>(null);

  const catNames = Object.keys(categories).sort();
  const acctNames = Array.from(new Set(transactions.map(t => t.account).filter(Boolean))).sort();

  useEffect(() => {
    if (notingId && noteInputRef.current) {
      noteInputRef.current.focus();
    }
  }, [notingId]);

  useEffect(() => {
    if (splittingId) {
      const txn = transactions.find(t => t.id === splittingId);
      if (txn) {
        setSplits(txn.splits || [{ category: txn.category, amount: txn.amount }]);
      }
    }
  }, [splittingId]); // Only run when splittingId changes to avoid resetting edits on background transaction updates

  const handleSaveSplits = () => {
    if (!splittingId) return;
    const txn = transactions.find(t => t.id === splittingId);
    if (!txn) return;

    const total = splits.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
    if (Math.abs(total - txn.amount) > 0.01) {
      alert(`Total split amount ($${total.toFixed(2)}) must equal transaction amount ($${txn.amount.toFixed(2)})`);
      return;
    }

    updateData({
      transactions: transactions.map(t => t.id === splittingId ? { ...t, splits: splits.map(s => ({...s, amount: Number(s.amount) || 0})) } : t)
    });
    setSplittingId(null);
  };

  const filtered = useMemo(() => {
    let result = [...transactions];
    
    // Date Filter
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
      // Limit to next month as requested
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

    result = result.filter(t => {
      const d = parseISO(t.date);
      if (start && d < start) return false;
      if (end && d > end) return false;
      return true;
    });

    if (!showHidden) result = result.filter(t => !t.hidden);
    if (search) result = result.filter(t => t.description.toLowerCase().includes(search.toLowerCase()));
    if (catFilter !== 'All categories') {
      result = result.filter(t => 
        t.category === catFilter || 
        (t.splits && t.splits.some(s => s.category === catFilter))
      );
    }
    if (acctFilter !== 'All accounts') result = result.filter(t => t.account === acctFilter);

    result = result.sort((a, b) => {
      if (sortFilter === 'Newest first') return b.date.localeCompare(a.date);
      if (sortFilter === 'Oldest first') return a.date.localeCompare(b.date);
      if (sortFilter === 'Amount ↓') return b.amount - a.amount;
      if (sortFilter === 'Amount ↑') return a.amount - b.amount;
      return 0;
    });

    return result;
  }, [transactions, search, catFilter, acctFilter, sortFilter, showHidden, dateFilter, customDateRange]);

  const grouped = useMemo(() => {
    const groups: Record<string, typeof filtered> = {};
    filtered.forEach(t => {
      if (!groups[t.date]) groups[t.date] = [];
      groups[t.date].push(t);
    });
    return groups;
  }, [filtered]);

  const totalShown = filtered.reduce((sum, t) => sum + (t.type === 'credit' ? t.amount : -t.amount), 0);

  const handleToggleHidden = (id: string) => {
    updateData({
      transactions: transactions.map(t => t.id === id ? { ...t, hidden: !t.hidden } : t)
    });
  };

  const handleDelete = (id: string) => {
    updateData({
      transactions: transactions.filter(t => t.id !== id)
    });
  };

  const handleDateChange = (id: string, newDate: string) => {
    if (!newDate) return;
    updateData({
      transactions: transactions.map(t => t.id === id ? { ...t, date: newDate } : t)
    });
    setEditingId(null);
  };

  const handleCategoryChange = (id: string, newCat: string) => {
    const txn = transactions.find(t => t.id === id);
    if (!txn) return;

    const isConfirmed = window.confirm(`Do you want to automatically categorize all past and future transactions matching "${txn.description}" as ${newCat}?`);

    let newTxns = transactions.map(t => t.id === id ? { ...t, category: newCat } : t);
    let newRules = custom_rules || [];

    if (isConfirmed) {
      // Update all matching past transactions
      newTxns = newTxns.map(t => t.description === txn.description ? { ...t, category: newCat } : t);
      
      // Add to custom rules to learn for future imports
      const keyword = txn.description.toUpperCase();
      if (!newRules.find(r => r.keyword === keyword)) {
        newRules = [...newRules, { keyword, category: newCat }];
      }
    }

    updateData({
      transactions: newTxns,
      custom_rules: newRules
    });
  };

  const handleSaveNote = (id: string) => {
    updateData({
      transactions: transactions.map(t => t.id === id ? { ...t, notes: noteInput } : t)
    });
    setNotingId(null);
  };

  // Bulk Selection Logic
  const allSelected = filtered.length > 0 && filtered.every(t => selectedIds.has(t.id));
  const isIndeterminate = selectedIds.size > 0 && !allSelected;

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      const newSelected = new Set(selectedIds);
      filtered.forEach(t => newSelected.add(t.id));
      setSelectedIds(newSelected);
    }
  };

  const handleSelectOne = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkDelete = () => {
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.size} transactions?`)) return;
    updateData({
      transactions: transactions.filter(t => !selectedIds.has(t.id))
    });
    setSelectedIds(new Set());
  };

  const handleBulkHide = (hide: boolean) => {
    updateData({
      transactions: transactions.map(t => selectedIds.has(t.id) ? { ...t, hidden: hide } : t)
    });
    setSelectedIds(new Set());
  };

  const handleBulkCategory = (newCat: string) => {
    if (!newCat) return;
    updateData({
      transactions: transactions.map(t => selectedIds.has(t.id) ? { ...t, category: newCat } : t)
    });
    setSelectedIds(new Set());
  };

  const handleAddManual = () => {
    if (!newTxn.description || !newTxn.amount) {
      alert('Please provide a description and amount.');
      return;
    }

    const id = Math.random().toString(36).substring(2, 11);
    const txn: Transaction = {
      id,
      date: newTxn.date || format(new Date(), 'yyyy-MM-dd'),
      description: newTxn.description,
      amount: Number(newTxn.amount),
      type: newTxn.type as 'expense' | 'credit',
      category: newTxn.category || 'Other',
      account: newTxn.account || 'Cash',
      hidden: false,
      tags: [],
      notes: ''
    };

    updateData({
      transactions: [txn, ...transactions]
    });

    setShowAddModal(false);
    setNewTxn({
      date: format(new Date(), 'yyyy-MM-dd'),
      description: '',
      amount: 0,
      type: 'expense',
      category: 'Other',
      account: 'Cash',
      hidden: false
    });
  };

  return (
    <div className="space-y-8 relative">
      <div className="flex items-end justify-between gap-4">
        <div className="flex items-end gap-4">
          <h1 className="text-4xl font-bold text-white tracking-tight font-display">Transactions</h1>
          <span className="text-zinc-500 pb-1.5 font-mono text-sm">{dateFilter}</span>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold transition-all shadow-lg shadow-blue-500/20 active:scale-95"
        >
          <Plus size={18} />
          Add Transaction
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
          <input
            type="text"
            placeholder="Search transactions..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-[#252525] border border-white/5 rounded-xl text-white text-sm pl-10 pr-4 py-2.5 outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all hover:bg-white/[0.04]"
          />
        </div>
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="bg-[#252525] border border-white/5 rounded-xl text-white text-sm px-4 py-2.5 outline-none w-full md:w-48 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all hover:bg-white/[0.04] appearance-none">
          <option className="bg-[#1e1e1e]">All categories</option>
          {catNames.map(c => <option key={c} value={c} className="bg-[#1e1e1e]">{c}</option>)}
        </select>
        <select value={acctFilter} onChange={e => setAcctFilter(e.target.value)} className="bg-[#252525] border border-white/5 rounded-xl text-white text-sm px-4 py-2.5 outline-none w-full md:w-40 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all hover:bg-white/[0.04] appearance-none">
          <option className="bg-[#1e1e1e]">All accounts</option>
          {acctNames.map(a => <option key={a} value={a} className="bg-[#1e1e1e]">{a}</option>)}
        </select>
        <select value={sortFilter} onChange={e => setSortFilter(e.target.value)} className="bg-[#252525] border border-white/5 rounded-xl text-white text-sm px-4 py-2.5 outline-none w-full md:w-40 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all hover:bg-white/[0.04] appearance-none">
          {['Newest first', 'Oldest first', 'Amount ↓', 'Amount ↑'].map(s => <option key={s} value={s} className="bg-[#1e1e1e]">{s}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer bg-[#252525] border border-white/5 rounded-xl px-4 py-2.5 hover:bg-white/[0.04] transition-all w-full md:w-auto">
          <input type="checkbox" checked={showHidden} onChange={e => setShowHidden(e.target.checked)} className="accent-blue-500 w-4 h-4 rounded border-black/20 dark:border-white/20" />
          Show hidden
        </label>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="sticky top-4 z-20 bg-blue-600/90 backdrop-blur-md text-white px-6 py-3 rounded-xl shadow-2xl flex flex-wrap items-center gap-4 md:gap-6 animate-in fade-in slide-in-from-top-4">
          <div className="font-medium flex items-center gap-2 shrink-0">
            <CheckSquare size={18} />
            {selectedIds.size} selected
          </div>
          <div className="hidden md:block h-6 w-px bg-white/20 shrink-0" />
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            <select 
              onChange={(e) => handleBulkCategory(e.target.value)}
              className="bg-white/10 border border-white/20 rounded-lg text-sm px-3 py-1.5 outline-none hover:bg-white/20 transition-colors cursor-pointer"
              value=""
            >
              <option value="" disabled>Change Category...</option>
              {catNames.map(c => <option key={c} value={c} className="bg-zinc-800">{c}</option>)}
            </select>
            
            <button 
              onClick={() => handleBulkHide(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors"
            >
              <EyeOff size={14} /> Hide
            </button>
            <button 
              onClick={() => handleBulkHide(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors"
            >
              <Eye size={14} /> Unhide
            </button>
            <button 
              onClick={handleBulkDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-100 rounded-lg text-sm transition-colors md:ml-2"
            >
              <Trash2 size={14} /> Delete
            </button>
          </div>
          <button 
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto p-1 hover:bg-white/20 rounded-full transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </div>
      )}

      <div className="text-sm text-zinc-500 font-mono flex justify-between items-center">
        <div>
          <b className="text-zinc-300">{filtered.length}</b> transactions &nbsp;·&nbsp; <b className="text-zinc-300">{totalShown < 0 ? '-' : ''}${Math.abs(totalShown).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>
        </div>
        <button 
          onClick={handleSelectAll}
          className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors"
        >
          {allSelected ? <CheckSquare size={16} className="text-blue-400" /> : <Square size={16} />}
          Select All
        </button>
      </div>

      {/* List */}
      <div className="bg-[#1e1e1e] border border-white/5 rounded-2xl shadow-xl p-6">
        <div className="space-y-8">
        {Object.entries(grouped).map(([date, txns]: [string, any]) => {
          const dayTotal = txns.reduce((sum: number, t: any) => sum + (t.type === 'credit' ? t.amount : -t.amount), 0);
          let dateFmt = date;
          try {
            dateFmt = format(parseISO(date), 'MMMM d, yyyy');
          } catch (e) {}

          return (
            <div key={date} className="space-y-1">
              <div className="flex justify-between items-center text-[13px] font-semibold text-zinc-500 pb-1.5 border-b border-white/5">
                <span>{dateFmt}</span>
                <span>{dayTotal < 0 ? '-' : ''}${Math.abs(dayTotal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="space-y-1">
                {txns.map((t: any) => {
                  const icon = categories[t.category]?.icon || '📦';
                  const opacity = t.hidden ? 'opacity-40' : 'opacity-100';
                  const isSelected = selectedIds.has(t.id);

                  return (
                    <div key={t.id} className={`flex items-center gap-4 py-2.5 px-2 hover:bg-white/[0.02] rounded-lg transition-colors group ${opacity} ${isSelected ? 'bg-blue-500/10 hover:bg-blue-500/20' : ''}`}>
                      <div className="flex items-center justify-center w-6 shrink-0">
                        <button 
                          onClick={() => handleSelectOne(t.id)}
                          className="text-zinc-400 dark:text-zinc-600 hover:text-blue-500 transition-colors"
                        >
                          {isSelected ? <CheckSquare size={18} className="text-blue-500" /> : <Square size={18} />}
                        </button>
                      </div>
                      <div className="text-xl w-8 shrink-0 text-center">{icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium truncate ${t.hidden ? 'text-zinc-500' : 'text-zinc-900 dark:text-zinc-200'}`}>
                          {t.description}
                        </div>
                        {/* Notes */}
                        {(t.notes || notingId === t.id) && (
                          <div className="mt-1">
                            {notingId === t.id ? (
                              <div className="relative">
                                <textarea
                                  ref={noteInputRef}
                                  value={noteInput}
                                  onChange={e => setNoteInput(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                      e.preventDefault();
                                      handleSaveNote(t.id);
                                    } else if (e.key === 'Escape') {
                                      setNotingId(null);
                                    }
                                  }}
                                  onBlur={() => handleSaveNote(t.id)}
                                  className="w-full bg-[#1e1e1e] border border-blue-500/50 rounded p-1.5 text-xs text-white outline-none resize-none"
                                  placeholder="Add a note..."
                                  rows={2}
                                />
                              </div>
                            ) : (
                              <div 
                                onClick={() => {
                                  setNotingId(t.id);
                                  setNoteInput(t.notes || '');
                                }}
                                className="flex items-start gap-1 text-xs text-zinc-500 hover:text-zinc-300 cursor-pointer group/note"
                              >
                                <StickyNote size={12} className="mt-0.5" />
                                <span className="line-clamp-2">{t.notes}</span>
                              </div>
                            )}
                          </div>
                        )}
                        {/* Splits Display */}
                        {t.splits && t.splits.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {t.splits.map((s: any, idx: number) => (
                              <span key={idx} className="text-[9px] font-bold uppercase tracking-tighter bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20">
                                {s.category}: ${(s.amount || 0).toFixed(2)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="hidden md:block w-40 shrink-0">
                        <select
                          value={t.splits && t.splits.length > 0 ? 'Split Transaction' : t.category}
                          onChange={e => {
                            if (t.splits && t.splits.length > 0) {
                              if (window.confirm('This transaction is split. Changing the category will remove all splits. Continue?')) {
                                updateData({
                                  transactions: transactions.map(txn => txn.id === t.id ? { ...txn, category: e.target.value, splits: undefined } : txn)
                                });
                              }
                            } else {
                              handleCategoryChange(t.id, e.target.value);
                            }
                          }}
                          className="w-full bg-transparent border-none text-sm text-zinc-400 outline-none cursor-pointer hover:text-zinc-300"
                        >
                          {t.splits && t.splits.length > 0 && <option value="Split Transaction">Split Transaction</option>}
                          {catNames.map(c => <option key={c} value={c} className="bg-[#1e1e1e] text-white">{c}</option>)}
                        </select>
                      </div>
                      <div className="hidden md:block w-32 shrink-0 text-xs text-zinc-500 truncate">{t.account}</div>
                      <div className={`w-24 md:w-32 shrink-0 text-right text-[15px] font-semibold ${t.hidden ? 'text-zinc-500' : t.type === 'credit' ? 'text-emerald-400' : 'text-white'}`}>
                        {t.type === 'credit' ? '+' : ''}${t.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className="hidden md:flex w-32 shrink-0 justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => setSplittingId(t.id)}
                          className={`text-zinc-500 hover:text-blue-400 ${t.splits?.length ? 'text-blue-400' : ''}`}
                          title="Split Transaction"
                        >
                          <Split size={16} />
                        </button>
                        <div className="relative">
                          <button 
                            onClick={() => {
                              setNotingId(t.id);
                              setNoteInput(t.notes || '');
                            }}
                            className={`text-zinc-500 hover:text-blue-400 ${t.notes ? 'text-blue-400' : ''}`}
                            title="Add Note"
                          >
                            <StickyNote size={16} />
                          </button>
                        </div>
                        <div className="relative">
                          <button 
                            onClick={() => setEditingId(editingId === t.id ? null : t.id)} 
                            className="text-zinc-500 hover:text-blue-400" 
                            title="Change Date"
                          >
                            <CalendarIcon size={16} />
                          </button>
                          {editingId === t.id && (
                            <input
                              type="date"
                              value={t.date}
                              onChange={(e) => handleDateChange(t.id, e.target.value)}
                              className="absolute right-0 top-8 bg-[#1e1e1e] border border-white/10 text-white rounded p-1 z-50 shadow-xl"
                              autoFocus
                              onBlur={() => setTimeout(() => setEditingId(null), 200)}
                            />
                          )}
                        </div>
                        <button onClick={() => handleToggleHidden(t.id)} className="text-zinc-500 hover:text-zinc-300" title={t.hidden ? 'Show' : 'Hide'}>
                          {t.hidden ? <Eye size={16} /> : <EyeOff size={16} />}
                        </button>
                        <button onClick={() => handleDelete(t.id)} className="text-zinc-500 hover:text-red-400" title="Delete">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-zinc-500">No transactions found.</div>
        )}
        </div>
      </div>

      {/* Split Transaction Modal */}
      {splittingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#1e1e1e] border border-white/5 rounded-2xl shadow-xl w-full max-w-lg p-8 space-y-6 shadow-2xl border-blue-500/20">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">Split Transaction</h2>
                <p className="text-sm text-zinc-500 mt-1">
                  Total: <span className="font-bold text-white">${transactions.find(t => t.id === splittingId)?.amount?.toFixed(2) || '0.00'}</span>
                </p>
              </div>
              <button onClick={() => setSplittingId(null)} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {splits.map((split, idx) => (
                <div key={idx} className="flex gap-3 items-end bg-[#252525] p-4 rounded-xl border border-white/5">
                  <div className="flex-1 space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Category</label>
                    <select 
                      value={split.category}
                      onChange={e => {
                        const newSplits = [...splits];
                        newSplits[idx].category = e.target.value;
                        setSplits(newSplits);
                      }}
                      className="w-full bg-[#1e1e1e] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50 transition-all"
                    >
                      {catNames.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="w-32 space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Amount</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">$</span>
                      <input 
                        type="number" 
                        value={split.amount}
                        onChange={e => {
                          const newSplits = [...splits];
                          newSplits[idx].amount = parseFloat(e.target.value) || 0;
                          setSplits(newSplits);
                        }}
                        className="w-full bg-[#1e1e1e] border border-white/10 rounded-lg pl-7 pr-3 py-2 text-sm text-white outline-none focus:border-blue-500/50 transition-all font-mono"
                      />
                    </div>
                  </div>
                  <button 
                    onClick={() => setSplits(splits.filter((_, i) => i !== idx))}
                    className="p-2.5 text-zinc-500 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2">
              <button 
                onClick={() => setSplits([...splits, { category: catNames[0] || 'Uncategorized', amount: 0 }])}
                className="flex items-center gap-2 text-sm font-bold text-blue-500 hover:text-blue-400 transition-colors"
              >
                <Plus size={16} /> Add Split
              </button>
              <div className="text-right">
                <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Remaining</div>
                <div className={`text-lg font-mono font-bold ${Math.abs(splits.reduce((s, sp) => s + sp.amount, 0) - (transactions.find(t => t.id === splittingId)?.amount || 0)) < 0.01 ? 'text-emerald-500' : 'text-red-500'}`}>
                  ${((transactions.find(t => t.id === splittingId)?.amount || 0) - splits.reduce((s, sp) => s + sp.amount, 0)).toFixed(2)}
                </div>
              </div>
            </div>

            <div className="pt-4 flex gap-3">
              <button 
                onClick={() => setSplittingId(null)}
                className="flex-1 py-3 bg-[#252525] hover:bg-white/[0.04] text-zinc-300 rounded-xl font-bold transition-all border border-white/5"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveSplits}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-500/20 active:scale-95"
              >
                Save Splits
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Manual Transaction Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#1e1e1e] border border-white/5 rounded-2xl shadow-xl w-full max-w-md p-8 space-y-6 shadow-2xl border-blue-500/20">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white tracking-tight">Add Transaction</h2>
              <button onClick={() => setShowAddModal(false)} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Type</label>
                  <div className="flex bg-[#252525] rounded-lg p-1 border border-white/5">
                    <button 
                      onClick={() => setNewTxn({ ...newTxn, type: 'expense' })}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${newTxn.type === 'expense' ? 'bg-[#1e1e1e] text-red-500 shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                    >
                      Expense
                    </button>
                    <button 
                      onClick={() => setNewTxn({ ...newTxn, type: 'credit' })}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${newTxn.type === 'credit' ? 'bg-[#1e1e1e] text-emerald-500 shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                    >
                      Income
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Date</label>
                  <input 
                    type="date" 
                    value={newTxn.date}
                    onChange={e => setNewTxn({ ...newTxn, date: e.target.value })}
                    className="w-full bg-[#252525] border border-white/5 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Description</label>
                <input 
                  type="text" 
                  placeholder="e.g. Coffee at Starbucks"
                  value={newTxn.description}
                  onChange={e => setNewTxn({ ...newTxn, description: e.target.value })}
                  className="w-full bg-[#252525] border border-white/5 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Amount</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">$</span>
                    <input 
                      type="number" 
                      placeholder="0.00"
                      value={newTxn.amount || ''}
                      onChange={e => setNewTxn({ ...newTxn, amount: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-[#252525] border border-white/5 rounded-lg pl-7 pr-3 py-2 text-sm text-white outline-none focus:border-blue-500/50 transition-all font-mono"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Account</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Cash, Visa"
                    value={newTxn.account}
                    onChange={e => setNewTxn({ ...newTxn, account: e.target.value })}
                    className="w-full bg-[#252525] border border-white/5 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">Category</label>
                <select 
                  value={newTxn.category}
                  onChange={e => setNewTxn({ ...newTxn, category: e.target.value })}
                  className="w-full bg-[#252525] border border-white/5 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50 transition-all appearance-none"
                >
                  {catNames.map(c => <option key={c} value={c} className="bg-[#1e1e1e]">{c}</option>)}
                </select>
              </div>
            </div>

            <div className="pt-4 flex gap-3">
              <button 
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-3 bg-[#252525] hover:bg-white/[0.04] text-zinc-300 rounded-xl font-bold transition-all border border-white/5"
              >
                Cancel
              </button>
              <button 
                onClick={handleAddManual}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-500/20 active:scale-95"
              >
                Save Transaction
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
