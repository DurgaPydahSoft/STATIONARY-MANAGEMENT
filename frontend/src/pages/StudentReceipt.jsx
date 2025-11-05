import React, { useMemo, useRef, useState } from 'react';
import { Printer, X, Download, Save, Plus, Minus } from 'lucide-react';
import html2canvas from 'html2canvas';
import { useReactToPrint } from 'react-to-print';
import jsPDF from 'jspdf';
import { apiUrl } from '../utils/api';

const StudentReceiptModal = ({ student, products, onClose, onTransactionSaved }) => {
  const receiptRef = useRef(null);
  const [selectedItems, setSelectedItems] = useState({});
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [isPaid, setIsPaid] = useState(false);
  const [saving, setSaving] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [savedTransactionItems, setSavedTransactionItems] = useState([]);
  const [savedPaymentInfo, setSavedPaymentInfo] = useState({ paymentMethod: 'cash', isPaid: false, remarks: '', totalAmount: 0 });

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
    return (products || []).filter(p => {
      if (p.forCourse && p.forCourse !== student.course) return false;
      const productYears = p.years || (p.year ? [p.year] : []);
      if (productYears.length > 0 && !productYears.includes(Number(student.year))) {
        return false;
      }
      return true;
    });
  }, [products, student.course, student.year]);

  const transactionItems = useMemo(() => {
    return Object.entries(selectedItems)
      .filter(([_, quantity]) => quantity > 0)
      .map(([productId, quantity]) => {
        const product = visibleItems.find(p => p._id === productId);
        if (!product) return null;
        return {
          productId: product._id,
          name: product.name,
          quantity: Number(quantity),
          price: Number(product.price),
          total: Number(quantity) * Number(product.price),
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
          onTransactionSaved({ ...student, id: studentId });
        }
      }

      // Reset form for next transaction (but keep modal open)
      setSelectedItems({});
      setPaymentMethod('cash');
      setIsPaid(false);
      setRemarks('');
    } catch (error) {
      console.error('Error saving transaction:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <style type="text/css" media="print">
        {`@page { size: auto; margin: 0; }
          .no-print { display: none !important; }
        `}
      </style>

      <div 
        className={`bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col relative ${saving ? 'opacity-60 pointer-events-none' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 z-10 w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center cursor-pointer transition-colors no-print"
        >
          <X size={16} className="text-gray-600" />
        </button>

        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-5 bg-gradient-to-r from-blue-50 to-white">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900">Stationery Transaction</h2>
            <p className="text-sm text-gray-600 mt-1">Pydah College of Engineering</p>
          </div>
          </div>

        {/* Content - Split into two columns */}
        <div className="flex-1 overflow-y-auto" ref={receiptRef}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
            {/* Left Column - Student Info & Items Selection & Payment */}
            <div className="lg:col-span-2 space-y-6">
              {/* Student Info */}
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-4 border border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide flex items-center gap-2">
                  <span className="w-1 h-4 bg-blue-600 rounded-full"></span>
                  Student Information
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500 text-xs font-medium">Student Name:</span>
                    <p className="text-gray-900 font-semibold mt-1">{student.name}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 text-xs font-medium">Student ID:</span>
                    <p className="text-gray-900 font-semibold mt-1">{student.studentId}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 text-xs font-medium">Course:</span>
                    <p className="text-gray-900 font-semibold mt-1">{student.course.toUpperCase()} - Year {student.year}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 text-xs font-medium">Branch:</span>
                    <p className="text-gray-900 font-semibold mt-1">{student.branch || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Items Selection Section */}
              <div className="no-print">
                <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="w-1 h-6 bg-blue-600 rounded-full"></span>
                  Select Items
                </h3>
                {visibleItems.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-sm text-gray-500">No items available for this course/year</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                    {visibleItems.map(item => {
                      const quantity = selectedItems[item._id] || 0;
                      const isSelected = quantity > 0;
                  return (
                        <div 
                          key={item._id} 
                          className={`flex items-center justify-between gap-4 p-3 rounded-lg border-2 transition-all ${
                            isSelected 
                              ? 'border-blue-500 bg-blue-50 shadow-sm' 
                              : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm'
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className={`font-medium text-sm ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                                {item.name}
                              </span>
                              <div className="flex items-center gap-3 ml-2">
                                <span className="text-xs text-gray-500 font-medium whitespace-nowrap">
                                  Stock: <span className={item.stock <= 5 ? 'text-red-600 font-semibold' : item.stock <= 10 ? 'text-orange-600 font-semibold' : 'text-gray-600'}>{item.stock || 0}</span>
                                </span>
                                <span className="font-semibold text-blue-600 text-sm whitespace-nowrap">
                                  ₹{item.price?.toFixed(2) || '0.00'}
                                </span>
                              </div>
                            </div>
                            {item.description && (
                              <p className="text-xs text-gray-500 italic mt-1 line-clamp-1">{item.description}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <div className="flex items-center border border-gray-300 rounded-md bg-white">
                              <button
                                type="button"
                                className="w-7 h-7 flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed rounded-l-md"
                                onClick={() => handleQuantityChange(item._id, -1)}
                                disabled={quantity === 0}
                              >
                                <Minus size={12} />
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
                                className="w-12 text-center border-0 font-semibold text-sm focus:outline-none focus:ring-0"
                              />
                              <button
                                type="button"
                                className="w-7 h-7 flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors rounded-r-md disabled:opacity-50 disabled:cursor-not-allowed"
                                onClick={() => handleQuantityChange(item._id, 1)}
                                disabled={quantity >= (item.stock || 0)}
                              >
                                <Plus size={12} />
                              </button>
                            </div>
                            {isSelected && (
                              <span className="font-semibold text-green-600 min-w-[70px] text-right text-sm whitespace-nowrap">
                                ₹{(quantity * item.price).toFixed(2)}
                              </span>
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
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-4 border border-gray-200 no-print">
                  <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <span className="w-1 h-6 bg-green-600 rounded-full"></span>
                    Payment Details
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Payment Method Toggle */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-2">Payment Method</label>
                      <div className="relative inline-flex items-center bg-gray-100 rounded-lg p-1 w-full md:w-auto">
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('cash')}
                          className={`relative flex-1 px-4 py-2 rounded-md text-xs font-semibold transition-all ${
                            paymentMethod === 'cash'
                              ? 'bg-white text-blue-700 shadow-sm'
                              : 'text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          Cash
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('online')}
                          className={`relative flex-1 px-4 py-2 rounded-md text-xs font-semibold transition-all ${
                            paymentMethod === 'online'
                              ? 'bg-white text-blue-700 shadow-sm'
                              : 'text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          Online
                        </button>
                      </div>
                    </div>

                    {/* Payment Status */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-2">Payment Status</label>
                      <div className="flex items-center gap-2 p-2.5 bg-white rounded-lg border border-gray-200 h-[42px]">
                      <input
                        type="checkbox"
                          id="paid-checkbox"
                          checked={isPaid}
                          onChange={(e) => setIsPaid(e.target.checked)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                        />
                        <label htmlFor="paid-checkbox" className="font-medium text-gray-700 cursor-pointer text-xs">
                          Mark as Paid
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Remarks */}
                  <div className="mt-4">
                    <label className="block text-xs font-medium text-gray-700 mb-2">
                      Remarks (Optional)
                    </label>
                    <textarea
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="Add any remarks..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                      rows={2}
                    />
              </div>
            </div>
          )}
            </div>

            {/* Right Column - Receipt Preview */}
            {(transactionItems.length > 0 || savedTransactionItems.length > 0) && (
              <div className="lg:col-span-1">
                <div className="bg-white rounded-lg border-2 border-gray-300 p-5 sticky top-6">
                  <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="w-1 h-6 bg-purple-600 rounded-full"></span>
                    Receipt Preview
                  </h3>

              {/* Receipt Items Section - For printing */}
              <div className="space-y-4">
                    <div className="border-b border-gray-200 pb-2">
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">Items Issued</h4>
                      <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {(transactionItems.length > 0 ? transactionItems : savedTransactionItems).map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center py-1.5 border-b border-gray-100 text-xs">
                            <div className="flex-1">
                              <span className="font-medium text-gray-900">{item.name}</span>
                              <span className="text-gray-500 ml-2">× {item.quantity}</span>
                            </div>
                            <span className="font-semibold text-gray-900">₹{item.total.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Total */}
                    <div className="flex justify-between items-center pt-3 border-t-2 border-gray-900">
                      <span className="text-sm font-bold text-gray-900">Total Amount:</span>
                      <span className="text-lg font-bold text-gray-900">
                        ₹{(transactionItems.length > 0 ? totalAmount : savedPaymentInfo.totalAmount).toFixed(2)}
                      </span>
                    </div>

                    {/* Payment Info */}
                    <div className="pt-3 border-t border-gray-200 space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-600 font-medium">Payment Method:</span>
                        <span className="text-gray-900 font-semibold capitalize">
                          {transactionItems.length > 0 ? paymentMethod : savedPaymentInfo.paymentMethod}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 font-medium">Payment Status:</span>
                        <span className={`font-semibold ${(transactionItems.length > 0 ? isPaid : savedPaymentInfo.isPaid) ? 'text-green-600' : 'text-red-600'}`}>
                          {(transactionItems.length > 0 ? isPaid : savedPaymentInfo.isPaid) ? 'Paid' : 'Unpaid'}
                        </span>
                      </div>
                      {(transactionItems.length > 0 ? remarks : savedPaymentInfo.remarks) && (
                        <div className="pt-2 border-t border-gray-200">
                          <span className="text-gray-600 font-medium">Remarks:</span>
                          <p className="text-gray-900 mt-1 text-xs">{transactionItems.length > 0 ? remarks : savedPaymentInfo.remarks}</p>
                        </div>
                      )}
                    </div>

                    {/* Date */}
                    <div className="pt-3 border-t border-gray-200">
                      <p className="text-xs text-gray-500 text-right">
                        {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
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
        <div className="border-t border-gray-200 bg-gray-50 px-6 py-4 flex justify-end gap-3 rounded-b-xl no-print">
          <button 
            onClick={handleSaveTransaction} 
            disabled={transactionItems.length === 0 || saving}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium text-sm flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={16} /> {saving ? 'Saving...' : 'Save Transaction'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudentReceiptModal;
