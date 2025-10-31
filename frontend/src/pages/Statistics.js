import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '../App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { BarChart3, Users, TrendingUp, Percent, Printer, UserX, Calendar } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

export default function Statistics() {
  const [members, setMembers] = useState([]);
  const [friends, setFriends] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [absentMembers, setAbsentMembers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Date selection states
  const [periodType, setPeriodType] = useState('current-month'); // 'current-month', 'specific-month', 'custom-range'
  const [selectedMonth, setSelectedMonth] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPeriodText, setCurrentPeriodText] = useState('');

  // Get current month dates in NY timezone
  const getTodayInNY = () => {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const parts = formatter.formatToParts(now);
    const year = parts.find(p => p.type === 'year').value;
    const month = parts.find(p => p.type === 'month').value;
    const day = parts.find(p => p.type === 'day').value;
    return { year, month, day };
  };

  const { year: currentYear, month: currentMonth, day: currentDay } = getTodayInNY();

  useEffect(() => {
    // Initialize with current month
    const firstDay = `${currentYear}-${currentMonth}-01`;
    const lastDayOfMonth = new Date(parseInt(currentYear), parseInt(currentMonth), 0).getDate();
    const lastDay = `${currentYear}-${currentMonth}-${String(lastDayOfMonth).padStart(2, '0')}`;
    setStartDate(firstDay);
    setEndDate(lastDay);
    setSelectedMonth(`${currentYear}-${currentMonth}`);
    fetchData(firstDay, lastDay);
  }, []);

  const handlePeriodTypeChange = (type) => {
    setPeriodType(type);
    
    if (type === 'current-month') {
      const firstDay = `${currentYear}-${currentMonth}-01`;
      const lastDayOfMonth = new Date(parseInt(currentYear), parseInt(currentMonth), 0).getDate();
      const lastDay = `${currentYear}-${currentMonth}-${String(lastDayOfMonth).padStart(2, '0')}`;
      setStartDate(firstDay);
      setEndDate(lastDay);
      fetchData(firstDay, lastDay);
    }
  };

  const handleMonthChange = (monthValue) => {
    setSelectedMonth(monthValue);
    const [year, month] = monthValue.split('-');
    const firstDay = `${year}-${month}-01`;
    const lastDayOfMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
    const lastDay = `${year}-${month}-${String(lastDayOfMonth).padStart(2, '0')}`;
    setStartDate(firstDay);
    setEndDate(lastDay);
    fetchData(firstDay, lastDay);
  };

  const handleCustomRangeSubmit = () => {
    if (!startDate || !endDate) {
      toast.error('Por favor selecciona ambas fechas');
      return;
    }
    if (startDate > endDate) {
      toast.error('La fecha de inicio debe ser anterior a la fecha de fin');
      return;
    }
    fetchData(startDate, endDate);
  };

  const fetchData = async (start, end) => {
    setLoading(true);
    try {
      // Fetch all data
      const [membersRes, friendsRes, attendanceRes] = await Promise.all([
        axios.get(`${API}/members`),
        axios.get(`${API}/visitors`),
        axios.get(`${API}/reports/by-date-range?start=${start}&end=${end}&tipo=all`)
      ]);

      const membersData = membersRes.data;
      const friendsData = friendsRes.data;
      const attendanceData = attendanceRes.data;

      setMembers(membersData);
      setFriends(friendsData);
      setAttendance(attendanceData.records);

      // Calculate statistics
      calculateStatistics(membersData, friendsData, attendanceData, start, end);
      
      // Calculate absent members
      calculateAbsentMembers(membersData, attendanceData.records);
      
      // Update current period text
      updatePeriodText(start, end);

    } catch (error) {
      toast.error('Error al cargar estadísticas');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const updatePeriodText = (start, end) => {
    // Extract year and month directly from the string to avoid timezone issues
    const [startYear, startMonth, startDay] = start.split('-');
    const [endYear, endMonth, endDay] = end.split('-');
    
    const monthNames = [
      'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
    ];
    
    if (start.substring(0, 7) === end.substring(0, 7)) {
      // Same month - show month and year
      const monthIndex = parseInt(startMonth) - 1;
      const monthName = monthNames[monthIndex];
      setCurrentPeriodText(`${monthName} de ${startYear}`);
    } else {
      // Different months or custom range - show full dates
      const startMonthName = monthNames[parseInt(startMonth) - 1];
      const endMonthName = monthNames[parseInt(endMonth) - 1];
      setCurrentPeriodText(`${startDay} de ${startMonthName} de ${startYear} - ${endDay} de ${endMonthName} de ${endYear}`);
    }
  };

  // Generate descriptive text for absent members report
  const getAbsentMembersDescription = () => {
    if (!startDate || !endDate) return '';
    
    const [startYear, startMonth, startDay] = startDate.split('-');
    const [endYear, endMonth, endDay] = endDate.split('-');
    
    const monthNames = [
      'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
    ];
    
    // Check if it's the same month
    if (startDate.substring(0, 7) === endDate.substring(0, 7)) {
      const monthIndex = parseInt(startMonth) - 1;
      const monthName = monthNames[monthIndex];
      
      // Check if it's the full month (day 1 to last day of month)
      const lastDayOfMonth = new Date(parseInt(startYear), parseInt(startMonth), 0).getDate();
      const isFullMonth = (parseInt(startDay) === 1 && parseInt(endDay) === lastDayOfMonth);
      
      if (isFullMonth) {
        // Full month - just show "octubre de 2025"
        return `${monthName} de ${startYear}`;
      } else {
        // Partial month - show date range within the month
        return `del ${parseInt(startDay)} al ${parseInt(endDay)} de ${monthName} de ${startYear}`;
      }
    } else {
      // Different months - show full date range
      const startMonthName = monthNames[parseInt(startMonth) - 1];
      const endMonthName = monthNames[parseInt(endMonth) - 1];
      return `del ${parseInt(startDay)} de ${startMonthName} de ${startYear} al ${parseInt(endDay)} de ${endMonthName} de ${endYear}`;
    }
  };

  const calculateStatistics = (membersData, friendsData, attendanceData, start, end) => {
    const totalMembers = membersData.length;
    const totalFriends = friendsData.length;
    const totalPeople = totalMembers + totalFriends;

    // Count attendance by type
    const memberAttendance = attendanceData.records.filter(r => r.tipo === 'member' && r.presente).length;
    const friendAttendance = attendanceData.records.filter(r => r.tipo === 'friend' && r.presente).length;
    const totalAttendance = memberAttendance + friendAttendance;

    // Calculate days in period for attendance rate calculation
    const startDate = new Date(start);
    const endDate = new Date(end);
    const daysInPeriod = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

    // Calculate attendance rate
    const memberAttendanceRate = totalMembers > 0 ? (memberAttendance / (totalMembers * daysInPeriod)) * 100 : 0;
    const friendAttendanceRate = totalFriends > 0 ? (friendAttendance / (totalFriends * daysInPeriod)) * 100 : 0;
    const overallAttendanceRate = totalPeople > 0 ? (totalAttendance / (totalPeople * daysInPeriod)) * 100 : 0;

    setStats({
      totalMembers,
      totalFriends,
      totalPeople,
      memberAttendance,
      friendAttendance,
      totalAttendance,
      memberAttendanceRate: memberAttendanceRate.toFixed(1),
      friendAttendanceRate: friendAttendanceRate.toFixed(1),
      overallAttendanceRate: overallAttendanceRate.toFixed(1)
    });
  };

  const calculateAbsentMembers = (membersData, attendanceRecords) => {
    // Get member IDs who attended this month
    const attendedMemberIds = new Set(
      attendanceRecords
        .filter(r => r.tipo === 'member' && r.presente)
        .map(r => r.person_id)
    );

    // Find members who haven't attended
    const absent = membersData.filter(m => !attendedMemberIds.has(m.id));
    setAbsentMembers(absent);
  };

  const printAbsentReport = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Cargando estadísticas...</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">No hay datos disponibles</div>
      </div>
    );
  }

  const pieData = [
    { name: 'Miembros', value: stats.totalMembers, color: '#3b82f6' },
    { name: 'Amigos', value: stats.totalFriends, color: '#a855f7' }
  ];

  const attendanceData = [
    { name: 'Asistencia Miembros', value: stats.memberAttendance, color: '#3b82f6' },
    { name: 'Asistencia Amigos', value: stats.friendAttendance, color: '#a855f7' }
  ];

  return (
    <div className="space-y-6" data-testid="statistics-page">
      {/* Header - Optimized */}
      <div>
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Análisis de asistencia - {currentPeriodText}
        </h1>
      </div>

      {/* Date Selection Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Seleccionar Período
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Select value={periodType} onValueChange={handlePeriodTypeChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona el tipo de período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current-month">Mes Actual</SelectItem>
                  <SelectItem value="specific-month">Mes Específico</SelectItem>
                  <SelectItem value="custom-range">Rango Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {periodType === 'specific-month' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="month-select">Mes</Label>
                  <Select 
                    value={selectedMonth.split('-')[1] || String(currentMonth).padStart(2, '0')} 
                    onValueChange={(month) => {
                      const year = selectedMonth.split('-')[0] || currentYear;
                      handleMonthChange(`${year}-${month}`);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecciona el mes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="01">Enero</SelectItem>
                      <SelectItem value="02">Febrero</SelectItem>
                      <SelectItem value="03">Marzo</SelectItem>
                      <SelectItem value="04">Abril</SelectItem>
                      <SelectItem value="05">Mayo</SelectItem>
                      <SelectItem value="06">Junio</SelectItem>
                      <SelectItem value="07">Julio</SelectItem>
                      <SelectItem value="08">Agosto</SelectItem>
                      <SelectItem value="09">Septiembre</SelectItem>
                      <SelectItem value="10">Octubre</SelectItem>
                      <SelectItem value="11">Noviembre</SelectItem>
                      <SelectItem value="12">Diciembre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="year-select">Año</Label>
                  <Select 
                    value={selectedMonth.split('-')[0] || currentYear} 
                    onValueChange={(year) => {
                      const month = selectedMonth.split('-')[1] || String(currentMonth).padStart(2, '0');
                      handleMonthChange(`${year}-${month}`);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecciona el año" />
                    </SelectTrigger>
                    <SelectContent>
                      {(() => {
                        const years = [];
                        const currentYearNum = parseInt(currentYear);
                        for (let y = currentYearNum - 2; y <= currentYearNum + 2; y++) {
                          years.push(
                            <SelectItem key={y} value={String(y)}>
                              {y}
                            </SelectItem>
                          );
                        }
                        return years;
                      })()}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {periodType === 'custom-range' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="start-date">Fecha Inicio</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="end-date">Fecha Fin</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={handleCustomRangeSubmit} className="w-full">
                    Aplicar Rango
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Screen version */}
      <div className="print:hidden space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Total Personas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{stats.totalPeople}</div>
              <p className="text-xs text-gray-500 mt-1">
                {stats.totalMembers} Miembros + {stats.totalFriends} Amigos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Asistencia Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{stats.totalAttendance}</div>
              <p className="text-xs text-gray-500 mt-1">En todo el mes</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Tasa de Asistencia</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-600">{stats.overallAttendanceRate}%</div>
              <p className="text-xs text-gray-500 mt-1">Promedio mensual</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Miembros Ausentes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">{absentMembers.length}</div>
              <p className="text-xs text-gray-500 mt-1">Sin asistencia este mes</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Distribución de Personas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Asistencia por Tipo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={attendanceData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {attendanceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Attendance Rates */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Percent className="h-5 w-5" />
              Tasas de Asistencia Detalladas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Miembros</span>
                  <span className="text-sm font-semibold text-blue-600">{stats.memberAttendanceRate}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${stats.memberAttendanceRate}%` }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Amigos</span>
                  <span className="text-sm font-semibold text-purple-600">{stats.friendAttendanceRate}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-purple-600 h-2 rounded-full"
                    style={{ width: `${stats.friendAttendanceRate}%` }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">General</span>
                  <span className="text-sm font-semibold text-green-600">{stats.overallAttendanceRate}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full"
                    style={{ width: `${stats.overallAttendanceRate}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Absent Members Report */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <UserX className="h-5 w-5" />
                Miembros Ausentes
              </CardTitle>
              <p className="text-sm text-gray-600 mt-2">
                Miembros sin registro de asistencia {getAbsentMembersDescription()}
              </p>
            </div>
            <Button onClick={printAbsentReport} variant="outline" size="sm">
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
          </CardHeader>
          <CardContent>
            {absentMembers.length === 0 ? (
              <p className="text-center text-gray-500 py-8">
                ¡Excelente! Todos los miembros han asistido este mes
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Nombre</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Apellido</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Teléfono</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Dirección</th>
                    </tr>
                  </thead>
                  <tbody>
                    {absentMembers.map((member) => (
                      <tr key={member.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4">{member.nombre}</td>
                        <td className="py-3 px-4">{member.apellido}</td>
                        <td className="py-3 px-4">{member.telefono || '-'}</td>
                        <td className="py-3 px-4">{member.direccion || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Print version - Absent Members Only */}
      <div className="hidden print:block print-content">
        <div className="text-center mb-8 pb-4 border-b-2 border-gray-800">
          <h1 className="text-3xl font-bold mb-2" style={{fontFamily: 'Playfair Display, serif'}}>
            Reporte de Miembros Ausentes
          </h1>
          <p className="text-lg text-gray-700 mb-2">
            Período: {getAbsentMembersDescription()}
          </p>
          <p className="text-lg font-semibold text-gray-800">
            Total Ausentes: {absentMembers.length} de {stats.totalMembers} miembros
          </p>
        </div>

        {absentMembers.length === 0 ? (
          <p className="text-center text-gray-600 py-8">
            ¡Excelente! Todos los miembros han asistido este mes
          </p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-800">
                <th className="text-left py-3 px-2 font-bold">#</th>
                <th className="text-left py-3 px-2 font-bold">Nombre Completo</th>
                <th className="text-left py-3 px-2 font-bold">Teléfono</th>
                <th className="text-left py-3 px-2 font-bold">Dirección</th>
              </tr>
            </thead>
            <tbody>
              {absentMembers.map((member, index) => (
                <tr key={member.id} className="border-b border-gray-300">
                  <td className="py-3 px-2 font-semibold text-gray-700">{index + 1}.</td>
                  <td className="py-3 px-2">
                    <span className="font-semibold text-gray-900">
                      {member.nombre} {member.apellido}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-gray-700">{member.telefono || '-'}</td>
                  <td className="py-3 px-2 text-gray-700">{member.direccion || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
