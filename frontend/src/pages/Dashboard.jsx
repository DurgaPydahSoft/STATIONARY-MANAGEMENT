import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, GraduationCap, Package, ShoppingCart, DollarSign, 
  TrendingUp, AlertCircle, Activity, Calendar, ArrowRight,
  CreditCard, Wallet, TrendingDown, FileText, BarChart3
} from 'lucide-react';
import { apiUrl } from '../utils/api';

const Dashboard = () => {
  const [courseStats, setCourseStats] = useState({});
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalStudents: 0,
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
        // Fetch academic config to get courses
        const configRes = await fetch(apiUrl('/api/config/academic'));
        let coursesList = [];
        if (configRes.ok) {
          const configData = await configRes.json();
          coursesList = configData.courses || [];
          setCourses(coursesList);
        }

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
        const courseStatsMap = {};
        if (studentsRes.ok) {
          const students = await studentsRes.json();
          totalStudents = students.length;
          students.forEach(student => {
            const course = student.course;
            courseStatsMap[course] = (courseStatsMap[course] || 0) + 1;
          });
        }
        setCourseStats(courseStatsMap);

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

            // Get recent 5 transactions
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
            if ((product.stock || 0) < 10) {
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

        {/* Today's Performance & Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Today's Performance */}
          <div className="lg:col-span-1 bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Calendar size={20} className="text-blue-600" />
                Today's Performance
              </h3>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Transactions</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.todayTransactions}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <ShoppingCart size={24} className="text-blue-600" />
                </div>
              </div>
              <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Revenue</p>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.todayRevenue)}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <DollarSign size={24} className="text-green-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Activity size={20} className="text-purple-600" />
                Recent Transactions
              </h3>
              <button
                onClick={() => navigate('/transactions')}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
              >
                View All
                <ArrowRight size={14} />
              </button>
            </div>
            <div className="p-6">
                  {loading ? (
                <div className="text-center py-8">
                  <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
                </div>
              ) : recentTransactions.length > 0 ? (
                <div className="space-y-4">
                  {recentTransactions.map((transaction) => (
                    <div
                      key={transaction._id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                      onClick={() => navigate('/transactions')}
                    >
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">{transaction.student?.name || 'N/A'}</p>
                        <p className="text-sm text-gray-600">
                          {transaction.student?.course?.toUpperCase()} • {formatDate(transaction.transactionDate)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">{formatCurrency(transaction.totalAmount)}</p>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          transaction.isPaid
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {transaction.isPaid ? 'Paid' : 'Unpaid'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-600">No recent transactions</p>
                  </div>
                )}
              </div>
            </div>
        </div>

        {/* Course Overview & Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Course Overview */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <GraduationCap size={20} className="text-blue-600" />
                Course Overview
              </h3>
            </div>
            <div className="p-6">
              {courses.length > 0 ? (
                <div className="space-y-3">
                  {courses.map((course) => (
                    <div
                      key={course._id || course.name}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer group"
                      onClick={() => navigate(`/course/${course.name}`)}
                    >
                      <div>
                        <p className="font-semibold text-gray-900">
                          {course.displayName || course.name.toUpperCase()}
                        </p>
                        <p className="text-sm text-gray-600">
                          {courseStats[course.name] || 0} Students
                        </p>
                      </div>
                      <ArrowRight size={18} className="text-gray-400 group-hover:text-blue-600 transition-colors" />
                    </div>
                  ))}
        </div>
      ) : (
                <div className="text-center py-8">
                  <p className="text-gray-600">No courses configured</p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4">
        <button 
          onClick={() => navigate('/add-student')}
                  className="flex flex-col items-center justify-center p-4 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors group"
                >
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <Users size={20} className="text-white" />
                  </div>
                  <span className="text-sm font-medium text-gray-700">Add Student</span>
        </button>
        <button 
                  onClick={() => navigate('/manage-stock')}
                  className="flex flex-col items-center justify-center p-4 bg-green-50 rounded-xl hover:bg-green-100 transition-colors group"
                >
                  <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <Package size={20} className="text-white" />
                  </div>
                  <span className="text-sm font-medium text-gray-700">Manage Stock</span>
        </button>
        <button 
                  onClick={() => navigate('/transactions')}
                  className="flex flex-col items-center justify-center p-4 bg-purple-50 rounded-xl hover:bg-purple-100 transition-colors group"
                >
                  <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <ShoppingCart size={20} className="text-white" />
                  </div>
                  <span className="text-sm font-medium text-gray-700">Transactions</span>
        </button>
                <button 
                  onClick={() => navigate('/student-management')}
                  className="flex flex-col items-center justify-center p-4 bg-orange-50 rounded-xl hover:bg-orange-100 transition-colors group"
                >
                  <div className="w-10 h-10 bg-orange-600 rounded-lg flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <Activity size={20} className="text-white" />
                  </div>
                  <span className="text-sm font-medium text-gray-700">Manage Students</span>
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