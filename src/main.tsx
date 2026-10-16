import { createRoot } from 'react-dom/client';
import '@fontsource-variable/archivo/wdth.css';
import '@fontsource/schibsted-grotesk/400.css';
import '@fontsource/schibsted-grotesk/500.css';
import '@fontsource/schibsted-grotesk/600.css';
import './styles.css';
import App from './App';
import { site } from './site.config';

/** the world needs WebGL 2; without it, say so plainly and still give every way to get in touch */
function hasWebGL2() {
  try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; }
}

function NoWebGL() {
  return (
    <main className="nogl">
      <h1>{site.name}</h1>
      <p>{site.role}. {site.summary}</p>
      <p className="nogl-note">This portfolio is a 3D world and needs WebGL 2, which this browser has turned off. Try a current Chrome, Edge, Firefox or Safari.</p>
      <p className="p-links">
        <a href={`mailto:${site.email}`}>{site.email}</a>
        {site.links.map(l => <a key={l.url} href={l.url} target="_blank" rel="noopener">{l.label} ↗</a>)}
      </p>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(hasWebGL2() ? <App /> : <NoWebGL />);
