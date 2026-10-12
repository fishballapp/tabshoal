import { assert, describe, expect, expectTypeOf, it } from 'vitest';
import { tryCatch } from './tryCatch';

class MagicError extends Error {}

describe('sync', () => {
  it('should catch all throws', () => {
    (() => {
      const [result, error] = tryCatch.sync(() => {
        throw new Error('hi');
      });
      expect(result).toBeUndefined();
      assert(error instanceof Error);
      expect(error?.message).toBe('hi');
    })();

    (() => {
      const [result, error] = tryCatch.sync(() => {
        throw 3;
      });
      expect(result).toBeUndefined();
      expect(error).toBe(3);
    })();
  });

  it('should return result', () => {
    const [result, error] = tryCatch.sync(() => {
      return 'hello world';
    });
    expect(result).toBe('hello world');
    expect(error).toBeUndefined();
  });

  it('should catch only known errors', () => {
    expect(() =>
      tryCatch.sync(() => {
        throw new Error('abc');
      }, [MagicError]),
    ).toThrow('abc');

    const err = new MagicError();
    const [, error] = tryCatch.sync(() => {
      throw err;
    }, [MagicError]);

    expect(error).toBe(err);

    const [result] = tryCatch.sync(() => {
      return 3;
    }, [MagicError]);
    expect(result).toBe(3);
  });
});

describe('async', () => {
  it('should catch all errors', async () => {
    await Promise.all([
      (async () => {
        const [result, error] = await tryCatch.async(async () => {
          throw new Error('hi');
        });
        expect(result).toBeUndefined();
        assert(error instanceof Error);
        expect(error?.message).toBe('hi');
      })(),
      (async () => {
        const [result, error] = await tryCatch.async(async () => {
          throw 3;
        });
        expect(result).toBeUndefined();
        expect(error).toBe(3);
      })(),
    ]);
  });

  it('should return result', async () => {
    const [result, error] = await tryCatch.async(async () => {
      return 'hello world';
    });
    expect(result).toBe('hello world');
    expect(error).toBeUndefined();
  });

  it('should catch only known errors', async () => {
    await expect(
      async () =>
        await tryCatch.async(() => {
          throw new Error('abc');
        }, [MagicError]),
    ).rejects.toThrow('abc');

    const err = new MagicError();
    const [result1, error] = await tryCatch.async(() => {
      throw err;
    }, [MagicError]);
    expectTypeOf(error).toExtend<MagicError | undefined>();
    assert(result1 === undefined);
    expectTypeOf(error).toExtend<MagicError>();
    expect(error).toBe(err);

    const [result] = await tryCatch.async(async () => {
      return 3;
    }, [MagicError]);
    assert(result !== undefined);
    expectTypeOf(result).toExtend<number>();
    expect(result).toBe(3);
  });
});
