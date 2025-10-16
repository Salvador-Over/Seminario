// ================================
// RUTAS PARA GESTIÓN DE MÓDULOS Y PERMISOS
// ================================

// Agregar estas rutas a server.js

// ================================
// 1. OBTENER TODOS LOS MÓDULOS
// ================================
app.get('/api/modulos', (req, res) => {
  const query = `
    SELECT id_modulo, nombre_modulo, ruta, icono, color, orden, descripcion
    FROM modulos 
    WHERE activo = TRUE 
    ORDER BY orden
  `;
  
  connection.query(query, (err, results) => {
    if (err) {
      console.error("❌ Error al obtener módulos:", err);
      return res.status(500).json({ mensaje: "Error al obtener módulos" });
    }
    res.json(results);
  });
});

// ================================
// 2. OBTENER MÓDULOS DE UN USUARIO ESPECÍFICO
// ================================
app.get('/api/usuarios/:id/modulos', (req, res) => {
  const { id } = req.params;
  
  const query = `
    SELECT 
      m.id_modulo,
      m.nombre_modulo,
      m.ruta,
      m.icono,
      m.color,
      m.orden,
      m.descripcion,
      p.puede_ver,
      p.puede_crear,
      p.puede_editar,
      p.puede_eliminar
    FROM modulos m
    JOIN permisos_usuario p ON m.id_modulo = p.id_modulo
    WHERE p.id_usuario = ? AND p.puede_ver = TRUE AND m.activo = TRUE
    ORDER BY m.orden
  `;
  
  connection.query(query, [id], (err, results) => {
    if (err) {
      console.error("❌ Error al obtener módulos del usuario:", err);
      return res.status(500).json({ mensaje: "Error al obtener módulos" });
    }
    res.json(results);
  });
});

// ================================
// 3. OBTENER PERMISOS DE UN USUARIO
// ================================
app.get('/api/usuarios/:id/permisos', (req, res) => {
  const { id } = req.params;
  
  const query = `
    SELECT 
      m.id_modulo,
      m.nombre_modulo,
      COALESCE(p.puede_ver, FALSE) as puede_ver,
      COALESCE(p.puede_crear, FALSE) as puede_crear,
      COALESCE(p.puede_editar, FALSE) as puede_editar,
      COALESCE(p.puede_eliminar, FALSE) as puede_eliminar
    FROM modulos m
    LEFT JOIN permisos_usuario p ON m.id_modulo = p.id_modulo AND p.id_usuario = ?
    WHERE m.activo = TRUE
    ORDER BY m.orden
  `;
  
  connection.query(query, [id], (err, results) => {
    if (err) {
      console.error("❌ Error al obtener permisos:", err);
      return res.status(500).json({ mensaje: "Error al obtener permisos" });
    }
    res.json(results);
  });
});

// ================================
// 4. ASIGNAR/ACTUALIZAR PERMISOS DE UN USUARIO
// ================================
app.post('/api/usuarios/:id/permisos', (req, res) => {
  const { id } = req.params;
  const { permisos } = req.body; // Array de { id_modulo, puede_ver, puede_crear, puede_editar, puede_eliminar }
  
  if (!permisos || !Array.isArray(permisos)) {
    return res.status(400).json({ mensaje: "Formato de permisos inválido" });
  }
  
  // Primero eliminar todos los permisos existentes del usuario
  const deleteQuery = "DELETE FROM permisos_usuario WHERE id_usuario = ?";
  
  connection.query(deleteQuery, [id], (err) => {
    if (err) {
      console.error("❌ Error al eliminar permisos:", err);
      return res.status(500).json({ mensaje: "Error al actualizar permisos" });
    }
    
    // Si no hay permisos para asignar, terminar aquí
    if (permisos.length === 0) {
      return res.json({ mensaje: "✅ Permisos actualizados correctamente" });
    }
    
    // Insertar nuevos permisos
    const insertQuery = `
      INSERT INTO permisos_usuario (id_usuario, id_modulo, puede_ver, puede_crear, puede_editar, puede_eliminar)
      VALUES ?
    `;
    
    const values = permisos.map(p => [
      id,
      p.id_modulo,
      p.puede_ver || false,
      p.puede_crear || false,
      p.puede_editar || false,
      p.puede_eliminar || false
    ]);
    
    connection.query(insertQuery, [values], (err) => {
      if (err) {
        console.error("❌ Error al insertar permisos:", err);
        return res.status(500).json({ mensaje: "Error al asignar permisos" });
      }
      res.json({ mensaje: "✅ Permisos actualizados correctamente" });
    });
  });
});

// ================================
// 5. ACTUALIZAR LOGIN PARA DEVOLVER MÓDULOS
// ================================
// Reemplazar la ruta de login existente con esta versión mejorada

app.post('/api/login', (req, res) => {
  const { usuario, contrasena } = req.body;

  if (!usuario || !contrasena) {
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

    if (results.length > 0) {
      const user = results[0];
      
      const passwordMatch = bcrypt.compareSync(contrasena, user.contrasena);
      
      if (!passwordMatch) {
        return res.status(401).json({ mensaje: "Credenciales incorrectas", exito: false });
      }

      const token = jwt.sign(
        { id: user.id, usuario: user.usuario, rol: user.rol },
        SECRET_KEY,
        { expiresIn: "1h" }
      );

      // Si es admin, obtener todos los módulos
      if (user.rol === 'admin') {
        const modulosQuery = `
          SELECT id_modulo, nombre_modulo, ruta, icono, color, orden, descripcion
          FROM modulos 
          WHERE activo = TRUE 
          ORDER BY orden
        `;
        
        connection.query(modulosQuery, (err, modulos) => {
          if (err) {
            console.error("❌ Error al obtener módulos:", err);
            return res.status(500).json({ mensaje: 'Error al obtener módulos' });
          }
          
          res.json({ 
            mensaje: "Inicio de sesión exitoso",
            exito: true,
            usuario: {
              id: user.id,
              usuario: user.usuario,
              rol: user.rol,
              modulos: modulos,
              es_admin: true
            },
            token
          });
        });
      } else {
        // Si es usuario normal, obtener solo sus módulos permitidos
        const modulosQuery = `
          SELECT 
            m.id_modulo,
            m.nombre_modulo,
            m.ruta,
            m.icono,
            m.color,
            m.orden,
            m.descripcion,
            p.puede_ver,
            p.puede_crear,
            p.puede_editar,
            p.puede_eliminar
          FROM modulos m
          JOIN permisos_usuario p ON m.id_modulo = p.id_modulo
          WHERE p.id_usuario = ? AND p.puede_ver = TRUE AND m.activo = TRUE
          ORDER BY m.orden
        `;
        
        connection.query(modulosQuery, [user.id], (err, modulos) => {
          if (err) {
            console.error("❌ Error al obtener módulos:", err);
            return res.status(500).json({ mensaje: 'Error al obtener módulos' });
          }
          
          res.json({ 
            mensaje: "Inicio de sesión exitoso",
            exito: true,
            usuario: {
              id: user.id,
              usuario: user.usuario,
              rol: user.rol,
              modulos: modulos,
              es_admin: false
            },
            token
          });
        });
      }
    } else {
      res.status(401).json({ mensaje: "Credenciales incorrectas", exito: false });
    }
  });
});

// ================================
// 6. CREAR MÓDULO (Solo admin)
// ================================
app.post('/api/modulos', (req, res) => {
  const { nombre_modulo, ruta, icono, color, orden, descripcion } = req.body;
  
  if (!nombre_modulo) {
    return res.status(400).json({ mensaje: "El nombre del módulo es requerido" });
  }
  
  const query = `
    INSERT INTO modulos (nombre_modulo, ruta, icono, color, orden, descripcion)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  
  connection.query(query, [nombre_modulo, ruta, icono, color, orden || 0, descripcion], (err, results) => {
    if (err) {
      console.error("❌ Error al crear módulo:", err);
      return res.status(500).json({ mensaje: "Error al crear módulo" });
    }
    res.json({ mensaje: "✅ Módulo creado correctamente", id_modulo: results.insertId });
  });
});

// ================================
// 7. ACTUALIZAR MÓDULO
// ================================
app.put('/api/modulos/:id', (req, res) => {
  const { id } = req.params;
  const { nombre_modulo, ruta, icono, color, orden, descripcion, activo } = req.body;
  
  const query = `
    UPDATE modulos 
    SET nombre_modulo = ?, ruta = ?, icono = ?, color = ?, orden = ?, descripcion = ?, activo = ?
    WHERE id_modulo = ?
  `;
  
  connection.query(query, [nombre_modulo, ruta, icono, color, orden, descripcion, activo, id], (err) => {
    if (err) {
      console.error("❌ Error al actualizar módulo:", err);
      return res.status(500).json({ mensaje: "Error al actualizar módulo" });
    }
    res.json({ mensaje: "✅ Módulo actualizado correctamente" });
  });
});

// ================================
// 8. ELIMINAR MÓDULO (Desactivar)
// ================================
app.delete('/api/modulos/:id', (req, res) => {
  const { id } = req.params;
  
  const query = "UPDATE modulos SET activo = FALSE WHERE id_modulo = ?";
  
  connection.query(query, [id], (err) => {
    if (err) {
      console.error("❌ Error al eliminar módulo:", err);
      return res.status(500).json({ mensaje: "Error al eliminar módulo" });
    }
    res.json({ mensaje: "✅ Módulo desactivado correctamente" });
  });
});
