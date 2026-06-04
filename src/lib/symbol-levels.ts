import { z } from "zod";
import {
  SUPPORTED_SYMBOLS,
  SYMBOL_LEVEL_TYPES,
  type SupportedSymbol,
  type SymbolLevelType,
} from "@/lib/rules/types";

export type SavedSymbolLevel = {
  id: string;
  symbol: SupportedSymbol;
  name: string;
  price: number;
  levelType: SymbolLevelType;
  notes?: string;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  isExpired: boolean;
};

export type SymbolLevelInput = {
  symbol: SupportedSymbol;
  name: string;
  price: number;
  levelType: SymbolLevelType;
  notes?: string;
  expiresAt?: string | null;
};

const optionalDateTime = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((value) => (value ? value : null))
  .refine((value) => value === null || !Number.isNaN(new Date(value).getTime()), {
    message: "Expiration must be a valid date.",
  })
  .transform((value) => (value ? new Date(value).toISOString() : null));

export const symbolLevelCreateSchema = z.object({
  symbol: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .refine((value): value is SupportedSymbol => SUPPORTED_SYMBOLS.includes(value as SupportedSymbol), {
      message: "Choose a supported symbol.",
    }),
  name: z.string().trim().min(1, "Name is required.").max(80, "Name is too long."),
  price: z.coerce.number().positive("Price must be greater than 0."),
  levelType: z.enum(SYMBOL_LEVEL_TYPES, { errorMap: () => ({ message: "Choose a valid level type." }) }),
  notes: z
    .string()
    .trim()
    .max(500, "Notes are too long.")
    .optional()
    .transform((value) => (value ? value : undefined)),
  expiresAt: optionalDateTime,
});

export const symbolLevelUpdateSchema = symbolLevelCreateSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: "Provide at least one level field to update." },
);

export function isLevelExpired(expiresAt: string | null, now = new Date()) {
  return expiresAt ? new Date(expiresAt).getTime() <= now.getTime() : false;
}

export function assertSupportedLevelSymbol(symbol: SupportedSymbol) {
  if (!SUPPORTED_SYMBOLS.includes(symbol)) throw new Error("Unsupported symbol.");
}

export function assertValidLevelPrice(price: number) {
  if (!Number.isFinite(price) || price <= 0) throw new Error("Price must be greater than 0.");
}

export function assertValidLevelType(levelType: SymbolLevelType) {
  if (!SYMBOL_LEVEL_TYPES.includes(levelType)) throw new Error("Unsupported level type.");
}
