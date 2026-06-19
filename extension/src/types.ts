// ─── Field definitions (user-defined, fully dynamic) ────────────────────────

/** Field name is now a free string — user defines their own. */
export type CanonicalField = string;

export interface FieldMapping {
  canonicalField: CanonicalField;
  selector: string;
  type: 'text' | 'attribute' | 'html';
  attribute?: string;
}

/** A field definition the user adds in the popup before mapping. */
export interface FieldDefinition {
  name: string;       // e.g. "titulo", "descripcion", "precio"
  type: 'text' | 'attribute' | 'html';
  attribute?: string; // e.g. "src", "href" — only used when type=attribute
  required?: boolean;
}

// ─── Domain rule (stored in backend) ────────────────────────────────────────

export interface DomainRule {
  domain: string;
  containerSelector: string;
  fieldMappings: FieldMapping[];
  createdAt: number;
  updatedAt: number;
}

export interface ExtractedProduct {
  [key: string]: string | number | null;
}

// ─── Storage ────────────────────────────────────────────────────────────────

export interface StorageData {
  rules: Record<string, DomainRule>;
  products: Record<string, ExtractedProduct[]>;
}

// ─── Messaging ──────────────────────────────────────────────────────────────

export type MessageType =
  | 'GET_RULE'
  | 'SAVE_RULE'
  | 'GET_RULES'
  | 'SAVE_PRODUCTS'
  | 'GET_PRODUCTS'
  | 'DELETE_RULE'
  | 'CLEAR_PRODUCTS'
  | 'START_MAPPING'
  | 'STOP_MAPPING'
  | 'EXTRACT'
  | 'GET_PAGE_INFO'
  | 'FIELD_ASSIGNED'
  | 'MAPPING_COMPLETE'
  | 'MAPPING_CANCELLED';

export interface Message {
  type: MessageType;
  payload?: unknown;
}

// ── Port-based frontend ↔ extension communication ───────────────────────────

export type PortInboundType = 'OPEN_MAPPER';
export type PortOutboundType =
  | 'FIELD_ASSIGNED'
  | 'MAPPING_COMPLETE'
  | 'MAPPING_CANCELLED'
  | 'MAPPING_ERROR';

export interface PortInbound {
  type: PortInboundType;
  payload?: unknown;
}

export interface PortOutbound {
  type: PortOutboundType;
  payload?: unknown;
}

export interface MappingSession {
  scrapingTabId: number;
  port: chrome.runtime.Port;
  mappings: Record<string, FieldMapping>;
}
