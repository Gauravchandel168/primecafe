import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { addDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { syncOrderToRTDB } from '../firebase';
import { CartProvider, useCart } from '../context/CartContext';
import CartDrawer from '../components/CartDrawer';
import OrderSuccessModal from '../components/OrderSuccessModal';
import { FloatingCartButton } from '../components/NotificationBadge';
import {
  MenuHero,
  MenuTagline,
  MenuFooter,
  MenuCategorySection,
} from '../components/FlutterMenu';
import {
  fetchCategoriesWithAvailableItems,
  ordersRef,
  resolveMenuRestaurantId,
  restaurantRef,
} from '../utils/restaurantPaths';

// If Firestore/RTDB never resolves (e.g. a flaky connection), this makes
// sure the "Placing Order..." button always comes back to life instead of
// staying stuck forever and forcing the customer to hit back.
function withTimeout(promise, ms = 15000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timed out')), ms)
    ),
  ]);
}

function MenuContent() {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const restaurantId = resolveMenuRestaurantId(params, searchParams);
  const tableNumber = searchParams.get('table') || '1';
  const navigate = useNavigate();

  const [categories, setCategories] = useState([]);
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [placedOrder, setPlacedOrder] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 600);

  const { itemCount, subtotal, clearCart, addItem, items } = useCart();

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 600);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!restaurantId) {
        setError('No cafe specified in this link');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const restaurantSnap = await getDoc(restaurantRef(restaurantId));
        if (!restaurantSnap.exists()) {
          if (active) setError('Restaurant not found');
          return;
        }
        if (active) setRestaurant({ id: restaurantSnap.id, ...restaurantSnap.data() });
        const cats = await fetchCategoriesWithAvailableItems(restaurantId);
        if (active) setCategories(cats);
      } catch {
        if (active) setError('Failed to load menu');
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [restaurantId]);

  useEffect(() => {
    if (!placedOrder) return;
    const timer = setTimeout(() => {
      navigate(`/order-status/${restaurantId}/${placedOrder.orderId}`);
    }, 4000);
    return () => clearTimeout(timer);
  }, [placedOrder, restaurantId, navigate]);

  const horizontalPadding = isMobile ? 12 : 80;
  const cardWidth = isMobile ? 160 : 250;
  const cardHeight = isMobile ? 250 : 280;

  const handleAdd = (item) => {
    addItem({
      id: `${item.categoryId}_${item.id}`,
      name: item.name,
      price: Number(item.price),
      image: item.image,
      description: item.description,
    });
    toast.success(`${item.name} added`);
  };

  const handlePlaceOrder = async () => {
    if (items.length === 0) return;
    setPlacing(true);

    try {
      const orderData = {
        items: items.map(({ id, name, price, quantity }) => ({
          id,
          name,
          price,
          quantity,
        })),
        totalAmount: subtotal,
        tableNumber,
        status: 'pending',
        timestamp: serverTimestamp(),
        restaurantId,
      };

      const docRef = await withTimeout(addDoc(ordersRef(restaurantId), orderData));

      await withTimeout(
        syncOrderToRTDB(restaurantId, docRef.id, {
          status: 'pending',
          tableNumber,
          totalAmount: subtotal,
        })
      );

      localStorage.setItem(`primecafe_order_${restaurantId}`, docRef.id);
      clearCart();
      setCartOpen(false);
      setPlacedOrder({ orderId: docRef.id, tableNumber });
    } catch (err) {
      console.error('Failed to place order:', err);
      toast.error('Failed to place order. Please check your connection and try again.');
    } finally {
      setPlacing(false);
    }
  };

  const handleTrackOrder = () => {
    if (!placedOrder) return;
    navigate(`/order-status/${restaurantId}/${placedOrder.orderId}`);
  };

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white p-6 text-center">
        <p className="font-amatic text-2xl">{error}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 rounded-lg bg-[#1C1C1C] px-6 py-3 text-white"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-24">
      <MenuHero isMobile={isMobile} restaurant={restaurant} />
      <MenuTagline isMobile={isMobile} restaurant={restaurant} />

      <div className="mt-8">
        {loading ? (
          <>
            <div className="space-y-2 px-5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="mx-auto h-12 w-40 animate-pulse rounded bg-gray-200" />
              ))}
            </div>
            <MenuFooter restaurant={restaurant} />
          </>
        ) : categories.length === 0 ? (
          <>
            <p className="py-8 text-center font-amatic text-2xl text-black">
              No Categories Found
            </p>
            <MenuFooter restaurant={restaurant} />
          </>
        ) : (
          <>
            <div className="border-t border-gray-300" />
            {categories.map((category, index) => (
              <div key={category.id}>
                <MenuCategorySection
                  category={category}
                  restaurantId={restaurantId}
                  cardWidth={cardWidth}
                  cardHeight={cardHeight}
                  horizontalPadding={horizontalPadding}
                  isMobile={isMobile}
                  onAdd={handleAdd}
                />
                {index < categories.length - 1 && (
                  <div className="border-t border-gray-300" />
                )}
              </div>
            ))}
            <div className="border-t border-gray-300" />
            <MenuFooter restaurant={restaurant} />
          </>
        )}
      </div>

      {itemCount > 0 && (
        <FloatingCartButton itemCount={itemCount} onClick={() => setCartOpen(true)} />
      )}

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        onPlaceOrder={handlePlaceOrder}
        placing={placing}
        currency="€"
      />

      {placedOrder && (
        <OrderSuccessModal
          tableNumber={placedOrder.tableNumber}
          onTrackOrder={handleTrackOrder}
        />
      )}
    </div>
  );
}

export default function MenuPage() {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const restaurantId = resolveMenuRestaurantId(params, searchParams);
  const tableNumber = searchParams.get('table') || '1';

  return (
    <CartProvider cafeId={restaurantId} tableNumber={tableNumber}>
      <MenuContent />
    </CartProvider>
  );
}
