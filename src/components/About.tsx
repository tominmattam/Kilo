import React from 'react';

export const About: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] space-y-6">
      <h1 className="text-6xl font-bold text-white tracking-tight font-display">Kilo</h1>
      
      <div className="flex items-center gap-3 text-xl text-zinc-400 font-medium bg-[#1e1e1e] px-6 py-3 rounded-full border border-white/5 shadow-lg">
        <span>Local-First & Private</span>
        <span className="text-emerald-500 text-2xl">🔒</span>
      </div>
    </div>
  );
};
