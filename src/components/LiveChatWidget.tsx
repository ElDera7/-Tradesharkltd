import React, { useEffect } from 'react';
import { useBrokerage } from '../context/BrokerageContext';

/**
 * LiveChatWidget — user identification only.
 *
 * The Tawk.to widget script is already embedded directly in index.html,
 * so it loads unconditionally on every page, every time, without needing
 * any API call or React state.
 *
 * This component's only job is to pass the logged-in user's name/email
 * to Tawk.to so the support agent knows who they're speaking with.
 */
export const LiveChatWidget: React.FC = () => {
  const { currentUser } = useBrokerage();

  useEffect(() => {
    if (!currentUser) return;

    // Wait for Tawk.to API to be ready then pass user identity
    const identify = () => {
      try {
        const Tawk = (window as any).Tawk_API;
        if (Tawk?.setAttributes) {
          Tawk.setAttributes(
            {
              name: currentUser.name,
              email: currentUser.email,
              hash: currentUser.id,
            },
            () => undefined
          );
        }
      } catch {
        // ignore — widget not ready yet
      }
    };

    // If Tawk is already loaded, identify immediately
    if ((window as any).Tawk_API?.setAttributes) {
      identify();
    } else {
      // Otherwise wait for onLoad callback
      (window as any).Tawk_API = (window as any).Tawk_API || {};
      const prev = (window as any).Tawk_API.onLoad;
      (window as any).Tawk_API.onLoad = function () {
        identify();
        if (typeof prev === 'function') prev();
      };
    }
  }, [currentUser]);

  return null;
};
