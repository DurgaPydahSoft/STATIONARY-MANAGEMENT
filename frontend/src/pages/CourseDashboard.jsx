import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Search, Edit, Trash2 } from 'lucide-react';
import StudentReceiptModal from './StudentReceipt.jsx';

const CourseDashboard = ({ products = [] }) => {
  const { course } = useParams();
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [yearFilter, setYearFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/users/${course}`);
        if (response.ok) {
          const data = (await response.json()).map(s => ({...s, id: s._id}));
          setStudents(data);
        }
      } catch (error) {
        console.error('Error fetching students:', error);
      } finally {
        setLoading(false);
      }
    };

    if (course) {
      fetchStudents();
    }
  }, [course]);

  // Effect to keep selectedStudent in sync with the main students list
  useEffect(() => {
    if (selectedStudent) {
      const updatedStudent = students.find(s => s.id === selectedStudent.id);
      setSelectedStudent(updatedStudent || null);
    }
  }, [students, selectedStudent]);

  const filteredStudents = useMemo(() => {
    return students.filter(student => {
      const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           student.studentId.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesYear = yearFilter === 'all' || String(student.year) === String(yearFilter);
      const matchesBranch = branchFilter === 'all' || String(student.branch || '').toLowerCase() === String(branchFilter).toLowerCase();
      return matchesSearch && matchesYear && matchesBranch;
    });
  }, [students, searchTerm, yearFilter, branchFilter]);

  const handleStudentUpdate = (studentId, updateData) => {
    const updatedStudents = students.map(student => {
      if (student.id === studentId) {
        const updatedStudent = { ...student, ...updateData };
        
        fetch(`/api/users/${course}/${student._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paid: updatedStudent.paid, items: updatedStudent.items }),
        }).catch(err => console.error('Failed to update student:', err));

        return updatedStudent;
      }
      return student;
    });
    setStudents(updatedStudents);
  };
  
  const handleItemToggle = (studentId, itemName) => {
    const student = students.find(s => s.id === studentId);
    if (!student) return;
    const newItems = { ...(student.items || {}), [itemName]: !Boolean(student.items && student.items[itemName]) };
    handleStudentUpdate(studentId, { items: newItems });
  };

  const handlePaidToggle = (studentId) => {
    const student = students.find(s => s.id === studentId);
    if (!student) return;
    handleStudentUpdate(studentId, { paid: !student.paid });
  };

  const yearOptions = Array.from(new Set(students.map(s => s.year))).sort((a, b) => a - b);
  const branchOptions = Array.from(new Set(students.map(s => s.branch).filter(Boolean))).sort();

  const getCourseIcon = (course) => {
    switch (course) {
      case 'b.tech':
        return '🎓';
      case 'diploma':
        return '📜';
      case 'degree':
        return '🎖️';
      default:
        return '📚';
    }
  };

  const getCourseColor = (course) => {
    switch (course) {
      case 'b.tech':
        return 'from-blue-500 to-blue-700';
      case 'diploma':
        return 'from-blue-500 to-blue-500';
      case 'degree':
        return 'from-blue-400 to-cyan-400';
      default:
        return 'from-green-400 to-teal-400';
    }
  };

  const StudentRow = ({ student }) => {
    const handleDelete = () => {
      if (window.confirm('Are you sure you want to delete this student?')) {
        fetch(`/api/users/${course}/${student._id}`, { method: 'DELETE' })
          .then(res => {
            if (res.ok) {
              setStudents(prev => prev.filter(s => s.id !== student.id));
            } else {
              throw new Error('Delete failed');
            }
          })
          .catch(err => console.error('Delete failed:', err));
      }
    };

    return (
      <tr 
        key={student.id} 
        onClick={() => setSelectedStudent(student)}
        className="border-b border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer"
      >
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex items-center">
            <span className="font-medium text-gray-900">{student.name}</span>
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            {student.studentId}
          </span>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Year {student.year}
          </span>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          {student.branch || 'N/A'}
        </td>
        <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-2">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={student.paid}
                onChange={() => handlePaidToggle(student.id)}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
            <span className={`text-sm font-medium ${student.paid ? 'text-green-600' : 'text-red-600'}`}>
              {student.paid ? 'Paid' : 'Unpaid'}
            </span>
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
          <div className="flex gap-2">
            <button 
              className="flex items-center gap-1 px-3 py-1 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
              onClick={(e) => { e.stopPropagation(); navigate(`/student/${student.id}`); }}
            >
              <Edit size={14} />
              <span className="hidden sm:inline">Edit</span>
            </button>
            <button 
              className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
              onClick={(e) => { e.stopPropagation(); handleDelete(e); }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </td>
      </tr>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600">Loading {course} students...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8">
          <div className="flex items-center gap-4 mb-4 lg:mb-0">
            <div className={`w-12 h-12 bg-gradient-to-r ${getCourseColor(course)} rounded-xl flex items-center justify-center text-white text-2xl`}>
              {getCourseIcon(course)}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{course.toUpperCase()} Students</h1>
              <p className="text-gray-600">
                {students.length} {students.length === 1 ? 'student' : 'students'} enrolled
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <button 
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              onClick={() => navigate('/')}
            >
              <ArrowLeft size={16} />
              Dashboard
            </button>
            <button 
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              onClick={() => navigate('/add-student')}
            >
              <Plus size={16} />
              Add Student
            </button>
          </div>
        </div>

        {/* Controls Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
            <div className="flex-1 w-full lg:w-auto relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search by name or student ID..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-3 w-full lg:w-auto">
              <select
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent flex-1 lg:flex-none"
              >
                <option value="all">All Years</option>
                {yearOptions.map(year => (
                  <option key={year} value={year}>Year {year}</option>
                ))}
              </select>
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent flex-1 lg:flex-none"
              >
                <option value="all">All Branches</option>
                {branchOptions.map(branch => (
                  <option key={branch} value={branch}>{branch}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Students Table */}
        <div>
          {filteredStudents.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <div className="text-6xl mb-4">👥</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No students found</h3>
              <p className="text-gray-600 mb-6">
                {searchTerm || yearFilter !== 'all' || branchFilter !== 'all'
                  ? 'Try adjusting your search criteria'
                  : 'Start by adding students to this course'
                }
              </p>
              {!searchTerm && yearFilter === 'all' && branchFilter === 'all' && (
                <button 
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  onClick={() => navigate('/add-student')}
                >
                  Add First Student
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Student List</h3>
                  <span className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded-full">
                    {filteredStudents.length} students
                  </span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Year</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Branch</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredStudents.map(student => (
                      <StudentRow key={student.id} student={student} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {selectedStudent && (
          <StudentReceiptModal
            student={selectedStudent}
            products={products}
            onClose={() => setSelectedStudent(null)}
            onItemToggle={handleItemToggle}
          />
        )}
      </div>
    </div>
  );
};

export default CourseDashboard;
