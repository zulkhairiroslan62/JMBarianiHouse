import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import toast from 'react-hot-toast';

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [lineItems, setLineItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    fetchInvoice();
  }, [id]);

  const fetchInvoice = async () => {
    try {
      const { data } = await api.get(`/invoices/${id}`);
      setInvoice(data);
      setLineItems(data.line_items || []);
    } catch (err) {
      toast.error('Failed to load invoice');
      navigate('/invoices');
    } finally {
      setLoading(false);
    }
  };


  const handleFieldChange = (field, value) => {
    setInvoice((prev) => ({ ...prev, [field]: value }));
  };

  const handleLineItemChange = (index, field, value) => {
    setLineItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const handleConfirm = async () => {
    setSaving(true);
    try {
      await api.put(`/invoices/${id}`, {
        ...invoice,
        line_items: lineItems,
        status: 'confirmed',
      });
      toast.success('Invoice confirmed');
      setEditing(false);
      fetchInvoice();
    } catch (err) {
      toast.error('Failed to confirm invoice');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/invoices/${id}`, {
        ...invoice,
        line_items: lineItems,
      });
      toast.success('Invoice saved');
      setEditing(false);
      fetchInvoice();
    } catch (err) {
      toast.error('Failed to save invoice');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this invoice?')) return;
    try {
      await api.delete(`/invoices/${id}`);
      toast.success('Invoice deleted');
      navigate('/invoices');
    } catch (err) {
      toast.error('Failed to delete invoice');
    }
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!invoice) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <button onClick={() => navigate('/invoices')} className="text-sm text-primary-600 hover:text-primary-800 mb-2 inline-block">
            ← Back to Invoices
          </button>
          <h1 className="text-2xl font-bold text-gray-900">
            Invoice {invoice.invoice_number || `#${id}`}
          </h1>
        </div>
        <div className="flex gap-2">
          {!editing ? (
            <button onClick={() => setEditing(true)} className="btn-secondary text-sm">Edit</button>
          ) : (
            <button onClick={handleSave} disabled={saving} className="btn-secondary text-sm">
              {saving ? 'Saving...' : 'Save'}
            </button>
          )}
          <button onClick={handleConfirm} disabled={saving || invoice.status === 'confirmed'} className="btn-primary text-sm disabled:opacity-50">
            Confirm
          </button>
          <button onClick={handleDelete} className="btn-danger text-sm">Delete</button>
        </div>
      </div>


      {/* Duplicate Warning */}
      {invoice.duplicate_warning && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm font-medium text-yellow-800">⚠️ Possible Duplicate</p>
          <p className="text-xs text-yellow-700 mt-1">{invoice.duplicate_warning}</p>
        </div>
      )}

      {/* Invoice Fields */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Invoice Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
            <input
              type="text"
              value={invoice.supplier_name || ''}
              onChange={(e) => handleFieldChange('supplier_name', e.target.value)}
              disabled={!editing}
              className="input-field disabled:bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Number</label>
            <input
              type="text"
              value={invoice.invoice_number || ''}
              onChange={(e) => handleFieldChange('invoice_number', e.target.value)}
              disabled={!editing}
              className="input-field disabled:bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              value={invoice.invoice_date || ''}
              onChange={(e) => handleFieldChange('invoice_date', e.target.value)}
              disabled={!editing}
              className="input-field disabled:bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Total Amount</label>
            <input
              type="number"
              step="0.01"
              value={invoice.total_amount || ''}
              onChange={(e) => handleFieldChange('total_amount', parseFloat(e.target.value))}
              disabled={!editing}
              className="input-field disabled:bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <span className={`inline-block px-3 py-2 rounded-lg text-sm font-medium capitalize ${
              invoice.status === 'confirmed' ? 'bg-green-100 text-green-800' :
              invoice.status === 'error' ? 'bg-red-100 text-red-800' :
              'bg-yellow-100 text-yellow-800'
            }`}>
              {invoice.status}
            </span>
          </div>
        </div>
      </div>


      {/* Line Items */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Line Items</h3>
        {lineItems.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2 text-gray-500 font-medium">Description</th>
                  <th className="text-right px-4 py-2 text-gray-500 font-medium">Qty</th>
                  <th className="text-right px-4 py-2 text-gray-500 font-medium">Unit Price</th>
                  <th className="text-right px-4 py-2 text-gray-500 font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lineItems.map((item, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={item.description || ''}
                        onChange={(e) => handleLineItemChange(i, 'description', e.target.value)}
                        disabled={!editing}
                        className="w-full bg-transparent border-0 focus:ring-0 p-0 disabled:text-gray-900"
                      />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <input
                        type="number"
                        value={item.quantity || ''}
                        onChange={(e) => handleLineItemChange(i, 'quantity', parseFloat(e.target.value))}
                        disabled={!editing}
                        className="w-20 text-right bg-transparent border-0 focus:ring-0 p-0 disabled:text-gray-900"
                      />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <input
                        type="number"
                        step="0.01"
                        value={item.unit_price || ''}
                        onChange={(e) => handleLineItemChange(i, 'unit_price', parseFloat(e.target.value))}
                        disabled={!editing}
                        className="w-24 text-right bg-transparent border-0 focus:ring-0 p-0 disabled:text-gray-900"
                      />
                    </td>
                    <td className="px-4 py-2 text-right text-gray-900">
                      £{((item.quantity || 0) * (item.unit_price || 0)).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-500">No line items extracted</p>
        )}
      </div>
    </div>
  );
}
