import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Baloo 2, self-hosted (no font request leaves the device). Only the weights the canvas uses.
import '@fontsource/baloo-2/latin-600.css';
import '@fontsource/baloo-2/latin-700.css';
import '@fontsource/baloo-2/latin-800.css';
import './styles/global.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
