import React, { useState, useEffect } from 'react';
import {
  ClipboardDocumentListIcon,
  UserGroupIcon,
  TruckIcon,
  CreditCardIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  DocumentTextIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';
import config from '../../config/config';
import GatewayHealthPanel from '../../components/admin/GatewayHealthPanel';
import RenewalsSummary from '../../components/admin/RenewalsSummary';

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [allOrders, setAllOrders] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [chartPeriod, setChartPeriod] = useState('monthly');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    const token = localStorage.getItem('adminToken');
    const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

    const safeJson = async (res) => {
      try { return await res.json(); } catch { return null; }
    };

    const [statsResult, ordersResult, txResult, allOrdersResult] = await Promise.allSettled([
      fetch(`${config.getApiBaseUrl()}/admin/dashboard/stats`, { headers }).then(safeJson),
      fetch(`${config.getApiBaseUrl()}/admin/recent-orders`, { headers }).then(safeJson),
      fetch(`${config.getApiBaseUrl()}/admin/recent-transactions`, { headers }).then(safeJson),
      fetch(`${config.getApiBaseUrl()}/admin/orders?page=1&per_page=200`, { headers }).then(safeJson),
    ]);

    const statsData     = statsResult.status     === 'fulfilled' ? statsResult.value     : null;
    const ordersData    = ordersResult.status     === 'fulfilled' ? ordersResult.value    : null;
    const txData        = txResult.status         === 'fulfilled' ? txResult.value        : null;
    const allOrdersData = allOrdersResult.status  === 'fulfilled' ? allOrdersResult.value : null;

    if (statsData?.status)  setStats(statsData.data);
    if (ordersData?.status) setRecentOrders(ordersData.data);
    if (txData?.status)     setRecentTransactions(txData.data);

    const orders = allOrdersData?.status
      ? (allOrdersData.data?.data || allOrdersData.data || [])
      : (ordersData?.data || []);
    setAllOrders(orders);

    const allFailed = [statsResult, ordersResult, txResult, allOrdersResult]
      .every(r => r.status === 'rejected' || !r.value);
    if (allFailed) toast.error('Failed to fetch dashboard data');

    setLoading(false);
  };

  const buildChartFromOrders = (orders, period) => {
    if (!orders || orders.length === 0) return [];

    // Exclude declined/cancelled orders
    const valid = orders.filter(
      (o) => !['declined', 'cancelled'].includes(o.status?.toLowerCase())
    );

    const buckets = {};
    valid.forEach((order) => {
      const date = new Date(order.created_at);
      if (isNaN(date)) return;
      let key;
      if (period === 'daily') {
        key = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
      } else {
        key = date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
      }
      if (!buckets[key]) buckets[key] = { label: key, amount: 0, orders: 0, _date: date };
      buckets[key].amount += parseFloat(order.amount || 0);
      buckets[key].orders += 1;
    });

    return Object.values(buckets)
      .sort((a, b) => a._date - b._date)
      .map(({ label, amount, orders }) => ({ label, amount, orders }));
  };

  // Re-bucket whenever orders data or period changes — no extra fetch needed
  useEffect(() => {
    const source = allOrders.length > 0 ? allOrders : recentOrders;
    const built = buildChartFromOrders(source, chartPeriod);
    if (built.length > 0) setChartData(built);
  }, [chartPeriod, allOrders, recentOrders]);

  // Helper function to format order status. Accepts canonical DB values
  // (pending|processing|completed|cancelled) and legacy aliases for
  // transitional safety.
  const formatOrderStatus = (status) => {
    switch (status) {
      case 'pending':
        return 'New';
      case 'processing':
      case 'in_progress':
        return 'In Progress';
      case 'completed':
        return 'Done';
      case 'cancelled':
      case 'declined':
        return 'Cancelled';
      default:
        return status;
    }
  };

  // Build a human-readable purpose label from order_type + plate/license specifics
  // Mirrors AdminOrders.jsx:getPurpose so dashboard rows show real service names.
  const getPurpose = (order) => {
    const type = order.order_type || order.payment_type || '';
    if (type === 'plate_number') {
      const parts = ['Plate Number'];
      if (order.plate_type) parts.push(order.plate_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()));
      if (order.plate_sub_type) parts.push(`(${order.plate_sub_type.replace(/_/g, ' ')})`);
      return parts.join(' — ');
    }
    if (type === 'driver_license') {
      const parts = ["Driver's License"];
      if (order.license_type) parts.push(order.license_type.charAt(0).toUpperCase() + order.license_type.slice(1));
      if (order.license_duration) parts.push(`(${order.license_duration})`);
      return parts.join(' — ');
    }
    if (type === 'car_renewal' || type === 'renewal_manual' || type === 'renewal_auto') return 'Vehicle Licence Renewal';
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'General Service';
  };

  // Transaction purpose — uses payment_description when available
  const getTxPurpose = (tx) => {
    if (tx.payment_description) return tx.payment_description.replace(/\b\w/g, l => l.toUpperCase());
    return getPurpose(tx);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'New':
        return 'text-blue-600';
      case 'Done':
        return 'text-blue-600';
      case 'Declined':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  // New-badge seen tracking — backend `is_new` (viewed_at IS NULL) is source of truth;
  // localStorage is optimistic fallback for the current session.
  const [seenOrderNumbers, setSeenOrderNumbers] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('seenOrders') || '[]')); } catch { return new Set(); }
  });
  const isOrderNew = (order) => {
    if (order.is_new === false) return false;
    if (order.is_new === true) return !seenOrderNumbers.has(order.order_number || order.slug);
    // fallback for old API shape without is_new
    return order.status === 'pending' && !seenOrderNumbers.has(order.order_number || order.slug);
  };
  const markSeenLocal = (order) => {
    const key = order.order_number || order.slug;
    if (!key || seenOrderNumbers.has(key)) return;
    const next = new Set(seenOrderNumbers); next.add(key);
    setSeenOrderNumbers(next);
    try { localStorage.setItem('seenOrders', JSON.stringify([...next])); } catch {}
    // fire-and-forget API so badge stays cleared across devices
    const token = localStorage.getItem('adminToken');
    fetch(`${config.getApiBaseUrl()}/admin/orders/${key}/viewed`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    }).catch(() => {});
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-center">
        <DocumentTextIcon className="h-6 w-6 text-gray-600 mr-2" />
        <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Amount */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold text-blue-600">
                ₦{stats ? parseFloat(stats.total_amount).toLocaleString() : '0'}
              </p>
            </div>
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <CreditCardIcon className="h-5 w-5 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Total Orders */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Orders</p>
              <p className="text-2xl font-bold text-blue-600">
                {stats ? stats.total_orders.toLocaleString() : '0'}
              </p>
            </div>
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <ClipboardDocumentListIcon className="h-5 w-5 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Total Users */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Users</p>
              <p className="text-2xl font-bold text-blue-600">
                {stats ? stats.total_users.toLocaleString() : '0'}
              </p>
            </div>
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <UsersIcon className="h-5 w-5 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Total Cars */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Cars</p>
              <p className="text-2xl font-bold text-blue-600">
                {stats ? stats.total_cars.toLocaleString() : '0'}
              </p>
            </div>
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <TruckIcon className="h-5 w-5 text-blue-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Order Status Metrics — actionable breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-yellow-400">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">New <span className="text-xs font-normal text-gray-400">(unseen)</span></p>
              <p className="text-2xl font-bold text-yellow-600">{stats ? (stats.new_orders ?? stats.pending_orders ?? 0).toLocaleString() : '0'}</p>
              <p className="text-xs text-gray-500 mt-1">₦{stats ? parseFloat(stats.pending_amount || 0).toLocaleString() : '0'} pending</p>
            </div>
            <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
              <span className="text-yellow-600 text-sm font-bold">!</span>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">In Progress</p>
              <p className="text-2xl font-bold text-blue-600">{stats ? (stats.processing_orders ?? 0).toLocaleString() : '0'}</p>
              <p className="text-xs text-gray-500 mt-1">{stats ? `${stats.pending_orders ?? 0} pending total` : ''}</p>
            </div>
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-600 text-sm font-bold">→</span>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-green-600">{stats ? (stats.completed_orders ?? 0).toLocaleString() : '0'}</p>
            </div>
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <span className="text-green-600 text-sm font-bold">✓</span>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Cancelled</p>
              <p className="text-2xl font-bold text-red-600">{stats ? (stats.cancelled_orders ?? 0).toLocaleString() : '0'}</p>
            </div>
            <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
              <span className="text-red-600 text-sm font-bold">✗</span>
            </div>
          </div>
        </div>
      </div>

      {/* Renewals — who is expiring and who is already paid up */}
      <RenewalsSummary />

      {/* Payment gateway health — live ops signal during payment incidents */}
      <GatewayHealthPanel />

      {/* Chart and Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Chart */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Revenue & Orders</h3>
            <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
              {[
                { value: 'daily',     label: 'Daily' },
                { value: 'monthly',   label: 'Monthly' },
                { value: 'all_time',  label: 'All Time' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setChartPeriod(opt.value)}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    chartPeriod === opt.value ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={256}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="amount"
                  orientation="left"
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`}
                />
                <YAxis
                  yAxisId="orders"
                  orientation="right"
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value, name) =>
                    name === 'Revenue' ? `₦${Number(value).toLocaleString()}` : value
                  }
                  contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
                />
                <Bar yAxisId="amount" dataKey="amount" name="Revenue" fill="#2284DB" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="orders" dataKey="orders" name="Orders" fill="#93c5fd" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
              <p className="text-sm text-gray-400">No chart data available</p>
            </div>
          )}
        </div>

        {/* Recent Orders — name + service the customer actually asked for */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Recent Orders</h3>
            <a href="/admin/orders" className="text-blue-600 text-sm font-medium">See More</a>
          </div>
          <div className="space-y-3">
            {recentOrders.length > 0 ? (
              recentOrders.slice(0, 5).map((order, index) => {
                const showNew = isOrderNew(order);
                return (
                <div 
                  key={order.slug || index} 
                  className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => { markSeenLocal(order); window.location.href = `/admin/orders/${order.slug}`; }}
                >
                  <div className="min-w-0 flex-1 pr-3">
                    <p className="text-sm font-medium text-gray-900 flex items-center gap-2">
                      <span className="truncate">{order.user?.name || 'Unknown User'}</span>
                      {showNew && <span className="inline-flex items-center rounded-full bg-yellow-100 px-1.5 py-0.5 text-[10px] font-bold text-yellow-700 shrink-0">New</span>}
                    </p>
                    <p className="text-xs text-gray-500 truncate" title={getPurpose(order)}>{getPurpose(order)}{order.car?.registration_no ? ` • ${order.car.registration_no}` : ''}</p>
                    <p className="text-xs font-medium text-gray-700">₦{parseFloat(order.amount ?? order.amount_paid ?? 0).toLocaleString()}</p>
                  </div>
                  <span className={`text-xs font-medium shrink-0 ${getStatusColor(formatOrderStatus(order.status))}`}>
                    {formatOrderStatus(order.status)}
                  </span>
                </div>
                );
              })
            ) : (
              <div className="text-center py-4">
                <p className="text-gray-500 text-sm">No recent orders</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Transactions — who paid + for what */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Recent Transactions</h3>
          <a href="/admin/payments" className="text-blue-600 text-sm font-medium">See More</a>
        </div>
        <div className="space-y-3">
          {recentTransactions.length > 0 ? (
            recentTransactions.map((transaction, index) => (
              <div
                key={transaction.gateway_reference || transaction.transaction_id || index}
                className="flex items-center space-x-3 py-2 px-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => window.location.href = '/admin/payments'}
              >
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                  <DocumentTextIcon className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {transaction.user?.name || 'Unknown User'} <span className="text-gray-400 font-normal">• {getTxPurpose(transaction)}</span>
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {new Date(transaction.created_at).toLocaleDateString('en-GB')} • {transaction.payment_gateway || 'paystack'} • <span className="font-mono text-[11px]">{(transaction.gateway_reference || transaction.transaction_id || '').slice(0, 12)}</span>
                  </p>
                </div>
                <p className="text-sm font-medium text-blue-600 shrink-0">
                  ₦{parseFloat(transaction.amount).toLocaleString()}
                </p>
              </div>
            ))
          ) : (
            <div className="text-center py-4">
              <p className="text-gray-500 text-sm">No recent transactions</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
