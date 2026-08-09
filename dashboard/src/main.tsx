import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

import { DashboardShell } from './components/DashboardShell';
import { AuthCallback } from './pages/AuthCallback';
import { DashboardHome } from './pages/DashboardHome';
import { DocsLayout } from './pages/docs/DocsLayout';
import { Quickstart } from './pages/docs/Quickstart';
import { ApiReference } from './pages/docs/ApiReference';
import { Troubleshooting } from './pages/docs/Troubleshooting';
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { OnboardingFlow } from './pages/OnboardingFlow';
import { Settings } from './pages/Settings';

import './styles/fonts.css';
import './styles/globals.css';

/*
 * Route map — frontend.md §1. Nothing beyond this list.
 */
const router = createBrowserRouter([
  { path: '/', element: <Landing /> },
  { path: '/login', element: <Login /> },
  { path: '/auth/callback', element: <AuthCallback /> },
  {
    path: '/dashboard',
    element: <DashboardShell />,
    children: [
      { index: true, element: <DashboardHome /> },
      { path: 'onboarding', element: <OnboardingFlow /> },
      { path: 'settings', element: <Settings /> },
    ],
  },
  {
    path: '/docs',
    element: <DocsLayout />,
    children: [
      { index: true, element: <Quickstart /> },
      { path: 'quickstart', element: <Quickstart /> },
      { path: 'api-reference', element: <ApiReference /> },
      { path: 'troubleshooting', element: <Troubleshooting /> },
    ],
  },
]);

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element #root not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
