import React, { Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Header } from './components/layout/Header';
import { ErrorBoundary } from './components/ErrorBoundary';

// 路由懒加载 — 按需拆分页面 chunk
const Home = React.lazy(() => import('./pages/Home'));
const Login = React.lazy(() => import('./pages/Login'));
const PackageDetail = React.lazy(() => import('./pages/PackageDetail'));
const Profile = React.lazy(() => import('./pages/Profile'));
const NotFound = React.lazy(() => import('./pages/NotFound'));

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
            <Route path="/profile" element={<Profile />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}

export default App;
