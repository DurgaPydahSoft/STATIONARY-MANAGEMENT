import { useState, useEffect } from 'react';
import { Plus, Package, Building2, FileText, Calendar, DollarSign, Save, AlertCircle } from 'lucide-react';
import { apiUrl } from '../../utils/api';

const AddStock = ({ products = [], setProducts }) => {
  const [formData, setFormData] = useState({
    product: '',
    vendor: '',
    quantity: '',
    invoiceNumber: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    purchasePrice: '',
    remarks: '',
  });
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', message: '' });
  const [selectedProduct, setSelectedProduct] = useState(null);

  useEffect(() => {
    fetchVendors();
  }, []);

  useEffect(() => {
    if (formData.product) {
      const product = products.find(p => p._id === formData.product);
      setSelectedProduct(product);
    } else {
      setSelectedProduct(null);
    }
  }, [formData.product, products]);

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


  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.product || !formData.vendor || !formData.quantity || Number(formData.quantity) < 1) {
      setStatusMsg({ type: 'error', message: 'Please fill in all required fields (Product, Vendor, and Quantity)' });
      setTimeout(() => setStatusMsg({ type: '', message: '' }), 3000);
      return;
    }

    setLoading(true);
    try {
      const payload = {
        product: formData.product,
        vendor: formData.vendor,
        quantity: Number(formData.quantity),
        invoiceNumber: formData.invoiceNumber || '',
        invoiceDate: formData.invoiceDate || new Date().toISOString(),
        purchasePrice: formData.purchasePrice ? Number(formData.purchasePrice) : 0,
        remarks: formData.remarks || '',
      };

      const res = await fetch(apiUrl('/api/stock-entries'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to add stock');
      }

      const newStockEntry = await res.json();
      
      // Update product stock in local state
      if (setProducts) {
        setProducts(prev => prev.map(p => 
          p._id === formData.product 
            ? { ...p, stock: (p.stock || 0) + Number(formData.quantity) }
            : p
        ));
      }

      setStatusMsg({ type: 'success', message: 'Stock added successfully!' });
      
      // Reset form
      setFormData({
        product: '',
        vendor: '',
        quantity: '',
        invoiceNumber: '',
        invoiceDate: new Date().toISOString().split('T')[0],
        purchasePrice: '',
        remarks: '',
      });
      setSelectedProduct(null);
      
      setTimeout(() => setStatusMsg({ type: '', message: '' }), 3000);
    } catch (err) {
      console.error('Error adding stock:', err);
      setStatusMsg({ type: 'error', message: err.message || 'Failed to add stock' });
      setTimeout(() => setStatusMsg({ type: '', message: '' }), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center shadow-md">
            <Plus size={20} className="text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Add Stock</h2>
            <p className="text-gray-600 text-sm mt-1">Record new stock entries with vendor and invoice information</p>
          </div>
        </div>
      </div>

      {/* Status Message */}
      {statusMsg.message && (
        <div className={`mb-6 p-4 rounded-lg text-sm font-medium ${
          statusMsg.type === 'success'
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          <div className="flex items-center gap-2">
            <AlertCircle size={16} />
            {statusMsg.message}
          </div>
        </div>
      )}

      {/* Form Section */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* Product Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Product <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Package className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <select
                  name="product"
                  value={formData.product}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
                  required
                >
                  <option value="">Select a product</option>
                  {products.map(product => (
                    <option key={product._id} value={product._id}>
                      {product.name} (Stock: {product.stock || 0})
                    </option>
                  ))}
                </select>
              </div>
              {selectedProduct && (
                <p className="mt-2 text-sm text-gray-600">
                  Current stock: <span className="font-semibold">{selectedProduct.stock || 0}</span> | 
                  Price: <span className="font-semibold">₹{selectedProduct.price?.toFixed(2) || '0.00'}</span>
                </p>
              )}
            </div>

            {/* Vendor Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Vendor <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <select
                  name="vendor"
                  value={formData.vendor}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
                  required
                >
                  <option value="">Select a vendor</option>
                  {vendors.map(vendor => (
                    <option key={vendor._id} value={vendor._id}>
                      {vendor.name}
                    </option>
                  ))}
                </select>
              </div>
              {vendors.length === 0 && (
                <p className="mt-2 text-xs text-amber-600">
                  No vendors available. Please add vendors first from the Vendor Management tab.
                </p>
              )}
            </div>

            {/* Quantity */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quantity <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="quantity"
                value={formData.quantity}
                onChange={handleChange}
                min="1"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter quantity"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Invoice Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Invoice Number
                </label>
                <div className="relative">
                  <FileText className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    name="invoiceNumber"
                    value={formData.invoiceNumber}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Invoice number"
                  />
                </div>
              </div>

              {/* Invoice Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Invoice Date
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="date"
                    name="invoiceDate"
                    value={formData.invoiceDate}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Purchase Price */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Purchase Price (per unit)
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="number"
                  name="purchasePrice"
                  value={formData.purchasePrice}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.00"
                />
              </div>
              {formData.purchasePrice && formData.quantity && (
                <p className="mt-2 text-sm text-gray-600">
                  Total Cost: <span className="font-semibold">
                    ₹{(Number(formData.purchasePrice) * Number(formData.quantity)).toFixed(2)}
                  </span>
                </p>
              )}
            </div>

            {/* Remarks */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Remarks
              </label>
              <textarea
                name="remarks"
                value={formData.remarks}
                onChange={handleChange}
                rows={3}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
                placeholder="Any additional notes..."
              />
            </div>

          {/* Submit Button */}
          <div className="pt-4 border-t border-gray-200">
            <button
              type="submit"
              disabled={loading || !formData.product || !formData.vendor || !formData.quantity}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all shadow-md hover:shadow-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save size={20} />
              {loading ? 'Adding Stock...' : 'Add Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddStock;

