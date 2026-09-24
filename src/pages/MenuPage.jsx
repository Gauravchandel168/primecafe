import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { addDoc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
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
  orderRef,
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
  const [existingOrderId, setExistingOrderId] = useState(
    () => localStorage.getItem(`primecafe_order_${restaurantId}`) || null
  );

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

    const newItems = items.map(({ id, name, price, quantity }) => ({
      id,
      name,
      price,
      quantity,
    }));

    try {
      const existingOrderId = localStorage.getItem(`primecafe_order_${restaurantId}`);
      let orderId = null;
      let isAddOn = false;

      if (existingOrderId) {
        try {
          const existingSnap = await withTimeout(
            getDoc(orderRef(restaurantId, existingOrderId))
          );
          const existing = existingSnap.exists() ? existingSnap.data() : null;

          // Only merge into an order the kitchen hasn't started on yet.
          // Once it's preparing/ready/delivered, a fresh order is safer
          // than quietly changing what's already being made.
          if (existing && ['pending', 'confirmed'].includes(existing.status)) {
            const mergedItems = [...(existing.items || [])];
            for (const item of newItems) {
              const match = mergedItems.find((i) => i.id === item.id);
              if (match) {
                match.quantity += item.quantity;
              } else {
                mergedItems.push(item);
              }
            }
            const mergedTotal = mergedItems.reduce(
              (sum, i) => sum + i.price * i.quantity,
              0
            );

            await withTimeout(
              updateDoc(orderRef(restaurantId, existingOrderId), {
                items: mergedItems,
                totalAmount: mergedTotal,
                isUpdated: true,
                updatedAt: serverTimestamp(),
              })
            );

            orderId = existingOrderId;
            isAddOn = true;
          }
        } catch (lookupErr) {
          // If we can't confirm the old order is still open, don't block
          // the customer — just place a fresh order below.
          console.warn('Could not check existing order, placing a new one:', lookupErr);
        }
      }

      if (!orderId) {
        const orderData = {
          items: newItems,
          totalAmount: subtotal,
          tableNumber,
          status: 'pending',
          timestamp: serverTimestamp(),
          restaurantId,
        };
        const docRef = await withTimeout(addDoc(ordersRef(restaurantId), orderData));
        orderId = docRef.id;
      }

      // The Realtime Database sync only powers the extra-fast "live"
      // status ping for a brand-new order — Firestore (above) is the
      // source of truth and is already saved at this point. An add-on
      // merge doesn't touch status, so there's nothing new to push here.
      if (!isAddOn) {
        try {
          await withTimeout(
            syncOrderToRTDB(restaurantId, orderId, {
              status: 'pending',
              tableNumber,
              totalAmount: subtotal,
            })
          );
        } catch (rtdbErr) {
          console.warn('RTDB sync failed (order was still placed):', rtdbErr);
        }
      }

      localStorage.setItem(`primecafe_order_${restaurantId}`, orderId);
      setExistingOrderId(orderId);
      clearCart();
      setCartOpen(false);
      setPlacedOrder({ orderId, tableNumber, isAddOn });
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
    <div className="min-h-screen bg-white">
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

      {existingOrderId && (
        <button
          type="button"
          onClick={() => navigate(`/order-status/${restaurantId}/${existingOrderId}`)}
          className="fixed bottom-6 left-6 z-30 rounded-full bg-dark px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:opacity-90 active:scale-95"
        >
          View my order
        </button>
      )}

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
          isAddOn={placedOrder.isAddOn}
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
