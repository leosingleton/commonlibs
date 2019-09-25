// @leosingleton/commonlibs - Common Libraries for TypeScript and .NET Core
// Copyright (c) Leo C. Singleton IV <leo@leosingleton.com>
// See LICENSE in the project root for license information.

import { ResourcePool, RetentionStrategy } from '../ResourcePool';
import { IDisposable } from '../../dotnet/Disposable';

/** Sample object for unit tests */
class SampleObject implements IDisposable {
  public constructor(value: number) {
    this.value = value;
  }

  public value: number;

  public dispose(): void {
    if (this.value === -1) {
      throw new Error('Double dispose')
    } else {
      this.value = -1;
    }
  }

  public freezeCount = 0;
  public defrostCount = 0;
}

/** Just for unit tests. Exposes the grooming timer so we can call it without waiting. */
class SampleResourcePool extends ResourcePool<SampleObject> {
  public constructor(strategy: RetentionStrategy) {
    super(strategy, 0, 3);
  }

  public getSampleObject(value: number, id = ''): SampleObject {
    return this.getOrCreateObject(id, () => new SampleObject(value));
  }

  public simulateGroomingInterval(): void {
    this.groom();
  }

  protected freeze(obj: SampleObject): boolean {
    obj.freezeCount++;
    this.freezeCount++;
    return true;
  }

  protected defrost(obj: SampleObject): boolean {
    obj.defrostCount++;
    this.defrostCount++;
    return true;
  }

  public freezeCount = 0;
  public defrostCount = 0;
}

describe('ResourcePool', () => {

  it('Implements the always dispose strategy', () => {
    let pool = new SampleResourcePool(RetentionStrategy.AlwaysDispose);

    let o1 = pool.getSampleObject(1);
    expect(o1.value).toBe(1);
    o1.dispose();
    expect(o1.value).toBe(-1);

    let o2 = pool.getSampleObject(2);
    expect(o2.value).toBe(2); // New object is created every time

    let o3 = pool.getSampleObject(3);
    expect(o3.value).toBe(3); // New object is created every time
    o3.dispose();
    expect(o3.value).toBe(-1);

    pool.dispose();
    expect(o2.value).toBe(2);
    o2.dispose();
    expect(o2.value).toBe(-1);

    expect(pool.freezeCount).toBe(3);
    expect(pool.defrostCount).toBe(0);
  });

  it('Implements the always keep strategy', () => {
    let pool = new SampleResourcePool(RetentionStrategy.AlwaysKeep);

    let o1 = pool.getSampleObject(1);
    expect(o1.value).toBe(1);
    o1.dispose();
    expect(o1.value).toBe(1); // Returned to pool; not yet disposed
    expect(o1.freezeCount).toBe(1);

    let o2 = pool.getSampleObject(2);
    expect(o1).toEqual(o2);   // Reused object from pool
    expect(o1.defrostCount).toBe(1);

    let o3 = pool.getSampleObject(3);
    expect(o3.value).toBe(3); // Pool was empty; allocated new
    o3.dispose();
    expect(o3.value).toBe(3); // Returned to pool; not yet disposed

    expect(pool.freezeCount).toBe(2);
    expect(pool.defrostCount).toBe(1);

    pool.dispose();
    expect(o1.value).toBe(1);
    expect(o2.value).toBe(1);
    expect(o3.value).toBe(-1);
    o2.dispose();
    expect(o1.value).toBe(-1);
    expect(o2.value).toBe(-1);
  });

  it('Implements the keep minimum dispose strategy', () => {
    let pool = new SampleResourcePool(RetentionStrategy.KeepMinimum);

    let o1 = pool.getSampleObject(1);
    expect(o1.value).toBe(1);
    o1.dispose();
    expect(o1.value).toBe(1); // Returned to pool; not yet disposed
    expect(o1.freezeCount).toBe(1);

    let o2 = pool.getSampleObject(2);
    expect(o1).toEqual(o2);   // Reused object from pool
    expect(o1.defrostCount).toBe(1);

    let o3 = pool.getSampleObject(3);
    expect(o3.value).toBe(3); // Pool was empty; allocated new
    o3.dispose();
    expect(o3.value).toBe(3); // Returned to pool; not yet disposed
    expect(o3.freezeCount).toBe(1);

    pool.simulateGroomingInterval();
    expect(o3.value).toBe(3); // In the previous period, 2 objects were used at the same time. So minimum === 2.

    pool.simulateGroomingInterval();
    expect(o3.value).toBe(-1);// In the last period, only 1 object was used, so the minimum === 1. Extra is disposed.
    pool.simulateGroomingInterval();
    expect(o3.value).toBe(-1);
    pool.simulateGroomingInterval();
    expect(o3.value).toBe(-1);

    o2.dispose();
    expect(o2.value).toBe(1); // Returned to pool; not yet disposed

    expect(pool.freezeCount).toBe(3);
    expect(pool.defrostCount).toBe(1);

    pool.dispose();
    expect(o2.value).toBe(-1);
  });

  it('Implements the keep maximum dispose strategy', () => {
    let pool = new SampleResourcePool(RetentionStrategy.KeepMaximum);

    let o1 = pool.getSampleObject(1);
    expect(o1.value).toBe(1);
    o1.dispose();
    expect(o1.value).toBe(1); // Returned to pool; not yet disposed
    expect(o1.freezeCount).toBe(1);

    let o2 = pool.getSampleObject(2);
    expect(o1).toEqual(o2);   // Reused object from pool
    expect(o1.defrostCount).toBe(1);

    let o3 = pool.getSampleObject(3);
    expect(o3.value).toBe(3); // Pool was empty; allocated new
    o3.dispose();
    expect(o3.value).toBe(3); // Returned to pool; not yet disposed
    expect(o3.freezeCount).toBe(1);

    pool.simulateGroomingInterval();
    expect(o3.value).toBe(3); // In the previous period, 2 objects were used at the same time. So maximum === 2.

    pool.simulateGroomingInterval();
    expect(o3.value).toBe(3); // Only 1 object was used last period, but the maximum of the last 3 period is still 2.
    pool.simulateGroomingInterval();
    expect(o3.value).toBe(3); // Same
    pool.simulateGroomingInterval();
    expect(o3.value).toBe(-1);// The maximum of the last 3 periods is now 1. The extra is disposed.

    o2.dispose();
    expect(o2.value).toBe(1); // Returned to pool; not yet disposed

    expect(pool.freezeCount).toBe(3);
    expect(pool.defrostCount).toBe(1);

    pool.dispose();
    expect(o2.value).toBe(-1);
  });

  it('Separates objects by ID', () => {
    let pool = new SampleResourcePool(RetentionStrategy.AlwaysKeep);

    let o1 = pool.getSampleObject(1, 'a');
    expect(o1.value).toBe(1);
    o1.dispose();
    expect(o1.value).toBe(1); // Returned to pool for 'a'

    let o2 = pool.getSampleObject(2, 'b');
    expect(o2.value).toBe(2); // Created new. ID of 'b' was requested, not 'a'
    o2.dispose();
    expect(o2.value).toBe(2); // Returned to pool for 'b'

    pool.dispose();
    expect(o1.value).toBe(-1);
    expect(o2.value).toBe(-1);
  });

});


/** Special object for testing freeze/defrost */
class FDObject implements IDisposable {
  public isDisposed = false;
  public shouldFreeze = true;
  public shouldDefrost = true;

  public dispose(): void {
    this.isDisposed = true;
  }
}

/** Special pool */
class FDResourcePool extends ResourcePool<FDObject> {
  public constructor() {
    super(RetentionStrategy.AlwaysKeep);
  }

  public getFDObject(): FDObject {
    return this.getOrCreateObject('', () => new FDObject());
  }

  protected freeze(obj: FDObject): boolean {
    return obj.shouldFreeze;
  }

  protected defrost(obj: FDObject): boolean {
    return obj.shouldDefrost;
  }
}

// This is a set of test cases to repro a race condition which created an infinite loop when defrost() returned false,
// which caused the fake dispose() that added it back to the pool, which immediately called defrost() on it again, ...
describe('ResourcePool', () => {

  it('Accepts freezing', () => {
    let pool = new FDResourcePool();

    let obj = pool.getFDObject();
    obj.dispose();
    expect(obj.isDisposed).toBeFalsy();
  });

  it('Rejects freezing', () => {
    let pool = new FDResourcePool();

    let obj1 = pool.getFDObject();
    obj1.shouldFreeze = false;
    obj1.dispose();
    expect(obj1.isDisposed).toBeTruthy();

    let obj2 = pool.getFDObject();
    expect(obj2.isDisposed).toBeFalsy();
  });

  it('Accepts defrosting', () => {
    let pool = new FDResourcePool();

    let obj1 = pool.getFDObject();
    obj1.dispose();

    let obj2 = pool.getFDObject();
    expect(obj1).toBe(obj2);
  });

  it('Rejects defrosting', () => {
    let pool = new FDResourcePool();

    let obj1 = pool.getFDObject();
    obj1.dispose();

    obj1.shouldDefrost = false;
    let obj2 = pool.getFDObject();
    expect(obj1.isDisposed).toBeTruthy();
    expect(obj2.shouldDefrost).toBeTruthy();
  });

});
