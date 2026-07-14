import { RawCapture } from './raw-capture.entity';

export interface RawCapturesRepository {
  sourceExists(sourceId: string): Promise<boolean>;
  offerExists(offerId: string): Promise<boolean>;
  findByKey(offerId: string, sourceId: string): Promise<RawCapture | null>;
  findAll(sourceId?: string): Promise<RawCapture[]>;
  save(capture: RawCapture): Promise<RawCapture>;
  delete(offerId: string, sourceId: string): Promise<void>;
}

export const RAW_CAPTURES_REPOSITORY = Symbol('RawCapturesRepository');
