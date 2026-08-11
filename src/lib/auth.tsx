import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

// Single-user credentials (ตามที่ผู้ใช้ระบุ)
const ADMIN_USER = "admin";
const ADMIN_PASSWORD = "admin123";

const STORAGE_KEY = "puithai_auth";

interface AuthState {
  isAuthenticated: boolean;
  user: string | null;
}

interface AuthContextValue extends AuthState {
  /** true เมื่ออ่าน localStorage หลัง mount เสร็จแล้ว — ก่อนหน้านั้นยังไม่รู้สถานะจริง */
  ready: boolean;
  login: (user: string, password: string) => { ok: boolean; error?: string };
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStored(): AuthState {
  if (typeof window === "undefined") return { isAuthenticated: false, user: null };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { isAuthenticated: false, user: null };
    const parsed = JSON.parse(raw) as AuthState;
    if (parsed && typeof parsed.isAuthenticated === "boolean") return parsed;
    return { isAuthenticated: false, user: null };
  } catch {
    return { isAuthenticated: false, user: null };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // สำคัญ: ต้องเริ่มด้วยค่าเดียวกับที่ server render เสมอ (ห้ามอ่าน localStorage ที่นี่)
  // ไม่งั้น render แรกของ client จะไม่ตรงกับ HTML จาก server → hydration mismatch
  const [state, setState] = useState<AuthState>({ isAuthenticated: false, user: null });
  const [ready, setReady] = useState(false);

  // อ่าน localStorage หลัง mount แล้วค่อย re-render ด้วยสถานะจริง
  useEffect(() => {
    setState(readStored());
    setReady(true);
  }, []);

  const persist = useCallback((next: AuthState) => {
    setState(next);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ไม่มี localStorage ก็ข้ามไป */
      }
    }
  }, []);

  const login = useCallback(
    (user: string, password: string) => {
      if (user.trim() === ADMIN_USER && password === ADMIN_PASSWORD) {
        persist({ isAuthenticated: true, user: ADMIN_USER });
        return { ok: true };
      }
      return { ok: false, error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" };
    },
    [persist],
  );

  const logout = useCallback(() => {
    persist({ isAuthenticated: false, user: null });
  }, [persist]);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, ready, login, logout }),
    [state, ready, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth ต้องใช้ภายใน AuthProvider");
  return ctx;
}
