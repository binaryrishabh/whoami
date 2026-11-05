import { createRoot } from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import '@fontsource-variable/inter-tight/wght.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import './landing.css';
import { Landing } from './Landing';

createRoot(document.getElementById('root')!).render(<><Landing /><Analytics /></>);
