import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Header } from './components/layout/Header';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useAuthStore } from './stores/authStore';

// 路由懒加载 — 按需拆分页面 chunk
const Home = React.lazy(() => import('./pages/Home'));
const Login = React.lazy(() => import('./pages/Login'));
const PackageDetail = React.lazy(() => import('./pages/PackageDetail'));
const Profile = React.lazy(() => import('./pages/Profile'));
const Publish = React.lazy(() => import('./pages/Publish'));
const Teams = React.lazy(() => import('./pages/Teams'));
const NotFound = React.lazy(() => import('./pages/NotFound'));

// 管理后台页面
const AdminDashboard = React.lazy(() => import('./pages/admin/Dashboard'));
const AdminUsers = React.lazy(() => import('./pages/admin/Users'));
const AdminPackages = React.lazy(() => import('./pages/admin/Packages'));

// 路由守卫组件
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAdmin } = useAuthStore();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

function App() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <ErrorBoundary>
        <Suspense
          fallback={
            <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/packages/:scope/:name" element={<PackageDetail />} />
            <Route
              path="/profile"
              element={
                <RequireAuth>
                  <Profile />
                </RequireAuth>
              }
            />
            <Route
              path="/publish"
              element={
                <RequireAuth>
                  <Publish />
                </RequireAuth>
              }
            />
            <Route
              path="/teams"
              element={
                <RequireAuth>
                  <Teams />
                </RequireAuth>
              }
            />

            {/* 管理后台路由 */}
            <Route
              path="/admin"
              element={
                <RequireAdmin>
                  <AdminDashboard />
                </RequireAdmin>
              }
            />
            <Route
              path="/admin/users"
              element={
                <RequireAdmin>
                  <AdminUsers />
                </RequireAdmin>
              }
            />
            <Route
              path="/admin/packages"
              element={
                <RequireAdmin>
                  <AdminPackages />
                </RequireAdmin>
              }
            />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}

export default App;
