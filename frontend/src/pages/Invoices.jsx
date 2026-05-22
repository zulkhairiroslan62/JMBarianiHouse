import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import api, { safeArray, safeNumber } from '../utils/api';
import toast from 'react-hot-toast';

const STATUS_OPTIONS = ['all', 'uploaded', 'processing', 'needs_review', 'confirmed', 'processed'];

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchInvoices();
  }, [statusFilter, page]);

  const fetchInvoices = async () => {
    try {
      const params = { page, page_size: 20 };
      if (statusFilter !== 'all') params.status = statusFilter;
      const { data } = await api.get('/invoices/', { params });
      // Backend returns: { invoices: [...], total, page, page_size }
      const list = safeArray(data, 'invoices', 'items');
      setInvoices(list);
      const total = safeNumber(data?.total, 0);
      const pageSize = safeNumber(data?.page_size, 20);
      setTotalPages(Math.max(1, Math.ceil(total / pageSize)));
    } catch (err) {
      toast.error('Failed to load invoices');
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
        await api.post('/invoices/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
      toast.success(`${acceptedFiles.length} invoice(s) uploaded`);
      fetchInvoices();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [], 'application/pdf': [] },
    multiple: true,
  });

  const statusBadge = (status) => {
    const map = {
      uploaded: 'bg-gray-100 text-gray-800',
      processing: 'bg-blue-100 text-blue-800',
      needs_review: 'bg-yellow-100 text-yellow-800',
      confirmed: 'bg-green-100 text-green-800',
      processed: 'bg-purple-100 text-purple-800',
    };
    return map[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>

      {/* Upload Zone */}
      <div
        {...getRootProps()}
        className={`card border-2 border-dashed cursor-pointer transition-colors ${
          isDragActive ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-primary-400'
        }`}
      >
        <input {...getInputProps()} />
        <div className="text-center py-6">
          {uploading ? (
            <div className="flex items-center justify-center gap-2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600"></div>
              <span className="text-sm text-gray-600">Processing with Claude AI OCR...</span>
            </div>
          ) : (
            <>
              <p className="text-3xl mb-2">📄</p>
              <p className="text-sm font-medium text-gray-700">
                {isDragActive ? 'Drop invoices here...' : 'Drag & drop invoices or click to browse'}
              </p>
              <p className="text-xs text-gray-400 mt-1">PDF, JPG, PNG supported</p>
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors capitalize ${
              statusFilter === s
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Invoice Table */}
      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg">No invoices found</p>
            <p className="text-sm mt-1">Upload your first invoice above</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-6 py-3 text-gray-500 font-medium">Supplier</th>
                  <th className="text-left px-6 py-3 text-gray-500 font-medium">Invoice #</th>
                  <th className="text-left px-6 py-3 text-gray-500 font-medium">Date</th>
                  <th className="text-right px-6 py-3 text-gray-500 font-medium">Amount</th>
                  <th className="text-center px-6 py-3 text-gray-500 font-medium">Status</th>
                  <th className="text-center px-3 py-3 text-gray-500 font-medium">Dup</th>
                  <th className="text-right px-6 py-3 text-gray-500 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-gray-900 font-medium">{inv.supplier_name || '-'}</td>
                    <td className="px-6 py-3 text-gray-600">{inv.invoice_number || '-'}</td>
                    <td className="px-6 py-3 text-gray-600">
                      {inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString('ms-MY') : '-'}
                    </td>
                    <td className="px-6 py-3 text-right text-gray-900">
                      {inv.total_amount != null ? `RM ${inv.total_amount.toFixed(2)}` : '-'}
                    </td>
                    <td className="px-6 py-3 text-center">
                      <span className={`px-2 py-1 text-xs rounded-full font-medium capitalize ${statusBadge(inv.status)}`}>
                        {(inv.status || '').replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      {inv.is_duplicate === 2 && (
                        <span className="px-2 py-0.5 text-xs rounded-full font-bold bg-red-100 text-red-700">DUPLICATE</span>
                      )}
                      {inv.is_duplicate === 1 && (
                        <span className="px-2 py-0.5 text-xs rounded-full font-bold bg-yellow-100 text-yellow-700">POSSIBLE</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <Link to={`/invoices/${inv.id}`} className="text-primary-600 hover:text-primary-800 text-sm font-medium">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-secondary text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="btn-secondary text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
