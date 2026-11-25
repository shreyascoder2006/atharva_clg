import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { setConsoleFunction } from 'three';

import App from './App';
import './index.css';

/*
  @react-three/fiber 9 constructs a THREE.Clock inside its store, and three r183+
  deprecates Clock with a console warning. Nothing in this app can act on it until R3F
  moves to THREE.Timer, so exactly that message is dropped. Every other three.js
  message still reaches the console unchanged.
*/
setConsoleFunction((type: string, message: string, ...params: unknown[]) => {
  if (type === 'warn' && message.startsWith('THREE.Clock: This module has been deprecated')) return;
  const fn = (console as unknown as Record<string, (...a: unknown[]) => void>)[type] ?? console.log;
  fn(message, ...params);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
