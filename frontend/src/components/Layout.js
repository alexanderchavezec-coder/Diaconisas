import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Home, Users, UserPlus, Calendar, FileText, LogOut, Church } from 'lucide-react';

export default function Layout({ onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { path: '/', icon: Home, label: 'Dashboard', testId: 'nav-dashboard' },
    { path: '/members', icon: Users, label: 'Miembros', testId: 'nav-members' },
    { path: '/visitors', icon: UserPlus, label: 'Visitantes', testId: 'nav-visitors' },
    { path: '/attendance', icon: Calendar, label: 'Asistencia', testId: 'nav-attendance' },
    { path: '/reports', icon: FileText, label: 'Reportes', testId: 'nav-reports' },
  ];

  return (
    <div className="min-h-screen flex" data-testid="layout">
      {/* Sidebar */}
      <aside className="w-64 bg-gradient-to-b from-blue-600 to-purple-700 text-white flex flex-col shadow-2xl">
        <div className="p-6 border-b border-white/20">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center p-2 shadow-lg">
              <img 
                src="https://customer-assets.emergentagent.com/job_worship-check/artifacts/6sjlx750_adventist-symbol--earth.svg.svg" 
                alt="Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h1 className="text-xl font-bold">IASD</h1>
              <p className="text-sm text-white/80">Danbury</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                data-testid={item.testId}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  isActive
                    ? 'bg-white text-blue-600 font-semibold shadow-lg'
                    : 'text-white/90 hover:bg-white/10'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/20">
          <Button
            data-testid="logout-button"
            onClick={onLogout}
            variant="ghost"
            className="w-full justify-start text-white hover:bg-white/10 hover:text-white"
          >
            <LogOut className="mr-3 h-5 w-5" />
            Cerrar Sesión
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}