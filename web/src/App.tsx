import { Routes, Route } from 'react-router-dom';
import { Header } from './components/layout/Header';
import Home from './pages/Home';
import Login from './pages/Login';
import PackageDetail from './pages/PackageDetail';
import Profile from './pages/Profile';

function App() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/packages/:scope/:name" element={<PackageDetail />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>
    </div>
  );
}

export default App;
