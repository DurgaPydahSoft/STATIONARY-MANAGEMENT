import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import Dashboard from './pages/Dashboard';
import StudentDetail from './pages/StudentDetail';
import CourseDashboard from './pages/CourseDashboard';
import AddStudent from './pages/AddStudent';
import StudentManagement from './pages/StudentManagement';
import Login from './pages/Login';
import SubAdminManagement from './pages/SubAdminManagement';
import ProductList from './pages/ProductList';
import HomePage from './pages/HomePage';
import CourseManagement from './pages/CourseManagement';
import Transactions from './pages/Transactions';
import { apiUrl } from './utils/api';
// import StudentReceiptModal from './pages/StudentReceipt.jsx'; // Not used

// Placeholder component for other routes
const Settings = () => <div className="placeholder-page"><h1>Settings</h1><p>This page is a placeholder for settings.</p></div>;

function App() {
  const [students, setStudents] = useState([]);
  const [itemCategories, setItemCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [currentCourse, setCurrentCourse] = useState('');
  // Initialize isAuthenticated from localStorage
  const [currentUser, setCurrentUser] = useState(() => {
    const savedUser = localStorage.getItem('currentUser');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!localStorage.getItem('isAuthenticated'));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const navigate = useNavigate();

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

  useEffect(() => {
    const fetchDataForAuthenticatedUser = async () => {
      // Persist authentication state locally for reloads
      localStorage.setItem('isAuthenticated', 'true');

      // We are using a static admin login; skip backend profile check
      // Attempt to fetch students data but do not log out on failure
      try {
        const studentsRes = await fetch(apiUrl('/api/users'));
        if (studentsRes.ok) {
          const studentsData = await studentsRes.json();
          const formattedStudents = studentsData.map(s => ({ ...s, id: s._id }));
          setStudents(formattedStudents);
        }
      } catch (error) {
        console.warn('Could not fetch students yet:', error);
      }
    };

    if (isAuthenticated) {
      fetchDataForAuthenticatedUser();
    } else {
      // Clear authentication state
      localStorage.removeItem('isAuthenticated');
      setCurrentUser(null);
    }
  }, [isAuthenticated]);

  // Fetch global products on app load to populate products and itemCategories
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch(apiUrl('/api/products'));
        if (!res.ok) throw new Error(`Server responded with ${res.status}`);
        const data = await res.json();
        setProducts(data || []);
        // Normalize product names to be used as item categories
        const cats = Array.from(new Set((data || []).map(p => p.name.toLowerCase().replace(/\s+/g, '_'))));
        setItemCategories(cats);
      } catch (err) {
        console.warn('Could not fetch products on app load:', err);
      }
    };
    fetchProducts();
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
    // Static credentials for superadmin login
    const SUPERADMIN_ID = 'superadmin';
    const SUPERADMIN_PASSWORD = 'superadmin123';

    if (id === SUPERADMIN_ID && password === SUPERADMIN_PASSWORD) {
      // On successful static login, set a placeholder user object
      const userData = {
        name: 'Super Admin',
        role: 'Administrator',
      };
      setCurrentUser(userData);
      localStorage.setItem('currentUser', JSON.stringify(userData));
      setIsAuthenticated(true);

      // ✅ CORRECTION: Navigate to the correct authenticated path for the Dashboard, which is '/'
      navigate('/');

      return true;
    }
    // Try sub-admin login via API
    try {
      const res = await fetch(apiUrl('/api/subadmins/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: id, password }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      const userData = { name: data.name, role: data.role, id: data._id };
      setCurrentUser(userData);
      localStorage.setItem('currentUser', JSON.stringify(userData));
      setIsAuthenticated(true);
      navigate('/');
      return true;
    } catch (err) {
      console.error('Sub-admin login failed:', err);
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
    <div className=" min-h-screen bg-gray-50">
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
            ${isMobile ? 'ml-0' : (sidebarOpen ? 'ml-80' : 'ml-20')}
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
                  element={<Dashboard />}
                />
                <Route
                  path="/course/:course"
                  element={<CourseDashboard products={products} />}
                />
                <Route
                  path="/student/:id"
                  element={<StudentDetail students={students} setStudents={setStudents} products={products} />}
                />
                <Route
                  path="/add-student"
                  element={<AddStudent addStudent={addStudent} />}
                />
                <Route
                  path="/student-management"
                  element={<StudentManagement students={students} setStudents={setStudents} addStudent={addStudent} />}
                />
                <Route
                  path="/sub-admin-management"
                  element={<SubAdminManagement currentUser={currentUser} />}
                />
                <Route
                  path="/items"
                  element={<ProductList itemCategories={itemCategories} addItemCategory={addItemCategory} setItemCategories={setItemCategories} currentCourse={currentCourse} products={products} setProducts={setProducts} />}
                />
                <Route path="/courses" element={<CourseManagement />} />
                <Route path="/transactions" element={<Transactions />} />
                {/* <Route
                  path="/student-receipt"
                  element={<Navigate to="/" />} // This route is no longer needed
                /> */}
                <Route path="/settings" element={<Settings />} />
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
