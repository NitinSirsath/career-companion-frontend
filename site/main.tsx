import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './site.css';
import { ThemeProvider } from '../src/components/ThemeProvider';
import { ProductPage } from '../src/components/product/ProductPage';

/**
 * The product site on northlist.site (owner, 31 Oct 2026): only the product page, with no router,
 * no server calls and no service worker. The app is its own site on app.northlist.site.
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider storageKey="career-companion-theme">
      <ProductPage />
    </ThemeProvider>
  </StrictMode>,
);
