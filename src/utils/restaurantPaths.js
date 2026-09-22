import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  limit,
} from 'firebase/firestore';
import { db } from '../firebase';

export function restaurantRef(restaurantId) {
  return doc(db, 'restaurants', restaurantId);
}

export function categoriesRef(restaurantId) {
  return collection(db, 'restaurants', restaurantId, 'categories');
}

export function categoryRef(restaurantId, categoryId) {
  return doc(db, 'restaurants', restaurantId, 'categories', categoryId);
}

export function itemsRef(restaurantId, categoryId) {
  return collection(
    db,
    'restaurants',
    restaurantId,
    'categories',
    categoryId,
    'items'
  );
}

export function itemRef(restaurantId, categoryId, itemId) {
  return doc(
    db,
    'restaurants',
    restaurantId,
    'categories',
    categoryId,
    'items',
    itemId
  );
}

export function ordersRef(restaurantId) {
  return collection(db, 'restaurants', restaurantId, 'orders');
}

export function orderRef(restaurantId, orderId) {
  return doc(db, 'restaurants', restaurantId, 'orders', orderId);
}

export async function resolveRestaurantId(uid) {
  const adminDoc = await getDoc(doc(db, 'admins', uid));
  if (adminDoc.exists()) {
    const data = adminDoc.data();
    return data.restaurantId || data.cafeId || null;
  }

  const owned = await getDocs(
    query(collection(db, 'restaurants'), where('ownerId', '==', uid), limit(1))
  );
  if (!owned.empty) return owned.docs[0].id;
  return null;
}

export async function fetchCategoriesWithAvailableItems(restaurantId) {
  const categoriesSnap = await getDocs(categoriesRef(restaurantId));
  const valid = [];

  for (const categoryDoc of categoriesSnap.docs) {
    const itemsSnap = await getDocs(
      query(
        itemsRef(restaurantId, categoryDoc.id),
        where('isAvailable', '==', true),
        limit(1)
      )
    );
    if (!itemsSnap.empty) {
      valid.push({ id: categoryDoc.id, ...categoryDoc.data() });
    }
  }

  return valid;
}

export async function fetchAvailableItems(restaurantId, categoryId) {
  const itemsSnap = await getDocs(
    query(
      itemsRef(restaurantId, categoryId),
      where('isAvailable', '==', true)
    )
  );
  return itemsSnap.docs.map((d) => ({ id: d.id, categoryId, ...d.data() }));
}

export function formatPrice(price, currency = '€') {
  const n = Number(price);
  return `${currency}${Number.isFinite(n) ? n.toFixed(2) : '0.00'}`;
}

// Kept for backward compatibility with any existing callers.
export function formatEuroPrice(price) {
  return formatPrice(price, '€');
}

export function resolveMenuRestaurantId(params, searchParams) {
  return (
    params?.restaurantId ||
    params?.cafeId ||
    searchParams.get('restaurantId') ||
    searchParams.get('cafeId') ||
    null
  );
}

export function buildMenuQrUrl(restaurantId, tableNumber) {
  const base = `${window.location.origin}/menu/${restaurantId}`;
  return tableNumber ? `${base}?table=${tableNumber}` : base;
}
