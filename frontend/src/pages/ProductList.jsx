import { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Filter, Package, Eye, Edit, Trash2 } from 'lucide-react';
import { apiUrl } from '../utils/api';
import ProductDetail from './ProductDetail';

const ProductList = ({ itemCategories, addItemCategory, setItemCategories, currentCourse, products = [], setProducts }) => {
  const [selectedCourse, setSelectedCourse] = useState(currentCourse || '');
  const [selectedYear, setSelectedYear] = useState('');
  const [config, setConfig] = useState(null);
  const [statusMsg, setStatusMsg] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showProductDetail, setShowProductDetail] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(apiUrl('/api/config/academic'));
        if (res.ok) {
          const data = await res.json();
          setConfig(data);
          if (!selectedCourse && data.courses?.[0]) {
            setSelectedCourse(data.courses[0].name);
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
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
                <Package className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Product List</h1>
                <p className="text-gray-600 mt-1">Manage stationery products and inventory</p>
              </div>
            </div>
            <button
              onClick={() => setShowAddProduct(true)}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg hover:shadow-xl font-medium"
            >
              <Plus size={20} />
              Add New Product
            </button>
          </div>

          {/* Search and Filters */}
          <div className="bg-white rounded-2xl shadow-md border border-gray-200 p-6">
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
        </div>

        {/* Status Message */}
        {statusMsg && (
          <div className={`mb-6 p-4 rounded-xl text-sm font-medium ${
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
                  className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden hover:shadow-xl transition-all duration-300 group"
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
            <div className="col-span-full bg-white rounded-2xl shadow-md border border-gray-200 p-12 text-center">
              <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No products found</h3>
              <p className="text-gray-600 mb-6">
                {searchQuery || selectedCourse || selectedYear 
                  ? 'Try adjusting your filters' 
                  : 'Get started by adding your first product'}
              </p>
              {!searchQuery && !selectedCourse && !selectedYear && (
                <button
                  onClick={() => setShowAddProduct(true)}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
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
          <ProductDetail
            product={selectedProduct}
            onClose={() => {
              setShowProductDetail(false);
              setSelectedProduct(null);
            }}
            onUpdate={handleProductUpdate}
            config={config}
          />
        )}

        {/* Product Detail Modal - Create New */}
        {showAddProduct && (
          <ProductDetail
            product={null}
            onClose={() => {
              setShowAddProduct(false);
            }}
            onCreate={handleProductCreate}
            defaultCourse={selectedCourse}
            defaultYear={selectedYear}
            config={config}
          />
        )}
      </div>
    </div>
  );
};

export default ProductList;
