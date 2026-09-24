import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { onSnapshot } from 'firebase/firestore';
import { ref, onValue } from 'firebase/database';
import { FiCheck, FiClock } from 'react-icons/fi';
import { rtdb, STATUS_LABELS, STATUS_COLORS } from '../firebase';
import { orderRef } from '../utils/restaurantPaths';

const CUSTOMER_STEPS = ['pending', 'confirmed', 'preparing', 'ready', 'delivered'];

const STEP_ICONS = {
  pending: FiClock,
  confirmed: FiCheck,
  preparing: FiClock,
  ready: FiCheck,
  delivered: FiCheck,
};

export default function OrderStatusPage() {
  const { restaurantId, orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [liveStatus, setLiveStatus] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!restaurantId || !orderId) return;

    const unsubFirestore = onSnapshot(
      orderRef(restaurantId, orderId),
      (snap) => {
        if (snap.exists()) {
          setOrder({ id: snap.id, ...snap.data() });
          setNotFound(false);
        } else {
          setNotFound(true);
        }
      },
      () => setNotFound(true)
    );

    const rtdbRef = ref(rtdb, `liveOrders/${restaurantId}/${orderId}`);
    const unsubRTDB = onValue(rtdbRef, (snap) => {
      if (snap.exists()) {
        setLiveStatus(snap.val().status);
      }
    });

    return () => {
      unsubFirestore();
      unsubRTDB();
    };
  }, [restaurantId, orderId]);

  const currentStatus = liveStatus || order?.status || 'pending';
  const currentStepIndex = CUSTOMER_STEPS.indexOf(currentStatus);

  if (notFound) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <div>
          <p className="text-5xl">🔍</p>
          <h1 className="mt-4 text-xl font-bold">Order not found</h1>
          <Link
            to={`/menu/${restaurantId}`}
            className="mt-4 inline-block text-primary hover:underline"
          >
            Back to menu
          </Link>
        </div>
      </div>
    );
  }

  if (!order) {
    return <div className="min-h-screen bg-gray-50" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
      <header className="bg-white px-4 py-6 shadow-sm">
        <div className="mx-auto max-w-lg text-center">
          <h1 className="text-2xl font-bold text-dark">Order Status</h1>
          <p className="mt-1 text-gray-500">Table {order.tableNumber}</p>
          <span
            className={`mt-3 inline-block rounded-full border px-4 py-1 text-sm font-semibold capitalize ${STATUS_COLORS[currentStatus]}`}
          >
            {STATUS_LABELS[currentStatus] || currentStatus}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-8">
        <div className="relative">
          {CUSTOMER_STEPS.map((step, idx) => {
            const isComplete = idx <= currentStepIndex;
            const isCurrent = idx === currentStepIndex;
            const Icon = STEP_ICONS[step];

            return (
              <div key={step} className="relative flex gap-4 pb-8 last:pb-0">
                {idx < CUSTOMER_STEPS.length - 1 && (
                  <div
                    className={`absolute left-5 top-10 h-full w-0.5 ${
                      isComplete ? 'bg-primary' : 'bg-gray-200'
                    }`}
                  />
                )}
                <div
                  className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                    isComplete
                      ? 'border-primary bg-primary text-white'
                      : 'border-gray-200 bg-white text-gray-400'
                  } ${isCurrent ? 'ring-4 ring-primary/20' : ''}`}
                >
                  <Icon size={18} />
                </div>
                <div className="pt-1.5">
                  <p
                    className={`font-semibold capitalize ${
                      isComplete ? 'text-dark' : 'text-gray-400'
                    }`}
                  >
                    {STATUS_LABELS[step]}
                  </p>
                  {isCurrent && (
                    <p className="mt-0.5 text-sm text-primary animate-pulse">
                      In progress...
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <h2 className="mb-4 font-bold text-dark">Order Summary</h2>
          <ul className="space-y-2">
            {order.items?.map((item, idx) => (
              <li key={idx} className="flex justify-between text-sm">
                <span>
                  {item.name}{' '}
                  <span className="text-gray-400">× {item.quantity}</span>
                </span>
                <span>€{(item.price * item.quantity).toFixed(2)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-between border-t pt-4 text-lg font-bold">
            <span>Total</span>
            <span className="text-primary">
              €{order.totalAmount?.toFixed(2)}
            </span>
          </div>
        </div>

        <Link
            to={`/menu/${restaurantId}?table=${order.tableNumber}`}
          className="mt-6 block text-center text-sm text-primary hover:underline"
        >
          Order more items
        </Link>
        <Link
          to={`/my-orders/${restaurantId}`}
          className="mt-2 block text-center text-sm text-gray-500 hover:underline"
        >
          View all my orders
        </Link>
      </main>
    </div>
  );
}
