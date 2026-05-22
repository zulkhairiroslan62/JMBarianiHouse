import { useState, useEffect } from 'react';
import api, { safeArray } from '../utils/api';
import toast from 'react-hot-toast';

const REPORT_TYPES = [
  { value: 'full', label: 'Full Report' },
  { value: 'opex', label: 'OPEX' },
  { value: 'sales', label: 'Sales' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'supplier', label: 'Supplier' },
  { value: 'waste', label: 'Waste' },
];

export default function Reports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [form, setForm] = useState({
    report_type: 'full',
    date_from: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
    date_to: new Date().toISOString().split('T')[0],
    format: 'pdf',
  });

  useEffect(() => { fetchReports(); }, []);

  const fetchReports = async () => {
    try {
      const { data } = await api.get('/reports/');
      // Backend returns array directly or { items: [] }
      setReports(safeArray(data, 'items'));
    } catch (err) {
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };


  const handleGenerate = async (e) => {
    e.preventDefault();
    setGenerating(true);
    try {
      const payload = {
        ...form,
        date_from: new Date(form.date_from).toISOString(),
        date_to: new Date(form.date_to).toISOString(),
      };
      const { data } = await api.post('/reports/generate', payload);
      toast.success('Report generated!');
      setReports(prev => [data, ...prev]);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const downloadReport = (id) => {
    const token = localStorage.getItem('token');
    const baseUrl = import.meta.env.VITE_API_URL || '';
    window.open(`${baseUrl}/api/reports/${id}/download`, '_blank');
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Report Generation</h1>

      {/* Generate Form */}
      <form onSubmit={handleGenerate} className="card space-y-4">
        <h3 className="font-semibold">Generate New Report</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Report Type</label>
            <select className="input-field" value={form.report_type} onChange={e => setForm({ ...form, report_type: e.target.value })}>
              {REPORT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Date From</label>
            <input type="date" className="input-field" value={form.date_from} onChange={e => setForm({ ...form, date_from: e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Date To</label>
            <input type="date" className="input-field" value={form.date_to} onChange={e => setForm({ ...form, date_to: e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Format</label>
            <select className="input-field" value={form.format} onChange={e => setForm({ ...form, format: e.target.value })}>
              <option value="pdf">PDF</option>
              <option value="excel">Excel</option>
            </select>
          </div>
        </div>
        <button type="submit" disabled={generating} className="btn-primary disabled:opacity-50">
          {generating ? 'Generating...' : 'Generate Report'}
        </button>
      </form>


      {/* Report History */}
      <div className="card">
        <h3 className="font-semibold mb-4">Generated Reports</h3>
        {loading ? (
          <div className="flex justify-center py-5"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div></div>
        ) : reports.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">No reports generated yet.</p>
        ) : (
          <div className="space-y-3">
            {reports.map(report => (
              <div key={report.id} className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-sm">{report.title || `${(report.report_type || '').toUpperCase()} Report`}</p>
                  <p className="text-xs text-gray-500">
                    {(report.report_type || '').toUpperCase()} | {(report.format || '').toUpperCase()}
                    {report.created_at && ` | ${new Date(report.created_at).toLocaleDateString('ms-MY')}`}
                  </p>
                  {report.executive_summary && (
                    <p className="text-xs text-gray-600 mt-1 italic line-clamp-2">{report.executive_summary}</p>
                  )}
                </div>
                <button onClick={() => downloadReport(report.id)} className="btn-secondary text-xs">Download</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
