import {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
} from 'react';
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { collection, doc, setDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { resolveRestaurantId } from '../utils/restaurantPaths';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [restaurantId, setRestaurantId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const id = await resolveRestaurantId(firebaseUser.uid);
        setRestaurantId(id);
      } else {
        setRestaurantId(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = async (email, password) => {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const id = await resolveRestaurantId(credential.user.uid);
    if (!id) {
      await signOut(auth);
      throw new Error('You are not authorized as an admin.');
    }
    setRestaurantId(id);
    return credential.user;
  };

  const signup = async ({ email, password, cafeName }) => {
    const credential = await createUserWithEmailAndPassword(auth, email, password);

    try {
      const restaurantRef = await addDoc(collection(db, 'restaurants'), {
        ownerId: credential.user.uid,
        name: cafeName,
        createdAt: serverTimestamp(),
      });

      await setDoc(doc(db, 'admins', credential.user.uid), {
        restaurantId: restaurantRef.id,
        cafeId: restaurantRef.id,
        email,
      });

      setRestaurantId(restaurantRef.id);
      return credential.user;
    } catch (err) {
      try {
        await credential.user.delete();
      } catch {
        await signOut(auth);
      }
      throw err;
    }
  };

  const logout = () => signOut(auth);

  const value = useMemo(
    () => ({
      user,
      restaurantId,
      cafeId: restaurantId,
      loading,
      login,
      signup,
      logout,
      isAdmin: !!user && !!restaurantId,
    }),
    [user, restaurantId, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
