import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '../App';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, UserPlus, Calendar, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

export default function Dashboard() {
  const [stats, setStats] = useState({
    total_members: 0,
    total_visitors: 0,
    today_attendance: 0,
    month_attendance: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API}/dashboard/stats`);
      setStats(response.data);
    } catch (error) {
      toast.error('Error al cargar estadísticas');
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Total Miembros',
      value: stats.total_members,
      icon: Users,
      color: 'from-blue-500 to-blue-600',
      testId: 'stat-total-members',
    },
    {
      title: 'Total Amigos',
      value: stats.total_visitors,
      icon: UserPlus,
      color: 'from-purple-500 to-purple-600',
      testId: 'stat-total-friends',
    },
    {
      title: 'Asistencia Hoy',
      value: stats.today_attendance,
      icon: Calendar,
      color: 'from-green-500 to-green-600',
      testId: 'stat-today-attendance',
    },
    {
      title: 'Asistencia del Mes',
      value: stats.month_attendance,
      icon: TrendingUp,
      color: 'from-orange-500 to-orange-600',
      testId: 'stat-month-attendance',
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-lg text-gray-600">Cargando estadísticas...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      <div>
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Panel de Control</h1>
        <p className="text-gray-600 text-lg">Resumen de la actividad de la iglesia</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card
              key={index}
              className="card-hover animate-fade-in overflow-hidden"
              data-testid={stat.testId}
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  {stat.title}
                </CardTitle>
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center`}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900">{stat.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-2xl">Bienvenido al Sistema de Asistencia</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 text-base leading-relaxed">
            Este sistema te permite gestionar miembros, amigos y llevar un control completo de la asistencia de tu iglesia.
            Utiliza el menú lateral para navegar entre las diferentes secciones.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}