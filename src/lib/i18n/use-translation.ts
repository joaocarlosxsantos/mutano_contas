"use client";

import { useLocale } from "./context";
import { getTranslator } from "./dictionaries";

export function useTranslation() { return getTranslator(useLocale()); }
