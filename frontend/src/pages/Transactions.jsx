import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, Edit, Trash2, Receipt, Download, Eye, X, FileText, Calendar, Package, Building2 } from 'lucide-react';
import { apiUrl } from '../utils/api';
import jsPDF from 'jspdf';

const Transactions = () => {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    course: '',
    studentId: '',
    paymentMethod: '',
    isPaid: '',
    startDate: '',
    endDate: '',
  });
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [isModalOpening, setIsModalOpening] = useState(false);
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [reportType, setReportType] = useState(''); // 'day-end', 'stock', 'vendor-purchase'
  const [reportFilters, setReportFilters] = useState({
    course: '',
    paymentMethod: '',
    isPaid: '',
    startDate: '',
    endDate: '',
    includeItems: true,
    includeSummary: true,
    // For stock report
    productCategory: '',
    // For vendor purchase report
    vendor: '',
  });
  const [vendors, setVendors] = useState([]);

  useEffect(() => {
    fetchTransactions();
    fetchStudents();
    fetchVendors();
  }, []);

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
        setStudents(data);
        const uniqueCourses = Array.from(new Set(data.map(s => s.course)));
        setCourses(uniqueCourses);
      }
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [filters]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(transaction => {
      const matchesSearch = 
        transaction.transactionId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.student?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.student?.studentId?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });
  }, [transactions, searchTerm]);

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
      format: 'a4'
    });

    // Header Section
    pdf.setFontSize(18);
    pdf.setTextColor(30, 58, 138);
    pdf.setFont(undefined, 'bold');
    pdf.text('PYDAH COLLEGE OF ENGINEERING', 105, 15, { align: 'center' });
    pdf.setFontSize(12);
    pdf.setTextColor(100, 100, 100);
    pdf.setFont(undefined, 'normal');
    pdf.text('Stationery Management System', 105, 22, { align: 'center' });
    pdf.setFontSize(14);
    pdf.setTextColor(30, 58, 138);
    pdf.setFont(undefined, 'bold');
    pdf.text('Day-End Transaction Report', 105, 30, { align: 'center' });
    
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
    if (reportFilters.course) {
      pdf.text(`Course: ${reportFilters.course.toUpperCase()}`, 25, yPos);
      yPos += 5;
    }
    if (reportFilters.paymentMethod) {
      pdf.text(`Payment Method: ${reportFilters.paymentMethod.toUpperCase()}`, 25, yPos);
      yPos += 5;
    }
    if (reportFilters.isPaid !== '') {
      pdf.text(`Payment Status: ${reportFilters.isPaid === 'true' ? 'Paid' : 'Unpaid'}`, 25, yPos);
      yPos += 5;
    }
    pdf.text(`Generated on: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`, 25, yPos);
    yPos += 8;

    // Summary Section
    if (reportFilters.includeSummary && transactions.length > 0) {
      const totalAmount = transactions.reduce((sum, t) => sum + (t.totalAmount || 0), 0);
      const paidCount = transactions.filter(t => t.isPaid).length;
      const unpaidCount = transactions.length - paidCount;
      const paidAmount = transactions.filter(t => t.isPaid).reduce((sum, t) => sum + (t.totalAmount || 0), 0);
      const unpaidAmount = transactions.filter(t => !t.isPaid).reduce((sum, t) => sum + (t.totalAmount || 0), 0);
      
      pdf.setFontSize(11);
      pdf.setFont(undefined, 'bold');
      pdf.setFillColor(240, 240, 240);
      pdf.rect(20, yPos - 4, 170, 6, 'F');
      pdf.text('Summary Statistics', 20, yPos);
      yPos += 7;
      
      pdf.setFont(undefined, 'normal');
      pdf.setFontSize(9);
      pdf.text(`Total Transactions: ${transactions.length}`, 25, yPos);
      yPos += 5;
      pdf.text(`Total Amount: ${formatCurrencyForPDF(totalAmount)}`, 25, yPos);
      yPos += 5;
      pdf.text(`Paid Transactions: ${paidCount} (${formatCurrencyForPDF(paidAmount)})`, 25, yPos);
      yPos += 5;
      pdf.text(`Unpaid Transactions: ${unpaidCount} (${formatCurrencyForPDF(unpaidAmount)})`, 25, yPos);
      yPos += 8;
    }

    // Transactions Table Header
    if (transactions.length > 0) {
      pdf.setFontSize(11);
      pdf.setFont(undefined, 'bold');
      pdf.setFillColor(240, 240, 240);
      pdf.rect(20, yPos - 4, 170, 6, 'F');
      pdf.text('Transaction Details', 20, yPos);
      yPos += 7;

      // Table Headers
      pdf.setFontSize(8);
      pdf.setFont(undefined, 'bold');
      pdf.setFillColor(230, 230, 230);
      pdf.rect(20, yPos - 3, 170, 5, 'F');
      pdf.text('Date', 22, yPos);
      pdf.text('Transaction ID', 45, yPos);
      pdf.text('Student', 85, yPos);
      pdf.text('Course', 120, yPos);
      pdf.text('Amount', 150, yPos);
      pdf.text('Status', 175, yPos);
      yPos += 6;

      pdf.setFont(undefined, 'normal');
      pdf.setFontSize(8);

      transactions.forEach((transaction, index) => {
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
          pdf.text('Transaction ID', 45, yPos);
          pdf.text('Student', 85, yPos);
          pdf.text('Course', 120, yPos);
          pdf.text('Amount', 150, yPos);
          pdf.text('Status', 175, yPos);
          yPos += 6;
          pdf.setFont(undefined, 'normal');
        }

        const date = new Date(transaction.transactionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const transactionId = (transaction.transactionId || 'N/A').substring(0, 12);
        const studentName = (transaction.student?.name || 'N/A').substring(0, 15);
        const course = (transaction.student?.course || 'N/A').toUpperCase().substring(0, 8);
        const amount = formatCurrencyForPDF(transaction.totalAmount);
        const status = transaction.isPaid ? 'Paid' : 'Unpaid';

        // Alternate row background
        if (index % 2 === 0) {
          pdf.setFillColor(250, 250, 250);
          pdf.rect(20, yPos - 3, 170, 5, 'F');
        }

        pdf.text(date, 22, yPos);
        pdf.text(transactionId, 45, yPos);
        pdf.text(studentName, 85, yPos);
        pdf.text(course, 120, yPos);
        pdf.text(amount, 150, yPos);
        pdf.text(status, 175, yPos);
        yPos += 5;

        // Draw separator line
        if (index < transactions.length - 1) {
          pdf.setDrawColor(220, 220, 220);
          pdf.line(20, yPos, 190, yPos);
          yPos += 2;
        }
      });

      yPos += 5;

      // Item Details Section (if enabled)
      if (reportFilters.includeItems) {
        pdf.setFontSize(11);
        pdf.setFont(undefined, 'bold');
        pdf.setFillColor(240, 240, 240);
        pdf.rect(20, yPos - 4, 170, 6, 'F');
        pdf.text('Item Details', 20, yPos);
        yPos += 7;

        transactions.forEach((transaction, transIndex) => {
          if (transaction.items && transaction.items.length > 0) {
            // Check if we need a new page
            if (yPos > 260) {
              pdf.addPage();
              yPos = 20;
            }

            pdf.setFontSize(9);
            pdf.setFont(undefined, 'bold');
            pdf.text(`Transaction: ${transaction.transactionId || 'N/A'}`, 22, yPos);
            yPos += 5;

            // Item table header
            pdf.setFontSize(7);
            pdf.setFont(undefined, 'bold');
            pdf.setFillColor(245, 245, 245);
            pdf.rect(25, yPos - 2, 145, 4, 'F');
            pdf.text('Item Name', 27, yPos);
            pdf.text('Qty', 100, yPos);
            pdf.text('Unit Price', 115, yPos);
            pdf.text('Total', 150, yPos);
            yPos += 5;

            pdf.setFont(undefined, 'normal');
            transaction.items.forEach((item, itemIndex) => {
              if (yPos > 270) {
                pdf.addPage();
                yPos = 20;
              }

              const itemName = (item.name || 'N/A').substring(0, 30);
              const itemQty = item.quantity || 0;
              const itemPrice = formatCurrencyForPDF(item.price || 0);
              const itemTotal = formatCurrencyForPDF(item.total || 0);

              pdf.text(`${itemIndex + 1}. ${itemName}`, 27, yPos);
              pdf.text(itemQty.toString(), 100, yPos);
              pdf.text(itemPrice, 115, yPos);
              pdf.text(itemTotal, 150, yPos);
              yPos += 4;
            });

            yPos += 3;
          }
        });
      }
    } else {
      pdf.setFontSize(10);
      pdf.text('No transactions found for the selected filters.', 20, yPos);
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
      
      const products = await response.json();

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Header
      pdf.setFontSize(20);
      pdf.setTextColor(30, 58, 138);
      pdf.text('PYDAH COLLEGE OF ENGINEERING', 105, 20, { align: 'center' });
      pdf.setFontSize(14);
      pdf.setTextColor(100, 100, 100);
      pdf.text('Stock Report', 105, 30, { align: 'center' });

      // Report Info
      pdf.setFontSize(10);
      pdf.setTextColor(0, 0, 0);
      let yPos = 40;
      
      if (reportFilters.course) {
        pdf.text(`Course: ${reportFilters.course.toUpperCase()}`, 20, yPos);
        yPos += 7;
      }
      if (reportFilters.productCategory) {
        pdf.text(`Category: ${reportFilters.productCategory}`, 20, yPos);
        yPos += 7;
      }
      pdf.text(`Generated on: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, 20, yPos);
      yPos += 10;

      // Summary
      if (reportFilters.includeSummary && products.length > 0) {
        const totalStock = products.reduce((sum, p) => sum + (p.stock || 0), 0);
        const totalValue = products.reduce((sum, p) => sum + ((p.stock || 0) * (p.price || 0)), 0);
        const lowStockCount = products.filter(p => (p.stock || 0) < 10).length;
        
        pdf.setFontSize(12);
        pdf.setFont(undefined, 'bold');
        pdf.text('Summary', 20, yPos);
        yPos += 7;
        pdf.setFont(undefined, 'normal');
        pdf.setFontSize(10);
        pdf.text(`Total Products: ${products.length}`, 25, yPos);
        yPos += 7;
        pdf.text(`Total Stock Units: ${totalStock}`, 25, yPos);
        yPos += 7;
        pdf.text(`Total Stock Value: ${formatCurrencyForPDF(totalValue)}`, 25, yPos);
        yPos += 7;
        pdf.text(`Low Stock Items (<10 units): ${lowStockCount}`, 25, yPos);
        yPos += 10;
      }

      // Products list
      if (products.length > 0) {
        pdf.setFontSize(12);
        pdf.setFont(undefined, 'bold');
        pdf.text('Stock Details', 20, yPos);
        yPos += 7;

        pdf.setFontSize(9);
        pdf.setFont(undefined, 'bold');
        pdf.text('Product Name', 20, yPos);
        pdf.text('Category', 60, yPos);
        pdf.text('Course', 100, yPos);
        pdf.text('Price', 130, yPos);
        pdf.text('Stock', 150, yPos);
        pdf.text('Value', 170, yPos);
        
        pdf.setDrawColor(200, 200, 200);
        pdf.line(20, yPos + 2, 190, yPos + 2);
        yPos += 8;

        pdf.setFont(undefined, 'normal');
        pdf.setFontSize(8);

        products.forEach((product, index) => {
          if (yPos > 270) {
            pdf.addPage();
            yPos = 20;
            pdf.setFont(undefined, 'bold');
            pdf.text('Product Name', 20, yPos);
            pdf.text('Category', 60, yPos);
            pdf.text('Course', 100, yPos);
            pdf.text('Price', 130, yPos);
            pdf.text('Stock', 150, yPos);
            pdf.text('Value', 170, yPos);
            pdf.line(20, yPos + 2, 190, yPos + 2);
            yPos += 8;
            pdf.setFont(undefined, 'normal');
          }

          const productName = (product.name || 'N/A').substring(0, 25);
          const category = (product.category || 'N/A').substring(0, 15);
          const course = (product.forCourse || 'All').toUpperCase().substring(0, 8);
          const price = formatCurrencyForPDF(product.price || 0);
          const stock = product.stock || 0;
          const value = formatCurrencyForPDF((product.stock || 0) * (product.price || 0));

          pdf.text(productName, 20, yPos);
          pdf.text(category, 60, yPos);
          pdf.text(course, 100, yPos);
          pdf.text(price, 130, yPos);
          pdf.text(stock.toString(), 150, yPos);
          pdf.text(value, 170, yPos);
          yPos += 6;
        });
      } else {
        pdf.setFontSize(10);
        pdf.text('No products found for the selected filters.', 20, yPos);
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
      const queryParams = new URLSearchParams();
      if (reportFilters.vendor) queryParams.append('vendor', reportFilters.vendor);
      if (reportFilters.startDate) queryParams.append('startDate', reportFilters.startDate);
      if (reportFilters.endDate) queryParams.append('endDate', reportFilters.endDate);

      const response = await fetch(apiUrl(`/api/stock-entries?${queryParams.toString()}`));
      if (!response.ok) throw new Error('Failed to fetch stock entries for report');
      
      let stockEntries = await response.json();

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

      // Header
      pdf.setFontSize(20);
      pdf.setTextColor(30, 58, 138);
      pdf.text('PYDAH COLLEGE OF ENGINEERING', 105, 20, { align: 'center' });
      pdf.setFontSize(14);
      pdf.setTextColor(100, 100, 100);
      pdf.text('Vendor Purchase Report', 105, 30, { align: 'center' });

      // Report Info
      pdf.setFontSize(10);
      pdf.setTextColor(0, 0, 0);
      let yPos = 40;
      
      if (reportFilters.startDate || reportFilters.endDate) {
        pdf.text(`Date Range: ${reportFilters.startDate || 'All'} to ${reportFilters.endDate || 'All'}`, 20, yPos);
        yPos += 7;
      }
      if (reportFilters.vendor) {
        const vendorName = vendors.find(v => v._id === reportFilters.vendor)?.name || 'N/A';
        pdf.text(`Vendor: ${vendorName}`, 20, yPos);
        yPos += 7;
      }
      pdf.text(`Generated on: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, 20, yPos);
      yPos += 10;

      // Summary
      if (reportFilters.includeSummary && stockEntries.length > 0) {
        const totalQuantity = stockEntries.reduce((sum, e) => sum + (e.quantity || 0), 0);
        const totalCost = stockEntries.reduce((sum, e) => sum + (e.totalCost || 0), 0);
        const uniqueVendors = new Set(stockEntries.map(e => e.vendor?._id || e.vendor)).size;
        
        pdf.setFontSize(12);
        pdf.setFont(undefined, 'bold');
        pdf.text('Summary', 20, yPos);
        yPos += 7;
        pdf.setFont(undefined, 'normal');
        pdf.setFontSize(10);
        pdf.text(`Total Purchase Entries: ${stockEntries.length}`, 25, yPos);
        yPos += 7;
        pdf.text(`Total Quantity Purchased: ${totalQuantity}`, 25, yPos);
        yPos += 7;
        pdf.text(`Total Purchase Cost: ${formatCurrencyForPDF(totalCost)}`, 25, yPos);
        yPos += 7;
        pdf.text(`Number of Vendors: ${uniqueVendors}`, 25, yPos);
        yPos += 10;
      }

      // Stock Entries list
      if (stockEntries.length > 0) {
        pdf.setFontSize(12);
        pdf.setFont(undefined, 'bold');
        pdf.text('Purchase Entries', 20, yPos);
        yPos += 7;

        stockEntries.forEach((entry, index) => {
          if (yPos > 250) {
            pdf.addPage();
            yPos = 20;
          }

          pdf.setFontSize(9);
          pdf.setFont(undefined, 'bold');
          pdf.setFillColor(240, 240, 240);
          pdf.rect(20, yPos - 3, 170, 6, 'F');
          
          const date = new Date(entry.invoiceDate || entry.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          const productName = entry.product?.name || 'N/A';
          const vendorName = entry.vendor?.name || 'N/A';
          const quantity = entry.quantity || 0;
          const purchasePrice = formatCurrencyForPDF(entry.purchasePrice || 0);
          const totalCost = formatCurrencyForPDF(entry.totalCost || 0);
          const invoiceNumber = entry.invoiceNumber || 'N/A';

          pdf.text(`Date: ${date}`, 22, yPos);
          pdf.text(`Invoice: ${invoiceNumber}`, 80, yPos);
          yPos += 6;
          
          pdf.text(`Product: ${productName}`, 22, yPos);
          pdf.text(`Vendor: ${vendorName}`, 100, yPos);
          yPos += 6;
          
          pdf.text(`Quantity: ${quantity}`, 22, yPos);
          pdf.text(`Unit Price: ${purchasePrice}`, 80, yPos);
          pdf.text(`Total Cost: ${totalCost}`, 130, yPos);
          yPos += 8;

          if (entry.remarks) {
            pdf.setFontSize(8);
            pdf.text(`Remarks: ${entry.remarks}`, 22, yPos);
            yPos += 5;
          }

          if (index < stockEntries.length - 1) {
            pdf.setDrawColor(200, 200, 200);
            pdf.line(20, yPos, 190, yPos);
            yPos += 5;
          }
        });
      } else {
        pdf.setFontSize(10);
        pdf.text('No purchase entries found for the selected filters.', 20, yPos);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600">Loading transactions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Transactions</h1>
            <p className="text-gray-600 mt-1">View and manage all transactions</p>
          </div>
          <button
            onClick={() => {
              setIsModalOpening(true);
              setTimeout(() => {
                setShowReportModal(true);
                setIsModalOpening(false);
              }, 200); // 200ms delay
            }}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-xl hover:from-purple-700 hover:to-purple-800 transition-all shadow-lg hover:shadow-xl font-medium"
          >
            <FileText size={20} />
            Reports
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
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
              {courses.map(course => (
                <option key={course} value={course}>{course.toUpperCase()}</option>
              ))}
            </select>
            <select
              value={filters.paymentMethod}
              onChange={(e) => setFilters({ ...filters, paymentMethod: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Payment Methods</option>
              <option value="cash">Cash</option>
              <option value="online">Online</option>
            </select>
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
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="date"
                placeholder="Start Date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="lg:col-span-2 relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
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

        {/* Transactions Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Transaction List</h3>
              <span className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded-full">
                {filteredTransactions.length} transactions
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            {filteredTransactions.length === 0 ? (
              <div className="p-12 text-center">
                <div className="text-6xl mb-4">📋</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No transactions found</h3>
                <p className="text-gray-600">
                  {searchTerm || Object.values(filters).some(f => f !== '')
                    ? 'Try adjusting your search criteria'
                    : 'No transactions have been created yet'}
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
                  {filteredTransactions.map(transaction => (
                    <tr key={transaction._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-900">{transaction.student?.name}</span>
                          <span className="text-xs text-gray-500">{transaction.student?.studentId}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">{transaction.student?.course?.toUpperCase()}</span>
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
                          transaction.paymentMethod === 'cash'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {transaction.paymentMethod === 'cash' ? 'Cash' : 'Online'}
                        </span>
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
                      onClick={() => setReportType('day-end')}
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
                          {courses.map(course => (
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
                          {courses.map(course => (
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

export default Transactions;

