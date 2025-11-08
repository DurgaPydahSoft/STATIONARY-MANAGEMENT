import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter as Router } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import App from './App.jsx';
import './index.css';

const updateSW = registerSW({
  onNeedRefresh() {
    console.info('A new version of the app is available. It will be used after all tabs are closed.');
  },
  onOfflineReady() {
    console.info('App is ready to work offline.');
  },
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => updateSW && updateSW(true));
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Router>
      <App />
    </Router>
  </StrictMode>,
);
