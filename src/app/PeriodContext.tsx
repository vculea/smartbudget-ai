import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Period } from "../types";
import { currentMonth } from "../utils/date";

interface PeriodContextValue {
  /** Luna (`YYYY-MM`) sau anul (`YYYY`) selectat. */
  period: Period;
  setPeriod: (period: Period) => void;
}

const PeriodContext = createContext<PeriodContextValue | null>(null);

export function PeriodProvider({
  children,
  initialPeriod,
}: {
  children: ReactNode;
  initialPeriod?: Period;
}) {
  const [period, setPeriod] = useState<Period>(initialPeriod ?? currentMonth());
  const value = useMemo(() => ({ period, setPeriod }), [period]);
  return (
    <PeriodContext.Provider value={value}>{children}</PeriodContext.Provider>
  );
}

export function useSelectedPeriod(): PeriodContextValue {
  const ctx = useContext(PeriodContext);
  if (!ctx)
    throw new Error(
      "useSelectedPeriod trebuie folosit în interiorul PeriodProvider",
    );
  return ctx;
}
