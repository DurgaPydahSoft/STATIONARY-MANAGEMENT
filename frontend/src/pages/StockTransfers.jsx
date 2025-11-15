import { useState, useEffect, useMemo } from 'react';
import { Search, Filter, Package, ArrowRight, Calendar, CheckCircle, XCircle, Clock, Trash2, Plus, AlertCircle, Building2, Edit2, MapPin, Save } from 'lucide-react';
import { apiUrl } from '../utils/api';

const StockTransfers = () => {
  const [stockTransfers, setStockTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    product: '',
    toBranch: '',
    status: '',
    startDate: '',
    endDate: '',
  });
  const [selectedTransfer, setSelectedTransfer] = useState(null);
  const [products, setProducts] = useState([]);
  const [branches, setBranches] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [showEditBranchModal, setShowEditBranchModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);
  const [formData, setFormData] = useState({
    items: [{ product: '', quantity: '', branchStock: 0 }],
    toBranch: '',
    transferDate: new Date().toISOString().split('T')[0],
    isPaid: false,
    deductFromCentral: true,
    includeInRevenue: true,
    remarks: '',
  });
  const [branchFormData, setBranchFormData] = useState({
    name: '',
    location: '',
    description: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [branchSubmitting, setBranchSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', message: '' });

  useEffect(() => {
    fetchStockTransfers();
    fetchProducts();
    fetchBranches();
  }, []);

  useEffect(() => {
    fetchStockTransfers();
  }, [filters]);

  const fetchStockTransfers = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      if (filters.product) queryParams.append('product', filters.product);
      if (filters.toBranch) queryParams.append('toBranch', filters.toBranch);
      if (filters.status) queryParams.append('status', filters.status);
      if (filters.startDate) queryParams.append('startDate', filters.startDate);
      if (filters.endDate) queryParams.append('endDate', filters.endDate);

      const res = await fetch(apiUrl(`/api/stock-transfers?${queryParams.toString()}`));
      if (res.ok) {
        const data = await res.json();
        setStockTransfers(data);
      }
    } catch (err) {
      console.error('Error fetching stock transfers:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch(apiUrl('/api/products'));
      if (res.ok) {
        const data = await res.json();
        // Filter out set products for transfers (only individual products)
        setProducts(data.filter(p => !p.isSet));
      }
    } catch (err) {
      console.error('Error fetching products:', err);
    }
  };

  const fetchBranches = async () => {
    try {
      const res = await fetch(apiUrl('/api/stock-transfers/branches?activeOnly=true&withStock=true'));
      if (res.ok) {
        const data = await res.json();
        setBranches(data);
      }
    } catch (err) {
      console.error('Error fetching branches:', err);
    }
  };

  const handleCreateBranch = async (e) => {
    e.preventDefault();
    
    if (!branchFormData.name || !branchFormData.name.trim()) {
      setStatusMsg({ type: 'error', message: 'Branch name is required' });
      setTimeout(() => setStatusMsg({ type: '', message: '' }), 3000);
      return;
    }

    setBranchSubmitting(true);
    try {
      const res = await fetch(apiUrl('/api/stock-transfers/branches'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(branchFormData),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to create branch');
      }

      const newBranch = await res.json();
      setBranches(prev => [...prev, newBranch].sort((a, b) => a.name.localeCompare(b.name)));
      setShowBranchModal(false);
      setBranchFormData({ name: '', location: '', description: '' });
      setStatusMsg({ type: 'success', message: 'Branch created successfully' });
      setTimeout(() => setStatusMsg({ type: '', message: '' }), 3000);
    } catch (error) {
      console.error('Error creating branch:', error);
      setStatusMsg({ type: 'error', message: error.message || 'Failed to create branch' });
      setTimeout(() => setStatusMsg({ type: '', message: '' }), 3000);
    } finally {
      setBranchSubmitting(false);
    }
  };

  const handleEditBranch = (branch) => {
    setEditingBranch(branch);
    setBranchFormData({
      name: branch.name || '',
      location: branch.location || '',
      description: branch.description || '',
    });
    setShowEditBranchModal(true);
  };

  const handleUpdateBranch = async (e) => {
    e.preventDefault();
    
    if (!branchFormData.name || !branchFormData.name.trim()) {
      setStatusMsg({ type: 'error', message: 'Branch name is required' });
      setTimeout(() => setStatusMsg({ type: '', message: '' }), 3000);
      return;
    }

    setBranchSubmitting(true);
    try {
      const res = await fetch(apiUrl(`/api/stock-transfers/branches/${editingBranch._id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(branchFormData),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to update branch');
      }

      const updatedBranch = await res.json();
      setBranches(prev => prev.map(b => b._id === editingBranch._id ? updatedBranch : b).sort((a, b) => a.name.localeCompare(b.name)));
      setShowEditBranchModal(false);
      setEditingBranch(null);
      setBranchFormData({ name: '', location: '', description: '' });
      setStatusMsg({ type: 'success', message: 'Branch updated successfully' });
      setTimeout(() => setStatusMsg({ type: '', message: '' }), 3000);
    } catch (error) {
      console.error('Error updating branch:', error);
      setStatusMsg({ type: 'error', message: error.message || 'Failed to update branch' });
      setTimeout(() => setStatusMsg({ type: '', message: '' }), 3000);
    } finally {
      setBranchSubmitting(false);
    }
  };

  const handleDeleteBranch = async (branchId) => {
    if (!window.confirm('Are you sure you want to delete this branch? This action cannot be undone if the branch is not used in any transfers.')) {
      return;
    }

    try {
      const res = await fetch(apiUrl(`/api/stock-transfers/branches/${branchId}`), {
        method: 'DELETE',
      });

      if (res.ok) {
        setBranches(prev => prev.filter(b => b._id !== branchId));
        setStatusMsg({ type: 'success', message: 'Branch deleted successfully' });
        setTimeout(() => setStatusMsg({ type: '', message: '' }), 3000);
      } else {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to delete branch');
      }
    } catch (error) {
      console.error('Error deleting branch:', error);
      setStatusMsg({ type: 'error', message: error.message || 'Error deleting branch' });
      setTimeout(() => setStatusMsg({ type: '', message: '' }), 3000);
    }
  };

  const handleToggleBranchStatus = async (branch) => {
    try {
      const res = await fetch(apiUrl(`/api/stock-transfers/branches/${branch._id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !branch.isActive }),
      });

      if (res.ok) {
        const updated = await res.json();
        setBranches(prev => prev.map(b => b._id === branch._id ? updated : b));
      } else {
        throw new Error('Failed to update branch status');
      }
    } catch (error) {
      console.error('Error toggling branch status:', error);
      alert('Error updating branch status');
    }
  };

  const fetchBranchStock = async (branchId, productId) => {
    if (!branchId || !productId) return 0;
    try {
      const res = await fetch(apiUrl(`/api/stock-transfers/branches/${branchId}/stock/${productId}`));
      if (res.ok) {
        const data = await res.json();
        return data.quantity || 0;
      }
    } catch (err) {
      console.error('Error fetching branch stock:', err);
    }
    return 0;
  };

  const filteredTransfers = useMemo(() => {
    return stockTransfers.filter(transfer => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const productNames = transfer.items?.map(item => item.product?.name?.toLowerCase() || '').join(' ') || '';
        const toBranch = transfer.toBranch?.name?.toLowerCase() || '';
        
        if (!productNames.includes(query) && !toBranch.includes(query)) {
          return false;
        }
      }
      return true;
    });
  }, [stockTransfers, searchQuery]);

  const addProductItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { product: '', quantity: '', branchStock: 0 }]
    }));
  };

  const removeProductItem = (index) => {
    if (formData.items.length <= 1) return;
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const updateProductItem = (index, field, value) => {
    setFormData(prev => {
      const updatedItems = [...prev.items];
      updatedItems[index] = { ...updatedItems[index], [field]: value };
      
      // Fetch branch stock if product and branch are selected
      if (field === 'product' && value && prev.toBranch) {
        fetchBranchStock(prev.toBranch, value).then(stock => {
          updatedItems[index].branchStock = stock || 0;
        });
      }
      if (field === 'toBranch' && value && updatedItems[index].product) {
        fetchBranchStock(value, updatedItems[index].product).then(stock => {
          updatedItems[index].branchStock = stock || 0;
        });
      }
      
      return { ...prev, items: updatedItems };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate all items
    const validItems = formData.items.filter(item => item.product && item.quantity && Number(item.quantity) >= 1);
    
    if (validItems.length === 0) {
      setStatusMsg({ type: 'error', message: 'Please add at least one product with valid quantity' });
      setTimeout(() => setStatusMsg({ type: '', message: '' }), 3000);
      return;
    }

    if (!formData.toBranch) {
      setStatusMsg({ type: 'error', message: 'Please select a destination branch' });
      setTimeout(() => setStatusMsg({ type: '', message: '' }), 3000);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        items: validItems.map(item => ({
          product: item.product,
          quantity: Number(item.quantity),
        })),
        toBranch: formData.toBranch,
        transferDate: formData.transferDate || new Date().toISOString(),
        isPaid: formData.isPaid || false,
        deductFromCentral: formData.deductFromCentral !== false,
        includeInRevenue: formData.includeInRevenue !== false,
        remarks: formData.remarks || '',
      };

      const res = await fetch(apiUrl('/api/stock-transfers'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to create stock transfer');
      }

      const newTransfer = await res.json();
      setStockTransfers(prev => [newTransfer, ...prev]);
      setShowAddModal(false);
      setFormData({
        items: [{ product: '', quantity: '', branchStock: 0 }],
        toBranch: '',
        transferDate: new Date().toISOString().split('T')[0],
        isPaid: false,
        deductFromCentral: true,
        includeInRevenue: true,
        remarks: '',
      });
      setStatusMsg({ type: 'success', message: 'Stock transfer created successfully' });
      setTimeout(() => setStatusMsg({ type: '', message: '' }), 3000);
    } catch (error) {
      console.error('Error creating stock transfer:', error);
      setStatusMsg({ type: 'error', message: error.message || 'Failed to create stock transfer' });
      setTimeout(() => setStatusMsg({ type: '', message: '' }), 3000);
    } finally {
      setSubmitting(false);
    }
  };

  const handleComplete = async (transferId) => {
    if (!window.confirm('Mark this transfer as completed?')) {
      return;
    }

    try {
      const res = await fetch(apiUrl(`/api/stock-transfers/${transferId}/complete`), {
        method: 'POST',
      });

      if (res.ok) {
        const updated = await res.json();
        setStockTransfers(prev => prev.map(t => t._id === transferId ? updated : t));
      } else {
        throw new Error('Failed to complete transfer');
      }
    } catch (error) {
      console.error('Error completing transfer:', error);
      alert('Error completing transfer');
    }
  };

  const handleCancel = async (transferId) => {
    if (!window.confirm('Cancel this transfer?')) {
      return;
    }

    try {
      const res = await fetch(apiUrl(`/api/stock-transfers/${transferId}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      });

      if (res.ok) {
        const updated = await res.json();
        setStockTransfers(prev => prev.map(t => t._id === transferId ? updated : t));
      } else {
        throw new Error('Failed to cancel transfer');
      }
    } catch (error) {
      console.error('Error cancelling transfer:', error);
      alert('Error cancelling transfer');
    }
  };

  const handleDelete = async (transferId) => {
    if (!window.confirm('Are you sure you want to delete this transfer? This action cannot be undone.')) {
      return;
    }

    try {
      const res = await fetch(apiUrl(`/api/stock-transfers/${transferId}`), {
        method: 'DELETE',
      });

      if (res.ok) {
        setStockTransfers(prev => prev.filter(t => t._id !== transferId));
      } else {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to delete transfer');
      }
    } catch (error) {
      console.error('Error deleting transfer:', error);
      alert(error.message || 'Error deleting transfer');
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: { icon: Clock, color: 'bg-yellow-100 text-yellow-800 border-yellow-200', label: 'Pending' },
      completed: { icon: CheckCircle, color: 'bg-green-100 text-green-800 border-green-200', label: 'Completed' },
      cancelled: { icon: XCircle, color: 'bg-red-100 text-red-800 border-red-200', label: 'Cancelled' },
    };
    const badge = badges[status] || badges.pending;
    const Icon = badge.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${badge.color}`}>
        <Icon size={12} />
        {badge.label}
      </span>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <Package className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Stock Transfers</h1>
              <p className="text-gray-600 mt-1">Manage stock transfers between branches</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowBranchModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg hover:shadow-xl font-medium"
            >
              <Building2 size={18} />
              Manage Branches
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl font-medium"
            >
              <Plus size={20} />
              New Transfer
            </button>
          </div>
        </div>

        {/* Status Message */}
        {statusMsg.message && (
          <div
            className={`px-4 py-3 rounded-lg border ${
              statusMsg.type === 'success'
                ? 'bg-green-50 border-green-200 text-green-700'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}
          >
            {statusMsg.message}
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="lg:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search by product, branches..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <select
              value={filters.product}
              onChange={(e) => setFilters({ ...filters, product: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="">All Products</option>
              {products.map(product => (
                <option key={product._id} value={product._id}>{product.name}</option>
              ))}
            </select>
            <select
              value={filters.toBranch}
              onChange={(e) => setFilters({ ...filters, toBranch: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="">All Branches</option>
              {branches.filter(b => b.isActive).map(branch => (
                <option key={branch._id} value={branch._id}>{branch.name}</option>
              ))}
            </select>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="date"
                placeholder="Start Date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="date"
                placeholder="End Date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Transfers Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Transfer History</h3>
            <p className="text-sm text-gray-500">All stock transfers between branches</p>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
              <p className="text-gray-600">Loading transfers...</p>
            </div>
          ) : filteredTransfers.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-6xl mb-4">📦</div>
              <h4 className="text-xl font-semibold text-gray-900 mb-2">No transfers found</h4>
              <p className="text-gray-600">
                {searchQuery || Object.values(filters).some(f => f !== '')
                  ? 'Try adjusting your search criteria'
                  : 'Create your first stock transfer to get started'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Products</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">To Branch</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredTransfers.map(transfer => (
                    <tr 
                      key={transfer._id} 
                      onClick={() => setSelectedTransfer(transfer)}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-gray-900">
                          {transfer.items?.length || 0} {transfer.items?.length === 1 ? 'Product' : 'Products'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Package size={16} className="text-gray-400" />
                          <span className="text-sm font-medium text-gray-900">{transfer.toBranch?.name || 'N/A'}</span>
                          {transfer.toBranch?.location && (
                            <span className="text-xs text-gray-500">({transfer.toBranch.location})</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                          transfer.isPaid 
                            ? 'bg-green-100 text-green-800 border border-green-200'
                            : 'bg-red-100 text-red-800 border border-red-200'
                        }`}>
                          {transfer.isPaid ? 'Paid' : 'Unpaid'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-500">{formatDate(transfer.transferDate)}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(transfer.status)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Add Transfer Modal */}
        {showAddModal && (
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }} onClick={() => setShowAddModal(false)}>
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
                <h2 className="text-2xl font-bold text-gray-900">Create Stock Transfer</h2>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors"
                >
                  <XCircle size={18} className="text-gray-600" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    To Branch <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.toBranch}
                    onChange={(e) => {
                      setFormData({ ...formData, toBranch: e.target.value });
                      // Update branch stock for all items when branch changes
                      formData.items.forEach((item, idx) => {
                        if (item.product && e.target.value) {
                          fetchBranchStock(e.target.value, item.product).then(stock => {
                            updateProductItem(idx, 'branchStock', stock);
                          });
                        }
                      });
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    required
                  >
                    <option value="">Select Destination Branch</option>
                    {branches.filter(b => b.isActive).map(branch => (
                      <option key={branch._id} value={branch._id}>{branch.name}{branch.location ? ` - ${branch.location}` : ''}</option>
                    ))}
                  </select>
                  <p className="mt-2 text-sm text-gray-500">
                    Transfer from <span className="font-semibold">Central Stock</span> to selected branch
                  </p>
                </div>

                {/* Products Section */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-gray-700">
                      Products <span className="text-red-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={addProductItem}
                      className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
                    >
                      <Plus size={16} />
                      Add Product
                    </button>
                  </div>
                  <div className="space-y-3">
                    {formData.items.map((item, index) => (
                      <div key={index} className="grid grid-cols-12 gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="col-span-6">
                          <select
                            value={item.product}
                            onChange={async (e) => {
                              const value = e.target.value;
                              updateProductItem(index, 'product', value);
                              if (value && formData.toBranch) {
                                const stock = await fetchBranchStock(formData.toBranch, value);
                                updateProductItem(index, 'branchStock', stock);
                              }
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                            required={index === 0}
                          >
                            <option value="">Select Product</option>
                            {products.map(product => (
                              <option key={product._id} value={product._id}>
                                {product.name} (Stock: {product.stock || 0})
                              </option>
                            ))}
                          </select>
                          {item.product && formData.toBranch && (
                            <p className="mt-1 text-xs text-gray-500">
                              Branch Stock: <span className="font-semibold">{item.branchStock || 0}</span>
                            </p>
                          )}
                        </div>
                        <div className="col-span-4">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateProductItem(index, 'quantity', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                            placeholder="Qty"
                            required={index === 0}
                          />
                        </div>
                        <div className="col-span-2 flex items-center justify-center">
                          {formData.items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeProductItem(index)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Remove Product"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Payment Status
                      </label>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.isPaid}
                            onChange={(e) => setFormData({ ...formData, isPaid: e.target.checked })}
                            className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                          />
                          <span className="text-sm text-gray-700">Mark as Paid</span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Transfer Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={formData.transferDate}
                        onChange={(e) => setFormData({ ...formData, transferDate: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        required
                      />
                    </div>
                  </div>

                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">Transfer Options</h4>
                    <div className="space-y-3">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.deductFromCentral}
                          onChange={(e) => setFormData({ ...formData, deductFromCentral: e.target.checked })}
                          className="w-5 h-5 mt-0.5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                        <div className="flex-1">
                          <span className="text-sm font-medium text-gray-900">Deduct Stock from Central Store</span>
                          <p className="text-xs text-gray-600 mt-1">If checked, stock will be deducted from central inventory when transfer is completed.</p>
                        </div>
                      </label>
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.includeInRevenue}
                          onChange={(e) => setFormData({ ...formData, includeInRevenue: e.target.checked })}
                          className="w-5 h-5 mt-0.5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                        <div className="flex-1">
                          <span className="text-sm font-medium text-gray-900">Include Amount in Revenue</span>
                          <p className="text-xs text-gray-600 mt-1">If checked, this transfer will be counted as revenue and appear in transaction reports.</p>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Remarks
                  </label>
                  <textarea
                    value={formData.remarks}
                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Optional notes about this transfer..."
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all font-medium disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Plus size={18} />
                        Create Transfer
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Transfer Details Modal */}
        {selectedTransfer && (
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }} onClick={() => setSelectedTransfer(null)}>
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
                <h2 className="text-2xl font-bold text-gray-900">Transfer Details</h2>
                <button
                  onClick={() => setSelectedTransfer(null)}
                  className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors"
                >
                  <XCircle size={18} className="text-gray-600" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <p className="text-sm text-gray-500 mb-2">Products</p>
                    <div className="space-y-2">
                      {selectedTransfer.items && selectedTransfer.items.length > 0 ? (
                        selectedTransfer.items.map((item, idx) => (
                          <div key={idx} className="p-2 bg-gray-50 rounded-lg border border-gray-200">
                            <p className="font-semibold text-gray-900">{item.product?.name || 'N/A'}</p>
                            <p className="text-sm text-gray-600">
                              Quantity: {item.quantity} | Price: ₹{item.product?.price?.toFixed(2) || '0.00'} | 
                              Total: ₹{((item.quantity || 0) * (item.product?.price || 0)).toFixed(2)}
                            </p>
                          </div>
                        ))
                      ) : (
                        <p className="text-gray-500">No products</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Total Quantity</p>
                    <p className="font-semibold text-gray-900">
                      {selectedTransfer.items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Payment Status</p>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                      selectedTransfer.isPaid 
                        ? 'bg-green-100 text-green-800 border border-green-200'
                        : 'bg-red-100 text-red-800 border border-red-200'
                    }`}>
                      {selectedTransfer.isPaid ? 'Paid' : 'Unpaid'}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Deduct from Central</p>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                      selectedTransfer.deductFromCentral !== false
                        ? 'bg-blue-100 text-blue-800 border border-blue-200'
                        : 'bg-gray-100 text-gray-600 border border-gray-200'
                    }`}>
                      {selectedTransfer.deductFromCentral !== false ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Include in Revenue</p>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                      selectedTransfer.includeInRevenue !== false
                        ? 'bg-green-100 text-green-800 border border-green-200'
                        : 'bg-gray-100 text-gray-600 border border-gray-200'
                    }`}>
                      {selectedTransfer.includeInRevenue !== false ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Source</p>
                    <p className="font-semibold text-gray-900">Central Stock</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">To Branch</p>
                    <p className="font-semibold text-gray-900">{selectedTransfer.toBranch?.name || 'N/A'}</p>
                    {selectedTransfer.toBranch?.location && (
                      <p className="text-xs text-gray-500 mt-1">{selectedTransfer.toBranch.location}</p>
                    )}
                  </div>
                  {selectedTransfer.transactionId && (
                    <>
                      <div>
                        <p className="text-sm text-gray-500">Transaction ID</p>
                        <p className="font-semibold text-gray-900">{selectedTransfer.transactionId?.transactionId || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Transaction Amount</p>
                        <p className="font-semibold text-gray-900">₹{selectedTransfer.transactionId?.totalAmount?.toFixed(2) || '0.00'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Payment Method</p>
                        <p className="font-semibold text-gray-900 capitalize">{selectedTransfer.transactionId?.paymentMethod || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Payment Status</p>
                        <p className="font-semibold text-gray-900">{selectedTransfer.transactionId?.isPaid ? 'Paid' : 'Unpaid'}</p>
                      </div>
                    </>
                  )}
                  <div>
                    <p className="text-sm text-gray-500">Transfer Date</p>
                    <p className="font-semibold text-gray-900">{formatDate(selectedTransfer.transferDate)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Status</p>
                    <div className="mt-1">{getStatusBadge(selectedTransfer.status)}</div>
                  </div>
                  {selectedTransfer.completedAt && (
                    <div>
                      <p className="text-sm text-gray-500">Completed At</p>
                      <p className="font-semibold text-gray-900">{formatDateTime(selectedTransfer.completedAt)}</p>
                    </div>
                  )}
                  {selectedTransfer.cancelledAt && (
                    <div>
                      <p className="text-sm text-gray-500">Cancelled At</p>
                      <p className="font-semibold text-gray-900">{formatDateTime(selectedTransfer.cancelledAt)}</p>
                    </div>
                  )}
                  {selectedTransfer.remarks && (
                    <div className="col-span-2">
                      <p className="text-sm text-gray-500">Remarks</p>
                      <p className="font-semibold text-gray-900">{selectedTransfer.remarks}</p>
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                  {selectedTransfer.status === 'pending' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleComplete(selectedTransfer._id);
                          setSelectedTransfer(null);
                        }}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center gap-2"
                        title="Complete Transfer"
                      >
                        <CheckCircle size={16} />
                        Complete
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCancel(selectedTransfer._id);
                          setSelectedTransfer(null);
                        }}
                        className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-medium flex items-center gap-2"
                        title="Cancel Transfer"
                      >
                        <XCircle size={16} />
                        Cancel
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(selectedTransfer._id);
                          setSelectedTransfer(null);
                        }}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center gap-2"
                        title="Delete Transfer"
                      >
                        <Trash2 size={16} />
                        Delete
                      </button>
                    </div>
                  )}
                  <div className="flex items-center gap-2 ml-auto">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTransfer(null);
                      }}
                      className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Manage Branches Modal */}
        {showBranchModal && (
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }} onClick={() => setShowBranchModal(false)}>
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
                <h2 className="text-2xl font-bold text-gray-900">Manage Transfer Branches</h2>
                <button
                  onClick={() => setShowBranchModal(false)}
                  className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors"
                >
                  <XCircle size={18} className="text-gray-600" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Add Branch Form */}
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Branch</h3>
                  <form onSubmit={handleCreateBranch} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Branch Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={branchFormData.name}
                          onChange={(e) => setBranchFormData({ ...branchFormData, name: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="e.g., Main Campus"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Location
                        </label>
                        <input
                          type="text"
                          value={branchFormData.location}
                          onChange={(e) => setBranchFormData({ ...branchFormData, location: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="e.g., Hyderabad"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Description
                        </label>
                        <input
                          type="text"
                          value={branchFormData.description}
                          onChange={(e) => setBranchFormData({ ...branchFormData, description: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Optional description"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={branchSubmitting}
                        className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {branchSubmitting ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Creating...
                          </>
                        ) : (
                          <>
                            <Plus size={16} />
                            Add Branch
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Branches List */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Existing Branches ({branches.length})</h3>
                  {branches.length === 0 ? (
                    <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
                      <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-600">No branches created yet. Add your first branch above.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {branches.map(branch => (
                        <div key={branch._id} className={`p-4 border rounded-lg ${branch.isActive ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-300'}`}>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-semibold text-gray-900">{branch.name}</h4>
                                {!branch.isActive && (
                                  <span className="px-2 py-0.5 text-xs bg-gray-200 text-gray-600 rounded-full">Inactive</span>
                                )}
                              </div>
                              {branch.location && (
                                <div className="flex items-center gap-1 text-sm text-gray-600 mb-1">
                                  <MapPin size={14} />
                                  {branch.location}
                                </div>
                              )}
                              {branch.description && (
                                <p className="text-sm text-gray-500 mt-2">{branch.description}</p>
                              )}
                              {branch.stock && branch.stock.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-gray-200">
                                  <p className="text-xs text-gray-500 mb-2">Stock Items: {branch.stock.length}</p>
                                  <div className="flex flex-wrap gap-2">
                                    {branch.stock.slice(0, 5).map((stockItem, idx) => {
                                      // Use product ID if available (either as object with _id or as string)
                                      const productId = stockItem.product?._id || stockItem.product || `stock-${branch._id}-${idx}`;
                                      const productIdStr = typeof productId === 'object' ? productId.toString() : productId;
                                      return (
                                        <span key={`${branch._id}-${productIdStr}`} className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">
                                          {stockItem.product?.name || 'Unknown'}: {stockItem.quantity}
                                        </span>
                                      );
                                    })}
                                    {branch.stock.length > 5 && (
                                      <span key={`${branch._id}-more`} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                                        +{branch.stock.length - 5} more
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2 ml-4">
                              <button
                                onClick={() => handleEditBranch(branch)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Edit Branch"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                onClick={() => handleToggleBranchStatus(branch)}
                                className={`p-2 rounded-lg transition-colors ${
                                  branch.isActive
                                    ? 'text-yellow-600 hover:bg-yellow-50'
                                    : 'text-green-600 hover:bg-green-50'
                                }`}
                                title={branch.isActive ? 'Deactivate Branch' : 'Activate Branch'}
                              >
                                {branch.isActive ? <XCircle size={16} /> : <CheckCircle size={16} />}
                              </button>
                              <button
                                onClick={() => handleDeleteBranch(branch._id)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete Branch"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-4 border-t border-gray-200">
                  <button
                    onClick={() => setShowBranchModal(false)}
                    className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Branch Modal */}
        {showEditBranchModal && editingBranch && (
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }} onClick={() => {
            setShowEditBranchModal(false);
            setEditingBranch(null);
            setBranchFormData({ name: '', location: '', description: '' });
          }}>
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
                <h2 className="text-2xl font-bold text-gray-900">Edit Branch</h2>
                <button
                  onClick={() => {
                    setShowEditBranchModal(false);
                    setEditingBranch(null);
                    setBranchFormData({ name: '', location: '', description: '' });
                  }}
                  className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors"
                >
                  <XCircle size={18} className="text-gray-600" />
                </button>
              </div>

              <form onSubmit={handleUpdateBranch} className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Branch Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={branchFormData.name}
                      onChange={(e) => setBranchFormData({ ...branchFormData, name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Location
                    </label>
                    <input
                      type="text"
                      value={branchFormData.location}
                      onChange={(e) => setBranchFormData({ ...branchFormData, location: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <input
                      type="text"
                      value={branchFormData.description}
                      onChange={(e) => setBranchFormData({ ...branchFormData, description: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditBranchModal(false);
                      setEditingBranch(null);
                      setBranchFormData({ name: '', location: '', description: '' });
                    }}
                    className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={branchSubmitting}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {branchSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Updating...
                      </>
                    ) : (
                      <>
                        <Save size={16} />
                        Update Branch
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StockTransfers;

