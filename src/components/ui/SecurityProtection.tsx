'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import DisableDevtool from 'disable-devtool';

export default function SecurityProtection() {
  const pathname = usePathname();
  const { isAdmin, canMaintain } = useAuth();

  useEffect(() => {
    // 1. DO NOT apply security on Admin Panel (/admin) or for Admin / Editor users
    if (pathname?.startsWith('/admin') || isAdmin || canMaintain) {
      return;
    }

    // 2. Safely detect mobile / iPhone / iOS / Android browsers to prevent iOS Safari performance issues or false positive loops
    const isMobile = /iPhone|iPad|iPod|Android|Mobile|Tablet/i.test(
      typeof navigator !== 'undefined' ? navigator.userAgent : ''
    );

    // Initialize DisableDevtool on desktop devices only
    if (!isMobile) {
      try {
        DisableDevtool({
          url: 'about:blank',
          disableMenu: true,
          clearLog: true,
          disableSelect: false, // Let CSS/DOM control selection on specific elements
          disableCopy: false,
          disableCut: false,
          disablePaste: false,
          interval: 500, // Safe interval for smooth performance
          disableIframeParents: true,
          ondevtoolopen: () => {
            window.location.href = 'about:blank';
          },
        });
      } catch (err) {
        console.warn('Devtool protection init info:', err);
      }
    }

    // 3. Block View Source (Ctrl+U), Save Page (Ctrl+S), Print (Ctrl+P), Inspect Shortcuts (F12, Ctrl+Shift+I/J/C)
    const handleKeyDown = (e: KeyboardEvent) => {
      // Always allow typing and shortcuts inside form input fields & textareas
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      const key = e.key ? e.key.toLowerCase() : '';
      const ctrlOrCmd = e.ctrlKey || e.metaKey;

      // Block Ctrl+U (View Source), Ctrl+S (Save), Ctrl+P (Print)
      if (ctrlOrCmd && (key === 'u' || key === 's' || key === 'p')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Block F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C (DevTools)
      if (
        e.key === 'F12' ||
        (ctrlOrCmd && e.shiftKey && (key === 'i' || key === 'j' || key === 'c'))
      ) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    // 4. Disable Context Menu (Right Click) for non-input elements
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('contextmenu', handleContextMenu, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('contextmenu', handleContextMenu, true);
      try {
        if (DisableDevtool && typeof DisableDevtool.isDevToolOpened === 'function') {
          // Clean up if supported
        }
      } catch {}
    };
  }, [pathname, isAdmin, canMaintain]);

  return null;
}
