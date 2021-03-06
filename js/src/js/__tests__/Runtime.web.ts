// @leosingleton/commonlibs - Common Libraries for TypeScript and .NET Core
// Copyright (c) Leo C. Singleton IV <leo@leosingleton.com>
// See LICENSE in the project root for license information.

import { Runtime } from '../Runtime';
import { AsyncManualResetEvent } from '../../coordination/AsyncManualResetEvent';

describe('Runtime', () => {

  it('Detects a web browser', () => {
    expect(Runtime.isInNode).toBeFalsy();
    expect(Runtime.isInWebWorker).toBeFalsy();
    expect(Runtime.isInWindow).toBeTruthy();
  });

  it('Detects a Web Worker', async () => {
    // WebWorker code is located in /src/__tests__/WebWorker.ts
    const worker = new Worker('base/test-worker.js');

    let result: [boolean, boolean, boolean];
    const done = new AsyncManualResetEvent();
    worker.onmessage = e => {
      if (e.data.command === 'RuntimeUnitTest') {
        result = e.data.value;
        done.setEvent();
      }
    };

    // Invoke the 'TaskScheduler' event. This is a copy of the "Execute tasks in priority order" unit test, which
    // expects a value of 202.
    worker.postMessage({
      command: 'UnitTest',
      testCase: 'Runtime'
    });
    await done.waitAsync();
    expect(result[0]).toBeFalsy(); // isNode
    expect(result[1]).toBeTruthy(); // isWebWorker
    expect(result[2]).toBeFalsy(); // isWindow
  });

});
