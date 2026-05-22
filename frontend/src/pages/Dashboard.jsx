import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

function KPICard({ label, value, unit, change_percent, trend }) {
  const displayValue = unit === 'RM' ? `RM ${(value || 0).toLocaleString()}` : `${value || 0}${unit || ''}`;
  return (
    <div className="card border-l-4 border-l-primary-500">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{displayValue}</p>
      {change_percent != null && (
        <p className={`text-xs mt-1 ${trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-500'}`}>
          {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {Math.abs(change_percent)}% vs previous
        </p>
      )}
    </div>
  );
}

function OwnerDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('weekly');

  useEffect(() => {
    fetchDashboard();
  }, [period]);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const { data: d } = await api.get(`/dashboard/owner?period=${period}`);
      setData(d);
    } catch (err) {
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const refreshInsights = async () => {
    try {
      const { data: insights } = await api.get('/dashboard/insights?refresh=true');
      setData(prev => prev ? { ...prev, ai_insights: insights } : prev);
      toast.success('Insights refreshed');
    } catch (err) {
      toast.error('Failed to refresh insights');
    }
  };

  if (loading) return <LoadingState />;
  if (!data) return <p className="text-gray-500">No data available</p>;

  // stock_health is an object: {total, healthy, low_stock, out_of_stock}
  const stockHealth = (data.stock_health && typeof data.stock_health === 'object' && !Array.isArray(data.stock_health))
    ? data.stock_health
    : { total: 0, healthy: 0, low_stock: 0, out_of_stock: 0 };

  // KPI cards from backend
  const kpiCards = Array.isArray(data.kpi_cards) ? data.kpi_cards : [];

  // Top suppliers - backend uses "spend" key
  const topSuppliers = Array.isArray(data.top_suppliers) ? data.top_suppliers : [];

  // AI insights - can be empty []
  const aiInsights = Array.isArray(data.ai_insights) ? data.ai_insights : [];

  // Suspicious alerts - can be empty []
  const suspiciousAlerts = Array.isArray(data.suspicious_alerts) ? data.suspicious_alerts : [];

  // opex_vs_sales - can be empty []
  const opexVsSales = Array.isArray(data.opex_vs_sales) ? data.opex_vs_sales : [];

  return (
    <div className="space-y-6">
      {/* Header with period toggle */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Owner Dashboard</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setPeriod('weekly')}
            className={`px-3 py-1.5 text-xs font-medium rounded-full ${period === 'weekly' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            Weekly
          </button>
          <button
            onClick={() => setPeriod('monthly')}
            className={`px-3 py-1.5 text-xs font-medium rounded-full ${period === 'monthly' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            Monthly
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi, idx) => (
          <KPICard key={idx} {...kpi} />
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Suppliers Bar Chart */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Top Suppliers by Spend</h3>
          {topSuppliers.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={topSuppliers}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-15} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [`RM ${v}`, 'Spend']} />
                <Bar dataKey="spend" fill="#d97706" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">No supplier data yet</p>
          )}
        </div>

        {/* Stock Health - Stat Cards (object, not array) */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Stock Health</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 bg-gray-50 rounded-lg text-center">
              <p className="text-2xl font-bold text-gray-900">{stockHealth.total || 0}</p>
              <p className="text-xs text-gray-500 mt-1">Total Items</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg text-center">
              <p className="text-2xl font-bold text-green-600">{stockHealth.healthy || 0}</p>
              <p className="text-xs text-green-700 mt-1">Healthy</p>
            </div>
            <div className="p-4 bg-yellow-50 rounded-lg text-center">
              <p className="text-2xl font-bold text-yellow-600">{stockHealth.low_stock || 0}</p>
              <p className="text-xs text-yellow-700 mt-1">Low Stock</p>
            </div>
            <div className="p-4 bg-red-50 rounded-lg text-center">
              <p className="text-2xl font-bold text-red-600">{stockHealth.out_of_stock || 0}</p>
              <p className="text-xs text-red-700 mt-1">Out of Stock</p>
            </div>
          </div>
        </div>
      </div>

      {/* AI Insights & Suspicious */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* AI Insights */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">AI Insights</h3>
            <button onClick={refreshInsights} className="btn-secondary text-xs">
              Refresh
            </button>
          </div>
          {aiInsights.length > 0 ? (
            <ul className="space-y-3">
              {aiInsights.map((insight, i) => (
                <li key={insight.id || i} className="flex items-start gap-3 p-3 bg-primary-50 rounded-lg">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    insight.severity === 'critical' ? 'bg-red-100 text-red-700' :
                    insight.severity === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {insight.severity || 'info'}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{insight.content_bm || insight.title}</p>
                    <p className="text-xs text-gray-500 mt-1">{insight.content_en}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">No insights available. Click Refresh to generate.</p>
          )}
        </div>

        {/* Suspicious Alerts */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Suspicious Transactions</h3>
          {suspiciousAlerts.length > 0 ? (
            <ul className="space-y-3">
              {suspiciousAlerts.map((alert) => (
                <li key={alert.id} className="flex items-start gap-3 p-3 bg-red-50 rounded-lg">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                    alert.severity === 'high' ? 'bg-red-200 text-red-800' :
                    alert.severity === 'medium' ? 'bg-orange-200 text-orange-800' :
                    'bg-yellow-200 text-yellow-800'
                  }`}>
                    {alert.severity}
                  </span>
                  <div>
                    <p className="text-sm text-gray-800">{alert.reason}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {alert.cashier && `Cashier: ${alert.cashier}`}
                      {alert.amount != null && ` • RM ${alert.amount}`}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-green-600">No suspicious transactions detected</p>
          )}
        </div>
      </div>
    </div>
  );
}

function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const { data: d } = await api.get('/dashboard/admin');
      setData(d);
    } catch (err) {
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingState />;
  if (!data) return <p className="text-gray-500">No data available</p>;

  // Safely extract arrays with fallbacks
  const stockStatus = Array.isArray(data.stock_status) ? data.stock_status : [];
  const reorderChecklist = Array.isArray(data.reorder_checklist) ? data.reorder_checklist : [];
  const pendingInvoices = Array.isArray(data.pending_invoices) ? data.pending_invoices : [];
  const recentMovements = Array.isArray(data.recent_movements) ? data.recent_movements : [];
  const todaySummary = data.today_summary && typeof data.today_summary === 'object' ? data.today_summary : {};

  const ragColor = (color) => {
    if (color === 'green') return 'bg-green-100 text-green-800';
    if (color === 'yellow') return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>

      {/* Today Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card text-center">
          <p className="text-sm text-gray-500">Sales Today</p>
          <p className="text-xl font-bold text-green-600">RM {(todaySummary.sales || 0).toLocaleString()}</p>
        </div>
        <div className="card text-center">
          <p className="text-sm text-gray-500">Transactions</p>
          <p className="text-xl font-bold">{todaySummary.transactions || 0}</p>
        </div>
        <div className="card text-center">
          <p className="text-sm text-gray-500">Pending Invoices</p>
          <p className="text-xl font-bold text-orange-600">{todaySummary.pending_invoices || 0}</p>
        </div>
        <div className="card text-center">
          <p className="text-sm text-gray-500">Low Stock Items</p>
          <p className="text-xl font-bold text-red-600">{todaySummary.low_stock_items || 0}</p>
        </div>
      </div>

      {/* Stock Status & Reorder */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stock Status RAG */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Stock Status</h3>
          {stockStatus.length > 0 ? (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {stockStatus.map((item) => (
                <div key={item.id} className={`flex items-center justify-between p-3 rounded-lg ${ragColor(item.color)}`}>
                  <div>
                    <p className="font-medium text-sm">{item.name}</p>
                    <p className="text-xs mt-0.5 opacity-75">{item.category}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{item.stock} {item.unit}</p>
                    <p className="text-xs opacity-75">{item.days_left}d left</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No inventory items</p>
          )}
        </div>

        {/* Reorder Checklist */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Reorder Checklist</h3>
          {reorderChecklist.length > 0 ? (
            <ul className="space-y-2">
              {reorderChecklist.map((item) => (
                <li key={item.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                  <span className="text-sm font-medium">{item.name}</span>
                  <span className="text-xs text-red-600">
                    {item.stock} {item.unit} (min: {item.reorder_level})
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-green-600">All stock levels OK</p>
          )}
        </div>
      </div>

      {/* Pending Invoices & Recent Movements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Invoices */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Pending Invoices</h3>
          {pendingInvoices.length > 0 ? (
            <div className="space-y-2">
              {pendingInvoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium">{inv.supplier || inv.filename || `Invoice #${inv.id}`}</p>
                    <p className="text-xs text-gray-500">{inv.status}</p>
                  </div>
                  {inv.amount != null && (
                    <span className="text-sm font-bold">RM {inv.amount.toFixed(2)}</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-green-600">No pending invoices</p>
          )}
        </div>

        {/* Recent Movements */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Recent Stock Movements</h3>
          {recentMovements.length > 0 ? (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {recentMovements.map((m) => (
                <div key={m.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                      m.type === 'stock_in' ? 'bg-green-100 text-green-700' :
                      m.type === 'waste' ? 'bg-red-100 text-red-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {m.type}
                    </span>
                    <span className="text-sm text-gray-700">{m.notes || `Item #${m.item_id}`}</span>
                  </div>
                  <span className="text-sm font-medium">
                    {m.quantity > 0 ? '+' : ''}{m.quantity}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No recent movements</p>
          )}
        </div>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  return user?.role === 'owner' ? <OwnerDashboard /> : <AdminDashboard />;
}
