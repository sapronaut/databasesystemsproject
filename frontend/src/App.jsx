import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import { STAFF } from './roles';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Customers from './pages/Customers';
import Alerts from './pages/Alerts';
import Disputes from './pages/Disputes';
import Audit from './pages/Audit';
import Users from './pages/Users';
import Schema from './pages/Schema';
import Me from './pages/Me';

const guard = (roles, page) => <ProtectedRoute roles={roles}>{page}</ProtectedRoute>;

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/" element={guard(STAFF, <Dashboard />)} />
        <Route path="/transactions" element={guard(STAFF, <Transactions />)} />
        <Route path="/customers" element={guard(['ADMIN', 'ANALYST'], <Customers />)} />
        <Route path="/alerts" element={guard(STAFF, <Alerts />)} />
        <Route path="/disputes" element={guard(['ADMIN', 'ANALYST'], <Disputes />)} />
        <Route path="/audit" element={guard(['ADMIN', 'AUDITOR'], <Audit />)} />
        <Route path="/users" element={guard(['ADMIN'], <Users />)} />
        <Route path="/schema" element={guard(['ADMIN'], <Schema />)} />
        <Route path="/me" element={guard(['CUSTOMER'], <Me />)} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
