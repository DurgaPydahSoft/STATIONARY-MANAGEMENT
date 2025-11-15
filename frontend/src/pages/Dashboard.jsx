import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, GraduationCap, Package, ShoppingCart, DollarSign, 
  TrendingUp, AlertCircle, Activity, Calendar, ArrowRight,
  CreditCard, Wallet, TrendingDown, FileText, BarChart3, Lock
} from 'lucide-react';
import { apiUrl } from '../utils/api';

const Dashboard = () => {
  // Get current user from localStorage
  const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
  const isSuperAdmin = currentUser?.role === 'Administrator';
  const permissions = currentUser?.permissions || [];
  const hasStudentDashboardPermission = isSuperAdmin || permissions.includes('student-dashboard') || permissions.includes('course-dashboard');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalStudents: 0,
    paidStudents: 0,
    unpaidStudents: 0,
    totalTransactions: 0,
    totalRevenue: 0,
    pendingRevenue: 0,
    totalProducts: 0,
    totalStockValue: 0,
    lowStockItems: 0,
    totalVendors: 0,
    todayTransactions: 0,
    todayRevenue: 0,
  });
  const [recentTransactions, setRecentTransactions] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      try {
        // Fetch all data in parallel
        const [
          studentsRes,
          transactionsRes,
          productsRes,
          vendorsRes,
          stockEntriesRes
        ] = await Promise.all([
          fetch(apiUrl('/api/users')),
          fetch(apiUrl('/api/transactions')),
          fetch(apiUrl('/api/products')),
          fetch(apiUrl('/api/vendors')),
          fetch(apiUrl('/api/stock-entries'))
        ]);

        // Process students
        let totalStudents = 0;
        let paidStudents = 0;
        let unpaidStudents = 0;
        if (studentsRes.ok) {
          const students = await studentsRes.json();
          totalStudents = students.length;
          students.forEach(student => {
            if (student.paid) paidStudents += 1;
            else unpaidStudents += 1;
          });
        }

        // Process transactions
        let totalTransactions = 0;
        let totalRevenue = 0;
        let pendingRevenue = 0;
        let todayTransactions = 0;
        let todayRevenue = 0;
        const recent = [];
        if (transactionsRes.ok) {
          const transactions = await transactionsRes.json();
          totalTransactions = transactions.length;
          
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          transactions.forEach(transaction => {
            // Exclude branch transfers from revenue calculations (internal stock movements)
            const isBranchTransfer = transaction.transactionType === 'branch_transfer';
            
            if (!isBranchTransfer) {
              if (transaction.isPaid) {
                totalRevenue += transaction.totalAmount || 0;
              } else {
                pendingRevenue += transaction.totalAmount || 0;
              }

              const transDate = new Date(transaction.transactionDate);
              if (transDate >= today) {
                todayTransactions++;
                if (transaction.isPaid) {
                  todayRevenue += transaction.totalAmount || 0;
                }
              }
            }

            // Get recent 5 transactions (including branch transfers for display)
            if (recent.length < 5) {
              recent.push(transaction);
            }
          });
          
          recent.sort((a, b) => new Date(b.transactionDate) - new Date(a.transactionDate));
          setRecentTransactions(recent.slice(0, 5));
        }

        // Process products
        let totalProducts = 0;
        let totalStockValue = 0;
        let lowStockItems = 0;
        if (productsRes.ok) {
          const products = await productsRes.json();
          totalProducts = products.length;
          products.forEach(product => {
            const stockValue = (product.stock || 0) * (product.price || 0);
            totalStockValue += stockValue;
            const threshold = typeof product.lowStockThreshold === 'number' ? product.lowStockThreshold : 10;
            if ((product.stock || 0) < threshold) {
              lowStockItems++;
            }
          });
        }

        // Process vendors
        let totalVendors = 0;
        if (vendorsRes.ok) {
          const vendors = await vendorsRes.json();
          totalVendors = vendors.length;
        }

        setStats({
          totalStudents,
          paidStudents,
          unpaidStudents,
          totalTransactions,
          totalRevenue,
          pendingRevenue,
          totalProducts,
          totalStockValue,
          lowStockItems,
          totalVendors,
          todayTransactions,
          todayRevenue,
        });
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const formatCurrency = (amount) => {
    return `₹${Number(amount || 0).toFixed(2)}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
          <p className="text-gray-600">Welcome to Stationery Management System</p>
        </div>

        {/* Key Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Students */}
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                <Users size={24} />
              </div>
              <TrendingUp size={20} className="opacity-80" />
            </div>
            <div className="text-3xl font-bold mb-1">
              {loading ? (
                <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                stats.totalStudents.toLocaleString()
              )}
            </div>
            <div className="text-blue-100 text-sm font-medium">Total Students</div>
          </div>

          {/* Total Transactions */}
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                <ShoppingCart size={24} />
              </div>
              <Activity size={20} className="opacity-80" />
            </div>
            <div className="text-3xl font-bold mb-1">
              {loading ? (
                <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                stats.totalTransactions.toLocaleString()
              )}
            </div>
            <div className="text-purple-100 text-sm font-medium">Total Transactions</div>
          </div>

          {/* Total Revenue */}
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                <DollarSign size={24} />
              </div>
              <TrendingUp size={20} className="opacity-80" />
            </div>
            <div className="text-3xl font-bold mb-1">
            {loading ? (
                <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
                formatCurrency(stats.totalRevenue)
            )}
            </div>
            <div className="text-green-100 text-sm font-medium">Total Revenue (Paid)</div>
          </div>

          {/* Pending Revenue */}
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                <CreditCard size={24} />
              </div>
              <TrendingDown size={20} className="opacity-80" />
            </div>
            <div className="text-3xl font-bold mb-1">
            {loading ? (
                <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
                formatCurrency(stats.pendingRevenue)
            )}
            </div>
            <div className="text-orange-100 text-sm font-medium">Pending Payments</div>
          </div>
        </div>

        {/* Secondary Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Products */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Package size={24} className="text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {loading ? '...' : stats.totalProducts}
                </div>
                <div className="text-sm text-gray-600">Total Products</div>
              </div>
            </div>
          </div>

          {/* Stock Value */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <BarChart3 size={24} className="text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {loading ? '...' : formatCurrency(stats.totalStockValue)}
                </div>
                <div className="text-sm text-gray-600">Stock Value</div>
              </div>
            </div>
          </div>

          {/* Low Stock Alert */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <AlertCircle size={24} className="text-red-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {loading ? '...' : stats.lowStockItems}
                </div>
                <div className="text-sm text-gray-600">Low Stock Items</div>
              </div>
            </div>
          </div>

          {/* Total Vendors */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <GraduationCap size={24} className="text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {loading ? '...' : stats.totalVendors}
                </div>
                <div className="text-sm text-gray-600">Total Vendors</div>
              </div>
            </div>
          </div>
        </div>

        {/* Today's Performance & Course Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Today's Performance */}
          <div className="bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <Calendar size={20} className="text-white" />
                </div>
                Today's Performance
              </h3>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-white/20 rounded-lg backdrop-blur-sm">
                <div>
                  <p className="text-sm text-teal-100 mb-1">Transactions</p>
                  <p className="text-2xl font-bold text-white">{stats.todayTransactions}</p>
                </div>
                <div className="w-12 h-12 bg-white/30 rounded-lg flex items-center justify-center">
                  <ShoppingCart size={24} className="text-white" />
                </div>
              </div>
              <div className="flex items-center justify-between p-4 bg-white/20 rounded-lg backdrop-blur-sm">
                <div>
                  <p className="text-sm text-teal-100 mb-1">Revenue</p>
                  <p className="text-2xl font-bold text-white">{formatCurrency(stats.todayRevenue)}</p>
                </div>
                <div className="w-12 h-12 bg-white/30 rounded-lg flex items-center justify-center">
                  <DollarSign size={24} className="text-white" />
                </div>
              </div>
            </div>
          </div>

          {/* Student Overview */}
          <div className={`bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl p-6 shadow-lg transition-shadow relative ${!hasStudentDashboardPermission ? 'opacity-60' : 'hover:shadow-xl'}`}>
            {!hasStudentDashboardPermission && (
              <div className="absolute inset-0 bg-gray-900/30 rounded-xl flex items-center justify-center z-10 backdrop-blur-[2px]">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                    <Lock size={24} className="text-white" />
                  </div>
                  <p className="text-white font-semibold text-sm">Locked</p>
                  <p className="text-indigo-100 text-xs">No access permission</p>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <GraduationCap size={20} className="text-white" />
                </div>
                Student Overview
                {!hasStudentDashboardPermission && (
                  <Lock size={16} className="text-white/80" />
                )}
              </h3>
              {hasStudentDashboardPermission && (
                <button
                  onClick={() => navigate('/students-dashboard')}
                  className="text-sm text-white hover:text-indigo-100 font-medium flex items-center gap-1 bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors"
                >
                  View Student Dashboard
                  <ArrowRight size={14} />
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3">
              <div className="flex items-center justify-between p-4 bg-white/20 rounded-lg backdrop-blur-sm">
                <div>
                  <p className="text-sm text-indigo-100">Total Students</p>
                  <p className="text-2xl font-bold text-white">{stats.totalStudents.toLocaleString()}</p>
                </div>
              </div>
              <div className="flex items-center justify-between p-4 bg-white/20 rounded-lg backdrop-blur-sm">
                <div>
                  <p className="text-sm text-indigo-100">Paid Students</p>
                  <p className="text-2xl font-bold text-white">{stats.paidStudents.toLocaleString()}</p>
                </div>
              </div>
              <div className="flex items-center justify-between p-4 bg-white/20 rounded-lg backdrop-blur-sm">
                <div>
                  <p className="text-sm text-indigo-100">Pending Students</p>
                  <p className="text-2xl font-bold text-white">{stats.unpaidStudents.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Transactions & Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Transactions */}
          <div className="bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl shadow-lg hover:shadow-xl transition-shadow">
            <div className="p-6 border-b border-white/20 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <Activity size={20} className="text-white" />
                </div>
                Recent Transactions
              </h3>
              <button
                onClick={() => navigate('/transactions')}
                className="text-sm text-white hover:text-purple-100 font-medium flex items-center gap-1 bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors"
              >
                View All
                <ArrowRight size={14} />
              </button>
            </div>
            <div className="p-6">
              {loading ? (
                <div className="text-center py-8">
                  <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto"></div>
                </div>
              ) : recentTransactions.length > 0 ? (
                <div className="space-y-4">
                  {recentTransactions.map((transaction) => (
                    <div
                      key={transaction._id}
                      className="flex items-center justify-between p-4 bg-white/20 rounded-lg hover:bg-white/30 transition-colors cursor-pointer backdrop-blur-sm"
                      onClick={() => navigate('/transactions')}
                    >
                      <div className="flex-1">
                        <p className="font-semibold text-white">{transaction.student?.name || 'N/A'}</p>
                        <p className="text-sm text-purple-100">
                          {transaction.student?.course?.toUpperCase()} • {formatDate(transaction.transactionDate)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-white">{formatCurrency(transaction.totalAmount)}</p>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          transaction.isPaid
                            ? 'bg-green-400/30 text-green-100 border border-green-300/50'
                            : 'bg-red-400/30 text-red-100 border border-red-300/50'
                        }`}>
                          {transaction.isPaid ? 'Paid' : 'Unpaid'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 text-white/50 mx-auto mb-2" />
                  <p className="text-purple-100">No recent transactions</p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl shadow-lg hover:shadow-xl transition-shadow">
            <div className="p-6 border-b border-white/20">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <Activity size={20} className="text-white" />
                </div>
                Quick Actions
              </h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => navigate('/add-student')}
                  className="flex flex-col items-center justify-center p-4 bg-white/20 rounded-xl hover:bg-white/30 transition-colors group backdrop-blur-sm"
                >
                  <div className="w-10 h-10 bg-white/30 rounded-lg flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <Users size={20} className="text-white" />
                  </div>
                  <span className="text-sm font-medium text-white">Add Student</span>
                </button>
                <button 
                  onClick={() => navigate('/manage-stock')}
                  className="flex flex-col items-center justify-center p-4 bg-white/20 rounded-xl hover:bg-white/30 transition-colors group backdrop-blur-sm"
                >
                  <div className="w-10 h-10 bg-white/30 rounded-lg flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <Package size={20} className="text-white" />
                  </div>
                  <span className="text-sm font-medium text-white">Manage Stock</span>
                </button>
                <button 
                  onClick={() => navigate('/transactions')}
                  className="flex flex-col items-center justify-center p-4 bg-white/20 rounded-xl hover:bg-white/30 transition-colors group backdrop-blur-sm"
                >
                  <div className="w-10 h-10 bg-white/30 rounded-lg flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <ShoppingCart size={20} className="text-white" />
                  </div>
                  <span className="text-sm font-medium text-white">Transactions</span>
                </button>
                <button 
                  onClick={() => navigate('/student-management')}
                  className="flex flex-col items-center justify-center p-4 bg-white/20 rounded-xl hover:bg-white/30 transition-colors group backdrop-blur-sm"
                >
                  <div className="w-10 h-10 bg-white/30 rounded-lg flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <Activity size={20} className="text-white" />
                  </div>
                  <span className="text-sm font-medium text-white">Manage Students</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;