import { createRoot } from 'react-dom/client';
import Dashboard from '../../app/page';
import '../../app/globals.css';
import '../../app/service-performance.css';
import './sales.css';
createRoot(document.getElementById('root')!).render(<><div role="note" className="sales-notice">Sales demo · Login & alur kerja simulasi · Supabase read-only · Maks. 100 artikel terbaru · Analisis/URL yang tidak tersedia tidak diisi otomatis</div><Dashboard /></>);
