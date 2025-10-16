// ================================
// CONFIGURACIÓN DE MÓDULOS
// ================================
// Este archivo mapea los módulos de la BD con sus propiedades visuales

const modulosConfig = {
  'Gestion De Usuarios Del Sistema': {
    ruta: '/GestionUsuarios',
    icono: 'FaUsers',
    color: '#66d4ff',
    orden: 1
  },
  'Registro De Entradas y Salidas De Vehículos': {
    ruta: '/vehiculos',
    icono: 'FaCar',
    color: '#4caf50',
    orden: 2
  },
  'Cálculo Automático De Tarifas': {
    ruta: null,
    icono: 'FaCalculator',
    color: '#2196f3',
    orden: 3
  },
  'Generación De Tickets': {
    ruta: '/ticket',
    icono: 'FaReceipt',
    color: '#ff9800',
    orden: 4
  },
  'Cobros Y Facturación': {
    ruta: null,
    icono: 'FaFileInvoiceDollar',
    color: '#9c27b0',
    orden: 5
  },
  'Reportes Automáticos': {
    ruta: '/reportes',
    icono: 'FaChartPie',
    color: '#f44336',
    orden: 6
  },
  'justes': {
    ruta: null,
    icono: 'FaCog',
    color: '#607d8b',
    orden: 7
  }
};

// Función para enriquecer módulos con configuración
function enriquecerModulos(modulos) {
  return modulos.map(modulo => {
    const config = modulosConfig[modulo.nombre_modulo] || {
      ruta: null,
      icono: 'FaCog',
      color: '#66d4ff',
      orden: 999
    };
    
    return {
      ...modulo,
      ...config
    };
  }).sort((a, b) => a.orden - b.orden);
}

module.exports = { modulosConfig, enriquecerModulos };
