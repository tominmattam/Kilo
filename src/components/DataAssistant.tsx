import React, { useState, useMemo, useEffect } from 'react';
import { Bot, X, AlertCircle, CheckCircle2, Zap, ArrowRight, Terminal, Database, Trash2 } from 'lucide-react';
import { useAppContext } from '../store';
import { categorize } from '../utils/parser';
import { motion, AnimatePresence } from 'motion/react';

export const DataAssistant: React.FC = () => {
  const { data, updateData } = useAppContext();
  const { transactions, budgets, customRules } = data;
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'data' | 'system'>('data');

  // --- SYSTEM HEALTH STATE ---
  const [systemErrors, setSystemErrors] = useState<{id: string, message: string, type: string}[]>([]);
  const [storageSize, setStorageSize] = useState<number>(0);

  useEffect(() => {
    // 1. Intercept Console Errors
    const originalError = console.error;
    console.error = (...args) => {
      const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
      // Ignore some common benign dev errors if needed, but we'll catch most
      if (!msg.includes('Warning:')) {
        setSystemErrors(prev => {
          if (prev.some(e => e.message === msg)) return prev; // dedupe
          return [...prev, { id: Math.random().toString(), message: msg.slice(0, 100) + (msg.length > 100 ? '...' : ''), type: 'Console Error' }];
        });
      }
      originalError(...args);
    };

    // 2. Intercept Window Errors
    const handleWindowError = (e: ErrorEvent) => {
      setSystemErrors(prev => {
        if (prev.some(err => err.message === e.message)) return prev;
        return [...prev, { id: Math.random().toString(), message: e.message, type: 'Runtime Error' }];
      });
    };
    window.addEventListener('error', handleWindowError);

    // 3. Check LocalStorage Size
    const checkStorage = () => {
      try {
        let total = 0;
        for(let x in localStorage) {
          if(localStorage.hasOwnProperty(x)) {
            total += ((localStorage[x].length + x.length) * 2);
          }
        }
        setStorageSize(total);
      } catch (e) {}
    };
    checkStorage();
    const interval = setInterval(checkStorage, 10000);

    return () => {
      console.error = originalError;
      window.removeEventListener('error', handleWindowError);
      clearInterval(interval);
    };
  }, []);

  const storageWarning = storageSize > 3 * 1024 * 1024; // 3MB warning
  const performanceWarning = transactions.length > 5000; // 5000+ txns might slow down UI

  const totalSystemIssues = systemErrors.length + (storageWarning ? 1 : 0) + (performanceWarning ? 1 : 0);

  // --- DATA HEALTH STATE ---
  const uncategorized = useMemo(() => {
    return transactions.filter(t => !t.category || t.category === 'Uncategorized' || t.category === '');
  }, [transactions]);

  const missingBudgets = useMemo(() => {
    const spendingByCategory: Record<string, number> = {};
    const currentMonth = new Date().toISOString().slice(0, 7);
    
    transactions.forEach(t => {
      if (t.type === 'expense' && t.date.startsWith(currentMonth)) {
        spendingByCategory[t.category] = (spendingByCategory[t.category] || 0) + t.amount;
      }
    });

    const issues: { category: string, spent: number }[] = [];
    Object.entries(spendingByCategory).forEach(([cat, spent]) => {
      if (spent > 0 && (!budgets[cat] || budgets[cat] === 0)) {
        issues.push({ category: cat, spent });
      }
    });
    return issues;
  }, [transactions, budgets]);

  const duplicates = useMemo(() => {
    const seen = new Set<string>();
    const dupes: typeof transactions = [];
    
    transactions.forEach(t => {
      // User requested stricter duplicate detection: Same Date + Same Amount = Duplicate
      // We also check type (expense/income) to avoid mixing them.
      const key = `${t.date}-${t.amount}-${t.type}`;
      if (seen.has(key)) {
        dupes.push(t);
      } else {
        seen.add(key);
      }
    });
    return dupes;
  }, [transactions]);

  const totalDataIssues = uncategorized.length + missingBudgets.length + duplicates.length;
  const totalIssues = totalDataIssues + totalSystemIssues;

  // --- FIX ACTIONS ---
  const fixUncategorized = () => {
    let fixedCount = 0;
    const updated = transactions.map(t => {
      if (!t.category || t.category === 'Uncategorized' || t.category === '') {
        const newCat = categorize(t.description, customRules);
        if (newCat !== 'Uncategorized') {
          fixedCount++;
          return { ...t, category: newCat };
        }
      }
      return t;
    });
    
    if (fixedCount > 0) {
      updateData({ transactions: updated });
      alert(`Successfully categorized ${fixedCount} transactions.`);
    } else {
      alert("Could not automatically categorize any transactions. Please add custom rules or categorize manually.");
    }
  };

  const fixMissingBudgets = () => {
    const newBudgets = { ...budgets };
    missingBudgets.forEach(issue => {
      newBudgets[issue.category] = Math.ceil(issue.spent / 10) * 10;
    });
    updateData({ budgets: newBudgets });
    alert(`Created budgets for ${missingBudgets.length} categories.`);
  };

  const fixDuplicates = () => {
    if (window.confirm(`Found ${duplicates.length} transactions with the same date and amount. Are you sure they are duplicates and you want to delete them?`)) {
      const dupeIds = new Set(duplicates.map(d => d.id));
      const updated = transactions.filter(t => !dupeIds.has(t.id));
      updateData({ transactions: updated });
      alert(`Removed ${duplicates.length} duplicate transactions.`);
    }
  };

  const fixAllData = () => {
    let uncategorizedFixed = 0;
    let budgetsFixed = 0;
    let duplicatesFixed = 0;

    // Fix Uncategorized
    const updatedTxns = transactions.map(t => {
      if (!t.category || t.category === 'Uncategorized' || t.category === '') {
        const newCat = categorize(t.description, customRules);
        if (newCat !== 'Uncategorized') {
          uncategorizedFixed++;
          return { ...t, category: newCat };
        }
      }
      return t;
    });

    // Fix Duplicates (on top of potentially updated categories)
    const dupeIds = new Set(duplicates.map(d => d.id));
    const finalTxns = updatedTxns.filter(t => {
      if (dupeIds.has(t.id)) {
        duplicatesFixed++;
        return false;
      }
      return true;
    });

    // Fix Budgets
    const newBudgets = { ...budgets };
    if (missingBudgets.length > 0) {
      missingBudgets.forEach(issue => {
        newBudgets[issue.category] = Math.ceil(issue.spent / 10) * 10;
        budgetsFixed++;
      });
    }

    updateData({ transactions: finalTxns, budgets: newBudgets });
    
    const messages = [];
    if (uncategorizedFixed > 0) messages.push(`Categorized ${uncategorizedFixed} transactions`);
    if (duplicatesFixed > 0) messages.push(`Removed ${duplicatesFixed} duplicates`);
    if (budgetsFixed > 0) messages.push(`Created ${budgetsFixed} budgets`);
    
    if (messages.length > 0) {
      alert(`Auto-fix complete:\n• ${messages.join('\n• ')}`);
    } else {
      alert("No automatic fixes could be applied. Please review issues manually.");
    }
  };

  const clearSystemErrors = () => setSystemErrors([]);
  const optimizeStorage = () => {
    // Remove hidden transactions to save space
    const updated = transactions.filter(t => !t.hidden);
    updateData({ transactions: updated });
    alert("Removed hidden transactions to optimize storage.");
  };
  const hardReset = async () => {
    if (window.confirm("WARNING: This will delete ALL your data and reset the app to factory settings. Are you sure?")) {
      localStorage.clear();
      try {
        await fetch('/api/data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(null), // Or send defaultData
        });
      } catch (e) {
        console.error('Failed to clear API data', e);
      }
      window.location.reload();
    }
  };

  const generateTestData = () => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const testTxns = [
      { id: '1', date: `${currentMonth}-05`, description: 'Starbucks Coffee', amount: 5.50, type: 'expense' as const, account: 'Checking', category: 'Uncategorized', hidden: false },
      { id: '2', date: `${currentMonth}-05`, description: 'Starbucks Coffee', amount: 5.50, type: 'expense' as const, account: 'Checking', category: 'Uncategorized', hidden: false }, // Duplicate
      { id: '3', date: `${currentMonth}-10`, description: 'Unknown Merchant', amount: 45.00, type: 'expense' as const, account: 'Credit Card', category: 'Uncategorized', hidden: false },
      { id: '4', date: `${currentMonth}-12`, description: 'Netflix Subscription', amount: 15.99, type: 'expense' as const, account: 'Credit Card', category: 'Entertainment', hidden: false }, // Assuming Entertainment has no budget initially
    ];
    updateData({ transactions: [...transactions, ...testTxns] });
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-[#8b5cf6] hover:bg-[#a78bfa] text-white rounded-full shadow-lg shadow-[#8b5cf6]/20 flex items-center justify-center transition-transform hover:scale-105 z-40"
      >
        <Bot size={24} />
        {totalIssues > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-[#141414]">
            {totalIssues}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 right-6 w-[380px] bg-[#1e1e1e] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[80vh]"
          >
            <div className="p-4 border-b border-white/5 bg-[#252525]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#8b5cf6]/20 text-[#8b5cf6] flex items-center justify-center">
                    <Bot size={18} />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold text-sm">AI Assistant</h3>
                    <p className="text-zinc-400 text-xs">Diagnostics & Auto-Fix</p>
                  </div>
                </div>
                <button onClick={() => setIsOpen(false)} className="text-zinc-500 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>
              
              <div className="flex bg-[#141414] rounded-lg p-1 border border-white/5">
                <button 
                  onClick={() => setActiveTab('data')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-2 ${activeTab === 'data' ? 'bg-[#2a2a2a] text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  <Database size={12} /> Data ({totalDataIssues})
                </button>
                <button 
                  onClick={() => setActiveTab('system')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-2 ${activeTab === 'system' ? 'bg-[#2a2a2a] text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  <Terminal size={12} /> System ({totalSystemIssues})
                </button>
              </div>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              {activeTab === 'data' && (
                <>
                  {totalDataIssues === 0 ? (
                    <div className="text-center py-8">
                      <div className="w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-3">
                        <CheckCircle2 size={24} />
                      </div>
                      <h4 className="text-white font-medium mb-1">Data is Clean!</h4>
                      <p className="text-zinc-400 text-sm mb-4">No data issues detected.</p>
                      {transactions.length === 0 && (
                        <button 
                          onClick={generateTestData}
                          className="bg-[#2a2a2a] hover:bg-[#333] border border-white/10 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
                        >
                          Generate Test Data
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="bg-[#8b5cf6]/10 border border-[#8b5cf6]/20 rounded-xl p-3 flex items-start gap-3">
                        <Zap className="text-[#8b5cf6] shrink-0 mt-0.5" size={16} />
                        <div>
                          <h4 className="text-[#8b5cf6] text-sm font-medium mb-1">I found {totalDataIssues} data issues</h4>
                          <p className="text-zinc-400 text-xs mb-3">I can automatically fix these to keep your budget accurate.</p>
                          <button 
                            onClick={fixAllData}
                            className="bg-[#8b5cf6] hover:bg-[#a78bfa] text-white text-xs font-semibold px-4 py-1.5 rounded-lg transition-colors"
                          >
                            Auto-Fix All Data
                          </button>
                        </div>
                      </div>

                      {uncategorized.length > 0 && (
                        <div className="bg-[#252525] border border-white/5 rounded-xl p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 text-sm text-white font-medium">
                              <AlertCircle size={14} className="text-amber-500" />
                              Uncategorized Transactions
                            </div>
                            <span className="text-xs bg-amber-500/20 text-amber-500 px-2 py-0.5 rounded-full font-bold">{uncategorized.length}</span>
                          </div>
                          <p className="text-xs text-zinc-400 mb-3">Some transactions are missing categories. I can auto-categorize them based on merchant names.</p>
                          <button onClick={fixUncategorized} className="text-xs text-[#8b5cf6] hover:text-[#a78bfa] font-medium flex items-center gap-1">
                            Fix Now <ArrowRight size={12} />
                          </button>
                        </div>
                      )}

                      {missingBudgets.length > 0 && (
                        <div className="bg-[#252525] border border-white/5 rounded-xl p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 text-sm text-white font-medium">
                              <AlertCircle size={14} className="text-amber-500" />
                              Missing Budgets
                            </div>
                            <span className="text-xs bg-amber-500/20 text-amber-500 px-2 py-0.5 rounded-full font-bold">{missingBudgets.length}</span>
                          </div>
                          <p className="text-xs text-zinc-400 mb-3">You have spending in categories without a set budget. I can create budgets based on your spending.</p>
                          <button onClick={fixMissingBudgets} className="text-xs text-[#8b5cf6] hover:text-[#a78bfa] font-medium flex items-center gap-1">
                            Fix Now <ArrowRight size={12} />
                          </button>
                        </div>
                      )}

                      {duplicates.length > 0 && (
                        <div className="bg-[#252525] border border-white/5 rounded-xl p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 text-sm text-white font-medium">
                              <AlertCircle size={14} className="text-red-500" />
                              Duplicate Transactions
                            </div>
                            <span className="text-xs bg-red-500/20 text-red-500 px-2 py-0.5 rounded-full font-bold">{duplicates.length}</span>
                          </div>
                          <p className="text-xs text-zinc-400 mb-3">Found transactions with the same date and amount. This usually indicates a duplicate import.</p>
                          <button onClick={fixDuplicates} className="text-xs text-[#8b5cf6] hover:text-[#a78bfa] font-medium flex items-center gap-1">
                            Fix Now <ArrowRight size={12} />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {activeTab === 'system' && (
                <>
                  {totalSystemIssues === 0 ? (
                    <div className="text-center py-8">
                      <div className="w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-3">
                        <CheckCircle2 size={24} />
                      </div>
                      <h4 className="text-white font-medium mb-1">System is Healthy!</h4>
                      <p className="text-zinc-400 text-sm">No software errors or performance issues detected.</p>
                    </div>
                  ) : (
                    <>
                      {systemErrors.length > 0 && (
                        <div className="bg-[#252525] border border-white/5 rounded-xl p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 text-sm text-white font-medium">
                              <Terminal size={14} className="text-red-500" />
                              Software Errors
                            </div>
                            <span className="text-xs bg-red-500/20 text-red-500 px-2 py-0.5 rounded-full font-bold">{systemErrors.length}</span>
                          </div>
                          <div className="space-y-2 mb-3 max-h-32 overflow-y-auto no-scrollbar">
                            {systemErrors.map(err => (
                              <div key={err.id} className="bg-[#141414] border border-white/5 rounded p-2 text-[10px] font-mono text-red-400 break-words">
                                <span className="text-zinc-500 block mb-0.5">{err.type}</span>
                                {err.message}
                              </div>
                            ))}
                          </div>
                          <button onClick={clearSystemErrors} className="text-xs text-[#8b5cf6] hover:text-[#a78bfa] font-medium flex items-center gap-1">
                            Dismiss Errors <CheckCircle2 size={12} />
                          </button>
                        </div>
                      )}

                      {(storageWarning || performanceWarning) && (
                        <div className="bg-[#252525] border border-white/5 rounded-xl p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 text-sm text-white font-medium">
                              <Zap size={14} className="text-amber-500" />
                              Performance Warnings
                            </div>
                          </div>
                          {storageWarning && <p className="text-xs text-zinc-400 mb-2">• LocalStorage is getting full ({(storageSize / 1024 / 1024).toFixed(1)}MB). This might cause save failures.</p>}
                          {performanceWarning && <p className="text-xs text-zinc-400 mb-2">• You have {transactions.length} transactions. This large dataset might slow down the app.</p>}
                          
                          <button onClick={optimizeStorage} className="text-xs text-[#8b5cf6] hover:text-[#a78bfa] font-medium flex items-center gap-1 mt-3">
                            Optimize Data <ArrowRight size={12} />
                          </button>
                        </div>
                      )}
                    </>
                  )}

                  <div className="mt-4 pt-4 border-t border-white/5">
                    <button 
                      onClick={hardReset}
                      className="w-full flex items-center justify-center gap-2 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-xs font-semibold rounded-lg transition-colors"
                    >
                      <Trash2 size={14} /> Factory Reset App
                    </button>
                    <p className="text-[10px] text-zinc-500 text-center mt-2">This will permanently delete all local data.</p>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
