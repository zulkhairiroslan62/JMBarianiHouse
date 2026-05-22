import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    const success = await login(email, password);
    setIsLoading(false);
    if (success) navigate('/', { replace: true });
  };

  const fillDemo = (role) => {
    if (role === 'owner') {
      setEmail('owner@jmbariani.com');
      setPassword('owner123');
    } else {
      setEmail('admin@jmbariani.com');
      setPassword('admin123');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-brand-dark">JM Bariani HQ</h1>
          <p className="text-gray-600 mt-2">Restaurant Management System v2</p>
        </div>

        {/* Form Card */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Sign In</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="you@jmbariani.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="Enter password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Demo Credentials */}
          <div className="mt-6 pt-6 border-t border-gray-100">
            <p className="text-xs text-gray-500 text-center mb-3">Demo Credentials</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => fillDemo('owner')}
                className="btn-secondary text-xs py-2"
              >
                Owner Login
              </button>
              <button
                type="button"
                onClick={() => fillDemo('admin')}
                className="btn-secondary text-xs py-2"
              >
                Admin Login
              </button>
            </div>
            <div className="mt-3 text-xs text-gray-400 space-y-1">
              <p>Owner: owner@jmbariani.com / owner123</p>
              <p>Admin: admin@jmbariani.com / admin123</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
