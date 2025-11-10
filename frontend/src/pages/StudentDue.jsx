import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Eye, Users, ClipboardList, Building2, AlertCircle, Download } from 'lucide-react';
import { apiUrl } from '../utils/api';

const normalizeValue = (value) => {
  if (!value) return '';
  return String(value).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
};

const getItemKey = (name = '') => String(name).toLowerCase().replace(/\s+/g, '_');

const getProductYears = (product) => {
  if (!product) return [];
  const fromArray = Array.isArray(product.years) ? product.years : [];
  const normalized = fromArray.map(Number).filter(year => !Number.isNaN(year) && year > 0);

  if (normalized.length > 0) {
    return normalized;
  }

  const fallbackYear = Number(product.year);
  if (!Number.isNaN(fallbackYear) && fallbackYear > 0) {
    return [fallbackYear];
  }

  return [];
};

const formatCurrency = (amount = 0) => `₹${Number(amount || 0).toFixed(2)}`;

const StudentDue = () => {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState('');
  const [dueFilters, setDueFilters] = useState({ search: '', course: '', year: '' });

  useEffect(() => {
    fetchStudents();
    fetchProducts();
  }, []);

  const fetchStudents = async () => {
    try {
      const response = await fetch(apiUrl('/api/users'));
      if (response.ok) {
        const data = await response.json();
        setStudents(Array.isArray(data) ? data : []);
        const uniqueCourses = Array.from(new Set((data || []).map(s => s.course))).filter(Boolean);
        setCourses(uniqueCourses);
      }
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      setProductsLoading(true);
      setProductsError('');
      const response = await fetch(apiUrl('/api/products'));
      if (!response.ok) {
        throw new Error('Failed to fetch products');
      }
      const data = await response.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching products:', error);
      setProductsError(error.message || 'Failed to load products');
    } finally {
      setProductsLoading(false);
    }
  };

  const courseOptions = useMemo(() => {
    return [...courses].filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [courses]);

  const yearOptions = useMemo(() => {
    const years = new Set();
    students.forEach(student => {
      const numericYear = Number(student.year);
      if (!Number.isNaN(numericYear) && numericYear > 0) {
        years.add(numericYear);
      }
    });
    return Array.from(years).sort((a, b) => a - b);
  }, [students]);

  const dueStudents = useMemo(() => {
    if (!students.length || !products.length) return [];

    const records = students.map(student => {
      const studentCourse = normalizeValue(student.course);
      const studentYear = Number(student.year);
      const studentBranch = normalizeValue(student.branch);

      const mappedProducts = products.filter(product => {
        const productCourse = normalizeValue(product.forCourse);
        if (!productCourse) return false;
        if (productCourse !== studentCourse) return false;

        const productBranch = normalizeValue(product.branch);
        if (productBranch && productBranch !== studentBranch) return false;

        const productYears = getProductYears(product);
        if (productYears.length > 0 && !productYears.includes(studentYear)) return false;

        return true;
      });

      if (!mappedProducts.length) {
        return null;
      }

      const itemsMap = student.items || {};
      const pendingItems = mappedProducts.filter(product => {
        const key = getItemKey(product.name);
        return !itemsMap[key];
      });

      if (!pendingItems.length) {
        return null;
      }

      const issuedCount = mappedProducts.length - pendingItems.length;
      const mappedValue = mappedProducts.reduce((sum, product) => sum + (Number(product.price) || 0), 0);
      const pendingValue = pendingItems.reduce((sum, product) => sum + (Number(product.price) || 0), 0);
      const issuedValue = Math.max(mappedValue - pendingValue, 0);

      return {
        student,
        mappedProducts,
        pendingItems,
        issuedCount,
        mappedValue,
        pendingValue,
        issuedValue,
      };
    }).filter(Boolean);

    return records.sort((a, b) => {
      const courseCompare = (a.student.course || '').localeCompare(b.student.course || '');
      if (courseCompare !== 0) return courseCompare;

      const yearDifference = Number(a.student.year) - Number(b.student.year);
      if (yearDifference !== 0) return yearDifference;

      return (a.student.name || '').localeCompare(b.student.name || '');
    });
  }, [students, products]);

  const filteredDueStudents = useMemo(() => {
    const searchValue = dueFilters.search.trim().toLowerCase();
    const selectedCourse = normalizeValue(dueFilters.course);
    const selectedYear = Number(dueFilters.year);

    return dueStudents.filter(record => {
      const { student } = record;
      if (selectedCourse && normalizeValue(student.course) !== selectedCourse) return false;
      if (!Number.isNaN(selectedYear) && selectedYear > 0 && Number(student.year) !== selectedYear) return false;

      if (searchValue) {
        const matchesSearch =
          student.name?.toLowerCase().includes(searchValue) ||
          student.studentId?.toLowerCase().includes(searchValue);
        if (!matchesSearch) return false;
      }

      return true;
    });
  }, [dueStudents, dueFilters]);

  const dueStats = useMemo(() => {
    const totalPendingItems = filteredDueStudents.reduce((sum, record) => sum + record.pendingItems.length, 0);
    const totalPendingAmount = filteredDueStudents.reduce((sum, record) => sum + record.pendingValue, 0);
    const impactedCourses = new Set(
      filteredDueStudents.map(record => (record.student.course || '').toUpperCase())
    );

    return {
      totalStudents: filteredDueStudents.length,
      totalPendingItems,
      totalPendingAmount,
      impactedCourses: impactedCourses.size,
    };
  }, [filteredDueStudents]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <ClipboardList className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Student Due</h1>
              <p className="text-gray-600 mt-1">Track students who still need their mapped stationery items</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-white">Students Pending</p>
                  <p className="text-2xl font-semibold text-white mt-1">{dueStats.totalStudents}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                  <Users size={20} />
                </div>
              </div>
              <p className="text-xs text-white/90 mt-3">Students who still need their mapped items</p>
            </div>

            <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-white">Due Amount</p>
                  <p className="text-2xl font-semibold text-white mt-1">{formatCurrency(dueStats.totalPendingAmount)}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center">
                  <ClipboardList size={20} />
                </div>
              </div>
              <p className="text-xs text-white/90 mt-3">{dueStats.totalPendingItems} pending item(s) to issue</p>
            </div>

            <div className="p-4 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-white">Courses Impacted</p>
                  <p className="text-2xl font-semibold text-white mt-1">{dueStats.impactedCourses}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
                  <Building2 size={20} />
                </div>
              </div>
              <p className="text-xs text-white/90 mt-3">Courses with at least one pending student</p>
            </div>
          </div>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                value={dueFilters.search}
                onChange={(e) => setDueFilters({ ...dueFilters, search: e.target.value })}
                placeholder="Search by student name or ID"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              <select
                value={dueFilters.course}
                onChange={(e) => setDueFilters({ ...dueFilters, course: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Courses</option>
                {courseOptions.map(course => (
                  <option key={course} value={course}>{course.toUpperCase()}</option>
                ))}
              </select>
              <select
                value={dueFilters.year}
                onChange={(e) => setDueFilters({ ...dueFilters, year: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Years</option>
                {yearOptions.map(year => (
                  <option key={year} value={String(year)}>{`Year ${year}`}</option>
                ))}
              </select>
              <button
                onClick={() => setDueFilters({ search: '', course: '', year: '' })}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Student Due Report</h3>
              <p className="text-sm text-gray-500">Students who have not yet received their mapped items</p>
            </div>
            <span className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
              {filteredDueStudents.length} student{filteredDueStudents.length === 1 ? '' : 's'}
            </span>
          </div>

          {productsLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin mb-4"></div>
              <p className="text-gray-600">Loading mapped items...</p>
            </div>
          ) : productsError ? (
            <div className="p-12 text-center space-y-4">
              <AlertCircle className="mx-auto text-red-500" size={48} />
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-1">Unable to load products</h4>
                <p className="text-gray-600">{productsError}</p>
              </div>
              <button
                onClick={fetchProducts}
                className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <Download size={16} />
                Retry
              </button>
            </div>
          ) : filteredDueStudents.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-6xl mb-4">🎉</div>
              <h4 className="text-xl font-semibold text-gray-900 mb-2">All caught up!</h4>
              <p className="text-gray-600">Every student has received the items mapped to their course and year.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Course / Year</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pending Items</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progress</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Pending Amount</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Pending Count</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredDueStudents.map(record => {
                    const student = record.student;
                    const totalMapped = record.mappedProducts.length;
                    const pendingCount = record.pendingItems.length;
                    const issuedCount = record.issuedCount;
                    const completion = totalMapped > 0 ? Math.round((issuedCount / totalMapped) * 100) : 0;
                    const studentKey = student._id || student.id || student.studentId;

                    return (
                      <tr key={studentKey} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-900">{student.name}</span>
                            <span className="text-xs text-gray-500">{student.studentId}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {student.course?.toUpperCase() || 'N/A'}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">Year {student.year}{student.branch ? ` • ${student.branch}` : ''}</div>
                        </td>
                        <td className="px-6 py-4 max-w-xs">
                          <div className="flex flex-wrap gap-2">
                            {record.pendingItems.slice(0, 3).map(product =>
                              <span key={product._id || product.name} className="px-2 py-1 text-xs bg-rose-100 text-rose-700 rounded-full">
                                {product.name}
                              </span>
                            )}
                            {pendingCount > 3 && (
                              <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
                                +{pendingCount - 3} more
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs text-gray-500">
                              <span>{issuedCount} issued</span>
                              <span>{pendingCount} pending</span>
                            </div>
                            <div className="flex items-center justify-between text-xs text-gray-500">
                              <span>{formatCurrency(record.issuedValue)}</span>
                              <span>{formatCurrency(record.pendingValue)}</span>
                            </div>
                            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-blue-500" style={{ width: `${completion}%` }}></div>
                            </div>
                            <p className="text-xs font-medium text-gray-600">{completion}% complete</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-sm font-semibold text-rose-600">{formatCurrency(record.pendingValue)}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-rose-100 text-rose-700 text-sm font-semibold">
                            {pendingCount}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => navigate(`/student/${student._id || student.id || studentKey}`)}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                          >
                            <Eye size={16} />
                            View Student
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentDue;

