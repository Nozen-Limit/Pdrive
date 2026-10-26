import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useState,
} from "react";
export const Operations = createContext<
  (key: string, working: boolean) => void
>(() => {});
export function useBusy(): [boolean, (value: boolean) => void] {
  const [busy, update] = useState(false),
    key = useId(),
    lock = useContext(Operations);
  const set = useCallback(
    (value: boolean) => {
      lock(key, value);
      update(value);
    },
    [key, lock],
  );
  useEffect(() => () => lock(key, false), [key, lock]);
  return [busy, set];
}
