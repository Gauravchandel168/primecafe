import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import SplashGate from './components/SplashGate';
import SplashScreen from './pages/SplashScreen';
import MenuPage from './pages/MenuPage';
import OrderStatusPage from './pages/OrderStatusPage';
import MyOrdersPage from './pages/MyOrdersPage';

// These are only ever needed by cafe staff, never by a customer scanning
// a QR code — loading them lazily keeps the customer-facing bundle small.
const AdminLogin = lazy(() => import('./pages/AdminLogin'));
const AdminSignUp = lazy(() => import('./pages/AdminSignUp'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));

function AdminRoute() {
  const { user, restaurantId, loading } = useAuth();

  if (loading) return null;

  if (!user || !restaurantId) {
    return <Navigate to="/admin/login" replace />;
  }

  return <AdminPanel />;
}

function GuestAdminRoute({ children }) {
  const { user, restaurantId, loading } = useAuth();

  if (loading) return null;

  if (user && restaurantId) {
    return <Navigate to="/admin" replace />;
  }

  return children;
}

export default function App() {
  return (
    <SplashGate>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<SplashScreen />} />
          <Route path="/menu/:restaurantId" element={<MenuPage />} />
          <Route path="/menu" element={<MenuPage />} />
          <Route path="/order-status/:restaurantId/:orderId" element={<OrderStatusPage />} />
          <Route path="/my-orders/:restaurantId" element={<MyOrdersPage />} />
          <Route path="/admin" element={<AdminRoute />} />
          <Route
            path="/admin/login"
            element={
              <GuestAdminRoute>
                <AdminLogin />
              </GuestAdminRoute>
            }
          />
          <Route
            path="/admin/signup"
            element={
              <GuestAdminRoute>
                <AdminSignUp />
              </GuestAdminRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </SplashGate>
  );
}
