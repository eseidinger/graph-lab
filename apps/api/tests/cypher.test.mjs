import assert from 'node:assert/strict';
import test from 'node:test';
import { cypherSql, returnShape } from '../src/cypher.ts';

test('RETURN projections ignore commas in functions and strings', () => {
  assert.deepEqual(
    returnShape("MATCH (n) RETURN coalesce(n.name, 'a,b') AS name, n.age AS age ORDER BY age"),
    { labels: ['name', 'age'], sqlColumns: ['column_1 agtype', 'column_2 agtype'] },
  );
});

test('write queries use one AGE result column and RETURN * is rejected', () => {
  assert.deepEqual(returnShape("CREATE (:Person {name: 'Ada'})"), {
    labels: [], sqlColumns: ['value agtype'],
  });
  assert.throws(() => returnShape('MATCH (n) RETURN *'), /RETURN \*/);
});

test('SQL generation escapes the graph name and avoids Cypher delimiter collisions', () => {
  const sql = cypherSql("graph'name", 'RETURN "$graphlab$"', ['column_1 agtype']);
  assert.match(sql, /cypher\('graph''name', \$graphlab1\$RETURN/);
  assert.match(sql, /\$graphlab1\$\) AS \(column_1 agtype\)$/);
});
