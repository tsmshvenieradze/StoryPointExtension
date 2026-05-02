// tests/field/FieldResolver.test.ts — Source: D-30 (CONTEXT.md);
// FIELD-01, FIELD-02, FIELD-03 (REQUIREMENTS.md).
//
// Layout follows tests/audit/parseLatest.test.ts (factory at top + behavior
// describe blocks) and tests/calc/calcEngine.test.ts (barrel-export
// assertion at bottom). No SDK mock — hand-rolled fake form service per
// CONTEXT.md "no mocks for SDK in unit tests" rule.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resolve, _resetCacheForTests } from '../../src/field/FieldResolver';
import * as fieldBarrel from '../../src/field/index';

const STORY_POINTS = "Microsoft.VSTS.Scheduling.StoryPoints";
const SIZE = "Microsoft.VSTS.Scheduling.Size";

/**
 * Hand-rolled fake form service. Returns the minimal Pick<IWorkItemFormService,
 * "getFields"> shape. WorkItemField at runtime has many fields; we ship only
 * referenceName + isDeleted because that's all FieldResolver reads.
 */
const makeFakeFormService = (
  refNames: string[],
  shouldThrow = false,
  deletedRefs: Set<string> = new Set(),
) => ({
  getFields: vi.fn().mockImplementation(() => {
    if (shouldThrow) {
      return Promise.reject(new Error("getFields failed"));
    }
    return Promise.resolve(
      refNames.map((rn) => ({
        referenceName: rn,
        isDeleted: deletedRefs.has(rn),
      })),
    );
  }),
});

beforeEach(() => {
  _resetCacheForTests();
});

describe('FieldResolver: priority lookup (FIELD-01, FIELD-02)', () => {
  it('returns StoryPoints when StoryPoints is present', async () => {
    const formService = makeFakeFormService([STORY_POINTS, "System.Title"]);
    const result = await resolve({
      formService,
      projectId: "p1",
      workItemTypeName: "User Story",
    });
    expect(result).toBe(STORY_POINTS);
    expect(formService.getFields).toHaveBeenCalledTimes(1);
  });

  it('falls back to Size when StoryPoints absent (CMMI)', async () => {
    const formService = makeFakeFormService([SIZE, "System.Title"]);
    const result = await resolve({
      formService,
      projectId: "p1",
      workItemTypeName: "Requirement",
    });
    expect(result).toBe(SIZE);
  });

  it('returns null when both absent', async () => {
    const formService = makeFakeFormService(["System.Title", "System.State"]);
    const result = await resolve({
      formService,
      projectId: "p1",
      workItemTypeName: "Test Plan",
    });
    expect(result).toBeNull();
  });

  it('prefers StoryPoints over Size when both present (priority order)', async () => {
    const formService = makeFakeFormService([SIZE, STORY_POINTS, "System.Title"]);
    const result = await resolve({
      formService,
      projectId: "p1",
      workItemTypeName: "Hybrid",
    });
    expect(result).toBe(STORY_POINTS);
  });
});

describe('FieldResolver: cache (FIELD-03)', () => {
  it('caches by (projectId, workItemTypeName); second call does not re-probe', async () => {
    const formService = makeFakeFormService([STORY_POINTS]);
    await resolve({ formService, projectId: "p1", workItemTypeName: "User Story" });
    await resolve({ formService, projectId: "p1", workItemTypeName: "User Story" });
    expect(formService.getFields).toHaveBeenCalledTimes(1);
  });

  it('different projectId triggers re-probe', async () => {
    const formService = makeFakeFormService([STORY_POINTS]);
    await resolve({ formService, projectId: "p1", workItemTypeName: "User Story" });
    await resolve({ formService, projectId: "p2", workItemTypeName: "User Story" });
    expect(formService.getFields).toHaveBeenCalledTimes(2);
  });

  it('different workItemTypeName triggers re-probe', async () => {
    const formService = makeFakeFormService([STORY_POINTS]);
    await resolve({ formService, projectId: "p1", workItemTypeName: "User Story" });
    await resolve({ formService, projectId: "p1", workItemTypeName: "Bug" });
    expect(formService.getFields).toHaveBeenCalledTimes(2);
  });
});

describe('FieldResolver: failure modes (D-20)', () => {
  it('defaults to StoryPoints when getFields() throws', async () => {
    const formService = makeFakeFormService([], true);
    const result = await resolve({
      formService,
      projectId: "p1",
      workItemTypeName: "User Story",
    });
    expect(result).toBe(STORY_POINTS);
  });

  it('caches the StoryPoints fallback so a retry does not re-throw', async () => {
    const formService = makeFakeFormService([], true);
    await resolve({ formService, projectId: "p1", workItemTypeName: "User Story" });
    const second = await resolve({
      formService,
      projectId: "p1",
      workItemTypeName: "User Story",
    });
    expect(second).toBe(STORY_POINTS);
    expect(formService.getFields).toHaveBeenCalledTimes(1); // cache hit on second call
  });
});

describe('FieldResolver: defensive isDeleted filter', () => {
  it('excludes isDeleted: true fields from resolution', async () => {
    const formService = makeFakeFormService(
      [STORY_POINTS, SIZE],
      false,
      new Set([STORY_POINTS]), // soft-deleted variant
    );
    const result = await resolve({
      formService,
      projectId: "p1",
      workItemTypeName: "User Story",
    });
    expect(result).toBe(SIZE);
  });
});

describe('public API barrel (D-21)', () => {
  it('src/field/index.ts re-exports resolve', () => {
    expect(typeof fieldBarrel.resolve).toBe('function');
  });
});
