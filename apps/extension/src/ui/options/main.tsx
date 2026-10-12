import '../styles/global.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Options } from './Options';

const root = document.getElementById('root');
if (root === null) throw new Error('No #root in options.html');
createRoot(root).render(
  <StrictMode>
    <Options />
  </StrictMode>,
);
