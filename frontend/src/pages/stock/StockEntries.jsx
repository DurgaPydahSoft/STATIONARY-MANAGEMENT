import { useState, useEffect, useMemo } from 'react';
import { Search, Filter, Package, Building2, FileText, Calendar, DollarSign, Eye, Trash2, X } from 'lucide-react';
import { apiUrl } from '../../utils/api';

const StockEntries = () => {
  const [stockEntries, setStockEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    product: '',
    vendor: '',
    startDate: '',
    endDate: '',
  });
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [products, setProducts] = useState([]);
  const [vendors, setVendors] = useState([]);

  useEffect(() => {
    fetchStockEntries();
    fetchProducts();
    fetchVendors();
  }, []);

  useEffect(() => {
    fetchStockEntries();
  }, [filters]);

  const fetchStockEntries = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      if (filters.product) queryParams.append('product', filters.product);
      if (filters.vendor) queryParams.append('vendor', filters.vendor);
      if (filters.startDate) queryParams.append('startDate', filters.startDate);
      if (filters.endDate) queryParams.append('endDate', filters.endDate);

      const res = await fetch(apiUrl(`/api/stock-entries?${queryParams.toString()}`));
      if (res.ok) {
        const data = await res.json();
        setStockEntries(data);
      }
    } catch (err) {
      console.error('Error fetching stock entries:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch(apiUrl('/api/products'));
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch (err) {
      console.error('Error fetching products:', err);
    }
  };

  const fetchVendors = async () => {
    try {
      const res = await fetch(apiUrl('/api/vendors?active=true'));
      if (res.ok) {
        const data = await res.json();
        setVendors(data);
      }
    } catch (err) {
      console.error('Error fetching vendors:', err);
    }
  };

  const handleDelete = async (entryId) => {
    if (!window.confirm('Are you sure you want to delete this stock entry? This will restore the product stock.')) {
      return;
    }

    try {
      const res = await fetch(apiUrl(`/api/stock-entries/${entryId}`), {
        method: 'DELETE',
      });

      if (res.ok) {
        setStockEntries(prev => prev.filter(e => e._id !== entryId));
        // Refresh products to update stock
        fetchProducts();
      } else {
        throw new Error('Failed to delete stock entry');
      }
    } catch (err) {
      console.error('Error deleting stock entry:', err);
      alert('Error deleting stock entry');
    }
  };

  const filteredEntries = useMemo(() => {
    return stockEntries.filter(entry => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesProduct = entry.product?.name?.toLowerCase().includes(query);
        const matchesVendor = entry.vendor?.name?.toLowerCase().includes(query);
        const matchesInvoice = entry.invoiceNumber?.toLowerCase().includes(query);
        if (!matchesProduct && !matchesVendor && !matchesInvoice) return false;
      }
      return true;
    });
  }, [stockEntries, searchQuery]);

  const formatDate = (dateString) => {
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

  const formatCurrency = (amount) => {
    return `₹${Number(amount || 0).toFixed(2)}`;
  };

  const totalQuantity = useMemo(() => {
    return filteredEntries.reduce((sum, entry) => sum + (entry.quantity || 0), 0);
  }, [filteredEntries]);

  const totalCost = useMemo(() => {
    return filteredEntries.reduce((sum, entry) => sum + (entry.totalCost || 0), 0);
  }, [filteredEntries]);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center shadow-md">
            <Package size={20} className="text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Stock Entries</h2>
            <p className="text-gray-600 text-sm mt-1">View and manage all stock entry history</p>
          </div>
        </div>
        {filteredEntries.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
              <p className="text-sm text-gray-600 mb-1">Total Quantity</p>
              <p className="text-2xl font-bold text-blue-700">{totalQuantity}</p>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
              <p className="text-sm text-gray-600 mb-1">Total Cost</p>
              <p className="text-2xl font-bold text-green-700">{formatCurrency(totalCost)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Search and Filters */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Search */}
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search by product, vendor, or invoice..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Product Filter */}
          <div className="relative">
            <Package className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <select
              value={filters.product}
              onChange={(e) => setFilters({ ...filters, product: e.target.value })}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
            >
              <option value="">All Products</option>
              {products.map(product => (
                <option key={product._id} value={product._id}>{product.name}</option>
              ))}
            </select>
          </div>

          {/* Vendor Filter */}
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <select
              value={filters.vendor}
              onChange={(e) => setFilters({ ...filters, vendor: e.target.value })}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
            >
              <option value="">All Vendors</option>
              {vendors.map(vendor => (
                <option key={vendor._id} value={vendor._id}>{vendor.name}</option>
              ))}
            </select>
          </div>

          {/* Date Range - Simplified */}
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Start Date"
            />
          </div>
        </div>
      </div>

      {/* Stock Entries List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading stock entries...</p>
        </div>
      ) : filteredEntries.length > 0 ? (
        <div className="space-y-4">
          {filteredEntries.map((entry) => (
            <div
              key={entry._id}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-all hover:border-blue-300"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Package className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {entry.product?.name || 'Unknown Product'}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {entry.vendor?.name || 'Unknown Vendor'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Quantity</p>
                      <p className="text-sm font-semibold text-green-600">+{entry.quantity}</p>
                    </div>
                    {entry.purchasePrice > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Unit Price</p>
                        <p className="text-sm font-semibold text-gray-900">{formatCurrency(entry.purchasePrice)}</p>
                      </div>
                    )}
                    {entry.totalCost > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Total Cost</p>
                        <p className="text-sm font-semibold text-gray-900">{formatCurrency(entry.totalCost)}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Date</p>
                      <p className="text-sm font-medium text-gray-900">{formatDate(entry.createdAt)}</p>
                    </div>
                  </div>

                  {entry.invoiceNumber && (
                    <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
                      <FileText size={14} />
                      <span>Invoice: {entry.invoiceNumber}</span>
                      {entry.invoiceDate && (
                        <span className="text-gray-400">
                          ({new Date(entry.invoiceDate).toLocaleDateString()})
                        </span>
                      )}
                    </div>
                  )}

                  {entry.remarks && (
                    <div className="mt-3 p-2 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500 mb-1">Remarks</p>
                      <p className="text-sm text-gray-700">{entry.remarks}</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => setSelectedEntry(entry)}
                    className="px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                    title="View Details"
                  >
                    <Eye size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(entry._id)}
                    className="px-3 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Package className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No stock entries found</h3>
          <p className="text-gray-600">
            {searchQuery || filters.product || filters.vendor || filters.startDate
              ? 'Try adjusting your filters'
              : 'No stock entries have been recorded yet'}
          </p>
        </div>
      )}

      {/* View Details Modal */}
      {selectedEntry && (
        <div className="fixed inset-0 backdrop-blur-sm bg-gray-900 bg-opacity-30 flex items-center justify-center z-50 p-4" onClick={() => setSelectedEntry(null)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-2xl font-bold text-gray-900">Stock Entry Details</h2>
              <button
                onClick={() => setSelectedEntry(null)}
                className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors"
              >
                <X size={18} className="text-gray-600" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Product</p>
                  <p className="font-semibold text-gray-900">{selectedEntry.product?.name || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Vendor</p>
                  <p className="font-semibold text-gray-900">{selectedEntry.vendor?.name || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Quantity</p>
                  <p className="font-semibold text-green-600 text-lg">+{selectedEntry.quantity}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Date Added</p>
                  <p className="font-semibold text-gray-900">{formatDate(selectedEntry.createdAt)}</p>
                </div>
                {selectedEntry.purchasePrice > 0 && (
                  <>
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Unit Price</p>
                      <p className="font-semibold text-gray-900">{formatCurrency(selectedEntry.purchasePrice)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Total Cost</p>
                      <p className="font-semibold text-gray-900 text-lg">{formatCurrency(selectedEntry.totalCost)}</p>
                    </div>
                  </>
                )}
                {selectedEntry.invoiceNumber && (
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Invoice Number</p>
                    <p className="font-semibold text-gray-900">{selectedEntry.invoiceNumber}</p>
                  </div>
                )}
                {selectedEntry.invoiceDate && (
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Invoice Date</p>
                    <p className="font-semibold text-gray-900">{formatDate(selectedEntry.invoiceDate)}</p>
                  </div>
                )}
              </div>

              {selectedEntry.remarks && (
                <div>
                  <p className="text-sm text-gray-500 mb-2">Remarks</p>
                  <p className="text-gray-900 bg-gray-50 p-3 rounded-lg">{selectedEntry.remarks}</p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setSelectedEntry(null)}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockEntries;

