import { useRef, useEffect } from "react";

function useLatest<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;

  return ref;
}

const useUnmount = (fn: () => void) => {
  const fnRef = useLatest(fn);
  useEffect(
    () => () => {
      fnRef.current();
    },
    []
  );
};

export default useUnmount;
