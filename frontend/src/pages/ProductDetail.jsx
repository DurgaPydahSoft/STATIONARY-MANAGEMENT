import { useState, useEffect } from 'react';
import { X, Save, Edit, Calendar, DollarSign, FileText, Plus } from 'lucide-react';
import { apiUrl } from '../utils/api';

const ProductDetail = ({ product, onClose, onUpdate, onCreate, defaultCourse, defaultYear, config }) => {
  const isCreateMode = !product;
  const [isEditing, setIsEditing] = useState(isCreateMode); // Start in edit mode for create
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 0,
    stock: 0,
    remarks: '',
    forCourse: defaultCourse || '',
    years: [],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (product) {
      // Support both years array (new) and year number (old)
      const productYears = product.years || (product.year ? [product.year] : []);
      setFormData({
        name: product.name || '',
        description: product.description || '',
        price: product.price || 0,
        stock: product.stock || 0,
        remarks: product.remarks || '',
        forCourse: product.forCourse || '',
        years: productYears,
      });
    } else {
      // Reset form for create mode
      setFormData({
        name: '',
        description: '',
        price: 0,
        stock: 0,
        remarks: '',
        forCourse: defaultCourse || '',
        years: defaultYear ? [Number(defaultYear)] : [],
      });
    }
  }, [product, defaultCourse, defaultYear]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => {
      const newData = {
        ...prev,
        [name]: name === 'description' 
          ? value.slice(0, 250) 
          : (name === 'price' || name === 'stock') 
            ? (value === '' ? 0 : Number(value)) 
            : value, // Limit description to 250 chars, convert numbers
      };
      // If course changes, reset years to empty array (All Years)
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
        // Remove year
        newYears = currentYears.filter(y => y !== yearNum);
      } else {
        // Add year
        newYears = [...currentYears, yearNum].sort((a, b) => a - b);
      }
      
      return {
        ...prev,
        years: newYears
      };
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');

      // Validation
      if (!formData.name.trim()) {
        setError('Product name is required');
        setSaving(false);
        return;
      }

      if (isCreateMode) {
        // Create new product
        const response = await fetch(apiUrl('/api/products'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...formData,
            forCourse: formData.forCourse || undefined,
            years: formData.years || [],
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to create product');
        }

        const created = await response.json();
        if (onCreate) {
          onCreate(created);
        }
        onClose();
      } else {
        // Update existing product
        const response = await fetch(apiUrl(`/api/products/${product._id}`), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to update product');
        }

        const updated = await response.json();
        if (onUpdate) {
          onUpdate(updated);
        }
        setIsEditing(false);
      }
    } catch (err) {
      setError(err.message || `Failed to ${isCreateMode ? 'create' : 'save'} product`);
      console.error(`Error ${isCreateMode ? 'creating' : 'updating'} product:`, err);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/30">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl m-4 overflow-hidden flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 flex items-center justify-between rounded-t-xl flex-shrink-0">
          <div>
            <h2 className="text-2xl font-bold">
              {isCreateMode ? 'Add New Product' : 'Product Details'}
            </h2>
            <p className="text-blue-100 text-sm mt-1">
              {isCreateMode ? 'Fill in all product information' : 'View and edit product information'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors text-white hover:text-white"
            title="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 overflow-y-auto">
          {/* Error Message - Full Width */}
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
                {isEditing || isCreateMode ? (
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter product name..."
                  />
                ) : (
                  <p className="text-gray-900 font-medium text-lg">{product.name}</p>
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
                {(isEditing || isCreateMode) ? (
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    maxLength={250}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    placeholder="Enter product description (max 250 characters)..."
                  />
                ) : (
                  <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">
                    {product.description || 'No description provided'}
                  </p>
                )}
              </div>

              {/* Price Section */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign size={18} className="text-blue-600" />
                  <label className="block text-sm font-semibold text-gray-700">Price</label>
                </div>
                {(isEditing || isCreateMode) ? (
                  <div>
                    <input
                      type="number"
                      name="price"
                      value={formData.price}
                      onChange={handleChange}
                      min="0"
                      step="0.01"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-2"
                      placeholder="0.00"
                    />
                  </div>
                ) : (
                  <div>
                    <p className="text-2xl font-bold text-blue-700 mb-2">
                      ₹{product.price?.toFixed(2) || '0.00'}
                    </p>
                  </div>
                )}
                
                {/* Last Updated Date - Only show for existing products */}
                {!isCreateMode && product.lastPriceUpdated && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 mt-2">
                    <Calendar size={14} />
                    <span className="font-medium">Last Updated:</span>
                    <span>{formatDate(product.lastPriceUpdated)}</span>
                  </div>
                )}
              </div>

              {/* Stock */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Stock</label>
                {(isEditing || isCreateMode) ? (
                  <input
                    type="number"
                    name="stock"
                    value={formData.stock}
                    onChange={handleChange}
                    min="0"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0"
                  />
                ) : (
                  <p className="text-gray-700 bg-gray-50 p-2 rounded-lg">{product.stock || 0}</p>
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
                {(isEditing || isCreateMode) ? (
                  <textarea
                    name="remarks"
                    value={formData.remarks}
                    onChange={handleChange}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent resize-none"
                    placeholder="Enter internal notes (e.g., damaged stock, limited quantity, supplier issue)..."
                  />
                ) : (
                  <p className="text-gray-700">
                    {product.remarks || 'No remarks available'}
                  </p>
                )}
              </div>

              {/* Course/Year - Editable in create/edit mode */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Product Applicability</h3>
                
                {/* Course */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Course</label>
                  {(isEditing || isCreateMode) ? (
                    <select
                      name="forCourse"
                      value={formData.forCourse}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">All Courses</option>
                      {(config?.courses || []).map(c => (
                        <option key={c.name} value={c.name}>{c.displayName}</option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-gray-700 bg-gray-50 p-2 rounded-lg">{product.forCourse || 'All Courses'}</p>
                  )}
                </div>

                {/* Years */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Years</label>
                  {(isEditing || isCreateMode) ? (
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
                        const productYears = product.years || (product.year ? [product.year] : []);
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
          {isCreateMode ? (
            <>
              <button
                onClick={onClose}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formData.name.trim()}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus size={16} />
                {saving ? 'Creating...' : 'Create Product'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <Edit size={16} />
                {isEditing ? 'Cancel Edit' : 'Edit Product'}
              </button>
              {isEditing && (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save size={16} />
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;

