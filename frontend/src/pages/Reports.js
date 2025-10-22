import { useState } from 'react';
import axios from 'axios';
import { API } from '../App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { FileText, TrendingUp, Printer, Calendar as CalendarIcon } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function Reports() {
  // Get first and last day of current month
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
  const todayDate = today.toISOString().split('T')[0];
  
  const [reportType, setReportType] = useState('date-range');
  const [startDate, setStartDate] = useState(firstDay);
  const [endDate, setEndDate] = useState(lastDay);
  const [visitorsDate, setVisitorsDate] = useState(todayDate);
  const [tipo, setTipo] = useState('all');
  const [reportData, setReportData] = useState(null);
  const [visitorsData, setVisitorsData] = useState(null);
  const [loading, setLoading] = useState(false);

  const generateReport = async () => {
    if (!startDate || !endDate) {
      toast.error('Por favor selecciona ambas fechas');
      return;
    }

    setLoading(true);
    try {
      let response;
      if (reportType === 'date-range') {
        response = await axios.get(
          `${API}/reports/by-date-range?start=${startDate}&end=${endDate}&tipo=${tipo}`
        );
      } else if (reportType === 'collective') {
        response = await axios.get(
          `${API}/reports/collective?start=${startDate}&end=${endDate}`
        );
      }
      setReportData(response.data);
      setVisitorsData(null);
      toast.success('Reporte generado exitosamente');
    } catch (error) {
      toast.error('Error al generar reporte');
    } finally {
      setLoading(false);
    }
  };

  const generateVisitorsReport = async () => {
    if (!visitorsDate) {
      toast.error('Por favor selecciona una fecha');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.get(
        `${API}/reports/by-date-range?start=${visitorsDate}&end=${visitorsDate}&tipo=friend`
      );
      
      const presentFriends = response.data.records.filter(r => r.presente);
      
      // Get full friend details
      const friendsRes = await axios.get(`${API}/friends`);
      const allFriends = friendsRes.data;
      
      // Match and enrich friend data
      const enrichedFriends = presentFriends.map(record => {
        const friendDetail = allFriends.find(v => v.id === record.person_id);
        return {
          name: record.person_name,
          origin: friendDetail?.de_donde_viene || 'No especificado',
          date: record.fecha
        };
      });
      
      setVisitorsData({
        date: visitorsDate,
        visitors: enrichedFriends
      });
      setReportData(null);
      toast.success('Reporte de amigos generado');
    } catch (error) {
      toast.error('Error al generar reporte');
    } finally {
      setLoading(false);
    }
  };

  const printVisitorsReport = () => {
    window.print();
  };

  const renderDateRangeReport = () => {
    if (!reportData) return null;

    const { statistics, records } = reportData;
    
    // Separate present and absent records
    const presentRecords = records.filter(r => r.presente);
    const absentRecords = records.filter(r => !r.presente);

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-blue-600">{statistics.total}</div>
              <div className="text-sm text-gray-600">Total de Registros</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-600">{statistics.present}</div>
              <div className="text-sm text-gray-600">Presentes</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-red-600">{statistics.absent}</div>
              <div className="text-sm text-gray-600">Ausentes</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-purple-600">{statistics.attendance_rate}%</div>
              <div className="text-sm text-gray-600">Tasa de Asistencia</div>
            </CardContent>
          </Card>
        </div>

        {/* Present List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-green-700 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              Asistentes ({presentRecords.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {presentRecords.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No hay registros de asistencia</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {presentRecords.map((record, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 rounded-lg border border-green-200 bg-green-50"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{record.person_name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          record.tipo === 'member' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                        }`}>
                          {record.tipo === 'member' ? 'Miembro' : 'Visitante'}
                        </span>
                        <span className="text-xs text-gray-500">{record.fecha}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Absent List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-red-700 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500"></div>
              Ausentes ({absentRecords.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {absentRecords.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No hay registros de ausencias</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {absentRecords.map((record, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 rounded-lg border border-red-200 bg-red-50"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{record.person_name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          record.tipo === 'member' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                        }`}>
                          {record.tipo === 'member' ? 'Miembro' : 'Visitante'}
                        </span>
                        <span className="text-xs text-gray-500">{record.fecha}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Todos los Registros Detallados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold">Fecha</th>
                    <th className="text-left py-3 px-4 font-semibold">Nombre</th>
                    <th className="text-left py-3 px-4 font-semibold">Tipo</th>
                    <th className="text-left py-3 px-4 font-semibold">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {records.slice(0, 50).map((record, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">{record.fecha}</td>
                      <td className="py-3 px-4">{record.person_name}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          record.tipo === 'member' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                        }`}>
                          {record.tipo === 'member' ? 'Miembro' : 'Visitante'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          record.presente ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {record.presente ? 'Presente' : 'Ausente'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderVisitorsReport = () => {
    if (!visitorsData) return null;

    const { date, visitors } = visitorsData;

    return (
      <div className="space-y-6">
        {/* Screen version */}
        <Card className="print:hidden">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-2xl">Reporte de Visitantes</CardTitle>
              <p className="text-gray-600 mt-2">
                {new Date(date).toLocaleDateString('es-ES', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </p>
            </div>
            <Button
              onClick={printVisitorsReport}
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="print-visitors-button"
            >
              <Printer className="mr-2 h-4 w-4" />
              Imprimir
            </Button>
          </CardHeader>
          <CardContent>
            {visitors.length === 0 ? (
              <p className="text-center text-gray-500 py-8">
                No hay visitantes registrados para esta fecha
              </p>
            ) : (
              <div>
                <div className="mb-4 pb-4 border-b">
                  <p className="text-lg font-semibold">
                    Total de Visitantes: <span className="text-purple-600">{visitors.length}</span>
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {visitors.map((visitor, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-4 rounded-lg border border-purple-200 bg-purple-50"
                    >
                      <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 text-lg">{visitor.name}</p>
                        <p className="text-sm text-gray-600">{visitor.origin}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Print version - Simple and clean */}
        <div className="hidden print:block print-content">
          <div className="text-center mb-8 pb-4 border-b-2 border-gray-800">
            <h1 className="text-3xl font-bold mb-2" style={{fontFamily: 'Playfair Display, serif'}}>
              Reporte de Visitantes
            </h1>
            <p className="text-lg text-gray-700">
              {new Date(date).toLocaleDateString('es-ES', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
          </div>

          {visitors.length === 0 ? (
            <p className="text-center text-gray-600 py-8">
              No hay visitantes registrados para esta fecha
            </p>
          ) : (
            <ol className="space-y-2" style={{listStyleType: 'decimal', paddingLeft: '0'}}>
              {visitors.map((visitor, index) => (
                <li key={index} className="py-2 border-b border-gray-300" style={{display: 'flex', alignItems: 'center'}}>
                  <span className="font-bold text-lg mr-3 text-gray-700" style={{minWidth: '35px', display: 'inline-block'}}>
                    {index + 1}.
                  </span>
                  <div className="flex-1">
                    <span className="text-lg font-semibold text-gray-900">
                      {visitor.name}
                    </span>
                    <span className="text-base text-gray-600 ml-3">
                      - De: <span className="italic">{visitor.origin}</span>
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    );
  };

  const renderCollectiveReport = () => {

    const { by_date } = reportData;
    const chartData = Object.entries(by_date).map(([date, data]) => ({
      fecha: date,
      Miembros: data.members,
      Visitantes: data.visitors,
      Total: data.total,
    }));

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Asistencia por Fecha
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="fecha" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="Miembros" fill="#3b82f6" />
                <Bar dataKey="Visitantes" fill="#a855f7" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resumen por Fecha</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold">Fecha</th>
                    <th className="text-left py-3 px-4 font-semibold">Miembros</th>
                    <th className="text-left py-3 px-4 font-semibold">Visitantes</th>
                    <th className="text-left py-3 px-4 font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(by_date).map(([date, data]) => (
                    <tr key={date} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">{date}</td>
                      <td className="py-3 px-4">{data.members}</td>
                      <td className="py-3 px-4">{data.visitors}</td>
                      <td className="py-3 px-4 font-semibold">{data.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="space-y-6" data-testid="reports-page">
      <div>
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Reportes</h1>
        <p className="text-gray-600 text-lg">Genera reportes y estadísticas de asistencia</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Configuración del Reporte
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de Reporte</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger data-testid="report-type-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date-range">Por Rango de Fecha</SelectItem>
                  <SelectItem value="collective">Colectivo (Gráfico)</SelectItem>
                  <SelectItem value="visitors-day">Visitantes del Día</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {reportType === 'date-range' && (
              <div className="space-y-2">
                <Label>Filtrar por Tipo</Label>
                <Select value={tipo} onValueChange={setTipo}>
                  <SelectTrigger data-testid="report-filter-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="member">Solo Miembros</SelectItem>
                    <SelectItem value="visitor">Solo Visitantes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {reportType === 'visitors-day' ? (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                Seleccionar Fecha para Visitantes
              </Label>
              <Input
                data-testid="visitors-date-input"
                type="date"
                value={visitorsDate}
                onChange={(e) => setVisitorsDate(e.target.value)}
                className="h-11 max-w-xs"
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fecha Inicial</Label>
                <Input
                  data-testid="report-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label>Fecha Final</Label>
                <Input
                  data-testid="report-end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-11"
                />
              </div>
            </div>
          )}

          <Button
            data-testid="generate-report-button"
            onClick={reportType === 'visitors-day' ? generateVisitorsReport : generateReport}
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            size="lg"
          >
            {loading ? 'Generando...' : 'Generar Reporte'}
          </Button>
        </CardContent>
      </Card>

      {reportData && (
        <div data-testid="report-results">
          {reportType === 'date-range' && renderDateRangeReport()}
          {reportType === 'collective' && renderCollectiveReport()}
        </div>
      )}

      {visitorsData && (
        <div data-testid="visitors-report-results">
          {renderVisitorsReport()}
        </div>
      )}
    </div>
  );
}