// src/components/GestionUsuarios.js
import React, { useState, useEffect } from "react";
import { DataGrid } from "@mui/x-data-grid";
import { FaHome, FaEdit, FaTrash } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import "./GestionUsuarios.css";

const GestionUsuarios = () => {
  const navigate = useNavigate();

  const [usuario, setUsuario] = useState({
    usuario: "",
    contrasena: "",
    rol: "",
  });

  const [usuarios, setUsuarios] = useState([]);
  const [editando, setEditando] = useState(false);
  const [idEditando, setIdEditando] = useState(null);
  const [mostrarPermisos, setMostrarPermisos] = useState(false);
  
  // Estados para módulos dinámicos
  const [modulosDisponibles, setModulosDisponibles] = useState([]);
  const [modulosSeleccionados, setModulosSeleccionados] = useState([]);

  // Configuración de idioma español para DataGrid
  const localeText = {
    // Menú de columnas
    columnMenuLabel: 'Menú',
    columnMenuShowColumns: 'Mostrar columnas',
    columnMenuManageColumns: 'Administrar columnas',
    columnMenuFilter: 'Filtrar',
    columnMenuHideColumn: 'Ocultar columna',
    columnMenuUnsort: 'Desordenar',
    columnMenuSortAsc: 'Ordenar ascendente',
    columnMenuSortDesc: 'Ordenar descendente',
    
    // Filtros
    filterPanelAddFilter: 'Agregar filtro',
    filterPanelRemoveAll: 'Eliminar todos',
    filterPanelDeleteIconLabel: 'Eliminar',
    filterPanelLogicOperator: 'Operador lógico',
    filterPanelOperator: 'Operador',
    filterPanelOperatorAnd: 'Y',
    filterPanelOperatorOr: 'O',
    filterPanelColumns: 'Columnas',
    filterPanelInputLabel: 'Valor',
    filterPanelInputPlaceholder: 'Filtrar valor',
    
    // Paginación
    MuiTablePagination: {
      labelRowsPerPage: 'Filas por página:',
      labelDisplayedRows: ({ from, to, count }) => `${from}–${to} de ${count !== -1 ? count : `más de ${to}`}`,
    },
    
    // Otros
    noRowsLabel: 'Sin filas',
    noResultsOverlayLabel: 'No se encontraron resultados',
    errorOverlayDefaultLabel: 'Ocurrió un error',
  };

  // Cargar módulos disponibles al montar el componente
  useEffect(() => {
    fetch('http://localhost:3001/api/modulos')
      .then(res => res.json())
      .then(data => setModulosDisponibles(data))
      .catch(err => console.error('Error al cargar módulos:', err));
  }, []);

  const handleChange = (e) => {
    setUsuario({
      ...usuario,
      [e.target.name]: e.target.value,
    });
  };

  const handleModuloChange = (id_modulo) => {
    if (modulosSeleccionados.includes(id_modulo)) {
      setModulosSeleccionados(modulosSeleccionados.filter(id => id !== id_modulo));
    } else {
      setModulosSeleccionados([...modulosSeleccionados, id_modulo]);
    }
  };

  const handleRolChange = (e) => {
    const nuevoRol = e.target.value;
    setUsuario({
      ...usuario,
      rol: nuevoRol,
    });
    
    // Mostrar permisos solo si es usuario (no admin)
    setMostrarPermisos(nuevoRol === "usuario");
    
    // Si cambia a admin, limpiar selección de módulos
    if (nuevoRol === "admin") {
      setModulosSeleccionados([]);
    }
  };

  // 🔹 Obtener usuarios desde el backend
  const fetchUsuarios = async () => {
    try {
      // const response = await fetch("https://seminario-backend-1.onrender.com/api/usuarios");
      const response = await fetch("http://localhost:3001/api/usuarios");
      if (!response.ok) throw new Error("Error al obtener usuarios");
      const data = await response.json();
      setUsuarios(data);
    } catch (error) {
      console.error("Error al obtener usuarios:", error);
    }
  };

  // 🔹 Registrar o actualizar usuario
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      let userId;
      
      if (editando) {
        // Actualizar usuario existente
        const response = await fetch(`http://localhost:3001/api/usuarios/${idEditando}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(usuario),
        });
        if (!response.ok) throw new Error("Error al actualizar usuario");
        const data = await response.json();
        alert(data.mensaje);
        userId = idEditando;
      } else {
        // Crear nuevo usuario
        const response = await fetch("http://localhost:3001/api/usuarios", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(usuario),
        });
        if (!response.ok) throw new Error("Error al registrar usuario");
        const data = await response.json();
        alert(data.mensaje);
        userId = data.id;
      }
      
      // Si es usuario (no admin), asignar permisos
      if (usuario.rol === "usuario") {
        await fetch(`http://localhost:3001/api/usuarios/${userId}/permisos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ modulos: modulosSeleccionados }),
        });
      }
      
      // Limpiar formulario
      setUsuario({
        usuario: "",
        contrasena: "",
        rol: "",
      });
      setModulosSeleccionados([]);
      setEditando(false);
      setIdEditando(null);
      setMostrarPermisos(false);
      fetchUsuarios();
    } catch (error) {
      console.error("Error al guardar usuario:", error);
      alert("Error al guardar el usuario");
    }
  };

  // 🔹 Editar usuario
  const handleEdit = async (usuarioData) => {
    setUsuario({
      usuario: usuarioData.usuario,
      contrasena: "", // No mostramos la contraseña por seguridad
      rol: usuarioData.rol,
    });
    setEditando(true);
    setIdEditando(usuarioData.id);
    setMostrarPermisos(usuarioData.rol === "usuario");
    
    // Si es usuario, cargar sus permisos
    if (usuarioData.rol === "usuario") {
      try {
        const response = await fetch(`http://localhost:3001/api/usuarios/${usuarioData.id}/permisos`);
        const permisos = await response.json();
        
        // Marcar módulos que tiene acceso
        const modulosConAcceso = permisos
          .filter(p => p.tiene_acceso)
          .map(p => p.id_modulo);
        
        setModulosSeleccionados(modulosConAcceso);
      } catch (error) {
        console.error('Error al cargar permisos:', error);
      }
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 🔹 Cancelar edición
  const handleCancelEdit = () => {
    setUsuario({
      usuario: "",
      contrasena: "",
      rol: "",
    });
    setModulosSeleccionados([]);
    setEditando(false);
    setIdEditando(null);
    setMostrarPermisos(false);
  };

  // 🔹 Eliminar usuario
  const handleDelete = async (id) => {
    if (!window.confirm("¿Estás seguro de eliminar este usuario?")) return;
    
    try {
      // const response = await fetch(`https://seminario-backend-1.onrender.com/api/usuarios/${id}`, {
      const response = await fetch(`http://localhost:3001/api/usuarios/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Error al eliminar usuario");
      const data = await response.json();
      alert(data.mensaje);
      fetchUsuarios();
    } catch (error) {
      console.error("Error al eliminar usuario:", error);
      alert("Error al eliminar el usuario");
    }
  };

  useEffect(() => {
    fetchUsuarios();
  }, []);

  return (
    <div className="usuarios-container">
      {/* Botón regresar */}
      <button className="btn-regresar" onClick={() => navigate("/menu")}>
        <FaHome style={{ marginRight: 8 }} />
        Regresar al Menú
      </button>

      <h2 className="usuarios-title">Gestión de Usuarios</h2>

      <form className="usuarios-form" onSubmit={handleSubmit}>
        <div className="input-group">
          <label htmlFor="usuario">Usuario</label>
          <input
            type="text"
            id="usuario"
            name="usuario"
            value={usuario.usuario}
            onChange={handleChange}
            required
          />
        </div>

        <div className="input-group">
          <label htmlFor="contrasena">
            Contraseña {editando && "(dejar vacío para mantener la actual)"}
          </label>
          <input
            type="password"
            id="contrasena"
            name="contrasena"
            value={usuario.contrasena}
            onChange={handleChange}
            required={!editando}
            placeholder={editando ? "Dejar vacío para no cambiar" : ""}
          />
        </div>

        <div className="input-group">
          <label htmlFor="rol">Rol</label>
          <select
            id="rol"
            name="rol"
            value={usuario.rol}
            onChange={handleRolChange}
            required
          >
            <option value="">Seleccione</option>
            <option value="admin">Administrador</option>
            <option value="usuario">Usuario</option>
          </select>
        </div>

        {/* Sección de Permisos - Solo visible para usuarios no admin */}
        {mostrarPermisos && (
          <div className="permisos-container">
            <h4 className="permisos-title">📋 Módulos del Sistema - Selecciona los Accesos</h4>
            <p className="permisos-descripcion">
              Marca los módulos a los que este usuario tendrá acceso en el sistema
            </p>
            <div className="permisos-grid">
              {modulosDisponibles.map((modulo) => (
                <label key={modulo.id_modulo} className="permiso-item">
                  <input
                    type="checkbox"
                    checked={modulosSeleccionados.includes(modulo.id_modulo)}
                    onChange={() => handleModuloChange(modulo.id_modulo)}
                  />
                  <div className="permiso-info">
                    <span className="permiso-nombre">{modulo.nombre_modulo}</span>
                  </div>
                </label>
              ))}
            </div>
            <div className="permisos-nota">
              💡 <strong>Nota:</strong> Los administradores tienen acceso completo a todos los módulos automáticamente.
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button type="submit" className="btn-submit">
            {editando ? "Actualizar Usuario" : "Registrar Usuario"}
          </button>
          
          <button 
            type="button" 
            className="btn-limpiar" 
            onClick={handleCancelEdit}
          >
          Limpiar Campos
          </button>
          
          {editando && (
            <button 
              type="button" 
              className="btn-cancel" 
              onClick={handleCancelEdit}
            >
              Cancelar Edición
            </button>
          )}
        </div>
      </form>

      <h3 className="usuarios-subtitle">Usuarios Registrados</h3>

      <div className="table-container">
        <DataGrid
          rows={usuarios}
          columns={[
            { field: "id", headerName: "ID", width: 70 },
            { field: "usuario", headerName: "Usuario", width: 200 },
            { field: "rol", headerName: "Rol", width: 150 },
            {
              field: "acciones",
              headerName: "Acciones",
              width: 150,
              renderCell: (params) => (
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => handleEdit(params.row)}
                    className="btn-action btn-edit"
                    title="Editar"
                  >
                    <FaEdit />
                  </button>
                  <button
                    onClick={() => handleDelete(params.row.id)}
                    className="btn-action btn-delete"
                    title="Eliminar"
                  >
                    <FaTrash />
                  </button>
                </div>
              ),
            },
          ]}
          pageSize={5}
          rowsPerPageOptions={[5]}
          autoHeight
          getRowId={(row) => row.id}
          localeText={localeText}
        />
      </div>
    </div>
  );
};

export default GestionUsuarios;