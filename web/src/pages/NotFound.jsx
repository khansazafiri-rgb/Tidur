import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { EmptyState } from '../components/ui.jsx';
import { useMascot } from '../mascot/Mascot.jsx';

export default function NotFound() {
  const { user } = useAuth();
  const { emit } = useMascot();
  useEffect(() => { emit('page_not_found'); }, [emit]);
  return (
    <div className="wrap py-10">
      <EmptyState pose="notFound" title="Halaman ini tidak ditemukan"
        action={<Link to={user ? '/beranda' : '/'} className="btn-primary">{user ? 'Kembali ke beranda' : 'Ke halaman depan'}</Link>}>
        Si kucing dokter juga bingung. Mungkin tautannya salah ketik atau halamannya sudah dipindah.
      </EmptyState>
    </div>
  );
}
