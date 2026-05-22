import { useState, useEffect } from 'react';
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
  const [analyzing, setAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState(null);
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

  const onDrop = async (acceptedFiles) => {
    if (acceptedFiles.length === 0) return;
    const file = acceptedFiles[0];
    const filename = (file.name || '').toLowerCase();
    const isStructured = filename.endsWith('.csv') || filename.endsWith('.xlsx') || filename.endsWith('.xls');

    const formData = new FormData();
    formData.append('file', file);

    if (isStructured) {
      // Structured CSV/Excel → parse into transactions
      setUploading(true);
      try {
        const { data: result } = await api.post('/sales/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        const msg = `Imported ${result?.new_records || 0} records` +
          (result?.suspicious_detected > 0 ? `, ${result.suspicious_detected} suspicious` : '');
        toast.success(msg);
        // Refresh data
        const [txnRes, susRes, sumRes] = await Promise.all([
          api.get('/sales/transactions?page_size=50').catch(() => ({ data: [] })),
          api.get('/sales/suspicious?is_resolved=false&limit=20').catch(() => ({ data: [] })),
          api.get('/sales/summary').catch(() => ({ data: null })),
        ]);
        setTransactions(safeArray(txnRes.data));
        setSuspicious(safeArray(susRes.data));
        setSummary(safeObject(sumRes.data, null));
      } catch (err) {
        toast.error(err.response?.data?.detail || 'Upload failed');
      } finally {
        setUploading(false);
      }
    } else {
      // PDF/Image/Other → AI analysis with Claude
      setAnalyzing(true);
      setAiResult(null);
      try {
        const { data: result } = await api.post('/sales/analyze', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        setAiResult(result);
        toast.success('AI analysis complete');
        setActiveTab('ai-analysis');
      } catch (err) {
        toast.error(err.response?.data?.detail || 'AI analysis failed');
      } finally {
        setAnalyzing(false);
      }
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': [], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [],
      'application/vnd.ms-excel': [], 'application/pdf': [],
      'image/jpeg': [], 'image/png': [], 'image/jpg': [],
    },
    multiple: false,
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
  const aiItems = safeArray(aiResult?.items);
  const aiInsights = safeArray(aiResult?.insights);
  const aiAnomalies = safeArray(aiResult?.anomalies);
  const aiSummary = safeObject(aiResult?.summary, {});

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Sales Intelligence</h1>

      {/* Upload Zone — accepts ALL file types */}
      <div
        {...getRootProps()}
        className={`card border-2 border-dashed cursor-pointer transition-colors ${
          isDragActive ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-primary-400'
        }`}
      >
        <input {...getInputProps()} />
        <div className="text-center py-5">
          {(uploading || analyzing) ? (
            <div className="flex items-center justify-center gap-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
              <span className="text-sm text-gray-600">
                {analyzing ? 'Claude AI analyzing your file...' : 'Parsing sales data...'}
              </span>
            </div>
          ) : (
            <>
              <p className="text-lg font-medium text-gray-700">
                {isDragActive ? 'Drop file here...' : 'Upload Sales Data (Any Format)'}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                CSV/Excel → auto-parsed into transactions | PDF/Image → Claude AI interprets
              </p>
              <p className="text-xs text-gray-400 mt-1">Supports: CSV, XLSX, PDF, JPG, PNG</p>
            </>
          )}
        </div>
      </div>

      {/* Summary Cards (from DB) */}
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
        {aiResult && (
          <button onClick={() => setActiveTab('ai-analysis')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'ai-analysis' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500'}`}>
            AI Analysis
          </button>
        )}
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

      {/* AI Analysis Tab */}
      {activeTab === 'ai-analysis' && aiResult && (
        <div className="space-y-6">
          {/* AI Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card text-center border-l-4 border-l-purple-500">
              <p className="text-xs text-gray-500">AI: Total Sales</p>
              <p className="text-lg font-bold text-purple-700">RM {(aiSummary.total_sales || 0).toLocaleString()}</p>
            </div>
            <div className="card text-center border-l-4 border-l-purple-500">
              <p className="text-xs text-gray-500">AI: Transactions</p>
              <p className="text-lg font-bold text-purple-700">{aiSummary.total_transactions || 0}</p>
            </div>
            <div className="card text-center border-l-4 border-l-purple-500">
              <p className="text-xs text-gray-500">AI: Avg Value</p>
              <p className="text-lg font-bold text-purple-700">RM {(aiSummary.avg_transaction_value || 0).toFixed(0)}</p>
            </div>
            <div className="card text-center border-l-4 border-l-purple-500">
              <p className="text-xs text-gray-500">Date Range</p>
              <p className="text-sm font-bold text-purple-700">{aiSummary.date_range || 'N/A'}</p>
            </div>
          </div>

          {/* AI Insights */}
          {aiInsights.length > 0 && (
            <div className="card">
              <h3 className="text-lg font-semibold mb-3">AI Insights</h3>
              <ul className="space-y-2">
                {aiInsights.map((insight, i) => (
                  <li key={i} className="flex items-start gap-2 p-2 bg-purple-50 rounded-lg">
                    <span className="text-purple-500 mt-0.5">•</span>
                    <span className="text-sm text-gray-800">{insight}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* AI Anomalies */}
          {aiAnomalies.length > 0 && (
            <div className="card border border-red-200">
              <h3 className="text-lg font-semibold text-red-700 mb-3">Anomalies Detected</h3>
              <ul className="space-y-2">
                {aiAnomalies.map((anomaly, i) => (
                  <li key={i} className="flex items-start gap-2 p-2 bg-red-50 rounded-lg">
                    <span className="text-red-500 mt-0.5">!</span>
                    <span className="text-sm text-red-800">{anomaly}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* AI Extracted Items Table */}
          {aiItems.length > 0 && (
            <div className="card overflow-hidden p-0">
              <div className="px-6 py-4 border-b bg-gray-50">
                <h3 className="font-semibold">Extracted Items ({aiItems.length})</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-2 text-gray-500 font-medium">Item</th>
                      <th className="text-right px-4 py-2 text-gray-500 font-medium">Qty</th>
                      <th className="text-right px-4 py-2 text-gray-500 font-medium">Total (RM)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {aiItems.map((item, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium text-gray-900">{item.name || item.item_name || '-'}</td>
                        <td className="px-4 py-2 text-right text-gray-600">{item.quantity || '-'}</td>
                        <td className="px-4 py-2 text-right font-medium">RM {(item.total || item.total_price || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Raw AI response text */}
          {aiResult.raw_text && (
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-500 mb-2">AI Summary</h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{aiResult.raw_text}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
