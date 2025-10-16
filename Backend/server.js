const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { enriquecerModulos } = require('./config_modulos');

const SECRET_KEY = "tu_clave_secreta"; // puedes dejarla aquí fijo si no usas .env

const app = express();
app.use(cors());
app.use(express.json());

// 🔹 Configuración de conexión a Azure MySQL
const connection = mysql.createConnection({
  host: "seminario.mysql.database.azure.com", // ejemplo: mydbserver.mysql.database.azure.com
  user: "administradorseminario",              // ejemplo: adminuser@mydbserver
  password: "Seminario123",
  database: "seminario",
  port: 3306,
  ssl: {
    rejectUnauthorized: true // Azure requiere SSL para conexiones seguras
  }
});

connection.connect((err) => {
  if (err) {
    console.error(" Error de conexión a Azure:", err);
    return;
  }
  console.log(" Conexión exitosa a Azure MySQL");
});

// Ruta para el login
app.post('/api/login', (req, res) => {
  console.log(" req.body completo:", req.body);
  console.log(" Tipo de req.body:", typeof req.body);
  console.log(" Keys de req.body:", Object.keys(req.body));
  
  const { usuario, contrasena } = req.body;

  console.log(" Intento de login:", { usuario, contrasena: "***" });
  console.log(" Usuario es:", usuario, "| Tipo:", typeof usuario);
  console.log(" Contrasena es:", contrasena ? "***" : "undefined/null", "| Tipo:", typeof contrasena);

  if (!usuario || !contrasena) {
    console.log(" VALIDACIÓN FALLÓ - Faltan datos");
    return res.status(400).json({ mensaje: 'Faltan datos' });
  }

  const query = `
    SELECT id, usuario, contrasena, rol FROM usuarios
    WHERE BINARY usuario = ?
    LIMIT 1
  `;

  connection.query(query, [usuario], (err, results) => {
    if (err) {
      console.error("❌ Error en la consulta:", err);
      return res.status(500).json({ mensaje: 'Error del servidor' });
    }

    console.log("📊 Resultados encontrados:", results.length);

    if (results.length > 0) {
      const user = results[0];
      console.log("👤 Usuario encontrado:", user.usuario, "| Rol:", user.rol);
      console.log("🔐 Hash en BD:", user.contrasena);
      
      // 🔹 Comparar la contraseña ingresada con el hash almacenado
      const passwordMatch = bcrypt.compareSync(contrasena, user.contrasena);
      console.log("✅ Contraseña coincide:", passwordMatch);
      
      if (!passwordMatch) {
        console.log("❌ Contraseña incorrecta para usuario:", usuario);
        return res.status(401).json({ mensaje: "Credenciales incorrectas", exito: false });
      }

      const token = jwt.sign(
        { id: user.id, usuario: user.usuario, rol: user.rol },
        SECRET_KEY,
        { expiresIn: "1h" }
      );

      // Obtener módulos del usuario
      if (user.rol === 'admin') {
        // Si es admin, obtener todos los módulos
        const modulosQuery = "SELECT id_modulo, nombre_modulo FROM modulos";
        
        connection.query(modulosQuery, (err, modulos) => {
          if (err) {
            console.error("❌ Error al obtener módulos:", err);
            return res.status(500).json({ mensaje: 'Error al obtener módulos' });
          }
          
          // Enriquecer módulos con configuración
          const modulosEnriquecidos = enriquecerModulos(modulos);
          
          console.log("✅ Login exitoso para admin:", usuario);
          res.json({ 
            mensaje: "Inicio de sesión exitoso",
            exito: true,
            usuario: {
              id: user.id,
              usuario: user.usuario,
              rol: user.rol,
              modulos: modulosEnriquecidos
            },
            token
          });
        });
      } else {
        // Si es usuario, obtener solo sus módulos permitidos
        const modulosQuery = `
          SELECT m.id_modulo, m.nombre_modulo
          FROM modulos m
          INNER JOIN permisos_usuario p ON m.id_modulo = p.id_modulo
          WHERE p.id_usuario = ?
        `;
        
        connection.query(modulosQuery, [user.id], (err, modulos) => {
          if (err) {
            console.error("❌ Error al obtener módulos:", err);
            return res.status(500).json({ mensaje: 'Error al obtener módulos' });
          }
          
          // Enriquecer módulos con configuración
          const modulosEnriquecidos = enriquecerModulos(modulos);
          
          console.log("✅ Login exitoso para:", usuario);
          res.json({ 
            mensaje: "Inicio de sesión exitoso",
            exito: true,
            usuario: {
              id: user.id,
              usuario: user.usuario,
              rol: user.rol,
              modulos: modulosEnriquecidos
            },
            token
          });
        });
      }
    } else {
      console.log("❌ Usuario no encontrado:", usuario);
      res.status(401).json({ mensaje: "Credenciales incorrectas", exito: false });
    }
  });
  
});

// ================================
// RUTAS PARA MÓDULOS Y PERMISOS
// ================================

// Obtener todos los módulos
app.get('/api/modulos', (req, res) => {
  const query = "SELECT id_modulo, nombre_modulo FROM modulos";
  
  connection.query(query, (err, results) => {
    if (err) {
      console.error("❌ Error al obtener módulos:", err);
      return res.status(500).json({ mensaje: "Error al obtener módulos" });
    }
    
    // Enriquecer módulos con configuración (ruta, icono, color, orden)
    const modulosEnriquecidos = enriquecerModulos(results);
    res.json(modulosEnriquecidos);
  });
});

// Obtener módulos de un usuario específico
app.get('/api/usuarios/:id/modulos', (req, res) => {
  const { id } = req.params;
  
  const query = `
    SELECT m.id_modulo, m.nombre_modulo
    FROM modulos m
    INNER JOIN permisos_usuario p ON m.id_modulo = p.id_modulo
    WHERE p.id_usuario = ?
  `;
  
  connection.query(query, [id], (err, results) => {
    if (err) {
      console.error("❌ Error al obtener módulos del usuario:", err);
      return res.status(500).json({ mensaje: "Error al obtener módulos" });
    }
    
    // Enriquecer módulos con configuración
    const modulosEnriquecidos = enriquecerModulos(results);
    res.json(modulosEnriquecidos);
  });
});

// Asignar permisos a un usuario
app.post('/api/usuarios/:id/permisos', (req, res) => {
  const { id } = req.params;
  const { modulos } = req.body; // Array de id_modulo
  
  if (!modulos || !Array.isArray(modulos)) {
    return res.status(400).json({ mensaje: "Formato de módulos inválido" });
  }
  
  // Primero eliminar permisos existentes
  const deleteQuery = "DELETE FROM permisos_usuario WHERE id_usuario = ?";
  
  connection.query(deleteQuery, [id], (err) => {
    if (err) {
      console.error("❌ Error al eliminar permisos:", err);
      return res.status(500).json({ mensaje: "Error al actualizar permisos" });
    }
    
    if (modulos.length === 0) {
      return res.json({ mensaje: "✅ Permisos actualizados correctamente" });
    }
    
    // Insertar nuevos permisos
    const insertQuery = "INSERT INTO permisos_usuario (id_usuario, id_modulo) VALUES ?";
    const values = modulos.map(id_modulo => [id, id_modulo]);
    
    connection.query(insertQuery, [values], (err) => {
      if (err) {
        console.error("❌ Error al insertar permisos:", err);
        return res.status(500).json({ mensaje: "Error al asignar permisos" });
      }
      res.json({ mensaje: "✅ Permisos actualizados correctamente" });
    });
  });
});

// Obtener permisos de un usuario (para edición)
app.get('/api/usuarios/:id/permisos', (req, res) => {
  const { id } = req.params;
  
  const query = `
    SELECT m.id_modulo, m.nombre_modulo,
           CASE WHEN p.id_permiso IS NOT NULL THEN TRUE ELSE FALSE END as tiene_acceso
    FROM modulos m
    LEFT JOIN permisos_usuario p ON m.id_modulo = p.id_modulo AND p.id_usuario = ?
    ORDER BY m.id_modulo
  `;
  
  connection.query(query, [id], (err, results) => {
    if (err) {
      console.error("❌ Error al obtener permisos:", err);
      return res.status(500).json({ mensaje: "Error al obtener permisos" });
    }
    
    // Enriquecer con configuración y ordenar
    const resultadosEnriquecidos = enriquecerModulos(results);
    res.json(resultadosEnriquecidos);
  });
});

// Iniciar servidor
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});



////// NUEVO VEHICULO
// Ruta para registrar un nuevo vehículo (entrada)
app.post("/vehiculos", (req, res) => {
  const { placa, marca, color, tipo, codigo_barra } = req.body;

  const query = `
    INSERT INTO vehiculos (placa, codigo_barra, marca, color, tipo)
    VALUES (?, ?, ?, ?, ?)
  `;

  connection.query(query, [placa, codigo_barra, marca, color, tipo], (err, results) => {
    if (err) {
      console.error("❌ Error al registrar vehículo:", err);
      return res.status(500).json({ message: "Error al registrar el vehículo" });
    }

    res.status(201).json({ 
      message: "✅ Vehículo registrado con éxito", 
      id: results.insertId 
    });
  });
});



// Ruta para obtener vehículos activos (los que están en el parqueo)
app.get('/vehiculos/activos', (req, res) => {
  const query = `
    SELECT id, placa, marca, color, tipo, hora_ingreso
    FROM vehiculos
    WHERE estado = 'Activo'
    ORDER BY hora_ingreso DESC
  `;

  connection.query(query, (err, results) => {
    if (err) {
      console.error('Error al obtener vehículos activos:', err);
      return res.status(500).json({ mensaje: 'Error al obtener vehículos activos' });
    }
    res.json(results);
  });
});


// ================================
// ENDPOINTS DE PRUEBA PARA VER BASE DE DATOS
// ================================

// Debug específico para un vehículo
app.get('/api/test/debug-vehiculo/:id', (req, res) => {
  const { id } = req.params;
  
  const query = `
    SELECT id, placa, marca, color, tipo, estado,
           hora_ingreso,
           NOW() as hora_actual,
           TIMESTAMPDIFF(SECOND, hora_ingreso, NOW()) as segundos_diferencia,
           TIMESTAMPDIFF(MINUTE, hora_ingreso, NOW()) as minutos_diferencia
    FROM vehiculos 
    WHERE id = ?
    LIMIT 1
  `;
  
  connection.query(query, [id], (err, results) => {
    if (err) {
      console.error('Error en debug:', err);
      return res.status(500).json({ error: err.message });
    }
    
    if (results.length > 0) {
      const vehiculo = results[0];
      res.json({
        vehiculo: vehiculo,
        debug_info: {
          id: vehiculo.id,
          placa: vehiculo.placa,
          estado: vehiculo.estado,
          hora_ingreso_bd: vehiculo.hora_ingreso,
          hora_actual_bd: vehiculo.hora_actual,
          diferencia_segundos: vehiculo.segundos_diferencia,
          diferencia_minutos: vehiculo.minutos_diferencia,
          es_activo: vehiculo.estado === 'Activo'
        }
      });
    } else {
      res.status(404).json({ error: 'Vehículo no encontrado' });
    }
  });
});


// Crear vehículo de prueba con hora actual
app.post('/api/test/vehiculo-prueba', (req, res) => {
  const query = `
    INSERT INTO vehiculos (placa, marca, color, tipo, hora_ingreso, estado)
    VALUES ('TEST-001', 'Toyota', 'Rojo', 'Carro', NOW(), 'Activo')
  `;
  
  connection.query(query, (err, results) => {
    if (err) {
      console.error('Error al crear vehículo de prueba:', err);
      return res.status(500).json({ error: err.message });
    }
    res.json({
      mensaje: 'Vehículo de prueba creado',
      id: results.insertId,
      instruccion: `Usa el código: ${results.insertId} para probar el sistema de salida`
    });
  });
});


// Ver vehículos activos para códigos de barras (para pruebas)
app.get('/api/test/codigos-disponibles', (req, res) => {
  const query = `
    SELECT id as codigo_barras, placa, marca, color, tipo, 
           hora_ingreso,
           TIMESTAMPDIFF(MINUTE, hora_ingreso, NOW()) as minutos_estacionado
    FROM vehiculos 
    WHERE estado = 'Activo' 
    ORDER BY hora_ingreso DESC
  `;
  
  connection.query(query, (err, results) => {
    if (err) {
      console.error('Error al obtener códigos disponibles:', err);
      return res.status(500).json({ error: err.message });
    }
    
    const codigosParaPrueba = results.map(vehiculo => ({
      codigo_barras: vehiculo.codigo_barras,
      placa: vehiculo.placa,
      marca: vehiculo.marca,
      tiempo_estacionado: `${Math.floor(vehiculo.minutos_estacionado / 60)}h ${vehiculo.minutos_estacionado % 60}m`,
      instruccion: `Usa el código: ${vehiculo.codigo_barras}`
    }));
    
    res.json({
      mensaje: "Códigos de barras disponibles para probar el sistema de salida:",
      total_disponibles: results.length,
      codigos: codigosParaPrueba,
      instrucciones: "Copia cualquiera de estos códigos en el campo 'Escanear Código de Barras' en la página de Salidas"
    });
  });
});


// Ver todos los vehículos (activos e inactivos)
app.get('/api/test/vehiculos/todos', (req, res) => {
  const query = `
    SELECT id, placa, marca, color, tipo, estado, 
           hora_ingreso, hora_salida, monto_pagado, 
           efectivo_recibido, cambio 
    FROM vehiculos 
    ORDER BY id DESC
  `;
  
  connection.query(query, (err, results) => {
    if (err) {
      console.error('Error al obtener todos los vehículos:', err);
      return res.status(500).json({ error: err.message });
    }
    res.json({
      total: results.length,
      vehiculos: results
    });
  });
});

// Ver todos los usuarios
app.get('/api/test/usuarios/todos', (req, res) => {
  const query = "SELECT id, usuario, rol FROM usuarios ORDER BY id DESC";
  
  connection.query(query, (err, results) => {
    if (err) {
      console.error('Error al obtener todos los usuarios:', err);
      return res.status(500).json({ error: err.message });
    }
    res.json({
      total: results.length,
      usuarios: results
    });
  });
});

// Ver estructura de la tabla vehículos
app.get('/api/test/estructura/vehiculos', (req, res) => {
  const query = "DESCRIBE vehiculos";
  
  connection.query(query, (err, results) => {
    if (err) {
      console.error('Error al obtener estructura:', err);
      return res.status(500).json({ error: err.message });
    }
    res.json({
      estructura: results
    });
  });
});

// Ver estadísticas generales
app.get('/api/test/estadisticas', (req, res) => {
  const queries = {
    totalVehiculos: "SELECT COUNT(*) as total FROM vehiculos",
    vehiculosActivos: "SELECT COUNT(*) as activos FROM vehiculos WHERE estado = 'Activo'",
    vehiculosInactivos: "SELECT COUNT(*) as inactivos FROM vehiculos WHERE estado = 'Inactivo'",
    totalUsuarios: "SELECT COUNT(*) as total FROM usuarios"
  };
  
  const stats = {};
  let completed = 0;
  const totalQueries = Object.keys(queries).length;
  
  Object.entries(queries).forEach(([key, query]) => {
    connection.query(query, (err, results) => {
      if (!err && results.length > 0) {
        stats[key] = results[0];
      } else {
        stats[key] = { error: err?.message || 'No data' };
      }
      
      completed++;
      if (completed === totalQueries) {
        res.json(stats);
      }
    });
  });
});


// ================================
// RUTAS PARA SALIDA DE VEHÍCULOS
// ================================

// Obtener información del ticket por código
app.get('/api/ticket/:codigo', (req, res) => {
  const { codigo } = req.params;
  
  // Buscar el vehículo por su código de barras
  const query = `
    SELECT id, placa, marca, color, tipo, codigo_barra,
           CONVERT_TZ(hora_ingreso, '+00:00', @@session.time_zone) as hora_ingreso_local,
           hora_ingreso
    FROM vehiculos 
    WHERE codigo_barra = ? AND estado = 'Activo'
    LIMIT 1
  `;
  
  connection.query(query, [codigo], (err, results) => {
    if (err) {
      console.error('Error al buscar ticket:', err);
      return res.status(500).json({ mensaje: 'Error del servidor' });
    }
    
    if (results.length > 0) {
      const vehiculo = results[0];
      
      // Usar la hora local si está disponible, sino usar la original
      const horaEntrada = vehiculo.hora_ingreso_local || vehiculo.hora_ingreso;
      
      console.log('🕐 Vehículo encontrado:', {
        id: vehiculo.id,
        placa: vehiculo.placa,
        hora_original: vehiculo.hora_ingreso,
        hora_local: vehiculo.hora_ingreso_local,
        hora_usada: horaEntrada
      });
      
      res.json({
        success: true,
        ticketId: vehiculo.id, // ID del vehículo para procesamiento de salida
        codigoBarras: vehiculo.codigo_barra, // Código de barras para referencia
        placa: vehiculo.placa,
        horaEntrada: horaEntrada,
        vehiculo: vehiculo
      });
    } else {
      res.status(404).json({ success: false, mensaje: 'Ticket no encontrado' });
    }
  });
});

// Procesar salida de vehículo y pago
app.post('/api/vehiculos/salida', (req, res) => {
  const { ticketId, montoAPagar, efectivoRecibido, cambio } = req.body;
  
  if (!ticketId || !montoAPagar || !efectivoRecibido) {
    return res.status(400).json({ mensaje: 'Faltan datos obligatorios' });
  }
  
  // Intentar diferentes valores para el estado hasta encontrar uno que funcione
  // Probamos con valores muy cortos (1-2 caracteres)
  const estadosPosibles = ['0', '1', '2', 'S', 'P', 'F', 'X', 'N', 'Y'];
  
  const intentarActualizacion = (index = 0) => {
    if (index >= estadosPosibles.length) {
      // Si ningún estado funciona, solo actualizar la hora_salida
      console.log('⚠️ No se pudo cambiar estado, solo actualizando hora_salida');
      const querySimple = `UPDATE vehiculos SET hora_salida = NOW() WHERE id = ? AND estado = 'Activo'`;
      
      connection.query(querySimple, [ticketId], (err, results) => {
        if (err) {
          console.error('❌ Error incluso con query simple:', err);
          return res.status(500).json({ 
            mensaje: 'Error: No se pudo procesar la salida',
            exito: false 
          });
        }
        
        if (results.affectedRows > 0) {
          console.log(`✅ Hora de salida actualizada para vehículo ID: ${ticketId} (estado sin cambiar)`);
          res.json({ 
            mensaje: 'Salida procesada (hora registrada)',
            exito: true,
            nota: 'Estado no modificado por restricciones de BD'
          });
        } else {
          res.status(404).json({ 
            mensaje: 'Ticket no encontrado o ya procesado',
            exito: false 
          });
        }
      });
      return;
    }
    
    const estadoActual = estadosPosibles[index];
    const query = `
      UPDATE vehiculos 
      SET estado = ?, 
          hora_salida = NOW()
      WHERE id = ? AND estado = 'Activo'
    `;
    
    connection.query(query, [estadoActual, ticketId], (err, results) => {
      if (err) {
        console.log(`❌ Falló con estado '${estadoActual}':`, err.message);
        // Intentar con el siguiente estado
        intentarActualizacion(index + 1);
      } else if (results.affectedRows > 0) {
        console.log(`✅ Salida procesada para vehículo ID: ${ticketId} con estado: ${estadoActual}`);
        console.log(`💰 Monto: Q${montoAPagar}, Efectivo: Q${efectivoRecibido}, Cambio: Q${cambio}`);
        
        res.json({ 
          mensaje: 'Salida procesada correctamente',
          exito: true,
          estadoFinal: estadoActual,
          detalles: {
            ticketId: ticketId,
            monto: montoAPagar,
            efectivo: efectivoRecibido,
            cambio: cambio
          }
        });
      } else {
        res.status(404).json({ 
          mensaje: 'Ticket no encontrado o ya procesado',
          exito: false 
        });
      }
    });
  };
  
  // Iniciar el proceso
  intentarActualizacion();
});


// ================================
// RUTAS PARA USUARIOS
// ================================

// Crear usuario
app.post('/api/usuarios', (req, res) => {
  const { usuario, contrasena, rol } = req.body;

  if (!usuario || !contrasena || !rol) {
    return res.status(400).json({ mensaje: "Faltan datos" });
  }

  // Cifrar contraseña antes de guardar
  const hashedPassword = bcrypt.hashSync(contrasena, 10);

  const query = "INSERT INTO usuarios (usuario, contrasena, rol) VALUES (?, ?, ?)";
  connection.query(query, [usuario, hashedPassword, rol], (err, results) => {
    if (err) {
      console.error("❌ Error al registrar usuario:", err);
      return res.status(500).json({ mensaje: "Error al registrar usuario" });
    }
    res.json({ mensaje: "✅ Usuario registrado correctamente", id: results.insertId });
  });
});

// Obtener usuarios
app.get('/api/usuarios', (req, res) => {
  const query = "SELECT id, usuario, rol FROM usuarios ORDER BY id DESC";
  connection.query(query, (err, results) => {
    if (err) {
      console.error("❌ Error al obtener usuarios:", err);
      return res.status(500).json({ mensaje: "Error al obtener usuarios" });
    }
    res.json(results);
  });
});

// Actualizar usuario
app.put('/api/usuarios/:id', (req, res) => {
  const { id } = req.params;
  const { usuario, contrasena, rol } = req.body;

  if (!usuario || !rol) {
    return res.status(400).json({ mensaje: "Faltan datos obligatorios" });
  }

  // Si se proporciona una nueva contraseña, cifrarla
  let query, params;
  if (contrasena && contrasena.trim() !== "") {
    const hashedPassword = bcrypt.hashSync(contrasena, 10);
    query = "UPDATE usuarios SET usuario = ?, contrasena = ?, rol = ? WHERE id = ?";
    params = [usuario, hashedPassword, rol, id];
  } else {
    // Si no se proporciona contraseña, solo actualizar usuario y rol
    query = "UPDATE usuarios SET usuario = ?, rol = ? WHERE id = ?";
    params = [usuario, rol, id];
  }

  connection.query(query, params, (err, results) => {
    if (err) {
      console.error("❌ Error al actualizar usuario:", err);
      return res.status(500).json({ mensaje: "Error al actualizar usuario" });
    }
    if (results.affectedRows === 0) {
      return res.status(404).json({ mensaje: "Usuario no encontrado" });
    }
    res.json({ mensaje: "✅ Usuario actualizado correctamente" });
  });
});

// Eliminar usuario
app.delete('/api/usuarios/:id', (req, res) => {
  const { id } = req.params;

  const query = "DELETE FROM usuarios WHERE id = ?";
  connection.query(query, [id], (err, results) => {
    if (err) {
      console.error("❌ Error al eliminar usuario:", err);
      return res.status(500).json({ mensaje: "Error al eliminar usuario" });
    }
    if (results.affectedRows === 0) {
      return res.status(404).json({ mensaje: "Usuario no encontrado" });
    }
    res.json({ mensaje: "✅ Usuario eliminado correctamente" });
  });
});

// 🆕 NUEVA RUTA: Obtener registros para reportes
app.get('/api/registros', (req, res) => {
  // Primero verificar qué columnas existen realmente
  const describeQuery = "DESCRIBE vehiculos";
  
  connection.query(describeQuery, (err, structure) => {
    if (err) {
      console.error('❌ Error al obtener estructura de tabla:', err);
      return res.status(500).json({ 
        error: 'Error al verificar estructura de tabla',
        details: err.message 
      });
    }
    
    console.log('📋 Estructura de tabla vehiculos:', structure);
    
    // Consulta básica con columnas que sabemos que existen
    const query = `
      SELECT * 
      FROM vehiculos 
      ORDER BY id DESC
      LIMIT 50
    `;
    
    connection.query(query, (err, results) => {
      if (err) {
        console.error('❌ Error al obtener registros para reportes:', err);
        return res.status(500).json({ 
          error: 'Error al obtener registros',
          details: err.message 
        });
      }
      
      console.log(`✅ Registros obtenidos para reportes: ${results.length}`);
      console.log('📝 Ejemplo de registro:', results[0] || 'No hay registros');
      
      res.json({
        total: results.length,
        estructura: structure,
        registros: results
      });
    });
  });
});