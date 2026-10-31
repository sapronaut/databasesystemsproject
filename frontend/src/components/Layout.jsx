import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Shield } from './Icons';
import { roleLabel, roleColor } from '../roles';

const menu = [
  { to: '/', label: 'Overview', roles: ['ADMIN', 'ANALYST', 'AUDITOR'], end: true },
  { to: '/me', label: 'My account', roles: ['CUSTOMER'] },
  { to: '/transactions', label: 'Transactions', roles: ['ADMIN', 'ANALYST', 'AUDITOR'] },
  { to: '/customers', label: 'Customers', roles: ['ADMIN', 'ANALYST'] },
  { to: '/alerts', label: 'Alerts', roles: ['ADMIN', 'ANALYST', 'AUDITOR'] },
  { to: '/disputes', label: 'Disputes', roles: ['ADMIN', 'ANALYST'] },
  { to: '/audit', label: 'Audit', roles: ['ADMIN', 'AUDITOR'] },
  { to: '/users', label: 'Users', roles: ['ADMIN'] },
  { to: '/schema', label: 'Schema', roles: ['ADMIN'] }
];

function Layout() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const items = menu.filter((item) => item.roles.includes(user.role));

  const signOut = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <span className="brand-mark"><Shield /></span>
            FraudGuard
          </div>
          <span className="spacer" />
          <div className="user-chip">
            <span className="avatar-sm">{user.email.charAt(0).toUpperCase()}</span>
            <span className="user-name">{user.email}</span>
            <span className={`pill ${roleColor[user.role]}`}>{roleLabel[user.role]}</span>
          </div>
          <button className="btn ghost small" onClick={signOut}>Sign out</button>
        </div>
      </header>
      {items.length > 1 && (
        <div className="nav-row">
          <nav className="tabs">
            {items.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive ? 'active' : '')}>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      )}
      <main className="page">
        <Outlet />
      </main>
    </>
  );
}

export default Layout;