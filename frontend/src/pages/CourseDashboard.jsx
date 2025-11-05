import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Search, Edit, Trash2, User } from 'lucide-react';
import { apiUrl } from '../utils/api';

const CourseDashboard = ({ products = [] }) => {
  const { course } = useParams();
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [yearFilter, setYearFilter] = useState('all');
  const [config, setConfig] = useState(null);
  const [courseIndex, setCourseIndex] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch academic config to get course info
        const configRes = await fetch(apiUrl('/api/config/academic'));
        if (configRes.ok) {
          const configData = await configRes.json();
          setConfig(configData);
          const coursesList = configData.courses || [];
          const courseIdx = coursesList.findIndex(c => c.name === course);
          setCourseIndex(courseIdx >= 0 ? courseIdx : 0);
        }
        
        // Fetch students
        if (course) {
          const response = await fetch(apiUrl(`/api/users/${course}`));
          if (response.ok) {
            const data = (await response.json()).map(s => ({...s, id: s._id}));
            setStudents(data);
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (course) {
      fetchData();
    }
  }, [course]);


  const filteredStudents = useMemo(() => {
    return students.filter(student => {
      const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           student.studentId.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesYear = yearFilter === 'all' || String(student.year) === String(yearFilter);
      return matchesSearch && matchesYear;
    });
  }, [students, searchTerm, yearFilter]);

  const handleStudentUpdate = (studentId, updateData) => {
    const updatedStudents = students.map(student => {
      if (student.id === studentId) {
        const updatedStudent = { ...student, ...updateData };
        
        fetch(apiUrl(`/api/users/${course}/${student._id}`), {
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


  const yearOptions = Array.from(new Set(students.map(s => s.year))).sort((a, b) => a - b);

  const getCourseIcon = (index) => {
    const icons = ['🎓', '📜', '🎖️', '💼', '💻', '📚', '📖', '🎯', '⭐', '🏆', '📝', '📋', '📊', '🔬', '⚗️', '🧪'];
    return icons[index % icons.length];
  };

  const getCourseColor = (index) => {
    const colors = [
      'from-blue-500 to-blue-700',
      'from-cyan-500 to-cyan-600',
      'from-green-500 to-green-600',
      'from-purple-500 to-purple-600',
      'from-orange-500 to-orange-600',
      'from-pink-500 to-pink-600'
    ];
    return colors[index % colors.length];
  };

  const StudentRow = ({ student }) => {
    const handleDelete = () => {
      if (window.confirm('Are you sure you want to delete this student?')) {
        fetch(apiUrl(`/api/users/${course}/${student._id}`), { method: 'DELETE' })
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
        onClick={() => navigate(`/student/${student.id}`)}
        className="border-b border-gray-100 hover:bg-blue-50 transition-colors cursor-pointer group"
      >
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-white text-sm font-bold shadow-md">
              {student.name
                .split(' ')
                .map(n => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2)}
            </div>
            <span className="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">{student.name}</span>
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            {student.studentId}
          </span>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
            Year {student.year}
          </span>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <span className="text-sm font-medium text-gray-700">
            {student.branch || <span className="text-gray-400">N/A</span>}
          </span>
        </td>
        <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
          <div className="flex gap-2">
            <button 
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium border border-red-200"
              onClick={(e) => { e.stopPropagation(); handleDelete(); }}
              title="Delete Student"
            >
              <Trash2 size={14} />
              Delete
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
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-6">
            <button 
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              onClick={() => navigate('/')}
            >
              <ArrowLeft size={16} />
              Back
            </button>
          </div>
          
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-6">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 bg-gradient-to-br ${getCourseColor(courseIndex)} rounded-xl flex items-center justify-center text-white text-2xl shadow-lg`}>
                {getCourseIcon(courseIndex)}
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {config?.courses?.find(c => c.name === course)?.displayName || course.toUpperCase()} Students
                </h1>
                <p className="text-gray-600 mt-1">
                  {students.length} {students.length === 1 ? 'student' : 'students'} enrolled
                </p>
              </div>
            </div>
            <button 
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-md hover:shadow-lg font-medium"
              onClick={() => navigate('/add-student')}
            >
              <Plus size={18} />
              Add Student
            </button>
          </div>
        </div>

        {/* Controls Section */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl shadow-sm border-2 border-blue-200 p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Search className="text-white" size={18} />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Search & Filter</h3>
          </div>
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
            <div className="flex-1 w-full lg:w-auto relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-600" size={18} />
              <input
                type="text"
                placeholder="Search by name or student ID..."
                className="w-full pl-10 pr-4 py-2.5 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select 
              value={yearFilter} 
              onChange={(e) => setYearFilter(e.target.value)}
              className="w-full lg:w-48 px-4 py-2.5 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white shadow-sm transition-all"
            >
              <option value="all">All Years</option>
              {yearOptions.map(year => (
                <option key={year} value={year}>Year {year}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Students Table */}
        <div>
          {filteredStudents.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">👥</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No students found</h3>
              <p className="text-gray-600 mb-6">
                {searchTerm || yearFilter !== 'all' 
                  ? 'Try adjusting your search criteria' 
                  : 'Start by adding students to this course'
                }
              </p>
              {!searchTerm && yearFilter === 'all' && (
                <button 
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-md hover:shadow-lg"
                  onClick={() => navigate('/add-student')}
                >
                  Add First Student
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <User size={20} className="text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Student List</h3>
                      <p className="text-sm text-gray-600">View and manage all students</p>
                    </div>
                  </div>
                  <span className="px-4 py-2 text-sm font-medium text-gray-700 bg-blue-50 border border-blue-200 rounded-lg">
                    {filteredStudents.length} {filteredStudents.length === 1 ? 'student' : 'students'}
                  </span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Student Name</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Student ID</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Year</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Branch</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {filteredStudents.map(student => (
                      <StudentRow key={student.id} student={student} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default CourseDashboard;