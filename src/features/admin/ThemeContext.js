import React, { createContext, useState, useEffect, useMemo } from 'react';

export const ThemeContext = createContext();

const themes = {
  light: '#ffffff',
  dark: '#1e1e1e',
  red: '#f19aeb',
  blue: '#a9def9',
  green: '#4dff88',
  brown: '#f4ccbb',
  lavender: '#c5a8ff',
  ocean: '#5e9ad9',
  peach: '#6d4c41',
};

export const ThemeProvider = ({ children }) => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  // Process Person tokens carry `type: processperson` and no role; they get their own
  // storage key so their id can never collide with an Executive's saved theme.
  const role = user?.type === 'processperson' ? 'processperson' : user?.role?.toLowerCase() || 'executive';
  const executiveId = localStorage.getItem('executiveId');
  const id = user?.id;

  // Memoize THEME_KEYS without role dependency
  const THEME_KEYS = useMemo(
    () => ({
      admin: `adminTheme_${executiveId || 'light'}`,
      executive: `executiveTheme_${id || 'light'}`,
      processperson: `processTheme_${id || 'light'}`,
    }),
    [executiveId, id]
  );

  const [theme, setTheme] = useState('light');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    const roleKey = THEME_KEYS[role] || 'theme';
    const savedTheme = localStorage.getItem(roleKey) || 'light';
    setTheme(savedTheme);
    applyTheme(savedTheme);

    const savedSidebarState = localStorage.getItem('sidebarOpen') !== 'false';
    setSidebarOpen(savedSidebarState);
  }, [THEME_KEYS, role]);

  const applyTheme = (themeKey) => {
    document.documentElement.setAttribute('data-theme', themeKey);
    // Example: document.body.style.backgroundColor = themes[themeKey] || themes.light;
  };

  const changeTheme = (themeKey) => {
    if (!themes[themeKey]) return;
    setTheme(themeKey);
    const roleKey = THEME_KEYS[role] || 'theme';
    localStorage.setItem(roleKey, themeKey);
    applyTheme(themeKey);
  };

  const toggleSidebar = () => {
    const newState = !sidebarOpen;
    setSidebarOpen(newState);
    localStorage.setItem('sidebarOpen', newState.toString());

    window.dispatchEvent(
      new CustomEvent('sidebarToggle', {
        detail: { open: newState },
      })
    );
  };

  const forceLightTheme = () => {
    changeTheme('light');
  };

  const resetTheme = () => {
    const roleKey = THEME_KEYS[role] || 'theme';
    localStorage.removeItem(roleKey);
    changeTheme('light');
  };

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    changeTheme(newTheme);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        changeTheme,
        toggleTheme,
        themes,
        sidebarOpen,
        toggleSidebar,
        resetTheme,
        forceLightTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};