import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { onSnapshot } from 'firebase/firestore';
import { STATUS_LABELS, STATUS_COLORS } from '../firebase';
import { orderRef } from '../utils/restaurantPaths';

function getStoredOrderIds(restaurantId) {
  try {
    const raw = localStorage.getItem(`primecafe_orders_${restaurantId}`);
    const ids = raw ? JSON.parse(raw) : [];
    return Array.isArray(ids) ? ids : [];
  } catch {
    return [];
  }
}

function OrderMiniCard({ restaurantId, orderId }) {
  const [order, setOrder] = useState(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(
      orderRef(restaurantId, orderId),
      (snap) => {
        if (snap.exists()) {
          setOrder({ id: snap.id, ...snap.data() });
        } else {
          setMissing(true);
        }
      },
      () => setMissing(true)
    );
    return () => unsub();
  }, [restaurantId, orderId]);

  if (missing) return null;
  if (!order) {
    return (
      <div className="h-28 animate-pulse rounded-2xl bg-gray-100" />
    );
  }

  const timestamp = order.timestamp?.toDate
    ? order.timestamp.toDate()
    : order.timestamp
      ? new Date(order.timestamp)
      : null;

  return (
    <Link
      to={`/order-status/${restaurantId}/${orderId}`}
      className="block rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100 transition hover:shadow-md"
    >
      {order.isUpdated && (
        <div className="mb-3 rounded-lg bg-red-50 px-3 py-1.5 text-center text-xs font-bold text-red-600">
          UPDATED
        </div>
      )}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold text-dark">Table {order.tableNumber}</p>
          {timestamp && (
            <p className="mt-0.5 text-xs text-gray-400">{timestamp.toLocaleString()}</p>
          )}
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${STATUS_COLORS[order.status] || 'bg-gray-100'}`}
        >
          {STATUS_LABELS[order.status] || order.status}
        </span>
      </div>

      <ul className="mt-3 space-y-1 border-t border-gray-50 pt-3">
        {order.items?.map((item, idx) => (
          <li key={idx} className="flex justify-between text-sm text-gray-600">
            <span>
              {item.name} <span className="text-gray-400">× {item.quantity}</span>
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex justify-between border-t border-gray-50 pt-3 text-sm font-bold">
        <span>Total</span>
        <span className="text-primary">€{order.totalAmount?.toFixed(2)}</span>
      </div>
    </Link>
  );
}

export default function MyOrdersPage() {
  const { restaurantId } = useParams();
  const [orderIds, setOrderIds] = useState(() => getStoredOrderIds(restaurantId));

  useEffect(() => {
    setOrderIds(getStoredOrderIds(restaurantId));
  }, [restaurantId]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
      <header className="bg-white px-4 py-6 shadow-sm">
        <div className="mx-auto max-w-lg text-center">
          <h1 className="text-2xl font-bold text-dark">My Orders</h1>
          <p className="mt-1 text-gray-500">
            {orderIds.length} order{orderIds.length === 1 ? '' : 's'} this visit
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 px-4 py-8">
        {orderIds.length === 0 ? (
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-gray-100">
            <p className="text-5xl">🧾</p>
            <p className="mt-4 font-semibold text-dark">No orders yet</p>
            <Link
              to={`/menu/${restaurantId}`}
              className="mt-4 inline-block text-primary hover:underline"
            >
              Go to menu
            </Link>
          </div>
        ) : (
          [...orderIds]
            .reverse()
            .map((id) => <OrderMiniCard key={id} restaurantId={restaurantId} orderId={id} />)
        )}

        <Link
          to={`/menu/${restaurantId}`}
          className="block text-center text-sm text-primary hover:underline"
        >
          Order more items
        </Link>
      </main>
    </div>
  );
}
