import { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Filter, Package, Eye, Edit, Trash2, X, Save, Calendar, DollarSign, FileText } from 'lucide-react';
import { apiUrl } from '../../utils/api';

const AddProduct = ({ itemCategories, addItemCategory, setItemCategories, currentCourse, products = [], setProducts }) => {
  const [selectedCourse, setSelectedCourse] = useState(currentCourse || '');
  const [selectedYear, setSelectedYear] = useState('');
  const [config, setConfig] = useState(null);
  const [statusMsg, setStatusMsg] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showProductDetail, setShowProductDetail] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 0,
    stock: 0,
    remarks: '',
    forCourse: selectedCourse || '',
    years: [],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(apiUrl('/api/config/academic'));
        if (res.ok) {
          const data = await res.json();
          setConfig(data);
          // Default to "All Courses" (empty string) instead of first course
          if (!selectedCourse) {
            setSelectedCourse('');
          }
        }
      } catch (_) {}
    })();
  }, []);

  // when the global products change, sync categories
  useEffect(() => {
    const cats = Array.from(new Set((products || []).map(p => p.name.toLowerCase().replace(/\s+/g, '_'))));
    setItemCategories && setItemCategories(cats);
  }, [products, setItemCategories]);

  const filteredProducts = useMemo(() => {
    return (products || []).filter(p => {
      // Course filter
      if (selectedCourse && p.forCourse && p.forCourse !== selectedCourse) return false;
      
      // Year filter - check both year (old) and years (new) array
      if (selectedYear) {
        const productYears = p.years || (p.year ? [p.year] : []);
        if (productYears.length > 0 && !productYears.includes(Number(selectedYear))) {
          return false;
        }
      }
      
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = p.name?.toLowerCase().includes(query);
        const matchesDescription = p.description?.toLowerCase().includes(query);
        if (!matchesName && !matchesDescription) return false;
      }
      
      return true;
    });
  }, [products, selectedCourse, selectedYear, searchQuery]);

  const handleProductCreate = (createdProduct) => {
    setProducts && setProducts(prev => [...(prev || []), createdProduct]);
    setStatusMsg('Product created successfully!');
    setShowAddProduct(false);
    setTimeout(() => setStatusMsg(''), 3000);
  };

  const handleDelete = async (productId, productName) => {
    if (!window.confirm(`Are you sure you want to delete "${productName}"?`)) return;
    try {
      const res = await fetch(apiUrl(`/api/products/${productId}`), { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      setProducts && setProducts(prev => (prev || []).filter(p => p._id !== productId));
      setItemCategories && setItemCategories(prev => prev.filter(i => i !== productName));
    } catch (err) {
      console.error('Delete failed', err);
    }
  };

  const handleViewDetails = (product) => {
    setSelectedProduct(product);
    setShowProductDetail(true);
  };

  const handleProductUpdate = (updatedProduct) => {
    setProducts && setProducts(prev => 
      prev.map(p => p._id === updatedProduct._id ? updatedProduct : p)
    );
    setSelectedProduct(updatedProduct);
    setIsEditing(false);
  };

  // Initialize form data when product is selected or modal opens
  useEffect(() => {
    if (selectedProduct && showProductDetail) {
      const productYears = selectedProduct.years || (selectedProduct.year ? [selectedProduct.year] : []);
      setFormData({
        name: selectedProduct.name || '',
        description: selectedProduct.description || '',
        price: selectedProduct.price || 0,
        stock: selectedProduct.stock || 0,
        remarks: selectedProduct.remarks || '',
        forCourse: selectedProduct.forCourse || '',
        years: productYears,
      });
      setIsEditing(false);
    }
  }, [selectedProduct, showProductDetail]);

  useEffect(() => {
    if (showAddProduct) {
      setFormData({
        name: '',
        description: '',
        price: 0,
        stock: 0,
        remarks: '',
        forCourse: selectedCourse || '',
        years: selectedYear ? [Number(selectedYear)] : [],
      });
      setError('');
    }
  }, [showAddProduct, selectedCourse, selectedYear]);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const newData = {
        ...prev,
        [name]: name === 'description' 
          ? value.slice(0, 250) 
          : (name === 'price' || name === 'stock') 
            ? (value === '' ? 0 : Number(value)) 
            : value,
      };
      if (name === 'forCourse') {
        newData.years = [];
      }
      return newData;
    });
  };

  const handleYearToggle = (year) => {
    setFormData(prev => {
      const currentYears = prev.years || [];
      const yearNum = Number(year);
      const isSelected = currentYears.includes(yearNum);
      
      let newYears;
      if (isSelected) {
        newYears = currentYears.filter(y => y !== yearNum);
      } else {
        newYears = [...currentYears, yearNum].sort((a, b) => a - b);
      }
      
      return {
        ...prev,
        years: newYears
      };
    });
  };

  const handleSaveProduct = async () => {
    try {
      setSaving(true);
      setError('');

      if (!formData.name.trim()) {
        setError('Product name is required');
        setSaving(false);
        return;
      }

      if (showAddProduct) {
        // Create new product (with price, but stock stays 0)
        const response = await fetch(apiUrl('/api/products'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name,
            description: formData.description || '',
            price: formData.price || 0,
            stock: 0, // Default stock - should be added via Add Stock tab
            remarks: formData.remarks || '',
            forCourse: formData.forCourse || undefined,
            years: formData.years || [],
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to create product');
        }

        const created = await response.json();
        handleProductCreate(created);
        setShowAddProduct(false);
      } else if (selectedProduct) {
        // Update existing product
        const response = await fetch(apiUrl(`/api/products/${selectedProduct._id}`), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to update product');
        }

        const updated = await response.json();
        handleProductUpdate(updated);
      }
    } catch (err) {
      setError(err.message || 'Failed to save product');
      console.error('Error saving product:', err);
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not available';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Invalid date';
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-md">
            <Package size={20} className="text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Products</h2>
            <p className="text-gray-600 text-sm mt-1">Manage your product catalog</p>
          </div>
        </div>
        <button
          onClick={() => setShowAddProduct(true)}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-md hover:shadow-lg font-medium"
        >
          <Plus size={20} />
          Add New Product
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Course Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <select 
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
              value={selectedCourse} 
              onChange={(e) => setSelectedCourse(e.target.value)}
            >
              <option value="">All Courses</option>
              {(config?.courses || []).map(c => (
                <option key={c.name} value={c.name}>{c.displayName}</option>
              ))}
            </select>
          </div>

          {/* Year Filter */}
          <div>
            <select 
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
              value={selectedYear} 
              onChange={(e) => setSelectedYear(e.target.value)}
            >
              <option value="">All Years</option>
              {(config?.courses?.find(c => c.name === selectedCourse)?.years || []).map(y => (
                <option key={y} value={y}>Year {y}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Status Message */}
      {statusMsg && (
        <div className={`mb-6 p-4 rounded-lg text-sm font-medium ${
          statusMsg.includes('successfully') 
            ? 'bg-green-50 text-green-700 border border-green-200' 
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {statusMsg}
        </div>
      )}

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProducts.length > 0 ? (
          filteredProducts.map((product) => {
            const productYears = product.years || (product.year ? [product.year] : []);
            const yearsDisplay = productYears.length === 0 
              ? 'All Years' 
              : productYears.sort((a, b) => a - b).join(', ');
            
            return (
              <div 
                key={product._id} 
                className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-all duration-200 group"
              >
                {/* Product Header */}
                <div className="p-6 border-b border-gray-100">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-lg font-bold text-gray-900 line-clamp-2 flex-1">
                      {product.name}
                    </h3>
                    {product.price !== undefined && (
                      <span className="ml-3 px-3 py-1 bg-blue-100 text-blue-700 rounded-lg font-semibold text-sm whitespace-nowrap">
                        ₹{product.price.toFixed(2)}
                      </span>
                    )}
                  </div>
                  {product.description && (
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {product.description}
                    </p>
                  )}
                </div>

                {/* Product Info */}
                <div className="p-6 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Course:</span>
                    <span className="font-medium text-gray-900">{product.forCourse || 'All'}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Years:</span>
                    <span className="font-medium text-gray-900">{yearsDisplay}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Stock:</span>
                    <span className={`font-medium ${product.stock > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {product.stock || 0}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="p-6 pt-0 flex gap-2">
                  <button
                    onClick={() => handleViewDetails(product)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-50 text-blue-700 rounded-xl hover:bg-blue-100 transition-colors font-medium text-sm"
                  >
                    <Eye size={16} />
                    View
                  </button>
                  <button
                    onClick={() => handleDelete(product._id, product.name)}
                    className="px-4 py-2.5 bg-red-50 text-red-700 rounded-xl hover:bg-red-100 transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full bg-gray-50 rounded-xl border border-gray-200 p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No products found</h3>
            <p className="text-gray-600 mb-6">
              {searchQuery || selectedCourse || selectedYear 
                ? 'Try adjusting your filters' 
                : 'Get started by adding your first product'}
            </p>
            {!searchQuery && !selectedCourse && !selectedYear && (
              <button
                onClick={() => setShowAddProduct(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-md hover:shadow-lg"
              >
                <Plus size={20} />
                Add Product
              </button>
            )}
          </div>
        )}
      </div>

      {/* Product Detail Modal - View/Edit */}
      {showProductDetail && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/30">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl m-4 overflow-hidden flex flex-col max-h-[95vh]">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 flex items-center justify-between rounded-t-xl flex-shrink-0">
              <div>
                <h2 className="text-2xl font-bold">Product Details</h2>
                <p className="text-blue-100 text-sm mt-1">View and edit product information</p>
              </div>
              <button
                onClick={() => {
                  setShowProductDetail(false);
                  setSelectedProduct(null);
                  setIsEditing(false);
                }}
                className="w-10 h-10 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors text-white hover:text-white"
                title="Close"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 flex-1 overflow-y-auto">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-6">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-6">
                  {/* Product Name */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Product Name <span className="text-red-500">*</span>
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleFormChange}
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter product name..."
                      />
                    ) : (
                      <p className="text-gray-900 font-medium text-lg">{selectedProduct.name}</p>
                    )}
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Description
                      <span className="text-gray-500 font-normal ml-2">
                        ({formData.description.length}/250 characters)
                      </span>
                    </label>
                    {isEditing ? (
                      <textarea
                        name="description"
                        value={formData.description}
                        onChange={handleFormChange}
                        maxLength={250}
                        rows={3}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                        placeholder="Enter product description (max 250 characters)..."
                      />
                    ) : (
                      <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">
                        {selectedProduct.description || 'No description provided'}
                      </p>
                    )}
                  </div>

                  {/* Price Section */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <DollarSign size={18} className="text-blue-600" />
                      <label className="block text-sm font-semibold text-gray-700">Price</label>
                    </div>
                    {isEditing ? (
                      <div>
                        <input
                          type="number"
                          name="price"
                          value={formData.price}
                          onChange={handleFormChange}
                          min="0"
                          step="0.01"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-2"
                          placeholder="0.00"
                        />
                      </div>
                    ) : (
                      <div>
                        <p className="text-2xl font-bold text-blue-700 mb-2">
                          ₹{selectedProduct.price?.toFixed(2) || '0.00'}
                        </p>
                      </div>
                    )}
                    
                    {selectedProduct.lastPriceUpdated && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 mt-2">
                        <Calendar size={14} />
                        <span className="font-medium">Last Updated:</span>
                        <span>{formatDate(selectedProduct.lastPriceUpdated)}</span>
                      </div>
                    )}
                  </div>

                  {/* Stock */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Stock</label>
                    {isEditing ? (
                      <input
                        type="number"
                        name="stock"
                        value={formData.stock}
                        onChange={handleFormChange}
                        min="0"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="0"
                      />
                    ) : (
                      <p className="text-gray-700 bg-gray-50 p-2 rounded-lg">{selectedProduct.stock || 0}</p>
                    )}
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                  {/* Remarks Section */}
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <FileText size={18} className="text-yellow-600" />
                      <label className="block text-sm font-semibold text-gray-700">Remarks</label>
                      <span className="text-xs text-gray-500">(Internal/Admin Notes)</span>
                    </div>
                    {isEditing ? (
                      <textarea
                        name="remarks"
                        value={formData.remarks}
                        onChange={handleFormChange}
                        rows={3}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent resize-none"
                        placeholder="Enter internal notes..."
                      />
                    ) : (
                      <p className="text-gray-700">
                        {selectedProduct.remarks || 'No remarks available'}
                      </p>
                    )}
                  </div>

                  {/* Course/Year */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Product Applicability</h3>
                    
                    {/* Course */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Course</label>
                      {isEditing ? (
                        <select
                          name="forCourse"
                          value={formData.forCourse}
                          onChange={handleFormChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="">All Courses</option>
                          {(config?.courses || []).map(c => (
                            <option key={c.name} value={c.name}>{c.displayName}</option>
                          ))}
                        </select>
                      ) : (
                        <p className="text-gray-700 bg-gray-50 p-2 rounded-lg">{selectedProduct.forCourse || 'All Courses'}</p>
                      )}
                    </div>

                    {/* Years */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Years</label>
                      {isEditing ? (
                        <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
                          <div className="flex flex-wrap gap-3">
                            {(config?.courses?.find(c => c.name === formData.forCourse)?.years || []).map(y => {
                              const isChecked = (formData.years || []).includes(y);
                              return (
                                <label
                                  key={y}
                                  className="flex items-center gap-2 px-4 py-2 bg-white border-2 rounded-lg cursor-pointer transition-all hover:border-blue-400"
                                  style={{
                                    borderColor: isChecked ? '#3b82f6' : '#d1d5db',
                                    backgroundColor: isChecked ? '#eff6ff' : 'white'
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => handleYearToggle(y)}
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                  />
                                  <span className="font-medium text-gray-700">Year {y}</span>
                                </label>
                              );
                            })}
                            {(config?.courses?.find(c => c.name === formData.forCourse)?.years || []).length === 0 && (
                              <p className="text-sm text-gray-500">Select a course to see available years</p>
                            )}
                          </div>
                          {(formData.years || []).length === 0 && (
                            <p className="text-xs text-gray-500 mt-2">No years selected - product applies to all years</p>
                          )}
                        </div>
                      ) : (
                        <div className="bg-gray-50 border border-gray-300 rounded-lg p-3">
                          {(() => {
                            const productYears = selectedProduct.years || (selectedProduct.year ? [selectedProduct.year] : []);
                            const yearsDisplay = productYears.length === 0 
                              ? 'All Years' 
                              : productYears.sort((a, b) => a - b).map(y => `Year ${y}`).join(', ');
                            return <p className="text-gray-700 font-medium">{yearsDisplay}</p>;
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="bg-gray-50 border-t border-gray-200 p-6 flex items-center justify-between rounded-b-xl flex-shrink-0">
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <Edit size={16} />
                {isEditing ? 'Cancel Edit' : 'Edit Product'}
              </button>
              {isEditing && (
                <button
                  onClick={handleSaveProduct}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save size={16} />
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Product Modal - Create New (without price and stock) */}
      {showAddProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/30">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl m-4 overflow-hidden flex flex-col max-h-[95vh]">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 flex items-center justify-between rounded-t-xl flex-shrink-0">
              <div>
                <h2 className="text-2xl font-bold">Add New Product</h2>
                <p className="text-blue-100 text-sm mt-1">Fill in all product information</p>
              </div>
              <button
                onClick={() => {
                  setShowAddProduct(false);
                  setError('');
                }}
                className="w-10 h-10 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors text-white hover:text-white"
                title="Close"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 flex-1 overflow-y-auto">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-6">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-6">
                  {/* Product Name */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Product Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleFormChange}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter product name..."
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Description
                      <span className="text-gray-500 font-normal ml-2">
                        ({formData.description.length}/250 characters)
                      </span>
                    </label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleFormChange}
                      maxLength={250}
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      placeholder="Enter product description (max 250 characters)..."
                    />
                  </div>

                  {/* Price Section */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <DollarSign size={18} className="text-blue-600" />
                      <label className="block text-sm font-semibold text-gray-700">
                        Price <span className="text-red-500">*</span>
                      </label>
                    </div>
                    <input
                      type="number"
                      name="price"
                      value={formData.price}
                      onChange={handleFormChange}
                      min="0"
                      step="0.01"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="0.00"
                      required
                    />
                  </div>

                  {/* Remarks Section */}
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <FileText size={18} className="text-yellow-600" />
                      <label className="block text-sm font-semibold text-gray-700">Remarks</label>
                      <span className="text-xs text-gray-500">(Internal/Admin Notes)</span>
                    </div>
                    <textarea
                      name="remarks"
                      value={formData.remarks}
                      onChange={handleFormChange}
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent resize-none"
                      placeholder="Enter internal notes..."
                    />
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                  {/* Course/Year */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Product Applicability</h3>
                    
                    {/* Course */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Course</label>
                      <select
                        name="forCourse"
                        value={formData.forCourse}
                        onChange={handleFormChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">All Courses</option>
                        {(config?.courses || []).map(c => (
                          <option key={c.name} value={c.name}>{c.displayName}</option>
                        ))}
                      </select>
                    </div>

                    {/* Years */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Years</label>
                      <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
                        <div className="flex flex-wrap gap-3">
                          {(config?.courses?.find(c => c.name === formData.forCourse)?.years || []).map(y => {
                            const isChecked = (formData.years || []).includes(y);
                            return (
                              <label
                                key={y}
                                className="flex items-center gap-2 px-4 py-2 bg-white border-2 rounded-lg cursor-pointer transition-all hover:border-blue-400"
                                style={{
                                  borderColor: isChecked ? '#3b82f6' : '#d1d5db',
                                  backgroundColor: isChecked ? '#eff6ff' : 'white'
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleYearToggle(y)}
                                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                                <span className="font-medium text-gray-700">Year {y}</span>
                              </label>
                            );
                          })}
                          {(config?.courses?.find(c => c.name === formData.forCourse)?.years || []).length === 0 && (
                            <p className="text-sm text-gray-500">Select a course to see available years</p>
                          )}
                        </div>
                        {(formData.years || []).length === 0 && (
                          <p className="text-xs text-gray-500 mt-2">No years selected - product applies to all years</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="bg-gray-50 border-t border-gray-200 p-6 flex items-center justify-between rounded-b-xl flex-shrink-0">
              <button
                onClick={() => {
                  setShowAddProduct(false);
                  setError('');
                }}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProduct}
                disabled={saving || !formData.name.trim()}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus size={16} />
                {saving ? 'Creating...' : 'Create Product'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddProduct;

