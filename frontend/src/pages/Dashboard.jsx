import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

const COLORS = ['#22c55e', '#f59e0b', '#ef4444', '#6366f1', '#06b6d4'];

function KPICard({ title, value, subtitle, color = 'primary' }) {
  const colorMap = {
    primary: 'border-l-primary-500',
    green: 'border-l-green-500',
    red: 'border-l-red-500',
    blue: 'border-l-blue-500',
  };
  return (
    <div className={`card border-l-4 ${colorMap[color] || colorMap.primary}`}>
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  );
}

function OwnerDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const { data: d } = await api.get('/dashboard/owner');
      setData(d);
    } catch (err) {
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingState />;
  if (!data) return <p className="text-gray-500">No data available</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Owner Dashboard</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Monthly Spend" value={`£${data.kpis?.monthly_spend?.toLocaleString() || 0}`} color="primary" />
        <KPICard title="Pending Invoices" value={data.kpis?.pending_invoices || 0} color="blue" />
        <KPICard title="Low Stock Items" value={data.kpis?.low_stock_items || 0} color="red" />
        <KPICard title="Gross Margin" value={`${data.kpis?.gross_margin || 0}%`} color="green" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Suppliers Bar Chart */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Top Suppliers</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.top_suppliers || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="total" fill="#d97706" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Stock Health Pie Chart */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Stock Health</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={data.stock_health || []}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="value"
                nameKey="status"
                label={({ status, value }) => `${status}: ${value}`}
              >
                {(data.stock_health || []).map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* AI Insights */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">AI Insights</h3>
        {data.ai_insights?.length > 0 ? (
          <ul className="space-y-3">
            {data.ai_insights.map((insight, i) => (
              <li key={i} className="flex items-start gap-3 p-3 bg-primary-50 rounded-lg">
                <span className="text-lg">💡</span>
                <div>
                  <p className="text-sm font-medium text-gray-900">{insight.title}</p>
                  <p className="text-xs text-gray-600 mt-1">{insight.description}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">No insights available</p>
        )}
      </div>

      {/* Suspicious Alerts */}
      {data.suspicious_alerts?.length > 0 && (
        <div className="card border border-red-200">
          <h3 className="text-lg font-semibold text-red-700 mb-4">⚠️ Suspicious Activity</h3>
          <ul className="space-y-2">
            {data.suspicious_alerts.map((alert, i) => (
              <li key={i} className="flex items-center gap-3 p-3 bg-red-50 rounded-lg">
                <span className="text-red-500 text-sm font-medium">{alert.type}</span>
                <span className="text-sm text-gray-700">{alert.message}</span>
                <span className="text-xs text-gray-400 ml-auto">{alert.date}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
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

  const ragColor = (status) => {
    if (status === 'green') return 'bg-green-100 text-green-800';
    if (status === 'amber') return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>

      {/* Stock Status RAG */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Stock Status</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(data.stock_status || []).map((item, i) => (
            <div key={i} className={`p-3 rounded-lg ${ragColor(item.rag)}`}>
              <p className="font-medium text-sm">{item.name}</p>
              <p className="text-xs mt-1">Qty: {item.quantity} {item.unit}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Reorder Checklist */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Reorder Checklist</h3>
        {(data.reorder_items || []).length > 0 ? (
          <ul className="space-y-2">
            {data.reorder_items.map((item, i) => (
              <li key={i} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded">
                <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-primary-600" />
                <span className="text-sm text-gray-800 flex-1">{item.name}</span>
                <span className="text-xs text-gray-500">Need: {item.needed} {item.unit}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">All stock levels OK</p>
        )}
      </div>

      {/* Pending Invoices */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Pending Invoices</h3>
        {(data.pending_invoices || []).length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 text-gray-500 font-medium">Supplier</th>
                  <th className="text-left py-2 text-gray-500 font-medium">Date</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Amount</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.pending_invoices.map((inv, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-2 text-gray-900">{inv.supplier}</td>
                    <td className="py-2 text-gray-600">{inv.date}</td>
                    <td className="py-2 text-right text-gray-900">£{inv.amount?.toFixed(2)}</td>
                    <td className="py-2 text-right">
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-500">No pending invoices</p>
        )}
      </div>

      {/* Recent Movements */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Recent Stock Movements</h3>
        {(data.recent_movements || []).length > 0 ? (
          <ul className="space-y-2">
            {data.recent_movements.map((mov, i) => (
              <li key={i} className="flex items-center gap-3 p-2 text-sm">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  mov.type === 'in' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {mov.type === 'in' ? 'IN' : 'OUT'}
                </span>
                <span className="text-gray-800 flex-1">{mov.item}</span>
                <span className="text-gray-500">{mov.quantity} {mov.unit}</span>
                <span className="text-gray-400 text-xs">{mov.date}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">No recent movements</p>
        )}
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
