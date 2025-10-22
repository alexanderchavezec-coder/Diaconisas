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
  const [selectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendance, setAttendance] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
    fetchAttendance();
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
        axios.get(`${API}/friends`),
      ]);
      setMembers(membersRes.data);
      setFriends(friendsRes.data);
      setFilteredMembers(membersRes.data);
      setFilteredFriends(friendsRes.data);
    } catch (error) {
      toast.error('Error al cargar datos');
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
      console.error('Error al cargar asistencia');
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

      for (const person of allPeople) {
        const key = `${person.tipo}-${person.id}`;
        const presente = attendance[key] || false;
        await axios.post(`${API}/attendance`, {
          tipo: person.tipo,
          person_id: person.id,
          person_name: person.name,
          fecha: selectedDate,
          presente: presente,
        });
      }

      toast.success('Asistencia guardada exitosamente');
    } catch (error) {
      toast.error('Error al guardar asistencia');
    } finally {
      setLoading(false);
    }
  };

  const renderAttendanceList = (people, tipo) => {
    if (people.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          No hay {tipo === 'member' ? 'miembros' : 'visitantes'} registrados
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {people.map((person) => {
          const key = `${tipo}-${person.id}`;
          const name = tipo === 'member' ? `${person.nombre} ${person.apellido}` : person.nombre;
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
          <TabsTrigger value="friends" data-testid="tab-friends">Amigos</TabsTrigger>
        </TabsList>
        <TabsContent value="members">
          <Card>
            <CardHeader>
              <CardTitle>Miembros ({filteredMembers.length})</CardTitle>
            </CardHeader>
            <CardContent>{renderAttendanceList(filteredMembers, 'member')}</CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="friends">
          <Card>
            <CardHeader>
              <CardTitle>Amigos ({filteredFriends.length})</CardTitle>
            </CardHeader>
            <CardContent>{renderAttendanceList(filteredFriends, 'friend')}</CardContent>
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