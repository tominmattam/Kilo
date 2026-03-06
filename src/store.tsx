import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppData, Transaction, Category, CustomRule, Recurring, NetWorthItem, Goal } from './types';
import { DEFAULT_CATEGORIES, DEFAULT_BUDGETS } from './constants';

const STORAGE_KEY = 'fintrack_data';

const defaultData: AppData = {
  transactions: [],
  budgets: { ...DEFAULT_BUDGETS },
  networth: { assets: [], liabilities: [] },
  files: [],
  file_meta: {},
  categories: { ...DEFAULT_CATEGORIES },
  custom_rules: [],
  recurring: [],
  goals: [],
  tags: [],
  theme: 'dark',
};

interface AppContextType {
  data: AppData;
  setData: (data: AppData | ((prev: AppData) => AppData)) => void;
  updateData: (updates: Partial<AppData>) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const mergeData = (parsed: any): AppData => {
  const safeParsed = (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
  return {
    ...defaultData,
    ...safeParsed,
    categories: { ...defaultData.categories, ...(typeof safeParsed?.categories === 'object' && !Array.isArray(safeParsed.categories) ? safeParsed.categories : {}) },
    budgets: { ...defaultData.budgets, ...(typeof safeParsed?.budgets === 'object' && !Array.isArray(safeParsed.budgets) ? safeParsed.budgets : {}) },
    networth: {
      assets: Array.isArray(safeParsed?.networth?.assets) ? safeParsed.networth.assets : defaultData.networth.assets,
      liabilities: Array.isArray(safeParsed?.networth?.liabilities) ? safeParsed.networth.liabilities : defaultData.networth.liabilities,
    },
    transactions: Array.isArray(safeParsed?.transactions) ? safeParsed.transactions : defaultData.transactions,
    recurring: Array.isArray(safeParsed?.recurring) ? safeParsed.recurring : defaultData.recurring,
    custom_rules: Array.isArray(safeParsed?.custom_rules) ? safeParsed.custom_rules : defaultData.custom_rules,
    goals: Array.isArray(safeParsed?.goals) ? safeParsed.goals : defaultData.goals,
    tags: Array.isArray(safeParsed?.tags) ? safeParsed.tags : defaultData.tags,
    files: Array.isArray(safeParsed?.files) ? safeParsed.files : defaultData.files,
    file_meta: safeParsed?.file_meta || defaultData.file_meta,
  };
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [data, setDataState] = useState<AppData>(defaultData);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch('/api/data');
        if (response.ok) {
          const parsed = await response.json();
          if (parsed) {
            setDataState(mergeData(parsed));
          } else {
            // Check localStorage for migration
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
              try {
                const localParsed = JSON.parse(stored);
                const migratedData = mergeData(localParsed);
                setDataState(migratedData);
                // Save to API
                fetch('/api/data', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(migratedData),
                });
              } catch (e) {
                console.error('Failed to parse localStorage data', e);
              }
            }
          }
        }
      } catch (e) {
        console.error('Failed to fetch data from API', e);
      } finally {
        setIsLoaded(true);
      }
    };
    loadData();
  }, []);

  const setData = (newData: AppData | ((prev: AppData) => AppData)) => {
    setDataState((prev) => {
      const updated = typeof newData === 'function' ? newData(prev) : newData;
      
      // Save to API
      fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      }).catch(e => console.error('Failed to save data to API', e));

      return updated;
    });
  };

  const updateData = (updates: Partial<AppData>) => {
    setData((prev) => ({ ...prev, ...updates }));
  };

  if (!isLoaded) {
    return <div className="flex h-screen w-full items-center justify-center bg-[#141414] text-white">Loading...</div>;
  }

  return (
    <AppContext.Provider value={{ data, setData, updateData }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
