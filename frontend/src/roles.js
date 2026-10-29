export const STAFF = ['ADMIN', 'ANALYST', 'AUDITOR'];
export const homeFor = (user) => (user && user.role === 'CUSTOMER' ? '/me' : '/');
export const roleLabel = { ADMIN: 'Admin', ANALYST: 'Analyst', AUDITOR: 'Auditor', CUSTOMER: 'Customer' };
export const roleColor = { ADMIN: 'blue', ANALYST: 'grey', AUDITOR: 'orange', CUSTOMER: 'green' };
export const errorText = (err, fallback) => (err.response && err.response.data && err.response.data.error) || fallback;
