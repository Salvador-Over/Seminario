import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Login.css';
import 'boxicons/css/boxicons.min.css';

function Login() {
  const [usuario, setUsuario] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [recordarme, setRecordarme] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validación rápida antes de enviar
    if (!usuario || !contrasena) {
      alert("Por favor completa todos los campos");
      return;
    }

    try {
      //const res = await fetch('http://seminario-backend-1.onrender.com/api/login'
      // TEMPORAL: Usar servidor local para debugging
      const res = await fetch('http://localhost:3001/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario, contrasena, recordarme })
      });

      const data = await res.json();
      alert(data.mensaje);

      if (data.exito) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("rol", data.usuario.rol);
        localStorage.setItem("usuario", data.usuario.usuario);
        localStorage.setItem("id_usuario", data.usuario.id);
        localStorage.setItem("modulos", JSON.stringify(data.usuario.modulos || []));
        navigate("/menu");
      }
    } catch (err) {
      console.error("Error al enviar datos:", err);
      alert("Error al conectar con el servidor");
    }
  };

  return (
    <div className="container">
      <form onSubmit={handleSubmit}>
        <h1>Login</h1>

        <div className="input-box">
          <input
            type="text"
            placeholder="Nombre de usuario"
            required
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
          />
          <i className="bx bxs-user"></i>
        </div>

        <div className="input-box">
          <input
            type="password"
            placeholder="Contraseña"
            required
            value={contrasena}
            onChange={(e) => setContrasena(e.target.value)}
          />
          <i className="bx bxs-lock-alt"></i>
        </div>

        {/* Campo de selección de rol eliminado */}

        <div className="remember-forgot">
          <label>
            <input
              type="checkbox"
              checked={recordarme}
              onChange={() => setRecordarme(!recordarme)}
            />
            Recuérdame
          </label>
          <a href="#">¿Olvidaste tu contraseña?</a>
        </div>

        <button type="submit" className="btn">Iniciar sesión</button>

        <div className="register-link">
          <p>
            
          </p>
        </div>
      </form>
    </div>
  );
}

export default Login;
