import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, PlusCircle, Users, List, Settings, LogOut, ChevronLeft, ChevronRight, Menu, UserPlus, X, User, GraduationCap, Receipt } from 'lucide-react';

const Sidebar = ({ onLogout, isMobile: isMobileProp, sidebarOpen, setSidebarOpen, currentUser }) => {
  const location = useLocation();

  // Close sidebar when clicking outside on mobile
  useEffect(() => {
    if (isMobileProp && sidebarOpen) {
      const handleClickOutside = (event) => {
        const sidebar = document.querySelector('.sidebar-modern');
        if (sidebar && !sidebar.contains(event.target)) {
          setSidebarOpen(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isMobileProp, sidebarOpen, setSidebarOpen]);

  // Check if current user is super admin
  const isSuperAdmin = currentUser?.role === 'Administrator';

  const menuItems = [
    { path: '/', label: 'Dashboard', icon: Home, exact: true },
    { path: '/add-student', label: 'Add Student', icon: PlusCircle },
    { path: '/student-management', label: 'Manage Students', icon: Users },
    { path: '/sub-admin-management', label: 'Manage Sub-Admins', icon: UserPlus, superAdminOnly: true },
    { path: '/courses', label: 'Add Courses', icon: GraduationCap },
    { path: '/items', label: 'Manage Products', icon: List },
    { path: '/transactions', label: 'Transactions', icon: Receipt },
    { path: '/settings', label: 'Settings', icon: Settings },
  ].filter(item => !item.superAdminOnly || isSuperAdmin);

  const handleToggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileProp && sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-40" 
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Main Sidebar Container */}
      <aside className={`
        fixed left-0 top-0 h-full bg-gradient-to-b from-slate-700 to-slate-800 border-r border-slate-600 flex flex-col z-50 shadow-2xl transition-all duration-300
        ${isMobileProp 
          ? `w-60 ${!sidebarOpen ? '-translate-x-full' : 'translate-x-0'}` 
          : `${!sidebarOpen ? 'w-20' : 'w-80'}`
        }
      `}>
        
        {/* Header Section */}
        <div className="p-4 border-b border-slate-600 bg-gradient-to-r from-slate-800 to-slate-700">
          <div className="flex items-center justify-between">
            {sidebarOpen && (
              <div className="flex items-center gap-3">
                <div className="flex flex-col leading-tight">
                  <span className="text-lg font-bold text-white">Pydah Group</span>
                  <span className="text-sm text-slate-300 font-medium">Stationery Management</span>
                </div>
              </div>
            )}
            
            {/* Toggle Button */}
            {isMobileProp ? (
              <button 
                className="w-8 h-8 rounded-lg bg-slate-600 border border-slate-500 flex items-center justify-center cursor-pointer text-white transition-all duration-200 hover:bg-slate-500 hover:scale-105 shadow-sm"
                onClick={handleToggleSidebar}
                title="Close menu"
              >
                <X size={20} />
              </button>
            ) : (
              <button 
                className="w-7 h-7 bg-blue-500 text-white border border-blue-400 flex items-center justify-center cursor-pointer transition-all duration-200 hover:bg-blue-600 hover:scale-105 shadow-sm rounded"
                onClick={handleToggleSidebar}
                title={!sidebarOpen ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {!sidebarOpen ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
              </button>
            )}
          </div>
        </div>

        {/* Navigation Menu */}
        <div className="flex-1 py-6 overflow-y-auto">
          <ul className="space-y-2 px-3">
            {menuItems.map((item) => {
              const IconComponent = item.icon;
              const isActive = item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path);
              
              return (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    end={item.exact}
                    className={`
                      flex items-center gap-3 px-3 py-3 text-sm font-medium rounded-xl transition-all duration-200 relative group
                      ${isActive 
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg' 
                        : 'text-slate-300 hover:bg-slate-600 hover:text-white hover:translate-x-1'
                      }
                      ${!sidebarOpen ? 'justify-center px-2' : ''}
                    `}
                    title={!sidebarOpen ? item.label : ''}
                  >
                    <IconComponent size={20} className="flex-shrink-0" />
                    {sidebarOpen && <span className="truncate">{item.label}</span>}
                    {isActive && sidebarOpen && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-400 rounded-r-full"></div>
                    )}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Footer Section - User Info & Logout */}
        <div className="p-4 border-t border-slate-600 bg-slate-750">
          {/* User Info */}
          {sidebarOpen && currentUser && (
            <div className="flex items-center gap-3 mb-4 p-3 bg-slate-700 rounded-xl">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-400 to-blue-600 flex items-center justify-center text-white shadow-md">
                <User size={20} />
              </div>
              <div className="flex flex-col leading-tight flex-1 min-w-0">
                <span className="font-semibold text-sm text-white truncate">{currentUser.name}</span>
                <span className="text-xs text-slate-300">
                  {isSuperAdmin ? 'Administrator' : 'Sub-Administrator'}
                </span>
              </div>
            </div>
          )}
          
          {/* Logout Button */}
          <button 
            className={`
              w-full flex items-center gap-3 px-3 py-3 bg-slate-700 border border-slate-600 rounded-xl text-slate-300 font-medium text-sm cursor-pointer transition-all duration-200 text-left hover:bg-red-500 hover:border-red-400 hover:text-white hover:shadow-md
              ${!sidebarOpen ? 'justify-center' : ''}
            `}
            onClick={onLogout}
            title={!sidebarOpen ? 'Logout' : ''}
          >
            <LogOut size={18} className="flex-shrink-0" />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;