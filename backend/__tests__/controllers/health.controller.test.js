/**
 * Health Controller Tests
 * 
 * Unit tests for health check endpoint.
 */

import { jest } from '@jest/globals';
import { healthCheck, publicStatus } from '../../src/controllers/health.controller.js';

describe('Health Controller', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    mockReq = {};
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe('healthCheck', () => {
    test('should return 200 with ok status', () => {
      healthCheck(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          data: expect.objectContaining({
            status: 'ok',
          })
        })
      );
    });

    test('should include timestamp in response', () => {
      healthCheck(mockReq, mockRes);
      
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            timestamp: expect.any(String),
          })
        })
      );
    });

    test('should include uptime in response', () => {
      healthCheck(mockReq, mockRes);
      
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            uptime: expect.any(Number),
          })
        })
      );
    });

    test('should include success message', () => {
      healthCheck(mockReq, mockRes);
      
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Success',
        })
      );
    });
  });
});

describe('maintenance in the health check and the public status', () => {
  const answer = (handler, gameState) => {
    let payload;
    const res = { status: () => res, json: (body) => { payload = body; return res; } };
    handler({ gameState }, res);
    return payload.data;
  };
  const maintenanceOn = { announcement: null, maintenance: { active: true, message: 'Torno alle 22', endsAt: null } };

  test('the health check says whether the game is in maintenance', () => {
    expect(answer(healthCheck, { announcement: null, maintenance: { active: false } }).maintenance).toBe(false);
    expect(answer(healthCheck, maintenanceOn).maintenance).toBe(true);
    expect(answer(healthCheck, undefined).maintenance).toBe(false);
  });

  test('the public status is the one of the game state, and nothing about the players', () => {
    const state = {
      ...maintenanceOn,
      announcement: { version: 2, active: true, message: 'Ciao', severity: 'info', startsAt: null, endsAt: null, updatedBy: 'p9' },
      players: { p1: { name: 'Anna' } },
    };

    const status = answer(publicStatus, state);

    expect(status).toEqual({
      maintenance: { active: true, message: 'Torno alle 22', endsAt: null },
      announcement: { version: 2, message: 'Ciao', severity: 'info', startsAt: null, endsAt: null },
    });
    expect(JSON.stringify(status)).not.toMatch(/Anna|p9|updatedBy/);
  });

  test('with nothing published the status has nothing', () => {
    expect(answer(publicStatus, { announcement: { active: false }, maintenance: { active: false } })).toEqual({ maintenance: null, announcement: null });
  });
});
