import { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Filter, Package, Eye, Edit, Trash2, X, Save, Calendar, DollarSign, FileText, Layers, MinusCircle, LayoutGrid, Table } from 'lucide-react';
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
  const [viewMode, setViewMode] = useState('cards');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 0,
    stock: 0,
    remarks: '',
    forCourse: selectedCourse || '',
    years: [],
    isSet: false,
    setItems: [],
    lowStockThreshold: 10,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [setItemToAdd, setSetItemToAdd] = useState('');

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

  const availableSetProducts = useMemo(() => {
    const selectedIds = new Set((formData.setItems || []).map(item => item.productId));
    return (products || []).filter(p => {
      if (p.isSet) return false;
      if (selectedProduct && p._id === selectedProduct._id) return false;
      if (selectedIds.has(p._id)) return false;
      return true;
    });
  }, [products, selectedProduct, formData.setItems]);

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
        isSet: Boolean(selectedProduct.isSet),
        setItems: (selectedProduct.setItems || []).map(item => ({
          productId: item?.product?._id || item?.product || '',
          quantity: item?.quantity || 1,
          productName: item?.product?.name || item?.productNameSnapshot || '',
        })).filter(item => item.productId),
        lowStockThreshold: selectedProduct.lowStockThreshold ?? 10,
      });
      setSetItemToAdd('');
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
        isSet: false,
        setItems: [],
        lowStockThreshold: 10,
      });
      setError('');
      setSetItemToAdd('');
    }
  }, [showAddProduct, selectedCourse, selectedYear]);

  useEffect(() => {
    if (setItemToAdd && !availableSetProducts.some(p => p._id === setItemToAdd)) {
      setSetItemToAdd('');
    }
  }, [setItemToAdd, availableSetProducts]);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const newData = {
        ...prev,
        [name]: name === 'description' 
          ? value.slice(0, 250) 
          : (name === 'price' || name === 'stock' || name === 'lowStockThreshold') 
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

  const handleSetToggle = (checked) => {
    setFormData(prev => ({
      ...prev,
      isSet: checked,
      setItems: checked ? prev.setItems : [],
    }));
    if (!checked) {
      setSetItemToAdd('');
    }
  };

  const handleAddSetItem = () => {
    if (!setItemToAdd) return;
    const targetProduct = availableSetProducts.find(p => p._id === setItemToAdd);
    if (!targetProduct) return;

    setFormData(prev => {
      if ((prev.setItems || []).some(item => item.productId === targetProduct._id)) {
        return prev;
      }
      const newItems = [
        ...(prev.setItems || []),
        {
          productId: targetProduct._id,
          quantity: 1,
          productName: targetProduct.name,
        },
      ];
      return {
        ...prev,
        setItems: newItems,
      };
    });
    setSetItemToAdd('');
  };

  const handleRemoveSetItem = (productId) => {
    setFormData(prev => ({
      ...prev,
      setItems: (prev.setItems || []).filter(item => item.productId !== productId),
    }));
  };

  const handleSetItemQuantityChange = (productId, quantity) => {
    const parsedQuantity = Number(quantity);
    setFormData(prev => ({
      ...prev,
      setItems: (prev.setItems || []).map(item => {
        if (item.productId !== productId) return item;
        const safeQuantity = Number.isFinite(parsedQuantity) && parsedQuantity > 0 ? Math.round(parsedQuantity) : 1;
        return {
          ...item,
          quantity: safeQuantity,
        };
      }),
    }));
  };

  const resolveProductName = (productId, fallback) => {
    const match = (products || []).find(p => p._id === productId);
    return match?.name || fallback || 'Unknown product';
  };

  const resolveProductPrice = (productId, fallback) => {
    const match = (products || []).find(p => p._id === productId);
    return match?.price ?? fallback ?? 0;
  };

  const isCardView = viewMode === 'cards';
  const productType = formData.isSet ? 'set' : 'single';

  const handleProductTypeSelect = (type) => {
    setFormData(prev => ({
      ...prev,
      isSet: type === 'set',
      setItems: type === 'set' ? prev.setItems : [],
      lowStockThreshold: type === 'set' ? 0 : (prev.lowStockThreshold || 10),
    }));
    if (type !== 'set') {
      setSetItemToAdd('');
    }
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

      if (formData.isSet && (!formData.setItems || formData.setItems.length === 0)) {
        setError('Select at least one existing product to include in the set');
        setSaving(false);
        return;
      }

      if (!formData.isSet && (formData.lowStockThreshold === undefined || formData.lowStockThreshold === null || Number.isNaN(Number(formData.lowStockThreshold)) || Number(formData.lowStockThreshold) < 0)) {
        setError('Please enter a valid low stock threshold (0 or higher)');
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
            isSet: formData.isSet || undefined,
            setItems: formData.isSet
              ? (formData.setItems || []).map(item => ({
                  productId: item.productId,
                  quantity: item.quantity,
                }))
              : [],
            lowStockThreshold: formData.isSet ? 0 : formData.lowStockThreshold,
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
          body: JSON.stringify({
            ...formData,
            setItems: formData.isSet
              ? (formData.setItems || []).map(item => ({
                  productId: item.productId,
                  quantity: item.quantity,
                }))
              : [],
            lowStockThreshold: formData.isSet ? 0 : formData.lowStockThreshold,
          }),
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
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-4">
          <div>
            <p className="text-sm font-semibold text-gray-700">Filters & Display</p>
            <p className="text-xs text-gray-500">Search, refine and switch between table or card layouts.</p>
          </div>
          <div className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-xl p-1">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${isCardView ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >
              <LayoutGrid size={16} />
              Cards
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${!isCardView ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >
              <Table size={16} />
              Table
            </button>
          </div>
        </div>
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

      {/* Products Listing */}
      {filteredProducts.length === 0 ? (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-12 text-center">
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
      ) : isCardView ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((product) => {
            const productYears = product.years || (product.year ? [product.year] : []);
            const yearsDisplay = productYears.length === 0 
              ? 'All Years' 
              : productYears.sort((a, b) => a - b).join(', ');
            
            return (
              <div 
                key={product._id} 
                className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow transition-all duration-200 group"
              >
                <div className="p-4 border-b border-gray-100">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-base font-semibold text-gray-900 line-clamp-2 flex-1">
                      {product.name}
                    </h3>
                    <div className="flex items-center gap-2">
                    {product.price !== undefined && (
                        <span className="px-2.5 py-0.5 bg-blue-100 text-blue-700 rounded-md font-medium text-xs whitespace-nowrap">
                        ₹{product.price.toFixed(2)}
                      </span>
                    )}
                      {product.isSet && (
                        <span className="px-2.5 py-0.5 bg-purple-100 text-purple-700 rounded-md font-medium text-xs whitespace-nowrap">
                          Set
                      </span>
                    )}
                    </div>
                  </div>
                  {product.description && (
                    <p className="text-xs text-gray-600 line-clamp-2">
                      {product.description}
                    </p>
                  )}
                </div>

                <div className="p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">Course</span>
                    <span className="font-medium text-gray-900 truncate max-w-[120px] text-right">{product.forCourse || 'All'}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">Years</span>
                    <span className="font-medium text-gray-900 truncate max-w-[120px] text-right">{yearsDisplay}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">Stock</span>
                    {product.isSet ? (
                      <span className="font-medium text-purple-600">Derived from items</span>
                    ) : (
                      <span className={`font-semibold ${product.stock > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {product.stock || 0}
                      </span>
                    )}
                  </div>
                  {product.isSet && (
                    <div className="text-xs text-gray-600">
                      <p className="text-gray-500 mb-1">Includes</p>
                      <ul className="space-y-1">
                        {(product.setItems || []).map(item => {
                          const itemName = item?.product?.name || item?.productNameSnapshot || 'Unknown';
                          const itemQty = item?.quantity || 1;
                          return (
                            <li key={`${product._id}-${item?.product?._id || item?.product || itemName}`} className="flex items-center gap-2">
                              <span className="inline-flex items-center justify-center w-5 h-5 bg-purple-100 text-purple-700 rounded-full text-[10px] font-semibold">
                                {itemQty}
                              </span>
                              <span className="text-gray-700 truncate text-xs">{itemName}</span>
                            </li>
                          );
                        })}
                        {(product.setItems || []).length === 0 && (
                          <li className="text-[11px] text-gray-400">No items linked</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="px-4 pb-4 pt-0 flex gap-2">
                  <button
                    onClick={() => handleViewDetails(product)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors font-medium text-xs"
                  >
                    <Eye size={16} />
                    View
                  </button>
                  <button
                    onClick={() => handleDelete(product._id, product.name)}
                    className="px-3 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  <th className="px-6 py-4">Product</th>
                  <th className="px-6 py-4">Course</th>
                  <th className="px-6 py-4">Years</th>
                  <th className="px-6 py-4">Price</th>
                  <th className="px-6 py-4">Stock</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                {filteredProducts.map(product => {
                  const productYears = product.years || (product.year ? [product.year] : []);
                  const yearsDisplay = productYears.length === 0 
                    ? 'All Years' 
                    : productYears.sort((a, b) => a - b).map(y => `Year ${y}`).join(', ');

                  return (
                    <tr key={product._id} className="hover:bg-blue-50/40 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-gray-900">{product.name}</span>
                          {product.description && (
                            <span className="text-xs text-gray-500 line-clamp-1">{product.description}</span>
                          )}
            </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{product.forCourse || 'All'}</td>
                      <td className="px-6 py-4 text-gray-600">{yearsDisplay}</td>
                      <td className="px-6 py-4 font-semibold text-gray-900">₹{product.price?.toFixed(2) || '0.00'}</td>
                      <td className="px-6 py-4">
                        {product.isSet ? (
                          <span className="text-sm font-medium text-purple-600">Derived</span>
                        ) : (
                          <span className={`font-semibold ${product.stock > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {product.stock || 0}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {product.isSet ? (
                          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-xs font-semibold">
                            Set
                            <span className="font-medium text-purple-500">{product.setItems?.length || 0} items</span>
                          </span>
                        ) : (
                          <span className="inline-flex px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-semibold">Single</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
              <button
                            onClick={() => handleViewDetails(product)}
                            className="inline-flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
              >
                            <Eye size={16} />
                            View
              </button>
                          <button
                            onClick={() => handleDelete(product._id, product.name)}
                            className="inline-flex items-center justify-center p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
          </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
      </div>
        </div>
      )}

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
                      formData.isSet ? (
                        <p className="text-xs text-gray-600 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2">
                          Set availability is managed by its component items. Update individual item stock from the stock management tab.
                        </p>
                      ) : (
                        <input
                          type="number"
                          name="stock"
                          value={formData.stock}
                          onChange={handleFormChange}
                          min="0"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="0"
                        />
                      )
                    ) : (
                      selectedProduct.isSet ? (
                        <p className="text-xs text-gray-600 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2">
                          Derived from component items
                        </p>
                      ) : (
                        <p className="text-gray-700 bg-gray-50 p-2 rounded-lg">{selectedProduct.stock || 0}</p>
                      )
                    )}
                  </div>

                  {/* Low Stock Threshold */}
                  {!formData.isSet && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Low Stock Threshold</label>
                      {isEditing ? (
                        <input
                          type="number"
                          name="lowStockThreshold"
                          value={formData.lowStockThreshold}
                          onChange={handleFormChange}
                          min="0"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          placeholder="e.g. 10"
                        />
                      ) : (
                        <p className="text-gray-700 bg-gray-50 p-2 rounded-lg">{selectedProduct.lowStockThreshold ?? 0}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                  {/* Set Composition */}
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2">
                        <Layers size={18} className="text-purple-600" />
                        <h3 className="text-sm font-semibold text-purple-700">Set Composition</h3>
                      </div>
                      {isEditing ? (
                        <label className="flex items-center gap-2 text-xs font-medium text-purple-700">
                          <input
                            type="checkbox"
                            checked={formData.isSet}
                            onChange={(e) => handleSetToggle(e.target.checked)}
                            className="rounded border-purple-300 text-purple-600 focus:ring-purple-500"
                          />
                          Treat as Set
                        </label>
                      ) : (
                        <span className={`text-xs font-semibold ${selectedProduct.isSet ? 'text-purple-700' : 'text-gray-500'}`}>
                          {selectedProduct.isSet ? 'Set Product' : 'Single Product'}
                        </span>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="space-y-4">
                        <p className="text-xs text-purple-700">
                          Link existing products to create a bundled kit. The set price you configure above overrides individual item prices.
                        </p>

                        {formData.isSet && (
                          <>
                            <div className="flex flex-col md:flex-row gap-3">
                              <select
                                className="flex-1 px-3 py-2 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white text-sm"
                                value={setItemToAdd}
                                onChange={(e) => setSetItemToAdd(e.target.value)}
                              >
                                <option value="">Select product to include</option>
                                {availableSetProducts.map(p => (
                                  <option key={p._id} value={p._id}>{p.name}</option>
                                ))}
                              </select>
                              <button
                                onClick={handleAddSetItem}
                                type="button"
                                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
                              >
                                <Plus size={16} />
                                Add Item
                              </button>
                            </div>
                            {availableSetProducts.length === 0 && (
                              <p className="text-xs text-purple-600 bg-purple-100/60 px-3 py-2 rounded-lg">
                                Create individual products first to build sets.
                              </p>
                            )}
                          </>
                        )}

                        {formData.isSet && (
                          <div className="space-y-3">
                            {(formData.setItems || []).map(item => {
                              const name = resolveProductName(item.productId, item.productName);
                              return (
                                <div
                                  key={item.productId}
                                  className="bg-white border border-purple-200 rounded-lg p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3 shadow-sm"
                                >
                                  <div>
                                    <p className="font-medium text-gray-800 text-sm">{name}</p>
                                    <p className="text-xs text-gray-500">Qty inside kit</p>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <input
                                      type="number"
                                      min="1"
                                      value={item.quantity}
                                      onChange={(e) => handleSetItemQuantityChange(item.productId, e.target.value)}
                                      className="w-20 px-3 py-2 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveSetItem(item.productId)}
                                      className="inline-flex items-center gap-1 text-sm text-purple-600 hover:text-purple-800"
                                    >
                                      <MinusCircle size={16} />
                                      Remove
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                            {(formData.setItems || []).length === 0 && (
                              <p className="text-xs text-purple-600 bg-purple-100/60 px-3 py-2 rounded-lg">
                                No items selected yet.
                              </p>
                            )}
                          </div>
                        )}
                        {!formData.isSet && (
                          <p className="text-xs text-gray-600 bg-white border border-purple-100 rounded-lg px-3 py-2">
                            Keep this unchecked for standalone items. Toggle to bundle existing products.
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {selectedProduct.isSet ? (
                          <ul className="space-y-2">
                            {(selectedProduct.setItems || []).map(item => {
                              const name = resolveProductName(item?.product?._id || item?.product, item?.productNameSnapshot);
                              const price = resolveProductPrice(item?.product?._id || item?.product, item?.productPriceSnapshot);
                              return (
                                <li key={`${selectedProduct._id}-${item?.product?._id || item?.product || name}`} className="bg-white border border-purple-200 rounded-lg px-3 py-2">
                                  <div className="flex items-center justify-between text-sm text-gray-700">
                                    <span>{name}</span>
                                    <span className="font-semibold">Qty: {item?.quantity || 1}</span>
                                  </div>
                                  <p className="text-xs text-gray-500 mt-1">₹{Number(price).toFixed(2)} each</p>
                                </li>
                              );
                            })}
                            {(selectedProduct.setItems || []).length === 0 && (
                              <li className="text-xs text-gray-500">No items linked yet.</li>
                            )}
                          </ul>
                        ) : (
                          <p className="text-xs text-gray-600">This product is not configured as a set.</p>
                        )}
                      </div>
                    )}
                  </div>

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
            <div className="p-6 flex-1 overflow-y-auto bg-gradient-to-br from-gray-50 via-white to-gray-100">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-6">
                  {error}
                </div>
              )}

              <div className="max-w-4xl mx-auto space-y-4">
                <section className="bg-white/90 backdrop-blur border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-900">Select Product Type</h3>
                    <p className="text-sm text-gray-500">Choose whether you’re adding a single item or bundling existing products into a set.</p>
                  </div>
                  <div className="px-5 py-4 grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => handleProductTypeSelect('single')}
                      className={`text-left p-4 rounded-xl border transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${productType === 'single' ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-gray-200 bg-white hover:border-blue-300'}`}
                    >
                      <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 text-blue-600 mb-4">
                        <Package size={20} />
                      </span>
                      <h4 className="text-base font-semibold text-gray-900">Single Product</h4>
                      <p className="mt-1 text-sm text-gray-600">Add a standalone item with pricing that applies per unit.</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleProductTypeSelect('set')}
                      className={`text-left p-5 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-purple-500 ${productType === 'set' ? 'border-purple-500 bg-purple-50 shadow-sm' : 'border-gray-200 bg-white hover:border-purple-300'}`}
                    >
                      <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-purple-100 text-purple-600 mb-4">
                        <Layers size={20} />
                      </span>
                      <h4 className="text-base font-semibold text-gray-900">Set / Kit</h4>
                      <p className="mt-1 text-sm text-gray-600">Bundle multiple existing products together with a combined price.</p>
                    </button>
                  </div>
                </section>

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
                  <div className="space-y-4">
                    <section className="bg-white/90 backdrop-blur border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                      <div className="px-5 py-4 border-b border-gray-100">
                        <h3 className="text-lg font-semibold text-gray-900">General Details</h3>
                        <p className="text-sm text-gray-500">Give your product a recognizable name and description.</p>
                      </div>
                      <div className="px-5 py-4 space-y-4">
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
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
                            placeholder="e.g. B.Tech 1st Year Starter Kit"
                    />
                  </div>
                  <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-semibold text-gray-700">Description</label>
                            <span className="text-xs text-gray-500">{formData.description.length}/250</span>
                          </div>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleFormChange}
                      maxLength={250}
                      rows={3}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none shadow-sm"
                            placeholder="Share a short overview of what this product or kit includes..."
                    />
                  </div>
                      </div>
                    </section>

                    <section className="bg-white/90 backdrop-blur border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                      <div className="px-5 py-4 border-b border-gray-100 flex flex-col gap-1">
                        <h3 className="text-lg font-semibold text-gray-900">Pricing & Notes</h3>
                        <p className="text-sm text-gray-500">Set the selling price and capture any internal notes.</p>
                      </div>
                      <div className="px-5 py-4 grid gap-4 md:grid-cols-2">
                        <div className="md:col-span-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600">
                              <DollarSign size={18} />
                            </span>
                            <div>
                              <p className="text-sm font-semibold text-gray-700">Price</p>
                              <p className="text-xs text-gray-500">Required • visible to students</p>
                            </div>
                    </div>
                    <input
                      type="number"
                      name="price"
                      value={formData.price}
                      onChange={handleFormChange}
                      min="0"
                      step="0.01"
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
                      placeholder="0.00"
                      required
                    />
                  </div>
                        {!formData.isSet && (
                          <div className="md:col-span-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-600">
                                <Package size={18} />
                              </span>
                              <div>
                                <p className="text-sm font-semibold text-gray-700">Low Stock Threshold</p>
                                <p className="text-xs text-gray-500">Trigger low-stock alerts below this quantity</p>
                              </div>
                            </div>
                            <input
                              type="number"
                              name="lowStockThreshold"
                              value={formData.lowStockThreshold}
                              onChange={handleFormChange}
                              min="0"
                              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm"
                              placeholder="e.g. 10"
                            />
                          </div>
                        )}
                        <div className="md:col-span-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-yellow-100 text-yellow-600">
                              <FileText size={18} />
                            </span>
                            <div>
                              <p className="text-sm font-semibold text-gray-700">Remarks</p>
                              <p className="text-xs text-gray-500">Optional • internal only</p>
                            </div>
                    </div>
                    <textarea
                      name="remarks"
                      value={formData.remarks}
                      onChange={handleFormChange}
                      rows={3}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent resize-none shadow-sm"
                            placeholder="Add internal admin notes, procurement details, etc."
                    />
                  </div>
                </div>
                    </section>

                    {formData.isSet && (
                      <section className="bg-white/90 backdrop-blur border border-purple-200 rounded-xl shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-purple-100 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-purple-100 text-purple-600">
                              <Layers size={18} />
                            </span>
                            <div>
                              <h3 className="text-lg font-semibold text-purple-800">Set Composition</h3>
                              <p className="text-sm text-purple-500">Bundle existing products into curated kits.</p>
                            </div>
                          </div>
                        </div>

                        <div className="px-5 py-4 space-y-4">
                          <p className="text-sm text-purple-600 bg-purple-50 border border-purple-100 rounded-lg px-4 py-3">
                            Select ready-to-sell products from your catalog, then adjust quantities to build the perfect kit.
                          </p>
                          <div className="flex flex-col gap-2.5 lg:flex-row">
                            <select
                              className="flex-1 px-4 py-2.5 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white text-sm shadow-sm"
                              value={setItemToAdd}
                              onChange={(e) => setSetItemToAdd(e.target.value)}
                            >
                              <option value="">Select product to include</option>
                              {availableSetProducts.map(p => (
                                <option key={p._id} value={p._id}>{p.name}</option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={handleAddSetItem}
                              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm shadow-sm"
                            >
                              <Plus size={16} />
                              Add Item
                            </button>
                          </div>
                          {availableSetProducts.length === 0 && (
                            <p className="text-xs text-purple-600 bg-purple-100/60 px-4 py-2 rounded-lg">
                              Create individual products first to build sets.
                            </p>
                          )}
                          <div className="space-y-2.5">
                            {(formData.setItems || []).map(item => {
                              const name = resolveProductName(item.productId, item.productName);
                              const price = resolveProductPrice(item.productId, 0);
                              return (
                                <div
                                  key={`new-${item.productId}`}
                                  className="bg-white border border-purple-100 rounded-lg p-3.5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3.5 shadow-sm"
                                >
                                  <div className="min-w-0">
                                    <p className="font-semibold text-gray-900 text-sm">{name}</p>
                                    <p className="text-xs text-gray-500">Current price: ₹{Number(price).toFixed(2)}</p>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <input
                                      type="number"
                                      min="1"
                                      value={item.quantity}
                                      onChange={(e) => handleSetItemQuantityChange(item.productId, e.target.value)}
                                      className="w-20 px-3 py-2 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveSetItem(item.productId)}
                                      className="inline-flex items-center gap-1 text-sm text-purple-600 hover:text-purple-800"
                                    >
                                      <MinusCircle size={16} />
                                      Remove
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                            {(formData.setItems || []).length === 0 && (
                              <p className="text-xs text-purple-600 bg-purple-100/60 px-4 py-2.5 rounded-lg text-center">
                                No items selected yet. Add products to build your set.
                              </p>
                            )}
                          </div>
                        </div>
                      </section>
                    )}

                    <section className="bg-white/90 backdrop-blur border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                      <div className="px-5 py-4 border-b border-gray-100">
                        <h3 className="text-lg font-semibold text-gray-900">Applicability</h3>
                        <p className="text-sm text-gray-500">Control which courses and academic years can see this product.</p>
                      </div>
                      <div className="px-5 py-4 space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Course</label>
                      <select
                        name="forCourse"
                        value={formData.forCourse}
                        onChange={handleFormChange}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
                      >
                        <option value="">All Courses</option>
                        {(config?.courses || []).map(c => (
                          <option key={c.name} value={c.name}>{c.displayName}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Years</label>
                          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3.5">
                            <div className="flex flex-wrap gap-2.5">
                          {(config?.courses?.find(c => c.name === formData.forCourse)?.years || []).map(y => {
                            const isChecked = (formData.years || []).includes(y);
                            return (
                              <label
                                key={y}
                                    className={`flex items-center gap-2 px-3.5 py-1.5 border-2 rounded-lg cursor-pointer transition-all ${isChecked ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300'}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleYearToggle(y)}
                                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                                    <span className="font-medium text-sm">Year {y}</span>
                              </label>
                            );
                          })}
                          {(config?.courses?.find(c => c.name === formData.forCourse)?.years || []).length === 0 && (
                                <p className="text-sm text-gray-500">Select a course to see available years.</p>
                          )}
                        </div>
                        {(formData.years || []).length === 0 && (
                              <p className="text-xs text-gray-500 mt-2">No years selected — the product will be visible to all years.</p>
                        )}
                      </div>
                    </div>
                  </div>
                    </section>
                </div>

                  <aside className="space-y-4">
                    <div className="bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 text-white rounded-xl p-5 shadow-lg">
                      <p className="text-xs uppercase tracking-wide text-blue-100 font-semibold">Quick Preview</p>
                      <h3 className="mt-2 text-xl font-bold">{formData.name || 'Untitled Product'}</h3>
                      <p className="mt-2 text-xs text-blue-100 leading-relaxed">
                        {formData.description || 'Add a description to help admins recognize this product instantly.'}
                      </p>
                      <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <p className="text-blue-100">Price</p>
                          <p className="text-base font-semibold">₹{Number(formData.price || 0).toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-blue-100">Type</p>
                          <p className="text-base font-semibold">{formData.isSet ? 'Set Product' : 'Single Item'}</p>
                        </div>
                        <div>
                          <p className="text-blue-100">Course</p>
                          <p className="text-sm font-semibold">{formData.forCourse || 'All Courses'}</p>
                        </div>
                        <div>
                          <p className="text-blue-100">Years</p>
                          <p className="text-sm font-semibold">{(formData.years || []).length > 0 ? formData.years.sort((a,b) => a - b).map(y => `Y${y}`).join(', ') : 'All Years'}</p>
                        </div>
                        {!formData.isSet && (
                          <div className="col-span-2">
                            <p className="text-blue-100">Low Stock Threshold</p>
                            <p className="text-sm font-semibold">{Number(formData.lowStockThreshold || 0)}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-white/90 backdrop-blur border border-gray-200 rounded-xl p-5 shadow-sm">
                      <h4 className="text-sm font-semibold text-gray-900 mb-2">Set Summary</h4>
                      {formData.isSet ? (
                        <ul className="space-y-3">
                          {(formData.setItems || []).map(item => {
                            const name = resolveProductName(item.productId, item.productName);
                            return (
                              <li key={`summary-${item.productId}`} className="flex items-center justify-between text-sm text-gray-700">
                                <div className="flex flex-col">
                                  <span className="font-medium text-gray-900">{name}</span>
                                  <span className="text-xs text-gray-500">Qty: {item.quantity}</span>
                                </div>
                                <span className="text-xs text-gray-400">#{String(item.productId || '').slice(-4) || '----'}</span>
                              </li>
                            );
                          })}
                          {(formData.setItems || []).length === 0 && (
                            <li className="text-xs text-gray-500">No items selected yet.</li>
                          )}
                        </ul>
                      ) : (
                        <p className="text-xs text-gray-500">Toggle "Create as Set" to bundle existing products.</p>
                      )}
                    </div>

                    <div className="bg-white/90 backdrop-blur border border-gray-200 rounded-xl p-5 shadow-sm">
                      <h4 className="text-sm font-semibold text-gray-900 mb-2">Launch Checklist</h4>
                      <ul className="space-y-1.5 text-xs text-gray-600">
                        <li className={`${formData.name ? 'text-green-600 font-semibold' : ''}`}>• Product name {formData.name ? 'added' : 'missing'}</li>
                        <li className={`${formData.price ? 'text-green-600 font-semibold' : ''}`}>• Price {formData.price ? 'configured' : 'not set'}</li>
                        <li className={`${!formData.isSet || (formData.setItems || []).length > 0 ? 'text-green-600 font-semibold' : ''}`}>
                          • {formData.isSet ? 'Set composition ready' : 'Single product'}
                        </li>
                      </ul>
                    </div>
                  </aside>
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

