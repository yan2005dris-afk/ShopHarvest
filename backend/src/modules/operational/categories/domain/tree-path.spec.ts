import {
  ancestorIdsOf,
  buildCategoryPath,
  wouldCreateCycle,
} from './tree-path';

describe('tree-path helpers', () => {
  describe('buildCategoryPath()', () => {
    it('collapses to selfId for root nodes', () => {
      expect(buildCategoryPath('', 'cat_root', null)).toBe('cat_root');
    });

    it('composes `${parent.path}/${self.id}` for child nodes', () => {
      expect(buildCategoryPath('cat_parent', 'cat_child', 'cat_parent')).toBe(
        'cat_parent/cat_child',
      );
    });

    it('ignores a stale parentPath for root nodes (parentId=null wins)', () => {
      expect(buildCategoryPath('stale', 'cat_root', null)).toBe('cat_root');
    });
  });

  describe('ancestorIdsOf()', () => {
    it('returns [] for root nodes (path === selfId)', () => {
      expect(ancestorIdsOf('cat_root', 'cat_root')).toEqual([]);
    });

    it('returns [] for empty path (defensive default)', () => {
      expect(ancestorIdsOf('', 'cat_root')).toEqual([]);
    });

    it('excludes the node itself from the chain', () => {
      expect(ancestorIdsOf('cat_a/cat_b/cat_c', 'cat_c')).toEqual([
        'cat_a',
        'cat_b',
      ]);
    });

    it('preserves order from root to direct parent', () => {
      expect(ancestorIdsOf('a/b/c/d', 'd')).toEqual(['a', 'b', 'c']);
    });
  });

  describe('wouldCreateCycle()', () => {
    const self = {
      id: 'cat_self',
      parentId: 'cat_p',
      path: 'cat_p/cat_self',
    };

    it('flags self as cycle candidate', () => {
      expect(
        wouldCreateCycle(self, {
          id: 'cat_self',
          parentId: null,
          path: 'cat_p/cat_self',
        }),
      ).toBe(true);
    });

    it('flags descendant as cycle candidate via path prefix', () => {
      expect(
        wouldCreateCycle(self, {
          id: 'cat_descendant',
          parentId: 'cat_self',
          path: 'cat_p/cat_self/cat_descendant',
        }),
      ).toBe(true);
    });

    it('allows a sibling as new parent', () => {
      expect(
        wouldCreateCycle(self, {
          id: 'cat_sibling',
          parentId: 'cat_p',
          path: 'cat_p/cat_sibling',
        }),
      ).toBe(false);
    });

    it('allows an unrelated root as new parent', () => {
      expect(
        wouldCreateCycle(self, {
          id: 'cat_other',
          parentId: null,
          path: 'cat_other',
        }),
      ).toBe(false);
    });

    it('treats an empty candidate path as safe (unreparented / fresh node)', () => {
      expect(
        wouldCreateCycle(self, {
          id: 'cat_other',
          parentId: null,
          path: '',
        }),
      ).toBe(false);
    });
  });
});
