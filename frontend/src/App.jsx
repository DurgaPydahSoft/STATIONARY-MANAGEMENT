import { useCallback, useEffect, useRef, useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import Dashboard from './pages/Dashboard';
import StudentDetail from './pages/StudentDetail';
import StudentDashboard from './pages/StudentDashboard';
import AddStudent from './pages/AddStudent';
import StudentManagement from './pages/StudentManagement';
import Login from './pages/Login';
import SubAdminManagement from './pages/SubAdminManagement';
import ManageStock from './pages/ManageStock';
import HomePage from './pages/HomePage';
import CourseManagement from './pages/CourseManagement';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import ProtectedRoute from './components/ProtectedRoute';
import { apiUrl } from './utils/api';
import useOnlineStatus from './hooks/useOnlineStatus';
import { loadJSON, saveJSON } from './utils/storage';

const resolveDefaultPath = (user) => {
  if (!user) return '/login';
  if (user.role === 'Administrator') return '/';

  const permissions = user.permissions || [];
  const priorityPaths = [
    { key: 'dashboard', path: '/' },
    { key: 'add-student', path: '/add-student' },
    { key: 'student-management', path: '/student-management' },
    { key: 'course-dashboard', path: '/students-dashboard' },
    { key: 'courses', path: '/courses' },
    { key: 'manage-stock', path: '/manage-stock' },
    { key: 'transactions', path: '/transactions' },
    { key: 'settings', path: '/settings' },
  ];

  for (const item of priorityPaths) {
    if (permissions.includes(item.key)) {
      return item.path;
    }
  }

  return '/';
};

const DefaultRoute = ({ currentUser }) => {
  const targetPath = resolveDefaultPath(currentUser);

  if (targetPath !== '/') {
    return <Navigate to={targetPath} replace />;
  }

  return <Dashboard />;
};
// import StudentReceiptModal from './pages/StudentReceipt.jsx'; // Not used

function App() {
  const [students, setStudents] = useState(() => loadJSON('studentsCache', []));
  const [itemCategories, setItemCategories] = useState(() => loadJSON('itemCategoriesCache', []));
  const [products, setProducts] = useState(() => loadJSON('productsCache', []));
  const [currentCourse, setCurrentCourse] = useState('');
  // Initialize isAuthenticated from localStorage
  const [currentUser, setCurrentUser] = useState(() => {
    const savedUser = localStorage.getItem('currentUser');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!localStorage.getItem('isAuthenticated'));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [pendingTransactions, setPendingTransactions] = useState(() => loadJSON('pendingTransactions', []));
  const isOnline = useOnlineStatus();
  const navigate = useNavigate();
  const processingQueueRef = useRef(false);

  // Check for mobile view
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
      setSidebarOpen(window.innerWidth > 768); // Open on desktop, closed on mobile
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const fetchStudentsData = useCallback(async () => {
    if (!isAuthenticated) return;
    // Persist authentication state locally for reloads
    localStorage.setItem('isAuthenticated', 'true');

    try {
      const studentsRes = await fetch(apiUrl('/api/users'));
      if (studentsRes.ok) {
        const studentsData = await studentsRes.json();
        const formattedStudents = studentsData.map(s => ({ ...s, id: s._id }));
        setStudents(formattedStudents);
        saveJSON('studentsCache', formattedStudents);
      }
    } catch (error) {
      console.warn('Could not fetch students yet:', error);
    }
  }, [isAuthenticated]);

  const fetchProductsData = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/products'));
      if (!res.ok) throw new Error(`Server responded with ${res.status}`);
      const data = await res.json();
      setProducts(data || []);
      saveJSON('productsCache', data || []);
    } catch (err) {
      console.warn('Could not fetch products on app load:', err);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && isOnline) {
      fetchStudentsData();
    } else if (!isAuthenticated) {
      // Clear authentication state
      localStorage.removeItem('isAuthenticated');
      setCurrentUser(null);
    }
  }, [isAuthenticated, isOnline, fetchStudentsData]);

  useEffect(() => {
    if (isOnline) {
      fetchProductsData();
    }
  }, [isOnline, fetchProductsData]);

  useEffect(() => {
    if (!Array.isArray(products)) return;
    const cats = Array.from(new Set((products || []).map(p => p.name?.toLowerCase().replace(/\s+/g, '_')).filter(Boolean)));
    setItemCategories(cats);
    saveJSON('itemCategoriesCache', cats);
  }, [products]);

  useEffect(() => {
    if (Array.isArray(students)) {
      saveJSON('studentsCache', students);
    }
  }, [students]);

  useEffect(() => {
    saveJSON('productsCache', products);
  }, [products]);

  useEffect(() => {
    saveJSON('pendingTransactions', pendingTransactions);
  }, [pendingTransactions]);

  useEffect(() => {
    if (!isOnline || pendingTransactions.length === 0 || processingQueueRef.current) {
      return;
    }

    let isCancelled = false;
    const processQueue = async () => {
      processingQueueRef.current = true;
      const remaining = [];
      let processedAny = false;

      for (const item of pendingTransactions) {
        if (isCancelled) break;
        try {
          const response = await fetch(apiUrl('/api/transactions'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item.payload),
          });

          if (!response.ok) {
            throw new Error(`Failed to sync queued transaction (${response.status})`);
          }

          processedAny = true;
        } catch (error) {
          console.warn('Failed to process queued transaction:', error);
          remaining.push(item);
        }
      }

      if (!isCancelled) {
        setPendingTransactions(remaining);
        if (processedAny) {
          await fetchStudentsData();
          await fetchProductsData();
        }
      }
      processingQueueRef.current = false;
    };

    processQueue();

    return () => {
      isCancelled = true;
    };
  }, [isOnline, pendingTransactions, fetchStudentsData, fetchProductsData]);

  const queueOfflineTransaction = useCallback((queuedTransaction, optimisticStudent) => {
    setPendingTransactions(prev => [...prev, queuedTransaction]);
    if (optimisticStudent) {
      setStudents(prev => {
        const exists = prev.some(s => String(s.id) === String(optimisticStudent.id));
        const updated = exists
          ? prev.map(s => (String(s.id) === String(optimisticStudent.id) ? optimisticStudent : s))
          : [...prev, optimisticStudent];
        saveJSON('studentsCache', updated);
        return updated;
      });
    }
  }, []);

  // Listen to item category edit/delete events dispatched from ProductList
  useEffect(() => {
    const onRemove = (e) => {
      const name = e.detail;
      setItemCategories((prev) => prev.filter((i) => i !== name));
      // Remove the item key from all students
      setStudents((prev) => prev.map(s => {
        if (!s.items) return s;
        const { [name]: removed, ...rest } = s.items;
        return { ...s, items: rest };
      }));
    };

    const onEdit = (e) => {
      const { oldVal, newVal } = e.detail;
      const normalizedNew = newVal.toLowerCase().replace(/\s+/g, '_');
      setItemCategories((prev) => prev.map(i => i === oldVal ? normalizedNew : i));
      setStudents((prev) => prev.map(s => {
        const items = s.items || {};
        if (items.hasOwnProperty(oldVal)) {
          const val = items[oldVal];
          const { [oldVal]: removed, ...rest } = items;
          return { ...s, items: { ...rest, [normalizedNew]: val } };
        }
        return s;
      }));
    };

    window.addEventListener('removeItemCategory', onRemove);
    window.addEventListener('editItemCategory', onEdit);
    return () => {
      window.removeEventListener('removeItemCategory', onRemove);
      window.removeEventListener('editItemCategory', onEdit);
    };
  }, []);

  const addStudent = async (newStudent) => {
    try {
      // The newStudent object from the form should now contain name, studentId, course, and year
      // We'll add the other required fields before sending to the backend.
      const studentWithDefaults = {
        ...newStudent,
        email: `${newStudent.studentId}@pydah.com`, // Example email generation
        password: 'password123', // Default or generated password
      };
      // Use the correct relative endpoint for registration
      const response = await fetch(apiUrl('/api/users/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(studentWithDefaults),
      });

      if (!response.ok) {
        // Try to parse error JSON, but fallback to status text if it fails
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        if (response.status === 404) {
          throw new Error('API endpoint not found. Is the backend server running on port 5000?');
        }
        throw new Error(errorData.message || 'Failed to add student');
      }

      // The backend likely wraps the new user in a property, e.g., { user: { ... } }
      const responseData = await response.json();
      const savedStudent = responseData.user || responseData; // Adjust if the property name is different

      setStudents((prevStudents) => [...prevStudents, { ...savedStudent, id: savedStudent._id }]);
      return { success: true };
    } catch (error) {
      console.error('Error adding student:', error);
      return { success: false, message: error.message };
    }
  };

  const addItemCategory = (newItem) => {
    // This method now only updates client-side categories; server products are source of truth
    if (itemCategories.includes(newItem) || newItem.trim() === '') return;
    const newItemCategory = newItem.toLowerCase().replace(/\s+/g, '_');
    setItemCategories((prev) => [...prev, newItemCategory]);
  };

  const handleLogin = async (id, password) => {
    try {
      const res = await fetch(apiUrl('/api/subadmins/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: id, password }),
      });

      if (!res.ok) {
        return false;
      }

      const data = await res.json();
      const userData = {
        name: data.name,
        role: data.role || 'Editor',
        id: data._id,
        permissions: data.permissions || [],
      };

      setCurrentUser(userData);
      localStorage.setItem('currentUser', JSON.stringify(userData));
      setIsAuthenticated(true);
      navigate('/');
      return true;
    } catch (err) {
      console.error('Login failed:', err);
      return false;
    }
  };

  const handleLogout = () => {
    // It's good practice to also notify the backend of logout
    fetch(apiUrl('/api/auth/logout'), { method: 'POST' }).catch(err => console.warn("Logout notification failed", err));
    localStorage.removeItem('currentUser');
    localStorage.removeItem('isAuthenticated');
    setIsAuthenticated(false);
    setCurrentUser(null);
    // The component will re-render to the public routes, and the Navigate path="*" will send them to "/" (HomePage)
  };

  return (
    <div className={`min-h-screen bg-gray-50 ${!isOnline ? 'pt-16' : ''}`}>
      {!isOnline && (
        <div className="fixed top-2 left-0 right-0 z-[60] flex justify-center px-4 pointer-events-none">
          <div className="bg-red-500 text-white  text-sm font-medium py-2.5 px-4 rounded-full shadow-lg pointer-events-auto flex items-center gap-2 max-w-4xl w-full justify-center">
            <span className="text-base leading-none">📡</span>
            <span className="text-center">
              You’re offline. Showing cached data edits will sync as soon as you reconnect.
            </span>
          </div>
        </div>
      )}
      {isAuthenticated ? (
        <>
          <Sidebar 
            onLogout={handleLogout} 
            isMobile={isMobile}
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
            currentUser={currentUser}
          />
          <main className={`
            flex-1 min-h-screen bg-gray-50 flex justify-center items-start transition-all duration-300
            ${isMobile ? 'ml-0' : (sidebarOpen ? 'ml-52' : 'ml-20')}
            ${isMobile ? 'pt-20 px-4' : 'px-8'}
            }
          `}>
            {isMobile && (
              <button 
                className="fixed top-4 left-4 z-50 w-12 h-12 rounded-xl bg-primary-500 border-none text-white flex items-center justify-center cursor-pointer shadow-strong transition-all duration-200 hover:bg-primary-600 hover:scale-105"
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                <Menu size={24} />
              </button>
            )}
            <div className="w-full  mx-auto">
              <Routes>
                {/* Dashboard is the default route for authenticated users */}
                <Route
                  path="/"
                  element={<DefaultRoute currentUser={currentUser} />}
                />
                <Route
                  path="/students-dashboard"
                  element={
                    <ProtectedRoute currentUser={currentUser} requiredPermissions={["student-dashboard", "course-dashboard"]}>
                      <StudentDashboard
                        initialStudents={students}
                        isOnline={isOnline}
                      />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/student/:id"
                  element={
                    <ProtectedRoute currentUser={currentUser} requiredPermissions={["student-management", "student-dashboard", "course-dashboard"]}>
                      <StudentDetail
                        students={students}
                        setStudents={setStudents}
                        products={products}
                        setProducts={setProducts}
                        onQueueTransaction={queueOfflineTransaction}
                        isOnline={isOnline}
                        pendingTransactions={pendingTransactions}
                      />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/add-student"
                  element={
                    <ProtectedRoute currentUser={currentUser} requiredPermission="add-student">
                      <AddStudent addStudent={addStudent} />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/student-management"
                  element={
                    <ProtectedRoute currentUser={currentUser} requiredPermission="student-management">
                      <StudentManagement students={students} setStudents={setStudents} addStudent={addStudent} />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/sub-admin-management"
                  element={
                    <ProtectedRoute currentUser={currentUser} superAdminOnly={true}>
                      <SubAdminManagement currentUser={currentUser} />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/manage-stock"
                  element={
                    <ProtectedRoute currentUser={currentUser} requiredPermission="manage-stock">
                      <ManageStock itemCategories={itemCategories} addItemCategory={addItemCategory} setItemCategories={setItemCategories} currentCourse={currentCourse} products={products} setProducts={setProducts} />
                    </ProtectedRoute>
                  }
                />
                <Route 
                  path="/courses" 
                  element={
                    <ProtectedRoute currentUser={currentUser} requiredPermission="courses">
                      <CourseManagement />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/transactions" 
                  element={
                    <ProtectedRoute currentUser={currentUser} requiredPermission="transactions">
                      <Reports />
                    </ProtectedRoute>
                  } 
                />
                {/* <Route
                  path="/student-receipt"
                  element={<Navigate to="/" />} // This route is no longer needed
                /> */}
                <Route 
                  path="/settings" 
                  element={
                    <ProtectedRoute currentUser={currentUser} requiredPermission="settings">
                      <Settings />
                    </ProtectedRoute>
                  } 
                />
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </div>
          </main>
        </>
      ) : (
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<Login onLogin={handleLogin} />} />
          {/* Unauthenticated users attempting to access any other path are redirected to HomePage ('/') */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      )}
    </div>
  );
}

export default App;
