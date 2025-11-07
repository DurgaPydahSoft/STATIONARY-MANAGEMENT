import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Printer, X, Download, Save, Plus, Minus, Package, CreditCard, Receipt, Loader2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import { useReactToPrint } from 'react-to-print';
import jsPDF from 'jspdf';
import { apiUrl } from '../utils/api';

const normalizeValue = (value) => {
  if (!value) return '';
  return String(value).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
};

const StudentReceiptModal = ({ student, products, prefilledItems = [], onClose, onTransactionSaved, onProductsUpdated }) => {
  const receiptRef = useRef(null);
  const [selectedItems, setSelectedItems] = useState({});
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [isPaid, setIsPaid] = useState(true);
  const [saving, setSaving] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [savedTransactionItems, setSavedTransactionItems] = useState([]);
  const [savedPaymentInfo, setSavedPaymentInfo] = useState({ paymentMethod: 'cash', isPaid: false, remarks: '', totalAmount: 0 });
  const [statusMsg, setStatusMsg] = useState({ type: '', message: '' });
  const [receiptConfig, setReceiptConfig] = useState({
    receiptHeader: 'PYDAH COLLEGE OF ENGINEERING',
    receiptSubheader: 'Stationery Management System',
  });

  // Prefill items when prefilledItems prop is provided
  useEffect(() => {
    if (prefilledItems && prefilledItems.length > 0) {
      const initialItems = {};
      prefilledItems.forEach(product => {
        if (product && product._id) {
          // For sets, default to 1; for regular items, default to 1 if stock > 0
          if (product.isSet) {
            initialItems[product._id] = 1;
          } else if (product.stock > 0) {
            initialItems[product._id] = 1;
          }
        }
      });
      setSelectedItems(initialItems);
    }
  }, [prefilledItems]);

  useEffect(() => {
    let isMounted = true;
    const fetchSettings = async () => {
      try {
        const response = await fetch(apiUrl('/api/settings'));
        if (response.ok) {
          const data = await response.json();
          if (isMounted) {
            setReceiptConfig({
              receiptHeader: data.receiptHeader || 'PYDAH COLLEGE OF ENGINEERING',
              receiptSubheader: data.receiptSubheader || 'Stationery Management System',
            });
          }
        }
      } catch (error) {
        console.warn('Could not load receipt settings:', error.message || error);
      }
    };

    fetchSettings();
    return () => {
      isMounted = false;
    };
  }, []);

  const triggerPrint = useReactToPrint({
    contentRef: receiptRef,
    documentTitle: `Receipt-${student?.studentId || 'student'}`,
  });

  const handlePrint = () => {
    try {
      if (!receiptRef.current) {
        console.warn('Print attempted but receiptRef is not ready');
        return;
      }
      
      // Try using react-to-print first
      if (typeof triggerPrint === 'function') {
        triggerPrint();
        return;
      }
    } catch (error) {
      console.error('Error with react-to-print:', error);
      // fall through to manual
    }

    // Manual print fallback
    const node = receiptRef.current;
    if (!node) {
      console.warn('Receipt element not found');
      return;
    }

        const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=800,height=1000');
    if (!printWindow) {
      alert('Please allow popups to print the receipt');
      return;
    }

    const styles = `
      <style>
        @page { size: auto; margin: 0; }
        body { margin: 0; font-family: 'Segoe UI', Helvetica, Arial, sans-serif; color: #111827; }
        .no-print { display: none !important; }
      </style>
    `;

    const receiptContent = node.innerHTML;
    printWindow.document.write(`<!doctype html><html><head><title>Receipt-${student?.studentId || 'student'}</title>${styles}</head><body>${receiptContent}</body></html>`);
    printWindow.document.close();
    
    // Wait for content to load before printing
    printWindow.onload = () => {
      setTimeout(() => {
    printWindow.focus();
        printWindow.print();
        // Don't close immediately, let user cancel if needed
      }, 500);
    };
  };

  const handleDownload = () => {
    const receiptElement = receiptRef.current;
    if (!receiptElement) return;

    html2canvas(receiptElement, {
      scale: 3,
      useCORS: true,
      backgroundColor: '#ffffff'
    }).then((canvas) => {
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4'
      });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, imgHeight);
      pdf.save(`receipt-${student?.studentId || 'student'}.pdf`);
    });
  };

  if (!student) return null;

  const visibleItems = useMemo(() => {
    if (prefilledItems && prefilledItems.length > 0) {
      return (products || []).filter(p => prefilledItems.some(pref => pref._id === p._id));
    }

    return (products || []).filter(p => {
      if (p.forCourse) {
        const normalizedCourse = normalizeValue(p.forCourse);
        if (normalizedCourse && normalizedCourse !== normalizeValue(student.course)) {
          return false;
        }
      }
      const productYears = p.years || (p.year ? [p.year] : []);
      if (productYears.length > 0 && !productYears.includes(Number(student.year))) {
        return false;
      }
      return true;
    });
  }, [products, student.course, student.year, prefilledItems]);

  const transactionItems = useMemo(() => {
    return Object.entries(selectedItems)
      .filter(([_, quantity]) => quantity > 0)
      .map(([productId, quantity]) => {
        const product = visibleItems.find(p => p._id === productId);
        if (!product) return null;
        const components = product.isSet
          ? (product.setItems || []).map(setItem => ({
              name: setItem?.product?.name || setItem?.productNameSnapshot || 'Unknown item',
              quantity: Number(setItem?.quantity) || 1,
            }))
          : [];
        return {
          productId: product._id,
          name: product.name,
          quantity: Number(quantity),
          price: Number(product.price),
          total: Number(quantity) * Number(product.price),
          isSet: Boolean(product.isSet),
          setComponents: components,
        };
      })
      .filter(Boolean);
  }, [selectedItems, visibleItems]);

  const totalAmount = useMemo(() => {
    return transactionItems.reduce((sum, item) => sum + item.total, 0);
  }, [transactionItems]);

  const handleQuantityChange = (productId, delta) => {
    setSelectedItems(prev => {
      const current = prev[productId] || 0;
      const product = visibleItems.find(p => p._id === productId);
      
      // For sets, quantity is always 1 (can't change)
      if (product?.isSet) {
        return prev;
      }
      
      const maxStock = product?.stock || 0;
      const newQuantity = Math.max(0, Math.min(current + delta, maxStock));
      if (newQuantity === 0) {
        const { [productId]: removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [productId]: newQuantity };
    });
  };

  const handleSaveTransaction = async () => {
    if (transactionItems.length === 0) {
      alert('Please select at least one item');
      return;
    }

    try {
      setSaving(true);
      const studentId = student.id || student._id;

      const updatedStudentItems = { ...(student.items || {}) };
      transactionItems.forEach(item => {
        const product = visibleItems.find(p => p._id === item.productId);
        if (!product) return;
        const isMapped = product.forCourse && normalizeValue(product.forCourse) === normalizeValue(student.course);
        if (!isMapped) return;
        const key = product.name?.toLowerCase().replace(/\s+/g, '_');
        if (key) {
          updatedStudentItems[key] = true;
        }
      });

      const locallyUpdatedStudent = {
        ...student,
        items: updatedStudentItems,
      };

      const response = await fetch(apiUrl('/api/transactions'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          items: transactionItems,
          paymentMethod,
          isPaid,
          remarks,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to save transaction' }));
        throw new Error(errorData.message || 'Failed to save transaction');
      }

      const savedTransaction = await response.json();
      
      // Save transaction data for printing before resetting form
      setSavedTransactionItems(transactionItems);
      setSavedPaymentInfo({
        paymentMethod,
        isPaid,
        remarks,
        totalAmount,
      });
      
      // Fetch updated student data
      const studentRes = await fetch(apiUrl(`/api/users/${student.course}/${studentId}`));
      if (studentRes.ok) {
        const updatedStudent = await studentRes.json();
        if (onTransactionSaved) {
          onTransactionSaved({ ...updatedStudent, id: updatedStudent._id });
        }
      } else {
        if (onTransactionSaved) {
          onTransactionSaved({ ...locallyUpdatedStudent, id: studentId });
        }
      }

      if (onProductsUpdated) {
        try {
          await onProductsUpdated();
        } catch (err) {
          console.warn('Failed to refresh products after transaction:', err);
        }
      }

      // Reset form for next transaction (but keep modal open)
      setSelectedItems({});
      setPaymentMethod('cash');
      setIsPaid(true);
      setRemarks('');
      
      // Show success message and close modal after 1.5 seconds
      setStatusMsg({ type: 'success', message: 'Transaction saved successfully!' });
      setTimeout(() => {
        setStatusMsg({ type: '', message: '' });
        onClose(); // Close the modal after showing success message
      }, 1500);
    } catch (error) {
      console.error('Error saving transaction:', error);
      setStatusMsg({ type: 'error', message: error.message || 'Failed to save transaction' });
      setTimeout(() => setStatusMsg({ type: '', message: '' }), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.35)' }}
      onClick={onClose}
    >
      <style type="text/css" media="print">
        {`@page { size: auto; margin: 0; }
          .no-print { display: none !important; }
        `}
      </style>

      <div 
        className={`bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col relative ${saving ? 'pointer-events-none' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 z-10 w-10 h-10 bg-white hover:bg-gray-100 rounded-full flex items-center justify-center cursor-pointer transition-colors no-print shadow-lg border border-gray-200"
        >
          <X size={20} className="text-gray-600" />
        </button>

        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-blue-700 to-indigo-700 rounded-t-2xl border-b border-blue-600/40">
          <div className="text-center">
            <h2 className="text-xl font-bold text-white">{receiptConfig.receiptHeader}</h2>
            <p className="text-xs text-blue-100 mt-0.5">{receiptConfig.receiptSubheader}</p>
          </div>
        </div>

        {/* Status Message */}
        {statusMsg.message && (
          <div className={`mx-5 mt-3 p-3 rounded-lg text-xs font-medium ${
            statusMsg.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {statusMsg.message}
          </div>
        )}

        {/* Content - Split into two columns */}
        <div className="flex-1 bg-gradient-to-br from-blue-50 via-white to-blue-100" ref={receiptRef}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
            {/* Left Column - Items Selection & Payment */}
            <div className="space-y-4">
              {/* Items Selection Section */}
              <div className="no-print">
                <h3 className="text-sm font-semibold text-blue-900 mb-3 flex items-center gap-2">
                  <div className="w-6 h-6 bg-blue-600 rounded-lg flex items-center justify-center">
                    <Package size={14} className="text-white" />
                  </div>
                  Select Items
                </h3>
                {visibleItems.length === 0 ? (
                  <div className="text-center py-8 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200">
                    <p className="text-xs text-gray-500">No items available for this course/year</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                    {visibleItems.map(item => {
                      const quantity = selectedItems[item._id] || 0;
                      const isSelected = quantity > 0;
                      const isSet = item.isSet || false;
                  return (
                        <div 
                          key={item._id} 
                          className={`flex items-center justify-between gap-2 p-3 rounded-xl border-2 transition-all shadow-sm ${
                            isSelected 
                              ? 'border-blue-500 bg-blue-50' 
                              : 'border-blue-100 bg-white hover:border-blue-300'
                          } ${isSet ? 'border-indigo-300 bg-indigo-50/60' : ''}`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                              <div className="flex items-center gap-2">
                                <span className={`font-medium text-xs ${isSelected ? 'text-blue-900' : 'text-slate-900'}`}>
                                  {item.name}
                                </span>
                                {isSet && (
                                  <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[10px] font-semibold">
                                    Set
                                  </span>
                                )}
                              </div>
                              <span className="font-semibold text-blue-700 text-xs whitespace-nowrap ml-2">
                                ₹{item.price?.toFixed(2) || '0.00'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {!isSet && (
                                <span className="text-xs text-blue-600 font-medium">
                                  Stock: <span className={item.stock <= 5 ? 'text-red-600 font-semibold' : item.stock <= 10 ? 'text-amber-600 font-semibold' : 'text-blue-800'}>{item.stock || 0}</span>
                                </span>
                              )}
                              {isSet && (
                                <span className="text-xs text-indigo-600 font-medium">
                                  Contains {item.setItems?.length || 0} item{item.setItems?.length !== 1 ? 's' : ''}
                                </span>
                              )}
                              {isSelected && (
                                <span className="font-semibold text-blue-900 text-xs">
                                  Total: ₹{(quantity * item.price).toFixed(2)}
                                </span>
                              )}
                            </div>
                            {isSet && item.setItems?.length > 0 && (
                              <ul className="mt-2 space-y-1">
                                {item.setItems.map(setItem => (
                                  <li key={`${item._id}-${setItem.product?._id || setItem.product || setItem.productNameSnapshot}`}
                                      className="text-[11px] text-indigo-700 flex justify-between">
                                    <span className="truncate max-w-[160px]">
                                      {setItem?.product?.name || setItem?.productNameSnapshot || 'Unknown item'}
                                    </span>
                                    <span className="font-semibold">× {Number(setItem?.quantity) || 1}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {isSet ? (
                              // For sets, show fixed quantity (always 1) with toggle
                              <div className="flex items-center">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (quantity > 0) {
                                      const { [item._id]: removed, ...rest } = selectedItems;
                                      setSelectedItems(rest);
                                    } else {
                                      setSelectedItems(prev => ({ ...prev, [item._id]: 1 }));
                                    }
                                  }}
                                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors shadow ${
                                    quantity > 0
                                      ? 'bg-blue-600 text-white hover:bg-blue-500'
                                      : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                  }`}
                                >
                                  {quantity > 0 ? 'Remove' : 'Add'}
                                </button>
                              </div>
                            ) : (
                              // For regular items, show quantity controls
                              <div className="flex items-center border border-blue-200 rounded-md bg-white">
                                <button
                                  type="button"
                                  className="w-6 h-6 flex items-center justify-center bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed rounded-l-md"
                                  onClick={() => handleQuantityChange(item._id, -1)}
                                  disabled={quantity === 0}
                                >
                                  <Minus size={10} />
                                </button>
                                <input
                                  type="number"
                                  min="0"
                                  max={item.stock || 0}
                                  value={quantity}
                                  onChange={(e) => {
                                    const val = Math.max(0, Math.min(parseInt(e.target.value) || 0, item.stock || 0));
                                    if (val === 0) {
                                      const { [item._id]: removed, ...rest } = selectedItems;
                                      setSelectedItems(rest);
                                    } else {
                                      setSelectedItems(prev => ({ ...prev, [item._id]: val }));
                                    }
                                  }}
                                  className="w-10 text-center border-0 font-semibold text-xs focus:outline-none focus:ring-0"
                                />
                                <button
                                  type="button"
                                  className="w-6 h-6 flex items-center justify-center bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors rounded-r-md disabled:opacity-50 disabled:cursor-not-allowed"
                                  onClick={() => handleQuantityChange(item._id, 1)}
                                  disabled={quantity >= (item.stock || 0)}
                                >
                                  <Plus size={10} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Payment Section */}
              {transactionItems.length > 0 && (
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-200 shadow-sm no-print">
                  <h3 className="text-sm font-semibold text-blue-900 mb-3 flex items-center gap-2">
                    <div className="w-6 h-6 bg-blue-600 rounded-lg flex items-center justify-center">
                      <CreditCard size={14} className="text-white" />
                    </div>
                    Payment Details
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-3">
                    {/* Payment Method Toggle */}
                    <div>
                      <label className="block text-xs font-medium text-blue-700 mb-2">Payment Method</label>
                      <div className="relative inline-flex items-center bg-white border border-blue-200 rounded-lg p-1 w-full">
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('cash')}
                          className={`relative flex-1 px-3 py-2 rounded-md text-xs font-semibold transition-all ${
                            paymentMethod === 'cash'
                              ? 'bg-blue-600 text-white shadow'
                              : 'text-blue-700 hover:bg-blue-50'
                          }`}
                        >
                          Cash
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('online')}
                          className={`relative flex-1 px-3 py-2 rounded-md text-xs font-semibold transition-all ${
                            paymentMethod === 'online'
                              ? 'bg-blue-600 text-white shadow'
                              : 'text-blue-700 hover:bg-blue-50'
                          }`}
                        >
                          Online
                        </button>
                      </div>
                    </div>

                    {/* Payment Status */}
                    <div>
                      <label className="block text-xs font-medium text-blue-700 mb-2">Payment Status</label>
                      <div className="flex items-center gap-2 p-2.5 bg-white rounded-lg border border-blue-200 h-[42px]">
                      <input
                        type="checkbox"
                          id="paid-checkbox"
                          checked={isPaid}
                          onChange={(e) => setIsPaid(e.target.checked)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                        />
                        <label htmlFor="paid-checkbox" className="font-medium text-blue-800 cursor-pointer text-xs">
                          Mark as Paid
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Remarks */}
                  <div className="mt-3 col-span-2">
                    <label className="block text-xs font-medium text-blue-700 mb-1.5">
                      Remarks (Optional)
                    </label>
                    <textarea
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="Add any remarks..."
                      className="w-full px-3 py-2 border border-blue-200 rounded-lg text-xs resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-blue-900 placeholder-blue-300"
                      rows={2}
                    />
              </div>
            </div>
          )}
            </div>

            {/* Right Column - Receipt Preview */}
            {(transactionItems.length > 0 || savedTransactionItems.length > 0) && (
              <div>
                <div className="bg-white rounded-xl border border-blue-100 p-4 shadow sticky top-4">
                  <h3 className="text-sm font-semibold text-blue-900 mb-3 flex items-center gap-2">
                    <div className="w-6 h-6 bg-blue-600 rounded-lg flex items-center justify-center">
                      <Receipt size={14} className="text-white" />
                    </div>
                    Receipt Preview
                  </h3>

              {/* Receipt Items Section - For printing */}
              <div className="space-y-3">
                    <div className="border-b border-gray-200 pb-2">
                      <h4 className="text-xs font-semibold text-blue-600 mb-2">Items Issued</h4>
                      <div className="space-y-1.5 max-h-[250px] overflow-y-auto">
                        {(transactionItems.length > 0 ? transactionItems : savedTransactionItems).map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center py-1.5 px-2 bg-gray-50 rounded-lg text-xs">
                            <div className="flex-1 min-w-0">
                              <span className="font-medium text-gray-900 text-xs truncate block">{item.name}</span>
                              <span className="text-gray-500 text-xs">× {item.quantity}</span>
                              {item.isSet && item.setComponents?.length > 0 && (
                                <ul className="mt-1 space-y-1">
                                  {item.setComponents.map((component, componentIdx) => (
                                    <li key={`${item.name}-component-${componentIdx}`} className="flex justify-between text-[10px] text-indigo-700">
                                      <span className="truncate max-w-[140px]">{component.name}</span>
                                      <span className="font-semibold">× {component.quantity}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                            <span className="font-semibold text-gray-900 text-xs ml-2 whitespace-nowrap">₹{item.total.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Total */}
                    <div className="flex justify-between items-center pt-2 border-t-2 border-blue-700">
                      <span className="text-xs font-bold text-blue-900">Total:</span>
                      <span className="text-base font-bold text-blue-900">
                        ₹{(transactionItems.length > 0 ? totalAmount : savedPaymentInfo.totalAmount).toFixed(2)}
                      </span>
                    </div>

                    {/* Payment Info */}
                    <div className="pt-2 border-t border-gray-200 space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-blue-700 font-medium text-xs">Method:</span>
                        <span className="text-blue-900 font-semibold capitalize text-xs">
                          {transactionItems.length > 0 ? paymentMethod : savedPaymentInfo.paymentMethod}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-blue-700 font-medium text-xs">Status:</span>
                        <span className={`font-semibold text-xs ${(transactionItems.length > 0 ? isPaid : savedPaymentInfo.isPaid) ? 'text-green-600' : 'text-red-600'}`}>
                          {(transactionItems.length > 0 ? isPaid : savedPaymentInfo.isPaid) ? 'Paid' : 'Unpaid'}
                        </span>
                      </div>
                      {(transactionItems.length > 0 ? remarks : savedPaymentInfo.remarks) && (
                        <div className="pt-1.5 border-t border-blue-100">
                          <span className="text-blue-700 font-medium text-xs">Remarks:</span>
                          <p className="text-blue-900 mt-0.5 text-xs line-clamp-2">{transactionItems.length > 0 ? remarks : savedPaymentInfo.remarks}</p>
                        </div>
                      )}
                    </div>

                    {/* Date */}
                    <div className="pt-2 border-t border-gray-200">
                      <p className="text-xs text-blue-600 text-right">
                        {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                </div>
            </div>
          )}
          </div>

          {/* Full Receipt Section for Printing */}
          {(transactionItems.length > 0 || savedTransactionItems.length > 0) && (
            <div className="border-t-2 border-gray-300 pt-6 px-6 pb-4 hidden print:block">
              <h3 className="text-base font-semibold text-gray-900 mb-3">Items Issued</h3>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b border-gray-200">Item Name</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-gray-200">Quantity</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700 border-b border-gray-200">Unit Price</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700 border-b border-gray-200">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(transactionItems.length > 0 ? transactionItems : savedTransactionItems).map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-100">
                      <td className="px-3 py-2 text-sm text-gray-900">
                        <span className="font-medium">{item.name}</span>
                        {item.isSet && item.setComponents?.length > 0 && (
                          <ul className="mt-1 text-xs text-gray-600">
                            {item.setComponents.map((component, componentIdx) => (
                              <li key={`${item.name}-component-print-${componentIdx}`} className="flex justify-between">
                                <span>{component.name}</span>
                                <span className="ml-2">× {component.quantity}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="px-3 py-2 text-sm text-center text-gray-900">{item.quantity}</td>
                      <td className="px-3 py-2 text-sm text-right text-gray-900">₹{item.price.toFixed(2)}</td>
                      <td className="px-3 py-2 text-sm text-right font-semibold text-gray-900">₹{item.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              <div className="flex justify-between items-center mt-4 pt-4 border-t-2 border-gray-900">
                <span className="text-base font-bold text-gray-900">Total Amount:</span>
                <span className="text-base font-bold text-gray-900">
                  ₹{(transactionItems.length > 0 ? totalAmount : savedPaymentInfo.totalAmount).toFixed(2)}
                </span>
              </div>

              <div className="mt-4 text-sm text-gray-600 space-y-1">
                <p>
                  <span className="font-semibold">Payment Method:</span> {(transactionItems.length > 0 ? paymentMethod : savedPaymentInfo.paymentMethod) === 'cash' ? 'Cash' : 'Online'}
                </p>
                <p>
                  <span className="font-semibold">Payment Status:</span> {(transactionItems.length > 0 ? isPaid : savedPaymentInfo.isPaid) ? 'Paid' : 'Unpaid'}
                </p>
                {(transactionItems.length > 0 ? remarks : savedPaymentInfo.remarks) && (
                  <p>
                    <span className="font-semibold">Remarks:</span> {transactionItems.length > 0 ? remarks : savedPaymentInfo.remarks}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-blue-100 bg-gradient-to-r from-blue-50 to-blue-100 px-5 py-3 flex justify-end gap-3 rounded-b-2xl no-print">
          <button 
            onClick={handleSaveTransaction} 
            disabled={transactionItems.length === 0 || saving}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold text-sm flex items-center gap-2 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
          >
            {saving ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save size={16} />
                Save Transaction
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudentReceiptModal;
