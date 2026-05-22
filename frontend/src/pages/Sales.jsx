import { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import api, { safeArray, safeObject } from '../utils/api';
import toast from 'react-hot-toast';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

export default function Sales() {
  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [suspicious, setSuspicious] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('transactions');

  useEffect(() => { fetchSales(); }, []);

  const fetchSales = async () => {
    try {
      const [txnRes, susRes, sumRes] = await Promise.all([
        api.get('/sales/transactions?page_size=50').catch(() => ({ data: [] })),
        api.get('/sales/suspicious?is_resolved=false&limit=20').catch(() => ({ data: [] })),
        api.get('/sales/summary').catch(() => ({ data: null })),
      ]);
      setTransactions(safeArray(txnRes.data));
      setSuspicious(safeArray(susRes.data));
      setSummary(safeObject(sumRes.data, null));
    } catch (err) {
      toast.error('Failed to load sales data');
    } finally {
      setLoading(false);
    }
  };

  const onDrop = useCallback(async (acceptedFiles) => {
    if (acceptedFiles.length === 0) return;
    setUploading(true);
    try {
      for (const file of acceptedFiles) {
        const formData = new FormData();
        formData.append('file', file);
        await api.post('/sales/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
      toast.success('Sales data uploaded');
      fetchSales();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, []);


  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': [], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [], 'application/vnd.ms-excel': [] },
    multiple: true,
  });

  const handleResolve = async (id) => {
    try {
      await api.put(`/sales/suspicious/${id}/resolve?resolution_notes=Reviewed`);
      toast.success('Marked as resolved');
      setSuspicious((prev) => Array.isArray(prev) ? prev.filter((s) => s.id !== id) : []);
    } catch (err) {
      toast.error('Failed to resolve');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const topItems = safeArray(summary?.top_items);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Sales Integration (AcePOS)</h1>

      {/* Upload Zone */}
      <div
        {...getRootProps()}
        className={`card border-2 border-dashed cursor-pointer transition-colors ${
          isDragActive ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-primary-400'
        }`}
      >
        <input {...getInputProps()} />
        <div className="text-center py-4">
          {uploading ? (
            <div className="flex items-center justify-center gap-2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600"></div>
              <span className="text-sm text-gray-600">Processing sales data...</span>
            </div>
          ) : (
            <>
              <p className="text-sm font-medium text-gray-700">
                {isDragActive ? 'Drop sales files here...' : 'Upload AcePOS Export (CSV/Excel)'}
              </p>
              <p className="text-xs text-gray-400 mt-1">CSV, XLS, XLSX supported</p>
            </>
          )}
        </div>
      </div>


      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card text-center">
            <p className="text-xs text-gray-500">Total Sales</p>
            <p className="text-lg font-bold text-green-600">RM {(summary.total_sales || 0).toLocaleString()}</p>
          </div>
          <div className="card text-center">
            <p className="text-xs text-gray-500">Transactions</p>
            <p className="text-lg font-bold">{summary.total_transactions || 0}</p>
          </div>
          <div className="card text-center">
            <p className="text-xs text-gray-500">Avg Value</p>
            <p className="text-lg font-bold">RM {(summary.avg_transaction_value || 0).toFixed(0)}</p>
          </div>
          <div className="card text-center">
            <p className="text-xs text-gray-500">Voids/Refunds</p>
            <p className="text-lg font-bold text-red-600">{(summary.void_count || 0) + (summary.refund_count || 0)}</p>
          </div>
        </div>
      )}

      {/* Top Items Chart */}
      {topItems.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Top Selling Items</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={topItems.slice(0, 8)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-15} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => [`RM ${v}`, 'Sales']} />
              <Bar dataKey="total" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        <button onClick={() => setActiveTab('transactions')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'transactions' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500'}`}>
          Transactions ({transactions.length})
        </button>
        <button onClick={() => setActiveTab('suspicious')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'suspicious' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500'}`}>
          Suspicious ({suspicious.length})
        </button>
      </div>


      {/* Transactions Table */}
      {activeTab === 'transactions' && (
        <div className="card overflow-hidden p-0">
          {transactions.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No transactions yet. Upload sales data above.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Date</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Item</th>
                    <th className="text-right px-4 py-3 text-gray-500 font-medium">Qty</th>
                    <th className="text-right px-4 py-3 text-gray-500 font-medium">Total</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Payment</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Cashier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {transactions.map((t, i) => (
                    <tr key={t.id || i} className={`hover:bg-gray-50 ${t.is_void ? 'bg-red-50' : ''}`}>
                      <td className="px-4 py-2 text-xs text-gray-600">{t.transaction_date ? new Date(t.transaction_date).toLocaleString('ms-MY') : '-'}</td>
                      <td className="px-4 py-2 text-gray-900">{t.item_name || '-'}</td>
                      <td className="px-4 py-2 text-right">{t.quantity || 0}</td>
                      <td className="px-4 py-2 text-right font-medium">RM {(t.total_price || 0).toFixed(2)}</td>
                      <td className="px-4 py-2 capitalize">{t.payment_method || '-'}</td>
                      <td className="px-4 py-2">{t.cashier_name || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Suspicious Tab */}
      {activeTab === 'suspicious' && (
        <div className="space-y-3">
          {suspicious.length === 0 ? (
            <div className="card text-center py-10">
              <p className="text-green-600">No suspicious transactions detected</p>
            </div>
          ) : (
            suspicious.map((s) => (
              <div key={s.id} className="card flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-bold ${
                    s.severity === 'high' ? 'bg-red-200 text-red-800' :
                    s.severity === 'medium' ? 'bg-orange-200 text-orange-800' :
                    'bg-yellow-200 text-yellow-800'
                  }`}>{s.severity}</span>
                  <div>
                    <p className="font-medium text-sm">{s.reason}</p>
                    <p className="text-xs text-gray-500">{s.details}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {s.cashier_name && `Cashier: ${s.cashier_name}`}
                      {s.amount != null && ` | RM ${s.amount}`}
                    </p>
                  </div>
                </div>
                <button onClick={() => handleResolve(s.id)} className="text-xs btn-secondary whitespace-nowrap">Resolve</button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
