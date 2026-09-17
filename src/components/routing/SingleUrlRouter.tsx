import React, { useMemo, useState, useEffect, useCallback } from "react";
import {
  Router,
  createPath,
  parsePath,
  resolvePath,
  type Location,
  type To,
  type NavigationType,
} from "react-router-dom";

interface SingleUrlRouterProps {
  children: React.ReactNode;
  future?: {
    v7_startTransition?: boolean;
    v7_relativeSplatPath?: boolean;
  };
}

interface CustomHistoryState {
  internalPath: string;
  state: any;
  key: string;
}

const getInitialInternalPath = (): string => {
  if (typeof window === "undefined") return "/";

  // Check if history.state already recorded an internalPath from before reload
  const statePath = window.history.state?.internalPath;
  if (statePath && typeof statePath === "string") {
    return statePath;
  }

  // Otherwise, read from current window.location (e.g. if user opened /quotation or /?mode=procedure directly)
  const fullCurrent = window.location.pathname + window.location.search + window.location.hash;
  return fullCurrent || "/";
};

export const SingleUrlRouter: React.FC<SingleUrlRouterProps> = ({ children, future }) => {
  const [internalPath, setInternalPath] = useState<string>(() => getInitialInternalPath());
  const [navigationType, setNavigationType] = useState<NavigationType>("POP");
  const [locationKey, setLocationKey] = useState<string>(() => {
    return window.history.state?.key || Math.random().toString(36).slice(2, 10);
  });
  const [currentState, setCurrentState] = useState<any>(() => window.history.state?.state ?? null);

  // Parse internalPath into a standard react-router Location object
  const location: Location = useMemo(() => {
    const parsed = parsePath(internalPath);
    return {
      pathname: parsed.pathname || "/",
      search: parsed.search || "",
      hash: parsed.hash || "",
      state: currentState,
      key: locationKey,
    };
  }, [internalPath, currentState, locationKey]);

  // Normalize initial address bar strictly to '/' on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    const currentInternal = internalPath;
    const historyData: CustomHistoryState = {
      internalPath: currentInternal,
      state: currentState,
      key: locationKey,
    };

    // If pathname is not '/', immediately replace it with '/' while saving internal state
    if (window.location.pathname !== "/" || !window.history.state?.internalPath) {
      try {
        window.history.replaceState(historyData, "", "/");
      } catch (err) {
        console.warn("Unable to normalize single URL:", err);
      }
    }
  }, []);

  // Listen for browser Back and Forward button events (popstate)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handlePopState = (event: PopStateEvent) => {
      const historyData = event.state as CustomHistoryState | null;
      const targetInternalPath = historyData?.internalPath || "/";
      const targetState = historyData?.state ?? null;
      const targetKey = historyData?.key || Math.random().toString(36).slice(2, 10);

      // Keep address bar strictly at '/' if any external push caused it to drift
      if (window.location.pathname !== "/") {
        try {
          window.history.replaceState(historyData, "", "/");
        } catch {
          // ignore
        }
      }

      setInternalPath(targetInternalPath);
      setCurrentState(targetState);
      setLocationKey(targetKey);
      setNavigationType("POP");
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  // Build the custom Navigator required by react-router's <Router>
  const navigator = useMemo(() => {
    return {
      createHref: (to: To) => {
        return typeof to === "string" ? to : createPath(to);
      },
      encodeLocation: (to: To) => {
        return typeof to === "string" ? parsePath(to) : to;
      },
      push: (to: To, state?: any) => {
        const resolved = resolvePath(to, location.pathname);
        const nextPathString = createPath(resolved);
        const newKey = Math.random().toString(36).slice(2, 10);

        const historyData: CustomHistoryState = {
          internalPath: nextPathString,
          state: state ?? null,
          key: newKey,
        };

        // Push new entry to browser history while keeping URL strictly '/'
        window.history.pushState(historyData, "", "/");

        setInternalPath(nextPathString);
        setCurrentState(state ?? null);
        setLocationKey(newKey);
        setNavigationType("PUSH");
      },
      replace: (to: To, state?: any) => {
        const resolved = resolvePath(to, location.pathname);
        const nextPathString = createPath(resolved);
        const newKey = Math.random().toString(36).slice(2, 10);

        const historyData: CustomHistoryState = {
          internalPath: nextPathString,
          state: state ?? null,
          key: newKey,
        };

        // Replace current entry in browser history while keeping URL strictly '/'
        window.history.replaceState(historyData, "", "/");

        setInternalPath(nextPathString);
        setCurrentState(state ?? null);
        setLocationKey(newKey);
        setNavigationType("REPLACE");
      },
      go: (delta: number) => {
        window.history.go(delta);
      },
      back: () => {
        window.history.back();
      },
      forward: () => {
        window.history.forward();
      },
    };
  }, [location.pathname]);

  return (
    <Router
      location={location}
      navigationType={navigationType}
      navigator={navigator}
      future={future as any}
    >
      {children}
    </Router>
  );
};
