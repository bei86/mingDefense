import React from 'react';
import { createRoot } from 'react-dom/client';
import { Startup } from './ui/Startup';
import './ui/style.css';
import './ui/art.css';
import './ui/combat.css';
import './ui/handbook.css';
import './ui/stage-intel.css';
import './ui/preparation-range.css';
import './ui/formation-swap.css';
import './ui/targeting-preview.css';
import './ui/feedback.css';
import './ui/mobile.css';
import './ui/save-manager.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Startup />
  </React.StrictMode>,
);
