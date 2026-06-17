export type CanonicalField = 'title' | 'price' | 'imageUrl' | 'sku' | 'currency' | 'description' | 'category' | 'container';

export interface FieldMapping {
  canonicalField: CanonicalField;
  selector: string;
  type: 'text' | 'attribute' | 'html';
  attribute?: string;
}

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

export interface StorageData {
  rules: Record<string, DomainRule>;
  products: Record<string, ExtractedProduct[]>;
}

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
  | 'FIELD_ASSIGNED';

export interface Message {
  type: MessageType;
  payload?: unknown;
}
