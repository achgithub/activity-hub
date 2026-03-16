import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface LoginViewProps {
  onLogin: (email: string, code: string) => Promise<boolean>;
  onGuestLogin: () => Promise<boolean>;
}

const LoginView: React.FC<LoginViewProps> = ({ onLogin, onGuestLogin }) => {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const success = await onLogin(email, code);

    if (!success) {
      setError('Invalid email or code');
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setError('');
    setGuestLoading(true);

    const success = await onGuestLogin();

    if (!success) {
      setError('Guest login failed');
      setGuestLoading(false);
    }
  };

  return (
    <div className="min-h-screen ah-flex ah-flex-center bg-gray-50">
      <div className="ah-container ah-container--narrow">
        <div className="ah-card">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">Activity Hub</h1>
            <p className="text-gray-600">Sign in to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="ah-label">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="ah-input w-full"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="code" className="ah-label">Access Code</label>
              <input
                id="code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Enter 6-digit code"
                maxLength={6}
                className="ah-input w-full"
                required
                disabled={loading}
              />
            </div>

            {error && <div className="ah-banner ah-banner--error">{error}</div>}

            <button type="submit" disabled={loading || guestLoading} className="ah-btn-primary w-full">
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          <div className="mt-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 border-t border-gray-300"></div>
              <span className="text-gray-500 text-sm">or</span>
              <div className="flex-1 border-t border-gray-300"></div>
            </div>
            <button
              type="button"
              onClick={handleGuestLogin}
              disabled={loading || guestLoading}
              className="ah-btn-outline w-full"
            >
              {guestLoading ? 'Loading...' : 'Continue as Guest'}
            </button>
            <p className="text-sm text-gray-500 text-center mt-2">Limited access to public apps only</p>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-600 mb-4">Demo: Use code <code className="bg-gray-100 px-2 py-1 rounded">123456</code></p>

            <div className="text-center">
              <p className="text-sm text-gray-600 mb-4">📱 Scan to login on mobile</p>
              <div className="flex justify-center">
                <QRCodeSVG
                  value={window.location.origin}
                  size={150}
                  level="M"
                  includeMargin={true}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginView;
