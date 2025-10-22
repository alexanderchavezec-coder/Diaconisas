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
  const [visitors, setVisitors] = useState([]);
  const [filteredVisitors, setFilteredVisitors] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [editingVisitor, setEditingVisitor] = useState(null);
  const [formData, setFormData] = useState({
    nombre: '',
    de_donde_viene: '',
  });

  useEffect(() => {
    fetchVisitors();
  }, []);

  useEffect(() => {
    const filtered = visitors.filter(
      (visitor) =>
        visitor.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        visitor.de_donde_viene.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredVisitors(filtered);
  }, [searchTerm, visitors]);

  const fetchVisitors = async () => {
    try {
      const response = await axios.get(`${API}/visitors`);
      setVisitors(response.data);
      setFilteredVisitors(response.data);
    } catch (error) {
      toast.error('Error al cargar visitantes');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingVisitor) {
        await axios.put(`${API}/visitors/${editingVisitor.id}`, formData);
        toast.success('Visitante actualizado exitosamente');
      } else {
        await axios.post(`${API}/visitors`, formData);
        toast.success('Visitante registrado exitosamente');
      }
      fetchVisitors();
      setIsOpen(false);
      resetForm();
    } catch (error) {
      toast.error('Error al guardar visitante');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('¿Estás seguro de eliminar este visitante?')) {
      try {
        await axios.delete(`${API}/visitors/${id}`);
        toast.success('Visitante eliminado exitosamente');
        fetchVisitors();
      } catch (error) {
        toast.error('Error al eliminar visitante');
      }
    }
  };

  const openEdit = (visitor) => {
    setEditingVisitor(visitor);
    setFormData({
      nombre: visitor.nombre,
      de_donde_viene: visitor.de_donde_viene,
    });
    setIsOpen(true);
  };

  const resetForm = () => {
    setEditingVisitor(null);
    setFormData({
      nombre: '',
      de_donde_viene: '',
    });
  };

  return (
    <div className="space-y-6" data-testid="visitors-page">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Visitantes</h1>
          <p className="text-gray-600 text-lg">Gestiona los visitantes de la iglesia</p>
        </div>
        <Dialog open={isOpen} onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button data-testid="add-visitor-button" className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
              <UserPlus className="mr-2 h-4 w-4" />
              Agregar Visitante
            </Button>
          </DialogTrigger>
          <DialogContent data-testid="visitor-dialog">
            <DialogHeader>
              <DialogTitle>{editingVisitor ? 'Editar Visitante' : 'Nuevo Visitante'}</DialogTitle>
              <DialogDescription>
                {editingVisitor ? 'Actualiza la información del visitante' : 'Completa el formulario para registrar un nuevo visitante'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre</Label>
                <Input
                  id="nombre"
                  data-testid="visitor-nombre-input"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="de_donde_viene">¿De dónde viene?</Label>
                <Input
                  id="de_donde_viene"
                  data-testid="visitor-origen-input"
                  value={formData.de_donde_viene}
                  onChange={(e) => setFormData({ ...formData, de_donde_viene: e.target.value })}
                  placeholder="Ciudad, país o referencia"
                  required
                />
              </div>
              <Button type="submit" data-testid="visitor-submit-button" className="w-full">
                {editingVisitor ? 'Actualizar' : 'Guardar'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
        <Input
          data-testid="visitor-search-input"
          placeholder="Buscar por nombre o procedencia..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 h-12"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Visitantes ({filteredVisitors.length})</CardTitle>
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
                {filteredVisitors.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="text-center py-8 text-gray-500">
                      No hay visitantes registrados
                    </td>
                  </tr>
                ) : (
                  filteredVisitors.map((visitor) => (
                    <tr key={visitor.id} className="border-b hover:bg-gray-50" data-testid={`visitor-row-${visitor.id}`}>
                      <td className="py-3 px-4">{visitor.nombre}</td>
                      <td className="py-3 px-4">{visitor.de_donde_viene}</td>
                      <td className="py-3 px-4">
                        {new Date(visitor.fecha_registro).toLocaleDateString('es-ES')}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <Button
                            data-testid={`edit-visitor-${visitor.id}`}
                            variant="outline"
                            size="sm"
                            onClick={() => openEdit(visitor)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            data-testid={`delete-visitor-${visitor.id}`}
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(visitor.id)}
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