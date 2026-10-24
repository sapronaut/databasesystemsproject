import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Shield } from './Icons';

const menu = [
  { to: '/', label: 'Overview', roles: ['ADMIN', 'ANALYST'], end: true },
  { to: '/transactions', label: 'Transactions', roles: ['ADMIN', 'ANALYST'] },
  { to: '/alerts', label: 'Alerts', roles: ['ADMIN', 'ANALYST'] },
  { to: '/audit', label: 'Audit', roles: ['ADMIN'] }
];

function Layout() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || 'null');

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
          <nav className="tabs">
            {menu
              .filter((item) => item.roles.includes(user.role))
              .map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive ? 'active' : '')}>
                  {item.label}
                </NavLink>
              ))}
          </nav>
          <span className="spacer" />
          <div className="user-chip">
            <span className="avatar-sm">{user.email.charAt(0).toUpperCase()}</span>
            <span className="user-name">{user.email}</span>
            <span className={`pill ${user.role === 'ADMIN' ? 'blue' : 'grey'}`}>{user.role === 'ADMIN' ? 'Admin' : 'Analyst'}</span>
          </div>
          <button className="btn ghost small" onClick={signOut}>Sign out</button>
        </div>
      </header>
      <main className="page">
        <Outlet />
      </main>
    </>
  );
}

export default Layout;
