import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Plus, Trash2, GraduationCap, Users } from 'lucide-react';
import { apiUrl } from '../utils/api';
import useOnlineStatus from '../hooks/useOnlineStatus';
import { loadJSON, saveJSON } from '../utils/storage';

const normalizeCourse = (value) => {
  if (!value) return '';
  return String(value).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
};

const prepareStudents = (source = []) =>
  (source || []).map((student) => ({
    ...student,
    id: student.id || student._id,
    normalizedCourse: normalizeCourse(student.course),
  }));

const StudentDashboard = ({ initialStudents = [], isOnline: isOnlineProp }) => {
  const navigate = useNavigate();
  const [students, setStudents] = useState(() => {
    if (initialStudents && initialStudents.length > 0) return prepareStudents(initialStudents);
    return prepareStudents(loadJSON('studentsCache', []));
  });
  const [loading, setLoading] = useState(students.length === 0);
  const [searchTerm, setSearchTerm] = useState('');
  const [yearFilter, setYearFilter] = useState('all');
  const [courseFilter, setCourseFilter] = useState('all');
  const [config, setConfig] = useState(() => loadJSON('configCache', null));
  const isOnline = typeof isOnlineProp === 'boolean' ? isOnlineProp : useOnlineStatus();

  useEffect(() => {
    if (initialStudents && initialStudents.length > 0) {
      setStudents(prepareStudents(initialStudents));
      setLoading(false);
    }
  }, [initialStudents]);
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        const [configRes, studentsRes] = await Promise.all([
          fetch(apiUrl('/api/config/academic')),
          fetch(apiUrl('/api/users')),
        ]);

        if (configRes.ok) {
          const configData = await configRes.json();
          setConfig(configData);
          saveJSON('configCache', configData);
        }

        if (studentsRes.ok) {
          const data = await studentsRes.json();
          const formatted = prepareStudents(data);
          setStudents(formatted);
          saveJSON('studentsCache', formatted);
        }
      } catch (error) {
        console.error('Error fetching students:', error);
      } finally {
        setLoading(false);
      }
    };

    if (isOnline) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [isOnline]);

  const getCourseDisplayName = (courseName) => {
    if (!courseName) return 'N/A';
    const normalized = normalizeCourse(courseName);
    const display = config?.courses?.find(c => normalizeCourse(c.name) === normalized)?.displayName;
    return display || courseName.toUpperCase();
  };

  const handleStudentUpdate = (studentId, updateData) => {
    const updated = students.map(student => {
      if (student.id !== studentId) return student;

      const updatedStudent = { ...student, ...updateData };
      updatedStudent.normalizedCourse = normalizeCourse(updatedStudent.course);

      const targetCourse = student.course;
      if (targetCourse) {
        fetch(apiUrl(`/api/users/${targetCourse}/${student._id}`), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paid: updatedStudent.paid,
            items: updatedStudent.items,
            name: updatedStudent.name,
            studentId: updatedStudent.studentId,
            year: updatedStudent.year,
            branch: updatedStudent.branch,
          }),
        }).catch(err => console.error('Failed to update student:', err));
      }

      return updatedStudent;
    });

    setStudents(updated);
  };

  const handleItemToggle = (studentId, itemName) => {
    const student = students.find(s => s.id === studentId);
    if (!student) return;
    const items = student.items || {};
    const updatedItems = { ...items, [itemName]: !Boolean(items[itemName]) };
    handleStudentUpdate(studentId, { items: updatedItems });
  };

  const handleDeleteStudent = (student) => {
    if (!window.confirm('Are you sure you want to delete this student?')) return;

    fetch(apiUrl(`/api/users/${student.course}/${student._id}`), {
      method: 'DELETE',
    })
      .then(res => {
        if (!res.ok) throw new Error('Delete failed');
        setStudents(prev => prev.filter(s => s.id !== student.id));
      })
      .catch(err => console.error('Delete failed:', err));
  };

  const filteredStudents = useMemo(() => {
    return students.filter(student => {
      const matchesSearch =
        student.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.studentId?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesYear = yearFilter === 'all' || String(student.year) === String(yearFilter);
      const matchesCourse = courseFilter === 'all' || student.normalizedCourse === courseFilter;

      return matchesSearch && matchesYear && matchesCourse;
    });
  }, [students, searchTerm, yearFilter, courseFilter]);

  const yearOptions = Array.from(new Set(students.map(s => s.year).filter(Boolean))).sort((a, b) => a - b);
  const courseOptions = config?.courses
    ? config.courses.map(c => ({ name: c.name, displayName: c.displayName }))
    : Array.from(new Set(students.map(s => s.normalizedCourse)))
        .filter(Boolean)
        .map(name => ({ name, displayName: name.toUpperCase() }));

  useEffect(() => {
    saveJSON('studentsCache', students);
  }, [students]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4" />
          <p className="text-gray-600">Loading students...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-6">
            <button
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              onClick={() => navigate('/')}
            >
              <ArrowLeft size={16} />
              Back to Dashboard
            </button>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center text-white text-2xl shadow-lg">
                <Users size={24} />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Student Dashboard</h1>
                <p className="text-gray-600 mt-1">{students.length} {students.length === 1 ? 'student' : 'students'} enrolled across all courses</p>
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
              <Users size={20} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Students</p>
              <p className="text-xl font-semibold text-gray-900">{students.length}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 text-green-600 rounded-lg flex items-center justify-center">
              <GraduationCap size={20} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Paid Students</p>
              <p className="text-xl font-semibold text-gray-900">{students.filter(s => s.paid).length}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center">
              <GraduationCap size={20} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Pending Students</p>
              <p className="text-xl font-semibold text-gray-900">{students.filter(s => !s.paid).length}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl shadow-sm border-2 border-blue-200 p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Search className="text-white" size={18} />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Search & Filter</h3>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="relative">
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
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              className="w-full px-4 py-2.5 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white shadow-sm transition-all"
            >
              <option value="all">All Courses</option>
              {courseOptions?.map(course => (
                <option key={course.name || course} value={course.name || course}>
                  {course.displayName || getCourseDisplayName(course.name)}
                </option>
              ))}
            </select>
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="w-full px-4 py-2.5 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white shadow-sm transition-all"
            >
              <option value="all">All Years</option>
              {yearOptions.map(year => (
                <option key={year} value={year}>Year {year}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          {filteredStudents.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">👥</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No students found</h3>
              <p className="text-gray-600 mb-6">
                {searchTerm || courseFilter !== 'all' || yearFilter !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Start by adding students to the system'}
              </p>
              {!searchTerm && courseFilter === 'all' && yearFilter === 'all' && (
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
                      <Users size={20} className="text-blue-600" />
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
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Course</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Student ID</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Year</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Branch</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {filteredStudents.map(student => (
                      <tr
                        key={student.id}
                        onClick={() => navigate(`/student/${student.id}`)}
                        className="border-b border-gray-100 hover:bg-blue-50 transition-colors cursor-pointer group"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-white text-sm font-bold shadow-md">
                              {student.name
                                ?.split(' ')
                                ?.map(n => n[0])
                                ?.join('')
                                ?.toUpperCase()
                                ?.slice(0, 2) || 'NA'}
                            </div>
                            <span className="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">{student.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {getCourseDisplayName(student.course)}
                          </span>
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
                              onClick={() => handleDeleteStudent(student)}
                              title="Delete Student"
                            >
                              <Trash2 size={14} />
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
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

export default StudentDashboard;

