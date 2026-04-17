"use client";

import { useState, useEffect, useRef } from "react";
import { db } from "@/firebase";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import {
  Search,
  Wallet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  LogOut,
  RotateCcw,
  Users,
  Hash,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

type SearchMode = "team" | "roll";

interface PendingTransaction {
  attendeeId: string;
  amount: number;
  items: string[];
  previousBalance: number;
}

export default function Dashboard() {
  const { isAuthenticated, isLoading, login, logout } = useAuth();
  const [passcode, setPasscode] = useState("");
  const [searchMode, setSearchMode] = useState<SearchMode>("team");
  const [searchId, setSearchId] = useState("");
  const [attendee, setAttendee] = useState<{
    id: string;
    remainingBalance: number;
    type: string;
  } | null>(null);
  const [cart, setCart] = useState<{ name: string; price: number; quantity: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Undo Logic State
  const [pendingTx, setPendingTx] = useState<PendingTransaction | null>(null);
  const [undoTimer, setUndoTimer] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await login(passcode);
    if (!result.success) {
      setError(result.error || "Login failed");
    }
    setLoading(false);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = searchId.trim().toUpperCase();
    if (!id) return;

    // Roll Number Validation (6 or 11 digits)
    if (searchMode === "roll" && !/^(\d{6}|\d{11})$/.test(id)) {
      setError("Roll number must be exactly 6 or 11 digits");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    setCart([]);

    try {
      const docRef = doc(db, "attendees", id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setAttendee({
          id: docSnap.id,
          remainingBalance: docSnap.data().remainingBalance,
          type: docSnap.data().type,
        });
      } else {
        if (searchMode === "team") {
          setError("Team ID not found. Please check with registration.");
          setAttendee(null);
        } else {
          // Initialize new Roll Number
          await setDoc(docRef, { remainingBalance: 30, type: "roll" });
          setAttendee({ id: docRef.id, remainingBalance: 30, type: "roll" });
          setSuccess("New attendee initialized with ₹30");
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch attendee");
    } finally {
      setLoading(false);
    }
  };

  const handleAddProduct = (name: string, price: number) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.name === name);
      if (existing) {
        return prev.map((item) =>
          item.name === name ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }
      return [...prev, { name, price, quantity: 1 }];
    });
  };

  const handleRemoveProduct = (name: string) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.name === name);
      if (existing && existing.quantity > 1) {
        return prev.map((item) =>
          item.name === name ? { ...item, quantity: item.quantity - 1 } : item,
        );
      }
      return prev.filter((item) => item.name !== name);
    });
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const startTransaction = () => {
    if (!attendee) return;
    if (cartTotal <= 0) {
      setError("Cart is empty");
      return;
    }
    if (cartTotal > attendee.remainingBalance) {
      setError("Insufficient balance");
      return;
    }

    // Set pending transaction and start timer
    setPendingTx({
      attendeeId: attendee.id,
      amount: cartTotal,
      items: cart.map((i) => i.name),
      previousBalance: attendee.remainingBalance,
    });

    // Optimistic update
    setAttendee({
      ...attendee,
      remainingBalance: attendee.remainingBalance - cartTotal,
    });
    setCart([]);
    setUndoTimer(5);
  };

  const commitTransaction = async (tx: PendingTransaction) => {
    try {
      const docRef = doc(db, "attendees", tx.attendeeId);
      const newBalance = tx.previousBalance - tx.amount;

      // Update balance
      await updateDoc(docRef, { remainingBalance: newBalance });

      // Log transaction
      await addDoc(collection(db, "transactions"), {
        attendeeId: tx.attendeeId,
        amount: tx.amount,
        items: tx.items,
        timestamp: serverTimestamp(),
      });

      setSuccess(`Deducted ₹${tx.amount} for ${tx.items.join(", ")}`);
    } catch (err: any) {
      setError("Failed to commit transaction. Please check connection.");
      // Revert UI if possible
      setAttendee((prev) =>
        prev && prev.id === tx.attendeeId
          ? { ...prev, remainingBalance: tx.previousBalance }
          : prev,
      );
    }
  };

  const handleUndo = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (pendingTx && attendee && attendee.id === pendingTx.attendeeId) {
      setAttendee({ ...attendee, remainingBalance: pendingTx.previousBalance });
    }
    setPendingTx(null);
    setUndoTimer(0);
    setSuccess("Transaction undone");
  };

  useEffect(() => {
    if (undoTimer > 0) {
      timerRef.current = setInterval(() => {
        setUndoTimer((prev) => prev - 1);
      }, 1000);
    } else if (undoTimer === 0 && pendingTx) {
      commitTransaction(pendingTx);
      setPendingTx(null);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [undoTimer, pendingTx]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
        <p className="text-gray-500 font-medium">Loading session...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 w-full max-w-md">
          <div className="flex justify-center mb-6">
            <div className="bg-blue-100 p-3 rounded-full">
              <Wallet className="w-8 h-8 text-blue-600" />
            </div>
          </div>
          <h1 className="text-2xl font-semibold text-center text-gray-900 mb-2">
            Coordinator Login
          </h1>
          <p className="text-gray-500 text-center mb-8">
            Enter the passcode to access the dashboard
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Enter passcode"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
            {error && (
              <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Access Dashboard
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="w-6 h-6 text-blue-600" />
            <h1 className="font-semibold text-gray-900">
              E-Summit 26 Attendance
            </h1>
          </div>
          <button
            onClick={logout}
            className="text-gray-500 hover:text-gray-700 p-2"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Mode Toggle & Search */}
        <section className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-4">
          <div className="flex p-1 bg-gray-100 rounded-xl">
            <button
              onClick={() => {
                setSearchMode("team");
                setAttendee(null);
                setSearchId("");
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${searchMode === "team" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500"}`}
            >
              <Users className="w-4 h-4" /> Team ID
            </button>
            <button
              onClick={() => {
                setSearchMode("roll");
                setAttendee(null);
                setSearchId("");
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${searchMode === "roll" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500"}`}
            >
              <Hash className="w-4 h-4" /> Roll No.
            </button>
          </div>

          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                placeholder={
                  searchMode === "team"
                    ? "Enter Team ID"
                    : "Enter 6 or 11-digit Roll No."
                }
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none uppercase"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !searchId.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-6 rounded-xl font-medium min-w-[100px]"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              ) : (
                "Search"
              )}
            </button>
          </form>
        </section>

        {error && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 p-4 rounded-xl border border-red-100">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 text-green-600 bg-green-50 p-4 rounded-xl border border-green-100">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <p>{success}</p>
          </div>
        )}

        {attendee && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-6 text-white shadow-lg">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-blue-100 text-xs font-medium uppercase tracking-wider">
                    {attendee.type} Wallet
                  </p>
                  <h2 className="text-2xl font-bold">{attendee.id}</h2>
                </div>
                <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                  <Wallet className="w-6 h-6" />
                </div>
              </div>
              <div>
                <p className="text-blue-200 text-sm mb-1">Available Balance</p>
                <h3 className="text-4xl font-bold">
                  ₹{attendee.remainingBalance}
                </h3>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                <h3 className="font-semibold text-gray-900">Transaction</h3>
                <span className="text-xs font-medium text-gray-500 bg-gray-200 px-2 py-1 rounded-full">
                  {cart.length} items
                </span>
              </div>

              <div className="p-4 space-y-6">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { name: "Thanda", price: 10 },
                    { name: "Snacks", price: 20 },
                    { name: "Campa", price: 10 },
                    { name: "Chips", price: 10 },
                  ].map((prod) => (
                    <button
                      key={prod.name}
                      onClick={() => handleAddProduct(prod.name, prod.price)}
                      className="flex flex-col items-center justify-center p-4 rounded-xl border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-all active:scale-95"
                    >
                      <span className="font-medium text-gray-700">
                        {prod.name}
                      </span>
                      <span className="text-blue-600 font-bold">
                        ₹{prod.price}
                      </span>
                    </button>
                  ))}
                </div>

                {cart.length > 0 && (
                  <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                    <div className="flex justify-between items-center text-sm text-gray-500">
                      <span>Cart Summary</span>
                      <button
                        onClick={() => setCart([])}
                        className="text-red-500 font-medium"
                      >
                        Clear
                      </button>
                    </div>
                    <div className="space-y-3">
                      {cart.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between bg-white border border-gray-200 p-3 rounded-xl"
                        >
                          <div className="flex flex-col">
                            <span className="font-medium text-gray-900">
                              {item.name}
                            </span>
                            <span className="text-xs text-gray-500">
                              ₹{item.price} each
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => handleRemoveProduct(item.name)}
                              className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                            >
                              -
                            </button>
                            <span className="font-semibold w-5 text-center">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => handleAddProduct(item.name, item.price)}
                              className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="pt-2 border-t border-gray-200 flex justify-between items-center">
                      <span className="font-semibold text-gray-900 text-lg">
                        Total
                      </span>
                      <span className="font-bold text-blue-600 text-xl">
                        ₹{cartTotal}
                      </span>
                    </div>
                  </div>
                )}

                <button
                  onClick={startTransaction}
                  disabled={
                    cartTotal === 0 || cartTotal > attendee.remainingBalance
                  }
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all text-lg shadow-md active:scale-[0.98]"
                >
                  Confirm Deduction
                </button>
                {cartTotal > attendee.remainingBalance && (
                  <p className="text-red-500 text-sm text-center">
                    Insufficient balance!
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Undo Overlay */}
      {undoTimer > 0 && pendingTx && (
        <div className="fixed bottom-6 left-4 right-4 z-50 animate-in slide-in-from-bottom-full duration-300">
          <div className="bg-gray-900 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between border border-gray-800">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 flex items-center justify-center">
                <svg className="w-10 h-10 -rotate-90">
                  <circle
                    cx="20"
                    cy="20"
                    r="18"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    className="text-gray-700"
                  />
                  <circle
                    cx="20"
                    cy="20"
                    r="18"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeDasharray="113"
                    strokeDashoffset={113 - (113 * undoTimer) / 5}
                    className="text-blue-500 transition-all duration-1000"
                  />
                </svg>
                <span className="absolute font-bold text-sm">{undoTimer}</span>
              </div>
              <div>
                <p className="font-medium">Deducting ₹{pendingTx.amount}</p>
                <p className="text-xs text-gray-400">
                  Processing in {undoTimer}s...
                </p>
              </div>
            </div>
            <button
              onClick={handleUndo}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl font-bold transition-colors"
            >
              <RotateCcw className="w-4 h-4" /> Undo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
