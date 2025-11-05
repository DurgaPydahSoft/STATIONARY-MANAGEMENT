📘 Stationery Management System – Feature Update Document
🔹 Objective
To enhance the existing Stationery Management System with improved product management, simplified student dashboards, transaction tracking, vendor management, and analytical reporting. These changes aim to make the system more user-friendly, transparent, and data-driven.

🛍️ 1. Product (Stationery Items) Management
1.1 Description Addition
Add a new field “Description” for each stationery item.


Should support text up to 250 characters.


Visible in both the admin item list and product detail page.


1.2 Price Management
Allow editable price fields for all items.


Display both Current Price and Last Updated Date.


Maintain a price history log (optional future enhancement).


1.3 Remarks Section
In the Product Details Page, include a “Remarks” section for internal/admin notes (e.g., damaged stock, limited quantity, supplier issue).



🎓 2. Student Dashboard Updates
2.1 Search & Filter Simplification
Remove filters (branch, semester, etc.).


Add a single universal search bar that searches by:


Student Name


Roll Number


Admission Number


2.2 Receipt Module Enhancements
a. Item History
Add a section in each student’s receipt page showing “Items Previously Taken”.


Display item name, quantity, date of issue, and total cost.


b. Payment Methods
Support Cash Transactions only for now.


Keep structure ready for Online Payments integration later.


c. Student Data Fetching
Student details (name, roll no, course, year) should be auto-fetched from the student database when entering a roll number.


d. Payment Status
Automatically update payment status (Paid / Pending) based on the transaction.


e. Bulk Upload of Students
Add a feature to upload student data in bulk using an Excel (.xlsx/.csv) file.


Include validation for duplicates and missing mandatory fields.


f. Fee Collection Module
Introduce a dedicated fee collection module that allows:


Fee collection for stationery items.


Auto-generation of receipts with date, items, and amount.


Transaction linking to student ID.



📅 3. Day-End Transaction Report
3.1 Report Contents
Total number of transactions for the day.


Total amount collected (Cash-based for now).


Summary of items sold.


3.2 Date Range Export
Admin should be able to select any date range and export:


PDF report of transactions.


Include fields: Date, Student ID, Name, Items Purchased, Amount, and Payment Status.



💰 4. Due Report & Analytics
4.1 Due Report
Generate a list of students with unpaid dues.


Show:


Student name


Roll number


Total due amount


Last transaction date


4.2 Analytics Dashboard
Graphical analytics showing:


Total dues by branch/year.


Monthly due trends.


Top 10 students with highest dues.



✏️ 5. Manual Item Entry (Add-Ons)
5.1 Single Item Purchases
Allow manual entry for ad-hoc items like:


Pen


Record Book


Scale


Files, etc.


These will be available as default add-on options for every student during billing.



🏭 6. Vendor Management
6.1 Vendor Creation
Add module for creating new vendors with fields:


Vendor Name


Contact Number


Address


Email ID (optional)


6.2 Stock Incoming
While adding new stock, capture:


Vendor Name (dropdown)


Invoice Number


Date of Supply


Item Name


Quantity Received


Price per Unit


Total Amount


6.3 Stock Report
Maintain a day-end stock report showing:


Opening Stock


Stock Added


Stock Sold


Closing Stock


Stock Value Summary



📊 7. Reports Summary
Report Type
Description
Export Option
Day-End Report
Daily summary of transactions
PDF
Due Report
Students with pending payments
PDF / Excel
Stock Report
Stock movement summary
PDF
Vendor Purchase Report
Vendor-wise purchase history
PDF


✅ 8. Future Enhancements
Integration with Online Payment Gateway (Razorpay / PhonePe Business).
