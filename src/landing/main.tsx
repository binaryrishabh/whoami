import { createRoot } from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import '@fontsource-variable/newsreader/opsz.css';
import '@fontsource-variable/newsreader/opsz-italic.css';
import '@fontsource/schibsted-grotesk/400.css';
import '@fontsource/schibsted-grotesk/500.css';
import '@fontsource/schibsted-grotesk/600.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import './landing.css';
import { Landing } from './Landing';

if (import.meta.env.DEV) { const pal = new URLSearchParams(location.search).get('pal'); if (pal) document.documentElement.dataset.pal = pal; }

createRoot(document.getElementById('root')!).render(<><Landing /><Analytics /></>);
