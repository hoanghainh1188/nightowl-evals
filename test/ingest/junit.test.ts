import { describe, expect, it } from 'vitest';
import { parseCiJson } from '../../src/ingest/ci-json.js';
import { parseJunitXml } from '../../src/ingest/junit.js';

const JUNIT = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites>
  <testsuite name="suite-a" tests="2" failures="1">
    <testcase classname="Foo" name="passes" file="src/ok.ts"/>
    <testcase classname="Foo" name="fails" file="src/a.ts">
      <failure message="expected true">AssertionError</failure>
    </testcase>
  </testsuite>
</testsuites>
`;

describe('parseJunitXml', () => {
  it('extracts failed testcases with path and message', () => {
    const records = parseJunitXml(JUNIT, 'abc');
    expect(records).toEqual([
      {
        filePath: 'src/a.ts',
        testName: 'fails',
        classname: 'Foo',
        suite: 'suite-a',
        message: 'expected true\nAssertionError',
        commitSha: 'abc',
      },
    ]);
  });
});

describe('parseCiJson', () => {
  it('reads the documented failures array', () => {
    const records = parseCiJson(
      JSON.stringify({
        failures: [{ file: 'src/b.ts', message: 'boom', name: 't1', commit: 'deadbeef' }],
      }),
    );
    expect(records).toEqual([
      {
        filePath: 'src/b.ts',
        testName: 't1',
        classname: null,
        suite: null,
        message: 'boom',
        commitSha: 'deadbeef',
      },
    ]);
  });
});
