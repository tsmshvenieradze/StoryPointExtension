// src/audit/types.ts — Source: D-19; structural type avoids importing azure-devops-extension-api
import type { Level } from '../calc/levels';
import type { FibonacciSp } from '../calc/fibonacci';

export type AuditPayload = {
  sp: FibonacciSp;
  c: Level;
  u: Level;
  e: Level;
  schemaVersion: 1;
};

/**
 * Structural shape mirroring ADO's WorkItemComment for the fields we care about.
 * Phase 4 maps the real `Comment` type from `azure-devops-extension-api/WorkItemTracking`
 * onto this shape at the boundary; Phase 1 stays SDK-free per D-26.
 */
export type AdoComment = {
  id: number;
  text: string;
  createdDate: string;     // ISO 8601
  isDeleted?: boolean;
};
