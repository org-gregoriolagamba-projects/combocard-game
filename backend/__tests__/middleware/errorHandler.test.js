/**
 * Error handler: the seconds to wait
 *
 * An error that carries `retryAfter` (a request that came too soon) tells the client in the body and in
 * the Retry-After header.
 */

import { errorHandler } from '../../src/middleware/errorHandler.js';
import { AppError } from '../../src/utils/AppError.js';

const respond = (err) => {
  const res = {
    headers: {},
    set: (name, value) => {
      res.headers[name] = value;
      return res;
    },
    status: (code) => {
      res.code = code;
      return res;
    },
    json: (body) => {
      res.body = body;
      return res;
    },
  };
  errorHandler(err, {}, res, () => {});
  return res;
};

describe('errorHandler', () => {
  test('an error with retryAfter sends it in the body and in the Retry-After header', () => {
    const res = respond(Object.assign(new AppError('Wait 5 seconds before drawing', 429), { retryAfter: 5 }));

    expect(res.code).toBe(429);
    expect(res.headers['Retry-After']).toBe('5');
    expect(res.body).toMatchObject({ message: 'Wait 5 seconds before drawing', retryAfter: 5 });
  });

  test('an error without it sends neither', () => {
    const res = respond(new AppError('Game not found', 404));

    expect(res.headers['Retry-After']).toBeUndefined();
    expect(res.body).not.toHaveProperty('retryAfter');
  });
});
