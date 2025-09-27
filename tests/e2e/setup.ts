import { beforeAll, afterAll, afterEach } from 'vitest';
import nock from 'nock';

beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.SPEC_PILOT_LOG_LEVEL = 'error';
});

afterEach(() => {
  nock.cleanAll();
});

afterAll(() => {
  nock.restore();
});