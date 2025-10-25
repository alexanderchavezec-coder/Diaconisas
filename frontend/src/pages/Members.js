import { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '../App';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { UserPlus, Edit, Trash2, Search } from 'lucide-react';

export default function Members() {
  const [members, setMembers] = useState([]);
  const [filteredMembers, setFilteredMembers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    direccion: '',
    telefono: '',
  });

  useEffect(() => {
    fetchMembers();
  }, []);

  // Handle input focus for iOS/iPad - scroll into view
  useEffect(() => {
    const handleInputFocus = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        setTimeout(() => {
          e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
      }
    };

    document.addEventListener('focus', handleInputFocus, true);
    return () => {
      document.removeEventListener('focus', handleInputFocus, true);
    };
  }, []);

  useEffect(() => {
    const filtered = members.filter(
      (member) =>
        member.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.apellido.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.telefono.includes(searchTerm)
    );
    setFilteredMembers(filtered);
  }, [searchTerm, members]);

  const fetchMembers = async () => {
    try {
      const response = await axios.get(`${API}/members`);
      setMembers(response.data);
      setFilteredMembers(response.data);
    } catch (error) {
      toast.error('Error al cargar miembros');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingMember) {
        await axios.put(`${API}/members/${editingMember.id}`, formData);
        toast.success('Miembro actualizado exitosamente');
      } else {
        await axios.post(`${API}/members`, formData);
        toast.success('Miembro registrado exitosamente');
      }
      fetchMembers();
      setIsOpen(false);
      resetForm();
    } catch (error) {
      toast.error('Error al guardar miembro');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('¿Estás seguro de eliminar este miembro?')) {
      try {
        await axios.delete(`${API}/members/${id}`);
        toast.success('Miembro eliminado exitosamente');
        fetchMembers();
      } catch (error) {
        toast.error('Error al eliminar miembro');
      }
    }
  };

  const openEdit = (member) => {
    setEditingMember(member);
    setFormData({
      nombre: member.nombre,
      apellido: member.apellido,
      direccion: member.direccion,
      telefono: member.telefono,
    });
    setIsOpen(true);
  };

  const resetForm = () => {
    setEditingMember(null);
    setFormData({
      nombre: '',
      apellido: '',
      direccion: '',
      telefono: '',
    });
  };

  return (
    <div className="space-y-6" data-testid="members-page">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Miembros</h1>
          <p className="text-gray-600 text-lg">Gestiona los miembros de la iglesia</p>
        </div>
        <Dialog open={isOpen} onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button data-testid="add-member-button" className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
              <UserPlus className="mr-2 h-4 w-4" />
              Agregar Miembro
            </Button>
          </DialogTrigger>
          <DialogContent data-testid="member-dialog">
            <DialogHeader>
              <DialogTitle>{editingMember ? 'Editar Miembro' : 'Nuevo Miembro'}</DialogTitle>
              <DialogDescription>
                {editingMember ? 'Actualiza la información del miembro' : 'Completa el formulario para registrar un nuevo miembro'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre</Label>
                <Input
                  id="nombre"
                  data-testid="member-nombre-input"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="apellido">Apellido</Label>
                <Input
                  id="apellido"
                  data-testid="member-apellido-input"
                  value={formData.apellido}
                  onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="direccion">Dirección</Label>
                <Input
                  id="direccion"
                  data-testid="member-direccion-input"
                  value={formData.direccion}
                  onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telefono">Teléfono</Label>
                <Input
                  id="telefono"
                  data-testid="member-telefono-input"
                  value={formData.telefono}
                  onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                  required
                />
              </div>
              <Button type="submit" data-testid="member-submit-button" className="w-full">
                {editingMember ? 'Actualizar' : 'Guardar'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
        <Input
          data-testid="member-search-input"
          placeholder="Buscar por nombre, apellido o teléfono..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 h-12"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Miembros ({filteredMembers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Nombre</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Apellido</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Dirección</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Teléfono</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-8 text-gray-500">
                      No hay miembros registrados
                    </td>
                  </tr>
                ) : (
                  filteredMembers.map((member) => (
                    <tr key={member.id} className="border-b hover:bg-gray-50" data-testid={`member-row-${member.id}`}>
                      <td className="py-3 px-4">{member.nombre}</td>
                      <td className="py-3 px-4">{member.apellido}</td>
                      <td className="py-3 px-4">{member.direccion}</td>
                      <td className="py-3 px-4">{member.telefono}</td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <Button
                            data-testid={`edit-member-${member.id}`}
                            variant="outline"
                            size="sm"
                            onClick={() => openEdit(member)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            data-testid={`delete-member-${member.id}`}
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(member.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}