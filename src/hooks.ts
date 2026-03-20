import { useState, useCallback, useEffect } from 'react';

/**
 * Generic CRUD hook for managing arrays of items with id-based operations
 * Eliminates repetitive add/update/remove patterns
 */
export function useCRUD<T extends { id: string }>(initialArray: T[] = []) {
  const [items, setItems] = useState<T[]>(initialArray);

  const add = useCallback((item: Omit<T, 'id'>) => {
    setItems((prev) => [...prev, { ...item, id: crypto.randomUUID() } as T]);
  }, []);

  const update = useCallback((id: string, updatedItem: T) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...updatedItem, id } : item)));
  }, []);

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  return { items, add, update, remove, setItems };
}

/**
 * Hook for managing form state with cleaner field updates
 * Reduces boilerplate from setFormData({...formData, field: value})
 * to simply updateField(field, value)
 */
export function useFormState<T>(initialState: T) {
  const [state, setState] = useState<T>(initialState);

  const updateField = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setState((prev) => ({ ...prev, [field]: value }));
  }, []);

  const updateMultiple = useCallback((updates: Partial<T>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const reset = useCallback(() => {
    setState(initialState);
  }, [initialState]);

  return { state, updateField, updateMultiple, reset, setState };
}

/**
 * Hook for managing localStorage with automatic serialization and error handling
 * Provides abstraction layer for easy migration to other storage mechanisms
 */
export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Failed to load ${key} from localStorage:`, error);
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        const valueToStore = value instanceof Function ? value(storedValue) : value;
        setStoredValue(valueToStore);
        localStorage.setItem(key, JSON.stringify(valueToStore));
      } catch (error) {
        console.error(`Failed to save ${key} to localStorage:`, error);
      }
    },
    [key, storedValue],
  );

  const removeValue = useCallback(() => {
    try {
      localStorage.removeItem(key);
      setStoredValue(initialValue);
    } catch (error) {
      console.error(`Failed to remove ${key} from localStorage:`, error);
    }
  }, [key, initialValue]);

  return [storedValue, setValue, removeValue] as const;
}

/**
 * Hook for loading fonts dynamically with error handling
 * Prevents layout shift and provides fallback support
 */
export function useFontLoader(fontUrl: string) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!fontUrl) return;

    const link = document.createElement('link');
    link.href = fontUrl;
    link.rel = 'stylesheet';

    const handleLoad = () => {
      setLoaded(true);
    };

    const handleError = () => {
      setError(`Failed to load font from ${fontUrl}`);
      console.error(`Font load error: ${fontUrl}`);
    };

    link.addEventListener('load', handleLoad);
    link.addEventListener('error', handleError);
    document.head.appendChild(link);

    return () => {
      link.removeEventListener('load', handleLoad);
      link.removeEventListener('error', handleError);
      document.head.removeChild(link);
    };
  }, [fontUrl]);

  return { loaded, error };
}
