import { Navigate } from 'react-router-dom';
import { homeFor } from '../roles';

function ProtectedRoute({ children, roles }) {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || 'null');

  if (!token || !user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homeFor(user)} replace />;

  return children;
}

export default ProtectedRoute;
