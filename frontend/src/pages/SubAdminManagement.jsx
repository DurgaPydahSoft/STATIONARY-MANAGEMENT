import React, { useState, useEffect } from 'react';
import { Users, Plus, Edit, Trash2, X } from 'lucide-react';
import { apiUrl } from '../utils/api';

// Sidebar menu items for permissions
const SIDEBAR_ITEMS = [
  { path: '/', label: 'Dashboard', key: 'dashboard' },
  { path: '/add-student', label: 'Add Student', key: 'add-student' },
  { path: '/student-management', label: 'Manage Students', key: 'student-management' },
  { path: '/courses', label: 'Add Courses', key: 'courses' },
  { path: '/students-dashboard', label: 'Student Dashboard', key: 'course-dashboard' },
  { path: '/manage-stock', label: 'Manage Stock', key: 'manage-stock' },
  { path: '/stock-transfers', label: 'Stock Transfers', key: 'stock-transfers' },
  { path: '/transactions', label: 'Reports', key: 'transactions' },
  { path: '/student-due', label: 'Student Due', key: 'student-due' },
  {
    path: '/audit-logs',
    label: 'Audit Logs',
    key: 'audit-logs',
    children: [
      { label: 'Audit Log Entry', key: 'audit-log-entry' },
      { label: 'Audit Approval', key: 'audit-log-approval' },
    ],
  },
  { path: '/settings', label: 'Settings', key: 'settings' },
];

const PERMISSION_LABELS = SIDEBAR_ITEMS.reduce((acc, item) => {
  if (item.children) {
    item.children.forEach(child => {
      acc[child.key] = child.label;
    });
  } else {
    acc[item.key] = item.label;
  }
  return acc;
}, {});

const normalizePermissions = (perms = []) => {
  const list = Array.isArray(perms) ? perms.slice() : [];
  const hasLegacyAudit = list.includes('audit-logs');
  const withoutLegacy = list.filter((perm) => perm && perm !== 'audit-logs');
  if (hasLegacyAudit) {
    if (!withoutLegacy.includes('audit-log-entry')) {
      withoutLegacy.push('audit-log-entry');
    }
    if (!withoutLegacy.includes('audit-log-approval')) {
      withoutLegacy.push('audit-log-approval');
    }
  }
  return Array.from(new Set(withoutLegacy));
};

// A simple modal component for creating/editing sub-admins
const SubAdminModal = ({ isOpen, onClose, onSave, subAdmin }) => {
  const [name, setName] = useState(subAdmin?.name || '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(subAdmin?.role || 'Editor');
  const [permissions, setPermissions] = useState(subAdmin?.permissions || []);

  useEffect(() => {
    if (isOpen) {
      setName(subAdmin?.name || '');
      setRole(subAdmin?.role || 'Editor');
      setPassword(''); // Always clear password field when modal opens
      const sourcePerms = Array.isArray(subAdmin?.permissions) ? subAdmin.permissions : [];
      setPermissions(normalizePermissions(sourcePerms));
    }
  }, [isOpen, subAdmin]);

  if (!isOpen) return null;

  const handlePermissionToggle = (key) => {
    setPermissions(prev => 
      prev.includes(key) 
        ? prev.filter(p => p !== key)
        : [...prev, key]
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!subAdmin && !password) {
      alert('Password is required for new sub-admins.');
      return;
    }
    // Set default role for new sub-admins and only include password if it has been set
    const submissionRole = subAdmin ? role : 'Editor';
    const cleanedPermissions = normalizePermissions(permissions);
    onSave({
      ...subAdmin,
      name,
      role: submissionRole,
      permissions: cleanedPermissions,
      ...(password && { password }),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 flex justify-center items-center z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.1)' }}>
      <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-4xl mx-4 border border-gray-200 transform transition-all duration-300 scale-100 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">{subAdmin ? 'Edit' : 'Create'} Sub-Admin</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors duration-200">
            <X size={24} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="mb-5">
            <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-2">Name</label>
            <input
              id="name"
              type="text"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter sub-admin name"
              required
            />
          </div>
          <div className="mb-6">
            <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
            <input
              id="password"
              type="password"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={subAdmin ? "Enter new password to change" : "Enter password"}
              required={!subAdmin} // Password is required only for new sub-admins
            />
          </div>
          
          {/* Permissions Section */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-3">Permissions</label>
            <p className="text-xs text-gray-500 mb-4">Select which features this sub-admin can access:</p>
            <div className="space-y-4 max-h-64 overflow-y-auto p-3 bg-indigo-50 rounded-xl border border-indigo-200">
              {SIDEBAR_ITEMS.map((item) => {
                if (item.children) {
                  const anyChildSelected = item.children.some((child) => permissions.includes(child.key));
                  return (
                    <div key={item.key} className="bg-white rounded-xl border border-indigo-200 p-3">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-semibold text-gray-800">{item.label}</span>
                        {!anyChildSelected && (
                          <span className="text-[11px] text-amber-600">No access selected</span>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {item.children.map((child) => (
                          <label
                            key={child.key}
                            className="flex items-center gap-2 p-3 bg-indigo-50/40 rounded-lg border border-indigo-200 hover:bg-indigo-50 cursor-pointer transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={permissions.includes(child.key)}
                              onChange={() => handlePermissionToggle(child.key)}
                              className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 focus:ring-2"
                            />
                            <span className="text-sm font-medium text-gray-700">{child.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                }

                return (
                  <label
                    key={item.key}
                    className="flex items-center gap-2 p-3 bg-white rounded-lg border border-indigo-200 hover:bg-indigo-50 hover:border-indigo-400 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={permissions.includes(item.key)}
                      onChange={() => handlePermissionToggle(item.key)}
                      className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 focus:ring-2"
                    />
                    <span className="text-sm font-medium text-gray-700">{item.label}</span>
                  </label>
                );
              })}
            </div>
            {permissions.length === 0 && (
              <p className="text-xs text-amber-600 mt-2">⚠️ No permissions selected. Sub-admin will have limited access.</p>
            )}
          </div>
          
          <div className="flex justify-end gap-4 mt-8">
            <button type="button" onClick={onClose} className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors duration-200">
              Cancel
            </button>
            <button type="submit" className="px-6 py-3 bg-blue-700 text-white rounded-xl font-medium hover:from-indigo-600 hover:to-indigo-700 transform hover:scale-105 transition-all duration-200 shadow-lg">
              {subAdmin ? 'Update Sub-Admin' : 'Create Sub-Admin'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const SubAdminManagement = ({ currentUser }) => {
  const [subAdmins, setSubAdmins] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubAdmin, setEditingSubAdmin] = useState(null);
  
  // Check if current user is super admin
  const isSuperAdmin = currentUser?.role === 'Administrator';

  useEffect(() => {
    const fetchSubAdmins = async () => {
      try {
        const response = await fetch(apiUrl('/api/subadmins'));
        if (!response.ok) {
          throw new Error(`Failed to load: ${response.status} ${response.statusText}`);
        }
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          throw new Error('Unexpected response from server');
        }
        const data = await response.json();
        setSubAdmins(
          (data || []).map(sa => ({
            ...sa,
            id: sa._id,
            permissions: normalizePermissions(sa.permissions),
          }))
        );
      } catch (error) {
        console.error("Failed to fetch sub-admins:", error);
      }
    };
    fetchSubAdmins();
  }, []);

  const handleCreate = () => {
    setEditingSubAdmin(null);
    setIsModalOpen(true);
  };

  const handleEdit = (subAdmin) => {
    setEditingSubAdmin(subAdmin);
    setIsModalOpen(true);
  };

  const handleDelete = (id) => {
    if (!window.confirm('Are you sure you want to delete this sub-admin?')) return;

    fetch(apiUrl(`/api/subadmins/${id}`), { method: 'DELETE' })
      .then(res => {
        if (!res.ok) throw new Error('Failed to delete');
        setSubAdmins(prev => prev.filter(sa => sa.id !== id));
      })
      .catch(err => alert(`Error: ${err.message}`));
  };

  const handleSave = async (subAdminData) => {
    const isUpdating = !!subAdminData.id;
    const url = isUpdating ? apiUrl(`/api/subadmins/${subAdminData.id}`) : apiUrl('/api/subadmins');
    const method = isUpdating ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subAdminData),
      });

      if (!response.ok) {
        // Try to parse error JSON, but fallback to status text if it fails
        const errorData = await response.json().catch(() => ({ 
          message: `Request failed with status: ${response.status} ${response.statusText}` 
        }));
        throw new Error(errorData.message || 'Save operation failed');
      }

      const savedSubAdmin = await response.json();
      const formattedAdmin = {
        ...savedSubAdmin,
        id: savedSubAdmin._id,
        permissions: normalizePermissions(savedSubAdmin.permissions),
      };

      setSubAdmins(prev => isUpdating
        ? prev.map(sa => sa.id === formattedAdmin.id ? formattedAdmin : sa)
        : [...prev, formattedAdmin]);
      setIsModalOpen(false);
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };

  return (
    <>
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-600 rounded-xl shadow-lg">
                <Users size={32} className="text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Sub-Admin Management
                </h1>
                <p className="text-gray-600 mt-1">Manage your team of sub-administrators</p>
              </div>
            </div>
          </div>

          {subAdmins.length === 0 ? (
            <div className="bg-blue-600 rounded-2xl shadow-lg p-12 text-center">
              <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-6 backdrop-blur-sm">
                <Users size={48} className="text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">No Sub-Admins Yet</h3>
              <p className="text-indigo-100 mb-6">Get started by creating your first sub-admin to help manage the system.</p>
              {isSuperAdmin && (
                <button onClick={handleCreate} className="bg-white text-blue-600 px-8 py-4 rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 inline-flex items-center gap-2">
                  <Plus size={20} />
                  Create Your First Sub-Admin
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-200">
              <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-gray-50 to-gray-100">
                <h2 className="text-lg font-semibold text-gray-900">
                  All Sub-Admins ({subAdmins.length})
                </h2>
                {isSuperAdmin && (
                  <button onClick={handleCreate} className="bg-blue-600 text-white px-6 py-2 rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 inline-flex items-center gap-2">
                    <Plus size={18} />
                    Create Sub-Admin
                  </button>
                )}
              </div>
              <div className="divide-y divide-gray-100">
                {subAdmins.map((subAdmin, index) => (
                  <div key={subAdmin.id} className={`p-6 hover:bg-indigo-50/50 transition-colors duration-200 ${index === 0 ? 'border-t-0' : ''}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-md">
                          <span className="text-white font-bold text-lg">
                            {subAdmin.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">{subAdmin.name}</h3>
                          <p className="text-sm text-gray-500">Sub-Administrator</p>
                          {Array.isArray(subAdmin.permissions) && subAdmin.permissions.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {subAdmin.permissions.slice(0, 3).map((perm) => {
                                const label = PERMISSION_LABELS[perm];
                                return label ? (
                                  <span key={perm} className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                                    {label}
                                  </span>
                                ) : null;
                              })}
                              {subAdmin.permissions.length > 3 && (
                                <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                                  +{subAdmin.permissions.length - 3} more
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(subAdmin)}
                          className="p-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-600 hover:text-indigo-700 rounded-lg transition-all duration-200 transform hover:scale-105"
                          title="Edit Sub-Admin"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(subAdmin.id)}
                          className="p-2 bg-red-100 hover:bg-red-200 text-red-600 hover:text-red-700 rounded-lg transition-all duration-200 transform hover:scale-105"
                          title="Delete Sub-Admin"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <SubAdminModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSave} subAdmin={editingSubAdmin} />
    </>
  );
};

export default SubAdminManagement;