import { useState } from 'react';
import { Package, Plus, Building2, Archive, List } from 'lucide-react';
import AddProduct from './stock/AddProduct';
import AddStock from './stock/AddStock';
import VendorManagement from './stock/VendorManagement';
import StockEntries from './stock/StockEntries';

const ManageStock = ({ itemCategories, addItemCategory, setItemCategories, currentCourse, products = [], setProducts }) => {
  const [activeTab, setActiveTab] = useState('products');

  const tabs = [
    { id: 'products', label: 'Add Product', icon: Package },
    { id: 'stock', label: 'Add Stock', icon: Plus },
    { id: 'entries', label: 'Stock Entries', icon: List },
    { id: 'vendors', label: 'Vendor Management', icon: Building2 },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <Archive className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Manage Stock</h1>
              <p className="text-gray-600 mt-1">Manage products, stock entries, and vendors</p>
            </div>
          </div>

          {/* Tabs Navigation */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2">
            <div className="flex gap-2">
              {tabs.map((tab) => {
                const IconComponent = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
                      activeTab === tab.id
                        ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <IconComponent size={18} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          {activeTab === 'products' && (
            <AddProduct
              itemCategories={itemCategories}
              addItemCategory={addItemCategory}
              setItemCategories={setItemCategories}
              currentCourse={currentCourse}
              products={products}
              setProducts={setProducts}
            />
          )}
          {activeTab === 'stock' && (
            <AddStock products={products} setProducts={setProducts} />
          )}
          {activeTab === 'entries' && <StockEntries />}
          {activeTab === 'vendors' && <VendorManagement />}
        </div>
      </div>
    </div>
  );
};

export default ManageStock;

