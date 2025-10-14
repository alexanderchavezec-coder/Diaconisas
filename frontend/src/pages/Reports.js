import { useState } from 'react';
import axios from 'axios';
import { API } from '../App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { FileText, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function Reports() {
  const [reportType, setReportType] = useState('date-range');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [tipo, setTipo] = useState('all');
  const [reportData, setReportData] = useState(null);
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
      toast.success('Reporte generado exitosamente');
    } catch (error) {
      toast.error('Error al generar reporte');
    } finally {
      setLoading(false);
    }
  };

  const renderDateRangeReport = () => {
    if (!reportData) return null;

    const { statistics, records } = reportData;

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

        <Card>
          <CardHeader>
            <CardTitle>Registros Detallados</CardTitle>
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

  const renderCollectiveReport = () => {
    if (!reportData) return null;

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

          <Button
            data-testid="generate-report-button"
            onClick={generateReport}
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
    </div>
  );
}