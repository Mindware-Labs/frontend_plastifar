import { useContext } from "react";
import { EmailCountsContext } from "./EmailCountsContext";

export function useEmailCounts() {
  return useContext(EmailCountsContext);
}
