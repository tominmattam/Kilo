import React, { useState, useEffect } from 'react';
import { useAppContext } from '../store';
import { Trash2, Save, Plus, Sparkles, Brain, RefreshCw, CheckCircle, ArrowRight } from 'lucide-react';
import { classifier } from '../utils/classifier';

export const Categories: React.FC = () => {
  const { data, updateData } = useAppContext();
  const { categories, custom_rules, transactions } = data;

  const [activeTab, setActiveTab] = useState<'Categories' | 'Rules' | 'Smart AI'>('Categories');
  
  // AI State
  const [aiStats, setAiStats] = useState({ vocabSize: 0, categories: 0, trainedOn: 0 });
  const [aiProcessing, setAiProcessing] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);

  useEffect(() => {
    setAiStats(classifier.getStats());
  }, [transactions]);

  const handleRunAI = () => {
    setAiProcessing(true);
    setAiResult(null);
    
    setTimeout(() => {
      const uncategorized = transactions.filter(t => t.category === 'Uncategorized');
      if (uncategorized.length === 0) {
        setAiResult('No uncategorized transactions found.');
        setAiProcessing(false);
        return;
      }

      let updatedCount = 0;
      const newTransactions = transactions.map(t => {
        if (t.category === 'Uncategorized') {
          const prediction = classifier.predict(t.description);
          if (prediction.category !== 'Uncategorized' && aiStats.vocabSize > 10) {
            updatedCount++;
            return { ...t, category: prediction.category };
          }
        }
        return t;
      });

      if (updatedCount > 0) {
        updateData({ transactions: newTransactions });
        setAiResult(`Successfully categorized ${updatedCount} transactions!`);
      } else {
        setAiResult('AI could not confidently categorize any remaining transactions.');
      }
      setAiProcessing(false);
    }, 100);
  };

  const handleRetrain = () => {
    setAiProcessing(true);
    setTimeout(() => {
      classifier.train(transactions);
      setAiStats(classifier.getStats());
      setAiProcessing(false);
      setAiResult('Model retrained successfully.');
    }, 100);
  };

  
  // Category state
  const [catEdits, setCatEdits] = useState<Record<string, { name: string, icon: string, color: string }>>({});
  const [newCat, setNewCat] = useState({ name: '', icon: '📦', color: '#fb923c' });

  // Rule state
  const [newRule, setNewRule] = useState({ keyword: '', category: Object.keys(categories)[0] || 'Uncategorized' });

  const handleCatEdit = (oldName: string, field: 'name' | 'icon' | 'color', value: string) => {
    setCatEdits(prev => ({
      ...prev,
      [oldName]: {
        ...(prev[oldName] || { name: oldName, icon: categories[oldName].icon, color: categories[oldName].color }),
        [field]: value
      }
    }));
  };

  const saveCat = (oldName: string) => {
    const edit = catEdits[oldName];
    if (!edit) return;

    const newCategories = { ...categories };
    
    if (edit.name !== oldName) {
      if (newCategories[edit.name]) {
        alert('Category name already exists.');
        return;
      }
      
      // Update transactions
      const newTxns = transactions.map(t => t.category === oldName ? { ...t, category: edit.name } : t);
      
      // Update rules
      const newRules = custom_rules.map(r => r.category === oldName ? { ...r, category: edit.name } : r);
      
      delete newCategories[oldName];
      newCategories[edit.name] = { icon: edit.icon, color: edit.color };
      
      updateData({
        categories: newCategories,
        transactions: newTxns,
        custom_rules: newRules
      });
    } else {
      newCategories[oldName] = { icon: edit.icon, color: edit.color };
      updateData({ categories: newCategories });
    }
    
    const newEdits = { ...catEdits };
    delete newEdits[oldName];
    setCatEdits(newEdits);
  };

  const deleteCat = (name: string) => {
    if (['Payments', 'Uncategorized', 'Transfer'].includes(name)) {
      alert('Cannot delete this category.');
      return;
    }
    
    if (window.confirm(`Delete category '${name}'? Transactions will be moved to 'Uncategorized'.`)) {
      const newCategories = { ...categories };
      delete newCategories[name];
      
      const newTxns = transactions.map(t => t.category === name ? { ...t, category: 'Uncategorized' } : t);
      const newRules = custom_rules.filter(r => r.category !== name);
      
      updateData({
        categories: newCategories,
        transactions: newTxns,
        custom_rules: newRules
      });
    }
  };

  const addCat = () => {
    if (!newCat.name || categories[newCat.name]) return;
    
    updateData({
      categories: {
        ...categories,
        [newCat.name]: { icon: newCat.icon, color: newCat.color }
      }
    });
    setNewCat({ name: '', icon: '📦', color: '#fb923c' });
  };

  const addRule = () => {
    if (!newRule.keyword) return;
    
    const rule = { keyword: newRule.keyword.toUpperCase(), category: newRule.category };
    const newRules = [...custom_rules, rule];
    
    // Apply retroactively
    const newTxns = transactions.map(t => {
      if (t.type === 'expense' && t.description.toUpperCase().includes(rule.keyword)) {
        return { ...t, category: rule.category };
      }
      return t;
    });
    
    updateData({
      custom_rules: newRules,
      transactions: newTxns
    });
    
    setNewRule({ ...newRule, keyword: '' });
  };

  const deleteRule = (index: number) => {
    updateData({
      custom_rules: custom_rules.filter((_, i) => i !== index)
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex items-end gap-4">
        <h1 className="text-4xl font-bold text-white tracking-tight font-display">Categories</h1>
      </div>

      <div className="flex gap-8 border-b border-white/5">
        <button
          onClick={() => setActiveTab('Categories')}
          className={`pb-4 text-sm font-semibold border-b-2 transition-all ${activeTab === 'Categories' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
        >
          📋 Categories
        </button>
        <button
          onClick={() => setActiveTab('Rules')}
          className={`pb-4 text-sm font-semibold border-b-2 transition-all ${activeTab === 'Rules' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
        >
          🔑 Auto-Categorisation Rules
        </button>
        <button
          onClick={() => setActiveTab('Smart AI')}
          className={`pb-4 text-sm font-semibold border-b-2 transition-all ${activeTab === 'Smart AI' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
        >
          ✨ Smart AI
        </button>
      </div>

      {activeTab === 'Smart AI' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-gradient-to-br from-indigo-900/20 to-purple-900/20 border border-indigo-500/20 rounded-2xl shadow-xl p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                    <Brain size={200} />
                </div>
                
                <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 bg-indigo-500/20 rounded-xl text-indigo-400 shadow-lg shadow-indigo-500/10">
                        <Sparkles size={24} />
                    </div>
                    <div>
                        <h3 className="text-white font-bold text-2xl tracking-tight">Smart Categorization Engine</h3>
                        <p className="text-indigo-200/60 text-sm">Powered by Naive Bayes Classification</p>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-black/20 rounded-xl p-4 border border-white/5 backdrop-blur-sm">
                        <div className="text-xs font-mono text-indigo-300/60 uppercase tracking-wider mb-1">Training Data</div>
                        <div className="text-3xl font-bold text-white">{aiStats.trainedOn.toLocaleString()} <span className="text-sm font-normal text-zinc-400">txns</span></div>
                    </div>
                    <div className="bg-black/20 rounded-xl p-4 border border-white/5 backdrop-blur-sm">
                        <div className="text-xs font-mono text-indigo-300/60 uppercase tracking-wider mb-1">Vocabulary</div>
                        <div className="text-3xl font-bold text-white">{aiStats.vocabSize.toLocaleString()} <span className="text-sm font-normal text-zinc-400">words</span></div>
                    </div>
                    <div className="bg-black/20 rounded-xl p-4 border border-white/5 backdrop-blur-sm">
                        <div className="text-xs font-mono text-indigo-300/60 uppercase tracking-wider mb-1">Knowledge Base</div>
                        <div className="text-3xl font-bold text-white">{aiStats.categories} <span className="text-sm font-normal text-zinc-400">categories</span></div>
                    </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-4">
                    <button 
                        onClick={handleRunAI}
                        disabled={aiProcessing}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/20 hover:scale-105 active:scale-95"
                    >
                        {aiProcessing ? <RefreshCw className="animate-spin" size={20} /> : <Brain size={20} />}
                        {aiProcessing ? 'Processing...' : 'Run AI on Uncategorized'}
                    </button>
                    
                    <button 
                        onClick={handleRetrain}
                        disabled={aiProcessing}
                        className="flex items-center gap-2 bg-[#252525] hover:bg-[#303030] text-zinc-300 px-6 py-3 rounded-xl font-medium transition-all border border-white/5 hover:border-white/10"
                    >
                        <RefreshCw size={20} />
                        Retrain Model
                    </button>
                    
                    {aiResult && (
                        <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium bg-emerald-400/10 px-4 py-2 rounded-lg border border-emerald-400/20 animate-in fade-in slide-in-from-left-4 duration-300">
                            <CheckCircle size={18} />
                            {aiResult}
                        </div>
                    )}
                </div>
                
                <div className="mt-8 p-4 bg-indigo-500/10 rounded-xl border border-indigo-500/10 text-indigo-200/80 text-sm leading-relaxed">
                    <strong className="text-indigo-300">How it works:</strong> The AI analyzes your existing categorized transactions to learn patterns in merchant names and descriptions. 
                    When you run it, it applies these patterns to guess the category for any "Uncategorized" transactions. 
                    <br/><br/>
                    <span className="text-xs opacity-70">Tip: The more you manually categorize, the smarter the AI becomes!</span>
                </div>
            </div>
        </div>
      )}

      {activeTab === 'Categories' && (
        <div className="space-y-8">
          <p className="text-zinc-400 text-sm font-mono">Edit name, icon, colour. Renaming automatically updates all transactions.</p>
          
          <div className="bg-[#1e1e1e] border border-white/5 rounded-2xl shadow-xl overflow-hidden overflow-x-auto">
            <div className="min-w-[600px]">
              <div className="grid grid-cols-[2.5fr_0.7fr_1.5fr_1fr_0.8fr_0.8fr] gap-4 px-6 py-4 border-b border-white/5 text-[11px] font-bold text-zinc-500 uppercase tracking-widest bg-[#252525]">
                <div>Name</div>
                <div>Icon</div>
                <div>Colour</div>
                <div className="text-right">Total Spent</div>
                <div></div>
                <div></div>
              </div>
              
              <div className="divide-y divide-black/5 dark:divide-white/5">
                {Object.entries(categories)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([name, meta]: [string, any]) => {
                  const edit = catEdits[name] || { name, icon: meta.icon, color: meta.color };
                  const isEdited = !!catEdits[name];
                  const totalSpent = transactions
                    .filter(t => t.category === name && t.type === 'expense')
                    .reduce((sum, t) => sum + t.amount, 0);
                  
                  return (
                    <div key={name} className="grid grid-cols-[2.5fr_0.7fr_1.5fr_1fr_0.8fr_0.8fr] gap-4 px-6 py-4 items-center hover:bg-white/[0.02] transition-colors">
                      <input
                        type="text"
                        value={edit.name}
                        onChange={e => handleCatEdit(name, 'name', e.target.value)}
                        className="bg-[#252525] border border-white/5 rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all hover:bg-white/[0.04]"
                      />
                      <input
                        type="text"
                        value={edit.icon}
                        onChange={e => handleCatEdit(name, 'icon', e.target.value)}
                        className="bg-[#252525] border border-white/5 rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all hover:bg-white/[0.04] text-center"
                      />
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={edit.color}
                          onChange={e => handleCatEdit(name, 'color', e.target.value)}
                          className="w-8 h-8 rounded cursor-pointer bg-transparent border-none p-0"
                        />
                        <span className="text-xs text-zinc-500 font-mono">{edit.color}</span>
                      </div>
                      <div className="text-right text-sm text-zinc-400 font-mono">
                        ${totalSpent.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </div>
                      <button
                        onClick={() => saveCat(name)}
                        disabled={!isEdited}
                        className={`flex justify-center p-2 rounded-lg transition-colors ${isEdited ? 'text-emerald-500 dark:text-emerald-400 hover:bg-emerald-400/10' : 'text-zinc-400 dark:text-zinc-600 cursor-not-allowed'}`}
                        title="Save"
                      >
                        <Save size={18} />
                      </button>
                      <button
                        onClick={() => deleteCat(name)}
                        className="flex justify-center p-2 rounded-lg text-zinc-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-400/10 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="pt-8 mt-8 border-t border-white/5">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3 tracking-tight">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm"><Plus size={16} /></div>
              New Category
            </h3>
            <div className="flex gap-4 items-center">
              <input
                type="text"
                placeholder="Category name"
                value={newCat.name}
                onChange={e => setNewCat({ ...newCat, name: e.target.value })}
                className="flex-[3] bg-[#252525] border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all hover:bg-white/[0.04]"
              />
              <input
                type="text"
                value={newCat.icon}
                onChange={e => setNewCat({ ...newCat, icon: e.target.value })}
                className="flex-[0.8] bg-[#252525] border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all hover:bg-white/[0.04] text-center"
              />
              <div className="flex-[1.5] flex items-center gap-2">
                <input
                  type="color"
                  value={newCat.color}
                  onChange={e => setNewCat({ ...newCat, color: e.target.value })}
                  className="w-8 h-8 rounded cursor-pointer bg-transparent border-none p-0"
                />
              </div>
              <button
                onClick={addCat}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 px-4 rounded-xl transition-all text-sm shadow-lg shadow-blue-500/20"
              >
                Add Category
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'Rules' && (
        <div className="space-y-8">
          <p className="text-zinc-400 text-sm font-mono">Keyword matches are checked before categorisation. Rules apply retroactively.</p>
          
          <div className="space-y-3">
            {custom_rules.map((rule, i) => (
              <div key={i} className="flex gap-4 items-center bg-[#1e1e1e] border border-white/5 rounded-2xl shadow-xl p-4">
                <div className="flex-[3] min-w-0 font-mono text-sm bg-[#252525] px-4 py-2 rounded-lg border border-white/5 text-blue-600 dark:text-blue-300 truncate" title={rule.keyword}>
                  {rule.keyword}
                </div>
                <div className="flex-[3] min-w-0 text-sm text-zinc-600 dark:text-zinc-300 flex items-center gap-3">
                  <span className="text-zinc-500 shrink-0">→</span>
                  <span className="font-semibold text-white bg-[#252525] px-3 py-1.5 rounded-lg border border-white/5 truncate shrink-0">{categories[rule.category]?.icon || '📦'} {rule.category}</span>
                </div>
                <button
                  onClick={() => deleteRule(i)}
                  className="w-10 h-10 shrink-0 flex items-center justify-center text-zinc-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          <div className="pt-8 mt-8 border-t border-white/5">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3 tracking-tight">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm"><Plus size={16} /></div>
              New Rule
            </h3>
            <div className="flex gap-4 items-center">
              <input
                type="text"
                placeholder="Keyword e.g. NETFLIX"
                value={newRule.keyword}
                onChange={e => setNewRule({ ...newRule, keyword: e.target.value })}
                className="flex-[3] bg-[#252525] border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all hover:bg-white/[0.04] font-mono uppercase"
              />
              <select
                value={newRule.category}
                onChange={e => setNewRule({ ...newRule, category: e.target.value })}
                className="flex-[3] bg-[#252525] border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all hover:bg-white/[0.04] appearance-none"
              >
                {Object.keys(categories).map(c => <option key={c} value={c} className="bg-[#1e1e1e] text-white">{c}</option>)}
              </select>
              <button
                onClick={addRule}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 px-4 rounded-xl transition-all text-sm shadow-lg shadow-blue-500/20"
              >
                Add Rule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
