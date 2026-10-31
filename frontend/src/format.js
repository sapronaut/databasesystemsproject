export const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
export const initial = (s) => (s || '?').trim().charAt(0).toUpperCase();
const tints = ['var(--blue)', 'var(--orange)', 'var(--green)', 'var(--purple)', 'var(--teal)'];
export const tint = (i) => tints[i % tints.length];
export const when = (d) => new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
