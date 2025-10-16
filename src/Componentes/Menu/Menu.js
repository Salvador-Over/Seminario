import Clock from 'react-clock';
import 'react-clock/dist/Clock.css';
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../Menu/Menu.css";
import { 
  FaReceipt, FaCalculator, FaCar, FaChartPie, FaFileInvoiceDollar, 
  FaUsers, FaCog, FaSignOutAlt, FaUserTie, FaClock
} from "react-icons/fa";

const Menu = () => {
  const navigate = useNavigate();

  // 🔹 Instrucción para Validar token al cargar el componente
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/"); // Esta instrucción redirige al login si no hay token
    }
  }, [navigate]);

  const usuario = localStorage.getItem("usuario") || "Usuario";
  const [dateTime, setDateTime] = useState(new Date());
  const [modulos, setModulos] = useState([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setDateTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Cargar módulos desde localStorage
  useEffect(() => {
    const modulosGuardados = localStorage.getItem("modulos");
    if (modulosGuardados) {
      setModulos(JSON.parse(modulosGuardados));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("rol");
    localStorage.removeItem("usuario");
    localStorage.removeItem("id_usuario");
    localStorage.removeItem("modulos");
    navigate("/");
  };

  const getRolNombre = (rol) => {
    switch(rol) {
      case 'admin': return 'Administrador';
      case 'usuario': return 'Usuario';
      case 'supervisor': return 'Supervisor';
      default: return 'Usuario';
    }
  };

  // Mapeo de íconos
  const iconMap = {
    'FaUsers': <FaUsers />,
    'FaCar': <FaCar />,
    'FaCalculator': <FaCalculator />,
    'FaReceipt': <FaReceipt />,
    'FaFileInvoiceDollar': <FaFileInvoiceDollar />,
    'FaChartPie': <FaChartPie />,
    'FaCog': <FaCog />
  };

  return (
    <div>
      {/* Mensaje de Bienvenida */}
      <div className="welcome-floating">
        <FaUserTie className="welcome-icon" size={16}/>
        Bienvenido | {usuario}
      </div>

      {/* Mostrar Fecha y Hora */}
      <div className="datetime-floating">
        <div className="mini-clock">
          <div className="hand hour" style={{ transform: `rotate(${dateTime.getHours() * 30 + dateTime.getMinutes()/2}deg)` }} />
          <div className="hand minute" style={{ transform: `rotate(${dateTime.getMinutes() * 6}deg)` }} />
          <div className="hand second" style={{ transform: `rotate(${dateTime.getSeconds() * 6}deg)` }} />
        </div>
        {dateTime.toLocaleTimeString().toUpperCase()}
      </div>

      {/* Contenedor del menú */}
      <div className="menu-container">
        <div className="menu-header">
          <h1 className="menu-title">Gestión de Estacionamiento.</h1>
          <button className="logout-button" onClick={handleLogout}>
            <FaSignOutAlt />
            <span>Salir</span>
          </button>
        </div>
        {modulos.length > 0 ? (
          <div className="menu-grid">
            {modulos.map((modulo) => (
              <div
                key={modulo.id_modulo}
                className="menu-card"
                style={{ 
                  backgroundColor: modulo.color || '#66d4ff', 
                  cursor: modulo.ruta ? 'pointer' : 'default' 
                }}
                onClick={() => modulo.ruta && navigate(modulo.ruta)}
              >
                <div className="menu-icon">{iconMap[modulo.icono] || <FaCog />}</div>
                <p className="menu-label">{modulo.nombre_modulo}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="sin-permisos">
            <FaCog size={60} color="#ccc" />
            <h2>Sin Permisos de Acceso</h2>
            <p>No tienes permisos asignados para acceder a ningún módulo del sistema.</p>
            <p>Por favor, contacta al administrador para solicitar los accesos necesarios.</p>
          </div>
        )}

      </div>
    </div>
  );
};

export default Menu;
