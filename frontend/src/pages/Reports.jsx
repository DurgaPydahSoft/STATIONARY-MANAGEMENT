import { useState, useEffect, useMemo } from 'react';
import { Search, Trash2, Receipt, Download, Eye, X, FileText, Calendar, Package, Building2, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Filter } from 'lucide-react';
import { apiUrl } from '../utils/api';
import jsPDF from 'jspdf';

const Reports = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    course: '',
    studentId: '',
    transactionType: '',
    paymentMethod: '',
    isPaid: '',
    startDate: '',
    endDate: '',
  });
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [courses, setCourses] = useState([]);
  const [reportType, setReportType] = useState(''); // 'day-end', 'stock', 'vendor-purchase'
  const [receiptSettings, setReceiptSettings] = useState({
    receiptHeader: 'PYDAH COLLEGE OF ENGINEERING',
    receiptSubheader: 'Stationery Management System',
  });
  
  // Get today's date in YYYY-MM-DD format
  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };
  
  const [reportFilters, setReportFilters] = useState({
    course: '',
    paymentMethod: '',
    isPaid: '',
    startDate: getTodayDate(),
    endDate: getTodayDate(),
    includeItems: false,
    includeSummary: true,
    onlyStatistics: false,
    // For stock report
    productCategory: '',
    // For vendor purchase report
    vendor: '',
  });
  const [vendors, setVendors] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [branchTransferPage, setBranchTransferPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  useEffect(() => {
    fetchTransactions();
    fetchStudents();
    fetchVendors();
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch(apiUrl('/api/settings'));
      if (response.ok) {
        const data = await response.json();
        setReceiptSettings({
          receiptHeader: data.receiptHeader || 'PYDAH COLLEGE OF ENGINEERING',
          receiptSubheader: data.receiptSubheader || 'Stationery Management System',
        });
      }
    } catch (error) {
      console.warn('Failed to load receipt settings:', error.message || error);
    }
  };

  const fetchVendors = async () => {
    try {
      const response = await fetch(apiUrl('/api/vendors'));
      if (response.ok) {
        const data = await response.json();
        setVendors(data);
      }
    } catch (error) {
      console.error('Error fetching vendors:', error);
    }
  };

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      if (filters.course) queryParams.append('course', filters.course);
      if (filters.studentId) queryParams.append('studentId', filters.studentId);
      if (filters.transactionType) queryParams.append('transactionType', filters.transactionType);
      if (filters.paymentMethod) queryParams.append('paymentMethod', filters.paymentMethod);
      if (filters.isPaid !== '') queryParams.append('isPaid', filters.isPaid);
      if (filters.startDate) queryParams.append('startDate', filters.startDate);
      if (filters.endDate) queryParams.append('endDate', filters.endDate);

      const response = await fetch(apiUrl(`/api/transactions?${queryParams.toString()}`));
      if (response.ok) {
        const data = await response.json();
        // Filter by date range on client side if needed
        let filteredData = data;
        if (filters.startDate || filters.endDate) {
          filteredData = data.filter(transaction => {
            const transDate = new Date(transaction.transactionDate);
            if (filters.startDate && transDate < new Date(filters.startDate)) return false;
            if (filters.endDate && transDate > new Date(filters.endDate + 'T23:59:59')) return false;
            return true;
          });
        }
        setTransactions(filteredData);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async () => {
    try {
      const response = await fetch(apiUrl('/api/users'));
      if (response.ok) {
        const data = await response.json();
        const uniqueCourses = Array.from(new Set(data.map(s => s.course)));
        setCourses(uniqueCourses);
      }
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  const courseOptions = useMemo(() => {
    return [...courses]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  }, [courses]);

  useEffect(() => {
    fetchTransactions();
  }, [filters]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(transaction => {
      // Filter by transaction type if selected
      if (filters.transactionType) {
        const transType = transaction.transactionType || 'student';
        if (transType !== filters.transactionType) {
          return false;
        }
      }

      const matchesSearch = 
        transaction.transactionId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.student?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.student?.studentId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.branchTransfer?.branchName?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });
  }, [transactions, searchTerm, filters.transactionType]);

  // Separate student transactions and branch transfers
  const studentTransactions = useMemo(() => {
    return filteredTransactions.filter(t => !t.transactionType || t.transactionType === 'student');
  }, [filteredTransactions]);

  const branchTransfers = useMemo(() => {
    return filteredTransactions.filter(t => t.transactionType === 'branch_transfer');
  }, [filteredTransactions]);

  // Pagination for student transactions
  const studentTotalPages = Math.ceil(studentTransactions.length / itemsPerPage);
  const studentStartIndex = (currentPage - 1) * itemsPerPage;
  const studentEndIndex = studentStartIndex + itemsPerPage;
  const paginatedStudentTransactions = studentTransactions.slice(studentStartIndex, studentEndIndex);

  // Pagination for branch transfers
  const branchTransferTotalPages = Math.ceil(branchTransfers.length / itemsPerPage);
  const branchTransferStartIndex = (branchTransferPage - 1) * itemsPerPage;
  const branchTransferEndIndex = branchTransferStartIndex + itemsPerPage;
  const paginatedBranchTransfers = branchTransfers.slice(branchTransferStartIndex, branchTransferEndIndex);


  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
    setBranchTransferPage(1);
  }, [searchTerm, filters]);

  const handleDelete = async (transactionId) => {
    if (!window.confirm('Are you sure you want to delete this transaction?')) {
      return;
    }

    try {
      const response = await fetch(apiUrl(`/api/transactions/${transactionId}`), {
        method: 'DELETE',
      });

      if (response.ok) {
        setTransactions(prev => prev.filter(t => t._id !== transactionId));
        alert('Transaction deleted successfully');
      } else {
        throw new Error('Failed to delete transaction');
      }
    } catch (error) {
      console.error('Error deleting transaction:', error);
      alert('Error deleting transaction');
    }
  };

  const handleViewDetails = (transaction) => {
    setSelectedTransaction(transaction);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount) => {
    return `₹${Number(amount).toFixed(2)}`;
  };

  const formatCurrencyForPDF = (amount) => {
    // Use 'Rs' instead of ₹ symbol to avoid encoding issues
    return `Rs ${Number(amount || 0).toFixed(2)}`;
  };

  const generateDayEndReport = async (transactions) => {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a5'
    });

    // Header Section
    pdf.setFontSize(18);
    pdf.setTextColor(0, 0, 0);
    pdf.setFont(undefined, 'bold');
    pdf.text(receiptSettings.receiptHeader, 74, 12, { align: 'center' });
    pdf.setFontSize(10);
    pdf.setTextColor(0, 0, 0);
    pdf.setFont(undefined, 'normal');
    pdf.text(receiptSettings.receiptSubheader, 74, 18, { align: 'center' });
    pdf.setFontSize(12);
    pdf.setTextColor(0, 0, 0);
    pdf.setFont(undefined, 'bold');
    pdf.text('Day-End Transaction Report', 74, 24, { align: 'center' });
    
    // Draw line under header
    pdf.setDrawColor(200, 200, 200);
    pdf.line(14, 28, 134, 28);
    
    let yPos = 34;

    // Report Info Section
    const showStats =
      transactions.length > 0 &&
      (reportFilters.includeSummary || reportFilters.onlyStatistics);

    if (showStats) {
      // Exclude branch transfers from revenue calculations (internal stock movements)
      const revenueTransactions = transactions.filter(t => t.transactionType !== 'branch_transfer');
      const totalAmount = revenueTransactions.reduce((sum, t) => sum + (t.totalAmount || 0), 0);
      const paidCount = revenueTransactions.filter(t => t.isPaid).length;
      const paidAmount = revenueTransactions.filter(t => t.isPaid).reduce((sum, t) => sum + (t.totalAmount || 0), 0);
      
      pdf.setFontSize(10);
      pdf.setFont(undefined, 'bold');
      pdf.text('Statistics', 14, yPos);
      
      const statsY = yPos + 4;
      pdf.setFont(undefined, 'normal');
      pdf.setFontSize(8);
      pdf.text(`Total: ${revenueTransactions.length}`, 16, statsY);
      pdf.text(`Amount: ${formatCurrencyForPDF(totalAmount)}`, 52, statsY);
      pdf.text(`Paid: ${paidCount} (${formatCurrencyForPDF(paidAmount)})`, 96, statsY);

      yPos += 16;
    }

    // Transactions Table Header
    if (!reportFilters.onlyStatistics && transactions.length > 0) {
      pdf.setFontSize(11);
      pdf.setFont(undefined, 'bold');
      pdf.setFillColor(240, 240, 240);
      pdf.rect(14, yPos - 4, 120, 6, 'F');
      pdf.text('Transaction Details', 14, yPos);
      yPos += 6;

      // Table Headers
      pdf.setFontSize(7);
      pdf.setFont(undefined, 'bold');
      pdf.setFillColor(230, 230, 230);
      pdf.rect(14, yPos - 3, 120, 5, 'F');
      const colPositions = {
        date: 16,
        student: 44,
        course: 76,
        payment: 102,
        amount: 128,
      };

      pdf.text('Date', colPositions.date, yPos);
      pdf.text('Student', colPositions.student, yPos);
      pdf.text('Course', colPositions.course, yPos);
      pdf.text('Payment', colPositions.payment, yPos);
      pdf.text('Amount', colPositions.amount, yPos, { align: 'right' });
      yPos += 5;

      pdf.setFont(undefined, 'normal');
      pdf.setFontSize(7);

      transactions.forEach((transaction, index) => {
        // Check if we need a new page
        if (yPos > 180) {
          pdf.addPage();
          yPos = 14;
          // Redraw table headers on new page
          pdf.setFont(undefined, 'bold');
          pdf.setFontSize(8);
          pdf.setFillColor(230, 230, 230);
          pdf.rect(14, yPos - 3, 120, 5, 'F');
          pdf.text('Date', colPositions.date, yPos);
          pdf.text('Student', colPositions.student, yPos);
          pdf.text('Course', colPositions.course, yPos);
          pdf.text('Payment', colPositions.payment, yPos);
          pdf.text('Amount', colPositions.amount, yPos, { align: 'right' });
          yPos += 5;
          pdf.setFont(undefined, 'normal');
        }

        const date = new Date(transaction.transactionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const studentName = (transaction.student?.name || 'N/A').substring(0, 16);
        const course = (transaction.student?.course || 'N/A').toUpperCase().substring(0, 8);
        const amount = formatCurrencyForPDF(transaction.totalAmount);
        const payment = transaction.paymentMethod ? transaction.paymentMethod.toUpperCase() : 'N/A';

        // Alternate row background
        if (index % 2 === 0) {
          pdf.setFillColor(250, 250, 250);
          pdf.rect(14, yPos - 3, 120, 5, 'F');
        }

        pdf.text(date, colPositions.date, yPos);
        pdf.text(studentName, colPositions.student, yPos);
        pdf.text(course, colPositions.course, yPos);
        pdf.text(payment, colPositions.payment, yPos);
        pdf.text(amount, colPositions.amount, yPos, { align: 'right' });
        yPos += 5;

        // Draw separator line
        if (index < transactions.length - 1) {
          pdf.setDrawColor(220, 220, 220);
          pdf.line(14, yPos, 134, yPos);
          yPos += 2;
        }
      });

      yPos += 5;

      // Item Details Section (if enabled)
      if (reportFilters.includeItems) {
        pdf.setFontSize(11);
        pdf.setFont(undefined, 'bold');
        pdf.setFillColor(240, 240, 240);
        pdf.rect(14, yPos - 4, 120, 6, 'F');
        pdf.text('Item Details', 14, yPos);
        yPos += 6;

        transactions.forEach((transaction, transIndex) => {
          if (transaction.items && transaction.items.length > 0) {
            // Check if we need a new page
            if (yPos > 180) {
              pdf.addPage();
              yPos = 14;
            }

            pdf.setFontSize(9);
            pdf.setFont(undefined, 'bold');
            pdf.text(`Transaction: ${transaction.transactionId || 'N/A'}`, 16, yPos);
            yPos += 4;

            // Item table header
        pdf.setFontSize(6);
            pdf.setFont(undefined, 'bold');
            pdf.setFillColor(245, 245, 245);
            pdf.rect(16, yPos - 2, 112, 4, 'F');
            pdf.text('Item Name', 18, yPos);
            pdf.text('Qty', 78, yPos);
            pdf.text('Unit Price', 92, yPos);
            pdf.text('Total', 112, yPos);
            yPos += 4;

            pdf.setFont(undefined, 'normal');
            transaction.items.forEach((item, itemIndex) => {
              if (yPos > 180) {
                pdf.addPage();
                yPos = 14;
              }

              const itemName = (item.name || 'N/A').substring(0, 25);
              const itemQty = item.quantity || 0;
              const itemPrice = formatCurrencyForPDF(item.price || 0);
              const itemTotal = formatCurrencyForPDF(item.total || 0);

              pdf.text(`${itemIndex + 1}. ${itemName}`, 18, yPos);
              pdf.text(itemQty.toString(), 78, yPos);
              pdf.text(itemPrice, 92, yPos);
              pdf.text(itemTotal, 112, yPos);
              yPos += 4;
            });

            yPos += 3;
          }
        });
      }
    } else if (!showStats) {
      pdf.setFontSize(10);
      pdf.text('No transactions found for the selected filters.', 20, yPos);
    }

    // Footer
    const pageCount = pdf.internal.pages.length - 1;
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(150, 150, 150);
      pdf.text(`Page ${i} of ${pageCount}`, 74, 197, { align: 'center' });
      pdf.text(`Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, 74, 202, { align: 'center' });
    }

    const fileName = `Day_End_Report_${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(fileName);
  };

  const generateStockReport = async () => {
    try {
      const queryParams = new URLSearchParams();
      if (reportFilters.productCategory) queryParams.append('category', reportFilters.productCategory);
      if (reportFilters.course) queryParams.append('course', reportFilters.course);

      const response = await fetch(apiUrl(`/api/products?${queryParams.toString()}`));
      if (!response.ok) throw new Error('Failed to fetch products for report');
      
      const allProducts = await response.json();
      const products = Array.isArray(allProducts) ? allProducts.filter(product => !product?.isSet) : [];

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Header Section
      pdf.setFontSize(18);
      pdf.setTextColor(30, 58, 138);
      pdf.setFont(undefined, 'bold');
      pdf.text(receiptSettings.receiptHeader, 105, 15, { align: 'center' });
      pdf.setFontSize(12);
      pdf.setTextColor(100, 100, 100);
      pdf.setFont(undefined, 'normal');
      pdf.text(receiptSettings.receiptSubheader, 105, 22, { align: 'center' });
      pdf.setFontSize(14);
      pdf.setTextColor(30, 58, 138);
      pdf.setFont(undefined, 'bold');
      pdf.text('Stock Report', 105, 30, { align: 'center' });
      
      // Draw line under header
      pdf.setDrawColor(200, 200, 200);
      pdf.line(20, 35, 190, 35);
      
      let yPos = 42;

      // Report Info Section
      pdf.setFontSize(10);
      pdf.setTextColor(0, 0, 0);
      pdf.setFont(undefined, 'bold');
      pdf.text('Report Information', 20, yPos);
      yPos += 6;
      pdf.setFont(undefined, 'normal');
      
      if (reportFilters.course) {
        pdf.text(`Course: ${reportFilters.course.toUpperCase()}`, 25, yPos);
        yPos += 5;
      }
      if (reportFilters.productCategory) {
        pdf.text(`Category: ${reportFilters.productCategory}`, 25, yPos);
        yPos += 5;
      }
      pdf.text(`Generated on: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`, 25, yPos);
      yPos += 8;

      // Summary Section
      if (reportFilters.includeSummary && products.length > 0) {
        const totalStock = products.reduce((sum, p) => sum + (p.stock || 0), 0);
        const totalValue = products.reduce((sum, p) => sum + ((p.stock || 0) * (p.price || 0)), 0);
        const lowStockCount = products.filter(p => (p.stock || 0) < 10).length;
        const outOfStockCount = products.filter(p => (p.stock || 0) === 0).length;
        
        pdf.setFontSize(11);
        pdf.setFont(undefined, 'bold');
        pdf.setFillColor(240, 240, 240);
        pdf.rect(20, yPos - 4, 170, 6, 'F');
        pdf.text('Summary Statistics', 20, yPos);
        yPos += 7;
        
        pdf.setFont(undefined, 'normal');
        pdf.setFontSize(9);
        pdf.text(`Total Products: ${products.length}`, 25, yPos);
        yPos += 5;
        pdf.text(`Total Stock Units: ${totalStock}`, 25, yPos);
        yPos += 5;
        pdf.text(`Total Stock Value: ${formatCurrencyForPDF(totalValue)}`, 25, yPos);
        yPos += 5;
        pdf.text(`Low Stock Items (<10 units): ${lowStockCount}`, 25, yPos);
        yPos += 5;
        pdf.text(`Out of Stock Items: ${outOfStockCount}`, 25, yPos);
        yPos += 8;
      }

      // Stock Details Table
      if (products.length > 0) {
        pdf.setFontSize(11);
        pdf.setFont(undefined, 'bold');
        pdf.setFillColor(240, 240, 240);
        pdf.rect(20, yPos - 4, 170, 6, 'F');
        pdf.text('Stock Details', 20, yPos);
        yPos += 7;

        // Table Headers
            pdf.setFontSize(7);
        pdf.setFont(undefined, 'bold');
        pdf.setFillColor(230, 230, 230);
        pdf.rect(20, yPos - 3, 170, 5, 'F');
        pdf.text('Product Name', 22, yPos);
        pdf.text('Price', 100, yPos);
        pdf.text('Stock', 130, yPos);
        pdf.text('Value', 160, yPos);
        yPos += 6;

        pdf.setFont(undefined, 'normal');
            pdf.setFontSize(7);

        products.forEach((product, index) => {
          // Check if we need a new page
          if (yPos > 270) {
            pdf.addPage();
            yPos = 20;
            // Redraw table headers on new page
            pdf.setFont(undefined, 'bold');
            pdf.setFontSize(8);
            pdf.setFillColor(230, 230, 230);
            pdf.rect(20, yPos - 3, 170, 5, 'F');
            pdf.text('Product Name', 22, yPos);
            pdf.text('Price', 100, yPos);
            pdf.text('Stock', 130, yPos);
            pdf.text('Value', 160, yPos);
            yPos += 6;
            pdf.setFont(undefined, 'normal');
          }

          const productName = (product.name || 'N/A').substring(0, 40);
          const price = formatCurrencyForPDF(product.price || 0);
          const stock = product.stock || 0;
          const value = formatCurrencyForPDF((product.stock || 0) * (product.price || 0));

          // Alternate row background
          if (index % 2 === 0) {
            pdf.setFillColor(250, 250, 250);
            pdf.rect(20, yPos - 3, 170, 5, 'F');
          }

          pdf.text(productName, 22, yPos);
          pdf.text(price, 100, yPos);
          pdf.text(stock.toString(), 130, yPos);
          pdf.text(value, 160, yPos);
          yPos += 5;

          // Draw separator line
          if (index < products.length - 1) {
            pdf.setDrawColor(220, 220, 220);
            pdf.line(20, yPos, 190, yPos);
            yPos += 2;
          }
        });
      } else {
        pdf.setFontSize(10);
        pdf.text('No products found for the selected filters.', 20, yPos);
      }

      // Footer
      const pageCount = pdf.internal.pages.length - 1;
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(150, 150, 150);
        pdf.text(`Page ${i} of ${pageCount}`, 105, 285, { align: 'center' });
        pdf.text(`Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, 105, 290, { align: 'center' });
      }

      const fileName = `Stock_Report_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('Error generating stock report:', error);
      throw error;
    }
  };

  const generateVendorPurchaseReport = async () => {
    try {
      // Fetch all stock entries first
      const response = await fetch(apiUrl('/api/stock-entries'));
      if (!response.ok) throw new Error('Failed to fetch stock entries for report');
      
      let stockEntries = await response.json();

      // Apply filters on client side
      if (reportFilters.vendor) {
        stockEntries = stockEntries.filter(entry => {
          const entryVendorId = entry.vendor?._id || entry.vendor;
          return String(entryVendorId) === String(reportFilters.vendor);
        });
      }

      // Filter by date range on client side
      if (reportFilters.startDate || reportFilters.endDate) {
        stockEntries = stockEntries.filter(entry => {
          const entryDate = new Date(entry.invoiceDate || entry.createdAt);
          if (reportFilters.startDate && entryDate < new Date(reportFilters.startDate)) return false;
          if (reportFilters.endDate && entryDate > new Date(reportFilters.endDate + 'T23:59:59')) return false;
          return true;
        });
      }

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Header Section
      pdf.setFontSize(18);
      pdf.setTextColor(30, 58, 138);
      pdf.setFont(undefined, 'bold');
      pdf.text(receiptSettings.receiptHeader, 105, 15, { align: 'center' });
      pdf.setFontSize(12);
      pdf.setTextColor(100, 100, 100);
      pdf.setFont(undefined, 'normal');
      pdf.text(receiptSettings.receiptSubheader, 105, 22, { align: 'center' });
      pdf.setFontSize(14);
      pdf.setTextColor(30, 58, 138);
      pdf.setFont(undefined, 'bold');
      pdf.text('Vendor Purchase Report', 105, 30, { align: 'center' });
      
      // Draw line under header
      pdf.setDrawColor(200, 200, 200);
      pdf.line(20, 35, 190, 35);
      
      let yPos = 42;

      // Report Info Section
      pdf.setFontSize(10);
      pdf.setTextColor(0, 0, 0);
      pdf.setFont(undefined, 'bold');
      pdf.text('Report Information', 20, yPos);
      yPos += 6;
      pdf.setFont(undefined, 'normal');
      
      if (reportFilters.startDate || reportFilters.endDate) {
        pdf.text(`Date Range: ${reportFilters.startDate || 'All'} to ${reportFilters.endDate || 'All'}`, 25, yPos);
        yPos += 5;
      }
      if (reportFilters.vendor) {
        const vendorName = vendors.find(v => v._id === reportFilters.vendor)?.name || 'N/A';
        pdf.text(`Vendor: ${vendorName}`, 25, yPos);
        yPos += 5;
      }
      pdf.text(`Generated on: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`, 25, yPos);
      yPos += 8;

      // Summary Section
      if (reportFilters.includeSummary && stockEntries.length > 0) {
        const totalQuantity = stockEntries.reduce((sum, e) => sum + (e.quantity || 0), 0);
        const totalCost = stockEntries.reduce((sum, e) => sum + (e.totalCost || 0), 0);
        const uniqueVendors = new Set(stockEntries.map(e => {
          const vendorId = e.vendor?._id || e.vendor;
          return vendorId ? String(vendorId) : null;
        }).filter(Boolean)).size;
        
        pdf.setFontSize(11);
        pdf.setFont(undefined, 'bold');
        pdf.setFillColor(240, 240, 240);
        pdf.rect(20, yPos - 4, 170, 6, 'F');
        pdf.text('Summary Statistics', 20, yPos);
        yPos += 7;
        
        pdf.setFont(undefined, 'normal');
        pdf.setFontSize(9);
        pdf.text(`Total Purchase Entries: ${stockEntries.length}`, 25, yPos);
        yPos += 5;
        pdf.text(`Total Quantity Purchased: ${totalQuantity}`, 25, yPos);
        yPos += 5;
        pdf.text(`Total Purchase Cost: ${formatCurrencyForPDF(totalCost)}`, 25, yPos);
        yPos += 5;
        pdf.text(`Number of Vendors: ${uniqueVendors}`, 25, yPos);
        yPos += 8;
      }

      // Purchase Entries Table
      if (stockEntries.length > 0) {
        pdf.setFontSize(11);
        pdf.setFont(undefined, 'bold');
        pdf.setFillColor(240, 240, 240);
        pdf.rect(20, yPos - 4, 170, 6, 'F');
        pdf.text('Purchase Entries', 20, yPos);
        yPos += 7;

        // Table Headers
        pdf.setFontSize(8);
        pdf.setFont(undefined, 'bold');
        pdf.setFillColor(230, 230, 230);
        pdf.rect(20, yPos - 3, 170, 5, 'F');
        pdf.text('Date', 22, yPos);
        pdf.text('Invoice', 50, yPos);
        pdf.text('Product', 80, yPos);
        pdf.text('Vendor', 120, yPos);
        pdf.text('Qty', 150, yPos);
        pdf.text('Unit Price', 160, yPos);
        pdf.text('Total', 175, yPos);
        yPos += 6;

        pdf.setFont(undefined, 'normal');
        pdf.setFontSize(8);

        stockEntries.forEach((entry, index) => {
          // Check if we need a new page
          if (yPos > 270) {
            pdf.addPage();
            yPos = 20;
            // Redraw table headers on new page
            pdf.setFont(undefined, 'bold');
            pdf.setFontSize(8);
            pdf.setFillColor(230, 230, 230);
            pdf.rect(20, yPos - 3, 170, 5, 'F');
            pdf.text('Date', 22, yPos);
            pdf.text('Invoice', 50, yPos);
            pdf.text('Product', 80, yPos);
            pdf.text('Vendor', 120, yPos);
            pdf.text('Qty', 150, yPos);
            pdf.text('Unit Price', 160, yPos);
            pdf.text('Total', 175, yPos);
            yPos += 6;
            pdf.setFont(undefined, 'normal');
          }

          const date = new Date(entry.invoiceDate || entry.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          const invoiceNumber = (entry.invoiceNumber || 'N/A').substring(0, 12);
          const productName = (entry.product?.name || 'N/A').substring(0, 15);
          const vendorName = (entry.vendor?.name || 'N/A').substring(0, 15);
          const quantity = entry.quantity || 0;
          const purchasePrice = formatCurrencyForPDF(entry.purchasePrice || 0);
          const totalCost = formatCurrencyForPDF(entry.totalCost || 0);

          // Alternate row background
          if (index % 2 === 0) {
            pdf.setFillColor(250, 250, 250);
            pdf.rect(20, yPos - 3, 170, 5, 'F');
          }

          pdf.text(date, 22, yPos);
          pdf.text(invoiceNumber, 50, yPos);
          pdf.text(productName, 80, yPos);
          pdf.text(vendorName, 120, yPos);
          pdf.text(quantity.toString(), 150, yPos);
          pdf.text(purchasePrice, 160, yPos);
          pdf.text(totalCost, 175, yPos);
          yPos += 5;

          // Draw separator line
          if (index < stockEntries.length - 1) {
            pdf.setDrawColor(220, 220, 220);
            pdf.line(20, yPos, 190, yPos);
            yPos += 2;
          }
        });
      } else {
        pdf.setFontSize(10);
        pdf.text('No purchase entries found for the selected filters.', 20, yPos);
      }

      // Footer
      const pageCount = pdf.internal.pages.length - 1;
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(150, 150, 150);
        pdf.text(`Page ${i} of ${pageCount}`, 105, 285, { align: 'center' });
        pdf.text(`Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, 105, 290, { align: 'center' });
      }

      const fileName = `Vendor_Purchase_Report_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('Error generating vendor purchase report:', error);
      throw error;
    }
  };

  const generatePDF = async () => {
    try {
      if (!reportType) {
        alert('Please select a report type');
        return;
      }

      if (reportType === 'day-end') {
        // Fetch transactions based on report filters
        const queryParams = new URLSearchParams();
        if (reportFilters.course) queryParams.append('course', reportFilters.course);
        if (reportFilters.paymentMethod) queryParams.append('paymentMethod', reportFilters.paymentMethod);
        if (reportFilters.isPaid !== '') queryParams.append('isPaid', reportFilters.isPaid);
        if (reportFilters.startDate) queryParams.append('startDate', reportFilters.startDate);
        if (reportFilters.endDate) queryParams.append('endDate', reportFilters.endDate);

        const response = await fetch(apiUrl(`/api/transactions?${queryParams.toString()}`));
        if (!response.ok) throw new Error('Failed to fetch transactions for report');
        
        let reportTransactions = await response.json();
        
        // Filter by date range on client side
        if (reportFilters.startDate || reportFilters.endDate) {
          reportTransactions = reportTransactions.filter(transaction => {
            const transDate = new Date(transaction.transactionDate);
            if (reportFilters.startDate && transDate < new Date(reportFilters.startDate)) return false;
            if (reportFilters.endDate && transDate > new Date(reportFilters.endDate + 'T23:59:59')) return false;
            return true;
          });
        }

        await generateDayEndReport(reportTransactions);
      } else if (reportType === 'stock') {
        await generateStockReport();
      } else if (reportType === 'vendor-purchase') {
        await generateVendorPurchaseReport();
      }

      setShowReportModal(false);
      setReportType('');
      alert('PDF report generated successfully!');
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF report');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 space-y-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <FileText className="text-white" size={24} />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
                <p className="text-gray-600 mt-1">Monitor transactions and generate consolidated reports</p>
              </div>
            </div>
            <button
              onClick={() => {
                setTimeout(() => {
                  setShowReportModal(true);
                }, 200);
              }}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-xl hover:from-purple-700 hover:to-purple-800 transition-all shadow-lg hover:shadow-xl font-medium self-start lg:self-auto"
            >
              <Download size={20} />
              Generate Report
            </button>
          </div>
        </div>

        <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {/* Filter Header */}
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Filter className="text-blue-600" size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
                    <p className="text-xs text-gray-500">Filter transactions by various criteria</p>
                  </div>
                </div>
                <button
                  onClick={() => setFiltersExpanded(!filtersExpanded)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  {filtersExpanded ? (
                    <>
                      <ChevronUp size={18} />
                      <span>Hide Filters</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown size={18} />
                      <span>Show More Filters</span>
                    </>
                  )}
                </button>
              </div>

              {/* Main Filters (Always Visible) */}
              <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div className="lg:col-span-2 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Search by transaction ID, student name, or student ID..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <select
                    value={filters.course}
                    onChange={(e) => setFilters({ ...filters, course: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">All Courses</option>
                    {courseOptions.map(course => (
                      <option key={course} value={course}>{course.toUpperCase()}</option>
                    ))}
                  </select>
                  <select
                    value={filters.transactionType}
                    onChange={(e) => setFilters({ ...filters, transactionType: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">All Transactions</option>
                    <option value="student">Student Transactions</option>
                    <option value="branch_transfer">Branch Transfers</option>
                  </select>
                  <select
                    value={filters.paymentMethod}
                    onChange={(e) => setFilters({ ...filters, paymentMethod: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">All Payment Methods</option>
                    <option value="cash">Cash</option>
                    <option value="online">Online</option>
                    <option value="transfer">Transfer</option>
                  </select>
                </div>

                {/* Expandable Filters Section */}
                {filtersExpanded && (
                  <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <select
                        value={filters.isPaid}
                        onChange={(e) => setFilters({ ...filters, isPaid: e.target.value })}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">All Payment Status</option>
                        <option value="true">Paid</option>
                        <option value="false">Unpaid</option>
                      </select>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                        <input
                          type="date"
                          placeholder="Start Date"
                          value={filters.startDate}
                          onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                        <input
                          type="date"
                          placeholder="End Date"
                          value={filters.endDate}
                          onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Student Transactions Table */}
            {(filters.transactionType === '' || filters.transactionType === 'student') && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Student Transactions</h3>
                  <p className="text-sm text-gray-500">Review student transactions and manage receipts</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                    {studentTransactions.length} transactions
                  </span>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600">Show:</label>
                    <select
                      value={itemsPerPage}
                      onChange={(e) => {
                        setItemsPerPage(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="px-2 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>
                </div>
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                  <p className="text-gray-600">Loading transactions...</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    {studentTransactions.length === 0 ? (
                      <div className="p-12 text-center">
                        <div className="text-6xl mb-4">📋</div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">No student transactions found</h3>
                        <p className="text-gray-600">
                          {searchTerm || Object.values(filters).some(f => f !== '')
                            ? 'Try adjusting your search criteria'
                            : 'No student transactions have been created yet'}
                        </p>
                      </div>
                    ) : (
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Course</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Items</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Amount</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment Method</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {paginatedStudentTransactions.map(transaction => (
                            <tr key={transaction._id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex flex-col">
                                  <span className="text-sm font-medium text-gray-900">{transaction.student?.name || 'N/A'}</span>
                                  <span className="text-xs text-gray-500">{transaction.student?.studentId || ''}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="text-sm text-gray-900">{transaction.student?.course?.toUpperCase() || 'N/A'}</span>
                              </td>
                              <td className="px-6 py-4">
                                <span className="text-sm text-gray-900">
                                  {transaction.items?.length || 0} item{transaction.items?.length !== 1 ? 's' : ''}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="text-sm font-semibold text-gray-900">{formatCurrency(transaction.totalAmount)}</span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {transaction.transactionType === 'branch_transfer' ? (
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    transaction.isPaid 
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-red-100 text-red-800'
                                  }`}>
                                    {transaction.isPaid ? 'Paid' : 'Unpaid'}
                                  </span>
                                ) : (
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  transaction.paymentMethod === 'cash'
                                    ? 'bg-green-100 text-green-800'
                                      : transaction.paymentMethod === 'online'
                                      ? 'bg-blue-100 text-blue-800'
                                      : 'bg-purple-100 text-purple-800'
                                  }`}>
                                    {transaction.paymentMethod === 'cash' ? 'Cash' : transaction.paymentMethod === 'online' ? 'Online' : 'Transfer'}
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  transaction.isPaid
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {transaction.isPaid ? 'Paid' : 'Unpaid'}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="text-sm text-gray-500">{formatDate(transaction.transactionDate)}</span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleViewDetails(transaction)}
                                    className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                                  >
                                    <Eye size={14} />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(transaction._id)}
                                    className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {studentTransactions.length > 0 && studentTotalPages > 1 && (
                    <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-600">
                          Showing <span className="font-medium">{studentStartIndex + 1}</span> to{' '}
                          <span className="font-medium">{Math.min(studentEndIndex, studentTransactions.length)}</span> of{' '}
                          <span className="font-medium">{studentTransactions.length}</span> transactions
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                          >
                            <ChevronLeft size={16} />
                            Previous
                          </button>

                          <div className="flex items-center gap-1">
                            {Array.from({ length: studentTotalPages }, (_, i) => i + 1).map(page => {
                              if (
                                page === 1 ||
                                page === studentTotalPages ||
                                (page >= currentPage - 1 && page <= currentPage + 1)
                              ) {
                                return (
                                  <button
                                    key={page}
                                    onClick={() => setCurrentPage(page)}
                                    className={`px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
                                      currentPage === page
                                        ? 'bg-blue-600 text-white border-blue-600'
                                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                    }`}
                                  >
                                    {page}
                                  </button>
                                );
                              } else if (page === currentPage - 2 || page === currentPage + 2) {
                                return <span key={page} className="px-2 text-gray-500">...</span>;
                              }
                              return null;
                            })}
                          </div>

                          <button
                            onClick={() => setCurrentPage(prev => Math.min(studentTotalPages, prev + 1))}
                            disabled={currentPage === studentTotalPages}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                          >
                            Next
                            <ChevronRight size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            )}

            {/* Branch Transfers Table */}
            {(filters.transactionType === '' || filters.transactionType === 'branch_transfer') && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Branch Transfers</h3>
                  <p className="text-sm text-gray-500">Review stock transfers to branches</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                    {branchTransfers.length} transfers
                  </span>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600">Show:</label>
                    <select
                      value={itemsPerPage}
                      onChange={(e) => {
                        setItemsPerPage(Number(e.target.value));
                        setBranchTransferPage(1);
                      }}
                      className="px-2 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>
                </div>
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                  <p className="text-gray-600">Loading transfers...</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    {branchTransfers.length === 0 ? (
                      <div className="p-12 text-center">
                        <div className="text-6xl mb-4">📦</div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">No branch transfers found</h3>
                        <p className="text-gray-600">
                          {searchTerm || Object.values(filters).some(f => f !== '')
                            ? 'Try adjusting your search criteria'
                            : 'No branch transfers have been created yet'}
                        </p>
                      </div>
                    ) : (
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Branch</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Items</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Amount</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {paginatedBranchTransfers.map(transaction => (
                            <tr key={transaction._id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex flex-col">
                                  <span className="text-sm font-medium text-gray-900">{transaction.branchTransfer?.branchName || 'N/A'}</span>
                                  <span className="text-xs text-gray-500">Branch Transfer</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="text-sm text-gray-900">{transaction.branchTransfer?.branchLocation || 'N/A'}</span>
                              </td>
                              <td className="px-6 py-4">
                                <span className="text-sm text-gray-900">
                                  {transaction.items?.length || 0} item{transaction.items?.length !== 1 ? 's' : ''}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="text-sm font-semibold text-gray-900">{formatCurrency(transaction.totalAmount)}</span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  transaction.isPaid 
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {transaction.isPaid ? 'Paid' : 'Unpaid'}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="text-sm text-gray-500">{formatDate(transaction.transactionDate)}</span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleViewDetails(transaction)}
                                    className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                                  >
                                    <Eye size={14} />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(transaction._id)}
                                    className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {branchTransfers.length > 0 && branchTransferTotalPages > 1 && (
                    <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-600">
                          Showing <span className="font-medium">{branchTransferStartIndex + 1}</span> to{' '}
                          <span className="font-medium">{Math.min(branchTransferEndIndex, branchTransfers.length)}</span> of{' '}
                          <span className="font-medium">{branchTransfers.length}</span> transfers
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setBranchTransferPage(prev => Math.max(1, prev - 1))}
                            disabled={branchTransferPage === 1}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                          >
                            <ChevronLeft size={16} />
                            Previous
                          </button>

                          <div className="flex items-center gap-1">
                            {Array.from({ length: branchTransferTotalPages }, (_, i) => i + 1).map(page => {
                              if (
                                page === 1 ||
                                page === branchTransferTotalPages ||
                                (page >= branchTransferPage - 1 && page <= branchTransferPage + 1)
                              ) {
                                return (
                                  <button
                                    key={page}
                                    onClick={() => setBranchTransferPage(page)}
                                    className={`px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
                                      branchTransferPage === page
                                        ? 'bg-blue-600 text-white border-blue-600'
                                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                    }`}
                                  >
                                    {page}
                                  </button>
                                );
                              } else if (
                                page === branchTransferPage - 2 ||
                                page === branchTransferPage + 2
                              ) {
                                return (
                                  <span key={page} className="px-2 text-gray-500">
                                    ...
                                  </span>
                                );
                              }
                              return null;
                            })}
                          </div>
                          <button
                            onClick={() => setBranchTransferPage(prev => Math.min(branchTransferTotalPages, prev + 1))}
                            disabled={branchTransferPage === branchTransferTotalPages}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                          >
                            Next
                            <ChevronRight size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            )}
          </div>
      </div>

      {/* Transaction Details Modal */}
      {selectedTransaction && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelectedTransaction(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Transaction Details</h2>
              <button
                onClick={() => setSelectedTransaction(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-sm text-gray-500">Transaction ID</p>
                  <p className="font-semibold">{selectedTransaction.transactionId}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Date</p>
                  <p className="font-semibold">{formatDate(selectedTransaction.transactionDate)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Student Name</p>
                  <p className="font-semibold">{selectedTransaction.student?.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Student ID</p>
                  <p className="font-semibold">{selectedTransaction.student?.studentId}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Course</p>
                  <p className="font-semibold">{selectedTransaction.student?.course?.toUpperCase()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Payment Method</p>
                  <p className="font-semibold capitalize">{selectedTransaction.paymentMethod}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Payment Status</p>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    selectedTransaction.isPaid
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {selectedTransaction.isPaid ? 'Paid' : 'Unpaid'}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Amount</p>
                  <p className="font-semibold text-lg">{formatCurrency(selectedTransaction.totalAmount)}</p>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3">Items</h3>
                <table className="w-full border-collapse">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Item Name</th>
                      <th className="px-4 py-2 text-center text-sm font-medium text-gray-700">Quantity</th>
                      <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">Unit Price</th>
                      <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedTransaction.items?.map((item, idx) => (
                      <tr key={idx} className="border-b border-gray-200">
                        <td className="px-4 py-2">{item.name}</td>
                        <td className="px-4 py-2 text-center">{item.quantity}</td>
                        <td className="px-4 py-2 text-right">{formatCurrency(item.price)}</td>
                        <td className="px-4 py-2 text-right font-semibold">{formatCurrency(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {selectedTransaction.remarks && (
                <div className="mb-6">
                  <p className="text-sm text-gray-500 mb-1">Remarks</p>
                  <p className="text-gray-900">{selectedTransaction.remarks}</p>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setSelectedTransaction(null)}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reports Modal */}
      {showReportModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.1)' }} onClick={() => {
          setShowReportModal(false);
          setReportType('');
        }}>
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-2xl font-bold text-gray-900">Generate Report</h2>
              <button
                onClick={() => {
                  setShowReportModal(false);
                  setReportType('');
                }}
                className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors"
              >
                <X size={18} className="text-gray-600" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {!reportType ? (
                // Report Type Selection
                <div className="space-y-4">
                  <p className="text-sm text-gray-600 mb-4">Select the type of report you want to generate</p>
                  <div className="grid grid-cols-1 gap-4">
                    <button
                      onClick={() => {
                        setReportType('day-end');
                        // Reset to today's date when selecting day-end report
                        setReportFilters(prev => ({
                          ...prev,
                          startDate: getTodayDate(),
                          endDate: getTodayDate(),
                        }));
                      }}
                      className="p-6 border-2 border-gray-200 rounded-xl hover:border-purple-500 hover:bg-purple-50 transition-all text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                          <Receipt className="text-purple-600" size={24} />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">Day-End Report</h3>
                          <p className="text-sm text-gray-600">Transaction report with date filters</p>
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={() => setReportType('stock')}
                      className="p-6 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Package className="text-blue-600" size={24} />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">Stock Report</h3>
                          <p className="text-sm text-gray-600">Current stock levels for all products</p>
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={() => setReportType('vendor-purchase')}
                      className="p-6 border-2 border-gray-200 rounded-xl hover:border-green-500 hover:bg-green-50 transition-all text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                          <Building2 className="text-green-600" size={24} />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">Vendor Purchase Report</h3>
                          <p className="text-sm text-gray-600">Purchase entries from vendors</p>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              ) : (
                // Report Filters based on type
                <div className="space-y-4">
                  <div className="flex items-center gap-3 mb-4">
                    <button
                      onClick={() => setReportType('')}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      ← Back
                    </button>
                    <span className="text-gray-400">|</span>
                    <span className="text-sm font-medium text-gray-700">
                      {reportType === 'day-end' && 'Day-End Report'}
                      {reportType === 'stock' && 'Stock Report'}
                      {reportType === 'vendor-purchase' && 'Vendor Purchase Report'}
                    </span>
                  </div>

                  {/* Day-End Report Filters */}
                  {reportType === 'day-end' && (
                    <>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                          <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                              type="date"
                              value={reportFilters.startDate}
                              onChange={(e) => setReportFilters({ ...reportFilters, startDate: e.target.value })}
                              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                          <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                              type="date"
                              value={reportFilters.endDate}
                              onChange={(e) => setReportFilters({ ...reportFilters, endDate: e.target.value })}
                              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Course</label>
                        <select
                          value={reportFilters.course}
                          onChange={(e) => setReportFilters({ ...reportFilters, course: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="">All Courses</option>
                          {courseOptions.map(course => (
                            <option key={course} value={course}>{course.toUpperCase()}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
                        <select
                          value={reportFilters.paymentMethod}
                          onChange={(e) => setReportFilters({ ...reportFilters, paymentMethod: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="">All Payment Methods</option>
                          <option value="cash">Cash</option>
                          <option value="online">Online</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Payment Status</label>
                        <select
                          value={reportFilters.isPaid}
                          onChange={(e) => setReportFilters({ ...reportFilters, isPaid: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="">All Payment Status</option>
                          <option value="true">Paid</option>
                          <option value="false">Unpaid</option>
                        </select>
                      </div>
                      <div className="pt-4 border-t border-gray-200 space-y-3">
                        <h3 className="text-sm font-semibold text-gray-700 mb-3">Report Options</h3>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="includeItems"
                            checked={reportFilters.includeItems}
                            onChange={(e) => setReportFilters({ ...reportFilters, includeItems: e.target.checked })}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <label htmlFor="includeItems" className="text-sm font-medium text-gray-700 cursor-pointer">
                            Include item details in report
                          </label>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="includeSummary"
                            checked={reportFilters.includeSummary}
                            onChange={(e) => setReportFilters({ ...reportFilters, includeSummary: e.target.checked })}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <label htmlFor="includeSummary" className="text-sm font-medium text-gray-700 cursor-pointer">
                            Include summary statistics
                          </label>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="onlyStatistics"
                            checked={reportFilters.onlyStatistics}
                            onChange={(e) =>
                              setReportFilters({
                                ...reportFilters,
                                onlyStatistics: e.target.checked,
                                includeSummary: e.target.checked ? true : reportFilters.includeSummary,
                                includeItems: e.target.checked ? false : reportFilters.includeItems,
                              })
                            }
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <label htmlFor="onlyStatistics" className="text-sm font-medium text-gray-700 cursor-pointer">
                            Generate statistics only (no detailed tables)
                          </label>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Stock Report Filters */}
                  {reportType === 'stock' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Course</label>
                        <select
                          value={reportFilters.course}
                          onChange={(e) => setReportFilters({ ...reportFilters, course: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="">All Courses</option>
                          {courseOptions.map(course => (
                            <option key={course} value={course}>{course.toUpperCase()}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Product Category</label>
                        <select
                          value={reportFilters.productCategory}
                          onChange={(e) => setReportFilters({ ...reportFilters, productCategory: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="">All Categories</option>
                          <option value="Notebooks">Notebooks</option>
                          <option value="Pens">Pens</option>
                          <option value="Art Supplies">Art Supplies</option>
                          <option value="Electronics">Electronics</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div className="pt-4 border-t border-gray-200 space-y-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="includeSummaryStock"
                            checked={reportFilters.includeSummary}
                            onChange={(e) => setReportFilters({ ...reportFilters, includeSummary: e.target.checked })}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <label htmlFor="includeSummaryStock" className="text-sm font-medium text-gray-700 cursor-pointer">
                            Include summary statistics
                          </label>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Vendor Purchase Report Filters */}
                  {reportType === 'vendor-purchase' && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                          <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                              type="date"
                              value={reportFilters.startDate}
                              onChange={(e) => setReportFilters({ ...reportFilters, startDate: e.target.value })}
                              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                          <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                              type="date"
                              value={reportFilters.endDate}
                              onChange={(e) => setReportFilters({ ...reportFilters, endDate: e.target.value })}
                              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Vendor</label>
                        <select
                          value={reportFilters.vendor}
                          onChange={(e) => setReportFilters({ ...reportFilters, vendor: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="">All Vendors</option>
                          {vendors.map(vendor => (
                            <option key={vendor._id} value={vendor._id}>{vendor.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="pt-4 border-t border-gray-200 space-y-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="includeSummaryVendor"
                            checked={reportFilters.includeSummary}
                            onChange={(e) => setReportFilters({ ...reportFilters, includeSummary: e.target.checked })}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <label htmlFor="includeSummaryVendor" className="text-sm font-medium text-gray-700 cursor-pointer">
                            Include summary statistics
                          </label>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Actions */}
                  <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                    <button
                      onClick={() => {
                        setShowReportModal(false);
                        setReportType('');
                      }}
                      className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={generatePDF}
                      className="px-6 py-2 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:from-purple-700 hover:to-purple-800 transition-all font-medium flex items-center gap-2"
                    >
                      <Download size={18} />
                      Generate PDF
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;