import dbClient from '../../utils/db';

describe('dbClient', () => {
  it('reports not alive before connect, then alive', () => {
    expect(dbClient.isAlive()).toBe(false);
  });

  it('nbUsers & nbFiles start at 0', async () => {
    // wait until mongoose connects under the hood
    await new Promise(res => setTimeout(res,500));
    expect(dbClient.isAlive()).toBe(true);
    expect(await dbClient.nbUsers()).toBe(0);
    expect(await dbClient.nbFiles()).toBe(0);
  });
});

