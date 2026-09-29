import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { addDoc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { syncOrderToRTDB } from '../firebase';
import { CartProvider, useCart } from '../context/CartContext';
import CartDrawer from '../components/CartDrawer';
import OrderSuccessModal from '../components/OrderSuccessModal';
import CustomerDetailsModal from '../components/CustomerDetailsModal';
import TableMovePrompt from '../components/TableMovePrompt';
import { FloatingCartButton } from '../components/NotificationBadge';
import {
  MenuHero,
  MenuTagline,
  MenuFooter,
  MenuCategorySection,
} from '../components/FlutterMenu';
import {
  fetchCategories,
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

function addOrderToHistory(restaurantId, orderId) {
  try {
    const key = `primecafe_orders_${restaurantId}`;
    const raw = localStorage.getItem(key);
    const ids = raw ? JSON.parse(raw) : [];
    if (Array.isArray(ids) && !ids.includes(orderId)) {
      ids.push(orderId);
      localStorage.setItem(key, JSON.stringify(ids));
    }
  } catch {
    // localStorage can fail (private mode, quota) — not worth blocking the order over
  }
}

// How long an order stays eligible for each behaviour below. Tweak here.
const MERGE_WINDOW_MS = 2 * 60 * 60 * 1000; // add-on items merge into a same-table order this recent
const PROMPT_WINDOW_MS = 20 * 60 * 1000; // "did you order at another table?" only for orders this recent
const OPEN_STATUSES = ['pending', 'confirmed', 'preparing', 'ready'];

// "1", "01 " and "Table 1" style typos shouldn't cause a false mismatch.
function normalizeTable(value) {
  return String(value ?? '').trim().toLowerCase();
}

function tsToMs(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  if (typeof ts === 'number') return ts;
  return 0;
}

// Most recent moment anything happened on the order (placed or updated).
function lastActivityMs(order) {
  return Math.max(tsToMs(order?.timestamp), tsToMs(order?.updatedAt));
}

// Every order id this phone has placed for this cafe, oldest first. Also
// folds in the older single "latest order" pointer for anyone who ordered
// before the full history list existed.
function readOrderHistory(restaurantId) {
  try {
    const raw = localStorage.getItem(`primecafe_orders_${restaurantId}`);
    const ids = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(ids) ? [...ids] : [];
    const latest = localStorage.getItem(`primecafe_order_${restaurantId}`);
    if (latest && !list.includes(latest)) list.push(latest);
    return list;
  } catch {
    return [];
  }
}

function MenuContent() {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const restaurantId = resolveMenuRestaurantId(params, searchParams);
  const tableParam = (searchParams.get('table') || '').trim();
  // Coming back to the menu from another page (e.g. "Order more items" on
  // My Orders) may not carry ?table= — fall back to the table this visit
  // was opened with, so an order never silently lands on "Table 1".
  let rememberedTable = '';
  try {
    rememberedTable = (sessionStorage.getItem(`primecafe_table_${restaurantId}`) || '').trim();
  } catch {
    // sessionStorage unavailable — fine, we just won't have a fallback
  }
  const effectiveTable = tableParam || rememberedTable;
  const hasTableParam = effectiveTable.length > 0;
  const tableNumber = hasTableParam ? effectiveTable : '1';
  const navigate = useNavigate();

  // Link to the My Orders page, carrying the table so "Order more items"
  // from there stays on the right table.
  const myOrdersUrl = (orderId) => {
    const qs = new URLSearchParams();
    if (orderId) qs.set('order', orderId);
    if (hasTableParam) qs.set('table', tableNumber);
    const q = qs.toString();
    return `/my-orders/${restaurantId}${q ? `?${q}` : ''}`;
  };

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
  const [hasOrderHistory, setHasOrderHistory] = useState(() => {
    try {
      const raw = localStorage.getItem(`primecafe_orders_${restaurantId}`);
      const ids = raw ? JSON.parse(raw) : [];
      return Array.isArray(ids) && ids.length > 0;
    } catch {
      return false;
    }
  });
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [movePrompt, setMovePrompt] = useState(null); // an open order at a different table
  const [movePromptBusy, setMovePromptBusy] = useState(false);
  const [customerInfo, setCustomerInfo] = useState(() => {
    try {
      const name = localStorage.getItem('primecafe_customer_name') || '';
      const phone = localStorage.getItem('primecafe_customer_phone') || '';
      return name && phone ? { name, phone } : null;
    } catch {
      return null;
    }
  });

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

      const cacheKey = `primecafe_menu_cache_${restaurantId}`;
      let hadCache = false;
      try {
        const cached = JSON.parse(sessionStorage.getItem(cacheKey) || 'null');
        if (cached?.restaurant && cached?.categories) {
          setRestaurant(cached.restaurant);
          setCategories(cached.categories);
          setLoading(false);
          hadCache = true;
        }
      } catch {
        // corrupt/old cache shape — ignore and load fresh below
      }

      if (!hadCache) setLoading(true);
      setError(null);
      try {
        const [restaurantSnap, cats] = await Promise.all([
          getDoc(restaurantRef(restaurantId)),
          fetchCategories(restaurantId),
        ]);
        if (!restaurantSnap.exists()) {
          if (active && !hadCache) setError('Restaurant not found');
          return;
        }
        const freshRestaurant = { id: restaurantSnap.id, ...restaurantSnap.data() };
        if (active) {
          setRestaurant(freshRestaurant);
          setCategories(cats);
        }
        try {
          sessionStorage.setItem(
            cacheKey,
            JSON.stringify({ restaurant: freshRestaurant, categories: cats })
          );
        } catch {
          // storage full/unavailable — not worth failing the page load over
        }
      } catch {
        // If we already showed cached content, a failed background refresh
        // shouldn't blank the page — just keep what's on screen.
        if (active && !hadCache) setError('Failed to load menu');
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
      navigate(myOrdersUrl(placedOrder.orderId));
    }, 4000);
    return () => clearTimeout(timer);
  }, [placedOrder, restaurantId, navigate]);

  useEffect(() => {
    if (!restaurantId || !tableParam) return;
    try {
      sessionStorage.setItem(`primecafe_table_${restaurantId}`, tableParam);
    } catch {
      // best-effort only
    }
  }, [restaurantId, tableParam]);

  // Scanning a different table's QR while an earlier order of ours is still
  // open somewhere else? Ask whether to move that order here (or cancel it).
  useEffect(() => {
    if (!restaurantId || !hasTableParam) return undefined;
    let active = true;

    (async () => {
      const ids = readOrderHistory(restaurantId).slice(-5).reverse();
      if (ids.length === 0) return;

      const snaps = await Promise.all(
        ids.map((id) =>
          withTimeout(getDoc(orderRef(restaurantId, id)), 8000).catch(() => null)
        )
      );

      for (let i = 0; i < ids.length; i += 1) {
        const existing = snaps[i] && snaps[i].exists() ? snaps[i].data() : null;
        if (!existing) continue;
        if (!OPEN_STATUSES.includes(existing.status)) continue;
        if (normalizeTable(existing.tableNumber) === normalizeTable(tableNumber)) continue;
        if (Date.now() - lastActivityMs(existing) > PROMPT_WINDOW_MS) continue;

        const dismissKey = `primecafe_move_prompt_${ids[i]}_${normalizeTable(tableNumber)}`;
        try {
          if (sessionStorage.getItem(dismissKey)) continue;
        } catch {
          // no sessionStorage — just show the prompt
        }

        if (active) setMovePrompt({ id: ids[i], ...existing });
        return;
      }
    })();

    return () => {
      active = false;
    };
  }, [restaurantId, tableNumber, hasTableParam]);

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

  const handlePlaceOrder = async (info) => {
    if (items.length === 0) return;

    // Always let the customer confirm (or fix) their name/number before
    // anything goes to the kitchen — the modal comes pre-filled from last
    // time so this is normally just one tap, not retyping everything.
    if (!info) {
      setShowCustomerModal(true);
      return;
    }
    const customer = info;

    setPlacing(true);

    const newItems = items.map(({ id, name, price, quantity }) => ({
      id,
      name,
      price,
      quantity,
    }));

    try {
      let orderId = null;
      let isAddOn = false;

      // Only merge into an order that is (1) at this same table, (2) still
      // pending/confirmed, and (3) recent. If the link has no ?table= we
      // can't tell whose table this is, so we never merge in that case.
      if (hasTableParam) {
        const candidateIds = readOrderHistory(restaurantId).slice(-5).reverse();
        const snaps = await Promise.all(
          candidateIds.map((id) =>
            withTimeout(getDoc(orderRef(restaurantId, id)), 8000).catch(() => null)
          )
        );

        for (let i = 0; i < candidateIds.length && !orderId; i += 1) {
          const existing = snaps[i] && snaps[i].exists() ? snaps[i].data() : null;
          if (!existing) continue;
          if (!['pending', 'confirmed'].includes(existing.status)) continue;
          if (normalizeTable(existing.tableNumber) !== normalizeTable(tableNumber)) continue;
          if (Date.now() - lastActivityMs(existing) > MERGE_WINDOW_MS) continue;

          try {
            const mergedItems = [...(existing.items || [])];
            for (const item of newItems) {
              const match = mergedItems.find((it) => it.id === item.id);
              if (match) {
                match.quantity += item.quantity;
              } else {
                mergedItems.push(item);
              }
            }
            const mergedTotal = mergedItems.reduce(
              (sum, it) => sum + it.price * it.quantity,
              0
            );

            await withTimeout(
              updateDoc(orderRef(restaurantId, candidateIds[i]), {
                items: mergedItems,
                totalAmount: mergedTotal,
                isUpdated: true,
                updatedAt: serverTimestamp(),
              })
            );

            orderId = candidateIds[i];
            isAddOn = true;
          } catch (mergeErr) {
            // e.g. staff moved it to "preparing" a moment ago and the rules
            // rejected the edit — fall through and place a fresh order.
            console.warn('Could not merge into existing order, placing a new one:', mergeErr);
          }
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
          currencySymbol: restaurant?.currencySymbol || '€',
          currencyLabel: restaurant?.currencyLabel || 'euros',
          customerName: customer.name,
          customerPhone: customer.phone,
        };
        const docRef = await withTimeout(addDoc(ordersRef(restaurantId), orderData));
        orderId = docRef.id;
        addOrderToHistory(restaurantId, orderId);
        setHasOrderHistory(true);
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

  const dismissMovePrompt = () => {
    if (movePrompt) {
      try {
        sessionStorage.setItem(
          `primecafe_move_prompt_${movePrompt.id}_${normalizeTable(tableNumber)}`,
          '1'
        );
      } catch {
        // best-effort only
      }
    }
    setMovePrompt(null);
  };

  const handleMoveOrderHere = async () => {
    if (!movePrompt) return;
    setMovePromptBusy(true);
    try {
      await withTimeout(
        updateDoc(orderRef(restaurantId, movePrompt.id), {
          tableNumber,
          previousTableNumber: String(movePrompt.tableNumber ?? ''),
          tableChangedBy: 'customer',
          tableChangedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );
      toast.success(`Your order is now on Table ${tableNumber}`);
      setMovePrompt(null);
    } catch (err) {
      console.error('Failed to move order:', err);
      toast.error("Couldn't move your order. Please ask a staff member.");
    } finally {
      setMovePromptBusy(false);
    }
  };

  const handleCancelOldOrder = async () => {
    if (!movePrompt) return;
    setMovePromptBusy(true);
    try {
      await withTimeout(
        updateDoc(orderRef(restaurantId, movePrompt.id), {
          status: 'cancelled',
          cancelledBy: 'customer',
          cancelledAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );
      toast.success('Your order was cancelled');
      setMovePrompt(null);
    } catch (err) {
      // Most likely the kitchen started on it a moment ago.
      console.error('Failed to cancel order:', err);
      toast.error("Couldn't cancel — it may already be in preparation. Please ask a staff member.");
    } finally {
      setMovePromptBusy(false);
    }
  };

  const handleTrackOrder = () => {
    if (!placedOrder) return;
    navigate(myOrdersUrl(placedOrder.orderId));
  };

  const handleCustomerDetailsSubmit = (info) => {
    try {
      localStorage.setItem('primecafe_customer_name', info.name);
      localStorage.setItem('primecafe_customer_phone', info.phone);
    } catch {
      // best-effort only — still place the order even if storage fails
    }
    setCustomerInfo(info);
    setShowCustomerModal(false);
    handlePlaceOrder(info);
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
                  currencySymbol={restaurant?.currencySymbol || '€'}
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

      {hasOrderHistory && (
        <button
          type="button"
          onClick={() =>
            navigate(myOrdersUrl(existingOrderId))
          }
          className="fixed bottom-6 left-6 z-30 rounded-full bg-dark px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:opacity-90 active:scale-95"
        >
          View my orders
        </button>
      )}

      {itemCount > 0 && (
        <FloatingCartButton itemCount={itemCount} onClick={() => setCartOpen(true)} />
      )}

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        onPlaceOrder={() => handlePlaceOrder()}
        placing={placing}
        currency={restaurant?.currencySymbol || '€'}
      />

      {placedOrder && (
        <OrderSuccessModal
          tableNumber={placedOrder.tableNumber}
          isAddOn={placedOrder.isAddOn}
          onTrackOrder={handleTrackOrder}
        />
      )}

      {movePrompt && (
        <TableMovePrompt
          order={movePrompt}
          newTable={tableNumber}
          minutesAgo={Math.max(0, Math.round((Date.now() - lastActivityMs(movePrompt)) / 60000))}
          busy={movePromptBusy}
          onMove={handleMoveOrderHere}
          onCancelOrder={handleCancelOldOrder}
          onKeep={dismissMovePrompt}
        />
      )}

      {showCustomerModal && (
        <CustomerDetailsModal
          savedName={customerInfo?.name}
          savedPhone={customerInfo?.phone}
          onSubmit={handleCustomerDetailsSubmit}
          onClose={() => setShowCustomerModal(false)}
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
