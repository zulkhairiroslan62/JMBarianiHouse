import { useState, useEffect } from 'react';
import api, { safeArray } from '../utils/api';
import toast from 'react-hot-toast';

const CATEGORIES = ['basah', 'kering', 'minuman', 'lain-lain'];

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showMovementModal, setShowMovementModal] = useState(null);
  const [newItem, setNewItem] = useState({ name: '', category: 'kering', unit: 'kg', current_stock: 0, reorder_level: 5 });
  const [movement, setMovement] = useState({ movement_type: 'stock_out', quantity: '', unit_cost: '', notes: '' });

  useEffect(() => {
    fetchData();
  }, [categoryFilter, search]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = {};
      if (categoryFilter) params.category = categoryFilter;
      if (search) params.search = search;

      const [itemsRes, alertsRes] = await Promise.all([
        api.get('/inventory/items', { params }),
        api.get('/inventory/alerts'),
      ]);

      // Backend returns arrays directly for these endpoints
      setItems(safeArray(itemsRes.data));
      setAlerts(safeArray(alertsRes.data));
    } catch (err) {
      toast.error('Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    try {
      await api.post('/inventory/items', {
        ...newItem,
        current_stock: parseFloat(newItem.current_stock) || 0,
        reorder_level: parseFloat(newItem.reorder_level) || 0,
      });
      toast.success('Item added');
      setShowAddModal(false);
      setNewItem({ name: '', category: 'kering', unit: 'kg', current_stock: 0, reorder_level: 5 });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add item');
    }
  };

  const handleMovement = async (e) => {
    e.preventDefault();
    try {
      await api.post('/inventory/movements', {
        inventory_item_id: showMovementModal,
        movement_type: movement.movement_type,
        quantity: parseFloat(movement.quantity) || 0,
        unit_cost: movement.unit_cost ? parseFloat(movement.unit_cost) : null,
        notes: movement.notes || null,
      });
      toast.success('Stock updated');
      setShowMovementModal(null);
      setMovement({ movement_type: 'stock_out', quantity: '', unit_cost: '', notes: '' });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to record movement');
    }
  };

  const stockColor = (item) => {
    if ((item.current_stock || 0) <= 0) return 'text-red-600';
    if (item.is_below_reorder) return 'text-yellow-600';
    return 'text-green-600';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
        <button onClick={() => setShowAddModal(true)} className="btn-primary text-sm">+ Add Item</button>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="card border border-red-200 bg-red-50">
          <h3 className="text-sm font-semibold text-red-800 mb-2">Stock Alerts ({alerts.length})</h3>
          <ul className="space-y-1">
            {alerts.map((alert, i) => (
              <li key={i} className="text-sm text-red-700">{alert.message || `${alert.item?.name}: Low stock`}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          placeholder="Search items..."
          className="input-field w-60"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="input-field w-40"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {/* Items Table */}
      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No inventory items found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Item</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Category</th>
                  <th className="text-right px-4 py-3 text-gray-500 font-medium">Stock</th>
                  <th className="text-right px-4 py-3 text-gray-500 font-medium">Reorder</th>
                  <th className="text-right px-4 py-3 text-gray-500 font-medium">Days Left</th>
                  <th className="text-right px-4 py-3 text-gray-500 font-medium">Avg Cost</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Supplier</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => (
                  <tr key={item.id} className={`hover:bg-gray-50 ${item.is_below_reorder ? 'bg-red-50' : ''}`}>
                    <td className="px-4 py-3 text-gray-900 font-medium">{item.name}</td>
                    <td className="px-4 py-3 text-gray-600 capitalize">{item.category}</td>
                    <td className={`px-4 py-3 text-right font-bold ${stockColor(item)}`}>
                      {item.current_stock} {item.unit}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">{item.reorder_level}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`${(item.days_of_stock || 0) < 3 ? 'text-red-600 font-bold' : (item.days_of_stock || 0) < 7 ? 'text-yellow-600' : 'text-green-600'}`}>
                        {(item.days_of_stock || 0) > 90 ? '90+' : Math.round(item.days_of_stock || 0)}d
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">RM {(item.weighted_avg_cost || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{item.primary_supplier || '-'}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => setShowMovementModal(item.id)} className="text-xs text-primary-600 hover:text-primary-800 font-medium">
                        +/- Stock
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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleAddItem} className="bg-white rounded-xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-bold">Add Inventory Item</h3>
            <input required placeholder="Item name" className="input-field" value={newItem.name} onChange={e => setNewItem({ ...newItem, name: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <select className="input-field" value={newItem.category} onChange={e => setNewItem({ ...newItem, category: e.target.value })}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input placeholder="Unit (kg, pcs)" className="input-field" value={newItem.unit} onChange={e => setNewItem({ ...newItem, unit: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input type="number" placeholder="Current stock" className="input-field" value={newItem.current_stock} onChange={e => setNewItem({ ...newItem, current_stock: e.target.value })} />
              <input type="number" placeholder="Reorder level" className="input-field" value={newItem.reorder_level} onChange={e => setNewItem({ ...newItem, reorder_level: e.target.value })} />
            </div>
            <div className="flex gap-3">
              <button type="submit" className="btn-primary flex-1">Add</button>
              <button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Stock Movement Modal */}
      {showMovementModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleMovement} className="bg-white rounded-xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-bold">Record Stock Movement</h3>
            <select className="input-field" value={movement.movement_type} onChange={e => setMovement({ ...movement, movement_type: e.target.value })}>
              <option value="stock_in">Stock In</option>
              <option value="stock_out">Stock Out</option>
              <option value="adjustment">Adjustment</option>
              <option value="waste">Waste</option>
            </select>
            <input required type="number" step="0.1" min="0.1" placeholder="Quantity" className="input-field" value={movement.quantity} onChange={e => setMovement({ ...movement, quantity: e.target.value })} />
            {movement.movement_type === 'stock_in' && (
              <input type="number" step="0.01" placeholder="Unit cost (RM)" className="input-field" value={movement.unit_cost} onChange={e => setMovement({ ...movement, unit_cost: e.target.value })} />
            )}
            <input placeholder="Notes (optional)" className="input-field" value={movement.notes} onChange={e => setMovement({ ...movement, notes: e.target.value })} />
            <div className="flex gap-3">
              <button type="submit" className="btn-primary flex-1">Record</button>
              <button type="button" onClick={() => setShowMovementModal(null)} className="btn-secondary flex-1">Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
