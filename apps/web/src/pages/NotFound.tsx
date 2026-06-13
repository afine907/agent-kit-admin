/**
 * NotFound 页面 - 404
 */

import { Link } from 'react-router-dom';
import { Home, SearchX } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center space-y-6 animate-fade-in-up">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
          <SearchX className="w-8 h-8 text-primary" />
        </div>
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight">404</h1>
          <p className="text-muted-foreground mt-2">页面不存在</p>
        </div>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors focus-visible:ring-2 focus-visible:ring-primary/20"
        >
          <Home className="w-4 h-4" />
          返回首页
        </Link>
      </div>
    </div>
  );
}
