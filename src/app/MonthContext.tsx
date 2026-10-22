import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { YearMonth } from "../types";
import { currentMonth } from "../utils/date";

interface MonthContextValue {
  month: YearMonth;
  setMonth: (month: YearMonth) => void;
}

const MonthContext = createContext<MonthContextValue | null>(null);

export function MonthProvider({
  children,
  initialMonth,
}: {
  children: ReactNode;
  initialMonth?: YearMonth;
}) {
  const [month, setMonth] = useState<YearMonth>(initialMonth ?? currentMonth());
  const value = useMemo(() => ({ month, setMonth }), [month]);
  return (
    <MonthContext.Provider value={value}>{children}</MonthContext.Provider>
  );
}

export function useSelectedMonth(): MonthContextValue {
  const ctx = useContext(MonthContext);
  if (!ctx)
    throw new Error(
      "useSelectedMonth trebuie folosit în interiorul MonthProvider",
    );
  return ctx;
}
