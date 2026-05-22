import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api, { safeArray } from '../utils/api';
import toast from 'react-hot-toast';

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [items, setItems] = useState([]);
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
      // Backend returns "items" array (not "line_items")
      setItems(safeArray(data.items));
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

  const handleItemChange = (index, field, value) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Backend expects: { invoice_number, supplier_name, invoice_date, total_amount, tax_amount, notes, items }
      const payload = {
        invoice_number: invoice.invoice_number,
        supplier_name: invoice.supplier_name,
        invoice_date: invoice.invoice_date,
        total_amount: invoice.total_amount ? parseFloat(invoice.total_amount) : null,
        tax_amount: invoice.tax_amount ? parseFloat(invoice.tax_amount) : 0,
        notes: invoice.notes,
        items: items.map(item => ({
          item_name: item.item_name,
          quantity: parseFloat(item.quantity) || 0,
          unit: item.unit || null,
          unit_price: parseFloat(item.unit_price) || 0,
          total_price: parseFloat(item.total_price) || 0,
          category: item.category || null,
          inventory_item_id: item.inventory_item_id || null,
        })),
      };
      const { data } = await api.put(`/invoices/${id}`, payload);
      setInvoice(data);
      setItems(safeArray(data.items));
      setEditing(false);
      toast.success('Invoice saved');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirm = async () => {
    setSaving(true);
    try {
      // Backend has a separate POST /invoices/{id}/confirm endpoint
      const { data } = await api.post(`/invoices/${id}/confirm`);
      setInvoice(data);
      setItems(safeArray(data.items));
      toast.success('Invoice confirmed & inventory updated!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to confirm');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this invoice? This cannot be undone.')) return;
    try {
      await api.delete(`/invoices/${id}`);
      toast.success('Invoice deleted');
      navigate('/invoices');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete');
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

  const canEdit = !['processed'].includes(invoice.status);
  const canConfirm = ['needs_review', 'uploaded', 'processing'].includes(invoice.status);

  return (
    <div className="space-y-6 max-w-5xl">
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
        <div className="flex gap-2 flex-wrap">
          {canEdit && !editing && (
            <button onClick={() => setEditing(true)} className="btn-secondary text-sm">Edit</button>
          )}
          {editing && (
            <>
              <button onClick={handleSave} disabled={saving} className="btn-primary text-sm">
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => { setEditing(false); fetchInvoice(); }} className="btn-secondary text-sm">Cancel</button>
            </>
          )}
          {canConfirm && (
            <button onClick={handleConfirm} disabled={saving} className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg text-sm disabled:opacity-50">
              Confirm & Update Stock
            </button>
          )}
          {canEdit && (
            <button onClick={handleDelete} className="btn-danger text-sm">Delete</button>
          )}
        </div>
      </div>

      {/* Duplicate Warning */}
      {(invoice.is_duplicate || 0) > 0 && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm font-medium text-red-800">
            {invoice.is_duplicate === 2 ? 'DUPLICATE DETECTED' : 'Possible duplicate'}
            {invoice.duplicate_of_id && ` — matches invoice #${invoice.duplicate_of_id}`}
          </p>
        </div>
      )}

      {/* Invoice Fields */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Invoice Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Supplier</label>
            {editing ? (
              <input type="text" className="input-field" value={invoice.supplier_name || ''} onChange={(e) => handleFieldChange('supplier_name', e.target.value)} />
            ) : (
              <p className="font-medium text-gray-900">{invoice.supplier_name || '-'}</p>
            )}
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Invoice Number</label>
            {editing ? (
              <input type="text" className="input-field" value={invoice.invoice_number || ''} onChange={(e) => handleFieldChange('invoice_number', e.target.value)} />
            ) : (
              <p className="font-medium text-gray-900">{invoice.invoice_number || '-'}</p>
            )}
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Date</label>
            {editing ? (
              <input type="date" className="input-field" value={invoice.invoice_date ? invoice.invoice_date.split('T')[0] : ''} onChange={(e) => handleFieldChange('invoice_date', e.target.value)} />
            ) : (
              <p className="font-medium text-gray-900">{invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString('ms-MY') : '-'}</p>
            )}
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Total Amount</label>
            {editing ? (
              <input type="number" step="0.01" className="input-field" value={invoice.total_amount || ''} onChange={(e) => handleFieldChange('total_amount', e.target.value)} />
            ) : (
              <p className="font-medium text-lg text-gray-900">RM {(invoice.total_amount || 0).toFixed(2)}</p>
            )}
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Status</label>
            <span className={`inline-block px-3 py-1.5 rounded-lg text-sm font-medium capitalize ${
              invoice.status === 'confirmed' || invoice.status === 'processed' ? 'bg-green-100 text-green-800' :
              invoice.status === 'needs_review' ? 'bg-yellow-100 text-yellow-800' :
              invoice.status === 'processing' ? 'bg-blue-100 text-blue-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {(invoice.status || '').replace('_', ' ')}
            </span>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">File</label>
            <p className="text-sm text-gray-700">{invoice.original_filename || '-'}</p>
          </div>
        </div>
      </div>

      {/* Line Items Table */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Line Items ({items.length})</h3>
        {items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2 text-gray-500 font-medium">Item Name</th>
                  <th className="text-right px-3 py-2 text-gray-500 font-medium">Qty</th>
                  <th className="text-left px-3 py-2 text-gray-500 font-medium">Unit</th>
                  <th className="text-right px-3 py-2 text-gray-500 font-medium">Unit Price</th>
                  <th className="text-right px-3 py-2 text-gray-500 font-medium">Total</th>
                  <th className="text-left px-3 py-2 text-gray-500 font-medium">Category</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item, i) => (
                  <tr key={item.id || i} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      {editing ? (
                        <input type="text" className="input-field text-sm" value={item.item_name || ''} onChange={(e) => handleItemChange(i, 'item_name', e.target.value)} />
                      ) : (
                        <span className="font-medium text-gray-900">{item.item_name || '-'}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {editing ? (
                        <input type="number" step="0.1" className="input-field text-sm w-20 text-right" value={item.quantity || ''} onChange={(e) => handleItemChange(i, 'quantity', e.target.value)} />
                      ) : (
                        <span>{item.quantity || 0}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {editing ? (
                        <input type="text" className="input-field text-sm w-16" value={item.unit || ''} onChange={(e) => handleItemChange(i, 'unit', e.target.value)} />
                      ) : (
                        <span className="text-gray-600">{item.unit || '-'}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {editing ? (
                        <input type="number" step="0.01" className="input-field text-sm w-24 text-right" value={item.unit_price || ''} onChange={(e) => handleItemChange(i, 'unit_price', e.target.value)} />
                      ) : (
                        <span>RM {(item.unit_price || 0).toFixed(2)}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-gray-900">
                      RM {(item.total_price || 0).toFixed(2)}
                    </td>
                    <td className="px-3 py-2">
                      {editing ? (
                        <select className="input-field text-sm w-28" value={item.category || ''} onChange={(e) => handleItemChange(i, 'category', e.target.value)}>
                          <option value="">-</option>
                          <option value="basah">Basah</option>
                          <option value="kering">Kering</option>
                          <option value="minuman">Minuman</option>
                          <option value="lain-lain">Lain-lain</option>
                        </select>
                      ) : (
                        <span className="text-gray-600 capitalize">{item.category || '-'}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-500">No line items extracted. Edit to add manually.</p>
        )}
      </div>

      {/* Notes */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-2">Notes</h3>
        {editing ? (
          <textarea className="input-field" rows={3} value={invoice.notes || ''} onChange={(e) => handleFieldChange('notes', e.target.value)} placeholder="Add notes..." />
        ) : (
          <p className="text-sm text-gray-600">{invoice.notes || 'No notes'}</p>
        )}
      </div>
    </div>
  );
}
