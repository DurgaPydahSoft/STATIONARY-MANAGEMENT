import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Package, Receipt, History, Calendar, DollarSign, Printer, Lock, Loader2 } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import StudentReceiptModal from './StudentReceipt.jsx';
import { apiUrl } from '../utils/api';

const StudentDetail = ({
  students = [],
  setStudents,
  products = [],
  setProducts,
  onQueueTransaction,
  isOnline,
  pendingTransactions = [],
}) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState(null);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [rawTransactions, setRawTransactions] = useState([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [prefillProducts, setPrefillProducts] = useState([]);
  const [transactionMode, setTransactionMode] = useState('mapped');
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [componentUpdating, setComponentUpdating] = useState('');
  const [componentUpdateStatus, setComponentUpdateStatus] = useState({ type: '', message: '' });

  const normalizeCourse = (value) => {
    if (!value) return '';
    return String(value).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  };

  const refreshProducts = useCallback(async () => {
    if (typeof setProducts !== 'function') return;
    try {
      const res = await fetch(apiUrl('/api/products'));
      if (!res.ok) return;
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.warn('Failed to refresh products after transaction:', error);
    }
  }, [setProducts]);

  useEffect(() => {
    const s = students.find(s => String(s.id) === String(id));
    setStudent(s || null);
    setAvatarFailed(false);
  }, [id, students]);

  const fetchStudentTransactions = useCallback(async () => {
    if (!student || (!student.id && !student._id)) return;

    try {
      setLoadingTransactions(true);
      const studentId = student.id || student._id;
      const response = await fetch(apiUrl(`/api/transactions/student/${studentId}`));
      if (response.ok) {
        const data = await response.json();
        setRawTransactions(data || []);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoadingTransactions(false);
    }
  }, [student]);

  useEffect(() => {
      fetchStudentTransactions();
  }, [fetchStudentTransactions]);

  const currentStudentId = student ? String(student.id || student._id || '') : '';

  useEffect(() => {
    if (isOnline) {
      fetchStudentTransactions();
    }
  }, [isOnline, fetchStudentTransactions]);

  useEffect(() => {
    if (!componentUpdateStatus.message) return;
    const timer = setTimeout(() => setComponentUpdateStatus({ type: '', message: '' }), 4000);
    return () => clearTimeout(timer);
  }, [componentUpdateStatus]);

  // derive visible items for this student's course/year
  const studentCourseNormalized = normalizeCourse(student?.course);
  const avatarUrl = student?.avatarUrl || student?.profileImage || student?.photoUrl || student?.photo || '';

  const visibleItems = (products || []).filter(p => {
    // Course filter: if product has forCourse, it must match student's course
    if (p.forCourse && normalizeCourse(p.forCourse) !== studentCourseNormalized) return false;

    // Year filter: check both years (array) and year (single value) for backward compatibility
    const productYears = p.years || (p.year ? [p.year] : []);

    // If product has specific years defined, student's year must be in that array
    if (productYears.length > 0) {
      if (!productYears.includes(Number(student.year))) return false;
    }
    // If product has no years specified (empty array), it applies to all years (for that course)

    // Branch filter: if product has branches, student's branch must be in the array
    const productBranches = Array.isArray(p.branch) 
      ? p.branch 
      : (p.branch ? [p.branch] : []);
    if (productBranches.length > 0) {
      const studentBranchNormalized = normalizeCourse(student?.branch || '');
      const normalizedProductBranches = productBranches.map(b => normalizeCourse(b));
      if (!normalizedProductBranches.includes(studentBranchNormalized)) return false;
    }
    // If product has no branches specified (empty array), it applies to all branches (for that course)

    return true;
  });

  const isAddOnProduct = (product) => {
    const courseValue = normalizeCourse(product?.forCourse || '');
    return courseValue === '';
  };

  const mappedProducts = visibleItems.filter((product) => !isAddOnProduct(product));
  const addOnProducts = visibleItems.filter(isAddOnProduct);

  const productMap = useMemo(() => {
    const map = new Map();
    (products || []).forEach((product) => {
      map.set(String(product._id), product);
    });
    return map;
  }, [products]);

  const enrichItems = useCallback(
    (items = []) =>
      items.map((item) => {
        const productId =
          item.productId?._id ||
          item.product?._id ||
          item.productId ||
          item?._id;
        const product = productMap.get(String(productId));
        let setComponents = Array.isArray(item.setComponents) ? item.setComponents : [];

        if (product?.isSet) {
          if (setComponents.length > 0) {
            const productComponentMap = new Map(
              (product.setItems || []).map((setItem) => {
                const compId =
                  setItem?.product?._id ||
                  setItem?.productId ||
                  setItem?.product?._id?.toString?.() ||
                  null;
                return [
                  compId ? String(compId) : null,
                  {
                    name:
                      setItem?.product?.name ||
                      setItem?.productNameSnapshot ||
                      'Unknown item',
                    quantity: Number(setItem?.quantity) || 1,
                  },
                ];
              })
            );

            setComponents = setComponents.map((component) => {
              const componentId = String(component.productId || component._id || '');
              const fallback = productComponentMap.get(componentId) || {};
              return {
                ...component,
                productId: component.productId || component._id || null,
                name: component.name || fallback.name || 'Unknown item',
                quantity: Number(component.quantity) || Number(fallback.quantity) || 1,
                taken: component.taken !== undefined ? component.taken : true,
                reason: component.reason || '',
              };
            });
          } else {
            setComponents = (product.setItems || []).map((setItem) => ({
              productId:
                setItem?.product?._id ||
                setItem?.productId ||
                setItem?.product?._id?.toString?.() ||
                null,
              name:
                setItem?.product?.name ||
                setItem?.productNameSnapshot ||
                'Unknown item',
              quantity: Number(setItem?.quantity) || 1,
              taken: true,
              reason: '',
            }));
          }
        }

        return {
          ...item,
          isSet: Boolean(product?.isSet || item.isSet),
          status: item.status || 'fulfilled',
          setComponents,
        };
      }),
    [productMap]
  );

  const enrichTransaction = useCallback(
    (transaction) => ({
      ...transaction,
      items: enrichItems(transaction?.items || []),
    }),
    [enrichItems]
  );

  const handleMarkComponentTaken = useCallback(
    async (transaction, item, component) => {
      if (!isOnline) {
        setComponentUpdateStatus({
          type: 'error',
          message: 'Re-connect to the network before marking items as taken.',
        });
        return;
      }

      const normalizeId = (value) => {
        if (!value) return '';
        if (typeof value === 'string') return value;
        if (value._id) return String(value._id);
        if (value.id) return String(value.id);
        if (typeof value === 'object' && value.toString) return value.toString();
        return String(value);
      };

      const transactionId = transaction._id || transaction.id;
      const itemProductId = normalizeId(item.productId || item._id);
      const targetComponentId = normalizeId(component.productId || component._id);

      if (!transactionId || !itemProductId || !targetComponentId) {
        setComponentUpdateStatus({
          type: 'error',
          message: 'Unable to determine component identifiers for this transaction.',
        });
        return;
      }

      const updateKey = `${transactionId}:${itemProductId}:${targetComponentId}`;
      setComponentUpdating(updateKey);
      setComponentUpdateStatus({ type: '', message: '' });

      try {
        const payloadItems = transaction.items.map((txItem) => {
          const txItemProductId = normalizeId(txItem.productId || txItem._id);
          const baseItem = {
            productId: txItemProductId,
            quantity: Number(txItem.quantity) || 0,
            price: Number(txItem.price) || 0,
            name: txItem.name,
          };

          if (txItem.isSet) {
            baseItem.setComponents = (txItem.setComponents || []).map((comp) => {
              const compId = normalizeId(comp.productId || comp._id || comp.id);
              const isTarget =
                txItemProductId === itemProductId && compId && compId === targetComponentId;
              return {
                productId: compId || undefined,
                name: comp.name,
                quantity: Number(comp.quantity) || 1,
                taken: isTarget ? true : comp.taken !== undefined ? comp.taken : true,
                reason: isTarget ? '' : comp.reason || '',
              };
            });
          }

          return baseItem;
        });

        const response = await fetch(apiUrl(`/api/transactions/${transactionId}`), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: payloadItems,
            paymentMethod: transaction.paymentMethod || 'cash',
            isPaid: Boolean(transaction.isPaid),
            remarks: transaction.remarks || '',
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || 'Failed to update transaction.');
        }

        await fetchStudentTransactions();
        await refreshProducts();
        setComponentUpdateStatus({
          type: 'success',
          message: `${component.name} marked as taken successfully.`,
        });
      } catch (error) {
        console.error('Failed to mark component as taken:', error);
        setComponentUpdateStatus({
          type: 'error',
          message: error.message || 'Unable to mark component as taken.',
        });
      } finally {
        setComponentUpdating('');
      }
    },
    [isOnline, fetchStudentTransactions, refreshProducts]
  );

  const transactions = useMemo(
    () => rawTransactions.map(enrichTransaction),
    [rawTransactions, enrichTransaction]
  );

  const relevantItems = mappedProducts.map((product) => {
    const key = product.name?.toLowerCase().replace(/\s+/g, '_');
    const received = Boolean(student.items && key && student.items[key]);
    return {
      product,
      received,
      key,
    };
  });

  const receivedCount = relevantItems.filter(item => item.received).length;

  const pendingItems = relevantItems.filter(({ received }) => !received);
  const issuedItems = relevantItems.filter(({ received }) => received);

  const handleOpenTransaction = (products = [], mode = 'mapped') => {
    setTransactionMode(mode);
    setPrefillProducts(products);
    setShowTransactionModal(true);
  };

  const pendingTransactionsForStudent = useMemo(() => {
    if (!currentStudentId) return [];
    return (pendingTransactions || [])
      .filter((entry) => String(entry?.payload?.studentId) === currentStudentId)
      .map((entry) => {
        const items = enrichItems(entry?.payload?.items || []);
        const totalAmount = items.reduce((sum, item) => {
          const total = Number(item?.total);
          if (Number.isFinite(total)) return sum + total;
          return sum + Number(item?.price || 0) * Number(item?.quantity || 0);
        }, 0);
        return {
          _id: entry.id,
          transactionId: `PENDING-${entry.id}`,
          transactionDate: entry.createdAt || new Date().toISOString(),
          items,
          totalAmount,
          paymentMethod: entry?.payload?.paymentMethod || 'cash',
          isPaid: Boolean(entry?.payload?.isPaid),
          remarks: entry?.payload?.remarks || '',
          isPending: true,
        };
      });
  }, [pendingTransactions, currentStudentId, enrichItems]);

  useEffect(() => {
    if (!isOnline) return;
    if (pendingTransactionsForStudent.length === 0 && (student?.id || student?._id)) {
      fetchStudentTransactions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingTransactionsForStudent.length, isOnline]);

  const buildSignature = useCallback((transaction) => {
    if (!transaction) return '';
    const items = Array.isArray(transaction.items) ? transaction.items : [];
    const normalizedItems = items
      .map((item) => ({
        name: item?.name || '',
        quantity: Number(item?.quantity) || 0,
        total: Number(item?.total) || Number(item?.price || 0) * Number(item?.quantity || 0) || 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return JSON.stringify({
      totalAmount: Number(transaction?.totalAmount) || 0,
      paymentMethod: transaction?.paymentMethod || '',
      isPaid: Boolean(transaction?.isPaid),
      items: normalizedItems,
    });
  }, []);

  const displayTransactions = useMemo(() => {
    const normalizedSource = Array.isArray(transactions) ? transactions : [];
    const normalized = normalizedSource.map((tx) => ({
      ...tx,
      isPending: Boolean(tx.isPending),
    }));

    const serverSignatures = new Set(normalized.map(buildSignature));
    const uniquePending = pendingTransactionsForStudent.filter((pending) => {
      const signature = buildSignature(pending);
      return !serverSignatures.has(signature);
    });

    return [...uniquePending, ...normalized].sort((a, b) => {
      const dateA = new Date(a?.transactionDate || a?.createdAt || 0).getTime();
      const dateB = new Date(b?.transactionDate || b?.createdAt || 0).getTime();
      return dateB - dateA;
    });
  }, [transactions, pendingTransactionsForStudent, buildSignature]);

  if (!student) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
            <div className="text-6xl mb-4">❓</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Student not found</h2>
            <p className="text-gray-600 mb-6">Either the student doesn't exist or it hasn't loaded yet.</p>
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              onClick={() => navigate(-1)}
            >
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 py-8 px-4">
      <div className="mx-auto space-y-6">
        {/* Header */}
        <header className="bg-gradient-to-r from-blue-700 to-indigo-700 text-white rounded-2xl shadow-xl p-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-white">Student Profile</p>
              <h1 className="text-2xl font-semibold text-white">{student.name}</h1>
              <p className="text-sm text-white/80 mt-1">{student.course?.toUpperCase()} • Year {student.year}{student.branch ? ` • ${student.branch}` : ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 self-end lg:self-center">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-sm font-semibold hover:bg-white/15 transition-colors"
            >
              <ArrowLeft size={16} />
              Back
            </button>
            <button
              onClick={() => handleOpenTransaction(addOnProducts, 'addon')}
              className="flex items-center gap-2 px-5 py-2.5 bg-white text-blue-800 rounded-xl hover:bg-blue-50 transition-all font-semibold shadow-lg"
            >
              <Receipt size={18} />
              Add-On Items
            </button>
          </div>
        </header>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] gap-2">
          {/* Left Sidebar - Student Info */}
          <aside className="bg-white rounded-2xl border border-blue-100 shadow-lg">
            <div className="px-6 py-5 border-b border-blue-50 flex items-center gap-2">
              <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center text-lg font-semibold overflow-hidden border border-blue-200 shadow-sm">
                {avatarUrl && !avatarFailed ? (
                  <img
                    src={avatarUrl}
                    alt={`${student.name} avatar`}
                    className="w-full h-full object-cover"
                    onError={() => setAvatarFailed(true)}
                  />
                ) : (
                  student.name
                    .split(' ')
                    .map(n => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2)
                )}
              </div>
              <div>
                <h3 className="text-sm font-semibold ">Student Snapshot</h3>
                <p className="text-xs text-gray-500">Key academic details</p>
              </div>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1">
                  <p className="  uppercase tracking-wide">Student ID</p>
                  <p className="text-sm font-medium text-gray-500">{student.studentId}</p>
                </div>
                <div className="space-y-1">
                  <p className=" uppercase tracking-wide">Course</p>
                  <p className="text-sm font-medium text-gray-500">{student.course.toUpperCase()}</p>
                </div>
                <div className="space-y-1">
                  <p className=" uppercase tracking-wide">Year</p>
                  <p className="text-sm font-medium text-gray-500">Year {student.year}</p>
                </div>
                {student.branch && (
                  <div className="space-y-1">
                    <p className=" uppercase tracking-wide">Branch</p>
                    <p className="text-sm font-medium text-gray-500">{student.branch}</p>
                  </div>
                )}
              </div>
            </div>
          </aside>

          {/* Main Content Area */}
          <div className="space-y-6">
            {/* Stationery Items Section */}
            <section className="bg-white rounded-2xl border border-blue-100 shadow-lg">
              <div className="px-6 py-5 border-b border-blue-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                    <Package size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">Stationery Items</h3>
                    <p className="text-xs text-gray-500">Mapped kit items and add-ons</p>
                  </div>
                </div>
                <div className="text-xs text-gray-600 flex items-center gap-3">
                  <span>Mapped: {relevantItems.length}</span>
                  <span>Issued: {receivedCount}</span>
                  <span>Pending: {pendingItems.length}</span>
                </div>
              </div>

              <div className="px-6 py-5 space-y-6">
                {relevantItems.length === 0 ? (
                  <div className="text-center py-10 border border-dashed border-slate-200 rounded-xl">
                    <Package className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">No stationery items are configured for this student's course/year yet.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Pending Allocation</h4>
                      {pendingItems.length > 0 && (
                        <button
                          onClick={() => handleOpenTransaction(pendingItems.map(({ product }) => product), 'mapped')}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-500 transition-colors shadow"
                        >
                          <Receipt size={14} />
                          Make Transaction
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {pendingItems.length === 0 ? (
                        <p className="text-sm text-gray-600/70">All mapped items have been issued.</p>
                      ) : (
                        pendingItems.map(({ product }) => (
                          <div
                            key={product._id || product.name}
                            className="p-4 rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <h5 className="text-sm font-semibold text-blue-900 line-clamp-1">{product.name}</h5>
                                {product.description && (
                                  <p className="text-xs text-blue-700/70 mt-1 line-clamp-2">{product.description}</p>
                                )}
                              </div>
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-white px-2 py-1 rounded-full border border-blue-200">
                                Pending
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {issuedItems.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-xs font-semibold text-blue-500 uppercase tracking-wider flex items-center gap-2">
                          <Lock size={12} />
                          Issued Items (Locked)
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {issuedItems.map(({ product }) => (
                            <div
                              key={`${product._id || product.name}-issued`}
                              className="p-4 rounded-xl border border-blue-100 bg-blue-50"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <h5 className="text-sm font-semibold text-blue-800 line-clamp-1">{product.name}</h5>
                                  {product.description && (
                                    <p className="text-xs text-blue-700/70 mt-1 line-clamp-2">{product.description}</p>
                                  )}
                                </div>
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 bg-white px-2 py-1 rounded-full border border-blue-200">
                                  <Lock size={10} /> Locked
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>

            {/* Add-on products are accessible via the top “Add-On Items” button */}

            {/* Transaction History Section */}
            <div className="bg-white rounded-2xl border border-blue-100 shadow-lg p-5">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-blue-50">
                <div className="w-8 h-8 bg-blue-600/10 text-blue-600 rounded-lg flex items-center justify-center">
                  <History className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-gray-800">Transaction History</h3>
                {displayTransactions.length > 0 && (
                  <span className="ml-auto text-xs text-gray-700 bg-blue-100 px-3 py-1 rounded-full">
                    {displayTransactions.length} {displayTransactions.length === 1 ? 'transaction' : 'transactions'}
                  </span>
                )}
              </div>

              {componentUpdateStatus.message && (
                <div
                  className={`mb-4 text-xs font-semibold rounded-lg px-3 py-2 border ${
                    componentUpdateStatus.type === 'success'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}
                >
                  {componentUpdateStatus.message}
                </div>
              )}

              {loadingTransactions ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-5 h-5 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                  <span className="ml-3 text-sm text-blue-600">Loading transactions...</span>
                </div>
              ) : displayTransactions.length === 0 ? (
                <div className="text-center py-12">
                  <History className="w-10 h-10 text-blue-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No transactions found for this student.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {displayTransactions.map((transaction) => {
                    const TransactionPrintComponent = ({ transaction }) => {
                      const transactionRef = useRef(null);
                      const triggerPrint = useReactToPrint({
                        contentRef: transactionRef,
                        documentTitle: `Receipt-${transaction.transactionId}`,
                      });

                      return (
                        <div key={transaction._id}>
                          <div
                            className="border border-gray-200 rounded-lg p-4  hover:bg-blue-50 transition-colors"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                  <span className="text-xs font-semibold text-gray-500 truncate">
                                    {transaction.transactionId}
                                  </span>
                                  {transaction.isPending && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">
                                      Sync Pending
                                    </span>
                                  )}
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${transaction.isPaid
                                      ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                      : 'bg-rose-100 text-rose-700 border border-rose-200'
                                    }`}>
                                    {transaction.isPaid ? 'Paid' : 'Unpaid'}
                                  </span>
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${transaction.paymentMethod === 'cash'
                                      ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                      : 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                                    }`}>
                                    {transaction.paymentMethod === 'cash' ? 'Cash' : 'Online'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-gray-700">
                                  <div className="flex items-center gap-1">
                                    <Calendar size={12} />
                                    <span>
                                      {new Date(transaction.transactionDate || transaction.createdAt || Date.now()).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Package size={12} />
                                    <span>{transaction.items?.length || 0} item{transaction.items?.length !== 1 ? 's' : ''}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="ml-4 flex items-center gap-2">
                                <button
                                  onClick={() => triggerPrint()}
                                  className="px-3 py-1.5 bg-blue-900 text-white hover:bg-blue-800 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors no-print border border-blue-200"
                                  title="Print Receipt"
                                >
                                  <Printer size={14} />
                                  Print
                                </button>
                                <div className="text-right">
                                  <div className="flex items-center gap-1 text-base font-bold text-blue-900">
                                    <DollarSign size={16} />
                                    <span>₹{Number(transaction.totalAmount).toFixed(2)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Transaction Items - Collapsible or compact view */}
                            {transaction.items && transaction.items.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-blue-100 space-y-2">
                                {transaction.items.map((item, idx) => {
                                  const itemProductKey = String(
                                    item.productId?._id ||
                                      item.productId ||
                                      item._id ||
                                      ''
                                  );
                                  return (
                                    <div
                                      key={idx}
                                      className="text-xs text-gray-800 bg-white/70 border border-blue-100 rounded-lg px-3 py-2"
                                    >
                                    <div className="flex items-center justify-between">
                                      <div className="font-medium">{item.name}</div>
                                      <div className="font-semibold">
                                        ×{item.quantity} • ₹{Number(item.total).toFixed(2)}
                                      </div>
                                    </div>
                                    {(item.isSet || item.status === 'partial') && (
                                      <div className="flex items-center justify-between mt-1 text-[11px]">
                                        <span className="text-gray-600 font-medium">
                                          Status:
                                          <span
                                            className={`ml-1 font-semibold ${
                                              item.status === 'partial' ? 'text-amber-600' : 'text-green-600'
                                            }`}
                                          >
                                            {item.status === 'partial' ? 'Partial' : 'Fulfilled'}
                                          </span>
                                      </span>
                                    </div>
                                    )}
                                    {item.isSet && item.setComponents?.length > 0 && (
                                      <div className="mt-1 border-t border-blue-100 pt-1">
                                        <p className="text-[11px] font-semibold text-gray-800 mb-1">
                                          Includes:
                                        </p>
                                        <ul className="space-y-0.5">
                                          {item.setComponents.map((component, componentIdx) => {
                                            const componentProductKey = String(
                                              component.productId ||
                                                component._id ||
                                                ''
                                            );
                                            const actionKey = `${transaction._id || transaction.id}:${itemProductKey}:${componentProductKey}`;
                                            return (
                                              <li
                                                key={`${item.name}-component-inline-${componentIdx}`}
                                                className="flex items-center justify-between text-[11px] text-gray-700 gap-2"
                                              >
                                                <span className="truncate max-w-[200px]">
                                                  {component.name}
                                                </span>
                                                <div className="flex items-center gap-2">
                                                  <span className="font-semibold">
                                                    × {component.quantity}
                                                  </span>
                                                  {component.taken === false && (
                                                    <div className="flex items-center gap-2">
                                                      <span className="uppercase font-semibold text-red-600">
                                                        Not Taken
                                                      </span>
                                                      <button
                                                        type="button"
                                                        onClick={() =>
                                                          handleMarkComponentTaken(
                                                            transaction,
                                                            item,
                                                            component
                                                          )
                                                        }
                                                        disabled={
                                                          !isOnline ||
                                                          componentUpdating === actionKey
                                                        }
                                                        className="px-2 py-1 rounded-md border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                                      >
                                                        {componentUpdating === actionKey ? (
                                                          <Loader2
                                                            size={12}
                                                            className="animate-spin"
                                                          />
                                                        ) : (
                                                          'Mark as Taken'
                                                        )}
                                                      </button>
                                </div>
                                                  )}
                                                </div>
                                              </li>
                                            );
                                          })}
                                        </ul>
                                      </div>
                                    )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Remarks */}
                            {transaction.remarks && (
                              <div className="mt-2 pt-2 border-t border-blue-100">
                                <p className="text-xs text-blue-700">
                                  <span className="font-medium text-blue-900">Remarks:</span> {transaction.remarks}
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Print Content - Hidden on screen, visible when printing */}
                          <div ref={transactionRef} className="hidden print:block">
                            <style>{`
                              @page {
                                size: A4;
                                margin: 20mm;
                              }
                              @media print {
                                body {
                                  margin: 0;
                                  padding: 0;
                                  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                                }
                                .print-header {
                                  border-bottom: 3px solid #1e40af;
                                  padding-bottom: 15px;
                                  margin-bottom: 20px;
                                }
                                .print-content {
                                  margin-top: 20px;
                                }
                                .print-table {
                                  width: 100%;
                                  border-collapse: collapse;
                                  margin: 20px 0;
                                }
                                .print-table th,
                                .print-table td {
                                  padding: 10px;
                                  text-align: left;
                                  border-bottom: 1px solid #e5e7eb;
                                }
                                .print-table th {
                                  background-color: #f3f4f6;
                                  font-weight: 600;
                                  color: #111827;
                                }
                                .print-footer {
                                  margin-top: 30px;
                                  padding-top: 15px;
                                  border-top: 2px solid #1e40af;
                                }
                              }
                            `}</style>
                            <div className="print-header">
                              <div style={{ textAlign: 'center', marginBottom: '10px' }}>
                                <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#1e40af', margin: '0 0 5px 0' }}>
                                  PYDAH GROUP OF INSTITUTIONS
                                </h1>
                                <p style={{ fontSize: '14px', color: '#6b7280', margin: '0' }}>
                                  Stationery Management System
                                </p>
                              </div>
                            </div>

                            <div className="print-content">
                              <div style={{ marginBottom: '20px' }}>
                                <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#111827', marginBottom: '15px' }}>
                                  Transaction Receipt
                                </h2>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', fontSize: '12px', marginBottom: '20px' }}>
                                  <div>
                                    <p style={{ margin: '5px 0' }}><strong>Student Name:</strong> {transaction.student?.name || student.name}</p>
                                    <p style={{ margin: '5px 0' }}><strong>Student ID:</strong> {transaction.student?.studentId || student.studentId}</p>
                                  </div>
                                  <div>
                                    <p style={{ margin: '5px 0' }}><strong>Course:</strong> {transaction.student?.course?.toUpperCase() || student.course.toUpperCase()}</p>
                                    <p style={{ margin: '5px 0' }}><strong>Year:</strong> {transaction.student?.year || student.year}</p>
                                    {/* <p style={{ margin: '5px 0' }}><strong>Date:</strong> {new Date(transaction.transactionDate || transaction.createdAt || Date.now()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p> */}
                                  </div>
                                </div>
                              </div>

                              <table className="print-table">
                                <thead>
                                  <tr>
                                    <th style={{ width: '40%' }}>Item Name</th>
                                    <th style={{ width: '15%', textAlign: 'center' }}>Quantity</th>
                                    <th style={{ width: '20%', textAlign: 'right' }}>Unit Price</th>
                                    <th style={{ width: '25%', textAlign: 'right' }}>Total</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {transaction.items && transaction.items.map((item, idx) => (
                                    <tr key={idx}>
                                      <td>
                                        <span style={{ display: 'block', fontWeight: 600 }}>{item.name}</span>
                                        {(item.isSet || item.status === 'partial') && (
                                          <span
                                            style={{
                                              display: 'inline-block',
                                              marginTop: '4px',
                                              fontSize: '11px',
                                              fontWeight: 600,
                                              color: item.status === 'partial' ? '#b45309' : '#047857',
                                            }}
                                          >
                                            {item.status === 'partial' ? 'Partial' : 'Fulfilled'}
                                          </span>
                                        )}
                                        {item.isSet && item.setComponents?.length > 0 && (
                                          <ul style={{ margin: '6px 0 0', paddingLeft: '12px', fontSize: '11px', color: '#4b5563' }}>
                                            {item.setComponents.map((component, componentIdx) => (
                                              <li
                                                key={`${item.name}-component-print-${componentIdx}`}
                                                style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}
                                              >
                                                <span>{component.name}</span>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                  <span style={{ fontWeight: 600 }}>× {component.quantity}</span>
                                                  {component.taken === false && (
                                                    <span style={{ textTransform: 'uppercase', fontWeight: 700, color: '#dc2626' }}>
                                                      Not Taken
                                                    </span>
                                                  )}
                                                </span>
                                              </li>
                                            ))}
                                          </ul>
                                        )}
                                      </td>
                                      <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                                      <td style={{ textAlign: 'right' }}>₹{Number(item.price).toFixed(2)}</td>
                                      <td style={{ textAlign: 'right', fontWeight: '600' }}>₹{Number(item.total).toFixed(2)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot>
                                  <tr style={{ borderTop: '2px solid #1e40af' }}>
                                    <td colSpan="3" style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '14px', paddingTop: '15px' }}>
                                      Total Amount:
                                    </td>
                                    <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '16px', paddingTop: '15px' }}>
                                      ₹{Number(transaction.totalAmount).toFixed(2)}
                                    </td>
                                  </tr>
                                </tfoot>
                              </table>

                              <div style={{ marginTop: '20px', fontSize: '12px' }}>
                                <p style={{ margin: '5px 0' }}><strong>Payment Method:</strong> {transaction.paymentMethod === 'cash' ? 'Cash' : 'Online'}</p>
                                <p style={{ margin: '5px 0' }}>
                                  <strong>Payment Status:</strong>
                                  <span style={{ color: transaction.isPaid ? '#059669' : '#dc2626', fontWeight: '600', marginLeft: '5px' }}>
                                    {transaction.isPaid ? 'Paid' : 'Unpaid'}
                                  </span>
                                </p>
                                {transaction.remarks && (
                                  <p style={{ margin: '5px 0' }}><strong>Remarks:</strong> {transaction.remarks}</p>
                                )}
                              </div>

                              <div className="print-footer">
                                <p style={{ fontSize: '11px', color: '#6b7280', textAlign: 'center', margin: '0' }}>
                                  Generated on {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })} |
                                  This is a system generated receipt
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    };

                    return <TransactionPrintComponent key={transaction._id || transaction.transactionId} transaction={transaction} />;
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Transaction Modal */}
      {showTransactionModal && student && (
        <StudentReceiptModal
          student={student}
          products={products}
          prefilledItems={prefillProducts}
          mode={transactionMode}
          isOnline={isOnline}
          onClose={() => {
            setShowTransactionModal(false);
            setPrefillProducts([]);
            setTransactionMode('mapped');
          }}
          onTransactionSaved={(updatedStudent) => {
            setStudent(updatedStudent);
            setStudents(prev => prev.map(s => s.id === updatedStudent.id ? updatedStudent : s));
            // Refresh transactions after saving - but keep modal open
            fetchStudentTransactions();
          }}
          onTransactionQueued={(queuedTransaction, optimisticStudent) => {
            if (onQueueTransaction) {
              onQueueTransaction(queuedTransaction, optimisticStudent);
            }
            setStudent(optimisticStudent);
            setStudents(prev => prev.map(s => s.id === optimisticStudent.id ? optimisticStudent : s));
            fetchStudentTransactions();
          }}
          onProductsUpdated={refreshProducts}
        />
      )}
    </div>
  );
};

export default StudentDetail;