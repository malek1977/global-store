/* =====================================================================
 *  GLOBAL STORE — App shell, routing, guards
 * ===================================================================== */
import { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { I18nProvider, useI18n } from './i18n';
import { ThemeProvider, DbProvider, AuthProvider, useAuth, useReady, useCart, CartProvider } from './app/state';
import { Loading, Logo, ToastProvider } from './ui/primitives';
import { RequireAuth } from './app/RequireAuth';

/* ---------------------------------------------------------------- store */
const Home = lazy(() => import('./pages/Home'));
const Catalog = lazy(() => import('./pages/store/Catalog'));
const ProductPage = lazy(() => import('./pages/store/ProductPage'));
const CartPage = lazy(() => import('./pages/store/CartPage'));
const Checkout = lazy(() => import('./pages/store/Checkout'));
const OrderConfirm = lazy(() => import('./pages/store/OrderConfirm'));
const TrackOrder = lazy(() => import('./pages/store/TrackOrder'));
const RepairBooking = lazy(() => import('./pages/store/RepairBooking'));
const Login = lazy(() => import('./pages/Login'));

const Dash = lazy(() => import('./pages/admin/Dashboard'));
const Inventory = lazy(() => import('./pages/admin/Inventory'));
const Partners = lazy(() => import('./pages/admin/Partners'));
const Purchases = lazy(() => import('./pages/admin/Purchases'));
const Repairs = lazy(() => import('./pages/admin/Repairs'));
const Employees = lazy(() => import('./pages/admin/Employees'));
const Settings = lazy(() => import('./pages/admin/Settings'));

const AccDash = lazy(() => import('./pages/accounting/AccountingDashboard'));
const Ledger = lazy(() => import('./pages/accounting/Ledger'));
const Statements = lazy(() => import('./pages/accounting/Statements'));
const Invoices = lazy(() => import('./pages/accounting/Invoices'));
const PaymentsPage = lazy(() => import('./pages/accounting/Payments'));
const VatPage = lazy(() => import('./pages/accounting/VatPage'));

const Assistant = lazy(() => import('./pages/ai/Assistant'));

const StoreLayout = lazy(() => import('./layouts/StoreLayout'));
const AppLayout = lazy(() => import('./layouts/AppLayout'));

/* --------------------------------------------------------------- boot */
function Boot() {
  const { ready } = useReady();
  if (!ready) {
    return (
      <div className="hero-mesh grid min-h-screen place-items-center">
        <div className="flex flex-col items-center gap-5 animate-fade-in">
          <Logo size={64} />
          <div className="h-1 w-40 overflow-hidden rounded-full bg-ink-200 dark:bg-white/10">
            <div className="h-full w-1/3 animate-[shimmer_1.2s_infinite] rounded-full bg-brand-500" />
          </div>
          <p className="text-sm font-medium text-ink-500">جارٍ تجهيز قاعدة بيانات جلوبال ستور…</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* ------------------------------------------------ public site */}
        <Route element={<StoreLayout />}>
          <Route index element={<Home />} />
          <Route path="products" element={<Catalog />} />
          <Route path="product/:id" element={<ProductPage />} />
          <Route path="cart" element={<CartPage />} />
          <Route path="checkout" element={<Checkout />} />
          <Route path="order/:no" element={<OrderConfirm />} />
          <Route path="track" element={<TrackOrder />} />
          <Route path="repair" element={<RepairBooking />} />
          <Route path="login" element={<Login />} />
        </Route>

        {/* ------------------------------------------------- back office */}
        <Route path="app" element={<AppLayout />}>
          <Route index element={<Navigate to="/app/dashboard" replace />} />
          <Route path="dashboard" element={<Dash />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="partners" element={<Partners />} />
          <Route path="purchases" element={<Purchases />} />
          <Route path="repairs" element={<Repairs />} />
          <Route path="employees" element={<Employees />} />
          <Route path="settings" element={<Settings />} />

          <Route path="accounting" element={<AccDash />} />
          <Route path="accounting/ledger" element={<Ledger />} />
          <Route path="accounting/statements" element={<Statements />} />
          <Route path="accounting/invoices" element={<Invoices />} />
          <Route path="accounting/payments" element={<PaymentsPage />} />
          <Route path="accounting/vat" element={<VatPage />} />

          <Route path="ai" element={<Assistant />} />
          <Route path="*" element={<Navigate to="/app/dashboard" replace />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

/* --------------------------------------------------------------- app */
export default function App() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <DbProvider>
          <AuthProvider>
            <ToastProvider>
              <CartProvider>
                <Suspense fallback={<Loading />}>
                  <Boot />
                </Suspense>
              </CartProvider>
            </ToastProvider>
          </AuthProvider>
        </DbProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}

export { useAuth, useCart };
export { RequireAuth };
