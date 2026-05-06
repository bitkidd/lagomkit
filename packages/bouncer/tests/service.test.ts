import { describe, expect, test, vi } from 'vitest';

import { createBouncerService, definePolicy } from '#src/service.js';
import { MockPolicy, MockPolicy2 } from './_helpers.js';

describe('Bouncer::Service', () => {
  const service = createBouncerService();
  const mockPolicy = definePolicy({ handlers: MockPolicy });
  const mockPolicy2 = definePolicy({ handlers: MockPolicy2 });

  test('should return check method result', () => {
    expect(service.check(mockPolicy, 'authorized')).toEqual({ ok: true });
  });

  test('should return negative check method result', () => {
    expect(service.check(mockPolicy2, 'unauthorizedThrow')).toEqual({
      ok: false,
      message: 'Unauthorized action',
    });
  });

  test('should pass data to policy action', () => {
    expect(service.check(mockPolicy, 'withData', { hello: 'world' })).toEqual({
      ok: true,
    });
  });

  test('should throw on unknown action check', () => {
    expect(() =>
      service.check(mockPolicy, 'authorizedd' as keyof typeof MockPolicy),
    ).toThrow('Bouncer action "authorizedd" is not defined');
  });

  test('should execute authorize method', () => {
    expect(() => service.authorize(mockPolicy, 'unauthorizedThrow')).toThrow(
      'Unauthorized action',
    );
  });

  test('should execute authorize method and throw', () => {
    expect(() =>
      service.authorize(mockPolicy, 'unauthorizedThrow', undefined, {
        onException: (message) => {
          throw new Error(message ?? 'Hello World');
        },
      }),
    ).toThrow('Unauthorized action');
  });

  test('should execute policy-level onException handler', () => {
    const onException = vi.fn();
    const localPolicy = definePolicy({
      handlers: MockPolicy,
      onException,
    });

    service.authorize(localPolicy, 'unauthorizedThrow');

    expect(onException).toHaveBeenCalledTimes(1);
    expect(onException).toHaveBeenCalledWith('Unauthorized action');
  });

  test('should execute service-level onException handler', () => {
    const onException = vi.fn();
    const localService = createBouncerService({ onException });

    localService.authorize(mockPolicy, 'unauthorizedThrow');

    expect(onException).toHaveBeenCalledTimes(1);
    expect(onException).toHaveBeenCalledWith('Unauthorized action');
  });

  test('should use default message when policy result omits one', () => {
    expect(() =>
      service.authorize(mockPolicy, 'unauthorizedDefaultMessage'),
    ).toThrow('Unauthorized');
  });

  test('should throw on unknown action authorize', () => {
    expect(() =>
      service.authorize(mockPolicy, 'authorizedd' as keyof typeof MockPolicy),
    ).toThrow('Bouncer action "authorizedd" is not defined');
  });

  test('should rethrow policy errors from check', () => {
    expect(() => service.check(mockPolicy, 'throws')).toThrow(
      'Policy exploded',
    );
  });

  test('should rethrow policy errors from authorize', () => {
    expect(() => service.authorize(mockPolicy, 'throws')).toThrow(
      'Policy exploded',
    );
  });

  test('should support definePolicy declarations', () => {
    const postPolicy = definePolicy({
      handlers: {
        create: (input?: { role: 'admin' | 'editor' | 'viewer' }) => {
          return input?.role === 'admin' || input?.role === 'editor'
            ? { ok: true }
            : { ok: false, message: 'Post creation is forbidden' };
        },
      },
    });

    expect(service.check(postPolicy, 'create', { role: 'editor' })).toEqual({
      ok: true,
    });
  });

  test('should keep type inference isolated per policy', () => {
    expect(
      service.check(mockPolicy2, 'authorized', { world: 'hello' }),
    ).toEqual({
      ok: true,
    });
  });
});
