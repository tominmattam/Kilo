/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AppProvider } from './store';
import { Layout, Page } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { Transactions } from './components/Transactions';
import { Budget } from './components/Budget';
import { Insights } from './components/Insights';
import { DataSources } from './components/DataSources';
import { Categories } from './components/Categories';
import { Recurring } from './components/Recurring';
import { About } from './components/About';
import { DataAssistant } from './components/DataAssistant';

export default function App() {
  const [activePage, setActivePage] = useState<Page>('Dashboard');
  const [dateFilter, setDateFilter] = useState('This Month');
  const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' });
  const [categoryFilter, setCategoryFilter] = useState('All categories');

  return (
    <AppProvider>
      <Layout activePage={activePage} setActivePage={setActivePage} dateFilter={dateFilter} setDateFilter={setDateFilter} customDateRange={customDateRange} setCustomDateRange={setCustomDateRange}>
        {activePage === 'Dashboard' && <Dashboard dateFilter={dateFilter} customDateRange={customDateRange} setActivePage={setActivePage} setCategoryFilter={setCategoryFilter} />}
        {activePage === 'Transactions' && <Transactions dateFilter={dateFilter} customDateRange={customDateRange} categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter} />}
        {activePage === 'Budget' && <Budget dateFilter={dateFilter} customDateRange={customDateRange} setActivePage={setActivePage} setCategoryFilter={setCategoryFilter} />}
        {activePage === 'Insights' && <Insights />}
        {activePage === 'Data Sources' && <DataSources />}
        {activePage === 'Categories' && <Categories />}
        {activePage === 'Recurring' && <Recurring />}
        {activePage === 'About' && <About />}
      </Layout>
      <DataAssistant />
    </AppProvider>
  );
}
