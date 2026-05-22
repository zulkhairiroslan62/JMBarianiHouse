import { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';

const REPORT_TYPES = [
  { value: 'cost_analysis', label: 'Cost Analysis' },
  { value: 'inventory_valuation', label: 'Inventory Valuation' },
  { value: 'supplier_spending', label: 'Supplier Spending' },
  { value: 'sales_summary', label: 'Sales Summary' },
  { value: 'profit_loss', label: 'Profit & Loss' },
  { value: 'stock_movement', label: 'Stock Movement' },
];

const FORMAT_OPTIONS = [
  { value: 'pdf', label: 'PDF' },
  { value: 'csv', label: 'CSV' },
  { value: 'excel', label: 'Excel' },
];

export default function Reports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [formData, setFormData] = useState({
    type: 'cost_analysis',
    start_date: '',
    end_date: '',
    format: 'pdf',
  });

  useEffect(() => {
    fetchReports();
  }, []);


  const fetchReports = async () => {
    try {
      const { data } = await api.get('/reports');
      setReports(data.items || data);
    } catch (err) {
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!formData.start_date || !formData.end_date) {
      toast.error('Please select date range');
      return;
    }
    setGenerating(true);
    try {
      await api.post('/reports/generate', formData);
      toast.success('Report generation started');
      fetchReports();
    } catch (err) {
      toast.error('Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (report) => {
    try {
      const response = await api.get(`/reports/${report.id}/download`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', report.filename || `report.${report.format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error('Download failed');
    }
  };

  const statusBadge = (status) => {
    const map = {
      ready: 'bg-green-100 text-green-800',
      generating: 'bg-blue-100 text-blue-800',
      failed: 'bg-red-100 text-red-800',
    };
    return map[status] || 'bg-gray-100 text-gray-800';
  };


  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Reports</h1>

      {/* Generate Form */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Generate Report</h3>
        <form onSubmit={handleGenerate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Report Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData((f) => ({ ...f, type: e.target.value }))}
                className="input-field"
              >
                {REPORT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData((f) => ({ ...f, start_date: e.target.value }))}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData((f) => ({ ...f, end_date: e.target.value }))}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Format</label>
              <select
                value={formData.format}
                onChange={(e) => setFormData((f) => ({ ...f, format: e.target.value }))}
                className="input-field"
              >
                {FORMAT_OPTIONS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
          </div>
          <button type="submit" disabled={generating} className="btn-primary disabled:opacity-50">
            {generating ? 'Generating...' : 'Generate Report'}
          </button>
        </form>
      </div>


      {/* Report History */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Report History</h3>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : reports.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No reports generated yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-6 py-3 text-gray-500 font-medium">Type</th>
                  <th className="text-left px-6 py-3 text-gray-500 font-medium">Date Range</th>
                  <th className="text-left px-6 py-3 text-gray-500 font-medium">Format</th>
                  <th className="text-center px-6 py-3 text-gray-500 font-medium">Status</th>
                  <th className="text-left px-6 py-3 text-gray-500 font-medium">Generated</th>
                  <th className="text-right px-6 py-3 text-gray-500 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {reports.map((report) => (
                  <tr key={report.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-gray-900 font-medium capitalize">
                      {report.type?.replace(/_/g, ' ')}
                    </td>
                    <td className="px-6 py-3 text-gray-600">
                      {report.start_date} — {report.end_date}
                    </td>
                    <td className="px-6 py-3 text-gray-600 uppercase text-xs font-medium">
                      {report.format}
                    </td>
                    <td className="px-6 py-3 text-center">
                      <span className={`px-2 py-1 text-xs rounded-full font-medium capitalize ${statusBadge(report.status)}`}>
                        {report.status}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-gray-500 text-xs">{report.created_at}</td>
                    <td className="px-6 py-3 text-right">
                      {report.status === 'ready' && (
                        <button
                          onClick={() => handleDownload(report)}
                          className="text-primary-600 hover:text-primary-800 text-sm font-medium"
                        >
                          Download
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
