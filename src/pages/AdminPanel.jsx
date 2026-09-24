import { useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  onSnapshot,
  updateDoc,
  addDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
} from 'firebase/firestore';
import { QRCodeCanvas } from 'qrcode.react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  FiLogOut,
  FiMenu,
  FiShoppingBag,
  FiGrid,
  FiDownload,
  FiExternalLink,
  FiLayers,
  FiEye,
  FiSettings,
} from 'react-icons/fi';
import { syncOrderToRTDB } from '../firebase';
import { useAuth } from '../context/AuthContext';
import OrderCard from '../components/OrderCard';
import BillModal from '../components/BillModal';
import NotificationBadge from '../components/NotificationBadge';
import ImageUploadField from '../components/ImageUploadField';
import {
  playNewOrderSound,
  useDocumentTitleBadge,
} from '../components/SplashGate';
import {
  categoriesRef,
  categoryRef,
  itemsRef,
  itemRef,
  ordersRef,
  orderRef,
  restaurantRef,
  buildMenuQrUrl,
  formatEuroPrice,
} from '../utils/restaurantPaths';

const TABS = [
  { id: 'orders', label: 'Live Orders', icon: FiShoppingBag },
  { id: 'categories', label: 'Categories', icon: FiLayers },
  { id: 'menu', label: 'Menu Items', icon: FiMenu },
  { id: 'qr', label: 'QR Code', icon: FiGrid },
  { id: 'settings', label: 'Settings', icon: FiSettings },
];

const EMPTY_SETTINGS = {
  name: '',
  tagline: '',
  allergenNote: '',
  openHours: '',
  heroImage: '',
  phone: '',
  whatsapp: '',
  mapsUrl: '',
  instagramUrl: '',
  facebookUrl: '',
};

const ORDER_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'active', label: 'Active' },
  { id: 'completed', label: 'Completed' },
];

const EMPTY_ITEM = {
  categoryId: '',
  name: '',
  price: '',
  description: '',
  image: '',
  isAvailable: true,
};

export default function AdminPanel() {
  const { restaurantId, logout, user } = useAuth();
  const [activeTab, setActiveTab] = useState('orders');
  const [orderFilter, setOrderFilter] = useState('all');
  const [orders, setOrders] = useState([]);
  const [categories, setCategories] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [restaurant, setRestaurant] = useState(null);
  const [billOrder, setBillOrder] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [categoryName, setCategoryName] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);
  const [newItem, setNewItem] = useState(EMPTY_ITEM);
  const [editing, setEditing] = useState(null);
  const [tableNumber, setTableNumber] = useState('1');
  const [settings, setSettings] = useState(EMPTY_SETTINGS);
  const [savingSettings, setSavingSettings] = useState(false);
  const settingsLoaded = useRef(false);
  const knownOrderIds = useRef(new Set());
  const initialLoad = useRef(true);

  useDocumentTitleBadge(pendingCount);

  useEffect(() => {
    if (!restaurantId) return;

    const unsubRestaurant = onSnapshot(restaurantRef(restaurantId), (snap) => {
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() };
        setRestaurant(data);
        if (!settingsLoaded.current) {
          setSettings({ ...EMPTY_SETTINGS, ...data });
          settingsLoaded.current = true;
        }
      }
    });

    const unsubOrders = onSnapshot(ordersRef(restaurantId), (snapshot) => {
      const data = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const ta = a.timestamp?.toMillis?.() || 0;
          const tb = b.timestamp?.toMillis?.() || 0;
          return tb - ta;
        });

      if (!initialLoad.current) {
        data.forEach((order) => {
          if (
            order.status === 'pending' &&
            !knownOrderIds.current.has(order.id)
          ) {
            toast.success(`New order — Table ${order.tableNumber}!`, {
              icon: '🔔',
            });
            playNewOrderSound();
          }
        });
      }

      data.forEach((o) => knownOrderIds.current.add(o.id));
      initialLoad.current = false;
      setOrders(data);
      setPendingCount(data.filter((o) => o.status === 'pending').length);
    });

    const unsubCategories = onSnapshot(
      query(categoriesRef(restaurantId), orderBy('createdAt')),
      (snapshot) => {
        setCategories(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      }
    );

    return () => {
      unsubRestaurant();
      unsubOrders();
      unsubCategories();
    };
  }, [restaurantId]);

  useEffect(() => {
    if (!restaurantId || categories.length === 0) {
      setAllItems([]);
      return;
    }

    const unsubs = categories.map((cat) =>
      onSnapshot(itemsRef(restaurantId, cat.id), (snap) => {
        const catItems = snap.docs.map((d) => ({
          id: d.id,
          categoryId: cat.id,
          categoryName: cat.name,
          ...d.data(),
        }));
        setAllItems((prev) => {
          const others = prev.filter((i) => i.categoryId !== cat.id);
          return [...others, ...catItems];
        });
      })
    );

    return () => unsubs.forEach((u) => u());
  }, [restaurantId, categories]);

  const filteredOrders = useMemo(() => {
    switch (orderFilter) {
      case 'pending':
        return orders.filter((o) => o.status === 'pending');
      case 'active':
        return orders.filter((o) =>
          ['confirmed', 'preparing', 'ready'].includes(o.status)
        );
      case 'completed':
        return orders.filter((o) => ['delivered', 'paid'].includes(o.status));
      default:
        return orders;
    }
  }, [orders, orderFilter]);

  const handleStatusChange = async (orderId, newStatus) => {
    await updateDoc(orderRef(restaurantId, orderId), { status: newStatus, isUpdated: false });
    const order = orders.find((o) => o.id === orderId);
    await syncOrderToRTDB(restaurantId, orderId, {
      status: newStatus,
      tableNumber: order?.tableNumber,
      totalAmount: order?.totalAmount,
    });
    toast.success(`Order updated to ${newStatus}`);
  };

  const handleMarkPaid = async (orderId) => {
    await handleStatusChange(orderId, 'paid');
    toast.success('Marked as paid');
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await updateDoc(restaurantRef(restaurantId), { ...settings });
      toast.success('Cafe details updated');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!categoryName.trim()) return;
    setSavingCategory(true);
    try {
      await addDoc(categoriesRef(restaurantId), {
        name: categoryName.trim(),
        createdAt: serverTimestamp(),
      });
      setCategoryName('');
      toast.success('Category added');
    } catch {
      toast.error('Failed to add category');
    } finally {
      setSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (categoryId) => {
    if (!window.confirm('Delete this category and all its items?')) return;
    const items = allItems.filter((i) => i.categoryId === categoryId);
    await Promise.all(
      items.map((item) =>
        deleteDoc(itemRef(restaurantId, categoryId, item.id))
      )
    );
    await deleteDoc(categoryRef(restaurantId, categoryId));
    toast.success('Category deleted');
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!newItem.categoryId || !newItem.name || !newItem.price) {
      toast.error('Category, name and price are required');
      return;
    }

    await addDoc(itemsRef(restaurantId, newItem.categoryId), {
      name: newItem.name.trim(),
      price: Number(newItem.price),
      description: newItem.description.trim(),
      image: newItem.image.trim(),
      isAvailable: newItem.isAvailable,
      createdAt: serverTimestamp(),
    });

    setNewItem(EMPTY_ITEM);
    toast.success('Item added');
  };

  const handleUpdateItem = async () => {
    if (!editing) return;
    await updateDoc(
      itemRef(restaurantId, editing.categoryId, editing.id),
      {
        name: editing.name,
        price: Number(editing.price),
        description: editing.description,
        image: editing.image,
        isAvailable: editing.isAvailable,
      }
    );
    setEditing(null);
    toast.success('Item updated');
  };

  const handleToggleItem = async (item) => {
    await updateDoc(itemRef(restaurantId, item.categoryId, item.id), {
      isAvailable: !item.isAvailable,
    });
  };

  const handleDeleteItem = async (item) => {
    if (!window.confirm('Delete this item?')) return;
    await deleteDoc(itemRef(restaurantId, item.categoryId, item.id));
    toast.success('Item deleted');
  };

  const qrUrl = buildMenuQrUrl(restaurantId, tableNumber);

  const downloadQR = () => {
    const canvas = document.getElementById('qr-code-canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `primecafe-table-${tableNumber}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="min-h-screen bg-[#F5EFE6]">
      <header className="sticky top-0 z-30 border-b border-[#E8DFCA] bg-[#E8DFCA]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-lg font-bold text-[#1C1C1C]">
              {restaurant?.name || 'PrimeCafe Admin'}
            </h1>
            <p className="text-xs text-gray-600">{user?.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to={`/menu/${restaurantId}`}
              target="_blank"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-[#1C1C1C] hover:bg-white/50"
            >
              <FiEye />
              View Menu
            </Link>
            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#1C1C1C] hover:bg-white/50"
            >
              <FiLogOut />
              Logout
            </button>
          </div>
        </div>

        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium ${
                activeTab === tab.id
                  ? 'border-[#1C1C1C] text-[#1C1C1C]'
                  : 'border-transparent text-gray-600'
              }`}
            >
              {tab.id === 'orders' ? (
                <NotificationBadge count={pendingCount}>
                  <tab.icon />
                </NotificationBadge>
              ) : (
                <tab.icon />
              )}
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {activeTab === 'orders' && (
          <div>
            <div className="mb-6 flex flex-wrap gap-2">
              {ORDER_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setOrderFilter(f.id)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                    orderFilter === f.id
                      ? 'bg-[#1C1C1C] text-white'
                      : 'bg-white text-gray-600 ring-1 ring-gray-200'
                  }`}
                >
                  {f.label}
                  {f.id === 'pending' && pendingCount > 0 && (
                    <span className="ml-1.5 rounded-full bg-red-500 px-1.5 text-xs text-white">
                      {pendingCount}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {filteredOrders.length === 0 ? (
              <div className="rounded-2xl bg-white py-16 text-center text-gray-500 shadow-sm">
                <FiShoppingBag className="mx-auto text-4xl text-gray-300" />
                <p className="mt-4">No orders yet</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onStatusChange={handleStatusChange}
                    onGenerateBill={setBillOrder}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'categories' && (
          <div className="mx-auto max-w-lg">
            <div className="rounded-[20px] bg-white p-6 shadow-lg">
              <h2 className="text-xl font-bold text-[#1C1C1C]">Create New Category</h2>
              <form onSubmit={handleAddCategory} className="mt-5 space-y-4">
                <input
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  placeholder="Category Name"
                  className="w-full rounded-xl border border-[#1C1C1C] px-4 py-3 outline-none focus:ring-2 focus:ring-[#1C1C1C]/20"
                  required
                />
                <button
                  type="submit"
                  disabled={savingCategory}
                  className="w-full rounded-xl bg-[#1C1C1C] py-3 font-semibold text-white disabled:opacity-50"
                >
                  {savingCategory ? 'Saving...' : 'Save Category'}
                </button>
              </form>

              <div className="my-6 border-t" />

              <h3 className="mb-3 font-semibold">Categories ({categories.length})</h3>
              {categories.length === 0 ? (
                <p className="text-sm text-gray-500">No categories yet</p>
              ) : (
                <ul className="space-y-2">
                  {categories.map((cat) => (
                    <li
                      key={cat.id}
                      className="flex items-center justify-between rounded-xl bg-[#F5EFE6] px-4 py-3"
                    >
                      <span className="font-medium">{cat.name}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(cat.id)}
                        className="text-sm text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {activeTab === 'menu' && (
          <div className="space-y-8">
            <form
              onSubmit={handleAddItem}
              className="rounded-[20px] bg-white p-6 shadow-lg"
            >
              <h2 className="text-xl font-bold">Add Menu Item</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <select
                  value={newItem.categoryId}
                  onChange={(e) =>
                    setNewItem({ ...newItem, categoryId: e.target.value })
                  }
                  className="rounded-xl border border-gray-200 px-3 py-2"
                  required
                >
                  <option value="">Select Category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <input
                  placeholder="Item Name"
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  className="rounded-xl border border-gray-200 px-3 py-2"
                  required
                />
                <input
                  placeholder="Price (€)"
                  type="number"
                  min="0"
                  step="0.01"
                  value={newItem.price}
                  onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                  className="rounded-xl border border-gray-200 px-3 py-2"
                  required
                />
                <ImageUploadField
                  value={newItem.image}
                  onChange={(url) => setNewItem({ ...newItem, image: url })}
                  folder={`restaurants/${restaurantId}/items`}
                  label="Item photo"
                />
                <textarea
                  placeholder="Description"
                  value={newItem.description}
                  onChange={(e) =>
                    setNewItem({ ...newItem, description: e.target.value })
                  }
                  className="min-h-[80px] rounded-xl border border-gray-200 px-3 py-2 sm:col-span-2"
                />
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={newItem.isAvailable}
                    onChange={(e) =>
                      setNewItem({ ...newItem, isAvailable: e.target.checked })
                    }
                  />
                  Available
                </label>
              </div>
              <button
                type="submit"
                className="mt-4 rounded-xl bg-[#1C1C1C] px-6 py-2.5 font-semibold text-white"
              >
                Add Item
              </button>
            </form>

            <div className="space-y-3">
              <h2 className="text-lg font-bold">All Items ({allItems.length})</h2>
              {categories.map((cat) => {
                const catItems = allItems.filter((i) => i.categoryId === cat.id);
                if (catItems.length === 0) return null;
                return (
                  <div key={cat.id} className="rounded-2xl bg-white p-4 shadow-sm">
                    <h3 className="mb-3 font-bold text-[#1C1C1C]">{cat.name}</h3>
                    <div className="space-y-2">
                      {catItems.map((item) =>
                        editing?.id === item.id ? (
                          <div key={item.id} className="grid gap-2 rounded-xl bg-[#F5EFE6] p-3 sm:grid-cols-2">
                            <input
                              value={editing.name}
                              onChange={(e) =>
                                setEditing({ ...editing, name: e.target.value })
                              }
                              className="rounded border px-2 py-1"
                            />
                            <input
                              type="number"
                              value={editing.price}
                              onChange={(e) =>
                                setEditing({ ...editing, price: e.target.value })
                              }
                              className="rounded border px-2 py-1"
                            />
                            <ImageUploadField
                              value={editing.image}
                              onChange={(url) => setEditing({ ...editing, image: url })}
                              folder={`restaurants/${restaurantId}/items`}
                              label="Item photo"
                            />
                            <textarea
                              value={editing.description}
                              onChange={(e) =>
                                setEditing({ ...editing, description: e.target.value })
                              }
                              className="rounded border px-2 py-1 sm:col-span-2"
                            />
                            <div className="flex gap-2 sm:col-span-2">
                              <button
                                type="button"
                                onClick={handleUpdateItem}
                                className="rounded-lg bg-[#1C1C1C] px-3 py-1 text-sm text-white"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditing(null)}
                                className="text-sm text-gray-500"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div
                            key={item.id}
                            className="flex flex-wrap items-center gap-3 rounded-xl bg-[#F5EFE6] p-3"
                          >
                            {item.image && (
                              <img
                                src={item.image}
                                alt=""
                                className="h-12 w-12 rounded-lg object-cover"
                              />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="font-medium">{item.name}</p>
                              <p className="text-sm text-gray-600">
                                {formatEuroPrice(item.price)}
                                {item.description ? ` · ${item.description.slice(0, 40)}` : ''}
                              </p>
                            </div>
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs ${
                                item.isAvailable !== false
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-gray-200 text-gray-500'
                              }`}
                            >
                              {item.isAvailable !== false ? 'Available' : 'Hidden'}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleToggleItem(item)}
                              className="text-sm hover:underline"
                            >
                              Toggle
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditing({ ...item })}
                              className="text-sm hover:underline"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteItem(item)}
                              className="text-sm text-red-600 hover:underline"
                            >
                              Delete
                            </button>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'qr' && (
          <div className="mx-auto max-w-md text-center">
            <div className="inline-block rounded-xl bg-white p-4 shadow-lg">
              <div className="relative inline-block">
                <QRCodeCanvas
                  id="qr-code-canvas"
                  value={qrUrl}
                  size={220}
                  level="H"
                  includeMargin
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-white px-3 py-2 text-center text-sm font-extrabold leading-tight">
                    PRIME CAFE
                    <br />
                    BREAKFAST
                  </div>
                </div>
              </div>
            </div>

            <p className="mt-5 text-lg font-semibold">Scan to view menu</p>

            <label className="mt-6 block text-left text-sm font-medium">
              Table Number (optional)
            </label>
            <input
              type="text"
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2"
            />

            <p className="mt-3 break-all text-xs text-gray-500">{qrUrl}</p>

            <div className="mt-6 flex justify-center gap-3">
              <button
                type="button"
                onClick={downloadQR}
                className="flex items-center gap-2 rounded-[10px] bg-[#1C1C1C] px-5 py-3.5 font-semibold text-white"
              >
                <FiDownload />
                Download
              </button>
              <a
                href={qrUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-[10px] bg-[#1C1C1C] px-5 py-3.5 font-semibold text-white"
              >
                <FiExternalLink />
                Open Link
              </a>
            </div>
          </div>
        )}
        {activeTab === 'settings' && (
          <form
            onSubmit={handleSaveSettings}
            className="mx-auto max-w-lg space-y-4 rounded-[20px] bg-white p-6 shadow-lg"
          >
            <h2 className="text-xl font-bold text-[#1C1C1C]">Cafe details</h2>
            <p className="text-sm text-gray-500">
              This is what customers see on your menu page — nothing here is
              shared with other cafes.
            </p>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Cafe name
              </label>
              <input
                value={settings.name}
                onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                className="w-full rounded-xl border border-gray-200 px-3 py-2"
                placeholder="Your Cafe"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Tagline
              </label>
              <input
                value={settings.tagline}
                onChange={(e) => setSettings({ ...settings, tagline: e.target.value })}
                className="w-full rounded-xl border border-gray-200 px-3 py-2"
                placeholder="Enjoy great food"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Opening hours (shown on hero image)
              </label>
              <input
                value={settings.openHours}
                onChange={(e) => setSettings({ ...settings, openHours: e.target.value })}
                className="w-full rounded-xl border border-gray-200 px-3 py-2"
                placeholder="OPEN 8AM TO 11PM"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Allergen / dietary note (optional)
              </label>
              <textarea
                value={settings.allergenNote}
                onChange={(e) =>
                  setSettings({ ...settings, allergenNote: e.target.value })
                }
                className="min-h-[70px] w-full rounded-xl border border-gray-200 px-3 py-2"
              />
            </div>

            <ImageUploadField
              value={settings.heroImage}
              onChange={(url) => setSettings({ ...settings, heroImage: url })}
              folder={`restaurants/${restaurantId}/hero`}
              label="Hero image"
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Phone
                </label>
                <input
                  value={settings.phone}
                  onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2"
                  placeholder="+91..."
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  WhatsApp (if different)
                </label>
                <input
                  value={settings.whatsapp}
                  onChange={(e) => setSettings({ ...settings, whatsapp: e.target.value })}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2"
                  placeholder="+91..."
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Google Maps link
              </label>
              <input
                value={settings.mapsUrl}
                onChange={(e) => setSettings({ ...settings, mapsUrl: e.target.value })}
                className="w-full rounded-xl border border-gray-200 px-3 py-2"
                placeholder="https://maps.google.com/..."
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Instagram link
                </label>
                <input
                  value={settings.instagramUrl}
                  onChange={(e) =>
                    setSettings({ ...settings, instagramUrl: e.target.value })
                  }
                  className="w-full rounded-xl border border-gray-200 px-3 py-2"
                  placeholder="https://instagram.com/..."
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Facebook link
                </label>
                <input
                  value={settings.facebookUrl}
                  onChange={(e) =>
                    setSettings({ ...settings, facebookUrl: e.target.value })
                  }
                  className="w-full rounded-xl border border-gray-200 px-3 py-2"
                  placeholder="https://facebook.com/..."
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={savingSettings}
              className="w-full rounded-xl bg-[#1C1C1C] py-3 font-semibold text-white disabled:opacity-50"
            >
              {savingSettings ? 'Saving...' : 'Save cafe details'}
            </button>
          </form>
        )}
      </main>

      <BillModal
        order={billOrder}
        cafe={restaurant}
        open={!!billOrder}
        onClose={() => setBillOrder(null)}
        onMarkPaid={handleMarkPaid}
        currency="€"
      />
    </div>
  );
}
