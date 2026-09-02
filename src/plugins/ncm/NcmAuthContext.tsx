import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getLoginStatus, logout as apiLogout, setLoginCookie } from './api';

type NcmAuthValue = {
  nickname: string | null;
  logged: boolean;
  refresh: () => Promise<boolean>;
  login: (cookie: string) => Promise<void>;
  logout: () => Promise<void>;
  validateForDownload: () => Promise<boolean>;
};

const NcmAuthContext = createContext<NcmAuthValue | null>(null);

export function NcmAuthProvider({ children }: { children: ReactNode }) {
  const [nickname, setNickname] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<boolean> => {
    try {
      const status = await getLoginStatus();
      setNickname(status.nickname);
      return status.nickname !== null;
    } catch {
      setNickname(null);
      return false;
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (cookie: string) => {
    await setLoginCookie(cookie);
    const status = await getLoginStatus();
    if (!status.nickname) throw new Error('未能确认登录账号，请刷新二维码后重试');
    setNickname(status.nickname);
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setNickname(null);
  }, []);

  const validateForDownload = useCallback(async (): Promise<boolean> => {
    const valid = await refresh();
    return valid;
  }, [refresh]);

  const value = useMemo<NcmAuthValue>(() => ({
    nickname,
    logged: nickname !== null,
    refresh,
    login,
    logout,
    validateForDownload,
  }), [nickname, refresh, login, logout, validateForDownload]);

  return <NcmAuthContext.Provider value={value}>{children}</NcmAuthContext.Provider>;
}

export function useNcmAuth(): NcmAuthValue {
  const ctx = useContext(NcmAuthContext);
  if (!ctx) throw new Error('useNcmAuth must be used within NcmAuthProvider');
  return ctx;
}
