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

export default function Visitors() {
  const [friends, setFriends] = useState([]);
  const [filteredFriends, setFilteredFriends] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [editingFriend, setEditingFriend] = useState(null);
  const [formData, setFormData] = useState({
    nombre: '',
    de_donde_viene: '',
  });

  useEffect(() => {
    fetchFriends();
  }, []);

  useEffect(() => {
    const filtered = friends.filter(
      (friend) =>
        friend.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        friend.de_donde_viene.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredFriends(filtered);
  }, [searchTerm, friends]);

  const fetchFriends = async () => {
    try {
      const response = await axios.get(`${API}/visitors`);
      setFriends(response.data);
      setFilteredFriends(response.data);
    } catch (error) {
      toast.error('Error al cargar amigos');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingFriend) {
        await axios.put(`${API}/visitors/${editingFriend.id}`, formData);
        toast.success('Amigo actualizado exitosamente');
      } else {
        await axios.post(`${API}/visitors`, formData);
        toast.success('Amigo registrado exitosamente');
      }
      fetchFriends();
      setIsOpen(false);
      resetForm();
    } catch (error) {
      toast.error('Error al guardar amigo');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('¿Estás seguro de eliminar este amigo?')) {
      try {
        await axios.delete(`${API}/visitors/${id}`);
        toast.success('Amigo eliminado exitosamente');
        fetchFriends();
      } catch (error) {
        toast.error('Error al eliminar amigo');
      }
    }
  };

  const openEdit = (friend) => {
    setEditingFriend(friend);
    setFormData({
      nombre: friend.nombre,
      de_donde_viene: friend.de_donde_viene,
    });
    setIsOpen(true);
  };

  const resetForm = () => {
    setEditingFriend(null);
    setFormData({
      nombre: '',
      de_donde_viene: '',
    });
  };

  return (
    <div className="space-y-6" data-testid="friends-page">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Amigos</h1>
          <p className="text-gray-600 text-lg">Gestiona los amigos de la iglesia</p>
        </div>
        <Dialog open={isOpen} onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button data-testid="add-friend-button" className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
              <UserPlus className="mr-2 h-4 w-4" />
              Agregar Amigo
            </Button>
          </DialogTrigger>
          <DialogContent data-testid="friend-dialog">
            <DialogHeader>
              <DialogTitle>{editingFriend ? 'Editar Amigo' : 'Nuevo Amigo'}</DialogTitle>
              <DialogDescription>
                {editingFriend ? 'Actualiza la información del amigo' : 'Completa el formulario para registrar un nuevo amigo'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre</Label>
                <Input
                  id="nombre"
                  data-testid="friend-nombre-input"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="de_donde_viene">¿De dónde viene?</Label>
                <Input
                  id="de_donde_viene"
                  data-testid="friend-origen-input"
                  value={formData.de_donde_viene}
                  onChange={(e) => setFormData({ ...formData, de_donde_viene: e.target.value })}
                  placeholder="Ciudad, país o referencia"
                  required
                />
              </div>
              <Button type="submit" data-testid="friend-submit-button" className="w-full">
                {editingFriend ? 'Actualizar' : 'Guardar'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
        <Input
          data-testid="friend-search-input"
          placeholder="Buscar por nombre o procedencia..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 h-12"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Amigos ({filteredFriends.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Nombre</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">¿De dónde viene?</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Fecha de Registro</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredFriends.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="text-center py-8 text-gray-500">
                      No hay amigos registrados
                    </td>
                  </tr>
                ) : (
                  filteredFriends.map((friend) => (
                    <tr key={friend.id} className="border-b hover:bg-gray-50" data-testid={`friend-row-${friend.id}`}>
                      <td className="py-3 px-4">{friend.nombre}</td>
                      <td className="py-3 px-4">{friend.de_donde_viene}</td>
                      <td className="py-3 px-4">
                        {new Date(friend.fecha_registro).toLocaleDateString('es-ES')}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <Button
                            data-testid={`edit-friend-${friend.id}`}
                            variant="outline"
                            size="sm"
                            onClick={() => openEdit(friend)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            data-testid={`delete-friend-${friend.id}`}
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(friend.id)}
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
