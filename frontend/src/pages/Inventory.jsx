import { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [categories, setCategories] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    fetchInventory();
  }, [categoryFilter]);

  const fetchInventory = async () => {
    try {
      const params = {};
      if (categoryFilter !== 'all') params.category = categoryFilter;
      const { data } = await api.get('/inventory', { params });
      setItems(data.items || data);
      setCategories(data.categories || []);
      setAlerts(data.alerts || []);
    } catch (err) {
      toast.error('Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };


  const handleAddItem = async (e) => {
    e.preventDefault();
    const form = e.target;
    const payload = {
      name: form.name.value,
      category: form.category.value,
      unit: form.unit.value,
      quantity: parseFloat(form.quantity.value),
      min_quantity: parseFloat(form.min_quantity.value),
      cost_per_unit: parseFloat(form.cost_per_unit.value),
    };
    try {
      await api.post('/inventory', payload);
      toast.success('Item added');
      setShowAddModal(false);
      fetchInventory();
    } catch (err) {
      toast.error('Failed to add item');
    }
  };

  const handleMovement = async (e) => {
    e.preventDefault();
    const form = e.target;
    const payload = {
      item_id: selectedItem.id,
      type: form.type.value,
      quantity: parseFloat(form.quantity.value),
      notes: form.notes.value,
    };
    try {
      await api.post('/inventory/movements', payload);
      toast.success('Movement recorded');
      setShowMovementModal(false);
      setSelectedItem(null);
      fetchInventory();
    } catch (err) {
      toast.error('Failed to record movement');
    }
  };

  const openMovement = (item) => {
    setSelectedItem(item);
    setShowMovementModal(true);
  };


  const stockColor = (item) => {
    if (item.quantity <= 0) return 'text-red-600';
    if (item.quantity <= item.min_quantity) return 'text-yellow-600';
    return 'text-green-600';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
        <button onClick={() => setShowAddModal(true)} className="btn-primary text-sm">
          + Add Item
        </button>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="card border border-red-200 bg-red-50">
          <h3 className="text-sm font-semibold text-red-800 mb-2">⚠️ Stock Alerts</h3>
          <ul className="space-y-1">
            {alerts.map((alert, i) => (
              <li key={i} className="text-sm text-red-700">
                {alert.item_name}: {alert.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setCategoryFilter('all')}
          className={`px-3 py-1.5 text-xs font-medium rounded-full ${
            categoryFilter === 'all' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full capitalize ${
              categoryFilter === cat ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>


      {/* Items Table */}
      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p>No inventory items</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-6 py-3 text-gray-500 font-medium">Item</th>
                  <th className="text-left px-6 py-3 text-gray-500 font-medium">Category</th>
                  <th className="text-right px-6 py-3 text-gray-500 font-medium">Quantity</th>
                  <th className="text-right px-6 py-3 text-gray-500 font-medium">Min Qty</th>
                  <th className="text-right px-6 py-3 text-gray-500 font-medium">Cost/Unit</th>
                  <th className="text-right px-6 py-3 text-gray-500 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-gray-900 font-medium">{item.name}</td>
                    <td className="px-6 py-3 text-gray-600 capitalize">{item.category}</td>
                    <td className={`px-6 py-3 text-right font-medium ${stockColor(item)}`}>
                      {item.quantity} {item.unit}
                    </td>
                    <td className="px-6 py-3 text-right text-gray-500">{item.min_quantity} {item.unit}</td>
                    <td className="px-6 py-3 text-right text-gray-600">£{item.cost_per_unit?.toFixed(2)}</td>
                    <td className="px-6 py-3 text-right">
                      <button
                        onClick={() => openMovement(item)}
                        className="text-primary-600 hover:text-primary-800 text-sm font-medium"
                      >
                        Move
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>


      {/* Add Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Add Inventory Item</h3>
            <form onSubmit={handleAddItem} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input name="name" required className="input-field" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <input name="category" required className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                  <input name="unit" required placeholder="kg, pcs, L" className="input-field" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                  <input name="quantity" type="number" step="0.01" required className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min Qty</label>
                  <input name="min_quantity" type="number" step="0.01" required className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cost/Unit</label>
                  <input name="cost_per_unit" type="number" step="0.01" required className="input-field" />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn-primary flex-1">Add Item</button>
                <button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary flex-1">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* Stock Movement Modal */}
      {showMovementModal && selectedItem && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-2">Stock Movement</h3>
            <p className="text-sm text-gray-600 mb-4">
              {selectedItem.name} — Current: {selectedItem.quantity} {selectedItem.unit}
            </p>
            <form onSubmit={handleMovement} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select name="type" required className="input-field">
                  <option value="in">Stock In</option>
                  <option value="out">Stock Out</option>
                  <option value="adjustment">Adjustment</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                <input name="quantity" type="number" step="0.01" required className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <input name="notes" className="input-field" placeholder="Optional notes" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn-primary flex-1">Record</button>
                <button type="button" onClick={() => { setShowMovementModal(false); setSelectedItem(null); }} className="btn-secondary flex-1">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
