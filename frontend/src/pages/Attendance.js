import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '../App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Calendar, Save, Search } from 'lucide-react';

export default function Attendance() {
  const [members, setMembers] = useState([]);
  const [friends, setFriends] = useState([]);
  const [filteredMembers, setFilteredMembers] = useState([]);
  const [filteredFriends, setFilteredFriends] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Get New York date
  const nyDate = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
  const dateObj = new Date(nyDate);
  const localDate = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
  const [selectedDate] = useState(localDate);
  
  const [attendance, setAttendance] = useState({});
  const [todayAttendance, setTodayAttendance] = useState(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
    fetchAttendance();
    fetchTodayAttendance();
  }, []);

  useEffect(() => {
    // Filter members
    const filteredM = members.filter((member) =>
      `${member.nombre} ${member.apellido}`.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredMembers(filteredM);

    // Filter friends
    const filteredV = friends.filter((friend) =>
      friend.nombre.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredFriends(filteredV);
  }, [searchTerm, members, friends]);

  const fetchData = async () => {
    try {
      const [membersRes, friendsRes] = await Promise.all([
        axios.get(`${API}/members`),
        axios.get(`${API}/visitors`),
      ]);
      setMembers(membersRes.data);
      setFriends(friendsRes.data);
      setFilteredMembers(membersRes.data);
      setFilteredFriends(friendsRes.data);
    } catch (error) {
      toast.error('Error al cargar datos');
      console.error(error);
    }
  };

  const fetchAttendance = async () => {
    try {
      const response = await axios.get(`${API}/attendance?fecha=${selectedDate}`);
      const attendanceMap = {};
      response.data.forEach((record) => {
        attendanceMap[`${record.tipo}-${record.person_id}`] = record.presente;
      });
      setAttendance(attendanceMap);
    } catch (error) {
      console.error('Error al cargar asistencia:', error);
      // Don't show error toast, just log it
    }
  };

  const fetchTodayAttendance = async () => {
    try {
      const response = await axios.get(`${API}/attendance/today`);
      const attendanceSet = new Set();
      response.data.forEach((record) => {
        attendanceSet.add(`${record.tipo}-${record.person_id}`);
      });
      setTodayAttendance(attendanceSet);
    } catch (error) {
      console.error('Error al cargar asistencia de hoy:', error);
    }
  };

  const handleAttendanceChange = (tipo, personId, personName, checked) => {
    const key = `${tipo}-${personId}`;
    setAttendance({ ...attendance, [key]: checked });
  };

  const handleSaveAttendance = async () => {
    setLoading(true);
    try {
      const allPeople = [
        ...members.map((m) => ({ tipo: 'member', id: m.id, name: `${m.nombre} ${m.apellido}` })),
        ...friends.map((v) => ({ tipo: 'friend', id: v.id, name: v.nombre })),
      ];

      // Only save people who have been explicitly marked (checked or unchecked)
      const promises = [];
      for (const person of allPeople) {
        const key = `${person.tipo}-${person.id}`;
        // Skip if this person wasn't explicitly checked or unchecked
        if (attendance.hasOwnProperty(key)) {
          const presente = attendance[key];
          promises.push(
            axios.post(`${API}/attendance`, {
              tipo: person.tipo,
              person_id: person.id,
              person_name: person.name,
              fecha: selectedDate,
              presente: presente,
            })
          );
        }
      }

      await Promise.all(promises);
      toast.success('Asistencia guardada exitosamente');
      // Refresh today's attendance list
      await fetchTodayAttendance();
    } catch (error) {
      toast.error('Error al guardar asistencia');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const renderAttendanceList = (people, tipo) => {
    if (people.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          No hay {tipo === 'member' ? 'miembros' : 'amigos'} registrados
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {people.map((person) => {
          const key = `${tipo}-${person.id}`;
          const name = tipo === 'member' ? `${person.nombre} ${person.apellido}` : person.nombre;
          const hasAttendanceToday = todayAttendance.has(key);
          return (
            <div
              key={person.id}
              className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-gray-50"
              data-testid={`attendance-item-${tipo}-${person.id}`}
            >
              <Checkbox
                data-testid={`attendance-checkbox-${tipo}-${person.id}`}
                id={key}
                checked={attendance[key] || false}
                onCheckedChange={(checked) =>
                  handleAttendanceChange(tipo, person.id, name, checked)
                }
              />
              <Label htmlFor={key} className="flex-1 cursor-pointer text-base">
                {name}
              </Label>
              {hasAttendanceToday && (
                <div 
                  className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center shadow-sm"
                  title="Asistencia marcada hoy"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-white"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6" data-testid="attendance-page">
      <div>
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Registro de Asistencia</h1>
        <p className="text-gray-600 text-lg">Marca la asistencia de miembros y amigos</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Fecha de Registro
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center">
                <Calendar className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-600 font-medium">Registrando asistencia para</p>
                <p className="text-2xl font-bold text-gray-900">
                  {new Date(selectedDate).toLocaleDateString('es-ES', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Buscar Persona
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
            <Input
              data-testid="attendance-search-input"
              placeholder="Buscar por nombre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-12 text-base"
            />
          </div>
          {searchTerm && (
            <p className="text-sm text-gray-500 mt-2">
              Mostrando resultados para: <span className="font-semibold">{searchTerm}</span>
            </p>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="members" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="members" data-testid="tab-members">Miembros</TabsTrigger>
          <TabsTrigger value="visitors" data-testid="tab-visitors">Amigos</TabsTrigger>
        </TabsList>
        <TabsContent value="members">
          <Card>
            <CardHeader>
              <CardTitle>Miembros ({filteredMembers.length})</CardTitle>
            </CardHeader>
            <CardContent>{renderAttendanceList(filteredMembers, 'member')}</CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="visitors">
          <Card>
            <CardHeader>
              <CardTitle>Amigos ({filteredFriends.length})</CardTitle>
            </CardHeader>
            <CardContent>{renderAttendanceList(filteredFriends, 'visitor')}</CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button
          data-testid="save-attendance-button"
          onClick={handleSaveAttendance}
          disabled={loading}
          className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
          size="lg"
        >
          <Save className="mr-2 h-5 w-5" />
          {loading ? 'Guardando...' : 'Guardar Asistencia'}
        </Button>
      </div>
    </div>
  );
}