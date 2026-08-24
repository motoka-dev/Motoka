import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BellAlertIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { listRenewals } from '../../services/apiAdminRenewals';

/**
 * Renewals at a glance.
 *
 * Deliberately leads with Expired: it is the biggest cohort and the one no
 * automated reminder ever revisits, so it is where the recoverable revenue sits.
 * Every tile links straight into the matching tab so this is a way in, not a
 * dead readout.
 */

// Single blue scale, matching the rest of the dashboard. Urgency is carried by the
// left-to-right order (most urgent first) and by depth of blue, not by a traffic-light
// palette — the counts are a summary, not an alarm.
const TILES = [
  { key: 'expired', label: 'Expired',     tone: 'text-[#1B4F8A]' },
  { key: 'today',   label: 'Due today',   tone: 'text-[#1B6DBD]' },
  { key: 'week',    label: 'Next 7 days', tone: 'text-[#2389E3]' },
  { key: 'month',   label: '8–30 days',   tone: 'text-[#4BA3EA]' },
  { key: 'quarter', label: '31–90 days',  tone: 'text-[#7CBEF1]' },
];

const RenewalsSummary = () => {
  const isDemo = typeof window !== 'undefined' && (window.location.pathname.startsWith('/admin/demo') || new URLSearchParams(window.location.search).has('demo'));
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isDemo) {
      const d = new Date(); const arr = [];
      for(let i=0;i<12;i++){const y=d.getFullYear();const m=String(d.getMonth()+1).padStart(2,'0');const key=`${y}-${m}`;const label=new Date(Date.UTC(y,d.getMonth(),1)).toLocaleDateString('en-GB',{month:'short',year:'numeric'});arr.push({month:key,label,count:[18,7,31,12,24,9,15,22,6,19,11,28][i%12]});d.setMonth(d.getMonth()+1);}
      setData({ counts:{expired:42,today:3,week:12,month:28,quarter:61}, states:{needs_review:2,in_progress:5}, monthlyBreakdown: arr }); return;
    }
    let cancelled = false;
    // bucket=expired so `states` describes the expired cohort — the one the
    // "needs review" warning below is about.
    listRenewals({ bucket: 'expired', limit: 1 })
      .then(d => { if (!cancelled) setData(d); })
      .catch(err => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [isDemo]);

  const counts = data?.counts;
  const states = data?.states;
  const monthlyBreakdown = data?.monthlyBreakdown || [];
  const needsReview = states?.needs_review ?? 0;
  const inProgress = states?.in_progress ?? 0;

  // Show next 12 months from today, even if count is 0 — gives a stable calendar row
  const nextMonths = (() => {
    if (monthlyBreakdown.length === 0) return [];
    const map = new Map(monthlyBreakdown.map(m => [m.month, m]));
    const out = [];
    const d = new Date();
    for (let i = 0; i < 12; i++) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const key = `${y}-${m}`;
      const found = map.get(key);
      const label = new Date(Date.UTC(y, d.getMonth(), 1)).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
      out.push(found || { month: key, label, count: 0 });
      d.setMonth(d.getMonth() + 1);
    }
    return out;
  })();

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <BellAlertIcon className="h-5 w-5 text-gray-400" />
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Renewals</h2>
            <p className="text-xs text-gray-500">Most urgent first — click any number to see who</p>
          </div>
        </div>
        <Link to={isDemo ? "/admin/demo/renewals" : "/admin/renewals"} className="text-xs font-medium text-blue-600 hover:underline">
          View call list →
        </Link>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!error && !counts && <p className="text-sm text-gray-500">Loading…</p>}

      {counts && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {TILES.map(t => (
              <Link
                key={t.key}
                to={`/admin/renewals?bucket=${t.key}`}
                className="rounded-lg border border-gray-100 p-3 transition-colors hover:bg-gray-50"
              >
                <p className="text-xs text-gray-500">{t.label}</p>
                <p className={`text-2xl font-bold ${t.tone}`}>{counts[t.key] ?? 0}</p>
              </Link>
            ))}
          </div>

          {/* Calendar-month drill-down — answers "how many in August?" */}
          {nextMonths.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-900">Due by calendar month</h3>
                <span className="text-xs text-gray-500">Click a month to filter the call list</span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                {nextMonths.map(m => (
                  <Link
                    key={m.month}
                    to={isDemo ? `/admin/demo/renewals?month=${m.month}` : `/admin/renewals?month=${m.month}`}
                    className={`rounded-lg border p-3 text-center transition-colors ${m.count > 0 ? 'border-gray-200 hover:bg-blue-50 hover:border-blue-200' : 'border-gray-100 bg-gray-50/50'}`}
                  >
                    <p className="text-xs font-medium text-gray-600">{m.label}</p>
                    <p className={`text-xl font-bold ${m.count > 0 ? 'text-gray-900' : 'text-gray-400'}`}>{m.count}</p>
                    <p className="text-[11px] text-gray-500">{m.count === 1 ? 'vehicle' : 'vehicles'}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {(needsReview > 0 || inProgress > 0) && (
            <div className="mt-4 rounded-md bg-blue-50 border border-blue-200 px-3 py-2.5">
              <div className="flex items-start gap-2">
                <ExclamationTriangleIcon className="h-4 w-4 text-[#2389E3] shrink-0 mt-0.5" />
                <div className="text-xs text-[#12406F]">
                  {needsReview > 0 && (
                    <p>
                      <strong>{needsReview}</strong> expired {needsReview === 1 ? 'vehicle has' : 'vehicles have'} a
                      cancelled order despite a successful payment — a billing issue to resolve, not a sales call.
                    </p>
                  )}
                  {inProgress > 0 && (
                    <p className={needsReview > 0 ? 'mt-1' : ''}>
                      <strong>{inProgress}</strong> {inProgress === 1 ? 'has' : 'have'} a renewal already in
                      progress. Excluded from chasing.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default RenewalsSummary;
