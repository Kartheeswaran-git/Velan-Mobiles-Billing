import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase/client";
import { checkInStaff, ensureUserProfile } from "../supabase/database";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [authUser, setAuthUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function syncSession(sessionUser) {
      if (!mounted) return;
      setAuthUser(sessionUser);
      if (!sessionUser) {
        setProfile(null);
        setLoading(false);
        return;
      }

      const userProfile = await ensureUserProfile(sessionUser);
      if (!mounted) return;
      setProfile(userProfile);

      // Auto check-in for attendance
      checkInStaff();

      setLoading(false);
    }

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        setLoading(false);
        return;
      }
      syncSession(data.session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      syncSession(session?.user ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      user: profile ? { ...profile, uid: authUser?.id, email: authUser?.email } : null,
      authUser,
      loading,
      login: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          throw error;
        }
      },
      logout: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
          throw error;
        }
      },
    }),
    [authUser, loading, profile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
