import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';

const app = mount(App, { target: document.getElementById('app')! });

if ('serviceWorker' in navigator && import.meta.env.PROD && location.protocol !== 'file:') {
  // reload once when a new worker takes over, so fixes always show up
  let reloaded = false;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController && !reloaded) { reloaded = true; location.reload(); }
  });
  navigator.serviceWorker.register('./sw.js').then((r) => r.update()).catch(() => {});
}

export default app;
