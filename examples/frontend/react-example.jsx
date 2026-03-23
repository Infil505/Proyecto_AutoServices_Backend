// Ejemplo de componente React que consume la API
import React, { useState, useEffect } from 'react';
import { useAuth, useData, useAutoServicesAPI } from './react-hooks.js';

function LoginForm() {
  const [credentials, setCredentials] = useState({ email: '', password: '' });
  const { login, loading, error } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(credentials);
      alert('Login exitoso!');
    } catch (err) {
      alert('Error en login: ' + err.message);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        placeholder="Email"
        value={credentials.email}
        onChange={(e) => setCredentials({...credentials, email: e.target.value})}
        required
      />
      <input
        type="password"
        placeholder="Contraseña"
        value={credentials.password}
        onChange={(e) => setCredentials({...credentials, password: e.target.value})}
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Cargando...' : 'Iniciar Sesión'}
      </button>
      {error && <p style={{color: 'red'}}>{error}</p>}
    </form>
  );
}

function UserDashboard() {
  const { user, isAuthenticated, logout } = useAuth();
  const api = useAutoServicesAPI();

  // Usar el hook useData para obtener usuarios con paginación
  const { data: usersData, loading: usersLoading, error: usersError, refetch: refetchUsers } =
    useData(api.getUsers, { page: 1, limit: 10 }, [isAuthenticated]);

  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'technician'
  });

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      await api.createUser(newUser);
      setNewUser({ name: '', email: '', phone: '', role: 'technician' });
      refetchUsers(); // Recargar la lista
      alert('Usuario creado exitosamente!');
    } catch (err) {
      alert('Error creando usuario: ' + err.message);
    }
  };

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  return (
    <div>
      <header>
        <h1>Dashboard - {user?.name}</h1>
        <button onClick={logout}>Cerrar Sesión</button>
      </header>

      <section>
        <h2>Crear Nuevo Usuario</h2>
        <form onSubmit={handleCreateUser}>
          <input
            type="text"
            placeholder="Nombre"
            value={newUser.name}
            onChange={(e) => setNewUser({...newUser, name: e.target.value})}
            required
          />
          <input
            type="email"
            placeholder="Email"
            value={newUser.email}
            onChange={(e) => setNewUser({...newUser, email: e.target.value})}
            required
          />
          <input
            type="tel"
            placeholder="Teléfono"
            value={newUser.phone}
            onChange={(e) => setNewUser({...newUser, phone: e.target.value})}
            required
          />
          <select
            value={newUser.role}
            onChange={(e) => setNewUser({...newUser, role: e.target.value})}
          >
            <option value="technician">Técnico</option>
            <option value="company">Compañía</option>
            <option value="super_admin">Super Admin</option>
          </select>
          <button type="submit" disabled={api.loading}>
            {api.loading ? 'Creando...' : 'Crear Usuario'}
          </button>
        </form>
      </section>

      <section>
        <h2>Lista de Usuarios</h2>
        {usersLoading && <p>Cargando usuarios...</p>}
        {usersError && <p style={{color: 'red'}}>Error: {usersError}</p>}
        {usersData && (
          <div>
            <p>Total: {usersData.total} usuarios</p>
            <ul>
              {usersData.data.map(user => (
                <li key={user.id}>
                  {user.name} - {user.email} - {user.role}
                </li>
              ))}
            </ul>
            <div>
              <button
                disabled={!usersData.hasPrevPage}
                onClick={() => refetchUsers({ page: usersData.page - 1 })}
              >
                Anterior
              </button>
              <span>Página {usersData.page} de {usersData.totalPages}</span>
              <button
                disabled={!usersData.hasNextPage}
                onClick={() => refetchUsers({ page: usersData.page + 1 })}
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function CompaniesList() {
  const api = useAutoServicesAPI();
  const { data: companies, loading, error, refetch } = useData(
    api.getCompanies,
    { page: 1, limit: 5 },
    []
  );

  const [newCompany, setNewCompany] = useState({
    name: '',
    phone: '',
    email: '',
    address: ''
  });

  const handleCreateCompany = async (e) => {
    e.preventDefault();
    try {
      await api.createCompany(newCompany);
      setNewCompany({ name: '', phone: '', email: '', address: '' });
      refetch();
      alert('Compañía creada exitosamente!');
    } catch (err) {
      alert('Error creando compañía: ' + err.message);
    }
  };

  return (
    <div>
      <h2>Compañías</h2>

      <form onSubmit={handleCreateCompany}>
        <input
          type="text"
          placeholder="Nombre de la compañía"
          value={newCompany.name}
          onChange={(e) => setNewCompany({...newCompany, name: e.target.value})}
          required
        />
        <input
          type="tel"
          placeholder="Teléfono"
          value={newCompany.phone}
          onChange={(e) => setNewCompany({...newCompany, phone: e.target.value})}
          required
        />
        <input
          type="email"
          placeholder="Email"
          value={newCompany.email}
          onChange={(e) => setNewCompany({...newCompany, email: e.target.value})}
          required
        />
        <input
          type="text"
          placeholder="Dirección"
          value={newCompany.address}
          onChange={(e) => setNewCompany({...newCompany, address: e.target.value})}
          required
        />
        <button type="submit" disabled={api.loading}>
          {api.loading ? 'Creando...' : 'Crear Compañía'}
        </button>
      </form>

      {loading && <p>Cargando compañías...</p>}
      {error && <p style={{color: 'red'}}>Error: {error}</p>}
      {companies && (
        <ul>
          {companies.data.map(company => (
            <li key={company.phone}>
              <strong>{company.name}</strong> - {company.email} - {company.phone}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Componente principal de la aplicación
function App() {
  return (
    <div className="App">
      <UserDashboard />
      <hr />
      <CompaniesList />
    </div>
  );
}

export default App;