import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchCatalog, selectCatalog } from '../features/catalog/catalogSlice.js';
import { fallbackPackages } from '../content/packages.js';

// Packages from the API when there are any; otherwise the built-in display copy so the section is never empty.
export default function usePackages() {
  const dispatch = useDispatch();
  const { packages, status, error } = useSelector(selectCatalog);
  useEffect(() => {
    if (status === 'idle') dispatch(fetchCatalog());
  }, [dispatch, status]);
  const live = status === 'ready' && packages.length > 0;
  return { packages: live ? packages : fallbackPackages, usingFallback: !live, status, error };
}
