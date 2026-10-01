// Small compatibility adapter over Node's built-in synchronous SQLite API.
// This avoids native npm build tools while preserving the query shape used by the routes.
const { DatabaseSync } = require('node:sqlite');

class Database {
  constructor(filename) { this.connection = new DatabaseSync(filename); }

  exec(sql) { return this.connection.exec(sql); }

  prepare(sql) {
    const statement = this.connection.prepare(sql);
    const values = params => params.map(value => value === undefined ? null : value);
    return {
      run: (...params) => statement.run(...values(params)),
      get: (...params) => statement.get(...values(params)),
      all: (...params) => statement.all(...values(params))
    };
  }

  pragma(expression) { return this.connection.prepare(`PRAGMA ${expression}`).get(); }

  transaction(callback) {
    return (...args) => {
      this.connection.exec('BEGIN IMMEDIATE');
      try {
        const result = callback(...args);
        this.connection.exec('COMMIT');
        return result;
      } catch (error) {
        this.connection.exec('ROLLBACK');
        throw error;
      }
    };
  }

  close() { return this.connection.close(); }
}

module.exports = Database;
