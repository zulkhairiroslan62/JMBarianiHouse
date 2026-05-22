import { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import api from '../utils/api';
import toast from 'react-hot-toast';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

export default function Sales() {
  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [topItems, setTopItems] = useState([]);
  const [suspicious, setSuspicious] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('transactions');

  useEffect(() => {
    fetchSales();
  }, []);

  const fetchSales = async () => {
    try {
      const { data } = await api.get('/sales');
      setSummary(data.summary || null);
      setTransactions(data.transactions || []);
      setTopItems(data.top_items || []);
      setSuspicious(data.suspicious || []);
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
      const formData = new FormData();
      acceptedFiles.forEach((file) => formData.append('files', file));
      await api.post('/sales/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Sales data uploaded');
      fetchSales();
    } catch (err) {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': [],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [],
      'application/vnd.ms-excel': [],
    },
    multiple: true,
  });

  const handleResolve = async (id) => {
    try {
      await api.put(`/sales/suspicious/${id}/resolve`);
      toast.success('Marked as resolved');
      setSuspicious((prev) => prev.filter((s) => s.id !== id));
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


  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Sales</h1>

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
              <span className="text-sm text-gray-600">Uploading...</span>
            </div>
          ) : (
            <>
              <p className="text-2xl mb-1">📊</p>
              <p className="text-sm font-medium text-gray-700">
                {isDragActive ? 'Drop sales files here...' : 'Upload CSV or Excel sales data'}
              </p>
              <p className="text-xs text-gray-400 mt-1">CSV, XLS, XLSX supported</p>
            </>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card">
            <p className="text-sm text-gray-500">Total Revenue</p>
            <p className="text-2xl font-bold text-gray-900">£{summary.total_revenue?.toLocaleString()}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500">Transactions</p>
            <p className="text-2xl font-bold text-gray-900">{summary.transaction_count}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500">Avg Order Value</p>
            <p className="text-2xl font-bold text-gray-900">£{summary.avg_order_value?.toFixed(2)}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500">Suspicious Items</p>
            <p className="text-2xl font-bold text-red-600">{suspicious.length}</p>
          </div>
        </div>
      )}


      {/* Top Items Chart */}
      {topItems.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Top Selling Items</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={topItems}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="quantity" fill="#d97706" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('transactions')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'transactions'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Transactions
        </button>
        <button
          onClick={() => setActiveTab('suspicious')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'suspicious'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Suspicious ({suspicious.length})
        </button>
      </div>


      {/* Transactions Table */}
      {activeTab === 'transactions' && (
        <div className="card overflow-hidden p-0">
          {transactions.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No transactions yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-6 py-3 text-gray-500 font-medium">Date</th>
                    <th className="text-left px-6 py-3 text-gray-500 font-medium">Item</th>
                    <th className="text-right px-6 py-3 text-gray-500 font-medium">Qty</th>
                    <th className="text-right px-6 py-3 text-gray-500 font-medium">Amount</th>
                    <th className="text-left px-6 py-3 text-gray-500 font-medium">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {transactions.map((txn, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-6 py-3 text-gray-600">{txn.date}</td>
                      <td className="px-6 py-3 text-gray-900">{txn.item_name}</td>
                      <td className="px-6 py-3 text-right text-gray-600">{txn.quantity}</td>
                      <td className="px-6 py-3 text-right text-gray-900">£{txn.amount?.toFixed(2)}</td>
                      <td className="px-6 py-3 text-gray-500">{txn.source || '-'}</td>
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
        <div className="card">
          {suspicious.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No suspicious activity detected</p>
          ) : (
            <ul className="space-y-3">
              {suspicious.map((item) => (
                <li key={item.id} className="flex items-center gap-4 p-4 bg-red-50 rounded-lg">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-800">{item.title}</p>
                    <p className="text-xs text-red-600 mt-1">{item.description}</p>
                    <p className="text-xs text-gray-500 mt-1">{item.date}</p>
                  </div>
                  <button
                    onClick={() => handleResolve(item.id)}
                    className="btn-secondary text-xs"
                  >
                    Resolve
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
