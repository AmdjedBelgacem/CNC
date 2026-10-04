'use client';
import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '@/stores/auth-store';
import { api } from '@/lib/api-client';
export function useAuth() {
  // This hook returns `...store`, so consumers destructure state from it and a
  // narrow selector is not an option for the returned value.
  //
  // Reading the store without a selector subscribes to the whole state, so any
  // write re-rendered every consumer — the `` `set` is expensive and may cause
  // unnecessary re-renders `` warning. It was also worse than noise: `store` was
  // a `useCallback` dependency, so its identity changed on every write and gave
  // every callback below a new identity, cascading re-renders into everything
  // that used them. `useShallow` compares the top-level fields, so the object
  // is referentially stable unless something actually changed.
  const store = useAuthStore(useShallow((s) => s));

  // The actions are created once in the store, so selecting them directly gives
  // the callbacks below stable dependencies.
  const setAuth = useAuthStore((s) => s.setAuth);
  const logoutStore = useAuthStore((s) => s.logout);
  const updateUser = useAuthStore((s) => s.updateUser);
  const setTwoFactorRequired = useAuthStore((s) => s.setTwoFactorRequired);
  const router = useRouter();
  const login = useCallback(
    async (email: string, password: string, rememberDevice = false) => {
      /* Fetch CSRF token first for the login request */ await api.fetchCsrfToken();
      const res = await api.post<{
        user: any;
        twoFactorRequired?: boolean;
        accessToken?: string;
        refreshToken?: string;
      }>('/auth/login', { email, password, rememberDevice });
      if (res.twoFactorRequired) {
        setTwoFactorRequired(true);
        return { twoFactorRequired: true, userId: res.user.id };
      } /* New flow: tokens are httpOnly cookies, response contains only user */
      setAuth(res.user);
      return res;
    },
    [setAuth],
  );
  const register = useCallback(
    async (data: { email: string; password: string; name: string; username?: string }) => {
      return api.post('/auth/register', data);
    },
    [],
  );
  const verifyEmail = useCallback(async (token: string) => {
    return api.post('/auth/verify-email', { token });
  }, []);
  const resendVerification = useCallback(async (email: string) => {
    return api.post('/auth/resend-verification', { email });
  }, []);
  const forgotPassword = useCallback(async (email: string) => {
    return api.post('/auth/forgot-password', { email });
  }, []);
  const resetPassword = useCallback(async (token: string, password: string) => {
    return api.post('/auth/reset-password', { token, password });
  }, []);
  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    return api.post('/auth/change-password', { currentPassword, newPassword });
  }, []);
  const changeEmail = useCallback(async (newEmail: string, password: string) => {
    return api.post('/auth/change-email', { newEmail, password });
  }, []);
  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
    } finally {
      logoutStore();
      router.push('/login');
    }
  }, [logoutStore, router]);
  const logoutEverywhere = useCallback(async () => {
    try {
      await api.post('/auth/logout-everywhere');
    } catch {
    } finally {
      logoutStore();
      router.push('/login');
    }
  }, [logoutStore, router]);
  const refreshProfile = useCallback(async () => {
    try {
      const user = await api.get<any>('/auth/me');
      updateUser(user);
      return user;
    } catch {
      return null;
    }
  }, [store]);
  const getSessions = useCallback(async () => {
    return api.get<any[]>('/auth/sessions');
  }, []);
  const revokeSession = useCallback(async (sessionId: string) => {
    return api.post('/auth/sessions/revoke', { sessionId });
  }, []);
  const verify2fa = useCallback(
    async (userId: string, token: string, rememberDevice = false) => {
      const res = await api.post<{ verified: boolean; user?: any }>('/auth/2fa/verify', {
        userId,
        token,
        rememberDevice,
      });
      if (res.verified) {
        setTwoFactorRequired(
          false,
        ); /* After verify, cookies are set; fetch user to hydrate store */
        if (res.user) {
          setAuth(res.user);
        } else {
          try {
            const user = await api.get<any>('/auth/me');
            setAuth(user);
          } catch {}
        }
      }
      return res;
    },
    [store],
  );
  const setup2fa = useCallback(async () => {
    return api.post<{ secret: string; qrCode: string; otpauthUrl: string }>('/auth/2fa/setup');
  }, []);
  const enable2fa = useCallback(async (token: string, secret: string) => {
    return api.post<{ message: string; backupCodes: string[] }>('/auth/2fa/enable', {
      token,
      secret,
    });
  }, []);
  const disable2fa = useCallback(async (token: string) => {
    return api.post('/auth/2fa/disable', { token });
  }, []);
  const getOAuthAccounts = useCallback(async () => {
    return api.get<any[]>('/auth/oauth/accounts');
  }, []);
  const unlinkOAuth = useCallback(async (provider: string) => {
    return api.post('/auth/oauth/unlink', { provider });
  }, []);
  return {
    ...store,
    login,
    register,
    verifyEmail,
    resendVerification,
    forgotPassword,
    resetPassword,
    changePassword,
    changeEmail,
    logout,
    logoutEverywhere,
    refreshProfile,
    getSessions,
    revokeSession,
    verify2fa,
    setup2fa,
    enable2fa,
    disable2fa,
    getOAuthAccounts,
    unlinkOAuth,
  };
}
