import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import Logo from "../../assets/images/motoka logo.svg";
import { HomeIcon, BellAlertIcon } from '@heroicons/react/24/outline';

export default function DemoAdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const isActive = (href) => location.pathname.startsWith(href);
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <aside className="hidden md:flex w-64 flex-col bg-[#05243F]">
        <div className="flex items-center gap-2 px-3 pt-8 pb-5 border-b border-white/10">
          <img src={Logo} alt="Motoka" className="h-7 w-7" />
          <div>
            <p className="text-sm font-semibold text-white">Motoka</p>
            <span className="bg-[#EBB950]/15 text-[#EBB950] text-[10px] px-1.5 py-0.5 rounded font-semibold">DEMO</span>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          <button onClick={() => navigate('/admin/demo/dashboard')} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-left ${isActive('/admin/demo/dashboard') ? 'bg-[#EBB950]/15 text-[#EBB950]' : 'text-white/60 hover:bg-white/10'}`}>
            <HomeIcon className="h-5 w-5" /> Dashboard
          </button>
          <button onClick={() => navigate('/admin/demo/renewals')} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-left ${isActive('/admin/demo/renewals') ? 'bg-[#EBB950]/15 text-[#EBB950]' : 'text-white/60 hover:bg-white/10'}`}>
            <BellAlertIcon className="h-5 w-5" /> Renewals
          </button>
        </nav>
        <div className="p-3 border-t border-white/10">
          <p className="text-xs text-white/40 px-2">Demo — mock data. <a href="/admin/login" className="underline text-white/60">Login for real data</a></p>
        </div>
      </aside>
      <div className="flex flex-1 flex-col min-w-0">
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-xs text-amber-800">Demo mode — mock vehicles. Month filter works the same with live data.</div>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
