import axios from 'axios';

// Adjust the base URL to point to your FastAPI server
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach JWT Token
apiClient.interceptors.request.use(
  (config) => {
    // We will store the token in localStorage for simplicity on the admin panel
    // In a production SSR app, you might use cookies
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('access_token');
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle 401s (Token Expiry)
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    // If 401 and we haven't already tried to refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        if (typeof window !== 'undefined') {
          const refreshToken = localStorage.getItem('refresh_token');
          if (refreshToken) {
            const res = await axios.post(`${API_URL}/api/v1/auth/refresh`, {
              refresh_token: refreshToken, // Adjust payload based on your backend expectation
            });
            const newAccessToken = res.data.access_token;
            localStorage.setItem('access_token', newAccessToken);
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
            return apiClient(originalRequest);
          }
        }
      } catch (refreshError) {
        // Refresh failed, force logout
        if (typeof window !== 'undefined') {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);
