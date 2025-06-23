import redisClient from '../../utils/redis';

describe('redisClient', () => {
  it('should report alive after connect', async () => {
    expect(redisClient.isAlive()).toBe(true);
  });

  it('get returns null for missing key and honors TTL', async () => {
    await redisClient.del('foo');
    expect(await redisClient.get('foo')).toBeNull();

    await redisClient.set('foo','bar',1);
    expect(await redisClient.get('foo')).toBe('bar');
    await new Promise(r => setTimeout(r,1100));
    expect(await redisClient.get('foo')).toBeNull();
  });
});

