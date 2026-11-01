import * as migration_20261101_130504 from './20261101_130504';

export const migrations = [
  {
    up: migration_20261101_130504.up,
    down: migration_20261101_130504.down,
    name: '20261101_130504'
  },
];
