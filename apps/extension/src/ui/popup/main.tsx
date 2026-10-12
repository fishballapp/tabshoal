import '../styles/global.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Popup } from './Popup';

const root = document.getElementById('root');
if (root === null) throw new Error('No #root in popup.html');
createRoot(root).render(
  <StrictMode>
    <Popup />
  </StrictMode>,
);
