import { FiCheckCircle } from 'react-icons/fi';

export default function OrderSuccessModal({ tableNumber, onTrackOrder }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-6">
      <div className="animate-pop w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-2xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <FiCheckCircle className="text-4xl text-green-600" />
        </div>
        <h2 className="mt-4 text-xl font-bold text-dark">
          Order placed successfully!
        </h2>
        <p className="mt-2 text-sm text-gray-500">
          {tableNumber ? `Table ${tableNumber} — ` : ''}
          Your order is on its way to the kitchen.
        </p>
        <button
          type="button"
          onClick={onTrackOrder}
          className="mt-6 w-full rounded-xl bg-primary py-3 font-semibold text-white"
        >
          Track my order
        </button>
      </div>
    </div>
  );
}
