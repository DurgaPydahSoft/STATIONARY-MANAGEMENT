import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiUrl } from '../utils/api';

const Dashboard = () => {
  const [courseStats, setCourseStats] = useState({});
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      // Fetch academic config to get courses
      try {
        const configRes = await fetch(apiUrl('/api/config/academic'));
        if (configRes.ok) {
          const configData = await configRes.json();
          const coursesList = configData.courses || [];
          setCourses(coursesList);
          
          // Fetch stats for each course
          const stats = {};
          for (const course of coursesList) {
            try {
              const response = await fetch(apiUrl(`/api/users/${course.name}`));
              if (response.ok) {
                const students = await response.json();
                stats[course.name] = students.length;
              } else {
                stats[course.name] = 0;
              }
            } catch (error) {
              console.error(`Error fetching stats for ${course.name}:`, error);
              stats[course.name] = 0;
            }
          }
          
          setCourseStats(stats);
        }
      } catch (error) {
        console.error('Error fetching academic config:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const getCourseIcon = (index) => {
    // Array of available icons - cycle through them
    const icons = ['🎓', '📜', '🎖️', '💼', '💻', '📚', '📖', '🎯', '⭐', '🏆', '📝', '📋', '📊', '🔬', '⚗️', '🧪'];
    return icons[index % icons.length];
  };

  const getCourseColor = (index) => {
    // Cycle through colors for courses
    const colors = ['text-primary-500', 'text-cyan-500', 'text-success-500', 'text-purple-500', 'text-orange-500', 'text-pink-500'];
    return colors[index % colors.length];
  };

  const totalStudents = loading ? 0 : Object.values(courseStats).reduce((a, b) => a + b, 0);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8">
      {/* Header Section */}
      <div className="text-center mb-8">
        <div className="mb-4">
          <span className="text-6xl animate-bounce-gentle">🎓</span>
        </div>
        <h1 className="text-4xl font-bold text-gray-900 mb-3">College Stationery Management</h1>
        {/* <p className="text-gray-600 max-w-2xl mx-auto text-lg leading-relaxed">
          Efficiently manage student records and stationery distribution across all academic programs
        </p> */}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl p-6 shadow-soft border border-gray-200 text-center hover:shadow-medium transition-all duration-200">
          <div className="text-3xl font-bold text-primary-500 mb-2">
            {loading ? (
              <div className="inline-block w-6 h-6 border-2 border-primary-200 border-t-primary-500 rounded-full animate-spin"></div>
            ) : (
              totalStudents
            )}
          </div>
          <div className="text-sm text-gray-600 font-medium">Total Students</div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-soft border border-gray-200 text-center hover:shadow-medium transition-all duration-200">
          <div className="text-3xl font-bold text-cyan-500 mb-2">
            {loading ? (
              <div className="inline-block w-6 h-6 border-2 border-cyan-200 border-t-cyan-500 rounded-full animate-spin"></div>
            ) : (
              courses.length
            )}
          </div>
          <div className="text-sm text-gray-600 font-medium">Active Programs</div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-soft border border-gray-200 text-center hover:shadow-medium transition-all duration-200">
          <div className="text-3xl font-bold text-success-500 mb-2">100%</div>
          <div className="text-sm text-gray-600 font-medium">System Status</div>
        </div>
      </div>

      {/* Course Cards */}
      {courses.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {courses.map((course, index) => (
            <div 
              key={course._id || course.name} 
              className="bg-white rounded-xl p-6 shadow-soft border border-gray-200 cursor-pointer transition-all duration-200 hover:shadow-medium hover:-translate-y-1 group"
              onClick={() => navigate(`/course/${course.name}`)}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`text-4xl ${getCourseColor(index)}`}>
                  {getCourseIcon(index)}
                </div>
                <div className="text-gray-400 group-hover:text-primary-500 transition-colors duration-200 text-xl">→</div>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{course.displayName || course.name.toUpperCase()}</h3>
                <div className="text-gray-600 mb-2">
                  {loading ? (
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                      <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    </div>
                  ) : (
                    <span className="text-lg font-semibold">
                      {courseStats[course.name] || 0} {(courseStats[course.name] || 0) === 1 ? 'Student' : 'Students'}
                    </span>
                  )}
                </div>
                {course.years && course.years.length > 0 && (
                  <div className="text-xs text-gray-500">
                    Years: {course.years.sort((a, b) => a - b).join(', ')}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        !loading && (
          <div className="bg-white rounded-xl p-8 shadow-soft border border-gray-200 text-center mb-8">
            <p className="text-gray-600 mb-4">No courses configured yet.</p>
            <button 
              className="btn btn-primary"
              onClick={() => navigate('/courses')}
            >
              Add Courses
            </button>
          </div>
        )
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <button 
          className="btn btn-primary btn-lg"
          onClick={() => navigate('/add-student')}
        >
          <span className="text-lg">➕</span>
          Add New Student
        </button>
        <button 
          className="btn btn-outline btn-lg"
          onClick={() => navigate('/student-management')}
        >
          <span className="text-lg">👥</span>
          Manage Students
        </button>
        <button 
          className="btn btn-secondary btn-lg"
          onClick={() => navigate('/items')}
        >
          <span className="text-lg">📦</span>
          Manage Products
        </button>
      </div>

      {/* Quick Actions */}
      {courses.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-soft border border-gray-200">
          <div className="mb-4">
            <h4 className="text-lg font-semibold text-gray-800">Quick Actions</h4>
          </div>
          <div className={`grid grid-cols-1 gap-4 ${
            courses.length === 1 ? 'sm:grid-cols-1' : 
            courses.length === 2 ? 'sm:grid-cols-2' : 
            'sm:grid-cols-3'
          }`}>
            {courses.slice(0, 3).map((course, index) => {
              const colorClasses = [
                'hover:border-primary-300 hover:bg-primary-50',
                'hover:border-cyan-300 hover:bg-cyan-50',
                'hover:border-success-300 hover:bg-success-50'
              ];
              return (
                <button 
                  key={course._id || course.name}
                  className={`flex items-center gap-3 p-4 rounded-lg border border-gray-200 ${colorClasses[index % colorClasses.length]} transition-all duration-200 group`}
                  onClick={() => navigate(`/course/${course.name}`)}
                >
                  <span className="text-2xl group-hover:scale-110 transition-transform duration-200">
                    {getCourseIcon(index)}
                  </span>
                  <span className="text-gray-700 font-medium">{course.displayName || course.name} Students</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;