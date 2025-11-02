// API configuration for production and development
// In development, Vite proxy handles /api routes
// In production, we need the full backend URL

const getApiBaseUrl = () => {
  // Check if we're in production
  if (import.meta.env.PROD) {
    // Use environment variable if set (must start with VITE_ for Vite)
    return import.meta.env.VITE_API_BASE_URL || 'https://stationary-management-sek4.onrender.com';
  }
  // In development, use relative URLs (Vite proxy will handle them)
  return '';
};

export const API_BASE_URL = getApiBaseUrl();

// Helper function to build API URLs
export const apiUrl = (path) => {
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
};

// Helper function for API fetch requests
export const apiFetch = async (path, options = {}) => {
  const url = apiUrl(path);
  
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const config = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...(options.headers || {}),
    },
  };

  const response = await fetch(url, config);
  return response;
};

export default apiUrl;

