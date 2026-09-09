import { HashRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { ToastProvider } from '@/hooks/useToast';
import { ConfirmProvider } from '@/hooks/useConfirm';
import { NewOrdersProvider } from '@/hooks/useNewOrders';
import { ToastViewport } from '@/components/ToastViewport';
import { Shell } from '@/components/Shell';
import { Login } from '@/screens/Login';
import { Dashboard } from '@/screens/Dashboard';
import { Orders } from '@/screens/Orders';
import { OrdersToday } from '@/screens/OrdersToday';
import { OrderDetail } from '@/screens/OrderDetail';
import { OrderPrint } from '@/screens/OrderPrint';
import { Products } from '@/screens/Products';
import { ProductForm } from '@/screens/ProductForm';
import { Categories } from '@/screens/Categories';
import { Recipes } from '@/screens/Recipes';
import { RecipeForm } from '@/screens/RecipeForm';
import { Offers } from '@/screens/Offers';
import { OfferForm } from '@/screens/OfferForm';
import { Delivery } from '@/screens/Delivery';
import { Customers } from '@/screens/Customers';
import { Messages } from '@/screens/Messages';
import { SettingsScreen } from '@/screens/Settings';
import { Export } from '@/screens/Export';
import { More } from '@/screens/More';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: true },
  },
});

function Splash() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-cream">
      <div className="skeleton h-12 w-48" aria-label="Chargement" />
    </div>
  );
}

/** Garde d'authentification : connexion ou espace complet, jamais les deux. */
function Gate() {
  const { status } = useAuth();
  const navigate = useNavigate();
  if (status === 'loading') return <Splash />;
  if (status === 'out') return <Login />;
  return (
    <NewOrdersProvider navigate={(to) => navigate(to)}>
      <Routes>
        <Route path="/commandes/:id/imprimer" element={<OrderPrint />} />
        <Route element={<Shell />}>
          <Route index element={<Dashboard />} />
          <Route path="/commandes" element={<Orders />} />
          <Route path="/commandes/aujourdhui" element={<OrdersToday />} />
          <Route path="/commandes/:id" element={<OrderDetail />} />
          <Route path="/produits" element={<Products />} />
          <Route path="/produits/nouveau" element={<ProductForm />} />
          <Route path="/produits/:id" element={<ProductForm />} />
          <Route path="/offres" element={<Offers />} />
          <Route path="/offres/nouvelle" element={<OfferForm />} />
          <Route path="/offres/:id" element={<OfferForm />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/recettes" element={<Recipes />} />
          <Route path="/recettes/nouvelle" element={<RecipeForm />} />
          <Route path="/recettes/:id" element={<RecipeForm />} />
          <Route path="/livraison" element={<Delivery />} />
          <Route path="/clients" element={<Customers />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/reglages" element={<SettingsScreen />} />
          <Route path="/export" element={<Export />} />
          <Route path="/plus" element={<More />} />
          <Route path="/connexion" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </NewOrdersProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <ToastProvider>
          <ConfirmProvider>
            <AuthProvider>
              <Gate />
              <ToastViewport />
            </AuthProvider>
          </ConfirmProvider>
        </ToastProvider>
      </HashRouter>
    </QueryClientProvider>
  );
}
